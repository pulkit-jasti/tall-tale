// Sends a wave's enemies out of their camps in small groups (docs/core-loop.md):
// a camp rumbles a few seconds before each group, then the goblins come out
// one by one. Group times follow a gentle curve: calm at first, a push at the
// end. Camps sink a little as their enemies come out. The director only says
// which wave to start and how fast (half speed while it waits for the player).
import { Object3D, Vector3 } from 'three';
import type { GameAudio } from '../audio/sound.js';
import { WAVES, type GoblinType } from '../config/game.js';
import type { WavePlan } from '../director/tutorial.js';
import type { Random } from '../rules/random.js';
import type { RoadNetwork } from '../world/roads.js';
import type { Goblins } from './goblins.js';

interface Group {
  /** A goblin type, or a balloon with riders (src/units/balloons.ts). */
  type: GoblinType | 'balloon';
  /** Graph node index of the camp. */
  camp: number;
  count: number;
  /** When the camp rumbles (seconds of wave time). The goblins follow after WAVES.rumbleLead. */
  at: number;
  rumbled: boolean;
  /** Goblins of this group already out. */
  out: number;
  /** Time until the next one comes out. */
  wait: number;
}

interface CampState {
  planned: number;
  out: number;
}

const temp = new Vector3();

export class WaveSpawner {
  /** Spawn speed share, set by the director (0.5 while a step waits for the player). */
  rate = 1;
  /** Balloons wait while this is true (the first balloon wave holds them until its banner shows). */
  balloonsHeld = false;
  /** Sends one balloon from a camp (graph node). False when it cannot come yet (all balloons out, unit cap). */
  onBalloon: (camp: number) => boolean = () => true;
  private groups: Group[] = [];
  private time = 0;
  private active = false;
  private camps = new Map<number, CampState>();
  private campIds: Map<string, number>;

  constructor(
    private board: Object3D,
    private network: RoadNetwork,
    private goblins: Goblins,
    private hills: Map<string, Object3D>,
    private audio: GameAudio,
    private rng: Random,
  ) {
    this.campIds = new Map(network.graph.camps.map((i) => [network.graph.nodes[i].id, i]));
  }

  /** A new map (src/game.ts loadMap): its roads, its camps and their hills. Stops any wave first. */
  setMap(network: RoadNetwork, hills: Map<string, Object3D>): void {
    this.stop();
    this.network = network;
    this.hills = hills;
    this.campIds = new Map(network.graph.camps.map((i) => [network.graph.nodes[i].id, i]));
  }

  /** Plans and starts a wave. */
  start(plan: WavePlan): void {
    this.stop();
    this.active = true;
    const campNodes = plan.camps.map((id) => {
      const node = this.campIds.get(id);
      if (node === undefined) throw new Error(`[waves] unknown camp ${id}`);
      return node;
    });
    for (const camp of campNodes) this.camps.set(camp, { planned: 0, out: 0 });
    // Split the counts into groups, then shuffle them with the seeded random.
    const sizes: Record<GoblinType, number> = { grunt: WAVES.gruntGroup, runner: WAVES.runnerGroup };
    for (let k = 0; k < (plan.balloons ?? 0); k++) {
      this.groups.push({ type: 'balloon', camp: this.pickCamp(campNodes), count: 1, at: 0, rumbled: false, out: 0, wait: 0 });
    }
    for (const type of ['grunt', 'runner'] as GoblinType[]) {
      let left = plan.counts[type];
      while (left > 0) {
        const count = Math.min(sizes[type], left);
        left -= count;
        this.groups.push({ type, camp: this.pickCamp(campNodes), count, at: 0, rumbled: false, out: 0, wait: 0 });
      }
    }
    for (let i = this.groups.length - 1; i > 0; i--) {
      const j = this.rng.int(i + 1);
      [this.groups[i], this.groups[j]] = [this.groups[j], this.groups[i]];
    }
    // Group times along the intensity curve, with a little jitter.
    const n = this.groups.length;
    const window = Math.max(0, plan.spawnTime - WAVES.firstGroupAt);
    const gap = n > 1 ? window / (n - 1) : 0;
    this.groups.forEach((group, i) => {
      const x = n > 1 ? i / (n - 1) : 0;
      const jitter = i === 0 ? 0 : this.rng.range(-WAVES.jitter, WAVES.jitter) * gap;
      group.at = Math.max(0, WAVES.firstGroupAt + window * Math.pow(x, WAVES.curve) + jitter);
      if (group.type !== 'balloon') this.camps.get(group.camp)!.planned += group.count;
    });
    this.groups.sort((a, b) => a.at - b.at);
    this.updateHills();
  }

