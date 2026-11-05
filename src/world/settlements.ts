// Where people live on the board (SETTLEMENTS in config, decor only, no
// gameplay). Placed with a reason, not at random:
//   - villages in the calmer ring between the castle and the camps, beside a
//     road but never on one, on ground the terrain flattens for them, houses
//     around a little square with a stall, a cart and barrels, a signpost
//     where the village meets its road,
//   - farm fields next to each village (rows of one crop, a fence around,
//     a gap on the village side),
//   - forests out in the hilly far ring, away from the villages (the decor's
//     tree groves grow there),
//   - watch towers on the hilltops beside the roads, watching them,
//   - one windmill on the highest spot near a field,
//   - wrecked siege machines near the enemy camps, left from old battles,
// and out past the camps, in goblin lands:
//   - a goblin hamlet behind each camp (cabin, tents, cage, branch fences),
//     where the enemy comes from,
//   - one kingdom village the goblins burned (roofless houses with missing
//     walls, wrecked carts, ash on the ground),
//   - lumber camps at the forest edges, on the castle side,
//   - a stone quarry on a far hillside,
//   - tall landmarks on the highest far hills, spread around the circle: a
//     tall watchtower, a hexagon mage tower, a gatehouse, a ruined tower and
//     a small keep, all stacked from castle kit pieces.
// Planned in two steps: the flat places first (villages, fields, hamlets,
// the burned village, forests and lumber camps; the terrain flattens them),
// then the hilltop and hillside places on the finished terrain. Built from kit pieces (houses from wall tiles and roofs)
// into one StaticBatch: a few draw calls for all of it.
import { Group, Matrix4, Quaternion, Vector3 } from 'three';
import { BOARD, ROADS, SETTLEMENTS, type LandmarkKind } from '../config/game.js';
import { groundAt, polarX, polarZ } from '../rules/boardMath.js';
import type { Random } from '../rules/random.js';
import { loadTemplate, StaticBatch, type ModelTemplate } from './models.js';
import type { Road } from './roads.js';
import { campDistance, type CampSpot, type RoadField, type Terrain } from './terrain.js';

/** A round spot on the board (cm): its middle and radius. */
export interface Spot {
  x: number;
  z: number;
  size: number;
}

export type Crop = 'wheat' | 'corn' | 'pumpkin' | 'melon';

/** A farm field: its middle, size (cm, `length` along its own x), turn (radians) and crop. */
export interface Field extends Spot {
  length: number;
  width: number;
  yaw: number;
  crop: Crop;
  /** The village it belongs to, for the gate on that side. */
  village: Spot;
}

/** A tall landmark: its spot, kind, and turn (radians, local +x toward the castle). */
export interface Landmark extends Spot {
  kind: LandmarkKind;
  yaw: number;
}

export interface SettlementPlan {
  villages: Spot[];
  fields: Field[];
  forests: Spot[];
  towers: Spot[];
  windmill: Spot | null;
  ruins: Spot[];
  hamlets: Spot[];
  burned: Spot | null;
  lumber: Spot[];
  quarry: Spot | null;
  landmarks: Landmark[];
}

const UP = new Vector3(0, 1, 0);
const CROPS: Crop[] = ['wheat', 'corn', 'pumpkin', 'melon'];

const distance = (a: { x: number; z: number }, x: number, z: number): number => Math.hypot(a.x - x, a.z - z);

/** How far a board point is from the edge of the nearest spot in a list (cm, negative inside it). */
export function gapTo(spots: Spot[], x: number, z: number): number {
  let best = Infinity;
  for (const s of spots) best = Math.min(best, distance(s, x, z) - s.size);
  return best;
}

/** A random board point between two distances from the center, even over the area. */
function ringPoint(rng: Random, from: number, to: number): [number, number] {
  const r = Math.sqrt(rng.range(from * from, to * to));
  const a = rng.range(0, Math.PI * 2);
  return [polarX(r, a), polarZ(r, a)];
}

/** Gap from a spot's edge to the nearest road's edge (cm). Far from every road it is large. */
function roadGap(roads: RoadField, x: number, z: number, size: number): number {
  return roads.distance(x, z) - ROADS.width / 2 - size;
}

/**
 * Step 1, before the terrain: villages beside the roads, their fields, and
 * the forests. The villages and fields go back to the terrain as flat spots.
 */
