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
import { COMPASS, DRUM, STUN, TOOL_SPOTS } from '../config/game.js';
import { note } from '../debug/notes.js';
import { easeInOut } from '../fx/ease.js';
import { polarX, polarZ } from '../rules/boardMath.js';
import type { HandState } from '../player/hands.js';
import { drum, drumStick } from '../world/shapes.js';
import { HandTool, type ToolParts } from './handTool.js';

const ball = new Vector3();
const world = new Vector3();
const skinNow = new Vector3();

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

  /**
   * The big drum (2026-11-17): grabbing the stick sinks the small drum and the compass, and a much larger
   * drum rises on the compass's spot, right in front. One strike: the stick vanishes from the hand and
   * everything goes back. `stage` 0 is the small drum on its platform, 1 the big drum fully up.
   */
  private bigGroup = new Group();
  private bigSkin!: Mesh;
  private bigSkinY = 0;
  private stage01 = 0;
  private staging: 'in' | 'out' | null = null;
  /** Set by the game: sinks the compass (0 up, 1 gone), so the big drum can stand on its spot. */
  sinkCompass: (share: number) => void = () => {};

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
    // The big drum on the compass's spot, under the board until the stick is grabbed.
    const big = drum();
    big.group.scale.setScalar(DRUM.bigScale);
    this.bigSkin = big.skin;
    this.bigSkinY = big.skin.position.y * DRUM.bigScale;
    this.bigGroup.add(big.group);
    this.bigGroup.position.set(polarX(COMPASS.at, 0), -this.bigHeight, polarZ(COMPASS.at, 0));
    this.bigGroup.visible = false;
    this.root.add(this.bigGroup);
  }

  private get bigHeight(): number {
    return (DRUM.height + 0.3) * DRUM.bigScale;
  }

  grab(hand: HandState, viaPinch: boolean): void {
    super.grab(hand, viaPinch);
    note(`[drum] grabbed (${viaPinch ? 'pinch' : 'fist'})`);
    this.staging = 'in';
    this.bigGroup.visible = true;
  }

  /** The small drum sinks and the big one rises (or back), with the compass. */
  private updateStage(dt: number): void {
    if (!this.staging) return;
    const step = dt / DRUM.stageTime;
    this.stage01 = this.staging === 'in' ? Math.min(1, this.stage01 + step) : Math.max(0, this.stage01 - step);
    const s = easeInOut(this.stage01);
    // The small drum and its whole platform go down under the board together (2026-11-17: the platform
    // stayed up, empty); the big one comes up from under the board.
    const depth = (this.drumTop + DRUM.height + 2) * s;
    this.drumGroup.position.y = this.drumTop - depth;
    this.drumGroup.visible = s < 0.98;
    this.platformGroup.position.y = -depth;
    this.platformGroup.visible = s < 0.98;
    // The stick grows with the drum while it is in the hand (the same factor), so it fits the big skin.
    if (this.heldHand) this.body.scale.setScalar(1 + (DRUM.bigScale - 1) * s);
    this.bigGroup.position.y = -this.bigHeight * (1 - s);
    this.bigGroup.visible = s > 0.02;
    this.sinkCompass(Math.min(1, s * 1.4));
    if (this.stage01 === 1 || this.stage01 === 0) {
      if (this.stage01 === 0) {
        this.sinkCompass(0);
        this.drumGroup.position.y = this.drumTop;
      }
      this.staging = null;
    }
  }

  /** The skin a strike lands on now: the big drum's once it stands, else the small one's (boardLift cm). */
  private strikeSkin(out: Vector3): { radius: number } {
    if (this.stage01 >= 0.9) {
      out.set(this.bigGroup.position.x, this.bigGroup.position.y + this.bigSkinY, this.bigGroup.position.z);
      return { radius: DRUM.radius * DRUM.bigScale };
    }
    out.copy(this.skinCenter);
    return { radius: DRUM.radius };
  }

  protected placed(x: number, top: number, z: number): void {
    this.drumGroup.position.set(x, top, z);
    this.drumTop = top;
    this.skinCenter.set(x, top + this.skinY, z);
  }

  /** The platform top the small drum stands on (boardLift cm). */
  private drumTop = 0;

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

  protected resetMotion(): void {
    // Put down or used: the big drum goes down, the small one and the compass come back.
    if (this.stage01 > 0 || this.staging === 'in') this.staging = 'out';
    this.leaveIn = 0;
    // Out of the hand the stick is its own size again (it shrinks away or glides back to its stand).
    this.body.scale.setScalar(1);
    // Put down: how hard it came down near the skin, to tune DRUM.hitSpeed from real numbers.
    if (this.hasLast) note(`[drum] put down: fastest down speed near the skin ${this.topSpeed.toFixed(0)} cm/s (strikes at ${DRUM.hitSpeed}), ${this.strikes} strikes`);
    this.hasLast = false;
    this.armed = true;
    this.topSpeed = 0;
    this.strikes = 0;
  }

  update(dt: number): void {
    super.update(dt);
    this.updateLeave(dt);
    this.updateStage(dt);
    // The skin bounces down and back after a strike (both drums' skins: only one shows).
    if (this.thumpLeft > 0) {
      this.thumpLeft = Math.max(0, this.thumpLeft - dt);
      const t = this.thumpLeft / DRUM.thumpTime;
      this.skin.position.y = this.skinY - DRUM.thump * Math.sin(t * Math.PI);
      this.bigSkin.position.y = this.bigSkinY / DRUM.bigScale - (DRUM.thump / DRUM.bigScale) * 1.5 * Math.sin(t * Math.PI);
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
    const { radius } = this.strikeSkin(skinNow);
    const above = ball.y - skinNow.y;
    const across = Math.hypot(ball.x - skinNow.x, ball.z - skinNow.z);
    const overSkin = across < radius + DRUM.edge;
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
    this.strikeSkin(skinNow);
    this.stage.boardLift.localToWorld(world.copy(skinNow));
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
    // One strike, then after DRUM.stayTime the stick leaves the hand (it shrinks away and pops back on its
    // platform) and the big drum goes down (2026-11-17: it left at once; now it stays a moment).
    if (this.leaveIn <= 0) this.leaveIn = DRUM.stayTime;
  }

  /** Seconds until the stick leaves the hand after a strike (0: no strike waiting). */
  private leaveIn = 0;

  private updateLeave(dt: number): void {
    if (this.leaveIn <= 0) return;
    this.leaveIn = Math.max(0, this.leaveIn - dt);
    if (this.leaveIn > 0) return;
    if (!this.heldHand) return;
    if (this.active) this.finishUse();
    else this.release();
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
