// Troops (docs/core-loop.md section 2): the player's army. While a wave is
// fought, squads of 3 to 4 soldiers come out of the castle every few seconds
// (cap TROOPS.max), walk the road graph outward toward an attacking camp
// (the same roads as the goblins, in reverse), and fight the goblins they
// meet: both stop and trade simple timed hits. Soldiers take 2 hits, goblins
// 1. Runners rush past them. A soldier who reaches the camp, or is called
// back when the wave ends, walks home and goes back into the castle.
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
  Group,
  LoopOnce,
  LoopRepeat,
  Object3D,
  Vector3,
} from 'three';
import type { GameAudio } from '../audio/sound.js';
import { CASTLE, GOBLIN_RULES, TROOPS } from '../config/game.js';
import { mark } from '../debug/perfMarks.js';
import type { Particles } from '../fx/particles.js';
import type { Random } from '../rules/random.js';
import type { Step } from '../rules/roadGraph.js';
import { cloneSkinned, loadTemplate, type ModelTemplate } from '../world/models.js';
import type { RoadNetwork } from '../world/roads.js';
import type { Goblin, GoblinMode, Goblins } from './goblins.js';

type TroopMode = 'dead' | 'walking' | 'fighting';

/** Goblin modes a soldier can fight: on the field, on their feet. Never climbers on the wall, intruders or held goblins. */
const FIGHTABLE: ReadonlySet<GoblinMode> = new Set<GoblinMode>(['walking', 'toWall', 'atWall', 'dazed', 'fighting']);

const temp = new Vector3();

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

  constructor(
    template: ModelTemplate,
    private clips: AnimationClip[],
  ) {
    const model = cloneSkinned(template);
    model.scale.multiplyScalar(TROOPS.height);
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
  wait: number;
}

export class Troops {
  readonly list: Troop[] = [];
  private templates: ModelTemplate[] = [];
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
  ) {}

  async load(): Promise<void> {
    this.templates = await Promise.all([
      loadTemplate('characters/mini-arena/character-soldier.glb', { height: 1 }, true),
      loadTemplate('characters/mini-forest/character-archer.glb', { height: 1 }, true),
    ]);
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
      if (t.mode === 'dead') continue;
      this.release(t);
      t.outward = false;
    }
  }

  /** Everyone gone at once (a new battle, the stress test). */
  clear(): void {
    this.deployed = false;
    this.waiting.length = 0;
    for (const t of this.list) if (t.mode !== 'dead') this.remove(t, false);
  }

  /** Debug: a squad leaves now, toward a camp of the wave (or any camp). */
  sendSquad(): void {
    if (!this.on) this.on = true;
    const camps = this.camps.length > 0 ? this.camps : this.network.graph.camps;
    this.queueSquad(camps[this.rng.int(camps.length)]);
  }

  private queueSquad(camp: number): void {
    const size = TROOPS.squadMin + this.rng.int(TROOPS.squadMax - TROOPS.squadMin + 1);
    for (let i = 0; i < size; i++) this.waiting.push({ camp, wait: i * TROOPS.leaveGap });
  }

  update(dt: number): void {
    this.frame++;
    if (this.deployed) {
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
      if (w.wait <= 0 && this.aliveCount < TROOPS.max && this.spawn(w.camp)) this.waiting.splice(i, 1);
    }
    const far2 = TROOPS.farAnimFrom * TROOPS.farAnimFrom;
    for (let i = 0; i < this.list.length; i++) {
      const t = this.list[i];
      if (t.mode === 'dead') continue;
      if (t.mode === 'walking') this.walk(t, dt);
      else this.fight(t, dt);
      // Knocked down or gone home this frame.
      if ((t.mode as TroopMode) === 'dead') continue;
      t.animDt += dt;
      const p = t.root.position;
      if (p.x * p.x + p.z * p.z < far2 || (this.frame + i) % 2 === 0) {
        t.mixer.update(t.animDt);
        t.animDt = 0;
      }
    }
    // A goblin whose soldier is gone carries on, unless another soldier fights it.
    for (const g of this.goblins.list) {
      if (g.mode !== 'fighting') continue;
      const foe = g.foe as Troop | null;
      if (!foe || foe.mode !== 'fighting' || foe.foe !== g) this.goblins.endFight(g);
    }
  }

  private obtain(): Troop | null {
    let troop = this.list.find((t) => t.mode === 'dead') ?? null;
    if (!troop) {
      if (this.templates.length === 0) return null;
      // Archers for variety: same rules, another look. Picked once per soldier, by the seeded random.
      const template = this.rng.next() < TROOPS.archerShare ? this.templates[1] : this.templates[0];
      troop = new Troop(template, template.animations);
      mark('troop built');
      this.board.add(troop.root);
      this.list.push(troop);
    }
    return troop;
  }

  private spawn(camp: number): boolean {
    const toWall = this.network.graph.routeToWall(camp);
    if (toWall.length === 0) return true;
    const troop = this.obtain();
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
    troop.speed = TROOPS.speed * (1 + this.rng.range(-TROOPS.speedJitter, TROOPS.speedJitter));
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
    const foe = this.findFoe(t);
    if (foe) {
      this.engage(t, foe);
      return;
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

  /** The nearest goblin in reach on the field that can be fought. Runners rush past. */
  private findFoe(t: Troop): Goblin | null {
    const p = t.root.position;
    let best: Goblin | null = null;
    let bestD = TROOPS.engageRange * TROOPS.engageRange;
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

  /** Stops fighting and walks on. */
  private release(t: Troop): void {
    t.foe = null;
    if (t.mode === 'fighting') {
      t.mode = 'walking';
      t.play('walk', true, 1.2);
    }
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
    // Knocked out, with a poof.
    this.goblins.worldPosition(g, temp);
    this.particles.burst(temp, TROOPS.poofColors, 8);
    this.audio.play('poof', temp, 0.8, 0.05);
    this.goblins.kill(g);
    this.onKill(g);
    this.release(t);
  }

  private clash(at: Vector3): void {
    this.audio.play('swordClash', this.board.localToWorld(temp.copy(at)), 1, TROOPS.clashGap);
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
    t.root.visible = false;
  }
}
