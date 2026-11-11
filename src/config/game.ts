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
/**
 * The goblin war camps (src/world/boardBuilder.ts buildCamps): the camp hill
 * in the middle (it sinks as goblins come out) inside a spiked palisade, with
 * the gate toward the castle where the road leaves and red banners beside
 * it, a big war tent at the back, smaller tents and a catapult at the sides,
 * a weapon rack, a fire, and tall rocks looming behind the fence. Sizes are
 * board cm for a camp of size 30 (they grow and shrink with the camp).
 * Merged into one mesh per material for all camps. Moved out to about 400 cm
 * and made bigger after the step 7 and 8 test (they looked too small and
 * plain, and most of the board was empty).
 */
export const CAMP_LOOK = {
  /** The palisade's distance from the middle (share of the camp size: the flat ground ends there), and one piece's length. */
  fenceRadius: 1,
  fencePiece: 6,
  warTentHeight: 10,
  tentHeight: 6,
  catapultWidth: 9,
  bannerHeight: 8,
  rackWidth: 3,
  fireWidth: 3.2,
  /** Goblin standing stones beside some gates. */
  totemHeight: 6,
  /** Tall rocks just outside the palisade, behind the camp (count, height range). */
  rocks: 3,
  rockHeight: [8, 14] as [number, number],
};

/**
 * Little scenes in the empty land (src/world/storySpots.ts): how many of each
 * and how big (cm across from the middle), the ring they go in (cm from the
 * board's middle), and the gaps they keep to roads (the travelers' camp sits
 * within travelersNear of one), camps, everything built, and each other.
 * Added after the step 7 and 8 test: much of the board was empty meadow.
 */
export const STORY_SPOTS = {
  counts: { stoneCircle: 2, ruinedTower: 2, battlefield: 2, shrine: 1, travelers: 2, archery: 1, goblinTrap: 1 },
  sizes: { stoneCircle: 12, ruinedTower: 10, battlefield: 16, shrine: 10, travelers: 10, archery: 12, goblinTrap: 8 },
  from: 110,
  to: 520,
  roadGap: 4,
  travelersNear: 10,
  campGap: 25,
  gap: 8,
  spacing: 40,
};

