// Sugar cubes (docs/v3-plan.md 2.2): a bowl of cubes on a platform, like the
// pebble bowl. Pinch a cube off the pile and toss it near the wall, or bring
// it to the slingshot's pouch (it clicks in) and shoot it far. Where it
// lands it becomes a lure: goblins on the ground near it stop to eat it for
// a few seconds (SUGAR.eatTime), up to SUGAR.feeds goblins or SUGAR.lureTime.
//
//   - A HandTool for its platform, its ring (3 pips, one per cube) and its
//     recharge, but the bowl itself is never picked up (reach is null). The
//     first cube taken starts the use; each cube let go spends a pip.
//   - Lured goblins stop where they are, turned toward the cube (they never
//     leave the roads, so no new walking): pull a group next to a keg, or
//     hold it on a bridge (2.1), then set it off.
//   - Spicy sugar (2.6, a secret ability): pepper shaken onto a held cube or
//     a lure (pepperAt) makes it spicy (reddish); goblins that eat a spicy
//     cube are seasoned. It stays spicy through the pouch and the shot.
import { BoxGeometry, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { SUGAR, TOOL_SPOTS } from '../config/game.js';
import { BOOST } from '../rules/boosts.js';
import type { HandState } from '../player/hands.js';
import { landingHeight, zoneAt } from '../rules/boardMath.js';
import { flatMaterial, sugarBowl } from '../world/shapes.js';
import { HandTool, type ToolParts } from './handTool.js';
import type { Slingshot } from './slingshot.js';

const top = new Vector3();
const world = new Vector3();
const board = new Vector3();

interface HeldCube {
  hand: HandState;
  mesh: Mesh;
  /** The pinch point last frame (board cm) and the smoothed speed (cm per second). */
  last: Vector3;
  velocity: Vector3;
  /** v3 2.6: pepper on it so far (seconds), and spicy once it reached SUGAR.pepperTime. */
  pepper: number;
  spicy: boolean;
}

interface FlyingCube {
  mesh: Mesh;
  position: Vector3;
  velocity: Vector3;
  spicy: boolean;
}

interface Lure {
  mesh: Mesh;
  position: Vector3;
  left: number;
  feeds: number;
  pepper: number;
  spicy: boolean;
}

export class SugarBowl extends HandTool {
  private topLocal = new Vector3();
  private pile: Mesh[] = [];
  private held: HeldCube[] = [];
  private flying: FlyingCube[] = [];
  private lures: Lure[] = [];
  private cubeMaterial: MeshStandardMaterial;
  private spicyMaterial: MeshStandardMaterial;
  private cubeGeometry: BoxGeometry;
  private crumbTimer = 0;
  /** v3 2.6 Secret Recipe: a goblin ate a spicy cube and is seasoned now. */
  onSpicyEaten: () => void = () => {};

  constructor(parts: ToolParts) {
    super('sugar', parts, TOOL_SPOTS.leftMiddle, { from: 0, to: 0, radius: 0 }, 0, SUGAR.bowlRadius + 0.6);
    this.cubeMaterial = flatMaterial(SUGAR.cubeColor);
    this.spicyMaterial = flatMaterial(SUGAR.spicyColor);
    this.cubeGeometry = new BoxGeometry(SUGAR.cubeSize, SUGAR.cubeSize, SUGAR.cubeSize);
  }

  protected build(): void {
    const { group, materials, top: pileTop, cubes } = sugarBowl();
    this.body.add(group);
    this.materials = materials;
    this.topLocal.copy(pileTop);
    this.pile = cubes;
  }

  /** The bowl is never picked up: cubes are pinched off it (updateHands). */
  reach(): number | null {
    return null;
  }

  isBusy(hand: HandState): boolean {
    return this.held.some((h) => h.hand === hand);
  }

  protected resetMotion(): void {}

  protected heldUpdate(): void {}

  /** A cube mesh in the board (boardSpin cm). */
  private cube(): Mesh {
    const mesh = new Mesh(this.cubeGeometry, this.cubeMaterial);
    this.stage.boardSpin.add(mesh);
    return mesh;
  }

  /**
   * Every frame with the hands: a pinch at the pile takes a cube (it follows
   * the pinch); opening the pinch at the pouch loads it, anywhere else tosses it.
   */
  updateHands(hands: HandState[], busy: (hand: HandState) => boolean, slingshot: Slingshot, dt: number): void {
    if (!this.visible) return;
    this.bodyToWorld(this.topLocal, top);
    for (const hand of hands) {
      const h = this.held.find((c) => c.hand === hand);
      if (h) {
        this.stage.boardSpin.worldToLocal(board.copy(hand.pinchPoint));
        if (dt > 0) h.velocity.lerp(world.subVectors(board, h.last).divideScalar(dt), 1 - Math.exp(-dt / 0.05));
        h.last.copy(board);
        h.mesh.position.copy(board);
        if (hand.tracked && hand.pinch.on) continue;
        // Let go: into the pouch, or tossed with the hand's speed.
        this.held.splice(this.held.indexOf(h), 1);
        if (slingshot.loadCube(hand, h.spicy)) {
          h.mesh.removeFromParent();
        } else {
          this.flying.push({ mesh: h.mesh, position: board.clone(), velocity: h.velocity.clone().multiplyScalar(SUGAR.tossKeep), spicy: h.spicy });
        }
        this.spendOne();
        continue;
      }
      if (!hand.tracked || !hand.pinch.started || busy(hand)) continue;
      if (hand.pinchPoint.distanceTo(top) > SUGAR.pinchRadius * this.stage.boardScale) continue;
      if (!this.tryUseNow()) continue;
      const mesh = this.cube();
      this.stage.boardSpin.worldToLocal(board.copy(hand.pinchPoint));
      mesh.position.copy(board);
      this.held.push({ hand, mesh, last: board.clone(), velocity: new Vector3(), pepper: 0, spicy: false });
      this.audio.play('grab', hand.pinchPoint);
      this.onGrab();
    }
  }

  /** A shot cube landed (the slingshot): a lure there (spicy if it was peppered). */
  landAt(x: number, y: number, z: number, spicy = false): void {
    const mesh = this.cube();
    if (spicy) mesh.material = this.spicyMaterial;
    this.addLure(new Vector3(x, y, z), mesh, spicy);
  }

  /**
   * v3 2.6 Spicy sugar: pepper falls at a board point (cm) for dt seconds
   * (the pepper shaker, while shaking). A held cube or a lure under it turns spicy.
   */
  pepperAt(at: Vector3, dt: number): void {
    const r2 = SUGAR.pepperRadius * SUGAR.pepperRadius;
    const under = (p: Vector3): boolean => (p.x - at.x) ** 2 + (p.z - at.z) ** 2 < r2 && p.y < at.y + 1;
    for (const c of [...this.held, ...this.lures]) {
      if (c.spicy || !under(c.mesh.position)) continue;
      c.pepper += dt;
      if (c.pepper < SUGAR.pepperTime) continue;
      c.spicy = true;
      c.mesh.material = this.spicyMaterial;
      this.particles.burst(this.stage.boardSpin.localToWorld(world.copy(c.mesh.position)), [0xd23c28, 0xffffff, 0x2a2018], 6, 0.05);
      this.audio.play('sneeze', world, 0.5, 0.3);
    }
  }

  private addLure(at: Vector3, mesh: Mesh, spicy = false): void {
    mesh.position.copy(at).setY(at.y + SUGAR.cubeSize / 2);
    this.lures.push({ mesh, position: at.clone(), left: SUGAR.lureTime * BOOST.sugar, feeds: SUGAR.feeds, pepper: 0, spicy });
    this.particles.burst(this.stage.boardSpin.localToWorld(world.copy(mesh.position)), SUGAR.crumbColors, 6, 0.08);
    this.audio.play('sugarLand', world, 1, 0.1);
    this.onUse(1);
  }

  update(dt: number): void {
    super.update(dt);
    // The pile shows the cubes left in this charge.
    const left = this.recharging ? 0 : this.active ? Math.ceil(this.use.useLeft - 1e-6) : this.pile.length;
    this.pile.forEach((c, i) => (c.visible = i < left));
    // Tossed cubes fly in a simple arc and land as a lure.
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const f = this.flying[i];
      f.velocity.y -= SUGAR.gravity * dt;
      f.position.addScaledVector(f.velocity, dt);
      f.mesh.position.copy(f.position);
      f.mesh.rotation.x += dt * 8;
      // Over the hole the giant sits in it flies on (2026-11-17: a cube tossed by hand starts right above it,
      // read as "off the board" and vanished at once, so only the slingshot ever made a lure).
      const overHole = zoneAt(Math.hypot(f.position.x, f.position.z)) === 'hole';
      const ground = overHole ? null : landingHeight(f.position.x, f.position.z);
      if ((ground === null && !overHole) || f.position.y < -50) {
        f.mesh.removeFromParent();
        this.flying.splice(i, 1);
        continue;
      }
      if (ground !== null && f.position.y <= ground) {
        f.position.y = ground;
        f.mesh.rotation.set(0, f.mesh.rotation.y, 0);
        this.flying.splice(i, 1);
        this.addLure(f.position, f.mesh, f.spicy);
      }
    }
    this.updateLures(dt);
  }

  /** Goblins near a lure stop to eat it, turned toward it. */
  private updateLures(dt: number): void {
    if (this.lures.length === 0) return;
    const r2 = SUGAR.radius * SUGAR.radius;
    this.crumbTimer -= dt;
    const crumbs = this.crumbTimer <= 0;
    if (crumbs) this.crumbTimer = 0.4;
    for (let i = this.lures.length - 1; i >= 0; i--) {
      const lure = this.lures[i];
      lure.left -= dt;
      for (const g of this.goblins.list) {
        if (lure.feeds <= 0) break;
        if (g.lure || g.paused > 0 || g.stunned > 0 || !this.goblins.isHittable(g)) continue;
        const p = g.root.position;
        const dx = lure.position.x - p.x;
        const dz = lure.position.z - p.z;
        if (dx * dx + dz * dz > r2) continue;
        // 2026-11-17: it walks right up to the cube (off its road), eats, and goes back; on the rampart too.
        if (!this.goblins.lureTo(g, lure.position, SUGAR.eatTime * BOOST.sugar)) continue;
        this.goblins.credit(g, 'sugar');
        lure.feeds--;
        // v3 2.6 Spicy sugar: a spicy cube seasons the goblins that eat it.
        if (lure.spicy && this.goblins.pepper(g)) this.onSpicyEaten();
      }
      if (crumbs) this.particles.burst(this.stage.boardSpin.localToWorld(world.copy(lure.mesh.position)), SUGAR.crumbColors, 1, 0.04);
      // It shrinks as it is eaten.
      lure.mesh.scale.setScalar(Math.max(0.3, lure.feeds / SUGAR.feeds));
      if (lure.left <= 0 || (lure.feeds <= 0 && lure.left < (SUGAR.lureTime - SUGAR.eatTime) * BOOST.sugar)) {
        lure.mesh.removeFromParent();
        this.lures.splice(i, 1);
      }
    }
  }

  /** A new battle (or the tool hidden): no cubes in hands, in the air or on the ground. */
  clearCubes(): void {
    for (const c of [...this.held, ...this.flying, ...this.lures]) c.mesh.removeFromParent();
    this.held = [];
    this.flying = [];
    this.lures = [];
  }

  setVisible(visible: boolean): void {
    super.setVisible(visible);
    if (!visible) this.clearCubes();
  }

  /** Debug: a lure on the road straight in front, about 100 cm out (starts a use like a real cube). */
  debugLure(spicy = false): void {
    if (!this.debugStart()) return;
    this.stage.boardLift.localToWorld(world.set(0, 0, -100));
    this.stage.boardSpin.worldToLocal(world);
    const ground = landingHeight(world.x, world.z) ?? 0;
    const mesh = this.cube();
    if (spicy) mesh.material = this.spicyMaterial;
    this.addLure(world.setY(ground), mesh, spicy);
    this.spendOne();
  }
}
