// The achievements (docs/v3-plan.md 2.6): 8 secret abilities and 8 regular
// achievements, two even rows on the achievements shelf. Data only (no
// Three.js): the tracker is src/player/achievements.ts, the shelf
// src/ui/menu/shelves.ts. All numbers are start values to tune on the headset.

export type SecretId = 'acquiredTaste' | 'fairTrade' | 'nightOwl' | 'brightIdea' | 'gentleTouch' | 'changeOfMenu' | 'secretRecipe' | 'packageDeal';
export type GoalId = 'longShot' | 'eyesEverywhere' | 'blessYou' | 'ironGrip' | 'greenThumb' | 'commander' | 'trapMaster' | 'jackOfAllTrades';
export type AchievementId = SecretId | GoalId;

export interface Achievement {
  id: AchievementId;
  name: string;
  secret: boolean;
  /** The shelf's line before it is earned: the riddle (two short lines) for a secret, the goal for a regular one. */
  hint: [string, string];
  /** The shelf's line once earned (what a secret does, what a regular one taught). */
  earned: [string, string];
}

/** Riddle rules: easy words, one rhyming couplet, never naming the tool, the object or the effect. */
export const SECRETS: Achievement[] = [
  { id: 'acquiredTaste', name: 'Acquired Taste', secret: true, hint: ["A meal that's been dressed", 'will mend you the best.'], earned: ['Eat a peppered goblin:', 'it heals double.'] },
  { id: 'fairTrade', name: 'Fair Trade', secret: true, hint: ['They sent you a guest;', 'send it back to the rest.'], earned: ['Load a goblin in the slingshot:', 'it knocks out a group.'] },
  { id: 'nightOwl', name: 'Night Owl', secret: true, hint: ['When the stars come to stay,', 'a stone can borrow the day.'], earned: ['Hold a pebble in the torch at night:', 'it lights kegs and hay.'] },
  { id: 'brightIdea', name: 'Bright Idea', secret: true, hint: ['Greet the old fire on high,', "and your work won't run dry."], earned: ['Raise the glass to the sun:', 'a longer beam, once a wave.'] },
  { id: 'gentleTouch', name: 'Gentle Touch', secret: true, hint: ['Tug me, I fall.', 'Tap me, I call.'], earned: ["Shoot the tower's bell:", 'it rings and dazes goblins.'] },
  { id: 'changeOfMenu', name: 'Change of Menu', secret: true, hint: ["What the rare wheels pour", 'makes dinner worth more.'], earned: ['Eat a chicken:', 'it heals more than a goblin.'] },
  { id: 'secretRecipe', name: 'Secret Recipe', secret: true, hint: ['Hide some fire in their treat,', "and they'll be better to eat."], earned: ['Pepper a sugar cube:', 'goblins that eat it are seasoned.'] },
  { id: 'packageDeal', name: 'Package Deal', secret: true, hint: ['Call what waits to go bang,', 'then send it off with a twang.'], earned: ['Pull a keg in with the magnet,', 'then shoot it: a big blast.'] },
];

/** Each one teaches a skill or a play style, and can be earned in one good battle. */
export const GOALS: Achievement[] = [
  { id: 'longShot', name: 'Long Shot', secret: false, hint: ['Knock out a goblin near its', 'own camp with the slingshot.'], earned: ['You know the', "slingshot's range."] },
  { id: 'eyesEverywhere', name: 'Eyes Everywhere', secret: false, hint: ['Knock out goblins on 4 sides', 'of the castle within 15 s.'], earned: ['You read the compass', 'and spin the board.'] },
  { id: 'blessYou', name: 'Bless You', secret: false, hint: ['Stop a digger with', 'the pepper ring.'], earned: ['You read the mound', 'and placed the ring.'] },
  { id: 'ironGrip', name: 'Iron Grip', secret: false, hint: ['Pull 5 pieces of gear', 'in one magnet pull.'], earned: ['You wait for a group', 'and aim at the crowd.'] },
  { id: 'greenThumb', name: 'Green Thumb', secret: false, hint: ['Keep 3 plants alive', 'through a whole wave.'], earned: ['You look after', 'the garden.'] },
  { id: 'commander', name: 'Commander', secret: false, hint: ['Call, boost and move a squad', 'in one battle, and win.'], earned: ['You know all three', 'horn orders.'] },
  { id: 'trapMaster', name: 'Trap Master', secret: false, hint: ['Set off 3 different kinds', 'of traps in one battle.'], earned: ['You use the board,', 'not only the tools.'] },
  { id: 'jackOfAllTrades', name: 'Jack of All Trades', secret: false, hint: ['Win with every tool in the', 'loadout knocking one out.'], earned: ['You use the', 'whole loadout.'] },
];

export const ACHIEVEMENT_LIST: Achievement[] = [...SECRETS, ...GOALS];

export const ACHIEVEMENT_IDS: AchievementId[] = ACHIEVEMENT_LIST.map((a) => a.id);

/** Detection numbers for the regular achievements. */
export const ACHIEVEMENT_RULES = {
  /** Long Shot: a slingshot knockout this close to the goblin's own camp (cm, flat). */
  longShotRadius: 45,
  /** Eyes Everywhere: knockouts in this many of the 4 sides (90 degree quarters of the board) within this many seconds. */
  sides: 4,
  sidesWindow: 15,
  /** Iron Grip: this many pieces of gear pulled off within one pull (seconds from the first piece). */
  gearPieces: 5,
  gearWindow: 1.5,
  /** Green Thumb: this many plants alive from a wave's start to its clear. */
  plants: 3,
  /** Trap Master: this many different trap kinds set off by the player in one battle. */
  trapKinds: 3,
  /**
   * Jack of All Trades: a knockout counts for a tool that did it, or for a
   * support tool (magnet, sugar, pepper, drum) that touched the goblin within
   * this many seconds before it went down.
   */
  assistWindow: 15,
};

/** The toast that pops up when an achievement is earned in a battle. */
export const TROPHY_TOAST = {
  /** Size (m at the default board) and how far in front of the eyes, how far above the look's line (m). */
  width: 0.26,
  height: 0.09,
  distance: 0.62,
  above: 0.1,
  /** How long it shows (seconds), and the follow smoothing (seconds). */
  seconds: 4.5,
  smoothing: 0.25,
  /** The pop-in time (seconds). */
  popTime: 0.25,
  secretColor: 0x7a3fb0,
  goalColor: 0xb07a10,
  confetti: [0xffd23f, 0xffffff, 0x9fe07a, 0xc89cf0],
};
