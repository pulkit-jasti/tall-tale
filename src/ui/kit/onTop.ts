// Things that must never hide behind the castle, the sign or a hand (the
// pause panel, markers, arrows, labels) skip the depth test and draw last,
// in a fixed order. The order of every layer is in RENDER_ORDER (src/config/game.ts).
import type { Material, Mesh, Object3D } from 'three';
import { RENDER_ORDER } from '../../config/game.js';

/**
 * Every mesh under `root` draws on top, in tree order from `from` on, each
 * `step` after the one before (a small step keeps a whole page inside one
 * layer of RENDER_ORDER, like the menu pages). Returns the next free order.
 * Call it again after adding meshes.
 */
export function drawOnTop(root: Object3D, from: number, step = 1): number {
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
    mesh.renderOrder = order;
    order += step;
  });
  return order;
}

/**
 * A menu page drawn like the settings page (headset tests 2026-11-11): no
 * depth test, in the page's own tree order (the board first, then each
 * control's parts), all inside the RENDER_ORDER.menu layer. Taps, slider
 * releases and tab changes made the depth-tested Custom Game pages flicker;
 * the settings page, drawn this way, never did. Call it again whenever the
 * page gets new meshes (rows shown, a list rebuilt, a new title plate).
 */
export function layerPage(root: Object3D): void {
  drawOnTop(root, RENDER_ORDER.menu, 0.0005);
}
