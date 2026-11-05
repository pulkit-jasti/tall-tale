// The tutorial director (docs/mvp.md "Tutorial director"): 5 waves, each
// introducing one new thing, taught by doing. Each lesson shows one short
// instruction on the hint sign and a marker on the thing to use, and waits
// until the player does it. New things are taught before their wave, so no
// enemies press the player while learning.
// The wave numbers and the step list live here together, so they are tuned
// side by side. Steps only call the game systems through TutorialApi. Nothing
// tutorial-only lives in those systems. No Three.js here, so it can be tested.
import { TOOLS, type GoblinType } from '../config/game.js';
import type { TriggerKind } from '../rules/blueprint.js';
import type { DirectorStep } from '../rules/director.js';
import type { GhostDemoName } from '../ui/ghostDemos.js';

/**
 * 'megaphone' is the stun tool: the megaphone when the mic is on, the bell
 * when it is not. Only one of them is ever out (the game picks it).
 */
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

/**
 * The tutorial waves from docs/mvp.md "Tutorial waves", balanced with the
 * troops in build step 5 (step 3 and 4 used small test waves). Enemies come
 * out in small groups over `spawnTime`, so the board stays in the unit budget.
 */
export const TUTORIAL_WAVES: WavePlan[] = [
  {
    intro: 'Goblins are coming! Your soldiers march out to fight them. Help them: grab and eat goblins before they break your wall.',
    camps: ['campNorth'],
    counts: { grunt: 6, runner: 0, climber: 3 },
    spawnTime: 40,
  },
  {
    intro: 'Two camps now. Shoot goblins far away before they reach the wall.',
    camps: ['campNorth', 'campEast'],
    counts: { grunt: 10, runner: 0, climber: 2 },
    spawnTime: 50,
    newTool: 'slingshot',
  },
  {
    intro: 'Runners! They are small and fast and rush straight to the wall.',
    camps: ['campNorth', 'campWest'],
    counts: { grunt: 8, runner: 12, climber: 3 },
    spawnTime: 55,
    newTool: 'swatter',
  },
  {
    intro: 'Three camps attack. Spin the board to keep watch all around you.',
    camps: ['campEast', 'campSouth', 'campWest'],
    counts: { grunt: 14, runner: 8, climber: 4 },
    spawnTime: 60,
    newTool: 'pepper',
  },
  {
    intro: 'The final wave. Everything at once! Shoot the barrels, boulders and trees on the roads.',
    camps: ['campNorth', 'campEast', 'campSouth'],
    counts: { grunt: 18, runner: 16, climber: 4 },
    spawnTime: 70,
    // One new tool per wave: the megaphone (or the bell without a mic) has its own breather.
    newTool: 'megaphone',
  },
];

/** Step timing (seconds) and lesson goals. */
export const TUTORIAL_TIMING = {
  /** A lesson waits this long before its first fallback, then again for the second. */
  stuckAfter: 20,
  /** A lesson moves on after this long anyway, so it never gets stuck. */
  actionTimeout: 60,
  /**
   * Food tool use lessons wait longer: the goblins first have to walk to the
   * wall. While one runs, the tool's use timer is held, so a tool paid for
   * early never runs out before the goblins come.
   */
  toolUseTimeout: 120,
  /** The reach check gives up after this long without a stretched arm (no hands in the browser). */
  reachTimeout: 40,
  /** Spinning the board this far (degrees) finishes the spin lesson. */
  spinGoal: 60,
  /** Moving the board this far (cm) finishes the height lesson. */
  heightGoal: 4,
  /** The lesson climber waits on the rampart this long instead of jumping in (seconds). */
  lessonClimberWait: 90,
  /**
   * The trigger lessons: the goblins wait for the shot, so the player can
   * take their time. After triggerStuckAfter the marker pulses (and missing
   * goblins are replaced), and it only moves on by itself after the long
   * triggerTimeout, so it never gets stuck.
   */
  triggerStuckAfter: 25,
  triggerTimeout: 240,
  /** The pause lesson moves on after this long anyway (no hands in the browser). */
  pauseTimeout: 45,
};

/** What a marker points at. The battle turns it into a world position. */
export type MarkerTarget =
  | 'ring'
  | 'lessonGoblin'
  | 'healthFlag'
  | 'waveFlag'
  | 'foodJar'
  | 'slingHandle'
  | 'bowl'
  | 'pouch'
  | 'swatterHandle'
  | 'pepperHandle'
  /** The stun tool that is out: the megaphone, or the bell without a mic. */
  | 'stunTool'
  | 'megaphoneHandle'
  | 'bellHandle'
  /** The keg, boulder or tree of the current trigger lesson. */
  | 'lessonTrigger'
  /** The pause button on the left palm, while it is out. */
  | 'wristButton';

