// Villagers (VILLAGERS in src/config/game.ts): a few peaceful people in the
// villages who go about their day, so the world feels lived in. Each one
// walks between spots in its village square, stops there to work (a hand
// busy at something, picking something up) or to stand and look about, then
// walks on. Decor only: no one fights, no one can be grabbed. The same human
// and archer bodies as the soldiers, with no gear and plain work clothes.
// Far from the player, so they animate every few frames.
import { AnimationClip, AnimationMixer, Group, LoopOnce, LoopRepeat, type AnimationAction, type Mesh, type MeshStandardMaterial, type Object3D } from 'three';
import { VILLAGERS } from '../config/game.js';
import { groundAt } from '../rules/boardMath.js';
import type { Random } from '../rules/random.js';
import { cloneSkinned, loadTemplate, type ModelTemplate } from '../world/models.js';
import type { Spot } from '../world/settlements.js';
import { rigTemplate } from './gear.js';

type Doing = 'walk' | 'work' | 'look';

class Villager {
  readonly root = new Group();
  readonly mixer: AnimationMixer;
  private actions = new Map<string, AnimationAction>();
  private current: AnimationAction | null = null;
  doing: Doing = 'look';
  timer = 0;
  targetX = 0;
  targetZ = 0;
  animDt = 0;

  constructor(
    template: ModelTemplate,
    private clips: AnimationClip[],
    readonly home: Spot,
  ) {
    const model = cloneSkinned(template);
    model.scale.setScalar(VILLAGERS.height);
    this.root.add(model);
    this.mixer = new AnimationMixer(model);
  }

  play(name: string, loop = true): void {
    let action = this.actions.get(name);
    if (!action) {
      const clip = AnimationClip.findByName(this.clips, name);
      if (!clip) return;
      action = this.mixer.clipAction(clip);
      this.actions.set(name, action);
    }
    if (action === this.current && loop) return;
    action.reset();
    action.setLoop(loop ? LoopRepeat : LoopOnce, Infinity);
    action.clampWhenFinished = !loop;
    action.fadeIn(0.25).play();
    if (this.current && this.current !== action) this.current.fadeOut(0.25);
    this.current = action;
  }
}

export class Villagers {
  private list: Villager[] = [];
  private frame = 0;

  constructor(
    private board: Object3D,
    private villages: Spot[],
    private rng: Random,
  ) {}

  async load(): Promise<void> {
    if (!VILLAGERS.enabled || this.villages.length === 0) return;
    const templates = await Promise.all(
      VILLAGERS.kinds.map(async (kind) => {
        const template = await loadTemplate(kind.body, { height: 1 }, true);
        await rigTemplate(template, [], kind.recolor);
        // Their own materials (the soldiers share the loaded ones and add a gold night edge to them).
        template.object.traverse((o) => {
          const mesh = o as Mesh;
          if (mesh.isMesh) mesh.material = (mesh.material as MeshStandardMaterial).clone();
        });
        return template;
      }),
    );
    for (const [v, home] of this.villages.entries()) {
      for (let k = 0; k < VILLAGERS.perVillage && this.list.length < VILLAGERS.max; k++) {
        const template = templates[(v + k) % templates.length];
        const villager = new Villager(template, template.animations, home);
        this.pickSpot(villager);
        villager.root.position.set(villager.targetX, 0, villager.targetZ);
        this.settle(villager);
        this.start(villager, 'look');
        this.board.add(villager.root);
        this.list.push(villager);
      }
    }
  }

  /** Every frame. Their animations move on every few frames only (they are far away and small). */
  update(dt: number): void {
    this.frame++;
    for (const [i, v] of this.list.entries()) {
      v.timer -= dt;
      if (v.doing === 'walk') {
        const p = v.root.position;
        const dx = v.targetX - p.x;
        const dz = v.targetZ - p.z;
        const d = Math.hypot(dx, dz);
        const step = VILLAGERS.speed * dt;
        if (d <= step) {
          p.x = v.targetX;
          p.z = v.targetZ;
          this.start(v, this.rng.next() < VILLAGERS.workShare ? 'work' : 'look');
        } else {
          p.x += (dx / d) * step;
          p.z += (dz / d) * step;
          v.root.rotation.y = Math.atan2(dx, dz);
        }
        this.settle(v);
      } else if (v.timer <= 0) {
        this.pickSpot(v);
        this.start(v, 'walk');
      }
      v.animDt += dt;
      if ((this.frame + i) % VILLAGERS.animEvery === 0) {
        v.mixer.update(v.animDt);
        v.animDt = 0;
      }
    }
  }

  private start(v: Villager, doing: Doing): void {
    v.doing = doing;
    const V = VILLAGERS;
    if (doing === 'walk') {
      v.play('walk');
      return;
    }
    v.timer = this.rng.range(...(doing === 'work' ? V.workSeconds : V.lookSeconds));
    if (doing === 'work') v.play(this.rng.next() < 0.5 ? 'interact-right' : 'pick-up');
    else v.play('idle');
  }

  /** A new spot in its village square (inside the ring of houses), not too close to where it stands. */
  private pickSpot(v: Villager): void {
    const { x, z, size } = v.home;
    for (let tries = 0; tries < 8; tries++) {
      const a = this.rng.range(0, Math.PI * 2);
      const d = this.rng.range(VILLAGERS.walkFrom, VILLAGERS.walkTo) * size;
      v.targetX = x + Math.sin(a) * d;
      v.targetZ = z - Math.cos(a) * d;
      if (Math.hypot(v.targetX - v.root.position.x, v.targetZ - v.root.position.z) > size * 0.15) return;
    }
  }

  private settle(v: Villager): void {
    const p = v.root.position;
    p.y = groundAt(p.x, p.z);
  }
}
