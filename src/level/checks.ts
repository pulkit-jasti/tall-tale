// The checks every generated level passes (docs/custom-mode.md section 5),
// so the generator never hands out an unplayable level: it tries the next
// seed when one fails. Each failed check is one short line (the command line
// prints them). No Three.js here.
import { BALLOONS, LEVEL_GEN } from '../config/game.js';
import type { LevelSettings } from '../config/levelSettings.js';
import { TRIGGER_KINDS, TRIGGER_LIST } from '../config/registries.js';
import { parseBlueprint, type Polar } from '../rules/blueprint.js';
import { RoadGraph } from '../rules/roadGraph.js';
import { legsToWall } from '../rules/roadRoute.js';
import { distance, lineDistance, lineLength, pointAlong } from './geometry.js';
import type { Level } from './level.js';

const G = LEVEL_GEN;
/** How often a road is sampled for the overlap check (cm). */
const SAMPLE_STEP = 6;

/** Spots every SAMPLE_STEP cm along a line, leaving out `ends` cm at each end. */
function sampleLine(line: Polar[], ends: number): Polar[] {
  const total = lineLength(line);
  const out: Polar[] = [];
  for (let d = ends; d <= total - ends; d += SAMPLE_STEP) out.push(pointAlong(line, d / total).at);
  return out;
}

/** Every problem found (empty: the level is good). */
export function checkLevel(level: Level, settings: LevelSettings): string[] {
  const problems: string[] = [];
  const fail = (why: string): void => {
    problems.push(why);
  };
  let map;
  try {
    map = parseBlueprint(level.map);
  } catch (error) {
    return [(error as Error).message];
  }
  const graph = new RoadGraph(map);
  const lines: Polar[][] = graph.roads.map((r) => r.points);

  // Every road reaches the wall, every camp reaches the castle (all distances to the castle are known).
  for (const node of graph.nodes) if (node.toCastle === Infinity) fail(`${node.id} cannot reach the castle`);

  // Every junction is on some way in: reached from a camp along the roads.
  const seen = new Set<number>(graph.camps);
  const todo = [...graph.camps];
  while (todo.length) {
    const n = todo.pop()!;
    for (const r of graph.nodes[n].roads) {
      const o = graph.other(r, n);
      if (!seen.has(o)) {
        seen.add(o);
        todo.push(o);
      }
    }
  }
  graph.nodes.forEach((node, i) => {
    if (node.kind === 'junction' && !seen.has(i)) fail(`junction ${node.id} is on no way in`);
  });

  // Roads stay out of the castle and on the board.
  graph.roads.forEach((r, i) => {
    for (const [k, p] of r.points.entries()) {
      const end = k === 0 || k === r.points.length - 1;
      if ((!end && p[0] < G.minRoadRadius) || p[0] > G.maxRoadRadius) fail(`road ${i} goes off the board or into the castle`);
    }
  });

  // Camps keep apart, and nothing but triggers sits on a road: no other road runs over a camp's hill.
  const camps = graph.camps.map((i) => graph.nodes[i]);
  for (let a = 0; a < camps.length; a++) {
    for (let b = a + 1; b < camps.length; b++) {
      if (distance(camps[a].at, camps[b].at) < G.campGap) fail(`${camps[a].id} and ${camps[b].id} are too close`);
    }
    if (camps[a].at[0] - camps[a].size / 2 < G.innerRadius[1]) fail(`${camps[a].id} is too close to the castle`);
    const own = new Set(camps[a].roads);
    lines.forEach((line, r) => {
      if (own.has(r)) return;
      if (lineDistance(camps[a].at, line) < camps[a].size / 2 + G.campRoadClear) fail(`road ${r} runs over ${camps[a].id}`);
    });
  }

  // No two roads run on top of each other (away from the points they share): a tangle reads as one road.
  const samples = lines.map((line) => sampleLine(line, G.overlapEnds));
  for (let a = 0; a < lines.length; a++) {
    for (let b = 0; b < lines.length; b++) {
      if (a === b) continue;
      let close = 0;
      for (const p of samples[a]) if (lineDistance(p, lines[b]) < G.overlapNear) close += SAMPLE_STEP;
      if (close > G.overlapMax) {
        fail(`roads ${a} and ${b} run on top of each other`);
        break;
      }
    }
  }

  // Each camp's way in passes at least one trigger (when the level has triggers).
  const wantTriggers = settings.triggersPerRoad > 0 && TRIGGER_LIST.some((k) => settings[TRIGGER_KINDS[k].setting]);
  if (wantTriggers) {
    for (const ci of graph.camps) {
      const route = graph.routeToWall(ci).map((step) => lines[step.road]);
      const passes = map.triggers.some((t) => route.some((line) => lineDistance(t.at, line) <= G.triggerNear));
      if (!passes) fail(`${graph.nodes[ci].id}'s way in passes no trigger`);
    }
  }

  // The knights' route finding (the horn) reaches the castle from the first junction of every camp road.
  const lengths = graph.roads.map((r) => r.length);
  for (const ci of graph.camps) {
    for (const r of graph.nodes[ci].roads) {
      const along = graph.roads[r].from === ci ? lengths[r] : 0;
      if (!legsToWall(graph, lengths, { road: r, along })) fail(`the knights cannot route from ${graph.nodes[ci].id}'s road`);
    }
  }

  // The goblins expected at once stay in the unit budget (docs/performance.md).
  level.waves.forEach((w, i) => {
    const atOnce = (w.counts.grunt + w.counts.runner) * G.atOnceShare + w.balloons * BALLOONS.riders;
    if (atOnce > G.unitBudget + 1e-6) fail(`wave ${i + 1} may put ${Math.round(atOnce)} goblins on the board (budget ${G.unitBudget})`);
    if (w.camps.length === 0) fail(`wave ${i + 1} has no camp to send from`);
  });
  return problems;
}
