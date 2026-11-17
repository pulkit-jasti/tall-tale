// The sun garden (docs/v3-plan.md 2.2, the magnifying glass): seed beds
// beside the roads, placed when a map is built (from the roads and the map's
// own seeded stream, like the trap spare spots, so every map gets them with
// no regenerating). Each bed holds one kind, shown by a small model on it so
// the player knows what grows there:
//
//   - Sunflower: a turret that spits seeds at the nearest goblin in range;
//     GARDEN.seedsToKnock seeds knock out a bare grunt (a seed on armor breaks
//     a piece, like a pebble). Never shoots balloons or anything underground.
//   - Mushroom: every so often it puffs, and about half of the nearest group
//     turns on each other for a few seconds (tinted purple, swinging); a
//     third of the group is knocked out, never more, so the player finishes it.
//
// The magnifying glass shines on a bed about GARDEN.growTime to grow its
// plant (a sprout shows the progress), and on a plant to heal it. A plant
// wilts over GARDEN.life (it droops and fades, no bar), then the bed is
// empty again. Goblins never attack plants. Plants last between waves.
import { Color, CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, Vector3, type Object3D } from 'three';
import type { GameAudio } from '../audio/sound.js';
import { GARDEN } from '../config/game.js';
import type { Particles } from '../fx/particles.js';
import { applyTouchState, type TouchState } from '../player/feedback.js';
import { groundAt } from '../rules/boardMath.js';
import type { Random } from '../rules/random.js';
import type { Goblin, Goblins } from '../units/goblins.js';
import { cloneStatic, loadTemplate, type ModelTemplate } from './models.js';
import type { RoadNetwork } from './roads.js';
import { flatMaterial } from './shapes.js';

export type PlantKind = 'sunflower' | 'mushroom';

export interface Bed {
  kind: PlantKind;
  /** The bed's middle on the ground (board cm). */
  position: Vector3;
  group: Group;
  dirt: MeshStandardMaterial;
  sprout: Mesh;
  /** 0 to 1 while growing. */
  grow: number;
  /** The plant, its materials and base colors, its life left (seconds), its timer. */
  plant: Object3D | null;
  plantMaterials: MeshStandardMaterial[];
  plantColors: number[];
  life: number;
  timer: number;
  touch: TouchState;
}

interface Seed {
  mesh: Mesh;
  target: Goblin;
  serial: number;
}

interface Turned {
  goblin: Goblin;
  serial: number;
  /** Seconds until it is knocked out by its friends (-1: it only fights). */
  knockIn: number;
}

const temp = new Vector3();
const world = new Vector3();
const wiltColor = new Color(GARDEN.wiltColor);

export class Garden {
  readonly group = new Group();
  readonly beds: Bed[] = [];
  private models: Record<PlantKind, ModelTemplate> | null = null;
  private seeds: Seed[] = [];
  private turned: Turned[] = [];
  private seedHits = new Map<Goblin, { serial: number; n: number }>();
  private seedGeometry = new SphereGeometry(0.45, 6, 4);
  private seedMaterial = flatMaterial(GARDEN.seedColor);

  constructor(
    parent: Object3D,
    private goblins: Goblins,
    private audio: GameAudio,
    private particles: Particles,
  ) {
    parent.add(this.group);
  }

  async load(): Promise<void> {
    const [sunflower, mushroom] = await Promise.all([
      loadTemplate('plants/nature/flower_yellowA.glb', { height: GARDEN.sunflowerHeight }),
      loadTemplate('plants/nature/mushroom_red.glb', { height: GARDEN.mushroomHeight }),
    ]);
    this.models = { sunflower, mushroom };
  }

