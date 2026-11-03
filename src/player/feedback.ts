// The shared Idle, Ready, Held and Locked look for everything the player can
// touch (docs/controls-and-ui.md). Emissive color only, no outlines.
import type { MeshStandardMaterial } from 'three';
import { FEEDBACK } from '../config/game.js';

export type TouchState = 'idle' | 'ready' | 'held' | 'locked';

export function applyTouchState(materials: MeshStandardMaterial[], state: TouchState): void {
  for (const m of materials) {
    switch (state) {
      case 'ready':
        m.emissive.setHex(FEEDBACK.ready);
        m.emissiveIntensity = 1;
        break;
      case 'held':
        m.emissive.setHex(FEEDBACK.held);
        m.emissiveIntensity = FEEDBACK.heldIntensity;
        break;
      default:
        m.emissive.setHex(FEEDBACK.locked);
        m.emissiveIntensity = 1;
    }
  }
}
