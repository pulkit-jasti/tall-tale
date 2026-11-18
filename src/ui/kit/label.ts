// A small canvas picture that lies on a panel (a row's name and value, a
// stepper's number, a field's message): drawn only when asked, never every
// frame. Like the ScrollList it draws after the panel board and never writes
// depth, so the panel never shows a hole behind it. Its face points along
// +z. Sizes in cm.
import { LinearFilter, Mesh, MeshBasicMaterial, PlaneGeometry, type CanvasTexture } from 'three';
import { preparedTextures } from '../panel.js';
import { mark } from '../../debug/perfMarks.js';
import { canvasTexture } from './canvas.js';
import { afterDrag } from './controls.js';

export class CanvasLabel {
  readonly mesh: Mesh;
  private canvas = document.createElement('canvas');
  /**
   * Two textures of the same canvas, taking turns (2026-11-18): a redraw goes into the one not drawn last
   * frame, so the GPU never has to wait for a frame still using it (each small label redraw, a stepper tap,
   * a slider let go, still dropped a frame on the Quest). No mipmaps: a flat label seen from the front needs
   * none, and making them is extra GPU work on every redraw.
   */
  private textures: [CanvasTexture, CanvasTexture];
  private front = 0;

  constructor(
    readonly width: number,
    readonly height: number,
    pxPerCm = 30,
  ) {
    this.canvas.width = Math.max(2, Math.round(width * pxPerCm));
    this.canvas.height = Math.max(2, Math.round(height * pxPerCm));
    this.textures = [labelTexture(this.canvas), labelTexture(this.canvas)];
    // Both are sent to the GPU at the warm-up (the one off the mesh too), so a first use costs nothing extra.
    preparedTextures.add(this.textures[0]);
    preparedTextures.add(this.textures[1]);
    this.mesh = new Mesh(
      new PlaneGeometry(width, height),
      new MeshBasicMaterial({ map: this.textures[0], transparent: true, depthWrite: false, fog: false, toneMapped: false }),
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
    // Into the other texture, then show it (one texture for another of the same kind needs no new shader).
    this.front = 1 - this.front;
    const texture = this.textures[this.front];
    texture.needsUpdate = true;
    (this.mesh.material as MeshBasicMaterial).map = texture;
  }
}

/** A label's texture: sharp at a slant, no mipmaps (see CanvasLabel). */
function labelTexture(canvas: HTMLCanvasElement): CanvasTexture {
  const texture = canvasTexture(canvas, 4);
  texture.generateMipmaps = false;
  texture.minFilter = LinearFilter;
  return texture;
}
