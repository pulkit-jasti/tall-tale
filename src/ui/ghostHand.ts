// A see-through ghost hand that loops a demonstration of the current lesson
// (src/ui/ghostDemos.ts) right on the real thing to grab or pinch. The model
// is Meta's standard WebXR hand ("generic-hand" from WebXR Input Profiles,
// public/gltf/hands/), at real hand size in world space (meters).
//
// Poses, all made once at load:
//   fist:  IWSDK's pressed pose (AnimatedControllerHand), a hand closed around
//          a controller handle. The handle's center is the model's origin, so
//          that is where a bar goes.
//   open:  IWSDK's relaxed pose, opened a little further.
//   pinch: the pressed pose with the thumb and index tips bent until they
//          touch (a few steps of simple IK), so the pinch is real.
// How the hand is turned is not guessed: its own directions are measured from
// the joints (wrist to knuckles, the knuckle line, the side the fingers curl
// to) and lined up with the directions each demo key asks for.
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
import { holdTilt, type HoldName } from '../player/hold.js';
import { gltfUrl } from '../world/models.js';
import { GHOST_DEMOS, type Dir, type GhostAnchor, type GhostDemo, type GhostDemoName, type GhostKey, type GhostPose } from './ghostDemos.js';

type Side = 'left' | 'right';

interface JointPose {
  position: Vector3;
  quaternion: Quaternion;
}

/** One full hand pose: a transform per bone (same order as GhostModel.bones). */
type HandPose = JointPose[];

const INDEX_CHAIN = ['index-finger-phalanx-proximal', 'index-finger-phalanx-intermediate', 'index-finger-phalanx-distal', 'index-finger-tip'];
const THUMB_CHAIN = ['thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip'];

const tempA = new Vector3();
const tempB = new Vector3();
const tempC = new Vector3();
const tempQ = new Quaternion();

class GhostModel {
  readonly root = new Group();
  readonly material: MeshStandardMaterial;
  readonly tipMaterial: MeshBasicMaterial;
  private bones: Object3D[] = [];
  private names: string[] = [];
  private poses = {} as Record<GhostPose, HandPose>;
  /** Hand directions in its own space (measured from the joints). */
  readonly fingers = new Vector3();
  readonly palm = new Vector3();
  readonly knuckles = new Vector3();
  /** Contact points in its own space: the fist's hole and the pinch tips. */
  readonly holeContact = new Vector3();
  readonly pinchContact = new Vector3();

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

    // IWSDK's two poses, for a right hand. Mirrored for the left one, as IWSDK does.
    const matrix = new Matrix4();
    const scale = new Vector3();
    const relaxed: HandPose = [];
    const pressed: HandPose = [];
    const sources = [AnimatedControllerHand.defaultPose, AnimatedControllerHand.pressedPose] as Record<string, number[]>[];
    for (const joint of Object.keys(sources[0])) {
      const bone = model.getObjectByName(joint);
      if (!bone) continue;
      this.bones.push(bone);
      this.names.push(joint);
      sources.forEach((source, i) => {
        const pose = { position: new Vector3(), quaternion: new Quaternion() };
        matrix.fromArray(source[joint]).decompose(pose.position, pose.quaternion, scale);
        if (side === 'left') {
          pose.position.x *= -1;
          pose.quaternion.x *= -1;
          pose.quaternion.w *= -1;
        }
        (i === 0 ? relaxed : pressed).push(pose);
      });
    }
    this.poses.fist = pressed;
    this.poses.open = blendPose(relaxed, pressed, -GHOST_HAND.openExtra);
    this.poses.pinch = this.makePinch(pressed);
    this.measure(relaxed, pressed);

