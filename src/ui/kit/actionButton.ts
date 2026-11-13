// A rectangular call to action (docs/custom-mode.md section 8): a bordered
// box with an icon and a word on its face in its own color, so it is clear
// it is the main thing to do on the page (Save on the create and edit page).
// The same poke, looks and sounds as every PokeButton. Rectangular buttons
// are only FightButton, the tabs and this. Its face is drawn once.
// Its face points along +z (cm).
import type { CanvasTexture } from 'three';
import type { GameAudio } from '../../audio/sound.js';
import type { HandState } from '../../player/hands.js';
import { PokeButton } from '../pokeButton.js';
import { drawActionIcon, type ActionIcon } from './actionIcons.js';
import { canvasTexture } from './canvas.js';
import type { Control } from './controls.js';

export class ActionButton implements Control {
  private button: PokeButton;
  private canvas = document.createElement('canvas');
  private texture: CanvasTexture;

  constructor(audio: GameAudio, width: number, height: number, icon: ActionIcon, word: string, color: number, ink: string) {
    this.canvas.width = Math.round(width * 40);
    this.canvas.height = Math.round(height * 40);
    this.texture = canvasTexture(this.canvas, 4);
    this.button = new PokeButton(audio, { radius: height / 2, icon, box: { width, height, face: this.texture } });
    this.button.setColor(color);
    const c = this.canvas.getContext('2d')!;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const size = h * 0.62;
    c.font = `bold ${Math.round(h * 0.4)}px sans-serif`;
    const textW = c.measureText(word).width;
    const left = (w - (size + h * 0.15 + textW)) / 2;
    c.save();
    c.translate(left + size / 2, h / 2);
    c.fillStyle = c.strokeStyle = ink;
    drawActionIcon(c, icon, size);
    c.restore();
    c.fillStyle = ink;
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillText(word, left + size + h * 0.15, h / 2 + 2);
    this.texture.needsUpdate = true;
  }

  get group() {
    return this.button.group;
  }

  update(hands: HandState[], dt: number): boolean {
    return this.button.update(hands, dt);
  }

  reset(): void {
    this.button.reset();
  }

  lock(seconds: number): void {
    this.button.lock(seconds);
  }
}
