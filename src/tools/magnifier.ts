// The magnifying glass (docs/v3-plan.md 2.2, the sun garden). Held in a fist
// and aimed by the head: the beam goes where the head points, never where
// the hand points.
//
//   - Aiming (held, not raised): a light pillar stands up from the aim point
//     with a gold sun ring at its foot, drawn on top. On a target (a seed bed,
//     a plant, a keg) it snaps onto it (aim assist within GLASS.assistDeg of
//     the look), grows, and the target shows Ready. On plain ground or a
//     goblin it is a smaller plain white ring (no assist to goblins: aiming
//     at one is the skill).
//   - Shining (raised in front of the eyes, GLASS.eyeNear to eyeFar, within
//     coneDeg of the look): a solid beam from the lens to the aim point,
//     colored by the time of day, a hum, a sizzle and smoke on a target. The
//     use window (12 s) runs down only while it shines (useTicking).
//     - A bed: grows its plant (GARDEN.growTime), a plant: heals it.
//     - A keg: lights it after GLASS.lightTime.
//     - A goblin without a helmet under the beam: burned after burnTime
//       (pants smoke, poof). A helmet stops it, with nothing special shown.
//     All of it is slower at sunset and slowest at night (never dead).
//   - Haystacks (2.1): lit like a keg (the sun ring snaps to them too).
//   - Sun charge (2.6) comes later.
import { AdditiveBlending, CylinderGeometry, Mesh, MeshBasicMaterial, RingGeometry, Vector3 } from 'three';
import { GLASS, RENDER_ORDER, TOOL_SPOTS, type TimeOfDay } from '../config/game.js';
import type { Goblin } from '../units/goblins.js';
import type { Bed, Garden } from '../world/garden.js';
import { magnifyingGlass } from '../world/shapes.js';
import type { Trigger, Triggers } from '../world/triggers.js';
import { marchToGround, toBoard } from './groundAim.js';
import { HandTool, type ToolParts } from './handTool.js';

const lensWorld = new Vector3();
const headBoard = new Vector3();
const lookBoard = new Vector3();
const hitPoint = new Vector3();
const toTarget = new Vector3();
const world = new Vector3();
const beamFrom = new Vector3();
const beamTo = new Vector3();
const UP = new Vector3(0, 1, 0);

type Aimed = { kind: 'bed'; bed: Bed } | { kind: 'keg'; keg: Trigger } | { kind: 'goblin'; goblin: Goblin } | { kind: 'ground' };

export class Magnifier extends HandTool {
  /** Set by the game every frame: the head (world) and the way it looks. */
  readonly headPosition = new Vector3();
  readonly headForward = new Vector3(0, 0, -1);
  /** Set by the game: the time of day now (slower beam at sunset and night). */
  timeOfDay: () => TimeOfDay = () => 'day';
  garden: Garden | null = null;
  triggers: Triggers | null = null;
  private lensLocal = new Vector3();
  private raised = false;
  private aimAt = new Vector3();
  private aimed: Aimed = { kind: 'ground' };
  /** Beam seconds on the current keg or goblin (reset when the aim moves off it). */
  private burn = 0;
  private burnOn: object | null = null;
  private pillar: Mesh;
  private sun: Mesh;
  private beam: Mesh;
  private sunMaterial: MeshBasicMaterial;
  private beamMaterial: MeshBasicMaterial;
  private smokeTimer = 0;

  constructor(parts: ToolParts) {
    super(
      'glass',
      parts,
      TOOL_SPOTS.leftMiddle,
      { from: GLASS.gripFrom, to: GLASS.gripTo, radius: GLASS.grabRadius },
      GLASS.restLeanDeg,
      GLASS.lensRadius * 0.6,
    );
    const onTop = { transparent: true, depthWrite: false, depthTest: false, fog: false, toneMapped: false };
    this.pillar = new Mesh(new CylinderGeometry(0.5, 0.9, 1, 8, 1, true).translate(0, 0.5, 0), new MeshBasicMaterial({ color: GLASS.pillarColor, opacity: 0.35, blending: AdditiveBlending, ...onTop }));
    this.sunMaterial = new MeshBasicMaterial({ color: GLASS.sunColor, opacity: 0.9, ...onTop });
    this.sun = new Mesh(new RingGeometry(0.75, 1, 24, 1).rotateX(-Math.PI / 2), this.sunMaterial);
    this.beamMaterial = new MeshBasicMaterial({ color: GLASS.dayColor, opacity: 0.8, blending: AdditiveBlending, ...onTop });
    this.beam = new Mesh(new CylinderGeometry(1, 1, 1, 8, 1, true).translate(0, 0.5, 0), this.beamMaterial);
    for (const m of [this.pillar, this.sun, this.beam]) {
      m.renderOrder = RENDER_ORDER.hornAim;
      m.visible = false;
      this.stage.boardSpin.add(m);
    }
  }

