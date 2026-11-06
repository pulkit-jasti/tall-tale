// Little scenes out in the empty land between the villages, the forests and
// the camps, so the world has a past (environmental storytelling): an old
// stone circle, a ruined watchtower, an old battlefield with swords and
// shields left in the grass, a shrine with a statue between two pillars, a
// travelers' camp by a road, an archery range, and a goblin trap baited with
// a chest of coins. Decor only (nothing to touch), merged into one mesh per
// material for all of them (STORY_SPOTS in src/config/game.ts). Board cm.
import { Group, Matrix4, Quaternion, Vector3 } from 'three';
import { ROADS, STORY_SPOTS } from '../config/game.js';
import { groundAt } from '../rules/boardMath.js';
import type { Random } from '../rules/random.js';
import { loadTemplate, StaticBatch, type ModelTemplate } from './models.js';
import { gapTo, type Spot } from './settlements.js';
import { campDistance, type CampSpot, type RoadField } from './terrain.js';

export type StoryKind = keyof typeof STORY_SPOTS.counts;

export interface StorySpot extends Spot {
  kind: StoryKind;
  /** The scene's own turn (radians). */
  yaw: number;
}

/**
 * Free spots for the scenes: off the roads (the travelers' camp right beside
 * one), away from the camps and everything built, and apart from each other.
 */
export function planStorySpots(roads: RoadField, camps: CampSpot[], taken: Spot[], rng: Random): StorySpot[] {
  const S = STORY_SPOTS;
  const wanted: StoryKind[] = [];
  for (const [kind, count] of Object.entries(S.counts) as [StoryKind, number][]) for (let i = 0; i < count; i++) wanted.push(kind);
  // Shuffled, so no kind always gets the best spots.
  for (let i = wanted.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [wanted[i], wanted[j]] = [wanted[j], wanted[i]];
  }
  const spots: StorySpot[] = [];
  for (const kind of wanted) {
    const size = S.sizes[kind];
    for (let tries = 0; tries < 300; tries++) {
      // Even over the ring's area, not bunched toward the middle.
      const r = Math.sqrt(rng.range(S.from * S.from, S.to * S.to));
      const a = rng.range(0, Math.PI * 2);
      const x = Math.sin(a) * r;
      const z = -Math.cos(a) * r;
      const road = roads.distance(x, z) - ROADS.width / 2 - size;
      if (kind === 'travelers' ? road < S.roadGap || road > S.roadGap + S.travelersNear : road < S.roadGap) continue;
      if (campDistance(camps, x, z) < S.campGap + size) continue;
      if (gapTo(taken, x, z) < S.gap + size) continue;
      if (gapTo(spots, x, z) < S.spacing + size) continue;
      spots.push({ x, z, size, kind, yaw: rng.range(0, Math.PI * 2) });
      break;
    }
  }
  return spots;
}

const position = new Vector3();
const turn = new Quaternion();
const lean = new Quaternion();
const scale = new Vector3();
const UP = new Vector3(0, 1, 0);
const SIDE = new Vector3(1, 0, 0);

