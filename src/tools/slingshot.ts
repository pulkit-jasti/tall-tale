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
// A pebble let go mid-swing keeps the hand's speed, like a tossed goblin. A
// thrown pebble only knocks a goblin back, dazed. A held goblin brought to the
// empty pouch clicks in like a pebble: shot, it knocks out the goblin it hits,
// knocks back the ones around it, and poofs. It costs a meal.
// v3 2.6 (Goblin shot, Fair Trade): goblins right where it lands are knocked
// out, the ones around them flung back farther than a pebble's knock, dazed.
//
// v3 2.6 secret abilities that go through the slingshot:
//   - Fire pebble (Night Owl): a torch beside the bowl, lit at sunset and
//     night. A pinched pebble held in its flame FIRE_PEBBLE.lightTime catches
//     fire and burns out FIRE_PEBBLE.burnTime later; shot, it lights kegs and
//     haystacks (things with `lightable`).
//   - Flying keg (Package Deal): a keg the magnet pulled in stands by the
//     bowl (addKeg); pinch it to the pouch and shoot it: a big blast where it
//     lands (onKegBlast).
//   - Spicy sugar: a spicy cube stays spicy through the pouch and the shot.
//
// Aim assist, in order of importance:
//   1. Steady release: the shot uses the average aim of the last ~100 ms
//      before the fingers opened, not the release frame.
//   2. Trajectory dots all the way to the impact while pulling, and a
//      semi transparent circle on the ground where the shot will land.
//   3. Target glow on the goblin or thing about to be hit.
//   4. Gentle bend toward a target within a small cone after release.
// Targets are goblins and any other thing meant to be shot (boulders, trees,
// kegs, added with addTarget). Thrown pebbles get a weaker bend, toward
// goblins only, since they do not set off things.
//   5. A hit area bigger than the pebble.
//
// The frame, pouch, bowl and pebbles in the hand live in boardLift (cm, rises
// with the board, never turns). Flying pebbles and dots live in boardSpin
// (cm), where the goblins are, so hits are simple.
import {
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
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
import { AIM_ASSIST, BOARD, FIRE_PEBBLE, FLYING_KEG, GOBLIN_SHOT, HOLD, JUICE, PEBBLE_BOWL, PEBBLE_THROW, SLINGSHOT, TOOL_SPOTS, TRIGGERS } from '../config/game.js';
import { BOOST } from '../rules/boosts.js';
import { mark } from '../debug/perfMarks.js';
import type { Particles } from '../fx/particles.js';
import { applyTouchState, type TouchState } from '../player/feedback.js';
import type { HandState } from '../player/hands.js';
import { holdMatrix } from '../player/hold.js';
import { degToRad, landingHeight, polarX, polarZ } from '../rules/boardMath.js';
import { shrinkAway } from '../fx/ease.js';
import { Goblin, type Goblins } from '../units/goblins.js';
import { cloneStatic, InstancedPool, loadTemplate, type ModelTemplate } from '../world/models.js';
import { flatMaterial, pebbleBowl, post, slingshotBand, slingshotFrame, slingshotPouch } from '../world/shapes.js';
import { flameGeometry } from '../world/nightLights.js';
import type { Stage } from '../world/stage.js';

export type SlingEvent = 'grabbed' | 'pebbleTaken' | 'loaded' | 'shot';

/** The things on the slingshot a hand can reach for (v3 2.6: a pulled-in keg waiting by the bowl). */
export type SlingPart = 'pouch' | 'bowl' | 'handle' | 'keg';

/** What hit a slingshot target: a pebble shot, a goblin shot, or a burning pebble (v3 2.6). */
export type SlingHit = 'shot' | 'goblin' | 'fire';

/**
 * Something besides goblins the slingshot can hit, which the aim assist also
 * bends toward: the triggers (boulder, leaning tree, powder keg) in build step 5.
 */
export interface SlingTarget {
  /** Middle of the thing (board space, cm). */
  center(out: Vector3): Vector3;
  /** Its size as a hit radius (cm). The pebble's hit area is added to it. */
  readonly radius: number;
  /** Assist share, 0 to 1 (like AIM_ASSIST.typeShare for goblins). */
  readonly assist: number;
  /** False once it was set off or is gone. */
  hittable(): boolean;
  /** Hit by a slingshot pebble or a goblin shot. A thrown pebble never sets it off. */
  onHit(by: SlingHit): void;
  /** v3 2.6: a burning pebble lights it now (kegs and haystacks), even when a plain pebble cannot set it off. */
  readonly lightable?: boolean;
  /** Glow while the slingshot aims at it. */
  setAimed(aimed: boolean): void;
}

/** What the slingshot can hit: a goblin or another thing. */
type Target = Goblin | SlingTarget;

/**
 * What a flying pebble does to the goblin it hits: nothing (dropped), knock it
 * back (thrown by hand), knock it out (shot), or knock it out plus a splash
 * (a goblin shot).
 */
/** v3 2.2: 'cube' is a sugar cube shot from the pouch: it flies like a shot, hits nothing, and becomes a lure where it lands. */
/** v3 2.6: 'keg' is a flying keg (Package Deal): a big blast where it lands. */
type PebbleKind = 'dropped' | 'thrown' | 'shot' | 'goblin' | 'cube' | 'keg';

interface Pebble {
  alive: boolean;
  age: number;
  kind: PebbleKind;
  /** v3 2.6: a burning pebble (Night Owl), or a spicy sugar cube. */
  fire: boolean;
  spicy: boolean;
  /** The goblin flying in place of the pebble (kind 'goblin'). */
  goblin: Goblin | null;
  readonly position: Vector3;
  readonly velocity: Vector3;
  /** Target the assist bends toward, if any. */
  target: Target | null;
  /** Assist share for that target. */
  share: number;
  /** Landed: it lies there this long (seconds) before it shrinks away. -1 while it flies. */
  rest: number;
  /** Its turn while it rolls and once it lies still. */
  readonly spin: Quaternion;
  /** Landed and still rolling on (it slows down, then lies there for `rest`). */
  rolling: boolean;
  /** Time to the next trail puff (seconds). */
  trail: number;
}

interface TraceResult {
  /** The first target on the path, if any. */
  hit: Target | null;
  /** Flight time to the hit or landing (seconds). */
  time: number;
  readonly point: Vector3;
  /** Ground height under the impact (board, cm), or null when it never lands on the board. */
  ground: number | null;
}

interface FrameHolder {
  hand: HandState;
  /** Held with a pinch (keeps the grab angle) or a fist (held like a real slingshot, HOLD). */
  viaPinch: boolean;
  openTime: number;
  /** Time the hand has been untracked (seconds). */
  lostTime: number;
  /** Time since the grab (seconds), for the ease into the fist. */
  heldTime: number;
  /** Frame pose relative to the hand, from the moment of the grab (pinch grabs). */
  readonly offset: Matrix4;
}

interface HandPebble {
  hand: HandState;
  mesh: Object3D;
  /** Smoothed hand speed (boardLift, cm per second), so letting go mid-swing throws it. */
  readonly velocity: Vector3;
  readonly last: Vector3;
  hasLast: boolean;
  /** v3 2.6: time in the torch's flame so far, and seconds left burning (0: not lit). */
  heat: number;
  fire: number;
  /** v3 2.6: the pulled-in keg instead of a pebble. */
  keg: boolean;
}

const SAMPLES = 64;
const UP = new Vector3(0, 1, 0);
const HIT_COLORS = [0x6a8f3a, 0x8fb04a, 0xffffff, 0xf2c14e];
const DUST_COLORS = [0xd9c08a, 0xc9b07a, 0xb59a68];

const temp = new Vector3();
const temp2 = new Vector3();
const temp3 = new Vector3();
const shotQuaternion = new Quaternion();
const segment = new Vector3();
const toCenter = new Vector3();
const center = new Vector3();
const traceP = new Vector3();
const traceV = new Vector3();
const traceNext = new Vector3();
const matrix = new Matrix4();
const restAt = new Vector3();
const restScale = new Vector3();
const rollAxis = new Vector3();
const rollTurn = new Quaternion();
const splashAt = new Vector3();

/**
 * The pebble: a low-poly ball like the sun (flat faces), a little squashed
 * and lumpy so it reads as a stone. Rests on y = 0 like a fitted model.
 */
function pebbleTemplate(): ModelTemplate {
  const r = SLINGSHOT.pebbleSize / 2;
  const geometry = new IcosahedronGeometry(r, 1);
  const at = geometry.attributes.position;
  for (let i = 0; i < at.count; i++) {
    const x = at.getX(i);
    const y = at.getY(i);
    const z = at.getZ(i);
    // From the corner's own spot, so the copies of a shared corner move together and no gaps open.
    const push = 1 + SLINGSHOT.pebbleLumps * Math.sin(x * 7.1 + y * 3.7) * Math.cos(z * 5.3 - y * 2.9);
    at.setXYZ(i, x * push, y * push * SLINGSHOT.pebbleSquash, z * push);
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  geometry.translate(0, -box.min.y, 0);
  const object = new Group();
  object.add(new Mesh(geometry, flatMaterial(SLINGSHOT.pebbleColor)));
  return { object, animations: [], size: new Vector3(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z) };
}
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
  /** Height of the full pebble pile (cm). */
  private pileHeight = 0;
  private stoneTemplate!: ModelTemplate;
  private pebbles: Pebble[] = [];
  private pool!: InstancedPool;
  private pebbleHeight = SLINGSHOT.pebbleSize;
  private dots!: InstancedMesh;
  private hiddenMatrix = new Matrix4().makeScale(0, 0, 0);

  /** Frame local points (cm). */
  private forkLocal = new Vector3();
  private pouchRestLocal = new Vector3();
  /** Rest pose on the platform (boardLift, cm). */
  private restPosition = new Vector3();
  private restQuaternion = new Quaternion();
  /** Bowl center at the rim (boardLift, cm). */
  private bowlCenter = new Vector3();

  private frameHolder: FrameHolder | null = null;
  /** Gliding back to the platform: time left (seconds), and the pose it started from. */
  private returnLeft = 0;
  private returnFromPosition = new Vector3();
  private returnFromQuaternion = new Quaternion();

  private pouchHolder: HandState | null = null;
  /** The pulling hand: time untracked, and the time left for its pinch to read again once back (seconds). */
  private pullLostTime = 0;
  private pullSettle = 0;
  private handPebbles: HandPebble[] = [];
  private loaded = false;
  /** The goblin in the pouch instead of a pebble, if any (held mode, so nothing else touches it). */
  private pouchGoblin: Goblin | null = null;
  /** v3 2.2: a sugar cube in the pouch instead of a pebble. */
  private pouchCube = false;
  /** v3 2.2: a shot sugar cube landed at a board point (cm): the game puts a lure there (v3 2.6: spicy if peppered). */
  onCubeLanded: (x: number, y: number, z: number, spicy: boolean) => void = () => {};
  /** v3 2.6: the cube in the pouch is spicy; the pebble in the pouch burns (seconds left); the pulled-in keg is in the pouch. */
  private pouchSpicy = false;
  private pouchFire = 0;
  private pouchKeg = false;
  private pouchKegMesh: Object3D | null = null;
  /** v3 2.6 Night Owl: the torch beside the bowl (lit at sunset and night: set by the game every frame). */
  torchLit = false;
  private torch = new Group();
  private torchFlame!: Mesh;
  private flamePuff = 0;
  /** v3 2.6: a pebble caught fire in the torch (the achievement). */
  onFireLit: () => void = () => {};
  /** v3 2.6 Package Deal: the keg waiting on its stand by the bowl (null: none), the one in flight, its template. */
  private kegTemplate: ModelTemplate | null = null;
  private kegWaiting: Object3D | null = null;
  private kegStand = new Group();
  private kegFlying: Object3D | null = null;
  private kegRest = new Vector3();
  /** v3 2.6 Package Deal: a flying keg landed or hit at a board point (cm): the game blasts there. */
  onKegBlast: (at: Vector3) => void = () => {};
  /** v3 2.6 Fair Trade: a goblin shot landed and knocked out this many. */
  onGoblinShot: (knocked: number) => void = () => {};
  /** Pebbles in the bowl. */
  private bowlCount: number = PEBBLE_BOWL.capacity;
  private refillTimer = 0;
  private time = 0;
  private lastCreak = 0;
  /** The player's head (boardLift, cm), so no shot points at the face. */
  private head = new Vector3();

  /** Aim samples for the steady release: fork and pull (boardLift, cm). */
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
  private aimTarget: Target | null = null;
  private trace: TraceResult = { hit: null, time: 0, point: new Vector3(), ground: null };
  /** Prediction for a pebble thrown by hand, for its assist. */
  private throwTrace: TraceResult = { hit: null, time: 0, point: new Vector3(), ground: null };
  /** Things besides goblins that can be shot (see SlingTarget). */
  private things: SlingTarget[] = [];
  /** Circle on the ground where the aimed shot will land. */
  private marker!: Mesh;

  /** Called with each goblin a pebble knocks out (the tutorial director counts them). */
  onHit: (goblin: Goblin) => void = () => {};
  /** Called on each step of using it (the tutorial lessons wait for these). */
  onEvent: (event: SlingEvent) => void = () => {};
  /** The frame glows (pulsing) until the handle is grabbed: a new tool, or a hint. */
  beckon = false;
  /** Another tool's lesson runs: the slingshot, its pebbles and its pouch cannot be grabbed (the battle sets it). */
  locked = false;

  /**
   * World position of a part, for the tutorial's markers and ghost hand:
   * the pouch center, the bowl's rim center, the top of the pebble pile in
   * the bowl, or the middle of the handle (on its axis).
   */
  partWorld(part: SlingPart | 'pebbles', out: Vector3): Vector3 {
    if (part === 'pouch') return this.pouchWorld(out);
    if (part === 'bowl') return this.stage.boardLift.localToWorld(out.copy(this.bowlCenter));
    if (part === 'keg') return this.stage.boardLift.localToWorld(out.copy(this.kegRest).setY(this.kegRest.y + FLYING_KEG.height / 2));
    if (part === 'pebbles') {
      out.copy(this.bowlCenter);
      out.y += -PEBBLE_BOWL.depth * 0.85 + (this.pile?.visible ? this.pile.scale.y * this.pileHeight : 0);
      return this.stage.boardLift.localToWorld(out);
    }
    return this.frame.localToWorld(out.set(0, SLINGSHOT.handleHeight * 0.5, 0));
  }

  /** Level direction the slingshot shoots (world), from the pouch through the fork. */
  shotDirection(out: Vector3): Vector3 {
    this.frame.getWorldQuaternion(shotQuaternion);
    return out.set(0, 0, -1).applyQuaternion(shotQuaternion).setY(0).normalize();
  }

  /** True while a pebble or goblin is in the pouch. */
  get isLoaded(): boolean {
    return this.loaded;
  }

  constructor(
    private stage: Stage,
    private goblins: Goblins,
    private audio: GameAudio,
    private particles: Particles,
  ) {}

  async load(): Promise<void> {
    const [platform, pile, keg] = await Promise.all([
      loadTemplate('castle/castle-kit/tower-hexagon-top.glb', { width: TOOL_SPOTS.platformWidth }),
      loadTemplate('rocks/survival/resource-stone-large.glb', { width: PEBBLE_BOWL.pileWidth }),
      // v3 2.6 Package Deal: the keg the magnet pulls in, small enough for the pouch (the traps' barrel model).
      loadTemplate('props/survival/barrel.glb', { height: FLYING_KEG.height }),
    ]);
    const stone = pebbleTemplate();
    this.stoneTemplate = stone;
    this.kegTemplate = keg;
    // A few hand pebbles and the flying keg made now, hidden, so nothing is cloned mid-battle.
    for (let i = 0; i < 4; i++) {
      const mesh = cloneStatic(stone);
      this.recycleStone(mesh);
    }
    this.kegMesh = cloneStatic(keg);
    this.kegMesh.visible = false;
    this.stage.boardLift.add(this.kegMesh);
    this.buildPlatform(platform);
    this.buildFrame();
    this.buildBowl(pile);
    this.buildPebbles(stone);
    this.buildTorch();
    this.buildKegStand();
    this.stage.boardLift.add(this.root, this.frame);
  }

  /**
   * v3 2.6 Night Owl: a torch on a stick beside the bowl (the castle torches'
   * look, docs/placeholder-shapes.md), its flame shown only while lit.
   */
  private buildTorch(): void {
    const F = FIRE_PEBBLE;
    const a = degToRad(F.angleDeg);
    const stickHeight = F.flameY - F.flameSize * 0.5;
    const stick = new Mesh(new CylinderGeometry(0.3, 0.22, stickHeight, 6).translate(0, stickHeight / 2, 0), flatMaterial(F.stickColor));
    // The layered low-poly flame of the castle torches (2026-11-17), sized to this torch.
    this.torchFlame = new Mesh(
      flameGeometry()
        .scale(F.flameSize * 0.8, F.flameSize * 0.8, F.flameSize * 0.8)
        .translate(0, F.flameSize * 0.45, 0),
      new MeshBasicMaterial({ vertexColors: true, fog: false, toneMapped: false }),
    );
    this.torchFlame.position.y = stickHeight;
    this.torch.add(stick, this.torchFlame);
    this.torch.position.set(polarX(F.radius, a), 0, polarZ(F.radius, a));
    this.root.add(this.torch);
  }

  /** The torch's flame (boardLift cm). */
  private flameLocal(out: Vector3): Vector3 {
    return out.set(this.torch.position.x, FIRE_PEBBLE.flameY, this.torch.position.z);
  }

  /** v3 2.6 Package Deal: a small post by the bowl the pulled-in keg lands on (hidden while empty). */
  private buildKegStand(): void {
    const K = FLYING_KEG;
    const a = degToRad(K.angleDeg);
    this.kegRest.set(polarX(K.radius, a), K.topY, polarZ(K.radius, a));
    const stem = post(K.topY);
    this.kegStand.add(stem);
    this.kegStand.position.set(this.kegRest.x, 0, this.kegRest.z);
    this.kegStand.visible = false;
    this.root.add(this.kegStand);
  }

  /**
   * Pebbles carried by hand, made ahead and reused (audit 2026-11-17: each pinch at the bowl cloned a new
   * one). Kept in boardLift, hidden when not in a hand, so the warm-up compiles them.
   */
  private stonePool: Object3D[] = [];

  private takeStone(): Object3D {
    const mesh = this.stonePool.pop() ?? cloneStatic(this.stoneTemplate!);
    mesh.visible = true;
    this.stage.boardLift.add(mesh);
    return mesh;
  }

  private recycleStone(mesh: Object3D): void {
    mesh.visible = false;
    if (mesh.parent !== this.stage.boardLift) this.stage.boardLift.add(mesh);
    this.stonePool.push(mesh);
  }

  /** The one flying keg, made once and reused (it was cloned for every keg the magnet pulled in). */
  private kegMesh: Object3D | null = null;

  /** v3 2.6 Package Deal: a keg pulled in by the magnet lands on its stand by the bowl, with a poof. False if one already waits. */
  addKeg(): boolean {
    if (!this.kegTemplate || this.kegWaiting || this.pouchKeg || this.handPebbles.some((p) => p.keg) || this.kegFlying) return false;
    const keg = this.kegMesh ?? (this.kegMesh = cloneStatic(this.kegTemplate));
    keg.visible = true;
    keg.rotation.set(0, 0, 0);
    keg.scale.setScalar(1);
    keg.position.copy(this.kegRest);
    this.stage.boardLift.add(keg);
    this.kegWaiting = keg;
    this.kegStand.visible = true;
    this.particles.burst(this.stage.boardLift.localToWorld(temp.copy(this.kegRest)), [0xffffff, 0xddd6c8, 0xe8ecf0], 10, 0.08);
    this.audio.play('toolPoof', temp);
    return true;
  }

  /** v3 2.6: no keg anywhere and no burning pebble (a new battle). */
  clearExtras(): void {
    for (const k of [this.kegWaiting, this.kegFlying, this.pouchKegMesh]) k?.removeFromParent();
    this.kegWaiting = null;
    this.kegFlying = null;
    this.pouchKegMesh = null;
    this.kegStand.visible = false;
    if (this.pouchKeg) {
      this.pouchKeg = false;
      this.loaded = false;
    }
    for (let i = this.handPebbles.length - 1; i >= 0; i--) {
      if (!this.handPebbles[i].keg) continue;
      this.handPebbles[i].mesh.removeFromParent();
      this.handPebbles.splice(i, 1);
    }
    this.pouchFire = 0;
  }

  private buildPlatform(platform: ModelTemplate): void {
    const { angleDeg, radius } = TOOL_SPOTS.slingshot;
    const top = TOOL_SPOTS.platformTop;
    const a = degToRad(angleDeg);
    const x = polarX(radius, a);
    const z = polarZ(radius, a);
    const stand = cloneStatic(platform);
    stand.position.set(x, top - platform.size.y, z);
    // The post reaches down to the board.
    const stem = post(top - platform.size.y);
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
    const { angleDeg, radius, rimY, depth } = PEBBLE_BOWL;
    const a = degToRad(angleDeg);
    const bowl = new Group();
    this.bowlCenter.set(polarX(radius, a), rimY, polarZ(radius, a));
    bowl.position.copy(this.bowlCenter);
    // The post reaches down to the board.
    const stem = post(rimY - depth);
    stem.position.y -= depth;
    const bowlMesh = pebbleBowl();
    this.bowlMaterials = [bowlMesh.material as MeshStandardMaterial];
    bowl.add(bowlMesh, stem);
    this.pile = cloneStatic(pile);
    this.pileHeight = pile.size.y;
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
        kind: 'dropped',
        fire: false,
        spicy: false,
        goblin: null,
        position: new Vector3(),
        velocity: new Vector3(),
        target: null,
        share: 1,
        rest: -1,
        spin: new Quaternion(),
        rolling: false,
        trail: 0,
      });
    }
    // The pebble in the pouch, shown once one is loaded.
    this.pouchPebble = cloneStatic(stone);
    // It sits in the pouch's cup, its back against the leather, centered on the
    // strip's height. The stone is taller than the strip, so it shows above and below.
    this.pouchPebble.position.set(0, -stone.size.y / 2, SLINGSHOT.pouchSag - stone.size.z / 2);
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

    this.marker = new Mesh(
      new CircleGeometry(AIM_ASSIST.markerRadius, 20).rotateX(-Math.PI / 2),
      new MeshBasicMaterial({
        color: AIM_ASSIST.markerColor,
        transparent: true,
        opacity: AIM_ASSIST.markerOpacity,
        depthWrite: false,
      }),
    );
    this.marker.visible = false;
    this.stage.boardSpin.add(this.marker);
  }

  // ---- Hands (called from GrabEat, which picks one target per hand) ----

  /** The nearest slingshot part this hand can reach, with its distance (meters), or null. */
  reach(hand: HandState): { part: SlingPart; distance: number } | null {
    // Locked by another lesson: nothing on it can be grabbed or pinched.
    if (!this.root.visible || this.locked || this.isBusy(hand)) return null;
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
    // v3 2.6: the pulled-in keg on its stand: pinch to take it.
    if (this.kegWaiting) {
      const d = hand.pinchPoint.distanceTo(this.partWorld('keg', temp));
      if (d < FLYING_KEG.grabRadius * this.stage.boardScale && d < best) {
        best = d;
        part = 'keg';
      }
    }
    // Bowl: pinch to take a pebble.
    {
      const d = hand.pinchPoint.distanceTo(this.stage.boardLift.localToWorld(temp.copy(this.bowlCenter)));
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
  pinch(part: 'pouch' | 'bowl' | 'keg', hand: HandState): boolean {
    if (part === 'keg') {
      const keg = this.kegWaiting;
      if (!keg) return false;
      this.kegWaiting = null;
      this.kegStand.visible = false;
      this.handPebbles.push({ hand, mesh: keg, velocity: new Vector3(), last: new Vector3(), hasLast: false, heat: 0, fire: 0, keg: true });
      this.placeHandPebble(hand, keg);
      this.audio.play('grab', hand.pinchPoint);
      return true;
    }
    if (part === 'pouch') {
      if (!this.loaded) {
        this.audio.play('locked', undefined, 1, 0.4);
        return false;
      }
      this.pouchHolder = hand;
      this.pullLostTime = 0;
      this.pullSettle = 0;
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
    const mesh = this.takeStone();
    this.handPebbles.push({ hand, mesh, velocity: new Vector3(), last: new Vector3(), hasLast: false, heat: 0, fire: 0, keg: false });
    this.onEvent('pebbleTaken');
    this.placeHandPebble(hand, mesh);
    this.audio.play('grab', hand.pinchPoint);
    return true;
  }

  /** Grabs the handle. From now on the slingshot follows this hand. */
  grabHandle(hand: HandState, viaPinch: boolean): void {
    this.frame.updateMatrixWorld(true);
    this.handWorldMatrix(hand, viaPinch, handMatrix);
    const offset = new Matrix4().copy(handMatrix).invert().multiply(this.frame.matrixWorld);
    this.frameHolder = { hand, viaPinch, openTime: 0, lostTime: 0, heldTime: 0, offset };
    this.returnLeft = 0;
    this.beckon = false;
    this.onEvent('grabbed');
    this.audio.play('grab', hand.palm);
  }

  /** Adds a thing the slingshot can hit and aim at (a trigger). */
  addTarget(thing: SlingTarget): void {
    this.things.push(thing);
  }

  removeTarget(thing: SlingTarget): void {
    const i = this.things.indexOf(thing);
    if (i >= 0) this.things.splice(i, 1);
    if (this.aimTarget === thing) this.setAimTarget(null);
  }

  /** A held goblin brought to the empty pouch clicks in, like a pebble. True if it did. */
  loadGoblin(hand: HandState, goblin: Goblin): boolean {
    if (this.loaded || !this.frame.visible) return false;
    if (hand.pinchPoint.distanceTo(this.pouchWorld(temp)) >= SLINGSHOT.attachRadius) return false;
    this.putGoblinInPouch(goblin);
    return true;
  }

  /** v3 2.2: a held sugar cube brought to the empty pouch clicks in, like a pebble. True if it did. */
  loadCube(hand: HandState, spicy = false): boolean {
    if (this.loaded || !this.frame.visible) return false;
    if (hand.pinchPoint.distanceTo(this.pouchWorld(temp)) >= SLINGSHOT.attachRadius) return false;
    this.loaded = true;
    this.pouchCube = true;
    this.pouchSpicy = spicy;
    if (this.pouchPebble) this.pouchPebble.visible = true;
    this.audio.play('pebbleLoad', this.pouchWorld(temp));
    this.onEvent('loaded');
    return true;
  }

  private putGoblinInPouch(goblin: Goblin): void {
    this.loaded = true;
    this.pouchGoblin = goblin;
    goblin.vx = goblin.vy = goblin.vz = 0;
    this.placePouchGoblin();
    this.audio.play('pebbleLoad', this.pouchWorld(temp));
    this.audio.play('squeal', temp);
    this.onEvent('loaded');
  }

  /** Lets go of everything without shooting (board placed again). A loaded pebble or goblin stays in. */
  release(): void {
    this.cancelPull();
    if (this.frameHolder) this.letGoOfHandle();
    for (const p of this.handPebbles) {
      p.velocity.set(0, 0, 0);
      this.dropHandPebble(p);
    }
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

  /** Its platform and bowl, and the frame (the menu sinks them, src/world/sceneSwap.ts). */
  get groups(): Object3D[] {
    return [this.root, this.frame];
  }

  /**
   * A copy of the frame (bands and pouch at rest) for the menu's loadout
   * stand (v2 run 2), with its own materials, standing at its origin.
   */
  displayModel(): { model: Group; materials: MeshStandardMaterial[]; gripMid: number; lift: number; turn: (angleDeg: number, out: Quaternion) => Quaternion } {
    const model = this.frame.clone(true);
    model.position.set(0, 0, 0);
    model.quaternion.identity();
    model.scale.setScalar(1);
    model.visible = true;
    const materials: MeshStandardMaterial[] = [];
    const copies = new Map<MeshStandardMaterial, MeshStandardMaterial>();
    model.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh || Array.isArray(mesh.material)) return;
      const own = mesh.material as MeshStandardMaterial;
      let copy = copies.get(own);
      if (!copy) {
        copy = own.clone();
        copy.emissive.setHex(0x000000);
        copies.set(own, copy);
        materials.push(copy);
      }
      mesh.material = copy;
    });
    // Turned like on its platform: the shot pointing out, away from the seat.
    const turn = (angleDeg: number, out: Quaternion): Quaternion => {
      const a = degToRad(angleDeg);
      return out.setFromAxisAngle(UP, Math.atan2(-Math.sin(a), Math.cos(a)));
    };
    return { model, materials, gripMid: SLINGSHOT.handleHeight / 2, lift: 0, turn };
  }

  /** Shows or hides the slingshot (the tutorial director brings it in later). */
  setVisible(visible: boolean): void {
    if (!visible) {
      this.release();
      if (this.pouchGoblin) {
        this.goblins.drop(this.pouchGoblin);
        this.pouchGoblin = null;
        this.loaded = false;
      }
      this.clearExtras();
    }
    this.root.visible = visible;
    this.frame.visible = visible;
  }

  // ---- Every frame ----

  update(dt: number, headWorld: Vector3): void {
    this.time += dt;
    this.head.copy(headWorld);
    this.stage.boardLift.worldToLocal(this.head);
    this.updateBowl(dt);
    this.updateFrame(dt);
    // Glow until grabbed. A hand near the handle shows Ready instead.
    if (this.beckon && this.handleTouch === 'idle') {
      applyTouchState(this.woodMaterials, Math.sin(this.time * 6) > 0 ? 'ready' : 'idle');
    }
    this.updateHandPebbles(dt);
    this.updateTorch(dt);

    const hand = this.pouchHolder;
    if (hand) {
      if (!hand.tracked) {
        // Lost: the pouch stays at its last spot for a moment.
        this.pullLostTime += dt;
        this.pullSettle = SLINGSHOT.pullSettle;
        if (this.pullLostTime >= SLINGSHOT.pullLostGrace) this.cancelPull();
      } else {
        this.pullLostTime = 0;
        if (this.pullSettle > 0) {
          // Just back: the pinch needs a moment to read again. Only an
          // opening seen while tracked shoots, so this never shoots.
          this.pullSettle -= dt;
          if (hand.pinch.on) {
            this.pullSettle = 0;
            this.followPull(hand);
          } else if (this.pullSettle <= 0) {
            this.cancelPull();
          }
        } else if (hand.pinch.ended || !hand.pinch.on) {
          this.shoot();
        } else {
          this.followPull(hand);
        }
      }
    } else {
      // Spring back to rest.
      this.pouch.position.lerp(this.pouchRestLocal, 1 - Math.exp(-SLINGSHOT.springBack * dt));
    }
    // Locked: a small wobble, no text.
    this.pouch.rotation.z = this.pouchTouch === 'locked' ? Math.sin(this.time * 30) * 0.2 : 0;
    this.updateBands();
    this.placePouchGoblin();
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
      const hand = holder.hand;
      // During a pull the slingshot is locked where the pull started: the aim
      // comes only from the pulling hand. The holding hand is often hidden
      // behind it then, and its guessed pose must not move the shot. It
      // cannot let go either (its guessed fingers often read as open).
      const pulling = this.pouchHolder !== null;
      // Lost tracking: the slingshot stays where it is for a moment instead of dropping.
      holder.lostTime = hand.tracked || pulling ? 0 : holder.lostTime + dt;
      // Let go only when the hand is clearly open for a moment (same as the ring).
      const closed = hand.pinch.on || hand.fist.on;
      holder.openTime = closed || !hand.tracked || pulling ? 0 : holder.openTime + dt;
      if (holder.lostTime >= SLINGSHOT.holdLostGrace || holder.openTime >= SLINGSHOT.releaseHold) {
        this.letGoOfHandle();
      } else if (hand.tracked && !pulling) {
        holder.heldTime += dt;
        if (holder.viaPinch) {
          // A pinch keeps the angle it grabbed at.
          this.handWorldMatrix(holder.hand, true, handMatrix);
          matrix.copy(this.stage.boardLift.matrixWorld).invert().multiply(handMatrix).multiply(holder.offset);
        } else {
          // A fist holds it like a real slingshot: fork up past the thumb, the shot the way the knuckles point.
          holdMatrix(holder.hand, 'slingshot', 0.01 * this.stage.boardScale, handMatrix);
          matrix.copy(this.stage.boardLift.matrixWorld).invert().multiply(handMatrix);
        }
        matrix.decompose(targetPosition, targetQuaternion, targetScale);
        // Right after the grab it eases into the hand, so the snap never jumps.
        const smoothing = holder.heldTime < HOLD.snapTime ? HOLD.snapSmoothing : SLINGSHOT.holdSmoothing;
        const k = 1 - Math.exp(-dt / smoothing);
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
  private updateHandPebbles(dt: number): void {
    for (let i = this.handPebbles.length - 1; i >= 0; i--) {
      const p = this.handPebbles[i];
      const hand = p.hand;
      if (!hand.tracked || hand.pinch.ended || !hand.pinch.on) {
        // Lost tracking is not a throw.
        if (!hand.tracked) p.velocity.set(0, 0, 0);
        this.dropHandPebble(p);
        this.handPebbles.splice(i, 1);
        continue;
      }
      this.placeHandPebble(hand, p.mesh);
      this.trackHandPebble(p, dt);
      if (!p.keg) this.heatHandPebble(p, dt);
      if (!this.loaded && this.frame.visible && hand.pinchPoint.distanceTo(this.pouchWorld(temp)) < SLINGSHOT.attachRadius) {
        this.loaded = true;
        this.handPebbles.splice(i, 1);
        this.audio.play('pebbleLoad', temp);
        if (p.keg) {
          // v3 2.6: the keg sits in the pouch's cup like a pebble.
          this.pouchKeg = true;
          this.pouchKegMesh = p.mesh;
          this.pouch.add(p.mesh);
          p.mesh.position.set(0, -FLYING_KEG.height / 2, SLINGSHOT.pouchSag - 1);
          p.mesh.rotation.set(Math.PI / 2, 0, 0);
        } else {
          this.recycleStone(p.mesh);
          if (this.pouchPebble) this.pouchPebble.visible = true;
          this.pouchFire = p.fire;
        }
        this.onEvent('loaded');
      }
    }
  }

  /**
   * v3 2.6 Night Owl: a pinched pebble in the lit torch's flame heats up and
   * catches fire; a burning one throws off flames and burns out after a while.
   */
  private heatHandPebble(p: HandPebble, dt: number): void {
    if (p.fire > 0) {
      p.fire -= dt;
      if (p.fire <= 0) {
        p.fire = 0;
        p.heat = 0;
        this.particles.burst(this.stage.boardLift.localToWorld(temp2.copy(p.mesh.position)), FIRE_PEBBLE.smokeColors, 4, 0.04);
        return;
      }
      this.flames(this.stage.boardLift.localToWorld(temp2.copy(p.mesh.position)), dt);
      return;
    }
    if (!this.torchLit || !this.torch.visible) {
      p.heat = 0;
      return;
    }
    this.stage.boardLift.localToWorld(this.flameLocal(temp2));
    if (p.hand.pinchPoint.distanceTo(temp2) > FIRE_PEBBLE.lightRadius * this.stage.boardScale) {
      p.heat = Math.max(0, p.heat - dt);
      return;
    }
    p.heat += dt;
    if (p.heat < FIRE_PEBBLE.lightTime) return;
    p.fire = FIRE_PEBBLE.burnTime;
    this.particles.burst(temp2, FIRE_PEBBLE.flameColors, 10, 0.06);
    this.audio.play('hayBurn', temp2, 0.8);
    this.onFireLit();
  }

  /** Flame puffs from a burning pebble (world point), now and then. */
  private flames(at: Vector3, dt: number): void {
    this.flamePuff -= dt;
    if (this.flamePuff > 0) return;
    this.flamePuff = FIRE_PEBBLE.puffEvery;
    this.particles.burst(at, FIRE_PEBBLE.flameColors, 1, 0.02);
  }

  /** v3 2.6: the torch shows only while lit (sunset and night), its flame flickering; a burning pebble in the pouch burns down. */
  private updateTorch(dt: number): void {
    this.torch.visible = this.torchLit;
    if (this.torchLit) {
      const s = 0.85 + 0.15 * Math.sin(this.time * 17) * Math.sin(this.time * 5.3);
      this.torchFlame.scale.set(s, 0.9 + 0.25 * Math.sin(this.time * 13), s);
    }
    if (this.pouchFire > 0) {
      this.pouchFire = Math.max(0, this.pouchFire - dt);
      if (this.pouchFire > 0) this.flames(this.pouchWorld(temp2), dt);
      else this.particles.burst(this.pouchWorld(temp2), FIRE_PEBBLE.smokeColors, 4, 0.04);
    }
  }

  private placeHandPebble(hand: HandState, mesh: Object3D): void {
    this.stage.boardLift.worldToLocal(mesh.position.copy(hand.pinchPoint));
    mesh.position.y -= this.pebbleHeight / 2;
  }

  /** Measures the hand speed of a carried pebble (smoothed, like a held goblin). */
  private trackHandPebble(p: HandPebble, dt: number): void {
    const at = p.mesh.position;
    if (p.hasLast && dt > 0) {
      const k = 1 - Math.exp(-dt / PEBBLE_THROW.smoothing);
      temp2.copy(at).sub(p.last).multiplyScalar(1 / dt).sub(p.velocity);
      p.velocity.addScaledVector(temp2, k);
    }
    p.last.copy(at);
    p.hasLast = true;
  }

  /** Let go of a carried pebble: back into the bowl if over it, otherwise it flies with the hand's speed. */
  private dropHandPebble(p: HandPebble): void {
    // v3 2.6: the keg is never tossed: let go anywhere but the pouch, it goes back on its stand.
    if (p.keg) {
      p.mesh.position.copy(this.kegRest);
      p.mesh.rotation.set(0, 0, 0);
      this.kegWaiting = p.mesh;
      this.kegStand.visible = true;
      this.audio.play('drop', this.stage.boardLift.localToWorld(temp.copy(this.kegRest)), 0.6);
      return;
    }
    this.recycleStone(p.mesh);
    const at = p.mesh.position;
    const dx = at.x - this.bowlCenter.x;
    const dz = at.z - this.bowlCenter.z;
    const overBowl = Math.hypot(dx, dz) < PEBBLE_BOWL.width / 2 + 1 && at.y > this.bowlCenter.y - PEBBLE_BOWL.depth;
    if (overBowl) {
      this.bowlCount = Math.min(PEBBLE_BOWL.capacity, this.bowlCount + 1);
      this.updatePile();
      this.audio.play('drop', this.stage.boardLift.localToWorld(temp.copy(at)), 0.6);
      return;
    }
    const v = p.velocity.multiplyScalar(PEBBLE_THROW.scale);
    const speed = v.length();
    if (speed > PEBBLE_THROW.maxSpeed) v.multiplyScalar(PEBBLE_THROW.maxSpeed / speed);
    // The velocity into board space: map two points and take the difference.
    this.toBoard(temp2.copy(at).add(v));
    this.toBoard(temp.copy(at));
    temp2.sub(temp);
    temp.y += this.pebbleHeight / 2;
    if (speed < PEBBLE_THROW.minSpeed) {
      this.launch(temp, temp2, null, 'dropped');
      return;
    }
    // A weaker assist toward goblins only (thrown pebbles do not set off things).
    this.traceFlight(temp, temp2, this.throwTrace);
    this.launch(temp, temp2, this.pickTarget(temp, temp2, this.throwTrace, false), 'thrown');
  }

  /** The pouch follows the pinch, up to the longest pull. */
  private followPull(hand: HandState): void {
    this.frame.worldToLocal(temp.copy(hand.pinchPoint));
    temp.sub(this.forkLocal);
    const length = temp.length();
    if (length > SLINGSHOT.maxPull) temp.multiplyScalar(SLINGSHOT.maxPull / length);
    this.pouch.position.copy(this.forkLocal).add(temp);

    // Aim in boardLift space: the fork and the pull (pouch minus fork).
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
      this.setAimTarget(this.pickTarget(this.aimOrigin, this.aimVelocity, this.trace, true));
    } else {
      this.endAim();
    }
  }

  /** Works out the launch from a fork point and a pull vector (boardLift, cm). Sets aimValid. */
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
    const target = this.pickTarget(this.aimOrigin, this.aimVelocity, this.trace, true);
    const fire = this.pouchFire > 0 && !this.pouchKeg && !this.pouchCube && !this.pouchGoblin;
    const spicy = this.pouchCube && this.pouchSpicy;
    const [kind, goblin] = this.takeLoad();
    this.launch(this.aimOrigin, this.aimVelocity, target, kind, goblin, fire, spicy);
    this.audio.play('slingRelease', this.pouchWorld(temp));
    this.endAim();
    this.onEvent('shot');
  }

  /** Empties the pouch. Returns what flies: a pebble shot, or a goblin shot with its goblin. */
  private takeLoad(): [PebbleKind, Goblin | null] {
    const goblin = this.pouchGoblin;
    const cube = this.pouchCube;
    const keg = this.pouchKeg;
    this.loaded = false;
    this.pouchGoblin = null;
    this.pouchCube = false;
    this.pouchSpicy = false;
    this.pouchFire = 0;
    this.pouchKeg = false;
    if (this.pouchPebble) this.pouchPebble.visible = false;
    if (goblin) this.audio.play('squeal', this.pouchWorld(temp));
    if (keg) {
      // v3 2.6: the keg leaves the pouch and flies in the board (shown by updatePebbles).
      const mesh = this.pouchKegMesh;
      this.pouchKegMesh = null;
      if (mesh) {
        mesh.removeFromParent();
        mesh.rotation.set(0, 0, 0);
        // Board cm, like the pebbles: it is placed there each frame of its flight.
        this.stage.boardSpin.add(mesh);
      }
      this.kegFlying = mesh;
      return ['keg', null];
    }
    return goblin ? ['goblin', goblin] : cube ? ['cube', null] : ['shot', null];
  }

  /** The goblin in the pouch sits in it, wherever the slingshot goes (frame to board). */
  private placePouchGoblin(): void {
    const g = this.pouchGoblin;
    if (!g) return;
    this.toBoard(this.toRig(g.root.position.copy(this.pouch.position)));
    // Held in the pouch's cup at its middle, most of it in view above and below the strip.
    g.root.position.y -= g.stats.height * 0.45;
  }

  private cancelPull(): void {
    this.pouchHolder = null;
    this.endAim();
  }

  private launch(
    origin: Vector3,
    velocity: Vector3,
    target: Target | null,
    kind: PebbleKind,
    goblin: Goblin | null = null,
    fire = false,
    spicy = false,
  ): void {
    // A free slot, or else the landed pebble closest to going away.
    let pebble = this.pebbles.find((p) => !p.alive);
    if (!pebble) {
      let best: Pebble | undefined;
      for (const p of this.pebbles) if (p.rest >= 0 && (!best || p.rest < best.rest)) best = p;
      pebble = best;
    }
    if (!pebble) {
      // No free slot: a goblin shot must not stay stuck in held mode.
      if (goblin) this.goblins.drop(goblin);
      if (kind === 'keg') this.kegLanded(origin);
      return;
    }
    mark('pebble shot');
    pebble.alive = true;
    pebble.age = 0;
    pebble.rest = -1;
    pebble.rolling = false;
    pebble.kind = kind;
    pebble.fire = fire;
    pebble.spicy = spicy;
    pebble.goblin = goblin;
    pebble.position.copy(origin);
    pebble.velocity.copy(velocity);
    pebble.target = target;
    pebble.share = target ? this.targetShare(target) * (kind === 'thrown' ? PEBBLE_THROW.assist : 1) : 0;
  }

  private endAim(): void {
    this.aimValid = false;
    this.dots.visible = false;
    this.marker.visible = false;
    this.setAimTarget(null);
  }

  private setAimTarget(target: Target | null): void {
    if (target === this.aimTarget) return;
    const previous = this.aimTarget;
    this.aimTarget = target;
    if (previous && !(previous instanceof Goblin)) previous.setAimed(false);
    this.goblins.setAimed(target instanceof Goblin ? target : null);
    if (target && !(target instanceof Goblin)) target.setAimed(true);
  }

  /**
   * 3 and 4: the target on the predicted path, or else the best one in the
   * assist cone. `things`: also aim at things besides goblins.
   */
  private pickTarget(origin: Vector3, velocity: Vector3, trace: TraceResult, things: boolean): Target | null {
    if (trace.hit && (things || trace.hit instanceof Goblin)) return trace.hit;
    if (AIM_ASSIST.strength <= 0) return null;
    if (Math.hypot(velocity.x, velocity.z) < 1e-3) return null;
    const range = Math.hypot(trace.point.x - origin.x, trace.point.z - origin.z);
    let best: Target | null = null;
    let bestAngle = degToRad(AIM_ASSIST.coneDeg);
    for (const g of this.goblins.list) {
      const angle = this.coneAngle(g, origin, velocity, range);
      if (angle < bestAngle) {
        bestAngle = angle;
        best = g;
      }
    }
    if (things) {
      for (const t of this.things) {
        const angle = this.coneAngle(t, origin, velocity, range);
        if (angle < bestAngle) {
          bestAngle = angle;
          best = t;
        }
      }
    }
    return best;
  }

  /** Flat angle between a launch and a target, or Infinity when it cannot be a target. */
  private coneAngle(t: Target, o: Vector3, v: Vector3, range: number): number {
    if (!this.isTargetHittable(t) || this.targetShare(t) <= 0) return Infinity;
    this.targetCenter(t, center);
    const dx = center.x - o.x;
    const dz = center.z - o.z;
    const d = Math.hypot(dx, dz);
    if (d < 1 || d > range * 1.25) return Infinity;
    return Math.abs(Math.atan2(v.x * dz - v.z * dx, v.x * dx + v.z * dz));
  }

  private isTargetHittable(t: Target): boolean {
    // Lesson bait waits by a trigger: shots go past it, to the trigger.
    return t instanceof Goblin ? this.goblins.isHittable(t) && !t.bait : t.hittable();
  }

  /** Middle of a target (board space, cm). */
  private targetCenter(t: Target, out: Vector3): Vector3 {
    if (!(t instanceof Goblin)) return t.center(out);
    out.copy(t.root.position);
    out.y += t.stats.height * 0.5;
    return out;
  }

  private targetShare(t: Target): number {
    return t instanceof Goblin ? AIM_ASSIST.typeShare[t.type] : t.assist;
  }

  /** 2. Dots along the arc and the circle where it lands (board space). */
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

    const ground = this.trace.ground;
    this.marker.visible = ground !== null;
    if (ground !== null) {
      this.marker.position.set(this.trace.point.x, ground + AIM_ASSIST.markerLift, this.trace.point.z);
    }
  }

  /** Predicts a flight from a launch (board space): the first target hit, or where it lands. */
  private traceFlight(origin: Vector3, velocity: Vector3, out: TraceResult): void {
    const step = AIM_ASSIST.traceStep;
    const g = SLINGSHOT.gravity;
    const p = traceP.copy(origin);
    const v = traceV.copy(velocity);
    const next = traceNext;
    out.hit = null;
    out.ground = null;
    for (let t = 0; t < SLINGSHOT.maxFlight; t += step) {
      next.set(p.x + v.x * step, p.y + v.y * step - 0.5 * g * step * step, p.z + v.z * step);
      v.y -= g * step;
      const hit = this.hitAlong(p, next);
      if (hit) {
        out.hit = hit;
        out.time = t + step;
        out.point.copy(next);
        // The circle goes under the goblin's feet, or on the ground under the thing.
        if (hit instanceof Goblin) {
          out.point.x = hit.root.position.x;
          out.point.z = hit.root.position.z;
          out.ground = hit.root.position.y;
        } else {
          hit.center(out.point);
          out.ground = landingHeight(out.point.x, out.point.z) ?? out.point.y - hit.radius;
        }
        return;
      }
      if (this.landed(next)) {
        out.time = t + step;
        out.point.copy(next);
        // Past the edge of the board there is no ground to mark.
        if (Math.hypot(next.x, next.z) <= BOARD.outerRadius) out.ground = next.y;
        return;
      }
      p.copy(next);
    }
    out.time = SLINGSHOT.maxFlight;
    out.point.copy(p);
  }

  private updatePebbles(dt: number): void {
    const g = SLINGSHOT.gravity;
    // Endless Steady Aim: the pebbles turn toward their goblin a little more.
    const turnMax = degToRad(AIM_ASSIST.turnDegPerSec) * AIM_ASSIST.strength * BOOST.aim * dt;
    const cone = degToRad(AIM_ASSIST.coneDeg);
    for (let i = 0; i < this.pebbles.length; i++) {
      const pebble = this.pebbles[i];
      if (!pebble.alive) continue;
      pebble.age += dt;
      const p = pebble.position;
      const v = pebble.velocity;
      // Landed after a miss: it rolls on over the ground, slowing down, turning as it rolls.
      if (pebble.rolling) {
        const speed = Math.hypot(v.x, v.z);
        const slower = Math.max(0, speed - SLINGSHOT.rollFriction * dt);
        if (speed > 0) v.multiplyScalar(slower / speed);
        p.x += v.x * dt;
        p.z += v.z * dt;
        const ground = landingHeight(p.x, p.z);
        if (ground === null) {
          this.removePebble(i);
          continue;
        }
        p.y = ground + this.pebbleHeight / 2;
        // Rolling, not sliding: it turns its own size's worth for every step it moves.
        if (slower > 0) {
          rollAxis.set(v.z, 0, -v.x).normalize();
          rollTurn.setFromAxisAngle(rollAxis, (slower * dt) / (this.pebbleHeight / 2));
          pebble.spin.premultiply(rollTurn);
        }
        this.placeResting(i, pebble, 1);
        if (slower < SLINGSHOT.rollStop) {
          pebble.rolling = false;
          pebble.rest = SLINGSHOT.pebbleRest;
        }
        continue;
      }
      // Landed: it lies there a moment, then shrinks away (the shared despawn look).
      if (pebble.rest >= 0) {
        pebble.rest -= dt;
        const t = pebble.rest > 0 ? 0 : Math.min(1, -pebble.rest / SLINGSHOT.pebbleFade);
        if (t >= 1) {
          this.removePebble(i);
          continue;
        }
        this.placeResting(i, pebble, Math.max(0.001, shrinkAway(t)));
        continue;
      }
      // 4. Gentle bend toward the target while it stays in the cone.
      const target = pebble.target;
      if (target && this.isTargetHittable(target) && pebble.share > 0) {
        this.targetCenter(target, center);
        const dx = center.x - p.x;
        const dz = center.z - p.z;
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
      // Juice: a shot leaves a faint trail of puffs.
      if (pebble.kind === 'shot' || pebble.kind === 'goblin' || pebble.kind === 'cube' || pebble.kind === 'keg') {
        pebble.trail -= dt;
        if (pebble.trail <= 0) {
          pebble.trail = JUICE.pebbleTrailEvery;
          // v3 2.6: a burning pebble leaves a trail of flames.
          this.particles.burst(this.stage.boardSpin.localToWorld(temp2.copy(p)), pebble.fire ? FIRE_PEBBLE.flameColors : JUICE.pebbleTrailColors, 1, 0.01);
        }
      }
      temp.set(p.x + v.x * dt, p.y + v.y * dt - 0.5 * g * dt * dt, p.z + v.z * dt);
      v.y -= g * dt;
      const hit = pebble.kind === 'dropped' || pebble.kind === 'cube' ? null : this.hitAlong(p, temp, pebble.fire);
      if (hit) {
        p.copy(temp);
        this.strike(pebble, hit);
        this.removePebble(i);
        continue;
      }
      p.copy(temp);
      if (this.landed(p)) {
        if (pebble.kind === 'goblin') {
          this.splash(p, null, pebble.goblin!);
          this.removePebble(i);
          continue;
        }
        if (pebble.kind === 'cube') {
          // v3 2.2: a sugar cube becomes a lure where it lands.
          const ground = landingHeight(p.x, p.z);
          if (ground !== null) this.onCubeLanded(p.x, ground, p.z, pebble.spicy);
          this.removePebble(i);
          continue;
        }
        if (pebble.kind === 'keg') {
          this.kegLanded(p);
          this.removePebble(i);
          continue;
        }
        this.dust(p);
        // It stays where it fell for a couple of seconds.
        const ground = landingHeight(p.x, p.z);
        if (ground === null) {
          // Off the board's edge: nothing to lie on.
          this.removePebble(i);
          continue;
        }
        p.y = ground + this.pebbleHeight / 2;
        // It keeps some of its speed along the ground and rolls on (see above), so a miss feels real.
        // The rest timer counts only once it stops; while it rolls it is a landed pebble a new shot may take over.
        v.y = 0;
        v.x *= SLINGSHOT.rollKeep;
        v.z *= SLINGSHOT.rollKeep;
        pebble.rolling = true;
        pebble.rest = SLINGSHOT.pebbleRest;
        pebble.spin.setFromAxisAngle(UP, pebble.age * 12);
        pebble.target = null;
        this.placeResting(i, pebble, 1);
        continue;
      }
      if (pebble.age > SLINGSHOT.maxFlight || p.y < SLINGSHOT.killBelow) {
        if (pebble.goblin) this.goblins.kill(pebble.goblin);
        if (pebble.kind === 'keg') {
          this.kegFlying?.removeFromParent();
          this.kegFlying = null;
        }
        this.removePebble(i);
        continue;
      }
      if (pebble.kind === 'keg') {
        // v3 2.6: the flying keg tumbles along the pebble's path.
        if (this.kegFlying) {
          this.kegFlying.position.set(p.x, p.y - FLYING_KEG.height / 2, p.z);
          this.kegFlying.rotation.x = pebble.age * GOBLIN_SHOT.spin * 0.6;
        }
        continue;
      }
      if (pebble.goblin) {
        // A goblin shot: the goblin itself flies, tumbling.
        const g = pebble.goblin;
        g.root.position.set(p.x, p.y - g.stats.height * 0.5, p.z);
        g.root.rotation.x = pebble.age * GOBLIN_SHOT.spin;
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
    this.pebbles[index].rest = -1;
    this.pebbles[index].target = null;
    this.pebbles[index].goblin = null;
    this.pool.hide(index);
  }

  /** What a pebble does to the target it hit, by kind. */
  private strike(pebble: Pebble, hit: Target): void {
    const p = pebble.position;
    // v3 2.6 Package Deal: a flying keg blows up on whatever it hits.
    if (pebble.kind === 'keg') {
      this.kegLanded(p);
      return;
    }
    if (hit instanceof Goblin) {
      if (pebble.kind === 'thrown') this.bonk(hit, pebble.velocity);
      else if (pebble.kind === 'goblin') this.splash(p, hit, pebble.goblin!);
      else {
        // v3 2.6: a burning pebble on a goblin is a normal pebble plus a little smoke.
        if (pebble.fire) this.particles.burst(this.goblins.centerWorld(hit, temp2), FIRE_PEBBLE.smokeColors, 6, 0.06);
        this.knockOut(hit);
      }
      return;
    }
    // A thing: set off by a shot, a thrown pebble only bounces off it.
    if (pebble.kind === 'goblin') {
      hit.onHit('goblin');
      this.splash(p, null, pebble.goblin!);
      return;
    }
    // v3 2.6 Night Owl: a burning pebble lights what fire lights (kegs, haystacks).
    if (pebble.kind === 'shot' && pebble.fire && hit.lightable) {
      hit.onHit('fire');
      this.particles.burst(this.stage.boardSpin.localToWorld(temp2.copy(p)), FIRE_PEBBLE.flameColors, 8, 0.08);
      return;
    }
    if (pebble.kind === 'shot' && hit.hittable()) hit.onHit('shot');
    this.dust(p);
  }

  /** v3 2.6 Package Deal: the flying keg lands or hits at a board point: it is gone and the game blasts there. */
  private kegLanded(p: Vector3): void {
    this.kegFlying?.removeFromParent();
    this.kegFlying = null;
    this.onKegBlast(temp3.copy(p));
  }

  /** The blast radius of a flying keg (cm). */
  get kegBlastRadius(): number {
    return TRIGGERS.keg.blastRadius * FLYING_KEG.blastScale * BOOST.kegBlast;
  }

  /** 5. First target whose middle is within the hit area of the segment a to b (board space). v3 2.6: `fire` also hits lightable things. */
  private hitAlong(a: Vector3, b: Vector3, fire = false): Target | null {
    segment.copy(b).sub(a);
    const lengthSq = segment.lengthSq();
    let best: Target | null = null;
    let bestT = Infinity;
    for (const g of this.goblins.list) {
      if (!this.goblins.isHittable(g) || g.bait) continue;
      const t = this.touchAt(this.targetCenter(g, center), a, AIM_ASSIST.hitRadius + g.stats.height * 0.35, lengthSq);
      if (t < bestT) {
        bestT = t;
        best = g;
      }
    }
    for (const thing of this.things) {
      if (!thing.hittable() && !(fire && thing.lightable)) continue;
      const t = this.touchAt(thing.center(center), a, AIM_ASSIST.hitRadius + thing.radius, lengthSq);
      if (t < bestT) {
        bestT = t;
        best = thing;
      }
    }
    return best;
  }

  /** Where along `segment` from a (0 to 1) a point is within `reach`, or Infinity. */
  private touchAt(point: Vector3, a: Vector3, reach: number, lengthSq: number): number {
    toCenter.copy(point).sub(a);
    const t = lengthSq > 0 ? Math.min(1, Math.max(0, toCenter.dot(segment) / lengthSq)) : 0;
    const dx = toCenter.x - segment.x * t;
    const dy = toCenter.y - segment.y * t;
    const dz = toCenter.z - segment.z * t;
    return dx * dx + dy * dy + dz * dz < reach * reach ? t : Infinity;
  }

  /** True when a board point is on or under the ground (or past the edge). */
  private landed(p: Vector3): boolean {
    const r = Math.hypot(p.x, p.z);
    if (r > BOARD.outerRadius) return true;
    const ground = landingHeight(p.x, p.z);
    if (ground === null) return false;
    if (p.y <= ground) {
      p.y = ground;
      return true;
    }
    return false;
  }

  /** Every hit counts against armor (v2), a goblin shot too. */
  private knockOut(goblin: Goblin): void {
    this.goblins.worldPosition(goblin, temp2);
    // A helmet or shield takes the hit: it flies off and the goblin is knocked back (a hit for the lessons all the same).
    if (this.goblins.armor(goblin)) {
      // Endless Heavy Pebbles: the hit breaks more pieces.
      for (let i = 0; i < BOOST.pebbleGear; i++) this.goblins.armor(goblin);
      this.onHit(goblin);
      return;
    }
    this.goblins.cause = 'slingshot';
    this.goblins.kill(goblin, true);
    this.particles.burst(temp2, HIT_COLORS, 10);
    this.audio.play('pebbleHit', temp2);
    this.audio.play('poof', temp2, 1, 0.05);
    this.onHit(goblin);
  }

  /** A pebble thrown by hand: the goblin is knocked back along the throw, dazed. No damage. */
  private bonk(goblin: Goblin, velocity: Vector3): void {
    this.goblins.worldPosition(goblin, temp2);
    this.goblins.knockBack(goblin, velocity.x, velocity.z);
    this.particles.burst(temp2, DUST_COLORS, 5, 0.12);
    this.audio.play('pebbleHit', temp2, 0.7);
  }

  /**
   * A goblin shot lands (board point p): it knocks out the goblin it hit, if
   * any, knocks back the goblins around the impact, and poofs.
   */
  private splash(p: Vector3, hit: Goblin | null, shot: Goblin): void {
    // Its own copy: knockOut below reuses the shared scratch vectors.
    const at = splashAt.copy(p);
    let knocked = 0;
    if (hit && this.goblins.isHittable(hit)) {
      this.knockOut(hit);
      knocked++;
    }
    // v3 2.6 Goblin shot: the goblins right where it lands are knocked out, the ones around them flung back, dazed.
    const knock = GOBLIN_SHOT.knockRadius;
    const r = GOBLIN_SHOT.splashRadius;
    for (const g of this.goblins.list) {
      if (g === shot || !this.goblins.isHittable(g)) continue;
      const dx = g.root.position.x - at.x;
      const dy = g.root.position.y - at.y;
      const dz = g.root.position.z - at.z;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r || Math.abs(dy) >= r) continue;
      if (d2 < knock * knock) {
        this.knockOut(g);
        knocked++;
      } else this.goblins.knockBack(g, dx, dz, GOBLIN_SHOT.flingScale);
    }
    this.goblins.worldPosition(shot, temp2);
    this.goblins.kill(shot);
    this.particles.burst(temp2, HIT_COLORS, 16);
    this.audio.play('poof', temp2);
    this.onGoblinShot(knocked);
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
  /** Each band runs from its fork tip to its own end of the pouch. */
  private updateBands(): void {
    for (let i = 0; i < 2; i++) {
      const band = this.bands[i];
      const tip = this.tips[i];
      // tips[0] is on the -x side, like the pouch's left end.
      temp3.set(((i === 0 ? -1 : 1) * SLINGSHOT.pouchLength) / 2, 0, 0).applyQuaternion(this.pouch.quaternion);
      temp2.copy(this.pouch.position).add(temp3).sub(tip);
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
    // Board cm, sized by the reach check.
    return Math.hypot(temp2.x, temp2.y - y, temp2.z) * 0.01 * this.stage.boardScale;
  }

  /** The hand's pose as a world matrix: pinch point or palm, and the wrist turn. */
  private handWorldMatrix(hand: HandState, viaPinch: boolean, out: Matrix4): Matrix4 {
    return out.compose(viaPinch ? hand.pinchPoint : hand.palm, hand.quaternion, unitScale);
  }

  /** Frame point (cm) to boardLift point (cm). */
  private toRig(v: Vector3): Vector3 {
    this.frame.localToWorld(v);
    return this.stage.boardLift.worldToLocal(v);
  }

  /** boardLift point (cm) to boardSpin point (cm). */
  private toBoard(v: Vector3): Vector3 {
    this.stage.boardLift.localToWorld(v);
    return this.stage.boardSpin.worldToLocal(v);
  }

  // ---- Debug ----

  /** Debug: shoots a pebble from the bowl at the goblin closest to the front, without hands. */
  debugShoot(): void {
    if (this.pouchHolder) return;
    let load: [PebbleKind, Goblin | null] = ['shot', null];
    let fire = false;
    let spicy = false;
    if (this.loaded) {
      fire = this.pouchFire > 0 && !this.pouchKeg && !this.pouchCube && !this.pouchGoblin;
      spicy = this.pouchCube && this.pouchSpicy;
      load = this.takeLoad();
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
    this.launch(this.aimOrigin, this.aimVelocity, best, load[0], load[1], fire, spicy);
    this.audio.play('slingRelease', this.pouchWorld(temp));
    this.onEvent('shot');
  }

  /**
   * A landed pebble at its spot, turned by its spin around its middle (the
   * model rests on its bottom), at `size` (it shrinks away at the end).
   */
  private placeResting(index: number, pebble: Pebble, size: number): void {
    const p = pebble.position;
    restAt.set(0, (-this.pebbleHeight / 2) * size, 0).applyQuaternion(pebble.spin).add(p);
    restScale.setScalar(size);
    matrix.compose(restAt, pebble.spin, restScale);
    this.pool.set(index, matrix);
  }

  /** Debug: puts the goblin nearest the castle into the empty pouch without hands. */
  debugLoadGoblin(): void {
    if (this.loaded) {
      this.audio.play('locked', undefined, 1, 0.4);
      return;
    }
    let best: Goblin | null = null;
    let bestR = Infinity;
    for (const g of this.goblins.list) {
      if (!this.goblins.isHittable(g)) continue;
      const r = Math.hypot(g.root.position.x, g.root.position.z);
      if (r < bestR) {
        bestR = r;
        best = g;
      }
    }
    if (!best) {
      this.audio.play('locked', undefined, 1, 0.4);
      return;
    }
    this.goblins.grab(best);
    this.putGoblinInPouch(best);
  }

  /** Debug: puts a pebble in the pouch without hands. */
  debugLoad(): void {
    if (this.pouchGoblin) return;
    this.loaded = true;
    if (this.pouchPebble) this.pouchPebble.visible = true;
    this.audio.play('pebbleLoad', this.pouchWorld(temp));
  }

  /** Debug (v3 2.6 Night Owl): a burning pebble in the pouch, as if lit at the torch (counts as lighting one). */
  debugLoadFire(): void {
    if (this.loaded) return;
    this.debugLoad();
    this.pouchFire = FIRE_PEBBLE.burnTime;
    this.onFireLit();
  }

  /** Debug (v3 2.6 Package Deal): a keg on its stand by the bowl, then straight into the pouch. */
  debugLoadKeg(): void {
    if (this.loaded || !this.kegTemplate) return;
    if (!this.kegWaiting) this.addKeg();
    const keg = this.kegWaiting;
    if (!keg) return;
    this.kegWaiting = null;
    this.kegStand.visible = false;
    this.loaded = true;
    this.pouchKeg = true;
    this.pouchKegMesh = keg;
    this.pouch.add(keg);
    keg.position.set(0, -FLYING_KEG.height / 2, SLINGSHOT.pouchSag - 1);
    keg.rotation.set(Math.PI / 2, 0, 0);
    this.audio.play('pebbleLoad', this.pouchWorld(temp));
  }

  /** The easier fallback when the player is stuck: a full bowl and a pebble already in the pouch. */
  loadForPlayer(): void {
    this.debugBowl(true);
    if (!this.loaded) this.debugLoad();
  }

  /** Debug: empty or fill the bowl. */
  debugBowl(full: boolean): void {
    this.bowlCount = full ? PEBBLE_BOWL.capacity : 0;
    this.refillTimer = 0;
    this.updatePile();
  }
}
