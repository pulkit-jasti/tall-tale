// The panel in front of the player with one round button poked with the index
// finger: the welcome panel before the battle ("Play", docs/mvp.md "Menus"),
// and the end of battle panel (docs/castle-rules.md section 4) that says
// "Congratulations, the kingdom is safe!" or "The castle has fallen", to play
// again. A shared Panel, drawn once per show. It lives in boardLift (cm), so
// it never spins with the board, and it is sized with it (reach check), so
// its button stays in reach.
import { type Object3D } from 'three';
import type { GameAudio } from '../audio/sound.js';
import { END_PANEL, POKE } from '../config/game.js';
import type { HandState } from '../player/hands.js';
import { armControls, bottomRowY, drawLine, drawTitleBanner, Panel, panelMap, PokeButton, UI_COLORS, uiCenterY } from './kit/index.js';

export type EndKind = 'welcome' | 'won' | 'lost';

interface PanelText {
  title: string;
  subtitle: string;
  /** The label above the round button: "Poke to play again". */
  button: string;
}

const TEXT: Record<EndKind, PanelText> = {
  welcome: { title: 'Welcome, giant!', subtitle: 'The tiny kingdom needs you', button: 'Poke the button to play' },
  won: { title: 'Congratulations!', subtitle: 'The kingdom is safe!', button: 'Poke the button to play again' },
  lost: { title: 'Oh no!', subtitle: 'The castle has fallen', button: 'Poke the button to try again' },
};

/** Text keeps this far from the panel's sides (layout pixels). */
const TEXT_MARGIN = 44;

export class EndPanel {
  private panel: Panel;
  private button: PokeButton;
  /** The welcome panel's Settings button (bottom right, smaller than Play). */
  private settings: PokeButton;
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
    this.panel.root.add(this.button.group, this.settings.group);
  }

  get visible(): boolean {
    return this.panel.visible;
  }

  show(kind: EndKind): void {
    this.kind = kind;
    this.draw(TEXT[kind]);
    // Play to start, restart to play again. Settings only on the welcome panel.
    this.button.setIcon(kind === 'welcome' ? 'play' : 'restart');
    this.settings.group.visible = kind === 'welcome';
    this.panel.visible = true;
    this.panel.popIn(0.25);
    // A finger still there from the last poke must not start the next battle at once.
    armControls([this.button, this.settings]);
  }

  /** Shows the same panel again (after its settings page closed). */
  showAgain(): void {
    this.show(this.kind);
  }

  hide(): void {
    this.panel.visible = false;
  }

  /** Returns true on the frame the main button is poked. A poke on Settings calls onSettings. */
  update(hands: HandState[], dt: number): boolean {
    if (!this.panel.visible) return false;
    this.panel.update(dt);
    if (this.settings.group.visible && this.settings.update(hands, dt)) {
      this.onSettings();
      return false;
    }
    return this.button.update(hands, dt);
  }

  private draw(text: PanelText): void {
    this.panel.paint((c, w) => this.drawText(c, w, text));
  }

  private drawText(c: CanvasRenderingContext2D, w: number, text: PanelText): void {
    const textWidth = w - TEXT_MARGIN * 2;
    // Title on a banner, the rest below it, all above the button. Every line shrinks to fit inside the panel.
    const bannerTop = 22;
    const bannerH = 86;
    drawTitleBanner(c, text.title, w * 0.1, bannerTop, w * 0.8, bannerH, 44);
    // The label sits just above the button's rim, the subtitle between it and the banner.
    const labelY = this.buttonTopPx - 26;
    const subtitleY = (bannerTop + bannerH + labelY - 20) / 2;
    drawLine(c, text.subtitle, w / 2, subtitleY, textWidth, 40, UI_COLORS.ink);
    // The main label stays clear of the Settings button on the welcome panel.
    const settingsShown = this.kind === 'welcome';
    const at = panelMap(END_PANEL.width, END_PANEL.height, w, this.panel.layoutHeight);
    const settingsLeft = at.x(this.settingsX - END_PANEL.settingsRadius * POKE.rimScale);
    drawLine(c, text.button, w / 2, labelY, settingsShown ? (settingsLeft - w / 2) * 2 - 16 : textWidth, 30, UI_COLORS.accent);
    if (settingsShown) drawLine(c, 'Settings', at.x(this.settingsX), this.settingsTopPx - 16, 110, 20, UI_COLORS.accent);
  }
}
