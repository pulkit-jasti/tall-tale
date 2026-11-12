# Level Generator, Custom Game and the Campaign Levels (next)

Status: decided with the developer (2026-11-11). **First part done and tested on the headset (2026-11-11):** the generator, its command line, the new UI kit parts and the Custom Game menu (section 12). **Next: the wave director and the map loading** (build order steps 4 and 5, section 11; the handoff for them is section 13). Where it disagrees with [map.md](map.md) section 8 or [modes-and-progression.md](modes-and-progression.md), this file wins. [v2-plan.md](v2-plan.md) still wins over this file.

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
- **Custom Game levels** are made from the player's settings when they are saved, and kept in localStorage with their name, seed and settings (section 8).
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

Decided with the developer (2026-11-11). The Custom Game button on the main menu opens it (no more "Coming soon"), in the front panel's spot, with Back to the main menu. Like the campaign panel, **nothing pops over anything**: every page and the delete question take the panel's place or the card's place.

### The list page

- **Empty state** (no saved levels, so the first visit): one short friendly line in the middle of the panel, for example "No battles yet. Make your own: pick the map, the waves and the rules.", with a small drawn icon above it (the `custom` menu icon), and a big round **Create level** button below it. Nothing else.
- **With levels:** a split panel like the campaign panel (section 8 of [menus.md](menus.md)):
  - **Left: the player's levels**, a tap only `ScrollList` scrolled by the scrollbar slider (below). Each row: the name and, under it, the description (cut short with "..." only when it does not fit). No difficulty: the player decides how hard a level is. Tap selects; the selected row is gold. A round **New** button under the list creates another level.
  - **Right: the detail card** of the selected level: the name big, then the **description** (the player's own, typed on the edit page; when empty, one made from its settings, for example "3 camps, winding roads, hard"), a row of small round buttons **Edit, Duplicate, Delete, Share**, and the big rectangular red **Fight** button (`FightButton`, the same as on the campaign card) centered at the bottom.
- When the page opens, the newest level is selected; after a save, the saved level is selected.
- **Edit** opens the create page filled in with that level's values (the name and every setting). There is no separate rename: one Edit button for both.
- **Duplicate** makes a copy named "<name> copy" (cut to fit the name limit, then "copy 2", "copy 3" while taken), adds it to the list and selects it.
- **Delete** puts a question in the card's place: "Delete <name>?" and "This cannot be undone.", with two round buttons and no words: a **green tick** (yes) and a **red cross** (no). Yes removes it and selects the next level (or shows the empty state after the last one); no goes back to the card.
- **Share** is a placeholder for now: a poke shows "Coming soon" in place of its word for 2.5 s, like Daily Battle.
- **Fight** until the wave director and the map loading are built (section 11): a poke shows "Coming soon" under it for 2.5 s. Then it plays the level.

### The create and edit page

- One page for both. **Create** starts from the defaults and a free name ("Level 1", "Level 2", the lowest number not taken). **Edit** starts from the level's values; Save writes over the same level (it keeps its place and id).
- **A narrow, tall panel** (changed after the first headset look, 2026-11-11: the rows stack, so it was too wide and too short). **Top:** Back (top left: leave without saving) and the title ("New level" or "Edit level").
- **The chosen tab's rows**, scrolling with the scrollbar. The **Map tab starts with the name and the description**, each a regular row: its name on a line, a white text field under it (section "Naming" below), its message under the field. The description is optional, 60 characters at most. Then the seed, then the tab's settings, one row per setting, built from the settings list (section 4). Narrow controls (counts, sliders, switches, the seed) sit in one line with the name and value; wide ones (choices, the camp distance range) stack under their name. Difficulty is on the Waves tab.
- **Under the panel, one line:** the **tabs (Map, Waves, Rules)** from its left edge, floating rectangular buttons (the chosen one green, the others grey: color, text and an underline, never color alone), and **Save** at its right edge, a rectangular gold call to action with a tick and "Save" (always there, no scrolling to reach it).
- **Save** checks the name first: when it is not valid, it goes back to the Map tab's top, the message shows under the field, and a status line along the panel's bottom says "Check the name first." A valid save runs the generator (`generateLevel(seed, settings)` with its checks, section 5), stores the level and goes back to the list with it selected. If no seed passes the checks, the status line says "Could not make a level with these settings. Try changing them."
- Debug: a save also writes the generator's summary (section 5) as a debug note, so a level can be checked on the debug page before the loader exists.

### Naming (the system keyboard)

The Quest browser shows its own system keyboard in an immersive session (Meta's guide "System Keyboard in WebXR", Quest browser 26.1 or later):

- Poking the name field focuses a hidden HTML text input (`maxlength` set to the limit), which brings up the system keyboard (`session.isSystemKeyboardSupported` tells if it can). While it is open, the field glows Held and shows the text as it is typed (the input's `input` event); the keyboard closing (Done, its hide button, or a poke outside it) blurs the input and the field goes back to Idle.
- **Each opening starts fresh:** the first key press replaces the whole name (a Quest limit). That is fine for naming.
- **The keyboard makes the session `visible-blurred`.** Our auto-pause (Quest menu, headset off) must not pause while the name field has focus.
- The hidden input is removed when the session ends. Where there is no system keyboard (the desktop emulator), a real keyboard types into the same input.
- **Rules,** checked as typed and on Save, each with a short message right under the field (warn color):
  - Not empty (spaces only count as empty): "Give your level a name."
  - At most 20 characters (the input stops there): "20 characters at most."
  - No two levels with the same name (ignoring capitals and spaces at the ends; the level being edited may keep its own name): "You already have a level with this name."

### Saving

- One localStorage key, `tallTale.customLevels`, next to `tallTale.progress`: a JSON object with a version and a list of levels. Each level: an id, the name, created and changed times, and the level itself (map, waves, rules and meta, section 2, so the seed and settings it was made from are in it).
- At most **20 levels**. With 20, Create and New are locked: a poke buzzes and says "20 levels at most. Delete one first."
- No storage (a private window): it still works for the visit and forgets on reload, like the progress.

### UI kit parts

For it, **the UI kit grows** (every part in `src/ui/kit/`, built first, then used):

| New part | What it is |
|---|---|
| Range slider | Two handles, a minimum and a maximum (camp distance 380 to 430 cm) |
| Choice picker | A row of round buttons, one selected (easy, normal, hard) |
| Number stepper | A value with round minus and plus buttons, for small counts (camps, junctions). Counts only: the sound settings keep their one slider |
| Seed control | The seed as a number and a dice button to reroll |
| Tabs | Floating rectangular buttons outside a panel's border, under it (rectangular like `FightButton` and `ActionButton`) |
| Action button | A rectangular call to action in its own color, an icon and a word (Save) |
| Setting row | A name, its control and its value in one row, used by every setting |
| Text field | A field poked to type with the system keyboard, the text mirrored on it, and a validation message line under it |
| Scrollbar | `Slider`'s scrollbar look: an upright track with a long pill-shaped handle instead of the round one, so it never looks like a value slider. **Every page that scrolls uses it**, the campaign list too |
| Confirm icons | A tick and a cross for round buttons (green yes, red no), no words |

All of them follow the kit's rules: Idle, Ready, Held and Locked looks with a sound, Meta's 22 mm targets 12 mm apart, panels sized to their content (`Panel.resize`). Every button is round except `FightButton`, `ActionButton` and the tabs.

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

Changed 2026-11-11 with the developer: the generator and the menu come first and are tested on the headset; then the director and the loader.

1. **Level format and registries**: the level file (section 2), the settings list (section 4), the registries (section 9).
2. **The generator and its CLI**: one main function reusing the existing planners (section 6), winding roads first (section 3), the checks (section 5).
3. **Custom Game menu**: the new kit parts first (section 8), then the list page, the create and edit page built from the settings list, naming with the system keyboard, saving. Fight says "Coming soon". **Headset test here.**
4. **Wave director**: plays a level's 4 waves (breather, banner, rising camps, wave, cleared, next), its gear and rules. The tutorial keeps its own director. In short: it reads the level's waves and rules and tells the systems what to do and when (spawn, raise a camp, show the banner); it never draws or moves anything itself.
5. **Map loading**: Fight tears down the board and builds the level's map (terrain, roads, camps, villages, triggers), and every system that holds the road network gets the new one. A short loading moment; no leaks, no doubles. The riskiest part: checked on the headset on its own. Custom Game's Fight then plays the level.
6. **Levels 1 to 15**: made with the CLI, tuned on the headset, frozen.
7. **Docs**: this file, map.md, menus.md, modes-and-progression.md, the README.

---

## 12. As built (first part, 2026-11-11, tested on the headset: the menus and the whole UI work well)

Build order steps 1 to 3 (the generator and the Custom Game menu). Tests pass for the generator and the saved levels; typecheck and build are clean apart from older errors in the bell and the tutorial director tests (they were there before).

- **Level format:** `src/level/level.ts` (`Level`: map, waves, rules, meta; `parseLevel`). Camps in a blueprint now have `wave` (the wave they rise in, `src/rules/blueprint.ts`).
- **Settings list:** `src/config/levelSettings.ts` (`LEVEL_SETTINGS`: 13 map, 11 wave and 4 rule settings, each with its kind, limits, default and label; `fixSettings`, `formatValue`, `describeSettings` for the card's description, `DIFFICULTY`).
- **Registries:** `src/config/registries.ts` for triggers (`TriggerKind` now comes from it), enemies and gear. Tools and decor move in with the director and the loader.
- **Generator:** `src/level/generate.ts` (`generateLevel(seed, settings)`, `summarize`), `src/level/checks.ts` (section 5, plus "no two roads run on top of each other"), `src/level/geometry.ts`. Numbers in `LEVEL_GEN`. It makes the map (camps by spread, a ring of outer junctions where camp roads come in, an inner junction each near the wall, one or two wall entries each, winding camp roads that may turn up to 110 degrees around the castle, forks with a long bulging branch, ring roads, crossings, triggers on the camp roads), the rising camps, the 4 waves (capped to the unit budget) and the rules. **Villages, story spots, decor and trigger ground are not planned in the generator:** the existing planners already plan them from any map when it is built, so they run at load time (step 5).
- **Command line:** `npm run gen -- --seed 42 [--set key=value] [--settings file.json] [--out file.json] [--svg map.svg]`, and `--help` lists every setting. It loads the TypeScript through Vite (no new dependency), prints the summary and can draw a top view of the map as an SVG picture.
- **UI kit:** `Tabs`, `TextField` (+ `isTyping`, `useKeyboardSession`), `NumberStepper`, `ChoicePicker`, `SeedControl`, `RangeSlider`, `SettingRow`, `ScrollArea`, `CanvasLabel`, the action icons, and `Slider`'s `scrollbar` look (the campaign list uses it now). Numbers: `TABS`, `TEXT_FIELD`, `PICKERS`, `SETTING_ROW`, `SLIDER.scrollbar`.
- **Pages:** `src/ui/menu/customList.ts` (empty state, list, card, delete question), `src/ui/menu/customEdit.ts` (create and edit), wired in `src/ui/menu/menu.ts`. Saving: `src/rules/customLevels.ts` (name rules, free and copy names, add, update, duplicate, remove) and `src/player/customLevels.ts` (`tallTale.customLevels`). Numbers: `CUSTOM_GAME`.
- **Keyboard:** the game hands each XR session to the field and skips auto-pause while typing. If the keyboard does not come up 1.5 s after a poke (it may need a user gesture), the field asks for a pinch and the next pinch opens it. **First thing to check on the headset.**
- **Debug page:** "Open Custom Game" and "Forget custom levels". Every save writes the level's summary as a debug note.
- **After the first headset look (2026-11-11):**
  - The edit page is 42 x 36 cm (was 54 x 30); the tabs and Save sit under it (about 51 cm from the eyes, marked rare in the reach check, still in reach); the name and description are rows on the Map tab; the typed description is saved with the level (`description` in `tallTale.customLevels`).
  - **No flicker:** a row's name is drawn once, and only its small value label is redrawn, at most every 0.12 s while a slider moves (`SETTING_ROW.redrawEvery`). Before, every slider tick redrew and uploaded a canvas as wide as the row, lying under the controls.
  - **The name field is white** (its face drawn white, unlit) and thin (`TEXT_FIELD.depth`), with a clear gap under its name, so it never hides the line above it.
  - **Buttons pushed deep no longer turn black:** the dark rim is now lower than the cap (`POKE.capShowShare` of the cap always stands out), and the cap's side reaches into the rim at rest. This changes every round and box button in the game.
  - Smaller text on the Custom Game pages: row names 1.15 cm, values 0.95 cm, numbers 1.3 cm, the card and list a step smaller.
- **Second headset look (2026-11-11):**
  - The flicker came back worse (the panel vanished while sliding): the status line redrew on every slider step. Fixed for good in the kit: no canvas redraws while anything is dragged (docs/controls-and-ui.md, "Rules learned on the headset").
  - Rows are cut at the scroll window's edges instead of hiding early; less padding under stacked rows and text fields.
  - No difficulty on the card or the list rows (the player decides how hard a level is, not the game); each list row shows the description under the name, cut short with "..." only when it does not fit; the card shows up to three lines of it.
  - The title and Back float over every page (`PanelHeader`); the edit page is 42 x 34 and its rows start at the top. The settings page uses the same floating tabs.
  - The scrollbar handle is a block around its rail; round buttons press as deep as box buttons.
- **Third headset look (2026-11-11):**
  - Taps, slider releases and tab changes still flickered on the Custom Game pages, never on the settings page: the pages are now drawn the same way (`layerPage`).
  - Rows showed or hid depending on the head: three.js clipping planes break under multiview; the cut is now done in the shader by world position. A row works while its middle is in the window.
  - The settings header had no title (its plate was drawn over it); its tabs are centered; opened from the home screen it stays put in front of the board (it follows the head only in a battle).
  - The edit page is 30 cm tall (was 34).
  - **Share, decided direction (not built):** no native share sheet for web apps on Quest is documented (Meta's share intents are Unity and Android only). Since a level is its seed plus its settings plus the generator version, a share is a short link: the game's URL with the level packed into it (only the settings that differ from the defaults), opened in any browser. In the headset: a QR code on the card (a friend's phone scans it) and the link copied to the clipboard; on a phone or computer, Meta's Web Launch (`https://www.oculus.com/open_url/?url=...`) sends the link to the Quest browser. Opening a shared link adds the level to Custom Game. No backend needed.
- **Fourth headset look (2026-11-11):** no flicker left. Tabs have no underline (the green cap is enough); the edit page is 34 cm tall again with no lines on it; the home screen panels (and settings opened from it) sit 6 cm lower (`MENU.drop`, `menuCenterY`); the setting rows' round buttons use the new compact size (`BUTTON_SIZE.compact` 1.6, 15% smaller; rows 5 cm). Open: the hand outline turns solid white for a frame on some taps (IWSDK's hand is an invisible depth mask with a white outline; solid white means the mask was missed that frame, likely a slow frame from a redraw on the tap: check the FPS panel's missed frame marks).
- **Fifth headset look (2026-11-11):** tabs keep one bold word (only the cap color changes); Save's word and tick are white; the text fields are plain white to the edge (`box.plain`: no dark border, the face over the whole cap) with less room around them; the rows have the same room over and under them (the status line moved outside, under Save); every row has a short hint under its name (`SETTING_HINTS`, wrapped to two lines); only sliders and the camp distance range show a value on the right (steppers, choices, switches and the seed show their own); the settings page opened from the home screen is placed from the board like the menu panels (`menuCenterY`), so every menu sits the same height over the ground and moves with the height rail.
  - **Height rail on the home screen** (`src/player/heightRail.ts`, `HANDLES.menuRail`): a short piece of the ring in front (52 degrees) with an up and down arrow, at the ring's spot. Grab it (fist or pinch) and move up or down to raise or lower the board and the menu; it never spins the board.

## 13. Handoff: the wave director and the map loading (next)

Build order steps 4 and 5 (section 11), then make Custom Game's Fight play a saved level. What exists and where it hooks in:

- **The level:** `Level` in `src/level/level.ts` (map: a `Blueprint` whose camps have `wave`, the wave they rise in; `waves`: 4 `LevelWave`s with `camps`, `rising`, `counts`, `spawnTime`, `balloons`, `gear`; `rules`: archers, guards, refill times, starting health; `meta`). Saved Custom Game levels: `customLevels` in `src/player/customLevels.ts`, each `entry.level`. Make one from the command line: `npm run gen -- --seed 42 --out some.json --svg map.svg`.
- **Fight:** Custom Game's Fight shows "Coming soon" (`CustomListPanel.update` in `src/ui/menu/customList.ts`). It should return a choice like the campaign's (`{ kind: 'fight', ... }` through `Menu.update` in `src/ui/menu/menu.ts`) and the game starts the level (`fight()` in `src/game.ts` is the campaign's path: `goToBattle`, sink and rise).
- **Map loading (the riskiest part):** today the board is built once at start from the tutorial map (`parseBlueprint(tutorialMap)` in `GameSystem.setup`, `src/game.ts`): terrain, roads (`RoadNetwork`, `RoadGraph`), camps, settlements, story spots, decor, triggers, villagers, torches. The loader tears that down and builds the level's map, and every system holding the road network or the graph gets the new one (goblins, troops and knights, triggers, the horn's routing, balloons, villagers). No leaks, no doubles; the menu's sink and rise can hide the build. Going back to the menu (or the tutorial) builds the tutorial map again. The planners already work from any blueprint (section 6 table). Check it on the headset on its own before the director.
- **Wave director:** battles now play the fixed `TUTORIAL_WAVES` through the tutorial director (`src/director/battle.ts`, `src/director/tutorial.ts`; campaign levels play the normal battle with `teach = false`). The new director plays a level's 4 waves: breather, banner, the wave's rising camps come up (`src/world/sceneSwap.ts` slide, drum from its direction, dust, the red threat arrow), groups from `camps` with `counts` over `spawnTime`, balloons, the gear shares (`src/rules/gear.ts` `rollGear`), cleared, next; the time of day per wave as today. It only calls systems (docs/map.md section 8). The tutorial keeps its own director.
- **Rules:** garrison size and refill (`GARRISON` in config today) and the castle's starting health (`CASTLE_HEALTH`) come from `level.rules` for a level battle.
- **Rising camps in the tutorial too** (section 7): each tutorial wave's new camp rises as it starts.
- **Rules to keep:** the UI rules in AGENTS.md and docs/controls-and-ui.md ("Rules learned on the headset"); never run typecheck (AGENTS.md); `npm run build` is the check, `npm test` when tested code changes.

## 14. Open

- Which levels unlock which future tools (only the bell at level 3 is decided).
- ~~Saving Custom Game levels: how many, and how they are named~~ Decided 2026-11-11: up to 20, named with the system keyboard (section 8).
- Whether the settings page's tabs switch to the new floating rectangular tabs too.
- What Share does (a placeholder for now; the direction is in section 12, third headset look: a link with the level packed in, a QR code, Web Launch).
- How long the loading moment may be, and what shows meanwhile (the sink and rise already hides some of it).
