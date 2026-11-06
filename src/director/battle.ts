// Runs one battle: the tutorial director, the win and lose rules, the flags,
// the hint sign with its markers, and the end panel. It is the TutorialApi:
// each director call goes to a game system (wave spawner, goblins, troops,
// triggers, slingshot, food tools, food jar), and it counts what the player
// does for the lessons. Nothing tutorial-only lives in those systems.
import { Vector3 } from 'three';
import { mic } from '../audio/mic.js';
import type { GameAudio } from '../audio/sound.js';
import {
  CALIBRATION,
  CASTLE_HEALTH,
  DEBUG,
  END_PANEL,
  GHOST_HAND,
  GOBLIN_RULES,
  HANDLES,
  HINT_SIGN,
  GOBLIN_GEAR,
  BALLOONS,
  TOOL_SPOTS,
  TOOLS,
  WAVES,
} from '../config/game.js';
import { WAVE_VOICES } from '../config/sounds.js';
import type { Particles } from '../fx/particles.js';
import type { HandState } from '../player/hands.js';
import { ReachCheck } from '../player/reachCheck.js';
import { clearWave, createBattle, damageCastle, healthShare, loseCastle, type BattleState } from '../rules/battle.js';
import { angleDelta, degToRad, polarX, polarZ } from '../rules/boardMath.js';
import { Director } from '../rules/director.js';
import type { Random } from '../rules/random.js';
import type { FoodToolName, HandTool } from '../tools/handTool.js';
import type { SlingEvent, Slingshot } from '../tools/slingshot.js';
import type { StunWave } from '../tools/stunWave.js';
import type { Troops } from '../units/troops.js';
import type { Balloons } from '../units/balloons.js';
import type { TriggerKind } from '../rules/blueprint.js';
import type { Trigger, Triggers } from '../world/triggers.js';
import type { EndPanel } from '../ui/endPanel.js';
import { endAnchor, type GhostAnchor, type GhostDemoName } from '../ui/ghostDemos.js';
import type { GhostHand, ViewFrame } from '../ui/ghostHand.js';
import type { HintSign, SignContent } from '../ui/hintSign.js';
import type { Markers } from '../ui/markers.js';
import type { ThreatCues } from '../ui/threatCues.js';
import type { UiImageName } from '../ui/uiImages.js';
import type { Goblin, Goblins } from '../units/goblins.js';
import type { WaveSpawner } from '../units/waveSpawner.js';
import type { Flags } from '../world/flags.js';
import type { FoodJar } from '../world/foodJar.js';
import type { Stage } from '../world/stage.js';
import {
  buildTutorialSteps,
  firstBalloonWave,
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
const BUILT_TOOLS: ToolName[] = ['slingshot', 'swatter', 'pepper', 'megaphone'];
const noTools = (): Record<FoodToolName, number> => ({ swatter: 0, pepper: 0, megaphone: 0, bell: 0 });
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
  /** The food tools by name (the megaphone and the bell share a platform and a lesson). */
  tools: Record<FoodToolName, HandTool>;
  /** The army: squads walk out while a wave is fought. */
  troops: Troops;
  /** Keg, boulder and tree on the roads, reset at each wave. */
  triggers: Triggers;
  /** Balloon riders (from wave 4). */
  balloons: Balloons;
  /** The stun of the megaphone and the bell. */
  stun: StunWave;
  food: FoodJar;
  flags: Flags;
  panel: EndPanel;
  sign: HintSign;
  markers: Markers;
  ghost: GhostHand;
  audio: GameAudio;
  particles: Particles;
  /** Wall hit flashes and the attack compass (seeing attacks without sound). */
  threat: ThreatCues;
  rng: Random;
  /** True while a hand holds this goblin. */
  isHeld: (goblin: Goblin) => boolean;
  /** A wave was won (juice: confetti over the castle; `won`: the whole battle, with fireworks). */
  celebrate: (won: boolean) => void;
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
  /** The reach check at the start (only until the player's reach is known). */
  private reach = new ReachCheck();
  /** True once the board was sized to this player (saved in the browser). */
  private reachKnown = false;
  private endTimer = -1;
  /** Time since anything last hurt the castle (seconds), for the stalemate check. */
  private sinceDamage = 0;

  // What the player did in this battle, for the lessons.
  private eatenCount = 0;
  private pickedCount = 0;
  private slingHits = 0;
  private toolUseCount = noTools();
  private toolGrabCount = noTools();
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
    parts.goblins.onWallHit = (goblin) => {
      parts.threat.wallHit(goblin);
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
    // A tick on each second of the reach check's countdown.
    this.reach.onTick = () => parts.audio.play('readyTick');
    this.loadBoardScale();
  }

  /** The board size saved by an earlier reach check, if any. */
  private loadBoardScale(): void {
    try {
      const saved = Number(localStorage.getItem(CALIBRATION.storageKey));
      if (saved >= CALIBRATION.minScale && saved <= CALIBRATION.maxScale) {
        this.reachKnown = true;
        this.parts.stage.setBoardScale(saved, false);
        console.info(`[reach] board size ${saved.toFixed(2)} (saved)`);
      }
    } catch {
      // No storage: the reach check runs at the start of each battle.
    }
  }

  /**
   * Debug: forgets the measured reach. The board goes back to its config size,
   * and the reach check runs again at the start of the next battle.
   */
  forgetReach(): void {
    this.reachKnown = false;
    this.parts.stage.setBoardScale(1, true);
    try {
      localStorage.removeItem(CALIBRATION.storageKey);
    } catch {
      // Nothing saved.
    }
    console.info('[reach] forgotten: the reach check runs again');
  }

  /** Every food tool hidden (it waits for its wave), free while the tutorial runs, and the jar back to the starting food. */
  private resetTools(): void {
    for (const tool of Object.values(this.parts.tools)) {
      tool.setVisible(false);
      // The only battle is the tutorial for now.
      tool.free = TOOLS.freeInTutorial;
    }
    this.toolUseCount = noTools();
    this.toolGrabCount = noTools();
    this.parts.food.reset();
    this.parts.stun.reset();
  }

  /** The army and the triggers off the board (before a battle, or when it stops). */
  private clearBoard(): void {
    this.parts.troops.clear();
    this.parts.triggers.hideAll();
    this.parts.balloons.clear();
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
    this.clearBoard();
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
      else if (tool) for (const t of this.foodTools(tool)) t.setVisible(true);
    }
    if (from > 0) food.add(from * DEBUG.startFoodPerWave);
    this.reach.stop();
    const director = new Director<TutorialApi>(buildTutorialSteps(BUILT_TOOLS, TUTORIAL_WAVES, from, !this.reachKnown), this);
    director.onStepEnd = (id, how, time, fallbacks) => {
      console.info(`[director] ${id}: ${how} after ${time.toFixed(1)} s, ${fallbacks} fallbacks`);
      // A lesson the player just did: tick its box for a moment, with a chime.
      if (how === 'done' && this.shownStep?.id === id && this.shownStep.hint?.kind === 'lesson' && this.shown) {
        this.doneFlash = HINT_SIGN.doneTime;
        const doneText = this.shownStep.hint.doneText;
        this.doneContent = { ...this.shown, text: doneText ?? this.shown.text, done: true, sub: 'Nice!' };
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
    this.clearBoard();
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
    this.reach.stop();
    this.parts.spawner.stop();
    this.clearBoard();
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
      // Stunned intruders smash nothing.
      const intruders = goblins.countMode('intruder', true);
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
      this.reach.update(dt, hands, head);
      this.director?.update(dt);
      // No soldiers come out while something is taught: the lesson needs goblins, and the soldiers would knock them out first.
      const step = (this.director?.current ?? null) as TutorialStep | null;
      this.parts.troops.held = step?.hint?.kind === 'lesson';
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
    this.updateGhost(dt, !mic.on && hint.demoNoMic ? hint.demoNoMic : hint.demo, hands, head);
    markers.update(dt, target);
    // No mic: the bell is out in place of the megaphone, with its own words and demo.
    let text = !mic.on && hint.whenNoMic ? hint.whenNoMic : hint.text;
    const lessonGoblin = this.lessonGoblin;
    if (hint.whenDropped && lessonGoblin && goblins.isHittable(lessonGoblin)) text = hint.whenDropped;
    // A food tool lesson without enough food says so (a climber comes to eat).
    if (hint.whenLocked && hint.tool && !this.canAfford(hint.tool)) text = hint.whenLocked;
    // The reach check counts down while the arm is out, so the player knows when to rest.
    if (hint.reachCheck && this.reach.phase === 'counting') text = `Great, hold it there... ${this.reach.secondsLeft}`;
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
      case 'reach': {
        // The right hand stretched straight out in front of the right shoulder, a little low.
        temp.copy(this.forward).setY(0).normalize();
        out.copy(this.head).addScaledVector(temp, CALIBRATION.demoForward);
        out.x += -temp.z * CALIBRATION.demoRight;
        out.z += temp.x * CALIBRATION.demoRight;
        out.y -= CALIBRATION.demoDown;
        return out;
      }
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
        out.y += g.stats.height * 0.01 * this.parts.stage.boardScale;
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
      case 'bellHandle':
        return this.parts.tools.bell.handleWorld(out);
      case 'megaphoneHandle':
        return this.parts.tools.megaphone.handleWorld(out);
      case 'stunTool':
        return this.stunTool().handleWorld(out);
      case 'slingHandle':
        return slingshot.partWorld('handle', out);
      case 'bowl':
        return slingshot.partWorld('bowl', out);
      case 'pouch':
        return slingshot.partWorld('pouch', out);
      case 'lessonTrigger': {
        const t = this.lessonTrigger;
        return t && t.standing ? this.parts.triggers.topWorld(t, out) : null;
      }
      case 'wristButton':
        return this.parts.wristButton(out);
      case 'balloon': {
        const b = this.parts.balloons.nearest(stage.spin);
        if (!b) return null;
        b.center(out);
        out.y += 8;
        return stage.boardSpin.localToWorld(out);
      }
      case 'baitGoblin': {
        const g = this.parts.bait.first();
        if (!g || this.parts.isHeld(g)) return null;
        goblins.centerWorld(g, out);
        out.y += g.stats.height * 0.01 * this.parts.stage.boardScale;
        return out;
      }
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
    this.parts.troops.recall();
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
    const plan = TUTORIAL_WAVES[index];
    // Helmets from their wave on. The first balloon wave holds its balloons until the balloon banner shows.
    this.parts.goblins.helmetsOn = index + 1 >= GOBLIN_GEAR.helmetFromWave;
    this.parts.spawner.balloonsHeld = index === firstBalloonWave(TUTORIAL_WAVES);
    this.parts.spawner.start(plan);
    // The army marches out toward the attacking camps, and the triggers of this wave stand ready.
    this.parts.troops.deploy(plan.camps);
    this.parts.triggers.setWave(index + 1);
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
    this.parts.troops.recall();
    this.poofAll();
  }

  clearWave(): void {
    this.inWave = false;
    this.parts.troops.recall();
    clearWave(this.state, CASTLE_HEALTH);
    if (this.state.phase === 'playing') this.parts.audio.play('cheer');
    // The soldiers on the field cheer, and confetti flutters down over the castle.
    this.parts.troops.cheerAll();
    this.parts.celebrate(this.state.phase === 'won');
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
      // The megaphone and the bell come together.
      for (const t of this.foodTools(tool)) {
        // The lessons count what the player does with it from now on.
        this.toolUseCount[t.name] = 0;
        this.toolGrabCount[t.name] = 0;
        t.appear();
      }
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
    for (const t of this.foodTools(tool)) t.beckon = true;
  }

  helpWithTool(tool: ToolName): void {
    if (tool === 'slingshot') {
      this.parts.slingshot.loadForPlayer();
      this.parts.slingshot.beckon = true;
      return;
    }
    const tools = this.foodTools(tool);
    if (tools.length === 0) return;
    for (const t of tools) t.beckon = true;
    // The easier way: enough food for one use, or a goblin in reach to use it on.
    if (!this.canAfford(tool)) this.parts.food.add(tools[0].cost - this.parts.food.food);
    else this.lessonClimber(true);
  }

  holdToolTimer(tool: ToolName, on: boolean): void {
    for (const t of this.foodTools(tool)) t.timerHeld = on;
  }

  startReachCheck(): void {
    this.reach.start();
  }

  /** Done: the board grows (or shrinks) to the player's reach, and the size is saved. */
  reachChecked(): boolean {
    if (this.reach.phase !== 'done') return false;
    this.reach.stop();
    const scale = this.reach.scale;
    this.reachKnown = true;
    this.parts.stage.setBoardScale(scale, true);
    try {
      localStorage.setItem(CALIBRATION.storageKey, scale.toFixed(3));
    } catch {
      // No storage: it is measured again next battle.
    }
    console.info(`[reach] reach ${(this.reach.reach * 100).toFixed(0)} cm, board size ${scale.toFixed(2)}`);
    return true;
  }

  stopReachCheck(): void {
    this.reach.stop();
    console.info('[reach] no stretched arm seen: the board keeps its size');
  }

  toolUses(tool: ToolName): number {
    if (tool === 'slingshot') return this.slingHits;
    let count = 0;
    for (const t of this.foodTools(tool)) count += this.toolUseCount[t.name];
    return count;
  }

  toolGrabbed(tool: ToolName): number {
    if (tool === 'slingshot') return this.sling.grabbed;
    let count = 0;
    for (const t of this.foodTools(tool)) count += this.toolGrabCount[t.name];
    return count;
  }

  /** True if the tool (for the megaphone: it or the bell) can be used now. */
  canAfford(tool: ToolName): boolean {
    if (tool === 'slingshot') return true;
    return this.foodTools(tool).some((t) => t.usable);
  }

  /** The food tools of a tutorial tool name: the megaphone lessons are about the stun tool that is out. */
  private foodTools(tool: ToolName): HandTool[] {
    const { tools } = this.parts;
    if (tool === 'swatter' || tool === 'pepper') return [tools[tool]];
    if (tool === 'megaphone') return [this.stunTool()];
    return [];
  }

  /**
   * The stun tool for this player: the megaphone when the mic is on, the
   * bell when it is not. Only one of them is ever out. (A setting for a
   * quiet bell with the mic on comes later.)
   */
  private stunTool(): HandTool {
    return mic.on ? this.parts.tools.megaphone : this.parts.tools.bell;
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

  startTriggerLesson(kind: TriggerKind): void {
    const { triggers, stage } = this.parts;
    // Its kind comes onto the roads now, if it was not there yet.
    triggers.revealKind(kind);
    // The one nearest the front of the board right now (the player may have spun it).
    this.lessonTrigger = triggers.readyNearest(kind, stage.spin);
    if (this.lessonTrigger) triggers.baitGroup(this.lessonTrigger, TRIGGERS.lesson.group);
  }

  sendPastTrigger(): void {
    const kind = this.lessonTrigger?.kind ?? 'keg';
    if (!this.lessonTrigger?.standing) this.lessonTrigger = this.parts.triggers.readyNearest(kind, this.parts.stage.spin);
    // Only the goblins that are gone (picked up, or knocked out another way) are replaced.
    if (this.lessonTrigger) this.parts.triggers.baitGroup(this.lessonTrigger, TRIGGERS.lesson.group);
    this.parts.markers.pulse();
  }

  endTriggerLesson(): void {
    this.parts.goblins.releaseWaiting();
  }

  baitMoving(): void {
    this.parts.bait.patrol(this.parts.stage.spin);
  }

  baitForTool(): void {
    this.parts.bait.onRampart(this.parts.stage.spin);
  }

  releaseBait(): void {
    this.parts.bait.release();
  }

  triggersSetOff(kind: TriggerKind): number {
    return this.triggerCount[kind];
  }

  balloonIntro(): void {
    const { balloons, spawner, stage, rng } = this.parts;
    spawner.balloonsHeld = false;
    // One balloon right in front of the player (the board angle in front now), already on its way in.
    balloons.spawn(stage.spin + degToRad(rng.range(-6, 6)), BALLOONS.introRadius);
  }

  pausedCount(): number {
    return this.pauses;
  }
}
