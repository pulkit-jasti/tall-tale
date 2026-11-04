// The slingshot (docs/giant-tools.md). It rests on its platform beside the
// player. How it is used:
//   1. Grab the handle with either hand (fist or pinch, like the ring handle).
//      It follows that hand, so the player aims by turning hand and body.
//   2. Pinch a pebble from the bowl and bring it to the pouch. Close enough,
//      it clicks in and stays there, whatever the slingshot does. Let go.
//   3. Pinch the pouch with the free hand, pull back, let go to shoot.
// Letting go of the handle glides the slingshot back to its platform (a
// loaded pebble stays in). It also shoots while it rests on the platform,
// so it works with one hand.
//
// The pebble flies in a simple arc (no physics engine) and knocks out the
// first goblin it touches. Soldiers keep topping up the bowl.
//
// Aim assist, in order of importance:
//   1. Steady release: the shot uses the average aim of the last ~100 ms
//      before the fingers opened, not the release frame.
//   2. Trajectory dots over the first half of the arc while pulling.
//   3. Target glow on the goblin about to be hit.
//   4. Gentle bend toward a goblin within a small cone after release.
//   5. A hit area bigger than the pebble.
//
// The frame, pouch, bowl and pebbles in the hand live in fixedRig (cm, never
// turns). Flying pebbles and dots live in boardSpin (cm), where the goblins
// are, so hits are simple.
import {
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Quaternion,
  Vector3,
  type MeshStandardMaterial,
} from 'three';
import type { GameAudio } from '../audio/sound.js';
import { AIM_ASSIST, BOARD, PEBBLE_BOWL, SLINGSHOT, TOOL_SPOTS } from '../config/game.js';
import { mark } from '../debug/perfMarks.js';
import type { Particles } from '../fx/particles.js';
import { applyTouchState, type TouchState } from '../player/feedback.js';
import type { HandState } from '../player/hands.js';
import { degToRad, landingHeight, polarX, polarZ } from '../rules/boardMath.js';
import type { Goblin, Goblins } from '../units/goblins.js';
import { cloneStatic, InstancedPool, loadTemplate, type ModelTemplate } from '../world/models.js';
import { flatMaterial, pebbleBowl, post, slingshotBand, slingshotFrame, slingshotPouch } from '../world/shapes.js';
import type { Stage } from '../world/stage.js';

/** The three things on the slingshot a hand can reach for. */
export type SlingPart = 'pouch' | 'bowl' | 'handle';

interface Pebble {
  alive: boolean;
  age: number;
  /** A dropped pebble only falls. It never hits goblins. */
  harmless: boolean;
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

interface FrameHolder {
  hand: HandState;
  /** Held with a pinch (follow the pinch point) or a fist (follow the palm). */
  viaPinch: boolean;
  openTime: number;
  /** Frame pose relative to the hand, from the moment of the grab. */
  readonly offset: Matrix4;
}

interface HandPebble {
  hand: HandState;
  mesh: Object3D;
}

const SAMPLES = 64;
const UP = new Vector3(0, 1, 0);
const HIT_COLORS = [0x6a8f3a, 0x8fb04a, 0xffffff, 0xf2c14e];
const DUST_COLORS = [0xd9c08a, 0xc9b07a, 0xb59a68];

const temp = new Vector3();
const temp2 = new Vector3();
const temp3 = new Vector3();
const segment = new Vector3();
const toCenter = new Vector3();
const traceP = new Vector3();
const traceV = new Vector3();
const traceNext = new Vector3();
const matrix = new Matrix4();
const handMatrix = new Matrix4();
const quaternion = new Quaternion();
const targetPosition = new Vector3();
const targetQuaternion = new Quaternion();
const targetScale = new Vector3();
const unitScale = new Vector3(1, 1, 1);

export class Slingshot {
  /** Platform and bowl (never move). */
  readonly root = new Group();
  /** The slingshot itself: Y frame, bands and pouch. Origin at the handle bottom. */
  private frame = new Group();
  private pouch!: Mesh;
  private bands: Mesh[] = [];
  private tips: [Vector3, Vector3] = [new Vector3(), new Vector3()];
  private pouchMaterials: MeshStandardMaterial[] = [];
  private woodMaterials: MeshStandardMaterial[] = [];
  private bowlMaterials: MeshStandardMaterial[] = [];
  private pouchTouch: TouchState = 'idle';
  private handleTouch: TouchState = 'idle';
  private bowlTouch: TouchState = 'idle';
  private pouchPebble: Object3D | null = null;
  private pile: Object3D | null = null;
  private stoneTemplate!: ModelTemplate;
  private pebbles: Pebble[] = [];
  private pool!: InstancedPool;
  private pebbleHeight = SLINGSHOT.pebbleSize;
  private dots!: InstancedMesh;
  private hiddenMatrix = new Matrix4().makeScale(0, 0, 0);

