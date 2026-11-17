// The level settings (docs/custom-mode.md section 4): every setting the
// generator reads, each describing itself (its kind, limits, default and
// label), so the Custom Game menu builds its rows from this list and a new
// setting shows up there without new UI code. One settings object (plus the
// seed) goes to the generator, from a campaign preset or the menu alike.
// No Three.js here.

export type SettingGroup = 'map' | 'waves' | 'rules';

/** The tabs of the Custom Game page, in order. */
export const SETTING_GROUPS: { id: SettingGroup; label: string }[] = [
  { id: 'map', label: 'Map' },
  { id: 'waves', label: 'Waves' },
  { id: 'rules', label: 'Rules' },
];

export type CampSpread = 'around' | 'opposite' | 'oneSide';
export type Difficulty = 'easy' | 'normal' | 'hard';

/** Every setting's value. The keys are the settings below. */
export interface LevelSettings {
  // Map
  camps: number;
  campSpread: CampSpread;
  /** The nearest and farthest a camp may be from the castle (cm). */
  campDistance: [number, number];
  /** Camp hill width (cm). */
  campSize: number;
  junctions: number;
  /** How much roads bend and wind (0 straight, 1 the most). */
  wiggle: number;
  /** Camp roads that split in two on the way in (a short way and a long way). */
  forks: number;
  /** Ring roads between neighboring junctions (a threat seen on the left arrives on the right). */
  loops: number;
  /** Side roads from one junction to the next one's inner junction (roads that cross). */
  crossings: number;
  triggersPerRoad: number;
  kegs: boolean;
  boulders: boolean;
  trees: boolean;
  /** v3 2.1 traps on the map (0 leaves a kind out): haystacks, bell towers, rope bridges, and the potion cart's spots. */
  hay: number;
  bellTowers: number;
  bridges: number;
  potionCart: boolean;
  /** v3 2.2: seed beds for the magnifying glass's sun garden. */
  seedBeds: number;
  // Waves
  /** How many waves the level has. */
  waves: number;
  /** The allowed times of day (docs/custom-mode.md "Allowed lists"): the waves are spread over the chosen ones, in this order. */
  morning: boolean;
  day: boolean;
  sunset: boolean;
  night: boolean;
  difficulty: Difficulty;
  /** Goblins in wave 1. */
  goblins: number;
  /** More goblins each wave (0.25 = a quarter more than the wave before). */
  growth: number;
  /** Share of runners. */
  runners: number;
  /** Balloons per wave (from wave 2). */
  balloons: number;
  helmets: number;
  shields: number;
  spears: number;
  swords: number;
  /** Goblins come out over this long (seconds). */
  waveLength: number;
  campsAtOnce: number;
  /** v3 2.7: fog rolls in for the night wave (NIGHT_FOG). */
  foggyNight: boolean;
  /** v3 Phase 3: the new goblins per wave, from wave 2 (0: none). */
  diggers: number;
  shamans: number;
  bombers: number;
  goblinArchers: number;
  // Rules
  archers: number;
  guards: number;
  /** A missing archer comes back this often (seconds); guards take twice as long. */
  refill: number;
  /** The castle's starting health (share). */
  castleHealth: number;
  /** The allowed tools (docs/custom-mode.md "Allowed lists"): the loadout only takes these. Never adds a locked tool. */
  toolSlingshot: boolean;
  toolHorn: boolean;
  toolSwatter: boolean;
  toolPepper: boolean;
  toolDrum: boolean;
  toolMagnet: boolean;
  toolGlass: boolean;
  toolSugar: boolean;
}

/** The time of day settings, in the order the waves go through them. */
export const TIME_SETTINGS = ['morning', 'day', 'sunset', 'night'] as const;
/** Each tool's allowed switch (the tool names are PickTool in src/rules/campaign.ts). */
export const TOOL_SETTINGS = {
  slingshot: 'toolSlingshot',
  horn: 'toolHorn',
  swatter: 'toolSwatter',
  pepper: 'toolPepper',
  drum: 'toolDrum',
  magnet: 'toolMagnet',
  glass: 'toolGlass',
  sugar: 'toolSugar',
} as const satisfies Record<string, keyof LevelSettings>;

