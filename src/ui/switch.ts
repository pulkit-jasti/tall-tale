// The one on and off switch used everywhere (first in the settings'
// Accessibility tab), for hands (SWITCH in src/config/game.ts). Its state
// shows three ways at once, so it reads without guessing and without
// relying on color alone:
//
//   - Position: the round knob sits on the right when on, on the left when off.
//   - Color: the track is the buttons' green when on, a plain grey when off.
//   - Text: the word "On" or "Off" is written on the track, beside the knob.
//
// Slide it, like the slider: touch the knob with the tip of the index finger
// (from the front) and slide it along; it follows 1:1. Let go (pull the
// finger back) past the middle and it snaps to the other side and flips;
// short of the middle it springs back where it was, with a little bounce
// (an elastic feel). A tick when the knob crosses the middle, a click when
// it flips. Only one slider or switch moves at a time. Same Idle, Ready,
// Held and Locked looks as every other touchable thing (emissive only).
// Locked (a choice that is not open now) it ignores touches. Its face
// points along the group's local +z; sizes in the parent's units (cm in the
// rigs).
import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3, type CanvasTexture, type MeshStandardMaterial } from 'three';
import type { GameAudio } from '../audio/sound.js';
import { POKE, SWITCH } from '../config/game.js';
import type { TouchState } from '../player/feedback.js';
import type { HandState } from '../player/hands.js';
import { flatMaterial } from '../world/shapes.js';
import { canvasTexture } from './kit/canvas.js';
import { canDrag, changeTouch, endDrag, takeDrag, type Control } from './kit/controls.js';
import { drawOutlined } from './kit/text.js';

export interface SwitchOptions {
  on: boolean;
}

const local = new Vector3();

export class Switch implements Control {
  /** Place and turn this group. Its +z is the switch's face. */
  readonly group = new Group();
  onChange: (on: boolean) => void = () => {};
  private on: boolean;
  private locked = false;
  private trackMaterial: MeshStandardMaterial;
  private knob: Mesh;
  private knobMaterial: MeshStandardMaterial;
  private labelCanvas = document.createElement('canvas');
  private labelTexture: CanvasTexture;
  private label: Mesh;
  /** Where the knob is now, from 0 (left, off) to 1 (right, on): it follows the finger, or springs to its side. */
  private knobAt: number;
  /** The spring's speed (knob widths per second). */
  private knobSpeed = 0;
  private touch: TouchState = 'idle';
  private armed = false;
  /** The hand sliding the knob. */
  private held: HandState | null = null;
  /** Knob spot minus the fingertip's when grabbed, so the knob does not jump. */
  private grabOffset = 0;
  private cooldown = 0;
  private lastZ = new Map<HandState, number>();

  constructor(
    private audio: GameAudio,
    options: SwitchOptions,
  ) {
    const S = SWITCH;
    this.on = options.on;
    this.knobAt = this.on ? 1 : 0;
    // The track: a rounded bar (a box with a round cap at each end), in the state's color.
    this.trackMaterial = flatMaterial(S.offColor);
    this.trackMaterial.flatShading = false;
    const straight = S.width - S.height;
    const body = new Mesh(new BoxGeometry(straight, S.height, S.depth), this.trackMaterial);
    body.position.z = S.depth / 2;
    this.group.add(body);
    for (const side of [-1, 1]) {
      const cap = new Mesh(new CylinderGeometry(S.height / 2, S.height / 2, S.depth, POKE.segments), this.trackMaterial);
      cap.rotation.x = Math.PI / 2;
      cap.position.set((side * straight) / 2, 0, S.depth / 2);
      this.group.add(cap);
    }
    // The word on the track, on the side away from the knob.
    this.labelCanvas.width = 256;
    this.labelCanvas.height = 128;
    this.labelTexture = canvasTexture(this.labelCanvas, 4);
    this.label = new Mesh(
      new PlaneGeometry(S.height * 2, S.height),
      new MeshBasicMaterial({ map: this.labelTexture, transparent: true, fog: false, toneMapped: false }),
    );
    this.label.position.z = S.depth + 0.03;
    this.group.add(this.label);
    // The knob: a round cream cap standing out of the track.
    this.knobMaterial = flatMaterial(S.knobColor);
    this.knobMaterial.flatShading = false;
    this.knob = new Mesh(new CylinderGeometry(S.knobRadius, S.knobRadius, S.knobDepth, POKE.segments), this.knobMaterial);
    this.knob.rotation.x = Math.PI / 2;
    this.knob.position.z = S.depth + S.knobDepth / 2;
    this.group.add(this.knob);
    this.show(true);
  }

  get value(): boolean {
    return this.on;
  }

  /** Sets it without telling onChange (for example when a panel opens). */
  set(on: boolean): void {
    if (on === this.on) return;
    this.on = on;
    this.show(false);
  }

  /** A choice that is not open now (for example the megaphone without a mic): it shows Locked and ignores touches. */
  setLocked(locked: boolean): void {
    this.locked = locked;
    if (locked) this.letGo();
    this.setTouch(locked ? 'locked' : 'idle');
  }

  lock(seconds: number): void {
    this.cooldown = Math.max(this.cooldown, seconds);
  }

