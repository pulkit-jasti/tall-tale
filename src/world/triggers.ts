// Triggers on the roads (docs/map.md section 5): the powder keg, the boulder
// and the leaning tree. Shot with the slingshot: each one registers as a
// SlingTarget, so the aim assist bends toward it and it glows and wobbles
// while aimed at. Each happens once and resets at the start of each wave.
// They only kill, block or redirect goblins on the roads, never stun.
//
//   Powder keg: explodes, knocking out the goblins around it.
//   Boulder:    rolls off its hill onto the road and down it toward the
//               castle, squashing everything in its line.
//   Tree:       falls across the road, squashes the goblins under it, and
//               closes the road for a few seconds (goblins on it turn back).
//
// One rule for chain reactions: explosions set off the triggers near them.
// All motion is simple math, no physics engine. Board units (cm), in boardSpin.
import { Color, Group, Mesh, MeshStandardMaterial, Object3D, Quaternion, Vector3 } from 'three';
import type { GameAudio } from '../audio/sound.js';
import { mark } from '../debug/perfMarks.js';
import { GOBLIN_RULES, TRIGGERS } from '../config/game.js';
import type { Particles } from '../fx/particles.js';
import { applyAimGlow, applyTouchState } from '../player/feedback.js';
import type { BlueprintTrigger, TriggerKind } from '../rules/blueprint.js';
import { boardHeight, degToRad, landingHeight, polarX, polarZ } from '../rules/boardMath.js';
import type { Random } from '../rules/random.js';
import type { SlingTarget } from '../tools/slingshot.js';
import type { Goblins } from '../units/goblins.js';
import { cloneStatic, loadTemplate, type ModelTemplate } from './models.js';
import type { Road, RoadNetwork } from './roads.js';

type Phase = 'hidden' | 'standing' | 'acting' | 'done';

const UP = new Vector3(0, 1, 0);
const temp = new Vector3();
const temp2 = new Vector3();
const world = new Vector3();
const quaternion = new Quaternion();
const POOF_COLORS = [0xffffff, 0xddd6c8, 0xb8b0a0];

/** Own copies of a model's materials, so one trigger can glow alone. Returns them. */
function ownMaterials(object: Object3D, tint?: [number, number, number]): MeshStandardMaterial[] {
  const materials: MeshStandardMaterial[] = [];
  object.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const material = (mesh.material as MeshStandardMaterial).clone();
    if (tint) material.color.multiply(new Color(...tint));
    mesh.material = material;
    materials.push(material);
  });
  return materials;
}

interface Debris {
  object: Object3D;
  alive: boolean;
  age: number;
  readonly velocity: Vector3;
  spin: number;
  bounced: boolean;
}

/** The things every trigger shares: its spot on a road, aiming, the reset between waves. */
abstract class Trigger implements SlingTarget {
  readonly root = new Group();
  protected phase: Phase = 'hidden';
  protected time = 0;
  protected materials: MeshStandardMaterial[] = [];
  private aimed = false;
  /** Shown once already (the first time it pops in with a poof). */
  private seen = false;
  abstract readonly radius: number;
  readonly assist = TRIGGERS.assist;

  constructor(
    readonly kind: TriggerKind,
    /** Tutorial wave (1 based) from which it stands on the board. */
    readonly wave: number,
    protected owner: Triggers,
    /** The road it belongs to, and the spot along it (cm). */
    protected roadIndex: number,
    protected along: number,
  ) {
    this.root.visible = false;
  }

  protected get road(): Road {
    return this.owner.network.roads[this.roadIndex];
  }

  abstract center(out: Vector3): Vector3;

  hittable(): boolean {
    return this.phase === 'standing';
  }

  onHit(): void {
    if (this.phase === 'standing') this.setOff();
  }

  setAimed(aimed: boolean): void {
    if (aimed === this.aimed) return;
    this.aimed = aimed;
    if (aimed) applyAimGlow(this.materials);
    else applyTouchState(this.materials, 'idle');
  }

  /** Sets it off: a shot, or a blast nearby. */
  setOff(): void {
    if (this.phase !== 'standing') return;
    mark('trigger');
    this.setAimed(false);
    this.phase = 'acting';
    this.time = 0;
    this.act();
  }

