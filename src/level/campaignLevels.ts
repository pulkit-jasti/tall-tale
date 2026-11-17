// The campaign's level files (made by `npm run gen -- --campaign`, frozen in
// src/maps/levels/). Read once at start; a level without a file (the locked
// teasers 6 to 15) has none here.
import { parseLevel, type Level } from './level.js';

const files = import.meta.glob<{ default: unknown }>('../maps/levels/level*.json', { eager: true });

const levels = new Map<number, Level>();
for (const [path, mod] of Object.entries(files)) {
  const n = Number(/level(\d+)\.json$/.exec(path)?.[1]);
  if (!Number.isFinite(n)) continue;
  try {
    levels.set(n, parseLevel(mod.default));
  } catch (error) {
    console.error(`[campaign] ${path} is broken`, error);
  }
}

/** The campaign level's file, or null when it has none. */
export function campaignLevel(n: number): Level | null {
  return levels.get(n) ?? null;
}
