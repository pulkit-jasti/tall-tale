// Holding a tool in a fist the way it is held in real life (HOLD in config,
// docs/controls-and-ui.md "Holding a tool"). The handle runs through the
// fist's hole, leaning forward from the knuckle line a little (HOLD.tiltDeg)
// like a handle lying across the palm, so the tool sticks out past the thumb,
// and its front faces where its pose says (out of the palm, or the way the
// knuckles point). Tools are built along +y from the end the hand holds.
import { Matrix4, Vector3 } from 'three';
import { HOLD } from '../config/game.js';
import type { HandState } from './hands.js';

export type HoldName = keyof typeof HOLD.poses;

const x = new Vector3();
const y = new Vector3();
const z = new Vector3();
const ahead = new Vector3();
const position = new Vector3();
const size = new Vector3();

/** How far a tool leans forward from the knuckle line (radians): its own tiltDeg, or the shared one. */
export function holdTilt(name: HoldName): number {
  return ((HOLD.poses[name].tiltDeg ?? HOLD.tiltDeg) * Math.PI) / 180;
}

/**
 * The world matrix of a tool held in this fist. `cmToWorld` is the world
 * size of one of the tool's own cm (0.01 times the board size, since the
 * tools live in boardLift).
 */
export function holdMatrix(hand: HandState, name: HoldName, cmToWorld: number, out: Matrix4): Matrix4 {
  const pose = HOLD.poses[name];
  // The handle leans forward from the knuckle line by HOLD.tiltDeg (turned
  // around the palm's normal), like a real handle lying across the palm.
  const tilt = holdTilt(name);
  y.copy(hand.rod).multiplyScalar(Math.cos(tilt)).addScaledVector(hand.forward, Math.sin(tilt));
  ahead.copy(hand.forward).multiplyScalar(Math.cos(tilt)).addScaledVector(hand.rod, -Math.sin(tilt));
  if (pose.face === 'palm') z.copy(hand.palmNormal);
  else z.copy(ahead).negate();
  x.crossVectors(y, z);
  // The fist holds the handle `at` cm from its end, so the end sits that far below the thumb side.
  position.copy(hand.gripPoint).addScaledVector(y, -pose.at * cmToWorld);
  out.makeBasis(x, y, z).scale(size.setScalar(cmToWorld)).setPosition(position);
  return out;
}
