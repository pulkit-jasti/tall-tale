// Text on the game's canvases, in one look: the shared colors, a title on a
// hanging banner, a line that shrinks to fit, and outlined text for small
// labels that must read on any background.
import { PANEL_INK } from '../panel.js';
import { drawBanner, fitFont } from '../uiImages.js';

export const UI_COLORS = {
  /** The dark brown ink on the parchment. */
  ink: PANEL_INK,
  /** A deep green (the button's color, darker): labels over buttons, good news. */
  accent: '#2f5f22',
  /** A light brown for small notes and headers. */
  note: '#8a5a34',
  /** A red for warnings and "Off". */
  warn: '#a33a2a',
  /** The cream on a banner. */
  bannerText: '#fff4dc',
  /** The dark outline around outlined text. */
  outline: '#3b2b1f',
};

/** A title on a hanging banner (x, top, width, height in layout pixels), shrunk to fit it, at most `size` px. */
export function drawTitleBanner(c: CanvasRenderingContext2D, title: string, x: number, top: number, width: number, height: number, size: number): void {
  drawBanner(c, x, top, width, height);
  drawLine(c, title, x + width / 2, top + height * 0.45, width - 40, size, UI_COLORS.bannerText);
}

/** One line of bold text centered on its middle height, at most `size` px and shrunk to fit `maxWidth`. */
export function drawLine(
  c: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  color: string = UI_COLORS.ink,
  align: CanvasTextAlign = 'center',
): void {
  c.textAlign = align;
  c.textBaseline = 'middle';
  c.fillStyle = color;
  fitFont(c, text, maxWidth, size);
  c.fillText(text, x, y);
}

/** Bold text with a dark outline (`size` px, outline `outline` share of it), centered on (x, y). */
export function drawOutlined(c: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, outline = 0.1, outlineColor = UI_COLORS.outline): void {
  c.font = `bold ${Math.round(size)}px sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.lineJoin = 'round';
  c.lineWidth = size * outline;
  c.strokeStyle = outlineColor;
  c.strokeText(text, x, y);
  c.fillStyle = fill;
  c.fillText(text, x, y);
}
