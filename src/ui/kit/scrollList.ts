// The swipe list (SCROLL_LIST in config, from Meta's hands UI guidance): a
// window onto a tall list of rows, scrolled by touching it with the index
// finger and swiping up or down, the way a phone list scrolls. There is no
// scroll bar (Meta: users reach for a swipe on the content). A tap (touch
// and lift without dragging) selects a row, with a click. The row under the
// finger lights up (hover, a tick), darkens while pressed, and the selected
// row is drawn by the caller (it knows how). Rows at the edges show cut
// off: the hint that there is more.
//
// No redrawing while it scrolls: every row is drawn once into one tall
// canvas, and the window only moves over it (the texture's offset). The
// canvas is drawn again only when the caller asks (a new selection, new
// stars). It lies on a panel: it draws after the panel board (renderOrder)
// and never writes depth, so the panel never shows a hole behind it.
// Its face points along the group's local +z. Sizes in cm.
import { CanvasTexture, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, Vector3 } from 'three';
import type { GameAudio } from '../../audio/sound.js';
import { SCROLL_LIST } from '../../config/game.js';
import { mark } from '../../debug/perfMarks.js';
import type { HandState } from '../../player/hands.js';
import type { Control } from './controls.js';

export interface ScrollListOptions {
  /** The window's size (cm). */
  width: number;
  height: number;
  /** Each row's height, and the gap between rows (cm). */
  rowHeight: number;
  rowGap: number;
  count: number;
  /** Draws row `i` at 0, 0 (its own w by h pixels; the context is moved there). */
  drawRow: (c: CanvasRenderingContext2D, i: number, w: number, h: number) => void;
  /** False for a row that cannot be selected (a "More coming soon" row). */
  selectable?: (i: number) => boolean;
  /**
   * False: touching the list never scrolls it, a touch is only ever a tap
   * (forgiving a wobble up to SCROLL_LIST.tapSlop), and something else
   * scrolls it (scrollToShare, the campaign's upright slider). The developer
   * chose this after swipes and taps got mixed up on the headset.
   */
  swipe?: boolean;
}

const local = new Vector3();

export class ScrollList implements Control {
  /** Place this group on the panel (its middle). Its +z is the list's face. */
  readonly group = new Group();
  /** Called with the row a tap selected. */
  onSelect: (i: number) => void = () => {};
  private canvas = document.createElement('canvas');
  private texture: CanvasTexture;
  private content: number;
  private pitch: number;
  /** How far the window is scrolled down the list (cm), and its speed (cm per second). */
  private scroll = 0;
  private speed = 0;
  /** The touching finger: where it started (list y, and the scroll then), the row it started on, and if it became a drag. */
  private finger: HandState | null = null;
  private startY = 0;
  private startScroll = 0;
  private startRow = -1;
  private dragging = false;
  private lastY = 0;
  /** A finger came from the front (it was over the list, past armAt), so touching counts. */
  private armed = new Set<HandState>();
  private hoverRow = -1;
  private hover: Mesh;
  private hoverMaterial: MeshBasicMaterial;
  private cooldown = 0;

  constructor(
    private audio: GameAudio,
    private options: ScrollListOptions,
  ) {
    const L = SCROLL_LIST;
    this.pitch = options.rowHeight + options.rowGap;
    this.content = Math.max(options.height, options.count * this.pitch - options.rowGap);
    this.canvas.width = Math.round(options.width * L.pxPerCm);
    this.canvas.height = Math.round(this.content * L.pxPerCm);
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.anisotropy = 4;
    // The window shows `height` of the `content` tall canvas.
    this.texture.repeat.set(1, options.height / this.content);
    const list = new Mesh(
      new PlaneGeometry(options.width, options.height),
      new MeshBasicMaterial({ map: this.texture, transparent: true, depthWrite: false, fog: false, toneMapped: false }),
    );
    list.position.z = 0.05;
    // After the panel board, which is drawn first (renderOrder 0).
    list.renderOrder = 1;
    this.hoverMaterial = new MeshBasicMaterial({ color: L.hoverColor, transparent: true, opacity: L.hoverOpacity, depthWrite: false, fog: false, toneMapped: false });
    this.hover = new Mesh(new PlaneGeometry(options.width, 1), this.hoverMaterial);
    this.hover.position.z = 0.08;
    this.hover.renderOrder = 2;
    this.hover.visible = false;
    this.group.add(list, this.hover);
    this.redraw();
    this.place();
  }

