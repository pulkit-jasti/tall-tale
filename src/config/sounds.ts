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
  /** A real medieval hand bell (Freesound, converted to mono WAV). The 10 s ring is cut at 4 s and fades out, so shakes never pile up. */
  bell: { files: ['144497__wuola__medieval-bell-a3.wav'], volume: 0.8, positional: true, maxSeconds: 4 },
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
 * Sound groups the player can turn up, down or off in the pause panel's
 * settings (src/audio/soundSettings.ts). Every sound is in one group; the
 * music is its own group.
 */
export const SOUND_CATEGORIES = [
  { id: 'music', label: 'Music' },
  { id: 'goblins', label: 'Goblins' },
  { id: 'battle', label: 'Battle' },
  { id: 'tools', label: 'Tools' },
  { id: 'voice', label: 'Voice and menus' },
] as const;

export type SoundCategory = (typeof SOUND_CATEGORIES)[number]['id'];

const GROUPS: Record<Exclude<SoundCategory, 'music'>, SoundName[]> = {
  goblins: ['chomp', 'gulp', 'squeal', 'goblinCackle', 'sneeze', 'poof', 'campRumble'],
  battle: ['wallHit', 'swordClash', 'debris', 'treeCreak', 'treeCrash', 'boulderRoll', 'kegBoom', 'triggerNow', 'cheer', 'waveHorn', 'winFanfare'],
  tools: [
    'grab',
    'drop',
    'slingStretch',
    'slingRelease',
    'pebbleLoad',
    'pebbleHit',
    'toolPoof',
    'toolReturn',
    'foodAdded',
    'swatWhoosh',
    'swatSplat',
    'pepperShake',
    'bell',
    'balloonPop',
    'stunned',
  ],
  voice: ['readyTick', 'buttonClick', 'locked', 'pauseOpen', 'pauseClose', 'lessonDone', 'round1', 'round2', 'round3', 'round4', 'finalRound', 'win', 'lose'],
};

/** The group a sound is in (a sound left out of GROUPS counts as battle). */
export function soundCategory(name: SoundName): SoundCategory {
  for (const [category, names] of Object.entries(GROUPS) as [SoundCategory, SoundName[]][]) if (names.includes(name)) return category;
  return 'battle';
}

/** The settings' volume steps: the slider and its minus and plus buttons move by 1 / steps. */
export const SOUND_SETTINGS = { steps: 10, storageKey: 'tallTale.sound' };

export interface MusicTrack {
  /** Path relative to public/audio/. */
  file: string;
  volume: number;
  /** Loop between these points (seconds) instead of the whole file. */
  loopStart?: number;
  loopEnd?: number;
}

/**
 * Background music (src/audio/music.ts): `menu` for the welcome, end and
 * pause panels, `battle` while a battle is fought. Quiet, so the sound cues
 * stay clear. A change fades across over `fade` seconds.
 */
export const MUSIC = {
  enabled: true,
  fade: 1.5,
  menu: { file: '812170__giangallegos__ambient-music.mp3', volume: 0.35 } as MusicTrack,
  // The file's name says it loops at 32 s: the 4.7 s after that is its tail.
  battle: {
    file: '649132__sonically_sound__medievalfantasy-rpg-loop-mix-at-32-secs-to-extendrepeat.flac',
    volume: 0.22,
    loopStart: 0,
    loopEnd: 32,
  } as MusicTrack,
};

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
  /**
   * Sounds that play at least `longFrom` seconds (as played, after a
   * maxSeconds cut) fade out over their last `seconds` (at most `maxShare`
   * of the sound), so they end softly. Shorter sounds keep their sharp end.
   */
  fadeOut: { longFrom: 2, seconds: 1.2, maxShare: 0.4 },
  /** When the audio pauses (the Quest menu, the headset off) everything fades out over this long first, and back in after (seconds). */
  pauseFade: 0.5,
};

/** Wave start voice, by wave (the last wave always says "final round"). */
export const WAVE_VOICES: SoundName[] = ['round1', 'round2', 'round3', 'round4'];
