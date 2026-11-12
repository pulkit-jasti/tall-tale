// The tutorial director (docs/mvp.md "Tutorial director"): 4 waves (v2 run 2, was 5), each
// introducing one new thing, taught by doing. Each lesson shows one short
// instruction on the hint sign and a marker on the thing to use, and waits
// until the player does it. New things are taught before their wave, so no
// enemies press the player while learning.
// The wave numbers and the step list live here together, so they are tuned
// side by side. Steps only call the game systems through TutorialApi. Nothing
// tutorial-only lives in those systems. No Three.js here, so it can be tested.
import type { GoblinType } from '../config/game.js';
import type { TriggerKind } from '../rules/blueprint.js';
import type { DirectorStep } from '../rules/director.js';
import type { GearShares } from '../rules/gear.js';
import { risingByWave } from './levelDirector.js';
import type { GhostDemoName } from '../ui/ghostDemos.js';

/** v2: the horn replaces the megaphone, and the bell is its own tool (docs/v2-plan.md 2.3). */
export type ToolName = 'slingshot' | 'swatter' | 'pepper' | 'horn' | 'bell';

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
  /** The new tool is taught in the middle of the wave instead, after the player has eaten a few goblins (wave 1's horn). */
  toolMidWave?: boolean;
  /** Balloons with riders this wave (build step 7). The first wave with balloons shows a banner when they come. */
  balloons?: number;
  /**
   * Camp ids that rise as this wave starts (docs/custom-mode.md section 7).
   * Missing (the tutorial): a camp rises in the first wave that sends from it.
   */
  rising?: string[];
  /** A level wave's gear shares (every piece handed out from wave 1). Missing: GOBLIN_GEAR from its waves on. */
  gear?: GearShares;
}

/**
 * The tutorial waves from docs/mvp.md "Tutorial waves", balanced with the
 * troops in build step 5 (step 3 and 4 used small test waves). Enemies come
 * out in small groups over `spawnTime`, so the board stays in the unit budget.
 */
export const TUTORIAL_WAVES: WavePlan[] = [
  {
    intro: 'Goblins are coming! Eat them before they get in.',
    camps: ['campNorth'],
    // v2: no climber type, every goblin climbs. The old climbers are grunts now.
    counts: { grunt: 9, runner: 0 },
    spawnTime: 40,
    // v2: the knights only come when the horn calls them. After the basics, wave 1 first plays on its
    // own (eat a few goblins), then the horn is taught in the middle of it (headset test: too many signs in a row).
    newTool: 'horn',
    toolMidWave: true,
  },
  {
    intro: 'A new camp rises! Shoot the far ones.',
    camps: ['campNorth', 'campEast'],
    counts: { grunt: 12, runner: 0 },
    spawnTime: 50,
    newTool: 'slingshot',
  },
  {
    intro: 'Runners from a new camp! Small and fast.',
    camps: ['campNorth', 'campWest'],
    counts: { grunt: 11, runner: 12 },
    spawnTime: 55,
    newTool: 'swatter',
  },
  {
    // v2 run 2: 4 waves (was 5), like every campaign level (one time of day each). The old wave 5 had no
    // lesson left once the bell became a campaign unlock, so this is the final wave now.
    intro: 'Final wave! A camp rises behind you. Watch your compass and spin the board.',
    camps: ['campEast', 'campSouth', 'campWest'],
    counts: { grunt: 18, runner: 8 },
    spawnTime: 60,
    newTool: 'pepper',
    balloons: 3,
  },
];

