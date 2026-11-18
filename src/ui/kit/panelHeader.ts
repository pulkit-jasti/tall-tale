// A panel's header (headset test 2026-11-11): the title on a floating 3D
// plate above the panel's top edge, centered, and Back beside it on the
// left. The rule for every menu panel: navigation (the title, Back, the
// tabs) floats outside the panel; the panel holds only content and controls.
// The plate is sized to its title; its face is drawn once (setTitle redraws
// it). Its face points along +z (cm). The page places the group with
// placeAbove (the plate's middle over the panel's middle).
import { ExtrudeGeometry, Group, Mesh, MeshBasicMaterial, PlaneGeometry, Shape, type CanvasTexture } from 'three';
import type { GameAudio } from '../../audio/sound.js';
import { BUTTON_SIZE, HEADER, POKE } from '../../config/game.js';
import type { HandState } from '../../player/hands.js';
import { flatMaterial } from '../../world/shapes.js';
import { PokeButton } from '../pokeButton.js';
import { canvasTexture } from './canvas.js';
import { afterDrag, armControls, type Control } from './controls.js';
import { fontSpec } from './font.js';
import { preparedTextures } from '../panel.js';

const PX = 40;

function rounded(w: number, h: number, r: number): Shape {
  const s = new Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2);
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r);
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r);
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  return s;
}

export class PanelHeader implements Control {
  readonly group = new Group();
  /** Back, or null for a page with nowhere to go back to (the main menu). */
  readonly back: PokeButton | null;
  private plate = new Group();
  private canvas = document.createElement('canvas');
  private texture: CanvasTexture;
  private face: Mesh;
  private title = '';
  private width = 0;

  constructor(audio: GameAudio, title: string, options: { back: boolean }) {
    this.texture = canvasTexture(this.canvas, 4);
    this.face = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: this.texture, transparent: true, fog: false, toneMapped: false }));
    this.face.position.z = HEADER.depth + 0.02;
    this.plate.add(this.face);
    this.group.add(this.plate);
    this.back = options.back ? new PokeButton(audio, { radius: BUTTON_SIZE.medium, icon: 'back' }) : null;
    if (this.back) this.group.add(this.back.group);
    this.setTitle(title);
  }

  /** Puts the header over a panel `panelHeight` tall (its group is added to the panel's root by the page). */
  placeAbove(panelHeight: number): void {
    this.group.position.set(0, panelHeight / 2 + HEADER.above + HEADER.height / 2, 0);
  }

  /** A new title: the plate is sized to it and its face drawn again (never while something is dragged). */
  setTitle(title: string): void {
    if (title === this.title) return;
    this.title = title;
    const H = HEADER;
    // A title shown before: its plate and face come back as they were (audit 2026-11-17: each switch built
    // new rounded plates and a new texture, "New level" and "Edit level" on every Custom Game open).
    const kept = this.made.get(title);
    if (kept) {
      for (const old of this.plate.children.filter((o) => o !== this.face)) this.plate.remove(old);
      this.plate.remove(this.face);
      this.plate.add(kept.edge, kept.body, this.face);
      this.width = kept.width;
      this.texture = kept.texture;
      (this.face.material as MeshBasicMaterial).map = this.texture;
      this.face.scale.set(this.width, H.height, 1);
      if (this.back) this.back.group.position.x = -this.width / 2 - H.backGap - BUTTON_SIZE.medium * POKE.rimScale;
      return;
    }
    const c = this.canvas.getContext('2d')!;
    c.font = fontSpec(Math.round(H.textSize * PX), true);
    const textW = c.measureText(title).width / PX;
    this.width = Math.max(H.minWidth, textW + H.pad * 2);
    // The plate: a dark edge slab and the colored plate on it, both rounded. The old ones are kept (made).
    for (const old of this.plate.children.filter((o) => o !== this.face)) this.plate.remove(old);
    const edge = new Mesh(new ExtrudeGeometry(rounded(this.width + 0.5, H.height + 0.5, 0.9), { depth: H.depth * 0.6, bevelEnabled: false }), flatMaterial(POKE.rimColor));
    // Unlit, so its color shows as it is set (lit, the scene's light made it a dull dark red, headset test 2026-11-11).
    const body = new Mesh(
      new ExtrudeGeometry(rounded(this.width, H.height, 0.7), { depth: H.depth, bevelEnabled: false }),
      new MeshBasicMaterial({ color: H.color, fog: false, toneMapped: false }),
    );
    // The face last: pages drawn on top in tree order (the settings page, layerPage) draw the plate first, then the title.
    this.plate.remove(this.face);
    this.plate.add(edge, body, this.face);
    this.face.scale.set(this.width, H.height, 1);
    if (this.back) this.back.group.position.x = -this.width / 2 - H.backGap - BUTTON_SIZE.medium * POKE.rimScale;
    const width = this.width;
    afterDrag(this, () => {
      // Its own canvas and texture, kept with its plate for the next time this title shows.
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width * PX);
      canvas.height = Math.round(H.height * PX);
      const ctx = canvas.getContext('2d')!;
      ctx.font = fontSpec(Math.round(H.textSize * PX), true);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = H.ink;
      ctx.fillText(title, canvas.width / 2, canvas.height / 2 + 2);
      this.canvas = canvas;
      this.texture = canvasTexture(canvas, 4);
      // Sent to the GPU at the warm-up even while another title shows.
      preparedTextures.add(this.texture);
      this.made.set(title, { edge, body, texture: this.texture, width });
      if (this.title === title) (this.face.material as MeshBasicMaterial).map = this.texture;
    });
  }

  /** Each title's plate, face texture and width, made once. */
  private made = new Map<string, { edge: Mesh; body: Mesh; texture: CanvasTexture; width: number }>();

  /** True on the frame Back is poked. */
  update(hands: HandState[], dt: number): boolean {
    return this.back?.update(hands, dt) ?? false;
  }

  reset(): void {
    if (this.back) armControls([this.back], 0);
  }

  lock(seconds: number): void {
    this.back?.lock(seconds);
  }
}
