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
// Easy to notice (build step 6): every trigger carries the same red "danger
// paint", like the keg's red bands, and nothing else on the board is that
// red: a red stripe painted round the boulder, a red and white forester's
// band on the tree's trunk (and the tree itself is the only autumn tree, in
// orange and red leaves). They stand on flat ground with a clear view from
// the seat. While goblins are near one it glows softly (emissive only), and
// a group walking right past one gives a short "now!" cue (a stronger pulse
// and a sound). No floating UI: only things that belong in the world.
//
// One rule for chain reactions: explosions set off the triggers near them.
// All motion is simple math, no physics engine. Board units (cm), in boardSpin.
import {
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  TorusGeometry,
  Vector3,
  type Texture,
} from 'three';
import type { GameAudio } from '../audio/sound.js';
import { mark } from '../debug/perfMarks.js';
import { GOBLIN_RULES, ROADS, TRIGGERS } from '../config/game.js';
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
    return { kind: spot.kind, wave: spot.wave, road, along, x: temp.x, z: temp.z };
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

const autumnCache = new Map<Texture, Texture>();

/**
 * The same color map with every green turned to autumn orange and red, so
 * the trigger tree is the only autumn tree on the board. Made once per map.
 */
function autumnTexture(source: Texture): Texture {
  const cached = autumnCache.get(source);
  if (cached) return cached;
  const image = source.image as CanvasImageSource & { width: number; height: number };
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const c = canvas.getContext('2d')!;
  c.drawImage(image, 0, 0);
  const pixels = c.getImageData(0, 0, canvas.width, canvas.height);
  const d = pixels.data;
  const [r1, g1, b1] = TRIGGERS.tree.autumn;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    // Leaves: green clearly above red and blue. Bark and everything else stay.
    if (g <= r * 1.05 || g <= b) continue;
    const light = (r + g + b) / (3 * 255);
    d[i] = Math.min(255, r1 * (0.55 + light));
    d[i + 1] = Math.min(255, g1 * (0.55 + light));
    d[i + 2] = Math.min(255, b1 * (0.55 + light));
  }
  c.putImageData(pixels, 0, 0);
  const texture = new CanvasTexture(canvas);
  texture.flipY = source.flipY;
  texture.colorSpace = source.colorSpace;
  texture.magFilter = source.magFilter;
  texture.minFilter = source.minFilter;
  texture.wrapS = source.wrapS;
  texture.wrapT = source.wrapT;
  texture.channel = source.channel;
  autumnCache.set(source, texture);
  return texture;
}

/** The trunk's middle and radius at a height (model space, cm), measured from the model's own points. */
function trunkAt(model: Object3D, from: number, to: number): { x: number; z: number; r: number } {
  model.updateMatrixWorld(true);
  const points: Vector3[] = [];
  model.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const position = mesh.geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) {
      const v = new Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
      if (v.y >= from && v.y <= to) points.push(v);
    }
  });
  if (points.length === 0) return { x: 0, z: 0, r: 0.8 };
  let x = 0;
  let z = 0;
  for (const v of points) {
    x += v.x;
    z += v.z;
  }
  x /= points.length;
  z /= points.length;
  let r = 0;
  for (const v of points) r = Math.max(r, Math.hypot(v.x - x, v.z - z));
  return { x, z, r: Math.min(r, 2) };
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
    // Pale stone with a green top, unlike the orange rocks around, and a red stripe painted round its middle.
    for (const m of this.materials) m.color.setHex(m.name === 'grass' ? TRIGGERS.boulder.mossColor : TRIGGERS.boulder.stoneColor);
    // The rock's origin is its bottom: lift it so it turns around its middle.
    this.rock.position.y = -size / 2;
    const pivot = new Group();
    pivot.add(this.rock);
    const paint = paintMaterial(TRIGGERS.paint);
    const stripe = new Mesh(new TorusGeometry((Math.min(rock.size.x, rock.size.z) / 2) * 0.93, TRIGGERS.boulder.stripe, 6, 18), paint);
    stripe.rotation.x = Math.PI / 2;
    stripe.position.y = -size / 2 + rock.size.y * 0.5;
    pivot.add(stripe);
    this.materials.push(paint);
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
    // The only autumn tree on the board: its leaves orange and red.
    for (const m of this.materials) {
      try {
        if (m.map) m.map = autumnTexture(m.map);
      } catch {
        // A map that cannot be read back (a compressed texture): tint the whole tree warm instead.
        m.color.multiply(new Color(1.35, 0.8, 0.45));
      }
    }
    // A forester's mark painted round the trunk: a red band with a white one above.
    const h = template.size.y;
    const { bandFrom, bandRed, bandWhite } = TRIGGERS.tree;
    const trunk = trunkAt(model, h * bandFrom, h * (bandFrom + bandRed + bandWhite));
    const red = paintMaterial(TRIGGERS.paint);
    const white = paintMaterial(TRIGGERS.paintWhite);
    const band = (height: number, y: number, material: MeshStandardMaterial): void => {
      const ring = new Mesh(new CylinderGeometry(trunk.r * 1.12 + 0.05, trunk.r * 1.12 + 0.05, height, 10, 1, true), material);
      ring.position.set(trunk.x, y + height / 2, trunk.z);
      model.add(ring);
    };
    band(h * bandRed, h * bandFrom, red);
    band(h * bandWhite, h * (bandFrom + bandRed), white);
    this.materials.push(red, white);
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
  /** Called whenever a trigger is set off (a shot, a blast, or debug), for the lessons. */
  onSetOffKind: (kind: TriggerKind) => void = () => {};
  private list: Trigger[] = [];
  private debrisPool: Debris[] = [];
  private nextDebris = 0;
  private cueTimer = 0;

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
    for (const spot of placeTriggers(this.network, spots)) {
      const { road, along } = spot;
      let trigger: Trigger;
      if (spot.kind === 'keg') trigger = new Keg(this, spot.wave, road, along, keg);
      else if (spot.kind === 'boulder') trigger = new Boulder(this, spot.wave, road, along, rock, this.rng.pick(hills));
      else trigger = new Tree(this, spot.wave, road, along, tree);
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

  /** Brings every hidden trigger of one kind onto the roads now (its lesson), with a poof. */
  revealKind(kind: TriggerKind): void {
    for (const t of this.list) if (t.kind === kind && t.hiddenNow) t.reset(Infinity);
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
    this.cueTimer -= dt;
    if (this.cueTimer <= 0) {
      this.cueTimer = TRIGGERS.cue.checkEvery;
      this.countGoblins();
    }
    for (const t of this.list) t.update(dt);
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
      // Shrinks away over the last third of its life.
      const left = 1 - d.age / life;
      d.object.scale.setScalar(Math.min(1, left * 3));
    }
  }
}
