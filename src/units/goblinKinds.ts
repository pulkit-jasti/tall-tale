// The Phase 3 goblins' own behavior (docs/v3-plan.md, Phase 3, built
// 2026-11-17). The goblins system (src/units/goblins.ts) moves, fights,
// climbs and draws every goblin; this adds what each new type does on top:
//
// - Digger: tunnels from its camp straight at the castle, unseen (no compass
//   wedge, untouchable). A dirt mound races in for its last DIGGER.moundLead
//   seconds. A peppered ring segment stops it outside the wall: it comes up
//   sneezing and seasoned, walks to the wall and climbs like a grunt (Bless
//   You). Otherwise it comes up in the courtyard as an intruder, with a dirt
//   burst and the wall flash.
// - Shaman: walks slower than its group (it stays at the back), stops on its
//   road at SHAMAN.stopRadius while goblins are near it, and every
//   SHAMAN.regearEvery puts a helmet (or a shield) back on one stripped goblin
//   near it. Alone for a while, it walks on and climbs like a grunt.
// - Bomber: a keg on its back. Knocked out anywhere, it blows up among its own
//   group (armor does not help, kegs nearby go off, knights nearby are hurt).
//   At the wall it lights its fuse: pinch it and toss it, and it blows up where
//   it lands; otherwise a big wall blast. It cannot be eaten.
// - Archers: stop in a group at GOBLIN_ARCHERS.stopRadius and shoot volleys
//   at the wall garrison only. Once the garrison is empty they walk in and
//   climb like grunts, and never stop again.
//
// Board cm, seconds. One instanced mesh for the mounds, one arrow pool.
import { InstancedMesh, Matrix4, MeshStandardMaterial, Object3D, SphereGeometry, Vector3 } from 'three';
import type { GameAudio } from '../audio/sound.js';
import { BOMBER, CASTLE, DIGGER, GOBLIN_ARCHERS, PEPPER_RING, SHAMAN, TROOPS, type GoblinType } from '../config/game.js';
import { mark } from '../debug/perfMarks.js';
import type { Particles } from '../fx/particles.js';
import type { PickTool } from '../rules/campaign.js';
import { degToRad, polarX, polarZ } from '../rules/boardMath.js';
import type { Random } from '../rules/random.js';
import type { PepperRing } from '../tools/pepperRing.js';
import type { ThreatCues } from '../ui/threatCues.js';
import type { Triggers } from '../world/triggers.js';
import type { Garrison } from './garrison.js';
import type { Goblin, Goblins } from './goblins.js';
import { Arrows, type Arrow, type Troop, type Troops } from './troops.js';

const temp = new Vector3();
const temp2 = new Vector3();
const matrix = new Matrix4();
const hidden = new Matrix4().makeScale(0, 0, 0);
/** A goblin arrow that misses lands in a little dust. */
const MISS_DUST = [0xc9b79a, 0xa8957a];

interface Blast {
  readonly at: Vector3;
  cause: PickTool | null;
}

export class GoblinKinds {
  /** Castle damage (the battle's own, so it only counts while a battle runs). Set by the game. */
  damage: (amount: number) => void = () => {};

  private mounds: InstancedMesh;
  private moundsShown = false;
  private arrows: Arrows;
  private volleyTimer: number = GOBLIN_ARCHERS.volleyEvery;
  private soldiers: Troop[] = [];
  /** Bombers knocked out this frame: their blasts go off in the next update (never inside another system's loop). */
  private blasts: Blast[] = [];
  private blastPool: Blast[] = [];

  constructor(
    private board: Object3D,
    private goblins: Goblins,
    private troops: Troops,
    private garrison: Garrison,
    private triggers: Triggers,
    private pepperRing: PepperRing,
    private threat: ThreatCues,
    private particles: Particles,
    private audio: GameAudio,
    private rng: Random,
  ) {
    // A low dirt dome over a digger near the wall (a simple shape, docs/placeholder-shapes.md "Digger mound").
    const dome = new SphereGeometry(1, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2);
    this.mounds = new InstancedMesh(dome, new MeshStandardMaterial({ color: DIGGER.moundColor, roughness: 1, flatShading: true }), DIGGER.max);
    this.mounds.frustumCulled = false;
    this.mounds.visible = false;
    for (let i = 0; i < DIGGER.max; i++) this.mounds.setMatrixAt(i, hidden);
    board.add(this.mounds);
    this.arrows = new Arrows(board, GOBLIN_ARCHERS);
    goblins.onBomberBlast = (g, cause) => this.queueBlast(g, cause);
    goblins.onBomberWall = (g) => this.wallBlast(g);
    goblins.onFuseLit = (g) => this.fuseLit(g);
  }

