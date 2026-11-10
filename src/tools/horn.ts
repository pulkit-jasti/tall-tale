// The war horn (v2, docs/v2-plan.md 2.3, replaces the megaphone): calls the
// field knights (src/units/troops.ts). Grab it and bring it to the mouth:
//
//   - Held at the mouth for a moment (HORN.holdTime), it blows. No mic is
//     needed, so it is accessible (hard rule: voice is never required).
//   - Blowing into the mic while it is at the mouth blows it at once and
//     louder. A blow counts only while the horn is at the mouth and the
//     loudness stays over a low threshold for about 0.3 s, so talking or room
//     noise does not trigger it. The quiet horn setting never listens.
//
// A breath meter on top of the horn fills while it is at the mouth, so it
// reads with the sound off. One call per use, then it goes back and recharges.
import { Vector3 } from 'three';
import { mic } from '../audio/mic.js';
import { HORN, TOOL_SPOTS } from '../config/game.js';
import { mark } from '../debug/perfMarks.js';
import { hornHearsMic } from '../player/accessSettings.js';
import { hornMeter, warHorn } from '../world/shapes.js';
import { HandTool, type ToolParts } from './handTool.js';

const world = new Vector3();
const mouthWorld = new Vector3();

export class Horn extends HandTool {
  private mouthpieceLocal = new Vector3();
  private bellLocal = new Vector3();
  private meter!: ReturnType<typeof hornMeter>;
  /** Time the mouthpiece has been at the mouth, and the mic loudness over the blow level (seconds). */
  private atMouth = 0;
  private blowTime = 0;
  private level = 0;
  private puffTimer = 0;
  /** The head (world), set by the game every frame. */
  readonly head = new Vector3();
  /** The horn sounded (`blown`: into the mic, louder). The game sends the knights. */
  onCall: (blown: boolean) => void = () => {};

  constructor(parts: ToolParts) {
    super('horn', parts, TOOL_SPOTS.rightSide, { from: HORN.gripFrom, to: HORN.gripTo, radius: HORN.grabRadius }, 0, HORN.gripRadius + 1.2);
  }

  protected build(): void {
    const { group, materials, mouthpiece, bell } = warHorn();
    this.body.add(group);
    this.materials = materials;
    this.mouthpieceLocal.copy(mouthpiece);
    this.bellLocal.copy(bell);
    this.meter = hornMeter();
    this.meter.group.visible = false;
    this.body.add(this.meter.group);
  }

  protected resetMotion(): void {
    this.atMouth = 0;
    this.blowTime = 0;
    this.level = 0;
    if (this.meter) this.meter.group.visible = false;
  }

  protected heldUpdate(dt: number): void {
    // One call per use: after it sounded, nothing until it is back and recharged.
    if (this.active) {
      this.meter.group.visible = false;
      return;
    }
    this.bodyToWorld(this.mouthpieceLocal, mouthWorld);
    const near = mouthWorld.distanceTo(this.head) < HORN.mouthDistance;
    if (!near) {
      this.resetMotion();
      return;
    }
    this.atMouth += dt;
    // The mic (only while it is at the mouth, so talking elsewhere never counts).
    let blown = false;
    if (hornHearsMic()) {
      mic.ensureLive();
      this.level += (mic.read() - this.level) * (1 - Math.exp(-dt / HORN.levelSmoothing));
      this.blowTime = this.level > HORN.blowLevel ? this.blowTime + dt : 0;
      blown = this.blowTime >= HORN.blowHold;
    }
    // The breath meter: holding fills it over holdTime, blowing jumps it.
    const share = Math.min(1, Math.max(this.atMouth / HORN.holdTime, this.blowTime / HORN.blowHold));
    const { group, fill } = this.meter;
    group.visible = true;
    fill.scale.z = Math.max(0.001, share * (fill.userData.length as number));
    fill.material.color.setHex(share >= 1 ? HORN.meterFullColor : HORN.meterLowColor);
    this.puffTimer -= dt;
    if (this.puffTimer <= 0) {
      this.puffTimer = HORN.puffEvery;
      this.particles.burst(this.bodyToWorld(this.bellLocal, world), HORN.waveColors, 1, 0.08);
    }
    if (blown || this.atMouth >= HORN.holdTime) this.sound(blown);
  }

  /** It sounds: the war horn, a burst from the bell, and the knights charge. */
  private sound(blown: boolean): void {
    if (!this.tryUse()) return;
    mark('horn');
    this.bodyToWorld(this.bellLocal, world);
    this.audio.play('waveHorn', world, blown ? HORN.blownVolume : HORN.heldVolume);
    this.particles.burst(world, HORN.waveColors, blown ? 16 : 10, 0.35);
    this.resetMotion();
    this.onCall(blown);
    this.onUse(1);
  }

  /** Debug: the horn sounds without hands or a mic (a recharging horn is made ready first). */
  debugBlow(): void {
    if (!this.debugStart()) return;
    this.bodyToWorld(this.bellLocal, world);
    this.audio.play('waveHorn', world, HORN.blownVolume);
    this.particles.burst(world, HORN.waveColors, 16, 0.35);
    this.onCall(true);
    this.onUse(1);
  }
}