export function planSettlements(roads: RoadField, camps: CampSpot[], rng: Random, keepClear: Spot[] = []): SettlementPlan {
  const { villages: V, farms: F, forests: W } = SETTLEMENTS;
  const villages: Spot[] = [];
  for (let tries = 0; villages.length < V.count && tries < 4000; tries++) {
    const [x, z] = ringPoint(rng, V.from, V.to);
    const size = rng.range(...V.radius);
    const gap = roadGap(roads, x, z, size);
    if (gap < V.roadGap[0] || gap > V.roadGap[1]) continue;
    if (campDistance(camps, x, z) < V.campGap || gapTo(keepClear, x, z) < size) continue;
    if (villages.some((v) => distance(v, x, z) < V.spacing)) continue;
    villages.push({ x, z, size });
  }
  const fields: Field[] = [];
  for (const village of villages) {
    const want = rng.int(F.perVillage[1] - F.perVillage[0] + 1) + F.perVillage[0];
    let made = 0;
    for (let tries = 0; made < want && tries < 60; tries++) {
      const length = rng.range(...F.length);
      const width = rng.range(...F.width);
      const size = Math.hypot(length, width) / 2;
      // Right next to the village, its long side facing it.
      const a = rng.range(0, Math.PI * 2);
      const d = village.size + F.gap + width / 2;
      const x = village.x + Math.sin(a) * d;
      const z = village.z - Math.cos(a) * d;
      if (Math.hypot(x, z) - size < 90 || Math.hypot(x, z) + size > BOARD.outerRadius - 40) continue;
      if (roadGap(roads, x, z, size) < 2) continue;
      if (campDistance(camps, x, z) < 40 || gapTo(keepClear, x, z) < size) continue;
      if (gapTo(villages, x, z) < size * 0.6 || fields.some((f) => distance(f, x, z) < f.size + size + 2)) continue;
      // Its local x along the village's edge, so the long side faces the village.
      fields.push({ x, z, size, length, width, yaw: Math.atan2(Math.cos(a), Math.sin(a)) + Math.PI / 2, crop: rng.pick(CROPS), village });
      made++;
    }
  }
  // Goblin lands: a hamlet behind each camp, straight out from it.
  const G = SETTLEMENTS.goblinHamlets;
  const hamlets: Spot[] = [];
  for (const camp of camps) {
    for (let tries = 0; tries < 40; tries++) {
      const size = rng.range(...G.radius);
      const out = Math.atan2(camp.x, -camp.z) + rng.range(-0.25, 0.25);
      const d = Math.hypot(camp.x, camp.z) + camp.size + rng.range(...G.gap) + size;
      if (d + size > BOARD.outerRadius - 30) continue;
      const x = polarX(d, out);
      const z = polarZ(d, out);
      if (roadGap(roads, x, z, size) < 3 || campDistance(camps, x, z) < 15) continue;
      hamlets.push({ x, z, size });
      break;
    }
  }
  // The burned village: far out between two camps, away from the goblin hamlets.
  const B = SETTLEMENTS.burnedVillage;
  let burned: Spot | null = null;
  for (let tries = 0; !burned && tries < 3000; tries++) {
    const [x, z] = ringPoint(rng, B.from, B.to);
    if (campDistance(camps, x, z) < B.campGap || gapTo(hamlets, x, z) < 60) continue;
    if (roadGap(roads, x, z, B.radius) < 6) continue;
    burned = { x, z, size: B.radius };
  }
  const forests: Spot[] = [];
  const homes = [...villages, ...fields, ...hamlets, ...(burned ? [burned] : [])];
  for (let tries = 0; forests.length < W.count && tries < 2000; tries++) {
    const [x, z] = ringPoint(rng, W.from, W.to);
    const size = rng.range(...W.radius);
    if (gapTo(homes, x, z) < W.clear + size * 0.5) continue;
    if (campDistance(camps, x, z) < 25 + size * 0.3) continue;
    if (forests.some((f) => distance(f, x, z) < f.size + size * 0.8)) continue;
    forests.push({ x, z, size });
  }
  // Lumber camps: at a forest's edge, on its castle side, where the wood is carried home.
  const L = SETTLEMENTS.lumberCamps;
  const lumber: Spot[] = [];
  for (const forest of forests) {
    if (lumber.length >= L.count) break;
    const r = Math.hypot(forest.x, forest.z);
    const k = (r - forest.size * 0.95) / r;
    const x = forest.x * k;
    const z = forest.z * k;
    if (roadGap(roads, x, z, L.radius) < 3 || campDistance(camps, x, z) < 20 || gapTo(homes, x, z) < 15) continue;
    lumber.push({ x, z, size: L.radius });
  }
  return { villages, fields, forests, towers: [], windmill: null, ruins: [], hamlets, burned, lumber, quarry: null, landmarks: [] };
}

/** The spots the terrain flattens: each village, field, hamlet, the burned village and the lumber camps, a little past the edge. */
export function flatSpots(plan: SettlementPlan): CampSpot[] {
  const flat = [...plan.villages, ...plan.fields, ...plan.hamlets, ...plan.lumber, ...(plan.burned ? [plan.burned] : [])];
  return flat.map((s) => ({ x: s.x, z: s.z, size: s.size + 1 }));
}

