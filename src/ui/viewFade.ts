// The view fade: a dark sphere around the head that covers everything while
// a map is built (headset test 2026-11-17: starting Endless froze the whole
// view for 1 to 2 s, then the castle rose). Building a map blocks the page
// for a moment; seen through a dark view that is calm, the usual VR way of
// loading. Its shader is compiled with the rest at setup (warmGpu), so the
// fade itself never hitches.
import { BackSide, Mesh, MeshBasicMaterial, SphereGeometry, type Object3D } from 'three';
import { VIEW_FADE } from '../config/game.js';

export class ViewFade {
  private readonly mesh: Mesh;
  private readonly material: MeshBasicMaterial;
  /** 0 clear, 1 fully dark. */
  private value = 0;
  private target = 0;
  /** Waiting for a dark frame (resolved one update after it is fully dark, so a dark frame was drawn). */
  private waiting: (() => void)[] = [];
  private darkFrames = 0;

  constructor(head: Object3D) {
    this.material = new MeshBasicMaterial({
      color: VIEW_FADE.color,
      transparent: true,
      opacity: 0,
      side: BackSide,
      depthTest: false,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    });
    this.mesh = new Mesh(new SphereGeometry(VIEW_FADE.radius, 16, 12), this.material);
    this.mesh.renderOrder = VIEW_FADE.renderOrder;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    head.add(this.mesh);
  }

  /** Fades to dark. Resolves once a fully dark frame has been drawn. */
  out(): Promise<void> {
    this.target = 1;
    if (this.value >= 1 && this.darkFrames > 0) return Promise.resolve();
    return new Promise((resolve) => {
      this.waiting.push(resolve);
      // A safety: if frames stop (the page hidden), loading still goes on.
      setTimeout(resolve, VIEW_FADE.outTime * 1000 + 700);
    });
  }

  /** Fades back in. */
  in(): void {
    this.target = 0;
  }

  get dark(): boolean {
    return this.target === 1;
  }

  update(dt: number): void {
    const speed = this.target > this.value ? 1 / VIEW_FADE.outTime : 1 / VIEW_FADE.inTime;
    // A long frame (the build itself) never counts as fade time: the fade in always plays out.
    const step = Math.min(dt, 1 / 30) * speed;
    this.value = this.target > this.value ? Math.min(this.target, this.value + step) : Math.max(this.target, this.value - step);
    this.material.opacity = this.value;
    this.mesh.visible = this.value > 0;
    if (this.value >= 1) {
      this.darkFrames++;
      if (this.darkFrames > 1 && this.waiting.length > 0) {
        const done = this.waiting;
        this.waiting = [];
        for (const resolve of done) resolve();
      }
    } else {
      this.darkFrames = 0;
    }
  }
}
