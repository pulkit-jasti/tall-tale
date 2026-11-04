// Ghost hand demonstrations for the tutorial lessons (Meta's onboarding
// guidance: loop a see-through 3D hand doing the gesture until the player does
// it). Plain data, no Three.js: each demo is a few keyframes the ghost hand
// moves through, then it fades and loops.
//
// Offsets are in cm from an anchor point, along [right, up, toward the
// player], as seen from the seat. Anchors are filled in by the battle each
// frame: the ring front, the lesson goblin, the mouth, slingshot parts.

export type GhostPose = 'open' | 'pinch' | 'fist';

export type GhostAnchor = 'ring' | 'lessonGoblin' | 'mouth' | 'slingHandle' | 'bowl' | 'pouch';

export interface GhostKey {
  /** Seconds from the start of the loop. */
  t: number;
  at: GhostAnchor;
  offset: [number, number, number];
  pose: GhostPose;
}

export interface GhostDemo {
  hand: 'left' | 'right';
  /** Roll of the hand around its pointing direction (degrees): 0 = palm down. */
  rollDeg?: number;
  keys: GhostKey[];
}

const key = (t: number, at: GhostAnchor, offset: [number, number, number], pose: GhostPose): GhostKey => ({ t, at, offset, pose });

export const GHOST_DEMOS = {
  /** Reach the ring, close the fist, pull it sideways, let go. */
  spin: {
    hand: 'right',
    keys: [
      key(0, 'ring', [4, 10, 8], 'open'),
      key(0.7, 'ring', [4, 0, 0], 'open'),
      key(1.0, 'ring', [4, 0, 0], 'fist'),
      key(2.0, 'ring', [-12, 0, 0], 'fist'),
      key(2.3, 'ring', [-12, 0, 0], 'open'),
      key(2.8, 'ring', [-12, 8, 6], 'open'),
    ],
  },
  /** Close the fist on the ring, move it up, then down. */
  height: {
    hand: 'right',
    keys: [
      key(0, 'ring', [4, 10, 8], 'open'),
      key(0.7, 'ring', [4, 0, 0], 'open'),
      key(1.0, 'ring', [4, 0, 0], 'fist'),
      key(1.8, 'ring', [4, 8, 0], 'fist'),
      key(2.7, 'ring', [4, -4, 0], 'fist'),
      key(3.0, 'ring', [4, -4, 0], 'open'),
      key(3.5, 'ring', [4, 6, 8], 'open'),
    ],
  },
  /** Reach the goblin, pinch it, lift it. */
  pinchGoblin: {
    hand: 'right',
    keys: [
      key(0, 'lessonGoblin', [0, 12, 10], 'open'),
      key(0.8, 'lessonGoblin', [0, 0, 0], 'open'),
      key(1.1, 'lessonGoblin', [0, 0, 0], 'pinch'),
      key(2.0, 'lessonGoblin', [0, 10, 8], 'pinch'),
    ],
  },
  /** Carry the pinched goblin up to the mouth and hold it there. */
  eat: {
    hand: 'right',
    keys: [
      key(0, 'lessonGoblin', [0, 6, 4], 'pinch'),
      key(1.4, 'mouth', [0, 0, 0], 'pinch'),
      key(2.6, 'mouth', [0, 0, 0], 'pinch'),
    ],
  },
  /** Close the fist on the slingshot handle and lift it. */
  slingGrab: {
    hand: 'right',
    keys: [
      key(0, 'slingHandle', [0, 8, 10], 'open'),
      key(0.8, 'slingHandle', [0, 0, 0], 'open'),
      key(1.1, 'slingHandle', [0, 0, 0], 'fist'),
      key(2.0, 'slingHandle', [0, 6, 6], 'fist'),
    ],
  },
  /** The other hand pinches a pebble from the bowl. */
  pebble: {
    hand: 'left',
    keys: [
      key(0, 'bowl', [0, 10, 6], 'open'),
      key(0.8, 'bowl', [0, 0, 0], 'open'),
      key(1.1, 'bowl', [0, 0, 0], 'pinch'),
      key(1.9, 'bowl', [0, 8, 2], 'pinch'),
    ],
  },
  /** Carry the pebble from the bowl to the pouch, then let go. */
  load: {
    hand: 'left',
    keys: [
      key(0, 'bowl', [0, 2, 0], 'pinch'),
      key(0.4, 'bowl', [0, 8, 2], 'pinch'),
      key(1.4, 'pouch', [0, 0, 0], 'pinch'),
      key(1.8, 'pouch', [0, 0, 0], 'open'),
      key(2.2, 'pouch', [-2, 4, 6], 'open'),
    ],
  },
  /** Pinch the pouch, pull it back toward the player, let go. */
  shoot: {
    hand: 'left',
    rollDeg: 60,
    keys: [
      key(0, 'pouch', [-4, 4, 8], 'open'),
      key(0.7, 'pouch', [0, 0, 0], 'open'),
      key(1.0, 'pouch', [0, 0, 0], 'pinch'),
      key(2.0, 'pouch', [0, -2, 14], 'pinch'),
      key(2.2, 'pouch', [0, -2, 14], 'open'),
    ],
  },
} satisfies Record<string, GhostDemo>;

export type GhostDemoName = keyof typeof GHOST_DEMOS;

/** Where a demo ends: the ghost steps aside while the player's own hand is there. */
export function endAnchor(name: GhostDemoName): GhostAnchor {
  const keys: GhostKey[] = GHOST_DEMOS[name].keys;
  return keys[keys.length - 1].at;
}
