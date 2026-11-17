// The campaign's Fight button (docs/menus.md section 8): the only
// rectangular button (every other button is round), a bordered box with a
// sword and "Fight!" on its face, red; locked, grey with a lock and
// "Locked". The same poke, looks and sounds as every PokeButton. Its face is
// redrawn only when it locks or unlocks. Its face points along +z (cm).
import type { CanvasTexture } from 'three';
import type { GameAudio } from '../../audio/sound.js';
import { MENU } from '../../config/game.js';
import { preparedTextures } from '../panel.js';
import type { HandState } from '../../player/hands.js';
import { PokeButton } from '../pokeButton.js';
import { canvasTexture } from './canvas.js';
import type { Control } from './controls.js';
import { drawMenuIcon } from './menuIcons.js';

const INK = '#fff4dc';

/** One face: a sword and "Fight!", or a lock and "Locked". */
function drawFace(canvas: HTMLCanvasElement, locked: boolean): void {
  const c = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;
  const icon = h * 0.6;
  c.font = `bold ${Math.round(h * 0.42)}px sans-serif`;
  const word = locked ? 'Locked' : 'Fight!';
  const textW = c.measureText(word).width;
  const left = (w - (icon + h * 0.2 + textW)) / 2;
  drawMenuIcon(c, locked ? 'lock' : 'sword', left + icon / 2, h / 2, icon, INK);
  c.fillStyle = INK;
  c.textAlign = 'left';
  c.textBaseline = 'middle';
  c.fillText(word, left + icon + h * 0.2, h / 2 + 2);
}

export class FightButton implements Control {
  private button: PokeButton;
  /** Both faces drawn once (2026-11-17, headset log: each lock change redrew and uploaded the face on a card tap). */
  private faces: Record<'open' | 'locked', CanvasTexture>;
  private lockedNow: boolean | null = null;

  constructor(audio: GameAudio, width: number, height: number) {
    const face = (locked: boolean): CanvasTexture => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width * 40);
      canvas.height = Math.round(height * 40);
      drawFace(canvas, locked);
      const texture = canvasTexture(canvas, 4);
      preparedTextures.add(texture);
      return texture;
    };
    this.faces = { open: face(false), locked: face(true) };
    this.button = new PokeButton(audio, { radius: height / 2, icon: 'sword', box: { width, height, face: this.faces.open } });
    this.setLocked(false);
  }

  get group() {
    return this.button.group;
  }

  /** A poke while locked (it buzzed). */
  set onRefuse(fn: () => void) {
    this.button.onRefuse = fn;
  }

  /** Locked: grey with a lock, a poke only buzzes (and calls onRefuse). */
  setLocked(locked: boolean): void {
    if (locked === this.lockedNow) return;
    this.lockedNow = locked;
    this.button.locked = locked;
    this.button.setColor(locked ? MENU.campaign.lockedColor : MENU.campaign.fightColor);
    this.button.setFace(locked ? this.faces.locked : this.faces.open);
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
