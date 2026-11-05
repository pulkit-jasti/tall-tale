// The game loop. Builds the world once from the map blueprint, then runs the
// small systems in a fixed order every frame: hands, handles, battle (director,
// waves, flags, end panel), goblins, troops, triggers, grab and eat,
// slingshot, food tools, food jar, effects, sky.
import { createSystem, VisibilityState } from '@iwsdk/core';
import { DirectionalLight, Fog, Object3D, Quaternion, Vector3 } from 'three';
import { mic } from './audio/mic.js';
import { GameAudio } from './audio/sound.js';
import { DEBUG, FPS, HANDLES, SKY, STAGE, TRIGGERS, XR } from './config/game.js';
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
import { Markers } from './ui/markers.js';
import { ThreatCues } from './ui/threatCues.js';
import { loadUiImages } from './ui/uiImages.js';
import { WaveSpawner } from './units/waveSpawner.js';
import { Flags } from './world/flags.js';
import { FpsCounter } from './debug/fpsCounter.js';
import { mark } from './debug/perfMarks.js';
import { sendHeartbeat, sendRunStats, sendStressTest, takeRemoteCommands } from './debug/remote.js';
import { StressTest } from './debug/stressTest.js';
import { ToySpawner } from './director/toySpawner.js';
import { Particles } from './fx/particles.js';
import { GrabEat } from './player/grabEat.js';
import { BoardHandles } from './player/handles.js';
import { HandTracker } from './player/hands.js';
import { degToRad } from './rules/boardMath.js';
import { createRandom, type Random } from './rules/random.js';
import { checkReach } from './rules/reach.js';
import { Bell } from './tools/bell.js';
import { FlySwatter } from './tools/flySwatter.js';
import type { HandTool } from './tools/handTool.js';
import { Megaphone } from './tools/megaphone.js';
import { PepperShaker } from './tools/pepperShaker.js';
import { Slingshot } from './tools/slingshot.js';
import { StunWave } from './tools/stunWave.js';
import { Goblins } from './units/goblins.js';
import { Troops } from './units/troops.js';
import { Hills } from './world/hills.js';
import { Sky, skyDirection } from './world/sky.js';
import { Triggers } from './world/triggers.js';
import { buildBoard } from './world/boardBuilder.js';
import { FoodJar } from './world/foodJar.js';
import { buildSeatFloor, GiantBody } from './world/giant.js';
import { Windmill } from './world/settlements.js';
import { Stage } from './world/stage.js';

