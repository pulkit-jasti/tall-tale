// Small setting controls built from round PokeButtons (docs/custom-mode.md
// "UI kit parts"): the number stepper (minus, the value, plus; for small
// counts), the choice picker (a row of round buttons, one picked, a word
// under each) and the seed control (the seed and a dice to reroll). Each
// redraws its words only when its value changes. Faces point along +z (cm).
import { Group } from 'three';
import type { GameAudio } from '../../audio/sound.js';
import { BUTTON_SIZE, PICKERS, POKE } from '../../config/game.js';
import type { HandState } from '../../player/hands.js';
import { PokeButton } from '../pokeButton.js';
import { armControls, type Control } from './controls.js';
import { CanvasLabel } from './label.js';
import { drawLine, UI_COLORS } from './text.js';

/** Setting rows use the compact size (15% under the smallest menu button), so more rows fit (headset test 2026-11-11). */
const SIZE = BUTTON_SIZE.compact;
const RIM = SIZE * POKE.rimScale;

/** A whole number between min and max, with round minus and plus buttons; at a limit its button greys and only buzzes. */
export class NumberStepper implements Control {
  readonly group = new Group();
  onChange: (value: number) => void = () => {};
  private minus: PokeButton;
  private plus: PokeButton;
  private label: CanvasLabel;

  constructor(
    audio: GameAudio,
    private min: number,
    private max: number,
    private current: number,
    /** Width from the minus button's rim to the plus button's (cm). */
    readonly width: number = PICKERS.stepperWidth,
  ) {
    this.minus = new PokeButton(audio, { radius: SIZE, icon: 'minus' });
    this.plus = new PokeButton(audio, { radius: SIZE, icon: 'plus' });
    this.minus.group.position.x = -width / 2 + RIM;
    this.plus.group.position.x = width / 2 - RIM;
    this.label = new CanvasLabel(width - RIM * 4, RIM * 2);
    this.group.add(this.minus.group, this.plus.group, this.label.mesh);
    this.show();
  }

  get value(): number {
    return this.current;
  }

  setValue(value: number): void {
    this.current = Math.min(this.max, Math.max(this.min, Math.round(value)));
    this.show();
  }

  update(hands: HandState[], dt: number): void {
    if (this.minus.update(hands, dt)) this.step(-1);
    if (this.plus.update(hands, dt)) this.step(1);
  }

  reset(): void {
    armControls([this.minus, this.plus], 0);
  }

  lock(seconds: number): void {
    this.minus.lock(seconds);
    this.plus.lock(seconds);
  }

  private step(by: number): void {
    const next = Math.min(this.max, Math.max(this.min, this.current + by));
    if (next === this.current) return;
    this.current = next;
    this.show();
    this.onChange(this.current);
  }

  private show(): void {
    const atMin = this.current <= this.min;
    const atMax = this.current >= this.max;
    this.minus.locked = atMin;
    this.plus.locked = atMax;
    this.minus.setColor(atMin ? PICKERS.offColor : POKE.color);
    this.plus.setColor(atMax ? PICKERS.offColor : POKE.color);
    this.label.draw((c, w, h) => drawLine(c, `${this.current}`, w / 2, h / 2, w, (PICKERS.numberSize / RIM / 2) * h, UI_COLORS.ink));
  }
}

/** A row of round buttons, one picked (a tick, green), the others grey with a dot, each with its word under it. */
export class ChoicePicker implements Control {
  readonly group = new Group();
  onChange: (index: number) => void = () => {};
  private buttons: PokeButton[] = [];
  private words: CanvasLabel;
  private picked: number;

  constructor(
    audio: GameAudio,
    private labels: string[],
    picked: number,
  ) {
    const P = PICKERS;
    this.picked = picked;
    labels.forEach((_, i) => {
      const b = new PokeButton(audio, { radius: SIZE, icon: 'dot' });
      b.group.position.set((i - (labels.length - 1) / 2) * P.choiceGap, P.choiceWordHeight / 2, 0);
      this.buttons.push(b);
      this.group.add(b.group);
    });
    this.words = new CanvasLabel(this.width, P.choiceWordHeight);
    this.words.mesh.position.y = P.choiceWordHeight / 2 - RIM - 0.4 - P.choiceWordHeight / 2;
    this.group.add(this.words.mesh);
    this.show();
  }

  /** From the first rim to the last (cm). */
  get width(): number {
    return (this.labels.length - 1) * PICKERS.choiceGap + RIM * 2 + 2;
  }

  /** Buttons and words together, top to bottom (cm). */
  get height(): number {
    return RIM * 2 + 0.4 + PICKERS.choiceWordHeight;
  }

  get index(): number {
    return this.picked;
  }

  select(index: number): void {
    if (index === this.picked) return;
    this.picked = index;
    this.show();
  }

  update(hands: HandState[], dt: number): void {
    for (const [i, b] of this.buttons.entries()) {
      if (!b.update(hands, dt) || i === this.picked) continue;
      this.select(i);
      this.onChange(i);
    }
  }

  reset(): void {
    armControls(this.buttons, 0);
  }

  lock(seconds: number): void {
    for (const b of this.buttons) b.lock(seconds);
  }

  private show(): void {
    for (const [i, b] of this.buttons.entries()) {
      const on = i === this.picked;
      b.setIcon(on ? 'tick' : 'dot');
      b.setColor(on ? POKE.color : PICKERS.offColor);
    }
    this.words.draw((c, w, h) => {
      const px = w / this.width;
      this.labels.forEach((label, i) => {
        const x = w / 2 + (i - (this.labels.length - 1) / 2) * PICKERS.choiceGap * px;
        const on = i === this.picked;
        drawLine(c, label, x, h / 2, PICKERS.choiceGap * px - 6, h * 0.62, on ? UI_COLORS.accent : UI_COLORS.note);
      });
    });
  }
}

/** The seed as a number, and a dice button that rolls a new one (there is nothing to type: the dice picks). */
export class SeedControl implements Control {
  readonly group = new Group();
  onChange: (seed: number) => void = () => {};
  private dice: PokeButton;
  private label: CanvasLabel;

  constructor(
    audio: GameAudio,
    private seed: number,
    /** Rolls a new seed (the page's seeded random, never Math.random in game code). */
    private roll: () => number,
    readonly width: number = PICKERS.stepperWidth,
  ) {
    this.dice = new PokeButton(audio, { radius: SIZE, icon: 'dice' });
    this.dice.group.position.x = width / 2 - RIM;
    this.label = new CanvasLabel(width - RIM * 2 - 1, RIM * 2);
    this.label.mesh.position.x = -RIM - 0.5;
    this.group.add(this.dice.group, this.label.mesh);
    this.show();
  }

  get value(): number {
    return this.seed;
  }

  setValue(seed: number): void {
    this.seed = seed;
    this.show();
  }

  update(hands: HandState[], dt: number): void {
    if (!this.dice.update(hands, dt)) return;
    this.seed = this.roll();
    this.show();
    this.onChange(this.seed);
  }

  reset(): void {
    this.dice.reset();
  }

  lock(seconds: number): void {
    this.dice.lock(seconds);
  }

  private show(): void {
    this.label.draw((c, w, h) => drawLine(c, `#${this.seed}`, w / 2, h / 2, w, (PICKERS.numberSize / RIM / 2) * h, UI_COLORS.ink));
  }
}