  protected build(): void {
    const { group, materials, lens } = magnifyingGlass();
    this.body.add(group);
    this.materials = materials;
    this.lensLocal.copy(lens);
  }

  /** The beam runs down only while the glass is raised (lowering it keeps the rest). */
  protected useTicking(): boolean {
    return this.raised;
  }

  protected resetMotion(): void {
    this.raised = false;
    this.burn = 0;
    this.burnOn = null;
    this.pillar.visible = false;
    this.sun.visible = false;
    this.beam.visible = false;
    this.garden?.setTouch(null, 'idle');
  }

  /** How many times slower than by day the beam works now. */
  private slow(): number {
    const t = this.timeOfDay();
    return t === 'night' ? GLASS.nightSlow : t === 'sunset' ? GLASS.sunsetSlow : 1;
  }

  protected heldUpdate(dt: number): void {
    if (dt <= 0) return;
    // Raised: the lens in front of the eyes, within the look's cone.
    this.bodyToWorld(this.lensLocal, lensWorld);
    toTarget.subVectors(lensWorld, this.headPosition);
    const d = toTarget.length();
    const inCone = d > 0 && toTarget.dot(this.headForward) / d > Math.cos((GLASS.coneDeg * Math.PI) / 180);
    this.raised = inCone && d >= GLASS.eyeNear && d <= GLASS.eyeFar;
    // The gaze, into the board, to the ground.
    toBoard(this.stage.boardSpin, this.headPosition, this.headForward, headBoard, lookBoard);
    if (!marchToGround(headBoard, lookBoard, GLASS.maxRange, GLASS.marchStep, hitPoint)) {
      this.hideAim();
      return;
    }
    this.aimed = this.pick(hitPoint);
    this.drawAim();
    if (this.raised) this.shine(dt);
    else {
      this.beam.visible = false;
      this.burn = 0;
      this.burnOn = null;
    }
  }

  private hideAim(): void {
    this.pillar.visible = false;
    this.sun.visible = false;
    this.beam.visible = false;
    this.aimed = { kind: 'ground' };
    this.garden?.setTouch(null, 'idle');
  }

  /** What the look is on: a bed or keg within the assist cone (snapped), a goblin right under it, or plain ground. */
  private pick(ground: Vector3): Aimed {
    const assist = Math.cos((GLASS.assistDeg * Math.PI) / 180);
    const within = (x: number, y: number, z: number): boolean => {
      toTarget.set(x - headBoard.x, y - headBoard.y, z - headBoard.z).normalize();
      return toTarget.dot(lookBoard) > assist;
    };
    // Look far enough around the ground point for the assist cone at that distance.
    const reach = Math.max(6, headBoard.distanceTo(ground) * Math.tan((GLASS.assistDeg * Math.PI) / 180) * 1.5);
    const bed = this.garden?.nearestBed(ground.x, ground.z, reach) ?? null;
    if (bed && within(bed.position.x, bed.position.y + 1, bed.position.z)) {
      this.aimAt.copy(bed.position);
      return { kind: 'bed', bed };
    }
    // A keg, or a haystack (v3 2.1: fire only), both lit by the beam.
    const keg = this.triggers?.standingNear('keg', ground.x, ground.z, reach) ?? this.triggers?.standingNear('hay', ground.x, ground.z, reach) ?? null;
    if (keg) {
      keg.center(world);
      if (within(world.x, world.y, world.z)) {
        this.aimAt.set(world.x, world.y - 2, world.z);
        return { kind: 'keg', keg };
      }
    }
    this.aimAt.copy(ground);
    for (const g of this.goblins.list) {
      if (!this.goblins.isHittable(g) || g.mode === 'riding') continue;
      const p = g.root.position;
      if (Math.hypot(p.x - ground.x, p.z - ground.z) < GLASS.goblinRadius) return { kind: 'goblin', goblin: g };
    }
    return { kind: 'ground' };
  }

