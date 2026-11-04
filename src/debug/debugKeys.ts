// Debug actions, so features can be tested without a mic or a headset.
// Each one runs from a keyboard key (desktop or emulator) and from a button on
// the laptop debug page (https://<dev server>/__debug), which reaches the
// headset live while `npm run dev` runs. The key list is also shown on the
// start page. No Three.js here: vite.config.ts reads this file too.

export type DebugCommand =
  | 'skipWave'
  | 'skipStep'
  | 'loseCastle'
  | 'damageCastle'
  | 'restartBattle'
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
  | 'fps'
  | 'stress'
  | 'resetRun'
  | 'autoTest'
  | 'stopTest'
  | 'spinLeft'
  | 'spinRight'
  | 'boardUp'
  | 'boardDown';

export interface DebugAction {
  id: DebugCommand;
  /** Keyboard key code, if the action has a single press key. */
  code?: string;
  /** Short name for buttons and the key list. */
  label: string;
  does: string;
}

export const DEBUG_ACTIONS: DebugAction[] = [
  { id: 'skipWave', code: 'KeyW', label: 'Skip wave', does: 'Skip the current wave: its goblins run off and the wave flag climbs' },
  { id: 'skipStep', code: 'KeyS', label: 'Skip tutorial step', does: 'Skip the current tutorial step (lesson, banner or wave)' },
  { id: 'loseCastle', code: 'KeyH', label: 'Lose castle', does: 'The castle falls right away (lose panel)' },
  { id: 'damageCastle', code: 'KeyD', label: 'Damage castle', does: 'Damage the castle by 20 (the red flag slides down)' },
  { id: 'restartBattle', code: 'KeyA', label: 'Restart battle', does: 'Start the tutorial battle again from wave 1 (same as the panel button)' },
  { id: 'grunts', code: 'KeyG', label: 'Grunts', does: 'Send a group of grunts' },
  { id: 'runners', code: 'KeyR', label: 'Runners', does: 'Send a group of runners' },
  { id: 'climberFront', code: 'KeyC', label: 'Climber in front', does: 'A climber pops up right in front of you' },
  { id: 'climberRoad', code: 'KeyV', label: 'Climber on a road', does: 'A climber walks in on a random road' },
  { id: 'auto', code: 'KeyT', label: 'Auto spawn on/off', does: 'Extra auto spawning on or off (on top of the waves)' },
  { id: 'clear', code: 'KeyK', label: 'Remove all goblins', does: 'Remove all goblins' },
  { id: 'eatFront', code: 'KeyB', label: 'Eat front goblin', does: 'Eat the goblin nearest the front of the wall' },
  { id: 'place', code: 'KeyP', label: 'Place board again', does: 'Place the board again in front of you' },
  { id: 'slingShot', code: 'KeyL', label: 'Slingshot shot', does: 'Slingshot: shoot a pebble (from the pouch or the bowl) at the goblin nearest the front' },
  { id: 'slingLoad', code: 'KeyO', label: 'Load slingshot', does: 'Put a pebble in the slingshot pouch' },
  { id: 'slingGoblin', code: 'KeyJ', label: 'Goblin in slingshot', does: 'Put the goblin nearest the castle in the slingshot pouch (then L shoots it)' },
  { id: 'bowlEmpty', code: 'KeyU', label: 'Empty bowl', does: 'Empty the pebble bowl (the bowl shows Locked until it refills)' },
  { id: 'bowlFill', code: 'KeyI', label: 'Fill bowl', does: 'Fill the pebble bowl' },
  { id: 'fps', code: 'KeyF', label: 'FPS on/off', does: 'FPS counter on or off (add ?fps to the URL on the hosted build)' },
  { id: 'stress', code: 'KeyM', label: 'Stress +10', does: 'Stress test: add 10 grunts, above the normal unit cap (starts a new measured run)' },
  { id: 'resetRun', code: 'KeyN', label: 'New measured run', does: 'Start a new measured run (average FPS, 1% low, missed frames)' },
  { id: 'autoTest', label: 'Run stress test', does: 'Automatic stress test: stops the battle, adds grunts step by step until FPS fails, then clears the board' },
  { id: 'stopTest', label: 'Stop stress test', does: 'Stop the automatic stress test and clear the board' },
  { id: 'spinLeft', label: 'Spin left', does: 'Turn the board left one step' },
  { id: 'spinRight', label: 'Spin right', does: 'Turn the board right one step' },
  { id: 'boardUp', label: 'Board up', does: 'Raise the board one step' },
  { id: 'boardDown', label: 'Board down', does: 'Lower the board one step' },
];

/** The key list for the start page (single press actions plus the hold keys). */
export const DEBUG_KEYS: { key: string; does: string }[] = [
  ...DEBUG_ACTIONS.filter((a) => a.code).map((a) => ({ key: a.code!.replace('Key', ''), does: a.does })),
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
