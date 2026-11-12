// Troops (v2, docs/v2-plan.md 2.7): the player's army, with two clear jobs.
//
// Field knights (KNIGHTS): only when the horn calls them. A squad of
// swordsmen and spearmen bursts out of the wall entry in front of the player
// and sprints down that road with a banner, crashes into the first goblins
// it meets (several knocked over, a hit stop), then holds the first junction
// out on that road and fights everything that comes, until it falls or the
// wave ends, then marches home. Runners dodge past with a quick hop.
//
// The wall garrison (src/units/garrison.ts): archers and guards on the
// rampart. It uses the same soldiers, arrows and fights as the knights.
//
// Three kinds (TROOP_KINDS): swordsmen (sword and round shield), spearmen
// (spear, tall shield and a kettle hat, a little more reach) and archers
// (bow and quiver, on the rampart only). Bodies from the Kenney packs,
// recolored to the kingdom's blue and gold, the gear merged into each body
// (src/units/gear.ts). Soldiers take 2 hits, a shield is one more; goblins
// take 1, a helmet and a shield one more each (src/rules/gear.ts).
//
// The gate is hidden (docs/assets.md): a squad leaves through the wall entry.
//
// All positions are in board units (cm) inside the turning board group.
import {
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  LoopOnce,
  LoopRepeat,
  Matrix4,
  type Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { GameAudio } from '../audio/sound.js';
import { ARCHERS, CASTLE, DAY_NIGHT, GARRISON, GOBLIN_GEAR, GOBLIN_RULES, JUICE, KNIGHTS, TROOP_KINDS, TROOPS, type GearName, type TroopKind } from '../config/game.js';
import { note } from '../debug/notes.js';
import { mark } from '../debug/perfMarks.js';
import { addNightRim } from '../fx/nightRim.js';
import type { Particles } from '../fx/particles.js';
import { degToRad, groundAt, polarX, polarZ } from '../rules/boardMath.js';
import type { Random } from '../rules/random.js';
import { legsToPoint, legsToWall, reverseLegs, type Leg, type RoadPoint } from '../rules/roadRoute.js';
import { cloneSkinned, loadTemplate, type ModelTemplate } from '../world/models.js';
import type { Road, RoadNetwork } from '../world/roads.js';
import { knightBanner } from '../world/shapes.js';
import type { GearDebris } from '../fx/gearDebris.js';
import { strikeEvery, troopHitsToDown } from '../rules/gear.js';
import { findGearBones, rigTemplate, setGear } from './gear.js';
import type { Goblin, GoblinMode, Goblins } from './goblins.js';

/**
 * walking: on its walk home. charging: a field knight sprinting along the
 * roads to its squad's spot. joining: stepping back onto the road before a
 * new walk (the squad was moved). toPost: to its own spot after arriving or
 * a fight. holding: at its spot, watching. The garrison modes are run by
 * src/units/garrison.ts.
 */
export type TroopMode =
  | 'dead'
  | 'walking'
  | 'charging'
  | 'joining'
  | 'toPost'
  | 'holding'
  | 'fighting'
  | 'cheering'
  | 'standing'
  | 'climbingUp'
  | 'guarding';

/** Goblin modes a field soldier can fight: on the field, on their feet. Never climbers on the wall, intruders or held goblins. */
export const FIGHTABLE: ReadonlySet<GoblinMode> = new Set<GoblinMode>(['walking', 'toWall', 'atWall', 'dazed', 'fighting']);

const KINDS: TroopKind[] = ['sword', 'spear', 'archer'];
/** Field knights are swordsmen and spearmen only (archers live on the rampart). */
const FIELD_KINDS: TroopKind[] = ['sword', 'spear'];

const temp = new Vector3();
const temp2 = new Vector3();
const handAt = new Vector3();
/** The left hand's spot on the left arm bone (model units, the same as GEAR's left hand gear). */
const LEFT_HAND_SPOT: [number, number, number] = [0.26, 0, 0.04];

/**
 * One squad of field knights: its members share the crash and the spot they
 * hold. A horn call at the squad limit moves the squad nearest the aimed
 * spot there (KNIGHTS.maxSquads).
 */
export interface Squad {
  crashed: boolean;
  /** The spot it holds: on a road (graph road, cm along), its board position, and the way it faces (unit, flat). */
  anchor: RoadPoint;
  readonly post: Vector3;
  readonly out: Vector3;
  /** Its knights (out on the board or still waiting at the gate). */
  readonly members: Troop[];
  /** Knights still waiting at the gate. */
  pending: number;
  /** Broke (too few left): its last knights march home. */
  broken: boolean;
}

export class Troop {
  readonly root = new Group();
  readonly mixer: AnimationMixer;
  private actions = new Map<string, AnimationAction>();
  private current: AnimationAction | null = null;
  mode: TroopMode = 'dead';
  /** The walk it is on (src/rules/roadRoute.ts): stretches of road, the one it is on, and cm along that road. */
  legs: Leg[] = [];
  leg = 0;
  /** Walking out to its squad's spot (true) or back home (false). */
  outward = true;
  distance = 0;
  offset = 0;
  speed = 0;
  foe: Goblin | null = null;
  strikeTimer = 0;
  hits = 0;
  attackRight = true;
  animDt = 0;
  /** Cheering after a knockout, or shooting: time left (seconds). */
  timer = 0;
  /** Its gear bones, and whether it still carries its shield (one extra hit, v2, src/rules/gear.ts). */
  readonly gear: Map<GearName, Object3D>;
  /** The shield this kind carries (none for archers). */
  readonly shieldName: GearName | null;
  shield = false;
  /** A field knight's squad, and its own spot at the junction (board, cm). Null for the garrison. */
  squad: Squad | null = null;
  readonly post = new Vector3();
  /** A field knight reached its squad's spot (after a fight it walks back to its own place there). */
  arrived = false;
  /** Walking up to the goblin it fights (it went for one seen from its spot). */
  closing = false;
  /** How long it has been walking up to its goblin without reaching it (seconds). */
  closeTime = 0;
  /** A goblin it could not reach: it leaves that one alone for `ignoreTime` seconds. */
  ignore: Goblin | null = null;
  ignoreTime = 0;
  /** How long it has been in a moving mode without moving (seconds), and where it was (the run-in-place watchdog). */
  stillTime = 0;
  readonly lastAt = new Vector3();
  /** The garrison: on the rampart (src/units/garrison.ts), its home angle and the angle it stands at now (radians). */
  garrison = false;
  home = 0;
  angle = 0;
  /** The squad's banner (only its first knight shows it), made the first time it is needed. */
  banner: Object3D | null = null;

  constructor(
    readonly kind: TroopKind,
    template: ModelTemplate,
    private clips: AnimationClip[],
  ) {
    const spec = TROOP_KINDS[kind];
    const model = cloneSkinned(template);
    // Small proportion changes per kind, so the three read apart.
    model.scale.set(spec.width, spec.height, spec.width).multiplyScalar(TROOPS.height);
    this.root.add(model);
    this.root.visible = false;
    this.mixer = new AnimationMixer(model);
    this.gear = findGearBones(model);
    this.shieldName = spec.gear.find((g) => g === 'roundShield' || g === 'rectShield') ?? null;
    this.handBone = model.getObjectByName('arm-left') ?? null;
  }

  /** The left arm's bone (the banner is held in that hand). */
  readonly handBone: Object3D | null;

  /** Fresh out of the castle: its shield back on. */
  rearm(): void {
    this.shield = this.shieldName !== null;
    if (this.shieldName) setGear(this.gear, this.shieldName, true);
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

  /** The direction the current stretch of road is walked in right now. */
  get dir(): 1 | -1 {
    const leg = this.legs[this.leg];
    return !leg || leg.to >= leg.from ? 1 : -1;
  }

  face(dx: number, dz: number): void {
    if (dx * dx + dz * dz > 1e-8) this.root.rotation.y = Math.atan2(dx, dz);
  }
}

interface Waiting {
  /** The walk from the wall entry out to the squad's spot. */
  legs: Leg[];
  squad: Squad;
  kind: TroopKind;
  wait: number;
  /** Its place in the squad (0 carries the banner). */
  slot: number;
}

interface Arrow {
  alive: boolean;
  age: number;
  readonly from: Vector3;
  readonly to: Vector3;
  target: Goblin | null;
  serial: number;
}

/**
 * Arrows from the garrison's archers (v2, ARCHERS): one instanced mesh
 * (shaft, steel tip, big white feathers in vertex colors) and one for the
 * light streaks behind them (see-through, unlit), flying in a high arc.
 * Pooled.
 */
export class Arrows {
  readonly list: Arrow[] = [];
  private mesh: InstancedMesh;
  private streaks: InstancedMesh;
  private matrix = new Matrix4();
  private quaternion = new Quaternion();
  private hidden = new Matrix4().makeScale(0, 0, 0);
  private forward = new Vector3(0, 0, 1);
  private dirty = false;

  constructor(parent: Object3D) {
    const L = ARCHERS.length;
    const color = new Color();
    const part = (g: BufferGeometry, hex: number): BufferGeometry => {
      for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
      color.setHex(hex);
      const n = g.getAttribute('position').count;
      const c = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) color.toArray(c, i * 3);
      g.setAttribute('color', new Float32BufferAttribute(c, 3));
      return g.index ? g.toNonIndexed() : g;
    };
    // Thicker than a real arrow at this length, so it reads from the seat.
    const shaft = new CylinderGeometry(0.12, 0.12, L, 4).rotateX(Math.PI / 2);
    const tip = new ConeGeometry(0.3, 0.8, 4).rotateX(Math.PI / 2).translate(0, 0, L / 2 + 0.3);
    const feather = new BoxGeometry(0.04, 0.7, 1.1).translate(0, 0, -L / 2 + 0.55);
    const feather2 = new BoxGeometry(0.7, 0.04, 1.1).translate(0, 0, -L / 2 + 0.55);
    const geometry = mergeGeometries([
      part(shaft, ARCHERS.shaftColor),
      part(tip, ARCHERS.tipColor),
      part(feather, ARCHERS.featherColor),
      part(feather2, ARCHERS.featherColor),
    ])!;
    this.mesh = new InstancedMesh(geometry, new MeshStandardMaterial({ vertexColors: true, roughness: 0.8, flatShading: true }), ARCHERS.poolSize);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    // The streak: a thin bright trail behind the feathers, narrowing to nothing.
    const streak = new ConeGeometry(0.22, ARCHERS.streakLength, 4, 1, true).rotateX(-Math.PI / 2).translate(0, 0, -L / 2 - ARCHERS.streakLength / 2);
    this.streaks = new InstancedMesh(
      streak,
      new MeshBasicMaterial({ color: ARCHERS.streakColor, transparent: true, opacity: ARCHERS.streakOpacity, depthWrite: false }),
      ARCHERS.poolSize,
    );
    this.streaks.frustumCulled = false;
    this.streaks.visible = false;
    for (let i = 0; i < ARCHERS.poolSize; i++) {
      this.mesh.setMatrixAt(i, this.hidden);
      this.streaks.setMatrixAt(i, this.hidden);
      this.list.push({ alive: false, age: 0, from: new Vector3(), to: new Vector3(), target: null, serial: 0 });
    }
    parent.add(this.mesh, this.streaks);
  }

  fire(from: Vector3, to: Vector3, target: Goblin): boolean {
    const arrow = this.list.find((a) => !a.alive);
    if (!arrow) return false;
    arrow.alive = true;
    arrow.age = 0;
    arrow.from.copy(from);
    arrow.to.copy(to);
    arrow.target = target;
    arrow.serial = target.serial;
    this.mesh.visible = true;
    this.streaks.visible = true;
    return true;
  }

  /** Moves the arrows. Calls `land` for each arrow that arrives. */
  update(dt: number, land: (arrow: Arrow) => void): void {
    let any = false;
    for (let i = 0; i < this.list.length; i++) {
      const a = this.list[i];
      if (!a.alive) continue;
      any = true;
      a.age += dt;
      const t = Math.min(1, a.age / ARCHERS.flightTime);
      // A high arc: straight from bow to goblin, lifted in the middle, so it rises against the sky.
      const lift = ARCHERS.arcHeight * 4 * t * (1 - t);
      temp.lerpVectors(a.from, a.to, t);
      temp.y += lift;
      // Facing along the flight (the arc's slope).
      temp2.subVectors(a.to, a.from);
      temp2.y += ARCHERS.arcHeight * 4 * (1 - 2 * t);
      this.quaternion.setFromUnitVectors(this.forward, temp2.normalize());
      this.matrix.makeRotationFromQuaternion(this.quaternion).setPosition(temp);
      this.mesh.setMatrixAt(i, this.matrix);
      this.streaks.setMatrixAt(i, this.matrix);
      this.dirty = true;
      if (t >= 1) {
        a.alive = false;
        this.mesh.setMatrixAt(i, this.hidden);
        this.streaks.setMatrixAt(i, this.hidden);
        land(a);
        a.target = null;
      }
    }
    if (this.dirty) {
      this.mesh.instanceMatrix.needsUpdate = true;
      this.streaks.instanceMatrix.needsUpdate = true;
    }
    this.dirty = any;
    if (!any) this.mesh.visible = this.streaks.visible = false;
  }

  clear(): void {
    for (let i = 0; i < this.list.length; i++) {
      this.list[i].alive = false;
      this.list[i].target = null;
      this.mesh.setMatrixAt(i, this.hidden);
      this.streaks.setMatrixAt(i, this.hidden);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.streaks.instanceMatrix.needsUpdate = true;
    this.mesh.visible = this.streaks.visible = false;
  }
}

export class Troops {
  readonly list: Troop[] = [];
  private templates = new Map<TroopKind, ModelTemplate>();
  readonly arrows: Arrows;
  /** Knights of a squad waiting to burst out of the gate, one after the other. */
  private waiting: Waiting[] = [];
  private frame = 0;
  /** The field squads out now (KNIGHTS.maxSquads at most). */
  readonly squads: Squad[] = [];
  /** Each road's length (cm), for routes. */
  private lengths: number[];
  /** Knights fighting each goblin this frame (knights spread to the least crowded one). Rebuilt every frame, no new map. */
  private fighters = new Map<Goblin, number>();
  /** The squad the horn would move now (its banner pulses), or null. */
  answering: Squad | null = null;

  /** Debug: false keeps every soldier inside the castle (testing without help). Turning it off sends them all home. */
  private on = true;
  /** Kept for the battle (lessons set it). v2: no squads come out on their own, so it does nothing now. */
  held = false;
  /** The squad the horn called or moved last (the horn lesson sends goblins at it). */
  private lastCalled: Squad | null = null;
  /** The tutorial runs: every horn call sends a full squad (KNIGHTS.squadMax). Set by the battle. */
  fullSquads = false;
  /** The tutorial sends every squad home after this long (seconds, negative: not asked). */
  private homeTimer = -1;
  /** Called when a battle starts: the wall garrison mans the rampart (src/units/garrison.ts). */
  onMan: () => void = () => {};
  /** Called on a squad's crash into the goblins, with the world point (juice: a hit stop and a ring). */
  onCrash: (world: Vector3) => void = () => {};
  /** Called every frame after the field troops moved (the wall garrison, src/units/garrison.ts). */
  onUpdate: (dt: number) => void = () => {};

  get enabled(): boolean {
    return this.on;
  }
  set enabled(on: boolean) {
    this.on = on;
    if (!on) this.clear();
  }

  /** Called with each goblin a soldier knocks out. */
  onKill: (goblin: Goblin) => void = () => {};
  /** Shields that fly off (set by the game). */
  debris: GearDebris | null = null;

  constructor(
    private board: Object3D,
    private network: RoadNetwork,
    private goblins: Goblins,
    private audio: GameAudio,
    private particles: Particles,
    private rng: Random,
  ) {
    this.arrows = new Arrows(board);
    this.lengths = network.roads.map((r) => r.length);
  }

  async load(): Promise<void> {
    await Promise.all(
      KINDS.map(async (kind) => {
        const spec = TROOP_KINDS[kind];
        const template = await loadTemplate(spec.body, { height: 1 }, true);
        await rigTemplate(template, spec.gear, spec.recolor);
        // A bright gold edge at night. Every soldier of this kind shares the template's materials.
        const materials = new Set<MeshStandardMaterial>();
        template.object.traverse((o) => {
          const mesh = o as Mesh;
          if (!mesh.isMesh) return;
          for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(m as MeshStandardMaterial);
        });
        for (const m of materials) addNightRim(m, DAY_NIGHT.rimTroop);
        this.templates.set(kind, template);
      }),
    );
  }

  get aliveCount(): number {
    let count = 0;
    for (const t of this.list) if (t.mode !== 'dead') count++;
    return count;
  }

  /** A wave starts. v2: no squads come out on their own any more (only the horn sends knights). */
  deploy(_campIds: string[]): void {}

  /** The wave is over. v2: the field squads stay where they are (they are the army in the field); only a new battle clears them. */
  recall(): void {}

  /**
   * The tutorial between waves: every field squad marches home once its
   * cheer is over (`after` seconds), so the next lesson's goblins are not
   * left alone by knights standing next to them (headset test: confusing).
   * In the real game squads stay between waves.
   */
  sendHome(after: number): void {
    this.homeTimer = after;
  }

  /** Every field squad breaks and marches home now; knights still waiting at the gate stay inside. */
  private allHome(): void {
    this.waiting.length = 0;
    for (const squad of this.squads) {
      squad.broken = true;
      for (const m of squad.members) {
        if (m.mode === 'dead' || m.squad !== squad) continue;
        m.squad = null;
        this.marchHome(m);
      }
    }
    this.squads.length = 0;
    this.answering = null;
    this.lastCalled = null;
  }

  /** The wave was won: every soldier cheers for a moment, then goes back to its spot. */
  cheerAll(): void {
    for (const t of this.list) {
      if (t.mode === 'dead' || t.mode === 'standing' || t.mode === 'climbingUp' || t.mode === 'walking') continue;
      this.release(t);
      this.cheer(t, JUICE.waveCheerTime);
    }
  }

  /** Everyone gone at once (a new battle, the stress test). The garrison stops refilling until manWalls(). */
  clear(): void {
    this.waiting.length = 0;
    for (const t of this.list) if (t.mode !== 'dead') this.remove(t, false);
    this.squads.length = 0;
    this.answering = null;
    this.homeTimer = -1;
    this.lastCalled = null;
    this.arrows.clear();
    this.onClear();
  }

  /** Called when every soldier was cleared away (the garrison stops). */
  onClear: () => void = () => {};

  /** A battle starts: the wall garrison stands on the rampart (full). */
  manWalls(): void {
    if (this.on) this.onMan();
  }

  /** Field knights on the board now (and waiting at the gate). */
  get fieldCount(): number {
    let count = this.waiting.length;
    for (const t of this.list) if (t.mode !== 'dead' && !t.garrison && t.mode !== 'standing') count++;
    return count;
  }

  /** The nearest spot on any road to a board point (x, z), and how far it is (cm). */
  roadPointNear(x: number, z: number): { point: RoadPoint; distance: number } {
    let road = 0;
    let best = Infinity;
    this.network.roads.forEach((r, i) => {
      const d = r.distanceTo(x, z);
      if (d < best) {
        best = d;
        road = i;
      }
    });
    return { point: { road, along: this.network.roads[road].nearestAlong(x, z) }, distance: best };
  }

  /** A road (for the horn's path). */
  road(index: number): Road {
    return this.network.roads[index];
  }

  /**
   * The way knights would go to a road spot (the horn's path once locked):
   * a new squad from the nearest wall entry, or at the squad limit the squad
   * that would move, from its spot. Null when none can get there.
   */
  previewLegs(target: RoadPoint): Leg[] | null {
    const plan = this.plan(target);
    if (!plan) return null;
    const graph = this.network.graph;
    if (plan.kind === 'move') return legsToPoint(graph, this.lengths, plan.squad.anchor, target);
    const home = legsToWall(graph, this.lengths, target);
    return home ? reverseLegs(home) : null;
  }

  /** A road spot's board position (cm, on the road). */
  roadPointPosition(point: RoadPoint, out: Vector3): Vector3 {
    return this.network.roads[point.road].pointAt(point.along, 0, out);
  }

  /** Squads that still count against KNIGHTS.maxSquads (not broken). */
  private get activeSquads(): Squad[] {
    return this.squads.filter((s) => !s.broken);
  }

  /**
   * What the horn would do for a road spot: send a new squad (under the
   * limit), or move the squad nearest it (at the limit). Null when no squad
   * can get there (every road to it is cut).
   */
  plan(target: RoadPoint): { kind: 'new' } | { kind: 'move'; squad: Squad } | null {
    const graph = this.network.graph;
    const active = this.activeSquads;
    if (active.length < KNIGHTS.maxSquads && this.fieldCount + KNIGHTS.squadMin <= KNIGHTS.maxField) {
      return legsToWall(graph, this.lengths, target) ? { kind: 'new' } : null;
    }
    let squad: Squad | null = null;
    let best = Infinity;
    const p = this.network.roads[target.road];
    p.pointAt(target.along, 0, temp);
    for (const s of active) {
      const d = s.post.distanceToSquared(temp);
      if (d < best && legsToPoint(graph, this.lengths, s.anchor, target)) {
        best = d;
        squad = s;
      }
    }
    return squad ? { kind: 'move', squad } : null;
  }

  /**
   * The horn sounds at a road spot (v2): under the squad limit a new squad of
   * KNIGHTS.squadMin to squadMax (random) swordsmen and spearmen bursts out
   * of the nearest wall entry and sprints there along the roads; at the
   * limit the squad nearest the spot goes there instead. Returns false if
   * nothing could go.
   */
  command(target: RoadPoint): boolean {
    if (!this.on) this.on = true;
    const plan = this.plan(target);
    if (!plan) return false;
    if (plan.kind === 'move') {
      this.moveSquad(plan.squad, target);
      this.lastCalled = plan.squad;
      return true;
    }
    const graph = this.network.graph;
    const home = legsToWall(graph, this.lengths, target);
    if (!home) return false;
    const legs = reverseLegs(home);
    const squad: Squad = { crashed: false, anchor: { ...target }, post: new Vector3(), out: new Vector3(), members: [], pending: 0, broken: false };
    this.placeSquad(squad, target);
    const room = Math.max(0, KNIGHTS.maxField - this.fieldCount);
    // In the tutorial a full squad comes (so its first fight is won); otherwise 3 to 5 at random.
    const size = Math.min(room, this.fullSquads ? KNIGHTS.squadMax : KNIGHTS.squadMin + this.rng.int(KNIGHTS.squadMax - KNIGHTS.squadMin + 1));
    if (size <= 0) return false;
    for (let i = 0; i < size; i++) this.waiting.push({ legs, squad, kind: this.pickFieldKind(), wait: i * KNIGHTS.leaveGap, slot: i });
    squad.pending = size;
    this.squads.push(squad);
    this.lastCalled = squad;
    mark('knight charge');
    // The gate bursts open: a battle cry and dust at the wall entry.
    this.network.roads[legs[0].road].pointAt(legs[0].from, 0, temp);
    this.board.localToWorld(temp);
    this.audio.play('swordClash', temp, 0.8);
    this.particles.burst(temp, TROOPS.poofColors, 10, 0.12);
    return true;
  }

  /** The squad the horn called or moved last, while it is still in the field. */
  private get calledSquad(): Squad | null {
    const squad = this.lastCalled;
    return squad && !squad.broken && this.squads.includes(squad) ? squad : null;
  }

  /** True while the squad called last is in the field. */
  get hasCalledSquad(): boolean {
    return this.calledSquad !== null;
  }

  /** The squad called last has reached its spot: none still at the gate, none on the way there. */
  get calledSquadReady(): boolean {
    const squad = this.calledSquad;
    if (!squad || squad.pending > 0) return false;
    return squad.members.every((t) => t.mode === 'dead' || (t.arrived && t.mode !== 'toPost'));
  }

  /**
   * The horn lesson's last beat (the first time the player sees the knights):
   * `count` plain grunts come down the road of the squad called last, from
   * `from` cm farther out, toward the castle, so they walk straight into it
   * and the knights fight them. Ordinary goblins (not lesson goblins), so the
   * knights take them on. Returns them (empty without a squad in the field).
   */
  sendGroupAt(count: number, from: number, gap: number): Goblin[] {
    const squad = this.calledSquad;
    if (!squad) return [];
    const { road: index, along } = squad.anchor;
    const road = this.network.roads[index];
    // Toward the castle along this road: the end nearer the middle.
    road.pointAt(0, 0, temp);
    const r0 = Math.hypot(temp.x, temp.z);
    road.pointAt(road.length, 0, temp);
    const dir: 1 | -1 = Math.hypot(temp.x, temp.z) < r0 ? 1 : -1;
    const sent: Goblin[] = [];
    for (let i = 0; i < count; i++) {
      const g = this.goblins.spawnBefore('grunt', index, dir, along, from + i * gap, ((i % 3) - 1) * 1.4);
      if (!g) continue;
      // They stop just in front of the squad (side by side, a little apart) and wait to be fought, so none walks past.
      g.holdRoad = index;
      g.holdAt = Math.max(0, Math.min(road.length, along - dir * (KNIGHTS.lessonHoldOut + i * 2.5)));
      sent.push(g);
    }
    return sent;
  }

  /** The squad is gone (it broke): the goblins sent at it walk on to the wall like any goblin. */
  releaseGroup(goblins: Goblin[]): void {
    for (const g of goblins) g.holdRoad = -1;
  }

  /** The squad's spot: its anchor on the road, the board point, and facing away from the castle along the road. */
  private placeSquad(squad: Squad, target: RoadPoint): void {
    squad.anchor.road = target.road;
    squad.anchor.along = target.along;
    const road = this.network.roads[target.road];
    road.pointAt(target.along, 0, squad.post);
    road.directionAt(target.along, temp);
    temp.y = 0;
    temp.normalize();
    // Facing the way goblins come from: away from the castle.
    if (temp.x * squad.post.x + temp.z * squad.post.z < 0) temp.negate();
    squad.out.copy(temp);
  }

  /** A knight's own spot in its squad: two rows across the road, facing out. */
  private placePost(t: Troop, squad: Squad, slot: number): void {
    const out = squad.out;
    const row = slot % 3;
    const side = (row - 1) * KNIGHTS.holdSpread + (slot >= 3 ? KNIGHTS.holdSpread / 2 : 0);
    const back = slot >= 3 ? KNIGHTS.holdBack : 0;
    t.post.set(squad.post.x - out.z * side - out.x * back, 0, squad.post.z + out.x * side - out.z * back);
    t.post.y = groundAt(t.post.x, t.post.z);
  }

  /** The horn at the squad limit: this squad marches along the roads to the new spot (a new crash there too). */
  private moveSquad(squad: Squad, target: RoadPoint): void {
    const legs = legsToPoint(this.network.graph, this.lengths, squad.anchor, target);
    if (!legs) return;
    this.placeSquad(squad, target);
    squad.crashed = false;
    // Knights of it still waiting at the gate go straight to the new spot.
    const fromWall = legsToWall(this.network.graph, this.lengths, target);
    if (fromWall) for (const w of this.waiting) if (w.squad === squad) w.legs = reverseLegs(fromWall);
    let slot = 0;
    for (const t of squad.members) {
      if (t.mode === 'dead' || t.squad !== squad) continue;
      // From where it is now: on its road if it is walking one, else the road spot nearest it.
      const walking = (t.mode === 'charging' || t.mode === 'walking') && t.legs[t.leg];
      const from = walking ? { road: t.legs[t.leg].road, along: t.distance } : this.roadPointNear(t.root.position.x, t.root.position.z).point;
      const own = legsToPoint(this.network.graph, this.lengths, from, target) ?? legs;
      this.release(t);
      this.placePost(t, squad, slot++);
      t.legs = own;
      t.leg = 0;
      t.distance = own[0].from;
      t.outward = true;
      t.arrived = false;
      // First a few steps back onto the road where the walk starts, then the sprint.
      t.mode = 'joining';
      t.play('sprint', true, KNIGHTS.sprintClipSpeed);
    }
    mark('knight charge');
    this.board.localToWorld(temp.copy(squad.post));
    this.audio.play('swordClash', temp, 0.6, 0.2);
  }

  /** Debug "Send knights": what the horn does, aimed at the road spot nearest the point this far out at this board angle. */
  charge(frontAngle: number, radius = 130): boolean {
    const near = this.roadPointNear(polarX(radius, frontAngle), polarZ(radius, frontAngle));
    return this.command(near.point);
  }

  /**
   * The stress test (src/debug/stressTest.ts, STRESS_TEST): the wall garrison
   * on the rampart and a knight squad at the junction in front, walking on
   * the spot (the same cost as walking), never fighting or leaving until clear().
   */
  standForTest(garrison: number, knights: number): void {
    const stand = (troop: Troop): void => {
      this.prepare(troop);
      troop.mode = 'standing';
      troop.play('walk', true, 1.2);
    };
    // The wall garrison on the rampart, guards first, then archers (GARRISON.homesDeg).
    for (let i = 0; i < Math.min(garrison, GARRISON.homesDeg.length); i++) {
      const troop = this.obtain(i < GARRISON.guards ? 'sword' : 'archer');
      if (!troop) return;
      stand(troop);
      const a = degToRad(GARRISON.homesDeg[i]);
      troop.root.position.set(polarX(GARRISON.radius, a), CASTLE.wallHeight, polarZ(GARRISON.radius, a));
      troop.face(polarX(1, a), polarZ(1, a));
    }
    // The knight squads (KNIGHTS.squadMax each) on roads around the board, each first knight with its banner.
    const squads = Math.ceil(knights / KNIGHTS.squadMax);
    for (let s = 0; s < squads; s++) {
      const a = (s / squads) * Math.PI * 2;
      const near = this.roadPointNear(polarX(130, a), polarZ(130, a)).point;
      this.network.roads[near.road].pointAt(near.along, 0, temp);
      const size = Math.min(KNIGHTS.squadMax, knights - s * KNIGHTS.squadMax);
      for (let i = 0; i < size; i++) {
        const troop = this.obtain(FIELD_KINDS[i % FIELD_KINDS.length]);
        if (!troop) return;
        stand(troop);
        troop.root.position.set(temp.x + (i - (size - 1) / 2) * KNIGHTS.holdSpread, temp.y, temp.z);
        troop.face(temp.x, temp.z);
        if (i === 0) this.showBanner(troop);
      }
    }
  }

  /** Field squad members, swordsmen and spearmen by their shares, picked with the seeded random. */
  private pickFieldKind(): TroopKind {
    let total = 0;
    for (const k of FIELD_KINDS) total += TROOP_KINDS[k].share;
    let pick = this.rng.next() * total;
    for (const k of FIELD_KINDS) {
      pick -= TROOP_KINDS[k].share;
      if (pick <= 0) return k;
    }
    return 'sword';
  }

  private time = 0;

  update(dt: number): void {
    this.frame++;
    this.time += dt;
    for (let i = this.waiting.length - 1; i >= 0; i--) {
      const w = this.waiting[i];
      w.wait -= dt;
      // At the cap the knight waits inside the castle.
      if (w.wait <= 0 && this.aliveCount < TROOPS.max && this.spawn(w)) this.waiting.splice(i, 1);
    }
    if (this.homeTimer >= 0) {
      this.homeTimer -= dt;
      if (this.homeTimer < 0) this.allHome();
    }
    // Knights on each goblin now (a free knight takes the least crowded goblin near it).
    this.fighters.clear();
    for (const t of this.list) {
      if (t.mode === 'fighting' && t.foe && !t.garrison) this.fighters.set(t.foe, (this.fighters.get(t.foe) ?? 0) + 1);
    }
    // What each squad sees, and the goblins that stop to fight a knight near them (KNIGHTS.senseRadius, goblinSense).
    this.senseThreats();
    this.stopNearKnights();
    const far2 = TROOPS.farAnimFrom * TROOPS.farAnimFrom;
    for (let i = 0; i < this.list.length; i++) {
      const t = this.list[i];
      if (t.mode === 'dead') continue;
      if (t.ignoreTime > 0) t.ignoreTime -= dt;
      switch (t.mode) {
        case 'walking':
        case 'charging':
          this.walk(t, dt);
          break;
        case 'joining':
          this.join(t, dt);
          break;
        case 'toPost':
          this.toPost(t, dt);
          break;
        case 'holding':
          this.hold(t);
          break;
        case 'fighting':
          if (!t.garrison) this.fight(t, dt);
          break;
        case 'cheering':
          t.timer -= dt;
          if (t.timer <= 0) this.afterCheer(t);
          break;
        default:
          break;
      }
      // Knocked down or gone home this frame.
      if ((t.mode as TroopMode) === 'dead') continue;
      if (!t.garrison) this.watchStuck(t, dt);
      t.animDt += dt;
      const p = t.root.position;
      if (p.x * p.x + p.z * p.z < far2 || (this.frame + i) % 2 === 0) {
        t.mixer.update(t.animDt);
        t.animDt = 0;
      }
      if (t.banner?.visible) {
        this.holdBanner(t);
        this.pulseBanner(t);
      }
    }
    // The wall garrison (src/units/garrison.ts) moves, shoots and fights on the rampart.
    this.onUpdate(dt);
    this.arrows.update(dt, (arrow) => this.arrowLands(arrow));
    // A goblin whose soldier is gone carries on, unless another soldier fights it. One that stopped for a
    // field knight near it (stopNearKnights) keeps waiting for it while that knight is up and near.
    const sense2 = (KNIGHTS.goblinSense * 1.5) ** 2;
    for (const g of this.goblins.list) {
      if (g.mode !== 'fighting') continue;
      const foe = g.foe as Troop | null;
      if (foe && foe.mode === 'fighting' && foe.foe === g) continue;
      if (foe && foe.mode !== 'dead' && !foe.garrison && foe.root.position.distanceToSquared(g.root.position) < sense2) continue;
      this.goblins.endFight(g);
    }
  }

  /** The goblins each squad sees now: every fightable one within KNIGHTS.senseRadius of any of its knights. */
  private threats = new Map<Squad, Goblin[]>();

  private senseThreats(): void {
    const r2 = KNIGHTS.senseRadius * KNIGHTS.senseRadius;
    const wall2 = CASTLE.wallOut * CASTLE.wallOut;
    for (const list of this.threats.values()) list.length = 0;
    for (const squad of this.squads) {
      let list = this.threats.get(squad);
      if (!list) this.threats.set(squad, (list = []));
      for (const g of this.goblins.list) {
        if (!FIGHTABLE.has(g.mode) || this.goblins.isLesson(g)) continue;
        const q = g.root.position;
        if (q.x * q.x + q.z * q.z < wall2) continue;
        for (const m of squad.members) {
          if (m.mode === 'dead' || m.squad !== squad) continue;
          if (m.root.position.distanceToSquared(q) <= r2) {
            list.push(g);
            break;
          }
        }
      }
    }
    // Squads that are gone.
    for (const squad of this.threats.keys()) if (!this.squads.includes(squad)) this.threats.delete(squad);
  }

  /**
   * Every goblin on the field near a field knight (KNIGHTS.goblinSense) stops
   * and turns to it, ready to fight, instead of walking past toward the
   * castle. Runners too. A knight of that squad takes it on soon (every
   * free knight goes for a goblin the squad sees).
   */
  private stopNearKnights(): void {
    const r2 = KNIGHTS.goblinSense * KNIGHTS.goblinSense;
    const wall2 = CASTLE.wallOut * CASTLE.wallOut;
    for (const g of this.goblins.list) {
      if ((g.mode !== 'walking' && g.mode !== 'toWall') || this.goblins.isLesson(g)) continue;
      const q = g.root.position;
      if (q.x * q.x + q.z * q.z < wall2) continue;
      let near: Troop | null = null;
      let best = r2;
      for (const t of this.list) {
        if (t.mode === 'dead' || t.garrison || t.mode === 'standing') continue;
        const d = t.root.position.distanceToSquared(q);
        if (d < best) {
          best = d;
          near = t;
        }
      }
      if (!near) continue;
      this.goblins.startFight(g, near);
      g.face(near.root.position.x - q.x, near.root.position.z - q.z);
    }
  }

  /**
   * The goblin a knight goes for. A knight of a squad: one its squad sees
   * (any goblin near any of its knights), the one with the fewest knights on
   * it, the nearest of those; at its spot, never one past its leash. A knight
   * on its own (marching home): one right next to it.
   */
  private squadFoe(t: Troop): Goblin | null {
    const squad = t.squad;
    if (!squad || squad.broken) return this.findFoe(t, TROOP_KINDS[t.kind].engageRange);
    const threats = this.threats.get(squad);
    if (!threats || threats.length === 0) return null;
    const p = t.root.position;
    const leash2 = KNIGHTS.leash * KNIGHTS.leash;
    let best: Goblin | null = null;
    let bestD = Infinity;
    let bestCount = Infinity;
    for (const g of threats) {
      if (!FIGHTABLE.has(g.mode)) continue;
      if (g === t.ignore && t.ignoreTime > 0) continue;
      const q = g.root.position;
      // The same leash fight() keeps, so a fight is never started and dropped in the same frame.
      if (t.arrived) {
        const lx = q.x - t.post.x;
        const lz = q.z - t.post.z;
        if (lx * lx + lz * lz > leash2) continue;
      }
      const d = (q.x - p.x) ** 2 + (q.z - p.z) ** 2;
      const count = (this.fighters.get(g) ?? 0) - (g === t.foe && t.mode === 'fighting' ? 1 : 0);
      if (count < bestCount || (count === bestCount && d < bestD)) {
        bestCount = count;
        bestD = d;
        best = g;
      }
    }
    return best;
  }

  private obtain(kind: TroopKind): Troop | null {
    let troop = this.list.find((t) => t.mode === 'dead' && t.kind === kind) ?? null;
    if (!troop) {
      const template = this.templates.get(kind);
      if (!template) return null;
      troop = new Troop(kind, template, template.animations);
      mark('troop built');
      this.board.add(troop.root);
      this.list.push(troop);
    }
    return troop;
  }

  /** Prepares a soldier fresh out of the castle (a knight or a garrison member). */
  prepare(t: Troop): void {
    mark('troop spawn');
    t.foe = null;
    t.hits = 0;
    t.rearm();
    t.animDt = 0;
    t.squad = null;
    t.arrived = false;
    t.garrison = false;
    t.root.visible = true;
    t.root.position.y = 0;
    if (t.banner) t.banner.visible = false;
  }

  /** A soldier of the given kind from the pool (built the first time), or null if the kind is not loaded. */
  take(kind: TroopKind): Troop | null {
    return this.obtain(kind);
  }

  /** A knight bursts out of the gate and sprints along the roads to its squad's spot. */
  private spawn(w: Waiting): boolean {
    const troop = this.obtain(w.kind);
    if (!troop) return false;
    this.prepare(troop);
    w.squad.pending = Math.max(0, w.squad.pending - 1);
    // A squad that broke or was cleared before this knight left: it stays in.
    if (w.squad.broken || !this.squads.includes(w.squad)) {
      troop.mode = 'dead';
      troop.root.visible = false;
      return true;
    }
    troop.squad = w.squad;
    w.squad.members.push(troop);
    troop.legs = w.legs;
    troop.leg = 0;
    troop.distance = w.legs[0].from;
    troop.outward = true;
    troop.mode = 'charging';
    troop.offset = this.rng.range(-TROOPS.laneJitter, TROOPS.laneJitter);
    troop.speed = TROOPS.speed * TROOP_KINDS[w.kind].speed * (1 + this.rng.range(-TROOPS.speedJitter, TROOPS.speedJitter));
    this.placePost(troop, w.squad, w.slot);
    const road = this.network.roads[w.legs[0].road];
    road.pointAt(troop.distance, troop.offset * troop.dir, troop.root.position);
    troop.play('sprint', true, KNIGHTS.sprintClipSpeed);
    // The first knight carries the squad's banner.
    if (w.slot === 0) this.showBanner(troop);
    // A small dust puff where they step out of the hidden gate.
    this.particles.burst(this.board.localToWorld(temp.copy(troop.root.position)), TROOPS.poofColors, 3, 0.08);
    return true;
  }

  /**
   * The first knight carries the banner in its left hand (its shield is put
   * away, the hand holds the pole). It used to stand beside the knight from
   * the ground, which looked like it floated and clipped (headset test).
   */
  private showBanner(t: Troop): void {
    if (!t.banner) {
      t.banner = knightBanner();
      t.root.add(t.banner);
    }
    if (t.shieldName) {
      t.shield = false;
      setGear(t.gear, t.shieldName, false);
    }
    t.banner.visible = true;
    // Fresh matrices (it just moved to the gate), so the first frame is already in the hand.
    t.root.updateMatrixWorld(true);
    this.holdBanner(t);
  }

  /**
   * Keeps the banner in the bearer's left hand: the pole goes through the
   * fist (KNIGHTS.bannerGrip above its foot) and stays upright, whatever the
   * arm does, the cloth trailing behind. The hand's point comes from the arm
   * bone of the last drawn frame, like the gear (GEAR's left hand spot).
   */
  private holdBanner(t: Troop): void {
    const banner = t.banner;
    const bone = t.handBone;
    if (!banner || !bone) return;
    bone.localToWorld(handAt.set(LEFT_HAND_SPOT[0], LEFT_HAND_SPOT[1], LEFT_HAND_SPOT[2]));
    t.root.worldToLocal(handAt);
    banner.position.set(handAt.x, handAt.y - KNIGHTS.bannerGrip, handAt.z);
  }

  private walk(t: Troop, dt: number): void {
    // On the way out, the squad fights every goblin it meets first, then walks on to its spot (the charge's crash
    // happens when the first knight reaches its goblin, in fight()). Marching home, only one right next to it.
    const foe = this.squadFoe(t);
    if (foe) {
      this.engage(t, foe);
      return;
    }
    const leg = t.legs[t.leg];
    if (!leg) {
      this.arrive(t);
      return;
    }
    const road = this.network.roads[leg.road];
    const dir = t.dir;
    const sprint = t.mode === 'charging' ? KNIGHTS.sprintScale : 1;
    t.distance += t.speed * sprint * dt * dir;
    const end = dir === 1 ? t.distance >= leg.to : t.distance <= leg.to;
    if (end) t.distance = leg.to;
    road.pointAt(t.distance, t.offset * dir, t.root.position);
    road.directionAt(t.distance, temp);
    t.face(temp.x * dir, temp.z * dir);
    if (!end) return;
    // End of this stretch: the next one, or the spot (out) or the wall entry (home).
    if (t.leg + 1 < t.legs.length) this.startLeg(t, t.leg + 1);
    else this.arrive(t);
  }

  private startLeg(t: Troop, leg: number): void {
    t.leg = leg;
    t.distance = t.legs[leg].from;
  }

  /** The end of a walk: out at the squad's spot, it takes its own place there; home, it goes back into the castle. */
  private arrive(t: Troop): void {
    if (!t.outward) {
      this.remove(t, false);
      return;
    }
    t.arrived = true;
    this.goToPost(t);
  }

  /** The squad was moved: a few steps straight back onto the road where its new walk starts, then the sprint. */
  private join(t: Troop, dt: number): void {
    const foe = t.outward ? this.squadFoe(t) : null;
    if (foe) {
      this.engage(t, foe);
      return;
    }
    const leg = t.legs[0];
    if (!leg) {
      this.arrive(t);
      return;
    }
    this.network.roads[leg.road].pointAt(leg.from, t.offset * t.dir, temp);
    const p = t.root.position;
    const dx = temp.x - p.x;
    const dz = temp.z - p.z;
    const d = Math.hypot(dx, dz);
    const step = t.speed * KNIGHTS.sprintScale * dt;
    if (d <= step) {
      t.mode = t.outward ? 'charging' : 'walking';
      t.leg = 0;
      t.distance = leg.from;
      return;
    }
    p.x += (dx / d) * step;
    p.z += (dz / d) * step;
    p.y = groundAt(p.x, p.z);
    t.face(dx, dz);
  }

  /**
   * The squad hits the goblins: the one met and those near it (up to
   * KNIGHTS.crashMax) are knocked over and back down the road, with a clash,
   * dust and a hit stop (onCrash).
   */
  private crash(t: Troop, first: Goblin): void {
    t.squad!.crashed = true;
    const at = first.root.position;
    const r2 = KNIGHTS.crashRadius * KNIGHTS.crashRadius;
    let count = 0;
    for (const g of this.goblins.list) {
      if (count >= KNIGHTS.crashMax || !FIGHTABLE.has(g.mode) || this.goblins.isLesson(g)) continue;
      const q = g.root.position;
      const dx = q.x - at.x;
      const dz = q.z - at.z;
      if (dx * dx + dz * dz > r2) continue;
      if (g.mode === 'fighting') this.goblins.endFight(g);
      // Away from the castle, the way the knights charge.
      this.goblins.knockBack(g, q.x, q.z);
      count++;
    }
    this.board.localToWorld(temp.copy(at));
    temp.y += 0.01 * TROOPS.height;
    this.audio.play('swordClash', temp, 1);
    this.audio.play('poof', temp, 0.8, 0.05);
    this.particles.burst(temp, CLASH_SPARKS, 8, 0.2);
    this.particles.burst(temp, ARCHER_DUST, 8, 0.15);
    this.onCrash(temp);
  }

  /** Walks to its own spot at the junction (after arriving, or after a fight there). */
  private goToPost(t: Troop): void {
    t.mode = 'toPost';
    t.play('walk', true, 1.4);
  }

  private toPost(t: Troop, dt: number): void {
    const foe = this.squadFoe(t);
    if (foe) {
      this.engage(t, foe);
      return;
    }
    const p = t.root.position;
    const dx = t.post.x - p.x;
    const dz = t.post.z - p.z;
    const d = Math.hypot(dx, dz);
    const step = t.speed * KNIGHTS.postSpeedScale * dt;
    if (d <= step) {
      p.x = t.post.x;
      p.z = t.post.z;
      t.mode = 'holding';
      t.play('idle');
      if (t.squad) t.face(t.squad.out.x, t.squad.out.z);
    } else {
      p.x += (dx / d) * step;
      p.z += (dz / d) * step;
      t.face(dx, dz);
    }
    p.y = groundAt(p.x, p.z);
  }

  /**
   * Run-in-place watchdog (headset test: knights kept running on the spot).
   * A field knight in a moving mode (walking up to a goblin, to its place, on
   * the road) that has not moved for KNIGHTS.stuckTime is put where it was
   * going, and the console says which mode it was in, to find the cause.
   */
  private watchStuck(t: Troop, dt: number): void {
    const p = t.root.position;
    const moving = t.mode === 'walking' || t.mode === 'charging' || t.mode === 'joining' || t.mode === 'toPost' || (t.mode === 'fighting' && t.closing);
    const dx = p.x - t.lastAt.x;
    const dz = p.z - t.lastAt.z;
    t.lastAt.copy(p);
    // dt is the units' time (a hit stop slows it), so a slowed knight builds up still time slowly too.
    if (!moving || dx * dx + dz * dz > 1e-4 || dt <= 0) {
      t.stillTime = 0;
      return;
    }
    t.stillTime += dt;
    if (t.stillTime < KNIGHTS.stuckTime) return;
    t.stillTime = 0;
    const foe = t.foe;
    note(
      `[troops] knight ran in place: ${t.mode}${t.closing ? ' closing' : ''}, arrived ${t.arrived}, leg ${t.leg}/${t.legs.length}` +
        (foe ? `, goblin ${foe.mode} ${Math.hypot(foe.root.position.x - p.x, foe.root.position.z - p.z).toFixed(1)} cm` : ''),
    );
    if (t.mode === 'fighting') {
      t.ignore = t.foe;
      t.ignoreTime = KNIGHTS.ignoreTime;
      this.release(t);
    } else if (t.mode === 'toPost') {
      p.copy(t.post);
      t.mode = 'holding';
      t.play('idle');
    } else if (t.mode === 'joining') {
      const leg = t.legs[0];
      if (!leg) this.arrive(t);
      else {
        t.mode = t.outward ? 'charging' : 'walking';
        t.leg = 0;
        t.distance = leg.from;
      }
    } else if (t.leg + 1 < t.legs.length) this.startLeg(t, t.leg + 1);
    else this.arrive(t);
  }

  /**
   * Holding its spot: it goes for any goblin its squad sees (near any of its
   * knights, inside its leash). Runners no longer hop past: every goblin near
   * a knight stops and fights (stopNearKnights).
   */
  private hold(t: Troop): void {
    const foe = this.squadFoe(t);
    if (foe) this.engage(t, foe);
  }

  /** A field knight of a broken squad walks home along the roads to the nearest wall entry and goes in. */
  private marchHome(t: Troop): void {
    if (t.garrison) return;
    this.release(t);
    const p = t.root.position;
    const near = this.roadPointNear(p.x, p.z).point;
    const legs = legsToWall(this.network.graph, this.lengths, near);
    if (!legs) {
      this.remove(t, false);
      return;
    }
    t.legs = legs;
    t.leg = 0;
    t.distance = legs[0].from;
    t.outward = false;
    t.arrived = false;
    // First back onto the road, then the walk home.
    t.mode = 'joining';
    t.play('walk', true, 1.2);
    if (t.banner) t.banner.visible = false;
  }

  /** The squad the horn would move: its bearer's banner pulses bigger and brighter while the horn is aimed. */
  private pulseBanner(t: Troop): void {
    const banner = t.banner!;
    const cloth = banner.userData.cloth as MeshBasicMaterial | undefined;
    if (t.squad && t.squad === this.answering) {
      const s = 1 + KNIGHTS.answerPulse * (0.5 + 0.5 * Math.sin(this.time * KNIGHTS.answerPulseSpeed));
      banner.scale.setScalar(s);
      cloth?.color.setHex(KNIGHTS.answerColor);
    } else if (banner.scale.x !== 1) {
      banner.scale.setScalar(1);
      cloth?.color.setHex(KNIGHTS.bannerColor);
    }
  }

  /** After a cheer: a field knight goes back to what it was doing. */
  private afterCheer(t: Troop): void {
    if (t.garrison) {
      t.mode = 'guarding';
      t.play('idle');
    } else if (t.outward && t.arrived) this.goToPost(t);
    else if (t.outward) {
      // Still on its way: back onto the road where it left it, then on with the sprint.
      t.mode = 'joining';
      t.legs = t.legs.slice(t.leg);
      if (t.legs.length > 0) t.legs[0] = { ...t.legs[0], from: t.distance };
      t.leg = 0;
      t.play('sprint', true, KNIGHTS.sprintClipSpeed);
    } else {
      t.mode = 'walking';
      t.play('walk', true, 1.2);
    }
  }

  /**
   * A goblin within `range` of a point (the knight, or its spot) on the
   * field that can be fought: the one with the fewest knights already on it,
   * the nearest of those. Runners rush past, lesson goblins are left alone.
   */
  private findFoe(t: Troop, range: number, from: Vector3 = t.root.position): Goblin | null {
    const p = from;
    let best: Goblin | null = null;
    let bestD = range * range;
    // Spread, no hard cap (headset test: with a cap of 2, extra knights stood idle and a goblin walked past):
    // the goblin with the fewest knights on it wins, the nearest of those. So knights split over a group,
    // and once every goblin is taken the rest still join in.
    let bestCount = Infinity;
    const range2 = range * range;
    // A knight at its spot only takes goblins inside its leash: fight() lets go of any farther one, so
    // taking it made an endless loop (headset test: a knight walking back to its spot met a goblin past
    // the leash, started a fight, let go the same frame, and again, frozen mid-run, the goblin frozen too).
    const leashed = t.arrived && !!t.squad;
    const leash2 = KNIGHTS.leash * KNIGHTS.leash;
    for (const g of this.goblins.list) {
      // Runners too (v2 run 2: no goblin runs past the knights).
      if (!FIGHTABLE.has(g.mode) || this.goblins.isLesson(g)) continue;
      if (g === t.ignore && t.ignoreTime > 0) continue;
      const q = g.root.position;
      if (q.x * q.x + q.z * q.z < CASTLE.wallOut * CASTLE.wallOut) continue;
      if (leashed) {
        const lx = q.x - t.post.x;
        const lz = q.z - t.post.z;
        if (lx * lx + lz * lz > leash2) continue;
      }
      const dx = q.x - p.x;
      const dz = q.z - p.z;
      const d = dx * dx + dz * dz;
      if (d > range2) continue;
      // Knights already on it, not counting this one.
      const count = (this.fighters.get(g) ?? 0) - (g === t.foe && t.mode === 'fighting' ? 1 : 0);
      if (count < bestCount || (count === bestCount && d < bestD)) {
        bestCount = count;
        bestD = d;
        best = g;
      }
    }
    return best;
  }

  private engage(t: Troop, g: Goblin): void {
    t.mode = 'fighting';
    t.foe = g;
    t.closing = false;
    t.closeTime = 0;
    this.fighters.set(g, (this.fighters.get(g) ?? 0) + 1);
    t.strikeTimer = this.rng.range(0.3, 0.9);
    t.play('idle');
    const foe = g.foe as Troop | null;
    // The goblin fights back at the first soldier who came to it.
    if (g.mode !== 'fighting' || !foe || foe.mode !== 'fighting' || foe.foe !== g) this.goblins.startFight(g, t);
  }

  /** Stops fighting and goes on: a knight back to its spot or on its way, the garrison back on guard. */
  release(t: Troop): void {
    // The goblin carries on at once if this knight was the one it fought (no frozen goblin left behind).
    const g = t.foe;
    if (g && g.mode === 'fighting' && g.foe === t) this.goblins.endFight(g);
    t.foe = null;
    if (t.mode === 'fighting' || t.mode === 'cheering') this.afterCheer(t);
  }

  /** A short cheer (arms up), then on with the walk. */
  cheer(t: Troop, seconds: number): void {
    t.foe = null;
    t.mode = 'cheering';
    t.timer = seconds;
    t.play('emote-yes', true, 1.3);
  }

  /** An arrow arrives: it may knock the goblin out (a helmet takes one). A miss sticks in the ground with a puff. */
  private arrowLands(arrow: Arrow): void {
    const g = arrow.target;
    const at = arrow.to;
    const alive = g && g.serial === arrow.serial && FIGHTABLE.has(g.mode);
    // Near where it was aimed (the goblin may have walked on during the long flight).
    const near = alive && g.root.position.distanceToSquared(at) < 36;
    this.board.localToWorld(temp.copy(at));
    if (!alive || !near || this.rng.next() >= ARCHERS.hitChance) {
      this.particles.burst(temp, ARCHER_DUST, 3, 0.08);
      return;
    }
    // An arrow is weaker than a blade: GARRISON.arrowsPerHit arrows make one hit. Until then it flinches.
    if (++g.arrowWounds < GARRISON.arrowsPerHit) {
      this.goblins.flash(g);
      this.audio.play('pebbleHit', temp, 0.4, 0.08);
      return;
    }
    g.arrowWounds = 0;
    if (this.goblins.armor(g, arrow.from.x, arrow.from.z)) return;
    this.goblins.worldPosition(g, temp);
    this.particles.burst(temp, TROOPS.poofColors, 8);
    this.audio.play('poof', temp, 0.8, 0.05);
    this.goblins.kill(g, true);
    this.onKill(g);
  }

  private fight(t: Troop, dt: number): void {
    const g = t.foe;
    if (!g || g.mode !== 'fighting') {
      this.release(t);
      return;
    }
    const p = t.root.position;
    const q = g.root.position;
    // Never farther than the leash from its spot: it lets go and walks back.
    if (t.arrived && t.squad) {
      const lx = q.x - t.post.x;
      const lz = q.z - t.post.z;
      if (lx * lx + lz * lz > KNIGHTS.leash * KNIGHTS.leash) {
        this.release(t);
        return;
      }
    }
    // Walks up to it if it is a step away (a fight joined from the spot), then fights.
    const dx = q.x - p.x;
    const dz = q.z - p.z;
    const gap = Math.hypot(dx, dz);
    const reach = TROOP_KINDS[t.kind].engageRange * 0.6;
    if (gap > reach) {
      // Safety net (headset test: knights ran in place next to a goblin, neither fighting): one that does not
      // reach its goblin in time gives up on it for a while, and the goblin carries on.
      t.closeTime += dt;
      if (t.closeTime > KNIGHTS.closeGiveUp) {
        note(`[troops] knight could not reach its goblin: gap ${gap.toFixed(1)} cm, reach ${reach.toFixed(1)}, goblin ${g.mode}, its foe ${g.foe === t ? 'this knight' : g.foe ? 'another' : 'none'}`);
        t.ignore = g;
        t.ignoreTime = KNIGHTS.ignoreTime;
        this.release(t);
        return;
      }
      // On the way out they run at it (the charge); at their spot they walk.
      const pace = t.arrived || !t.outward ? KNIGHTS.postSpeedScale : KNIGHTS.sprintScale;
      const step = Math.min(gap - reach, t.speed * pace * dt);
      p.x += (dx / gap) * step;
      p.z += (dz / gap) * step;
      p.y = groundAt(p.x, p.z);
      if (!t.closing) t.play('walk', true, 1.4);
      t.closing = true;
      t.face(dx, dz);
      return;
    }
    t.closeTime = 0;
    if (t.closing) {
      t.closing = false;
      t.play('idle');
    }
    // A charging squad's first contact: the crash knocks several over (they get up dazed and are fought then).
    if (t.squad && !t.squad.crashed && !t.arrived && t.outward) {
      this.crash(t, g);
      if (g.mode !== 'fighting') return;
    }
    t.face(q.x - p.x, q.z - p.z);
    // The goblin's foe was knocked down: this soldier takes its place.
    const foe = g.foe as Troop | null;
    if (!foe || foe.mode !== 'fighting' || foe.foe !== g) g.foe = t;
    // The goblin strikes back at its foe (not while stunned).
    if (g.foe === t && g.stunned <= 0) {
      g.face(p.x - q.x, p.z - q.z);
      g.strikeTimer -= dt;
      if (g.strikeTimer <= 0) {
        // A sword strikes faster (v2, src/rules/gear.ts).
        g.strikeTimer = strikeEvery(TROOPS.goblinStrikeEvery, g.weapon, GOBLIN_GEAR.swordStrikeScale) * this.rng.range(0.85, 1.15);
        this.goblins.strike(g);
        this.clash(q);
        if (this.rng.next() < TROOPS.goblinStrikeChance && this.hurt(t, q.x, q.z)) return;
      }
    }
    t.strikeTimer -= dt;
    if (t.strikeTimer > 0) return;
    t.strikeTimer = TROOPS.strikeEvery * this.rng.range(0.85, 1.15);
    t.attackRight = !t.attackRight;
    t.play(t.attackRight ? 'attack-melee-right' : 'attack-melee-left', false);
    this.clash(p);
    // Field knights land fewer blows than the guards (KNIGHTS.strikeChance), so a squad slows a group rather than wiping it.
    if (this.rng.next() >= KNIGHTS.strikeChance) return;
    // A helmet takes the blow: it flies off, the goblin reels back, and the fight goes on.
    if (this.goblins.armor(g, p.x, p.z)) {
      this.release(t);
      return;
    }
    // Knocked out, with a poof, and a little cheer.
    this.goblins.worldPosition(g, temp);
    this.particles.burst(temp, TROOPS.poofColors, 8);
    this.audio.play('poof', temp, 0.8, 0.05);
    this.goblins.kill(g, true);
    this.onKill(g);
    this.cheer(t, JUICE.troopCheerTime);
  }

  /**
   * A goblin's blow lands on a soldier (from board point fromX, fromZ): its
   * shield takes it first and flies off, then each blow counts toward
   * TROOPS.hitsToDown. Returns true when the soldier went down.
   */
  hurt(t: Troop, fromX: number, fromZ: number): boolean {
    const p = t.root.position;
    if (t.shield && t.shieldName) {
      t.shield = false;
      setGear(t.gear, t.shieldName, false);
      temp2.set(p.x, p.y + TROOPS.height * 0.5, p.z);
      this.debris?.throw(t.shieldName, temp2, p.x - fromX, p.z - fromZ);
      this.audio.play('pebbleHit', this.board.localToWorld(temp.copy(temp2)), 0.7, 0.05);
      return false;
    }
    // The shield is already counted above, so the base number of hits is left.
    if (++t.hits >= troopHitsToDown(TROOPS.hitsToDown, false)) {
      this.remove(t, true);
      return true;
    }
    return false;
  }

  private clash(at: Vector3): void {
    this.audio.play('swordClash', this.board.localToWorld(temp.copy(at)), 1, TROOPS.clashGap);
    // A few sparks where the blades meet.
    temp.y += 0.004;
    this.particles.burst(temp, CLASH_SPARKS, 2, 0.12);
  }

  /** A soldier leaves the board: knocked down (a poof), or home inside the castle. */
  remove(t: Troop, knocked: boolean): void {
    if (knocked) {
      this.board.localToWorld(temp.copy(t.root.position));
      this.particles.burst(temp, TROOPS.poofColors, 8);
      this.audio.play('poof', temp, 0.7, 0.05);
    }
    if (t.foe && t.foe.foe === t) t.foe.foe = null;
    t.foe = null;
    t.mode = 'dead';
    t.garrison = false;
    const carried = !!t.banner?.visible;
    if (t.banner) t.banner.visible = false;
    // Soldiers, like goblins, keep their poof (no shrink).
    t.root.visible = false;
    const squad = t.squad;
    t.squad = null;
    if (squad && knocked) this.lost(squad, carried);
  }

  /**
   * A knight of a squad went down: another takes up its banner, and a squad
   * down to KNIGHTS.breakAt knights breaks: the last of it march home and
   * its place is free for a new squad.
   */
  private lost(squad: Squad, banner: boolean): void {
    const left = squad.members.filter((m) => m.mode !== 'dead' && m.squad === squad);
    if (banner && left.length > 0) this.showBanner(left[0]);
    if (squad.broken || left.length + squad.pending > KNIGHTS.breakAt) return;
    squad.broken = true;
    const i = this.squads.indexOf(squad);
    if (i >= 0) this.squads.splice(i, 1);
    if (this.answering === squad) this.answering = null;
    for (const m of left) {
      m.squad = null;
      this.marchHome(m);
    }
  }
}

const ARCHER_DUST = [0xc9b79a, 0xa8957a];
const CLASH_SPARKS = [0xffffff, 0xffe9a8, 0xffd84a];
