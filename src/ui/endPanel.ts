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
import { armControls, bottomRowY, drawLine, drawTitleBanner, Panel, panelMap, PokeButton, UI_COLORS } from './kit/index.js';

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
  private buttonTopPx = 0;

  constructor(parent: Object3D, audio: GameAudio) {
    const { width, height, buttonRadius, radius, y, tiltDeg } = END_PANEL;
    // Straight in front of the player, tilted back toward the eyes.
    this.panel = new Panel(parent, { width, height, radius, centerY: y, tiltDeg, layoutWidth: 512, canvasScale: 2 });
    this.button = new PokeButton(audio, { radius: buttonRadius, icon: 'play' });
    // The button sits at the bottom of the panel, tilting with it. Its rim is wider than its cap.
    const rim = buttonRadius * POKE.rimScale;
    const buttonY = bottomRowY(height, rim, END_PANEL.buttonMargin);
    this.button.group.position.set(0, buttonY, 0);
    // Where the rim's top edge is on the canvas (layout pixels from the top), so the text stays above it.
    this.buttonTopPx = panelMap(width, height, this.panel.layoutWidth, this.panel.layoutHeight).y(buttonY + rim);
    this.panel.root.add(this.button.group);
  }

  get visible(): boolean {
    return this.panel.visible;
  }

  show(kind: EndKind): void {
    this.draw(TEXT[kind]);
    // Play to start, restart to play again.
    this.button.setIcon(kind === 'welcome' ? 'play' : 'restart');
    this.panel.visible = true;
    this.panel.popIn(0.25);
    // A finger still there from the last poke must not start the next battle at once.
    armControls([this.button]);
  }

  hide(): void {
    this.panel.visible = false;
  }

  /** Returns true on the frame the button is poked. */
  update(hands: HandState[], dt: number): boolean {
    if (!this.panel.visible) return false;
    this.panel.update(dt);
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
    drawLine(c, text.button, w / 2, labelY, textWidth, 30, UI_COLORS.accent);
  }
}
