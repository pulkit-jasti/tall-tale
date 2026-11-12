// Rising camps (docs/custom-mode.md section 7). A camp that is not there yet
// waits under the ground, hidden (fewer draw calls early on); as its wave
// starts it slides up (a transform only, like the menu swap,
// src/world/sceneSwap.ts), with the drum from its direction, a dust burst,
// and the red threat arrow pointing at it until the player looks. The wave
// director says which camps are up and which rise; this only shows it.
import { Vector3, type Object3D } from 'three';
import type { GameAudio } from '../audio/sound.js';
import { POINTER, RISING_CAMPS as R } from '../config/game.js';
import { easeInOut } from '../fx/ease.js';
import type { Particles } from '../fx/particles.js';

interface Camp {
  group: Object3D;
  baseY: number;
  /** 0 under the ground, 1 up. */
  share: number;
  rising: boolean;
}

const temp = new Vector3();
const toCamp = new Vector3();

export class RisingCamps {
  private camps = new Map<string, Camp>();
  /** Camps that rose and the player has not looked at yet, with how long they have waited (seconds). */
  private unseen: { id: string; time: number }[] = [];

  constructor(
    private audio: GameAudio,
    private particles: Particles,
  ) {}

  /** A new map: its camp groups by camp id, every one up. */
  setCamps(groups: Map<string, Object3D>): void {
    this.camps.clear();
    this.unseen.length = 0;
    for (const [id, group] of groups) this.camps.set(id, { group, baseY: group.position.y, share: 1, rising: false });
  }

  /** True while a camp is up or coming up (the compass shows a tent for it). An unknown id counts as up. */
  isUp(id: string): boolean {
    const camp = this.camps.get(id);
    return !camp || camp.share >= 1 || camp.rising;
  }

  /** Every camp up at once (the menu, the welcome panel). */
  showAll(): void {
    this.unseen.length = 0;
    for (const camp of this.camps.values()) this.place(camp, 1, false);
  }

  /** At a battle's start: these camps wait under the ground, every other one is up. */
  setHidden(ids: string[]): void {
    this.unseen.length = 0;
    for (const [id, camp] of this.camps) this.place(camp, ids.includes(id) ? 0 : 1, false);
  }

  /** These camps come up now (a wave starts). One already up stays as it is. */
  raise(ids: string[]): void {
    for (const id of ids) {
      const camp = this.camps.get(id);
      if (!camp || camp.share >= 1 || camp.rising) continue;
      camp.rising = true;
      camp.group.visible = true;
      this.campWorld(camp, temp);
      this.audio.play('campRumble', temp);
      this.particles.burst(temp, R.dustColors, R.dustStart, R.dustSpeed);
      this.unseen.push({ id, time: 0 });
    }
  }

  update(dt: number): void {
    for (const camp of this.camps.values()) {
      if (!camp.rising) continue;
      const share = Math.min(1, camp.share + dt / R.riseTime);
      this.place(camp, share, share < 1);
      if (share >= 1) this.particles.burst(this.campWorld(camp, temp), R.dustColors, R.dustEnd, R.dustSpeed);
    }
  }

  /**
   * The newest risen camp the player has not looked at yet (world point, in
   * `out`), for the red threat arrow, or null. A camp counts as seen once it
   * is within POINTER.showDeg of the look, or after RISING_CAMPS.arrowFor.
   */
  unseenWorld(dt: number, head: Vector3, forward: Vector3, out: Vector3): Vector3 | null {
    for (let i = this.unseen.length - 1; i >= 0; i--) {
      const entry = this.unseen[i];
      const camp = this.camps.get(entry.id);
      entry.time += dt;
      if (!camp || entry.time > R.arrowFor) {
        this.unseen.splice(i, 1);
        continue;
      }
      this.campWorld(camp, toCamp).sub(head);
      if ((forward.angleTo(toCamp) * 180) / Math.PI < POINTER.showDeg) this.unseen.splice(i, 1);
    }
    const last = this.unseen[this.unseen.length - 1];
    const camp = last ? this.camps.get(last.id) : undefined;
    return camp ? this.campWorld(camp, out) : null;
  }

  /** The camp's middle in the world, at its standing height (its group's userData.center, in the board's frame). */
  private campWorld(camp: Camp, out: Vector3): Vector3 {
    const center = camp.group.userData.center as Vector3 | undefined;
    out.copy(center ?? camp.group.position);
    const parent = camp.group.parent;
    if (!parent) return out;
    parent.updateWorldMatrix(true, false);
    return parent.localToWorld(out);
  }

  private place(camp: Camp, share: number, rising: boolean): void {
    camp.share = share;
    camp.rising = rising;
    camp.group.position.y = camp.baseY - (1 - easeInOut(share)) * R.depth;
    camp.group.visible = share > 0;
  }
}
