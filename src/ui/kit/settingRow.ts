// A setting row (docs/custom-mode.md "UI kit parts"), used by every setting.
// The control comes from a small spec (a count, a slider, a range, a choice,
// on and off, or the seed), so a page builds its rows from data and a new
// setting needs no new UI code. Values are plain: a slider's and a range's
// are 0 to 1 (the page maps them to the setting's limits).
//
// Two layouts: narrow controls (count, slider, switch, seed) sit in one line,
// the name left, the control in the middle, the value right. Wide ones (a
// choice, a range) are stacked: the name and the value on a line, the
// control under them across the row. FieldRow is the same stacked layout for
// a text field (a name, a description).
//
// No flicker (headset tests 2026-11-11): the name is drawn once; only the
// small value label is redrawn, and never while a slider moves (every
// CanvasLabel and Panel waits for a drag to end, src/ui/kit/controls.ts
// afterDrag, like the sound sliders always did). The labels never lie under
// a control. Faces point along +z (cm).
import { Group } from 'three';
import type { GameAudio } from '../../audio/sound.js';
import { SETTING_ROW } from '../../config/game.js';
import type { HandState } from '../../player/hands.js';
import { Slider } from '../slider.js';
import { Switch } from '../switch.js';
import type { Control } from './controls.js';
import { CanvasLabel } from './label.js';
import { ChoicePicker, NumberStepper, SeedControl } from './pickers.js';
import { RangeSlider } from './rangeSlider.js';
import type { ScrollItem } from './scrollArea.js';
import { drawLine, UI_COLORS } from './text.js';
import { wrapText } from '../uiImages.js';
import { TextField } from './textField.js';

export type RowSpec =
  | { kind: 'count'; min: number; max: number; value: number }
  | { kind: 'range'; steps: number; value: number }
  | { kind: 'span'; steps: number; value: [number, number] }
  | { kind: 'choice'; labels: string[]; value: number }
  | { kind: 'toggle'; value: boolean }
  | { kind: 'seed'; value: number; roll: () => number };

export type RowValue = number | [number, number] | boolean;

type RowControl = Control & { group: Group; update(hands: HandState[], dt: number): void };

/** A row's name, and a short hint under it in a smaller lighter line, drawn once (left aligned, cm text sizes from SETTING_ROW). */
function nameLabel(text: string, hint: string, width: number, height: number): CanvasLabel {
  const R = SETTING_ROW;
  const label = new CanvasLabel(width, height);
  label.draw((c, w, h) => {
    const px = w / width;
    if (!hint) {
      drawLine(c, text, 2, h / 2, w - 4, R.nameSize * px, UI_COLORS.ink, 'left');
      return;
    }
    // The hint in a regular weight, wrapped to at most two lines (never shrunk to fit).
    c.font = `${Math.round(R.hintSize * px)}px sans-serif`;
    const lines = wrapText(c, hint, w - 4).slice(0, 2);
    const lineH = R.hintSize * 1.15 * px;
    // The name and the hint sit together in the middle of the label.
    const total = R.nameSize * px + R.hintGap * px + lines.length * lineH;
    const top = (h - total) / 2;
    drawLine(c, text, 2, top + (R.nameSize * px) / 2, w - 4, R.nameSize * px, UI_COLORS.ink, 'left');
    c.font = `${Math.round(R.hintSize * px)}px sans-serif`;
    c.fillStyle = UI_COLORS.note;
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    lines.forEach((l, i) => c.fillText(l, 2, top + (R.nameSize + R.hintGap) * px + (i + 0.5) * lineH));
  });
  return label;
}

export class SettingRow implements ScrollItem {
  readonly group = new Group();
  readonly height: number;
  readonly controls: Control[];
  /** The value changed (`final`: a slider was let go, or any other control changed). */
  onChange: (value: RowValue, final: boolean) => void = () => {};
  private control: RowControl;
  /** Only rows whose control does not show its value (sliders, the range) have a value on the right; a stepper, a choice, a switch and the seed show it themselves. */
  private value: CanvasLabel | null = null;
  private valueAlign: CanvasTextAlign = 'left';
  private valueText = '';

