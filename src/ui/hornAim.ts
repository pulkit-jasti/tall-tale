// Aiming the war horn (v2, HORN_AIM): while the horn is held (anywhere, so
// nothing covers the view), the head points it (head gaze: Quest 3S has no
// eye tracking). Where the look meets the ground, the spot snaps to the
// nearest road: that is where the knights will go.
//
// The look follows Meta's ray and gaze specs ("Ray casting specs", "Gaze
// specs"): for a head ray the cue lives on the target, not in a long laser,
// and gaze hover is a soft spotlight on the surface with no hard reticle. So,
// on the board where it is easy to see:
//   - a soft glowing pool on the road,
//   - a short light pillar standing up from it (seen over hills),
//   - a see-through ghost banner planted there.
// The spot only moves to a new place once the head has pointed there for
// HORN_AIM.consensusTime (Meta's gaze consensus window), so it never flickers.
// Grey and no banner when no road is in sight: the horn will not lock or blow.
//
// Lifted to the lips, the spot locks: everything turns gold with a click, the
// pillar grows as the call charges, and the path the knights will take lights
// up along the roads (from the wall entry, or from the squad that will move).
//
// Off the road the soft pool is replaced by a clear white ring with a dark
// edge, and an arrow on the ground toward the nearest road.
//
// A few meshes, shown only while aiming. The path is rebuilt only when it locks.
import {
  AdditiveBlending,
  BufferAttribute,
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  DynamicDrawUsage,
  BufferGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  Shape,
  ShapeGeometry,
  Vector3,
} from 'three';
import type { GameAudio } from '../audio/sound.js';
import { HORN_AIM, KNIGHTS, RENDER_ORDER } from '../config/game.js';
import { groundAt } from '../rules/boardMath.js';
import type { RoadPoint } from '../rules/roadRoute.js';
import type { Troops } from '../units/troops.js';
import { knightBanner } from '../world/shapes.js';
import type { Stage } from '../world/stage.js';

const origin = new Vector3();
const ahead = new Vector3();
const dir = new Vector3();
const probe = new Vector3();
const at = new Vector3();
const tangent = new Vector3();
const gaze = new Vector3();
const side = new Vector3();
const WORLD_UP = new Vector3(0, 1, 0);
const KNIGHT_BLUE = KNIGHTS.bannerColor;

/** Vertex alpha from 1 at one end of a geometry's y to 0 at the other (RGBA colors, so three uses vertex alpha). */
function fadeAlongY(geometry: CylinderGeometry | CircleGeometry, radial: boolean): void {
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 4);
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < position.count; i++) {
    minY = Math.min(minY, position.getY(i));
    maxY = Math.max(maxY, position.getY(i));
  }
  for (let i = 0; i < position.count; i++) {
    // A pool: strongest in the middle, soft to nothing at the rim (a falloff, no hard edge). A pillar: from the ground up.
    const a = radial
      ? Math.pow(Math.max(0, 1 - Math.hypot(position.getX(i), position.getY(i))), 1.6)
      : 1 - (position.getY(i) - minY) / Math.max(1e-6, maxY - minY);
    colors.set([1, 1, 1, a], i * 4);
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 4));
}

/** Most points along the path (one ribbon segment between two). */
const PATH_POINTS = 360;

export class HornAim {
  private pillar: Mesh;
  private pillarMaterial: MeshBasicMaterial;
  private pool: Mesh;
  private poolMaterial: MeshBasicMaterial;
  private ghost: Group;
  /** The ghost banner's cloth (gold when locked). */
  private ghostCloth: MeshBasicMaterial;
  /** The path along the roads, shown when locked: a flat ribbon, its points written when it locks. */
  private path: Mesh;
  private pathMaterial: MeshBasicMaterial;
  private pathPositions: Float32Array;
  /** Off the road: the ring at the look and the arrow toward the nearest road (see buildOffRoad). */
  private offRing = new Group();
  private offArrow = new Group();
  private offRingMaterial!: MeshBasicMaterial;
  /** Locked at the lips last frame (the click plays when it locks). */
  private wasLocked = false;
  /** The spot the knights would go to (committed), and where it shows (glides to it). */
  private spot: RoadPoint | null = null;
  private shown = new Vector3();
  private hasShown = false;
  /** A different spot the head points at, and for how long (the consensus window). */
  private candidate: RoadPoint = { road: 0, along: 0 };
  private candidateTime = 0;
  /** What the horn would do there (null: nothing can go). */
  private canGo = false;
  private time = 0;

