// Builds the board, roads, castle, camps and decor inside the turning board group.
import {
  BoxGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  RingGeometry,
  Vector3,
} from 'three';
import { BOARD, CAMP_LOOK, CASTLE, DECOR, NIGHT_LIGHTS, ROADS, SETTLEMENTS } from '../config/game.js';
import type { Blueprint } from '../rules/blueprint.js';
import { RoadGraph, type GraphNode } from '../rules/roadGraph.js';
import { boardHeight, degToRad, groundAt, polarX, polarZ } from '../rules/boardMath.js';
import { createRandom, type Random } from '../rules/random.js';
import { cloneStatic, InstancedModel, loadTemplate, StaticBatch, type ModelTemplate } from './models.js';
import { RoadNetwork } from './roads.js';
import type { RoadTorch } from './nightLights.js';
import { buildStorySpots, planStorySpots } from './storySpots.js';
import { Meadow } from './grass.js';
import { buildSettlements, builtSpots, flatSpots, gapTo, placeLandmarks, planSettlements, type Spot } from './settlements.js';
import { campDistance, RoadField, Terrain, type CampSpot } from './terrain.js';
import { placeTriggers, triggerGround } from './triggers.js';
import { flatMaterial } from './shapes.js';

const yAxis = new Vector3(0, 1, 0);

function placeMatrix(x: number, y: number, z: number, yaw: number, scale = 1): Matrix4 {
  return new Matrix4().compose(
    new Vector3(x, y, z),
    new Quaternion().setFromAxisAngle(yAxis, yaw),
    new Vector3(scale, scale, scale),
  );
}

/**
 * Uneven grass disc with a hole: the terrain's hills on the board's slope
 * (src/world/terrain.ts builds its points). Low poly: flat shaded triangles,
 * each with one solid grass color (src/world/grass.ts), so each facet catches
 * the sun differently and reads on its own.
 */
function buildBoardMesh(terrain: Terrain, meadow: Meadow): Group {
  const group = new Group();
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: true });
  group.add(new Mesh(terrain.geometry((x, z, r, steepness, out) => meadow.faceColor(x, z, r, steepness, out)), material));

  // Table skirt at the far outer edge. The hole in the middle is filled by the seat floor (src/world/giant.ts).
  const skirtMaterial = flatMaterial(BOARD.skirtColor);
  skirtMaterial.side = DoubleSide;
  const outerTop = boardHeight(BOARD.outerRadius);
  const outerHeight = outerTop + BOARD.skirtDepth;
  const outer = new Mesh(
    new CylinderGeometry(BOARD.outerRadius, BOARD.outerRadius, outerHeight, 96, 1, true),
    skirtMaterial,
  );
  outer.position.y = outerTop - outerHeight / 2;
  group.add(outer);
  return group;
}

/** Round stone wall with crenellations (code shape) and towers (models). */
async function buildCastle(): Promise<Group> {
  const group = new Group();
  const { wallIn, wallOut, wallHeight } = CASTLE;
  const stone = flatMaterial(CASTLE.stoneColor);
  const outerWall = new Mesh(new CylinderGeometry(wallOut, wallOut, wallHeight, 64, 1, true), stone);
  outerWall.position.y = wallHeight / 2;
  const innerMaterial = flatMaterial(CASTLE.stoneDarkColor);
  innerMaterial.side = DoubleSide;
  const innerWall = new Mesh(new CylinderGeometry(wallIn, wallIn, wallHeight, 64, 1, true), innerMaterial);
  innerWall.position.y = wallHeight / 2;
  const top = new Mesh(new RingGeometry(wallIn, wallOut, 64, 1), flatMaterial(CASTLE.stoneTopColor));
  top.rotation.x = -Math.PI / 2;
  top.position.y = wallHeight;
  group.add(outerWall, innerWall, top);

  const towerAngles: number[] = [];
  for (let i = 0; i < CASTLE.towerCount; i++) {
    towerAngles.push(degToRad(CASTLE.towerStartDeg + (360 / CASTLE.towerCount) * i));
  }

  // Crenellations on the outer edge, skipping the towers.
  const count = Math.floor((Math.PI * 2 * wallOut) / CASTLE.crenelSpacing);
  const crenels = new InstancedMesh(new BoxGeometry(2.4, 1.4, 1.2), stone, count);
  let placed = 0;
  const towerGap = (CASTLE.towerWidth / 2 + 1.5) / wallOut;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const nearTower = towerAngles.some((t) => {
      const d = Math.abs(Math.atan2(Math.sin(a - t), Math.cos(a - t)));
      return d < towerGap;
    });
    if (nearTower) continue;
    const r = wallOut - 0.6;
    crenels.setMatrixAt(placed++, placeMatrix(polarX(r, a), wallHeight + 0.7, polarZ(r, a), -a));
  }
  crenels.count = placed;
  group.add(crenels);

  // Towers: hexagon base with the roof stacked on top. The model is widest
  // along its x, so it is turned a quarter to lay that across the wall: the
  // tower covers the wall's full thickness and the wall runs into it.
  const base = await loadTemplate('castle/castle-kit/tower-hexagon-base.glb', { width: CASTLE.towerWidth });
  const roof = await loadTemplate('castle/castle-kit/tower-hexagon-roof.glb', {
    width: CASTLE.towerWidth * (0.976 / 0.9),
  });
  const bases = new InstancedModel(base, towerAngles.length);
  const roofs = new InstancedModel(roof, towerAngles.length);
  const r = (wallIn + wallOut) / 2;
  for (const a of towerAngles) {
    bases.add(placeMatrix(polarX(r, a), 0, polarZ(r, a), Math.PI / 2 - a));
    roofs.add(placeMatrix(polarX(r, a), base.size.y, polarZ(r, a), Math.PI / 2 - a));
  }
  group.add(bases.group, roofs.group);
  return group;
}

