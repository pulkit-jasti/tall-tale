// Runs one battle: the tutorial director, the win and lose rules, the flags,
// the hint sign with its markers, and the end panel. It is the TutorialApi:
// each director call goes to a game system (wave spawner, goblins,
// slingshot), and it counts what the player does for the lessons. Nothing
// tutorial-only lives in those systems.
import { Vector3 } from 'three';
import type { GameAudio } from '../audio/sound.js';
import { CASTLE_HEALTH, END_PANEL, GHOST_HAND, HANDLES, HINT_SIGN, READING, TOOL_SPOTS, WAVES } from '../config/game.js';
import { WAVE_VOICES } from '../config/sounds.js';
import type { Particles } from '../fx/particles.js';
import type { HandState } from '../player/hands.js';
import { clearWave, createBattle, damageCastle, healthShare, loseCastle, type BattleState } from '../rules/battle.js';
import { angleDelta, degToRad, polarX, polarZ } from '../rules/boardMath.js';
import { Director } from '../rules/director.js';
import type { Random } from '../rules/random.js';
import type { SlingEvent, Slingshot } from '../tools/slingshot.js';
import type { EndPanel } from '../ui/endPanel.js';
import { endAnchor, type GhostAnchor, type GhostDemoName } from '../ui/ghostDemos.js';
import type { GhostHand, ViewFrame } from '../ui/ghostHand.js';
import type { HintSign, SignContent } from '../ui/hintSign.js';
import type { Markers } from '../ui/markers.js';
import type { UiImageName } from '../ui/uiImages.js';
import type { Goblin, Goblins } from '../units/goblins.js';
import type { WaveSpawner } from '../units/waveSpawner.js';
import type { Flags } from '../world/flags.js';
import type { Stage } from '../world/stage.js';
import {
  buildTutorialSteps,
  TUTORIAL_TIMING,
  TUTORIAL_WAVES,
  type HintIcon,
  type MarkerTarget,
  type ToolName,
  type TutorialApi,
  type TutorialStep,
} from './tutorial.js';

const POOF_COLORS = [0xffffff, 0xddd6c8, 0xb8b0a0];
/** Tools that are built so far. The tutorial leaves out lessons for the others. */
const BUILT_TOOLS: ToolName[] = ['slingshot'];
const ICONS: Record<HintIcon, UiImageName> = {
  hand: 'hand',
  gauntlet: 'gauntlet',
  up: 'up',
  target: 'target',
  warning: 'warning',
  info: 'info',
  star: 'star',
  trophy: 'trophy',
};
const temp = new Vector3();
const markerAt = new Vector3();
const toMarker = new Vector3();
const lastAnchor = new Vector3();
const view: ViewFrame = { right: new Vector3(), up: new Vector3(0, 1, 0), back: new Vector3(), head: new Vector3() };

export interface BattleParts {
  stage: Stage;
  goblins: Goblins;
  spawner: WaveSpawner;
  slingshot: Slingshot;
  flags: Flags;
  panel: EndPanel;
  sign: HintSign;
  markers: Markers;
  ghost: GhostHand;
  audio: GameAudio;
  particles: Particles;
  rng: Random;
  /** True while a hand holds this goblin. */
  isHeld: (goblin: Goblin) => boolean;
}

export class Battle implements TutorialApi {
  state: BattleState = createBattle(TUTORIAL_WAVES.length, CASTLE_HEALTH);
  /** False before the first start and while the stress test runs. */
  running = false;
  private director: Director<TutorialApi> | null = null;
  private wave = -1;
  private endTimer = -1;

  // What the player did in this battle, for the lessons.
  private eatenCount = 0;
  private pickedCount = 0;
  private slingHits = 0;
  private sling: Record<SlingEvent, number> = { grabbed: 0, pebbleTaken: 0, loaded: 0, shot: 0 };
  private spun = 0;
  private moved = 0;
  private lastSpin = 0;
  private lastHeight = 0;
  private lessonGoblin: Goblin | null = null;

  // The hint sign.
  private shownStep: TutorialStep | null = null;
  private shown: SignContent | null = null;
  /** A finished lesson keeps its ticked box up this long (seconds). */
  private doneFlash = 0;
  private doneContent: SignContent | null = null;
  /** How long the head has pointed at the current step's marker (seconds). */
  private gaze = 0;
  private head = new Vector3();
  private forward = new Vector3();

