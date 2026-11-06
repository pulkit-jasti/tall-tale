// The sky (decor only, no gameplay, no interaction):
//   - a gradient dome (meters, world): blue on top, pale at the horizon,
//     with a warm orange and yellow sunrise glow around the sun, strongest
//     low on the horizon,
//   - a low-poly 3D cartoon sun far away, low and a little right of front
//     (meters, world): a faceted ball and pointy pyramid rays around it,
//     turning slowly, with a soft glow,
//   - many small clouds made to the board's scale (cm, in boardLift like the
//     hills): little cotton puffs floating around the giant's head, low ones
//     never over the battlefield, and high ones over the board and the
//     giant, always well above the eyes, so the player feels huge,
//   - a faceted moon with a cool glow, twinkling stars (one mesh of points)
//     and a huge low-poly ringed planet sitting on the horizon straight in
//     front, shown at night.
// None of it turns with the board (comfort rule). The colors, where the sun
// and the moon are and how much they show change with the time of day
// (DAY_NIGHT, src/world/dayNight.ts calls apply()).
//
// Built to cost almost nothing on a Quest 3S: the dome is one draw call, the
// sun three, all the clouds one InstancedMesh, the moon two and the stars
// one (each only while it shows). The dome's colors for each time of day are
// worked out once at the start, so a change only blends two of them. Everything is unlit with its
// shading baked into face or point colors (bright, cartoony, the same in any
// light), and fog is off, so the colors stay as picked.
//
// No flicker: far away the depth buffer cannot tell apart things a few cm or
// meters apart, so overlapping pieces used to fight. None of these pieces
// write depth: each draws in a fixed order (renderOrder), the dome before
// everything, the sun after the board, then the clouds, sorted far to near
// now and then. They still test depth, so the hills and the board in front
// hide them.
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  ConeGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Points,
  PointsMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DAY_NIGHT, SKY, TIMES_OF_DAY, type DayLook, type TimeOfDay } from '../config/game.js';
import type { Random } from '../rules/random.js';
import { groundHeight } from './hills.js';

interface Puff {
  /** Offset from its cloud's middle (cm), and its size. */
  readonly offset: Vector3;
  readonly scale: Vector3;
  /** Its spot right now (boardLift cm), for the far-to-near sort. */
  readonly at: Vector3;
  distance: number;
  /** 1, shrinking to 0 near the edge of the wrap square or over the battlefield. */
  fade: number;
}

interface Cloud {
  /** Middle of the cloud, flat (boardLift cm). A low cloud's height follows the ground below. */
  readonly at: Vector3;
  /** Height above the ground (cm), or above the board for a high cloud. */
  lift: number;
  /** A high cloud over the board and the giant (never fades over the battlefield). */
  readonly high: boolean;
  /** It wraps around inside a square this big (cm from the center). */
  readonly half: number;
  readonly puffs: Puff[];
}

const DEG = Math.PI / 180;
const matrix = new Matrix4();
const scale = new Vector3();
const noTurn = new Quaternion();
const UP = new Vector3(0, 1, 0);
const color = new Color();
const edge = new Color();
const middle = new Color();
const lit = new Color();
const other = new Color();
const a = new Vector3();
const b = new Vector3();
const c = new Vector3();
/** Where the giant's eyes are in boardLift (cm above the board), for the cloud sort. */
const EYES = new Vector3(0, 46, 0);
/** The sun and the moon face this point (the player's head, roughly). */
const FACE_AT = new Vector3(0, 1.2, 0);

/**
 * Draw order of the sky pieces: the dome before everything, then the stars,
 * then after the board and the hills (0) the ringed planet (the rings' far
 * half, the ball, the near half), the sun and the moon, and the clouds last.
 */
const ORDER = { dome: -100, stars: -90, ringBack: 6, planet: 7, ringFront: 8, glow: 10, rays: 11, ball: 12, moonGlow: 13, moon: 14, clouds: 20 };

const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;

