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
//
// Opposite hand (AGENTS.md): a tool on the player's right is grabbed with the
// left hand and one on the left with the right hand (bending a hand back
// toward its own side while looking at it is hard; a small twist of the body
// and the other hand is easy). The slingshot (right) is held in the left hand,
// so the pebble, the load and the pull are the right hand's.
import { SWATTER } from '../config/game.js';

export type GhostPose = 'open' | 'pinch' | 'fist';

export type GhostAnchor =
  | 'ring'
  | 'lessonGoblin'
  | 'mouth'
  | 'reach'
  | 'slingHandle'
  | 'pebbles'
  | 'pouch'
  | 'swatterHandle'
  | 'pepperHandle'
  | 'hornHandle'
  | 'bellHandle';

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
  /**
   * 'view' (default): forward is from the head to each anchor. 'shot':
   * forward is the slingshot's shot direction. 'aim': forward is from the
   * slingshot's pouch toward the lesson's target (the keg).
   */
  frame?: 'view' | 'shot' | 'aim';
  keys: GhostKey[];
}

// Grips used by the demos.
/** Right hand over the ring from above: knuckles along the rail, thumb to the left, palm down and a little forward. */
const RING_GRIP = { rod: [-1, 0, 0] as Dir, palm: [0, -1, 0.25] as Dir };
/**
 * Right hand reaching across to an upright handle on the left (the pepper
 * front left, the bell): thumb up, palm facing in (left) and a bit forward.
 */
const HANDLE_GRIP = { rod: [0, 1, 0] as Dir, palm: [-1, 0, 0.35] as Dir };
/**
 * Left hand reaching across to an upright handle on the right (the
 * slingshot, the horn): the mirror of HANDLE_GRIP. Thumb up, palm facing in (right).
 */
const LEFT_HANDLE_GRIP = { rod: [0, 1, 0] as Dir, palm: [1, 0, 0.35] as Dir };
/**
 * Right hand reaching across to the swatter handle on the left side, from
 * the player's front and behind the handle: thumb up along the handle, which
 * leans back (toward -right in this frame, where forward points left) by
 * SWATTER.restLeanDeg, palm facing in (-right), square to the handle.
 */
const lean = (SWATTER.restLeanDeg * Math.PI) / 180;
const SWATTER_GRIP = {
  rod: [-Math.sin(lean), Math.cos(lean), 0] as Dir,
  palm: [-Math.cos(lean), -Math.sin(lean), 0] as Dir,
};
/**
 * Left fist holding the horn up at the mouth: thumb up along the grip, palm
 * facing in (right), so the horn points straight ahead and its mouthpiece is
 * at the lips. The palm never faces the headset (Quest menu).
 */
const BLOW_GRIP = { rod: [0, 1, 0] as Dir, palm: [1, 0, 0] as Dir };
/** Right hand around the upright bell handle on the left platform: thumb up, palm facing in (left) and a little forward. */
const BELL_GRIP = { rod: [0, 1, 0] as Dir, palm: [-1, 0, 0.2] as Dir };
/** Pinch from above: fingers down and forward, palm down and toward the player. */
const PINCH_DOWN = { fingers: [0, -0.8, 0.6] as Dir, palm: [0, -0.6, -0.8] as Dir };
/** Throwing a pinched goblin: fingers forward and a little up, palm down and a little forward (never toward the headset). */
const TOSS_GRIP = { fingers: [0, 0.3, 1] as Dir, palm: [0, -1, 0.3] as Dir };
/** Right hand pinching the pouch from behind, like a bow string: fingers along the shot, palm facing in (left). */
const PULL_GRIP = { fingers: [0, 0, 1] as Dir, palm: [-1, 0, 0] as Dir };
/** Bringing food to the mouth: fingers toward the face, thumb up, palm facing in. Never toward the headset (Quest menu). */
const MOUTH_GRIP = { fingers: [0, 0.25, -1] as Dir, palm: [-1, 0, 0] as Dir };
/**
 * Right arm stretched straight out for the reach check: hand flat with the
 * fingers pointing forward, thumb up, palm facing in (left). The hand's
 * side faces the eyes, so the cameras see every finger, and the palm never
 * faces the headset (Quest menu).
 */
