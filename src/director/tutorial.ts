// The tutorial director (docs/mvp.md "Tutorial director"): 5 waves, each
// introducing one new thing, taught by doing. Each lesson shows one short
// instruction on the hint sign and a marker on the thing to use, and waits
// until the player does it. New things are taught before their wave, so no
// enemies press the player while learning.
// The wave numbers and the step list live here together, so they are tuned
// side by side. Steps only call the game systems through TutorialApi. Nothing
// tutorial-only lives in those systems. No Three.js here, so it can be tested.
import { READING, type GoblinType } from '../config/game.js';
import type { DirectorStep } from '../rules/director.js';
import type { GhostDemoName } from '../ui/ghostDemos.js';

export type ToolName = 'slingshot' | 'swatter' | 'pepper' | 'megaphone';

export interface WavePlan {
  /** Shown on the wave banner when the wave starts. */
  intro: string;
  /** Camp ids from the blueprint that send enemies this wave. */
  camps: string[];
  counts: Record<GoblinType, number>;
  /** Groups come out over this long (seconds). The wave itself runs until it is cleared. */
  spawnTime: number;
  /** The tool that appears on its platform in the breather before this wave. */
  newTool?: ToolName;
}

/** Starting numbers from docs/mvp.md "Tutorial waves". Tuned in playtests. */
export const TUTORIAL_WAVES: WavePlan[] = [
  {
    intro: 'Goblins are coming! Grab and eat them before they break your wall.',
    camps: ['campNorth'],
    counts: { grunt: 6, runner: 0, climber: 3 },
    spawnTime: 50,
  },
  {
    intro: 'Two camps now. Shoot goblins far away before they reach the wall.',
    camps: ['campNorth', 'campEast'],
    counts: { grunt: 10, runner: 0, climber: 2 },
    spawnTime: 55,
    newTool: 'slingshot',
  },
  {
    intro: 'Runners! They are small and fast and rush straight to the wall.',
    camps: ['campNorth', 'campWest'],
    counts: { grunt: 8, runner: 12, climber: 3 },
    spawnTime: 60,
    newTool: 'swatter',
  },
  {
    intro: 'Three camps attack. Spin the board to keep watch all around you.',
    camps: ['campEast', 'campSouth', 'campWest'],
    counts: { grunt: 14, runner: 8, climber: 4 },
    spawnTime: 65,
    newTool: 'pepper',
  },
  {
    intro: 'The final wave. Everything at once!',
    camps: ['campNorth', 'campEast', 'campSouth'],
    counts: { grunt: 18, runner: 16, climber: 4 },
    spawnTime: 70,
  },
];

/** Step timing (seconds) and lesson goals. */
export const TUTORIAL_TIMING = {
  /** A lesson waits this long before its first fallback, then again for the second. */
  stuckAfter: 20,
  /** A lesson moves on after this long anyway, so it never gets stuck. */
  actionTimeout: 60,
  /** A wave that is not cleared after this long (after its lessons) ends anyway: leftovers run off. */
  clearTimeout: 90,
  /** Breather between waves. */
  breather: 8,
  /** Spinning the board this far (degrees) finishes the spin lesson. */
  spinGoal: 60,
  /** Moving the board this far (cm) finishes the height lesson. */
  heightGoal: 4,
  /** The lesson climber waits on the rampart this long instead of jumping in (seconds). */
  lessonClimberWait: 90,
};

/** What a marker points at. The battle turns it into a world position. */
export type MarkerTarget = 'ring' | 'lessonGoblin' | 'healthFlag' | 'waveFlag' | 'slingHandle' | 'bowl' | 'pouch';

export type HintIcon = 'hand' | 'gauntlet' | 'up' | 'target' | 'warning' | 'info' | 'star' | 'trophy';

export interface Hint {
  /** 'lesson' steps are numbered and ticked when done. 'banner' shows a wave title. */
  kind: 'lesson' | 'banner';
  /** Filled in by buildTutorialSteps: "Step 3 of 8" or "Wave 2 of 5". */
  header: string;
  text: string;
  icon?: HintIcon;
  marker?: MarkerTarget;
  /** Show how many goblins are left on the board. */
  goblinsLeft?: boolean;
  /** Shown instead when the lesson goblin is on the board, not in the hand (dropped it). */
  whenDropped?: string;
  /** A ghost hand loops this demonstration next to the target. */
  demo?: GhostDemoName;
  /** Info steps: a "Next" button on the sign skips them. */
  next?: boolean;
}

