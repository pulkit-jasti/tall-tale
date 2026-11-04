import { describe, expect, it } from 'vitest';
import { buildTutorialSteps, TUTORIAL_WAVES, type TutorialApi, type TutorialStep } from '../director/tutorial.js';
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
function idleApi(): TutorialApi & { cleared: number; started: number[]; shown: string[]; ended: number; held: Record<string, boolean> } {
  return {
    cleared: 0,
    started: [],
    shown: [],
    ended: 0,
    held: {},
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
    lessonClimber: () => {},
    showTool(tool) {
      this.shown.push(tool);
    },
    hintTool: () => {},
    helpWithTool: () => {},
    holdToolTimer(tool, on) {
      this.held[tool] = on;
    },
    startReachCheck: () => {},
    reachChecked: () => false,
    stopReachCheck: () => {},
    toolUses: () => 0,
    toolGrabbed: () => 0,
    canAfford: () => true,
    boardSpun: () => 0,
    boardMoved: () => 0,
    picked: () => 0,
    eaten: () => 0,
    slingCount: () => 0,
    slingLoaded: () => false,
  };
}

/** A fake game where the player does every lesson right away: each count is higher every time it is read. */
function eagerApi(): ReturnType<typeof idleApi> {
  let n = 0;
  const more = (): number => (n += 100);
  return {
    ...idleApi(),
    waveCleared: () => true,
    toolUses: more,
    toolGrabbed: more,
    boardSpun: more,
    boardMoved: more,
    picked: more,
    eaten: more,
    slingCount: more,
    slingLoaded: () => true,
  };
}

/** Runs the director, poking "Next" whenever an info step shows (as the player would). */
function runPokingNext(director: Director<TutorialApi>, seconds: number, dt = 0.25): void {
  for (let t = 0; t < seconds; t += dt) {
    const step = director.current as TutorialStep | null;
    if (step?.hint?.next) director.skip();
    director.update(dt);
  }
}

