// All tuning numbers for the game live here, so tuning never needs code changes.
// Board sizes are in centimeters (1 board unit = 1 cm, see docs/map.md).
// World sizes that IWSDK works with directly are in meters and say so.

export const BOARD = {
  /** Radius of the hole the player sits in (cm). */
  holeRadius: 25,
  /** The board is flat up to this radius, then rises (cm). */
  flatTo: 96,
  /** Rise per cm beyond flatTo, so far enemies face the player. */
  rise: 0.08,
  /** Outer edge of the board (cm). */
  outerRadius: 600,
  /** How far the board edges hang down, like a table skirt (cm). */
  skirtDepth: 80,
  /**
   * Board surface height below the eyes when placed (meters). Lowered from
   * 0.36 and then 0.40 after the step 4 tests: towering high over the
   * kingdom is what makes the player feel like a giant.
   */
  eyeToBoard: 0.46,
  /** Grass colors, picked per vertex for a slightly varied look. */
  grassColors: [0x8fbf5a, 0x9cc46b, 0x86b552, 0xa3c972],
  skirtColor: 0x6b5a45,
};

/**
 * The castle. Its size is set by the reach band (REACH below): climbers on
 * the rampart must stay in reach, so the wall cannot move further out.
 */
export const CASTLE = {
  wallIn: 46,
  wallOut: 52,
  wallHeight: 6,
  /** Grunts and runners stop this far outside the wall (cm). */
  wallStandOff: 5,
  /** Where climbers stand on the wall top (cm from center). */
  rampartRadius: 49,
  /** Courtyard ring where intruders wander (cm). Kept near the wall, away from the tool platforms. */
  courtyardMin: 40,
  courtyardMax: 44,
  towerCount: 6,
  /** Angle of the first tower (degrees, 0 = front). */
  towerStartDeg: 30,
  /**
   * Tower size across the wall (cm). Wider than the wall (wallOut - wallIn),
   * so the wall runs into the tower instead of poking out of its sides.
   */
  towerWidth: 8,
  /** Climbers keep at least this far from a tower's center (degrees), so they are never inside one. */
  towerClearDeg: 12,
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

/**
 * The reach band (docs/controls-and-ui.md "Reach band"): distances from the
 * eyes (cm) for everything the hands grab, pinch or poke, at the default
 * board size (before the reach check sizes it to the player). Meta's hands
 * guidance puts direct touch at 42 to 46 cm and says to avoid 50 to 80 cm,
 * where people reach and miss. Closer than tooClose the elbows jam and hand
 * tracking near the body gets worse. Rarely reached things (climbers on the
 * rampart, intruders) may sit up to `max`. Checked at start in the dev server.
 */
export const REACH = {
  tooClose: 30,
  sweetMin: 40,
  sweetMax: 50,
  max: 63,
};

/**
 * The reach check at the start of the tutorial ("Show me how big you are,
 * giant!", docs/controls-and-ui.md "Reach check"). The player stretches one
 * arm straight out, hand flat, thumb up, fingers spread, and holds it for a
 * short countdown. The farthest the hand gets (level distance from the head)
 * sizes the whole board, so the rampart sits a little inside that reach and
 * everything else keeps its place relative to the wall.
 */
export const CALIBRATION = {
  /** The rampart ends up at this share of the measured reach: a comfortable reach, not a full stretch. */
  rampartShare: 0.88,
  /** The board size stays within this range, whatever the measurement says. */
  minScale: 0.85,
  maxScale: 1.45,
  /** A hand farther than this from the head (level, meters) counts as stretched out and starts the countdown. */
  startReach: 0.33,
  /** Countdown while the arm stays out (seconds). The hand can rest when it ends. */
  holdSeconds: 3,
  /** The arm may drop back this long before the countdown starts over (seconds), so a tracking blink does not reset it. */
  dropGrace: 0.4,
  /** Hand distance smoothing, so a tracking spike never counts as reach (seconds). */
  smoothing: 0.12,
  /** The board grows or shrinks to its new size with this smoothing (seconds). */
  growSmoothing: 0.25,
  /** The ghost hand demo: where the stretched hand ends, from the head (meters forward, right, down). */
  demoForward: 0.55,
  demoRight: 0.16,
  demoDown: 0.2,
  /** Saved in the browser, so it runs only once (debug page: "Measure reach again"). */
  storageKey: 'tallTale.boardScale',
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
  /** Small bands around the ring (arrow color), spread evenly, so its turning is easy to see. 8, so one sits between each two compass letters. */
  bandCount: 8,
  /** Small up and down arrows stand on the ring this far left and right of front (degrees). */
  sideArrowDeg: 50,
  /** Arrow size (1 = the first build's size). */
  arrowSize: 0.6,
  /** Half length of the curved arrow at the front (degrees). */
  frontArrowHalfDeg: 8,
  /**
   * Compass letters on the ring: N, NE, E, SE, S, SW, W, NW, in raised
   * blocky gold (the same gold as the bands, lit with the ring), set into
   * the ring's inner face where it turns up toward the eyes. The four main
   * ones are bigger, like a real compass. They turn with the ring and the
   * board, so N always points at the north of the map (the north camp).
   * `cell` is one block of a letter (cm), `minorScale` shrinks the in-between
   * letters, `depth` is how far they stand out, and `faceDeg` is where on the
   * tube they sit (degrees up from the side that faces the player).
   */
  compass: {
    cell: 0.27,
    minorScale: 0.62,
    depth: 0.35,
    faceDeg: 45,
  },
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
  /**
   * Damage per wall hit from a grunt or runner (one hit every GOBLIN_RULES.wallHitInterval).
   * Set high for quick testing (two grunts at the wall take the castle down in about a minute).
   * Balanced with troops in build step 5.
   */
  wallHitDamage: 1.5,
  /** Damage per second from each intruder in the courtyard. Faster than outside attacks. */
  intruderDamagePerSec: 3,
  /** Share of the missing health repaired in each breather. */
  repairShare: 0.35,
  /**
   * A wave that is not cleared, with every goblin already out of its camp,
   * and nothing has hurt the castle for this long (seconds), is a stalemate
   * (for example a goblin stuck somewhere harmless, far away): its leftovers
   * run off and it ends. Never while the castle is under attack, and never
   * while a goblin is at or on the wall, in the courtyard, or held: the
   * player can still deal with those.
   */
  stalemateSeconds: 60,
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
 * they rise with the board but never spin. Just behind the tool platforms,
 * between the front ones and the middle ones, one on each side (cm, degrees).
 */
export const FLAGS = {
  radius: 38.5,
  /** Red castle health flag on the left, blue wave flag on the right. */
  healthAngleDeg: -43,
  waveAngleDeg: 43,
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
  height: 24,
  /** The round poke button at the bottom, below all the text, in front of the panel (cm). */
  buttonRadius: 3.5,
  /** Space between the button's rim and the panel's bottom edge (cm). */
  buttonMargin: 1.2,
  /** The panel appears this long after the battle ends, after the last poofs (seconds). */
  showDelay: 1.2,
};

/** Poke buttons (src/ui/pokeButton.ts), in cm like the rigs they sit in. */
export const POKE = {
  /** Ready when the fingertip is this close in front of the button face. */
  readyDistance: 5,
  /** How far the cap sinks into its rim. It follows the fingertip. */
  travel: 1,
  /** It clicks when pushed this share of the way down. */
  fireShare: 0.85,
  /** After a click, the fingertip must come back out this far in front of the face before another press... */
  releaseDistance: 2,
  /** ...and this long must pass (seconds). */
  cooldown: 0.6,
  /** A button whose job just changed (the sign shows a new step) ignores presses this long (seconds). */
  lockAfterChange: 1,
  /** The poke zone is this much wider than the button. */
  zoneScale: 1.3,
  /** One look for every button: cap color, rim color, round side smoothness, icon size on the face. */
  color: 0x6fae4a,
  rimColor: 0x3b2b1f,
  /** The rim is this much wider than the cap. */
  rimScale: 1.3,
  segments: 32,
  iconShare: 0.8,
  /** Cap thickness as a share of its radius, unless a button sets its own. */
  depthShare: 0.4,
};

/**
 * The tutorial's hint sign: in front, past the goblins at the castle wall,
 * so it is behind them, never in front of them. High enough to read without
 * looking down, and big enough for its distance. It is out of reach, so its
 * Next button stands apart, in front between the tool platforms, in the
 * reach band (boardLift, cm; the eyes are about 46 cm above the board).
 */
export const HINT_SIGN = {
  radius: 62,
  /** Bottom edge above the board. */
  y: 12,
  width: 36,
  height: 14.8,
  tiltDeg: 15,
  /** A new instruction pops in over this long (seconds). */
  popTime: 0.25,
  /** A finished lesson shows its ticked box this long before the next one (seconds). */
  doneTime: 1.2,
  /** Round "Next" poke button: its size, and its spot straight in front, tilted toward the eyes (cm, degrees). */
  nextRadius: 2.6,
  nextAt: 33.5,
  nextY: 9,
  nextTiltDeg: 40,
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
  /** The open pose: IWSDK's relaxed pose opened this much further (share of the way back from pressed). */
  openExtra: 0.35,
  /** Pinch pose: the thumb and index tips end this far apart, center to center, so the pads touch (meters). */
  pinchTouch: 0.012,
  /** Pinch pose IK: rounds, and the most each joint turns per step (degrees). */
  pinchIkRounds: 12,
  pinchIkStepDeg: 15,
  /** The ghost's mouth point: in front of the face and a little down (meters). */
  mouthForward: 0.16,
  mouthDown: 0.07,
};

/** Tutorial markers (src/ui/markers.ts). */
export const MARKERS = {
  /** Down arrow size (meters, world). */
  size: 0.03,
  /** Above the target (meters) and the bounce height. */
  lift: 0.02,
  bob: 0.012,
  bobSpeed: 4,
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
 * section 7). They live in boardLift: they rise with the board but never
 * turn. Just outside the ring handle and inside the courtyard, in the reach
 * band (REACH). 2 on each side, a bit forward. The ring's tube ends at 28.4
 * and the courtyard starts at 40, so a platform (8 wide) at 33.5 touches
 * neither (cm, degrees: 0 = front, positive = right).
 */
export const TOOL_SPOTS = {
  slingshot: { angleDeg: 30, radius: 33.5 },
  /** Megaphone and bell (build step 5). */
  rightSide: { angleDeg: 82, radius: 33.5 },
  /** Pepper shaker. */
  leftFront: { angleDeg: -30, radius: 33.5 },
  /** Fly swatter. */
  leftSide: { angleDeg: -82, radius: 33.5 },
  /** Platform top above the board (cm). Low, so the hand reaches it without lifting the arm. */
  platformTop: 6,
  /** Platform width (cm). */
  platformWidth: 8,
  /** Post under each platform, down to the board. */
  postRadius: 0.8,
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
  /**
   * The pouch: an open leather strip between the bands (cm), standing upright
   * and facing the shot. It bends back into a U (pouchSag deep) behind the
   * stone. Its height (pouchWidth) is less than the stone's, so the stone shows
   * above and below it. Low poly: a few flat segments.
   */
  pouchLength: 3.8,
  pouchWidth: 1.6,
  pouchSag: 0.9,
  pouchThickness: 0.25,
  pouchSegments: 6,
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

/** The pebble bowl beside the slingshot, on a post like the platforms. Soldiers keep topping it up. */
export const PEBBLE_BOWL = {
  angleDeg: 58,
  radius: 33.5,
  /** Rim height above the board (cm). A little above the platforms, so it stays in the reach band now that the board sits lower. */
  rimY: 9,
  /** Width and depth (cm). */
  width: 9,
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

/** Food (docs/giant-tools.md section 3). Costs are in TOOLS below. */
export const FOOD = {
  start: 4,
  max: 10,
  eatBasic: 1,
  /** A peppered goblin is seasoned. */
  eatSeasoned: 2,
};

/**
 * The food jar: a pot between the two left tool platforms, like the pebble
 * bowl on the right. It rises with the board but never turns. The pot has a
 * narrow neck, so the food shows as a little heap of food balls on its
 * mouth, one ball per food: easy to read (cm, degrees).
 */
export const FOOD_JAR = {
  angleDeg: -56,
  radius: 33.5,
  /** Pot height (the model is fitted to it). */
  height: 7,
  /** Pot bottom above the board. */
  bottomY: 0,
  /** Food balls on the mouth: size, and how far the heap sits below the pot top (cm). */
  ballSize: 1.3,
  heapSink: 0.4,
  /** Balls per layer of the heap, bottom first (the last number repeats). */
  layers: [6, 3, 1],
  ballColors: [0xf2c14e, 0xc9772c, 0x8fb04a, 0xd23c28, 0xe8d8b0],
  /** A ball pops in or out over this long (seconds). */
  popTime: 0.25,
  /** Crumbs that pop out of the jar when food goes in or out. */
  popColors: [0xf2c14e, 0xc9772c, 0xffffff],
};

/**
 * Price tag on each food tool's platform: a small wooden board with a food
 * ball and the cost, on the front edge, tilted toward the eyes, beside the
 * tool so the hand never covers it. The number is cream when the jar has
 * enough, red when it does not, and a tick while a paid use runs (cm, degrees).
 */
export const PRICE_TAG = {
  width: 4.6,
  height: 2.8,
  thickness: 0.35,
  /** Toward the player from the platform center, and sideways toward the front (cm). */
  inset: 2.6,
  side: 2.2,
  /** Leaning back from upright, toward the eyes (degrees). */
  tiltDeg: 40,
  woodColor: 0x6b4a2e,
  okColor: '#fff4dc',
  shortColor: '#ff5a4e',
  paidColor: '#9be27a',
};

/** Shared rules for the food tools (swatter, pepper; the megaphone and bell in step 5). */
export const TOOLS = {
  /**
   * Food tools cost nothing while the tutorial runs, so a player who used up
   * the jar is never locked out of a tool they are about to learn. Their
   * price tags say "Free". The costs below apply in later battles.
   */
  freeInTutorial: true,
  /** Food each one costs on its first use (docs/giant-tools.md). */
  cost: { swatter: 4, pepper: 3, megaphone: 6 },
  /** How long one paid use lasts (seconds). */
  duration: { swatter: 10, pepper: 8, megaphone: 0 },
  /** The hand must be open near the tool this long before closing it grabs (seconds). Same as the ring. */
  readyTime: 0.15,
  /** A held tool lets go only after the hand is open this long (seconds). */
  releaseHold: 0.25,
  /** The holding hand lost tracking (fast swings blur it): the tool stays this long before it lets go (seconds). */
  holdLostGrace: 0.6,
  /** Fist only, as in docs/controls-and-ui.md. True also accepts a pinch, like the ring and slingshot handles. */
  acceptPinch: false,
  /** Smoothing of a held tool, so tracking jitter does not shake it (seconds). */
  holdSmoothing: 0.02,
  /** Let go before or after a use: it glides back to its platform in this long (seconds). */
  returnTime: 0.35,
  /** Dropped mid-use: it hangs this long, then floats up to the hand area above its platform (seconds). */
  looseWait: 1,
  looseFloat: 0.5,
  /** The hand area: this far above the platform top (cm). */
  looseLift: 9,
  /** Use over: it shrinks, poofs and pops back onto its platform (seconds). */
  shrinkTime: 0.2,
  popTime: 0.25,
  /** It blinks in the last seconds of a use, so the end is no surprise. */
  warnTime: 2,
  /** Locked (not enough food): the colors are dimmed to this share. */
  dimShare: 0.45,
  /** Locked wobble after a refused grab (seconds, degrees). */
  wobbleTime: 0.45,
  wobbleDeg: 7,
  ropeColor: 0xb08850,
};

/**
 * How a tool sits in a closed fist (docs/controls-and-ui.md "Holding a
 * tool"). A fist grab snaps the tool into the hand the way it is held in
 * real life, whatever angle the hand grabbed it at: the handle runs through
 * the fist and the tool sticks out past the thumb. `at` is where the fist
 * holds it, along the handle from its end (board cm). `face` is where the
 * tool's front (its +z) points: 'palm' (out of the palm) or 'back' (toward
 * the wrist: the slingshot's shot goes the way the knuckles point, and the
 * swatter's flat face stands square to the palm, after the headset test).
 * A pinch grab keeps the angle it was grabbed at.
 */
export const HOLD = {
  /** The fist's hole, from the palm center: toward the knuckles and out of the palm (meters). */
  gripForward: 0.02,
  gripOut: 0.025,
  /**
   * A fist holds a handle across the palm at a slant, not square to the
   * forearm: the tool leans forward (toward the fingers) by this much from
   * the knuckle line, so it lines up with the knuckle bones (degrees).
   */
  tiltDeg: 35,
  /** Right after the grab the tool eases into the hand over about this long (seconds)... */
  snapTime: 0.15,
  /** ...with this smoothing, slower than when it is held, so it does not jump (seconds). */
  snapSmoothing: 0.05,
  /** `tiltDeg` on a pose replaces the shared tiltDeg for that tool. */
  poses: {
    // The swatter leans 10 degrees more, so its head reaches the ground without bending the wrist.
    swatter: { at: 3.5, face: 'back', tiltDeg: 45 },
    pepper: { at: 4.5, face: 'palm' },
    slingshot: { at: 3.5, face: 'back' },
  } as Record<'swatter' | 'pepper' | 'slingshot', { at: number; face: 'palm' | 'back'; tiltDeg?: number }>,
};

/**
 * Seeing attacks without sound (docs/controls-and-ui.md "Threat cues"): a
 * goblin hitting the wall flashes that part of the wall top red with a dust
 * puff. On by default: it helps players who cannot hear, and players with
 * the sound off.
 */
export const THREAT = {
  enabled: true,
  /** Wall top flash: width along the wall (cm), how long it fades (seconds), and the most at once. */
  flashWidth: 7,
  flashTime: 0.6,
  flashPool: 12,
  flashColor: 0xff3b2f,
  flashOpacity: 0.85,
  /** Dust puff on each hit. */
  dustColors: [0xc9b79a, 0xa8957a, 0xe0d4bd],
  dustCount: 5,
  dustSpeed: 0.18,
};

/** The fly swatter (docs/giant-tools.md). Crowd clearing near the wall. */
export const SWATTER = {
  handleLength: 25,
  handleRadius: 0.7,
  /** Flat head at the end (cm). */
  headWidth: 10,
  headHeight: 9,
  headThickness: 0.5,
  handleColor: 0xf2c14e,
  headColor: 0xd23c28,
  frameColor: 0x8a1f14,
  /** Grab zone along the bottom of the handle (cm from the end) and around it (meters). */
  gripFrom: 0,
  gripTo: 11,
  grabRadius: 0.06,
  /**
   * Resting on its platform, leaning back along the rim (away from the front)
   * this far from upright (degrees). Its head is then behind the left
   * shoulder, out of view, and the whole swatter stays inside the ring, so
   * the ring never passes through it. Grabbed thumb up like the slingshot
   * handle, the hand only turns a little (the ghost hand demo uses the same lean).
   */
  restLeanDeg: 18,
  /**
   * Hits are found along the whole path of the head since the last frame, so
   * fast swings that blur tracking still count. A goblin this close to that
   * path is hit (cm). Generous, like the goblins' pinch zone.
   */
  hitRadius: 6.5,
  /** The head must move at least this fast to hit (cm per second). Slow slams count. */
  minHitSpeed: 35,
  /** The head touches the ground (a swat) when its center is this close to it (cm)... */
  groundContact: 3.5,
  /** ...and must lift this high again before the next ground swat (cm). */
  rearmHeight: 6,
  /** Whoosh sound above this head speed (cm per second), at most this often (seconds). */
  whooshSpeed: 160,
  whooshGap: 0.35,
  splatColors: [0x6a8f3a, 0x8fb04a, 0xffffff, 0xd23c28],
};

/** The pepper shaker (docs/giant-tools.md). Seasons goblins for more food. */
export const PEPPER = {
  bodyHeight: 9,
  bodyRadius: 2.2,
  bodyColor: 0xb3261e,
  capColor: 0xd9d4c7,
  holeColor: 0x2a2018,
  /** Grab zone along the body (cm from the bottom) and around it (meters). */
  gripFrom: 1,
  gripTo: 8,
  grabRadius: 0.06,
  /**
   * Shake detection: the shaker's speed is smoothed over `speedSmoothing`.
   * A move faster than `shakeSpeed` that turns back on the last one is one
   * shake stroke. Two strokes within `shakeWindow` mean shaking, and pepper
   * keeps falling for `shakeHold` after the last stroke (seconds, cm per second).
   */
  speedSmoothing: 0.04,
  shakeSpeed: 22,
  shakeWindow: 0.7,
  shakeHold: 0.35,
  /** Goblins this close to the spot under the shaker are peppered (cm, flat distance), up to this far below it. */
  radius: 7,
  maxDrop: 70,
  /** Pepper specks: this often while shaking (seconds), this many each time. */
  speckEvery: 0.05,
  speckCount: 3,
  speckColors: [0x2a2018, 0x4a3a2a, 0x6b5a45],
  /** Shake sound at most this often (seconds). */
  soundGap: 0.22,
  /** A peppered goblin sneezes: dazed this long (seconds), and a goblin outside the wall stumbles back (cm per second). */
  sneezeTime: 1.2,
  stumbleSpeed: 22,
  stumbleHop: 45,
  /** A seasoned goblin's colors are multiplied by this (dusty brown). */
  seasonedTint: [0.85, 0.68, 0.55] as [number, number, number],
};

export const PARTICLES = {
  /** Raised from 96 for the falling pepper. */
  poolSize: 128,
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
  /** Food added per "Add food" press. */
  foodAdd: 3,
  /** "Start at wave": extra food per skipped wave, for the climbers that would have been eaten. */
  startFoodPerWave: 1,
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
  /** Hidden by default. The debug page's "FPS on/off" button (or key F) shows it, and ?fps in the URL on the hosted build. */
  showInDev: false,
  /** Panel spot: on the ring, a little left of front (clear of the Next button), standing just above it (cm, degrees). */
  radius: 27,
  angleDeg: -16,
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