/** Step 2, on the finished terrain: watch towers on hilltops by the roads, the windmill, the wrecks by the camps. */
export function placeLandmarks(plan: SettlementPlan, terrain: Terrain, camps: CampSpot[], rng: Random, keepClear: Spot[] = []): void {
  const { towers: T, windmill: M, ruins: R } = SETTLEMENTS;
  // The triggers on the roads count as homes here: towers, the windmill and wrecks keep clear of them.
  const homes: Spot[] = [...plan.villages, ...plan.fields, ...keepClear];
  // Towers: the highest spots right beside a road.
  const candidates: { x: number; z: number; height: number }[] = [];
  for (let i = 0; i < 900; i++) {
    const [x, z] = ringPoint(rng, T.from, T.to);
    const gap = roadGap(terrain.roads, x, z, T.size);
    if (gap < T.roadGap[0] || gap > T.roadGap[1]) continue;
    if (gapTo(homes, x, z) < 20 || campDistance(camps, x, z) < 30) continue;
    candidates.push({ x, z, height: terrain.bump(x, z) });
  }
  candidates.sort((a, b) => b.height - a.height);
  for (const c of candidates) {
    if (plan.towers.length >= T.count) break;
    if (plan.towers.some((t) => distance(t, c.x, c.z) < T.spacing)) continue;
    plan.towers.push({ x: c.x, z: c.z, size: T.size });
  }
  // The windmill: the highest spot near a field.
  let best: { x: number; z: number; height: number } | null = null;
  for (let i = 0; i < 400 && plan.fields.length > 0; i++) {
    const field = rng.pick(plan.fields);
    const a = rng.range(0, Math.PI * 2);
    const d = field.size + rng.range(6, M.near);
    const x = field.x + Math.sin(a) * d;
    const z = field.z - Math.cos(a) * d;
    if (Math.hypot(x, z) < 110 || Math.hypot(x, z) > BOARD.outerRadius - 50) continue;
    if (roadGap(terrain.roads, x, z, 5) < 3 || gapTo(homes, x, z) < 6 || campDistance(camps, x, z) < 30) continue;
    if (gapTo(plan.towers, x, z) < 15) continue;
    const height = terrain.bump(x, z);
    if (!best || height > best.height) best = { x, z, height };
  }
  if (best) plan.windmill = { x: best.x, z: best.z, size: 6 };
  // Wrecks: one by each camp, off the road, in the camp's own direction.
  for (const camp of camps) {
    if (plan.ruins.length >= R.count) break;
    for (let tries = 0; tries < 60; tries++) {
      const a = rng.range(0, Math.PI * 2);
      const d = camp.size + rng.range(...R.campGap);
      const x = camp.x + Math.sin(a) * d;
      const z = camp.z - Math.cos(a) * d;
      const size = rng.range(...R.width) / 2;
      if (Math.hypot(x, z) + size > BOARD.outerRadius - 15 || Math.hypot(x, z) < 150) continue;
      if (roadGap(terrain.roads, x, z, size) < 3 || gapTo(homes, x, z) < 10) continue;
      plan.ruins.push({ x, z, size });
      break;
    }
  }
  // Out in the far ring: everything placed so far, to keep clear of.
  const taken = (): Spot[] => [...homes, ...plan.hamlets, ...plan.lumber, ...(plan.burned ? [plan.burned] : []), ...plan.ruins, ...plan.landmarks];
  /** Far spots that are clear of everything and not deep in a forest, highest first. */
  const farHills = (from: number, to: number, size: number, samples: number): { x: number; z: number; height: number }[] => {
    const found: { x: number; z: number; height: number }[] = [];
    for (let i = 0; i < samples; i++) {
      const [x, z] = ringPoint(rng, from, to);
      if (Math.hypot(x, z) + size > BOARD.outerRadius - 20) continue;
      if (roadGap(terrain.roads, x, z, size) < 8 || campDistance(camps, x, z) < 30 || gapTo(taken(), x, z) < 25) continue;
      if (plan.forests.some((f) => distance(f, x, z) < f.size * 0.6)) continue;
      found.push({ x, z, height: terrain.bump(x, z) });
    }
    return found.sort((a, b) => b.height - a.height);
  };
  // Tall landmarks on the highest far hills, spread around the circle.
  const K = SETTLEMENTS.landmarks;
  // Footprint across (cm): the wide ones need a hilltop that is not too steep, or one end would be buried deep.
  const footprint: Record<LandmarkKind, number> = { tallTower: 5, mageTower: 6, gatehouse: 11, ruinedTower: 5, keep: 14 };
  for (const hill of farHills(K.from, K.to, 10, 1500)) {
    if (plan.landmarks.length >= K.kinds.length) break;
    if (plan.landmarks.some((l) => distance(l, hill.x, hill.z) < K.spacing)) continue;
    const kind = K.kinds[plan.landmarks.length];
    const size = footprint[kind];
    if (size > 8 && groundAt(hill.x, hill.z) - lowestGround(hill.x, hill.z, size) > 3) continue;
    plan.landmarks.push({ x: hill.x, z: hill.z, size, kind, yaw: facing(hill.x, hill.z, 0, 0) });
  }
  // The quarry: a high far hillside, clear of the rest.
  const Q = SETTLEMENTS.quarry;
  const quarry = farHills(Q.from, Q.to, Q.radius, 600).find((h) => !plan.landmarks.some((l) => distance(l, h.x, h.z) < 60));
  if (quarry) plan.quarry = { x: quarry.x, z: quarry.z, size: Q.radius };
}

/** Every built spot (for the decor to keep away from), a little past its edge. */
export function builtSpots(plan: SettlementPlan): Spot[] {
  return [
    ...plan.villages.map((s) => ({ ...s, size: s.size + 3 })),
    ...plan.fields.map((s) => ({ ...s, size: s.size + 2 })),
    ...plan.towers.map((s) => ({ ...s, size: s.size + 3 })),
    ...(plan.windmill ? [{ ...plan.windmill, size: plan.windmill.size + 2 }] : []),
    ...plan.ruins.map((s) => ({ ...s, size: s.size + 2 })),
    ...plan.hamlets.map((s) => ({ ...s, size: s.size + 3 })),
    ...(plan.burned ? [{ ...plan.burned, size: plan.burned.size + 3 }] : []),
    ...plan.lumber.map((s) => ({ ...s, size: s.size + 1 })),
    ...(plan.quarry ? [{ ...plan.quarry, size: plan.quarry.size + 2 }] : []),
    ...plan.landmarks.map((s) => ({ ...s, size: s.size + 3 })),
  ];
}

