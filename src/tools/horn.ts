// The war horn (v2, docs/v2-plan.md 2.3, replaces the megaphone): calls the
// field knights (src/units/troops.ts). Aim first, then lift and blow:
//
//   1. Held anywhere (not yet at the mouth), the head aims it: where the look
//      meets a road, a glowing pool, a light pillar and a ghost banner show
//      where the knights will go (src/ui/hornAim.ts). Nothing covers the view.
//   2. Lifted to the lips, the spot locks: the banner turns gold, a click, and
//      the path the knights will take lights up along the roads. Lowered
//      again, it unlocks. Near the face the horn fades to see-through
//      (HORN.fade*), so the gold banner and the path stay in view.
//   3. Blow: with the mic, only a real blow sends them (loudness over
//      HORN.blowLevel for about 0.3 s, shown live on a bar in front of the
//      eyes, the glass sign, src/ui/kit/glassSign.ts): holding it there never fires it, so
//      aiming is never cut short. With the quiet horn setting or no mic,
//      keeping it at the lips for HORN.holdTime sends them (voice is never
//      required, hard rule). The spot is locked by then, so a hold always
//      means "send".
//
// Its use window (and so the recharge) only starts when it sounds, never on
// the grab. One call per use, then it goes back and recharges.
import { Vector3, type MeshStandardMaterial } from 'three';
import { mic } from '../audio/mic.js';
import { HORN, TOOL_SPOTS } from '../config/game.js';
import { mark } from '../debug/perfMarks.js';
import { hornHearsMic } from '../player/accessSettings.js';
import { warHorn } from '../world/shapes.js';
import { HandTool, type ToolParts } from './handTool.js';

const world = new Vector3();
const mouthWorld = new Vector3();

export class Horn extends HandTool {
  private mouthpieceLocal = new Vector3();
  private bellLocal = new Vector3();
  /** Time locked at the lips, and the mic loudness over the blow level (seconds). */
  private atMouth = 0;
  private blowTime = 0;
  private level = 0;
  private hears = false;
  private puffTimer = 0;
  private opacity = 1;
  /** The head (world), set by the game every frame. */
  readonly head = new Vector3();
  /** The horn sounded (`blown`: into the mic, louder). The game sends the knights. */
  onCall: (blown: boolean) => void = () => {};
  /** True when a road spot is aimed at (src/ui/hornAim.ts). Without one it does not lock or blow. */
  aimOk: () => boolean = () => true;
  /** Held and not yet sounded: the head aims it. */
  aiming = false;
  /** At the lips with a spot aimed at: the spot is locked. */
  locked = false;
  /** How far the call is (0 to 1): the quiet hold, or the blow (the aim's pillar grows with it). */
  charge = 0;
  /** The horn lesson says "spot set" right now: it locks, but does not call yet (set by the game every frame). */
  waiting = false;

  constructor(parts: ToolParts) {
    // It rests standing on its bell (the curve ends below the grip), so its grip sits a little above the platform.
    super('horn', parts, TOOL_SPOTS.rightSide, { from: HORN.gripFrom, to: HORN.gripTo, radius: HORN.grabRadius }, 0, HORN.gripRadius + 1.2, {
      restLift: HORN.restLift,
    });
  }

  protected build(): void {
    const { group, materials, mouthpiece, bell } = warHorn();
    this.body.add(group);
    this.materials = materials;
    // It fades near the face, so its materials can be see-through.
    for (const m of materials) m.transparent = true;
    this.mouthpieceLocal.copy(mouthpiece);
    this.bellLocal.copy(bell);
  }

  protected resetMotion(): void {
    this.atMouth = 0;
    this.blowTime = 0;
    this.locked = false;
    this.charge = 0;
  }

  /** The mic loudness now (smoothed RMS), read while the horn is held. 0 without the mic. */
  get loudness(): number {
    return this.level;
  }

  /** True while held with the mic listening (not the quiet horn): a blow sends the knights. */
  get listening(): boolean {
    return this.aiming && this.hears;
  }

