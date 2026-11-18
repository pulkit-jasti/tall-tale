// First-use tool lessons (2026-11-18, docs/v3-plan.md "First-use tool
// lessons"): the first time a tool stands on the player's stand in a battle
// (campaign, Custom Game, Endless), it is taught before the first wave, on the
// level's own map, with nothing else running. Several new tools are taught
// one after another, in stand order. Each lesson covers everything the tool
// does (its traps too, when the map has them), in small steps that follow the
// tutorial's rules (docs/mvp.md "Tutorial director", AGENTS.md "Ghost hand
// demos"): one short line, a ghost hand on the real thing, moving on by
// doing, and only what the step needs on the board (its own lesson goblins, a
// trap, a seed bed, a balloon). Then the board is cleared and the level
// starts with its wave banner. Endless also teaches a tool picked in a
// breather, before the next wave. Secret abilities (docs/v3-plan.md 2.6) are
// never taught: they stay discoveries. No Three.js here.
import type { TriggerKind } from '../rules/blueprint.js';
import {
  balloonStep,
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
  trapStep,
  type FoodTool,
  type Hand,
  type Hint,
  type ToolName,
  type TutorialApi,
  type TutorialStep,
} from './tutorial.js';

/** The step that ends the lessons. */
const LESSONS_OVER = 'tool-lessons-over';

/** What the lessons are built for (the battle gives it). */
export interface LessonContext {
  /** The hand to grab a tool with: across from the side it stands on. */
  handFor: (tool: ToolName) => Hand;
  /** The tool is on the stand in this battle (the sugar's slingshot shot needs both). */
  onStand: (tool: ToolName) => boolean;
  /** This battle's map has a trap of this kind (its step is left out if not). */
  hasTrap: (kind: TriggerKind) => boolean;
}

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

/** A trap step, only if the map has that trap. */
const trapIf = (ctx: LessonContext, kind: TriggerKind, text: string, extra: Partial<Hint> = {}): TutorialStep[] =>
  ctx.hasTrap(kind) ? [trapStep(kind, text, extra)] : [];

/**
 * A use step on the tool's own goblins: they come at the start, are topped up while it runs, and go at the
 * end. `bring` brings them, `keep` tops them up, `done` and `count` say when it is done (counted from the start).
 */
function useStep(
  id: string,
  tool: FoodTool,
  hint: Hint,
  count: (api: TutorialApi) => number,
  options: { bring?: (api: TutorialApi) => void; keep?: (api: TutorialApi, dt: number) => void; afterDone?: number } = {},
): TutorialStep {
  return lessonStep(id, hint, (api, since) => count(api) > since, count, {
    start: (api) => {
      api.holdToolTimer(tool, true);
      options.bring?.(api);
    },
    end: (api) => {
      api.holdToolTimer(tool, false);
      api.releaseBait();
    },
    fallbacks: [(api) => api.hintTool(tool), (api) => (options.bring ? options.bring(api) : api.hintTool(tool))],
    tick: options.keep,
    holdSpawns: true,
    afterDone: options.afterDone ?? PAUSE_AFTER.finish,
  });
}

/**
 * The slingshot: grab, pebble, load, hit a goblin walking on the road (the tutorial's lessons), then each
 * trap it sets off that the map has (the boulder rolls over goblins, the tree blocks the road, the bridge
 * drops goblins in the stream), then a balloon. Kegs take fire only: the glass teaches them.
 */
function slingshotSteps(ctx: LessonContext): TutorialStep[] {
  return [
    ...slingshotLessons('A new tool!'),
    shootLesson(),
    // The first trap shows the pull straight back from it, like the tutorial's boulder lesson.
    ...trapIf(ctx, 'boulder', 'Shoot the striped boulder. It rolls over goblins.', { aimDots: true, demo: 'aimKeg' }),
    ...trapIf(ctx, 'tree', 'Shoot the tree with the red band. It falls and blocks the road.', { aimDots: true }),
    ...trapIf(ctx, 'bridge', 'Shoot the rope bridge. Goblins on it fall in the stream.', { aimDots: true }),
    balloonStep(),
  ];
}