/** Step timing (seconds) and lesson goals. */
export const TUTORIAL_TIMING = {
  /** A lesson waits this long before its first fallback, then again for the second. */
  stuckAfter: 20,
  // No lesson moves on by itself any more (headset test: the horn lesson ran out and the wave went on
  // untaught). A lesson waits until the player does it; the fallbacks help, the lesson's goblins are
  // always topped up, and a player who wants out uses Skip tutorial (welcome panel, pause panel).
  /** A lesson's goblin (or bait) that is gone comes back after this long (seconds). */
  respawnAfter: 1.5,
  /**
   * Wave 1 plays on its own first (no signs): the horn is taught once the
   * player has eaten this many goblins in it, or after this long (seconds).
   */
  // Fewer goblins before the horn (headset test): half the spawn rate meanwhile, 2 eaten or 30 s, then a
  // breather with no new goblins until the board is clear.
  // Then only hornGoblins come out at all before the horn, and the horn waits for a clear board.
  hornAfterEaten: 2,
  hornAfterSeconds: 30,
  hornGoblins: 3,
  /**
   * The horn lesson's pace (seconds): "look around" stays at least hornLookTime
   * after the grab (so the player finds out the flag and the path follow the
   * look before being told to raise it and blow; headset test: it went
   * straight to lift and blow). There is no "spot set" beat any more (no lock step).
   */
  hornLookTime: 6,
  /** Between tutorial waves the knight squads march home this long after the wave is cleared (after their cheer, seconds). */
  squadsHomeAfter: 1.8,
  /**
   * After the horn lesson the knights fight for the first time: this many
   * plain grunts start this far out on the squad's road (cm, `gap` apart) and
   * walk into it. Few enough that the knights win.
   */
  // They come only once the squad has reached its spot (or after maxWait seconds), close to it, so the
  // player first watches the knights arrive, then the fight (headset test: they came too early).
  squadFight: { count: 3, from: 32, gap: 5, maxWait: 15 },
  /**
   * "Measure reach" from the settings gives up after this long without a
   * stretched arm (no hands in the browser). The tutorial's reach check waits.
   */
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
   * goblins are replaced).
   */
  triggerStuckAfter: 25,
  /**
   * The balloon lesson comes after the trigger lessons, once the player has
   * knocked out this many more goblins (or after this long, seconds).
   */
  balloonAfterKnockouts: 3,
  balloonAfterSeconds: 35,
};

/** What a marker points at. The battle turns it into a world position. */
export type MarkerTarget =
  | 'ring'
  | 'lessonGoblin'
  | 'healthFlag'
  | 'compass'
  | 'slingHandle'
  | 'bowl'
  | 'pouch'
  | 'swatterHandle'
  | 'pepperHandle'
  | 'hornHandle'
  | 'bellHandle'
  /** The keg, boulder or tree of the current trigger lesson. */
  | 'lessonTrigger'
  /** The pause button on its stand in front, while it shows. */
  | 'pauseButton'
  /** A goblin brought for the current lesson (the moving targets, the goblins on the wall). */
  | 'baitGoblin'
  /** The balloon the balloon banner is about (the nearest one in the air). */
  | 'balloon';

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
  /** The target is in the air (the balloon): the sign hangs low (HINT_SIGN.lowY), out of the way of it and the shot. */
  signLow?: boolean;
  /**
   * The text goes on the glass sign (GLASS_SIGN) that follows the look, not
   * the hint sign: for lessons where the player must watch what is in front
   * of them (the horn aimed by gaze, the balloon). Only one sign shows.
   */
  glass?: boolean;
  /** The knights' first fight: its text while they march out, and once the goblins come. */
  watchSteps?: { march: string; fight: string };
  /** Shown instead when the lesson goblin is on the board, not in the hand (dropped it). */
  whenDropped?: string;
  /** The hand tool this lesson is about, and the text shown instead while it rests (recharges). */
  tool?: ToolName;
  whenLocked?: string;
  /** Shown instead when the horn does not listen to the mic (no mic, or the quiet horn setting). */
  whenNoMic?: string;
  /** The ghost hand demo instead then. */
  demoNoMic?: GhostDemoName;
  /** A ghost hand loops this demonstration next to the target. */
  demo?: GhostDemoName;
  /** Info steps: they wait for the "Next" button on the sign. */
  next?: boolean;
  /** The reach check: the sign shows its countdown while the arm is out. */
  reachCheck?: boolean;
  /** Shown instead of the instruction on the ticked sign when the lesson is done. */
  doneText?: string;
  /** The horn lesson: the text follows what the player is doing (TutorialApi.hornState). */
  hornSteps?: HornSteps;
}

/** The horn lesson's beats: not held, aiming, a spot to lock, locked (blow, or keep it there with the quiet horn). */
/**
 * The horn lesson's beats, in order (the battle picks one by what the player
 * does and how long): `aim` for at least TUTORIAL_TIMING.hornLookTime after
 * the grab (time to look around and see the flag and the path follow), then
 * `lift` (raise it in front of the face), then `blow`.
 */
export interface HornSteps {
  idle: string;
  aim: string;
  lift: string;
  blow: string;
  blowQuiet: string;
}

export interface TutorialStep extends DirectorStep<TutorialApi> {
  hint?: Hint;
  /**
   * A lesson the player just did: how long its ticked sign stays before the
   * next instruction (seconds). Only where the player needs the time: to
   * watch what they set off, rest an arm, or finish a move that is still
   * going. Unset: HINT_SIGN.doneTime, a short tick (a lesson that leads
   * straight into the next one, like pick up then eat, needs no pause).
   */
  afterDone?: number;
}

