// The compass crank (v3, docs/v3-plan.md 1.7, CRANK): a brass wheel round the
// compass dish, 3.5 cm out from its lip on 8 spokes (a wide circle turns more
// precisely), with a knob on it. It replaces the ring handle in
// battles, and it is the only thing that spins the board there.
//
//   - Pinch the knob (a pinch only, never a fist, 2026-11-13; the hand open
//     near it for a moment first, like every big handle), then move the hand round
//     the dish in a circle. The board follows the hand's angle round the
//     dish's middle, 1:1: one circle of the hand is one turn of the board,
//     however wide the circle (not a wrist twist: a wrist only turns about
//     half way).
//   - The knob turns with the board, like the compass wedges, so the player
//     drags the threat they see on the compass to the front. The hand may
//     leave the knob while turning: only its angle round the dish counts.
//   - Snap turning (the Access setting): the board jumps BOARD_TURN.snapDeg
//     at a time as the hand passes each notch; the knob follows the hand freely.
//   - A click every CRANK.clickDeg of turn (every step when snapping).
//   - Idle, Ready and Held looks with emissive color only.
//
// It lives on the compass dish (boardLift, cm): it rises with the board and
// never turns itself; only its knob moves round.
import { CylinderGeometry, Group, Mesh, SphereGeometry, TorusGeometry, Vector3, type MeshStandardMaterial } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { GameAudio } from '../audio/sound.js';
import { BOARD_TURN, COMPASS, CRANK, HANDLES } from '../config/game.js';
import { angleDelta, degToRad } from '../rules/boardMath.js';
import type { Compass } from '../ui/compass.js';
import type { Stage } from '../world/stage.js';
import { flatMaterial } from '../world/shapes.js';
import { access } from './accessSettings.js';
import { applyTouchState, type TouchState } from './feedback.js';
import type { HandState } from './hands.js';

interface Holder {
  hand: HandState;
  viaPinch: boolean;
  openTime: number;
  /** The hand's last angle round the dish (radians), or null while it is too near the middle. */
  lastAngle: number | null;
  /** How far the hand has gone round since the grab (radians, keeps counting past a full circle). */
  total: number;
  startSpin: number;
  /** The last click's notch, so each notch clicks once. */
  notch: number;
}

const CM = 0.01;
const local = new Vector3();

export class CompassCrank {
  private wheel: Mesh;
  /** The knob's arm: turned round the dish's axis, the knob on the wheel at its end. */
  private knobArm = new Group();
  private materials: MeshStandardMaterial[];
  private state: TouchState = 'idle';
  private holder: Holder | null = null;
  /** The wheel's radius and its height above the dish's floor (cm, in the dish frame). */
  private wheelR: number;
  private wheelY: number;
  /** The board spin the knob shows while held (the hand's, even while snapping). */
  private shownSpin = 0;

  constructor(
    private stage: Stage,
    private compass: Compass,
    private audio: GameAudio,
  ) {
    const wood = flatMaterial(CRANK.wheelColor);
    const knob = flatMaterial(CRANK.knobColor);
    this.materials = [wood, knob];
    this.wheelR = COMPASS.radius + CRANK.wheelOut;
    this.wheelY = COMPASS.dishDepth;
    // The wheel: a ring in the dish's plane, just outside its lip.
    this.wheel = new Mesh(new TorusGeometry(this.wheelR, CRANK.wheelTube, 8, 48).rotateX(Math.PI / 2), wood);
    this.wheel.position.y = this.wheelY;
    // Spokes from the dish's lip out to the wheel, so the wide wheel reads as part of the compass.
    const inner = COMPASS.radius;
    const spokeLength = this.wheelR - inner;
    const parts = [];
    for (let i = 0; i < CRANK.spokes; i++) {
      const a = (i / CRANK.spokes) * Math.PI * 2 + Math.PI / CRANK.spokes;
      const mid = inner + spokeLength / 2;
      // Along -z out to its middle, then turned round to its angle (rotateY(-a) puts -z at angle a).
      parts.push(
        new CylinderGeometry(CRANK.spokeRadius, CRANK.spokeRadius, spokeLength, 6).rotateX(Math.PI / 2).translate(0, this.wheelY, -mid).rotateY(-a),
      );
    }
    // One mesh for all the spokes (one draw call).
    const spokes = [new Mesh(mergeGeometries(parts)!, wood)];
    // The knob: a short post standing on the wheel, a ball on top. Placed at angle 0 (the far side), the arm turns it.
    const post = new Mesh(new CylinderGeometry(CRANK.knobRadius, CRANK.knobRadius, CRANK.knobHeight, 8).translate(0, CRANK.knobHeight / 2, 0), knob);
    const ball = new Mesh(new SphereGeometry(CRANK.ballRadius, 10, 8), knob);
    ball.position.y = CRANK.knobHeight;
    const knobGroup = new Group();
    knobGroup.add(post, ball);
    knobGroup.position.set(0, this.wheelY, -this.wheelR);
    this.knobArm.add(knobGroup);
    compass.dishFrame.add(this.wheel, this.knobArm, ...spokes);
  }

