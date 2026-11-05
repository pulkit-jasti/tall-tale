// The grass on the board (decor only, no gameplay):
//   - Meadow: the ground's color at any board spot: soft light and dark
//     patches (smooth noise), darker right by the wall, worn and yellower
//     along the roads, dirty around the camps. The board mesh bakes it into
//     its points, so it costs nothing per frame.
//   - addGrain: a faint fine grain on the ground up close (a few lines in the
//     board's shader), fading out far away so it never shimmers.
//   - buildGrassTufts: thousands of tiny low-poly tufts (3 thin blades each)
//     and some flowers on top of them, one instanced mesh each, in clumps
//     and off the roads and camps. Their normals point up, so they light like
//     the ground they grow on, and they take the ground's color at their spot.
// All in boardSpin (cm), so it turns with the board.
import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  OctahedronGeometry,
  Quaternion,
  Vector3,
} from 'three';
import { BOARD, CASTLE, GRASS, ROADS } from '../config/game.js';
import { boardHeight, polarX, polarZ } from '../rules/boardMath.js';
import type { Random } from '../rules/random.js';
import type { Road } from './roads.js';

/** A camp's middle and size (board cm), for the dirt around it and to keep tufts off it. */
export interface CampSpot {
  x: number;
  z: number;
  size: number;
}

const UP = new Vector3(0, 1, 0);
const matrix = new Matrix4();
const position = new Vector3();
const scale = new Vector3();
const turn = new Quaternion();

