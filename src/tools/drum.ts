// The drum (docs/v3-plan.md 2.2, replaces the bell: its shake was hard to
// detect). The only stun. A short red drum stands on its platform with its
// stick resting in it. Grab the stick in a fist and strike the skin: the
// swatter's downward motion, which tracks well.
//
//   - A strike: the stick's ball comes down onto the skin (within its radius,
//     DRUM.contact above it) faster than DRUM.hitSpeed. Measured in boardLift,
//     which never turns, so spinning the board never fakes a strike.
//     Grabbing the stick or resting it on the skin never fires it (no speed).
//     The ball must lift DRUM.rearm off the skin before the next strike.
//   - A strike that stuns: the game's onStrike stuns every goblin on the board
//     (the shock ring runs out across it) and knocks the rampart goblins back
//     down (src/tools/stunWave.ts, Goblins.knockOffRampart). It does not reach
//     diggers underground (Phase 3). The first strike starts the short use
//     window; more strikes while the stun still runs only boom.
//   - The sound plays last and on its own, so nothing in it can stop the stun.
// Every strike leaves a note on the debug page (src/debug/notes.ts).
import { Group, Mesh, Vector3, type MeshStandardMaterial } from 'three';
import { DRUM, STUN, TOOL_SPOTS } from '../config/game.js';
import { note } from '../debug/notes.js';
import type { HandState } from '../player/hands.js';
import { drum, drumStick } from '../world/shapes.js';
import { HandTool, type ToolParts } from './handTool.js';

const ball = new Vector3();
const world = new Vector3();

export class Drum extends HandTool {
  /** The ball's center in the stick's own frame (from the model). */
  private ballLocal = new Vector3();
  /** The drum itself, fixed on the platform (boardLift cm), and its skin. */
  private drumGroup = new Group();
  private skin!: Mesh;
  private skinY = 0;
  /** The skin's center (boardLift cm). */
  private skinCenter = new Vector3();
  /** The ball last frame (boardLift cm). */
  private last = new Vector3();
  private hasLast = false;
  /** Lifted off the skin since the last strike, so the next one can count. */
  private armed = true;
  private sinceStrike = Infinity;
  private thumpLeft = 0;
  /** While held: the fastest downward speed near the skin (for the note when it is put down), and strikes. */
  private topSpeed = 0;
  private strikes = 0;

  /** True while a stun is running (set by the game). A strike then only booms. */
  stunning: () => boolean = () => false;
  /** A strike that stuns, at `where` (world) for `seconds`: the game stuns and knocks goblins down. Returns how many it hit. */
  onStrike: (where: Vector3, seconds: number) => number = () => 0;

  constructor(parts: ToolParts) {
    super(
      'drum',
      parts,
      TOOL_SPOTS.leftMiddle,
      { from: DRUM.gripFrom, to: DRUM.gripTo, radius: DRUM.grabRadius },
      DRUM.restLeanDeg,
      DRUM.radius + 0.6,
      // The stick stands in the drum, on its skin.
      { restLift: DRUM.height + 0.2 },
    );
  }

  protected build(): void {
    const { group, materials, ball: tip } = drumStick();
    this.body.add(group);
    this.materials = materials;
    this.ballLocal.copy(tip);
    const built = drum();
    this.skin = built.skin;
    this.skinY = built.skin.position.y;
    this.drumGroup.add(built.group);
    this.root.add(this.drumGroup);
  }

  protected placed(x: number, top: number, z: number): void {
    this.drumGroup.position.set(x, top, z);
    this.skinCenter.set(x, top + this.skinY, z);
  }

  /** The menu's shelf and stand show the drum with its stick in it (the stick alone did not read as a drum). */
  displayModel(): ReturnType<HandTool['displayModel']> {
    const shown = super.displayModel();
    const copy = drum().group;
    copy.position.y = -(DRUM.height + 0.2);
    shown.model.add(copy);
    copy.traverse((o) => {
      const mesh = o as Mesh;
      if (mesh.isMesh) shown.materials.push(mesh.material as MeshStandardMaterial);
    });
    return shown;
  }

  grab(hand: HandState, viaPinch: boolean): void {
    super.grab(hand, viaPinch);
    note(`[drum] grabbed (${viaPinch ? 'pinch' : 'fist'})`);
  }

