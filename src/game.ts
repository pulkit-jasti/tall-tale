// The game loop. Builds the world once from the map blueprint, then runs the
// small systems in a fixed order every frame: hands, handles, battle (director,
// waves, flags, end panel), goblins, troops, triggers, grab and eat,
// slingshot, food tools, food jar, effects, sky.
import { createSystem, VisibilityState } from '@iwsdk/core';
import { DirectionalLight, Fog, Object3D, Quaternion, Vector3 } from 'three';
import { mic } from './audio/mic.js';
import { GameAudio } from './audio/sound.js';
import { BALLOONS, DEBUG, FPS, GLASS_SIGN, GOBLIN_RULES, HORN, JUICE, HANDLES, PAUSE, SKY, STAGE, STRESS_TEST, TIMES_OF_DAY, TOOLS, TRIGGERS, XR, type TimeOfDay } from './config/game.js';
import { eatShare } from './rules/recharge.js';
import { DEBUG_ACTIONS, type DebugCommand } from './debug/debugKeys.js';
import { Battle } from './director/battle.js';
import { TUTORIAL_WAVES } from './director/tutorial.js';
import tutorialMap from './maps/tutorial.json';
import { parseBlueprint } from './rules/blueprint.js';
import { EndPanel } from './ui/endPanel.js';
import { PauseMenu, type PauseAction } from './ui/pauseMenu.js';
import { GhostAim } from './ui/ghostAim.js';
import { PointerArrow } from './ui/pointerArrow.js';
import { LessonBait } from './units/lessonBait.js';
import { GhostHand } from './ui/ghostHand.js';
import { HintSign } from './ui/hintSign.js';
import { ThreatCues } from './ui/threatCues.js';
import { GlassSign, loadUiImages, type GlassBar } from './ui/kit/index.js';
import { WaveSpawner } from './units/waveSpawner.js';
import { Flags } from './world/flags.js';
import { FpsCounter } from './debug/fpsCounter.js';
import { note, recentNotes } from './debug/notes.js';
import { mark } from './debug/perfMarks.js';
import { sendHeartbeat, sendRunStats, sendStressTest, takeRemoteCommands } from './debug/remote.js';
import { StressTest } from './debug/stressTest.js';
import { ToySpawner } from './director/toySpawner.js';
import { Particles } from './fx/particles.js';
import { GrabEat } from './player/grabEat.js';
import { BoardHandles } from './player/handles.js';
import { HandTracker } from './player/hands.js';
import { angleOf, degToRad } from './rules/boardMath.js';
import { timeOfWave } from './rules/dayNight.js';
import { createRandom, type Random } from './rules/random.js';
import { checkReach } from './rules/reach.js';
import { Bell } from './tools/bell.js';
import { FlySwatter } from './tools/flySwatter.js';
import type { HandTool } from './tools/handTool.js';
import { Horn } from './tools/horn.js';
import { HornAim } from './ui/hornAim.js';
import { PepperShaker } from './tools/pepperShaker.js';
import { Slingshot } from './tools/slingshot.js';
import { StunWave } from './tools/stunWave.js';
import { Goblins } from './units/goblins.js';
import { Troops } from './units/troops.js';
import { Garrison } from './units/garrison.js';
import { Villagers } from './units/villagers.js';
import { Balloons } from './units/balloons.js';
import { GearDebris } from './fx/gearDebris.js';
import { fadeAtNight } from './fx/nightFade.js';
import { Juice } from './fx/juice.js';
import { Hills } from './world/hills.js';
import { DayNight } from './world/dayNight.js';
import { NightLights } from './world/nightLights.js';
import { Sky } from './world/sky.js';
import { Triggers } from './world/triggers.js';
import { buildBoard } from './world/boardBuilder.js';
import { buildSeatFloor, GiantBody } from './world/giant.js';
import { Windmill } from './world/settlements.js';
import { Stage } from './world/stage.js';

const headPosition = new Vector3();
const headQuaternion = new Quaternion();
const headForward = new Vector3();
const toHead = new Vector3();
const boardAt = new Vector3();
/** Session storage key for the debug "Start at wave" choice. */
const PLAY_FROM_KEY = 'tallTale.playFromWave';

/** Set by the start page button: start a battle in the browser now, or in VR once the board is placed. */
let pendingStart: 'browser' | 'vr' | null = null;

/** Called from the start page's button. */
export function requestBattleStart(inVr: boolean): void {
  pendingStart = inVr ? 'vr' : 'browser';
}

