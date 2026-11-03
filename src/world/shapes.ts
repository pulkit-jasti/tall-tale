// Code-made placeholder shapes (docs/placeholder-shapes.md). Each shape lives
// in its own small function so a real model can replace it later.
import {
  CatmullRomCurve3,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Shape,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import { HANDLES } from '../config/game.js';
import { degToRad, polarX, polarZ } from '../rules/boardMath.js';

/** Flat shaded, matte material in the low-poly look. */
export function flatMaterial(color: number): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, roughness: 1, metalness: 0, flatShading: true });
}

const polar = (r: number, deg: number, y: number): Vector3 =>
  new Vector3(polarX(r, degToRad(deg)), y, polarZ(r, degToRad(deg)));

/** Arc through angles a0..a1 (degrees) at radius r and height y (cm). */
function arc(r: number, a0: number, a1: number, y: number): CatmullRomCurve3 {
  const points: Vector3[] = [];
  for (let i = 0; i <= 16; i++) points.push(polar(r, a0 + ((a1 - a0) * i) / 16, y));
  return new CatmullRomCurve3(points);
}

/** Rotate handle track: a curved rail along the inner rim. */
export function rotateTrack(): Mesh {
  const { radius, rotateAngleDeg: a, rotateSpanDeg: s } = HANDLES;
  return new Mesh(
    new TubeGeometry(arc(radius, a - s, a + s, 1), 24, 0.6, 6),
    flatMaterial(HANDLES.trackColor),
  );
}

/** Rotate handle knob: a big ball on a short post. Origin at the track. */
export function rotateKnob(material: MeshStandardMaterial): Group {
  const group = new Group();
  const post = new Mesh(new CylinderGeometry(0.8, 0.8, HANDLES.knobPostHeight, 8), material);
  post.position.y = HANDLES.knobPostHeight / 2 + 1;
  const knob = new Mesh(new SphereGeometry(HANDLES.knobRadius, 12, 8), material);
  knob.position.y = HANDLES.knobPostHeight + 1 + HANDLES.knobRadius * 0.6;
  knob.name = 'knob';
  group.add(post, knob);
  return group;
}

/**
 * Curved double arrow lying flat above the rotate track, following the rim.
 * Built from a flat 2D shape in polar space, then bent onto the arc.
 */
export function curvedDoubleArrow(material: MeshStandardMaterial, y: number): Mesh {
  const { radius, rotateAngleDeg: a, rotateSpanDeg: s } = HANDLES;
  const half = 0.9; // half band width (cm)
  const headHalf = 2.2;
  const headLen = 3; // cm along the arc
  const span = degToRad(s + 1);
  const headAngle = headLen / radius;
  // 2D shape in (angle, radial offset) space. The long edges get extra
  // points so the band bends smoothly when wrapped onto the arc.
  const shape = new Shape();
  const steps = 10;
  const bodyStart = -span + headAngle;
  const bodyEnd = span - headAngle;
  shape.moveTo(-span, 0);
  shape.lineTo(bodyStart, headHalf);
  shape.lineTo(bodyStart, half);
  for (let i = 1; i <= steps; i++) shape.lineTo(bodyStart + ((bodyEnd - bodyStart) * i) / steps, half);
  shape.lineTo(bodyEnd, headHalf);
  shape.lineTo(span, 0);
  shape.lineTo(bodyEnd, -headHalf);
  shape.lineTo(bodyEnd, -half);
  for (let i = 1; i <= steps; i++) shape.lineTo(bodyEnd - ((bodyEnd - bodyStart) * i) / steps, -half);
  shape.lineTo(bodyStart, -headHalf);
  shape.closePath();
  const geometry = new ExtrudeGeometry(shape, { depth: 0.7, bevelEnabled: false, steps: 1, curveSegments: 1 });
  // Wrap each vertex onto the arc: x is the angle, y the radial offset, z is up.
  const position = geometry.getAttribute('position');
  const center = degToRad(a);
  for (let i = 0; i < position.count; i++) {
    const angle = center + position.getX(i);
    const r = radius + position.getY(i);
    const up = position.getZ(i);
    position.setXYZ(i, polarX(r, angle), y + up, polarZ(r, angle));
  }
  geometry.computeVertexNormals();
  return new Mesh(geometry, material);
}

/** Height handle rails: two upright posts. */
export function heightRails(): Group {
  const group = new Group();
  const { radius, heightAngleDeg: a, barWidth, barRestY, heightMin, heightMax } = HANDLES;
  const bottom = barRestY + heightMin - 2;
  const top = barRestY + heightMax + 2;
  const tangentDeg = (barWidth / 2 + 1) / radius / (Math.PI / 180);
  for (const side of [-1, 1]) {
    const rail = new Mesh(new CylinderGeometry(0.5, 0.5, top - bottom, 6), flatMaterial(HANDLES.trackColor));
    rail.position.copy(polar(radius, a + side * tangentDeg, (top + bottom) / 2));
    group.add(rail);
  }
  return group;
}

/** Height handle bar: a thick horizontal bar between the rails. Origin at its center. */
export function heightBar(material: MeshStandardMaterial): Group {
  const group = new Group();
  const bar = new Mesh(new CylinderGeometry(HANDLES.barRadius, HANDLES.barRadius, HANDLES.barWidth, 10), material);
  bar.rotation.z = Math.PI / 2; // lie along local x
  group.add(bar);
  // Turn so local x runs along the rim (tangent at the handle angle).
  group.rotation.y = -degToRad(HANDLES.heightAngleDeg);
  return group;
}

/** Vertical double arrow beside the height handle. Faces the player. */
export function verticalDoubleArrow(material: MeshStandardMaterial): Mesh {
  const halfLen = 7;
  const half = 0.9;
  const headHalf = 2.2;
  const headLen = 3;
  const shape = new Shape();
  shape.moveTo(0, halfLen);
  shape.lineTo(headHalf, halfLen - headLen);
  shape.lineTo(half, halfLen - headLen);
  shape.lineTo(half, -halfLen + headLen);
  shape.lineTo(headHalf, -halfLen + headLen);
  shape.lineTo(0, -halfLen);
  shape.lineTo(-headHalf, -halfLen + headLen);
  shape.lineTo(-half, -halfLen + headLen);
  shape.lineTo(-half, halfLen - headLen);
  shape.lineTo(-headHalf, halfLen - headLen);
  shape.closePath();
  const geometry = new ExtrudeGeometry(shape, { depth: 0.7, bevelEnabled: false });
  geometry.translate(0, 0, -0.35);
  const mesh = new Mesh(geometry, material);
  // Beside the bar on its outer side (away from the rotate handle), facing the player.
  const { radius, heightAngleDeg, barWidth, barRestY } = HANDLES;
  const offsetDeg = (barWidth / 2 + 3) / radius / (Math.PI / 180);
  const angle = heightAngleDeg + Math.sign(heightAngleDeg || -1) * offsetDeg;
  mesh.position.copy(polar(radius, angle, barRestY + 2));
  // Shape faces +z. Point it at the center (the player).
  mesh.rotation.y = -degToRad(angle);
  return mesh;
}
