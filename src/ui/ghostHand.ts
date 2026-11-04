// A see-through ghost hand that loops a demonstration of the current lesson
// (src/ui/ghostDemos.ts), next to the real thing to grab or pinch. The model
// is Meta's standard WebXR hand ("generic-hand" from WebXR Input Profiles,
// public/gltf/hands/). Its fingers are posed with IWSDK's two hand poses: open
// (relaxed) and pressed (curled). A pinch curls the thumb and index, a fist
// curls everything. Lives in world space (meters), at real hand size.
import { AnimatedControllerHand, AssetManager } from '@iwsdk/core';
import {
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  SkinnedMesh,
  SphereGeometry,
  Vector3,
} from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { GHOST_HAND } from '../config/game.js';
import { degToRad } from '../rules/boardMath.js';
import { gltfUrl } from '../world/models.js';
import { GHOST_DEMOS, type GhostAnchor, type GhostDemo, type GhostDemoName, type GhostPose } from './ghostDemos.js';

type Side = 'left' | 'right';
type FingerGroup = 'thumb' | 'index' | 'other';

/** How far each finger group curls for each pose (0 = open pose, 1 = pressed pose). */
const CURL: Record<GhostPose, Record<FingerGroup, number>> = {
  open: { thumb: 0, index: 0, other: 0 },
  pinch: { thumb: 1, index: 1, other: 0.35 },
  fist: { thumb: 1, index: 1, other: 1 },
};

interface BonePose {
  bone: Object3D;
  group: FingerGroup;
  openPosition: Vector3;
  openQuaternion: Quaternion;
  curledPosition: Vector3;
  curledQuaternion: Quaternion;
}

/** Turns a pose's joint name into a finger group. */
const groupOf = (joint: string): FingerGroup =>
  joint.startsWith('thumb') ? 'thumb' : joint.startsWith('index') ? 'index' : 'other';

class GhostModel {
  readonly root = new Group();
  readonly bones: BonePose[] = [];
  readonly material: MeshStandardMaterial;
  readonly tipMaterial: MeshBasicMaterial;
  private thumbTip: Object3D;
  private indexTip: Object3D;
  private wrist: Object3D;
  private knuckle: Object3D;

  /** `template` is the loaded glTF scene, cloned so the cached one stays untouched. */
  constructor(template: Object3D, side: Side, parent: Object3D) {
    const model = SkeletonUtils.clone(template);
    this.material = new MeshStandardMaterial({
      color: GHOST_HAND.color,
      emissive: GHOST_HAND.color,
      emissiveIntensity: 0.35,
      transparent: true,
      opacity: GHOST_HAND.opacity,
      depthWrite: false,
      roughness: 0.6,
    });
    model.traverse((o) => {
      const mesh = o as SkinnedMesh;
      if (mesh.isSkinnedMesh) {
        mesh.material = this.material;
        mesh.frustumCulled = false;
        mesh.renderOrder = 5;
      }
    });
    this.root.add(model);
    const matrix = new Matrix4();
    const scale = new Vector3();
    const poses = [AnimatedControllerHand.defaultPose, AnimatedControllerHand.pressedPose] as Record<string, number[]>[];
    for (const joint of Object.keys(poses[0])) {
      const bone = model.getObjectByName(joint);
      if (!bone) continue;
      const [open, curled] = poses.map((pose) => {
        const position = new Vector3();
        const quaternion = new Quaternion();
        matrix.fromArray(pose[joint]).decompose(position, quaternion, scale);
        // The poses are for a right hand. Mirror them for the left one, as IWSDK does.
        if (side === 'left') {
          position.x *= -1;
          quaternion.x *= -1;
          quaternion.w *= -1;
        }
        return { position, quaternion };
      });
      this.bones.push({
        bone,
        group: groupOf(joint),
        openPosition: open.position,
        openQuaternion: open.quaternion,
        curledPosition: curled.position,
        curledQuaternion: curled.quaternion,
      });
    }
    const find = (name: string): Object3D => model.getObjectByName(name) ?? model;
    this.thumbTip = find('thumb-tip');
    this.indexTip = find('index-finger-tip');
    this.wrist = find('wrist');
    this.knuckle = find('middle-finger-phalanx-proximal');
    // Glowing fingertips, so a pinch shows which fingers do it.
    this.tipMaterial = new MeshBasicMaterial({ color: GHOST_HAND.tipColor, transparent: true, depthWrite: false, fog: false });
    const tipGeometry = new SphereGeometry(GHOST_HAND.tipSize, 8, 6);
    for (const tip of [this.thumbTip, this.indexTip]) {
      const glow = new Mesh(tipGeometry, this.tipMaterial);
      glow.renderOrder = 6;
      tip.add(glow);
    }
    this.root.visible = false;
    parent.add(this.root);
  }

  /** Curls the fingers between two poses. */
  pose(from: GhostPose, to: GhostPose, s: number): number {
    for (const b of this.bones) {
      const curl = CURL[from][b.group] + (CURL[to][b.group] - CURL[from][b.group]) * s;
      b.bone.position.lerpVectors(b.openPosition, b.curledPosition, curl);
      b.bone.quaternion.slerpQuaternions(b.openQuaternion, b.curledQuaternion, curl);
    }
    // How much of a pinch this is, for the grab point and the glowing tips.
    const pinch = (from === 'pinch' ? 1 - s : 0) + (to === 'pinch' ? s : 0);
    return pinch;
  }

