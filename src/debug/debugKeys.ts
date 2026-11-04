// Debug actions, so features can be tested without a mic or a headset.
// Each one runs from a keyboard key (desktop or emulator) and from a button on
// the laptop debug page (https://<dev server>/__debug), which reaches the
// headset live while `npm run dev` runs. The key list is also shown on the
// start page. No Three.js here: vite.config.ts reads this file too.
import { TUTORIAL_WAVES } from '../director/tutorial.js';

export type DebugCommand =
  | 'skipWave'
  | 'skipStep'
  | 'loseCastle'
  | 'damageCastle'
  | 'restartBattle'
  | 'startWave'
  | 'measureReach'
  | 'grunts'
  | 'runners'
  | 'climberFront'
  | 'climberRoad'
  | 'auto'
  | 'clear'
  | 'eatFront'
  | 'place'
  | 'slingShot'
  | 'slingLoad'
  | 'slingGoblin'
  | 'bowlEmpty'
  | 'bowlFill'
  | 'addFood'
  | 'emptyFood'
  | 'showTools'
  | 'swat'
  | 'pepper'
  | 'megaphone'
  | 'bell'
  | 'troops'
  | 'triggersReset'
  | 'triggersFire'
  | 'fps'
  | 'stress'
  | 'resetRun'
  | 'autoTest'
  | 'stopTest'
  | 'spinLeft'
  | 'spinRight'
  | 'boardUp'
  | 'boardDown';

/** Sections of the laptop debug page, in page order. */
export type DebugGroup = 'game' | 'castle' | 'goblins' | 'army' | 'slingshot' | 'food' | 'board' | 'performance';

export const DEBUG_GROUPS: { id: DebugGroup; title: string; icon: string }[] = [
  { id: 'game', title: 'Game and tutorial', icon: '🎮' },
  { id: 'castle', title: 'Castle', icon: '🏰' },
  { id: 'goblins', title: 'Goblins', icon: '👺' },
  { id: 'army', title: 'Troops and triggers', icon: '⚔️' },
  { id: 'slingshot', title: 'Slingshot', icon: '🪨' },
  { id: 'food', title: 'Food and food tools', icon: '🍗' },
  { id: 'board', title: 'Board', icon: '🧭' },
  { id: 'performance', title: 'Performance', icon: '📈' },
];

export interface DebugAction {
  id: DebugCommand;
  group: DebugGroup;
  /** Emoji shown on the debug page button. */
  icon: string;
  /** Keyboard key code, if the action has a single press key. */
  code?: string;
  /** Short name for buttons and the key list. */
  label: string;
  does: string;
  /** One button per value (debug page only, no key), sent along with the action. */
  args?: number[];
}

