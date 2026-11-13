// Gear rules (docs/v2-plan.md 2.5). Plain functions, no Three.js, so they can
// be tested later. Goblins and troops only call these.
//
// - Helmet: one extra hit. Shield: one extra hit, counted separately. A
//   goblin with both takes 3 hits. This counts for every hit (pebble, arrow,
//   soldier, swatter, goblin shot). Triggers ignore armor (the big
//   environmental hits).
// - Spear: double wall damage. Sword: strikes troops faster in a fight.
// - The same rules apply to troops: a soldier's shield is one extra hit.

export type GoblinWeapon = 'none' | 'spear' | 'sword';
export type ArmorPiece = 'helmet' | 'shield';

export interface Armor {
  helmet: boolean;
  shield: boolean;
}

/** What one hit takes off: the helmet first, then the shield. Null: nothing left, the hit knocks out. */
export function armorHit(armor: Armor): ArmorPiece | null {
  if (armor.helmet) return 'helmet';
  if (armor.shield) return 'shield';
  return null;
}

/** Hits it takes to knock out a goblin with this armor. */
export function hitsToKnockOut(armor: Armor): number {
  return 1 + (armor.helmet ? 1 : 0) + (armor.shield ? 1 : 0);
}

/** Castle damage of one wall hit: a spear hits `spearScale` times as hard. */
export function wallHitDamage(base: number, weapon: GoblinWeapon, spearScale: number): number {
  return weapon === 'spear' ? base * spearScale : base;
}

/** Seconds between a goblin's strikes at a soldier: a sword strikes faster (`swordScale` below 1). */
export function strikeEvery(base: number, weapon: GoblinWeapon, swordScale: number): number {
  return weapon === 'sword' ? base * swordScale : base;
}

/** Hits a soldier takes before it goes down: a shield is one more. */
export function troopHitsToDown(base: number, shield: boolean): number {
  return base + (shield ? 1 : 0);
}

/** A goblin's gear when it comes out of its camp (`rolls` are three random numbers 0 to 1). */
export interface GearRoll {
  weapon: GoblinWeapon;
  helmet: boolean;
  shield: boolean;
}

export interface GearShares {
  spearShare: number;
  swordShare: number;
  helmetShare: number;
  shieldShare: number;
}

/**
 * Picks a grunt's gear. `helmets` and `shields` say whether this wave hands
 * them out at all. Runners stay bare handed (they need their hands to run).
 */
export function rollGear(shares: GearShares, helmets: boolean, shields: boolean, r1: number, r2: number, r3: number): GearRoll {
  const weapon: GoblinWeapon = r1 < shares.spearShare ? 'spear' : r1 < shares.spearShare + shares.swordShare ? 'sword' : 'none';
  return { weapon, helmet: helmets && r2 < shares.helmetShare, shield: shields && r3 < shares.shieldShare };
}