  constructor(audio: GameAudio, name: string, spec: RowSpec, width: number, hint = '') {
    const R = SETTING_ROW;
    const stacked = spec.kind === 'choice' || spec.kind === 'span';
    const showValue = spec.kind === 'range' || spec.kind === 'span';
    const nameW = stacked ? width * (1 - R.valueShare) - R.gap : width * R.nameShare - R.gap;
    const valueW = width * R.valueShare - R.gap;
    // Inline: the middle of the room between the name column and the value column. Stacked: the whole width.
    const room = stacked ? width - 2 : width * (1 - R.nameShare - R.valueShare) - R.gap * 2;
    const middle = stacked ? 0 : width * (R.nameShare - R.valueShare) * 0.5;
    switch (spec.kind) {
      case 'count': {
        const c = new NumberStepper(audio, spec.min, spec.max, spec.value, Math.min(room, R.stepperWidth));
        c.onChange = (v) => this.onChange(v, true);
        this.control = c;
        break;
      }
      case 'range': {
        const c = new Slider(audio, { length: room - 3.4, steps: spec.steps, value: spec.value });
        c.onChange = (v, final) => this.onChange(v, final);
        this.control = c;
        break;
      }
      case 'span': {
        const c = new RangeSlider(audio, Math.min(room - 3.4, R.spanLength), spec.steps, spec.value[0], spec.value[1]);
        c.onChange = (lo, hi, final) => this.onChange([lo, hi], final);
        this.control = c;
        break;
      }
      case 'choice': {
        const c = new ChoicePicker(audio, spec.labels, spec.value);
        c.onChange = (i) => this.onChange(i, true);
        this.control = c;
        break;
      }
      case 'toggle': {
        const c = new Switch(audio, { on: spec.value });
        c.onChange = (on) => this.onChange(on, true);
        this.control = c;
        break;
      }
      case 'seed': {
        const c = new SeedControl(audio, spec.value, spec.roll, Math.min(room, R.stepperWidth));
        c.onChange = (v) => this.onChange(v, true);
        this.control = c;
        break;
      }
    }
    const controlH = spec.kind === 'choice' ? (this.control as ChoicePicker).height : spec.kind === 'span' ? R.spanHeight : 0;
    const line = hint ? R.hintLineHeight : R.lineHeight;
    this.height = stacked ? line + controlH + R.padding : R.height;
    const title = nameLabel(name, hint, nameW, stacked ? line : R.height);
    const lineY = stacked ? this.height / 2 - line / 2 : 0;
    title.mesh.position.set(-width / 2 + nameW / 2, lineY, 0.05);
    this.group.add(title.mesh);
    if (showValue) {
      // Right beside its control, so it reads as that control's value: inline, just after the slider's end (left aligned);
      // stacked (the range), on the name line, ending over the range's right end.
      this.value = new CanvasLabel(valueW, stacked ? line : R.height);
      const controlRight = middle + (this.control as Slider | RangeSlider).width / 2;
      const x = stacked ? controlRight - valueW / 2 : controlRight + R.valueGap + valueW / 2;
      this.value.mesh.position.set(x, lineY, 0.05);
      this.valueAlign = stacked ? 'right' : 'left';
      this.group.add(this.value.mesh);
    }
    this.control.group.position.set(middle, stacked ? lineY - line / 2 - controlH / 2 - R.padding / 3 : 0, 0);
    this.controls = [this.control];
    this.group.add(this.control.group);
  }

  /** The value shown on the right ("60%", "330 to 430 cm"), sliders only. While a slider moves, the label waits until it is let go (CanvasLabel). */
  setValueText(text: string): void {
    const label = this.value;
    if (!label || text === this.valueText) return;
    this.valueText = text;
    const R = SETTING_ROW;
    const left = this.valueAlign === 'left';
    label.draw((c, w, h) => drawLine(c, this.valueText, left ? 2 : w - 2, h / 2, w - 4, (R.valueSize * w) / label.width, UI_COLORS.accent, this.valueAlign));
  }

  /** Sets the control without telling onChange (a page opening). */
  setValue(value: RowValue): void {
    const c = this.control;
    if (c instanceof NumberStepper || c instanceof SeedControl) c.setValue(value as number);
    else if (c instanceof Slider) c.setValue(value as number);
    else if (c instanceof RangeSlider) c.setValues(...(value as [number, number]));
    else if (c instanceof ChoicePicker) c.select(value as number);
    else if (c instanceof Switch) c.set(value as boolean);
  }

  update(hands: HandState[], dt: number): void {
    this.control.update(hands, dt);
  }
}

/** A text field as a row: its name on a line, the field under it across the row, its message under that. */
export class FieldRow implements ScrollItem {
  readonly group = new Group();
  readonly height: number;
  readonly field: TextField;

  constructor(audio: GameAudio, name: string, width: number, maxLength: number, placeholder: string, hint = '') {
    const R = SETTING_ROW;
    this.field = new TextField(audio, { width: width - 2, height: R.fieldHeight, maxLength, placeholder });
    const line = hint ? R.hintLineHeight : R.lineHeight;
    // Room for the field's own message line under it (TEXT_FIELD.messageGap + messageHeight).
    this.height = line + R.fieldGap + R.fieldHeight + R.fieldMessage;
    const top = this.height / 2;
    const title = nameLabel(name, hint, width - 2, line);
    title.mesh.position.set(0, top - line / 2, 0.05);
    // A clear gap under the name: the field stands out of the panel and would hide a line close above it.
    this.field.group.position.y = top - line - R.fieldGap - R.fieldHeight / 2;
    this.group.add(title.mesh, this.field.group);
  }

  get controls(): Control[] {
    return [this.field];
  }

  update(hands: HandState[], dt: number): void {
    this.field.update(hands, dt);
  }
}