/** 0 below `from`, 1 above `to`, smooth in between. */
function smooth(from: number, to: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

/**
 * Distance to the nearest road's center line, looked up from a grid filled
 * once at load (asking every road each time would be far too slow for
 * thousands of spots). Only near distances are kept: far from every road it
 * says FAR.
 */
class RoadField {
  static readonly FAR = 99;
  private readonly cell = 4;
  private readonly size: number;
  private readonly half = BOARD.outerRadius;
  private readonly field: Float32Array;

  constructor(roads: Road[]) {
    this.size = Math.ceil((this.half * 2) / this.cell);
    this.field = new Float32Array(this.size * this.size).fill(RoadField.FAR);
    const reach = ROADS.width / 2 + Math.max(GRASS.wornWidth, GRASS.roadClear) + this.cell;
    const p = new Vector3();
    for (const road of roads) {
      const steps = Math.ceil(road.length / 2);
      for (let i = 0; i <= steps; i++) {
        road.curve.getPoint(i / steps, p);
        const i0 = this.index(p.x - reach);
        const i1 = this.index(p.x + reach);
        const j0 = this.index(p.z - reach);
        const j1 = this.index(p.z + reach);
        for (let j = j0; j <= j1; j++) {
          for (let k = i0; k <= i1; k++) {
            const d = Math.hypot(this.middle(k) - p.x, this.middle(j) - p.z);
            const at = j * this.size + k;
            if (d < this.field[at]) this.field[at] = d;
          }
        }
      }
    }
  }

  distance(x: number, z: number): number {
    return this.field[this.index(z) * this.size + this.index(x)];
  }

  private index(v: number): number {
    return Math.min(this.size - 1, Math.max(0, Math.floor((v + this.half) / this.cell)));
  }

  private middle(i: number): number {
    return (i + 0.5) * this.cell - this.half;
  }
}

/** Smooth value noise (0 to 1) from a seed: the same spot always gives the same value. */
function valueNoise(seed: number): (x: number, z: number) => number {
  const hash = (ix: number, iz: number): number => {
    let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ seed;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  return (x, z) => {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const fx = x - ix;
    const fz = z - iz;
    const u = fx * fx * (3 - 2 * fx);
    const v = fz * fz * (3 - 2 * fz);
    const top = hash(ix, iz) + (hash(ix + 1, iz) - hash(ix, iz)) * u;
    const bottom = hash(ix, iz + 1) + (hash(ix + 1, iz + 1) - hash(ix, iz + 1)) * u;
    return top + (bottom - top) * v;
  };
}

/** The ground's look at any board spot. */
export class Meadow {
  private readonly roads: RoadField;
  private readonly noise: (x: number, z: number) => number;
  private readonly dark = new Color(GRASS.darkColor);
  private readonly light = new Color(GRASS.lightColor);
  private readonly worn = new Color(GRASS.wornColor);
  private readonly dirt = new Color(GRASS.dirtColor);

  constructor(
    roads: Road[],
    private readonly camps: CampSpot[],
    rng: Random,
  ) {
    this.roads = new RoadField(roads);
    this.noise = valueNoise(rng.int(0x7fffffff));
  }

  /** 0 to 1: dark to light meadow, a big soft patch size and a smaller one on top. */
  patch(x: number, z: number): number {
    const [big, small] = GRASS.patchSizes;
    return this.noise(x / big, z / big) * 0.65 + this.noise(x / small + 71.3, z / small - 19.7) * 0.35;
  }

  /** Distance to the nearest road's center line (cm), or RoadField.FAR when none is near. */
  roadDistance(x: number, z: number): number {
    return this.roads.distance(x, z);
  }

  /** How far past the nearest camp's edge (cm, negative inside it). */
  campDistance(x: number, z: number): number {
    let best = Infinity;
    for (const c of this.camps) best = Math.min(best, Math.hypot(c.x - x, c.z - z) - c.size);
    return best;
  }

  /** The ground color at a board spot `r` cm from the center. */
  colorAt(x: number, z: number, r: number, out: Color): Color {
    out.copy(this.dark).lerp(this.light, this.patch(x, z));
    const half = ROADS.width / 2;
    out.lerp(this.worn, 0.85 * (1 - smooth(half, half + GRASS.wornWidth, this.roadDistance(x, z))));
    out.lerp(this.dirt, 0.8 * (1 - smooth(0, GRASS.dirtWidth, this.campDistance(x, z))));
    // A soft shadow on both sides of the wall.
    const fromWall = r < CASTLE.wallIn ? CASTLE.wallIn - r : Math.max(0, r - CASTLE.wallOut);
    out.multiplyScalar(1 - GRASS.wallShade * (1 - smooth(0, GRASS.wallShadeTo - CASTLE.wallOut, fromWall)));
    return out;
  }
}

const f = (v: number): string => v.toFixed(4);

/** A faint fine grain on the ground up close, fading out far away. */
export function addGrain(material: MeshStandardMaterial): void {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = 'varying vec3 vGrassAt;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n  vGrassAt = position;',
    );
    shader.fragmentShader =
      [
        'varying vec3 vGrassAt;',
        'float grassHash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }',
        'float grassNoise(vec2 p) {',
        '  vec2 i = floor(p); vec2 t = fract(p); t = t * t * (3.0 - 2.0 * t);',
        '  return mix(mix(grassHash(i), grassHash(i + vec2(1.0, 0.0)), t.x), mix(grassHash(i + vec2(0.0, 1.0)), grassHash(i + vec2(1.0, 1.0)), t.x), t.y);',
        '}',
      ].join('\n') +
      '\n' +
      shader.fragmentShader.replace(
        '#include <color_fragment>',
        [
          '#include <color_fragment>',
          `  float grassFade = 1.0 - smoothstep(${f(GRASS.grainFadeFrom)}, ${f(GRASS.grainFadeTo)}, length(vGrassAt.xz));`,
          `  diffuseColor.rgb *= 1.0 + (grassNoise(vGrassAt.xz / ${f(GRASS.grainSize)}) - 0.5) * ${f(GRASS.grain * 2)} * grassFade;`,
        ].join('\n'),
      );
  };
  material.customProgramCacheKey = () => 'board-grass-grain';
}

/**
 * One tuft (height 1): three thin blades leaning out, each two triangles back
 * to back, so it shows from every side without a double-sided material. The
 * normals point up, so it lights like the ground. Darker at the base,
 * brighter at the tips (vertex colors, times the ground color per tuft).
 */
