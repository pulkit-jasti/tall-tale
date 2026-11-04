// The sky (decor only, no gameplay, no interaction):
//   - a low-poly 3D cartoon sun far away (meters, world): a faceted ball and
//     pointy pyramid rays around it, turning slowly, with a soft glow,
//   - many small clouds made to the board's scale (cm, in boardLift like the
//     hills): little cotton puffs floating around the giant's head, never
//     over the battlefield, so the player feels huge.
// Both sit in front of the IWSDK gradient dome from the scene file and never
// turn with the board (comfort rule).
//
// Built to cost almost nothing on a Quest 3S: the sun is three draw calls,
// all the clouds are one InstancedMesh. Everything is unlit with its shading
// baked into face colors (bright, cartoony, the same in any light), and fog
// is off, so the colors stay as picked.
//
// No flicker: far away the depth buffer cannot tell apart things a few cm or
// meters apart, so overlapping pieces used to fight. None of these pieces
// write depth: each draws in a fixed order (renderOrder), the sun first,
// then the clouds, sorted far to near now and then. They still test depth,
// so the hills and the board in front hide them.
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  ConeGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Quaternion,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SKY } from '../config/game.js';
import type { Random } from '../rules/random.js';
import { groundHeight } from './hills.js';

interface Puff {
  /** Offset from its cloud's middle (cm), and its size. */
  readonly offset: Vector3;
  readonly scale: Vector3;
  /** Its spot right now (boardLift cm), for the far-to-near sort. */
  readonly at: Vector3;
  distance: number;
  /** 1, shrinking to 0 near the edge of the wrap square or over the battlefield. */
  fade: number;
}

interface Cloud {
  /** Middle of the cloud, flat (boardLift cm). Its height follows the ground below. */
  readonly at: Vector3;
  /** Height above the ground (cm). */
  lift: number;
  readonly puffs: Puff[];
}

const DEG = Math.PI / 180;
const matrix = new Matrix4();
const scale = new Vector3();
const noTurn = new Quaternion();
const UP = new Vector3(0, 1, 0);
const color = new Color();
const edge = new Color();
const middle = new Color();
const lit = new Color();
const a = new Vector3();
const b = new Vector3();
const c = new Vector3();
/** Where the giant's eyes are in boardLift (cm above the board), for the cloud sort. */
const EYES = new Vector3(0, 46, 0);

/** Draw order of the sky pieces: after the board and the hills (0), the sun before the clouds. */
const ORDER = { glow: 10, rays: 11, ball: 12, clouds: 20 };

/** An unlit material for sky pieces: exact colors, no fog, never writes depth. */
function skyMaterial(extra: Partial<MeshBasicMaterial> = {}): MeshBasicMaterial {
  const material = new MeshBasicMaterial({ color: 0xffffff, fog: false, depthWrite: false });
  Object.assign(material, extra);
  return material;
}

/** A soft round glow (radial gradient) for behind the sun. */
function glowTexture(): CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,0.8)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.3)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new CanvasTexture(canvas);
}

/**
 * Bakes one color per face into a non-indexed geometry, from how much each
 * face turns toward a light (in the geometry's own frame).
 */
function bakeFaces(geometry: BufferGeometry, light: Vector3, pick: (facing: number, normal: Vector3) => Color): BufferGeometry {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  const position = flat.getAttribute('position') as BufferAttribute;
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i += 3) {
    a.fromBufferAttribute(position, i);
    b.fromBufferAttribute(position, i + 1);
    c.fromBufferAttribute(position, i + 2);
    const normal = b.sub(a).cross(c.sub(a)).normalize();
    const face = pick(normal.dot(light), normal);
    for (let k = 0; k < 3; k++) colors.set([face.r, face.g, face.b], (i + k) * 3);
  }
  flat.setAttribute('color', new BufferAttribute(colors, 3));
  return flat;
}

/** The sun's three shades, by how much a face turns to the light: dark orange edge, yellow middle, pale lit top. */
function sunShade(facing: number): Color {
  const t = Math.min(1, Math.max(0, facing));
  if (t < 0.55) return color.copy(edge).lerp(middle, t / 0.55);
  return color.copy(middle).lerp(lit, Math.min(1, (t - 0.55) / 0.35));
}