  /** Distance (meters) from a hand to the wheel, or null if out of the grab zone, hidden, or held by the other hand. */
  reach(hand: HandState): number | null {
    if (!this.compass.shown) return null;
    if (this.holder && this.holder.hand !== hand) return null;
    // Pinch the knob (2026-11-13: pinch only, never a fist; the knob is small, made to be caught between two fingers).
    const d = this.distanceToKnob(hand.pinchPoint);
    return d < CRANK.grabRadius ? d : null;
  }

  isHeldBy(hand: HandState): boolean {
    return this.holder?.hand === hand;
  }

  get busy(): boolean {
    return this.holder !== null;
  }

  grab(hand: HandState, viaPinch: boolean): void {
    this.holder = { hand, viaPinch, openTime: 0, lastAngle: this.handAngle(hand, viaPinch), total: 0, startSpin: this.stage.spin, notch: 0 };
  }

  release(): void {
    this.holder = null;
  }

  /** Sets the Ready look (or Idle). Held is managed here. */
  setReady(ready: boolean): void {
    this.setState(this.holder ? 'held' : ready ? 'ready' : 'idle');
  }

  update(dt: number): void {
    const holder = this.holder;
    if (holder) {
      // Let go only when the hand is clearly open for a moment, so tracking flickers never drop it.
      const closed = holder.hand.pinch.on || holder.hand.fist.on;
      holder.openTime = closed ? 0 : holder.openTime + dt;
      if (!holder.hand.tracked || holder.openTime >= HANDLES.releaseHold || !this.compass.shown) this.release();
      else this.follow(holder);
    }
    if (!this.holder) this.shownSpin = this.stage.spin;
    // The knob turns with the board (like the compass wedges): a bigger spin moves things to the left.
    this.knobArm.rotation.y = -(degToRad(CRANK.knobStartDeg) - this.shownSpin);
  }

  /** Debug page: turn the board and change its height without hands. */
  nudge(spinRadians: number, heightCm: number): void {
    this.stage.spin += spinRadians;
    this.stage.height += heightCm;
  }

  private follow(holder: Holder): void {
    const angle = this.handAngle(holder.hand, holder.viaPinch);
    if (angle === null) return;
    if (holder.lastAngle !== null) holder.total += angleDelta(holder.lastAngle, angle);
    holder.lastAngle = angle;
    // The hand moving round to the right turns the board so its things come from the right, like dragging the knob.
    const free = holder.startSpin - holder.total;
    this.shownSpin = free;
    let notch: number;
    if (access.snapTurn) {
      const step = degToRad(BOARD_TURN.snapDeg);
      notch = Math.round(holder.total / step);
      this.stage.spin = holder.startSpin - notch * step;
    } else {
      notch = Math.floor(holder.total / degToRad(CRANK.clickDeg));
      this.stage.spin = free;
    }
    if (notch !== holder.notch) {
      holder.notch = notch;
      this.audio.play('crankClick', undefined, 1, 0.03);
    }
  }

  /** The hand's angle round the dish's middle in the dish's plane (radians, 0 the far side, positive to the right), or null near the middle. */
  private handAngle(hand: HandState, viaPinch: boolean): number | null {
    this.compass.dishFrame.worldToLocal(local.copy(viaPinch ? hand.pinchPoint : hand.palm));
    if (Math.hypot(local.x, local.z) < CRANK.minRadius) return null;
    return Math.atan2(local.x, -local.z);
  }

  /** Distance (meters) from a world point to the wheel. */
  /** Distance (meters) from a world point to the knob's ball. */
  private distanceToKnob(world: Vector3): number {
    this.compass.dishFrame.worldToLocal(local.copy(world));
    const a = degToRad(CRANK.knobStartDeg) - this.shownSpin;
    const d = Math.hypot(local.x - Math.sin(a) * this.wheelR, local.y - (this.wheelY + CRANK.knobHeight), local.z + Math.cos(a) * this.wheelR);
    return d * CM * this.stage.boardScale;
  }

  /**
   * The knob's ball (world) moved `arcDeg` round the wheel from where it is now (positive: the way the angle
   * grows, clockwise seen from above): the ghost hand's anchor, so the demo pinches the knob and circles with it.
   */
  wheelWorld(arcDeg: number, out: Vector3): Vector3 {
    const a = degToRad(CRANK.knobStartDeg + arcDeg) - this.shownSpin;
    this.compass.dishFrame.updateWorldMatrix(true, false);
    return this.compass.dishFrame.localToWorld(out.set(Math.sin(a) * this.wheelR, this.wheelY + CRANK.knobHeight, -Math.cos(a) * this.wheelR));
  }

  /** The knob's top (world), for the tutorial's marker. */
  knobWorld(out: Vector3): Vector3 {
    const a = degToRad(CRANK.knobStartDeg) - this.shownSpin;
    this.compass.dishFrame.updateWorldMatrix(true, false);
    return this.compass.dishFrame.localToWorld(out.set(Math.sin(a) * this.wheelR, this.wheelY + CRANK.knobHeight + CRANK.ballRadius, -Math.cos(a) * this.wheelR));
  }

  private setState(state: TouchState): void {
    if (this.state === state) return;
    this.state = state;
    applyTouchState(this.materials, state);
  }
}