/**
 * Goblin war camps at the start of each road (CAMP_LOOK): the camp hill in
 * the middle (its own object, it sinks as goblins come out), and around it,
 * merged into one mesh per material for all camps, a spiked palisade with
 * its gate toward the castle (where the road leaves), red banners at the
 * gate, a war tent at the back, tents, a catapult, a weapon rack, a fire,
 * and tall rocks behind the fence.
 */
async function buildCamps(camps: GraphNode[], rng: Random, hills: Map<string, Object3D>): Promise<Group> {
  const L = CAMP_LOOK;
  const group = new Group();
  const fit = (path: string, f: Parameters<typeof loadTemplate>[1]): Promise<ModelTemplate> => loadTemplate(`${path}.glb`, f);
  const [hill, gate, rack, crate, barrel, ...tallRocks] = await Promise.all([
    fit('props/castle-kit/ground-hills', { width: 1 }),
    fit('camp/survival/fence-doorway', { width: L.fencePiece }),
    fit('props/mini-arena/weapon-rack', { width: L.rackWidth }),
    fit('props/survival/box-large', { width: 1.6 }),
    fit('props/survival/barrel', { height: 1.4 }),
    ...['rock_tallA', 'rock_tallB', 'rock_tallC'].map((n) => fit(`rocks/nature/${n}`, { height: 1 })),
  ]);
  // Each camp gets its own mix (by its place in the list), so no two look the same.
  const fences = await Promise.all(['camp/survival/fence-fortified', 'camp/goblin/branch_fence_1', 'camp/survival/fence'].map((p) => fit(p, { width: L.fencePiece })));
  const banners = await Promise.all(['town/fantasy-town/banner-red', 'town/fantasy-town/banner-green'].map((p) => fit(p, { height: L.bannerHeight })));
  const warTents = await Promise.all(['camp/goblin/tent_3', 'camp/goblin/tent_2'].map((p) => fit(p, { height: L.warTentHeight })));
  const tents = await Promise.all(['camp/goblin/tent_1', 'camp/goblin/tent_4', 'camp/goblin/tent_5'].map((p) => fit(p, { height: L.tentHeight })));
  const machines = await Promise.all(
    ['siege-catapult', 'siege-ballista', 'siege-ram', 'siege-trebuchet'].map((n) => fit(`props/castle-kit/${n}`, { width: L.catapultWidth })),
  );
  const fires = await Promise.all(['camp/nature/campfire_logs', 'camp/nature/campfire_stones'].map((p) => fit(p, { width: L.fireWidth })));
  const totem = await fit('camp/goblin/stone_1', { height: L.totemHeight });
  const batch = new StaticBatch();
  for (const [index, camp] of camps.entries()) {
    const fence = fences[index % fences.length];
    const banner = banners[index % banners.length];
    const warTent = warTents[index % warTents.length];
    const machine = machines[index % machines.length];
    const fire = fires[(index + 1) % fires.length];
    const [cr, cdeg] = camp.at;
    const size = camp.size;
    // Everything grows and shrinks with the camp (sizes in CAMP_LOOK are for a camp of 30).
    const k = size / 30;
    const ca = degToRad(cdeg);
    const cx = polarX(cr, ca);
    const cz = polarZ(cr, ca);
    const cy = boardHeight(cr);
    const hillObject = cloneStatic(hill);
    hillObject.scale.set(size, size * 0.8, size);
    hillObject.position.set(cx, cy - 0.3, cz);
    group.add(hillObject);
    hills.set(camp.id, hillObject);
    // Spots around the camp's middle, by angle (the board's frame: x = sin, z = -cos) and distance. The gate looks at the castle.
    const gateAt = ca + Math.PI;
    const spot = (a: number, d: number): [number, number] => [cx + Math.sin(a) * d, cz - Math.cos(a) * d];
    // Model fronts are their +x: turned to face a point.
    const toward = (x: number, z: number, tx: number, tz: number): number => Math.atan2(-(tz - z), tx - x);
    const put = (template: ModelTemplate, a: number, d: number, yaw: number, scale = k): void => {
      const [x, z] = spot(a, d);
      batch.add(template, placeMatrix(x, groundAt(x, z) - 0.1, z, yaw, scale));
    };

    // The palisade: pieces laid along the ring (a piece's length is its x), the doorway on the road.
    const R = size * L.fenceRadius;
    const pieces = Math.max(8, Math.round((Math.PI * 2 * R) / L.fencePiece));
    // Stretched a little so the pieces meet with no gaps.
    const stretch = (2 * R * Math.sin(Math.PI / pieces)) / L.fencePiece;
    for (let i = 0; i < pieces; i++) {
      const a = gateAt + (i / pieces) * Math.PI * 2;
      const [x, z] = spot(a, R);
      const m = placeMatrix(x, groundAt(x, z) - 0.1, z, -a).multiply(new Matrix4().makeScale(stretch, k, k));
      batch.add(i === 0 ? gate : fence, m);
    }
    // Red banners on both sides of the gate, just outside, their cloth facing the castle.
    const beside = (Math.PI * 2) / pieces;
    for (const side of [-1, 1]) put(banner, gateAt + side * beside * 0.8, R + 1.5, Math.PI / 2 - (gateAt + side * beside * 0.8));
    // The big war tent at the back, smaller tents to the back sides, all facing the middle.
    const back = gateAt + Math.PI;
    const inner = (size * 0.5 + R) / 2 + size * 0.04;
    const faceMiddle = (a: number, d: number): number => {
      const [x, z] = spot(a, d);
      return toward(x, z, cx, cz);
    };
    const warAt = back + rng.range(-0.15, 0.15);
    put(warTent, warAt, inner, faceMiddle(warAt, inner));
    for (const side of [-1, 1]) {
      const a = back + side * rng.range(0.8, 0.95);
      put(rng.pick(tents), a, inner, faceMiddle(a, inner), k * rng.range(0.85, 1.05));
    }
    // A siege machine on one side (each camp its own kind), aimed at the castle.
    const flip = index % 2 === 0 ? 1 : -1;
    put(machine, gateAt + flip * 1.75, inner, Math.atan2(cz, -cx));
    // The other side: a weapon rack or a pile of supplies, and the fire nearer the gate.
    const other = gateAt - flip * 1.5;
    if (index % 2 === 0) put(rack, other, inner, faceMiddle(other, inner));
    else {
      for (let i = 0; i < 5; i++) {
        put(rng.next() < 0.5 ? barrel : crate, other + rng.range(-0.22, 0.22), inner + rng.range(-3, 3), rng.range(0, Math.PI * 2));
      }
    }
    put(fire, gateAt - flip * 1, size * 0.62, rng.range(0, Math.PI * 2));
    // Most camps: two goblin standing stones beside the gate, their faces toward the castle.
    if (index % 3 !== 1) {
      for (const side of [-1, 1]) {
        const a = gateAt + side * beside * 2.2;
        put(totem, a, R + 3, Math.PI - a);
      }
    }
    // Tall rocks looming just outside the fence, behind the camp.
    for (let i = 0; i < L.rocks; i++) {
      const a = back + rng.range(-0.9, 0.9);
      put(rng.pick(tallRocks), a, R + rng.range(3, 7), rng.range(0, Math.PI * 2), rng.range(...L.rockHeight));
    }
  }
  group.add(batch.build());
  return group;
}

