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
  /**
   * Every frame while the step runs (after its goal is checked): keeps what
   * the lesson needs on the board, for example a new lesson goblin right
   * after the player ate the one they were meant to throw, so a player who
   * does something else is never left waiting.
   */
  tick?(ctx: C, dt: number): void;
  /** Runs whenever the step ends: done, timed out or skipped. */
  end?(ctx: C): void;
  /** While this step waits for the player, enemies come at half the spawn rate. */
  slowSpawns?: boolean;
  /** While this step waits for the player, no new enemies come out at all (the wave holds its spawns). */
  holdSpawns?: boolean;
  /** Holds the spawns too while this is true (checked every frame), for example once a few goblins are out. */
  holdSpawnsWhen?(ctx: C): boolean;
}

export type StepEnd = 'done' | 'timeout';

export class Director<C> {
  private index = -1;
  private time = 0;
  private used = 0;
  /** Between two steps: the last one ended, the next starts once `wait` runs out (see waitBeforeNext). */
  private between = false;
  private wait = 0;

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
    if (this.between) return null;
    return this.index >= 0 && this.index < this.steps.length ? this.steps[this.index] : null;
  }

  /**
   * Called from onStepEnd: the next step starts only after this many
   * seconds, so the player gets a breather (time to finish what they were
   * doing and see the tick) before the next instruction.
   */
  waitBeforeNext(seconds: number): void {
    this.wait = Math.max(this.wait, seconds);
  }

  get stepTime(): number {
    return this.time;
  }

  get fallbacksUsed(): number {
    return this.used;
  }

  /** Spawn rate share for the current step (0.5 while it waits for the player, 0 while it holds the wave). */
  get spawnRate(): number {
    if (this.current?.holdSpawns || this.current?.holdSpawnsWhen?.(this.ctx)) return 0;
    return this.current?.slowSpawns ? 0.5 : 1;
  }

  update(dt: number): void {
    if (this.index < 0) this.begin(0);
    if (this.between) {
      this.wait -= dt;
      if (this.wait > 0) return;
      this.begin(this.index + 1);
    }
    // Several steps can end in one frame (a goal already met), but each one starts first.
    for (let guard = 0; guard < this.steps.length && !this.finished && !this.between; guard++) {
      const step = this.steps[this.index];
      if (step.done(this.ctx, this.time)) {
        this.end('done');
        continue;
      }
      this.time += dt;
      step.tick?.(this.ctx, dt);
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
    else if (this.between) this.begin(this.index + 1);
    else if (!this.finished) this.end('timeout');
  }

  private end(how: StepEnd): void {
    const step = this.steps[this.index];
    step.end?.(this.ctx);
    this.wait = 0;
    this.onStepEnd(step.id, how, this.time, this.used);
    // A breather asked for in onStepEnd: the next step waits.
    if (this.wait > 0) {
      this.between = true;
      return;
    }
    this.begin(this.index + 1);
  }

  private begin(index: number): void {
    this.between = false;
    this.wait = 0;
    this.index = index;
    this.time = 0;
    this.used = 0;
    if (!this.finished) this.steps[index].start?.(this.ctx);
  }
}
