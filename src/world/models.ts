// Loading, sizing, cloning, instancing and batching of the glTF models in public/gltf/.
// Each file is loaded once (AssetManager caches it) and then cloned, instanced or batched.
import { AssetManager } from '@iwsdk/core';
import {
  Box3,
  type BufferGeometry,
  Group,
  InstancedMesh,
  type Material,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Vector3,
  type AnimationClip,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

export const gltfUrl = (path: string): string =>
  `${import.meta.env.BASE_URL}gltf/${path}`;

export interface Fit {
  /** Target height (board units). */
  height?: number;
  /** Target width: the larger of the x and z sizes (board units). */
  width?: number;
  /**
   * Keep the model's own origin instead of centering it (kit pieces made to
   * snap together on a 1 x 1 tile: walls on a tile's edge, roofs on top).
   * Without a height or width it keeps its own size too.
   */
  keepOrigin?: boolean;
}

export interface ModelTemplate {
  /** Parentless group: model scaled to the fit, centered, resting on y = 0. */
  object: Group;
  animations: AnimationClip[];
  /** Size after fitting (board units). */
  size: Vector3;
}

const box = new Box3();
const size = new Vector3();
const center = new Vector3();

/** Loads a model (cached) and returns a sized template to clone from. */
export async function loadTemplate(
  path: string,
  fit: Fit,
  skinned = false,
): Promise<ModelTemplate> {
  const gltf = await AssetManager.loadGLTF(gltfUrl(path));
  const model = skinned ? SkeletonUtils.clone(gltf.scene) : gltf.scene.clone(true);
  model.updateMatrixWorld(true);
  box.setFromObject(model);
  box.getSize(size);
  box.getCenter(center);
  let scale = 1;
  if (fit.height !== undefined && size.y > 0) {
    scale = fit.height / size.y;
  } else if (fit.width !== undefined) {
    scale = fit.width / Math.max(size.x, size.z, 1e-6);
  }
  model.scale.setScalar(scale);
  if (fit.keepOrigin) model.position.set(0, 0, 0);
  else model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
  const object = new Group();
  object.name = path;
  object.add(model);
  object.updateMatrixWorld(true);
  return {
    object,
    animations: gltf.animations,
    size: size.clone().multiplyScalar(scale),
  };
}

/** A plain clone that shares geometry and materials with the template. */
export function cloneStatic(template: ModelTemplate): Group {
  return template.object.clone(true);
}

/** A clone with its own skeleton, for animated characters. */
export function cloneSkinned(template: ModelTemplate): Group {
  return SkeletonUtils.clone(template.object) as Group;
}

/**
 * Draws many copies of one model with one InstancedMesh per mesh part.
 * Use for static things that repeat (trees, rocks, crenellations).
 */
export class InstancedModel {
  readonly group = new Group();
  private parts: { mesh: InstancedMesh; local: Matrix4 }[] = [];
  private count = 0;
  private temp = new Matrix4();

  constructor(
    template: ModelTemplate,
    private capacity: number,
  ) {
    template.object.updateMatrixWorld(true);
    template.object.traverse((child: Object3D) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      const instanced = new InstancedMesh(mesh.geometry, mesh.material, capacity);
      instanced.count = 0;
      this.parts.push({ mesh: instanced, local: mesh.matrixWorld.clone() });
      this.group.add(instanced);
    });
  }

  /** Adds one copy. The matrix places the template in the group's space. */
  add(matrix: Matrix4): void {
    if (this.count >= this.capacity) return;
    for (const part of this.parts) {
      this.temp.multiplyMatrices(matrix, part.local);
      part.mesh.setMatrixAt(this.count, this.temp);
    }
    this.count++;
    for (const part of this.parts) {
      part.mesh.count = this.count;
      part.mesh.instanceMatrix.needsUpdate = true;
      // Recomputed from all instances the next time it is culled.
      part.mesh.boundingSphere = null;
    }
  }
}

