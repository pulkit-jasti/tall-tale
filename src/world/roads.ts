// Roads as curves on the board, and the flat ribbons that draw them.
// RoadNetwork pairs the road graph (src/rules/roadGraph.ts) with one curve per road.
import {
  BufferGeometry,
  CatmullRomCurve3,
  Float32BufferAttribute,
  Mesh,
  Vector3,
} from 'three';
import { ROADS } from '../config/game.js';
import { boardHeight, degToRad, polarX, polarZ } from '../rules/boardMath.js';
import type { RoadGraph } from '../rules/roadGraph.js';
import { flatMaterial } from './shapes.js';

const up = new Vector3(0, 1, 0);
const tangent = new Vector3();
const side = new Vector3();

export class Road {
  readonly curve: CatmullRomCurve3;
  readonly length: number;

  /** Points are [distance cm, angle degrees], from the camp to the wall. */
  constructor(points: [number, number][]) {
    const vectors = points.map(([r, deg]) => {
      const a = degToRad(deg);
      return new Vector3(polarX(r, a), 0, polarZ(r, a));
    });
    this.curve = new CatmullRomCurve3(vectors, false, 'centripetal');
    this.curve.arcLengthDivisions = 120;
    this.length = this.curve.getLength();
  }

  /**
   * Point on the road at a distance along it (cm), moved sideways by
   * `offset` (cm), resting on the board.
   */
  pointAt(distance: number, offset: number, out: Vector3): Vector3 {
    const u = Math.min(1, Math.max(0, distance / this.length));
    this.curve.getPointAt(u, out);
    if (offset !== 0) {
      this.curve.getTangentAt(u, tangent);
      side.crossVectors(tangent, up).normalize();
      out.addScaledVector(side, offset);
    }
    out.y = boardHeight(Math.hypot(out.x, out.z));
    return out;
  }

  /** Direction of travel at a distance along the road. */
  directionAt(distance: number, out: Vector3): Vector3 {
    const u = Math.min(1, Math.max(0, distance / this.length));
    return this.curve.getTangentAt(u, out);
  }

  /** Flat sandy ribbon a little above the board. */
  buildMesh(): Mesh {
    const segments = Math.max(16, Math.ceil(this.length / 4));
    const positions: number[] = [];
    const indices: number[] = [];
    const center = new Vector3();
    const half = ROADS.width / 2;
    for (let i = 0; i <= segments; i++) {
      const u = i / segments;
      this.curve.getPointAt(u, center);
      this.curve.getTangentAt(u, tangent);
      side.crossVectors(tangent, up).normalize();
      for (const s of [-1, 1]) {
        const x = center.x + side.x * half * s;
        const z = center.z + side.z * half * s;
        positions.push(x, boardHeight(Math.hypot(x, z)) + ROADS.lift, z);
      }
      if (i < segments) {
        const a = i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const material = flatMaterial(ROADS.color);
    material.polygonOffset = true;
    material.polygonOffsetFactor = -2;
    material.polygonOffsetUnits = -2;
    return new Mesh(geometry, material);
  }

  /** Shortest distance from a board point to this road's center line (cm, flat). */
  distanceTo(x: number, z: number): number {
    let best = Infinity;
    const p = new Vector3();
    const steps = Math.ceil(this.length / 4);
    for (let i = 0; i <= steps; i++) {
      this.curve.getPointAt(i / steps, p);
      best = Math.min(best, Math.hypot(p.x - x, p.z - z));
    }
    return best;
  }
}

/** The road graph plus one curve per graph road (same index). */
export class RoadNetwork {
  readonly roads: Road[];

  constructor(readonly graph: RoadGraph) {
    this.roads = graph.roads.map((r) => new Road(r.points));
  }

  /** Board position of a graph point (cm, on the ground). */
  nodePosition(node: number, out: Vector3): Vector3 {
    const [r, deg] = this.graph.nodes[node].at;
    const a = degToRad(deg);
    return out.set(polarX(r, a), boardHeight(r), polarZ(r, a));
  }
}