  /** A goblin of a Phase 3 type comes out of a camp: its own start (a digger goes under the ground). */
  spawn(type: GoblinType, camp: number): Goblin | null {
    if (type === 'digger') return this.spawnDigger(camp);
    const g = this.goblins.spawnAtCamp(type, camp);
    if (g && type === 'archer') g.postRadius = GOBLIN_ARCHERS.stopRadius + this.rng.range(-GOBLIN_ARCHERS.stopJitter, GOBLIN_ARCHERS.stopJitter);
    return g;
  }

  /** A digger under its camp, tunneling a little to either side of the camp's direction. */
  spawnDigger(camp: number): Goblin | null {
    const g = this.goblins.spawnDigger(camp);
    if (!g) return null;
    const r = Math.hypot(g.root.position.x, g.root.position.z);
    g.tunnelAngle += degToRad(this.rng.range(-DIGGER.spreadDeg, DIGGER.spreadDeg));
    g.root.position.set(polarX(r, g.tunnelAngle), 0, polarZ(r, g.tunnelAngle));
    g.tunnelTo = this.rng.range(DIGGER.surfaceMin, DIGGER.surfaceMax);
    g.kindTimer = 0;
    return g;
  }

  update(dt: number): void {
    this.flushBlasts();
    let mound = 0;
    let archers = false;
    for (const g of this.goblins.list) {
      switch (g.type) {
        case 'digger':
          if (g.mode === 'tunneling') mound = this.dig(g, dt, mound);
          break;
        case 'shaman':
          if (g.mode !== 'dead') this.shaman(g, dt);
          break;
        case 'bomber':
          if (g.lit && g.mode !== 'dead') this.burnFuse(g, dt);
          break;
        case 'archer':
          if (g.mode !== 'dead') {
            archers = true;
            this.archerPost(g);
          }
          break;
        default:
          break;
      }
    }
    for (let i = mound; i < DIGGER.max; i++) this.mounds.setMatrixAt(i, hidden);
    if (mound > 0 || this.moundsShown) this.mounds.instanceMatrix.needsUpdate = true;
    this.mounds.visible = mound > 0;
    this.moundsShown = mound > 0;
    if (archers) this.volley(dt);
    else this.volleyTimer = GOBLIN_ARCHERS.volleyEvery;
    this.arrows.update(dt, (a) => this.arrowLands(a));
  }

  /** A new battle or map: no blasts waiting, no arrows in the air, no mounds. */
  clear(): void {
    for (const b of this.blasts) this.blastPool.push(b);
    this.blasts.length = 0;
    this.arrows.clear();
    for (let i = 0; i < DIGGER.max; i++) this.mounds.setMatrixAt(i, hidden);
    this.mounds.instanceMatrix.needsUpdate = true;
    this.mounds.visible = false;
  }

  // ---- Digger ----

  /** Moves a tunneling digger in. Returns the next free mound slot. */
  private dig(g: Goblin, dt: number, slot: number): number {
    const p = g.root.position;
    const r = Math.hypot(p.x, p.z);
    const next = r - g.stats.speed * dt;
    const ring = PEPPER_RING.outer;
    // The pepper ring: a peppered segment stops it outside the wall (it uses all of that segment up).
    if (r > ring && next <= ring && this.pepperRing.useAll(g.tunnelAngle)) {
      const at = (PEPPER_RING.inner + ring) / 2;
      p.set(polarX(at, g.tunnelAngle), 0, polarZ(at, g.tunnelAngle));
      this.surface(g, false);
      this.goblins.pepper(g);
      return slot;
    }
    if (next <= g.tunnelTo) {
      p.set(polarX(g.tunnelTo, g.tunnelAngle), 0, polarZ(g.tunnelTo, g.tunnelAngle));
      this.surface(g, true);
      return slot;
    }
    p.set(polarX(next, g.tunnelAngle), 0, polarZ(next, g.tunnelAngle));
    // The mound only for its last moments outside the wall: the only warning.
    const left = (next - CASTLE.wallOut) / g.stats.speed;
    if (next <= CASTLE.wallOut || left > DIGGER.moundLead || slot >= DIGGER.max) return slot;
    const grow = Math.min(1, (DIGGER.moundLead - left) / 0.4);
    const bob = 1 + Math.sin(g.kindTimer * 30) * 0.12;
    matrix.makeScale(DIGGER.moundRadius * grow, DIGGER.moundHeight * grow * bob, DIGGER.moundRadius * grow).setPosition(p.x, 0, p.z);
    this.mounds.setMatrixAt(slot, matrix);
    g.kindTimer += dt;
    // Clods of dirt fly up as it goes, and a soft digging sound now and then.
    if (Math.floor((g.kindTimer - dt) / DIGGER.clodEvery) !== Math.floor(g.kindTimer / DIGGER.clodEvery)) {
      this.particles.burst(this.board.localToWorld(temp.copy(p)), DIGGER.clodColors, 2, 0.06);
    }
    if (Math.floor((g.kindTimer - dt) / 0.5) !== Math.floor(g.kindTimer / 0.5)) this.audio.play('diggerDig', temp, 1, 0.2);
    return slot + 1;
  }

