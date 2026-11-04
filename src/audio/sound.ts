// Plays sounds by name (src/config/sounds.ts). Positional sounds come from a
// point in the world, so they turn with the board and get quieter far away.
import { AssetManager } from '@iwsdk/core';
import { Audio, AudioListener, Object3D, PositionalAudio, Vector3 } from 'three';
import { SOUNDS, type SoundDef, type SoundName } from '../config/sounds.js';
import type { Random } from '../rules/random.js';

const POSITIONAL_VOICES = 12;
const FLAT_VOICES = 6;

export class GameAudio {
  private buffers = new Map<string, AudioBuffer>();
  private positional: PositionalAudio[] = [];
  private flat: Audio[] = [];
  private nextPositional = 0;
  private nextFlat = 0;
  private lastPlayed = new Map<SoundName, number>();
  private listener: AudioListener;

  constructor(
    private scene: Object3D,
    head: Object3D,
    private rng: Random,
  ) {
    // Reuse the listener IWSDK puts on the player's head, if there is one.
    let found: AudioListener | undefined;
    head.traverse((o) => {
      if ((o as AudioListener).type === 'AudioListener') found = o as AudioListener;
    });
    this.listener = found ?? new AudioListener();
    if (!found) head.add(this.listener);
    for (let i = 0; i < POSITIONAL_VOICES; i++) {
      const voice = new PositionalAudio(this.listener);
      voice.setRefDistance(0.35);
      voice.setRolloffFactor(1.2);
      voice.setDistanceModel('inverse');
      this.scene.add(voice);
      this.positional.push(voice);
    }
    for (let i = 0; i < FLAT_VOICES; i++) this.flat.push(new Audio(this.listener));
  }

  /** Loads every sound file in the config. */
  async load(): Promise<void> {
    const files = new Set<string>();
    for (const def of Object.values(SOUNDS) as SoundDef[]) def.files.forEach((f) => files.add(f));
    await Promise.all(
      [...files].map(async (file) => {
        try {
          const buffer = await AssetManager.loadAudio(`${import.meta.env.BASE_URL}audio/${file}`);
          this.buffers.set(file, buffer);
        } catch (error) {
          console.warn(`[audio] could not load ${file}`, error);
        }
      }),
    );
  }

  /** Browsers only play sound after a user tap. Call from a click handler. */
  unlock(): void {
    const context = this.listener.context;
    if (context.state === 'suspended') void context.resume();
  }

  /** Silences all sound while the game is paused (Quest menu open), and brings it back. */
  setPaused(paused: boolean): void {
    const context = this.listener.context;
    if (paused && context.state === 'running') void context.suspend();
    else if (!paused && context.state === 'suspended') void context.resume();
  }

  /**
   * Plays a sound. `at` is a world position for positional sounds.
   * `minGap` skips the sound if it played less than that many seconds ago.
   */
  play(name: SoundName, at?: Vector3, volume = 1, minGap = 0): void {
    const def: SoundDef = SOUNDS[name];
    const now = this.listener.context.currentTime;
    if (minGap > 0 && now - (this.lastPlayed.get(name) ?? -Infinity) < minGap) return;
    this.lastPlayed.set(name, now);
    const buffer = this.buffers.get(this.rng.pick(def.files));
    if (!buffer) return;
    let voice: Audio | PositionalAudio;
    if (def.positional && at) {
      const p = this.positional[this.nextPositional];
      this.nextPositional = (this.nextPositional + 1) % this.positional.length;
      p.position.copy(at);
      p.updateMatrixWorld();
      voice = p;
    } else {
      voice = this.flat[this.nextFlat];
      this.nextFlat = (this.nextFlat + 1) % this.flat.length;
    }
    if (voice.isPlaying) voice.stop();
    voice.setBuffer(buffer);
    voice.setVolume(def.volume * volume);
    voice.setPlaybackRate(this.rng.range(0.94, 1.06));
    voice.play();
  }
}
