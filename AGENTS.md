# AGENTS.md

Instructions for any coding agent working on this repo (Claude Code, Codex, Cursor, etc.).

## What this project is

Tall Tale is a seated, hands-only VR game for Meta Quest, built for the Meta VR Start Developer Competition 2026.
You are a giant sitting in the middle of a round castle. A tiny battle happens all around you. You help your army win by using giant tools, and by grabbing enemies near the walls and eating them.

Read README.md and docs/GDD.md for the full design before making gameplay decisions. docs/mvp.md defines the first playable build, the tutorial director and waves, and the build order. When docs disagree, the files in docs/ win.

**v2 (branch `feat/v2`): read docs/v2-plan.md first.** It holds the new design (free tools with recharge, all goblins climb, the horn and the wall garrison, the campaign) and the three build runs. Where it disagrees with any other doc, docs/v2-plan.md wins.

## Hard rules (never break these)

1. **Hands only.** The entire game must be playable with hand tracking. No controller is ever required. Controller support is optional and low priority.
2. **Voice is never required.** Every voice action (the megaphone scream, later troop orders) must also have a hand-based way to do the same thing (for the megaphone: the bell, which is in the MVP).
3. **Seated.** Every interaction must work from a chair within about a 2 ft (60 cm) radius, and every grab, pinch and poke target sits in the reach band (below). The board is always a full 360 degree circle that the player spins and raises or lowers with the ring handle, so nothing ever requires turning around. Only the board rotates. The sky, horizon, hills, the player's tool platforms, food jar and the two flags never turn (comfort); the platforms, jar and flags rise and fall with the board. A later comfort setting turns the board in snap steps instead of smoothly. See docs/controls-and-ui.md.
4. **Performance first.** The game must hold a stable frame rate on a Meta Quest 3S. If a feature hurts frame rate, simplify it.
5. **No copyrighted IP.** No names, logos, characters or lore from existing games, comics or films.
6. **Cartoon violence only.** Enemies are non-human (goblins, orcs, etc.). No blood or gore. Eating enemies must stay funny, not disturbing.

## Tech stack

- **Engine:** IWSDK (Meta Immersive Web SDK, WebXR), built on Three.js.
- **Language:** TypeScript.
- **Physics:** Havok (built into IWSDK).
- **Megaphone (scream) detection:** Web Audio API mic loudness. No speech recognition needed. Mic permission is asked on the 2D start page.
- **Speech (later, not in the MVP):** vosk-browser (offline, runs in a Web Worker) with a small fixed command list, for voice troop orders.
- **Assets:** low-poly CC0 models in `public/gltf/` and sounds in `public/audio/`. docs/assets.md says which model and sound to use for each thing. Use only those. Anything without a model is a simple shape from docs/placeholder-shapes.md. If you add a new shape, list it there.
- **Hosting:** GitHub Pages (static). Players open a link in the Quest browser. Vite uses a relative base (`./`), which works under the repo path. Keep it. PWA and Store packaging come later.
- **No backend** unless a feature truly needs one. Ask before adding one.

The MCP servers in `.mcp.json` are the most reliable source of information. Check them before writing any IWSDK, WebXR or Quest code, and never guess an API:

- **iwsdk-reference:** IWSDK API reference, code search, usage examples, ECS components and systems.
- **metavr:** Meta Quest and Horizon OS docs, API search and best practices (hand tracking, WebXR, performance).
- **iwsdk-runtime:** runs the app in an emulated browser for checks and screenshots (see "Cloud build run" for when not to use it).

## Performance budget

