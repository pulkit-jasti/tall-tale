// Code-made placeholder shapes (docs/placeholder-shapes.md). Each shape lives
// in its own small function so a real model can replace it later.
import {
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
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
  PlaneGeometry,
  Shape,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three';
import { DRUM, GLASS, MAGNET, SUGAR, HANDLES, HORN, KNIGHTS, PEBBLE_BOWL, PEPPER, SLINGSHOT, SWATTER, TOOL_SPOTS, TOOLS } from '../config/game.js';
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

/**
 * A short piece of the ring handle in front (the home screen's height rail,
 * src/player/heightRail.ts): the same tube at the same spot, `halfSpanDeg`
 * each way from the front, with round ends and a pole under each end.
 */
export function railArc(material: MeshStandardMaterial, halfSpanDeg: number): Group {
  const { radius, ringY, ringRadius, poleRadius } = HANDLES;
  const group = new Group();
  group.add(new Mesh(new TubeGeometry(arc(radius, -halfSpanDeg, halfSpanDeg, ringY), 16, ringRadius, 8, false), material));
  for (const end of [-halfSpanDeg, halfSpanDeg]) {
    const cap = new Mesh(new SphereGeometry(ringRadius, 8, 6), material);
    cap.position.copy(polar(radius, end, ringY));
    const pole = new Mesh(new CylinderGeometry(poleRadius, poleRadius, ringY, 6), flatMaterial(HANDLES.trackColor));
    pole.position.copy(polar(radius, end, ringY / 2));
    group.add(cap, pole);
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
export function flySwatter(): { group: Group; materials: MeshStandardMaterial[]; blade: Group } {
  const { handleLength, handleRadius, headWidth, headHeight, headThickness } = SWATTER;
  const handleMaterial = flatMaterial(SWATTER.handleColor);
  const headMaterial = flatMaterial(SWATTER.headColor);
  const frameMaterial = flatMaterial(SWATTER.frameColor);
  const group = new Group();
  const handle = new Mesh(new CylinderGeometry(handleRadius * 0.8, handleRadius, handleLength, 8), handleMaterial);
  handle.position.y = handleLength / 2;
  // The blade (head and rim) on a pivot at the neck, so it can grow from there (Endless Wide Swatter).
  const blade = new Group();
  blade.position.y = handleLength;
  const head = new Mesh(new BoxGeometry(headWidth, headHeight, headThickness), headMaterial);
  head.position.y = headHeight / 2;
  // A thin rim around the head, so the flat shape reads from any side.
  const rim = new Mesh(new BoxGeometry(headWidth + 0.6, headHeight + 0.6, headThickness * 0.6), frameMaterial);
  rim.position.copy(head.position);
  blade.add(rim, head);
  const neck = new Mesh(new BoxGeometry(handleRadius * 2.4, 1.2, headThickness * 1.4), frameMaterial);
  neck.position.y = handleLength + 0.2;
  group.add(handle, blade, neck);
  return { group, materials: [handleMaterial, headMaterial, frameMaterial], blade };
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
export function knightBanner(opacity = 1): Group {
  const { bannerHeight: h, bannerWidth: w, bannerLength: l } = KNIGHTS;
  const group = new Group();
  // See-through (the horn's ghost banner where the knights will go): unlit, never writing depth.
  const ghost = opacity < 1;
  const basic = (color: number): MeshBasicMaterial =>
    new MeshBasicMaterial({ color, transparent: ghost, opacity, depthWrite: !ghost });
  const pole = new Mesh(new CylinderGeometry(0.12, 0.14, h, 5), ghost ? basic(KNIGHTS.poleColor) : flatMaterial(KNIGHTS.poleColor));
  pole.position.y = h / 2;
  const clothMaterial = basic(KNIGHTS.bannerColor);
  const cloth = new Mesh(new BoxGeometry(0.08, l, w), clothMaterial);
  cloth.position.set(0, h - l / 2 - 0.2, -w / 2);
  const stripe = new Mesh(new BoxGeometry(0.1, l * 0.22, w), basic(KNIGHTS.bannerTrim));
  stripe.position.set(0, h - l * 0.45, -w / 2);
  const tip = new Mesh(new SphereGeometry(0.28, 6, 4), basic(KNIGHTS.bannerTrim));
  tip.position.y = h + 0.2;
  group.add(pole, cloth, stripe, tip);
  // The cloth's material, so the banner of the squad the horn would move can glow.
  group.userData.cloth = clothMaterial;
  return group;
}

/**
 * War horn (v2): a short leather grip along +y from y = 0 (the end the hand
 * holds) and a curved ivory hunting horn held from below: the brass
 * mouthpiece on top of the grip toward +z (the face), the body arching
 * forward, then down past the fist and a little to the side, the open bell
 * ending low (HORN.curve). At the lips it stays below the line of sight. A
 * tapered tube along the curve, brass bands and a brass rim on the bell.
 * Returns the group, its materials, the mouthpiece and the bell's middle (cm).
 */
export function warHorn(): { group: Group; materials: MeshStandardMaterial[]; mouthpiece: Vector3; bell: Vector3 } {
  const { gripLength, gripRadius, mouthRadius, bellRadius } = HORN;
  const bodyMaterial = flatMaterial(HORN.bodyColor);
  bodyMaterial.side = DoubleSide;
  const bandMaterial = flatMaterial(HORN.bandColor);
  const gripMaterial = flatMaterial(HORN.gripColor);
  const group = new Group();
  const grip = new Mesh(new CylinderGeometry(gripRadius, gripRadius * 1.1, gripLength, 8), gripMaterial);
  grip.position.y = gripLength / 2;
  const curve = new CatmullRomCurve3(HORN.curve.map(([x, y, z]) => new Vector3(x, y, z)));
  // The tube: rings along the curve, thin at the mouthpiece, flaring to the bell.
  const steps = 20;
  const sides = 10;
  const radiusAt = (t: number): number => mouthRadius + (bellRadius - mouthRadius) * Math.pow(t, 2.6);
  const frames = curve.computeFrenetFrames(steps, false);
  const positions: number[] = [];
  const indices: number[] = [];
  const point = new Vector3();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    curve.getPointAt(t, point);
    const r = radiusAt(t);
    const n = frames.normals[i];
    const b = frames.binormals[i];
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2;
      positions.push(
        point.x + r * (Math.cos(a) * n.x + Math.sin(a) * b.x),
        point.y + r * (Math.cos(a) * n.y + Math.sin(a) * b.y),
        point.z + r * (Math.cos(a) * n.z + Math.sin(a) * b.z),
      );
    }
  }
  for (let i = 0; i < steps; i++) {
    for (let k = 0; k < sides; k++) {
      const a = i * sides + k;
      const b = i * sides + ((k + 1) % sides);
      const c = (i + 1) * sides + k;
      const d = (i + 1) * sides + ((k + 1) % sides);
      indices.push(a, c, b, b, c, d);
    }
  }
  const tube = new BufferGeometry();
  tube.setAttribute('position', new Float32BufferAttribute(positions, 3));
  tube.setIndex(indices);
  tube.computeVertexNormals();
  const horn = new Mesh(tube, bodyMaterial);
  // Brass: a band a third and two thirds along, a rim round the bell, the mouthpiece along the first stretch.
  const ringAt = (t: number, thickness: number): Mesh => {
    const ring = new Mesh(new TorusGeometry(radiusAt(t) + thickness * 0.4, thickness, 5, 14), bandMaterial);
    curve.getPointAt(t, ring.position);
    const tangent = curve.getTangentAt(t);
    ring.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), tangent);
    return ring;
  };
  const start = curve.getPointAt(0);
  const startTangent = curve.getTangentAt(0);
  const mouthpiece = new Mesh(new CylinderGeometry(mouthRadius * 1.15, mouthRadius * 0.85, 1.4, 8), bandMaterial);
  // Along the curve's start, sticking out toward the face.
  mouthpiece.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), startTangent.clone().negate());
  mouthpiece.position.copy(start).addScaledVector(startTangent, -0.6);
  group.add(grip, horn, ringAt(0.35, 0.22), ringAt(0.65, 0.25), ringAt(1, 0.32), mouthpiece);
  const bell = curve.getPointAt(1);
  return {
    group,
    materials: [bodyMaterial, bandMaterial, gripMaterial],
    mouthpiece: start.clone().addScaledVector(startTangent, -1.3),
    bell,
  };
}

