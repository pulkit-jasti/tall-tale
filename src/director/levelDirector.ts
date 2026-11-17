// The wave director for a level (docs/custom-mode.md section 11, step 4).
// It plays a level's waves: the banner, the wave's rising camps come up, its
// groups come out of `camps` over `spawnTime` with its balloons and gear, it
// is fought until cleared, then the breather and the next wave. It reads the
// level's waves and only tells the systems what to do and when, through the
// same TutorialApi the battle already gives the tutorial (docs/map.md
// section 8). The tutorial keeps its own director (src/director/tutorial.ts).
// No Three.js here, so it can be tested.
import { NIGHT_FOG } from '../config/game.js';
import type { Level, LevelWave } from '../level/level.js';
import { timeOfWave } from '../rules/dayNight.js';
import type { TutorialApi, TutorialStep, WavePlan } from './tutorial.js';

/** The wave banner's text for a level wave: what comes, and from how many camps. */
export function waveIntro(wave: LevelWave, index: number, total: number): string {
  const camps = wave.camps.length;
  const from = camps === 1 ? 'one camp' : `${camps} camps`;
  const what = wave.counts.runner > wave.counts.grunt ? 'Runners are coming' : 'Goblins are coming';
  // v3 Phase 3: the banner names the new goblins in this wave (except diggers: they are a surprise).
  const named = [
    (wave.counts.shaman ?? 0) > 0 ? 'shamans' : '',
    (wave.counts.bomber ?? 0) > 0 ? 'bombers' : '',
    (wave.counts.archer ?? 0) > 0 ? 'archers' : '',
  ].filter(Boolean);
  const also = named.length === 0 ? '' : ` With ${named.length === 1 ? named[0] : `${named.slice(0, -1).join(', ')} and ${named[named.length - 1]}`}!`;
  const rise = wave.rising.length === 0 ? '' : wave.rising.length === 1 ? ' A new camp rises!' : ` ${wave.rising.length} new camps rise!`;
  const balloons = wave.balloons > 0 ? ' Watch the sky.' : '';
  if (index === total - 1) return `Final wave! ${what} from ${from}.${also}${rise}${balloons}`;
  return `${what} from ${from}.${also}${rise}${balloons}`;
}

/** A level's waves as the plans the wave spawner reads. */
export function levelWavePlans(level: Level): WavePlan[] {
  const total = level.waves.length;
  return level.waves.map((w, i) => ({
    intro: waveIntro(w, i, total),
    camps: [...w.camps],
    counts: {
      grunt: w.counts.grunt,
      runner: w.counts.runner,
      // v3 Phase 3: the new goblins (none in levels saved before them).
      digger: w.counts.digger ?? 0,
      shaman: w.counts.shaman ?? 0,
      bomber: w.counts.bomber ?? 0,
      archer: w.counts.archer ?? 0,
    },
    // v3 2.7: a foggy night wave sends its groups out more spread, so the short warning does not snowball.
    spawnTime: level.meta.settings.foggyNight && (w.time ?? timeOfWave(i, total)) === 'night' ? Math.round(w.spawnTime * NIGHT_FOG.spreadScale) : w.spawnTime,
    balloons: w.balloons,
    rising: [...w.rising],
    gear: { ...w.gear },
  }));
}

/**
 * The camps that rise at each wave (0 based). A plan's own `rising`, or
 * (the tutorial) the camps a wave sends from that no earlier wave sent
 * from. Wave 1's camps are there from the start.
 */
export function risingByWave(waves: WavePlan[]): string[][] {
  const seen = new Set<string>();
  return waves.map((w, i) => {
    const rising = w.rising ?? w.camps.filter((c) => !seen.has(c));
    for (const c of w.camps) seen.add(c);
    for (const c of rising) seen.add(c);
    return i === 0 && !w.rising ? [] : rising;
  });
}

/** The camps still under the ground when a battle starts at wave `from` (0 based): they rise at that wave or later. */
export function hiddenAtStart(waves: WavePlan[], from: number): string[] {
  return risingByWave(waves).flatMap((ids, i) => (i >= from ? ids : []));
}

/** What an Endless breather does (the game wires it to the boost card picker). */
export interface EndlessBreather {
  /** The breather after `cleared` waves starts: the cards (or the new tools) show. */
  start(cleared: number): void;
  /** True once a card was picked. */
  done(): boolean;
  /** The breather ends (picked, or out of time: no card): the picker goes. */
  end(): void;
}

/**
 * Endless mode (docs/v3-plan.md Phase 5): per wave, its banner ("Wave N",
 * it hides itself after bannerTime), fought until cleared, then the
 * breather: the boost cards, until one is picked or pickTime runs out, and
 * the next wave starts on its own. Same step ids as a level.
 */
export function buildEndlessSteps(waves: WavePlan[], breather: EndlessBreather, pickTime: number, bannerTime: number): TutorialStep[] {
  const steps: TutorialStep[] = [];
  waves.forEach((wave, i) => {
    steps.push({
      id: `wave-${i + 1}-start`,
      hint: { kind: 'banner', header: `Wave ${i + 1}`, text: wave.intro, icon: 'warning', next: true },
      start: (api: TutorialApi) => api.startWave(i),
      done: () => false,
      timeout: bannerTime,
    });
    steps.push({ id: `wave-${i + 1}-clear`, done: (api) => api.waveCleared(), timeout: Infinity });
    steps.push({
      id: `wave-${i + 1}-cleared`,
      start: (api: TutorialApi) => {
        api.clearWave();
        if (i < waves.length - 1) breather.start(i + 1);
      },
      done: () => i === waves.length - 1 || breather.done(),
      timeout: pickTime,
      end: () => breather.end(),
    });
  });
  return steps;
}

/**
 * The steps for a level: per wave, its banner (the wave starts with it,
 * Next is not needed: it plays at once), fought until cleared, then the
 * breather ("Next" for the next wave). After the last wave the win panel
 * takes over. Step ids match the tutorial's (`wave-N-start`, `-clear`,
 * `-cleared`), so the debug page's Skip wave works the same.
 */
export function buildLevelSteps(waves: WavePlan[]): TutorialStep[] {
  const steps: TutorialStep[] = [];
  const header = (i: number): string => `Wave ${i + 1} of ${waves.length}`;
  waves.forEach((wave, i) => {
    steps.push({
      id: `wave-${i + 1}-start`,
      hint: { kind: 'banner', header: header(i), text: wave.intro, icon: 'warning', next: true },
      start: (api: TutorialApi) => api.startWave(i),
      done: () => false,
      timeout: Infinity,
    });
    steps.push({ id: `wave-${i + 1}-clear`, done: (api) => api.waveCleared(), timeout: Infinity });
    const last = i === waves.length - 1;
    const clear = (api: TutorialApi): void => api.clearWave();
    if (last) steps.push({ id: `wave-${i + 1}-cleared`, start: clear, done: () => true, timeout: 0 });
    else {
      steps.push({
        id: `wave-${i + 1}-cleared`,
        hint: { kind: 'banner', header: `Wave ${i + 1} cleared!`, text: 'Well done! Next wave coming.', icon: 'star', next: true },
        start: clear,
        done: () => false,
        timeout: Infinity,
      });
    }
  });
  return steps;
}
