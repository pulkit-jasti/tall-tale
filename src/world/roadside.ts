// v3 2.0: a livelier near board (ROADSIDE in config). Small medieval scenes
// beside the roads between the castle and the villages, where the board was
// empty: cottages, a fountain, carts, fences, tents, banners that wave, ruined
// walls, small watchtowers, signposts and workbenches. Decor only, no
// colliders, no gameplay:
//   - beside a road, never on one (checked against every road),
//   - never on a trap's spot or in the line from the giant to a trap,
//   - clear of the villages, fields, story scenes, road torches and each other,
//   - the tall kinds only farther out, so nothing near the wall hides a goblin.
// Planned after the terrain (it stands on the hills) and before the decor
// (the trees keep away from it). Built from kit models (public/gltf/,
// docs/assets.md) into one StaticBatch, plus the banners in their own merged
// mesh whose shader sways them from one shared clock (no per-frame cost but a
// uniform). Cottage windows and lanterns go to the night lights.
import { BufferAttribute, type BufferGeometry, Group, type Material, Matrix4, Mesh, type MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ROADS, ROADSIDE, type RoadsideKind } from '../config/game.js';
import { applyNightFade } from '../fx/nightFade.js';
import { groundAt } from '../rules/boardMath.js';
import type { Random } from '../rules/random.js';
import { loadTemplate, StaticBatch, type ModelTemplate } from './models.js';
import type { RoadTorch } from './nightLights.js';
import type { Road } from './roads.js';
import { addHouse, gapTo, lowestGround, type HouseParts, type Spot } from './settlements.js';
import type { RoadField } from './terrain.js';

/** One planned scene: its spot (size = footprint radius), kind, the road's direction (yaw of local +x along it) and the turn that faces the road. */
export interface RoadsideScene extends Spot {
  kind: RoadsideKind;
  along: number;
  face: number;
}

const UP = new Vector3(0, 1, 0);
const KINDS = Object.keys(ROADSIDE.kinds) as RoadsideKind[];

/** How far a point is beside the line from the board's middle to a target, if it is nearer the middle than the target (else Infinity). */
function besideSight(x: number, z: number, target: Spot): number {
  const len2 = target.x * target.x + target.z * target.z;
  if (len2 < 1e-6) return Infinity;
  const t = (x * target.x + z * target.z) / len2;
  if (t <= 0 || t >= 1) return Infinity;
  return Math.hypot(x - target.x * t, z - target.z * t);
}

/** A kind picked by weight from those allowed this far out, or null. */
function pickKind(r: number, rng: Random): RoadsideKind | null {
  const allowed = KINDS.filter((k) => r >= ROADSIDE.kinds[k].from);
  let total = 0;
  for (const k of allowed) total += ROADSIDE.kinds[k].weight;
  if (total <= 0) return null;
  let roll = rng.range(0, total);
  for (const k of allowed) {
    roll -= ROADSIDE.kinds[k].weight;
    if (roll < 0) return k;
  }
  return allowed[allowed.length - 1];
}

/**
 * Walks every road from end to end and tries a scene every ROADSIDE.every
 * cm, the sides taking turns. `taken` is everything built (villages, fields,
 * story scenes, landmarks), `traps` the triggers' keep-clear spots.
 */
export function planRoadside(roads: Road[], field: RoadField, taken: Spot[], traps: Spot[], torches: RoadTorch[], rng: Random): RoadsideScene[] {
  const R = ROADSIDE;
  const scenes: RoadsideScene[] = [];
  const edge = ROADS.width / 2;
  const at = new Vector3();
  const ahead = new Vector3();
  let side = rng.next() < 0.5 ? 1 : -1;
  for (const road of roads) {
    for (let d = rng.range(0, R.every[1]); d < road.length && scenes.length < R.max; d += rng.range(...R.every)) {
      road.pointAt(d, 0, at);
      const centerR = Math.hypot(at.x, at.z);
      if (centerR < R.from - 4 || centerR > R.to) continue;
      const kind = pickKind(centerR, rng);
      if (!kind) continue;
      const size = R.kinds[kind].radius;
      const out = edge + rng.range(...R.roadGap) + size;
      // This side first, the other if it does not fit.
      for (const s of [side, -side]) {
        road.pointAt(d, out * s, at);
        const x = at.x;
        const z = at.z;
        const r = Math.hypot(x, z);
        if (r < R.kinds[kind].from || r > R.to) continue;
        if (field.distance(x, z) < edge + size + R.roadGap[0] * 0.5) continue;
        if (gapTo(taken, x, z) < size + R.gap || gapTo(scenes, x, z) < size + R.gap) continue;
        if (gapTo(traps, x, z) < size + R.trapGap) continue;
        if (traps.some((t) => besideSight(x, z, t) < size + R.sightGap)) continue;
        if (torches.some((t) => Math.hypot(t.at.x - x, t.at.z - z) < size + R.torchGap)) continue;
        // The road's direction here (local +x along it), and the turn that faces the road from the scene.
        road.pointAt(Math.min(road.length, d + 2), 0, ahead);
        road.pointAt(Math.max(0, d - 2), 0, at);
        ahead.sub(at);
        const along = Math.atan2(-ahead.z, ahead.x);
        road.pointAt(d, 0, at);
        const face = Math.atan2(-(at.z - z), at.x - x);
        scenes.push({ x, z, size, kind, along, face });
        side = -s;
        break;
      }
    }
  }
  return scenes;
}

