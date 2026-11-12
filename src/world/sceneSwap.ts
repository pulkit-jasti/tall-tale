// From the battle to the menu and back (docs/menus.md section 2): the
// battleground (castle walls and towers, the two flags, the tool platforms
// and the ring handle) slides down into the ground, then the menu rises out
// of it; Fight plays it the other way round. Whole groups move (a transform
// only), so it costs no frame time; sunk groups are hidden, so they cost no
// draw calls either. Times and depths: MENU.swap.
import type { Object3D } from 'three';
import { MENU } from '../config/game.js';
import { easeInOut } from '../fx/ease.js';

export type SceneShown = 'battle' | 'toMenu' | 'menu' | 'toBattle';

/** Some groups that go down `depth` cm together, each from where it stood. */
class Sinker {
  private items: { o: Object3D; baseY: number; toggle: boolean }[] = [];
  /** 0 standing, 1 sunk. */
  share = 0;

  constructor(private depth: number) {}

  /** `toggle`: hidden while sunk. Off for things whose showing is someone else's job (the tools: the battle shows them). */
  add(o: Object3D, toggle = true): void {
    this.items.push({ o, baseY: o.position.y, toggle });
  }

  set(share: number): void {
    this.share = share;
    const down = easeInOut(Math.min(1, Math.max(0, share))) * this.depth;
    for (const { o, baseY, toggle } of this.items) {
      o.position.y = baseY - down;
      if (toggle) o.visible = share < 1;
    }
  }
}

export class SceneSwap {
  private battle = new Sinker(MENU.swap.battleDepth);
  private menu = new Sinker(MENU.swap.menuDepth);
  private state: SceneShown = 'battle';
  private time = 0;
  /** Called once the swap is over (the menu is up, or the battle is up again). */
  private done: (() => void) | null = null;
  /** Called once the first half is over (the battle is down, or the menu is down). */
  private sunk: (() => void) | null = null;

  constructor() {
    this.menu.set(1);
  }

  get shown(): SceneShown {
    return this.state;
  }

  /** True while something moves. */
  get moving(): boolean {
    return this.state === 'toMenu' || this.state === 'toBattle';
  }

  /** A battle thing that sinks. `toggle`: hidden while sunk (off for the tools, which the battle shows and hides). */
  addBattle(o: Object3D, toggle = true): void {
    this.battle.add(o, toggle);
  }

  addMenu(o: Object3D): void {
    this.menu.add(o);
    this.menu.set(this.menu.share);
  }

  /**
   * The battle sinks (then `onSunk`), then the menu rises (then `onDone`).
   * `instant`: straight to the menu (a later visit opens on it).
   */
  toMenu(onSunk: () => void, onDone: () => void, instant = false): void {
    this.begin('toMenu', onSunk, onDone, instant);
  }

  /** The menu sinks (then `onSunk`), then the battle rises (then `onDone`). */
  toBattle(onSunk: () => void, onDone: () => void, instant = false): void {
    this.begin('toBattle', onSunk, onDone, instant);
  }

  private begin(state: 'toMenu' | 'toBattle', onSunk: () => void, onDone: () => void, instant: boolean): void {
    // A swap still running finishes its own callbacks first, so nothing is left half done.
    if (this.moving) this.finish();
    this.sunk = onSunk;
    this.done = onDone;
    this.time = 0;
    this.state = state;
    if (instant) this.finish();
  }

  update(dt: number): void {
    if (!this.moving) return;
    this.time += dt;
    const { sinkTime, riseTime } = MENU.swap;
    const first = Math.min(1, this.time / sinkTime);
    const second = Math.min(1, Math.max(0, (this.time - sinkTime) / riseTime));
    if (this.state === 'toMenu') {
      this.battle.set(first);
      this.menu.set(1 - second);
    } else {
      this.menu.set(first);
      this.battle.set(1 - second);
    }
    if (first >= 1) this.callSunk();
    if (second >= 1) this.finish();
  }

  private callSunk(): void {
    const sunk = this.sunk;
    this.sunk = null;
    sunk?.();
  }

  private finish(): void {
    this.callSunk();
    const toMenu = this.state === 'toMenu';
    this.battle.set(toMenu ? 1 : 0);
    this.menu.set(toMenu ? 0 : 1);
    this.state = toMenu ? 'menu' : 'battle';
    const done = this.done;
    this.done = null;
    done?.();
  }
}