function tuftGeometry(): BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const blades = 3;
  const width = 0.13;
  const lean = 0.32;
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI * 2 + i * 0.4;
    const dx = Math.sin(a);
    const dz = -Math.cos(a);
    // Base corners across the lean, a little out from the middle, and the tip.
    const bx = dx * 0.08;
    const bz = dz * 0.08;
    const left = [bx - dz * width, 0, bz + dx * width];
    const right = [bx + dz * width, 0, bz - dx * width];
    const tip = [dx * lean, 1, dz * lean];
    for (const tri of [
      [left, right, tip],
      [right, left, tip],
    ]) {
      for (const p of tri) {
        positions.push(...p);
        const s = p === tip ? GRASS.tipShade : GRASS.baseShade;
        colors.push(s, s, s);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(positions.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  return geometry;
}

/** The grass tufts and flowers, in clumps, off the roads and camps. Two draw calls. */
export function buildGrassTufts(meadow: Meadow, rng: Random): Group {
  const group = new Group();
  group.name = 'grass';
  const total = GRASS.tuftRings.reduce((sum, ring) => sum + ring.count, 0);
  const tufts = new InstancedMesh(
    tuftGeometry(),
    new MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }),
    total,
  );
  const color = new Color();
  const tops: Vector3[] = [];
  const clear = ROADS.width / 2 + GRASS.roadClear;
  let placed = 0;
  for (const ring of GRASS.tuftRings) {
    let inRing = 0;
    for (let tries = 0; inRing < ring.count && tries < ring.count * 6; tries++) {
      // Spread evenly over the ring's area, not bunched at its inner edge.
      const r = Math.sqrt(rng.range(ring.from * ring.from, ring.to * ring.to));
      const a = rng.range(0, Math.PI * 2);
      const x = polarX(r, a);
      const z = polarZ(r, a);
      // Clumps: more where the meadow is lush.
      if (rng.next() > 0.25 + 0.75 * meadow.patch(x, z)) continue;
      if (meadow.roadDistance(x, z) < clear || meadow.campDistance(x, z) < 3) continue;
      const height = rng.range(...ring.height);
      // Sunk a little, so the base never floats on the sloping board.
      position.set(x, boardHeight(r) - 0.05, z);
      turn.setFromAxisAngle(UP, rng.range(0, Math.PI * 2));
      scale.set(height, height * rng.range(0.85, 1.15), height);
      tufts.setMatrixAt(placed, matrix.compose(position, turn, scale));
      tufts.setColorAt(placed, meadow.colorAt(x, z, r, color).multiplyScalar(rng.range(0.92, 1.08)));
      tops.push(new Vector3(x, position.y + height * 0.95, z));
      placed++;
      inRing++;
    }
  }
  tufts.count = placed;
  tufts.instanceMatrix.needsUpdate = true;
  if (tufts.instanceColor) tufts.instanceColor.needsUpdate = true;
  tufts.computeBoundingSphere();

  // Flower heads: small flat gems on top of some tufts.
  const head = new OctahedronGeometry(0.5, 0);
  head.scale(1, 0.45, 1);
  const flowers = new InstancedMesh(head, new MeshStandardMaterial({ roughness: 0.8, metalness: 0 }), GRASS.flowerCount);
  const count = Math.min(GRASS.flowerCount, tops.length);
  for (let i = 0; i < count; i++) {
    const top = tops[rng.int(tops.length)];
    turn.setFromAxisAngle(UP, rng.range(0, Math.PI * 2));
    scale.setScalar(GRASS.flowerSize * rng.range(0.8, 1.2));
    flowers.setMatrixAt(i, matrix.compose(top, turn, scale));
    flowers.setColorAt(i, color.setHex(rng.pick(GRASS.flowerColors)));
  }
  flowers.count = count;
  flowers.instanceMatrix.needsUpdate = true;
  if (flowers.instanceColor) flowers.instanceColor.needsUpdate = true;
  flowers.computeBoundingSphere();
  group.add(tufts, flowers);
  return group;
}
