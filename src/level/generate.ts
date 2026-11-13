// The level generator (docs/custom-mode.md): settings in, level out.
// `generateLevel(seed, settings)` makes the same level for the same seed and
// settings, every time. It lays out the map (camps, winding roads with
// forks, ring roads and crossings, wall entries, triggers), picks which
// camps rise in which wave, writes the 4 waves and the rules, checks the
// result (src/level/checks.ts) and tries the next seed when a check fails.
//
// Plain TypeScript with no browser code: the game and the command line
// (scripts/gen.mjs) both call it. The board builder only draws its result:
// villages, fields, story spots, decor and the ground under the triggers are
// planned from this map by the planners that already exist
// (src/world/settlements.ts, storySpots.ts, triggers.ts, terrain.ts), when
// the map is loaded. Every random pick goes through the one seeded random.
import { LEVEL_GEN, BALLOONS } from '../config/game.js';
import { DIFFICULTY, SEED, type LevelSettings } from '../config/levelSettings.js';
import { TRIGGER_KINDS, TRIGGER_LIST, type TriggerKind } from '../config/registries.js';
import { degToRad } from '../rules/boardMath.js';
import type { Blueprint, BlueprintNode, BlueprintRoad, BlueprintTrigger, Polar } from '../rules/blueprint.js';
import { createRandom, type Random } from '../rules/random.js';
import { checkLevel } from './checks.js';
import { distance, lineLength, meanDeg, pointAlong, tidy, turnDeg, wrapDeg } from './geometry.js';
import { LEVEL_FORMAT, type Level, type LevelRules, type LevelWave } from './level.js';

const G = LEVEL_GEN;

/** What the layout made, besides the blueprint (for the summary). */
export interface LayoutStats {
  outer: number;
  inner: number;
  forks: number;
  loops: number;
  crossings: number;
}

export interface Generated {
  level: Level;
  stats: LayoutStats;
  /** Seeds tried before one passed (1 = the asked seed passed). */
  tries: number;
}

export class LevelGenError extends Error {
  constructor(
    message: string,
    readonly problems: string[],
  ) {
    super(message);
  }
}

/** Seeds stay in the range the seed control shows. */
export const wrapSeed = (seed: number): number => (((Math.round(seed) % (SEED.max + 1)) + SEED.max + 1) % (SEED.max + 1));

/**
 * Makes a level. Throws LevelGenError when no seed from `seed` on passes the
 * checks (settings that cannot work, for example too many camps one side).
 */
export function generateLevel(seed: number, settings: LevelSettings, name = 'custom'): Generated {
  const asked = wrapSeed(seed);
  let problems: string[] = [];
  for (let t = 0; t < G.tries; t++) {
    const used = wrapSeed(asked + t);
    const rng = createRandom(used * 2654435761 + 97);
    const { map, stats } = layout(rng, settings, name, used);
    const waves = planWaves(rng, settings, map);
    const level: Level = {
      format: LEVEL_FORMAT,
      map,
      waves,
      rules: planRules(settings),
      meta: { seed: used, askedSeed: asked, settings: structuredClone(settings), generator: G.version, skulls: DIFFICULTY[settings.difficulty].skulls },
    };
    problems = checkLevel(level, settings);
    if (problems.length === 0) return { level, stats, tries: t + 1 };
  }
  throw new LevelGenError(`no level passed the checks in ${G.tries} seeds from ${asked}`, problems);
}

// ---------------------------------------------------------------------------
// The map

interface Junction {
  id: string;
  at: Polar;
  /** The inner junction's id, near the wall. */
  inner: string;
}