/** Pauses after a lesson is done, by what the player is doing then (seconds). */
const PAUSE_AFTER = {
  /** Watch what they just set off (a blast, a charge, a fall). */
  watch: 2.5,
  /** Finish a move still going (a ring drag) or see the result land. */
  finish: 1.5,
  /** Rest the arm after the reach check. */
  rest: 2.5,
};

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
  /**
   * Every frame of a lesson that needs the lesson goblin: when it is gone
   * (eaten, thrown away, knocked out), a new one pops up on the wall in front
   * after TUTORIAL_TIMING.respawnAfter, so the player is never left with
   * nothing to do.
   */
  keepLessonGoblin(dt: number): void;
  /** Every frame of a tool lesson: the lesson's goblins are topped up shortly after any are gone (`armored` as in baitForTool). */
  keepBait(dt: number, armored: boolean): void;
  /** Every frame of the shoot lesson: the moving target is topped up shortly after it is gone. */
  keepMovingBait(dt: number): void;
  /** Where the horn lesson is: not held, aiming (no road spot yet), a spot (raise it), raised in front of the face with a spot. */
  hornState(): 'idle' | 'aim' | 'lift' | 'blow';
  /** The horn lesson's last beat: a few goblins walk down the road into the squad just called. False without a squad. */
  sendGroupAtSquad(): boolean;
  /** Goblins on the board right now. */
  goblinsLeft(): number;
  /** Goblins the current wave sent out so far. */
  spawnedInWave(): number;
  /** The squad the horn called is in the field, and it has reached its spot. */
  hasSquad(): boolean;
  squadReady(): boolean;
  /** Those goblins stop waiting in front of the squad and walk on (the squad is gone). */
  releaseSquadFoes(): void;
  /** How many of those goblins are still on the board. */
  squadFoesLeft(): number;
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
  /** True if the tool can be used now: not resting (recharging). */
  toolReady(tool: ToolName): boolean;
  /** Total board spin (degrees) and height change (cm) made by the player so far. */
  boardSpun(): number;
  boardMoved(): number;
  /** Goblins picked up and eaten in this battle. */
  picked(): number;
  eaten(): number;
  /** Goblins thrown away (let go fast enough, away from the mouth) in this battle. */
  tossed(): number;
  /** Goblins eaten while seasoned (peppered). */
  pepperedEaten(): number;
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
  /** The shoot lesson: a few goblins walk back and forth on the road in front, a moving target (topped up when called again). */
  baitMoving(): void;
  /**
   * A tool's use lesson: a few goblins wait still on the wall in front,
   * harmless, until it is used (topped up when called again). `armored`:
   * with helmets, shields and weapons (the pepper lesson, so the disarm shows).
   */
  baitForTool(armored?: boolean): void;
  /** The lesson is over: its goblins go on as usual. */
  releaseBait(): void;
  /** How many triggers of a kind were set off in this battle. */
  triggersSetOff(kind: TriggerKind): number;
  /** How often the player paused (and came back) in this battle. */
  pausedCount(): number;
  /** The balloon lesson: one balloon floats in right in front and hovers outside the wall until popped. */
  balloonLesson(): void;
  /** The balloon lesson is over: a balloon still hovering comes on in. */
  endBalloonLesson(): void;
  /** Balloons popped so far. */
  balloonsPopped(): number;
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
    // A lesson waits until it is done (or skipped with Skip tutorial).
    timeout: Infinity,
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
      'Show me how big you are, giant! Stretch one arm out, hand flat.',
      'target',
      undefined,
      { demo: 'reach', reachCheck: true, doneText: 'Done! Rest your arm.' },
    ),
    start: (api) => api.startReachCheck(),
    done: (api) => api.reachChecked(),
    // It waits for the arm, like every lesson (or Skip tutorial). The board then keeps its size.
    end: (api) => {
      if (!api.reachChecked()) api.stopReachCheck();
    },
    timeout: Infinity,
    // Time to read "rest your arm" and bring it down before the next instruction.
    afterDone: PAUSE_AFTER.rest,
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
      lesson('Poke the pause button on your right, then Resume.', 'info', 'pauseButton', {
        doneText: 'Now you can pause!',
      }),
      (api, since) => api.pausedCount() > since,
      (api) => api.pausedCount(),
      {},
    ),
    lessonStep(
      'learn-spin',
      lesson('Grab the ring. Pull it sideways to spin.', 'spin', 'ring', { demo: 'spin' }),
      (api, since) => api.boardSpun() - since >= TUTORIAL_TIMING.spinGoal,
      (api) => api.boardSpun(),
      // The goal is met mid-pull: a moment to finish the pull and let go of the ring.
      { afterDone: PAUSE_AFTER.finish },
    ),
    lessonStep(
      'learn-height',
      lesson('Pull the ring up or down to set the height.', 'up', 'ring', { demo: 'height' }),
      (api, since) => api.boardMoved() - since >= TUTORIAL_TIMING.heightGoal,
      (api) => api.boardMoved(),
      // Done after a few cm: time to keep adjusting until the height feels right.
      { afterDone: PAUSE_AFTER.watch },
    ),
    lessonStep(
      'learn-pinch',
      lesson('A goblin! Pinch it to pick it up.', 'pinch', 'lessonGoblin', {
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
        // A lesson goblin is always there to pick up (a new one if it was thrown or swatted away).
        tick: keepGoblin,
        // It is in the hand now: "bring it to your mouth" right away.
        afterDone: 0,
      },
    ),
    lessonStep(
      'learn-eat',
      lesson('Hold it at your mouth to eat it.', 'target', 'lessonGoblin', {
        whenDropped: 'Dropped it! Pinch it again.',
        demo: 'eat',
      }),
      (api) => api.eaten() > eatenBefore,
      () => 0,
      // Thrown away instead of eaten: a new goblin comes to eat.
      { fallbacks: [(api) => api.lessonClimber(true)], tick: keepGoblin },
    ),
    // Right after eating: goblins can also be thrown away. A new climber comes; the lesson waits for a throw.
    lessonStep(
      'learn-toss',
      lesson('Pinch one, swing and let go to throw it.', 'pinch', 'lessonGoblin', {
        demo: 'toss',
      }),
      (api, since) => api.tossed() > since,
      (api) => api.tossed(),
      {
        start: (api) => api.lessonClimber(false),
        fallbacks: [(api) => api.lessonClimber(false), (api) => api.lessonClimber(true)],
        // Eaten instead of thrown (this used to leave nothing to throw): a new goblin pops up to throw.
        tick: keepGoblin,
        // Watch it fly and land, dizzy.
        afterDone: PAUSE_AFTER.finish,
      },
    ),
  ];
}

