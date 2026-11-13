// Free tools with a use window and a recharge (docs/v2-plan.md 2.1 and 2.2).
// Plain functions on a small state object, no Three.js. The tools only show
// and use them.
//
//   ready -> (first use) -> using for the use window -> recharging -> ready
//
// - The use window starts with the first use (a swat, a shake, a ring), not
//   the grab, so an accidental grab never wastes it.
// - The recharge only fills while the tool is back on its platform.
// - v3 (docs/v3-plan.md 1.4 and 1.5): a use can count in swings instead of
//   seconds (the swatter: spendUse per swing), and a tool can charge only by
//   eating (the horn: no time recharge, refillCharge per meal). Eating no
//   longer touches the other tools.

export type ChargePhase = 'ready' | 'using' | 'recharging';

export interface ToolCharge {
  phase: ChargePhase;
  /** Seconds left of the use window (while using). */
  useLeft: number;
  /** How full the recharge ring is, 0 to 1 (while recharging). */
  charge: number;
}

export function createCharge(): ToolCharge {
  return { phase: 'ready', useLeft: 0, charge: 1 };
}

/** True when the tool can be used right now: ready, or its use window is still open. */
export function chargeUsable(state: ToolCharge): boolean {
  return state.phase !== 'recharging';
}

/**
 * The player used the tool: a ready tool starts its use window (`started`),
 * one in its window goes on (`using`), a recharging one cannot (`resting`).
 */
export function useCharge(state: ToolCharge, useSeconds: number): 'started' | 'using' | 'resting' {
  if (state.phase === 'recharging') return 'resting';
  if (state.phase === 'using') return 'using';
  state.phase = 'using';
  state.useLeft = useSeconds;
  return 'started';
}

/** The use window is over (ran out, or a one-use tool did its thing): the recharge starts from empty. */
export function endUse(state: ToolCharge): void {
  state.phase = 'recharging';
  state.useLeft = 0;
  state.charge = 0;
}

/**
 * One frame. The use window runs down while `windowRuns` (the tutorial can
 * hold it; never for a use counted in swings), the recharge fills while `onPlatform`. Returns 'ended' on the
 * frame the use window runs out and 'ready' on the frame the ring is full.
 */
export function tickCharge(state: ToolCharge, dt: number, rechargeSeconds: number, windowRuns: boolean, onPlatform: boolean): 'ended' | 'ready' | null {
  if (state.phase === 'using') {
    if (!windowRuns) return null;
    state.useLeft -= dt;
    if (state.useLeft > 0) return null;
    endUse(state);
    return 'ended';
  }
  // A recharge of 0 never fills by time (the horn fills only by eating).
  if (state.phase === 'recharging' && onPlatform && rechargeSeconds > 0) {
    state.charge += dt / rechargeSeconds;
    if (state.charge < 1) return null;
    readyNow(state);
    return 'ready';
  }
  return null;
}

/**
 * A use counted in swings (the swatter): one swing spent. Returns true when
 * that was the last one (the use is over and the recharge starts).
 */
export function spendUse(state: ToolCharge): boolean {
  if (state.phase !== 'using') return false;
  state.useLeft -= 1;
  if (state.useLeft > 0) return false;
  endUse(state);
  return true;
}

/**
 * Eating (the horn): a recharging ring jumps forward by `share`. Returns
 * 'ready' when that filled it, 'filled' when it only moved, null when it
 * was not recharging.
 */
export function refillCharge(state: ToolCharge, share: number): 'ready' | 'filled' | null {
  if (state.phase !== 'recharging' || share <= 0) return null;
  state.charge = Math.min(1, state.charge + share);
  // A float sum of fifths can land a hair under 1.
  if (state.charge < 1 - 1e-6) return 'filled';
  readyNow(state);
  return 'ready';
}

/** The share of a full horn one eaten goblin gives: 1 of `meals`, a seasoned one `seasonedMeals`. */
export function mealShare(seasoned: boolean, meals: number, seasonedMeals: number): number {
  return (seasoned ? seasonedMeals : 1) / Math.max(1, meals);
}

/** Ready at once (a new battle, the tutorial's help, debug). */
export function readyNow(state: ToolCharge): void {
  state.phase = 'ready';
  state.useLeft = 0;
  state.charge = 1;
}
