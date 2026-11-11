// The giant's seat and body (docs/mvp.md build step 6, part C).
//
//   Seat floor: the hole the player sits in is filled with packed earth at
//   board level, flush with the courtyard, with a ring of flat stones at its
//   edge. In boardLift (cm), so it rises with the board. One mesh.
//
//   Body: a chunky low-poly giant from the waist up, coming out of that
//   floor: belt, tunic, belly and shoulders. No legs, no arms (the tracked
//   hands float, which is normal in VR) and no head (the camera is there).
//   Stylized on purpose: a realistic body that does not match the real one
//   feels wrong. Real sizes (meters, world), so it is the player's size.
//   It sits under the head, a little behind it, and turns slowly toward
//   where the player faces (not 1:1, so leaning never looks wrong). Its
//   shoulders stay low enough that they never cover the ring, the tools or
//   the courtyard (GIANT.shoulderDrop).
//
// The torso stretches between the floor and the shoulders, so it always
// fits, whatever height the player set the board to.
import {
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DodecahedronGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type Object3D,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BOARD, GIANT } from '../config/game.js';
import { angleDelta } from '../rules/boardMath.js';
import type { Random } from '../rules/random.js';

const material = new MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: true });
const tint = new Color();
const temp = new Vector3();

/** One solid color on every point of a geometry (for merging into one vertex colored mesh). */
function painted(geometry: BufferGeometry, color: number): BufferGeometry {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  tint.setHex(color);
  const count = g.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) tint.toArray(colors, i * 3);
  g.setAttribute('color', new Float32BufferAttribute(colors, 3));
  // Only what mergeGeometries needs, the same on every part.
  for (const name of Object.keys(g.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'color') g.deleteAttribute(name);
  }
  return g;
}

