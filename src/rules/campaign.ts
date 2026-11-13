// The campaign's rules (docs/menus.md sections 5 and 9, docs/v2-plan.md 2.4
// and 2.8): the saved progress, stars, which levels are open, which tools are
// unlocked, and the loadout (the slingshot and the horn fixed, 2 picked).
// Plain data in, plain data out, no storage and no Three.js here: the save
// lives in src/player/progress.ts.
import { LEVELS, OPEN_FROM_START, TUTORIAL_ENEMIES, type EnemyIcon } from '../config/levels.js';

/** The tools the player picks for the 2 free loadout slots (new tools join this list). */
export type PickTool = 'swatter' | 'pepper' | 'bell';
export const PICK_TOOLS: PickTool[] = ['swatter', 'pepper', 'bell'];
/** Unlocked from the start: the tools the tutorial teaches (the bell left it, docs/v2-plan.md 2.4). */
export const STARTING_TOOLS: PickTool[] = ['swatter', 'pepper'];

export type Loadout = [PickTool | null, PickTool | null];
/** Spots on the tool shelf: one per pick tool, so every tool always has room. */
export const SHELF_SPOTS = PICK_TOOLS.length;
/** A place a pick tool can stand: one of the stand's 2 free slots, or a shelf spot. */
export interface Place {
  where: 'stand' | 'shelf';
  i: number;
}

export interface Progress {
  version: 1;
  tutorialDone: boolean;
  /** Best stars per level number (1 to 3), missing for a level never won. */
  stars: Record<number, number>;
  /** Level numbers the player may fight. */
  open: number[];
  /** Tools unlocked by the campaign (the starting tools are always unlocked). */
  tools: PickTool[];
  /** The 2 picked tools (the stand's 2 free slots). */
  loadout: Loadout;
  /** What stands on each tool shelf spot (SHELF_SPOTS of them). Every pick tool is in exactly one place: a slot or a shelf spot. */
  shelf: (PickTool | null)[];
  /** Enemy kinds already met (a card tags the others "New!"). */
  met: EnemyIcon[];
  /** The settings' "Unlock all tools" switch, for judges: tools only, never levels. */
  unlockAll: boolean;
  /** Tools grabbed once on the shelf (a newly unlocked tool glows until then). */
  toolsSeen: PickTool[];
}

/** True for an unlocked tool that was never grabbed on the shelf (it glows). */
export function toolIsNew(p: Progress, tool: PickTool): boolean {
  return toolUnlocked(p, tool) && !STARTING_TOOLS.includes(tool) && !p.toolsSeen.includes(tool);
}

export function createProgress(): Progress {
  return {
    version: 1,
    tutorialDone: false,
    stars: {},
    open: LEVELS.filter((l) => l.number <= OPEN_FROM_START).map((l) => l.number),
    tools: [],
    // Both pick slots start empty: the player puts the tools on the stand (the developer's choice after the first look).
    loadout: [null, null],
    shelf: [...PICK_TOOLS],
    met: [],
    unlockAll: false,
    toolsSeen: [],
  };
}

const isPick = (v: unknown): v is PickTool => typeof v === 'string' && (PICK_TOOLS as string[]).includes(v);

/**
 * A saved progress read back (JSON.parse output, anything at all): every
 * field checked, anything odd falls back to the default, so a broken save
 * never breaks the game.
 */
export function parseProgress(raw: unknown): Progress {
  const p = createProgress();
  if (!raw || typeof raw !== 'object') return p;
  const r = raw as Record<string, unknown>;
  if (typeof r.tutorialDone === 'boolean') p.tutorialDone = r.tutorialDone;
  if (typeof r.unlockAll === 'boolean') p.unlockAll = r.unlockAll;
  if (r.stars && typeof r.stars === 'object') {
    for (const [key, value] of Object.entries(r.stars as Record<string, unknown>)) {
      const n = Number(key);
      if (LEVELS.some((l) => l.number === n) && typeof value === 'number' && value >= 1) p.stars[n] = Math.min(3, Math.round(value));
    }
  }
  if (Array.isArray(r.open)) for (const n of r.open) if (typeof n === 'number' && LEVELS.some((l) => l.number === n) && !p.open.includes(n)) p.open.push(n);
  if (Array.isArray(r.tools)) p.tools = PICK_TOOLS.filter((t) => (r.tools as unknown[]).includes(t));
  if (Array.isArray(r.toolsSeen)) p.toolsSeen = PICK_TOOLS.filter((t) => (r.toolsSeen as unknown[]).includes(t));
  if (Array.isArray(r.met)) p.met = TUTORIAL_ENEMIES.filter((e) => (r.met as unknown[]).includes(e));
  if (Array.isArray(r.loadout) && r.loadout.length === 2) {
    const [a, b] = r.loadout as unknown[];
    p.loadout = [isPick(a) ? a : null, isPick(b) && b !== a ? b : null];
  }
  if (Array.isArray(r.shelf)) p.shelf = (r.shelf as unknown[]).slice(0, SHELF_SPOTS).map((t) => (isPick(t) ? t : null));
  p.open.sort((a, b) => a - b);
  fixPlaces(p);
  return p;
}

