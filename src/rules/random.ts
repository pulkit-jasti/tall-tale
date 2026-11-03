// The one seeded random function. All game randomness goes through it,
// so the same seed always gives the same run.

export interface Random {
  /** Float in [0, 1). */
  next(): number;
  /** Float in [min, max). */
  range(min: number, max: number): number;
  /** Integer in [0, count). */
  int(count: number): number;
  /** One item from a list. */
  pick<T>(items: readonly T[]): T;
}

/** Mulberry32: small, fast and good enough for games. */
export function createRandom(seed: number): Random {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (count) => Math.floor(next() * count),
    pick: (items) => items[Math.floor(next() * items.length)],
  };
}
