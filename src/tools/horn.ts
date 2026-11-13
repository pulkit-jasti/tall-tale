// The war horn (v2, docs/v2-plan.md 2.3, replaces the megaphone): calls the
// field knights (src/units/troops.ts). Look, raise and blow (no lock step,
// changed 2026-11-11: the lips were too close to the headset for tracking):
//
//   1. Held anywhere, the head aims it: where the look meets a road, a
//      glowing pool, a light pillar, a ghost banner and the path the knights
//      will take along the roads show at once (src/ui/hornAim.ts).
//   2. Raised into the blow zone, a generous ball in front of the mouth
//      (HORN.zoneRadius around a point HORN.zoneForward ahead of the eyes
//      and HORN.zoneDown below them), from the lips out to a hand's length,
//      so it need not come close to the headset and tracking holds. Near the face the horn
//      fades to see-through (HORN.fade*), so the spot and path stay in view.
//   3. Blow: with the mic, only a real blow in the zone sends them (the raw
//      loudness of one frame over HORN.blowLevel is enough, shown live on a
//      bar in front of the eyes, the glass sign, src/ui/kit/glassSign.ts).
//      With the quiet horn setting or no mic, keeping it in the zone for
//      HORN.holdTime sends them (voice is never required, hard rule). The
//      knights go to the spot looked at a moment before the blow
//      (HORN_AIM.callLookBack), so a head that moves while blowing does not
//      move the spot.
//
// Its use window (and so the recharge) only starts when it sounds, never on
// the grab. One call per use, then it goes back and recharges.
import { Vector3, type MeshStandardMaterial } from 'three';
import { mic } from '../audio/mic.js';
import { HORN, TOOL_SPOTS } from '../config/game.js';
import { mark } from '../debug/perfMarks.js';
import { note } from '../debug/notes.js';
import { hornHearsMic } from '../player/accessSettings.js';
import { warHorn } from '../world/shapes.js';
import { HandTool, type ToolParts } from './handTool.js';

const world = new Vector3();
const mouthWorld = new Vector3();
const flatForward = new Vector3();
const zoneCenter = new Vector3();

