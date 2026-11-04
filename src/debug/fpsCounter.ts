// Live frame rate panel, to check performance while playing in the headset.
//
// Two parts:
//   Live (top): FPS and the worst frame of the last half second, to spot moments.
//   Measured run (bottom): the numbers to compare and optimize. A run starts
//   fresh on every reset (stress test, clearing goblins, pause, or by hand),
//   skips a short warm-up, then measures:
//     avg fps   frames / time over the run
//     1% low    average of the slowest 1% of frames (last minute), as FPS
//     missed    share of frames longer than 1.5 frame budgets. In the headset
//               these are likely stale frames (judder), the thing to avoid most.
//
// A tiny canvas texture redrawn twice a second, so it costs almost nothing. It
// lives in boardLift: it rises with the board but never spins.
import { CanvasTexture, Mesh, MeshBasicMaterial, type Object3D, PlaneGeometry, SRGBColorSpace } from 'three';
import { FPS, HANDLES } from '../config/game.js';
import { degToRad, polarX, polarZ } from '../rules/boardMath.js';
import type { RunStats } from './debugKeys.js';
import { mark, takeMarks, type PerfMark } from './perfMarks.js';
import { PAGE } from './remote.js';

const GOOD = '#7ddf64';
const OK = '#f2c14e';
const BAD = '#ff5a4e';
const TEXT = '#ddd6c8';
const DIM = '#9c9284';

export class FpsCounter {
  /** Shown on the live line ("paused" while the Quest menu is open). */
  status = '';
  /** Counts the units on the board, read only when the panel redraws. */
  countUnits: () => number = () => 0;
  /** Called with the run numbers about once a second, and with the final numbers on reset. */
  onReport: (stats: RunStats) => void = () => {};

  private mesh: Mesh;
  private canvas = document.createElement('canvas');
  private context: CanvasRenderingContext2D;
  private texture: CanvasTexture;
  /** Frame rate to aim for. The game sets it from the XR session's real rate in VR. */
  target = FPS.target;

  // Live window.
  private frames = 0;
  private elapsed = 0;
  private worst = 0;
  private liveFps: number | null = null;
  private liveWorstMs = 0;

  // Measured run.
  private warmup = FPS.warmup;
  private runFrames = 0;
  private runTime = 0;
  private runMissed = 0;
  /** What came before each missed frame in this run (mark name to count). */
  private causes = new Map<string, number>();
  private slowestMs = 0;
  private frameMarks: PerfMark[] = [];
  private drawTimer = 0;
  private lastDrawn = '';
  /** Visibility to restore after the stress test hid the panel. */
  private shownBeforeTest: boolean | null = null;
  /** Recent frame times (seconds) for the 1% low, as a ring buffer. */
  private times = new Float32Array(FPS.lowWindow * FPS.maxRefresh);
  private timesCount = 0;
  private timesNext = 0;
  private sorted = new Float32Array(FPS.lowWindow * FPS.maxRefresh);
  private lowFps = 0;
  private rawLowFps = 0;
  private reportTimer = 0;

  constructor(parent: Object3D) {
    this.canvas.width = 384;
    this.canvas.height = 192;
    this.context = this.canvas.getContext('2d')!;
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    const material = new MeshBasicMaterial({ map: this.texture, transparent: true, fog: false, toneMapped: false });
    this.mesh = new Mesh(new PlaneGeometry(FPS.width, FPS.height), material);
    const a = degToRad(FPS.angleDeg);
    const y = HANDLES.ringY + HANDLES.ringRadius + FPS.aboveRing + FPS.height / 2;
    this.mesh.position.set(polarX(FPS.radius, a), y, polarZ(FPS.radius, a));
    // The plane faces +z. Point it at the center (the player).
    this.mesh.rotation.y = -a;
    this.mesh.visible = (import.meta.env.DEV && FPS.showInDev) || new URLSearchParams(location.search).has('fps');
    parent.add(this.mesh);
    this.draw();
  }

  /** Live FPS of the last half second (0 before the first one). */
  get live(): number {
    return this.liveFps ?? 0;
  }

