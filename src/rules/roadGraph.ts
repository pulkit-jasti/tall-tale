// Roads as a graph, like a subway map (docs/map.md sections 3 and 4).
// Points are camps, junctions and wall entries. Roads link two points and can
// be walked both ways. Each point knows its distance to the castle along the
// open roads, recalculated only when a road opens or closes. No Three.js here.
import { ROUTES } from '../config/game.js';
import { degToRad, polarX, polarZ } from './boardMath.js';
import type { Blueprint, NodeKind, Polar } from './blueprint.js';
import type { Random } from './random.js';

export interface GraphNode {
  id: string;
  kind: NodeKind;
  at: Polar;
  size: number;
  /** Road indices touching this point. */
  roads: number[];
  /** Distance to the nearest wall entry along open roads (cm). Infinity if cut off. */
  toCastle: number;
}

export interface GraphRoad {
  /** Node indices. */
  from: number;
  to: number;
  /** All points from `from` to `to`, ends included. */
  points: Polar[];
  /** Flat length of the straight segments (cm), close to the curve length. */
  length: number;
  open: boolean;
}

/** The next road for a goblin: which road and which way to walk it. */
export interface Step {
  road: number;
  /** 1 walks from `from` to `to`, -1 the other way. */
  dir: 1 | -1;
}

export class RoadGraph {
  readonly nodes: GraphNode[];
  readonly roads: GraphRoad[];
  private index = new Map<string, number>();

  constructor(blueprint: Blueprint) {
    this.nodes = blueprint.nodes.map((n, i) => {
      this.index.set(n.id, i);
      return { id: n.id, kind: n.kind, at: n.at, size: n.size ?? 0, roads: [], toCastle: Infinity };
    });
    this.roads = blueprint.roads.map((r, i) => {
      const from = this.index.get(r.from)!;
      const to = this.index.get(r.to)!;
      const points: Polar[] = [this.nodes[from].at, ...r.via, this.nodes[to].at];
      this.nodes[from].roads.push(i);
      this.nodes[to].roads.push(i);
      return { from, to, points, length: polylineLength(points), open: true };
    });
    this.recalculate();
  }

  nodeIndex(id: string): number {
    const i = this.index.get(id);
    if (i === undefined) throw new Error(`[roads] unknown point ${id}`);
    return i;
  }

  /** Camp node indices, in blueprint order. */
  get camps(): number[] {
    return this.nodes.flatMap((n, i) => (n.kind === 'camp' ? [i] : []));
  }

  isWall(node: number): boolean {
    return this.nodes[node].kind === 'wall';
  }

  /** The node at the far end of a road, seen from `node`. */
  other(road: number, node: number): number {
    const r = this.roads[road];
    return r.from === node ? r.to : r.from;
  }

  /** The node a goblin walking a road reaches at its end. */
  endOf(step: Step): number {
    const r = this.roads[step.road];
    return step.dir === 1 ? r.to : r.from;
  }

  /** Opens or closes a road (a fallen tree, a broken bridge). Distances are recalculated. */
  setOpen(road: number, open: boolean): void {
    if (this.roads[road].open === open) return;
    this.roads[road].open = open;
    this.recalculate();
  }

  /**
   * Picks the next road at a point: weighted random among the open roads that
   * lead closer to the castle, shorter routes a bit more likely. If none leads
   * closer (roads blocked), any open road toward the lowest distance. Null if
   * no road is open at all.
   */
  next(node: number, rng: Random): Step | null {
    const here = this.nodes[node].toCastle;
    let total = 0;
    const options: { road: number; weight: number }[] = [];
    for (const road of this.nodes[node].roads) {
      if (!this.roads[road].open) continue;
      const there = this.nodes[this.other(road, node)].toCastle;
      if (!(there < here)) continue;
      // How much longer this route is than the shortest one (cm).
      const extra = Math.max(0, this.roads[road].length + there - here);
      const weight = 1 / (1 + extra / ROUTES.detourScale);
      options.push({ road, weight });
      total += weight;
    }
    if (options.length === 0) {
      let best: number | null = null;
      for (const road of this.nodes[node].roads) {
        if (!this.roads[road].open) continue;
        const there = this.nodes[this.other(road, node)].toCastle;
        if (best === null || there < this.nodes[this.other(best, node)].toCastle) best = road;
      }
      return best === null ? null : this.stepFrom(best, node);
    }
    let pick = rng.next() * total;
    for (const option of options) {
      pick -= option.weight;
      if (pick <= 0) return this.stepFrom(option.road, node);
    }
    return this.stepFrom(options[options.length - 1].road, node);
  }

  /**
   * The shortest route from a point to the castle along open roads, as the
   * roads to walk in order (troops walk it backward, from the wall out to a
   * camp). Empty if the point is cut off or is a wall entry.
   */
  routeToWall(node: number): Step[] {
    const route: Step[] = [];
    let here = node;
    for (let guard = 0; guard < this.nodes.length && !this.isWall(here); guard++) {
      let best: number | null = null;
      let bestDistance = this.nodes[here].toCastle;
      for (const road of this.nodes[here].roads) {
        if (!this.roads[road].open) continue;
        const d = this.roads[road].length + this.nodes[this.other(road, here)].toCastle;
        if (d <= bestDistance + 1e-6) {
          bestDistance = d;
          best = road;
        }
      }
      if (best === null) return [];
      route.push(this.stepFrom(best, here));
      here = this.other(best, here);
    }
    return this.isWall(here) ? route : [];
  }

  private stepFrom(road: number, node: number): Step {
    return { road, dir: this.roads[road].from === node ? 1 : -1 };
  }

  /** Shortest distance from every point to a wall entry along open roads (simple Dijkstra, 10 to 30 points). */
  private recalculate(): void {
    const done = new Set<number>();
    for (const n of this.nodes) n.toCastle = n.kind === 'wall' ? 0 : Infinity;
    for (;;) {
      let current = -1;
      for (let i = 0; i < this.nodes.length; i++) {
        if (done.has(i) || this.nodes[i].toCastle === Infinity) continue;
        if (current < 0 || this.nodes[i].toCastle < this.nodes[current].toCastle) current = i;
      }
      if (current < 0) return;
      done.add(current);
      for (const road of this.nodes[current].roads) {
        if (!this.roads[road].open) continue;
        const other = this.other(road, current);
        const d = this.nodes[current].toCastle + this.roads[road].length;
        if (d < this.nodes[other].toCastle) this.nodes[other].toCastle = d;
      }
    }
  }
}

function polylineLength(points: Polar[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const [r0, d0] = points[i - 1];
    const [r1, d1] = points[i];
    const a0 = degToRad(d0);
    const a1 = degToRad(d1);
    length += Math.hypot(polarX(r1, a1) - polarX(r0, a0), polarZ(r1, a1) - polarZ(r0, a0));
  }
  return length;
}
