// The one slider used everywhere (first in the pause panel's sound settings),
// for hands, following Meta's hands guidelines (SLIDER in src/config/game.ts):
//
//   - A wide track with a big round handle (well over the 22 mm minimum
//     target), the filled part of the track showing the value at a glance.
//     The handle is a warm gold, so it stands out against the green fill and
//     the dark track, and turns grey at 0 (off), so the state shows in color.
//   - Touch it with the index finger, on the handle or anywhere on the track
//     (the handle jumps there, so it works without dragging too), then slide
//     the finger along: the handle follows 1:1. It lets go once the finger
//     pulls back off the face, so there is nothing to pinch or hold. Near
//     the ends it snaps to 0 and to 1, so off and full are easy to hit.
//   - The same Idle, Ready and Held looks as every other touchable thing
//     (emissive only), a tick at every step while it moves and a click when
//     it is let go, since there are no haptics.
//
// Its face points along the group's local +z, like the poke button. Sizes in
// the parent's units (cm in the rigs). `onChange(value, final)`: final is
// true when a move ends (the finger lets go), the time to save.
import { BoxGeometry, CylinderGeometry, Group, Mesh, Vector3, type MeshStandardMaterial } from 'three';
import type { GameAudio } from '../audio/sound.js';
import { POKE, SLIDER } from '../config/game.js';
import type { TouchState } from '../player/feedback.js';
import type { HandState } from '../player/hands.js';
import { flatMaterial } from '../world/shapes.js';
import { changeTouch, type Control } from './kit/controls.js';
import { clamp01 } from './kit/layout.js';

export interface SliderOptions {
  /** Track length (the handle's middle moves this far). Defaults to SLIDER.length. */
  length?: number;
  /** Steps from one end to the other (a tick at each while it moves). */
  steps: number;
  value: number;
}

const local = new Vector3();

export class Slider implements Control {
  /** Place and turn this group. Its +z is the slider's face. */
  readonly group = new Group();
  onChange: (value: number, final: boolean) => void = () => {};
  private length: number;
  private steps: number;
  private value: number;
  private fill: Mesh;
  private handle: Mesh;
  private handleMaterial: MeshStandardMaterial;
  private touch: TouchState = 'idle';
  /** The finger came from the front (it was over the face), so touching the face grabs it. */
  private armed = false;
  private held: HandState | null = null;
  /** No grab until this runs out (seconds), after a panel opens. */
  private cooldown = 0;

  constructor(
    private audio: GameAudio,
    options: SliderOptions,
  ) {
    const S = SLIDER;
    this.length = options.length ?? S.length;
    this.steps = options.steps;
    this.value = clamp01(options.value);
    // The track: a dark groove, with the filled part on top of it up to the handle.
    const track = new Mesh(new BoxGeometry(this.length + S.trackHeight, S.trackHeight, S.trackDepth), flatMaterial(POKE.rimColor));
    track.position.z = S.trackDepth / 2;
    this.fill = new Mesh(new BoxGeometry(1, S.trackHeight * 0.62, S.trackDepth * 0.4), flatMaterial(S.fillColor));
    this.fill.position.z = S.trackDepth + 0.05;
    this.handleMaterial = flatMaterial(S.handleColor);
    this.handleMaterial.flatShading = false;
    this.handle = new Mesh(new CylinderGeometry(S.handleRadius, S.handleRadius, S.handleDepth, POKE.segments), this.handleMaterial);
    this.handle.rotation.x = Math.PI / 2;
    this.handle.position.z = S.trackDepth + S.handleDepth / 2;
    this.group.add(track, this.fill, this.handle);
    this.show();
  }

  /** Width from end to end, the handle at either end included (for laying it out). */
  get width(): number {
    return this.length + 2 * SLIDER.handleRadius;
  }

  get current(): number {
    return this.value;
  }

  /** Sets the value without telling onChange (for example when a panel opens). */
  setValue(value: number): void {
    this.value = clamp01(value);
    this.show();
  }

  /** No grab for this long (a panel just opened, the finger may still be there). */
  lock(seconds: number): void {
    this.cooldown = Math.max(this.cooldown, seconds);
  }

  reset(): void {
    this.held = null;
    this.armed = false;
    this.setTouch('idle');
  }

  /** Every frame while it shows. */
  update(hands: HandState[], dt: number): void {
    const S = SLIDER;
    this.cooldown = Math.max(0, this.cooldown - dt);
    // Dragging: the handle follows the finger along the track until it pulls back off the face.
    if (this.held) {
      const hand = this.held;
      this.group.updateWorldMatrix(true, false);
      this.group.worldToLocal(local.copy(hand.indexTip));
      const off = !hand.tracked || local.z > S.releaseOut || Math.abs(local.y) > S.zoneHeight * 1.6;
      if (off) {
        this.held = null;
        this.setTouch('idle');
        this.audio.play('buttonClick');
        this.onChange(this.value, true);
        return;
      }
      this.moveTo(local.x, false);
      return;
    }
    // Ready while a finger is over the track, in front of it; grabbed when it touches the face.
    let ready = false;
    for (const hand of hands) {
      if (!hand.tracked) continue;
      this.group.updateWorldMatrix(true, false);
      this.group.worldToLocal(local.copy(hand.indexTip));
      const along = Math.abs(local.x) <= this.length / 2 + S.handleRadius;
      if (!along || Math.abs(local.y) > S.zoneHeight || local.z < -S.zoneBehind) continue;
      if (local.z > S.readyDistance) continue;
      ready = true;
      if (local.z <= S.touchAt && this.armed && this.cooldown <= 0) {
        this.held = hand;
        this.setTouch('held');
        this.moveTo(local.x, false);
        return;
      }
    }
    // A finger that arrived from behind or below the face cannot grab: it has to come from the front.
    this.armed = ready ? this.armed || this.frontOf(hands) : false;
    this.setTouch(ready ? 'ready' : 'idle');
  }

  /** True if some finger is in front of the face (past where a touch starts). */
  private frontOf(hands: HandState[]): boolean {
    for (const hand of hands) {
      if (!hand.tracked) continue;
      this.group.worldToLocal(local.copy(hand.indexTip));
      if (local.z > SLIDER.touchAt + 0.3) return true;
    }
    return false;
  }

  /** The handle to the spot along the track (a tick at every step it passes). Within half a step of an end it snaps to it. */
  private moveTo(x: number, final: boolean): void {
    const snap = 0.5 / this.steps;
    let next = clamp01(x / this.length + 0.5);
    if (next < snap) next = 0;
    else if (next > 1 - snap) next = 1;
    if (next === this.value) return;
    const before = Math.round(this.value * this.steps);
    this.value = next;
    if (Math.round(next * this.steps) !== before) this.audio.play('readyTick', undefined, 0.8, 0.03);
    this.show();
    this.onChange(this.value, final);
  }

  private show(): void {
    const x = (this.value - 0.5) * this.length;
    this.handle.position.x = x;
    // Gold while on, grey at 0 (off): the state shows in color, not just in where the handle is.
    this.handleMaterial.color.setHex(this.value <= 0 ? SLIDER.offColor : SLIDER.handleColor);
    const filled = Math.max(0.001, this.value * this.length + SLIDER.trackHeight / 2);
    this.fill.scale.x = filled;
    this.fill.position.x = -this.length / 2 - SLIDER.trackHeight / 4 + filled / 2;
  }

  private setTouch(state: TouchState): void {
    this.touch = changeTouch(this.audio, [this.handleMaterial], this.touch, state);
  }
}
