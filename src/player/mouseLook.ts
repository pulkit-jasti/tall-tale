// Mouse look for playing in a desktop browser without a headset.
// Drag with the mouse to look around, scroll to zoom. Does nothing in VR,
// where the headset drives the camera.
//
// While the 2D start page shows, the camera instead looks across the castle
// while slowly circling it (LANDING_VIEW), so the real board plays
// behind the page. The giant's
// real eye pose is kept (landingHome) so the board and the giant's body are
// still placed from the eyes, never from the circling camera.
import { createSystem, VisibilityState } from '@iwsdk/core';
import { MathUtils, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { BOARD, DAY_NIGHT, LANDING_VIEW, MOUSE_LOOK, type TimeOfDay } from '../config/game.js';

const landing = {
  on: true,
  camera: null as PerspectiveCamera | null,
  homePosition: new Vector3(),
  homeQuaternion: new Quaternion(),
};

/** Turns the start page's circling camera on or off. Off puts the camera back at the eyes at once. */
export function setLandingView(on: boolean): void {
  landing.on = on;
  const camera = landing.camera;
  if (!on && camera) {
    camera.position.copy(landing.homePosition);
    camera.quaternion.copy(landing.homeQuaternion);
    camera.updateMatrixWorld();
  }
}

/** True while the start page's camera is on (before VR, until Enter or Play). */
export function landingViewOn(): boolean {
  return landing.on;
}

/** While the start page's camera is on: the giant's real eye pose (local to the player). Else false. */
export function landingHome(position: Vector3, quaternion: Quaternion): boolean {
  if (!landing.on || !landing.camera) return false;
  position.copy(landing.homePosition);
  quaternion.copy(landing.homeQuaternion);
  return true;
}

// The start page's time of day, picked once per page load. Decor only (never
// gameplay), so it skips the seeded game random on purpose.
const pickedTime = LANDING_VIEW.times[Math.floor(Math.random() * LANDING_VIEW.times.length)];

/** The time of day the start page shows (random per load, never noon). */
export function landingTime(): TimeOfDay {
  return pickedTime;
}

const lookTarget = new Vector3();

export class MouseLookSystem extends createSystem({}) {
  private yaw = 0;
  private pitch = 0;
  private fov = 0;
  private dragging = false;
  private orbit = 0;

  init(): void {
    this.camera.rotation.order = 'YXZ';
    this.yaw = this.camera.rotation.y;
    this.pitch = this.camera.rotation.x;
    this.fov = this.camera.fov;
    landing.camera = this.camera;
    landing.homePosition.copy(this.camera.position);
    landing.homeQuaternion.copy(this.camera.quaternion);

    const canvas = this.renderer.domElement as HTMLCanvasElement;
    const maxPitch = MathUtils.degToRad(MOUSE_LOOK.maxPitchDeg);
    const radPerPixel = MathUtils.degToRad(MOUSE_LOOK.degPerPixel);

    const onPointerDown = (event: PointerEvent) => {
      if (this.immersive || landing.on) return;
      this.dragging = true;
      canvas.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!this.dragging) return;
      this.yaw -= event.movementX * radPerPixel;
      this.pitch = MathUtils.clamp(this.pitch - event.movementY * radPerPixel, -maxPitch, maxPitch);
    };
    const onPointerUp = (event: PointerEvent) => {
      this.dragging = false;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };
    const onWheel = (event: WheelEvent) => {
      if (this.immersive || landing.on) return;
      event.preventDefault();
      const step = Math.sign(event.deltaY) * MOUSE_LOOK.fovPerWheelStep;
      this.fov = MathUtils.clamp(this.fov + step, MOUSE_LOOK.minFov, MOUSE_LOOK.maxFov);
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    this.cleanupFuncs.push(() => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
    });
  }

  private get immersive(): boolean {
    return this.visibilityState.value !== VisibilityState.NonImmersive;
  }

  update(delta: number): void {
    if (this.immersive) {
      this.dragging = false;
      return;
    }
    if (landing.on) {
      this.circle(delta);
      return;
    }
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    if (this.camera.fov !== this.fov) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  /** The start page's camera: above the castle, looking across it, slowly circling (starts facing the sun). */
  private circle(delta: number): void {
    const view = LANDING_VIEW;
    this.orbit = (this.orbit + (delta / view.turnSeconds) * Math.PI * 2) % (Math.PI * 2);
    // The sun's compass angle in the start page's time of day (0 = the giant's front, positive = right).
    const sunDeg = DAY_NIGHT.looks[pickedTime].sunAt[0];
    const angle = this.yaw + MathUtils.degToRad(-sunDeg) + this.orbit;
    const boardY = landing.homePosition.y - BOARD.eyeToBoard;
    const cx = landing.homePosition.x;
    const cz = landing.homePosition.z;
    // The direction toward the sun along the ground (forward is -z, a positive compass angle is +x).
    const dx = -Math.sin(angle);
    const dz = -Math.cos(angle);
    // Behind the center on the side away from the sun, looking past the center toward it.
    this.camera.position.set(cx - dx * view.distance, boardY + view.height, cz - dz * view.distance);
    lookTarget.set(cx + dx * view.lookAhead, boardY + view.lookHeight, cz + dz * view.lookAhead);
    this.camera.lookAt(lookTarget);
  }
}
