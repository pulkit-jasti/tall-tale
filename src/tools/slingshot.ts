// The slingshot (docs/giant-tools.md): a Y frame fixed on its platform beside
// the player. Pinch the pouch, pull back, let go. The pebble flies in a
// simple arc (no physics engine) and knocks out the first goblin it touches.
// The next pebble comes from the bowl by itself after a short reload, and
// soldiers keep topping up the bowl.
//
// Aim assist, in order of importance:
//   1. Steady release: the shot uses the average pull of the last ~100 ms
//      before the fingers opened, not the release frame.
//   2. Trajectory dots over the first half of the arc while pulling.
//   3. Target glow on the goblin about to be hit.
//   4. Gentle bend toward a goblin within a small cone after release.
//   5. A hit area a bit bigger than the pebble.
//
// The frame, pouch and bowl live in fixedRig (cm, never turns). Pebbles and
// dots live in boardSpin (cm), where the goblins are, so hits are simple.
import { Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Object3D, IcosahedronGeometry, Quaternion, Vector3, type MeshStandardMaterial } from 'three';
import type { GameAudio } from '../audio/sound.js';
import { AIM_ASSIST, BOARD, PEBBLE_BOWL, SLINGSHOT, TOOL_SPOTS } from '../config/game.js';
import { mark } from '../debug/perfMarks.js';
import type { Particles } from '../fx/particles.js';
import { applyTouchState, type TouchState } from '../player/feedback.js';
import type { HandState } from '../player/hands.js';
import { angleDelta, degToRad, landingHeight, polarX, polarZ } from '../rules/boardMath.js';
import type { Goblin, Goblins } from '../units/goblins.js';
import { cloneStatic, InstancedPool, loadTemplate, type ModelTemplate } from '../world/models.js';
import { flatMaterial, pebbleBowl, post, slingshotBand, slingshotFrame, slingshotPouch } from '../world/shapes.js';
import type { Stage } from '../world/stage.js';

interface Pebble {
  alive: boolean;
  age: number;
  readonly position: Vector3;
  readonly velocity: Vector3;
  /** Goblin the assist bends toward, if any. */
  target: Goblin | null;
  /** Assist share for that goblin's type. */
  share: number;
}

interface TraceResult {
  goblin: Goblin | null;
  /** Flight time to the hit or landing (seconds). */
  time: number;
  readonly point: Vector3;
}

const SAMPLES = 64;
const UP = new Vector3(0, 1, 0);
const HIT_COLORS = [0x6a8f3a, 0x8fb04a, 0xffffff, 0xf2c14e];
const DUST_COLORS = [0xd9c08a, 0xc9b07a, 0xb59a68];

const temp = new Vector3();
const temp2 = new Vector3();
const segment = new Vector3();
const toCenter = new Vector3();
const traceP = new Vector3();
const traceV = new Vector3();
const traceNext = new Vector3();
const matrix = new Matrix4();
const quaternion = new Quaternion();

export class Slingshot {
  readonly root = new Group();
  private yawGroup = new Group();
  private pouch!: Mesh;
  private bands: Mesh[] = [];
  private tips: [Vector3, Vector3] = [new Vector3(), new Vector3()];
  private touchMaterials: MeshStandardMaterial[] = [];
  private touch: TouchState = 'idle';
  private pouchPebble: Object3D | null = null;
  private pile: Object3D | null = null;
  private pebbles: Pebble[] = [];
  private pool!: InstancedPool;
  private pebbleHeight = SLINGSHOT.pebbleSize;
  private dots!: InstancedMesh;
  private hiddenMatrix = new Matrix4().makeScale(0, 0, 0);

  /** Fork center and pouch rest point (fixedRig, cm). */
  private forkCenter = new Vector3();
  private pouchRest = new Vector3();
  /** Flat direction from the player to the slingshot (fixedRig). */
  private outward = new Vector3();
  private yaw = 0;
  private restYaw = 0;

  private holder: HandState | null = null;
  private loaded = true;
  private reloadTimer = 0;
  /** Pebbles in the bowl (not counting the one in the pouch). */
  private bowlCount: number = PEBBLE_BOWL.capacity;
  private refillTimer = 0;
  private time = 0;
  private lastCreak = 0;

