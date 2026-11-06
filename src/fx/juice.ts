// Juice (build step 8): small, cheap effects so every action feels good.
//
// - Shock rings: flat rings that spread out and fade where something hits
//   (knockouts, swats, keg blasts, balloon pops, helmets flying off).
// - Pow stars: a comic burst star that pops up facing the player and fades
//   (every knockout), bigger for big hits.
// - Food pops: "+1" / "+2" rising from the food jar when a goblin is eaten.
// - Confetti: paper scraps flutter down over the castle when a wave is won,
//   and a little fireworks show of bursts when the battle is won.
// - Hit stop: the battle slows to a crawl for a few hundredths of a second on
//   a big hit (three knockouts at once, a keg, a balloon). Only the units
//   slow down, never the board, the view or the hands (comfort).
//
// Performance: every effect is one pooled instanced mesh (rings, stars,
// confetti: 3 draw calls, only while something shows) plus a few sprites
// for the food pops. Fading uses a per-instance alpha added to the basic
// material's shader. No lights, no post processing. World space (meters).
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  Quaternion,
  RingGeometry,
  Shape,
  ShapeGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
  type BufferGeometry,
  type CanvasTexture,
} from 'three';
import { JUICE, RENDER_ORDER } from '../config/game.js';
import { mark } from '../debug/perfMarks.js';
import { canvasTexture, drawOutlined } from '../ui/kit/index.js';
import type { Random } from '../rules/random.js';
import { popIn } from './ease.js';

const matrix = new Matrix4();
const quaternion = new Quaternion();
const scale = new Vector3();
const temp = new Vector3();
const toHead = new Vector3();
const color = new Color();
const hidden = new Matrix4().makeScale(0, 0, 0);
const UP = new Vector3(0, 1, 0);
const FRONT = new Vector3(0, 0, 1);

/** A basic material whose instances each have their own alpha (attribute `instanceAlpha`). */
function alphaMaterial(additive: boolean): MeshBasicMaterial {
  const material = new MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    fog: false,
    blending: additive ? AdditiveBlending : undefined,
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float instanceAlpha;\nvarying float vInstanceAlpha;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvInstanceAlpha = instanceAlpha;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vInstanceAlpha;')
      .replace('#include <opaque_fragment>', '#include <opaque_fragment>\ngl_FragColor.a *= vInstanceAlpha;');
  };
  return material;
}

interface Item {
  alive: boolean;
  age: number;
  life: number;
  size: number;
  readonly position: Vector3;
  readonly velocity: Vector3;
  /** Rings: lying flat (0) or facing the player (1). Confetti: spin. */
  spin: number;
  readonly axis: Vector3;
}

/** A pool of instances of one shape, each with its own matrix, color and alpha. */
class Pool {
  readonly items: Item[] = [];
  readonly mesh: InstancedMesh;
  private alpha: InstancedBufferAttribute;
  private next = 0;
  private shown = false;

  constructor(parent: Object3D, geometry: BufferGeometry, size: number, additive: boolean, renderOrder: number) {
    this.alpha = new InstancedBufferAttribute(new Float32Array(size), 1);
    geometry.setAttribute('instanceAlpha', this.alpha);
    this.mesh = new InstancedMesh(geometry, alphaMaterial(additive), size);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = renderOrder;
    this.mesh.visible = false;
    for (let i = 0; i < size; i++) {
      this.mesh.setMatrixAt(i, hidden);
      this.mesh.setColorAt(i, color.setRGB(1, 1, 1));
      this.items.push({ alive: false, age: 0, life: 1, size: 1, position: new Vector3(), velocity: new Vector3(), spin: 0, axis: new Vector3(0, 1, 0) });
    }
    parent.add(this.mesh);
  }

  take(at: Vector3, life: number, size: number, hex: number): Item {
    const i = this.next;
    this.next = (this.next + 1) % this.items.length;
    const item = this.items[i];
    item.alive = true;
    item.age = 0;
    item.life = life;
    item.size = size;
    item.position.copy(at);
    item.velocity.set(0, 0, 0);
    item.spin = 0;
    this.mesh.setColorAt(i, color.setHex(hex));
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    return item;
  }

