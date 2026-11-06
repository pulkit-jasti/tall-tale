// Balloon riders (docs/enemies.md, build step 7): the first flying enemy.
// "Can you look up?" A patched goblin balloon with goblins hanging under its
// basket floats in a straight line from a camp toward the castle at about
// head height (no roads), stops over the courtyard and drops its riders in
// (they become intruders, food in reach), then rises and drifts away.
//
// Answers: the slingshot pops the balloon (it registers as a SlingTarget, a
// big still target with the full aim assist) and the riders fall and poof.
// Riders are normal goblins in the 'riding' mode, so a pinch pulls one off,
// the swatter hits them and a pebble can knock one out. The megaphone and
// the bell stun them, and a balloon with stunned riders stops in the air.
//
// All balloons are one instanced mesh (envelope, ropes and basket in vertex
// colors): one draw call. Positions in board units (cm) in the turning board.
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { GameAudio } from '../audio/sound.js';
import { BALLOONS, CASTLE } from '../config/game.js';
import { mark } from '../debug/perfMarks.js';
import { popIn } from '../fx/ease.js';
import type { Particles } from '../fx/particles.js';
import { polarX, polarZ } from '../rules/boardMath.js';
import type { Random } from '../rules/random.js';
import type { SlingTarget } from '../tools/slingshot.js';
import type { Goblin, Goblins } from './goblins.js';

type Phase = 'off' | 'approach' | 'drop' | 'leave' | 'popped';

/** Under the envelope's center: the basket's middle and the riders' hands (cm). */
const BASKET_DROP = BALLOONS.radius * 1.15 + 4.2;
const temp = new Vector3();
const matrix = new Matrix4();
const quaternion = new Quaternion();
const scaleV = new Vector3();
const color = new Color();
const UP = new Vector3(0, 1, 0);

export class Balloon implements SlingTarget {
  phase: Phase = 'off';
  readonly position = new Vector3();
  /** Board angle it flies along (radians), and how far out it is (cm). */
  angle = 0;
  radiusOut = 0;
  riders: Goblin[] = [];
  /** Time to the next rider drop, the next threat flash, and the pop animation (seconds). */
  timer = 0;
  threatTimer = 0;
  age = 0;
  /** Height gained since it turned away (cm). */
  lift = 0;
  aimed = false;
  /** The balloon lesson: it stops this far out (cm) and hovers there, riders aboard, until popped. Null: it comes all the way in. */
  waitAt: number | null = null;
  readonly radius = BALLOONS.radius * 1.2;
  readonly assist = 1;

  constructor(
    readonly index: number,
    private owner: Balloons,
  ) {}

  center(out: Vector3): Vector3 {
    return out.copy(this.position);
  }

  hittable(): boolean {
    return this.phase === 'approach' || this.phase === 'drop' || this.phase === 'leave';
  }

  onHit(): void {
    this.owner.pop(this);
  }

  setAimed(aimed: boolean): void {
    if (this.aimed === aimed) return;
    this.aimed = aimed;
    this.owner.tint(this);
  }
}

/** One balloon as one geometry with vertex colors: a patched envelope, ropes and a basket. */
function balloonGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const paint = (g: BufferGeometry, pick: (x: number, y: number, z: number, face: number) => number): BufferGeometry => {
    const flat = g.index ? g.toNonIndexed() : g;
    for (const name of Object.keys(flat.attributes)) if (name !== 'position' && name !== 'normal') flat.deleteAttribute(name);
    const pos = flat.getAttribute('position');
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i += 3) {
      // One color per triangle, from its middle.
      const x = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
      const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
      const z = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
      color.setHex(pick(x, y, z, i / 3));
      for (let k = 0; k < 3; k++) color.toArray(colors, (i + k) * 3);
    }
    flat.setAttribute('color', new Float32BufferAttribute(colors, 3));
    flat.computeVertexNormals();
    return flat;
  };
  const r = BALLOONS.radius;
  // The envelope: a faceted ball, a little taller than wide, in wide stripes with odd patches.
  const envelope = new IcosahedronGeometry(r, 1);
  envelope.scale(1, 1.15, 1);
  parts.push(
    paint(envelope, (x, y, z, face) => {
      const stripe = Math.floor(((Math.atan2(z, x) + Math.PI) / (Math.PI * 2)) * 6) % 2;
      if (face % 11 === 3) return BALLOONS.colors[2];
      if (face % 13 === 5) return BALLOONS.colors[3];
      return BALLOONS.colors[stripe];
    }),
  );
  // The mouth under it.
  const mouth = new CylinderGeometry(r * 0.32, r * 0.18, r * 0.35, 6);
  mouth.translate(0, -r * 1.12, 0);
  parts.push(paint(mouth, () => BALLOONS.colors[3]));
  // The basket.
  const basket = new CylinderGeometry(1.7, 1.35, 2.2, 6);
  basket.translate(0, -BASKET_DROP, 0);
  parts.push(paint(basket, () => BALLOONS.basketColor));
  // Four ropes from the basket rim up to the envelope.
  const top = -r * 0.9;
  const bottom = -BASKET_DROP + 1.1;
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    const from = new Vector3(Math.cos(a) * 1.5, bottom, Math.sin(a) * 1.5);
    const to = new Vector3(Math.cos(a) * r * 0.55, top, Math.sin(a) * r * 0.55);
    const length = from.distanceTo(to);
    const rope = new BoxGeometry(0.12, length, 0.12);
    rope.applyQuaternion(new Quaternion().setFromUnitVectors(UP, to.clone().sub(from).normalize()));
    rope.translate((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
    parts.push(paint(rope, () => BALLOONS.ropeColor));
  }
  return mergeGeometries(parts)!;
}

