// What every food tool shares (docs/giant-tools.md sections 4 and 7): the fly
// swatter and the pepper shaker now, the megaphone and bell in build step 5.
//
//   - It rests on its platform, with its cost on a price tag at the front edge.
//   - Grab it with a fist (TOOLS.acceptPinch also allows a pinch). It snaps
//     into the fist the way it is held in real life (HOLD) and follows the hand. Grabbing is free: the first use (first swat, first shake) pays
//     the food and starts the timer. Accidental grabs never waste food.
//   - Not enough food: dimmed and tied down with a little rope. A hand near it
//     shows Locked, and closing the hand buzzes and wobbles it instead of grabbing.
//   - Let go before or after a use: it glides back to its platform.
//   - Dropped mid-use: it hangs for a moment, then floats up to the hand area
//     above its platform. Its timer keeps running.
//   - Use over: it blinks for the last seconds, then shrinks, poofs and pops
//     back onto its platform.
//   - The tutorial can hold the use timer (`timerHeld`) while it teaches the
//     tool, so a tool paid for early never runs out before the goblins come.
//
// The platform and the tool live in boardLift (cm, rises with the board,
// never turns). A subclass builds the tool's body and decides what counts as
// a use while it is held.
import { Color, Group, Matrix4, Mesh, Quaternion, Vector3, type MeshStandardMaterial } from 'three';
import type { GameAudio } from '../audio/sound.js';
import { HOLD, PRICE_TAG, TOOL_SPOTS, TOOLS } from '../config/game.js';
import type { Particles } from '../fx/particles.js';
import { applyTouchState, type TouchState } from '../player/feedback.js';
import type { HandState } from '../player/hands.js';
import { holdMatrix } from '../player/hold.js';
import { degToRad, polarX, polarZ } from '../rules/boardMath.js';
import { createToolUse, stopToolUse, tickToolUse, toolUsable, useTool } from '../rules/food.js';
import type { Goblins } from '../units/goblins.js';
import type { FoodJar } from '../world/foodJar.js';
import { PriceTag } from '../ui/priceTag.js';
import { cloneStatic, loadTemplate } from '../world/models.js';
import { post, toolRope } from '../world/shapes.js';
import type { Stage } from '../world/stage.js';

export type FoodToolName = 'swatter' | 'pepper';

/** What a hand near the tool shows. Held is managed by the tool. */
export type ToolReady = 'idle' | 'ready' | 'locked';

type Phase = 'resting' | 'held' | 'loose' | 'shrinking' | 'popping';

/** The game systems a tool works with. */
export interface ToolParts {
  stage: Stage;
  goblins: Goblins;
  food: FoodJar;
  audio: GameAudio;
  particles: Particles;
}

export interface ToolSpot {
  angleDeg: number;
  radius: number;
}

export interface ToolGrip {
  /** Grab zone along the body's y axis (cm from its origin)... */
  from: number;
  to: number;
  /** ...and around it (meters). */
  radius: number;
}

interface Holder {
  hand: HandState;
  viaPinch: boolean;
  openTime: number;
  lostTime: number;
  /** Tool pose relative to the hand, from the moment of the grab. */
  readonly offset: Matrix4;
}

const POOF_COLORS = [0xffffff, 0xddd6c8, 0xb8b0a0];
const UP = new Vector3(0, 1, 0);
const unitScale = new Vector3(1, 1, 1);
const temp = new Vector3();
const temp2 = new Vector3();
const handMatrix = new Matrix4();
const matrix = new Matrix4();
const targetPosition = new Vector3();
const targetQuaternion = new Quaternion();
const targetScale = new Vector3();
const wobbleQuaternion = new Quaternion();

export abstract class HandTool {
  /** Platform, post, price tag and rope (never move). */
  readonly root = new Group();
  /** The tool itself. Origin at the end the hand holds, the tool along +y. */
  protected readonly body = new Group();
  /** The tool's materials (touch states, dimming). Filled by build(). */
  protected materials: MeshStandardMaterial[] = [];
  private baseColors: Color[] = [];
  private phase: Phase = 'resting';
  private phaseTime = 0;
  private holder: Holder | null = null;
  protected readonly use = createToolUse();
  private restPosition = new Vector3();
  private restQuaternion = new Quaternion();
  private hoverPosition = new Vector3();
  private fromPosition = new Vector3();
  private fromQuaternion = new Quaternion();
  /** Gliding back to the platform: time left (seconds). */
  private returnLeft = 0;
  private touch: TouchState = 'idle';
  private ready: ToolReady = 'idle';
  private wobble = 0;
  private dimmed = false;
  private priceTag!: PriceTag;
  private rope!: Mesh;
  private timerHold = false;
  protected time = 0;