/**
 * The drum (v3 2.2, docs/placeholder-shapes.md): a short 10-sided red
 * cylinder from y = 0 up to DRUM.height, two gold rim bands (top and bottom)
 * and a pale cream skin on top. Returns the group and the skin mesh (it
 * bounces on a strike).
 */
export function drum(): { group: Group; skin: Mesh } {
  const { radius: r, height: h, sides, rimHeight: rim } = DRUM;
  // Open ended: no lids of its own, so nothing sits in the same plane as the gold bands' lids (they fought and flickered).
  const body = new Mesh(new CylinderGeometry(r, r, h, sides, 1, true), flatMaterial(DRUM.bodyColor));
  body.position.y = h / 2;
  const gold = flatMaterial(DRUM.rimColor);
  const bottom = new Mesh(new CylinderGeometry(r * 1.06, r * 1.06, rim, sides), gold);
  bottom.position.y = rim / 2;
  const top = new Mesh(new CylinderGeometry(r * 1.06, r * 1.06, rim, sides), gold);
  top.position.y = h - rim / 2;
  // Covers the whole top and stands 5 mm proud, its lower part hidden in the top band, so a strike's dip never sinks it below the band.
  const skin = new Mesh(new CylinderGeometry(r * 0.99, r * 0.99, 0.9, sides), flatMaterial(DRUM.skinColor));
  skin.position.y = h + 0.05;
  const group = new Group();
  group.add(body, bottom, top, skin);
  return { group, skin };
}

