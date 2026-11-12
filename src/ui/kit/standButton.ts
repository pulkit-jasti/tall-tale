// A poke button on a post standing on the board in front of the player
// (straight ahead, or round to `angleDeg`), its face tilted up toward the
// eyes (the tutorial's Next button, the pause button). It rises with the board but never turns. Coming out it
// starts fresh and ignores pokes for a moment, and it can blink while it
// waits to be poked. Sizes in cm (boardLift).
import { Group, type Object3D, type Vector3 } from 'three';
import type { GameAudio } from '../../audio/sound.js';
import type { HandState } from '../../player/hands.js';
import { degToRad, polarX, polarZ } from '../../rules/boardMath.js';
import { post } from '../../world/shapes.js';
import { PokeButton } from '../pokeButton.js';
import type { ButtonIcon } from '../uiImages.js';
import { armControls, type Control } from './controls.js';

export interface StandOptions {
  radius: number;
  icon: ButtonIcon;
  /** How far out in front (cm, along -z), and the button's middle above the board (cm). */
  at: number;
  y: number;
  /** Its face tilted back toward the eyes (degrees). */
  tiltDeg: number;
  /** Round from straight ahead (degrees, positive to the right); 0 when missing. It faces the player there. */
  angleDeg?: number;
  /** Blinks while it waits (an emissive pulse). */
  blink?: { color: number; intensity: number; speed: number };
}

export class StandButton implements Control {
  private stand = new Group();
  private button: PokeButton;

  constructor(
    parent: Object3D,
    audio: GameAudio,
    private options: StandOptions,
  ) {
    const { radius, icon, at, y, tiltDeg } = options;
    this.button = new PokeButton(audio, { radius, icon });
    this.button.group.rotation.x = -degToRad(tiltDeg);
    // A post down to the board, so it stands like the tool platforms.
    const stem = post(y - radius);
    stem.position.y -= radius;
    this.stand.add(this.button.group, stem);
    const a = degToRad(options.angleDeg ?? 0);
    this.stand.position.set(polarX(at, a), y, polarZ(at, a));
    // Turned to face the middle (the player).
    this.stand.rotation.y = -a;
    this.stand.visible = false;
    parent.add(this.stand);
  }

  get visible(): boolean {
    return this.stand.visible;
  }

  /** Out or away. Coming out it starts fresh, ignores pokes a moment, and blinks if it has a blink. */
  show(on: boolean): void {
    if (on === this.stand.visible) return;
    this.stand.visible = on;
    armControls([this.button]);
    this.button.setBlink(on ? (this.options.blink ?? null) : null);
  }

  /** Starts or stops a blink (an emissive pulse) while it waits to be poked. */
  setBlink(blink: StandOptions['blink'] | null): void {
    this.button.setBlink(blink ?? null);
  }

  /** True on the frame it is poked (only while it shows). */
  update(hands: HandState[], dt: number): boolean {
    return this.stand.visible && this.button.update(hands, dt);
  }

  /** The button's middle (world), while it shows (for a tutorial marker). */
  worldPosition(out: Vector3): Vector3 | null {
    return this.stand.visible ? this.button.group.getWorldPosition(out) : null;
  }

  reset(): void {
    this.button.reset();
  }

  lock(seconds: number): void {
    this.button.lock(seconds);
  }
}