  /** Frame local points (cm). */
  private forkLocal = new Vector3();
  private pouchRestLocal = new Vector3();
  /** Rest pose on the platform (fixedRig, cm). */
  private restPosition = new Vector3();
  private restQuaternion = new Quaternion();
  /** Bowl center at the rim (fixedRig, cm). */
  private bowlCenter = new Vector3();

  private frameHolder: FrameHolder | null = null;
  /** Gliding back to the platform: time left (seconds), and the pose it started from. */
  private returnLeft = 0;
  private returnFromPosition = new Vector3();
  private returnFromQuaternion = new Quaternion();

  private pouchHolder: HandState | null = null;
  private handPebbles: HandPebble[] = [];
  private loaded = false;
  /** Pebbles in the bowl. */
  private bowlCount: number = PEBBLE_BOWL.capacity;
  private refillTimer = 0;
  private time = 0;
  private lastCreak = 0;
  /** The player's head (fixedRig, cm), so no shot points at the face. */
  private head = new Vector3();

  /** Aim samples for the steady release: fork and pull (fixedRig, cm). */
  private sampleTime = new Float32Array(SAMPLES);
  private sampleData = new Float32Array(SAMPLES * 6);
  private sampleCount = 0;
  private sampleNext = 0;
  private fork = new Vector3();
  private pull = new Vector3();

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
    this.stoneTemplate = stone;
    this.buildPlatform(platform);
    this.buildFrame();
    this.buildBowl(pile);
    this.buildPebbles(stone);
    this.stage.fixedRig.add(this.root, this.frame);
  }

  private buildPlatform(platform: ModelTemplate): void {
    const { angleDeg, radius } = TOOL_SPOTS.slingshot;
    const top = TOOL_SPOTS.platformTop;
    const a = degToRad(angleDeg);
    const x = polarX(radius, a);
    const z = polarZ(radius, a);
    const stand = cloneStatic(platform);
    stand.position.set(x, top - platform.size.y, z);
    const stem = post();
    stem.position.set(x, stem.position.y + top - platform.size.y, z);
    this.root.add(stand, stem);
    // Rest pose: on the platform, the shot direction (frame -z) pointing out.
    this.restPosition.set(x, top, z);
    this.restQuaternion.setFromAxisAngle(UP, Math.atan2(-Math.sin(a), Math.cos(a)));
  }

  private buildFrame(): void {
    const wood = flatMaterial(SLINGSHOT.woodColor);
    this.woodMaterials = [wood];
    const { frame, tips } = slingshotFrame(wood);
    this.tips = tips;
    const bandMaterial = flatMaterial(SLINGSHOT.bandColor);
    const pouchMaterial = flatMaterial(SLINGSHOT.pouchColor);
    this.pouchMaterials = [bandMaterial, pouchMaterial];
    this.bands = [slingshotBand(bandMaterial), slingshotBand(bandMaterial)];
    this.pouch = slingshotPouch(pouchMaterial);
    this.frame.add(frame, this.bands[0], this.bands[1], this.pouch);
    this.forkLocal.set(0, SLINGSHOT.frameHeight - 1, 0);
    // Behind the fork is +z (toward the player at rest).
    this.pouchRestLocal.set(0, SLINGSHOT.frameHeight - 1, SLINGSHOT.pouchRest);
    this.pouch.position.copy(this.pouchRestLocal);
    this.frame.position.copy(this.restPosition);
    this.frame.quaternion.copy(this.restQuaternion);
    this.updateBands();
  }

