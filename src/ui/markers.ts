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
  /** World space (meters). */
  private pointer = new Group();
  private time = 0;

  constructor(world: Object3D) {
    // One bouncing arrow pointing down at the target (an extra "!" above it was too much).
    const down = sprite(arrowCanvas('down'), MARKERS.size);
    down.position.y = MARKERS.size * 0.5;
    this.pointer.add(down);
    this.pointer.visible = false;
    world.add(this.pointer);
  }

  /** Points at a world position, or hides when there is none. */
  update(dt: number, target: Vector3 | null): void {
    this.time += dt;
    if (!target) {
      this.pointer.visible = false;
      return;
    }
    this.pointer.visible = true;
    const bob = Math.abs(Math.sin(this.time * MARKERS.bobSpeed)) * MARKERS.bob;
    this.pointer.position.copy(target).addScaledVector(UP, MARKERS.lift + bob);
  }

  hide(): void {
    this.pointer.visible = false;
  }
}
