// A text field typed with the Quest's own system keyboard (docs/custom-mode.md
// "Naming", Meta's guide "System Keyboard in WebXR", Quest browser 26.1 or
// later). The field is a light bordered box poked like a button (the same
// looks and sounds); a poke focuses one hidden HTML input, which brings up
// the system keyboard, and what is typed shows on the field as it comes.
// Done, the keyboard's hide button or a poke outside it closes the keyboard:
// the input blurs and the field calls onDone. A message line under the field
// shows validation (the page decides what it says).
//
// Quest limits: each opening starts fresh (the first key press replaces the
// whole text), and the keyboard makes the XR session "visible-blurred", so
// the game's auto-pause asks isTyping() first. The keyboard may want a user
// gesture: when it has not come up a moment after the poke, the message asks
// for a pinch, and the next pinch (an XR select, which counts as a gesture)
// focuses the input again. Without a system keyboard (desktop), a real
// keyboard types into the same input. Its face points along +z (cm).
import { Group, type CanvasTexture } from 'three';
import type { GameAudio } from '../../audio/sound.js';
import { TEXT_FIELD } from '../../config/game.js';
import { mark } from '../../debug/perfMarks.js';
import type { HandState } from '../../player/hands.js';
import { PokeButton } from '../pokeButton.js';
import { canvasTexture } from './canvas.js';
import type { Control } from './controls.js';
import { CanvasLabel } from './label.js';
import { UI_COLORS } from './text.js';

export interface TextFieldOptions {
  width: number;
  height: number;
  maxLength: number;
  /** Shown in grey while the field is empty. */
  placeholder: string;
}

/** The one hidden input every field shares (only one types at a time), made on first use. */
let input: HTMLInputElement | null = null;
/** The field typing now, if any. */
let active: TextField | null = null;
/** The XR session, for the keyboard's support flag, its visibility and the pinch retry. */
let xrSession: XRSession | null = null;

/** True while a field has the keyboard (the auto-pause leaves the blurred session alone then). */
export function isTyping(): boolean {
  return active !== null;
}

/** The game hands over each new XR session (and null when it ends: the hidden input is let go). */
export function useKeyboardSession(session: XRSession | null): void {
  xrSession = session;
  if (!session) {
    active?.blur();
    input?.remove();
    input = null;
  }
}

function hiddenInput(): HTMLInputElement {
  if (input) return input;
  const el = document.createElement('input');
  el.type = 'text';
  el.autocomplete = 'off';
  el.spellcheck = false;
  el.setAttribute('autocapitalize', 'words');
  // In the page (the keyboard needs it in the DOM) but unseen, at the top left so the page never scrolls to it.
  // 16 px text, so a phone-like browser never zooms in on focus.
  Object.assign(el.style, { position: 'fixed', left: '0', top: '0', width: '1px', height: '1px', opacity: '0', fontSize: '16px', pointerEvents: 'none', border: '0', padding: '0' });
  el.addEventListener('input', () => active?.typed(el.value));
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') el.blur();
  });
  el.addEventListener('blur', () => active?.closed());
  document.body.appendChild(el);
  input = el;
  return el;
}

export class TextField implements Control {
  readonly group = new Group();
  /** Every change while typing (the page validates and shows the message). */
  onInput: (value: string) => void = () => {};
  /** The keyboard closed. */
  onDone: (value: string) => void = () => {};
  private button: PokeButton;
  private canvas = document.createElement('canvas');
  private texture: CanvasTexture;
  private message: CanvasLabel;
  private text = '';
  private note: { text: string; warn: boolean } | null = null;
  /** Seconds since the poke, while waiting to see the keyboard come up (null once it did, or not waiting). */
  private waiting: number | null = null;
  private pinchRetry: (() => void) | null = null;

  constructor(
    audio: GameAudio,
    private options: TextFieldOptions,
  ) {
    const F = TEXT_FIELD;
    this.canvas.width = Math.round(options.width * 40);
    this.canvas.height = Math.round(options.height * 40);
    this.texture = canvasTexture(this.canvas, 4);
    // Thin (TEXT_FIELD.depth), so it hardly stands out of the panel and never hides the line above it.
    this.button = new PokeButton(audio, { radius: options.height / 2, depth: F.depth, icon: 'edit', box: { width: options.width, height: options.height, face: this.texture, plain: true } });
    this.button.setColor(F.color);
    this.group.add(this.button.group);
    this.message = new CanvasLabel(options.width, F.messageHeight);
    this.message.mesh.position.y = -options.height / 2 - F.messageGap - F.messageHeight / 2;
    this.group.add(this.message.mesh);
    this.paint();
    this.paintMessage();
  }

  get value(): string {
    return this.text;
  }

  get typing(): boolean {
    return active === this;
  }

  /** Sets the text without telling onInput (a page opening). */
  setValue(value: string): void {
    this.text = value.slice(0, this.options.maxLength);
    this.paint();
  }

  /** The line under the field: a warning in red, a note in brown, or nothing. */
  setMessage(text: string | null, warn = true): void {
    const next = text ? { text, warn } : null;
    if (next?.text === this.note?.text && next?.warn === this.note?.warn) return;
    this.note = next;
    this.paintMessage();
  }

