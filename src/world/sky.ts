// The sky (decor only, no gameplay, no interaction): a cartoon sun and many
// slow, low-poly white clouds in front of the IWSDK gradient dome from the
// scene file. The clouds float low, not far above the player's head, so the
// giant feels close to them and far above the ground.
//
// Built to cost almost nothing on a Quest 3S:
//   - the sun is a few flat unlit shapes (glow, rays, rim, face, shine),
//   - all the clouds are one InstancedMesh of low-poly puffs (one draw call),
//     unlit, with their shading baked into vertex colors,
//   - fog is off, so they keep their colors.
//
// No flicker: far away the depth buffer cannot tell apart things a meter or
// two apart, so overlapping puffs (and the sun's layers) used to fight. Now
// none of them write depth: each piece draws in a fixed order (renderOrder),
// the sun first, then the clouds, sorted far to near now and then. They
// still test depth, so hills and the board in front hide them.
//
// It lives in world space around the player and never turns with the board
// (comfort rule). The clouds drift with a gentle wind and wrap around.
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  Float32BufferAttribute,
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
import { SKY } from '../config/game.js';
import type { Random } from '../rules/random.js';

interface Puff {
  /** Offset from its cloud's middle (meters), and its size. */
  readonly offset: Vector3;
  readonly scale: Vector3;
  /** Its spot right now (world), for the far-to-near sort. */
  readonly at: Vector3;
  distance: number;
  /** 1, shrinking to 0 near the edge of the wrap square. */
  fade: number;
}

interface Cloud {
  /** Middle of the cloud (meters, world). */
  readonly at: Vector3;
  readonly puffs: Puff[];
}

const DEG = Math.PI / 180;
const matrix = new Matrix4();
const scale = new Vector3();
const noTurn = new Quaternion();
const UP = new Vector3(0, 1, 0);
const color = new Color();
const top = new Color();
const bottom = new Color();

/** Draw order of the sky pieces: after the board and the hills (0), the sun before the clouds. */
const ORDER = { glow: 10, rays: 11, rim: 12, face: 13, shine: 14, clouds: 20 };

/** An unlit material for sky pieces: exact colors, no fog, never writes depth. */
function skyMaterial(hex: number, extra: Partial<MeshBasicMaterial> = {}): MeshBasicMaterial {
  const material = new MeshBasicMaterial({ color: hex, fog: false, depthWrite: false });
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
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.3, 'rgba(255,255,255,0.45)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new CanvasTexture(canvas);
}

/** Cartoon sun rays: pointy triangles around a circle, long and short in turn (flat, facing +z). */
function raysGeometry(inner: number, long: number, short: number, count: number): BufferGeometry {
  const positions: number[] = [];
  const half = (Math.PI / count) * 0.55;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const tip = i % 2 === 0 ? long : short;
    positions.push(
      Math.cos(a - half) * inner, Math.sin(a - half) * inner, 0,
      Math.cos(a) * tip, Math.sin(a) * tip, 0,
      Math.cos(a + half) * inner, Math.sin(a + half) * inner, 0,
    );
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  return geometry;
}

/**
 * One low-poly puff with its shading baked in: each face gets one color,
 * white on top fading to a light sky blue underneath (never grey).
 */
