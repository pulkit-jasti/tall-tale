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
  eyeToBoard: 0.36,
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
  /** Courtyard ring where intruders wander (cm). Kept near the wall, away from the ring handle. */
  courtyardMin: 34,
  courtyardMax: 38,
  /** Where the courtyard houses and stalls stand (cm from center). */
  propRadius: 34,
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

/** The ring handle: one curved rail in front of the player that spins and lifts the board. */
export const HANDLES = {
  /** Distance of the ring from the center (cm). */
  radius: 27,
  /** Half of the ring arc, centered on the front (degrees). 180 = a full circle. */
  halfSpanDeg: 180,
  /** Ring height above the board (cm). A little lower than the wall top. */
  ringY: 5,
  /** Ring tube thickness (cm). */
  ringRadius: 1.4,
  poleRadius: 0.6,
  /** Poles under the ring, spread evenly from the front. */
  poleCount: 8,
  /** Small bands around the ring (arrow color), spread evenly, so its turning is easy to see. */
  bandCount: 12,
  /** Small up and down arrows stand on the ring this far left and right of front (degrees). */
  sideArrowDeg: 50,
  /** Arrow size (1 = the first build's size). */
  arrowSize: 0.6,
  /** Half length of the curved arrow at the front (degrees). */
  frontArrowHalfDeg: 8,
  /** The hand moves this far before one direction (spin or height) locks for the grab (cm). */
  axisLock: 4,
  /** How far the board can move down and up from where it was placed (cm). */
  heightMin: -25,
  heightMax: 35,
  /** Grab zone around the ring (meters). */
  grabRadius: 0.06,
  /** The grab zone ends this far below the ring center, so hands resting below it never grab (cm). */
  grabBelow: 1,
  /** The hand must be open in the grab zone this long before closing it grabs (seconds). */
  readyTime: 0.15,
  /** The ring lets go only after the hand is open this long (seconds). */
  releaseHold: 0.25,
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
  /** Fist: a fingertip closer than this to the palm counts as curled (meters). */
  fingerCurled: 0.06,
  /** A fingertip farther than this from the palm counts as open (meters). */
  fingerOpen: 0.08,
  /** Fingers (of 4) that must be curled to start a fist, or open to end it. */
  fistFingers: 3,
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
  mouthDistance: 0.22,
  /** Held this long near the mouth, the goblin is eaten. No letting go (seconds). */
  holdTime: 0.2,
  /** If the pinch breaks this close to the head, the goblin is eaten, not dropped (meters). */
  graceDistance: 0.35,
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
  /** Hand speed smoothing while held, so tracking jitter does not fling goblins (seconds). */
  throwSmoothing: 0.06,
  /** Thrown goblins keep this share of the hand speed. */
  throwScale: 1,
  /** Fastest throw, so a tracking glitch cannot launch a goblin off the map (cm per second). */
  maxThrowSpeed: 350,
  /** Landing faster than this bounces once more (cm per second, downward). */
  bounceSpeed: 120,
  /** Share of the downward speed kept on a bounce. */
  bounceKeep: 0.3,
  /** Share of the sideways speed kept on a bounce. */
  bounceSlide: 0.5,
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

/** Live frame rate panel for performance checks (debug). */
export const FPS = {
  /** Frame rate the headset should hold (Quest browser default). */
  target: 72,
  /** Redraw the numbers this often (seconds). */
  refresh: 0.5,
  /** Shown by default in the dev server. The deployed build shows it with ?fps in the URL. */
  showInDev: true,
  /** Panel spot: on the rim, left of front, standing just above the ring (cm, degrees). */
  radius: 27,
  angleDeg: -36,
  aboveRing: 3,
  /** Panel size (cm). */
  width: 9,
  height: 3.4,
};

/** Mouse look in the browser (not used in VR). */
export const MOUSE_LOOK = {
  /** Degrees the view turns per pixel of mouse drag. */
  degPerPixel: 0.25,
  /** How far the view can tilt up or down (degrees). */
  maxPitchDeg: 80,
  /** Field of view limits for the scroll wheel zoom (degrees). */
  minFov: 30,
  maxFov: 80,
  /** Field of view change per scroll wheel step (degrees). */
  fovPerWheelStep: 3,
};
