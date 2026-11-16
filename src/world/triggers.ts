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
// Easy to notice (build step 6): each one tells its story with a prop, in
// the same red as the keg's bands (nothing else on the board is that red):
// the keg itself, a boulder wedged with a chock and a red rag flag on a pole
// beside it, and the only autumn tree on the board (orange leaves). They
// stand on flat ground with a clear view from the seat. While goblins are near one it glows softly (emissive only), and
// a group walking right past one gives a short "now!" cue (a stronger pulse
// and a sound). No floating UI: only things that belong in the world.
//
// One rule for chain reactions: explosions set off the triggers near them.
// All motion is simple math, no physics engine. Board units (cm), in boardSpin.
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Vector3,
} from 'three';
import type { GameAudio } from '../audio/sound.js';
import { mark } from '../debug/perfMarks.js';
import { GOBLIN_RULES, ROADS, TRIGGERS } from '../config/game.js';
import { shrinkAway } from '../fx/ease.js';
import type { Particles } from '../fx/particles.js';
import { applyAimGlow, applyTouchState } from '../player/feedback.js';
import type { BlueprintTrigger, TriggerKind } from '../rules/blueprint.js';
import { boardHeight, degToRad, groundAt, landingHeight, polarX, polarZ } from '../rules/boardMath.js';
import type { Random } from '../rules/random.js';
import type { SlingTarget } from '../tools/slingshot.js';
import type { Goblin, Goblins } from '../units/goblins.js';
import { cloneStatic, loadTemplate, type ModelTemplate } from './models.js';
import type { Road, RoadNetwork } from './roads.js';
import type { Spot } from './settlements.js';
import type { CampSpot } from './terrain.js';

type Phase = 'hidden' | 'standing' | 'acting' | 'done';

const UP = new Vector3(0, 1, 0);
const temp = new Vector3();
const temp2 = new Vector3();
const world = new Vector3();
const blastAt = new Vector3();
const toRoadDir = new Vector3();
const leverDir = new Vector3();

/** A flat triangle rag flag (cm), its pole side on the local y axis, pointing along +x. */
function flagGeometry(width: number, height: number): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute([0, 0, 0, width, -height / 2, 0, 0, -height, 0], 3));
  g.computeVertexNormals();
  return g;
}
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

/** Where a blueprint trigger stands: the road nearest its spot, and how far along it. */
export interface TriggerPlacement {
  kind: TriggerKind;
  wave: number;
  road: number;
  along: number;
  /** The road's center at that spot (board cm). */
  x: number;
  z: number;
  /** v3 2.8: a spare spot (not in the blueprint), where a used trap of its kind may come back. */
  spare: boolean;
}

/**
 * v3 (docs/v3-plan.md 2.8): spare spots for the traps to come back at. For
 * each kind, TRIGGERS.respawn.spareShare times as many spots as the map has
 * of it, on the roads at the same distances from the castle as the
 * blueprint's (a little either way), at least spareGap from every other
 * trap spot. Seeded (the map's own stream), flat math only, so it runs
 * before the terrain (the ground is flattened under the spares too). Works
 * on every map, the hand-made tutorial map too. Returns the blueprint's
 * spots followed by the spares.
 */
export function addSpareSpots(network: RoadNetwork, placements: TriggerPlacement[], rng: Random): TriggerPlacement[] {
  const R = TRIGGERS.respawn;
  const all = [...placements];
  if (placements.length === 0) return all;
  const rs = placements.map((p) => Math.hypot(p.x, p.z));
  const from = Math.max(R.spareFrom, Math.min(...rs) - R.spareSlack);
  const to = Math.max(from + 10, Math.max(...rs) + R.spareSlack);
  const candidates: { road: number; along: number; x: number; z: number }[] = [];
  network.roads.forEach((road, i) => {
    for (let d = R.spareStep / 2; d < road.length; d += R.spareStep) {
      road.curve.getPointAt(Math.min(1, d / road.length), temp);
      const r = Math.hypot(temp.x, temp.z);
      if (r >= from && r <= to) candidates.push({ road: i, along: d, x: temp.x, z: temp.z });
    }
  });
  // v3 2.1: the bridge comes back in place, the bell tower never, and the cart has its own spots: no spares for them.
  const kinds = [...new Set(placements.map((p) => p.kind))].filter((k) => !NO_SPARES.has(k));
  for (const kind of kinds) {
    const want = Math.round(placements.filter((p) => p.kind === kind).length * R.spareShare);
    for (let k = 0; k < want && candidates.length > 0; k++) {
      // A few random tries for a free spot (far enough from every trap spot so far).
      for (let tries = 0; tries < 40; tries++) {
        const i = rng.int(candidates.length);
        const c = candidates[i];
        if (all.some((p) => Math.hypot(p.x - c.x, p.z - c.z) < R.spareGap)) continue;
        all.push({ kind, wave: 1, road: c.road, along: c.along, x: c.x, z: c.z, spare: true });
        candidates.splice(i, 1);
        break;
      }
    }
  }
  return all;
}

/** v3 2.1: traps that get no spare spots (see addSpareSpots) and never come back on the trap timer. */
const NO_SPARES: ReadonlySet<TriggerKind> = new Set<TriggerKind>(['bridge', 'bellTower', 'cart']);
/** v3 2.1: the new trap kinds (shown only when Triggers.extrasOn). */
const EXTRA_KINDS: ReadonlySet<TriggerKind> = new Set<TriggerKind>(['hay', 'bridge', 'bellTower', 'cart']);

/**
 * v3 (docs/v3-plan.md 2.1): the new traps on every map, from the map's own
 * stream, like the spare spots: TRIGGERS.extra.<kind>.count haystacks, bell
 * towers and bridges on the roads at their distances, at least `gap` from
 * every other trap spot, and `cartSpots` hidden spots for the rare potion
 * cart. Flat math only. Returns the given placements followed by the new ones.
 */
export function addExtraTraps(network: RoadNetwork, placements: TriggerPlacement[], rng: Random): TriggerPlacement[] {
  const E = TRIGGERS.extra;
  const all = [...placements];
  const spotsFor = (from: number, to: number): { road: number; along: number; x: number; z: number }[] => {
    const list: { road: number; along: number; x: number; z: number }[] = [];
    network.roads.forEach((road, i) => {
      for (let d = E.step / 2; d < road.length; d += E.step) {
        road.curve.getPointAt(Math.min(1, d / road.length), temp);
        const r = Math.hypot(temp.x, temp.z);
        // A bridge needs room for its whole length on the road.
        if (r >= from && r <= to && d > TRIGGERS.bridge.length && d < road.length - TRIGGERS.bridge.length) list.push({ road: i, along: d, x: temp.x, z: temp.z });
      }
    });
    return list;
  };
  const add = (kind: TriggerKind, count: number, from: number, to: number, spare: boolean): void => {
    const candidates = spotsFor(from, to);
    for (let k = 0; k < count && candidates.length > 0; k++) {
      for (let tries = 0; tries < 40; tries++) {
        const i = rng.int(candidates.length);
        const c = candidates[i];
        const gap = kind === 'bridge' ? E.gap + TRIGGERS.bridge.length / 2 : E.gap;
        if (all.some((p) => Math.hypot(p.x - c.x, p.z - c.z) < gap)) continue;
        all.push({ kind, wave: 1, road: c.road, along: c.along, x: c.x, z: c.z, spare });
        candidates.splice(i, 1);
        break;
      }
    }
  };
  add('bridge', E.bridge.count, E.bridge.from, E.bridge.to, false);
  add('bellTower', E.bellTower.count, E.bellTower.from, E.bellTower.to, false);
  add('hay', E.hay.count, E.hay.from, E.hay.to, false);
  add('cart', E.cartSpots, E.cart.from, E.cart.to, true);
  return all;
}

