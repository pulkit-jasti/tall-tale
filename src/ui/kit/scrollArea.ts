// A scrolling page area (docs/custom-mode.md "UI kit parts"): a window onto
// a column of items (setting rows, text fields) with the scrollbar beside
// it, the one way every page scrolls. The items are real 3D controls, so
// nothing is redrawn while it scrolls: the column only moves.
//
// Items are cut exactly at the window's top and bottom edges, in the shader
// by world position (src/ui/kit/windowClip.ts: three.js's clipping planes
// cut differently for each eye under multiview), so the window is always
// full (headset test 2026-11-11: hiding a row as soon as it touched an edge
// left big empty bands). An item works while its middle is inside the
// window (mostly shown); one cut more than half away does nothing.
// The scrollbar is the upright Slider in its scrollbar look; it hides when
// everything fits. Its face points along +z (cm), the group at the window's
// middle.
import { Group, Matrix3, Plane, Vector3, type Material, type Mesh, type Object3D } from 'three';
import type { GameAudio } from '../../audio/sound.js';
import { SCROLL_LIST, SLIDER } from '../../config/game.js';
import type { HandState } from '../../player/hands.js';
import { Slider } from '../slider.js';
import { armControls, flushAfterDrag, type Control } from './controls.js';
import { clipToWindow, createWindowEdges, setWindowEdges } from './windowClip.js';

/** Something in the column: its group (placed by the area, its middle at its height's middle), its height, its controls. */
export interface ScrollItem {
  group: Object3D;
  height: number;
  controls: Control[];
  update(hands: HandState[], dt: number): void;
}

export interface ScrollAreaOptions {
  width: number;
  height: number;
  /** Room between items (cm). */
  gap: number;
  /** The scrollbar's x, from the window's middle (cm). */
  scrollbarX: number;
}

const point = new Vector3();
const normal = new Vector3();
const normalMatrix = new Matrix3();

export class ScrollArea implements Control {
  readonly group = new Group();
  private column = new Group();
  private items: { item: ScrollItem; top: number; inside: boolean }[] = [];
  private bar: Slider;
  private content = 0;
  /** How far the column is scrolled down (cm), and where the scrollbar asks it to be. */
  private scroll = 0;
  private target = 0;
  /** The window's top and bottom edges as world planes, and as the uniforms every item material cuts by (kept up to date each frame). */
  private planes = [new Plane(), new Plane()];
  private edges = createWindowEdges();

  constructor(
    audio: GameAudio,
    private options: ScrollAreaOptions,
  ) {
    this.group.add(this.column);
    const pill = SLIDER.scrollbar.pillLength;
    this.bar = new Slider(audio, { length: options.height - pill, steps: 40, value: 1, vertical: true, scrollbar: true });
    this.bar.group.position.x = options.scrollbarX;
    this.bar.onChange = (value) => {
      this.target = (1 - value) * this.maxScroll;
    };
    this.group.add(this.bar.group);
  }

  private get maxScroll(): number {
    return Math.max(0, this.content - this.options.height);
  }

  /** New items, top to bottom; back to the top. The old ones are taken off (the caller keeps or drops them). */
  setItems(items: ScrollItem[]): void {
    for (const { item } of this.items) this.column.remove(item.group);
    this.items = [];
    let y = 0;
    for (const item of items) {
      this.items.push({ item, top: y, inside: false });
      item.group.position.y = -y - item.height / 2;
      this.column.add(item.group);
      // Cut at the window's edges.
      item.group.traverse((o) => {
        const mesh = o as Mesh;
        if (!mesh.isMesh) return;
        for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material as Material]) clipToWindow(m, this.edges);
      });
      y += item.height + this.options.gap;
    }
    this.content = Math.max(0, y - this.options.gap);
    this.bar.group.visible = this.maxScroll > 0;
    this.scrollToTop();
  }

  scrollToTop(): void {
    this.scroll = this.target = 0;
    this.bar.setValue(1);
    this.place();
  }

  /** Every control of every item, and the scrollbar (to arm them when the page opens). */
  get controls(): Control[] {
    return [this.bar, ...this.items.flatMap(({ item }) => item.controls)];
  }

  reset(): void {
    armControls(this.controls, 0);
  }

  lock(seconds: number): void {
    for (const c of this.controls) c.lock(seconds);
  }

  update(hands: HandState[], dt: number): void {
    // Held back redraws run once a drag ends (also one whose page closed mid-drag).
    flushAfterDrag();
    if (this.bar.group.visible) this.bar.update(hands, dt);
    // Glide toward the asked spot, like the campaign list does.
    if (Math.abs(this.target - this.scroll) > 1e-3) {
      this.scroll += (this.target - this.scroll) * Math.min(1, dt * SCROLL_LIST.follow);
      if (Math.abs(this.target - this.scroll) < 0.01) this.scroll = this.target;
      this.place();
    }
    this.updatePlanes();
    for (const entry of this.items) if (entry.inside) entry.item.update(hands, dt);
  }

  /** The column at its scroll. An item shows while any of it is in the window (cut at the edges), and works while its middle is. */
  private place(): void {
    const half = this.options.height / 2;
    this.column.position.y = half + this.scroll;
    for (const entry of this.items) {
      const shownTop = entry.top - this.scroll;
      const shownBottom = shownTop + entry.item.height;
      entry.item.group.visible = shownBottom > 0 && shownTop < this.options.height;
      const middle = (shownTop + shownBottom) / 2;
      const inside = middle >= 0 && middle <= this.options.height;
      // A control that comes into view starts fresh (no half-held drag from before it left).
      if (inside && !entry.inside) armControls(entry.item.controls, 0);
      entry.inside = inside;
    }
  }

  /** The window's edges in the world now (the panel follows the board up and down): keep what is below the top and above the bottom. */
  private updatePlanes(): void {
    const m = this.group.matrixWorld;
    this.group.updateWorldMatrix(true, false);
    normalMatrix.getNormalMatrix(m);
    const half = this.options.height / 2;
    normal.set(0, -1, 0).applyMatrix3(normalMatrix).normalize();
    this.planes[0].setFromNormalAndCoplanarPoint(normal, point.set(0, half, 0).applyMatrix4(m));
    normal.set(0, 1, 0).applyMatrix3(normalMatrix).normalize();
    this.planes[1].setFromNormalAndCoplanarPoint(normal, point.set(0, -half, 0).applyMatrix4(m));
    setWindowEdges(this.edges, this.planes[0], this.planes[1]);
  }
}
