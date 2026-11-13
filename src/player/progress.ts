// The player's saved campaign progress (docs/v2-plan.md 2.8 "Saving"): one
// localStorage key, no backend. The rules are in src/rules/campaign.ts; this
// only reads and writes them. A private window (no storage) still plays, it
// just forgets on reload.
import { createProgress, fixPlaces, parseProgress, type Progress } from '../rules/campaign.js';

const STORAGE_KEY = 'tallTale.progress';

function load(): Progress {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    return text ? parseProgress(JSON.parse(text)) : createProgress();
  } catch {
    return createProgress();
  }
}

/** The one saved progress of the page. Change it through the rules, then call save(). */
export const progress: Progress = load();

export function saveProgress(): void {
  fixPlaces(progress);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // No storage: it still holds for this visit.
  }
}

/** Debug: forget everything (the tutorial, stars, unlocks, the loadout). */
export function resetProgress(): void {
  Object.assign(progress, createProgress());
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing saved.
  }
}
