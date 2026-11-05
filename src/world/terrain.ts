// The uneven low-poly ground (TERRAIN in config): rolling hills and dips on
// top of the board's slope. Flat around the castle, at the camps and under the villages and fields, small
// near the castle and big far out. The roads ride over the hills (a little
// softened), so goblins can disappear behind a hill and pop up again.
//
// The terrain builds the ground mesh's points itself (rings of nudged points,
// each quad split along a random diagonal, so no rings or grid show) and
// answers the ground height at any board point from those same flat
// triangles. Everything that stands or lands on the ground (units on roads,
// tossed goblins, pebbles, debris, the swatter, decor) reads it through
// groundAt() in src/rules/boardMath.ts, so nothing floats or sinks, even on
// steep facets.
import { BufferGeometry, Color, Float32BufferAttribute, Vector3 } from 'three';
import { BOARD, ROADS, TERRAIN } from '../config/game.js';
import { boardHeight, polarX, polarZ, setBumps } from '../rules/boardMath.js';
import type { Random } from '../rules/random.js';
import type { Road } from './roads.js';

/** A camp's middle and size (board cm). The ground is flat there, with dirt around it. */
export interface CampSpot {
  x: number;
  z: number;
  size: number;
}

const TWO_PI = Math.PI * 2;

/** 0 below `from`, 1 above `to`, smooth in between. */
export function smooth(from: number, to: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

/** How far past the nearest camp's edge a board point is (cm, negative inside it). */
export function campDistance(camps: CampSpot[], x: number, z: number): number {
  let best = Infinity;
  for (const c of camps) best = Math.min(best, Math.hypot(c.x - x, c.z - z) - c.size);
  return best;
}

/**
 * Distance to the nearest road's center line, looked up from a grid filled
 * once at load (asking every road each time would be far too slow for
 * thousands of points). Only near distances are kept: far from every road
 * it says FAR.
 */
export class RoadField {
  static readonly FAR = 99;
  private readonly cell = 4;
  private readonly size: number;
  private readonly half = BOARD.outerRadius;
  private readonly field: Float32Array;

  constructor(roads: Road[], reach: number) {
    this.size = Math.ceil((this.half * 2) / this.cell);
    this.field = new Float32Array(this.size * this.size).fill(RoadField.FAR);
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

export class Terrain {
  private readonly noise: (x: number, z: number) => number;
  /** Ring radii before the nudge (cm), and points around each ring. */
  private readonly radii: number[] = [];
  private readonly segments = TERRAIN.segments;
  /** The ground mesh's points (board cm), ring by ring. */
  private readonly px: Float32Array;
  private readonly py: Float32Array;
  private readonly pz: Float32Array;
  /** Which diagonal splits each quad (1 = the other one). */
  private readonly flip: Uint8Array;

  /**
   * `roads` must reach at least TERRAIN.roadFade past a road's edge. `flats`
   * are the spots kept flat (the camps, the villages and their fields).
   */
  constructor(
    readonly roads: RoadField,
    private readonly flats: CampSpot[],
    rng: Random,
  ) {
    this.noise = valueNoise(rng.int(0x7fffffff));
    for (let r = BOARD.holeRadius; r < BOARD.outerRadius; ) {
      this.radii.push(r);
      r += r < 120 ? TERRAIN.ringStepNear : r < 300 ? TERRAIN.ringStepMid : TERRAIN.ringStepFar;
    }
    this.radii.push(BOARD.outerRadius);
    const count = this.radii.length * this.segments;
    this.px = new Float32Array(count);
    this.py = new Float32Array(count);
    this.pz = new Float32Array(count);
    this.flip = new Uint8Array(count);
    const last = this.radii.length - 1;
    this.radii.forEach((ringR, i) => {
      // The hole's edge and the outer edge stay round, so they meet the skirts.
      const edgeRing = i === 0 || i === last;
      const step = edgeRing ? 0 : Math.min(ringR - this.radii[i - 1], this.radii[i + 1] - ringR);
      const nudge = edgeRing ? 0 : TERRAIN.jitter;
      for (let j = 0; j < this.segments; j++) {
        const a = ((j + rng.range(-nudge, nudge)) / this.segments) * TWO_PI;
        const r = ringR + rng.range(-nudge, nudge) * step;
        const at = i * this.segments + j;
        const x = polarX(r, a);
        const z = polarZ(r, a);
        this.px[at] = x;
        this.pz[at] = z;
        this.py[at] = boardHeight(r) + this.bump(x, z);
        this.flip[at] = rng.next() < 0.5 ? 0 : 1;
      }
    });
    setBumps((x, z) => this.heightAt(x, z) - boardHeight(Math.hypot(x, z)));
  }

  /** Hill height before the masks at a distance from the center (cm): small near, big far, none at the edges. */
  amplitude(r: number): number {
    const grow = smooth(TERRAIN.flatUntil, TERRAIN.rampTo, r);
    const far = Math.max(0, (r - TERRAIN.rampTo) / (BOARD.outerRadius - TERRAIN.rampTo));
    const edge = 1 - smooth(TERRAIN.edgeFadeFrom, TERRAIN.edgeFadeTo, r);
    return (TERRAIN.nearHeight + (TERRAIN.farHeight - TERRAIN.nearHeight) * far) * grow * edge;
  }

  /** The hill or dip at a board point (cm above or below the slope), from the noise, softened on roads and flat at camps. */
  bump(x: number, z: number): number {
    const height = this.amplitude(Math.hypot(x, z));
    if (height <= 0) return 0;
    const edge = ROADS.width / 2;
    const road = smooth(edge + TERRAIN.roadFlat, edge + TERRAIN.roadFade, this.roads.distance(x, z));
    const roadMask = TERRAIN.roadKeep + (1 - TERRAIN.roadKeep) * road;
    const campMask = smooth(TERRAIN.campFlat, TERRAIN.campFade, campDistance(this.flats, x, z));
    if (campMask <= 0) return 0;
    const [big, small] = TERRAIN.sizes;
    const share = TERRAIN.smallShare;
    const n = this.noise(x / big, z / big) * (1 - share) + this.noise(x / small + 41.7, z / small - 13.1) * share;
    return height * (n * (1 + TERRAIN.dipShare) - TERRAIN.dipShare) * roadMask * campMask;
  }

  /** Ground height at a board point (cm), exactly on the ground mesh's flat triangles. */
  heightAt(x: number, z: number): number {
    const r = Math.hypot(x, z);
    const last = this.radii.length - 1;
    if (r <= this.radii[0] || r >= this.radii[last]) return boardHeight(r);
    // The ring just inside the point (before the nudge), found by halving.
    let lo = 0;
    let hi = last;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.radii[mid] <= r) lo = mid;
      else hi = mid;
    }
    let a = Math.atan2(x, -z);
    if (a < 0) a += TWO_PI;
    const j = Math.floor((a / TWO_PI) * this.segments);
    // The nudge can move the point into a neighbouring quad.
    for (const di of [0, -1, 1]) {
      const i = lo + di;
      if (i < 0 || i >= last) continue;
      for (const dj of [0, -1, 1]) {
        const h = this.inQuad(i, (j + dj + this.segments) % this.segments, x, z);
        if (h !== null) return h;
      }
    }
    return boardHeight(r) + this.bump(x, z);
  }

  /**
   * The ground mesh: every triangle with its own three points, so each gets
   * one solid color (the low-poly look), picked from its middle and how
   * steep it is (0 = flat, 1 = a wall).
   */
  geometry(faceColor: (x: number, z: number, r: number, steepness: number, out: Color) => Color): BufferGeometry {
    const triangles = (this.radii.length - 1) * this.segments * 2;
    const positions = new Float32Array(triangles * 9);
    const colors = new Float32Array(triangles * 9);
    const color = new Color();
    let k = 0;
    for (let i = 0; i < this.radii.length - 1; i++) {
      for (let j = 0; j < this.segments; j++) {
        const t = this.quad(i, j);
        for (let n = 0; n < 6; n += 3) {
          const [p, q, s] = [t[n], t[n + 1], t[n + 2]];
          // How far the face leans from flat, from its normal.
          const ux = this.px[q] - this.px[p];
          const uy = this.py[q] - this.py[p];
          const uz = this.pz[q] - this.pz[p];
          const vx = this.px[s] - this.px[p];
          const vy = this.py[s] - this.py[p];
          const vz = this.pz[s] - this.pz[p];
          const nx = uy * vz - uz * vy;
          const ny = uz * vx - ux * vz;
          const nz = ux * vy - uy * vx;
          const steepness = 1 - Math.abs(ny) / (Math.hypot(nx, ny, nz) || 1);
          const cx = (this.px[p] + this.px[q] + this.px[s]) / 3;
          const cz = (this.pz[p] + this.pz[q] + this.pz[s]) / 3;
          faceColor(cx, cz, Math.hypot(cx, cz), steepness, color);
          for (const v of [p, q, s]) {
            positions.set([this.px[v], this.py[v], this.pz[v]], k);
            colors.set([color.r, color.g, color.b], k);
            k += 3;
          }
        }
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    return geometry;
  }

  /** The two triangles of a quad (point indices, counter clockwise seen from above). */
  private quad(i: number, j: number): number[] {
    const s = this.segments;
    const a = i * s + j;
    const b = (i + 1) * s + j;
    const c = i * s + ((j + 1) % s);
    const d = (i + 1) * s + ((j + 1) % s);
    return this.flip[a] === 0 ? [a, c, b, c, d, b] : [a, d, b, a, c, d];
  }

  private inQuad(i: number, j: number, x: number, z: number): number | null {
    const t = this.quad(i, j);
    return this.inTriangle(t[0], t[1], t[2], x, z) ?? this.inTriangle(t[3], t[4], t[5], x, z);
  }

  /** Height inside a triangle at a board point, or null when the point is outside it. */
  private inTriangle(p: number, q: number, s: number, x: number, z: number): number | null {
    const x0 = this.px[p];
    const z0 = this.pz[p];
    const x1 = this.px[q];
    const z1 = this.pz[q];
    const x2 = this.px[s];
    const z2 = this.pz[s];
    const den = (z1 - z2) * (x0 - x2) + (x2 - x1) * (z0 - z2);
    if (Math.abs(den) < 1e-9) return null;
    const w0 = ((z1 - z2) * (x - x2) + (x2 - x1) * (z - z2)) / den;
    const w1 = ((z2 - z0) * (x - x2) + (x0 - x2) * (z - z2)) / den;
    const w2 = 1 - w0 - w1;
    const slack = -1e-4;
    if (w0 < slack || w1 < slack || w2 < slack) return null;
    return w0 * this.py[p] + w1 * this.py[q] + w2 * this.py[s];
  }
}