/** A lesson that needs a lesson goblin: a new one pops up on the wall shortly after the last was eaten, thrown or knocked out. */
const keepGoblin = (api: TutorialApi, dt: number): void => api.keepLessonGoblin(dt);

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
      lesson('Wave cleared! A slingshot. Grab it with your left hand.', 'grab', 'slingHandle', {
        demo: 'slingGrab',
      }),
      (api, since) => api.slingCount('grabbed') > since,
      fromToolShown,
      // It is in the hand: the next step (a pebble) right away. The same for the pebble.
      { start: (api) => api.showTool('slingshot'), fallbacks: [(api) => api.hintTool('slingshot')], afterDone: 0 },
    ),
    lessonStep(
      'learn-sling-pebble',
      lesson('Pinch a pebble with your right hand.', 'pinch', 'bowl', { demo: 'pebble' }),
      (api, since) => api.slingCount('pebbleTaken') > since || api.slingLoaded(),
      fromToolShown,
      { fallbacks: [(api) => api.helpWithTool('slingshot')], afterDone: 0 },
    ),
    lessonStep(
      'learn-sling-load',
      lesson('Put the pebble in the pouch.', 'pinch', 'pouch', { demo: 'load' }),
      (api) => api.slingLoaded(),
      () => 0,
      { fallbacks: [(api) => api.helpWithTool('slingshot')] },
    ),
  ];
}

/**
 * The first shot, at a moving target: a few goblins walk back and forth on
 * the road in front (the wave holds its spawns meanwhile). Done when one is
 * hit, so the player feels how much the aim assist helps: aim near a goblin
 * and the shot bends to it. If stuck, a pebble goes into the pouch and
 * missing goblins are replaced.
 */