  protected resetMotion(): void {
    // Put down: how hard it came down near the skin, to tune DRUM.hitSpeed from real numbers.
    if (this.hasLast) note(`[drum] put down: fastest down speed near the skin ${this.topSpeed.toFixed(0)} cm/s (strikes at ${DRUM.hitSpeed}), ${this.strikes} strikes`);
    this.hasLast = false;
    this.armed = true;
    this.topSpeed = 0;
    this.strikes = 0;
  }

  update(dt: number): void {
    super.update(dt);
    // The skin bounces down and back after a strike.
    if (this.thumpLeft > 0) {
      this.thumpLeft = Math.max(0, this.thumpLeft - dt);
      const t = this.thumpLeft / DRUM.thumpTime;
      this.skin.position.y = this.skinY - DRUM.thump * Math.sin(t * Math.PI);
    }
  }

  protected heldUpdate(dt: number): void {
    if (dt <= 0) return;
    this.sinceStrike += dt;
    this.bodyToWorld(this.ballLocal, ball);
    this.stage.boardLift.worldToLocal(ball);
    if (!this.hasLast) {
      this.last.copy(ball);
      this.hasLast = true;
      return;
    }
    const down = (this.last.y - ball.y) / dt;
    this.last.copy(ball);
    const above = ball.y - this.skinCenter.y;
    const across = Math.hypot(ball.x - this.skinCenter.x, ball.z - this.skinCenter.z);
    const overSkin = across < DRUM.radius + DRUM.edge;
    if (!this.armed) {
      if (above > DRUM.rearm || !overSkin) this.armed = true;
      return;
    }
    if (!overSkin || above > DRUM.contact) return;
    this.topSpeed = Math.max(this.topSpeed, down);
    if (down < DRUM.hitSpeed || this.sinceStrike < DRUM.gap) return;
    this.armed = false;
    this.sinceStrike = 0;
    this.strikes++;
    this.strike(down);
  }

  /** One strike: the stun (if none is running and the drum is not resting), then the sound. `speed`: how fast it came down (cm/s). */
  private strike(speed: number): void {
    this.stage.boardLift.localToWorld(world.copy(this.skinCenter));
    const hard = Math.min(1, Math.max(0, (speed - DRUM.hitSpeed) / (DRUM.hardSpeed - DRUM.hitSpeed)));
    this.thumpLeft = DRUM.thumpTime;
    if (this.stunning()) {
      note('[drum] strike: a stun is still running, no new one');
    } else if (this.tryUse()) {
      const seconds = STUN.baseSeconds + STUN.hardExtra * hard;
      const hit = this.onStrike(world, seconds);
      note(`[drum] strike: stun ${seconds.toFixed(1)} s, ${hit} goblins (${speed.toFixed(0)} cm/s)`);
      // A use counts even with no goblin about, so a lesson always ends.
      this.onUse(Math.max(1, hit));
    } else {
      note('[drum] strike: it is resting, no stun');
    }
    this.playSound(world, hard);
  }

  /** The boom and the crash, on their own: an error in them is noted and never stops anything else. */
  private playSound(where: Vector3, hard: number): void {
    try {
      this.audio.play('drumBoom', where, 0.7 + 0.3 * hard);
      this.audio.play('drumCrash', where, 0.5 + 0.5 * hard);
    } catch (error) {
      note(`[drum] sound failed: ${String(error)}`);
    }
  }

  /** World point on the skin, for the tutorial's markers and ghost hand. */
  skinWorld(out: Vector3): Vector3 {
    return this.stage.boardLift.localToWorld(out.copy(this.skinCenter));
  }

  /** Debug page: a hard strike without hands (a recharging drum is made ready first). */
  debugStrike(): void {
    if (!this.debugStart()) return;
    this.stage.boardLift.localToWorld(world.copy(this.skinCenter));
    this.thumpLeft = DRUM.thumpTime;
    const hit = this.onStrike(world, STUN.baseSeconds + STUN.hardExtra);
    note(`[drum] debug strike: ${hit} goblins`);
    this.onUse(Math.max(1, hit));
    this.playSound(world, 1);
  }
}