function layout(rng: Random, s: LevelSettings, name: string, seed: number): { map: Blueprint; stats: LayoutStats } {
  const nodes: BlueprintNode[] = [];
  const roads: BlueprintRoad[] = [];
  const stats: LayoutStats = { outer: 0, inner: 0, forks: 0, loops: 0, crossings: 0 };
  const road = (from: string, to: string, via: Polar[]): void => {
    roads.push({ from, to, via: via.map(tidy) });
  };

  // Wall entries, one per wall stretch.
  for (const a of G.wallAngles) nodes.push({ id: `w${a}`, kind: 'wall', at: [G.wallRadius, wrapDeg(a)] });

  // Camps: their directions, distances and sizes.
  const campAngles = campDirections(rng, s);
  const [near, far] = s.campDistance;
  const camps = campAngles.map((a, i) => {
    const at = tidy([Math.round(rng.range(near, far)), a]);
    const size = Math.round(Math.min(40, Math.max(18, s.campSize + rng.range(-3, 3))));
    // Each camp's road turns around the castle by up to maxTurnDeg at full wiggle before it reaches its junction.
    const turn = (rng.next() < 0.5 ? -1 : 1) * s.wiggle * G.maxTurnDeg * rng.range(0.35, 1);
    return { id: `camp${i + 1}`, at, size, target: wrapDeg(a + turn) };
  });

  // The outer ring of junctions, where the camp roads come in.
  const outer = placeJunctions(rng, s.junctions, camps.map((c) => c.target));
  const junctions: Junction[] = outer.angles.map((a, i) => ({
    id: `j${i + 1}`,
    at: tidy([rng.range(G.outerRadius[0], G.outerRadius[1]), a]),
    inner: `k${i + 1}`,
  }));
  stats.outer = junctions.length;
  for (const j of junctions) nodes.push({ id: j.id, kind: 'junction', at: j.at });

  // Each outer junction has an inner one near the wall, and the inner one reaches one or two wall entries.
  for (const j of junctions) {
    const at = tidy([rng.range(G.innerRadius[0], G.innerRadius[1]), j.at[1] + rng.range(-8, 8)]);
    nodes.push({ id: j.inner, kind: 'junction', at });
    stats.inner++;
    road(j.id, j.inner, windingPath(rng, j.at, at, s.wiggle * 0.5));
    const walls = [...G.wallAngles].sort((p, q) => Math.abs(turnDeg(at[1], p)) - Math.abs(turnDeg(at[1], q)));
    const toWall = (w: number): void => {
      const mid = at[1] + turnDeg(at[1], w) / 2;
      road(j.inner, `w${w}`, [[(at[0] + G.wallRadius) / 2 + 2, mid]]);
    };
    toWall(walls[0]);
    if (rng.next() < 0.5 && Math.abs(turnDeg(at[1], walls[1])) < 50) toWall(walls[1]);
  }

  // Camp roads, some split in two on the way (a short way and a long, winding way).
  const forkCamps = new Set(shuffle(rng, camps.map((_, i) => i)).slice(0, junctions.length > 1 ? s.forks : 0));
  const sorted = junctions.map((j, i) => i).sort((p, q) => junctions[p].at[1] - junctions[q].at[1]);
  const neighbor = (ji: number, dir: 1 | -1): number => sorted[(sorted.indexOf(ji) + dir + sorted.length) % sorted.length];
  camps.forEach((camp, i) => {
    nodes.push({ id: camp.id, kind: 'camp', at: camp.at, size: camp.size });
    const ji = outer.campJunction[i];
    const j = junctions[ji];
    const path = [camp.at, ...windingPath(rng, camp.at, j.at, s.wiggle), j.at];
    if (!forkCamps.has(i)) {
      road(camp.id, j.id, path.slice(1, -1));
      return;
    }
    const { at, next } = pointAlong(path, G.forkAt);
    const fork = `f${i + 1}`;
    nodes.push({ id: fork, kind: 'junction', at: tidy(at) });
    road(camp.id, fork, path.slice(1, next));
    road(fork, j.id, path.slice(next, -1));
    const other = junctions[neighbor(ji, rng.next() < 0.5 ? 1 : -1)];
    road(fork, other.id, windingPath(rng, at, other.at, Math.min(1, s.wiggle + 0.4), G.forkBulge));
    stats.forks++;
  });

  // Ring roads between neighboring junctions: every extra junction (no camp comes to it) is joined to the next
  // one, so it is on some way in; then `loops` more.
  const ringed = new Set<string>();
  const ring = (a: number, b: number): void => {
    const key = [a, b].sort().join('-');
    if (a === b || ringed.has(key)) return;
    ringed.add(key);
    road(junctions[a].id, junctions[b].id, windingPath(rng, junctions[a].at, junctions[b].at, s.wiggle * 0.6, G.ringBulge));
    stats.loops++;
  };
  if (junctions.length > 1) {
    for (const ji of outer.extras) ring(ji, neighbor(ji, 1));
    const pairs = shuffle(rng, sorted.map((ji) => [ji, neighbor(ji, 1)] as [number, number]));
    let added = 0;
    for (const [a, b] of pairs) {
      if (added >= s.loops) break;
      const key = [a, b].sort().join('-');
      if (ringed.has(key)) continue;
      ring(a, b);
      added++;
    }
    // Crossings: a side road from a junction to the next one's inner junction.
    for (const [a, b] of shuffle(rng, pairs).slice(0, s.crossings)) {
      const [from, to] = rng.next() < 0.5 ? [a, b] : [b, a];
      const inner = nodes.find((n) => n.id === junctions[to].inner)!;
      road(junctions[from].id, inner.id, windingPath(rng, junctions[from].at, inner.at, s.wiggle * 0.5));
      stats.crossings++;
    }
  }

  // Triggers along each camp road, between triggerFrom and triggerTo of its way in (from the castle end).
  const kinds = TRIGGER_LIST.filter((k) => s[TRIGGER_KINDS[k].setting]);
  const triggers: BlueprintTrigger[] = [];
  if (kinds.length > 0 && s.triggersPerRoad > 0) {
    camps.forEach((camp, i) => {
      const j = junctions[outer.campJunction[i]];
      const line = campLine(roads, camp.id, j.id, nodes);
      for (let t = 0; t < s.triggersPerRoad; t++) {
        const share = G.triggerFrom + ((t + rng.range(0.25, 0.75)) / s.triggersPerRoad) * (G.triggerTo - G.triggerFrom);
        // Measured from the castle end: share 0 is the junction.
        const at = tidy(pointAlong(line, 1 - share).at);
        if (triggers.some((tr) => distance(tr.at, at) < G.triggerGap)) continue;
        triggers.push({ kind: rng.pick(kinds) as TriggerKind, wave: 1, at });
      }
    });
  }

  // Rising camps: some are there from the start, the rest rise as waves 2 to 4 start.
  const start = Math.max(1, Math.round(camps.length * G.startCamps[s.difficulty]));
  const rest = camps.length - start;
  camps.forEach((camp, i) => {
    const node = nodes.find((n) => n.id === camp.id)!;
    node.wave = i < start ? 1 : Math.min(G.waves, 2 + Math.floor(((i - start) * (G.waves - 1)) / Math.max(1, rest)));
  });

  const map: Blueprint = { name, seed, nodes, roads, gate: { at: G.gate }, triggers };
  return { map, stats };
}

