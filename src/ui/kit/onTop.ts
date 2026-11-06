// Things that must never hide behind the castle, the sign or a hand (the
// pause panel, markers, arrows, labels) skip the depth test and draw last,
// in a fixed order. The order of every layer is in RENDER_ORDER (src/config/game.ts).
import type { Material, Mesh, Object3D } from 'three';

/**
 * Every mesh under `root` draws on top, in tree order from `from` on.
 * Returns the next free order. Call it again after adding meshes.
 */
export function drawOnTop(root: Object3D, from: number): number {
  let order = from;
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh && !(o as { isSprite?: boolean }).isSprite) return;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material as Material]) {
      material.depthTest = false;
      material.depthWrite = false;
      // In the transparent pass, so the order holds against other see-through things.
      material.transparent = true;
    }
    mesh.renderOrder = order++;
  });
  return order;
}
