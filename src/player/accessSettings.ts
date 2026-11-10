// The player's accessibility choices from the settings' Accessibility tab,
// kept in localStorage so they hold across visits. For now: the bell in
// place of the megaphone, for players who cannot or do not want to shout
// (hard rule: voice is never required). Without a mic the bell is always
// used, whatever the choice.
import { mic } from '../audio/mic.js';

const STORAGE_KEY = 'tallTale.access';

class AccessSettings {
  /** The bell in place of the megaphone, even with a mic. */
  bell = false;

  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as { bell?: unknown };
      if (typeof saved.bell === 'boolean') this.bell = saved.bell;
    } catch {
      // No storage (private window): the defaults stay.
    }
  }

  setBell(on: boolean): void {
    this.bell = on;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ bell: this.bell }));
    } catch {
      // No storage: it still holds for this visit.
    }
  }
}

/** The one set of accessibility choices of the page. */
export const access = new AccessSettings();

/** True when the bell is the stun tool (no mic, or the player chose it), false for the megaphone. */
export function usesBell(): boolean {
  return !mic.on || access.bell;
}
