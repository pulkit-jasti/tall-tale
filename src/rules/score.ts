// v3 Phase 4: the battle score (docs/v3-plan.md "The score and the stars").
//
// Pure rules, no three.js: the battle tells it about each knockout (how far
// out, by which tool, when) and each goblin eaten, and at the end it adds the
// castle's health part and works out par. The stars come from the share of
// par (starsFor in src/rules/campaign.ts).
import { SCORE } from '../config/game.js';
import type { PickTool } from './campaign.js';

/** What knocked a goblin out, for combos: a player tool, or a trap (kegs, boulders, trees, bridges, potions, bomber blasts), whoever set it off. */
export type ScoreSource = PickTool | 'traps';

/** Short names for the win panel's breakdown. */
export const SOURCE_NAMES: Record<ScoreSource, string> = {
  slingshot: 'Slingshot',
  horn: 'Knights',
  swatter: 'Swatter',
  pepper: 'Pepper',
  drum: 'Drum',
  magnet: 'Magnet',
  glass: 'Glass',
  sugar: 'Sugar',
  traps: 'Traps',
};

/** The score's parts, for the win panel's breakdown. */
export interface ScoreParts {
  /** Every goblin defeated (eaten too): points, and how many goblins. */
  defeated: number;
  goblins: number;
  /** Far and middle knockouts: points, and how many of each. */
  distance: number;
  far: number;
  middle: number;
  /** Combos (one action knocking out 3 or more): points, how many combos, the biggest, and the points by source (most first). */
  multi: number;
  combos: number;
  best: { source: ScoreSource; count: number } | null;
  bySource: { source: ScoreSource; points: number }[];
  /** The castle's health left: points, and the share (0 to 1). */
  castle: number;
  health: number;
  total: number;
  /** The level's par (goblins x perGoblin x 2). */
  par: number;
}

export class BattleScore {
  private defeated = 0;
  private distance = 0;
  private multi = 0;
  private far = 0;
  private middle = 0;
  private combos = 0;
  private best: { source: ScoreSource; count: number } | null = null;
  private bySource = new Map<ScoreSource, number>();
  /** The goblins the battle's waves sent (par comes from it). */
  private planned = 0;
  /** Per source: when its current action's first knockout was, and how many it has knocked out. */
  private actions = new Map<ScoreSource, { at: number; count: number }>();

  reset(): void {
    this.defeated = this.distance = this.multi = this.planned = 0;
    this.far = this.middle = this.combos = 0;
    this.best = null;
    this.bySource.clear();
    this.actions.clear();
  }

  /** A wave started with this many goblins (balloon riders too). */
  addPlanned(goblins: number): void {
    this.planned += goblins;
  }

  /** A goblin knocked out `radius` cm from the castle's middle, by a player tool or a trap (null: a soldier, a fall), at `now` seconds. */
  knockOut(radius: number, source: ScoreSource | null, now: number): void {
    this.defeated += SCORE.perGoblin;
    if (radius >= SCORE.farFrom) {
      this.distance += SCORE.farBonus;
      this.far++;
    } else if (radius >= SCORE.middleFrom) {
      this.distance += SCORE.middleBonus;
      this.middle++;
    }
    if (!source) return;
    const action = this.actions.get(source);
    if (!action || now - action.at > SCORE.multiWindow) {
      this.actions.set(source, { at: now, count: 1 });
      return;
    }
    action.count++;
    if (action.count < SCORE.multiFrom) return;
    if (action.count === SCORE.multiFrom) this.combos++;
    this.multi += SCORE.multiBonus;
    this.bySource.set(source, (this.bySource.get(source) ?? 0) + SCORE.multiBonus);
    if (!this.best || action.count > this.best.count) this.best = { source, count: action.count };
  }

  /** A goblin eaten, or spent as a slingshot shot: defeated, no distance bonus. */
  eaten(): void {
    this.defeated += SCORE.perGoblin;
  }

  /** The final score, with the castle's health share left (0 to 1). */
  final(healthShare: number): ScoreParts {
    const half = this.planned * SCORE.perGoblin;
    const health = Math.max(0, Math.min(1, healthShare));
    const castle = Math.round(half * health);
    const total = this.defeated + this.distance + this.multi + castle;
    const bySource = [...this.bySource].map(([source, points]) => ({ source, points })).sort((a, b) => b.points - a.points);
    return {
      defeated: this.defeated,
      goblins: Math.round(this.defeated / SCORE.perGoblin),
      distance: this.distance,
      far: this.far,
      middle: this.middle,
      multi: this.multi,
      combos: this.combos,
      best: this.best ? { ...this.best } : null,
      bySource,
      castle,
      health,
      total,
      par: half * 2,
    };
  }
}
