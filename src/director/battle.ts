// Runs one battle: the tutorial director, the win and lose rules, the flags,
// the hint sign with its arrow, and the end panel. It is the TutorialApi:
// each director call goes to a game system (wave spawner, goblins, troops,
// triggers, slingshot, food tools, food jar), and it counts what the player
// does for the lessons. Nothing tutorial-only lives in those systems.
import { Vector3 } from 'three';
import { hornHearsMic } from '../player/accessSettings.js';
import type { GameAudio } from '../audio/sound.js';
import {
  CALIBRATION,
  CASTLE,
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
  TRIGGERS,
  WAVES,
} from '../config/game.js';
import { WAVE_VOICES } from '../config/sounds.js';
import type { Particles } from '../fx/particles.js';
import type { HandState } from '../player/hands.js';
import { ReachCheck } from '../player/reachCheck.js';
import { clearWave, createBattle, damageCastle, healthShare, loseCastle, type BattleState } from '../rules/battle.js';
import { angleDelta, degToRad, polarX, polarZ } from '../rules/boardMath.js';
import { wallHitDamage } from '../rules/gear.js';
import { Director } from '../rules/director.js';
import type { Random } from '../rules/random.js';
import type { HandToolName, HandTool, ToolSpot } from '../tools/handTool.js';
import type { SlingEvent, Slingshot } from '../tools/slingshot.js';
import type { StunWave } from '../tools/stunWave.js';
import type { Troops } from '../units/troops.js';
import type { Balloons } from '../units/balloons.js';
import type { TriggerKind } from '../rules/blueprint.js';
import type { Trigger, Triggers } from '../world/triggers.js';
import type { EndPanel } from '../ui/endPanel.js';
import { endAnchor, type GhostAnchor, type GhostDemoName } from '../ui/ghostDemos.js';
import type { GhostAim } from '../ui/ghostAim.js';
import type { PointerArrow } from '../ui/pointerArrow.js';
import type { LessonBait } from '../units/lessonBait.js';
import type { GhostHand, ViewFrame } from '../ui/ghostHand.js';
import type { HintSign, SignContent } from '../ui/hintSign.js';
import type { ThreatCues } from '../ui/threatCues.js';
import type { UiImageName } from '../ui/kit/index.js';
import type { Goblin, Goblins } from '../units/goblins.js';
import type { WaveSpawner } from '../units/waveSpawner.js';
import type { Flags } from '../world/flags.js';
import type { RisingCamps } from '../world/risingCamps.js';
import type { Level, LevelRules } from '../level/level.js';
import { buildLevelSteps, hiddenAtStart, levelWavePlans, risingByWave } from './levelDirector.js';
import type { Stage } from '../world/stage.js';
import {
  buildTutorialSteps,
  TUTORIAL_TIMING,
  TUTORIAL_WAVES,
  type HintIcon,
  type HornSteps,
  type MarkerTarget,
  type ToolName,
  type TutorialApi,
  type TutorialStep,
  type WavePlan,
} from './tutorial.js';

const POOF_COLORS = [0xffffff, 0xddd6c8, 0xb8b0a0];
/** Tools that are built so far. The tutorial leaves out lessons for the others. */
const BUILT_TOOLS: ToolName[] = ['slingshot', 'swatter', 'pepper', 'horn', 'bell'];
const noTools = (): Record<HandToolName, number> => ({ swatter: 0, pepper: 0, bell: 0, horn: 0 });
const noTriggers = (): Record<TriggerKind, number> => ({ keg: 0, boulder: 0, tree: 0 });
/** The tool a lesson's marker belongs to, so only that tool works during it (the others are locked). */
const MARKER_TOOL: Partial<Record<MarkerTarget, ToolName>> = {
  swatterHandle: 'swatter',
  pepperHandle: 'pepper',
  hornHandle: 'horn',
  bellHandle: 'bell',
  slingHandle: 'slingshot',
  bowl: 'slingshot',
  pouch: 'slingshot',
  lessonTrigger: 'slingshot',
  balloon: 'slingshot',
};
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
const pouchAt = new Vector3();
const lastAnchor = new Vector3();
const view: ViewFrame = { head: new Vector3(), up: new Vector3(0, 1, 0), shot: new Vector3(), aim: new Vector3() };

export interface BattleParts {
  stage: Stage;
  goblins: Goblins;
  spawner: WaveSpawner;
  slingshot: Slingshot;
  /** The hand tools by name. */
  tools: Record<HandToolName, HandTool>;
  /** The army: squads walk out while a wave is fought. */
  troops: Troops;
  /** Keg, boulder and tree on the roads, reset at each wave. */
  triggers: Triggers;
  /** Balloon riders (from wave 4). */
  balloons: Balloons;
  /** The stun of the bell. */
  stun: StunWave;
  flags: Flags;
  panel: EndPanel;
  sign: HintSign;
  ghost: GhostHand;
  /** Ghost aim dots from the pouch to the first trigger lesson's keg. */
  ghostAim: GhostAim;
  /** The gold 3D arrow that points at the lesson's target: in front of the face, or right over it once in view (the only marker). */
  pointer: PointerArrow;
  /** Goblins brought just for a tool's use lesson. */
  bait: LessonBait;
  /** Where the horn is in its lesson: not held, aiming, a spot to lock, locked at the lips (src/ui/hornAim.ts). */
  hornState: () => 'idle' | 'aim' | 'lift' | 'blow';
  /** The pause button in front (world), while it shows, for the pause lesson's marker. */
  pauseButton: (out: Vector3) => Vector3 | null;
  audio: GameAudio;
  particles: Particles;
  /** Wall hit flashes and the attack compass (seeing attacks without sound). */
  threat: ThreatCues;
  rng: Random;
  /** True while a hand holds this goblin. */
  isHeld: (goblin: Goblin) => boolean;
  /** A wave was won (juice: confetti over the castle; `won`: the whole battle, with fireworks). */
  celebrate: (won: boolean) => void;
  /** The camps that wait under the ground and rise with their wave. */
  camps: RisingCamps;
  /** The wall garrison's size and refill: a level's rules, or null for the usual (GARRISON). */
  setGarrison: (rules: LevelRules | null) => void;
}

