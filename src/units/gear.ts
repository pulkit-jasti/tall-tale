// Gear on the characters (build step 7): swords, spears, shields, a bow,
// helmets and caps, merged into each character's own skinned mesh.
//
// Every piece is bound to a small extra bone under a hand or the head (with
// the bone's own bind pose), so it swings with the animation and costs no
// extra draw call. Hiding a piece on one character scales its gear bone to
// almost nothing (each clone has its own skeleton), so one rigged template
// can carry every gear option and each unit shows only its own.
//
// Kenney characters color everything from one small palette image. Gear from
// another pack (or made in code) gets its texture spots moved to the body's
// palette spot with the nearest color, so it keeps its colors in one
// material. Troop recolors move the body's own spots the same way (the
// kingdom's blue and gold), keeping the shading of each spot.
import { AssetManager } from '@iwsdk/core';
import {
  Bone,
  BufferAttribute,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  Matrix3,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Skeleton,
  SkinnedMesh,
  SphereGeometry,
  TorusGeometry,
  BoxGeometry,
  Vector3,
  Color,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GEAR, type GearName, type GearPiece, type Recolor } from '../config/game.js';
import { gltfUrl, type ModelTemplate } from '../world/models.js';

type Rgb = [number, number, number];

/** A palette image read into memory once, to look up and match colors. */
class Palette {
  private candidates: Float32Array;
  private cache = new Map<number, [number, number]>();

  constructor(
    private data: Uint8ClampedArray,
    private width: number,
    private height: number,
  ) {
    // Every 4th pixel that is not the black filler, as [u, v, r, g, b].
    const list: number[] = [];
    for (let y = 2; y < height; y += 4) {
      for (let x = 2; x < width; x += 4) {
        const i = (y * width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (r + g + b < 10) continue;
        list.push((x + 0.5) / width, (y + 0.5) / height, r, g, b);
      }
    }
    this.candidates = new Float32Array(list);
  }

  sample(u: number, v: number, out: Rgb): Rgb {
    const x = Math.min(this.width - 1, Math.max(0, Math.floor(u * this.width)));
    const y = Math.min(this.height - 1, Math.max(0, Math.floor(v * this.height)));
    const i = (y * this.width + x) * 4;
    out[0] = this.data[i];
    out[1] = this.data[i + 1];
    out[2] = this.data[i + 2];
    return out;
  }

  /** The texture spot (u, v) whose color is nearest to r, g, b. */
  nearest(r: number, g: number, b: number): [number, number] {
    const key = ((r & 0xfc) << 16) | ((g & 0xfc) << 8) | (b & 0xfc);
    const cached = this.cache.get(key);
    if (cached) return cached;
    const c = this.candidates;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < c.length; i += 5) {
      const dr = c[i + 2] - r;
      const dg = c[i + 3] - g;
      const db = c[i + 4] - b;
      // Weighted a little toward green, as the eye is.
      const d = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    const found: [number, number] = c.length > 0 ? [c[best], c[best + 1]] : [0.5, 0.5];
    this.cache.set(key, found);
    return found;
  }
}

const palettes = new WeakMap<object, Palette | null>();

/** Reads a texture's image into a palette (null if it cannot be read, then colors are left as they are). */
function paletteOf(material: MeshStandardMaterial | null): Palette | null {
  const image = material?.map?.image as (CanvasImageSource & { width: number; height: number }) | undefined;
  if (!image || !image.width) return null;
  const known = palettes.get(image);
  if (known !== undefined) return known;
  let palette: Palette | null = null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (context) {
      context.drawImage(image, 0, 0);
      palette = new Palette(context.getImageData(0, 0, image.width, image.height).data, image.width, image.height);
    }
  } catch (error) {
    console.warn('[gear] palette not readable, gear keeps its own texture spots', error);
  }
  palettes.set(image, palette);
  return palette;
}

const luminance = (c: Rgb): number => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;

/**
 * Moves the texture spots inside each rule's box to the palette spot nearest
 * the rule's color, darker where the old spot was darker (keeps shading).
 */
function recolorGeometry(geometry: BufferGeometry, palette: Palette, rules: Recolor[]): void {
  const uv = geometry.getAttribute('uv') as BufferAttribute | undefined;
  if (!uv) return;
  const sample: Rgb = [0, 0, 0];
  for (const rule of rules) {
    const [u0, u1, v0, v1] = rule.uv;
    const matched: number[] = [];
    let brightest = 1;
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i);
      const v = uv.getY(i);
      if (u < u0 || u >= u1 || v < v0 || v > v1) continue;
      matched.push(i);
      brightest = Math.max(brightest, luminance(palette.sample(u, v, sample)));
    }
    for (const i of matched) {
      const shade = Math.min(1, Math.max(0.5, luminance(palette.sample(uv.getX(i), uv.getY(i), sample)) / brightest));
      const [u, v] = palette.nearest(rule.color[0] * shade, rule.color[1] * shade, rule.color[2] * shade);
      uv.setXY(i, u, v);
    }
  }
  uv.needsUpdate = true;
}