  constructor(private parts: BattleParts) {
    parts.goblins.onWallHit = () => {
      if (this.running) damageCastle(this.state, CASTLE_HEALTH.wallHitDamage);
    };
    parts.slingshot.onHit = () => this.slingHits++;
    parts.slingshot.onEvent = (event) => this.sling[event]++;
  }

  /** A new tutorial battle from the first lesson. */
  start(): void {
    const { goblins, spawner, slingshot, flags, panel, stage } = this.parts;
    spawner.stop();
    goblins.killAll();
    panel.hide();
    // Every tool waits for its wave (docs/giant-tools.md section 6).
    slingshot.setVisible(false);
    slingshot.beckon = false;
    this.state = createBattle(TUTORIAL_WAVES.length, CASTLE_HEALTH);
    flags.show(1, 0, true);
    this.wave = -1;
    this.endTimer = -1;
    this.eatenCount = this.pickedCount = this.slingHits = this.spun = this.moved = 0;
    this.sling = { grabbed: 0, pebbleTaken: 0, loaded: 0, shot: 0 };
    this.lastSpin = stage.spin;
    this.lastHeight = stage.height;
    this.lessonGoblin = null;
    this.shownStep = null;
    this.doneFlash = 0;
    const director = new Director<TutorialApi>(buildTutorialSteps(BUILT_TOOLS), this);
    director.onStepEnd = (id, how, time, fallbacks) => {
      console.info(`[director] ${id}: ${how} after ${time.toFixed(1)} s, ${fallbacks} fallbacks`);
      // A lesson the player just did: tick its box for a moment, with a chime.
      if (how === 'done' && this.shownStep?.id === id && this.shownStep.hint?.kind === 'lesson' && this.shown) {
        this.doneFlash = HINT_SIGN.doneTime;
        this.doneContent = { ...this.shown, done: true, sub: 'Nice!' };
        this.parts.audio.play('lessonDone');
      }
    };
    this.director = director;
    this.running = true;
    console.info('[battle] tutorial started');
  }

  /** Stops everything (stress test, leaving VR). The board is left empty. */
  stop(): void {
    this.running = false;
    this.director = null;
    this.parts.spawner.stop();
    this.parts.panel.hide();
    this.parts.sign.show(null);
    this.parts.markers.hide();
    this.parts.ghost.hide();
  }

  noteEaten(): void {
    this.eatenCount++;
  }

  notePicked(): void {
    this.pickedCount++;
  }

  update(dt: number, hands: HandState[], head: Vector3, forward: Vector3): void {
    const { spawner, flags, panel, goblins, stage } = this.parts;
    this.head.copy(head);
    this.forward.copy(forward);
    // How far the player moved the board (the ring, or the debug keys).
    this.spun += Math.abs(angleDelta(this.lastSpin, stage.spin)) / degToRad(1);
    this.moved += Math.abs(stage.height - this.lastHeight);
    this.lastSpin = stage.spin;
    this.lastHeight = stage.height;
    if (this.running && this.state.phase === 'playing') {
      damageCastle(this.state, goblins.countMode('intruder') * CASTLE_HEALTH.intruderDamagePerSec * dt);
      this.director?.update(dt);
      spawner.rate = this.director?.spawnRate ?? 1;
      spawner.update(dt);
      if (this.state.phase !== 'playing') this.end();
    }
    flags.show(healthShare(this.state), this.state.wavesCleared / this.state.totalWaves);
    flags.update(dt);
    this.updateHint(dt, hands, head, forward);
    if (this.endTimer > 0) {
      this.endTimer -= dt;
      if (this.endTimer <= 0) panel.show(this.state.phase === 'won' ? 'won' : 'lost');
    }
    if (panel.update(hands, dt)) this.start();
  }

