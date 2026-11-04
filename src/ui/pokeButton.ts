// A round button poked with the index finger (docs/controls-and-ui.md): a
// short cylinder whose face points along its local +z. Ready when a fingertip
// is just in front of it, pressed when the finger pushes in from the front.
// It presses in, clicks, and uses the shared Idle, Ready and Held looks.
// Sizes are in the parent's units (cm in the rigs).
import { CylinderGeometry, Group, Mesh, Vector3, type MeshStandardMaterial } from 'three';
import type { GameAudio } from '../audio/sound.js';
import { POKE } from '../config/game.js';
import { applyTouchState, type TouchState } from '../player/feedback.js';
import type { HandState } from '../player/hands.js';
import { flatMaterial } from '../world/shapes.js';

const local = new Vector3();

export class PokeButton {
  /** Place and turn this group. Its +z is the button's face. */
  readonly group = new Group();
  private cap = new Group();
  private material: MeshStandardMaterial;
  private touch: TouchState = 'idle';
  /** The finger was in front of the button, so pushing in counts as a press. */
  private armed = false;
  private pressed = false;
  private press = 0;

  constructor(
    private radius: number,
    private depth: number,
    color: number,
    private audio: GameAudio,
  ) {
    this.material = flatMaterial(color);
    const mesh = new Mesh(new CylinderGeometry(radius, radius, depth, 16), this.material);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.z = depth / 2;
    this.cap.add(mesh);
    this.group.add(this.cap);
  }

  reset(): void {
    this.armed = false;
    this.pressed = false;
    this.press = 0;
    this.cap.position.z = 0;
    this.setTouch('idle');
  }

  /** Checks both index fingertips. Returns true on the frame the button is poked. */
  update(hands: HandState[], dt: number): boolean {
    const { readyDistance, pressDepth, travel, zoneScale } = POKE;
    // Units of the parent: the fingertip distances in config are cm, like the rigs.
    let near = false;
    let inside = false;
    this.group.updateWorldMatrix(true, false);
    for (const hand of hands) {
      if (!hand.tracked) continue;
      this.group.worldToLocal(local.copy(hand.indexTip));
      // Generous zone around the round face.
      if (Math.hypot(local.x, local.y) > this.radius * zoneScale) continue;
      if (local.z > this.depth && local.z < this.depth + readyDistance) near = true;
      if (local.z <= this.depth - pressDepth && local.z > -this.depth * 2) inside = true;
    }
    let fired = false;
    if (near && !inside) this.armed = true;
    if (inside && this.armed && !this.pressed) {
      this.pressed = true;
      fired = true;
      this.audio.play('buttonClick');
    }
    if (!near && !inside) {
      this.armed = false;
      this.pressed = false;
    }
    // The button presses in while pushed.
    const k = 1 - Math.exp(-dt * 30);
    this.press += ((this.pressed ? travel : 0) - this.press) * k;
    this.cap.position.z = -this.press;
    this.setTouch(this.pressed ? 'held' : near ? 'ready' : 'idle');
    return fired;
  }

  private setTouch(state: TouchState): void {
    if (state === this.touch) return;
    if (state === 'ready' && this.touch === 'idle') this.audio.play('readyTick', undefined, 1, 0.1);
    this.touch = state;
    applyTouchState([this.material], state);
  }
}
