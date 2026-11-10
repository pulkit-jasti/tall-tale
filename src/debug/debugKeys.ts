// Debug actions, so features can be tested without a mic or a headset.
// Each one runs from a keyboard key (desktop or emulator) and from a button on
// the laptop debug page (https://<dev server>/__debug), which reaches the
// headset live while `npm run dev` runs. The key list is also shown on the
// start page. No Three.js here: vite.config.ts reads this file too.
import { TUTORIAL_WAVES } from '../director/tutorial.js';

export type DebugCommand =
  | 'skipWave'
  | 'skipStep'
  | 'pause'
  | 'pauseAction'
  | 'giantToggle'
  | 'triggerLesson'
  | 'loseCastle'
  | 'damageCastle'
  | 'restartBattle'
  | 'startWave'
  | 'measureReach'
  | 'grunts'
  | 'runners'
  | 'climberFront'
  | 'auto'
  | 'clear'
  | 'eatFront'
  | 'place'
  | 'slingShot'
  | 'slingLoad'
  | 'slingGoblin'
  | 'bowlEmpty'
  | 'bowlFill'
  | 'rechargeTools'
  | 'drainTools'
  | 'eatRefill'
  | 'showTools'
  | 'swat'
  | 'pepper'
  | 'horn'
  | 'bell'
  | 'troops'
  | 'troopsToggle'
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
  | 'boardDown'
  | 'balloonFront'
  | 'popBalloons'
  | 'helmetGrunts'
  | 'armoredGrunts'
  | 'celebrate'
  | 'nextTime'
  | 'timeOfDay';

/** Sections of the laptop debug page, in page order. */
export type DebugGroup = 'game' | 'castle' | 'goblins' | 'army' | 'slingshot' | 'food' | 'board' | 'sky' | 'performance';

