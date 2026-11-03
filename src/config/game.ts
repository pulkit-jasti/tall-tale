// All tuning numbers for the game live here, so tuning never needs code changes.
// Board sizes are in centimeters (1 board unit = 1 cm, see docs/map.md).
// World sizes that IWSDK works with directly are in meters and say so.

export const BOARD = {
  /** Radius of the hole the player sits in (cm). */
  holeRadius: 25,
  /** The board is flat up to this radius, then rises (cm). */
  flatTo: 90,
  /** Rise per cm beyond flatTo, so far enemies face the player. */
  rise: 0.08,
  /** Outer edge of the board (cm). */
  outerRadius: 600,
  /** How far the board edges hang down, like a table skirt (cm). */
  skirtDepth: 80,
  /** Board surface height below the eyes when placed (meters). */
  eyeToBoard: 0.48,
  /** Grass colors, picked per vertex for a slightly varied look. */
  grassColors: [0x8fbf5a, 0x9cc46b, 0x86b552, 0xa3c972],
  skirtColor: 0x6b5a45,
};

export const CASTLE = {
  wallIn: 40,
  wallOut: 46,
  wallHeight: 6,
  /** Grunts and runners stop this far outside the wall (cm). */
  wallStandOff: 5,
  /** Where climbers stand on the wall top (cm from center). */
  rampartRadius: 43,
  /** Courtyard ring where intruders wander (cm). */
  courtyardMin: 29,
  courtyardMax: 37,
  towerCount: 6,
  /** Angle of the first tower (degrees, 0 = front). */
  towerStartDeg: 30,
  towerWidth: 5,
  stoneColor: 0xc9c2b4,
  stoneTopColor: 0xddd6c8,
  stoneDarkColor: 0xa49c8c,
  crenelSpacing: 6,
};

export const ROADS = {
  width: 6,
  /** Height of the road ribbon above the board (cm). */
  lift: 0.15,
  color: 0xd9c08a,
  /** Max sideways offset of a goblin from the road center (cm). */
  laneJitter: 1.8,
};

/** Zones where the bare hands, the handles and the camera live. */
export const STAGE = {
  /** Delay after entering VR before the board is placed (seconds). */
  placeDelay: 0.6,
  /** Desktop camera (no headset): seated eye height (meters). */
  desktopEyeHeight: 1.15,
};

export const HANDLES = {
  /** Distance of both handles from the center (cm). */
  radius: 27,
  /** Rotate handle: center of its track (degrees, right of front). */
  rotateAngleDeg: 22,
  /** Half length of the rotate track (degrees). */
  rotateSpanDeg: 13,
  /** Knob size (cm). */
  knobRadius: 3,
  knobPostHeight: 4,
  /** How fast the knob glides back to the middle after release (1/s). */
  knobReturnRate: 6,
  /** Height handle: angle (degrees, left of front is negative). */
  heightAngleDeg: -22,
  /** Bar width and thickness (cm). */
  barWidth: 12,
  barRadius: 1.2,
  /** Bar rest height above the board base (cm). */
  barRestY: 6,
  /** How far the board can move down and up from where it was placed (cm). */
  heightMin: -10,
  heightMax: 12,
  /** Grab zone around a handle (meters). Oversized on purpose. */
  grabRadius: 0.085,
  woodColor: 0x5a4330,
  trackColor: 0x3b2b1f,
  arrowColor: 0xf2c14e,
  /** Keyboard debug speeds. */
  keyRotateDegPerSec: 60,
  keyHeightCmPerSec: 12,
};

export const HANDS = {
  /** Pinch starts below this thumb to index distance (meters). */
  pinchStart: 0.018,
  /** Pinch ends above this distance (meters). Higher than start, so no flicker. */
  pinchEnd: 0.035,
  /** Fist: average fingertip to palm distance to start and end (meters). */
  fistStart: 0.055,
  fistEnd: 0.07,
  /** A pose must hold this long before it counts (seconds). */
  poseHold: 0.06,
  fistHold: 0.12,
  /** Keep the last hand state this long when tracking drops (seconds). */
  lostGrace: 0.3,
  /** Pinch zone around the pinch point that snaps to the nearest goblin (meters). */
  pinchRadius: 0.055,
};

export const EAT = {
  /** The held goblin must be this close to the head (meters). */
  mouthDistance: 0.25,
  /** Head pitch must be at least this (degrees, 0 = level, up is positive). */
  minHeadPitchDeg: -8,
  /** Where the eat burst shows, in front of the face (meters). */
  burstForward: 0.16,
  burstDown: 0.06,
};

export type GoblinType = 'grunt' | 'runner' | 'climber';

export interface GoblinStats {
  /** Height (cm). */
  height: number;
  /** Walking speed (cm per second). */
  speed: number;
  /** Multiplies the model colors. */
  tint: [number, number, number];
  moveClip: string;
  /** Animation playback speed while moving. */
  moveClipSpeed: number;
}

export const GOBLINS: Record<GoblinType, GoblinStats> = {
  grunt: { height: 3.5, speed: 6, tint: [1, 1, 1], moveClip: 'walk', moveClipSpeed: 1.3 },
  runner: { height: 3, speed: 13, tint: [1.15, 1.05, 0.45], moveClip: 'sprint', moveClipSpeed: 1.4 },
  climber: { height: 3.5, speed: 5.5, tint: [0.85, 0.6, 1.15], moveClip: 'walk', moveClipSpeed: 1.2 },
};

export const GOBLIN_RULES = {
  /** Most goblins on the board at once (unit budget, docs/mvp.md). */
  maxGoblins: 40,
  /** Random speed change per goblin (0.1 = plus or minus 10%). */
  speedJitter: 0.1,
  /** Seconds between wall hits for one goblin. */
  wallHitInterval: 1.6,
  /** Shortest gap between two wall hit sounds from all goblins (seconds). */
  wallHitSoundGap: 0.25,
  /** Climbing speed up the wall (cm per second). */
  climbSpeed: 2,
  /** How long a climber waits on the rampart before jumping into the courtyard (seconds). */
  rampartWait: 8,
  /** Dazed time after being dropped (seconds). */
  dazedTime: 1.4,
  /** Gravity for dropped goblins (cm per second squared). */
  gravity: 980,
  /** Intruders pause this long between short walks (seconds). */
  intruderPause: 1.2,
  /** Animation cross fade (seconds). */
  fade: 0.15,
};

/** Toy test spawning (build step 1 only, replaced by the director in step 3). */
export const TOY_SPAWN = {
  /** Auto trickle on at start. */
  autoTrickle: true,
  /** Seconds between auto groups. */
  trickleInterval: 9,
  gruntGroup: 3,
  runnerGroup: 4,
  /** Gap between goblins in a group (seconds). */
  groupGap: 0.8,
  /** Every Nth auto group also sends a climber. */
  climberEvery: 2,
  /** Every Nth auto group is runners instead of grunts. */
  runnerEvery: 4,
  /** Seed for the toy test (fixed, so every run is the same). */
  seed: 1234,
};

export const FEEDBACK = {
  /** Emissive colors for the shared Idle, Ready, Held and Locked states. */
  ready: 0x5a5a5a,
  held: 0xff7a00,
  heldIntensity: 0.7,
  locked: 0x000000,
  /** Eat zone pulse while a held goblin is near the mouth. */
  eatPulse: 0xffffff,
};

export const PARTICLES = {
  poolSize: 96,
  /** Particle size (meters). */
  size: 0.006,
  life: 0.55,
  speed: 0.35,
  gravity: 0.9,
};
