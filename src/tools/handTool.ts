// What every hand tool shares (docs/giant-tools.md sections 4 and 7, v2 in
// docs/v2-plan.md 2.1): the fly swatter, the pepper shaker, the bell and the
// war horn, each on its own platform.
//
//   - Tools are free (v2). It rests on its platform with a ring around its base.
//   - Grab it with a fist (TOOLS.acceptPinch also allows a pinch). It snaps
//     into the fist the way it is held in real life (HOLD) and follows the
//     hand. Grabbing is free: the first use (first swat, first shake) starts
//     the use window (TOOLS.use). Accidental grabs never waste it.
//   - Use over: it blinks for the last seconds, then shrinks, poofs and pops
//     back onto its platform. Then it recharges (TOOLS.recharge, src/rules/recharge.ts):
//     dimmed (the Locked look), and the ring on its platform fills up. A hand
//     near it shows Locked, and closing the hand buzzes and wobbles it.
//     Eating a goblin makes the ring jump forward. `tiedDown` is locked
//     whatever the ring (a tool the game ties down), with a rope.
//   - Let go, before, during or after a use: it glides back to its platform.
//     A running use window keeps running, and it can be grabbed again there.
//   - The tutorial can hold the use window (`timerHeld`) while it teaches the
//     tool, so a tool used early never runs out before the goblins come.
//
// The platform and the tool live in boardLift (cm, rises with the board,
// never turns). A subclass builds the tool's body and decides what counts as
// a use while it is held.
import { Color, Group, Matrix4, Mesh, MeshBasicMaterial, Quaternion, RingGeometry, Vector3, type MeshStandardMaterial } from 'three';
import type { GameAudio } from '../audio/sound.js';
import { HOLD, TOOL_SPOTS, TOOLS } from '../config/game.js';
import { popIn, shrinkAway } from '../fx/ease.js';
import type { Particles } from '../fx/particles.js';
import { applyTouchState, type TouchState } from '../player/feedback.js';
import type { HandState } from '../player/hands.js';
import { holdMatrix } from '../player/hold.js';
import { degToRad, polarX, polarZ } from '../rules/boardMath.js';
import { chargeUsable, createCharge, endUse, readyNow, refillCharge, tickCharge, useCharge } from '../rules/recharge.js';
import type { Goblins } from '../units/goblins.js';
import { cloneStatic, loadTemplate } from '../world/models.js';
import { post, toolRope } from '../world/shapes.js';
import type { Stage } from '../world/stage.js';

export type HandToolName = 'swatter' | 'pepper' | 'bell' | 'horn';

/** What a hand near the tool shows. Held is managed by the tool. */
export type ToolReady = 'idle' | 'ready' | 'locked';

type Phase = 'resting' | 'held' | 'loose' | 'shrinking' | 'popping';

/** The game systems a tool works with. */
export interface ToolParts {
  stage: Stage;
  goblins: Goblins;
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

/** Where the platform goes, when not simply under the tool. */
export interface ToolOptions {
  /** The platform spot. null: no platform, the tool rests on another tool's one. */
  platform?: ToolSpot | null;
  platformWidth?: number;
  /** The tool's origin rests this far above the platform top (cm), for a tool that hangs below its handle. */
  restLift?: number;
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
const turnTemp = new Quaternion();

export abstract class HandTool {
  /** Platform, post, ring and rope (they move only with the tool's spot, between battles). */
  readonly root = new Group();
  /** The platform and its post, at the tool's spot. */
  private platform = new Group();
  /** The tool itself. Origin at the end the hand holds, the tool along +y. */
  protected readonly body = new Group();
  /** The tool's materials (touch states, dimming). Filled by build(). */
  protected materials: MeshStandardMaterial[] = [];
  private baseColors: Color[] = [];
  private phase: Phase = 'resting';
  private phaseTime = 0;
  private holder: Holder | null = null;
  protected readonly use = createCharge();
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
  /** The use and recharge ring on the platform (null for a tool without a platform of its own). */
  private ring: Mesh | null = null;
  private ringMaterial: MeshBasicMaterial | null = null;
  private ringFlash = 0;
  private rope!: Mesh;
  private timerHold = false;
  protected time = 0;

