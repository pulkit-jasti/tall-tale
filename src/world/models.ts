// Loading, sizing, cloning and instancing of the glTF models in public/gltf/.
// Each file is loaded once (AssetManager caches it) and then cloned or instanced.
import { AssetManager } from '@iwsdk/core';
import {
  Box3,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Object3D,
  Vector3,
  type AnimationClip,
} from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

export const gltfUrl = (path: string): string =>
  `${import.meta.env.BASE_URL}gltf/${path}`;

export interface Fit {
  /** Target height (board units). */
  height?: number;
  /** Target width: the larger of the x and z sizes (board units). */
  width?: number;
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
  model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
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