  /** The tool glows (pulsing) until grabbed: a new tool, or a hint. */
  beckon = false;
  /** Called with how many enemies a use hit (the tutorial counts them). */
  onUse: (count: number) => void = () => {};
  /** Called on each grab (the tutorial's grab lessons wait for it). */
  onGrab: () => void = () => {};

  protected stage: Stage;
  protected goblins: Goblins;
  protected food: FoodJar;
  protected audio: GameAudio;
  protected particles: Particles;

  constructor(
    readonly name: FoodToolName,
    parts: ToolParts,
    private spot: ToolSpot,
    private grip: ToolGrip,
    /** Leaning back (away from the front, along the rim) from upright while it rests (degrees). */
    private restLeanDeg: number,
    /** Size of the rope ring around the tool's base (cm). */
    private ropeRadius: number,
  ) {
    this.stage = parts.stage;
    this.goblins = parts.goblins;
    this.food = parts.food;
    this.audio = parts.audio;
    this.particles = parts.particles;
  }

  /** Builds the body: fills this.body and this.materials. */
  protected abstract build(): void;

  /** Every frame while held, after it followed the hand: find and do uses. */
  protected abstract heldUpdate(dt: number): void;

  /** The hand let go or the tool was taken away: forget the motion tracking. */
  protected abstract resetMotion(): void;

  get cost(): number {
    return TOOLS.cost[this.name];
  }

  /**
   * Free of cost (the tutorial, TOOLS.freeInTutorial): never locked, a use
   * takes no food. The price tag says "Free".
   */
  free = false;

  /** What a use takes from the jar right now. */
  private get price(): number {
    return this.free ? 0 : this.cost;
  }

  /** True when the tool can be used right now: free, paid for already, or affordable. */
  get usable(): boolean {
    return toolUsable(this.food.state, this.use, this.price);
  }

  get active(): boolean {
    return this.use.active;
  }

  /**
   * True while the tutorial holds the use timer (its use lesson): a paid use
   * never runs out. Releasing the hold gives a running use its full time again.
   */
  get timerHeld(): boolean {
    return this.timerHold;
  }
  set timerHeld(on: boolean) {
    if (!on && this.timerHold && this.use.active) this.use.timeLeft = TOOLS.duration[this.name];
    this.timerHold = on;
  }

  get visible(): boolean {
    return this.root.visible;
  }

  async load(): Promise<void> {
    const platform = await loadTemplate('castle/castle-kit/tower-hexagon-top.glb', { width: TOOL_SPOTS.platformWidth });
    const top = TOOL_SPOTS.platformTop;
    const a = degToRad(this.spot.angleDeg);
    const x = polarX(this.spot.radius, a);
    const z = polarZ(this.spot.radius, a);
    const stand = cloneStatic(platform);
    stand.position.set(x, top - platform.size.y, z);
    // The post reaches down to the board.
    const stem = post(top - platform.size.y);
    stem.position.set(x, stem.position.y + top - platform.size.y, z);
    this.root.add(stand, stem);
    this.buildPriceTag(a);
    this.build();
    this.baseColors = this.materials.map((m) => m.color.clone());
    // Rest pose: on the platform, its face toward the player, leaning back
    // along the rim (away from the front), so its top is out of view.
    this.restPosition.set(x, top, z);
    const outward = temp.set(Math.sin(a), 0, -Math.cos(a));
    const side = a < 0 ? -1 : 1;
    const back = temp2.set(side * Math.cos(a), 0, side * Math.sin(a));
    const leanAxis = back.cross(UP).negate().normalize();
    this.restQuaternion
      .setFromAxisAngle(leanAxis, degToRad(this.restLeanDeg))
      .multiply(new Quaternion().setFromAxisAngle(UP, -a));
    // The hand area: above the platform, a little toward the player.
    this.hoverPosition.copy(this.restPosition).addScaledVector(outward, -3);
    this.hoverPosition.y += TOOLS.looseLift;
    this.rope = toolRope(this.ropeRadius);
    this.rope.rotation.x = Math.PI / 2;
    this.rope.position.set(x, top + 1.5, z);
    this.root.add(this.rope);
    this.placeAtRest();
    this.stage.boardLift.add(this.root, this.body);
  }

