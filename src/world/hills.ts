// Low-poly hills and mountains around the board, so the horizon is not just
// a line (decor only, no gameplay). Made to the board's scale: they live in
// boardLift (cm), so they rise and size with the board and stay right beside
// it, but never turn (comfort rule). Rings from near to far:
//   light green rolling hills, darker green hills, dark green peaks, and
//   brown mountains as the last ring.
// The scene fog hazes them more the farther they are, so the last mountains
// fade into the sky.
// Each one is a closed, faceted shape (no holes, a bottom cap), built as one
// indexed mesh so neighbouring faces share their points and nothing can
// open up between them. Each ring is one InstancedMesh: five draw calls
// with the ground.
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  Object3D,
  Quaternion,
  Vector3,
} from 'three';
import { BOARD, HILLS, type HillLayer } from '../config/game.js';
import { boardHeight } from '../rules/boardMath.js';
import type { Random } from '../rules/random.js';

const matrix = new Matrix4();
const position = new Vector3();
const scale = new Vector3();
const turn = new Quaternion();
const UP = new Vector3(0, 1, 0);
const color = new Color();

/** Height of the ground past the board's edge (cm above the board), so hills and clouds sit on it. */
export function groundHeight(r: number): number {
  if (r <= BOARD.outerRadius) return boardHeight(r);
  const share = Math.min(1, (r - HILLS.groundFrom) / (HILLS.groundTo - HILLS.groundFrom));
  return boardHeight(BOARD.outerRadius) + HILLS.groundRise * share;
}

/**
 * One closed hill or mountain (radius 1 at the base, height 1): rings of
 * points narrowing to the top, each point nudged a little, with a flat
 * bottom cap. Round hills end in a small flat top, peaks in one point. The
 * base is a little darker than the top (vertex colors).
 */
function hillGeometry(rng: Random, peaked: boolean): BufferGeometry {
  const sides = peaked ? 7 : 9;
  // Ring heights and radii, base first.
  const rings: [number, number][] = peaked
    ? [
        [0, 1],
        [0.3, 0.72],
        [0.62, 0.4],
      ]
    : [
        [0, 1],
        [0.38, 0.86],
        [0.75, 0.55],
        [0.95, 0.22],
      ];
  const positions: number[] = [];
  const colors: number[] = [];
  const shade = (y: number): number => 0.72 + 0.28 * y;
  for (let k = 0; k < rings.length; k++) {
    const [y, r] = rings[k];
    for (let i = 0; i < sides; i++) {
      // The base stays round, so the hill meets the ground cleanly. Higher points wander.
      const wander = k === 0 ? 0 : 0.18;
      const a = ((i + rng.range(-wander, wander)) / sides) * Math.PI * 2;
      const rr = r * (k === 0 ? 1 : rng.range(0.82, 1.12));
      const yy = Math.min(0.98, y * (k === 0 ? 1 : rng.range(0.9, 1.1)));
      positions.push(Math.cos(a) * rr, yy, Math.sin(a) * rr);
      const s = shade(yy);
      colors.push(s, s, s);
    }
  }
  // The top point, a little off center, and the middle of the bottom cap.
  const top = positions.length / 3;
  positions.push(rng.range(-0.08, 0.08), 1, rng.range(-0.08, 0.08));
  colors.push(1, 1, 1);
  const bottom = top + 1;
  positions.push(0, 0, 0);
  colors.push(shade(0), shade(0), shade(0));
  const indices: number[] = [];
  for (let k = 0; k < rings.length - 1; k++) {
    for (let i = 0; i < sides; i++) {
      const a = k * sides + i;
      const b = k * sides + ((i + 1) % sides);
      const c = (k + 1) * sides + i;
      const d = (k + 1) * sides + ((i + 1) % sides);
      // Faces point outward (counter clockwise seen from outside).
      indices.push(a, c, b, b, c, d);
    }
  }
  const last = (rings.length - 1) * sides;
  for (let i = 0; i < sides; i++) {
    indices.push(last + i, top, last + ((i + 1) % sides));
    // The bottom cap, facing down.
    indices.push(i, (i + 1) % sides, bottom);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** The ground under the hills: a ring from the board's edge out, rising a little, lighter near and darker far (cm). */
function groundRing(): Mesh {
  const segments = 72;
  const radii = [HILLS.groundFrom, 900, 1400, 2000, HILLS.groundTo];
  const near = new Color(HILLS.groundNearColor);
  const far = new Color(HILLS.groundFarColor);
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  radii.forEach((r, k) => {
    color.copy(near).lerp(far, k / (radii.length - 1));
    const y = r === HILLS.groundFrom ? boardHeight(r) - 1 : groundHeight(r);
    for (let j = 0; j < segments; j++) {
      const a = (j / segments) * Math.PI * 2;
      positions.push(Math.sin(a) * r, y, -Math.cos(a) * r);
      colors.push(color.r, color.g, color.b);
    }
  });
  for (let k = 0; k < radii.length - 1; k++) {
    for (let j = 0; j < segments; j++) {
      const a = k * segments + j;
      const b = k * segments + ((j + 1) % segments);
      const c = (k + 1) * segments + j;
      const d = (k + 1) * segments + ((j + 1) % segments);
      // Facing up (the first ground ring faced down, so it could be seen through from above).
      indices.push(a, b, c, b, d, c);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return new Mesh(geometry, new MeshLambertMaterial({ vertexColors: true }));
}

export class Hills {
  constructor(boardLift: Object3D, rng: Random) {
    boardLift.add(groundRing());
    for (const layer of HILLS.layers) boardLift.add(this.layer(layer, rng));
  }

  /** One ring of hills: spread evenly around with a random shift, so there are no big gaps. */
  private layer(layer: HillLayer, rng: Random): InstancedMesh {
    const material = new MeshLambertMaterial({ vertexColors: true, flatShading: true });
    const mesh = new InstancedMesh(hillGeometry(rng, layer.peaked), material, layer.count);
    const offset = rng.range(0, 1);
    for (let i = 0; i < layer.count; i++) {
      const a = ((i + offset + rng.range(-0.35, 0.35)) / layer.count) * Math.PI * 2;
      const r = rng.range(layer.from, layer.to);
      const width = rng.range(...layer.width);
      const height = rng.range(...layer.height);
      // Sunk a little, so the base never floats on the sloping ground.
      position.set(Math.sin(a) * r, groundHeight(r) - height * 0.06, -Math.cos(a) * r);
      turn.setFromAxisAngle(UP, rng.range(0, Math.PI * 2));
      scale.set(width / 2, height, (width / 2) * rng.range(0.75, 1));
      mesh.setMatrixAt(i, matrix.compose(position, turn, scale));
      color.setHex(rng.pick(layer.colors)).multiplyScalar(rng.range(0.94, 1.04));
      mesh.setColorAt(i, color);
    }
    return mesh;
  }
}