  /** Draws every row again into the canvas (a new selection, new stars). Never while scrolling. */
  redraw(): void {
    mark('panel redraw');
    const c = this.canvas.getContext('2d')!;
    const px = SCROLL_LIST.pxPerCm;
    const w = this.canvas.width;
    const h = Math.round(this.options.rowHeight * px);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, w, this.canvas.height);
    for (let i = 0; i < this.options.count; i++) {
      c.save();
      c.translate(0, Math.round(i * this.pitch * px));
      this.options.drawRow(c, i, w, h);
      c.restore();
    }
    this.texture.needsUpdate = true;
  }

  /** Back to the top, still. */
  scrollToTop(): void {
    this.scroll = 0;
    this.speed = 0;
    this.aim = null;
    this.place();
  }

  /** Scrolls to `share` of the way down (0 the top, 1 the bottom), gliding there smoothly (the slider). */
  scrollToShare(share: number): void {
    this.aim = Math.min(1, Math.max(0, share)) * this.maxScroll;
  }

  /** Where the list is scrolled to (0 the top, 1 the bottom). */
  get share(): number {
    return this.maxScroll > 0 ? this.scroll / this.maxScroll : 0;
  }

  /** Where scrollToShare wants the window (cm), while it glides there. */
  private aim: number | null = null;

  reset(): void {
    this.finger = null;
    this.dragging = false;
    this.armed.clear();
    this.setHover(-1, false);
  }

  lock(seconds: number): void {
    this.cooldown = Math.max(this.cooldown, seconds);
  }

  update(hands: HandState[], dt: number): void {
    const L = SCROLL_LIST;
    const { width, height } = this.options;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.group.updateWorldMatrix(true, false);
    if (this.finger) {
      const hand = this.finger;
      this.group.worldToLocal(local.copy(hand.indexTip));
      const off = !hand.tracked || local.z > L.releaseOut || Math.abs(local.x) > width / 2 + L.sideMargin || Math.abs(local.y) > height / 2 + L.sideMargin;
      if (off) {
        this.letGo();
      } else {
        const moved = local.y - this.startY;
        // Tap only (no swipe): a finger that wanders too far is no tap, and nothing scrolls.
        if (this.options.swipe === false) {
          if (Math.abs(moved) > L.tapSlop) {
            this.startRow = -1;
            this.setHover(-1, false);
          }
        } else if (!this.dragging && Math.abs(moved) > L.dragStart) {
          this.dragging = true;
          this.setHover(-1, false);
        }
        if (this.dragging) {
          // The list follows the finger 1:1 (finger up, the list goes up: further down it), stretching past an end.
          let next = this.startScroll + moved;
          const max = this.maxScroll;
          if (next < 0) next *= L.rubber;
          else if (next > max) next = max + (next - max) * L.rubber;
          const v = (local.y - this.lastY) / Math.max(dt, 1e-3);
          this.speed += (v - this.speed) * Math.min(1, dt / L.speedSmoothing);
          this.scroll = next;
        }
        this.lastY = local.y;
      }
    } else {
      this.coast(dt);
      // Hover, and a touch from the front.
      let hovered = -1;
      for (const hand of hands) {
        if (!hand.tracked) {
          this.armed.delete(hand);
          continue;
        }
        this.group.worldToLocal(local.copy(hand.indexTip));
        const over = Math.abs(local.x) <= width / 2 && Math.abs(local.y) <= height / 2 && local.z > -L.touchAt;
        if (!over || local.z > L.readyDistance) {
          this.armed.delete(hand);
          continue;
        }
        if (local.z > L.armAt) this.armed.add(hand);
        hovered = this.rowAt(local.y);
        if (local.z <= L.touchAt && this.armed.has(hand) && this.cooldown <= 0) {
          this.finger = hand;
          this.startY = this.lastY = local.y;
          this.startScroll = this.scroll;
          this.startRow = hovered;
          this.dragging = false;
          // A touch stops a coast at once, like a phone list.
          this.speed = 0;
          break;
        }
      }
      if (!this.finger) this.setHover(hovered, false);
      else this.setHover(this.startRow, true);
    }
    this.place();
  }

  private get maxScroll(): number {
    return Math.max(0, this.content - this.options.height);
  }

  /** The finger lifted: a tap selects its row; a drag coasts on. */
  private letGo(): void {
    const hand = this.finger;
    this.finger = null;
    if (hand) this.armed.delete(hand);
    if (this.dragging) {
      this.dragging = false;
      this.speed = Math.max(-SCROLL_LIST.maxSpeed, Math.min(SCROLL_LIST.maxSpeed, this.speed));
      return;
    }
    const row = this.startRow;
    this.setHover(-1, false);
    if (row < 0 || (this.options.selectable && !this.options.selectable(row))) return;
    this.audio.play('buttonClick');
    this.onSelect(row);
  }

  /** Coasting after a fling, slowing down; past an end it springs back. */
  private coast(dt: number): void {
    const L = SCROLL_LIST;
    const max = this.maxScroll;
    // Scrolled from outside (the slider): glide to where it asks.
    if (this.aim !== null) {
      this.scroll += (this.aim - this.scroll) * Math.min(1, dt * L.follow);
      if (Math.abs(this.aim - this.scroll) < 0.01) {
        this.scroll = this.aim;
        this.aim = null;
      }
      this.speed = 0;
      return;
    }
    if (this.scroll < 0 || this.scroll > max) {
      const end = this.scroll < 0 ? 0 : max;
      this.scroll += (end - this.scroll) * Math.min(1, dt * L.spring);
      if (Math.abs(end - this.scroll) < 0.01) this.scroll = end;
      this.speed = 0;
      return;
    }
    if (Math.abs(this.speed) < L.stopSpeed) {
      this.speed = 0;
      return;
    }
    this.scroll += this.speed * dt;
    this.speed *= Math.exp(-L.friction * dt);
  }

  /** The row at list y (cm from its middle), or -1 between rows or past the last. */
  private rowAt(y: number): number {
    const at = this.options.height / 2 - y + this.scroll;
    const i = Math.floor(at / this.pitch);
    if (i < 0 || i >= this.options.count || at - i * this.pitch > this.options.rowHeight) return -1;
    return i;
  }

  private setHover(row: number, pressed: boolean): void {
    if (row !== this.hoverRow && row >= 0 && !pressed) this.audio.play('readyTick', undefined, 0.8, 0.05);
    this.hoverRow = row;
    const L = SCROLL_LIST;
    const show = row >= 0 && (!this.options.selectable || this.options.selectable(row));
    this.hover.visible = show;
    if (!show) return;
    this.hoverMaterial.color.setHex(pressed ? L.pressColor : L.hoverColor);
    this.hoverMaterial.opacity = pressed ? L.pressOpacity : L.hoverOpacity;
  }

  /** The window over the canvas, and the hover band over its row (cut to the window). */
  private place(): void {
    const { height, rowHeight } = this.options;
    this.texture.offset.y = (this.content - height - this.scroll) / this.content;
    if (this.hoverRow < 0) return;
    const top = Math.max(0, this.hoverRow * this.pitch - this.scroll);
    const bottom = Math.min(height, this.hoverRow * this.pitch - this.scroll + rowHeight);
    if (bottom <= top) {
      this.hover.visible = false;
      return;
    }
    this.hover.scale.y = bottom - top;
    this.hover.position.y = height / 2 - (top + bottom) / 2;
  }
}