/** Blends two hex colors (`t` 0 = from, 1 = to) into `out`. */
function mixHex(from: number, to: number, t: number, out: Color): Color {
  return out.setHex(from).lerp(other.setHex(to), t);
}

/** Direction from the player toward a compass angle (0 = front, positive = right) and height above the horizon (degrees). */
export function skyDirection(angleDeg: number, elevationDeg: number, out: Vector3): Vector3 {
  const az = angleDeg * DEG;
  const el = elevationDeg * DEG;
  return out.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
}

/** An unlit material for sky pieces: exact colors, no fog, never writes depth. */
function skyMaterial(extra: Partial<MeshBasicMaterial> = {}): MeshBasicMaterial {
  const material = new MeshBasicMaterial({ color: 0xffffff, fog: false, depthWrite: false });
  Object.assign(material, extra);
  return material;
}

/** A soft round glow (radial gradient) for behind the sun. */
export function glowTexture(): CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,0.8)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.3)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new CanvasTexture(canvas);
}

/**
 * Bakes one color per face into a non-indexed geometry, from how much each
 * face turns toward a light (in the geometry's own frame).
 */
function bakeFaces(geometry: BufferGeometry, light: Vector3, pick: (facing: number, normal: Vector3) => Color): BufferGeometry {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  const position = flat.getAttribute('position') as BufferAttribute;
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i += 3) {
    a.fromBufferAttribute(position, i);
    b.fromBufferAttribute(position, i + 1);
    c.fromBufferAttribute(position, i + 2);
    const normal = b.sub(a).cross(c.sub(a)).normalize();
    const face = pick(normal.dot(light), normal);
    for (let k = 0; k < 3; k++) colors.set([face.r, face.g, face.b], (i + k) * 3);
  }
  flat.setAttribute('color', new BufferAttribute(colors, 3));
  return flat;
}

/** The sun's three shades, by how much a face turns to the light: dark orange edge, yellow middle, pale lit top. */
function sunShade(facing: number): Color {
  const t = Math.min(1, Math.max(0, facing));
  if (t < 0.55) return color.copy(edge).lerp(middle, t / 0.55);
  return color.copy(middle).lerp(lit, Math.min(1, (t - 0.55) / 0.35));
}

/** Clouds: white on top fading to a light sky blue underneath (never grey), a little brighter on the sun side. */
function puffGeometry(): BufferGeometry {
  const top = new Color(SKY.cloudColor);
  const bottom = new Color(SKY.cloudShade);
  return bakeFaces(new IcosahedronGeometry(1, 1), UP, (up, normal) => {
    const t = Math.min(1, Math.max(0, up * 0.6 + 0.55 + normal.x * 0.08));
    return color.copy(bottom).lerp(top, t);
  });
}

/**
 * The sky dome's colors at one time of day, point by point: the top color,
 * the horizon, a little greyer below it, and the glow around the sun (or the
 * moon when the sun is down): a wide haze and a tight one, strongest low on
 * the horizon.
 */
function domeColors(position: BufferAttribute, look: DayLook): Float32Array {
  const colors = new Float32Array(position.count * 3);
  const top = new Color(look.domeTop);
  const horizon = new Color(look.domeHorizon);
  const below = new Color(look.domeBottom);
  const wide = new Color(look.glowWide);
  const tight = new Color(look.glowTight);
  const [angle, elevation] = look.sunShow >= 0.5 ? look.sunAt : look.moonAt;
  const glowAt = skyDirection(angle, elevation, b);
  for (let i = 0; i < position.count; i++) {
    const dir = a.fromBufferAttribute(position, i).normalize();
    const y = dir.y;
    if (y >= 0) color.copy(horizon).lerp(top, Math.pow(Math.min(1, y / 0.7), 0.7));
    else color.copy(horizon).lerp(below, Math.min(1, -y / 0.15));
    const toGlow = Math.max(0, dir.dot(glowAt));
    const low = SKY.glowHighShare + (1 - SKY.glowHighShare) * Math.pow(1 - Math.min(1, Math.abs(y) / 0.45), 2);
    color.lerp(wide, Math.pow(toGlow, SKY.glowOrangeSpread) * look.glowWideStrength * low);
    color.lerp(tight, Math.pow(toGlow, SKY.glowYellowSpread) * look.glowTightStrength);
    colors.set([color.r, color.g, color.b], i * 3);
  }
  return colors;
}

