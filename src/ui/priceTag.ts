// The price tag on a food tool's platform (docs/controls-and-ui.md "Tool
// cost"): a small wooden board with a food ball and the cost, like a price on
// a market stall. The number is cream when the jar has enough food, red when
// it does not, and a tick shows while a paid use runs. A canvas texture,
// redrawn only when that state changes.
import { CanvasTexture, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from 'three';
import { FOOD_JAR, PRICE_TAG } from '../config/game.js';
import { mark } from '../debug/perfMarks.js';
import { priceTagBoard } from '../world/shapes.js';
import { drawIcon } from './uiImages.js';

/** 'free' while tools cost nothing (the tutorial): the tag says "Free". */
export type PriceState = 'ok' | 'short' | 'paid' | 'free';

const CANVAS_WIDTH = 256;

export class PriceTag {
  /** Centered on the board, its face toward +z (cm). */
  readonly group = new Group();
  private canvas = document.createElement('canvas');
  private texture: CanvasTexture;
  private state: PriceState | null = null;

  constructor(private cost: number) {
    const { width, height } = PRICE_TAG;
    this.canvas.width = CANVAS_WIDTH;
    this.canvas.height = Math.round((CANVAS_WIDTH * height) / width);
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.anisotropy = 4;
    const face = new Mesh(
      new PlaneGeometry(width * 0.92, height * 0.86),
      new MeshBasicMaterial({ map: this.texture, transparent: true, toneMapped: false }),
    );
    face.position.z = 0.02;
    this.group.add(priceTagBoard(), face);
  }

  set(state: PriceState): void {
    if (state === this.state) return;
    this.state = state;
    this.draw(state);
  }

  private draw(state: PriceState): void {
    mark('price tag');
    const c = this.canvas.getContext('2d')!;
    const w = this.canvas.width;
    const h = this.canvas.height;
    c.clearRect(0, 0, w, h);
    if (state === 'free') {
      c.font = `bold ${Math.round(h * 0.62)}px sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineWidth = h * 0.08;
      c.strokeStyle = '#3b2b1f';
      c.strokeText('Free', w / 2, h / 2 + h * 0.03);
      c.fillStyle = PRICE_TAG.paidColor;
      c.fillText('Free', w / 2, h / 2 + h * 0.03);
      this.texture.needsUpdate = true;
      return;
    }
    // The food ball icon on the left, in the jar's ball color.
    const r = h * 0.3;
    const cx = w * 0.27;
    const cy = h / 2;
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.fillStyle = `#${FOOD_JAR.ballColors[0].toString(16).padStart(6, '0')}`;
    c.fill();
    c.lineWidth = h * 0.06;
    c.strokeStyle = '#6d4b27';
    c.stroke();
    // A little shine, so it reads as a ball.
    c.beginPath();
    c.arc(cx - r * 0.35, cy - r * 0.35, r * 0.28, 0, Math.PI * 2);
    c.fillStyle = 'rgba(255, 255, 255, 0.55)';
    c.fill();
    // The cost, or a tick while a paid use runs.
    const x = w * 0.68;
    if (state === 'paid') {
      const size = h * 0.7;
      drawIcon(c, 'check', x - size / 2, cy - size / 2, size, PRICE_TAG.paidColor);
    } else {
      c.font = `bold ${Math.round(h * 0.78)}px sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineWidth = h * 0.08;
      c.strokeStyle = '#3b2b1f';
      c.strokeText(String(this.cost), x, cy + h * 0.04);
      c.fillStyle = state === 'ok' ? PRICE_TAG.okColor : PRICE_TAG.shortColor;
      c.fillText(String(this.cost), x, cy + h * 0.04);
    }
    this.texture.needsUpdate = true;
  }
}