function shootLesson(): TutorialStep {
  const help = (api: TutorialApi): void => {
    api.helpWithTool('slingshot');
    api.baitMoving();
  };
  return lessonStep(
    'learn-sling-shoot',
    lesson('Pull the pouch back and let go. Aim near a goblin.', 'target', 'baitGoblin', {
      demo: 'shoot',
      // A slingshot lesson (its marker is the goblin): only the slingshot works meanwhile.
      tool: 'slingshot',
      // Ghost aim dots from the pouch to the moving goblin, like in the trigger lessons.
      aimDots: true,
      doneText: 'Hit! Your shots bend toward goblins.',
    }),
    (api, since) => api.toolUses('slingshot') > since,
    (api) => api.toolUses('slingshot'),
    {
      start: (api) => api.baitMoving(),
      end: (api) => api.releaseBait(),
      fallbacks: [help, help],
      // The moving target comes back soon after it is gone (eaten off the road, knocked away by a tossed pebble).
      tick: (api, dt) => api.keepMovingBait(dt),
      holdSpawns: true,
      // See the hit land, and read "the slingshot helps you aim".
      afterDone: PAUSE_AFTER.finish,
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
      text: 'Shoot the red barrel. Boom, goblins down!',
      extra: { demo: 'aimKeg' },
    },
    { kind: 'boulder', text: 'Shoot the striped boulder. It rolls over goblins.', extra: {} },
    {
      kind: 'tree',
      text: 'Shoot the tree with the red band. It blocks the road.',
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
        holdSpawns: true,
        // Watch the blast, the rolling boulder or the falling tree.
        afterDone: PAUSE_AFTER.watch,
      },
    ),
  );
}

type FoodTool = Exclude<ToolName, 'slingshot'>;

/** The line every resting tool shows (v2: free tools that recharge, eating speeds them up). */
const RESTING = 'Eat goblins to fill its ring faster!';

/** Each hand tool: where its handle is, the ghost hand demo for grabbing it, and its use lesson. */
interface FoodToolLesson {
  /** The hand it is grabbed with: across from the side its platform is on (AGENTS.md, "Opposite hand"). */
  hand: 'left' | 'right';
  marker?: MarkerTarget;
  grabDemo?: GhostDemoName;
  useDemo?: GhostDemoName;
  use: string;
  locked: string;
  /** The horn when it does not listen to the mic (no mic, or the quiet horn setting): its use text. */
  noMic?: { use: string };
  /** The use lesson brings goblins to wait on the wall in front (not for the horn: it sends knights down a road). */
  bait?: boolean;
  /** The pepper lesson's goblins wear helmets and shields and carry weapons, so the disarm shows. */
  armored?: boolean;
  /** One line on what the tool is for, in its grab lesson. */
  about?: string;
  /** The ticked sign's text once the use lesson is done. */
  doneText?: string;
  /** The horn: its use lesson's text by what the player is doing. */
  hornSteps?: HornSteps;
  /** The pause after the use lesson is done (PAUSE_AFTER). */
  afterDone?: number;
  /**
   * The horn: its use lesson only counts a use made during it (a blow by
   * accident while grabbing it must not finish the lesson before it was
   * taught), and it waits long for it (no wave clear ends it).
   */
  strict?: boolean;
}

const FOOD_TOOL_LESSONS: Record<FoodTool, FoodToolLesson> = {
  swatter: {
    hand: 'right',
    marker: 'swatterHandle',
    grabDemo: 'swatterGrab',
    use: 'Swat a goblin on your wall!',
    locked: `The swatter is resting. ${RESTING}`,
    bait: true,
    afterDone: PAUSE_AFTER.finish,
  },
  pepper: {
    hand: 'right',
    marker: 'pepperHandle',
    grabDemo: 'pepperGrab',
    use: 'Shake pepper on them. Their armor falls off! Then eat a sneezing one.',
    locked: `The pepper is resting. ${RESTING}`,
    bait: true,
    armored: true,
    afterDone: PAUSE_AFTER.finish,
  },
  horn: {
    hand: 'left',
    marker: 'hornHandle',
    grabDemo: 'hornGrab',
    useDemo: 'hornBlow',
    about: ' It calls your knights.',
    // One lesson in three beats on the glass sign (it follows the look), by what the player is doing (Hint.hornSteps).
    use: 'Hold the horn and look at a road.',
    locked: `The horn is resting. ${RESTING}`,
    hornSteps: {
      idle: 'Grab the horn with your left hand.',
      aim: 'Look around. The flag and your knights\' path go where you look.',
      lift: 'Now raise the horn in front of your face.',
      blow: 'Blow into the horn!',
      blowQuiet: 'Hold it there.',
    },
    doneText: 'Charge! Your knights guard that spot.',
    // Watch the gate burst open and the knights charge.
    afterDone: PAUSE_AFTER.watch,
    strict: true,
  },
  bell: {
    hand: 'right',
    marker: 'bellHandle',
    grabDemo: 'bellGrab',
    useDemo: 'bellRing',
    use: 'Ring the bell! Goblins get dizzy and fall off your wall.',
    locked: `The bell is resting. ${RESTING}`,
    bait: true,
    // Watch the goblins tumble off the wall.
    afterDone: PAUSE_AFTER.watch,
  },
};

