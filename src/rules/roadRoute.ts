// Routes over the road graph from any point on a road to any other point
// (the horn's aimed spot), or to the nearest wall entry (home). A simple
// Dijkstra over the 10 to 30 points of the map, so it costs nothing to run
// when the horn is aimed. Closed roads (a fallen tree) are left out, except
// the road the walk starts on. No Three.js here.
import type { RoadGraph } from './roadGraph.js';

/** A spot on a road: the graph road index and cm along it. */
export interface RoadPoint {
  road: number;
  along: number;
}

/** One stretch of a walk: along `road` from `from` cm to `to` cm (either way). */
export interface Leg {
  road: number;
  from: number;
  to: number;
}

interface RouteMap {
  dist: number[];
  /** The node each node was reached from, -2 when straight from the start point, -1 not reached. */
  prevNode: number[];
  prevRoad: number[];
}

/** The along value at a road's end that touches `node`. */
function endAlong(graph: RoadGraph, lengths: number[], road: number, node: number): number {
  return graph.roads[road].from === node ? 0 : lengths[road];
}

/** Shortest distances from a start point to every graph point (`lengths`: each road's length in cm). */
function routesFrom(graph: RoadGraph, lengths: number[], start: RoadPoint): RouteMap {
  const n = graph.nodes.length;
  const dist = new Array<number>(n).fill(Infinity);
  const prevNode = new Array<number>(n).fill(-1);
  const prevRoad = new Array<number>(n).fill(-1);
  const done = new Array<boolean>(n).fill(false);
  const s = graph.roads[start.road];
  dist[s.from] = start.along;
  dist[s.to] = Math.min(dist[s.to], lengths[start.road] - start.along);
  prevNode[s.from] = prevNode[s.to] = -2;
  prevRoad[s.from] = prevRoad[s.to] = start.road;
  for (let k = 0; k < n; k++) {
    let current = -1;
    for (let i = 0; i < n; i++) {
      if (!done[i] && dist[i] < Infinity && (current < 0 || dist[i] < dist[current])) current = i;
    }
    if (current < 0) break;
    done[current] = true;
    for (const road of graph.nodes[current].roads) {
      if (!graph.roads[road].open) continue;
      const other = graph.other(road, current);
      const d = dist[current] + lengths[road];
      if (d < dist[other]) {
        dist[other] = d;
        prevNode[other] = current;
        prevRoad[other] = road;
      }
    }
  }
  return { dist, prevNode, prevRoad };
}

/** The legs from the start point to a graph point, from a finished route map. */
function legsToNode(graph: RoadGraph, lengths: number[], start: RoadPoint, map: RouteMap, goal: number): Leg[] {
  const legs: Leg[] = [];
  let node = goal;
  for (let guard = 0; guard <= graph.nodes.length && map.prevNode[node] >= 0; guard++) {
    const road = map.prevRoad[node];
    const prev = map.prevNode[node];
    legs.unshift({ road, from: endAlong(graph, lengths, road, prev), to: endAlong(graph, lengths, road, node) });
    node = prev;
  }
  // The first stretch: along the start road to the first point.
  legs.unshift({ road: start.road, from: start.along, to: endAlong(graph, lengths, start.road, node) });
  return legs;
}

/** The shortest walk from one road point to another, or null if it cannot be reached. */
export function legsToPoint(graph: RoadGraph, lengths: number[], start: RoadPoint, goal: RoadPoint): Leg[] | null {
  if (start.road === goal.road) return [{ road: start.road, from: start.along, to: goal.along }];
  const map = routesFrom(graph, lengths, start);
  const g = graph.roads[goal.road];
  const viaFrom = map.dist[g.from] + goal.along;
  const viaTo = map.dist[g.to] + (lengths[goal.road] - goal.along);
  if (!Number.isFinite(viaFrom) && !Number.isFinite(viaTo)) return null;
  const node = viaFrom <= viaTo ? g.from : g.to;
  const legs = legsToNode(graph, lengths, start, map, node);
  legs.push({ road: goal.road, from: endAlong(graph, lengths, goal.road, node), to: goal.along });
  return legs;
}

/** The shortest walk from a road point to the nearest wall entry (home), or null if every way is cut. */
export function legsToWall(graph: RoadGraph, lengths: number[], start: RoadPoint): Leg[] | null {
  const map = routesFrom(graph, lengths, start);
  let best = -1;
  graph.nodes.forEach((node, i) => {
    if (node.kind === 'wall' && map.dist[i] < Infinity && (best < 0 || map.dist[i] < map.dist[best])) best = i;
  });
  return best < 0 ? null : legsToNode(graph, lengths, start, map, best);
}

/** The same walk the other way round. */
export function reverseLegs(legs: Leg[]): Leg[] {
  return legs
    .slice()
    .reverse()
    .map((l) => ({ road: l.road, from: l.to, to: l.from }));
}

/** Total length of a walk (cm). */
export function legsLength(legs: Leg[]): number {
  let total = 0;
  for (const l of legs) total += Math.abs(l.to - l.from);
  return total;
}
