// Pause (docs/controls-and-ui.md section 5). Two parts:
//
//   Pause button: a round button on a stand straight in front, outside the
//   ring, on the Next button's spot but lower (it steps aside while Next
//   shows). It stays there while a battle runs, poked with either hand.
//
//   Pause panel: the battle freezes and a panel comes up in front of the
//   player with four poke buttons: Resume, Reset table, Measure reach and
//   Restart. It is placed from the head when it opens, not on the board, so
//   its buttons are always in reach, even when the board ended up somewhere
//   odd (that is what Reset table is for).
//
// Sizes in cm (the rigs are scaled 0.01), poked like every other button.
import { Group, Vector3, type Material, type Mesh, type Object3D } from 'three';
import type { GameAudio } from '../audio/sound.js';
import { BOARD, PAUSE, POKE } from '../config/game.js';
import type { HandState } from '../player/hands.js';
import { degToRad } from '../rules/boardMath.js';
import { post } from '../world/shapes.js';
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
const target = new Vector3();

/** The pause button on its stand in front, outside the ring. update() returns true on the frame it is poked. */
class StandButton {
  /** boardLift (cm): rises with the board, never turns. */
  private stand = new Group();
  private button: PokeButton;

  constructor(parent: Object3D, audio: GameAudio) {
    const B = PAUSE.button;
    // Its face tilted up toward the eyes, like the Next button.
    this.button = new PokeButton(audio, { radius: B.radius, icon: 'pause' });
    this.button.group.rotation.x = -degToRad(B.tiltDeg);
    // A post down to the board, so it stands like the tool platforms.
    const stem = post(B.y - B.radius);
    stem.position.y -= B.radius;
    this.stand.add(this.button.group, stem);
    this.stand.position.set(0, B.y, -B.at);
    this.stand.visible = false;
    parent.add(this.stand);
  }

  /** The button's middle (world, meters), while it shows (for the tutorial marker). */
  worldPosition(out: Vector3): Vector3 | null {
    return this.stand.visible ? this.button.group.getWorldPosition(out) : null;
  }

  hide(): void {
    if (!this.stand.visible) return;
    this.stand.visible = false;
    this.button.reset();
  }

  /** `enabled`: a battle is on and the Next button is not out. */
  update(dt: number, hands: HandState[], enabled: boolean): boolean {
    if (!enabled) {
      this.hide();
      return false;
    }
    if (!this.stand.visible) {
      this.stand.visible = true;
      // A finger still there (Next, Resume) must not pause at once.
      this.button.lock(POKE.lockAfterChange);
    }
    return this.button.update(hands, dt);
  }
}

export class PauseMenu {
  /** World (meters): placed in front of the head, and follows it lazily while open. */
  private holder = new Group();
  private panel: Panel;
  private buttons: PokeButton[] = [];
  private pauseButton: StandButton;
  private buttonTopPx = 0;
  private open = false;
  private yaw = 0;
  private following = false;
  private scale = 1;

  /** `parent` is the world (meters) for the panel, `board` the boardLift (cm) for the pause button. */
  constructor(parent: Object3D, board: Object3D, audio: GameAudio) {
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
    this.drawOnTop();
    this.pauseButton = new StandButton(board, audio);
  }

  /**
   * Nothing ever hides the pause panel (it went through the towers): every
   * part skips the depth test and draws last, in a fixed order (the board,
   * then each button's rim, cap and icon).
   */
  private drawOnTop(): void {
    let order = PAUSE.panel.renderOrder;
    this.holder.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      const material = mesh.material as Material;
      material.depthTest = false;
      material.depthWrite = false;
      // In the transparent pass, so the order below holds against the transparent board.
      material.transparent = true;
      mesh.renderOrder = order++;
    });
  }

  get isOpen(): boolean {
    return this.open;
  }

  /** Where the pause button is, while it shows (for the tutorial). */
  buttonWorld(out: Vector3): Vector3 | null {
    return this.pauseButton.worldPosition(out);
  }

  /**
   * Opens the panel in front of the head, at the same spot from the eyes as
   * the end panel (sized with the board, so it matches the player's reach).
   */
  show(head: Vector3, forward: Vector3, boardScale: number): void {
    this.open = true;
    this.following = false;
    this.scale = boardScale;
    this.pauseButton.hide();
    this.yaw = Math.atan2(-forward.x, -forward.z);
    this.place(head, 1);
    this.panel.visible = true;
    this.panel.popIn(0.2);
    for (const button of this.buttons) {
      button.reset();
      // The finger that poked the pause button must not press a panel button at once.
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

  /** The pause button while the battle runs. True on the frame it is poked. */
  updateButton(dt: number, hands: HandState[], enabled: boolean): boolean {
    return this.pauseButton.update(dt, hands, enabled && !this.open);
  }

  hideButton(): void {
    this.pauseButton.hide();
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
