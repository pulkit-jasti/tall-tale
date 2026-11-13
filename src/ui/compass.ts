// The compass (COMPASS, decided 2026-11-11, made 3D 2026-11-12): an early
// warning of where enemies come from, since sound alone did not tell the
// direction and the red threat arrow only comes once the castle is under
// attack. A brass compass dish on a short post straight in front, out by the
// wall, nearly flat like a compass on a table, in boardLift (it rises with
// the board and never turns). A gold needle points straight ahead of the
// player, so as the board spins, the marks move round it.
//
//   - Rim wedges, COMPASS.segments of them pointing in. Their color is how
//     close the worst thing in that direction is: a camp about to send
//     (amber pulse, its drums), goblins far on the roads (dim red), near
//     (red), at the wall, climbing or inside (bright red, blinking). Their
//     height is how many goblins are there (the 3D part says how many, the
//     color says how close). The wedges beside a threat light one level
//     lower, at the base height.
//   - Little tents on the lip: every camp that is up (a camp still under the
//     ground has none), dim while quiet, amber and bobbing while its drums play.
//   - The middle: the wave ("Wave 2 of 4") and the goblins left in it, on a
//     raised brass boss, a canvas redrawn only when a number changes.
//
// One instanced mesh for the wedges and one for the tents (colors and sizes
// written every frame, no canvas redraw), a dish, a face, a boss, a needle
// and a post. Only looked at, never touched, so it is not in the reach
// check. The red threat arrow stays as the last warning.
import {
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  Shape,
  ShapeGeometry,
  Vector2,
  Vector3,
  type Object3D,
} from 'three';
import { COMPASS as C } from '../config/game.js';
import { degToRad, polarX, polarZ } from '../rules/boardMath.js';
import { post } from '../world/shapes.js';
import { CanvasLabel, drawIcon } from './kit/index.js';

/** Threat levels: none, a camp about to send, goblins far, near, at the wall. */
export type ThreatLevel = 0 | 1 | 2 | 3 | 4;

const matrix = new Matrix4();
const at = new Vector3();
const turn = new Quaternion();
const size = new Vector3();
const Y = new Vector3(0, 1, 0);
const color = new Color();
const colors = C.levelColors.map((c) => new Color(c));
const tentIdle = new Color(C.tentColor);
const tentSending = new Color(C.tentSendingColor);

export class Compass {
  readonly group = new Group();
  /** The dish, tipped toward the player (its local +y up from the face, -z straight ahead). */
  private dish = new Group();
  private wedges: InstancedMesh;
  private tents: InstancedMesh;
  /** This frame: the worst level and the goblins in each direction; the heights shown (they glide). */
  private levels = new Uint8Array(C.segments);
  private counts = new Uint16Array(C.segments);
  private heights = new Float32Array(C.segments).fill(C.barBase);
  /** The camps this frame: their direction (radians, in the player's frame) and whether they are sending. */
  private campAngles: number[] = [];
  private campSending: boolean[] = [];
  private label: CanvasLabel;
  private shownText = '';
  private time = 0;
  /** sin and cos of the board's spin this frame (board points turn into the player's frame). */
  private sin = 0;
  private cos = 1;
  /** Where the wedges stand (their tips) and the tents sit (cm from the middle). */
  private wedgeAt: number;
  private tentAt: number;
  private faceY: number;

