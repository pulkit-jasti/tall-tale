// The one slider used everywhere (first in the pause panel's sound settings),
// for hands, following Meta's hands guidelines (SLIDER in src/config/game.ts):
//
//   - A wide track with a big round handle (well over the 22 mm minimum
//     target), the filled part of the track showing the value at a glance.
//     The handle is the buttons' green over a warm parchment fill (no dark
//     ring around it, that looked odd), and turns grey at 0 (off), so the
//     state shows in color.
//   - Touch the handle itself with the tip of the index finger, then slide
//     the finger along: the handle follows 1:1 (it does not jump to the
//     finger). Touching the track does nothing (that moved two rows at once).
//     It lets go once the finger pulls back off the face, so there is
//     nothing to pinch or hold. Only one slider (or switch) moves at a time.
//     Near the ends it snaps to 0 and to 1, so off and full are easy to hit.
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
import { canDrag, changeTouch, endDrag, takeDrag, type Control } from './kit/controls.js';
import { clamp01 } from './kit/layout.js';

export interface SliderOptions {
  /** Track length (the handle's middle moves this far). Defaults to SLIDER.length. */
  length?: number;
  /** Steps from one end to the other (a tick at each while it moves). */
  steps: number;
  value: number;
  /** Upright (v2 run 2, the campaign list's scroll): the track runs up and down, 1 at the top. */
  vertical?: boolean;
  /**
   * The scrollbar look (docs/custom-mode.md "UI kit parts"): a long block
   * wrapped around the rail instead of the round handle and no filled track,
   * so a scroll never looks like a value slider. Every page that scrolls
   * uses it.
   */
  scrollbar?: boolean;
}

const local = new Vector3();

export class Slider implements Control {
  /** Place and turn this group. Its +z is the slider's face. */
  readonly group = new Group();
  /** The slider's own frame (its track along x): the group itself, or turned a quarter for an upright one. */
  private frame = new Group();
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
  /** Handle spot minus the fingertip's, along the track, when grabbed: the handle keeps that offset (no jump). */
  private grabOffset = 0;
  /** Each hand's fingertip depth last frame (while over the track), to catch quick touches. */
  private lastZ = new Map<HandState, number>();
  /** No grab until this runs out (seconds), after a panel opens. */
  private cooldown = 0;
  /** The handle's half length and half height along and across the track (the pill's; a round handle's radius both ways). */
  private halfLong: number;
  private halfShort: number;
  private scrollbar: boolean;

  constructor(
    private audio: GameAudio,
    options: SliderOptions,
  ) {
    const S = SLIDER;
    this.length = options.length ?? S.length;
    this.steps = options.steps;
    this.value = clamp01(options.value);
    this.scrollbar = !!options.scrollbar;
    // The track: a dark groove, with the filled part on top of it up to the handle. A scrollbar's rail is thinner (its own look).
    const rail = this.scrollbar ? S.scrollbar.rail : S.trackHeight;
    const railDepth = this.scrollbar ? S.scrollbar.rail : S.trackDepth;
    const track = new Mesh(new BoxGeometry(this.length + rail, rail, railDepth), flatMaterial(POKE.rimColor));
    track.position.z = railDepth / 2;
    this.fill = new Mesh(new BoxGeometry(1, S.trackHeight * 0.62, S.trackDepth * 0.4), flatMaterial(S.fillColor));
    this.fill.position.z = S.trackDepth + 0.05;
    this.handleMaterial = flatMaterial(this.scrollbar ? S.scrollbar.handleColor : S.handleColor);
    this.handleMaterial.flatShading = false;
    if (this.scrollbar) {
      // A block wrapped around the rail (headset test 2026-11-11: a pill lying on top of it looked loose), long along it.
      const B = S.scrollbar;
      this.halfLong = B.pillLength / 2;
      this.halfShort = rail / 2 + B.wall;
      this.handle = new Mesh(new BoxGeometry(B.pillLength, rail + 2 * B.wall, railDepth + 2 * B.wall), this.handleMaterial);
      this.fill.visible = false;
    } else {
      this.halfLong = this.halfShort = S.handleRadius;
      this.handle = new Mesh(new CylinderGeometry(S.handleRadius, S.handleRadius, S.handleDepth, POKE.segments), this.handleMaterial);
      this.handle.rotation.x = Math.PI / 2;
    }
    // The block sits around the rail (same middle); the round handle on top of it.
    this.handle.position.z = this.scrollbar ? railDepth / 2 : S.trackDepth + S.handleDepth / 2;
    this.frame.add(track, this.fill, this.handle);
    // Upright: the whole frame turned a quarter, so its +x (toward 1) points up. The touch code reads the frame, so it is the same.
    if (options.vertical) this.frame.rotation.z = Math.PI / 2;
    this.group.add(this.frame);
    this.show();
  }

