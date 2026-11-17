// Chickens (docs/v3-plan.md 2.1, the potion cart): goblins turned into
// chickens for good. Harmless: no wall damage, they wander a little around
// where they changed, with a waddle and hops (code tweens, no rig). After
// CHICKENS.life a chicken disappears, but only while it is out of the
// player's view (checked against the head's look), never in front of them.
//
// A placeholder shape (no chicken model yet: docs/v3-plan.md "To do later",
// docs/placeholder-shapes.md "Chicken"): a white body, a head, a red comb and
// a yellow beak, one shared set of geometries and materials, pooled.
// Chicken dinner (2.6, a secret ability): a chicken can be pinched like a
// goblin (src/player/grabEat.ts) and held to the mouth to eat it; it heals
// more than a goblin. Held, it neither wanders nor goes away.
import { BoxGeometry, ConeGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, Vector3, type Object3D } from 'three';
import type { GameAudio } from '../audio/sound.js';
import { CHICKENS } from '../config/game.js';
import type { Particles } from '../fx/particles.js';
import { groundAt } from '../rules/boardMath.js';
import type { Random } from '../rules/random.js';

export interface Chicken {
  root: Group;
  /** v3 2.6: in the giant's hand. */
  held: boolean;
  home: Vector3;
  target: Vector3;
  age: number;
  /** Seconds until it picks a new spot to waddle to. */
  wait: number;
  hop: number;
  alive: boolean;
}

const world = new Vector3();
const toHead = new Vector3();

export class Chickens {
  private pool: Chicken[] = [];
  private body = new SphereGeometry(1, 8, 6);
  private head = new SphereGeometry(0.55, 8, 6);
  private comb = new BoxGeometry(0.25, 0.45, 0.6);
  private beak = new ConeGeometry(0.22, 0.5, 5);
  private white = new MeshStandardMaterial({ color: CHICKENS.bodyColor, roughness: 1, flatShading: true });
  private red = new MeshStandardMaterial({ color: CHICKENS.combColor, roughness: 1, flatShading: true });
  private yellow = new MeshStandardMaterial({ color: CHICKENS.beakColor, roughness: 1, flatShading: true });

  constructor(
    private board: Object3D,
    private audio: GameAudio,
    private particles: Particles,
    private rng: Random,
  ) {}

  private make(): Chicken {
    const root = new Group();
    const s = CHICKENS.size;
    const body = new Mesh(this.body, this.white);
    body.scale.set(s * 0.8, s * 0.7, s);
    body.position.y = s * 0.7;
    const head = new Mesh(this.head, this.white);
    head.scale.setScalar(s);
    head.position.set(0, s * 1.4, s * 0.75);
    const comb = new Mesh(this.comb, this.red);
    comb.scale.setScalar(s);
    comb.position.set(0, s * 1.95, s * 0.75);
    const beak = new Mesh(this.beak, this.yellow);
    beak.scale.setScalar(s);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, s * 1.35, s * 1.3);
    root.add(body, head, comb, beak);
    root.visible = false;
    this.board.add(root);
    const chicken: Chicken = { root, held: false, home: new Vector3(), target: new Vector3(), age: 0, wait: 0, hop: 0, alive: false };
    this.pool.push(chicken);
    return chicken;
  }

  /** New chickens at these board points (cm), with a puff and a cluck. */
  spawn(points: Vector3[]): void {
    for (const p of points) {
      const c = this.pool.find((k) => !k.alive) ?? (this.pool.length < CHICKENS.max ? this.make() : null);
      if (!c) return;
      c.alive = true;
      c.held = false;
      c.age = 0;
      c.wait = this.rng.range(0.2, 1);
      c.hop = 0;
      c.home.copy(p);
      c.target.copy(p);
      c.root.position.copy(p).setY(groundAt(p.x, p.z));
      c.root.scale.setScalar(1);
      c.root.visible = true;
      this.board.localToWorld(world.copy(c.root.position));
      this.particles.burst(world, [0xffffff, 0xf2e6c8, 0xffd23f], 6, 0.1);
    }
    if (points.length > 0) this.audio.play('chickenCluck', world, 1, 0.2);
  }

  /** A new battle or map: every chicken gone. */
  clear(): void {
    for (const c of this.pool) {
      c.alive = false;
      c.held = false;
      c.root.visible = false;
    }
  }

  /** v3 2.6: the chicken on the board nearest a world point within `radius` (meters) that can be picked up, or null. */
  nearest(point: Vector3, radius: number): Chicken | null {
    let best: Chicken | null = null;
    let bestD = radius;
    for (const c of this.pool) {
      if (!c.alive || c.held) continue;
      this.board.localToWorld(world.copy(c.root.position));
      world.y += CHICKENS.size * 0.01;
      const d = world.distanceTo(point);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  /** Picked up: a squawk; it stops wandering. */
  grab(c: Chicken): void {
    c.held = true;
    this.audio.play('chickenCluck', this.board.localToWorld(world.copy(c.root.position)), 1);
  }

  /** Held: it dangles from the pinch point (world). */
  holdAt(c: Chicken, pinchWorld: Vector3): void {
    this.board.worldToLocal(c.root.position.copy(pinchWorld));
    c.root.position.y -= CHICKENS.size * 1.6;
    c.root.rotation.z = 0;
  }

  /** Let go away from the mouth: it lands where it is and wanders from there. */
  drop(c: Chicken): void {
    c.held = false;
    c.home.set(c.root.position.x, 0, c.root.position.z);
    c.target.copy(c.home);
    c.wait = 0.5;
  }

  /** Eaten: gone at once. */
  eat(c: Chicken): void {
    c.held = false;
    c.alive = false;
    c.root.visible = false;
  }

  /** `head` and `forward`: the player's head (world) and the way it looks, so none vanish in view. */
  update(dt: number, head: Vector3, forward: Vector3): void {
    const viewCos = Math.cos((CHICKENS.viewDeg * Math.PI) / 180);
    for (const c of this.pool) {
      if (!c.alive || c.held) continue;
      c.age += dt;
      const p = c.root.position;
      // Old enough and out of view: it goes (shrinking away, unseen).
      if (c.age > CHICKENS.life) {
        this.board.localToWorld(world.copy(p));
        toHead.subVectors(world, head).normalize();
        if (toHead.dot(forward) < viewCos) {
          c.alive = false;
          c.root.visible = false;
          continue;
        }
      }
      // Waddle to a spot near home, wait, pick another.
      c.wait -= dt;
      if (c.wait <= 0) {
        c.wait = this.rng.range(1, 3);
        const a = this.rng.range(0, Math.PI * 2);
        const r = this.rng.range(0, CHICKENS.wander);
        c.target.set(c.home.x + Math.cos(a) * r, 0, c.home.z + Math.sin(a) * r);
        if (this.rng.next() < 0.3) this.audio.play('chickenCluck', this.board.localToWorld(world.copy(p)), 0.6, 0.6);
      }
      const dx = c.target.x - p.x;
      const dz = c.target.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.2) {
        const step = Math.min(d, CHICKENS.speed * dt);
        p.x += (dx / d) * step;
        p.z += (dz / d) * step;
        c.root.rotation.y = Math.atan2(dx, dz);
        c.hop += dt * CHICKENS.hopSpeed;
      }
      // A little hop and a side to side waddle while it walks.
      p.y = groundAt(p.x, p.z) + Math.abs(Math.sin(c.hop)) * CHICKENS.hopHeight;
      c.root.rotation.z = Math.sin(c.hop * 2) * 0.15;
    }
  }
}