  constructor(parent: Object3D) {
    const R = C.radius;
    this.faceY = C.dishDepth * 0.35;
    // The wedges' tails, just inside the lip.
    this.wedgeAt = R - C.lipWidth - C.arrowInset;
    this.tentAt = R - C.lipWidth / 2;
    // The stand: straight in front, a post down to the board; the dish on top, tipped toward the player.
    this.group.position.set(polarX(C.at, 0), C.y, polarZ(C.at, 0));
    this.group.add(post(C.y));
    this.dish.rotation.x = degToRad(C.tiltDeg);
    this.group.add(this.dish);
    // Both sides: the turned bowl's inner faces point the other way.
    const brass = new MeshStandardMaterial({ color: C.brassColor, metalness: 0.55, roughness: 0.4, emissive: C.brassGlow, flatShading: true, side: DoubleSide });
    // The dish: a turned brass bowl, its floor under the face and a raised lip round the edge.
    const profile = [
      new Vector2(0, 0),
      new Vector2(R * 0.92, 0),
      new Vector2(R, C.dishDepth * 0.25),
      new Vector2(R, C.dishDepth),
      new Vector2(R - C.lipWidth, C.dishDepth),
      new Vector2(R - C.lipWidth, this.faceY),
      new Vector2(0, this.faceY),
    ];
    const dish = new Mesh(new LatheGeometry(profile, 40), brass);
    const face = new Mesh(new CircleGeometry(R - C.lipWidth, 40).rotateX(-Math.PI / 2), new MeshBasicMaterial({ color: C.faceColor, fog: false }));
    face.position.y = this.faceY + 0.01;
    // The boss in the middle, with the numbers on its top (flat on it: the eyes look down at it from the seat).
    const boss = new Mesh(new CylinderGeometry(C.bossRadius, C.bossRadius * 1.08, C.bossHeight, 32), brass);
    boss.position.y = this.faceY + C.bossHeight / 2;
    this.label = new CanvasLabel(C.textWidth, C.textHeight, 48);
    this.label.mesh.rotation.x = -Math.PI / 2;
    this.label.mesh.position.set(0, this.faceY + C.bossHeight + 0.02, 0);
    const bossTop = new Mesh(new CircleGeometry(C.bossRadius * 0.94, 32).rotateX(-Math.PI / 2), new MeshBasicMaterial({ color: C.faceColor, fog: false }));
    bossTop.position.y = this.faceY + C.bossHeight + 0.01;
    // The needle: a flat gold diamond from the boss's edge toward straight ahead, a little above the face.
    const needleShape = new Shape();
    needleShape.moveTo(0, 0);
    needleShape.lineTo(C.needleWidth / 2, C.needleLength * 0.3);
    needleShape.lineTo(0, C.needleLength);
    needleShape.lineTo(-C.needleWidth / 2, C.needleLength * 0.3);
    needleShape.closePath();
    const needle = new Mesh(
      new ShapeGeometry(needleShape).rotateX(-Math.PI / 2),
      new MeshBasicMaterial({ color: C.needleColor, fog: false, side: DoubleSide }),
    );
    needle.position.set(0, this.faceY + 0.06, -C.bossRadius + 0.1);
    // A wedge: a triangle pointing in (its tail at the origin, its tip in along +z once placed), standing 1 cm up
    // (scaled to its height; scaled longer and wider for more goblins, reaching in from the lip).
    const wedgeShape = new Shape();
    wedgeShape.moveTo(-C.arrowWidth / 2, 0);
    wedgeShape.lineTo(C.arrowWidth / 2, 0);
    wedgeShape.lineTo(0, -C.arrowLength);
    wedgeShape.closePath();
    const wedgeGeometry = new ExtrudeGeometry(wedgeShape, { depth: 1, bevelEnabled: false }).rotateX(-Math.PI / 2);
    this.wedges = new InstancedMesh(wedgeGeometry, new MeshBasicMaterial({ fog: false, toneMapped: false }), C.segments);
    this.wedges.frustumCulled = false;
    for (let i = 0; i < C.segments; i++) {
      this.wedges.setColorAt(i, colors[0]);
      this.placeWedge(i, C.barBase, 1);
    }
    // A tent: a small four-sided cone, standing on the lip.
    this.tents = new InstancedMesh(
      new ConeGeometry(C.tentRadius, C.tentHeight, 4).translate(0, C.tentHeight / 2, 0),
      new MeshBasicMaterial({ fog: false, toneMapped: false }),
      C.maxCamps,
    );
    this.tents.frustumCulled = false;
    this.tents.count = 0;
    for (let i = 0; i < C.maxCamps; i++) this.tents.setColorAt(i, tentIdle);
    this.dish.add(dish, face, boss, bossTop, this.label.mesh, needle, this.wedges, this.tents);
    this.group.visible = false;
    parent.add(this.group);
  }

