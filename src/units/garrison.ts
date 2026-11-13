// The wall garrison (v2, docs/v2-plan.md 2.7): it defends the wall.
//
// - On the rampart: at most GARRISON.archers archers and GARRISON.guards
//   guards (swordsmen), one per stretch of wall between two towers, each with
//   its home stretch (GARRISON.homesDeg). When there are fewer, one new one
//   climbs up from the courtyard every GARRISON.refillEvery seconds
//   (src/rules/garrison.ts).
// - They walk along the rampart (one angle on a ring, no road pathfinding)
//   toward the nearest threat on their stretch.
// - Archers shoot outward at goblins walking in, all together as a volley
//   (random hits, ARCHERS.hitChance; arrows have no hitboxes). They back away
//   from goblins on the rampart and keep shooting; they never fight up close.
// - Guards fight goblins on the rampart up close.
// - Goblins on the rampart attack them: an archer goes down in 2 hits, a
//   guard's shield takes one more. Protecting the archers is the player's job.
// - The swatter, pepper and bell never hurt troops (they only look at goblins).
//
// It uses the soldiers, arrows and hits of src/units/troops.ts. Board cm.
import { Object3D, Vector3 } from 'three';
import type { GameAudio } from '../audio/sound.js';
import { ARCHERS, CASTLE, GARRISON, GOBLIN_GEAR, JUICE, TROOPS } from '../config/game.js';
import type { Particles } from '../fx/particles.js';
import { angleDelta, angleOf, degToRad, polarX, polarZ, towerGap } from '../rules/boardMath.js';
import { arcDistance, nextRecruit, refillTick, type RefillState } from '../rules/garrison.js';
import { strikeEvery } from '../rules/gear.js';
import type { Random } from '../rules/random.js';
import type { Goblin, Goblins } from './goblins.js';
import { FIGHTABLE, type Troop, type Troops } from './troops.js';

type Role = 'archer' | 'guard';

interface Member {
  troop: Troop;
  role: Role;
  /** The archer's goblin to shoot, and the countdown to its arrow of this volley (-1: none). */
  target: Goblin | null;
  fireIn: number;
}

const temp = new Vector3();
const temp2 = new Vector3();
const CLASH_SPARKS = [0xffffff, 0xffe9a8, 0xffd84a];
const DUST = [0xc9b79a, 0xa8957a, 0xe0d4bd];

export class Garrison {
  /** One slot per home stretch: guards first, then archers (GARRISON.homesDeg). */
  private slots: (Member | null)[] = GARRISON.homesDeg.map(() => null);
  /** Archers and guards come back on their own clocks (guards slower, GARRISON.guardRefillEvery). */
  private refill: RefillState = { timer: 0 };
  private guardRefill: RefillState = { timer: 0 };
  private active = false;
  private volleyTimer = 0;

  constructor(
    private board: Object3D,
    private troops: Troops,
    private goblins: Goblins,
    private audio: GameAudio,
    private particles: Particles,
    private rng: Random,
  ) {}

  /** Soldiers on the rampart now (and climbing up). */
  get count(): number {
    let n = 0;
    for (const m of this.slots) if (m) n++;
    return n;
  }

  /** Guards and archers on the rampart, and their refill times: GARRISON, or a level's rules (setRules). */
  private guards = GARRISON.guards;
  private archers = GARRISON.archers;
  private refillEvery = GARRISON.refillEvery;
  private guardRefillEvery = GARRISON.guardRefillEvery;

  /**
   * A level's garrison (docs/custom-mode.md section 2, rules), or null for
   * GARRISON's. Set before a battle starts (fill() mans the walls with it).
   * There are only GARRISON.homesDeg stretches: guards take theirs first.
   */
  setRules(rules: { archers: number; guards: number; refillEvery: number; guardRefillEvery: number } | null): void {
    const slots = GARRISON.homesDeg.length;
    this.guards = Math.max(0, Math.min(slots, Math.round(rules?.guards ?? GARRISON.guards)));
    this.archers = Math.max(0, Math.min(slots - this.guards, Math.round(rules?.archers ?? GARRISON.archers)));
    this.refillEvery = rules?.refillEvery ?? GARRISON.refillEvery;
    this.guardRefillEvery = rules?.guardRefillEvery ?? GARRISON.guardRefillEvery;
  }

  /** The role of a stretch: guards first, then archers, then none (left empty). */
  private roleOf(slot: number): Role | null {
    if (slot < this.guards) return 'guard';
    return slot < this.guards + this.archers ? 'archer' : null;
  }

  /** A battle starts: every stretch is manned at once, and the refill runs. */
  fill(): void {
    this.active = true;
    this.refill.timer = 0;
    this.guardRefill.timer = 0;
    this.volleyTimer = GARRISON.volleyEvery;
    for (let i = 0; i < this.slots.length; i++) if (!this.slots[i] && this.roleOf(i)) this.recruit(i, false);
  }

