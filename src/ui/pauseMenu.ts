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
import { BOARD, MENU, PAUSE, POKE, SLIDER, SWITCH, TABS, UI_SPACING } from '../config/game.js';
import { SOUND_CATEGORIES, SOUND_SETTINGS, type SoundCategory } from '../config/sounds.js';
import { mark } from '../debug/perfMarks.js';
import { access, hornHearsMic } from '../player/accessSettings.js';
import { progress } from '../player/progress.js';
import type { HandState } from '../player/hands.js';
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
  PanelHeader,
  panelMap,
  PokeButton,
  Tabs,
  rowPanelWidth,
  rowX,
  Slider,
  StandButton,
  UI_COLORS,
  uiCenterY,
  type ButtonIcon,
} from './kit/index.js';

export type PauseAction = 'resume' | 'resetTable' | 'measureReach' | 'restart' | 'skipTutorial' | 'quitToMenu';

/**
 * The main page's buttons, and when each shows. Settings opens the settings
 * page (in the panel, not an action for the game). Skip tutorial shows only
 * while the tutorial runs, so no player is ever stuck in it; Menu (back to
 * the home screen, v2 run 2) in every other battle. The panel sizes itself
 * to the buttons that show (Panel.resize, rowPanelWidth).
 */
const BUTTONS: { action: PauseAction | 'settings'; icon: ButtonIcon; label: string; when: 'always' | 'teaching' | 'battle' }[] = [
  { action: 'resume', icon: 'play', label: 'Resume', when: 'always' },
  // Reset table lives in the settings now (Access tab), with Measure reach.
  { action: 'settings', icon: 'settings', label: 'Settings', when: 'always' },
  { action: 'restart', icon: 'restart', label: 'Restart', when: 'always' },
  { action: 'skipTutorial', icon: 'skip', label: 'Skip tutorial', when: 'teaching' },
  { action: 'quitToMenu', icon: 'home', label: 'Menu', when: 'battle' },
];

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

const CM = 0.01;

export class PauseMenu {
  /** World (meters): placed in front of the head, and follows it lazily while open. */
  private holder = new Group();
  private panel: Panel;
  private buttons: PokeButton[] = [];
  private pauseButton: StandButton;
  private buttonTopPx = 0;
  private open = false;
  /** The tutorial runs (Skip tutorial shows) or not (Menu shows); null before the first show. */
  private teaching: boolean | null = null;
  /** The buttons that show now (indexes into BUTTONS), left to right. */
  private shown: number[] = [];
  /** The settings page: measure reach again, and the sound groups' volumes. */
  private settings: Panel;
  private page: 'main' | 'settings' = 'main';
  /** Opened from the welcome panel: only the settings page, Back closes it. */
  private settingsOnly = false;
  private back: PanelHeader;
  private reach: PokeButton;
  /** Reset table, in the Access tab under Quiet horn. */
  private table: PokeButton;
  private rows: SoundRow[] = [];
  /** The settings' categories: the floating tabs, and a group with each one's controls (only the chosen one shows). */
  private tab: SettingsTab = 'access';
  private tabs: Tabs;
  private tabGroups: Record<SettingsTab, Group> = { sound: new Group(), access: new Group() };
  private bellSwitch: Switch;
  /** "Unlock all tools" (Access tab, v2 run 2). */
  private unlockSwitch: Switch;
  /** The "Unlock all tools" switch was flipped (the game saves it and the shelves show it). */
  onUnlockAll: (on: boolean) => void = () => {};
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
    for (const b of BUTTONS) {
      const button = new PokeButton(audio, { radius: buttonRadius, icon: b.icon });
      button.group.position.y = buttonY;
      this.panel.root.add(button.group);
      this.buttons.push(button);
    }
    this.buttonTopPx = panelMap(width, height, this.panel.layoutWidth, this.panel.layoutHeight).y(buttonY + rim);
    this.layoutButtons(false);
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
    // The title and Back float over the page (navigation outside, content inside).
    this.back = new PanelHeader(audio, 'Settings', { back: true });
    this.back.placeAbove(S.height);
    this.settings.root.add(this.back.group);
    // The tabs under the page, centered (the same floating tabs as Custom Game): one category at a time.
    this.tabs = new Tabs(
      audio,
      SETTINGS_TABS.map((t) => t.label),
    );
    add(this.tabs.group, 0, -S.height / 2 - TABS.below - TABS.height / 2);
    this.tabs.onChange = (i) => this.showTab(SETTINGS_TABS[i].id);
    for (const tab of SETTINGS_TABS) this.settings.root.add(this.tabGroups[tab.id]);
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
    // Unlock all tools (v2 run 2, for judges): every tool on the shelf can be picked. Tools only, never levels.
    this.unlockSwitch = new Switch(audio, { on: progress.unlockAll });
    add(this.unlockSwitch.group, controlLeft + SWITCH.width / 2, S.firstRowY - 3 * S.accessRowGap, this.tabGroups.access);
    this.unlockSwitch.onChange = (on) => {
      this.onUnlockAll(on);
      this.repaintSettings();
    };
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
  /** `teaching`: the tutorial runs, so Skip tutorial is on the panel (else Menu is). */
  show(head: Vector3, forward: Vector3, boardScale: number, teaching = false): void {
    this.open = true;
    this.settingsOnly = false;
    this.fixed = false;
    this.pauseButton.show(false);
    this.layoutButtons(teaching);
    this.follow.snap(head, forward, BOARD.eyeToBoard * boardScale, CM * boardScale);
    this.showPage('main');
  }