  /** Starts a frame: `spin` is the board's turn (Stage.spin). Then add() each threat and camp() each camp, then end(). */
  begin(spin: number): void {
    this.levels.fill(0);
    this.counts.fill(0);
    this.campAngles.length = 0;
    this.campSending.length = 0;
    this.sin = Math.sin(spin);
    this.cos = Math.cos(spin);
  }

  /** A board point (boardSpin cm) as a direction in the player's frame (radians, 0 straight ahead, positive to the right). */
  private angleOf(x: number, z: number): number {
    const lx = x * this.cos + z * this.sin;
    const lz = -x * this.sin + z * this.cos;
    return Math.atan2(lx, -lz);
  }

  /** A threat at a board point (boardSpin cm). Goblins (levels 2 to 4) also count toward the wedge's height. */
  add(x: number, z: number, level: ThreatLevel): void {
    const n = C.segments;
    const i = ((Math.round((this.angleOf(x, z) / (Math.PI * 2)) * n) % n) + n) % n;
    if (level > this.levels[i]) this.levels[i] = level;
    if (level >= 2) this.counts[i]++;
  }

  /** A camp that is up, at a board point (boardSpin cm); `sending`: its drums play. */
  camp(x: number, z: number, sending: boolean): void {
    if (this.campAngles.length >= C.maxCamps) return;
    this.campAngles.push(this.angleOf(x, z));
    this.campSending.push(sending);
  }

  /**
   * Ends the frame: the dish shows it (`shown` false hides the whole compass,
   * outside a battle). `wave` is 1 based (0: before the first wave), `left`
   * the goblins left in it (null between waves).
   */
  end(dt: number, shown: boolean, wave: number, total: number, left: number | null): void {
    this.group.visible = shown;
    if (!shown) return;
    this.time += dt;
    const n = C.segments;
    const blink = 0.55 + 0.45 * Math.sin(this.time * Math.PI * 2 * C.blinkHz);
    const pulse = 0.6 + 0.4 * Math.sin(this.time * Math.PI * 2 * C.pulseHz);
    const glide = 1 - Math.exp(-dt / C.barGlide);
    for (let i = 0; i < n; i++) {
      let level = this.levels[i];
      // The wedges beside a threat light one level lower (an amber one does not spread).
      if (C.spread) {
        const side = Math.max(this.levels[(i + 1) % n], this.levels[(i + n - 1) % n]);
        if (side >= 2 && side - 1 > level) level = side - 1;
      }
      const shade = level === 4 ? blink : level === 1 ? pulse : 1;
      color.copy(colors[level]);
      if (level > 0) color.multiplyScalar(shade);
      this.wedges.setColorAt(i, color);
      // Taller and bigger for more goblins there, gliding to it (the size follows the height).
      const want = C.barBase + C.barPer * Math.min(this.counts[i], C.barMax);
      this.heights[i] += (want - this.heights[i]) * glide;
      const goblins = (this.heights[i] - C.barBase) / C.barPer;
      this.placeWedge(i, this.heights[i], 1 + C.sizePer * goblins);
    }
    this.wedges.instanceMatrix.needsUpdate = true;
    if (this.wedges.instanceColor) this.wedges.instanceColor.needsUpdate = true;
    // The camp tents on the lip; a sending one glows amber and bobs.
    const camps = this.campAngles.length;
    for (let k = 0; k < camps; k++) {
      const a = this.campAngles[k];
      const sending = this.campSending[k];
      const bob = sending ? C.tentBob * (0.5 + 0.5 * Math.sin(this.time * Math.PI * 2 * C.pulseHz * 2 + k)) : 0;
      at.set(Math.sin(a) * this.tentAt, C.dishDepth + bob, -Math.cos(a) * this.tentAt);
      turn.setFromAxisAngle(Y, -a);
      matrix.compose(at, turn, size.set(1, 1, 1));
      this.tents.setMatrixAt(k, matrix);
      color.copy(sending ? tentSending : tentIdle);
      if (sending) color.multiplyScalar(pulse);
      this.tents.setColorAt(k, color);
    }
    this.tents.count = camps;
    this.tents.instanceMatrix.needsUpdate = true;
    if (this.tents.instanceColor) this.tents.instanceColor.needsUpdate = true;
    this.text(wave, total, left);
  }