  /** Pull samples for the steady release (fixedRig, cm). */
  private sampleTime = new Float32Array(SAMPLES);
  private sampleXYZ = new Float32Array(SAMPLES * 3);
  private sampleCount = 0;
  private sampleNext = 0;

  /** Board-space launch point and velocity of the current aim. */
  private aimOrigin = new Vector3();
  private aimVelocity = new Vector3();
  private aimValid = false;
  private aimTarget: Goblin | null = null;
  private trace: TraceResult = { goblin: null, time: 0, point: new Vector3() };

  /** Called with each goblin a pebble knocks out (for the director later). */
  onHit: (goblin: Goblin) => void = () => {};

  constructor(
    private stage: Stage,
    private goblins: Goblins,
    private audio: GameAudio,
    private particles: Particles,
  ) {}

  async load(): Promise<void> {
    const [platform, stone, pile] = await Promise.all([
      loadTemplate('castle/castle-kit/tower-hexagon-top.glb', { width: TOOL_SPOTS.platformWidth }),
      loadTemplate('rocks/survival/resource-stone.glb', { width: SLINGSHOT.pebbleSize }),
      loadTemplate('rocks/survival/resource-stone-large.glb', { width: PEBBLE_BOWL.pileWidth }),
    ]);
    this.buildSlingshot(platform);
    this.buildBowl(pile);
    this.buildPebbles(stone);
    this.stage.fixedRig.add(this.root);
  }

  private buildSlingshot(platform: ModelTemplate): void {
    const { angleDeg, radius } = TOOL_SPOTS.slingshot;
    const top = TOOL_SPOTS.platformTop;
    const a = degToRad(angleDeg);
    const x = polarX(radius, a);
    const z = polarZ(radius, a);

    const stand = cloneStatic(platform);
    stand.position.set(x, top - platform.size.y, z);
    const stem = post();
    stem.position.y += top - platform.size.y;
    stem.position.x = x;
    stem.position.z = z;
    this.root.add(stand, stem);

    const wood = flatMaterial(SLINGSHOT.woodColor);
    const { frame, tips } = slingshotFrame(wood);
    this.yawGroup.add(frame);
    this.yawGroup.position.set(x, top, z);
    this.root.add(this.yawGroup);
    this.tips = tips;

    const bandMaterial = flatMaterial(SLINGSHOT.bandColor);
    const pouchMaterial = flatMaterial(SLINGSHOT.pouchColor);
    this.touchMaterials = [bandMaterial, pouchMaterial];
    this.bands = [slingshotBand(bandMaterial), slingshotBand(bandMaterial)];
    this.pouch = slingshotPouch(pouchMaterial);
    this.root.add(this.bands[0], this.bands[1], this.pouch);

    this.outward.set(Math.sin(a), 0, -Math.cos(a));
    this.restYaw = this.yaw = Math.atan2(-this.outward.x, -this.outward.z);
    this.forkCenter.set(x, top + SLINGSHOT.frameHeight - 1, z);
    this.pouchRest.copy(this.forkCenter).addScaledVector(this.outward, -SLINGSHOT.pouchRest);
    this.pouch.position.copy(this.pouchRest);
    this.applyYaw();
  }

  private buildBowl(pile: ModelTemplate): void {
    const { angleDeg, radius, rimY, postLength, depth } = PEBBLE_BOWL;
    const a = degToRad(angleDeg);
    const bowl = new Group();
    bowl.position.set(polarX(radius, a), rimY, polarZ(radius, a));
    const stem = post(postLength);
    stem.position.y -= depth;
    bowl.add(pebbleBowl(), stem);
    this.pile = cloneStatic(pile);
    this.pile.position.y = -depth * 0.85;
    bowl.add(this.pile);
    this.root.add(bowl);
    this.updatePile();
  }

