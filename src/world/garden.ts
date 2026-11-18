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
import { BOOST } from '../rules/boosts.js';
import type { Particles } from '../fx/particles.js';
import { applyTouchState, type TouchState } from '../player/feedback.js';
import { angleDelta, angleOf, degToRad, groundAt, polarX, polarZ } from '../rules/boardMath.js';
import type { Random } from '../rules/random.js';
import type { Goblin, Goblins } from '../units/goblins.js';
import { cloneStatic, loadTemplate, type ModelTemplate } from './models.js';
import type { RoadNetwork } from './roads.js';
import { flatMaterial, sunflowerTurret } from './shapes.js';

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
  /** A sunflower's head pivot and its snout tip (head frame), the goblin it tracks, its turn now (radians) and its re-aim timer. */
  head: Object3D | null;
  muzzle: Vector3;
  aim: Goblin | null;
  yaw: number;
  aimTimer: number;
  /** A sunflower bed's turret, built with the bed and kept hidden until it grows. */
  ready?: ReturnType<typeof sunflowerTurret>;
  /** A mushroom bed's mushroom, built with the bed and kept hidden until it grows. */
  readyMushroom?: { group: Object3D; materials: MeshStandardMaterial[] };
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
  /** Seeds done flying, hidden, kept for the next shot (no new meshes while a sunflower fires fast). */
  private freeSeeds: Mesh[] = [];
  /** Seconds since start (the idle sway). */
  private clock = 0;
  /** Plants grown so far (the glass's first-use lesson waits for one). */
  grown = 0;
  /**
   * The glass's first-use lesson (2026-11-18): an empty sunflower bed and an empty mushroom bed made with the
   * map, hidden (so nothing new reaches the GPU mid-battle), put in front of the player when the lesson asks
   * and taken away after.
   */
  private spares: Bed[] = [];
  /** The bed the glass lesson points at now (a bed of the map near the front, or the spare), or null. */
  lessonBed: Bed | null = null;
  private network: RoadNetwork | null = null;

  private recycle(mesh: Mesh): void {
    mesh.visible = false;
    this.freeSeeds.push(mesh);
  }
  private turned: Turned[] = [];
  private seedHits = new Map<Goblin, { serial: number; n: number; armor: number }>();
  // Smaller seeds, fired often (2026-11-17).
  private seedGeometry = new SphereGeometry(0.32, 6, 4);
  private seedMaterial = flatMaterial(GARDEN.seedColor);

  constructor(
    parent: Object3D,
    private goblins: Goblins,
    private audio: GameAudio,
    private particles: Particles,
  ) {
    parent.add(this.group);
    // The seeds made up front, hidden (2026-11-17: new seed meshes mid-battle went with a flicker): a fast
    // sunflower never makes one while it fires, and the warm-up compiles their material.
    for (let i = 0; i < GARDEN.seedPool; i++) {
      const mesh = new Mesh(this.seedGeometry, this.seedMaterial);
      mesh.visible = false;
      this.group.add(mesh);
      this.freeSeeds.push(mesh);
    }
  }

  async load(): Promise<void> {
    const [sunflower, mushroom] = await Promise.all([
      loadTemplate('plants/nature/flower_yellowA.glb', { height: GARDEN.sunflowerHeight }),
      loadTemplate('plants/nature/mushroom_red.glb', { height: GARDEN.mushroomHeight }),
    ]);
    this.models = { sunflower, mushroom };
  }

  /** New beds for a map: beside its roads, GARDEN.from to GARDEN.to cm out, clear of trap spots and each other. */
  place(network: RoadNetwork, keepClear: { x: number; z: number }[], rng: Random, count: number = GARDEN.beds): void {
    this.hideLessonBed();
    for (const bed of this.beds) bed.group.removeFromParent();
    this.beds.length = 0;
    for (const bed of this.spares) bed.group.removeFromParent();
    this.spares = [];
    this.network = network;
    this.clearShots();
    // The lesson's spare beds, built now behind the map's fade (out of the list until a lesson shows one).
    for (const kind of ['sunflower', 'mushroom'] as PlantKind[]) {
      this.addBed(kind, new Vector3(0, 0, GARDEN.from));
      const bed = this.beds.pop();
      if (!bed) continue;
      bed.group.visible = false;
      this.spares.push(bed);
    }
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
    for (let k = 0; k < count && candidates.length > 0; k++) {
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
      const hint = kind === 'sunflower' ? sunflowerTurret(GARDEN.sunflowerHeight).group : cloneStatic(this.models[kind]);
      hint.scale.setScalar(0.3);
      hint.position.set(GARDEN.bedRadius * 0.6, 0.6, 0);
      group.add(hint);
    }
    const sprout = new Mesh(new CylinderGeometry(0.15, 0.25, 1, 5).translate(0, 0.5, 0), flatMaterial(GARDEN.sproutColor));
    sprout.position.y = 0.6;
    sprout.visible = false;
    group.add(sprout);
    this.group.add(group);
    // A sunflower bed builds its turret now (hidden, a map load is in the dark), so growing it later costs nothing.
    let ready: ReturnType<typeof sunflowerTurret> | undefined;
    if (kind === 'sunflower') {
      ready = sunflowerTurret(GARDEN.sunflowerHeight);
      ready.group.visible = false;
      ready.group.position.y = 0.6;
      group.add(ready.group);
    }
    // A mushroom bed builds its mushroom now too (audit 2026-11-17: it was cloned mid-battle).
    let readyMushroom: { group: Object3D; materials: MeshStandardMaterial[] } | undefined;
    if (kind === 'mushroom' && this.models) {
      const plant = cloneStatic(this.models.mushroom);
      const materials: MeshStandardMaterial[] = [];
      plant.traverse((o) => {
        const mesh = o as Mesh;
        if (!mesh.isMesh) return;
        const own = (mesh.material as MeshStandardMaterial).clone();
        mesh.material = own;
        materials.push(own);
      });
      plant.visible = false;
      plant.position.y = 0.6;
      group.add(plant);
      readyMushroom = { group: plant, materials };
    }
    this.beds.push({
      kind,
      position: at.clone(),
      group,
      dirt,
      sprout,
      grow: 0,
      plant: null,
      plantMaterials: [],
      plantColors: [],
      life: 0,
      timer: 0,
      touch: 'idle',
      head: null,
      muzzle: new Vector3(),
      aim: null,
      yaw: 0,
      aimTimer: 0,
      ready,
      readyMushroom,
    });
  }

  /**
   * The glass lesson: a bed of `kind` in front of the player (`front`: the board angle in front, radians).
   * An empty bed of the map near the front if there is one (lessonNearDeg), else the spare one, put
   * lessonRadius cm out in front, a little to the side if a road or another bed is there.
   */
  showLessonBed(front: number, kind: PlantKind): Bed | null {
    if (this.lessonBed?.kind === kind && !this.lessonBed.plant) return this.lessonBed;
    const near = degToRad(GARDEN.lessonNearDeg);
    let best: Bed | null = null;
    let bestAngle = near;
    for (const bed of this.beds) {
      const a = Math.abs(angleDelta(front, angleOf(bed.position.x, bed.position.z)));
      if (bed.kind === kind && a < bestAngle && !bed.plant) {
        best = bed;
        bestAngle = a;
      }
    }
    const spare = this.spares.find((b) => b.kind === kind);
    if (!best && spare && !this.beds.includes(spare)) {
      const bed = spare;
      const r = GARDEN.lessonRadius;
      const clear = (p: Vector3): boolean =>
        (!this.network || !this.onRoad(p, this.network)) && this.beds.every((b) => Math.hypot(b.position.x - p.x, b.position.z - p.z) > GARDEN.bedRadius * 4);
      for (let k = 0; k < 12; k++) {
        // 0, +6, -6, +12, -12... degrees from the front.
        const angle = front + degToRad(6 * Math.ceil(k / 2) * (k % 2 === 0 ? -1 : 1));
        bed.position.set(polarX(r, angle), 0, polarZ(r, angle));
        if (clear(bed.position)) break;
      }
      bed.position.y = groundAt(bed.position.x, bed.position.z);
      bed.group.position.copy(bed.position);
      bed.group.visible = true;
      this.beds.push(bed);
      best = bed;
    }
    this.lessonBed = best;
    return best;
  }

  /** The lessons are over: the spare beds go again (a map bed stays, emptied by the battle's reset). */
  hideLessonBed(): void {
    this.lessonBed = null;
    for (const bed of this.spares) {
      const i = this.beds.indexOf(bed);
      if (i < 0) continue;
      if (bed.plant) this.wilt(bed);
      bed.grow = 0;
      bed.sprout.visible = false;
      this.beds.splice(i, 1);
      bed.group.visible = false;
    }
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
    bed.grow = Math.min(1, bed.grow + dt / (GARDEN.growTime * slow * BOOST.grow));
    bed.sprout.visible = true;
    bed.sprout.scale.set(1, 0.5 + bed.grow * 3, 1);
    if (bed.grow >= 1) this.growPlant(bed);
  }

  private growPlant(bed: Bed): void {
    if (!this.models) return;
    bed.grow = 0;
    bed.sprout.visible = false;
    let plant: Object3D;
    // Its own materials, so it can droop and fade alone.
    let materials: MeshStandardMaterial[] = [];
    bed.head = null;
    bed.aim = null;
    if (bed.kind === 'sunflower') {
      // 2026-11-17: a sunflower turret whose head turns to the goblins it shoots. Built with its bed (hidden),
      // so growing it makes no meshes mid-battle; only made here if the bed has none.
      const built = bed.ready ?? sunflowerTurret(GARDEN.sunflowerHeight);
      bed.ready = built;
      built.group.visible = true;
      built.group.scale.set(1, 1, 1);
      built.group.rotation.set(0, 0, 0);
      plant = built.group;
      materials = built.materials;
      bed.head = built.head;
      bed.muzzle.copy(built.muzzle);
      // It first looks out, away from the castle (where goblins come from).
      bed.yaw = Math.atan2(bed.position.x, bed.position.z);
      built.head.rotation.y = bed.yaw;
    } else if (bed.readyMushroom) {
      plant = bed.readyMushroom.group;
      plant.visible = true;
      plant.scale.set(1, 1, 1);
      plant.rotation.set(0, 0, 0);
      materials = bed.readyMushroom.materials;
    } else {
      plant = cloneStatic(this.models[bed.kind]);
      plant.traverse((o) => {
        const mesh = o as Mesh;
        if (!mesh.isMesh) return;
        const own = (mesh.material as MeshStandardMaterial).clone();
        mesh.material = own;
        materials.push(own);
      });
    }
    plant.position.y = 0.6;
    bed.group.add(plant);
    bed.plant = plant;
    bed.plantMaterials = materials;
    // Its first colors, kept on each material: a sunflower grown again starts fresh, not wilted.
    bed.plantColors = materials.map((m) => {
      if (m.userData.baseColor === undefined) m.userData.baseColor = m.color.getHex();
      m.color.setHex(m.userData.baseColor as number);
      return m.userData.baseColor as number;
    });
    bed.life = GARDEN.life;
    bed.timer = bed.kind === 'sunflower' ? GARDEN.fireEvery : GARDEN.puffEvery;
    bed.touch = 'idle';
    this.grown++;
    this.particles.burst(bed.group.localToWorld(world.set(0, 3, 0)), [0x6bbf3a, 0xffd23f, 0xffffff], 10, 0.1);
    this.audio.play('plantPop', world, 1, 0.1);
  }

  private wilt(bed: Bed): void {
    // A sunflower built with its bed is kept (hidden) to grow again; others go.
    if (bed.plant && (bed.plant === bed.ready?.group || bed.plant === bed.readyMushroom?.group)) bed.plant.visible = false;
    else bed.plant?.removeFromParent();
    bed.plant = null;
    bed.plantMaterials = [];
    bed.touch = 'idle';
    this.particles.burst(bed.group.localToWorld(world.set(0, 2, 0)), [GARDEN.wiltColor, 0x6b5a45], 6, 0.06);
  }

  /** A new battle: every bed empty. */
  reset(): void {
    this.hideLessonBed();
    for (const bed of this.beds) {
      if (bed.plant) this.wilt(bed);
      bed.grow = 0;
      bed.sprout.visible = false;
    }
    this.clearShots();
  }

  private clearShots(): void {
    for (const s of this.seeds) this.recycle(s.mesh);
    this.seeds = [];
    this.turned = [];
  }

  update(dt: number): void {
    this.clock += dt;
    // A fired sunflower's head kicks back to its size.
    for (const bed of this.beds) if (bed.head && bed.head.scale.x !== 1) bed.head.scale.setScalar(Math.max(1, bed.head.scale.x - dt * 0.8));
    for (const bed of this.beds) {
      if (!bed.plant) {
        // A part grown bed slowly loses its sprout when the beam leaves it.
        if (bed.grow > 0 && bed.touch !== 'held') {
          bed.grow = Math.max(0, bed.grow - dt * 0.1);
          if (bed.grow <= 0) bed.sprout.visible = false;
        }
        continue;
      }
      // Endless Tough Roots: plants wilt more slowly.
      bed.life -= dt / BOOST.plantLife;
      if (bed.life <= 0) {
        this.wilt(bed);
        continue;
      }
      // Droops and fades as it wilts (no bar, no number).
      const share = bed.life / GARDEN.life;
      bed.plant.scale.set(1, 0.6 + 0.4 * share, 1);
      bed.plant.rotation.z = (1 - share) * 0.35;
      bed.plantMaterials.forEach((m, i) => m.color.setHex(bed.plantColors[i]).lerp(wiltColor, (1 - share) * 0.6));
      if (bed.kind === 'sunflower') {
        this.track(bed, dt);
        bed.timer -= dt;
        if (bed.timer > 0) continue;
        bed.timer = GARDEN.fireEvery;
        this.fire(bed);
        continue;
      }
      // The mushroom (2026-11-17: on a blind 10 s timer a group often walked past between two puffs, so it
      // seemed to do nothing): once rested, it waits for goblins to come near, then puffs at once.
      bed.timer -= dt;
      if (bed.timer > 0) continue;
      if (this.puff(bed)) bed.timer = GARDEN.puffEvery;
      else bed.timer = GARDEN.puffCheck;
    }
    this.updateSeeds(dt);
    this.updateTurned(dt);
  }

  private onGround(g: Goblin): boolean {
    return this.goblins.isHittable(g) && (g.mode === 'walking' || g.mode === 'toWall' || g.mode === 'atWall' || g.mode === 'fighting');
  }

  /**
   * The sunflower picks the nearest goblin in range now and then, and its head turns to it smoothly
   * (2026-11-17: so the player sees it noticed the goblins). Idle, it sways slowly.
   */
  private track(bed: Bed, dt: number): void {
    bed.aimTimer -= dt;
    if (bed.aim && (!this.onGround(bed.aim) || bed.aim.root.position.distanceTo(bed.position) > GARDEN.range * 1.1)) bed.aim = null;
    if (bed.aimTimer <= 0) {
      bed.aimTimer = GARDEN.retargetEvery;
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
      bed.aim = best;
    }
    if (!bed.head) return;
    const want = bed.aim
      ? Math.atan2(bed.aim.root.position.x - bed.position.x, bed.aim.root.position.z - bed.position.z)
      : bed.yaw + Math.sin(this.clock * 0.7 + bed.position.x) * 0.004;
    let d = want - bed.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    bed.yaw += d * (1 - Math.exp(-dt / GARDEN.turnSmoothing));
    bed.head.rotation.y = bed.yaw;
  }

  /** The sunflower spits a seed at the goblin it tracks, once its head is turned to it. */
  private fire(bed: Bed): void {
    const target = bed.aim;
    if (!target || !bed.head) return;
    const want = Math.atan2(target.root.position.x - bed.position.x, target.root.position.z - bed.position.z);
    const off = Math.atan2(Math.sin(want - bed.yaw), Math.cos(want - bed.yaw));
    if (Math.abs(off) > GARDEN.fireCone) return;
    // From the snout (pooled seeds: it fires often now).
    const mesh = this.freeSeeds.pop() ?? new Mesh(this.seedGeometry, this.seedMaterial);
    bed.head.updateWorldMatrix(true, false);
    this.group.worldToLocal(bed.head.localToWorld(mesh.position.copy(bed.muzzle)));
    mesh.visible = true;
    if (!mesh.parent) this.group.add(mesh);
    this.seeds.push({ mesh, target, serial: target.serial });
    // A little kick of the head on each shot.
    bed.head.scale.setScalar(1.12);
    this.audio.play('seedSpit', bed.head.localToWorld(world.copy(bed.muzzle)), 0.55, 0.1);
  }

  private updateSeeds(dt: number): void {
    for (let i = this.seeds.length - 1; i >= 0; i--) {
      const s = this.seeds[i];
      const g = s.target;
      if (g.serial !== s.serial || !this.goblins.isHittable(g)) {
        this.recycle(s.mesh);
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
      this.recycle(s.mesh);
      this.seeds.splice(i, 1);
      this.seedHit(g);
    }
  }

  /** A seed hits: armor takes it (a piece breaks), else it counts; enough seeds knock it out. */
  private seedHit(g: Goblin): void {
    const hits = this.seedHits.get(g);
    const fresh = !hits || hits.serial !== g.serial;
    const record = fresh ? { serial: g.serial, n: 0, armor: 0 } : hits;
    this.seedHits.set(g, record);
    // Smaller seeds, fired 4 times as often (2026-11-17): armor takes GARDEN.seedsPerArmor of them per piece.
    if (this.goblins.hasArmor(g)) {
      record.armor++;
      this.goblins.flash(g);
      if (record.armor >= GARDEN.seedsPerArmor) {
        record.armor = 0;
        this.goblins.armor(g);
      }
      return;
    }
    record.n++;
    const n = record.n;
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
  /** Puffs if goblins are near (returns true), else waits (no puff, false). */
  private puff(bed: Bed): boolean {
    const near: Goblin[] = [];
    for (const g of this.goblins.list) {
      if (!this.onGround(g) || g.confused > 0) continue;
      const p = g.root.position;
      if (Math.hypot(p.x - bed.position.x, p.z - bed.position.z) < GARDEN.puffRadius) near.push(g);
    }
    if (near.length === 0) return false;
    this.particles.burst(bed.group.localToWorld(world.set(0, GARDEN.mushroomHeight, 0)), GARDEN.puffColors, 18, 0.14);
    this.audio.play('mushroomPuff', world, 1, 0.2);
    // Alone, it just stands there swinging at nothing for a while; in a group they fight each other.
    if (near.length === 1) {
      this.goblins.confuse(near[0], GARDEN.confuseTime);
      return true;
    }
    const turnCount = Math.max(2, Math.round(near.length * GARDEN.confuseShare));
    const down = Math.max(0, near.length - Math.ceil(near.length * GARDEN.keepShare));
    for (let k = 0; k < turnCount && k < near.length; k++) {
      const g = near[k];
      this.goblins.confuse(g, GARDEN.confuseTime);
      // The first `down` of them are knocked out by their friends somewhere in the middle of the fight.
      this.turned.push({ goblin: g, serial: g.serial, knockIn: k < down ? GARDEN.confuseTime * (0.35 + 0.15 * k) : -1 });
    }
    return true;
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