export const SETTLEMENTS = {
  villages: {
    count: 4,
    /** Distance from the center (cm, between the castle and the camps at 390 to 425), radius of each village (cm), and houses in each. */
    from: 105,
    to: 260,
    // Bigger and busier after the step 7 and 8 test (were 16 to 21 cm with 3 to 5 houses): more houses, a second stall,
    // benches, hedges, wood piles, buckets, a chest and a banner in each square (`props` below), and more villagers.
    radius: [20, 26] as [number, number],
    houses: [5, 7] as [number, number],
    /** The houses stand in an arc this wide (degrees) on the far side of the square; the side toward the castle stays open, so the villagers can be seen. */
    houseArcDeg: 220,
    /** Small things in each village square: how many barrels and boxes, and how many of the other props. */
    props: { barrels: 7, extras: 6 },
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
   * horizon has things to spot: tall watchtowers, hexagon mage towers,
   * gatehouses on the old border, ruined towers and small keeps, in the
   * order of `kinds` (as many as fit on far hills, at most one per kind
   * listed). About 30 cm tall at most.
   */
  // Twice as many after the step 7 and 8 test (the far land was still empty), closer together, the kinds
  // taking turns so neighbours differ. The list is the order they are placed in, one per far hill.
  landmarks: {
    from: 280,
    to: 560,
    spacing: 110,
    kinds: ['tallTower', 'mageTower', 'gatehouse', 'ruinedTower', 'keep', 'mageTower', 'tallTower', 'ruinedTower', 'keep', 'tallTower', 'gatehouse', 'ruinedTower'] as LandmarkKind[],
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
  /**
   * The countdown never rushes the player (it started at once before, with
   * no time to read): nothing counts for readSeconds after the instruction
   * shows; a hand must be at least startReach from the head (level, meters,
   * was 0.33) to count as stretched out; and it must have settled, moving
   * slower than stillSpeed (meters per second, smoothed over speedSmoothing)
   * for stillFor (seconds), before the countdown starts. While counting, a
   * hand moving faster than moveSpeed for moveGrace is still being adjusted:
   * the countdown stops and waits for it to settle again.
   */
  readSeconds: 3,
  startReach: 0.4,
  stillSpeed: 0.08,
  stillFor: 0.6,
  speedSmoothing: 0.15,
  moveSpeed: 0.25,
  moveGrace: 0.25,
  /** Countdown while the arm stays out and still (seconds). The hand can rest when it ends. */
  holdSeconds: 3,
  /** The arm may drop back this long before the countdown starts over (seconds), so a tracking blink does not reset it. */
  dropGrace: 0.4,
  /** Hand distance smoothing, so a tracking spike never counts as reach (seconds). */
  smoothing: 0.12,
  /** The board grows or shrinks to its new size with this smoothing (seconds). */
  growSmoothing: 0.25,
  /**
   * The ghost hand demo (the very first lesson): the right arm stretched
   * straight out, hand flat, thumb up, fingers forward, exactly the pose the
   * check wants. Its hand ends at demoStretch of the reach the game expects
   * (the rampart's distance over rampartShare, sized with the board: about
   * 56 cm for the default board, was a fixed 55), in front of the right
   * shoulder (meters right and down from the eyes, was 20 cm down: the
   * shoulder is higher).
   */
  demoStretch: 1,
  demoRight: 0.17,
  demoDown: 0.14,
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

/** v2: there is no climber type any more, every goblin climbs (docs/v2-plan.md 2.6). */
export type GoblinType = 'grunt' | 'runner';

export interface GoblinStats {
  /** Height (cm). */
  height: number;
  /** Walking speed (cm per second). */
  speed: number;
  /** Climbing speed up the wall (cm per second). A helmet slows it to GOBLIN_RULES.helmetClimbSpeed. */
  climbSpeed: number;
  /** Multiplies the model colors. */
  tint: [number, number, number];
  moveClip: string;
  /** Animation playback speed while moving. */
  moveClipSpeed: number;
}

export const GOBLINS: Record<GoblinType, GoblinStats> = {
  // Heights raised about 11% (from 3.5, 3 and 3.5) after a headset test, so they read better on the hills.
  // v2: faster (grunts 6 to 7.5, runners 13 to 15), so waves do not drag now that the camps are far out.
  grunt: { height: 3.9, speed: 7.5, climbSpeed: 2, tint: [1, 1, 1], moveClip: 'walk', moveClipSpeed: 1.55 },
  runner: { height: 3.35, speed: 15, climbSpeed: 4, tint: [1.15, 1.05, 0.45], moveClip: 'sprint', moveClipSpeed: 1.55 },
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
  /**
   * v2, every goblin climbs (docs/v2-plan.md 2.6), in four steps: it bashes
   * the wall for about bashTime (seconds, jittered by bashJitter), standing
   * bashStandOff cm outside it, then climbs (GoblinStats.climbSpeed, a
   * helmet slows it to helmetClimbSpeed), runs about on the rampart for
   * rampartWait, then jumps into the courtyard.
   */
  bashTime: 5,
  bashJitter: 0.2,
  bashStandOff: 1.2,
  helmetClimbSpeed: 1.5,
  /** How long a goblin runs about on the rampart before jumping into the courtyard (seconds). */
  rampartWait: 8,
  /** The giggle when a goblin reaches the rampart: at most this often for all goblins (seconds). */
  cackleGap: 0.6,
  /** Dazed time after being dropped (seconds). */
  dazedTime: 1.4,
  /** Knocked back by a thrown pebble or a goblin shot: sideways and upward speed of the hop (cm per second). */
  knockSpeed: 60,
  knockHop: 90,
  /** Knocked off the rampart by the bell: outward speed (cm per second), the hop is half of knockHop. */
  knockOffSpeed: 25,
  /** Gravity for dropped goblins (cm per second squared). */
  gravity: 980,
  /** Hand speed smoothing while held, so tracking jitter does not fling goblins (seconds). */
  throwSmoothing: 0.06,
  /** Thrown goblins keep this share of the hand speed. */
  throwScale: 1,
  /** Fastest throw, so a tracking glitch cannot launch a goblin off the map (cm per second). */
  maxThrowSpeed: 350,
  /** The toss lesson counts a goblin let go at least this fast (cm per second): a real throw, not just dropped. */
  tossLessonSpeed: 60,
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
  /** Below this health share the red cloth darkens and hangs limp: it flies this share of its length, its edge on the pole. */
  lowShare: 0.3,
  limpLength: 0.8,
  notchColor: 0xddd6c8,
};

/** Win and lose panels, and the poke buttons on them (docs/castle-rules.md section 4). */
/**
 * Button sizes: every PokeButton uses one of these (cap radius, cm; the rim
 * makes it 1.3 times wider). Across the rim: medium 4.9 cm (a secondary
 * button beside a big one, Measure reach), standard 6.2 cm (Next, pause,
 * the settings tabs and Back), large 7.5 cm (the pause panel), primary
 * 9.1 cm (Play). PokeButton never makes one smaller than min (4.9 cm
 * across; small, 3.6 cm, is gone: the tabs felt too small) and warns in
 * the dev build above max. Keep at least 1.2 cm between any two targets.
 */
export const BUTTON_SIZE = {
  medium: 1.9,
  standard: 2.4,
  large: 2.9,
  primary: 3.5,
  min: 1.9,
  max: 3.5,
};
/**
 * Breathing room in every menu panel (cm), so nothing feels cramped (it did
 * after the text was cut): no button, slider or line of text comes closer
 * than `edge` to a panel's side or bottom edge, the title banner starts
 * `top` down from the top edge, and a label keeps `labelGap` from the
 * button it names.
 */
export const UI_SPACING = {
  edge: 2.2,
  top: 1.4,
  labelGap: 0.9,
};

/**
 * Where menus and panels sit up and down (src/rules/reach.ts uiCenterY),
 * from the eyes, for the default board (cm): each panel's middle is
 * centerBelowEyes below the eyes, right in front, and no part of it reaches
 * higher than highestAboveEyes or lower than lowestBelowEyes (the panel is
 * moved to fit; the dev server warns about one too tall to fit at all).
 * Added after the settings page's low rows were hard to touch. Grown a
 * little (2 and 30 before) for the settings page's tab row: its top
 * (title, Back) reaches about eye level, its tabs about 29 cm below.
 */
export const UI_ZONE = {
  centerBelowEyes: 15,
  highestAboveEyes: 4,
  lowestBelowEyes: 34,
};

export const END_PANEL = {
  /** Panel spot, fixed in front of the player (cm, its height from UI_ZONE): over the front wall, the button within reach. */
  radius: 41,
  /** Tilted back a little, toward the eyes (degrees). */
  tiltDeg: 20,
  /** Only a title and a word over each button now (was 24 tall with a subtitle and long labels), with room around them (UI_SPACING). */
  width: 34,
  height: 22,
  /** The round poke button at the bottom, below all the text, in front of the panel (cm). */
  buttonRadius: BUTTON_SIZE.primary,
  /** Space between the buttons' rims and the panel's bottom and side edges (cm). */
  buttonMargin: UI_SPACING.edge,
  /** The welcome panel's smaller Settings button, in the bottom right corner (cm). */
  settingsRadius: BUTTON_SIZE.medium,
  /** The panel appears this long after the battle ends, after the last poofs (seconds). */
  showDelay: 1.2,
};

/**
 * The draw order of everything drawn on top or in a fixed order (higher
 * draws later, over the lower ones), all in one place so layers never
 * fight: ghost hands and aim dots, "+1" labels, the stun
 * ring, the pointer arrows, then the pause panel above all. Used with
 * drawOnTop (src/ui/kit/onTop.ts).
 */
export const RENDER_ORDER = {
  ghost: 5,
  ghostGlow: 6,
  labels: 20,
  stunWave: 30,
  /** The horn's aim beam (src/ui/hornAim.ts). */
  hornAim: 32,
  /** The glass sign in front of the eyes (src/ui/kit/glassSign.ts). */
  glassSign: 34,
  pointer: 36,
  pause: 40,
};

/**
 * Pause (docs/controls-and-ui.md section 5): a pause button on a stand
 * straight in front, outside the ring, poked with either index finger, and
 * a pause panel in front of the player with Resume, Reset table, Measure
 * reach and Restart. The panel is placed from the head when it opens (not
 * on the board), so it is always in reach, even when the board ended up
 * somewhere odd.
 */
export const PAUSE = {
  /**
   * The button: on the Next button's spot (HINT_SIGN.nextAt), but lower, so
   * it does not block the view ahead (boardLift, cm, degrees). It stays
   * there while a battle runs, and steps aside while the Next button shows.
   * Was on the left wrist until the step 7 and 8 test (the palm pose was
   * hard to find and flickered).
   */
  button: {
    radius: BUTTON_SIZE.standard,
    at: 38.5,
    y: 9,
    tiltDeg: 40,
  },
  /**
   * The Quest menu can stop the frames without the page ever seeing a
   * hidden frame (headset test: it did not always pause). So it also pauses
   * when the XR session or the page says it lost focus (their events, even
   * between frames), or when frames stopped for this long (seconds).
   */
  // Was 0.75: one long hitch (a new effect drawn the first time, memory clean-up) could pause at random.
  autoPauseGap: 1.5,
  /**
   * The Quest menu gesture itself (a pinch with the palm toward the eyes)
   * pauses too, the moment the pinch starts, so the pause never depends on
   * the browser's events (headset test: still random with the right hand's
   * Meta pinch). `facing`: how straight the palm faces the head (dot of the
   * palm's normal and the way to the head), `maxDistance` from the head (m).
   * The game never uses this pose itself, and a goblin held at the mouth is
   * pinched long before, so it never pauses by mistake.
   */
  // Stricter after random pauses (was facing 0.6, 55 cm, at once): straighter, nearer, a hand holding
  // nothing, and the pose kept for `hold` seconds. The FPS panel shows what caused a pause.
  metaGesture: { facing: 0.8, maxDistance: 0.45, hold: 0.15 },
  /**
   * The headset taken off (headset test: the game played on for 30 s). The
   * Quest 3S has no proximity sensor, so the system never tells the page
   * (Meta's VRC.Quest.Functional.2). No hand tracked and the head within
   * moveCm (cm) and turnDeg (degrees) of where it was for `seconds` pauses.
   */
  headsetOff: { moveCm: 0.3, turnDeg: 0.4, seconds: 5 },
  /**
   * The panel follows the head lazily, like the Quest's own menus: it stays
   * still while the head turns a little (so it can be poked), and swings
   * back in front once the head turned past its edge. How far that is goes
   * by the panel's size: the angle from its middle to its side edge (as
   * seen from the eyes) plus edgeMarginDeg, never less than followDeg. So a
   * small panel comes back soon, and on a big one (the settings page) the
   * player can look at its corners (Back, top left) without it moving away
   * (it used to swing at a fixed 25 degrees). It is never behind the player.
   */
  follow: {
    followDeg: 20,
    edgeMarginDeg: 10,
    /** Swings back with this smoothing (seconds), and moves with the head's position too. */
    smoothing: 0.3,
    /** It is in front again once within this angle (degrees), then it stops. */
    settleDeg: 3,
  },
  /** The panel, in cm from the seat like END_PANEL (sized with the board). */
  /** The panel, its height from UI_ZONE. */
  panel: {
    radius: 41,
    tiltDeg: 20,
    // "Paused" and a word over each button only (was 23 tall with two more lines of text), with room around them (UI_SPACING).
    // Four buttons: Resume, Settings, Restart, Skip tutorial (Reset table moved into the settings).
    width: 44,
    height: 20,
    buttonRadius: BUTTON_SIZE.large,
    /** Gap between button centers (cm): 2.9 cm between the rims. */
    buttonGap: 10.4,
    buttonMargin: UI_SPACING.edge,
    /** Drawn after everything else (above the markers and ghost hands), never hidden by the castle or the sign. */
    renderOrder: RENDER_ORDER.pause,
  },
  /**
   * The settings page (Settings on the pause panel or the welcome panel): a
   * bigger panel at the same spot, laid out in cm from its middle (x right,
   * y up). Back at the top left (its label under it) beside the title,
   * then the chosen tab's rows: each its name and level on the left, a
   * slider (SLIDER) or switch on the right. Below everything, the tabs, each
   * with its name beside it. Rows rowGap apart, so the targets keep 12 mm
   * between them (Meta's hands guidelines), and everything keeps UI_SPACING
   * from the edges.
   */
  // Made shorter (38 to 32 cm) after its low rows were hard to touch: Back and Measure reach share the
  // top row beside the title. Then just one long slider per row (no mute, no minus and plus), the
  // buttons small (BUTTON_SIZE, 3.6 cm across) and the slider handle 3.2 cm. Then no help line, and
  // then more room around and between everything (it felt cramped): 52 by 33, rows 4.8 cm apart.
  // Then the buttons got bigger (Back 4.9 cm, the tabs 6.2 cm across: the tabs felt too small) and
  // the tabs moved below everything (floating them out of the panel's top was tried: it looked bad).
  // The tab row made it taller (39.8 cm), so UI_ZONE grew a little and the rows are 4.4 cm apart.
  settings: {
    width: 52,
    height: 39.8,
    pxPerCm: 15,
    /** Back, top left. */
    backRadius: BUTTON_SIZE.min,
    backAt: [-21.3, 16] as [number, number],
    /** The tabs, in the bottom row (its y: bottomRowY, UI_SPACING.edge from the bottom edge). */
    tabRadius: BUTTON_SIZE.standard,
    /** Measure reach, in the Access tab (smaller, so the bell switch below keeps its gap). */
    reachRadius: BUTTON_SIZE.min,
    /**
     * The tabs (Sound, Access), below everything, each name to the right of
     * its button: the chosen one's cap green with its name bold and
     * underlined, the others' caps this grey (color, text and a line, so it
     * reads without relying on color alone). Measure reach moved into the
     * Access tab, with the bell switch, then Reset table too. Access comes
     * first (open by default), then Sound, the pair centered across the
     * panel (each button with its name to the right, about 12 cm, 3 cm apart).
     */
    tabX: [-10.6, 4.6] as number[],
    tabOffColor: 0x9a948a,
    /** The title banner, at the top beside Back (its middle and width). */
    titleX: -6,
    titleWidth: 16,
    labelX: -23.8,
    firstRowY: 9,
    rowGap: 4.4,
    /** The Access tab's rows (Measure reach, then the bell switch): farther apart, the button is round. */
    accessRowGap: 6,
    sliderX: 8.6,
    sliderLength: 27,
  },
};

/**
 * The slider (src/ui/slider.ts), from Meta's hands guidelines: targets well
 * over 22 mm with gaps over 12 mm, touched with the index finger only (cm,
 * in the slider's own frame, its face toward +z). The handle (3.2 cm) looks
 * like the buttons' green cap (no dark ring: it looked odd), over a warm parchment
 * fill and the dark track, so it matches the theme and still stands out
 * (the gold first tried looked out of place); grey at 0 (off). Its
 * face is at trackDepth + handleDepth; a finger within touchAt of the
 * slider's back grabs it (it has to come from the front), and it lets go
 * once the finger is back past releaseOut. Ready (hover) within
 * readyDistance in front, within zoneHeight above or below its middle (less
 * than half the settings rows' gap, so two rows never both answer).
 * No minus and plus buttons. Only the handle itself grabs (handleMargin),
 * not the track (touching the track moved two rows at once), and only one
 * slider moves at a time.
 */
/**
 * The on and off switch (src/ui/switch.ts): a 7 by 3 cm rounded track (the
 * whole of it is the target, well over 22 mm), its knob on the right and the
 * track green when on, on the left and grey when off, with the word On or
 * Off written beside the knob, so position, color and text all say the same.
 * Slid like the slider (cm in its own frame, face toward +z): a fingertip
 * within the knob's radius plus grabMargin and within touchAt of its back
 * grabs the knob (it has to come from the front, within readyDistance),
 * and it lets go once the finger is back past releaseOut. Let go past the
 * middle it flips, else it springs back (a tap no longer flips it). The
 * spring (stiffness, damping, per second) bounces a little, at most
 * overshoot (a share of the travel) past an end.
 */
export const SWITCH = {
  width: 7,
  height: 3,
  depth: 0.8,
  knobRadius: 1.25,
  knobDepth: 1,
  onColor: 0x6fae4a,
  offColor: 0x8a847a,
  knobColor: 0xf7e2b0,
  grabMargin: 0.8,
  zoneBehind: 2.5,
  readyDistance: 6,
  touchAt: 2.1,
  releaseOut: 4,
  springStiffness: 260,
  springDamping: 18,
  overshoot: 0.08,
};

export const SLIDER = {
  length: 14,
  trackHeight: 1.6,
  trackDepth: 0.8,
  handleRadius: 1.6,
  handleDepth: 1,
  /** The buttons' green (POKE.color), the parchment's warm tan, a grey for off. */
  handleColor: 0x6fae4a,
  offColor: 0x9a948a,
  fillColor: 0xe2c48a,
  zoneHeight: 2.2,
  /** Only the handle grabs: the fingertip within its radius plus this (cm). Touching the track does nothing. */
  handleMargin: 0.5,
  zoneBehind: 2.5,
  readyDistance: 6,
  touchAt: 2.1,
  releaseOut: 4,
};

/** Poke buttons (src/ui/pokeButton.ts), in cm like the rigs they sit in. Sizes: BUTTON_SIZE. */
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
  /** ...and this long must pass (seconds). Was 0.6: quick pokes in a row felt ignored (Meta uses 0.25). */
  cooldown: 0.35,
  /**
   * A quick poke: a fingertip in front of the face one frame and pushed in
   * the next clicks at once, even if no frame caught it on the way in, and
   * it still counts this far (cm) past the button's back.
   */
  quickBehind: 3,
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
  /**
   * A finished lesson shows its green tick this long before the next
   * instruction, unless the lesson sets its own pause (TutorialStep.afterDone
   * in src/director/tutorial.ts: longer where the player needs time to watch
   * or finish a move, none where the next lesson follows straight on). Was a
   * fixed 3.5 s for every lesson (before that 1.2): it made the player wait
   * after things they had already read and done.
   */
  doneTime: 0.6,
  /** The reach check from the pause panel or welcome settings: its "rest your arm" tick stays this long (seconds). */
  measureDoneTime: 2.5,
  /** Any other step the player saw (a banner, an info step) leaves a short quiet gap before the next (seconds). */
  stepGap: 0.4,
  /** The tick on a finished lesson's box, green so it reads as done. */
  doneColor: '#3faa3a',
  /**
   * Where the sign hangs while no wave is fought (the lessons before wave 1
   * and the breathers between waves): lower, its middle this far below the
   * eyes (cm), so it is right in front of them and not missed. During a wave
   * it goes back up (y), out of the way of the enemies. It glides between
   * the two over moveTime (seconds).
   */
  calmBelowEyes: 4,
  moveTime: 0.6,
  /**
   * A lesson whose target is in the air (the balloon, hint `signLow`): the
   * bottom edge this high above the board instead (cm), so the sign is
   * under the balloon and the shot's path to it (up at y, it hid both).
   */
  lowY: 18,
  /**
   * Info steps wait for the player's Next. If Next is not poked within
   * nextBlinkAfter (seconds), it starts to blink (an emissive pulse, per
   * second) until it is. Was 5: it blinked while the player was still reading.
   */
  nextBlinkAfter: 15,
  nextBlinkColor: 0xfff1a8,
  nextBlinkIntensity: 0.75,
  nextBlinkSpeed: 2.2,
  /**
   * Round "Next" poke button: its size, and its spot straight in front,
   * tilted toward the eyes (cm, degrees). Moved back toward the wall and up
   * a little after the step 6 test (was 33.5 out, 9 up: too close to the ring,
   * hands on the ring pressed it). Still about 49 cm from the eyes. It no
   * longer blinks (it looked busy and cheap after the step 7 and 8 test).
   */
  nextRadius: BUTTON_SIZE.standard,
  nextAt: 38.5,
  /** Same height as the pause button (was 15: the two did not line up). */
  nextY: PAUSE.button.y,
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
  /** Ghost aim dots (the keg lesson): how many, their size (meters), how high the arc rises (share of its length), flow speed. */
  aimDots: 18,
  aimDotSize: 0.0045,
  aimArc: 0.16,
  aimFlow: 0.5,
};

/**
 * The 3D pointer arrows (src/ui/pointerArrow.ts): in front of the face,
 * pointing at something while it is at the very edge of the headset's view
 * or out of it (the Quest 3S sees about 96 by 90 degrees, so about 45
 * degrees from the middle is the edge). Each blinks (glow between
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
  renderOrder: RENDER_ORDER.pointer,
  /**
   * The lesson's yellow arrow is the only tutorial marker (the 2D bouncing
   * arrows are gone): out of view it waits in the middle of the view,
   * pointing the way; once the target is in view it flies over to it in
   * flyTime (seconds) and hovers just above it, tip down, bobbing (meters).
   * The red threat arrow never flies: it just hides once its goblin is in view.
   */
  lesson: { color: 0xf2c14e, glow: 0xb07a10, below: 0.03, blinkMin: 0.25, blinkMax: 0.8, blinkSpeed: 0.8, flies: true },
  /** The red one blinks fast and strong, to catch the eye. */
  threat: { color: 0xe0342a, glow: 0xff2a10, below: 0.16, blinkMin: 0, blinkMax: 1.6, blinkSpeed: 3.5, flies: false },
  flyTime: 0.45,
  /** Gap from the tip to the target's top, and the bob. */
  hoverLift: 0.012,
  bob: 0.012,
  bobSpeed: 4,
  /** A fallback pulse (the lesson calls the eye again): it grows this much more for this long (seconds). */
  pulseScale: 0.8,
  pulseTime: 2.5,
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
  /** The horn (v2, the megaphone's old spot). */
  rightSide: { angleDeg: 82, radius: 33.5 },
  /** The bell (v2: its own platform, where the food jar was). */
  leftMiddle: { angleDeg: -56, radius: 33.5 },
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
  /**
   * The pebble's look (made in code, like the sun): a low-poly ball with
   * flat faces, its corners pushed in and out by up to pebbleLumps (share),
   * squashed to pebbleSquash of its height, in a stone grey.
   */
  pebbleLumps: 0.12,
  pebbleSquash: 0.85,
  pebbleColor: 0x9b958a,
  /**
   * A pebble that lands (a miss) rolls on: it keeps this share of its speed
   * along the ground, slows by rollFriction (cm/s each second) and lies
   * still below rollStop (cm/s), then its pebbleRest starts.
   */
  rollKeep: 0.3,
  rollFriction: 160,
  rollStop: 4,
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
  typeShare: { grunt: 1, runner: 0.3 } as Record<GoblinType, number>,
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

/**
 * Shared rules for the hand tools (v2, docs/v2-plan.md 2.1 and 2.2, rules in
 * src/rules/recharge.ts): free, with a use window that starts with the first
 * use, then a recharge that fills while the tool is back on its platform.
 * The slingshot has neither. Tune in playtests.
 */
export const TOOLS = {
  /**
   * How long one use lasts (seconds), from the first swat, shake or ring.
   * The bell and the horn are one use each (one stun, one call): their
   * window is only the short moment until the tool goes back.
   */
  use: { swatter: 10, pepper: 8, bell: 1.2, horn: 1.4 },
  /** The recharge after a use, while the tool is back on its platform (seconds). */
  recharge: { swatter: 20, pepper: 20, bell: 35, horn: 30 },
  /** Each goblin eaten fills every recharging tool's ring by this share of its full recharge (a seasoned one by seasonedRefill). */
  eatRefill: 0.1,
  seasonedRefill: 0.2,
  /**
   * The ring on the platform (readable with the sound off): while a use runs
   * it drains (useColor), while recharging it fills (chargeColor) over a
   * dark track. Hidden while ready. Flat on the platform top, around the
   * tool's base (cm). One mesh per ring: the fill is a draw range.
   */
  ring: {
    inner: 3.1,
    outer: 3.85,
    segments: 40,
    lift: 0.25,
    trackColor: 0x2a2018,
    useColor: 0xfff1b8,
    chargeColor: 0x5ab0ff,
    /** The ring flashes this bright for this long when eating fills it (seconds). */
    flashColor: 0xffffff,
    flashTime: 0.25,
  },
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
  /** Recharging (or tied down): the colors are dimmed to this share (the Locked look). */
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
    // Held like the megaphone was: the bell end points the way the knuckles point, the mouthpiece toward the wrist, so it is at the mouth when the fist is just below it.
    horn: { at: 3, face: 'back', tiltDeg: 15 },
    // The handle on top of the bell, thumb up, the bell hanging below the fist.
    bell: { at: 2, face: 'palm' },
  } as Record<'swatter' | 'pepper' | 'slingshot' | 'horn' | 'bell', { at: number; face: 'palm' | 'back'; tiltDeg?: number }>,
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

/** The pepper shaker (docs/giant-tools.md, v2 in docs/v2-plan.md 2.3): a small area that disarms everything and seasons goblins. */
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
  /** A peppered goblin on the rampart or in the courtyard stops this long (seconds). No push back (v2). */
  sneezeTime: 1.2,
  /** A seasoned goblin's colors are multiplied by this (dusty brown). */
  seasonedTint: [0.85, 0.68, 0.55] as [number, number, number],
  /**
   * Peppered goblins keep sneezing, like an old cartoon: every so often
   * (seconds, from, to) the head jerks forward for sneezeJerkTime with a puff
   * of pepper, and red pepper flakes circle over the head (like the dizzy
   * stars, one instanced mesh): this many, this big and this far out (cm), this fast.
   */
  sneezeEvery: [1.4, 3.2] as [number, number],
  /**
   * It sneezes for this long after the pepper (seconds), and cannot attack
   * meanwhile (no wall hits, no bashing, no attacks on the garrison, an
   * intruder does not count). Then it can hurt the castle again; it stays
   * seasoned (it fills the tool rings twice as much when eaten). v2: a few
   * seconds (was 10): the power is the disarm.
   */
  sneezeFor: 5,
  sneezeJerkTime: 0.35,
  sneezeColors: [0xffffff, 0xf1e6d0, 0xd23c28],
  flakeCount: 3,
  flakeSize: 0.45,
  flakeOrbit: 1.1,
  flakeSpeed: 4,
  flakeColor: 0xd8341f,
};

/**
 * The war horn (v2, docs/v2-plan.md 2.3, replaces the megaphone): calls the
 * field knights. Aim with the head while holding it, lift it to the lips to
 * lock the spot, then blow (src/tools/horn.ts). A curved hunting horn held
 * from below: the mouthpiece on top of the grip toward the face, the body
 * curving forward, down past the fist and a little to the side, the bell
 * ending low, so at the lips it stays below the line of sight; near the face
 * it also fades to see-through (headset test: the straight horn covered the
 * middle of the view). With the mic only a real blow sends the knights; the
 * quiet horn (or no mic) sends them after `holdTime` at the lips. Sizes in
 * cm, times in seconds.
 */
export const HORN = {
  /** The leather grip along +y from the fist. */
  gripLength: 6,
  gripRadius: 0.9,
  /**
   * The horn's center line, from the mouthpiece to the bell (tool cm): on top
   * of the grip toward the face (+z), arching forward, then down past the
   * fist and out to the side. A tapered tube along it.
   */
  curve: [
    [0, 8.6, 2.6],
    [0, 9.4, -0.4],
    [1.2, 7.8, -3],
    [2.6, 4.4, -3.6],
    [3.6, 0.9, -2.6],
    [4.2, -2.2, -0.8],
  ] as [number, number, number][],
  mouthRadius: 0.6,
  bellRadius: 2.6,
  /** It rests standing on its bell: its grip this far above the platform top. */
  restLift: 3.4,
  bodyColor: 0xeadfc4,
  bandColor: 0xc9952e,
  gripColor: 0x5a3a22,
  gripFrom: 0,
  gripTo: 6,
  grabRadius: 0.06,
  /**
   * The mouthpiece counts as at the lips (the spot locks) this close to the
   * head (meters, measured from the eyes; the mouth is about 10 to 12 cm
   * below them). Was 0.24, which a horn just held at rest in front of the
   * chest sometimes reached, so it locked by accident (headset test).
   */
  mouthDistance: 0.17,
  /**
   * Near the face it fades: fully solid farther than fadeFar, down to
   * fadeOpacity at fadeNear (meters from the mouthpiece to the head).
   */
  fadeFar: 0.3,
  fadeNear: 0.13,
  fadeOpacity: 0.15,
  /**
   * The quiet horn (or no mic): kept at the lips this long, it sounds
   * (seconds). With the mic only a blow sounds it: a hold never does, so
   * aiming is never cut short (headset test: it went off while still aiming).
   */
  holdTime: 1.2,
  /**
   * Mic loudness (raw RMS of one frame, 0 to 1) that counts as a blow: one
   * frame over it is enough, no smoothing and no holding it (headset test).
   * Set from the live loudness panel (MIC_PANEL, debug page "Mic panel").
   * Earlier smoothed values, held for 0.25 to 0.35 s, ran from 0.025 to 0.1.
   */
  blowLevel: 0.015,
  /** The horn sound's volume when held to blow, and when blown into the mic (louder). */
  heldVolume: 0.8,
  blownVolume: 1,
  /** Little puffs out of the bell while it fills: this often (seconds). */
  puffEvery: 0.15,
  waveColors: [0xffffff, 0xfff1b8, 0xffd23f],
};

/** The bell (docs/giant-tools.md, v2 in docs/v2-plan.md 2.3): the only stun. Shake it to stun every goblin and knock the climbers down. */
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
  /**
   * A ring (src/tools/bell.ts, second rewrite: speed checks never rang, hand
   * tracking runs at 30 Hz and smooths fast motion, Meta docs): the holding
   * hand's distance from a slow anchor that follows it (anchorSmoothing
   * seconds). ringOffset cm away is a ring; back within rearmOffset (and
   * ringGap seconds) before the next. No ring for grabQuiet seconds after the
   * grab. The debug notes show each grab's farthest swing, to tune it.
   */
  // Carried steadily at v cm/s the hand trails the anchor by about v x anchorSmoothing: 15 cm/s gives
  // about 2 cm (no ring), a swing of 40 cm/s about 6 cm (a ring).
  anchorSmoothing: 0.15,
  ringOffset: 3,
  rearmOffset: 1.2,
  ringGap: 0.25,
  grabQuiet: 0.4,
  /** A bigger swing stuns longer: from ringOffset up to this (cm) gives the full extra stun. */
  hardOffset: 9,
};

