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

/** VR session settings. */
export const XR = {
  /**
   * Frame rate asked for on entering VR (Hz), if the headset supports it.
   * 72 gives 13.9 ms per frame instead of 11.1 ms at 90 (the Quest 3S default).
   */
  frameRate: 72,
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
  /** Knocked back by a thrown pebble or a goblin shot: sideways and upward speed of the hop (cm per second). */
  knockSpeed: 60,
  knockHop: 90,
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

/** Route choice at junctions (docs/map.md section 4). */
export const ROUTES = {
  /**
   * A route this much longer than the shortest one (cm) is half as likely.
   * Smaller = goblins stick to the shortest road more.
   */
  detourScale: 60,
};

/** Castle health, damage and repair (docs/castle-rules.md). Health is the red flag's height. */
export const CASTLE_HEALTH = {
  maxHealth: 100,
  /** Damage per wall hit from a grunt or runner (one hit every GOBLIN_RULES.wallHitInterval). */
  wallHitDamage: 0.35,
  /** Damage per second from each intruder in the courtyard. Faster than outside attacks. */
  intruderDamagePerSec: 1.2,
  /** Share of the missing health repaired in each breather. */
  repairShare: 0.35,
};

/** How a wave's enemies come out of their camps (the numbers per wave are in src/director/tutorial.ts). */
export const WAVES = {
  /** Goblins per group. Climbers come alone. */
  gruntGroup: 3,
  runnerGroup: 4,
  /** A camp rumbles this long before its group comes out (seconds). */
  rumbleLead: 3,
  /** Gap between goblins of one group leaving the camp (seconds). */
  groupGap: 0.8,
  /** Group times follow t = spawnTime * x^curve: below 1, the start is calm and the end is a push. */
  curve: 0.75,
  /** Random shift of each group time, as a share of the gap between groups. */
  jitter: 0.3,
  /** The first group comes this long after the wave starts (seconds), after its rumble. */
  firstGroupAt: 1,
  /** A camp sinks this much (share of its height) when all its enemies of the wave are out. */
  campSink: 0.35,
  /** The scripted climber in front comes from this far off the exact front (degrees). */
  frontClimberSpread: 8,
};

/**
 * The two flags (docs/castle-rules.md section 2). They live in boardLift:
 * they rise with the board but never spin. Just outside the ring handle,
 * one on each side, a little in front (cm, degrees).
 */
export const FLAGS = {
  radius: 31,
  /** Red castle health flag on the left, blue wave flag on the right. */
  healthAngleDeg: -44,
  waveAngleDeg: 44,
  poleHeight: 26,
  poleRadius: 0.35,
  poleColor: 0x5a4330,
  ballColor: 0xf2c14e,
  /** Cloth size (cm) and colors. */
  clothWidth: 6,
  clothHeight: 4,
  healthColor: 0xd23c28,
  waveColor: 0x2f6fd8,
  /** Lowest and highest cloth top on the pole (cm above the board). */
  clothBottom: 5,
  clothTop: 25,
  /** The cloth glides to its new height at this speed (share per second). Slow, so repairs are seen. */
  slideSpeed: 1.5,
  /** Waving: sway angle (degrees) and speed. */
  swayDeg: 12,
  swaySpeed: 3,
  /** Below this health share the red cloth darkens and droops (tears and smoke come with the juice step). */
  lowShare: 0.3,
  notchColor: 0xddd6c8,
};

/** Win and lose panels, and the poke buttons on them (docs/castle-rules.md section 4). */
export const END_PANEL = {
  /** Panel spot, fixed in front of the player (fixedRig, cm): over the front wall, within reach. */
  radius: 36,
  y: 20,
  /** Tilted back a little, toward the eyes (degrees). */
  tiltDeg: 20,
  width: 32,
  height: 20,
  /** The round poke button below the text, in front of the panel (cm). */
  buttonRadius: 3.5,
  buttonDepth: 1.6,
  buttonColor: 0x6fae4a,
  /** The panel appears this long after the battle ends, after the last poofs (seconds). */
  showDelay: 1.2,
};

/** Poke buttons (src/ui/pokeButton.ts), in cm like the rigs they sit in. */
export const POKE = {
  /** Ready when the fingertip is this close in front of the button face. */
  readyDistance: 5,
  /** Pressed when the fingertip pushes this deep into the button. */
  pressDepth: 0.6,
  /** How far the button sinks when pressed. */
  travel: 0.8,
  /** The poke zone is this much wider than the button. */
  zoneScale: 1.3,
};

/**
 * The tutorial's hint sign: low in front, just outside the ring (the tool
 * platforms fill the space inside it), tilted back toward the eyes and kept
 * under the line of sight to the front wall top (boardLift, cm).
 */
export const HINT_SIGN = {
  radius: 33,
  /** Bottom edge above the board. */
  y: 4,
  width: 22,
  height: 9,
  tiltDeg: 45,
  /** A new instruction pops in over this long (seconds). */
  popTime: 0.25,
  /** A finished lesson shows its ticked box this long before the next one (seconds). */
  doneTime: 1.2,
  /** Round "Next" poke button in the sign's bottom right corner (cm). */
  nextRadius: 1.6,
  nextDepth: 1,
  nextColor: 0x6fae4a,
};

/** Info steps (wave banners, flags): how long they stay up so they can be read. */
export const READING = {
  /** Seconds = base + perWord * words, never below min. */
  base: 2,
  perWord: 0.35,
  min: 7,
  /** "Look at the flag" steps: the head must point within this cone of it (degrees)... */
  gazeConeDeg: 14,
  /** ...for this long (seconds). */
  gazeHold: 1,
  /** They move on anyway this long after the reading time (seconds). */
  gazeGrace: 12,
};

/** Ghost hands that show how to do each lesson (src/ui/ghostHand.ts). */
export const GHOST_HAND = {
  color: 0x9fd4ff,
  opacity: 0.45,
  /** Glowing fingertips for a pinch (meters). */
  tipSize: 0.007,
  tipColor: 0xffe28a,
  /** Fades in and out at the ends of each loop (seconds). */
  fade: 0.3,
  /** Pause between loops (seconds). */
  rest: 0.6,
  /** Hidden while one of the player's hands is this close to the demo's target (meters). */
  hideNear: 0.09,
  /** Fingers point down by this much toward the target (degrees). */
  pitchDeg: 35,
  /**
   * Roll that turns the palm down (degrees, mirrored for the left hand). A
   * guess from the WebXR grip space: tune in the headset.
   */
  palmRollDeg: 90,
  /** The ghost's mouth point: in front of the face and a little down (meters). */
  mouthForward: 0.16,
  mouthDown: 0.07,
};

/** Tutorial markers (src/ui/markers.ts). */
export const MARKERS = {
  /** "!" size (meters, world). */
  size: 0.03,
  /** Above the target (meters) and the bounce height. */
  lift: 0.02,
  bob: 0.012,
  bobSpeed: 4,
  arrowColor: '#f2c14e',
  /** The target counts as out of view beyond this angle from where the head looks (degrees). */
  offViewDeg: 50,
  /** Out of view arrow on the ring: size (cm), angle off the front (degrees) and how far it slides. */
  turnArrowSize: 6,
  turnArrowDeg: 14,
  turnArrowSlide: 6,
};

/** Debug spawning (keys and the stress test), apart from the director. */
export const DEBUG_SPAWN = {
  /** Auto trickle on at start. Off: the tutorial director spawns the waves. */
  autoTrickle: false,
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
};

export const FEEDBACK = {
  /** Emissive colors for the shared Idle, Ready, Held and Locked states. */
  ready: 0x5a5a5a,
  held: 0xff7a00,
  heldIntensity: 0.7,
  locked: 0x000000,
  /** Eat zone pulse while a held goblin is near the mouth. */
  eatPulse: 0xffffff,
  /** Glow on the enemy the slingshot is about to hit (not a touch state). */
  aimed: 0xd23c28,
  aimedIntensity: 0.8,
};

/**
 * Spots for the tool platforms around the player (docs/giant-tools.md
 * section 7). Fixed, they never turn with the board. 2 on each side, a bit
 * forward. All inside the ring handle, so the ring never passes through them
 * when the board moves up or down (cm, degrees: 0 = front, positive = right).
 */
export const TOOL_SPOTS = {
  slingshot: { angleDeg: 30, radius: 19 },
  /** Filled in build steps 4 and 5. */
  rightSide: { angleDeg: 82, radius: 19 },
  leftFront: { angleDeg: -30, radius: 19 },
  leftSide: { angleDeg: -82, radius: 19 },
  /** Platform top above the board's placed height (cm). Above the ring top. */
  platformTop: 10,
  /** Platform width (cm). */
  platformWidth: 11,
  /** Post under each platform, down from its bottom (cm). */
  postLength: 14,
  postRadius: 1,
  postColor: 0x3b2b1f,
};

/**
 * The slingshot (docs/giant-tools.md). Grab its handle with either hand (fist
 * or pinch, like the ring handle), pinch a pebble from the bowl and bring it
 * to the pouch, where it clicks in. Then pinch the pouch with the free hand,
 * pull back and let go. It also shoots while it sits on its platform, so it
 * works with one hand.
 */
export const SLINGSHOT = {
  /** Y frame height (cm). */
  frameHeight: 15,
  handleHeight: 7,
  /** Angle of each fork arm from vertical (degrees). */
  armSpreadDeg: 25,
  woodColor: 0x8a5a34,
  bandColor: 0x6e2f22,
  pouchColor: 0x5a3a24,
  /** The pouch rests this far behind the fork (cm). */
  pouchRest: 2.5,
  /** Pinch zone around the pouch (meters). Generous, like the goblins. */
  grabRadius: 0.06,
  /** Grab zone around the handle (meters). */
  handleGrabRadius: 0.06,
  /** The hand must be open near the handle this long before closing it grabs (seconds). Same as the ring. */
  readyTime: 0.15,
  /** The handle lets go only after the hand is open this long (seconds). Same as the ring. */
  releaseHold: 0.25,
  /** Smoothing of the held slingshot, so wrist tracking jitter does not shake it (seconds). */
  holdSmoothing: 0.03,
  /** Let go: it glides back to its platform in this long (seconds). */
  returnTime: 0.35,
  /**
   * The holding hand lost tracking (often hidden behind the pulling hand): the
   * slingshot stays where it is this long before it lets go (seconds, on top of HANDS.lostGrace).
   */
  holdLostGrace: 0.6,
  /** The pulling hand lost tracking: the pouch stays this long before the pull is cancelled (seconds, on top of HANDS.lostGrace). */
  pullLostGrace: 0.4,
  /** The pulling hand is back: its pinch must read again within this long, or the pull is cancelled, never shot (seconds). */
  pullSettle: 0.15,
  /** A held pebble clicks into the empty pouch within this distance (meters). */
  attachRadius: 0.05,
  /** Pulls shorter than this do not shoot, the pebble stays (cm). */
  minPull: 4,
  /** Longest pull (cm). The pouch stops here. */
  maxPull: 16,
  /** Launch speed at the shortest and longest pull (cm per second). */
  minSpeed: 140,
  maxSpeed: 560,
  /** Gravity for pebbles (cm per second squared). Lower than real, so arcs read well. */
  gravity: 700,
  /** No shot when it points within this angle of the player's own head (degrees). */
  headConeDeg: 45,
  /** Pouch spring back speed after a shot (per second). */
  springBack: 18,
  /** A stretch creak plays every this many cm of pull. */
  creakEvery: 4,
  /** Pebbles in flight or falling at once (pool size). */
  maxPebbles: 8,
  /** Pebble size (cm). Bigger than real pebbles, so they are easy to see and pinch. */
  pebbleSize: 2.5,
  /** Longest flight before a pebble is dropped (seconds). */
  maxFlight: 4,
  /** Below this height (cm, board) a pebble that fell into the hole is gone. */
  killBelow: -60,
};

/** Slingshot aim assist (docs/giant-tools.md "Slingshot aim assist"). Strengths are tuned in playtests. */
export const AIM_ASSIST = {
  /** 1. The shot uses the average pull of this window before the release (seconds)... */
  steadyWindow: 0.1,
  /** ...skipping this last bit, while the fingers already open. */
  steadySkip: 0.05,
  /** 2. Trajectory dots while pulling: count and share of the flight shown (1 = all the way to the impact). */
  dotCount: 18,
  dotShare: 1,
  dotSize: 0.45,
  dotColor: 0xffffff,
  /** Semi transparent circle on the ground where the shot will land (cm). Same size as the hit area. */
  markerRadius: 4,
  markerColor: 0xffffff,
  markerOpacity: 0.35,
  /** Lifted this far above the ground so it never flickers into it (cm). */
  markerLift: 0.2,
  /** Prediction step for the dots and the target glow (seconds). */
  traceStep: 1 / 60,
  /**
   * 4. Gentle pull toward a target within this cone after release (degrees).
   * Raised from 7 and 30 after the headset tests, to make up for hand tracking jitter.
   */
  coneDeg: 10,
  /** Most it bends per second (degrees). Times `strength`. */
  turnDegPerSec: 45,
  /** Overall assist strength (0 = off, 1 = normal). An accessibility option later. */
  strength: 1,
  /** Assist share per enemy type. Weak on runners: the slingshot is meant to be weak against them. */
  typeShare: { grunt: 1, runner: 0.3, climber: 1 } as Record<GoblinType, number>,
  /** 5. Hit area around the pebble's center, bigger than it looks (cm). Raised from 3.5. */
  hitRadius: 4,
};

/** The pebble bowl beside the slingshot. Soldiers keep topping it up. */
export const PEBBLE_BOWL = {
  angleDeg: 60,
  radius: 17,
  /** Rim height above the board's placed height (cm). Lower than the platform. */
  rimY: 4,
  /** Width and depth (cm). */
  width: 11,
  depth: 2.5,
  color: 0x9a6a44,
  /** Pebbles it holds, and at the start. */
  capacity: 10,
  /** Pinch zone around the bowl center to take a pebble (meters). */
  grabRadius: 0.07,
  /** One pebble is added this often while not full (seconds). */
  refillEvery: 2.5,
  /** Pile size (cm wide, when full) and its smallest share before it is empty. */
  pileWidth: 6,
  pileMinScale: 0.35,
  postLength: 12,
};

/** A pebble thrown by hand. It only knocks a goblin back, dazed. Knocking out is the slingshot's job. */
export const PEBBLE_THROW = {
  /** Hand speed smoothing, so tracking jitter does not fling pebbles (seconds). Same as goblins. */
  smoothing: 0.06,
  /** Thrown pebbles keep this share of the hand speed. */
  scale: 1,
  /** Fastest throw (cm per second). */
  maxSpeed: 350,
  /** Slower than this it is only dropped and does nothing (cm per second). */
  minSpeed: 60,
  /** Share of the slingshot's bend toward a goblin (AIM_ASSIST). Weaker, toward goblins only. */
  assist: 0.5,
};

/** A goblin loaded into the slingshot instead of a pebble. It costs a meal, so it hits harder. */
export const GOBLIN_SHOT = {
  /** Goblins this close to the impact are knocked back, dazed (cm). The goblin hit is knocked out. */
  splashRadius: 8,
  /** Spin while flying (radians per second). */
  spin: 14,
};

export const PARTICLES = {
  poolSize: 96,
  /** Particle size (meters). */
  size: 0.006,
  life: 0.55,
  speed: 0.35,
  gravity: 0.9,
};

/** Debug actions (keys and the laptop debug page). */
export const DEBUG = {
  /** Grunts added per stress test press. */
  stressAdd: 10,
  /** The stress test can raise the unit cap up to this. */
  stressMax: 120,
  /** Gap between stress test grunts leaving their camps (seconds). */
  stressGap: 0.25,
  /** Castle damage per "Damage castle" press (health is out of CASTLE_HEALTH.maxHealth). */
  castleDamage: 20,
  /** Board turn and height per debug page press (degrees, cm). */
  spinStepDeg: 30,
  heightStepCm: 5,
  /** Each game page checks in with the debug page this often (seconds). */
  heartbeatEvery: 2,
};

/**
 * Automatic stress test (debug page button): adds grunts step by step,
 * measures each step, and stops at the first step that fails. The unit
 * budget is the last step that passed.
 */
export const STRESS_TEST = {
  /** Grunts added per step. */
  step: 10,
  /** Measured time per step, after the warm-up (seconds). */
  measureSeconds: 20,
  /**
   * A step passes only if all three hold. FPS limits are shares of the page's
   * real target rate (72 Hz: avg at least 71, 1% low at least 65).
   */
  minAvgShare: 0.985,
  minLowShare: 0.9,
  maxMissedPct: 1,
  /** Stop here even if it still passes. */
  maxUnits: 120,
};

/** Live frame rate panel for performance checks (debug). */
export const FPS = {
  /** Frame rate to hold when the XR session does not report its own (Quest browser default). */
  target: 72,
  /** Live numbers are measured over this long (seconds). */
  refresh: 0.5,
  /** The panel redraws at most this often, and only when its text changed (seconds). */
  drawEvery: 1,
  /** Shown by default in the dev server. The deployed build shows it with ?fps in the URL. */
  showInDev: true,
  /** Panel spot: on the rim, left of front (between the hint sign and the left arrow), standing just above the ring (cm, degrees). */
  radius: 27,
  angleDeg: -32,
  aboveRing: 1,
  /** Panel size (cm). Keep width / height at 2:1 like the canvas. */
  width: 13.6,
  height: 6.8,
  /** A measured run skips this long after each reset, so spawn hitches do not count (seconds). */
  warmup: 3,
  /** A frame longer than this many frame budgets counts as missed (likely a stale frame in the headset). */
  missedFactor: 1.5,
  /** The 1% low uses the last this many seconds of the run. */
  lowWindow: 60,
  /** Highest refresh rate to size the frame buffer for (Hz). */
  maxRefresh: 120,
  /** Send the run numbers to the laptop debug page this often (seconds). */
  reportEvery: 1,
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
