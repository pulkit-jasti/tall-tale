// The megaphone (docs/giant-tools.md): the panic button. Grab it and scream:
// the mic loudness (src/audio/mic.ts) passing a fixed threshold stuns every
// goblin on the board. Screaming on makes the stun last longer. It is one use
// (6 food, free in the tutorial): after a short window it goes back to its
// platform. Without a mic the bell comes instead and does the same by
// shaking, so voice is never required.
//
// While it is held, a thin loudness meter on top of the cone fills in real
// time as the player gets louder. A pulsing red dot marks the scream level:
// fill the bar past the dot to stun.
import { Color, Vector3 } from 'three';
import { mic } from '../audio/mic.js';
import { MEGAPHONE, STUN, TOOL_SPOTS } from '../config/game.js';
import { megaphone, megaphoneMeter } from '../world/shapes.js';
import { HandTool, type ToolParts } from './handTool.js';
import type { StunWave } from './stunWave.js';

const world = new Vector3();
const low = new Color(MEGAPHONE.meterLowColor);
const high = new Color(MEGAPHONE.meterHighColor);
const full = new Color(MEGAPHONE.meterFullColor);

export class Megaphone extends HandTool {
  private mouthLocal = new Vector3();
  private level = 0;
  private loudTime = 0;
  private screaming = false;
  private waveTimer = 0;
  private meter!: ReturnType<typeof megaphoneMeter>;
  /** What the meter shows (0 to 1): rises at once, falls back slowly. */
  private shown = 0;

  constructor(
    parts: ToolParts,
    private stunWave: StunWave,
  ) {
    super(
      'megaphone',
      parts,
      TOOL_SPOTS.rightSide,
      { from: MEGAPHONE.gripFrom, to: MEGAPHONE.gripTo, radius: MEGAPHONE.grabRadius },
      0,
      MEGAPHONE.gripRadius + 1.2,
    );
  }

  protected build(): void {
    const { group, materials, mouth } = megaphone();
    this.body.add(group);
    this.materials = materials;
    this.mouthLocal.copy(mouth);
    this.meter = megaphoneMeter();
    this.meter.group.visible = false;
    this.body.add(this.meter.group);
  }

  protected resetMotion(): void {
    this.loudTime = 0;
    this.screaming = false;
    this.shown = 0;
    if (this.meter) this.meter.group.visible = false;
  }

  /** The meter: the bar's length, its color (green, yellow near the dot, red past it), the dot's pulse. */
  private showMeter(dt: number): void {
    const { group, fill, target } = this.meter;
    group.visible = true;
    const share = Math.min(1, (this.level / MEGAPHONE.screamLevel) * MEGAPHONE.targetShare);
    this.shown = share > this.shown ? share : Math.max(share, this.shown - dt / MEGAPHONE.meterFall);
    fill.scale.z = Math.max(0.001, this.shown * (fill.userData.length as number));
    const past = this.shown >= MEGAPHONE.targetShare;
    const t = Math.min(1, this.shown / MEGAPHONE.targetShare);
    fill.material.color.copy(past ? full : low).lerp(high, past ? 0 : t * t);
    // The dot pulses to catch the eye, and pops big while the scream is on.
    const pulse = past ? 1.6 + 0.3 * Math.sin(this.time * 30) : 1 + 0.25 * Math.sin(this.time * 8);
    target.scale.setScalar(pulse);
  }

  protected heldUpdate(dt: number): void {
    // The mic must be live (the audio may have been paused, or the browser stopped the mic in the background).
    mic.ensureLive();
    // The loudness, smoothed a little so one click is not a scream.
    const raw = mic.read();
    this.level += (raw - this.level) * (1 - Math.exp(-dt / MEGAPHONE.levelSmoothing));
    this.showMeter(dt);
    this.loudTime = this.level > MEGAPHONE.screamLevel ? this.loudTime + dt : 0;
    if (this.loudTime < MEGAPHONE.screamHold) {
      this.screaming = false;
      return;
    }
    if (!this.screaming) {
      this.screaming = true;
      if (!this.tryUse()) return;
      this.onUse(this.stunWave.stun(STUN.baseSeconds, this.bodyToWorld(this.mouthLocal, world)));
    } else if (this.active) {
      // Louder screams add more, up to twice as fast.
      const loud = Math.min(2, this.level / MEGAPHONE.screamLevel);
      this.stunWave.extend(STUN.extraPerSecond * loud * dt);
    }
    this.waveTimer -= dt;
    if (this.waveTimer <= 0) {
      this.waveTimer = MEGAPHONE.waveEvery;
      this.particles.burst(this.bodyToWorld(this.mouthLocal, world), MEGAPHONE.waveColors, 4, 0.3);
    }
  }

  /** Debug: a scream without a mic or hands. Pays the food like a real one, even when tied down. */
  debugScream(): void {
    const tied = this.tiedDown;
    this.tiedDown = false;
    const ok = this.debugStart();
    this.tiedDown = tied;
    if (!ok) return;
    this.onUse(this.stunWave.stun(STUN.baseSeconds + STUN.hardExtra, this.bodyToWorld(this.mouthLocal, world)));
  }
}