/** The banners' sway clock (seconds), shared with their shader. */
const bannerTime = { value: 0 };

/** Moves the banners' wave on (decor only). Called once a frame. */
export function updateRoadside(dt: number): void {
  bannerTime.value = (bannerTime.value + dt) % 3600;
}

const position = new Vector3();
const turn = new Quaternion();
const scale = new Vector3();

function place(x: number, y: number, z: number, yaw: number, size: number): Matrix4 {
  return new Matrix4().compose(position.set(x, y, z), turn.setFromAxisAngle(UP, yaw), scale.setScalar(size));
}

/** A spot beside a scene's middle: `a` along the road, `b` away from it (cm). */
function offset(scene: RoadsideScene, a: number, b: number): [number, number] {
  const ca = Math.cos(scene.along);
  const sa = Math.sin(scene.along);
  // Local +x along the road is (cos, -sin) on the board; away from the road is the opposite of `face`.
  const fx = Math.cos(scene.face);
  const fz = -Math.sin(scene.face);
  return [scene.x + ca * a - fx * b, scene.z - sa * a - fz * b];
}

/**
 * Merges the banners into one mesh with a `sway` attribute (how much each
 * point moves: 0 at the foot, 1 at the top, and each banner's own phase), and
 * gives it a material that waves them in the vertex shader plus the night fade.
 */
function buildBanners(template: ModelTemplate, placements: Matrix4[], rng: Random): Mesh | null {
  if (placements.length === 0) return null;
  const parts: BufferGeometry[] = [];
  const found: { material?: Material } = {};
  const height = Math.max(template.size.y, 1e-3);
  template.object.updateMatrixWorld(true);
  for (const matrix of placements) {
    const phase = rng.range(0, Math.PI * 2);
    template.object.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      if (!found.material) found.material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material).clone();
      let geometry = mesh.geometry.clone();
      for (const name of Object.keys(geometry.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geometry.deleteAttribute(name);
      if (geometry.index) geometry = geometry.toNonIndexed();
      // In the template's space first: the foot is at y = 0, the top at its height.
      geometry.applyMatrix4(mesh.matrixWorld);
      const pos = geometry.getAttribute('position');
      const sway = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i++) {
        const share = Math.min(1, Math.max(0, pos.getY(i) / height));
        sway[i * 2] = share * share;
        sway[i * 2 + 1] = phase;
      }
      geometry.setAttribute('sway', new BufferAttribute(sway, 2));
      geometry.applyMatrix4(matrix);
      parts.push(geometry);
    });
  }
  const merged = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  if (!merged || !found.material) return null;
  const mat = found.material as MeshStandardMaterial;
  const R = ROADSIDE;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.bannerTime = bannerTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 sway;\nuniform float bannerTime;')
      .replace(
        '#include <begin_vertex>',
        [
          '#include <begin_vertex>',
          // A wave that runs along the cloth (by board position), each banner at its own phase. The foot never moves.
          `float bannerWave = bannerTime * ${R.bannerSpeed.toFixed(3)} + sway.y + (position.x + position.z) * ${R.bannerRipple.toFixed(3)};`,
          `transformed.x += sin(bannerWave) * ${R.bannerSway.toFixed(3)} * sway.x;`,
          `transformed.z += cos(bannerWave * 1.3) * ${(R.bannerSway * 0.6).toFixed(3)} * sway.x;`,
        ].join('\n'),
      );
    applyNightFade(shader);
  };
  mat.customProgramCacheKey = () => 'roadsideBanner';
  const mesh = new Mesh(merged, mat);
  mesh.name = 'roadsideBanners';
  return mesh;
}

