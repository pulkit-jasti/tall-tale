// The achievements tracker (docs/v3-plan.md 2.6): watches what the player
// does in a battle and marks each achievement earned the first time its
// goal is met, saved with the progress (src/player/progress.ts). The game
// feeds it events from the tools, the goblins, the traps and the battle;
// the list and its numbers are in src/config/achievements.ts.
//
// Only real battles count (a level, Custom Game, or a battle after Skip
// tutorial): the tutorial teaches some of the tricks, and a lesson must
// never hand out a secret. No hints in play: a secret shows only when found.
import { ACHIEVEMENT_IDS, ACHIEVEMENT_RULES as R, type AchievementId } from '../config/achievements.js';
import { note } from '../debug/notes.js';
import { Vector3 } from 'three';
import type { PickTool } from '../rules/campaign.js';
import type { TriggerKind } from '../rules/blueprint.js';
import type { Goblin, Goblins } from '../units/goblins.js';
import { progress, saveProgress } from './progress.js';

export type HornOrder = 'call' | 'boost' | 'move';

const campAt = new Vector3();

export class Achievements {
  /** True while a real battle is fought (the game sets it at each battle's start and end). */
  active = false;
  /** An achievement was just earned (the game shows the toast and lights its trophy). */
  onUnlock: (id: AchievementId) => void = () => {};

  // This battle's progress toward the regular achievements.
  private loadout: PickTool[] = [];
  private hornOrders = new Set<HornOrder>();
  private trapKinds = new Set<TriggerKind>();
  /** The loadout tools that knocked out a goblin (or helped to, within the assist window). */
  private toolKnocks = new Set<PickTool>();
  /** When a player-made knockout last happened on each side (quarters of the board, Goblins clock). */
  private sideTimes = [-Infinity, -Infinity, -Infinity, -Infinity];
  /** Gear pieces pulled in the current pull, and when it started. */
  private gearPieces = 0;
  private gearFrom = -Infinity;
  /** The plants standing at the wave's start (each plant is its own object). */
  private wavePlants: Set<object> | null = null;

  constructor(private goblins: Goblins) {}

  has(id: AchievementId): boolean {
    return progress.trophies.includes(id);
  }

  get earnedCount(): number {
    return progress.trophies.length;
  }

  /** Marks an achievement earned (once), saves, and tells the game. */
  unlock(id: AchievementId): void {
    if (this.has(id)) return;
    progress.trophies.push(id);
    saveProgress();
    note(`[trophy] earned ${id}`);
    this.onUnlock(id);
  }

  /** Debug: every achievement earned at once (no toasts). */
  unlockAll(): void {
    progress.trophies = [...ACHIEVEMENT_IDS];
    saveProgress();
  }

  /** Debug: every achievement forgotten. */
  forgetAll(): void {
    progress.trophies = [];
    saveProgress();
  }

  /** A battle starts: the regular achievements count from zero. `tracking`: a real battle (not the tutorial). */
  startBattle(loadout: PickTool[] | null, tracking: boolean): void {
    this.active = tracking;
    this.loadout = loadout ? [...loadout] : [];
    this.hornOrders.clear();
    this.trapKinds.clear();
    this.toolKnocks.clear();
    this.sideTimes.fill(-Infinity);
    this.gearPieces = 0;
    this.gearFrom = -Infinity;
    this.wavePlants = null;
  }

  /** The battle ended (won or lost). */
  endBattle(won: boolean): void {
    if (this.active && won) {
      if (this.hornOrders.size >= 3) this.unlock('commander');
      if (this.loadout.length > 0 && this.loadout.every((t) => this.toolKnocks.has(t))) this.unlock('jackOfAllTrades');
      if (this.loadout.length > 0) note(`[trophy] tools that knocked out: ${[...this.toolKnocks].join(', ') || 'none'} of ${this.loadout.join(', ')}`);
    }
    this.active = false;
  }

  // ---- Knockouts and eating ----

  /** The tools credited with a goblin going down: the one that did it, and the support tools that touched it just before. */
  private credit(goblin: Goblin, cause: PickTool | null): void {
    if (cause) this.toolKnocks.add(cause);
    const now = this.goblins.clock;
    for (const [tool, at] of goblin.touched) if (now - at <= R.assistWindow) this.toolKnocks.add(tool);
  }

