// Compass letters on the ring handle (HANDLES.compass): N, NE, E, SE, S, SW,
// W, NW, raised in blocky gold like the ring's bands, set into the ring's
// inner face where it turns up toward the eyes. The four main ones are
// bigger, like a real compass. Low poly: each letter is built from small
// blocks on a 5 row grid, all in one instanced mesh with the bands' material,
// so they light up with the ring. They live in the ring's group, which turns
// with the board, so N always points at the north of the map (the north camp).
import { BoxGeometry, InstancedMesh, Matrix4, Object3D, type MeshStandardMaterial } from 'three';
import { HANDLES } from '../config/game.js';
import { degToRad, polarX, polarZ } from '../rules/boardMath.js';

/** Block letters, 5 rows from the top, '#' = a block. */
const GLYPHS: Record<string, string[]> = {
  N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
  E: ['###', '#..', '##.', '#..', '###'],
  S: ['###', '#..', '###', '..#', '###'],
  W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'],
};

const LABELS: { text: string; deg: number }[] = [
  { text: 'N', deg: 0 },
  { text: 'NE', deg: 45 },
  { text: 'E', deg: 90 },
  { text: 'SE', deg: 135 },
  { text: 'S', deg: 180 },
  { text: 'SW', deg: 225 },
  { text: 'W', deg: 270 },
  { text: 'NW', deg: 315 },
];

const ROWS = 5;

function blockCount(): number {
  let n = 0;
  for (const { text } of LABELS) for (const ch of text) for (const row of GLYPHS[ch]) for (const c of row) if (c === '#') n++;
  return n;
}

/** The eight labels, in the ring's own space (boardLift cm, before the ring turns). */
export function compassLetters(material: MeshStandardMaterial): InstancedMesh {
  const { radius, ringY, ringRadius } = HANDLES;
  const { cell: bigCell, minorScale, depth, faceDeg } = HANDLES.compass;
  const mesh = new InstancedMesh(new BoxGeometry(1, 1, 1), material, blockCount());
  const face = degToRad(faceDeg);
  // On the tube's surface where it faces the player and turns up toward the eyes.
  const r = radius - ringRadius * Math.cos(face);
  const y = ringY + ringRadius * Math.sin(face);
  const holder = new Object3D();
  const block = new Matrix4();
  let i = 0;
  for (const { text, deg } of LABELS) {
    const cell = text.length > 1 ? bigCell * minorScale : bigCell;
    const a = degToRad(deg);
    holder.position.set(polarX(r, a), y, polarZ(r, a));
    // Local +z toward the player (the middle), then tilted back to lie on the tube's face.
    holder.rotation.set(-face, -a, 0, 'YXZ');
    holder.updateMatrix();
    // Letters side by side with one empty column between them, centered.
    const widths = [...text].map((ch) => GLYPHS[ch][0].length);
    const total = widths.reduce((sum, w) => sum + w, 0) + widths.length - 1;
    let column = -total / 2;
    [...text].forEach((ch, n) => {
      GLYPHS[ch].forEach((row, rowIndex) => {
        for (let c = 0; c < row.length; c++) {
          if (row[c] !== '#') continue;
          const x = (column + c + 0.5) * cell;
          const yy = (ROWS / 2 - rowIndex - 0.5) * cell;
          // Half sunk into the tube, so the letters look set into it.
          block.makeScale(cell, cell, depth).setPosition(x, yy, 0);
          mesh.setMatrixAt(i++, block.premultiply(holder.matrix));
        }
      });
      column += widths[n] + 1;
    });
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}