  update(hands: HandState[], dt: number): void {
    if (this.button.update(hands, dt)) this.focus();
    if (this.waiting === null) return;
    this.waiting += dt;
    // The keyboard shows as a blurred session; on the desktop there is none, the real keyboard just types.
    if (xrSession?.visibilityState === 'visible-blurred' || !xrSession) {
      this.waiting = null;
      return;
    }
    if (this.waiting > TEXT_FIELD.keyboardWait) {
      this.waiting = null;
      this.askForPinch();
    }
  }

  /** Closes the keyboard (the page is closing). */
  blur(): void {
    if (active === this) input?.blur();
    this.dropPinchRetry();
  }

  reset(): void {
    this.button.reset();
  }

  lock(seconds: number): void {
    this.button.lock(seconds);
  }

  /** From the hidden input: what is typed now. */
  typed(value: string): void {
    const next = value.slice(0, this.options.maxLength);
    if (input && input.value !== next) input.value = next;
    this.waiting = null;
    this.dropPinchRetry();
    if (next === this.text) return;
    this.text = next;
    this.paint();
    this.onInput(this.text);
  }

  /** From the hidden input: the keyboard closed. */
  closed(): void {
    if (active !== this) return;
    active = null;
    this.waiting = null;
    this.dropPinchRetry();
    this.button.setColor(TEXT_FIELD.color);
    this.paint();
    this.onDone(this.text);
  }

  private focus(): void {
    const el = hiddenInput();
    if (active && active !== this) active.blur();
    active = this;
    el.maxLength = this.options.maxLength;
    el.value = this.text;
    el.focus({ preventScroll: true });
    // Typing replaces the whole text, like the Quest keyboard does anyway (a desktop keyboard would add to it).
    el.select();
    this.button.setColor(TEXT_FIELD.typingColor);
    this.waiting = 0;
    this.paint();
  }

  /** The keyboard did not come up: the next pinch (a gesture the browser trusts) opens it. */
  private askForPinch(): void {
    if (!xrSession || active !== this) return;
    const supported = (xrSession as XRSession & { isSystemKeyboardSupported?: boolean }).isSystemKeyboardSupported;
    if (supported === false) {
      this.setMessage('No keyboard here. Try the Quest browser.', true);
      return;
    }
    this.setMessage('Pinch your fingers to open the keyboard.', false);
    this.dropPinchRetry();
    const session = xrSession;
    const retry = (): void => {
      if (active === this) input?.focus({ preventScroll: true });
      this.dropPinchRetry();
    };
    session.addEventListener('select', retry);
    this.pinchRetry = () => session.removeEventListener('select', retry);
  }

  private dropPinchRetry(): void {
    this.pinchRetry?.();
    this.pinchRetry = null;
  }

  private paint(): void {
    mark('panel redraw');
    const c = this.canvas.getContext('2d')!;
    const w = this.canvas.width;
    const h = this.canvas.height;
    c.clearRect(0, 0, w, h);
    // A white face (unlit, so it stays white in any light): dark text on it reads best. A thin outline while typing.
    // White to the very edge (the face covers the whole cap), corners rounded like the cap's.
    c.fillStyle = TEXT_FIELD.face;
    c.beginPath();
    c.roundRect(0, 0, w, h, Math.min(w, h) * 0.18);
    c.fill();
    if (this.typing) {
      c.strokeStyle = UI_COLORS.accent;
      c.lineWidth = Math.max(3, h * 0.05);
      c.stroke();
    }
    const pad = h * 0.3;
    const empty = this.text.length === 0;
    c.font = `${empty ? 'italic ' : 'bold '}${Math.round(h * 0.36)}px sans-serif`;
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillStyle = empty ? UI_COLORS.note : UI_COLORS.ink;
    const shown = empty ? this.options.placeholder : this.text;
    c.fillText(shown, pad, h / 2 + 1, w - pad * 3);
    if (this.typing) {
      // A caret after the text, so it is clear the keyboard types here.
      const x = pad + (empty ? 0 : Math.min(c.measureText(shown).width, w - pad * 3)) + 4;
      c.fillStyle = UI_COLORS.accent;
      c.fillRect(x, h * 0.24, Math.max(3, h * 0.05), h * 0.52);
    }
    // The count, small at the right end.
    c.font = `${Math.round(h * 0.24)}px sans-serif`;
    c.textAlign = 'right';
    c.fillStyle = UI_COLORS.note;
    c.fillText(`${this.text.length}/${this.options.maxLength}`, w - pad * 0.6, h / 2 + 1);
    this.texture.needsUpdate = true;
  }

  private paintMessage(): void {
    this.message.draw((c, w, h) => {
      if (!this.note) return;
      c.font = `bold ${Math.round(h * 0.56)}px sans-serif`;
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.fillStyle = this.note.warn ? UI_COLORS.warn : UI_COLORS.note;
      c.fillText(this.note.text, 4, h / 2, w - 8);
    });
  }
}
