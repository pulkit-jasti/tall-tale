// Troops (docs/core-loop.md section 2): the player's army. While a wave is
// fought, squads of soldiers come out of the castle every few seconds (cap
// TROOPS.max), walk the road graph outward toward an attacking camp (the
// same roads as the goblins, in reverse), and fight the goblins they meet.
// Soldiers take 2 hits, goblins 1 (a helmet is one more). Runners rush past
// them. A soldier who reaches the camp, or is called back when the wave
// ends, walks home and goes back into the castle.
//
// Three kinds since build step 7 (TROOP_KINDS): swordsmen (sword and round
// shield), spearmen (spear, tall shield and a kettle hat, a little more
// reach) and archers (bow and quiver, they stop and shoot arrows from range).
// Bodies from the Kenney packs, recolored to the kingdom's blue and gold, the
// gear merged into each body (src/units/gear.ts).
//
// The gate is hidden in the MVP (docs/assets.md): each squad leaves through
// the wall entry at the castle end of the shortest road from its camp, so
// troops can reach every camp even where the ring road has gaps.
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
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { GameAudio } from '../audio/sound.js';
import { ARCHERS, CASTLE, GOBLIN_RULES, JUICE, TROOP_KINDS, TROOPS, type TroopKind } from '../config/game.js';
import { mark } from '../debug/perfMarks.js';
import type { Particles } from '../fx/particles.js';
import type { Random } from '../rules/random.js';
import type { Step } from '../rules/roadGraph.js';
import { cloneSkinned, loadTemplate, type ModelTemplate } from '../world/models.js';
import type { RoadNetwork } from '../world/roads.js';
import { rigTemplate } from './gear.js';
import type { Goblin, GoblinMode, Goblins } from './goblins.js';

type TroopMode = 'dead' | 'walking' | 'fighting' | 'shooting' | 'cheering' | 'standing';

/** Goblin modes a soldier can fight: on the field, on their feet. Never climbers on the wall, intruders or held goblins. */
const FIGHTABLE: ReadonlySet<GoblinMode> = new Set<GoblinMode>(['walking', 'toWall', 'atWall', 'dazed', 'fighting']);

const KINDS: TroopKind[] = ['sword', 'spear', 'archer'];

const temp = new Vector3();
const temp2 = new Vector3();

class Troop {
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
  camp: number;
  kind: TroopKind;
  wait: number;
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
 * Arrows from the archers: one instanced mesh (shaft, steel tip, white
 * feathers in vertex colors), flying in a small arc. Pooled.
 */
class Arrows {
  readonly list: Arrow[] = [];
  private mesh: InstancedMesh;
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
    const shaft = new CylinderGeometry(0.06, 0.06, L, 4).rotateX(Math.PI / 2);
    const tip = new ConeGeometry(0.16, 0.4, 4).rotateX(Math.PI / 2).translate(0, 0, L / 2 + 0.15);
    const feather = new BoxGeometry(0.02, 0.32, 0.5).translate(0, 0, -L / 2 + 0.25);
    const feather2 = new BoxGeometry(0.32, 0.02, 0.5).translate(0, 0, -L / 2 + 0.25);
    const geometry = mergeGeometries([
      part(shaft, ARCHERS.shaftColor),
      part(tip, ARCHERS.tipColor),
      part(feather, ARCHERS.featherColor),
      part(feather2, ARCHERS.featherColor),
    ])!;
    this.mesh = new InstancedMesh(geometry, new MeshStandardMaterial({ vertexColors: true, roughness: 0.8, flatShading: true }), ARCHERS.poolSize);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    for (let i = 0; i < ARCHERS.poolSize; i++) {
      this.mesh.setMatrixAt(i, this.hidden);
      this.list.push({ alive: false, age: 0, from: new Vector3(), to: new Vector3(), target: null, serial: 0 });
    }
    parent.add(this.mesh);
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
      // A small arc: straight from bow to goblin, lifted in the middle.
      const lift = ARCHERS.arcHeight * 4 * t * (1 - t);
      temp.lerpVectors(a.from, a.to, t);
      temp.y += lift;
      // Facing along the flight (the arc's slope).
      temp2.subVectors(a.to, a.from);
      temp2.y += ARCHERS.arcHeight * 4 * (1 - 2 * t);
      this.quaternion.setFromUnitVectors(this.forward, temp2.normalize());
      this.matrix.makeRotationFromQuaternion(this.quaternion).setPosition(temp);
      this.mesh.setMatrixAt(i, this.matrix);
      this.dirty = true;
      if (t >= 1) {
        a.alive = false;
        this.mesh.setMatrixAt(i, this.hidden);
        land(a);
        a.target = null;
      }
    }
    if (this.dirty) this.mesh.instanceMatrix.needsUpdate = true;
    this.dirty = any;
    if (!any) this.mesh.visible = false;
  }

  clear(): void {
    for (let i = 0; i < this.list.length; i++) {
      this.list[i].alive = false;
      this.list[i].target = null;
      this.mesh.setMatrixAt(i, this.hidden);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.visible = false;
  }
}

