// Ghost aim dots for the first trigger lesson: a see-through arc of small
// dots from the slingshot's pouch to the target (the keg), in the ghost
// hand's color, flowing slowly toward the target. It shows where a shot goes,
// like the real aim dots while pulling. World space (meters), one instanced mesh.
import { InstancedMesh, Matrix4, MeshBasicMaterial, SphereGeometry, Vector3, type Object3D } from 'three';
import { GHOST_HAND } from '../config/game.js';

const matrix = new Matrix4();
const point = new Vector3();
const hidden = new Matrix4().makeScale(0, 0, 0);

export class GhostAim {
  private mesh: InstancedMesh;
  private time = 0;

  constructor(parent: Object3D) {
    const material = new MeshBasicMaterial({ color: GHOST_HAND.color, transparent: true, opacity: 0.7, depthWrite: false, fog: false });
    this.mesh = new InstancedMesh(new SphereGeometry(1, 8, 6), material, GHOST_HAND.aimDots);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.mesh.visible = false;
    parent.add(this.mesh);
  }

  /** Shows the arc from `from` to `to` (world), or hides it when either is missing. */
  update(dt: number, from: Vector3 | null, to: Vector3 | null): void {
    if (!from || !to) {
      this.mesh.visible = false;
      return;
    }
    this.time += dt;
    const { aimDots, aimDotSize, aimArc, aimFlow } = GHOST_HAND;
    const lift = from.distanceTo(to) * aimArc;
    const phase = (this.time * aimFlow) % 1;
    for (let i = 0; i < aimDots; i++) {
      const t = (i + phase) / aimDots;
      if (t <= 0.02) {
        this.mesh.setMatrixAt(i, hidden);
        continue;
      }
      point.lerpVectors(from, to, t);
      point.y += 4 * lift * t * (1 - t);
      // Smaller at both ends, so it fades in from the pouch and lands softly.
      const size = aimDotSize * Math.min(1, t * 6, (1 - t) * 6 + 0.4);
      matrix.makeScale(size, size, size).setPosition(point);
      this.mesh.setMatrixAt(i, matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.visible = true;
  }

  hide(): void {
    this.mesh.visible = false;
  }
}
