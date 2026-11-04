// Board shape math in board units (cm). No Three.js here.
import { BOARD, CASTLE } from '../config/game.js';

const DEG = Math.PI / 180;

export const degToRad = (deg: number): number => deg * DEG;

/** Board surface height at a distance from the center (cm). */
export function boardHeight(r: number): number {
  return Math.max(0, r - BOARD.flatTo) * BOARD.rise;
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

/** Ground height where a dropped thing lands (cm), or null if it falls off. */
export function landingHeight(r: number): number | null {
  switch (zoneAt(r)) {
    case 'courtyard':
      return 0;
    case 'wallTop':
      return CASTLE.wallHeight;
    case 'field':
      return boardHeight(r);
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