export class Balloons {
  readonly list: Balloon[] = [];
  /** The stress test: balloons hover where they are (they still bob). */
  hold = false;
  /** Balloons popped since the game started (the balloon lesson counts them). */
  pops = 0;

  /** The balloon lesson is over: a balloon still hovering comes on in. */
  releaseWaiting(): void {
    for (const b of this.list) b.waitAt = null;
  }
  private mesh: InstancedMesh;
  private time = 0;
  /** Called with each balloon popped (juice: a ring and stars), at its world position. */
  onPop: (balloon: Balloon, world: Vector3) => void = () => {};
  /** Called now and then while a balloon with riders is over or near the wall (the threat cue). */
  onThreat: (rider: Goblin) => void = () => {};

  constructor(
    private board: Object3D,
    private goblins: Goblins,
    private audio: GameAudio,
    private particles: Particles,
    private rng: Random,
  ) {
    this.mesh = new InstancedMesh(
      balloonGeometry(),
      new MeshStandardMaterial({ vertexColors: true, roughness: 0.75, flatShading: true }),
      BALLOONS.max,
    );
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    const hidden = new Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < BALLOONS.max; i++) {
      this.mesh.setMatrixAt(i, hidden);
      this.mesh.setColorAt(i, color.setRGB(1, 1, 1));
      this.list.push(new Balloon(i, this));
    }
    board.add(this.mesh);
  }

  /** Slingshot targets: every balloon (each says when it can be hit). */
  get targets(): SlingTarget[] {
    return this.list;
  }

  get activeCount(): number {
    let n = 0;
    for (const b of this.list) if (b.phase !== 'off') n++;
    return n;
  }

  /** Balloons still carrying riders (the wave is not over while one does). */
  get carrying(): number {
    let n = 0;
    for (const b of this.list) if (b.phase !== 'off' && b.riders.length > 0) n++;
    return n;
  }

  /**
   * A balloon comes in along a board angle (radians), from `from` cm out.
   * Returns null when all balloons are out, or no rider could be spawned (unit cap).
   */
  spawn(angle: number, from: number = BALLOONS.startRadius, waitAt: number | null = null): Balloon | null {
    const balloon = this.list.find((b) => b.phase === 'off');
    if (!balloon) return null;
    const riders: Goblin[] = [];
    for (let k = 0; k < BALLOONS.riders; k++) {
      const g = this.goblins.spawnRider();
      if (g) riders.push(g);
    }
    if (riders.length === 0) return null;
    mark('balloon spawn');
    balloon.phase = 'approach';
    balloon.angle = angle;
    balloon.radiusOut = from;
    balloon.riders = riders;
    balloon.timer = 0;
    balloon.threatTimer = 0;
    balloon.age = 0;
    balloon.lift = 0;
    balloon.aimed = false;
    balloon.waitAt = waitAt;
    this.tint(balloon);
    this.place(balloon, 0);
    this.mesh.visible = true;
    return balloon;
  }

  /** The nearest balloon still in the air to a board angle (for the tutorial's marker), or null. */
  nearest(angle: number): Balloon | null {
    let best: Balloon | null = null;
    let bestD = Infinity;
    for (const b of this.list) {
      if (!b.hittable()) continue;
      let d = Math.abs(b.angle - angle) % (Math.PI * 2);
      if (d > Math.PI) d = Math.PI * 2 - d;
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  /** Hit by a slingshot shot: it bursts, and its riders fall and poof where they land. */
  pop(balloon: Balloon): void {
    if (!balloon.hittable()) return;
    this.pops++;
    balloon.phase = 'popped';
    balloon.waitAt = null;
    balloon.timer = BALLOONS.popTime;
    // Riders fall, drifting on a little the way it floated (inward).
    const vx = -polarX(1, balloon.angle) * BALLOONS.speed * 0.8;
    const vz = -polarZ(1, balloon.angle) * BALLOONS.speed * 0.8;
    for (const g of balloon.riders) this.goblins.fallRider(g, vx * this.rng.range(0.5, 1.5), vz * this.rng.range(0.5, 1.5));
    balloon.riders = [];
    this.board.localToWorld(temp.copy(balloon.position));
    this.particles.burst(temp, BALLOONS.popColors, 16, 0.4);
    this.audio.play('pebbleHit', temp);
    this.audio.play('poof', temp);
    this.onPop(balloon, temp);
  }

  /** Everything gone at once (a new battle, the stress test). Riders are killed by the caller (killAll). */
  clear(): void {
    this.hold = false;
    for (const b of this.list) {
      b.phase = 'off';
      b.riders = [];
      this.hide(b);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.visible = false;
  }

  /** Brighter while the slingshot aims at it. */
  tint(balloon: Balloon): void {
    const k = balloon.aimed ? BALLOONS.aimedBrightness : 1;
    this.mesh.setColorAt(balloon.index, color.setRGB(k, k, k));
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt: number): void {
    this.time += dt;
    let any = false;
    for (const b of this.list) {
      if (b.phase === 'off') continue;
      any = true;
      b.age += dt;
      // Riders picked off (pinched, knocked out, swatted) are no longer carried.
      for (let k = b.riders.length - 1; k >= 0; k--) if (b.riders[k].mode !== 'riding') b.riders.splice(k, 1);
      // A balloon with stunned riders stops in the air.
      let stunned = false;
      for (const g of b.riders) if (g.stunned > 0) stunned = true;
      switch (b.phase) {
        case 'approach':
          if (!stunned && !this.hold) b.radiusOut -= BALLOONS.speed * dt;
          // The lesson balloon hovers outside the wall, riders aboard, until it is popped.
          if (b.waitAt !== null && b.radiusOut <= b.waitAt) b.radiusOut = b.waitAt;
          if (b.riders.length === 0) b.phase = 'leave';
          else if (b.waitAt === null && b.radiusOut <= BALLOONS.dropRadius) {
            b.radiusOut = BALLOONS.dropRadius;
            b.phase = 'drop';
            b.timer = BALLOONS.dropGap * 0.5;
          }
          break;
        case 'drop':
          if (!stunned) b.timer -= dt;
          if (b.timer <= 0 && b.riders.length > 0) {
            b.timer = BALLOONS.dropGap;
            this.goblins.dropRider(b.riders.shift()!);
          }
          if (b.riders.length === 0) b.phase = 'leave';
          break;
        case 'leave':
          b.radiusOut += BALLOONS.leaveSpeed * dt;
          if (b.radiusOut > BALLOONS.goneRadius || b.position.y > BALLOONS.goneHeight) {
            b.phase = 'off';
            for (const g of b.riders) this.goblins.kill(g);
            b.riders = [];
            this.hide(b);
            continue;
          }
          break;
        case 'popped':
          b.timer -= dt;
          if (b.timer <= 0) {
            b.phase = 'off';
            this.hide(b);
            continue;
          }
          break;
        default:
          break;
      }
      this.place(b, dt);
      // The threat cue: the wall under a carrying balloon flashes red.
      if (b.riders.length > 0 && b.radiusOut < CASTLE.wallOut + BALLOONS.threatOut) {
        b.threatTimer -= dt;
        if (b.threatTimer <= 0) {
          b.threatTimer = BALLOONS.threatEvery;
          this.onThreat(b.riders[0]);
        }
      }
    }
    if (any) this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.visible = any;
  }

  private hide(b: Balloon): void {
    this.mesh.setMatrixAt(b.index, matrix.makeScale(0, 0, 0));
  }

  /** Puts the balloon and its riders where they are now, with a gentle bob and sway. */
  private place(b: Balloon, dt: number): void {
    const p = b.position;
    const bob = Math.sin(this.time * BALLOONS.bobSpeed + b.index * 1.7) * BALLOONS.bob;
    // Rising while it leaves, from the moment it turned away.
    if (b.phase === 'leave') b.lift += BALLOONS.leaveRise * dt;
    p.set(polarX(b.radiusOut, b.angle), BALLOONS.height + bob + b.lift, polarZ(b.radiusOut, b.angle));
    const swayX = Math.sin(this.time * 1.1 + b.index) * BALLOONS.sway;
    const swayZ = Math.cos(this.time * 0.9 + b.index * 2) * BALLOONS.sway;
    quaternion.setFromAxisAngle(temp.set(swayZ, 0, -swayX).normalize(), Math.hypot(swayX, swayZ));
    // Pops in when it spawns, bursts (swells, then gone) when popped.
    let s = b.age < 0.4 ? popIn(b.age / 0.4) : 1;
    if (b.phase === 'popped') {
      const t = 1 - b.timer / BALLOONS.popTime;
      s = t < 0.6 ? 1 + t * 0.6 : Math.max(0, (1 - t) * 3.4);
    }
    matrix.compose(p, quaternion, scaleV.setScalar(s));
    this.mesh.setMatrixAt(b.index, matrix);
    // Riders hang from the basket, side by side, facing where it floats.
    const n = b.riders.length;
    const faceX = -polarX(1, b.angle);
    const faceZ = -polarZ(1, b.angle);
    for (let k = 0; k < n; k++) {
      const g = b.riders[k];
      const side = (k - (n - 1) / 2) * 2.2;
      g.root.position.set(p.x - faceZ * side, p.y - BASKET_DROP - 0.9 - g.stats.height * 1.05, p.z + faceX * side);
      g.face(faceX, faceZ);
    }
  }
}