export class Battle implements TutorialApi {
  state: BattleState = createBattle(TUTORIAL_WAVES.length, CASTLE_HEALTH);
  /** False before the first start and while the stress test runs. */
  running = false;
  private director: Director<TutorialApi> | null = null;
  private wave = -1;
  /** True from a wave's start until it is cleared or ended. */
  private inWave = false;
  /** How many battles were started (the time of day jumps to the first wave's time on a new one). */
  starts = 0;
  /**
   * The wave (0 based) the Play button starts at. 0 is the whole tutorial.
   * Set from the debug page's "Start at wave", so testing a later wave does
   * not mean playing the earlier ones every time.
   */
  playFromWave = 0;
  /** The battle teaches (the tutorial's lessons). False after Skip tutorial, until the welcome panel's Play. */
  private teach = true;
  /**
   * v2 run 2: the 2 picked hand tools for a battle without the tutorial (the
   * slingshot and the horn are always out), or null for every tool. Every
   * tool stands on its own platform spot, picked or not.
   */
  loadout: HandToolName[] | null = null;
  /** The campaign level being fought (its number), or null (the tutorial, or a debug battle). */
  level: number | null = null;
  /**
   * The waves this battle plays: the tutorial's, or a level's (playLevel).
   * With a level, its own wave director plays them (src/director/levelDirector.ts)
   * and its rules set the garrison and the castle's starting health.
   */
  private waves: WavePlan[] = TUTORIAL_WAVES;
  private levelRules: LevelRules | null = null;
  /** The camps that rise at each wave (0 based), for the waves above. */
  private rising: string[][] = risingByWave(TUTORIAL_WAVES);
  /** Each tool's own spot, from when it was built. */
  private homeSpots = new Map<HandTool, ToolSpot>();
  /**
   * The battle is over and the end moment has passed: what comes next. The
   * game answers 'menu' (no end panel, it goes to the menu: the tutorial
   * won), or how the end panel shows (stars, a Menu button).
   */
  onEnd: (won: boolean, healthShare: number) => 'menu' | { stars?: number; menu: boolean } = () => ({ menu: false });
  /** The end panel's Menu button. */
  onMenu: () => void = () => {};
  /** The welcome panel's Skip tutorial (the game: to the menu). */
  onSkip: () => void = () => this.skipTutorial();
  /** The reach check at the start (only until the player's reach is known). */
  private reach = new ReachCheck();
  /** True once the board was sized to this player (saved in the browser). */
  private reachKnown = false;
  private endTimer = -1;
  /** Time since anything last hurt the castle (seconds), for the stalemate check. */
  private sinceDamage = 0;
  /** The stalemate's progress check: time to the next look, and how close the nearest goblin was then (cm). */
  private progressTimer = 0;
  private lastClosest = Infinity;

  // What the player did in this battle, for the lessons.
  private eatenCount = 0;
  private pepperedEatenCount = 0;
  private pickedCount = 0;
  /** Goblins thrown away (fast enough, GOBLIN_RULES.tossLessonSpeed). */
  private tossedCount = 0;
  private slingHits = 0;
  private toolUseCount = noTools();
  private toolGrabCount = noTools();
  private sling: Record<SlingEvent, number> = { grabbed: 0, pebbleTaken: 0, loaded: 0, shot: 0 };
  private spun = 0;
  private moved = 0;
  private lastSpin = 0;
  private lastHeight = 0;
  private lessonGoblin: Goblin | null = null;
  /** The horn lesson's pace: how long the horn has been held (looking around), and how long it has been locked (seconds). */
  private hornLookTime = 0;
  private hornLockTime = 0;
  /**
   * The horn lesson shows "spot set" right now: the horn waits (no bar, no
   * call) until the sign says to blow. The game passes it to the horn.
   */
  hornWaiting = false;
  /** The goblins sent at the knights after the horn lesson (with their serials, as goblins are reused). */
  private squadFoes: { g: Goblin; serial: number }[] = [];
  /** The powder keg of the trigger lesson, and how many triggers of each kind were set off. */
  private lessonTrigger: Trigger | null = null;
  private triggerCount = noTriggers();
  private pauses = 0;
  /** "Measure reach" from the pause panel: the reach check runs on a frozen battle, then play goes on. */
  private measureTime = -1;
  private measureDone = 0;