/**
 * In the breather before its wave: the new hand tool appears and the player
 * grabs it. The first one also says how tools work now (v2): free, but they
 * rest after a use while the ring on their platform fills, and eating fills
 * it faster. (The real tutorial rebuild is run 2.)
 */
function toolGrabLesson(tool: FoodTool, first: boolean, beforeFirstWave: boolean, midWave = false): TutorialStep {
  const { marker, grabDemo, about } = FOOD_TOOL_LESSONS[tool];
  const { hand } = FOOD_TOOL_LESSONS[tool];
  const how = first ? ' After a use it rests a while.' : '';
  const intro = midWave ? 'Well eaten!' : beforeFirstWave ? 'A tool for you!' : 'Wave cleared!';
  // The hand across from the tool's side (see AGENTS.md, "Opposite hand"), as the ghost hand shows.
  const say = (name: string): string => `${intro} Here is ${name}.${about ?? ''}${how} Grab it with your ${hand} hand.`;
  return lessonStep(
    `learn-${tool}-grab`,
    lesson(say(TOOL_NAMES[tool]), 'grab', marker, { demo: grabDemo }),
    (api, since) => api.toolGrabbed(tool) > since,
    // Counts from when the tool appeared, like the slingshot lessons.
    fromToolShown,
    {
      start: (api) => api.showTool(tool),
      fallbacks: [(api) => api.hintTool(tool)],
      // It is in the hand: how to use it comes right away.
      afterDone: 0,
    },
  );
}

/**
 * In its wave: use the tool on one goblin, anywhere. Done as soon as one
 * goblin is hit. While it runs, the tool's use window is held (and a tool
 * still resting from an early use is made ready): a player who swats early
 * before the goblins come keeps the tool until they do. The easier fallback
 * brings a goblin in reach. It waits until the tool is used (Skip tutorial
 * is the way out).
 */
function toolLesson(tool: FoodTool): TutorialStep {
  const text = FOOD_TOOL_LESSONS[tool];
  // The pepper lesson is about what pepper is for: it is done once a peppered goblin is eaten.
  const pepper = tool === 'pepper';
  return lessonStep(
    `learn-${tool}`,
    // The marker points at the waiting goblins, or for the horn and bell at the tool itself (their demo is in the hand).
    lesson(text.use, 'target', text.useDemo ? text.marker : 'baitGoblin', {
      tool,
      whenLocked: text.locked,
      demo: text.useDemo,
      whenNoMic: text.noMic?.use,
      doneText: text.doneText,
      hornSteps: text.hornSteps,
      // The horn is aimed by gaze: its text follows the look (the glass sign), so it is never missed.
      glass: !!text.hornSteps,
    }),
    // Only doing it ends the lesson (no wave clear: its goblins are always topped up, see tick).
    pepper ? (api, since) => api.pepperedEaten() > since : (api, since) => api.toolUses(tool) > since,
    // The horn counts only a blow made during this lesson.
    pepper ? (api) => api.pepperedEaten() : text.strict ? (api) => api.toolUses(tool) : fromToolShown,
    {
      start: (api) => {
        api.holdToolTimer(tool, true);
        // A few goblins come just for this lesson and wait on the wall in front, harmless, until the tool is used.
        if (text.bait) api.baitForTool(text.armored ?? false);
      },
      end: (api) => {
        api.holdToolTimer(tool, false);
        api.releaseBait();
      },
      fallbacks: [(api) => api.hintTool(tool), (api) => (text.bait ? api.baitForTool(text.armored ?? false) : api.hintTool(tool))],
      // Goblins eaten or knocked out another way come back soon, so there is always one to use the tool on.
      tick: text.bait ? (api, dt) => api.keepBait(dt, text.armored ?? false) : undefined,
      // The wave waits while the player learns: only the lesson's goblins are out.
      holdSpawns: true,
      afterDone: text.afterDone,
    },
  );
}

/**
 * Right after the horn lesson: the player has called knights but never seen
 * them fight. A few goblins walk down the road straight into the squad, and
 * the lesson is done once they are gone (the knights win; if one slips past,
 * the player deals with it). The wave waits meanwhile. On the glass sign, so
 * the player keeps watching the fight.
 */
