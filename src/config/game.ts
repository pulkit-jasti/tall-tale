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
  skirtColor: 0x6b5a45,
};

/**
 * The uneven low-poly ground (src/world/terrain.ts): rolling hills and dips
 * on top of the board's slope, flat faceted triangles lit by the sun. Flat
 * around the castle (reach band, wall) and at the camps. Small near the
 * castle, big far out. The roads ride over the hills (a little softened), so
 * goblins can disappear behind a hill and pop up again: a surprise, on purpose.
 */
export const TERRAIN = {
  /** Flat up to here (cm from the center, just past the goblins attacking the wall at 57), then the hills grow in until rampTo. */
  flatUntil: 62,
  rampTo: 105,
  /**
   * Hill height near (at rampTo) and at the far edge (cm). Raised from 2.5
   * and 10, then 7 and 22, after headset tests: the battlefield still looked
   * flat.
   */
  nearHeight: 13,
  farHeight: 32,
  /** The hills fade out again toward the board's edge, so it meets the skirt and the hills ring (cm from the center). */
  edgeFadeFrom: 545,
  edgeFadeTo: 592,
  /** Hill sizes (cm across): big rolling ones and smaller ones on top, and how much the small ones count (share). */
  sizes: [130, 42] as [number, number],
  smallShare: 0.42,
  /** How deep the dips go, as a share of the hill height (the rest rises). */
  dipShare: 0.65,
  /** On the roads the hills keep this share of their height (softer slopes to walk), back to full at roadFade past the road's edge (cm). */
  roadKeep: 0.75,
  roadFlat: 4,
  roadFade: 20,
  /** Flat only right at each camp: past the camp's size, flat until campFlat, full hills at campFade (cm). */
  campFlat: 2,
  campFade: 14,
  /** The ground mesh: rings this far apart near and far (cm), and points around each ring. Points are nudged, so no rings show. */
  ringStepNear: 4,
  ringStepMid: 9,
  ringStepFar: 14,
  segments: 160,
  /** How much each point is nudged (share of the gap to its neighbour). */
  jitter: 0.35,
};

/**
 * The grass colors on the uneven ground (src/world/grass.ts): lighter on the
 * tops of the bumps, darker in the dips (the sun's light on each facet does
 * the rest), a little darker next to the wall, worn and yellower along the
 * roads and dirty around the camps.
 */
export const GRASS = {
  /** Grass in the dips (blue-green) and on the tops (yellow-green). A wider range than before (0x7aad48 to 0xa3cc68), so the hills read. */
  // All the nature and sky colors were made more saturated (same lightness) twice after headset tests: they looked faded.
  // The board grass was then toned halfway back: the second step was too much for it.
  darkColor: 0x3da435,
  lightColor: 0xc1f04d,
  /** Each triangle is nudged this much in brightness (share) and hue (share of the color wheel). */
  vary: 0.08,
  hueVary: 0.012,
  /** Steep slopes turn earthier: this color, up to this share, from steepness slopeFrom to slopeTo (0 = flat, 1 = a wall). */
  slopeColor: 0x9c9a3c,
  slopeShare: 0.4,
  slopeFrom: 0.04,
  slopeTo: 0.25,
  /** Ash on the ground of the burned village: its color, and how far past the village's size it fades (cm). */
  ashColor: 0x5b5048,
  ashWidth: 10,
  /** Worn grass along the roads: its color, and how far out from the road's edge it fades (cm). */
  wornColor: 0xc9c559,
  wornWidth: 6,
  /** Dirt around the camps: its color, and how far past the camp's size it fades (cm). */
  dirtColor: 0xb8a351,
  dirtWidth: 16,
  /** The grass right outside the wall is darker, like a soft shadow (share, and how far out it fades, cm). */
  wallShade: 0.16,
  wallShadeTo: 78,
};

/**
 * Where people live on the board (src/world/settlements.ts), placed with a
 * reason, not at random: villages in the calmer ring between the castle and
 * the camps, beside a road (people live by the roads) but never on one, on
 * ground the terrain flattens for them, each with its farm fields; watch
 * towers on the hilltops beside the roads, watching them; one windmill on a
 * hill by a farm; wrecked siege machines near the enemy camps, left from old
 * battles; and forests out in the hilly far ring, away from the villages,
 * where the decor's tree groves grow. All merged into a few meshes.
 */
export const SETTLEMENTS = {
  villages: {
    count: 4,
    /** Distance from the center (cm, between the castle and the camps at 227 to 277), radius of each village (cm), and houses in each. */
    from: 105,
    to: 240,
    radius: [16, 21] as [number, number],
    houses: [3, 5] as [number, number],
    /** Gap from the village's edge to the nearest road (cm): close by a road, never on it. */
    roadGap: [4, 30] as [number, number],
    /** Keep this far from the enemy camps and from each other (cm). */
    campGap: 70,
    spacing: 115,
  },
  houses: {
    /** One wall tile (cm): a house is 1 tile across, a bit taller than a soldier (2.5 cm). */
    size: 4.5,
    twoStoryShare: 0.3,
    chimneyShare: 0.5,
    woodShare: 0.5,
  },
  farms: {
    /** Fields per village, and each field's size (cm, long side and short side). */
    perVillage: [1, 2] as [number, number],
    length: [12, 16] as [number, number],
    width: [9, 12] as [number, number],
    /** Gap between the village and its field (cm), rows and crops apart (cm), fence piece length (cm). */
    gap: 3,
    rowGap: 2.2,
    cropGap: 2,
    fence: 3,
  },
  towers: {
    count: 4,
    /** Along the roads, which run from the wall to the camps (cm from the center). */
    from: 110,
    to: 300,
    /** Right beside a road: the gap from the road's edge (cm). */
    roadGap: [6, 26] as [number, number],
    spacing: 110,
    /** One tower piece (cm across and tall). */
    size: 3.4,
  },
  /**
   * The one windmill: its height (cm) with the roof, on the highest spot this
   * close to a field (cm). A mill house this many floors high, its sails
   * (radius in wall tiles) on the front wall near the top, this far out from
   * it (tiles), turning this fast (radians per second).
   */
  windmill: { height: 15, near: 70, floors: 3, sailRadius: 0.85, axleOut: 0.12, spin: 0.8 },
  ruins: {
    count: 4,
    /** This far past an enemy camp's edge (cm), and how wide (cm). */
    campGap: [14, 45] as [number, number],
    width: [5, 7] as [number, number],
  },
  forests: {
    count: 7,
    from: 260,
    to: 545,
    radius: [55, 90] as [number, number],
    /** Keep this far from villages, fields and the far settlements (cm). */
    clear: 50,
  },
  /** Out past the camps, in goblin lands: */
  /** A goblin hamlet behind each camp (the gap past the camp's edge, cm), with a cabin, tents, a cage and branch fences. */
  goblinHamlets: { gap: [30, 55] as [number, number], radius: [12, 15] as [number, number], cabinHeight: 6, tentHeight: 4 },
  /** One kingdom village the goblins burned: roofless houses with missing walls, wrecked carts, ash on the ground. */
  burnedVillage: { from: 290, to: 430, radius: 18, houses: 4, campGap: 70 },
  /** Lumber camps at the edge of a forest, on its castle side: log stacks, logs, stumps, planks and a tent. */
  lumberCamps: { count: 2, radius: 8 },
  /** One stone quarry on a far hillside: big cut stones and rock piles. */
  quarry: { from: 300, to: 520, radius: 12 },
  /**
   * Tall landmarks on the highest far hills, spread around the circle, so the
   * horizon has things to spot. One of each kind, in this order: a tall
   * watchtower, a hexagon mage tower, a gatehouse on the old border, a
   * ruined tower and a small keep. About 30 cm tall at most.
   */
  landmarks: {
    from: 300,
    to: 535,
    spacing: 190,
    kinds: ['tallTower', 'mageTower', 'gatehouse', 'ruinedTower', 'keep'] as LandmarkKind[],
    /** Tower piece size (cm across and per floor). */
    size: 3.6,
  },
};