export type SettingKey = keyof LevelSettings;

/** How a value is shown next to its control. */
export type SettingUnit = 'count' | 'percent' | 'seconds' | 'cm';

interface Base<K extends SettingKey> {
  key: K;
  group: SettingGroup;
  label: string;
}

/** A small whole number, set with minus and plus (the number stepper). */
export interface CountDef extends Base<SettingKey> {
  kind: 'count';
  min: number;
  max: number;
  default: number;
}

/** A number along a slider. */
export interface RangeDef extends Base<SettingKey> {
  kind: 'range';
  min: number;
  max: number;
  step: number;
  default: number;
  unit: SettingUnit;
}

/** A minimum and a maximum (the range slider with two handles). */
export interface SpanDef extends Base<SettingKey> {
  kind: 'span';
  min: number;
  max: number;
  step: number;
  default: [number, number];
  unit: SettingUnit;
}

/** One of a few named choices (the choice picker). */
export interface ChoiceDef extends Base<SettingKey> {
  kind: 'choice';
  choices: { id: string; label: string }[];
  default: string;
}

/** On or off (the switch). */
export interface ToggleDef extends Base<SettingKey> {
  kind: 'toggle';
  default: boolean;
}

export type SettingDef = CountDef | RangeDef | SpanDef | ChoiceDef | ToggleDef;

/** The seed is not a setting (it goes beside them), but the menu shows it as the Map tab's first row. */
export const SEED = { label: 'Seed', max: 99999, hint: 'Same seed, same map. Roll for a new one' };