/** The camp directions for the camp places setting (degrees). */
function campDirections(rng: Random, s: LevelSettings): number[] {
  const n = s.camps;
  const center = rng.range(-180, 180);
  if (s.campSpread === 'oneSide') {
    const arc = Math.min(G.oneSideArc, G.campGapDeg * 1.3 * (n - 1));
    return Array.from({ length: n }, (_, i) => wrapDeg(center + (n === 1 ? 0 : -arc / 2 + (i * arc) / (n - 1)) + rng.range(-5, 5)));
  }
  if (s.campSpread === 'opposite') {
    // Alternate sides (camp 1 on one, camp 2 on the other...), so a camp rising later comes from behind.
    const sides = [Math.ceil(n / 2), Math.floor(n / 2)];
    return Array.from({ length: n }, (_, i) => {
      const side = i % 2;
      const k = Math.floor(i / 2);
      const spread = (k - (sides[side] - 1) / 2) * G.campGapDeg * 1.2;
      return wrapDeg(center + side * 180 + spread + rng.range(-8, 8));
    });
  }
  const step = 360 / n;
  return Array.from({ length: n }, (_, i) => wrapDeg(center + i * step + rng.range(-0.25, 0.25) * step));
}

/**
 * The outer junction angles: when there are fewer junctions than camps,
 * neighboring camps share one; with more, one per camp and the extras in the
 * widest gaps. Kept at least junctionGapDeg apart.
 */
