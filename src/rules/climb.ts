// The climb (docs/v2-plan.md 2.6). Every goblin that reaches the wall goes
// through four steps, each more dangerous than the last, so the player
// always knows the order: deal with the ones on top first.
//
//   1. bash: hits the wall for a few seconds (wall damage, the red flash)
//   2. climb: up the wall
//   3. rampart: runs about on the wall top, attacks the wall garrison
//   4. intruder: jumps into the courtyard (the biggest damage)
//
// Plain functions, no Three.js. src/units/goblins.ts runs the steps.

export type ClimbStep = 'bash' | 'climb' | 'rampart' | 'intruder';

/** Climbing speed (cm per second): a helmet makes it slower, never faster. */
export function climbSpeed(base: number, helmet: boolean, helmetSpeed: number): number {
  return helmet ? Math.min(base, helmetSpeed) : base;
}

/** Seconds of bashing before it climbs, jittered by `jitter` (0.2 = plus or minus 20%) with a random 0 to 1. */
export function bashSeconds(base: number, jitter: number, random: number): number {
  return Math.max(0, base * (1 + (random * 2 - 1) * jitter));
}

/** Seconds a goblin takes from the foot of the wall to its top. */
export function climbSeconds(wallHeight: number, speed: number): number {
  return speed > 0 ? wallHeight / speed : Infinity;
}
