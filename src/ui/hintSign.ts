// The tutorial's hint sign: a sign in front of the player, past the goblins
// at the castle wall, with one short instruction at a time (learn by doing).
// It always stays in the same spot: it rises with the board but never spins
// and never follows the head. A shared Panel with Kenney UI images, redrawn
// only when its text changes. The sign is out of reach, so its Next button
// stands apart, in front between the tool platforms (HINT_SIGN.nextAt).
import { Group, type Object3D } from 'three';
import type { GameAudio } from '../audio/sound.js';
import { HINT_SIGN, POKE } from '../config/game.js';
import { mark } from '../debug/perfMarks.js';
import type { HandState } from '../player/hands.js';
import { degToRad } from '../rules/boardMath.js';
import { post } from '../world/shapes.js';
import { centerAbove, Panel, PANEL_INK as INK } from './panel.js';
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

const SUB_INK = '#8a5a34';

export class HintSign {
  private panel: Panel;
  private drawn = '';
  private next: PokeButton;
  /** The Next button's stand, in reach in front of the player. */
  private nextStand = new Group();

  constructor(parent: Object3D, audio: GameAudio) {
    const { width, height, radius, y, tiltDeg } = HINT_SIGN;
    this.panel = new Panel(parent, {
      width,
      height,
      radius,
      centerY: centerAbove(y, height, tiltDeg),
      tiltDeg,
      layoutWidth: 768,
      canvasScale: 1.5,
      anisotropy: 4,
    });
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
      this.panel.visible = false;
      this.nextStand.visible = false;
      this.drawn = '';
      return;
    }
    this.panel.visible = true;
    if (!!content.next !== this.nextStand.visible) {
      this.nextStand.visible = !!content.next;
      this.next.reset();
    }
    const key = JSON.stringify(content);
    if (key === this.drawn) return;
    // A new instruction pops in. Ticking the box or a counter change does not.
    const sameText = this.drawn && JSON.parse(this.drawn).text === content.text;
    if (!sameText) {
      this.panel.popIn(HINT_SIGN.popTime);
      // A new step: a finger still on Next must not skip it too.
      this.next.lock(POKE.lockAfterChange);
    }
    this.drawn = key;
    this.draw(content);
  }

  /** True on the frame the "Next" button is poked (only while it shows). */
  pokedNext(hands: HandState[], dt: number): boolean {
    return this.panel.visible && this.nextStand.visible && this.next.update(hands, dt);
  }

  update(dt: number): void {
    this.panel.update(dt);
  }

  private draw(content: SignContent): void {
    mark('hint sign');
    this.panel.paint((c, w, h) => this.drawContent(c, w, h, content));
  }

  private drawContent(c: CanvasRenderingContext2D, w: number, h: number, content: SignContent): void {
    const pad = 18;
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
  }
}

/** White icons are tinted to the sign's ink. Colored images keep their own colors. */
function iconTint(name: UiImageName): string | undefined {
  return ['up', 'down', 'check', 'info', 'trophy', 'warning', 'target', 'returnArrow'].includes(name) ? INK : undefined;
}
