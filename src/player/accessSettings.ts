// The player's accessibility choices from the settings' Accessibility tab,
// kept in localStorage so they hold across visits. For now: a quiet horn
// (v2), for players who cannot or do not want to blow into the mic (hard
// rule: voice is never required). The horn always works by holding it at the
// mouth; with a quiet horn the mic is simply never listened to. Without a mic
// the horn is always quiet, whatever the choice.
import { mic } from '../audio/mic.js';

const STORAGE_KEY = 'tallTale.access';

class AccessSettings {
  /** The horn never listens to the mic, even with one: hold it at the mouth to blow. */
  quietHorn = false;

  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as { quietHorn?: unknown };
      if (typeof saved.quietHorn === 'boolean') this.quietHorn = saved.quietHorn;
    } catch {
      // No storage (private window): the defaults stay.
    }
  }

  setQuietHorn(on: boolean): void {
    this.quietHorn = on;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ quietHorn: this.quietHorn }));
    } catch {
      // No storage: it still holds for this visit.
    }
  }
}

/** The one set of accessibility choices of the page. */
export const access = new AccessSettings();

/** True when the horn listens to the mic (a blow sounds it at once), false when it is quiet (hold only). */
export function hornHearsMic(): boolean {
  return mic.on && !access.quietHorn;
}
