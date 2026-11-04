// The scene graph around the player.
//
// root (meters, at the player's seat, turned to face where they looked)
//   boardLift (cm units: scale 0.01 times boardScale, moves up and down with the ring handle)
//     boardSpin (turns with the ring handle: board, castle, roads, goblins)
//     ring handle (rises with the board, turns only while held)
//     tools, platforms, pebble bowl, food jar, flags, hint sign, end panel (rise with the board, never turn)
//   fixedRig (real cm, never turns, moves or scales after placing: the frame
//     the ring handle and the pepper shaker measure the hand in)
//
// Only boardSpin turns, so the sky, tools and flags stay still (comfort rule).
// The tools rise with the board, so they always stand at the same height on
// it, just outside the ring, and the ring never passes through them.
import { Group, Object3D, Quaternion, Vector3 } from 'three';
import { BOARD, CALIBRATION, HANDLES } from '../config/game.js';

const CM = 0.01;
const forward = new Vector3();

export class Stage {
  readonly root = new Group();
  readonly boardLift = new Group();
  readonly boardSpin = new Group();
  readonly fixedRig = new Group();

  /** Board surface height of the last placement (meters, world). */
  private baseY = 0.7;
  /** Extra board height set with the height handle (cm). */
  private heightOffset = 0;
  /**
   * Size of everything in boardLift, from the reach check (1 = the sizes in
   * config). It grows or shrinks smoothly toward `scaleTarget`.
   */
  private scaleNow = 1;
  private scaleTarget = 1;

  constructor(parent: Object3D) {
    this.root.name = 'stage';
    this.boardLift.scale.setScalar(CM);
    this.fixedRig.scale.setScalar(CM);
    this.boardLift.add(this.boardSpin);
    this.root.add(this.boardLift, this.fixedRig);
    parent.add(this.root);
    this.applyHeight();
  }

  /**
   * Auto placement: the board centers on the head, sits a fixed distance
   * below the eyes and turns its front toward where the player looks.
   */
  place(headPosition: Vector3, headQuaternion: Quaternion): void {
    forward.set(0, 0, -1).applyQuaternion(headQuaternion);
    const yaw = Math.atan2(-forward.x, -forward.z);
    this.root.position.set(headPosition.x, 0, headPosition.z);
    this.root.rotation.set(0, yaw, 0);
    this.baseY = headPosition.y - BOARD.eyeToBoard;
    this.applyHeight();
  }

  /** Board turn angle (radians, around the vertical axis). */
  get spin(): number {
    return this.boardSpin.rotation.y;
  }
  set spin(value: number) {
    this.boardSpin.rotation.y = value;
    this.boardSpin.updateMatrixWorld(true);
  }

  /**
   * How much bigger the board is than its config size (the reach check sets
   * it). A board cm is this many real cm. Code that turns board distances
   * into meters by hand multiplies by it.
   */
  get boardScale(): number {
    return this.scaleNow;
  }

  /** Sets the board size, at once or growing there smoothly (the end of the reach check). */
  setBoardScale(scale: number, smooth: boolean): void {
    this.scaleTarget = scale;
    if (!smooth) {
      this.scaleNow = scale;
      this.applyScale();
    }
  }

  /** Every frame: the smooth grow toward the new size. */
  update(dt: number): void {
    if (this.scaleNow === this.scaleTarget) return;
    const k = 1 - Math.exp(-dt / CALIBRATION.growSmoothing);
    this.scaleNow += (this.scaleTarget - this.scaleNow) * k;
    if (Math.abs(this.scaleTarget - this.scaleNow) < 0.001) this.scaleNow = this.scaleTarget;
    this.applyScale();
  }

  get height(): number {
    return this.heightOffset;
  }
  set height(cm: number) {
    this.heightOffset = Math.min(HANDLES.heightMax, Math.max(HANDLES.heightMin, cm));
    this.applyHeight();
  }

  private applyScale(): void {
    this.boardLift.scale.setScalar(CM * this.scaleNow);
    this.root.updateMatrixWorld(true);
  }

  private applyHeight(): void {
    this.fixedRig.position.y = this.baseY;
    this.boardLift.position.y = this.baseY + this.heightOffset * CM;
    this.root.updateMatrixWorld(true);
  }
}
