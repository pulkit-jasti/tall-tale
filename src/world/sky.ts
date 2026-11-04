// The sky (decor only, no gameplay, no interaction): a sun and a few slow,
// low-poly clouds in front of the IWSDK gradient dome from the scene file.
// Built to cost almost nothing on a Quest 3S:
//   - the sun is two flat camera-facing discs (unlit),
//   - all the clouds are one InstancedMesh of low-poly puffs (one draw call),
//     moved with a little math each frame,
//   - nothing is transparent except the sun's glow, and fog is off, so the
//     far sky keeps its colors.
// It lives in world space around the player and never turns with the board
// (comfort rule). The clouds drift with a gentle wind and wrap around.
import {
  AdditiveBlending,
  CanvasTexture,
  CircleGeometry,
  Color,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
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
}

interface Cloud {
  /** Middle of the cloud, flat (meters, world). */
  readonly at: Vector3;
  readonly puffs: Puff[];
}

const DEG = Math.PI / 180;
const matrix = new Matrix4();
const position = new Vector3();
const scale = new Vector3();
const noTurn = new Quaternion();

/** A soft round glow (radial gradient) for behind the sun. */
function glowTexture(): CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,0.9)');
  gradient.addColorStop(0.25, 'rgba(255,255,255,0.35)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new CanvasTexture(canvas);
}

export class Sky {
  readonly group = new Group();
  private clouds: Cloud[] = [];
  private puffs: InstancedMesh;
  private wind = new Vector3();
  /** Clouds wrap around inside a square this big (meters from the player). */
  private half = SKY.cloudMaxDistance;

  constructor(parent: Object3D, rng: Random) {
    this.group.name = 'sky';
    parent.add(this.group);
    this.buildSun();
    const geometry = new IcosahedronGeometry(1, 1);
    // Lit, flat shaded, so the low-poly faces read. The emissive keeps the shadow side a soft blue grey, never dark.
    const material = new MeshLambertMaterial({
      color: SKY.cloudColor,
      emissive: new Color(SKY.cloudShade),
      emissiveIntensity: 0.55,
      flatShading: true,
      fog: false,
    });
    const total = SKY.cloudCount * SKY.puffsPerCloud;
    this.puffs = new InstancedMesh(geometry, material, total);
    // Spread over the whole sky and always moving: skip culling instead of recomputing bounds.
    this.puffs.frustumCulled = false;
    this.group.add(this.puffs);
    for (let i = 0; i < SKY.cloudCount; i++) this.clouds.push(this.makeCloud(rng));
    const w = SKY.windDeg * DEG;
    this.wind.set(Math.sin(w), 0, -Math.cos(w)).multiplyScalar(SKY.windSpeed);
    this.place();
  }

  private buildSun(): void {
    const a = SKY.sunAngleDeg * DEG;
    const e = SKY.sunElevationDeg * DEG;
    const d = SKY.sunDistance;
    const sun = new Group();
    sun.position.set(Math.sin(a) * Math.cos(e) * d, Math.sin(e) * d, -Math.cos(a) * Math.cos(e) * d);
    sun.lookAt(0, 0, 0);
    const disc = new Mesh(new CircleGeometry(SKY.sunSize / 2, 24), new MeshBasicMaterial({ color: SKY.sunColor, fog: false }));
    const glow = new Mesh(
      new CircleGeometry(SKY.glowSize / 2, 24),
      new MeshBasicMaterial({
        color: SKY.glowColor,
        map: glowTexture(),
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        fog: false,
      }),
    );
    // The glow sits just behind the disc.
    glow.position.z = -0.5;
    sun.add(glow, disc);
    this.group.add(sun);
  }

  /** A cloud: a few flattened puffs side by side, the middle ones bigger. */
  private makeCloud(rng: Random): Cloud {
    const a = rng.range(0, Math.PI * 2);
    const d = rng.range(SKY.cloudMinDistance, SKY.cloudMaxDistance);
    const at = new Vector3(Math.sin(a) * d, rng.range(SKY.cloudMinHeight, SKY.cloudMaxHeight), -Math.cos(a) * d);
    const size = rng.range(SKY.cloudMinSize, SKY.cloudMaxSize);
    const puffs: Puff[] = [];
    const n = SKY.puffsPerCloud;
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1) - 0.5) * size;
      const middle = 1 - Math.abs(i / (n - 1) - 0.5) * 1.2;
      const r = size * 0.22 * middle * rng.range(0.85, 1.2);
      puffs.push({
        offset: new Vector3(x, r * 0.25 * rng.range(-0.5, 1), rng.range(-0.15, 0.15) * size),
        // Flattened, a little longer along the cloud.
        scale: new Vector3(r * 1.2, r * 0.7, r),
      });
    }
    return { at, puffs };
  }

  /** Every frame: the clouds drift with the wind and wrap around. */
  update(dt: number): void {
    for (const cloud of this.clouds) {
      cloud.at.addScaledVector(this.wind, dt);
      if (cloud.at.x > this.half) cloud.at.x -= this.half * 2;
      else if (cloud.at.x < -this.half) cloud.at.x += this.half * 2;
      if (cloud.at.z > this.half) cloud.at.z -= this.half * 2;
      else if (cloud.at.z < -this.half) cloud.at.z += this.half * 2;
    }
    this.place();
  }

  private place(): void {
    let i = 0;
    for (const cloud of this.clouds) {
      // Shrinks away near the edge of the wrap square, so it never pops in or out.
      const edge = Math.max(Math.abs(cloud.at.x), Math.abs(cloud.at.z)) / this.half;
      const fade = Math.min(1, Math.max(0, (1 - edge) / 0.15));
      for (const puff of cloud.puffs) {
        position.copy(cloud.at).add(puff.offset);
        scale.copy(puff.scale).multiplyScalar(Math.max(0.001, fade));
        this.puffs.setMatrixAt(i++, matrix.compose(position, noTurn, scale));
      }
    }
    this.puffs.instanceMatrix.needsUpdate = true;
  }
}