export const LEVEL_SETTINGS: SettingDef[] = [
  // Map: what the battleground looks like.
  { key: 'camps', group: 'map', label: 'Camps', kind: 'count', min: 1, max: 5, default: 3 },
  {
    key: 'campSpread',
    group: 'map',
    label: 'Camp places',
    kind: 'choice',
    choices: [
      { id: 'around', label: 'Around' },
      { id: 'opposite', label: 'Opposite' },
      { id: 'oneSide', label: 'One side' },
    ],
    default: 'around',
  },
  { key: 'campDistance', group: 'map', label: 'Camp distance', kind: 'span', min: 180, max: 470, step: 10, default: [330, 430], unit: 'cm' },
  { key: 'campSize', group: 'map', label: 'Camp size', kind: 'range', min: 20, max: 40, step: 1, default: 30, unit: 'cm' },
  { key: 'junctions', group: 'map', label: 'Junctions', kind: 'count', min: 1, max: 8, default: 4 },
  { key: 'wiggle', group: 'map', label: 'Winding roads', kind: 'range', min: 0, max: 1, step: 0.05, default: 0.5, unit: 'percent' },
  { key: 'forks', group: 'map', label: 'Forks', kind: 'count', min: 0, max: 3, default: 1 },
  { key: 'loops', group: 'map', label: 'Ring roads', kind: 'count', min: 0, max: 4, default: 1 },
  { key: 'crossings', group: 'map', label: 'Crossings', kind: 'count', min: 0, max: 3, default: 0 },
  { key: 'triggersPerRoad', group: 'map', label: 'Traps per road', kind: 'count', min: 0, max: 3, default: 1 },
  { key: 'kegs', group: 'map', label: 'Powder kegs', kind: 'toggle', default: true },
  { key: 'boulders', group: 'map', label: 'Boulders', kind: 'toggle', default: true },
  { key: 'trees', group: 'map', label: 'Trees', kind: 'toggle', default: true },
  // v3 2.1 and 2.2: the new traps and the seed beds, now per level (were fixed counts for every map).
  { key: 'hay', group: 'map', label: 'Haystacks', kind: 'count', min: 0, max: 4, default: 2 },
  { key: 'bellTowers', group: 'map', label: 'Bell towers', kind: 'count', min: 0, max: 2, default: 1 },
  { key: 'bridges', group: 'map', label: 'Rope bridges', kind: 'count', min: 0, max: 2, default: 1 },
  { key: 'potionCart', group: 'map', label: 'Potion cart', kind: 'toggle', default: true },
  { key: 'seedBeds', group: 'map', label: 'Seed beds', kind: 'count', min: 0, max: 10, default: 6 },
  // Waves: who comes, and how many.
  { key: 'waves', group: 'waves', label: 'Waves', kind: 'count', min: 2, max: 6, default: 4 },
  { key: 'morning', group: 'waves', label: 'Morning', kind: 'toggle', default: true },
  { key: 'day', group: 'waves', label: 'Day', kind: 'toggle', default: true },
  { key: 'sunset', group: 'waves', label: 'Sunset', kind: 'toggle', default: true },
  { key: 'night', group: 'waves', label: 'Night', kind: 'toggle', default: true },
  {
    key: 'difficulty',
    group: 'waves',
    label: 'Difficulty',
    kind: 'choice',
    choices: [
      { id: 'easy', label: 'Easy' },
      { id: 'normal', label: 'Normal' },
      { id: 'hard', label: 'Hard' },
    ],
    default: 'normal',
  },
  // v3 (docs/v3-plan.md 1.5): bigger waves (was 10 and 25%), so enough goblins reach the wall to feed the horn about twice a wave.
  { key: 'goblins', group: 'waves', label: 'Goblins in wave 1', kind: 'count', min: 4, max: 40, default: 22 },
  { key: 'growth', group: 'waves', label: 'More each wave', kind: 'range', min: 0, max: 0.6, step: 0.05, default: 0.2, unit: 'percent' },
  { key: 'runners', group: 'waves', label: 'Runners', kind: 'range', min: 0, max: 1, step: 0.05, default: 0.25, unit: 'percent' },
  // Up to 10 a wave (was 4), so a level can be all about balloons (Sky Pirates). At most BALLOONS.max fly at once; the rest wait their turn.
  { key: 'balloons', group: 'waves', label: 'Balloons', kind: 'count', min: 0, max: 10, default: 1 },
  { key: 'helmets', group: 'waves', label: 'Helmets', kind: 'range', min: 0, max: 1, step: 0.05, default: 0.35, unit: 'percent' },
  { key: 'shields', group: 'waves', label: 'Shields', kind: 'range', min: 0, max: 1, step: 0.05, default: 0.3, unit: 'percent' },
  { key: 'spears', group: 'waves', label: 'Spears', kind: 'range', min: 0, max: 1, step: 0.05, default: 0.4, unit: 'percent' },
  { key: 'swords', group: 'waves', label: 'Swords', kind: 'range', min: 0, max: 1, step: 0.05, default: 0.25, unit: 'percent' },
  { key: 'waveLength', group: 'waves', label: 'Wave length', kind: 'range', min: 30, max: 90, step: 5, default: 50, unit: 'seconds' },
  { key: 'campsAtOnce', group: 'waves', label: 'Camps at once', kind: 'count', min: 1, max: 5, default: 2 },
  { key: 'foggyNight', group: 'waves', label: 'Foggy night', kind: 'toggle', default: false },
  // v3 Phase 3 (the "allowed goblins" list, docs/custom-mode.md section 4): 0 leaves a type out.
  { key: 'diggers', group: 'waves', label: 'Diggers', kind: 'count', min: 0, max: 4, default: 0 },
  { key: 'shamans', group: 'waves', label: 'Shamans', kind: 'count', min: 0, max: 3, default: 0 },
  { key: 'bombers', group: 'waves', label: 'Bombers', kind: 'count', min: 0, max: 4, default: 0 },
  { key: 'goblinArchers', group: 'waves', label: 'Goblin archers', kind: 'count', min: 0, max: 9, default: 0 },
  // Rules: the battle around the map and the waves.
  { key: 'archers', group: 'rules', label: 'Archers', kind: 'count', min: 0, max: 6, default: 4 },
  { key: 'guards', group: 'rules', label: 'Guards', kind: 'count', min: 0, max: 4, default: 2 },
  { key: 'refill', group: 'rules', label: 'Help comes every', kind: 'range', min: 5, max: 40, step: 1, default: 15, unit: 'seconds' },
  { key: 'castleHealth', group: 'rules', label: 'Castle health', kind: 'range', min: 0.3, max: 1, step: 0.05, default: 1, unit: 'percent' },
  // The allowed tools: the loadout stand only takes these in this level.
  { key: 'toolSlingshot', group: 'rules', label: 'Slingshot', kind: 'toggle', default: true },
  { key: 'toolHorn', group: 'rules', label: 'War horn', kind: 'toggle', default: true },
  { key: 'toolSwatter', group: 'rules', label: 'Fly swatter', kind: 'toggle', default: true },
  { key: 'toolPepper', group: 'rules', label: 'Pepper', kind: 'toggle', default: true },
  { key: 'toolDrum', group: 'rules', label: 'Drum', kind: 'toggle', default: true },
  { key: 'toolMagnet', group: 'rules', label: 'Magnet', kind: 'toggle', default: true },
  { key: 'toolGlass', group: 'rules', label: 'Magnifying glass', kind: 'toggle', default: true },
  { key: 'toolSugar', group: 'rules', label: 'Sugar cubes', kind: 'toggle', default: true },
];

