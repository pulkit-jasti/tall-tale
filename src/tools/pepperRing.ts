// The pepper ring (docs/v3-plan.md 2.2, "Pepper: a new job"): pepper shaken
// onto the ground just outside the wall stays there. The band is split into
// PEPPER_RING.segments segments of 45 degrees, fixed on the board (they turn
// with it, matching the compass directions), so the back is peppered by
// cranking it to the front: shake, crank, shake.
//
//   - Filling: about PEPPER_RING.fillTime of shaking over one segment fills
//     it. The shaker (src/tools/pepperShaker.ts) tells where its pepper lands
//     (shake) and where it is held over (hover), in board cm.
//   - Used up or gone, whichever comes first: a full segment lasts lastTime
//     and blinks for its last blinkTime. Each goblin walking through breathes
//     some in (seasoned and sneezing, Goblins.pepper) and uses up goblinUse.
//     A digger (Phase 3) will use up the whole segment (useAll).
//   - What is seen: nothing on empty ground; a faint orange outline under
//     the shaker; red flecks piling up as it fills; a solid red-orange strip
//     when full (sparkle and ding), thinning flecks and a paler strip as it is
//     used; a puff and a sizzle when it is gone. Unlit, so it reads at night.
//   - The compass shows a thin orange arc on its lip for each peppered
//     segment (Compass.pepper), so the back can be checked without turning.
//
// Cheap: 8 flat strips (one material each) and one instanced mesh of flecks,
// whose matrices change only when a segment's fleck count changes.
import {
  BoxGeometry,
  DoubleSide,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  RingGeometry,
  Vector3,
} from 'three';
import type { GameAudio } from '../audio/sound.js';
import { PEPPER_RING } from '../config/game.js';
import type { Particles } from '../fx/particles.js';
import { angleOf, groundAt, polarX, polarZ } from '../rules/boardMath.js';
import { createRandom } from '../rules/random.js';
import type { Compass } from '../ui/compass.js';
import type { Goblins } from '../units/goblins.js';
import type { Stage } from '../world/stage.js';

const R = PEPPER_RING;
const STEP = (Math.PI * 2) / R.segments;
const matrix = new Matrix4();
const hidden = new Matrix4().makeScale(0, 0, 0);
const turn = new Quaternion();
const UP = new Vector3(0, 1, 0);
const at = new Vector3();
const scale = new Vector3();
const world = new Vector3();

interface Segment {
  strip: Mesh;
  material: MeshBasicMaterial;
  /** 0 to 1 while filling (not full yet). */
  fill: number;
  /** Shaken this frame (the fill drains when not). */
  shaken: boolean;
  /** 0 to 1 once full: what is left to breathe in; 0 is empty. */
  amount: number;
  /** Seconds left while full. */
  left: number;
  /** Flecks shown now. */
  flecks: number;
  /** The fleck spots in this segment (board cm), made once. */
  spots: Vector3[];
  /** The ground height under it (cm). */
  y: number;
}

/** The segment a board angle falls in (segment 0 centered on the board's front). */
export function segmentOf(angle: number): number {
  const n = R.segments;
  return ((Math.round(angle / STEP) % n) + n) % n;
}

export class PepperRing {
  private segments: Segment[] = [];
  private flecks: InstancedMesh;
  private hover = -1;
  private time = 0;

  constructor(
    private stage: Stage,
    private goblins: Goblins,
    private audio: GameAudio,
    private particles: Particles,
    private compass: Compass,
  ) {
    const rng = createRandom(7311);
    const mid = (R.inner + R.outer) / 2;
    const gap = (R.gapDeg * Math.PI) / 180;
    for (let i = 0; i < R.segments; i++) {
      const center = i * STEP;
      // A flat arc on the ground. RingGeometry's angle 90 degrees is straight ahead (-z) once laid flat;
      // turning it by -center points it at the segment.
      const material = new MeshBasicMaterial({ color: R.outlineColor, transparent: true, opacity: 0, depthWrite: false, side: DoubleSide, toneMapped: false, fog: false });
      const strip = new Mesh(new RingGeometry(R.inner, R.outer, 10, 1, Math.PI / 2 - STEP / 2 + gap / 2, STEP - gap).rotateX(-Math.PI / 2), material);
      const y = groundAt(polarX(mid, center), polarZ(mid, center));
      strip.position.y = y + R.lift;
      strip.rotation.y = -center;
      strip.visible = false;
      strip.renderOrder = 2;
      stage.boardSpin.add(strip);
      const spots: Vector3[] = [];
      for (let k = 0; k < R.flecks; k++) {
        const a = center + rng.range(-0.45, 0.45) * (STEP - gap);
        const r = rng.range(R.inner + 0.6, R.outer - 0.6);
        const x = polarX(r, a);
        const z = polarZ(r, a);
        spots.push(new Vector3(x, groundAt(x, z) + R.lift + R.fleckSize * 0.4, z));
      }
      this.segments.push({ strip, material, fill: 0, shaken: false, amount: 0, left: 0, flecks: 0, spots, y });
    }
    this.flecks = new InstancedMesh(new BoxGeometry(1, 0.5, 1), new MeshBasicMaterial({ color: R.fleckColor, toneMapped: false, fog: false }), R.segments * R.flecks);
    this.flecks.frustumCulled = false;
    for (let i = 0; i < R.segments * R.flecks; i++) this.flecks.setMatrixAt(i, hidden);
    stage.boardSpin.add(this.flecks);
  }

  /** True if a board point (cm) is over the band. */
  private inBand(x: number, z: number): boolean {
    const r = Math.hypot(x, z);
    return r >= R.inner - R.goblinSlack && r <= R.outer;
  }