export const DEBUG_GROUPS: { id: DebugGroup; title: string; icon: string }[] = [
  { id: 'game', title: 'Game and tutorial', icon: '🎮' },
  { id: 'castle', title: 'Castle', icon: '🏰' },
  { id: 'goblins', title: 'Goblins', icon: '👺' },
  { id: 'army', title: 'Troops and triggers', icon: '⚔️' },
  { id: 'slingshot', title: 'Slingshot', icon: '🪨' },
  { id: 'food', title: 'Hand tools', icon: '🧰' },
  { id: 'board', title: 'Board', icon: '🧭' },
  { id: 'sky', title: 'Day and night', icon: '🌗' },
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
    does: 'Start the battle at this wave, with the earlier tools already out. Play and Play again then start here too, until Restart game (kept across reloads in this tab)',
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
  { id: 'pause', group: 'game', icon: '⏸️', code: 'Space', label: 'Pause / resume', does: 'Pause the battle (like the pause button) or resume it' },
  {
    id: 'pauseAction',
    group: 'game',
    icon: '🔘',
    label: 'Pause panel button',
    does: 'While paused, poke a pause panel button: 1 Resume, 2 Reset table, 3 Measure reach, 4 Restart',
    args: [1, 2, 3, 4],
  },
  { id: 'skipWave', group: 'game', icon: '⏩', code: 'KeyW', label: 'Skip wave', does: 'Skip the current wave: its goblins run off and the wave flag climbs' },
  { id: 'celebrate', group: 'castle', icon: '🎉', code: 'Semicolon', label: 'Celebrate', does: 'Show the wave cleared celebration now (confetti over the castle, soldiers cheer)' },
  { id: 'damageCastle', group: 'castle', icon: '💥', code: 'KeyD', label: 'Damage castle', does: 'Damage the castle by 20 (the red flag slides down)' },
  { id: 'loseCastle', group: 'castle', icon: '🏳️', code: 'KeyH', label: 'Lose castle', does: 'The castle falls right away (lose panel)' },
  { id: 'grunts', group: 'goblins', icon: '👹', code: 'KeyG', label: 'Grunts', does: 'Send a group of grunts' },
  { id: 'runners', group: 'goblins', icon: '💨', code: 'KeyR', label: 'Runners', does: 'Send a group of runners' },
  { id: 'climberFront', group: 'goblins', icon: '🧗', code: 'KeyC', label: 'Climber in front', does: 'A bare handed grunt climbs the wall right in front of you (every goblin climbs now: bash, climb, rampart, courtyard)' },
  { id: 'eatFront', group: 'goblins', icon: '😋', code: 'KeyB', label: 'Eat front goblin', does: 'Eat the goblin nearest the front of the wall' },
  { id: 'balloonFront', group: 'goblins', icon: '🎈', code: 'Comma', label: 'Balloon in front', does: 'A balloon with two riders floats in right in front of you (pop it with the slingshot, or it drops them into the courtyard)' },
  { id: 'popBalloons', group: 'goblins', icon: '💥', code: 'Period', label: 'Pop balloons', does: 'Pop every balloon in the air: the riders fall and poof' },
  { id: 'helmetGrunts', group: 'goblins', icon: '⛑️', code: 'Slash', label: 'Helmet grunts', does: 'Send a group of grunts that all wear helmets (one extra hit from anything but a trigger, the helmet flies off)' },
  { id: 'armoredGrunts', group: 'goblins', icon: '🛡️', code: 'Backslash', label: 'Armored grunts', does: 'Send a group of grunts with helmet, shield and sword (3 hits each: helmet off, then shield off, then out)' },
  { id: 'auto', group: 'goblins', icon: '🔁', code: 'KeyT', label: 'Auto spawn on/off', does: 'Extra auto spawning on or off (on top of the waves)' },
  { id: 'clear', group: 'goblins', icon: '🧹', code: 'KeyK', label: 'Remove all', does: 'Remove all goblins' },
  { id: 'slingShot', group: 'slingshot', icon: '🎯', code: 'KeyL', label: 'Shoot', does: 'Slingshot: shoot a pebble (from the pouch or the bowl) at the goblin nearest the front' },
  { id: 'slingLoad', group: 'slingshot', icon: '🪨', code: 'KeyO', label: 'Load pebble', does: 'Put a pebble in the slingshot pouch' },
  { id: 'slingGoblin', group: 'slingshot', icon: '👺', code: 'KeyJ', label: 'Load goblin', does: 'Put the goblin nearest the castle in the slingshot pouch (then L shoots it)' },
  { id: 'bowlEmpty', group: 'slingshot', icon: '🥣', code: 'KeyU', label: 'Empty bowl', does: 'Empty the pebble bowl (the bowl shows Locked until it refills)' },
  { id: 'bowlFill', group: 'slingshot', icon: '🫙', code: 'KeyI', label: 'Fill bowl', does: 'Fill the pebble bowl' },
  { id: 'rechargeTools', group: 'food', icon: '🔋', code: 'KeyY', label: 'Recharge tools', does: 'Every tool is ready at once (its recharge ring full)' },
  { id: 'drainTools', group: 'food', icon: '🪫', code: 'Digit0', label: 'Drain tools', does: 'Every tool that is out ends its use and recharges from empty (dimmed, the ring on its platform filling)' },
  { id: 'eatRefill', group: 'food', icon: '😋', code: 'KeyV', label: 'Eat refill', does: 'What eating one goblin does: every recharging ring jumps forward 10% of its full recharge' },
  { id: 'showTools', group: 'food', icon: '🧰', code: 'Digit1', label: 'Show tools', does: 'The horn, fly swatter, pepper shaker and bell pop onto their platforms now (normally in waves 1, 3, 4 and 5)' },
  { id: 'swat', group: 'food', icon: '🪰', code: 'Digit2', label: 'Swat front', does: 'Fly swatter: swat the goblins at the front of the wall (starts its 10 s use, then a 20 s recharge)' },
  { id: 'pepper', group: 'food', icon: '🌶️', code: 'Digit3', label: 'Pepper front', does: 'Pepper shaker: pepper the goblins at the front of the wall (8 s use, 20 s recharge). Peppered goblins drop all their gear and sneeze for 5 s' },
  { id: 'horn', group: 'food', icon: '📯', code: 'Digit4', label: 'Blow horn', does: 'Horn: it sounds without hands or a mic and the field knights charge down the road in front of you (30 s recharge)' },
  { id: 'bell', group: 'food', icon: '🔔', code: 'Digit5', label: 'Ring bell', does: 'Bell: a hard ring without hands: every goblin is stunned and the ones on the rampart are knocked back down outside the wall (35 s recharge)' },
  { id: 'troops', group: 'army', icon: '🛡️', code: 'Digit6', label: 'Send squad', does: 'A squad of soldiers marches out now toward a camp (normally every 10 s while a wave runs)' },
  { id: 'troopsToggle', group: 'army', icon: '🚫', code: 'Digit9', label: 'Troops on/off', does: 'Troops on or off for testing: off, no squads come out and the ones out go home (Send squad turns them back on)' },
  {
    id: 'triggerLesson',
    group: 'army',
    icon: '🛢️',
    label: 'Trigger lesson group',
    does: 'A small group of grunts walks to the powder keg nearest the front and waits beside it until it is set off (what the wave 2 keg lesson does)',
  },
  { id: 'triggersReset', group: 'army', icon: '🛢️', code: 'Digit7', label: 'Reset triggers', does: 'Every trigger (keg, boulder, tree) stands ready now, even before its wave' },
  { id: 'triggersFire', group: 'army', icon: '💣', code: 'Digit8', label: 'Set off triggers', does: 'Set off every trigger standing now (keg blast, boulder roll, tree fall)' },
  { id: 'spinLeft', group: 'board', icon: '↩️', label: 'Spin left', does: 'Turn the board left one step' },
  { id: 'spinRight', group: 'board', icon: '↪️', label: 'Spin right', does: 'Turn the board right one step' },
  { id: 'boardUp', group: 'board', icon: '⬆️', label: 'Board up', does: 'Raise the board one step' },
  { id: 'boardDown', group: 'board', icon: '⬇️', label: 'Board down', does: 'Lower the board one step' },
  { id: 'giantToggle', group: 'board', icon: '🧍', label: 'Giant body on/off', does: 'Show or hide the giant body under the head (the seat floor stays)' },
  { id: 'place', group: 'board', icon: '📍', code: 'KeyP', label: 'Place again', does: 'Place the board again in front of you' },
  {
    id: 'nextTime',
    group: 'sky',
    icon: '🌗',
    code: 'BracketRight',
    label: 'Next time of day',
    does: 'Change to the next time of day (morning, day, sunset, night), the same 8 s change as between waves. Kept until the next battle starts',
  },
  {
    id: 'timeOfDay',
    group: 'sky',
    icon: '🕰️',
    label: 'Time of day',
    does: 'Change to this time of day: 1 morning, 2 day, 3 sunset, 4 night (the same change as between waves). Kept until the next battle starts',
    args: [1, 2, 3, 4],
  },
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
  /** Mic state, and the loudest level read since the last check in (only read while the megaphone is held). */
  mic: string;
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