  /** A new wave: back in place, ready to be shot (or hidden before its wave). */
  reset(wave: number): void {
    this.cleanUp();
    if (wave < this.wave) {
      this.phase = 'hidden';
      this.root.visible = false;
      return;
    }
    this.phase = 'standing';
    this.time = 0;
    this.place();
    this.root.visible = true;
    if (!this.seen) {
      this.seen = true;
      this.center(temp);
      this.owner.poof(temp, 10);
    }
  }

  hide(): void {
    this.cleanUp();
    this.phase = 'hidden';
    this.root.visible = false;
    this.setAimed(false);
    this.seen = false;
  }

  update(dt: number): void {
    if (this.phase === 'hidden') return;
    this.time += dt;
    if (this.phase === 'standing') this.stand();
    else if (this.phase === 'acting') this.during(dt);
  }

  /** Standing: a little wobble while the slingshot aims at it. */
  protected stand(): void {
    this.place();
    if (!this.aimed) return;
    const wobble = Math.sin(this.time * TRIGGERS.aimWobbleSpeed) * degToRad(TRIGGERS.aimWobbleDeg);
    this.root.quaternion.premultiply(quaternion.setFromAxisAngle(temp.set(1, 0, 0), wobble));
  }

  /** Puts it at its resting pose. */
  protected abstract place(): void;
  /** Starts what it does when set off. */
  protected abstract act(): void;
  /** Every frame while it acts. Sets the phase to 'done' when finished. */
  protected abstract during(dt: number): void;
  /** Undoes anything that lasts (a closed road). */
  protected cleanUp(): void {}
}

class Keg extends Trigger {
  readonly radius = TRIGGERS.keg.hitRadius;
  private readonly spot = new Vector3();

  constructor(owner: Triggers, wave: number, road: number, along: number, template: ModelTemplate) {
    super('keg', wave, owner, road, along);
    const model = cloneStatic(template);
    this.materials = ownMaterials(model, TRIGGERS.keg.tint);
    this.root.add(model);
    this.road.pointAt(along, TRIGGERS.keg.side, this.spot);
  }

  center(out: Vector3): Vector3 {
    return out.copy(this.spot).setY(this.spot.y + TRIGGERS.keg.height / 2);
  }

  protected place(): void {
    this.root.position.copy(this.spot);
    this.root.quaternion.identity();
    this.root.scale.setScalar(1);
  }

  protected act(): void {
    this.root.visible = false;
    this.center(temp2);
    this.owner.explode(temp2, TRIGGERS.keg.blastRadius, TRIGGERS.keg.chainRadius, this);
    this.owner.debris(temp2, TRIGGERS.keg.debris);
    this.phase = 'done';
  }

  protected during(): void {}
}

class Boulder extends Trigger {
  readonly radius = TRIGGERS.boulder.hitRadius;
  private readonly rock: Group;
  private readonly hill: Group;
  /** Resting spot on its hill, and the spot on the road it rolls onto. */
  private readonly rest = new Vector3();
  private readonly onRoad = new Vector3();
  /** Rolls toward the castle: the direction along the road, and where it stops. */
  private readonly dir: 1 | -1;
  private readonly stopAt: number;
  private distance = 0;
  private spin = 0;

  constructor(owner: Triggers, wave: number, road: number, along: number, rock: ModelTemplate, hill: ModelTemplate) {
    super('boulder', wave, owner, road, along);
    const { side, size, stopShort } = TRIGGERS.boulder;
    this.hill = cloneStatic(hill);
    this.road.pointAt(along, side, temp);
    this.hill.position.copy(temp);
    this.hill.position.y -= 0.6;
    // The hill stays put; only the rock is aimed at and moves.
    owner.group.add(this.hill);
    this.hill.visible = false;
    this.rock = cloneStatic(rock);
    this.materials = ownMaterials(this.rock);
    // The rock's origin is its bottom: lift it so it turns around its middle.
    this.rock.position.y = -size / 2;
    const pivot = new Group();
    pivot.add(this.rock);
    this.root.add(pivot);
    this.rest.copy(temp).setY(temp.y + hill.size.y - 1 + size / 2);
    const r0 = Math.hypot(...this.xz(0));
    const r1 = Math.hypot(...this.xz(this.road.length));
    this.dir = r1 < r0 ? 1 : -1;
    this.stopAt = this.dir === 1 ? this.road.length - stopShort : stopShort;
    this.road.pointAt(along, 0, this.onRoad);
    this.onRoad.y += size / 2;
  }

