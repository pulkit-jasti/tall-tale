// The stun of the megaphone and the bell (docs/giant-tools.md): every goblin
// on the battlefield stops, dizzy, with stars over its head. A shock ring
// runs out across the board from the castle, so the player sees it reach
// everywhere. Keeping on screaming or ringing makes it last longer, up to a
// cap. Both tools share this one stun.
import { Mesh, MeshBasicMaterial, RingGeometry, Vector3 } from 'three';
import type { GameAudio } from '../audio/sound.js';
import { STUN } from '../config/game.js';
import type { Particles } from '../fx/particles.js';
import { boardHeight } from '../rules/boardMath.js';
import type { Goblins } from '../units/goblins.js';
import type { Stage } from '../world/stage.js';

const STAR_COLORS = [0xffd84a, 0xfff1b8, 0xffffff];

export class StunWave {
  private ring: Mesh;
  private material: MeshBasicMaterial;
  private time = 0;
  private startedAt = -Infinity;
  private endsAt = -Infinity;
  private ringAge = Infinity;

  constructor(
    private stage: Stage,
    private goblins: Goblins,
    private audio: GameAudio,
    private particles: Particles,
  ) {
    // Drawn over everything, so the hills never hide the flat ring as it sweeps out.
    this.material = new MeshBasicMaterial({ color: STUN.ringColor, transparent: true, opacity: 0, depthWrite: false, depthTest: false, fog: false });
    this.ring = new Mesh(new RingGeometry(0.92, 1, 48, 1), this.material);
    this.ring.renderOrder = 30;
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.visible = false;
    stage.boardSpin.add(this.ring);
  }

  get active(): boolean {
    return this.time < this.endsAt;
  }

  /** A scream or a ring: every goblin is stunned for at least `seconds`. Returns how many. `at` is where it came from (world). */
  stun(seconds: number, at: Vector3): number {
    if (!this.active) this.startedAt = this.time;
    this.endsAt = Math.min(this.startedAt + STUN.maxSeconds, Math.max(this.endsAt, this.time + seconds));
    this.ringAge = 0;
    this.ring.visible = true;
    this.particles.burst(at, STAR_COLORS, 10, 0.2);
    this.audio.play('stunned', undefined, 1, 0.3);
    return this.goblins.stunAll(this.endsAt - this.time);
  }

  /** Still screaming or ringing: the running stun lasts this much longer (up to the cap). Returns how many goblins. */
  extend(seconds: number): number {
    if (!this.active) return 0;
    this.endsAt = Math.min(this.startedAt + STUN.maxSeconds, this.endsAt + seconds);
    return this.goblins.stunAll(this.endsAt - this.time);
  }

  /** A new battle: no stun running. */
  reset(): void {
    this.endsAt = -Infinity;
    this.ringAge = Infinity;
    this.ring.visible = false;
  }

  update(dt: number): void {
    this.time += dt;
    if (this.ringAge >= STUN.ringTime) return;
    this.ringAge += dt;
    const t = Math.min(1, this.ringAge / STUN.ringTime);
    const r = Math.max(0.01, STUN.ringRadius * t);
    this.ring.scale.set(r, r, r);
    // Rides just above the ground, which rises toward the horizon.
    this.ring.position.y = boardHeight(r) + 0.6;
    this.material.opacity = 0.75 * (1 - t);
    if (t >= 1) this.ring.visible = false;
  }
}
