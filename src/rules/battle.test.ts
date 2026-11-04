import { describe, expect, it } from 'vitest';
import { clearWave, createBattle, damageCastle, type BattleRules } from './battle.js';

const rules: BattleRules = { maxHealth: 100, repairShare: 0.4 };

describe('win and lose', () => {
  it('clearing the last wave wins', () => {
    const battle = createBattle(3, rules);
    clearWave(battle, rules);
    clearWave(battle, rules);
    expect(battle.phase).toBe('playing');
    clearWave(battle, rules);
    expect(battle.phase).toBe('won');
    expect(battle.wavesCleared).toBe(3);
  });

  it('castle health at zero loses, and nothing changes after that', () => {
    const battle = createBattle(5, rules);
    damageCastle(battle, 60);
    expect(battle.phase).toBe('playing');
    damageCastle(battle, 60);
    expect(battle.health).toBe(0);
    expect(battle.phase).toBe('lost');
    clearWave(battle, rules);
    expect(battle.phase).toBe('lost');
    expect(battle.wavesCleared).toBe(0);
  });

  it('the breather repairs part of the damage, not all of it', () => {
    const battle = createBattle(5, rules);
    damageCastle(battle, 50);
    clearWave(battle, rules);
    expect(battle.health).toBeGreaterThan(50);
    expect(battle.health).toBeLessThan(100);
    expect(battle.health).toBeCloseTo(70);
  });
});
