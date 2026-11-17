// The magnet (docs/v3-plan.md 2.2): a horseshoe held in a fist, pointed at
// the board like a flashlight. One job: it pulls metal gear (helmets,
// shields, swords, spears) off goblins at middle and far range. It knocks
// nothing out.
//
//   - Aim: a ray from the tips along the way they point meets the ground
//     (src/tools/groundAim.ts); the ring sits there, smoothed so hand shake
//     does not make it jitter. Tilting the magnet changes the distance.
//   - The ring lives in the world: a flat red ring on the ground with a
//     silver ring shrinking to its middle again and again, like a pull,
//     drawn over the hills. Sparks fly from the tips toward it.
//   - A hold, not a spray: a goblin's gear comes off only after the ring has
//     stayed on it MAGNET.holdTime. Its gear glints meanwhile. Then it flies
//     off with a clank (Goblins.strip), the goblin stops a moment and looks at
//     its empty hands, and carries on. Waving the magnet around grabs nothing.
//   - The first pull starts the use window (8 s, then a 20 s recharge).
//   - Never pulls friendly gear (it only looks at goblins), ignores balloon
//     riders and goblins in the air. Diggers (Phase 3) carry no gear.
//   - The bell tower (2.1): the ring held on its bell drops it (Triggers.bellTowerNear).
//   - Package Deal (2.6, a secret ability): the ring held on a standing keg
//     MAGNET.kegPullTime pulls it in (it shakes and glints meanwhile): it
//     lands by the pebble bowl (onKegPulled) and the use window ends.
import { AdditiveBlending, DoubleSide, Group, Mesh, MeshBasicMaterial, Quaternion, RingGeometry, Vector3 } from 'three';
import { MAGNET, RENDER_ORDER, TOOL_SPOTS, TRIGGERS } from '../config/game.js';
import { BOOST } from '../rules/boosts.js';
import type { Goblin } from '../units/goblins.js';
import type { Triggers } from '../world/triggers.js';
import { horseshoeMagnet } from '../world/shapes.js';
import { marchToGround, toBoard } from './groundAim.js';
import { HandTool, type ToolParts } from './handTool.js';

const tipsWorld = new Vector3();
const waveTurn = new Quaternion();
/** A ring geometry faces +z. */
const FACE = new Vector3(0, 0, 1);
const dirWorld = new Vector3();
const origin = new Vector3();
const dir = new Vector3();
const hitPoint = new Vector3();
const world = new Vector3();

export class Magnet extends HandTool {
  private tipsLocal = new Vector3();
  /** Set by the game: where pulled gear flies to (the gear debris's point, board cm); the magnet keeps it on its tips. */
  gearTarget: Vector3 | null = null;
  private pointingLocal = new Vector3();
  /** The ring (board cm), smoothed, and if it is on the ground now. */
  private aimAt = new Vector3();
  private aiming = false;
  private ring: Mesh;
  private inner: Mesh;
  private ringMaterial: MeshBasicMaterial;
  private innerMaterial: MeshBasicMaterial;
  /** How long the ring has been on each goblin with gear (seconds). */
  private dwell = new Map<Goblin, number>();
  private arcTimer = 0;
  private glintTimer = 0;
  /** v3 2.1: the traps (the bell tower's bell is pulled down), and how long the ring has been on a bell. */
  triggers: Triggers | null = null;
  private bellDwell = 0;
  /** v3 2.6: how long the ring has been on a keg (seconds), and which keg. */
  private kegDwell = 0;
  private kegOn: object | null = null;
  /** v3 2.6 Package Deal: a keg was pulled in from this world point (the game puts it by the pebble bowl). */
  onKegPulled: (fromWorld: Vector3) => void = () => {};
  /** v3 2.6 Iron Grip: a goblin's gear came off: how many pieces. */
  onStrip: (pieces: number) => void = () => {};

  constructor(parts: ToolParts) {
    super(
      'magnet',
      parts,
      TOOL_SPOTS.leftMiddle,
      { from: MAGNET.gripFrom, to: MAGNET.gripTo, radius: MAGNET.grabRadius },
      MAGNET.restLeanDeg,
      MAGNET.shoeRadius + 0.6,
    );
    // Drawn over everything (like the stun ring), so the hills never hide it.
    this.ringMaterial = new MeshBasicMaterial({ color: MAGNET.ringColor, transparent: true, opacity: 0.85, depthWrite: false, depthTest: false, fog: false, toneMapped: false });
    this.innerMaterial = new MeshBasicMaterial({ color: MAGNET.ringInnerColor, transparent: true, opacity: 0.8, depthWrite: false, depthTest: false, fog: false, toneMapped: false });
    this.ring = new Mesh(new RingGeometry(0.88, 1, 40, 1).rotateX(-Math.PI / 2), this.ringMaterial);
    this.inner = new Mesh(new RingGeometry(0.9, 1, 40, 1).rotateX(-Math.PI / 2), this.innerMaterial);
    this.ring.renderOrder = RENDER_ORDER.stunWave;
    this.inner.renderOrder = RENDER_ORDER.stunWave;
    this.ring.visible = false;
    this.inner.visible = false;
    this.stage.boardSpin.add(this.ring, this.inner);
    // 2026-11-17: waves of force flowing into the tips while it is held, so it reads as pulling. Kept out of
    // the body (its shelf copies clone the body) and moved with it each frame instead.
    for (let i = 0; i < MAGNET.waveCount; i++) {
      const material = new MeshBasicMaterial({ color: MAGNET.waveColor, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, fog: false, toneMapped: false, side: DoubleSide });
      const wave = new Mesh(new RingGeometry(0.82, 1, 28, 1), material);
      wave.renderOrder = RENDER_ORDER.stunWave;
      this.waves.add(wave);
    }
    this.waves.visible = false;
    this.stage.boardLift.add(this.waves);
  }

