// A small canvas picture that lies on a panel (a row's name and value, a
// stepper's number, a field's message): drawn only when asked, never every
// frame. Like the ScrollList it draws after the panel board and never writes
// depth, so the panel never shows a hole behind it. Its face points along
// +z. Sizes in cm.
import { Mesh, MeshBasicMaterial, PlaneGeometry, type CanvasTexture } from 'three';
import { mark } from '../../debug/perfMarks.js';
import { canvasTexture } from './canvas.js';
import { afterDrag } from './controls.js';

export class CanvasLabel {
  readonly mesh: Mesh;
  private canvas = document.createElement('canvas');
  private texture: CanvasTexture;

  constructor(
    readonly width: number,
    readonly height: number,
    pxPerCm = 30,
  ) {
    this.canvas.width = Math.max(2, Math.round(width * pxPerCm));
    this.canvas.height = Math.max(2, Math.round(height * pxPerCm));
    this.texture = canvasTexture(this.canvas, 4);
    this.mesh = new Mesh(
      new PlaneGeometry(width, height),
      new MeshBasicMaterial({ map: this.texture, transparent: true, depthWrite: false, fog: false, toneMapped: false }),
    );
    this.mesh.position.z = 0.05;
    this.mesh.renderOrder = 1;
  }

  /** Draws it again: clears, then `draw` in canvas pixels (w by h). While something is dragged it waits for the drag to end (no flicker). */
  draw(draw: (c: CanvasRenderingContext2D, w: number, h: number) => void): void {
    afterDrag(this, () => this.drawNow(draw));
  }

  private drawNow(draw: (c: CanvasRenderingContext2D, w: number, h: number) => void): void {
    mark('panel redraw');
    const c = this.canvas.getContext('2d')!;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    draw(c, this.canvas.width, this.canvas.height);
    this.texture.needsUpdate = true;
  }
}