function squadFightStep(): TutorialStep {
  // First the player watches the knights reach their spot; only then do the goblins appear near it and walk in.
  let sent = false;
  let waited = 0;
  return {
    id: 'watch-knights',
    hint: lesson('Watch your knights march out.', 'star', undefined, {
      glass: true,
      doneText: 'Congratulations! Your knights won!',
      watchSteps: { march: 'Watch your knights march out.', fight: 'Goblins! Watch your knights fight.' },
    }),
    start: () => {
      sent = false;
      waited = 0;
    },
    tick: (api, dt) => {
      // The squad broke after all: its goblins walk on to the wall, where the player deals with them (never stuck).
      if (sent) {
        if (!api.hasSquad()) api.releaseSquadFoes();
        return;
      }
      waited += dt;
      // No squad in the field (debug, or it broke): nothing to watch.
      if (!api.hasSquad()) {
        sent = true;
        return;
      }
      if (api.squadReady() || waited > TUTORIAL_TIMING.squadFight.maxWait) {
        sent = true;
        api.sendGroupAtSquad();
      }
    },
    done: (api) => sent && api.squadFoesLeft() === 0,
    timeout: Infinity,
    holdSpawns: true,
    afterDone: PAUSE_AFTER.finish,
  };
}

/**
 * Balloons, taught in the slingshot wave after the trigger lessons (they are
 * best fought with the slingshot). First the wave plays on for a while (a few
 * more knockouts, or some time), then one balloon floats in right in front
 * and hovers outside the wall with its riders until the player pops it. No
 * Next button: popping it ends the lesson. The wave waits meanwhile.
 */
function balloonLessons(): TutorialStep[] {
  let knockedOut = 0;
  return [
    // No sign: the wave simply plays on for a bit.
    {
      id: 'sling-practice',
      done: (api) => api.toolUses('slingshot') >= knockedOut + TUTORIAL_TIMING.balloonAfterKnockouts,
      start: (api) => {
        knockedOut = api.toolUses('slingshot');
      },
      timeout: TUTORIAL_TIMING.balloonAfterSeconds,
    },
    lessonStep(
      'learn-balloon',
      lesson('A balloon! Pop it before it drops goblins in.', 'target', 'balloon', {
        aimDots: true,
        // On the glass sign, so the balloon in the air stays in view.
        glass: true,
      }),
      (api, since) => api.balloonsPopped() > since,
      (api) => api.balloonsPopped(),
      {
        start: (api) => api.balloonLesson(),
        end: (api) => api.endBalloonLesson(),
        // A balloon that got away (riders picked off) comes back.
        fallbacks: [(api) => api.balloonLesson(), (api) => api.balloonLesson()],
        holdSpawns: true,
        // Watch it burst and the riders fall.
        afterDone: PAUSE_AFTER.finish,
      },
    ),
  ];
}

/** The first wave with balloons (0 based), or -1. */
export function firstBalloonWave(waves: WavePlan[] = TUTORIAL_WAVES): number {
  return waves.findIndex((w) => (w.balloons ?? 0) > 0);
}

