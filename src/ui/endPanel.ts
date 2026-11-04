// The end of battle panel (docs/castle-rules.md section 4): a plain panel in
// front of the player that says "Congratulations, the kingdom is safe!" or
// "The castle has fallen", with one round button poked with the index finger
// to play again. Text is a small canvas texture, drawn once per show, like the
// FPS panel. It lives in fixedRig (cm), so it never spins with the board.
import { CanvasTexture, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, type Object3D } from 'three';
import type { GameAudio } from '../audio/sound.js';
import { END_PANEL } from '../config/game.js';
import type { HandState } from '../player/hands.js';
import { degToRad } from '../rules/boardMath.js';
import { PokeButton } from './pokeButton.js';
import { drawIcon, drawNineSlice, type UiImageName } from './uiImages.js';

export type EndKind = 'won' | 'lost';

interface PanelText {
  title: string;
  subtitle: string;
  /** The label above the round button: "Poke to play again". */
  button: string;
  icon?: UiImageName;
}

const TEXT: Record<EndKind, PanelText> = {
  won: { title: 'Congratulations!', subtitle: 'The kingdom is safe!', button: 'Poke the button to play again', icon: 'trophy' },
  lost: { title: 'Oh no!', subtitle: 'The castle has fallen', button: 'Poke the button to try again', icon: 'warning' },
};

export class EndPanel {
  private root = new Group();
  private button: PokeButton;
  private canvas = document.createElement('canvas');
  private texture: CanvasTexture;

  constructor(parent: Object3D, audio: GameAudio) {
    const { width, height, buttonRadius, buttonDepth } = END_PANEL;
    this.canvas.width = 512;
    this.canvas.height = Math.round((512 * height) / width);
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    const board = new Mesh(
      new PlaneGeometry(width, height),
      new MeshBasicMaterial({ map: this.texture, transparent: true, fog: false, toneMapped: false }),
    );
    this.root.add(board);
    this.button = new PokeButton(buttonRadius, buttonDepth, END_PANEL.buttonColor, audio);
    this.button.group.position.set(0, -height * 0.3, 0);
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
    this.root.visible = true;
    this.button.reset();
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
    const w = this.canvas.width;
    const h = this.canvas.height;
    c.clearRect(0, 0, w, h);
    if (!drawNineSlice(c, 'panelDark', 0, 0, w, h, 32, 48)) {
      c.fillStyle = 'rgba(40, 30, 22, 0.88)';
      c.fillRect(0, 0, w, h);
    }
    // Title on a hanging banner, the rest below it.
    drawNineSlice(c, 'banner', w * 0.12, 18, w * 0.76, 96, 24, 30);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#fff4dc';
    c.font = 'bold 46px sans-serif';
    c.fillText(text.title, w / 2, 66);
    c.fillStyle = '#f2e6c8';
    c.font = 'bold 44px sans-serif';
    c.fillText(text.subtitle, w / 2, h * 0.43);
    if (text.icon) {
      drawIcon(c, text.icon, 34, h * 0.43 - 34, 68, '#f2c14e');
      drawIcon(c, text.icon, w - 34 - 68, h * 0.43 - 34, 68, '#f2c14e');
    }
    c.fillStyle = '#f2c14e';
    c.font = 'bold 34px sans-serif';
    c.fillText(text.button, w / 2, h * 0.56);
    this.texture.needsUpdate = true;
  }
}
