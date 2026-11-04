// Code-made placeholder shapes (docs/placeholder-shapes.md). Each shape lives
// in its own small function so a real model can replace it later.
import {
  BoxGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  IcosahedronGeometry,
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
import { FOOD_JAR, HANDLES, PEBBLE_BOWL, PEPPER, PIPS, SLINGSHOT, SWATTER, TOOL_SPOTS, TOOLS } from '../config/game.js';
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
  // An open leather pouch, like a real one: a thin upright strip across x
  // (between the bands), standing square to the ground and facing the shot.
  // It bends back into a U behind the stone (toward +z, the player), so the
  // stone sits in its cup and shows above and below it. Its two ends are at
  // z = 0, x = +-length / 2, where the bands tie on.
  const { pouchLength, pouchWidth, pouchSag, pouchThickness, pouchSegments } = SLINGSHOT;
  const half = pouchLength / 2;
  const bend = (x: number): number => pouchSag * (1 - (x / half) ** 2);
  // Drawn flat in (x, z), then stood up: the strip's width becomes its height.
  const shape = new Shape();
  for (let i = 0; i <= pouchSegments; i++) {
    const x = -half + (pouchLength * i) / pouchSegments;
    if (i === 0) shape.moveTo(x, bend(x));
    else shape.lineTo(x, bend(x));
  }
  for (let i = pouchSegments; i >= 0; i--) {
    const x = -half + (pouchLength * i) / pouchSegments;
    shape.lineTo(x, bend(x) + pouchThickness);
  }
  shape.closePath();
  const geometry = new ExtrudeGeometry(shape, { depth: pouchWidth, bevelEnabled: false, curveSegments: 1 });
  // Shape y becomes z (the bend toward the player), the extrusion becomes the height, centered on y = 0.
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, pouchWidth / 2, 0);
  material.side = DoubleSide;
  return new Mesh(geometry, material);
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

/**
 * Fly swatter: a long thin handle along +y from y = 0 (the end the hand
 * holds) and a flat square head with a darker rim at the top. The head's
 * face looks along z. Returns the group and its materials.
 */
export function flySwatter(): { group: Group; materials: MeshStandardMaterial[] } {
  const { handleLength, handleRadius, headWidth, headHeight, headThickness } = SWATTER;
  const handleMaterial = flatMaterial(SWATTER.handleColor);
  const headMaterial = flatMaterial(SWATTER.headColor);
  const frameMaterial = flatMaterial(SWATTER.frameColor);
  const group = new Group();
  const handle = new Mesh(new CylinderGeometry(handleRadius * 0.8, handleRadius, handleLength, 8), handleMaterial);
  handle.position.y = handleLength / 2;
  const head = new Mesh(new BoxGeometry(headWidth, headHeight, headThickness), headMaterial);
  head.position.y = handleLength + headHeight / 2;
  // A thin rim around the head, so the flat shape reads from any side.
  const rim = new Mesh(new BoxGeometry(headWidth + 0.6, headHeight + 0.6, headThickness * 0.6), frameMaterial);
  rim.position.copy(head.position);
  const neck = new Mesh(new BoxGeometry(handleRadius * 2.4, 1.2, headThickness * 1.4), frameMaterial);
  neck.position.y = handleLength + 0.2;
  group.add(handle, rim, head, neck);
  return { group, materials: [handleMaterial, headMaterial, frameMaterial] };
}

/**
 * Pepper shaker: a cylinder body standing on y = 0 with a dome cap and a few
 * dark dots for holes. Returns the group, its materials and the cap top (cm).
 */
export function pepperShaker(): { group: Group; materials: MeshStandardMaterial[]; top: number } {
  const { bodyHeight, bodyRadius } = PEPPER;
  const bodyMaterial = flatMaterial(PEPPER.bodyColor);
  const capMaterial = flatMaterial(PEPPER.capColor);
  const holeMaterial = flatMaterial(PEPPER.holeColor);
  const group = new Group();
  const body = new Mesh(new CylinderGeometry(bodyRadius * 0.92, bodyRadius, bodyHeight, 10), bodyMaterial);
  body.position.y = bodyHeight / 2;
  const cap = new Mesh(new SphereGeometry(bodyRadius, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), capMaterial);
  cap.position.y = bodyHeight;
  group.add(body, cap);
  const hole = new SphereGeometry(0.28, 5, 4);
  const dots: [number, number][] = [[0, 0], [0.5, 0], [0.5, 120], [0.5, 240]];
  for (const [share, deg] of dots) {
    const a = degToRad(deg);
    const r = bodyRadius * share;
    const dot = new Mesh(hole, holeMaterial);
    dot.position.set(Math.cos(a) * r, bodyHeight + Math.sqrt(bodyRadius * bodyRadius - r * r), Math.sin(a) * r);
    group.add(dot);
  }
  return { group, materials: [bodyMaterial, capMaterial], top: bodyHeight + bodyRadius };
}

/** A thin dark ledge for the food pips, along x, top at y = 0 (cm). */
export function pipLedge(count: number): Mesh {
  const length = count * (PIPS.size + PIPS.gap) + PIPS.gap;
  const ledge = new Mesh(new BoxGeometry(length, 0.6, PIPS.size + 0.4), flatMaterial(PIPS.ledgeColor));
  ledge.position.y = -0.3;
  return ledge;
}

/** One pip ball (shared geometry for an instanced row). */
export function pipGeometry(): SphereGeometry {
  return new SphereGeometry(PIPS.size / 2, 8, 6);
}

/** The little rope that ties a locked tool down: a thin ring around it. */
export function toolRope(radius: number): Mesh {
  return new Mesh(new TorusGeometry(radius, 0.35, 5, 14), flatMaterial(TOOLS.ropeColor));
}

/** One food ball for the jar's heap (shared geometry for an instanced heap). */
export function foodBallGeometry(): IcosahedronGeometry {
  return new IcosahedronGeometry(FOOD_JAR.ballSize / 2, 0);
}