  private buildPebbles(stone: ModelTemplate): void {
    this.pebbleHeight = stone.size.y;
    this.pool = new InstancedPool(stone, SLINGSHOT.maxPebbles);
    this.stage.boardSpin.add(this.pool.group);
    for (let i = 0; i < SLINGSHOT.maxPebbles; i++) {
      this.pebbles.push({ alive: false, age: 0, position: new Vector3(), velocity: new Vector3(), target: null, share: 1 });
    }
    // The pebble waiting in the pouch.
    this.pouchPebble = cloneStatic(stone);
    this.pouchPebble.position.y = -stone.size.y / 2 + 0.4;
    this.pouch.add(this.pouchPebble);

    this.dots = new InstancedMesh(
      new IcosahedronGeometry(AIM_ASSIST.dotSize, 0),
      new MeshBasicMaterial({ color: AIM_ASSIST.dotColor }),
      AIM_ASSIST.dotCount,
    );
    this.dots.frustumCulled = false;
    this.dots.visible = false;
    for (let i = 0; i < AIM_ASSIST.dotCount; i++) this.dots.setMatrixAt(i, this.hiddenMatrix);
    this.stage.boardSpin.add(this.dots);
  }

  // ---- Hands (called from GrabEat, which picks one target per hand) ----

  /** Distance (meters) from a hand's pinch point to the pouch, or null if out of range or held by the other hand. */
  reach(hand: HandState): number | null {
    if (!this.root.visible) return null;
    if (this.holder && this.holder !== hand) return null;
    this.pouchWorld(temp);
    const d = hand.pinchPoint.distanceTo(temp);
    return d < SLINGSHOT.grabRadius ? d : null;
  }

  isHeldBy(hand: HandState): boolean {
    return this.holder === hand;
  }

  get busy(): boolean {
    return this.holder !== null;
  }

  /** Pinch on the pouch. Returns false (with a buzz) when no pebble is loaded. */
  grab(hand: HandState): boolean {
    if (!this.loaded) {
      this.audio.play('locked', undefined, 1, 0.4);
      return false;
    }
    this.holder = hand;
    this.sampleCount = 0;
    this.lastCreak = 0;
    this.audio.play('grab', this.pouchWorld(temp));
    return true;
  }

  /** Lets go without shooting (board placed again, tracking lost). */
  release(): void {
    this.holder = null;
    this.endAim();
  }

  /** Ready look for the pouch, or Locked when there is no pebble. Held is managed here. */
  setReady(ready: boolean): void {
    this.setTouch(this.holder ? 'held' : ready ? (this.loaded ? 'ready' : 'locked') : 'idle');
  }

  /** Shows or hides the slingshot (the tutorial director brings it in later). */
  setVisible(visible: boolean): void {
    this.root.visible = visible;
    if (!visible) this.release();
  }

  // ---- Every frame ----

  update(dt: number): void {
    this.time += dt;
    this.updateBowl(dt);

    const hand = this.holder;
    if (hand) {
      if (!hand.tracked) {
        this.release();
      } else if (hand.pinch.ended || !hand.pinch.on) {
        this.shoot();
      } else {
        this.follow(hand);
      }
    } else {
      // Spring back to rest.
      const k = 1 - Math.exp(-SLINGSHOT.springBack * dt);
      this.pouch.position.lerp(this.pouchRest, k);
      this.yaw += angleDelta(this.yaw, this.restYaw) * k;
      this.applyYaw();
    }
    // Locked: a small wobble, no text.
    this.pouch.rotation.z = this.touch === 'locked' ? Math.sin(this.time * 30) * 0.2 : 0;
    this.updateBands();
    this.updatePebbles(dt);
  }