/** Stars for a won battle from the red flag's share left (1 = full): 3 at threeAt or more, 2 at twoAt or more, else 1. */
export function starsFor(healthShare: number, threeAt: number, twoAt: number): 1 | 2 | 3 {
  if (healthShare >= threeAt) return 3;
  if (healthShare >= twoAt) return 2;
  return 1;
}

export function isOpen(p: Progress, level: number): boolean {
  return p.open.includes(level);
}

/**
 * A level won with `stars`: the best stars are kept (a replay never lowers
 * them), and the next level opens. Returns true if a level opened just now.
 */
export function recordWin(p: Progress, level: number, stars: number): boolean {
  p.stars[level] = Math.max(p.stars[level] ?? 0, stars);
  const entry = LEVELS.find((l) => l.number === level);
  for (const enemy of entry?.enemies ?? []) if (!p.met.includes(enemy)) p.met.push(enemy);
  // Its tool reward is unlocked (it glows on the shelf until grabbed).
  const reward = entry?.reward;
  if (isPick(reward) && !p.tools.includes(reward)) p.tools.push(reward);
  const next = level + 1;
  if (!LEVELS.some((l) => l.number === next) || p.open.includes(next)) return false;
  p.open.push(next);
  p.open.sort((a, b) => a - b);
  return true;
}

/** The tutorial is done (won or skipped). Won, its enemies count as met. */
export function recordTutorial(p: Progress, won: boolean): void {
  p.tutorialDone = true;
  if (won) for (const e of TUTORIAL_ENEMIES) if (!p.met.includes(e)) p.met.push(e);
}

/** True for a tool the player may put on the stand. */
export function toolUnlocked(p: Progress, tool: PickTool): boolean {
  return p.unlockAll || STARTING_TOOLS.includes(tool) || p.tools.includes(tool);
}

export function unlockedTools(p: Progress): PickTool[] {
  return PICK_TOOLS.filter((t) => toolUnlocked(p, t));
}

/** A loadout made valid: no locked tool and no tool twice. Empty slots stay empty (the player fills them). */
export function fixLoadout(p: Progress): Loadout {
  const open = unlockedTools(p);
  const out: Loadout = [null, null];
  for (let i = 0; i < 2; i++) {
    const t = p.loadout[i];
    if (t && open.includes(t) && !out.includes(t)) out[i] = t;
  }
  return out;
}

/** True when both pick slots hold a tool (Fight stays locked until then). */
export function loadoutFull(p: Progress): boolean {
  return !p.loadout.includes(null);
}

/**
 * Every pick tool in exactly one place: the loadout made valid (fixLoadout),
 * the shelf without doubles or tools already on the stand, and any tool with
 * no place yet on the first free shelf spot.
 */
export function fixPlaces(p: Progress): void {
  p.loadout = fixLoadout(p);
  const shelf: (PickTool | null)[] = [];
  for (let i = 0; i < SHELF_SPOTS; i++) {
    const t = p.shelf[i] ?? null;
    shelf.push(t && !p.loadout.includes(t) && !shelf.includes(t) ? t : null);
  }
  for (const t of PICK_TOOLS) {
    if (p.loadout.includes(t) || shelf.includes(t)) continue;
    const free = shelf.indexOf(null);
    if (free >= 0) shelf[free] = t;
  }
  p.shelf = shelf;
}

/** Where a pick tool stands now. */
export function placeOf(p: Progress, tool: PickTool): Place | null {
  const slot = p.loadout.indexOf(tool);
  if (slot >= 0) return { where: 'stand', i: slot };
  const spot = p.shelf.indexOf(tool);
  return spot >= 0 ? { where: 'shelf', i: spot } : null;
}

/** What stands at a place (null: empty). */
export function toolAt(p: Progress, place: Place): PickTool | null {
  return (place.where === 'stand' ? p.loadout[place.i] : p.shelf[place.i]) ?? null;
}

function setAt(p: Progress, place: Place, tool: PickTool | null): void {
  if (place.where === 'stand') p.loadout[place.i] = tool;
  else p.shelf[place.i] = tool;
}

/**
 * True if `tool` may be put at `place`: it is unlocked, the place is not
 * where it already is, and a locked tool there would not have to go onto the stand.
 */
export function canMoveTo(p: Progress, tool: PickTool, place: Place): boolean {
  if (!toolUnlocked(p, tool)) return false;
  const from = placeOf(p, tool);
  if (!from || (from.where === place.where && from.i === place.i)) return false;
  const there = toolAt(p, place);
  return !there || toolUnlocked(p, there) || from.where === 'shelf';
}

/**
 * Puts `tool` at `place` (any slot or shelf spot, no tool has a spot of its
 * own). A tool already there moves to where this one came from (they swap).
 * Returns false if it may not (see canMoveTo).
 */
export function moveTool(p: Progress, tool: PickTool, place: Place): boolean {
  if (!canMoveTo(p, tool, place)) return false;
  const from = placeOf(p, tool)!;
  const there = toolAt(p, place);
  setAt(p, place, tool);
  setAt(p, from, there);
  return true;
}

/** The battle's 4 tools from the loadout: the 2 picks (null slots left out), then the slingshot and the horn. */
export function battleTools(loadout: Loadout): (PickTool | 'slingshot' | 'horn')[] {
  return [...loadout.filter((t): t is PickTool => t !== null), 'slingshot', 'horn'];
}
