// The bell (docs/giant-tools.md, reworked in docs/v2-plan.md 2.3): the only
// stun. Grab it and shake it: every goblin on the board is stunned (harder
// shaking stuns a little longer), and every goblin on the rampart is knocked
// back down outside the wall (it climbs again later). It does not disarm.
// Like the pepper, a shake is found from the bell's own movement (a quick
// move that turns back on the one before is one stroke, two strokes close
// together a shake), so no hand pose is needed. One stun per use, then it
// goes back and recharges (TOOLS.recharge, the longest).
import { Vector3 } from 'three';
import { BELL, STUN, TOOL_SPOTS } from '../config/game.js';
import { handBell } from '../world/shapes.js';
import { HandTool, type ToolParts } from './handTool.js';
import type { StunWave } from './stunWave.js';

const current = new Vector3();
const raw = new Vector3();
const direction = new Vector3();
const world = new Vector3();

export class Bell extends HandTool {
  private middleLocal = new Vector3();
  private last = new Vector3();
  private hasLast = false;
  private velocity = new Vector3();
  private lastDirection = new Vector3();
  private hasDirection = false;
  private lastStroke = -Infinity;
  /** The fastest speed of this stroke, for how hard it rings. */
  private peak = 0;

  constructor(
    parts: ToolParts,
    private stunWave: StunWave,
  ) {
    super(
      'bell',
      parts,
      TOOL_SPOTS.leftMiddle,
      { from: BELL.gripFrom, to: BELL.gripTo, radius: BELL.grabRadius },
      0,
      BELL.bellMouth + 0.5,
      // Its mouth rests on the platform, the handle up.
      { restLift: BELL.bellHeight },
    );
  }

  protected build(): void {
    const { group, materials, middle } = handBell();
    this.body.add(group);
    this.materials = materials;
    this.middleLocal.copy(middle);
  }

  protected resetMotion(): void {
    this.hasLast = false;
    this.hasDirection = false;
    this.velocity.set(0, 0, 0);
    this.lastStroke = -Infinity;
    this.peak = 0;
  }

  protected heldUpdate(dt: number): void {
    // The bell in fixedRig, which never moves, so its speed is the hand's.
    this.bodyToWorld(this.middleLocal, current);
    this.stage.fixedRig.worldToLocal(current);
    if (!this.hasLast || dt <= 0) {
      this.last.copy(current);
      this.hasLast = true;
      return;
    }
    raw.subVectors(current, this.last).divideScalar(dt);
    this.last.copy(current);
    this.velocity.lerp(raw, 1 - Math.exp(-dt / BELL.speedSmoothing));
    const speed = this.velocity.length();
    if (speed <= BELL.ringSpeed) return;
    this.peak = Math.max(this.peak, speed);
    direction.copy(this.velocity).divideScalar(speed);
    const turned = this.hasDirection && direction.dot(this.lastDirection) < -0.3;
    this.lastDirection.copy(direction);
    this.hasDirection = true;
    if (!turned) return;
    // One stroke: the bell rings, louder the harder it is shaken. The ring plays once to its end:
    // strokes while it still rings add no sound (the sound is a `once` sound).
    const hard = Math.min(1, (this.peak - BELL.ringSpeed) / (BELL.hardSpeed - BELL.ringSpeed));
    this.peak = 0;
    this.bodyToWorld(this.middleLocal, world);
    this.audio.play('bell', world, 0.6 + 0.4 * hard);
    const shake = this.time - this.lastStroke < BELL.ringWindow;
    this.lastStroke = this.time;
    if (!shake) return;
    // One stun per use (v2): ringing on in the short use window adds nothing.
    // While the tutorial holds the window open, a ring after the stun ran out stuns again.
    if (this.active && (this.stunWave.active || !this.timerHeld)) return;
    if (!this.tryUse()) return;
    this.ring(STUN.baseSeconds + STUN.hardExtra * hard);
  }

  /** The stun: every goblin on the board, and every goblin on the rampart is knocked back down outside the wall. */
  private ring(seconds: number): void {
    const stunned = this.stunWave.stun(seconds, world);
    const knocked = this.goblins.knockOffRampart();
    this.onUse(stunned + knocked);
  }

  /** Debug: a hard ring without hands (a recharging bell is made ready first). Ends its use like a real ring would. */
  debugRing(): void {
    if (!this.debugStart()) return;
    this.bodyToWorld(this.middleLocal, world);
    this.audio.play('bell', world);
    this.ring(STUN.baseSeconds + STUN.hardExtra);
  }
}
