// Tutorial marker: one bouncing down arrow above the thing to grab, pinch or
// look at, always drawn on top so the wall never hides it. (A pointer toward
// things out of view comes later.)
import { CanvasTexture, Group, SRGBColorSpace, Sprite, SpriteMaterial, Vector3, type Object3D } from 'three';
import { MARKERS } from '../config/game.js';
import { arrowCanvas } from './uiImages.js';

/** A sprite drawn on top of everything, sized by its height and keeping the image's shape. */
function sprite(source: HTMLCanvasElement | null, height: number): Sprite {
  let map: CanvasTexture | null = null;
  if (source) {
    map = new CanvasTexture(source);
    map.colorSpace = SRGBColorSpace;
    map.anisotropy = 4;
  }
  const material = new SpriteMaterial({ map, color: map ? 0xffffff : 0xf2c14e, depthTest: false, depthWrite: false, fog: false });
  const s = new Sprite(material);
  s.renderOrder = 10;
  const aspect = source ? source.width / source.height : 1;
  s.scale.set(height * aspect, height, 1);
  return s;
}

const UP = new Vector3(0, 1, 0);

export class Markers {
  /** World space (meters). The second one points at a second thing (for example the boulder and the tree). */
  private pointers: Group[] = [];
  private time = 0;
  /** A short bigger bounce left (seconds), to call the eye again (a fallback). */
  private pulseLeft = 0;

  constructor(world: Object3D) {
    for (let i = 0; i < 2; i++) {
      // One bouncing arrow pointing down at the target (an extra "!" above it was too much).
      const pointer = new Group();
      const down = sprite(arrowCanvas('down'), MARKERS.size);
      down.position.y = MARKERS.size * 0.5;
      pointer.add(down);
      pointer.visible = false;
      world.add(pointer);
      this.pointers.push(pointer);
    }
  }

  /** Points at a world position (and a second one), or hides when there is none. */
  update(dt: number, target: Vector3 | null, second: Vector3 | null = null): void {
    this.time += dt;
    this.pulseLeft = Math.max(0, this.pulseLeft - dt);
    const grow = this.pulseLeft > 0 ? 1 + MARKERS.pulseScale * Math.abs(Math.sin(this.time * MARKERS.bobSpeed * 2)) : 1;
    [target, second].forEach((at, i) => {
      const pointer = this.pointers[i];
      if (!at) {
        pointer.visible = false;
        return;
      }
      pointer.visible = true;
      const bob = Math.abs(Math.sin(this.time * MARKERS.bobSpeed)) * MARKERS.bob * grow;
      pointer.position.copy(at).addScaledVector(UP, MARKERS.lift + bob);
      pointer.scale.setScalar(grow);
    });
  }

  /** A few big bounces, so the eye goes back to the target. */
  pulse(): void {
    this.pulseLeft = MARKERS.pulseTime;
  }

  hide(): void {
    for (const pointer of this.pointers) pointer.visible = false;
  }
}