/**
 * A fixed pool of copies of one model that move every frame (pebbles).
 * One InstancedMesh per mesh part. Hidden copies are scaled to zero.
 */
export class InstancedPool {
  readonly group = new Group();
  private parts: { mesh: InstancedMesh; local: Matrix4 }[] = [];
  private temp = new Matrix4();
  private hidden = new Matrix4().makeScale(0, 0, 0);
  private dirty = false;

  constructor(
    template: ModelTemplate,
    readonly capacity: number,
  ) {
    template.object.updateMatrixWorld(true);
    template.object.traverse((child: Object3D) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      const instanced = new InstancedMesh(mesh.geometry, mesh.material, capacity);
      // Copies fly all over the board, so skip culling instead of recomputing bounds.
      instanced.frustumCulled = false;
      for (let i = 0; i < capacity; i++) instanced.setMatrixAt(i, this.hidden);
      this.parts.push({ mesh: instanced, local: mesh.matrixWorld.clone() });
      this.group.add(instanced);
    });
  }

  /** Places copy `index`. The matrix places the template in the group's space. */
  set(index: number, matrix: Matrix4): void {
    for (const part of this.parts) {
      this.temp.multiplyMatrices(matrix, part.local);
      part.mesh.setMatrixAt(index, this.temp);
    }
    this.dirty = true;
  }

  hide(index: number): void {
    for (const part of this.parts) part.mesh.setMatrixAt(index, this.hidden);
    this.dirty = true;
  }

  /** Sends the changes to the GPU once per frame. */
  commit(): void {
    if (!this.dirty) return;
    for (const part of this.parts) part.mesh.instanceMatrix.needsUpdate = true;
    this.dirty = false;
  }
}

/**
 * Merges many copies of many static models into one mesh per material (by
 * material name and texture), so hundreds of trees, rocks, plants and house
 * pieces of a dozen kinds cost only a few draw calls. For things that never
 * move (decor, villages). Kit models that share one texture image (a whole
 * pack) merge into one mesh. Optional tints recolor a material by name (the
 * kit's greens to the game's).
 */
export class StaticBatch {
  private buckets = new Map<string, { material: Material; textured: boolean; parts: BufferGeometry[] }>();
  private temp = new Matrix4();

  constructor(private tints: Record<string, number> = {}) {}

  /** Adds one copy. The matrix places the template in the batch's space. */
  add(template: ModelTemplate, matrix: Matrix4): void {
    template.object.updateMatrixWorld(true);
    template.object.traverse((child: Object3D) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      const source = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      // Each pack has its own texture image, so the image is part of the key.
      const map = source instanceof MeshStandardMaterial ? source.map : null;
      const key = `${source.name || source.uuid}|${map ? map.source.uuid : ''}`;
      let bucket = this.buckets.get(key);
      if (!bucket) {
        const material = source.clone();
        const tint = this.tints[source.name];
        if (tint !== undefined && material instanceof MeshStandardMaterial) material.color.setHex(tint);
        bucket = { material, textured: !!map, parts: [] };
        this.buckets.set(key, bucket);
      }
      const geometry = mesh.geometry.clone();
      // Only what every part has, so they can be merged (and the texture spots when textured).
      const keep = bucket.textured ? ['position', 'normal', 'uv'] : ['position', 'normal'];
      for (const name of Object.keys(geometry.attributes)) if (!keep.includes(name)) geometry.deleteAttribute(name);
      geometry.applyMatrix4(this.temp.multiplyMatrices(matrix, mesh.matrixWorld));
      bucket.parts.push(geometry.index ? geometry.toNonIndexed() : geometry);
    });
  }

  /** One mesh per material, with everything added so far. */
  build(): Group {
    const group = new Group();
    for (const { material, parts } of this.buckets.values()) {
      const merged = mergeGeometries(parts);
      for (const part of parts) part.dispose();
      if (merged) group.add(new Mesh(merged, material));
    }
    this.buckets.clear();
    return group;
  }
}
