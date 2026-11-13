import { describe, expect, it } from 'vitest';
import { CUSTOM_GAME } from '../config/game.js';
import { defaultSettings } from '../config/levelSettings.js';
import { generateLevel } from '../level/generate.js';
import {
  addLevel,
  checkName,
  copyName,
  createCustomLevels,
  duplicateLevel,
  freeName,
  isFull,
  parseCustomLevels,
  removeLevel,
  updateLevel,
} from './customLevels.js';

const level = generateLevel(1, defaultSettings()).level;

describe('custom levels', () => {
  it('checks names: empty, too long, taken (ignoring capitals and spaces), own name while editing', () => {
    const list = createCustomLevels();
    expect(checkName(list, '   ')).toBe('empty');
    expect(checkName(list, 'x'.repeat(CUSTOM_GAME.nameMax + 1))).toBe('tooLong');
    expect(checkName(list, 'x'.repeat(CUSTOM_GAME.nameMax))).toBeNull();
    const a = addLevel(list, '  Goblin   Party ', '', level, 1)!;
    expect(a.name).toBe('Goblin Party');
    expect(checkName(list, 'goblin party')).toBe('taken');
    expect(checkName(list, 'Goblin Party', a.id)).toBeNull();
    expect(addLevel(list, 'GOBLIN PARTY', '', level, 2)).toBeNull();
  });

  it('gives free names and copy names that fit the limit', () => {
    const list = createCustomLevels();
    expect(freeName(list)).toBe('Level 1');
    addLevel(list, 'Level 1', '', level, 1);
    expect(freeName(list)).toBe('Level 2');
    expect(copyName(list, 'Level 1')).toBe('Level 1 copy');
    addLevel(list, 'Level 1 copy', '', level, 2);
    expect(copyName(list, 'Level 1')).toBe('Level 1 copy 2');
    const long = copyName(list, 'A very long level nam');
    expect(long.length).toBeLessThanOrEqual(CUSTOM_GAME.nameMax);
    expect(long.endsWith(' copy')).toBe(true);
  });

  it('adds newest first, updates in place, duplicates next to the original, removes and picks the next', () => {
    const list = createCustomLevels();
    const a = addLevel(list, 'A', '', level, 1)!;
    const b = addLevel(list, 'B', '', level, 2)!;
    expect(list.levels.map((l) => l.name)).toEqual(['B', 'A']);
    expect(updateLevel(list, a.id, 'A2', '  A  quiet   road ', level, 3)).toBe(true);
    expect(updateLevel(list, a.id, 'b', '', level, 3)).toBe(false);
    expect(list.levels[1].name).toBe('A2');
    expect(list.levels[1].description).toBe('A quiet road');
    const copy = duplicateLevel(list, b.id, 4)!;
    expect(list.levels.map((l) => l.name)).toEqual(['B copy', 'B', 'A2']);
    expect(removeLevel(list, copy.id)).toBe(0);
    expect(removeLevel(list, a.id)).toBe(0);
    expect(removeLevel(list, b.id)).toBe(-1);
  });

  it('stops at the most levels', () => {
    const list = createCustomLevels();
    for (let i = 0; i < CUSTOM_GAME.maxLevels; i++) addLevel(list, `L${i}`, '', level, i);
    expect(isFull(list)).toBe(true);
    expect(addLevel(list, 'one more', '', level, 99)).toBeNull();
    expect(duplicateLevel(list, list.levels[0].id, 99)).toBeNull();
  });

  it('reads saved data back, dropping broken levels only', () => {
    const list = createCustomLevels();
    addLevel(list, 'Good', '', level, 1);
    const saved = JSON.parse(JSON.stringify(list));
    saved.levels.push({ id: 'x', name: 'Broken', level: { format: 999 } });
    const back = parseCustomLevels(saved);
    expect(back.levels.map((l) => l.name)).toEqual(['Good']);
    expect(parseCustomLevels(null).levels).toEqual([]);
  });
});
