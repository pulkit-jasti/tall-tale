// The trophy toast (docs/v3-plan.md 2.6): when an achievement is earned in
// a battle, a small parchment card pops up a little above the look, follows
// it smoothly for a few seconds, then shrinks away. A secret shows "Secret
// found!" and what it does; a regular one its name and what it taught. A
// chime and confetti with it. One at a time: more wait in line.
//
// Drawn once per toast (never while it shows), on top of the scene.
import { Group, Mesh, MeshBasicMaterial, Vector3, type CanvasTexture, type Object3D } from 'three';
import type { GameAudio } from '../audio/sound.js';
import { ACHIEVEMENT_LIST, TROPHY_TOAST as T, type AchievementId } from '../config/achievements.js';
import { RENDER_ORDER } from '../config/game.js';
import { mark } from '../debug/perfMarks.js';
import type { Particles } from '../fx/particles.js';
import { canvasPlane, canvasTexture } from './kit/canvas.js';
import { preparedTextures } from './panel.js';
import { drawOnTop } from './kit/onTop.js';
import { drawLine, UI_COLORS } from './kit/text.js';
import { drawIconCentered, drawNineSlice } from './uiImages.js';

const WIDTH = 640;
const HEIGHT = Math.round((WIDTH * T.height) / T.width);
const flat = new Vector3();
const target = new Vector3();

export class TrophyToast {
  private holder = new Group();
  private plane: Mesh;
  private canvas: HTMLCanvasElement;
  private texture: CanvasTexture;
  private queue: AchievementId[] = [];
  private left = 0;
  private age = 0;
  private placed = false;

  constructor(
    parent: Object3D,
    private audio: GameAudio,
    private particles: Particles,
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = WIDTH;
    this.canvas.height = HEIGHT;
    this.texture = canvasTexture(this.canvas, 4);
    this.plane = canvasPlane(this.texture, T.width, T.height);
    drawOnTop(this.plane, RENDER_ORDER.glassSign + 1);
    this.holder.add(this.plane);
    this.holder.visible = false;
    parent.add(this.holder);
  }

  /** An achievement was earned: its toast shows now, or after the ones before it. */
  show(id: AchievementId): void {
    this.queue.push(id);
  }

  /** Every frame (head and forward in world space). */
  update(dt: number, head: Vector3, forward: Vector3): void {
    if (this.left <= 0) {
      const next = this.queue.shift();
      if (!next) {
        this.holder.visible = false;
        this.placed = false;
        return;
      }
      this.draw(next);
      this.left = T.seconds;
      this.age = 0;
      this.holder.visible = true;
      this.place(head, forward, 1);
      this.audio.play('lessonDone');
      this.particles.burst(this.holder.position, T.confetti, 18, 0.12);
    }
    this.left -= dt;
    this.age += dt;
    this.place(head, forward, 1 - Math.exp(-dt / T.smoothing));
    // Pops in, and shrinks away at the end.
    const pop = Math.min(1, this.age / T.popTime);
    const out = Math.min(1, this.left / T.popTime);
    const s = Math.max(0.001, Math.min(pop * (2 - pop), out));
    this.holder.scale.setScalar(s);
  }

  /** Clears any toast now (the battle ended or the menu opened). */
  clear(): void {
    this.queue.length = 0;
    this.left = 0;
    this.holder.visible = false;
    this.placed = false;
  }

  /** In front of the look, a little above it, facing the head; level (never tilted with the head). */
  private place(head: Vector3, forward: Vector3, k: number): void {
    flat.set(forward.x, 0, forward.z);
    if (flat.lengthSq() < 1e-4) flat.set(0, 0, -1);
    flat.normalize();
    target.copy(head).addScaledVector(flat, T.distance);
    target.y += T.above;
    if (!this.placed) {
      this.holder.position.copy(target);
      this.placed = true;
    } else this.holder.position.lerp(target, k);
    // Faces the head, level (its +z toward the eyes).
    this.holder.lookAt(flat.copy(head).setY(this.holder.position.y));
  }

  /** Every trophy's toast, drawn once at setup (prepare), each its own texture. */
  private ready = new Map<AchievementId, CanvasTexture>();

  /**
   * Draws every trophy's toast now (the game calls it at setup, once the images are in, before its
   * warm-up): earning one mid-battle then only swaps in a texture already on the GPU (audit 2026-11-17:
   * it drew and uploaded a 640 px canvas in that frame).
   */
  prepare(): void {
    for (const a of ACHIEVEMENT_LIST) {
      if (this.ready.has(a.id)) continue;
      const canvas = document.createElement('canvas');
      canvas.width = WIDTH;
      canvas.height = HEIGHT;
      this.paint(canvas, a.id);
      const texture = canvasTexture(canvas, 4);
      this.ready.set(a.id, texture);
      preparedTextures.add(texture);
    }
  }

  private draw(id: AchievementId): void {
    mark('trophy toast');
    const material = this.plane.material as MeshBasicMaterial;
    const texture = this.ready.get(id);
    if (texture) {
      material.map = texture;
      return;
    }
    material.map = this.texture;
    this.paint(this.canvas, id);
    this.texture.needsUpdate = true;
  }

  private paint(canvas: HTMLCanvasElement, id: AchievementId): void {
    const a = ACHIEVEMENT_LIST.find((x) => x.id === id);
    if (!a) return;
    const c = canvas.getContext('2d')!;
    const w = WIDTH;
    const h = HEIGHT;
    c.clearRect(0, 0, w, h);
    if (!drawNineSlice(c, 'panel', 0, 0, w, h, 12, 24)) {
      c.fillStyle = '#e8d7b0';
      c.fillRect(0, 0, w, h);
    }
    const color = `#${(a.secret ? T.secretColor : T.goalColor).toString(16).padStart(6, '0')}`;
    const icon = h * 0.62;
    drawIconCentered(c, 'trophy', h * 0.5, h / 2, icon, color);
    const x = h + (w - h) / 2 - w * 0.03;
    const tw = w - h - w * 0.08;
    drawLine(c, a.secret ? 'Secret found!' : 'Trophy earned!', x, h * 0.2, tw, h * 0.15, a.secret ? color : UI_COLORS.note);
    drawLine(c, a.name, x, h * 0.42, tw, h * 0.22, UI_COLORS.ink);
    drawLine(c, a.earned[0], x, h * 0.66, tw, h * 0.14, UI_COLORS.note);
    drawLine(c, a.earned[1], x, h * 0.83, tw, h * 0.14, UI_COLORS.note);
  }

  /** The toast's material (for the game's shader warm-up). */
  get material(): MeshBasicMaterial {
    return this.plane.material as MeshBasicMaterial;
  }
}
