// The player's saved campaign progress (docs/v2-plan.md 2.8 "Saving"): one
// localStorage key, no backend. The rules are in src/rules/campaign.ts; this
// only reads and writes them. A private window (no storage) still plays, it
// just forgets on reload.
import { createProgress, fixPlaces, parseProgress, PICK_TOOLS, type Progress } from '../rules/campaign.js';

const STORAGE_KEY = 'tallTale.progress';

function load(): Progress {
  let p: Progress;
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    p = text ? parseProgress(JSON.parse(text)) : createProgress();
  } catch {
    p = createProgress();
  }
  // Every visit starts with an empty stand and every tool on the shelf (the developer, 2026-11-18).
  // Within a visit the picks stay, so a battle's end goes back to the same loadout.
  p.loadout = p.loadout.map(() => null);
  p.shelf = [...PICK_TOOLS];
  return p;
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
