// What the bare hands do: pinch a goblin to pick it up and hold it near the
// mouth to eat it (no letting go, no head tilt, so the palm never has to face
// the headset and open the Quest menu). Fist or pinch grabs the compass crank
// (v3, the 'ring' target: it took the ring handle's place).
// The slingshot: fist or pinch grabs its handle, a pinch on the bowl takes a
// pebble, a pinch on the pouch pulls it (the slingshot does the rest).
// The food tools (swatter, pepper): a fist grabs them, or buzzes when there
// is not enough food (Locked). The tools do the rest.
// Only one thing in range of each hand shows Ready.
import { Vector3 } from 'three';
import type { GameAudio } from '../audio/sound.js';
import { EAT, HANDLES, HANDS, SLINGSHOT, TOOLS } from '../config/game.js';
import type { Particles } from '../fx/particles.js';
import type { HandTool } from '../tools/handTool.js';
import type { SlingPart, Slingshot } from '../tools/slingshot.js';
import type { Chicken, Chickens } from '../units/chickens.js';
import type { Goblin, Goblins } from '../units/goblins.js';
import type { CompassCrank } from './crank.js';
import type { HandState, HandTracker } from './hands.js';

type Target =
  | { kind: 'goblin'; goblin: Goblin }
  | { kind: 'chicken'; chicken: Chicken }
  | { kind: 'sling'; part: SlingPart }
  | { kind: 'tool'; tool: HandTool }
  | { kind: 'ring' }
  | null;

interface HandSlot {
  held: Goblin | null;
  /** v3 2.6 Chicken dinner: a chicken held instead of a goblin. */
  chicken: Chicken | null;
  target: Target;
  inEatZone: boolean;
  /** Time the held goblin has been near the mouth (seconds). */
  eatTimer: number;
  /** Time the open hand has been in the grab zone of the ring or the slingshot handle (seconds). */
  openTime: number;
}

const EAT_COLORS = [0x6a8f3a, 0x8fb04a, 0xffffff, 0xf2c14e];
const forward = new Vector3();
const burstAt = new Vector3();

export class GrabEat {
  private slots = new Map<HandState, HandSlot>();
  private readyGoblins = new Set<Goblin>();
  /** This frame's ready goblins. Swapped with readyGoblins each frame, so no new Set per frame. */
  private nextReady = new Set<Goblin>();
  private pendingGulp = -1;
  /** What each food tool shows this frame (reused, no allocation per frame). */
  private toolReady = new Map<HandTool, 'ready' | 'locked'>();
  private time = 0;
  /** Called with each eaten goblin (food goes into the jar). */
  onEat: (goblin: Goblin) => void = () => {};
  /** Called with each goblin picked up (the tutorial waits for it). */
  onGrab: (goblin: Goblin) => void = () => {};
  /** Called with each goblin let go away from the mouth, and how fast it flew off (cm per second): the toss lesson waits for one. */
  onToss: (goblin: Goblin, speed: number) => void = () => {};
  /** v3 2.6: the chickens (set by the game), and a chicken was eaten (Chicken dinner). */
  chickens: Chickens | null = null;
  onEatChicken: () => void = () => {};

  /** True while this hand holds anything: a goblin, the slingshot or a pebble, or a tool. */
  handBusy(hand: HandState): boolean {
    if (this.slots.get(hand)?.held || this.slots.get(hand)?.chicken) return true;
    if (this.slingshot.isBusy(hand)) return true;
    for (const t of this.tools) if (t.isBusy(hand)) return true;
    return false;
  }

  /** True while a hand holds this goblin. */
  isHolding(goblin: Goblin): boolean {
    for (const slot of this.slots.values()) if (slot.held === goblin) return true;
    return false;
  }

  constructor(
    private hands: HandTracker,
    private goblins: Goblins,
    /** v3: the compass crank (the ring handle's place in battles), still a 'ring' target here. */
    private handles: CompassCrank,
    private slingshot: Slingshot,
    private tools: HandTool[],
    private audio: GameAudio,
    private particles: Particles,
  ) {
    for (const hand of hands.hands) this.slots.set(hand, { held: null, chicken: null, target: null, inEatZone: false, eatTimer: 0, openTime: 0 });
  }