function merged(parts: BufferGeometry[]): Mesh {
  const mesh = new Mesh(mergeGeometries(parts)!, material);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

/** The floor of the seat hole: packed earth with a ring of flat stones (board cm). */
export function buildSeatFloor(parent: Object3D, rng: Random): Mesh {
  const { color, stoneColor, stoneDarkColor, stones, stonesFrom } = GIANT.floor;
  const r = BOARD.holeRadius;
  const parts: BufferGeometry[] = [];
  // A hair below the courtyard, so it never fights with the grass at the hole's edge.
  const earth = new CircleGeometry(r + 0.3, 40);
  earth.rotateX(-Math.PI / 2);
  earth.translate(0, -0.05, 0);
  parts.push(painted(earth, color));
  for (let i = 0; i < stones; i++) {
    const a = ((i + rng.range(-0.15, 0.15)) / stones) * Math.PI * 2;
    const d = rng.range(stonesFrom, r - 1.6);
    const size = rng.range(2.2, 3.2);
    const stone = new DodecahedronGeometry(size, 0);
    stone.scale(1, 0.18, 0.8);
    stone.rotateY(rng.range(0, Math.PI));
    stone.translate(Math.sin(a) * d, 0.05, -Math.cos(a) * d);
    parts.push(painted(stone, rng.next() < 0.5 ? stoneColor : stoneDarkColor));
  }
  const mesh = merged(parts);
  mesh.name = 'seat floor';
  parent.add(mesh);
  return mesh;
}

/**
 * The giant's body. Three parts, each one merged mesh: the belt at the
 * floor, the tunic stretched up to the chest, and the chest with the
 * shoulders and collar on top.
 */
export class GiantBody {
  readonly root = new Group();
  private belt: Mesh;
  private tunic: Mesh;
  private top: Mesh;
  private yaw = 0;
  private placed = false;
  enabled = true;

  constructor(parent: Object3D) {
    const { waist, chest, shoulders, depthShare, belt, colors } = GIANT;
    const depth = depthShare;
    // Belt: a thick band at the waist with a gold buckle in front (local y 0 is the floor).
    const band = new CylinderGeometry(waist * 1.04, waist * 1.06, belt, 10);
    band.scale(1, 1, depth);
    band.translate(0, belt / 2, 0);
    const buckle = new BoxGeometry(0.045, belt * 0.85, 0.012);
    buckle.translate(0, belt / 2, -waist * depth * 1.04);
    const buckleHole = new BoxGeometry(0.022, belt * 0.4, 0.014);
    buckleHole.translate(0, belt / 2, -waist * depth * 1.05);
    this.belt = merged([painted(band, colors.belt), painted(buckle, colors.buckle), painted(buckleHole, colors.belt)]);
    // Tunic: unit height, scaled up to the chest every frame. A round belly in front, a patch on the side.
    const cloth = new CylinderGeometry(chest, waist, 1, 10, 1);
    cloth.scale(1, 1, depth);
    cloth.translate(0, 0.5, 0);
    const belly = new SphereGeometry(waist * 0.82, 8, 6);
    belly.scale(1, 0.5, 0.62);
    belly.translate(0, 0.35, -waist * depth * 0.62);
    const patch = new BoxGeometry(0.04, 0.12, 0.03);
    patch.rotateY(-0.5);
    patch.translate(chest * 0.8, 0.55, -chest * depth * 0.4);
    this.tunic = merged([painted(cloth, colors.tunic), painted(belly, colors.tunicDark), painted(patch, colors.patch)]);
    // Chest top: rounded shoulders, a collar, a dark neck hole (local y 0 is the shoulder line).
    const ball = shoulders - chest * 0.55;
    const left = new SphereGeometry(ball * 1.15, 7, 5);
    left.scale(1, 0.75, 1.05);
    left.translate(-(shoulders - ball), -ball * 0.3, 0);
    const right = left.clone();
    right.translate(2 * (shoulders - ball), 0, 0);
    const yoke = new CylinderGeometry(chest * 0.62, chest, 0.06, 10, 1);
    yoke.scale(1, 1, depth);
    yoke.translate(0, -0.03, 0);
    const collar = new TorusGeometry(chest * 0.42, 0.02, 4, 10);
    collar.rotateX(Math.PI / 2);
    collar.scale(1, 1, depth * 1.1);
    const neck = new CylinderGeometry(chest * 0.4, chest * 0.42, 0.012, 10);
    neck.scale(1, 1, depth * 1.1);
    neck.translate(0, 0.004, 0);
    this.top = merged([
      painted(left, colors.tunic),
      painted(right, colors.tunic),
      painted(yoke, colors.tunic),
      painted(collar, colors.collar),
      painted(neck, 0x2a2018),
    ]);
    this.root.add(this.belt, this.tunic, this.top);
    this.root.name = 'giant body';
    parent.add(this.root);
  }

  /**
   * Every frame: under the head (smoothed, a little behind it), turned
   * slowly toward where the player faces, stretched from the floor
   * (`floorY`, world meters) up to the shoulders.
   */
  update(dt: number, head: Vector3, forward: Vector3, floorY: number): void {
    this.root.visible = this.enabled;
    if (!this.enabled) return;
    // Where the player faces, level.
    const fx = forward.x;
    const fz = forward.z;
    const flat = Math.hypot(fx, fz);
    const faceYaw = flat > 0.2 ? Math.atan2(-fx, -fz) : this.yaw;
    if (!this.placed) {
      this.yaw = faceYaw;
    } else {
      // Only past a dead zone, and slowly, so a glance to the side never swings the body.
      // No loop: a bad angle can never hang the game.
      const d = angleDelta(this.yaw, faceYaw);
      const dead = (GIANT.turnDeadDeg * Math.PI) / 180;
      if (Math.abs(d) > dead) {
        const k = 1 - Math.exp(-dt / GIANT.turnSmoothing);
        this.yaw += (d - Math.sign(d) * dead) * k;
      }
    }
    this.root.rotation.set(0, this.yaw, 0);
    // A little behind the head, along the body's own facing.
    temp.set(head.x + Math.sin(this.yaw) * GIANT.behind, floorY, head.z + Math.cos(this.yaw) * GIANT.behind);
    if (!this.placed) {
      this.root.position.copy(temp);
      this.placed = true;
    } else {
      const k = 1 - Math.exp(-dt / GIANT.followSmoothing);
      this.root.position.lerp(temp, k);
      this.root.position.y = floorY;
    }
    // The torso fills the gap from the belt to the shoulders.
    const shoulderY = head.y - GIANT.shoulderDrop - floorY;
    const height = Math.max(GIANT.minHeight, shoulderY);
    const chestTop = Math.max(GIANT.belt + 0.01, height - 0.03);
    this.tunic.position.y = GIANT.belt * 0.6;
    this.tunic.scale.set(1, chestTop - GIANT.belt * 0.6, 1);
    this.top.position.y = height;
  }

  /** The next update snaps to the head again (after the board was placed). */
  snap(): void {
    this.placed = false;
  }
}
