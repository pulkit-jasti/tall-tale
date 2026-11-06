// Every sound the game plays, by name. Files are from public/audio/README.md.
// Sounds that README lists as missing use chime.mp3 until the last build step.

const CHIME = 'chime.mp3';

export interface SoundDef {
  /** Paths relative to public/audio/. One is picked at random each time. */
  files: string[];
  volume: number;
  /** Positional sounds come from a point in the world. */
  positional: boolean;
  /** Cut a long file after this many seconds. */
  maxSeconds?: number;
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
  pauseOpen: { files: ['interface/open_001.ogg'], volume: 0.7, positional: false },
  pauseClose: { files: ['interface/close_001.ogg'], volume: 0.7, positional: false },
  lessonDone: { files: ['interface/confirmation_002.ogg'], volume: 0.7, positional: false },
  toolPoof: { files: ['interface/maximize_008.ogg'], volume: 0.7, positional: true },
  toolReturn: { files: ['interface/minimize_008.ogg'], volume: 0.7, positional: true },
  foodAdded: { files: ['interface/confirmation_001.ogg', 'interface/confirmation_002.ogg'], volume: 0.5, positional: true },
  swatWhoosh: { files: ['rpg/knifeSlice.ogg', 'rpg/drawKnife1.ogg', 'rpg/drawKnife2.ogg'], volume: 0.6, positional: true },
  swatSplat: {
    files: ['impact/impactSoft_heavy_000.ogg', 'impact/impactSoft_heavy_001.ogg', 'impact/impactSoft_heavy_002.ogg'],
    volume: 1,
    positional: true,
  },
  pepperShake: { files: ['rpg/handleCoins.ogg', 'rpg/handleCoins2.ogg'], volume: 0.6, positional: true },
  bell: { files: ['impact/impactBell_heavy_000.ogg', 'impact/impactBell_heavy_001.ogg'], volume: 0.8, positional: true },
  stunned: { files: ['interface/glass_001.ogg', 'interface/glass_002.ogg'], volume: 0.7, positional: false },
  swordClash: {
    files: ['impact/impactMetal_light_000.ogg', 'impact/impactMetal_light_001.ogg', 'impact/impactMetal_medium_000.ogg'],
    volume: 0.35,
    positional: true,
  },
  debris: {
    files: ['impact/impactPlank_medium_000.ogg', 'impact/impactWood_heavy_000.ogg', 'impact/impactWood_heavy_001.ogg'],
    volume: 0.8,
    positional: true,
  },
  treeCreak: { files: ['rpg/creak1.ogg', 'rpg/creak2.ogg', 'rpg/creak3.ogg'], volume: 0.8, positional: true },
  treeCrash: { files: ['impact/impactWood_heavy_000.ogg', 'impact/impactWood_heavy_001.ogg'], volume: 1, positional: true },
  round1: { files: ['voice/round_1.ogg'], volume: 0.7, positional: false },
  round2: { files: ['voice/round_2.ogg'], volume: 0.7, positional: false },
  round3: { files: ['voice/round_3.ogg'], volume: 0.7, positional: false },
  round4: { files: ['voice/round_4.ogg'], volume: 0.7, positional: false },
  finalRound: { files: ['voice/final_round.ogg'], volume: 0.7, positional: false },
  win: { files: ['voice/you_win.ogg', 'voice/winner.ogg'], volume: 0.8, positional: false },
  lose: { files: ['voice/you_lose.ogg', 'voice/game_over.ogg'], volume: 0.8, positional: false },
  // From Freesound (public/audio/README.md).
  gulp: { files: ['646981__huw2k8__monster-eating-a-goblin.wav'], volume: 0.6, positional: false },
  squeal: { files: ['442817__qubodup__goblin-growl.wav'], volume: 0.6, positional: true },
  /** The goblin voice (not played yet: later the climber giggle). */
  goblinCackle: { files: ['202096__spookymodem__goblin-cackle.wav'], volume: 1, positional: true },
  campRumble: {
    files: ['173318__bliss__collab-2-war-drums-95-bpm.wav'],
    volume: 0.6,
    positional: true,
    maxSeconds: 3,
  },
  sneeze: { files: ['368802__inspectorj__sneeze-single-d.wav'], volume: 0.5, positional: true },
  boulderRoll: { files: ['807186__sound368__boulder-roll.wav'], volume: 0.7, positional: true },
  balloonPop: { files: ['372182__supersound23__pop.mp3'], volume: 0.7, positional: true },
  waveHorn: { files: ['539956__adharca__war-horn.wav'], volume: 0.5, positional: false },
  winFanfare: { files: ['99961__cgeffex__medieval-fanfare_neonaeon_tweaked-by-cgeffex.wav'], volume: 0.6, positional: false },
  // Still missing (placeholder chime).
  cheer: { files: [CHIME], volume: 0.5, positional: false },
  kegBoom: { files: [CHIME], volume: 0.7, positional: true },
  /** A group of goblins walks right past a trigger: "now!" (from its direction). */
  triggerNow: { files: [CHIME], volume: 0.55, positional: true },
} satisfies Record<string, SoundDef>;

export type SoundName = keyof typeof SOUNDS;

/**
 * How positional sounds are placed. Left and right come from the head model
 * (HRTF), but it hardly tells front from back, so sounds behind the head
 * are muffled and a little quieter (like many games do).
 */
export const SOUND_MIX = {
  /** Mix every positional file down to mono first, so it comes from one point (stereo files smear the direction). */
  mono: true,
  /** Full volume up to this distance (meters), then quieter: about 30% at 1 m, 15% at 2 m. */
  refDistance: 0.35,
  rolloff: 1.2,
  behind: {
    /** It starts at the side (90 degrees off the nose) and is strongest straight behind. */
    lowpassHz: 1800,
    volume: 0.7,
    /** How fast it follows a turn of the head or the board (seconds). */
    smoothing: 0.05,
  },
};

/** Wave start voice, by wave (the last wave always says "final round"). */
export const WAVE_VOICES: SoundName[] = ['round1', 'round2', 'round3', 'round4'];