  /** Stops spawning. Camps fill up again. */
  stop(): void {
    this.active = false;
    this.groups.length = 0;
    this.camps.clear();
    this.time = 0;
    this.updateHills();
  }

  /** How many enemies of this wave came out so far. */
  get spawned(): number {
    let n = 0;
    for (const g of this.groups) n += g.out;
    return n;
  }

  /** True when every planned enemy came out (or the wave was stopped). */
  get allOut(): boolean {
    return this.groups.every((g) => g.out >= g.count);
  }

  get running(): boolean {
    return this.active;
  }

  /**
   * The camps sending right now (graph node indices, into `out`): a group's
   * drums have started and some of it is still to come out. For the compass
   * ring's early warning (src/ui/compass.ts). No garbage: `out` is reused.
   */
  sendingCamps(out: number[]): number[] {
    out.length = 0;
    if (!this.active) return out;
    for (const g of this.groups) {
      if (g.type === 'balloon' || !g.rumbled || g.out >= g.count || out.includes(g.camp)) continue;
      out.push(g.camp);
    }
    return out;
  }

  /** Enemies of this wave still to come out (a balloon counts its `riders`). */
  waiting(riders: number): number {
    let n = 0;
    for (const g of this.groups) n += (g.count - g.out) * (g.type === 'balloon' ? riders : 1);
    return n;
  }

  update(dt: number): void {
    if (!this.active) return;
    this.time += dt * this.rate;
    for (const group of this.groups) {
      if (group.out >= group.count) continue;
      if (group.type === 'balloon') {
        // Balloons float straight in from their camp: no rumble, no road.
        if (this.time < group.at || this.balloonsHeld) continue;
        if (this.onBalloon(group.camp)) group.out++;
        continue;
      }
      if (!group.rumbled) {
        if (this.time < group.at) continue;
        group.rumbled = true;
        group.wait = WAVES.rumbleLead;
        this.network.nodePosition(group.camp, temp);
        this.audio.play('campRumble', this.board.localToWorld(temp));
      }
      group.wait -= dt * this.rate;
      if (group.wait > 0) continue;
      // At the unit cap the goblin waits in the camp and tries again next frame.
      if (!this.goblins.spawnAtCamp(group.type, group.camp)) continue;
      group.out++;
      group.wait = WAVES.groupGap;
      this.camps.get(group.camp)!.out++;
      this.updateHills();
    }
  }

  /** Bigger camp, more enemies: camps are picked weighted by their size. */
  private pickCamp(camps: number[]): number {
    const nodes = this.network.graph.nodes;
    let total = 0;
    for (const c of camps) total += nodes[c].size;
    let pick = this.rng.next() * total;
    for (const c of camps) {
      pick -= nodes[c].size;
      if (pick <= 0) return c;
    }
    return camps[camps.length - 1];
  }

  /** Each camp sinks a little as its enemies of this wave come out, so it shows how many are left. */
  private updateHills(): void {
    const nodes = this.network.graph.nodes;
    for (const [id, hill] of this.hills) {
      const node = this.campIds.get(id)!;
      const state = this.camps.get(node);
      const share = state && state.planned > 0 ? state.out / state.planned : 0;
      const size = nodes[node].size;
      hill.scale.y = size * 0.8 * (1 - WAVES.campSink * share);
    }
  }
}