function puffGeometry(): BufferGeometry {
  const geometry = new IcosahedronGeometry(1, 1).toNonIndexed();
  const position = geometry.getAttribute('position') as BufferAttribute;
  const colors = new Float32Array(position.count * 3);
  top.setHex(SKY.cloudColor);
  bottom.setHex(SKY.cloudShade);
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  for (let i = 0; i < position.count; i += 3) {
    a.fromBufferAttribute(position, i);
    b.fromBufferAttribute(position, i + 1);
    c.fromBufferAttribute(position, i + 2);
    // The face normal's height: 1 facing up, -1 facing down. A little extra light from the sun side.
    const normal = b.sub(a).cross(c.sub(a)).normalize();
    const up = normal.dot(UP);
    const t = Math.min(1, Math.max(0, up * 0.6 + 0.55 + normal.x * 0.08));
    color.copy(bottom).lerp(top, t);
    for (let k = 0; k < 3; k++) colors.set([color.r, color.g, color.b], (i + k) * 3);
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  return geometry;
}

export class Sky {
  readonly group = new Group();
  private clouds: Cloud[] = [];
  private allPuffs: Puff[] = [];
  private puffs: InstancedMesh;
  private rays!: Mesh;
  private wind = new Vector3();
  /** Clouds wrap around inside a square this big (meters from the player). */
  private half = SKY.cloudMaxDistance;
  private sortTimer = 0;
  private time = 0;

  constructor(parent: Object3D, rng: Random) {
    this.group.name = 'sky';
    parent.add(this.group);
    this.buildSun();
    const total = SKY.cloudCount * SKY.puffsPerCloud;
    this.puffs = new InstancedMesh(puffGeometry(), skyMaterial(0xffffff, { vertexColors: true }), total);
    // Spread over the whole sky and always moving: skip culling instead of recomputing bounds.
    this.puffs.frustumCulled = false;
    this.puffs.renderOrder = ORDER.clouds;
    this.group.add(this.puffs);
    for (let i = 0; i < SKY.cloudCount; i++) this.clouds.push(this.makeCloud(rng));
    const w = SKY.windDeg * DEG;
    this.wind.set(Math.sin(w), 0, -Math.cos(w)).multiplyScalar(SKY.windSpeed);
    this.place(true);
  }

  /**
   * A bright cartoon sun: a warm glow, pointy rays that turn slowly, an
   * orange rim, a yellow face and a pale shine spot, all unlit.
   */
  private buildSun(): void {
    const a = SKY.sunAngleDeg * DEG;
    const e = SKY.sunElevationDeg * DEG;
    const d = SKY.sunDistance;
    const r = SKY.sunSize / 2;
    const sun = new Group();
    sun.position.set(Math.sin(a) * Math.cos(e) * d, Math.sin(e) * d, -Math.cos(a) * Math.cos(e) * d);
    sun.lookAt(0, 1.2, 0);
    const glow = new Mesh(
      new CircleGeometry(r * SKY.glowShare, 32),
      // Additive, but kept in the opaque pass so it draws in its renderOrder slot, before the clouds.
      skyMaterial(SKY.glowColor, { map: glowTexture(), blending: AdditiveBlending, transparent: false }),
    );
    const rays = new Mesh(raysGeometry(r * 1.05, r * 1.75, r * 1.4, SKY.sunRays), skyMaterial(SKY.rayColor));
    const rim = new Mesh(new CircleGeometry(r * 1.08, 32), skyMaterial(SKY.rimColor));
    const face = new Mesh(new CircleGeometry(r, 32), skyMaterial(SKY.sunColor));
    const shine = new Mesh(new CircleGeometry(r * 0.32, 20), skyMaterial(SKY.shineColor));
    shine.position.set(-r * 0.38, r * 0.38, 0);
    glow.renderOrder = ORDER.glow;
    rays.renderOrder = ORDER.rays;
    rim.renderOrder = ORDER.rim;
    face.renderOrder = ORDER.face;
    shine.renderOrder = ORDER.shine;
    sun.add(glow, rays, rim, face, shine);
    this.rays = rays;
    this.group.add(sun);
  }

  /** A cloud: a few round puffs side by side, the middle ones bigger and higher, turned to a random direction. */
  private makeCloud(rng: Random): Cloud {
    const a = rng.range(0, Math.PI * 2);
    const d = rng.range(SKY.cloudMinDistance, SKY.cloudMaxDistance);
    const at = new Vector3(Math.sin(a) * d, rng.range(SKY.cloudMinHeight, SKY.cloudMaxHeight), -Math.cos(a) * d);
    const size = rng.range(SKY.cloudMinSize, SKY.cloudMaxSize);
    const yaw = rng.range(0, Math.PI * 2);
    const puffs: Puff[] = [];
    const n = SKY.puffsPerCloud;
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1) - 0.5) * size;
      const middle = 1 - Math.abs(i / (n - 1) - 0.5) * 1.1;
      const r = size * 0.24 * middle * rng.range(0.85, 1.2);
      const offset = new Vector3(x, r * 0.45 * middle + rng.range(-0.1, 0.1) * r, rng.range(-0.18, 0.18) * size);
      offset.applyAxisAngle(UP, yaw);
      // Round and a little flat at the bottom.
      const puff: Puff = { offset, scale: new Vector3(r * 1.1, r * 0.8, r * 1.1), at: new Vector3(), distance: 0, fade: 1 };
      puffs.push(puff);
      this.allPuffs.push(puff);
    }
    return { at, puffs };
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
      // Shrinks away near the edge of the wrap square, so it never pops in or out.
      const edge = Math.max(Math.abs(cloud.at.x), Math.abs(cloud.at.z)) / this.half;
      const fade = Math.max(0.001, Math.min(1, (1 - edge) / 0.15));
      for (const puff of cloud.puffs) {
        puff.at.copy(cloud.at).add(puff.offset);
        puff.distance = puff.at.lengthSq();
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