export type LandmarkKind = 'tallTower' | 'mageTower' | 'gatehouse' | 'ruinedTower' | 'keep';

/** One kind of decor: its models (in public/gltf/, without .glb), sizes, how many, and how far it keeps from roads (cm). */
export interface DecorKind {
  files: string[];
  height: [number, number];
  count: number;
  clear: number;
  /** Some grow in groups: how many groups, how wide each is (cm), and the share of the count that grows in them. */
  groups?: { count: number; radius: number; share: number };
  /** The groups grow inside the forests (SETTLEMENTS.forests). */
  inForests?: boolean;
}

/**
 * Decor on the board (trees, rocks, bushes, flowers, stumps), from the
 * Kenney Nature Kit (docs/assets.md). Static, so all of it is merged into
 * one mesh per material: about a dozen draw calls however many there are.
 * The kit's mint greens are tinted to match the grass.
 */
export const DECOR = {
  /** Spread between these distances from the center (cm). */
  from: 72,
  to: 565,
  /** Material name to color, for the kit's greens. */
  tints: { grass: 0x5e9e3c, leafsGreen: 0x4f9437, leafsDark: 0x3a7432 } as Record<string, number>,
  kinds: [
    {
      files: ['tree_default', 'tree_oak', 'tree_cone', 'tree_fat', 'tree_pineRoundA', 'tree_pineTallA', 'tree_simple', 'tree_small', 'tree_tall', 'tree_pineSmallA'].map((f) => `trees/nature/${f}`),
      height: [6, 14],
      count: 260,
      clear: 4,
      groups: { count: 26, radius: 32, share: 0.7 },
      inForests: true,
    },
    {
      files: ['rock_largeA', 'rock_largeB', 'rock_largeC', 'rock_largeD', 'rock_smallA', 'rock_smallB', 'rock_smallC', 'rock_smallD', 'rock_tallA', 'rock_tallB', 'rock_tallC'].map((f) => `rocks/nature/${f}`),
      height: [1.5, 7],
      count: 140,
      clear: 3,
      groups: { count: 18, radius: 14, share: 0.5 },
    },
    {
      files: ['plant_bush', 'plant_bushLarge', 'plant_bushSmall', 'plant_bushDetailed'].map((f) => `plants/nature/${f}`),
      height: [1.5, 4],
      count: 240,
      clear: 2,
    },
    {
      files: ['flower_yellowA', 'flower_redA', 'flower_purpleA'].map((f) => `plants/nature/${f}`),
      height: [1.2, 2.4],
      count: 260,
      clear: 1.5,
      groups: { count: 40, radius: 10, share: 0.8 },
    },
    {
      files: ['mushroom_redGroup', 'mushroom_tanGroup', 'stump_round', 'stump_old', 'log', 'log_stack'].map((f) => `plants/nature/${f}`),
      height: [1, 3],
      count: 90,
      clear: 2,
    },
  ] as DecorKind[],
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
  /** Height of the road ribbon above the ground (cm). Raised from 0.15 for the hills, so no hill facet pokes through it. Units on the road stand on it. */
  lift: 0.8,
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

/**
 * The giant's seat and body (src/world/giant.ts): the hole the player sits in
 * is filled with packed earth flush with the courtyard, and a chunky low-poly
 * giant from the waist up comes out of it, under the head. Real sizes
 * (meters, not board cm), so it is the player's own body size. It follows the
 * head gently and sits a little behind it, below the normal view, so it never
 * covers the ring, the tools or the courtyard.
 */
export const GIANT = {
  floor: {
    /** Packed earth in the middle, a ring of flat stones at the edge (board cm). */
    color: 0x8a7458,
    stoneColor: 0xa49c8c,
    stoneDarkColor: 0x8f8778,
    stones: 18,
    /** Stones from this far out to the hole's edge (cm). */
    stonesFrom: 20,
  },
  /** Shoulders this far below the eyes (meters). Low enough that they never cover the ring or the tools. */
  shoulderDrop: 0.27,
  /** The body's middle sits this far behind the head (meters), so the chest is under the chin, not in the view. */
  behind: 0.07,
  /** Half widths (meters): the waist at the belt, the chest, the shoulders (end of the shoulder balls). */
  waist: 0.13,
  chest: 0.14,
  shoulders: 0.15,
  /** Front to back depth as a share of the width (a body is flatter than it is wide). */
  depthShare: 0.72,
  /** The torso is at least this tall (meters), even with the board raised high. */
  minHeight: 0.12,
  belt: 0.035,
  /** Follows the head's position with this smoothing (seconds)... */
  followSmoothing: 0.25,
  /** ...and turns toward where the player faces only past this angle (degrees), slowly (seconds). */
  turnDeadDeg: 20,
  turnSmoothing: 0.9,
  colors: {
    tunic: 0x5f7f3a,
    tunicDark: 0x4c6a2c,
    belt: 0x5a3a22,
    buckle: 0xf2c14e,
    collar: 0x8a6a42,
    patch: 0x7a5a36,
  },
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
  // Heights raised about 11% (from 3.5, 3 and 3.5) after a headset test, so they read better on the hills.
  grunt: { height: 3.9, speed: 6, tint: [1, 1, 1], moveClip: 'walk', moveClipSpeed: 1.3 },
  runner: { height: 3.35, speed: 13, tint: [1.15, 1.05, 0.45], moveClip: 'sprint', moveClipSpeed: 1.4 },
  climber: { height: 3.9, speed: 5.5, tint: [0.85, 0.6, 1.15], moveClip: 'walk', moveClipSpeed: 1.2 },
};

export const GOBLIN_RULES = {
  /** Things (not goblins or soldiers, they poof) shrink away over this long (seconds), with a small elastic swell first. */
  vanishTime: 0.32,
  /**
   * Climbers on the rampart run about, causing chaos: dashes of up to this
   * far along the wall (degrees, between the two towers), at this share of
   * their speed, with stops of this long between them (seconds, from, to).
   */
  rampartDashDeg: 18,
  rampartRunShare: 1.8,
  rampartStop: [0.15, 0.6] as [number, number],
  /** The stretch of wall under a climber on the rampart flashes red this often (seconds), like a wall hit, without damage. */
  rampartMarkEvery: 0.35,
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
/**
 * Goblins the tutorial brings for a tool's use lesson (src/units/lessonBait.ts),
 * so there is always something to use it on, waiting without hurting the
 * castle: calm climbers on the rampart in front (swatter, pepper, stun tool),
 * this many, this far apart (degrees), and grunts walking back and forth on
 * the road in front for the slingshot (this many, about this far out, on a
 * stretch this long either way, coming in from this far, cm).
 */
export const LESSON_BAIT = {
  rampartCount: 3,
  rampartSpreadDeg: 11,
  /** One moving goblin for the first shot (3 walked on past the keg lesson's goblins, which felt odd). */
  patrolCount: 1,
  patrolRadius: 115,
  patrolHalf: 14,
  approach: 25,
};

export const CASTLE_HEALTH = {
  maxHealth: 100,
  /**
   * Damage per wall hit from a grunt or runner (one hit every GOBLIN_RULES.wallHitInterval).
   * Balanced with troops in build step 5 (was 1.5 for quick testing): ten
   * goblins at the wall take about a third of the castle in 30 seconds.
   */
  wallHitDamage: 0.35,
  /** Damage per second from each intruder in the courtyard. Faster than outside attacks. */
  intruderDamagePerSec: 2,
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
  stalemateSeconds: 90,
  /**
   * The stalemate clock also starts over whenever the goblin nearest the
   * castle got at least this much closer (cm, checked every progressEvery
   * seconds). Goblins still walking in, or fighting their way in, are never
   * a stalemate (waves ended with goblins on the way after step 6).
   */
  progressCm: 1.5,
  progressEvery: 2,
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
  /** Panel spot, its middle, fixed in front of the player (cm): over the front wall, the button within reach. Moved back and up from 36 and 20. */
  radius: 41,
  y: 24,
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

/**
 * Pause (docs/controls-and-ui.md section 5): a wrist button on the left
 * wrist, poked with the right index finger, and a pause panel in front of
 * the player with Resume, Reset table, Measure reach and Restart. The
 * panel is placed from the head when it opens (not on the board), so it is
 * always in reach, even when the board ended up somewhere odd.
 */
export const PAUSE = {
  wrist: {
    /** The button shows while the left palm faces the eyes this well (cosine of the angle)... */
    faceDot: 0.6,
    /**
     * ...for this long, and hides only once the palm clearly turned away
     * (below hideDot) for hideHold (seconds). The wide gap and the long hide
     * hold stop the flicker from tracking noise (headset test after step 6).
     */
    showHold: 0.3,
    hideDot: 0.25,
    hideHold: 0.6,
    /** Only while the palm is this close to the eyes (meters): a hand on the lap does not count. */
    maxDistance: 0.6,
    /** It never hides while the right index fingertip is this close to it (meters): the player is poking it. */
    keepNear: 0.1,
    /**
     * Button size (cm), out from the middle of the palm (meters). 3 cm out
     * (was 1.8), clear of the hand's own mesh, which it flickered through.
     */
    radius: 1.8,
    out: 0.03,
    /**
     * The palm is filtered with a One Euro filter before the button follows
     * it (hand joints shake by a few mm every frame): `still` is the cutoff
     * when the hand is still (Hz, lower is steadier), `follow` how quickly it
     * catches up when the hand moves. The palm's direction gets its own.
     */
    filter: { still: 0.8, follow: 8, derivative: 1 },
    normalFilter: { still: 0.6, follow: 1.5, derivative: 1 },
    /**
     * It stands still where the palm was when it came out, and only glides
     * after the palm (over `glide` seconds, stopping within `settle`) once
     * the palm moved `reanchor` away (meters). Standing still, it cannot
     * shake (headset tests after step 6: following the palm, even filtered,
     * still looked like it vibrated).
     */
    reanchor: 0.045,
    glide: 0.08,
    settle: 0.004,
    /** It only turns to face the eyes again past this angle (degrees), and only while it glides. */
    turnDeg: 10,
    /**
     * While the right index fingertip is within `lockNear` of it (meters),
     * the button does not move at all, so it holds still to be poked, unless
     * the palm moved more than `lockBreak` away (meters).
     */
    lockNear: 0.12,
    lockBreak: 0.06,
    /** Drawn after everything, without the depth test, so the hand never cuts into it. */
    renderOrder: 45,
    /** It pops in and out over this long (seconds). */
    popTime: 0.15,
  },
  /**
   * The panel follows the head lazily, like the Quest's own menus: it stays
   * still while the head turns a little (so it can be poked), and swings
   * back in front once the head turned more than followDeg away. It is never
   * behind the player.
   */
  follow: {
    followDeg: 25,
    /** Swings back with this smoothing (seconds), and moves with the head's position too. */
    smoothing: 0.3,
    /** It is in front again once within this angle (degrees), then it stops. */
    settleDeg: 3,
  },
  /** The panel, in cm from the seat like END_PANEL (sized with the board). */
  panel: {
    radius: 41,
    y: 25,
    tiltDeg: 20,
    width: 38,
    height: 23,
    buttonRadius: 2.9,
    /** Gap between button centers (cm). */
    buttonGap: 8.8,
    buttonMargin: 1.2,
    /** Drawn after everything else (above the markers and ghost hands), never hidden by the castle or the sign. */
    renderOrder: 40,
  },
};

/** Poke buttons (src/ui/pokeButton.ts), in cm like the rigs they sit in. */
export const POKE = {
  /** Ready when the fingertip is this close in front of the button face, and no longer Ready once past readyDistance times readyOut (a gap, so it never flickers). */
  readyDistance: 5,
  readyOut: 1.35,
  /** The cap follows the fingertip in at this rate (per second): slower than the finger's own shake, so it does not vibrate. */
  capFollow: 14,
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
 * so it is behind them, never in front of them. Its bottom edge is at eye
 * height, so it only covers sky and hills, never the board (the board's far
 * edge is just below eye level). Big enough for its distance. It is out of
 * reach, so its Next button stands apart, in front between the tool
 * platforms, in the reach band (boardLift, cm; the eyes are about 46 cm
 * above the board).
 */
export const HINT_SIGN = {
  radius: 62,
  /** Bottom edge above the board (was 12, which covered the front of the board; 48 felt too high). It only covers the far edge of the board. */
  y: 43,
  width: 36,
  height: 14.8,
  /** Tilt back (degrees). Negative tips its top toward the player, so it faces the eyes looking a little up. */
  tiltDeg: -5,
  /** A new instruction pops in over this long (seconds). */
  popTime: 0.25,
  /** A finished lesson shows its ticked box this long before the next one (seconds). */
  doneTime: 1.2,
  /**
   * Round "Next" poke button: its size, and its spot straight in front,
   * tilted toward the eyes (cm, degrees). Moved back toward the wall and up
   * a little after the step 6 test (was 33.5 out, 9 up: too close to the ring,
   * hands on the ring pressed it). Still about 49 cm from the eyes.
   */
  nextRadius: 2.6,
  nextAt: 38.5,
  nextY: 15,
  nextTiltDeg: 40,
  /** It blinks while it waits to be poked (emissive pulse, per second), so it catches the eye. */
  nextBlinkColor: 0xfff1a8,
  nextBlinkIntensity: 0.75,
  nextBlinkSpeed: 2.2,
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
  /** The pause demo: where the left palm shows the pause button, from the eyes (meters forward, left, down). */
  palmForward: 0.3,
  palmLeft: 0.07,
  palmDown: 0.14,
  /** Ghost aim dots (the keg lesson): how many, their size (meters), how high the arc rises (share of its length), flow speed. */
  aimDots: 18,
  aimDotSize: 0.0045,
  aimArc: 0.16,
  aimFlow: 0.5,
};

/** Tutorial markers (src/ui/markers.ts). */
export const MARKERS = {
  /** Down arrow size (meters, world). */
  size: 0.03,
  /** Above the target (meters) and the bounce height. */
  lift: 0.02,
  bob: 0.012,
  bobSpeed: 4,
  /** A fallback pulse: the arrow grows this much more for this long (seconds). */
  pulseScale: 0.8,
  pulseTime: 2.5,
};

/**
 * The 3D pointer arrows (src/ui/pointerArrow.ts): in front of the face, a
 * little low, pointing at something only while it is at the very edge of the
 * headset's view or out of it (the Quest 3S sees about 96 by 90 degrees, so
 * about 45 degrees from the middle is the edge). Each blinks (glow between
 * blinkMin and blinkMax, blinkSpeed times a second). `lesson`:
 * gold, softly, at the lesson's target. `threat`: red, fast, at a goblin
 * hitting the wall, climbing it or running on it out of view, a little
 * lower so both fit (meters, degrees, seconds).
 */
export const POINTER = {
  length: 0.055,
  distance: 0.4,
  smoothing: 0.12,
  /** Shows once the target is this far from the middle of the view, hides again once within hideDeg. */
  showDeg: 38,
  hideDeg: 32,
  popTime: 0.2,
  renderOrder: 36,
  lesson: { color: 0xf2c14e, glow: 0xb07a10, below: 0.09, blinkMin: 0.25, blinkMax: 0.8, blinkSpeed: 0.8 },
  /** The red one blinks fast and strong, to catch the eye. */
  threat: { color: 0xe0342a, glow: 0xff2a10, below: 0.16, blinkMin: 0, blinkMax: 1.6, blinkSpeed: 3.5 },
  /** The red arrow: only for a goblin hitting the wall that has been out of view this long (seconds), so a glance away does not show it. */
  threatAfter: 1.5,
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
  /**
   * The megaphone, or the bell when there is no mic. Only one of them is
   * ever out, so they use the same spot.
   */
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
  /** Pebbles in flight, falling or lying on the ground at once (pool size). Raised from 8, since landed pebbles now stay a while. */
  maxPebbles: 16,
  /** A landed pebble lies where it fell this long (seconds), then shrinks away over pebbleFade (the shared despawn look). */
  pebbleRest: 2.5,
  pebbleFade: 0.35,
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
  /**
   * It stands on the middle of the platform's front edge (toward the
   * player), its bottom this far above the platform's top, and this far past
   * the edge (cm, negative is just inside it), on every platform the same,
   * so they sit symmetrically. Above the top, so the ring never hides it.
   */
  lift: 0.2,
  out: -0.6,
  /** Leaning back from upright, toward the eyes (degrees). */
  tiltDeg: 25,
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
  cost: { swatter: 4, pepper: 3, megaphone: 6, bell: 6 },
  /**
   * How long one paid use lasts (seconds). The megaphone and the bell are one
   * use each: this is the short window to keep screaming or ringing for a
   * longer stun, then the tool goes back to its platform.
   */
  duration: { swatter: 10, pepper: 8, megaphone: 2.5, bell: 2.5 },
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
    // A pistol grip: the cone points the way the knuckles point, so it is in front of the mouth when the fist is.
    megaphone: { at: 3, face: 'back', tiltDeg: 15 },
    // The handle on top of the bell, thumb up, the bell hanging below the fist.
    bell: { at: 2, face: 'palm' },
  } as Record<'swatter' | 'pepper' | 'slingshot' | 'megaphone' | 'bell', { at: number; face: 'palm' | 'back'; tiltDeg?: number }>,
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
  /**
   * Peppered goblins keep sneezing, like an old cartoon: every so often
   * (seconds, from, to) the head jerks forward for sneezeJerkTime with a puff
   * of pepper, and red pepper flakes circle over the head (like the dizzy
   * stars, one instanced mesh): this many, this big and this far out (cm), this fast.
   */
  sneezeEvery: [1.4, 3.2] as [number, number],
  sneezeJerkTime: 0.35,
  sneezeColors: [0xffffff, 0xf1e6d0, 0xd23c28],
  flakeCount: 3,
  flakeSize: 0.45,
  flakeOrbit: 1.1,
  flakeSpeed: 4,
  flakeColor: 0xd8341f,
};

/**
 * The megaphone (docs/giant-tools.md): hold it and scream. The mic loudness
 * (Web Audio, src/audio/mic.ts) passing `screamLevel` for `screamHold` is a
 * scream. It stuns every goblin, and a longer scream stuns longer.
 */
export const MEGAPHONE = {
  /** Cone (open wide end) along the tool's -z on top of a short grip (cm). */
  gripLength: 6,
  gripRadius: 0.9,
  coneLength: 13,
  coneMouth: 1.1,
  coneEnd: 3.6,
  /** The cone starts this far behind the grip (toward the face, cm). */
  coneBack: 3,
  bodyColor: 0xe8e2d0,
  bandColor: 0xd23c28,
  gripColor: 0x3b2b1f,
  gripFrom: 0,
  gripTo: 6,
  grabRadius: 0.06,
  /**
   * Mic loudness (RMS of the samples, 0 to 1) that counts as a scream, and
   * how long it must last (seconds). Lowered from 0.12 after the first
   * headset test (it did not trigger). The debug page's mic column shows the
   * loudest level while the megaphone is held, to tune it.
   */
  screamLevel: 0.04,
  screamHold: 0.1,
  /**
   * The loudness meter on top of the cone, shown while it is held: a thin
   * bar that fills as the player gets louder, and a pulsing red dot at
   * `targetShare` of its length, where the scream level is. Filling past the
   * dot stuns (cm, seconds).
   */
  meterWidth: 0.5,
  meterLift: 0.35,
  targetShare: 0.8,
  /** The bar drops back this slowly, so a shout is easy to read. */
  meterFall: 0.18,
  meterTrackColor: 0x2a2018,
  meterLowColor: 0x5ad15a,
  meterHighColor: 0xffd23f,
  meterFullColor: 0xff4a2a,
  targetColor: 0xff2a2a,
  /** The loudness is smoothed this much (seconds). */
  levelSmoothing: 0.05,
  /** Sound waves out of the cone while screaming: this often (seconds). */
  waveEvery: 0.12,
  waveColors: [0xffffff, 0xfff1b8, 0xcfe8ff],
};

/** The bell (docs/giant-tools.md): the hands-only twin of the megaphone. Shake it to stun every goblin. */
export const BELL = {
  /** Wooden handle on top along +y from the fist (cm), the brass bell hanging below it. */
  handleLength: 4,
  handleRadius: 0.75,
  bellHeight: 6,
  bellMouth: 3.2,
  brassColor: 0xd9a63a,
  handleColor: 0x6b4a2e,
  clapperColor: 0x5a4330,
  gripFrom: 0,
  gripTo: 4,
  grabRadius: 0.06,
  /** Shake detection, like the pepper: a quick move that turns back on the last one is a ring (cm per second, seconds). */
  speedSmoothing: 0.04,
  ringSpeed: 30,
  ringWindow: 0.7,
  /** Harder shaking means a longer stun: the shake speed from ringSpeed up to this gives the full extra stun. */
  hardSpeed: 140,
  /** Ring sound at most this often (seconds). */
  soundGap: 0.16,
};

/** The stun of the megaphone and the bell: every goblin on the board stops, dizzy. */
export const STUN = {
  /** The first scream or ring stuns this long (seconds)... */
  baseSeconds: 3.5,
  /** ...a harder ring adds up to this much at once... */
  hardExtra: 2,
  /** ...and keeping on screaming or ringing adds this per second... */
  extraPerSecond: 1.5,
  /** ...up to this long in total (seconds). */
  maxSeconds: 8,
  /** The shock ring across the board: how far it goes (cm) and how long it takes (seconds). */
  ringRadius: 260,
  ringTime: 0.9,
  ringColor: 0xfff1b8,
  /** Dizzy stars over each stunned goblin (2 each, spinning). */
  starColor: 0xffd84a,
  starSize: 0.55,
  starOrbit: 1.2,
  starSpeed: 6,
};

/**
 * Triggers on the roads (docs/map.md section 5): powder keg, boulder and
 * leaning tree. Shot with the slingshot (each registers as a SlingTarget).
 * Each happens once and resets at the start of each wave. Explosions set off
 * the triggers near them (chain reactions). Sizes in cm, times in seconds.
 */
export const TRIGGERS = {
  /** Aim assist share (like AIM_ASSIST.typeShare for goblins). Big still things, so the full bend. */
  assist: 1,
  /** A trigger the slingshot aims at wobbles a little (degrees, speed). */
  aimWobbleDeg: 5,
  aimWobbleSpeed: 16,
  /**
   * Easy to see (build step 6, nobody noticed them in the step 5 playtest):
   * the ground is flat under each trigger and on the way from it to the
   * castle, so no hill hides it from the seat, and the decor keeps clear.
   * `flat` is the flat spot's radius per kind, `sight` the share of its
   * distance where the extra flat spots on the way in sit (radius `sightSize`),
   * and `clear` how far villages, towers and decor keep from it (cm).
   */
  ground: {
    flat: { keg: 9, boulder: 14, tree: 10 } as Record<'keg' | 'boulder' | 'tree', number>,
    sight: [0.86, 0.72],
    sightSize: 5,
    clear: 16,
  },
  /**
   * How each trigger shows what it is, with props in the world (no floating
   * UI), in this red (the keg's bands): a pry bar with a red rag flag under
   * the boulder (the tree has autumn leaves). Plus the wood of the props.
   */
  paint: 0xe0342a,
  woodColor: 0x8a5a34,
  /**
   * "This can be used now": while goblins are near a trigger it glows softly
   * (emissive only, pulsing). When a group walks right past it, a short
   * "now!" cue: a stronger pulse and a sound from its direction (at most
   * every `nowGap` seconds per trigger). No floating UI.
   */
  cue: {
    /** Goblins this close (flat, cm) count as near. */
    nearRadius: 24,
    /** This many goblins this close (cm) is a group right at it: "now!". */
    nowRadius: 12,
    nowCount: 2,
    nowGap: 6,
    /** How long the strong "now!" pulse lasts (seconds). */
    nowTime: 1.2,
    /** Goblins are counted this often (seconds), not every frame. */
    checkEvery: 0.1,
    glowColor: 0xffc23a,
    glowMin: 0.15,
    glowMax: 0.55,
    glowSpeed: 5,
    nowColor: 0xffe27a,
    nowIntensity: 1,
  },
  /**
   * The trigger lessons (wave 2): a small group walks to the trigger in front
   * of the player and waits right in what it does until the player sets it
   * off, however many tries that takes.
   */
  lesson: {
    group: 3,
    /** They start this far before their waiting spot (cm), a few cm apart. */
    approach: 40,
    spacing: 4,
  },
  keg: {
    /** Raised from 2.6, then 3, in build step 6, so it reads from the seat. */
    height: 4.2,
    /** Sideways from the road center (cm), so goblins walk past it. */
    side: 5,
    hitRadius: 3.3,
    /** Goblins this close are knocked out. */
    blastRadius: 13,
    /**
     * Other triggers this close are set off by the blast. 0 since the step 6
     * test: each trigger does only its own thing, a keg never sets off a
     * boulder or a tree.
     */
    chainRadius: 0,
    /** Bright red bands, so it reads as explosive and stands out from the scenery. */
    tint: [1.5, 0.55, 0.42] as [number, number, number],
    debris: 6,
    fireColors: [0xffd84a, 0xff8a2a, 0xd23c28, 0x5a5048, 0xffffff],
  },
  boulder: {
    /** Raised from 4. */
    size: 5,
    /** The hill under it, and how far it sits from the road center (cm). */
    hillWidth: 11,
    side: 9,
    hitRadius: 3.4,
    /** Pale stone with a green mossy top (the rocks around are orange). */
    stoneColor: 0xd9d3c6,
    mossColor: 0x6fae3a,
    /** The warning flag on the hill beside it: an upright pole this tall, and the red rag at its top (cm). */
    poleHeight: 10,
    flagWidth: 3.4,
    flagHeight: 2.4,
    /** Rolling speed down the road toward the castle (cm per second). */
    speed: 42,
    /** Goblins this close to the rolling boulder are squashed. */
    crushRadius: 4.5,
    /** It stops this far from the end of its road (cm), then crumbles. */
    stopShort: 4,
    debris: 4,
    dustColors: [0xc9b79a, 0xa8957a, 0x8a8a8a],
  },
  tree: {
    /** Raised from 12. */
    height: 14,
    /** Its trunk stands this far from the road center (cm), leaning over the road. */
    side: 5.5,
    leanDeg: 12,
    hitRadius: 4,
    /** Its leaves (only the leaf triangles) are this autumn orange, so it stands out from every other tree. */
    leafColor: 0xe8742a,
    /** It falls across the road in this long, until its crown rests on the ground (at most 90 degrees). */
    fallTime: 0.55,
    /** For the resting angle: the crown starts this share up the trunk, and the trunk's radius (cm). */
    crownFrom: 0.35,
    trunkRadius: 0.6,
    /** Share of the crown's radius that must stay above the ground (leaves may just touch it, never sink half in). */
    crownRest: 0.75,

    /** The road stays closed this long, then the tree poofs away and the road opens. */
    blockSeconds: 12,
    debris: 4,
    leafColors: [0x6a8f3a, 0x8fb04a, 0x5a7a30],
  },
  /** Flying planks and wood from blasts: a small pool, they fly, bounce once and shrink away. */
  debris: { pool: 14, size: 1.4, life: 1.1, speed: 70, hop: 90 },
};

/**
 * Troops (docs/core-loop.md section 2): squads of soldiers come out of the
 * castle while a wave is fought, walk the roads outward toward an attacking
 * camp, and fight the goblins they meet with simple timed hits. On their own
 * they lose slowly, so the player is always needed. They go back home when
 * they reach the camp or when the wave ends. Sizes in cm, times in seconds.
 */
export const TROOPS = {
  /** Most soldiers on the board at once (they share the unit budget with the goblins). */
  /**
   * Was 12 (squads of 3 to 4 every 10 s, the soldiers won too much), then 4
   * in squads of 2 for testing. Step 7 balance: 8 in squads of 2 to 3, with
   * the three kinds (archers shoot from range, helmets take an extra hit).
   * Tune after the headset test and the stress test with troops.
   */
  max: 8,
  /** Soldiers per squad (from, to). */
  squadMin: 2,
  squadMax: 3,
  /** A new squad comes out this often while a wave runs, the first one this long after the wave starts. */
  squadEvery: 14,
  firstSquadAt: 4,
  /** Gap between soldiers of one squad leaving (seconds). */
  leaveGap: 0.7,
  /** The same size as the goblins (grunts 3.9 cm), raised from 2.5 after the step 6 test. */
  height: 3.9,
  speed: 5.5,
  speedJitter: 0.1,
  laneJitter: 1.6,
  /** A goblin this close is fought (cm). Runners rush past and are never fought. Raised from 4 with the bigger soldiers. */
  engageRange: 5,
  /** Soldiers take this many hits, grunts take 1. */
  hitsToDown: 2,
  /** A soldier strikes this often, and a strike lands this often (share). */
  strikeEvery: 1.4,
  strikeChance: 0.5,
  /** A goblin fighting a soldier strikes back this often, landing this share. */
  goblinStrikeEvery: 1.1,
  goblinStrikeChance: 0.6,
  /** Sword clash sound at most this often (seconds). */
  clashGap: 0.3,
  poofColors: [0xffffff, 0xc9d4e8, 0x8aa0c8],
  /** Units farther than this from the center (cm) update their animation every other frame. */
  farAnimFrom: 150,
};

/**
 * Gear on the characters (build step 7, src/units/gear.ts). Every piece is
 * merged into the character's own skinned mesh and bound to a small extra
 * bone under a hand or the head, so it moves with the animation and costs no
 * extra draw call. Hiding a piece scales its bone to almost nothing.
 *
 * Numbers are in the character model's own units (the Kenney rig is about
 * 0.84 units tall, before it is sized to TROOPS.height or a goblin height).
 * Each bone's frame is the rig's bind pose: the right arm points along -x,
 * the left arm along +x, the head and torso up +y, and +z is the front.
 * While walking the arms hang 45 degrees down, so for the arms "up" is about
 * [0.7, 0.7, 0] (right) and [-0.7, 0.7, 0] (left), and "outward" is about
 * [0.7, -0.7, 0] (right) and [0.7, 0.7, 0] (left). Tune these in the headset.
 */
export type GearBone = 'arm-right' | 'arm-left' | 'head' | 'torso';

export interface GearPiece {
  /** A glTF file in public/gltf/ (its colors are matched to the body's palette), or a shape made in code. */
  model?: string;
  shape?: 'helmet' | 'cap' | 'bow' | 'quiver' | 'plume';
  bone: GearBone;
  /** Where the anchor point goes, in the bone's frame. */
  at: [number, number, number];
  /** The model's point that sits at `at` (the grip), in the model's own units. */
  anchor: [number, number, number];
  /** The model's main axis (for example a sword's blade) and where it points in the bone's frame. */
  axis: [number, number, number];
  dir: [number, number, number];
  /** A second model axis (for example a blade's flat side) and roughly where it points. */
  axis2: [number, number, number];
  dir2: [number, number, number];
  scale: number;
  /** Shape colors (code shapes only): main and trim. */
  color?: number;
  trim?: number;
}

/** A recolor of the body's own palette: texture spots in this box (u from, to, v from, to) take this color, keeping their shading. */
export interface Recolor {
  mesh: 'body' | 'head';
  uv: [number, number, number, number];
  color: [number, number, number];
}

const RIGHT_HAND: [number, number, number] = [-0.26, 0, 0.04];
const LEFT_HAND: [number, number, number] = [0.26, 0, 0.04];
/** Bone frame directions while the arms hang (see above). */
const R_UP: [number, number, number] = [0.71, 0.71, 0];
const R_OUT: [number, number, number] = [0.71, -0.71, 0];
const L_UP: [number, number, number] = [-0.71, 0.71, 0];
const L_OUT: [number, number, number] = [0.71, 0.71, 0];

export const GEAR = {
  /** The kingdom's colors, for troop recolors and shapes. */
  kingdomBlue: [70, 115, 210] as [number, number, number],
  kingdomGold: [255, 196, 70] as [number, number, number],
  /** Hidden gear bones are scaled to this. */
  hiddenScale: 0.0001,
  pieces: {
    sword: {
      model: 'props/mini-arena/weapon-sword.glb',
      bone: 'arm-right',
      at: RIGHT_HAND,
      anchor: [0, 0.05, 0],
      // The blade (model -y) forward and a little up, its flat side outward.
      axis: [0, -1, 0],
      dir: [0.45, 0.35, 0.82],
      axis2: [0, 0, 1],
      dir2: R_OUT,
      scale: 0.85,
    },
    spear: {
      model: 'props/mini-arena/weapon-spear.glb',
      bone: 'arm-right',
      at: RIGHT_HAND,
      anchor: [0, 0.24, 0],
      // Mostly up, tipped forward.
      axis: [0, 1, 0],
      dir: [0.6, 0.6, 0.5],
      axis2: [0, 0, 1],
      dir2: R_OUT,
      scale: 0.9,
    },
    goblinSpear: {
      model: 'props/mini-arena/weapon-spear.glb',
      bone: 'arm-right',
      at: RIGHT_HAND,
      anchor: [0, 0.22, 0],
      axis: [0, 1, 0],
      dir: [0.55, 0.55, 0.62],
      axis2: [0, 0, 1],
      dir2: R_OUT,
      scale: 0.75,
    },
    roundShield: {
      model: 'props/mini-dungeon/shield-round.glb',
      bone: 'arm-left',
      at: [0.2, 0.08, 0.02],
      anchor: [0, 0, 0],
      // Its face outward from the forearm, its top up.
      axis: [0, 0, 1],
      dir: L_OUT,
      axis2: [0, 1, 0],
      dir2: L_UP,
      scale: 0.72,
    },
    rectShield: {
      model: 'props/mini-dungeon/shield-rectangle.glb',
      bone: 'arm-left',
      at: [0.2, 0.08, 0.02],
      anchor: [0, 0.15, 0],
      axis: [0, 0, 1],
      dir: L_OUT,
      axis2: [0, 1, 0],
      dir2: L_UP,
      scale: 0.8,
    },
    bow: {
      shape: 'bow',
      bone: 'arm-left',
      at: LEFT_HAND,
      // The grip is the middle of the arc (shape units: radius 0.22).
      anchor: [0.22, 0, 0],
      // The string up, the arc bulging forward.
      axis: [0, 1, 0],
      dir: L_UP,
      axis2: [1, 0, 0],
      dir2: [0, 0, 1],
      scale: 1,
      color: 0x8a5a2b,
      trim: 0xf3e6c4,
    },
    quiver: {
      shape: 'quiver',
      bone: 'torso',
      at: [0.06, 0.1, -0.15],
      anchor: [0, 0, 0],
      axis: [0, 1, 0],
      dir: [-0.35, 0.94, 0],
      axis2: [0, 0, 1],
      dir2: [0, 0, -1],
      scale: 1,
      color: 0x7a4a26,
      trim: 0xf3e6c4,
    },
    goblinHelmet: {
      shape: 'helmet',
      bone: 'head',
      at: [0, 0.27, -0.01],
      anchor: [0, 0, 0],
      axis: [0, 1, 0],
      dir: [0, 1, 0],
      axis2: [0, 0, 1],
      dir2: [0, 0, 1],
      scale: 1.05,
      color: 0x9a9fb2,
      trim: 0x5a5e70,
    },
    cap: {
      shape: 'cap',
      bone: 'head',
      at: [0, 0.29, 0],
      anchor: [0, 0, 0],
      axis: [0, 1, 0],
      dir: [0, 1, 0],
      axis2: [0, 0, 1],
      dir2: [0, 0, 1],
      scale: 1,
      color: 0xb4b9c8,
      trim: 0xffc446,
    },
    plume: {
      shape: 'plume',
      bone: 'head',
      at: [0, 0.5, -0.04],
      anchor: [0, 0, 0],
      axis: [0, 1, 0],
      dir: [0, 0.94, -0.34],
      axis2: [0, 0, 1],
      dir2: [0, 0, 1],
      scale: 1,
      color: 0x4673d2,
      trim: 0xffc446,
    },
  } satisfies Record<string, GearPiece>,
};

export type GearName = keyof typeof GEAR.pieces;

/**
 * The three troop kinds (build step 7): bodies from the Kenney packs we
 * have, recolored to the kingdom's blue and gold, each with its own gear
 * and proportions (width, height), so they read apart from the seat.
 * Archers stop and shoot from range instead of fighting up close.
 */
export type TroopKind = 'sword' | 'spear' | 'archer';

export interface TroopKindSpec {
  body: string;
  gear: GearName[];
  recolor: Recolor[];
  /** Width and height multipliers on TROOPS.height. */
  width: number;
  height: number;
  /** Share of soldiers of this kind. */
  share: number;
  /** A goblin this close is fought or shot (cm). */
  engageRange: number;
  /** Walking speed multiplier. */
  speed: number;
}

export const TROOP_KINDS: Record<TroopKind, TroopKindSpec> = {
  sword: {
    body: 'characters/mini-arena/character-soldier.glb',
    gear: ['sword', 'roundShield'],
    recolor: [
      // The leather tunic to blue, the red plume and trim to gold.
      { mesh: 'body', uv: [11 / 16, 12 / 16, 0.75, 1], color: GEAR.kingdomBlue },
      { mesh: 'body', uv: [9 / 16, 10 / 16, 0.5, 0.75], color: GEAR.kingdomGold },
      { mesh: 'head', uv: [9 / 16, 10 / 16, 0.5, 0.75], color: GEAR.kingdomGold },
    ],
    width: 1.08,
    height: 0.97,
    share: 0.4,
    engageRange: 5,
    speed: 1,
  },
  spear: {
    body: 'characters/mini-dungeon/character-human.glb',
    gear: ['spear', 'rectShield', 'cap'],
    recolor: [
      { mesh: 'body', uv: [3 / 16, 4 / 16, 0.5, 1], color: GEAR.kingdomBlue },
      { mesh: 'body', uv: [13 / 16, 14 / 16, 0.5, 1], color: GEAR.kingdomGold },
    ],
    width: 0.94,
    height: 1.06,
    share: 0.3,
    // The long spear reaches a little farther.
    engageRange: 6.5,
    speed: 0.95,
  },
  archer: {
    body: 'characters/mini-forest/character-archer.glb',
    gear: ['bow', 'quiver', 'plume'],
    recolor: [
      // The green hood and tunic to blue (the skin above v 0.75 stays).
      { mesh: 'body', uv: [3 / 16, 4 / 16, 0.75, 1], color: GEAR.kingdomBlue },
      { mesh: 'head', uv: [3 / 16, 4 / 16, 0.75, 1], color: GEAR.kingdomBlue },
    ],
    width: 0.95,
    height: 0.96,
    share: 0.3,
    engageRange: 16,
    speed: 1.05,
  },
};

/** Archers: they stop and shoot arrows (one instanced pool) at goblins within their range. */
export const ARCHERS = {
  /** A shot this often (seconds), and the share that knocks the goblin out. */
  shootEvery: 1.6,
  hitChance: 0.55,
  /** Arrow flight time (seconds) and arc height (cm). */
  flightTime: 0.45,
  arcHeight: 4,
  /** Arrow size (cm). */
  length: 2.2,
  poolSize: 12,
  shaftColor: 0x8a5a2b,
  tipColor: 0xd8dbe6,
  featherColor: 0xffffff,
};

/**
 * Goblin gear (build step 7): some grunts carry a spear, some wear a helmet.
 * A helmet is one extra hit from a slingshot pebble or a soldier: it flies
 * off instead (big hits like the swatter, kegs and boulders go through).
 * Peppered goblins drop their spear, which flies off. Runners and climbers
 * stay bare handed (they need their hands to run and climb).
 */
export const GOBLIN_GEAR = {
  spearShare: 0.6,
  helmetShare: 0.35,
  /** Helmets only from this wave (1 based), so the first lessons stay one hit. */
  helmetFromWave: 3,
  /** Gear knocked off: flies up and out (cm per second), spins, lands and shrinks away. */
  flySpeed: 45,
  flyUp: 70,
  spin: 14,
  restTime: 1.2,
  poolSize: 10,
};

/**
 * Balloon riders (docs/enemies.md, build step 7): the first flying enemy.
 * A patched goblin balloon with goblins hanging under its basket floats in a
 * straight line from a camp toward the castle at about head height (no
 * roads), stops over the courtyard and drops its riders in (intruders, food
 * in reach), then rises and drifts away. The slingshot pops it (a big still
 * target, full aim assist) and the riders fall and poof. Riders can be
 * pinched off or swatted when close, and the megaphone and bell stun them
 * (a stunned balloon stops). Sizes in cm, times in seconds.
 */
export const BALLOONS = {
  /** Most balloons at once (one instanced mesh for all). */
  max: 6,
  /** Envelope radius, and its height over the board (center). Riders hang under the basket. */
  radius: 5.5,
  height: 44,
  /** Riders per balloon (grunts). */
  riders: 2,
  /** Where it comes in from (cm from the center) and how fast it floats (cm per second). */
  startRadius: 175,
  speed: 7.5,
  /** The scripted first balloon (wave 4 banner) starts closer, right in front. */
  introRadius: 120,
  /** It stops over the courtyard here and drops one rider every dropGap. */
  dropRadius: 43,
  dropGap: 0.6,
  /** Then it rises (cm per second) and drifts away outward, and is gone past this far or this high. */
  leaveRise: 6,
  leaveSpeed: 9,
  goneRadius: 140,
  goneHeight: 110,
  /** A gentle bob and sway while it floats. */
  bob: 1.2,
  bobSpeed: 1.6,
  sway: 0.08,
  /** The wall under it flashes red this often while it is over or near the wall with riders (threat cue), within this far outside the wall. */
  threatEvery: 0.35,
  threatOut: 12,
  /** A popped balloon bursts over this long. */
  popTime: 0.18,
  colors: [0xc0392b, 0xe9c46a, 0x7a9a3a, 0x8a5a2b] as number[],
  basketColor: 0x7a5230,
  ropeColor: 0x3b2a1a,
  popColors: [0xc0392b, 0xe9c46a, 0xffffff, 0x7a9a3a],
  /** The instance color while the slingshot aims at it (brighter). */
  aimedBrightness: 1.7,
};

/**
 * Juice (build step 8): small cheap effects that make every action feel
 * good. All pooled and instanced, a few draw calls in total, no lights and
 * no post processing (performance rules). Nothing moves the board or the
 * view (comfort).
 */
export const JUICE = {
  /** A goblin that is hit but not knocked out flashes white this long (seconds). */
  hitFlashTime: 0.12,
  hitFlashColor: 0xffffff,
  hitFlashIntensity: 0.9,
  /** A soldier cheers (arms up) this long after knocking a goblin out, and every soldier this long when a wave is won (seconds). */
  troopCheerTime: 0.7,
  waveCheerTime: 1.6,
  /**
   * Hit stop: on a big hit (a keg, a balloon pop, three knockouts at once)
   * the units run at this share of speed for this long (seconds). The board,
   * the view and the hands never slow down.
   */
  hitStopScale: 0.08,
  hitStopTime: 0.07,
  /** This many knockouts in one frame count as a big hit. */
  multiKill: 3,
  /** Shock rings (world meters at the default board size): pool, base time, color and opacity. */
  ringPool: 24,
  ringTime: 0.35,
  ringColor: 0xfff1c8,
  ringOpacity: 0.85,
  knockoutRing: 0.05,
  /** The swatter's slap on the ground. */
  swatRing: 0.1,
  /** Pow stars: pool, time, sizes (meters) and colors. */
  starPool: 20,
  starTime: 0.42,
  knockoutStar: 0.028,
  starColor: 0xffe14d,
  starColors: [0xffe14d, 0xfff4b0, 0xffb84d] as number[],
  /** Big blasts (keg, goblin shot, balloon pop, multi knockouts). */
  blastRing: 0.16,
  blastStar: 0.07,
  blastColor: 0xffb03a,
  /** "+1" food labels rising from the jar: pool, time, rise and width (meters). */
  labelPool: 6,
  labelTime: 1.1,
  labelRise: 0.07,
  labelSize: 0.06,
  /** Confetti over the castle when a wave is won (more for the win), in a ring this far out (meters). */
  confettiPool: 140,
  confettiWave: 60,
  confettiWin: 110,
  confettiFrom: 0.2,
  confettiTo: 0.55,
  confettiSize: 0.012,
  confettiColors: [0x2f6fd8, 0xffc446, 0xffffff, 0xd23c28, 0x5cc46a] as number[],
  /** The fireworks after a win: bursts, ring and star sizes (meters). */
  fireworkCount: 9,
  fireworkRing: 0.14,
  fireworkStar: 0.06,
  /** Goblins pop in when they come out of a camp, and squash when they land (share and seconds). */
  spawnPopTime: 0.3,
  squashTime: 0.28,
  squashAmount: 0.35,
  /** Runners kick up dust this often (seconds) while running on a road near enough to see (cm). */
  runnerDustEvery: 0.28,
  runnerDustNear: 150,
  dustColors: [0xd9c08a, 0xc9b79a, 0xe8dcc0] as number[],
  /** Shot pebbles leave a faint trail: a puff this often (seconds). */
  pebbleTrailEvery: 0.035,
  pebbleTrailColors: [0xffffff, 0xf3ead8] as number[],
  /** The camps shake while they rumble before a group comes out (tilt in radians, and speed). */
  campWobble: 0.12,
  campWobbleSpeed: 38,
  /** The health flag jolts when the castle is hit (degrees, seconds), and the wave flag pops when it climbs. */
  flagJoltDeg: 14,
  flagJoltTime: 0.35,
  flagPopTime: 0.5,
};

/**
 * The sky (decor only, no gameplay): our own gradient dome with a warm
 * sunrise glow, a low-poly 3D cartoon sun far away (meters, world), and
 * many small clouds made to the board's scale (cm, in boardLift like the
 * hills): little cotton puffs around and above the giant's head, so the
 * player feels huge. None of it turns with the board (comfort rule). One
 * draw call for all the clouds.
 */
export const SKY = {
  enabled: true,
  /**
   * Sun direction: compass angle from the player's first view (degrees,
   * 0 = front, positive = right) and height above the horizon (low, a
   * morning sun). A little right of front, so the sunrise glow is in view
   * and clear of the hint sign.
   */
  sunAngleDeg: 35,
  sunElevationDeg: 13,
  sunDistance: 150,
  /** The sunlight comes from the sun's side, but higher, so the board's tops stay bright (degrees above the horizon). */
  lightElevationDeg: 40,
  /**
   * Sunlight strength. Raised from 1.6 while the soft sky fill (the scene
   * file's IBLGradient intensity) went from 1 to 0.6, so slopes facing the sun
   * are clearly lit and the ones facing away clearly shaded, live as the
   * board spins.
   */
  lightIntensity: 2.2,
  /** The sky dome (meters, inside the camera's 200 m far plane) and its colors: top, horizon (the fog color too), below the horizon. */
  domeRadius: 175,
  domeTopColor: 0x46a8ff,
  domeHorizonColor: 0xb1e5fe,
  domeBottomColor: 0xa2d1e1,
  /**
   * The sunrise glow on the dome: a wide orange haze and a tight yellow one
   * around the sun, strongest low on the horizon. Spread is how wide each one
   * is (higher = tighter), strength how strong (0 to 1).
   */
  glowOrange: 0xff9a3c,
  glowYellow: 0xffe08a,
  glowOrangeSpread: 3,
  glowOrangeStrength: 0.85,
  glowYellowSpread: 18,
  glowYellowStrength: 0.9,
  /** How much the glow keeps above the horizon (0 = only on the horizon, 1 = the same all the way up). */
  glowHighShare: 0.35,
  /**
   * Haze over the hills (meters, for the default board size: it grows with
   * stage.boardScale): none until just past the board, thicker farther out,
   * almost full at the last ground. Its color is the dome's horizon color.
   */
  fogNear: 6.6,
  fogFar: 32,
  /** Sun ball radius (meters), and its soft glow as a share of that. */
  sunRadius: 5,
  glowShare: 4,
  /** Cartoon colors: the ball's dark edge, middle and lit top, the rays, the glow. */
  sunEdgeColor: 0xff7a00,
  sunColor: 0xffc21a,
  sunLitColor: 0xfff1a0,
  rayColor: 0xffb000,
  glowColor: 0xffb84a,
  /** Pointy 3D rays around the ball: how many, and how fast they turn (degrees per second). */
  sunRays: 12,
  raySpin: 4,
  /** Clouds (board cm): how many, puffs each, and where (from the board center). */
  cloudCount: 90,
  puffsPerCloud: 5,
  cloudMinDistance: 330,
  cloudMaxDistance: 2600,
  /** Height above the board (cm): near clouds float low, about the giant's chin, far ones higher. */
  cloudNearHeight: 30,
  cloudFarHeight: 160,
  cloudHeightJitter: 25,
  /** Cloud size (cm across one cloud): small near, bigger far. */
  cloudNearSize: 16,
  cloudFarSize: 55,
  /** No clouds over the battlefield: inside this radius they shrink away (cm, from, to). */
  clearFrom: 300,
  clearTo: 430,
  /**
   * High clouds over the battlefield and the giant's head: always well above
   * the eyes (46 cm above the board), so they never block the view down
   * onto the board. How many, where (cm from the center, they wrap inside
   * this), height above the board (cm, from, to) and size (cm across).
   */
  highCloudCount: 22,
  highCloudMaxDistance: 950,
  highCloudHeight: [120, 260] as [number, number],
  highCloudSize: [28, 60] as [number, number],
  /**
   * A canopy of bigger clouds that always stays over the giant (they wrap
   * inside this square, cm from the center), so looking up is never an
   * empty sky. Well above the eyes and the hands.
   */
  canopyCount: 16,
  canopyMaxDistance: 320,
  canopyHeight: [150, 300] as [number, number],
  canopySize: [60, 120] as [number, number],
  /** Wind: direction (degrees, 0 = front) and speed (board cm per second). Slow, so it reads as calm. */
  windDeg: 70,
  windSpeed: 5,
  /** Top of each puff, and its underside: a light sky blue, so the faces read without looking stormy. */
  cloudColor: 0xffffff,
  cloudShade: 0xcde6fe,
  /** The clouds are sorted far to near this often (seconds), so nearer ones paint over farther ones. */
  sortEvery: 0.5,
};

/** One ring of hills around the board (board cm). */
export interface HillLayer {
  count: number;
  /** Distance from the board center (cm, from, to). */
  from: number;
  to: number;
  width: [number, number];
  height: [number, number];
  /** Their colors (one picked per hill, slightly varied). */
  colors: number[];
  /** Pointy mountains instead of round hills. */
  peaked: boolean;
}

/**
 * Low-poly hills and mountains around the board, so the horizon is not empty
 * (decor only). All in boardLift (cm): made to the board's scale, they rise
 * and size with the board, but never turn. Light green rolling hills close by, darker
 * green farther out, and brown mountains as the last ring. Tall enough to
 * frame the board, low enough that the giant looks over them. The fog
 * (SKY.fogNear, fogFar) hazes them more the farther they are. One draw call
 * per ring.
 */
export const HILLS = {
  /** The grass ground under them, from the board's edge out (cm), rising a little, lighter near and darker far. */
  groundFrom: 590,
  groundTo: 2900,
  groundRise: 70,
  groundNearColor: 0x91e831,
  groundFarColor: 0x58b31a,
  layers: [
    // About twice as many as before, a little wider, and the rings overlap, so there are no flat gaps between them.
    { count: 85, from: 620, to: 960, width: [60, 140], height: [12, 30], colors: [0xbdff57, 0xaefb45, 0xc6ff6a], peaked: false },
    { count: 85, from: 900, to: 1420, width: [110, 230], height: [30, 65], colors: [0x86e627, 0x7add1f, 0x8fed2f], peaked: false },
    { count: 85, from: 1350, to: 1920, width: [180, 340], height: [55, 110], colors: [0x50b514, 0x43a910, 0x58c218], peaked: true },
    { count: 90, from: 1850, to: 2650, width: [240, 440], height: [100, 200], colors: [0xa9601f, 0x96541a, 0xb5702b], peaked: true },
  ] as HillLayer[],
};

export const PARTICLES = {
  /** Raised from 96 for the falling pepper, and from 128 for the keg blasts. */
  poolSize: 160,
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
  /**
   * Standing for the whole test since build step 7: this many soldiers (all
   * three kinds, walking on the spot) and balloons with riders (hovering),
   * so the budget counts the army and the flying enemies too.
   */
  troops: 8,
  balloons: 2,
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