const REACH_GRIP = { fingers: [0, 0, 1] as Dir, palm: [-1, 0, 0] as Dir };

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
  /** Reach check: from in front of the chest, stretch the arm straight out, hold it there (the countdown), bring it back to rest. */
  reach: {
    hand: 'right',
    keys: [
      key(0, 'reach', [-3, -8, -32], 'open', REACH_GRIP),
      key(1.0, 'reach', [0, 0, 0], 'open', REACH_GRIP),
      key(2.8, 'reach', [0, 0, 0], 'open', REACH_GRIP),
      key(3.6, 'reach', [-3, -8, -32], 'open', REACH_GRIP),
    ],
  },
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
  /**
   * Throw: come down over the goblin, pinch it, lift it and draw the hand
   * back toward the body, then flick it forward and up (about 15 cm in
   * 0.2 s, faster than GOBLIN_RULES.tossLessonSpeed), open the pinch
   * mid-swing and follow through. Always well above the goblin, so the hand
   * never passes through the wall.
   */
  toss: {
    hand: 'right',
    keys: [
      key(0, 'lessonGoblin', [0, 9, -5], 'open', PINCH_DOWN),
      key(0.8, 'lessonGoblin', [0, 0, 0], 'open', PINCH_DOWN),
      key(1.1, 'lessonGoblin', [0, 0, 0], 'pinch', PINCH_DOWN),
      key(1.8, 'lessonGoblin', [0, 12, -10], 'pinch', TOSS_GRIP),
      key(2.0, 'lessonGoblin', [0, 16, 4], 'pinch', TOSS_GRIP),
      key(2.05, 'lessonGoblin', [0, 16.5, 5.5], 'open', TOSS_GRIP),
      key(2.4, 'lessonGoblin', [0, 14, 8], 'open', TOSS_GRIP),
    ],
  },
  /** The slingshot is on the right: the left hand comes in from its side and behind, closes the fist around the handle, lifts it. */
  slingGrab: {
    hand: 'left',
    keys: [
      key(0, 'slingHandle', [-5, 1, -6], 'open', LEFT_HANDLE_GRIP),
      key(0.8, 'slingHandle', [0, 0, 0], 'open', LEFT_HANDLE_GRIP),
      key(1.1, 'slingHandle', [0, 0, 0], 'fist', LEFT_HANDLE_GRIP),
      key(2.0, 'slingHandle', [0, 6, -4], 'fist', LEFT_HANDLE_GRIP),
    ],
  },
  /** The swatter is on the left: the right hand from the player's front and behind, low (clear of the head above), closes the fist, lifts it. */
  swatterGrab: {
    hand: 'right',
    keys: [
      key(0, 'swatterHandle', [6, 0, -4], 'open', SWATTER_GRIP),
      key(0.8, 'swatterHandle', [0, 0, 0], 'open', SWATTER_GRIP),
      key(1.1, 'swatterHandle', [0, 0, 0], 'fist', SWATTER_GRIP),
      key(2.0, 'swatterHandle', [0, 6, -3], 'fist', SWATTER_GRIP),
    ],
  },
  /** The pepper is front left: the right hand from its side and behind, closes the fist around the shaker, lifts it. */
  pepperGrab: {
    hand: 'right',
    keys: [
      key(0, 'pepperHandle', [5, 1, -6], 'open', HANDLE_GRIP),
      key(0.8, 'pepperHandle', [0, 0, 0], 'open', HANDLE_GRIP),
      key(1.1, 'pepperHandle', [0, 0, 0], 'fist', HANDLE_GRIP),
      key(2.0, 'pepperHandle', [0, 6, -4], 'fist', HANDLE_GRIP),
    ],
  },
  /** The bell is on the left: the right hand from the player's side, a little high (clear of the bell below), closes the fist, lifts it. */
  bellGrab: {
    hand: 'right',
    keys: [
      key(0, 'bellHandle', [0, 3, -8], 'open', BELL_GRIP),
      key(0.8, 'bellHandle', [0, 0, 0], 'open', BELL_GRIP),
      key(1.1, 'bellHandle', [0, 0, 0], 'fist', BELL_GRIP),
      key(2.0, 'bellHandle', [0, 6, -4], 'fist', BELL_GRIP),
    ],
  },
  /** The horn is on the right: the left hand from its side and behind, a little high, closes the fist around the upright grip, lifts it. */
  hornGrab: {
    hand: 'left',
    keys: [
      key(0, 'hornHandle', [-4, 2, -7], 'open', LEFT_HANDLE_GRIP),
      key(0.8, 'hornHandle', [0, 0, 0], 'open', LEFT_HANDLE_GRIP),
      key(1.1, 'hornHandle', [0, 0, 0], 'fist', LEFT_HANDLE_GRIP),
      key(2.0, 'hornHandle', [0, 5, -4], 'fist', LEFT_HANDLE_GRIP),
    ],
  },
  /**
   * Aim, then lift (v2): grab the horn, hold it low in front of the chest
   * while looking out (the head aims it), then bring it up to the lips (the
   * fist a little below and to the left, so the mouthpiece on top of the
   * grip is at the lips: the spot locks) and hold it there for the blow.
   * The left hand (the horn is on the right).
   */
  hornBlow: {
    hand: 'left',
    keys: [
      key(0, 'hornHandle', [-4, 2, -7], 'open', LEFT_HANDLE_GRIP),
      key(0.6, 'hornHandle', [0, 0, 0], 'open', LEFT_HANDLE_GRIP),
      key(0.9, 'hornHandle', [0, 0, 0], 'fist', LEFT_HANDLE_GRIP),
      key(1.5, 'mouth', [-5, -24, 10], 'fist', BLOW_GRIP),
      key(2.7, 'mouth', [-5, -24, 10], 'fist', BLOW_GRIP),
      key(3.5, 'mouth', [-3, -9, 4], 'fist', BLOW_GRIP),
      key(4.8, 'mouth', [-3, -9, 4], 'fist', BLOW_GRIP),
    ],
  },
  /** Grab the bell with the right hand (it is on the left), lift it, ring it with a hard swing side to side. */
  bellRing: {
    hand: 'right',
    keys: [
      key(0, 'bellHandle', [0, 3, -8], 'open', BELL_GRIP),
      key(0.6, 'bellHandle', [0, 0, 0], 'open', BELL_GRIP),
      key(0.9, 'bellHandle', [0, 0, 0], 'fist', BELL_GRIP),
      key(1.5, 'bellHandle', [0, 6, -4], 'fist', BELL_GRIP),
      key(1.7, 'bellHandle', [-3, 6, -4], 'fist', BELL_GRIP),
      key(1.9, 'bellHandle', [3, 6, -4], 'fist', BELL_GRIP),
      key(2.1, 'bellHandle', [-3, 6, -4], 'fist', BELL_GRIP),
      key(2.3, 'bellHandle', [3, 6, -4], 'fist', BELL_GRIP),
      key(2.5, 'bellHandle', [0, 6, -4], 'fist', BELL_GRIP),
      key(3.0, 'bellHandle', [0, 6, -4], 'fist', BELL_GRIP),
    ],
  },
  /** The right hand (the left holds the slingshot) comes down into the bowl and pinches a pebble off the top of the pile. */
  pebble: {
    hand: 'right',
    keys: [
      key(0, 'pebbles', [0, 9, -2], 'open', PINCH_DOWN),
      key(0.8, 'pebbles', [0, 0, 0], 'open', PINCH_DOWN),
      key(1.1, 'pebbles', [0, 0, 0], 'pinch', PINCH_DOWN),
      key(1.9, 'pebbles', [0, 9, -2], 'pinch', PINCH_DOWN),
    ],
  },
  /** Lift the pebble out of the bowl, bring it to the pouch from the player's side (clear of the fork), let go. */
  load: {
    hand: 'right',
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
    hand: 'right',
    frame: 'shot',
    keys: [
      key(0, 'pouch', [3, 3, -7], 'open', PULL_GRIP),
      key(0.7, 'pouch', [0, 0, 0], 'open', PULL_GRIP),
      key(1.0, 'pouch', [0, 0, 0], 'pinch', PULL_GRIP),
      key(2.0, 'pouch', [0, 0, -14], 'pinch', PULL_GRIP),
      key(2.2, 'pouch', [0, 0, -14], 'open', PULL_GRIP),
    ],
  },
  /**
   * The keg lesson: the same pull as `shoot`, but straight back away from
   * the keg (frame 'aim'), so the shot goes at it. Ghost aim dots show the arc.
   */
  aimKeg: {
    hand: 'right',
    frame: 'aim',
    keys: [
      key(0, 'pouch', [3, 3, -7], 'open', PULL_GRIP),
      key(0.7, 'pouch', [0, 0, 0], 'open', PULL_GRIP),
      key(1.0, 'pouch', [0, 0, 0], 'pinch', PULL_GRIP),
      key(2.0, 'pouch', [0, 0, -14], 'pinch', PULL_GRIP),
      key(2.4, 'pouch', [0, 0, -14], 'pinch', PULL_GRIP),
      key(2.6, 'pouch', [0, 0, -14], 'open', PULL_GRIP),
    ],
  },
} satisfies Record<string, GhostDemo>;

export type GhostDemoName = keyof typeof GHOST_DEMOS;

/** Where a demo ends: the ghost steps aside while the player's own hand is there. */
export function endAnchor(name: GhostDemoName): GhostAnchor {
  const keys: GhostKey[] = GHOST_DEMOS[name].keys;
  return keys[keys.length - 1].at;
}
