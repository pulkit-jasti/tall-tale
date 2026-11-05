// Pause (docs/controls-and-ui.md section 5). Two parts:
//
//   Wrist button: a small round button on the inside of the left wrist. It
//   pops in only while the left palm faces the eyes for a moment, and is
//   poked with the right index finger. The palm facing the headset is only
//   shown to, never pinched with (a palm-facing pinch is the Quest menu).
//
//   Pause panel: the battle freezes and a panel comes up in front of the
//   player with four poke buttons: Resume, Reset table, Measure reach and
//   Restart. It is placed from the head when it opens, not on the board, so
//   its buttons are always in reach, even when the board ended up somewhere
//   odd (that is what Reset table is for).
//
// Sizes in cm (the rigs are scaled 0.01), poked like every other button.
import { Group, Matrix4, Vector3, type Object3D } from 'three';
import type { GameAudio } from '../audio/sound.js';
import { BOARD, PAUSE, POKE } from '../config/game.js';
import { PoseSwitch } from '../player/gesture.js';
import type { HandState } from '../player/hands.js';
import { Panel, PANEL_INK } from './panel.js';
import { PokeButton } from './pokeButton.js';
import { drawBanner, fitFont, type ButtonIcon } from './uiImages.js';

export type PauseAction = 'resume' | 'resetTable' | 'measureReach' | 'restart';

const BUTTONS: { action: PauseAction; icon: ButtonIcon; label: string }[] = [
  { action: 'resume', icon: 'play', label: 'Resume' },
  { action: 'resetTable', icon: 'table', label: 'Reset table' },
  { action: 'measureReach', icon: 'reach', label: 'Measure reach' },
  { action: 'restart', icon: 'restart', label: 'Restart' },
];

/** X of each button's center on the panel (cm), left to right. */
export function pauseButtonX(index: number): number {
  return (index - (BUTTONS.length - 1) / 2) * PAUSE.panel.buttonGap;
}

const CM = 0.01;
const toEyes = new Vector3();
const target = new Vector3();
const x = new Vector3();
const y = new Vector3();
const z = new Vector3();
const UP = new Vector3(0, 1, 0);
const basis = new Matrix4();

/** The pause button on the left palm. update() returns true on the frame it is poked. */
class WristButton {
  /** World (meters): placed on the palm every frame, scaled to cm. */
  private holder = new Group();
  private button: PokeButton;
  private facing = new PoseSwitch(PAUSE.wrist.showHold, PAUSE.wrist.hideHold);
  /** 0 hidden, 1 fully out. */
  private shown = 0;
  /** Smoothed spot on the palm (world), so joint jitter does not shake it. */
  private spot = new Vector3();
  private hasSpot = false;

  constructor(parent: Object3D, audio: GameAudio) {
    this.button = new PokeButton(audio, { radius: PAUSE.wrist.radius, icon: 'pause' });
    this.holder.add(this.button.group);
    this.holder.visible = false;
    parent.add(this.holder);
  }

  /** True while the button is out (for the tutorial marker and lesson). */
  get visible(): boolean {
    return this.shown > 0;
  }

  /** The button's middle (world, meters), while it is out. */
  worldPosition(out: Vector3): Vector3 | null {
    return this.shown > 0 ? out.copy(this.holder.position) : null;
  }

  hide(): void {
    this.facing.forceOff();
    this.shown = 0;
    this.hasSpot = false;
    this.holder.visible = false;
    this.button.reset();
  }