/**
 * Trees, rocks, bushes, flowers, mushrooms and stumps (DECOR), some in
 * groups (rock piles, flower patches, and tree groves inside the forests),
 * kept off the roads, camps, villages, fields and landmarks, standing on the
 * hills. All merged into one mesh per material.
 */
async function buildDecor(terrain: Terrain, camps: CampSpot[], built: Spot[], forests: Spot[], rng: Random): Promise<Group> {
  const batch = new StaticBatch(DECOR.tints);
  const roadEdge = ROADS.width / 2;
  const spot = (): [number, number] => {
    // Even over the area, not bunched near the castle.
    const r = Math.sqrt(rng.range(DECOR.from * DECOR.from, DECOR.to * DECOR.to));
    const a = rng.range(0, Math.PI * 2);
    return [polarX(r, a), polarZ(r, a)];
  };
  /** A group's middle inside a forest. */
  const inForest = (): [number, number] => {
    const forest = rng.pick(forests);
    const d = forest.size * 0.7 * Math.sqrt(rng.next());
    const a = rng.range(0, Math.PI * 2);
    return [forest.x + Math.sin(a) * d, forest.z - Math.cos(a) * d];
  };
  for (const kind of DECOR.kinds) {
    const templates = await Promise.all(kind.files.map((f) => loadTemplate(`${f}.glb`, { height: 1 })));
    const middle = kind.inForests && forests.length > 0 ? inForest : spot;
    const groups = kind.groups ? Array.from({ length: kind.groups.count }, middle) : [];
    const grouped = kind.groups ? Math.round(kind.count * kind.groups.share) : 0;
    let placed = 0;
    for (let tries = 0; placed < kind.count && tries < kind.count * 20; tries++) {
      let x: number;
      let z: number;
      if (placed < grouped && kind.groups) {
        // Around a group's middle, thicker in the middle.
        const [gx, gz] = rng.pick(groups);
        const d = kind.groups.radius * Math.sqrt(rng.next()) * rng.range(0.4, 1);
        const a = rng.range(0, Math.PI * 2);
        x = gx + Math.sin(a) * d;
        z = gz - Math.cos(a) * d;
      } else {
        [x, z] = spot();
      }
      const r = Math.hypot(x, z);
      if (r < DECOR.from || r > DECOR.to) continue;
      const size = rng.range(kind.height[0], kind.height[1]);
      if (terrain.roads.distance(x, z) < roadEdge + kind.clear + 2) continue;
      if (campDistance(camps, x, z) < 10 || gapTo(built, x, z) < kind.clear) continue;
      // On the hills, sunk a little so the base never floats on a slope.
      batch.add(rng.pick(templates), placeMatrix(x, groundAt(x, z) - size * 0.08, z, rng.range(0, Math.PI * 2), size));
      placed++;
    }
  }
  return batch.build();
}