    // Glowing fingertips, so a pinch shows which fingers do it.
    this.tipMaterial = new MeshBasicMaterial({ color: GHOST_HAND.tipColor, transparent: true, depthWrite: false, fog: false });
    const tipGeometry = new SphereGeometry(GHOST_HAND.tipSize, 8, 6);
    for (const name of ['thumb-tip', 'index-finger-tip']) {
      const glow = new Mesh(tipGeometry, this.tipMaterial);
      glow.renderOrder = 6;
      model.getObjectByName(name)?.add(glow);
    }
    this.root.visible = false;
    parent.add(this.root);
  }

  /** Sets the bones between two poses. */
  pose(from: GhostPose, to: GhostPose, s: number): void {
    const a = this.poses[from];
    const b = this.poses[to];
    for (let i = 0; i < this.bones.length; i++) {
      this.bones[i].position.lerpVectors(a[i].position, b[i].position, s);
      this.bones[i].quaternion.slerpQuaternions(a[i].quaternion, b[i].quaternion, s);
    }
  }

  private index(name: string): number {
    return this.names.indexOf(name);
  }

  /** Position of a joint in the hand's own space for a pose (bones are flat, so their space is the model's). */
  private at(pose: HandPose, name: string, out: Vector3): Vector3 {
    return out.copy(pose[this.index(name)].position);
  }

  /** The pressed pose with the thumb and index tips bent together until they touch (CCD IK). */
  private makePinch(pressed: HandPose): HandPose {
    const pose = pressed.map((p) => ({ position: p.position.clone(), quaternion: p.quaternion.clone() }));
    const index = INDEX_CHAIN.map((n) => this.index(n));
    const thumb = THUMB_CHAIN.map((n) => this.index(n));
    if (index.includes(-1) || thumb.includes(-1)) return pose;
    const tipIndex = pose[index[index.length - 1]].position;
    const tipThumb = pose[thumb[thumb.length - 1]].position;
    const meet = new Vector3();
    const gap = new Vector3();
    const goal = new Vector3();
    for (let round = 0; round < GHOST_HAND.pinchIkRounds; round++) {
      // Both tips aim at the point between them, just touching.
      meet.addVectors(tipIndex, tipThumb).multiplyScalar(0.5);
      gap.subVectors(tipIndex, tipThumb).normalize().multiplyScalar(GHOST_HAND.pinchTouch / 2);
      reachChain(pose, index, goal.copy(meet).add(gap));
      reachChain(pose, thumb, goal.copy(meet).sub(gap));
    }
    return pose;
  }

  /** Measures the hand's own directions and contact points from its joints. */
  private measure(relaxed: HandPose, pressed: HandPose): void {
    const wrist = this.at(relaxed, 'wrist', new Vector3());
    const knuckle = this.at(relaxed, 'middle-finger-phalanx-proximal', new Vector3());
    // Fingers: wrist to the middle knuckle.
    this.fingers.subVectors(knuckle, wrist).normalize();
    // The bar's direction through the fist: each curled finger bends in a plane
    // square to the bar, so the bar runs along the average bend axis. Pointed
    // to the thumb side (pinky knuckle to index knuckle).
    const thumbSide = new Vector3().subVectors(
      this.at(relaxed, 'index-finger-phalanx-proximal', tempA),
      this.at(relaxed, 'pinky-finger-phalanx-proximal', tempB),
    );
    this.knuckles.set(0, 0, 0);
    const bend = new Vector3();
    for (const finger of ['index', 'middle', 'ring', 'pinky']) {
      const prox = this.at(pressed, `${finger}-finger-phalanx-proximal`, new Vector3());
      const inter = this.at(pressed, `${finger}-finger-phalanx-intermediate`, new Vector3());
      const distal = this.at(pressed, `${finger}-finger-phalanx-distal`, new Vector3());
      bend.crossVectors(inter.sub(prox), distal.sub(this.at(pressed, `${finger}-finger-phalanx-intermediate`, tempC)));
      if (bend.lengthSq() < 1e-12) continue;
      bend.normalize();
      if (bend.dot(thumbSide) < 0) bend.negate();
      this.knuckles.add(bend);
    }
    if (this.knuckles.lengthSq() < 1e-12) this.knuckles.copy(thumbSide);
    this.knuckles.normalize();
    // Palm side: where the fingers curl to in a fist.
    this.palm.subVectors(this.at(pressed, 'middle-finger-tip', tempA), knuckle);
    this.palm.addScaledVector(this.fingers, -this.palm.dot(this.fingers)).normalize();
    // The fist's hole is the controller handle's center: the model origin.
    this.holeContact.set(0, 0, 0);
    this.at(this.poses.pinch, 'index-finger-tip', tempA);
    this.at(this.poses.pinch, 'thumb-tip', tempB);
    this.pinchContact.addVectors(tempA, tempB).multiplyScalar(0.5);
  }
}

