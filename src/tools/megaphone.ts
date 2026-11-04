// The megaphone (docs/giant-tools.md): the panic button. Grab it and scream:
// the mic loudness (src/audio/mic.ts) passing a fixed threshold stuns every
// goblin on the board. Screaming on makes the stun last longer. It is one use
// (6 food, free in the tutorial): after a short window it goes back to its
// platform. Without a mic it is tied down, and the bell beside it does the
// same by shaking, so voice is never required.
import { Vector3 } from 'three';
import { mic } from '../audio/mic.js';
import { MEGAPHONE, STUN, TOOL_SPOTS } from '../config/game.js';
import { megaphone } from '../world/shapes.js';
import { HandTool, type ToolParts } from './handTool.js';
import type { StunWave } from './stunWave.js';

const world = new Vector3();

export class Megaphone extends HandTool {
  private mouthLocal = new Vector3();
  private level = 0;
  private loudTime = 0;
  private screaming = false;
  private waveTimer = 0;

  constructor(
    parts: ToolParts,
    private stunWave: StunWave,
  ) {
    super(
      'megaphone',
      parts,
      TOOL_SPOTS.megaphone,
      { from: MEGAPHONE.gripFrom, to: MEGAPHONE.gripTo, radius: MEGAPHONE.grabRadius },
      0,
      MEGAPHONE.gripRadius + 1.2,
      // It owns the shared platform (with the bell) and its price tag, put toward the back, clear of the bell.
      { platform: TOOL_SPOTS.rightSide, platformWidth: TOOL_SPOTS.stunPlatformWidth, tagToBack: true },
    );
  }

  protected build(): void {
    const { group, materials, mouth } = megaphone();
    this.body.add(group);
    this.materials = materials;
    this.mouthLocal.copy(mouth);
  }

  protected resetMotion(): void {
    this.loudTime = 0;
    this.screaming = false;
  }

  protected heldUpdate(dt: number): void {
    // The loudness, smoothed a little so one click is not a scream.
    const raw = mic.read();
    this.level += (raw - this.level) * (1 - Math.exp(-dt / MEGAPHONE.levelSmoothing));
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
