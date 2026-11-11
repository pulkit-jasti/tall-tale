// The glass sign: the see-through variant of the hint sign (GLASS_SIGN). A
// small dark glass label that floats a little above the look's center (so it
// never covers what the player is looking at) and follows the look smoothly.
// For lessons where the player must watch what is right in front of them
// (the horn aimed by gaze, the balloon in the air), and the horn's own cue.
// Only one sign shows at a time: a lesson that uses this one hides the hint
// sign (headset test: two signs at once were confusing, and overlapped).
//
//   - One or two short lines of text (a canvas, redrawn only when the text changes).
//   - An optional bar under it (the horn's live blow, or the quiet hold), made
//     of plain meshes scaled every frame. Redrawing a canvas every time the
//     bar moved made the whole view flicker on the Quest (headset test).
import { Group, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3, type CanvasTexture, type Object3D } from 'three';
import { GLASS_SIGN, RENDER_ORDER } from '../../config/game.js';
import { mark } from '../../debug/perfMarks.js';
import { fitFont, wrapText } from '../uiImages.js';
import { canvasPlane, canvasTexture } from './canvas.js';
import { drawOnTop } from './onTop.js';
import { UI_COLORS } from './text.js';

/** The bar: `share` filled (0 to 1), a white line at `line` (0 to 1, none if null), gold when `over`. */
export interface GlassBar {
  share: number;
  line: number | null;
  over: boolean;
}

const WIDTH = 512;
const HEIGHT = Math.round((WIDTH * GLASS_SIGN.height) / GLASS_SIGN.width);
const WORLD_UP = new Vector3(0, 1, 0);
const right = new Vector3();
const dir = new Vector3();
const target = new Vector3();

export class GlassSign {
  private holder = new Group();
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private texture: CanvasTexture;
  private barGroup = new Group();
  private fill: Mesh;
  private fillMaterial: MeshBasicMaterial;
  private line: Mesh;
  private drawnKey = '';
  private placed = false;
  /** The bar's share as shown: rises at once, falls back slowly, so a short blow reads. */
  private shown = 0;

  constructor(parent: Object3D) {
    const { width, height, bar } = GLASS_SIGN;
    this.canvas = document.createElement('canvas');
    this.canvas.width = WIDTH;
    this.canvas.height = HEIGHT;
    this.context = this.canvas.getContext('2d')!;
    this.texture = canvasTexture(this.canvas);
    this.holder.add(canvasPlane(this.texture, width, height));
    // The bar: a dark track, the fill growing from its left end, the line it must pass.
    const track = new Mesh(new PlaneGeometry(bar.width, bar.height), new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5, fog: false, toneMapped: false }));
    const fillGeometry = new PlaneGeometry(1, bar.height * 0.8);
    fillGeometry.translate(0.5, 0, 0);
    this.fillMaterial = new MeshBasicMaterial({ color: bar.color, fog: false, toneMapped: false });
    this.fill = new Mesh(fillGeometry, this.fillMaterial);
    this.fill.position.x = -bar.width / 2;
    this.line = new Mesh(new PlaneGeometry(bar.height * 0.18, bar.height * 1.5), new MeshBasicMaterial({ color: bar.lineColor, fog: false, toneMapped: false }));
    this.barGroup.add(track, this.fill, this.line);
    this.barGroup.position.y = bar.y;
    this.holder.add(this.barGroup);
    drawOnTop(this.holder, RENDER_ORDER.glassSign);
    this.holder.visible = false;
    parent.add(this.holder);
  }

  get visible(): boolean {
    return this.holder.visible;
  }

  hide(): void {
    this.holder.visible = false;
    this.placed = false;
    this.shown = 0;
  }

  /** Every frame it shows. `text` null hides it. `head` and `forward` are world. */
  show(dt: number, text: string | null, bar: GlassBar | null, head: Vector3, forward: Vector3): void {
    if (!text) {
      if (this.holder.visible) this.hide();
      return;
    }
    const key = `${text}|${!!bar}`;
    if (key !== this.drawnKey) {
      this.drawnKey = key;
      this.draw(text, !!bar);
    }
    this.barGroup.visible = !!bar;
    if (bar) {
      const share = Math.min(1, Math.max(0, bar.share));
      this.shown = share >= this.shown ? share : Math.max(share, this.shown - dt / GLASS_SIGN.bar.fall);
      const w = GLASS_SIGN.bar.width;
      this.fill.scale.x = Math.max(0.001, this.shown * w);
      this.fillMaterial.color.setHex(bar.over ? GLASS_SIGN.bar.overColor : GLASS_SIGN.bar.color);
      this.line.visible = bar.line !== null;
      if (bar.line !== null) this.line.position.x = -w / 2 + bar.line * w;
    } else this.shown = 0;
    this.place(dt, head, forward);
    this.holder.visible = true;
  }

  /** A little above the look's center, at GLASS_SIGN.distance, facing the eyes; it glides after the look. */
  private place(dt: number, head: Vector3, forward: Vector3): void {
    right.crossVectors(forward, WORLD_UP);
    // Looking straight up or down: keep the last spot.
    if (right.lengthSq() < 1e-4) return;
    right.normalize();
    dir.copy(forward).normalize().applyAxisAngle(right, (GLASS_SIGN.aboveDeg * Math.PI) / 180);
    target.copy(head).addScaledVector(dir, GLASS_SIGN.distance);
    const p = this.holder.position;
    if (!this.placed) {
      p.copy(target);
      this.placed = true;
    } else p.lerp(target, 1 - Math.exp(-dt / GLASS_SIGN.smoothing));
    this.holder.lookAt(head);
    this.holder.updateMatrixWorld(true);
  }

  /** The glass and the text. Only when the text changes. */
  private draw(text: string, withBar: boolean): void {
    mark('panel redraw');
    const c = this.context;
    const w = WIDTH;
    const h = HEIGHT;
    c.clearRect(0, 0, w, h);
    c.fillStyle = GLASS_SIGN.glass;
    c.beginPath();
    c.roundRect(4, 4, w - 8, h - 8, 28);
    c.fill();
    // The text above the bar (or in the middle), at most two lines, shrunk to fit.
    const textHeight = withBar ? h * 0.62 : h;
    const maxWidth = w - 56;
    let size = GLASS_SIGN.fontPx;
    let lines: string[] = [];
    for (; size >= GLASS_SIGN.fontPx * 0.6; size -= 2) {
      c.font = `bold ${size}px sans-serif`;
      lines = wrapText(c, text, maxWidth);
      if (lines.length <= 2) break;
    }
    if (lines.length > 2) lines = lines.slice(0, 2);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    const step = size * 1.15;
    const top = textHeight / 2 - ((lines.length - 1) * step) / 2;
    lines.forEach((line, i) => {
      fitFont(c, line, maxWidth, size);
      c.lineWidth = size * 0.12;
      c.strokeStyle = UI_COLORS.outline;
      c.strokeText(line, w / 2, top + i * step);
      c.fillStyle = UI_COLORS.bannerText;
      c.fillText(line, w / 2, top + i * step);
    });
    this.texture.needsUpdate = true;
  }
}
