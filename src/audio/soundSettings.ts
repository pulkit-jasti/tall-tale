// The player's volume for each sound group (SOUND_CATEGORIES), 0 (off) to
// 1. Kept in localStorage, so it holds across visits. There is no separate
// mute: a slider all the way down is off. (A mute flag saved by an older
// build is ignored, so no group stays silent without a way back.)
import { SOUND_CATEGORIES, SOUND_SETTINGS, type SoundCategory } from '../config/sounds.js';

export class SoundSettings {
  private volumes = new Map<SoundCategory, number>();
  /** Called after any change (the audio applies it at once). */
  onChange: () => void = () => {};

  constructor() {
    for (const c of SOUND_CATEGORIES) this.volumes.set(c.id, 1);
    try {
      const saved = JSON.parse(localStorage.getItem(SOUND_SETTINGS.storageKey) ?? '{}') as Record<string, { volume?: unknown }>;
      for (const [id, s] of Object.entries(saved)) {
        if (!this.volumes.has(id as SoundCategory) || typeof s?.volume !== 'number') continue;
        this.volumes.set(id as SoundCategory, Math.min(1, Math.max(0, s.volume)));
      }
    } catch {
      // No storage (private window): the defaults stay.
    }
  }

  /** What the group plays at now (0 = off). */
  level(category: SoundCategory): number {
    return this.volumes.get(category)!;
  }

  volume(category: SoundCategory): number {
    return this.volumes.get(category)!;
  }

  /** `save`: also store it (on a slider's release, not every frame of a drag). */
  setVolume(category: SoundCategory, volume: number, save = true): void {
    this.volumes.set(category, Math.min(1, Math.max(0, volume)));
    this.onChange();
    if (!save) return;
    try {
      const out: Record<string, { volume: number }> = {};
      for (const [id, v] of this.volumes) out[id] = { volume: v };
      localStorage.setItem(SOUND_SETTINGS.storageKey, JSON.stringify(out));
    } catch {
      // No storage: the change still holds for this visit.
    }
  }
}
