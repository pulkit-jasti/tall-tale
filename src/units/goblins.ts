// Goblins: spawning, walking the roads, hitting or climbing the wall,
// wandering the courtyard as intruders, and being held, dropped or eaten.
// All positions are in board units (cm) inside the turning board group.
import {
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  Color,
  Group,
  LoopOnce,
  LoopRepeat,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Vector3,
} from 'three';
import type { GameAudio } from '../audio/sound.js';
import { mark } from '../debug/perfMarks.js';
import { CASTLE, GOBLIN_RULES, GOBLINS, ROADS, type GoblinStats, type GoblinType } from '../config/game.js';
import { angleOf, boardHeight, landingHeight, polarX, polarZ, zoneAt } from '../rules/boardMath.js';
import type { Random } from '../rules/random.js';
import { applyAimGlow, applyTouchState, type TouchState } from '../player/feedback.js';
import { cloneSkinned, loadTemplate, type ModelTemplate } from '../world/models.js';
import type { Road } from '../world/roads.js';

export type GoblinMode =
  | 'dead'
  | 'walking'
  | 'toWall'
  | 'atWall'
  | 'climbing'
  | 'rampart'
  | 'intruder'
  | 'held'
  | 'falling'
  | 'dazed';

const GRABBABLE: ReadonlySet<GoblinMode> = new Set<GoblinMode>([
  'walking',
  'toWall',
  'atWall',
  'climbing',
  'rampart',
  'intruder',
  'dazed',
]);

export class Goblin {
  readonly root = new Group();
  readonly body = new Group();
  readonly materials: MeshStandardMaterial[] = [];
  readonly mixer: AnimationMixer;
  private actions = new Map<string, AnimationAction>();
  private current: AnimationAction | null = null;

  type: GoblinType = 'grunt';
  stats: GoblinStats = GOBLINS.grunt;
  mode: GoblinMode = 'dead';
  road: Road | null = null;
  distance = 0;
  offset = 0;
  speed = 0;
  timer = 0;
  /** Velocity while falling or flying, and the smoothed hand speed while held (cm per second). */
  vx = 0;
  vy = 0;
  vz = 0;
  /** Position last frame while held, to measure the hand speed. */
  readonly lastHeld = new Vector3();
  hasLastHeld = false;
  landAs: 'dazed' | 'intruder' = 'dazed';
  attackRight = true;
  touch: TouchState = 'idle';
  readonly target = new Vector3();
  hasTarget = false;

  constructor(
    template: ModelTemplate,
    private clips: AnimationClip[],
    private baseColor: Color,
  ) {
    const model = cloneSkinned(template);
    const material = (findMaterial(model) ?? new MeshStandardMaterial()).clone();
    model.traverse((o) => {
      const mesh = o as Mesh;
      if (mesh.isMesh) mesh.material = material;
    });
    this.materials.push(material);
    this.body.add(model);
    this.root.add(this.body);
    this.root.visible = false;
    this.mixer = new AnimationMixer(model);
  }

  setType(type: GoblinType): void {
    this.type = type;
    this.stats = GOBLINS[type];
    this.body.scale.setScalar(this.stats.height);
    const [r, g, b] = this.stats.tint;
    this.materials[0].color.copy(this.baseColor).multiply(new Color(r, g, b));
  }

  play(name: string, loop = true, timeScale = 1): void {
    let action = this.actions.get(name);
    if (!action) {
      const clip = AnimationClip.findByName(this.clips, name);
      if (!clip) return;
      action = this.mixer.clipAction(clip);
      this.actions.set(name, action);
    }
    action.timeScale = timeScale;
    if (action === this.current && loop) return;
    action.reset();
    action.setLoop(loop ? LoopRepeat : LoopOnce, Infinity);
    action.clampWhenFinished = !loop;
    action.fadeIn(GOBLIN_RULES.fade).play();
    if (this.current && this.current !== action) this.current.fadeOut(GOBLIN_RULES.fade);
    this.current = action;
  }