/** Each blueprint trigger on the road nearest its spot. Only flat math, so it runs before the terrain is built. */
export function placeTriggers(network: RoadNetwork, spots: BlueprintTrigger[]): TriggerPlacement[] {
  return spots.map((spot) => {
    const a = degToRad(spot.at[1]);
    const x = polarX(spot.at[0], a);
    const z = polarZ(spot.at[0], a);
    let road = 0;
    let best = Infinity;
    network.roads.forEach((r, i) => {
      const d = r.distanceTo(x, z);
      if (d < best) {
        best = d;
        road = i;
      }
    });
    const along = network.roads[road].nearestAlong(x, z);
    network.roads[road].curve.getPointAt(Math.min(1, along / network.roads[road].length), temp);
    return { kind: spot.kind, wave: spot.wave, road, along, x: temp.x, z: temp.z, spare: false };
  });
}

/**
 * The ground around the triggers: flat spots for the terrain (under each one,
 * and on the way from it toward the castle, so no hill hides it from the
 * seat), and spots the villages, towers and decor keep clear of.
 */
export function triggerGround(placements: TriggerPlacement[]): { flats: CampSpot[]; clear: Spot[] } {
  const { flat, sight, sightSize, clear } = TRIGGERS.ground;
  const flats: CampSpot[] = [];
  const keep: Spot[] = [];
  for (const p of placements) {
    flats.push({ x: p.x, z: p.z, size: flat[p.kind] });
    for (const share of sight) flats.push({ x: p.x * share, z: p.z * share, size: sightSize });
    keep.push({ x: p.x, z: p.z, size: clear });
  }
  return { flats, clear: keep };
}

/** The red danger paint every trigger carries (and the white of the tree's band). */
function paintMaterial(color: number): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, flatShading: true, side: DoubleSide });
}

/**
 * Gives a tree's leaves their own autumn material. Each triangle whose spot
 * on the color map is green is a leaf triangle (the trunk's are brown), so
 * only the leaves change, whole triangles at a time. If the map cannot be
 * read, triangles in the crown (above TRIGGERS.tree.crownFrom of the height)
 * count as leaves. Returns the new materials (they glow with the tree).
 */
function autumnLeaves(model: Object3D, height: number): MeshStandardMaterial[] {
  const leaf = new MeshStandardMaterial({ color: TRIGGERS.tree.leafColor, roughness: 1, metalness: 0, flatShading: true });
  model.updateMatrixWorld(true);
  model.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const base = mesh.material as MeshStandardMaterial;
    const pixels = mapPixels(base.map);
    const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    const position = g.getAttribute('position');
    const uv = g.getAttribute('uv');
    const triangles = position.count / 3;
    const isLeaf: boolean[] = [];
    const v = new Vector3();
    for (let t = 0; t < triangles; t++) {
      let green = false;
      if (pixels && uv) {
        const u = (uv.getX(t * 3) + uv.getX(t * 3 + 1) + uv.getX(t * 3 + 2)) / 3;
        const w = (uv.getY(t * 3) + uv.getY(t * 3 + 1) + uv.getY(t * 3 + 2)) / 3;
        const px = Math.min(pixels.width - 1, Math.max(0, Math.floor((u - Math.floor(u)) * pixels.width)));
        const py = Math.min(pixels.height - 1, Math.max(0, Math.floor((w - Math.floor(w)) * pixels.height)));
        const i = (py * pixels.width + px) * 4;
        const [r, gr, b] = [pixels.data[i], pixels.data[i + 1], pixels.data[i + 2]];
        green = gr > r * 1.08 && gr > b * 1.08;
      } else {
        let y = 0;
        for (let k = 0; k < 3; k++) y += v.fromBufferAttribute(position, t * 3 + k).applyMatrix4(mesh.matrixWorld).y;
        green = y / 3 > height * TRIGGERS.tree.crownFrom;
      }
      isLeaf.push(green);
    }
    // Leaf triangles last, as their own group with the autumn material.
    const order = [...isLeaf.keys()].sort((a, b) => Number(isLeaf[a]) - Number(isLeaf[b]));
    const leaves = isLeaf.filter(Boolean).length;
    if (leaves === 0) return;
    for (const name of Object.keys(g.attributes)) {
      const attribute = g.getAttribute(name);
      const size = attribute.itemSize;
      const from = attribute.array as Float32Array;
      const to = new Float32Array(from.length);
      order.forEach((t, n) => to.set(from.subarray(t * 3 * size, (t + 1) * 3 * size), n * 3 * size));
      g.setAttribute(name, new Float32BufferAttribute(to, size));
    }
    g.clearGroups();
    g.addGroup(0, (triangles - leaves) * 3, 0);
    g.addGroup((triangles - leaves) * 3, leaves * 3, 1);
    mesh.geometry = g;
    mesh.material = [base, leaf];
  });
  return [leaf];
}

/** The pixels of a color map, or null when it cannot be read back (a compressed texture). */
function mapPixels(map: MeshStandardMaterial['map']): ImageData | null {
  try {
    const image = map?.image as (CanvasImageSource & { width: number; height: number }) | undefined;
    if (!image || !image.width) return null;
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const c = canvas.getContext('2d')!;
    c.drawImage(image, 0, 0);
    return c.getImageData(0, 0, canvas.width, canvas.height);
  } catch {
    return null;
  }
}


/** Modes where a goblin is on its feet on the field (it counts as near a trigger). */
const ON_FIELD: ReadonlySet<Goblin['mode']> = new Set<Goblin['mode']>(['walking', 'toWall', 'dazed', 'fighting']);

interface Debris {
  object: Object3D;
  alive: boolean;
  age: number;
  readonly velocity: Vector3;
  spin: number;
  bounced: boolean;
}

/** The things every trigger shares: its spot on a road, aiming, the reset between waves. */
export abstract class Trigger implements SlingTarget {
  readonly root = new Group();
  protected phase: Phase = 'hidden';
  protected time = 0;
  protected materials: MeshStandardMaterial[] = [];
  private aimed = false;
  /** Shown once already (the first time it pops in with a poof). */
  private seen = false;
  /** Goblins near it, and in a group right at it (counted by the owner a few times a second). */
  near = 0;
  close = 0;
  /** The strong "now!" pulse left (seconds), and the wait before the next one. */
  private nowLeft = 0;
  private nowWait = 0;

  abstract readonly radius: number;
  readonly assist = TRIGGERS.assist;
  /** v3 2.8: a spare spot: it only stands when a used trap of its kind comes back here. */
  spare = false;

  /** Has it stood this battle yet (a blueprint trap shows by its wave only once; after that it comes back on the timer). */
  get seenThisBattle(): boolean {
    return this.seen;
  }

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

  /** The graph road it stands on, and where along it (cm). */
  get roadNumber(): number {
    return this.roadIndex;
  }
  get alongRoad(): number {
    return this.along;
  }

  /** Which way along its road leads toward the castle (as in Step.dir). */
  get towardCastle(): 1 | -1 {
    const r = this.road;
    r.pointAt(0, 0, temp2);
    const r0 = Math.hypot(temp2.x, temp2.z);
    r.pointAt(r.length, 0, temp2);
    return Math.hypot(temp2.x, temp2.z) < r0 ? 1 : -1;
  }

  /** Board height of its top (cm), for markers. */
  abstract topY(): number;

  /** Used or not shown yet, so it can be put back (not while it is acting, like a rolling boulder). */
  get resettable(): boolean {
    return this.phase === 'done' || this.phase === 'hidden';
  }

  /**
   * Where lesson goblin `i` waits for the shot (cm along its road, and its
   * lane): right in what the trigger does, so the shot shows its effect.
   */
  abstract waitSpot(i: number): { along: number; lane: number };

  /** A spot along its road, kept on the road. */
  protected clampAlong(along: number): number {
    return Math.min(this.road.length - 1, Math.max(1, along));
  }

  get standing(): boolean {
    return this.phase === 'standing';
  }

  /** Whether it stands before this wave (1 based), or waits hidden. */
  get hiddenNow(): boolean {
    return this.phase === 'hidden';
  }

  abstract center(out: Vector3): Vector3;

  /** The slingshot can set it off (v3 2.1: not the haystack, fire only, nor the bell tower, the magnet only). */
  protected get slingable(): boolean {
    return true;
  }

  hittable(): boolean {
    return this.phase === 'standing' && this.slingable;
  }

