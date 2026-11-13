import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../config/levelSettings.js';
import { generateLevel } from '../level/generate.js';
import { buildLevelSteps, hiddenAtStart, levelWavePlans, risingByWave } from './levelDirector.js';
import { TUTORIAL_WAVES } from './tutorial.js';

describe('level wave director', () => {
  it('raises each tutorial camp in the first wave that sends from it', () => {
    expect(risingByWave(TUTORIAL_WAVES)).toEqual([[], ['campEast'], ['campWest'], ['campSouth']]);
    expect(hiddenAtStart(TUTORIAL_WAVES, 0)).toEqual(['campEast', 'campWest', 'campSouth']);
    // Started at wave 3: the east camp is already up, the west camp rises with wave 3.
    expect(hiddenAtStart(TUTORIAL_WAVES, 2)).toEqual(['campWest', 'campSouth']);
  });

  it("plays a generated level's waves with its own rising camps and gear", () => {
    const { level } = generateLevel(42, defaultSettings());
    const plans = levelWavePlans(level);
    expect(plans).toHaveLength(level.waves.length);
    plans.forEach((plan, i) => {
      expect(plan.camps).toEqual(level.waves[i].camps);
      expect(plan.gear).toEqual(level.waves[i].gear);
      expect(plan.intro.length).toBeGreaterThan(0);
    });
    expect(risingByWave(plans)).toEqual(level.waves.map((w) => w.rising));
    // Every camp a wave sends from is up by then: there from the start, or rising at that wave or before.
    const hidden = new Set(hiddenAtStart(plans, 0));
    plans.forEach((plan, i) => {
      const risen = new Set(risingByWave(plans).slice(0, i + 1).flat());
      for (const camp of plan.camps) expect(!hidden.has(camp) || risen.has(camp)).toBe(true);
    });
  });

  it('has a banner, a fight and a breather per wave, and no breather banner after the last', () => {
    const { level } = generateLevel(7, defaultSettings());
    const steps = buildLevelSteps(levelWavePlans(level));
    expect(steps).toHaveLength(level.waves.length * 3);
    expect(steps[0].id).toBe('wave-1-start');
    expect(steps[0].hint?.header).toBe(`Wave 1 of ${level.waves.length}`);
    const last = steps[steps.length - 1];
    expect(last.id).toBe(`wave-${level.waves.length}-cleared`);
    expect(last.hint).toBeUndefined();
  });
});
