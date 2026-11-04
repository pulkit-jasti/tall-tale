// The tutorial's hint sign: a sign in front of the player, past the goblins
// at the castle wall, with one short instruction at a time (learn by doing).
// It always stays in the same spot: it rises with the board but never spins
// and never follows the head. A canvas texture with Kenney UI images, redrawn
// only when its text changes. The sign is out of reach, so its Next button
// stands apart, in front between the tool platforms (HINT_SIGN.nextAt).
import { CanvasTexture, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, type Object3D } from 'three';
import type { GameAudio } from '../audio/sound.js';
import { HINT_SIGN, POKE } from '../config/game.js';
import { mark } from '../debug/perfMarks.js';
import type { HandState } from '../player/hands.js';
import { degToRad } from '../rules/boardMath.js';
import { post } from '../world/shapes.js';
import { PokeButton } from './pokeButton.js';
import { drawBanner, drawIcon, drawNineSlice, wrapText, type UiImageName } from './uiImages.js';

export interface SignContent {
  /** 'lesson' shows a checkbox, 'banner' a wave title. */
  kind: 'lesson' | 'banner';
  /** Small top line: "Step 3 of 8" or "Wave 2 of 5". */
  header: string;
  /** The instruction, one or two short lines. */
  text: string;
  icon?: UiImageName;
  /** Small bottom line, for example "Nice!" on a finished lesson. */
  sub?: string;
  /** The lesson is done: the checkbox is ticked. */
  done?: boolean;
  /** Show the "Next" poke button (info steps the player can skip). */
  next?: boolean;
}

const INK = '#4a3424';
const SUB_INK = '#8a5a34';
/** Layout width the drawing code is written for (pixels). */
const LAYOUT_WIDTH = 768;
/** The canvas is this many times sharper than the layout. */
const CANVAS_SCALE = 1.5;

export class HintSign {
  private root = new Group();
  private canvas = document.createElement('canvas');
  private texture: CanvasTexture;
  private drawn = '';
  /** Little pop when the text changes (1 = settled). */
  private pop = 1;
  private next: PokeButton;
  /** The Next button's stand, in reach in front of the player. */
  private nextStand = new Group();
  /** The text panel. Only it pops. */
  private panel: Mesh;

  constructor(parent: Object3D, audio: GameAudio) {
    const { width, height, radius, y, tiltDeg } = HINT_SIGN;
    this.canvas.width = Math.round(LAYOUT_WIDTH * CANVAS_SCALE);
    this.canvas.height = Math.round(((LAYOUT_WIDTH * height) / width) * CANVAS_SCALE);
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
    this.panel = mesh;
    this.root.add(face);
    this.root.position.set(0, y + (height / 2) * Math.cos(degToRad(tiltDeg)), -radius);
    this.root.visible = false;
    parent.add(this.root);
    // "Next" button straight in front, in reach, its face tilted up toward the eyes.
    this.next = new PokeButton(audio, { radius: HINT_SIGN.nextRadius, icon: 'next' });
    this.next.group.rotation.x = -degToRad(HINT_SIGN.nextTiltDeg);
    // A post down to the board, so it stands like the tool platforms.
    const stem = post(HINT_SIGN.nextY - HINT_SIGN.nextRadius);
    stem.position.y -= HINT_SIGN.nextRadius;
    this.nextStand.add(this.next.group, stem);
    this.nextStand.position.set(0, HINT_SIGN.nextY, -HINT_SIGN.nextAt);
    this.nextStand.visible = false;
    parent.add(this.nextStand);
  }

  show(content: SignContent | null): void {
    if (!content) {
      this.root.visible = false;
      this.nextStand.visible = false;
      this.drawn = '';
      return;
    }
    this.root.visible = true;
    if (!!content.next !== this.nextStand.visible) {
      this.nextStand.visible = !!content.next;
      this.next.reset();
    }
    const key = JSON.stringify(content);
    if (key === this.drawn) return;
    // A new instruction pops in. Ticking the box or a counter change does not.
    const sameText = this.drawn && JSON.parse(this.drawn).text === content.text;
    if (!sameText) {
      this.pop = 0;
      // A new step: a finger still on Next must not skip it too.
      this.next.lock(POKE.lockAfterChange);
    }
    this.drawn = key;
    this.draw(content);
  }

  /** True on the frame the "Next" button is poked (only while it shows). */
  pokedNext(hands: HandState[], dt: number): boolean {
    return this.root.visible && this.nextStand.visible && this.next.update(hands, dt);
  }

  update(dt: number): void {
    if (this.pop >= 1) return;
    this.pop = Math.min(1, this.pop + dt / HINT_SIGN.popTime);
    // Ease out with a small overshoot, then settle at full size.
    const t = this.pop - 1;
    const ease = 1 + 2.7 * t * t * t + 1.7 * t * t;
    this.panel.scale.setScalar(0.8 + 0.2 * ease);
  }

  private draw(content: SignContent): void {
    mark('hint sign');
    const c = this.canvas.getContext('2d')!;
    // Laid out at LAYOUT_WIDTH, drawn at CANVAS_SCALE times that, so text stays sharp further away.
    c.setTransform(CANVAS_SCALE, 0, 0, CANVAS_SCALE, 0, 0);
    const w = LAYOUT_WIDTH;
    const h = this.canvas.height / CANVAS_SCALE;
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
      drawBanner(c, w * 0.2, pad, w * 0.6, headerH);
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
      c.fillText(content.sub, w / 2, h - pad - subH / 2 - 4);
    }
    this.texture.needsUpdate = true;
  }
}

/** White icons are tinted to the sign's ink. Colored images keep their own colors. */
function iconTint(name: UiImageName): string | undefined {
  return ['up', 'down', 'check', 'info', 'trophy', 'warning', 'target', 'returnArrow'].includes(name) ? INK : undefined;
}
