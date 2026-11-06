// Which time of day a wave is fought at (docs/mvp.md, "Day and night cycle").
// Time follows the waves, not a clock, and works for any number of waves:
// the first wave in the morning, the last at night, the one before the last
// at sunset, and every other wave by day.
import type { TimeOfDay } from '../config/game.js';

/** The time of day of wave `wave` (0 based) in a battle of `total` waves. */
export function timeOfWave(wave: number, total: number): TimeOfDay {
  const last = total - 1;
  if (wave <= 0 && last > 0) return 'morning';
  if (wave >= last) return total === 1 ? 'morning' : 'night';
  if (wave === last - 1) return 'sunset';
  return 'day';
}