/**
 * The horseshoe magnet (v3 2.2, docs/placeholder-shapes.md): a short leather
 * grip along +y from y = 0, a red horseshoe on top whose bend sits over the
 * grip and whose two arms point forward (-z, the way the knuckles point in
 * its fist pose), with silver tips. Returns the group, its materials, the
 * point between the tips and the way they point (cm, tool frame).
 */
export function horseshoeMagnet(): { group: Group; materials: MeshStandardMaterial[]; tips: Vector3; pointing: Vector3 } {
  const { gripLength: gl, gripRadius, shoeRadius: r, shoeTube: t, tipLength } = MAGNET;
  const red = flatMaterial(MAGNET.bodyColor);
  const silver = flatMaterial(MAGNET.tipColor);
  const leather = flatMaterial(MAGNET.gripColor);
  const group = new Group();
  const grip = new Mesh(new CylinderGeometry(gripRadius, gripRadius, gl, 8), leather);
  grip.position.y = gl / 2;
  const shoe = new Group();
  shoe.position.set(0, gl + t * 0.5, -r);
  // The bend: half a torus, turned flat so its round side is toward the player (+z).
  const bend = new Mesh(new TorusGeometry(r, t, 6, 10, Math.PI), red);
  bend.rotation.x = Math.PI / 2;
  const arm = r * 0.9;
  for (const side of [-1, 1]) {
    const straight = new Mesh(new CylinderGeometry(t, t, arm, 6), red);
    straight.rotation.x = Math.PI / 2;
    straight.position.set(side * r, 0, -arm / 2);
    const tip = new Mesh(new CylinderGeometry(t * 1.05, t * 1.05, tipLength, 6), silver);
    tip.rotation.x = Math.PI / 2;
    tip.position.set(side * r, 0, -arm - tipLength / 2);
    shoe.add(straight, tip);
  }
  shoe.add(bend);
  group.add(grip, shoe);
  return { group, materials: [red, silver, leather], tips: new Vector3(0, gl + t * 0.5, -r - arm - tipLength), pointing: new Vector3(0, 0, -1) };
}

/**
 * The rope bridge (2026-11-17 playtest: the Kenney bridge read as a box on flat ground). Along local +x
 * (`length` cm, centered), `width` cm across, its deck arching `arch` cm in the middle: separate planks in
 * two woods, each tipped to the arch with a little play, posts at the ends and quarters, two sagging rope
 * rails a side, and stone footings on both banks. Its walking surface is local y = deck(x).
 */