  private buildBowl(pile: ModelTemplate): void {
    const { angleDeg, radius, rimY, postLength, depth } = PEBBLE_BOWL;
    const a = degToRad(angleDeg);
    const bowl = new Group();
    this.bowlCenter.set(polarX(radius, a), rimY, polarZ(radius, a));
    bowl.position.copy(this.bowlCenter);
    const stem = post(postLength);
    stem.position.y -= depth;
    const bowlMesh = pebbleBowl();
    this.bowlMaterials = [bowlMesh.material as MeshStandardMaterial];
    bowl.add(bowlMesh, stem);
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
      this.pebbles.push({
        alive: false,
        age: 0,
        harmless: false,
        position: new Vector3(),
        velocity: new Vector3(),
        target: null,
        share: 1,
      });
    }
    // The pebble in the pouch, shown once one is loaded.
    this.pouchPebble = cloneStatic(stone);
    this.pouchPebble.position.y = -stone.size.y / 2 + 0.5;
    this.pouchPebble.visible = false;
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

  /** The nearest slingshot part this hand can reach, with its distance (meters), or null. */
  reach(hand: HandState): { part: SlingPart; distance: number } | null {
    if (!this.root.visible || this.isBusy(hand)) return null;
    let part: SlingPart | null = null;
    let best = Infinity;
    // Pouch: pinch, unless the hand holds the slingshot or the other hand already pulls it.
    if (!this.pouchHolder) {
      const d = hand.pinchPoint.distanceTo(this.pouchWorld(temp));
      if (d < SLINGSHOT.grabRadius && d < best) {
        best = d;
        part = 'pouch';
      }
    }
    // Bowl: pinch to take a pebble.
    {
      const d = hand.pinchPoint.distanceTo(this.stage.fixedRig.localToWorld(temp.copy(this.bowlCenter)));
      if (d < PEBBLE_BOWL.grabRadius && d < best) {
        best = d;
        part = 'bowl';
      }
    }
    // Handle: grab, unless the other hand holds it.
    if (!this.frameHolder) {
      const d = Math.min(this.handleDistance(hand.palm), this.handleDistance(hand.pinchPoint));
      if (d < SLINGSHOT.handleGrabRadius && d < best) {
        best = d;
        part = 'handle';
      }
    }
    return part ? { part, distance: best } : null;
  }

  /** True while this hand holds the slingshot, pulls the pouch or carries a pebble. */
  isBusy(hand: HandState): boolean {
    return (
      this.frameHolder?.hand === hand || this.pouchHolder === hand || this.handPebbles.some((p) => p.hand === hand)
    );
  }

  /**
   * A pinch on the pouch (pull) or the bowl (take a pebble). Returns false,
   * with a buzz, when there is no pebble to pull or take.
   */
  pinch(part: 'pouch' | 'bowl', hand: HandState): boolean {
    if (part === 'pouch') {
      if (!this.loaded) {
        this.audio.play('locked', undefined, 1, 0.4);
        return false;
      }
      this.pouchHolder = hand;
      this.sampleCount = 0;
      this.lastCreak = 0;
      this.audio.play('grab', this.pouchWorld(temp));
      return true;
    }
    if (this.bowlCount <= 0) {
      this.audio.play('locked', undefined, 1, 0.4);
      return false;
    }
    this.bowlCount--;
    this.updatePile();
    const mesh = cloneStatic(this.stoneTemplate);
    this.stage.fixedRig.add(mesh);
    this.handPebbles.push({ hand, mesh });
    this.placeHandPebble(hand, mesh);
    this.audio.play('grab', hand.pinchPoint);
    return true;
  }

  /** Grabs the handle. From now on the slingshot follows this hand. */
  grabHandle(hand: HandState, viaPinch: boolean): void {
    this.frame.updateMatrixWorld(true);
    this.handWorldMatrix(hand, viaPinch, handMatrix);
    const offset = new Matrix4().copy(handMatrix).invert().multiply(this.frame.matrixWorld);
    this.frameHolder = { hand, viaPinch, openTime: 0, offset };
    this.returnLeft = 0;
    this.audio.play('grab', hand.palm);
  }

