// Endless mode's boost cards (docs/v3-plan.md Phase 5, "Boost cards"): a
// pick of 1 of 3 in every breather. Each card is a small step that stacks up
// to its max, each stack a bit smaller. `BOOST` holds what the picked cards
// add up to; the tools and systems read it where they use the number it
// changes (all 1 or 0 outside Endless, so nothing changes there). Reset at
// every battle start. No Three.js here.
import type { Random } from './random.js';
import type { PickTool } from './campaign.js';

type TimedTool = 'swatter' | 'pepper' | 'drum' | 'horn' | 'magnet' | 'glass' | 'sugar';

/** What the picked cards add up to. Multipliers are 1 and additions 0 with no cards. */
export interface BoostState {
  /** Extra seconds (or swings) of each tool's use window. */
  use: Record<TimedTool, number>;
  /** Each tool's recharge time is multiplied by this. */
  recharge: Record<TimedTool, number>;
  /** Extra gear pieces a pebble breaks. */
  pebbleGear: number;
  aim: number;
  swatterRadius: number;
  pepperLast: number;
  magnetRadius: number;
  /** Plants grow in this share of the time (under 1 is faster). */
  grow: number;
  /** Plants live this many times as long. */
  plantLife: number;
  stun: number;
  sugar: number;
  /** Share of the missing castle health repaired in each breather. */
  repair: number;
  heal: number;
  /** Used traps come back in this share of the time. */
  trapDelay: number;
  kegBlast: number;
  /** Extra knight squads the horn may have out. */
  squads: number;
  /** Extra blows a field knight takes before going down. */
  knightHits: number;
  /** The potion cart's chance is multiplied by this. */
  cart: number;
  /** The castle's max health is multiplied by this (applied by the battle when picked). */
  wall: number;
}

const tools = (v: number): Record<TimedTool, number> => ({ swatter: v, pepper: v, drum: v, horn: v, magnet: v, glass: v, sugar: v });

function fresh(): BoostState {
  return {
    use: tools(0),
    recharge: tools(1),
    pebbleGear: 0,
    aim: 1,
    swatterRadius: 1,
    pepperLast: 1,
    magnetRadius: 1,
    grow: 1,
    plantLife: 1,
    stun: 1,
    sugar: 1,
    repair: 0,
    heal: 1,
    trapDelay: 1,
    kegBlast: 1,
    squads: 0,
    knightHits: 0,
    cart: 1,
    wall: 1,
  };
}

/** The live boosts (read by the systems). */
export const BOOST: BoostState = fresh();

/** No cards (a new battle). */
export function resetBoosts(): void {
  Object.assign(BOOST, fresh());
}

export type BoostIcon = 'target' | 'hourglass' | 'clock' | 'chevron' | 'starIcon' | 'heart' | 'wrench' | 'tower' | 'skull' | 'flag' | 'shield' | 'award' | 'crown';

export interface BoostCard {
  id: string;
  name: string;
  /** One line of plain text: exactly what it does (never a hint at a secret). */
  text: string;
  icon: BoostIcon;
  rare: boolean;
  /** Only offered while this tool is on the stand. */
  tool?: PickTool;
  /** How many times it stacks. */
  max: number;
  /** Adds one stack. `step` is this stack's size share (1, then smaller). */
  apply: (b: BoostState, step: number) => void;
}

/** Each stack's size share: the first full, then smaller. */
export const STACK_STEPS = [1, 0.7, 0.5];

const faster = (tool: TimedTool) => (b: BoostState, step: number) => (b.recharge[tool] *= 1 - 0.15 * step);

