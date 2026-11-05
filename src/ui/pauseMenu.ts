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
const x = new Vector3();
const y = new Vector3();
const basis = new Matrix4();

/** The left wrist's pause button. update() returns true on the frame it is poked. */
class WristButton {
  /** World (meters): placed on the wrist every frame, scaled to cm. */
  private holder = new Group();
  private button: PokeButton;
  private facing = new PoseSwitch(PAUSE.wrist.showHold, PAUSE.wrist.hideHold);
  /** 0 hidden, 1 fully out. */
  private shown = 0;

  constructor(parent: Object3D, audio: GameAudio) {
    this.button = new PokeButton(audio, { radius: PAUSE.wrist.radius, icon: 'pause' });
    this.holder.add(this.button.group);
    this.holder.visible = false;
    parent.add(this.holder);
  }

  hide(): void {
    this.facing.forceOff();
    this.shown = 0;
    this.holder.visible = false;
    this.button.reset();
  }

  /** `enabled`: a battle is on and the left hand is free. */
  update(dt: number, left: HandState, right: HandState, head: Vector3, enabled: boolean): boolean {
    const { faceDot, hideMargin, maxDistance, back, out, popTime } = PAUSE.wrist;
    let facing = false;
    let away = true;
    if (enabled && left.tracked && left.usingHand) {
      toEyes.subVectors(head, left.palm);
      const distance = toEyes.length();
      const dot = distance > 0 ? left.palmNormal.dot(toEyes) / distance : 0;
      facing = dot > faceDot && distance < maxDistance;
      away = dot < faceDot - hideMargin || distance > maxDistance;
    }
    this.facing.update(facing, away, dt);
    const target = this.facing.on ? 1 : 0;
    const step = dt / popTime;
    this.shown = target > this.shown ? Math.min(1, this.shown + step) : Math.max(0, this.shown - step);
    if (this.shown <= 0) {
      if (this.holder.visible) {
        this.holder.visible = false;
        this.button.reset();
      }
      return false;
    }
    // On the inside of the wrist: back from the palm toward the arm, its face out of the palm.
    this.holder.visible = true;
    this.holder.position.copy(left.palm).addScaledVector(left.forward, -back).addScaledVector(left.palmNormal, out);
    // Its face (+z) out of the palm, its up along the fingers.
    y.copy(left.forward).addScaledVector(left.palmNormal, -left.forward.dot(left.palmNormal)).normalize();
    x.crossVectors(y, left.palmNormal).normalize();
    basis.makeBasis(x, y, left.palmNormal);
    this.holder.quaternion.setFromRotationMatrix(basis);
    this.holder.scale.setScalar(CM * this.shown);
    this.holder.updateMatrixWorld(true);
    // Only the other hand's index finger pokes it, and only once it is fully out.
    return this.shown >= 1 && this.button.update([right], dt);
  }
}

export class PauseMenu {
  /** World (meters): placed in front of the head when the panel opens. */
  private holder = new Group();
  private panel: Panel;
  private buttons: PokeButton[] = [];
  private wrist: WristButton;
  private buttonTopPx = 0;
  private open = false;

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

  /**
   * Opens the panel in front of the head, at the same spot from the eyes as
   * the end panel (sized with the board, so it matches the player's reach).
   */
  show(head: Vector3, forward: Vector3, boardScale: number): void {
    this.open = true;
    this.wrist.hide();
    const yaw = Math.atan2(-forward.x, -forward.z);
    this.holder.position.set(head.x, head.y - BOARD.eyeToBoard * boardScale, head.z);
    this.holder.rotation.set(0, yaw, 0);
    this.holder.scale.setScalar(CM * boardScale);
    this.holder.updateMatrixWorld(true);
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
  update(dt: number, hands: HandState[]): PauseAction | null {
    if (!this.open) return null;
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