  /** Turn so the model's front (+z) points along (dx, dz). */
  face(dx: number, dz: number): void {
    if (dx * dx + dz * dz > 1e-8) this.root.rotation.y = Math.atan2(dx, dz);
  }

  faceCenter(): void {
    this.face(-this.root.position.x, -this.root.position.z);
  }
}

function findMaterial(object: Object3D): MeshStandardMaterial | null {
  let found: MeshStandardMaterial | null = null;
  object.traverse((o) => {
    const mesh = o as Mesh;
    if (!found && mesh.isMesh) found = mesh.material as MeshStandardMaterial;
  });
  return found;
}

const temp = new Vector3();
const temp2 = new Vector3();

export class Goblins {
  readonly list: Goblin[] = [];
  /** Most goblins at once. The debug stress test can raise it. */
  cap = GOBLIN_RULES.maxGoblins;
  /** The goblin the slingshot is about to hit (glows while aiming). */
  private aimed: Goblin | null = null;
  private template!: ModelTemplate;
  private baseColor = new Color(1, 1, 1);

  constructor(
    private board: Object3D,
    private roads: Road[],
    private rng: Random,
    private audio: GameAudio,
  ) {}

  async load(): Promise<void> {
    this.template = await loadTemplate('characters/mini-dungeon/character-orc.glb', { height: 1 }, true);
    const material = findMaterial(this.template.object);
    if (material) this.baseColor.copy(material.color);
  }

  get aliveCount(): number {
    return this.list.filter((g) => g.mode !== 'dead').length;
  }

  private obtain(type: GoblinType): Goblin | null {
    let goblin = this.list.find((g) => g.mode === 'dead') ?? null;
    if (!goblin) {
      if (this.list.length >= this.cap) return null;
      goblin = new Goblin(this.template, this.template.animations, this.baseColor);
      mark('goblin built');
      this.board.add(goblin.root);
      this.list.push(goblin);
    }
    mark('goblin spawn');
    goblin.setType(type);
    goblin.speed = goblin.stats.speed * (1 + this.rng.range(-GOBLIN_RULES.speedJitter, GOBLIN_RULES.speedJitter));
    goblin.root.visible = true;
    goblin.root.rotation.set(0, 0, 0);
    goblin.hasTarget = false;
    this.setTouch(goblin, 'idle');
    return goblin;
  }

  /** Spawns a goblin at the camp end of a road. Returns null at the unit cap. */
  spawnOnRoad(type: GoblinType, roadIndex: number): Goblin | null {
    const road = this.roads[roadIndex % this.roads.length];
    const goblin = this.obtain(type);
    if (!goblin) return null;
    goblin.mode = 'walking';
    goblin.road = road;
    goblin.distance = 0;
    goblin.offset = this.rng.range(-ROADS.laneJitter, ROADS.laneJitter);
    road.pointAt(0, goblin.offset, goblin.root.position);
    goblin.play(goblin.stats.moveClip, true, goblin.stats.moveClipSpeed);
    return goblin;
  }

  /** Spawns a climber already climbing the wall at a board angle (radians). */
  spawnClimberAt(angle: number): Goblin | null {
    const goblin = this.obtain('climber');
    if (!goblin) return null;
    const r = CASTLE.wallOut + 0.6;
    goblin.root.position.set(polarX(r, angle), 0, polarZ(r, angle));
    this.startClimbing(goblin);
    return goblin;
  }

  kill(goblin: Goblin): void {
    if (this.aimed === goblin) this.setAimed(null);
    goblin.mode = 'dead';
    goblin.root.visible = false;
    goblin.road = null;
  }

  killAll(): void {
    for (const g of this.list) if (g.mode !== 'dead' && g.mode !== 'held') this.kill(g);
  }

