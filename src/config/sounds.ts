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
  slingStretch: { files: ['rpg/creak1.ogg', 'rpg/creak2.ogg', 'rpg/creak3.ogg'], volume: 0.5, positional: true },
  slingRelease: { files: ['interface/pluck_001.ogg', 'interface/pluck_002.ogg'], volume: 0.9, positional: true },
  pebbleHit: {
    files: ['impact/impactPunch_medium_000.ogg', 'impact/impactPunch_medium_001.ogg', 'impact/impactPunch_medium_002.ogg'],
    volume: 0.9,
    positional: true,
  },
  pebbleLoad: { files: ['interface/click_001.ogg', 'interface/click_002.ogg'], volume: 0.8, positional: true },
  locked: { files: ['interface/error_004.ogg', 'interface/error_006.ogg'], volume: 0.5, positional: false },
  buttonClick: { files: ['interface/click_001.ogg', 'interface/click_002.ogg', 'interface/select_001.ogg'], volume: 0.8, positional: false },
  lessonDone: { files: ['interface/confirmation_002.ogg'], volume: 0.7, positional: false },
  toolPoof: { files: ['interface/maximize_008.ogg'], volume: 0.7, positional: true },
  round1: { files: ['voice/round_1.ogg'], volume: 0.7, positional: false },
  round2: { files: ['voice/round_2.ogg'], volume: 0.7, positional: false },
  round3: { files: ['voice/round_3.ogg'], volume: 0.7, positional: false },
  round4: { files: ['voice/round_4.ogg'], volume: 0.7, positional: false },
  finalRound: { files: ['voice/final_round.ogg'], volume: 0.7, positional: false },
  win: { files: ['voice/you_win.ogg', 'voice/winner.ogg'], volume: 0.8, positional: false },
  lose: { files: ['voice/you_lose.ogg', 'voice/game_over.ogg'], volume: 0.8, positional: false },
  // Missing in the packs (placeholder chime until build step 7).
  gulp: { files: [CHIME], volume: 0.4, positional: false },
  squeal: { files: [CHIME], volume: 0.15, positional: true },
  campRumble: { files: [CHIME], volume: 0.5, positional: true },
  cheer: { files: [CHIME], volume: 0.5, positional: false },
} satisfies Record<string, SoundDef>;

export type SoundName = keyof typeof SOUNDS;

/** Wave start voice, by wave (the last wave always says "final round"). */
export const WAVE_VOICES: SoundName[] = ['round1', 'round2', 'round3', 'round4'];
