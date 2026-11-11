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
import { mark } from '../debug/perfMarks.js';
import { addNightRim } from '../fx/nightRim.js';
import type { Particles } from '../fx/particles.js';
import { angleDelta, degToRad, groundAt, polarX, polarZ } from '../rules/boardMath.js';
import type { Random } from '../rules/random.js';
import type { Step } from '../rules/roadGraph.js';
import { cloneSkinned, loadTemplate, type ModelTemplate } from '../world/models.js';
import type { RoadNetwork } from '../world/roads.js';
import { knightBanner } from '../world/shapes.js';
import type { GearDebris } from '../fx/gearDebris.js';
import { strikeEvery, troopHitsToDown } from '../rules/gear.js';
import { findGearBones, rigTemplate, setGear } from './gear.js';
import type { Goblin, GoblinMode, Goblins } from './goblins.js';

/**
 * walking: on its route (out, or home). charging: a field knight sprinting
 * out. toPost: back to its spot after a fight. holding: at its junction.
 * The garrison modes are run by src/units/garrison.ts.
 */
export type TroopMode =
  | 'dead'
  | 'walking'
  | 'charging'
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

/** One horn call: its knights share the crash and the junction they hold. */
interface Squad {
  crashed: boolean;
  /** The junction's position (board, cm) and the way out from it (unit, flat). */
  readonly post: Vector3;
  readonly out: Vector3;
}

export class Troop {
  readonly root = new Group();
  readonly mixer: AnimationMixer;
  private actions = new Map<string, AnimationAction>();
  private current: AnimationAction | null = null;
  mode: TroopMode = 'dead';
  /** Roads from the wall entry out to the camp (each walked in its `dir`). */
  route: Step[] = [];
  leg = 0;
  /** Walking out toward the camp (true) or back home (false). */
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
  /** A field knight reached its junction (after a fight it walks back to its spot). */
  arrived = false;
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
  }

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

  /** The direction the current road is walked in right now. */
  get dir(): 1 | -1 {
    const step = this.route[this.leg];
    return this.outward ? step.dir : step.dir === 1 ? -1 : 1;
  }

  face(dx: number, dz: number): void {
    if (dx * dx + dz * dz > 1e-8) this.root.rotation.y = Math.atan2(dx, dz);
  }
}

interface Waiting {
  /** The roads from the wall entry out to the junction. */
  route: Step[];
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
    const feather = new BoxGeometry(0.04, 0.8, 1.4).translate(0, 0, -L / 2 + 0.7);
    const feather2 = new BoxGeometry(0.8, 0.04, 1.4).translate(0, 0, -L / 2 + 0.7);
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

  /** Debug: false keeps every soldier inside the castle (testing without help). Turning it off sends them all home. */
  private on = true;
  /** Kept for the battle (lessons set it). v2: no squads come out on their own, so it does nothing now. */
  held = false;
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

  /** The wave is over: knights still waiting stay in, and every field knight marches home. */
  recall(): void {
    this.waiting.length = 0;
    for (const t of this.list) {
      if (t.mode === 'dead' || t.mode === 'standing' || t.garrison) continue;
      this.release(t);
      this.marchHome(t);
    }
  }

  /** The wave was won: every soldier cheers for a moment (field knights then march home). */
  cheerAll(): void {
    for (const t of this.list) {
      if (t.mode === 'dead' || t.mode === 'standing' || t.mode === 'climbingUp') continue;
      this.release(t);
      if (!t.garrison) this.marchHome(t);
      this.cheer(t, JUICE.waveCheerTime);
    }
  }