  /** The current measured run, or null while warming up or empty. */
  currentRun(): RunStats | null {
    return this.warmup > 0 || this.runFrames === 0 ? null : this.stats(false);
  }

  toggle(): void {
    this.mesh.visible = !this.mesh.visible;
  }

  /** The stress test hides the panel while it measures (its redraws cost a little), then puts it back. */
  hideForTest(hide: boolean): void {
    if (hide) {
      if (this.shownBeforeTest === null) this.shownBeforeTest = this.mesh.visible;
      this.mesh.visible = false;
    } else if (this.shownBeforeTest !== null) {
      this.mesh.visible = this.shownBeforeTest;
      this.shownBeforeTest = null;
      this.lastDrawn = '';
    }
  }

  /**
   * Ends the current run (reporting its final numbers) and starts a new one
   * after the warm-up plus `extraWarmup` seconds.
   */
  resetRun(extraWarmup = 0): void {
    if (this.runFrames > 0) this.onReport(this.stats(true));
    this.warmup = FPS.warmup + extraWarmup;
    this.runFrames = 0;
    this.runTime = 0;
    this.runMissed = 0;
    this.causes.clear();
    this.slowestMs = 0;
    this.timesCount = 0;
    this.timesNext = 0;
    this.lowFps = 0;
    this.rawLowFps = 0;
    this.reportTimer = 0;
  }

  /**
   * `delta`: the real frame time (seconds), not the clamped game step.
   * `measure`: false while paused, so menu frames never count.
   */
  update(delta: number, measure: boolean): void {
    // Marks since the last call belong to the frame that `delta` measured.
    takeMarks(this.frameMarks);
    this.frames++;
    this.elapsed += delta;
    this.worst = Math.max(this.worst, delta);
    if (measure) this.measure(delta);

    if (this.elapsed < FPS.refresh) return;
    this.liveFps = this.frames / this.elapsed;
    this.liveWorstMs = this.worst * 1000;
    this.frames = 0;
    this.elapsed = 0;
    this.worst = 0;
    if (this.runFrames > 0) this.updateLow();
    // The canvas upload to the GPU can cause a hitch, so redraw rarely and
    // only when the text changed.
    this.drawTimer -= FPS.refresh;
    if (this.mesh.visible && this.drawTimer <= 0) {
      this.drawTimer = FPS.drawEvery;
      this.draw();
    }
  }

  private measure(delta: number): void {
    if (this.warmup > 0) {
      this.warmup -= delta;
      return;
    }
    this.runFrames++;
    this.runTime += delta;
    this.slowestMs = Math.max(this.slowestMs, delta * 1000);
    if (delta > FPS.missedFactor / this.target) {
      this.runMissed++;
      if (this.frameMarks.length === 0) this.causes.set('nothing marked', (this.causes.get('nothing marked') ?? 0) + 1);
      for (const m of this.frameMarks) this.causes.set(m, (this.causes.get(m) ?? 0) + 1);
    }
    this.times[this.timesNext] = delta;
    this.timesNext = (this.timesNext + 1) % this.times.length;
    this.timesCount = Math.min(this.timesCount + 1, this.times.length);
    this.reportTimer += delta;
    if (this.reportTimer >= FPS.reportEvery) {
      this.reportTimer = 0;
      this.onReport(this.stats(false));
    }
  }

  /** Average of the slowest 1% of recent frames, as FPS. */
  /**
   * Average of the slowest 1% of recent frames, as FPS, two ways:
   *   low: each frame rounded to whole display beats (1 beat = on time,
   *     2 = one frame dropped). The headset only shows frames on its beat, so
   *     this ignores the page clock's wobble of a ms or two and still counts
   *     real drops. This is the one the pass rule uses.
   *   raw: the clock's frame times as measured, for information.
   */
  private computeLow(): { low: number; raw: number } {
    const n = this.timesCount;
    if (n === 0) return { low: 0, raw: 0 };
    const view = this.sorted.subarray(0, n);
    view.set(this.times.subarray(0, n));
    view.sort();
    const slowest = Math.max(1, Math.floor(n * 0.01));
    const beat = 1 / this.target;
    let raw = 0;
    let beats = 0;
    for (let i = n - slowest; i < n; i++) {
      raw += view[i];
      beats += Math.max(1, Math.round(view[i] / beat));
    }
    return { low: slowest / (beats * beat), raw: slowest / raw };
  }