  update(dt: number, headPosition: Vector3, headForward: Vector3): void {
    this.time += dt;
    const nowReady = this.nextReady;
    nowReady.clear();
    let ringReady = false;
    let pouchReady = false;
    let bowlReady = false;
    let handleReady = false;
    const toolReady = this.toolReady;
    toolReady.clear();

    for (const hand of this.hands.hands) {
      const slot = this.slots.get(hand)!;

      // v3 2.6 Chicken dinner: a held chicken is eaten at the mouth like a goblin, or let go where it is.
      if (slot.chicken) {
        const chicken = slot.chicken;
        if (!chicken.alive) {
          slot.chicken = null;
          continue;
        }
        this.chickens?.holdAt(chicken, hand.pinchPoint);
        const mouth = hand.pinchPoint.distanceTo(headPosition);
        const inZone = mouth < EAT.mouthDistance;
        if (inZone && !slot.inEatZone) this.audio.play('readyTick');
        slot.inEatZone = inZone;
        slot.eatTimer = inZone ? slot.eatTimer + dt : 0;
        const letGo = hand.pinch.ended || !hand.pinch.on;
        if (slot.eatTimer >= EAT.holdTime || (letGo && mouth < EAT.graceDistance)) {
          this.chickens?.eat(chicken);
          this.chomp(headPosition, headForward);
          slot.chicken = null;
          this.clearHeld(slot);
          this.onEatChicken();
        } else if (letGo) {
          this.chickens?.drop(chicken);
          slot.chicken = null;
          this.clearHeld(slot);
        }
        continue;
      }

      if (slot.held) {
        const goblin = slot.held;
        this.goblins.holdAt(goblin, hand.pinchPoint, headPosition, dt);
        // Brought to the empty slingshot pouch: it clicks in, ready to shoot.
        if (this.slingshot.loadGoblin(hand, goblin)) {
          this.goblins.setTouch(goblin, 'idle');
          this.clearHeld(slot);
          continue;
        }
        // v3 Phase 3: a bomber cannot be eaten (a keg on its back): it is only tossed away.
        const edible = goblin.type !== 'bomber';
        const mouth = hand.pinchPoint.distanceTo(headPosition);
        const inZone = edible && mouth < EAT.mouthDistance;
        if (inZone && !slot.inEatZone) this.audio.play('readyTick');
        slot.inEatZone = inZone;
        slot.eatTimer = inZone ? slot.eatTimer + dt : 0;
        // Near the mouth the goblin pulses white, otherwise it shows Held.
        const pulse = Math.sin(this.time * 18) > 0;
        this.goblins.setTouch(goblin, inZone && pulse ? 'ready' : 'held');
        const letGo = hand.pinch.ended || !hand.pinch.on;
        // Held near the mouth for a moment: eaten. If the pinch breaks close to
        // the face (tracking or the Quest menu gesture), it is eaten too.
        if (slot.eatTimer >= EAT.holdTime || (edible && letGo && mouth < EAT.graceDistance)) {
          this.eat(goblin, headPosition, headForward);
          this.clearHeld(slot);
        } else if (letGo) {
          const speed = this.goblins.drop(goblin);
          this.clearHeld(slot);
          this.onToss(goblin, speed);
        }
        continue;
      }

      // The ring handle and the slingshot let go by themselves (see their update).
      if (this.handles.isHeldBy(hand) || this.slingshot.isBusy(hand) || this.tools.some((t) => t.isBusy(hand))) continue;

      const target = this.findTarget(hand);
      const grabbed = isGrabTarget(target);
      if (!sameTarget(target, slot.target)) {
        slot.openTime = 0;
        if (target && !grabbed) this.audio.play('readyTick', undefined, 1, 0.05);
      }
      slot.target = target;

      // The ring and the slingshot handle only grab after the hand was open in
      // their zone for a moment, so a hand that curls up while resting or
      // drifting by never grabs them.
      const readyTime =
        target?.kind === 'ring' ? HANDLES.readyTime : target?.kind === 'tool' ? TOOLS.readyTime : SLINGSHOT.readyTime;
      const wasArmed = slot.openTime >= readyTime;
      if (!grabbed) slot.openTime = 0;
      // The crank's knob is pinch only: the other fingers may be curled (2026-11-17: with them closed the hand
      // read as a fist, never "open", so the knob never armed and the pinch did nothing).
      else if (!hand.pinch.on && (target?.kind === 'ring' || !hand.fist.on)) slot.openTime += dt;
      const armed = grabbed && slot.openTime >= readyTime;
      if (armed && !wasArmed) this.audio.play('readyTick', undefined, 1, 0.05);
      const closing = hand.fist.started || hand.pinch.started;

      if (target?.kind === 'goblin') {
        if (hand.pinch.started) {
          slot.held = target.goblin;
          slot.target = null;
          this.goblins.grab(target.goblin);
          this.goblins.setTouch(target.goblin, 'held');
          this.onGrab(target.goblin);
          continue;
        }
        nowReady.add(target.goblin);
      } else if (target?.kind === 'chicken') {
        if (hand.pinch.started) {
          slot.chicken = target.chicken;
          slot.target = null;
          this.chickens?.grab(target.chicken);
          continue;
        }
      } else if (target?.kind === 'sling' && target.part === 'handle') {
        if (!armed) continue;
        if (closing) {
          this.slingshot.grabHandle(hand, !hand.fist.started);
          slot.target = null;
          slot.openTime = 0;
          continue;
        }
        handleReady = true;
      } else if (target?.kind === 'sling') {
        if (hand.pinch.started && this.slingshot.pinch(target.part === 'pouch' || target.part === 'keg' ? target.part : 'bowl', hand)) {
          slot.target = null;
          continue;
        }
        if (target.part === 'pouch') pouchReady = true;
        else bowlReady = true;
      } else if (target?.kind === 'tool') {
        if (!armed) continue;
        const tool = target.tool;
        const viaPinch = !hand.fist.started;
        if (hand.fist.started || (TOOLS.acceptPinch && hand.pinch.started)) {
          // Recharging (or tied down): a buzz and a wobble instead of a grab (the horn can still be held for a free move, v3 2.5).
          if (!tool.grabbable) {
            tool.refuse();
          } else {
            tool.grab(hand, viaPinch);
            slot.target = null;
            slot.openTime = 0;
            continue;
          }
        }
        toolReady.set(tool, tool.grabbable ? 'ready' : 'locked');
      } else if (target?.kind === 'ring' && armed) {
        // The crank's knob: a pinch only, never a fist (2026-11-13).
        if (hand.pinch.started && !this.handles.busy) {
          this.handles.grab(hand, true);
          this.audio.play('grab', hand.palm);
          slot.target = null;
          slot.openTime = 0;
          continue;
        }
        ringReady = true;
      }
    }

    for (const goblin of this.readyGoblins) {
      if (!nowReady.has(goblin) && goblin.mode !== 'held') this.goblins.setTouch(goblin, 'idle');
    }
    for (const goblin of nowReady) this.goblins.setTouch(goblin, 'ready');
    this.nextReady = this.readyGoblins;
    this.readyGoblins = nowReady;
    this.handles.setReady(ringReady);
    this.slingshot.setReady(pouchReady, bowlReady, handleReady);
    for (const tool of this.tools) tool.setReady(toolReady.get(tool) ?? 'idle');

    if (this.pendingGulp > 0) {
      this.pendingGulp -= dt;
      if (this.pendingGulp <= 0) this.audio.play('gulp');
    }
  }

