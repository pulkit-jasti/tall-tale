// Pause (docs/controls-and-ui.md section 5). Two parts:
//
//   Pause button: a round button on a stand straight in front, outside the
//   ring, on the Next button's spot but lower (it steps aside while Next
//   shows). It stays there while a battle runs, poked with either hand.
//
//   Pause panel: the battle freezes and a panel comes up in front of the
//   player with poke buttons: Resume, Reset table, Settings, Restart and
//   (while the tutorial runs) Skip tutorial. It is placed from the head when it opens, not on the board, so
//   its buttons are always in reach, even when the board ended up somewhere
//   odd (that is what Reset table is for).
//
// Sizes in cm (the rigs are scaled 0.01), poked like every other button.
import { Group, type Object3D, type Vector3 } from 'three';
import type { GameAudio } from '../audio/sound.js';
import { mic } from '../audio/mic.js';
import { BOARD, PAUSE, POKE, SLIDER, SWITCH, UI_SPACING } from '../config/game.js';
import { SOUND_CATEGORIES, SOUND_SETTINGS, type SoundCategory } from '../config/sounds.js';
import { mark } from '../debug/perfMarks.js';
import { access, hornHearsMic } from '../player/accessSettings.js';
import type { HandState } from '../player/hands.js';
import { settingsTabRowY } from '../rules/reach.js';
import {
  Switch,
  type Control,
  armControls,
  bottomRowY,
  drawLine,
  drawOnTop,
  drawTitleBanner,
  LazyFollow,
  Panel,
  panelMap,
  PokeButton,
  rowX,
  Slider,
  StandButton,
  UI_COLORS,
  uiCenterY,
  type ButtonIcon,
} from './kit/index.js';

export type PauseAction = 'resume' | 'resetTable' | 'measureReach' | 'restart' | 'skipTutorial';

/**
 * The main page's buttons. Settings opens the settings page (in the panel, not
 * an action for the game). Skip tutorial shows only while the tutorial runs,
 * so no player is ever stuck in it.
 */
const BUTTONS: { action: PauseAction | 'settings'; icon: ButtonIcon; label: string }[] = [
  { action: 'resume', icon: 'play', label: 'Resume' },
  // Reset table lives in the settings now (Access tab), with Measure reach.
  { action: 'settings', icon: 'settings', label: 'Settings' },
  { action: 'restart', icon: 'restart', label: 'Restart' },
  { action: 'skipTutorial', icon: 'skip', label: 'Skip tutorial' },
];
const SKIP_INDEX = BUTTONS.findIndex((b) => b.action === 'skipTutorial');

/** The settings' categories, as tabs along the top of the page. */
type SettingsTab = 'sound' | 'access';

/** Access first (and open by default), then Sound. Centered in their row (PAUSE.settings.tabX). */
const SETTINGS_TABS: { id: SettingsTab; icon: ButtonIcon; label: string }[] = [
  { id: 'access', icon: 'access', label: 'Access' },
  { id: 'sound', icon: 'sound', label: 'Sound' },
];

/** One row of the settings page's sound section. */
interface SoundRow {
  category: SoundCategory;
  label: string;
  slider: Slider;
  y: number;
}

/** X of each button's center on the panel (cm), left to right. */
const buttonX = (index: number): number => rowX(index, BUTTONS.length, PAUSE.panel.buttonGap);

const CM = 0.01;

export class PauseMenu {
  /** World (meters): placed in front of the head, and follows it lazily while open. */
  private holder = new Group();
  private panel: Panel;
  private buttons: PokeButton[] = [];
  private pauseButton: StandButton;
  private buttonTopPx = 0;
  private open = false;
  /** Skip tutorial shows (only while the tutorial runs). */
  private skipShown = true;
  /** The settings page: measure reach again, and the sound groups' volumes. */
  private settings: Panel;
  private page: 'main' | 'settings' = 'main';
  /** Opened from the welcome panel: only the settings page, Back closes it. */
  private settingsOnly = false;
  private back: PokeButton;
  private reach: PokeButton;
  /** Reset table, in the Access tab under Quiet horn. */
  private table: PokeButton;
  private rows: SoundRow[] = [];
  /** The settings' categories: one tab button each, and a group with its controls (only the chosen one shows). */
  private tab: SettingsTab = 'access';
  private tabButtons: PokeButton[] = [];
  private tabGroups: Record<SettingsTab, Group> = { sound: new Group(), access: new Group() };
  private bellSwitch: Switch;
  /** Follows the head lazily while open, like the Quest's own menus. */
  private follow: LazyFollow;

