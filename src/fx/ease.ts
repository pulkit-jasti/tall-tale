// Shared easing for things that go away (docs: "despawn"): most objects
// shrink out with a small elastic swell first, like a cartoon pop, instead of
// vanishing at once. No Three.js here.

/** Overshoot of the swell (the classic "back" ease constant). */
const BACK = 1.70158;

/**
 * Size of a thing that goes away, from 1 (t = 0) to 0 (t = 1): it swells a
 * little first, then shrinks away fast, like an elastic snap.
 */
export function shrinkAway(t: number): number {
  const u = Math.min(1, Math.max(0, t));
  // 1 minus an ease-in-back curve: up to about 1.1 early on, then down to 0.
  return Math.max(0, 1 - ((BACK + 1) * u * u * u - BACK * u * u));
}

/** Size of a thing that pops in, from 0 to 1, with a small elastic overshoot. */
export function popIn(t: number): number {
  const u = Math.min(1, Math.max(0, t)) - 1;
  return 1 + (BACK + 1) * u * u * u + BACK * u * u;
}

/** A smooth start and stop, from 0 (t = 0) to 1 (t = 1): the menu and battle sliding in and out of the ground. */
export function easeInOut(t: number): number {
  const s = Math.min(1, Math.max(0, t));
  return s * s * (3 - 2 * s);
}
