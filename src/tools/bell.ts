// The bell (docs/giant-tools.md, v2 in docs/v2-plan.md 2.3): the only stun.
// Rewritten from scratch (headset tests: it rang and nothing happened, more
// than once). Only the model (handBell in src/world/shapes.ts) is kept.
//
// Grab it with a fist and give it one quick swing: that is a ring.
//   - How a ring is found (second rewrite, after a speed check never rang):
//     Meta's docs (design "Hands Technology") say hands are tracked at 30 Hz
//     by default, quick shaky motion is smoothed, and fast motion can lose
//     tracking, so a measured speed stays low and gaps come in. And the bell
//     follows the hand with its own smoothing. So it reads the HAND itself
//     (its palm, in fixedRig cm, which never moves), only on frames where the
//     hand is really tracked, and looks at distance, not speed: a slow
//     "anchor" follows the hand (BELL.anchorSmoothing), and when the hand
//     gets BELL.ringOffset cm away from it, that is a ring. A quick flick or
//     swing gets far from the anchor; carrying it calmly does not (the anchor
//     keeps up). It must come back within BELL.rearmOffset before the next
//     ring (and BELL.ringGap passes), so one swing is one ring. Right after
//     the grab it waits BELL.grabQuiet.
//   - A ring that stuns: the game's onRing stuns every goblin on the board
//     (the shock ring runs out across it) and knocks the rampart goblins back
//     down (src/tools/stunWave.ts, Goblins.knockOffRampart). The first ring
//     starts the short use window; more rings while the stun still runs only
//     ring. When the window runs out it goes back and recharges.
//   - The sound plays last and on its own, so nothing it does can stop the stun.
// Every ring leaves a note on the debug page (src/debug/notes.ts) saying what it did.
import { Vector3 } from 'three';
import { BELL, STUN, TOOL_SPOTS } from '../config/game.js';
import { note } from '../debug/notes.js';
import type { HandState } from '../player/hands.js';
import { handBell } from '../world/shapes.js';
import { HandTool, type ToolParts } from './handTool.js';

const here = new Vector3();
const at = new Vector3();

export class Bell extends HandTool {
  /** The bell's middle in its own frame (from the model). */
  private middleLocal = new Vector3();
  /** The slow anchor that follows the hand (fixedRig cm), and if it is set yet. */
  private anchor = new Vector3();
  private hasAnchor = false;
  /** Back near the anchor since the last ring, so the next swing can ring. */
  private armed = true;
  /** Since the grab, and since the last ring (seconds). */
  private heldTime = 0;
  private sinceRing = Infinity;
  /** While held: the farthest the hand got from the anchor (cm), tracked frames, and rings (for the note when it is put down). */
  private topOffset = 0;
  private trackedFrames = 0;
  private rings = 0;

  /** True while a stun is running (set by the game). A ring then only rings. */
  stunning: () => boolean = () => false;
  /** A ring that stuns, at `where` (world) for `seconds`: the game stuns and knocks goblins down. Returns how many it hit. */
  onRing: (where: Vector3, seconds: number) => number = () => 0;

  constructor(parts: ToolParts) {
    super(
      'bell',
      parts,
      TOOL_SPOTS.leftMiddle,
      { from: BELL.gripFrom, to: BELL.gripTo, radius: BELL.grabRadius },
      0,
      BELL.bellMouth + 0.5,
      // Its mouth rests on the platform, the handle up.
      { restLift: BELL.bellHeight },
    );
  }

  protected build(): void {
    const { group, materials, middle } = handBell();
    this.body.add(group);
    this.materials = materials;
    this.middleLocal.copy(middle);
  }

  /** A note on each grab too: no "held" note after it means the swing was never measured. */
  grab(hand: HandState, viaPinch: boolean): void {
    super.grab(hand, viaPinch);
    note(`[bell] grabbed (${viaPinch ? 'pinch' : 'fist'})`);
  }

  protected resetMotion(): void {
    // Put down (or just grabbed): a note with how far it was swung while held, to tune BELL.ringOffset from real numbers.
    if (this.heldTime > 0.2) {
      note(
        `[bell] held ${this.heldTime.toFixed(1)} s, hand tracked ${this.trackedFrames} frames, ` +
          `farthest swing ${this.topOffset.toFixed(1)} cm (rings at ${BELL.ringOffset}), ${this.rings} rings`,
      );
    }
    this.topOffset = 0;
    this.trackedFrames = 0;
    this.rings = 0;
    this.hasAnchor = false;
    this.armed = true;
    this.heldTime = 0;
  }

  protected heldUpdate(dt: number): void {
    if (dt <= 0) return;
    this.heldTime += dt;
    this.sinceRing += dt;
    const hand = this.heldHand;
    // Only frames where the hand is really seen (not the short grace while tracking is lost).
    if (!hand || !hand.tracked || hand.lostTime > 0) return;
    this.trackedFrames++;
    this.stage.fixedRig.worldToLocal(here.copy(hand.palm));
    if (!this.hasAnchor) {
      this.anchor.copy(here);
      this.hasAnchor = true;
      return;
    }
    // The anchor follows slowly; the hand's distance from it is the swing.
    this.anchor.lerp(here, 1 - Math.exp(-dt / BELL.anchorSmoothing));
    const offset = here.distanceTo(this.anchor);
    // Still settling into the hand after the grab: no ring.
    if (this.heldTime < BELL.grabQuiet) return;
    this.topOffset = Math.max(this.topOffset, offset);
    if (!this.armed) {
      if (offset < BELL.rearmOffset) this.armed = true;
      return;
    }
    if (offset < BELL.ringOffset || this.sinceRing < BELL.ringGap) return;
    this.armed = false;
    this.sinceRing = 0;
    this.rings++;
    this.ring(offset);
  }

  /** One ring: the stun (if none is running and the bell is not resting), then the sound. `offset`: how far the swing went (cm). */
  private ring(offset: number): void {
    this.bodyToWorld(this.middleLocal, at);
    const hard = Math.min(1, Math.max(0, (offset - BELL.ringOffset) / (BELL.hardOffset - BELL.ringOffset)));
    if (this.stunning()) {
      note('[bell] ring: a stun is still running, no new one');
    } else if (this.tryUse()) {
      const seconds = STUN.baseSeconds + STUN.hardExtra * hard;
      const hit = this.onRing(at, seconds);
      note(`[bell] ring: stun ${seconds.toFixed(1)} s, ${hit} goblins (swing ${offset.toFixed(1)} cm)`);
      // A use counts even with no goblin about, so the bell lesson always ends.
      this.onUse(Math.max(1, hit));
    } else {
      note('[bell] ring: it is resting, no stun');
    }
    this.playSound(at, hard);
  }

  /** The ring sound, on its own: an error in it is noted and never stops anything else. */
  private playSound(where: Vector3, hard: number): void {
    try {
      this.audio.play('bell', where, 0.6 + 0.4 * hard);
    } catch (error) {
      note(`[bell] sound failed: ${String(error)}`);
    }
  }

  /** Debug page: a hard ring without hands (a recharging bell is made ready first). */
  debugRing(): void {
    if (!this.debugStart()) return;
    this.bodyToWorld(this.middleLocal, at);
    const hit = this.onRing(at, STUN.baseSeconds + STUN.hardExtra);
    note(`[bell] debug ring: ${hit} goblins`);
    this.onUse(Math.max(1, hit));
    this.playSound(at, 1);
  }
}