  /** It breaks out of the ground: a dirt burst, a sound and the wall flash (seen without sound, AGENTS.md). */
  private surface(g: Goblin, inside: boolean): void {
    this.goblins.surfaceDigger(g, inside);
    this.board.localToWorld(temp.copy(g.root.position));
    this.particles.burst(temp, DIGGER.clodColors, DIGGER.burstCount, 0.25);
    this.audio.play('diggerSurface', temp);
    this.threat.wallHit(g, !inside);
    mark('digger up');
  }

  // ---- Shaman ----

  private shaman(g: Goblin, dt: number): void {
    const p = g.root.position;
    const busy = g.stunned > 0 || g.paused > 0 || g.sneezeLeft > 0 || g.confused > 0;
    // Its group: goblins on their feet near it (not other shamans).
    let near = 0;
    const r2 = SHAMAN.auraRadius * SHAMAN.auraRadius;
    let best: Goblin | null = null;
    let bestD = r2;
    for (const o of this.goblins.list) {
      if (o === g || o.type === 'shaman' || !this.goblins.isHittable(o) || o.mode === 'riding') continue;
      const d = (o.root.position.x - p.x) ** 2 + (o.root.position.z - p.z) ** 2;
      if (d > r2) continue;
      near++;
      if (d < bestD && this.goblins.canRegear(o)) {
        bestD = d;
        best = o;
      }
    }
    // Its post: it stops on its road in the far zone while goblins are near it, then walks on alone.
    if (g.mode === 'walking' && !g.advanced) {
      if (!g.standing && Math.hypot(p.x, p.z) <= SHAMAN.stopRadius) {
        g.standing = true;
        g.timer = SHAMAN.aloneFor;
        if (!busy) g.play('idle');
      }
      if (g.standing) {
        if (near > 0) g.timer = SHAMAN.aloneFor;
        else {
          g.timer -= dt;
          if (g.timer <= 0) this.goblins.walkOn(g);
        }
      }
    }
    // The cast: gear back on one stripped goblin near it.
    if (g.kindTimer > 0) g.kindTimer -= dt;
    if (busy || g.kindTimer > 0 || !best || (g.mode !== 'walking' && g.mode !== 'toWall' && g.mode !== 'fighting')) return;
    if (!this.goblins.regear(best)) return;
    g.kindTimer = SHAMAN.regearEvery;
    g.face(best.root.position.x - p.x, best.root.position.z - p.z);
    g.play('interact-right', false, 1.2, true);
    this.goblins.centerWorld(best, temp);
    this.particles.burst(temp, SHAMAN.sparkColors, 10, 0.12);
    this.goblins.centerWorld(g, temp2);
    temp2.y += g.stats.height * 0.006;
    this.particles.burst(temp2, SHAMAN.sparkColors, 6, 0.08);
    this.audio.play('shamanCast', temp2, 1, 0.3);
    mark('shaman cast');
  }

  // ---- Bomber ----

  private fuseLit(g: Goblin): void {
    this.audio.play('bomberFuse', this.goblins.worldPosition(g, temp));
    this.threat.wallHit(g);
  }