  reset(): void {
    this.letGo();
    this.armed = false;
    this.lastZ.clear();
    this.setTouch(this.locked ? 'locked' : 'idle');
  }

  /** Every frame while it shows. */
  update(hands: HandState[], dt: number): void {
    const S = SWITCH;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.group.updateWorldMatrix(true, false);
    const travel = S.width / 2 - S.height / 2;
    // Sliding: the knob follows the finger along the track until the finger pulls back off the face.
    if (this.held) {
      const hand = this.held;
      this.group.worldToLocal(local.copy(hand.indexTip));
      if (!hand.tracked || local.z > S.releaseOut || Math.abs(local.y) > S.height * 1.2) {
        this.release();
        return;
      }
      takeDrag(this);
      const before = this.knobAt;
      const x = Math.min(travel, Math.max(-travel, local.x + this.grabOffset));
      this.knobAt = (x + travel) / (2 * travel);
      // A tick as it crosses the middle: let go now and it goes the other way.
      if (before < 0.5 !== this.knobAt < 0.5) this.audio.play('readyTick', undefined, 1, 0.05);
      this.knobSpeed = 0;
      this.placeKnob();
      return;
    }
    // Not held: the knob springs to its side, overshooting a little (elastic).
    const goal = this.on ? 1 : 0;
    if (this.knobAt !== goal || this.knobSpeed !== 0) {
      this.knobSpeed += (S.springStiffness * (goal - this.knobAt) - S.springDamping * this.knobSpeed) * dt;
      this.knobAt += this.knobSpeed * dt;
      if (Math.abs(goal - this.knobAt) < 0.002 && Math.abs(this.knobSpeed) < 0.05) {
        this.knobAt = goal;
        this.knobSpeed = 0;
      }
      this.placeKnob();
    }
    if (this.locked) return;
    // Ready while a fingertip is over the knob, in front of it; grabbed when it touches it.
    const knobX = this.knobX();
    const reach = S.knobRadius + S.grabMargin;
    let ready = false;
    for (const hand of hands) {
      if (!hand.tracked) {
        this.lastZ.delete(hand);
        continue;
      }
      this.group.worldToLocal(local.copy(hand.indexTip));
      const dx = local.x - knobX;
      if (dx * dx + local.y * local.y > reach * reach || local.z < -S.zoneBehind) {
        this.lastZ.delete(hand);
        continue;
      }
      // A quick touch: in front last frame and on it now grabs at once, even if no frame caught the way in.
      const before = this.lastZ.get(hand);
      this.lastZ.set(hand, local.z);
      const quick = before !== undefined && before > S.touchAt + 0.3;
      if (local.z > S.readyDistance) continue;
      ready = true;
      if (local.z > S.touchAt + 0.3) this.armed = true;
      if (local.z <= S.touchAt && (this.armed || quick) && this.cooldown <= 0 && canDrag(this)) {
        this.held = hand;
        this.grabOffset = knobX - local.x;
        this.knobSpeed = 0;
        takeDrag(this);
        this.setTouch('held');
        return;
      }
    }
    // A finger that arrived from behind or below cannot grab: it has to come from the front.
    if (!ready) this.armed = false;
    this.setTouch(ready ? 'ready' : 'idle');
  }

  /** Let go: past the middle it flips to the other side, short of it it springs back. */
  private release(): void {
    const on = this.knobAt >= 0.5;
    this.letGo();
    this.setTouch('idle');
    if (on !== this.on) {
      this.on = on;
      this.show(false);
      this.audio.play('buttonClick');
      this.onChange(this.on);
    }
  }

  private letGo(): void {
    this.held = null;
    this.armed = false;
    endDrag(this);
  }

  private knobX(): number {
    const travel = SWITCH.width / 2 - SWITCH.height / 2;
    return -travel + this.knobAt * travel * 2;
  }

  /** The color, the word, and the knob (at once when `snap`, else it springs over). */
  private show(snap: boolean): void {
    const S = SWITCH;
    this.trackMaterial.color.setHex(this.on ? S.onColor : S.offColor);
    const c = this.labelCanvas.getContext('2d')!;
    c.clearRect(0, 0, this.labelCanvas.width, this.labelCanvas.height);
    drawOutlined(c, this.on ? 'On' : 'Off', 128, 68, 78, '#ffffff', 0.12);
    this.labelTexture.needsUpdate = true;
    // The word sits on the side away from the knob.
    this.label.position.x = (this.on ? -1 : 1) * (S.width / 2 - S.height * 0.95);
    if (snap) {
      this.knobAt = this.on ? 1 : 0;
      this.knobSpeed = 0;
    }
    this.placeKnob();
  }

  private placeKnob(): void {
    // The bounce may carry it a little past an end, never far.
    const travel = SWITCH.width / 2 - SWITCH.height / 2;
    const at = Math.min(1 + SWITCH.overshoot, Math.max(-SWITCH.overshoot, this.knobAt));
    this.knob.position.x = -travel + at * travel * 2;
  }

  private setTouch(state: TouchState): void {
    this.touch = changeTouch(this.audio, [this.knobMaterial], this.touch, state);
  }
}
