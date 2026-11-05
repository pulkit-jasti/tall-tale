// Seeing attacks without sound (docs/controls-and-ui.md "Threat cues"), for
// players who cannot hear and players with the sound off: each wall hit
// flashes that part of the wall top red, with a dust puff. Cheap to draw: a
// small pool of flash boxes.
import { BoxGeometry, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { CASTLE, THREAT } from '../config/game.js';
import type { Particles } from '../fx/particles.js';
import { angleOf, polarX, polarZ } from '../rules/boardMath.js';
import type { Goblin } from '../units/goblins.js';
import type { Stage } from '../world/stage.js';

const temp = new Vector3();

interface Flash {
  mesh: Mesh;
  material: MeshBasicMaterial;
  time: number;
}

export class ThreatCues {
  private flashes: Flash[] = [];
  private nextFlash = 0;

  constructor(
    private stage: Stage,
    private particles: Particles,
  ) {
    // Wall top flashes, in boardSpin: they sit on the wall where it was hit.
    const depth = CASTLE.wallOut - CASTLE.wallIn;
    const geometry = new BoxGeometry(THREAT.flashWidth, 0.25, depth);
    for (let i = 0; i < THREAT.flashPool; i++) {
      const material = new MeshBasicMaterial({ color: THREAT.flashColor, transparent: true, opacity: 0, depthWrite: false, fog: false });
      const mesh = new Mesh(geometry, material);
      mesh.visible = false;
      stage.boardSpin.add(mesh);
      this.flashes.push({ mesh, material, time: 0 });
    }
  }

  /** A goblin hit the wall: flash the wall top where it stands, and a dust puff. */
  wallHit(goblin: Goblin): void {
    if (!THREAT.enabled) return;
    const p = goblin.root.position;
    const a = angleOf(p.x, p.z);
    const flash = this.flashes[this.nextFlash];
    this.nextFlash = (this.nextFlash + 1) % this.flashes.length;
    const r = (CASTLE.wallIn + CASTLE.wallOut) / 2;
    flash.mesh.position.set(polarX(r, a), CASTLE.wallHeight + 0.15, polarZ(r, a));
    flash.mesh.rotation.y = -a;
    flash.mesh.visible = true;
    flash.time = THREAT.flashTime;
    flash.material.opacity = THREAT.flashOpacity;
    temp.set(polarX(CASTLE.wallOut, a), CASTLE.wallHeight, polarZ(CASTLE.wallOut, a));
    this.particles.burst(this.stage.boardSpin.localToWorld(temp), THREAT.dustColors, THREAT.dustCount, THREAT.dustSpeed);
  }

  update(dt: number): void {
    if (!THREAT.enabled) return;
    for (const flash of this.flashes) {
      if (flash.time <= 0) continue;
      flash.time -= dt;
      if (flash.time <= 0) {
        flash.mesh.visible = false;
        continue;
      }
      flash.material.opacity = THREAT.flashOpacity * (flash.time / THREAT.flashTime);
    }
  }
}
