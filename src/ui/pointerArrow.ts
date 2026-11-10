// A 3D arrow that points at something the player should look at: the thing
// the current lesson is about (gold), or a goblin hitting the wall out of
// view (red). It is the only tutorial marker (the 2D bouncing arrows are
// gone).
//
//   Out of view: it waits right in front of the face, in the middle of the
//   view, following the head lazily (smoothed), tip toward the target.
//   In view: the gold one flies over to the target and hovers just above
//   it, tip down, bobbing, so the player sees exactly what to grab. The red
//   one just goes away then.
//
// It blinks softly and is drawn on top so the board never hides it. World
// space (meters).
import { ConeGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, Quaternion, Vector3, type Object3D } from 'three';
import { POINTER } from '../config/game.js';
import { popIn } from '../fx/ease.js';

const UP = new Vector3(0, 1, 0);
const DOWN = new Vector3(0, -1, 0);
const viewSpot = new Vector3();
const overTarget = new Vector3();
const goal = new Vector3();
const toTarget = new Vector3();
const tipWay = new Vector3();
const turn = new Quaternion();

export interface ArrowLook {
  color: number;
  glow: number;
  /** How far below the eye line it waits (meters). */
  below: number;
  /** The blink: glow from blinkMin to blinkMax, blinkSpeed times a second. */
  blinkMin: number;
  blinkMax: number;
  blinkSpeed: number;
  /** Flies to the target once it is in view (else it hides then). */
  flies: boolean;
}

/** Smooth in and out, 0 to 1. */
const ease = (t: number): number => t * t * (3 - 2 * t);

export class PointerArrow {
  private root = new Group();
  private material: MeshStandardMaterial;
  private placed = false;
  /** 0 hidden, 1 fully out. */
  private shown = 0;
  /** 0 waiting in front of the face, 1 over the target (it flies between). */
  private over = 0;
  /** The target was in view last frame (with a gap between in and out, so it never flickers). */
  private inView = false;
  private time = 0;
  /** A few bigger bounces left (seconds), to call the eye again. */
  private pulseLeft = 0;

  constructor(
    parent: Object3D,
    private look: ArrowLook = POINTER.lesson,
  ) {
    const { length } = POINTER;
    this.material = new MeshStandardMaterial({
      color: look.color,
      emissive: look.glow,
      emissiveIntensity: look.blinkMin,
      roughness: 0.6,
      flatShading: true,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    });
    const outline = new MeshStandardMaterial({ color: 0x4a2a18, depthTest: false, depthWrite: false, transparent: true, flatShading: true });
    // Built along +y, the tip at the top. A dark rim behind the head, so it reads against the sky.
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

  /** A few big bounces over the target, so the eye goes back to it. */
  pulse(): void {
    this.pulseLeft = POINTER.pulseTime;
  }

  /** Every frame with the target (world), or null for none. */
  update(dt: number, head: Vector3, forward: Vector3, target: Vector3 | null): void {
    const { distance, smoothing, showDeg, hideDeg, popTime, flyTime, length, hoverLift, bob, bobSpeed, pulseScale } = POINTER;
    const { blinkMin, blinkMax, blinkSpeed, flies } = this.look;
    this.time += dt;
    this.pulseLeft = Math.max(0, this.pulseLeft - dt);
    if (target) {
      toTarget.subVectors(target, head);
      const angle = (forward.angleTo(toTarget) * 180) / Math.PI;
      // In view once well inside the edge, out of it again only past the edge.
      this.inView = this.inView ? angle < showDeg : angle < hideDeg;
    } else {
      this.inView = false;
    }
    const want = target !== null && (flies || !this.inView);
    this.shown = want ? Math.min(1, this.shown + dt / popTime) : Math.max(0, this.shown - dt / popTime);
    if (this.shown <= 0 || !target) {
      this.root.visible = false;
      this.placed = false;
      this.over = 0;
      return;
    }
    // Flies to the target while it is in view, back in front of the face once it is not.
    const toOver = flies && this.inView;
    this.over = toOver ? Math.min(1, this.over + dt / flyTime) : Math.max(0, this.over - dt / flyTime);
    // Waiting spot: in front of the face, in the middle of the view.
    viewSpot.copy(forward).normalize().multiplyScalar(distance).add(head);
    viewSpot.y -= this.look.below;
    // Hover spot: just above the target, bobbing (bigger bounces during a pulse).
    const grow = this.pulseLeft > 0 ? 1 + pulseScale * Math.abs(Math.sin(this.time * bobSpeed * 2)) : 1;
    const lift = hoverLift + length / 2 + Math.abs(Math.sin(this.time * bobSpeed)) * bob * grow;
    overTarget.copy(target).addScaledVector(UP, lift);
    const t = ease(this.over);
    goal.lerpVectors(viewSpot, overTarget, t);
    if (!this.placed) {
      this.root.position.copy(goal);
      this.placed = true;
    } else if (this.over > 0) {
      // Flying or hovering: right on the path (the bob and the target's own move show as they are).
      this.root.position.lerp(goal, 1 - Math.exp(-dt / (smoothing * 0.4)));
    } else {
      this.root.position.lerp(goal, 1 - Math.exp(-dt / smoothing));
    }
    // Tip toward the target, straight down once over it.
    tipWay.subVectors(target, this.root.position).normalize().lerp(DOWN, t).normalize();
    turn.setFromUnitVectors(UP, tipWay);
    this.root.quaternion.slerp(turn, 1 - Math.exp(-dt / (smoothing * 0.5)));
    this.root.scale.setScalar(Math.max(0.001, popIn(this.shown) * (this.over > 0 ? grow : 1)));
    // The blink: the glow breathes up and down (softly for the lesson, fast for a threat).
    const breath = 0.5 - 0.5 * Math.cos(this.time * Math.PI * 2 * blinkSpeed);
    this.material.emissiveIntensity = blinkMin + (blinkMax - blinkMin) * breath;
    this.root.visible = true;
  }

  hide(): void {
    this.shown = 0;
    this.over = 0;
    this.inView = false;
    this.placed = false;
    this.root.visible = false;
  }
}
