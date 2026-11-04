// Runs one battle: the tutorial director, the win and lose rules, the flags,
// the hint sign with its markers, and the end panel. It is the TutorialApi:
// each director call goes to a game system (wave spawner, goblins,
// slingshot, food tools, food jar), and it counts what the player does for the lessons. Nothing
// tutorial-only lives in those systems.
import { Vector3 } from 'three';
import type { GameAudio } from '../audio/sound.js';
import { CASTLE_HEALTH, DEBUG, END_PANEL, GHOST_HAND, GOBLIN_RULES, HANDLES, HINT_SIGN, TOOL_SPOTS, WAVES } from '../config/game.js';
import { WAVE_VOICES } from '../config/sounds.js';
import type { Particles } from '../fx/particles.js';
import type { HandState } from '../player/hands.js';
import { clearWave, createBattle, damageCastle, healthShare, loseCastle, type BattleState } from '../rules/battle.js';
import { angleDelta, degToRad, polarX, polarZ } from '../rules/boardMath.js';
import { Director } from '../rules/director.js';
import type { Random } from '../rules/random.js';
import type { FoodToolName, HandTool } from '../tools/handTool.js';
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
import type { FoodJar } from '../world/foodJar.js';
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
const BUILT_TOOLS: ToolName[] = ['slingshot', 'swatter', 'pepper'];
const ICONS: Record<HintIcon, UiImageName> = {
  pinch: 'target',
  grab: 'target',
  spin: 'returnArrow',
  up: 'up',
  target: 'target',
  warning: 'warning',
  info: 'info',
  star: 'star',
  trophy: 'trophy',
};
const temp = new Vector3();
const markerAt = new Vector3();
const lastAnchor = new Vector3();
const view: ViewFrame = { head: new Vector3(), up: new Vector3(0, 1, 0), shot: new Vector3() };

export interface BattleParts {
  stage: Stage;
  goblins: Goblins;
  spawner: WaveSpawner;
  slingshot: Slingshot;
  /** The food tools by name (the megaphone and bell come in build step 5). */
  tools: Record<FoodToolName, HandTool>;
  food: FoodJar;
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
  /** True from a wave's start until it is cleared or ended. */
  private inWave = false;
  /**
   * The wave (0 based) the Play button starts at. 0 is the whole tutorial.
   * Set from the debug page's "Start at wave", so testing a later wave does
   * not mean playing the earlier ones every time.
   */
  playFromWave = 0;
  private endTimer = -1;
  /** Time since anything last hurt the castle (seconds), for the stalemate check. */
  private sinceDamage = 0;

  // What the player did in this battle, for the lessons.
  private eatenCount = 0;
  private pickedCount = 0;
  private slingHits = 0;
  private toolUseCount: Record<FoodToolName, number> = { swatter: 0, pepper: 0 };
  private toolGrabCount: Record<FoodToolName, number> = { swatter: 0, pepper: 0 };
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
  private head = new Vector3();
  private forward = new Vector3();

  constructor(private parts: BattleParts) {
    parts.goblins.onWallHit = () => {
      if (!this.running) return;
      damageCastle(this.state, CASTLE_HEALTH.wallHitDamage);
      this.sinceDamage = 0;
    };
    parts.slingshot.onHit = () => this.slingHits++;
    parts.slingshot.onEvent = (event) => this.sling[event]++;
    for (const tool of Object.values(parts.tools)) {
      tool.onUse = (count) => (this.toolUseCount[tool.name] += count);
      tool.onGrab = () => this.toolGrabCount[tool.name]++;
    }
  }

  /** Every food tool hidden (it waits for its wave), and the jar back to the starting food. */
  private resetTools(): void {
    for (const tool of Object.values(this.parts.tools)) tool.setVisible(false);
    this.toolUseCount = { swatter: 0, pepper: 0 };
    this.toolGrabCount = { swatter: 0, pepper: 0 };
    this.parts.food.reset();
  }