  /** New beds for a map: beside its roads, GARDEN.from to GARDEN.to cm out, clear of trap spots and each other. */
  place(network: RoadNetwork, keepClear: { x: number; z: number }[], rng: Random): void {
    for (const bed of this.beds) bed.group.removeFromParent();
    this.beds.length = 0;
    this.clearShots();
    const candidates: Vector3[] = [];
    const ahead = new Vector3();
    network.roads.forEach((road) => {
      for (let d = GARDEN.step / 2; d < road.length; d += GARDEN.step) {
        road.curve.getPointAt(Math.min(1, d / road.length), temp);
        const r = Math.hypot(temp.x, temp.z);
        if (r < GARDEN.from || r > GARDEN.to) continue;
        // Beside the road: off to one side, square to its direction.
        road.curve.getTangentAt(Math.min(1, d / road.length), ahead);
        const side = rng.next() < 0.5 ? -1 : 1;
        candidates.push(new Vector3(temp.x - ahead.z * GARDEN.side * side, 0, temp.z + ahead.x * GARDEN.side * side));
      }
    });
    const near = (p: Vector3, list: { x: number; z: number }[], gap: number) => list.some((q) => Math.hypot(p.x - q.x, p.z - q.z) < gap);
    for (let k = 0; k < GARDEN.beds && candidates.length > 0; k++) {
      for (let tries = 0; tries < 40; tries++) {
        const i = rng.int(candidates.length);
        const c = candidates[i];
        // Never on another road, never by a trap, never by another bed.
        if (near(c, keepClear, GARDEN.gap * 0.6) || near(c, this.beds.map((b) => b.position), GARDEN.gap) || this.onRoad(c, network)) continue;
        candidates.splice(i, 1);
        this.addBed(k % 2 === 0 ? 'sunflower' : 'mushroom', c);
        break;
      }
    }
  }

  private onRoad(p: Vector3, network: RoadNetwork): boolean {
    for (const road of network.roads) {
      for (let d = 0; d < road.length; d += 6) {
        road.curve.getPointAt(Math.min(1, d / road.length), temp);
        if (Math.hypot(p.x - temp.x, p.z - temp.z) < GARDEN.side * 0.7) return true;
      }
    }
    return false;
  }

  private addBed(kind: PlantKind, at: Vector3): void {
    at.y = groundAt(at.x, at.z);
    const group = new Group();
    group.position.copy(at);
    const dirt = flatMaterial(GARDEN.bedColor);
    const disc = new Mesh(new CylinderGeometry(GARDEN.bedRadius, GARDEN.bedRadius * 1.1, 0.6, 10), dirt);
    disc.position.y = 0.3;
    group.add(disc);
    // A small copy of its plant on the bed's edge: what grows here, readable from far.
    if (this.models) {
      const hint = cloneStatic(this.models[kind]);
      hint.scale.setScalar(0.3);
      hint.position.set(GARDEN.bedRadius * 0.6, 0.6, 0);
      group.add(hint);
    }
    const sprout = new Mesh(new CylinderGeometry(0.15, 0.25, 1, 5).translate(0, 0.5, 0), flatMaterial(GARDEN.sproutColor));
    sprout.position.y = 0.6;
    sprout.visible = false;
    group.add(sprout);
    this.group.add(group);
    this.beds.push({ kind, position: at.clone(), group, dirt, sprout, grow: 0, plant: null, plantMaterials: [], plantColors: [], life: 0, timer: 0, touch: 'idle' });
  }

  /** The bed nearest a board point within `radius` cm (flat), or null. */
  nearestBed(x: number, z: number, radius: number): Bed | null {
    let best: Bed | null = null;
    let bestD = radius;
    for (const bed of this.beds) {
      const d = Math.hypot(bed.position.x - x, bed.position.z - z);
      if (d < bestD) {
        bestD = d;
        best = bed;
      }
    }
    return best;
  }

  /** The look of a bed the glass aims at (Ready) or shines on (Held). */
  setTouch(bed: Bed | null, state: TouchState): void {
    for (const b of this.beds) {
      const want = b === bed ? state : 'idle';
      if (want === b.touch) continue;
      b.touch = want;
      applyTouchState([b.dirt, ...b.plantMaterials], want);
    }
  }

  /** The beam on a bed for `dt` seconds, `slow` times slower than by day: grows its plant, or heals it. */
  shine(bed: Bed, dt: number, slow: number): void {
    if (bed.plant) {
      bed.life = Math.min(GARDEN.life, bed.life + (GARDEN.life * dt) / (GARDEN.healTime * slow));
      return;
    }
    bed.grow = Math.min(1, bed.grow + dt / (GARDEN.growTime * slow));
    bed.sprout.visible = true;
    bed.sprout.scale.set(1, 0.5 + bed.grow * 3, 1);
    if (bed.grow >= 1) this.growPlant(bed);
  }