  /** Width from end to end, the handle at either end included (for laying it out). */
  get width(): number {
    return this.length + 2 * this.halfLong;
  }

  /** True if a fingertip (in the slider's frame) is over the handle at `handleX`, with the touch margin. */
  private overHandle(local: Vector3, handleX: number): boolean {
    const m = SLIDER.handleMargin;
    const dx = local.x - handleX;
    if (this.scrollbar) return Math.abs(dx) <= this.halfLong + m && Math.abs(local.y) <= this.halfShort + m;
    const reach = this.halfLong + m;
    return dx * dx + local.y * local.y <= reach * reach;
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
    endDrag(this);
    this.armed = false;
    this.lastZ.clear();
    this.setTouch('idle');
  }

  /** Every frame while it shows. */
  update(hands: HandState[], dt: number): void {
    const S = SLIDER;
    this.cooldown = Math.max(0, this.cooldown - dt);
    // Dragging: the handle follows the finger along the track until it pulls back off the face.
    if (this.held) {
      const hand = this.held;
      this.frame.updateWorldMatrix(true, false);
      this.frame.worldToLocal(local.copy(hand.indexTip));
      const off = !hand.tracked || local.z > S.releaseOut || Math.abs(local.y) > S.zoneHeight * 1.6;
      if (off) {
        this.held = null;
        endDrag(this);
        this.setTouch('idle');
        this.audio.play('buttonClick');
        this.onChange(this.value, true);
        return;
      }
      takeDrag(this);
      this.moveTo(local.x + this.grabOffset, false);
      return;
    }
    // Ready while a fingertip is over the handle, in front of it; grabbed when it touches it.
    let ready = false;
    const handleX = (this.value - 0.5) * this.length;
    for (const hand of hands) {
      if (!hand.tracked) {
        this.lastZ.delete(hand);
        continue;
      }
      this.frame.updateWorldMatrix(true, false);
      this.frame.worldToLocal(local.copy(hand.indexTip));
      if (!this.overHandle(local, handleX) || local.z < -S.zoneBehind) {
        this.lastZ.delete(hand);
        continue;
      }
      // A quick touch: in front of the face last frame and on it now grabs at once, even if no frame caught the way in.
      const before = this.lastZ.get(hand);
      this.lastZ.set(hand, local.z);
      const quick = before !== undefined && before > S.touchAt + 0.3;
      if (local.z > S.readyDistance) continue;
      ready = true;
      if (local.z <= S.touchAt && (this.armed || quick) && this.cooldown <= 0 && canDrag(this)) {
        this.held = hand;
        this.grabOffset = handleX - local.x;
        takeDrag(this);
        this.setTouch('held');
        return;
      }
    }
    // A finger that arrived from behind or below the face cannot grab: it has to come from the front.
    this.armed = ready ? this.armed || this.frontOf(hands) : false;
    this.setTouch(ready ? 'ready' : 'idle');
  }

  /** True if some finger is over the handle, in front of its face (past where a touch starts). */
  private frontOf(hands: HandState[]): boolean {
    const handleX = (this.value - 0.5) * this.length;
    for (const hand of hands) {
      if (!hand.tracked) continue;
      this.frame.worldToLocal(local.copy(hand.indexTip));
      if (this.overHandle(local, handleX) && local.z > SLIDER.touchAt + 0.3) return true;
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
    // A scrollbar keeps its color (0 is just the bottom of the page).
    if (this.scrollbar) return;
    // Green while on, grey at 0 (off): the state shows in color, not just in where the handle is.
    this.handleMaterial.color.setHex(this.value <= 0 ? SLIDER.offColor : SLIDER.handleColor);
    const filled = Math.max(0.001, this.value * this.length + SLIDER.trackHeight / 2);
    this.fill.scale.x = filled;
    this.fill.position.x = -this.length / 2 - SLIDER.trackHeight / 4 + filled / 2;
  }

  private setTouch(state: TouchState): void {
    this.touch = changeTouch(this.audio, [this.handleMaterial], this.touch, state);
  }
}