  /** The step the tutorial is on, for the debug page. */
  get stepId(): string {
    return this.running ? (this.director?.current?.id ?? 'done') : 'stopped';
  }

  /**
   * A new tutorial battle. From the first lesson, or (debug "Start at wave")
   * from the end of the wave before `fromWave` (0 based): the earlier
   * lessons and waves are left out, their tools are already on their
   * platforms, and the jar has a little more food, like a player who got there.
   */
  start(fromWave = this.playFromWave): void {
    const { goblins, spawner, slingshot, flags, panel, stage, food } = this.parts;
    const from = Math.max(0, Math.min(fromWave, TUTORIAL_WAVES.length - 1));
    spawner.stop();
    goblins.killAll();
    panel.hide();
    // Every tool waits for its wave (docs/giant-tools.md section 6).
    slingshot.setVisible(false);
    slingshot.beckon = false;
    this.resetTools();
    this.state = createBattle(TUTORIAL_WAVES.length, CASTLE_HEALTH);
    // The flag starts one notch below: the first step clears the wave before `from`.
    this.state.wavesCleared = Math.max(0, from - 1);
    flags.show(1, this.state.wavesCleared / this.state.totalWaves, true);
    this.wave = from - 1;
    this.inWave = false;
    this.endTimer = -1;
    this.eatenCount = this.pickedCount = this.slingHits = this.spun = this.moved = 0;
    this.sling = { grabbed: 0, pebbleTaken: 0, loaded: 0, shot: 0 };
    this.lastSpin = stage.spin;
    this.lastHeight = stage.height;
    this.lessonGoblin = null;
    this.shownStep = null;
    this.doneFlash = 0;
    // Tools of the waves left out are already there. The new tool of `from` comes with its lessons.
    for (const wave of TUTORIAL_WAVES.slice(0, from)) {
      const tool = wave.newTool;
      if (tool === 'slingshot') slingshot.setVisible(true);
      else if (tool) this.foodTool(tool)?.setVisible(true);
    }
    if (from > 0) food.add(from * DEBUG.startFoodPerWave);
    const director = new Director<TutorialApi>(buildTutorialSteps(BUILT_TOOLS, TUTORIAL_WAVES, from), this);
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
    console.info(from > 0 ? `[battle] tutorial started at wave ${from + 1}` : '[battle] tutorial started');
  }

