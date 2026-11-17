// The fly swatter (docs/giant-tools.md): crowds of bare goblins near the
// wall. v3 (docs/v3-plan.md 1.4): a 10 s use window from the first swat,
// then it recharges (swing counting stays behind TOOLS.swings). Each swat
// knocks out every bare goblin the head touches. A helmet or a shield stops
// it: a clonk, the goblin keeps its gear and is knocked back a little,
// dazed. A swatted balloon (or its riders) is pushed away for a moment,
// never popped (that is the slingshot's job).
//
// Fast swings blur hand tracking, so hits are found along the whole path of
// the head since the last frame, with a generous hit area, and slow slams
// count too, not only fast swipes.
import { Vector3 } from 'three';
import { CASTLE, SWATTER, TOOL_SPOTS } from '../config/game.js';
import { BOOST } from '../rules/boosts.js';
import { landingHeight } from '../rules/boardMath.js';
import type { Balloons } from '../units/balloons.js';
import type { Goblin } from '../units/goblins.js';
import { flySwatter } from '../world/shapes.js';
import { HandTool, type ToolParts } from './handTool.js';

const HEAD_LOCAL = new Vector3(0, SWATTER.handleLength + SWATTER.headHeight / 2, 0);
const current = new Vector3();
const segment = new Vector3();
const toGoblin = new Vector3();
const world = new Vector3();
const front = new Vector3();

export class FlySwatter extends HandTool {
  /** Head center last frame (board, cm). */
  private last = new Vector3();
  private hasLast = false;
  /** A ground swat counts again only after the head lifted off. */
  private armed = true;
  private hits: Goblin[] = [];
  /** A swing is under way (v3), and how long the head has been slow (seconds). */
  private swinging = false;
  private calmTime = 0;
  /** Every swat, at the head's world point (juice: a ring on the ground). */
  onSplat: (world: Vector3) => void = () => {};
  /** The balloons (set by the game): a swat pushes them away. */
  balloons: Balloons | null = null;
  /** A swat bounced off armor (the tutorial's swatter wave can count it). */
  onClonk: () => void = () => {};

  constructor(parts: ToolParts) {
    super(
      'swatter',
      parts,
      TOOL_SPOTS.leftSide,
      { from: SWATTER.gripFrom, to: SWATTER.gripTo, radius: SWATTER.grabRadius },
      SWATTER.restLeanDeg,
      SWATTER.handleRadius + 1.2,
    );
  }

  protected build(): void {
    const { group, materials } = flySwatter();
    this.body.add(group);
    this.materials = materials;
  }

  protected resetMotion(): void {
    // Let go mid-swing: that swing is spent.
    this.endSwing();
    this.hasLast = false;
    this.armed = true;
    this.calmTime = 0;
  }

  /** A swing is over: one of the charge's swings is used up (the last one sends it back). */
  private endSwing(): void {
    if (!this.swinging) return;
    this.swinging = false;
    this.spendSwing();
  }