  /** The bell's middle (world). */
  bellWorld(out: Vector3): Vector3 {
    return this.bodyToWorld(this.bellLocal, out);
  }

  update(dt: number): void {
    // Not held (put back, shrinking after its call): not aiming, fully solid.
    this.aiming = false;
    super.update(dt);
    if (!this.aiming) {
      this.locked = false;
      this.charge = 0;
      this.level = 0;
      this.fade(1);
    }
  }

  /** Fades the horn toward HORN.fadeOpacity as it nears the face, so it never covers the view. */
  private fade(opacity: number): void {
    if (Math.abs(opacity - this.opacity) < 0.01) return;
    this.opacity = opacity;
    for (const m of this.materials as MeshStandardMaterial[]) {
      m.opacity = opacity;
      // See-through parts must not hide what is behind them.
      m.depthWrite = opacity > 0.98;
    }
  }

  protected heldUpdate(dt: number): void {
    // One call per use: after it sounded, nothing until it is back and recharged.
    if (this.active) {
      this.resetMotion();
      return;
    }
    // Held: the head aims it (src/ui/hornAim.ts), wherever the hand is.
    this.aiming = true;
    // The mic is read the whole time it is held, so it is awake by the time the horn reaches the lips
    // (and the live bar, the glass sign, src/ui/kit/glassSign.ts, shows the real level at once).
    const hears = hornHearsMic();
    this.hears = hears;
    if (hears) {
      mic.ensureLive();
      this.level += (mic.read() - this.level) * (1 - Math.exp(-dt / HORN.levelSmoothing));
    } else this.level = 0;
    this.bodyToWorld(this.mouthpieceLocal, mouthWorld);
    const distance = mouthWorld.distanceTo(this.head);
    // Near the face it fades to see-through.
    const t = Math.min(1, Math.max(0, (distance - HORN.fadeNear) / (HORN.fadeFar - HORN.fadeNear)));
    this.fade(HORN.fadeOpacity + (1 - HORN.fadeOpacity) * t);
    // At the lips with a spot aimed at: locked. Lowered (or no spot): unlocked, and nothing counts.
    if (distance >= HORN.mouthDistance || (!this.locked && !this.aimOk())) {
      this.resetMotion();
      return;
    }
    this.locked = true;
    // The lesson's "spot set" beat: locked, but nothing counts yet (the quiet hold starts after it).
    if (this.waiting) {
      this.atMouth = 0;
      this.blowTime = 0;
      this.charge = 0;
      return;
    }
    this.atMouth += dt;
    // With the mic only a real blow sends them; the quiet horn (or no mic) sends them after a short hold.
    let blown = false;
    if (hears) {
      this.blowTime = this.level > HORN.blowLevel ? this.blowTime + dt : 0;
      blown = this.blowTime >= HORN.blowHold;
      this.charge = Math.min(1, this.blowTime / HORN.blowHold);
    } else this.charge = Math.min(1, this.atMouth / HORN.holdTime);
    if (this.charge > 0) {
      this.puffTimer -= dt;
      if (this.puffTimer <= 0) {
        this.puffTimer = HORN.puffEvery;
        this.particles.burst(this.bodyToWorld(this.bellLocal, world), HORN.waveColors, 1, 0.08);
      }
    }
    if (blown || (!hears && this.atMouth >= HORN.holdTime)) this.sound(blown);
  }

  /** It sounds: the war horn, a burst from the bell, and the knights charge. */
  private sound(blown: boolean): void {
    if (!this.tryUse()) return;
    mark('horn');
    this.bodyToWorld(this.bellLocal, world);
    this.audio.play('waveHorn', world, blown ? HORN.blownVolume : HORN.heldVolume);
    this.particles.burst(world, HORN.waveColors, blown ? 16 : 10, 0.35);
    // The call goes out to the aimed spot first, then the aim is let go.
    this.onCall(blown);
    this.resetMotion();
    // Solid again for a moment as it sounds.
    this.fade(1);
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
