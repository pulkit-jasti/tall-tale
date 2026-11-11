// Debug spawner from the toy test (build step 1): the debug page, the stress
// test and the optional auto trickle use it, apart from the tutorial
// director. Like a director, it only calls the goblin system.
import { DEBUG, DEBUG_SPAWN as TOY_SPAWN, type GoblinType } from '../config/game.js';
import type { Random } from '../rules/random.js';
import type { Goblins } from '../units/goblins.js';

interface Pending {
  type: GoblinType;
  road: number;
  wait: number;
}

export class ToySpawner {
  auto = TOY_SPAWN.autoTrickle;
  private timer = 2;
  private groups = 0;
  private queue: Pending[] = [];

  constructor(
    private goblins: Goblins,
    private roadCount: number,
    private rng: Random,
  ) {}

  /** Queues a small group walking in from one camp. */
  sendGroup(type: GoblinType, road = this.rng.int(this.roadCount)): void {
    const size = type === 'runner' ? TOY_SPAWN.runnerGroup : TOY_SPAWN.gruntGroup;
    for (let i = 0; i < size; i++) this.queue.push({ type, road, wait: TOY_SPAWN.groupGap });
  }

  /** Debug stress test: many goblins, spread over all roads. */
  sendMany(type: GoblinType, count: number): void {
    for (let i = 0; i < count; i++) this.queue.push({ type, road: i % this.roadCount, wait: DEBUG.stressGap });
  }

  update(dt: number): void {
    if (this.auto) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = TOY_SPAWN.trickleInterval;
        this.groups++;
        this.sendGroup(this.groups % TOY_SPAWN.runnerEvery === 0 ? 'runner' : 'grunt');
      }
    }
    // Goblins in the queue come out one by one.
    const next = this.queue[0];
    if (next) {
      next.wait -= dt;
      if (next.wait <= 0) {
        this.queue.shift();
        this.goblins.spawnOnRoad(next.type, next.road);
      }
    }
  }

  clear(): void {
    this.queue.length = 0;
  }
}