  /**
   * The price tag on the platform's front edge, toward the player and a
   * little toward the front, so the hand on the tool never covers it. It
   * stands tilted back toward the eyes, above the ring's line of sight.
   */
  private buildPriceTag(a: number): void {
    const { inset, side, tiltDeg, height } = PRICE_TAG;
    this.priceTag = new PriceTag(this.cost);
    const holder = new Group();
    // Platform frame: x along the rim (toward the front is -x on the right side, +x on the left), z toward the player.
    holder.rotation.y = -a;
    holder.position.set(polarX(this.spot.radius, a), TOOL_SPOTS.platformTop, polarZ(this.spot.radius, a));
    const toFront = a < 0 ? 1 : -1;
    const tilt = degToRad(tiltDeg);
    this.priceTag.group.rotation.x = -tilt;
    this.priceTag.group.position.set(toFront * side, (height / 2) * Math.cos(tilt), inset);
    holder.add(this.priceTag.group);
    this.root.add(holder);
  }

  // ---- Hands (called from GrabEat, which picks one target per hand) ----

  /** Distance (meters) from the hand to the grab zone, or null when out of reach or not grabbable now. */
  reach(hand: HandState): number | null {
    if (!this.root.visible || this.holder || this.phase === 'shrinking' || this.phase === 'popping') return null;
    const d = Math.min(this.gripDistance(hand.palm), this.gripDistance(hand.pinchPoint));
    return d < this.grip.radius ? d : null;
  }

  isBusy(hand: HandState): boolean {
    return this.holder?.hand === hand;
  }

  grab(hand: HandState, viaPinch: boolean): void {
    this.body.updateMatrixWorld(true);
    this.handWorldMatrix(hand, viaPinch, handMatrix);
    const offset = new Matrix4().copy(handMatrix).invert().multiply(this.body.matrixWorld);
    this.holder = { hand, viaPinch, openTime: 0, lostTime: 0, offset };
    this.setPhase('held');
    this.returnLeft = 0;
    this.beckon = false;
    this.resetMotion();
    this.audio.play('grab', hand.palm);
    this.onGrab();
  }

  /** Closing the hand on a locked tool: a buzz and a wobble, no grab. */
  refuse(): void {
    this.wobble = TOOLS.wobbleTime;
    this.audio.play('locked', undefined, 1, 0.4);
  }

  setReady(state: ToolReady): void {
    this.ready = state;
  }

  /** Lets go without using it (board placed again, battle over). */
  release(): void {
    if (this.holder) this.letGo();
  }

  /** Shows or hides the tool (the tutorial director brings it in its wave). Hiding ends a use. */
  setVisible(visible: boolean): void {
    if (!visible) {
      this.holder = null;
      stopToolUse(this.use);
      this.beckon = false;
      this.timerHold = false;
      this.placeAtRest();
    }
    this.root.visible = visible;
    this.body.visible = visible;
  }

  /** A new tool: it pops onto its platform with a poof and glows until grabbed. */
  appear(): void {
    this.setVisible(true);
    this.placeAtRest();
    this.body.scale.setScalar(0.001);
    this.setPhase('popping');
    this.poof(this.restPosition, 14);
    this.audio.play('toolPoof', this.stage.boardLift.localToWorld(temp.copy(this.restPosition)));
    this.beckon = true;
  }

  /** World point in the middle of the grab zone, for the tutorial's markers and ghost hand. */
  handleWorld(out: Vector3): Vector3 {
    return this.body.localToWorld(out.set(0, (this.grip.from + this.grip.to) / 2, 0));
  }

  // ---- Use ----

  /**
   * The player swatted or shook: true if it may work. The first use pays the
   * food and starts the timer. Without enough food it buzzes and does nothing.
   */
  protected tryUse(): boolean {
    const price = this.price;
    const result = useTool(this.food.state, this.use, price, TOOLS.duration[this.name]);
    if (result === 'locked') {
      this.refuse();
      return false;
    }
    if (result === 'started') {
      if (price > 0) this.food.spent();
      console.info(`[tools] ${this.name} used: ${price} food, ${TOOLS.duration[this.name]} s`);
    }
    return true;
  }

