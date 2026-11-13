// Free tools with a use window and a recharge (docs/v2-plan.md 2.1 and 2.2).
// Plain functions on a small state object, no Three.js. The tools only show
// and use them.
//
//   ready -> (first use) -> using for the use window -> recharging -> ready
//
// - The use window starts with the first use (a swat, a shake, a ring), not
//   the grab, so an accidental grab never wastes it.
// - The recharge only fills while the tool is back on its platform.
// - Eating a goblin fills every recharging tool's ring by a share of its full
//   recharge (10%, a seasoned goblin 20%). It never touches a use window and
//   never makes a ready tool "more ready".

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
 * hold it), the recharge fills while `onPlatform`. Returns 'ended' on the
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
  if (state.phase === 'recharging' && onPlatform) {
    state.charge = rechargeSeconds > 0 ? state.charge + dt / rechargeSeconds : 1;
    if (state.charge < 1) return null;
    readyNow(state);
    return 'ready';
  }
  return null;
}

/** Eating: a recharging tool's ring jumps forward by `share` of its full recharge. Returns true if it moved. */
export function refillCharge(state: ToolCharge, share: number): boolean {
  if (state.phase !== 'recharging' || share <= 0) return false;
  state.charge = Math.min(1, state.charge + share);
  return true;
}

/** The share of a full recharge one eaten goblin gives (seasoned: peppered). */
export function eatShare(seasoned: boolean, basic: number, seasonedShare: number): number {
  return seasoned ? seasonedShare : basic;
}

/** Ready at once (a new battle, the tutorial's help, debug). */
export function readyNow(state: ToolCharge): void {
  state.phase = 'ready';
  state.useLeft = 0;
  state.charge = 1;
}
