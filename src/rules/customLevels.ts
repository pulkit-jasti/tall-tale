// The player's own Custom Game levels (docs/custom-mode.md section 8,
// "Saving" and "Naming"): the list, the name rules, a free default name, a
// copy's name, adding, changing and removing. Plain data, no storage here
// (src/player/customLevels.ts reads and writes it). No Three.js here.
import { CUSTOM_GAME } from '../config/game.js';
import { parseLevel, type Level } from '../level/level.js';

export const CUSTOM_LEVELS_VERSION = 1;

export interface CustomLevel {
  id: string;
  name: string;
  /** Typed by the player (may be empty: the card then describes the settings). */
  description: string;
  created: number;
  changed: number;
  /** The level itself, with the seed and settings it was made from in its meta. */
  level: Level;
  /** The best stars won on it (1 to 3), missing until it is won once. */
  best?: number;
}

export interface CustomLevels {
  version: number;
  /** Newest first. */
  levels: CustomLevel[];
}

export const createCustomLevels = (): CustomLevels => ({ version: CUSTOM_LEVELS_VERSION, levels: [] });

/** Saved data read back: every level that still reads is kept, broken ones are dropped (never the whole list). */
export function parseCustomLevels(data: unknown): CustomLevels {
  const out = createCustomLevels();
  const raw = data && typeof data === 'object' ? (data as Partial<CustomLevels>) : {};
  if (!Array.isArray(raw.levels)) return out;
  for (const entry of raw.levels) {
    try {
      if (!entry || typeof entry.id !== 'string' || typeof entry.name !== 'string') continue;
      out.levels.push({
        id: entry.id,
        name: cleanName(entry.name).slice(0, CUSTOM_GAME.nameMax) || 'Level',
        description: typeof entry.description === 'string' ? cleanDescription(entry.description) : '',
        created: Number(entry.created) || 0,
        changed: Number(entry.changed) || 0,
        level: parseLevel(entry.level),
        ...(Number(entry.best) >= 1 ? { best: Math.min(3, Math.round(Number(entry.best))) } : {}),
      });
    } catch {
      // A level that no longer reads (an old format) is left out.
    }
  }
  out.levels = out.levels.slice(0, CUSTOM_GAME.maxLevels);
  return out;
}

/** A name as it is kept: spaces at the ends trimmed, runs of spaces made one. */
export const cleanName = (name: string): string => name.trim().replace(/\s+/g, ' ');

/** A description as it is kept: like a name, cut to its limit. */
export const cleanDescription = (text: string): string => cleanName(text).slice(0, CUSTOM_GAME.descriptionMax);

const sameName = (a: string, b: string): boolean => cleanName(a).toLowerCase() === cleanName(b).toLowerCase();

export type NameProblem = 'empty' | 'tooLong' | 'taken';

export const NAME_MESSAGES: Record<NameProblem, string> = {
  empty: 'Give your level a name.',
  tooLong: `${CUSTOM_GAME.nameMax} characters at most.`,
  taken: 'You already have a level with this name.',
};

/**
 * What is wrong with a name, or null. `editing` is the level being edited
 * (it may keep its own name). A name right at the limit is fine (the input
 * stops there; the page notes it).
 */
export function checkName(list: CustomLevels, name: string, editing: string | null = null): NameProblem | null {
  const clean = cleanName(name);
  if (clean.length === 0) return 'empty';
  if (clean.length > CUSTOM_GAME.nameMax) return 'tooLong';
  if (list.levels.some((l) => l.id !== editing && sameName(l.name, clean))) return 'taken';
  return null;
}

/** "Level 1", "Level 2"...: the lowest number not taken. */
export function freeName(list: CustomLevels): string {
  for (let n = 1; ; n++) {
    const name = `Level ${n}`;
    if (!list.levels.some((l) => sameName(l.name, name))) return name;
  }
}

/** A copy's name: "<name> copy", then "<name> copy 2", "copy 3"... cut so it fits the limit. */
export function copyName(list: CustomLevels, name: string): string {
  for (let n = 1; ; n++) {
    const tail = n === 1 ? ' copy' : ` copy ${n}`;
    const candidate = cleanName(name).slice(0, CUSTOM_GAME.nameMax - tail.length).trimEnd() + tail;
    if (!list.levels.some((l) => sameName(l.name, candidate))) return candidate;
  }
}

export const isFull = (list: CustomLevels): boolean => list.levels.length >= CUSTOM_GAME.maxLevels;

/** A new id: the time, and a counter for two in the same millisecond (not gameplay, so not the seeded random). */
let idCount = 0;
export function newId(now: number): string {
  idCount = (idCount + 1) % 1000;
  return `${now.toString(36)}${idCount.toString(36)}`;
}

/** Adds a level at the top (newest first). Returns it, or null when the list is full or the name is not valid. */
export function addLevel(list: CustomLevels, name: string, description: string, level: Level, now: number): CustomLevel | null {
  if (isFull(list) || checkName(list, name) !== null) return null;
  const entry: CustomLevel = { id: newId(now), name: cleanName(name), description: cleanDescription(description), created: now, changed: now, level };
  list.levels.unshift(entry);
  return entry;
}

/** Changes a level's name and level in place (it keeps its place and id). False if it is gone or the name is not valid. */
export function updateLevel(list: CustomLevels, id: string, name: string, description: string, level: Level, now: number): boolean {
  const entry = list.levels.find((l) => l.id === id);
  if (!entry || checkName(list, name, id) !== null) return false;
  entry.name = cleanName(name);
  entry.description = cleanDescription(description);
  entry.level = level;
  entry.changed = now;
  // A changed level is a new challenge: its best stars start over.
  delete entry.best;
  return true;
}

/** A copy right after the original, with a copy's name. Null when the list is full. */
export function duplicateLevel(list: CustomLevels, id: string, now: number): CustomLevel | null {
  const index = list.levels.findIndex((l) => l.id === id);
  if (index < 0 || isFull(list)) return null;
  const from = list.levels[index];
  const copy: CustomLevel = { id: newId(now), name: copyName(list, from.name), description: from.description, created: now, changed: now, level: structuredClone(from.level) };
  list.levels.splice(index, 0, copy);
  return copy;
}

/** Removes a level. Returns the index of the level to select next (the one after it, or before at the end), or -1 when the list is empty. */
export function removeLevel(list: CustomLevels, id: string): number {
  const index = list.levels.findIndex((l) => l.id === id);
  if (index < 0) return list.levels.length ? 0 : -1;
  list.levels.splice(index, 1);
  return list.levels.length === 0 ? -1 : Math.min(index, list.levels.length - 1);
}
