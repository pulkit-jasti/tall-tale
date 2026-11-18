// First-use tool lessons (2026-11-18, docs/v3-plan.md "First-use tool
// lessons"): the first time a tool stands on the player's stand in a battle
// (campaign, Custom Game, Endless), it is taught before the first wave, on the
// level's own map, with nothing else running. Several new tools are taught
// one after another, in stand order. Each lesson follows the tutorial's rules
// (docs/mvp.md "Tutorial director", AGENTS.md "Ghost hand demos"): one short
// line, a ghost hand on the real thing, small steps that move on by doing,
// and only what the tool needs on the board (its own lesson goblins or a seed
// bed). Then the board is cleared and the level starts with its wave banner.
// Endless also teaches a tool picked in a breather, before the next wave.
// No Three.js here.
import {
  FOOD_TOOL_LESSONS,
  grabLesson,
  learnedStep,
  lesson,
  lessonStep,
  PAUSE_AFTER,
  shootLesson,
  slingshotLessons,
  squadFightStep,
  TOOL_NAMES,
  toolLesson,
  type FoodTool,
  type Hand,
  type ToolName,
  type TutorialApi,
  type TutorialStep,
} from './tutorial.js';

/** The step that ends the lessons (Skip lessons skips up to it). */
const LESSONS_OVER = 'tool-lessons-over';

/** The tool's name for a step header ("Magnet: step 1 of 3"). */
const TITLES: Record<ToolName, string> = {
  slingshot: 'Slingshot',
  swatter: 'Fly swatter',
  pepper: 'Pepper shaker',
  horn: 'War horn',
  drum: 'Drum',
  magnet: 'Magnet',
  glass: 'Magnifying glass',
  sugar: 'Sugar cubes',
};

/** "A new tool: the magnet! It pulls armor off goblins." */
const intro = (tool: FoodTool): string => `A new tool: ${TOOL_NAMES[tool]}!${FOOD_TOOL_LESSONS[tool].about ?? ''}`;

/**
 * The pepper: shake it over goblins on the wall, then eat a sneezing one
 * (a seasoned goblin heals double). The shaker keeps working in the eat
 * step, so the player can shake again if the sneezing wore off.
 */
function pepperLessons(hand: Hand): TutorialStep[] {
  const text = FOOD_TOOL_LESSONS.pepper;
  return [
    grabLesson('pepper', intro('pepper'), hand, false),
    // Like toolLesson, but its goblins stay on the wall for the eat step (they must still be sneezing).
    lessonStep(
      'learn-pepper',
      lesson(text.use, 'target', 'baitGoblin', {
        tool: 'pepper',
        demo: text.useDemo,
        mirror: hand !== text.hand,
        whenLocked: text.locked,
        doneText: text.doneText,
      }),
      (api, since) => api.toolUses('pepper') > since,
      (api) => api.toolUses('pepper'),
      {
        start: (api) => {
          api.holdToolTimer('pepper', true);
          api.baitForTool(false);
        },
        fallbacks: [(api) => api.hintTool('pepper'), (api) => api.baitForTool(false)],
        tick: (api, dt) => api.keepBait(dt, false),
        holdSpawns: true,
        afterDone: PAUSE_AFTER.finish,
      },
    ),
    lessonStep(
      'learn-pepper-eat',
      lesson('Now eat a sneezing goblin. It heals your castle double!', 'pinch', 'baitGoblin', { tool: 'pepper' }),
      (api, since) => api.pepperedEaten() > since,
      (api) => api.pepperedEaten(),
      {
        // The same goblins (sneezing now); any gone are topped up.
        start: (api) => api.holdToolTimer('pepper', true),
        end: (api) => {
          api.holdToolTimer('pepper', false);
          api.releaseBait();
        },
        fallbacks: [(api) => api.hintTool('pepper'), (api) => api.hintTool('pepper')],
        tick: (api, dt) => api.keepBait(dt, false),
        holdSpawns: true,
        afterDone: PAUSE_AFTER.finish,
      },
    ),
  ];
}

/**
 * The magnifying glass: grab it, raise it in front of the eyes and look at a
 * seed bed until its plant grows, then look at a goblin without a helmet on
 * the road until it burns. The glass is aimed by the head, so the hand only
 * holds it up; the sign says where to look.
 */
