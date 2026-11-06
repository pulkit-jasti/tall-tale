// Automatic stress test (laptop debug page button). First measures the empty
// board (the baseline, never stops the test), then adds grunts step by step,
// measures each step with the FPS panel's measured run, and stops at the
// first step that fails the pass rule (or at the unit limit). The unit budget
// is the last step that passed. Then the board is cleared. The FPS panel is
// hidden while it runs, so its own redraws do not count.
//
// Like a director, it only calls other systems (through `StressTestHooks`).
// No Three.js here.
import { FPS, STRESS_TEST } from '../config/game.js';
import type { RunStats, StressStep, StressTestReport } from './debugKeys.js';

export interface StressTestHooks {
  /** Removes every goblin and stops auto spawning. */
  clear(): void;
  /**
   * After clear, before the baseline: the units that stay on the board for the
   * whole test (soldiers of every kind, balloons with riders, since build
   * step 7). Returns how many units that is.
   */
  setup(): number;
  /** Queues `count` grunts and returns how long they take to all come out (seconds). */
  spawn(count: number): number;
  /** Starts a new measured run after the warm-up plus `extraWarmup` seconds. */
  resetRun(extraWarmup: number): void;
  /** The current measured run, or null while warming up. */
  stats(): RunStats | null;
  units(): number;
  /** Hides the FPS panel while the test runs, and puts it back after. */
  hidePanel(hide: boolean): void;
  report(report: StressTestReport): void;
}

export class StressTest {
  private running = false;
  private steps: StressStep[] = [];
  private target = 0;
  /** Units standing for the whole test (soldiers, balloon riders), counted in every step. */
  private base = 0;
  private baselineDone = false;
  private reportTimer = 0;
  private note = '';
  private page = '';
  private device = '';
  /** The page's real target rate, from the measured run. */
  private fps = FPS.target;

  constructor(private hooks: StressTestHooks) {}

  get active(): boolean {
    return this.running;
  }

  start(): void {
    this.hooks.clear();
    this.hooks.hidePanel(true);
    this.running = true;
    this.steps = [];
    this.base = this.hooks.setup();
    this.target = this.base;
    this.baselineDone = false;
    // Baseline: the board with only the standing soldiers and balloons.
    this.hooks.resetRun(0);
    this.note = this.base > 0 ? `Measuring the baseline (${this.base} soldiers and riders)` : 'Measuring the empty board (baseline)';
    this.send('running');
  }

  stop(): void {
    if (this.running) this.finish('Stopped by hand.');
  }

  update(dt: number): void {
    if (!this.running) return;
    const s = this.hooks.stats();
    if (s) {
      this.page = s.page;
      this.device = s.device;
      this.fps = s.targetFps;
    }
    if (s && s.seconds >= STRESS_TEST.measureSeconds) {
      const rule = this.rule();
      const step: StressStep = {
        baseline: !this.baselineDone,
        units: s.units,
        avgFps: s.avgFps,
        lowFps: s.lowFps,
        rawLowFps: s.rawLowFps,
        missedPct: s.missedPct,
        missed: s.missed,
        slowestMs: s.slowestMs,
        causes: s.causes,
        pass: s.avgFps >= rule.minAvgFps && s.lowFps >= rule.minLowFps && s.missedPct < rule.maxMissedPct,
      };
      this.steps.push(step);
      if (step.baseline) {
        this.baselineDone = true;
        this.nextStep();
      } else if (!step.pass) {
        this.finish(`${step.units} units failed: ${failReason(step, rule)}.`);
      } else if (this.target >= STRESS_TEST.maxUnits || s.units < this.target - 1) {
        // Either the limit, or the unit cap stopped new goblins from coming.
        this.finish(`Still passing at ${step.units} units, the most the test adds.`);
      } else {
        this.nextStep();
      }
      return;
    }
    this.note = s
      ? `Measuring ${!this.baselineDone ? 'the baseline' : `${s.units} units`}: ${s.seconds.toFixed(0)} of ${STRESS_TEST.measureSeconds} s`
      : !this.baselineDone
        ? 'Warming up for the baseline'
        : `Adding grunts (to ${this.target}) and warming up`;
    this.reportTimer += dt;
    if (this.reportTimer >= 1) {
      this.reportTimer = 0;
      this.send('running');
    }
  }

  private nextStep(): void {
    this.target += STRESS_TEST.step;
    const spawnTime = this.hooks.spawn(STRESS_TEST.step);
    this.hooks.resetRun(spawnTime);
    this.note = `Adding grunts (to ${this.target}) and warming up`;
    this.send('running');
  }

  private finish(note: string): void {
    this.running = false;
    this.note = note;
    this.hooks.clear();
    this.hooks.resetRun(0);
    this.hooks.hidePanel(false);
    this.send('done');
    console.info(`[stress test] ${note} Budget: ${this.budget() ?? 'none'} units.`);
  }

  private budget(): number | null {
    let best: number | null = null;
    for (const step of this.steps) {
      if (step.baseline) continue;
      if (!step.pass) break;
      best = step.units;
    }
    return best;
  }

  /** The pass rule for the page's real target rate. */
  private rule(): StressTestReport['rule'] {
    return {
      minAvgFps: Math.round(this.fps * STRESS_TEST.minAvgShare),
      minLowFps: Math.round(this.fps * STRESS_TEST.minLowShare),
      maxMissedPct: STRESS_TEST.maxMissedPct,
      measureSeconds: STRESS_TEST.measureSeconds,
      targetFps: this.fps,
    };
  }

  private send(state: StressTestReport['state']): void {
    this.hooks.report({
      page: this.page,
      device: this.device,
      state,
      note: this.note,
      steps: this.steps,
      budget: this.budget(),
      rule: this.rule(),
    });
  }
}

function failReason(step: StressStep, rule: StressTestReport['rule']): string {
  const reasons: string[] = [];
  if (step.avgFps < rule.minAvgFps) reasons.push(`avg ${step.avgFps.toFixed(1)} fps`);
  if (step.lowFps < rule.minLowFps) reasons.push(`1% low ${step.lowFps.toFixed(0)} fps`);
  if (step.missedPct >= rule.maxMissedPct) reasons.push(`missed ${step.missedPct.toFixed(1)}%`);
  return reasons.join(', ');
}