describe('tutorial director', () => {
  it('lessons never get stuck: a player who skips every lesson but clears the waves sees all 5', () => {
    const api = idleApi();
    api.waveCleared = () => true;
    const director = new Director<TutorialApi>(buildTutorialSteps(['slingshot']), api);
    runPokingNext(director, 60 * 40);
    expect(director.finished).toBe(true);
    expect(api.started).toEqual([0, 1, 2, 3, 4]);
    expect(api.cleared).toBe(TUTORIAL_WAVES.length);
    // Only built tools are shown.
    expect(api.shown).toEqual(['slingshot']);
  });

  it('teaches every built food tool in its wave: grab in the breather, then use it', () => {
    const api = idleApi();
    api.waveCleared = () => true;
    const steps = buildTutorialSteps(['slingshot', 'swatter', 'pepper']);
    const ids = steps.map((s) => s.id);
    expect(ids.indexOf('learn-swatter-grab')).toBeLessThan(ids.indexOf('wave-3-start'));
    expect(ids.indexOf('wave-3-start')).toBeLessThan(ids.indexOf('learn-swatter'));
    expect(ids.indexOf('learn-pepper-grab')).toBeLessThan(ids.indexOf('wave-4-start'));
    const director = new Director<TutorialApi>(steps, api);
    runPokingNext(director, 60 * 40);
    expect(director.finished).toBe(true);
    expect(api.shown).toEqual(['slingshot', 'swatter', 'pepper']);
  });

  it('a wave has no timer: it waits until it is cleared (ignoring it loses the castle)', () => {
    const api = idleApi();
    const director = new Director<TutorialApi>(buildTutorialSteps(['slingshot']), api);
    runPokingNext(director, 60 * 60);
    expect(director.current?.id).toBe('wave-1-clear');
    expect(api.ended).toBe(0);
    api.waveCleared = () => true;
    director.update(0.1);
    // Cleared: the slingshot arrives and its first lesson starts right away (no message, no Next).
    expect(director.current?.id).toBe('learn-sling-grab');
    expect(api.shown).toEqual(['slingshot']);
  });

  it('info steps wait for Next: no time limit and nothing else moves them on', () => {
    const api = eagerApi();
    const steps = buildTutorialSteps(['slingshot']);
    const director = new Director<TutorialApi>(steps, api);
    // The board, pinch and eat lessons pass at once, then the first info step waits.
    run(director, 60 * 10, 0.25);
    expect(director.current?.id).toBe('flag-health');
    director.skip();
    expect(director.current?.id).toBe('flag-wave');
  });

  it('moves on as soon as the player does each lesson, and leaves out tools not built yet', () => {
    const api = eagerApi();
    const steps = buildTutorialSteps(['slingshot']);
    expect(steps.some((s) => s.id === 'learn-swatter')).toBe(false);
    const director = new Director<TutorialApi>(steps, api);
    // Lessons pass right away, so only one frame per info step is needed.
    runPokingNext(director, steps.length * 2);
    expect(director.finished).toBe(true);
  });

  it('the slingshot is taught by actions only: no Next button anywhere from its arrival to the first shot', () => {
    const steps = buildTutorialSteps(['slingshot']);
    const from = steps.findIndex((s) => s.id === 'wave-1-cleared');
    const to = steps.findIndex((s) => s.id === 'learn-sling-shoot');
    expect(steps.slice(from, to + 1).some((s) => s.hint?.next)).toBe(false);
  });

  it('does not ask again for slingshot steps the player already did', () => {
    const api = idleApi();
    api.waveCleared = () => true;
    const director = new Director<TutorialApi>(buildTutorialSteps(['slingshot']), api);
    while (director.current?.id !== 'learn-sling-grab') director.skip();
    // The player grabbed it, took a pebble and loaded it all in one go, faster than the lessons.
    const done = { grabbed: 1, pebbleTaken: 1, loaded: 1, shot: 0 };
    api.slingCount = (event) => done[event];
    api.slingLoaded = () => true;
    director.update(0.1);
    // All three loading lessons pass, wave 2 starts, and the shoot lesson shows.
    expect(director.current?.id).toBe('learn-sling-shoot');
    expect(api.started).toContain(1);
  });

  it('teaches the food jar by eating, right before the first food tool appears', () => {
    const ids = buildTutorialSteps(['slingshot', 'swatter', 'pepper']).map((s) => s.id);
    expect(ids.indexOf('food-jar')).toBeGreaterThan(ids.indexOf('wave-2-cleared'));
    expect(ids.indexOf('learn-food')).toBeGreaterThan(ids.indexOf('food-jar'));
    expect(ids.indexOf('learn-swatter-grab')).toBe(ids.indexOf('learn-food') + 1);
    // Only once: the pepper comes without it.
    expect(ids.filter((id) => id === 'food-jar')).toHaveLength(1);
  });

  it('holds the swatter timer while its use lesson runs, and moves on after one goblin is swatted', () => {
    const api = idleApi();
    const director = new Director<TutorialApi>(buildTutorialSteps(['slingshot', 'swatter']), api);
    while (director.current?.id !== 'learn-swatter') director.skip();
    expect(api.held.swatter).toBe(true);
    // Goblins take a while to reach the wall: the lesson keeps waiting, the timer stays held.
    run(director, 90);
    expect(director.current?.id).toBe('learn-swatter');
    expect(api.held.swatter).toBe(true);
    api.toolUses = () => 1;
    director.update(0.1);
    expect(director.current?.id).toBe('wave-3-clear');
    expect(api.held.swatter).toBe(false);
  });

  it('starts at a later wave: the earlier lessons and waves are left out', () => {
    const api = idleApi();
    const steps = buildTutorialSteps(['slingshot', 'swatter', 'pepper'], TUTORIAL_WAVES, 2);
    expect(steps[0].id).toBe('wave-2-cleared');
    expect(steps.some((s) => s.id === 'learn-spin' || s.id === 'learn-sling-grab')).toBe(false);
    const director = new Director<TutorialApi>(steps, api);
    director.update(0.1);
    // The breather clears wave 2, then the food jar is shown before the swatter.
    expect(api.cleared).toBe(1);
    expect(director.current?.id).toBe('food-jar');
  });

  it('measures the reach first, once, even when starting at a later wave, and never gets stuck without hands', () => {
    expect(buildTutorialSteps(['slingshot'], TUTORIAL_WAVES, 0, true)[0].id).toBe('reach-check');
    expect(buildTutorialSteps(['slingshot'], TUTORIAL_WAVES, 2, true)[0].id).toBe('reach-check');
    expect(buildTutorialSteps(['slingshot']).some((s) => s.id === 'reach-check')).toBe(false);
    const api = idleApi();
    const director = new Director<TutorialApi>(buildTutorialSteps(['slingshot'], TUTORIAL_WAVES, 0, true), api);
    run(director, 60);
    expect(director.current?.id).not.toBe('reach-check');
  });

  it('numbers the lessons', () => {
    const lessons = buildTutorialSteps(['slingshot']).filter((s) => s.hint?.kind === 'lesson');
    expect(lessons[0].hint?.header).toBe(`Step 1 of ${lessons.length}`);
    expect(lessons.map((s) => s.id)).toContain('learn-sling-shoot');
  });
});
