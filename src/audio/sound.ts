// Plays sounds by name (src/config/sounds.ts). Positional sounds come from a
// point in the world, so they turn with the board and get quieter far away.
import { AssetManager } from '@iwsdk/core';
import { Audio, AudioListener, Object3D, PositionalAudio, Quaternion, Vector3 } from 'three';
import { SOUND_MIX, SOUNDS, soundCategory, type SoundCategory, type SoundDef, type SoundName } from '../config/sounds.js';
import { mark } from '../debug/perfMarks.js';
import type { Random } from '../rules/random.js';
import { Music } from './music.js';
import { SoundSettings } from './soundSettings.js';

const POSITIONAL_VOICES = 12;
const FLAT_VOICES = 6;
/** The low pass all the way open (Hz): nothing muffled. */
const OPEN_HZ = 20000;
const listenerAt = new Vector3();
const listenerTurn = new Quaternion();
const forward = new Vector3();
const toSound = new Vector3();

/** The behind muffle of one positional voice: a low pass, then a volume, before the panner. */
interface Muffle {
  lowpass: BiquadFilterNode;
  gain: GainNode;
  /** 0 in front or at the side, 1 straight behind (last value sent). */
  behind: number;
}

export class GameAudio {
  private buffers = new Map<string, AudioBuffer>();
  private positional: PositionalAudio[] = [];
  private flat: Audio[] = [];
  private nextPositional = 0;
  private nextFlat = 0;
  private lastPlayed = new Map<SoundName, number>();
  private listener: AudioListener;
  private muffles: Muffle[] = [];
  /** The background music, on the same listener. */
  readonly music: Music;
  /** The player's volume for each sound group (pause panel settings). */
  readonly settings = new SoundSettings();
  /** What each voice plays now: its group and its own level, so a settings change can follow it. */
  private playing = new Map<Audio | PositionalAudio, { category: SoundCategory; level: number }>();

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
    const context = this.listener.context;
    for (let i = 0; i < POSITIONAL_VOICES; i++) {
      const voice = new PositionalAudio(this.listener);
      voice.setRefDistance(SOUND_MIX.refDistance);
      voice.setRolloffFactor(SOUND_MIX.rolloff);
      voice.setDistanceModel('inverse');
      if (SOUND_MIX.mono) {
        // Most files are stereo, and each channel is placed on its own, which smears the direction. Mono comes from one point.
        voice.panner.channelCount = 1;
        voice.panner.channelCountMode = 'explicit';
      }
      const lowpass = context.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = OPEN_HZ;
      const gain = context.createGain();
      voice.setFilters([lowpass, gain]);
      this.scene.add(voice);
      this.positional.push(voice);
      this.muffles.push({ lowpass, gain, behind: 0 });
    }
    for (let i = 0; i < FLAT_VOICES; i++) this.flat.push(new Audio(this.listener));
    this.music = new Music(this.listener);
    this.music.setVolume(this.settings.level('music'));
    this.settings.onChange = () => this.applySettings();
  }

  /** Loads every sound file in the config. */
  async load(): Promise<void> {
    const files = new Set<string>();
    for (const def of Object.values(SOUNDS) as SoundDef[]) def.files.forEach((f) => files.add(f));
    await Promise.all([
      this.music.load(),
      ...[...files].map(async (file) => {
        try {
          const buffer = await AssetManager.loadAudio(`${import.meta.env.BASE_URL}audio/${file}`);
          this.buffers.set(file, buffer);
        } catch (error) {
          console.warn(`[audio] could not load ${file}`, error);
        }
      }),
    ]);
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
    mark('sound');
    let voice: Audio | PositionalAudio;
    if (def.positional && at) {
      const index = this.nextPositional;
      const p = this.positional[index];
      this.nextPositional = (this.nextPositional + 1) % this.positional.length;
      p.position.copy(at);
      p.updateMatrixWorld();
      // Muffled right from the start if it is behind the head.
      this.readListener();
      this.muffle(index, now, true);
      voice = p;
    } else {
      voice = this.flat[this.nextFlat];
      this.nextFlat = (this.nextFlat + 1) % this.flat.length;
    }
    this.start(voice, def, buffer, volume, soundCategory(name));
  }

  /**
   * The behind muffle, every frame: a playing sound behind the head gets
   * duller and a little quieter (SOUND_MIX.behind), and clears up again as
   * the head or the board turns it to the front.
   */
  update(): void {
    this.readListener();
    const now = this.listener.context.currentTime;
    for (let i = 0; i < this.positional.length; i++) {
      if (this.positional[i].isPlaying) this.muffle(i, now, false);
    }
  }

  /** Where the ears are and which way the nose points (the listener's forward is -z, like the camera). */
  private readListener(): void {
    this.listener.getWorldPosition(listenerAt);
    this.listener.getWorldQuaternion(listenerTurn);
    forward.set(0, 0, -1).applyQuaternion(listenerTurn);
  }

  private muffle(index: number, now: number, snap: boolean): void {
    const B = SOUND_MIX.behind;
    const m = this.muffles[index];
    toSound.setFromMatrixPosition(this.positional[index].matrixWorld).sub(listenerAt);
    const length = toSound.length();
    // 0 in front and at the side, 1 straight behind.
    const behind = length > 1e-4 ? Math.max(0, -forward.dot(toSound) / length) : 0;
    if (!snap && Math.abs(behind - m.behind) < 0.01) return;
    m.behind = behind;
    // The cutoff slides evenly in pitch from all open down to B.lowpassHz.
    const hz = OPEN_HZ * Math.pow(B.lowpassHz / OPEN_HZ, behind);
    const volume = 1 - behind * (1 - B.volume);
    if (snap) {
      m.lowpass.frequency.cancelScheduledValues(now);
      m.gain.gain.cancelScheduledValues(now);
      m.lowpass.frequency.setValueAtTime(hz, now);
      m.gain.gain.setValueAtTime(volume, now);
    } else {
      m.lowpass.frequency.setTargetAtTime(hz, now, B.smoothing);
      m.gain.gain.setTargetAtTime(volume, now, B.smoothing);
    }
  }

  /** The player's group volumes changed: playing sounds follow at once (a group turned off stops), the music too. */
  private applySettings(): void {
    this.music.setVolume(this.settings.level('music'));
    const now = this.listener.context.currentTime;
    for (const [voice, playing] of this.playing) {
      if (!voice.isPlaying) continue;
      const level = this.settings.level(playing.category);
      if (level <= 0) {
        voice.stop();
        continue;
      }
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setTargetAtTime(playing.level * level, now, 0.03);
    }
  }

  private start(voice: Audio | PositionalAudio, def: SoundDef, buffer: AudioBuffer, volume: number, category: SoundCategory): void {
    const groupLevel = this.settings.level(category);
    if (groupLevel <= 0) return;
    this.playing.set(voice, { category, level: def.volume * volume });
    if (voice.isPlaying) voice.stop();
    voice.setBuffer(buffer);
    voice.duration = def.maxSeconds;
    const rate = this.rng.range(0.94, 1.06);
    voice.setPlaybackRate(rate);
    const level = def.volume * volume * groupLevel;
    const gain = voice.gain.gain;
    const now = this.listener.context.currentTime;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(level, now);
    // Long sounds (drums, horn, fanfare) fade out to nothing by their end instead of stopping dead.
    // Short cues keep their sharp ends, they are meant to catch the ear.
    const F = SOUND_MIX.fadeOut;
    const length = Math.min(def.maxSeconds ?? Infinity, buffer.duration) / rate;
    if (length >= F.longFrom) {
      const fade = Math.min(F.seconds, length * F.maxShare);
      gain.setValueAtTime(level, now + length - fade);
      gain.linearRampToValueAtTime(0, now + length);
    }
    voice.play();
  }
}