const position = new Vector3();
const scale = new Vector3();
const turn = new Quaternion();

/** A placement: board point, ground height, turn and size. */
function place(x: number, y: number, z: number, yaw: number, size: number): Matrix4 {
  return new Matrix4().compose(position.set(x, y, z), turn.setFromAxisAngle(UP, yaw), scale.setScalar(size));
}

/** A piece's spot in its group's own frame: up a number of tiles, turned in quarter turns. */
function local(up: number, quarter: number): Matrix4 {
  return new Matrix4().makeRotationY((quarter * Math.PI) / 2).setPosition(0, up, 0);
}

/** The lowest ground under a square footprint (cm across), so a building on a slope never floats. */
function lowestGround(x: number, z: number, width: number): number {
  const h = width / 2;
  let low = groundAt(x, z);
  for (const [dx, dz] of [
    [-h, -h],
    [h, -h],
    [-h, h],
    [h, h],
  ]) {
    low = Math.min(low, groundAt(x + dx, z + dz));
  }
  return low;
}

/** Turn (radians) that points a piece's local +x from a spot toward a target. */
const facing = (fromX: number, fromZ: number, toX: number, toZ: number): number => Math.atan2(-(toZ - fromZ), toX - fromX);

/** Step 3: everything in the plan, built from kit pieces into a few merged meshes. */
export async function buildSettlements(plan: SettlementPlan, roads: Road[], rng: Random): Promise<Group> {
  const load = (path: string): Promise<ModelTemplate> => loadTemplate(`${path}.glb`, { keepOrigin: true });
  const town = (name: string): Promise<ModelTemplate> => load(`town/fantasy-town/${name}`);
  const [
    wall,
    wallDoor,
    wallWindow,
    wood,
    woodDoor,
    woodWindow,
    roofGable,
    roofPoint,
    chimney,
    stall,
    stallRed,
    stallGreen,
    cart,
    lantern,
    barrel,
    box,
    boxLarge,
    signpost,
    windmill,
    towerBase,
    towerMid,
    towerTop,
    dirtRow,
    wheat,
    corn,
    pumpkin,
    melon,
    fence,
    ...wrecks
  ] = await Promise.all([
    town('wall'),
    town('wall-door'),
    town('wall-window-shutters'),
    town('wall-wood'),
    town('wall-wood-door'),
    town('wall-wood-window-shutters'),
    town('roof-gable'),
    town('roof-point'),
    town('chimney'),
    town('stall'),
    town('stall-red'),
    town('stall-green'),
    town('cart'),
    town('lantern'),
    load('props/survival/barrel'),
    load('props/survival/box'),
    load('props/survival/box-large'),
    load('camp/survival/signpost'),
    town('windmill'),
    load('castle/castle-kit/tower-square-base'),
    load('castle/castle-kit/tower-square-mid-windows'),
    load('castle/castle-kit/tower-square-top-roof-high'),
    load('farm/nature/crops_dirtRow'),
    load('farm/nature/crops_wheatStageB'),
    load('farm/nature/crops_cornStageB'),
    load('farm/nature/crop_pumpkin'),
    load('farm/nature/crop_melon'),
    load('farm/nature/fence_simple'),
    ...['siege-catapult', 'siege-trebuchet', 'siege-ram', 'siege-ballista', 'siege-tower'].map((n) => load(`props/castle-kit/${n}-demolished`)),
  ]);
  const batch = new StaticBatch();
  const add = (template: ModelTemplate, matrix: Matrix4): void => batch.add(template, matrix);
  const H = SETTLEMENTS.houses;

  /** A house: four wall tiles (the door toward the square), one or two floors, a roof, sometimes a chimney. */
  const house = (x: number, z: number, yaw: number): void => {
    const set = rng.next() < H.woodShare ? { plain: wood, door: woodDoor, window: woodWindow } : { plain: wall, door: wallDoor, window: wallWindow };
    const floors = rng.next() < H.twoStoryShare ? 2 : 1;
    const base = place(x, lowestGround(x, z, H.size) - 0.15, z, yaw, H.size);
    for (let floor = 0; floor < floors; floor++) {
      for (let side = 0; side < 4; side++) {
        const piece = floor === 0 && side === 0 ? set.door : side % 2 === 0 || rng.next() < 0.5 ? set.window : set.plain;
        add(piece, base.clone().multiply(local(floor, side)));
      }
    }
    add(rng.next() < 0.6 ? roofGable : roofPoint, base.clone().multiply(local(floors, rng.int(2))));
    if (rng.next() < H.chimneyShare) add(chimney, base.clone().multiply(local(floors, rng.int(4))));
  };

  for (const village of plan.villages) {
    // Houses around the square, doors toward it.
    const count = rng.int(SETTLEMENTS.villages.houses[1] - SETTLEMENTS.villages.houses[0] + 1) + SETTLEMENTS.villages.houses[0];
    const start = rng.range(0, Math.PI * 2);
    for (let i = 0; i < count; i++) {
      const a = start + (i / count) * Math.PI * 2 + rng.range(-0.2, 0.2);
      const d = village.size * rng.range(0.55, 0.68);
      const x = village.x + Math.sin(a) * d;
      const z = village.z - Math.cos(a) * d;
      house(x, z, facing(x, z, village.x, village.z));
    }
    // The square: a stall, a lantern, a cart and some barrels and boxes.
    const y = (px: number, pz: number): number => groundAt(px, pz) - 0.05;
    const s = (dx: number, dz: number): [number, number] => [village.x + dx, village.z + dz];
    const [sx, sz] = s(rng.range(-2, 2), rng.range(-2, 2));
    add(rng.pick([stall, stallRed, stallGreen]), place(sx, y(sx, sz), sz, rng.range(0, Math.PI * 2), 3.2));
    const [lx, lz] = s(rng.range(-4, 4), rng.range(-4, 4));
    add(lantern, place(lx, y(lx, lz), lz, 0, 2.6));
    const [cx, cz] = s(rng.range(-5, 5), rng.range(-5, 5));
    add(cart, place(cx, y(cx, cz), cz, rng.range(0, Math.PI * 2), 3));
    for (let i = 0; i < 4; i++) {
      const [bx, bz] = s(rng.range(-5, 5), rng.range(-5, 5));
      add(rng.pick([barrel, box, boxLarge]), place(bx, y(bx, bz), bz, rng.range(0, Math.PI * 2), 3.4));
    }
    // A signpost where the village meets its road.
    signpostBy(village, roads, (x, z, yaw) => add(signpost, place(x, groundAt(x, z), z, yaw, 4.5)));
  }

  for (const field of plan.fields) buildField(field, add, { dirtRow, fence, crops: { wheat, corn, pumpkin, melon } });

  // Watch towers: base, a floor with windows, a high roof, on the lowest ground under them.
  const T = SETTLEMENTS.towers.size;
  for (const tower of plan.towers) {
    const base = place(tower.x, lowestGround(tower.x, tower.z, T) - 0.3, tower.z, rng.range(0, Math.PI * 2), T);
    add(towerBase, base);
    add(towerMid, base.clone().multiply(local(1.01, 0)));
    add(towerTop, base.clone().multiply(local(2.02, 0)));
  }
  // The windmill, its sails toward the giant.
  if (plan.windmill) {
    const { x, z } = plan.windmill;
    add(windmill, place(x, lowestGround(x, z, 4) - 0.3, z, facing(x, z, 0, 0), SETTLEMENTS.windmill.height / 3.11));
  }
  // Wrecked siege machines by the camps.
  for (const ruin of plan.ruins) {
    const width = ruin.size * 2;
    add(rng.pick(wrecks), place(ruin.x, lowestGround(ruin.x, ruin.z, width * 0.6) - 0.2, ruin.z, rng.range(0, Math.PI * 2), width / 2.1));
  }
  await buildFarPlaces(plan, add, { walls: [wall, wallWindow, wood, woodWindow, wallDoor, woodDoor], roof: roofGable, cart, barrel, box, boxLarge }, rng);
  const group = batch.build();
  group.name = 'settlements';
  return group;
}