  /** Everyone gone at once (a new battle, the stress test). The garrison stops refilling until manWalls(). */
  clear(): void {
    this.waiting.length = 0;
    for (const t of this.list) if (t.mode !== 'dead') this.remove(t, false);
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

  /**
   * The horn (v2): a squad of KNIGHTS.squadMin to squadMax swordsmen and
   * spearmen bursts out of the wall entry nearest `frontAngle` (the board
   * angle in front of the player, radians: spin the board to choose the
   * road) and sprints down that road to its first junction at least
   * KNIGHTS.holdMinRadius out. Returns false if no road leads out there.
   */
  charge(frontAngle: number): boolean {
    if (!this.on) this.on = true;
    const route = this.routeOut(frontAngle);
    if (route.length === 0) return false;
    const graph = this.network.graph;
    const last = route[route.length - 1];
    const node = graph.endOf(last);
    const squad: Squad = { crashed: false, post: new Vector3(), out: new Vector3() };
    this.network.nodePosition(node, squad.post);
    squad.out.set(squad.post.x, 0, squad.post.z).normalize();
    const room = Math.max(0, KNIGHTS.maxField - this.fieldCount);
    const size = Math.min(room, KNIGHTS.squadMin + this.rng.int(KNIGHTS.squadMax - KNIGHTS.squadMin + 1));
    for (let i = 0; i < size; i++) this.waiting.push({ route, squad, kind: this.pickFieldKind(), wait: i * KNIGHTS.leaveGap, slot: i });
    if (size > 0) {
      mark('knight charge');
      // The gate bursts open: a battle cry and dust at the wall entry.
      this.network.nodePosition(graph.roads[route[0].road][route[0].dir === 1 ? 'from' : 'to'], temp);
      this.board.localToWorld(temp);
      this.audio.play('swordClash', temp, 0.8);
      this.particles.burst(temp, TROOPS.poofColors, 10, 0.12);
    }
    return size > 0;
  }

  /** Debug "Send squad": the horn's charge down the road at this board angle. */
  sendSquad(frontAngle = 0): void {
    this.charge(frontAngle);
  }

  /**
   * The roads from the wall entry nearest `angle` out to the first junction
   * at least KNIGHTS.holdMinRadius from the center (or the last point before
   * a camp): at each point it takes the road to the point farthest out.
   */
  private routeOut(angle: number): Step[] {
    const graph = this.network.graph;
    let start = -1;
    let best = Infinity;
    graph.nodes.forEach((n, i) => {
      if (n.kind !== 'wall') return;
      const d = Math.abs(angleDelta(degToRad(n.at[1]), angle));
      if (d < best) {
        best = d;
        start = i;
      }
    });
    const route: Step[] = [];
    let here = start;
    for (let guard = 0; here >= 0 && guard < graph.nodes.length; guard++) {
      let next = -1;
      let road = -1;
      for (const r of graph.nodes[here].roads) {
        if (!graph.roads[r].open) continue;
        const other = graph.other(r, here);
        if (graph.nodes[other].kind === 'wall') continue;
        if (next < 0 || graph.nodes[other].at[0] > graph.nodes[next].at[0]) {
          next = other;
          road = r;
        }
      }
      if (next < 0 || graph.nodes[next].at[0] <= graph.nodes[here].at[0]) break;
      // Never on into a camp: they hold the point before it.
      if (graph.nodes[next].kind === 'camp') break;
      route.push({ road, dir: graph.roads[road].from === here ? 1 : -1 });
      here = next;
      if (graph.nodes[here].at[0] >= KNIGHTS.holdMinRadius) break;
    }
    return route;
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
    // A knight squad at the junction in front, the first with its banner.
    const route = this.routeOut(0);
    if (route.length === 0) return;
    this.network.nodePosition(this.network.graph.endOf(route[route.length - 1]), temp);
    for (let i = 0; i < knights; i++) {
      const troop = this.obtain(FIELD_KINDS[i % FIELD_KINDS.length]);
      if (!troop) return;
      stand(troop);
      troop.root.position.set(temp.x + (i - (knights - 1) / 2) * KNIGHTS.holdSpread, temp.y, temp.z);
      troop.face(temp.x, temp.z);
      if (i === 0) this.showBanner(troop);
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

  update(dt: number): void {
    this.frame++;
    for (let i = this.waiting.length - 1; i >= 0; i--) {
      const w = this.waiting[i];
      w.wait -= dt;
      // At the cap the knight waits inside the castle.
      if (w.wait <= 0 && this.aliveCount < TROOPS.max && this.spawn(w)) this.waiting.splice(i, 1);
    }
    const far2 = TROOPS.farAnimFrom * TROOPS.farAnimFrom;
    for (let i = 0; i < this.list.length; i++) {
      const t = this.list[i];
      if (t.mode === 'dead') continue;
      switch (t.mode) {
        case 'walking':
        case 'charging':
          this.walk(t, dt);
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
      t.animDt += dt;
      const p = t.root.position;
      if (p.x * p.x + p.z * p.z < far2 || (this.frame + i) % 2 === 0) {
        t.mixer.update(t.animDt);
        t.animDt = 0;
      }
    }
    // The wall garrison (src/units/garrison.ts) moves, shoots and fights on the rampart.
    this.onUpdate(dt);
    this.arrows.update(dt, (arrow) => this.arrowLands(arrow));
    // A goblin whose soldier is gone carries on, unless another soldier fights it.
    for (const g of this.goblins.list) {
      if (g.mode !== 'fighting') continue;
      const foe = g.foe as Troop | null;
      if (!foe || foe.mode !== 'fighting' || foe.foe !== g) this.goblins.endFight(g);
    }
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

  /** A knight bursts out of the gate and sprints down its road. */
  private spawn(w: Waiting): boolean {
    const troop = this.obtain(w.kind);
    if (!troop) return false;
    this.prepare(troop);
    troop.route = w.route;
    troop.squad = w.squad;
    troop.leg = 0;
    troop.outward = true;
    troop.mode = 'charging';
    troop.offset = this.rng.range(-TROOPS.laneJitter, TROOPS.laneJitter);
    troop.speed = TROOPS.speed * TROOP_KINDS[w.kind].speed * (1 + this.rng.range(-TROOPS.speedJitter, TROOPS.speedJitter));
    // Its own spot at the junction: two rows across the road, facing out.
    const out = w.squad.out;
    const row = w.slot % 3;
    const side = (row - 1) * KNIGHTS.holdSpread + (w.slot >= 3 ? KNIGHTS.holdSpread / 2 : 0);
    const back = w.slot >= 3 ? KNIGHTS.holdBack : 0;
    troop.post.set(w.squad.post.x - out.z * side - out.x * back, 0, w.squad.post.z + out.x * side - out.z * back);
    const road = this.network.roads[troop.route[0].road];
    troop.distance = troop.dir === 1 ? 0 : road.length;
    road.pointAt(troop.distance, troop.offset * troop.dir, troop.root.position);
    troop.play('sprint', true, KNIGHTS.sprintClipSpeed);
    // The first knight carries the squad's banner.
    if (w.slot === 0) this.showBanner(troop);
    // A small dust puff where they step out of the hidden gate.
    this.particles.burst(this.board.localToWorld(temp.copy(troop.root.position)), TROOPS.poofColors, 3, 0.08);
    return true;
  }

  private showBanner(t: Troop): void {
    if (!t.banner) {
      t.banner = knightBanner();
      // Over its left shoulder, in soldier units (the model is TROOPS.height tall).
      t.banner.position.set(0.9, 0, -0.6);
      t.root.add(t.banner);
    }
    t.banner.visible = true;
  }

  private walk(t: Troop, dt: number): void {
    // Everyone fights a goblin right next to them.
    const close = this.findFoe(t, TROOP_KINDS[t.kind].engageRange);
    if (close) {
      // A charging squad's first contact: the crash knocks several over (they get up dazed and are fought then).
      if (t.mode === 'charging' && t.squad && !t.squad.crashed) {
        this.crash(t, close);
        return;
      }
      this.engage(t, close);
      return;
    }
    const road = this.network.roads[t.route[t.leg].road];
    const dir = t.dir;
    const sprint = t.mode === 'charging' ? KNIGHTS.sprintScale : 1;
    t.distance += t.speed * sprint * dt * dir;
    road.pointAt(t.distance, t.offset * dir, t.root.position);
    road.directionAt(t.distance, temp);
    t.face(temp.x * dir, temp.z * dir);
    if (dir === 1 ? t.distance < road.length : t.distance > 0) return;
    // End of this road: the next one, or the junction they hold, or home.
    if (t.outward) {
      if (t.leg + 1 < t.route.length) this.startLeg(t, t.leg + 1);
      else {
        t.arrived = true;
        this.goToPost(t);
      }
    } else if (t.leg > 0) {
      this.startLeg(t, t.leg - 1);
    } else {
      this.remove(t, false);
    }
  }

  private startLeg(t: Troop, leg: number): void {
    t.leg = leg;
    t.distance = t.dir === 1 ? 0 : this.network.roads[t.route[leg].road].length;
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
    const close = this.findFoe(t, TROOP_KINDS[t.kind].engageRange);
    if (close) {
      this.engage(t, close);
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

  /** Holding the junction: fights anything that comes close. Runners hop past. */
  private hold(t: Troop): void {
    const foe = this.findFoe(t, KNIGHTS.holdRange);
    if (foe) {
      this.engage(t, foe);
      return;
    }
    const p = t.root.position;
    const r2 = KNIGHTS.dodgeRange * KNIGHTS.dodgeRange;
    for (const g of this.goblins.list) {
      if (g.type !== 'runner' || g.mode !== 'walking') continue;
      const q = g.root.position;
      const dx = q.x - p.x;
      const dz = q.z - p.z;
      if (dx * dx + dz * dz < r2) this.goblins.hop(g);
    }
  }

  /** A field knight turns for home along its route (the wave is over). */
  private marchHome(t: Troop): void {
    if (t.garrison || t.route.length === 0) return;
    if (t.arrived) {
      // From the junction: back onto the last road, at its far end.
      t.arrived = false;
      t.leg = t.route.length - 1;
      t.outward = false;
      const road = this.network.roads[t.route[t.leg].road];
      t.distance = t.route[t.leg].dir === 1 ? road.length : 0;
    }
    t.outward = false;
    if (t.mode !== 'cheering') {
      t.mode = 'walking';
      t.play('walk', true, 1.2);
    }
    if (t.banner) t.banner.visible = false;
  }

  /** After a cheer: a field knight goes back to what it was doing. */
  private afterCheer(t: Troop): void {
    if (t.garrison) {
      t.mode = 'guarding';
      t.play('idle');
    } else if (t.outward && t.arrived) this.goToPost(t);
    else {
      t.mode = t.outward && t.squad && !t.squad.crashed ? 'charging' : 'walking';
      t.play('walk', true, 1.2);
    }
  }

  /** The nearest goblin within `range` on the field that can be fought. Runners rush past, lesson goblins are left alone. */
  private findFoe(t: Troop, range: number): Goblin | null {
    const p = t.root.position;
    let best: Goblin | null = null;
    let bestD = range * range;
    for (const g of this.goblins.list) {
      if (g.type === 'runner' || !FIGHTABLE.has(g.mode) || this.goblins.isLesson(g)) continue;
      const q = g.root.position;
      if (q.x * q.x + q.z * q.z < CASTLE.wallOut * CASTLE.wallOut) continue;
      const dx = q.x - p.x;
      const dz = q.z - p.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = g;
      }
    }
    return best;
  }

  private engage(t: Troop, g: Goblin): void {
    t.mode = 'fighting';
    t.foe = g;
    t.strikeTimer = this.rng.range(0.3, 0.9);
    t.play('idle');
    const foe = g.foe as Troop | null;
    // The goblin fights back at the first soldier who came to it.
    if (g.mode !== 'fighting' || !foe || foe.mode !== 'fighting' || foe.foe !== g) this.goblins.startFight(g, t);
  }

  /** Stops fighting and goes on: a knight back to its spot or on its way, the garrison back on guard. */
  release(t: Troop): void {
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
    if (this.rng.next() >= TROOPS.strikeChance) return;
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
    if (t.banner) t.banner.visible = false;
    // Soldiers, like goblins, keep their poof (no shrink).
    t.root.visible = false;
  }
}

const ARCHER_DUST = [0xc9b79a, 0xa8957a];
const CLASH_SPARKS = [0xffffff, 0xffe9a8, 0xffd84a];
