// Low-poly hills around the board, so the horizon is not just a line (decor
// only, no gameplay). Two layers:
//   - Foreground: small green hills on a grass ring just past the board's
//     edge. They live in boardLift (cm), so they rise and size with the
//     board and stay right beside it, but never turn (comfort rule).
//   - Background: big hazy blue green hills far away, in world space
//     (meters). Lighter the farther they are, like real distance haze.
// Each layer is one InstancedMesh of the same faceted mound, so all of it
// costs three draw calls (ring, near hills, far hills).
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
  SphereGeometry,
  Vector3,
} from 'three';
import { BOARD, HILLS } from '../config/game.js';
import { boardHeight } from '../rules/boardMath.js';
import type { Random } from '../rules/random.js';

const matrix = new Matrix4();
const position = new Vector3();
const scale = new Vector3();
const turn = new Quaternion();
const UP = new Vector3(0, 1, 0);
const color = new Color();

/**
 * One faceted mound: a low-poly half sphere (radius 1, base at y = 0) with
 * its points nudged a little, so hills do not look like perfect domes. The
 * base is a bit darker than the top. Flat faces come from flatShading.
 */
function moundGeometry(rng: Random): BufferGeometry {
  const geometry = new SphereGeometry(1, 9, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  const p = geometry.getAttribute('position') as BufferAttribute;
  // The same nudge for points that sit in the same place (the seam), so no cracks.
  const nudges = new Map<string, number>();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    if (y < 0.01) continue;
    const key = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
    let n = nudges.get(key);
    if (n === undefined) {
      n = rng.range(0.85, 1.12);
      nudges.set(key, n);
    }
    p.setXYZ(i, x * n, y * (0.9 + (n - 1) * 0.5), z * n);
  }
  const colors = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const shade = 0.78 + 0.22 * Math.min(1, p.getY(i));
    colors.set([shade, shade, shade], i * 3);
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** The grass ring the foreground hills stand on: from the board's edge out, rising a little (cm). */
function groundRing(): Mesh {
  const segments = 64;
  const inner = HILLS.ringFrom;
  const outer = HILLS.ringTo;
  const y0 = boardHeight(inner) - 1;
  const y1 = boardHeight(BOARD.outerRadius) + HILLS.ringRise;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let j = 0; j < segments; j++) {
    const a = (j / segments) * Math.PI * 2;
    positions.push(Math.sin(a) * inner, y0, -Math.cos(a) * inner);
    positions.push(Math.sin(a) * outer, y1, -Math.cos(a) * outer);
  }
  for (let j = 0; j < segments; j++) {
    const a = j * 2;
    const b = ((j + 1) % segments) * 2;
    indices.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return new Mesh(geometry, new MeshLambertMaterial({ color: HILLS.ringColor, flatShading: true }));
}

export class Hills {
  constructor(boardLift: Object3D, world: Object3D, rng: Random) {
    const mound = moundGeometry(rng);
    boardLift.add(groundRing());
    boardLift.add(this.nearHills(mound, rng));
    world.add(this.farHills(mound, rng));
  }

  /** Small green hills on the grass ring (cm, boardLift). They take the board's fog, like the board. */
  private nearHills(mound: BufferGeometry, rng: Random): InstancedMesh {
    const material = new MeshLambertMaterial({ vertexColors: true, flatShading: true });
    const mesh = new InstancedMesh(mound, material, HILLS.nearCount);
    for (let i = 0; i < HILLS.nearCount; i++) {
      // Spread evenly around, with a random shift, so there is no big gap.
      const a = ((i + rng.range(-0.4, 0.4)) / HILLS.nearCount) * Math.PI * 2;
      const r = rng.range(HILLS.nearFrom, HILLS.nearTo);
      const width = rng.range(...HILLS.nearWidth);
      const height = rng.range(...HILLS.nearHeight);
      const share = (r - HILLS.ringFrom) / (HILLS.ringTo - HILLS.ringFrom);
      const ground = boardHeight(HILLS.ringFrom) + (boardHeight(BOARD.outerRadius) + HILLS.ringRise - boardHeight(HILLS.ringFrom)) * share;
      position.set(Math.sin(a) * r, ground - 4, -Math.cos(a) * r);
      turn.setFromAxisAngle(UP, rng.range(0, Math.PI * 2));
      scale.set(width / 2, height, (width / 2) * rng.range(0.7, 1));
      mesh.setMatrixAt(i, matrix.compose(position, turn, scale));
      mesh.setColorAt(i, color.setHex(rng.pick(HILLS.nearColors)));
    }
    return mesh;
  }

  /** Big hazy hills far away (meters, world). No fog: their haze colors are picked by distance. */
  private farHills(mound: BufferGeometry, rng: Random): InstancedMesh {
    const material = new MeshLambertMaterial({ vertexColors: true, flatShading: true, fog: false });
    const mesh = new InstancedMesh(mound, material, HILLS.farCount);
    const near = new Color(HILLS.farNearColor);
    const far = new Color(HILLS.farFarColor);
    for (let i = 0; i < HILLS.farCount; i++) {
      const a = ((i + rng.range(-0.45, 0.45)) / HILLS.farCount) * Math.PI * 2;
      const r = rng.range(HILLS.farFrom, HILLS.farTo);
      const width = rng.range(...HILLS.farWidth);
      const height = rng.range(...HILLS.farHeight);
      position.set(Math.sin(a) * r, HILLS.farBase, -Math.cos(a) * r);
      turn.setFromAxisAngle(UP, rng.range(0, Math.PI * 2));
      scale.set(width / 2, height, (width / 2) * rng.range(0.7, 1));
      mesh.setMatrixAt(i, matrix.compose(position, turn, scale));
      const t = (r - HILLS.farFrom) / (HILLS.farTo - HILLS.farFrom);
      mesh.setColorAt(i, color.copy(near).lerp(far, t));
    }
    return mesh;
  }
}
