// The One Euro filter (Casiez, Roussel and Vogel, CHI 2012): a low-pass
// filter whose cutoff rises with speed. Slow or still, it smooths hard (no
// jitter, which people notice most when holding still); moving fast, it
// follows closely (little lag, which people notice most while moving). Used
// for things pinned to a tracked hand, like the pause button on the palm.
// No Three.js here.

const TWO_PI = Math.PI * 2;

/** Smoothing share for a cutoff frequency (Hz) over a time step (seconds). */
function alpha(cutoff: number, dt: number): number {
  const tau = 1 / (TWO_PI * cutoff);
  return 1 / (1 + tau / dt);
}

export interface OneEuroOptions {
  /** Cutoff when still (Hz): lower is smoother, but lags more. */
  minCutoff: number;
  /** How fast the cutoff rises with speed: higher follows quick moves better. */
  beta: number;
  /** Cutoff for the speed estimate itself (Hz). */
  derivativeCutoff: number;
}

/** One Euro filter for a few numbers at once (for example x, y, z). */
export class OneEuro {
  private value: number[] = [];
  private speed: number[] = [];
  private started = false;

  constructor(
    private size: number,
    private options: OneEuroOptions,
  ) {}

  /** Forgets the past (call when tracking was lost or the thing appears again). */
  reset(): void {
    this.started = false;
  }

  /** Filters `input` in place over a step of `dt` seconds, and returns it. */
  filter(input: number[], dt: number): number[] {
    if (!this.started || dt <= 0) {
      this.value = input.slice(0, this.size);
      this.speed = new Array(this.size).fill(0);
      this.started = true;
      return input;
    }
    const { minCutoff, beta, derivativeCutoff } = this.options;
    const ad = alpha(derivativeCutoff, dt);
    // One cutoff for all parts, from the overall speed, so the parts never drift apart.
    let speed2 = 0;
    for (let i = 0; i < this.size; i++) {
      const raw = (input[i] - this.value[i]) / dt;
      this.speed[i] += ad * (raw - this.speed[i]);
      speed2 += this.speed[i] * this.speed[i];
    }
    const a = alpha(minCutoff + beta * Math.sqrt(speed2), dt);
    for (let i = 0; i < this.size; i++) {
      this.value[i] += a * (input[i] - this.value[i]);
      input[i] = this.value[i];
    }
    return input;
  }
}
