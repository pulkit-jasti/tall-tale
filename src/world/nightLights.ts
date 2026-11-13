// Night lights (decor only, NIGHT_LIGHTS): warm glowing windows in the
// villages, a torch on the courtyard side of each castle tower, and a glow on
// each village lantern. They come on at sunset and are full at night
// (DayLook.lights, set by the day and night cycle).
//
// No real lights (they hurt the Quest frame rate): the windows are bright
// unlit panes with a small soft glow on the wall around them, the flames are
// bright unlit cones that flicker, and the torches and lanterns get a round
// glow that always faces the player (turned in its shader). Torches stand on
// the castle towers and on posts beside the roads, each road torch with a
// flat pool of warm light on the ground (so goblins show up against it). 6
// draw calls in all, and all hidden while the lights are off (by day the
// torches are gone).
import {
  AdditiveBlending,
  BufferAttribute,
  Color,
  ConeGeometry,
  CylinderGeometry,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  type Object3D,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from 'three';
import { CASTLE, NIGHT_LIGHTS as L } from '../config/game.js';
import { degToRad, polarX, polarZ } from '../rules/boardMath.js';
import { flatMaterial } from './shapes.js';
import { glowTexture } from './sky.js';

const matrix = new Matrix4();
const at = new Vector3();
const size = new Vector3();
const still = new Quaternion();
const UP = new Vector3(0, 1, 0);

/** A glow that always faces the eye: a quad turned toward the view in its shader, its size from the instance's scale. */
function facingGlowMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { map: { value: glowTexture() }, color: { value: new Color() } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 center = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float across = length((modelViewMatrix * instanceMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
        center.xy += position.xy * across;
        gl_Position = projectionMatrix * center;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform vec3 color;
      varying vec2 vUv;
      void main() {
        gl_FragColor = vec4(color * texture2D(map, vUv).a, 1.0);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
}

/** A torch beside a road: its spot on the ground and the road's direction there (radians, around the vertical). */
export interface RoadTorch {
  at: Vector3;
  yaw: number;
}

export class NightLights {
  private panes: InstancedMesh | null = null;
  private windowGlows: InstancedMesh | null = null;
  private paneMaterial = new MeshBasicMaterial({ fog: false, toneMapped: false });
  private windowGlowMaterial = new MeshBasicMaterial({
    map: glowTexture(),
    fog: false,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  private sticks: InstancedMesh;
  private flames: InstancedMesh;
  private pools: InstancedMesh | null = null;
  private poolSpots: { at: Vector3; turn: Quaternion }[] = [];
  /** The first torches are the castle's (they have a halo), the rest stand by the roads. */
  private castleTorches = CASTLE.towerCount;
  private poolMaterial = new MeshBasicMaterial({
    map: glowTexture(),
    fog: false,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  private glows: InstancedMesh;
  private glowMaterial = facingGlowMaterial();
  /** Where each torch's flame is (board cm). */
  private torches: Vector3[] = [];
  private time = 0;
  private level = -1;

  /**
   * Everything goes in `board` (it turns with the board). `windows` and
   * `lanterns` are their placements there, `roadTorches` the ground spots
   * of the torches beside the roads.
   */
  constructor(board: Object3D, windows: Matrix4[], lanterns: Matrix4[], lanternHeight: number, roadTorches: RoadTorch[] = []) {
    // Windows: a warm pane just out of the wall, and a glow on the wall around it (a tile faces +x, its outside at 0.5).
    if (windows.length > 0) {
      const pane = new PlaneGeometry(L.paneSize[0], L.paneSize[1]).rotateY(Math.PI / 2).translate(L.paneOut, L.paneHeight, 0);
      const glow = new PlaneGeometry(L.windowGlowSize, L.windowGlowSize).rotateY(Math.PI / 2).translate(L.paneOut + 0.005, L.paneHeight, 0);
      this.panes = new InstancedMesh(pane, this.paneMaterial, windows.length);
      this.windowGlows = new InstancedMesh(glow, this.windowGlowMaterial, windows.length);
      windows.forEach((m, i) => {
        this.panes!.setMatrixAt(i, m);
        this.windowGlows!.setMatrixAt(i, m);
      });
      for (const mesh of [this.panes, this.windowGlows]) {
        mesh.computeBoundingSphere();
        mesh.visible = false;
        board.add(mesh);
      }
    }
    // Torches: one on the courtyard side of each tower, a stick and a flame.
    const stickLengths: number[] = [];
    for (let i = 0; i < CASTLE.towerCount; i++) {
      const a = degToRad(CASTLE.towerStartDeg + (360 / CASTLE.towerCount) * i);
      this.torches.push(new Vector3(polarX(L.torchRadius, a), L.torchHeight, polarZ(L.torchRadius, a)));
      stickLengths.push(L.torchStick);
    }
    // Torches on tall posts beside the roads, out across the board, each with a pool of warm light on the
    // ground around it, so the goblins walking past show up against it at night.
    for (const { at: ground } of roadTorches) {
      this.torches.push(new Vector3(ground.x, ground.y + L.roadTorchStick + L.torchFlame * 0.45, ground.z));
      stickLengths.push(L.roadTorchStick);
    }
    const sticks = new InstancedMesh(new CylinderGeometry(0.25, 0.18, 1, 6), flatMaterial(L.torchStickColor), this.torches.length);
    this.torches.forEach((p, i) => {
      const stick = stickLengths[i];
      at.set(p.x, p.y - L.torchFlame * 0.45 - stick / 2, p.z);
      sticks.setMatrixAt(i, matrix.compose(at, still, size.set(1, stick, 1)));
    });
    sticks.computeBoundingSphere();
    // Torches only stand there while they burn (sunset and night), never as dead sticks by day.
    sticks.visible = false;
    this.sticks = sticks;
    board.add(sticks);
    this.flames = new InstancedMesh(flameGeometry(), new MeshBasicMaterial({ vertexColors: true, fog: false, toneMapped: false }), this.torches.length);
    this.flames.frustumCulled = false;
    this.flames.visible = false;
    board.add(this.flames);
    // Small soft halos right at the flames of the castle torches (they flicker with them) and at each lantern (still).
    // A big round glow read as a floating ball, not as light, so they stay small and the road torches have none.
    const quad = new PlaneGeometry(1, 1);
    this.glows = new InstancedMesh(quad, this.glowMaterial, this.castleTorches + lanterns.length);
    this.glows.frustumCulled = false;
    lanterns.forEach((m, i) => {
      at.set(0, lanternHeight * L.lanternLightAt, 0).applyMatrix4(m);
      this.glows.setMatrixAt(this.castleTorches + i, matrix.compose(at, still, size.setScalar(L.lanternGlowSize)));
    });
    this.glows.visible = false;
    board.add(this.glows);
    // The pools of light on the ground around the road torches: flat soft ovals along the road, additive,
    // a little above the ground, flickering with their flames. What reads as torch light at night.
    if (roadTorches.length > 0) {
      const pool = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
      this.pools = new InstancedMesh(pool, this.poolMaterial, roadTorches.length);
      this.pools.frustumCulled = false;
      this.poolSpots = roadTorches.map((t) => ({ at: new Vector3(t.at.x, t.at.y + 0.4, t.at.z), turn: new Quaternion().setFromAxisAngle(UP, t.yaw) }));
      this.placePools(1);
      this.pools.visible = false;
      board.add(this.pools);
    }
  }

  /** Each pool at its torch, stretched along the road, its size wobbling with the flame (`wobble` per torch, 1 = still). */
  private placePools(wobbleAt: number | ((i: number) => number)): void {
    if (!this.pools) return;
    this.poolSpots.forEach((spot, i) => {
      const w = typeof wobbleAt === 'number' ? wobbleAt : wobbleAt(this.castleTorches + i);
      const s = L.roadPoolSize * (1 + L.roadPoolFlicker * (w - 1) / L.flicker);
      this.pools!.setMatrixAt(i, matrix.compose(spot.at, spot.turn, size.set(s * L.roadPoolStretch, 1, s)));
    });
    this.pools.instanceMatrix.needsUpdate = true;
  }

  /** Every frame: `level` is how bright the lights are now (0 = off). The flames flicker while they show. */
  update(dt: number, level: number): void {
    if (level !== this.level) {
      this.level = level;
      const on = level > 0.01;
      for (const mesh of [this.panes, this.windowGlows, this.sticks, this.flames, this.glows, this.pools]) if (mesh) mesh.visible = on;
      this.poolMaterial.color.setHex(L.roadPoolColor).multiplyScalar(L.roadPoolStrength * level);
      this.paneMaterial.color.setHex(L.paneColor).multiplyScalar(level);
      this.windowGlowMaterial.color.setHex(L.windowGlowColor).multiplyScalar(L.windowGlowStrength * level);
      (this.glowMaterial.uniforms.color.value as Color).setHex(L.glowColor).multiplyScalar(L.glowStrength * level);
    }
    if (level <= 0.01) return;
    this.time += dt;
    this.torches.forEach((p, i) => {
      const w = this.wobble(i);
      const flame = L.torchFlame * w * Math.min(1, level * 1.5);
      this.flames.setMatrixAt(i, matrix.compose(p, still, size.set(flame, flame * (1 + 0.3 * (w - 1)), flame)));
      if (i < this.castleTorches) this.glows.setMatrixAt(i, matrix.compose(p, still, size.setScalar(L.torchGlowSize * (0.85 + 0.15 * w))));
    });
    this.flames.instanceMatrix.needsUpdate = true;
    this.glows.instanceMatrix.needsUpdate = true;
    this.placePools((i) => this.wobble(i));
  }

  /** A torch's flicker now (1 = still): two waves at their own pace per torch, so no two flicker alike. */
  private wobble(i: number): number {
    return 1 + L.flicker * (0.6 * Math.sin(this.time * L.flickerSpeed + i * 1.7) + 0.4 * Math.sin(this.time * L.flickerSpeed * 2.3 + i));
  }
}

/** A low-poly flame (1 cm across): a cone, orange at the base to pale yellow at the tip, its middle at the origin. */
function flameGeometry(): ConeGeometry {
  const geometry = new ConeGeometry(0.42, 1.2, 6);
  const position = geometry.getAttribute('position') as BufferAttribute;
  const colors = new Float32Array(position.count * 3);
  const base = new Color(L.flameBase);
  const tip = new Color(L.flameTip);
  const color = new Color();
  for (let i = 0; i < position.count; i++) {
    color.copy(base).lerp(tip, position.getY(i) / 1.2 + 0.5);
    colors.set([color.r, color.g, color.b], i * 3);
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  return geometry;
}