  // The hint sign.
  private shownStep: TutorialStep | null = null;
  private shown: SignContent | null = null;
  /** A finished lesson keeps its ticked box up this long (seconds). */
  private doneFlash = 0;
  private doneContent: SignContent | null = null;
  /** The ticked lesson was a glass lesson: its tick shows on the glass sign. */
  private doneGlass = false;
  /**
   * The current glass lesson's text (Hint.glass), or null: the game shows it
   * on the glass sign that follows the look (with the horn's live bar while
   * the horn is at the lips), instead of the hint sign.
   */
  glassText: string | null = null;
  private head = new Vector3();
  private forward = new Vector3();

  constructor(private parts: BattleParts) {
    parts.goblins.onWallHit = (goblin) => {
      parts.threat.wallHit(goblin);
      if (!this.running) return;
      // A spear hits the wall twice as hard (v2, src/rules/gear.ts).
      damageCastle(this.state, wallHitDamage(CASTLE_HEALTH.wallHitDamage, goblin.weapon, GOBLIN_GEAR.spearWallDamage));
      this.sinceDamage = 0;
    };
    // A climber running on the rampart: the wall under it flashes red like a hit (no damage).
    parts.goblins.onRampartStep = (goblin) => parts.threat.wallHit(goblin, false);
    parts.slingshot.onHit = () => this.slingHits++;
    parts.slingshot.onEvent = (event) => this.sling[event]++;
    for (const tool of Object.values(parts.tools)) {
      this.homeSpots.set(tool, tool.spotNow);
      tool.onUse = (count) => (this.toolUseCount[tool.name] += count);
      tool.onGrab = () => this.toolGrabCount[tool.name]++;
    }
    parts.triggers.onSetOffKind = (kind) => this.triggerCount[kind]++;
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

  /** Every hand tool hidden (it waits for its wave) and ready (hiding a tool makes it ready). */
  private resetTools(): void {
    for (const tool of Object.values(this.parts.tools)) {
      tool.setVisible(false);
      tool.quiet = false;
    }
    this.parts.slingshot.locked = false;
    this.toolUseCount = noTools();
    this.toolGrabCount = noTools();
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
   * lessons and waves are left out, and their tools are already on their
   * platforms, like a player who got there.
   */
  start(fromWave = this.playFromWave, teach = this.teach): void {
    const { goblins, spawner, slingshot, flags, panel, stage } = this.parts;
    // A level never teaches (its own director plays it).
    if (this.levelRules) teach = false;
    // Without the tutorial (Skip tutorial) the battle starts at wave 1 with every tool out.
    const from = teach ? Math.max(0, Math.min(fromWave, this.waves.length - 1)) : 0;
    this.teach = teach;
    spawner.stop();
    goblins.killAll();
    this.clearBoard();
    panel.hide();
    // Every tool waits for its wave (docs/giant-tools.md section 6).
    slingshot.setVisible(false);
    slingshot.beckon = false;
    this.resetTools();
    // The wall garrison stands on the rampart from the start (v2), as big as the level says.
    this.parts.setGarrison(this.levelRules);
    this.parts.troops.manWalls();
    this.state = this.newState();
    // Camps that rise at this wave or later wait under the ground (docs/custom-mode.md section 7).
    this.parts.camps.setHidden(hiddenAtStart(this.waves, from));
    // The flag starts one notch below: the first step clears the wave before `from`.
    this.state.wavesCleared = Math.max(0, from - 1);
    flags.show(1, this.state.wavesCleared / this.state.totalWaves, true);
    this.wave = from - 1;
    this.inWave = false;
    this.starts++;
    this.endTimer = -1;
    this.eatenCount = this.pepperedEatenCount = this.pickedCount = this.tossedCount = this.slingHits = this.spun = this.moved = 0;
    this.sling = { grabbed: 0, pebbleTaken: 0, loaded: 0, shot: 0 };
    this.lastSpin = stage.spin;
    this.lastHeight = stage.height;
    this.lessonGoblin = null;
    this.squadFoes = [];
    this.lessonTrigger = null;
    this.triggerCount = noTriggers();
    this.pauses = 0;
    this.shownStep = null;
    this.doneFlash = 0;
    // Every tool on its own platform, always (the loadout only picks which show). Moving the picks to the
    // left spots put a tool in front of the red flag, so they stay home now.
    const picks: HandToolName[] | null = !teach && this.loadout ? this.loadout.filter((n) => n !== 'horn') : null;
    for (const tool of Object.values(this.parts.tools)) tool.setSpot(this.homeSpots.get(tool)!);
    if (picks) {
      // A battle with a loadout: the slingshot, the horn and the 2 picks (docs/menus.md section 5).
      slingshot.setVisible(true);
      this.parts.tools.horn.setVisible(true);
      for (const name of picks) this.parts.tools[name].setVisible(true);
    } else {
      // Tools of the waves left out are already there. The new tool of `from` comes with its lessons.
      // Without the tutorial and without a loadout (debug): every tool.
      for (const wave of teach ? this.waves.slice(0, from) : this.waves) {
        const tool = wave.newTool;
        if (tool === 'slingshot') slingshot.setVisible(true);
        else if (tool) for (const t of this.foodTools(tool)) t.setVisible(true);
      }
      if (!teach) for (const t of Object.values(this.parts.tools)) t.setVisible(true);
    }
    this.reach.stop();
    const steps = this.levelRules ? buildLevelSteps(this.waves) : buildTutorialSteps(BUILT_TOOLS, this.waves, from, !this.reachKnown, teach);
    const director = new Director<TutorialApi>(steps, this);
    director.onStepEnd = (id, how, time, fallbacks) => {
      console.info(`[director] ${id}: ${how} after ${time.toFixed(1)} s, ${fallbacks} fallbacks`);
      const step = this.shownStep?.id === id ? this.shownStep : null;
      const shown = step?.hint;
      this.missingFor = 0;
      this.clearBeckons();
      // A lesson the player just did: a chime and a green tick on its box. How long the tick stays before the
      // next instruction depends on the lesson (TutorialStep.afterDone): a pause only where the player needs one
      // (watch what they set off, finish a pull, rest the arm), otherwise just a short tick.
      if (how === 'done' && shown?.kind === 'lesson' && this.shown) {
        const pause = step?.afterDone ?? HINT_SIGN.doneTime;
        this.parts.audio.play('lessonDone');
        if (pause > 0) {
          this.doneFlash = pause;
          this.doneGlass = !!shown.glass;
          this.doneContent = { ...this.shown, text: shown.doneText ?? this.shown.text, done: true, sub: 'Nice!' };
          director.waitBeforeNext(pause);
        }
      } else if (shown) {
        // Any other step the player saw: a short quiet gap, so two signs never come right on top of each other.
        director.waitBeforeNext(HINT_SIGN.stepGap);
      }
    };
    this.director = director;
    this.running = true;
    console.info(
      this.levelRules
        ? `[battle] level started (${this.waves.length} waves)`
        : !teach
          ? '[battle] started without the tutorial'
          : from > 0
            ? `[battle] tutorial started at wave ${from + 1}`
            : '[battle] tutorial started',
    );
  }

  /**
   * A level battle (Custom Game now, the campaign files later): its waves,
   * played by the level's director, with its rules. The game loads the
   * level's map first. Restart and Play again play the same level.
   */
  playLevel(level: Level): void {
    this.useLevel(level);
    this.start(0, false);
  }

  /** A level's waves and rules from now on (playLevel starts it). */
  useLevel(level: Level): void {
    this.waves = levelWavePlans(level);
    this.rising = risingByWave(this.waves);
    this.levelRules = level.rules;
  }

  /** The camps that rise later go under the ground now (Fight poked: before the battle rises, so none pops away). */
  hideLaterCamps(): void {
    this.parts.camps.setHidden(hiddenAtStart(this.waves, 0));
  }

  /** Back to the tutorial's waves and the usual rules (the tutorial, the campaign until its level files exist, debug battles). */
  useTutorialWaves(): void {
    this.waves = TUTORIAL_WAVES;
    this.rising = risingByWave(TUTORIAL_WAVES);
    this.levelRules = null;
  }

  /** True while the waves are a level's (playLevel). */
  get playingLevel(): boolean {
    return this.levelRules !== null;
  }

  /** How many waves this battle has (the blue flag's notches, the times of day). */
  get totalWaves(): number {
    return this.waves.length;
  }

  /** A fresh battle state: a level may start with the castle already damaged. */
  private newState(): BattleState {
    const state = createBattle(this.waves.length, CASTLE_HEALTH);
    const start = this.levelRules?.startHealth ?? 1;
    state.health = state.maxHealth * Math.max(0.05, Math.min(1, start));
    return state;
  }

  /**
   * Skip tutorial (welcome panel, pause panel): a fresh battle from wave 1
   * with every tool out and no lessons, for a player who knows the game (for
   * example after clearing the browser's data). Restart and Play again keep
   * it that way; the welcome panel's Play brings the tutorial back.
   */
  skipTutorial(): void {
    this.start(0, false);
  }

  /** True while a battle with the tutorial runs (the pause panel's Skip tutorial shows only then). */
  get teaching(): boolean {
    return this.running && this.teach;
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
    this.state = createBattle(this.waves.length, CASTLE_HEALTH);
    this.parts.camps.showAll();
    this.parts.flags.show(1, 0, true);
    this.parts.panel.show('welcome');
  }

  /**
   * Into the menu (v2 run 2): no battle, an empty board, every tool put away.
   * The game sinks the battleground first, then calls this.
   */
  clearForMenu(): void {
    this.stop();
    this.endTimer = -1;
    this.parts.goblins.killAll();
    this.parts.slingshot.setVisible(false);
    this.resetTools();
    this.state = createBattle(this.waves.length, CASTLE_HEALTH);
    // The living board around the menu has every camp up.
    this.parts.camps.showAll();
    this.parts.flags.show(1, 0, true);
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
    this.parts.pointer.hide();
    this.parts.ghost.hide();
  }

  /** True while a battle is being fought (the pause button and auto-pause only work then). */
  get canPause(): boolean {
    return this.running && this.state.phase === 'playing';
  }

  /**
   * A lesson's yellow arrow shows where to look right now, so the
   * red threat arrow stays away (it would point at the same lesson goblins).
   */
  lessonPointing = false;

  /** Paused: the sign, the arrow and the ghost hand step away. The next update brings them back. */
  hideHints(): void {
    this.lessonPointing = false;
    this.parts.sign.show(null);
    this.parts.ghost.hide();
    this.parts.ghostAim.hide();
    this.parts.pointer.hide();
  }

  /** The game was paused and play goes on again (for the pause lesson). */
  notePaused(): void {
    this.pauses++;
  }

  /**
   * "Measure reach" on the pause panel: the reach check, without starting the
   * battle again. The battle stays frozen while the player stretches out an
   * arm, then the board grows or shrinks to them and play goes on.
   */
  startMeasure(): void {
    this.hideHints();
    this.measureTime = 0;
    this.measureDone = 0;
    this.reach.start();
  }

  /** Every frame while measuring. Returns true when it is over (measured, or given up without hands). */
  updateMeasure(dt: number, hands: HandState[], head: Vector3, forward: Vector3): boolean {
    const { sign } = this.parts;
    this.head.copy(head);
    this.forward.copy(forward);
    // The sign stays up, so the ghost arm stretching out in front is clear to see.
    sign.setCalm(false);
    sign.update(dt);
    this.parts.pointer.hide();
    if (this.measureDone > 0) {
      this.measureDone -= dt;
      if (this.measureDone > 0) return false;
      this.measureTime = -1;
      this.hideHints();
      return true;
    }
    this.measureTime += dt;
    this.reach.update(dt, hands, head);
    this.updateGhost(dt, 'reach', hands, head);
    const header = 'Your size';
    if (this.reachChecked()) {
      this.parts.ghost.hide();
      this.parts.audio.play('lessonDone');
      sign.show({ kind: 'lesson', header, text: 'Done! Rest your arm.', done: true, sub: 'Nice!' });
      this.measureDone = HINT_SIGN.measureDoneTime;
      return false;
    }
    if (this.measureTime > TUTORIAL_TIMING.reachTimeout) {
      this.stopReachCheck();
      this.measureTime = -1;
      this.hideHints();
      return true;
    }
    const text =
      this.reach.phase === 'counting'
        ? `Hold it... ${this.reach.secondsLeft}`
        : this.reach.phase === 'settling'
          ? 'Hold still.'
          : 'Stretch one arm out, hand flat.';
    sign.show({ kind: 'lesson', header, text, icon: ICONS.target });
    return false;
  }

  noteEaten(seasoned = false): void {
    this.eatenCount++;
    if (seasoned) this.pepperedEatenCount++;
  }

  notePicked(): void {
    this.pickedCount++;
  }

  /** A goblin let go away from the mouth: a real throw (fast enough, not just dropped) counts for the toss lesson. */
  noteTossed(speed: number): void {
    if (speed >= GOBLIN_RULES.tossLessonSpeed) this.tossedCount++;
  }

  update(dt: number, hands: HandState[], head: Vector3, forward: Vector3): void {
    const { spawner, flags, panel, goblins, stage } = this.parts;
    this.head.copy(head);
    this.forward.copy(forward);
    // How far the player moved the board (the ring, or the debug page).
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
      // Goblins still getting closer (walking in, fighting their way in) are no stalemate either.
      this.progressTimer -= dt;
      if (this.progressTimer <= 0) {
        this.progressTimer = CASTLE_HEALTH.progressEvery;
        const closest = goblins.closestRadius();
        if (closest < this.lastClosest - CASTLE_HEALTH.progressCm) this.sinceDamage = 0;
        this.lastClosest = closest;
      }
      // Stalemate: every goblin is out, some are left far away, but none has hurt the castle for a long time.
      // Never while a lesson waits: its goblins wait on purpose, and only the player ends a lesson.
      const teaching = (this.director?.current as TutorialStep | null)?.hint?.kind === 'lesson';
      if (!teaching && this.wave >= 0 && spawner.allOut && goblins.aliveCount > 0 && this.sinceDamage > CASTLE_HEALTH.stalemateSeconds) {
        console.info('[battle] stalemate: the leftover goblins run off');
        this.endWave();
        this.sinceDamage = 0;
      }
      this.reach.update(dt, hands, head);
      this.director?.update(dt);
      // No soldiers come out while something is taught: the lesson needs goblins, and the soldiers would knock them out first.
      const step = (this.director?.current ?? null) as TutorialStep | null;
      this.parts.troops.held = step?.hint?.kind === 'lesson';
      // In the tutorial every horn call sends a full squad, so its fights are won.
      this.parts.troops.fullSquads = this.teach;
      this.quietTools(step);
      // No new goblins while any are inside the castle (v2): the player has to deal with the intruders first.
      // And none at all while a lesson runs: only the lesson's own goblins are out (headset test: other goblins confused).
      const inLesson = step?.hint?.kind === 'lesson';
      spawner.rate = inLesson || goblins.countMode('intruder') > 0 ? 0 : (this.director?.spawnRate ?? 1);
      spawner.update(dt);
      if (this.state.phase !== 'playing') this.end();
    }
    flags.show(healthShare(this.state), this.state.wavesCleared / this.state.totalWaves);
    flags.update(dt);
    this.updateHint(dt, hands, head);
    if (this.endTimer > 0) {
      this.endTimer -= dt;
      if (this.endTimer <= 0) {
        // v2 run 2: the game says what comes next (the tutorial won goes to the menu; a campaign level shows its stars).
        const won = this.state.phase === 'won';
        const next = this.onEnd(won, healthShare(this.state));
        if (next !== 'menu') panel.show(won ? 'won' : 'lost', next);
      }
    }
    // Welcome panel: Play is the tutorial, Skip tutorial the game's (the menu). Play again keeps the last choice.
    const choice = panel.update(hands, dt);
    if (choice === 'skip') this.onSkip();
    else if (choice === 'menu') this.onMenu();
    else if (choice === 'play') this.start(this.playFromWave, panel.kindShown === 'welcome' ? true : this.teach);
  }

  /**
   * During a lesson only that lesson's tool works: every other tool is
   * locked (dimmed, no glow, a grab only buzzes) and let go if it was held,
   * so nothing blinks, and no other tool can break the lesson. Outside
   * lessons every tool works.
   */
  private quietTools(step: TutorialStep | null): void {
    const hint = step?.hint;
    const lesson = hint?.kind === 'lesson';
    const focus = hint?.tool ?? (hint?.marker ? MARKER_TOOL[hint.marker] : undefined);
    for (const tool of Object.values(this.parts.tools)) {
      const locked = lesson && tool.name !== focus;
      if (locked && !tool.quiet) tool.release();
      tool.quiet = locked;
    }
    const sling = this.parts.slingshot;
    const slingLocked = lesson && focus !== 'slingshot';
    if (slingLocked && !sling.locked) sling.release();
    sling.locked = slingLocked;
  }

  /** A lesson's "grab me" glow ends with it, so a tool hinted at once never keeps blinking through later lessons. */
  private clearBeckons(): void {
    this.parts.slingshot.beckon = false;
    for (const tool of Object.values(this.parts.tools)) tool.beckon = false;
  }

  /** The hint sign, the arrow and the ghost hand for the current step. */
  private updateHint(dt: number, hands: HandState[], head: Vector3): void {
    const { sign, goblins, ghost } = this.parts;
    const step = (this.director?.current ?? null) as TutorialStep | null;
    const hint = step?.hint;
    // Where the sign hangs, decided before it moves (deciding after made a low spot never stick):
    // in front of the eyes while no wave is fought, up out of the way during one.
    sign.setCalm(!this.inWave);
    // The reach check: the sign stays up, so the ghost arm stretching out in front is clear to see.
    if (hint?.reachCheck) sign.setCalm(false);
    // A target in the air (the balloon): the sign goes low, out of the way of it and the shot.
    if (hint?.signLow) sign.setLow();
    sign.update(dt);
    this.lessonPointing = false;
    this.glassText = null;
    this.hornWaiting = false;
    if (!this.running || this.state.phase !== 'playing') {
      sign.show(null);
      ghost.hide();
      this.parts.ghostAim.hide();
      this.parts.pointer.hide();
      return;
    }
    if (this.doneFlash > 0) {
      this.doneFlash -= dt;
      // A glass lesson's tick shows on the glass sign too, so the sign never jumps to the board.
      if (this.doneGlass) {
        sign.show(null);
        this.glassText = this.doneContent ? `✓ ${this.doneContent.text}` : null;
      } else sign.show(this.doneContent);
      ghost.hide();
      this.parts.ghostAim.hide();
      this.parts.pointer.hide();
      return;
    }
    this.shownStep = step;
    if (!hint) {
      this.shown = null;
      sign.show(null);
      ghost.hide();
      this.parts.ghostAim.hide();
      this.parts.pointer.hide();
      return;
    }
    const target = this.markerPosition(hint.marker, markerAt);
    this.updateGhost(dt, !hornHearsMic() && hint.demoNoMic ? hint.demoNoMic : hint.demo, hands, head);
    // The 3D arrow: in front of the face while the target is out of view, right over it once in view.
    this.parts.pointer.update(dt, head, this.forward, target);
    this.lessonPointing = target !== null;
    // The first trigger lesson: ghost aim dots from the pouch to the keg.
    this.parts.ghostAim.update(dt, hint.aimDots && target ? this.parts.slingshot.partWorld('pouch', pouchAt) : null, target);
    // A quiet horn (no mic, or the player chose it) has its own words: hold it, no blowing.
    let text = !hornHearsMic() && hint.whenNoMic ? hint.whenNoMic : hint.text;
    // The horn lesson's three beats follow what the player is doing: aim, lift to lock, blow.
    if (hint.hornSteps) text = this.hornBeat(hint.hornSteps, dt);
    if (hint.watchSteps) text = this.squadFoes.length > 0 ? hint.watchSteps.fight : hint.watchSteps.march;
    const lessonGoblin = this.lessonGoblin;
    if (hint.whenDropped && lessonGoblin && goblins.isHittable(lessonGoblin)) text = hint.whenDropped;
    // A tool lesson while the tool recharges says so (watch the ring fill, or eat to speed it up).
    if (hint.whenLocked && hint.tool && !this.toolReady(hint.tool)) text = hint.whenLocked;
    // The reach check counts down while the arm is out, so the player knows when to rest.
    if (hint.reachCheck && this.reach.phase === 'counting') text = `Hold it... ${this.reach.secondsLeft}`;
    else if (hint.reachCheck && this.reach.phase === 'settling') text = 'Hold still.';
    this.shown = { kind: hint.kind, header: hint.header, text, icon: hint.icon && ICONS[hint.icon], next: hint.next };
    // A glass lesson (the horn, the balloon): its text goes on the glass sign that follows the look,
    // and the hint sign steps away, so only one sign ever shows.
    if (hint.glass && !hint.next) {
      sign.show(null);
      this.glassText = text;
      return;
    }
    sign.show(this.shown);
    // Info steps can be skipped with the sign's "Next" button.
    if (hint.next && sign.pokedNext(hands, dt)) this.director?.skip();
  }

  /**
   * The horn lesson's text, one beat at a time: look around (at least
   * hornLookTime of holding it), lift it, "spot set" for hornLockedTime once
   * it locks, then blow. Lowering it goes back to lift (the look time is kept).
   */
  private hornBeat(steps: HornSteps, dt: number): string {
    const state = this.parts.hornState();
    this.hornWaiting = state === 'blow';
    if (state === 'idle') {
      this.hornLookTime = 0;
      this.hornLockTime = 0;
      return steps.idle;
    }
    if (state !== 'blow') {
      this.hornLockTime = 0;
      this.hornLookTime += dt;
      return state === 'aim' || this.hornLookTime < TUTORIAL_TIMING.hornLookTime ? steps.aim : steps.lift;
    }
    this.hornLockTime += dt;
    if (this.hornLockTime < TUTORIAL_TIMING.hornLockedTime) return steps.locked;
    this.hornWaiting = false;
    return hornHearsMic() ? steps.blow : steps.blowQuiet;
  }

  /** Loops the step's ghost hand demo next to its target, out of the way of the player's own hand. */
  private updateGhost(dt: number, demo: GhostDemoName | undefined, hands: HandState[], head: Vector3): void {
    const { ghost } = this.parts;
    ghost.play(demo);
    if (!demo) return;
    view.head.copy(head);
    this.parts.slingshot.shotDirection(view.shot);
    // From the pouch toward the lesson's trigger, level (the keg lesson's pull goes straight back from it).
    view.aim.copy(view.shot);
    const t = this.lessonTrigger;
    if (t?.standing) {
      this.parts.triggers.topWorld(t, temp);
      this.parts.slingshot.partWorld('pouch', pouchAt);
      temp.sub(pouchAt).setY(0);
      if (temp.lengthSq() > 1e-6) view.aim.copy(temp.normalize());
    }
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
        // The right arm stretched straight out in front of the right shoulder, at shoulder height, the
        // hand just where the reach the game expects ends: the rampart sits at rampartShare of the reach,
        // so a full stretch is the rampart's distance over that share, sized with the board as it is now.
        const reach = (CASTLE.rampartRadius / CALIBRATION.rampartShare) * 0.01 * this.parts.stage.boardScale * CALIBRATION.demoStretch;
        temp.copy(this.forward).setY(0).normalize();
        out.copy(this.head).addScaledVector(temp, reach);
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
      case 'swatterHandle':
        return this.parts.tools.swatter.handleWorld(out);
      case 'pepperHandle':
        return this.parts.tools.pepper.handleWorld(out);
      case 'bellHandle':
        return this.parts.tools.bell.handleWorld(out);
      case 'hornHandle':
        return this.parts.tools.horn.handleWorld(out);
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
      case 'pauseButton':
        return this.parts.pauseButton(out);
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

  /** Debug: the battle is won right away, with the castle's health as it is (for the stars). */
  winNow(): void {
    if (!this.running || this.state.phase !== 'playing') return;
    this.state.wavesCleared = this.state.totalWaves;
    this.state.phase = 'won';
    this.parts.celebrate(true);
    this.end();
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
    this.parts.slingshot.locked = false;
    for (const tool of Object.values(this.parts.tools)) {
      tool.release();
      tool.quiet = false;
    }
    this.parts.audio.play(this.state.phase === 'won' ? 'win' : 'lose');
    if (this.state.phase === 'won') this.parts.audio.play('winFanfare');
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
    // A lesson goblin still waiting from before becomes an ordinary goblin, so it never holds the wave up.
    const old = this.lessonGoblin;
    if (old && old.mode !== 'dead') this.parts.goblins.makeOrdinary(old);
    const plan = this.waves[index];
    // A level wave hands out its own gear shares from wave 1; the tutorial's helmets and shields come from their wave on.
    this.parts.goblins.gearShares = plan.gear ?? GOBLIN_GEAR;
    this.parts.goblins.helmetsOn = !!plan.gear || index + 1 >= GOBLIN_GEAR.helmetFromWave;
    this.parts.goblins.shieldsOn = !!plan.gear || index + 1 >= GOBLIN_GEAR.shieldFromWave;
    // This wave's new camps rise with its banner (docs/custom-mode.md section 7).
    this.parts.camps.raise(this.rising[index] ?? []);
    // Balloons are taught in the slingshot wave now, so a wave's own balloons never wait for a banner.
    this.parts.spawner.balloonsHeld = false;
    this.parts.spawner.start(plan);
    // The army marches out toward the attacking camps, and the triggers of this wave stand ready.
    this.parts.troops.deploy(plan.camps);
    this.parts.triggers.setWave(index + 1);
    const last = index === this.waves.length - 1;
    this.parts.audio.play('waveHorn');
    this.parts.audio.play(last ? 'finalRound' : WAVE_VOICES[index] ?? 'finalRound');
    console.info(`[battle] wave ${index + 1} started`);
  }

  waveCleared(): boolean {
    return this.wave >= 0 && this.parts.spawner.allOut && this.parts.goblins.aliveCount === 0;
  }

  /**
   * The wave whose time of day shows (0 based): the one being fought, or
   * between waves the next one, so the time changes as soon as a wave is
   * cleared. After the last wave it stays at the last wave's time.
   */
  get timeWave(): number {
    return Math.max(0, Math.min(this.waves.length - 1, this.inWave ? this.wave : this.wave + 1));
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
    // In the tutorial the squads then march home, so the next lessons start with an empty field
    // (knights next to lesson goblins they leave alone were confusing). In the real game they stay.
    if (this.teach) this.parts.troops.sendHome(TUTORIAL_TIMING.squadsHomeAfter);
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
    // The easier way: a resting tool is ready at once, or a goblin in reach to use it on.
    if (!this.toolReady(tool)) for (const t of tools) t.rechargeNow();
    else this.lessonClimber(true);
  }

  /** Holds the use window while its lesson runs. A tool still recharging from an early use is made ready, so the lesson can start. */
  holdToolTimer(tool: ToolName, on: boolean): void {
    for (const t of this.foodTools(tool)) {
      if (on && t.recharging) t.rechargeNow();
      t.timerHeld = on;
    }
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

  /** True if the tool can be used now: not recharging. */
  toolReady(tool: ToolName): boolean {
    if (tool === 'slingshot') return true;
    return this.foodTools(tool).some((t) => t.usable);
  }

  /** The hand tool of a tutorial tool name (none for the slingshot). */
  private foodTools(tool: ToolName): HandTool[] {
    return tool === 'slingshot' ? [] : [this.parts.tools[tool]];
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

  tossed(): number {
    return this.tossedCount;
  }

  eaten(): number {
    return this.eatenCount;
  }

  pepperedEaten(): number {
    return this.pepperedEatenCount;
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
    this.parts.pointer.pulse();
  }

  endTriggerLesson(): void {
    this.parts.goblins.releaseWaiting();
  }

  baitMoving(): void {
    this.parts.bait.patrol(this.parts.stage.spin);
  }

  baitForTool(armored = false): void {
    this.parts.bait.onRampart(this.parts.stage.spin, armored);
  }

  /** Time the lesson goblin (or bait) has been missing, before a new one comes (TUTORIAL_TIMING.respawnAfter). */
  private missingFor = 0;

  keepLessonGoblin(dt: number): void {
    const g = this.lessonGoblin;
    // Still there for the lesson: on the board as a lesson goblin, or in the hand.
    const there = g && g.mode !== 'dead' && (this.parts.isHeld(g) || this.parts.goblins.isLesson(g));
    if (there) {
      this.missingFor = 0;
      return;
    }
    this.missingFor += dt;
    if (this.missingFor < TUTORIAL_TIMING.respawnAfter) return;
    this.missingFor = 0;
    // A thrown one is an ordinary goblin now: it stays, and a new lesson goblin pops up on the wall in front.
    this.lessonGoblin = null;
    this.lessonClimber(true);
  }

  keepBait(dt: number, armored: boolean): void {
    if (this.parts.bait.first()) {
      this.missingFor = 0;
      return;
    }
    this.missingFor += dt;
    if (this.missingFor < TUTORIAL_TIMING.respawnAfter) return;
    this.missingFor = 0;
    this.baitForTool(armored);
  }

  keepMovingBait(dt: number): void {
    if (this.parts.bait.first()) {
      this.missingFor = 0;
      return;
    }
    this.missingFor += dt;
    if (this.missingFor < TUTORIAL_TIMING.respawnAfter) return;
    this.missingFor = 0;
    this.baitMoving();
  }

  hornState(): 'idle' | 'aim' | 'lift' | 'blow' {
    return this.parts.hornState();
  }

  sendGroupAtSquad(): boolean {
    const { count, from, gap } = TUTORIAL_TIMING.squadFight;
    this.squadFoes = this.parts.troops.sendGroupAt(count, from, gap).map((g) => ({ g, serial: g.serial }));
    return this.squadFoes.length > 0;
  }

  goblinsLeft(): number {
    return this.parts.goblins.aliveCount;
  }

  spawnedInWave(): number {
    return this.parts.spawner.spawned;
  }

  hasSquad(): boolean {
    return this.parts.troops.hasCalledSquad;
  }

  squadReady(): boolean {
    return this.parts.troops.calledSquadReady;
  }

  releaseSquadFoes(): void {
    const left = this.squadFoes.filter(({ g, serial }) => g.serial === serial && g.mode !== 'dead').map(({ g }) => g);
    this.parts.troops.releaseGroup(left);
  }

  squadFoesLeft(): number {
    let left = 0;
    for (const { g, serial } of this.squadFoes) if (g.serial === serial && g.mode !== 'dead') left++;
    return left;
  }

  releaseBait(): void {
    this.parts.bait.release();
  }

  triggersSetOff(kind: TriggerKind): number {
    return this.triggerCount[kind];
  }

  balloonLesson(): void {
    const { balloons, stage, rng } = this.parts;
    // One balloon right in front of the player (the board angle in front now). It floats in and hovers outside the wall until popped.
    if (balloons.nearest(stage.spin)) return;
    balloons.spawn(stage.spin + degToRad(rng.range(-6, 6)), BALLOONS.introRadius, BALLOONS.lessonWaitAt);
  }

  endBalloonLesson(): void {
    this.parts.balloons.releaseWaiting();
  }

  balloonsPopped(): number {
    return this.parts.balloons.pops;
  }

  pausedCount(): number {
    return this.pauses;
  }
}