  /** Places wedge `i`: its tail at the lip, its tip toward the middle, standing `height` cm up, `scale` times as long and wide. */
  private placeWedge(i: number, height: number, scale: number): void {
    // Wedge 0 is straight ahead (local -z), going round to the right (+x).
    const a = (i / C.segments) * Math.PI * 2;
    at.set(Math.sin(a) * this.wedgeAt, this.faceY, -Math.cos(a) * this.wedgeAt);
    // Its tip (local +z) points in to the middle.
    turn.setFromAxisAngle(Y, -a);
    matrix.compose(at, turn, size.set(scale, height, scale));
    this.wedges.setMatrixAt(i, matrix);
  }

  /**
   * The boss's face, drawn only when it changes: the goblins left as one big
   * number (a gold tick between waves and after the last), and a row of
   * dots, one per wave: gold for won, white for the one being fought, hollow to come.
   */
  private text(wave: number, total: number, left: number | null): void {
    const text = `${wave}|${total}|${left ?? '-'}`;
    if (text === this.shownText) return;
    this.shownText = text;
    const fighting = left !== null;
    const won = fighting ? wave - 1 : wave;
    this.label.draw((c, w, h) => {
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      if (fighting) {
        // A skull (Kenney Board Game Icons) in front of the number, so it reads as "goblins left", not a random number.
        const digits = String(left);
        const size = h * (digits.length > 2 ? 0.44 : 0.58);
        c.font = `bold ${Math.round(size)}px sans-serif`;
        const numberWidth = c.measureText(digits).width;
        const headWidth = h * 0.32;
        const gap = h * 0.05;
        const start = Math.max(0, w / 2 - (headWidth + gap + numberWidth) / 2);
        drawIcon(c, 'skull', start, h * 0.43 - headWidth / 2, headWidth, C.iconColor);
        c.textAlign = 'left';
        c.fillStyle = C.numberColor;
        c.lineJoin = 'round';
        c.lineWidth = h * 0.05;
        c.strokeStyle = 'rgba(0, 0, 0, 0.6)';
        c.strokeText(digits, start + headWidth + gap, h * 0.43);
        c.fillText(digits, start + headWidth + gap, h * 0.43);
        c.textAlign = 'center';
      } else if (wave > 0) {
        // Between waves and at the end: a gold tick.
        c.strokeStyle = C.tickColor;
        c.lineWidth = h * 0.1;
        c.lineCap = 'round';
        c.lineJoin = 'round';
        c.beginPath();
        c.moveTo(w / 2 - h * 0.2, h * 0.42);
        c.lineTo(w / 2 - h * 0.05, h * 0.57);
        c.lineTo(w / 2 + h * 0.24, h * 0.22);
        c.stroke();
      }
      // One dot per wave under it.
      const r = h * 0.055;
      const gap = r * 3.2;
      const x0 = w / 2 - ((total - 1) * gap) / 2;
      for (let i = 0; i < total; i++) {
        const x = x0 + i * gap;
        const y = h * 0.86;
        c.beginPath();
        c.arc(x, y, r, 0, Math.PI * 2);
        if (i < won) {
          c.fillStyle = C.dotDoneColor;
          c.fill();
        } else if (fighting && i === wave - 1) {
          c.fillStyle = C.dotNowColor;
          c.fill();
        } else {
          c.strokeStyle = C.dotLaterColor;
          c.lineWidth = r * 0.45;
          c.stroke();
        }
      }
    });
  }

  /** The dish's middle (world), for the tutorial's arrow. */
  centerWorld(out: Vector3): Vector3 {
    this.dish.updateWorldMatrix(true, false);
    return this.dish.localToWorld(out.set(0, C.dishDepth, 0));
  }
}