type Add = (template: ModelTemplate, matrix: Matrix4) => void;

/** Kit pieces from the villages that the burned village reuses. */
interface VillageParts {
  walls: ModelTemplate[];
  roof: ModelTemplate;
  cart: ModelTemplate;
  barrel: ModelTemplate;
  box: ModelTemplate;
  boxLarge: ModelTemplate;
}

/** A piece's spot in its group's own frame: moved (tiles), turned around y, and stretched. */
function piece(x: number, y: number, z: number, yaw = 0, sx = 1, sy = 1, sz = 1): Matrix4 {
  return new Matrix4().compose(position.set(x, y, z), turn.setFromAxisAngle(UP, yaw), scale.set(sx, sy, sz));
}

/** The far places: tall landmarks, goblin hamlets, the burned village, lumber camps and the quarry. */
async function buildFarPlaces(plan: SettlementPlan, add: Add, village: VillageParts, rng: Random): Promise<void> {
  const tile = (path: string): Promise<ModelTemplate> => loadTemplate(`${path}.glb`, { keepOrigin: true });
  // Props are fitted to 1 cm tall, resting on the ground, so their size is their height.
  const prop = (path: string): Promise<ModelTemplate> => loadTemplate(`${path}.glb`, { height: 1 });
  const castle = (name: string): Promise<ModelTemplate> => tile(`castle/castle-kit/${name}`);
  const [sqBase, sqMid, sqMidWindows, sqMidDoor, sqMidOpen, sqMidOpenSimple, sqRoofHigh, flatTop, hexBase, hexMid, hexTop, hexRoof, doorway, gate, flag] = await Promise.all([
    castle('tower-square-base'),
    castle('tower-square-mid'),
    castle('tower-square-mid-windows'),
    castle('tower-square-mid-door'),
    castle('tower-square-mid-open'),
    castle('tower-square-mid-open-simple'),
    castle('tower-square-top-roof-high'),
    castle('tower-top'),
    castle('tower-hexagon-base'),
    castle('tower-hexagon-mid'),
    castle('tower-hexagon-top'),
    castle('tower-hexagon-roof'),
    castle('wall-doorway'),
    castle('gate'),
    castle('flag'),
  ]);
  const goblin = (name: string): Promise<ModelTemplate> => prop(`camp/goblin/${name}`);
  const [cabin1, cabin2, stoneHouse, cage, fence1, fence2, tent1, tent3, tent5] = await Promise.all(
    ['cabbin_1', 'cabbin_2', 'stone_house', 'branch_cage', 'branch_fence_1', 'branch_fence_2', 'tent_1', 'tent_3', 'tent_5'].map(goblin),
  );
  const [campfire, logFire, tentOpen, logStack, log, trunk, planks, stoneLarge, stone, rockA, rockB, rockC] = await Promise.all([
    prop('camp/nature/campfire_stones'),
    prop('camp/nature/campfire_logs'),
    prop('camp/nature/tent_detailedOpen'),
    prop('plants/nature/log_stack'),
    prop('trees/survival/tree-log'),
    prop('trees/survival/tree-trunk'),
    prop('props/survival/resource-planks'),
    prop('rocks/survival/resource-stone-large'),
    prop('rocks/survival/resource-stone'),
    prop('rocks/survival/rock-a'),
    prop('rocks/survival/rock-b'),
    prop('rocks/survival/rock-c'),
  ]);

  /** Stacks pieces straight up from a base placement, each this many tiles tall. */
  const stack = (base: Matrix4, pieces: [ModelTemplate, number][], at = new Vector3()): number => {
    let y = 0;
    for (const [template, height] of pieces) {
      add(template, base.clone().multiply(piece(at.x, at.y + y, at.z)));
      y += height;
    }
    return y;
  };
  /** A prop on the ground near a spot: `d` cm out in a random direction, `size` cm tall, turned at random. */
  const scatter = (template: ModelTemplate, spot: Spot, d: number, size: number, tilt = 0): void => {
    const a = rng.range(0, Math.PI * 2);
    const x = spot.x + Math.sin(a) * d;
    const z = spot.z - Math.cos(a) * d;
    const m = place(x, groundAt(x, z) - size * 0.05, z, rng.range(0, Math.PI * 2), size);
    if (tilt) m.multiply(new Matrix4().makeRotationZ(tilt));
    add(template, m);
  };

  // Tall landmarks, each stacked from castle kit pieces on the lowest ground under it.
  const K = SETTLEMENTS.landmarks;
  for (const mark of plan.landmarks) {
    const s = mark.kind === 'mageTower' ? K.size * 1.15 : mark.kind === 'keep' ? K.size * 0.95 : K.size;
    const base = place(mark.x, lowestGround(mark.x, mark.z, mark.size) - 0.4, mark.z, mark.yaw, s);
    if (mark.kind === 'tallTower') {
      stack(base, [
        [sqBase, 1.01],
        [sqMidDoor, 1.01],
        [sqMidWindows, 1.01],
        [sqMid, 1.01],
        [sqMidWindows, 1.01],
        [sqRoofHigh, 1.35],
      ]);
    } else if (mark.kind === 'mageTower') {
      stack(base, [[hexBase, 1.31], ...Array.from({ length: 5 }, (): [ModelTemplate, number] => [hexMid, 0.46]), [hexTop, 0.13], [hexRoof, 0.83]]);
    } else if (mark.kind === 'gatehouse') {
      // Two towers with flags, the doorway between them (its way through toward the castle) and a bridge over it.
      for (const side of [-1, 1]) {
        const at = new Vector3(0, 0, side);
        const top = stack(base, [[sqBase, 1.01], [sqMidWindows, 1.01], [sqMid, 1.01], [flatTop, 0.13]], at);
        add(flag, base.clone().multiply(piece(0, top, side)));
      }
      add(doorway, base.clone().multiply(piece(0.25, 0, 0)));
      add(gate, base.clone().multiply(piece(0, 0, 0)));
      add(sqBase, base.clone().multiply(piece(0, 1.31, 0, 0, 0.6, 0.6, 1.05)));
    } else if (mark.kind === 'ruinedTower') {
      stack(base, [
        [sqBase, 1.01],
        [sqMidOpen, 1.01],
        [sqMidOpenSimple, 0.88],
      ]);
      // A floor fallen beside it, on its side, and cut stones around.
      add(sqMid, base.clone().multiply(piece(1.5, 0.47, 0.4, 0.5)).multiply(new Matrix4().makeRotationZ(Math.PI / 2)));
      for (let i = 0; i < 6; i++) scatter(rng.next() < 0.5 ? stoneLarge : stone, mark, rng.range(3, 9), rng.range(0.6, 1.4));
    } else {
      // The keep: four hexagon towers joined by walls, a gate toward the castle, a square hall in the middle.
      const c = 1.5;
      for (const [cx, cz] of [
        [-c, -c],
        [c, -c],
        [-c, c],
        [c, c],
      ]) {
        stack(base, [[hexBase, 1.31], [hexMid, 0.46], [hexMid, 0.46], [hexTop, 0.13], [hexRoof, 0.83]], new Vector3(cx, 0, cz));
      }
      const wallHeight = 0.9 / 1.01;
      const thick = 0.28;
      const long = c * 2 - 0.7;
      add(sqBase, base.clone().multiply(piece(-c, 0, 0, 0, thick, wallHeight, long)));
      add(sqBase, base.clone().multiply(piece(0, 0, -c, 0, long, wallHeight, thick)));
      add(sqBase, base.clone().multiply(piece(0, 0, c, 0, long, wallHeight, thick)));
      // The front wall (toward the castle) in two parts, the gate between them.
      const part = (long - 0.7) / 2;
      for (const side of [-1, 1]) add(sqBase, base.clone().multiply(piece(c, 0, side * (0.35 + part / 2), 0, thick, wallHeight, part)));
      add(gate, base.clone().multiply(piece(c, 0, 0)));
      stack(base, [
        [sqBase, 1.01],
        [sqMidWindows, 1.01],
        [sqRoofHigh, 1.35],
      ]);
    }
  }

  // Goblin hamlets: a cabin, tents around it, a campfire, sometimes a cage, branch fences on the edge.
  const G = SETTLEMENTS.goblinHamlets;
  for (const hamlet of plan.hamlets) {
    const ground = (x: number, z: number): number => groundAt(x, z) - 0.1;
    const cabin = rng.pick([cabin1, cabin2, stoneHouse]);
    add(cabin, place(hamlet.x, ground(hamlet.x, hamlet.z), hamlet.z, facing(hamlet.x, hamlet.z, 0, 0), G.cabinHeight));
    const tents = 2 + rng.int(2);
    const start = rng.range(0, Math.PI * 2);
    for (let i = 0; i < tents; i++) {
      const a = start + (i / tents) * Math.PI * 2;
      const x = hamlet.x + Math.sin(a) * hamlet.size * 0.62;
      const z = hamlet.z - Math.cos(a) * hamlet.size * 0.62;
      add(rng.pick([tent1, tent3, tent5]), place(x, ground(x, z), z, facing(x, z, hamlet.x, hamlet.z), G.tentHeight * rng.range(0.85, 1.1)));
    }
    scatter(campfire, hamlet, hamlet.size * 0.35, 0.9);
    if (rng.next() < 0.6) scatter(cage, hamlet, hamlet.size * 0.45, 3.2);
    const fences = 4;
    for (let i = 0; i < fences; i++) {
      const a = start + ((i + 0.5) / fences) * Math.PI * 2;
      const x = hamlet.x + Math.sin(a) * hamlet.size * 1.02;
      const z = hamlet.z - Math.cos(a) * hamlet.size * 1.02;
      // Along the edge: turned across the way out from the middle.
      add(rng.pick([fence1, fence2]), place(x, ground(x, z), z, -a, 1.6));
    }
  }

  // The burned village: roofless houses with missing walls, a roof fallen beside some, a toppled cart, scattered barrels.
  if (plan.burned) {
    const b = plan.burned;
    const size = SETTLEMENTS.houses.size;
    const houses = SETTLEMENTS.burnedVillage.houses;
    const start = rng.range(0, Math.PI * 2);
    for (let i = 0; i < houses; i++) {
      const a = start + (i / houses) * Math.PI * 2 + rng.range(-0.2, 0.2);
      const x = b.x + Math.sin(a) * b.size * 0.6;
      const z = b.z - Math.cos(a) * b.size * 0.6;
      const base = place(x, lowestGround(x, z, size) - 0.2, z, facing(x, z, b.x, b.z), size);
      let standing = 0;
      for (let side = 0; side < 4; side++) {
        // At least one wall stands, so it still reads as a house.
        if (rng.next() < 0.45 && !(side === 3 && standing === 0)) continue;
        add(rng.pick(village.walls), base.clone().multiply(local(0, side)));
        standing++;
      }
      if (rng.next() < 0.5) add(village.roof, base.clone().multiply(piece(1.3, 0, 0.2, rng.range(-0.4, 0.4))).multiply(new Matrix4().makeRotationZ(0.45)));
    }
    const cartAt = place(b.x, groundAt(b.x, b.z) + 1, b.z, rng.range(0, Math.PI * 2), 3).multiply(new Matrix4().makeRotationZ(Math.PI / 2));
    add(village.cart, cartAt);
    for (let i = 0; i < 6; i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = rng.range(2, b.size * 0.5);
      const x = b.x + Math.sin(a) * d;
      const z = b.z - Math.cos(a) * d;
      // Barrels knocked over on their side, boxes upright.
      const knocked = rng.next() < 0.5;
      const m = place(x, groundAt(x, z) + (knocked ? 0.4 : 0), z, rng.range(0, Math.PI * 2), 3.4);
      if (knocked) m.multiply(new Matrix4().makeRotationZ(Math.PI / 2));
      add(knocked ? village.barrel : rng.pick([village.box, village.boxLarge]), m);
    }
  }

  // Lumber camps: log stacks, logs and planks, stumps around, a tent and a fire.
  for (const camp of plan.lumber) {
    for (let i = 0; i < 2; i++) scatter(logStack, camp, rng.range(1, 4), 1.6);
    for (let i = 0; i < 3; i++) scatter(log, camp, rng.range(2, 6), 0.7);
    for (let i = 0; i < 5; i++) scatter(trunk, camp, rng.range(4, camp.size), 0.6);
    for (let i = 0; i < 2; i++) scatter(planks, camp, rng.range(1, 5), 0.35);
    scatter(tentOpen, camp, camp.size * 0.6, 2.2);
    scatter(logFire, camp, 1.5, 0.6);
  }

  // The quarry: big rocks on the hillside, cut stones around them, planks.
  if (plan.quarry) {
    const q = plan.quarry;
    for (let i = 0; i < 5; i++) scatter(rng.pick([rockA, rockB, rockC]), q, rng.range(0, q.size * 0.6), rng.range(3, 5));
    for (let i = 0; i < 7; i++) scatter(stoneLarge, q, rng.range(2, q.size), rng.range(1.1, 1.9));
    for (let i = 0; i < 10; i++) scatter(stone, q, rng.range(2, q.size), rng.range(0.6, 1));
    for (let i = 0; i < 2; i++) scatter(planks, q, rng.range(3, q.size), 0.35);
  }
}

