// Builds the board, roads, castle, camps and decor inside the turning board group.
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
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
import { BOARD, CASTLE } from '../config/game.js';
import type { ToyRoad } from '../config/toyMap.js';
import { boardHeight, degToRad, polarX, polarZ } from '../rules/boardMath.js';
import { createRandom, type Random } from '../rules/random.js';
import { cloneStatic, InstancedModel, loadTemplate } from './models.js';
import { Road } from './roads.js';
import { flatMaterial } from './shapes.js';

const yAxis = new Vector3(0, 1, 0);

function placeMatrix(x: number, y: number, z: number, yaw: number, scale = 1): Matrix4 {
  return new Matrix4().compose(
    new Vector3(x, y, z),
    new Quaternion().setFromAxisAngle(yAxis, yaw),
    new Vector3(scale, scale, scale),
  );
}

/** Grass disc with a hole, flat near the castle and rising toward the horizon. */
function buildBoardMesh(rng: Random): Group {
  const group = new Group();
  const radii: number[] = [];
  for (let r = BOARD.holeRadius; r < BOARD.outerRadius; ) {
    radii.push(r);
    r += r < 120 ? 6 : r < 300 ? 15 : 30;
  }
  radii.push(BOARD.outerRadius);
  const segments = 96;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const color = new Color();
  for (const r of radii) {
    for (let j = 0; j < segments; j++) {
      const a = (j / segments) * Math.PI * 2;
      positions.push(polarX(r, a), boardHeight(r), polarZ(r, a));
      color.setHex(rng.pick(BOARD.grassColors));
      colors.push(color.r, color.g, color.b);
    }
  }
  for (let i = 0; i < radii.length - 1; i++) {
    for (let j = 0; j < segments; j++) {
      const a = i * segments + j;
      const b = (i + 1) * segments + j;
      const c = i * segments + ((j + 1) % segments);
      const d = (i + 1) * segments + ((j + 1) % segments);
      indices.push(a, c, b, c, d, b);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const grass = new Mesh(
    geometry,
    new MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: true }),
  );
  group.add(grass);

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

  // Towers: hexagon base with the roof stacked on top.
  const base = await loadTemplate('castle/castle-kit/tower-hexagon-base.glb', { width: CASTLE.towerWidth });
  const roof = await loadTemplate('castle/castle-kit/tower-hexagon-roof.glb', {
    width: CASTLE.towerWidth * (0.976 / 0.9),
  });
  const bases = new InstancedModel(base, towerAngles.length);
  const roofs = new InstancedModel(roof, towerAngles.length);
  const r = (wallIn + wallOut) / 2;
  for (const a of towerAngles) {
    bases.add(placeMatrix(polarX(r, a), 0, polarZ(r, a), -a));
    roofs.add(placeMatrix(polarX(r, a), base.size.y, polarZ(r, a), -a));
  }
  group.add(bases.group, roofs.group);
  return group;
}

/** A few houses, stalls and crates in the courtyard (behind and beside the player). */
async function buildCourtyard(rng: Random): Promise<Group> {
  const group = new Group();
  const body = await loadTemplate('castle/castle-kit/tower-square-mid-door.glb', { width: 3.5 });
  const roof = await loadTemplate('town/fantasy-town/roof-gable.glb', { width: 4.1 });
  const stallRed = await loadTemplate('town/fantasy-town/stall-red.glb', { height: 4 });
  const stallGreen = await loadTemplate('town/fantasy-town/stall-green.glb', { height: 4 });
  const crate = await loadTemplate('props/survival/box.glb', { height: 1.2 });
  const barrel = await loadTemplate('props/mini-dungeon/barrel.glb', { height: 1.4 });
  const r = CASTLE.propRadius;
  const put = (object: Object3D, deg: number, radius: number, y = 0): void => {
    const a = degToRad(deg);
    object.position.set(polarX(radius, a), y, polarZ(radius, a));
    // Front of the model (+z) faces the center.
    object.rotation.y = Math.PI - a;
    group.add(object);
  };
  for (const deg of [140, 205, 250]) {
    put(cloneStatic(body), deg, r);
    put(cloneStatic(roof), deg, r, body.size.y);
  }
  put(cloneStatic(stallRed), 105, r);
  put(cloneStatic(stallGreen), -125, r);
  for (const deg of [120, 160, 228, -100, -150]) {
    put(cloneStatic(rng.next() < 0.5 ? crate : barrel), deg + rng.range(-6, 6), r + rng.range(-3, 3));
  }
  return group;
}