export class GameSystem extends createSystem({}) {
  private ready = false;
  private stage!: Stage;
  private audio!: GameAudio;
  private hands = new HandTracker();
  private handles!: BoardHandles;
  private goblins!: Goblins;
  private grabEat!: GrabEat;
  private slingshot!: Slingshot;
  private swatter!: FlySwatter;
  private pepper!: PepperShaker;
  private horn!: Horn;
  private hornAim!: HornAim;
  /** The see-through sign that follows the look (glass lessons, the horn). */
  private glass!: GlassSign;
  private bell!: Bell;
  private stun!: StunWave;
  private tools: HandTool[] = [];
  private troops!: Troops;
  private garrison!: Garrison;
  private villagers!: Villagers;
  private balloons!: Balloons;
  private gearDebris!: GearDebris;
  private juice!: Juice;
  private triggers!: Triggers;
  private sky: Sky | null = null;
  private fog!: Fog;
  private dayNight!: DayNight;
  private nightLights!: NightLights;
  /** A time of day picked on the debug page, until the next battle starts. */
  private timeOverride: TimeOfDay | null = null;
  /** Battle starts seen so far: a new battle jumps straight to its time of day. */
  private battleStarts = -1;
  private particles!: Particles;
  private threat!: ThreatCues;
  private sign!: HintSign;
  private endPanel!: EndPanel;
  /** The settings page is open from the welcome panel, and the reach check was started from it. */
  private titleSettings = false;
  private titleMeasure = false;
  private spawner!: ToySpawner;
  private battle!: Battle;
  private debugRng!: Random;
  private fps!: FpsCounter;
  private stressTest!: StressTest;
  private placeTimer = -1;
  private wasImmersive = false;
  /** The Quest menu is open, the headset is off or the page is hidden. */
  private hidden = false;
  /**
   * The XR session or the page said it lost focus since the last frame (their
   * events), even if no frame ran while the Quest menu was open. The next
   * frame pauses the battle.
   */
  private blurSeen = false;
  /** The XR session whose visibility events are watched. */
  private watchedSession: XRSession | null = null;
  /** When the last frame ran (performance.now, ms), to notice frames that stopped (the Quest menu). */
  private lastFrameAt = 0;
  /** What paused the game last (the FPS panel shows it while paused). */
  private pauseReason = 'button';
  /** How long each hand has held a pinch with its palm toward the eyes (the Quest menu gesture). */
  private menuPinch = [0, 0];
  /** Paused from the pause button (or auto-paused in VR): stays paused until Resume. */
  private menuPaused = false;
  /** "Measure reach" from the pause panel is running (the battle stays frozen). */
  private measuring = false;
  private paused = false;
  private pauseMenu!: PauseMenu;
  private giant!: GiantBody;
  private windmill!: Windmill;
  private heartbeatTimer = 0;

