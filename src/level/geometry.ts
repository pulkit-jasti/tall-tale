// Small polar and flat helpers for the level generator and its checks.
// Polar spots are [cm from the middle, degrees], 0 = front, positive to the
// right (src/rules/blueprint.ts). No Three.js here.
import { degToRad, polarX, polarZ } from '../rules/boardMath.js';
import type { Polar } from '../rules/blueprint.js';

export interface Flat {
  x: number;
  z: number;
}

/** An angle into (-180, 180]. */
export function wrapDeg(a: number): number {
  const w = (((a + 180) % 360) + 360) % 360 - 180;
  return w === -180 ? 180 : w;
}

/** The shortest turn from `from` to `to` (degrees, -180 to 180). */
export function turnDeg(from: number, to: number): number {
  return wrapDeg(to - from);
}

export function flat([r, deg]: Polar): Flat {
  const a = degToRad(deg);
  return { x: polarX(r, a), z: polarZ(r, a) };
}

export function polar(p: Flat): Polar {
  return [Math.hypot(p.x, p.z), (Math.atan2(p.x, -p.z) * 180) / Math.PI];
}

/** Rounded to 0.1 so level files stay short and diff well. */
export function tidy([r, a]: Polar): Polar {
  return [Math.round(r * 10) / 10, Math.round(wrapDeg(a) * 10) / 10];
}

export function distance(a: Polar, b: Polar): number {
  const p = flat(a);
  const q = flat(b);
  return Math.hypot(p.x - q.x, p.z - q.z);
}

/** Flat distance from a point to the segment a to b (cm). */
export function segmentDistance(p: Flat, a: Flat, b: Flat): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len2 = dx * dx + dz * dz;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.z - (a.z + t * dz));
}

/** Flat distance from a point to a polyline (cm). */
export function lineDistance(p: Polar, line: Polar[]): number {
  const q = flat(p);
  let best = Infinity;
  for (let i = 1; i < line.length; i++) best = Math.min(best, segmentDistance(q, flat(line[i - 1]), flat(line[i])));
  return best;
}

export function lineLength(line: Polar[]): number {
  let length = 0;
  for (let i = 1; i < line.length; i++) length += distance(line[i - 1], line[i]);
  return length;
}

/** The spot `share` of the way along a polyline (0 its start, 1 its end), and the index of the point after it. */
export function pointAlong(line: Polar[], share: number): { at: Polar; next: number } {
  const total = lineLength(line);
  let left = Math.max(0, Math.min(1, share)) * total;
  for (let i = 1; i < line.length; i++) {
    const step = distance(line[i - 1], line[i]);
    if (left <= step || i === line.length - 1) {
      const t = step > 0 ? Math.min(1, left / step) : 0;
      const a = flat(line[i - 1]);
      const b = flat(line[i]);
      return { at: polar({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }), next: i };
    }
    left -= step;
  }
  return { at: line[line.length - 1], next: line.length - 1 };
}

/** The circular middle of some angles (degrees). */
export function meanDeg(angles: number[]): number {
  let x = 0;
  let z = 0;
  for (const a of angles) {
    x += Math.sin(degToRad(a));
    z += Math.cos(degToRad(a));
  }
  return (Math.atan2(x, z) * 180) / Math.PI;
}
