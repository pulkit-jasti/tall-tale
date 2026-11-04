// The panel in front of the player with one round button poked with the index
// finger: the welcome panel before the battle ("Play", docs/mvp.md "Menus"),
// and the end of battle panel (docs/castle-rules.md section 4) that says
// "Congratulations, the kingdom is safe!" or "The castle has fallen", to play
// again. Text is a small canvas texture, drawn once per show, like the FPS
// panel. It lives in boardLift (cm), so it never spins with the board, and it
// is sized with it (reach check), so its button stays in reach.
import { CanvasTexture, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, type Object3D } from 'three';
import type { GameAudio } from '../audio/sound.js';
import { END_PANEL, POKE } from '../config/game.js';
import type { HandState } from '../player/hands.js';
import { degToRad } from '../rules/boardMath.js';
import { PokeButton } from './pokeButton.js';
import { drawBanner, drawNineSlice, fitFont } from './uiImages.js';

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

/** Dark brown ink and a deep green (the button's color, darker) on the light panel. */
const PANEL_INK = '#4a3424';
const PANEL_ACCENT = '#2f5f22';
/** Layout width the drawing code is written for (pixels), and how much sharper the canvas is. */
const LAYOUT_WIDTH = 512;
const CANVAS_SCALE = 2;
/** Text keeps this far from the panel's sides (layout pixels). */
const TEXT_MARGIN = 44;

export class EndPanel {
  private root = new Group();
  private button: PokeButton;
  private buttonTopPx = 0;
  private canvas = document.createElement('canvas');
  private texture: CanvasTexture;

  constructor(parent: Object3D, audio: GameAudio) {
    const { width, height, buttonRadius } = END_PANEL;
    this.canvas.width = LAYOUT_WIDTH * CANVAS_SCALE;
    this.canvas.height = Math.round(((LAYOUT_WIDTH * height) / width) * CANVAS_SCALE);
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    const board = new Mesh(
      new PlaneGeometry(width, height),
      new MeshBasicMaterial({ map: this.texture, transparent: true, fog: false, toneMapped: false }),
    );
    this.root.add(board);
    this.button = new PokeButton(audio, { radius: buttonRadius, icon: 'play' });
    // The button sits at the bottom of the panel. Its rim is wider than its cap.
    const rim = buttonRadius * POKE.rimScale;
    const buttonY = -height / 2 + rim + END_PANEL.buttonMargin;
    this.button.group.position.set(0, buttonY, 0);
    // Where the rim's top edge is on the canvas (layout pixels from the top), so the text stays above it.
    this.buttonTopPx = ((height / 2 - (buttonY + rim)) / height) * (this.canvas.height / CANVAS_SCALE);
    this.root.add(this.button.group);
    // Straight in front of the player, tilted back toward the eyes.
    this.root.position.set(0, END_PANEL.y, -END_PANEL.radius);
    this.root.rotation.x = -degToRad(END_PANEL.tiltDeg);
    this.root.visible = false;
    parent.add(this.root);
  }

  get visible(): boolean {
    return this.root.visible;
  }

  show(kind: EndKind): void {
    this.draw(TEXT[kind]);
    // Play to start, restart to play again.
    this.button.setIcon(kind === 'welcome' ? 'play' : 'restart');
    this.root.visible = true;
    this.button.reset();
    // A finger still there from the last poke must not start the next battle at once.
    this.button.lock(POKE.lockAfterChange);
  }

  hide(): void {
    this.root.visible = false;
  }

  /** Returns true on the frame the button is poked. */
  update(hands: HandState[], dt: number): boolean {
    return this.root.visible && this.button.update(hands, dt);
  }

  private draw(text: PanelText): void {
    const c = this.canvas.getContext('2d')!;
    // Laid out at LAYOUT_WIDTH, drawn at CANVAS_SCALE times that, so the text stays sharp.
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    c.setTransform(CANVAS_SCALE, 0, 0, CANVAS_SCALE, 0, 0);
    const w = LAYOUT_WIDTH;
    const h = this.canvas.height / CANVAS_SCALE;
    const textWidth = w - TEXT_MARGIN * 2;
    // The same light parchment look as the hint sign, with dark ink for good contrast.
    if (!drawNineSlice(c, 'panel', 0, 0, w, h, 16, 40)) {
      c.fillStyle = '#e8d7b0';
      c.fillRect(0, 0, w, h);
    }
    // Title on a banner, the rest below it, all above the button. Every line shrinks to fit inside the panel.
    const bannerTop = 22;
    const bannerH = 86;
    drawBanner(c, w * 0.1, bannerTop, w * 0.8, bannerH);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#fff4dc';
    fitFont(c, text.title, w * 0.8 - 40, 44);
    c.fillText(text.title, w / 2, bannerTop + bannerH * 0.45);
    // The label sits just above the button's rim, the subtitle between it and the banner.
    const labelY = this.buttonTopPx - 26;
    const subtitleY = (bannerTop + bannerH + labelY - 20) / 2;
    c.fillStyle = PANEL_INK;
    fitFont(c, text.subtitle, textWidth, 40);
    c.fillText(text.subtitle, w / 2, subtitleY);
    c.fillStyle = PANEL_ACCENT;
    fitFont(c, text.button, textWidth, 30);
    c.fillText(text.button, w / 2, labelY);
    this.texture.needsUpdate = true;
  }
}
