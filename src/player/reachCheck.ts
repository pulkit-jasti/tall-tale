// The reach check (docs/controls-and-ui.md "Reach check"): the player
// stretches one arm straight out and holds it for a short countdown. The
// farthest the hand gets, as a level distance from the head, says how big the
// board should be: the rampart sits a little inside that reach, and
// everything else keeps its place relative to the wall.
//
// It measures from the head, not from the seat, so leaning forward does not
// count as a longer arm. Each hand's distance is smoothed, so a tracking
// spike never counts as reach.
import type { Vector3 } from 'three';
import { CALIBRATION, CASTLE } from '../config/game.js';
import type { HandState } from './hands.js';

export type ReachPhase = 'off' | 'waiting' | 'counting' | 'done';

export class ReachCheck {
  phase: ReachPhase = 'off';
  /** Farthest smoothed reach in this countdown (meters, level from the head). */
  private best = 0;
  private timeLeft: number = CALIBRATION.holdSeconds;
  private droppedFor = 0;
  /** Smoothed level distance per hand (meters). */
  private smooth = [0, 0];
  /** Called on each new second of the countdown, with the seconds left (3, 2, 1). */
  onTick: (secondsLeft: number) => void = () => {};

  /** Starts listening for a stretched arm. */
  start(): void {
    this.phase = 'waiting';
    this.best = 0;
    this.timeLeft = CALIBRATION.holdSeconds;
    this.droppedFor = 0;
    this.smooth = [0, 0];
  }

  stop(): void {
    this.phase = 'off';
  }

  /** Whole seconds left in the countdown, for the sign. */
  get secondsLeft(): number {
    return Math.max(1, Math.ceil(this.timeLeft));
  }

  /** The measured reach (meters), once done. */
  get reach(): number {
    return this.best;
  }

  /** The board size that puts the rampart at CALIBRATION.rampartShare of the measured reach. */
  get scale(): number {
    // Rampart (meters at size 1) times the scale = the measured reach times the share.
    const scale = (this.best * CALIBRATION.rampartShare) / (CASTLE.rampartRadius / 100);
    return Math.min(CALIBRATION.maxScale, Math.max(CALIBRATION.minScale, scale));
  }

  update(dt: number, hands: HandState[], head: Vector3): void {
    if (this.phase !== 'waiting' && this.phase !== 'counting') return;
    const k = 1 - Math.exp(-dt / CALIBRATION.smoothing);
    let reach = 0;
    hands.forEach((hand, i) => {
      if (!hand.tracked) return;
      const d = Math.hypot(hand.pinchPoint.x - head.x, hand.pinchPoint.z - head.z);
      this.smooth[i] += (d - this.smooth[i]) * k;
      reach = Math.max(reach, this.smooth[i]);
    });
    const out = reach >= CALIBRATION.startReach;
    if (this.phase === 'waiting') {
      if (!out) return;
      this.phase = 'counting';
      this.timeLeft = CALIBRATION.holdSeconds;
      this.best = reach;
      this.droppedFor = 0;
      this.onTick(this.secondsLeft);
      return;
    }
    // Counting: the arm must stay out. A short drop (tracking blink) is forgiven.
    this.droppedFor = out ? 0 : this.droppedFor + dt;
    if (this.droppedFor > CALIBRATION.dropGrace) {
      this.phase = 'waiting';
      return;
    }
    if (out) this.best = Math.max(this.best, reach);
    const before = this.secondsLeft;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.phase = 'done';
      return;
    }
    if (this.secondsLeft !== before) this.onTick(this.secondsLeft);
  }
}