// ---- Gear shapes made in code (shape units, before the piece's own transform) ----

interface ShapePart {
  geometry: BufferGeometry;
  color: number;
}

function shapeParts(piece: GearPiece): ShapePart[] {
  const main = piece.color ?? 0x888888;
  const trim = piece.trim ?? main;
  const parts: ShapePart[] = [];
  switch (piece.shape) {
    case 'bow': {
      // An arc around the grip, symmetric about +x, with a straight string.
      const radius = 0.22;
      const arc = 2.6;
      const limb = new TorusGeometry(radius, 0.022, 4, 10, arc);
      limb.rotateZ(-arc / 2);
      const end = new Vector3(Math.cos(arc / 2) * radius, Math.sin(arc / 2) * radius, 0);
      const string = new BoxGeometry(0.01, end.y * 2, 0.01);
      string.translate(end.x, 0, 0);
      parts.push({ geometry: limb, color: main }, { geometry: string, color: trim });
      break;
    }
    case 'quiver': {
      const tube = new CylinderGeometry(0.055, 0.045, 0.26, 6);
      parts.push({ geometry: tube, color: main });
      for (let k = 0; k < 3; k++) {
        const feather = new BoxGeometry(0.02, 0.07, 0.035);
        feather.translate((k - 1) * 0.025, 0.16, (k % 2) * 0.015);
        parts.push({ geometry: feather, color: trim });
      }
      break;
    }
    case 'helmet': {
      // A round steel pot with a rim and a spike on top: reads as "armored" from far away.
      const dome = new SphereGeometry(0.24, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
      dome.scale(1, 0.85, 1.05);
      const rim = new CylinderGeometry(0.262, 0.262, 0.045, 10);
      const spike = new ConeGeometry(0.05, 0.14, 5);
      spike.translate(0, 0.25, 0);
      parts.push({ geometry: dome, color: main }, { geometry: rim, color: trim }, { geometry: spike, color: trim });
      break;
    }
    case 'cap': {
      // A soldier's kettle hat: a low dome with a wide gold brim.
      const dome = new SphereGeometry(0.235, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2);
      dome.scale(1, 0.62, 1);
      const brim = new CylinderGeometry(0.31, 0.31, 0.025, 10);
      parts.push({ geometry: dome, color: main }, { geometry: brim, color: trim });
      break;
    }
    case 'plume': {
      // A blue feather sticking up from the hood, on a small gold bead.
      const feather = new SphereGeometry(0.06, 5, 3);
      feather.scale(0.55, 2.2, 1);
      feather.translate(0, 0.12, 0);
      const bead = new SphereGeometry(0.035, 5, 3);
      parts.push({ geometry: feather, color: main }, { geometry: bead, color: trim });
      break;
    }
    default:
      break;
  }
  return parts;
}

// ---- Placing a piece ----

const basisA = new Matrix4();
const basisB = new Matrix4();
const va = new Vector3();
const vb = new Vector3();
const vc = new Vector3();

/** Rotation turning (axis, axis2) of the model onto (dir, dir2). */
function rotationFor(piece: GearPiece, out: Matrix4): Matrix4 {
  const frame = (main: number[], side: number[], m: Matrix4): Matrix4 => {
    va.fromArray(main).normalize();
    vb.fromArray(side);
    vb.addScaledVector(va, -vb.dot(va));
    if (vb.lengthSq() < 1e-6) vb.set(va.y, va.z, va.x).addScaledVector(va, -va.dot(vb));
    vb.normalize();
    vc.crossVectors(va, vb);
    return m.makeBasis(va, vb, vc);
  };
  frame(piece.axis, piece.axis2, basisA);
  frame(piece.dir, piece.dir2, basisB);
  // Model frame -> target frame: B * A^T (A is a pure rotation).
  return out.multiplyMatrices(basisB, basisA.transpose());
}

/** The piece's model-to-bone matrix: anchor to the origin, scale, turn, move to `at`. */
export function pieceMatrix(piece: GearPiece, out: Matrix4): Matrix4 {
  const rotation = rotationFor(piece, new Matrix4());
  out.makeTranslation(-piece.anchor[0], -piece.anchor[1], -piece.anchor[2]);
  out.premultiply(new Matrix4().makeScale(piece.scale, piece.scale, piece.scale));
  out.premultiply(rotation);
  out.premultiply(new Matrix4().makeTranslation(piece.at[0], piece.at[1], piece.at[2]));
  return out;
}

interface PieceGeometry {
  geometry: BufferGeometry;
  /** The color of each vertex in its own source (palette or shape color). */
  colors: Float32Array;
}

/** Loads a piece as one geometry in its model units, with the source color of every vertex. */
async function loadPiece(piece: GearPiece): Promise<PieceGeometry | null> {
  if (piece.shape) {
    const parts = shapeParts(piece);
    if (parts.length === 0) return null;
    const color = new Color();
    const geometries: BufferGeometry[] = [];
    const colors: number[] = [];
    for (const part of parts) {
      const g = part.geometry;
      for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
      color.setHex(part.color);
      for (let i = 0; i < g.getAttribute('position').count; i++) colors.push(color.r * 255, color.g * 255, color.b * 255);
      geometries.push(g);
    }
    const merged = mergeGeometries(geometries);
    for (const g of geometries) g.dispose();
    return merged ? { geometry: merged, colors: new Float32Array(colors) } : null;
  }
  if (!piece.model) return null;
  const gltf = await AssetManager.loadGLTF(gltfUrl(piece.model));
  gltf.scene.updateMatrixWorld(true);
  const geometries: BufferGeometry[] = [];
  const colors: number[] = [];
  const sample: Rgb = [0, 0, 0];
  gltf.scene.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const g = mesh.geometry.clone();
    g.applyMatrix4(mesh.matrixWorld);
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as MeshStandardMaterial;
    const palette = paletteOf(material);
    const uv = g.getAttribute('uv');
    const count = g.getAttribute('position').count;
    for (let i = 0; i < count; i++) {
      if (palette && uv) palette.sample(uv.getX(i), uv.getY(i), sample);
      else sample.fill(160);
      colors.push(sample[0], sample[1], sample[2]);
    }
    geometries.push(g);
  });
  if (geometries.length === 0) return null;
  const merged = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries);
  return merged ? { geometry: merged, colors: new Float32Array(colors) } : null;
}

