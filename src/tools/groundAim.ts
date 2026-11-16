// Where an aim ray meets the board (v3 2.2: the magnet's tips, the
// magnifying glass's gaze). Board cm (boardSpin), marched in small steps
// against the ground (the courtyard, the wall top, the field with its bumps).
import { Matrix4, Vector3, type Object3D } from 'three';
import { landingHeight } from '../rules/boardMath.js';

const inverse = new Matrix4();
const p = new Vector3();

/**
 * Marches from `origin` along `dir` (both board cm, `dir` a unit vector) up
 * to `range` cm in `step` cm steps. Returns true and the ground point in
 * `out` when it meets the ground; false when it leaves the board or goes too far.
 */
export function marchToGround(origin: Vector3, dir: Vector3, range: number, step: number, out: Vector3): boolean {
  if (dir.y > -0.02) return false;
  p.copy(origin);
  for (let d = 0; d < range; d += step) {
    p.addScaledVector(dir, step);
    const ground = landingHeight(p.x, p.z);
    if (ground === null) return false;
    if (p.y <= ground) {
      out.set(p.x, ground, p.z);
      return true;
    }
  }
  return false;
}

/** A world point and a world direction into the board's frame (boardSpin cm; the direction stays a unit vector). */
export function toBoard(board: Object3D, worldPoint: Vector3, worldDir: Vector3, outPoint: Vector3, outDir: Vector3): void {
  board.worldToLocal(outPoint.copy(worldPoint));
  inverse.copy(board.matrixWorld).invert();
  outDir.copy(worldDir).transformDirection(inverse);
}