  /** Lets go of everything without shooting (board placed again). */
  release(): void {
    this.cancelPull();
    if (this.frameHolder) this.letGoOfHandle();
    for (const p of this.handPebbles) this.dropHandPebble(p);
    this.handPebbles.length = 0;
  }

  /** Ready looks for the parts this frame (Locked when there is no pebble). Held is managed here. */
  setReady(pouch: boolean, bowl: boolean, handle: boolean): void {
    this.pouchTouch = this.setTouch(
      this.pouchMaterials,
      this.pouchTouch,
      this.pouchHolder ? 'held' : pouch ? (this.loaded ? 'ready' : 'locked') : 'idle',
    );
    this.bowlTouch = this.setTouch(
      this.bowlMaterials,
      this.bowlTouch,
      bowl ? (this.bowlCount > 0 ? 'ready' : 'locked') : 'idle',
    );
    this.handleTouch = this.setTouch(this.woodMaterials, this.handleTouch, this.frameHolder ? 'held' : handle ? 'ready' : 'idle');
  }

  /** Shows or hides the slingshot (the tutorial director brings it in later). */
  setVisible(visible: boolean): void {
    if (!visible) this.release();
    this.root.visible = visible;
    this.frame.visible = visible;
  }

  // ---- Every frame ----

  update(dt: number, headWorld: Vector3): void {
    this.time += dt;
    this.head.copy(headWorld);
    this.stage.fixedRig.worldToLocal(this.head);
    this.updateBowl(dt);
    this.updateFrame(dt);
    this.updateHandPebbles();

    const hand = this.pouchHolder;
    if (hand) {
      if (!hand.tracked) {
        this.cancelPull();
      } else if (hand.pinch.ended || !hand.pinch.on) {
        this.shoot();
      } else {
        this.followPull(hand);
      }
    } else {
      // Spring back to rest.
      this.pouch.position.lerp(this.pouchRestLocal, 1 - Math.exp(-SLINGSHOT.springBack * dt));
    }
    // Locked: a small wobble, no text.
    this.pouch.rotation.z = this.pouchTouch === 'locked' ? Math.sin(this.time * 30) * 0.2 : 0;
    this.updateBands();
    this.updatePebbles(dt);
  }

  private updateBowl(dt: number): void {
    if (this.bowlCount >= PEBBLE_BOWL.capacity) {
      this.refillTimer = 0;
      return;
    }
    this.refillTimer += dt;
    if (this.refillTimer >= PEBBLE_BOWL.refillEvery) {
      this.refillTimer = 0;
      this.bowlCount++;
      this.updatePile();
    }
  }

  private updatePile(): void {
    if (!this.pile) return;
    const share = this.bowlCount / PEBBLE_BOWL.capacity;
    this.pile.visible = this.bowlCount > 0;
    this.pile.scale.setScalar(PEBBLE_BOWL.pileMinScale + (1 - PEBBLE_BOWL.pileMinScale) * share);
  }

  /** Held: follow the hand. Let go: glide back to the platform. */
  private updateFrame(dt: number): void {
    const holder = this.frameHolder;
    if (holder) {
      // Let go only when the hand is clearly open for a moment (same as the ring).
      const closed = holder.hand.pinch.on || holder.hand.fist.on;
      holder.openTime = closed ? 0 : holder.openTime + dt;
      if (!holder.hand.tracked || holder.openTime >= SLINGSHOT.releaseHold) {
        this.letGoOfHandle();
      } else {
        this.handWorldMatrix(holder.hand, holder.viaPinch, handMatrix);
        matrix.copy(this.stage.fixedRig.matrixWorld).invert().multiply(handMatrix).multiply(holder.offset);
        matrix.decompose(targetPosition, targetQuaternion, targetScale);
        const k = 1 - Math.exp(-dt / SLINGSHOT.holdSmoothing);
        this.frame.position.lerp(targetPosition, k);
        this.frame.quaternion.slerp(targetQuaternion, k);
      }
    } else if (this.returnLeft > 0) {
      this.returnLeft = Math.max(0, this.returnLeft - dt);
      const t = 1 - this.returnLeft / SLINGSHOT.returnTime;
      const s = t * t * (3 - 2 * t);
      this.frame.position.lerpVectors(this.returnFromPosition, this.restPosition, s);
      this.frame.quaternion.slerpQuaternions(this.returnFromQuaternion, this.restQuaternion, s);
    }
    this.frame.updateMatrixWorld(true);
  }

