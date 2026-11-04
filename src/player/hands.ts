// Reads both hands every frame and turns them into two simple actions:
// pinch (thumb and index) and grab (fist). Hand tracking first. Controllers
// work too (trigger = pinch, grip = grab), as a low priority fallback.
import { Matrix4, Quaternion, Vector3 } from 'three';
import { HANDS, HOLD } from '../config/game.js';
import { PoseSwitch } from './gesture.js';

export type Side = 'left' | 'right';

export class HandState {
  /** Tracked this frame, or still inside the lost tracking grace time. */
  tracked = false;
  usingHand = false;
  /** Midpoint of thumb and index tips (world, meters). */
  readonly pinchPoint = new Vector3();
  /** Index fingertip, for poking buttons (world, meters). */
  readonly indexTip = new Vector3();
  /** Center of the palm (world, meters). */
  readonly palm = new Vector3();
  /** Wrist orientation (world). Used to carry tools held with a pinch. */
  readonly quaternion = new Quaternion();
  /**
   * The fist frame, from the hand's joints, for tools held in a fist
   * (src/player/hold.ts). All world unit vectors: `rod` runs through the fist
   * along the knuckles toward the thumb, `palmNormal` points out of the palm,
   * `forward` from the wrist toward the knuckles. `gripPoint` is the fist's
   * hole, where a handle runs.
   */
  readonly rod = new Vector3(0, 1, 0);
  readonly palmNormal = new Vector3(-1, 0, 0);
  readonly forward = new Vector3(0, 0, -1);
  readonly gripPoint = new Vector3();
  readonly pinch = new PoseSwitch(HANDS.poseHold, 0.04);
  readonly fist = new PoseSwitch(HANDS.fistHold, 0.06);
  lostTime = 0;

  constructor(readonly side: Side) {}
}

const TIPS: XRHandJoint[] = ['index-finger-tip', 'middle-finger-tip', 'ring-finger-tip', 'pinky-finger-tip'];
const thumb = new Vector3();
const index = new Vector3();
const wrist = new Vector3();
const knuckle = new Vector3();
const tip = new Vector3();
const indexBase = new Vector3();
const pinkyBase = new Vector3();
const palmLocal = new Vector3();
const gripMatrix = new Matrix4();
const gripPosition = new Vector3();
const gripQuaternion = new Quaternion();
const unitScale = new Vector3(1, 1, 1);
const playerQuaternion = new Quaternion();
const playerPosition = new Vector3();
const playerScale = new Vector3();

function readJoint(frame: XRFrame, hand: XRHand, name: XRHandJoint, space: XRReferenceSpace, out: Vector3): boolean {
  const joint = hand.get(name);
  if (!joint) return false;
  const pose = frame.getJointPose?.(joint, space);
  if (!pose) return false;
  const p = pose.transform.position;
  out.set(p.x, p.y, p.z);
  return true;
}

export class HandTracker {
  readonly left = new HandState('left');
  readonly right = new HandState('right');
  readonly hands: HandState[] = [this.left, this.right];
  private seen = new Set<Side>();

  /**
   * `playerMatrix` turns tracking space into world space (the XR origin's
   * world matrix). Pass null frame outside VR.
   */
  update(frame: XRFrame | null, space: XRReferenceSpace | null, playerMatrix: Matrix4, dt: number): void {
    this.seen.clear();
    playerMatrix.decompose(playerPosition, playerQuaternion, playerScale);
    if (frame && space) {
      for (const source of frame.session.inputSources) {
        const side = source.handedness;
        if (side !== 'left' && side !== 'right') continue;
        const state = side === 'left' ? this.left : this.right;
        if (source.hand) {
          if (this.readHand(frame, source.hand, space, playerMatrix, state, dt)) this.seen.add(side);
        } else if (source.gamepad && source.gripSpace) {
          if (this.readController(frame, source, space, playerMatrix, state, dt)) this.seen.add(side);
        }
      }
    }
    for (const state of this.hands) {
      if (this.seen.has(state.side)) {
        state.tracked = true;
        state.lostTime = 0;
        continue;
      }
      // Lost tracking: keep the last state for a moment instead of cancelling.
      state.lostTime += dt;
      state.pinch.started = state.pinch.ended = false;
      state.fist.started = state.fist.ended = false;
      if (state.lostTime > HANDS.lostGrace && state.tracked) {
        state.tracked = false;
        state.pinch.forceOff();
        state.fist.forceOff();
      }
    }
  }

