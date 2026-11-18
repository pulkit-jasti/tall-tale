// v3 2.6 Night Owl: the fire on a burning pebble (2026-11-18: a burning pebble
// only threw off one small falling particle now and then, which read badly).
// A real little flame (the castle torches' layered flame) with a warm glow
// around it, on the pebble in the hand, in the pouch and in flight. While a
// pebble heats in the torch it catches: a small flame grows on it; lit, the
// flame pops up big, then burns down and shrinks in its last second.
//
// A few flames made at setup (no meshes made mid-battle: those flickered),
// given out again every frame: begin(), show() for each burning pebble, end().
// They live in boardLift (cm), so they rise and size with the board.
import { AdditiveBlending, Group, Mesh, MeshBasicMaterial, Sprite, SpriteMaterial, Vector3, type Object3D } from 'three';
import { FIRE_PEBBLE } from '../config/game.js';
import { flameGeometry } from '../world/nightLights.js';
import { glowTexture } from '../world/sky.js';

interface Slot {
  root: Group;
  flame: Mesh;
  glow: Sprite;
  glowMaterial: SpriteMaterial;
}

const local = new Vector3();

export class PebbleFire {
  private slots: Slot[] = [];
  private used = 0;
  private time = 0;

  constructor(private parent: Object3D) {
    const F = FIRE_PEBBLE.burning;
    const geometry = flameGeometry();
    const flameMaterial = new MeshBasicMaterial({ vertexColors: true, fog: false, toneMapped: false });
    const glow = glowTexture();
    for (let i = 0; i < F.slots; i++) {
      const root = new Group();
      const flame = new Mesh(geometry, flameMaterial);
      const glowMaterial = new SpriteMaterial({ map: glow, color: F.glowColor, transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false });
      const sprite = new Sprite(glowMaterial);
      sprite.scale.setScalar(F.glowSize);
      root.add(flame, sprite);
      root.visible = false;
      parent.add(root);
      this.slots.push({ root, flame, glow: sprite, glowMaterial });
    }
  }

  /** Call once per frame before any show(). */
  begin(dt: number): void {
    this.time += dt;
    this.used = 0;
  }

  /**
   * A fire this frame on a pebble whose middle is `world` (a world point).
   * `strength`: 0 to 1 while it catches in the torch, 1 burning (more for the lighting pop).
   */
  show(world: Vector3, strength: number): void {
    if (strength <= 0 || this.used >= this.slots.length) return;
    const F = FIRE_PEBBLE.burning;
    const i = this.used++;
    const slot = this.slots[i];
    this.parent.worldToLocal(local.copy(world));
    slot.root.position.copy(local);
    slot.root.visible = true;
    // A torch-like flicker, each slot its own way, and a slow twist so the side tongues dance.
    const t = this.time * F.flickerSpeed + i * 2.1;
    const wobble = 1 + F.flicker * (0.6 * Math.sin(t) + 0.4 * Math.sin(t * 2.3 + 1));
    const size = F.flameSize * strength;
    slot.flame.scale.set(size * (2 - wobble), size * wobble * F.stretch, size * (2 - wobble));
    // The flame rises from the top of the pebble (its origin is about halfway up the flame).
    slot.flame.position.y = F.rise * size;
    slot.flame.rotation.y = this.time * 1.7 + i;
    slot.glow.position.y = F.rise * size * 0.6;
    slot.glow.scale.setScalar(F.glowSize * Math.min(1.4, strength) * (0.9 + 0.1 * wobble));
    slot.glowMaterial.opacity = F.glowStrength * Math.min(1, strength);
  }

  /** Call once per frame after the last show(): the flames not given out hide. */
  end(): void {
    for (let i = this.used; i < this.slots.length; i++) this.slots[i].root.visible = false;
  }

  /** How strong a burning pebble's fire is, from the seconds it has left: a pop as it lights, then it burns down. */
  static burnStrength(left: number): number {
    const F = FIRE_PEBBLE;
    const age = F.burnTime - left;
    const pop = F.burning.popTime;
    // The lighting pop: up past full size, then back.
    const lit = age < pop ? 1 + F.burning.popOver * Math.sin((age / pop) * Math.PI) : 1;
    // The last second it shrinks away.
    return lit * Math.min(1, left / F.burning.fadeTime);
  }
}