  constructor(
    private stage: Stage,
    private troops: Troops,
    private audio: GameAudio,
  ) {
    // The pillar: a thin open cylinder standing up from the spot (board cm), fading upward, additive.
    const pillarGeometry = new CylinderGeometry(1, 1, 1, 8, 1, true);
    pillarGeometry.translate(0, 0.5, 0);
    fadeAlongY(pillarGeometry, false);
    this.pillarMaterial = new MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending, color: HORN_AIM.color });
    this.pillar = new Mesh(pillarGeometry, this.pillarMaterial);
    this.pillar.visible = false;
    stage.boardSpin.add(this.pillar);
    // The path: a flat ribbon along the roads (two points per path point), additive.
    this.pathPositions = new Float32Array(PATH_POINTS * 6 * 3);
    const pathGeometry = new BufferGeometry();
    const attribute = new BufferAttribute(this.pathPositions, 3);
    attribute.setUsage(DynamicDrawUsage);
    pathGeometry.setAttribute('position', attribute);
    this.pathMaterial = new MeshBasicMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending, color: HORN_AIM.lockColor });
    this.path = new Mesh(pathGeometry, this.pathMaterial);
    this.path.frustumCulled = false;
    this.path.visible = false;
    stage.boardSpin.add(this.path);
    // The pool: a flat soft disc on the ground (board cm), additive, like the system's gaze spotlight.
    const poolGeometry = new CircleGeometry(1, 28);
    fadeAlongY(poolGeometry, true);
    poolGeometry.rotateX(-Math.PI / 2);
    this.poolMaterial = new MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending, color: HORN_AIM.color });
    this.pool = new Mesh(poolGeometry, this.poolMaterial);
    this.pool.visible = false;
    stage.boardSpin.add(this.pool);
    // The ghost banner: where the knights will plant theirs.
    this.ghost = knightBanner(HORN_AIM.ghostOpacity);
    this.ghost.visible = false;
    this.ghostCloth = this.ghost.userData.cloth as MeshBasicMaterial;
    stage.boardSpin.add(this.ghost);
    this.buildOffRoad();
  }

  /**
   * Off the road: a crisp white ring with a dark edge where the look meets
   * the ground (the faint grey pool was hard to see, headset test), and an
   * arrow on the ground pointing to the nearest road, so the player knows
   * which way to turn. Drawn over the hills (no depth test). Normal blending,
   * so it shows on bright grass too.
   */
  private buildOffRoad(): void {
    // Both sides: the arrow's triangle faces down after it is laid flat.
    const ringMaterial = new MeshBasicMaterial({ color: HORN_AIM.offRoad.color, transparent: true, depthWrite: false, depthTest: false, fog: false, side: DoubleSide });
    const edgeMaterial = new MeshBasicMaterial({ color: HORN_AIM.offRoad.edgeColor, transparent: true, opacity: 0.6, depthWrite: false, depthTest: false, fog: false, side: DoubleSide });
    const ring = new Mesh(new RingGeometry(0.78, 1, 40).rotateX(-Math.PI / 2), ringMaterial);
    const edge = new Mesh(new RingGeometry(0.68, 1.1, 40).rotateX(-Math.PI / 2), edgeMaterial);
    edge.renderOrder = RENDER_ORDER.hornAim;
    ring.renderOrder = RENDER_ORDER.hornAim + 1;
    this.offRing.add(edge, ring);
    this.offRing.visible = false;
    this.offRingMaterial = ringMaterial;
    // The arrow: a flat triangle pointing along +z (toward the road once turned), with a dark edge under it.
    const shape = new Shape();
    shape.moveTo(0, 1);
    shape.lineTo(-0.7, -0.3);
    shape.lineTo(0, -0.05);
    shape.lineTo(0.7, -0.3);
    shape.closePath();
    const arrowGeometry = new ShapeGeometry(shape).rotateX(Math.PI / 2);
    const arrow = new Mesh(arrowGeometry, ringMaterial);
    const arrowEdge = new Mesh(arrowGeometry.clone().scale(1.25, 1, 1.25), edgeMaterial);
    arrowEdge.renderOrder = RENDER_ORDER.hornAim;
    arrow.renderOrder = RENDER_ORDER.hornAim + 1;
    this.offArrow.add(arrowEdge, arrow);
    this.offArrow.visible = false;
    this.stage.boardSpin.add(this.offRing, this.offArrow);
  }

  /** The off-road ring at the look, and the arrow toward the nearest road (or hidden). */
  private showOffRoad(on: boolean): void {
    this.offRing.visible = on;
    this.offArrow.visible = false;
    if (!on) return;
    const O = HORN_AIM.offRoad;
    const s = this.shown;
    const y = groundAt(s.x, s.z) + 0.4;
    this.offRing.position.set(s.x, y, s.z);
    this.offRing.scale.setScalar(O.radius * (1 + 0.08 * Math.sin(this.time * 5)));
    this.offRingMaterial.opacity = 0.9;
    const near = this.troops.roadPointNear(s.x, s.z);
    if (!near) return;
    this.troops.roadPointPosition(near.point, at);
    const dx = at.x - s.x;
    const dz = at.z - s.z;
    const d = Math.hypot(dx, dz);
    if (d < O.radius * 1.5) return;
    // A little out from the ring toward the road, nudging that way.
    const out = O.radius + O.arrowGap + O.arrowBob * (0.5 + 0.5 * Math.sin(this.time * 6));
    const ax = s.x + (dx / d) * out;
    const az = s.z + (dz / d) * out;
    this.offArrow.position.set(ax, groundAt(ax, az) + 0.4, az);
    this.offArrow.rotation.y = Math.atan2(dx, dz);
    this.offArrow.scale.setScalar(O.arrowSize);
    this.offArrow.visible = true;
  }

  /** A road spot is aimed at and a squad can go there: the horn may blow. */
  get valid(): boolean {
    return this.spot !== null && this.canGo;
  }

  /** The aimed road spot, or null. */
  get target(): RoadPoint | null {
    return this.valid ? this.spot : null;
  }

  /** Not aiming: everything hidden, and the next aim starts fresh. */
  hide(): void {
    this.pillar.visible = this.pool.visible = this.ghost.visible = this.path.visible = false;
    this.offRing.visible = this.offArrow.visible = false;
    this.spot = null;
    this.hasShown = false;
    this.candidateTime = 0;
    this.wasLocked = false;
    this.troops.answering = null;
  }

  /**
   * Every frame. `aiming`: the horn is held and has not sounded yet.
   * `locked`: it is at the lips with a spot aimed at (the spot stays put).
   * `charge`: how far the call is (0 to 1, the pillar grows with it).
   * `head` and `forward` are the head's pose (world).
   */
  update(dt: number, aiming: boolean, locked: boolean, charge: number, head: Vector3, forward: Vector3): void {
    if (!aiming) {
      if (this.pool.visible || this.spot) this.hide();
      return;
    }
    this.time += dt;
    let hit: Vector3 | null = null;
    if (!(locked && this.valid)) {
      hit = this.lookHit(head, forward);
      const near = hit ? this.troops.roadPointNear(hit.x, hit.z) : null;
      if (near && near.distance <= HORN_AIM.snapRadius) this.consider(near.point, dt);
      else {
        // Nothing to send them to: grey, no banner.
        this.spot = null;
        this.canGo = false;
        this.troops.answering = null;
      }
    }
    const isLocked = locked && this.valid;
    if (isLocked && !this.wasLocked) this.lock();
    if (!isLocked && this.wasLocked) this.path.visible = false;
    this.wasLocked = isLocked;
    this.show(dt, hit, isLocked, charge);
  }

  /** It locks: a click, and the path the knights will take lights up along the roads. */
  private lock(): void {
    const spot = this.spot;
    if (!spot) return;
    this.audio.play('readyTick', this.stage.boardSpin.localToWorld(this.troops.roadPointPosition(spot, at)), 1);
    const legs = this.troops.previewLegs(spot);
    if (!legs) return;
    // Points every pathStep cm along each stretch of road, as a flat ribbon just above it.
    let n = 0;
    const half = HORN_AIM.pathWidth / 2;
    const p = this.pathPositions;
    let hasPrev = false;
    const prevL = new Vector3();
    const prevR = new Vector3();
    for (const leg of legs) {
      const road = this.troops.road(leg.road);
      const length = Math.abs(leg.to - leg.from);
      const steps = Math.max(1, Math.ceil(length / HORN_AIM.pathStep));
      for (let i = 0; i <= steps && n < PATH_POINTS; i++) {
        const d = leg.from + ((leg.to - leg.from) * i) / steps;
        road.pointAt(d, 0, at);
        road.directionAt(d, tangent);
        // Across the road: the flat perpendicular of its direction.
        const sx = -tangent.z * half;
        const sz = tangent.x * half;
        const y = at.y + HORN_AIM.pathLift;
        if (hasPrev) {
          // Two triangles from the last pair of points to this one.
          p.set([prevL.x, prevL.y, prevL.z, prevR.x, prevR.y, prevR.z, at.x + sx, y, at.z + sz], n * 18);
          p.set([prevR.x, prevR.y, prevR.z, at.x - sx, y, at.z - sz, at.x + sx, y, at.z + sz], n * 18 + 9);
          n++;
        }
        prevL.set(at.x + sx, y, at.z + sz);
        prevR.set(at.x - sx, y, at.z - sz);
        hasPrev = true;
      }
    }
    const geometry = this.path.geometry;
    geometry.attributes.position.needsUpdate = true;
    geometry.setDrawRange(0, n * 6);
    this.path.visible = n > 0;
  }

  /** Where the look ray meets the ground on the battlefield (board cm), or null (the sky, the castle, past the edge). */
  private lookHit(head: Vector3, forward: Vector3): Vector3 | null {
    const board = this.stage.boardSpin;
    // The eyes rest a little below where the head points (HORN_AIM.gazeDropDeg): the ray is tilted down by that much.
    gaze.copy(forward).normalize();
    side.crossVectors(gaze, WORLD_UP);
    if (side.lengthSq() > 1e-4) gaze.applyAxisAngle(side.normalize(), -(HORN_AIM.gazeDropDeg * Math.PI) / 180);
    board.worldToLocal(origin.copy(head));
    board.worldToLocal(ahead.copy(head).add(gaze));
    dir.subVectors(ahead, origin).normalize();
    if (dir.y > -0.02) return null;
    for (let t = 0; t < HORN_AIM.maxRadius * 2; t += HORN_AIM.rayStep) {
      probe.copy(origin).addScaledVector(dir, t);
      const r = Math.hypot(probe.x, probe.z);
      if (r > HORN_AIM.maxRadius) return null;
      if (probe.y <= groundAt(probe.x, probe.z)) return r >= HORN_AIM.minRadius ? probe : null;
    }
    return null;
  }

  /** A road spot pointed at: it takes over at once if close, or after the consensus window if it is somewhere new. */
  private consider(point: RoadPoint, dt: number): void {
    const current = this.spot;
    if (current) {
      const sameRoad = current.road === point.road;
      const moved = sameRoad ? Math.abs(current.along - point.along) : Infinity;
      if (moved < HORN_AIM.moveAtLeast) {
        current.along = point.along;
        this.candidateTime = 0;
        return;
      }
      const sameCandidate = this.candidate.road === point.road && Math.abs(this.candidate.along - point.along) < HORN_AIM.moveAtLeast;
      this.candidateTime = sameCandidate ? this.candidateTime + dt : 0;
      this.candidate.road = point.road;
      this.candidate.along = point.along;
      if (this.candidateTime < HORN_AIM.consensusTime) return;
    }
    this.candidateTime = 0;
    this.spot = { road: point.road, along: point.along };
    const plan = this.troops.plan(this.spot);
    this.canGo = plan !== null;
    this.troops.answering = plan?.kind === 'move' ? plan.squad : null;
  }

  /** The pool, the pillar and the ghost banner at the spot (grey without one, gold when locked), and the path's pulse. */
  private show(dt: number, hit: Vector3 | null, locked: boolean, charge: number): void {
    const color = locked ? HORN_AIM.lockColor : this.valid ? HORN_AIM.color : HORN_AIM.noneColor;
    this.pillarMaterial.color.setHex(color);
    this.poolMaterial.color.setHex(color);
    this.ghostCloth.color.setHex(locked ? HORN_AIM.lockColor : KNIGHT_BLUE);
    this.ghostCloth.opacity = locked ? 0.95 : HORN_AIM.ghostOpacity;
    if (this.path.visible) this.pathMaterial.opacity = HORN_AIM.pathOpacity * (0.75 + 0.25 * Math.sin(this.time * 6));
    // The pool: at the road spot, or grey where the look meets the ground.
    const spot = this.spot;
    if (spot) this.troops.roadPointPosition(spot, probe);
    else if (hit) probe.copy(hit);
    const where = spot || hit;
    if (where) {
      if (!this.hasShown) this.shown.copy(probe);
      else this.shown.lerp(probe, 1 - Math.exp(-dt / HORN_AIM.glide));
      this.hasShown = true;
      this.pool.position.set(this.shown.x, groundAt(this.shown.x, this.shown.z) + 0.3, this.shown.z);
      this.pool.scale.setScalar(HORN_AIM.poolRadius);
      this.poolMaterial.opacity = HORN_AIM.poolOpacity * (1 - HORN_AIM.poolPulse + HORN_AIM.poolPulse * Math.sin(this.time * 4));
      // On a road: the soft pool. Off it: the clear ring and the arrow to the nearest road instead.
      this.pool.visible = !!spot;
      this.showOffRoad(!spot);
    } else {
      this.pool.visible = false;
      this.showOffRoad(false);
    }
    // The ghost banner where they would plant theirs.
    this.ghost.visible = this.valid;
    const ground = groundAt(this.shown.x, this.shown.z);
    if (this.valid) {
      this.ghost.position.set(this.shown.x, ground, this.shown.z);
      // Its cloth trails toward the castle, as if planted facing the enemy.
      this.ghost.rotation.y = Math.atan2(this.shown.x, this.shown.z);
    }
    // The pillar: up from the spot, taller as the call charges once locked, so it reads over the hills.
    this.pillar.visible = this.valid;
    if (this.valid) {
      const height = HORN_AIM.pillarHeight * (locked ? 1 + HORN_AIM.pillarGrow * charge : 1);
      this.pillar.position.set(this.shown.x, ground, this.shown.z);
      this.pillar.scale.set(HORN_AIM.pillarRadius, height, HORN_AIM.pillarRadius);
      this.pillarMaterial.opacity = HORN_AIM.pillarOpacity * (locked ? 1 : 0.8 + 0.2 * Math.sin(this.time * 4));
    }
  }
}