  /** Debug: starts a use without hands (pays the food like a real use). */
  protected debugStart(): boolean {
    if (!this.root.visible) this.appear();
    return this.tryUse();
  }

  // ---- Every frame ----

  update(dt: number): void {
    if (!this.root.visible) return;
    this.time += dt;
    this.phaseTime += dt;
    if (!this.timerHold && tickToolUse(this.use, dt)) this.startShrink();
    switch (this.phase) {
      case 'held':
        this.updateHeld(dt);
        break;
      case 'loose':
        this.updateLoose();
        break;
      case 'shrinking':
        this.updateShrink();
        break;
      case 'popping':
        this.updatePop();
        break;
      default:
        this.updateResting(dt);
    }
    this.body.updateMatrixWorld(true);
    this.updateLook(dt);
  }

  private updateHeld(dt: number): void {
    const holder = this.holder!;
    const hand = holder.hand;
    // Fast swings can blur tracking: the tool stays where it is for a moment instead of dropping.
    holder.lostTime = hand.tracked ? 0 : holder.lostTime + dt;
    const closed = hand.fist.on || hand.pinch.on;
    holder.openTime = closed || !hand.tracked ? 0 : holder.openTime + dt;
    if (holder.lostTime >= TOOLS.holdLostGrace || holder.openTime >= TOOLS.releaseHold) {
      this.letGo();
      return;
    }
    if (hand.tracked) {
      if (holder.viaPinch) {
        // A pinch keeps the angle it grabbed at.
        this.handWorldMatrix(hand, true, handMatrix);
        matrix.copy(this.stage.boardLift.matrixWorld).invert().multiply(handMatrix).multiply(holder.offset);
      } else {
        // A fist holds it the way it is held in real life (src/player/hold.ts).
        holdMatrix(hand, this.name, 0.01 * this.stage.boardScale, handMatrix);
        matrix.copy(this.stage.boardLift.matrixWorld).invert().multiply(handMatrix);
      }
      matrix.decompose(targetPosition, targetQuaternion, targetScale);
      // Right after the grab it eases into the hand, so the snap never jumps.
      const smoothing = this.phaseTime < HOLD.snapTime ? HOLD.snapSmoothing : TOOLS.holdSmoothing;
      const k = 1 - Math.exp(-dt / smoothing);
      this.body.position.lerp(targetPosition, k);
      this.body.quaternion.slerp(targetQuaternion, k);
    }
    this.body.updateMatrixWorld(true);
    this.heldUpdate(dt);
  }

  private letGo(): void {
    this.holder = null;
    this.resetMotion();
    this.fromPosition.copy(this.body.position);
    this.fromQuaternion.copy(this.body.quaternion);
    if (this.use.active) {
      this.setPhase('loose');
    } else {
      this.setPhase('resting');
      this.returnLeft = TOOLS.returnTime;
    }
  }

  /** Dropped mid-use: hang a moment, then float up to the hand area, and bob there. */
  private updateLoose(): void {
    const t = Math.min(1, Math.max(0, (this.phaseTime - TOOLS.looseWait) / TOOLS.looseFloat));
    const s = t * t * (3 - 2 * t);
    this.body.position.lerpVectors(this.fromPosition, this.hoverPosition, s);
    this.body.position.y += Math.sin(this.time * 3) * 0.5 * s;
    this.body.quaternion.slerpQuaternions(this.fromQuaternion, this.restQuaternion, s);
  }

  private updateResting(dt: number): void {
    if (this.returnLeft > 0) {
      this.returnLeft = Math.max(0, this.returnLeft - dt);
      const t = 1 - this.returnLeft / TOOLS.returnTime;
      const s = t * t * (3 - 2 * t);
      this.body.position.lerpVectors(this.fromPosition, this.restPosition, s);
      this.body.quaternion.slerpQuaternions(this.fromQuaternion, this.restQuaternion, s);
      return;
    }
    this.body.position.copy(this.restPosition);
    this.body.quaternion.copy(this.restQuaternion);
    // Locked: a small wobble after a refused grab, and while a hand is near it.
    const wobbling = this.wobble > 0 || this.ready === 'locked';
    this.wobble = Math.max(0, this.wobble - dt);
    if (wobbling) {
      wobbleQuaternion.setFromAxisAngle(UP, Math.sin(this.time * 30) * degToRad(TOOLS.wobbleDeg));
      this.body.quaternion.premultiply(wobbleQuaternion);
    }
  }

