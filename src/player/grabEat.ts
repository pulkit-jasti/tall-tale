// What the bare hands do: pinch a goblin to pick it up, bring it to the face
// with the head tilted up and let go to eat it. Fist grabs the board handles.
// Only the nearest thing in range of each hand shows Ready.
import { Vector3 } from 'three';
import type { GameAudio } from '../audio/sound.js';
import { EAT, HANDS } from '../config/game.js';
import type { Particles } from '../fx/particles.js';
import type { Goblin, Goblins } from '../units/goblins.js';
import type { BoardHandles, HandleKind } from './handles.js';
import type { HandState, HandTracker } from './hands.js';

type Target = { kind: 'goblin'; goblin: Goblin } | { kind: 'handle'; handle: HandleKind } | null;

interface HandSlot {
  held: Goblin | null;
  target: Target;
  inEatZone: boolean;
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
    for (const hand of hands.hands) this.slots.set(hand, { held: null, target: null, inEatZone: false });
  }

  update(dt: number, headPosition: Vector3, headForward: Vector3): void {
    this.time += dt;
    const pitchDeg = (Math.asin(Math.max(-1, Math.min(1, headForward.y))) * 180) / Math.PI;
    const headUp = pitchDeg >= EAT.minHeadPitchDeg;
    const nowReady = new Set<Goblin>();
    let readyHandle: HandleKind | null = null;

    for (const hand of this.hands.hands) {
      const slot = this.slots.get(hand)!;

      if (slot.held) {
        const goblin = slot.held;
        this.goblins.holdAt(goblin, hand.pinchPoint, headPosition);
        const inZone = headUp && hand.pinchPoint.distanceTo(headPosition) < EAT.mouthDistance;
        if (inZone && !slot.inEatZone) this.audio.play('readyTick');
        slot.inEatZone = inZone;
        // Near the mouth the goblin pulses white, otherwise it shows Held.
        const pulse = Math.sin(this.time * 18) > 0;
        this.goblins.setTouch(goblin, inZone && pulse ? 'ready' : 'held');
        if (hand.pinch.ended || !hand.pinch.on) {
          if (slot.inEatZone) this.eat(goblin, headPosition, headForward);
          else this.goblins.drop(goblin);
          slot.held = null;
          slot.inEatZone = false;
        }
        continue;
      }

      if (this.handles.isHeldBy(hand)) {
        if (hand.fist.ended || !hand.fist.on) this.handles.release();
        continue;
      }

      const target = this.findTarget(hand);
      if (!sameTarget(target, slot.target) && target) this.audio.play('readyTick', undefined, 1, 0.05);
      slot.target = target;

      if (target?.kind === 'goblin') {
        if (hand.pinch.started) {
          slot.held = target.goblin;
          slot.target = null;
          this.goblins.grab(target.goblin);
          this.goblins.setTouch(target.goblin, 'held');
          continue;
        }
        nowReady.add(target.goblin);
      } else if (target?.kind === 'handle') {
        if (hand.fist.started && !this.handles.busy) {
          this.handles.grab(target.handle, hand);
          this.audio.play('grab', hand.palm);
          slot.target = null;
          continue;
        }
        readyHandle = target.handle;
      }
    }

    for (const goblin of this.readyGoblins) {
      if (!nowReady.has(goblin) && goblin.mode !== 'held') this.goblins.setTouch(goblin, 'idle');
    }
    for (const goblin of nowReady) this.goblins.setTouch(goblin, 'ready');
    this.readyGoblins = nowReady;
    this.handles.setReady(readyHandle);

    if (this.pendingGulp > 0) {
      this.pendingGulp -= dt;
      if (this.pendingGulp <= 0) this.audio.play('gulp');
    }
  }

  private findTarget(hand: HandState): Target {
    if (!hand.tracked) return null;
    const goblin = this.goblins.nearestGrabbable(hand.pinchPoint, HANDS.pinchRadius);
    const handle = this.handles.busy ? null : this.handles.nearest(hand);
    if (goblin && handle) {
      const goblinDistance = this.goblins.centerWorld(goblin, burstAt).distanceTo(hand.pinchPoint);
      return goblinDistance <= handle.distance ? { kind: 'goblin', goblin } : { kind: 'handle', handle: handle.kind };
    }
    if (goblin) return { kind: 'goblin', goblin };
    if (handle) return { kind: 'handle', handle: handle.kind };
    return null;
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
      slot.held = null;
    }
    this.handles.release();
  }
}

function sameTarget(a: Target, b: Target): boolean {
  if (!a || !b) return a === b;
  if (a.kind === 'goblin' && b.kind === 'goblin') return a.goblin === b.goblin;
  if (a.kind === 'handle' && b.kind === 'handle') return a.handle === b.handle;
  return false;
}
