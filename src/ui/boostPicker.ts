// Endless mode's breather pick (docs/v3-plan.md Phase 5, "Boost cards"): a
// panel in front with one column per card (its Kenney icon, its name and
// one line of plain text) and a round tick button under each. One poke
// picks. After waves 10, 20, 30 and 40 the same panel offers every tool not
// on the stand instead. A line along the bottom counts down to the next
// wave (no pick: the wave starts without one). Built from the UI library;
// the canvas is redrawn only when the shown second changes.
import type { Object3D } from 'three';
import type { GameAudio } from '../audio/sound.js';
import { ENDLESS, POKE, UI_SPACING } from '../config/game.js';
import type { HandState } from '../player/hands.js';
import type { BoostCard } from '../rules/boosts.js';
import type { PickTool } from '../rules/campaign.js';
import { armControls, bottomRowY, drawIconCentered, drawLine, drawTitleBanner, Panel, panelMap, PokeButton, UI_COLORS, uiCenterY, wrapText, type UiImageName } from './kit/index.js';

const P = ENDLESS.panel;
const MAX_OPTIONS = 4;

/** Each tool's name and line on a tool card. */
const TOOL_TEXT: Record<PickTool, string> = {
  slingshot: 'Slingshot',
  horn: 'War horn',
  swatter: 'Fly swatter',
  pepper: 'Pepper',
  drum: 'Drum',
  magnet: 'Magnet',
  glass: 'Magnifying glass',
  sugar: 'Sugar cubes',
};

interface Option {
  name: string;
  text: string;
  icon: UiImageName;
  rare: boolean;
}

export class BoostPicker {
  private panel: Panel;
  private buttons: PokeButton[] = [];
  private options: Option[] = [];
  private title = '';
  private left = 0;
  private shownSecond = -1;

  constructor(parent: Object3D, audio: GameAudio) {
    const width = P.columnWidth * 3;
    this.panel = new Panel(parent, { width, height: P.height, radius: P.radius, centerY: uiCenterY(P.height, P.tiltDeg), tiltDeg: P.tiltDeg, layoutWidth: 640, canvasScale: 2 });
    for (let i = 0; i < MAX_OPTIONS; i++) {
      const button = new PokeButton(audio, { radius: P.buttonRadius, icon: 'tick' });
      this.panel.root.add(button.group);
      this.buttons.push(button);
    }
    this.panel.visible = false;
  }

  get visible(): boolean {
    return this.panel.visible;
  }

  /** The boost cards to pick from. */
  showCards(cards: BoostCard[], stacks: ReadonlyMap<string, number>): void {
    this.open(
      'Pick a boost',
      cards.map((c) => {
        const had = stacks.get(c.id) ?? 0;
        return { name: had > 0 ? `${c.name} ${had + 1}` : c.name, text: c.text, icon: c.icon, rare: c.rare };
      }),
    );
  }

  /** The new tools to pick from (every tool not on the stand). */
  showTools(tools: PickTool[]): void {
    this.open(
      'Pick a new tool',
      tools.map((t) => ({ name: TOOL_TEXT[t], text: 'On a new platform behind you', icon: 'award' as const, rare: false })),
    );
  }

  hide(): void {
    this.panel.visible = false;
  }

  /** The option poked this frame (its index), or null. Counts down the time shown. */
  update(hands: HandState[], dt: number): number | null {
    if (!this.panel.visible) return null;
    this.panel.update(dt);
    this.left = Math.max(0, this.left - dt);
    const second = Math.ceil(this.left);
    if (second !== this.shownSecond) {
      this.shownSecond = second;
      this.draw();
    }
    for (let i = 0; i < this.options.length; i++) if (this.buttons[i].update(hands, dt)) return i;
    return null;
  }

  private open(title: string, options: Option[]): void {
    this.title = title;
    this.options = options.slice(0, MAX_OPTIONS);
    const n = Math.max(1, this.options.length);
    const width = P.columnWidth * Math.max(3, n);
    this.panel.resize(width, P.height);
    const y = bottomRowY(P.height, P.buttonRadius * POKE.rimScale, UI_SPACING.edge + 3);
    this.buttons.forEach((b, i) => {
      b.group.visible = i < this.options.length;
      b.group.position.set(this.columnX(i, width), y, 0);
    });
    this.left = ENDLESS.pickTime;
    this.shownSecond = Math.ceil(this.left);
    this.draw();
    this.panel.visible = true;
    this.panel.popIn(0.25);
    // A finger still there from the last poke never picks at once.
    armControls(this.buttons);
  }

  /** The middle of column i (cm from the panel's middle). */
  private columnX(i: number, width: number): number {
    const n = this.options.length;
    const column = width / Math.max(3, n);
    return (i - (n - 1) / 2) * column;
  }

  private draw(): void {
    this.panel.paint((c, w) => {
      const width = this.panel.width;
      const height = this.panel.height;
      const at = panelMap(width, height, w, this.panel.layoutHeight);
      drawTitleBanner(c, this.title, w * 0.18, UI_SPACING.top * at.px, w * 0.64, 60, 34);
      const top = (cm: number): number => at.y(height / 2 - cm);
      const column = (width / Math.max(3, this.options.length)) * at.px;
      this.options.forEach((o, i) => {
        const x = at.x(this.columnX(i, width));
        drawIconCentered(c, o.icon, x, top(8.5), 46, o.rare ? P.rareColor : UI_COLORS.accent);
        drawLine(c, o.name, x, top(12.2), column * 0.9, 22, o.rare ? P.rareColor : UI_COLORS.ink);
        c.font = 'bold 16px sans-serif';
        wrapText(c, o.text, column * 0.86)
          .slice(0, 3)
          .forEach((line, k) => drawLine(c, line, x, top(14.6) + k * 20, column * 0.9, 16, UI_COLORS.note));
        if (o.rare) drawLine(c, 'Rare', x, top(5.6), column * 0.6, 15, P.rareColor);
      });
      drawLine(c, `Next wave in ${this.shownSecond}`, w / 2, at.y(-height / 2 + 1.6), w * 0.6, 17, UI_COLORS.note);
    });
  }
}
