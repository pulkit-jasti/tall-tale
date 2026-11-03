// Toy test spawner (build step 1 only). A stand-in for the tutorial director
// that comes in step 3. Like a director, it only calls the goblin system.
import { TOY_SPAWN, type GoblinType } from '../config/game.js';
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
    const size = type === 'runner' ? TOY_SPAWN.runnerGroup : type === 'grunt' ? TOY_SPAWN.gruntGroup : 1;
    for (let i = 0; i < size; i++) this.queue.push({ type, road, wait: TOY_SPAWN.groupGap });
  }

  update(dt: number): void {
    if (this.auto) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = TOY_SPAWN.trickleInterval;
        this.groups++;
        this.sendGroup(this.groups % TOY_SPAWN.runnerEvery === 0 ? 'runner' : 'grunt');
        if (this.groups % TOY_SPAWN.climberEvery === 0) this.sendGroup('climber');
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
