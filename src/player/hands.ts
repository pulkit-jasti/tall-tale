// Reads both hands every frame and turns them into two simple actions:
// pinch (thumb and index) and grab (fist). Hand tracking first. Controllers
// work too (trigger = pinch, grip = grab), as a low priority fallback.
import { Matrix4, Quaternion, Vector3 } from 'three';
import { HANDS } from '../config/game.js';
import { PoseSwitch } from './gesture.js';

export type Side = 'left' | 'right';

export class HandState {
  /** Tracked this frame, or still inside the lost tracking grace time. */
  tracked = false;
  usingHand = false;
  /** Midpoint of thumb and index tips (world, meters). */
  readonly pinchPoint = new Vector3();
  /** Center of the palm (world, meters). */
  readonly palm = new Vector3();
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
const palmLocal = new Vector3();
const gripMatrix = new Matrix4();
const gripPosition = new Vector3();
const gripQuaternion = new Quaternion();
const unitScale = new Vector3(1, 1, 1);

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
    if (
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
    state.palm.copy(palmLocal).applyMatrix4(playerMatrix);
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
    const buttons = source.gamepad!.buttons;
    const trigger = (buttons[0]?.value ?? 0) > 0.6;
    const squeeze = (buttons[1]?.value ?? 0) > 0.6;
    state.pinch.update(trigger, !trigger, dt);
    state.fist.update(squeeze, !squeeze, dt);
    return true;
  }
}
