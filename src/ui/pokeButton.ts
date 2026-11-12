// The one round button used everywhere (Next, Play, Play again, later the
// pause panel), poked with the index finger (docs/controls-and-ui.md). Same
// look for all: a green cap raised in a dark rim, with a crisp icon on its
// face. Only the size and icon change, through the options. The cap follows
// the fingertip in, clicks when it reaches the bottom, and springs back when
// the finger leaves, so a press can be seen and felt without haptics. Its
// face points along the group's local +z. Sizes are in the parent's units
// (cm in the rigs).
import {
  CircleGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Shape,
  Vector3,
  type CanvasTexture,
  type MeshStandardMaterial,
} from 'three';
import type { GameAudio } from '../audio/sound.js';
import { BUTTON_SIZE, POKE } from '../config/game.js';
import { applyTouchState, type TouchState } from '../player/feedback.js';
import type { HandState } from '../player/hands.js';
import { flatMaterial } from '../world/shapes.js';
import { canvasTexture } from './kit/canvas.js';
import { changeTouch, type Control } from './kit/controls.js';
import { buttonIconCanvas, type ButtonIcon } from './uiImages.js';

export interface ButtonOptions {
  /** Cap radius (a box button ignores it). */
  radius: number;
  /** Cap thickness. Defaults to POKE.depthShare of the radius. */
  depth?: number;
  icon: ButtonIcon;
  /**
   * A bordered rectangle instead of a round cap, with this picture on its
   * face (the Fight button only, src/ui/kit/fightButton.ts; every other
   * button is round). Same poke, looks and sounds.
   */
  box?: {
    width: number;
    height: number;
    face: CanvasTexture;
    /** The face over the whole cap (a text field: white to the edge inside its dark border, headset test 2026-11-11). */
    plain?: boolean;
  };
}

