// Food and tool costs (docs/giant-tools.md section 3). Plain functions on
// small state objects, so they can be tested without Three.js. The food jar
// and the tools only show and use them.

export interface FoodRules {
  /** Food at the start of each battle. */
  start: number;
  /** The jar is full here. Eating more adds nothing. */
  max: number;
  /** Food for eating a basic goblin, and a seasoned (peppered) one. */
  eatBasic: number;
  eatSeasoned: number;
}

export interface FoodState {
  food: number;
  max: number;
}

/** A new battle: the jar starts at the starting value. */
export function createFood(rules: FoodRules): FoodState {
  return { food: Math.min(rules.start, rules.max), max: rules.max };
}

/** Back to the starting value (a new battle). Waves never call this, so food carries over. */
export function resetFood(state: FoodState, rules: FoodRules): void {
  state.max = rules.max;
  state.food = Math.min(rules.start, rules.max);
}

/** Food for eating one goblin. */
export function eatValue(rules: FoodRules, seasoned: boolean): number {
  return seasoned ? rules.eatSeasoned : rules.eatBasic;
}

/** Adds food, never past the max. Returns how much really went in. */
export function addFood(state: FoodState, amount: number): number {
  if (amount <= 0) return 0;
  const before = state.food;
  state.food = Math.min(state.max, state.food + amount);
  return state.food - before;
}

export function canAfford(state: FoodState, cost: number): boolean {
  return state.food >= cost;
}

/** Takes the cost out of the jar. False, and nothing changes, when there is not enough. */
export function spendFood(state: FoodState, cost: number): boolean {
  if (!canAfford(state, cost)) return false;
  state.food -= cost;
  return true;
}

/**
 * One use of a food tool. Grabbing is free: the first use (first swat, first
 * shake) pays the cost and starts the timer. Until the timer runs out, every
 * further use is free.
 */
export interface ToolUse {
  active: boolean;
  /** Time left in this use (seconds). */
  timeLeft: number;
}

export function createToolUse(): ToolUse {
  return { active: false, timeLeft: 0 };
}

export type UseResult = 'started' | 'active' | 'locked';

/**
 * The player swats, shakes or rings: an active use carries on for free,
 * otherwise it starts if the food is there ('locked' when it is not).
 */
export function useTool(food: FoodState, use: ToolUse, cost: number, duration: number): UseResult {
  if (use.active) return 'active';
  if (!spendFood(food, cost)) return 'locked';
  use.active = true;
  use.timeLeft = duration;
  return 'started';
}

/** True when the tool can be used right now: in use already, or affordable. */
export function toolUsable(food: FoodState, use: ToolUse, cost: number): boolean {
  return use.active || canAfford(food, cost);
}

/** Runs the timer. Returns true on the frame the use ends. */
export function tickToolUse(use: ToolUse, dt: number): boolean {
  if (!use.active) return false;
  use.timeLeft -= dt;
  if (use.timeLeft > 0) return false;
  use.active = false;
  use.timeLeft = 0;
  return true;
}

/** Ends a use right away (a new battle). */
export function stopToolUse(use: ToolUse): void {
  use.active = false;
  use.timeLeft = 0;
}