/**
 * A sky material cut off below the horizon (world height `horizon`), so the
 * ringed planet sinks into it and only its top half shows, whatever is
 * (or is not) in front of it.
 */
function horizonCutMaterial(horizon: { value: number }, extra: Partial<MeshBasicMaterial> = {}): MeshBasicMaterial {
  const material = skyMaterial({ vertexColors: true, ...extra });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.horizonY = horizon;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vSkyY;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvSkyY = (modelMatrix * vec4(transformed, 1.0)).y;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float horizonY;\nvarying float vSkyY;')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vSkyY < horizonY) discard;');
  };
  material.customProgramCacheKey = () => 'horizonCut';
  return material;
}

/**
 * The ringed planet's pieces, low poly with their shading baked in: a
 * faceted ball in wavy bands, and flat rings in bands (split into the far
 * half and the near half, so they draw in order without depth), all shades
 * of one color. A background piece: every color is blended toward the night
 * sky around it, and the light and dark sides stay soft. Tilted so the near
 * half of the rings crosses in front of the ball above its middle, and
 * rolled a little.
 */
function planetGeometry(): { ball: BufferGeometry; back: BufferGeometry; front: BufferGeometry } {
  const r = SKY.planetRadius;
  // From the moon's side (upper right), toward the player.
  const light = new Vector3(0.55, 0.45, 0.7).normalize();
  const base = new Color(SKY.planetColor);
  const warm = new Color(SKY.planetWarm);
  // The night sky a little above the horizon, where the planet sits.
  const sky = new Color(DAY_NIGHT.looks.night.domeHorizon).lerp(new Color(DAY_NIGHT.looks.night.domeTop), 0.35);
  /** The planet's color (with `warmth` of the warm color in it) in one shade, softly lit, blended toward the sky (into `color`). */
  const shade = (amount: number, lit: number, warmth = 0): Color =>
    color.copy(base).lerp(warm, warmth).multiplyScalar(amount * lit).lerp(sky, SKY.planetSkyBlend);
  const bands = SKY.planetBands;
  const ball = bakeFaces(new IcosahedronGeometry(r, 2), light, (facing, normal) => {
    const height = normal.y + 0.1 * Math.sin(normal.x * 5 + normal.z * 3);
    const band = Math.min(bands.length - 1, Math.max(0, Math.floor((0.5 - height * 0.5) * bands.length)));
    return shade(bands[band], 0.62 + 0.38 * Math.max(0, facing), SKY.planetWarmBands[band] ?? 0);
  });
  const segments = 48;
  const inner = r * SKY.planetRingInner;
  const step = (r * SKY.planetRingOuter - inner) / SKY.planetRingBands.length;
  const halves = { back: { at: [] as number[], colors: [] as number[] }, front: { at: [] as number[], colors: [] as number[] } };
  SKY.planetRingBands.forEach((amount, k) => {
    if (!amount) return;
    const r0 = inner + k * step;
    const r1 = r0 + step;
    for (let s = 0; s < segments; s++) {
      const t0 = (s / segments) * Math.PI * 2;
      const t1 = ((s + 1) / segments) * Math.PI * 2;
      // The far half is the side away from the player (before the tilt).
      const half = Math.sin((t0 + t1) / 2) < 0 ? halves.back : halves.front;
      // A little lighter and darker in turn, so the facets read.
      shade(amount, s % 2 === 0 ? 0.95 : 0.85, SKY.planetWarmRings[k] ?? 0);
      const corners: [number, number][] = [
        [r0, t0],
        [r1, t0],
        [r1, t1],
        [r0, t0],
        [r1, t1],
        [r0, t1],
      ];
      for (const [rr, t] of corners) {
        half.at.push(Math.cos(t) * rr, 0, Math.sin(t) * rr);
        half.colors.push(color.r, color.g, color.b);
      }
    }
  });
  const ring = (half: { at: number[]; colors: number[] }): BufferGeometry => {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(half.at), 3));
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(half.colors), 3));
    return geometry;
  };
  const pieces = { ball, back: ring(halves.back), front: ring(halves.front) };
  for (const geometry of Object.values(pieces)) {
    // Seen a little from below: the near half of the rings rises in front of the ball.
    geometry.rotateX(-SKY.planetTiltDeg * DEG);
    geometry.rotateZ(SKY.planetRollDeg * DEG);
  }
  return pieces;
}