  setTouch(goblin: Goblin, state: TouchState): void {
    if (goblin.touch === state) return;
    goblin.touch = state;
    this.applyLook(goblin);
  }

  /** Marks the goblin the slingshot is about to hit (null for none). Touch states win over it. */
  setAimed(goblin: Goblin | null): void {
    if (this.aimed === goblin) return;
    const previous = this.aimed;
    this.aimed = goblin;
    if (previous) this.applyLook(previous);
    if (goblin) this.applyLook(goblin);
  }

  private applyLook(goblin: Goblin): void {
    if (goblin === this.aimed && goblin.touch === 'idle') applyAimGlow(goblin.materials);
    else applyTouchState(goblin.materials, goblin.touch);
  }

  /** Goblins a pebble can hit: everything alive except the ones in the giant's hand. */
  isHittable(goblin: Goblin): boolean {
    return goblin.mode !== 'dead' && goblin.mode !== 'held';
  }

  /** Grab point of a goblin (its middle) in world space. */
  centerWorld(goblin: Goblin, out: Vector3): Vector3 {
    out.copy(goblin.root.position);
    out.y += goblin.stats.height * 0.55;
    return this.board.localToWorld(out);
  }

  worldPosition(goblin: Goblin, out: Vector3): Vector3 {
    return this.board.localToWorld(out.copy(goblin.root.position));
  }

  /** Nearest goblin that can be picked up within `radius` meters of a world point. */
  nearestGrabbable(point: Vector3, radius: number, exclude: Goblin | null = null): Goblin | null {
    let best: Goblin | null = null;
    let bestDistance = radius;
    for (const g of this.list) {
      if (g === exclude || !GRABBABLE.has(g.mode)) continue;
      const d = this.centerWorld(g, temp).distanceTo(point);
      if (d < bestDistance) {
        bestDistance = d;
        best = g;
      }
    }
    return best;
  }

  grab(goblin: Goblin): void {
    goblin.mode = 'held';
    goblin.vx = goblin.vy = goblin.vz = 0;
    goblin.hasLastHeld = false;
    goblin.play('fall', true, 1.6);
    this.audio.play('grab', this.worldPosition(goblin, temp));
    this.audio.play('squeal', temp);
  }

  /**
   * Keeps a held goblin dangling from the pinch point, looking at the giant.
   * Also measures the hand speed (smoothed), so letting go mid-swing throws it.
   */
  holdAt(goblin: Goblin, pinchWorld: Vector3, headWorld: Vector3, dt: number): void {
    const p = goblin.root.position;
    this.board.worldToLocal(temp.copy(pinchWorld));
    p.set(temp.x, temp.y - goblin.stats.height * 0.85, temp.z);
    if (goblin.hasLastHeld && dt > 0) {
      const k = 1 - Math.exp(-dt / GOBLIN_RULES.throwSmoothing);
      goblin.vx += ((p.x - goblin.lastHeld.x) / dt - goblin.vx) * k;
      goblin.vy += ((p.y - goblin.lastHeld.y) / dt - goblin.vy) * k;
      goblin.vz += ((p.z - goblin.lastHeld.z) / dt - goblin.vz) * k;
    }
    goblin.lastHeld.copy(p);
    goblin.hasLastHeld = true;
    this.board.worldToLocal(temp2.copy(headWorld));
    goblin.face(temp2.x - temp.x, temp2.z - temp.z);
  }

  /** Lets go anywhere but the mouth: the goblin flies with the hand's speed, then lands. */
  drop(goblin: Goblin): void {
    goblin.vx *= GOBLIN_RULES.throwScale;
    goblin.vy *= GOBLIN_RULES.throwScale;
    goblin.vz *= GOBLIN_RULES.throwScale;
    const speed = Math.hypot(goblin.vx, goblin.vy, goblin.vz);
    if (speed > GOBLIN_RULES.maxThrowSpeed) {
      const s = GOBLIN_RULES.maxThrowSpeed / speed;
      goblin.vx *= s;
      goblin.vy *= s;
      goblin.vz *= s;
    }
    goblin.mode = 'falling';
    goblin.landAs = 'dazed';
    goblin.play('fall', true, 1);
  }

