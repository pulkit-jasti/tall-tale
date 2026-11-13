import { describe, expect, it } from 'vitest';
import { defaultSettings, fixSettings, LEVEL_SETTINGS, type LevelSettings } from '../config/levelSettings.js';
import { checkLevel } from './checks.js';
import { generateLevel, LevelGenError, summarize } from './generate.js';
import { parseLevel } from './level.js';

const settingsWith = (change: Partial<LevelSettings>): LevelSettings => ({ ...defaultSettings(), ...change });

describe('level generator', () => {
  it('makes the same level for the same seed and settings', () => {
    const a = generateLevel(42, defaultSettings());
    const b = generateLevel(42, defaultSettings());
    expect(JSON.stringify(a.level)).toBe(JSON.stringify(b.level));
    expect(JSON.stringify(generateLevel(43, defaultSettings()).level)).not.toBe(JSON.stringify(a.level));
  });

  it('passes its own checks and reads back from JSON', () => {
    for (let seed = 0; seed < 40; seed++) {
      const g = generateLevel(seed, defaultSettings());
      expect(checkLevel(g.level, defaultSettings())).toEqual([]);
      const back = parseLevel(JSON.parse(JSON.stringify(g.level)));
      expect(back.waves).toHaveLength(4);
      expect(summarize(g)).toContain('wave 4');
    }
  });

  it('works across the settings', () => {
    const cases: Partial<LevelSettings>[] = [
      { camps: 1, junctions: 1, wiggle: 0, forks: 0, loops: 0 },
      { camps: 5, junctions: 8, wiggle: 1, forks: 3, loops: 4, crossings: 3 },
      { camps: 2, campSpread: 'opposite', difficulty: 'hard' },
      { camps: 4, campSpread: 'oneSide', junctions: 2 },
      { camps: 3, campDistance: [180, 220], campSize: 20 },
      { triggersPerRoad: 3, kegs: false, trees: false },
      { triggersPerRoad: 0 },
      { goblins: 30, growth: 0.6, balloons: 4, difficulty: 'hard' },
    ];
    for (const change of cases) {
      const s = settingsWith(change);
      let made = 0;
      for (let seed = 0; seed < 8; seed++) {
        try {
          const g = generateLevel(seed * 1000, s);
          expect(checkLevel(g.level, s)).toEqual([]);
          made++;
        } catch (error) {
          if (!(error instanceof LevelGenError)) throw error;
        }
      }
      expect(made, JSON.stringify(change)).toBeGreaterThan(5);
    }
  });

  it('raises camps over the waves and keeps wave 1 with at least one camp', () => {
    const g = generateLevel(7, settingsWith({ camps: 4, difficulty: 'easy' }));
    const waves = g.level.map.nodes.filter((n) => n.kind === 'camp').map((n) => n.wave);
    expect(waves).toContain(1);
    expect(Math.max(...(waves as number[]))).toBeGreaterThan(1);
    expect(g.level.waves[0].rising).toEqual([]);
    for (const w of g.level.waves.slice(1)) for (const id of w.rising) expect(w.camps).toContain(id);
  });

  it('winds roads with wiggle and keeps them straight without', () => {
    const straight = generateLevel(5, settingsWith({ wiggle: 0, forks: 0, loops: 0, camps: 3, junctions: 3 })).level.map;
    const winding = generateLevel(5, settingsWith({ wiggle: 1, forks: 0, loops: 0, camps: 3, junctions: 3 })).level.map;
    const spread = (m: typeof straight): number => {
      const camp = m.roads.filter((r) => r.from.startsWith('camp'));
      return camp.reduce((sum, r) => sum + Math.max(...r.via.map((p) => p[1])) - Math.min(...r.via.map((p) => p[1])), 0);
    };
    expect(spread(winding)).toBeGreaterThan(spread(straight));
  });
});

describe('level settings', () => {
  it('fixes bad values and keeps good ones', () => {
    const fixed = fixSettings({ camps: 99, wiggle: 0.123, campDistance: [500, 100], difficulty: 'nope', kegs: 'yes', extra: 1 });
    expect(fixed.camps).toBe(5);
    expect(fixed.wiggle).toBeCloseTo(0.1);
    expect(fixed.campDistance).toEqual([180, 470]);
    expect(fixed.difficulty).toBe('normal');
    expect(fixed.kegs).toBe(true);
    expect('extra' in fixed).toBe(false);
    expect(Object.keys(fixed)).toHaveLength(LEVEL_SETTINGS.length);
  });
});