  /** `enabled`: a battle is on and the left hand is free. */
  update(dt: number, left: HandState, right: HandState, head: Vector3, enabled: boolean): boolean {
    const { faceDot, hideDot, maxDistance, keepNear, out, smoothing, popTime } = PAUSE.wrist;
    let facing = false;
    let away = true;
    if (enabled && left.tracked && left.usingHand) {
      toEyes.subVectors(head, left.palm);
      const distance = toEyes.length();
      const dot = distance > 0 ? left.palmNormal.dot(toEyes) / distance : 0;
      facing = dot > faceDot && distance < maxDistance;
      away = dot < hideDot || distance > maxDistance;
      // Never hides while the other hand is poking it (the poke can shake the tracking of this hand).
      if (this.shown > 0 && right.tracked && right.indexTip.distanceTo(this.holder.position) < keepNear) away = false;
    }
    this.facing.update(facing, away, dt);
    const goal = this.facing.on ? 1 : 0;
    const step = dt / popTime;
    this.shown = goal > this.shown ? Math.min(1, this.shown + step) : Math.max(0, this.shown - step);
    if (this.shown <= 0) {
      if (this.holder.visible) {
        this.holder.visible = false;
        this.button.reset();
      }
      this.hasSpot = false;
      return false;
    }
    // In the middle of the palm, a little out from it, smoothed.
    target.copy(left.palm).addScaledVector(left.palmNormal, out);
    if (!this.hasSpot) {
      this.spot.copy(target);
      this.hasSpot = true;
    } else {
      this.spot.lerp(target, 1 - Math.exp(-dt / smoothing));
    }
    this.holder.visible = true;
    this.holder.position.copy(this.spot);
    // Standing upright and facing the eyes, whatever way the fingers point, so the pause bars always read upright.
    z.subVectors(head, this.spot).normalize();
    y.copy(UP).addScaledVector(z, -UP.dot(z));
    if (y.lengthSq() < 1e-6) y.set(0, 0, -1);
    y.normalize();
    x.crossVectors(y, z).normalize();
    basis.makeBasis(x, y, z);
    this.holder.quaternion.setFromRotationMatrix(basis);
    this.holder.scale.setScalar(CM * this.shown);
    this.holder.updateMatrixWorld(true);
    // Only the other hand's index finger pokes it, and only once it is fully out.
    return this.shown >= 1 && this.button.update([right], dt);
  }
}

export class PauseMenu {
  /** World (meters): placed in front of the head, and follows it lazily while open. */
  private holder = new Group();
  private panel: Panel;
  private buttons: PokeButton[] = [];
  private wrist: WristButton;
  private buttonTopPx = 0;
  private open = false;
  private yaw = 0;
  private following = false;
  private scale = 1;

  constructor(parent: Object3D, audio: GameAudio) {
    const { width, height, radius, y: centerY, tiltDeg, buttonRadius, buttonMargin } = PAUSE.panel;
    parent.add(this.holder);
    this.panel = new Panel(this.holder, { width, height, radius, centerY, tiltDeg, layoutWidth: 576, canvasScale: 2 });
    const rim = buttonRadius * POKE.rimScale;
    const buttonY = -height / 2 + rim + buttonMargin;
    BUTTONS.forEach((b, i) => {
      const button = new PokeButton(audio, { radius: buttonRadius, icon: b.icon });
      button.group.position.set(pauseButtonX(i), buttonY, 0);
      this.panel.root.add(button.group);
      this.buttons.push(button);
    });
    this.buttonTopPx = ((height / 2 - (buttonY + rim)) / height) * this.panel.layoutHeight;
    this.panel.paint((c, w) => this.draw(c, w));
    this.wrist = new WristButton(parent, audio);
  }

  get isOpen(): boolean {
    return this.open;
  }

  /** The wrist button: whether it is out, and where (for the tutorial). */
  get wristShown(): boolean {
    return this.wrist.visible;
  }
  wristWorld(out: Vector3): Vector3 | null {
    return this.wrist.worldPosition(out);
  }

  /**
   * Opens the panel in front of the head, at the same spot from the eyes as
   * the end panel (sized with the board, so it matches the player's reach).
   */
  show(head: Vector3, forward: Vector3, boardScale: number): void {
    this.open = true;
    this.following = false;
    this.scale = boardScale;
    this.wrist.hide();
    this.yaw = Math.atan2(-forward.x, -forward.z);
    this.place(head, 1);
    this.panel.visible = true;
    this.panel.popIn(0.2);
    for (const button of this.buttons) {
      button.reset();
      // The finger that poked the wrist button must not press a panel button at once.
      button.lock(POKE.lockAfterChange);
    }
  }