  update(dt: number): void {
    for (const g of this.list) {
      if (g.mode === 'dead') continue;
      this.step(g, dt);
      g.mixer.update(dt);
    }
  }

  private step(g: Goblin, dt: number): void {
    const p = g.root.position;
    switch (g.mode) {
      case 'walking': {
        const road = g.road!;
        g.distance += g.speed * dt;
        road.pointAt(g.distance, g.offset, p);
        road.directionAt(g.distance, temp);
        g.face(temp.x, temp.z);
        if (g.distance >= road.length) this.headToWall(g);
        break;
      }
      case 'toWall': {
        if (this.moveToward(g, g.target, g.speed, dt)) {
          if (g.type === 'climber') this.startClimbing(g);
          else this.startAttacking(g);
        }
        p.y = boardHeight(Math.hypot(p.x, p.z));
        break;
      }
      case 'atWall': {
        g.timer -= dt;
        if (g.timer <= 0) {
          g.timer = GOBLIN_RULES.wallHitInterval * this.rng.range(0.85, 1.15);
          g.attackRight = !g.attackRight;
          g.play(g.attackRight ? 'attack-melee-right' : 'attack-melee-left', false);
          this.audio.play('wallHit', this.worldPosition(g, temp), 1, GOBLIN_RULES.wallHitSoundGap);
        }
        break;
      }
      case 'climbing': {
        p.y += GOBLIN_RULES.climbSpeed * dt;
        if (p.y >= CASTLE.wallHeight) this.popUp(g);
        break;
      }
      case 'rampart': {
        g.timer -= dt;
        if (g.timer <= 0) this.jumpIntoCourtyard(g);
        break;
      }
      case 'intruder': {
        if (g.timer > 0) {
          g.timer -= dt;
          if (g.timer <= 0) this.pickWanderTarget(g);
        } else if (this.moveToward(g, g.target, g.speed * 0.8, dt)) {
          g.timer = GOBLIN_RULES.intruderPause * this.rng.range(0.6, 1.4);
          g.play('idle');
        }
        break;
      }
      case 'falling':
        this.fly(g, dt);
        break;
      case 'dazed': {
        g.timer -= dt;
        if (g.timer < GOBLIN_RULES.dazedTime * 0.5) g.play('idle');
        if (g.timer <= 0) this.carryOn(g);
        break;
      }
      default:
        break;
    }
  }

  /** Walks straight toward a board point. Returns true when there. */
  private moveToward(g: Goblin, target: Vector3, speed: number, dt: number): boolean {
    const p = g.root.position;
    const dx = target.x - p.x;
    const dz = target.z - p.z;
    const d = Math.hypot(dx, dz);
    const step = speed * dt;
    if (d <= step) {
      p.x = target.x;
      p.z = target.z;
      return true;
    }
    p.x += (dx / d) * step;
    p.z += (dz / d) * step;
    g.face(dx, dz);
    return false;
  }

  private headToWall(g: Goblin): void {
    const p = g.root.position;
    const a = angleOf(p.x, p.z);
    const r = g.type === 'climber' ? CASTLE.wallOut + 0.6 : CASTLE.wallOut + CASTLE.wallStandOff;
    g.target.set(polarX(r, a), 0, polarZ(r, a));
    g.mode = 'toWall';
    g.play(g.stats.moveClip, true, g.stats.moveClipSpeed);
  }

  private startAttacking(g: Goblin): void {
    g.mode = 'atWall';
    g.timer = this.rng.range(0.1, 0.8);
    g.faceCenter();
    g.play('idle');
  }

  private startClimbing(g: Goblin): void {
    g.mode = 'climbing';
    g.faceCenter();
    g.play('interact-right', true, 1.4);
  }

