// The 15 campaign levels the menu shows (docs/menus.md sections 8 and 9,
// docs/v2-plan.md 2.8). Levels 1 to 5 are open from the start; 6 to 15 are
// text only for now (their cards can be read, Fight stays locked until the
// level before is won). Every level has one twist made from existing systems,
// and its name comes from the twist. The wave director (a later run) will
// read the battle fields from here too; for now Fight plays the normal battle.
// No Three.js here.
import type { PickTool } from '../rules/campaign.js';

/** What a level's card shows in its enemies row. */
export type EnemyIcon = 'grunt' | 'runner' | 'helmet' | 'shield' | 'spear' | 'sword' | 'balloon';

export interface LevelEntry {
  number: number;
  name: string;
  /** One line that explains the twist. */
  flavor: string;
  /** Difficulty: 1 to 3 goblin skulls. */
  skulls: 1 | 2 | 3;
  enemies: EnemyIcon[];
  /** The one tool the card suggests for this level (a small turning copy of it, every level has one). */
  suggested: PickTool;
}

/** Levels open from the start (docs/menus.md "Locked levels"). Each win after the last of them opens the next. */
export const OPEN_FROM_START = 5;

/** Names on the card's enemies row. */
export const ENEMY_NAMES: Record<EnemyIcon, string> = {
  grunt: 'Grunts',
  runner: 'Runners',
  helmet: 'Helmets',
  shield: 'Shields',
  spear: 'Spears',
  sword: 'Swords',
  balloon: 'Balloons',
};

/** What the tutorial shows (it counts as met once the tutorial is done, so it is never "New!" after it). */
export const TUTORIAL_ENEMIES: EnemyIcon[] = ['grunt', 'runner', 'helmet', 'shield', 'spear', 'sword', 'balloon'];

// docs/custom-mode.md section 10 (redone 2026-11-16): 1 to 5 are playable (their level files come from
// src/level/presets.ts), 6 to 15 are locked teasers. No tool rewards any more (2026-11-18): the card shows
// `suggested`, the one tool that answers the level's twist.
export const LEVELS: LevelEntry[] = [
  { number: 1, name: 'First Watch', flavor: 'A quiet morning. One camp stirs, then another behind you.', skulls: 1, enemies: ['grunt', 'runner'], suggested: 'swatter' },
  { number: 2, name: 'Sky Pirates', flavor: 'A fleet of balloons is drifting in. Bring them down.', skulls: 1, enemies: ['grunt', 'runner', 'balloon'], suggested: 'slingshot' },
  { number: 3, name: 'Tin Hats', flavor: 'Someone sold the goblins helmets. Take them back.', skulls: 2, enemies: ['grunt', 'helmet', 'shield'], suggested: 'magnet' },
  { number: 4, name: 'Sun Garden', flavor: 'A bright day and good soil. Make it bloom.', skulls: 2, enemies: ['grunt', 'runner', 'helmet'], suggested: 'glass' },
  { number: 5, name: 'Nightfall', flavor: 'The sun is setting. They fight better in the dark.', skulls: 2, enemies: ['grunt', 'runner', 'spear', 'sword'], suggested: 'drum' },
  { number: 6, name: 'Molehill Meadow', flavor: 'The ground is moving. Something is digging toward you.', skulls: 2, enemies: ['grunt', 'runner'], suggested: 'pepper' },
  { number: 7, name: 'Drums of the Shaman', flavor: 'Every time you strip them, someone hands them more.', skulls: 2, enemies: ['grunt', 'helmet', 'shield'], suggested: 'slingshot' },
  { number: 8, name: 'Powder Pass', flavor: 'Kegs on every road, and goblins carrying their own.', skulls: 2, enemies: ['grunt', 'runner'], suggested: 'slingshot' },
  { number: 9, name: 'Arrow Rain', flavor: 'Archers on the hills. Keep your knights alive.', skulls: 3, enemies: ['grunt', 'sword'], suggested: 'horn' },
  { number: 10, name: 'Harvest Fire', flavor: 'Fields of hay as far as you can see. Bring a light.', skulls: 2, enemies: ['grunt', 'runner'], suggested: 'glass' },
  { number: 11, name: 'The Great Horde', flavor: 'One camp. One road. Too many goblins.', skulls: 3, enemies: ['grunt', 'runner', 'spear'], suggested: 'drum' },
  { number: 12, name: 'River Crossing', flavor: 'Wooden bridges over a wide river. Drop them at the right moment.', skulls: 3, enemies: ['grunt', 'runner', 'shield'], suggested: 'sugar' },
  { number: 13, name: 'Moonless', flavor: 'No moon, thick fog. Trust your compass.', skulls: 3, enemies: ['grunt', 'runner', 'balloon'], suggested: 'drum' },
  { number: 14, name: "The Alchemist's Road", flavor: 'A cart full of potions broke down nearby. Things are getting strange.', skulls: 3, enemies: ['grunt', 'runner', 'helmet'], suggested: 'sugar' },
  { number: 15, name: 'The Last Stand', flavor: 'Every camp, every goblin, all at once.', skulls: 3, enemies: ['grunt', 'runner', 'helmet', 'shield', 'spear', 'balloon'], suggested: 'horn' },
];