/** How long an info step stays up so it can be read (seconds). */
export function readTime(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(READING.min, READING.base + READING.perWord * words);
}

export interface TutorialStep extends DirectorStep<TutorialApi> {
  hint?: Hint;
}

/** What the tutorial steps can do and read. The game wires each one to a system. */
export interface TutorialApi {
  /** Starts a wave (0 based): camps rumble, then small groups walk in. */
  startWave(index: number): void;
  /** True when every enemy of the current wave came out and none is left. */
  waveCleared(): boolean;
  /** Ends the current wave now: no more spawns, leftovers run off with a poof. */
  endWave(): void;
  /** The wave flag climbs a notch and the castle is repaired a little (or the battle is won). */
  clearWave(): void;
  /** The lesson climber right in front of the player. `onRampart`: already up on the wall, in reach (the easier fallback). */
  lessonClimber(onRampart: boolean): void;
  /** A tool appears on its platform with a poof and glows until grabbed. */
  showTool(tool: ToolName): void;
  /** Glows the tool again, as a hint. */
  hintTool(tool: ToolName): void;
  /** The easier fallback for a tool, for example a pebble already in the slingshot pouch. */
  helpWithTool(tool: ToolName): void;
  /** How often the tool did its job (slingshot: goblins knocked out). */
  toolUses(tool: ToolName): number;
  /** Total board spin (degrees) and height change (cm) made by the player so far. */
  boardSpun(): number;
  boardMoved(): number;
  /** Goblins picked up and eaten in this battle. */
  picked(): number;
  eaten(): number;
  /** Slingshot steps done so far, and whether something is in the pouch. */
  slingCount(event: 'grabbed' | 'pebbleTaken' | 'loaded' | 'shot'): number;
  slingLoaded(): boolean;
  /** How long the player has looked at the current step's marker without looking away (seconds). */
  gazeTime(): number;
}

const lesson = (text: string, icon: HintIcon, marker?: MarkerTarget, extra: Partial<Hint> = {}): Hint => ({
  kind: 'lesson',
  header: '',
  text,
  icon,
  marker,
  ...extra,
});

const banner = (text: string, icon: HintIcon, marker?: MarkerTarget, extra: Partial<Hint> = {}): Hint => ({
  kind: 'banner',
  header: '',
  text,
  icon,
  marker,
  ...extra,
});

/** A lesson: waits for the player to do one thing. Counts are read when it starts. */
function lessonStep(
  id: string,
  hint: Hint,
  done: (api: TutorialApi, since: number) => boolean,
  count: (api: TutorialApi) => number,
  options: Partial<TutorialStep> = {},
): TutorialStep {
  let since = 0;
  return {
    id,
    hint,
    timeout: TUTORIAL_TIMING.actionTimeout,
    stuckAfter: TUTORIAL_TIMING.stuckAfter,
    ...options,
    start: (api) => {
      since = count(api);
      options.start?.(api);
    },
    done: (api) => done(api, since),
  };
}

/** A banner or info step that stays up long enough to read. "Next" skips it. */
function readStep(id: string, hint: Hint, start?: (api: TutorialApi) => void): TutorialStep {
  const seconds = readTime(hint.text);
  return { id, hint: { ...hint, next: true }, start, done: (_api, time) => time >= seconds, timeout: seconds };
}

/**
 * An info step that waits for the player to look at its marker for a moment,
 * after the reading time. "Next" skips it, and it moves on anyway after a while.
 */
function lookStep(id: string, hint: Hint): TutorialStep {
  const seconds = readTime(hint.text);
  return {
    id,
    hint: { ...hint, next: true },
    done: (api, time) => time >= seconds && api.gazeTime() >= READING.gazeHold,
    timeout: seconds + READING.gazeGrace,
  };
}

