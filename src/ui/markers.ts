// Tutorial markers: a bouncing "!" with a down arrow above the thing to grab,
// pinch or look at, always drawn on top so the wall never hides it. When that
// thing is out of view, a big arrow on the ring points toward it.
import { CanvasTexture, Group, SRGBColorSpace, Sprite, SpriteMaterial, Texture, Vector3, type Object3D } from 'three';
import { HANDLES, MARKERS } from '../config/game.js';
import { degToRad, polarX, polarZ } from '../rules/boardMath.js';
import { iconTextureSource, type UiImageName } from './uiImages.js';

function sprite(name: UiImageName, tint?: string): Sprite {
  const source = iconTextureSource(name, tint);
  let map: Texture | null = null;
  if (source) {
    map = source instanceof HTMLCanvasElement ? new CanvasTexture(source) : new Texture(source);
    map.colorSpace = SRGBColorSpace;
    map.needsUpdate = true;
  }
  const material = new SpriteMaterial({ map, color: map ? 0xffffff : 0xf2c14e, depthTest: false, depthWrite: false, fog: false });
  const s = new Sprite(material);
  s.renderOrder = 10;
  return s;
}

const UP = new Vector3(0, 1, 0);
const toTarget = new Vector3();

export class Markers {
  /** World space (meters). */
  private pointer = new Group();
  private time = 0;
  /** Ring space (boardLift, cm). */
  private arrows: Record<'left' | 'right', Sprite>;

  constructor(world: Object3D, boardLift: Object3D) {
    const bang = sprite('marker');
    bang.scale.setScalar(MARKERS.size);
    bang.position.y = MARKERS.size * 1.4;
    const down = sprite('down', MARKERS.arrowColor);
    down.scale.setScalar(MARKERS.size * 0.8);
    down.position.y = MARKERS.size * 0.4;
    this.pointer.add(bang, down);
    this.pointer.visible = false;
    world.add(this.pointer);

    const y = HANDLES.ringY + HANDLES.ringRadius + MARKERS.turnArrowSize / 2 + 1;
    const place = (side: 'left' | 'right'): Sprite => {
      const s = sprite(side === 'left' ? 'arrowLeft' : 'arrowRight');
      const a = degToRad(side === 'left' ? -MARKERS.turnArrowDeg : MARKERS.turnArrowDeg);
      s.position.set(polarX(HANDLES.radius, a), y, polarZ(HANDLES.radius, a));
      s.scale.setScalar(MARKERS.turnArrowSize);
      s.visible = false;
      boardLift.add(s);
      return s;
    };
    this.arrows = { left: place('left'), right: place('right') };
  }

  /**
   * Points at a world position (or nothing). `head` and `forward` are the
   * player's head, to know if the target is out of view. Returns 'left' or
   * 'right' when it is out of view, so the hint can say where to look.
   */
  update(dt: number, target: Vector3 | null, head: Vector3, forward: Vector3): 'left' | 'right' | null {
    this.time += dt;
    this.arrows.left.visible = this.arrows.right.visible = false;
    if (!target) {
      this.pointer.visible = false;
      return null;
    }
    this.pointer.visible = true;
    const bob = Math.abs(Math.sin(this.time * MARKERS.bobSpeed)) * MARKERS.bob;
    this.pointer.position.copy(target).addScaledVector(UP, MARKERS.lift + bob);
    // Out of view: the angle between where the head looks and the target, on the ground.
    toTarget.copy(target).sub(head).setY(0);
    const look = forward.x * forward.x + forward.z * forward.z;
    if (toTarget.lengthSq() < 1e-6 || look < 1e-6) return null;
    const angle = Math.atan2(forward.x * toTarget.z - forward.z * toTarget.x, forward.x * toTarget.x + forward.z * toTarget.z);
    if (Math.abs(angle) < degToRad(MARKERS.offViewDeg)) return null;
    // A positive angle here is to the player's right.
    const side = angle > 0 ? 'right' : 'left';
    const arrow = this.arrows[side];
    arrow.visible = true;
    const slide = (Math.sin(this.time * MARKERS.bobSpeed) * 0.5 + 0.5) * MARKERS.turnArrowSlide;
    const a = degToRad((side === 'left' ? -1 : 1) * (MARKERS.turnArrowDeg + slide));
    arrow.position.x = polarX(HANDLES.radius, a);
    arrow.position.z = polarZ(HANDLES.radius, a);
    return side;
  }

  hide(): void {
    this.pointer.visible = false;
    this.arrows.left.visible = this.arrows.right.visible = false;
  }
}