- About 40 to 80 small units on the board in total (troops plus enemies). **Measured so far: about 50 goblins at 72 Hz** with no dropped frames. Every test result, what we learned and the next optimizations are in docs/performance.md. Add each new stress test result there.
- Use instancing for repeated meshes (troops, enemies, pebbles, particles).
- Use simple collision shapes (boxes, spheres, capsules). Never use full mesh colliders on moving objects.
- Pool objects (pebbles, debris, units) instead of creating and destroying them.
- Avoid full-screen post-processing (bloom etc.). Fake glow with emissive materials and simple shaders.
- Keep the first load fast. Cache large files.
- **How to measure:** use the measured run on the FPS panel (also live on the laptop debug page, with a history table and CSV copy). Judge by three numbers over a run of at least 20 seconds: avg FPS (at least 98.5% of the target, 71 of 72), 1% low (at least 90%, 65 of 72), missed frames (under 1%). The 1% low counts each frame in whole display beats (1 beat = on time, 2 = one dropped frame), because the headset only shows frames on its beat and the page clock wobbles by a ms or two. The raw clock value is shown for information only. The target is the XR session's real frame rate, 72 if it does not report one. Only trust numbers from a "headset" page: the IWSDK emulator fakes a Quest on localhost, and the laptop screen runs at 120 Hz. A run resets on Stress, clearing goblins, pause, or "New measured run", and skips a 3 second warm-up. Missed frames and the 1% low matter more than the average in VR, because dips cause judder.
- **Frame rate:** the game asks for 72 Hz on entering VR (`XR.frameRate` in config). The Quest 3S browser default is 90 Hz, which leaves only 11.1 ms per frame.
- **Slow frame causes:** code that can cause a hitch calls `mark()` from `src/debug/perfMarks.ts` (goblin built or spawned, sound, particles, panel redraw, debug send). Each missed frame counts the marks from the frame before it, and the stress test result lists them. "nothing marked" means the browser, hand tracking or garbage collection. Add a mark when adding something that might hitch.
- **Unit budget:** the "Run stress test" button on the debug page first measures the empty board (baseline), then adds grunts 10 at a time, measures each step for 20 seconds with that rule, stops at the first failing step and clears the board. Only a page in VR runs it, the FPS panel is hidden while it measures, and the debug page lists every connected game page. The budget is the last passing step. Rules are in `STRESS_TEST` in `src/config/game.ts`. Run it again after big changes (new models, effects, troops).

## Hand interaction rules

