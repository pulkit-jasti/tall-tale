// The panel in front of the player with one round button poked with the index
// finger: the welcome panel before the battle ("Play", with Settings and Skip
// tutorial in its bottom corners, docs/mvp.md "Menus"),
// and the end of battle panel (docs/castle-rules.md section 4) that says
// "Congratulations, the kingdom is safe!" or "The castle has fallen", to play
// again. A shared Panel, drawn once per show. It lives in boardLift (cm), so
// it never spins with the board, and it is sized with it (reach check), so
// its button stays in reach.
import { type Object3D } from 'three';
import type { GameAudio } from '../audio/sound.js';
import { END_PANEL, POKE, UI_SPACING } from '../config/game.js';
import type { HandState } from '../player/hands.js';
import { armControls, bottomRowY, drawLine, drawTitleBanner, Panel, panelMap, PokeButton, UI_COLORS, uiCenterY } from './kit/index.js';

export type EndKind = 'welcome' | 'won' | 'lost';
/** What was poked: the main button (Play, Play again) or Skip tutorial (welcome panel only). */
export type EndChoice = 'play' | 'skip' | null;

/** As little text as possible: a title, and one word or two over each button. */
interface PanelText {
  title: string;
  /** The label above the round button. */
  button: string;
}

const TEXT: Record<EndKind, PanelText> = {
  welcome: { title: 'Welcome, giant!', button: 'Play' },
  won: { title: 'The kingdom is safe!', button: 'Play again' },
  lost: { title: 'The castle has fallen', button: 'Try again' },
};


export class EndPanel {
  private panel: Panel;
  private button: PokeButton;
  /** The welcome panel's Settings button (bottom right, smaller than Play). */
  private settings: PokeButton;
  /** The welcome panel's Skip tutorial button (bottom left, the same size as Settings, mirrored). */
  private skip: PokeButton;
  private kind: EndKind = 'welcome';
  private buttonTopPx = 0;
  private settingsX = 0;
  private settingsTopPx = 0;
  /** The Settings button was poked (welcome panel only). */
  onSettings: () => void = () => {};

  constructor(parent: Object3D, audio: GameAudio) {
    const { width, height, buttonRadius, settingsRadius, radius, tiltDeg, buttonMargin } = END_PANEL;
    // Straight in front of the eyes, tilted back toward them, never too high or too low (UI_ZONE).
    this.panel = new Panel(parent, { width, height, radius, centerY: uiCenterY(height, tiltDeg), tiltDeg, layoutWidth: 512, canvasScale: 2 });
    const at = panelMap(width, height, this.panel.layoutWidth, this.panel.layoutHeight);
    this.button = new PokeButton(audio, { radius: buttonRadius, icon: 'play' });
    // The button sits at the bottom of the panel, tilting with it. Its rim is wider than its cap.
    const rim = buttonRadius * POKE.rimScale;
    const buttonY = bottomRowY(height, rim, buttonMargin);
    this.button.group.position.set(0, buttonY, 0);
    // Where the rim's top edge is on the canvas (layout pixels from the top), so the text stays above it.
    this.buttonTopPx = at.y(buttonY + rim);
    // Settings in the bottom right corner, its rim the same distance from both edges.
    this.settings = new PokeButton(audio, { radius: settingsRadius, icon: 'settings' });
    const settingsRim = settingsRadius * POKE.rimScale;
    this.settingsX = width / 2 - settingsRim - buttonMargin;
    const settingsY = bottomRowY(height, settingsRim, buttonMargin);
    this.settings.group.position.set(this.settingsX, settingsY, 0);
    this.settingsTopPx = at.y(settingsY + settingsRim);
    // Skip tutorial in the bottom left corner, mirroring Settings.
    this.skip = new PokeButton(audio, { radius: settingsRadius, icon: 'skip' });
    this.skip.group.position.set(-this.settingsX, settingsY, 0);
    this.panel.root.add(this.button.group, this.settings.group, this.skip.group);
  }

  get visible(): boolean {
    return this.panel.visible;
  }

  /** The panel that shows (or showed last). */
  get kindShown(): EndKind {
    return this.kind;
  }

  show(kind: EndKind): void {
    this.kind = kind;
    this.draw(TEXT[kind]);
    // Play to start, restart to play again. Settings and Skip tutorial only on the welcome panel.
    this.button.setIcon(kind === 'welcome' ? 'play' : 'restart');
    this.settings.group.visible = kind === 'welcome';
    this.skip.group.visible = kind === 'welcome';
    this.panel.visible = true;
    this.panel.popIn(0.25);
    // A finger still there from the last poke must not start the next battle at once.
    armControls([this.button, this.settings, this.skip]);
  }

  /** Shows the same panel again (after its settings page closed). */
  showAgain(): void {
    this.show(this.kind);
  }

  hide(): void {
    this.panel.visible = false;
  }

  /** What was poked this frame: the main button or Skip tutorial. A poke on Settings calls onSettings. */
  update(hands: HandState[], dt: number): EndChoice {
    if (!this.panel.visible) return null;
    this.panel.update(dt);
    if (this.settings.group.visible && this.settings.update(hands, dt)) {
      this.onSettings();
      return null;
    }
    if (this.skip.group.visible && this.skip.update(hands, dt)) return 'skip';
    return this.button.update(hands, dt) ? 'play' : null;
  }

  private draw(text: PanelText): void {
    this.panel.paint((c, w) => this.drawText(c, w, text));
  }

  private drawText(c: CanvasRenderingContext2D, w: number, text: PanelText): void {
    const at = panelMap(END_PANEL.width, END_PANEL.height, w, this.panel.layoutHeight);
    const textWidth = w - UI_SPACING.edge * at.px * 2;
    // Title on a banner, the button's label a little above its rim. Every line shrinks to fit inside the panel.
    drawTitleBanner(c, text.title, w * 0.12, UI_SPACING.top * at.px, w * 0.76, 80, 44);
    const gap = UI_SPACING.labelGap * at.px;
    const labelY = this.buttonTopPx - gap - 15;
    // The main label stays clear of the Settings button on the welcome panel.
    const settingsShown = this.kind === 'welcome';
    const settingsLeft = at.x(this.settingsX - END_PANEL.settingsRadius * POKE.rimScale);
    drawLine(c, text.button, w / 2, labelY, settingsShown ? (settingsLeft - w / 2) * 2 - gap * 2 : textWidth, 30, UI_COLORS.accent);
    if (settingsShown) {
      drawLine(c, 'Settings', at.x(this.settingsX), this.settingsTopPx - gap - 10, 110, 20, UI_COLORS.accent);
      drawLine(c, 'Skip tutorial', at.x(-this.settingsX), this.settingsTopPx - gap - 10, 120, 20, UI_COLORS.accent);
    }
  }
}