  private letGoOfHandle(): void {
    this.frameHolder = null;
    // A pull in progress cannot go on without someone holding the slingshot.
    this.cancelPull();
    this.returnFromPosition.copy(this.frame.position);
    this.returnFromQuaternion.copy(this.frame.quaternion);
    this.returnLeft = SLINGSHOT.returnTime;
  }

  /** Pebbles carried in a pinch: follow the fingers, click into the empty pouch when close. */
  private updateHandPebbles(): void {
    for (let i = this.handPebbles.length - 1; i >= 0; i--) {
      const p = this.handPebbles[i];
      const hand = p.hand;
      if (!hand.tracked || hand.pinch.ended || !hand.pinch.on) {
        this.dropHandPebble(p);
        this.handPebbles.splice(i, 1);
        continue;
      }
      this.placeHandPebble(hand, p.mesh);
      if (!this.loaded && this.frame.visible && hand.pinchPoint.distanceTo(this.pouchWorld(temp)) < SLINGSHOT.attachRadius) {
        this.loaded = true;
        if (this.pouchPebble) this.pouchPebble.visible = true;
        this.stage.fixedRig.remove(p.mesh);
        this.handPebbles.splice(i, 1);
        this.audio.play('pebbleLoad', temp);
      }
    }
  }

  private placeHandPebble(hand: HandState, mesh: Object3D): void {
    this.stage.fixedRig.worldToLocal(mesh.position.copy(hand.pinchPoint));
    mesh.position.y -= this.pebbleHeight / 2;
  }

  /** Let go of a carried pebble: back into the bowl if over it, otherwise it falls. */
  private dropHandPebble(p: HandPebble): void {
    this.stage.fixedRig.remove(p.mesh);
    const at = p.mesh.position;
    const dx = at.x - this.bowlCenter.x;
    const dz = at.z - this.bowlCenter.z;
    const overBowl = Math.hypot(dx, dz) < PEBBLE_BOWL.width / 2 + 1 && at.y > this.bowlCenter.y - PEBBLE_BOWL.depth;
    if (overBowl) {
      this.bowlCount = Math.min(PEBBLE_BOWL.capacity, this.bowlCount + 1);
      this.updatePile();
      this.audio.play('drop', this.stage.fixedRig.localToWorld(temp.copy(at)), 0.6);
      return;
    }
    this.toBoard(temp.copy(at));
    temp.y += this.pebbleHeight / 2;
    this.launch(temp, temp2.set(0, 0, 0), null, true);
  }

  /** The pouch follows the pinch, up to the longest pull. */
  private followPull(hand: HandState): void {
    this.frame.worldToLocal(temp.copy(hand.pinchPoint));
    temp.sub(this.forkLocal);
    const length = temp.length();
    if (length > SLINGSHOT.maxPull) temp.multiplyScalar(SLINGSHOT.maxPull / length);
    this.pouch.position.copy(this.forkLocal).add(temp);

    // Aim in fixedRig space: the fork and the pull (pouch minus fork).
    this.toRig(this.fork.copy(this.forkLocal));
    this.toRig(this.pull.copy(this.pouch.position)).sub(this.fork);
    this.addSample(this.fork, this.pull);

    const pull = Math.min(length, SLINGSHOT.maxPull);
    if (pull - this.lastCreak >= SLINGSHOT.creakEvery) {
      this.lastCreak = pull;
      this.audio.play('slingStretch', this.pouchWorld(temp2), 1, 0.12);
    } else if (pull < this.lastCreak - SLINGSHOT.creakEvery) {
      this.lastCreak = pull;
    }

    this.aim(this.fork, this.pull);
    if (this.aimValid) {
      this.showDots();
      this.setAimTarget(this.pickTarget());
    } else {
      this.endAim();
    }
  }

