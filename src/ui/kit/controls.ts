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

/** A control's new touch look (emissive only), with a tick when a finger first comes near. Returns the new state. */
export function changeTouch(audio: GameAudio, materials: MeshStandardMaterial[], from: TouchState, to: TouchState): TouchState {
  if (to === from) return from;
  if (to === 'ready' && from === 'idle') audio.play('readyTick', undefined, 1, 0.1);
  applyTouchState(materials, to);
  return to;
}
