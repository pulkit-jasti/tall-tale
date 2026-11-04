// What the bare hands do: pinch a goblin to pick it up and hold it near the
// mouth to eat it (no letting go, no head tilt, so the palm never has to face
// the headset and open the Quest menu). Fist or pinch grabs the ring handle.
// Only the nearest thing in range of each hand shows Ready.
import { Vector3 } from 'three';
import type { GameAudio } from '../audio/sound.js';
import { EAT, HANDLES, HANDS } from '../config/game.js';
import type { Particles } from '../fx/particles.js';
import type { Goblin, Goblins } from '../units/goblins.js';
import type { BoardHandles } from './handles.js';
import type { HandState, HandTracker } from './hands.js';

type Target = { kind: 'goblin'; goblin: Goblin } | { kind: 'ring' } | null;

interface HandSlot {
  held: Goblin | null;
  target: Target;
  inEatZone: boolean;
  /** Time the held goblin has been near the mouth (seconds). */
  eatTimer: number;
  /** Time the open hand has been in the ring's grab zone (seconds). */
  ringOpenTime: number;
}

const EAT_COLORS = [0x6a8f3a, 0x8fb04a, 0xffffff, 0xf2c14e];
const forward = new Vector3();
const burstAt = new Vector3();

export class GrabEat {
  private slots = new Map<HandState, HandSlot>();
  private readyGoblins = new Set<Goblin>();
  private pendingGulp = -1;
  private time = 0;
  /** Called with each eaten goblin (food comes in build step 4). */
  onEat: (goblin: Goblin) => void = () => {};

  constructor(
    private hands: HandTracker,
    private goblins: Goblins,
    private handles: BoardHandles,
    private audio: GameAudio,
    private particles: Particles,
  ) {
    for (const hand of hands.hands) this.slots.set(hand, { held: null, target: null, inEatZone: false, eatTimer: 0, ringOpenTime: 0 });
  }

  update(dt: number, headPosition: Vector3, headForward: Vector3): void {
    this.time += dt;
    const nowReady = new Set<Goblin>();
    let ringReady = false;

    for (const hand of this.hands.hands) {
      const slot = this.slots.get(hand)!;

      if (slot.held) {
        const goblin = slot.held;
        this.goblins.holdAt(goblin, hand.pinchPoint, headPosition, dt);
        const mouth = hand.pinchPoint.distanceTo(headPosition);
        const inZone = mouth < EAT.mouthDistance;
        if (inZone && !slot.inEatZone) this.audio.play('readyTick');
        slot.inEatZone = inZone;
        slot.eatTimer = inZone ? slot.eatTimer + dt : 0;
        // Near the mouth the goblin pulses white, otherwise it shows Held.
        const pulse = Math.sin(this.time * 18) > 0;
        this.goblins.setTouch(goblin, inZone && pulse ? 'ready' : 'held');
        const letGo = hand.pinch.ended || !hand.pinch.on;
        // Held near the mouth for a moment: eaten. If the pinch breaks close to
        // the face (tracking or the Quest menu gesture), it is eaten too.
        if (slot.eatTimer >= EAT.holdTime || (letGo && mouth < EAT.graceDistance)) {
          this.eat(goblin, headPosition, headForward);
          this.clearHeld(slot);
        } else if (letGo) {
          this.goblins.drop(goblin);
          this.clearHeld(slot);
        }
        continue;
      }

      // The ring handle lets go by itself (see BoardHandles.update).
      if (this.handles.isHeldBy(hand)) continue;

      const target = this.findTarget(hand);
      if (!sameTarget(target, slot.target) && target?.kind === 'goblin') this.audio.play('readyTick', undefined, 1, 0.05);
      slot.target = target;

      // The ring only grabs after the hand was open in its zone for a moment,
      // so a hand that curls up while resting or drifting by never grabs it.
      const wasRingReady = slot.ringOpenTime >= HANDLES.readyTime;
      if (target?.kind !== 'ring') slot.ringOpenTime = 0;
      else if (!hand.pinch.on && !hand.fist.on) slot.ringOpenTime += dt;
      const ringArmed = slot.ringOpenTime >= HANDLES.readyTime;
      if (ringArmed && !wasRingReady) this.audio.play('readyTick', undefined, 1, 0.05);

      if (target?.kind === 'goblin') {
        if (hand.pinch.started) {
          slot.held = target.goblin;
          slot.target = null;
          this.goblins.grab(target.goblin);
          this.goblins.setTouch(target.goblin, 'held');
          continue;
        }
        nowReady.add(target.goblin);
      } else if (target?.kind === 'ring' && ringArmed) {
        if ((hand.fist.started || hand.pinch.started) && !this.handles.busy) {
          this.handles.grab(hand, !hand.fist.started);
          this.audio.play('grab', hand.palm);
          slot.target = null;
          slot.ringOpenTime = 0;
          continue;
        }
        ringReady = true;
      }
    }

    for (const goblin of this.readyGoblins) {
      if (!nowReady.has(goblin) && goblin.mode !== 'held') this.goblins.setTouch(goblin, 'idle');
    }
    for (const goblin of nowReady) this.goblins.setTouch(goblin, 'ready');
    this.readyGoblins = nowReady;
    this.handles.setReady(ringReady);

    if (this.pendingGulp > 0) {
      this.pendingGulp -= dt;
      if (this.pendingGulp <= 0) this.audio.play('gulp');
    }
  }

  private findTarget(hand: HandState): Target {
    if (!hand.tracked) return null;
    const goblin = this.goblins.nearestGrabbable(hand.pinchPoint, HANDS.pinchRadius);
    // A goblin in pinch range always wins, so reaching for one never grabs the ring.
    if (goblin) return { kind: 'goblin', goblin };
    const ring = this.handles.busy ? null : this.handles.reach(hand);
    return ring !== null ? { kind: 'ring' } : null;
  }

  private clearHeld(slot: HandSlot): void {
    slot.held = null;
    slot.inEatZone = false;
    slot.eatTimer = 0;
  }

  /** Chomp: the goblin is gone, with a sound and crumbs in front of the face. */
  eat(goblin: Goblin, headPosition: Vector3, headForward: Vector3): void {
    this.goblins.setTouch(goblin, 'idle');
    this.goblins.kill(goblin);
    forward.copy(headForward);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
    forward.normalize();
    burstAt.copy(headPosition).addScaledVector(forward, EAT.burstForward);
    burstAt.y -= EAT.burstDown;
    this.particles.burst(burstAt, EAT_COLORS, 14);
    this.audio.play('chomp');
    this.pendingGulp = 0.35;
    this.onEat(goblin);
  }

  /** Debug: eat the goblin nearest to the front of the wall without hands. */
  debugEat(headPosition: Vector3, headForward: Vector3): void {
    forward.copy(headForward).setY(0).normalize();
    burstAt.copy(headPosition).addScaledVector(forward, 0.45);
    burstAt.y -= 0.4;
    const goblin = this.goblins.nearestGrabbable(burstAt, 0.6);
    if (goblin) this.eat(goblin, headPosition, headForward);
  }

  /** Drops anything held (used when the board is placed again). */
  releaseAll(): void {
    for (const slot of this.slots.values()) {
      if (slot.held) this.goblins.drop(slot.held);
      this.clearHeld(slot);
    }
    this.handles.release();
  }
}

function sameTarget(a: Target, b: Target): boolean {
  if (!a || !b) return a === b;
  if (a.kind === 'goblin' && b.kind === 'goblin') return a.goblin === b.goblin;
  return a.kind === b.kind;
}
