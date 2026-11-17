// Debug actions, so features can be tested without a mic or a headset. Each
// one is a button on the laptop debug page (https://<dev server>/__debug),
// which reaches every open game page (the headset too) live while
// `npm run dev` runs. No keyboard keys (the headset has none, and the page
// does everything). No Three.js here: vite.config.ts reads this file too.
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
  | 'skipTutorial'
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
  | 'slingFire'
  | 'slingKeg'
  | 'spicyLure'
  | 'chickensFront'
  | 'trophiesAll'
  | 'trophiesForget'
  | 'bowlEmpty'
  | 'bowlFill'
  | 'rechargeTools'
  | 'drainTools'
  | 'eatRefill'
  | 'nearHead'
  | 'showTools'
  | 'swat'
  | 'pepper'
  | 'horn'
  | 'drum'
  | 'pepperRing'
  | 'magnet'
  | 'sugar'
  | 'garden'
  | 'newTools'
  | 'newTraps'
  | 'troops'
  | 'troopsToggle'
  | 'thinGarrison'
  | 'triggersReset'
  | 'triggersFire'
  | 'fps'
  | 'micPanel'
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
  | 'diggerFront'
  | 'shamanGroup'
  | 'bomberGroup'
  | 'archerGroup'
  | 'celebrate'
  | 'nextTime'
  | 'timeOfDay'
  | 'nightFog'
  | 'openMenu'
  | 'openCustom'
  | 'fightCustom'
  | 'startEndless'
  | 'endlessCards'
  | 'endlessTools'
  | 'resetCustom'
  | 'resetSave'
  | 'unlockAll'
  | 'winBattle'
  | 'fightLevel';

/** Sections of the laptop debug page, in page order. */
export type DebugGroup = 'game' | 'menu' | 'castle' | 'goblins' | 'army' | 'slingshot' | 'food' | 'board' | 'sky' | 'performance';

export const DEBUG_GROUPS: { id: DebugGroup; title: string; icon: string }[] = [
  { id: 'game', title: 'Game and tutorial', icon: '🎮' },
  { id: 'menu', title: 'Menus and campaign', icon: '📜' },
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
  /** Short name for the button. */
  label: string;
  does: string;
  /** One button per value, sent along with the action. */
  args?: number[];
}

