// What a level is (docs/custom-mode.md section 2): the map (a blueprint, the
// format the board builder already reads), the 4 waves, the rules (the
// twist outside the map and waves) and the meta (the seed and settings it
// was made from, so it can be made again). Campaign levels are frozen files
// of this; Custom Game levels are saved in localStorage as this.
// No Three.js and no browser code here (the command line generator uses it).
import { fixSettings, type LevelSettings } from '../config/levelSettings.js';
import { parseBlueprint, type Blueprint } from '../rules/blueprint.js';
import type { GearShares } from '../rules/gear.js';

export const LEVEL_FORMAT = 1;

export interface LevelWave {
  /** Camp ids that send goblins this wave. */
  camps: string[];
  /** Camp ids that rise as this wave starts (docs/custom-mode.md section 7). */
  rising: string[];
  counts: { grunt: number; runner: number };
  /** Groups come out over this long (seconds); the wave runs until it is cleared. */
  spawnTime: number;
  balloons: number;
  /** Shares of the grunts with each piece of gear. */
  gear: GearShares;
}

export interface LevelRules {
  archers: number;
  guards: number;
  /** A missing archer comes back this often, a guard this often (seconds). */
  refillEvery: number;
  guardRefillEvery: number;
  /** The castle's starting health (share of the full). */
  startHealth: number;
}

export interface LevelMeta {
  /** The seed the level was made from (the asked one, or the next that passed the checks). */
  seed: number;
  askedSeed: number;
  settings: LevelSettings;
  generator: number;
  /** Campaign levels only. */
  level?: number;
  skulls: 1 | 2 | 3;
}

export interface Level {
  format: number;
  map: Blueprint;
  waves: LevelWave[];
  rules: LevelRules;
  meta: LevelMeta;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Checks a level read from JSON (a file or storage) and returns it typed. Throws with a clear message if it is broken. */
export function parseLevel(data: unknown): Level {
  const fail = (why: string): never => {
    throw new Error(`[level] ${why}`);
  };
  if (!data || typeof data !== 'object') fail('not an object');
  const l = data as Partial<Level>;
  if (l.format !== LEVEL_FORMAT) fail(`unknown format ${String(l.format)}`);
  const map = parseBlueprint(l.map);
  const camps = new Set(map.nodes.filter((n) => n.kind === 'camp').map((n) => n.id));
  if (!Array.isArray(l.waves) || l.waves.length === 0) fail('no waves');
  for (const [i, w] of l.waves!.entries()) {
    if (!Array.isArray(w.camps) || !w.camps.every((c) => camps.has(c))) fail(`wave ${i + 1} sends from an unknown camp`);
    if (!Array.isArray(w.rising) || !w.rising.every((c) => camps.has(c))) fail(`wave ${i + 1} raises an unknown camp`);
    if (!w.counts || !isNum(w.counts.grunt) || !isNum(w.counts.runner)) fail(`wave ${i + 1} has bad counts`);
    if (!isNum(w.spawnTime) || !isNum(w.balloons)) fail(`wave ${i + 1} has a bad spawn time or balloons`);
    if (!w.gear || !['spearShare', 'swordShare', 'helmetShare', 'shieldShare'].every((k) => isNum((w.gear as unknown as Record<string, unknown>)[k])))
      fail(`wave ${i + 1} has bad gear`);
  }
  const r = l.rules;
  if (!r || ![r.archers, r.guards, r.refillEvery, r.guardRefillEvery, r.startHealth].every(isNum)) fail('bad rules');
  const m = l.meta;
  if (!m || !isNum(m.seed) || !isNum(m.askedSeed) || !isNum(m.generator) || ![1, 2, 3].includes(m.skulls as number)) fail('bad meta');
  return { format: LEVEL_FORMAT, map, waves: l.waves!, rules: r!, meta: { ...m!, settings: fixSettings(m!.settings) } };
}