export const DEBUG_ACTIONS: DebugAction[] = [
  { id: 'restartBattle', group: 'game', icon: '🔄', code: 'KeyA', label: 'Restart game', does: 'Start the whole tutorial again from the first lesson, and make Play start there again' },
  {
    id: 'startWave',
    group: 'game',
    icon: '🚩',
    label: 'Start at wave',
    does: 'Start the battle at this wave, with the earlier tools already out and a little more food. Play and Play again then start here too, until Restart game (kept across reloads in this tab)',
    args: TUTORIAL_WAVES.map((_, i) => i + 1),
  },
  {
    id: 'measureReach',
    group: 'game',
    icon: '📏',
    label: 'Measure reach again',
    does: 'Forget the saved reach (the board goes back to its normal size) and start the battle with the reach check ("Show me how big you are, giant!"), then the wave Play starts at',
  },
  { id: 'skipStep', group: 'game', icon: '⏭️', code: 'KeyS', label: 'Skip step', does: 'Skip the current tutorial step (lesson, banner or wave)' },
  { id: 'skipWave', group: 'game', icon: '⏩', code: 'KeyW', label: 'Skip wave', does: 'Skip the current wave: its goblins run off and the wave flag climbs' },
  { id: 'damageCastle', group: 'castle', icon: '💥', code: 'KeyD', label: 'Damage castle', does: 'Damage the castle by 20 (the red flag slides down)' },
  { id: 'loseCastle', group: 'castle', icon: '🏳️', code: 'KeyH', label: 'Lose castle', does: 'The castle falls right away (lose panel)' },
  { id: 'grunts', group: 'goblins', icon: '👹', code: 'KeyG', label: 'Grunts', does: 'Send a group of grunts' },
  { id: 'runners', group: 'goblins', icon: '💨', code: 'KeyR', label: 'Runners', does: 'Send a group of runners' },
  { id: 'climberFront', group: 'goblins', icon: '🧗', code: 'KeyC', label: 'Climber in front', does: 'A climber pops up right in front of you' },
  { id: 'climberRoad', group: 'goblins', icon: '🛤️', code: 'KeyV', label: 'Climber on a road', does: 'A climber walks in on a random road' },
  { id: 'eatFront', group: 'goblins', icon: '😋', code: 'KeyB', label: 'Eat front goblin', does: 'Eat the goblin nearest the front of the wall' },
  { id: 'auto', group: 'goblins', icon: '🔁', code: 'KeyT', label: 'Auto spawn on/off', does: 'Extra auto spawning on or off (on top of the waves)' },
  { id: 'clear', group: 'goblins', icon: '🧹', code: 'KeyK', label: 'Remove all', does: 'Remove all goblins' },
  { id: 'slingShot', group: 'slingshot', icon: '🎯', code: 'KeyL', label: 'Shoot', does: 'Slingshot: shoot a pebble (from the pouch or the bowl) at the goblin nearest the front' },
  { id: 'slingLoad', group: 'slingshot', icon: '🪨', code: 'KeyO', label: 'Load pebble', does: 'Put a pebble in the slingshot pouch' },
  { id: 'slingGoblin', group: 'slingshot', icon: '👺', code: 'KeyJ', label: 'Load goblin', does: 'Put the goblin nearest the castle in the slingshot pouch (then L shoots it)' },
  { id: 'bowlEmpty', group: 'slingshot', icon: '🥣', code: 'KeyU', label: 'Empty bowl', does: 'Empty the pebble bowl (the bowl shows Locked until it refills)' },
  { id: 'bowlFill', group: 'slingshot', icon: '🫙', code: 'KeyI', label: 'Fill bowl', does: 'Fill the pebble bowl' },
  { id: 'addFood', group: 'food', icon: '➕', code: 'KeyY', label: 'Add food', does: 'Add 3 food to the jar (it stops at 10)' },
  { id: 'emptyFood', group: 'food', icon: '➖', code: 'Digit0', label: 'Empty food', does: 'Empty the food jar (the swatter and pepper show Locked)' },
  { id: 'showTools', group: 'food', icon: '🧰', code: 'Digit1', label: 'Show food tools', does: 'The fly swatter, pepper shaker, megaphone and bell pop onto their platforms now (normally in waves 3 and 4)' },
  { id: 'swat', group: 'food', icon: '🪰', code: 'Digit2', label: 'Swat front', does: 'Fly swatter: swat the goblins at the front of the wall (the first swat costs 4 food, then 10 s of swatting)' },
  { id: 'pepper', group: 'food', icon: '🌶️', code: 'Digit3', label: 'Pepper front', does: 'Pepper shaker: pepper the goblins at the front of the wall (the first shake costs 3 food, then 8 s). Peppered goblins give 2 food' },
  { id: 'megaphone', group: 'food', icon: '📣', code: 'Digit4', label: 'Megaphone scream', does: 'Megaphone: a scream without a mic, every goblin is stunned (costs 6 food, works even when it is tied down)' },
  { id: 'bell', group: 'food', icon: '🔔', code: 'Digit5', label: 'Ring bell', does: 'Bell: a hard ring without hands, every goblin is stunned (costs 6 food)' },
  { id: 'troops', group: 'army', icon: '🛡️', code: 'Digit6', label: 'Send squad', does: 'A squad of soldiers marches out now toward a camp (normally every 10 s while a wave runs)' },
  { id: 'triggersReset', group: 'army', icon: '🛢️', code: 'Digit7', label: 'Reset triggers', does: 'Every trigger (keg, boulder, tree) stands ready now, even before its wave' },
  { id: 'triggersFire', group: 'army', icon: '💣', code: 'Digit8', label: 'Set off triggers', does: 'Set off every trigger standing now (keg blast, boulder roll, tree fall)' },
  { id: 'spinLeft', group: 'board', icon: '↩️', label: 'Spin left', does: 'Turn the board left one step' },
  { id: 'spinRight', group: 'board', icon: '↪️', label: 'Spin right', does: 'Turn the board right one step' },
  { id: 'boardUp', group: 'board', icon: '⬆️', label: 'Board up', does: 'Raise the board one step' },
  { id: 'boardDown', group: 'board', icon: '⬇️', label: 'Board down', does: 'Lower the board one step' },
  { id: 'place', group: 'board', icon: '📍', code: 'KeyP', label: 'Place again', does: 'Place the board again in front of you' },
  { id: 'fps', group: 'performance', icon: '🖥️', code: 'KeyF', label: 'FPS panel on/off', does: 'FPS panel on or off (hidden by default; add ?fps to the URL on the hosted build)' },
  { id: 'resetRun', group: 'performance', icon: '⏱️', code: 'KeyN', label: 'New measured run', does: 'Start a new measured run (average FPS, 1% low, missed frames)' },
  { id: 'stress', group: 'performance', icon: '🏋️', code: 'KeyM', label: 'Stress +10', does: 'Stress test: add 10 grunts, above the normal unit cap (starts a new measured run)' },
  { id: 'autoTest', group: 'performance', icon: '▶️', label: 'Run stress test', does: 'Automatic stress test: stops the battle, adds grunts step by step until FPS fails, then clears the board' },
  { id: 'stopTest', group: 'performance', icon: '⏹️', label: 'Stop stress test', does: 'Stop the automatic stress test and clear the board' },
];

