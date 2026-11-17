// Registries (docs/custom-mode.md section 9): one data table per kind of
// thing, an entry per kind, read by the generator, the wave director and the
// menus. A new kind is one entry here (plus its behavior code), not edits
// across many files. Triggers, enemies and gear are here now; tools and decor
// move in when the director and the loader are built. No Three.js here.
import type { SettingKey } from './levelSettings.js';

/** Road triggers the slingshot sets off (src/world/triggers.ts builds them). */
export const TRIGGER_KINDS = {
  keg: { label: 'Powder keg', setting: 'kegs' },
  boulder: { label: 'Boulder', setting: 'boulders' },
  tree: { label: 'Tree', setting: 'trees' },
} satisfies Record<string, { label: string; setting: SettingKey }>;

/** Enemies a wave sends. `walker` ones walk the roads from a camp; balloons fly in. */
export const ENEMY_KINDS = {
  grunt: { label: 'Grunts', walker: true },
  runner: { label: 'Runners', walker: true },
  balloon: { label: 'Balloons', walker: false },
  // v3 Phase 3 (src/units/goblinKinds.ts). The digger tunnels instead of walking the roads.
  digger: { label: 'Diggers', walker: false },
  shaman: { label: 'Shamans', walker: true },
  bomber: { label: 'Bombers', walker: true },
  archer: { label: 'Goblin archers', walker: true },
} satisfies Record<string, { label: string; walker: boolean }>;

/** Goblin gear and the setting that sets its share (rules in src/rules/gear.ts). */
export const GEAR_KINDS = {
  helmet: { label: 'Helmets', setting: 'helmets' },
  shield: { label: 'Shields', setting: 'shields' },
  spear: { label: 'Spears', setting: 'spears' },
  sword: { label: 'Swords', setting: 'swords' },
} satisfies Record<string, { label: string; setting: SettingKey }>;

/**
 * v3 2.1: traps added to every map when it is built (src/world/triggers.ts,
 * addExtraTraps), not by the generator's settings (yet): haystacks, the bell
 * tower, the potion cart and the rope bridge.
 */
export const EXTRA_TRAPS = {
  hay: { label: 'Haystack' },
  bellTower: { label: 'Bell tower' },
  cart: { label: 'Potion cart' },
  bridge: { label: 'Rope bridge' },
};
export type ExtraTrap = keyof typeof EXTRA_TRAPS;

/** Every trap kind on the roads. The generator only places the TRIGGER_LIST ones. */
export type TriggerKind = keyof typeof TRIGGER_KINDS | ExtraTrap;
export const TRIGGER_LIST = Object.keys(TRIGGER_KINDS) as (keyof typeof TRIGGER_KINDS)[];
