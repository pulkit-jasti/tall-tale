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
  MeshBasicMaterial,
  MeshStandardMaterial,
  Shape,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three';
import { BELL, HANDLES, HORN, KNIGHTS, PEBBLE_BOWL, PEPPER, SLINGSHOT, SWATTER, TOOL_SPOTS, TOOLS } from '../config/game.js';
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
export function post(length: number, radius = TOOL_SPOTS.postRadius): Mesh {
  length = Math.max(0.1, length);
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

/** The little rope that ties a locked tool down: a thin ring around it. */
export function toolRope(radius: number): Mesh {
  return new Mesh(new TorusGeometry(radius, 0.35, 5, 14), flatMaterial(TOOLS.ropeColor));
}

/**
 * A field knight squad's banner (v2, KNIGHTS): a thin wooden pole from the
 * ground up, with a blue cloth and a gold stripe at its top, the cloth
 * hanging toward -z (behind the knight as it runs). Unlit cloth, so it reads
 * at night. Board cm, its foot at the origin.
 */
export function knightBanner(): Group {
  const { bannerHeight: h, bannerWidth: w, bannerLength: l } = KNIGHTS;
  const group = new Group();
  const pole = new Mesh(new CylinderGeometry(0.12, 0.14, h, 5), flatMaterial(KNIGHTS.poleColor));
  pole.position.y = h / 2;
  const cloth = new Mesh(new BoxGeometry(0.08, l, w), new MeshBasicMaterial({ color: KNIGHTS.bannerColor }));
  cloth.position.set(0, h - l / 2 - 0.2, -w / 2);
  const stripe = new Mesh(new BoxGeometry(0.1, l * 0.22, w), new MeshBasicMaterial({ color: KNIGHTS.bannerTrim }));
  stripe.position.set(0, h - l * 0.45, -w / 2);
  const tip = new Mesh(new SphereGeometry(0.28, 6, 4), new MeshBasicMaterial({ color: KNIGHTS.bannerTrim }));
  tip.position.y = h + 0.2;
  group.add(pole, cloth, stripe, tip);
  return group;
}

/**
 * War horn (v2): a short leather grip along +y from y = 0 (the end the hand
 * holds) and an ivory horn on top of it, lying along -z: the brass
 * mouthpiece toward +z (the face), the open bell end toward -z (the way the
 * knuckles point when it is held), a little raised, with brass bands.
 * Returns the group, its materials, the mouthpiece and the bell's middle (cm).
 */
export function warHorn(): { group: Group; materials: MeshStandardMaterial[]; mouthpiece: Vector3; bell: Vector3 } {
  const { gripLength, gripRadius, hornLength, mouthRadius, bellRadius, hornBack } = HORN;
  const bodyMaterial = flatMaterial(HORN.bodyColor);
  bodyMaterial.side = DoubleSide;
  const bandMaterial = flatMaterial(HORN.bandColor);
  const gripMaterial = flatMaterial(HORN.gripColor);
  const group = new Group();
  const grip = new Mesh(new CylinderGeometry(gripRadius, gripRadius * 1.1, gripLength, 8), gripMaterial);
  grip.position.y = gripLength / 2;
  // The horn's axis is its y: turned to lie along z, its top (the bell) toward -z.
  const hornY = gripLength + mouthRadius * 0.8;
  const horn = new Mesh(new CylinderGeometry(bellRadius, mouthRadius, hornLength, 12, 3, true), bodyMaterial);
  horn.rotation.x = -Math.PI / 2;
  horn.position.set(0, hornY, hornBack - hornLength / 2);
  // A gentle curve: the bell half bends up a little (the segment rows lifted along the length).
  // Turned as it is, the cylinder's own +z is the world's up.
  const position = horn.geometry.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    const t = (position.getY(i) + hornLength / 2) / hornLength;
    position.setZ(i, position.getZ(i) + t * t * bellRadius * 0.8);
  }
  position.needsUpdate = true;
  horn.geometry.computeVertexNormals();
  const bellZ = hornBack - hornLength;
  const bellY = hornY + bellRadius * 0.8;
  const rim = new Mesh(new TorusGeometry(bellRadius, 0.35, 5, 14), bandMaterial);
  rim.position.set(0, bellY, bellZ);
  const band = new Mesh(new TorusGeometry(mouthRadius + (bellRadius - mouthRadius) * 0.45, 0.25, 5, 12), bandMaterial);
  band.position.set(0, hornY + bellRadius * 0.16, hornBack - hornLength * 0.45);
  const mouthpiece = new Mesh(new CylinderGeometry(mouthRadius * 1.1, mouthRadius * 0.8, 1.6, 8), bandMaterial);
  mouthpiece.rotation.x = Math.PI / 2;
  mouthpiece.position.set(0, hornY, hornBack + 0.6);
  group.add(grip, horn, rim, band, mouthpiece);
  return {
    group,
    materials: [bodyMaterial, bandMaterial, gripMaterial],
    mouthpiece: new Vector3(0, hornY, hornBack + 1.4),
    bell: new Vector3(0, bellY, bellZ),
  };
}