  /** A lit fuse: sparks over the keg, and the wall under it flashes like a hit (seen without sound). */
  private burnFuse(g: Goblin, dt: number): void {
    g.kindTimer += dt;
    if (Math.floor((g.kindTimer - dt) / BOMBER.sparkEvery) !== Math.floor(g.kindTimer / BOMBER.sparkEvery)) {
      temp.copy(g.root.position);
      temp.y += g.stats.height * 1.05;
      this.particles.burst(this.board.localToWorld(temp), BOMBER.sparkColors, 2, 0.1);
    }
    if (g.mode === 'fuse' && Math.floor((g.kindTimer - dt) / 0.35) !== Math.floor(g.kindTimer / 0.35)) this.threat.wallHit(g, false);
  }

  private queueBlast(g: Goblin, cause: PickTool | null): void {
    const b = this.blastPool.pop() ?? { at: new Vector3(), cause: null };
    b.at.copy(g.root.position);
    b.cause = cause;
    this.blasts.push(b);
  }

  /** The blasts of bombers knocked out since the last frame (one blast may knock out another bomber: next frame). */
  private flushBlasts(): void {
    if (this.blasts.length === 0) return;
    const now = this.blasts.splice(0, this.blasts.length);
    for (const b of now) {
      this.blast(b.at, b.cause);
      this.blastPool.push(b);
    }
  }

  /** A keg blows up on the board: goblins and kegs near it, and knights near it are hurt. */
  private blast(at: Vector3, cause: PickTool | null): void {
    mark('bomber blast');
    this.triggers.bomberBlast(at, BOMBER.blastRadius, BOMBER.chainRadius, cause);
    const r2 = BOMBER.knightRadius * BOMBER.knightRadius;
    for (const t of this.troops.list) {
      if (t.mode === 'dead' || t.garrison) continue;
      const q = t.root.position;
      if ((q.x - at.x) ** 2 + (q.z - at.z) ** 2 < r2) this.troops.hurt(t, at.x, at.z);
    }
  }

  /** The fuse ran out at the wall: the big wall blast (the goblin is already gone). */
  private wallBlast(g: Goblin): void {
    temp2.copy(g.root.position);
    this.blast(temp2, null);
    this.threat.wallHit(g);
    this.damage(BOMBER.wallDamage);
  }

  // ---- Archers ----

  /** An archer stops at its post on the road while the garrison stands; once it is empty it walks in for good. */
  private archerPost(g: Goblin): void {
    if (g.mode !== 'walking' || g.advanced) return;
    const p = g.root.position;
    if (!g.standing && Math.hypot(p.x, p.z) <= g.postRadius) {
      g.standing = true;
      g.faceCenter();
      if (g.stunned <= 0 && g.paused <= 0) g.play('idle');
    }
    if (g.standing && this.garrison.soldiersOnWall(this.soldiers).length === 0) this.goblins.walkOn(g);
  }

  /** Every archer at its post looses an arrow at a garrison soldier, a little staggered. */
  private volley(dt: number): void {
    this.volleyTimer -= dt;
    if (this.volleyTimer > 0) return;
    this.volleyTimer = GOBLIN_ARCHERS.volleyEvery * this.rng.range(0.9, 1.1);
    const soldiers = this.garrison.soldiersOnWall(this.soldiers);
    if (soldiers.length === 0) return;
    let k = 0;
    for (const g of this.goblins.list) {
      if (g.type !== 'archer' || g.mode !== 'walking' || !g.standing) continue;
      if (g.stunned > 0 || g.paused > 0 || g.sneezeLeft > 0 || g.confused > 0) continue;
      const target = soldiers[this.rng.int(soldiers.length)];
      const p = g.root.position;
      const q = target.root.position;
      g.face(q.x - p.x, q.z - p.z);
      g.play('holding-left-shoot', false, 1.4, true);
      temp.set(p.x, p.y + g.stats.height * 0.6, p.z);
      temp2.set(q.x, q.y + TROOPS.height * 0.6, q.z);
      if (this.arrows.fire(temp, temp2, null, target)) {
        k++;
        this.audio.play('goblinBowShot', this.board.localToWorld(temp), 1, 0.1);
      }
    }
    if (k > 0) mark('goblin volley');
  }

  /** A goblin arrow lands: it may hurt the soldier it was shot at, if that soldier is still on the wall. */
  private arrowLands(a: Arrow): void {
    const t = a.payload as Troop | null;
    a.payload = null;
    this.board.localToWorld(temp.copy(a.to));
    if (!t || t.mode === 'dead' || !t.garrison || this.rng.next() >= GOBLIN_ARCHERS.hitChance) {
      this.particles.burst(temp, MISS_DUST, 2, 0.06);
      return;
    }
    this.troops.hurt(t, a.from.x, a.from.z);
  }
}
