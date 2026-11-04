// Live frame rate panel, to check performance while playing in the headset.
// Shows the average FPS and the worst frame (ms) of the last half second, so
// short stutters show up too. A tiny canvas texture redrawn twice a second,
// so it costs almost nothing. It lives in boardLift: it rises with the board
// but never spins.
import { CanvasTexture, Mesh, MeshBasicMaterial, type Object3D, PlaneGeometry, SRGBColorSpace } from 'three';
import { FPS, HANDLES } from '../config/game.js';
import { degToRad, polarX, polarZ } from '../rules/boardMath.js';

const GOOD = '#7ddf64';
const OK = '#f2c14e';
const BAD = '#ff5a4e';

export class FpsCounter {
  private mesh: Mesh;
  private canvas = document.createElement('canvas');
  private context: CanvasRenderingContext2D;
  private texture: CanvasTexture;
  /** Shown next to the worst frame ("paused" while the Quest menu is open), to check the auto-pause. */
  status = '';
  private frames = 0;
  private elapsed = 0;
  private worst = 0;

  constructor(parent: Object3D) {
    this.canvas.width = 256;
    this.canvas.height = 96;
    this.context = this.canvas.getContext('2d')!;
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    const material = new MeshBasicMaterial({ map: this.texture, transparent: true, fog: false, toneMapped: false });
    this.mesh = new Mesh(new PlaneGeometry(FPS.width, FPS.height), material);
    const a = degToRad(FPS.angleDeg);
    const y = HANDLES.ringY + HANDLES.ringRadius + FPS.aboveRing + FPS.height / 2;
    this.mesh.position.set(polarX(FPS.radius, a), y, polarZ(FPS.radius, a));
    // The plane faces +z. Point it at the center (the player).
    this.mesh.rotation.y = -a;
    this.mesh.visible = (import.meta.env.DEV && FPS.showInDev) || new URLSearchParams(location.search).has('fps');
    parent.add(this.mesh);
    this.draw(null, 0);
  }

  toggle(): void {
    this.mesh.visible = !this.mesh.visible;
  }

  /** `delta`: the real frame time (seconds), not the clamped game step. */
  update(delta: number): void {
    this.frames++;
    this.elapsed += delta;
    this.worst = Math.max(this.worst, delta);
    if (this.elapsed < FPS.refresh) return;
    if (this.mesh.visible) this.draw(this.frames / this.elapsed, this.worst * 1000);
    this.frames = 0;
    this.elapsed = 0;
    this.worst = 0;
  }

  private draw(fps: number | null, worstMs: number): void {
    const c = this.context;
    const { width, height } = this.canvas;
    c.clearRect(0, 0, width, height);
    c.fillStyle = 'rgba(20, 16, 12, 0.75)';
    c.beginPath();
    c.roundRect(0, 0, width, height, 18);
    c.fill();
    c.fillStyle = fps === null ? OK : fps >= FPS.target * 0.95 ? GOOD : fps >= FPS.target * 0.8 ? OK : BAD;
    c.font = 'bold 54px sans-serif';
    c.textBaseline = 'middle';
    c.fillText(fps === null ? '-- fps' : `${Math.round(fps)} fps`, 16, height * 0.36);
    c.fillStyle = '#ddd6c8';
    c.font = '26px sans-serif';
    c.fillText(`worst ${worstMs.toFixed(0)} ms  ${this.status}`, 18, height * 0.78);
    this.texture.needsUpdate = true;
  }
}
