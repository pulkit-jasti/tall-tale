// The home screen's height rail (headset test 2026-11-11): a short piece of
// the ring handle in front, with an up and down arrow, so the player can
// raise or lower the board (and the menu with it) without the battle. It
// never spins the board: only up and down, 1:1 with the hand, like the ring's
// height grab. Grab it with a fist or a pinch (the hand open in its zone for
// a moment first), let go by opening the hand. It lives in the menu's group,
// so it rises and sinks with the home screen. Idle, Ready and Held looks.
import { Group, MeshStandardMaterial, Vector3 } from 'three';
import { HANDLES } from '../config/game.js';
import { angleOf, degToRad, polarX, polarZ } from '../rules/boardMath.js';
import type { Stage } from '../world/stage.js';
import { flatMaterial, railArc, verticalDoubleArrow } from '../world/shapes.js';
import { applyTouchState, type TouchState } from './feedback.js';
import type { HandState } from './hands.js';

const CM = 0.01;
const temp = new Vector3();
const railPoint = new Vector3();

interface Holder {
  hand: HandState;
  viaPinch: boolean;
  openTime: number;
  startY: number;
  startHeight: number;
}

export class HeightRail {
  readonly group = new Group();
  private materials: MeshStandardMaterial[];
  private state: TouchState = 'idle';
  private holder: Holder | null = null;
  /** How long each hand has been open in the grab zone (a closing hand only grabs after readyTime). */
  private readyFor = new Map<HandState, number>();

  constructor(private stage: Stage) {
    const wood = flatMaterial(HANDLES.woodColor);
    const arrow = flatMaterial(HANDLES.arrowColor);
    this.materials = [wood, arrow];
    const { radius, ringY, ringRadius } = HANDLES;
    this.group.add(railArc(wood, HANDLES.menuRail.halfSpanDeg), verticalDoubleArrow(arrow, radius, 0, ringY + ringRadius + 0.2));
  }

  /** True while a hand holds it (that hand grabs nothing else). */
  isHeldBy(hand: HandState): boolean {
    return this.holder?.hand === hand;
  }

  /** Every frame while the home screen shows. */
  update(hands: HandState[], dt: number): void {
    const holder = this.holder;
    if (holder) {
      // Let go only when the hand is clearly open for a moment (tracking flickers never drop it).
      const closed = holder.hand.pinch.on || holder.hand.fist.on;
      holder.openTime = closed ? 0 : holder.openTime + dt;
      if (!holder.hand.tracked || holder.openTime >= HANDLES.releaseHold) {
        this.holder = null;
      } else {
        this.stage.height = holder.startHeight + (this.handY(holder) - holder.startY);
        this.setState('held');
        return;
      }
    }
    let ready = false;
    for (const hand of hands) {
      const near = hand.tracked && Math.min(this.distanceTo(hand.palm), this.distanceTo(hand.pinchPoint)) < HANDLES.grabRadius;
      if (!near) {
        this.readyFor.delete(hand);
        continue;
      }
      ready = true;
      const open = !hand.pinch.on && !hand.fist.on;
      const time = this.readyFor.get(hand) ?? 0;
      if (open) {
        this.readyFor.set(hand, time + dt);
        continue;
      }
      // Closing after being open long enough grabs (a hand that arrived closed never does).
      if ((hand.pinch.started || hand.fist.started) && time >= HANDLES.readyTime) {
        const viaPinch = !hand.fist.started;
        this.holder = { hand, viaPinch, openTime: 0, startY: 0, startHeight: this.stage.height };
        this.holder.startY = this.handY(this.holder);
        this.readyFor.clear();
        this.setState('held');
        return;
      }
    }
    this.setState(ready ? 'ready' : 'idle');
  }

  /** Let go (the home screen closes). */
  release(): void {
    this.holder = null;
    this.readyFor.clear();
    this.setState('idle');
  }

  /** The hand's height in fixedRig space (cm), which does not move with the board. */
  private handY(holder: Holder): number {
    temp.copy(holder.viaPinch ? holder.hand.pinchPoint : holder.hand.palm);
    return this.stage.fixedRig.worldToLocal(temp).y;
  }

  /** Distance (meters) from a world point to the nearest point on the rail; Infinity below it (a resting hand never grabs). */
  private distanceTo(world: Vector3): number {
    this.group.worldToLocal(temp.copy(world));
    if (temp.y < HANDLES.ringY - HANDLES.grabBelow) return Infinity;
    const span = degToRad(HANDLES.menuRail.halfSpanDeg);
    const a = Math.min(span, Math.max(-span, angleOf(temp.x, temp.z)));
    railPoint.set(polarX(HANDLES.radius, a), HANDLES.ringY, polarZ(HANDLES.radius, a));
    return temp.distanceTo(railPoint) * CM * this.stage.boardScale;
  }

  private setState(state: TouchState): void {
    if (this.state === state) return;
    this.state = state;
    applyTouchState(this.materials, state);
  }
}