  /** Runs `place` for each live item (it sets matrix and returns the alpha), hides the finished ones. */
  update(dt: number, place: (item: Item, t: number, out: Matrix4) => number): void {
    let any = false;
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      if (!item.alive) continue;
      item.age += dt;
      const t = item.age / item.life;
      if (t >= 1) {
        item.alive = false;
        this.mesh.setMatrixAt(i, hidden);
        this.alpha.setX(i, 0);
        any = true;
        continue;
      }
      any = true;
      this.alpha.setX(i, place(item, t, matrix));
      this.mesh.setMatrixAt(i, matrix);
    }
    if (any || this.shown) {
      this.mesh.instanceMatrix.needsUpdate = true;
      this.alpha.needsUpdate = true;
    }
    this.shown = any;
    this.mesh.visible = any;
  }

  clear(): void {
    for (let i = 0; i < this.items.length; i++) {
      this.items[i].alive = false;
      this.mesh.setMatrixAt(i, hidden);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.visible = false;
  }
}

/** A comic burst star: 8 points, long and short in turn. */
function starGeometry(): ShapeGeometry {
  const shape = new Shape();
  const points = 16;
  for (let k = 0; k <= points; k++) {
    const a = (k / points) * Math.PI * 2;
    const r = k % 2 === 0 ? 0.5 : 0.24 + (k % 4 === 1 ? 0.04 : 0);
    const x = Math.sin(a) * r;
    const y = Math.cos(a) * r;
    if (k === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  return new ShapeGeometry(shape);
}

/** A "+1" style label drawn once into a texture. */
function labelTexture(text: string, fill: string): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  drawOutlined(canvas.getContext('2d')!, text, 128, 68, 96, fill, 14 / 96, '#4a2c14');
  return canvasTexture(canvas);
}

interface Label {
  sprite: Sprite;
  age: number;
  readonly from: Vector3;
}

export type LabelName = '+1' | '+2' | '+3' | 'full';

export class Juice {
  private rings: Pool;
  private stars: Pool;
  private confetti: Pool;
  private labels: Label[] = [];
  private labelTextures = new Map<LabelName, CanvasTexture>();
  private nextLabel = 0;
  private head = new Vector3();
  /** Knockouts this frame (several at once is a big hit). */
  private frameKnockouts = 0;
  private readonly lastKnockout = new Vector3();
  /** Hit stop left (seconds). */
  private stopLeft = 0;
  /** The fireworks show after a win: bursts left and time to the next. */
  private fireworks = 0;
  private fireworkTimer = 0;
  private readonly showCenter = new Vector3();
  private showScale = 1;

  constructor(
    parent: Object3D,
    private rng: Random,
  ) {
    const ring = new RingGeometry(0.4, 0.5, 24);
    this.rings = new Pool(parent, ring, JUICE.ringPool, true, 5);
    this.stars = new Pool(parent, starGeometry(), JUICE.starPool, false, 6);
    const scrap = new PlaneGeometry(1, 0.6);
    this.confetti = new Pool(parent, scrap, JUICE.confettiPool, false, 4);
    // Confetti is opaque paper: no additive glow, but still fades at the end.
    const labelNames: [LabelName, string, string][] = [
      ['+1', '+1', '#ffe08a'],
      ['+2', '+2', '#ffc04a'],
      ['+3', '+3', '#ffa83a'],
      ['full', 'Full!', '#fff4e0'],
    ];
    for (const [name, text, fill] of labelNames) this.labelTextures.set(name, labelTexture(text, fill));
    for (let i = 0; i < JUICE.labelPool; i++) {
      const sprite = new Sprite(new SpriteMaterial({ map: this.labelTextures.get('+1'), transparent: true, depthWrite: false, depthTest: false, fog: false }));
      sprite.visible = false;
      sprite.renderOrder = RENDER_ORDER.labels;
      parent.add(sprite);
      this.labels.push({ sprite, age: -1, from: new Vector3() });
    }
  }

  /** Units slow down to this share while a hit stop runs (1 = normal). */
  get timeScale(): number {
    return this.stopLeft > 0 ? JUICE.hitStopScale : 1;
  }

  /** A short freeze of the battle on a big hit. */
  hitStop(seconds: number = JUICE.hitStopTime): void {
    this.stopLeft = Math.max(this.stopLeft, seconds);
  }

  /** A flat shock ring where something hit (world point, meters). `upright`: facing the player instead of lying flat. */
  ring(at: Vector3, size: number, hex: number = JUICE.ringColor, upright = false): void {
    mark('juice');
    const item = this.rings.take(at, JUICE.ringTime * (0.7 + size * 2), size, hex);
    item.spin = upright ? 1 : 0;
  }

  /** A comic pow star facing the player. */
  pow(at: Vector3, size: number, hex: number = JUICE.starColor): void {
    mark('juice');
    const item = this.stars.take(at, JUICE.starTime, size, hex);
    item.spin = this.rng.range(-0.6, 0.6);
  }

  /** A goblin was knocked out (world point of its middle): a small star and ring. Several in one frame make a big hit. */
  knockout(at: Vector3, scale = 1): void {
    this.pow(temp.copy(at).addScaledVector(UP, 0.01 * scale), JUICE.knockoutStar * scale, this.rng.pick(JUICE.starColors));
    this.ring(at, JUICE.knockoutRing * scale);
    this.frameKnockouts++;
    this.lastKnockout.copy(at);
  }

  /** A big blast (keg, goblin shot, balloon pop): a big ring, a big star and a hit stop. */
  blast(at: Vector3, scale = 1): void {
    this.ring(at, JUICE.blastRing * scale, JUICE.blastColor);
    this.ring(at, JUICE.blastRing * scale * 0.6, JUICE.ringColor, true);
    this.pow(at, JUICE.blastStar * scale, JUICE.blastColor);
    this.hitStop();
  }

  /** "+1", "+2"... rising from a world point (the food jar). */
  label(name: LabelName, at: Vector3, boardScale = 1): void {
    const label = this.labels[this.nextLabel];
    this.nextLabel = (this.nextLabel + 1) % this.labels.length;
    const material = label.sprite.material as SpriteMaterial;
    material.map = this.labelTextures.get(name) ?? null;
    material.needsUpdate = true;
    label.from.copy(at);
    label.age = 0;
    label.sprite.visible = true;
    label.sprite.userData.scale = boardScale;
  }

  /**
   * A wave is won: confetti over the castle (world center of the board and
   * its scale). `won`: the battle is won, so a fireworks show follows.
   */
  celebrate(won: boolean, center: Vector3 = this.showCenter, boardScale = this.showScale): void {
    this.showCenter.copy(center);
    this.showScale = boardScale;
    const count = won ? JUICE.confettiWin : JUICE.confettiWave;
    for (let i = 0; i < count; i++) this.scrap(center, boardScale);
    if (won) {
      this.fireworks = JUICE.fireworkCount;
      this.fireworkTimer = 0.3;
    }
  }

  /** The board's middle (world) and size, for the celebrations. */
  setStage(center: Vector3, boardScale: number): void {
    this.showCenter.copy(center);
    this.showScale = boardScale;
  }

  private scrap(center: Vector3, boardScale: number): void {
    const a = this.rng.range(0, Math.PI * 2);
    const r = this.rng.range(JUICE.confettiFrom, JUICE.confettiTo) * boardScale;
    temp.set(center.x + Math.sin(a) * r, center.y + this.rng.range(0.25, 0.5) * boardScale, center.z - Math.cos(a) * r);
    const item = this.confetti.take(temp, this.rng.range(2.2, 3.4), JUICE.confettiSize * boardScale, this.rng.pick(JUICE.confettiColors));
    item.velocity.set(this.rng.range(-0.08, 0.08), this.rng.range(0.15, 0.6), this.rng.range(-0.08, 0.08));
    item.axis.set(this.rng.range(-1, 1), this.rng.range(-1, 1), this.rng.range(-1, 1)).normalize();
    item.spin = this.rng.range(4, 9);
  }

  /** One firework: a burst of stars and an upright ring high over the board. */
  private firework(): void {
    const a = this.rng.range(-1.2, 1.2);
    const r = this.rng.range(0.5, 1.2) * this.showScale;
    temp.set(this.showCenter.x + Math.sin(a) * r, this.showCenter.y + this.rng.range(0.45, 0.8) * this.showScale, this.showCenter.z - Math.cos(a) * r);
    const hex = this.rng.pick(JUICE.confettiColors);
    this.ring(temp, JUICE.fireworkRing * this.showScale, hex, true);
    this.pow(temp, JUICE.fireworkStar * this.showScale, hex);
    for (let i = 0; i < 6; i++) {
      const item = this.confetti.take(temp, this.rng.range(1.2, 1.8), JUICE.confettiSize * this.showScale, hex);
      item.velocity.set(this.rng.range(-0.5, 0.5), this.rng.range(-0.1, 0.6), this.rng.range(-0.5, 0.5));
      item.axis.set(this.rng.range(-1, 1), 1, this.rng.range(-1, 1)).normalize();
      item.spin = 8;
    }
  }

  clear(): void {
    this.rings.clear();
    this.stars.clear();
    this.confetti.clear();
    for (const l of this.labels) {
      l.age = -1;
      l.sprite.visible = false;
    }
    this.fireworks = 0;
    this.stopLeft = 0;
  }

  /** Every frame, with the real frame time (not slowed by the hit stop) and the head's world position. */
  update(dt: number, head: Vector3): void {
    this.head.copy(head);
    // Three or more knockouts in one frame: a big hit.
    if (this.frameKnockouts >= JUICE.multiKill) this.blast(this.lastKnockout, 0.8);
    this.frameKnockouts = 0;
    if (this.stopLeft > 0) this.stopLeft -= dt;
    if (this.fireworks > 0) {
      this.fireworkTimer -= dt;
      if (this.fireworkTimer <= 0) {
        this.fireworkTimer = this.rng.range(0.25, 0.55);
        this.fireworks--;
        this.firework();
      }
    }
    this.rings.update(dt, (item, t, out) => {
      // Spreads fast, then slows: ease out.
      const s = item.size * (0.25 + 0.75 * (1 - (1 - t) * (1 - t)));
      if (item.spin > 0) {
        toHead.subVectors(this.head, item.position).normalize();
        quaternion.setFromUnitVectors(FRONT, toHead);
      } else {
        quaternion.setFromAxisAngle(temp.set(1, 0, 0), -Math.PI / 2);
      }
      out.compose(item.position, quaternion, scale.set(s, s, s));
      return (1 - t) * JUICE.ringOpacity;
    });
    this.stars.update(dt, (item, t, out) => {
      // Pops in big, settles, then shrinks and fades: a comic "pow".
      const s = item.size * (t < 0.35 ? popIn(t / 0.35) : 1 - (t - 0.35) * 0.5);
      toHead.subVectors(this.head, item.position).normalize();
      quaternion.setFromUnitVectors(FRONT, toHead);
      quaternion.multiply(temp2q.setFromAxisAngle(FRONT, item.spin + t * 1.5));
      out.compose(item.position, quaternion, scale.set(s, s, s));
      return t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
    });
    this.confetti.update(dt, (item, t, out) => {
      // Flutters down: gravity against a lot of air drag, spinning.
      item.velocity.y -= 0.5 * dt;
      item.velocity.multiplyScalar(1 - Math.min(1, 2.2 * dt));
      item.velocity.y = Math.max(item.velocity.y, -0.12);
      item.position.addScaledVector(item.velocity, dt);
      item.position.x += Math.sin(item.age * 3 + item.spin) * 0.02 * dt;
      quaternion.setFromAxisAngle(item.axis, item.age * item.spin);
      out.compose(item.position, quaternion, scale.setScalar(item.size));
      return t < 0.8 ? 1 : 1 - (t - 0.8) / 0.2;
    });
    for (const l of this.labels) {
      if (l.age < 0) continue;
      l.age += dt;
      const t = l.age / JUICE.labelTime;
      if (t >= 1) {
        l.age = -1;
        l.sprite.visible = false;
        continue;
      }
      const k = (l.sprite.userData.scale as number) ?? 1;
      l.sprite.position.copy(l.from).addScaledVector(UP, (0.02 + t * JUICE.labelRise) * k);
      const s = JUICE.labelSize * k * (t < 0.25 ? popIn(t / 0.25) : 1);
      l.sprite.scale.set(s, s * 0.5, 1);
      (l.sprite.material as SpriteMaterial).opacity = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
    }
  }
}

const temp2q = new Quaternion();