export type HintIcon = 'pinch' | 'grab' | 'spin' | 'up' | 'target' | 'warning' | 'info' | 'star' | 'trophy';

export interface Hint {
  /** 'lesson' steps are numbered and ticked when done. 'banner' shows a wave title. */
  kind: 'lesson' | 'banner';
  /** Filled in by buildTutorialSteps: "Step 3 of 8" or "Wave 2 of 5". */
  header: string;
  text: string;
  icon?: HintIcon;
  marker?: MarkerTarget;
  /** Ghost aim dots: a see-through arc from the slingshot's pouch to the marker's target (the first trigger lesson). */
  aimDots?: boolean;
  /** Shown instead while the pause button is out on the palm (the pause lesson). */
  whenWrist?: string;
  /** Shown instead when the lesson goblin is on the board, not in the hand (dropped it). */
  whenDropped?: string;
  /** The food tool this lesson is about, and the text shown instead while it cannot be paid for. */
  tool?: ToolName;
  whenLocked?: string;
  /** Shown instead when there is no mic: the bell is out in place of the megaphone. */
  whenNoMic?: string;
  /** The ghost hand demo instead when there is no mic. */
  demoNoMic?: GhostDemoName;
  /** A ghost hand loops this demonstration next to the target. */
  demo?: GhostDemoName;
  /** Info steps: they wait for the "Next" button on the sign. */
  next?: boolean;
  /** The reach check: the sign shows its countdown while the arm is out. */
  reachCheck?: boolean;
  /** Shown instead of the instruction on the ticked sign when the lesson is done. */
  doneText?: string;
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
  /** Holds a food tool's use timer while its use lesson runs (on), or lets it run again (off). */
  holdToolTimer(tool: ToolName, on: boolean): void;
  /** Starts the reach check: waits for a stretched arm, then counts down. */
  startReachCheck(): void;
  /** True once the reach check is done and the board is sized to the player. */
  reachChecked(): boolean;
  /** The reach check gave up (no hands): the board keeps its size. */
  stopReachCheck(): void;
  /** How often the tool did its job since it appeared (slingshot: goblins knocked out, swatter: swatted, pepper: peppered). */
  toolUses(tool: ToolName): number;
  /** How often the tool was grabbed since it appeared. */
  toolGrabbed(tool: ToolName): number;
  /** True if the tool can be used now: paid for already, or enough food in the jar. */
  canAfford(tool: ToolName): boolean;
  /** Total board spin (degrees) and height change (cm) made by the player so far. */
  boardSpun(): number;
  boardMoved(): number;
  /** Goblins picked up and eaten in this battle. */
  picked(): number;
  eaten(): number;
  /** Slingshot steps done since it appeared, and whether something is in the pouch. */
  slingCount(event: 'grabbed' | 'pebbleTaken' | 'loaded' | 'shot'): number;
  slingLoaded(): boolean;
  /**
   * A trigger lesson: brings that kind onto the roads (if it is not there
   * yet), picks the one nearest the front, and sends a small group of goblins
   * to wait right in what it does until the player sets it off.
   */
  startTriggerLesson(kind: TriggerKind): void;
  /** Tops the waiting group up again if goblins went missing (the fallback), with a pulse of the marker. */
  sendPastTrigger(): void;
  /** The trigger lesson is over: the goblins still waiting walk on. */
  endTriggerLesson(): void;
  /** How many triggers of a kind were set off in this battle. */
  triggersSetOff(kind: TriggerKind): number;
  /** How often the player paused (and came back) in this battle. */
  pausedCount(): number;
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

/**
 * An info step (a wave banner, the flags, a new tool): it stays up until the
 * player pokes "Next". Nothing moves it on by itself, not time and not where
 * the player looks, so there is always time to notice and read it. Only
 * lessons, where the player does something with their hands, move on by
 * themselves.
 */
function infoStep(id: string, hint: Hint, start?: (api: TutorialApi) => void): TutorialStep {
  return { id, hint: { ...hint, next: true }, start, done: () => false, timeout: Infinity };
}

/**
 * The very first step, once per player: the reach check sizes the board to
 * their arms. A ghost hand shows the pose (arm straight out, hand flat, thumb
 * up, fingers spread: the hand's side toward the eyes, never the palm), the
 * sign counts down while the arm is out, and says when to rest. Without
 * tracked hands it gives up after a while and the board keeps its size.
 */
function reachStep(): TutorialStep {
  return {
    id: 'reach-check',
    hint: lesson(
      'Show me how big you are, giant! Sit back and stretch one arm straight out: hand flat, thumb up, fingers spread.',
      'target',
      undefined,
      { demo: 'reach', reachCheck: true, doneText: 'Done! You can rest your arm now.' },
    ),
    start: (api) => api.startReachCheck(),
    done: (api) => api.reachChecked(),
    onTimeout: (api) => api.stopReachCheck(),
    timeout: TUTORIAL_TIMING.reachTimeout,
  };
}

/** Before wave 1: moving the board, then picking up and eating the lesson climber. */
function introLessons(): TutorialStep[] {
  // Eating counts from the pinch lesson on, so a goblin eaten straight away finishes both.
  let eatenBefore = 0;
  return [
    // How to pause comes first, so a player who pauses by accident later knows the way back.
    lessonStep(
      'learn-pause',
      lesson('You can pause any time: turn your left palm toward your face, like this.', 'info', 'wristButton', {
        demo: 'pauseShow',
        whenWrist: 'There is the pause button! Poke it with your right finger, then poke Resume.',
        doneText: 'Now you know how to pause!',
      }),
      (api, since) => api.pausedCount() > since,
      (api) => api.pausedCount(),
      { timeout: TUTORIAL_TIMING.pauseTimeout },
    ),
    lessonStep(
      'learn-spin',
      lesson('Grab the ring in front of you and pull it sideways to spin the board.', 'spin', 'ring', { demo: 'spin' }),
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
      lesson('A goblin climbed your wall! Pinch it with your thumb and finger to pick it up.', 'pinch', 'lessonGoblin', {
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

/**
 * Before wave 2: picking up and loading the slingshot. Shooting is taught once
 * goblins come. The slingshot appears with its first lesson and can be used
 * right away, so these lessons count from that moment, not from when each
 * lesson starts: what the player already did counts, and they are never
 * asked to do it again.
 */
const fromToolShown = (): number => 0;

function slingshotLessons(): TutorialStep[] {
  return [
    lessonStep(
      'learn-sling-grab',
      lesson('Wave cleared! Here is a new tool: the slingshot. Grab it by its handle with either hand.', 'grab', 'slingHandle', {
        demo: 'slingGrab',
      }),
      (api, since) => api.slingCount('grabbed') > since,
      fromToolShown,
      { start: (api) => api.showTool('slingshot'), fallbacks: [(api) => api.hintTool('slingshot')], timeout: 45 },
    ),
    lessonStep(
      'learn-sling-pebble',
      lesson('Pinch a pebble from the bowl with your other hand.', 'pinch', 'bowl', { demo: 'pebble' }),
      (api, since) => api.slingCount('pebbleTaken') > since || api.slingLoaded(),
      fromToolShown,
      { fallbacks: [(api) => api.helpWithTool('slingshot')], timeout: 45 },
    ),
    lessonStep(
      'learn-sling-load',
      lesson('Bring the pebble to the pouch. It clicks in.', 'pinch', 'pouch', { demo: 'load' }),
      (api) => api.slingLoaded(),
      () => 0,
      { fallbacks: [(api) => api.helpWithTool('slingshot')], timeout: 40 },
    ),
  ];
}

function shootLesson(): TutorialStep {
  return lessonStep(
    'learn-sling-shoot',
    lesson('Goblins are coming! Pinch the pouch, pull it back and let go to shoot. The dots show where it lands.', 'target', 'pouch', {
      demo: 'shoot',
    }),
    // Any shot finishes it, hit or miss: the player has learned how it works.
    // A shot already made since the slingshot appeared counts too.
    (api, since) => api.slingCount('shot') > since,
    fromToolShown,
    {
      fallbacks: [(api) => api.helpWithTool('slingshot'), (api) => api.helpWithTool('slingshot')],
      slowSpawns: true,
    },
  );
}

/**
 * In wave 2, right after the shoot lesson: the triggers, which are all set
 * off with the slingshot. One lesson per kind, keg first, then the boulder,
 * then the tree. Each one brings its kind onto the roads, holds the wave's
 * spawns, and sends a small group of goblins to the one nearest the front,
 * where they wait right in what it does (beside the keg, below the boulder,
 * before the tree) until the player sets it off. So the player can take
 * their time and try as often as they need. Each text says what it does:
 * the keg and the boulder knock goblins out, the tree only blocks the road.
 * Ghost aim dots arc from the pouch to it in every one. Only the first (the
 * keg) also shows the ghost hand: the others are shot the same way.
 */
function triggerLessons(): TutorialStep[] {
  const again = (api: TutorialApi): void => api.sendPastTrigger();
  const kinds: { kind: TriggerKind; text: string; extra: Partial<Hint> }[] = [
    {
      kind: 'keg',
      text: 'See the red barrel? Shoot it: it blows up and knocks out the goblins next to it. The dots show the way.',
      extra: { demo: 'aimKeg' },
    },
    { kind: 'boulder', text: 'See the boulder with the red stripe? Shoot it: it rolls down the road and squashes the goblins below.', extra: {} },
    {
      kind: 'tree',
      text: 'See the orange tree with the red band? Shoot it: it falls across the road and blocks it. Goblins must turn back.',
      extra: {},
    },
  ];
  return kinds.map(({ kind, text, extra }) =>
    lessonStep(
      `learn-${kind}`,
      lesson(text, 'target', 'lessonTrigger', { aimDots: true, ...extra }),
      (api, since) => api.triggersSetOff(kind) > since,
      (api) => api.triggersSetOff(kind),
      {
        start: (api) => api.startTriggerLesson(kind),
        end: (api) => api.endTriggerLesson(),
        fallbacks: [again, again],
        stuckAfter: TUTORIAL_TIMING.triggerStuckAfter,
        timeout: TUTORIAL_TIMING.triggerTimeout,
        holdSpawns: true,
      },
    ),
  );
}

type FoodTool = Exclude<ToolName, 'slingshot'>;

const cost = (tool: FoodTool): number => TOOLS.cost[tool];
const seconds = (tool: FoodTool): number => TOOLS.duration[tool];
/** Tools cost nothing in the tutorial (TOOLS.freeInTutorial), so the texts do not ask for food. */
const free = TOOLS.freeInTutorial;

/** Each food tool: where its handle is, the ghost hand demo for grabbing it, and its use lesson. */
interface FoodToolLesson {
  marker?: MarkerTarget;
  grabDemo?: GhostDemoName;
  useDemo?: GhostDemoName;
  use: string;
  locked: string;
  /** The bell in place of the megaphone (no mic): its texts and demos. */
  noMic?: { name: string; use: string; grabDemo: GhostDemoName; useDemo: GhostDemoName };
}

const FOOD_TOOL_LESSONS: Record<FoodTool, FoodToolLesson> = {
  swatter: {
    marker: 'swatterHandle',
    grabDemo: 'swatterGrab',
    use: free
      ? 'Runners! Swat a goblin with it, anywhere. Slap it down so the swatter touches the goblin.'
      : `Runners! Swat a goblin with it, anywhere. The first swat takes ${cost('swatter')} food from your jar, then swatting is free for ${seconds('swatter')} seconds.`,
    locked: `Not enough food for the swatter (${cost('swatter')}). Eat a goblin to fill your jar.`,
  },
  pepper: {
    marker: 'pepperHandle',
    grabDemo: 'pepperGrab',
    use: free
      ? 'Shake pepper over goblins. Peppered goblins give double food when eaten.'
      : `Shake pepper over goblins. Peppered goblins give double food when eaten. The first shake takes ${cost('pepper')} food.`,
    locked: `Not enough food for the pepper (${cost('pepper')}). Eat a goblin to fill your jar.`,
  },
  megaphone: {
    marker: 'stunTool',
    grabDemo: 'megaphoneGrab',
    useDemo: 'megaphoneShout',
    // The loudness bar and its red dot are what make the scream work, so this one text explains them too.
    use: 'The final wave! Hold the megaphone near your mouth and shout. Fill the bar on top up to the red dot to stun every goblin.',
    locked: `Not enough food for it (${cost('megaphone')}). Eat a goblin to fill your jar.`,
    noMic: {
      name: 'the bell',
      use: 'The final wave! Shake the bell hard. Every goblin stops, dizzy, for a few seconds.',
      grabDemo: 'bellGrab',
      useDemo: 'bellRing',
    },
  },
};

/**
 * Before the first food tool: what the food jar is and how to fill it, by
 * doing. First the jar is shown (Next), then a climber pops up to eat, and
 * its food drops into the jar. The tool's price tag comes right after.
 */
function foodLessons(): TutorialStep[] {
  return [
    infoStep(
      'food-jar',
      banner('Wave cleared! This jar on your left holds your food. Every goblin you eat drops food into it.', 'info', 'foodJar', {
        header: 'Your food',
      }),
    ),
    lessonStep(
      'learn-food',
      lesson('A goblin climbed up! Eat it and watch your food jar fill up.', 'pinch', 'lessonGoblin', {
        whenDropped: 'Dropped it? Pinch it again and bring it to your mouth.',
        demo: 'pinchGoblin',
      }),
      (api, since) => api.eaten() > since,
      (api) => api.eaten(),
      {
        start: (api) => api.lessonClimber(false),
        fallbacks: [(api) => api.lessonClimber(false), (api) => api.lessonClimber(true)],
        timeout: 45,
      },
    ),
  ];
}

/**
 * In the breather before its wave: the new food tool appears and the player
 * grabs it. Grabbing is free, so it is never locked. The text points at its
 * price tag, so the player links food and tools (free while learning).
 */
function toolGrabLesson(tool: FoodTool, afterFood: boolean): TutorialStep {
  const { marker, grabDemo, noMic } = FOOD_TOOL_LESSONS[tool];
  const intro = afterFood ? 'Tools cost food, but they are free while you learn.' : 'Wave cleared!';
  const price = free ? 'its price tag says Free for now' : `its price tag says ${cost(tool)} food`;
  const say = (name: string): string => `${intro} Here is ${name}: ${price}. Grab it with your fist.`;
  return lessonStep(
    `learn-${tool}-grab`,
    lesson(say(TOOL_NAMES[tool]), 'grab', marker, {
      demo: grabDemo,
      whenNoMic: noMic && say(noMic.name),
      demoNoMic: noMic?.grabDemo,
    }),
    (api, since) => api.toolGrabbed(tool) > since,
    // Counts from when the tool appeared, like the slingshot lessons.
    fromToolShown,
    {
      start: (api) => api.showTool(tool),
      fallbacks: [(api) => api.hintTool(tool)],
      timeout: 45,
    },
  );
}

/**
 * In its wave: use the food tool on one goblin, anywhere. Done as soon as
 * one goblin is hit. While it runs, the tool's use timer is held: a player
 * who pays with an early swat before the goblins come keeps the tool until
 * they do. Without enough food the sign says so and a climber pops up in
 * front to eat. The easier fallback tops up the jar or brings a goblin in
 * reach. A wave cleared another way also ends it, so it never waits forever.
 */
function toolLesson(tool: FoodTool): TutorialStep {
  const text = FOOD_TOOL_LESSONS[tool];
  return lessonStep(
    `learn-${tool}`,
    lesson(text.use, 'target', text.useDemo ? text.marker : undefined, {
      tool,
      whenLocked: text.locked,
      demo: text.useDemo,
      whenNoMic: text.noMic?.use,
      demoNoMic: text.noMic?.useDemo,
    }),
    (api, since) => api.toolUses(tool) > since || api.waveCleared(),
    fromToolShown,
    {
      start: (api) => {
        api.holdToolTimer(tool, true);
        if (!api.canAfford(tool)) api.lessonClimber(true);
      },
      end: (api) => api.holdToolTimer(tool, false),
      fallbacks: [(api) => api.hintTool(tool), (api) => api.helpWithTool(tool)],
      timeout: TUTORIAL_TIMING.toolUseTimeout,
      slowSpawns: true,
    },
  );
}

const TOOL_NAMES: Record<ToolName, string> = {
  slingshot: 'the slingshot',
  swatter: 'the fly swatter',
  pepper: 'the pepper shaker',
  megaphone: 'the megaphone',
};

/**
 * The full step list. `tools` lists the tools that are built: lessons for the
 * others are left out. Built fresh for each battle, since steps remember counts.
 *
 * `fromWave` (0 based, debug "Start at wave") leaves out everything before
 * that wave: the list starts at the end of the wave before it, so its
 * breather and the new tool's lessons still run. The battle shows the tools
 * of the waves left out.
 *
 * `measureReach` puts the reach check first (also before a later start wave),
 * for a player whose reach is not known yet.
 */
export function buildTutorialSteps(
  tools: ToolName[],
  waves: WavePlan[] = TUTORIAL_WAVES,
  fromWave = 0,
  measureReach = false,
): TutorialStep[] {
  const has = (tool?: ToolName): tool is ToolName => !!tool && tools.includes(tool);
  const steps: TutorialStep[] = [];
  const waveTitle = (i: number): string => `Wave ${i + 1} of ${waves.length}`;
  // The food jar is taught right before the first food tool, where food starts to matter.
  let foodTaught = false;
  waves.forEach((wave, i) => {
    if (i === 0) steps.push(...introLessons());
    if (wave.newTool === 'slingshot' && has('slingshot')) steps.push(...slingshotLessons());
    else if (has(wave.newTool) && wave.newTool !== 'slingshot') {
      const afterFood = !foodTaught;
      if (afterFood) steps.push(...foodLessons());
      foodTaught = true;
      steps.push(toolGrabLesson(wave.newTool, afterFood));
    }
    // The two flags are explained before the first wave, while nothing attacks yet.
    if (i === 0) {
      const header = 'Your castle';
      steps.push(infoStep('flag-health', banner('Look at the red flag on your left. It is your castle health. Goblins at the wall pull it down.', 'info', 'healthFlag', { header })));
      steps.push(infoStep('flag-wave', banner('Now look at the blue flag on your right. It climbs one notch for every wave you clear.', 'info', 'waveFlag', { header })));
    }
    // A wave whose new tool has a lesson starts straight into that lesson: the
    // lesson's own text guides the player, and it moves on by their action, so
    // there is no banner and no Next button in between.
    const lessonFollows = has(wave.newTool);
    const startWave = (api: TutorialApi): void => api.startWave(i);
    if (lessonFollows) steps.push({ id: `wave-${i + 1}-start`, start: startWave, done: () => true, timeout: 0 });
    else steps.push(infoStep(`wave-${i + 1}-start`, banner(wave.intro, 'warning'), startWave));
    if (wave.newTool === 'slingshot' && has('slingshot')) steps.push(shootLesson(), ...triggerLessons());
    else if (has(wave.newTool) && wave.newTool !== 'slingshot') steps.push(toolLesson(wave.newTool));
    // While the wave is fought the sign stays away, so it never covers the enemies.
    // It comes back when the wave is cleared (the breather) or for a lesson.
    steps.push({
      id: `wave-${i + 1}-clear`,
      // No timer: a wave ends only when it is cleared, or the castle falls. A
      // player who ignores it loses. The battle ends a stalemate on its own
      // (see Battle.update), so this never waits forever.
      done: (api) => api.waveCleared(),
      timeout: Infinity,
    });
    steps.push(breatherStep(i, waves, has));
  });
  const first = Math.min(fromWave, waves.length - 1);
  if (first > 0) steps.splice(0, steps.findIndex((s) => s.id === `wave-${first}-cleared`));
  if (measureReach) steps.unshift(reachStep());
  // Number the lessons and title the banners.
  const lessons = steps.filter((s) => s.hint?.kind === 'lesson');
  let wave = 0;
  for (const step of steps) {
    if (step.id.startsWith('wave-') && step.id.endsWith('-start')) wave = Number(step.id.split('-')[1]) - 1;
    if (!step.hint) continue;
    if (step.hint.kind === 'lesson') step.hint.header = `Step ${lessons.indexOf(step) + 1} of ${lessons.length}`;
    else if (!step.hint.header) step.hint.header = waveTitle(wave);
  }
  return steps;
}

/**
 * The wave is over: the flag climbs. Between waves without a new tool, the
 * breather is an info step: it waits for "Next". Before a new tool, the
 * tool's lessons take over (the tool appears with its first lesson). After
 * the last wave the battle is won (the win panel takes over, so there is no
 * hint).
 */
function breatherStep(i: number, waves: WavePlan[], has: (tool?: ToolName) => tool is ToolName): TutorialStep {
  const last = i === waves.length - 1;
  const next = waves[i + 1];
  const tool = has(next?.newTool) ? next.newTool : undefined;
  const start = (api: TutorialApi): void => api.clearWave();
  const id = `wave-${i + 1}-cleared`;
  // After the last wave the win panel takes over. Before a new tool, its first
  // lesson takes over right away (it says the wave is cleared), so the tool is
  // learned by doing, with no Next button.
  if (last || tool) return { id, start, done: () => true, timeout: 0 };
  return infoStep(id, banner('Well done! Get ready for the next wave.', 'star', undefined, { header: `Wave ${i + 1} cleared!` }), start);
}