  hide(): void {
    this.open = false;
    this.panel.visible = false;
  }

  /** Puts the panel at its yaw in front of the head, moving share `k` of the way there. */
  private place(head: Vector3, k: number): void {
    target.set(head.x, head.y - BOARD.eyeToBoard * this.scale, head.z);
    this.holder.position.lerp(target, k);
    this.holder.rotation.set(0, this.yaw, 0);
    this.holder.scale.setScalar(CM * this.scale);
    this.holder.updateMatrixWorld(true);
  }

  /**
   * Lazy follow, like the Quest's own menus: still while the head turns a
   * little, back in front once it turned past PAUSE.follow.followDeg. So a
   * player who paused by accident and turned around still finds it.
   */
  private follow(dt: number, head: Vector3, forward: Vector3): void {
    const { followDeg, smoothing, settleDeg } = PAUSE.follow;
    if (Math.hypot(forward.x, forward.z) < 0.2) return;
    let d = Math.atan2(-forward.x, -forward.z) - this.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const deg = Math.abs(d) * (180 / Math.PI);
    // A head that moved far (leaning, standing up) also brings it back.
    target.set(head.x, head.y - BOARD.eyeToBoard * this.scale, head.z);
    if (deg > followDeg || this.holder.position.distanceTo(target) > 0.12) this.following = true;
    if (!this.following) return;
    const k = 1 - Math.exp(-dt / smoothing);
    this.yaw += d * k;
    this.place(head, k);
    if (deg < settleDeg && this.holder.position.distanceTo(target) < 0.01) this.following = false;
  }

  /** The wrist button while the battle runs. True on the frame it is poked. */
  updateWrist(dt: number, hands: { left: HandState; right: HandState }, head: Vector3, enabled: boolean): boolean {
    // A hand holding something is busy: the button waits until it is free.
    const free = !hands.left.pinch.on && !hands.left.fist.on;
    return this.wrist.update(dt, hands.left, hands.right, head, enabled && free && !this.open);
  }

  hideWrist(): void {
    this.wrist.hide();
  }

  /** The panel while paused. Returns the action of the button poked this frame, if any. */
  update(dt: number, hands: HandState[], head: Vector3, forward: Vector3): PauseAction | null {
    if (!this.open) return null;
    this.follow(dt, head, forward);
    this.panel.update(dt);
    let action: PauseAction | null = null;
    this.buttons.forEach((button, i) => {
      if (button.update(hands, dt) && !action) action = BUTTONS[i].action;
    });
    return action;
  }

  private draw(c: CanvasRenderingContext2D, w: number): void {
    const bannerTop = 18;
    const bannerH = 74;
    drawBanner(c, w * 0.18, bannerTop, w * 0.64, bannerH);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#fff4dc';
    fitFont(c, 'Paused', w * 0.64 - 40, 40);
    c.fillText('Paused', w / 2, bannerTop + bannerH * 0.45);
    c.fillStyle = PANEL_INK;
    const subtitleY = bannerTop + bannerH + 30;
    fitFont(c, 'The battle waits for you. Poke a button.', w - 70, 26);
    c.fillText('The battle waits for you. Poke a button.', w / 2, subtitleY);
    // A label over each button.
    const { width } = PAUSE.panel;
    const pxPerCm = w / width;
    const labelY = this.buttonTopPx - 18;
    c.fillStyle = '#2f5f22';
    BUTTONS.forEach((b, i) => {
      const cx = w / 2 + pauseButtonX(i) * pxPerCm;
      fitFont(c, b.label, PAUSE.panel.buttonGap * pxPerCm - 8, 22);
      c.fillText(b.label, cx, labelY);
    });
    c.fillStyle = '#8a5a34';
    fitFont(c, 'Measure reach and Restart start the battle again.', w - 70, 18);
    c.fillText('Measure reach and Restart start the battle again.', w / 2, (subtitleY + labelY) / 2 + 4);
  }
}
