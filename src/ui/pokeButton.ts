// The one round button used everywhere (Next, Play, Play again, later the
// pause panel), poked with the index finger (docs/controls-and-ui.md). Same
// look for all: a green cap raised in a dark rim, with a crisp icon on its
// face. Only the size and icon change, through the options. The cap follows
// the fingertip in, clicks when it reaches the bottom, and springs back when
// the finger leaves, so a press can be seen and felt without haptics. Its
// face points along the group's local +z. Sizes are in the parent's units
// (cm in the rigs).
import { CanvasTexture, CircleGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, SRGBColorSpace, Vector3, type MeshStandardMaterial } from 'three';
import type { GameAudio } from '../audio/sound.js';
import { POKE } from '../config/game.js';
import { applyTouchState, type TouchState } from '../player/feedback.js';
import type { HandState } from '../player/hands.js';
import { flatMaterial } from '../world/shapes.js';
import { buttonIconCanvas, type ButtonIcon } from './uiImages.js';

export interface ButtonOptions {
  /** Cap radius. */
  radius: number;
  /** Cap thickness. Defaults to POKE.depthShare of the radius. */
  depth?: number;
  icon: ButtonIcon;
}

const local = new Vector3();

export class PokeButton {
  /** Place and turn this group. Its +z is the button's face. */
  readonly group = new Group();
  private cap = new Group();
  private material: MeshStandardMaterial;
  private faceMaterial: MeshBasicMaterial;
  private icon: ButtonIcon;
  private radius: number;
  private depth: number;
  private touch: TouchState = 'idle';
  /** The finger came from the front, so pushing in counts. */
  private armed = false;
  /** Fired this push. It fires again only after the finger leaves. */
  private fired = false;
  /** How far the cap is pushed in (0 to POKE.travel). */
  private press = 0;
  /** No new press until this runs out (seconds): after a click, or a lock. */
  private cooldown = 0;

  constructor(
    private audio: GameAudio,
    options: ButtonOptions,
  ) {
    const { segments, travel } = POKE;
    const radius = options.radius;
    const depth = options.depth ?? radius * POKE.depthShare;
    this.radius = radius;
    this.depth = depth;
    this.icon = options.icon;
    // Dark rim the cap sinks into.
    const rimDepth = travel + depth * 0.4;
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
    const mesh = new Mesh(new CylinderGeometry(radius, radius, depth, segments), this.material);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.z = depth / 2;
    this.cap.add(mesh);
    // The icon on its face.
    this.faceMaterial = new MeshBasicMaterial({ map: iconTexture(this.icon), transparent: true, fog: false });
    const face = new Mesh(new CircleGeometry(radius * POKE.iconShare, segments), this.faceMaterial);
    face.position.z = depth + 0.02;
    this.cap.add(face);
    this.cap.position.z = travel;
    this.group.add(this.cap);
  }

  /** Changes the icon on the face (for example Play on the welcome panel, restart on the end panel). */
  setIcon(icon: ButtonIcon): void {
    if (icon === this.icon) return;
    this.icon = icon;
    this.faceMaterial.map?.dispose();
    this.faceMaterial.map = iconTexture(icon);
    this.faceMaterial.needsUpdate = true;
  }

  reset(): void {
    this.armed = false;
    this.fired = false;
    this.press = 0;
    this.cooldown = 0;
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
    /** Closest fingertip distance in front of the face (cm). */
    let front = Infinity;
    this.group.updateWorldMatrix(true, false);
    for (const hand of hands) {
      if (!hand.tracked) continue;
      this.group.worldToLocal(local.copy(hand.indexTip));
      // Generous zone around the round face, and not from far behind it.
      if (Math.hypot(local.x, local.y) > this.radius * zoneScale || local.z < -this.depth) continue;
      if (local.z > face + readyDistance) continue;
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
    if (push >= 0 && this.armed && !this.fired) {
      // The cap follows the fingertip in, down to the bottom.
      const target = Math.min(travel, push);
      this.press += (target - this.press) * Math.min(1, dt * 40);
      if (this.cooldown <= 0 && this.press >= travel * fireShare) {
        this.fired = true;
        this.armed = false;
        this.cooldown = cooldown;
        fired = true;
        this.audio.play('buttonClick');
      }
    } else if (this.fired && push >= 0) {
      // Held down after the click: stays down until the finger leaves.
      this.press += (travel - this.press) * Math.min(1, dt * 40);
    } else {
      // Springs back once the finger leaves.
      this.press += (0 - this.press) * Math.min(1, dt * 18);
    }
    this.cap.position.z = travel - this.press;
    this.setTouch(push >= 0 && (this.armed || this.fired) ? 'held' : near && !this.fired ? 'ready' : 'idle');
    return fired;
  }

  private setTouch(state: TouchState): void {
    if (state === this.touch) return;
    if (state === 'ready' && this.touch === 'idle') this.audio.play('readyTick', undefined, 1, 0.1);
    this.touch = state;
    applyTouchState([this.material], state);
  }
}

function iconTexture(icon: ButtonIcon): CanvasTexture {
  const map = new CanvasTexture(buttonIconCanvas(icon));
  map.colorSpace = SRGBColorSpace;
  map.anisotropy = 4;
  return map;
}