  protected heldUpdate(dt: number): void {
    this.bodyToBoard(HEAD_LOCAL, current);
    if (!this.hasLast || dt <= 0) {
      this.last.copy(current);
      this.hasLast = true;
      return;
    }
    segment.subVectors(current, this.last);
    const length = segment.length();
    const speed = length / dt;
    if (speed > SWATTER.whooshSpeed) {
      this.audio.play('swatWhoosh', this.bodyToWorld(HEAD_LOCAL, world), 1, SWATTER.whooshGap);
    }
    // The head touching the ground (courtyard, wall top or field) on the way down is a swat.
    let groundSwat = false;
    const ground = landingHeight(current.x, current.z);
    if (ground !== null) {
      const above = current.y - ground;
      if (this.armed && above < SWATTER.groundContact && current.y < this.last.y && speed > SWATTER.minHitSpeed) {
        groundSwat = true;
        this.armed = false;
      }
      if (above > SWATTER.rearmHeight) this.armed = true;
    }
    // Every goblin near the head's path since the last frame.
    this.hits.length = 0;
    if (speed > SWATTER.minHitSpeed) {
      const r2 = (SWATTER.hitRadius * BOOST.swatterRadius) ** 2;
      const lengthSq = length * length;
      for (const g of this.goblins.list) {
        if (!this.goblins.isHittable(g)) continue;
        toGoblin.copy(g.root.position);
        toGoblin.y += g.stats.height * 0.5;
        toGoblin.sub(this.last);
        const t = lengthSq > 0 ? Math.min(1, Math.max(0, toGoblin.dot(segment) / lengthSq)) : 0;
        toGoblin.addScaledVector(segment, -t);
        if (toGoblin.lengthSq() < r2) this.hits.push(g);
      }
    }
    // A balloon near the head (v3): pushed away, not popped.
    const balloon = speed > SWATTER.minHitSpeed ? (this.balloons?.near(current, SWATTER.hitRadius * BOOST.swatterRadius) ?? null) : null;
    this.last.copy(current);
    const contact = groundSwat || this.hits.length > 0 || balloon !== null;
    // v3: a swing starts with a fast head or a swat, and ends when the head has been slow a moment.
    if (!this.swinging && (contact || speed > SWATTER.swingSpeed)) {
      if (!this.tryUse()) {
        this.hits.length = 0;
        return;
      }
      this.swinging = true;
      this.calmTime = 0;
    }
    if (this.swinging) {
      if (balloon && this.balloons?.push(balloon)) this.onUse(1);
      if (groundSwat || this.hits.length > 0) this.swat(this.bodyToWorld(HEAD_LOCAL, world));
      this.calmTime = speed < SWATTER.swingEndSpeed ? this.calmTime + dt : 0;
      if (this.calmTime >= SWATTER.swingEndTime) this.endSwing();
    }
    this.hits.length = 0;
  }

  /**
   * Splat: every bare goblin in this.hits is knocked out with a poof. A
   * helmet or shield stops it (v3, a clonk), and a rider pushes its balloon away.
   */
  private swat(at: Vector3): void {
    this.audio.play('swatSplat', at, 1, 0.08);
    this.particles.burst(at, SWATTER.splatColors, 6, 0.15);
    this.onSplat(at);
    this.stage.boardSpin.worldToLocal(front.copy(at));
    let knocked = 0;
    for (const g of this.hits) {
      if (g.mode === 'riding') {
        const carrier = this.balloons?.carrierOf(g);
        if (carrier && this.balloons!.push(carrier)) knocked++;
        continue;
      }
      if (this.goblins.clonk(g, front.x, front.z)) {
        this.onClonk();
        continue;
      }
      this.goblins.worldPosition(g, world);
      this.particles.burst(world, SWATTER.splatColors, 10);
      this.audio.play('poof', world, 1, 0.05);
      this.goblins.cause = 'swatter';
      this.goblins.kill(g, true);
      knocked++;
    }
    if (knocked > 0) this.onUse(knocked);
    this.hits.length = 0;
  }

  /** Debug: swats the goblins at the front of the wall, without hands (starts a use like a real swat). */
  debugSwat(): void {
    if (!this.debugStart()) return;
    // The goblins at the wall straight in front of the player (boardLift), on the board.
    this.stage.boardLift.localToWorld(front.set(0, 0, -(CASTLE.wallOut + CASTLE.wallStandOff / 2)));
    this.stage.boardSpin.worldToLocal(front);
    this.hits.length = 0;
    const r = SWATTER.hitRadius * BOOST.swatterRadius * 2;
    for (const g of this.goblins.list) {
      if (!this.goblins.isHittable(g)) continue;
      if (Math.hypot(g.root.position.x - front.x, g.root.position.z - front.z) < r) this.hits.push(g);
    }
    this.swat(this.stage.boardSpin.localToWorld(front));
    // One debug swat is one swing.
    this.spendSwing();
  }
}
