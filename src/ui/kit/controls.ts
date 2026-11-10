// What every touchable control (buttons, sliders, stand buttons) shares:
// starting fresh when its page opens, and its Idle, Ready, Held and Locked
// look with the ready tick.
import type { MeshStandardMaterial } from 'three';
import type { GameAudio } from '../../audio/sound.js';
import { POKE } from '../../config/game.js';
import { applyTouchState, type TouchState } from '../../player/feedback.js';

export interface Control {
  reset(): void;
  lock(seconds: number): void;
}

/**
 * A page or panel just opened: every control on it starts fresh and ignores
 * pokes for a moment, so the finger that opened it never presses one at once.
 */
export function armControls(controls: Iterable<Control>, seconds: number = POKE.lockAfterChange): void {
  for (const control of controls) {
    control.reset();
    control.lock(seconds);
  }
}

/**
 * Only one thing is dragged at a time (sliders, switches): a finger moving
 * one slider never moves the next row's too, and a second hand cannot grab
 * another while one is held. A control takes the drag when it is grabbed,
 * takes it again every frame while held, and gives it back when let go. A
 * drag not taken for a moment (its page closed mid-drag) is free again.
 */
let dragging: object | null = null;
let draggedAt = 0;
const DRAG_STALE_MS = 250;

/** True if `owner` may start a drag now (nothing else is dragged). */
export function canDrag(owner: object): boolean {
  return dragging === null || dragging === owner || performance.now() - draggedAt > DRAG_STALE_MS;
}

export function takeDrag(owner: object): void {
  dragging = owner;
  draggedAt = performance.now();
}

export function endDrag(owner: object): void {
  if (dragging === owner) dragging = null;
}

/** A control's new touch look (emissive only), with a tick when a finger first comes near. Returns the new state. */
export function changeTouch(audio: GameAudio, materials: MeshStandardMaterial[], from: TouchState, to: TouchState): TouchState {
  if (to === from) return from;
  if (to === 'ready' && from === 'idle') audio.play('readyTick', undefined, 1, 0.1);
  applyTouchState(materials, to);
  return to;
}
