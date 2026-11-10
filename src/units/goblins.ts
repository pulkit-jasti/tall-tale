// Goblins: spawning, walking the roads, hitting or climbing the wall,
// wandering the courtyard as intruders, and being held, dropped or eaten.
// All positions are in board units (cm) inside the turning board group.
import {
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  Color,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  LoopOnce,
  LoopRepeat,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Vector3,
} from 'three';
import type { GameAudio } from '../audio/sound.js';
import { mark } from '../debug/perfMarks.js';
import { CASTLE, DAY_NIGHT, GOBLIN_GEAR, JUICE, GOBLIN_RULES, GOBLINS, PEPPER, ROADS, STUN, TROOPS, type GearName, type GoblinStats, type GoblinType } from '../config/game.js';
import type { GearDebris } from '../fx/gearDebris.js';
import { addNightRim } from '../fx/nightRim.js';
import { createRandom } from '../rules/random.js';
import { popIn } from '../fx/ease.js';
import { findGearBones, rigTemplate, setGear } from './gear.js';
import { angleOf, clearOfTowers, degToRad, groundAt, landingHeight, polarX, polarZ, towerGap, zoneAt } from '../rules/boardMath.js';
import type { Particles } from '../fx/particles.js';
import type { Random } from '../rules/random.js';
import { applyAimGlow, applyTouchState, type TouchState } from '../player/feedback.js';
import { cloneSkinned, loadTemplate, type ModelTemplate } from '../world/models.js';
import type { Step } from '../rules/roadGraph.js';
import type { Road, RoadNetwork } from '../world/roads.js';

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
  | 'dazed'
  | 'fighting'
  /** Hanging under a balloon (src/units/balloons.ts moves it). */
  | 'riding';

const GRABBABLE: ReadonlySet<GoblinMode> = new Set<GoblinMode>([
  'walking',
  'toWall',
  'atWall',
  'climbing',
  'rampart',
  'intruder',
  'dazed',
  'fighting',
  'riding',
]);

/** Modes a stun freezes (a flying goblin keeps flying, and is still stunned when it lands). */
const STUNNABLE: ReadonlySet<GoblinMode> = new Set<GoblinMode>([
  'walking',
  'toWall',
  'atWall',
  'climbing',
  'rampart',
  'intruder',
  'dazed',
  'fighting',
  'riding',
]);

/** Modes where a goblin is near or in the player's hands (never part of a stalemate). */
const IN_REACH: ReadonlySet<GoblinMode> = new Set<GoblinMode>(['toWall', 'atWall', 'climbing', 'rampart', 'intruder', 'held']);