/**
 * The horn's breath meter, lying on top of it from the mouthpiece toward the
 * bell: a dark track and a fill bar that grows along it (scale its z from 0
 * to 1). Unlit, so it reads in any light. Returns the parts (cm).
 */
export function hornMeter(): { group: Group; fill: Mesh<BoxGeometry, MeshBasicMaterial> } {
  const { hornLength, mouthRadius, bellRadius, hornBack, gripLength, meterWidth, meterLift } = HORN;
  const hornY = gripLength + mouthRadius * 0.8;
  const z1 = hornBack - 1.5;
  const length = hornLength * 0.55;
  const group = new Group();
  group.position.set(0, hornY + mouthRadius + meterLift, z1);
  // Its length runs along local -z, tilted up with the horn's top line.
  const rise = (bellRadius - mouthRadius) * 0.55;
  group.rotation.x = Math.atan2(rise, length);
  const track = new Mesh(new BoxGeometry(meterWidth + 0.2, 0.2, length + 0.2), new MeshBasicMaterial({ color: HORN.meterTrackColor }));
  track.position.z = -length / 2;
  const fillGeometry = new BoxGeometry(meterWidth, 0.3, 1);
  fillGeometry.translate(0, 0.05, -0.5);
  const fill = new Mesh(fillGeometry, new MeshBasicMaterial({ color: HORN.meterLowColor }));
  fill.scale.z = 0.001;
  // The fill grows from the start to the full length.
  fill.userData.length = length;
  group.add(track, fill);
  return { group, fill };
}

/**
 * Hand bell: a wooden handle along +y from y = 0 (the end the hand holds,
 * with a knob on top) and a brass bell hanging below it, its open mouth at
 * y = -bellHeight. Returns the group, its materials and the bell's middle (cm).
 */
export function handBell(): { group: Group; materials: MeshStandardMaterial[]; middle: Vector3 } {
  const { handleLength, handleRadius, bellHeight: h, bellMouth: m } = BELL;
  const brass = flatMaterial(BELL.brassColor);
  brass.side = DoubleSide;
  const wood = flatMaterial(BELL.handleColor);
  const clapperMaterial = flatMaterial(BELL.clapperColor);
  const group = new Group();
  const handle = new Mesh(new CylinderGeometry(handleRadius, handleRadius * 1.15, handleLength, 8), wood);
  handle.position.y = handleLength / 2;
  const knob = new Mesh(new SphereGeometry(handleRadius * 1.5, 8, 6), wood);
  knob.position.y = handleLength + handleRadius * 0.8;
  // The bell: a lathe from its round top down to a flared mouth.
  const profile = [
    new Vector2(0.01, 0.3),
    new Vector2(m * 0.35, 0.1),
    new Vector2(m * 0.5, -h * 0.2),
    new Vector2(m * 0.58, -h * 0.5),
    new Vector2(m * 0.72, -h * 0.78),
    new Vector2(m, -h),
  ];
  const bell = new Mesh(new LatheGeometry(profile, 12), brass);
  const clapper = new Mesh(new SphereGeometry(0.6, 6, 5), clapperMaterial);
  clapper.position.y = -h + 0.9;
  group.add(handle, knob, bell, clapper);
  return { group, materials: [brass, wood], middle: new Vector3(0, -h / 2, 0) };
}
