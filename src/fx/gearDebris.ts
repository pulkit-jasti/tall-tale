// Gear that flies off (build step 7, docs/mvp.md "gear flying off"): a
// helmet knocked off by a hit, a spear dropped by a sneezing goblin, the
// weapon of a goblin that poofs. One small instanced pool per gear kind
// (one draw call each, drawn only while something flies). Simple projectile
// math in board space (cm), a short rest on the ground, then the shared
// shrink away.
import { Matrix4, Object3D, Quaternion, Vector3 } from 'three';
import { GOBLIN_GEAR, GOBLIN_RULES, MAGNET, type GearName } from '../config/game.js';
import { landingHeight } from '../rules/boardMath.js';
import type { Random } from '../rules/random.js';
import { gearTemplate } from '../units/gear.js';
import { InstancedPool } from '../world/models.js';
import { shrinkAway } from './ease.js';
import { mark } from '../debug/perfMarks.js';

interface Piece {
  alive: boolean;
  readonly position: Vector3;
  readonly velocity: Vector3;
  readonly axis: Vector3;
  angle: number;
  spin: number;
  /** Lying on the ground: time left (seconds), -1 while flying. */
  rest: number;
  vanish: number;
  /** Pulled by the magnet (2026-11-17): it flies to `magnetAt` instead of falling, for this long so far (seconds). -1: not pulled. */
  pulled: number;
}

interface Kind {
  pool: InstancedPool;
  pieces: Piece[];
}

const matrix = new Matrix4();
const quaternion = new Quaternion();
const scale = new Vector3();
const toward = new Vector3();

export class GearDebris {
  private kinds = new Map<GearName, Kind>();
  /** Where pulled gear flies to: the magnet's tips (board cm), set by the magnet every frame it is held. */
  readonly magnetAt = new Vector3();
  /** A pulled piece reached the magnet (board cm): the magnet crushes it (a clank and a puff). */
  onMagnet: (at: Vector3) => void = () => {};

  constructor(
    private board: Object3D,
    private rng: Random,
  ) {}

  /** Loads a pool for each gear kind that can fly off. `unitScale`: character units to cm. */
  async load(names: GearName[], unitScale: number): Promise<void> {
    const templates = await Promise.all(names.map((n) => gearTemplate(n, unitScale)));
    names.forEach((name, k) => {
      const template = templates[k];
      if (!template) return;
      const pool = new InstancedPool(template, GOBLIN_GEAR.poolSize);
      this.board.add(pool.group);
      const pieces: Piece[] = [];
      for (let i = 0; i < GOBLIN_GEAR.poolSize; i++) {
        pieces.push({ alive: false, position: new Vector3(), velocity: new Vector3(), axis: new Vector3(1, 0, 0), angle: 0, spin: 0, rest: -1, vanish: 0, pulled: -1 });
      }
      this.kinds.set(name, { pool, pieces });
    });
  }

  /** A piece flies off from a board point (cm), away along (dx, dz) and up. */
  throw(name: GearName, at: Vector3, dx: number, dz: number, toMagnet = false): void {
    const kind = this.kinds.get(name);
    if (!kind) return;
    mark('gear debris');
    let index = kind.pieces.findIndex((p) => !p.alive);
    // All busy: reuse the one lying longest.
    if (index < 0) index = this.rng.int(kind.pieces.length);
    const p = kind.pieces[index];
    const d = Math.hypot(dx, dz) || 1;
    const speed = GOBLIN_GEAR.flySpeed * this.rng.range(0.7, 1.2);
    p.alive = true;
    p.position.copy(at);
    p.velocity.set((dx / d) * speed + this.rng.range(-10, 10), GOBLIN_GEAR.flyUp * this.rng.range(0.8, 1.2), (dz / d) * speed + this.rng.range(-10, 10));
    p.axis.set(this.rng.range(-1, 1), this.rng.range(-0.3, 0.3), this.rng.range(-1, 1)).normalize();
    p.angle = 0;
    p.spin = GOBLIN_GEAR.spin * this.rng.range(0.7, 1.3);
    p.rest = -1;
    p.vanish = 0;
    p.pulled = -1;
    if (toMagnet) {
      // Torn off: a small hop up, then the magnet reels it in.
      p.pulled = 0;
      p.velocity.set(this.rng.range(-8, 8), MAGNET.gearHop, this.rng.range(-8, 8));
    }
  }

  /** A pulled piece: it eases off the goblin, then speeds up toward the magnet, spinning. True when it got there. */
  private reel(p: Piece, dt: number): boolean {
    p.pulled += dt;
    toward.subVectors(this.magnetAt, p.position);
    const d = toward.length();
    if (d < MAGNET.gearArrive) return true;
    // Slow at first (it tears free), then faster and faster.
    const speed = Math.min(MAGNET.gearSpeedMax, MAGNET.gearSpeed + MAGNET.gearAccel * p.pulled);
    toward.multiplyScalar(speed / d);
    p.velocity.lerp(toward, 1 - Math.exp(-dt / MAGNET.gearSteer));
    p.position.addScaledVector(p.velocity, dt);
    p.angle += p.spin * 1.6 * dt;
    return false;
  }

  update(dt: number): void {
    for (const kind of this.kinds.values()) {
      for (let i = 0; i < kind.pieces.length; i++) {
        const p = kind.pieces[i];
        if (!p.alive) continue;
        let size = 1;
        if (p.pulled >= 0) {
          if (this.reel(p, dt)) {
            p.alive = false;
            kind.pool.hide(i);
            this.onMagnet(p.position);
            continue;
          }
          // It shrinks a little as it nears the tips, so it is crushed rather than swallowed whole.
          size = Math.min(1, 0.45 + this.magnetAt.distanceTo(p.position) / 30);
        } else if (p.rest >= 0) {
          p.rest -= dt;
          if (p.rest < 0) {
            p.vanish += dt / GOBLIN_RULES.vanishTime;
            size = shrinkAway(p.vanish);
            p.rest = 0;
            if (p.vanish >= 1) {
              p.alive = false;
              kind.pool.hide(i);
              continue;
            }
          }
        } else {
          p.velocity.y -= GOBLIN_RULES.gravity * dt;
          p.position.addScaledVector(p.velocity, dt);
          p.angle += p.spin * dt;
          const ground = landingHeight(p.position.x, p.position.z);
          if (ground === null) {
            if (p.position.y < -60) {
              p.alive = false;
              kind.pool.hide(i);
              continue;
            }
          } else if (p.position.y <= ground && p.velocity.y < 0) {
            p.position.y = ground;
            // One small bounce, then it lies flat.
            if (-p.velocity.y > 90) {
              p.velocity.y *= -0.3;
              p.velocity.x *= 0.5;
              p.velocity.z *= 0.5;
            } else {
              p.rest = GOBLIN_GEAR.restTime;
              p.angle = Math.PI / 2;
              p.axis.set(1, 0, 0);
            }
          }
        }
        quaternion.setFromAxisAngle(p.axis, p.angle);
        matrix.compose(p.position, quaternion, scale.setScalar(size));
        kind.pool.set(i, matrix);
      }
      kind.pool.commit();
    }
  }

  clear(): void {
    for (const kind of this.kinds.values()) {
      kind.pieces.forEach((p, i) => {
        p.alive = false;
        kind.pool.hide(i);
      });
      kind.pool.commit();
    }
  }
}
