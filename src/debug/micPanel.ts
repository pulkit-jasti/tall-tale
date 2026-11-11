// A small live loudness panel (debug), like the FPS panel and on the other
// side of front: the mic level right now, the loudest in the last few
// seconds, the loudest since the panel was opened, and the horn's blow line
// (HORN.blowLevel), so the line can be set from real numbers instead of
// guesses. The level is the horn's own measure: the mic's raw RMS of each
// frame (one frame over the line is a blow). Hidden by default: the debug page's "Mic
// panel on/off" button, or ?mic in the URL. Redrawn only a few times a
// second, and only when a number changed.
import type { CanvasTexture, Mesh, Object3D } from 'three';
import { mic } from '../audio/mic.js';
import { HANDLES, HORN, MIC_PANEL } from '../config/game.js';
import { degToRad, polarX, polarZ } from '../rules/boardMath.js';
import { canvasPlane, canvasTexture } from '../ui/kit/index.js';
import { mark } from './perfMarks.js';

const GOOD = '#7ddf64';
const TEXT = '#ddd6c8';
const DIM = '#9a8f7e';

export class MicPanel {
  private canvas = document.createElement('canvas');
  private context: CanvasRenderingContext2D;
  private texture: CanvasTexture;
  private mesh: Mesh;
  /** The smoothed level now, and the loudest levels (recent, and since opened). */
  private level = 0;
  private recent: { at: number; level: number }[] = [];
  private highest = 0;
  private time = 0;
  private drawTimer = 0;
  private lastDrawn = '';

  constructor(parent: Object3D) {
    this.canvas.width = 384;
    this.canvas.height = 192;
    this.context = this.canvas.getContext('2d')!;
    this.texture = canvasTexture(this.canvas);
    this.mesh = canvasPlane(this.texture, MIC_PANEL.width, MIC_PANEL.height);
    const a = degToRad(MIC_PANEL.angleDeg);
    const y = HANDLES.ringY + HANDLES.ringRadius + MIC_PANEL.aboveRing + MIC_PANEL.height / 2;
    this.mesh.position.set(polarX(MIC_PANEL.radius, a), y, polarZ(MIC_PANEL.radius, a));
    // The plane faces +z: turned toward the player in the middle.
    this.mesh.rotation.y = -a;
    this.mesh.visible = new URLSearchParams(location.search).has('mic');
    parent.add(this.mesh);
  }

  /** On or off. Turned on, the loudest-since number starts over. */
  toggle(): void {
    this.mesh.visible = !this.mesh.visible;
    this.highest = 0;
    this.recent.length = 0;
    this.lastDrawn = '';
  }

  update(dt: number): void {
    if (!this.mesh.visible) return;
    this.time += dt;
    if (mic.on) {
      mic.ensureLive();
      this.level = mic.read();
    } else this.level = 0;
    this.highest = Math.max(this.highest, this.level);
    this.recent.push({ at: this.time, level: this.level });
    while (this.recent.length > 0 && this.recent[0].at < this.time - MIC_PANEL.recentSeconds) this.recent.shift();
    this.drawTimer -= dt;
    if (this.drawTimer > 0) return;
    this.drawTimer = MIC_PANEL.drawEvery;
    this.draw();
  }

  private draw(): void {
    let recent = 0;
    for (const r of this.recent) recent = Math.max(recent, r.level);
    const f = (v: number): string => v.toFixed(3);
    const key = [mic.state, f(this.level), f(recent), f(this.highest), f(HORN.blowLevel)].join('|');
    if (key === this.lastDrawn) return;
    this.lastDrawn = key;
    mark('panel redraw');
    const c = this.context;
    const { width, height } = this.canvas;
    c.clearRect(0, 0, width, height);
    c.fillStyle = 'rgba(20, 16, 12, 0.75)';
    c.beginPath();
    c.roundRect(0, 0, width, height, 18);
    c.fill();
    c.textBaseline = 'middle';
    // Now, big: green once it passes the blow line.
    c.fillStyle = this.level >= HORN.blowLevel ? GOOD : TEXT;
    c.font = 'bold 50px sans-serif';
    c.fillText(f(this.level), 16, 40);
    c.fillStyle = DIM;
    c.font = '20px sans-serif';
    c.fillText(mic.on ? 'mic now' : `mic ${mic.state}`, 210, 40);
    c.fillStyle = TEXT;
    c.font = '26px sans-serif';
    c.fillText(`last ${MIC_PANEL.recentSeconds} s  ${f(recent)}`, 16, 96);
    c.fillText(`loudest  ${f(this.highest)}`, 16, 132);
    c.fillStyle = '#f2c14e';
    c.fillText(`blow line  ${f(HORN.blowLevel)}`, 16, 168);
    this.texture.needsUpdate = true;
  }
}
