// The one on and off switch used everywhere (first in the settings'
// Accessibility tab), for hands (SWITCH in src/config/game.ts). Its state
// shows three ways at once, so it reads without guessing and without
// relying on color alone:
//
//   - Position: the round knob sits on the right when on, on the left when off.
//   - Color: the track is the buttons' green when on, a plain grey when off.
//   - Text: the word "On" or "Off" is written on the track, beside the knob.
//
// Poke it anywhere with the index finger to flip it (it has to come from the
// front; a quick poke counts too, like the buttons). One flip per poke: the
// finger must pull back before the next. The knob glides over. Same Idle,
// Ready, Held and Locked looks as every other touchable thing (emissive
// only), a click on each flip. Locked (a choice that is not open now) it
// ignores pokes. Its face points along the group's local +z; sizes in the
// parent's units (cm in the rigs).
import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3, type CanvasTexture, type MeshStandardMaterial } from 'three';
import type { GameAudio } from '../audio/sound.js';
import { POKE, SWITCH } from '../config/game.js';
import type { TouchState } from '../player/feedback.js';
import type { HandState } from '../player/hands.js';
import { flatMaterial } from '../world/shapes.js';
import { canvasTexture } from './kit/canvas.js';
import { changeTouch, type Control } from './kit/controls.js';
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
  /** Where the knob is now, from 0 (left, off) to 1 (right, on): it glides. */
  private knobAt: number;
  private touch: TouchState = 'idle';
  private armed = false;
  /** Flipped by this push: no new flip until the finger pulls back. */
  private flipped = false;
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

  /** A choice that is not open now (for example the megaphone without a mic): it shows Locked and ignores pokes. */
  setLocked(locked: boolean): void {
    this.locked = locked;
    this.setTouch(locked ? 'locked' : 'idle');
  }

  lock(seconds: number): void {
    this.cooldown = Math.max(this.cooldown, seconds);
  }

  reset(): void {
    this.armed = false;
    this.flipped = false;
    this.lastZ.clear();
    this.setTouch(this.locked ? 'locked' : 'idle');
  }

  /** Every frame while it shows. */
  update(hands: HandState[], dt: number): void {
    const S = SWITCH;
    this.cooldown = Math.max(0, this.cooldown - dt);
    // The knob glides to its side.
    const goal = this.on ? 1 : 0;
    if (this.knobAt !== goal) {
      const step = dt / S.slideTime;
      this.knobAt = goal > this.knobAt ? Math.min(goal, this.knobAt + step) : Math.max(goal, this.knobAt - step);
      this.placeKnob();
    }
    if (this.locked) return;
    let ready = false;
    let touching = false;
    let quick = false;
    let front = false;
    this.group.updateWorldMatrix(true, false);
    for (const hand of hands) {
      if (!hand.tracked) {
        this.lastZ.delete(hand);
        continue;
      }
      this.group.worldToLocal(local.copy(hand.indexTip));
      // A generous zone over the whole switch, and not from far behind it.
      if (Math.abs(local.x) > S.width / 2 + S.zoneOut || Math.abs(local.y) > S.height / 2 + S.zoneOut || local.z < -S.zoneBehind) {
        this.lastZ.delete(hand);
        continue;
      }
      const before = this.lastZ.get(hand);
      this.lastZ.set(hand, local.z);
      if (local.z > S.readyDistance) continue;
      ready = true;
      if (local.z > S.touchAt + 0.3) front = true;
      if (local.z <= S.touchAt) {
        touching = true;
        if (before !== undefined && before > S.touchAt + 0.3) quick = true;
      }
    }
    if (front) this.armed = true;
    if (!ready) this.armed = false;
    // Pulled back off the face: the next poke may flip it again.
    if (!touching) this.flipped = false;
    if (touching && (this.armed || quick) && !this.flipped && this.cooldown <= 0) {
      this.flipped = true;
      this.armed = false;
      this.on = !this.on;
      this.show(false);
      this.audio.play('buttonClick');
      this.onChange(this.on);
    }
    this.setTouch(touching && this.flipped ? 'held' : ready ? 'ready' : 'idle');
  }

  /** The color, the word, and the knob (at once when `snap`, else it glides). */
  private show(snap: boolean): void {
    const S = SWITCH;
    this.trackMaterial.color.setHex(this.on ? S.onColor : S.offColor);
    const c = this.labelCanvas.getContext('2d')!;
    c.clearRect(0, 0, this.labelCanvas.width, this.labelCanvas.height);
    drawOutlined(c, this.on ? 'On' : 'Off', 128, 68, 78, '#ffffff', 0.12);
    this.labelTexture.needsUpdate = true;
    // The word sits on the side away from the knob.
    this.label.position.x = (this.on ? -1 : 1) * (S.width / 2 - S.height * 0.95);
    if (snap) this.knobAt = this.on ? 1 : 0;
    this.placeKnob();
  }

  private placeKnob(): void {
    const S = SWITCH;
    const travel = S.width / 2 - S.height / 2;
    // Eased, so it settles softly at each end.
    const t = this.knobAt * this.knobAt * (3 - 2 * this.knobAt);
    this.knob.position.x = -travel + t * travel * 2;
  }

  private setTouch(state: TouchState): void {
    this.touch = changeTouch(this.audio, [this.knobMaterial], this.touch, state);
  }
}
