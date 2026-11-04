// Runs one battle: the tutorial director, the win and lose rules, the flags
// and the end panel. It is the TutorialApi: each director call goes to a game
// system (wave spawner, goblins, slingshot). Nothing tutorial-only lives in
// those systems.
import { Vector3 } from 'three';
import type { GameAudio } from '../audio/sound.js';
import { CASTLE_HEALTH, END_PANEL, TOOL_SPOTS, WAVES } from '../config/game.js';
import { WAVE_VOICES } from '../config/sounds.js';
import type { Particles } from '../fx/particles.js';
import type { HandState } from '../player/hands.js';
import { clearWave, createBattle, damageCastle, healthShare, loseCastle, type BattleState } from '../rules/battle.js';
import { degToRad, polarX, polarZ } from '../rules/boardMath.js';
import { Director } from '../rules/director.js';
import type { Random } from '../rules/random.js';
import type { Slingshot } from '../tools/slingshot.js';
import type { EndPanel } from '../ui/endPanel.js';
import type { Goblins } from '../units/goblins.js';
import type { WaveSpawner } from '../units/waveSpawner.js';
import type { Flags } from '../world/flags.js';
import type { Stage } from '../world/stage.js';
import { buildTutorialSteps, TUTORIAL_WAVES, type ToolName, type TutorialApi } from './tutorial.js';

const POOF_COLORS = [0xffffff, 0xddd6c8, 0xb8b0a0];
const temp = new Vector3();

export interface BattleParts {
  stage: Stage;
  goblins: Goblins;
  spawner: WaveSpawner;
  slingshot: Slingshot;
  flags: Flags;
  panel: EndPanel;
  audio: GameAudio;
  particles: Particles;
  rng: Random;
}

export class Battle implements TutorialApi {
  state: BattleState = createBattle(TUTORIAL_WAVES.length, CASTLE_HEALTH);
  /** False before the first start and while the stress test runs. */
  running = false;
  private director: Director<TutorialApi> | null = null;
  private wave = -1;
  private eatenCount = 0;
  private slingHits = 0;
  private endTimer = -1;

  constructor(private parts: BattleParts) {
    parts.goblins.onWallHit = () => {
      if (this.running) damageCastle(this.state, CASTLE_HEALTH.wallHitDamage);
    };
    parts.slingshot.onHit = () => this.slingHits++;
  }

  /** A new tutorial battle from wave 1. */
  start(): void {
    const { goblins, spawner, slingshot, flags, panel } = this.parts;
    spawner.stop();
    goblins.killAll();
    panel.hide();
    // Every tool waits for its wave (docs/giant-tools.md section 6).
    slingshot.setVisible(false);
    slingshot.beckon = false;
    this.state = createBattle(TUTORIAL_WAVES.length, CASTLE_HEALTH);
    flags.show(1, 0, true);
    this.wave = -1;
    this.eatenCount = 0;
    this.slingHits = 0;
    this.endTimer = -1;
    const director = new Director<TutorialApi>(buildTutorialSteps(), this);
    director.onStepEnd = (id, how, time, fallbacks) =>
      console.info(`[director] ${id}: ${how} after ${time.toFixed(1)} s, ${fallbacks} fallbacks`);
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
  }

  /** Counts an eaten goblin (food comes in build step 4). */
  noteEaten(): void {
    this.eatenCount++;
  }

  update(dt: number, hands: HandState[]): void {
    const { spawner, flags, panel, goblins } = this.parts;
    if (this.running && this.state.phase === 'playing') {
      damageCastle(this.state, goblins.countMode('intruder') * CASTLE_HEALTH.intruderDamagePerSec * dt);
      this.director?.update(dt);
      spawner.rate = this.director?.spawnRate ?? 1;
      if (this.state.phase !== 'playing') this.end();
    }
    flags.show(healthShare(this.state), this.state.wavesCleared / this.state.totalWaves);
    flags.update(dt);
    if (this.endTimer > 0) {
      this.endTimer -= dt;
      if (this.endTimer <= 0) panel.show(this.state.phase === 'won' ? 'won' : 'lost');
    }
    if (panel.update(hands, dt)) this.start();
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
    console.info(`[battle] wave ${index + 1}: ${TUTORIAL_WAVES[index].teaches}`);
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

  climberInFront(onRampart: boolean): void {
    const spread = degToRad(WAVES.frontClimberSpread);
    // The board angle in front of the player right now.
    this.parts.goblins.spawnClimberAt(this.parts.stage.spin + this.parts.rng.range(-spread, spread), onRampart);
  }

  showTool(tool: ToolName): void {
    if (tool !== 'slingshot') {
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

  hasTool(tool: ToolName): boolean {
    return tool === 'slingshot';
  }

  toolUses(tool: ToolName): number {
    return tool === 'slingshot' ? this.slingHits : 0;
  }

  eaten(): number {
    return this.eatenCount;
  }
}
