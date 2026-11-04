// Simple roads for the toy test (build step 1). No longer used: step 3
// replaced this with src/maps/tutorial.json and the road graph. Safe to delete.
// Points are [distance from center in cm, angle in degrees]. Angle 0 is the
// front of the board (in front of the player), positive angles go to the right.
// Each road runs from its camp to the wall.

export interface ToyCamp {
  /** Camp hill position. */
  at: [number, number];
  /** Hill width (cm). Bigger camp, more enemies. */
  size: number;
}

export interface ToyRoad {
  points: [number, number][];
  camp: ToyCamp;
}

export const TOY_ROADS: ToyRoad[] = [
  {
    camp: { at: [205, 12], size: 22 },
    points: [[190, 11], [140, 4], [95, -6], [62, -2], [52, 0]],
  },
  {
    camp: { at: [235, 78], size: 26 },
    points: [[220, 77], [160, 66], [110, 72], [70, 62], [52, 58]],
  },
  {
    camp: { at: [215, 182], size: 20 },
    points: [[200, 181], [150, 170], [100, 178], [66, 172], [52, 174]],
  },
  {
    camp: { at: [175, -83], size: 18 },
    points: [[160, -82], [120, -92], [80, -80], [62, -73], [52, -70]],
  },
];

/** Index of the road in front of the player. */
export const FRONT_ROAD = 0;