  private xz(distance: number): [number, number] {
    this.road.pointAt(distance, 0, temp2);
    return [temp2.x, temp2.z];
  }

  center(out: Vector3): Vector3 {
    return out.copy(this.root.position);
  }

  override reset(wave: number): void {
    super.reset(wave);
    this.hill.visible = this.phase !== 'hidden';
  }

  override hide(): void {
    super.hide();
    this.hill.visible = false;
  }

  protected place(): void {
    this.root.position.copy(this.rest);
    this.root.quaternion.identity();
    this.root.visible = true;
  }

  protected act(): void {
    this.distance = this.along;
    this.spin = 0;
    this.owner.sound('boulderRoll', this.root.position);
  }

  protected during(dt: number): void {
    const { speed, size, crushRadius } = TRIGGERS.boulder;
    const p = this.root.position;
    const toRoad = 0.3;
    if (this.time < toRoad) {
      // Off the hill and onto the road.
      p.lerpVectors(this.rest, this.onRoad, this.time / toRoad);
    } else {
      this.distance += speed * dt * this.dir;
      this.road.pointAt(this.distance, 0, p);
      p.y += size / 2;
    }
    // Spins as it rolls: around the axis across its path.
    this.road.directionAt(this.distance, temp);
    temp.multiplyScalar(this.dir).cross(UP).normalize();
    this.spin += (speed * dt) / (size / 2);
    this.root.quaternion.setFromAxisAngle(temp, -this.spin);
    this.owner.crush(p, crushRadius);
    if (this.dir === 1 ? this.distance >= this.stopAt : this.distance <= this.stopAt) {
      // It crumbles at the end of its road.
      this.root.visible = false;
      this.owner.debris(p, TRIGGERS.boulder.debris);
      this.owner.dust(p, TRIGGERS.boulder.dustColors);
      this.owner.sound('debris', p);
      this.phase = 'done';
    }
  }
}

class Tree extends Trigger {
  readonly radius = TRIGGERS.tree.hitRadius;
  private readonly base = new Vector3();
  /** Sideways from the road (toward where the trunk stands), and the axis it falls around. */
  private readonly side = new Vector3();
  private readonly axis = new Vector3();
  private blockLeft = 0;
  private fallen = false;

  constructor(owner: Triggers, wave: number, road: number, along: number, template: ModelTemplate) {
    super('tree', wave, owner, road, along);
    const model = cloneStatic(template);
    this.materials = ownMaterials(model);
    this.root.add(model);
    const { side } = TRIGGERS.tree;
    this.road.pointAt(along, 0, temp);
    this.road.pointAt(along, side, this.base);
    this.side.subVectors(this.base, temp).setY(0).normalize();
    // Turning around this axis moves the top from straight up toward the road (away from `side`).
    this.axis.crossVectors(this.side, UP).normalize();
  }

  center(out: Vector3): Vector3 {
    // About the middle of the trunk, where it leans over the road.
    out.set(0, TRIGGERS.tree.height * 0.55, 0).applyQuaternion(this.root.quaternion);
    return out.add(this.root.position);
  }

  private lean(deg: number): void {
    this.root.position.copy(this.base);
    this.root.quaternion.setFromAxisAngle(this.axis, degToRad(deg));
  }

  protected place(): void {
    this.lean(TRIGGERS.tree.leanDeg);
    this.root.scale.setScalar(1);
  }

  protected act(): void {
    this.fallen = false;
    this.owner.sound('treeCreak', this.base);
  }