  private waves = new Group();
  private waveClock = 0;

  update(dt: number): void {
    super.update(dt);
    const held = this.heldHand !== null;
    this.waves.visible = held;
    if (!held) return;
    this.waveClock += dt;
    this.waves.position.copy(this.body.position);
    this.waves.quaternion.copy(this.body.quaternion);
    this.waves.scale.copy(this.body.scale);
    // Each ring faces along the tips' pointing, starts out in front of them, wide and faint, and is drawn
    // in, shrinking and brightening, until it vanishes into the tips.
    waveTurn.setFromUnitVectors(FACE, this.pointingLocal);
    const n = this.waves.children.length;
    this.waves.children.forEach((child, i) => {
      const wave = child as Mesh;
      const t = (this.waveClock * MAGNET.waveSpeed + i / n) % 1;
      wave.quaternion.copy(waveTurn);
      wave.position.copy(this.tipsLocal).addScaledVector(this.pointingLocal, MAGNET.waveFrom * (1 - t));
      wave.scale.setScalar(MAGNET.waveFar + (MAGNET.waveNear - MAGNET.waveFar) * t);
      (wave.material as MeshBasicMaterial).opacity = MAGNET.waveOpacity * Math.sin(Math.PI * t) * (this.aiming ? 1 : 0.5);
    });
  }

  protected build(): void {
    const { group, materials, tips, pointing } = horseshoeMagnet();
    this.body.add(group);
    this.materials = materials;
    this.tipsLocal.copy(tips);
    this.pointingLocal.copy(pointing);
  }

  protected resetMotion(): void {
    this.aiming = false;
    this.dwell.clear();
    this.bellDwell = 0;
    this.kegDwell = 0;
    this.kegOn = null;
    this.ring.visible = false;
    this.inner.visible = false;
  }

  protected heldUpdate(dt: number): void {
    if (dt <= 0) return;
    // The ray from the tips, the way they point, into the board's frame.
    this.bodyToWorld(this.tipsLocal, tipsWorld);
    // Pulled gear flies here (src/fx/gearDebris.ts).
    if (this.gearTarget) this.stage.boardSpin.worldToLocal(this.gearTarget.copy(tipsWorld));
    dirWorld.copy(this.pointingLocal).transformDirection(this.body.matrixWorld);
    toBoard(this.stage.boardSpin, tipsWorld, dirWorld, origin, dir);
    if (!marchToGround(origin, dir, MAGNET.maxRange, MAGNET.marchStep, hitPoint)) {
      this.aiming = false;
      this.dwell.clear();
      this.ring.visible = false;
      this.inner.visible = false;
      return;
    }
    this.assist(hitPoint);
    // Smoothed, so a shaky hand does not make it jitter (snaps on the first frame).
    if (!this.aiming) this.aimAt.copy(hitPoint);
    else this.aimAt.lerp(hitPoint, 1 - Math.exp(-dt / MAGNET.smoothing));
    this.aiming = true;
    this.drawRing();
    this.pull(dt);
  }

  /**
   * Aim assist (2026-11-17): the magnet is aimed by the hand alone, which shakes more than the head that aims
   * the glass. Near a standing bell tower the ring snaps onto it (it must sit there a whole second); near a
   * goblin still wearing gear it leans part of the way toward it. `at` (board cm) is moved in place.
   */
  private assist(at: Vector3): void {
    const A = MAGNET.assist;
    const tower = this.triggers?.standingNear('bellTower', at.x, at.z, A.bellRadius) ?? null;
    if (tower) {
      tower.center(world);
      at.x = world.x;
      at.z = world.z;
      return;
    }
    let best: Goblin | null = null;
    let bestD = A.goblinRadius;
    for (const g of this.goblins.list) {
      if (!this.goblins.isHittable(g) || g.mode === 'riding' || !this.goblins.hasGear(g)) continue;
      const p = g.root.position;
      const d = Math.hypot(p.x - at.x, p.z - at.z);
      if (d < bestD) {
        bestD = d;
        best = g;
      }
    }
    if (!best) return;
    const p = best.root.position;
    at.x += (p.x - at.x) * A.goblinPull;
    at.z += (p.z - at.z) * A.goblinPull;
  }