export interface BuiltBoard {
  network: RoadNetwork;
  /** The windmill's sails, which turn (decor), or null without a windmill. */
  sails: Object3D | null;
  /** Camp hills by camp id, so a camp can sink as its enemies come out. */
  hills: Map<string, Object3D>;
  /** Every window tile and lantern on the board (their placements), for the night lights, and a lantern's height (cm). */
  windows: Matrix4[];
  lanterns: Matrix4[];
  lanternHeight: number;
  /** Ground spots of the night torches beside the roads, and the road's direction at each. */
  roadTorches: RoadTorch[];
  /** The villages (for the villagers who walk about in them). */
  villages: Spot[];
}

/** Builds everything in a map blueprint that turns with the board into `parent`. */
export async function buildBoard(parent: Object3D, blueprint: Blueprint): Promise<BuiltBoard> {
  const seed = blueprint.seed;
  const network = new RoadNetwork(new RoadGraph(blueprint));
  const campNodes = network.graph.nodes.filter((n) => n.kind === 'camp');
  const campSpots = campNodes.map((c) => {
    const a = degToRad(c.at[1]);
    return { x: polarX(c.at[0], a), z: polarZ(c.at[0], a), size: c.size };
  });
  // Each part gets its own seeded stream, so loading order never changes the layout.
  // Where people live comes first (the villages sit by the roads, so this needs road distances far out).
  const roadField = new RoadField(network.roads, ROADS.width / 2 + SETTLEMENTS.villages.radius[1] + SETTLEMENTS.villages.roadGap[1] + 6);
  // The triggers on the roads: flat ground under them and toward the castle (never hidden by a hill), and nothing built beside them.
  const triggerSpots = triggerGround(placeTriggers(network, blueprint.triggers));
  const plan = planSettlements(roadField, campSpots, createRandom(seed + 6), triggerSpots.clear);
  // Then the terrain, flat under the camps, villages, fields and triggers: from here on groundAt() has its hills.
  const terrain = new Terrain(roadField, [...campSpots, ...flatSpots(plan), ...triggerSpots.flats], createRandom(seed));
  placeLandmarks(plan, terrain, campSpots, createRandom(seed + 7), triggerSpots.clear);
  // The village squares are worn to dirt, like the camps.
  const plazas = plan.villages.map((v) => ({ ...v, size: v.size * 0.45 }));
  // So are the goblin hamlets and the lumber camps; the burned village is ash.
  const worn = [...campSpots, ...plazas, ...plan.hamlets.map((h) => ({ ...h, size: h.size * 0.6 })), ...plan.lumber.map((l) => ({ ...l, size: l.size * 0.5 }))];
  const meadow = new Meadow(terrain, worn, createRandom(seed + 5), plan.burned ? [{ ...plan.burned, size: plan.burned.size * 0.8 }] : []);
  parent.add(buildBoardMesh(terrain, meadow));
  for (const road of network.roads) parent.add(road.buildMesh());
  const hills = new Map<string, Object3D>();
  // Little scenes in the empty land (a stone circle, a ruined tower, an old battlefield...), clear of everything built.
  const built = [...builtSpots(plan), ...triggerSpots.clear];
  const stories = planStorySpots(roadField, campSpots, built, createRandom(seed + 9));
  // The courtyard stays empty until the main gameplay is done (houses and stalls come back with the polish).
  const [castle, camps, decor, settlements, storyScenes] = await Promise.all([
    buildCastle(),
    buildCamps(campNodes, createRandom(seed + 2), hills),
    buildDecor(terrain, campSpots, [...built, ...stories], plan.forests, createRandom(seed + 3)),
    buildSettlements(plan, network.roads, createRandom(seed + 8)),
    buildStorySpots(stories, createRandom(seed + 10)),
  ]);
  parent.add(castle, camps, decor, settlements, storyScenes);
  return {
    network,
    hills,
    sails: (settlements.userData.sails as Object3D | undefined) ?? null,
    // For the night lights: every window tile and lantern (in the settlements' frame, the board's), and a lantern's height.
    windows: settlements.userData.windows as Matrix4[],
    lanterns: settlements.userData.lanterns as Matrix4[],
    lanternHeight: settlements.userData.lanternHeight as number,
    roadTorches: roadTorchSpots(network.roads),
    villages: plan.villages,
  };
}