export function ropeBridge(length: number, width: number, arch: number): { group: Group; deck: Group; materials: MeshStandardMaterial[] } {
  const light = flatMaterial(0xa0703f);
  const dark = flatMaterial(0x7a5230);
  const rope = flatMaterial(0xc9a96e);
  const stone = flatMaterial(0x8d8a84);
  const group = new Group();
  const deck = new Group();
  const deckY = (x: number): number => arch * Math.sin(Math.PI * (x / length + 0.5));
  const slope = (x: number): number => Math.atan((arch * Math.PI * Math.cos(Math.PI * (x / length + 0.5))) / length);
  // Planks: about 1 cm each, no gaps, a little uneven.
  const count = Math.round(length / 1.05);
  const step = length / count;
  const plank = new BoxGeometry(step * 0.96, 0.35, width);
  for (let i = 0; i < count; i++) {
    const x = -length / 2 + step * (i + 0.5);
    const p = new Mesh(plank, i % 3 === 1 ? dark : light);
    p.position.set(x, deckY(x) - 0.18, Math.sin(i * 2.3) * 0.12);
    p.rotation.set(Math.sin(i * 1.7) * 0.04, Math.sin(i * 3.1) * 0.05, slope(x));
    deck.add(p);
  }
  // Two beams under the planks along each side.
  for (const z of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const x0 = -length / 2 + (length / 6) * i;
      const x1 = x0 + length / 6;
      const xm = (x0 + x1) / 2;
      const beam = new Mesh(new BoxGeometry(length / 6 + 0.1, 0.4, 0.45), dark);
      beam.position.set(xm, deckY(xm) - 0.5, z * (width / 2 - 0.4));
      beam.rotation.z = slope(xm);
      deck.add(beam);
    }
  }
  // Posts and rope rails.
  const postX = [-length / 2 + 0.4, -length / 4, 0, length / 4, length / 2 - 0.4];
  const postGeometry = new CylinderGeometry(0.2, 0.26, 3.2, 6).translate(0, 1.6, 0);
  for (const z of [-1, 1]) {
    const zz = z * (width / 2 + 0.05);
    for (const x of postX) {
      const post = new Mesh(postGeometry, dark);
      post.position.set(x, deckY(x) - 0.2, zz);
      deck.add(post);
    }
    for (const h of [2.7, 1.5]) {
      // A rail sags between each pair of posts.
      const points: Vector3[] = [];
      for (let k = 0; k < postX.length - 1; k++) {
        const a = postX[k];
        const b = postX[k + 1];
        for (let s = 0; s < 4; s++) {
          const x = a + ((b - a) * s) / 4;
          points.push(new Vector3(x, deckY(x) - 0.2 + h - Math.sin((Math.PI * s) / 4) * 0.45, zz));
        }
      }
      const last = postX[postX.length - 1];
      points.push(new Vector3(last, deckY(last) - 0.2 + h, zz));
      deck.add(new Mesh(new TubeGeometry(new CatmullRomCurve3(points), 40, 0.09, 4), rope));
    }
  }
  group.add(deck);
  // Stone footings on both banks (they stay when the deck falls).
  const rock = new IcosahedronGeometry(1, 0);
  for (const end of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const r = new Mesh(rock, stone);
      const z = (k < 2 ? -1 : 1) * (width / 2 + 0.2) + (k % 2 === 0 ? 0.6 : -0.6);
      r.position.set(end * (length / 2 - 0.6 - (k % 2) * 1.2), 0.1, z);
      r.scale.set(1.1 + (k % 2) * 0.3, 0.7, 0.9);
      r.rotation.set(k, k * 1.3, 0);
      group.add(r);
    }
  }
  return { group, deck, materials: [light, dark, rope, stone] };
}

/**
 * Low-poly water for a ravine (2026-11-17): a faceted strip `length` cm along local z, `width` cm along x,
 * its points nudged up and down a little so each face catches the light differently.
 */
export function ravineWater(length: number, width: number, color: number): Mesh {
  const geometry = new PlaneGeometry(width, length, 6, 12).rotateX(-Math.PI / 2).toNonIndexed();
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    position.setY(i, Math.sin(x * 1.7 + z * 0.9) * 0.12 + Math.sin(z * 2.3) * 0.08);
  }
  geometry.computeVertexNormals();
  const material = new MeshStandardMaterial({ color, roughness: 0.25, metalness: 0.1, flatShading: true, transparent: true, opacity: 0.92 });
  return new Mesh(geometry, material);
}

/**
 * The sunflower turret (2026-11-17 playtest: the Kenney flower read as a
 * plain flower, facing up). No pack has a sunflower, so it is built here (say
 * so in docs/placeholder-shapes.md): a curved stem with two leaves, and a
 * head on a pivot that turns to its target: a brown face with two eyes and a
 * short seed snout, ringed by two layers of pointed yellow petals. The head
 * faces +z (yaw it toward a goblin), tipped a little down. `height` is its
 * full height (cm). Returns the group, the head pivot, the snout's tip in the
 * head's frame (where seeds leave) and its materials (for the wilt fade).
 */
