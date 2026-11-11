// Goblins the tutorial brings for a tool's use lesson (docs/mvp.md "Tutorial
// director"): a lesson that says "swat a goblin" with no goblin in sight is
// confusing, so a few goblins come just for it and wait for the player,
// without hurting the castle:
//
//   onRampart: calm climbers on the rampart right in front, standing still
//              (the swatter, the pepper shaker and the stun tool reach them).
//   patrol:    grunts walking back and forth on the road in front, a moving
//              target for the slingshot, so the player sees how much the aim
//              assist helps.
//
// They are released (go on as usual) when the lesson ends. A system, not
// tutorial code: the director only asks for them.
import { Vector3 } from 'three';
import { LESSON_BAIT } from '../config/game.js';
import { degToRad, polarX, polarZ } from '../rules/boardMath.js';
import type { RoadNetwork } from '../world/roads.js';
import type { Goblin, Goblins } from './goblins.js';

const temp = new Vector3();

export class LessonBait {
  private list: Goblin[] = [];

  constructor(
    private goblins: Goblins,
    private network: RoadNetwork,
  ) {}

  /** Bait goblins still in the game. */
  private alive(): Goblin[] {
    this.list = this.list.filter((g) => g.mode !== 'dead' && (g.calm || g.patrolRoad >= 0));
    return this.list;
  }

  /** The first bait goblin still on the board (for the marker), or null. */
  first(): Goblin | null {
    for (const g of this.alive()) if (this.goblins.isHittable(g)) return g;
    return null;
  }

  /**
   * Calm climbers on the rampart in front of the player (`front`: the board
   * angle in front, radians). Tops up to LESSON_BAIT.rampartCount.
   * `armored`: each wears a helmet and a shield and carries a weapon (the
   * pepper lesson, so the disarm is there to see).
   */
  onRampart(front: number, armored = false): void {
    const { rampartCount, rampartSpreadDeg } = LESSON_BAIT;
    const have = this.alive().filter((g) => g.calm).length;
    for (let i = have; i < rampartCount; i++) {
      const offset = (i - (rampartCount - 1) / 2) * rampartSpreadDeg;
      const g = this.goblins.spawnClimberAt(front + degToRad(offset), true, Infinity);
      if (!g) continue;
      // Spear and sword in turn, so both weapons are seen flying off.
      if (armored) g.setGear(i % 2 === 0 ? 'spear' : 'sword', true, true);
      g.calm = true;
      this.list.push(g);
    }
  }

  /**
   * Grunts walking back and forth on the stretch of road nearest a spot in
   * front of the player, a moving target. Tops up to LESSON_BAIT.patrolCount.
   */
  patrol(front: number): void {
    const { patrolCount, patrolRadius, patrolHalf, approach } = LESSON_BAIT;
    const have = this.alive().filter((g) => g.patrolRoad >= 0).length;
    if (have >= patrolCount) return;
    const x = polarX(patrolRadius, front);
    const z = polarZ(patrolRadius, front);
    let roadIndex = 0;
    let best = Infinity;
    this.network.roads.forEach((r, i) => {
      const d = r.distanceTo(x, z);
      if (d < best) {
        best = d;
        roadIndex = i;
      }
    });
    const road = this.network.roads[roadIndex];
    const along = road.nearestAlong(x, z);
    const from = Math.max(2, along - patrolHalf);
    const to = Math.min(road.length - 2, along + patrolHalf);
    // Toward the castle along this road.
    road.pointAt(0, 0, temp);
    const r0 = Math.hypot(temp.x, temp.z);
    road.pointAt(road.length, 0, temp);
    const dir: 1 | -1 = Math.hypot(temp.x, temp.z) < r0 ? 1 : -1;
    for (let i = have; i < patrolCount; i++) {
      const lane = ((i % 3) - 1) * 1.4;
      // They come in from the camp side, a few cm apart, and turn round at the ends of the stretch.
      const g = this.goblins.spawnBefore('grunt', roadIndex, dir, dir === 1 ? from : to, approach + i * 7, lane);
      if (!g) continue;
      g.patrolRoad = roadIndex;
      g.patrolFrom = from;
      g.patrolTo = to;
      this.list.push(g);
    }
  }

  /** The lesson is over: they go on as usual (climbers run and jump in, walkers head for the wall). */
  release(): void {
    this.goblins.releaseLesson();
    this.list.length = 0;
  }
}