  private updateLow(): void {
    const { low, raw } = this.computeLow();
    this.lowFps = low;
    this.rawLowFps = raw;
  }

  private stats(final: boolean): RunStats {
    if (final || this.lowFps === 0) this.updateLow();
    return {
      page: PAGE.id,
      device: PAGE.device,
      targetFps: this.target,
      units: this.countUnits(),
      seconds: this.runTime,
      avgFps: this.runTime > 0 ? this.runFrames / this.runTime : 0,
      lowFps: this.lowFps,
      rawLowFps: this.rawLowFps,
      missedPct: this.runFrames > 0 ? (this.runMissed / this.runFrames) * 100 : 0,
      missed: this.runMissed,
      slowestMs: this.slowestMs,
      causes: Object.fromEntries(this.causes),
      final,
    };
  }

  private color(fps: number): string {
    return fps >= this.target * 0.95 ? GOOD : fps >= this.target * 0.8 ? OK : BAD;
  }

  private draw(): void {
    const warming = this.warmup > 0 || this.runFrames === 0;
    const s = warming ? null : this.stats(false);
    const units = this.countUnits();
    // Skip the redraw (and its GPU upload) when nothing on the panel changed.
    const key = [
      this.liveFps === null ? -1 : Math.round(this.liveFps),
      this.liveWorstMs.toFixed(0),
      units,
      this.status,
      warming ? Math.max(0, this.warmup).toFixed(0) : '',
      s ? `${s.seconds.toFixed(0)} ${s.avgFps.toFixed(1)} ${s.lowFps.toFixed(0)} ${s.missedPct.toFixed(1)}` : '',
    ].join('|');
    if (key === this.lastDrawn) return;
    this.lastDrawn = key;
    mark('panel redraw');

    const c = this.context;
    const { width, height } = this.canvas;
    c.clearRect(0, 0, width, height);
    c.fillStyle = 'rgba(20, 16, 12, 0.75)';
    c.beginPath();
    c.roundRect(0, 0, width, height, 18);
    c.fill();
    c.textBaseline = 'middle';

    // Live.
    c.fillStyle = this.liveFps === null ? OK : this.color(this.liveFps);
    c.font = 'bold 44px sans-serif';
    c.fillText(this.liveFps === null ? '-- fps' : `${Math.round(this.liveFps)} fps`, 16, 32);
    c.fillStyle = TEXT;
    c.font = '22px sans-serif';
    c.fillText(`worst ${this.liveWorstMs.toFixed(0)} ms`, 190, 24);
    c.fillText(`${units} units  ${this.status}`, 190, 48);

    // Measured run.
    c.fillStyle = DIM;
    c.fillRect(16, 70, width - 32, 2);
    if (!s) {
      c.fillStyle = DIM;
      c.font = '22px sans-serif';
      c.fillText(`run: warming up ${Math.max(0, this.warmup).toFixed(0)} s`, 16, 96);
      this.texture.needsUpdate = true;
      return;
    }
    c.font = '22px sans-serif';
    c.fillStyle = DIM;
    c.fillText(`run ${s.seconds.toFixed(0)} s`, 16, 96);
    c.fillText('avg', 16, 136);
    c.fillText('1% low', 140, 136);
    c.fillText('missed', 270, 136);
    c.font = 'bold 34px sans-serif';
    c.fillStyle = this.color(s.avgFps);
    c.fillText(s.avgFps.toFixed(1), 16, 168);
    c.fillStyle = this.color(s.lowFps);
    c.fillText(s.lowFps.toFixed(0), 140, 168);
    c.fillStyle = s.missedPct < 1 ? GOOD : s.missedPct < 5 ? OK : BAD;
    c.fillText(`${s.missedPct.toFixed(1)}%`, 270, 168);
    this.texture.needsUpdate = true;
  }
}
