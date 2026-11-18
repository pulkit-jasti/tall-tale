// Hidden pooled things skip three's per-frame matrix update (2026-11-18, a code
// profile on the Quest 3S): three updates the matrices of every object in the
// scene every frame, hidden or not. About 5,100 of the scene's 7,200 objects
// were hidden (pooled goblins, soldiers and villagers with all their bones,
// the home screen's set during a battle), and the update took about 30% of the
// frame. The game ran at about 53 fps instead of 72, so the sky juddered.
//
// A thing marked here is skipped while hidden; the first frame it shows, the
// renderer updates it before drawing, as usual. Code that reads a hidden
// thing's matrices right away calls updateMatricesNow() instead of
// updateMatrixWorld().
import { Group, Object3D } from 'three';

const update = Object3D.prototype.updateMatrixWorld;

function skipWhileHidden(this: Object3D, force?: boolean): void {
  if (this.visible) update.call(this, force);
}

/** From now on, `o` and everything under it are not updated while `o` is hidden (a pooled unit's root, a sunk set). */
export function skipWhenHidden(o: Object3D): void {
  o.updateMatrixWorld = skipWhileHidden;
}

/** A new group marked with skipWhenHidden (a pooled unit's root). */
export function poolGroup(): Group {
  const group = new Group();
  skipWhenHidden(group);
  return group;
}

/** Updates `o`'s matrices now, hidden or not (its own and everything under it). */
export function updateMatricesNow(o: Object3D): void {
  update.call(o, true);
}