  /**
   * Before the battle: an empty, calm board and the welcome panel. Poking its
   * Play button starts the tutorial (the same button as Play again).
   */
  welcome(): void {
    this.stop();
    this.parts.goblins.killAll();
    this.parts.slingshot.setVisible(false);
    this.resetTools();
    this.state = createBattle(TUTORIAL_WAVES.length, CASTLE_HEALTH);
    this.parts.flags.show(1, 0, true);
    this.parts.panel.show('welcome');
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
      const intruders = goblins.countMode('intruder');
      damageCastle(this.state, intruders * CASTLE_HEALTH.intruderDamagePerSec * dt);
      // A goblin the player can reach, or holds, or has in the slingshot is never a
      // stalemate: they can still deal with it, so the wave must wait for them.
      this.sinceDamage = intruders > 0 || goblins.anyInReach() ? 0 : this.sinceDamage + dt;
      // Stalemate: every goblin is out, some are left far away, but none has hurt the castle for a long time.
      if (this.wave >= 0 && spawner.allOut && goblins.aliveCount > 0 && this.sinceDamage > CASTLE_HEALTH.stalemateSeconds) {
        console.info('[battle] stalemate: the leftover goblins run off');
        this.endWave();
        this.sinceDamage = 0;
      }
      this.director?.update(dt);
      spawner.rate = this.director?.spawnRate ?? 1;
      spawner.update(dt);
      if (this.state.phase !== 'playing') this.end();
    }
    flags.show(healthShare(this.state), this.state.wavesCleared / this.state.totalWaves);
    flags.update(dt);
    this.updateHint(dt, hands, head);
    if (this.endTimer > 0) {
      this.endTimer -= dt;
      if (this.endTimer <= 0) panel.show(this.state.phase === 'won' ? 'won' : 'lost');
    }
    if (panel.update(hands, dt)) this.start();
  }

  /** The hint sign, the marker and the ghost hand for the current step. */
  private updateHint(dt: number, hands: HandState[], head: Vector3): void {
    const { sign, markers, goblins, ghost } = this.parts;
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
    this.shownStep = step;
    if (!hint) {
      this.shown = null;
      sign.show(null);
      markers.hide();
      ghost.hide();
      return;
    }
    const target = this.markerPosition(hint.marker, markerAt);
    this.updateGhost(dt, hint.demo, hands, head);
    markers.update(dt, target);
    let text = hint.text;
    const lessonGoblin = this.lessonGoblin;
    if (hint.whenDropped && lessonGoblin && goblins.isHittable(lessonGoblin)) text = hint.whenDropped;
    // A food tool lesson without enough food says so (a climber comes to eat).
    if (hint.whenLocked && hint.tool && !this.canAfford(hint.tool)) text = hint.whenLocked;
    this.shown = { kind: hint.kind, header: hint.header, text, icon: hint.icon && ICONS[hint.icon], next: hint.next };
    sign.show(this.shown);
    // Info steps can be skipped with the sign's "Next" button.
    if (hint.next && sign.pokedNext(hands, dt)) this.director?.skip();
  }

  /** Loops the step's ghost hand demo next to its target, out of the way of the player's own hand. */
  private updateGhost(dt: number, demo: GhostDemoName | undefined, hands: HandState[], head: Vector3): void {
    const { ghost } = this.parts;
    ghost.play(demo);
    if (!demo) return;
    view.head.copy(head);
    this.parts.slingshot.shotDirection(view.shot);
    const anchors = (anchor: GhostAnchor, out: Vector3, arcDeg?: number): Vector3 | null => this.ghostAnchor(anchor, out, arcDeg);
    // Steps out of the way while a real hand is where the demo ends.
    let near = false;
    if (this.ghostAnchor(endAnchor(demo), lastAnchor)) {
      for (const hand of hands) {
        if (hand.tracked && hand.pinchPoint.distanceTo(lastAnchor) < GHOST_HAND.hideNear) near = true;
      }
    }
    ghost.update(dt, anchors, view, near);
  }

  /** Exact points the ghost hand touches (world, meters). */
  private ghostAnchor(anchor: GhostAnchor, out: Vector3, arcDeg = 0): Vector3 | null {
    switch (anchor) {
      case 'ring': {
        // The center of the ring's tube, at an angle along it from the seat's front.
        const a = degToRad(arcDeg);
        return this.parts.stage.boardLift.localToWorld(out.set(polarX(HANDLES.radius, a), HANDLES.ringY, polarZ(HANDLES.radius, a)));
      }
      case 'pebbles':
        return this.parts.slingshot.partWorld('pebbles', out);
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
      case 'foodJar':
        return this.parts.food.topWorld(out);
      case 'swatterHandle':
        return this.parts.tools.swatter.handleWorld(out);
      case 'pepperHandle':
        return this.parts.tools.pepper.handleWorld(out);
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
    for (const tool of Object.values(this.parts.tools)) tool.release();
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
    this.inWave = true;
    this.sinceDamage = 0;
    this.parts.spawner.start(TUTORIAL_WAVES[index]);
    const last = index === TUTORIAL_WAVES.length - 1;
    this.parts.audio.play(last ? 'finalRound' : WAVE_VOICES[index] ?? 'finalRound');
    console.info(`[battle] wave ${index + 1} started`);
  }

  waveCleared(): boolean {
    return this.wave >= 0 && this.parts.spawner.allOut && this.parts.goblins.aliveCount === 0;
  }

  endWave(): void {
    this.inWave = false;
    this.parts.spawner.stop();
    this.poofAll();
  }

  clearWave(): void {
    this.inWave = false;
    clearWave(this.state, CASTLE_HEALTH);
    if (this.state.phase === 'playing') this.parts.audio.play('cheer');
  }

  lessonClimber(onRampart: boolean): void {
    const { goblins, particles, audio, stage, rng } = this.parts;
    // Only one lesson climber at a time: a fallback moves it in front of the
    // player again (they may have spun the board) instead of adding another.
    const old = this.lessonGoblin;
    if (old && goblins.isHittable(old) && !this.parts.isHeld(old)) {
      goblins.centerWorld(old, temp);
      particles.burst(temp, POOF_COLORS, 6, 0.15);
      audio.play('poof', temp, 0.6);
      goblins.kill(old);
    }
    const spread = degToRad(WAVES.frontClimberSpread);
    // The board angle in front of the player right now.
    const angle = stage.spin + rng.range(-spread, spread);
    // Between waves it waits for the player. During a wave it acts like any
    // climber, so it never holds the wave up long after its lesson is over.
    const wait = this.inWave ? GOBLIN_RULES.rampartWait : TUTORIAL_TIMING.lessonClimberWait;
    const goblin = goblins.spawnClimberAt(angle, onRampart, wait);
    if (goblin) this.lessonGoblin = goblin;
  }

  showTool(tool: ToolName): void {
    if (!BUILT_TOOLS.includes(tool)) {
      console.info(`[battle] ${tool} is not built yet (build step 5)`);
      return;
    }
    if (tool !== 'slingshot') {
      const t = this.foodTool(tool);
      if (!t) return;
      // The lessons count what the player does with it from now on.
      this.toolUseCount[t.name] = 0;
      this.toolGrabCount[t.name] = 0;
      t.appear();
      return;
    }
    const { slingshot, stage, particles, audio } = this.parts;
    slingshot.setVisible(true);
    slingshot.beckon = true;
    // The lessons count what the player does with it from now on (see slingshotLessons).
    this.sling = { grabbed: 0, pebbleTaken: 0, loaded: 0, shot: 0 };
    this.slingHits = 0;
    const { angleDeg, radius } = TOOL_SPOTS.slingshot;
    const a = degToRad(angleDeg);
    stage.boardLift.localToWorld(temp.set(polarX(radius, a), TOOL_SPOTS.platformTop + 4, polarZ(radius, a)));
    particles.burst(temp, POOF_COLORS, 14);
    audio.play('toolPoof', temp);
  }

  hintTool(tool: ToolName): void {
    if (tool === 'slingshot') this.parts.slingshot.beckon = true;
    const t = this.foodTool(tool);
    if (t) t.beckon = true;
  }

  helpWithTool(tool: ToolName): void {
    if (tool === 'slingshot') {
      this.parts.slingshot.loadForPlayer();
      this.parts.slingshot.beckon = true;
      return;
    }
    const t = this.foodTool(tool);
    if (!t) return;
    t.beckon = true;
    // The easier way: enough food for one use, or a goblin in reach to use it on.
    if (!t.usable) this.parts.food.add(t.cost - this.parts.food.food);
    else this.lessonClimber(true);
  }

  holdToolTimer(tool: ToolName, on: boolean): void {
    const t = this.foodTool(tool);
    if (t) t.timerHeld = on;
  }

  toolUses(tool: ToolName): number {
    if (tool === 'slingshot') return this.slingHits;
    return tool === 'swatter' || tool === 'pepper' ? this.toolUseCount[tool] : 0;
  }

  toolGrabbed(tool: ToolName): number {
    if (tool === 'slingshot') return this.sling.grabbed;
    return tool === 'swatter' || tool === 'pepper' ? this.toolGrabCount[tool] : 0;
  }

  canAfford(tool: ToolName): boolean {
    if (tool === 'slingshot') return true;
    return this.foodTool(tool)?.usable ?? false;
  }

  /** The food tool by its tutorial name, if it is built. */
  private foodTool(tool: ToolName): HandTool | null {
    return tool === 'swatter' || tool === 'pepper' ? this.parts.tools[tool] : null;
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
}