/** Clouds: white on top fading to a light sky blue underneath (never grey), a little brighter on the sun side. */
function puffGeometry(): BufferGeometry {
  const top = new Color(SKY.cloudColor);
  const bottom = new Color(SKY.cloudShade);
  return bakeFaces(new IcosahedronGeometry(1, 1), UP, (up, normal) => {
    const t = Math.min(1, Math.max(0, up * 0.6 + 0.55 + normal.x * 0.08));
    return color.copy(bottom).lerp(top, t);
  });
}

export class Sky {
  readonly group = new Group();
  private clouds: Cloud[] = [];
  private allPuffs: Puff[] = [];
  private puffs: InstancedMesh;
  private rays!: Mesh;
  private wind = new Vector3();
  /** Clouds wrap around inside a square this big (board cm from the center). */
  private half = SKY.cloudMaxDistance;
  private sortTimer = 0;
  private time = 0;

  /** The sun goes in `world` (meters), the clouds in `board` (boardLift, cm). */
  constructor(world: Object3D, board: Object3D, rng: Random) {
    this.group.name = 'sky';
    world.add(this.group);
    this.buildSun();
    const total = SKY.cloudCount * SKY.puffsPerCloud;
    this.puffs = new InstancedMesh(puffGeometry(), skyMaterial({ vertexColors: true }), total);
    // Spread all around and always moving: skip culling instead of recomputing bounds.
    this.puffs.frustumCulled = false;
    this.puffs.renderOrder = ORDER.clouds;
    board.add(this.puffs);
    for (let i = 0; i < SKY.cloudCount; i++) this.clouds.push(this.makeCloud(rng));
    const w = SKY.windDeg * DEG;
    this.wind.set(Math.sin(w), 0, -Math.cos(w)).multiplyScalar(SKY.windSpeed);
    this.place(true);
  }

  /**
   * A low-poly 3D cartoon sun: a faceted ball (dark orange at the edge,
   * yellow, pale where the light hits, so it reads round), pointy pyramid
   * rays around it that turn slowly, and a soft warm glow behind.
   */
  private buildSun(): void {
    const az = SKY.sunAngleDeg * DEG;
    const el = SKY.sunElevationDeg * DEG;
    const d = SKY.sunDistance;
    const r = SKY.sunRadius;
    edge.setHex(SKY.sunEdgeColor);
    middle.setHex(SKY.sunColor);
    lit.setHex(SKY.sunLitColor);
    const sun = new Group();
    sun.position.set(Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, -Math.cos(az) * Math.cos(el) * d);
    // Its +z faces the player.
    sun.lookAt(0, 1.2, 0);
    // Light from the upper left, toward the player.
    const light = new Vector3(-0.45, 0.6, 0.65).normalize();
    const ball = new Mesh(
      bakeFaces(new IcosahedronGeometry(r, 1), light, sunShade),
      skyMaterial({ vertexColors: true }),
    );
    // Pyramid rays, long and short in turn, all in one mesh.
    const rays: BufferGeometry[] = [];
    for (let i = 0; i < SKY.sunRays; i++) {
      const length = r * (i % 2 === 0 ? 0.95 : 0.65);
      const ray = new ConeGeometry(r * 0.26, length, 4).toNonIndexed();
      ray.translate(0, r * 0.9 + length / 2, 0);
      // Tipped a little toward the player, so their sides show.
      ray.rotateX(-0.25);
      ray.rotateZ((i / SKY.sunRays) * Math.PI * 2);
      rays.push(ray);
    }
    const rayColor = new Color(SKY.rayColor);
    const rayGeometry = bakeFaces(mergeGeometries(rays), light, (facing) =>
      color.copy(rayColor).multiplyScalar(0.72 + 0.4 * Math.max(0, facing)),
    );
    this.rays = new Mesh(rayGeometry, skyMaterial({ vertexColors: true }));
    const glow = new Mesh(
      new CircleGeometry(r * SKY.glowShare, 32),
      // Additive, but kept in the opaque pass so it draws in its renderOrder slot, before the rest.
      skyMaterial({ color: new Color(SKY.glowColor), map: glowTexture(), blending: AdditiveBlending, transparent: false }),
    );
    glow.position.z = -r;
    glow.renderOrder = ORDER.glow;
    this.rays.renderOrder = ORDER.rays;
    ball.renderOrder = ORDER.ball;
    sun.add(glow, this.rays, ball);
    this.group.add(sun);
  }

