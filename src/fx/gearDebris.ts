// Gear that flies off (build step 7, docs/mvp.md "gear flying off"): a
// helmet knocked off by a hit, a spear dropped by a sneezing goblin, the
// weapon of a goblin that poofs. One small instanced pool per gear kind
// (one draw call each, drawn only while something flies). Simple projectile
// math in board space (cm), a short rest on the ground, then the shared
// shrink away.
import { Matrix4, Object3D, Quaternion, Vector3 } from 'three';
import { GOBLIN_GEAR, GOBLIN_RULES, type GearName } from '../config/game.js';
import { landingHeight } from '../rules/boardMath.js';
import type { Random } from '../rules/random.js';
import { gearTemplate } from '../units/gear.js';
import { InstancedPool } from '../world/models.js';
import { shrinkAway } from './ease.js';

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
}

interface Kind {
  pool: InstancedPool;
  pieces: Piece[];
}

const matrix = new Matrix4();
const quaternion = new Quaternion();
const scale = new Vector3();

export class GearDebris {
  private kinds = new Map<GearName, Kind>();

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
        pieces.push({ alive: false, position: new Vector3(), velocity: new Vector3(), axis: new Vector3(1, 0, 0), angle: 0, spin: 0, rest: -1, vanish: 0 });
      }
      this.kinds.set(name, { pool, pieces });
    });
  }

  /** A piece flies off from a board point (cm), away along (dx, dz) and up. */
  throw(name: GearName, at: Vector3, dx: number, dz: number): void {
    const kind = this.kinds.get(name);
    if (!kind) return;
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
  }

  update(dt: number): void {
    for (const kind of this.kinds.values()) {
      for (let i = 0; i < kind.pieces.length; i++) {
        const p = kind.pieces[i];
        if (!p.alive) continue;
        let size = 1;
        if (p.rest >= 0) {
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