/** Camp hills with rocks, tents and a fire at the start of each road. */
async function buildCamps(roads: ToyRoad[], rng: Random): Promise<Group> {
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
  const rockSets = rocks.map((t) => new InstancedModel(t, roads.length * 6));
  rockSets.forEach((s) => group.add(s.group));
  for (const road of roads) {
    const [cr, cdeg] = road.camp.at;
    const ca = degToRad(cdeg);
    const cx = polarX(cr, ca);
    const cz = polarZ(cr, ca);
    const cy = boardHeight(cr);
    const hillObject = cloneStatic(hill);
    hillObject.scale.set(road.camp.size, road.camp.size * 0.8, road.camp.size);
    hillObject.position.set(cx, cy - 0.3, cz);
    group.add(hillObject);
    const rockCount = 3 + rng.int(3);
    for (let i = 0; i < rockCount; i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = road.camp.size * rng.range(0.45, 0.65);
      const x = cx + Math.cos(a) * d;
      const z = cz + Math.sin(a) * d;
      rng.pick(rockSets).add(placeMatrix(x, boardHeight(Math.hypot(x, z)), z, rng.range(0, 6.28), rng.range(0.75, 1.4)));
    }
    const tentCount = 1 + rng.int(2);
    for (let i = 0; i < tentCount; i++) {
      // Tents sit behind the hill, away from the castle.
      const a = ca + rng.range(-0.25, 0.25);
      const d = cr + road.camp.size * 0.7 + rng.range(2, 6);
      const tent = cloneStatic(rng.pick(tents));
      tent.position.set(polarX(d, a), boardHeight(d), polarZ(d, a));
      tent.rotation.y = rng.range(0, Math.PI * 2);
      group.add(tent);
    }
    const fireObject = cloneStatic(fire);
    const fd = cr + road.camp.size * 0.6;
    const fa = ca + 0.12;
    fireObject.position.set(polarX(fd, fa), boardHeight(fd), polarZ(fd, fa));
    group.add(fireObject);
  }
  return group;
}

/** Instanced trees, rocks and plants, kept off the roads and camps. */
async function buildDecor(roads: Road[], toyRoads: ToyRoad[], rng: Random): Promise<Group> {
  const group = new Group();
  const kinds: { files: string[]; height: [number, number]; count: number; radius: number }[] = [
    { files: ['trees/nature/tree_default', 'trees/nature/tree_oak', 'trees/nature/tree_cone', 'trees/nature/tree_fat'], height: [6, 12], count: 70, radius: 4 },
    { files: ['rocks/nature/rock_largeA', 'rocks/nature/rock_smallA', 'rocks/nature/rock_tallA'], height: [1.5, 6], count: 30, radius: 3 },
    { files: ['plants/nature/plant_bush', 'plants/nature/grass_large', 'plants/nature/flower_yellowA', 'plants/nature/flower_redA'], height: [1, 3], count: 80, radius: 1.5 },
  ];
  for (const kind of kinds) {
    const templates = await Promise.all(kind.files.map((f) => loadTemplate(`${f}.glb`, { height: 1 })));
    const sets = templates.map((t) => new InstancedModel(t, kind.count));
    sets.forEach((s) => group.add(s.group));
    let placed = 0;
    for (let tries = 0; placed < kind.count && tries < kind.count * 20; tries++) {
      const r = rng.range(65, 520);
      const a = rng.range(0, Math.PI * 2);
      const x = polarX(r, a);
      const z = polarZ(r, a);
      const size = rng.range(kind.height[0], kind.height[1]);
      const clear = kind.radius + 5;
      if (roads.some((road) => road.distanceTo(x, z) < clear)) continue;
      if (
        toyRoads.some((t) => {
          const ca = degToRad(t.camp.at[1]);
          return Math.hypot(polarX(t.camp.at[0], ca) - x, polarZ(t.camp.at[0], ca) - z) < t.camp.size + 10;
        })
      )
        continue;
      rng.pick(sets).add(placeMatrix(x, boardHeight(r), z, rng.range(0, Math.PI * 2), size));
      placed++;
    }
  }
  return group;
}

export interface BuiltBoard {
  roads: Road[];
}

/** Builds everything that turns with the board into `parent`. */
export async function buildBoard(parent: Object3D, toyRoads: ToyRoad[], seed: number): Promise<BuiltBoard> {
  // Each part gets its own seeded stream, so loading order never changes the layout.
  parent.add(buildBoardMesh(createRandom(seed)));
  const roads = toyRoads.map((t) => new Road(t.points));
  for (const road of roads) parent.add(road.buildMesh());
  const [castle, courtyard, camps, decor] = await Promise.all([
    buildCastle(),
    buildCourtyard(createRandom(seed + 1)),
    buildCamps(toyRoads, createRandom(seed + 2)),
    buildDecor(roads, toyRoads, createRandom(seed + 3)),
  ]);
  parent.add(castle, courtyard, camps, decor);
  return { roads };
}
