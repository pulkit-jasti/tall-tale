# MVP: First Playable Build

Goal: test the core gameplay loop in the headset as early as possible. Everything else waits until after the first playtest.

Back to [GDD index](GDD.md).

---

## In the MVP

**World**
- The raised board, the castle with its low wall, courtyard and workers ([map.md](map.md)).
- Full 360 degree board. The player spins it and sets its height with the ring handle, marked with big arrows ([controls-and-ui.md](controls-and-ui.md#2-the-360-degree-board)).
- Low wall (about 6 cm) and wall attackers standing a little out from it, so there is no hidden strip ([map.md](map.md#no-hidden-strip-outside-the-wall)).
- Roads and enemy camps (sand and rock hills, bigger camp means more enemies).
- Triggers: boulder, powder keg and leaning tree only.
- Hidden gate at the front as the troop spawner.
- Two flags in front of the player (castle health and wave progress). They stay still when the board spins ([castle-rules.md](castle-rules.md#2-the-two-flags)).
- Real models from [assets.md](assets.md) from build step 1. Simple shapes only for the things in [placeholder-shapes.md](placeholder-shapes.md). Scale is in [map.md](map.md#scale-from-the-mockup).

**Rules and pacing**
- **Only the tutorial battle:** 5 hand-crafted waves, about 8 minutes, each wave introducing a tool (table below). A hand-made map blueprint, a scripted tutorial director in code, and a fixed seed. No level generator ([map.md](map.md#8-levels-and-the-level-generator)).
- Waves with a gentle intensity curve and short breathers ([core-loop.md](core-loop.md)).
- Win by surviving all waves, lose when the castle health flag reaches the bottom ([castle-rules.md](castle-rules.md)).
- Grunts and runners stop at the wall and hit it. Only climbers climb. Ignored climbers jump into the courtyard and become intruders.

**Menus**
- A 2D start page with one "Enter VR" button. It asks for mic permission before entering VR.
- A single Play button in VR (a simple shape, no menu board yet).
- Board placed automatically when Play is pressed.
- Pause with a wrist button, plus auto-pause on the Quest menu. Pause panel: Resume, Reset table, Restart battle ([controls-and-ui.md](controls-and-ui.md#5-pause-and-settings)).
- End of battle: a simple win ("Congratulations") or lose panel with a button to play again ([castle-rules.md](castle-rules.md#4-end-of-battle-screens-mvp)).

**Player**
- Body abilities: **grab and eat only** ([controls-and-ui.md](controls-and-ui.md#3-grab-and-eat)). Goblins are picked up with a pinch. The pinch zone is bigger than the goblin and snaps to the nearest one.
- **All 4 giant tools:** slingshot, fly swatter, pepper shaker, megaphone ([giant-tools.md](giant-tools.md)). This is the most satisfying part, so it is the main thing to test. The megaphone uses a fixed loudness threshold for now (no calibration). **The bell sits on the same platform** and triggers the same stun by shaking, so voice is never required. If mic permission is denied, the megaphone is tied down and the bell still works. A debug key also triggers the stun, for testing without a mic.
- No loadout, no unlocks. Each tool appears on its platform in its tutorial wave with a poof, and glows until grabbed. The tutorial's hint sign then teaches it step by step.
- Slingshot aim assist ([giant-tools.md](giant-tools.md#slingshot-aim-assist)).
- Food currency: eating fills the food jar, tools cost food. Start with 4 food. Food carries over between waves.
- Tool platforms beside the player with food pips.

**Enemies and army**
- **Grunts, runners and climbers only** ([enemies.md](enemies.md)). Climbers are the main food source.
- Enemy routes on the road graph ([map.md](map.md#4-how-enemies-choose-routes)).
- Troops with basic behavior: spawn, walk out, fight.

**Feedback**
- Spatial enemy sounds, louder as they get closer. Camps rumble before spawning.
- Real sounds from `public/audio/README.md`, added in the step where each feature is built. Sounds it lists as missing use `public/audio/chime.mp3` until the last step ([audio.md](audio.md)).
- Basic juice: hit flash, poof, gear flying off.

---

## Tutorial director

The tutorial is a hand-written script in code, not a JSON file, because it waits for the player and reacts when they get stuck. It runs on the hand-made map blueprint `tutorial.json` with a fixed seed.

### How it works

- A list of steps. Each step has three parts:
  - **Start:** what happens, for example spawn a climber in front of the player, or show the slingshot on its platform.
  - **Done when:** the goal, for example a goblin is eaten, or the powder keg is hit.
  - **If stuck:** what to do after a while, for example glow the tool again, or spawn the climber again closer.
- The director moves to the next step only when the current one is done.
- Steps only call the normal game systems (spawn enemy, show tool, open road). Nothing tutorial-only lives inside those systems.
- **Learn by doing, with text.** Without text, players do not know what to do. Each lesson shows one short instruction on the hint sign, a bouncing marker on the thing to use, and waits until the player does it. Then its box is ticked with a chime and the next one appears. No "OK" buttons.
  - **Hint sign:** low in front, just outside the ring handle, tilted toward the eyes and under the line of sight to the front wall. It rises with the board, never spins and never follows the head. Kenney UI images (`public/ui/`) on a canvas texture. Shows "Step 3 of 8" for lessons, "Wave 2 of 5" banners for waves, and goblins left while a wave is cleared.
  - **Marker:** a "!" with a down arrow above the target, drawn on top so the wall never hides it.
  - **Out of view:** an arrow on the ring points left or right, and the sign says where to look.
  - **Ghost hand:** a see-through 3D hand loops the gesture next to the real target (Meta's onboarding guidance: animated hand demonstrations). It steps aside while the player's own hand is there. Demos are data in `src/ui/ghostDemos.ts`.
  - **Info steps** (wave banners, flags) stay up for a reading time based on their length (`READING`). The flag steps also wait until the player looks at the flag for a second. A "Next" poke button on the sign skips them.
  - **New things are taught before their wave**, so no enemies press the player while learning. Lessons that need enemies (shooting a goblin) run at half the spawn rate.
- Lessons in the MVP: spin the board, set its height, pinch the climber, eat it, then (before wave 2) grab the slingshot, take a pebble, load it, and shoot a goblin. Wave banners and the two flags are explained as the battle starts. Lessons for the swatter, pepper, megaphone and bell are added when those tools are built.

### Rules that keep it safe

- **Keep fallbacks simple:** at most two. First repeat the step, then make it easier.
- **It must never get stuck.** Every step has a timeout (for example 30 seconds) that moves on anyway. A judge who cannot do something still sees the rest of the game.
- **Enemies keep coming while a step waits, but at half the spawn rate.** It still feels like a battle, without piling up on a player who is still learning.
- **The full step list** (start, goal and fallback for each step) is written and built by the coding agent in build step 3. The developer tunes it after playing it.

### Tutorial waves

Starting numbers, kept next to the director's steps and tuned in playtests. Climbers are the food source, so their count keeps food in step with tool costs (start 4, max 10).

| Wave | New thing | Camps | Grunts | Runners | Climbers | Food check |
|---|---|---|---|---|---|---|
| 1 | Hands and eating. One climber is scripted to pop up right in front of the player in the first minute. | 1 | 6 | 0 | 3 | 4 + 3 = 7 |
| 2 | Slingshot. A powder keg sits on the busiest road. | 2 | 10 | 0 | 2 | 7 + 2 = 9 |
| 3 | Fly swatter vs runners | 2 | 8 | 12 | 3 | 9 - 4 + 3 = 8 |
| 4 | Pepper shaker and megaphone. Boulder and leaning tree on the roads. | 3 | 14 | 8 | 4 | Up to 10, enough for both tools (9) |
| 5 | Everything together | 3 | 18 | 16 | 4 | Whatever is left |

- Enemies come out in small groups through each wave, not all at once, so the board stays within the unit budget.
- Each wave lasts about 60 to 90 seconds, plus a 5 to 10 second breather.

---

## Build order

Each step should be playable on its own.

**Every step is done when:** `npm run typecheck`, `npm run build` and `npm test` pass, the step's items below exist, and the step is committed and pushed. The developer then checks it on the headset from the GitHub Pages link.

1. **Toy test:** remove the starter template files. Board, castle wall, the ring handle with its arrows (first built as two handles, replaced after the first headset test), a few goblins walking in on simple roads, grab and eat. Prove that grabbing tiny goblins works and that enemies at the wall are visible from the seat.
   - Done when: a debug key spawns goblins, and the handles, grab and eat work in the code. The developer must test this step on the headset before step 2 builds on it.
   - **Done (2026-11-03), headset test passed.** Changes from the plan after testing: hold a goblin near the mouth to eat (no letting go or head tilt), one ring handle instead of two handles (full circle for now), the board starts higher, let-go goblins fly in a simple arc, auto-pause on the Quest menu, 72 Hz, unit budget about 50 goblins ([performance.md](performance.md)). Added for testing: FPS panel, laptop debug page at `/__debug` with an automatic stress test.
2. **Slingshot** with aim assist, and the pebble bowl.
   - Done when: a pebble can be pulled, released and hits goblins, and the bowl refills.
   - **Done (2026-11-04), headset test passed.** Changes from the plan after testing ([giant-tools.md](giant-tools.md#slingshot-starter-free)):
     - The slingshot is picked up by its handle and aimed by turning the body. Pinch a pebble from the bowl, click it into the pouch, pull with the other hand. No auto reload.
     - Once the pull starts, the slingshot locks in place and only the pulling hand aims, because the holding hand often hides behind it. Short tracking-loss graces for both hands. A pull is never shot by a lost hand.
     - Aim assist: dots along the whole arc, a landing circle on the ground, target glow, a 10 degree bend, 4 cm hit area.
     - Aim assist targets are generic: goblins plus any `SlingTarget` added with `slingshot.addTarget()`. The step 5 triggers (boulder, tree, keg) must register this way.
     - Pebbles thrown by hand only knock a goblin back, dazed (half assist, goblins only, never set off triggers).
     - A held goblin can be loaded into the pouch: it knocks out what it hits and knocks back goblins around it, at the cost of a meal.
     - Debug keys: L shoot, O load a pebble, J load a goblin, U and I empty and fill the bowl.
     - Not done yet: re-run the stress test and log it in [performance.md](performance.md).
3. **Waves and flags:** blueprint loader and `tutorial.json`, road graph, camps, seeded random, the tutorial director, both flags, win and lose panels.
   - Done when: the 5 tutorial waves play from start to win, debug keys skip a wave and lose the castle, and the director and win/lose tests pass.
   - **Built (2026-11-04), waiting for the headset test.** What is in it:
     - Blueprint `src/maps/tutorial.json` (4 camps, junctions, a ring road with gaps, 6 wall entries, gate and trigger spots for step 5), checked by `src/rules/blueprint.ts`.
     - Road graph `src/rules/roadGraph.ts`: weighted random at junctions, shorter routes more likely, roads can close (goblins on it turn back). Nothing closes a road yet (trees come in step 5).
     - Waves `src/units/waveSpawner.ts`: camps rumble, small groups, a calm start and a push at the end, camps sink as their goblins come out. Numbers in `TUTORIAL_WAVES` (`src/director/tutorial.ts`) and `WAVES`.
     - Director `src/rules/director.ts` and the step list in `src/director/tutorial.ts`. Wave 1 waits for a goblin to be eaten (a climber pops up in front), wave 2 for a slingshot hit. Steps for tools not built yet are skipped.
     - Castle health in `src/rules/battle.ts` (`CASTLE_HEALTH`): wall hits and intruders damage it, each breather repairs 35% of the damage.
     - Both flags (`src/world/flags.ts`) in boardLift: they rise with the board, never spin.
     - Win and lose panels with a round poke button (`src/ui/endPanel.ts`). Text is a canvas texture like the FPS panel, not IWSDK UI.
     - The battle starts when the start page button is pressed (after the board is placed in VR). Leaving VR ends it. The slingshot is hidden until wave 2, then poofs in and glows until grabbed.
     - Debug keys: W skip wave, S skip tutorial step, H lose castle, D damage castle, A restart battle. The stress test stops the battle.
     - Guided tutorial with text (see "Tutorial director"): hint sign `src/ui/hintSign.ts`, markers `src/ui/markers.ts`, Kenney UI images through `src/ui/uiImages.ts`. The win and lose panels use the same images.
4. **Fly swatter, pepper shaker, food jar and pips.**
   - Done when: each tool works, costs food, shows Locked without enough food, and the food tests pass.
5. **Triggers, troops, megaphone, bell and mic permission.** The bell must be in before submission (voice is never required). Each trigger registers with the slingshot as a `SlingTarget` (`src/tools/slingshot.ts`), so the aim assist and hits already work for it.
   - Done when: a debug key triggers the megaphone, and the bell does the same by hand.
6. **Pause:** wrist button, pause panel, auto-pause, Reset table.
   - Done when: the battle freezes and resumes, and Reset table places the board again.
7. **Juice**, then the **missing sounds** last (the ones still using `chime.mp3`).
   - Done when: every sound name in the sound config points to a real file.

If time runs short, cut from the end of this list.

### Tests

Only a few logic tests, in Vitest. No tests for visuals, hand feel or sound, and no screenshots or browser runs.

- **Tutorial director:** steps move on when their goal is met, fall back after a timeout, at most 2 fallbacks.
- **Win and lose:** clearing the last wave wins, castle health at zero loses, the breather repairs part of the damage.
- **Food and tool costs:** eating adds food, a tool cannot be used without enough food, food carries over between waves.

To make these testable, game rules live in plain TypeScript functions with no Three.js or IWSDK imports. Do not add tests for anything else (seeded random, handle math, config counts).

### Left to the coding agent

- **Tuning numbers:** the agent picks sensible starting values and keeps them in config files. For example pebble bowl size and refill rate, how long an ignored climber waits, stun length, how long a fallen tree blocks a road, troop strength and spawn rate, castle damage and repair amounts, enemy speeds and group sizes, step timeouts, and any other number the docs do not give.
- **Layout of the fixed things around the player:** tool platforms (and which tool sits on which), the ring handle, flags, food jar and pebble bowl. Nothing overlaps, and everything is within about 60 cm of the seat.
- **Where the troop gate sits** on the road graph.

---

## Not in the MVP

| Feature | Where it is described |
|---|---|
| Castle machines (including the arrow machine) | [castle-machines.md](castle-machines.md) |
| Other enemy types: shield, balloon riders, Boom goblin, tinker | [enemies.md](enemies.md) |
| Other map features: bridge, forest, mud, hill | [map.md](map.md) |
| Daily Battle, Endless, Custom Game, menu board, trophy shelf, achievements, growing kingdom | [modes-and-progression.md](modes-and-progression.md) |
| Level generator and the config-based wave director | [map.md](map.md#8-levels-and-the-level-generator) |
| AR (passthrough) mode | [controls-and-ui.md](controls-and-ui.md) |
| Installable app (PWA) and Store packaging | [README](../README.md#hosting-and-the-quest-browser) |
| Real models for the placeholder shapes (tools, handles, bell) | [placeholder-shapes.md](placeholder-shapes.md) |
| Prisoner carts | [giant-tools.md](giant-tools.md) |
| Picking up and placing troops | [core-loop.md](core-loop.md) |
| Difficulty slider | [controls-and-ui.md](controls-and-ui.md) |
| Slingshot menu and first-run tutorial | [controls-and-ui.md](controls-and-ui.md) |
| Star rating and "retry from this wave" | [castle-rules.md](castle-rules.md#5-later-not-in-the-mvp) |
| Settings menu | [controls-and-ui.md](controls-and-ui.md) |
| Other accessibility features: quiet mode setting, mic calibration, handedness, snap rotation, reduced effects, visual threat cues (smoke) | [controls-and-ui.md](controls-and-ui.md) |
| Food powers | not designed yet |
| Boss | not designed yet |
| River and boats | not designed yet |
| Voice commands | README |
| Gate mechanics | later |