function findSkinned(root: Object3D, name: string): SkinnedMesh | null {
  let found: SkinnedMesh | null = null;
  root.traverse((o) => {
    const mesh = o as SkinnedMesh;
    if (!found && mesh.isSkinnedMesh && mesh.name === name) found = mesh;
  });
  return found;
}

const gearBoneName = (name: GearName): string => `gear-${name}`;

/**
 * Adds gear pieces to a skinned character template (from loadTemplate with
 * skinned = true), each on its own gear bone, and applies the recolors.
 * Changes the template in place (its geometry is replaced, never the shared
 * cached one). Clones made after this carry the gear.
 */
export async function rigTemplate(template: ModelTemplate, gear: GearName[], recolor: Recolor[] = []): Promise<void> {
  const body = findSkinned(template.object, 'body-mesh');
  const head = findSkinned(template.object, 'head-mesh');
  if (!body) {
    console.warn('[gear] no body mesh in', template.object.name);
    return;
  }
  const palette = paletteOf(body.material as MeshStandardMaterial);
  // Recolors first, on copies of the body and head geometry (the originals are shared with the cache).
  let bodyGeometry = body.geometry.clone();
  if (palette && recolor.length > 0) {
    recolorGeometry(bodyGeometry, palette, recolor.filter((r) => r.mesh === 'body'));
    const headRules = recolor.filter((r) => r.mesh === 'head');
    if (head && headRules.length > 0) {
      head.geometry = head.geometry.clone();
      recolorGeometry(head.geometry, palette, headRules);
    }
  }
  const pieces = await Promise.all(gear.map((name) => loadPiece(GEAR.pieces[name])));
  const skeleton = body.skeleton;
  const bones = skeleton.bones.slice();
  const inverses = skeleton.boneInverses.map((m) => m.clone());
  const parts: BufferGeometry[] = [bodyGeometry];
  const toBind = new Matrix4();
  const normalMatrix = new Matrix3();
  const local = new Matrix4();
  const bindInverse = body.bindMatrix.clone().invert();
  gear.forEach((name, k) => {
    const loaded = pieces[k];
    const piece: GearPiece = GEAR.pieces[name];
    const parentIndex = bones.findIndex((b) => b.name === piece.bone);
    if (!loaded || parentIndex < 0) return;
    // The gear bone sits right on its parent bone, so it shares the parent's bind pose.
    const bone = new Bone();
    bone.name = gearBoneName(name);
    bones[parentIndex].add(bone);
    const index = bones.length;
    bones.push(bone);
    inverses.push(inverses[parentIndex].clone());
    // Model -> bone -> bind space of the mesh: bindMatrixInverse * boneWorldAtBind * piece.
    // (bindMatrixInverse is overwritten by the mesh's world matrix each frame, so it is worked out from bindMatrix.)
    toBind.copy(inverses[parentIndex]).invert().premultiply(bindInverse).multiply(pieceMatrix(piece, local));
    const g = loaded.geometry;
    g.applyMatrix4(toBind);
    normalMatrix.getNormalMatrix(toBind);
    // Same attributes as the body, so the two can be merged.
    const count = g.getAttribute('position').count;
    const uv = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const c = loaded.colors;
      const [u, v] = palette ? palette.nearest(c[i * 3], c[i * 3 + 1], c[i * 3 + 2]) : [0.5, 0.5];
      uv[i * 2] = u;
      uv[i * 2 + 1] = v;
    }
    g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
    for (const [attrName, attr] of Object.entries(bodyGeometry.attributes)) {
      const source = attr as BufferAttribute;
      const existing = g.getAttribute(attrName) as BufferAttribute | undefined;
      const Ctor = source.array.constructor as new (n: number) => typeof source.array;
      const out = new BufferAttribute(new Ctor(count * source.itemSize), source.itemSize, source.normalized);
      for (let i = 0; i < count; i++) {
        for (let c = 0; c < source.itemSize; c++) {
          let value = 0;
          if (attrName === 'skinIndex') value = c === 0 ? index : 0;
          else if (attrName === 'skinWeight') value = c === 0 ? 1 : 0;
          else if (existing && c < existing.itemSize) value = existing.getComponent(i, c);
          out.setComponent(i, c, value);
        }
      }
      g.setAttribute(attrName, out);
    }
    for (const attrName of Object.keys(g.attributes)) if (!(attrName in bodyGeometry.attributes)) g.deleteAttribute(attrName);
    parts.push(g);
  });
  if (parts.length > 1) {
    // Both must be indexed or both not.
    const indexed = parts.every((p) => p.index);
    const ready = indexed ? parts : parts.map((p) => (p.index ? p.toNonIndexed() : p));
    const merged = mergeGeometries(ready);
    if (merged) bodyGeometry = merged;
    else console.warn('[gear] could not merge gear into', template.object.name);
  }
  body.geometry = bodyGeometry;
  body.bind(new Skeleton(bones, inverses), body.bindMatrix);
  template.object.updateMatrixWorld(true);
}

