// The panel in front of the player: the welcome panel before the battle
// ("Play", with Settings and Skip tutorial in its bottom corners, docs/mvp.md
// "Menus"), and the end of battle panels (docs/castle-rules.md section 4).
//
// The win panel (revamped 2026-11-12): a "Victory!" banner with the level's
// name under it, three real 3D stars that pop in one at a time with a
// climbing chime and sparkles (src/ui/winStars.ts), a row of stats with
// little icons (castle health, goblins eaten, time), a line under them ("New
// best!", or what the next star needs), and three buttons: Menu, Next level
// (the big one, when there is one; else Play again) and Play again. The loss
// panel: "The castle has fallen", the same stats, Try again (big) and Menu.
//
// A shared Panel, drawn once per show (resized to each kind). It lives in
// boardLift (cm), so it never spins with the board, and it is sized with it
// (reach check), so its buttons stay in reach.
import { type Object3D, type Vector3 } from 'three';
import type { GameAudio } from '../audio/sound.js';
import { END_PANEL, MENU, POKE, UI_SPACING } from '../config/game.js';
import type { Particles } from '../fx/particles.js';
import type { HandState } from '../player/hands.js';
import {
  armControls,
  bottomRowY,
  drawDivider,
  drawIcon,
  drawLine,
  drawTitleBanner,
  Panel,
  panelMap,
  PokeButton,
  UI_COLORS,
  uiCenterY,
} from './kit/index.js';
import { WinStars } from './winStars.js';

export type EndKind = 'welcome' | 'won' | 'lost';
/** What was poked: the main button (Play, Play again), Skip tutorial (welcome only), Menu, or Next level. */
export type EndChoice = 'play' | 'skip' | 'menu' | 'next' | null;

/** How the battle went, for the stats row. */
export interface EndStats {
  /** Castle health left (0 to 1). */
  health: number;
  eaten: number;
  /** How long the battle took (seconds). */
  seconds: number;
}

/** How an end panel shows after a battle. */
export interface EndExtras {
  /** Stars won (0 to 3); missing: no stars shown. */
  stars?: number;
  /** A way back to the menu. */
  menu: boolean;
  /** A next level is open: the big button goes there. */
  next?: boolean;
  /** More stars than ever before on this level. */
  best?: boolean;
  /** The level's name, under the title. */
  subtitle?: string;
  stats?: EndStats;
}

const GOLD = '#b07a10';

