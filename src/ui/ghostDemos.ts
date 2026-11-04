// Ghost hand demonstrations for the tutorial lessons (Meta's onboarding
// guidance: loop a see-through 3D hand doing the gesture until the player does
// it). Plain data, no Three.js. Follow the "Ghost hand demos" rules in
// AGENTS.md: every key says exactly where the hand is and how it is turned.
//
// Directions and offsets use the anchor's own frame, seen from the seat:
// [right, up, forward], where forward points level from the player's head
// toward the anchor (for a demo with frame 'shot': along the slingshot's shot).
// Offsets are in cm.
//
// How the hand is turned, in one of two ways:
//   rod:     a fist or open hand around a bar (ring, slingshot handle). The
//            bar runs through the fist along the knuckles. `rod` is the bar's
//            direction toward the thumb side, `palm` where the palm faces.
//   fingers: a pinch. `fingers` is where the fingers point (wrist to
//            knuckles), `palm` where the palm faces.
// The contact point is the fist's hole for rod keys and the pinch tips for
// pinch keys, so it is placed exactly on the anchor and never inside an object.

export type GhostPose = 'open' | 'pinch' | 'fist';

export type GhostAnchor = 'ring' | 'lessonGoblin' | 'mouth' | 'slingHandle' | 'pebbles' | 'pouch';

export type Dir = [number, number, number];

export interface GhostKey {
  /** Seconds from the start of the loop. */
  t: number;
  at: GhostAnchor;
  /** cm along [right, up, forward] from the anchor. */
  offset: Dir;
  pose: GhostPose;
  rod?: Dir;
  fingers?: Dir;
  palm: Dir;
  /** Ring only: degrees along the ring from the front (positive to the right). */
  arcDeg?: number;
}

export interface GhostDemo {
  hand: 'left' | 'right';
  /** 'view' (default): forward is from the head to each anchor. 'shot': forward is the slingshot's shot direction. */
  frame?: 'view' | 'shot';
  keys: GhostKey[];
}

// Grips used by the demos.
/** Right hand over the ring from above: knuckles along the rail, thumb to the left, palm down and a little forward. */
const RING_GRIP = { rod: [-1, 0, 0] as Dir, palm: [0, -1, 0.25] as Dir };
/** Right hand around the upright slingshot handle: thumb up, palm facing in (left) and a bit forward. */
const HANDLE_GRIP = { rod: [0, 1, 0] as Dir, palm: [-1, 0, 0.35] as Dir };
/** Pinch from above: fingers down and forward, palm down and toward the player. */
const PINCH_DOWN = { fingers: [0, -0.8, 0.6] as Dir, palm: [0, -0.6, -0.8] as Dir };
/** Left hand pinching the pouch from behind, like a bow string: fingers along the shot, palm facing in (right). */
const PULL_GRIP = { fingers: [0, 0, 1] as Dir, palm: [1, 0, 0] as Dir };
/** Bringing food to the mouth: fingers toward the face, thumb up, palm facing in. Never toward the headset (Quest menu). */
const MOUTH_GRIP = { fingers: [0, 0.25, -1] as Dir, palm: [-1, 0, 0] as Dir };

type Grip = { rod?: Dir; fingers?: Dir; palm: Dir };
const key = (t: number, at: GhostAnchor, offset: Dir, pose: GhostPose, grip: Grip, arcDeg?: number): GhostKey => ({
  t,
  at,
  offset,
  pose,
  ...grip,
  arcDeg,
});

