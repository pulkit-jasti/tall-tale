// The game loop. Builds the world once, then runs the small systems in a
// fixed order every frame: hands, handles, director, goblins, grab and eat,
// slingshot, effects.
import { createSystem, VisibilityState } from '@iwsdk/core';
import { DirectionalLight, Fog, Object3D, Quaternion, Vector3 } from 'three';
import { GameAudio } from './audio/sound.js';
import { DEBUG, FPS, HANDLES, STAGE, TOY_SPAWN, XR } from './config/game.js';
import { TOY_ROADS } from './config/toyMap.js';
import { DEBUG_ACTIONS, type DebugCommand } from './debug/debugKeys.js';
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
import { Slingshot } from './tools/slingshot.js';
import { Goblins } from './units/goblins.js';
import { buildBoard } from './world/boardBuilder.js';
import { Stage } from './world/stage.js';

const headPosition = new Vector3();
const headQuaternion = new Quaternion();
const headForward = new Vector3();

export class GameSystem extends createSystem({}) {
  private ready = false;
  private stage!: Stage;
  private audio!: GameAudio;
  private hands = new HandTracker();
  private handles!: BoardHandles;
  private goblins!: Goblins;
  private grabEat!: GrabEat;
  private slingshot!: Slingshot;
  private particles!: Particles;
  private spawner!: ToySpawner;
  private debugRng!: Random;
  private fps!: FpsCounter;
  private stressTest!: StressTest;
  private placeTimer = -1;
  private wasImmersive = false;
  private paused = false;
  private heartbeatTimer = 0;

  init(): void {
    void this.setup().catch((error) => console.error('[game] setup failed', error));
  }

  private async setup(): Promise<void> {
    const root: Object3D = this.world.getPersistentRoot();
    const seed = TOY_SPAWN.seed;

    const sun = new DirectionalLight(0xfff4e0, 1.6);
    sun.position.set(-3, 6, 2);
    root.add(sun);
    this.scene.fog = new Fog(0xc9dce6, 3.5, 9);

    this.stage = new Stage(root);
    this.audio = new GameAudio(root, this.player.head, createRandom(seed + 100));
    this.particles = new Particles(root, createRandom(seed + 101));
    this.handles = new BoardHandles(this.stage);
    this.fps = new FpsCounter(this.stage.boardLift);

    const [built] = await Promise.all([
      buildBoard(this.stage.boardSpin, TOY_ROADS, seed),
      this.audio.load(),
    ]);
    this.goblins = new Goblins(this.stage.boardSpin, built.roads, createRandom(seed + 200), this.audio);
    this.slingshot = new Slingshot(this.stage, this.goblins, this.audio, this.particles);
    await Promise.all([this.goblins.load(), this.slingshot.load()]);
    this.fps.countUnits = () => this.goblins.aliveCount;
    this.fps.onReport = (stats) => {
      sendRunStats(stats);
      if (stats.final) {
        console.info(
          `[fps] run: ${stats.units} units, ${stats.seconds.toFixed(0)} s, avg ${stats.avgFps.toFixed(1)}, ` +
            `1% low ${stats.lowFps.toFixed(0)}, missed ${stats.missedPct.toFixed(1)}%`,
        );
      }
    };
    this.grabEat = new GrabEat(this.hands, this.goblins, this.handles, this.slingshot, this.audio, this.particles);
    this.spawner = new ToySpawner(this.goblins, built.roads.length, createRandom(seed + 300));
    this.debugRng = createRandom(seed + 400);
    this.stressTest = new StressTest({
      clear: () => {
        this.spawner.auto = false;
        this.spawner.clear();
        this.goblins.killAll();
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
  }

  update(delta: number): void {
    if (!this.ready) return;
    // Entering VR: place the board once the head pose has settled.
    const immersive = this.immersive;
    if (immersive && !this.wasImmersive) {
      this.placeTimer = STAGE.placeDelay;
      this.requestFrameRate();
    }
    this.wasImmersive = immersive;
    // Simple auto-pause while the Quest menu is open (full pause is build step 6).
    // Read the XR session directly too, and the page itself, in case one of
    // them reports the menu and the other does not. Sound stops as well.
    const state = this.world.session?.visibilityState ?? this.visibilityState.value;
    const paused =
      state === VisibilityState.Hidden ||
      state === VisibilityState.VisibleBlurred ||
      document.visibilityState === 'hidden';
    if (paused !== this.paused) {
      this.paused = paused;
      this.audio.setPaused(paused);
      console.info(`[game] ${paused ? 'paused' : 'resumed'} (${state})`);
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
        units: this.goblins.aliveCount,
        testing: this.stressTest.active,
      });
    }
    if (paused) return;

    const dt = Math.min(delta, 0.05);
    if (this.placeTimer > 0) {
      this.placeTimer -= dt;
      if (this.placeTimer <= 0) this.placeBoard();
    }

    this.player.updateWorldMatrix(true, false);
    this.hands.update(this.world.xrFrame, this.world.xrReferenceSpace, this.player.matrixWorld, dt);
    this.readHead();
    this.debugKeys(dt);
    this.stressTest.update(dt);
    this.handles.update(dt);
    this.spawner.update(dt);
    this.goblins.update(dt);
    this.grabEat.update(dt, headPosition, headForward);
    this.slingshot.update(dt, headPosition);
    this.particles.update(dt);
  }

  private debugKeys(dt: number): void {
    const keys = this.input.keyboard;
    for (const action of DEBUG_ACTIONS) {
      if (action.code && keys.getKeyDown(action.code)) this.runDebug(action.id);
    }
    // Buttons on the laptop debug page (dev server only).
    for (const id of takeRemoteCommands()) this.runDebug(id);
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

  private runDebug(id: DebugCommand): void {
    switch (id) {
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
      case 'fps':
        this.fps.toggle();
        break;
      case 'stress':
        // Raise the unit cap for this session so the real limit can be found.
        this.goblins.cap = Math.min(DEBUG.stressMax, Math.max(this.goblins.cap, this.goblins.aliveCount + DEBUG.stressAdd));
        // A clean test: no auto trickle changing the count, and the run
        // starts once all the new grunts are out.
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