  /** Every soldier was cleared away (Troops.clear): no refill until fill(). */
  stop(): void {
    this.active = false;
    this.slots.fill(null);
  }

  /**
   * The board angle of the soldier on the wall nearest this goblin, or null
   * when none is up there (v2: goblins on the rampart jump in only then; until
   * then they hunt the soldiers). Ones still climbing up do not count yet.
   */
  nearestSoldierAngle(g: Goblin): number | null {
    if (!this.active) return null;
    const a = angleOf(g.root.position.x, g.root.position.z);
    let best: number | null = null;
    let bestArc = Infinity;
    for (const m of this.slots) {
      if (!m || m.troop.mode === 'climbingUp' || m.troop.mode === 'dead') continue;
      const arc = arcDistance(a, m.troop.angle, GARRISON.radius);
      if (arc < bestArc) {
        bestArc = arc;
        best = m.troop.angle;
      }
    }
    return best;
  }

  /** Debug: `n` soldiers on the rampart go down (archers first), to watch the refill climb up. */
  thin(n: number): void {
    for (let i = this.slots.length - 1; i >= 0 && n > 0; i--) {
      const m = this.slots[i];
      if (!m || m.troop.mode === 'climbingUp') continue;
      this.troops.remove(m.troop, true);
      this.slots[i] = null;
      n--;
    }
  }

  /** A new soldier for a slot: standing on the rampart, or climbing up from the courtyard. */
  private recruit(slot: number, climb: boolean): void {
    const role = this.roleOf(slot);
    if (!role) return;
    const troop = this.troops.take(role === 'archer' ? 'archer' : 'sword');
    if (!troop) return;
    this.troops.prepare(troop);
    troop.garrison = true;
    troop.home = degToRad(GARRISON.homesDeg[slot]);
    troop.angle = troop.home;
    this.slots[slot] = { troop, role, target: null, fireIn: -1 };
    if (climb) {
      // At the foot of the wall's inner side, facing the wall.
      const r = CASTLE.wallIn - 0.8;
      troop.root.position.set(polarX(r, troop.home), 0, polarZ(r, troop.home));
      troop.face(polarX(1, troop.home), polarZ(1, troop.home));
      troop.mode = 'climbingUp';
      troop.timer = GARRISON.climbTime;
      troop.play('interact-right', true, 1.4);
      this.particles.burst(this.board.localToWorld(temp.copy(troop.root.position)), TROOPS.poofColors, 3, 0.08);
    } else this.stand(troop);
  }

  /** On the rampart at its angle, on guard, facing out. */
  private stand(t: Troop): void {
    this.place(t, t.angle);
    t.face(polarX(1, t.angle), polarZ(1, t.angle));
    t.mode = 'guarding';
    t.play('idle');
  }

  private place(t: Troop, angle: number): void {
    t.angle = angle;
    t.root.position.set(polarX(GARRISON.radius, angle), CASTLE.wallHeight, polarZ(GARRISON.radius, angle));
  }

  update(dt: number): void {
    if (!this.active) return;
    // Soldiers who went down leave their stretch empty.
    let archers = 0;
    let guards = 0;
    for (let i = 0; i < this.slots.length; i++) {
      const m = this.slots[i];
      if (m && (m.troop.mode === 'dead' || !m.troop.garrison)) this.slots[i] = null;
      else if (m) m.role === 'archer' ? archers++ : guards++;
    }
    // One new archer climbs up every so often until they are full again; a fallen guard takes longer to
    // come back (GARRISON.guardRefillEvery), so helping the guards matters.
    if (this.troops.enabled) {
      if (refillTick(this.refill, archers, this.archers, dt, this.refillEvery)) this.recruitRole('archer');
      if (refillTick(this.guardRefill, guards, this.guards, dt, this.guardRefillEvery)) this.recruitRole('guard');
    }
    // The volley: every archer with a target looses an arrow, a little staggered.
    this.volleyTimer -= dt;
    let volley = false;
    if (this.volleyTimer <= 0) {
      this.volleyTimer = GARRISON.volleyEvery * this.rng.range(0.9, 1.1);
      volley = true;
    }
    let k = 0;
    for (const m of this.slots) {
      if (!m) continue;
      const t = m.troop;
      if (t.mode === 'climbingUp') {
        this.climb(t, dt);
        continue;
      }
      if (t.mode === 'cheering') continue;
      if (m.role === 'archer') {
        this.archer(m, dt);
        if (volley && m.target) m.fireIn = k++ * GARRISON.volleyStagger;
        if (m.fireIn >= 0) {
          m.fireIn -= dt;
          if (m.fireIn < 0) this.shoot(m);
        }
      } else this.guard(m, dt);
    }
    this.goblinsAttack(dt);
  }

