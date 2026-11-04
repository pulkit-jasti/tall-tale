// Mouse look for playing in a desktop browser without a headset.
// Drag with the mouse to look around, scroll to zoom. Does nothing in VR,
// where the headset drives the camera.
import { createSystem, VisibilityState } from '@iwsdk/core';
import { MathUtils } from 'three';
import { MOUSE_LOOK } from '../config/game.js';

export class MouseLookSystem extends createSystem({}) {
  private yaw = 0;
  private pitch = 0;
  private fov = 0;
  private dragging = false;

  init(): void {
    this.camera.rotation.order = 'YXZ';
    this.yaw = this.camera.rotation.y;
    this.pitch = this.camera.rotation.x;
    this.fov = this.camera.fov;

    const canvas = this.renderer.domElement as HTMLCanvasElement;
    const maxPitch = MathUtils.degToRad(MOUSE_LOOK.maxPitchDeg);
    const radPerPixel = MathUtils.degToRad(MOUSE_LOOK.degPerPixel);

    const onPointerDown = (event: PointerEvent) => {
      if (this.immersive) return;
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
      if (this.immersive) return;
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

  update(): void {
    if (this.immersive) {
      this.dragging = false;
      return;
    }
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    if (this.camera.fov !== this.fov) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