export function sunflowerTurret(height: number): { group: Group; head: Group; muzzle: Vector3; materials: MeshStandardMaterial[] } {
  const s = height / 9;
  const stemMat = flatMaterial(0x4f9a3a);
  const leafMat = flatMaterial(0x6cc04a);
  const faceMat = flatMaterial(0x6b3d1f);
  const petalMat = flatMaterial(0xffc928);
  const petalDark = flatMaterial(0xf09a1a);
  const eyeMat = flatMaterial(0x1b120c);
  const group = new Group();
  // The stem: two short segments with a slight bend.
  const low = new Mesh(new CylinderGeometry(0.32 * s, 0.42 * s, 3.6 * s, 6), stemMat);
  low.position.y = 1.8 * s;
  const high = new Mesh(new CylinderGeometry(0.28 * s, 0.32 * s, 3 * s, 6), stemMat);
  high.position.set(0, 5 * s, 0.25 * s);
  high.rotation.x = 0.16;
  group.add(low, high);
  // Two leaves: flattened low-poly drops, pointing out and up.
  for (const side of [-1, 1]) {
    const leaf = new Mesh(new IcosahedronGeometry(1, 0), leafMat);
    leaf.scale.set(1.5 * s, 0.22 * s, 0.7 * s);
    leaf.position.set(side * 1.25 * s, 2.4 * s, 0);
    leaf.rotation.z = side * 0.45;
    group.add(leaf);
  }
  // The head pivot sits on top of the stem; the head is tipped 12 degrees down.
  const head = new Group();
  head.position.set(0, 6.6 * s, 0.45 * s);
  const tilt = new Group();
  tilt.rotation.x = 0.21;
  head.add(tilt);
  const face = new Mesh(new CylinderGeometry(1.15 * s, 1.25 * s, 0.7 * s, 10).rotateX(Math.PI / 2), faceMat);
  tilt.add(face);
  // Petals: two rings of flat pointed wedges, the back ring darker and offset, for a fuller low-poly head.
  const petal = new CylinderGeometry(0, 0.55 * s, 1.5 * s, 4, 1).scale(1, 1, 0.3).translate(0, 0.75 * s, 0);
  for (const [count, from, mat, z, offset] of [
    [12, 1.05, petalMat, 0.05, 0],
    [12, 0.95, petalDark, -0.2, Math.PI / 12],
  ] as const) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + offset;
      const p = new Mesh(petal, mat);
      p.position.set(Math.sin(a) * from * s, Math.cos(a) * from * s, z * s);
      p.rotation.z = -a;
      tilt.add(p);
    }
  }
  // A cartoon face: two eyes and a short snout that spits the seeds.
  const eye = new SphereGeometry(0.2 * s, 6, 4);
  for (const side of [-1, 1]) {
    const e = new Mesh(eye, eyeMat);
    e.position.set(side * 0.45 * s, 0.38 * s, 0.38 * s);
    tilt.add(e);
  }
  const snout = new Mesh(new CylinderGeometry(0.3 * s, 0.38 * s, 0.9 * s, 8).rotateX(Math.PI / 2), faceMat);
  snout.position.set(0, -0.25 * s, 0.7 * s);
  const mouth = new Mesh(new CylinderGeometry(0.18 * s, 0.18 * s, 0.1 * s, 8).rotateX(Math.PI / 2), eyeMat);
  mouth.position.set(0, -0.25 * s, 1.16 * s);
  tilt.add(snout, mouth);
  group.add(head);
  // The snout's tip in the head's frame (the tilt applied).
  const muzzle = new Vector3(0, -0.25 * s, 1.2 * s).applyEuler(tilt.rotation);
  return { group, head, muzzle, materials: [stemMat, leafMat, faceMat, petalMat, petalDark, eyeMat] };
}

/**
 * The magnifying glass (v3 2.2): a wooden handle along +y from y = 0, a gold
 * rim with a clear pale blue lens on top, its face toward +z (the eyes when
 * raised). Returns the group, its materials (handle and rim; the lens keeps
 * its own see-through look) and the lens middle (cm).
 */