  private findTarget(hand: HandState): Target {
    if (!hand.tracked) return null;
    // The slingshot sits inside the ring, away from the goblins, so it goes first.
    const sling = this.slingshot.reach(hand);
    if (sling) return { kind: 'sling', part: sling.part };
    // The food tools sit inside the ring too, away from the goblins.
    let tool: HandTool | null = null;
    let best = Infinity;
    for (const t of this.tools) {
      const d = t.reach(hand);
      if (d !== null && d < best) {
        best = d;
        tool = t;
      }
    }
    if (tool) return { kind: 'tool', tool };
    const goblin = this.goblins.nearestGrabbable(hand.pinchPoint, HANDS.pinchRadius);
    // A goblin in pinch range always wins, so reaching for one never grabs the ring.
    if (goblin) return { kind: 'goblin', goblin };
    const chicken = this.chickens?.nearest(hand.pinchPoint, HANDS.pinchRadius) ?? null;
    if (chicken) return { kind: 'chicken', chicken };
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
    // Before it goes: what touched it (seasoned, its tool credits) is read by onEat.
    const seasoned = goblin.seasoned;
    this.goblins.kill(goblin);
    goblin.seasoned = seasoned;
    this.chomp(headPosition, headForward);
    this.onEat(goblin);
  }

  /** The chomp: crumbs in front of the face, a chomp and a gulp. */
  private chomp(headPosition: Vector3, headForward: Vector3): void {
    forward.copy(headForward);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
    forward.normalize();
    burstAt.copy(headPosition).addScaledVector(forward, EAT.burstForward);
    burstAt.y -= EAT.burstDown;
    this.particles.burst(burstAt, EAT_COLORS, 14);
    this.audio.play('chomp');
    this.pendingGulp = 0.35;
  }

  /** Debug: eat the goblin nearest to the front of the wall without hands. */
  debugEat(headPosition: Vector3, headForward: Vector3): void {
    forward.copy(headForward).setY(0).normalize();
    burstAt.copy(headPosition).addScaledVector(forward, 0.45);
    burstAt.y -= 0.4;
    const goblin = this.goblins.nearestGrabbable(burstAt, 0.6);
    if (goblin && goblin.type !== 'bomber') this.eat(goblin, headPosition, headForward);
  }

  /** Drops anything held (used when the board is placed again). */
  releaseAll(): void {
    for (const slot of this.slots.values()) {
      if (slot.held) this.goblins.drop(slot.held);
      if (slot.chicken) this.chickens?.drop(slot.chicken);
      slot.chicken = null;
      this.clearHeld(slot);
    }
    this.handles.release();
    this.slingshot.release();
    for (const tool of this.tools) tool.release();
  }
}

function sameTarget(a: Target, b: Target): boolean {
  if (!a || !b) return a === b;
  if (a.kind === 'goblin' && b.kind === 'goblin') return a.goblin === b.goblin;
  if (a.kind === 'chicken' && b.kind === 'chicken') return a.chicken === b.chicken;
  if (a.kind === 'sling' && b.kind === 'sling') return a.part === b.part;
  if (a.kind === 'tool' && b.kind === 'tool') return a.tool === b.tool;
  return a.kind === b.kind;
}

/** Big things grabbed after the hand was open near them: the ring, the slingshot handle and the food tools. */
function isGrabTarget(target: Target): boolean {
  return target?.kind === 'ring' || target?.kind === 'tool' || (target?.kind === 'sling' && target.part === 'handle');
}