/** The fly swatter: swat goblins on the wall, see a helmet stop it, swat a balloon away. */
function swatterSteps(hand: Hand): TutorialStep[] {
  const mirror = hand !== FOOD_TOOL_LESSONS.swatter.hand;
  const locked = FOOD_TOOL_LESSONS.swatter.locked;
  return [
    grabLesson('swatter', intro('swatter'), hand, false),
    toolLesson('swatter', hand, true),
    useStep(
      'learn-swatter-clonk',
      'swatter',
      lesson('This one wears a helmet. Swat it and see.', 'target', 'baitGoblin', { tool: 'swatter', whenLocked: locked, mirror, doneText: 'Clonk! Armor stops the swatter.' }),
      (api) => api.swatClonks(),
      { bring: (api) => api.baitForTool(true), keep: (api, dt) => api.keepBait(dt, true) },
    ),
    lessonStep(
      'learn-swatter-balloon',
      lesson('A balloon by your wall! Swat it away.', 'target', 'balloon', { tool: 'swatter', whenLocked: locked, glass: true, doneText: 'Away it goes! It comes back later.' }),
      (api, since) => api.balloonPushes() > since,
      (api) => api.balloonPushes(),
      {
        start: (api) => {
          api.holdToolTimer('swatter', true);
          api.balloonLesson(true);
        },
        end: (api) => {
          api.holdToolTimer('swatter', false);
          api.endBalloonLesson();
        },
        fallbacks: [(api) => api.balloonLesson(true), (api) => api.balloonLesson(true)],
        holdSpawns: true,
        afterDone: PAUSE_AFTER.finish,
      },
    ),
  ];
}

/**
 * The pepper: shake it over goblins on the wall (they sneeze), eat a sneezing one (it heals double), then
 * shake it on the ground just outside the wall (a strip fills, and goblins walking through it sneeze).
 */