const TOOL_NAMES: Record<ToolName, string> = {
  slingshot: 'the slingshot',
  swatter: 'the fly swatter',
  pepper: 'the pepper shaker',
  horn: 'your war horn',
  bell: 'the bell',
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
 *
 * `teach` false is the battle without the tutorial (Skip tutorial): every
 * tool is out from the start (the battle shows them), and only the waves'
 * banners and breathers are left, no lessons and no reach check.
 */
export function buildTutorialSteps(
  tools: ToolName[],
  waves: WavePlan[] = TUTORIAL_WAVES,
  fromWave = 0,
  measureReach = false,
  teach = true,
): TutorialStep[] {
  // A tool that gets lessons: built, and the tutorial is on.
  const has = (tool?: ToolName): tool is ToolName => teach && !!tool && tools.includes(tool);
  const steps: TutorialStep[] = [];
  const waveTitle = (i: number): string => `Wave ${i + 1} of ${waves.length}`;
  // The first hand tool also explains the recharge ring.
  let rechargeTaught = false;
  // The first wave a camp rises in gets its own sign (docs/custom-mode.md section 7).
  const firstRise = risingByWave(waves).findIndex((ids) => ids.length > 0);
  waves.forEach((wave, i) => {
    if (i === 0 && teach) steps.push(...introLessons());
    // A tool taught in the middle of its wave (wave 1's horn): the wave plays on its own first,
    // so the basics are not followed by yet more signs.
    const midWave = has(wave.newTool) && wave.newTool !== 'slingshot' && !!wave.toolMidWave;
    if (wave.newTool === 'slingshot' && has('slingshot')) steps.push(...slingshotLessons());
    else if (has(wave.newTool) && wave.newTool !== 'slingshot' && !midWave) {
      steps.push(toolGrabLesson(wave.newTool, !rechargeTaught, i === 0));
      rechargeTaught = true;
    }
    // The red flag and the compass ring are explained before the first wave, while nothing attacks yet. One sign
    // each, so the arrow points at each on its own and the player notices both (headset test: one sign for two was missed).
    if (i === 0 && teach) {
      steps.push(
        infoStep('health-flag', banner('Red flag: your castle health. Goblins at the wall pull it down.', 'info', 'healthFlag', { header: 'Your castle' })),
        // The compass in two signs (one long sign was missed before): where and how many, then the middle.
        infoStep(
          'compass',
          banner('Your compass: red marks show where goblins come from. Bigger marks, more goblins. The gold needle points ahead.', 'info', 'compass', {
            header: 'Your compass',
          }),
        ),
        infoStep(
          'compass-count',
          banner('Its middle shows the goblins left in this wave. The dots below are the waves.', 'info', 'compass', { header: 'Your compass' }),
        ),
      );
    }
    // A wave whose new tool has a lesson starts straight into that lesson: the
    // lesson's own text guides the player, and it moves on by their action, so
    // there is no banner and no Next button in between.
    const lessonFollows = has(wave.newTool) && !midWave;
    const startWave = (api: TutorialApi): void => api.startWave(i);
    if (lessonFollows) steps.push({ id: `wave-${i + 1}-start`, start: startWave, done: () => true, timeout: 0 });
    else steps.push(infoStep(`wave-${i + 1}-start`, banner(wave.intro, 'warning'), startWave));
    if (wave.newTool === 'slingshot' && has('slingshot')) steps.push(shootLesson(), ...triggerLessons(), ...balloonLessons());
    else if (midWave && wave.newTool && wave.newTool !== 'slingshot') {
      // The wave plays for a while (a few goblins eaten), then the tool comes, in the middle of it.
      let eatenAtStart = 0;
      steps.push({
        id: `wave-${i + 1}-play`,
        start: (api) => {
          eatenAtStart = api.eaten();
        },
        done: (api) => api.eaten() - eatenAtStart >= TUTORIAL_TIMING.hornAfterEaten,
        timeout: TUTORIAL_TIMING.hornAfterSeconds,
        // Only a few goblins between the basics and the tool (headset tests: too many, even at half rate):
        // half the rate, and none at all once hornGoblins are out.
        slowSpawns: true,
        holdSpawnsWhen: (api) => api.spawnedInWave() >= TUTORIAL_TIMING.hornGoblins,
      });
      // A breather before the tool: no new goblins, and the tool comes only once the board is clear
      // (headset test: goblins left over confused the horn lesson). Skip tutorial is the way out.
      steps.push({
        id: `wave-${i + 1}-breather`,
        done: (api) => api.goblinsLeft() === 0,
        timeout: Infinity,
        holdSpawns: true,
      });
      steps.push({ ...toolGrabLesson(wave.newTool, !rechargeTaught, false, true), holdSpawns: true });
      rechargeTaught = true;
      steps.push(toolLesson(wave.newTool));
      // The first time the knights are out: goblins come at them, and the player watches them win.
      if (wave.newTool === 'horn') steps.push(squadFightStep());
    } else if (has(wave.newTool) && wave.newTool !== 'slingshot') steps.push(toolLesson(wave.newTool));
    // The first wave a camp rises in (the tutorial's wave 2): once its lessons are done, what the new camp is and
    // where it shows on the compass. Not earlier: the slingshot is taught by actions only, with no Next button
    // before the first shot. No new goblins while it shows.
    if (teach && i === firstRise) {
      steps.push({
        ...infoStep(
          'camp-rises',
          banner('A new goblin camp rose! Tents on your compass show every camp. A tent glows orange before its goblins come.', 'warning', 'compass', {
            header: 'A new camp!',
          }),
        ),
        holdSpawns: true,
      });
    }
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
  if (measureReach && teach) steps.unshift(reachStep());
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
  return infoStep(id, banner('Well done! Next wave coming.', 'star', undefined, { header: `Wave ${i + 1} cleared!` }), start);
}
