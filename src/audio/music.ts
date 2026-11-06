// Background music (MUSIC in src/config/sounds.ts): a calm track for the
// menus (the welcome and end panels, and the pause panel) and a battle track
// while a battle is fought. Both loop all the time once started; switching
// only fades their volumes across, so there is never a gap or a click. Flat
// (not placed in the world) and kept quiet under the sound cues.
import { AssetManager } from '@iwsdk/core';
import { Audio, type AudioListener } from 'three';
import { MUSIC, type MusicTrack } from '../config/sounds.js';

export type MusicMode = 'menu' | 'battle';

export class Music {
  private tracks: { def: MusicTrack; voice: Audio; buffer: AudioBuffer | null }[];
  private mode: MusicMode | null = null;
  private started = false;
  /** The player's music volume (pause panel settings), 0 to 1. */
  private volume = 1;

  constructor(listener: AudioListener) {
    this.tracks = [MUSIC.menu, MUSIC.battle].map((def) => ({ def, voice: new Audio(listener), buffer: null }));
  }

  async load(): Promise<void> {
    await Promise.all(
      this.tracks.map(async (track) => {
        try {
          track.buffer = await AssetManager.loadAudio(`${import.meta.env.BASE_URL}audio/${track.def.file}`);
        } catch (error) {
          console.warn(`[music] could not load ${track.def.file}`, error);
        }
      }),
    );
  }

  /** Every frame: which track should be heard. A change fades across over MUSIC.fade seconds. */
  update(mode: MusicMode): void {
    if (!MUSIC.enabled) return;
    if (!this.started) this.start();
    if (mode === this.mode) return;
    this.mode = mode;
    const now = this.tracks[0].voice.context.currentTime;
    for (const [i, track] of this.tracks.entries()) {
      const target = (i === 0 ? 'menu' : 'battle') === mode ? track.def.volume * this.volume : 0;
      const gain = track.voice.gain.gain;
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(gain.value, now);
      // About 95% of the way there after MUSIC.fade.
      gain.setTargetAtTime(target, now, MUSIC.fade / 3);
    }
  }

  /** The player's music volume: the track that plays now fades to it. */
  setVolume(volume: number): void {
    this.volume = volume;
    const mode = this.mode;
    this.mode = null;
    if (mode && this.started) this.update(mode);
  }

  private start(): void {
    this.started = true;
    for (const track of this.tracks) {
      if (!track.buffer) continue;
      const { voice, def } = track;
      voice.setBuffer(track.buffer);
      voice.setLoop(true);
      // A loop point inside the file (the battle track's tail past it is left out, it rings on).
      if (def.loopEnd !== undefined) {
        voice.setLoopStart(def.loopStart ?? 0);
        voice.setLoopEnd(def.loopEnd);
      }
      voice.gain.gain.value = 0;
      voice.play();
    }
  }
}
