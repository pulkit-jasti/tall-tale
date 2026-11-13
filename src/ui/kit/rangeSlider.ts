// The range slider (docs/custom-mode.md "UI kit parts"): one track with two
// round handles, a minimum and a maximum (camp distance 330 to 430 cm), the
// part between them filled. It works like the one Slider: touch a handle
// with the index finger and slide, it follows 1:1 and lets go when the
// finger pulls back off the face; a tick at every step, a click on letting
// go, the same Idle, Ready and Held looks. The two handles never cross: they
// stay at least one step apart. Its face points along +z, the track along x.
import { BoxGeometry, CylinderGeometry, Group, Mesh, Vector3, type MeshStandardMaterial } from 'three';
import type { GameAudio } from '../../audio/sound.js';
import { POKE, SLIDER } from '../../config/game.js';
import type { TouchState } from '../../player/feedback.js';
import type { HandState } from '../../player/hands.js';
import { flatMaterial } from '../../world/shapes.js';
import { canDrag, changeTouch, endDrag, takeDrag, type Control } from './controls.js';
import { clamp01 } from './layout.js';

const local = new Vector3();

export class RangeSlider implements Control {
  readonly group = new Group();
  /** `final` is true when a move ends (the finger lets go). */
  onChange: (low: number, high: number, final: boolean) => void = () => {};
  private values: [number, number];
  private handles: Mesh[] = [];
  private materials: MeshStandardMaterial[] = [];
  private touches: TouchState[] = ['idle', 'idle'];
  private fill: Mesh;
  private held: { hand: HandState; which: 0 | 1; offset: number } | null = null;
  private armed = false;
  private lastZ = new Map<HandState, number>();
  private cooldown = 0;

  constructor(
    private audio: GameAudio,
    private length: number,
    private steps: number,
    low: number,
    high: number,
  ) {
    const S = SLIDER;
    this.values = [clamp01(Math.min(low, high)), clamp01(Math.max(low, high))];
    const track = new Mesh(new BoxGeometry(length + S.trackHeight, S.trackHeight, S.trackDepth), flatMaterial(POKE.rimColor));
    track.position.z = S.trackDepth / 2;
    this.fill = new Mesh(new BoxGeometry(1, S.trackHeight * 0.62, S.trackDepth * 0.4), flatMaterial(S.fillColor));
    this.fill.position.z = S.trackDepth + 0.05;
    this.group.add(track, this.fill);
    for (let i = 0; i < 2; i++) {
      const material = flatMaterial(S.handleColor);
      material.flatShading = false;
      const handle = new Mesh(new CylinderGeometry(S.handleRadius, S.handleRadius, S.handleDepth, POKE.segments), material);
      handle.rotation.x = Math.PI / 2;
      handle.position.z = S.trackDepth + S.handleDepth / 2;
      this.handles.push(handle);
      this.materials.push(material);
      this.group.add(handle);
    }
    this.show();
  }

  /** End to end, both handles included (cm). */
  get width(): number {
    return this.length + 2 * SLIDER.handleRadius;
  }

  get low(): number {
    return this.values[0];
  }

  get high(): number {
    return this.values[1];
  }

  setValues(low: number, high: number): void {
    this.values = [clamp01(Math.min(low, high)), clamp01(Math.max(low, high))];
    this.show();
  }

  lock(seconds: number): void {
    this.cooldown = Math.max(this.cooldown, seconds);
  }

  reset(): void {
    this.held = null;
    endDrag(this);
    this.armed = false;
    this.lastZ.clear();
    this.setTouch(0, 'idle');
    this.setTouch(1, 'idle');
  }

  update(hands: HandState[], dt: number): void {
    const S = SLIDER;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.group.updateWorldMatrix(true, false);
    if (this.held) {
      const { hand, which, offset } = this.held;
      this.group.worldToLocal(local.copy(hand.indexTip));
      if (!hand.tracked || local.z > S.releaseOut || Math.abs(local.y) > S.zoneHeight * 1.6) {
        this.held = null;
        endDrag(this);
        this.setTouch(which, 'idle');
        this.audio.play('buttonClick');
        this.onChange(this.values[0], this.values[1], true);
        return;
      }
      takeDrag(this);
      this.moveTo(which, local.x + offset);
      return;
    }
    // The handle nearest a fingertip over either one is the one that lights up and can be grabbed.
    let ready: 0 | 1 | null = null;
    const reach = S.handleRadius + S.handleMargin;
    let front = false;
    for (const hand of hands) {
      if (!hand.tracked) {
        this.lastZ.delete(hand);
        continue;
      }
      this.group.worldToLocal(local.copy(hand.indexTip));
      const d = this.values.map((v) => Math.abs(local.x - (v - 0.5) * this.length));
      const which: 0 | 1 = d[0] < d[1] || (d[0] === d[1] && local.x < (this.values[0] - 0.5) * this.length) ? 0 : 1;
      const dx = d[which];
      if (dx * dx + local.y * local.y > reach * reach || local.z < -S.zoneBehind) {
        this.lastZ.delete(hand);
        continue;
      }
      const before = this.lastZ.get(hand);
      this.lastZ.set(hand, local.z);
      const quick = before !== undefined && before > S.touchAt + 0.3;
      if (local.z > S.touchAt + 0.3) front = true;
      if (local.z > S.readyDistance) continue;
      ready = which;
      if (local.z <= S.touchAt && (this.armed || quick) && this.cooldown <= 0 && canDrag(this)) {
        this.held = { hand, which, offset: (this.values[which] - 0.5) * this.length - local.x };
        takeDrag(this);
        this.setTouch(which, 'held');
        this.setTouch(which === 0 ? 1 : 0, 'idle');
        return;
      }
    }
    this.armed = ready !== null ? this.armed || front : false;
    this.setTouch(0, ready === 0 ? 'ready' : 'idle');
    this.setTouch(1, ready === 1 ? 'ready' : 'idle');
  }

  /** One handle to a spot along the track, on its steps, never past the other one (at least one step apart). */
  private moveTo(which: 0 | 1, x: number): void {
    const step = 1 / this.steps;
    let next = Math.round(clamp01(x / this.length + 0.5) * this.steps) / this.steps;
    if (which === 0) next = Math.min(next, this.values[1] - step);
    else next = Math.max(next, this.values[0] + step);
    next = clamp01(next);
    if (Math.abs(next - this.values[which]) < 1e-9) return;
    this.values[which] = next;
    this.audio.play('readyTick', undefined, 0.8, 0.03);
    this.show();
    this.onChange(this.values[0], this.values[1], false);
  }

  private show(): void {
    const [a, b] = this.values.map((v) => (v - 0.5) * this.length);
    this.handles[0].position.x = a;
    this.handles[1].position.x = b;
    const filled = Math.max(0.001, b - a);
    this.fill.scale.x = filled;
    this.fill.position.x = (a + b) / 2;
  }

  private setTouch(which: 0 | 1, state: TouchState): void {
    this.touches[which] = changeTouch(this.audio, [this.materials[which]], this.touches[which], state);
  }
}