/** The key list for the start page (single press actions plus the hold keys). */
export const DEBUG_KEYS: { key: string; does: string }[] = [
  ...DEBUG_ACTIONS.filter((a) => a.code).map((a) => ({ key: a.code!.replace('Key', '').replace('Digit', ''), does: a.does })),
  { key: 'Q / E', does: 'Turn the board left / right (hold)' },
  { key: 'Z / X', does: 'Board down / up (hold)' },
  { key: 'Mouse', does: 'Drag to look around, scroll to zoom (browser only)' },
  { key: 'Laptop', does: 'Open /__debug on the dev server for buttons that reach the headset live' },
];

/** Event name for debug commands sent over the dev server's WebSocket. */
export const DEBUG_EVENT = 'tall-tale:debug';

/** Event name for measured run numbers sent from the game to the debug page. */
export const RUN_STATS_EVENT = 'tall-tale:run-stats';

/** One measured run: what the FPS panel shows, also sent to the laptop debug page. */
export interface RunStats {
  /** Id of the game page that measured it, so two open pages never mix. */
  page: string;
  /** 'headset' or 'laptop' (by host: the emulator, which fakes a Quest, only runs on localhost). */
  device: string;
  /** Frame rate this page aims for (the XR session's real rate in VR). */
  targetFps: number;
  units: number;
  /** Measured time, after the warm-up (seconds). */
  seconds: number;
  avgFps: number;
  /** Average of the slowest 1% of frames, as FPS, counted in whole display beats (ignores clock wobble). */
  lowFps: number;
  /** The same from the raw page clock, for information only. */
  rawLowFps: number;
  /** Share of frames over the missed limit (percent). */
  missedPct: number;
  missed: number;
  slowestMs: number;
  /** What came before each missed frame: mark name to count ("nothing marked" if none). */
  causes: Record<string, number>;
  /** True when the run just ended (a reset), false for a live update. */
  final: boolean;
}

/** Event name for each game page checking in with the debug page every few seconds. */
export const HEARTBEAT_EVENT = 'tall-tale:heartbeat';

export interface PageInfo {
  page: string;
  device: string;
  /** In a VR session right now. */
  immersive: boolean;
  paused: boolean;
  liveFps: number;
  targetFps: number;
  units: number;
  testing: boolean;
  /** The tutorial step the page is on ("stopped" before Play). */
  step: string;
  /** The wave (1 based) Play starts at. */
  playFrom: number;
}

/** A debug command as it comes in from a key or the debug page. */
export interface DebugRequest {
  id: DebugCommand;
  arg?: number;
}

/** Event name for the automatic stress test's progress, sent from the game to the debug page. */
export const STRESS_TEST_EVENT = 'tall-tale:stress-test';

export interface StressStep {
  /** The first step: the empty board, to see the hitches the scene has without goblins. */
  baseline: boolean;
  units: number;
  avgFps: number;
  lowFps: number;
  rawLowFps: number;
  missedPct: number;
  missed: number;
  slowestMs: number;
  /** What came before each missed frame (see RunStats.causes). */
  causes: Record<string, number>;
  pass: boolean;
}

export interface StressTestReport {
  page: string;
  device: string;
  state: 'running' | 'done';
  /** What is happening now, or why the test stopped. */
  note: string;
  steps: StressStep[];
  /** Units of the last passing step, or null if none passed. */
  budget: number | null;
  /** The pass rule, for the result text. */
  rule: { minAvgFps: number; minLowFps: number; maxMissedPct: number; measureSeconds: number; targetFps: number };
}