  /**
   * Only the buttons for this battle show, spread evenly, and the panel takes
   * the width they need (never a gap where a hidden one was).
   */
  private layoutButtons(teaching: boolean): void {
    if (teaching === this.teaching) return;
    this.teaching = teaching;
    const P = PAUSE.panel;
    this.shown = BUTTONS.flatMap((b, i) => (b.when === 'always' || (b.when === 'teaching') === teaching ? [i] : []));
    this.buttons.forEach((button, i) => (button.group.visible = this.shown.includes(i)));
    this.shown.forEach((i, k) => (this.buttons[i].group.position.x = rowX(k, this.shown.length, P.buttonGap)));
    this.panel.resize(rowPanelWidth(this.shown.length, P.buttonGap, P.buttonRadius * POKE.rimScale, P.buttonMargin, P.minWidth), P.height);
    this.panel.paint((c, w) => this.draw(c, w));
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
  /** `board`: opened from the home screen, the board's middle (world): the page sits exactly like the menu panels and stays put. */
  showSettings(head: Vector3, forward: Vector3, boardScale: number, board: Vector3 | null = null): void {
    this.show(head, forward, boardScale);
    this.settingsOnly = true;
    // From the home screen it is placed from the board, at the menu panels' height (menuCenterY: MENU.drop under the
    // UI_ZONE spot), so every menu sits the same height over the ground, and it never follows the head (the player is
    // looking right at it). In a battle it follows the head.
    this.fixed = board !== null;
    if (board) this.follow.snap(board, forward, MENU.drop * CM * boardScale, CM * boardScale);
    this.showPage('settings');
  }

  /** Opened from the home screen: placed once, never follows the head. */
  private fixed = false;

  /** One page shows, its buttons reset and locked a moment (the finger that opened it must not press one at once). */
  private showPage(page: 'main' | 'settings'): void {
    this.page = page;
    this.panel.visible = page === 'main';
    this.settings.visible = page === 'settings';
    // It follows the head only once the eyes go past the page's edge: the big settings page lets them roam to its corners.
    this.follow.fitTo(page === 'main' ? this.panel.width : PAUSE.settings.width, PAUSE.panel.radius);
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
      if (t.id === tab) this.tabs.select(i);
    });
    // Without a mic the quiet horn is the only choice: the switch shows On, locked.
    this.bellSwitch.set(!hornHearsMic());
    this.bellSwitch.setLocked(!mic.on);
    this.unlockSwitch.set(progress.unlockAll);
    armControls([this.back, this.tabs, ...this.tabControls()]);
    this.repaintSettings();
  }

  /** The controls of the tab that shows. */
  private tabControls(): Control[] {
    return this.tab === 'sound' ? this.rows.map((r) => r.slider) : [this.reach, this.bellSwitch, this.table, this.unlockSwitch];
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
    // A player who paused by accident and turned around still finds it (not from the home screen: it stays put there).
    if (!this.fixed) this.follow.update(dt, head, forward);
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
    // A poked tab calls showTab (onChange).
    const before = this.tab;
    this.tabs.update(hands, dt);
    if (this.tab !== before) return null;
    if (this.tab === 'sound') {
      for (const row of this.rows) row.slider.update(hands, dt);
      return null;
    }
    if (this.reach.update(hands, dt)) return 'measureReach';
    if (this.table.update(hands, dt)) return 'resetTable';
    this.bellSwitch.update(hands, dt);
    this.unlockSwitch.update(hands, dt);
    return null;
  }

  /**
   * The settings page: only the chosen tab's rows, each with its name on the
   * left (the title, Back and the tabs float outside the page).
   */
  private drawSettings(c: CanvasRenderingContext2D, w: number, h: number): void {
    const S = PAUSE.settings;
    const at = panelMap(S.width, S.height, w, h);
    const left = at.x(S.labelX);
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
    name('Unlock all tools', S.firstRowY - 3 * S.accessRowGap, 'Tools only, not levels', UI_COLORS.note);
  }

  private draw(c: CanvasRenderingContext2D, w: number): void {
    const at = panelMap(this.panel.width, this.panel.height, w, this.panel.layoutHeight);
    // The title keeps its size whatever the width (the panel is as wide as its buttons need).
    const titleW = Math.min(w * 0.6, 22 * at.px);
    drawTitleBanner(c, 'Paused', (w - titleW) / 2, UI_SPACING.top * at.px, titleW, 74, 40);
    // A word over each button that shows, nothing else, a little gap above their rims.
    const labelY = this.buttonTopPx - UI_SPACING.labelGap * at.px - 11;
    for (const i of this.shown) {
      drawLine(c, BUTTONS[i].label, at.x(this.buttons[i].group.position.x), labelY, PAUSE.panel.buttonGap * at.px - 8, 22, UI_COLORS.accent);
    }
  }
}
