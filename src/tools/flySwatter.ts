// The fly swatter (docs/giant-tools.md): crowd clearing near the wall. Grab
// it, then swat: the first swat (the head touching the ground or a goblin)
// pays 4 food and gives about 10 seconds to swat as often as the player
// wants. Each swat knocks out every goblin the head touches. It cannot break
// shields or armor (no gear in the MVP yet).
//
// Fast swings blur hand tracking, so hits are found along the whole path of
// the head since the last frame, with a generous hit area, and slow slams
// count too, not only fast swipes.
import { Vector3 } from 'three';
import { SWATTER, TOOL_SPOTS } from '../config/game.js';
import { landingHeight } from '../rules/boardMath.js';
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
    this.hasLast = false;
    this.armed = true;
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
    const ground = landingHeight(Math.hypot(current.x, current.z));
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
      const r2 = SWATTER.hitRadius * SWATTER.hitRadius;
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
    this.last.copy(current);
    if ((groundSwat || this.hits.length > 0) && this.tryUse()) this.swat(this.bodyToWorld(HEAD_LOCAL, world));
  }

  /** Splat: every goblin in this.hits is knocked out with a poof. */
  private swat(at: Vector3): void {
    this.audio.play('swatSplat', at, 1, 0.08);
    this.particles.burst(at, SWATTER.splatColors, 6, 0.15);
    for (const g of this.hits) {
      this.goblins.worldPosition(g, world);
      this.particles.burst(world, SWATTER.splatColors, 10);
      this.audio.play('poof', world, 1, 0.05);
      this.goblins.kill(g);
    }
    if (this.hits.length > 0) this.onUse(this.hits.length);
    this.hits.length = 0;
  }

  /** Debug: swats the goblins at the front of the wall, without hands. Pays the food like a real swat. */
  debugSwat(): void {
    if (!this.debugStart()) return;
    // The wall straight in front of the player (fixedRig), on the board.
    this.stage.fixedRig.localToWorld(front.set(0, 0, -44));
    this.stage.boardSpin.worldToLocal(front);
    this.hits.length = 0;
    const r = SWATTER.hitRadius * 2;
    for (const g of this.goblins.list) {
      if (!this.goblins.isHittable(g)) continue;
      if (Math.hypot(g.root.position.x - front.x, g.root.position.z - front.z) < r) this.hits.push(g);
    }
    this.swat(this.stage.boardSpin.localToWorld(front));
  }
}