  /** The tool glows (pulsing) until grabbed: a new tool, or a hint. */
  beckon = false;
  /**
   * Another tool's lesson (or a lesson about something else) runs: this one
   * is locked by the lesson. It does not glow (no beckon, no Ready glow, no
   * ring flash), it is dimmed, and a grab only buzzes, so the player cannot
   * break the lesson with another tool (headset tests: tools blinked during
   * other lessons, and using them could break a lesson).
   */
  quiet = false;
  /** Called with how many enemies a use hit (the tutorial counts them). */
  onUse: (count: number) => void = () => {};
  /** Called on each grab (the tutorial's grab lessons wait for it). */
  onGrab: () => void = () => {};

  protected stage: Stage;
  protected goblins: Goblins;
  protected audio: GameAudio;
  protected particles: Particles;

  constructor(
    readonly name: HandToolName,
    parts: ToolParts,
    private spot: ToolSpot,
    private grip: ToolGrip,
    /** Leaning back (away from the front, along the rim) from upright while it rests (degrees). */
    private restLeanDeg: number,
    /** Size of the rope ring around the tool's base (cm). */
    private ropeRadius: number,
    private options: ToolOptions = {},
  ) {
    this.stage = parts.stage;
    this.goblins = parts.goblins;
    this.audio = parts.audio;
    this.particles = parts.particles;
  }

  /** Builds the body: fills this.body and this.materials. */
  protected abstract build(): void;

  /** Every frame while held, after it followed the hand: find and do uses. */
  protected abstract heldUpdate(dt: number): void;

  /** The hand let go or the tool was taken away: forget the motion tracking. */
  protected abstract resetMotion(): void;

  /** The use window (seconds) and the full recharge (seconds). */
  get useSeconds(): number {
    return TOOLS.use[this.name];
  }
  get rechargeSeconds(): number {
    return TOOLS.recharge[this.name];
  }

  /**
   * Tied down whatever the ring: dimmed, the rope on, and a grab buzzes.
   * Nothing ties a tool down for now (it was the megaphone without a mic).
   */
  tiedDown = false;

  /** True when the tool can be used right now: ready, or its use window is open. */
  get usable(): boolean {
    return !this.tiedDown && !this.quiet && chargeUsable(this.use);
  }

  /** True while its use window is open. */
  get active(): boolean {
    return this.use.phase === 'using';
  }

  /** True while it recharges (dimmed, the ring filling). */
  get recharging(): boolean {
    return this.use.phase === 'recharging';
  }

  /**
   * True while the tutorial holds the use window (its use lesson): a use
   * never runs out. Releasing the hold gives a running use its full time again.
   */
  get timerHeld(): boolean {
    return this.timerHold;
  }
  set timerHeld(on: boolean) {
    if (!on && this.timerHold && this.active) this.use.useLeft = this.useSeconds;
    this.timerHold = on;
  }

  /**
   * A goblin was eaten (v2, docs/v2-plan.md 2.2): a recharging ring jumps
   * forward by `share` of the full recharge, with a flash. Returns true if it moved.
   */
  refill(share: number): boolean {
    if (!this.root.visible || !refillCharge(this.use, share)) return false;
    this.ringFlash = TOOLS.ring.flashTime;
    return true;
  }

  /** Ready at once, ring full (a new battle, the tutorial's help, debug). */
  rechargeNow(): void {
    readyNow(this.use);
  }

  /** Debug: the use is over and the recharge starts from empty. */
  drain(): void {
    if (this.active) this.startShrink();
    endUse(this.use);
  }

  get visible(): boolean {
    return this.root.visible;
  }

  async load(): Promise<void> {
    const top = TOOL_SPOTS.platformTop;
    if (this.options.platform !== null) {
      const width = this.options.platformWidth ?? TOOL_SPOTS.platformWidth;
      const platform = await loadTemplate('castle/castle-kit/tower-hexagon-top.glb', { width });
      // Built at the middle of its own group, so the group moves with the tool's spot (the loadout, setSpot).
      const stand = cloneStatic(platform);
      stand.position.set(0, top - platform.size.y, 0);
      // The post reaches down to the board.
      const stem = post(top - platform.size.y);
      stem.position.y += top - platform.size.y;
      this.platform.add(stand, stem);
      this.root.add(this.platform);
    }
    // The use and recharge ring, flat around the tool's base.
    this.buildRing();
    this.build();
    this.baseColors = this.materials.map((m) => m.color.clone());
    this.rope = toolRope(this.ropeRadius);
    this.rope.rotation.x = Math.PI / 2;
    this.root.add(this.rope);
    this.placeSpot();
    this.placeAtRest();
    this.stage.boardLift.add(this.root, this.body);
  }

  /** Its platform group and the tool itself (the menu sinks them, src/world/sceneSwap.ts). */
  get groups(): Group[] {
    return [this.root, this.body];
  }