  /** A blast nearby sets it off (v3 2.1: not the bell tower). */
  get chainable(): boolean {
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
    applyTouchState(this.materials, 'idle');
    this.phase = 'acting';
    this.time = 0;
    this.act();
    this.owner.onSetOff(this);
  }

  /** A group walks right past it: a strong pulse and a sound from its direction. */
  cueNow(): void {
    if (this.nowWait > 0) return;
    this.nowLeft = TRIGGERS.cue.nowTime;
    this.nowWait = TRIGGERS.cue.nowGap;
    this.center(temp);
    this.owner.sound('triggerNow', temp);
  }

  /** Every frame while it stands: the soft glow while goblins are near. */
  private updateCue(dt: number): void {
    const { glowColor, glowMin, glowMax, glowSpeed, nowColor, nowIntensity } = TRIGGERS.cue;
    this.nowLeft = Math.max(0, this.nowLeft - dt);
    this.nowWait = Math.max(0, this.nowWait - dt);
    const active = this.near > 0 || this.nowLeft > 0;
    if (!active) {
      if (!this.aimed) applyTouchState(this.materials, 'idle');
      return;
    }
    // The aim glow wins while the slingshot points at it.
    if (this.aimed) return;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * glowSpeed);
    const now = this.nowLeft > 0;
    const intensity = now ? nowIntensity * (0.6 + 0.4 * pulse) : glowMin + (glowMax - glowMin) * pulse;
    for (const m of this.materials) {
      m.emissive.setHex(now ? nowColor : glowColor);
      m.emissiveIntensity = intensity;
    }
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
    this.near = this.close = 0;
    this.nowLeft = 0;
    this.place();
    this.root.visible = true;
    if (!this.seen) {
      this.seen = true;
      this.center(temp);
      this.owner.poof(temp, 10);
    }
  }

  /** True while it is set off and still doing its thing (a rolling boulder, a fallen tree blocking its road). */
  get acting(): boolean {
    return this.phase === 'acting';
  }

  /** v3 2.8: it comes back here (a used trap rebuilt at a new spot): standing, with a poof. */
  appear(): void {
    this.seen = false;
    this.reset(Infinity);
  }

  hide(): void {
    this.cleanUp();
    this.phase = 'hidden';
    this.root.visible = false;
    this.near = this.close = 0;
    this.nowLeft = this.nowWait = 0;
    this.setAimed(false);
    this.seen = false;
  }

  update(dt: number): void {
    if (this.phase === 'hidden') return;
    this.time += dt;
    if (this.phase === 'standing') {
      this.stand();
      this.updateCue(dt);
    } else if (this.phase === 'acting') this.during(dt);
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

  topY(): number {
    return this.spot.y + TRIGGERS.keg.height;
  }

  /** Right beside the keg, in its blast. */
  waitSpot(i: number): { along: number; lane: number } {
    const lanes = [-1.6, 0, 1.6];
    return { along: this.clampAlong(this.along + this.towardCastle * (i % 3 - 1) * 3.2), lane: lanes[i % 3] };
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
  private flag: Group | null = null;
  private flagYaw = 0;

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
    // Pale stone with a green top, unlike the orange rocks around.
    for (const m of this.materials) m.color.setHex(m.name === 'grass' ? TRIGGERS.boulder.mossColor : TRIGGERS.boulder.stoneColor);
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
    this.materials.push(...this.buildLever());
  }

  /**
   * Someone has wedged it, ready to go: a wooden chock under it on the road
   * side, and a straight warning flag planted on the hill beside it, a red
   * rag on an upright pole, its cloth turned toward the castle so it reads
   * from the seat. They stay on the hill when the boulder rolls. Returns
   * their materials (they glow with the boulder).
   */
  private buildLever(): MeshStandardMaterial[] {
    const { size, poleHeight, flagWidth, flagHeight } = TRIGGERS.boulder;
    const wood = paintMaterial(TRIGGERS.woodColor);
    const red = paintMaterial(TRIGGERS.paint);
    const props = new Group();
    // In the hill's own space (it only moves, never turns).
    const local = (world: Vector3): Vector3 => world.sub(this.hill.position);
    toRoadDir.subVectors(this.onRoad, this.rest).setY(0).normalize();
    // Across the road direction, on the ground.
    leverDir.set(toRoadDir.z, 0, -toRoadDir.x);
    // The chock: a wooden wedge (a 3 sided prism) lying under the boulder on the road side, across the road direction.
    const chock = new Mesh(new CylinderGeometry(size * 0.2, size * 0.2, size * 0.6, 3), wood);
    chock.rotation.set(0, Math.atan2(leverDir.z, -leverDir.x), Math.PI / 2, 'YXZ');
    chock.position.copy(local(temp.copy(this.rest).addScaledVector(toRoadDir, size * 0.42).setY(this.rest.y - size * 0.4)));
    // The flag: an upright pole on the hill beside the boulder, away from the road.
    const ground = this.rest.y - size / 2;
    const foot = temp.copy(this.rest).addScaledVector(toRoadDir, -size * 0.55).addScaledVector(leverDir, size * 0.45).setY(ground - 0.5);
    const pole = new Mesh(new CylinderGeometry(0.22, 0.26, poleHeight, 6), wood);
    pole.position.copy(foot).setY(foot.y + poleHeight / 2);
    local(pole.position);
    // The rag hangs from the pole's top, its face toward the board's middle (the castle and the seat).
    const flag = new Group();
    const cloth = new Mesh(flagGeometry(flagWidth, flagHeight), red);
    flag.add(cloth);
    flag.position.copy(foot).setY(foot.y + poleHeight - 0.2);
    local(flag.position);
    this.flagYaw = Math.atan2(-foot.x, -foot.z);
    flag.rotation.y = this.flagYaw;
    props.add(chock, pole, flag);
    this.flag = flag;
    this.hill.add(props);
    return [wood, red];
  }

  /** The rag flutters a little round its pole, staying upright. */
  protected override stand(): void {
    super.stand();
    if (this.flag) this.flag.rotation.y = this.flagYaw + Math.sin(this.time * 3) * 0.18;
  }

  private xz(distance: number): [number, number] {
    this.road.pointAt(distance, 0, temp2);
    return [temp2.x, temp2.z];
  }

  center(out: Vector3): Vector3 {
    return out.copy(this.root.position);
  }

  topY(): number {
    return this.rest.y + TRIGGERS.boulder.size / 2;
  }

  /** On the road below it, in the line it rolls down. */
  waitSpot(i: number): { along: number; lane: number } {
    const lanes = [0, -1, 1];
    const at = this.clampAlong(this.along + this.dir * (9 + i * 4.5));
    return { along: this.dir === 1 ? Math.min(at, this.stopAt - 2) : Math.max(at, this.stopAt + 2), lane: lanes[i % 3] };
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
  /** How far it falls (degrees from upright): its crown comes to rest on the ground, never through it. */
  private readonly fallDeg: number;

  constructor(owner: Triggers, wave: number, road: number, along: number, template: ModelTemplate) {
    super('tree', wave, owner, road, along);
    const model = cloneStatic(template);
    this.materials = ownMaterials(model);
    // Only the leaves turn autumn orange (whole leaf triangles, never the trunk), so this tree stands out from every other.
    this.materials.push(...autumnLeaves(model, template.size.y));
    this.root.add(model);
    const { side } = TRIGGERS.tree;
    this.road.pointAt(along, 0, temp);
    this.road.pointAt(along, side, this.base);
    this.side.subVectors(this.base, temp).setY(0).normalize();
    // Turning around this axis moves the top from straight up toward the road (away from `side`).
    this.axis.crossVectors(this.side, UP).normalize();
    this.fallDeg = this.restingFall(Math.min(template.size.x, template.size.z) / 2);
  }

  /**
   * The fall angle where the tree lies on the ground: the most it can turn
   * (up to 90 degrees) with its crown (radius `crown`, cm) and trunk still
   * above the ground and the road along its whole length. A flat 90 degree
   * fall pushed half the crown into the ground (headset test after step 6).
   */
  private restingFall(crown: number): number {
    const { height, leanDeg } = TRIGGERS.tree;
    const { crownFrom, trunkRadius, crownRest } = TRIGGERS.tree;
    crown *= crownRest;
    for (let deg = 90; deg > leanDeg + 10; deg--) {
      const a = degToRad(deg);
      let clear = true;
      for (let share = 0.2; share <= 1.001 && clear; share += 0.1) {
        const d = height * share;
        const x = this.base.x - this.side.x * Math.sin(a) * d;
        const z = this.base.z - this.side.z * Math.sin(a) * d;
        const y = this.base.y + Math.cos(a) * d;
        // The crown is round: its middle part needs its full radius, it narrows toward the tip.
        const reach = share < crownFrom ? trunkRadius : Math.max(trunkRadius, crown * Math.sin((Math.PI * (share - crownFrom)) / (1 - crownFrom + 0.05)));
        if (y - reach < groundAt(x, z) + ROADS.lift) clear = false;
      }
      if (clear) return deg;
    }
    return leanDeg + 10;
  }

  center(out: Vector3): Vector3 {
    // About the middle of the trunk, where it leans over the road.
    out.set(0, TRIGGERS.tree.height * 0.55, 0).applyQuaternion(this.root.quaternion);
    return out.add(this.root.position);
  }

  topY(): number {
    return this.base.y + TRIGGERS.tree.height * Math.cos(degToRad(TRIGGERS.tree.leanDeg));
  }

  /** On the road just before it (coming from the camps), so the fallen trunk blocks their way. */
  waitSpot(i: number): { along: number; lane: number } {
    const lanes = [0, -1.4, 1.4];
    return { along: this.clampAlong(this.along - this.towardCastle * (5 + i * 3.2)), lane: lanes[i % 3] };
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
    const { fallTime, leanDeg, blockSeconds } = TRIGGERS.tree;
    if (!this.fallen) {
      // Falls faster and faster, like a real tree.
      const t = Math.min(1, this.time / fallTime);
      this.lean(leanDeg + (this.fallDeg - leanDeg) * t * t);
      if (t < 1) return;
      this.fallen = true;
      this.blockLeft = blockSeconds;
      // It hurts no one: it only blocks the road, so the goblins on it turn back.
      temp.copy(this.base).addScaledVector(this.side, -TRIGGERS.tree.side);
      this.owner.sound('treeCrash', temp);
      this.owner.dust(temp, TRIGGERS.tree.leafColors);
      this.owner.closeRoad(this.roadIndex, true);
      return;
    }
    // The road is blocked for a while, then the tree poofs away and it opens.
    this.blockLeft -= dt;
    if (this.blockLeft > 0) return;
    // Then it shrinks away (the shared despawn look), and the road opens.
    const t = -this.blockLeft / GOBLIN_RULES.vanishTime;
    if (t < 1) {
      this.root.scale.setScalar(Math.max(0.001, shrinkAway(t)));
      return;
    }
    temp.copy(this.base).addScaledVector(this.side, -TRIGGERS.tree.side);
    this.owner.debris(temp, TRIGGERS.tree.debris);
    this.owner.poof(temp, 8);
    this.root.visible = false;
    this.root.scale.setScalar(1);
    this.cleanUp();
    this.phase = 'done';
  }

  protected cleanUp(): void {
    if (this.fallen) this.owner.closeRoad(this.roadIndex, false);
    this.fallen = false;
  }
}

/**
 * Haystack (v3 2.1): beside its road. Fire only (the magnifying glass, a
 * blast nearby): it burns for TRIGGERS.hay.burnTime and closes its road like
 * the fallen tree (goblins on it turn back), then leaves a burnt patch for a
 * while. A code shape (no pack has a haystack: docs/placeholder-shapes.md).
 */
class Hay extends Trigger {
  readonly radius = TRIGGERS.hay.hitRadius;
  private readonly spot = new Vector3();
  private readonly patch: Mesh;
  private burning = false;
  private fireTimer = 0;

  constructor(owner: Triggers, wave: number, road: number, along: number) {
    super('hay', wave, owner, road, along);
    const H = TRIGGERS.hay;
    const straw = new MeshStandardMaterial({ color: H.color, roughness: 1, metalness: 0, flatShading: true });
    const dark = new MeshStandardMaterial({ color: H.darkColor, roughness: 1, metalness: 0, flatShading: true });
    const body = new Mesh(new CylinderGeometry(H.radius * 0.9, H.radius, H.height * 0.6, 9), straw);
    body.position.y = H.height * 0.3;
    const top = new Mesh(new CylinderGeometry(0.2, H.radius * 0.9, H.height * 0.45, 9), dark);
    top.position.y = H.height * 0.6 + H.height * 0.22;
    this.root.add(body, top);
    this.materials = [straw, dark];
    this.road.pointAt(along, H.side, this.spot);
    this.patch = new Mesh(new CylinderGeometry(H.radius * 1.6, H.radius * 1.8, 0.2, 10), new MeshStandardMaterial({ color: H.patchColor, roughness: 1, flatShading: true }));
    this.patch.visible = false;
    owner.group.add(this.patch);
  }

  protected get slingable(): boolean {
    return false;
  }

  center(out: Vector3): Vector3 {
    return out.copy(this.spot).setY(this.spot.y + TRIGGERS.hay.height / 2);
  }

  topY(): number {
    return this.spot.y + TRIGGERS.hay.height;
  }

  waitSpot(i: number): { along: number; lane: number } {
    return { along: this.clampAlong(this.along - this.towardCastle * (4 + i * 3.2)), lane: [0, -1.4, 1.4][i % 3] };
  }

  protected place(): void {
    this.root.position.copy(this.spot);
    this.root.quaternion.identity();
    this.root.scale.setScalar(1);
  }

  protected act(): void {
    this.burning = true;
    this.fireTimer = 0;
    this.center(temp2);
    this.owner.burnSound(temp2);
    this.owner.closeRoad(this.roadIndex, true);
  }

  protected during(dt: number): void {
    const H = TRIGGERS.hay;
    if (this.burning) {
      this.fireTimer -= dt;
      if (this.fireTimer <= 0) {
        this.fireTimer = H.fireEvery;
        this.center(temp2);
        this.owner.flames(temp2, H.fireColors);
      }
      // It burns down as it goes.
      const t = Math.min(1, this.time / H.burnTime);
      this.root.scale.set(1, Math.max(0.15, 1 - t * 0.85), 1);
      if (t < 1) return;
      this.burning = false;
      this.owner.closeRoad(this.roadIndex, false);
      this.root.visible = false;
      this.patch.position.copy(this.spot);
      this.patch.visible = true;
      this.center(temp2);
      this.owner.poof(temp2, 8);
      return;
    }
    // The burnt patch stays a while, then the trap is spent (it comes back on the trap timer, 2.8).
    if (this.time > H.burnTime + H.patchTime) {
      this.patch.visible = false;
      this.phase = 'done';
    }
  }

  protected cleanUp(): void {
    if (this.burning) this.owner.closeRoad(this.roadIndex, false);
    this.burning = false;
    this.patch.visible = false;
  }
}

/**
 * Bell tower (v3 2.1): a ruined tower beside its road (Kenney castle kit
 * pieces), its belfry leaning over the road with an old iron bell in it.
 * The magnet's ring held on the bell drops it (Magnet): a short fall with a
 * bounce, a "BONG" and dust, and every goblin under it is knocked out,
 * helmets too. The tower stays, without its bell, for the rest of the
 * battle: it never comes back on the trap timer (2.8).
 */
class BellTower extends Trigger {
  readonly radius = TRIGGERS.bellTower.hitRadius;
  /** The road point under the bell (where it lands) and where it hangs. */
  private readonly drop = new Vector3();
  private readonly hang = new Vector3();
  private readonly base = new Vector3();
  private readonly bell: Mesh;
  private readonly tower = new Group();
  private landed = false;

  constructor(owner: Triggers, wave: number, road: number, along: number, pieces: ModelTemplate[]) {
    super('bellTower', wave, owner, road, along);
    const B = TRIGGERS.bellTower;
    this.road.pointAt(along, 0, this.drop);
    this.road.pointAt(along, B.side, this.base);
    // The tower: the pieces stacked, the belfry on top leaning toward the road.
    let y = 0;
    const toRoad = temp.subVectors(this.drop, this.base).setY(0).normalize();
    const lean = new Vector3().crossVectors(UP, toRoad).normalize();
    pieces.forEach((piece, i) => {
      const part = cloneStatic(piece);
      part.position.y = y;
      if (i === pieces.length - 1) part.quaternion.setFromAxisAngle(lean, degToRad(B.leanDeg));
      this.tower.add(part);
      y += piece.size.y;
    });
    this.root.add(this.tower);
    this.materials = ownMaterials(this.tower);
    // The bell: a simple flared shape (docs/placeholder-shapes.md), hanging under the belfry's top on the road side.
    const bronze = new MeshStandardMaterial({ color: B.bellColor, roughness: 0.6, metalness: 0.4, flatShading: true });
    this.bell = new Mesh(new CylinderGeometry(B.bellRadius * 0.45, B.bellRadius, B.bellHeight, 10).translate(0, -B.bellHeight / 2, 0), bronze);
    this.materials.push(bronze);
    const top = pieces.length > 0 ? y - pieces[pieces.length - 1].size.y * 0.2 : 12;
    this.hang.copy(this.base).addScaledVector(toRoad, Math.min(B.side * 0.6, B.width * 0.4 + Math.sin(degToRad(B.leanDeg)) * top));
    this.hang.y = this.base.y + top;
    owner.group.add(this.bell);
    this.bell.visible = false;
  }

  protected get slingable(): boolean {
    return false;
  }

  get chainable(): boolean {
    return false;
  }

  /** The road point under the bell: the magnet's ring aims here. */
  center(out: Vector3): Vector3 {
    return out.copy(this.drop).setY(this.drop.y + 1);
  }

  /** Where the bell hangs (board cm), for the magnet's glints. */
  bellAt(out: Vector3): Vector3 {
    return out.copy(this.bell.position);
  }

  topY(): number {
    return this.hang.y + 2;
  }

  waitSpot(i: number): { along: number; lane: number } {
    return { along: this.clampAlong(this.along + (i % 3 - 1) * 2.5), lane: [0, -1.4, 1.4][i % 3] };
  }

  protected place(): void {
    this.root.position.copy(this.base);
    this.root.quaternion.identity();
    this.bell.visible = true;
    this.bell.position.copy(this.hang);
    this.bell.rotation.set(0, 0, 0);
  }

  /** The magnet pulls the bell: it shakes and glints (called while the ring is held on it). */
  shake(time: number): void {
    if (this.phase !== 'standing') return;
    this.bell.rotation.z = Math.sin(time * 30) * 0.12;
  }

  protected act(): void {
    this.landed = false;
  }

  protected during(): void {
    const B = TRIGGERS.bellTower;
    if (this.landed) {
      // It lies on the road a moment, then fades away; the tower stays without it.
      if (this.time > B.fallTime + 1.5) {
        this.bell.visible = false;
        this.phase = 'done';
      }
      return;
    }
    const t = Math.min(1, this.time / B.fallTime);
    this.bell.position.lerpVectors(this.hang, this.drop, t);
    // Falls faster and faster, then a small bounce.
    this.bell.position.y = this.hang.y + (this.drop.y + B.bellHeight - this.hang.y) * t * t;
    if (t < 1) return;
    this.landed = true;
    this.bell.position.y = this.drop.y + B.bellHeight;
    this.owner.bong(this.drop);
    this.owner.dust(this.drop, B.dustColors);
    this.owner.debris(this.drop, 3);
    this.owner.crush(this.drop, B.knockRadius);
  }

  hide(): void {
    super.hide();
    this.bell.visible = false;
  }
}

/**
 * Potion cart (v3 2.1): an alchemist's cart (Kenney cart) with purple
 * potions (Kenney mini dungeon) on it. Rare: Triggers shows it now and then
 * at one of its spots. A pebble bursts the potions in a purple fizz, and
 * every goblin around turns into a chicken for good (src/units/chickens.ts).
 */
class Cart extends Trigger {
  readonly radius = TRIGGERS.cart.hitRadius;
  private readonly spot = new Vector3();
  private readonly potions: Object3D[] = [];
  /** Seconds left before it goes away unused. */
  standLeft = 0;

  constructor(owner: Triggers, wave: number, road: number, along: number, cart: ModelTemplate, potion: ModelTemplate) {
    super('cart', wave, owner, road, along);
    const C = TRIGGERS.cart;
    const model = cloneStatic(cart);
    this.materials = ownMaterials(model);
    this.root.add(model);
    for (let i = 0; i < C.potionCount; i++) {
      const p = cloneStatic(potion);
      this.materials.push(...ownMaterials(p, C.potionTint));
      const a = (i / C.potionCount) * Math.PI * 2;
      p.position.set(Math.cos(a) * cart.size.x * 0.22, cart.size.y * 0.75, Math.sin(a) * cart.size.z * 0.2);
      this.root.add(p);
      this.potions.push(p);
    }
    this.road.pointAt(along, C.side, this.spot);
    // Facing along its road.
    this.road.pointAt(Math.min(this.road.length, along + 2), C.side, temp);
    this.yaw = Math.atan2(temp.x - this.spot.x, temp.z - this.spot.z);
  }

  private yaw = 0;

  center(out: Vector3): Vector3 {
    return out.copy(this.spot).setY(this.spot.y + 3);
  }

  topY(): number {
    return this.spot.y + 6;
  }

  waitSpot(i: number): { along: number; lane: number } {
    return { along: this.clampAlong(this.along + (i % 3 - 1) * 3), lane: [0, -1.4, 1.4][i % 3] };
  }

  protected place(): void {
    this.root.position.copy(this.spot);
    this.root.rotation.set(0, this.yaw, 0);
    this.root.scale.setScalar(1);
    for (const p of this.potions) p.visible = true;
  }

  protected act(): void {
    for (const p of this.potions) p.visible = false;
    this.center(temp2);
    this.owner.potionBurst(temp2, TRIGGERS.cart.radius);
  }

  protected during(): void {
    // The empty cart stays a moment, then poofs away.
    if (this.time < 2.5) return;
    this.center(temp2);
    this.owner.poof(temp2, 8);
    this.root.visible = false;
    this.phase = 'done';
  }
}

/**
 * Rope bridge (v3 2.1): a wooden bridge (Kenney Nature Kit) on its road over
 * a stream (a flat blue strip on the ground, no real water), long enough for
 * a whole goblin group. A pebble or a blast drops it: every goblin on it is
 * knocked out, and its road is closed (goblins take the long way round)
 * until it is rebuilt in place after TRIGGERS.bridge.downTime.
 */
class Bridge extends Trigger {
  readonly radius = TRIGGERS.bridge.hitRadius;
  private readonly mid = new Vector3();
  private readonly a = new Vector3();
  private readonly b = new Vector3();
  private readonly deck: Object3D;
  private readonly stream: Mesh;
  private down = false;

  constructor(owner: Triggers, wave: number, road: number, along: number, template: ModelTemplate) {
    super('bridge', wave, owner, road, along);
    const B = TRIGGERS.bridge;
    this.road.pointAt(along, 0, this.mid);
    this.road.pointAt(this.clampAlong(along - B.length / 2), 0, this.a);
    this.road.pointAt(this.clampAlong(along + B.length / 2), 0, this.b);
    const yaw = Math.atan2(-(this.b.z - this.a.z), this.b.x - this.a.x);
    this.yaw = yaw;
    this.deck = cloneStatic(template);
    this.materials = ownMaterials(this.deck);
    this.root.add(this.deck);
    // The stream: a flat blue strip across the road under the bridge.
    const water = new MeshStandardMaterial({ color: B.streamColor, roughness: 0.3, metalness: 0.1, emissive: B.streamEdge, emissiveIntensity: 0.15 });
    this.stream = new Mesh(new BoxGeometry(B.length * 0.7, 0.15, B.streamWidth), water);
    this.stream.position.copy(this.mid).setY(this.mid.y + 0.1);
    this.stream.rotation.y = yaw;
    this.stream.visible = false;
    owner.group.add(this.stream);
  }

  center(out: Vector3): Vector3 {
    return out.copy(this.mid).setY(this.mid.y + 1.5);
  }

  topY(): number {
    return this.mid.y + 3;
  }

  /** On the bridge itself, spread along it. */
  waitSpot(i: number): { along: number; lane: number } {
    return { along: this.clampAlong(this.along + (i - 2) * 4), lane: [0, -1, 1][i % 3] };
  }

  private readonly yaw: number;

  protected place(): void {
    this.root.position.copy(this.mid).setY(this.mid.y + 0.2);
    this.root.rotation.set(0, this.yaw, 0);
    this.deck.position.set(0, 0, 0);
    this.deck.rotation.set(0, 0, 0);
    this.root.scale.setScalar(1);
    this.stream.visible = true;
  }

  protected act(): void {
    this.down = false;
    this.center(temp2);
    this.owner.sound('treeCreak', temp2);
    // Every goblin on it falls in.
    this.owner.crushAlong(this.a, this.b, TRIGGERS.bridge.onRadius);
    this.owner.closeRoad(this.roadIndex, true);
  }

  protected during(): void {
    const B = TRIGGERS.bridge;
    if (!this.down) {
      // The deck drops and tips into the stream.
      const t = Math.min(1, this.time / B.fallTime);
      this.deck.position.y = -B.streamDepth * t * t;
      this.deck.rotation.x = t * 0.5;
      if (t < 1) return;
      this.down = true;
      this.root.visible = false;
      this.owner.splash(this.mid);
      return;
    }
    // Rebuilt in place after a while: the road opens again.
    if (this.time < B.downTime) return;
    this.owner.closeRoad(this.roadIndex, false);
    this.down = false;
    this.appear();
  }

  protected cleanUp(): void {
    if (this.phase === 'acting') this.owner.closeRoad(this.roadIndex, false);
    this.down = false;
  }

  hide(): void {
    super.hide();
    this.stream.visible = false;
  }
}

/** Every trigger on the map, the blasts between them, and the flying debris. */
export class Triggers {
  readonly group = new Group();
  /** Called whenever a trigger is set off (a shot, a blast, or debug), for the lessons. */
  onSetOffKind: (kind: TriggerKind) => void = () => {};
  /** A keg blew up at this world point (juice: a big ring, a star and a hit stop). */
  onBlast: (world: Vector3) => void = () => {};
  private list: Trigger[] = [];
  private debrisPool: Debris[] = [];
  private nextDebris = 0;
  private cueTimer = 0;

  /** The trigger models, loaded once (place() puts them on each map). */
  private models: {
    keg: ModelTemplate;
    rock: ModelTemplate;
    tree: ModelTemplate;
    hills: ModelTemplate[];
    tower: ModelTemplate[];
    cart: ModelTemplate;
    potion: ModelTemplate;
    bridge: ModelTemplate;
  } | null = null;
  /** v3 2.1: goblins turned into chickens at these board points (the game spawns the chickens). */
  onChickens: (points: Vector3[]) => void = () => {};
  /** v3 2.1: the rare potion cart: seconds until it shows (-1: not this time), and if a battle is on. */
  private cartIn = -1;
  private battleOn = false;

  constructor(
    private board: Object3D,
    public network: RoadNetwork,
    private goblins: Goblins,
    private audio: GameAudio,
    private particles: Particles,
    private rng: Random,
  ) {
    board.add(this.group);
  }

  /**
   * v3 2.8: used traps waiting to come back (seconds left), one at a time
   * (appearWait), each at a free spot of its kind (never its old one).
   */
  private respawns: { kind: TriggerKind; from: Trigger; left: number }[] = [];
  private appearWait = 0;

  /** Loads the models and puts the map's traps on it (the blueprint's and the spare spots, from buildBoard). */
  async load(spots: TriggerPlacement[]): Promise<void> {
    const W = TRIGGERS.bellTower.width;
    const [keg, rock, tree, planks, wood, towerBase, towerMid, towerTop, cart, potion, bridge, ...hills] = await Promise.all([
      loadTemplate('props/survival/barrel.glb', { height: TRIGGERS.keg.height }),
      loadTemplate('rocks/nature/rock_smallH.glb', { width: TRIGGERS.boulder.size }),
      loadTemplate('trees/fantasy-town/tree-crooked.glb', { height: TRIGGERS.tree.height }),
      loadTemplate('props/survival/resource-planks.glb', { width: TRIGGERS.debris.size }),
      loadTemplate('props/survival/resource-wood.glb', { width: TRIGGERS.debris.size }),
      // v3 2.1: the bell tower (castle kit pieces), the potion cart and its potions, the rope bridge.
      loadTemplate('castle/castle-kit/tower-square-base.glb', { width: W }),
      loadTemplate('castle/castle-kit/tower-square-mid.glb', { width: W }),
      loadTemplate('castle/castle-kit/tower-square-mid-open.glb', { width: W }),
      loadTemplate('town/fantasy-town/cart-high.glb', { width: 7 }),
      loadTemplate('props/mini-dungeon/potion.glb', { height: TRIGGERS.cart.potionHeight }),
      loadTemplate('props/nature/bridge_wood.glb', { width: TRIGGERS.bridge.length }),
      ...['A', 'B', 'C', 'D'].map((v) => loadTemplate(`rocks/nature/rock_large${v}.glb`, { width: TRIGGERS.boulder.hillWidth })),
    ]);
    this.models = { keg, rock, tree, hills, tower: [towerBase, towerMid, towerTop], cart, potion, bridge };
    this.place(this.network, spots);
    for (let i = 0; i < TRIGGERS.debris.pool; i++) {
      const object = cloneStatic(i % 2 === 0 ? planks : wood);
      object.visible = false;
      this.group.add(object);
      this.debrisPool.push({ object, alive: false, age: 0, velocity: new Vector3(), spin: 0, bounced: false });
    }
  }

  /**
   * Puts a map's triggers on its roads (after load(); again for each new
   * map, src/game.ts loadMap). The old map's triggers go: unregister their
   * slingshot targets before, register the new ones after.
   */
  place(network: RoadNetwork, spots: TriggerPlacement[]): void {
    const models = this.models;
    if (!models) return;
    this.respawns.length = 0;
    // Everything but the debris pool goes (the triggers, and the boulders' hills).
    const keep = new Set<Object3D>(this.debrisPool.map((d) => d.object));
    for (const child of [...this.group.children]) if (!keep.has(child)) this.group.remove(child);
    this.list = [];
    for (const d of this.debrisPool) {
      d.alive = false;
      d.object.visible = false;
    }
    this.network = network;
    // One trap object per spot, the spares too (hidden until a used trap of their kind comes back there).
    for (const spot of spots) {
      const { road, along } = spot;
      let trigger: Trigger;
      if (spot.kind === 'keg') trigger = new Keg(this, spot.wave, road, along, models.keg);
      else if (spot.kind === 'boulder') trigger = new Boulder(this, spot.wave, road, along, models.rock, this.rng.pick(models.hills));
      else if (spot.kind === 'hay') trigger = new Hay(this, spot.wave, road, along);
      else if (spot.kind === 'bellTower') trigger = new BellTower(this, spot.wave, road, along, models.tower);
      else if (spot.kind === 'cart') trigger = new Cart(this, spot.wave, road, along, models.cart, models.potion);
      else if (spot.kind === 'bridge') trigger = new Bridge(this, spot.wave, road, along, models.bridge);
      else trigger = new Tree(this, spot.wave, road, along, models.tree);
      trigger.spare = spot.spare;
      this.group.add(trigger.root);
      this.list.push(trigger);
    }
  }

  /** The things the slingshot can shoot (register each with slingshot.addTarget). */
  get targets(): SlingTarget[] {
    return this.list;
  }

  /**
   * A new wave (1 based). v3 2.8: a wave never resets the battle: a
   * blueprint trap of this wave or an earlier one that has not stood yet
   * comes out; used ones come back on their own timer at a new spot (see
   * update). `rebuild` (debug) puts every blueprint trap back now instead.
   */
  setWave(wave: number, rebuild = false): void {
    if (rebuild) this.respawns.length = 0;
    // v3 2.1: a battle starts: roll whether the rare potion cart shows this time, and when.
    if (!this.battleOn) {
      this.battleOn = true;
      if (this.extrasOn) this.rollCart(TRIGGERS.cart.firstIn);
      else this.cartIn = -1;
    }
    for (const t of this.list) {
      if (t.spare) {
        if (rebuild) t.hide();
        continue;
      }
      // v3 2.1: the new traps only in battles that may use them (not the tutorial).
      if (!this.extrasOn && EXTRA_KINDS.has(t.kind)) continue;
      if (rebuild || (!t.seenThisBattle && t.hiddenNow)) t.reset(wave);
    }
  }

  /** v3 2.1: the new traps (haystacks, bell tower, bridge, cart) are on in this battle (set by the battle: a loadout battle). */
  extrasOn = false;

  /** Brings every hidden trigger of one kind onto the roads now (its lesson), with a poof. Spare spots stay empty. */
  revealKind(kind: TriggerKind): void {
    for (const t of this.list) if (t.kind === kind && t.hiddenNow && !t.spare) t.reset(Infinity);
  }

  /** v3 2.2: the standing trigger of a kind nearest a board point within `radius` cm (flat), or null (the magnifying glass lights kegs). */
  standingNear(kind: TriggerKind, x: number, z: number, radius: number): Trigger | null {
    let best: Trigger | null = null;
    let bestD = radius;
    for (const t of this.list) {
      // Standing is enough: the glass lights haystacks and the magnet pulls bells, which the slingshot cannot set off.
      if (t.kind !== kind || !t.standing) continue;
      t.center(temp);
      const d = Math.hypot(temp.x - x, temp.z - z);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }

  /** The standing trigger of a kind closest to a board angle (radians, 0 = the board's front), or null. */
  nearestStanding(kind: TriggerKind, angle: number): Trigger | null {
    let best: Trigger | null = null;
    let bestDelta = Infinity;
    for (const t of this.list) {
      if (t.kind !== kind || !t.standing) continue;
      t.center(temp);
      const a = Math.atan2(temp.x, -temp.z);
      let d = Math.abs(a - angle) % (Math.PI * 2);
      if (d > Math.PI) d = Math.PI * 2 - d;
      if (d < bestDelta) {
        bestDelta = d;
        best = t;
      }
    }
    return best;
  }

  /**
   * The standing trigger of a kind closest to a board angle. If none of that
   * kind stands any more (all used), the closest used one is put back first.
   */
  readyNearest(kind: TriggerKind, angle: number): Trigger | null {
    const standing = this.nearestStanding(kind, angle);
    if (standing) return standing;
    let best: Trigger | null = null;
    let bestDelta = Infinity;
    for (const t of this.list) {
      if (t.kind !== kind || !t.resettable) continue;
      t.center(temp);
      let d = Math.abs(Math.atan2(temp.x, -temp.z) - angle) % (Math.PI * 2);
      if (d > Math.PI) d = Math.PI * 2 - d;
      if (d < bestDelta) {
        bestDelta = d;
        best = t;
      }
    }
    best?.reset(Infinity);
    return best;
  }

  /** The top of a trigger in world space (meters), for markers. */
  topWorld(trigger: Trigger, out: Vector3): Vector3 {
    trigger.center(out);
    out.y = trigger.topY();
    return this.board.localToWorld(out);
  }

  /**
   * The trigger lessons: grunts walk along the road to the trigger and wait
   * right in what it does (beside the keg, below the boulder, before the
   * tree) until it is set off, however long that takes. Tops the group up
   * to `count` waiting goblins. Returns how many came.
   */
  baitGroup(trigger: Trigger, count: number): number {
    const { approach } = TRIGGERS.lesson;
    const dir = trigger.towardCastle;
    const road = trigger.roadNumber;
    let waiting = 0;
    for (const g of this.goblins.list) if (g.bait && g.mode !== 'dead') waiting++;
    let sent = 0;
    for (let i = waiting; i < count; i++) {
      const spot = trigger.waitSpot(i);
      const g = this.goblins.spawnBefore('grunt', road, dir, spot.along, approach + i * TRIGGERS.lesson.spacing, spot.lane);
      if (!g) continue;
      g.waitRoad = road;
      g.waitAt = spot.along;
      g.bait = true;
      sent++;
    }
    return sent;
  }

  /** Called by a trigger when it is set off. */
  onSetOff(trigger: Trigger): void {
    // The lesson goblins waiting by it are free to go (or be squashed, or turn back).
    this.goblins.releaseWaiting();
    this.onSetOffKind(trigger.kind);
    // v3 2.8: it comes back at a new spot after a while, during waves too.
    // v3 2.1: the bridge rebuilds itself in place, the bell tower is once per battle, the cart is rare.
    if (trigger.kind === 'cart') this.rollCart(TRIGGERS.cart.againIn);
    if (NO_SPARES.has(trigger.kind)) return;
    this.respawns.push({ kind: trigger.kind, from: trigger, left: TRIGGERS.respawn.delay });
  }

  /** Before the battle, or at its end: every trigger gone, every road open, none waiting to come back. */
  hideAll(): void {
    for (const t of this.list) t.hide();
    this.respawns.length = 0;
    this.appearWait = 0;
    this.battleOn = false;
    this.cartIn = -1;
    this.onClear();
  }

  /** v3 2.1: the board is cleared (the game removes the chickens). */
  onClear: () => void = () => {};

  /** v3 2.1: whether the potion cart shows (TRIGGERS.cart.chance) and when, within `window` seconds. Seeded. */
  private rollCart(window: [number, number]): void {
    const spots = this.list.filter((t) => t.kind === 'cart').length;
    this.cartIn = spots > 0 && this.rng.next() < TRIGGERS.cart.chance ? this.rng.range(window[0], window[1]) : -1;
  }

  /** v3 2.1: the rare cart's timer: it shows at a free spot of its own (no goblins by it), and goes away unused. */
  private updateCart(dt: number): void {
    for (const t of this.list) {
      if (!(t instanceof Cart) || !t.standing) continue;
      t.standLeft -= dt;
      if (t.standLeft > 0) continue;
      t.center(temp);
      t.hide();
      this.poof(temp, 8);
      this.rollCart(TRIGGERS.cart.againIn);
    }
    if (this.cartIn < 0) return;
    this.cartIn -= dt;
    if (this.cartIn > 0) return;
    const free = this.list.filter((t) => t instanceof Cart && t.hiddenNow && !this.goblinsNear(t, TRIGGERS.respawn.goblinClear));
    if (free.length === 0) {
      this.cartIn = TRIGGERS.respawn.retry;
      return;
    }
    this.cartIn = -1;
    const cart = this.rng.pick(free) as Cart;
    mark('trap back');
    cart.appear();
    cart.standLeft = TRIGGERS.cart.standTime;
    cart.center(temp);
    this.audio.play('toolPoof', this.board.localToWorld(world.copy(temp)), 0.9, 0.1);
  }

  /** Debug: the new traps (v3 2.1) stand now, and the potion cart shows at once. */
  showNewTraps(): void {
    this.extrasOn = true;
    for (const t of this.list) if ((t.kind === 'hay' || t.kind === 'bellTower' || t.kind === 'bridge') && !t.spare && !t.standing) t.reset(Infinity);
    this.battleOn = true;
    if (!this.list.some((t) => t instanceof Cart && t.standing)) this.cartIn = 0.01;
  }

  /** v3 2.1: the standing bell tower nearest a board point within `radius` (the magnet pulls its bell). */
  bellTowerNear(x: number, z: number, radius: number): { tower: Trigger; shake: (time: number) => void; bellAt: (out: Vector3) => Vector3 } | null {
    const t = this.standingNear('bellTower', x, z, radius);
    if (!(t instanceof BellTower)) return null;
    return { tower: t, shake: (time) => t.shake(time), bellAt: (out) => t.bellAt(out) };
  }

  /**
   * v3 2.8: the traps waiting to come back, one at a time. A trap comes back
   * at a free spot of its kind picked at random (seeded), never its old spot,
   * never with goblins right by it (it tries again a moment later), and never
   * more of a kind than the map's own count. A poof and a sound show where.
   * Its old spot is cleared (the boulder's hill goes with a poof).
   */
  private updateRespawns(dt: number): void {
    const R = TRIGGERS.respawn;
    this.appearWait = Math.max(0, this.appearWait - dt);
    for (let i = this.respawns.length - 1; i >= 0; i--) {
      const r = this.respawns[i];
      r.left -= dt;
      if (r.left > 0 || this.appearWait > 0) continue;
      // Still doing its thing (a fallen tree blocking its road): wait for it.
      if (r.from.acting) {
        r.left = R.retry;
        continue;
      }
      // As many of a kind as the map has, never more (a lesson may have put one back already).
      const kindCount = this.list.filter((t) => t.kind === r.kind && !t.spare).length;
      const up = this.list.filter((t) => t.kind === r.kind && (t.standing || t.acting)).length;
      if (up >= kindCount) {
        this.respawns.splice(i, 1);
        continue;
      }
      const free = this.list.filter((t) => t.kind === r.kind && t !== r.from && t.resettable && !this.goblinsNear(t, R.goblinClear));
      if (free.length === 0) {
        r.left = R.retry;
        continue;
      }
      const next = this.rng.pick(free);
      mark('trap back');
      // The old spot is cleared (a boulder's hill goes with it), unless something already put it back there.
      if (r.from.resettable && !r.from.hiddenNow) {
        r.from.center(temp);
        r.from.hide();
        this.poof(temp, 6);
      }
      next.appear();
      next.center(temp);
      this.audio.play('toolPoof', this.board.localToWorld(world.copy(temp)), 0.9, 0.1);
      this.respawns.splice(i, 1);
      this.appearWait = R.gap;
    }
  }

  /** True when a goblin on the board is within `radius` cm of a trap's spot. */
  private goblinsNear(t: Trigger, radius: number): boolean {
    t.center(temp2);
    const r2 = radius * radius;
    for (const g of this.goblins.list) {
      if (g.mode === 'dead') continue;
      const p = g.root.position;
      const dx = p.x - temp2.x;
      const dz = p.z - temp2.z;
      if (dx * dx + dz * dz < r2) return true;
    }
    return false;
  }

  /** Debug: sets off every trigger standing now. */
  fireAll(): void {
    for (const t of this.list) t.setOff();
  }

  get standingCount(): number {
    return this.list.filter((t) => t.hittable()).length;
  }

  update(dt: number): void {
    this.cueTimer -= dt;
    if (this.cueTimer <= 0) {
      this.cueTimer = TRIGGERS.cue.checkEvery;
      this.countGoblins();
    }
    for (const t of this.list) t.update(dt);
    this.updateRespawns(dt);
    if (this.battleOn) this.updateCart(dt);
    this.updateDebris(dt);
  }

  /** How many goblins are near each standing trigger, and the "now!" cue when a group is right at one. */
  private countGoblins(): void {
    const { nearRadius, nowRadius, nowCount } = TRIGGERS.cue;
    const near2 = nearRadius * nearRadius;
    const now2 = nowRadius * nowRadius;
    for (const t of this.list) {
      t.near = t.close = 0;
      if (!t.standing) continue;
      t.center(temp);
      for (const g of this.goblins.list) {
        if (!ON_FIELD.has(g.mode)) continue;
        const dx = g.root.position.x - temp.x;
        const dz = g.root.position.z - temp.z;
        const d2 = dx * dx + dz * dz;
        if (d2 > near2) continue;
        t.near++;
        if (d2 <= now2) t.close++;
      }
      if (t.close >= nowCount) t.cueNow();
    }
  }

  // ---- Shared effects (called by the triggers) ----

  /** A blast: goblins in `radius` are knocked out, triggers in `chainRadius` are set off. */
  explode(point: Vector3, radius: number, chainRadius: number, from: Trigger): void {
    // Its own copy: the caller's vector is a shared scratch one, and reading
    // other triggers' centers into it made every keg on the board blow up.
    const at = blastAt.copy(point);
    this.board.localToWorld(world.copy(at));
    this.particles.burst(world, TRIGGERS.keg.fireColors, 26, 0.5);
    this.audio.play('kegBoom', world);
    this.audio.play('debris', world, 0.8);
    this.onBlast(world);
    this.crush(at, radius);
    if (chainRadius <= 0) return;
    for (const t of this.list) {
      if (t === from || !t.chainable) continue;
      t.center(temp2);
      if (temp2.distanceTo(at) < chainRadius) t.setOff();
    }
  }

  /** v3 2.1: every goblin on its feet within `radius` (cm) of the segment a to b is knocked out (the bridge drops). */
  crushAlong(a: Vector3, b: Vector3, radius: number): void {
    const abx = b.x - a.x;
    const abz = b.z - a.z;
    const len2 = abx * abx + abz * abz || 1;
    for (const g of this.goblins.list) {
      if (!this.goblins.isHittable(g) || !ON_FIELD.has(g.mode)) continue;
      const p = g.root.position;
      const t = Math.min(1, Math.max(0, ((p.x - a.x) * abx + (p.z - a.z) * abz) / len2));
      const dx = p.x - (a.x + abx * t);
      const dz = p.z - (a.z + abz * t);
      if (dx * dx + dz * dz > radius * radius) continue;
      this.goblins.worldPosition(g, world);
      this.particles.burst(world, POOF_COLORS, 6, 0.15);
      this.audio.play('poof', world, 0.8, 0.04);
      this.goblins.kill(g, true);
    }
  }

  /** v3 2.1: the potions burst: a purple fizz, and every goblin on its feet within `radius` turns into a chicken. */
  potionBurst(at: Vector3, radius: number): void {
    this.board.localToWorld(world.copy(at));
    this.particles.burst(world, TRIGGERS.cart.fizzColors, 24, 0.3);
    this.audio.play('potionFizz', world);
    const points: Vector3[] = [];
    const r2 = radius * radius;
    for (const g of this.goblins.list) {
      if (!this.goblins.isHittable(g) || !ON_FIELD.has(g.mode)) continue;
      const p = g.root.position;
      if ((p.x - at.x) ** 2 + (p.z - at.z) ** 2 > r2) continue;
      points.push(p.clone());
      this.goblins.worldPosition(g, world);
      this.particles.burst(world, TRIGGERS.cart.fizzColors, 5, 0.1);
      // Its gear falls off with the change.
      this.goblins.disarm(g);
      this.goblins.kill(g, false);
    }
    if (points.length > 0) this.onChickens(points);
  }

  /** v3 2.1: fire on a burning haystack (a few flame particles). */
  flames(at: Vector3, colors: number[]): void {
    this.particles.burst(this.board.localToWorld(world.copy(at)), colors, 3, 0.12);
  }

  burnSound(at: Vector3): void {
    this.audio.play('hayBurn', this.board.localToWorld(world.copy(at)));
  }

  /** v3 2.1: the bell lands on the road. */
  bong(at: Vector3): void {
    this.audio.play('bell', this.board.localToWorld(world.copy(at)), 1);
  }

  /** v3 2.1: the bridge falls into its stream. */
  splash(at: Vector3): void {
    this.board.localToWorld(world.copy(at));
    this.particles.burst(world, [0x6aa8e0, 0xbfe0ff, 0xffffff], 14, 0.25);
    this.audio.play('bridgeSplash', world);
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
      this.goblins.kill(g, true);
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

  sound(name: 'boulderRoll' | 'treeCreak' | 'treeCrash' | 'debris' | 'triggerNow', at: Vector3): void {
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
      // Shrinks away over the last third of its life (the shared despawn look).
      const fade = (d.age / life - 2 / 3) * 3;
      d.object.scale.setScalar(fade <= 0 ? 1 : Math.max(0.001, shrinkAway(fade)));
    }
  }
}