  private updateBowl(dt: number): void {
    if (this.bowlCount < PEBBLE_BOWL.capacity) {
      this.refillTimer += dt;
      if (this.refillTimer >= PEBBLE_BOWL.refillEvery) {
        this.refillTimer = 0;
        this.bowlCount++;
        this.updatePile();
      }
    } else {
      this.refillTimer = 0;
    }
    if (!this.loaded) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0 && this.bowlCount > 0) {
        this.bowlCount--;
        this.updatePile();
        this.loaded = true;
        if (this.pouchPebble) this.pouchPebble.visible = true;
      }
    }
  }

  private updatePile(): void {
    if (!this.pile) return;
    const share = this.bowlCount / PEBBLE_BOWL.capacity;
    this.pile.visible = this.bowlCount > 0;
    this.pile.scale.setScalar(PEBBLE_BOWL.pileMinScale + (1 - PEBBLE_BOWL.pileMinScale) * share);
  }

  /** The pouch follows the pinch, up to the longest pull, and the frame turns to face the shot. */
  private follow(hand: HandState): void {
    temp.copy(hand.pinchPoint);
    this.stage.fixedRig.worldToLocal(temp);
    temp.sub(this.forkCenter);
    const length = temp.length();
    if (length > SLINGSHOT.maxPull) temp.multiplyScalar(SLINGSHOT.maxPull / length);
    this.pouch.position.copy(this.forkCenter).add(temp);
    this.addSample(temp);

    const pull = Math.min(length, SLINGSHOT.maxPull);
    if (pull - this.lastCreak >= SLINGSHOT.creakEvery) {
      this.lastCreak = pull;
      this.audio.play('slingStretch', this.pouchWorld(temp2), 1, 0.12);
    } else if (pull < this.lastCreak - SLINGSHOT.creakEvery) {
      this.lastCreak = pull;
    }

    // temp is the pull (pouch minus fork). The shot goes the other way.
    this.aim(temp);
    if (this.aimValid) {
      const dx = -temp.x;
      const dz = -temp.z;
      if (dx * dx + dz * dz > 1e-4) this.yaw = Math.atan2(-dx, -dz);
      this.applyYaw();
      this.showDots();
      this.setAimTarget(this.pickTarget());
    } else {
      this.endAim();
    }
  }

  /** Works out the launch from a pull vector (fixedRig, cm). Sets aimValid. */
  private aim(pull: Vector3): void {
    const length = pull.length();
    this.aimValid = false;
    if (length < SLINGSHOT.minPull) return;
    // Direction of the shot, flat part, must point away from the player.
    const flat = Math.hypot(pull.x, pull.z);
    const outwardDot = flat > 1e-6 ? (-pull.x * this.outward.x - pull.z * this.outward.z) / flat : 0;
    if (outwardDot < SLINGSHOT.minOutward) return;
    const t = Math.min(1, (length - SLINGSHOT.minPull) / (SLINGSHOT.maxPull - SLINGSHOT.minPull));
    const speed = SLINGSHOT.minSpeed + (SLINGSHOT.maxSpeed - SLINGSHOT.minSpeed) * t;
    // Into board space: launch point and direction (both frames are in cm).
    this.toBoard(this.aimOrigin.copy(this.forkCenter));
    this.toBoard(temp2.copy(this.forkCenter).addScaledVector(pull, -1 / length));
    this.aimVelocity.copy(temp2).sub(this.aimOrigin).normalize().multiplyScalar(speed);
    this.aimValid = true;
    this.traceFlight(this.aimOrigin, this.aimVelocity, this.trace);
  }

  private shoot(): void {
    this.holder = null;
    // 1. Steady release: average pull before the fingers opened.
    if (this.steadyPull(temp)) this.aim(temp);
    if (!this.aimValid || !this.loaded) {
      this.endAim();
      return;
    }
    const target = this.pickTarget();
    this.launch(this.aimOrigin, this.aimVelocity, target);
    this.endAim();
  }

  private launch(origin: Vector3, velocity: Vector3, target: Goblin | null): void {
    const pebble = this.pebbles.find((p) => !p.alive);
    if (!pebble) return;
    mark('pebble shot');
    pebble.alive = true;
    pebble.age = 0;
    pebble.position.copy(origin);
    pebble.velocity.copy(velocity);
    pebble.target = target;
    pebble.share = target ? AIM_ASSIST.typeShare[target.type] : 0;
    this.loaded = false;
    this.reloadTimer = SLINGSHOT.reloadTime;
    if (this.pouchPebble) this.pouchPebble.visible = false;
    this.audio.play('slingRelease', this.pouchWorld(temp));
  }

  private endAim(): void {
    this.aimValid = false;
    this.dots.visible = false;
    this.setAimTarget(null);
  }

  private setAimTarget(goblin: Goblin | null): void {
    if (goblin === this.aimTarget) return;
    this.aimTarget = goblin;
    this.goblins.setAimed(goblin);
  }

  /** 3 and 4: the goblin on the predicted path, or else the best one in the assist cone. */
  private pickTarget(): Goblin | null {
    if (!this.aimValid) return null;
    if (this.trace.goblin) return this.trace.goblin;
    if (AIM_ASSIST.strength <= 0) return null;
    const o = this.aimOrigin;
    const v = this.aimVelocity;
    const flatSpeed = Math.hypot(v.x, v.z);
    if (flatSpeed < 1e-3) return null;
    const range = Math.hypot(this.trace.point.x - o.x, this.trace.point.z - o.z);
    const cone = degToRad(AIM_ASSIST.coneDeg);
    let best: Goblin | null = null;
    let bestAngle = cone;
    for (const g of this.goblins.list) {
      if (!this.goblins.isHittable(g) || AIM_ASSIST.typeShare[g.type] <= 0) continue;
      const dx = g.root.position.x - o.x;
      const dz = g.root.position.z - o.z;
      const d = Math.hypot(dx, dz);
      if (d < 1 || d > range * 1.25) continue;
      const angle = Math.abs(Math.atan2(v.x * dz - v.z * dx, v.x * dx + v.z * dz));
      if (angle < bestAngle) {
        bestAngle = angle;
        best = g;
      }
    }
    return best;
  }

  /** 2. Dots along the first part of the arc (board space). */
  private showDots(): void {
    const { dotCount, dotShare } = AIM_ASSIST;
    const g = SLINGSHOT.gravity;
    const end = this.trace.time * dotShare;
    for (let i = 0; i < dotCount; i++) {
      const t = (end * (i + 1)) / dotCount;
      temp2
        .copy(this.aimOrigin)
        .addScaledVector(this.aimVelocity, t)
        .setY(this.aimOrigin.y + this.aimVelocity.y * t - 0.5 * g * t * t);
      matrix.makeTranslation(temp2.x, temp2.y, temp2.z);
      this.dots.setMatrixAt(i, matrix);
    }
    this.dots.instanceMatrix.needsUpdate = true;
    this.dots.visible = true;
  }

  /** Predicts a flight from a launch (board space): the first goblin hit, or where it lands. */
  private traceFlight(origin: Vector3, velocity: Vector3, out: TraceResult): void {
    const step = AIM_ASSIST.traceStep;
    const g = SLINGSHOT.gravity;
    const p = traceP.copy(origin);
    const v = traceV.copy(velocity);
    const next = traceNext;
    out.goblin = null;
    for (let t = 0; t < SLINGSHOT.maxFlight; t += step) {
      next.set(p.x + v.x * step, p.y + v.y * step - 0.5 * g * step * step, p.z + v.z * step);
      v.y -= g * step;
      const hit = this.hitAlong(p, next);
      if (hit) {
        out.goblin = hit;
        out.time = t + step;
        out.point.copy(next);
        return;
      }
      if (this.landed(next)) {
        out.time = t + step;
        out.point.copy(next);
        return;
      }
      p.copy(next);
    }
    out.time = SLINGSHOT.maxFlight;
    out.point.copy(p);
  }

  private updatePebbles(dt: number): void {
    const g = SLINGSHOT.gravity;
    const turnMax = degToRad(AIM_ASSIST.turnDegPerSec) * AIM_ASSIST.strength * dt;
    const cone = degToRad(AIM_ASSIST.coneDeg);
    for (let i = 0; i < this.pebbles.length; i++) {
      const pebble = this.pebbles[i];
      if (!pebble.alive) continue;
      pebble.age += dt;
      const p = pebble.position;
      const v = pebble.velocity;
      // 4. Gentle bend toward the target while it stays in the cone.
      const target = pebble.target;
      if (target && this.goblins.isHittable(target) && pebble.share > 0) {
        const dx = target.root.position.x - p.x;
        const dz = target.root.position.z - p.z;
        const angle = Math.atan2(v.x * dz - v.z * dx, v.x * dx + v.z * dz);
        if (Math.abs(angle) < cone) {
          const turn = Math.sign(angle) * Math.min(Math.abs(angle), turnMax * pebble.share);
          // Turning the flat velocity by `turn` (same sense as the angle above).
          const c = Math.cos(turn);
          const s = Math.sin(turn);
          const vx = v.x * c - v.z * s;
          const vz = v.x * s + v.z * c;
          v.x = vx;
          v.z = vz;
        }
      }
      temp.set(p.x + v.x * dt, p.y + v.y * dt - 0.5 * g * dt * dt, p.z + v.z * dt);
      v.y -= g * dt;
      const hit = this.hitAlong(p, temp);
      if (hit) {
        p.copy(temp);
        this.knockOut(hit);
        this.removePebble(i);
        continue;
      }
      p.copy(temp);
      if (this.landed(p)) {
        this.dust(p);
        this.removePebble(i);
        continue;
      }
      if (pebble.age > SLINGSHOT.maxFlight || p.y < SLINGSHOT.killBelow) {
        this.removePebble(i);
        continue;
      }
      quaternion.setFromAxisAngle(UP, pebble.age * 12);
      matrix.makeRotationFromQuaternion(quaternion).setPosition(p.x, p.y - this.pebbleHeight / 2, p.z);
      this.pool.set(i, matrix);
    }
    this.pool.commit();
  }

  private removePebble(index: number): void {
    this.pebbles[index].alive = false;
    this.pebbles[index].target = null;
    this.pool.hide(index);
  }

  /** 5. First goblin whose middle is within the hit area of the segment a to b (board space). */
  private hitAlong(a: Vector3, b: Vector3): Goblin | null {
    segment.copy(b).sub(a);
    const lengthSq = segment.lengthSq();
    let best: Goblin | null = null;
    let bestT = Infinity;
    for (const g of this.goblins.list) {
      if (!this.goblins.isHittable(g)) continue;
      const h = g.stats.height;
      toCenter.copy(g.root.position);
      toCenter.y += h * 0.5;
      toCenter.sub(a);
      const t = lengthSq > 0 ? Math.min(1, Math.max(0, toCenter.dot(segment) / lengthSq)) : 0;
      const dx = toCenter.x - segment.x * t;
      const dy = toCenter.y - segment.y * t;
      const dz = toCenter.z - segment.z * t;
      const reach = AIM_ASSIST.hitRadius + h * 0.35;
      if (dx * dx + dy * dy + dz * dz < reach * reach && t < bestT) {
        bestT = t;
        best = g;
      }
    }
    return best;
  }

  /** True when a board point is on or under the ground (or past the edge). */
  private landed(p: Vector3): boolean {
    const r = Math.hypot(p.x, p.z);
    if (r > BOARD.outerRadius) return true;
    const ground = landingHeight(r);
    if (ground === null) return false;
    if (p.y <= ground) {
      p.y = ground;
      return true;
    }
    return false;
  }

  private knockOut(goblin: Goblin): void {
    this.goblins.worldPosition(goblin, temp2);
    this.goblins.kill(goblin);
    this.particles.burst(temp2, HIT_COLORS, 10);
    this.audio.play('pebbleHit', temp2);
    this.audio.play('poof', temp2, 1, 0.05);
    this.onHit(goblin);
  }

  private dust(p: Vector3): void {
    this.stage.boardSpin.localToWorld(temp2.copy(p));
    this.particles.burst(temp2, DUST_COLORS, 4, 0.12);
    this.audio.play('pebbleHit', temp2, 0.35, 0.1);
  }

  // ---- Pull samples for the steady release ----

  private addSample(pull: Vector3): void {
    const i = this.sampleNext;
    this.sampleTime[i] = this.time;
    this.sampleXYZ[i * 3] = pull.x;
    this.sampleXYZ[i * 3 + 1] = pull.y;
    this.sampleXYZ[i * 3 + 2] = pull.z;
    this.sampleNext = (i + 1) % SAMPLES;
    this.sampleCount = Math.min(SAMPLES, this.sampleCount + 1);
  }

  /** Average pull over the steady window before now. False if there are no samples. */
  private steadyPull(out: Vector3): boolean {
    const to = this.time - AIM_ASSIST.steadySkip;
    const from = to - AIM_ASSIST.steadyWindow;
    out.set(0, 0, 0);
    let n = 0;
    let newest = -1;
    for (let k = 0; k < this.sampleCount; k++) {
      const i = (this.sampleNext - 1 - k + SAMPLES) % SAMPLES;
      if (newest < 0) newest = i;
      const t = this.sampleTime[i];
      if (t < from) break;
      if (t > to) continue;
      out.x += this.sampleXYZ[i * 3];
      out.y += this.sampleXYZ[i * 3 + 1];
      out.z += this.sampleXYZ[i * 3 + 2];
      n++;
    }
    if (n > 0) {
      out.multiplyScalar(1 / n);
      return true;
    }
    // A very quick pull (nothing in the window yet): use the newest sample.
    if (newest < 0) return false;
    out.set(this.sampleXYZ[newest * 3], this.sampleXYZ[newest * 3 + 1], this.sampleXYZ[newest * 3 + 2]);
    return true;
  }

  // ---- Looks ----

  private applyYaw(): void {
    this.yawGroup.rotation.y = this.yaw;
    this.pouch.rotation.y = this.yaw;
  }

  /** Stretches each band from its fork tip to the pouch. */
  private updateBands(): void {
    for (let i = 0; i < 2; i++) {
      const band = this.bands[i];
      temp.copy(this.tips[i]).applyAxisAngle(UP, this.yaw).add(this.yawGroup.position);
      temp2.copy(this.pouch.position).sub(temp);
      const length = Math.max(0.01, temp2.length());
      band.position.copy(temp).addScaledVector(temp2, 0.5);
      band.quaternion.setFromUnitVectors(UP, temp2.multiplyScalar(1 / length));
      band.scale.set(1, length, 1);
    }
  }

  private setTouch(state: TouchState): void {
    if (this.touch === state) return;
    this.touch = state;
    applyTouchState(this.touchMaterials, state);
  }

  // ---- Helpers ----

  private pouchWorld(out: Vector3): Vector3 {
    return this.stage.fixedRig.localToWorld(out.copy(this.pouch.position));
  }

  /** fixedRig point (cm) to boardSpin point (cm). */
  private toBoard(v: Vector3): Vector3 {
    this.stage.fixedRig.localToWorld(v);
    return this.stage.boardSpin.worldToLocal(v);
  }

  /** Pebbles ready to shoot: the bowl plus the one in the pouch. */
  get pebblesLeft(): number {
    return this.bowlCount + (this.loaded ? 1 : 0);
  }

  // ---- Debug ----

  /** Debug: shoots at the goblin closest to the front, without hands. */
  debugShoot(): void {
    if (!this.loaded || this.holder) {
      this.audio.play('locked', undefined, 1, 0.4);
      return;
    }
    this.toBoard(this.aimOrigin.copy(this.forkCenter));
    // The front of the player in board space, to rank goblins by angle from it.
    this.toBoard(temp.set(0, this.forkCenter.y, -100));
    this.toBoard(temp2.set(0, this.forkCenter.y, 0));
    const fx = temp.x - temp2.x;
    const fz = temp.z - temp2.z;
    let best: Goblin | null = null;
    let bestScore = Infinity;
    for (const g of this.goblins.list) {
      if (!this.goblins.isHittable(g)) continue;
      const dx = g.root.position.x - temp2.x;
      const dz = g.root.position.z - temp2.z;
      const score = Math.abs(Math.atan2(fx * dz - fz * dx, fx * dx + fz * dz));
      if (score < bestScore) {
        bestScore = score;
        best = g;
      }
    }
    const g = SLINGSHOT.gravity;
    if (best) {
      temp.copy(best.root.position);
      temp.y += best.stats.height * 0.5;
    } else {
      temp.set(fx, 0, fz).normalize().multiplyScalar(200).add(temp2);
    }
    temp.sub(this.aimOrigin);
    const flight = 0.35 + Math.hypot(temp.x, temp.z) / 450;
    this.aimVelocity.set(temp.x / flight, (temp.y + 0.5 * g * flight * flight) / flight, temp.z / flight);
    this.launch(this.aimOrigin, this.aimVelocity, best);
  }

  /** Debug: empty or fill the bowl. */
  debugBowl(full: boolean): void {
    this.bowlCount = full ? PEBBLE_BOWL.capacity : 0;
    if (!full) this.loaded = false;
    if (this.pouchPebble) this.pouchPebble.visible = this.loaded;
    this.refillTimer = 0;
    this.updatePile();
  }
}