function pepperSteps(hand: Hand): TutorialStep[] {
  const text = FOOD_TOOL_LESSONS.pepper;
  const mirror = hand !== text.hand;
  return [
    grabLesson('pepper', intro('pepper'), hand, false),
    // Its goblins stay on the wall for the eat step (they must still be sneezing).
    lessonStep(
      'learn-pepper',
      lesson(text.use, 'target', 'baitGoblin', { tool: 'pepper', demo: text.useDemo, mirror, whenLocked: text.locked, doneText: text.doneText }),
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
        // The same goblins (sneezing now); any gone are topped up. The shaker still works, to pepper again.
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
    useStep(
      'learn-pepper-ring',
      'pepper',
      lesson('Shake pepper on the ground just outside your wall.', 'target', 'frontGround', {
        tool: 'pepper',
        demo: 'pepperGround',
        mirror,
        whenLocked: text.locked,
        doneText: 'Goblins walking through it sneeze!',
      }),
      (api) => api.ringFills(),
    ),
  ];
}

/** The war horn: call a squad (look at a road, raise it, blow), watch it fight, then move that squad to another road. */
function hornSteps(hand: Hand): TutorialStep[] {
  return [
    // The horn's use lesson starts with "grab it", so it needs no grab lesson.
    toolLesson('horn', hand, true),
    squadFightStep(),
    lessonStep(
      'learn-horn-move',
      // On the glass sign: the horn is aimed by the look, so its text follows the look.
      lesson('Look at another road and blow again. Your knights walk there, for free.', 'target', 'hornHandle', {
        tool: 'horn',
        glass: true,
        doneText: 'On the move! Moving knights costs nothing.',
      }),
      (api, since) => api.hornMoves() > since,
      (api) => api.hornMoves(),
      {
        // No new squad in this step: a road aimed at moves the one out (it is free, so the resting horn works too).
        start: (api) => api.hornMoveOnly(true),
        end: (api) => api.hornMoveOnly(false),
        fallbacks: [(api) => api.hintTool('horn'), (api) => api.hintTool('horn')],
        holdSpawns: true,
        afterDone: PAUSE_AFTER.watch,
      },
    ),
  ];
}

/** The magnet: pull the armor off a goblin on the road, then drop the bell tower's bell on goblins (if the map has one). */
function magnetSteps(ctx: LessonContext, hand: Hand): TutorialStep[] {
  const mirror = hand !== FOOD_TOOL_LESSONS.magnet.hand;
  return [
    grabLesson('magnet', intro('magnet'), hand, false),
    toolLesson('magnet', hand, true),
    ...trapIf(ctx, 'bellTower', 'Hold the magnet on the road under the tower bell. It drops on the goblins!', {
      tool: 'magnet',
      demo: 'magnetPoint',
      mirror,
    }),
  ];
}

/**
 * The magnifying glass: grow a sunflower (it shoots seeds), grow a mushroom (its spores confuse goblins),
 * burn a goblin without a helmet, light a keg, light a haystack (the traps only if the map has them).
 */
function glassSteps(ctx: LessonContext, hand: Hand): TutorialStep[] {
  const mirror = hand !== FOOD_TOOL_LESSONS.glass.hand;
  const locked = FOOD_TOOL_LESSONS.glass.locked;
  const raised = { tool: 'glass' as const, demo: 'glassRaise' as const, mirror, whenLocked: locked };
  const grow = (kind: 'sunflower' | 'mushroom', text: string, doneText: string): TutorialStep =>
    useStep(`learn-glass-${kind}`, 'glass', lesson(text, 'target', 'lessonBed', { ...raised, doneText }), (api) => api.plantsGrown(), {
      bring: (api) => api.showLessonBed(kind),
      // Watch the plant pop up.
      afterDone: PAUSE_AFTER.watch,
    });
  return [
    grabLesson('glass', intro('glass'), hand, false),
    grow('sunflower', 'Raise the glass in front of your eyes. Look at the seed bed.', 'A sunflower! It shoots seeds at goblins.'),
    grow('mushroom', 'Now grow the mushroom bed the same way.', 'A mushroom! Its spores confuse goblins.'),
    useStep(
      'learn-glass-burn',
      'glass',
      lesson('Now look at the goblin on the road. Hold your look to burn it.', 'target', 'baitGoblin', { ...raised, doneText: 'Burned! Helmets stop it.' }),
      (api) => api.toolUses('glass'),
      { bring: (api) => api.baitMoving(false), keep: (api, dt) => api.keepMovingBait(dt, false) },
    ),
    ...trapIf(ctx, 'keg', 'Look at the powder keg to light it. Boom!', raised),
    ...trapIf(ctx, 'hay', 'Look at the haystack to light it. It blocks the road while it burns.', raised),
  ];
}

/** Sugar cubes: pinch one, drop it on the wall by the goblins (they stop to eat), then (with the slingshot) shoot one far. */
function sugarSteps(ctx: LessonContext, hand: Hand): TutorialStep[] {
  const mirror = hand !== FOOD_TOOL_LESSONS.sugar.hand;
  const locked = FOOD_TOOL_LESSONS.sugar.locked;
  const steps: TutorialStep[] = [
    // The goblins come first, so the player sees where the cube goes while pinching it.
    grabLesson('sugar', intro('sugar'), hand, false, {
      start: (api) => {
        api.holdToolTimer('sugar', true);
        api.baitForTool(false);
      },
      tick: (api, dt) => api.keepBait(dt, false),
    }),
    useStep(
      'learn-sugar-drop',
      'sugar',
      lesson(FOOD_TOOL_LESSONS.sugar.use, 'target', 'baitGoblin', { tool: 'sugar', demo: 'sugarDrop', mirror, whenLocked: locked, doneText: 'Yum! Lured goblins stop to eat.' }),
      (api) => api.goblinsLured(),
      // Watch them walk to the cube and eat.
      { bring: (api) => api.baitForTool(false), keep: (api, dt) => api.keepBait(dt, false), afterDone: PAUSE_AFTER.watch },
    ),
  ];
  if (ctx.onStand('slingshot')) {
    steps.push(
      useStep(
        'learn-sugar-shot',
        'sugar',
        lesson('Put a cube in the slingshot pouch and shoot it far out.', 'target', 'pouch', {
          tool: 'sugar',
          alsoTool: 'slingshot',
          whenLocked: locked,
          doneText: 'Goblins out there stop to eat it too.',
        }),
        (api) => api.cubesShot(),
      ),
    );
  }
  return steps;
}

/** One tool's lessons, in small steps, for the hand across from its side. */
function lessonsFor(tool: ToolName, ctx: LessonContext): TutorialStep[] {
  const hand = ctx.handFor(tool);
  switch (tool) {
    case 'slingshot':
      // The slingshot always stands on the right front: the left hand holds it, the right loads and pulls.
      return slingshotSteps(ctx);
    case 'swatter':
      return swatterSteps(hand);
    case 'pepper':
      return pepperSteps(hand);
    case 'horn':
      return hornSteps(hand);
    case 'magnet':
      return magnetSteps(ctx, hand);
    case 'glass':
      return glassSteps(ctx, hand);
    case 'sugar':
      return sugarSteps(ctx, hand);
    case 'drum':
      // Grab the stick and strike; its done line says a harder strike stuns longer.
      return [grabLesson('drum', intro('drum'), hand, false), toolLesson('drum', hand, true)];
  }
}

/**
 * The first-use lessons for `tools` (in stand order), each followed by its
 * "learned" step, then the step that clears the board.
 */
export function buildToolLessons(tools: ToolName[], ctx: LessonContext): TutorialStep[] {
  if (tools.length === 0) return [];
  const steps: TutorialStep[] = [];
  for (const tool of tools) {
    const own = lessonsFor(tool, ctx);
    // Each tool counts its own steps: "Magnet: step 1 of 3".
    const shown = own.filter((s) => s.hint?.kind === 'lesson');
    shown.forEach((s, i) => {
      s.hint = { ...s.hint!, header: `${TITLES[tool]}: step ${i + 1} of ${shown.length}` };
    });
    steps.push(...own, learnedStep(tool));
  }
  steps.push({ id: LESSONS_OVER, start: (api) => api.endToolLessons(), done: () => true, timeout: 0 });
  return steps;
}