  /** Works out the launch from a fork point and a pull vector (fixedRig, cm). Sets aimValid. */
  private aim(fork: Vector3, pull: Vector3): void {
    const length = pull.length();
    this.aimValid = false;
    if (length < SLINGSHOT.minPull) return;
    // The shot goes opposite the pull. Never at the player's own face.
    temp3.copy(this.head).sub(fork).normalize();
    const towardHead = -(pull.x * temp3.x + pull.y * temp3.y + pull.z * temp3.z) / length;
    if (towardHead > Math.cos(degToRad(SLINGSHOT.headConeDeg))) return;
    const t = Math.min(1, (length - SLINGSHOT.minPull) / (SLINGSHOT.maxPull - SLINGSHOT.minPull));
    const speed = SLINGSHOT.minSpeed + (SLINGSHOT.maxSpeed - SLINGSHOT.minSpeed) * t;
    // Into board space: launch point and direction (both frames are in cm).
    this.toBoard(this.aimOrigin.copy(fork));
    this.toBoard(temp2.copy(fork).addScaledVector(pull, -1 / length));
    this.aimVelocity.copy(temp2).sub(this.aimOrigin).normalize().multiplyScalar(speed);
    this.aimValid = true;
    this.traceFlight(this.aimOrigin, this.aimVelocity, this.trace);
  }

  private shoot(): void {
    this.pouchHolder = null;
    // 1. Steady release: average aim before the fingers opened.
    if (this.steadyAim(this.fork, this.pull)) this.aim(this.fork, this.pull);
    if (!this.aimValid || !this.loaded) {
      this.endAim();
      return;
    }
    this.loaded = false;
    if (this.pouchPebble) this.pouchPebble.visible = false;
    this.launch(this.aimOrigin, this.aimVelocity, this.pickTarget(), false);
    this.audio.play('slingRelease', this.pouchWorld(temp));
    this.endAim();
  }

  private cancelPull(): void {
    this.pouchHolder = null;
    this.endAim();
  }