  private growPlant(bed: Bed): void {
    if (!this.models) return;
    bed.grow = 0;
    bed.sprout.visible = false;
    const plant = cloneStatic(this.models[bed.kind]);
    // Its own materials, so it can droop and fade alone.
    const materials: MeshStandardMaterial[] = [];
    plant.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      const own = (mesh.material as MeshStandardMaterial).clone();
      mesh.material = own;
      materials.push(own);
    });
    plant.position.y = 0.6;
    bed.group.add(plant);
    bed.plant = plant;
    bed.plantMaterials = materials;
    bed.plantColors = materials.map((m) => m.color.getHex());
    bed.life = GARDEN.life;
    bed.timer = bed.kind === 'sunflower' ? GARDEN.fireEvery : GARDEN.puffEvery;
    bed.touch = 'idle';
    this.particles.burst(bed.group.localToWorld(world.set(0, 3, 0)), [0x6bbf3a, 0xffd23f, 0xffffff], 10, 0.1);
    this.audio.play('plantPop', world, 1, 0.1);
  }

  private wilt(bed: Bed): void {
    bed.plant?.removeFromParent();
    bed.plant = null;
    bed.plantMaterials = [];
    bed.touch = 'idle';
    this.particles.burst(bed.group.localToWorld(world.set(0, 2, 0)), [GARDEN.wiltColor, 0x6b5a45], 6, 0.06);
  }

  /** A new battle: every bed empty. */
  reset(): void {
    for (const bed of this.beds) {
      if (bed.plant) this.wilt(bed);
      bed.grow = 0;
      bed.sprout.visible = false;
    }
    this.clearShots();
  }

  private clearShots(): void {
    for (const s of this.seeds) s.mesh.removeFromParent();
    this.seeds = [];
    this.turned = [];
  }

  update(dt: number): void {
    for (const bed of this.beds) {
      if (!bed.plant) {
        // A part grown bed slowly loses its sprout when the beam leaves it.
        if (bed.grow > 0 && bed.touch !== 'held') {
          bed.grow = Math.max(0, bed.grow - dt * 0.1);
          if (bed.grow <= 0) bed.sprout.visible = false;
        }
        continue;
      }
      bed.life -= dt;
      if (bed.life <= 0) {
        this.wilt(bed);
        continue;
      }
      // Droops and fades as it wilts (no bar, no number).
      const share = bed.life / GARDEN.life;
      bed.plant.scale.set(1, 0.6 + 0.4 * share, 1);
      bed.plant.rotation.z = (1 - share) * 0.35;
      bed.plantMaterials.forEach((m, i) => m.color.setHex(bed.plantColors[i]).lerp(wiltColor, (1 - share) * 0.6));
      bed.timer -= dt;
      if (bed.timer > 0) continue;
      if (bed.kind === 'sunflower') {
        bed.timer = GARDEN.fireEvery;
        this.fire(bed);
      } else {
        bed.timer = GARDEN.puffEvery;
        this.puff(bed);
      }
    }
    this.updateSeeds(dt);
    this.updateTurned(dt);
  }

  private onGround(g: Goblin): boolean {
    return this.goblins.isHittable(g) && (g.mode === 'walking' || g.mode === 'toWall' || g.mode === 'atWall' || g.mode === 'fighting');
  }

  /** The sunflower spits a seed at the nearest goblin in range. */
  private fire(bed: Bed): void {
    let best: Goblin | null = null;
    let bestD = GARDEN.range;
    for (const g of this.goblins.list) {
      if (!this.onGround(g)) continue;
      const p = g.root.position;
      const d = Math.hypot(p.x - bed.position.x, p.z - bed.position.z);
      if (d < bestD) {
        bestD = d;
        best = g;
      }
    }
    if (!best) return;
    const mesh = new Mesh(this.seedGeometry, this.seedMaterial);
    mesh.position.copy(bed.position).setY(bed.position.y + GARDEN.sunflowerHeight * 0.8);
    this.group.add(mesh);
    this.seeds.push({ mesh, target: best, serial: best.serial });
    this.audio.play('seedSpit', bed.group.localToWorld(world.set(0, GARDEN.sunflowerHeight, 0)), 0.8, 0.1);
  }

  private updateSeeds(dt: number): void {
    for (let i = this.seeds.length - 1; i >= 0; i--) {
      const s = this.seeds[i];
      const g = s.target;
      if (g.serial !== s.serial || !this.goblins.isHittable(g)) {
        s.mesh.removeFromParent();
        this.seeds.splice(i, 1);
        continue;
      }
      temp.copy(g.root.position);
      temp.y += g.stats.height * 0.6;
      const to = temp.sub(s.mesh.position);
      const d = to.length();
      const step = GARDEN.seedSpeed * dt;
      if (d > step) {
        s.mesh.position.addScaledVector(to, step / d);
        continue;
      }
      s.mesh.removeFromParent();
      this.seeds.splice(i, 1);
      this.seedHit(g);
    }
  }

  /** A seed hits: armor takes it (a piece breaks), else it counts; enough seeds knock it out. */
  private seedHit(g: Goblin): void {
    if (this.goblins.armor(g)) return;
    const hits = this.seedHits.get(g);
    const n = hits && hits.serial === g.serial ? hits.n + 1 : 1;
    this.seedHits.set(g, { serial: g.serial, n });
    this.goblins.flash(g);
    if (n < GARDEN.seedsToKnock) return;
    this.seedHits.delete(g);
    this.goblins.worldPosition(g, world);
    this.particles.burst(world, [0xffffff, 0xddd6c8, 0xffd23f], 10);
    this.audio.play('poof', world, 1, 0.05);
    // v3 2.6: the garden is grown by the magnifying glass, so its knockouts are the glass's.
    this.goblins.cause = 'glass';
    this.goblins.kill(g, true);
  }

  /** The mushroom puffs: about half of the goblins near it turn on each other; a third of them go down. */
  private puff(bed: Bed): void {
    const near: Goblin[] = [];
    for (const g of this.goblins.list) {
      if (!this.onGround(g) || g.confused > 0) continue;
      const p = g.root.position;
      if (Math.hypot(p.x - bed.position.x, p.z - bed.position.z) < GARDEN.puffRadius) near.push(g);
    }
    this.particles.burst(bed.group.localToWorld(world.set(0, GARDEN.mushroomHeight, 0)), GARDEN.puffColors, 14, 0.12);
    this.audio.play('mushroomPuff', world, 1, 0.2);
    if (near.length < 2) return;
    const turnCount = Math.max(2, Math.round(near.length * GARDEN.confuseShare));
    const down = Math.max(0, near.length - Math.ceil(near.length * GARDEN.keepShare));
    for (let k = 0; k < turnCount && k < near.length; k++) {
      const g = near[k];
      this.goblins.confuse(g, GARDEN.confuseTime);
      // The first `down` of them are knocked out by their friends somewhere in the middle of the fight.
      this.turned.push({ goblin: g, serial: g.serial, knockIn: k < down ? GARDEN.confuseTime * (0.35 + 0.15 * k) : -1 });
    }
  }

  private updateTurned(dt: number): void {
    for (let i = this.turned.length - 1; i >= 0; i--) {
      const t = this.turned[i];
      const g = t.goblin;
      if (g.serial !== t.serial || !this.goblins.isHittable(g) || g.confused <= 0) {
        this.turned.splice(i, 1);
        continue;
      }
      if (t.knockIn < 0) continue;
      t.knockIn -= dt;
      if (t.knockIn > 0) continue;
      this.turned.splice(i, 1);
      this.goblins.worldPosition(g, world);
      this.particles.burst(world, [0xffffff, 0xd8a0e8, 0xffd23f], 10);
      this.audio.play('poof', world, 1, 0.05);
      this.goblins.cause = 'glass';
      this.goblins.kill(g, true);
    }
  }

  /** Debug: every bed grows its plant at once. */
  debugGrowAll(): void {
    for (const bed of this.beds) if (!bed.plant) this.growPlant(bed);
  }
}
