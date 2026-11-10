// The tutorial's hint sign: a sign in front of the player, past the goblins
// at the castle wall, with one short instruction at a time (learn by doing).
// It always stays in the same spot: it rises with the board but never spins
// and never follows the head. A shared Panel with Kenney UI images, redrawn
// only when its text changes. The sign is out of reach, so its Next button
// stands apart, in front between the tool platforms (HINT_SIGN.nextAt).
import { type Object3D } from 'three';
import type { GameAudio } from '../audio/sound.js';
import { BOARD, HINT_SIGN, POKE } from '../config/game.js';
import { mark } from '../debug/perfMarks.js';
import type { HandState } from '../player/hands.js';
import { centerAbove, drawIcon, drawLine, drawNineSlice, drawTitleBanner, Panel, StandButton, UI_COLORS, wrapText, type UiImageName } from './kit/index.js';

const INK = UI_COLORS.ink;

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

const SUB_INK = UI_COLORS.note;

export class HintSign {
  private panel: Panel;
  private drawn = '';
  /** The Next button on its stand, in reach in front of the player. */
  private next: StandButton;
  /** How long the Next button has waited for a poke (seconds); it blinks after HINT_SIGN.nextBlinkAfter. */
  private nextWait = 0;
  /** The sign's middle in a wave (up, out of the way), while no wave is fought (in front of the eyes), and where it goes now (cm). */
  private battleY: number;
  private calmY: number;
  private targetY: number;

  constructor(parent: Object3D, audio: GameAudio) {
    const { width, height, radius, y, tiltDeg } = HINT_SIGN;
    this.battleY = centerAbove(y, height, tiltDeg);
    this.calmY = BOARD.eyeToBoard * 100 - HINT_SIGN.calmBelowEyes;
    this.targetY = this.calmY;
    this.panel = new Panel(parent, {
      width,
      height,
      radius,
      centerY: this.calmY,
      tiltDeg,
      layoutWidth: 768,
      canvasScale: 1.5,
      anisotropy: 4,
    });
    // "Next" button straight in front, in reach, its face tilted up toward the eyes.
    this.next = new StandButton(parent, audio, {
      radius: HINT_SIGN.nextRadius,
      icon: 'next',
      at: HINT_SIGN.nextAt,
      y: HINT_SIGN.nextY,
      tiltDeg: HINT_SIGN.nextTiltDeg,
    });
  }

  /**
   * While no wave is fought (the first lessons, the breathers) the sign
   * hangs lower, right in front of the eyes, so it is not missed; in a wave
   * it goes back up, out of the way of the enemies. It glides between them.
   */
  setCalm(calm: boolean): void {
    this.targetY = calm ? this.calmY : this.battleY;
  }

  show(content: SignContent | null): void {
    if (!content) {
      this.panel.visible = false;
      this.next.show(false);
      this.drawn = '';
      return;
    }
    this.panel.visible = true;
    if (!!content.next !== this.next.visible) this.nextWait = 0;
    this.next.show(!!content.next);
    const key = JSON.stringify(content);
    if (key === this.drawn) return;
    // A new instruction pops in. Ticking the box or a counter change does not.
    const sameText = this.drawn && JSON.parse(this.drawn).text === content.text;
    if (!sameText) {
      this.panel.popIn(HINT_SIGN.popTime);
      // A new step: a finger still on Next must not skip it too, and its blink waits again.
      this.next.lock(POKE.lockAfterChange);
      this.nextWait = 0;
      this.next.setBlink(null);
    }
    this.drawn = key;
    this.draw(content);
  }

  /** The Next button is out (the pause button, on the same spot, steps aside). */
  get nextShown(): boolean {
    return this.panel.visible && this.next.visible;
  }

  /** True on the frame the "Next" button is poked (only while it shows). */
  pokedNext(hands: HandState[], dt: number): boolean {
    return this.panel.visible && this.next.update(hands, dt);
  }

  update(dt: number): void {
    this.panel.update(dt);
    // Glide up or down to where it hangs now.
    const root = this.panel.root;
    root.position.y += (this.targetY - root.position.y) * Math.min(1, dt / HINT_SIGN.moveTime * 3);
    // Next waits a while for the player to read, then blinks until it is poked, so it is not missed.
    if (this.next.visible && this.panel.visible) {
      const before = this.nextWait;
      this.nextWait += dt;
      if (before < HINT_SIGN.nextBlinkAfter && this.nextWait >= HINT_SIGN.nextBlinkAfter) {
        this.next.setBlink({ color: HINT_SIGN.nextBlinkColor, intensity: HINT_SIGN.nextBlinkIntensity, speed: HINT_SIGN.nextBlinkSpeed });
      }
    }
  }

  private draw(content: SignContent): void {
    mark('hint sign');
    this.panel.paint((c, w, h) => this.drawContent(c, w, h, content));
  }

  private drawContent(c: CanvasRenderingContext2D, w: number, h: number, content: SignContent): void {
    const pad = 18;
    // Header: a hanging banner for waves, a plain line with a checkbox for lessons.
    const headerH = 70;
    if (content.kind === 'banner') {
      drawTitleBanner(c, content.header, w * 0.2, pad, w * 0.6, headerH, 40);
    } else {
      drawLine(c, content.header, pad + 30, pad + headerH / 2, w - pad * 2 - 30 - 58 - 40, 34, SUB_INK, 'left');
      // A green tick once done, so it reads as done at a glance.
      drawIcon(c, content.done ? 'checkOn' : 'checkOff', w - pad - 30 - 58, pad + 6, 58, content.done ? HINT_SIGN.doneColor : undefined);
    }
    c.textBaseline = 'middle';
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