/**
 * One CCD pass: turns each joint of a chain (root first in the list, tip
 * last) so the tip moves toward the goal, a limited angle per joint.
 */
function reachChain(pose: HandPose, chain: number[], goal: Vector3): void {
  const tip = pose[chain[chain.length - 1]].position;
  const turn = new Quaternion();
  for (let j = chain.length - 2; j >= 0; j--) {
    const pivot = pose[chain[j]].position;
    tempA.subVectors(tip, pivot).normalize();
    tempB.subVectors(goal, pivot).normalize();
    turn.setFromUnitVectors(tempA, tempB);
    const angle = 2 * Math.acos(Math.min(1, Math.abs(turn.w)));
    const limit = (GHOST_HAND.pinchIkStepDeg * Math.PI) / 180;
    if (angle > limit) turn.slerp(tempQ.identity(), 1 - limit / angle);
    // The joint and everything after it turn around the joint.
    for (let k = j; k < chain.length; k++) {
      const p = pose[chain[k]];
      if (k > j) p.position.sub(pivot).applyQuaternion(turn).add(pivot);
      p.quaternion.premultiply(turn);
    }
  }
}

function blendPose(a: HandPose, b: HandPose, s: number): HandPose {
  return a.map((p, i) => ({
    position: new Vector3().lerpVectors(p.position, b[i].position, s),
    quaternion: new Quaternion().slerpQuaternions(p.quaternion, b[i].quaternion, s),
  }));
}

/** Where a demo's anchors are right now (world, meters), or null if one is missing. `arcDeg`: ring only. */
export type AnchorLookup = (anchor: GhostAnchor, out: Vector3, arcDeg?: number) => Vector3 | null;

/** Directions in world space for the demo frames. */
export interface ViewFrame {
  head: Vector3;
  up: Vector3;
  /** Level direction of the slingshot's shot, for demos with frame 'shot'. */
  shot: Vector3;
}

