// The ring handle: one rail around the player that moves the board
// (docs/controls-and-ui.md, section 2). Grab it anywhere with a fist or a
// pinch. The first few cm of hand movement lock one direction for the grab:
//   Sideways: the board and the ring spin with the hand 1:1 and stay where
//   they are on release. Let go and grab again for more.
//   Up or down: the board rises or lowers with the hand 1:1.
// The ring lives in boardLift, so it rises with the board, and turns on its
// own group so it follows the hand. The arrows never turn.
import { Group, MeshStandardMaterial, Vector3 } from 'three';
import { HANDLES } from '../config/game.js';
import { angleDelta, angleOf, degToRad, polarX, polarZ } from '../rules/boardMath.js';
import { compassLetters } from '../world/compassLetters.js';
import type { Stage } from '../world/stage.js';
import { curvedDoubleArrow, flatMaterial, ringArc, ringBands, ringPoles, verticalDoubleArrow } from '../world/shapes.js';
import { applyTouchState, type TouchState } from './feedback.js';
import type { HandState } from './hands.js';

type Axis = 'none' | 'spin' | 'height';

interface Holder {
  hand: HandState;
  /** Held with a pinch (follow the pinch point) or a fist (follow the palm). */
  viaPinch: boolean;
  axis: Axis;
  openTime: number;
  /** Hand and board values where the current movement started. */
  startAngle: number;
  startY: number;
  startSpin: number;
  startHeight: number;
  startTurn: number;
}

const CM = 0.01;
const temp = new Vector3();
const ringPoint = new Vector3();

export class BoardHandles {
  private ring = new Group();
  private materials: MeshStandardMaterial[];
  private state: TouchState = 'idle';
  private holder: Holder | null = null;
  /** Ring turn from where it was built (radians, same sense as the board spin). */
  private turn = 0;

  constructor(private stage: Stage) {
    const ringMaterial = flatMaterial(HANDLES.woodColor);
    const arrowMaterial = flatMaterial(HANDLES.arrowColor);
    this.materials = [ringMaterial, arrowMaterial];
    const { radius, ringY, ringRadius, sideArrowDeg, frontArrowHalfDeg } = HANDLES;
    const arrowY = ringY + ringRadius + 0.2;
    // Compass letters in the bands' gold turn with the ring, which turns with the board.
    this.ring.add(ringArc(ringMaterial), ringPoles(), ringBands(arrowMaterial), compassLetters(arrowMaterial));
    // The arrows never turn: they always sit in front of the player.
    const arrows = new Group();
    arrows.add(curvedDoubleArrow(arrowMaterial, radius, 0, frontArrowHalfDeg, arrowY));
    for (const side of [-1, 1]) {
      arrows.add(verticalDoubleArrow(arrowMaterial, radius, side * sideArrowDeg, arrowY));
    }
    stage.boardLift.add(this.ring, arrows);
  }

  /** Distance (meters) from a hand to the ring, or null if out of the grab zone or held by the other hand. */
  reach(hand: HandState): number | null {
    if (this.holder && this.holder.hand !== hand) return null;
    const d = Math.min(this.distanceTo(hand.palm), this.distanceTo(hand.pinchPoint));
    return d < HANDLES.grabRadius ? d : null;
  }

  isHeldBy(hand: HandState): boolean {
    return this.holder?.hand === hand;
  }

  get busy(): boolean {
    return this.holder !== null;
  }

  grab(hand: HandState, viaPinch: boolean): void {
    this.holder = {
      hand,
      viaPinch,
      axis: 'none',
      openTime: 0,
      startAngle: 0,
      startY: 0,
      startSpin: 0,
      startHeight: 0,
      startTurn: 0,
    };
    this.restart(this.holder);
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
      // Let go only when the hand is clearly open for a moment, so tracking
      // flickers (fingers hidden behind the palm) do not drop the ring.
      const closed = holder.hand.pinch.on || holder.hand.fist.on;
      holder.openTime = closed ? 0 : holder.openTime + dt;
      if (!holder.hand.tracked || holder.openTime >= HANDLES.releaseHold) {
        this.release();
      } else {
        this.follow(holder);
      }
    }
    this.ring.rotation.y = this.turn;
  }

  /** Debug page: turn the board and change its height without hands. */
  nudge(spinRadians: number, heightCm: number): void {
    this.stage.spin += spinRadians;
    // The ring turns along, so its compass letters keep matching the board.
    this.turn = angleDelta(0, this.turn + spinRadians);
    this.stage.height += heightCm;
  }

  private follow(holder: Holder): void {
    this.handLocal(holder);
    const angle = angleOf(temp.x, temp.z);
    const moved = angleDelta(holder.startAngle, angle);
    if (holder.axis === 'none') {
      // Real cm along the ring (the board, and so the ring, is sized by the reach check).
      const side = Math.abs(moved * HANDLES.radius * this.stage.boardScale);
      const up = Math.abs(temp.y - holder.startY);
      if (Math.max(side, up) < HANDLES.axisLock) return;
      // Lock the bigger direction and start moving from here, so nothing jumps.
      holder.axis = side >= up ? 'spin' : 'height';
      this.restart(holder);
      return;
    }
    if (holder.axis === 'spin') {
      // A bigger spin moves the board to the left, so a hand moving right lowers it.
      this.stage.spin = holder.startSpin - moved;
      // Wrapped to one circle, so it never grows without end.
      this.turn = angleDelta(0, holder.startTurn - moved);
    } else {
      this.stage.height = holder.startHeight + (temp.y - holder.startY);
    }
  }

  private restart(holder: Holder): void {
    this.handLocal(holder);
    holder.startAngle = angleOf(temp.x, temp.z);
    holder.startY = temp.y;
    holder.startSpin = this.stage.spin;
    holder.startHeight = this.stage.height;
    holder.startTurn = this.turn;
  }

  /** Hand point in fixedRig space (cm), which does not move with the height. */
  private handLocal(holder: Holder): void {
    temp.copy(holder.viaPinch ? holder.hand.pinchPoint : holder.hand.palm);
    this.stage.fixedRig.worldToLocal(temp);
  }

  /** Distance (meters) from a world point to the nearest point on the ring. */
  private distanceTo(world: Vector3): number {
    this.stage.boardLift.worldToLocal(temp.copy(world));
    // The zone is a band on and above the ring, so a hand resting below it never grabs.
    if (temp.y < HANDLES.ringY - HANDLES.grabBelow) return Infinity;
    const span = degToRad(HANDLES.halfSpanDeg);
    // The ring group turns by `turn`, which moves its points by -turn in board angles.
    const local = Math.min(span, Math.max(-span, angleDelta(0, angleOf(temp.x, temp.z) + this.turn)));
    const a = local - this.turn;
    ringPoint.set(polarX(HANDLES.radius, a), HANDLES.ringY, polarZ(HANDLES.radius, a));
    return temp.distanceTo(ringPoint) * CM * this.stage.boardScale;
  }

  private setState(state: TouchState): void {
    if (this.state === state) return;
    this.state = state;
    applyTouchState(this.materials, state);
  }
}
