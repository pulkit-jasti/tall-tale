// The reach check (docs/controls-and-ui.md "Reach check"): the player
// stretches one arm straight out and holds it for a short countdown. The
// farthest the hand gets, as a level distance from the head, says how big the
// board should be: the rampart sits a little inside that reach, and
// everything else keeps its place relative to the wall.
//
// It measures from the head, not from the seat, so leaning forward does not
// count as a longer arm. Each hand's distance is smoothed, so a tracking
// spike never counts as reach.
//
// The countdown never rushes the player: it waits readSeconds first (time to
// read the instruction), the hand must be out at least startReach, and it
// must have settled (moving slower than stillSpeed for stillFor). A hand that
// moves a lot again while counting is still being adjusted: the countdown
// stops and waits for it to settle again.
import type { Vector3 } from 'three';
import { CALIBRATION, CASTLE } from '../config/game.js';
import type { HandState } from './hands.js';

/** waiting: no arm out yet (or still reading). settling: out, but still moving. counting: out and still. */
export type ReachPhase = 'off' | 'waiting' | 'settling' | 'counting' | 'done';

export class ReachCheck {
  phase: ReachPhase = 'off';
  /** Farthest smoothed reach in this countdown (meters, level from the head). */
  private best = 0;
  private timeLeft: number = CALIBRATION.holdSeconds;
  private droppedFor = 0;
  /** Smoothed level distance per hand (meters). */
  private smooth = [0, 0];
  /** Time since it started (seconds), for the reading pause. */
  private elapsed = 0;
  /** Each hand's position last frame and its smoothed speed (meters per second), to tell a settled hand from one still moving. */
  private last = [
    [0, 0, 0],
    [0, 0, 0],
  ];
  private seen = [false, false];
  private speed = [0, 0];
  /** How long the stretched hand has been still (seconds), and moving again while counting. */
  private stillFor = 0;
  private movingFor = 0;
  /** Called on each new second of the countdown, with the seconds left (3, 2, 1). */
  onTick: (secondsLeft: number) => void = () => {};

  /** Starts listening for a stretched arm. */
  start(): void {
    this.phase = 'waiting';
    this.best = 0;
    this.timeLeft = CALIBRATION.holdSeconds;
    this.droppedFor = 0;
    this.smooth = [0, 0];
    this.elapsed = 0;
    this.seen = [false, false];
    this.speed = [0, 0];
    this.stillFor = 0;
    this.movingFor = 0;
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
    if (this.phase === 'off' || this.phase === 'done') return;
    const C = CALIBRATION;
    this.elapsed += dt;
    const k = 1 - Math.exp(-dt / C.smoothing);
    const ks = 1 - Math.exp(-dt / C.speedSmoothing);
    let reach = 0;
    let speed = 0;
    hands.forEach((hand, i) => {
      if (!hand.tracked) {
        this.seen[i] = false;
        return;
      }
      const p = hand.pinchPoint;
      const d = Math.hypot(p.x - head.x, p.z - head.z);
      this.smooth[i] += (d - this.smooth[i]) * k;
      // How fast this hand moves (smoothed, so tracking jitter does not count as moving).
      const l = this.last[i];
      if (this.seen[i] && dt > 0) this.speed[i] += (Math.hypot(p.x - l[0], p.y - l[1], p.z - l[2]) / dt - this.speed[i]) * ks;
      else this.speed[i] = 0;
      l[0] = p.x;
      l[1] = p.y;
      l[2] = p.z;
      this.seen[i] = true;
      // The hand that reaches farthest is the one being measured.
      if (this.smooth[i] > reach) {
        reach = this.smooth[i];
        speed = this.speed[i];
      }
    });
    const out = reach >= C.startReach && this.elapsed >= C.readSeconds;
    if (this.phase === 'waiting' || this.phase === 'settling') {
      this.phase = out ? 'settling' : 'waiting';
      // Out far enough: it waits for the hand to settle before the countdown starts.
      this.stillFor = out && speed < C.stillSpeed ? this.stillFor + dt : 0;
      if (this.stillFor < C.stillFor) return;
      this.phase = 'counting';
      this.timeLeft = C.holdSeconds;
      this.best = reach;
      this.droppedFor = 0;
      this.movingFor = 0;
      this.onTick(this.secondsLeft);
      return;
    }
    // Counting: the arm must stay out and still. A short drop (tracking blink) is forgiven; a hand moving
    // a lot again is still being adjusted, so the countdown waits for it to settle again.
    this.droppedFor = out ? 0 : this.droppedFor + dt;
    this.movingFor = speed > C.moveSpeed ? this.movingFor + dt : 0;
    if (this.droppedFor > C.dropGrace || this.movingFor > C.moveGrace) {
      this.phase = 'waiting';
      this.stillFor = 0;
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
