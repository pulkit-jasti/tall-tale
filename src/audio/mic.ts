// The microphone, for the megaphone (docs/giant-tools.md): only its loudness,
// no speech recognition. Permission is asked on the 2D start page before
// entering VR (src/index.ts). Without it the bell comes instead of the
// megaphone and does the same job by shaking, so voice is never required.
//
// Web Audio API: the mic stream goes into an AnalyserNode (never to the
// speakers), and each frame reads the RMS of the latest samples.
import { AudioContext as ThreeAudioContext } from 'three';

export type MicState = 'unknown' | 'asking' | 'on' | 'denied' | 'unsupported';

const STORAGE_KEY = 'tallTale.micAsked';

export class Mic {
  state: MicState = 'unknown';
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  /** A reopen of the mic that is under way, so it only happens once at a time. */
  private reopening: Promise<void> | null = null;
  private samples: Float32Array<ArrayBuffer> | null = null;
  /** Loudness of the last read (RMS, 0 to 1). */
  level = 0;
  /** The loudest read since takePeak() (for the debug page, to tune the scream level). */
  private peak = 0;

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
    this.state = (await this.open()) ? 'on' : 'denied';
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // No storage: asked again next visit.
    }
    console.info(`[mic] ${this.state}`);
    return this.state;
  }

  /**
   * Keeps the mic working while the megaphone is held. The shared audio
   * context can be left suspended (after the Quest menu or the headset was
   * off), and the browser can end or mute the mic track while the app is in
   * the background: then the analyser only reads silence and screams do
   * nothing. This wakes the context and reopens the mic (no prompt, the
   * permission is already given). Cheap to call every frame.
   */
  ensureLive(): void {
    if (this.state !== 'on') return;
    const context = ThreeAudioContext.getContext();
    if (context.state === 'suspended') void context.resume();
    const track = this.stream?.getAudioTracks()[0];
    if (!track || track.readyState === 'ended' || !track.enabled) {
      if (this.reopening) return;
      console.info('[mic] the mic track stopped: opening it again');
      for (const t of this.stream?.getTracks() ?? []) t.stop();
      // It stays 'on' meanwhile, so the megaphone never swaps for the bell in the middle of a battle.
      this.reopening = this.open().then((ok) => {
        this.reopening = null;
        console.info(`[mic] reopened: ${ok ? 'on' : 'failed'}`);
      });
    }
  }

  /** Opens the mic stream into a silent analyser chain. False if the browser says no. */
  private async open(): Promise<boolean> {
    try {
      // Raw loudness: no gain control or noise suppression evening out a scream.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      this.stream = stream;
      const context = ThreeAudioContext.getContext();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      // Some browsers only run a node that leads to the speakers: a silent gain closes the chain, so nothing is heard.
      const silent = context.createGain();
      silent.gain.value = 0;
      analyser.connect(silent);
      silent.connect(context.destination);
      this.analyser = analyser;
      this.samples = new Float32Array(analyser.fftSize);
      return true;
    } catch (error) {
      console.info('[mic] not allowed: the bell comes instead of the megaphone', error);
      return false;
    }
  }

  /** Reads the loudness now (RMS of the latest samples). 0 without a mic. */
  read(): number {
    if (!this.analyser || !this.samples) return (this.level = 0);
    this.analyser.getFloatTimeDomainData(this.samples);
    let sum = 0;
    for (let i = 0; i < this.samples.length; i++) sum += this.samples[i] * this.samples[i];
    this.level = Math.sqrt(sum / this.samples.length);
    this.peak = Math.max(this.peak, this.level);
    return this.level;
  }

  /** The loudest level since the last call, then starts over. */
  takePeak(): number {
    const peak = this.peak;
    this.peak = 0;
    return peak;
  }

  /** Short text for the debug page. */
  describe(): string {
    if (!this.on) return this.state;
    return `on, peak ${this.takePeak().toFixed(3)}`;
  }
}

/** The one mic of the page. */
export const mic = new Mic();