  /** The climber pops up on the rampart, in reach, facing the giant. */
  private popUp(g: Goblin): void {
    const p = g.root.position;
    const a = angleOf(p.x, p.z);
    p.set(polarX(CASTLE.rampartRadius, a), CASTLE.wallHeight, polarZ(CASTLE.rampartRadius, a));
    g.mode = 'rampart';
    g.timer = GOBLIN_RULES.rampartWait;
    g.faceCenter();
    g.play('jump', false);
  }

  private jumpIntoCourtyard(g: Goblin): void {
    const p = g.root.position;
    const a = angleOf(p.x, p.z);
    const r = CASTLE.courtyardMax - 1;
    p.x = polarX(r, a);
    p.z = polarZ(r, a);
    g.mode = 'falling';
    g.vx = g.vz = 0;
    g.vy = 45;
    g.landAs = 'intruder';
    g.play('jump', false);
  }

  /**
   * Simple projectile motion: gravity, the ground height under the goblin,
   * one small bounce on a hard landing. No physics engine, just a few lines
   * of math per flying goblin.
   */
  private fly(g: Goblin, dt: number): void {
    const p = g.root.position;
    g.vy -= GOBLIN_RULES.gravity * dt;
    const x = p.x + g.vx * dt;
    const z = p.z + g.vz * dt;
    // Flying into something higher than the goblin (the wall side): stop
    // moving sideways and slide down it instead of popping on top.
    const ahead = landingHeight(Math.hypot(x, z));
    if (ahead !== null && ahead > p.y) {
      g.vx = g.vz = 0;
    } else {
      p.x = x;
      p.z = z;
    }
    p.y += g.vy * dt;
    const ground = landingHeight(Math.hypot(p.x, p.z));
    if (ground === null) {
      // Over the hole or past the edge: falls out of the world.
      if (p.y < -60) this.kill(g);
      return;
    }
    if (p.y > ground || g.vy > 0) return;
    p.y = ground;
    if (-g.vy > GOBLIN_RULES.bounceSpeed) {
      g.vy = -g.vy * GOBLIN_RULES.bounceKeep;
      g.vx *= GOBLIN_RULES.bounceSlide;
      g.vz *= GOBLIN_RULES.bounceSlide;
      this.audio.play('drop', this.worldPosition(g, temp), 1, 0.1);
      return;
    }
    g.vx = g.vy = g.vz = 0;
    this.land(g);
  }

  private land(g: Goblin): void {
    if (g.landAs === 'intruder') {
      this.becomeIntruder(g);
      return;
    }
    g.mode = 'dazed';
    g.timer = GOBLIN_RULES.dazedTime;
    g.play('crouch', false);
    this.audio.play('drop', this.worldPosition(g, temp));
  }

  /** After a drop: carry on from wherever the goblin landed. */
  private carryOn(g: Goblin): void {
    const p = g.root.position;
    switch (zoneAt(Math.hypot(p.x, p.z))) {
      case 'courtyard':
        this.becomeIntruder(g);
        break;
      case 'wallTop':
        g.mode = 'rampart';
        g.timer = GOBLIN_RULES.rampartWait;
        g.faceCenter();
        g.play('idle');
        break;
      case 'field':
        this.headToWall(g);
        break;
      default:
        this.kill(g);
    }
  }

  private becomeIntruder(g: Goblin): void {
    g.mode = 'intruder';
    g.timer = 0.3;
    g.play('idle');
  }

  private pickWanderTarget(g: Goblin): void {
    const p = g.root.position;
    const a = angleOf(p.x, p.z) + this.rng.range(-0.7, 0.7);
    const r = this.rng.range(CASTLE.courtyardMin, CASTLE.courtyardMax);
    g.target.set(polarX(r, a), 0, polarZ(r, a));
    g.play(g.stats.moveClip, true, g.stats.moveClipSpeed);
  }
}