  private drawRing(): void {
    const R = MAGNET.ringRadius * BOOST.magnetRadius;
    this.ring.visible = true;
    this.inner.visible = true;
    this.ring.position.set(this.aimAt.x, this.aimAt.y + 0.6, this.aimAt.z);
    this.ring.scale.setScalar(R);
    // The inner ring shrinks to the middle over and over: a pull.
    const t = (this.time / MAGNET.pullCycle) % 1;
    const s = Math.max(0.05, R * (1 - t));
    this.inner.position.copy(this.ring.position);
    this.inner.scale.setScalar(s);
    this.innerMaterial.opacity = 0.8 * (1 - t * 0.6);
  }

  /** Every goblin with gear inside the ring: its dwell grows; at holdTime the gear comes off. */
  private pull(dt: number): void {
    const r2 = (MAGNET.ringRadius * BOOST.magnetRadius) ** 2;
    // Sparks from the tips toward the ring, now and then.
    this.arcTimer -= dt;
    if (this.arcTimer <= 0) {
      this.arcTimer = MAGNET.arcEvery;
      this.particles.burst(tipsWorld, MAGNET.arcColors, 2, 0.05);
    }
    this.glintTimer -= dt;
    const glint = this.glintTimer <= 0;
    if (glint) this.glintTimer = 0.2;
    let any = false;
    // v3 2.1: the ring held on a bell tower's bell: it shakes and glints, then drops (part of the use window).
    const tower = this.triggers?.bellTowerNear(this.aimAt.x, this.aimAt.z, TRIGGERS.bellTower.magnetRadius) ?? null;
    if (tower) {
      any = true;
      this.bellDwell += dt;
      tower.shake(this.time);
      if (glint) this.particles.burst(this.stage.boardSpin.localToWorld(tower.bellAt(world)), MAGNET.clankColors, 1, 0.04);
      if (this.bellDwell >= MAGNET.holdTime && this.tryUse()) {
        this.bellDwell = 0;
        tower.tower.setOff('magnet');
        this.audio.play('magnetClank', tipsWorld, 1, 0.08);
        this.onUse(1);
      }
    } else this.bellDwell = 0;
    // v3 2.6 Package Deal: the ring held on a standing keg pulls it in (it ends the use window).
    const keg = this.triggers?.standingNear('keg', this.aimAt.x, this.aimAt.z, MAGNET.kegRadius) ?? null;
    if (keg !== this.kegOn) {
      this.kegOn = keg;
      this.kegDwell = 0;
    }
    if (keg) {
      any = true;
      this.kegDwell += dt;
      keg.center(world);
      this.stage.boardSpin.localToWorld(world);
      if (glint) this.particles.burst(world, MAGNET.clankColors, 2, 0.05);
      if (this.kegDwell >= MAGNET.kegPullTime && this.tryUse()) {
        this.kegDwell = 0;
        this.kegOn = null;
        keg.pullAway();
        this.particles.burst(world, MAGNET.clankColors, 10, 0.15);
        this.audio.play('magnetClank', world, 1);
        this.onKegPulled(world);
        this.onUse(1);
        this.finishUse();
        return;
      }
    }
    for (const g of this.goblins.list) {
      const p = g.root.position;
      const inside = this.goblins.isHittable(g) && g.mode !== 'riding' && this.goblins.hasGear(g) && (p.x - this.aimAt.x) ** 2 + (p.z - this.aimAt.z) ** 2 < r2;
      if (!inside) {
        this.dwell.delete(g);
        continue;
      }
      any = true;
      const held = (this.dwell.get(g) ?? 0) + dt;
      if (held < MAGNET.holdTime) {
        this.dwell.set(g, held);
        // Its gear glints and rattles while it is pulled.
        if (glint) this.particles.burst(this.goblins.centerWorld(g, world), MAGNET.clankColors, 1, 0.04);
        continue;
      }
      this.dwell.delete(g);
      if (!this.tryUse()) return;
      this.goblins.centerWorld(g, world);
      const pieces = (g.weapon !== 'none' ? 1 : 0) + (g.helmet ? 1 : 0) + (g.shield ? 1 : 0);
      if (this.goblins.strip(g, MAGNET.stripPause)) {
        this.onStrip(pieces);
        this.audio.play('magnetClank', world, 1, 0.08);
        this.particles.burst(tipsWorld, MAGNET.clankColors, 6, 0.12);
        this.onUse(1);
      }
    }
    if (any) this.audio.play('magnetHum', tipsWorld, 0.5, 0.6);
  }

  /** Debug: strips the goblins at the front of the wall area, without hands (starts a use like a real pull). */
  debugPull(): void {
    if (!this.debugStart()) return;
    this.stage.boardLift.localToWorld(world.set(0, 0, -120));
    this.stage.boardSpin.worldToLocal(world);
    let count = 0;
    for (const g of this.goblins.list) {
      const p = g.root.position;
      if (Math.hypot(p.x - world.x, p.z - world.z) < 60 && this.goblins.strip(g, MAGNET.stripPause)) count++;
    }
    this.audio.play('magnetClank', this.stage.boardSpin.localToWorld(world), 1);
    this.onUse(Math.max(1, count));
  }
}
