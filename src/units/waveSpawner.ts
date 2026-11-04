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
  type: GoblinType;
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
    const sizes: Record<GoblinType, number> = { grunt: WAVES.gruntGroup, runner: WAVES.runnerGroup, climber: 1 };
    for (const type of ['grunt', 'runner', 'climber'] as GoblinType[]) {
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
      this.camps.get(group.camp)!.planned += group.count;
    });
    this.groups.sort((a, b) => a.at - b.at);
    this.updateHills();
  }

  /** Stops spawning. Camps stand up again. */
  stop(): void {
    this.active = false;
    this.groups.length = 0;
    this.camps.clear();
    this.time = 0;
    this.updateHills();
  }

  /** True when every planned enemy came out (or the wave was stopped). */
  get allOut(): boolean {
    return this.groups.every((g) => g.out >= g.count);
  }

  get running(): boolean {
    return this.active;
  }

  update(dt: number): void {
    if (!this.active) return;
    this.time += dt * this.rate;
    for (const group of this.groups) {
      if (group.out >= group.count) continue;
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
