// Board shape math in board units (cm). No Three.js here.
import { BOARD, CASTLE } from '../config/game.js';

const DEG = Math.PI / 180;

export const degToRad = (deg: number): number => deg * DEG;

/** The board's smooth slope at a distance from the center (cm), without the bumps. Roads and camps sit on it. */
export function boardHeight(r: number): number {
  return Math.max(0, r - BOARD.flatTo) * BOARD.rise;
}

/** Bump height on top of the slope at a board point (cm). Smooth until the terrain sets it. */
let bumps: (x: number, z: number) => number = () => 0;

/** Sets the board's bumps (src/world/terrain.ts, when the board is built). Tests keep the board smooth. */
export function setBumps(fn: (x: number, z: number) => number): void {
  bumps = fn;
}

/** Ground height at a board point (cm): the slope plus the bumps. Anything standing or landing in the field uses this. */
export function groundAt(x: number, z: number): number {
  return boardHeight(Math.hypot(x, z)) + bumps(x, z);
}

/**
 * Polar to board x and z (cm). Angle 0 is the front (-z), positive angles
 * go to the right (+x), seen from above.
 */
export function polarX(r: number, angleRad: number): number {
  return r * Math.sin(angleRad);
}
export function polarZ(r: number, angleRad: number): number {
  return -r * Math.cos(angleRad);
}

/** Angle of a board point, same convention as polarX and polarZ. */
export function angleOf(x: number, z: number): number {
  return Math.atan2(x, -z);
}

export type Zone = 'hole' | 'courtyard' | 'wallTop' | 'field' | 'off';

/** Which part of the board a distance from the center falls in. */
export function zoneAt(r: number): Zone {
  if (r < BOARD.holeRadius) return 'hole';
  if (r < CASTLE.wallIn) return 'courtyard';
  if (r <= CASTLE.wallOut) return 'wallTop';
  if (r <= BOARD.outerRadius) return 'field';
  return 'off';
}

/** Ground height where a dropped thing lands at a board point (cm), or null if it falls off. */
export function landingHeight(x: number, z: number): number | null {
  switch (zoneAt(Math.hypot(x, z))) {
    case 'courtyard':
      return 0;
    case 'wallTop':
      return CASTLE.wallHeight;
    case 'field':
      return groundAt(x, z);
    default:
      return null;
  }
}

/**
 * The nearest board angle (radians) to `angle` that keeps at least
 * CASTLE.towerClearDeg away from every wall tower, so a climber there is
 * clearly in view between two towers, never inside one.
 */
export function clearOfTowers(angle: number): number {
  const step = 360 / CASTLE.towerCount;
  const clear = CASTLE.towerClearDeg;
  const deg = angle / DEG;
  // Offset from the nearest tower, in degrees from -step/2 to step/2.
  let fromTower = (deg - CASTLE.towerStartDeg) % step;
  if (fromTower > step / 2) fromTower -= step;
  if (fromTower < -step / 2) fromTower += step;
  if (Math.abs(fromTower) >= clear) return angle;
  const shift = (fromTower >= 0 ? clear : -clear) - fromTower;
  return (deg + shift) * DEG;
}

/** Shortest signed difference between two angles (radians). */
export function angleDelta(from: number, to: number): number {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * The stretch of rampart between the two towers around a board angle
 * (radians), kept CASTLE.towerClearDeg away from each tower: [from, to],
 * with `from` at most `angle` and `to` at least it, so it never wraps.
 */
export function towerGap(angle: number): [number, number] {
  const step = 360 / CASTLE.towerCount;
  const deg = angle / DEG;
  const k = Math.floor((deg - CASTLE.towerStartDeg) / step);
  const lo = CASTLE.towerStartDeg + k * step + CASTLE.towerClearDeg;
  const hi = CASTLE.towerStartDeg + (k + 1) * step - CASTLE.towerClearDeg;
  return [Math.min(lo, deg) * DEG, Math.max(hi, deg) * DEG];
}