export const BOOST_CARDS: BoostCard[] = [
  { id: 'heavyPebbles', name: 'Heavy Pebbles', text: 'A pebble breaks 2 pieces of gear', icon: 'target', rare: false, tool: 'slingshot', max: 1, apply: (b) => (b.pebbleGear += 1) },
  { id: 'steadyAim', name: 'Steady Aim', text: 'The slingshot aims a little better', icon: 'target', rare: false, tool: 'slingshot', max: 3, apply: (b, s) => (b.aim *= 1 + 0.3 * s) },
  { id: 'longSwing', name: 'Long Swing', text: 'Swatter lasts 2 s longer', icon: 'hourglass', rare: false, tool: 'swatter', max: 3, apply: (b, s) => (b.use.swatter += 2 * s) },
  { id: 'quickSwatter', name: 'Quick Swatter', text: 'Swatter recharges 15% faster', icon: 'clock', rare: false, tool: 'swatter', max: 3, apply: faster('swatter') },
  { id: 'wideSwatter', name: 'Wide Swatter', text: 'Swatter hits a wider area', icon: 'chevron', rare: false, tool: 'swatter', max: 3, apply: (b, s) => (b.swatterRadius *= 1 + 0.15 * s) },
  { id: 'strongSpice', name: 'Strong Spice', text: 'The pepper ring lasts longer', icon: 'hourglass', rare: false, tool: 'pepper', max: 3, apply: (b, s) => (b.pepperLast *= 1 + 0.25 * s) },
  { id: 'quickPepper', name: 'Quick Pepper', text: 'Pepper recharges 15% faster', icon: 'clock', rare: false, tool: 'pepper', max: 3, apply: faster('pepper') },
  { id: 'strongPull', name: 'Strong Pull', text: "The magnet's ring is bigger", icon: 'chevron', rare: false, tool: 'magnet', max: 3, apply: (b, s) => (b.magnetRadius *= 1 + 0.15 * s) },
  { id: 'quickMagnet', name: 'Quick Magnet', text: 'Magnet recharges 15% faster', icon: 'clock', rare: false, tool: 'magnet', max: 3, apply: faster('magnet') },
  { id: 'longBeam', name: 'Long Beam', text: 'Magnifying glass beam lasts 2 s longer', icon: 'hourglass', rare: false, tool: 'glass', max: 3, apply: (b, s) => (b.use.glass += 2 * s) },
  { id: 'greenFingers', name: 'Green Fingers', text: 'Plants grow faster', icon: 'starIcon', rare: false, tool: 'glass', max: 3, apply: (b, s) => (b.grow *= 1 - 0.2 * s) },
  { id: 'toughRoots', name: 'Tough Roots', text: 'Plants wilt more slowly', icon: 'heart', rare: false, tool: 'glass', max: 3, apply: (b, s) => (b.plantLife *= 1 + 0.25 * s) },
  { id: 'loudDrum', name: 'Loud Drum', text: "The drum's stun lasts longer", icon: 'hourglass', rare: false, tool: 'drum', max: 3, apply: (b, s) => (b.stun *= 1 + 0.2 * s) },
  { id: 'quickDrum', name: 'Quick Drum', text: 'Drum recharges 15% faster', icon: 'clock', rare: false, tool: 'drum', max: 3, apply: faster('drum') },
  { id: 'sweetTooth', name: 'Sweet Tooth', text: 'Sugar cubes keep goblins busy longer', icon: 'hourglass', rare: false, tool: 'sugar', max: 3, apply: (b, s) => (b.sugar *= 1 + 0.25 * s) },
  { id: 'quickHorn', name: 'Quick Horn', text: 'Horn recharges 15% faster', icon: 'clock', rare: false, tool: 'horn', max: 3, apply: faster('horn') },
  { id: 'stoneMasons', name: 'Stone Masons', text: 'The wall repairs a little after each wave', icon: 'wrench', rare: false, max: 3, apply: (b, s) => (b.repair += 0.08 * s) },
  { id: 'bigAppetite', name: 'Big Appetite', text: 'Eating heals 15% more', icon: 'heart', rare: false, max: 3, apply: (b, s) => (b.heal *= 1 + 0.15 * s) },
  { id: 'quickRebuild', name: 'Quick Rebuild', text: 'Traps come back faster', icon: 'tower', rare: false, max: 3, apply: (b, s) => (b.trapDelay *= 1 - 0.2 * s) },
  { id: 'bigBooms', name: 'Big Booms', text: 'Keg blasts are bigger', icon: 'skull', rare: false, max: 3, apply: (b, s) => (b.kegBlast *= 1 + 0.15 * s) },
  { id: 'warChief', name: 'War Chief', text: 'One more knight squad at once', icon: 'flag', rare: true, tool: 'horn', max: 2, apply: (b) => (b.squads += 1) },
  { id: 'ironKnights', name: 'Iron Knights', text: 'Knights take one more hit', icon: 'shield', rare: true, tool: 'horn', max: 2, apply: (b) => (b.knightHits += 1) },
  { id: 'luckyWheels', name: 'Lucky Wheels', text: 'The potion cart comes much more often', icon: 'award', rare: true, max: 1, apply: (b) => (b.cart *= 3) },
  { id: 'thickWalls', name: 'Thick Walls', text: "The castle's max health +25%", icon: 'crown', rare: true, max: 2, apply: (b, s) => (b.wall *= 1 + 0.25 * s) },
];

/**
 * A breather's cards: `count` different cards that still have stacks left
 * and fit the stand (a tool card only for a tool on it). At most one rare,
 * and only on a rareChance roll. Seeded.
 */
export function drawCards(rng: Random, stand: readonly PickTool[], stacks: ReadonlyMap<string, number>, count: number, rareChance: number): BoostCard[] {
  const open = BOOST_CARDS.filter((c) => (stacks.get(c.id) ?? 0) < c.max && (!c.tool || stand.includes(c.tool)));
  const commons = open.filter((c) => !c.rare);
  const rares = open.filter((c) => c.rare);
  const out: BoostCard[] = [];
  const take = (list: BoostCard[]): void => {
    if (list.length === 0) return;
    const i = rng.int(list.length);
    out.push(list.splice(i, 1)[0]);
  };
  if (rares.length > 0 && rng.next() < rareChance) take(rares);
  while (out.length < count && commons.length > 0) take(commons);
  while (out.length < count && rares.length > 0) take(rares);
  return out;
}

/** Adds one stack of a card to the live boosts. Returns the new stack count. */
export function pickCard(card: BoostCard, stacks: Map<string, number>): number {
  const n = (stacks.get(card.id) ?? 0) + 1;
  stacks.set(card.id, n);
  card.apply(BOOST, STACK_STEPS[Math.min(n, STACK_STEPS.length) - 1]);
  return n;
}