  /** A new soldier of this role climbs up into a free slot of it. */
  private recruitRole(role: Role): void {
    const slot = this.slots.findIndex((m, i) => !m && this.roleOf(i) === role);
    if (slot >= 0) this.recruit(slot, true);
  }

  /** Climbing up the inner side of the wall, then on guard on the rampart. */
  private climb(t: Troop, dt: number): void {
    t.timer -= dt;
    t.root.position.y = CASTLE.wallHeight * Math.min(1, 1 - t.timer / GARRISON.climbTime);
    if (t.timer > 0) return;
    this.stand(t);
    this.particles.burst(this.board.localToWorld(temp.copy(t.root.position)), DUST, 3, 0.06);
  }

  /**
   * Walks along the rampart toward an angle. Archers never past the towers of
   * their own stretch; guards (`free`) anywhere round the wall, the short way.
   * Returns true when there.
   */
  private walkTo(t: Troop, target: number, dt: number, free = false): boolean {
    const [lo, hi] = towerGap(t.home);
    // The home stretch around the home angle, on the same turn of the circle (a guard: the target itself).
    const goal = free ? t.angle + angleDelta(t.angle, target) : t.home + Math.min(hi - t.home, Math.max(lo - t.home, angleDelta(t.home, target)));
    const d = angleDelta(t.angle, goal);
    // Guards hurry round the wall to a fight; archers step about their stretch.
    const step = ((free ? GARRISON.guardSpeed : GARRISON.walkSpeed) / GARRISON.radius) * dt;
    if (Math.abs(d) <= step) {
      if (Math.abs(d) > 1e-4) this.place(t, goal);
      return true;
    }
    const next = t.angle + Math.sign(d) * step;
    this.place(t, next);
    // Facing along the wall, the way it walks (the ring's tangent, like the goblins on the rampart).
    const s = Math.sign(d);
    t.face(Math.cos(next) * s, Math.sin(next) * s);
    t.play('walk', true, 1.2);
    return false;
  }

  /**
   * The nearest goblin on the rampart: on this soldier's stretch, or (a
   * guard, `anywhere`) round the whole wall. Lesson goblins are left alone.
   */
  private rampartFoe(t: Troop, anywhere = false): { goblin: Goblin; angle: number; arc: number } | null {
    const [lo, hi] = towerGap(t.home);
    let best: Goblin | null = null;
    let bestAngle = 0;
    let bestArc = Infinity;
    for (const g of this.goblins.list) {
      if (g.mode !== 'rampart' || this.goblins.isLesson(g)) continue;
      const a = angleOf(g.root.position.x, g.root.position.z);
      const fromHome = angleDelta(t.home, a);
      if (!anywhere && (fromHome < lo - t.home - 0.05 || fromHome > hi - t.home + 0.05)) continue;
      const arc = arcDistance(t.angle, a, GARRISON.radius);
      if (arc < bestArc) {
        bestArc = arc;
        best = g;
        bestAngle = a;
      }
    }
    return best ? { goblin: best, angle: bestAngle, arc: bestArc } : null;
  }

