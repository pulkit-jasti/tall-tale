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
import { BOARD, CASTLE, DECOR, ROADS, SETTLEMENTS } from '../config/game.js';
import type { Blueprint } from '../rules/blueprint.js';
import { RoadGraph, type GraphNode } from '../rules/roadGraph.js';
import { boardHeight, degToRad, groundAt, polarX, polarZ } from '../rules/boardMath.js';
import { createRandom, type Random } from '../rules/random.js';
import { cloneStatic, InstancedModel, loadTemplate, StaticBatch } from './models.js';
import { RoadNetwork } from './roads.js';
import { Meadow } from './grass.js';
import { buildSettlements, builtSpots, flatSpots, gapTo, placeLandmarks, planSettlements, type Spot } from './settlements.js';
import { campDistance, RoadField, Terrain, type CampSpot } from './terrain.js';
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

  // Table skirts: the inner edge of the hole and the far outer edge.
  const skirtMaterial = flatMaterial(BOARD.skirtColor);
  skirtMaterial.side = DoubleSide;
  const inner = new Mesh(
    new CylinderGeometry(BOARD.holeRadius, BOARD.holeRadius, BOARD.skirtDepth, 48, 1, true),
    skirtMaterial,
  );
  inner.position.y = -BOARD.skirtDepth / 2;
  const outerTop = boardHeight(BOARD.outerRadius);
  const outerHeight = outerTop + BOARD.skirtDepth;
  const outer = new Mesh(
    new CylinderGeometry(BOARD.outerRadius, BOARD.outerRadius, outerHeight, 96, 1, true),
    skirtMaterial,
  );
  outer.position.y = outerTop - outerHeight / 2;
  group.add(inner, outer);
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

/** Camp hills with rocks, tents and a fire at the start of each road. */
async function buildCamps(camps: GraphNode[], rng: Random, hills: Map<string, Object3D>): Promise<Group> {
  const group = new Group();
  const hill = await loadTemplate('props/castle-kit/ground-hills.glb', { width: 1 });
  const rocks = await Promise.all(
    ['rock-sand-a', 'rock-sand-b', 'rock-sand-c'].map((n) => loadTemplate(`rocks/survival/${n}.glb`, { width: 4 })),
  );
  const tents = await Promise.all([
    loadTemplate('camp/survival/tent.glb', { height: 4.5 }),
    loadTemplate('camp/survival/tent-canvas.glb', { height: 4.5 }),
    loadTemplate('camp/nature/tent_smallClosed.glb', { height: 4.5 }),
  ]);
  const fire = await loadTemplate('camp/survival/campfire-pit.glb', { width: 2 });
  const rockSets = rocks.map((t) => new InstancedModel(t, camps.length * 6));
  rockSets.forEach((s) => group.add(s.group));
  for (const camp of camps) {
    const [cr, cdeg] = camp.at;
    const size = camp.size;
    const ca = degToRad(cdeg);
    const cx = polarX(cr, ca);
    const cz = polarZ(cr, ca);
    const cy = boardHeight(cr);
    const hillObject = cloneStatic(hill);
    hillObject.scale.set(size, size * 0.8, size);
    hillObject.position.set(cx, cy - 0.3, cz);
    group.add(hillObject);
    hills.set(camp.id, hillObject);
    const rockCount = 3 + rng.int(3);
    for (let i = 0; i < rockCount; i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = size * rng.range(0.45, 0.65);
      const x = cx + Math.cos(a) * d;
      const z = cz + Math.sin(a) * d;
      rng.pick(rockSets).add(placeMatrix(x, groundAt(x, z), z, rng.range(0, 6.28), rng.range(0.75, 1.4)));
    }
    const tentCount = 1 + rng.int(2);
    for (let i = 0; i < tentCount; i++) {
      // Tents sit behind the hill, away from the castle.
      const a = ca + rng.range(-0.25, 0.25);
      const d = cr + size * 0.7 + rng.range(2, 6);
      const tent = cloneStatic(rng.pick(tents));
      tent.position.set(polarX(d, a), 0, polarZ(d, a));
      tent.position.y = groundAt(tent.position.x, tent.position.z);
      tent.rotation.y = rng.range(0, Math.PI * 2);
      group.add(tent);
    }
    const fireObject = cloneStatic(fire);
    const fd = cr + size * 0.6;
    const fa = ca + 0.12;
    fireObject.position.set(polarX(fd, fa), 0, polarZ(fd, fa));
    fireObject.position.y = groundAt(fireObject.position.x, fireObject.position.z);
    group.add(fireObject);
  }
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
  /** Camp hills by camp id, so a camp can sink as its enemies come out. */
  hills: Map<string, Object3D>;
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
  const plan = planSettlements(roadField, campSpots, createRandom(seed + 6));
  // Then the terrain, flat under the camps, villages and fields: from here on groundAt() has its hills.
  const terrain = new Terrain(roadField, [...campSpots, ...flatSpots(plan)], createRandom(seed));
  placeLandmarks(plan, terrain, campSpots, createRandom(seed + 7));
  // The village squares are worn to dirt, like the camps.
  const plazas = plan.villages.map((v) => ({ ...v, size: v.size * 0.45 }));
  // So are the goblin hamlets and the lumber camps; the burned village is ash.
  const worn = [...campSpots, ...plazas, ...plan.hamlets.map((h) => ({ ...h, size: h.size * 0.6 })), ...plan.lumber.map((l) => ({ ...l, size: l.size * 0.5 }))];
  const meadow = new Meadow(terrain, worn, createRandom(seed + 5), plan.burned ? [{ ...plan.burned, size: plan.burned.size * 0.8 }] : []);
  parent.add(buildBoardMesh(terrain, meadow));
  for (const road of network.roads) parent.add(road.buildMesh());
  const hills = new Map<string, Object3D>();
  // The courtyard stays empty until the main gameplay is done (houses and stalls come back with the polish).
  const [castle, camps, decor, settlements] = await Promise.all([
    buildCastle(),
    buildCamps(campNodes, createRandom(seed + 2), hills),
    buildDecor(terrain, campSpots, builtSpots(plan), plan.forests, createRandom(seed + 3)),
    buildSettlements(plan, network.roads, createRandom(seed + 8)),
  ]);
  parent.add(castle, camps, decor, settlements);
  return { network, hills };
}