  /** A cloud: a few round puffs side by side, the middle ones bigger and higher, turned to a random direction. Small near, bigger far. */
  private makeCloud(rng: Random): Cloud {
    const angle = rng.range(0, Math.PI * 2);
    const d = rng.range(SKY.cloudMinDistance, SKY.cloudMaxDistance);
    const share = (d - SKY.cloudMinDistance) / (SKY.cloudMaxDistance - SKY.cloudMinDistance);
    const at = new Vector3(Math.sin(angle) * d, 0, -Math.cos(angle) * d);
    const lift = SKY.cloudNearHeight + (SKY.cloudFarHeight - SKY.cloudNearHeight) * share + rng.range(-1, 1) * SKY.cloudHeightJitter;
    const size = (SKY.cloudNearSize + (SKY.cloudFarSize - SKY.cloudNearSize) * share) * rng.range(0.75, 1.25);
    const yaw = rng.range(0, Math.PI * 2);
    const puffs: Puff[] = [];
    const n = SKY.puffsPerCloud;
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1) - 0.5) * size;
      const mid = 1 - Math.abs(i / (n - 1) - 0.5) * 1.1;
      const pr = size * 0.24 * mid * rng.range(0.85, 1.2);
      const offset = new Vector3(x, pr * 0.45 * mid + rng.range(-0.1, 0.1) * pr, rng.range(-0.18, 0.18) * size);
      offset.applyAxisAngle(UP, yaw);
      // Round and a little flat at the bottom.
      const puff: Puff = { offset, scale: new Vector3(pr * 1.1, pr * 0.8, pr * 1.1), at: new Vector3(), distance: 0, fade: 1 };
      puffs.push(puff);
      this.allPuffs.push(puff);
    }
    return { at, lift: Math.max(12, lift), puffs };
  }

  /** Every frame: the clouds drift with the wind and wrap around. The sun's rays turn slowly. */
  update(dt: number): void {
    this.time += dt;
    this.rays.rotation.z = this.time * SKY.raySpin * DEG;
    for (const cloud of this.clouds) {
      cloud.at.addScaledVector(this.wind, dt);
      if (cloud.at.x > this.half) cloud.at.x -= this.half * 2;
      else if (cloud.at.x < -this.half) cloud.at.x += this.half * 2;
      if (cloud.at.z > this.half) cloud.at.z -= this.half * 2;
      else if (cloud.at.z < -this.half) cloud.at.z += this.half * 2;
    }
    // The far-to-near order changes slowly, so it is sorted only now and then.
    this.sortTimer -= dt;
    const sort = this.sortTimer <= 0;
    if (sort) this.sortTimer = SKY.sortEvery;
    this.place(sort);
  }

  private place(sort: boolean): void {
    for (const cloud of this.clouds) {
      const r = Math.hypot(cloud.at.x, cloud.at.z);
      // Shrinks away near the edge of the wrap square (never pops), and over the battlefield (never in the way).
      const wrap = Math.max(Math.abs(cloud.at.x), Math.abs(cloud.at.z)) / this.half;
      const fadeEdge = Math.min(1, (1 - wrap) / 0.12);
      const fadeMiddle = Math.min(1, Math.max(0, (r - SKY.clearFrom) / (SKY.clearTo - SKY.clearFrom)));
      const fade = Math.max(0.001, Math.min(fadeEdge, fadeMiddle));
      const y = groundHeight(r) + cloud.lift;
      for (const puff of cloud.puffs) {
        puff.at.set(cloud.at.x + puff.offset.x, y + puff.offset.y, cloud.at.z + puff.offset.z);
        puff.distance = puff.at.distanceToSquared(EYES);
        puff.fade = fade;
      }
    }
    // Far puffs first, so nearer ones paint over them.
    if (sort) this.allPuffs.sort((p, q) => q.distance - p.distance);
    for (let i = 0; i < this.allPuffs.length; i++) {
      const puff = this.allPuffs[i];
      scale.copy(puff.scale).multiplyScalar(puff.fade);
      this.puffs.setMatrixAt(i, matrix.compose(puff.at, noTurn, scale));
    }
    this.puffs.instanceMatrix.needsUpdate = true;
  }
}