/** Every scene, built from kit pieces into one mesh per material. */
export async function buildStorySpots(spots: StorySpot[], rng: Random): Promise<Group> {
  const fit = (path: string, f: Parameters<typeof loadTemplate>[1]): Promise<ModelTemplate> => loadTemplate(`${path}.glb`, f);
  const tall = (path: string): Promise<ModelTemplate> => fit(path, { height: 1 });
  const [rockA, rockB, rockC, altar, towerBase, stairs, rubbleBig, rubbleSmall, banner] = await Promise.all([
    tall('rocks/nature/rock_tallA'),
    tall('rocks/nature/rock_tallB'),
    tall('rocks/nature/rock_tallC'),
    fit('props/mini-dungeon/stones', { width: 1 }),
    tall('castle/castle-kit/tower-base'),
    tall('castle/castle-kit/stairs-stone'),
    fit('props/castle-kit/rocks-large', { width: 1 }),
    fit('props/castle-kit/rocks-small', { width: 1 }),
    tall('castle/castle-kit/flag-banner-long'),
  ]);
  const [sword, spear, shieldRound, shieldSquare, wreck, statue, pillar, hedge] = await Promise.all([
    tall('props/mini-arena/weapon-sword'),
    tall('props/mini-arena/weapon-spear'),
    fit('props/mini-dungeon/shield-round', { width: 1 }),
    fit('props/mini-dungeon/shield-rectangle', { width: 1 }),
    fit('props/castle-kit/siege-ram-demolished', { width: 1 }),
    tall('props/mini-arena/statue'),
    tall('town/fantasy-town/pillar-stone'),
    fit('town/fantasy-town/hedge', { width: 1 }),
  ]);
  const [tent, tentCanvas, firePit, chest, barrelOpen, bucket, target, rack, trap, coin] = await Promise.all([
    tall('camp/survival/tent'),
    tall('camp/survival/tent-canvas'),
    fit('camp/survival/campfire-pit', { width: 1 }),
    fit('props/survival/chest', { width: 1 }),
    tall('props/survival/barrel-open'),
    tall('props/survival/bucket'),
    tall('props/mini-forest/target'),
    fit('props/mini-arena/weapon-rack', { width: 1 }),
    fit('props/mini-dungeon/trap', { width: 1 }),
    fit('props/mini-dungeon/coin', { width: 1 }),
  ]);
  const rocks = [rockA, rockB, rockC];
  const batch = new StaticBatch();

  for (const spot of spots) {
    const cos = Math.cos(spot.yaw);
    const sin = Math.sin(spot.yaw);
    /**
     * One piece at (lx, lz) in the scene's own frame, turned `yaw` more than
     * the scene, `size` big, leaning `tilt` (radians, a fallen thing lies on
     * its side), sunk `sink` into the ground so it never floats on a slope.
     */
    const put = (template: ModelTemplate, lx: number, lz: number, yaw: number, size: number, tilt = 0, sink = 0.15): void => {
      const x = spot.x + lx * cos + lz * sin;
      const z = spot.z - lx * sin + lz * cos;
      position.set(x, groundAt(x, z) - sink, z);
      turn.setFromAxisAngle(UP, spot.yaw + yaw).multiply(lean.setFromAxisAngle(SIDE, tilt));
      batch.add(template, new Matrix4().compose(position, turn, scale.setScalar(size)));
    };
    const ring = (count: number, radius: number, each: (a: number, x: number, z: number, i: number) => void): void => {
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + rng.range(-0.15, 0.15);
        each(a, Math.sin(a) * radius, -Math.cos(a) * radius, i);
      }
    };
    const R = spot.size;
    switch (spot.kind) {
      case 'stoneCircle':
        // Old standing stones in a ring, one fallen over, an altar of stones in the middle.
        ring(8, R * 0.75, (a, x, z, i) => {
          const fallen = i === 3;
          put(rng.pick(rocks), x, z, -a, rng.range(4.5, 7), fallen ? 1.35 : rng.range(-0.12, 0.12), fallen ? 0.8 : 0.4);
        });
        put(altar, 0, 0, rng.range(0, 6.28), 4.5);
        break;
      case 'ruinedTower':
        // The stump of an old watchtower, rubble around it, its stairs and its banner fallen in the grass.
        put(towerBase, 0, 0, rng.range(0, 6.28), 9, 0.05, 0.6);
        put(rubbleBig, R * 0.6, R * 0.2, rng.range(0, 6.28), 6);
        put(rubbleSmall, -R * 0.5, R * 0.45, rng.range(0, 6.28), 5);
        put(rubbleSmall, R * 0.1, -R * 0.7, rng.range(0, 6.28), 4);
        put(stairs, -R * 0.65, -R * 0.2, 0.6, 4, 0.25);
        put(banner, R * 0.35, R * 0.75, 1.2, 8, Math.PI / 2 - 0.08, 0.1);
        break;
      case 'battlefield':
        // An old fight: swords and spears left stuck in the ground, shields lying about, a broken ram.
        for (let i = 0; i < 7; i++) {
          const a = rng.range(0, Math.PI * 2);
          const d = rng.range(0.1, 0.9) * R;
          put(sword, Math.sin(a) * d, -Math.cos(a) * d, rng.range(0, 6.28), 3.2, rng.range(-0.3, 0.3), 0.7);
        }
        for (let i = 0; i < 4; i++) {
          const a = rng.range(0, Math.PI * 2);
          const d = rng.range(0.2, 0.9) * R;
          put(spear, Math.sin(a) * d, -Math.cos(a) * d, rng.range(0, 6.28), 4.5, rng.range(-0.45, 0.45), 0.8);
        }
        for (let i = 0; i < 5; i++) {
          const a = rng.range(0, Math.PI * 2);
          const d = rng.range(0.1, 0.85) * R;
          put(rng.next() < 0.5 ? shieldRound : shieldSquare, Math.sin(a) * d, -Math.cos(a) * d, rng.range(0, 6.28), 2.4, -Math.PI / 2 + rng.range(-0.15, 0.15), 0);
        }
        put(wreck, -R * 0.55, R * 0.4, rng.range(0, 6.28), 7);
        break;
      case 'shrine':
        // A statue between two stone pillars, hedges on both sides, offering stones in front.
        put(statue, 0, -R * 0.2, 0, 6.5);
        for (const side of [-1, 1]) {
          put(pillar, side * R * 0.45, -R * 0.1, 0, 6);
          put(hedge, side * R * 0.75, -R * 0.1, 0, 6);
        }
        put(altar, 0, R * 0.4, 0, 3);
        break;
      case 'travelers':
        // Travelers resting beside the road: two tents, a fire, their chest, a barrel and a bucket.
        put(tent, -R * 0.4, -R * 0.3, 0.4, 4.2);
        put(tentCanvas, R * 0.45, -R * 0.25, -0.5, 4);
        put(firePit, 0, R * 0.2, 0, 2.6);
        put(chest, -R * 0.55, R * 0.45, 0.8, 2);
        put(barrelOpen, R * 0.5, R * 0.45, 0, 1.5);
        put(bucket, R * 0.25, R * 0.6, 0, 0.9);
        break;
      case 'archery':
        // An archery range: three targets in a row, a rack of weapons at the shooting end, arrows' spears in the grass.
        for (let i = -1; i <= 1; i++) put(target, i * R * 0.45, -R * 0.6, 0, 4);
        put(rack, 0, R * 0.65, Math.PI, 3.2);
        put(spear, R * 0.4, R * 0.5, 0, 4, 0.15, 0.6);
        put(spear, -R * 0.35, R * 0.55, 0, 4, -0.2, 0.6);
        break;
      case 'goblinTrap':
        // A goblin trap baited with a chest, coins dropped around it to lure them in.
        put(trap, 0, 0, rng.range(0, 6.28), 4.5, 0, 0.05);
        put(chest, 0, 0, rng.range(0, 6.28), 2, 0, -0.6);
        ring(4, R * 0.55, (a, x, z) => put(coin, x, z, a, 1.2, -Math.PI / 2, 0));
        break;
    }
  }
  return batch.build();
}