  /** Use over: shrink where it is, then poof back onto the platform. */
  private startShrink(): void {
    if (this.holder) this.holder = null;
    this.resetMotion();
    this.setPhase('shrinking');
  }

  private updateShrink(): void {
    const t = Math.min(1, this.phaseTime / TOOLS.shrinkTime);
    this.body.scale.setScalar(Math.max(0.001, 1 - t));
    if (t < 1) return;
    this.poof(this.body.position, 10);
    this.audio.play('toolReturn', this.stage.boardLift.localToWorld(temp.copy(this.body.position)));
    this.placeAtRest();
    this.body.scale.setScalar(0.001);
    this.setPhase('popping');
    this.poof(this.restPosition, 8);
  }

  private updatePop(): void {
    const t = Math.min(1, this.phaseTime / TOOLS.popTime);
    // A small overshoot, so it pops in.
    this.body.scale.setScalar(Math.max(0.001, t < 1 ? Math.sin(t * Math.PI * 0.5) * (1 + 0.15 * Math.sin(t * Math.PI)) : 1));
    if (t >= 1) this.setPhase('resting');
  }

  /** Touch state, dimming, rope, beckon pulse, end-of-use blink and price tag. */
  private updateLook(dt: number): void {
    const usable = this.usable;
    const dim = !usable;
    if (dim !== this.dimmed) {
      this.dimmed = dim;
      this.materials.forEach((m, i) => {
        m.color.copy(this.baseColors[i]);
        if (dim) m.color.multiplyScalar(TOOLS.dimShare);
      });
    }
    this.rope.visible = dim && this.phase === 'resting' && this.returnLeft <= 0;
    let state: TouchState = this.holder ? 'held' : this.ready;
    if (this.ready === 'locked' && usable) state = 'ready';
    // The last seconds of a use: blink, so the end is no surprise.
    if (this.use.active && this.use.timeLeft < TOOLS.warnTime && Math.sin(this.time * 18) > 0) state = 'idle';
    // A new tool glows until grabbed. A hand near it shows Ready instead.
    if (this.beckon && state === 'idle' && Math.sin(this.time * 6) > 0) state = 'ready';
    if (state !== this.touch) {
      this.touch = state;
      applyTouchState(this.materials, state);
    }
    this.priceTag.set(this.free ? 'free' : this.use.active ? 'paid' : usable ? 'ok' : 'short');
  }

  // ---- Helpers ----

  private setPhase(phase: Phase): void {
    this.phase = phase;
    this.phaseTime = 0;
  }

  private placeAtRest(): void {
    this.phase = 'resting';
    this.phaseTime = 0;
    this.returnLeft = 0;
    this.body.position.copy(this.restPosition);
    this.body.quaternion.copy(this.restQuaternion);
    this.body.scale.setScalar(1);
    this.body.updateMatrixWorld(true);
  }

  /** A poof at a boardLift point (cm). */
  private poof(at: Vector3, count: number): void {
    this.particles.burst(this.stage.boardLift.localToWorld(temp.copy(at)), POOF_COLORS, count, 0.18);
  }

  /** Distance (meters) from a world point to the grab zone on the body's axis. */
  private gripDistance(world: Vector3): number {
    this.body.worldToLocal(temp2.copy(world));
    const y = Math.min(this.grip.to, Math.max(this.grip.from, temp2.y));
    // The body is in boardLift (board cm, sized by the reach check), and it may be scaled down while it pops in or out.
    return Math.hypot(temp2.x, temp2.y - y, temp2.z) * 0.01 * this.stage.boardScale * this.body.scale.x;
  }

  private handWorldMatrix(hand: HandState, viaPinch: boolean, out: Matrix4): Matrix4 {
    return out.compose(viaPinch ? hand.pinchPoint : hand.palm, hand.quaternion, unitScale);
  }

  /** A body point (cm) to the board (boardSpin, cm), where the goblins are. */
  protected bodyToBoard(local: Vector3, out: Vector3): Vector3 {
    this.body.localToWorld(out.copy(local));
    return this.stage.boardSpin.worldToLocal(out);
  }

  /** A body point (cm) to the world. */
  protected bodyToWorld(local: Vector3, out: Vector3): Vector3 {
    return this.body.localToWorld(out.copy(local));
  }
}