/** The stun of the bell: every goblin on the board stops, dizzy. */
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
 * Troops (v2, docs/v2-plan.md 2.7): two jobs. Field knights (KNIGHTS) come
 * only when the horn calls them and hold a junction; the wall garrison
 * (GARRISON) stands on the rampart. Both fight with simple timed hits. On
 * their own they lose slowly, so the player is always needed. Sizes in cm,
 * times in seconds.
 */
export const TROOPS = {
  /**
   * Most soldiers on the board at once (they share the unit budget with the
   * goblins). Tune after the headset test and the stress test with troops.
   */
  /** v2: field knights (KNIGHTS.maxField, 4 squads of up to 5) plus the wall garrison (6). */
  max: 26,
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
 * Field knights (v2, docs/v2-plan.md 2.7): they only come when the horn calls
 * them. The player aims the horn by looking at a road (HORN_AIM): a squad of
 * swordsmen and spearmen bursts out of the nearest wall entry and sprints
 * along the roads to that spot with a banner, crashes into the first goblins
 * it meets (several are knocked over, with a hit stop), then holds the spot:
 * it fights any goblin that comes within watchRadius of it, never chasing
 * past leash. At most maxSquads squads; at the limit the horn moves the
 * squad nearest the aimed spot there instead. A squad down to breakAt
 * knights marches home and frees its place. Squads stay between waves.
 * Runners dodge past with a quick hop. Sizes in cm, times in seconds.
 */
export const KNIGHTS = {
  /** Knights per squad, picked at random from min to max. */
  squadMin: 3,
  squadMax: 5,
  /** Squads at once (a level setting later). */
  maxSquads: 4,
  /** Most field knights at once (maxSquads full squads). */
  maxField: 20,
  /** A squad with this many knights left (or fewer) breaks: the rest march home, a new squad may come. */
  breakAt: 1,
  /** Gap between knights bursting out of the gate. */
  leaveGap: 0.3,
  /** Sprint speed as a multiple of TROOPS.speed, and the sprint clip's speed. */
  sprintScale: 2.5,
  sprintClipSpeed: 1.5,
  /** Their spots at the aimed point: this far apart sideways, and the second row this far behind. */
  holdSpread: 3.5,
  holdBack: 3,
  /** They go for any goblin this close to their spot... */
  watchRadius: 22,
  /** ...but never chase it farther than this from their spot (then they walk back). */
  leash: 35,
  /**
   * Safety net: a knight walking up to its goblin that has not reached it
   * after this long lets go (seconds), and leaves that goblin alone for
   * ignoreTime (headset test: knights ran in place beside goblins, nobody
   * fighting). The console says so ("[troops] a knight could not reach"), to
   * find the cause if it shows up.
   */
  /** The horn lesson's goblins stop this far out in front of the squad's spot (cm along the road), waiting to be fought. */
  lessonHoldOut: 6,
  closeGiveUp: 4,
  ignoreTime: 3,
  /** A knight in a moving mode that has not moved for this long is put where it was going (seconds, the run-in-place watchdog). */
  stuckTime: 2,
  /** A knight's strike lands this share (the garrison's guards use TROOPS.strikeChance). */
  strikeChance: 0.35,
  /** Walking back to their spot after a fight (multiple of TROOPS.speed). */
  postSpeedScale: 1.6,
  /** The crash: goblins this close to the first goblin met are knocked over (at most crashMax). */
  crashRadius: 12,
  crashMax: 6,
  /** A runner this close to a holding knight hops past it. */
  dodgeRange: 7,
  hopTime: 0.35,
  hopHeight: 3,
  /** The squad's banner, carried by its first knight in its left hand, held this far above the pole's foot (cm). */
  bannerGrip: 1.2,
  bannerHeight: 8,
  bannerWidth: 2.6,
  bannerLength: 1.8,
  bannerColor: 0x4673d2,
  bannerTrim: 0xffc446,
  poleColor: 0x5a4330,
  /** The banner of the squad the horn would move (aiming at the limit) pulses this much bigger, this fast. */
  answerPulse: 0.35,
  answerPulseSpeed: 7,
  answerColor: 0x9cc2ff,
};

/**
 * Aiming the horn (v2, src/ui/hornAim.ts). While the horn is held (anywhere,
 * so nothing covers the view), the head points it (Quest 3S has no eye
 * tracking: head gaze). Built from Meta's ray and gaze specs: for a head ray
 * the cue is on the target, not a long laser, so on the board: a soft glowing
 * pool on the road where the knights will go (like the system's gaze
 * spotlight, no hard ring), a light pillar up from it and a see-through ghost
 * banner. The spot only moves to a new road spot once the head has pointed
 * there for consensusTime (Meta's gaze consensus window), so it never
 * flickers. Lifted to the lips it locks: gold, a click, and the path the
 * knights will take lights up along the roads. Sizes in board cm.
 */
export const HORN_AIM = {
  /**
   * The look ray points this far below where the head points (degrees). The
   * headset knows only the head, and in VR most people rest their eyes a
   * little below it (headset test: the spot sat too far out, so the player
   * kept looking up with the eyes). 7 was still too far: 12 lets the head
   * stay level instead of bending the neck down for long. Tune it here.
   */
  gazeDropDeg: 12,
  /** The look ray is searched from just outside the wall out to this far (cm from the center). */
  minRadius: 62,
  maxRadius: 320,
  /** Step along the look ray when finding where it meets the ground (cm). */
  rayStep: 4,
  /** The spot snaps to the nearest road within this far of where the look meets the ground (cm). */
  snapRadius: 22,
  /** A new spot takes over only after it is pointed at this long (seconds), and if this far from the old one (cm). */
  consensusTime: 0.2,
  moveAtLeast: 4,
  /** The spot glides to its new place with this smoothing (seconds). */
  glide: 0.06,
  /** The light pillar up from the spot (cm), fading upward; locked, it grows by up to pillarGrow as the call charges. */
  pillarHeight: 22,
  pillarRadius: 0.9,
  pillarGrow: 0.8,
  pillarOpacity: 0.6,
  /** The path along the roads once locked (cm): ribbon width, a point every pathStep, just above the road, and its opacity. */
  pathWidth: 1.6,
  pathStep: 3,
  pathLift: 0.35,
  pathOpacity: 0.7,
  /** Locked at the lips: everything turns gold. */
  lockColor: 0xffc23a,
  /** The glowing pool on the road: radius (cm) and its strongest opacity. A slow breathing pulse. */
  poolRadius: 7,
  poolOpacity: 0.55,
  poolPulse: 0.15,
  /** Colors: a spot the knights can go to, and none in sight (grey, the horn will not blow). */
  color: 0xfff1b8,
  noneColor: 0x8a8a8a,
  /**
   * Off the road (headset test: the faint grey glow was hard to see): a
   * white ring with a dark edge where the look meets the ground (radius, cm),
   * and an arrow on the ground toward the nearest road, arrowGap out from the
   * ring, nudging arrowBob that way. Drawn over the hills.
   */
  /**
   * The lock follows the look (headset test: a spot locked while looking
   * elsewhere was lost from view): at the lips, the look resting on a road
   * spot for lockDwell seconds locks it; locked, the look more than unlockDeg
   * degrees from the spot for unlockGrace seconds unlocks it (a soft click),
   * and the spot follows the look again until it rests and locks once more.
   */
  lockDwell: 0.4,
  unlockDeg: 30,
  unlockGrace: 0.3,
  /** After a call the spot stays marked (gold) until the squad arrives, at most this long (seconds). */
  calledMax: 30,
  offRoad: { radius: 4.5, color: 0xffffff, edgeColor: 0x1a1410, arrowSize: 3, arrowGap: 2, arrowBob: 1.5 },
  /** The ghost banner's opacity. */
  ghostOpacity: 0.55,
};

/**
 * The glass sign (src/ui/kit/glassSign.ts): the see-through variant of the
 * hint sign. A small dark glass label a little above the look's center (it
 * never covers what the player looks at), following the look smoothly. Used
 * by lessons where the player must watch what is in front of them (the horn,
 * the balloon: `Hint.glass`, which hides the hint sign, so only one sign shows)
 * and by the horn while it is held (what to do now, and at the lips a live
 * bar: the blow against the line it must pass, or the quiet hold). Meters,
 * degrees, seconds.
 */
export const GLASS_SIGN = {
  distance: 0.6,
  /** Above the look's center by this much (degrees). */
  aboveDeg: 9,
  width: 0.26,
  height: 0.09,
  /** Text size on its 512 px wide canvas (shrinks to fit two lines). */
  fontPx: 40,
  glass: 'rgba(30, 22, 16, 0.55)',
  /** Follows the look with this smoothing. */
  smoothing: 0.12,
  bar: {
    width: 0.2,
    height: 0.012,
    /** Its middle, below the sign's middle. */
    y: -0.027,
    /** The shown level falls back this slowly (seconds for a full bar), so a short blow reads. */
    fall: 0.4,
    color: 0x7fd36a,
    overColor: 0xffc23a,
    lineColor: 0xffffff,
  },
  /** The horn's blow bar is full at this many times HORN.blowLevel (its line sits at 1 / hornBarMax). */
  hornBarMax: 1.6,
  /** After the horn sounds, the bar stays full and gold this long (seconds), so the player sees the blow counted. */
  blownHold: 1.5,
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
    /** v2: goblins carry swords too (the soldiers' Kenney sword, a little smaller). */
    goblinSword: {
      model: 'props/mini-arena/weapon-sword.glb',
      bone: 'arm-right',
      at: RIGHT_HAND,
      anchor: [0, 0.05, 0],
      axis: [0, -1, 0],
      dir: [0.45, 0.35, 0.82],
      axis2: [0, 0, 1],
      dir2: R_OUT,
      scale: 0.75,
    },
    /** v2: goblin shields (the soldiers' round shield, a little smaller). */
    goblinShield: {
      model: 'props/mini-dungeon/shield-round.glb',
      bone: 'arm-left',
      at: [0.2, 0.08, 0.02],
      anchor: [0, 0, 0],
      axis: [0, 0, 1],
      dir: L_OUT,
      axis2: [0, 1, 0],
      dir2: L_UP,
      scale: 0.62,
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

/**
 * Villagers (src/units/villagers.ts): peaceful people in the village squares
 * who walk about, stop to work or look about, and walk on. The human and the
 * archer bodies without gear, in plain work clothes (brown, cream, straw,
 * moss green). perVillage each, at most max in all. Walk spots are shares of
 * the village size from its middle (inside the ring of houses). They
 * animate every animEvery frames: every frame now, since every third
 * looked very choppy; to pay for it they walk less (longer stops) and turn
 * smoothly toward where they go (turnTime, seconds) instead of snapping.
 */
export const VILLAGERS = {
  enabled: true,
  height: 3.9,
  /** Four in each of the bigger villages now (were 2). */
  perVillage: 4,
  max: 16,
  speed: 2.4,
  walkFrom: 0.1,
  walkTo: 0.4,
  /** Share of stops spent working (the rest standing and looking about), and how long each lasts (seconds). */
  workShare: 0.6,
  workSeconds: [4, 9] as [number, number],
  lookSeconds: [3, 7] as [number, number],
  animEvery: 1,
  turnTime: 0.25,
  kinds: [
    {
      body: 'characters/mini-dungeon/character-human.glb',
      recolor: [
        { mesh: 'body', uv: [3 / 16, 4 / 16, 0.5, 1], color: [138, 92, 56] },
        { mesh: 'body', uv: [13 / 16, 14 / 16, 0.5, 1], color: [222, 206, 168] },
      ] as Recolor[],
    },
    {
      body: 'characters/mini-forest/character-archer.glb',
      recolor: [
        { mesh: 'body', uv: [3 / 16, 4 / 16, 0.75, 1], color: [196, 160, 84] },
        { mesh: 'head', uv: [3 / 16, 4 / 16, 0.75, 1], color: [110, 128, 70] },
      ] as Recolor[],
    },
  ],
};

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

/**
 * Arrows of the wall garrison's archers (v2, docs/v2-plan.md 2.7): easy to
 * see. 3 to 4 times longer than before, white feathers, a short light streak
 * behind, a high arc so they rise against the sky, and the archers fire
 * together as a volley (GARRISON.volleyEvery). Damage is decided in code
 * (random hits, a miss lands with a puff), arrows have no hitboxes. One
 * instanced mesh for the arrows and one for the streaks, a small pool.
 */
export const ARCHERS = {
  /** The share of arrows that hit (the goblin is knocked out, or loses its helmet or shield). */
  hitChance: 0.55,
  /** Arrow flight time (seconds) and arc height (cm). A little lower and quicker since the range is shorter. */
  flightTime: 0.75,
  arcHeight: 16,
  /** Arrow size (cm). Was 2.2, then 7.5 (too long after the headset test). */
  length: 4.5,
  /** The light streak behind it (cm long) and its look. */
  streakLength: 4.5,
  streakColor: 0xfff6d8,
  streakOpacity: 0.45,
  poolSize: 16,
  shaftColor: 0x8a5a2b,
  tipColor: 0xd8dbe6,
  featherColor: 0xffffff,
};

/**
 * The wall garrison (v2, docs/v2-plan.md 2.7, src/units/garrison.ts): on the
 * rampart, at most 4 archers and 2 guards (swordsmen), one per stretch of
 * wall between two towers, each with its home stretch. When there are fewer,
 * one new one climbs up from the courtyard every refillEvery until all are
 * back. They walk along the rampart (one angle on a ring, cheap) toward the
 * nearest threat on their stretch. Archers shoot outward at goblins walking
 * in (range), together as a volley, and back away from goblins on the
 * rampart. Guards fight goblins on the rampart up close. Goblins on the
 * rampart attack them (an archer goes down in 2 hits). Sizes in cm, times in
 * seconds, angles in degrees.
 */
export const GARRISON = {
  archers: 4,
  guards: 2,
  /** Home stretches (degrees, the middles between towers): guards first, then archers. */
  homesDeg: [0, 180, 60, 120, 240, 300],
  /** Where they stand on the wall top (cm from the center), a little inside the goblins' path. */
  radius: 47.8,
  /** A missing archer is replaced every refillEvery, a missing guard every guardRefillEvery (slower, so helping them matters). */
  refillEvery: 15,
  guardRefillEvery: 30,
  /** Climbing up from the courtyard takes this long. */
  climbTime: 2.2,
  /** Walking speed along the rampart (cm per second), and the guards' (they hunt goblins round the whole wall). */
  walkSpeed: 4,
  guardSpeed: 8,
  /**
   * Archers shoot goblins this far from them (cm, flat), all together this
   * often, a little staggered. Was 100 with one arrow per knockout (goblins
   * never reached the wall), then 35 (too short). Now longer again, but an
   * arrow is weaker than a sword: it takes arrowsPerHit arrows to make one
   * hit (a bare goblin, or a helmet or shield coming off). 85 reached almost
   * to the end of the first ring of roads (headset test): 60 now.
   */
  archerRange: 60,
  arrowsPerHit: 2,
  volleyEvery: 2.2,
  volleyStagger: 0.07,
  /** Archers back away from a goblin on the rampart this close (cm along the wall). */
  backAway: 9,
  /** Guards walk to a goblin on their stretch, and fight it this close (cm along the wall). */
  guardReach: 3,
  /** A goblin on the rampart attacks a garrison soldier this close (cm along the wall). */
  goblinReach: 3,
};

/**
 * Goblin gear (v2, docs/v2-plan.md 2.5, rules in src/rules/gear.ts): grunts
 * carry a spear or a sword (or nothing), some wear a helmet, some carry a
 * shield. Helmet and shield are each one extra hit, for every hit (pebble,
 * arrow, soldier, swatter, goblin shot): it flies off instead and the goblin
 * reels back. Triggers (keg, boulder, tree) ignore armor. A spear doubles
 * wall damage, a sword strikes soldiers faster. Runners stay bare handed.
 */
export const GOBLIN_GEAR = {
  spearShare: 0.4,
  swordShare: 0.25,
  helmetShare: 0.35,
  shieldShare: 0.3,
  /** Helmets only from this wave (1 based), so the first lessons stay one hit. */
  helmetFromWave: 3,
  /** Shields from this wave (1 based). */
  shieldFromWave: 4,
  /** A spear's wall hit does this many times the damage. */
  spearWallDamage: 2,
  /** A sword strikes at soldiers this much more often (its strike gap is multiplied by this). */
  swordStrikeScale: 0.6,
  /**
   * After armor takes a hit, the goblin cannot be hit again for this long
   * (seconds): one swatter swing over several frames, or two pebbles at once,
   * take one piece, not all of them.
   */
  hitGrace: 0.35,
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
  /** Envelope radius, and its height over the board (center). */
  radius: 5.5,
  height: 44,
  /**
   * The basket (cm): wide enough for both riders side by side, standing in
   * it, heads and shoulders over the rim (they used to hang under it).
   */
  basketRadius: 2.5,
  basketHeight: 2.4,
  riderGap: 1.8,
  /** Riders per balloon (grunts). */
  riders: 2,
  /** Where it comes in from (cm from the center) and how fast it floats (cm per second). */
  startRadius: 175,
  speed: 7.5,
  /**
   * The balloon lesson (in the slingshot wave): one balloon starts closer,
   * right in front, and hovers this far out (outside the wall, clear of its
   * threat flash) with its riders until the player pops it.
   */
  introRadius: 120,
  lessonWaitAt: 80,
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
  /** The sun and the moon are this far away (meters). Where they are, and all the sky colors, change with the time of day (DAY_NIGHT). */
  sunDistance: 150,
  /** The sky dome (meters, inside the camera's 200 m far plane). */
  domeRadius: 175,
  /**
   * The glow on the dome around the sun (or the moon at night): a wide haze
   * and a tight one, strongest low on the horizon. Spread is how wide each
   * one is (higher = tighter). Colors and strengths are in DAY_NIGHT.
   */
  glowOrangeSpread: 3,
  glowYellowSpread: 18,
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
  /** The moon (meters): a faceted ball, pale blue-white with a darker edge, and a soft cool glow behind (a share of its radius). */
  moonRadius: 3.6,
  moonColor: 0xeef3ff,
  moonEdgeColor: 0xa9b8e0,
  moonGlowColor: 0x9fb8ff,
  moonGlowShare: 4,
  /** Stars: one mesh of points on the upper sky (count, size in screen pixels, lowest height above the horizon in degrees). */
  starCount: 360,
  starSize: 5,
  starMinElevationDeg: 8,
  starColor: 0xf4f7ff,
  /**
   * Twinkle: now and then a star quickly dims and shrinks, each at its own
   * pace. How much dimmer at its lowest (0 = never, 1 = out), how much smaller,
   * and how fast (radians per second, from, to). Raised from 0.6 and 1.2 to 3.5
   * after the first headset look: a slow soft pulse on tiny dots did not show.
   */
  starTwinkle: 0.9,
  starTwinkleShrink: 0.5,
  starTwinkleSpeed: [2.5, 7] as [number, number],
  /**
   * The ringed planet (night only): big, straight in front, high in the
   * sky and far away (smaller and more faded than at first, when it looked
   * like it sat on the ground). It rises from below the horizon as night
   * comes (DayLook.planetAt; anything below the horizon is cut off). Meters:
   * ball radius, distance (inside the 200 m far plane with its rings), the
   * rings' inner and outer edge as a share of the radius. Tilted toward the
   * player (degrees) so the rings read as rings, and rolled a little.
   */
  planetAngleDeg: 0,
  planetRadius: 17,
  planetDistance: 178,
  planetRingInner: 1.35,
  planetRingOuter: 2.35,
  planetTiltDeg: 20,
  planetRollDeg: -14,
  /** Squashed front to back, so the far side of the rings stays inside the far plane. Seen from the front it looks the same. */
  planetDepth: 0.3,
  /**
   * One color in different shades: the planet's color, the shade of each
   * wavy band from the top down and of each ring band from the inside out
   * (1 = the color, 0 = a gap in the rings). A background piece, so its
   * colors are blended toward the night sky around it by `planetSkyBlend`
   * (0 = its own color, 1 = the sky), and its light and dark sides stay soft.
   */
  planetColor: 0xb7a4e0,
  planetBands: [1.06, 0.9, 1, 0.8, 0.95, 0.84, 1.02, 0.9],
  planetRingBands: [1.08, 0.94, 0, 0.82, 1, 0.88],
  /**
   * A warm orange-red mixed into some bands (share of it per band, 0 = the
   * lavender only), so the planet has warm stripes and a warm ring.
   */
  planetWarm: 0xe0704a,
  planetWarmBands: [0, 0.55, 0.15, 0.75, 0, 0.6, 0.25, 0.45],
  planetWarmRings: [0.2, 0.65, 0, 0.4, 0.8, 0.3],
  planetSkyBlend: 0.55,
};

/** The four times of day, in order. */
export const TIMES_OF_DAY = ['morning', 'day', 'sunset', 'night'] as const;
export type TimeOfDay = (typeof TIMES_OF_DAY)[number];

/** How the sky and the light look at one time of day. Angles: compass from the player's first view (0 = front, positive = right), and degrees above the horizon. */
export interface DayLook {
  /** Sky dome: top, horizon (the fog color too) and below the horizon. */
  domeTop: number;
  domeHorizon: number;
  domeBottom: number;
  /** The glow on the dome around the sun (or the moon when the sun is down): a wide haze and a tight one, each with a strength (0 to 1). */
  glowWide: number;
  glowTight: number;
  glowWideStrength: number;
  glowTightStrength: number;
  /** Where the sun is, how big (0 = gone, 1 = full size) and its tint (white = its own colors). */
  sunAt: [number, number];
  sunShow: number;
  sunTint: number;
  /** Where the moon is and how much it shows (0 to 1). */
  moonAt: [number, number];
  moonShow: number;
  /** How bright the stars are (0 to 1). */
  stars: number;
  /** The one real light (sun or moon): where it comes from (higher than the sun, so the board's tops stay lit), color, strength. */
  lightAt: [number, number];
  lightColor: number;
  lightIntensity: number;
  /** The soft sky fill on every lit thing (scene.environmentIntensity; the scene file's IBLGradient intensity by day). */
  fill: number;
  /** Clouds are tinted by this (white = their own colors). */
  cloudTint: number;
  /** The bright edge on troops and goblins (0 = off, 1 = full), so they stand out at night. */
  rim: number;
  /**
   * The board, the castle and the hills: their colors are multiplied by this
   * tint (white = their own colors) times terrainBright, after losing
   * terrainGrey of their color (0 = none, 1 = grey). Cool and dark at night,
   * warm and golden in the noon sun. Anything that glows is left out.
   */
  terrainTint: number;
  terrainBright: number;
  terrainGrey: number;
  /** Height of the ringed planet's middle above the horizon (degrees; below the horizon is cut off). Low enough and it is gone. */
  planetAt: number;
  /** How bright the night lights are: glowing windows, torches, lanterns (0 = off, 1 = full). */
  lights: number;
}

/**
 * Day and night (docs/mvp.md, "Day and night cycle"). Time follows the waves,
 * not a clock: the first wave is in the morning, the last at night, the one
 * before it at sunset, the rest by day (src/rules/dayNight.ts). It changes
 * only between waves, while the board is quiet, and stays still during a
 * wave, so it costs nothing while fighting. Only colors and the sky pieces
 * move, nothing on the board, so it is fine for comfort.
 *
 * Readability first: the night stays a bright moonlit blue, never dark, and
 * troops and goblins get a bright edge (the rim), so they are always easy to
 * spot. All of these are starting values to tune in the headset.
 */
export const DAY_NIGHT = {
  enabled: true,
  /** How long one change takes (seconds), starting when a wave is cleared. Shorter reads as a flicker. */
  changeSeconds: 8,
  /** The rim: how thin it is (higher = thinner, only the very edge) and its color on each side. */
  rimPower: 2.4,
  rimGoblin: 0xc6ff6e,
  rimTroop: 0xffd66b,
  looks: {
    // The first look, as tuned in the headset tests: a low sun a little right of front, so the
    // sunrise glow is in view and clear of the hint sign. Sunlight 2.2 with the fill at 0.6,
    // so slopes facing the sun are clearly lit and the ones facing away clearly shaded.
    morning: {
      domeTop: 0x46a8ff,
      domeHorizon: 0xb1e5fe,
      domeBottom: 0xa2d1e1,
      glowWide: 0xff9a3c,
      glowTight: 0xffe08a,
      glowWideStrength: 0.85,
      glowTightStrength: 0.9,
      sunAt: [35, 13],
      sunShow: 1,
      sunTint: 0xffffff,
      moonAt: [55, -15],
      moonShow: 0,
      stars: 0,
      lightAt: [35, 40],
      lightColor: 0xfff4e0,
      lightIntensity: 2.2,
      fill: 0.6,
      cloudTint: 0xffffff,
      rim: 0,
      terrainTint: 0xffffff,
      terrainBright: 1,
      terrainGrey: 0,
      planetAt: -25,
      lights: 0,
    },
    // Super sunny: a high sun, warm golden light, a soft blue top over a warm orange haze (the fog
    // too, so the air has an orange tint), a wide warm glow, cream clouds. Warmer after the
    // first look: the cool blue day did not feel sunny. Then more orange and red, and the
    // terrain golden like grass in strong sun (it read too green). Then less pink: a blue top
    // fading into a peach horizon mixes to pink in between, so the top is a greener sky blue
    // and the horizon a yellower orange with little blue in it.
    day: {
      domeTop: 0x5ab4e4,
      domeHorizon: 0xffb450,
      domeBottom: 0xeea04c,
      glowWide: 0xff8a2c,
      glowTight: 0xffdc8c,
      glowWideStrength: 0.55,
      glowTightStrength: 0.75,
      sunAt: [20, 42],
      sunShow: 0.9,
      sunTint: 0xffffff,
      moonAt: [55, -15],
      moonShow: 0,
      stars: 0,
      lightAt: [20, 62],
      lightColor: 0xffc27a,
      lightIntensity: 2.7,
      fill: 0.7,
      cloudTint: 0xffdcaa,
      rim: 0,
      // Less blue and a little less green, a little brighter: green grass turns golden yellow-green.
      terrainTint: 0xffe2b4,
      terrainBright: 1.1,
      terrainGrey: 0,
      planetAt: -25,
      lights: 0,
    },
    // The sun low on the left, deep orange, a warm horizon under a violet-blue top.
    sunset: {
      domeTop: 0x5b70d2,
      domeHorizon: 0xffb27a,
      domeBottom: 0xd99a80,
      glowWide: 0xff6a2a,
      glowTight: 0xffc060,
      glowWideStrength: 1,
      glowTightStrength: 0.9,
      sunAt: [-40, 7],
      sunShow: 1.1,
      sunTint: 0xffa070,
      moonAt: [55, -15],
      moonShow: 0,
      stars: 0,
      lightAt: [-40, 30],
      lightColor: 0xffb070,
      lightIntensity: 2,
      fill: 0.5,
      cloudTint: 0xffc4a6,
      rim: 0.35,
      terrainTint: 0xf3f4f9,
      terrainBright: 1,
      terrainGrey: 0.045,
      planetAt: -25,
      lights: 0.35,
    },
    // A deep blue night with stars, the moon and the ringed planet rising in front. Darker
    // after the first headset look (it was too bright). The units keep their bright rim and
    // the terrain fades to grey-blue, so goblins still stand out.
    night: {
      domeTop: 0x040a22,
      domeHorizon: 0x122246,
      domeBottom: 0x0d1834,
      glowWide: 0x6f8ad8,
      glowTight: 0xc4d4ff,
      glowWideStrength: 0.25,
      glowTightStrength: 0.4,
      sunAt: [-55, -12],
      sunShow: 0,
      sunTint: 0xff8050,
      moonAt: [45, 24],
      moonShow: 1,
      stars: 1,
      lightAt: [45, 50],
      lightColor: 0xa9bfff,
      lightIntensity: 0.7,
      fill: 0.3,
      cloudTint: 0x3a4670,
      rim: 1,
      // Darker, a little blue and a little less colorful, never lighter.
      terrainTint: 0xbfc6e1,
      terrainBright: 1,
      terrainGrey: 0.21,
      planetAt: 21,
      lights: 1,
    },
  } satisfies Record<TimeOfDay, DayLook>,
};

/**
 * Night lights (decor only, src/world/nightLights.ts): warm glowing village
 * windows, a torch on the courtyard side of each castle tower, and a glow on
 * each village lantern. No real lights: bright unlit colors and soft additive
 * glows, 5 draw calls, and only while they show (DayLook.lights). Board cm
 * unless it says otherwise.
 */
export const NIGHT_LIGHTS = {
  /** A window's warm pane as a share of one wall tile (wide, tall), its middle's height on the tile, and how far out (the wall's outside is at 0.5). */
  paneSize: [0.3, 0.36] as [number, number],
  paneHeight: 0.52,
  paneOut: 0.515,
  paneColor: 0xffb43c,
  /** The soft glow around each window, on the wall (share of a tile across), its color and strength. Brighter and more yellow-orange after the step 7 and 8 test. */
  windowGlowSize: 1.3,
  windowGlowColor: 0xffa024,
  windowGlowStrength: 1.4,
  /** Torches: distance from the board's middle (just inside each tower), the flame's height above the board, the stick's length and the flame's size. */
  torchRadius: 44.2,
  torchHeight: 8.4,
  torchStick: 3,
  torchFlame: 1.4,
  torchStickColor: 0x6b4a2b,
  /** The flame from its base to its tip. */
  flameBase: 0xff5a14,
  flameTip: 0xfff0a0,
  /** Flicker: how much a flame's size wobbles (share) and how fast. */
  flicker: 0.2,
  flickerSpeed: 9,
  /**
   * The small soft halos that always face the player, right at each castle
   * torch's flame and each village lantern (cm across), their color and
   * strength. Small on purpose: the first 10 cm glows read as floating balls,
   * not light (headset test). The road torches have none: their light is the
   * pool on the ground.
   */
  torchGlowSize: 2.8,
  lanternGlowSize: 3,
  glowColor: 0xffa030,
  glowStrength: 1.15,
  /** Where the lantern model's light is (share of its height). */
  lanternLightAt: 0.82,
  /**
   * Torches beside the roads (src/world/boardBuilder.ts roadTorchSpots):
   * one every roadTorchEvery cm along each road, sides taking turns,
   * roadTorchOut cm past the road's edge, only between roadTorchFrom and
   * roadTorchTo cm from the middle, at most roadTorchMax. A taller post, and
   * a pool of warm light on the ground around each (cm across, color,
   * strength): a soft oval roadPoolStretch times longer along the road, its
   * size flickering with the flame by up to roadPoolFlicker (share).
   */
  roadTorchEvery: 45,
  roadTorchOut: 3,
  roadTorchFrom: 85,
  roadTorchTo: 380,
  roadTorchMax: 40,
  roadTorchStick: 6,
  roadPoolSize: 22,
  roadPoolStretch: 1.6,
  roadPoolFlicker: 0.08,
  roadPoolColor: 0xff9a3a,
  roadPoolStrength: 0.6,
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
   * Standing for the whole test (v2): the full wall garrison on the rampart
   * (GARRISON, 2 guards and 4 archers) and the full knight squads on roads
   * around the board (KNIGHTS.maxSquads of squadMax), all walking on the spot so they cost what
   * moving soldiers cost but never fight, plus balloons with riders
   * (hovering), so the budget counts the army and the flying enemies too.
   */
  garrison: 6,
  /** KNIGHTS.maxSquads full squads (4 of 5). */
  knights: 20,
  balloons: 2,
};

/**
 * The live loudness panel (debug, src/debug/micPanel.ts): like the FPS panel,
 * on the other side of front. The loudest level over the last recentSeconds,
 * redrawn at most every drawEvery seconds (only when a number changed).
 */
export const MIC_PANEL = {
  radius: 27,
  angleDeg: 16,
  aboveRing: 1,
  width: 13.6,
  height: 6.8,
  recentSeconds: 3,
  drawEvery: 0.25,
};

/** Live frame rate panel for performance checks (debug). */
export const FPS = {
  /** Frame rate to hold when the XR session does not report its own (Quest browser default). */
  target: 72,
  /** Live numbers are measured over this long (seconds). */
  refresh: 0.5,
  /** The panel redraws at most this often, and only when its text changed (seconds). */
  drawEvery: 1,
  /** Hidden by default. The debug page's "FPS on/off" button shows it, and ?fps in the URL on the hosted build. */
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