const headPosition = new Vector3();
const headQuaternion = new Quaternion();
const headForward = new Vector3();
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
  private food!: FoodJar;
  private swatter!: FlySwatter;
  private pepper!: PepperShaker;
  private megaphone!: Megaphone;
  private bell!: Bell;
  private stun!: StunWave;
  private tools: HandTool[] = [];
  private troops!: Troops;
  private triggers!: Triggers;
  private sky: Sky | null = null;
  private fog!: Fog;
  private particles!: Particles;
  private threat!: ThreatCues;
  private spawner!: ToySpawner;
  private battle!: Battle;
  private debugRng!: Random;
  private fps!: FpsCounter;
  private stressTest!: StressTest;
  private placeTimer = -1;
  private wasImmersive = false;
  /** The Quest menu is open, the headset is off or the page is hidden. */
  private hidden = false;
  /** Paused from the wrist button (or auto-paused in VR): stays paused until Resume. */
  private menuPaused = false;
  /** "Measure reach" from the pause panel is running (the battle stays frozen). */
  private measuring = false;
  private paused = false;
  private pauseMenu!: PauseMenu;
  private giant!: GiantBody;
  private windmill!: Windmill;
  private heartbeatTimer = 0;

  init(): void {
    void this.setup().catch((error) => console.error('[game] setup failed', error));
  }

  private async setup(): Promise<void> {
    const root: Object3D = this.world.getPersistentRoot();
    const blueprint = parseBlueprint(tutorialMap);
    // The tutorial uses the blueprint's fixed seed, so every run plays the same.
    const seed = blueprint.seed;

    this.stage = new Stage(root);
    // The sunlight comes from the sun's side. Like the sky, it never turns.
    const sun = new DirectionalLight(0xfff4e0, SKY.lightIntensity);
    skyDirection(SKY.sunAngleDeg, SKY.lightElevationDeg, sun.position).multiplyScalar(7);
    root.add(sun, sun.target);
    // Haze in the dome's horizon color. It starts past the board and thickens
    // far out, so the last mountains fade into the sky. Grows with the board (update).
    this.fog = new Fog(SKY.domeHorizonColor, SKY.fogNear, SKY.fogFar);
    this.scene.fog = this.fog;

    // Decor only: hills around the board, the sky dome, a sun and slow clouds. None of them turn (comfort rule).
    new Hills(this.stage.boardLift, createRandom(seed + 710));
    if (SKY.enabled) this.sky = new Sky(root, this.stage.boardLift, createRandom(seed + 700));
    this.audio = new GameAudio(root, this.player.head, createRandom(seed + 100));
    this.particles = new Particles(root, createRandom(seed + 101));
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
    this.windmill = new Windmill(built.sails);
    this.goblins = new Goblins(this.stage.boardSpin, built.network, createRandom(seed + 200), this.audio);
    this.goblins.particles = this.particles;
    this.slingshot = new Slingshot(this.stage, this.goblins, this.audio, this.particles);
    this.food = new FoodJar(this.stage, this.audio, this.particles);
    const toolParts = { stage: this.stage, goblins: this.goblins, food: this.food, audio: this.audio, particles: this.particles };
    this.swatter = new FlySwatter(toolParts);
    this.pepper = new PepperShaker(toolParts);
    this.stun = new StunWave(this.stage, this.goblins, this.audio, this.particles);
    this.megaphone = new Megaphone(toolParts, this.stun);
    this.bell = new Bell(toolParts, this.stun);
    this.tools = [this.swatter, this.pepper, this.megaphone, this.bell];
    this.troops = new Troops(this.stage.boardSpin, built.network, this.goblins, this.audio, this.particles, createRandom(seed + 800));
    this.triggers = new Triggers(this.stage.boardSpin, built.network, this.goblins, this.audio, this.particles, createRandom(seed + 900));
    await Promise.all([
      this.goblins.load(),
      this.slingshot.load(),
      this.food.load(),
      this.troops.load(),
      this.triggers.load(blueprint.triggers),
      ...this.tools.map((t) => t.load()),
    ]);
    // Every trigger can be shot: the aim assist bends toward it and it glows while aimed at.
    for (const target of this.triggers.targets) this.slingshot.addTarget(target);
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
    this.pauseMenu = new PauseMenu(root, this.audio);
    this.grabEat = new GrabEat(this.hands, this.goblins, this.handles, this.slingshot, this.tools, this.audio, this.particles);
    this.spawner = new ToySpawner(this.goblins, built.network.graph.camps.length, createRandom(seed + 300));
    this.debugRng = createRandom(seed + 400);
    this.battle = new Battle({
      stage: this.stage,
      goblins: this.goblins,
      spawner: new WaveSpawner(
        this.stage.boardSpin,
        built.network,
        this.goblins,
        built.hills,
        this.audio,
        createRandom(seed + 500),
      ),
      slingshot: this.slingshot,
      tools: { swatter: this.swatter, pepper: this.pepper, megaphone: this.megaphone, bell: this.bell },
      troops: this.troops,
      triggers: this.triggers,
      stun: this.stun,
      food: this.food,
      flags: new Flags(this.stage.boardLift, TUTORIAL_WAVES.length),
      panel: new EndPanel(this.stage.boardLift, this.audio),
      sign: new HintSign(this.stage.boardLift, this.audio),
      markers: new Markers(root),
      ghost,
      ghostAim: new GhostAim(root),
      pointer: new PointerArrow(root),
      bait: new LessonBait(this.goblins, built.network),
      wristButton: (out) => this.pauseMenu.wristWorld(out),
      audio: this.audio,
      particles: this.particles,
      threat: this.threat,
      rng: createRandom(seed + 600),
      isHeld: (goblin) => this.grabEat.isHolding(goblin),
    });
    this.grabEat.onEat = (goblin) => {
      this.food.eat(goblin.seasoned);
      this.battle.noteEaten();
    };
    this.grabEat.onGrab = () => this.battle.notePicked();
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
      },
      spawn: (count) => {
        this.goblins.cap = Math.min(DEBUG.stressMax, Math.max(this.goblins.cap, this.goblins.aliveCount + count));
        this.spawner.sendMany('grunt', count);
        return count * DEBUG.stressGap;
      },
      resetRun: (extraWarmup) => this.fps.resetRun(extraWarmup),
      stats: () => this.fps.currentRun(),
      units: () => this.goblins.aliveCount,
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

  private placeBoard(): void {
    mark('board placed');
    this.readHead();
    this.grabEat?.releaseAll();
    this.stage.place(headPosition, headQuaternion);
    this.giant?.snap();
  }

  update(delta: number): void {
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
      if (hidden && immersive && this.battle.canPause) this.pause();
    }
    if (!this.battle.canPause && this.menuPaused) this.resume();
    const paused = hidden || this.menuPaused;
    if (paused !== this.paused) {
      this.paused = paused;
      this.fps.status = paused ? 'paused' : '';
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
      });
    }
    if (hidden) return;

    // The hands, the head and the debug keys run while paused too: the pause panel needs them.
    const dt = Math.min(delta, 0.05);
    this.player.updateWorldMatrix(true, false);
    this.hands.update(this.world.xrFrame, this.world.xrReferenceSpace, this.player.matrixWorld, dt);
    this.readHead();
    this.debugKeys(dt);
    // The giant's body stays under the head, also while paused.
    this.giant.update(dt, headPosition, headForward, this.stage.boardLift.position.y);
    if (this.measuring) {
      // The reach check on the frozen battle. The board grows or shrinks to the player when it is done.
      this.stage.update(dt);
      if (this.battle.updateMeasure(dt, this.hands.hands, headPosition, headForward)) {
        this.measuring = false;
        this.resume();
      }
      return;
    }
    if (this.menuPaused) {
      // Shown here, not when pausing: auto-pause happens while the head pose is unknown (Quest menu).
      if (!this.pauseMenu.isOpen) this.pauseMenu.show(headPosition, headForward, this.stage.boardScale);
      const action = this.pauseMenu.update(dt, this.hands.hands, headPosition, headForward);
      if (action) this.pauseAction(action);
      return;
    }
    if (this.pauseMenu.updateWrist(dt, this.hands, headPosition, immersive && this.battle.canPause)) this.pause();
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
    this.goblins.update(dt);
    this.troops.update(dt);
    this.triggers.update(dt);
    // No mic: the bell is out instead. If the megaphone is ever out anyway (debug), it is tied down.
    this.megaphone.tiedDown = !mic.on;
    this.grabEat.update(dt, headPosition, headForward);
    this.slingshot.update(dt, headPosition);
    for (const tool of this.tools) tool.update(dt);
    this.stun.update(dt);
    this.food.update(dt);
    this.threat.update(dt);
    // The red arrow only while a battle is fought.
    if (this.battle.canPause) this.threat.updateArrow(dt, this.goblins, headPosition, headForward);
    else this.threat.hideArrow();
    this.particles.update(dt);
    this.sky?.update(dt);
    this.windmill.update(dt);
    this.fog.near = SKY.fogNear * this.stage.boardScale;
    this.fog.far = SKY.fogFar * this.stage.boardScale;
  }

  /**
   * Pauses the battle (wrist button, auto-pause or debug): everything
   * freezes, whatever the hands held is let go, and the pause panel comes
   * up on the next visible frame.
   */
  private pause(): void {
    if (this.menuPaused || !this.battle.canPause) return;
    this.menuPaused = true;
    this.grabEat.releaseAll();
    this.battle.hideHints();
    this.threat.hideArrow();
    this.pauseMenu.hideWrist();
    this.audio.play('pauseOpen');
    console.info('[game] paused (pause panel)');
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
        this.battle.start();
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
        this.battle.start();
        break;
      }
      case 'grunts':
        this.spawner.sendGroup('grunt');
        break;
      case 'runners':
        this.spawner.sendGroup('runner');
        break;
      case 'climberRoad':
        this.spawner.sendGroup('climber');
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
      case 'addFood':
        this.food.add(DEBUG.foodAdd);
        console.info(`[debug] food ${this.food.food}`);
        break;
      case 'emptyFood':
        this.food.spend(this.food.food);
        console.info('[debug] food 0: the food tools show Locked');
        break;
      case 'showTools':
        // Only one stun tool is ever out: the megaphone with a mic, the bell without.
        for (const tool of this.tools) {
          if (tool === (mic.on ? this.bell : this.megaphone)) continue;
          if (!tool.visible) tool.appear();
        }
        break;
      case 'swat':
        this.swatter.debugSwat();
        break;
      case 'pepper':
        this.pepper.debugShake();
        break;
      case 'megaphone':
        // They share a spot: the other one goes away first.
        this.bell.setVisible(false);
        this.megaphone.debugScream();
        break;
      case 'bell':
        this.megaphone.setVisible(false);
        this.bell.debugRing();
        break;
      case 'troops':
        this.troops.sendSquad();
        break;
      case 'troopsToggle':
        this.troops.enabled = !this.troops.enabled;
        console.info(`[debug] troops ${this.troops.enabled ? 'on' : 'off'}`);
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
      case 'boardUp':
      case 'boardDown':
        this.handles.nudge(0, id === 'boardUp' ? DEBUG.heightStepCm : -DEBUG.heightStepCm);
        break;
    }
  }
}