const tint = new Color();
/** Sparks when a helmet is knocked off. */
const HELMET_SPARKS = [0xffffff, 0xd8dbe6, 0xffd84a];
const KO_COLORS = [0xffffff, 0xddd6c8, 0xb8b0a0];

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
  /** The graph road being walked and which way (see RoadGraph.next). */
  readonly step: Step = { road: -1, dir: 1 };
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
  /** How it lands after a fall: dazed, as an intruder (dropped in by a balloon), or knocked out (its balloon popped). */
  landAs: 'dazed' | 'intruder' | 'ko' = 'dazed';
  /** How long this goblin waits on the rampart before jumping in (seconds). Longer for a tutorial climber. */
  rampartWait: number = GOBLIN_RULES.rampartWait;
  attackRight = true;
  /** Peppered: gives more food when eaten. Shown with a dusty tint. */
  seasoned = false;
  touch: TouchState = 'idle';
  readonly target = new Vector3();
  hasTarget = false;
  /** Stunned by the megaphone or the bell: frozen and dizzy for this long (seconds). */
  stunned = 0;
  /** Fighting a soldier (src/units/troops.ts): the soldier, the mode to go back to after, and the strike timer. */
  foe: object | null = null;
  resumeMode: GoblinMode = 'walking';
  strikeTimer = 0;
  /** Animation time not played yet (far goblins update their animation every other frame). */
  animDt = 0;
  /** A road this goblin must take at the end of the one it walks (the trigger lesson group), or -1 to pick freely. */
  nextRoad = -1;
  /**
   * The trigger lessons: the goblin stops at this spot (graph road, cm along
   * it) and waits there until it is released, so the player can take their
   * time. -1 walks on as usual.
   */
  waitRoad = -1;
  waitAt = 0;
  waiting = false;
  /** Lesson bait: the slingshot shoots past it (no aim bend, no hit), so shots reach the trigger behind it. */
  bait = false;
  /**
   * The slingshot lesson: walks back and forth on this graph road between
   * two spots (cm along it), a moving target, until released. -1: off.
   */
  patrolRoad = -1;
  patrolFrom = 0;
  patrolTo = 0;
  /** Stays still on the rampart (a lesson goblin), instead of running about, and never jumps in until released. */
  calm = false;
  /** Peppered: time to its next sneeze, and the sneeze's head jerk left (seconds). */
  sneezeIn = 0;
  sneezing = 0;
  /** Seconds of sneezing left after the pepper (PEPPER.sneezeFor). Harmless while above 0. */
  sneezeLeft = 0;
  /** Running about on the rampart: pause left before the next dash (seconds), the board angle it runs to, and the wall mark timer. */
  dashPause = 0;
  dashTo = 0;
  markTimer = 0;
  /** Gear (build step 7): its gear bones, and what it carries now. A helmet is one extra hit. */
  readonly gear: Map<GearName, Object3D>;
  helmet = false;
  armed = false;
  /** A hit flash is showing for this long (seconds). */
  flashTime = 0;
  /** Juice: time left of the landing squash, of the pop-in from its camp, and to its next dust puff (seconds). */
  squash = 0;
  popTime = 0;
  dustTimer = 0;
  /** Changes each time this pooled goblin is spawned again, so an arrow in flight knows it is still the same one. */
  serial = 0;

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
    // A bright green edge at night, so it stands out from the ground.
    addNightRim(material, DAY_NIGHT.rimGoblin);
    this.materials.push(material);
    this.body.add(model);
    this.root.add(this.body);
    this.root.visible = false;
    this.mixer = new AnimationMixer(model);
    this.gear = findGearBones(model);
  }

  /** Shows its spear and helmet (or not). */
  setGear(armed: boolean, helmet: boolean): void {
    this.armed = armed;
    this.helmet = helmet;
    setGear(this.gear, 'goblinSpear', armed);
    setGear(this.gear, 'goblinHelmet', helmet);
  }

  setType(type: GoblinType): void {
    this.type = type;
    this.stats = GOBLINS[type];
    this.body.scale.setScalar(this.stats.height);
    this.applyColor();
  }

  /** Model color times the type tint, and the seasoned tint when peppered. */
  applyColor(): void {
    const [r, g, b] = this.stats.tint;
    const color = this.materials[0].color.copy(this.baseColor).multiply(tint.setRGB(r, g, b));
    if (this.seasoned) color.multiply(tint.setRGB(...PEPPER.seasonedTint));
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
const temp3 = new Vector3();
const starMatrix = new Matrix4();
const hiddenMatrix = new Matrix4().makeScale(0, 0, 0);
/** Goblins that show dizzy stars at once (2 stars each). */
const STAR_SLOTS = 40;
/** Peppered goblins that show pepper flakes at once. */
const SPECK_SLOTS = 30;

export class Goblins {
  readonly list: Goblin[] = [];
  /** Most goblins at once. The debug stress test can raise it. */
  cap = GOBLIN_RULES.maxGoblins;
  /** The goblin the slingshot is about to hit (glows while aiming). */
  private aimed: Goblin | null = null;
  private template!: ModelTemplate;
  private baseColor = new Color(1, 1, 1);
  private camps: number[];
  private stars!: InstancedMesh;
  /** Pepper flakes over peppered goblins (one instanced mesh, like the stars). */
  private specks!: InstancedMesh;
  /** For the sneeze puffs (set by the game). */
  particles: Particles | null = null;
  private time = 0;
  private frame = 0;

  /** Gear that flies off (set by the game). */
  debris: GearDebris | null = null;
  /** Helmets are handed out from GOBLIN_GEAR.helmetFromWave (set by the battle per wave). */
  helmetsOn = false;
  /** Debug: this many next grunts wear a helmet whatever the wave. */
  helmetNext = 0;
  /** Gear is picked with its own seeded random, so the battle's spawns stay as they were. */
  private gearRng = createRandom(0x9e3779b1);

  /** Called on each wall hit from a grunt or runner (castle damage). */
  onWallHit: (goblin: Goblin) => void = () => {};
  /** A goblin knocked out by a hit (tool, trigger, soldier, fall), with the world position of its middle (juice). */
  onKnockOut: (goblin: Goblin, world: Vector3) => void = () => {};
  /** A helmet took a hit and flew off, at this world point (juice). */
  onArmor: (goblin: Goblin, world: Vector3) => void = () => {};
  /** Called now and then while a climber runs about on the rampart (a wall flash, no damage). */
  onRampartStep: (goblin: Goblin) => void = () => {};

  constructor(
    private board: Object3D,
    private network: RoadNetwork,
    private rng: Random,
    private audio: GameAudio,
  ) {
    this.camps = network.graph.camps;
    this.stars = new InstancedMesh(
      new IcosahedronGeometry(STUN.starSize / 2, 0),
      new MeshBasicMaterial({ color: STUN.starColor }),
      STAR_SLOTS * 2,
    );
    this.stars.frustumCulled = false;
    for (let i = 0; i < STAR_SLOTS * 2; i++) this.stars.setMatrixAt(i, hiddenMatrix);
    this.stars.visible = false;
    board.add(this.stars);
    this.specks = new InstancedMesh(
      new IcosahedronGeometry(PEPPER.flakeSize / 2, 0),
      new MeshBasicMaterial({ color: PEPPER.flakeColor }),
      SPECK_SLOTS * PEPPER.flakeCount,
    );
    this.specks.frustumCulled = false;
    for (let i = 0; i < SPECK_SLOTS * PEPPER.flakeCount; i++) this.specks.setMatrixAt(i, hiddenMatrix);
    this.specks.visible = false;
    board.add(this.specks);
  }

  async load(): Promise<void> {
    this.template = await loadTemplate('characters/mini-dungeon/character-orc.glb', { height: 1 }, true);
    // Every goblin carries every gear option, each shown or hidden on its own (src/units/gear.ts).
    await rigTemplate(this.template, ['goblinSpear', 'goblinHelmet']);
    const material = findMaterial(this.template.object);
    if (material) this.baseColor.copy(material.color);
  }

  /** Character model units to board cm for a grunt (gear sizes, src/fx/gearDebris.ts). */
  get unitScale(): number {
    return GOBLINS.grunt.height * (this.template.object.children[0]?.scale.x ?? 1);
  }

  get aliveCount(): number {
    let count = 0;
    for (const g of this.list) if (g.mode !== 'dead') count++;
    return count;
  }

  /** How far the goblin nearest the castle is from the center (cm), Infinity when there is none. */
  closestRadius(): number {
    let best = Infinity;
    for (const g of this.list) {
      if (g.mode === 'dead') continue;
      const p = g.root.position;
      best = Math.min(best, Math.hypot(p.x, p.z));
    }
    return best;
  }

  /**
   * True if any goblin is at or on the wall, in the courtyard, or held (by a
   * hand or in the slingshot): ones the player can still deal with.
   */
  anyInReach(): boolean {
    for (const g of this.list) if (IN_REACH.has(g.mode)) return true;
    return false;
  }

  /** Goblins in one mode right now (for example intruders, for castle damage). `awake`: stunned and sneezing ones are left out. */
  countMode(mode: GoblinMode, awake = false): number {
    let count = 0;
    for (const g of this.list) if (g.mode === mode && !(awake && (g.stunned > 0 || g.sneezeLeft > 0))) count++;
    return count;
  }

  /**
   * The megaphone or the bell: every goblin on the board is stunned for at
   * least `seconds` (a longer stun already running is kept). Returns how many.
   */
  stunAll(seconds: number): number {
    let count = 0;
    for (const g of this.list) {
      if (!this.isHittable(g)) continue;
      if (g.stunned <= 0 && STUNNABLE.has(g.mode)) g.play('emote-no', true, 1.2);
      g.stunned = Math.max(g.stunned, seconds);
      count++;
    }
    return count;
  }

  /** A soldier engages this goblin: it stops and fights back (src/units/troops.ts). */
  startFight(g: Goblin, foe: object): void {
    if (g.mode !== 'fighting') {
      g.resumeMode = g.mode;
      g.mode = 'fighting';
      g.strikeTimer = this.rng.range(0.2, 0.8);
      if (g.stunned <= 0) g.play('idle');
    }
    g.foe = foe;
  }

  /** The fight is over (the soldier is down or gone): the goblin carries on. */
  endFight(g: Goblin): void {
    g.foe = null;
    if (g.mode !== 'fighting') return;
    g.mode = g.resumeMode;
    if (g.stunned <= 0) this.playModeClip(g);
  }

  /** A goblin strikes at a soldier: the attack animation (alternating arms). */
  strike(g: Goblin): void {
    g.attackRight = !g.attackRight;
    g.play(g.attackRight ? 'attack-melee-right' : 'attack-melee-left', false);
  }

  /** The animation for what the goblin is doing now (after a stun or a fight). */
  private playModeClip(g: Goblin): void {
    switch (g.mode) {
      case 'walking':
      case 'toWall':
        g.play(g.stats.moveClip, true, g.stats.moveClipSpeed);
        break;
      case 'climbing':
        g.play('interact-right', true, 1.4);
        break;
      case 'riding':
        g.play('idle');
        break;
      default:
        g.play('idle');
    }
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
    goblin.serial++;
    goblin.seasoned = false;
    goblin.setType(type);
    // Runners and climbers need their hands. Some grunts carry a spear, some wear a helmet.
    const grunt = type === 'grunt';
    const helmet = grunt && ((this.helmetsOn && this.gearRng.next() < GOBLIN_GEAR.helmetShare) || this.helmetNext > 0);
    if (helmet && this.helmetNext > 0) this.helmetNext--;
    goblin.setGear(grunt && this.gearRng.next() < GOBLIN_GEAR.spearShare, helmet);
    goblin.speed = goblin.stats.speed * (1 + this.rng.range(-GOBLIN_RULES.speedJitter, GOBLIN_RULES.speedJitter));
    goblin.root.visible = true;
    goblin.root.rotation.set(0, 0, 0);
    goblin.hasTarget = false;
    goblin.stunned = 0;
    goblin.foe = null;
    goblin.animDt = 0;
    goblin.flashTime = 0;
    goblin.squash = 0;
    goblin.popTime = 0;
    goblin.rampartWait = GOBLIN_RULES.rampartWait;
    goblin.nextRoad = -1;
    goblin.waitRoad = -1;
    goblin.waiting = false;
    goblin.bait = false;
    goblin.patrolRoad = -1;
    goblin.calm = false;
    goblin.sneezing = 0;
    goblin.sneezeLeft = 0;
    goblin.dashPause = 0;
    goblin.root.scale.setScalar(1);
    goblin.body.rotation.x = 0;
    this.setTouch(goblin, 'idle');
    return goblin;
  }

  /** Spawns a goblin at a camp (graph node index). It picks its roads as it goes. Returns null at the unit cap. */
  spawnAtCamp(type: GoblinType, camp: number): Goblin | null {
    const step = this.network.graph.next(camp, this.rng);
    if (!step) return null;
    const goblin = this.obtain(type);
    if (!goblin) return null;
    goblin.mode = 'walking';
    goblin.offset = this.rng.range(-ROADS.laneJitter, ROADS.laneJitter);
    this.setRoad(goblin, step);
    // It pops out of the camp with a little elastic bounce.
    goblin.popTime = JUICE.spawnPopTime;
    goblin.root.scale.setScalar(0.01);
    goblin.play(goblin.stats.moveClip, true, goblin.stats.moveClipSpeed);
    return goblin;
  }

  /**
   * Spawns a goblin walking along a road (graph road index, `dir` as in
   * Step) so that it is `before` cm short of the spot `along` (cm along that
   * road). When the road is too short, it starts on the road before it and
   * is sent onto this one. The trigger lesson uses it to walk a group past a
   * keg. Returns null at the unit cap.
   */
  spawnBefore(type: GoblinType, road: number, dir: 1 | -1, along: number, before: number, offset = 0): Goblin | null {
    const graph = this.network.graph;
    const roads = this.network.roads;
    const room = dir === 1 ? along : roads[road].length - along;
    let step: Step = { road, dir };
    let distance = along - dir * Math.min(before, room);
    let next = -1;
    if (room < before) {
      // The road that leads into this one from farther away.
      const start = dir === 1 ? graph.roads[road].from : graph.roads[road].to;
      let best = -1;
      for (const r of graph.nodes[start].roads) {
        if (r === road) continue;
        const far = graph.nodes[graph.other(r, start)].toCastle;
        if (best < 0 || far > graph.nodes[graph.other(best, start)].toCastle) best = r;
      }
      if (best >= 0) {
        const into: 1 | -1 = graph.roads[best].to === start ? 1 : -1;
        const left = Math.min(roads[best].length, before - room);
        step = { road: best, dir: into };
        distance = into === 1 ? roads[best].length - left : left;
        next = road;
      }
    }
    const goblin = this.obtain(type);
    if (!goblin) return null;
    goblin.mode = 'walking';
    goblin.offset = offset;
    this.setRoad(goblin, step);
    goblin.distance = distance;
    goblin.road!.pointAt(distance, offset * step.dir, goblin.root.position);
    goblin.nextRoad = next;
    goblin.play(goblin.stats.moveClip, true, goblin.stats.moveClipSpeed);
    return goblin;
  }

  /** A balloon rider (src/units/balloons.ts stands it in its basket every frame). Null at the unit cap. */
  spawnRider(): Goblin | null {
    const goblin = this.obtain('grunt');
    if (!goblin) return null;
    goblin.mode = 'riding';
    // Standing in the basket, looking out over the rim.
    goblin.play('idle');
    return goblin;
  }

  /** A rider lets go over the courtyard: it drops in and becomes an intruder. */
  dropRider(goblin: Goblin): void {
    if (goblin.mode !== 'riding') return;
    goblin.vx = goblin.vz = 0;
    goblin.vy = 10;
    goblin.mode = 'falling';
    goblin.landAs = 'intruder';
    goblin.play('fall', true, 1.2);
  }

  /** Its balloon popped: the rider falls (drifting on a little) and poofs where it lands. */
  fallRider(goblin: Goblin, vx: number, vz: number): void {
    if (goblin.mode !== 'riding') return;
    goblin.vx = vx;
    goblin.vz = vz;
    goblin.vy = 25;
    goblin.mode = 'falling';
    goblin.landAs = 'ko';
    goblin.play('fall', true, 1.8);
    this.audio.play('squeal', this.worldPosition(goblin, temp), 1, 0.1);
  }

  /** Lets every waiting lesson goblin walk on (the trigger was set off, or the lesson ended). */
  releaseWaiting(): void {
    for (const g of this.list) {
      if (g.waitRoad < 0 && !g.bait) continue;
      g.waitRoad = -1;
      g.bait = false;
      if (g.waiting) {
        g.waiting = false;
        if (g.mode === 'walking') g.play(g.stats.moveClip, true, g.stats.moveClipSpeed);
      }
    }
  }

  /** Debug spawning: the camp by its place in the blueprint's camp list. */
  spawnOnRoad(type: GoblinType, campIndex: number): Goblin | null {
    return this.spawnAtCamp(type, this.camps[campIndex % this.camps.length]);
  }

  /**
   * Spawns a climber at the wall at a board angle (radians), climbing, or
   * already up on the rampart (`onRampart`, in reach right away).
   */
  spawnClimberAt(angle: number, onRampart = false, rampartWait: number = GOBLIN_RULES.rampartWait): Goblin | null {
    const goblin = this.obtain('climber');
    if (!goblin) return null;
    goblin.rampartWait = rampartWait;
    angle = clearOfTowers(angle);
    const r = CASTLE.wallOut + 0.6;
    goblin.root.position.set(polarX(r, angle), 0, polarZ(r, angle));
    if (onRampart) this.popUp(goblin);
    else this.startClimbing(goblin);
    return goblin;
  }

  /** A road was closed (a fallen tree): goblins on it turn back to the point they came from. */
  turnBack(road: number): void {
    for (const g of this.list) {
      if (g.mode !== 'walking' || g.step.road !== road) continue;
      g.step.dir = g.step.dir === 1 ? -1 : 1;
    }
  }

  private setRoad(g: Goblin, step: Step): void {
    g.step.road = step.road;
    g.step.dir = step.dir;
    g.road = this.network.roads[step.road];
    g.distance = step.dir === 1 ? 0 : g.road.length;
    g.road.pointAt(g.distance, g.offset * step.dir, g.root.position);
  }

  /** At the end of a road: a wall entry leads to the wall, a junction to the next road. */
  private arrive(g: Goblin): void {
    const graph = this.network.graph;
    const node = graph.endOf(g.step);
    // A goblin sent onto a road takes it if it is open and starts here.
    const forced = g.nextRoad;
    g.nextRoad = -1;
    if (forced >= 0 && graph.roads[forced].open && graph.nodes[node].roads.includes(forced)) {
      this.setRoad(g, { road: forced, dir: graph.roads[forced].from === node ? 1 : -1 });
      return;
    }
    const next = graph.isWall(node) ? null : graph.next(node, this.rng);
    if (next) this.setRoad(g, next);
    else this.headToWall(g);
  }

  /**
   * A hit that would knock the goblin out (a slingshot pebble, a soldier).
   * With a helmet on, the helmet flies off instead and the goblin is knocked
   * back, dazed: returns true (it took the hit). Without one, false: the
   * caller knocks it out.
   */
  armor(goblin: Goblin, fromX = 0, fromZ = 0): boolean {
    if (!goblin.helmet || !this.isHittable(goblin)) return false;
    goblin.helmet = false;
    setGear(goblin.gear, 'goblinHelmet', false);
    const p = goblin.root.position;
    let dx = p.x - fromX;
    let dz = p.z - fromZ;
    if (fromX === 0 && fromZ === 0) {
      dx = p.x;
      dz = p.z;
    }
    temp2.set(p.x, p.y + goblin.stats.height * 0.95, p.z);
    this.debris?.throw('goblinHelmet', temp2, dx, dz);
    this.particles?.burst(this.board.localToWorld(temp2), HELMET_SPARKS, 6, 0.2);
    this.audio.play('pebbleHit', temp2, 0.8, 0.05);
    this.onArmor(goblin, temp2);
    this.flash(goblin);
    // A grounded goblin hops back, dazed. One in the air or on the wall just reels.
    if (goblin.mode === 'walking' || goblin.mode === 'toWall' || goblin.mode === 'atWall' || goblin.mode === 'fighting' || goblin.mode === 'dazed') {
      if (goblin.mode === 'fighting') this.endFight(goblin);
      this.knockBack(goblin, dx, dz);
    }
    return true;
  }

  /** Its gear flies off as it poofs (knocked out by a tool, a trigger or a soldier). */
  private scatterGear(goblin: Goblin): void {
    if (!this.debris || !goblin.root.visible) return;
    const p = goblin.root.position;
    if (goblin.armed) {
      temp2.set(p.x, p.y + goblin.stats.height * 0.5, p.z);
      this.debris.throw('goblinSpear', temp2, p.x, p.z);
    }
    if (goblin.helmet) {
      temp2.set(p.x, p.y + goblin.stats.height * 0.95, p.z);
      this.debris.throw('goblinHelmet', temp2, -p.z, p.x);
    }
  }

  /** A short bright flash on a goblin that was hit (juice), back to its touch state after. */
  flash(goblin: Goblin): void {
    goblin.flashTime = JUICE.hitFlashTime;
    for (const m of goblin.materials) {
      m.emissive.setHex(JUICE.hitFlashColor);
      m.emissiveIntensity = JUICE.hitFlashIntensity;
    }
  }

  /** Out of the game at once. Goblins keep their poof of particles (made by the caller), no shrink. `scatter`: its gear flies off. */
  kill(goblin: Goblin, scatter = false): void {
    if (scatter && goblin.root.visible) {
      this.scatterGear(goblin);
      this.onKnockOut(goblin, this.centerWorld(goblin, temp3));
    }
    if (this.aimed === goblin) this.setAimed(null);
    goblin.mode = 'dead';
    goblin.root.visible = false;
    goblin.road = null;
    goblin.stunned = 0;
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
    goblin.stunned = 0;
    goblin.foe = null;
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

  /** Lets go anywhere but the mouth: the goblin flies with the hand's speed, then lands. Returns that speed (cm per second). */
  drop(goblin: Goblin): number {
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
    return Math.min(speed, GOBLIN_RULES.maxThrowSpeed);
  }

  /**
   * Bonked by a thrown pebble or a goblin shot splash: a short hop along
   * (dx, dz), then dazed. No damage. A climber is knocked off the wall.
   */
  knockBack(goblin: Goblin, dx: number, dz: number): void {
    if (!this.isHittable(goblin)) return;
    const d = Math.hypot(dx, dz) || 1;
    goblin.vx = (dx / d) * GOBLIN_RULES.knockSpeed;
    goblin.vz = (dz / d) * GOBLIN_RULES.knockSpeed;
    goblin.vy = GOBLIN_RULES.knockHop;
    goblin.mode = 'falling';
    goblin.landAs = 'dazed';
    goblin.play('fall', true, 1);
    this.audio.play('squeal', this.worldPosition(goblin, temp), 1, 0.1);
    this.flash(goblin);
  }

  /**
   * Peppered (docs/giant-tools.md): it sneezes and is seasoned, worth more
   * food when eaten. A goblin outside the wall stumbles back a little, one on
   * the wall or in the courtyard sneezes where it stands. A climber keeps
   * climbing. Returns false if it was seasoned already or cannot be peppered.
   */
  pepper(goblin: Goblin): boolean {
    if (!this.isHittable(goblin) || goblin.seasoned) return false;
    goblin.seasoned = true;
    goblin.sneezeLeft = PEPPER.sneezeFor;
    this.flash(goblin);
    // It sneezes now (below), and again and again after that (see sneeze()).
    goblin.sneezeIn = this.rng.range(PEPPER.sneezeEvery[0], PEPPER.sneezeEvery[1]);
    goblin.sneezing = PEPPER.sneezeJerkTime;
    goblin.applyColor();
    this.audio.play('sneeze', this.worldPosition(goblin, temp), 1, 0.12);
    // The sneeze shakes its spear loose: it flies off.
    if (goblin.armed) {
      goblin.armed = false;
      setGear(goblin.gear, 'goblinSpear', false);
      const p = goblin.root.position;
      temp2.set(p.x, p.y + goblin.stats.height * 0.5, p.z);
      this.debris?.throw('goblinSpear', temp2, p.x, p.z);
    }
    switch (goblin.mode) {
      case 'walking':
      case 'toWall':
      case 'atWall': {
        // Back away from the castle: outward from the board center.
        const p = goblin.root.position;
        const d = Math.hypot(p.x, p.z) || 1;
        goblin.vx = (p.x / d) * PEPPER.stumbleSpeed;
        goblin.vz = (p.z / d) * PEPPER.stumbleSpeed;
        goblin.vy = PEPPER.stumbleHop;
        goblin.mode = 'falling';
        goblin.landAs = 'dazed';
        goblin.play('emote-no', false);
        break;
      }
      case 'rampart':
      case 'intruder':
      case 'dazed':
        goblin.mode = 'dazed';
        goblin.timer = PEPPER.sneezeTime;
        goblin.play('emote-no', false);
        break;
      default:
        break;
    }
    return true;
  }

  update(dt: number): void {
    this.time += dt;
    this.frame++;
    let star = 0;
    const far2 = TROOPS.farAnimFrom * TROOPS.farAnimFrom;
    let speck = 0;
    for (let i = 0; i < this.list.length; i++) {
      const g = this.list[i];
      if (g.mode === 'dead') continue;
      this.step(g, dt);
      if (g.flashTime > 0) {
        g.flashTime -= dt;
        if (g.flashTime <= 0) this.applyLook(g);
      }
      if (g.popTime > 0 || g.squash > 0 || g.type === 'runner') this.juice(g, dt);
      // Sneezing (and harmless) for a while after the pepper, then it stops, still seasoned.
      if (g.sneezeLeft > 0) {
        g.sneezeLeft -= dt;
        if (g.sneezeLeft > 0) {
          this.sneeze(g, dt);
          if (speck < SPECK_SLOTS) this.placeSpecks(g, speck++);
        } else {
          g.sneezing = 0;
          g.body.rotation.x = 0;
        }
      }
      // Far goblins play their animation every other frame (half the cost, hard to see that far).
      g.animDt += dt;
      const p = g.root.position;
      if (p.x * p.x + p.z * p.z < far2 || (this.frame + i) % 2 === 0) {
        g.mixer.update(g.animDt);
        g.animDt = 0;
      }
      if (g.stunned > 0 && (g.mode as GoblinMode) !== 'dead' && star < STAR_SLOTS) this.placeStars(g, star++);
    }
    for (let i = star; i < STAR_SLOTS; i++) {
      this.stars.setMatrixAt(i * 2, hiddenMatrix);
      this.stars.setMatrixAt(i * 2 + 1, hiddenMatrix);
    }
    this.stars.visible = star > 0;
    if (star > 0 || this.starsShown) this.stars.instanceMatrix.needsUpdate = true;
    this.starsShown = star > 0;
    for (let i = speck * PEPPER.flakeCount; i < SPECK_SLOTS * PEPPER.flakeCount; i++) this.specks.setMatrixAt(i, hiddenMatrix);
    this.specks.visible = speck > 0;
    if (speck > 0 || this.specksShown) this.specks.instanceMatrix.needsUpdate = true;
    this.specksShown = speck > 0;
  }

  private specksShown = false;

  /** Juice: the pop-in from the camp, the squash on landing, and dust behind runners. */
  private juice(g: Goblin, dt: number): void {
    if (g.popTime > 0) {
      g.popTime = Math.max(0, g.popTime - dt);
      g.root.scale.setScalar(Math.max(0.01, popIn(1 - g.popTime / JUICE.spawnPopTime)));
    }
    if (g.squash > 0) {
      g.squash = Math.max(0, g.squash - dt);
      const t = 1 - g.squash / JUICE.squashTime;
      // Flat first, then a little stretch up, then back: a cartoon landing.
      const a = JUICE.squashAmount * Math.sin(t * Math.PI * 2) * (1 - t);
      const h = g.stats.height;
      g.body.scale.set(h * (1 + a * 0.5), h * (1 - a), h * (1 + a * 0.5));
    }
    if (g.type === 'runner' && (g.mode === 'walking' || g.mode === 'toWall') && g.stunned <= 0 && this.particles) {
      g.dustTimer -= dt;
      const p = g.root.position;
      if (g.dustTimer <= 0 && p.x * p.x + p.z * p.z < JUICE.runnerDustNear * JUICE.runnerDustNear) {
        g.dustTimer = JUICE.runnerDustEvery * this.gearRng.range(0.7, 1.3);
        this.particles.burst(this.board.localToWorld(temp.copy(p)), JUICE.dustColors, 1, 0.05);
      }
    }
  }

  /**
   * Peppered goblins sneeze now and then, like an old cartoon: the head
   * jerks forward, a little puff of pepper flies out in front of the face,
   * and a sneeze sound. Pepper flakes circle over the head meanwhile (placeSpecks).
   */
  private sneeze(g: Goblin, dt: number): void {
    if (g.sneezing > 0) {
      g.sneezing = Math.max(0, g.sneezing - dt);
      const t = 1 - g.sneezing / PEPPER.sneezeJerkTime;
      // A quick wind-up back, then a snap forward and back to upright.
      g.body.rotation.x = Math.sin(t * Math.PI * 2) * -0.25 + Math.sin(t * Math.PI) * 0.45;
      if (g.sneezing <= 0) g.body.rotation.x = 0;
    }
    g.sneezeIn -= dt;
    if (g.sneezeIn > 0) return;
    g.sneezeIn = this.rng.range(PEPPER.sneezeEvery[0], PEPPER.sneezeEvery[1]);
    g.sneezing = PEPPER.sneezeJerkTime;
    // The puff, in front of the face (board space to world).
    const p = g.root.position;
    temp.set(0, g.stats.height * 0.8, g.stats.height * 0.45).applyQuaternion(g.root.quaternion).add(p);
    this.board.localToWorld(temp);
    this.particles?.burst(temp, PEPPER.sneezeColors, 5, 0.08);
    this.audio.play('sneeze', temp, 0.7, 0.25);
  }

  /** Pepper flakes circling over a peppered goblin's head (like the dizzy stars). */
  private placeSpecks(g: Goblin, slot: number): void {
    const p = g.root.position;
    const top = p.y + g.stats.height * 1.08;
    const n = PEPPER.flakeCount;
    for (let k = 0; k < n; k++) {
      const a = -this.time * PEPPER.flakeSpeed + (k * Math.PI * 2) / n + slot;
      const bob = Math.sin(this.time * 5 + k * 2) * 0.25;
      starMatrix.makeRotationY(a * 2).setPosition(p.x + Math.cos(a) * PEPPER.flakeOrbit, top + bob, p.z + Math.sin(a) * PEPPER.flakeOrbit);
      this.specks.setMatrixAt(slot * n + k, starMatrix);
    }
  }

  private starsShown = false;

  /** Two dizzy stars circling over a stunned goblin's head. */
  private placeStars(g: Goblin, slot: number): void {
    const p = g.root.position;
    const top = p.y + g.stats.height * 1.15;
    for (let k = 0; k < 2; k++) {
      const a = this.time * STUN.starSpeed + k * Math.PI + slot;
      starMatrix.makeRotationY(a).setPosition(p.x + Math.cos(a) * STUN.starOrbit, top, p.z + Math.sin(a) * STUN.starOrbit);
      this.stars.setMatrixAt(slot * 2 + k, starMatrix);
    }
  }

  private step(g: Goblin, dt: number): void {
    const p = g.root.position;
    if (g.stunned > 0) {
      g.stunned -= dt;
      if (STUNNABLE.has(g.mode)) {
        if (g.stunned <= 0) this.playModeClip(g);
        return;
      }
    }
    switch (g.mode) {
      case 'walking': {
        const road = g.road!;
        const dir = g.step.dir;
        // A lesson goblin stops at its spot and waits there until released.
        if (g.waitRoad === g.step.road) {
          const next = g.distance + g.speed * dt * dir;
          if (dir === 1 ? next >= g.waitAt : next <= g.waitAt) {
            g.distance = g.waitAt;
            road.pointAt(g.distance, g.offset * dir, p);
            if (!g.waiting) {
              g.waiting = true;
              g.play('idle');
            }
            break;
          }
        }
        g.distance += g.speed * dt * dir;
        // A patrolling lesson goblin turns round at the ends of its stretch.
        if (g.patrolRoad === g.step.road) {
          if (dir === 1 && g.distance > g.patrolTo) g.step.dir = -1;
          else if (dir === -1 && g.distance < g.patrolFrom) g.step.dir = 1;
        }
        // The lane offset flips with the direction, so a goblin keeps its side of the road.
        road.pointAt(g.distance, g.offset * dir, p);
        road.directionAt(g.distance, temp);
        g.face(temp.x * dir, temp.z * dir);
        if (dir === 1 ? g.distance >= road.length : g.distance <= 0) this.arrive(g);
        break;
      }
      case 'toWall': {
        if (this.moveToward(g, g.target, g.speed, dt)) {
          if (g.type === 'climber') this.startClimbing(g);
          else this.startAttacking(g);
        }
        // Off the road (after a toss): it walks over the bumps.
        p.y = groundAt(p.x, p.z);
        break;
      }
      case 'atWall': {
        // A sneezing goblin is too busy to hit the wall.
        if (g.sneezeLeft > 0) break;
        g.timer -= dt;
        if (g.timer <= 0) {
          g.timer = GOBLIN_RULES.wallHitInterval * this.rng.range(0.85, 1.15);
          g.attackRight = !g.attackRight;
          g.play(g.attackRight ? 'attack-melee-right' : 'attack-melee-left', false);
          this.audio.play('wallHit', this.worldPosition(g, temp), 1, GOBLIN_RULES.wallHitSoundGap);
          this.onWallHit(g);
        }
        break;
      }
      case 'climbing': {
        p.y += GOBLIN_RULES.climbSpeed * dt;
        if (p.y >= CASTLE.wallHeight) this.popUp(g);
        break;
      }
      case 'rampart': {
        // A calm one (a lesson goblin) waits still and never jumps in until released.
        if (g.calm) break;
        g.timer -= dt;
        if (g.timer <= 0) {
          this.jumpIntoCourtyard(g);
          break;
        }
        // A tutorial climber with a long wait stands still to be picked up. The others run about.
        if (g.rampartWait <= GOBLIN_RULES.rampartWait) this.runOnRampart(g, dt);
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
    // Climbers climb between towers, never up the side of one.
    const a = g.type === 'climber' ? clearOfTowers(angleOf(p.x, p.z)) : angleOf(p.x, p.z);
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
  /**
   * Climbers on the rampart run about, causing chaos: short dashes back and
   * forth along the wall top between the two towers, with quick stops, until
   * they jump into the courtyard.
   */
  private runOnRampart(g: Goblin, dt: number): void {
    const p = g.root.position;
    const at = angleOf(p.x, p.z);
    // Whatever stretch of wall it stands or runs on flashes red, like a wall hit (no damage).
    g.markTimer -= dt;
    if (g.markTimer <= 0) {
      g.markTimer = GOBLIN_RULES.rampartMarkEvery;
      this.onRampartStep(g);
    }
    if (g.dashPause > 0) {
      g.dashPause -= dt;
      if (g.dashPause <= 0) {
        // The next dash: somewhere else along the wall top, between the same two towers.
        const [lo, hi] = towerGap(at);
        const a = at + degToRad(this.rng.range(-GOBLIN_RULES.rampartDashDeg, GOBLIN_RULES.rampartDashDeg));
        g.dashTo = Math.min(hi, Math.max(lo, a));
        g.hasTarget = true;
        g.play('sprint', true, 1.4);
      }
      return;
    }
    if (!g.hasTarget) {
      g.dashPause = this.rng.range(...GOBLIN_RULES.rampartStop);
      return;
    }
    // Along the wall's own curve, never across it: always right on the rampart.
    const step = ((g.speed * GOBLIN_RULES.rampartRunShare) / CASTLE.rampartRadius) * dt;
    // The short way round (angles wrap at the back of the board).
    let d = g.dashTo - at;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const arrived = Math.abs(d) <= step;
    const next = arrived ? at + d : at + Math.sign(d) * step;
    p.set(polarX(CASTLE.rampartRadius, next), CASTLE.wallHeight, polarZ(CASTLE.rampartRadius, next));
    // Facing along the wall, the way it runs.
    const s = Math.sign(d) || 1;
    g.face(Math.cos(next) * s, Math.sin(next) * s);
    if (arrived) {
      g.hasTarget = false;
      g.dashPause = this.rng.range(...GOBLIN_RULES.rampartStop);
      g.play('idle');
      g.faceCenter();
    }
  }

  /** Lets lesson goblins on the rampart and patrolling ones go on as usual. */
  releaseLesson(): void {
    for (const g of this.list) {
      if (g.calm) {
        g.calm = false;
        g.rampartWait = GOBLIN_RULES.rampartWait;
        if (g.mode === 'rampart') g.timer = GOBLIN_RULES.rampartWait;
      }
      g.patrolRoad = -1;
    }
  }

  private popUp(g: Goblin): void {
    const p = g.root.position;
    const a = angleOf(p.x, p.z);
    p.set(polarX(CASTLE.rampartRadius, a), CASTLE.wallHeight, polarZ(CASTLE.rampartRadius, a));
    g.mode = 'rampart';
    g.timer = g.rampartWait;
    g.hasTarget = false;
    // A breath after the jump up, then it starts running about.
    g.dashPause = GOBLIN_RULES.rampartStop[1];
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
    const ahead = landingHeight(x, z);
    if (ahead !== null && ahead > p.y) {
      g.vx = g.vz = 0;
    } else {
      p.x = x;
      p.z = z;
    }
    p.y += g.vy * dt;
    const ground = landingHeight(p.x, p.z);
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
    g.squash = JUICE.squashTime;
    if (g.landAs === 'ko') {
      // From a popped balloon: knocked out with a poof (and a little hop of dust).
      this.worldPosition(g, temp);
      temp.y += g.stats.height * 0.004;
      this.particles?.burst(temp, KO_COLORS, 10);
      this.audio.play('poof', temp, 1, 0.05);
      this.kill(g, true);
      return;
    }
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
        g.timer = g.rampartWait;
        // A fresh dash target on the wall, never an old one from somewhere else.
        g.hasTarget = false;
        g.dashPause = GOBLIN_RULES.rampartStop[1];
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