  /** The point that should touch the target: between the pinch tips, or the palm. World space. */
  grabPoint(pinch: number, out: Vector3): Vector3 {
    this.root.updateMatrixWorld(true);
    const tips = this.thumbTip.getWorldPosition(tempA).add(this.indexTip.getWorldPosition(tempB)).multiplyScalar(0.5);
    const palm = this.wrist.getWorldPosition(tempB).add(this.knuckle.getWorldPosition(tempC)).multiplyScalar(0.5);
    return out.copy(palm).lerp(tips, pinch);
  }
}

const tempA = new Vector3();
const tempB = new Vector3();
const tempC = new Vector3();
const from = new Vector3();
const to = new Vector3();
const point = new Vector3();
const grab = new Vector3();
const pointing = new Vector3();
const yaw = new Quaternion();
const tilt = new Quaternion();
const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);

/** Where a demo's anchors are right now (world, meters), or null if one is missing. */
export type AnchorLookup = (anchor: GhostAnchor, out: Vector3) => Vector3 | null;

/** The seat's view directions in world space: right, up and toward the player. */
export interface ViewFrame {
  right: Vector3;
  up: Vector3;
  back: Vector3;
  head: Vector3;
}

export class GhostHand {
  private models: Partial<Record<Side, GhostModel>> = {};
  private demo: GhostDemo | null = null;
  private demoName: GhostDemoName | null = null;
  private time = 0;
  /** Fades out while the player's own hand is at the target. */
  private presence = 1;

  async load(world: Object3D): Promise<void> {
    await Promise.all(
      (['left', 'right'] as Side[]).map(async (side) => {
        try {
          const gltf = await AssetManager.loadGLTF(gltfUrl(`hands/${side}.glb`));
          this.models[side] = new GhostModel(gltf.scene, side, world);
        } catch (error) {
          console.warn(`[ghost hand] could not load the ${side} hand`, error);
        }
      }),
    );
  }

  /** Starts a demo (or none). The same demo keeps its place in the loop. */
  play(name: GhostDemoName | null | undefined): void {
    const next = name ?? null;
    if (next === this.demoName) return;
    this.demoName = next;
    this.demo = next ? GHOST_DEMOS[next] : null;
    this.time = 0;
    for (const model of Object.values(this.models)) model.root.visible = false;
  }

  /**
   * Moves the ghost along the demo. `playerNear`: one of the player's own
   * hands is at the target, so the ghost steps out of the way.
   */
  update(dt: number, anchors: AnchorLookup, view: ViewFrame, playerNear: boolean): void {
    const demo = this.demo;
    const model = demo ? this.models[demo.hand] : undefined;
    for (const m of Object.values(this.models)) if (m !== model) m.root.visible = false;
    if (!demo || !model) return;
    this.time += dt;
    const keys = demo.keys;
    const last = keys[keys.length - 1];
    const loop = last.t + GHOST_HAND.fade + GHOST_HAND.rest;
    const t = this.time % loop;
    // The two keys around this moment, eased in and out.
    let i = 0;
    while (i < keys.length - 2 && t >= keys[i + 1].t) i++;
    const k0 = keys[i];
    const k1 = keys[Math.min(i + 1, keys.length - 1)];
    const span = k1.t - k0.t;
    const u = span > 0 ? Math.min(1, Math.max(0, (t - k0.t) / span)) : 1;
    const s = u * u * (3 - 2 * u);
    if (!this.keyPoint(k0.at, k0.offset, anchors, view, from) || !this.keyPoint(k1.at, k1.offset, anchors, view, to)) {
      model.root.visible = false;
      return;
    }
    point.lerpVectors(from, to, s);
    const pinch = model.pose(k0.pose, k1.pose, s);

    // Fingers point away from the player and a little down, palm down (plus the demo's roll).
    pointing.copy(point).sub(view.head).setY(0);
    if (pointing.lengthSq() < 1e-6) pointing.copy(view.back).negate();
    pointing.normalize();
    yaw.setFromAxisAngle(Y, Math.atan2(-pointing.x, -pointing.z));
    const side = demo.hand === 'right' ? 1 : -1;
    tilt.setFromAxisAngle(X, -degToRad(GHOST_HAND.pitchDeg));
    model.root.quaternion.copy(yaw).multiply(tilt);
    tilt.setFromAxisAngle(Z, side * degToRad(GHOST_HAND.palmRollDeg + (demo.rollDeg ?? 0)));
    model.root.quaternion.multiply(tilt);
    // Put the hand's grab point (pinch tips or palm) on the path point.
    model.root.position.copy(point);
    model.grabPoint(pinch, grab);
    model.root.position.add(point.sub(grab));

    // Fade in at the start of each loop, out after the last key, and away while the player's hand is there.
    const fadeIn = Math.min(1, t / GHOST_HAND.fade);
    const fadeOut = t > last.t ? Math.max(0, 1 - (t - last.t) / GHOST_HAND.fade) : 1;
    this.presence += ((playerNear ? 0 : 1) - this.presence) * Math.min(1, dt * 8);
    const alpha = fadeIn * fadeOut * this.presence;
    model.root.visible = alpha > 0.02;
    model.material.opacity = GHOST_HAND.opacity * alpha;
    model.tipMaterial.opacity = alpha * pinch;
  }

  hide(): void {
    this.play(null);
  }

  private keyPoint(at: GhostAnchor, offset: [number, number, number], anchors: AnchorLookup, view: ViewFrame, out: Vector3): boolean {
    if (!anchors(at, out)) return false;
    out.addScaledVector(view.right, offset[0] * 0.01);
    out.addScaledVector(view.up, offset[1] * 0.01);
    out.addScaledVector(view.back, offset[2] * 0.01);
    return true;
  }
}