/** A farm field: rows of tilled dirt with one crop, and a fence around with a gap toward the village. */
function buildField(
  field: Field,
  add: (template: ModelTemplate, matrix: Matrix4) => void,
  parts: { dirtRow: ModelTemplate; fence: ModelTemplate; crops: Record<Crop, ModelTemplate> },
): void {
  const F = SETTLEMENTS.farms;
  const cos = Math.cos(field.yaw);
  const sin = Math.sin(field.yaw);
  /** A point in the field's own frame (along its length, across it) to board x and z. */
  const toBoard = (u: number, v: number): [number, number] => [field.x + u * cos + v * sin, field.z - u * sin + v * cos];
  const cropSize: Record<Crop, number> = { wheat: 3, corn: 2.2, pumpkin: 3.4, melon: 3.4 };
  const rows = Math.max(2, Math.floor(field.width / F.rowGap));
  const rowTile = F.rowGap / 0.62;
  for (let r = 0; r < rows; r++) {
    const v = (r - (rows - 1) / 2) * F.rowGap;
    const tiles = Math.max(1, Math.round(field.length / rowTile));
    for (let t = 0; t < tiles; t++) {
      const u = (t - (tiles - 1) / 2) * rowTile;
      const [x, z] = toBoard(u, v);
      add(parts.dirtRow, place(x, groundAt(x, z) - 0.05, z, field.yaw, rowTile));
    }
    const crops = Math.max(1, Math.floor(field.length / F.cropGap));
    for (let c = 0; c < crops; c++) {
      const u = (c - (crops - 1) / 2) * F.cropGap;
      const [x, z] = toBoard(u, v);
      add(parts.crops[field.crop], place(x, groundAt(x, z), z, field.yaw + (c % 4) * (Math.PI / 2), cropSize[field.crop]));
    }
  }
  // The fence: pieces along each edge, the fence line on the edge, one piece left out toward the village.
  const halfL = field.length / 2 + 0.6;
  const halfW = field.width / 2 + 0.6;
  const edges: { center: [number, number]; along: number; normal: [number, number] }[] = [
    { center: [0, -halfW], along: halfL * 2, normal: [0, -1] },
    { center: [0, halfW], along: halfL * 2, normal: [0, 1] },
    { center: [-halfL, 0], along: halfW * 2, normal: [-1, 0] },
    { center: [halfL, 0], along: halfW * 2, normal: [1, 0] },
  ];
  // The edge whose outside points most toward the village gets the gap.
  let gateEdge = 0;
  let bestDot = -Infinity;
  edges.forEach((e, i) => {
    const [nx, nz] = toBoard(e.normal[0], e.normal[1]);
    const dot = (nx - field.x) * (field.village.x - field.x) + (nz - field.z) * (field.village.z - field.z);
    if (dot > bestDot) {
      bestDot = dot;
      gateEdge = i;
    }
  });
  edges.forEach((edge, i) => {
    const count = Math.max(1, Math.round(edge.along / F.fence));
    const piece = edge.along / count;
    const [nu, nv] = edge.normal;
    for (let k = 0; k < count; k++) {
      if (i === gateEdge && k === Math.floor(count / 2)) continue;
      const t = (k - (count - 1) / 2) * piece;
      // Along the edge: across the normal.
      const u = edge.center[0] + t * -nv - nu * 0.5 * piece;
      const v = edge.center[1] + t * nu - nv * 0.5 * piece;
      const [x, z] = toBoard(u, v);
      // The piece's fence line is its local -z side: turn that outward.
      const [ox, oz] = toBoard(nu, nv);
      const yaw = Math.atan2(-(ox - field.x), -(oz - field.z));
      add(parts.fence, place(x, groundAt(x, z), z, yaw, piece));
    }
  });
}

/** Finds where a village meets its nearest road and stands a signpost there, on the village's side. */
function signpostBy(village: Spot, roads: Road[], put: (x: number, z: number, yaw: number) => void): void {
  let nearest: Road | null = null;
  let best = Infinity;
  for (const road of roads) {
    const d = road.distanceTo(village.x, village.z);
    if (d < best) {
      best = d;
      nearest = road;
    }
  }
  if (!nearest) return;
  const along = nearest.nearestAlong(village.x, village.z);
  const p = new Vector3();
  const q = new Vector3();
  const side = ROADS.width / 2 + 1.6;
  nearest.pointAt(along, side, p);
  nearest.pointAt(along, -side, q);
  const spot = distance(village, p.x, p.z) < distance(village, q.x, q.z) ? p : q;
  const dir = nearest.directionAt(along, new Vector3());
  put(spot.x, spot.z, Math.atan2(-dir.z, dir.x));
}