export function magnifyingGlass(): { group: Group; materials: MeshStandardMaterial[]; lens: Vector3 } {
  const { handleLength: l, handleRadius, lensRadius: r, rimTube } = GLASS;
  const wood = flatMaterial(GLASS.handleColor);
  const gold = flatMaterial(GLASS.rimColor);
  const glass = new MeshBasicMaterial({ color: GLASS.lensColor, transparent: true, opacity: 0.35, depthWrite: false, side: DoubleSide });
  const group = new Group();
  const handle = new Mesh(new CylinderGeometry(handleRadius * 0.85, handleRadius, l, 8), wood);
  handle.position.y = l / 2;
  const middle = new Vector3(0, l + r, 0);
  const rim = new Mesh(new TorusGeometry(r, rimTube, 6, 20), gold);
  rim.position.copy(middle);
  const lens = new Mesh(new CylinderGeometry(r, r, 0.15, 20), glass);
  lens.rotation.x = Math.PI / 2;
  lens.position.copy(middle);
  group.add(handle, rim, lens);
  return { group, materials: [wood, gold], lens: middle };
}

/**
 * The sugar bowl (v3 2.2): a short wide blue bowl with white cubes piled on
 * top. Returns the group, its materials and the top of the pile (cm).
 */
export function sugarBowl(): { group: Group; materials: MeshStandardMaterial[]; top: Vector3; cubes: Mesh[] } {
  const { bowlRadius: r, bowlHeight: h, cubeSize: c } = SUGAR;
  // 2026-11-17: a faceted low-poly bowl (was a plain cylinder): a turned profile on 8 sides with a foot, a
  // rounded belly and a lip, a gold band, a heap of sugar inside and tilted cubes on it. No pack has one.
  const blue = flatMaterial(SUGAR.bowlColor);
  const white = flatMaterial(SUGAR.cubeColor);
  const gold = flatMaterial(SUGAR.bandColor);
  const sugar = flatMaterial(SUGAR.heapColor);
  const group = new Group();
  const profile = [
    new Vector2(r * 0.45, 0),
    new Vector2(r * 0.5, h * 0.12),
    new Vector2(r * 0.42, h * 0.2),
    new Vector2(r * 0.78, h * 0.42),
    new Vector2(r * 0.98, h * 0.72),
    new Vector2(r, h),
    new Vector2(r * 0.9, h * 1.04),
    new Vector2(r * 0.86, h * 0.9),
  ];
  const bowl = new Mesh(new LatheGeometry(profile, 8), blue);
  group.add(bowl);
  const band = new Mesh(new TorusGeometry(r * 0.9, h * 0.07, 4, 8).rotateX(Math.PI / 2), gold);
  band.position.y = h * 0.62;
  group.add(band);
  // The sugar heap filling the bowl, a squashed faceted dome.
  const heap = new Mesh(new IcosahedronGeometry(r * 0.82, 0), sugar);
  heap.scale.set(1, 0.38, 1);
  heap.position.y = h * 0.9;
  group.add(heap);
  const cubes: Mesh[] = [];
  const spots: [number, number, number, number][] = [
    [-0.9, 0, -0.5, 0.2],
    [0.8, 0, -0.6, -0.3],
    [0, 0, 0.9, 0.15],
    [0.05, 1, 0, -0.1],
  ];
  const cubeGeometry = new BoxGeometry(c, c, c);
  for (const [x, up, z, tip] of spots) {
    const cube = new Mesh(cubeGeometry, white);
    cube.position.set(x, h * 1.05 + c / 2 + up * c * 0.85, z);
    cube.rotation.set(tip, x + z, -tip * 0.7);
    group.add(cube);
    cubes.push(cube);
  }
  return { group, materials: [blue, white, gold, sugar], top: new Vector3(0, h + c * 1.5, 0), cubes };
}

/**
 * The drum stick: a thin wooden cylinder along +y from y = 0 (the end the
 * hand holds) with a round cream ball at its tip. Returns the group, its
 * materials and the ball's center (cm).
 */
export function drumStick(): { group: Group; materials: MeshStandardMaterial[]; ball: Vector3 } {
  const { stickLength: l, stickRadius: r, ballRadius } = DRUM;
  const wood = flatMaterial(DRUM.stickColor);
  const cream = flatMaterial(DRUM.ballColor);
  const stick = new Mesh(new CylinderGeometry(r * 0.85, r, l, 6), wood);
  stick.position.y = l / 2;
  const ball = new Mesh(new SphereGeometry(ballRadius, 8, 6), cream);
  ball.position.y = l;
  const group = new Group();
  group.add(stick, ball);
  return { group, materials: [wood, cream], ball: new Vector3(0, l, 0) };
}