  /** The pillar and the sun ring at the aim point (only while held). */
  private drawAim(): void {
    const target = this.aimed.kind === 'bed' || this.aimed.kind === 'keg';
    this.sun.visible = true;
    this.sun.position.set(this.aimAt.x, this.aimAt.y + 0.5, this.aimAt.z);
    this.sun.scale.setScalar(this.raised ? GLASS.sunRadius * 0.35 : target ? GLASS.sunRadius * 1.25 : GLASS.sunRadius * 0.7);
    this.sun.rotation.y = this.time * 0.8;
    this.sunMaterial.color.setHex(target ? GLASS.sunColor : GLASS.plainColor);
    this.pillar.visible = !this.raised;
    this.pillar.position.copy(this.sun.position);
    this.pillar.scale.set(1, GLASS.pillarHeight, 1);
    const bed = this.aimed.kind === 'bed' ? this.aimed.bed : null;
    this.garden?.setTouch(bed, this.raised ? 'held' : 'ready');
    if (this.aimed.kind !== 'bed' && this.aimed.kind !== 'keg') this.garden?.setTouch(null, 'idle');
  }

  /** The beam is on: it spends the use window and works on what it hits. */
  private shine(dt: number): void {
    if (!this.tryUse()) {
      this.beam.visible = false;
      return;
    }
    const slow = this.slow();
    // The beam from the lens to the aim point, colored by the time of day.
    this.stage.boardSpin.worldToLocal(beamFrom.copy(lensWorld));
    beamTo.set(this.aimAt.x, this.aimAt.y + 0.3, this.aimAt.z);
    const length = beamFrom.distanceTo(beamTo);
    this.beam.visible = true;
    this.beam.position.copy(beamFrom);
    this.beam.quaternion.setFromUnitVectors(UP, toTarget.subVectors(beamTo, beamFrom).normalize());
    const thin = this.aimed.kind === 'ground' ? 0.6 : 1;
    this.beam.scale.set(GLASS.beamRadius * thin, length, GLASS.beamRadius * thin);
    const t = this.timeOfDay();
    this.beamMaterial.color.setHex(t === 'night' ? GLASS.nightColor : t === 'sunset' ? GLASS.sunsetColor : GLASS.dayColor);
    this.beamMaterial.opacity = this.aimed.kind === 'ground' ? 0.45 : 0.8;
    this.audio.play('glassHum', this.stage.boardSpin.localToWorld(world.copy(beamTo)), 0.5, 0.5);
    this.smokeTimer -= dt;
    if (this.smokeTimer <= 0) {
      this.smokeTimer = 0.18;
      this.particles.burst(world, GLASS.smokeColors, 1, 0.04);
    }
    const a = this.aimed;
    if (a.kind === 'bed') {
      this.garden?.shine(a.bed, dt, slow);
      this.audio.play('glassSizzle', world, 0.6, 0.6);
      this.onUse(0);
      return;
    }
    const on = a.kind === 'keg' ? a.keg : a.kind === 'goblin' ? a.goblin : null;
    if (on !== this.burnOn) {
      this.burnOn = on;
      this.burn = 0;
    }
    if (!on) return;
    this.burn += dt / slow;
    this.audio.play('glassSizzle', world, 0.8, 0.4);
    if (a.kind === 'keg' && this.burn >= GLASS.lightTime) {
      a.keg.setOff();
      this.burnOn = null;
      this.onUse(1);
    } else if (a.kind === 'goblin' && this.burn >= GLASS.burnTime) {
      this.burnOn = null;
      const g = a.goblin;
      // A helmet stops it: nothing special shown.
      if (g.helmet || !this.goblins.isHittable(g)) return;
      this.goblins.worldPosition(g, world);
      this.particles.burst(world, GLASS.smokeColors, 8, 0.12);
      this.audio.play('poof', world, 1, 0.05);
      this.goblins.kill(g, true);
      this.onUse(1);
    }
  }

  /** Debug: every bed grows its plant (starts a use like a real beam). */
  debugGrow(): void {
    if (!this.debugStart()) return;
    this.garden?.debugGrowAll();
    this.onUse(1);
  }
}
