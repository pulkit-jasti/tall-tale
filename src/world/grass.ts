// The grass colors on the uneven ground (decor only, no gameplay): one solid
// color per triangle (the classic low-poly look). Yellow-green on the hill
// tops, blue-green in the valleys, earthier on steep slopes, a little darker
// right by the wall, worn and yellower along the roads, dirty around the
// camps, and each triangle a little different. The board mesh bakes them in,
// so they cost nothing per frame, and the sun on each facet does the rest.
// (Tiny grass tufts, flowers, a fine grain and soft noise patches were tried
// before the uneven ground and dropped: too small to see, or blotchy.)
import { Color } from 'three';
import { CASTLE, GRASS, ROADS, TERRAIN } from '../config/game.js';
import type { Random } from '../rules/random.js';
import { campDistance, smooth, type CampSpot, type Terrain } from './terrain.js';

/** The ground's color at any board spot. */
export class Meadow {
  private readonly dark = new Color(GRASS.darkColor);
  private readonly light = new Color(GRASS.lightColor);
  private readonly worn = new Color(GRASS.wornColor);
  private readonly dirt = new Color(GRASS.dirtColor);
  private readonly slope = new Color(GRASS.slopeColor);
  private readonly ash = new Color(GRASS.ashColor);

  /** `camps` are worn to dirt (the camps and the village squares), `burned` to ash (the burned village). */
  constructor(
    private readonly terrain: Terrain,
    private readonly camps: CampSpot[],
    private readonly rng: Random,
    private readonly burned: CampSpot[] = [],
  ) {}

  /**
   * One triangle's color, from its middle (board cm, `r` from the center) and
   * how steep it is (0 = flat, 1 = a wall): the ground color there, earthier
   * when steep, then nudged a little in brightness and hue.
   */
  faceColor(x: number, z: number, r: number, steepness: number, out: Color): Color {
    this.colorAt(x, z, r, out);
    out.lerp(this.slope, GRASS.slopeShare * smooth(GRASS.slopeFrom, GRASS.slopeTo, steepness));
    out.offsetHSL(this.rng.range(-GRASS.hueVary, GRASS.hueVary), 0, 0);
    return out.multiplyScalar(1 + this.rng.range(-GRASS.vary, GRASS.vary));
  }

  /** The ground color at a board spot `r` cm from the center: yellow-green on the tops, blue-green in the dips. */
  colorAt(x: number, z: number, r: number, out: Color): Color {
    // 0 in the deepest dips, 1 on the highest tops, for the hill height here.
    const height = Math.max(1, this.terrain.amplitude(r));
    const top = (this.terrain.bump(x, z) / height + TERRAIN.dipShare) / (1 + TERRAIN.dipShare);
    out.copy(this.dark).lerp(this.light, Math.min(1, Math.max(0, top)));
    const half = ROADS.width / 2;
    out.lerp(this.worn, 0.85 * (1 - smooth(half, half + GRASS.wornWidth, this.terrain.roads.distance(x, z))));
    out.lerp(this.dirt, 0.8 * (1 - smooth(0, GRASS.dirtWidth, campDistance(this.camps, x, z))));
    if (this.burned.length > 0) out.lerp(this.ash, 0.85 * (1 - smooth(0, GRASS.ashWidth, campDistance(this.burned, x, z))));
    // A soft shadow on both sides of the wall.
    const fromWall = r < CASTLE.wallIn ? CASTLE.wallIn - r : Math.max(0, r - CASTLE.wallOut);
    out.multiplyScalar(1 - GRASS.wallShade * (1 - smooth(0, GRASS.wallShadeTo - CASTLE.wallOut, fromWall)));
    return out;
  }
}