export class Horn extends HandTool {
  private mouthpieceLocal = new Vector3();
  private bellLocal = new Vector3();
  /** Time held in the blow zone with a spot (seconds), and the mic's raw loudness this frame. */
  private inZoneTime = 0;
  /** Time out of the zone since it was last in (seconds), and how long the last loud frame still counts (seconds). */
  private outTime = 0;
  private loudLeft = 0;
  /** How long the mic has heard dead silence while held (seconds); past HORN.silentFallback it counts as broken. */
  private silentFor = 0;
  /** The mic hears nothing: the horn uses the quiet hold instead (the game shows why). */
  micSilent = false;
  private level = 0;
  private hears = false;
  private puffTimer = 0;
  private opacity = 1;
  /** The head and the way it looks (world), set by the game every frame. */
  readonly head = new Vector3();
  readonly headForward = new Vector3(0, 0, -1);
  /** The horn sounded (`blown`: into the mic, louder). The game sends the knights. */
  onCall: (blown: boolean) => void = () => {};
  /** True while the aim has a road spot a squad can go to (src/ui/hornAim.ts). Only then can it blow. */
  aimValid: () => boolean = () => true;
  /** Held and not yet sounded: the head aims it. */
  aiming = false;
  /** The mouthpiece is in the blow zone in front of the mouth (HORN.zoneRadius). */
  inZone = false;
  /** In the zone with a spot to send them to: a blow (or the quiet hold) sends the knights. */
  ready = false;
  /** How far the call is (0 to 1): the quiet hold, or the blow (the aim's pillar grows with it). */
  charge = 0;
  /** The horn lesson is still showing what the flag does: it does not call yet (set by the game every frame). */
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
    this.inZoneTime = 0;
    this.outTime = 0;
    this.inZone = false;
    this.ready = false;
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
    // Each grab says how the mic is (the debug page), so a silent mic shows why.
    if (this.aiming && !this.wasAiming) note(`[horn] grabbed: ${hornHearsMic() ? 'listening' : 'quiet hold'} (${mic.health()})`);
    this.wasAiming = this.aiming;
    if (!this.aiming) {
      this.inZone = false;
      this.ready = false;
      this.charge = 0;
      this.level = 0;
      this.silentFor = 0;
      this.micSilent = false;
      this.fade(1);
    }
  }

  private wasAiming = false;

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
    // The mic is read the whole time it is held, so it is awake by the time the horn is raised
    // (and the live bar, the glass sign, src/ui/kit/glassSign.ts, shows the real level at once).
    const wantsMic = hornHearsMic();
    if (wantsMic) {
      mic.ensureLive();
      // The raw loudness of this frame: the blow counts the moment it passes the line, even for one frame
      // (no smoothing, no holding it), and the bar shows the same number.
      this.level = mic.read();
    } else this.level = 0;
    // A mic that hears dead silence (a live one always hears a little room noise) has stopped working: the
    // horn falls back to the quiet hold for this hold, so calling the knights never breaks (2026-11-12:
    // the bar sat at zero on the headset). A note says so, with the mic's state, for the debug page.
    this.silentFor = wantsMic && this.level < HORN.silentLevel ? this.silentFor + dt : 0;
    if (this.silentFor >= HORN.silentFallback && !this.micSilent) {
      this.micSilent = true;
      note(`[horn] the mic hears nothing: hold to send instead (${mic.health()})`);
    }
    if (this.level >= HORN.silentLevel) this.micSilent = false;
    const hears = wantsMic && !this.micSilent;
    this.hears = hears;
    this.bodyToWorld(this.mouthpieceLocal, mouthWorld);
    const distance = mouthWorld.distanceTo(this.head);
    // Near the face it fades to see-through.
    const t = Math.min(1, Math.max(0, (distance - HORN.fadeNear) / (HORN.fadeFar - HORN.fadeNear)));
    this.fade(HORN.fadeOpacity + (1 - HORN.fadeOpacity) * t);
    // A loud frame is remembered a moment (HORN.blowMemory): a blow that starts just before the horn is in place still counts.
    this.loudLeft = hears && this.level >= HORN.blowLevel ? HORN.blowMemory : Math.max(0, this.loudLeft - dt);
    // The blow zone: a ball in front of the mouth, measured from the eyes with the look kept level, so looking
    // down at the board never moves it into the chest (fixed 2026-11-12: a cone from the eyes left out the
    // mouth itself, which sits below the eyes, so raising it to blow kept failing).
    flatForward.copy(this.headForward).setY(0);
    if (flatForward.lengthSq() < 1e-6) flatForward.set(0, 0, -1);
    flatForward.normalize();
    zoneCenter.copy(this.head).addScaledVector(flatForward, HORN.zoneForward);
    zoneCenter.y -= HORN.zoneDown;
    // Once in, it stays in a little farther out, and a short tracking dropout does not count as leaving.
    const inside = mouthWorld.distanceTo(zoneCenter) < HORN.zoneRadius + (this.inZone ? HORN.zoneExitMargin : 0);
    this.outTime = inside ? 0 : this.outTime + dt;
    if (!inside && (!this.inZone || this.outTime >= HORN.zoneGrace)) {
      this.resetMotion();
      return;
    }
    this.inZone = true;
    // In the zone but no road spot in sight (the spot and path show the moment one is): nothing counts.
    if (!this.aimValid()) {
      this.ready = false;
      this.inZoneTime = 0;
      this.charge = 0;
      return;
    }
    this.ready = true;
    // The lesson is still showing what the flag does: nothing counts yet.
    if (this.waiting) {
      this.inZoneTime = 0;
      this.charge = 0;
      return;
    }
    this.inZoneTime += dt;
    // With the mic only a real blow sends them; the quiet horn (or no mic) sends them after a short hold.
    let blown = false;
    if (hears) {
      // One frame over the line is a blow (headset test: holding it a while was too hard to hit), or one a moment ago.
      blown = this.loudLeft > 0;
      this.charge = Math.min(1, this.level / HORN.blowLevel);
    } else this.charge = Math.min(1, this.inZoneTime / HORN.holdTime);
    if (this.charge > 0) {
      this.puffTimer -= dt;
      if (this.puffTimer <= 0) {
        this.puffTimer = HORN.puffEvery;
        this.particles.burst(this.bodyToWorld(this.bellLocal, world), HORN.waveColors, 1, 0.08);
      }
    }
    if (blown || (!hears && this.inZoneTime >= HORN.holdTime)) this.sound(blown);
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
    // Done aiming from this frame on, so the aim shows the called spot instead (src/ui/hornAim.ts).
    this.aiming = false;
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
