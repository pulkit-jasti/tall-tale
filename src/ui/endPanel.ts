// The end of battle panel (docs/castle-rules.md section 4): a plain panel in
// front of the player that says "Congratulations, the kingdom is safe!" or
// "The castle has fallen", with one round button poked with the index finger
// to play again. Text is a small canvas texture, drawn once per show, like the
// FPS panel. It lives in fixedRig (cm), so it never spins with the board.
import {
  CanvasTexture,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  Vector3,
  type MeshStandardMaterial,
  type Object3D,
} from 'three';
import type { GameAudio } from '../audio/sound.js';
import { END_PANEL } from '../config/game.js';
import { applyTouchState, type TouchState } from '../player/feedback.js';
import type { HandState } from '../player/hands.js';
import { degToRad } from '../rules/boardMath.js';
import { flatMaterial } from '../world/shapes.js';

export type EndKind = 'won' | 'lost';

const TEXT: Record<EndKind, { title: string; subtitle: string; button: string }> = {
  won: { title: 'Congratulations,', subtitle: 'the kingdom is safe!', button: 'Play again' },
  lost: { title: 'The castle', subtitle: 'has fallen', button: 'Try again' },
};

const local = new Vector3();

export class EndPanel {
  private root = new Group();
  private button = new Group();
  private buttonMaterial: MeshStandardMaterial;
  private canvas = document.createElement('canvas');
  private texture: CanvasTexture;
  private touch: TouchState = 'idle';
  /** The finger was in front of the button, so pushing in counts as a press. */
  private armed = false;
  private pressed = false;
  private press = 0;

  constructor(
    parent: Object3D,
    private audio: GameAudio,
  ) {
    const { width, height, buttonRadius, buttonDepth } = END_PANEL;
    this.canvas.width = 512;
    this.canvas.height = Math.round((512 * height) / width);
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    const board = new Mesh(
      new PlaneGeometry(width, height),
      new MeshBasicMaterial({ map: this.texture, transparent: true, fog: false, toneMapped: false }),
    );
    this.root.add(board);
    this.buttonMaterial = flatMaterial(END_PANEL.buttonColor);
    // Round button: a short cylinder whose axis points at the player (+z).
    const cap = new Mesh(new CylinderGeometry(buttonRadius, buttonRadius, buttonDepth, 16), this.buttonMaterial);
    cap.rotation.x = Math.PI / 2;
    cap.position.z = buttonDepth / 2;
    this.button.add(cap);
    this.button.position.set(0, -height * 0.3, 0);
    this.root.add(this.button);
    // Straight in front of the player, tilted back toward the eyes.
    this.root.position.set(0, END_PANEL.y, -END_PANEL.radius);
    this.root.rotation.x = -degToRad(END_PANEL.tiltDeg);
    this.root.visible = false;
    parent.add(this.root);
  }

  get visible(): boolean {
    return this.root.visible;
  }

  show(kind: EndKind): void {
    this.draw(TEXT[kind]);
    this.root.visible = true;
    this.armed = false;
    this.pressed = false;
    this.press = 0;
    this.setTouch('idle');
  }

  hide(): void {
    this.root.visible = false;
  }

  /** Checks both index fingertips. Returns true on the frame the button is poked. */
  update(hands: HandState[], dt: number): boolean {
    if (!this.root.visible) return false;
    const { buttonRadius, buttonDepth, readyDistance, pressDepth, travel } = END_PANEL;
    let near = false;
    let inside = false;
    this.button.updateWorldMatrix(true, false);
    for (const hand of hands) {
      if (!hand.tracked) continue;
      this.button.worldToLocal(local.copy(hand.indexTip));
      // Generous zone around the round face.
      if (Math.hypot(local.x, local.y) > buttonRadius * 1.3) continue;
      if (local.z > buttonDepth && local.z < buttonDepth + readyDistance) near = true;
      if (local.z <= buttonDepth - pressDepth && local.z > -buttonDepth * 2) inside = true;
    }
    let fired = false;
    if (near && !inside) this.armed = true;
    if (inside && this.armed && !this.pressed) {
      this.pressed = true;
      fired = true;
      this.audio.play('buttonClick');
    }
    if (!near && !inside) {
      this.armed = false;
      this.pressed = false;
    }
    // The button presses in while pushed.
    const k = 1 - Math.exp(-dt * 30);
    this.press += ((this.pressed ? travel : 0) - this.press) * k;
    this.button.position.z = -this.press;
    this.setTouch(this.pressed ? 'held' : near ? 'ready' : 'idle');
    return fired;
  }

  private setTouch(state: TouchState): void {
    if (state === this.touch) return;
    if (state === 'ready' && this.touch === 'idle') this.audio.play('readyTick', undefined, 1, 0.1);
    this.touch = state;
    applyTouchState([this.buttonMaterial], state);
  }

  private draw(text: { title: string; subtitle: string; button: string }): void {
    const c = this.canvas.getContext('2d')!;
    const w = this.canvas.width;
    const h = this.canvas.height;
    c.clearRect(0, 0, w, h);
    c.fillStyle = 'rgba(40, 30, 22, 0.88)';
    c.beginPath();
    c.roundRect(4, 4, w - 8, h - 8, 36);
    c.fill();
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#f2e6c8';
    c.font = 'bold 52px sans-serif';
    c.fillText(text.title, w / 2, h * 0.17);
    c.fillText(text.subtitle, w / 2, h * 0.36);
    c.fillStyle = '#f2c14e';
    c.font = 'bold 36px sans-serif';
    c.fillText(text.button, w / 2, h * 0.5);
    this.texture.needsUpdate = true;
  }
}
