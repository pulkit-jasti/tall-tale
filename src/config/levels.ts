// The 15 campaign levels the menu shows (docs/menus.md sections 8 and 9,
// docs/v2-plan.md 2.8). Levels 1 to 5 are open from the start; 6 to 15 are
// text only for now (their cards can be read, Fight stays locked until the
// level before is won). Every level has one twist made from existing systems,
// and its name comes from the twist. The wave director (a later run) will
// read the battle fields from here too; for now Fight plays the normal battle.
// No Three.js here.

/** What a level's card shows in its enemies row. */
export type EnemyIcon = 'grunt' | 'runner' | 'helmet' | 'shield' | 'spear' | 'sword' | 'balloon';

/** A tool a level gives when won (the bell at level 3, decided 2026-11-11; more once the tools are final), or a "???" silhouette. */
export type LevelReward = 'swatter' | 'pepper' | 'bell' | 'mystery' | null;

export interface LevelEntry {
  number: number;
  name: string;
  /** One line that explains the twist. */
  flavor: string;
  /** Difficulty: 1 to 3 goblin skulls. */
  skulls: 1 | 2 | 3;
  enemies: EnemyIcon[];
  reward: LevelReward;
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

export const LEVELS: LevelEntry[] = [
  { number: 1, name: 'First Watch', flavor: 'A quiet road and hungry goblins. Find your feet.', skulls: 1, enemies: ['grunt', 'runner'], reward: null },
  { number: 2, name: "Runner's Road", flavor: 'Mostly runners. Small, fast and always in a hurry.', skulls: 1, enemies: ['runner', 'grunt'], reward: null },
  { number: 3, name: 'The Shield Wall', flavor: 'Every goblin brought a shield. Time for some spice.', skulls: 2, enemies: ['grunt', 'shield', 'helmet'], reward: 'bell' },
  { number: 4, name: 'Balloon Festival', flavor: 'The sky is full of balloons. Keep your slingshot busy.', skulls: 2, enemies: ['grunt', 'runner', 'balloon'], reward: null },
  { number: 5, name: 'Two Fronts', flavor: 'Camps on both sides. Spin fast and call your knights.', skulls: 3, enemies: ['grunt', 'runner', 'shield', 'spear'], reward: null },
  { number: 6, name: 'Spear Rush', flavor: 'Spears everywhere. Every hit on the wall counts twice.', skulls: 2, enemies: ['grunt', 'spear'], reward: null },
  { number: 7, name: 'Powder Valley', flavor: 'Kegs and boulders on every road. One good shot does a lot.', skulls: 2, enemies: ['grunt', 'runner'], reward: null },
  { number: 8, name: 'Thin Walls', flavor: 'Only two archers guard the wall, and help comes slowly.', skulls: 2, enemies: ['grunt', 'sword'], reward: 'mystery' },
  { number: 9, name: 'Helmet Hill', flavor: 'Every goblin wears a helmet. They climb slowly, but they climb.', skulls: 2, enemies: ['grunt', 'helmet'], reward: null },
  { number: 10, name: 'Shields and Spears', flavor: 'Shields in front, spears behind. Strip them, then swat them.', skulls: 3, enemies: ['grunt', 'shield', 'spear', 'helmet'], reward: null },
  { number: 11, name: 'The Great Horde', flavor: 'One huge camp, one road, a lot of goblins.', skulls: 2, enemies: ['grunt', 'runner', 'spear'], reward: null },
  { number: 12, name: 'Sky and Stone', flavor: 'Balloons above, boulders below. Look up, then look out.', skulls: 3, enemies: ['grunt', 'balloon', 'helmet'], reward: 'mystery' },
  { number: 13, name: 'The Siege', flavor: 'The castle starts damaged. Hold it together.', skulls: 3, enemies: ['grunt', 'runner', 'shield', 'sword'], reward: null },
  { number: 14, name: 'Runner Stampede', flavor: 'Runners from every camp at once. Keep that swatter close.', skulls: 3, enemies: ['runner', 'sword', 'balloon'], reward: null },
  { number: 15, name: 'The Last Stand', flavor: 'Everything at once. Show them how big you are.', skulls: 3, enemies: ['grunt', 'runner', 'helmet', 'shield', 'spear', 'balloon'], reward: null },
];
