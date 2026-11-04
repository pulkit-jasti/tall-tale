import { describe, expect, it } from 'vitest';
import { buildTutorialSteps, TUTORIAL_TIMING, TUTORIAL_WAVES, type TutorialApi } from '../director/tutorial.js';
import { Director, type DirectorStep } from './director.js';

interface Ctx {
  goal: boolean;
  log: string[];
}

function step(overrides: Partial<DirectorStep<Ctx>> = {}): DirectorStep<Ctx> {
  return {
    id: 'step',
    done: (ctx) => ctx.goal,
    fallbacks: [(ctx) => ctx.log.push('repeat'), (ctx) => ctx.log.push('easier'), (ctx) => ctx.log.push('third')],
    stuckAfter: 10,
    timeout: 100,
    ...overrides,
  };
}

const run = <C>(director: Director<C>, seconds: number, dt = 0.5): void => {
  for (let t = 0; t < seconds; t += dt) director.update(dt);
};

describe('director', () => {
  it('moves on when the goal is met', () => {
    const ctx: Ctx = { goal: false, log: [] };
    const director = new Director([step({ id: 'a', start: (c) => c.log.push('start a') }), step({ id: 'b', start: (c) => c.log.push('start b'), done: () => false })], ctx);
    run(director, 3);
    expect(director.current?.id).toBe('a');
    ctx.goal = true;
    director.update(0.5);
    expect(ctx.log).toEqual(['start a', 'start b']);
    expect(director.current?.id).toBe('b');
  });

  it('falls back after being stuck, then moves on at the timeout', () => {
    const ctx: Ctx = { goal: false, log: [] };
    const ends: string[] = [];
    const director = new Director([step({ onTimeout: (c) => c.log.push('timeout') })], ctx);
    director.onStepEnd = (_id, how) => ends.push(how);
    run(director, 9);
    expect(ctx.log).toEqual([]);
    run(director, 2);
    expect(ctx.log).toEqual(['repeat']);
    run(director, 120);
    expect(ctx.log).toEqual(['repeat', 'easier', 'timeout']);
    expect(ends).toEqual(['timeout']);
    expect(director.finished).toBe(true);
  });

  it('uses at most 2 fallbacks', () => {
    const ctx: Ctx = { goal: false, log: [] };
    const director = new Director([step({ timeout: 1000 })], ctx);
    run(director, 500);
    expect(ctx.log).toEqual(['repeat', 'easier']);
    expect(director.fallbacksUsed).toBe(2);
  });

  it('halves the spawn rate only while a step waits for the player', () => {
    const ctx: Ctx = { goal: false, log: [] };
    const director = new Director([step({ slowSpawns: true }), step({ id: 'plain' })], ctx);
    director.update(0.1);
    expect(director.spawnRate).toBe(0.5);
    ctx.goal = true;
    director.update(0.1);
    expect(director.spawnRate).toBe(1);
  });
});

/** A fake game: the player does nothing at all. */
function idleApi(): TutorialApi & { cleared: number; started: number[]; shown: string[]; ended: number } {
  return {
    cleared: 0,
    started: [],
    shown: [],
    ended: 0,
    startWave(index) {
      this.started.push(index);
    },
    waveCleared: () => false,
    endWave() {
      this.ended++;
    },
    clearWave() {
      this.cleared++;
    },
    climberInFront: () => {},
    showTool(tool) {
      this.shown.push(tool);
    },
    hintTool: () => {},
    helpWithTool: () => {},
    hasTool: (tool) => tool === 'slingshot',
    toolUses: () => 0,
    eaten: () => 0,
  };
}

describe('tutorial director', () => {
  it('never gets stuck: a player who does nothing still sees all 5 waves', () => {
    const api = idleApi();
    const director = new Director(buildTutorialSteps(), api);
    run(director, 60 * 30, 0.25);
    expect(director.finished).toBe(true);
    expect(api.started).toEqual([0, 1, 2, 3, 4]);
    expect(api.cleared).toBe(TUTORIAL_WAVES.length);
    expect(api.ended).toBe(TUTORIAL_WAVES.length);
    expect(api.shown).toEqual(['slingshot', 'swatter', 'pepper', 'megaphone']);
  });

  it('skips the teaching step of a tool that is not built yet', () => {
    const api = idleApi();
    api.waveCleared = () => true;
    const director = new Director(buildTutorialSteps(), api);
    // Wave 1 waits for eating, wave 2 for the slingshot. Waves 3 to 5 need nothing.
    run(director, TUTORIAL_TIMING.actionTimeout * 2 + TUTORIAL_TIMING.breather * 4 + 5, 0.25);
    expect(director.finished).toBe(true);
  });
});
