// The saved Custom Game levels (docs/custom-mode.md "Saving"): one
// localStorage key, next to the progress, no backend. The rules are in
// src/rules/customLevels.ts; this only reads and writes them. A private
// window (no storage) still works, it just forgets on reload.
import { createCustomLevels, parseCustomLevels, type CustomLevels } from '../rules/customLevels.js';

const STORAGE_KEY = 'tallTale.customLevels';

function load(): CustomLevels {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    return text ? parseCustomLevels(JSON.parse(text)) : createCustomLevels();
  } catch {
    return createCustomLevels();
  }
}

/** The page's saved levels. Change them through the rules, then call saveCustomLevels(). */
export const customLevels: CustomLevels = load();

export function saveCustomLevels(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customLevels));
  } catch {
    // No storage, or it is full: it still holds for this visit.
  }
}

/** Debug: forget every saved level. */
export function resetCustomLevels(): void {
  customLevels.levels.length = 0;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing saved.
  }
}