/** A rounded rectangle, w by h, centered, corners `r`. */
function roundedRect(w: number, h: number, r: number): Shape {
  const s = new Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** A slab of a rounded rectangle, from z 0 to `depth`, its face toward +z. */
function slab(w: number, h: number, r: number, depth: number): ExtrudeGeometry {
  return new ExtrudeGeometry(roundedRect(w, h, r), { depth, bevelEnabled: false, curveSegments: 4 });
}

const local = new Vector3();

/** The dark rim's height: POKE.rimHeight of the cap's depth (20% taller after the headset test, 2026-11-11). */
function rimDepthFor(capDepth: number): number {
  return capDepth * POKE.rimHeight;
}

/**
 * How far the cap may sink: it stops with its face just over the rim's top,
 * so it never disappears inside the rim and only the dark rim shows
 * (headset test 2026-11-11: it did, at a deep push). Pushed in, the cap
 * sits from `travel - press` to that plus its depth.
 */
function pressMaxFor(capDepth: number): number {
  return Math.max(0, POKE.travel + capDepth - rimDepthFor(capDepth) - POKE.capAboveRim);
}

export class PokeButton implements Control {
  /** Place and turn this group. Its +z is the button's face. */
  readonly group = new Group();
  private cap = new Group();
  private material: MeshStandardMaterial;
  private faceMaterial: MeshBasicMaterial;
  private icon: ButtonIcon;
  private radius: number;
  /** A box button's half width and half height (null for a round one). */
  private half: { x: number; y: number } | null = null;
  private depth: number;
  /** A poke on it while locked (it buzzed): for a hint on why (the Fight button's empty slots). */
  onRefuse: () => void = () => {};
  /** Locked: it goes down and buzzes, but never clicks (a locked Fight). The caller greys it with setColor. */
  locked = false;
  private touch: TouchState = 'idle';
  /** The finger came from the front, so pushing in counts. */
  private armed = false;
  /** Fired this push. It fires again only after the finger leaves. */
  private fired = false;
  /** How far the cap is pushed in (0 to POKE.travel), and how far it may show it (pressMaxFor: never inside the rim). */
  private press = 0;
  private pressMax = POKE.travel;
  /** No new press until this runs out (seconds): after a click, or a lock. */
  private cooldown = 0;
  /** Each hand's fingertip depth in front of the face last frame (while over the button), to catch quick pokes. */
  private lastZ = new Map<HandState, number>();
  /** Blinks while idle, to catch the eye (see setBlink). */
  private blink: { color: number; intensity: number; speed: number } | null = null;
  private blinkTime = 0;

  constructor(
    private audio: GameAudio,
    options: ButtonOptions,
  ) {
    const { segments, travel } = POKE;
    if (options.box) {
      // The same parts as the round button (a dark rim border, a cap that sinks, a face), as rounded rectangles.
      const { width: w, height: h } = options.box;
      const corner = Math.min(w, h) * 0.18;
      const border = Math.min(w, h) * (POKE.rimScale - 1) * 0.5;
      this.half = { x: w / 2, y: h / 2 };
      this.radius = Math.min(w, h) / 2;
      this.depth = options.depth ?? this.radius * POKE.depthShare;
      this.icon = options.icon;
      const plain = !!options.box.plain;
      this.group.add(new Mesh(slab(w + border * 2, h + border * 2, corner + border, rimDepthFor(this.depth)), flatMaterial(POKE.rimColor)));
      this.pressMax = pressMaxFor(this.depth);
      this.material = flatMaterial(POKE.color);
      // Like the round cap: its side reaches `travel` lower, so no gap shows over the rim at rest.
      const body = new Mesh(slab(w, h, corner, this.depth + travel), this.material);
      body.position.z = -travel;
      this.cap.add(body);
      this.faceMaterial = new MeshBasicMaterial({ map: options.box.face, transparent: true, fog: false, toneMapped: false });
      const face = new Mesh(plain ? new PlaneGeometry(w, h) : new PlaneGeometry(w * 0.94, h * 0.88), this.faceMaterial);
      face.position.z = this.depth + 0.02;
      this.cap.add(face);
      this.cap.position.z = travel;
      this.group.add(this.cap);
      return;
    }
    // Never smaller than the minimum (easy to hit with a fingertip), whatever size was asked for.
    const radius = Math.max(options.radius, BUTTON_SIZE.min);
    if (import.meta.env.DEV && radius > BUTTON_SIZE.max + 1e-6) {
      console.warn(`[ui] a ${options.icon} button of radius ${radius} cm is over BUTTON_SIZE.max (${BUTTON_SIZE.max}): pick a size from BUTTON_SIZE`);
    }
    const depth = options.depth ?? radius * POKE.depthShare;
    this.radius = radius;
    this.depth = depth;
    this.icon = options.icon;
    // Dark rim the cap sinks into.
    const rimDepth = rimDepthFor(depth);
    this.pressMax = pressMaxFor(depth);
    const rim = new Mesh(
      new CylinderGeometry(radius * POKE.rimScale * 0.96, radius * POKE.rimScale, rimDepth, segments),
      flatMaterial(POKE.rimColor),
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.z = rimDepth / 2;
    this.group.add(rim);
    // Smooth shading on the cap, so its round side looks round, not faceted.
    this.material = flatMaterial(POKE.color);
    this.material.flatShading = false;
    // The cap's side reaches `travel` below its face's depth, so at rest it still goes down into the rim (no gap shows
    // under it); pushed in, that part hides behind the panel.
    const mesh = new Mesh(new CylinderGeometry(radius, radius, depth + travel, segments), this.material);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.z = (depth - travel) / 2;
    this.cap.add(mesh);
    // The icon on its face.
    this.faceMaterial = new MeshBasicMaterial({ map: iconTexture(this.icon), transparent: true, premultipliedAlpha: true, fog: false });
    const face = new Mesh(new CircleGeometry(radius * POKE.iconShare, segments), this.faceMaterial);
    face.position.z = depth + 0.02;
    this.cap.add(face);
    this.cap.position.z = travel;
    this.group.add(this.cap);
  }

  /** Changes the cap's color (for example a selected tab green, the others grey). The touch looks stay emissive on top. */
  setColor(color: number): void {
    this.material.color.setHex(color);
  }

  /** Changes the icon on the face (for example Play on the welcome panel, restart on the end panel). */
  setIcon(icon: ButtonIcon): void {
    if (icon === this.icon || this.half) return;
    this.icon = icon;
    this.faceMaterial.map?.dispose();
    this.faceMaterial.map = iconTexture(icon);
    this.faceMaterial.needsUpdate = true;
  }

  /**
   * Blinks the cap (an emissive pulse) while it waits to be poked, or stops.
   * The Ready and Held looks win while a finger is near.
   */
  setBlink(blink: { color: number; intensity: number; speed: number } | null): void {
    this.blink = blink;
    this.blinkTime = 0;
    if (!blink) applyTouchState([this.material], this.touch);
  }

  reset(): void {
    this.armed = false;
    this.fired = false;
    this.press = 0;
    this.cooldown = 0;
    this.lastZ.clear();
    this.cap.position.z = POKE.travel;
    this.setTouch('idle');
  }

  /** Ignores presses for a moment, for example right after the button's job changed. */
  lock(seconds: number): void {
    this.cooldown = Math.max(this.cooldown, seconds);
  }

  /**
   * Checks both index fingertips. Returns true once per press, on the frame
   * the cap reaches the bottom. Fingers move slowly and jitter, so after a
   * click the finger must come back out clearly in front of the button
   * (POKE.releaseDistance) and a short cooldown must pass before it can click
   * again. Hovering or resting on the button never clicks twice.
   */
  update(hands: HandState[], dt: number): boolean {
    const { readyDistance, travel, zoneScale, fireShare, releaseDistance, cooldown } = POKE;
    this.cooldown = Math.max(0, this.cooldown - dt);
    // The cap's face at rest, in the group's space.
    const face = travel + this.depth;
    let inZone = false;
    let near = false;
    let push = -1;
    /** A finger that was in front of the face last frame and is well in now: a quick poke (tracking skips the frames between). */
    let quick = false;
    /** Closest fingertip distance in front of the face (cm). */
    let front = Infinity;
    this.group.updateWorldMatrix(true, false);
    for (const hand of hands) {
      if (!hand.tracked) {
        this.lastZ.delete(hand);
        continue;
      }
      this.group.worldToLocal(local.copy(hand.indexTip));
      // Generous zone around the face (round, or a box's rectangle), and not from far behind it (a quick poke may land deep).
      const margin = this.radius * (zoneScale - 1);
      const outside = this.half
        ? Math.abs(local.x) > this.half.x + margin || Math.abs(local.y) > this.half.y + margin
        : Math.hypot(local.x, local.y) > this.radius * zoneScale;
      if (outside || local.z < -(this.depth + travel + POKE.quickBehind)) {
        this.lastZ.delete(hand);
        continue;
      }
      const before = this.lastZ.get(hand);
      this.lastZ.set(hand, local.z);
      if (before !== undefined && before > face && local.z <= face - travel * fireShare) quick = true;
      // A wider zone once Ready, so a fingertip shaking at the edge never flickers it on and off.
      const reach = this.touch === 'idle' ? readyDistance : readyDistance * POKE.readyOut;
      if (local.z > face + reach) continue;
      inZone = true;
      if (local.z > face) {
        near = true;
        front = Math.min(front, local.z - face);
      } else push = Math.max(push, face - local.z);
    }
    // A fired press counts as over only once the finger is well clear.
    if (this.fired && push < 0 && (!inZone || front > releaseDistance)) this.fired = false;
    if (near && push < 0 && !this.fired) this.armed = true;
    if (!inZone) this.armed = false;
    let fired = false;
    if (push >= 0 && (this.armed || quick) && !this.fired) {
      // The cap follows the fingertip in, down to the bottom. The click goes by the finger itself, not
      // by the cap catching up, so a quick poke clicks at once (the cap's smoothing only calms its look).
      const target = Math.min(travel, push);
      this.press += (target - this.press) * Math.min(1, dt * POKE.capFollow);
      if (this.cooldown <= 0 && push >= travel * fireShare) {
        this.press = travel;
        this.fired = true;
        this.armed = false;
        this.cooldown = cooldown;
        // Locked: it goes down and buzzes, but does nothing.
        fired = !this.locked;
        this.audio.play(this.locked ? 'locked' : 'buttonClick');
        if (this.locked) this.onRefuse();
      }
    } else if (this.fired && push >= 0) {
      // Held down after the click: stays down until the finger leaves.
      this.press += (travel - this.press) * Math.min(1, dt * 40);
    } else {
      // Springs back once the finger leaves.
      this.press += (0 - this.press) * Math.min(1, dt * 18);
    }
    this.cap.position.z = travel - Math.min(this.press, this.pressMax);
    this.setTouch(push >= 0 && (this.armed || this.fired) ? 'held' : near && !this.fired ? 'ready' : 'idle');
    if (this.blink && this.touch === 'idle') {
      this.blinkTime += dt;
      // A smooth on and off pulse, fully dark between blinks.
      const pulse = Math.max(0, Math.sin(this.blinkTime * Math.PI * 2 * this.blink.speed));
      this.material.emissive.setHex(this.blink.color);
      this.material.emissiveIntensity = this.blink.intensity * pulse;
    }
    return fired;
  }

  private setTouch(state: TouchState): void {
    this.touch = changeTouch(this.audio, [this.material], this.touch, state);
  }
}

/**
 * The icon as a texture, premultiplied: the see-through canvas pixels around
 * the icon are black, and without it their color bleeds in as a thin dark
 * edge when the texture is smoothed.
 */
function iconTexture(icon: ButtonIcon): CanvasTexture {
  const texture = canvasTexture(buttonIconCanvas(icon), 4);
  texture.premultiplyAlpha = true;
  return texture;
}