  /** A goblin was knocked out (its position is still where it fell), by `cause` (null: soldiers, falls). */
  knockedOut(goblin: Goblin, cause: PickTool | null): void {
    if (!this.active) return;
    this.credit(goblin, cause);
    if (!cause) return;
    const p = goblin.root.position;
    // Eyes Everywhere: player-made knockouts on every side of the castle within the window.
    const angle = Math.atan2(p.x, -p.z);
    const side = Math.floor((((angle + Math.PI / 4) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI / 2)) % 4;
    const now = this.goblins.clock;
    this.sideTimes[side] = now;
    if (this.sideTimes.filter((t) => now - t <= R.sidesWindow).length >= R.sides) this.unlock('eyesEverywhere');
    // Long Shot: a slingshot knockout right by the goblin's own camp.
    if (cause === 'slingshot' && this.goblins.campPoint(goblin, campAt) && Math.hypot(p.x - campAt.x, p.z - campAt.z) <= R.longShotRadius) this.unlock('longShot');
  }

  /** A goblin was eaten (seasoned as it was when eaten). */
  eaten(goblin: Goblin, seasoned: boolean): void {
    if (!this.active) return;
    this.credit(goblin, null);
    // Acquired Taste (Spicy snack): a peppered goblin heals double.
    if (seasoned) this.unlock('acquiredTaste');
  }

  // ---- The secret abilities ----

  /** Change of Menu (Chicken dinner). */
  chickenEaten(): void {
    if (this.active) this.unlock('changeOfMenu');
  }

  /** Fair Trade (Goblin shot): a goblin shot from the slingshot landed. */
  goblinShot(): void {
    if (this.active) this.unlock('fairTrade');
  }

  /** Night Owl (Fire pebble): a pebble caught fire in the torch. */
  fireLit(): void {
    if (this.active) this.unlock('nightOwl');
  }

  /** Bright Idea (Sun charge). */
  sunCharge(): void {
    if (this.active) this.unlock('brightIdea');
  }

  /** Gentle Touch (Ring the bell). */
  bellRung(): void {
    if (this.active) this.unlock('gentleTouch');
  }

  /** Secret Recipe (Spicy sugar): a goblin ate a spicy cube. */
  spicyEaten(): void {
    if (this.active) this.unlock('secretRecipe');
  }

  /** Package Deal (Flying keg): a pulled-in keg was shot and blew up. */
  kegBlast(): void {
    if (this.active) this.unlock('packageDeal');
  }

  // ---- The regular achievements ----

  /** Bless You: the pepper ring stopped a digger. */
  diggerStopped(): void {
    if (this.active) this.unlock('blessYou');
  }

  /** Iron Grip: the magnet pulled this many pieces off one goblin; pieces within one pull add up. */
  gearPulled(pieces: number): void {
    if (!this.active) return;
    const now = this.goblins.clock;
    if (now - this.gearFrom > R.gearWindow) {
      this.gearFrom = now;
      this.gearPieces = 0;
    }
    this.gearPieces += pieces;
    if (this.gearPieces >= R.gearPieces) this.unlock('ironGrip');
  }

  /** Commander: a horn order went out (counted for the battle; earned on a win). */
  hornOrder(order: HornOrder): void {
    if (this.active) this.hornOrders.add(order);
  }

  /** Trap Master: a trap was set off, by a player tool or not. */
  trapSetOff(kind: TriggerKind, by: PickTool | null): void {
    if (!this.active || !by) return;
    this.trapKinds.add(kind);
    if (this.trapKinds.size >= R.trapKinds) this.unlock('trapMaster');
  }

  /** Green Thumb: a wave starts with these plants standing. */
  waveStarted(plants: object[]): void {
    this.wavePlants = this.active ? new Set(plants) : null;
  }

  /** Green Thumb: a wave was cleared with these plants standing; the ones there since its start count. */
  waveCleared(plants: object[]): void {
    const from = this.wavePlants;
    this.wavePlants = null;
    if (!this.active || !from) return;
    if (plants.filter((p) => from.has(p)).length >= R.plants) this.unlock('greenThumb');
  }
}
