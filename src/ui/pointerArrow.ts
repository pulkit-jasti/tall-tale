// A 3D arrow that floats just in front of the player's face, a little low,
// and points at something the player should look at: the thing the current
// lesson is about (gold), or a goblin hitting the wall out of view (red). It
// shows only while that thing is at the very edge of the headset's view or
// out of it, and goes away once it is well in view. It blinks softly, follows
// the head lazily (smoothed), never covers the middle of the view, and is
// drawn on top so the board never hides it. World space (meters).
import { ConeGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, Quaternion, Vector3, type Object3D } from 'three';
import { POINTER } from '../config/game.js';
import { popIn } from '../fx/ease.js';

const UP = new Vector3(0, 1, 0);
const spot = new Vector3();
const toTarget = new Vector3();
const turn = new Quaternion();

export interface ArrowLook {
  color: number;
  glow: number;
  /** How far below the eye line it floats (meters). */
  below: number;
}

export class PointerArrow {
  private root = new Group();
  private material: MeshStandardMaterial;
  private placed = false;
  /** 0 hidden, 1 fully out. */
  private shown = 0;
  private time = 0;

  constructor(
    parent: Object3D,
    private look: ArrowLook = POINTER.lesson,
  ) {
    const { length } = POINTER;
    this.material = new MeshStandardMaterial({
      color: look.color,
      emissive: look.glow,
      emissiveIntensity: POINTER.blinkMin,
      roughness: 0.6,
      flatShading: true,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    });
    const outline = new MeshStandardMaterial({ color: 0x4a2a18, depthTest: false, depthWrite: false, transparent: true, flatShading: true });
    // Built along +y, the tip at the top. A dark rim behind the head, like the 2D arrows.
    const headLength = length * 0.42;
    const shaftLength = length - headLength;
    const shaft = new Mesh(new CylinderGeometry(length * 0.09, length * 0.09, shaftLength, 8), this.material);
    shaft.position.y = shaftLength / 2 - length / 2;
    const head = new Mesh(new ConeGeometry(length * 0.24, headLength, 8), this.material);
    head.position.y = length / 2 - headLength / 2;
    const rim = new Mesh(new ConeGeometry(length * 0.27, headLength * 1.08, 8), outline);
    rim.position.copy(head.position);
    rim.position.y -= headLength * 0.03;
    rim.renderOrder = POINTER.renderOrder;
    shaft.renderOrder = head.renderOrder = POINTER.renderOrder + 1;
    this.root.add(rim, shaft, head);
    this.root.visible = false;
    parent.add(this.root);
  }

  /** True while it is out. */
  get visible(): boolean {
    return this.shown > 0;
  }

  /** Every frame with the target (world), or null for none. */
  update(dt: number, head: Vector3, forward: Vector3, target: Vector3 | null): void {
    const { distance, smoothing, showDeg, hideDeg, popTime, blinkMin, blinkMax, blinkSpeed } = POINTER;
    this.time += dt;
    let want = false;
    if (target) {
      toTarget.subVectors(target, head);
      const angle = (forward.angleTo(toTarget) * 180) / Math.PI;
      // Only at the edge of the view or out of it. A gap between show and hide, so it never flickers.
      want = this.shown > 0 ? angle > hideDeg : angle > showDeg;
    }
    this.shown = want ? Math.min(1, this.shown + dt / popTime) : Math.max(0, this.shown - dt / popTime);
    if (this.shown <= 0 || !target) {
      this.root.visible = false;
      this.placed = false;
      return;
    }
    // In front of the face, a little low, following the head smoothly.
    spot.copy(forward).normalize().multiplyScalar(distance).add(head);
    spot.y -= this.look.below;
    if (!this.placed) {
      this.root.position.copy(spot);
      this.placed = true;
    } else {
      this.root.position.lerp(spot, 1 - Math.exp(-dt / smoothing));
    }
    // Tip toward the target.
    toTarget.subVectors(target, this.root.position).normalize();
    turn.setFromUnitVectors(UP, toTarget);
    this.root.quaternion.slerp(turn, 1 - Math.exp(-dt / (smoothing * 0.5)));
    this.root.scale.setScalar(Math.max(0.001, popIn(this.shown)));
    // A soft, slow blink: the glow breathes up and down.
    const breath = 0.5 - 0.5 * Math.cos(this.time * Math.PI * 2 * blinkSpeed);
    this.material.emissiveIntensity = blinkMin + (blinkMax - blinkMin) * breath;
    this.root.visible = true;
  }

  hide(): void {
    this.shown = 0;
    this.placed = false;
    this.root.visible = false;
  }
}
