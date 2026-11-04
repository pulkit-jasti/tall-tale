// Pooled particle bursts (poof, crumbs) as one instanced mesh of tiny
// low-poly balls in world space.
import {
  Color,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Object3D,
  Vector3,
} from 'three';
import { PARTICLES } from '../config/game.js';
import { mark } from '../debug/perfMarks.js';
import type { Random } from '../rules/random.js';

interface Particle {
  alive: boolean;
  age: number;
  position: Vector3;
  velocity: Vector3;
}

export class Particles {
  private mesh: InstancedMesh;
  private pool: Particle[] = [];
  private next = 0;
  private matrix = new Matrix4();
  private color = new Color();
  private hidden = new Matrix4().makeScale(0, 0, 0);

  constructor(
    parent: Object3D,
    private rng: Random,
  ) {
    this.mesh = new InstancedMesh(
      new IcosahedronGeometry(PARTICLES.size, 0),
      new MeshBasicMaterial({ color: 0xffffff }),
      PARTICLES.poolSize,
    );
    this.mesh.frustumCulled = false;
    for (let i = 0; i < PARTICLES.poolSize; i++) {
      this.pool.push({ alive: false, age: 0, position: new Vector3(), velocity: new Vector3() });
      this.mesh.setMatrixAt(i, this.hidden);
      this.mesh.setColorAt(i, this.color.setHex(0xffffff));
    }
    parent.add(this.mesh);
  }

  /** A small burst at a world position. */
  burst(at: Vector3, colors: number[], count = 12, speed = PARTICLES.speed): void {
    mark('particles');
    for (let n = 0; n < count; n++) {
      const i = this.next;
      this.next = (this.next + 1) % this.pool.length;
      const p = this.pool[i];
      p.alive = true;
      p.age = 0;
      p.position.copy(at);
      p.velocity
        .set(this.rng.range(-1, 1), this.rng.range(0.2, 1.2), this.rng.range(-1, 1))
        .normalize()
        .multiplyScalar(speed * this.rng.range(0.4, 1));
      this.mesh.setColorAt(i, this.color.setHex(this.rng.pick(colors)));
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  /** Specks falling from a world point, spread a little sideways (pepper). `spread` and `speed` in meters. */
  drizzle(at: Vector3, colors: number[], count: number, spread: number, speed: number): void {
    mark('particles');
    for (let n = 0; n < count; n++) {
      const i = this.next;
      this.next = (this.next + 1) % this.pool.length;
      const p = this.pool[i];
      p.alive = true;
      p.age = 0;
      p.position.copy(at);
      p.position.x += this.rng.range(-spread, spread);
      p.position.z += this.rng.range(-spread, spread);
      p.velocity.set(this.rng.range(-0.04, 0.04), -speed * this.rng.range(0.6, 1), this.rng.range(-0.04, 0.04));
      this.mesh.setColorAt(i, this.color.setHex(this.rng.pick(colors)));
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt: number): void {
    let changed = false;
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (!p.alive) continue;
      changed = true;
      p.age += dt;
      if (p.age >= PARTICLES.life) {
        p.alive = false;
        this.mesh.setMatrixAt(i, this.hidden);
        continue;
      }
      p.velocity.y -= PARTICLES.gravity * dt;
      p.position.addScaledVector(p.velocity, dt);
      const s = 1 - p.age / PARTICLES.life;
      this.matrix.makeScale(s, s, s).setPosition(p.position);
      this.mesh.setMatrixAt(i, this.matrix);
    }
    if (changed) this.mesh.instanceMatrix.needsUpdate = true;
  }
}