  init(): void {
    // The page hidden (the headset off, the Quest browser in the background): pause on the next frame.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.blurSeen = true;
    });
    void this.setup().catch((error) => console.error('[game] setup failed', error));
  }

  private async setup(): Promise<void> {
    const root: Object3D = this.world.getPersistentRoot();
    const blueprint = parseBlueprint(tutorialMap);
    // The tutorial uses the blueprint's fixed seed, so every run plays the same.
    const seed = blueprint.seed;

    this.stage = new Stage(root);
    // The sunlight (the moonlight at night) comes from the sun's (moon's) side. Like the sky, it never turns.
    const sun = new DirectionalLight();
    root.add(sun, sun.target);
    // Haze in the dome's horizon color. It starts past the board and thickens
    // far out, so the last mountains fade into the sky. Grows with the board (update).
    this.fog = new Fog(0xffffff, SKY.fogNear, SKY.fogFar);
    this.scene.fog = this.fog;

    // Decor only: hills around the board, the sky dome, a sun, a moon, stars and slow clouds. None of them turn (comfort rule).
    const hills = new Hills(this.stage.boardLift, createRandom(seed + 710));
    // The terrain turns grey-blue at night, to match the dark sky.
    fadeAtNight(hills.group);
    if (SKY.enabled) this.sky = new Sky(root, this.stage.boardLift, createRandom(seed + 700));
    // The time of day sets the light, the fog color and the sky (it starts in the morning).
    this.dayNight = new DayNight(this.sky, sun, this.fog, this.scene);
    this.audio = new GameAudio(root, this.player.head, createRandom(seed + 100));
    this.particles = new Particles(root, createRandom(seed + 101));
    this.juice = new Juice(root, createRandom(seed + 102));
    this.handles = new BoardHandles(this.stage);
    // The giant's seat: the hole is filled at board level, and the giant's body comes out of it.
    buildSeatFloor(this.stage.boardLift, createRandom(seed + 720));
    this.giant = new GiantBody(root);
    this.fps = new FpsCounter(this.stage.boardLift);

    const ghost = new GhostHand();
    const [built] = await Promise.all([
      buildBoard(this.stage.boardSpin, blueprint),
      this.audio.load(),
      loadUiImages(),
      ghost.load(root),
    ]);
    // Only the board so far (ground, castle, roads, camps, villages, decor): units, triggers and tools come later and keep their colors.
    fadeAtNight(this.stage.boardSpin);
    // After the fade, so the lights keep their colors: glowing windows, torches on the towers, lantern glows.
    this.nightLights = new NightLights(this.stage.boardSpin, built.windows, built.lanterns, built.lanternHeight, built.roadTorches);    this.windmill = new Windmill(built.sails);
    this.goblins = new Goblins(this.stage.boardSpin, built.network, createRandom(seed + 200), this.audio);
    this.goblins.particles = this.particles;
    this.slingshot = new Slingshot(this.stage, this.goblins, this.audio, this.particles);
    const toolParts = { stage: this.stage, goblins: this.goblins, audio: this.audio, particles: this.particles };
    this.swatter = new FlySwatter(toolParts);
    this.pepper = new PepperShaker(toolParts);
    this.stun = new StunWave(this.stage, this.goblins, this.audio, this.particles);
    this.horn = new Horn(toolParts);
    this.bell = new Bell(toolParts, this.stun);
    this.tools = [this.swatter, this.pepper, this.bell, this.horn];
    this.troops = new Troops(this.stage.boardSpin, built.network, this.goblins, this.audio, this.particles, createRandom(seed + 800));
    // The wall garrison (v2): archers and guards on the rampart, run with the troops.
    const garrison = new Garrison(this.stage.boardSpin, this.troops, this.goblins, this.audio, this.particles, createRandom(seed + 810));
    this.garrison = garrison;
    this.troops.onUpdate = (dt) => garrison.update(dt);
    this.troops.onMan = () => garrison.fill();
    this.troops.onClear = () => garrison.stop();
    // Goblins on the rampart hunt the soldiers there, and jump in only when none is left (v2).
    this.goblins.huntAngle = (g) => garrison.nearestSoldierAngle(g);
    this.triggers = new Triggers(this.stage.boardSpin, built.network, this.goblins, this.audio, this.particles, createRandom(seed + 900));
    this.balloons = new Balloons(this.stage.boardSpin, this.goblins, this.audio, this.particles, createRandom(seed + 950));
    this.gearDebris = new GearDebris(this.stage.boardSpin, createRandom(seed + 960));
    this.goblins.debris = this.gearDebris;
    this.troops.debris = this.gearDebris;
    // Villagers going about their day in the village squares (decor, their own random stream).
    this.villagers = new Villagers(this.stage.boardSpin, built.villages, createRandom(seed + 970));
    await Promise.all([
      this.villagers.load(),
      this.slingshot.load(),
      this.troops.load(),
      this.triggers.load(blueprint.triggers),
      this.goblins
        .load()
        .then(() => this.gearDebris.load(['goblinSpear', 'goblinSword', 'goblinHelmet', 'goblinShield', 'roundShield', 'rectShield'], this.goblins.unitScale)),
      ...this.tools.map((t) => t.load()),
    ]);
    // Every trigger can be shot: the aim assist bends toward it and it glows while aimed at.
    for (const target of this.triggers.targets) this.slingshot.addTarget(target);
    // Balloons too: a big still target, so the aim assist bends toward it.
    for (const target of this.balloons.targets) this.slingshot.addTarget(target);
    this.fps.countUnits = () => this.goblins.aliveCount + this.troops.aliveCount;
    this.fps.onReport = (stats) => {
      sendRunStats(stats);
      if (stats.final) {
        console.info(
          `[fps] run: ${stats.units} units, ${stats.seconds.toFixed(0)} s, avg ${stats.avgFps.toFixed(1)}, ` +
            `1% low ${stats.lowFps.toFixed(0)}, missed ${stats.missedPct.toFixed(1)}%`,
        );
      }
    };
    this.threat = new ThreatCues(this.stage, this.particles, root);
    this.pauseMenu = new PauseMenu(root, this.stage.boardLift, this.audio);
    this.grabEat = new GrabEat(this.hands, this.goblins, this.handles, this.slingshot, this.tools, this.audio, this.particles);
    this.spawner = new ToySpawner(this.goblins, built.network.graph.camps.length, createRandom(seed + 300));
    this.debugRng = createRandom(seed + 400);
    const waves = new WaveSpawner(this.stage.boardSpin, built.network, this.goblins, built.hills, this.audio, createRandom(seed + 500));
    // A wave's balloons float straight in from their camp's direction.
    const campAt = new Vector3();
    waves.onBalloon = (camp) => {
      built.network.nodePosition(camp, campAt);
      return this.balloons.spawn(angleOf(campAt.x, campAt.z)) !== null;
    };
    // The threat cue: the wall under a carrying balloon flashes red.
    this.balloons.onThreat = (rider) => this.threat.wallHit(rider, false);
    this.sign = new HintSign(this.stage.boardLift, this.audio);
    // The welcome panel's Settings button opens the settings page on its own (there is no battle to pause).
    this.endPanel = new EndPanel(this.stage.boardLift, this.audio);
    this.endPanel.onSettings = () => {
      this.endPanel.hide();
      this.titleSettings = true;
      this.pauseMenu.showSettings(headPosition, headForward, this.stage.boardScale);
    };
    this.battle = new Battle({
      stage: this.stage,
      goblins: this.goblins,
      spawner: waves,
      slingshot: this.slingshot,
      tools: { swatter: this.swatter, pepper: this.pepper, bell: this.bell, horn: this.horn },
      troops: this.troops,
      triggers: this.triggers,
      balloons: this.balloons,
      stun: this.stun,
      flags: new Flags(this.stage.boardLift, TUTORIAL_WAVES.length),
      panel: this.endPanel,
      sign: this.sign,
      ghost,
      ghostAim: new GhostAim(root),
      pointer: new PointerArrow(root),
      bait: new LessonBait(this.goblins, built.network),
      pauseButton: (out) => this.pauseMenu.buttonWorld(out),
      // The horn lesson's beats: not held, aiming, a spot to lock, locked at the lips.
      hornState: () => (!this.horn.aiming ? 'idle' : this.horn.locked ? 'blow' : this.hornAim.valid ? 'lift' : 'aim'),
      audio: this.audio,
      particles: this.particles,
      threat: this.threat,
      rng: createRandom(seed + 600),
      isHeld: (goblin) => this.grabEat.isHolding(goblin),
      celebrate: (won) => this.juice.celebrate(won, this.boardCenter(), this.stage.boardScale),
    });
    this.grabEat.onEat = (goblin) => {
      this.battle.noteEaten(goblin.seasoned);
      // v2 (docs/v2-plan.md 2.2): every recharging tool's ring jumps forward together, with a flash and a chime.
      const share = eatShare(goblin.seasoned, TOOLS.eatRefill, TOOLS.seasonedRefill);
      let filled = false;
      for (const tool of this.tools) if (tool.refill(share)) filled = true;
      if (filled) this.audio.play('foodAdded', undefined, 0.8, 0.1);
    };
    // Juice hooks: a star and a ring on every knockout, a big hit for blasts and pops.
    this.goblins.onKnockOut = (_goblin, world) => this.juice.knockout(world, this.stage.boardScale);
    this.goblins.onArmor = (_goblin, world) => {
      this.juice.ring(world, JUICE.knockoutRing * 0.7 * this.stage.boardScale, 0xd8dbe6);
      this.juice.pow(world, JUICE.knockoutStar * 0.8 * this.stage.boardScale, 0xd8dbe6);
    };
    this.triggers.onBlast = (world) => this.juice.blast(world, this.stage.boardScale);
    this.swatter.onSplat = (world) => this.juice.ring(world, JUICE.swatRing * this.stage.boardScale);
    this.balloons.onPop = (_balloon, world) => {
      this.juice.blast(world, 0.7 * this.stage.boardScale);
      this.audio.play('balloonPop', world);
    };
    // The horn calls the field knights (v2) to the road spot the player looks at (src/ui/hornAim.ts).
    this.hornAim = new HornAim(this.stage, this.troops, this.audio);
    this.glass = new GlassSign(root);
    this.horn.aimOk = () => this.hornAim.valid;
    this.horn.onCall = () => {
      const target = this.hornAim.target;
      // Debug (no hands, no aim): the road in front.
      if (target) this.troops.command(target);
      else this.troops.charge(this.stage.spin);
    };
    // Their crash into the goblins: a hit stop, a ring and a pow star.
    this.troops.onCrash = (world) => {
      this.juice.hitStop();
      this.juice.ring(world, JUICE.blastRing * 0.6 * this.stage.boardScale);
      this.juice.pow(world, JUICE.blastStar * 0.6 * this.stage.boardScale);
    };
    this.grabEat.onGrab = () => this.battle.notePicked();
    this.grabEat.onToss = (_goblin, speed) => this.battle.noteTossed(speed);
    // Every tool waits for its wave, so the slingshot is hidden until the tutorial brings it.
    this.slingshot.setVisible(false);
    for (const tool of this.tools) tool.setVisible(false);
    this.stressTest = new StressTest({
      clear: () => {
        // A clean measurement: no battle, no auto trickle.
        this.battle.stop();
        this.spawner.auto = false;
        this.spawner.clear();
        this.goblins.killAll();
        this.troops.clear();
        this.balloons.clear();
        this.juice.clear();
      },
      setup: () => {
        // The army and flying enemies stand on the board for the whole test.
        this.goblins.cap = Math.max(this.goblins.cap, GOBLIN_RULES.maxGoblins);
        this.troops.standForTest(STRESS_TEST.garrison, STRESS_TEST.knights);
        this.balloons.hold = true;
        for (let i = 0; i < STRESS_TEST.balloons; i++) this.balloons.spawn(this.stage.spin + degToRad(60 + i * 120), 90);
        return this.troops.aliveCount + this.goblins.aliveCount;
      },
      spawn: (count) => {
        this.goblins.cap = Math.min(DEBUG.stressMax, Math.max(this.goblins.cap, this.goblins.aliveCount + count));
        this.spawner.sendMany('grunt', count);
        return count * DEBUG.stressGap;
      },
      resetRun: (extraWarmup) => this.fps.resetRun(extraWarmup),
      stats: () => this.fps.currentRun(),
      units: () => this.goblins.aliveCount + this.troops.aliveCount,
      hidePanel: (hide) => this.fps.hideForTest(hide),
      report: sendStressTest,
    });

    this.loadPlayFromWave();
    if (import.meta.env.DEV) checkReach();
    this.placeBoard();
    this.ready = true;
    console.info('[game] ready');
  }

  private get immersive(): boolean {
    return this.visibilityState.value !== VisibilityState.NonImmersive;
  }

  /** The head in XR, the camera on a desktop. */
  private readHead(): void {
    const head = this.immersive ? this.player.head : this.camera;
    head.updateWorldMatrix(true, false);
    head.getWorldPosition(headPosition);
    head.getWorldQuaternion(headQuaternion);
    headForward.set(0, 0, -1).applyQuaternion(headQuaternion);
  }

  /** Asks the headset for the configured frame rate (docs: Meta "WebXR App Framerate Control"). */
  private requestFrameRate(): void {
    const session = this.world.session;
    const rates = session?.supportedFrameRates;
    if (!session || !rates || !rates.includes(XR.frameRate)) {
      console.info(`[xr] ${XR.frameRate} Hz not offered (${rates ? [...rates].join(', ') : 'no list'})`);
      return;
    }
    session
      .updateTargetFrameRate(XR.frameRate)
      .then(() => console.info(`[xr] frame rate set to ${XR.frameRate} Hz`))
      .catch((error) => console.warn('[xr] frame rate change failed', error));
  }

  /** The board's middle in the world (for the celebrations). */
  private boardCenter(): Vector3 {
    return this.stage.boardLift.getWorldPosition(boardAt);
  }

  private placeBoard(): void {
    mark('board placed');
    this.readHead();
    this.grabEat?.releaseAll();
    this.stage.place(headPosition, headQuaternion);
    this.giant?.snap();
  }

  /**
   * Safety net: an error in one frame must never freeze the game in the
   * headset (a thrown error stopped the whole frame, so the view froze and
   * nothing answered). It is logged (at most once a second, with its stack)
   * and the next frame runs as usual.
   */
  update(delta: number): void {
    try {
      this.tick(delta);
    } catch (error) {
      const now = performance.now();
      if (now - this.lastErrorAt > 1000) {
        this.lastErrorAt = now;
        console.error('[game] frame error (the game goes on)', error);
      }
    }
  }

  private lastErrorAt = -Infinity;

  private tick(delta: number): void {
    if (!this.ready) return;
    // Entering VR: place the board once the head pose has settled.
    const immersive = this.immersive;
    if (immersive && !this.wasImmersive) {
      this.placeTimer = STAGE.placeDelay;
      this.requestFrameRate();
    }
    // Leaving VR ends the battle. The start page's button starts a new one.
    if (!immersive && this.wasImmersive) {
      this.battle.stop();
      this.goblins.killAll();
    }
    this.wasImmersive = immersive;
    // The Quest menu can stop the frames without any hidden frame showing up here, so its focus events
    // and a long gap between frames pause the battle too (headset test: it did not always pause).
    this.watchSession();
    const now = performance.now();
    const gap = this.lastFrameAt > 0 ? (now - this.lastFrameAt) / 1000 : 0;
    this.lastFrameAt = now;
    if ((this.blurSeen || gap > PAUSE.autoPauseGap) && immersive && this.battle.canPause && !this.menuPaused) {
      this.pause(this.blurSeen ? 'focus lost' : `no frames ${gap.toFixed(1)} s`);
    }
    this.blurSeen = false;
    // Auto-pause while the Quest menu is open or the headset is off. Read the
    // XR session directly too, and the page itself, in case one of them
    // reports the menu and the other does not. In VR during a battle it stays
    // paused until the player pokes Resume (the pause panel). Otherwise it
    // goes on by itself when the page is visible again.
    const state = this.world.session?.visibilityState ?? this.visibilityState.value;
    const hidden =
      state === VisibilityState.Hidden ||
      state === VisibilityState.VisibleBlurred ||
      document.visibilityState === 'hidden';
    if (hidden !== this.hidden) {
      this.hidden = hidden;
      console.info(`[game] ${hidden ? 'hidden' : 'visible'} (${state})`);
      // Sound (and the mic, which shares the audio context) stops only while hidden, and always comes back with the view.
      this.audio.setPaused(hidden);
      if (!hidden) mic.ensureLive();
      if (hidden && immersive && this.battle.canPause) this.pause(`hidden: ${state}`);
    }
    if (!this.battle.canPause && this.menuPaused) this.resume();
    const paused = hidden || this.menuPaused;
    if (paused !== this.paused) {
      this.paused = paused;
      this.fps.status = paused ? `paused (${this.hidden ? 'hidden' : this.pauseReason})` : '';
      // Menu frames and the hitch after it would pollute the measured run.
      this.fps.resetRun();
    }
    // Aim for the rate the headset really runs at (72, 90 or 120 Hz).
    this.fps.target = Math.round(this.world.session?.frameRate ?? FPS.target);
    this.fps.update(delta, !paused);
    this.heartbeatTimer -= delta;
    if (this.heartbeatTimer <= 0) {
      this.heartbeatTimer = DEBUG.heartbeatEvery;
      sendHeartbeat({
        immersive,
        paused,
        liveFps: this.fps.live,
        targetFps: this.fps.target,
        units: this.goblins.aliveCount + this.troops.aliveCount,
        testing: this.stressTest.active,
        step: this.battle.stepId,
        playFrom: this.battle.playFromWave + 1,
        mic: mic.describe(),
        notes: recentNotes(),
      });
    }
    if (hidden) return;

    // The hands, the head and the debug keys run while paused too: the pause panel needs them.
    const dt = Math.min(delta, 0.05);
    this.player.updateWorldMatrix(true, false);
    this.hands.update(this.world.xrFrame, this.world.xrReferenceSpace, this.player.matrixWorld, dt);
    this.readHead();
    // The Quest menu gesture (a pinch with the palm toward the eyes) pauses at once, whatever the browser reports.
    if (immersive && this.battle.canPause && !this.menuPaused && this.metaGesture(dt)) this.pause('menu gesture');
    this.debugKeys(dt);
    // The giant's body stays under the head, also while paused.
    this.giant.update(dt, headPosition, headForward, this.stage.boardLift.position.y);
    // Sounds behind the head are muffled, also while paused (the panel's clicks).
    this.audio.update();
    // The calm track on the welcome, end and pause panels, the battle track while a battle is fought.
    this.audio.music.update(this.battle.canPause && !this.menuPaused && !this.measuring ? 'battle' : 'menu');
    if (this.measuring) {
      // The reach check on the frozen battle. The board grows or shrinks to the player when it is done.
      this.stage.update(dt);
      if (this.battle.updateMeasure(dt, this.hands.hands, headPosition, headForward)) {
        this.measuring = false;
        this.resume();
        // Measured from the welcome panel's settings: back to the welcome panel.
        if (this.titleMeasure) {
          this.titleMeasure = false;
          this.endPanel.showAgain();
        }
      }
      return;
    }
    if (this.titleSettings) {
      // The settings page from the welcome panel: Back brings the welcome panel again, Measure reach runs the reach check.
      const action = this.pauseMenu.update(dt, this.hands.hands, headPosition, headForward);
      if (action === 'measureReach') {
        this.pauseMenu.hide();
        this.titleSettings = false;
        this.titleMeasure = true;
        this.measuring = true;
        this.battle.startMeasure();
      } else if (action === 'resetTable') {
        // The board placed again; the settings page stays open.
        this.stage.height = 0;
        this.placeBoard();
      } else if (!this.pauseMenu.isOpen) {
        this.titleSettings = false;
        this.endPanel.showAgain();
      }
      return;
    }
    if (this.menuPaused) {
      // Shown here, not when pausing: auto-pause happens while the head pose is unknown (Quest menu).
      if (!this.pauseMenu.isOpen) this.pauseMenu.show(headPosition, headForward, this.stage.boardScale, this.battle.teaching);
      const action = this.pauseMenu.update(dt, this.hands.hands, headPosition, headForward);
      if (action) this.pauseAction(action);
      return;
    }
    // The pause button steps aside while the Next button (on the same spot, higher) shows.
    const pauseOn = immersive && this.battle.canPause && !this.sign.nextShown;
    if (this.pauseMenu.updateButton(dt, this.hands.hands, pauseOn)) this.pause();
    if (this.menuPaused) return;

    if (this.placeTimer > 0) {
      this.placeTimer -= dt;
      if (this.placeTimer <= 0) this.placeBoard();
    }
    // Once the board is in place (in VR, after the auto placement), the welcome
    // panel shows. Its Play button starts the battle (in the browser: key A).
    if (pendingStart === 'browser' || (pendingStart === 'vr' && immersive && this.placeTimer <= 0)) {
      pendingStart = null;
      this.battle.welcome();
    }

    this.stressTest.update(dt);
    this.stage.update(dt);
    this.handles.update(dt);
    this.spawner.update(dt);
    this.battle.update(dt, this.hands.hands, headPosition, headForward);
    // Hit stop (juice): on a big hit the units slow to a crawl for a moment. The board, view and hands never do.
    const unitDt = dt * this.juice.timeScale;
    this.goblins.update(unitDt);
    this.troops.update(unitDt);
    this.villagers.update(unitDt);
    this.balloons.update(unitDt);
    this.gearDebris.update(unitDt);
    this.triggers.update(unitDt);
    // The horn blows when its mouthpiece is at the head.
    this.horn.head.copy(headPosition);
    // The horn lesson's "spot set" beat: the horn locks but waits for the "blow" sign.
    this.horn.waiting = this.battle.hornWaiting;
    this.grabEat.update(dt, headPosition, headForward);
    this.slingshot.update(dt, headPosition);
    for (const tool of this.tools) tool.update(dt);
    // The horn held: the head aims it (a glowing pool, a light pillar and a ghost banner on the road);
    // at the lips the spot locks (gold, the path along the roads).
    this.hornAim.update(dt, this.horn.aiming, this.horn.locked, this.horn.charge, headPosition, headForward);
    this.updateGlass(dt, headPosition, headForward);
    this.stun.update(dt);
    this.threat.update(dt);
    // The red arrow only while a battle is fought, and not while a lesson's yellow arrow points the way.
    if (this.battle.canPause && !this.battle.lessonPointing) this.threat.updateArrow(dt, this.goblins, headPosition, headForward);
    else this.threat.hideArrow();
    this.particles.update(unitDt);
    this.juice.update(dt, headPosition);
    this.sky?.update(dt);
    this.updateTimeOfDay(dt);
    this.windmill.update(dt);
    this.fog.near = SKY.fogNear * this.stage.boardScale;
    this.fog.far = SKY.fogFar * this.stage.boardScale;
  }

  /**
   * The time of day follows the waves (src/rules/dayNight.ts). It changes as
   * soon as a wave is cleared, toward the next wave's time, and a new battle
   * jumps straight to its first wave's time.
   */
  private updateTimeOfDay(dt: number): void {
    const starts = this.battle.starts;
    const fresh = starts !== this.battleStarts;
    this.battleStarts = starts;
    if (fresh) this.timeOverride = null;
    this.dayNight.show(this.timeOverride ?? timeOfWave(this.battle.timeWave, TUTORIAL_WAVES.length), fresh);
    this.dayNight.update(dt);
    this.nightLights.update(dt, this.dayNight.lights);
  }

  /**
   * The glass sign where the eyes are (one sign only): a glass lesson's text
   * (the horn, the balloon), or while the horn is held what to do now. At the
   * lips it carries the horn's live bar: the blow against the line it must
   * pass, or the quiet hold.
   */
  private updateGlass(dt: number, head: Vector3, forward: Vector3): void {
    const horn = this.horn;
    let bar: GlassBar | null = null;
    if (horn.aiming && horn.locked && !horn.waiting) {
      bar = horn.listening
        ? { share: horn.loudness / (HORN.blowLevel * GLASS_SIGN.hornBarMax), line: 1 / GLASS_SIGN.hornBarMax, over: horn.loudness > HORN.blowLevel }
        : { share: horn.charge, line: null, over: false };
    }
    let text = this.battle.glassText;
    if (!text && horn.aiming) text = horn.locked ? (horn.listening ? 'Blow!' : 'Hold it there') : this.hornAim.valid ? 'Lift it to your lips' : 'Look at a road';
    this.glass.show(dt, text, bar, head, forward);
  }

  /**
   * The Quest menu gesture: a hand holding nothing pinches with its palm
   * straight toward the eyes, near the head, and keeps that pose for
   * PAUSE.metaGesture.hold. Stricter since it paused at random (a short
   * tracking glitch can flip which way the palm seems to face).
   */
  private metaGesture(dt: number): boolean {
    const { facing, maxDistance, hold } = PAUSE.metaGesture;
    let fired = false;
    this.hands.hands.forEach((hand, i) => {
      let pose = false;
      if (hand.tracked && hand.usingHand && hand.pinch.on && !this.grabEat.handBusy(hand)) {
        toHead.subVectors(headPosition, hand.palm);
        const d = toHead.length();
        pose = d > 1e-4 && d <= maxDistance && hand.palmNormal.dot(toHead.divideScalar(d)) > facing;
      }
      // The pose must start with the pinch (not a pinch already held, like a goblin carried to the mouth).
      if (!pose || (this.menuPinch[i] === 0 && !hand.pinch.started)) {
        this.menuPinch[i] = 0;
        return;
      }
      this.menuPinch[i] += Math.max(dt, 1e-3);
      if (this.menuPinch[i] >= hold) {
        this.menuPinch[i] = 0;
        fired = true;
      }
    });
    return fired;
  }

  /** Listens to the XR session's focus once per session: the Quest menu blurs or hides it. */
  private watchSession(): void {
    const session = this.world.session ?? null;
    if (!session || session === this.watchedSession) return;
    this.watchedSession = session;
    session.addEventListener('visibilitychange', () => {
      if (session.visibilityState !== 'visible') this.blurSeen = true;
    });
  }

  /**
   * Pauses the battle (pause button, auto-pause or debug): everything
   * freezes, whatever the hands held is let go, and the pause panel comes
   * up on the next visible frame.
   */
  private pause(reason = 'button'): void {
    if (this.menuPaused || !this.battle.canPause) return;
    this.menuPaused = true;
    // Shown on the FPS panel while paused, so a pause nobody asked for says what caused it.
    this.pauseReason = reason;
    this.grabEat.releaseAll();
    this.battle.hideHints();
    this.threat.hideArrow();
    this.hornAim.hide();
    this.glass.hide();
    this.pauseMenu.hideButton();
    this.audio.play('pauseOpen');
    note(`[game] paused (${reason})`);
  }

  private resume(): void {
    if (!this.menuPaused) return;
    this.menuPaused = false;
    this.measuring = false;
    this.pauseMenu.hide();
    this.battle.notePaused();
    this.audio.play('pauseClose');
    console.info('[game] resumed');
  }

  private pauseAction(action: PauseAction): void {
    switch (action) {
      case 'resume':
        this.resume();
        break;
      case 'resetTable':
        // Auto placement again, at the starting height, and play goes on.
        this.stage.height = 0;
        this.placeBoard();
        this.resume();
        break;
      case 'measureReach':
        // The reach check right now, on the frozen battle (no restart). Play goes on when it is done.
        this.pauseMenu.hide();
        this.measuring = true;
        this.battle.startMeasure();
        break;
      case 'restart':
        this.resume();
        this.battle.start();
        break;
      case 'skipTutorial':
        // A fresh battle without the lessons, every tool out (a player is never stuck in the tutorial).
        this.resume();
        this.battle.skipTutorial();
        break;
    }
  }

  /**
   * The wave Play starts at (debug "Start at wave"). Kept for this tab, so a
   * reload after a code change goes straight back to the wave being tested.
   */
  private setPlayFromWave(index: number): void {
    this.battle.playFromWave = index;
    try {
      if (index > 0) sessionStorage.setItem(PLAY_FROM_KEY, String(index));
      else sessionStorage.removeItem(PLAY_FROM_KEY);
    } catch {
      // No storage (private mode): it only lasts until the page reloads.
    }
  }

  private loadPlayFromWave(): void {
    try {
      const index = Number(sessionStorage.getItem(PLAY_FROM_KEY) ?? 0);
      if (index > 0 && index < TUTORIAL_WAVES.length) {
        this.battle.playFromWave = index;
        console.info(`[debug] Play starts at wave ${index + 1} (debug page: Restart game to start from the beginning)`);
      }
    } catch {
      // No storage: Play starts from the beginning.
    }
  }

  private debugKeys(dt: number): void {
    const keys = this.input.keyboard;
    for (const action of DEBUG_ACTIONS) {
      if (action.code && keys.getKeyDown(action.code)) this.runDebug(action.id);
    }
    // Buttons on the laptop debug page (dev server only).
    for (const { id, arg } of takeRemoteCommands()) this.runDebug(id, arg);
    let spin = 0;
    let height = 0;
    // A bigger spin moves the board to the left as seen from the seat.
    if (keys.getKeyPressed('KeyQ')) spin += 1;
    if (keys.getKeyPressed('KeyE')) spin -= 1;
    if (keys.getKeyPressed('KeyZ')) height -= 1;
    if (keys.getKeyPressed('KeyX')) height += 1;
    if (spin || height) {
      this.handles.nudge(degToRad(spin * HANDLES.keyRotateDegPerSec * dt), height * HANDLES.keyHeightCmPerSec * dt);
    }
  }

  private runDebug(id: DebugCommand, arg?: number): void {
    switch (id) {
      case 'skipWave':
        this.battle.skipWave();
        break;
      case 'skipStep':
        this.battle.skipStep();
        break;
      case 'loseCastle':
        this.battle.loseNow();
        break;
      case 'damageCastle':
        this.battle.damage(DEBUG.castleDamage);
        break;
      case 'restartBattle':
        // The whole game again: Play starts from the first lesson from now on.
        this.setPlayFromWave(0);
        this.battle.start(0, true);
        break;
      case 'skipTutorial':
        this.battle.skipTutorial();
        break;
      case 'measureReach':
        // Forget the measured reach and measure again right away, before the wave Play starts at.
        this.battle.forgetReach();
        this.battle.start();
        break;
      case 'startWave': {
        const wave = Math.round(arg ?? 1);
        if (wave < 1 || wave > TUTORIAL_WAVES.length) break;
        this.setPlayFromWave(wave - 1);
        this.battle.start(wave - 1, true);
        break;
      }
      case 'grunts':
        this.spawner.sendGroup('grunt');
        break;
      case 'runners':
        this.spawner.sendGroup('runner');
        break;
      case 'climberFront':
        // The board angle that is in front of the player right now.
        this.goblins.spawnClimberAt(this.stage.spin + degToRad(this.debugRng.range(-10, 10)));
        break;
      case 'auto':
        this.spawner.auto = !this.spawner.auto;
        console.info(`[debug] auto spawning ${this.spawner.auto ? 'on' : 'off'}`);
        break;
      case 'clear':
        this.spawner.clear();
        this.goblins.killAll();
        this.troops.clear();
        this.balloons.clear();
        this.fps.resetRun();
        break;
      case 'resetRun':
        this.fps.resetRun();
        break;
      case 'autoTest':
        // Only a page in VR runs it, so a laptop tab never measures instead of the headset.
        if (!this.immersive) {
          console.info('[stress test] ignored: this page is not in VR');
          break;
        }
        this.stressTest.start();
        break;
      case 'stopTest':
        this.stressTest.stop();
        break;
      case 'eatFront':
        this.grabEat.debugEat(headPosition, headForward);
        break;
      case 'place':
        this.placeBoard();
        break;
      case 'slingShot':
        this.slingshot.debugShoot();
        break;
      case 'slingLoad':
        this.slingshot.debugLoad();
        break;
      case 'slingGoblin':
        this.slingshot.debugLoadGoblin();
        break;
      case 'bowlEmpty':
        this.slingshot.debugBowl(false);
        break;
      case 'bowlFill':
        this.slingshot.debugBowl(true);
        break;
      case 'rechargeTools':
        for (const tool of this.tools) tool.rechargeNow();
        console.info('[debug] every tool ready');
        break;
      case 'drainTools':
        for (const tool of this.tools) if (tool.visible) tool.drain();
        console.info('[debug] every tool out recharges from empty');
        break;
      case 'eatRefill':
        // What eating one goblin does to the rings, without a goblin.
        for (const tool of this.tools) tool.refill(TOOLS.eatRefill);
        break;
      case 'showTools':
        for (const tool of this.tools) if (!tool.visible) tool.appear();
        break;
      case 'swat':
        this.swatter.debugSwat();
        break;
      case 'pepper':
        this.pepper.debugShake();
        break;
      case 'horn':
        this.horn.debugBlow();
        break;
      case 'bell':
        this.bell.debugRing();
        break;
      case 'troops':
        // What the horn does, without the horn: a squad charges down the road in front.
        this.troops.charge(this.stage.spin);
        break;
      case 'troopsToggle':
        this.troops.enabled = !this.troops.enabled;
        // Back on: the garrison mans the walls again at once.
        if (this.troops.enabled) this.troops.manWalls();
        console.info(`[debug] troops ${this.troops.enabled ? 'on' : 'off'}`);
        break;
      case 'thinGarrison':
        this.garrison.thin(2);
        break;
      case 'triggersReset':
        this.triggers.setWave(TUTORIAL_WAVES.length);
        break;
      case 'triggerLesson': {
        // What the keg lesson does: a small group waits by the keg nearest the front until it is set off.
        const keg = this.triggers.readyNearest('keg', this.stage.spin);
        if (keg) this.triggers.baitGroup(keg, TRIGGERS.lesson.group);
        break;
      }
      case 'triggersFire':
        this.triggers.fireAll();
        break;
      case 'pause':
        if (this.menuPaused) this.resume();
        else this.pause();
        break;
      case 'pauseAction': {
        const actions: PauseAction[] = ['resume', 'resetTable', 'measureReach', 'restart'];
        const action = actions[Math.round(arg ?? 1) - 1];
        if (this.menuPaused && action) this.pauseAction(action);
        break;
      }
      case 'giantToggle':
        this.giant.enabled = !this.giant.enabled;
        console.info(`[debug] giant body ${this.giant.enabled ? 'on' : 'off'}`);
        break;
      case 'fps':
        this.fps.toggle();
        break;
      case 'stress':
        // Raise the unit cap for this session so the real limit can be found.
        this.goblins.cap = Math.min(DEBUG.stressMax, Math.max(this.goblins.cap, this.goblins.aliveCount + DEBUG.stressAdd));
        // A clean test: no auto trickle changing the count, and the run
        // starts once all the new grunts are out. The battle stops too.
        this.battle.stop();
        this.spawner.auto = false;
        this.fps.resetRun(DEBUG.stressAdd * DEBUG.stressGap);
        this.spawner.sendMany('grunt', DEBUG.stressAdd);
        console.info(`[debug] stress: unit cap ${this.goblins.cap}, auto spawning off`);
        break;
      case 'spinLeft':
      case 'spinRight':
        // A bigger spin moves the board to the left as seen from the seat.
        this.handles.nudge(degToRad(id === 'spinLeft' ? DEBUG.spinStepDeg : -DEBUG.spinStepDeg), 0);
        break;
      case 'balloonFront':
        this.balloons.spawn(this.stage.spin + degToRad(this.debugRng.range(-8, 8)), BALLOONS.introRadius);
        break;
      case 'popBalloons':
        for (const b of this.balloons.list) this.balloons.pop(b);
        break;
      case 'helmetGrunts':
        this.goblins.helmetNext += 3;
        this.spawner.sendGroup('grunt');
        break;
      case 'armoredGrunts':
        this.goblins.armoredNext += 3;
        this.spawner.sendGroup('grunt');
        break;
      case 'celebrate':
        this.juice.celebrate(false, this.boardCenter(), this.stage.boardScale);
        this.troops.cheerAll();
        break;
      case 'boardUp':
      case 'boardDown':
        this.handles.nudge(0, id === 'boardUp' ? DEBUG.heightStepCm : -DEBUG.heightStepCm);
        break;
      case 'nextTime': {
        // The real change (not a jump), held until the next battle starts.
        const now = TIMES_OF_DAY.indexOf(this.dayNight.time);
        this.timeOverride = TIMES_OF_DAY[(now + 1) % TIMES_OF_DAY.length];
        break;
      }
      case 'timeOfDay': {
        const time = TIMES_OF_DAY[Math.round(arg ?? 1) - 1];
        if (time) this.timeOverride = time;
        break;
      }    }
  }
}