  /** An archer: backs away from a goblin on the rampart, picks the nearest goblin walking in within range, faces it. */
  private archer(m: Member, dt: number): void {
    const t = m.troop;
    const p = t.root.position;
    // The nearest goblin walking in (outside the wall, on its feet) within range.
    let target: Goblin | null = null;
    let bestD = GARRISON.archerRange * GARRISON.archerRange;
    for (const g of this.goblins.list) {
      if (!FIGHTABLE.has(g.mode) || this.goblins.isLesson(g)) continue;
      const q = g.root.position;
      if (q.x * q.x + q.z * q.z < CASTLE.wallOut * CASTLE.wallOut) continue;
      const dx = q.x - p.x;
      const dz = q.z - p.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        target = g;
      }
    }
    m.target = target;
    const foe = this.rampartFoe(t);
    if (foe && foe.arc < GARRISON.backAway) {
      // Back away from it along the wall, and keep shooting.
      const away = t.angle - Math.sign(angleDelta(t.angle, foe.angle) || 1) * 0.4;
      this.walkTo(t, away, dt);
      return;
    }
    if (target) {
      const q = target.root.position;
      t.face(q.x - p.x, q.z - p.z);
      if (t.mode !== 'guarding') t.mode = 'guarding';
      return;
    }
    // Nothing to shoot: back to its home spot, facing out.
    if (this.walkTo(t, t.home, dt)) {
      t.face(polarX(1, t.angle), polarZ(1, t.angle));
      t.play('idle');
    }
  }

  /** One arrow of the volley at the archer's target, leading a walking goblin a little. */
  private shoot(m: Member): void {
    const g = m.target;
    if (!g || !FIGHTABLE.has(g.mode)) return;
    const t = m.troop;
    const p = t.root.position;
    const q = g.root.position;
    t.face(q.x - p.x, q.z - p.z);
    t.play('holding-left-shoot', false, 1.4);
    temp.set(p.x, p.y + TROOPS.height * 0.6, p.z);
    temp2.set(q.x, q.y + g.stats.height * 0.5, q.z);
    if (g.mode === 'walking' || g.mode === 'toWall') {
      const s = g.speed * ARCHERS.flightTime;
      temp2.x += Math.sin(g.root.rotation.y) * s;
      temp2.z += Math.cos(g.root.rotation.y) * s;
    }
    if (this.troops.arrows.fire(temp, temp2, g)) this.audio.play('slingRelease', this.board.localToWorld(temp), 0.35, 0.12);
  }

  /**
   * A guard: hunts the nearest goblin anywhere on the rampart (headset test:
   * guards kept to their own stretch), walks to it along the wall and fights
   * it up close until it is out, then goes back home.
   */
  private guard(m: Member, dt: number): void {
    const t = m.troop;
    const foe = this.rampartFoe(t, true);
    if (!foe) {
      t.foe = null;
      if (this.walkTo(t, t.home, dt, true)) {
        t.mode = 'guarding';
        t.face(polarX(1, t.angle), polarZ(1, t.angle));
        t.play('idle');
      }
      return;
    }
    if (foe.arc > GARRISON.guardReach) {
      this.walkTo(t, foe.angle, dt, true);
      return;
    }
    // Up close: strike at it.
    const g = foe.goblin;
    const p = t.root.position;
    const q = g.root.position;
    t.face(q.x - p.x, q.z - p.z);
    if (t.foe !== g) {
      t.foe = g;
      t.strikeTimer = this.rng.range(0.2, 0.6);
      t.play('idle');
    }
    t.strikeTimer -= dt;
    if (t.strikeTimer > 0) return;
    t.strikeTimer = TROOPS.strikeEvery * this.rng.range(0.85, 1.15);
    t.attackRight = !t.attackRight;
    t.play(t.attackRight ? 'attack-melee-right' : 'attack-melee-left', false);
    this.clash(p);
    if (this.rng.next() >= TROOPS.strikeChance) return;
    // A helmet or shield takes the blow first (src/rules/gear.ts).
    if (this.goblins.armor(g, p.x, p.z)) return;
    this.goblins.worldPosition(g, temp);
    this.particles.burst(temp, TROOPS.poofColors, 8);
    this.audio.play('poof', temp, 0.8, 0.05);
    this.goblins.kill(g, true);
    this.troops.onKill(g);
    t.foe = null;
    this.troops.cheer(t, JUICE.troopCheerTime);
  }

  /**
   * Goblins on the rampart attack the garrison: one next to a soldier stops
   * running about and strikes at it (a sword strikes faster). Not while
   * stunned or sneezing, and never a lesson goblin.
   */
  private goblinsAttack(dt: number): void {
    for (const g of this.goblins.list) {
      if (g.mode !== 'rampart' || g.stunned > 0 || g.sneezeLeft > 0 || this.goblins.isLesson(g)) continue;
      const a = angleOf(g.root.position.x, g.root.position.z);
      let foe: Troop | null = null;
      let bestArc = GARRISON.goblinReach;
      for (const m of this.slots) {
        if (!m || m.troop.mode === 'climbingUp' || m.troop.mode === 'dead') continue;
        const arc = arcDistance(a, m.troop.angle, GARRISON.radius);
        if (arc < bestArc) {
          bestArc = arc;
          foe = m.troop;
        }
      }
      if (!foe) continue;
      // It stands and fights instead of dashing about (its rampart time still runs).
      g.dashPause = Math.max(g.dashPause, 0.25);
      g.hasTarget = false;
      const p = foe.root.position;
      const q = g.root.position;
      g.face(p.x - q.x, p.z - q.z);
      g.strikeTimer -= dt;
      if (g.strikeTimer > 0) continue;
      g.strikeTimer = strikeEvery(TROOPS.goblinStrikeEvery, g.weapon, GOBLIN_GEAR.swordStrikeScale) * this.rng.range(0.85, 1.15);
      this.goblins.strike(g);
      this.clash(q);
      if (this.rng.next() < TROOPS.goblinStrikeChance) this.troops.hurt(foe, q.x, q.z);
    }
  }

  private clash(at: Vector3): void {
    this.audio.play('swordClash', this.board.localToWorld(temp.copy(at)), 1, TROOPS.clashGap);
    temp.y += 0.004;
    this.particles.burst(temp, CLASH_SPARKS, 2, 0.12);
  }
}
