// The two board handles in front of the player, each with one job and a big
// arrow (docs/controls-and-ui.md, section 2). Grab with a fist.
//   Rotate handle (right): slide the knob along its curved track, the board
//   turns with it 1:1. On release the knob glides back, the board stays.
//   Height handle (left): slide the bar up or down, the board follows 1:1.
import { Group, MeshStandardMaterial, Object3D, Vector3 } from 'three';
import { HANDLES } from '../config/game.js';
import { angleDelta, angleOf, degToRad, polarX, polarZ } from '../rules/boardMath.js';
import type { Stage } from '../world/stage.js';
import {
  curvedDoubleArrow,
  flatMaterial,
  heightBar,
  heightRails,
  rotateKnob,
  rotateTrack,
  verticalDoubleArrow,
} from '../world/shapes.js';
import { applyTouchState, type TouchState } from './feedback.js';
import type { HandState } from './hands.js';

export type HandleKind = 'rotate' | 'height';

interface HandleInfo {
  kind: HandleKind;
  materials: MeshStandardMaterial[];
  /** Point to measure grab distance from. */
  grabPoint: Object3D;
  state: TouchState;
}

const temp = new Vector3();

export class BoardHandles {
  private knob: Group;
  private bar: Group;
  private rotate: HandleInfo;
  private height: HandleInfo;
  /** Knob position on its track (radians from the track center). */
  private knobOffset = 0;
  private holder: { hand: HandState; kind: HandleKind } | null = null;
  private grabHandAngle = 0;
  private grabKnobOffset = 0;
  private grabSpin = 0;
  private grabHandY = 0;
  private grabHeight = 0;

  constructor(private stage: Stage) {
    const rig = stage.fixedRig;
    const knobMaterial = flatMaterial(HANDLES.woodColor);
    const rotateArrowMaterial = flatMaterial(HANDLES.arrowColor);
    const barMaterial = flatMaterial(HANDLES.woodColor);
    const heightArrowMaterial = flatMaterial(HANDLES.arrowColor);

    rig.add(rotateTrack());
    this.knob = rotateKnob(knobMaterial);
    rig.add(this.knob);
    rig.add(curvedDoubleArrow(rotateArrowMaterial, 11));
    this.placeKnob();

    rig.add(heightRails());
    this.bar = heightBar(barMaterial);
    rig.add(this.bar);
    rig.add(verticalDoubleArrow(heightArrowMaterial));
    this.placeBar();

    this.rotate = {
      kind: 'rotate',
      materials: [knobMaterial, rotateArrowMaterial],
      grabPoint: this.knob.getObjectByName('knob') ?? this.knob,
      state: 'idle',
    };
    this.height = { kind: 'height', materials: [barMaterial, heightArrowMaterial], grabPoint: this.bar, state: 'idle' };
  }

  /** Distance (meters) from a hand's palm to a handle, or Infinity if held by the other hand. */
  distanceTo(kind: HandleKind, hand: HandState): number {
    if (this.holder && this.holder.hand !== hand) return Infinity;
    const info = kind === 'rotate' ? this.rotate : this.height;
    info.grabPoint.getWorldPosition(temp);
    return temp.distanceTo(hand.palm);
  }

  /** Nearest handle within the grab zone of this hand. */
  nearest(hand: HandState): { kind: HandleKind; distance: number } | null {
    let best: { kind: HandleKind; distance: number } | null = null;
    for (const kind of ['rotate', 'height'] as HandleKind[]) {
      const d = this.distanceTo(kind, hand);
      if (d < HANDLES.grabRadius && (!best || d < best.distance)) best = { kind, distance: d };
    }
    return best;
  }

  isHeldBy(hand: HandState): boolean {
    return this.holder?.hand === hand;
  }

  get busy(): boolean {
    return this.holder !== null;
  }

  grab(kind: HandleKind, hand: HandState): void {
    this.holder = { hand, kind };
    this.stage.fixedRig.worldToLocal(temp.copy(hand.palm));
    this.grabHandAngle = angleOf(temp.x, temp.z);
    this.grabKnobOffset = this.knobOffset;
    this.grabSpin = this.stage.spin;
    this.grabHandY = temp.y;
    this.grabHeight = this.stage.height;
  }

  release(): void {
    this.holder = null;
  }

  /** Sets the Ready look (or Idle) for a handle. Held is managed here. */
  setReady(kind: HandleKind | null): void {
    for (const info of [this.rotate, this.height]) {
      const held = this.holder?.kind === info.kind;
      this.setState(info, held ? 'held' : info.kind === kind ? 'ready' : 'idle');
    }
  }

  update(dt: number): void {
    const holder = this.holder;
    if (holder) {
      this.stage.fixedRig.worldToLocal(temp.copy(holder.hand.palm));
      if (holder.kind === 'rotate') {
        const span = degToRad(HANDLES.rotateSpanDeg);
        const moved = angleDelta(this.grabHandAngle, angleOf(temp.x, temp.z));
        const offset = Math.min(span, Math.max(-span, this.grabKnobOffset + moved));
        // The board turns 1:1 with the knob (only while the knob is on its track).
        this.stage.spin = this.grabSpin - (offset - this.grabKnobOffset);
        this.knobOffset = offset;
      } else {
        this.stage.height = this.grabHeight + (temp.y - this.grabHandY);
      }
    } else if (this.knobOffset !== 0) {
      this.knobOffset *= Math.exp(-HANDLES.knobReturnRate * dt);
      if (Math.abs(this.knobOffset) < 1e-4) this.knobOffset = 0;
    }
    this.placeKnob();
    this.placeBar();
  }

  /** Debug keys: turn the board and change its height without hands. */
  nudge(spinRadians: number, heightCm: number): void {
    this.stage.spin += spinRadians;
    this.stage.height += heightCm;
  }

  private placeKnob(): void {
    const a = degToRad(HANDLES.rotateAngleDeg) + this.knobOffset;
    this.knob.position.set(polarX(HANDLES.radius, a), 0, polarZ(HANDLES.radius, a));
  }

  private placeBar(): void {
    const a = degToRad(HANDLES.heightAngleDeg);
    this.bar.position.set(polarX(HANDLES.radius, a), HANDLES.barRestY + this.stage.height, polarZ(HANDLES.radius, a));
  }

  private setState(info: HandleInfo, state: TouchState): void {
    if (info.state === state) return;
    info.state = state;
    applyTouchState(info.materials, state);
  }
}