  /** The hint sign, the marker and the ghost hand for the current step. */
  private updateHint(dt: number, hands: HandState[], head: Vector3, forward: Vector3): void {
    const { sign, markers, goblins, spawner, ghost } = this.parts;
    sign.update(dt);
    if (!this.running || this.state.phase !== 'playing') {
      sign.show(null);
      markers.hide();
      ghost.hide();
      return;
    }
    if (this.doneFlash > 0) {
      this.doneFlash -= dt;
      sign.show(this.doneContent);
      markers.hide();
      ghost.hide();
      return;
    }
    const step = (this.director?.current ?? null) as TutorialStep | null;
    const hint = step?.hint;
    if (step !== this.shownStep) this.gaze = 0;
    this.shownStep = step;
    if (!hint) {
      this.shown = null;
      sign.show(null);
      markers.hide();
      ghost.hide();
      return;
    }
    const target = this.markerPosition(hint.marker, markerAt);
    // Looking at the marker: the head points within a small cone of it.
    if (target) {
      toMarker.copy(target).sub(head).normalize();
      const looking = toMarker.dot(forward) > Math.cos(degToRad(READING.gazeConeDeg));
      this.gaze = looking ? this.gaze + dt : 0;
    }
    this.updateGhost(dt, hint.demo, hands, head);
    const side = markers.update(dt, target, head, forward);
    let text = hint.text;
    const lessonGoblin = this.lessonGoblin;
    if (hint.whenDropped && lessonGoblin && goblins.isHittable(lessonGoblin)) text = hint.whenDropped;
    let sub: string | undefined;
    if (hint.goblinsLeft) sub = `Goblins left: ${goblins.aliveCount + spawner.remaining}`;
    if (side) sub = `It is to your ${side}. Turn your head or spin the board.`;
    this.shown = { kind: hint.kind, header: hint.header, text, icon: hint.icon && ICONS[hint.icon], sub, next: hint.next };
    sign.show(this.shown);
    // Info steps can be skipped with the sign's "Next" button.
    if (hint.next && sign.pokedNext(hands, dt)) this.director?.skip();
  }

  /** Loops the step's ghost hand demo next to its target, out of the way of the player's own hand. */
  private updateGhost(dt: number, demo: GhostDemoName | undefined, hands: HandState[], head: Vector3): void {
    const { ghost, stage } = this.parts;
    ghost.play(demo);
    if (!demo) return;
    // The seat's directions: right, up, and toward the player, as the board was placed.
    view.right.set(1, 0, 0).applyQuaternion(stage.root.quaternion);
    view.back.set(0, 0, 1).applyQuaternion(stage.root.quaternion);
    view.head.copy(head);
    const anchors = (anchor: GhostAnchor, out: Vector3): Vector3 | null => this.ghostAnchor(anchor, out);
    // Steps out of the way while a real hand is where the demo ends.
    let near = false;
    if (this.ghostAnchor(endAnchor(demo), lastAnchor)) {
      for (const hand of hands) {
        if (hand.tracked && hand.pinchPoint.distanceTo(lastAnchor) < GHOST_HAND.hideNear) near = true;
      }
    }
    ghost.update(dt, anchors, view, near);
  }

  private ghostAnchor(anchor: GhostAnchor, out: Vector3): Vector3 | null {
    switch (anchor) {
      case 'mouth':
        out.copy(this.forward).setY(0).normalize().multiplyScalar(GHOST_HAND.mouthForward).add(this.head);
        out.y -= GHOST_HAND.mouthDown;
        return out;
      case 'lessonGoblin': {
        // Also while held, so the eat demo can start from it.
        const g = this.lessonGoblin;
        if (!g || g.mode === 'dead') return null;
        return this.parts.goblins.centerWorld(g, out);
      }
      default:
        return this.markerPosition(anchor, out);
    }
  }

  private markerPosition(target: MarkerTarget | undefined, out: Vector3): Vector3 | null {
    const { stage, goblins, flags, slingshot } = this.parts;
    switch (target) {
      case 'ring':
        return stage.boardLift.localToWorld(out.set(0, HANDLES.ringY + HANDLES.ringRadius, -HANDLES.radius));
      case 'lessonGoblin': {
        const g = this.lessonGoblin;
        // Only while it is on the board: in the hand it needs no marker.
        if (!g || !goblins.isHittable(g) || this.parts.isHeld(g)) return null;
        goblins.centerWorld(g, out);
        out.y += g.stats.height * 0.01;
        return out;
      }
      case 'healthFlag':
        return flags.clothWorld('health', out);
      case 'waveFlag':
        return flags.clothWorld('wave', out);
      case 'slingHandle':
        return slingshot.partWorld('handle', out);
      case 'bowl':
        return slingshot.partWorld('bowl', out);
      case 'pouch':
        return slingshot.partWorld('pouch', out);
      default:
        return null;
    }
  }

  // ---- Debug ----

  /** Skips the current wave: its goblins run off and the flag climbs (or the next wave starts in a breather). */
  skipWave(): void {
    const director = this.director;
    if (!this.running || !director || this.state.phase !== 'playing') return;
    if (director.current?.id.endsWith('-cleared')) {
      director.skip();
      return;
    }
    this.endWave();
    while (!director.finished && !director.current?.id.endsWith('-cleared')) director.skip();
    director.update(0);
    if (this.state.phase !== 'playing') this.end();
  }

