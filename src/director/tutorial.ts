// The tutorial director (docs/mvp.md "Tutorial director"): 5 waves, each
// introducing one new thing. The wave numbers and the step list live here
// together, so they are tuned side by side. Steps only call the game systems
// through TutorialApi. Nothing tutorial-only lives in those systems.
// No Three.js here, so the steps can be tested.
import type { GoblinType } from '../config/game.js';
import type { DirectorStep } from '../rules/director.js';

export type ToolName = 'slingshot' | 'swatter' | 'pepper' | 'megaphone';

export interface WavePlan {
  /** What this wave introduces (for logs). */
  teaches: string;
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
    teaches: 'hands and eating',
    camps: ['campNorth'],
    counts: { grunt: 6, runner: 0, climber: 3 },
    spawnTime: 50,
  },
  {
    teaches: 'slingshot',
    camps: ['campNorth', 'campEast'],
    counts: { grunt: 10, runner: 0, climber: 2 },
    spawnTime: 55,
    newTool: 'slingshot',
  },
  {
    teaches: 'fly swatter vs runners',
    camps: ['campNorth', 'campWest'],
    counts: { grunt: 8, runner: 12, climber: 3 },
    spawnTime: 60,
    newTool: 'swatter',
  },
  {
    teaches: 'pepper shaker and megaphone',
    camps: ['campEast', 'campSouth', 'campWest'],
    counts: { grunt: 14, runner: 8, climber: 4 },
    spawnTime: 65,
    newTool: 'pepper',
  },
  {
    teaches: 'everything together',
    camps: ['campNorth', 'campEast', 'campSouth'],
    counts: { grunt: 18, runner: 16, climber: 4 },
    spawnTime: 70,
  },
];

/** Step timing (seconds). */
export const TUTORIAL_TIMING = {
  /** Waits for a player action (eat, shoot, use a tool) this long before the first fallback, then again. */
  stuckAfter: 20,
  /** A step that waits for the player moves on after this long anyway. */
  actionTimeout: 60,
  /** A wave that is not cleared after this long (after its teaching step) ends anyway: leftovers run off. */
  clearTimeout: 90,
  /** Breather between waves. */
  breather: 8,
};

/** What the tutorial steps can do. The game wires each one to a system. */
export interface TutorialApi {
  /** Starts a wave (0 based): camps rumble, then small groups walk in. */
  startWave(index: number): void;
  /** True when every enemy of the current wave came out and none is left. */
  waveCleared(): boolean;
  /** Ends the current wave now: no more spawns, leftovers run off with a poof. */
  endWave(): void;
  /** The wave flag climbs a notch and the castle is repaired a little (or the battle is won). */
  clearWave(): void;
  /** A climber right in front of the player. `onRampart`: already up on the wall, closer (the easier fallback). */
  climberInFront(onRampart: boolean): void;
  /** A tool appears on its platform with a poof and glows until grabbed. */
  showTool(tool: ToolName): void;
  /** Glows the tool again, as a hint. */
  hintTool(tool: ToolName): void;
  /** The easier fallback for a tool, for example a pebble already in the slingshot pouch. */
  helpWithTool(tool: ToolName): void;
  /** False for tools not built yet. Their steps are skipped. */
  hasTool(tool: ToolName): boolean;
  /** How often the tool did its job (slingshot: goblins knocked out). */
  toolUses(tool: ToolName): number;
  /** Goblins eaten in this battle. */
  eaten(): number;
}

/** Teaching step: waits for the player to use a tool once, with the usual two fallbacks. */
function useToolStep(tool: ToolName, wave: number): DirectorStep<TutorialApi> {
  let before = 0;
  return {
    id: `wave-${wave + 1}-use-${tool}`,
    start: (api) => {
      before = api.toolUses(tool);
    },
    done: (api) => !api.hasTool(tool) || api.toolUses(tool) > before,
    fallbacks: [(api) => api.hintTool(tool), (api) => api.helpWithTool(tool)],
    stuckAfter: TUTORIAL_TIMING.stuckAfter,
    timeout: TUTORIAL_TIMING.actionTimeout,
    slowSpawns: true,
  };
}

function startWaveStep(wave: number): DirectorStep<TutorialApi> {
  return { id: `wave-${wave + 1}-start`, start: (api) => api.startWave(wave), done: () => true, timeout: 0 };
}

function clearStep(wave: number): DirectorStep<TutorialApi> {
  return {
    id: `wave-${wave + 1}-clear`,
    done: (api) => api.waveCleared(),
    timeout: TUTORIAL_TIMING.clearTimeout,
    onTimeout: (api) => api.endWave(),
  };
}

/**
 * The wave is over: the flag climbs. Between waves, the next wave's new
 * tool appears during the breather. After the last wave the battle is won.
 */
function breatherStep(wave: number, last: boolean, next?: WavePlan): DirectorStep<TutorialApi> {
  return {
    id: `wave-${wave + 1}-cleared`,
    start: (api) => {
      api.clearWave();
      if (next?.newTool) api.showTool(next.newTool);
      // The megaphone shares its platform with the bell and comes with the pepper (wave 4).
      if (next?.newTool === 'pepper') api.showTool('megaphone');
    },
    done: (_api, time) => last || time >= TUTORIAL_TIMING.breather,
    timeout: TUTORIAL_TIMING.breather,
  };
}

/** The full step list. Built fresh for each battle, since steps remember counts. */
export function buildTutorialSteps(waves: WavePlan[] = TUTORIAL_WAVES): DirectorStep<TutorialApi>[] {
  const steps: DirectorStep<TutorialApi>[] = [];
  waves.forEach((wave, i) => {
    steps.push(startWaveStep(i));
    if (i === 0) {
      // Wave 1: one climber pops up right in front of the player, to eat in the first minute.
      let before = 0;
      steps.push({
        id: 'wave-1-eat',
        start: (api) => {
          before = api.eaten();
          api.climberInFront(false);
        },
        done: (api) => api.eaten() > before,
        fallbacks: [(api) => api.climberInFront(false), (api) => api.climberInFront(true)],
        stuckAfter: TUTORIAL_TIMING.stuckAfter,
        timeout: TUTORIAL_TIMING.actionTimeout,
        slowSpawns: true,
      });
    }
    if (wave.newTool) steps.push(useToolStep(wave.newTool, i));
    if (wave.newTool === 'pepper') steps.push(useToolStep('megaphone', i));
    steps.push(clearStep(i));
    steps.push(breatherStep(i, i === waves.length - 1, waves[i + 1]));
  });
  return steps;
}
