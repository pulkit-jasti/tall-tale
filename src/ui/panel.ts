// The shared panel (modal) for every sign in front of the player: the hint
// sign and the welcome, win and lose panels. A light parchment board with a
// canvas texture, straight in front of the player, tilted toward the eyes.
// It lives in boardLift (cm), so it rises and sizes with the board but never
// spins and never follows the head. Each user draws its own content on it
// (paint) and can add things to `root` that tilt with it, like a poke button.
// The canvas is redrawn only when a user paints, never every frame.
import { Group, PlaneGeometry, type CanvasTexture, type Mesh, type MeshBasicMaterial, type Object3D } from 'three';
import { popIn } from '../fx/ease.js';
import { degToRad } from '../rules/boardMath.js';
import { uiCenterY } from '../rules/reach.js';
import { canvasPlane, canvasTexture } from './kit/canvas.js';
import { afterDrag } from './kit/controls.js';
import { drawNineSlice } from './uiImages.js';

/** Dark brown ink for text on the light panel. */
export const PANEL_INK = '#4a3424';

export interface PanelOptions {
  /** Size (cm). */
  width: number;
  height: number;
  /** Straight in front of the player: this far out from the seat, its middle this high above the board (cm). */
  radius: number;
  centerY: number;
  /** Tilted back toward the eyes (degrees). Negative tips the top toward the player. */
  tiltDeg: number;
  /** Width the drawing code is written for (pixels), and how many times sharper the canvas is. */
  layoutWidth: number;
  canvasScale: number;
  /** Texture sharpness at a slant (1 = off). */
  anisotropy?: number;
}

export class Panel {
  /** Placed and tilted: things added here (buttons) tilt with the panel. */
  readonly root = new Group();
  /** Layout size (pixels) that paint() draws in (they change with resize()). */
  layoutWidth: number;
  layoutHeight: number;
  /** Size (cm). */
  width: number;
  height: number;
  private canvas = document.createElement('canvas');
  private texture: CanvasTexture;
  private canvasScale: number;
  /** Layout pixels per cm, kept when it resizes. */
  private pxPerCm: number;
  private tiltDeg: number;
  private zoned: boolean;
  /** The parchment board. Only it pops, not what was added to root. */
  private board: Mesh;
  /** Little pop when new content shows (1 = settled). */
  private pop = 1;
  private popTime = 0.25;

  constructor(parent: Object3D, options: PanelOptions) {
    const { width, height, layoutWidth, canvasScale } = options;
    this.canvasScale = canvasScale;
    this.width = width;
    this.height = height;
    this.pxPerCm = layoutWidth / width;
    this.tiltDeg = options.tiltDeg;
    // A menu panel placed by uiCenterY keeps that rule when it resizes; others (the hint sign) keep their height.
    this.zoned = Math.abs(options.centerY - uiCenterY(height, options.tiltDeg)) < 0.01;
    this.canvas.width = Math.round(layoutWidth * canvasScale);
    this.canvas.height = Math.round(((layoutWidth * height) / width) * canvasScale);
    this.layoutWidth = layoutWidth;
    this.layoutHeight = this.canvas.height / canvasScale;
    this.texture = canvasTexture(this.canvas, options.anisotropy ?? 1);
    this.board = canvasPlane(this.texture, width, height);
    this.root.add(this.board);
    // Its face (+z) toward the player, tilted back like a lectern.
    this.root.position.set(0, options.centerY, -options.radius);
    this.root.rotation.x = -degToRad(options.tiltDeg);
    this.root.visible = false;
    parent.add(this.root);
  }

  get visible(): boolean {
    return this.root.visible;
  }
  set visible(on: boolean) {
    this.root.visible = on;
  }

  /**
   * A new size (cm) that fits what is on it now (a button shown or hidden):
   * the board, its canvas (as sharp as before) and its height in front of the
   * eyes (uiCenterY) follow. Call paint() after it. Nothing happens if the
   * size is the same. So no panel needs its size tuned by hand.
   */
  resize(width: number, height: number): void {
    if (Math.abs(width - this.width) < 1e-3 && Math.abs(height - this.height) < 1e-3) return;
    this.width = width;
    this.height = height;
    this.layoutWidth = Math.round(width * this.pxPerCm);
    this.canvas.width = Math.round(this.layoutWidth * this.canvasScale);
    this.canvas.height = Math.round(height * this.pxPerCm * this.canvasScale);
    this.layoutHeight = this.canvas.height / this.canvasScale;
    // A new canvas size needs a new texture (the old one keeps its size on the GPU).
    const material = this.board.material as MeshBasicMaterial;
    this.texture.dispose();
    this.texture = canvasTexture(this.canvas, this.texture.anisotropy);
    material.map = this.texture;
    this.board.geometry.dispose();
    this.board.geometry = new PlaneGeometry(width, height);
    if (this.zoned) this.root.position.y = uiCenterY(height, this.tiltDeg);
  }

  /**
   * Redraws the panel: the parchment, then the user's content, in layout
   * pixels. While something is dragged it waits for the drag to end
   * (src/ui/kit/controls.ts afterDrag: a redraw mid-drag made panels flicker).
   */
  paint(draw: (c: CanvasRenderingContext2D, w: number, h: number) => void): void {
    afterDrag(this, () => this.paintNow(draw));
  }

  private paintNow(draw: (c: CanvasRenderingContext2D, w: number, h: number) => void): void {
    const c = this.canvas.getContext('2d')!;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    // Laid out at layoutWidth, drawn canvasScale times sharper, so text stays sharp further away.
    c.setTransform(this.canvasScale, 0, 0, this.canvasScale, 0, 0);
    const w = this.layoutWidth;
    const h = this.layoutHeight;
    if (!drawNineSlice(c, 'panel', 0, 0, w, h, 16, 40)) {
      c.fillStyle = '#e8d7b0';
      c.fillRect(0, 0, w, h);
    }
    draw(c, w, h);
    this.texture.needsUpdate = true;
  }

  /** The board pops in over this long (seconds): it grows with a small overshoot and settles. */
  popIn(seconds: number): void {
    this.popTime = seconds;
    this.pop = 0;
  }

  update(dt: number): void {
    if (this.pop >= 1) return;
    this.pop = Math.min(1, this.pop + dt / this.popTime);
    // The shared pop: a small overshoot, then it settles at full size.
    this.board.scale.setScalar(0.8 + 0.2 * popIn(this.pop));
  }
}

/** Where a panel's middle goes so its bottom edge sits `bottom` cm above the board, tilted `tiltDeg`. */
export function centerAbove(bottom: number, height: number, tiltDeg: number): number {
  return bottom + (height / 2) * Math.cos(degToRad(tiltDeg));
}
