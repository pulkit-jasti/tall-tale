// The pepper shaker (docs/giant-tools.md): grab it and shake it over goblins.
// The first shake pays 3 food and gives about 8 seconds of pepper. Pepper
// falls straight down from where the shaker is, so the falling specks show
// where it lands. No aiming UI. Every goblin under it sneezes and is seasoned:
// worth 2 food instead of 1 when eaten. Goblins outside the wall stumble back
// a little. (Gear flying off comes with the gear-wearing enemies.)
//
// Shaking is found from the shaker's own movement: a quick move that turns
// back on the one before is one stroke, two strokes close together are a shake.
// No hand pose is needed, so it works with any grip.
import { Vector3 } from 'three';
import { CASTLE, PEPPER, TOOL_SPOTS } from '../config/game.js';
import { pepperShaker } from '../world/shapes.js';
import { HandTool, type ToolParts } from './handTool.js';

const current = new Vector3();
const raw = new Vector3();
const direction = new Vector3();
const world = new Vector3();
const board = new Vector3();
const front = new Vector3();

export class PepperShaker extends HandTool {
  private topLocal = new Vector3();
  /** Shaker top last frame (fixedRig, cm) and its smoothed speed (cm per second). */
  private last = new Vector3();
  private hasLast = false;
  private velocity = new Vector3();
  /** Direction of the last quick move. */
  private lastDirection = new Vector3();
  private hasDirection = false;
  private lastStroke = -Infinity;
  /** Pepper falls until this time. */
  private shakeUntil = -Infinity;
  private speckTimer = 0;

  constructor(parts: ToolParts) {
    super(
      'pepper',
      parts,
      TOOL_SPOTS.leftFront,
      { from: PEPPER.gripFrom, to: PEPPER.gripTo, radius: PEPPER.grabRadius },
      0,
      PEPPER.bodyRadius + 0.5,
    );
  }

  protected build(): void {
    const { group, materials, top } = pepperShaker();
    this.body.add(group);
    this.materials = materials;
    this.topLocal.set(0, top, 0);
  }

  protected resetMotion(): void {
    this.hasLast = false;
    this.hasDirection = false;
    this.velocity.set(0, 0, 0);
    this.lastStroke = -Infinity;
    this.shakeUntil = -Infinity;
  }

  protected heldUpdate(dt: number): void {
    // The shaker top in fixedRig, which never moves, so its speed is the hand's.
    this.bodyToWorld(this.topLocal, current);
    this.stage.fixedRig.worldToLocal(current);
    if (!this.hasLast || dt <= 0) {
      this.last.copy(current);
      this.hasLast = true;
      return;
    }
    raw.subVectors(current, this.last).divideScalar(dt);
    this.last.copy(current);
    this.velocity.lerp(raw, 1 - Math.exp(-dt / PEPPER.speedSmoothing));
    const speed = this.velocity.length();
    if (speed > PEPPER.shakeSpeed) {
      direction.copy(this.velocity).divideScalar(speed);
      if (this.hasDirection && direction.dot(this.lastDirection) < -0.3) {
        // A stroke that turns back on the last one. Two close together: shaking.
        if (this.time - this.lastStroke < PEPPER.shakeWindow) this.shakeUntil = this.time + PEPPER.shakeHold;
        this.lastStroke = this.time;
      }
      this.lastDirection.copy(direction);
      this.hasDirection = true;
    }
    if (this.time >= this.shakeUntil) return;
    if (!this.tryUse()) {
      this.shakeUntil = -Infinity;
      return;
    }
    this.sprinkle(dt, this.bodyToWorld(this.topLocal, world));
  }

  /** Pepper falls from a world point: specks, the shake sound, and every goblin under it is peppered. */
  private sprinkle(dt: number, at: Vector3, radius: number = PEPPER.radius): void {
    this.audio.play('pepperShake', at, 1, PEPPER.soundGap);
    this.speckTimer -= dt;
    if (this.speckTimer <= 0) {
      this.speckTimer = PEPPER.speckEvery;
      this.particles.drizzle(at, PEPPER.speckColors, PEPPER.speckCount, 0.012, 0.45);
    }
    this.stage.boardSpin.worldToLocal(board.copy(at));
    const r2 = radius * radius;
    let count = 0;
    for (const g of this.goblins.list) {
      if (!this.goblins.isHittable(g) || g.seasoned) continue;
      const p = g.root.position;
      const dx = p.x - board.x;
      const dz = p.z - board.z;
      const drop = board.y - p.y;
      if (dx * dx + dz * dz < r2 && drop > 0 && drop < PEPPER.maxDrop && this.goblins.pepper(g)) count++;
    }
    if (count > 0) this.onUse(count);
  }

  /** Debug: peppers the goblins at the front of the wall, without hands. Pays the food like a real shake. */
  debugShake(): void {
    if (!this.debugStart()) return;
    // Above the goblins at the wall straight in front of the player (boardLift).
    this.stage.boardLift.localToWorld(front.set(0, 20, -(CASTLE.wallOut + CASTLE.wallStandOff / 2)));
    this.sprinkle(PEPPER.speckEvery, front, PEPPER.radius * 2.5);
  }
}
