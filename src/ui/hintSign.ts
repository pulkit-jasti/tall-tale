// The tutorial's hint sign: a small sign low in front of the player, just
// above the ring handle, with one short instruction at a time (learn by
// doing). It always stays in the same spot: it rises with the board but never
// spins and never follows the head. A canvas texture with Kenney UI images,
// redrawn only when its text changes.
import { CanvasTexture, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, type Object3D } from 'three';
import type { GameAudio } from '../audio/sound.js';
import { HINT_SIGN } from '../config/game.js';
import { mark } from '../debug/perfMarks.js';
import type { HandState } from '../player/hands.js';
import { degToRad } from '../rules/boardMath.js';
import { PokeButton } from './pokeButton.js';
import { drawIcon, drawNineSlice, wrapText, type UiImageName } from './uiImages.js';

export interface SignContent {
  /** 'lesson' shows a checkbox, 'banner' a wave title. */
  kind: 'lesson' | 'banner';
  /** Small top line: "Step 3 of 8" or "Wave 2 of 5". */
  header: string;
  /** The instruction, one or two short lines. */
  text: string;
  icon?: UiImageName;
  /** Small bottom line, for example "Goblins left: 4" or where to look. */
  sub?: string;
  /** The lesson is done: the checkbox is ticked. */
  done?: boolean;
  /** Show the "Next" poke button (info steps the player can skip). */
  next?: boolean;
}

const INK = '#4a3424';
const SUB_INK = '#8a5a34';
const CANVAS_WIDTH = 768;

export class HintSign {
  private root = new Group();
  private canvas = document.createElement('canvas');
  private texture: CanvasTexture;
  private drawn = '';
  /** Little pop when the text changes (1 = settled). */
  private pop = 1;
  private next: PokeButton;

  constructor(parent: Object3D, audio: GameAudio) {
    const { width, height, radius, y, tiltDeg } = HINT_SIGN;
    this.canvas.width = CANVAS_WIDTH;
    this.canvas.height = Math.round((CANVAS_WIDTH * height) / width);
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.anisotropy = 4;
    const mesh = new Mesh(
      new PlaneGeometry(width, height),
      new MeshBasicMaterial({ map: this.texture, transparent: true, fog: false, toneMapped: false }),
    );
    // Straight in front of the player, its face (+z) toward them, tilted back like a lectern.
    const face = new Group();
    face.rotation.x = -degToRad(tiltDeg);
    face.add(mesh);
    // "Next" button in the bottom right corner, for info steps the player can skip.
    const r = HINT_SIGN.nextRadius;
    this.next = new PokeButton(r, HINT_SIGN.nextDepth, HINT_SIGN.nextColor, audio);
    this.next.group.position.set(width / 2 - r * 1.6, -height / 2 + r * 1.6, 0);
    this.next.group.visible = false;
    face.add(this.next.group);
    this.root.add(face);
    this.root.position.set(0, y + (height / 2) * Math.cos(degToRad(tiltDeg)), -radius);
    this.root.visible = false;
    parent.add(this.root);
  }

  show(content: SignContent | null): void {
    if (!content) {
      this.root.visible = false;
      this.drawn = '';
      return;
    }
    this.root.visible = true;
    if (!!content.next !== this.next.group.visible) {
      this.next.group.visible = !!content.next;
      this.next.reset();
    }
    const key = JSON.stringify(content);
    if (key === this.drawn) return;
    // A new instruction pops in. Ticking the box or a counter change does not.
    const sameText = this.drawn && JSON.parse(this.drawn).text === content.text;
    if (!sameText) this.pop = 0;
    this.drawn = key;
    this.draw(content);
  }

  /** True on the frame the "Next" button is poked (only while it shows). */
  pokedNext(hands: HandState[], dt: number): boolean {
    return this.root.visible && this.next.group.visible && this.next.update(hands, dt);
  }

