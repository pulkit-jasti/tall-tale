// The microphone, for the megaphone (docs/giant-tools.md): only its loudness,
// no speech recognition. Permission is asked on the 2D start page before
// entering VR (src/index.ts). Without it the megaphone is tied down and the
// bell does the same job, so voice is never required.
//
// Web Audio API: the mic stream goes into an AnalyserNode (never to the
// speakers), and each frame reads the RMS of the latest samples.
import { AudioContext as ThreeAudioContext } from 'three';

export type MicState = 'unknown' | 'asking' | 'on' | 'denied' | 'unsupported';

const STORAGE_KEY = 'tallTale.micAsked';

export class Mic {
  state: MicState = 'unknown';
  private analyser: AnalyserNode | null = null;
  private samples: Float32Array<ArrayBuffer> | null = null;
  /** Loudness of the last read (RMS, 0 to 1). */
  level = 0;

  get on(): boolean {
    return this.state === 'on';
  }

  /** True when the browser can give a mic at all. */
  get supported(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  }

  /**
   * True if asking now would show no prompt: permission was given before
   * (Permissions API), so the start page can open the mic and enter VR with
   * one tap.
   */
  async alreadyAllowed(): Promise<boolean> {
    try {
      const status = await navigator.permissions?.query({ name: 'microphone' as PermissionName });
      if (status?.state === 'denied') this.state = 'denied';
      return status?.state === 'granted';
    } catch {
      return false;
    }
  }

  /** True once this browser was asked before (granted or not), so the start page does not ask on every visit. */
  get askedBefore(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }

  /** Asks for the mic (the browser shows its prompt the first time). Resolves with the result, never throws. */
  async request(): Promise<MicState> {
    if (this.state === 'on') return this.state;
    if (!this.supported) {
      this.state = 'unsupported';
      return this.state;
    }
    this.state = 'asking';
    try {
      // Raw loudness: no gain control or noise suppression evening out a scream.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      const context = ThreeAudioContext.getContext();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      this.analyser = analyser;
      this.samples = new Float32Array(analyser.fftSize);
      this.state = 'on';
    } catch (error) {
      console.info('[mic] not allowed, the megaphone is tied down (the bell still works)', error);
      this.state = 'denied';
    }
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // No storage: asked again next visit.
    }
    console.info(`[mic] ${this.state}`);
    return this.state;
  }

  /** Reads the loudness now (RMS of the latest samples). 0 without a mic. */
  read(): number {
    if (!this.analyser || !this.samples) return (this.level = 0);
    this.analyser.getFloatTimeDomainData(this.samples);
    let sum = 0;
    for (let i = 0; i < this.samples.length; i++) sum += this.samples[i] * this.samples[i];
    this.level = Math.sqrt(sum / this.samples.length);
    return this.level;
  }
}

/** The one mic of the page. */
export const mic = new Mic();
