// Tabs (docs/custom-mode.md "UI kit parts"): floating rectangular buttons
// that stand outside a panel's top border (not drawn on the parchment). With
// FightButton, the only rectangular buttons. The chosen tab is green with
// its word bold and underlined, the others grey with a light word (color,
// text and a line together, never color alone). The same poke, looks and
// sounds as every PokeButton. Faces are redrawn only when the choice
// changes. Its face points along +z (cm). The page places the group.
import { Group, type CanvasTexture } from 'three';
import type { GameAudio } from '../../audio/sound.js';
import { TABS } from '../../config/game.js';
import type { HandState } from '../../player/hands.js';
import { preparedTextures } from '../panel.js';
import { PokeButton } from '../pokeButton.js';
import { canvasTexture } from './canvas.js';
import type { Control } from './controls.js';
import { fontSpec } from './font.js';

interface Tab {
  button: PokeButton;
  /** Its face chosen and not chosen, both drawn once. */
  onTexture: CanvasTexture;
  offTexture: CanvasTexture;
  label: string;
}

export class Tabs implements Control {
  readonly group = new Group();
  /** A different tab was poked (its index). */
  onChange: (index: number) => void = () => {};
  private tabs: Tab[] = [];
  private chosen = 0;

  constructor(audio: GameAudio, labels: string[]) {
    const T = TABS;
    const total = labels.length * T.width + (labels.length - 1) * T.gap;
    labels.forEach((label, i) => {
      // Both looks drawn once (chosen and not), each its own texture: a tab switch only swaps them
      // (2026-11-17: every switch redrew and uploaded every tab's canvas, a flicker on the headset).
      const look = (on: boolean): CanvasTexture => {
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(T.width * 40);
        canvas.height = Math.round(T.height * 40);
        drawTab(canvas, label, on);
        const texture = canvasTexture(canvas, 4);
        preparedTextures.add(texture);
        return texture;
      };
      const offTexture = look(false);
      const onTexture = look(true);
      const button = new PokeButton(audio, { radius: T.height / 2, icon: 'dot', box: { width: T.width, height: T.height, face: offTexture } });
      button.group.position.x = -total / 2 + T.width / 2 + i * (T.width + T.gap);
      this.group.add(button.group);
      this.tabs.push({ button, onTexture, offTexture, label });
    });
    this.paint();
  }

  /** Width of the whole row (cm). */
  get width(): number {
    return this.tabs.length * TABS.width + (this.tabs.length - 1) * TABS.gap;
  }

  get selected(): number {
    return this.chosen;
  }

  /** Chooses a tab without telling onChange (a page opening). */
  select(index: number): void {
    if (index === this.chosen) return;
    this.chosen = index;
    this.paint();
  }

  update(hands: HandState[], dt: number): void {
    for (const [i, tab] of this.tabs.entries()) {
      if (!tab.button.update(hands, dt) || i === this.chosen) continue;
      this.select(i);
      this.onChange(i);
    }
  }

  reset(): void {
    for (const tab of this.tabs) tab.button.reset();
  }

  lock(seconds: number): void {
    for (const tab of this.tabs) tab.button.lock(seconds);
  }

  /** The chosen tab's look: its cap's color and its ready-made face (nothing drawn). */
  private paint(): void {
    for (const [i, tab] of this.tabs.entries()) {
      const on = i === this.chosen;
      tab.button.setColor(on ? TABS.onColor : TABS.offColor);
      tab.button.setFace(on ? tab.onTexture : tab.offTexture);
    }
  }
}

/** A tab's word on its face: the same bold word on every tab; only the cap's color says which is chosen. */
function drawTab(canvas: HTMLCanvasElement, label: string, on: boolean): void {
  const c = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;
  c.clearRect(0, 0, w, h);
  c.font = fontSpec(Math.round(h * 0.44), true);
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = on ? TABS.onInk : TABS.offInk;
  // No underline (headset test: the green cap and the bold word are enough).
  c.fillText(label, w / 2, h / 2 + 2);
}