export const DEBUG_ACTIONS: DebugAction[] = [
  { id: 'restartBattle', group: 'game', icon: '🔄', label: 'Restart game', does: 'Start the whole tutorial again from the first lesson, and make Play start there again' },
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
  { id: 'skipStep', group: 'game', icon: '⏭️', label: 'Skip step', does: 'Skip the current tutorial step (lesson, banner or wave)' },
  {
    id: 'skipTutorial',
    group: 'game',
    icon: '⏩',
    label: 'Skip tutorial',
    does: 'Start a new battle without the tutorial: wave 1, every tool out, no lessons (Skip tutorial on the welcome and pause panels now goes to the menu instead)',
  },
  { id: 'pause', group: 'game', icon: '⏸️', label: 'Pause / resume', does: 'Pause the battle (like the pause button) or resume it' },
  {
    id: 'pauseAction',
    group: 'game',
    icon: '🔘',
    label: 'Pause panel button',
    does: 'While paused, poke a pause panel button: 1 Resume, 2 Reset table, 3 Measure reach, 4 Restart',
    args: [1, 2, 3, 4],
  },
  { id: 'skipWave', group: 'game', icon: '⏩', label: 'Skip wave', does: 'Skip the current wave: its goblins run off and the wave flag climbs' },
  { id: 'openMenu', group: 'menu', icon: '📜', label: 'Open menu', does: 'The battleground sinks and the main menu rises (the shelves and the loadout stand too)' },
  {
    id: 'fightLevel',
    group: 'menu',
    icon: '⚔️',
    label: 'Fight level',
    does: 'Start this campaign level (the normal battle with the saved loadout), like its Fight button. Works for locked levels too',
    args: [1, 2, 3, 4, 5, 6],
  },
  { id: 'winBattle', group: 'menu', icon: '🏆', label: 'Win battle', does: 'Win the battle now, with the castle health as it is (a campaign level saves its stars)' },
  { id: 'unlockAll', group: 'menu', icon: '🔓', label: 'Unlock all tools', does: 'Flip the "Unlock all tools" setting (the drum can be put on the loadout stand)' },
  { id: 'openCustom', group: 'menu', icon: '🛠️', label: 'Open Custom Game', does: 'Go to the Custom Game page (the empty state, or the list of saved levels). A save writes the level summary as a debug note' },
  { id: 'fightCustom', group: 'menu', icon: '⚔️', label: 'Fight newest custom level', does: 'From the menu: load the newest saved Custom Game level\'s map and play its waves (a debug note says how long the map took)' },
  { id: 'startEndless', group: 'menu', icon: '♾️', label: 'Start Endless', does: 'From the menu: a new Endless run on a fresh random map with the loadout as it is (a debug note gives its seed)' },
  { id: 'endlessCards', group: 'menu', icon: '🃏', label: 'Endless: show cards', does: 'In an Endless run: show the boost card pick now (pick one, or wait 10 s)' },
  { id: 'endlessTools', group: 'menu', icon: '🧰', label: 'Endless: show new tools', does: 'In an Endless run: show the new tool pick now (every tool not on the stand); a pick goes on a platform behind you' },
  { id: 'resetCustom', group: 'menu', icon: '🗑️', label: 'Forget custom levels', does: 'Delete every saved Custom Game level (the page shows the empty state again)' },
  { id: 'trophiesAll', group: 'menu', icon: '🏅', label: 'Earn all trophies', does: 'Mark all 16 achievements as earned (the 8 secret abilities and the 8 regular ones): the shelf lights every trophy and shows what each does' },
  { id: 'trophiesForget', group: 'menu', icon: '❓', label: 'Forget trophies', does: 'Forget every earned achievement (the shelf shows the riddles and goals again; they can be earned again in a real battle)' },
  { id: 'resetSave', group: 'menu', icon: '🧹', label: 'Forget progress', does: 'Forget the saved tutorial, stars, open levels, unlocks and loadout (the next start shows the welcome panel)' },
  { id: 'celebrate', group: 'castle', icon: '🎉', label: 'Celebrate', does: 'Show the wave cleared celebration now (confetti over the castle, soldiers cheer)' },
  { id: 'damageCastle', group: 'castle', icon: '💥', label: 'Damage castle', does: 'Damage the castle by 20 (the red flag slides down)' },
  { id: 'loseCastle', group: 'castle', icon: '🏳️', label: 'Lose castle', does: 'The castle falls right away (lose panel)' },
  { id: 'grunts', group: 'goblins', icon: '👹', label: 'Grunts', does: 'Send a group of grunts' },
  { id: 'runners', group: 'goblins', icon: '💨', label: 'Runners', does: 'Send a group of runners' },
  { id: 'climberFront', group: 'goblins', icon: '🧗', label: 'Climber in front', does: 'A bare handed grunt climbs the wall right in front of you (every goblin climbs now: bash, climb, rampart, courtyard)' },
  { id: 'eatFront', group: 'goblins', icon: '😋', label: 'Eat front goblin', does: 'Eat the goblin nearest the front of the wall' },
  { id: 'balloonFront', group: 'goblins', icon: '🎈', label: 'Balloon in front', does: 'A balloon with two riders floats in right in front of you (pop it with the slingshot, or it drops them into the courtyard)' },
  { id: 'popBalloons', group: 'goblins', icon: '💥', label: 'Pop balloons', does: 'Pop every balloon in the air: the riders fall and poof' },
  { id: 'helmetGrunts', group: 'goblins', icon: '⛑️', label: 'Helmet grunts', does: 'Send a group of grunts that all wear helmets (one extra hit from anything but a trigger, the helmet flies off)' },
  { id: 'armoredGrunts', group: 'goblins', icon: '🛡️', label: 'Armored grunts', does: 'Send a group of grunts with helmet, shield and sword (3 hits each: helmet off, then shield off, then out)' },
  { id: 'diggerFront', group: 'goblins', icon: '⛏️', label: 'Digger in front', does: 'Phase 3: a digger tunnels in from the camp nearest your front (unseen, a dirt mound for its last 2.5 s). Pepper the front segment first and it comes up sneezing outside the wall' },
  { id: 'shamanGroup', group: 'goblins', icon: '🏮', label: 'Shaman group', does: 'Phase 3: armored grunts with a shaman at the back, from the camp nearest your front. Strip them (magnet, pebbles): the shaman gives helmets and shields back' },
  { id: 'bomberGroup', group: 'goblins', icon: '🧨', label: 'Bomber group', does: 'Phase 3: grunts with a bomber among them, from the camp nearest your front. Hit it on the road: it blows up its group. At the wall: a 1.5 s fuse, pinch and toss it' },
  { id: 'archerGroup', group: 'goblins', icon: '🏹', label: 'Goblin archers', does: 'Phase 3: three goblin archers from the camp nearest your front. They stop about 105 cm out and shoot the wall garrison; with the garrison gone they walk in' },
  { id: 'auto', group: 'goblins', icon: '🔁', label: 'Auto spawn on/off', does: 'Extra auto spawning on or off (on top of the waves)' },
  { id: 'clear', group: 'goblins', icon: '🧹', label: 'Remove all', does: 'Remove all goblins' },
  { id: 'slingShot', group: 'slingshot', icon: '🎯', label: 'Shoot', does: 'Slingshot: shoot a pebble (from the pouch or the bowl) at the goblin nearest the front' },
  { id: 'slingLoad', group: 'slingshot', icon: '🪨', label: 'Load pebble', does: 'Put a pebble in the slingshot pouch' },
  { id: 'slingGoblin', group: 'slingshot', icon: '👺', label: 'Load goblin', does: 'Put the goblin nearest the castle in the slingshot pouch (then L shoots it)' },
  { id: 'slingFire', group: 'slingshot', icon: '🔥', label: 'Load fire pebble', does: 'Night Owl (v3 2.6): a burning pebble in the pouch, as if held in the torch (it burns out in 5 s; Shoot fires it, it lights kegs and haystacks)' },
  { id: 'slingKeg', group: 'slingshot', icon: '🛢️', label: 'Load flying keg', does: 'Package Deal (v3 2.6): a keg in the pouch, as if pulled in by the magnet (Shoot fires it: a big blast where it lands)' },
  { id: 'bowlEmpty', group: 'slingshot', icon: '🥣', label: 'Empty bowl', does: 'Empty the pebble bowl (the bowl shows Locked until it refills)' },
  { id: 'bowlFill', group: 'slingshot', icon: '🫙', label: 'Fill bowl', does: 'Fill the pebble bowl' },
  { id: 'rechargeTools', group: 'food', icon: '🔋', label: 'Recharge tools', does: 'Every tool is ready at once (its recharge ring full)' },
  { id: 'drainTools', group: 'food', icon: '🪫', label: 'Drain tools', does: 'Every tool that is out ends its use and recharges from empty (dimmed, the ring on its platform filling)' },
  {
    id: 'nearHead',
    group: 'performance',
    icon: '🔍',
    label: 'What is near my head?',
    does: 'Press while a strange object floats in front of you: a note lists every visible mesh within 40 cm of the eyes (its path, size, color, on top or not)',
  },
  { id: 'eatRefill', group: 'food', icon: '😋', label: 'Eat heal', does: 'What eating one goblin does (v3 2.5): the castle heals 2% and the red flag rises a notch' },
  { id: 'showTools', group: 'food', icon: '🧰', label: 'Show tools', does: 'The horn, fly swatter, pepper shaker and drum pop onto their platforms now (normally in waves 1, 3, 4 and 5)' },
  { id: 'swat', group: 'food', icon: '🪰', label: 'Swat front', does: 'Fly swatter: swat the goblins at the front of the wall (starts its 10 s use, then a 20 s recharge)' },
  { id: 'pepper', group: 'food', icon: '🌶️', label: 'Pepper front', does: 'Pepper shaker: pepper the goblins at the front of the wall (8 s use, 12 s recharge). Peppered goblins sneeze, keep their gear and heal double when eaten' },
  { id: 'newTraps', group: 'food', icon: '🌾', label: 'Show new traps', does: 'The haystacks, bell tower and rope bridge stand now and the rare potion cart shows (the "Fire all triggers" button sets them all off)' },
  { id: 'newTools', group: 'food', icon: '🆕', label: 'Show new tools', does: 'The magnet, magnifying glass and sugar bowl pop onto the left platforms now (the swatter, pepper and drum step aside), without a loadout' },
  { id: 'magnet', group: 'food', icon: '🧲', label: 'Magnet pull', does: 'Magnet: strips the gear off every goblin within 60 cm of the spot 120 cm out in front (starts its 8 s use, 20 s recharge)' },
  { id: 'sugar', group: 'food', icon: '🧊', label: 'Sugar lure', does: 'Sugar cubes: a lure 100 cm out in front; goblins near it stop to eat (uses one cube)' },
  { id: 'spicyLure', group: 'food', icon: '🌶️', label: 'Spicy sugar lure', does: 'Secret Recipe (v3 2.6): a peppered lure 100 cm out in front; goblins that eat it are seasoned (heal double when eaten, for 8 s)' },
  { id: 'chickensFront', group: 'food', icon: '🐔', label: 'Chickens in front', does: 'Change of Menu (v3 2.6): three chickens by the wall in front, to pinch and eat (each heals 3 times a goblin)' },
  { id: 'garden', group: 'food', icon: '🌻', label: 'Grow garden', does: 'Magnifying glass: every seed bed grows its plant at once (sunflowers shoot, mushrooms puff)' },
  { id: 'pepperRing', group: 'food', icon: '🔴', label: 'Pepper ring front', does: 'Pepper ring: fill the 3 segments in front of you at once (each lasts 30 s, a quarter used per goblin walking through)' },
  { id: 'horn', group: 'food', icon: '📯', label: 'Blow horn', does: 'Horn: it sounds without hands or a mic and the field knights charge down the road in front of you (30 s recharge)' },
  { id: 'drum', group: 'food', icon: '🥁', label: 'Beat drum', does: 'Drum: a hard strike without hands: every goblin is stunned and the ones on the rampart are knocked back down outside the wall (25 s recharge)' },
  { id: 'troops', group: 'army', icon: '🛡️', label: 'Send knights', does: 'What the horn does, aimed at the road about 130 cm out in front of you: a new squad of 3 to 5 knights (up to 4 squads), or at the limit the nearest squad moves there' },
  { id: 'troopsToggle', group: 'army', icon: '🚫', label: 'Troops on/off', does: 'Troops on or off for testing: off, every soldier (knights and the wall garrison) is gone; on, the garrison is back on the walls' },
  { id: 'thinGarrison', group: 'army', icon: '🏹', label: 'Thin garrison', does: 'Two soldiers of the wall garrison go down (archers first): one new one climbs up from the courtyard every 15 s' },
  {
    id: 'triggerLesson',
    group: 'army',
    icon: '🛢️',
    label: 'Trigger lesson group',
    does: 'A small group of grunts walks to the boulder nearest the front and waits below it until it is set off (what the wave 2 boulder lesson does)',
  },
  { id: 'triggersReset', group: 'army', icon: '🛢️', label: 'Reset triggers', does: 'Every trigger (keg, boulder, tree) stands ready now, even before its wave' },
  { id: 'triggersFire', group: 'army', icon: '💣', label: 'Set off triggers', does: 'Set off every trigger standing now (keg blast, boulder roll, tree fall)' },
  { id: 'spinLeft', group: 'board', icon: '↩️', label: 'Spin left', does: 'Turn the board left one step' },
  { id: 'spinRight', group: 'board', icon: '↪️', label: 'Spin right', does: 'Turn the board right one step' },
  { id: 'boardUp', group: 'board', icon: '⬆️', label: 'Board up', does: 'Raise the board one step' },
  { id: 'boardDown', group: 'board', icon: '⬇️', label: 'Board down', does: 'Lower the board one step' },
  { id: 'giantToggle', group: 'board', icon: '🧍', label: 'Giant body on/off', does: 'Show or hide the giant body under the head (the seat floor stays)' },
  { id: 'place', group: 'board', icon: '📍', label: 'Place again', does: 'Place the board again in front of you' },
  {
    id: 'nextTime',
    group: 'sky',
    icon: '🌗',
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
  {
    id: 'nightFog',
    group: 'sky',
    icon: '🌫️',
    label: 'Night fog on/off',
    does: 'Roll the night fog in (and change to night) or lift it, the same 8 s change as between waves. Kept until the next battle starts',
  },
  { id: 'fps', group: 'performance', icon: '🖥️', label: 'FPS panel on/off', does: 'FPS panel on or off (hidden by default; add ?fps to the URL on the hosted build)' },
  {
    id: 'micPanel',
    group: 'performance',
    icon: '🎙️',
    label: 'Mic panel on/off',
    does: 'Live loudness panel on or off (right of front): the mic level now, the loudest in the last 3 s and since opened, and the horn speak line (HORN.speakLevel). Or add ?mic to the URL',
  },
  { id: 'resetRun', group: 'performance', icon: '⏱️', label: 'New measured run', does: 'Start a new measured run (average FPS, 1% low, missed frames)' },
  { id: 'stress', group: 'performance', icon: '🏋️', label: 'Stress +10', does: 'Stress test: add 10 grunts, above the normal unit cap (starts a new measured run)' },
  { id: 'autoTest', group: 'performance', icon: '▶️', label: 'Run stress test', does: 'Automatic stress test: stops the battle, adds grunts step by step until FPS fails, then clears the board' },
  { id: 'stopTest', group: 'performance', icon: '⏹️', label: 'Stop stress test', does: 'Stop the automatic stress test and clear the board' },
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
  /** The game's last few notes (src/debug/notes.ts): a stuck knight, what the bell did, what paused it. */
  notes?: string;
}

/** A debug command as it comes in from the debug page. */
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