/** The gear bones of one cloned character, by gear name. */
export function findGearBones(model: Object3D): Map<GearName, Object3D> {
  const map = new Map<GearName, Object3D>();
  for (const name of Object.keys(GEAR.pieces) as GearName[]) {
    const bone = model.getObjectByName(gearBoneName(name));
    if (bone) map.set(name, bone);
  }
  return map;
}

/** Shows or hides one piece of gear on one character. */
export function setGear(bones: Map<GearName, Object3D>, name: GearName, on: boolean): void {
  bones.get(name)?.scale.setScalar(on ? 1 : GEAR.hiddenScale);
}

/**
 * A plain (unskinned) copy of one gear piece, sized in board cm with its
 * anchor at the origin, for the gear that flies off (src/fx/gearDebris.ts).
 * `unitScale` turns character units into cm (the character's height / 0.84).
 */
export async function gearTemplate(name: GearName, unitScale: number): Promise<ModelTemplate | null> {
  const piece: GearPiece = GEAR.pieces[name];
  const loaded = await loadPiece(piece);
  if (!loaded) return null;
  const g = loaded.geometry;
  const s = piece.scale * unitScale;
  g.translate(-piece.anchor[0], -piece.anchor[1], -piece.anchor[2]);
  g.scale(s, s, s);
  // Its own colors as vertex colors (flat material, no texture).
  const colors = new Float32Array(loaded.colors.length);
  for (let i = 0; i < colors.length; i++) colors[i] = Math.pow(loaded.colors[i] / 255, 2.2);
  g.setAttribute('color', new Float32BufferAttribute(colors, 3));
  const mesh = new Mesh(g, new MeshStandardMaterial({ vertexColors: true, roughness: 0.8, flatShading: true }));
  const object = new Group();
  object.name = `gear ${name}`;
  object.add(mesh);
  object.updateMatrixWorld(true);
  g.computeBoundingBox();
  const size = new Vector3();
  g.boundingBox!.getSize(size);
  return { object, animations: [], size };
}