/** Before wave 1: moving the board, then picking up and eating the lesson climber. */
function introLessons(): TutorialStep[] {
  // Eating counts from the pinch lesson on, so a goblin eaten straight away finishes both.
  let eatenBefore = 0;
  return [
    lessonStep(
      'learn-spin',
      lesson('Grab the ring in front of you and pull it sideways to spin the board.', 'hand', 'ring', { demo: 'spin' }),
      (api, since) => api.boardSpun() - since >= TUTORIAL_TIMING.spinGoal,
      (api) => api.boardSpun(),
      { timeout: 45 },
    ),
    lessonStep(
      'learn-height',
      lesson('Now pull the ring up or down to set the board to a comfy height.', 'up', 'ring', { demo: 'height' }),
      (api, since) => api.boardMoved() - since >= TUTORIAL_TIMING.heightGoal,
      (api) => api.boardMoved(),
      { timeout: 40 },
    ),
    lessonStep(
      'learn-pinch',
      lesson('A goblin climbed your wall! Pinch it with your thumb and finger to pick it up.', 'hand', 'lessonGoblin', {
        demo: 'pinchGoblin',
      }),
      (api, since) => api.picked() + api.eaten() > since,
      (api) => api.picked() + api.eaten(),
      {
        start: (api) => {
          eatenBefore = api.eaten();
          api.lessonClimber(false);
        },
        fallbacks: [(api) => api.lessonClimber(false), (api) => api.lessonClimber(true)],
      },
    ),
    lessonStep(
      'learn-eat',
      lesson('Bring it to your mouth and hold it there for a moment to eat it.', 'target', 'lessonGoblin', {
        whenDropped: 'Dropped it? Pinch it again and bring it to your mouth.',
        demo: 'eat',
      }),
      (api) => api.eaten() > eatenBefore,
      () => 0,
      { fallbacks: [(api) => api.lessonClimber(true)], timeout: 45 },
    ),
  ];
}

/** Before wave 2: picking up and loading the slingshot. Shooting is taught once goblins come. */
function slingshotLessons(): TutorialStep[] {
  return [
    lessonStep(
      'learn-sling-grab',
      lesson('Grab the slingshot by its handle with either hand.', 'gauntlet', 'slingHandle', { demo: 'slingGrab' }),
      (api, since) => api.slingCount('grabbed') > since,
      (api) => api.slingCount('grabbed'),
      { fallbacks: [(api) => api.hintTool('slingshot')], timeout: 45 },
    ),
    lessonStep(
      'learn-sling-pebble',
      lesson('Pinch a pebble from the bowl with your other hand.', 'hand', 'bowl', { demo: 'pebble' }),
      (api, since) => api.slingCount('pebbleTaken') > since || api.slingLoaded(),
      (api) => api.slingCount('pebbleTaken'),
      { fallbacks: [(api) => api.helpWithTool('slingshot')], timeout: 45 },
    ),
    lessonStep(
      'learn-sling-load',
      lesson('Bring the pebble to the pouch. It clicks in.', 'hand', 'pouch', { demo: 'load' }),
      (api) => api.slingLoaded(),
      () => 0,
      { fallbacks: [(api) => api.helpWithTool('slingshot')], timeout: 40 },
    ),
  ];
}

function shootLesson(): TutorialStep {
  return lessonStep(
    'learn-sling-shoot',
    lesson('Pinch the pouch, pull it back and let go to shoot a goblin. The dots show where it lands.', 'target', 'pouch', {
      demo: 'shoot',
    }),
    (api, since) => api.toolUses('slingshot') > since,
    (api) => api.toolUses('slingshot'),
    {
      fallbacks: [(api) => api.helpWithTool('slingshot'), (api) => api.helpWithTool('slingshot')],
      slowSpawns: true,
    },
  );
}

/** Lessons for the tools of build steps 4 and 5, added once those tools exist. */
const TOOL_LESSON_TEXT: Partial<Record<ToolName, string>> = {
  swatter: 'Grab the fly swatter and swat the goblins at the wall.',
  pepper: 'Grab the pepper shaker and shake it over a group of goblins.',
  megaphone: 'Scream into the megaphone, or shake the bell, to stun every goblin.',
};

function toolLesson(tool: ToolName): TutorialStep {
  return lessonStep(
    `learn-${tool}`,
    lesson(TOOL_LESSON_TEXT[tool] ?? `Try the ${tool}.`, 'gauntlet'),
    (api, since) => api.toolUses(tool) > since,
    (api) => api.toolUses(tool),
    { fallbacks: [(api) => api.hintTool(tool), (api) => api.helpWithTool(tool)], slowSpawns: true },
  );
}

