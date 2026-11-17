// An Endless run as a level (docs/v3-plan.md Phase 5, "Endless mode"): a
// fresh random map from the generator (more camps than a campaign level,
// most asleep at the start), then ENDLESS.maxWaves waves on one fixed ramp:
// more goblins, more camps rising and sending at once, more gear, balloons,
// and the new goblin types joining one at a time, with faster spawns. The
// times of day keep cycling (morning, day, sunset, night) with fog at night.
// The battle plays it like any level, with its own breathers (boost cards).
// No Three.js here.
import { ENDLESS, TIMES_OF_DAY } from '../config/game.js';
import { defaultSettings, type LevelSettings } from '../config/levelSettings.js';
import { createRandom } from '../rules/random.js';
import { generateLevel, LevelGenError, maxWaveGoblins } from './generate.js';
import type { Level, LevelWave } from './level.js';

const E = ENDLESS;

/** A value that starts at `from`, grows `per` each wave after the first, up to `max`. */
const ramp = (n: number, from: number, per: number, max: number): number => Math.min(max, from + per * (n - 1));

/** A new type's count in wave n: 0 before `from`, then 1, one more every `every` waves, up to max (times `step`). */
function special(n: number, s: { from: number; every: number; max: number; step?: number }): number {
  if (n < s.from) return 0;
  const step = s.step ?? 1;
  return Math.min(s.max, step * (1 + Math.floor((n - s.from) / s.every)));
}

/** The wave each camp rises in: the first startCamps from the start, then one more every riseEvery waves. */
export function endlessCampWaves(camps: number): number[] {
  return Array.from({ length: camps }, (_, i) => (i < E.startCamps ? 1 : 1 + (i - E.startCamps + 1) * E.riseEvery));
}

/** The run's waves, from the map's camps (in camp order) and the wave each rises in. */
export function endlessWaves(campIds: string[], campWaves: number[], seed: number): LevelWave[] {
  const rng = createRandom(seed * 7919 + 13);
  const waves: LevelWave[] = [];
  for (let n = 1; n <= E.maxWaves; n++) {
    const up = campIds.filter((_, i) => campWaves[i] <= n);
    const rising = n === 1 ? [] : campIds.filter((_, i) => campWaves[i] === n);
    // A camp that just rose always sends; the others in a seeded order, up to the camps at once.
    const atOnce = Math.min(E.campsAtOnce.max, E.campsAtOnce.first + Math.floor((n - 1) / E.campsAtOnce.every));
    const others = up.filter((id) => !rising.includes(id));
    for (let i = others.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      [others[i], others[j]] = [others[j], others[i]];
    }
    const camps = [...rising, ...others].slice(0, Math.max(rising.length, Math.min(atOnce, up.length)));
    const balloons = n < E.balloons.from ? 0 : Math.min(E.balloons.max, 1 + Math.floor((n - E.balloons.from) / E.balloons.every));
    const digger = special(n, E.specials.digger);
    const shaman = special(n, E.specials.shaman);
    const bomber = special(n, E.specials.bomber);
    const archer = special(n, E.specials.archer);
    // The walking goblins, capped so the wave (with its new types and balloons) stays in the unit budget.
    const want = Math.round(E.goblins.first * Math.pow(1 + E.goblins.growth, n - 1) + E.goblins.perWave * (n - 1));
    const total = Math.max(4, Math.min(want, maxWaveGoblins(balloons) - (digger + shaman + bomber + archer)));
    const runner = Math.round(total * ramp(n, E.runners.from, E.runners.perWave, E.runners.max));
    const hands = Math.max(1, E.gear.spear + E.gear.sword);
    waves.push({
      camps,
      rising,
      counts: { grunt: total - runner, runner, digger, shaman, bomber, archer },
      spawnTime: Math.round(Math.max(E.spawnTime.min, E.spawnTime.from - E.spawnTime.perWave * (n - 1))),
      balloons,
      gear: {
        spearShare: E.gear.spear / hands,
        swordShare: E.gear.sword / hands,
        helmetShare: ramp(n, E.gear.helmet[0], E.gear.helmet[1], E.gear.helmet[2]),
        shieldShare: ramp(n, E.gear.shield[0], E.gear.shield[1], E.gear.shield[2]),
      },
      time: TIMES_OF_DAY[(n - 1) % TIMES_OF_DAY.length],
    });
  }
  return waves;
}

/** The settings an Endless map is made from (the camps can be fewer, see makeEndlessLevel). */
export function endlessSettings(camps: number = E.map.camps): LevelSettings {
  return { ...defaultSettings(), ...E.map, camps };
}

/**
 * A new Endless run from a seed: the map (fewer camps are tried when no
 * seed passes the checks with more), its camps rising over the run, and the
 * ramp's waves. Throws LevelGenError only if even ENDLESS.minCamps fails.
 */
export function makeEndlessLevel(seed: number): Level {
  let error: unknown = null;
  for (let camps = E.map.camps; camps >= E.minCamps; camps--) {
    const settings = endlessSettings(camps);
    try {
      const { level } = generateLevel(seed, settings, 'endless');
      const campNodes = level.map.nodes.filter((n) => n.kind === 'camp');
      const campWaves = endlessCampWaves(campNodes.length);
      campNodes.forEach((node, i) => (node.wave = campWaves[i]));
      level.waves = endlessWaves(
        campNodes.map((c) => c.id),
        campWaves,
        level.meta.seed,
      );
      return level;
    } catch (e) {
      if (!(e instanceof LevelGenError)) throw e;
      error = e;
    }
  }
  throw error;
}