function placeJunctions(rng: Random, count: number, targets: number[]): { angles: number[]; campJunction: number[]; extras: number[] } {
  const order = targets.map((_, i) => i).sort((a, b) => targets[a] - targets[b]);
  const campJunction = new Array<number>(targets.length).fill(0);
  const angles: number[] = [];
  const groups = Math.min(count, targets.length);
  // Split the camps (in angle order, from a random start) into `groups` runs that share a junction.
  const shift = rng.int(order.length);
  const ring = order.map((_, k) => order[(k + shift) % order.length]);
  for (let g = 0; g < groups; g++) {
    const from = Math.floor((g * ring.length) / groups);
    const to = Math.floor(((g + 1) * ring.length) / groups);
    const members = ring.slice(from, to);
    for (const m of members) campJunction[m] = angles.length;
    angles.push(meanDeg(members.map((m) => targets[m])));
  }
  const extras: number[] = [];
  while (angles.length < count) {
    // The widest gap between the junctions so far gets the next one, in its middle.
    const s = [...angles].sort((a, b) => a - b);
    let best = 0;
    let gap = -1;
    for (let i = 0; i < s.length; i++) {
      const g = i === s.length - 1 ? s[0] + 360 - s[i] : s[i + 1] - s[i];
      if (g > gap) {
        gap = g;
        best = i;
      }
    }
    extras.push(angles.length);
    angles.push(wrapDeg(s[best] + (s.length === 1 ? 180 : gap / 2) + rng.range(-6, 6)));
  }
  // Push neighbors apart until every gap is at least the junction gap (a few rounds is plenty).
  const want = Math.max(G.junctionGapDeg.least, Math.min(G.junctionGapDeg.most, 300 / angles.length));
  for (let round = 0; round < 30 && angles.length > 1; round++) {
    const idx = angles.map((_, i) => i).sort((a, b) => angles[a] - angles[b]);
    let moved = false;
    for (let k = 0; k < idx.length; k++) {
      const a = idx[k];
      const b = idx[(k + 1) % idx.length];
      const gap = k === idx.length - 1 ? angles[b] + 360 - angles[a] : angles[b] - angles[a];
      if (gap >= want) continue;
      const push = (want - gap) / 2 + 0.5;
      angles[a] = wrapDeg(angles[a] - push);
      angles[b] = wrapDeg(angles[b] + push);
      moved = true;
    }
    if (!moved) break;
  }
  return { angles, campJunction, extras };
}

/**
 * In-between points from one spot to another: the distance and the angle
 * change together (a spiral when the road turns around the castle), with a
 * sideways sway that grows with `wiggle` and fades at both ends. `bulge`
 * pushes the middle outward (cm), for the long branch of a fork and ring
 * roads.
 */
function windingPath(rng: Random, from: Polar, to: Polar, wiggle: number, bulge = 0): Polar[] {
  const [r0, a0] = from;
  const [r1] = to;
  const d = turnDeg(a0, to[1]);
  const length = Math.abs(r0 - r1) + ((r0 + r1) / 2) * Math.abs(degToRad(d));
  const k = Math.max(1, Math.round(length / G.viaEvery));
  const bends = 1 + rng.int(2);
  const phase = rng.next() < 0.5 ? 0 : Math.PI;
  const amp = wiggle * G.swayCm * rng.range(0.6, 1);
  const out: Polar[] = [];
  for (let i = 1; i <= k; i++) {
    const t = i / (k + 1);
    const fade = Math.sin(Math.PI * t);
    const r = r0 + (r1 - r0) * t + bulge * fade;
    const sway = amp * Math.sin(Math.PI * t * bends + phase) * fade;
    out.push([r, a0 + d * t + sway / ((r * Math.PI) / 180)]);
  }
  return out;
}

/** A camp's whole road to its junction as one line (through its fork, the short way). */
function campLine(roads: BlueprintRoad[], camp: string, junction: string, nodes: BlueprintNode[]): Polar[] {
  const at = (id: string): Polar => nodes.find((n) => n.id === id)!.at;
  const first = roads.find((r) => r.from === camp)!;
  const line: Polar[] = [at(camp), ...first.via, at(first.to)];
  if (first.to === junction) return line;
  const rest = roads.find((r) => r.from === first.to && r.to === junction);
  return rest ? [...line, ...rest.via, at(junction)] : line;
}

