# Level Generator, Custom Game and the Campaign Levels (next)

Status: decided with the developer (2026-11-11). **This is what we build next** (after v2 run 2). Not started. Where it disagrees with [map.md](map.md) section 8 or [modes-and-progression.md](modes-and-progression.md), this file wins. [v2-plan.md](v2-plan.md) still wins over this file.

Back to [GDD index](GDD.md). Related: [menus.md](menus.md) (the campaign panel and the 15 level cards), [map.md](map.md) (blueprints, the road graph, triggers), [controls-and-ui.md](controls-and-ui.md#ui-library) (the UI kit).

---

## 1. The idea

- **One level generator** makes every level: the 15 campaign levels and every Custom Game. (Daily Battle and Endless use it later.)
- A level is **settings in, level out**: `generateLevel(seed, settings) => level`. The same seed and settings always give the same level.
- **Custom Game first, with just enough settings to build all 15 campaign levels.** Then we make the 15 levels with it. Once the campaign is done, Custom Game can get more and finer settings.
- **Every level has its own map.** No two levels share a map, and no campaign level uses the tutorial map.
- The generator also **runs headless from the command line** (section 6), so level files are made by running a command, never written by hand.

---

## 2. What a level is

A level file holds both kinds of settings, plus the result:

| Part | What it holds | Who reads it |
|---|---|---|
| **Map** | The blueprint (the format the game already reads, `src/rules/blueprint.ts`): camps with their size and the wave they appear in, junctions, roads with their in-between points, wall entries, triggers | The board builder |
| **Waves** | 4 waves (one time of day each), each: which camps send, how many grunts and runners, spawn time, balloons, the gear share (helmets, shields, spears, swords) | The wave director |
| **Rules** (the twist) | Battle settings outside the map and waves: garrison size and refill time, the castle's starting health, how many camps send at once | The wave director and the systems |
| **Meta** | The seed and the settings it was made from (so it can be made again), the level number, the generator version | The CLI, the menu |

- **Campaign levels are frozen files**: each made once from a fixed seed and its settings, checked on the headset, saved in the repo. Tuning the generator later never changes a finished level (the file is the level, not the seed).
- **Custom Game levels** are made live from the player's settings, and can be saved (localStorage) to play again.
- The menu's level entries (`src/config/levels.ts`: name, flavor, skulls, reward) point at their level file.

---

## 3. Roads are gameplay

**The generator must prioritize winding, confusing roads over straight ones.** Today's tutorial roads are mostly straight spokes, easy to read and dull to defend. Roads should be part of the puzzle:

- **Bends and curves**: most roads curve and bend, some double back. A camp in the north may reach the castle through the east.
- **Forks and merges**: groups split, then join again. Where do you defend, where do you send the knights?
- **Crossings and shortcuts**: roads that cross each other, side roads that let goblins slip from one road to another.
- **Ring and spiral roads**: a road that runs around the castle before it comes in, so a threat you saw on the left arrives on the right.
- **Long and short ways**: at a junction one branch is short and fast, one long and winding; goblins pick (seeded), so the player watches before acting.
- **Dead straight is the exception**, kept for easy levels (level 1) and for contrast.
- Settings for it (section 4): road wiggle, junction count, crossings, loops. Difficulty raises how winding and branching the network is.
- The rules still hold (section 5): every road reaches the wall, the knights' routing (`src/rules/roadRoute.ts`) works on any network, and the camera, ring handle and tools are never in the way of a road the player must watch.

---

## 4. The settings

Each setting **describes itself**: its type (range, choice, on and off, number, seed), its limits, its default and its label. The Custom Game menu is **built from that list** (section 8), so a new setting shows up in the menu without new UI code. One data object (seed plus values) goes to the generator, from a campaign preset or the Custom Game menu alike.

**Enough to build levels 1 to 15:**

| Group | Settings |
|---|---|
| Map | camps (count), camp directions (spread out, opposite, one side), camp distance (range), camp size, junctions (count), road wiggle, crossings and loops, triggers per road (kegs, boulders, trees, and their share) |
| Waves | goblins per wave, how it grows wave to wave, runner share, balloons, the gear share (helmets, shields, spears, swords), spawn rate, how many camps send at once |
| Rules | garrison size and refill time, the castle's starting health |
| Difficulty | easy, normal, hard (moves the wave settings together; the skulls on the card) |

- **Rising camps (section 7) have no setting in Custom Game:** the generator decides from the camp count and difficulty. Campaign presets may set them exactly in their level file.
- **Map and enemy mix are what you face; difficulty is how much** ([map.md](map.md#map-vs-difficulty)). New problems, never tougher goblins.

---

## 5. Rules every generated level keeps

The generator checks its result and tries the next seed when a check fails, so it never hands out an unplayable level:

- Every road reaches the wall; every camp reaches the castle; every junction is on some way in.
- Camps keep a minimum distance from each other and from the castle; nothing sits on a road but triggers.
- Each main road passes at least one trigger (when the level has triggers).
- Everything interactive stays in the reach band (`reachSpots()`), and the expected goblins at once stay in the unit budget ([performance.md](performance.md)).
- The knights' route finding reaches the first junction of every road.
- A short summary is printed (camps, roads, junctions, road length, triggers, goblins per wave), so a dull or broken map is seen before the headset.

---

## 6. The command line

- The generator is **plain TypeScript with no browser code**, like the rules in `src/rules/` (pure math is fine, models, the DOM and WebGL are not). The board builder in the browser only draws its result.
- A script calls it: for example `npm run gen -- --seed 42 --preset level3` writes the level file, and `--settings file.json` takes custom settings. It also runs the checks (section 5) and prints the summary. So level files are made by a command, never typed by hand (by the developer or a coding agent).
- Running TypeScript from the command line needs a runner (newer Node runs `.ts` directly; else a small dev dependency like `tsx`, asked for first).

### Reuse what exists

Small generators already live in different files. **Reuse them, change what is needed, and organize them under the one main function** (the CLI and the game both call it). Do not write them again:

| Exists | File | What it does |
|---|---|---|
| `planSettlements`, `placeLandmarks`, `flatSpots`, `builtSpots`, `gapTo` | `src/world/settlements.ts` | Villages, fields, hamlets, lumber camps, landmarks, from the roads and camps |
| `planStorySpots` | `src/world/storySpots.ts` | Little scenes in the empty land |
| `Terrain`, `RoadField`, `campDistance` | `src/world/terrain.ts` | Ground heights, flat under camps, villages and triggers |
| `Meadow` | `src/world/grass.ts` | Worn ground and grass |
| `placeTriggers`, `triggerGround` | `src/world/triggers.ts`, `src/world/boardBuilder.ts` | Triggers on the roads, the ground under them |
| `buildDecor`, `roadTorchSpots`, `buildCamps` | `src/world/boardBuilder.ts` | Decor and forests, road torches, camp layouts |
| `RoadGraph`, `RoadNetwork` | `src/rules/roadGraph.ts`, `src/world/roads.ts` | The road graph and road shapes |
| Random road layouts | `maps/castle-3d.html` (the mockup) | Random angles and distances all around; a starting idea for camp and road placement |

The planning parts (where things go) move into the generator, with no models or DOM; the building parts (meshes, models) stay in the board builder. Everything goes through the one seeded random function.

---

## 7. Rising camps

- **Not every camp is there from the start.** A level's camps can appear later: a new camp rises **the moment its wave starts** (with the wave banner), never in the breather before and never mid-wave. This is the feel of progression and growing danger.
- **The tutorial does it too**: each wave's new camp rises as that wave starts.
- **The animation** is the one the menu and the castle walls use (`src/world/sceneSwap.ts`): the camp group slides up out of the ground, a transform only, no frame cost. A camp not up yet is hidden (fewer draw calls early on).
- **Seen without sound or looking**: the drum sound from its direction, a dust burst, and the red threat arrow points at it until the player looks.
- **The road to it is there from the start**: a road to an empty hill hints that something will come.
- **Data**: each camp in a blueprint gets the wave it appears in. Campaign presets set it; Custom Game leaves it to the generator (no setting, section 4).

---

## 8. Custom Game menu and the UI kit

The Custom Game menu is built from the settings list (section 4), with tabs (Map, Waves, Rules), a seed with a dice to reroll, Generate, Fight and Save. For it, **the UI kit grows** (every part in `src/ui/kit/`, built first, then used):

| New part | What it is |
|---|---|
| Range slider | Two handles, a minimum and a maximum (camp distance 380 to 430 cm) |
| Choice picker | A row of round buttons, one selected (easy, normal, hard) |
| Number stepper | A value with round minus and plus buttons, for small counts (camps, junctions). Counts only: the sound settings keep their one slider |
| Seed control | The seed as a number and a dice button to reroll (no keyboard: typing in VR is hard) |
| Tabs | Taken out of the settings panel into the kit |
| Setting row | A name, its control and its value in one row, used by every setting |

All of them follow the kit's rules: round buttons, Idle, Ready, Held and Locked looks with a sound, Meta's 22 mm targets 12 mm apart, panels sized to their content (`Panel.resize`).

---

## 9. Nothing hardcoded

- **Registries**: triggers, tools, enemy types, gear and decor each get one data table, an entry per kind (its model, its numbers, the settings it uses, its behavior hook). The generator, the wave director, the menus and the shelves read the registries.
- **A new kind is one entry** (plus its behavior code), not edits across many files. Today several kinds are fixed lists in the code (the `TriggerKind` union, the tool names, the level rewards, the shelf's tool tags): they move into the registries as part of this work.
- Numbers stay in config (`src/config/`), never in the code.

---

## 10. The 15 campaign levels

Reviewed with the developer (2026-11-11): four levels were only gear and two only runners, so 1, 5, 6, 9, 14 and 15 changed. Every level has its own map and one twist; every 5th mixes earlier twists. Each uses rising camps.

| # | Name | Twist | Shows off |
|---|---|---|---|
| 1 | First Watch | One camp, then a second rises. Gentle, mostly straight roads. | Hands, the rising camps |
| 2 | Runner's Road | Mostly runners | Swatter, slingshot |
| 3 | The Shield Wall | Every goblin brought a shield (unlocks the bell) | Pepper |
| 4 | Balloon Festival | Lots of balloon riders | Slingshot |
| 5 | Two Fronts | The opposite camp rises in wave 2: a surprise from behind | Spinning, the horn |
| 6 | Spear Rush | Spears everywhere: every wall hit counts twice, so fast hands matter | Hands, swatter |
| 7 | Powder Valley | Kegs and boulders on every road | Slingshot and triggers |
| 8 | Thin Walls | Only 2 archers, slow refill | Protect the garrison |
| 9 | Camp Surge | Every wave, a new camp. By the end they are everywhere | Spinning, everything |
| 10 | Shields and Spears | Shields in front, spears behind (mix) | Pepper, then swatter |
| 11 | The Great Horde | One huge camp, one long winding road | The horn |
| 12 | Sky and Stone | Balloons above, boulders below (mix) | Slingshot, triggers |
| 13 | The Siege | The castle starts damaged | Everything |
| 14 | Close Quarters | The camps are right outside the walls: short roads, quick hands | Hands, swatter, pepper |
| 15 | The Last Stand | Camps rise every wave, everything at once (mix) | Everything |

- **Levels 1 to 5 are open from the start**; 6 to 15 open one by one. All 15 get real level files now (they were text only).
- The card text in `src/config/levels.ts` (name, flavor, enemies) is updated to match this table when the levels are built.

---

## 11. Build order

1. **Level format and registries**: the level file (section 2), the settings list (section 4), the registries (section 9).
2. **Wave director**: plays a level's 4 waves (breather, banner, rising camps, wave, cleared, next), its gear and rules. The tutorial keeps its own director.
3. **Map loading**: Fight tears down the board and builds the level's map (terrain, roads, camps, villages, triggers), and every system that holds the road network gets the new one. A short loading moment; no leaks, no doubles. The riskiest part: built and checked on the headset before the generator.
4. **The generator and its CLI**: one main function reusing the existing planners (section 6), winding roads first (section 3), the checks (section 5).
5. **Levels 1 to 15**: made with the CLI, tuned on the headset, frozen.
6. **Custom Game menu**: the new kit parts, then the menu built from the settings list.
7. **Docs**: this file, map.md, menus.md, modes-and-progression.md, the README.

---

## 12. Open

- Which levels unlock which future tools (only the bell at level 3 is decided).
- Saving Custom Game levels: how many, and how they are named without a keyboard.
- How long the loading moment may be, and what shows meanwhile (the sink and rise already hides some of it).
