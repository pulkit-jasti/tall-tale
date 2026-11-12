// The main menu (docs/menus.md section 4): the front panel with round poke
// buttons in different sizes, a word over each. Campaign is the biggest, in
// the middle; Daily Battle and Custom Game beside it; Settings and Tutorial
// (replay it) smaller, below. Every option shows and can be poked, none is
// locked. Daily and Custom are not built yet: a poke shows "Coming soon"
// over the button for a moment (decided 2026-11-11). Built from the UI
// library only. The panel is redrawn only when a word changes.
import type { Object3D } from 'three';
import type { GameAudio } from '../../audio/sound.js';
import { MENU, POKE, UI_SPACING } from '../../config/game.js';
import type { HandState } from '../../player/hands.js';
import { armControls, drawLine, drawTitleBanner, Panel, panelMap, PokeButton, UI_COLORS, uiCenterY, type ButtonIcon } from '../kit/index.js';

export type MainChoice = 'campaign' | 'settings' | 'replay' | null;
type Id = 'campaign' | 'daily' | 'custom' | 'settings' | 'replay';

interface Entry {
  id: Id;
  label: string;
  button: PokeButton;
  x: number;
  y: number;
  radius: number;
  /** The top of its word, under the button (cm). */
  labelY: number;
}

export class MainMenu {
  private panel: Panel;
  private entries: Entry[] = [];
  /** The entry that says "Coming soon" now, and for how long yet (seconds). */
  private soon: { id: Id; left: number } | null = null;

  constructor(parent: Object3D, audio: GameAudio) {
    const M = MENU.main;
    this.panel = new Panel(parent, {
      width: M.width,
      height: M.height,
      radius: M.radius,
      centerY: uiCenterY(M.height, M.tiltDeg),
      tiltDeg: M.tiltDeg,
      layoutWidth: Math.round(M.width * 15),
      canvasScale: 2,
    });
    // Each word sits under its row's biggest rim, so a row's words line up.
    const topLabel = M.heroAt[1] - M.heroRadius * POKE.rimScale - UI_SPACING.labelGap;
    const bottomLabel = M.smallY - M.smallRadius * POKE.rimScale - UI_SPACING.labelGap;
    const add = (id: Id, label: string, icon: ButtonIcon, x: number, y: number, radius: number, labelY: number): void => {
      const button = new PokeButton(audio, { radius, icon });
      button.group.position.set(x, y, 0);
      this.panel.root.add(button.group);
      this.entries.push({ id, label, button, x, y, radius, labelY });
    };
    add('daily', 'Daily Battle', 'daily', -M.sideX, M.sideY, M.sideRadius, topLabel);
    add('campaign', 'Campaign', 'campaign', M.heroAt[0], M.heroAt[1], M.heroRadius, topLabel);
    add('custom', 'Custom Game', 'custom', M.sideX, M.sideY, M.sideRadius, topLabel);
    add('settings', 'Settings', 'settings', -M.smallX, M.smallY, M.smallRadius, bottomLabel);
    add('replay', 'Tutorial', 'restart', M.smallX, M.smallY, M.smallRadius, bottomLabel);
    this.paint();
  }

  get visible(): boolean {
    return this.panel.visible;
  }

  show(): void {
    this.panel.visible = true;
    this.panel.popIn(0.25);
    this.clearSoon();
    // The finger that opened it never pokes a button at once.
    armControls(this.entries.map((e) => e.button));
  }

  hide(): void {
    this.panel.visible = false;
    this.clearSoon();
  }

  update(hands: HandState[], dt: number): MainChoice {
    if (!this.panel.visible) return null;
    this.panel.update(dt);
    if (this.soon) {
      this.soon.left -= dt;
      if (this.soon.left <= 0) this.clearSoon();
    }
    for (const e of this.entries) {
      if (!e.button.update(hands, dt)) continue;
      if (e.id === 'daily' || e.id === 'custom') {
        // Not built yet: the word over it says so for a moment.
        this.soon = { id: e.id, left: MENU.main.soonTime };
        this.paint();
        return null;
      }
      return e.id;
    }
    return null;
  }

  private clearSoon(): void {
    if (!this.soon) return;
    this.soon = null;
    this.paint();
  }

  /** The title, and a word under each button (a little gap below its row's rims). */
  private paint(): void {
    const M = MENU.main;
    this.panel.paint((c, w, h) => {
      const at = panelMap(M.width, M.height, w, h);
      drawTitleBanner(c, 'Tall Tale', w * 0.25, UI_SPACING.top * at.px, w * 0.5, 56, 34);
      for (const e of this.entries) {
        const soon = this.soon?.id === e.id;
        const size = e.id === 'campaign' ? 26 : 22;
        drawLine(c, soon ? 'Coming soon' : e.label, at.x(e.x), at.y(e.labelY) + size * 0.6, 9.5 * at.px, size, soon ? UI_COLORS.warn : UI_COLORS.accent);
      }
    });
  }
}