function shuffle<T>(rng: Random, items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Waves and rules

/** Most goblins one wave may send, so its estimate on the board at once stays in the unit budget. */
export const maxWaveGoblins = (balloons: number): number => Math.floor((G.unitBudget - balloons * BALLOONS.riders) / G.atOnceShare);

function planWaves(rng: Random, s: LevelSettings, map: Blueprint): LevelWave[] {
  const D = DIFFICULTY[s.difficulty];
  const camps = map.nodes.filter((n) => n.kind === 'camp');
  // Spears and swords share the grunts' hands: scaled down together if they ask for more than all of them.
  const hands = Math.max(1, s.spears + s.swords);
  const gear = { spearShare: s.spears / hands, swordShare: s.swords / hands, helmetShare: s.helmets, shieldShare: s.shields };
  const waves: LevelWave[] = [];
  for (let w = 1; w <= G.waves; w++) {
    const up = camps.filter((c) => (c.wave ?? 1) <= w).map((c) => c.id);
    const rising = w === 1 ? [] : camps.filter((c) => c.wave === w).map((c) => c.id);
    // A camp that just rose always sends; the others in a seeded order, up to campsAtOnce.
    const others = shuffle(
      rng,
      up.filter((id) => !rising.includes(id)),
    );
    const sending = [...rising, ...others].slice(0, Math.max(rising.length, Math.min(s.campsAtOnce, up.length)));
    const balloons = w === 1 ? 0 : s.balloons;
    const total = Math.min(maxWaveGoblins(balloons), Math.round(s.goblins * Math.pow(1 + s.growth, w - 1) * D.goblins));
    const runner = Math.round(total * s.runners);
    waves.push({
      camps: sending,
      rising,
      counts: { grunt: total - runner, runner },
      spawnTime: Math.round(s.waveLength * D.waveLength),
      balloons,
      gear,
    });
  }
  return waves;
}

function planRules(s: LevelSettings): LevelRules {
  return { archers: s.archers, guards: s.guards, refillEvery: s.refill, guardRefillEvery: s.refill * 2, startHealth: s.castleHealth };
}

// ---------------------------------------------------------------------------
// The summary (printed by the command line, a debug note in the game)

export function summarize(g: Generated): string {
  const { level, stats } = g;
  const m = level.map;
  const camps = m.nodes.filter((n) => n.kind === 'camp');
  const length = m.roads.reduce((sum, r) => {
    const at = (id: string): Polar => m.nodes.find((n) => n.id === id)!.at;
    return sum + lineLength([at(r.from), ...r.via, at(r.to)]);
  }, 0);
  const byKind = TRIGGER_LIST.map((k) => `${m.triggers.filter((t) => t.kind === k).length} ${k}`).join(', ');
  const lines = [
    `seed ${level.meta.seed}${level.meta.seed !== level.meta.askedSeed ? ` (asked ${level.meta.askedSeed}, ${g.tries} tries)` : ''}, generator ${level.meta.generator}, ${level.meta.settings.difficulty} (${level.meta.skulls} skulls)`,
    `camps ${camps.length}: ${camps.map((c) => `${c.id} ${Math.round(c.at[0])} cm ${Math.round(c.at[1])} deg, wave ${c.wave}`).join('; ')}`,
    `junctions ${stats.outer} outer + ${stats.inner} inner + ${stats.forks} forks; roads ${m.roads.length}, ${Math.round(length)} cm; ring roads ${stats.loops}, crossings ${stats.crossings}`,
    `triggers ${m.triggers.length}: ${byKind}`,
    ...level.waves.map(
      (w, i) =>
        `wave ${i + 1}: ${w.counts.grunt + w.counts.runner} goblins (${w.counts.grunt} grunts, ${w.counts.runner} runners), ${w.balloons} balloons, over ${w.spawnTime} s, from ${w.camps.join(', ')}${w.rising.length ? `; rises: ${w.rising.join(', ')}` : ''}`,
    ),
    `rules: ${level.rules.archers} archers, ${level.rules.guards} guards, help every ${level.rules.refillEvery} s, castle ${Math.round(level.rules.startHealth * 100)}%`,
  ];
  return lines.join('\n');
}