export const GHOST_DEMOS = {
  /** Come down onto the ring from above, close the fist, follow the ring to the left, let go, lift off. */
  spin: {
    hand: 'right',
    keys: [
      key(0, 'ring', [0, 7, -3], 'open', RING_GRIP, 12),
      key(0.7, 'ring', [0, 0, 0], 'open', RING_GRIP, 12),
      key(1.0, 'ring', [0, 0, 0], 'fist', RING_GRIP, 12),
      // 50 degrees along the ring, most of the lesson's spin goal in one pull.
      key(2.3, 'ring', [0, 0, 0], 'fist', RING_GRIP, -38),
      key(2.6, 'ring', [0, 0, 0], 'open', RING_GRIP, -38),
      key(3.1, 'ring', [0, 7, -3], 'open', RING_GRIP, -38),
    ],
  },
  /** Close the fist on the ring, move it up, then down, let go. */
  height: {
    hand: 'right',
    keys: [
      key(0, 'ring', [0, 7, -3], 'open', RING_GRIP, 6),
      key(0.7, 'ring', [0, 0, 0], 'open', RING_GRIP, 6),
      key(1.0, 'ring', [0, 0, 0], 'fist', RING_GRIP, 6),
      key(1.8, 'ring', [0, 7, 0], 'fist', RING_GRIP, 6),
      key(2.8, 'ring', [0, -3, 0], 'fist', RING_GRIP, 6),
      key(3.1, 'ring', [0, -3, 0], 'open', RING_GRIP, 6),
      key(3.6, 'ring', [0, 5, -3], 'open', RING_GRIP, 6),
    ],
  },
  /** Come down over the goblin, pinch it, lift it. */
  pinchGoblin: {
    hand: 'right',
    keys: [
      key(0, 'lessonGoblin', [0, 9, -5], 'open', PINCH_DOWN),
      key(0.8, 'lessonGoblin', [0, 0, 0], 'open', PINCH_DOWN),
      key(1.1, 'lessonGoblin', [0, 0, 0], 'pinch', PINCH_DOWN),
      key(2.0, 'lessonGoblin', [0, 9, -5], 'pinch', PINCH_DOWN),
    ],
  },
  /** Carry the pinched goblin up to the mouth, turning the hand thumb up, and hold it there. */
  eat: {
    hand: 'right',
    keys: [
      key(0, 'lessonGoblin', [0, 0, 0], 'pinch', PINCH_DOWN),
      key(1.4, 'mouth', [0, 0, 0], 'pinch', MOUTH_GRIP),
      key(2.6, 'mouth', [0, 0, 0], 'pinch', MOUTH_GRIP),
    ],
  },
  /** Come in from the right and behind, close the fist around the handle, lift the slingshot. */
  slingGrab: {
    hand: 'right',
    keys: [
      key(0, 'slingHandle', [5, 1, -6], 'open', HANDLE_GRIP),
      key(0.8, 'slingHandle', [0, 0, 0], 'open', HANDLE_GRIP),
      key(1.1, 'slingHandle', [0, 0, 0], 'fist', HANDLE_GRIP),
      key(2.0, 'slingHandle', [0, 6, -4], 'fist', HANDLE_GRIP),
    ],
  },
  /** The other hand comes down into the bowl and pinches a pebble off the top of the pile. */
  pebble: {
    hand: 'left',
    keys: [
      key(0, 'pebbles', [0, 9, -2], 'open', PINCH_DOWN),
      key(0.8, 'pebbles', [0, 0, 0], 'open', PINCH_DOWN),
      key(1.1, 'pebbles', [0, 0, 0], 'pinch', PINCH_DOWN),
      key(1.9, 'pebbles', [0, 9, -2], 'pinch', PINCH_DOWN),
    ],
  },
  /** Lift the pebble out of the bowl, bring it to the pouch from the player's side (clear of the fork), let go. */
  load: {
    hand: 'left',
    keys: [
      key(0, 'pebbles', [0, 0, 0], 'pinch', PINCH_DOWN),
      key(0.5, 'pebbles', [0, 9, -3], 'pinch', PINCH_DOWN),
      key(1.3, 'pouch', [0, 1, -6], 'pinch', PINCH_DOWN),
      key(1.7, 'pouch', [0, 1, 0], 'pinch', PINCH_DOWN),
      key(2.0, 'pouch', [0, 1, 0], 'open', PINCH_DOWN),
      key(2.4, 'pouch', [0, 6, -4], 'open', PINCH_DOWN),
    ],
  },
  /** Come up behind the pouch, pinch it, pull straight back along the shot, let go. */
  shoot: {
    hand: 'left',
    frame: 'shot',
    keys: [
      key(0, 'pouch', [-3, 3, -7], 'open', PULL_GRIP),
      key(0.7, 'pouch', [0, 0, 0], 'open', PULL_GRIP),
      key(1.0, 'pouch', [0, 0, 0], 'pinch', PULL_GRIP),
      key(2.0, 'pouch', [0, 0, -14], 'pinch', PULL_GRIP),
      key(2.2, 'pouch', [0, 0, -14], 'open', PULL_GRIP),
    ],
  },
} satisfies Record<string, GhostDemo>;

export type GhostDemoName = keyof typeof GHOST_DEMOS;

/** Where a demo ends: the ghost steps aside while the player's own hand is there. */
export function endAnchor(name: GhostDemoName): GhostAnchor {
  const keys: GhostKey[] = GHOST_DEMOS[name].keys;
  return keys[keys.length - 1].at;
}
