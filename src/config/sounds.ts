// Every sound the game plays, by name. Files are from public/audio/README.md.
// Sounds that README lists as missing use chime.mp3 until the last build step.

const CHIME = 'chime.mp3';

export interface SoundDef {
  /** Paths relative to public/audio/. One is picked at random each time. */
  files: string[];
  volume: number;
  /** Positional sounds come from a point in the world. */
  positional: boolean;
}

export const SOUNDS = {
  readyTick: { files: ['interface/tick_001.ogg', 'interface/tick_002.ogg'], volume: 0.35, positional: false },
  grab: { files: ['rpg/cloth1.ogg', 'rpg/cloth2.ogg', 'rpg/handleSmallLeather.ogg'], volume: 0.8, positional: true },
  drop: { files: ['interface/drop_001.ogg', 'interface/drop_002.ogg'], volume: 0.7, positional: true },
  chomp: {
    files: ['rpg/chop.ogg', 'impact/impactSoft_medium_000.ogg', 'impact/impactSoft_medium_001.ogg', 'impact/impactSoft_medium_002.ogg'],
    volume: 1,
    positional: false,
  },
  wallHit: {
    files: ['impact/impactMining_000.ogg', 'impact/impactMining_001.ogg', 'impact/impactMining_002.ogg'],
    volume: 0.45,
    positional: true,
  },
  poof: { files: ['impact/impactGeneric_light_000.ogg', 'impact/impactGeneric_light_001.ogg'], volume: 0.6, positional: true },
  // Missing in the packs (placeholder chime until build step 7).
  gulp: { files: [CHIME], volume: 0.4, positional: false },
  squeal: { files: [CHIME], volume: 0.15, positional: true },
} satisfies Record<string, SoundDef>;

export type SoundName = keyof typeof SOUNDS;