- **Reach check:** the tutorial starts by measuring how far the player reaches ("Show me how big you are, giant!") and scales the whole board (everything in `boardLift`) so the rampart sits at 88% of that reach. Everything keeps its place relative to the wall. So config sizes are the default player's sizes, and **code that turns board cm into meters by hand must multiply by `stage.boardScale`**. Details in docs/controls-and-ui.md ("Reach check").
- **Reach band (measured from the eyes, for the default board size, placed 46 cm below the eyes):** too close under 30 cm, **best 40 to 50 cm**, the edge 50 to 63 cm (only for things reached now and then, like climbers on the rampart and intruders), never past 63 cm. From Meta's hands guidance: direct touch works best at 42 to 46 cm, and 50 to 80 cm is the "middle distance" where people reach and miss. Every grab, pinch and poke target goes in this band, and the castle, ring handle and tool layout are sized from it. The numbers are `REACH` in `src/config/game.ts`, and the dev server warns at start about any spot outside it (`src/rules/reach.ts`). Add every new interactive thing to `reachSpots()`. Details in docs/controls-and-ui.md ("Reach band").
- **Opposite hand for tools:** a tool on the right side is taught (ghost hand and text) with the left hand, one on the left with the right hand, and the free hand does the rest (the slingshot's pebble and pull). See "Ghost hand demos" below.
- **Tools held in a fist snap to a real grip** (`HOLD` in config, `src/player/hold.ts`): the handle through the fist, the tool past the thumb, facing the way it is used. Never keep the angle the grab happened at for a fist grab. A new tool adds its pose to `HOLD.poses`.
- **Every attack must be visible without sound** (threat cues: the wall hit flash, `src/ui/threatCues.ts`). A new enemy that hurts the castle in a new way must show up there too.
- Prefer grab, drag, pull and release. These are the most reliable hand tracking actions.
- Avoid relying on custom hand poses or gestures. If one is needed, add a short delay before it triggers so it does not flicker.
- No haptics exist, so every action needs clear visual and sound feedback. Every grabbable or pokeable thing uses the same Idle, Ready, Held and Locked states, done with emissive color only. See "Interaction feedback" in docs/controls-and-ui.md.
- Make handles and tools oversized with generous grab zones.
- **UI library:** every piece of UI is built from our own library, imported from `src/ui/kit/index.js` (never written again by hand): `PokeButton` (sizes only from `BUTTON_SIZE`), `Slider` (touch and slide with the index finger; touching the track jumps the handle), `Switch` (on and off shown by knob side, color and text together), `StandButton` (a button on a post in front), `Panel`, `LazyFollow` (menus that follow the head), `armControls` (a page opened: reset and lock its controls), layout math (`rowX`, `bottomRowY`, `panelMap`), canvas text (`drawTitleBanner`, `drawLine`, `drawOutlined`, `UI_COLORS`), `canvasTexture` / `canvasPlane`, and `drawOnTop` with the layer order in `RENDER_ORDER`. Something new that two places need goes into the library first. Every menu panel gets its height from `uiCenterY` (right in front of the eyes, inside `UI_ZONE`), never a hand-picked y, and keeps the room in `UI_SPACING` around and between its controls and text. Follow Meta's hands guidelines: targets at least 22 mm, at least 12 mm apart. Details in docs/controls-and-ui.md ("UI library").
- The ring handle is one rail around the player (a full circle for now, see docs/controls-and-ui.md). The first few cm of each grab lock one direction: sideways spins the board, up or down changes its height, both 1:1 with the hand. It never does both in one grab.
- The player's bare hands only grab and eat. No smashing or slapping. Letting go mid-swing tosses the goblin with simple projectile math (no physics engine), and it lands dazed. A toss is not an attack: it does no damage. Pebbles toss the same way and only knock a goblin back, dazed (knocking out stays the slingshot's job). A held goblin can be loaded into the slingshot as a stronger shot.
- Two hand actions: **pinch** (thumb and index) for small things like goblins, pebbles and the slingshot pouch, and **grab** (fist) for big things like the slingshot handle, swatter, pepper shaker, megaphone and bell. The ring handle and the slingshot handle accept both, because a fist with the back of the hand toward the headset tracks poorly. See "Pinch and grab" in docs/controls-and-ui.md.
- Goblins are tiny (about 3.9 cm, runners 3.35). The pinch zone is about 5 to 6 cm and snaps to the nearest goblin. See docs/controls-and-ui.md.
- Hand tracking gets unreliable very close to the headset. The "eat" action triggers when a held goblin stays within about 22 cm of the face for a moment. No letting go and no head tilt, because a pinch with the palm toward the headset opens the Quest menu. It must not require touching the mouth.
- Never use a palm-facing pinch as a game input. Quest reserves it for the system menu. Pause uses a button on a stand straight in front, outside the ring (on the Next button's spot, at the same height).

## Ghost hand demos (tutorial)

The see-through tutorial hands (`src/ui/ghostHand.ts`, demos in `src/ui/ghostDemos.ts`) must show the movement exactly as the player has to do it. A wrong demo teaches the wrong thing. Every new or changed demo follows these rules:

- **Same gesture as the code detects:** pinch (thumb and index) for small things, fist for the ring and tool handles, the same hand the lesson text says ("your other hand" means the hand not holding the tool).
- **Opposite hand:** a tool on the player's right is grabbed with the left hand, one on the left with the right hand (bending a hand back toward its own side while looking at it is hard; a small twist and the other hand is easy). What is done with a held tool goes to the free hand: the slingshot (right) is held in the left hand, so the pebble, the load and the pull are the right hand's. The demo, the lesson text ("with your left hand", `FOOD_TOOL_LESSONS.hand`) and every new tool follow this.
- **Exact contact point:** a fist closes around the bar's center line (the fist's hole is the model origin), a pinch puts the thumb and index tips on the object. Anchors are real points from the systems (the ring tube's center, the handle's axis, the top of the pebble pile), never a guessed offset from a nearby point.
- **Never through an object:** approach and leave from the open side (from above for the ring, the bowl and goblins, from behind and the side for the slingshot handle, from the player's side for the pouch). If a straight line would cross something (the fork, a band, the bowl rim, the wall), add a key to go around it.
- **Turned by named directions, not angles:** every key gives `rod` (the bar's direction toward the thumb) or `fingers`, plus `palm`, in the anchor's [right, up, forward] frame. The hand's own axes are measured from its joints, so there are no roll or pitch guesses.
- **Natural and safe:** the pose a real person would use, never a palm facing the headset (the Quest menu gesture), wrist bends a real wrist can do.
- **Moves like the real thing:** a sideways ring pull follows the ring's curve (`arcDeg`), a slingshot pull goes straight back along the shot, moved distances match the lesson's goal (for example the spin goal in `TUTORIAL_TIMING`).
- **Check it in the headset** from the seat, from more than one head angle, before calling a demo done, and note any change in docs/mvp.md.

## Day and night (branch `feat/day-night-cycle`)

Four times of day follow the waves (docs/mvp.md, "Day and night cycle"). Anything new must still look right and stay readable at night:

- **Every look lives in `DAY_NIGHT.looks`** (`src/config/game.ts`). Something new that should change with the time of day gets a field in `DayLook`, a value in all four looks, and is blended in `src/world/dayNight.ts`. Never check the time of day in gameplay code: it is decor only.
- **A new troop or enemy material gets the night rim** (`addNightRim` in `src/fx/nightRim.ts`, call it again after cloning a material), so it stands out at night.
- **New terrain or decor gets the terrain fade** (`fadeAtNight` in `src/fx/nightFade.ts`). Anything built into the board before `fadeAtNight(this.stage.boardSpin)` in `src/game.ts` gets it; anything that glows or is interactive must be added after it, so it keeps its colors.
- **Night lights are faked**, never real lights: bright unlit colors and additive glows (`src/world/nightLights.ts`). A new glowing thing goes there.
- The time only changes between waves, so a change never costs frame time during a fight. Keep it that way.

## Development workflow

- The developer works on a Mac and tests on a Quest 3S over Wi-Fi in the Quest browser.
- Make as much as possible testable in desktop Chrome with the Immersive Web Emulator, so the developer only needs the headset for feel and hand tracking checks.
- Add debug shortcuts, for example keys that trigger the megaphone, skip a wave or add food, so features can be tested without a mic or a headset.
- Every debug action goes in `DEBUG_ACTIONS` in `src/debug/debugKeys.ts` (with its section `group` and an emoji `icon`) and gets a case in `GameSystem.runDebug`. It then works from a button on the laptop debug page at `/__debug` on the dev server (no keyboard keys: the headset has none), which sends it live to the headset over Vite's hot reload WebSocket (`vite-plugins/debugPage.ts`, dev only). An action with `args` gets one button per value (for example "Start at wave 1 to 5").
- **Rapid testing:** "Start at wave N" on the debug page starts the battle at that wave (earlier lessons and waves left out, earlier tools already out). Play then starts there too, even after a reload in the same tab, until "Restart game". The pages table shows each page's current tutorial step.
- Keep game rules data driven (unit stats, tool costs, food values in config files), so tuning does not need code changes.
- Keep three parts separate: the map blueprint (static JSON), the director (code that decides what happens when, for example the scripted tutorial) and the game systems. Directors only call systems. See docs/map.md section 8.
- All randomness goes through one seeded random function. The tutorial uses a fixed seed.
- Keep systems small and separate: board, units, enemies, giant tools, player hands, food, flags, director, audio.
- Sounds: use the files mapped in `public/audio/README.md` from the step where each feature is built. Sounds listed there as missing use `public/audio/chime.mp3` until the last build step. Reference sounds by name from one config file.

## Cloud build run

When the developer starts a cloud session to build the MVP, these rules replace the matching "Developer preferences" below:

- Work through the build order in docs/mvp.md without stopping to ask, unless a hard rule would be broken or the docs truly do not answer a question.
- Commit and push to the session's branch after each build step. Never push to `master`. Every push deploys to GitHub Pages automatically (`.github/workflows/deploy.yml`).
- Before each push, `npm run typecheck`, `npm run build` and `npm test` must pass.
- Use iwsdk-reference and the metavr docs and API tools for every API question, before writing the code.
- Do not use iwsdk-runtime, browser screenshots, the emulator or the metavr device and performance tools. There is no headset or GPU in the cloud.
- IWSDK skills (for example `iwsdk-dev`) ask for runtime checks and screenshots. Skip those parts and check with typecheck, build and tests instead.
- End each step's commit message with a "Headset check:" list: what to test on the headset and the debug page buttons for it.
- Stop after step 1 and tell the developer it is ready for a headset test. (MVP build only. For the v2 runs, follow docs/v2-plan.md section 3: commit after every step, stop only at the end of the run.)
- If anything in docs/ conflicts with these rules, these rules win.

## Developer preferences

- Do not commit, push or deploy unless the developer explicitly asks.
- Ask before adding any dependency.
- Do not run formatters, linters or scripts that were not approved.
- Never use em dashes or en dashes in code comments, docs or UI text.
- Keep explanations short and simple. The developer knows React, React Native, Node/Express and Python well, but is new to 3D and VR.
- No co-author lines in commits or files.
