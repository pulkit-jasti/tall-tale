// The scene graph around the player.
//
// root (meters, at the player's seat, turned to face where they looked)
//   boardLift (cm units: scale 0.01, moves up and down with the ring handle)
//     boardSpin (turns with the ring handle: board, castle, roads, goblins)
//     ring handle (rises with the board, turns only while held)
//   fixedRig (cm units, never turns or moves after placing: later tools and flags)
//
// Only boardSpin turns, so the sky, tools and flags stay still (comfort rule).
import { Group, Object3D, Quaternion, Vector3 } from 'three';
import { BOARD, HANDLES } from '../config/game.js';

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

  get height(): number {
    return this.heightOffset;
  }
  set height(cm: number) {
    this.heightOffset = Math.min(HANDLES.heightMax, Math.max(HANDLES.heightMin, cm));
    this.applyHeight();
  }

  private applyHeight(): void {
    this.fixedRig.position.y = this.baseY;
    this.boardLift.position.y = this.baseY + this.heightOffset * CM;
    this.root.updateMatrixWorld(true);
  }
}
