// The game loop. Builds the world once, then runs the small systems in a
// fixed order every frame: hands, handles, director, goblins, grab and eat, effects.
import { createSystem, VisibilityState } from '@iwsdk/core';
import { DirectionalLight, Fog, Object3D, Quaternion, Vector3 } from 'three';
import { GameAudio } from './audio/sound.js';
import { HANDLES, STAGE, TOY_SPAWN } from './config/game.js';
import { TOY_ROADS } from './config/toyMap.js';
import { ToySpawner } from './director/toySpawner.js';
import { Particles } from './fx/particles.js';
import { GrabEat } from './player/grabEat.js';
import { BoardHandles } from './player/handles.js';
import { HandTracker } from './player/hands.js';
import { degToRad } from './rules/boardMath.js';
import { createRandom, type Random } from './rules/random.js';
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
  private particles!: Particles;
  private spawner!: ToySpawner;
  private debugRng!: Random;
  private placeTimer = -1;
  private wasImmersive = false;

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

    const [built] = await Promise.all([
      buildBoard(this.stage.boardSpin, TOY_ROADS, seed),
      this.audio.load(),
    ]);
    this.goblins = new Goblins(this.stage.boardSpin, built.roads, createRandom(seed + 200), this.audio);
    await this.goblins.load();
    this.grabEat = new GrabEat(this.hands, this.goblins, this.handles, this.audio, this.particles);
    this.spawner = new ToySpawner(this.goblins, built.roads.length, createRandom(seed + 300));
    this.debugRng = createRandom(seed + 400);

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

  private placeBoard(): void {
    this.readHead();
    this.grabEat?.releaseAll();
    this.stage.place(headPosition, headQuaternion);
  }

  update(delta: number): void {
    if (!this.ready) return;
    // Entering VR: place the board once the head pose has settled.
    const immersive = this.immersive;
    if (immersive && !this.wasImmersive) this.placeTimer = STAGE.placeDelay;
    this.wasImmersive = immersive;
    // Simple auto-pause while the Quest menu is open (full pause is build step 6).
    const state = this.visibilityState.value;
    if (state === VisibilityState.Hidden || state === VisibilityState.VisibleBlurred) return;

    const dt = Math.min(delta, 0.05);
    if (this.placeTimer > 0) {
      this.placeTimer -= dt;
      if (this.placeTimer <= 0) this.placeBoard();
    }

    this.player.updateWorldMatrix(true, false);
    this.hands.update(this.world.xrFrame, this.world.xrReferenceSpace, this.player.matrixWorld, dt);
    this.readHead();
    this.debugKeys(dt);
    this.handles.update(dt);
    this.spawner.update(dt);
    this.goblins.update(dt);
    this.grabEat.update(dt, headPosition, headForward);
    this.particles.update(dt);
  }

  private debugKeys(dt: number): void {
    const keys = this.input.keyboard;
    if (keys.getKeyDown('KeyG')) this.spawner.sendGroup('grunt');
    if (keys.getKeyDown('KeyR')) this.spawner.sendGroup('runner');
    if (keys.getKeyDown('KeyV')) this.spawner.sendGroup('climber');
    if (keys.getKeyDown('KeyC')) {
      // The board angle that is in front of the player right now.
      this.goblins.spawnClimberAt(this.stage.spin + degToRad(this.debugRng.range(-10, 10)));
    }
    if (keys.getKeyDown('KeyT')) {
      this.spawner.auto = !this.spawner.auto;
      console.info(`[debug] auto spawning ${this.spawner.auto ? 'on' : 'off'}`);
    }
    if (keys.getKeyDown('KeyK')) {
      this.spawner.clear();
      this.goblins.killAll();
    }
    if (keys.getKeyDown('KeyB')) this.grabEat.debugEat(headPosition, headForward);
    if (keys.getKeyDown('KeyP')) this.placeBoard();
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
}