  update(dt: number): void {
    if (this.pop >= 1) return;
    this.pop = Math.min(1, this.pop + dt / HINT_SIGN.popTime);
    // Ease out with a small overshoot, then settle at full size.
    const t = this.pop - 1;
    const ease = 1 + 2.7 * t * t * t + 1.7 * t * t;
    this.root.scale.setScalar(0.8 + 0.2 * ease);
  }

  private draw(content: SignContent): void {
    mark('hint sign');
    const c = this.canvas.getContext('2d')!;
    const w = this.canvas.width;
    const h = this.canvas.height;
    c.clearRect(0, 0, w, h);
    const pad = 18;
    if (!drawNineSlice(c, 'panel', 0, 0, w, h, 16, 40)) {
      c.fillStyle = '#e8d7b0';
      c.fillRect(0, 0, w, h);
    }
    // Header: a hanging banner for waves, a plain line with a checkbox for lessons.
    const headerH = 70;
    c.textBaseline = 'middle';
    if (content.kind === 'banner') {
      drawNineSlice(c, 'banner', w * 0.2, pad, w * 0.6, headerH, 24, 30);
      c.fillStyle = '#fff4dc';
      c.textAlign = 'center';
      c.font = 'bold 40px sans-serif';
      c.fillText(content.header, w / 2, pad + headerH / 2);
    } else {
      c.fillStyle = SUB_INK;
      c.textAlign = 'left';
      c.font = 'bold 34px sans-serif';
      c.fillText(content.header, pad + 30, pad + headerH / 2);
      drawIcon(c, content.done ? 'checkOn' : 'checkOff', w - pad - 30 - 58, pad + 6, 58);
    }
    // Body: icon on the left, the instruction on the right.
    const bodyTop = pad + headerH + 6;
    const subH = content.sub ? 46 : 0;
    const bodyH = h - bodyTop - pad - subH - 14;
    drawNineSlice(c, 'panelInset', pad + 12, bodyTop, w - pad * 2 - 24, bodyH + 12, 16, 28);
    let textLeft = pad + 40;
    if (content.icon) {
      const size = Math.min(bodyH - 20, 110);
      drawIcon(c, content.icon, pad + 34, bodyTop + (bodyH + 12 - size) / 2, size, iconTint(content.icon));
      textLeft = pad + 34 + size + 24;
    }
    c.fillStyle = INK;
    c.textAlign = 'left';
    let size = 44;
    let lines: string[];
    // Shrink the text until it fits.
    for (;;) {
      c.font = `bold ${size}px sans-serif`;
      lines = wrapText(c, content.text, w - textLeft - pad - 40);
      if (lines.length * size * 1.2 <= bodyH - 10 || size <= 28) break;
      size -= 2;
    }
    const top = bodyTop + 6 + (bodyH - lines.length * size * 1.2) / 2 + (size * 1.2) / 2;
    lines.forEach((line, i) => c.fillText(line, textLeft, top + i * size * 1.2));
    if (content.sub) {
      c.fillStyle = SUB_INK;
      c.textAlign = 'center';
      c.font = 'bold 30px sans-serif';
      c.fillText(content.sub, w / 2 - (content.next ? 60 : 0), h - pad - subH / 2 - 4);
    }
    if (content.next) {
      // Label just left of the round button in the corner.
      const buttonLeft = w - ((HINT_SIGN.nextRadius * 2.6) / HINT_SIGN.width) * w;
      c.fillStyle = SUB_INK;
      c.textAlign = 'right';
      c.font = 'bold 30px sans-serif';
      c.fillText('Next', buttonLeft - 10, h - pad - 26);
    }
    this.texture.needsUpdate = true;
  }
}

/** White icons are tinted to the sign's ink. Colored images keep their own colors. */
function iconTint(name: UiImageName): string | undefined {
  return ['up', 'down', 'check', 'info', 'trophy', 'warning', 'target', 'returnArrow'].includes(name) ? INK : undefined;
}
