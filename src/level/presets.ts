// The campaign presets (docs/custom-mode.md section 10): the settings each
// playable campaign level is made from. `npm run gen -- --campaign` makes
// every level file from these at once (src/maps/levels/levelN.json), and
// `--preset N` makes one. The files are the levels (frozen): changing a
// preset changes nothing until the command runs again.
//
// Only levels 1 to 5 are playable; 6 to 15 are locked teasers (cards only).
// Each preset changes only what its twist needs; everything else is the
// default setting. No Three.js here (the command line loads it).
import type { TimeOfDay } from '../config/game.js';
import { defaultSettings, fixSettings, type LevelSettings } from '../config/levelSettings.js';
import type { LevelOverrides } from './generate.js';

export interface CampaignPreset {
  level: number;
  /** The map's name (the level's card name). */
  name: string;
  seed: number;
  settings: Partial<LevelSettings>;
  /** The wave each camp rises in (camp 1 first). */
  campWaves?: number[];
  /** Each wave's time of day, when the allowed times are not enough (Nightfall). */
  times?: TimeOfDay[];
}

export const CAMPAIGN_PRESETS: CampaignPreset[] = [
  {
    // The walls, eating, rising camps: one camp in front at the start, a second rises behind the player.
    level: 1,
    name: 'First Watch',
    seed: 101,
    settings: {
      difficulty: 'easy',
      camps: 2,
      campSpread: 'opposite',
      junctions: 2,
      wiggle: 0.15,
      forks: 0,
      loops: 0,
      crossings: 0,
      triggersPerRoad: 1,
      hay: 0,
      bellTowers: 0,
      bridges: 0,
      potionCart: false,
      goblins: 14,
      growth: 0.15,
      runners: 0.15,
      balloons: 0,
      helmets: 0.1,
      shields: 0.1,
      spears: 0.2,
      swords: 0.1,
    },
    campWaves: [1, 2],
  },
  {
    // A slingshot level: lots of balloon riders.
    level: 2,
    name: 'Sky Pirates',
    seed: 202,
    settings: {
      difficulty: 'easy',
      camps: 3,
      junctions: 3,
      wiggle: 0.35,
      forks: 1,
      loops: 0,
      hay: 0,
      bridges: 0,
      goblins: 16,
      runners: 0.2,
      balloons: 4,
      helmets: 0.15,
      shields: 0.15,
    },
  },
  {
    // Introduces the magnet: most goblins wear helmets.
    level: 3,
    name: 'Tin Hats',
    seed: 303,
    settings: {
      difficulty: 'normal',
      camps: 3,
      junctions: 3,
      wiggle: 0.45,
      forks: 1,
      loops: 1,
      goblins: 18,
      runners: 0.15,
      balloons: 1,
      helmets: 0.85,
      shields: 0.25,
    },
  },
  {
    // Introduces the magnifying glass: many seed beds on a sunny map (no night wave, so the sun lasts).
    level: 4,
    name: 'Sun Garden',
    seed: 404,
    settings: {
      difficulty: 'normal',
      camps: 3,
      junctions: 4,
      wiggle: 0.5,
      forks: 1,
      loops: 1,
      seedBeds: 10,
      hay: 3,
      goblins: 20,
      helmets: 0.25,
      night: false,
    },
  },
  {
    // Wave 1 at sunset, waves 2 to 4 at night with night fog.
    level: 5,
    name: 'Nightfall',
    seed: 505,
    settings: {
      difficulty: 'normal',
      camps: 4,
      junctions: 4,
      wiggle: 0.6,
      forks: 2,
      loops: 1,
      crossings: 1,
      goblins: 20,
      foggyNight: true,
      morning: false,
      day: false,
    },
    times: ['sunset', 'night', 'night', 'night'],
  },
];

/** A preset's full settings (the defaults with its changes, made valid). */
export function presetSettings(p: CampaignPreset): LevelSettings {
  return fixSettings({ ...defaultSettings(), ...p.settings });
}

/** What generateLevel needs past the settings. */
export function presetOverrides(p: CampaignPreset): LevelOverrides {
  return { level: p.level, campWaves: p.campWaves, times: p.times };
}