  /** The platform spot it stands on now. */
  get spotNow(): ToolSpot {
    return this.spot;
  }

  /**
   * Moves the tool and its platform to another spot. Only between battles:
   * whatever it held is let go. (Every battle puts each tool on its own spot
   * now: moving the picks put a tool in front of the red flag.)
   */
  setSpot(spot: ToolSpot): void {
    if (spot.angleDeg === this.spot.angleDeg && spot.radius === this.spot.radius) return;
    this.spot = spot;
    if (!this.rope) return;
    this.holder = null;
    this.placeSpot();
    this.placeAtRest();
  }

  /**
   * A copy of the tool's body for the menu's shelf and stand (its own
   * materials, so their looks never touch the real tool), at its origin.
   */
  displayModel(): { model: Group; materials: MeshStandardMaterial[]; gripMid: number; lift: number; turn: (angleDeg: number, out: Quaternion) => Quaternion } {
    const model = this.body.clone(true);
    model.position.set(0, 0, 0);
    model.quaternion.identity();
    model.scale.setScalar(1);
    model.visible = true;
    const materials: MeshStandardMaterial[] = [];
    const copies = new Map<MeshStandardMaterial, MeshStandardMaterial>();
    model.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh || Array.isArray(mesh.material)) return;
      const own = mesh.material as MeshStandardMaterial;
      let copy = copies.get(own);
      if (!copy) {
        copy = own.clone();
        // The tool's starting colors (not a dimmed or glowing look it had when copied).
        const i = this.materials.indexOf(own);
        if (i >= 0) copy.color.copy(this.baseColors[i]);
        copy.emissive.setHex(0x000000);
        copies.set(own, copy);
        materials.push(copy);
      }
      mesh.material = copy;
    });
    return { model, materials, gripMid: (this.grip.from + this.grip.to) / 2, lift: this.restLift, turn: (angleDeg, out) => this.restTurn(angleDeg, out) };
  }

  /**
   * How it rests on a platform at `angleDeg`: its face toward the player,
   * leaning back along the rim (away from the front), so its top is out of
   * view. Also for its copy on the menu's shelf and stand.
   */
  restTurn(angleDeg: number, out: Quaternion): Quaternion {
    const a = degToRad(angleDeg);
    const side = a < 0 ? -1 : 1;
    const back = temp2.set(side * Math.cos(a), 0, side * Math.sin(a));
    const leanAxis = back.cross(UP).negate().normalize();
    return out.setFromAxisAngle(leanAxis, degToRad(this.restLeanDeg)).multiply(turnTemp.setFromAxisAngle(UP, -a));
  }

  /** How far its origin rests above a platform top (cm), for a tool that stands on its bell (the horn). */
  get restLift(): number {
    return this.options.restLift ?? 0;
  }

  /** Puts the platform, the ring, the rope and the rest pose at the current spot. */
  private placeSpot(): void {
    const top = TOOL_SPOTS.platformTop;
    const a = degToRad(this.spot.angleDeg);
    const x = polarX(this.spot.radius, a);
    const z = polarZ(this.spot.radius, a);
    this.platform.position.set(x, 0, z);
    this.ring?.parent?.position.set(x, TOOL_SPOTS.platformTop + TOOLS.ring.lift, z);
    // Around the tool's base, on the platform (a tool that hangs below its handle still stands on its base).
    this.rope.position.set(x, top + 1.5, z);
    this.restPosition.set(x, top + (this.options.restLift ?? 0), z);
    this.restTurn(this.spot.angleDeg, this.restQuaternion);
    const outward = temp.set(Math.sin(a), 0, -Math.cos(a));
    // The hand area: above the platform, a little toward the player.
    this.hoverPosition.copy(this.restPosition).addScaledVector(outward, -3);
    this.hoverPosition.y += TOOLS.looseLift;
  }

  /**
   * The ring on the platform top (TOOLS.ring): a dark track with a colored
   * fill on top of it. The fill is one ring mesh whose draw range shows only
   * part of it (each segment is 6 indices), so changing it costs nothing.
   * Unlit, so it reads at night too.
   */
  private buildRing(): void {
    const R = TOOLS.ring;
    const track = new Mesh(
      new RingGeometry(R.inner - 0.15, R.outer + 0.15, R.segments, 1),
      new MeshBasicMaterial({ color: R.trackColor, transparent: true, opacity: 0.8, depthWrite: false }),
    );
    const fill = new Mesh(new RingGeometry(R.inner, R.outer, R.segments, 1), new MeshBasicMaterial({ color: R.chargeColor }));
    // Flat, facing up. The fill sits a hair above the track (its local +z is up).
    track.rotation.x = -Math.PI / 2;
    // Placed at the tool's spot by placeSpot().
    fill.position.set(0, 0, 0.08);
    track.add(fill);
    track.visible = false;
    this.root.add(track);
    this.ring = fill;
    this.ringMaterial = fill.material as MeshBasicMaterial;
  }

  /** The ring shows how much is left of a use, or how full the recharge is. Hidden while ready. */
  private updateRing(dt: number): void {
    const fill = this.ring;
    const material = this.ringMaterial;
    if (!fill || !material) return;
    const track = fill.parent!;
    const R = TOOLS.ring;
    const using = this.active;
    const show = !this.tiedDown && (using || this.recharging);
    track.visible = show;
    if (!show) return;
    const share = using ? this.use.useLeft / this.useSeconds : this.use.charge;
    const segments = Math.max(0, Math.min(R.segments, Math.ceil(share * R.segments)));
    fill.geometry.setDrawRange(0, segments * 6);
    this.ringFlash = this.quiet ? 0 : Math.max(0, this.ringFlash - dt);
    material.color.setHex(this.ringFlash > 0 ? R.flashColor : using ? R.useColor : R.chargeColor);
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

  /** The hand holding it, or null (for tools that read the hand's own motion, like the bell). */
  protected get heldHand(): HandState | null {
    return this.holder?.hand ?? null;
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
      readyNow(this.use);
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
   * The player swatted or shook: true if it may work. The first use starts
   * the use window. While recharging it buzzes and does nothing.
   */
  protected tryUse(): boolean {
    if (this.tiedDown) {
      this.refuse();
      return false;
    }
    const result = useCharge(this.use, this.useSeconds);
    if (result === 'resting') {
      this.refuse();
      return false;
    }
    if (result === 'started') console.info(`[tools] ${this.name} used: ${this.useSeconds} s, then ${this.rechargeSeconds} s recharge`);
    return true;
  }

  /** A one-use tool (the bell, the horn) did its thing: the use ends now and it goes back to recharge. */
  protected finishUse(): void {
    if (!this.active) return;
    endUse(this.use);
    this.startShrink();
  }

  /** Debug: starts a use without hands (a recharging tool is made ready first). */
  protected debugStart(): boolean {
    if (!this.root.visible) this.appear();
    if (this.recharging) this.rechargeNow();
    return this.tryUse();
  }

  // ---- Every frame ----

  update(dt: number): void {
    if (!this.root.visible) return;
    this.time += dt;
    this.phaseTime += dt;
    // The use window runs down (unless the tutorial holds it), the recharge fills only on the platform.
    const onPlatform = this.phase === 'resting' && this.returnLeft <= 0 && !this.holder;
    if (tickCharge(this.use, dt, this.rechargeSeconds, !this.timerHold, onPlatform) === 'ended') this.startShrink();
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
    this.updateRing(dt);
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
    // Always back to its platform, also while its timer runs.
    this.setPhase('resting');
    this.returnLeft = TOOLS.returnTime;
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
    // The shared despawn look: a small elastic swell, then it shrinks away.
    this.body.scale.setScalar(Math.max(0.001, shrinkAway(t)));
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
    // A small elastic overshoot, so it pops in.
    this.body.scale.setScalar(Math.max(0.001, t < 1 ? popIn(t) : 1));
    if (t >= 1) this.setPhase('resting');
  }

  /** Touch state, dimming, rope, beckon pulse and end-of-use blink. */
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
    // The rope only when tied down; recharging shows the ring instead.
    this.rope.visible = this.tiedDown && this.phase === 'resting' && this.returnLeft <= 0;
    let state: TouchState = this.holder ? 'held' : this.ready;
    if (this.ready === 'locked' && usable) state = 'ready';
    // The last seconds of a use: blink, so the end is no surprise.
    if (this.active && this.use.useLeft < TOOLS.warnTime && this.useSeconds > TOOLS.warnTime && Math.sin(this.time * 18) > 0) state = 'idle';
    // A new tool glows until grabbed. A hand near it shows Ready instead.
    if (this.beckon && state === 'idle' && Math.sin(this.time * 6) > 0) state = 'ready';
    // Quiet during another lesson: only held shows.
    if (this.quiet && !this.holder) state = 'idle';
    if (state !== this.touch) {
      this.touch = state;
      applyTouchState(this.materials, state);
    }
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