/** A short line under each setting's name on the Custom Game page: what it does (headset test 2026-11-11). */
export const SETTING_HINTS: Record<SettingKey, string> = {
  camps: 'Goblin camps around the castle',
  campSpread: 'Where the camps stand',
  campDistance: 'How far the camps are from the walls',
  campSize: 'How big each goblin camp is',
  junctions: 'Crossroads where the roads meet',
  wiggle: 'Straight roads, or winding ones',
  forks: 'Roads that split into a short and a long way',
  loops: 'Roads that run around the castle',
  crossings: 'Side roads between the crossroads',
  triggersPerRoad: 'Kegs, boulders or trees on each road',
  kegs: 'Blow up when you shoot them',
  boulders: 'Roll down the road when shot',
  trees: 'Fall across the road when shot',
  hay: 'Burn with the glass and block a road',
  bellTowers: 'Drop the bell with the magnet',
  bridges: 'Cut the rope with a shot',
  potionCart: 'A cart of strange potions now and then',
  seedBeds: 'Beds the magnifying glass grows plants in',
  waves: 'How many waves the battle has',
  morning: 'Waves may be fought in the morning',
  day: 'Waves may be fought by day',
  sunset: 'Waves may be fought at sunset',
  night: 'Waves may be fought at night',
  toolSlingshot: 'Allowed in the loadout',
  toolHorn: 'Allowed in the loadout',
  toolSwatter: 'Allowed in the loadout',
  toolPepper: 'Allowed in the loadout',
  toolDrum: 'Allowed in the loadout',
  toolMagnet: 'Allowed in the loadout',
  toolGlass: 'Allowed in the loadout',
  toolSugar: 'Allowed in the loadout',
  difficulty: 'More goblins, and they come faster',
  goblins: 'How many come in the first wave',
  growth: 'Extra goblins in every later wave',
  runners: 'Small, fast goblins',
  balloons: 'Flying riders in each wave from wave 2',
  helmets: 'One extra hit to knock them out',
  shields: 'One extra hit to knock them out',
  spears: 'Hit the castle wall twice as hard',
  swords: 'Strike your soldiers faster',
  waveLength: 'Time over which the goblins come out',
  campsAtOnce: 'Camps sending goblins at the same time',
  foggyNight: 'Fog hides the far board in the night wave',
  diggers: 'Tunnel in unseen each wave from wave 2',
  shamans: 'Give stripped goblins their gear back',
  bombers: 'Carry a keg to blow up your wall',
  goblinArchers: 'Shoot at your wall guards from the road',
  archers: 'Archers on the castle wall',
  guards: 'Guards fighting on the rampart',
  refill: 'How fast lost soldiers come back',
  castleHealth: 'The castle starts with this much health',
};

/** How difficulty moves the wave settings together (docs/custom-mode.md section 4), and the skulls on the card. */
export const DIFFICULTY: Record<Difficulty, { goblins: number; waveLength: number; skulls: 1 | 2 | 3 }> = {
  easy: { goblins: 0.75, waveLength: 1.2, skulls: 1 },
  normal: { goblins: 1, waveLength: 1, skulls: 2 },
  hard: { goblins: 1.3, waveLength: 0.85, skulls: 3 },
};