  protected during(dt: number): void {
    const { fallTime, leanDeg, height, crushWidth, blockSeconds } = TRIGGERS.tree;
    if (!this.fallen) {
      // Falls faster and faster, like a real tree.
      const t = Math.min(1, this.time / fallTime);
      this.lean(leanDeg + (90 - leanDeg) * t * t);
      if (t < 1) return;
      this.fallen = true;
      this.blockLeft = blockSeconds;
      // Squashes the goblins under the trunk, across the road.
      for (let i = 0; i <= 4; i++) {
        temp.copy(this.base).addScaledVector(this.side, (-height * 0.9 * i) / 4);
        this.owner.crush(temp, crushWidth);
      }
      temp.copy(this.base).addScaledVector(this.side, -TRIGGERS.tree.side);
      this.owner.sound('treeCrash', temp);
      this.owner.dust(temp, TRIGGERS.tree.leafColors);
      this.owner.closeRoad(this.roadIndex, true);
      return;
    }
    // The road is blocked for a while, then the tree poofs away and it opens.
    this.blockLeft -= dt;
    if (this.blockLeft > 0) return;
    temp.copy(this.base).addScaledVector(this.side, -TRIGGERS.tree.side);
    this.owner.debris(temp, TRIGGERS.tree.debris);
    this.owner.poof(temp, 8);
    this.root.visible = false;
    this.cleanUp();
    this.phase = 'done';
  }

  protected cleanUp(): void {
    if (this.fallen) this.owner.closeRoad(this.roadIndex, false);
    this.fallen = false;
  }
}

/** Every trigger on the map, the blasts between them, and the flying debris. */
export class Triggers {
  readonly group = new Group();
  private list: Trigger[] = [];
  private debrisPool: Debris[] = [];
  private nextDebris = 0;

  constructor(
    private board: Object3D,
    readonly network: RoadNetwork,
    private goblins: Goblins,
    private audio: GameAudio,
    private particles: Particles,
    private rng: Random,
  ) {
    board.add(this.group);
  }

  /** The triggers of the blueprint, each on the road nearest its spot. */
  async load(spots: BlueprintTrigger[]): Promise<void> {
    const [keg, rock, tree, planks, wood, ...hills] = await Promise.all([
      loadTemplate('props/survival/barrel.glb', { height: TRIGGERS.keg.height }),
      loadTemplate('rocks/nature/rock_smallH.glb', { width: TRIGGERS.boulder.size }),
      loadTemplate('trees/fantasy-town/tree-crooked.glb', { height: TRIGGERS.tree.height }),
      loadTemplate('props/survival/resource-planks.glb', { width: TRIGGERS.debris.size }),
      loadTemplate('props/survival/resource-wood.glb', { width: TRIGGERS.debris.size }),
      ...['A', 'B', 'C', 'D'].map((v) => loadTemplate(`rocks/nature/rock_large${v}.glb`, { width: TRIGGERS.boulder.hillWidth })),
    ]);
    for (const spot of spots) {
      const a = degToRad(spot.at[1]);
      const x = polarX(spot.at[0], a);
      const z = polarZ(spot.at[0], a);
      let roadIndex = 0;
      let best = Infinity;
      this.network.roads.forEach((road, i) => {
        const d = road.distanceTo(x, z);
        if (d < best) {
          best = d;
          roadIndex = i;
        }
      });
      const along = this.network.roads[roadIndex].nearestAlong(x, z);
      let trigger: Trigger;
      if (spot.kind === 'keg') trigger = new Keg(this, spot.wave, roadIndex, along, keg);
      else if (spot.kind === 'boulder') trigger = new Boulder(this, spot.wave, roadIndex, along, rock, this.rng.pick(hills));
      else trigger = new Tree(this, spot.wave, roadIndex, along, tree);
      this.group.add(trigger.root);
      this.list.push(trigger);
    }
    for (let i = 0; i < TRIGGERS.debris.pool; i++) {
      const object = cloneStatic(i % 2 === 0 ? planks : wood);
      object.visible = false;
      this.group.add(object);
      this.debrisPool.push({ object, alive: false, age: 0, velocity: new Vector3(), spin: 0, bounced: false });
    }
  }

  /** The things the slingshot can shoot (register each with slingshot.addTarget). */
  get targets(): SlingTarget[] {
    return this.list;
  }

  /** A new wave (1 based): every trigger of this wave or an earlier one stands ready again. */
  setWave(wave: number): void {
    for (const t of this.list) t.reset(wave);
  }

  /** Before the battle, or at its end: every trigger gone, every road open. */
  hideAll(): void {
    for (const t of this.list) t.hide();
  }

  /** Debug: sets off every trigger standing now. */
  fireAll(): void {
    for (const t of this.list) t.setOff();
  }

  get standingCount(): number {
    return this.list.filter((t) => t.hittable()).length;
  }

  update(dt: number): void {
    for (const t of this.list) t.update(dt);
    this.updateDebris(dt);
  }

