import { describe, expect, it } from 'vitest';
import { clearWave, createBattle, type BattleRules } from './battle.js';
import {
  addFood,
  createFood,
  createToolUse,
  eatValue,
  resetFood,
  tickToolUse,
  toolUsable,
  useTool,
  type FoodRules,
} from './food.js';

const rules: FoodRules = { start: 4, max: 10, eatBasic: 1, eatSeasoned: 2 };
const battleRules: BattleRules = { maxHealth: 100, repairShare: 0.35 };

describe('food and tool costs', () => {
  it('eating adds food, seasoned goblins give more, and the jar stops at the max', () => {
    const food = createFood(rules);
    expect(food.food).toBe(4);
    addFood(food, eatValue(rules, false));
    expect(food.food).toBe(5);
    addFood(food, eatValue(rules, true));
    expect(food.food).toBe(7);
    expect(addFood(food, 10)).toBe(3);
    expect(food.food).toBe(10);
  });

  it('a tool cannot be used without enough food, and nothing is spent', () => {
    const food = createFood(rules);
    const swatter = createToolUse();
    expect(toolUsable(food, swatter, 6)).toBe(false);
    expect(useTool(food, swatter, 6, 10)).toBe('locked');
    expect(food.food).toBe(4);
    expect(swatter.active).toBe(false);
  });

  it('the first use pays once, further uses are free until the timer ends', () => {
    const food = createFood(rules);
    const swatter = createToolUse();
    expect(useTool(food, swatter, 4, 10)).toBe('started');
    expect(food.food).toBe(0);
    expect(useTool(food, swatter, 4, 10)).toBe('active');
    expect(food.food).toBe(0);
    // Paid for, so it stays usable with an empty jar.
    expect(toolUsable(food, swatter, 4)).toBe(true);
    expect(tickToolUse(swatter, 9)).toBe(false);
    expect(tickToolUse(swatter, 1.5)).toBe(true);
    expect(useTool(food, swatter, 4, 10)).toBe('locked');
  });

  it('food carries over between waves and resets for a new battle', () => {
    const food = createFood(rules);
    const battle = createBattle(5, battleRules);
    addFood(food, 3);
    clearWave(battle, battleRules);
    clearWave(battle, battleRules);
    expect(battle.wavesCleared).toBe(2);
    expect(food.food).toBe(7);
    resetFood(food, rules);
    expect(food.food).toBe(4);
  });
});