/** The settings with every default. */
export function defaultSettings(): LevelSettings {
  const out: Record<string, unknown> = {};
  for (const def of LEVEL_SETTINGS) out[def.key] = Array.isArray(def.default) ? [...def.default] : def.default;
  return out as unknown as LevelSettings;
}

const snap = (value: number, min: number, max: number, step: number): number => {
  const clamped = Math.min(max, Math.max(min, value));
  const snapped = min + Math.round((clamped - min) / step) * step;
  return Math.round(Math.min(max, snapped) * 1e6) / 1e6;
};

/** One setting's value made valid (in its limits, on its steps, the right type), or its default. */
export function fixValue(def: SettingDef, value: unknown): LevelSettings[SettingKey] {
  switch (def.kind) {
    case 'count':
      return typeof value === 'number' && Number.isFinite(value) ? snap(value, def.min, def.max, 1) : def.default;
    case 'range':
      return typeof value === 'number' && Number.isFinite(value) ? snap(value, def.min, def.max, def.step) : def.default;
    case 'span': {
      if (!Array.isArray(value) || value.length !== 2 || !value.every((v) => typeof v === 'number' && Number.isFinite(v))) return [...def.default];
      const a = snap(value[0], def.min, def.max, def.step);
      const b = snap(value[1], def.min, def.max, def.step);
      return [Math.min(a, b), Math.max(a, b)];
    }
    case 'choice':
      // A choice setting's ids are its type's values (campSpread, difficulty).
      return (def.choices.some((c) => c.id === value) ? value : def.default) as LevelSettings[SettingKey];
    case 'toggle':
      return typeof value === 'boolean' ? value : def.default;
  }
}

/** Settings read from storage or a file: every known setting made valid, missing ones at their default, unknown ones dropped. */
export function fixSettings(data: unknown): LevelSettings {
  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const out: Record<string, unknown> = {};
  for (const def of LEVEL_SETTINGS) out[def.key] = fixValue(def, raw[def.key]);
  return out as unknown as LevelSettings;
}

/** A setting's value as a short text beside its control ("3", "60%", "50 s", "330 to 430 cm", "Normal", "On"). */
export function formatValue(def: SettingDef, value: LevelSettings[SettingKey]): string {
  const unit = (n: number, u: SettingUnit): string =>
    u === 'percent' ? `${Math.round(n * 100)}%` : u === 'seconds' ? `${Math.round(n)} s` : u === 'cm' ? `${Math.round(n)} cm` : `${Math.round(n)}`;
  switch (def.kind) {
    case 'count':
      return `${value as number}`;
    case 'range':
      return unit(value as number, def.unit);
    case 'span': {
      const [a, b] = value as [number, number];
      return def.unit === 'cm' ? `${Math.round(a)} to ${Math.round(b)} cm` : `${unit(a, def.unit)} to ${unit(b, def.unit)}`;
    }
    case 'choice':
      return def.choices.find((c) => c.id === value)?.label ?? '';
    case 'toggle':
      return value ? 'On' : 'Off';
  }
}

/** A short description made from the settings, for the level's card ("3 camps, winding roads, hard"). Never typed. */
export function describeSettings(s: LevelSettings): string {
  const camps = s.camps === 1 ? '1 camp' : `${s.camps} camps`;
  const roads = s.wiggle < 0.25 ? 'straight roads' : s.wiggle < 0.6 ? 'curvy roads' : 'winding roads';
  const extras: string[] = [];
  if (s.runners >= 0.5) extras.push('lots of runners');
  if (s.balloons >= 3) extras.push('lots of balloons');
  if (s.shields >= 0.6) extras.push('shields');
  if (s.spears >= 0.6) extras.push('spears');
  if (s.castleHealth < 0.7) extras.push('a damaged castle');
  if (s.foggyNight) extras.push('a foggy night');
  if (s.diggers > 0) extras.push('diggers');
  if (s.shamans > 0) extras.push('shamans');
  if (s.bombers > 0) extras.push('bombers');
  if (s.goblinArchers > 0) extras.push('goblin archers');
  return [camps, roads, ...extras.slice(0, 1), s.difficulty].join(', ');
}
