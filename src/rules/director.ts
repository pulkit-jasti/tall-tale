// A director runs a list of steps, one at a time (docs/mvp.md "Tutorial
// director"). Each step has a start, a goal ("done when"), and up to two
// fallbacks when the player is stuck: first repeat, then make it easier.
// Every step has a timeout that moves on anyway, so it never gets stuck.
// Steps only call the normal game systems through the context. No Three.js here.

/** Most fallbacks a step can use, whatever it lists. */
export const MAX_FALLBACKS = 2;

export interface DirectorStep<C> {
  id: string;
  /** What happens when the step begins. */
  start?(ctx: C): void;
  /** The goal. `time` is how long the step has run (seconds). */
  done(ctx: C, time: number): boolean;
  /** If stuck: run in order, one every `stuckAfter` seconds. Only the first two are used. */
  fallbacks?: ((ctx: C) => void)[];
  stuckAfter?: number;
  /** Moves on anyway after this long (seconds). */
  timeout: number;
  /** Runs when the timeout moves on without the goal. */
  onTimeout?(ctx: C): void;
  /** While this step waits for the player, enemies come at half the spawn rate. */
  slowSpawns?: boolean;
}

export type StepEnd = 'done' | 'timeout';

export class Director<C> {
  private index = -1;
  private time = 0;
  private used = 0;

  /** Called when a step ends, for logs. */
  onStepEnd: (id: string, how: StepEnd, time: number, fallbacks: number) => void = () => {};

  constructor(
    private steps: DirectorStep<C>[],
    private ctx: C,
  ) {}

  get finished(): boolean {
    return this.index >= this.steps.length;
  }

  get current(): DirectorStep<C> | null {
    return this.index >= 0 && this.index < this.steps.length ? this.steps[this.index] : null;
  }

  get stepTime(): number {
    return this.time;
  }

  get fallbacksUsed(): number {
    return this.used;
  }

  /** Spawn rate share for the current step (0.5 while it waits for the player). */
  get spawnRate(): number {
    return this.current?.slowSpawns ? 0.5 : 1;
  }

  update(dt: number): void {
    if (this.index < 0) this.begin(0);
    // Several steps can end in one frame (a goal already met), but each one starts first.
    for (let guard = 0; guard < this.steps.length && !this.finished; guard++) {
      const step = this.steps[this.index];
      if (step.done(this.ctx, this.time)) {
        this.end('done');
        continue;
      }
      this.time += dt;
      const fallbacks = step.fallbacks ?? [];
      const allowed = Math.min(MAX_FALLBACKS, fallbacks.length);
      const stuckAfter = step.stuckAfter ?? Infinity;
      if (this.used < allowed && this.time >= stuckAfter * (this.used + 1)) {
        fallbacks[this.used](this.ctx);
        this.used++;
      }
      if (this.time >= step.timeout) {
        step.onTimeout?.(this.ctx);
        this.end('timeout');
        continue;
      }
      break;
    }
  }

  /** Moves on to the next step right away (debug: skip). */
  skip(): void {
    if (this.index < 0) this.begin(0);
    else if (!this.finished) this.end('timeout');
  }

  private end(how: StepEnd): void {
    const step = this.steps[this.index];
    this.onStepEnd(step.id, how, this.time, this.used);
    this.begin(this.index + 1);
  }

  private begin(index: number): void {
    this.index = index;
    this.time = 0;
    this.used = 0;
    if (!this.finished) this.steps[index].start?.(this.ctx);
  }
}
