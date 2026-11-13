// The wall garrison's rules (docs/v2-plan.md 2.7). Plain functions, no
// Three.js. src/units/garrison.ts runs them.

export interface RefillState {
  /** Time since the garrison was last full or since the last one climbed up (seconds). */
  timer: number;
}

/**
 * One frame of the refill: while fewer than `size` stand on the rampart, one
 * new one climbs up every `every` seconds. Returns true on the frame one
 * should start climbing. A full garrison keeps the timer at 0, so the first
 * one after a loss comes a full `every` later.
 */
export function refillTick(state: RefillState, alive: number, size: number, dt: number, every: number): boolean {
  if (alive >= size) {
    state.timer = 0;
    return false;
  }
  state.timer += dt;
  if (state.timer < every) return false;
  state.timer = 0;
  return true;
}

/** Which kind climbs up next: an archer while archers are missing, else a guard. Null when both are full. */
export function nextRecruit(archers: number, guards: number, wantArchers: number, wantGuards: number): 'archer' | 'guard' | null {
  if (archers < wantArchers) return 'archer';
  if (guards < wantGuards) return 'guard';
  return null;
}

/** Arc distance along the rampart between two board angles (cm, radius `radius`). */
export function arcDistance(a: number, b: number, radius: number): number {
  // No loop: a bad angle can never hang the game.
  const d = b - a;
  if (!Number.isFinite(d)) return Infinity;
  return Math.abs(d - Math.round(d / (Math.PI * 2)) * Math.PI * 2) * radius;
}