  private launch(origin: Vector3, velocity: Vector3, target: Goblin | null, harmless: boolean): void {
    const pebble = this.pebbles.find((p) => !p.alive);
    if (!pebble) return;
    mark('pebble shot');
    pebble.alive = true;
    pebble.age = 0;
    pebble.harmless = harmless;
    pebble.position.copy(origin);
    pebble.velocity.copy(velocity);
    pebble.target = target;
    pebble.share = target ? AIM_ASSIST.typeShare[target.type] : 0;
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
      const hit = pebble.harmless ? null : this.hitAlong(p, temp);
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

  // ---- Aim samples for the steady release ----

  private addSample(fork: Vector3, pull: Vector3): void {
    const i = this.sampleNext;
    const d = this.sampleData;
    this.sampleTime[i] = this.time;
    d[i * 6] = fork.x;
    d[i * 6 + 1] = fork.y;
    d[i * 6 + 2] = fork.z;
    d[i * 6 + 3] = pull.x;
    d[i * 6 + 4] = pull.y;
    d[i * 6 + 5] = pull.z;
    this.sampleNext = (i + 1) % SAMPLES;
    this.sampleCount = Math.min(SAMPLES, this.sampleCount + 1);
  }

  /** Average fork and pull over the steady window before now. False if there are no samples. */
  private steadyAim(fork: Vector3, pull: Vector3): boolean {
    const to = this.time - AIM_ASSIST.steadySkip;
    const from = to - AIM_ASSIST.steadyWindow;
    const d = this.sampleData;
    fork.set(0, 0, 0);
    pull.set(0, 0, 0);
    let n = 0;
    let newest = -1;
    for (let k = 0; k < this.sampleCount; k++) {
      const i = (this.sampleNext - 1 - k + SAMPLES) % SAMPLES;
      if (newest < 0) newest = i;
      const t = this.sampleTime[i];
      if (t < from) break;
      if (t > to) continue;
      fork.x += d[i * 6];
      fork.y += d[i * 6 + 1];
      fork.z += d[i * 6 + 2];
      pull.x += d[i * 6 + 3];
      pull.y += d[i * 6 + 4];
      pull.z += d[i * 6 + 5];
      n++;
    }
    if (n > 0) {
      fork.multiplyScalar(1 / n);
      pull.multiplyScalar(1 / n);
      return true;
    }
    // A very quick pull (nothing in the window yet): use the newest sample.
    if (newest < 0) return false;
    fork.set(d[newest * 6], d[newest * 6 + 1], d[newest * 6 + 2]);
    pull.set(d[newest * 6 + 3], d[newest * 6 + 4], d[newest * 6 + 5]);
    return true;
  }

  // ---- Looks ----

  /** Stretches each band from its fork tip to the pouch (frame space). */
  private updateBands(): void {
    for (let i = 0; i < 2; i++) {
      const band = this.bands[i];
      const tip = this.tips[i];
      temp2.copy(this.pouch.position).sub(tip);
      const length = Math.max(0.01, temp2.length());
      band.position.copy(tip).addScaledVector(temp2, 0.5);
      band.quaternion.setFromUnitVectors(UP, temp2.multiplyScalar(1 / length));
      band.scale.set(1, length, 1);
    }
  }

  private setTouch(materials: MeshStandardMaterial[], current: TouchState, next: TouchState): TouchState {
    if (current !== next) applyTouchState(materials, next);
    return next;
  }

  // ---- Helpers ----

  private pouchWorld(out: Vector3): Vector3 {
    return this.frame.localToWorld(out.copy(this.pouch.position));
  }

  /** Distance (meters) from a world point to the handle (the bottom part of the frame). */
  private handleDistance(world: Vector3): number {
    this.frame.worldToLocal(temp2.copy(world));
    const y = Math.min(SLINGSHOT.handleHeight, Math.max(0, temp2.y));
    return Math.hypot(temp2.x, temp2.y - y, temp2.z) * 0.01;
  }

  /** The hand's pose as a world matrix: pinch point or palm, and the wrist turn. */
  private handWorldMatrix(hand: HandState, viaPinch: boolean, out: Matrix4): Matrix4 {
    return out.compose(viaPinch ? hand.pinchPoint : hand.palm, hand.quaternion, unitScale);
  }

  /** Frame point (cm) to fixedRig point (cm). */
  private toRig(v: Vector3): Vector3 {
    this.frame.localToWorld(v);
    return this.stage.fixedRig.worldToLocal(v);
  }

  /** fixedRig point (cm) to boardSpin point (cm). */
  private toBoard(v: Vector3): Vector3 {
    this.stage.fixedRig.localToWorld(v);
    return this.stage.boardSpin.worldToLocal(v);
  }

  // ---- Debug ----

  /** Debug: shoots a pebble from the bowl at the goblin closest to the front, without hands. */
  debugShoot(): void {
    if (this.pouchHolder) return;
    if (this.loaded) {
      this.loaded = false;
      if (this.pouchPebble) this.pouchPebble.visible = false;
    } else if (this.bowlCount > 0) {
      this.bowlCount--;
      this.updatePile();
    } else {
      this.audio.play('locked', undefined, 1, 0.4);
      return;
    }
    this.toBoard(this.aimOrigin.copy(this.toRig(temp3.copy(this.forkLocal))));
    // The front of the player in board space, to rank goblins by angle from it.
    this.toBoard(temp.set(0, this.restPosition.y, -100));
    this.toBoard(temp2.set(0, this.restPosition.y, 0));
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
    this.launch(this.aimOrigin, this.aimVelocity, best, false);
    this.audio.play('slingRelease', this.pouchWorld(temp));
  }

  /** Debug: puts a pebble in the pouch without hands. */
  debugLoad(): void {
    this.loaded = true;
    if (this.pouchPebble) this.pouchPebble.visible = true;
    this.audio.play('pebbleLoad', this.pouchWorld(temp));
  }

  /** Debug: empty or fill the bowl. */
  debugBowl(full: boolean): void {
    this.bowlCount = full ? PEBBLE_BOWL.capacity : 0;
    this.refillTimer = 0;
    this.updatePile();
  }
}