function glassLessons(hand: Hand): TutorialStep[] {
  const mirror = hand !== FOOD_TOOL_LESSONS.glass.hand;
  const hold = (on: boolean) => (api: TutorialApi) => api.holdToolTimer('glass', on);
  return [
    grabLesson('glass', intro('glass'), hand, false),
    lessonStep(
      'learn-glass-grow',
      lesson('Raise the glass in front of your eyes. Look at the seed bed.', 'target', 'lessonBed', {
        tool: 'glass',
        demo: 'glassRaise',
        mirror,
        whenLocked: FOOD_TOOL_LESSONS.glass.locked,
        doneText: 'It grew! Plants fight for you.',
      }),
      (api, since) => api.plantsGrown() > since,
      (api) => api.plantsGrown(),
      {
        start: (api) => {
          api.holdToolTimer('glass', true);
          api.showLessonBed();
        },
        end: hold(false),
        fallbacks: [(api) => api.hintTool('glass'), (api) => api.hintTool('glass')],
        holdSpawns: true,
        // Watch the plant pop up.
        afterDone: PAUSE_AFTER.watch,
      },
    ),
    lessonStep(
      'learn-glass-burn',
      lesson('Now look at the goblin on the road. Hold your look to burn it.', 'target', 'baitGoblin', {
        tool: 'glass',
        demo: 'glassRaise',
        mirror,
        whenLocked: FOOD_TOOL_LESSONS.glass.locked,
        doneText: 'Burned! Helmets stop it.',
      }),
      (api, since) => api.toolUses('glass') > since,
      (api) => api.toolUses('glass'),
      {
        start: (api) => {
          api.holdToolTimer('glass', true);
          api.baitMoving(false);
        },
        end: (api) => {
          api.holdToolTimer('glass', false);
          api.releaseBait();
        },
        fallbacks: [(api) => api.hintTool('glass'), (api) => api.baitMoving(false)],
        tick: (api, dt) => api.keepMovingBait(dt, false),
        holdSpawns: true,
        afterDone: PAUSE_AFTER.finish,
      },
    ),
  ];
}

/**
 * Sugar cubes: pinch a cube off the bowl, then drop it on the wall next to
 * the goblins waiting there. Done when one walks to it and eats.
 */
function sugarLessons(hand: Hand): TutorialStep[] {
  const mirror = hand !== FOOD_TOOL_LESSONS.sugar.hand;
  return [
    // The goblins come first, so the player sees where the cube goes while pinching it.
    grabLesson('sugar', intro('sugar'), hand, false, {
      start: (api) => {
        api.holdToolTimer('sugar', true);
        api.baitForTool(false);
      },
      tick: (api, dt) => api.keepBait(dt, false),
    }),
    lessonStep(
      'learn-sugar-drop',
      lesson(FOOD_TOOL_LESSONS.sugar.use, 'target', 'baitGoblin', {
        tool: 'sugar',
        demo: 'sugarDrop',
        mirror,
        whenLocked: FOOD_TOOL_LESSONS.sugar.locked,
        doneText: 'Yum! Lured goblins stop to eat.',
      }),
      (api, since) => api.goblinsLured() > since,
      (api) => api.goblinsLured(),
      {
        end: (api) => {
          api.holdToolTimer('sugar', false);
          api.releaseBait();
        },
        fallbacks: [(api) => api.hintTool('sugar'), (api) => api.hintTool('sugar')],
        tick: (api, dt) => api.keepBait(dt, false),
        holdSpawns: true,
        // Watch them walk to the cube and eat.
        afterDone: PAUSE_AFTER.watch,
      },
    ),
  ];
}

/** One tool's lessons, in small steps, for the hand across from its side. */
function lessonsFor(tool: ToolName, hand: Hand): TutorialStep[] {
  switch (tool) {
    case 'slingshot':
      // The slingshot always stands on the right front: the left hand holds it, the right loads and pulls.
      return [...slingshotLessons('A new tool!'), shootLesson()];
    case 'pepper':
      return pepperLessons(hand);
    case 'glass':
      return glassLessons(hand);
    case 'sugar':
      return sugarLessons(hand);
    case 'horn':
      // The horn's use lesson starts with "grab it", so it needs no grab lesson; then the knights' first fight.
      return [toolLesson('horn', hand, true), squadFightStep()];
    default:
      return [grabLesson(tool, intro(tool), hand, false), toolLesson(tool, hand, true)];
  }
}

/**
 * The first-use lessons for `tools` (in stand order), each followed by its
 * "learned" step, then the step that clears the board. `handFor` gives the
 * hand to grab each tool with (across from the side it stands on).
 */
export function buildToolLessons(tools: ToolName[], handFor: (tool: ToolName) => Hand): TutorialStep[] {
  if (tools.length === 0) return [];
  const steps: TutorialStep[] = [];
  for (const tool of tools) {
    const own = lessonsFor(tool, handFor(tool));
    // Each tool counts its own steps: "Magnet: step 1 of 2".
    const shown = own.filter((s) => s.hint?.kind === 'lesson');
    shown.forEach((s, i) => {
      s.hint = { ...s.hint!, header: `${TITLES[tool]}: step ${i + 1} of ${shown.length}` };
    });
    steps.push(...own, learnedStep(tool));
  }
  steps.push({ id: LESSONS_OVER, start: (api) => api.endToolLessons(), done: () => true, timeout: 0 });
  return steps;
}