const right = new Vector3();
const forward = new Vector3();
const anchorPoint = new Vector3();
const pointA = new Vector3();
const pointB = new Vector3();
const quatA = new Quaternion();
const quatB = new Quaternion();
const localBasis = new Matrix4();
const worldBasis = new Matrix4();
const contact = new Vector3();
const axisW = new Vector3();
const palmW = new Vector3();
const third = new Vector3();
const fingerward = new Vector3();
/** Tool handles are held at the same slant as a real grab (src/player/hold.ts). The ring keeps its approved grip. */
const TOOL_HANDLES: Partial<Record<GhostAnchor, HoldName>> = {
  slingHandle: 'slingshot',
  swatterHandle: 'swatter',
  pepperHandle: 'pepper',
};

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
   * hands is where the demo ends, so the ghost steps out of the way.
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
    if (!this.place(model, k0, demo, anchors, view, pointA, quatA) || !this.place(model, k1, demo, anchors, view, pointB, quatB)) {
      model.root.visible = false;
      return;
    }
    model.pose(k0.pose, k1.pose, s);
    model.root.quaternion.slerpQuaternions(quatA, quatB, s);
    model.root.position.lerpVectors(pointA, pointB, s);

    // Fade in at the start of each loop, out after the last key, and away while the player's hand is there.
    const fadeIn = Math.min(1, t / GHOST_HAND.fade);
    const fadeOut = t > last.t ? Math.max(0, 1 - (t - last.t) / GHOST_HAND.fade) : 1;
    this.presence += ((playerNear ? 0 : 1) - this.presence) * Math.min(1, dt * 8);
    const alpha = fadeIn * fadeOut * this.presence;
    model.root.visible = alpha > 0.02;
    model.material.opacity = GHOST_HAND.opacity * alpha;
    const pinch = (k0.pose === 'pinch' ? 1 - s : 0) + (k1.pose === 'pinch' ? s : 0);
    model.tipMaterial.opacity = alpha * pinch;
  }

  hide(): void {
    this.play(null);
  }

  /**
   * Where the model's origin goes and how it is turned for one key, so that
   * its contact point (fist hole or pinch tips) lands exactly on the target.
   */
  private place(
    model: GhostModel,
    key: GhostKey,
    demo: GhostDemo,
    anchors: AnchorLookup,
    view: ViewFrame,
    outPosition: Vector3,
    outQuaternion: Quaternion,
  ): boolean {
    if (!anchors(key.at, anchorPoint, key.arcDeg)) return false;
    // The key's frame: forward is level, from the head toward the anchor (or along the shot).
    if (demo.frame === 'shot') forward.copy(view.shot);
    else forward.copy(anchorPoint).sub(view.head);
    forward.y = 0;
    if (forward.lengthSq() < 1e-8) forward.set(0, 0, -1);
    forward.normalize();
    right.crossVectors(forward, view.up).normalize();
    const toWorld = (d: Dir, out: Vector3): Vector3 =>
      out.set(0, 0, 0).addScaledVector(right, d[0]).addScaledVector(view.up, d[1]).addScaledVector(forward, d[2]);
    // The target point.
    toWorld(key.offset, tempC).multiplyScalar(0.01).add(anchorPoint);
    // Line up the hand's own axis (knuckle line for bars, fingers for pinches) and palm.
    const rodKey = key.rod !== undefined;
    toWorld(rodKey ? key.rod! : (key.fingers ?? [0, 0, 1]), axisW);
    toWorld(key.palm, palmW);
    const tool = rodKey ? TOOL_HANDLES[key.at] : undefined;
    if (tool) {
      // A fist holds a tool handle at a slant: the handle leans toward the
      // fingers from the knuckle line. So the knuckle line is the handle
      // turned back by the same angle around the palm's normal.
      const tilt = holdTilt(tool);
      axisW.normalize();
      palmW.addScaledVector(axisW, -palmW.dot(axisW)).normalize();
      fingerward.crossVectors(axisW, palmW).multiplyScalar(demo.hand === 'left' ? 1 : -1);
      axisW.multiplyScalar(Math.cos(tilt)).addScaledVector(fingerward, -Math.sin(tilt));
    }
    basis(rodKey ? model.knuckles : model.fingers, model.palm, localBasis);
    basis(axisW, palmW, worldBasis);
    outQuaternion.setFromRotationMatrix(worldBasis.multiply(localBasis.transpose()));
    // Contact point: the fist's hole around a bar, the pinch tips otherwise (also
    // while the hand is still open, so closing it does not jump).
    contact.copy(rodKey ? model.holeContact : model.pinchContact).applyQuaternion(outQuaternion);
    outPosition.copy(tempC).sub(contact);
    return true;
  }
}

/** Orthonormal basis (axis, palm made square to it, and their cross) as matrix columns. */
function basis(axis: Vector3, palm: Vector3, out: Matrix4): Matrix4 {
  const a = tempA.copy(axis).normalize();
  const p = tempB.copy(palm).addScaledVector(a, -palm.dot(a)).normalize();
  third.crossVectors(a, p);
  return out.makeBasis(a, p, third);
}