  /** `parent` is the world (meters) for the panel, `board` the boardLift (cm) for the pause button. */
  constructor(
    parent: Object3D,
    board: Object3D,
    private audio: GameAudio,
  ) {
    const { width, height, radius, tiltDeg, buttonRadius, buttonMargin } = PAUSE.panel;
    parent.add(this.holder);
    this.follow = new LazyFollow(this.holder, { ...PAUSE.follow, recenter: 0.12 });
    // Right in front of the eyes, never too high or too low (UI_ZONE).
    this.panel = new Panel(this.holder, { width, height, radius, centerY: uiCenterY(height, tiltDeg), tiltDeg, layoutWidth: Math.round(width * 15), canvasScale: 2 });
    const rim = buttonRadius * POKE.rimScale;
    const buttonY = bottomRowY(height, rim, buttonMargin);
    BUTTONS.forEach((b, i) => {
      const button = new PokeButton(audio, { radius: buttonRadius, icon: b.icon });
      button.group.position.set(buttonX(i), buttonY, 0);
      this.panel.root.add(button.group);
      this.buttons.push(button);
    });
    this.buttonTopPx = panelMap(width, height, this.panel.layoutWidth, this.panel.layoutHeight).y(buttonY + rim);
    this.panel.paint((c, w) => this.draw(c, w));
    // The settings page, on its own panel at the same spot (a little bigger).
    const S = PAUSE.settings;
    this.settings = new Panel(this.holder, {
      width: S.width,
      height: S.height,
      radius,
      centerY: uiCenterY(S.height, tiltDeg),
      tiltDeg,
      layoutWidth: Math.round(S.width * S.pxPerCm),
      canvasScale: 2,
    });
    const add = (o: Object3D, x: number, y: number, parent: Object3D = this.settings.root): void => {
      o.position.set(x, y, 0);
      parent.add(o);
    };
    // Back at the top left, beside the title.
    this.back = new PokeButton(audio, { radius: S.backRadius, icon: 'back' });
    add(this.back.group, S.backAt[0], S.backAt[1]);
    // The tabs, below everything: one category of settings at a time, the chosen one green.
    const tabY = settingsTabRowY();
    for (const [i, tab] of SETTINGS_TABS.entries()) {
      const button = new PokeButton(audio, { radius: S.tabRadius, icon: tab.icon });
      add(button.group, S.tabX[i], tabY);
      this.tabButtons.push(button);
      this.settings.root.add(this.tabGroups[tab.id]);
    }
    // Accessibility: measure the reach again, and a quiet horn (it never listens to the mic: hold it at the mouth), an on and off switch.
    const controlLeft = S.sliderX - S.sliderLength / 2 - SLIDER.handleRadius;
    this.reach = new PokeButton(audio, { radius: S.reachRadius, icon: 'reach' });
    add(this.reach.group, controlLeft + S.reachRadius * POKE.rimScale, S.firstRowY, this.tabGroups.access);
    this.bellSwitch = new Switch(audio, { on: !hornHearsMic() });
    add(this.bellSwitch.group, controlLeft + SWITCH.width / 2, S.firstRowY - S.accessRowGap, this.tabGroups.access);
    this.bellSwitch.onChange = (on) => {
      access.setQuietHorn(on);
      this.repaintSettings();
    };
    // Reset table (was on the pause panel's main page): the board placed again at its starting height.
    this.table = new PokeButton(audio, { radius: S.reachRadius, icon: 'table' });
    add(this.table.group, controlLeft + S.reachRadius * POKE.rimScale, S.firstRowY - 2 * S.accessRowGap, this.tabGroups.access);
    SOUND_CATEGORIES.forEach((c, i) => {
      const y = S.firstRowY - i * S.rowGap;
      // Just a slider per group: all the way down is off.
      const slider = new Slider(audio, { length: S.sliderLength, steps: SOUND_SETTINGS.steps, value: audio.settings.volume(c.id) });
      add(slider.group, S.sliderX, y, this.tabGroups.sound);
      // While dragging only the sound follows (no repaint); the number on the panel updates when it is let go.
      slider.onChange = (value, final) => {
        audio.settings.setVolume(c.id, value, final);
        if (final) this.repaintSettings();
      };
      this.rows.push({ category: c.id, label: c.label, slider, y });
    });
    this.repaintSettings();
    // Nothing ever hides the pause panel (it went through the towers): it draws on top, the board first, then each button's parts.
    drawOnTop(this.holder, PAUSE.panel.renderOrder);
    // The pause button on its stand straight in front, its face tilted up toward the eyes, like the Next button.
    this.pauseButton = new StandButton(board, audio, { ...PAUSE.button, icon: 'pause' });
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
  /** `skipShown`: the tutorial runs, so Skip tutorial is on the panel. */
  show(head: Vector3, forward: Vector3, boardScale: number, skipShown = false): void {
    this.open = true;
    this.settingsOnly = false;
    this.pauseButton.show(false);
    if (skipShown !== this.skipShown) {
      this.skipShown = skipShown;
      this.buttons[SKIP_INDEX].group.visible = skipShown;
      this.panel.paint((c, w) => this.draw(c, w));
    }
    this.follow.snap(head, forward, BOARD.eyeToBoard * boardScale, CM * boardScale);
    this.showPage('main');
  }

  hide(): void {
    this.open = false;
    this.settingsOnly = false;
    this.panel.visible = false;
    this.settings.visible = false;
  }

  /**
   * Only the settings page, from the welcome panel (no battle to pause): it
   * opens in front of the head like the pause panel, and Back closes it.
   */
  showSettings(head: Vector3, forward: Vector3, boardScale: number): void {
    this.show(head, forward, boardScale);
    this.settingsOnly = true;
    this.showPage('settings');
  }

  /** One page shows, its buttons reset and locked a moment (the finger that opened it must not press one at once). */
  private showPage(page: 'main' | 'settings'): void {
    this.page = page;
    this.panel.visible = page === 'main';
    this.settings.visible = page === 'settings';
    // It follows the head only once the eyes go past the page's edge: the big settings page lets them roam to its corners.
    this.follow.fitTo(page === 'main' ? PAUSE.panel.width : PAUSE.settings.width, PAUSE.panel.radius);
    (page === 'main' ? this.panel : this.settings).popIn(0.2);
    if (page === 'main') {
      armControls(this.buttons);
      return;
    }
    for (const row of this.rows) row.slider.setValue(this.audio.settings.volume(row.category));
    this.showTab(this.tab);
  }

  /** One category of settings shows, its tab green and the others grey; its controls start fresh. */
  private showTab(tab: SettingsTab): void {
    this.tab = tab;
    SETTINGS_TABS.forEach((t, i) => {
      this.tabGroups[t.id].visible = t.id === tab;
      this.tabButtons[i].setColor(t.id === tab ? POKE.color : PAUSE.settings.tabOffColor);
    });
    // Without a mic the quiet horn is the only choice: the switch shows On, locked.
    this.bellSwitch.set(!hornHearsMic());
    this.bellSwitch.setLocked(!mic.on);
    armControls([this.back, ...this.tabButtons, ...this.tabControls()]);
    this.repaintSettings();
  }

  /** The controls of the tab that shows. */
  private tabControls(): Control[] {
    return this.tab === 'sound' ? this.rows.map((r) => r.slider) : [this.reach, this.bellSwitch, this.table];
  }

  private repaintSettings(): void {
    mark('panel redraw');
    this.settings.paint((c, w, h) => this.drawSettings(c, w, h));
  }

  /** The pause button while the battle runs (`enabled`: a battle is on and the Next button is not out). True on the frame it is poked. */
  updateButton(dt: number, hands: HandState[], enabled: boolean): boolean {
    this.pauseButton.show(enabled && !this.open);
    return this.pauseButton.update(hands, dt);
  }

  hideButton(): void {
    this.pauseButton.show(false);
  }

  /** The panel while paused. Returns the action of the button poked this frame, if any. */
  update(dt: number, hands: HandState[], head: Vector3, forward: Vector3): PauseAction | null {
    if (!this.open) return null;
    // A player who paused by accident and turned around still finds it.
    this.follow.update(dt, head, forward);
    if (this.page === 'settings') return this.updateSettings(dt, hands);
    this.panel.update(dt);
    let action: PauseAction | 'settings' | null = null;
    for (const [i, button] of this.buttons.entries()) {
      if (!button.group.visible) continue;
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
      if (this.settingsOnly) this.hide();
      else this.showPage('main');
      return null;
    }
    for (const [i, button] of this.tabButtons.entries()) {
      if (button.update(hands, dt) && SETTINGS_TABS[i].id !== this.tab) {
        this.showTab(SETTINGS_TABS[i].id);
        return null;
      }
    }
    if (this.tab === 'sound') {
      for (const row of this.rows) row.slider.update(hands, dt);
      return null;
    }
    if (this.reach.update(hands, dt)) return 'measureReach';
    if (this.table.update(hands, dt)) return 'resetTable';
    this.bellSwitch.update(hands, dt);
    return null;
  }

  /**
   * The settings page: Back and the title at the top, the chosen tab's
   * rows, each with its name on the left, then below everything the tabs,
   * each name beside its button (the chosen one bold green and
   * underlined, the others light).
   */
  private drawSettings(c: CanvasRenderingContext2D, w: number, h: number): void {
    const S = PAUSE.settings;
    const at = panelMap(S.width, S.height, w, h);
    const left = at.x(S.labelX);
    drawTitleBanner(c, 'Settings', at.x(S.titleX) - (S.titleWidth / 2) * at.px, UI_SPACING.top * at.px, S.titleWidth * at.px, 56, 34);
    // Back's label under it, a little gap below its rim.
    const under = at.y(S.backAt[1] - S.backRadius * POKE.rimScale) + UI_SPACING.labelGap * at.px + 9;
    drawLine(c, 'Back', at.x(S.backAt[0]), under, 110, 18, UI_COLORS.accent);
    // Each tab's name to the right of its button (the chosen one underlined).
    const tabY = at.y(settingsTabRowY());
    SETTINGS_TABS.forEach((t, i) => {
      const chosen = t.id === this.tab;
      const x = at.x(S.tabX[i] + S.tabRadius * POKE.rimScale + UI_SPACING.labelGap);
      drawLine(c, t.label, x, tabY, 5 * at.px, chosen ? 24 : 21, chosen ? UI_COLORS.accent : UI_COLORS.note, 'left');
      if (chosen) {
        c.fillStyle = UI_COLORS.accent;
        c.fillRect(x, tabY + 14, 64, 3);
      }
    });
    // Each row's name on the left, clear of its control.
    const labelRight = at.x(S.sliderX - S.sliderLength / 2 - SLIDER.handleRadius - 1);
    const name = (text: string, rowY: number, note: string, noteColor: string): void => {
      const y = at.y(rowY);
      drawLine(c, text, left, y - 10, labelRight - left, 26, UI_COLORS.ink, 'left');
      drawLine(c, note, left, y + 14, labelRight - left, 20, noteColor, 'left');
    };
    if (this.tab === 'sound') {
      for (const row of this.rows) {
        const level = this.audio.settings.level(row.category);
        name(row.label, row.y, level <= 0 ? 'Off' : `${Math.round(level * 100)}%`, level <= 0 ? UI_COLORS.warn : UI_COLORS.accent);
      }
      return;
    }
    name('Your reach', S.firstRowY, 'Measure it again', UI_COLORS.note);
    name('Quiet horn', S.firstRowY - S.accessRowGap, mic.on ? 'Hold it, no blowing' : 'No mic: always quiet', mic.on ? UI_COLORS.note : UI_COLORS.warn);
    name('Table', S.firstRowY - 2 * S.accessRowGap, 'Put it back in place', UI_COLORS.note);
  }

  private draw(c: CanvasRenderingContext2D, w: number): void {
    const at = panelMap(PAUSE.panel.width, PAUSE.panel.height, w, this.panel.layoutHeight);
    drawTitleBanner(c, 'Paused', w * 0.25, UI_SPACING.top * at.px, w * 0.5, 74, 40);
    // A word over each button, nothing else, a little gap above their rims.
    const labelY = this.buttonTopPx - UI_SPACING.labelGap * at.px - 11;
    BUTTONS.forEach((b, i) => {
      if (i === SKIP_INDEX && !this.skipShown) return;
      drawLine(c, b.label, at.x(buttonX(i)), labelY, PAUSE.panel.buttonGap * at.px - 8, 22, UI_COLORS.accent);
    });
  }
}
