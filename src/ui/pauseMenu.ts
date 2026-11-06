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
import { SOUND_CATEGORIES, SOUND_SETTINGS, type SoundCategory } from '../config/sounds.js';
import { mark } from '../debug/perfMarks.js';
import type { HandState } from '../player/hands.js';
import { degToRad } from '../rules/boardMath.js';
import { post } from '../world/shapes.js';
import { Panel, PANEL_INK } from './panel.js';
import { PokeButton } from './pokeButton.js';
import { Slider } from './slider.js';
import { drawBanner, fitFont, type ButtonIcon } from './uiImages.js';

export type PauseAction = 'resume' | 'resetTable' | 'measureReach' | 'restart';

/** The main page's buttons. Settings opens the settings page (in the panel, not an action for the game). */
const BUTTONS: { action: PauseAction | 'settings'; icon: ButtonIcon; label: string }[] = [
  { action: 'resume', icon: 'play', label: 'Resume' },
  { action: 'resetTable', icon: 'table', label: 'Reset table' },
  { action: 'settings', icon: 'settings', label: 'Settings' },
  { action: 'restart', icon: 'restart', label: 'Restart' },
];

/** One row of the settings page's sound section. */
interface SoundRow {
  category: SoundCategory;
  label: string;
  mute: PokeButton;
  slider: Slider;
  y: number;
}

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
  /** The settings page: measure reach again, and the sound groups' volumes. */
  private settings: Panel;
  private page: 'main' | 'settings' = 'main';
  private back: PokeButton;
  private reach: PokeButton;
  private rows: SoundRow[] = [];
  private yaw = 0;
  private following = false;
  private scale = 1;

  /** `parent` is the world (meters) for the panel, `board` the boardLift (cm) for the pause button. */
  constructor(
    parent: Object3D,
    board: Object3D,
    private audio: GameAudio,
  ) {
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
    // The settings page, on its own panel at the same spot (a little bigger).
    const S = PAUSE.settings;
    this.settings = new Panel(this.holder, {
      width: S.width,
      height: S.height,
      radius,
      centerY: S.y,
      tiltDeg,
      layoutWidth: Math.round(S.width * S.pxPerCm),
      canvasScale: 2,
    });
    const add = (o: Object3D, x: number, y: number): void => {
      o.position.set(x, y, 0);
      this.settings.root.add(o);
    };
    this.back = new PokeButton(audio, { radius: S.buttonRadius, icon: 'back' });
    add(this.back.group, S.backAt[0], S.backAt[1]);
    this.reach = new PokeButton(audio, { radius: S.buttonRadius, icon: 'reach' });
    add(this.reach.group, S.reachAt[0], S.reachAt[1]);
    SOUND_CATEGORIES.forEach((c, i) => {
      const y = S.firstRowY - i * S.rowGap;
      const mute = new PokeButton(audio, { radius: S.buttonRadius, icon: audio.settings.muted(c.id) ? 'muted' : 'sound' });
      add(mute.group, S.muteX, y);
      const slider = new Slider(audio, { length: S.sliderLength, steps: SOUND_SETTINGS.steps, value: audio.settings.volume(c.id) });
      add(slider.group, S.sliderX, y);
      const row: SoundRow = { category: c.id, label: c.label, mute, slider, y };
      // While dragging only the sound follows (no repaint); the number on the panel updates when it is let go.
      slider.onChange = (value, final) => {
        audio.settings.setVolume(c.id, value, final);
        if (final) this.repaintSettings();
        this.showMute(row);
      };
      this.rows.push(row);
    });
    this.repaintSettings();
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
    this.showPage('main');
  }

  hide(): void {
    this.open = false;
    this.panel.visible = false;
    this.settings.visible = false;
  }

  /** One page shows, its buttons reset and locked a moment (the finger that opened it must not press one at once). */
  private showPage(page: 'main' | 'settings'): void {
    this.page = page;
    this.panel.visible = page === 'main';
    this.settings.visible = page === 'settings';
    (page === 'main' ? this.panel : this.settings).popIn(0.2);
    const buttons = page === 'main' ? this.buttons : [this.back, this.reach, ...this.rows.map((r) => r.mute)];
    for (const button of buttons) {
      button.reset();
      button.lock(POKE.lockAfterChange);
    }
    if (page === 'settings') {
      for (const row of this.rows) {
        row.slider.setValue(this.audio.settings.volume(row.category));
        row.slider.reset();
        row.slider.lock(POKE.lockAfterChange);
        this.showMute(row);
      }
      this.repaintSettings();
    }
  }

  /** The mute button shows a crossed speaker while the group is silent. */
  private showMute(row: SoundRow): void {
    row.mute.setIcon(this.audio.settings.level(row.category) <= 0 ? 'muted' : 'sound');
  }

  private repaintSettings(): void {
    mark('panel redraw');
    this.settings.paint((c, w, h) => this.drawSettings(c, w, h));
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
    if (this.page === 'settings') return this.updateSettings(dt, hands);
    this.panel.update(dt);
    let action: PauseAction | 'settings' | null = null;
    for (const [i, button] of this.buttons.entries()) {
      if (button.update(hands, dt) && !action) action = BUTTONS[i].action;
    }
    if (action === 'settings') {
      this.showPage('settings');
      return null;
    }
    return action;
  }

  private updateSettings(dt: number, hands: HandState[]): PauseAction | null {
    this.settings.update(dt);
    if (this.back.update(hands, dt)) {
      this.showPage('main');
      return null;
    }
    if (this.reach.update(hands, dt)) return 'measureReach';
    for (const row of this.rows) {
      if (row.mute.update(hands, dt)) {
        const { settings } = this.audio;
        // Unmuting a group that was turned all the way down brings it back at half.
        if (settings.level(row.category) > 0) settings.setMuted(row.category, true);
        else if (settings.volume(row.category) <= 0) settings.setVolume(row.category, 0.5);
        else settings.setMuted(row.category, false);
        row.slider.setValue(settings.volume(row.category));
        this.showMute(row);
        this.repaintSettings();
      }
      row.slider.update(hands, dt);
    }
    return null;
  }

  /** The settings page: a banner, the reach row, then one row per sound group (its name and volume). */
  private drawSettings(c: CanvasRenderingContext2D, w: number, h: number): void {
    const S = PAUSE.settings;
    const px = w / S.width;
    const toX = (x: number): number => w / 2 + x * px;
    const toY = (y: number): number => h / 2 - y * px;
    const bannerH = 62;
    drawBanner(c, w * 0.3, 14, w * 0.4, bannerH);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#fff4dc';
    fitFont(c, 'Settings', w * 0.4 - 40, 36);
    c.fillText('Settings', w / 2, 14 + bannerH * 0.45);
    // Small labels under the round buttons at the top.
    c.fillStyle = '#2f5f22';
    fitFont(c, 'Back', 90, 18);
    c.fillText('Back', toX(S.backAt[0]), toY(S.backAt[1] - S.buttonRadius * POKE.rimScale) + 14);
    c.textAlign = 'left';
    c.fillStyle = PANEL_INK;
    fitFont(c, 'Hands: measure your reach again', toX(S.reachAt[0] - 3) - toX(S.labelX), 24);
    c.fillText('Hands: measure your reach again', toX(S.labelX), toY(S.reachAt[1]));
    c.fillStyle = '#8a5a34';
    fitFont(c, 'Sound: poke the speaker to mute, slide or poke - and + to set', w - toX(S.labelX) * 2, 18);
    c.fillText('Sound: poke the speaker to mute, slide or poke - and + to set', toX(S.labelX), toY(S.soundTitleY));
    for (const row of this.rows) {
      const level = this.audio.settings.level(row.category);
      c.fillStyle = PANEL_INK;
      c.textAlign = 'left';
      fitFont(c, row.label, toX(S.muteX - 2.5) - toX(S.labelX), 24);
      c.fillText(row.label, toX(S.labelX), toY(row.y) - 9);
      c.fillStyle = level <= 0 ? '#a33a2a' : '#2f5f22';
      fitFont(c, level <= 0 ? 'Off' : `${Math.round(level * 100)}%`, 80, 18);
      c.fillText(level <= 0 ? 'Off' : `${Math.round(level * 100)}%`, toX(S.labelX), toY(row.y) + 13);
    }
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
    fitFont(c, 'Restart starts the battle again. Settings: reach and sound.', w - 70, 18);
    c.fillText('Restart starts the battle again. Settings: reach and sound.', w / 2, (subtitleY + labelY) / 2 + 4);
  }
}