  // ---- Shared effects (called by the triggers) ----

  /** A blast: goblins in `radius` are knocked out, triggers in `chainRadius` are set off. */
  explode(at: Vector3, radius: number, chainRadius: number, from: Trigger): void {
    this.board.localToWorld(world.copy(at));
    this.particles.burst(world, TRIGGERS.keg.fireColors, 26, 0.5);
    this.audio.play('kegBoom', world);
    this.audio.play('debris', world, 0.8);
    this.crush(at, radius);
    for (const t of this.list) {
      if (t === from || !t.hittable()) continue;
      t.center(temp2);
      if (temp2.distanceTo(at) < chainRadius) t.setOff();
    }
  }

  /** Every goblin on its feet within `radius` (flat, cm) of a board point is knocked out with a poof. */
  crush(at: Vector3, radius: number): void {
    const r2 = radius * radius;
    for (const g of this.goblins.list) {
      if (!this.goblins.isHittable(g) || g.mode === 'climbing' || g.mode === 'rampart' || g.mode === 'intruder') continue;
      const p = g.root.position;
      const dx = p.x - at.x;
      const dz = p.z - at.z;
      if (dx * dx + dz * dz > r2 || Math.abs(p.y - at.y) > radius + 4) continue;
      this.goblins.worldPosition(g, world);
      this.particles.burst(world, POOF_COLORS, 6, 0.15);
      this.audio.play('poof', world, 0.8, 0.04);
      this.goblins.kill(g);
    }
  }

  /** Opens or closes a road. Goblins on a closed road turn back to the point they came from. */
  closeRoad(road: number, closed: boolean): void {
    this.network.graph.setOpen(road, !closed);
    if (closed) this.goblins.turnBack(road);
  }

  poof(at: Vector3, count: number): void {
    this.particles.burst(this.board.localToWorld(world.copy(at)), POOF_COLORS, count, 0.18);
  }

  dust(at: Vector3, colors: number[]): void {
    this.particles.burst(this.board.localToWorld(world.copy(at)), colors, 12, 0.25);
  }

  sound(name: 'boulderRoll' | 'treeCreak' | 'treeCrash' | 'debris', at: Vector3): void {
    this.audio.play(name, this.board.localToWorld(world.copy(at)));
  }

  /** Planks and wood fly out of a board point (pooled; the oldest piece is reused when all are out). */
  debris(at: Vector3, count: number): void {
    const { speed, hop } = TRIGGERS.debris;
    for (let n = 0; n < count; n++) {
      const d = this.debrisPool[this.nextDebris];
      this.nextDebris = (this.nextDebris + 1) % this.debrisPool.length;
      d.alive = true;
      d.age = 0;
      d.bounced = false;
      d.spin = this.rng.range(-12, 12);
      d.object.visible = true;
      d.object.position.copy(at);
      d.object.scale.setScalar(1);
      const a = this.rng.range(0, Math.PI * 2);
      const s = speed * this.rng.range(0.4, 1);
      d.velocity.set(Math.cos(a) * s, hop * this.rng.range(0.6, 1.2), Math.sin(a) * s);
    }
  }

  private updateDebris(dt: number): void {
    const { life } = TRIGGERS.debris;
    for (const d of this.debrisPool) {
      if (!d.alive) continue;
      d.age += dt;
      if (d.age >= life) {
        d.alive = false;
        d.object.visible = false;
        continue;
      }
      const p = d.object.position;
      d.velocity.y -= GOBLIN_RULES.gravity * dt;
      p.addScaledVector(d.velocity, dt);
      d.object.rotation.x += d.spin * dt;
      d.object.rotation.z += d.spin * 0.7 * dt;
      const ground = landingHeight(p.x, p.z) ?? boardHeight(Math.hypot(p.x, p.z));
      if (p.y < ground) {
        p.y = ground;
        // One bounce, then it slides to a stop.
        d.velocity.y = d.bounced ? 0 : -d.velocity.y * 0.35;
        d.velocity.x *= 0.5;
        d.velocity.z *= 0.5;
        d.bounced = true;
      }
      // Shrinks away over the last third of its life.
      const left = 1 - d.age / life;
      d.object.scale.setScalar(Math.min(1, left * 3));
    }
  }
}
