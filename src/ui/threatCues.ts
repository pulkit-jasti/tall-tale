// Seeing attacks without sound (docs/controls-and-ui.md "Threat cues"), for
// players who cannot hear and players with the sound off: each wall hit
// flashes that part of the wall top red, with a dust puff. Cheap to draw: a
// small pool of flash boxes. And a red 3D arrow in front of the face that
// points at a goblin hitting the wall while it has been out of view for a
// moment, so no goblin hides behind the player.
import { BoxGeometry, Mesh, MeshBasicMaterial, Vector3, type Object3D } from 'three';
import { BALLOONS, CASTLE, POINTER, THREAT } from '../config/game.js';
import { PointerArrow } from './pointerArrow.js';
import type { Particles } from '../fx/particles.js';
import { angleOf, polarX, polarZ } from '../rules/boardMath.js';
import type { Goblin, Goblins } from '../units/goblins.js';
import type { Stage } from '../world/stage.js';

const temp = new Vector3();
const toGoblin = new Vector3();
const arrowAt = new Vector3();

interface Flash {
  mesh: Mesh;
  material: MeshBasicMaterial;
  time: number;
}

export class ThreatCues {
  private flashes: Flash[] = [];
  private nextFlash = 0;
  private arrow: PointerArrow;
  /** How long each goblin at the wall has been out of view (seconds). */
  private unseen = new Map<Goblin, number>();
  /** The goblin the red arrow points at, kept while it stays a threat out of view. */
  private pointed: Goblin | null = null;

  constructor(
    private stage: Stage,
    private particles: Particles,
    world: Object3D,
  ) {
    this.arrow = new PointerArrow(world, POINTER.threat);
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

  /** A goblin hit the wall: flash the wall top where it stands, and a dust puff. `dust` false: the flash only (a climber running on it). */
  wallHit(goblin: Goblin, dust = true): void {
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
    if (!dust) return;
    temp.set(polarX(CASTLE.wallOut, a), CASTLE.wallHeight, polarZ(CASTLE.wallOut, a));
    this.particles.burst(this.stage.boardSpin.localToWorld(temp), THREAT.dustColors, THREAT.dustCount, THREAT.dustSpeed);
  }

  /**
   * The red arrow: at a goblin hitting the wall, climbing it or on the rampart that has
   * been at the edge of the view or out of it for POINTER.threatAfter.
   */
  /**
   * The red arrow points at one threat at a time: the nearest to where the
   * player looks among those out of view long enough, and it stays on that
   * one until it is handled (no longer at the wall, on it or over it), even
   * while it is in view (the arrow just hides then). Only then the next one.
   * So it never jumps between goblins and confuses the player.
   */
  /** `camp`: a camp that just rose and was not looked at yet (world): the arrow points there while no goblin needs it. */
  updateArrow(dt: number, goblins: Goblins, head: Vector3, forward: Vector3, camp: Vector3 | null = null): void {
    if (!THREAT.enabled) return;
    let keep = false;
    let best: Goblin | null = null;
    let bestAngle = Infinity;
    for (const g of goblins.list) {
      // At the wall, climbing it, on top of it running about, or riding a balloon over it.
      const p = g.root.position;
      const overWall = g.mode === 'riding' && p.x * p.x + p.z * p.z < (CASTLE.wallOut + BALLOONS.threatOut) ** 2;
      if (g.mode !== 'atWall' && g.mode !== 'climbing' && g.mode !== 'rampart' && !overWall) {
        if (this.unseen.has(g)) this.unseen.delete(g);
        continue;
      }
      if (g === this.pointed) keep = true;
      goblins.centerWorld(g, toGoblin).sub(head);
      const angle = (forward.angleTo(toGoblin) * 180) / Math.PI;
      const time = angle > POINTER.showDeg ? (this.unseen.get(g) ?? 0) + dt : 0;
      this.unseen.set(g, time);
      if (time >= POINTER.threatAfter && angle < bestAngle) {
        best = g;
        bestAngle = angle;
      }
    }
    if (!keep) this.pointed = best;
    const target = this.pointed;
    this.arrow.update(dt, head, forward, target ? goblins.centerWorld(target, arrowAt) : camp);
  }

  hideArrow(): void {
    this.arrow.hide();
    this.pointed = null;
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