  private readHand(
    frame: XRFrame,
    hand: XRHand,
    space: XRReferenceSpace,
    playerMatrix: Matrix4,
    state: HandState,
    dt: number,
  ): boolean {
    const wristJoint = hand.get('wrist');
    const wristPose = wristJoint ? frame.getJointPose?.(wristJoint, space) : undefined;
    if (
      !wristPose ||
      !readJoint(frame, hand, 'thumb-tip', space, thumb) ||
      !readJoint(frame, hand, 'index-finger-tip', space, index) ||
      !readJoint(frame, hand, 'wrist', space, wrist) ||
      !readJoint(frame, hand, 'middle-finger-phalanx-proximal', space, knuckle)
    ) {
      return false;
    }
    palmLocal.copy(wrist).add(knuckle).multiplyScalar(0.5);
    // Count fingers instead of averaging them: with the back of the hand toward
    // the headset some fingers are hidden and guessed, so one bad finger must
    // not break the fist.
    let curled = 0;
    let open = 0;
    for (const name of TIPS) {
      if (!readJoint(frame, hand, name, space, tip)) return false;
      const d = tip.distanceTo(palmLocal);
      if (d < HANDS.fingerCurled) curled++;
      else if (d > HANDS.fingerOpen) open++;
    }
    const pinchDistance = thumb.distanceTo(index);
    state.usingHand = true;
    state.pinchPoint.copy(thumb).add(index).multiplyScalar(0.5).applyMatrix4(playerMatrix);
    state.indexTip.copy(index).applyMatrix4(playerMatrix);
    state.palm.copy(palmLocal).applyMatrix4(playerMatrix);
    const o = wristPose.transform.orientation;
    state.quaternion.set(o.x, o.y, o.z, o.w).premultiply(playerQuaternion);
    // The fist frame from the knuckles, so it holds whatever way the wrist joint is defined.
    if (
      readJoint(frame, hand, 'index-finger-phalanx-proximal', space, indexBase) &&
      readJoint(frame, hand, 'pinky-finger-phalanx-proximal', space, pinkyBase)
    ) {
      const toWorld = (v: Vector3): Vector3 => v.applyMatrix4(playerMatrix);
      toWorld(wrist);
      toWorld(knuckle);
      toWorld(indexBase);
      toWorld(pinkyBase);
      state.forward.subVectors(knuckle, wrist).normalize();
      // Across the knuckles, from the pinky to the index (the thumb side), square to forward.
      state.rod.subVectors(indexBase, pinkyBase);
      state.rod.addScaledVector(state.forward, -state.rod.dot(state.forward)).normalize();
      // Out of the palm: forward x rod points out of the back of a right hand and out of the palm of a left one.
      state.palmNormal.crossVectors(state.forward, state.rod);
      if (state.side === 'right') state.palmNormal.negate();
      state.gripPoint
        .copy(state.palm)
        .addScaledVector(state.forward, HOLD.gripForward)
        .addScaledVector(state.palmNormal, HOLD.gripOut);
    }
    state.pinch.update(pinchDistance < HANDS.pinchStart, pinchDistance > HANDS.pinchEnd, dt);
    state.fist.update(curled >= HANDS.fistFingers, open >= HANDS.fistFingers, dt);
    return true;
  }

  private readController(
    frame: XRFrame,
    source: XRInputSource,
    space: XRReferenceSpace,
    playerMatrix: Matrix4,
    state: HandState,
    dt: number,
  ): boolean {
    const pose = frame.getPose(source.gripSpace!, space);
    if (!pose) return false;
    const p = pose.transform.position;
    const o = pose.transform.orientation;
    state.usingHand = false;
    state.palm.set(p.x, p.y, p.z).applyMatrix4(playerMatrix);
    // Pinch point a little in front of the grip.
    gripMatrix.compose(gripPosition.set(p.x, p.y, p.z), gripQuaternion.set(o.x, o.y, o.z, o.w), unitScale);
    state.pinchPoint.set(0, -0.01, -0.05).applyMatrix4(gripMatrix).applyMatrix4(playerMatrix);
    state.indexTip.copy(state.pinchPoint);
    state.quaternion.copy(gripQuaternion).premultiply(playerQuaternion);
    // Controllers (low priority): the fist frame from the grip space, roughly.
    // Its -z runs through the closed hand, and its x is across the palm.
    state.rod.set(0, 0, -1).applyQuaternion(state.quaternion);
    state.palmNormal.set(state.side === 'right' ? -1 : 1, 0, 0).applyQuaternion(state.quaternion);
    state.forward.crossVectors(state.rod, state.palmNormal).multiplyScalar(state.side === 'right' ? 1 : -1);
    state.gripPoint.copy(state.palm);
    const buttons = source.gamepad!.buttons;
    const trigger = (buttons[0]?.value ?? 0) > 0.6;
    const squeeze = (buttons[1]?.value ?? 0) > 0.6;
    state.pinch.update(trigger, !trigger, dt);
    state.fist.update(squeeze, !squeeze, dt);
    return true;
  }
}