/**
 * Ground spots for the night torches beside the roads (NIGHT_LIGHTS.roadTorch*):
 * evenly along each road, sides taking turns, kept apart where roads meet.
 */
function roadTorchSpots(roads: { length: number; pointAt(distance: number, offset: number, out: Vector3): Vector3 }[]): RoadTorch[] {
  const L = NIGHT_LIGHTS;
  const spots: RoadTorch[] = [];
  const out = ROADS.width / 2 + L.roadTorchOut;
  const ahead = new Vector3();
  let side = 1;
  for (const road of roads) {
    for (let d = L.roadTorchEvery / 2; d < road.length && spots.length < L.roadTorchMax; d += L.roadTorchEvery) {
      const p = road.pointAt(d, out * side, new Vector3());
      const r = Math.hypot(p.x, p.z);
      if (r < L.roadTorchFrom || r > L.roadTorchTo) continue;
      if (spots.some((s) => s.at.distanceTo(p) < L.roadTorchEvery * 0.6)) continue;
      // The road's direction here, so the pool of light lies along it.
      road.pointAt(Math.min(road.length, d + 2), out * side, ahead).sub(p);
      spots.push({ at: p, yaw: Math.atan2(-ahead.z, ahead.x) });
      side = -side;
    }
  }
  return spots;
}