/** Stars: points spread evenly over the sky above `starMinElevationDeg`, each a little brighter or dimmer, each twinkling at its own pace. */
function starGeometry(rng: Random): BufferGeometry {
  const n = SKY.starCount;
  const positions = new Float32Array(n * 3);
  const colors = new Float32Array(n * 3);
  /** Each star's twinkle: where in its pulse it starts, and how fast it pulses. */
  const twinkle = new Float32Array(n * 2);
  const r = SKY.domeRadius * 0.95;
  const lowest = Math.sin(SKY.starMinElevationDeg * DEG);
  for (let i = 0; i < n; i++) {
    // Even over the sky: the height (sine of the elevation) is spread evenly.
    const y = rng.range(lowest, 1);
    const flat = Math.sqrt(1 - y * y);
    const az = rng.range(0, Math.PI * 2);
    positions.set([Math.sin(az) * flat * r, y * r, -Math.cos(az) * flat * r], i * 3);
    const shine = rng.range(0.45, 1);
    colors.set([shine, shine, shine], i * 3);
    twinkle.set([rng.range(0, Math.PI * 2), rng.range(...SKY.starTwinkleSpeed)], i * 2);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  geometry.setAttribute('twinkle', new BufferAttribute(twinkle, 2));
  return geometry;
}

export class Sky {
  readonly group = new Group();
  private clouds: Cloud[] = [];
  private allPuffs: Puff[] = [];
  private puffs: InstancedMesh;
  private puffMaterial = skyMaterial({ vertexColors: true });
  private rays!: Mesh;
  private wind = new Vector3();
  private sortTimer = 0;
  private time = 0;
  /** The dome's point colors now, and worked out for each time of day. */
  private domeColor: BufferAttribute;
  private domeLooks = {} as Record<TimeOfDay, Float32Array>;
  private sun = new Group();
  private sunBall = skyMaterial({ vertexColors: true });
  private sunRays = skyMaterial({ vertexColors: true });
  private sunGlow!: MeshBasicMaterial;
  private moon = new Group();
  private moonGlow!: MeshBasicMaterial;
  private stars!: Points;
  private starMaterial!: PointsMaterial;
  /** The soft round glow behind the sun and the moon. */
  private glowMap = glowTexture();
  /** The stars' twinkle clock (seconds), shared with their shader. */
  private starTime = { value: 0 };
  /** The ringed planet, and the world height of the horizon it is cut off at. */
  private planet = new Group();
  private horizonY = { value: 0 };

  /** The dome, the sun, the moon and the stars go in `world` (meters), the clouds in `board` (boardLift, cm). None of them turn. */
  constructor(world: Object3D, board: Object3D, rng: Random) {
    this.group.name = 'sky';
    world.add(this.group);
    const domeGeometry = new SphereGeometry(SKY.domeRadius, 64, 32);
    const position = domeGeometry.getAttribute('position') as BufferAttribute;
    for (const time of TIMES_OF_DAY) this.domeLooks[time] = domeColors(position, DAY_NIGHT.looks[time]);
    this.domeColor = new BufferAttribute(this.domeLooks.morning.slice(), 3);
    domeGeometry.setAttribute('color', this.domeColor);
    const dome = new Mesh(domeGeometry, skyMaterial({ vertexColors: true, side: BackSide }));
    dome.renderOrder = ORDER.dome;
    // It surrounds the camera, so it is always in view.
    dome.frustumCulled = false;
    this.group.add(dome);
    this.buildSun();
    this.buildMoon();
    this.buildPlanet();
    const total = (SKY.cloudCount + SKY.highCloudCount + SKY.canopyCount) * SKY.puffsPerCloud;
    this.puffs = new InstancedMesh(puffGeometry(), this.puffMaterial, total);
    // Spread all around and always moving: skip culling instead of recomputing bounds.
    this.puffs.frustumCulled = false;
    this.puffs.renderOrder = ORDER.clouds;
    board.add(this.puffs);
    for (let i = 0; i < SKY.cloudCount; i++) this.clouds.push(this.lowCloud(rng));
    for (let i = 0; i < SKY.highCloudCount; i++) {
      this.clouds.push(this.highCloud(rng, SKY.highCloudMaxDistance, SKY.highCloudHeight, SKY.highCloudSize));
    }
    // The canopy: always over the giant's head.
    for (let i = 0; i < SKY.canopyCount; i++) {
      this.clouds.push(this.highCloud(rng, SKY.canopyMaxDistance, SKY.canopyHeight, SKY.canopySize));
    }
    // After the clouds, so they keep their places from the same seed.
    this.buildStars(rng);
    const w = SKY.windDeg * DEG;
    this.wind.set(Math.sin(w), 0, -Math.cos(w)).multiplyScalar(SKY.windSpeed);
    this.place(true);
    this.apply('morning', 'morning', 0);
  }

  /**
   * A low-poly 3D cartoon sun: a faceted ball (dark orange at the edge,
   * yellow, pale where the light hits, so it reads round), pointy pyramid
   * rays around it that turn slowly, and a soft warm glow behind.
   */
  private buildSun(): void {
    const r = SKY.sunRadius;
    edge.setHex(SKY.sunEdgeColor);
    middle.setHex(SKY.sunColor);
    lit.setHex(SKY.sunLitColor);
    const sun = this.sun;
    // Light from the upper left, toward the player.
    const light = new Vector3(-0.45, 0.6, 0.65).normalize();
    const ball = new Mesh(bakeFaces(new IcosahedronGeometry(r, 1), light, sunShade), this.sunBall);
    // Pyramid rays, long and short in turn, all in one mesh.
    const rays: BufferGeometry[] = [];
    for (let i = 0; i < SKY.sunRays; i++) {
      const length = r * (i % 2 === 0 ? 0.95 : 0.65);
      const ray = new ConeGeometry(r * 0.26, length, 4).toNonIndexed();
      ray.translate(0, r * 0.9 + length / 2, 0);
      // Tipped a little toward the player, so their sides show.
      ray.rotateX(-0.25);
      ray.rotateZ((i / SKY.sunRays) * Math.PI * 2);
      rays.push(ray);
    }
    const rayColor = new Color(SKY.rayColor);
    const rayGeometry = bakeFaces(mergeGeometries(rays), light, (facing) =>
      color.copy(rayColor).multiplyScalar(0.72 + 0.4 * Math.max(0, facing)),
    );
    this.rays = new Mesh(rayGeometry, this.sunRays);
    // Additive, but kept in the opaque pass so it draws in its renderOrder slot, before the rest.
    this.sunGlow = skyMaterial({ color: new Color(SKY.glowColor), map: this.glowMap, blending: AdditiveBlending, transparent: false });
    const glow = new Mesh(new CircleGeometry(r * SKY.glowShare, 32), this.sunGlow);
    glow.position.z = -r;
    glow.renderOrder = ORDER.glow;
    this.rays.renderOrder = ORDER.rays;
    ball.renderOrder = ORDER.ball;
    sun.add(glow, this.rays, ball);
    this.group.add(sun);
  }

  /** A low-poly moon: a faceted ball, pale with a cool darker edge (so it reads round), and a soft cool glow behind. */
  private buildMoon(): void {
    const r = SKY.moonRadius;
    const pale = new Color(SKY.moonColor);
    const shade = new Color(SKY.moonEdgeColor);
    const light = new Vector3(-0.45, 0.6, 0.65).normalize();
    const ball = new Mesh(
      bakeFaces(new IcosahedronGeometry(r, 1), light, (facing) => color.copy(shade).lerp(pale, Math.min(1, Math.max(0, facing * 0.9 + 0.25)))),
      skyMaterial({ vertexColors: true }),
    );
    this.moonGlow = skyMaterial({ color: new Color(SKY.moonGlowColor), map: this.glowMap, blending: AdditiveBlending, transparent: false });
    const glow = new Mesh(new CircleGeometry(r * SKY.moonGlowShare, 32), this.moonGlow);
    glow.position.z = -r;
    glow.renderOrder = ORDER.moonGlow;
    ball.renderOrder = ORDER.moon;
    this.moon.add(glow, ball);
    this.moon.visible = false;
    this.group.add(this.moon);
  }

  /** The ringed planet (night only): the rings' far half, the ball, the near half, all cut off below the horizon. */
  private buildPlanet(): void {
    const pieces = planetGeometry();
    const ringMaterial = horizonCutMaterial(this.horizonY, { side: DoubleSide });
    const back = new Mesh(pieces.back, ringMaterial);
    const ball = new Mesh(pieces.ball, horizonCutMaterial(this.horizonY));
    const front = new Mesh(pieces.front, ringMaterial);
    back.renderOrder = ORDER.ringBack;
    ball.renderOrder = ORDER.planet;
    front.renderOrder = ORDER.ringFront;
    for (const mesh of [back, ball, front]) mesh.frustumCulled = false;
    this.planet.add(back, ball, front);
    this.planet.scale.set(1, 1, SKY.planetDepth);
    this.planet.visible = false;
    this.group.add(this.planet);
  }

  /** Stars: one mesh of points, added on top of the dome (no transparency), so they draw in their slot and the hills in front hide them. */
  private buildStars(rng: Random): void {
    this.starMaterial = new PointsMaterial({
      size: SKY.starSize,
      sizeAttenuation: false,
      vertexColors: true,
      fog: false,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    // Twinkle: now and then a star quickly dims and shrinks, from one shared clock. Nothing to update per star.
    // Two waves multiplied (one slow) and raised to a power, so the dips are short and uneven, not a steady pulse.
    const time = this.starTime;
    this.starMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.starTime = time;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec2 twinkle;\nuniform float starTime;')
        .replace(
          '#include <color_vertex>',
          [
            '#include <color_vertex>',
            'float twinkleWave = 0.5 + 0.5 * sin(starTime * twinkle.y + twinkle.x);',
            'float twinkleGate = 0.5 + 0.5 * sin(starTime * twinkle.y * 0.27 + twinkle.x * 2.3);',
            'float twinkleDip = pow(twinkleWave * twinkleGate, 3.0);',
            `vColor.rgb *= 1.0 - ${SKY.starTwinkle.toFixed(3)} * twinkleDip;`,
          ].join('\n'),
        )
        .replace('gl_PointSize = size;', `gl_PointSize = size * (1.0 - ${SKY.starTwinkleShrink.toFixed(3)} * twinkleDip);`);
    };
    this.stars = new Points(starGeometry(rng), this.starMaterial);
    this.stars.renderOrder = ORDER.stars;
    this.stars.frustumCulled = false;
    this.stars.visible = false;
    this.group.add(this.stars);
  }

  /** Puts the sun or the moon at a compass angle and height, facing the player, at a size (0 hides it). */
  private placeBody(body: Group, angleDeg: number, elevationDeg: number, size: number): void {
    skyDirection(angleDeg, elevationDeg, body.position).multiplyScalar(SKY.sunDistance);
    // Its +z faces the player.
    matrix.lookAt(FACE_AT, body.position, UP);
    body.quaternion.setFromRotationMatrix(matrix);
    body.scale.setScalar(Math.max(0.001, size));
    body.visible = size > 0.01;
  }

  /**
   * The sky between two times of day (`t` 0 = `from`, 1 = `to`): the dome's
   * colors, where the sun and the moon are and how big, the sun's tint, the
   * stars and the cloud tint. Only called while the time changes.
   */
  apply(from: TimeOfDay, to: TimeOfDay, t: number): void {
    const a0 = DAY_NIGHT.looks[from];
    const a1 = DAY_NIGHT.looks[to];
    const colors = this.domeColor.array as Float32Array;
    const c0 = this.domeLooks[from];
    const c1 = this.domeLooks[to];
    for (let i = 0; i < colors.length; i++) colors[i] = c0[i] + (c1[i] - c0[i]) * t;
    this.domeColor.needsUpdate = true;
    this.placeBody(this.sun, lerp(a0.sunAt[0], a1.sunAt[0], t), lerp(a0.sunAt[1], a1.sunAt[1], t), lerp(a0.sunShow, a1.sunShow, t));
    this.placeBody(this.moon, lerp(a0.moonAt[0], a1.moonAt[0], t), lerp(a0.moonAt[1], a1.moonAt[1], t), lerp(a0.moonShow, a1.moonShow, t));
    const tint = mixHex(a0.sunTint, a1.sunTint, t, color);
    this.sunBall.color.copy(tint);
    this.sunRays.color.copy(tint);
    this.sunGlow.color.setHex(SKY.glowColor).multiply(tint);
    // The planet rises from below the horizon (its middle sits on it at night).
    const rise = lerp(a0.planetAt, a1.planetAt, t);
    skyDirection(SKY.planetAngleDeg, rise, this.planet.position).multiplyScalar(SKY.planetDistance);
    matrix.lookAt(FACE_AT, this.planet.position, UP);
    this.planet.quaternion.setFromRotationMatrix(matrix);
    this.planet.visible = rise > -20;
    const stars = lerp(a0.stars, a1.stars, t);
    this.starMaterial.color.setScalar(stars);
    this.stars.visible = stars > 0.01;
    mixHex(a0.cloudTint, a1.cloudTint, t, this.puffMaterial.color);
  }

  /** A low cloud around the board, never over the battlefield. Small near, bigger far. */
  private lowCloud(rng: Random): Cloud {
    const angle = rng.range(0, Math.PI * 2);
    const d = rng.range(SKY.cloudMinDistance, SKY.cloudMaxDistance);
    const share = (d - SKY.cloudMinDistance) / (SKY.cloudMaxDistance - SKY.cloudMinDistance);
    const at = new Vector3(Math.sin(angle) * d, 0, -Math.cos(angle) * d);
    const lift = SKY.cloudNearHeight + (SKY.cloudFarHeight - SKY.cloudNearHeight) * share + rng.range(-1, 1) * SKY.cloudHeightJitter;
    const size = (SKY.cloudNearSize + (SKY.cloudFarSize - SKY.cloudNearSize) * share) * rng.range(0.75, 1.25);
    return this.makeCloud(rng, at, Math.max(12, lift), size, false, SKY.cloudMaxDistance);
  }

  /** A high cloud over the board and the giant, spread evenly over its square (`half`, cm), always well above the eyes. */
  private highCloud(rng: Random, half: number, height: [number, number], size: [number, number]): Cloud {
    const angle = rng.range(0, Math.PI * 2);
    const d = Math.sqrt(rng.range(0, 1)) * half;
    const at = new Vector3(Math.sin(angle) * d, 0, -Math.cos(angle) * d);
    return this.makeCloud(rng, at, rng.range(...height), rng.range(...size), true, half);
  }

  /** A cloud: a few round puffs side by side, the middle ones bigger and higher, turned to a random direction. */
  private makeCloud(rng: Random, at: Vector3, lift: number, size: number, high: boolean, half: number): Cloud {
    const yaw = rng.range(0, Math.PI * 2);
    const puffs: Puff[] = [];
    const n = SKY.puffsPerCloud;
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1) - 0.5) * size;
      const mid = 1 - Math.abs(i / (n - 1) - 0.5) * 1.1;
      const pr = size * 0.24 * mid * rng.range(0.85, 1.2);
      const offset = new Vector3(x, pr * 0.45 * mid + rng.range(-0.1, 0.1) * pr, rng.range(-0.18, 0.18) * size);
      offset.applyAxisAngle(UP, yaw);
      // Round and a little flat at the bottom.
      const puff: Puff = { offset, scale: new Vector3(pr * 1.1, pr * 0.8, pr * 1.1), at: new Vector3(), distance: 0, fade: 1 };
      puffs.push(puff);
      this.allPuffs.push(puff);
    }
    return { at, lift, high, half, puffs };
  }

  /** Every frame: the clouds drift with the wind and wrap around. The sun's rays turn slowly. */
  update(dt: number): void {
    this.time += dt;
    this.rays.rotation.z = this.time * SKY.raySpin * DEG;
    // Kept small, so the shader's sine stays precise.
    this.starTime.value = this.time % 3600;
    // The horizon is level with the sky's middle (the player's seat), which moves when the board is placed.
    this.horizonY.value = this.group.matrixWorld.elements[13];
    for (const cloud of this.clouds) {
      const half = cloud.half;
      cloud.at.addScaledVector(this.wind, dt);
      if (cloud.at.x > half) cloud.at.x -= half * 2;
      else if (cloud.at.x < -half) cloud.at.x += half * 2;
      if (cloud.at.z > half) cloud.at.z -= half * 2;
      else if (cloud.at.z < -half) cloud.at.z += half * 2;
    }
    // The far-to-near order changes slowly, so it is sorted only now and then.
    this.sortTimer -= dt;
    const sort = this.sortTimer <= 0;
    if (sort) this.sortTimer = SKY.sortEvery;
    this.place(sort);
  }

  private place(sort: boolean): void {
    for (const cloud of this.clouds) {
      const r = Math.hypot(cloud.at.x, cloud.at.z);
      // Shrinks away near the edge of the wrap square (never pops), and a low one over the battlefield (never in the way).
      const wrap = Math.max(Math.abs(cloud.at.x), Math.abs(cloud.at.z)) / cloud.half;
      const fadeEdge = Math.min(1, (1 - wrap) / 0.12);
      const fadeMiddle = cloud.high ? 1 : Math.min(1, Math.max(0, (r - SKY.clearFrom) / (SKY.clearTo - SKY.clearFrom)));
      const fade = Math.max(0.001, Math.min(fadeEdge, fadeMiddle));
      // A high cloud keeps its height over the board, a low one follows the ground.
      const y = cloud.high ? cloud.lift : groundHeight(r) + cloud.lift;
      for (const puff of cloud.puffs) {
        puff.at.set(cloud.at.x + puff.offset.x, y + puff.offset.y, cloud.at.z + puff.offset.z);
        puff.distance = puff.at.distanceToSquared(EYES);
        puff.fade = fade;
      }
    }
    // Far puffs first, so nearer ones paint over them.
    if (sort) this.allPuffs.sort((p, q) => q.distance - p.distance);
    for (let i = 0; i < this.allPuffs.length; i++) {
      const puff = this.allPuffs[i];
      scale.copy(puff.scale).multiplyScalar(puff.fade);
      this.puffs.setMatrixAt(i, matrix.compose(puff.at, noTurn, scale));
    }
    this.puffs.instanceMatrix.needsUpdate = true;
  }
}