/** "3:05" from seconds. */
function clockText(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export class EndPanel {
  private panel: Panel;
  /** The big button in the middle: Play, Next level, Play again or Try again. */
  private button: PokeButton;
  /** The welcome panel's Settings (bottom right) and Skip tutorial (bottom left) buttons. */
  private settings: PokeButton;
  private skip: PokeButton;
  /** The end panels' Menu (bottom left) and Play again (bottom right, when the big one is Next level). */
  private menuButton: PokeButton;
  private againButton: PokeButton;
  private stars: WinStars;
  private kind: EndKind = 'welcome';
  private extras: EndExtras = { menu: false };
  /** The big button's action now. */
  private mainChoice: EndChoice = 'play';
  /** The Settings button was poked (welcome panel only). */
  onSettings: () => void = () => {};

  constructor(
    parent: Object3D,
    private audio: GameAudio,
    private particles: Particles,
  ) {
    const { width, height, buttonRadius, settingsRadius, sideRadius, radius, tiltDeg } = END_PANEL;
    // Straight in front of the eyes, tilted back toward them, never too high or too low (UI_ZONE).
    this.panel = new Panel(parent, { width, height, radius, centerY: uiCenterY(height, tiltDeg), tiltDeg, layoutWidth: 512, canvasScale: 2 });
    this.button = new PokeButton(audio, { radius: buttonRadius, icon: 'play' });
    this.settings = new PokeButton(audio, { radius: settingsRadius, icon: 'settings' });
    this.skip = new PokeButton(audio, { radius: settingsRadius, icon: 'skip' });
    this.menuButton = new PokeButton(audio, { radius: sideRadius, icon: 'home' });
    this.againButton = new PokeButton(audio, { radius: sideRadius, icon: 'restart' });
    this.panel.root.add(this.button.group, this.settings.group, this.skip.group, this.menuButton.group, this.againButton.group);
    // The 3D stars float in front of the panel and tilt with it. Each pop: a chime that climbs, and sparkles for a won one.
    this.stars = new WinStars(this.panel.root);
    this.stars.onPop = (i, earned, world) => this.starPopped(i, earned, world);
  }

  get visible(): boolean {
    return this.panel.visible;
  }

  /** The panel that shows (or showed last). */
  get kindShown(): EndKind {
    return this.kind;
  }

  show(kind: EndKind, extras: EndExtras = { menu: false }): void {
    this.kind = kind;
    this.extras = kind === 'welcome' ? { menu: false } : extras;
    const { width, height, endWidth, winHeight, lostHeight } = END_PANEL;
    const w = kind === 'welcome' ? width : endWidth;
    const h = kind === 'welcome' ? height : kind === 'won' ? winHeight : lostHeight;
    this.panel.resize(w, h);
    this.layout(w, h);
    const menu = this.extras.menu;
    // The big button: Play (welcome), Next level (won, one is open), Play again (won), Try again (lost).
    this.mainChoice = kind === 'welcome' ? 'play' : kind === 'won' && this.extras.next ? 'next' : 'play';
    this.button.setIcon(kind === 'welcome' ? 'play' : this.mainChoice === 'next' ? 'next' : 'restart');
    this.settings.group.visible = kind === 'welcome';
    this.skip.group.visible = kind === 'welcome';
    this.menuButton.group.visible = kind !== 'welcome' && menu;
    this.againButton.group.visible = kind === 'won' && this.mainChoice === 'next';
    this.draw();
    // The stars pop in on a win (none on a loss).
    if (kind === 'won' && this.extras.stars !== undefined) {
      this.stars.placeAt(h / 2 - END_PANEL.stars.fromTop);
      this.stars.play(this.extras.stars);
    } else this.stars.hide();
    this.panel.visible = true;
    this.panel.popIn(0.25);
    // A finger still there from the last poke must not start the next battle at once.
    armControls([this.button, this.settings, this.skip, this.menuButton, this.againButton]);
  }

  /** Shows the same panel again (after its settings page closed). */
  showAgain(): void {
    this.show(this.kind, this.extras);
  }

  hide(): void {
    this.panel.visible = false;
    this.stars.hide();
  }

  /** What was poked this frame. A poke on Settings calls onSettings. */
  update(hands: HandState[], dt: number): EndChoice {
    if (!this.panel.visible) return null;
    this.panel.update(dt);
    this.stars.update(dt);
    if (this.settings.group.visible && this.settings.update(hands, dt)) {
      this.onSettings();
      return null;
    }
    if (this.skip.group.visible && this.skip.update(hands, dt)) return 'skip';
    if (this.menuButton.group.visible && this.menuButton.update(hands, dt)) return 'menu';
    if (this.againButton.group.visible && this.againButton.update(hands, dt)) return 'play';
    if (!this.button.update(hands, dt)) return null;
    return this.mainChoice;
  }

  /** The buttons for this panel size: the big one at the bottom in the middle, the small ones in the bottom corners. */
  private layout(width: number, height: number): void {
    const { buttonRadius, settingsRadius, sideRadius, buttonMargin } = END_PANEL;
    this.button.group.position.set(0, bottomRowY(height, buttonRadius * POKE.rimScale, buttonMargin), 0);
    const corner = (radius: number): [number, number] => {
      const rim = radius * POKE.rimScale;
      return [width / 2 - rim - buttonMargin, bottomRowY(height, rim, buttonMargin)];
    };
    const [sx, sy] = corner(settingsRadius);
    this.settings.group.position.set(sx, sy, 0);
    this.skip.group.position.set(-sx, sy, 0);
    const [ex, ey] = corner(sideRadius);
    this.menuButton.group.position.set(-ex, ey, 0);
    this.againButton.group.position.set(ex, ey, 0);
  }

  /** A star landed: a chime that climbs with each won star and a burst of sparkles, or a dull tick for a missed one. */
  private starPopped(index: number, earned: boolean, world: Vector3): void {
    const S = END_PANEL.stars;
    if (earned) {
      this.audio.play('foodAdded', undefined, 0.6 + index * 0.2);
      this.particles.burst(world, S.sparkleColors, S.sparkles + index * 4, 0.3);
      // The last won star of a perfect or best result gets the lesson chime on top.
      const last = index === (this.extras.stars ?? 0) - 1;
      if (last && (this.extras.stars === 3 || this.extras.best)) this.audio.play('lessonDone');
    } else this.audio.play('readyTick', undefined, 0.6);
  }

  private draw(): void {
    this.panel.paint((c, w) => this.drawPanel(c, w));
  }

  private drawPanel(c: CanvasRenderingContext2D, w: number): void {
    const width = this.panel.width;
    const height = this.panel.height;
    const at = panelMap(width, height, w, this.panel.layoutHeight);
    const gap = UI_SPACING.labelGap * at.px;
    const top = (cm: number): number => at.y(height / 2 - cm);
    // A label just above a button's rim.
    const label = (text: string, button: PokeButton, radius: number, size: number, maxWidth: number): void => {
      const p = button.group.position;
      drawLine(c, text, at.x(p.x), at.y(p.y + radius * POKE.rimScale) - gap - size / 2, maxWidth, size, UI_COLORS.accent);
    };
    if (this.kind === 'welcome') {
      drawTitleBanner(c, 'Welcome, giant!', w * 0.12, UI_SPACING.top * at.px, w * 0.76, 80, 44);
      label('Play', this.button, END_PANEL.buttonRadius, 30, w * 0.4);
      label('Settings', this.settings, END_PANEL.settingsRadius, 20, 110);
      label('Skip tutorial', this.skip, END_PANEL.settingsRadius, 20, 120);
      return;
    }
    const won = this.kind === 'won';
    const extras = this.extras;
    drawTitleBanner(c, won ? 'Victory!' : 'The castle has fallen', w * 0.12, UI_SPACING.top * at.px, w * 0.76, 66, won ? 44 : 34);
    if (extras.subtitle) {
      const y = top(END_PANEL.subtitleFromTop);
      c.font = 'bold 22px sans-serif';
      const textWidth = Math.min(w * 0.6, c.measureText(extras.subtitle).width);
      drawLine(c, extras.subtitle, w / 2, y, w * 0.6, 22, UI_COLORS.note);
      // A Fantasy UI Borders divider on both sides of the name.
      drawDivider(c, w / 2, y, textWidth + 24, w * 0.14, 10, END_PANEL.dividerColor);
    }
    // The stats: castle health, goblins eaten, time, each a Kenney Board Game icon over a number and a word.
    const stats = extras.stats;
    if (stats) {
      const y = top(won ? END_PANEL.statsFromTop : END_PANEL.lostStatsFromTop);
      const column = w * 0.24;
      const icon = 30;
      const items: { icon: 'heart' | 'skull' | 'hourglass'; tint: string; value: string; word: string }[] = [
        { icon: 'heart', tint: END_PANEL.statColors.castle, value: `${Math.round(stats.health * 100)}%`, word: 'Castle' },
        { icon: 'skull', tint: END_PANEL.statColors.eaten, value: String(stats.eaten), word: 'Eaten' },
        { icon: 'hourglass', tint: END_PANEL.statColors.time, value: clockText(stats.seconds), word: 'Time' },
      ];
      items.forEach((item, i) => {
        const x = w / 2 + (i - 1) * column;
        drawIcon(c, item.icon, x - icon / 2, y - 16 - icon / 2, icon, item.tint);
        drawLine(c, item.value, x, y + 14, column * 0.9, 26, UI_COLORS.ink);
        drawLine(c, item.word, x, y + 36, column * 0.9, 16, UI_COLORS.note);
      });
    }
    // The line under the stats: a new best, a perfect battle, what the next star needs, or a word of hope.
    const note = this.noteText();
    if (note) {
      const y = top(won ? END_PANEL.noteFromTop : END_PANEL.lostStatsFromTop + 7.6);
      drawLine(c, note.text, w / 2, y, w * 0.8, 22, note.color);
      // A new best wears the crown (Kenney Board Game Icons), just left of its words.
      if (won && extras.best) {
        c.font = 'bold 22px sans-serif';
        const half = Math.min(w * 0.8, c.measureText(note.text).width) / 2;
        drawIcon(c, 'crown', w / 2 - half - 34, y - 14, 28, GOLD);
      }
    }
    // The buttons' words.
    label(won ? (this.mainChoice === 'next' ? 'Next level' : 'Play again') : 'Try again', this.button, END_PANEL.buttonRadius, 28, w * 0.34);
    if (this.menuButton.group.visible) label('Menu', this.menuButton, END_PANEL.sideRadius, 20, 120);
    if (this.againButton.group.visible) label('Play again', this.againButton, END_PANEL.sideRadius, 20, 120);
  }

  /** The line under the stats. */
  private noteText(): { text: string; color: string } | null {
    const extras = this.extras;
    if (this.kind === 'lost') return { text: 'Eat climbers and call your knights. You can do it!', color: UI_COLORS.note };
    const stars = extras.stars;
    if (stars === undefined) return null;
    if (extras.best && stars > 0) return { text: stars === 3 ? 'New best! A perfect defense!' : 'New best!', color: GOLD };
    if (stars >= 3) return { text: 'A perfect defense!', color: GOLD };
    // What the next star needs.
    const need = stars <= 1 ? MENU.stars.twoAt : MENU.stars.threeAt;
    return { text: `Keep ${Math.round(need * 100)}% castle health for ${stars + 1} stars`, color: UI_COLORS.note };
  }
}