  /** Skips only the current tutorial step. */
  skipStep(): void {
    if (this.running && this.state.phase === 'playing') this.director?.skip();
  }

  loseNow(): void {
    if (!this.running || this.state.phase !== 'playing') return;
    loseCastle(this.state);
    this.end();
  }

  damage(amount: number): void {
    if (!this.running) return;
    damageCastle(this.state, amount);
    if (this.state.phase !== 'playing') this.end();
  }

  /** Win or lose: the battle stops, leftovers run off, and the panel comes up. */
  private end(): void {
    this.parts.spawner.stop();
    this.poofAll();
    this.parts.slingshot.release();
    this.parts.audio.play(this.state.phase === 'won' ? 'win' : 'lose');
    this.endTimer = END_PANEL.showDelay;
    console.info(`[battle] ${this.state.phase}, castle health ${this.state.health.toFixed(0)}`);
  }

  /** Every goblin on the board (not in the hand) runs off with a poof. */
  private poofAll(): void {
    const { goblins, particles, audio } = this.parts;
    for (const g of goblins.list) {
      if (!goblins.isHittable(g)) continue;
      goblins.centerWorld(g, temp);
      particles.burst(temp, POOF_COLORS, 4, 0.15);
      audio.play('poof', temp, 0.6, 0.08);
      goblins.kill(g);
    }
  }

  // ---- TutorialApi ----

  startWave(index: number): void {
    this.wave = index;
    this.parts.spawner.start(TUTORIAL_WAVES[index]);
    const last = index === TUTORIAL_WAVES.length - 1;
    this.parts.audio.play(last ? 'finalRound' : WAVE_VOICES[index] ?? 'finalRound');
    console.info(`[battle] wave ${index + 1} started`);
  }

  waveCleared(): boolean {
    return this.wave >= 0 && this.parts.spawner.allOut && this.parts.goblins.aliveCount === 0;
  }

  endWave(): void {
    this.parts.spawner.stop();
    this.poofAll();
  }

  clearWave(): void {
    clearWave(this.state, CASTLE_HEALTH);
    if (this.state.phase === 'playing') this.parts.audio.play('cheer');
  }

  lessonClimber(onRampart: boolean): void {
    const spread = degToRad(WAVES.frontClimberSpread);
    // The board angle in front of the player right now.
    const angle = this.parts.stage.spin + this.parts.rng.range(-spread, spread);
    const goblin = this.parts.goblins.spawnClimberAt(angle, onRampart, TUTORIAL_TIMING.lessonClimberWait);
    if (goblin) this.lessonGoblin = goblin;
  }

  showTool(tool: ToolName): void {
    if (!BUILT_TOOLS.includes(tool)) {
      console.info(`[battle] ${tool} is not built yet (build steps 4 and 5)`);
      return;
    }
    const { slingshot, stage, particles, audio } = this.parts;
    slingshot.setVisible(true);
    slingshot.beckon = true;
    const { angleDeg, radius } = TOOL_SPOTS.slingshot;
    const a = degToRad(angleDeg);
    stage.fixedRig.localToWorld(temp.set(polarX(radius, a), TOOL_SPOTS.platformTop + 4, polarZ(radius, a)));
    particles.burst(temp, POOF_COLORS, 14);
    audio.play('toolPoof', temp);
  }

  hintTool(tool: ToolName): void {
    if (tool === 'slingshot') this.parts.slingshot.beckon = true;
  }

  helpWithTool(tool: ToolName): void {
    if (tool === 'slingshot') {
      this.parts.slingshot.loadForPlayer();
      this.parts.slingshot.beckon = true;
    }
  }

  toolUses(tool: ToolName): number {
    return tool === 'slingshot' ? this.slingHits : 0;
  }

  boardSpun(): number {
    return this.spun;
  }

  boardMoved(): number {
    return this.moved;
  }

  picked(): number {
    return this.pickedCount;
  }

  eaten(): number {
    return this.eatenCount;
  }

  slingCount(event: SlingEvent): number {
    return this.sling[event];
  }

  slingLoaded(): boolean {
    return this.parts.slingshot.isLoaded;
  }

  gazeTime(): number {
    return this.gaze;
  }
}