/** Builds every planned scene. userData: `windows` and `lanterns` (placements, for the night lights). */
export async function buildRoadside(scenes: RoadsideScene[], rng: Random): Promise<Group> {
  const S = ROADSIDE.sizes;
  const tile = (path: string): Promise<ModelTemplate> => loadTemplate(`${path}.glb`, { keepOrigin: true });
  // Props are fitted to 1 cm (tall, or across), resting on the ground, so their scale is their size.
  const tall = (path: string): Promise<ModelTemplate> => loadTemplate(`${path}.glb`, { height: 1 });
  const wide = (path: string): Promise<ModelTemplate> => loadTemplate(`${path}.glb`, { width: 1 });
  const town = (name: string): string => `town/fantasy-town/${name}`;
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
    lantern,
    fountain,
    cart,
    cartHigh,
    fence,
    fenceBroken,
    tent,
    tentCanvas,
    fire,
    bannerRed,
    bannerGreen,
    ruinStone,
    ruinWood,
    rocks,
    towerBase,
    towerMid,
    towerTop,
    signpost,
    workbench,
    planks,
    woodPile,
    barrel,
    crate,
    bucket,
    wheel,
  ] = await Promise.all([
    tile(town('wall')),
    tile(town('wall-door')),
    tile(town('wall-window-shutters')),
    tile(town('wall-wood')),
    tile(town('wall-wood-door')),
    tile(town('wall-wood-window-shutters')),
    tile(town('roof-gable')),
    tile(town('roof-point')),
    tile(town('chimney')),
    // Same as the village lanterns (keepOrigin, scaled), so the night lights' lantern height fits.
    tile(town('lantern')),
    wide(town('fountain-round')),
    wide(town('cart')),
    wide(town('cart-high')),
    wide(town('fence')),
    wide(town('fence-broken')),
    tall('camp/survival/tent'),
    tall('camp/survival/tent-canvas'),
    wide('camp/survival/campfire-pit'),
    tall(town('banner-red')),
    tall(town('banner-green')),
    wide(town('wall-broken')),
    wide(town('wall-wood-broken')),
    wide('props/castle-kit/rocks-small'),
    tile('castle/castle-kit/tower-square-base'),
    tile('castle/castle-kit/tower-square-mid-windows'),
    tile('castle/castle-kit/tower-square-top-roof-high'),
    tall('props/survival/signpost-single'),
    wide('props/survival/workbench'),
    wide('props/survival/resource-planks'),
    wide('props/survival/resource-wood'),
    tall('props/survival/barrel'),
    tall('props/survival/box-large'),
    tall('props/survival/bucket'),
    wide(town('wheel')),
  ]);
  const batch = new StaticBatch();
  const windows: Matrix4[] = [];
  const lanterns: Matrix4[] = [];
  const bannerPlaces: { template: ModelTemplate; matrix: Matrix4 }[] = [];
  const add = (template: ModelTemplate, matrix: Matrix4): void => {
    batch.add(template, matrix);
    if (template === wallWindow || template === woodWindow) windows.push(matrix.clone());
    else if (template === lantern) lanterns.push(matrix.clone());
  };
  const houseParts: HouseParts = { wall, wallDoor, wallWindow, wood, woodDoor, woodWindow, roofGable, roofPoint, chimney };
  /** A prop at a spot beside the scene's middle, on the ground, turned and sized. */
  const prop = (scene: RoadsideScene, template: ModelTemplate, a: number, b: number, yaw: number, size: number, sink = 0.08): void => {
    const [x, z] = offset(scene, a, b);
    add(template, place(x, groundAt(x, z) - size * sink, z, yaw, size));
  };
  const banner = (scene: RoadsideScene, a: number, b: number): void => {
    const [x, z] = offset(scene, a, b);
    const size = S.banner * rng.range(0.9, 1.1);
    // The cloth (the model's +x side, as at the camp gates) faces the road.
    bannerPlaces.push({ template: rng.next() < 0.5 ? bannerRed : bannerGreen, matrix: place(x, groundAt(x, z) - 0.1, z, scene.face, size) });
  };
  const anyYaw = (): number => rng.range(0, Math.PI * 2);

  for (const scene of scenes) {
    const { along, face } = scene;
    switch (scene.kind) {
      case 'cottage': {
        // One house, its door toward the road, with a wood pile or barrels by it.
        addHouse(add, houseParts, scene.x, scene.z, face, rng, 1);
        const side = rng.next() < 0.5 ? 1 : -1;
        if (rng.next() < 0.5) prop(scene, woodPile, side * 3.6, 0, along, 2.2);
        else for (let i = 0; i < 2; i++) prop(scene, barrel, side * (3.4 + i * 1.1), rng.range(-0.6, 0.6), anyYaw(), S.crate);
        break;
      }
      case 'fountain': {
        // The well of the road: a round fountain, a bucket, a lantern for the night.
        const [x, z] = [scene.x, scene.z];
        add(fountain, place(x, lowestGround(x, z, S.fountainWidth) - 0.1, z, anyYaw(), S.fountainWidth));
        prop(scene, bucket, 2.8, -1, anyYaw(), 0.9);
        const [lx, lz] = offset(scene, -2.6, -1.4);
        add(lantern, place(lx, groundAt(lx, lz) - 0.05, lz, 0, S.lanternScale));
        break;
      }
      case 'cart': {
        // A cart parked along the road, crates beside it, sometimes a spare wheel leaning.
        prop(scene, rng.next() < 0.5 ? cart : cartHigh, 0, 0, along + (rng.next() < 0.5 ? 0 : Math.PI), S.cartWidth, 0.04);
        for (let i = 0; i < 2; i++) prop(scene, rng.next() < 0.5 ? crate : barrel, rng.range(-1.8, 1.8), 2.2 + rng.range(-0.3, 0.4), anyYaw(), S.crate);
        if (rng.next() < 0.5) prop(scene, wheel, rng.range(-1, 1), -1.6, anyYaw(), S.wheelWidth, 0.3);
        break;
      }
      case 'fence': {
        // A short run of fence along the road, one piece sometimes broken.
        const pieces = 3;
        for (let i = 0; i < pieces; i++) {
          const a = (i - (pieces - 1) / 2) * S.fenceWidth * 0.98;
          prop(scene, rng.next() < 0.25 ? fenceBroken : fence, a, 0, along, S.fenceWidth, 0.04);
        }
        break;
      }
      case 'tent': {
        // A traveler's tent facing the road, its fire pit in front.
        prop(scene, rng.next() < 0.5 ? tent : tentCanvas, 0, 0.8, face, S.tent, 0.04);
        prop(scene, fire, rng.range(-0.8, 0.8), -2.2, anyYaw(), S.fireWidth, 0.1);
        break;
      }
      case 'banner':
        banner(scene, 0, 0);
        break;
      case 'ruin': {
        // An old broken wall: two pieces in an L, rubble at its foot.
        const piece = rng.next() < 0.6 ? ruinStone : ruinWood;
        const w = 4.2;
        prop(scene, piece, 0, 0.8, along, w, 0.06);
        prop(scene, piece, w * 0.5 * (rng.next() < 0.5 ? 1 : -1), 0.8 + w * 0.5, along + Math.PI / 2, w * 0.8, 0.06);
        prop(scene, rocks, rng.range(-1.5, 1.5), -1.2, anyYaw(), 2.4, 0.2);
        break;
      }
      case 'watchtower': {
        // A small stone lookout watching the road: base, a floor with windows, a high roof.
        const T = S.towerTile;
        const base = place(scene.x, lowestGround(scene.x, scene.z, T) - 0.3, scene.z, face, T);
        add(towerBase, base);
        add(towerMid, base.clone().multiply(new Matrix4().setPosition(0, 1.01, 0)));
        add(towerTop, base.clone().multiply(new Matrix4().setPosition(0, 2.02, 0)));
        banner(scene, 2, 0.6);
        break;
      }
      case 'signpost': {
        prop(scene, signpost, 0, 0, face, S.signpost, 0.04);
        const [lx, lz] = offset(scene, 1, 0.3);
        add(lantern, place(lx, groundAt(lx, lz) - 0.05, lz, 0, S.lanternScale));
        break;
      }
      case 'workshop': {
        // A carpenter's corner: a workbench, planks and a wood pile.
        prop(scene, workbench, 0, 0.6, face, S.workbenchWidth, 0.04);
        prop(scene, planks, rng.range(1.6, 2.2), -0.6, anyYaw(), 2, 0.1);
        prop(scene, woodPile, -rng.range(1.6, 2.2), 0, anyYaw(), 2, 0.1);
        break;
      }
    }
  }
  const group = batch.build();
  group.name = 'roadside';
  // The banners, one merged mesh per banner color model (they share one texture, so one mesh each).
  for (const template of [bannerRed, bannerGreen]) {
    const mesh = buildBanners(
      template,
      bannerPlaces.filter((p) => p.template === template).map((p) => p.matrix),
      rng,
    );
    if (mesh) group.add(mesh);
  }
  group.userData.windows = windows;
  group.userData.lanterns = lanterns;
  return group;
}
