// The two flags in front of the player (docs/castle-rules.md section 2): the
// red castle health flag slides down with damage, the blue wave flag climbs
// one notch per wave. Progress bars built into the world, no numbers.
// They live in boardLift (cm): they rise with the board but never spin.
import { BoxGeometry, Color, CylinderGeometry, DoubleSide, Group, Mesh, PlaneGeometry, SphereGeometry, Vector3, type Object3D } from 'three';
import { FLAGS, JUICE } from '../config/game.js';
import { popIn } from '../fx/ease.js';
import { degToRad, polarX, polarZ } from '../rules/boardMath.js';
import { flatMaterial } from './shapes.js';

const FLASH = new Color(0xffffff);

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
  /** Juice: a jolt when the castle is hit, a pop when a wave is won (seconds left). */
  private jolt = 0;
  private popTime = 0;

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
    const next = Math.min(1, Math.max(0, share));
    if (!instant) {
      if (next < this.target - 1e-4) this.jolt = JUICE.flagJoltTime;
      else if (next > this.target + 0.02) this.popTime = JUICE.flagPopTime;
    }
    this.target = next;
    if (instant) this.shown = this.target;
  }

  /** World position of the cloth's middle, for markers. */
  clothWorld(out: Vector3): Vector3 {
    return this.pivot.localToWorld(out.set(0, -FLAGS.clothHeight / 2, 0));
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
    // The cloth only ever turns around the pole itself (y), so its whole edge stays on the pole. It used to
    // tilt and jerk around its top corner, which swung its lower edge off the pole (headset test).
    // A low flag waves slower and hangs limp: it flies shorter, its edge still on the pole.
    const sway = degToRad(FLAGS.swayDeg) * (low ? 0.4 : 1);
    let turn = Math.sin(this.time * FLAGS.swaySpeed * (low ? 0.6 : 1)) * sway;
    const material = this.cloth.material as ReturnType<typeof flatMaterial>;
    material.color.copy(this.color).multiplyScalar(low ? 0.55 : 1);
    // Juice: hit, the cloth shakes on the pole and flashes bright. A wave won, it pops bigger and settles.
    if (this.jolt > 0) {
      this.jolt = Math.max(0, this.jolt - dt);
      const t = this.jolt / JUICE.flagJoltTime;
      turn += Math.sin(t * Math.PI * 6) * degToRad(JUICE.flagJoltDeg) * t;
      material.color.lerp(FLASH, t * 0.6);
    }
    this.pivot.rotation.set(0, turn, 0);
    let size = 1;
    if (this.popTime > 0) {
      this.popTime = Math.max(0, this.popTime - dt);
      const t = 1 - this.popTime / JUICE.flagPopTime;
      size = t < 0.5 ? 1 + popIn(t * 2) * 0.35 : 1.35 - (t - 0.5) * 0.7;
      material.color.lerp(FLASH, (1 - t) * 0.4);
    }
    // Scaled from the pivot on the pole, so the edge never leaves it.
    this.pivot.scale.set(size * (low ? FLAGS.limpLength : 1), size, size);
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

  clothWorld(which: 'health' | 'wave', out: Vector3): Vector3 {
    return (which === 'health' ? this.health : this.wave).clothWorld(out);
  }

  update(dt: number): void {
    this.health.update(dt, this.healthShare < FLAGS.lowShare);
    this.wave.update(dt, false);
  }
}