const TOOL_NAMES: Record<ToolName, string> = {
  slingshot: 'the slingshot',
  swatter: 'the fly swatter',
  pepper: 'the pepper shaker',
  megaphone: 'the megaphone and the bell',
};

/**
 * The full step list. `tools` lists the tools that are built: lessons for the
 * others are left out. Built fresh for each battle, since steps remember counts.
 */
export function buildTutorialSteps(tools: ToolName[], waves: WavePlan[] = TUTORIAL_WAVES): TutorialStep[] {
  const has = (tool?: ToolName): tool is ToolName => !!tool && tools.includes(tool);
  const steps: TutorialStep[] = [];
  const waveTitle = (i: number): string => `Wave ${i + 1} of ${waves.length}`;
  waves.forEach((wave, i) => {
    if (i === 0) steps.push(...introLessons());
    if (wave.newTool === 'slingshot' && has('slingshot')) steps.push(...slingshotLessons());
    steps.push(readStep(`wave-${i + 1}-start`, banner(wave.intro, 'warning'), (api) => api.startWave(i)));
    if (i === 0) {
      steps.push(lookStep('flag-health', banner('Look at the red flag on your left. It is your castle health. Goblins at the wall pull it down.', 'info', 'healthFlag')));
      steps.push(lookStep('flag-wave', banner('Now look at the blue flag on your right. It climbs one notch for every wave you clear.', 'info', 'waveFlag')));
    }
    if (wave.newTool === 'slingshot' && has('slingshot')) steps.push(shootLesson());
    else if (has(wave.newTool)) steps.push(toolLesson(wave.newTool));
    if (wave.newTool === 'pepper' && has('megaphone')) steps.push(toolLesson('megaphone'));
    steps.push({
      id: `wave-${i + 1}-clear`,
      hint: banner(
        i === 0
          ? 'Clear the wave! Grab and eat the goblins at the wall and on top of it.'
          : 'Clear the wave! Eat goblins at the wall, shoot the ones far away.',
        'warning',
        undefined,
        { goblinsLeft: true },
      ),
      done: (api) => api.waveCleared(),
      timeout: TUTORIAL_TIMING.clearTimeout,
      onTimeout: (api) => api.endWave(),
    });
    steps.push(breatherStep(i, waves, has));
  });
  // Number the lessons and title the banners.
  const lessons = steps.filter((s) => s.hint?.kind === 'lesson');
  let wave = 0;
  for (const step of steps) {
    if (!step.hint) continue;
    if (step.id.startsWith('wave-') && step.id.endsWith('-start')) wave = Number(step.id.split('-')[1]) - 1;
    if (step.hint.kind === 'lesson') step.hint.header = `Step ${lessons.indexOf(step) + 1} of ${lessons.length}`;
    else if (!step.hint.header) step.hint.header = waveTitle(wave);
  }
  return steps;
}

/**
 * The wave is over: the flag climbs. Between waves, the next wave's new tool
 * appears during the breather. After the last wave the battle is won (the
 * win panel takes over, so there is no hint).
 */
function breatherStep(i: number, waves: WavePlan[], has: (tool?: ToolName) => tool is ToolName): TutorialStep {
  const last = i === waves.length - 1;
  const next = waves[i + 1];
  const tool = has(next?.newTool) ? next.newTool : undefined;
  return {
    id: `wave-${i + 1}-cleared`,
    hint: last
      ? undefined
      : banner(
          tool ? `New tool: ${TOOL_NAMES[tool]}! It is on the platform beside you.` : 'Well done! Get ready for the next wave.',
          'star',
          tool === 'slingshot' ? 'slingHandle' : undefined,
          { header: `Wave ${i + 1} cleared!` },
        ),
    start: (api) => {
      api.clearWave();
      if (tool) api.showTool(tool);
      // The megaphone shares its platform with the bell and comes with the pepper (wave 4).
      if (tool === 'pepper' && has('megaphone')) api.showTool('megaphone');
    },
    done: (_api, time) => last || time >= TUTORIAL_TIMING.breather,
    timeout: TUTORIAL_TIMING.breather,
  };
}
