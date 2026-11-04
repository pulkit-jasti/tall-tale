// Code-made placeholder shapes (docs/placeholder-shapes.md). Each shape lives
// in its own small function so a real model can replace it later.
import {
  BoxGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  Shape,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three';
import { HANDLES, PEBBLE_BOWL, SLINGSHOT, TOOL_SPOTS } from '../config/game.js';
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
  // A full circle is a closed curve, so it skips the last point (same as the first).
  const closed = a1 - a0 >= 360;
  for (let i = 0; i < (closed ? 32 : 33); i++) points.push(polar(r, a0 + ((a1 - a0) * i) / 32, y));
  return new CatmullRomCurve3(points, closed);
}

/**
 * Ring handle: a curved rail around the player (a full circle when the span
 * is 360 degrees, otherwise an arc with round ends). Origin at the board center.
 */
export function ringArc(material: MeshStandardMaterial): Group {
  const { radius, halfSpanDeg: s, ringY, ringRadius } = HANDLES;
  const full = s >= 180;
  const group = new Group();
  group.add(new Mesh(new TubeGeometry(arc(radius, -s, s, ringY), full ? 72 : 32, ringRadius, 8, full), material));
  if (!full) {
    for (const end of [-s, s]) {
      const cap = new Mesh(new SphereGeometry(ringRadius, 8, 6), material);
      cap.position.copy(polar(radius, end, ringY));
      group.add(cap);
    }
  }
  return group;
}

/** Short poles that hold the ring up from the board, spread evenly from the front. */
export function ringPoles(): Group {
  const { radius, ringY, poleRadius, poleCount } = HANDLES;
  const group = new Group();
  for (let i = 0; i < poleCount; i++) {
    const pole = new Mesh(new CylinderGeometry(poleRadius, poleRadius, ringY, 6), flatMaterial(HANDLES.trackColor));
    pole.position.copy(polar(radius, (360 * i) / poleCount, ringY / 2));
    group.add(pole);
  }
  return group;
}

/** Small bands wrapped around the ring tube, spread evenly, so the ring's turning is easy to see. */
export function ringBands(material: MeshStandardMaterial): Group {
  const { radius, ringY, ringRadius, bandCount } = HANDLES;
  const group = new Group();
  const geometry = new TorusGeometry(ringRadius + 0.15, 0.4, 6, 12);
  for (let i = 0; i < bandCount; i++) {
    const deg = (360 * (i + 0.5)) / bandCount;
    const band = new Mesh(geometry, material);
    band.position.copy(polar(radius, deg, ringY));
    // A torus wraps around its local z axis. Turn z along the ring's direction here.
    band.rotation.y = Math.PI / 2 - degToRad(deg);
    group.add(band);
  }
  return group;
}

/**
 * Curved double arrow lying flat, following the rim around `centerDeg`.
 * Built from a flat 2D shape in polar space, then bent onto the arc.
 */
export function curvedDoubleArrow(
  material: MeshStandardMaterial,
  radius: number,
  centerDeg: number,
  halfSpanDeg: number,
  y: number,
): Mesh {
  const a = centerDeg;
  const s = halfSpanDeg;
  const k = HANDLES.arrowSize;
  const half = 0.9 * k; // half band width (cm)
  const headHalf = 2.2 * k;
  const headLen = 3 * k; // cm along the arc
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

/** Vertical double arrow standing at `angleDeg` on the rim, bottom at `y`. Faces the player. */
export function verticalDoubleArrow(material: MeshStandardMaterial, radius: number, angleDeg: number, y: number): Mesh {
  const k = HANDLES.arrowSize;
  const halfLen = 4 * k;
  const half = 0.9 * k;
  const headHalf = 2.2 * k;
  const headLen = 3 * k;
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
  mesh.position.copy(polar(radius, angleDeg, y + halfLen));
  // Shape faces +z. Point it at the center (the player).
  mesh.rotation.y = -degToRad(angleDeg);
  return mesh;
}

/** A post that holds a fixed thing up, going down from y = 0 (cm). */
export function post(length = TOOL_SPOTS.postLength, radius = TOOL_SPOTS.postRadius): Mesh {
  const mesh = new Mesh(new CylinderGeometry(radius, radius * 1.2, length, 8), flatMaterial(TOOL_SPOTS.postColor));
  mesh.position.y = -length / 2;
  return mesh;
}

/**
 * Slingshot Y frame (3 cylinders), standing on y = 0, fork opening along x.
 * Returns the frame and the fork tip positions in its own space (cm).
 */
export function slingshotFrame(material: MeshStandardMaterial): { frame: Group; tips: [Vector3, Vector3] } {
  const { frameHeight, handleHeight, armSpreadDeg } = SLINGSHOT;
  const frame = new Group();
  const handle = new Mesh(new CylinderGeometry(0.6, 0.75, handleHeight, 8), material);
  handle.position.y = handleHeight / 2;
  frame.add(handle);
  const spread = degToRad(armSpreadDeg);
  const armLength = (frameHeight - handleHeight) / Math.cos(spread);
  const armGeometry = new CylinderGeometry(0.45, 0.55, armLength, 8);
  const tips: Vector3[] = [];
  for (const side of [-1, 1]) {
    const arm = new Mesh(armGeometry, material);
    // Tilt around z, so the arm leans out along x.
    arm.rotation.z = -side * spread;
    arm.position.set((side * Math.sin(spread) * armLength) / 2, handleHeight + (Math.cos(spread) * armLength) / 2, 0);
    frame.add(arm);
    tips.push(new Vector3(side * Math.sin(spread) * armLength, frameHeight, 0));
  }
  return { frame, tips: tips as [Vector3, Vector3] };
}

/** One slingshot band: a unit long thin cylinder along y, stretched between two points in code. */
export function slingshotBand(material: MeshStandardMaterial): Mesh {
  const geometry = new CylinderGeometry(0.22, 0.22, 1, 5);
  return new Mesh(geometry, material);
}

/** The leather pouch that is pinched: a small flattened box. */
export function slingshotPouch(material: MeshStandardMaterial): Mesh {
  return new Mesh(new BoxGeometry(3.6, 1.5, 2.2), material);
}

/** Shallow open bowl (lathe) with its rim at y = 0 (cm). */
export function pebbleBowl(): Mesh {
  const { width, depth } = PEBBLE_BOWL;
  const r = width / 2;
  const profile = [
    new Vector2(0, -depth),
    new Vector2(r * 0.55, -depth),
    new Vector2(r * 0.85, -depth * 0.6),
    new Vector2(r, 0),
    new Vector2(r * 0.92, 0),
    new Vector2(r * 0.78, -depth * 0.55),
    new Vector2(r * 0.5, -depth * 0.85),
    new Vector2(0, -depth * 0.85),
  ];
  const material = flatMaterial(PEBBLE_BOWL.color);
  material.side = DoubleSide;
  return new Mesh(new LatheGeometry(profile, 12), material);
}
