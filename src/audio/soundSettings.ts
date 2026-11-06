// The player's volume for each sound group (SOUND_CATEGORIES), 0 to 1, and
// whether it is muted. Kept in localStorage, so it holds across visits.
// Muting keeps the volume, so unmuting brings it back where it was.
import { SOUND_CATEGORIES, SOUND_SETTINGS, type SoundCategory } from '../config/sounds.js';

interface Setting {
  volume: number;
  muted: boolean;
}

export class SoundSettings {
  private settings = new Map<SoundCategory, Setting>();
  /** Called after any change (the audio applies it at once). */
  onChange: () => void = () => {};

  constructor() {
    for (const c of SOUND_CATEGORIES) this.settings.set(c.id, { volume: 1, muted: false });
    try {
      const saved = JSON.parse(localStorage.getItem(SOUND_SETTINGS.storageKey) ?? '{}') as Record<string, Partial<Setting>>;
      for (const [id, s] of Object.entries(saved)) {
        const setting = this.settings.get(id as SoundCategory);
        if (!setting) continue;
        if (typeof s.volume === 'number') setting.volume = Math.min(1, Math.max(0, s.volume));
        if (typeof s.muted === 'boolean') setting.muted = s.muted;
      }
    } catch {
      // No storage (private window): the defaults stay.
    }
  }

  /** What the group plays at now (0 when muted). */
  level(category: SoundCategory): number {
    const s = this.settings.get(category)!;
    return s.muted ? 0 : s.volume;
  }

  volume(category: SoundCategory): number {
    return this.settings.get(category)!.volume;
  }

  muted(category: SoundCategory): boolean {
    return this.settings.get(category)!.muted;
  }

  /** `save`: also store it (on a slider's release, not every frame of a drag). */
  setVolume(category: SoundCategory, volume: number, save = true): void {
    const s = this.settings.get(category)!;
    s.volume = Math.min(1, Math.max(0, volume));
    // Turning a muted group up unmutes it.
    if (s.volume > 0 && s.muted) s.muted = false;
    this.changed(save);
  }

  setMuted(category: SoundCategory, muted: boolean): void {
    this.settings.get(category)!.muted = muted;
    this.changed(true);
  }

  private changed(save: boolean): void {
    this.onChange();
    if (!save) return;
    try {
      localStorage.setItem(SOUND_SETTINGS.storageKey, JSON.stringify(Object.fromEntries(this.settings)));
    } catch {
      // No storage: the change still holds for this visit.
    }
  }
}