  /** The shaker is held over a board point (cm) this frame: its segment shows a faint outline. */
  hoverAt(x: number, z: number): void {
    this.hover = this.inBand(x, z) ? segmentOf(angleOf(x, z)) : -1;
  }

  /** Pepper lands on a board point (cm) for `dt` seconds: the segment under it fills (or tops up when full). */
  shake(x: number, z: number, dt: number): void {
    if (!this.inBand(x, z)) return;
    const s = this.segments[segmentOf(angleOf(x, z))];
    s.shaken = true;
    if (s.amount > 0) {
      // Shaking a full segment again tops it up.
      s.amount = 1;
      s.left = R.lastTime;
      return;
    }
    s.fill = Math.min(1, s.fill + dt / R.fillTime);
    if (s.fill >= 1) this.fillUp(s);
  }

  /** Debug: fills the segment now at the front of the board (and its neighbors if `wide`). */
  debugFillFront(wide: boolean): void {
    // The board point straight in front of the player, outside the wall.
    this.stage.boardLift.localToWorld(world.set(0, 0, -(R.inner + R.outer) / 2));
    this.stage.boardSpin.worldToLocal(world);
    const front = segmentOf(angleOf(world.x, world.z));
    const list = wide ? [front - 1, front, front + 1] : [front];
    for (const i of list) this.fillUp(this.segments[(i + R.segments) % R.segments]);
  }

  /** A digger (Phase 3) tunnels into a peppered segment at a board angle: it uses all of it. Returns true if it was peppered. */
  useAll(angle: number): boolean {
    const s = this.segments[segmentOf(angle)];
    if (s.amount <= 0) return false;
    this.empty(s);
    return true;
  }

  /** A new battle: every segment empty. */
  reset(): void {
    for (const s of this.segments) {
      s.fill = 0;
      s.amount = 0;
      s.left = 0;
      s.strip.visible = false;
      this.setFlecks(s, 0);
    }
    this.flecks.instanceMatrix.needsUpdate = true;
    this.hover = -1;
  }

  private fillUp(s: Segment): void {
    s.fill = 0;
    s.amount = 1;
    s.left = R.lastTime;
    this.stage.boardSpin.localToWorld(this.centerOf(s, world));
    this.particles.burst(world, R.sparkleColors, 10, 0.12);
    this.audio.play('pepperRingFull', world, 1, 0.2);
  }

  private empty(s: Segment): void {
    s.amount = 0;
    s.left = 0;
    this.stage.boardSpin.localToWorld(this.centerOf(s, world));
    this.particles.burst(world, R.puffColors, 12, 0.1);
    this.audio.play('pepperRingGone', world, 1, 0.2);
  }

  private centerOf(s: Segment, out: Vector3): Vector3 {
    const i = this.segments.indexOf(s);
    const mid = (R.inner + R.outer) / 2;
    return out.set(polarX(mid, i * STEP), s.y + 1, polarZ(mid, i * STEP));
  }

  update(dt: number): void {
    this.time += dt;
    // Goblins walking through a peppered segment breathe it in.
    for (const g of this.goblins.list) {
      if (g.seasoned || (g.mode !== 'walking' && g.mode !== 'toWall' && g.mode !== 'atWall')) continue;
      const p = g.root.position;
      if (!this.inBand(p.x, p.z)) continue;
      const s = this.segments[segmentOf(angleOf(p.x, p.z))];
      if (s.amount <= 0 || !this.goblins.pepper(g)) continue;
      s.amount -= R.goblinUse;
      if (s.amount <= 1e-3) this.empty(s);
    }
    let changed = false;
    for (let i = 0; i < R.segments; i++) {
      const s = this.segments[i];
      if (!s.shaken && s.fill > 0) s.fill = Math.max(0, s.fill - R.drain * dt);
      s.shaken = false;
      if (s.amount > 0) {
        s.left -= dt;
        if (s.left <= 0) this.empty(s);
      }
      // The look: full (blinking at the end), or an outline while filling or under the shaker.
      const m = s.material;
      if (s.amount > 0) {
        const blinkOff = s.left < R.blinkTime && Math.sin(this.time * Math.PI * 2 * R.blinkHz) < 0;
        s.strip.visible = !blinkOff;
        m.color.setHex(R.fullColor);
        // Paler as it is breathed in.
        m.opacity = R.fullOpacity * (0.45 + 0.55 * s.amount);
      } else if (s.fill > 0 || i === this.hover) {
        s.strip.visible = true;
        m.color.setHex(R.outlineColor);
        m.opacity = R.outlineOpacity;
      } else {
        s.strip.visible = false;
      }
      const want = Math.round((s.amount > 0 ? s.amount : s.fill) * R.flecks);
      if (want !== s.flecks) {
        this.setFlecks(s, want);
        changed = true;
      }
      this.compass.pepper(i, s.amount > 0 ? Math.max(0.25, s.amount) : 0);
    }
    if (changed) this.flecks.instanceMatrix.needsUpdate = true;
    this.hover = -1;
  }

  /** Shows `count` flecks in a segment (the rest hidden). */
  private setFlecks(s: Segment, count: number): void {
    const i = this.segments.indexOf(s);
    for (let k = 0; k < R.flecks; k++) {
      if (k < count) {
        const spot = s.spots[k];
        turn.setFromAxisAngle(UP, k * 1.7);
        matrix.compose(at.copy(spot), turn, scale.setScalar(R.fleckSize));
        this.flecks.setMatrixAt(i * R.flecks + k, matrix);
      } else {
        this.flecks.setMatrixAt(i * R.flecks + k, hidden);
      }
    }
    s.flecks = count;
  }
}
