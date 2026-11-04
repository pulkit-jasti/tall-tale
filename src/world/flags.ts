// The two flags in front of the player (docs/castle-rules.md section 2): the
// red castle health flag slides down with damage, the blue wave flag climbs
// one notch per wave. Progress bars built into the world, no numbers.
// They live in boardLift (cm): they rise with the board but never spin.
import { BoxGeometry, Color, CylinderGeometry, DoubleSide, Group, Mesh, PlaneGeometry, SphereGeometry, type Object3D } from 'three';
import { FLAGS } from '../config/game.js';
import { degToRad, polarX, polarZ } from '../rules/boardMath.js';
import { flatMaterial } from './shapes.js';

/** Flag pole: a thin cylinder with a ball on top, standing on y = 0 (cm). */
function flagPole(): Group {
  const group = new Group();
  const pole = new Mesh(new CylinderGeometry(FLAGS.poleRadius, FLAGS.poleRadius * 1.3, FLAGS.poleHeight, 8), flatMaterial(FLAGS.poleColor));
  pole.position.y = FLAGS.poleHeight / 2;
  const ball = new Mesh(new SphereGeometry(FLAGS.poleRadius * 2.2, 8, 6), flatMaterial(FLAGS.ballColor));
  ball.position.y = FLAGS.poleHeight;
  group.add(pole, ball);
  return group;
}

class Flag {
  readonly root = new Group();
  /** Hangs from the pole at the cloth's top edge, and sways. */
  private pivot = new Group();
  private cloth: Mesh;
  private color: Color;
  private shown = 1;
  private target = 1;
  private time = 0;

  constructor(parent: Object3D, angleDeg: number, color: number, side: 1 | -1) {
    const a = degToRad(angleDeg);
    this.root.position.set(polarX(FLAGS.radius, a), 0, polarZ(FLAGS.radius, a));
    // Front (+z) toward the player.
    this.root.rotation.y = -a;
    this.root.add(flagPole());
    const material = flatMaterial(color);
    material.side = DoubleSide;
    this.color = new Color(color);
    // The cloth hangs outward, away from the middle of the view.
    const geometry = new PlaneGeometry(FLAGS.clothWidth, FLAGS.clothHeight).translate(
      (side * FLAGS.clothWidth) / 2,
      -FLAGS.clothHeight / 2,
      0,
    );
    this.cloth = new Mesh(geometry, material);
    this.pivot.add(this.cloth);
    this.root.add(this.pivot);
    parent.add(this.root);
    this.place();
  }

  /** Share from 0 (bottom) to 1 (top). `instant` skips the glide (a new battle). */
  set(share: number, instant = false): void {
    this.target = Math.min(1, Math.max(0, share));
    if (instant) this.shown = this.target;
  }

  /** Small rings on the pole, one per step (the wave flag's notches). */
  addNotches(count: number): void {
    const geometry = new BoxGeometry(FLAGS.poleRadius * 5, 0.35, FLAGS.poleRadius * 5);
    const material = flatMaterial(FLAGS.notchColor);
    for (let i = 0; i <= count; i++) {
      const notch = new Mesh(geometry, material);
      notch.position.y = clothTopAt(i / count);
      this.root.add(notch);
    }
  }

  update(dt: number, low: boolean): void {
    this.time += dt;
    const k = 1 - Math.exp(-FLAGS.slideSpeed * dt);
    this.shown += (this.target - this.shown) * k;
    this.place();
    // A low flag waves slower and droops (tears and smoke come with the juice step).
    const sway = degToRad(FLAGS.swayDeg) * (low ? 0.4 : 1);
    this.pivot.rotation.y = Math.sin(this.time * FLAGS.swaySpeed * (low ? 0.6 : 1)) * sway;
    this.pivot.rotation.x = low ? 0.35 : 0;
    const material = this.cloth.material as ReturnType<typeof flatMaterial>;
    material.color.copy(this.color).multiplyScalar(low ? 0.55 : 1);
  }

  private place(): void {
    this.pivot.position.y = clothTopAt(this.shown);
  }
}

/** Height of the cloth's top edge for a share from 0 (cloth at the bottom) to 1 (at the top). */
function clothTopAt(share: number): number {
  const lowest = FLAGS.clothBottom + FLAGS.clothHeight;
  return lowest + (FLAGS.clothTop - lowest) * share;
}

export class Flags {
  private health: Flag;
  private wave: Flag;
  private healthShare = 1;

  constructor(parent: Object3D, totalWaves: number) {
    this.health = new Flag(parent, FLAGS.healthAngleDeg, FLAGS.healthColor, -1);
    this.wave = new Flag(parent, FLAGS.waveAngleDeg, FLAGS.waveColor, 1);
    this.wave.addNotches(totalWaves);
    this.wave.set(0, true);
  }

  /** Castle health share (1 = full) and waves cleared, from the battle rules. */
  show(healthShare: number, waveShare: number, instant = false): void {
    this.healthShare = healthShare;
    this.health.set(healthShare, instant);
    this.wave.set(waveShare, instant);
  }

  update(dt: number): void {
    this.health.update(dt, this.healthShare < FLAGS.lowShare);
    this.wave.update(dt, false);
  }
}