export class Troops {
  readonly list: Troop[] = [];
  private templates = new Map<TroopKind, ModelTemplate>();
  private arrows: Arrows;
  /** Camps of the wave being fought (graph node indices). Squads take turns going to each. */
  private camps: number[] = [];
  private nextCamp = 0;
  private deployed = false;
  private squadTimer = 0;
  /** Soldiers of a squad waiting to leave the castle, one after the other. */
  private waiting: Waiting[] = [];
  private frame = 0;

  /** Debug: false keeps every soldier inside the castle (testing without help). Turning it off sends them all home. */
  private on = true;
  /** True while a lesson is taught: no new squads. The first one comes TROOPS.firstSquadAt after it ends. */
  held = false;

  get enabled(): boolean {
    return this.on;
  }
  set enabled(on: boolean) {
    this.on = on;
    if (!on) this.clear();
  }

  /** Called with each goblin a soldier knocks out. */
  onKill: (goblin: Goblin) => void = () => {};

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
        this.templates.set(kind, template);
      }),
    );
  }

  get aliveCount(): number {
    let count = 0;
    for (const t of this.list) if (t.mode !== 'dead') count++;
    return count;
  }

  /** A wave starts: squads go out toward these camps (blueprint ids) until recall(). */
  deploy(campIds: string[]): void {
    const graph = this.network.graph;
    this.camps = campIds.map((id) => graph.nodeIndex(id)).filter((c) => graph.routeToWall(c).length > 0);
    this.nextCamp = 0;
    this.deployed = this.on && this.camps.length > 0;
    this.squadTimer = TROOPS.firstSquadAt;
  }

  /** The wave is over: no more squads, and every soldier walks home. */
  recall(): void {
    this.deployed = false;
    this.waiting.length = 0;
    for (const t of this.list) {
      if (t.mode === 'dead' || t.mode === 'standing') continue;
      this.release(t);
      t.outward = false;
    }
  }

  /** The wave was won: every soldier on the field cheers for a moment (then walks home). */
  cheerAll(): void {
    for (const t of this.list) {
      if (t.mode === 'dead' || t.mode === 'standing') continue;
      this.release(t);
      this.cheer(t, JUICE.waveCheerTime);
    }
  }

  /** Everyone gone at once (a new battle, the stress test). */
  clear(): void {
    this.deployed = false;
    this.waiting.length = 0;
    for (const t of this.list) if (t.mode !== 'dead') this.remove(t, false);
    this.arrows.clear();
  }

  /** Debug: a squad leaves now, toward a camp of the wave (or any camp). */
  sendSquad(): void {
    if (!this.on) this.on = true;
    const camps = this.camps.length > 0 ? this.camps : this.network.graph.camps;
    this.queueSquad(camps[this.rng.int(camps.length)]);
  }

  /**
   * The stress test (src/debug/stressTest.ts): `count` soldiers of all three
   * kinds stand on the roads just outside the wall, walking on the spot (the
   * same cost as walking), and never fight or leave until clear().
   */
  standForTest(count: number): void {
    const roads = this.network.roads;
    if (roads.length === 0) return;
    for (let i = 0; i < count; i++) {
      const troop = this.obtain(KINDS[i % KINDS.length]);
      if (!troop) return;
      const road = roads[i % roads.length];
      road.pointAt(Math.min(road.length, 8 + (i * 7) % 30), 0, troop.root.position);
      troop.mode = 'standing';
      troop.foe = null;
      troop.root.visible = true;
      troop.root.rotation.y = this.rng.range(0, Math.PI * 2);
      troop.play('walk', true, 1.2);
    }
  }

  /** Squad members by kind share, picked with the seeded random. */
  private pickKind(): TroopKind {
    let total = 0;
    for (const k of KINDS) total += TROOP_KINDS[k].share;
    let pick = this.rng.next() * total;
    for (const k of KINDS) {
      pick -= TROOP_KINDS[k].share;
      if (pick <= 0) return k;
    }
    return 'sword';
  }

  private queueSquad(camp: number): void {
    const size = TROOPS.squadMin + this.rng.int(TROOPS.squadMax - TROOPS.squadMin + 1);
    for (let i = 0; i < size; i++) this.waiting.push({ camp, kind: this.pickKind(), wait: i * TROOPS.leaveGap });
  }

  update(dt: number): void {
    this.frame++;
    if (this.deployed && this.held) this.squadTimer = Math.max(this.squadTimer, TROOPS.firstSquadAt);
    else if (this.deployed) {
      this.squadTimer -= dt;
      if (this.squadTimer <= 0) {
        this.squadTimer = TROOPS.squadEvery;
        this.queueSquad(this.camps[this.nextCamp % this.camps.length]);
        this.nextCamp++;
      }
    }
    for (let i = this.waiting.length - 1; i >= 0; i--) {
      const w = this.waiting[i];
      w.wait -= dt;
      // At the cap the soldier waits inside the castle.
      if (w.wait <= 0 && this.aliveCount < TROOPS.max && this.spawn(w.camp, w.kind)) this.waiting.splice(i, 1);
    }
    const far2 = TROOPS.farAnimFrom * TROOPS.farAnimFrom;
    for (let i = 0; i < this.list.length; i++) {
      const t = this.list[i];
      if (t.mode === 'dead') continue;
      switch (t.mode) {
        case 'walking':
          this.walk(t, dt);
          break;
        case 'fighting':
          this.fight(t, dt);
          break;
        case 'shooting':
          this.shoot(t, dt);
          break;
        case 'cheering':
          t.timer -= dt;
          if (t.timer <= 0) {
            t.mode = 'walking';
            t.play('walk', true, 1.2);
          }
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

  private spawn(camp: number, kind: TroopKind): boolean {
    const toWall = this.network.graph.routeToWall(camp);
    if (toWall.length === 0) return true;
    const troop = this.obtain(kind);
    if (!troop) return false;
    mark('troop spawn');
    // The camp's route to the castle, walked backward: from the wall out to the camp.
    troop.route = toWall.reverse().map((s) => ({ road: s.road, dir: s.dir === 1 ? -1 : 1 }));
    troop.leg = 0;
    troop.outward = true;
    troop.mode = 'walking';
    troop.foe = null;
    troop.hits = 0;
    troop.animDt = 0;
    troop.offset = this.rng.range(-TROOPS.laneJitter, TROOPS.laneJitter);
    troop.speed = TROOPS.speed * TROOP_KINDS[kind].speed * (1 + this.rng.range(-TROOPS.speedJitter, TROOPS.speedJitter));
    const road = this.network.roads[troop.route[0].road];
    troop.distance = troop.dir === 1 ? 0 : road.length;
    road.pointAt(troop.distance, troop.offset * troop.dir, troop.root.position);
    troop.root.visible = true;
    troop.play('walk', true, 1.2);
    // A small dust puff where they step out of the hidden gate.
    this.particles.burst(this.board.localToWorld(temp.copy(troop.root.position)), TROOPS.poofColors, 3, 0.08);
    return true;
  }

  private walk(t: Troop, dt: number): void {
    // Everyone fights a goblin right next to them. Archers shoot the ones farther off.
    const close = this.findFoe(t, t.kind === 'archer' ? TROOPS.engageRange : TROOP_KINDS[t.kind].engageRange);
    if (close) {
      this.engage(t, close);
      return;
    }
    if (t.kind === 'archer' && t.outward) {
      const far = this.findFoe(t, TROOP_KINDS.archer.engageRange);
      if (far) {
        t.mode = 'shooting';
        t.foe = far;
        t.timer = this.rng.range(0.2, 0.6);
        t.play('idle');
        return;
      }
    }
    const road = this.network.roads[t.route[t.leg].road];
    const dir = t.dir;
    t.distance += t.speed * dt * dir;
    road.pointAt(t.distance, t.offset * dir, t.root.position);
    road.directionAt(t.distance, temp);
    t.face(temp.x * dir, temp.z * dir);
    if (dir === 1 ? t.distance < road.length : t.distance > 0) return;
    // End of this road: the next one, or turn around at the camp, or home.
    if (t.outward) {
      if (t.leg + 1 < t.route.length) this.startLeg(t, t.leg + 1);
      else t.outward = false;
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

  /** The nearest goblin within `range` on the field that can be fought. Runners rush past. */
  private findFoe(t: Troop, range: number): Goblin | null {
    const p = t.root.position;
    let best: Goblin | null = null;
    let bestD = range * range;
    for (const g of this.goblins.list) {
      if (g.type === 'runner' || !FIGHTABLE.has(g.mode)) continue;
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

  /** Stops fighting or shooting and walks on. */
  private release(t: Troop): void {
    t.foe = null;
    if (t.mode === 'fighting' || t.mode === 'shooting' || t.mode === 'cheering') {
      t.mode = 'walking';
      t.play('walk', true, 1.2);
    }
  }

  /** A short cheer (arms up), then on with the walk. */
  private cheer(t: Troop, seconds: number): void {
    t.foe = null;
    t.mode = 'cheering';
    t.timer = seconds;
    t.play('emote-yes', true, 1.3);
  }

  /** An archer: stands, faces its goblin and looses an arrow every ARCHERS.shootEvery while it stays in range. */
  private shoot(t: Troop, dt: number): void {
    const g = t.foe;
    const p = t.root.position;
    const range = TROOP_KINDS.archer.engageRange;
    if (!g || !FIGHTABLE.has(g.mode)) {
      this.release(t);
      return;
    }
    const q = g.root.position;
    const dx = q.x - p.x;
    const dz = q.z - p.z;
    const d2 = dx * dx + dz * dz;
    // Too close now: fight it. Gone out of range: walk on.
    if (d2 < TROOPS.engageRange * TROOPS.engageRange) {
      this.engage(t, g);
      return;
    }
    if (d2 > range * range * 1.2) {
      this.release(t);
      return;
    }
    t.face(dx, dz);
    t.timer -= dt;
    if (t.timer > 0) return;
    t.timer = ARCHERS.shootEvery * this.rng.range(0.85, 1.15);
    t.play('holding-left-shoot', false, 1.4);
    temp.set(p.x, p.y + TROOPS.height * 0.6, p.z);
    temp2.set(q.x, q.y + g.stats.height * 0.5, q.z);
    // Lead a walking goblin a little, so arrows land near it.
    if (g.mode === 'walking' || g.mode === 'toWall') {
      const s = g.speed * ARCHERS.flightTime;
      temp2.x += Math.sin(g.root.rotation.y) * s;
      temp2.z += Math.cos(g.root.rotation.y) * s;
    }
    if (this.arrows.fire(temp, temp2, g)) this.audio.play('slingRelease', this.board.localToWorld(temp), 0.35, 0.15);
  }

  /** An arrow arrives: it may knock the goblin out (a helmet takes one). A miss sticks in the ground with a puff. */
  private arrowLands(arrow: Arrow): void {
    const g = arrow.target;
    const at = arrow.to;
    const alive = g && g.serial === arrow.serial && FIGHTABLE.has(g.mode);
    const near = alive && g.root.position.distanceToSquared(at) < 16;
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
        g.strikeTimer = TROOPS.goblinStrikeEvery * this.rng.range(0.85, 1.15);
        this.goblins.strike(g);
        this.clash(q);
        if (this.rng.next() < TROOPS.goblinStrikeChance && ++t.hits >= TROOPS.hitsToDown) {
          this.remove(t, true);
          return;
        }
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

  private clash(at: Vector3): void {
    this.audio.play('swordClash', this.board.localToWorld(temp.copy(at)), 1, TROOPS.clashGap);
    // A few sparks where the blades meet.
    temp.y += 0.004;
    this.particles.burst(temp, CLASH_SPARKS, 2, 0.12);
  }

  /** A soldier leaves the board: knocked down (a poof), or home inside the castle. */
  private remove(t: Troop, knocked: boolean): void {
    if (knocked) {
      this.board.localToWorld(temp.copy(t.root.position));
      this.particles.burst(temp, TROOPS.poofColors, 8);
      this.audio.play('poof', temp, 0.7, 0.05);
    }
    if (t.foe && t.foe.foe === t) t.foe.foe = null;
    t.foe = null;
    t.mode = 'dead';
    // Soldiers, like goblins, keep their poof (no shrink).
    t.root.visible = false;
  }
}

const ARCHER_DUST = [0xc9b79a, 0xa8957a];
const CLASH_SPARKS = [0xffffff, 0xffe9a8, 0xffd84a];
