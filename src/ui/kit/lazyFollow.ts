// Keeps something (a menu panel) in front of the head the way the Quest's
// own menus do: it stays still while the head turns a little, so it can be
// poked, and swings back in front once the head turned past the panel's
// edge (fitTo: the bigger the panel, the farther the eyes may roam) or
// moved more than `recenter` away. It is never behind the player.
import type { Object3D, Vector3 } from 'three';
import { angleTo } from './layout.js';

export interface FollowOptions {
  /** It starts to swing back past this turn of the head (degrees, at least; see fitTo)... */
  followDeg: number;
  /** ...or past the panel's side edge plus this (degrees), whichever is more (see fitTo). */
  edgeMarginDeg: number;
  /** ...with this smoothing (seconds)... */
  smoothing: number;
  /** ...and stops once within this angle again (degrees). */
  settleDeg: number;
  /** A head that moved this far (meters) also brings it back (leaning, standing up). */
  recenter: number;
}

const toTarget = { x: 0, y: 0, z: 0 };

export class LazyFollow {
  private yaw = 0;
  private following = false;
  /** How far below the eyes it sits (meters) and its size (it is built in cm). */
  private drop = 0;
  private scale = 0.01;
  /** The turn of the head it swings back after (degrees), for the panel that shows now. */
  private followDeg: number;

  constructor(
    private target: Object3D,
    private options: FollowOptions,
  ) {
    this.followDeg = options.followDeg;
  }

  /**
   * The panel that shows now is `width` wide at `distance` from the eyes
   * (any one unit): it swings back only once the head turned past its side
   * edge plus the margin, so the player can look at its corners. A small
   * panel comes back soon, a big one lets the eyes roam over it.
   */
  fitTo(width: number, distance: number): void {
    const edge = (Math.atan2(width / 2, distance) * 180) / Math.PI;
    this.followDeg = Math.max(this.options.followDeg, edge + this.options.edgeMarginDeg);
  }

  /** Puts it straight in front of where the head looks, `drop` m below the eyes, at once. */
  snap(head: Vector3, forward: Vector3, drop: number, scale: number): void {
    this.drop = drop;
    this.scale = scale;
    this.following = false;
    this.yaw = Math.atan2(-forward.x, -forward.z);
    this.place(head, 1);
  }

  /** Every frame while it shows. */
  update(dt: number, head: Vector3, forward: Vector3): void {
    const { smoothing, settleDeg, recenter } = this.options;
    const followDeg = this.followDeg;
    // Looking straight up or down says nothing about where in front is.
    if (Math.hypot(forward.x, forward.z) < 0.2) return;
    const d = angleTo(this.yaw, Math.atan2(-forward.x, -forward.z));
    const deg = Math.abs(d) * (180 / Math.PI);
    const p = this.target.position;
    toTarget.x = head.x - p.x;
    toTarget.y = head.y - this.drop - p.y;
    toTarget.z = head.z - p.z;
    const off = Math.hypot(toTarget.x, toTarget.y, toTarget.z);
    if (deg > followDeg || off > recenter) this.following = true;
    if (!this.following) return;
    const k = 1 - Math.exp(-dt / smoothing);
    this.yaw += d * k;
    this.place(head, k);
    if (deg < settleDeg && off < 0.01) this.following = false;
  }

  /** At its yaw in front of the head, moving share `k` of the way there. */
  private place(head: Vector3, k: number): void {
    const p = this.target.position;
    p.x += (head.x - p.x) * k;
    p.y += (head.y - this.drop - p.y) * k;
    p.z += (head.z - p.z) * k;
    this.target.rotation.set(0, this.yaw, 0);
    this.target.scale.setScalar(this.scale);
    this.target.updateMatrixWorld(true);
  }
}
