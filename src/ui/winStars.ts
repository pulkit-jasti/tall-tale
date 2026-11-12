// The win screen's three stars (END_PANEL.stars), real 3D stars floating in
// front of the end panel: gold ones for the stars won, dull stone ones for
// the stars missed, the middle one bigger and higher like a podium. They pop
// in one at a time (an elastic pop), a won one spins once with a chime that
// climbs with each star and a burst of sparkles (the end panel plays them,
// onPop), then they bob gently and a glint runs across the gold ones. Three
// meshes, shown only on the end panel; no canvas, so nothing is redrawn.
import { ExtrudeGeometry, Group, Mesh, MeshStandardMaterial, Shape, Vector3, type Object3D } from 'three';
import { END_PANEL } from '../config/game.js';
import { popIn } from '../fx/ease.js';

const S = END_PANEL.stars;
const world = new Vector3();

interface Star {
  mesh: Mesh;
  material: MeshStandardMaterial;
  /** Where it floats (panel cm), its size (outer radius, cm) and its tilt (radians, the side ones lean out). */
  base: Vector3;
  size: number;
  lean: number;
  /** When it pops in (seconds after play), and whether it was won. */
  at: number;
  earned: boolean;
  popped: boolean;
}

/** A five pointed star of outer radius 1, its middle at the origin, facing +z, with a bevelled edge. */
function starGeometry(): ExtrudeGeometry {
  const shape = new Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 1 : 0.45;
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  shape.closePath();
  const geometry = new ExtrudeGeometry(shape, { depth: S.depth, bevelEnabled: true, bevelThickness: S.bevel, bevelSize: S.bevel, bevelSegments: 1 });
  geometry.center();
  return geometry;
}

export class WinStars {
  readonly group = new Group();
  private stars: Star[] = [];
  /** Seconds since play(), or -1 while hidden. */
  private time = -1;
  /** A star popped in: `earned` (gold) or missed, at this world point (the panel plays the chime and the sparkles). */
  onPop: (index: number, earned: boolean, world: Vector3) => void = () => {};

  constructor(parent: Object3D) {
    const geometry = starGeometry();
    for (let i = 0; i < 3; i++) {
      const middle = i === 1;
      const material = new MeshStandardMaterial({ color: S.goldColor, metalness: 0.6, roughness: 0.3, emissive: S.goldGlow, flatShading: true });
      const mesh = new Mesh(geometry, material);
      // Heights are set by placeAt() (the panel's size changes).
      const base = new Vector3((i - 1) * S.spacing, middle ? S.middleLift : 0, S.z);
      this.stars.push({ mesh, material, base, size: middle ? S.middleSize : S.size, lean: (1 - i) * S.leanRad, at: 0, earned: false, popped: false });
      mesh.visible = false;
      this.group.add(mesh);
    }
    this.group.visible = false;
    parent.add(this.group);
  }

  /** The stars' middle row at this height on the panel (cm from its middle). */
  placeAt(y: number): void {
    this.group.position.y = y;
  }

  /** Shows `count` won stars (0 to 3), popping in one by one. */
  play(count: number): void {
    this.time = 0;
    this.group.visible = true;
    this.stars.forEach((star, i) => {
      star.earned = i < count;
      star.popped = false;
      star.at = S.firstAt + i * S.gap;
      star.mesh.visible = false;
      star.mesh.scale.setScalar(0.001);
      star.material.color.setHex(star.earned ? S.goldColor : S.stoneColor);
      star.material.emissive.setHex(star.earned ? S.goldGlow : 0x000000);
      star.material.metalness = star.earned ? 0.6 : 0.1;
      star.material.roughness = star.earned ? 0.3 : 0.9;
    });
  }

  hide(): void {
    this.time = -1;
    this.group.visible = false;
  }

  update(dt: number): void {
    if (this.time < 0) return;
    this.time += dt;
    const t = this.time;
    this.stars.forEach((star, i) => {
      const since = t - star.at;
      if (since < 0) return;
      if (!star.popped) {
        star.popped = true;
        star.mesh.visible = true;
        this.group.updateWorldMatrix(true, false);
        this.onPop(i, star.earned, this.group.localToWorld(world.copy(star.base)));
      }
      // The pop: elastic, a missed one a little smaller.
      const grow = popIn(since / S.popTime) * star.size * (star.earned ? 1 : S.missedScale);
      star.mesh.scale.setScalar(Math.max(0.001, grow));
      // Then a gentle bob, each at its own beat.
      star.mesh.position.copy(star.base);
      star.mesh.position.y += Math.sin(t * S.bobSpeed + i * 1.3) * S.bob * Math.min(1, since / S.popTime);
      // A won star spins once as it lands, then turns a little to and fro, catching the light.
      const spin = star.earned ? Math.max(0, 1 - since / S.spinTime) : 0;
      star.mesh.rotation.set(0, spin * spin * Math.PI * 2 + Math.sin(t * 1.1 + i) * S.sway, star.lean);
      // A glint that runs across the gold stars every few seconds.
      if (star.earned) {
        const sweep = ((t - S.firstAt) % S.glintEvery) / S.glintEvery;
        const at = sweep * 4 - 0.5 - i;
        const glint = Math.max(0, 1 - Math.abs(at) * 2.5);
        star.material.emissiveIntensity = 1 + glint * S.glintStrength + (since < S.popTime ? (1 - since / S.popTime) * S.glintStrength : 0);
      }
    });
  }
}
