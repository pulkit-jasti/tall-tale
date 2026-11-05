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
- A single Play button in VR (a simple shape, no menu board yet). Built in step 3: a small "Welcome, giant!" panel with a round poke button appears once the board is placed, and the tutorial starts when it is poked (the same panel and button as Play again).
- Board placed automatically when Play is pressed.
- Pause with a wrist button, plus auto-pause on the Quest menu. Pause panel: Resume, Reset table, Restart battle ([controls-and-ui.md](controls-and-ui.md#5-pause-and-settings)).
- End of battle: a simple win ("Congratulations") or lose panel with a button to play again ([castle-rules.md](castle-rules.md#4-end-of-battle-screens-mvp)).

**Player**
- Body abilities: **grab and eat only** ([controls-and-ui.md](controls-and-ui.md#3-grab-and-eat)). Goblins are picked up with a pinch. The pinch zone is bigger than the goblin and snaps to the nearest one.
- **All 4 giant tools:** slingshot, fly swatter, pepper shaker, megaphone ([giant-tools.md](giant-tools.md)). This is the most satisfying part, so it is the main thing to test. The megaphone uses a fixed loudness threshold for now (no calibration). **The bell** triggers the same stun by shaking, so voice is never required. Only one of the two is ever out: the megaphone when mic permission is given, the bell when it is not (a setting to pick the bell with the mic on comes later). A debug key also triggers the stun, for testing without a mic.
- No loadout, no unlocks. Each tool appears on its platform in its tutorial wave with a poof, and glows until grabbed. The tutorial's hint sign then teaches it step by step.
- Slingshot aim assist ([giant-tools.md](giant-tools.md#slingshot-aim-assist)).
- Food currency: eating fills the food jar, tools cost food. Start with 4 food. Food carries over between waves.
- Tool platforms beside the player, just outside the ring handle, each food tool with a price tag (a food ball and the cost).

**Enemies and army**
- **Grunts, runners and climbers**, plus **balloon riders** from build step 7 ([enemies.md](enemies.md)). Climbers are the main food source.
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
  - **Hint sign:** in front of the player (position below). It rises with the board, never spins and never follows the head. Kenney UI images (`public/ui/`) on a canvas texture. Shows "Step 3 of 8" for lessons and "Wave 2 of 5" banners for waves. **While a wave is fought it is gone**, so it never covers the enemies: after the wave banner's Next it disappears and comes back when the wave is cleared, or for a lesson. No goblin counter: the blue flag shows the progress.
  - **Marker:** a "!" with a down arrow above the target, drawn on top so the wall never hides it.
  - **Out of view:** nothing for now. (The arrows on the ring and the "it is to your left" line on the sign, from a head direction check, were removed after the step 4 review. A simple pointer arrow comes later.)
  - **Ghost hand:** a see-through 3D hand loops the gesture on the real target (Meta's onboarding guidance: animated hand demonstrations). It steps aside while the player's own hand is there. Demos are data in `src/ui/ghostDemos.ts`. After the first headset test (angles were wrong and hands went through the ring and the bowl), the hand is turned by named directions (bar or fingers, and palm) matched to axes measured from its own joints, a fist closes around the bar's center line, a pinch puts the tips on the object, and every approach comes from the open side. The accuracy rules are in AGENTS.md ("Ghost hand demos").
  - **Hint sign position:** it sits past the goblins at the front wall (62 cm out since the castle grew, bottom edge 43 cm above the board, just below the eyes), so it is behind them, never in front of them, and covers only the far edge of the board. It is out of reach, so the **Next button stands apart**, on a post straight in front between the tool platforms, in the reach band (33.5 cm out, 9 cm up).
  - **Next button:** one click per push. After a click the finger must come back out about 2 cm and 0.6 s must pass, and a new step ignores it for 1 s, so a slow or resting finger never skips several steps.
  - **Flags** are explained before wave 1 starts ("Your castle"), while nothing attacks.
  - **Climbers** always climb between two towers (`CASTLE.towerClearDeg`), and the map's wall entries sit in the middle of the tower gaps.
  - **Marker:** one bouncing down arrow over the target.
  - **Info steps** (wave banners, the flags, "wave cleared" and new tool breathers) only move on when the player pokes "Next" on the sign. Not by time, and not by looking at something: a player may turn toward a thing without noticing it, so they always get as long as they need. Only lessons, where the player does something with their hands, move on by themselves when it is done.
  - **New things are taught before their wave**, so no enemies press the player while learning. Lessons that need enemies (shooting a goblin) run at half the spawn rate.
- **The reach check comes first**, once per player: "Show me how big you are, giant!" sizes the board to their arms ([controls-and-ui.md](controls-and-ui.md#reach-check-show-me-how-big-you-are-giant)). It also runs before a debug "Start at wave" when the reach is not known yet.
- Lessons in the MVP: spin the board, set its height, pinch the climber, eat it, then (before wave 2) grab the slingshot, take a pebble, load it, and shoot (any shot counts, hit or miss: the player has learned how it works). Before wave 3 the **food jar** (below), then grab the swatter, then swat one goblin; before wave 4 grab the pepper, then pepper goblins; before wave 5 grab the megaphone (or the bell without a mic), read how it works (its own box, Next), then stun goblins. One new tool per breather, so only one thing ever appears at a time. Wave banners and the two flags are explained as the battle starts.
- **The food jar is taught right before the first food tool**, where food starts to matter (it used to be one info step before wave 1, which was easy to miss): "Wave cleared! This jar on your left holds your food..." (Next), then a climber pops up and the player eats it and watches the jar fill. Then the swatter appears with its price tag, and the grab lesson says "Tools cost food. Here is the fly swatter: its price tag says 4 food."
- **A new tool is taught by actions only, never with Next** (the food jar's info step is the one exception). When a wave is cleared and a new tool comes, its first lesson starts at once, and the tool appears with it. The wave that brings it starts straight into its use lesson, with no banner in between. Tool lessons count from the moment the tool appears, so steps the player already did are never asked again.
- **Food tool use lessons:** done as soon as one goblin is hit, anywhere. While one runs, the tool's use timer is held, so a player who pays with an early swat before the goblins arrive keeps the tool until they do (after the step 4 headset test, the timer ran out first and the tool went back to its platform). The timer starts with its full time when the lesson ends. The lesson waits up to 120 s (the goblins first walk to the wall) and also ends if the wave is cleared another way.
- **Lesson climbers during a wave** wait on the rampart like any climber (8 s), not 90 s, so a fallback climber never holds the wave up long after its lesson.

### Rules that keep it safe

- **Keep fallbacks simple:** at most two. First repeat the step, then make it easier.
- **It must never get stuck.** Every lesson has a timeout (for example 60 seconds) that moves on anyway. A judge who cannot do something still sees the rest of the game. Info steps have no timeout: they wait for the "Next" button, which always works. **Waves have no timer either:** a wave ends when it is cleared or the castle falls, so a player who ignores it loses. Only a stalemate ends a wave early: every goblin is out, some are left far away, and nothing has hurt the castle for 60 seconds (`CASTLE_HEALTH.stalemateSeconds`), so the leftovers run off. A goblin at or on the wall, in the courtyard, or held (in a hand or the slingshot) always blocks it: the player can still deal with that one. There is only ever one lesson climber: a fallback moves it in front of the player again instead of adding another.
- **Enemies keep coming while a step waits, but at half the spawn rate.** It still feels like a battle, without piling up on a player who is still learning.
- **The full step list** (start, goal and fallback for each step) is written and built by the coding agent in build step 3. The developer tunes it after playing it.

### Tutorial waves

Starting numbers, kept next to the director's steps and tuned in playtests. Climbers are the food source, so their count keeps food in step with tool costs (start 4, max 10).

**Since build step 5 the code uses the numbers below** (`TUTORIAL_WAVES` in `src/director/tutorial.ts`), with lower castle damage (`CASTLE_HEALTH`), balanced with the troops. Steps 3 and 4 used small test waves. "Start at wave" on the debug page skips the early waves for quick tests.

| Wave | New thing | Camps | Grunts | Runners | Climbers | Food check |
|---|---|---|---|---|---|---|
| 1 | Hands and eating. One climber is scripted to pop up right in front of the player in the first minute. | 1 | 6 | 0 | 3 | 4 + 3 = 7 |
| 2 | Slingshot, then the trigger lesson right after it (shoot a powder keg as goblins pass; boulders and trees explained). From here on all three trigger kinds stand on the roads (build step 6). | 2 | 10 | 0 | 2 | 7 + 2 = 9 |
| 3 | Fly swatter vs runners | 2 | 8 | 12 | 3 | 9 - 4 + 3 = 8 |
| 4 | Pepper shaker. The first balloon riders (build step 7). | 3 | 14 | 8 | 4 | Up to 10 |
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
   - **Done (2026-11-04), headset test passed.** What is in it:
     - Blueprint `src/maps/tutorial.json` (4 camps, junctions, a ring road with gaps, 6 wall entries in the middle of the tower gaps, gate and trigger spots for step 5), checked by `src/rules/blueprint.ts`. The toy test roads (`toyMap.ts`) are gone.
     - Road graph `src/rules/roadGraph.ts`: weighted random at junctions, shorter routes more likely, roads can close (goblins on it turn back). Nothing closes a road yet (trees come in step 5).
     - Waves `src/units/waveSpawner.ts`: camps rumble, small groups, a calm start and a push at the end, camps sink as their goblins come out. Numbers in `TUTORIAL_WAVES` (`src/director/tutorial.ts`) and `WAVES`. **For now small test waves and high castle damage**, balanced with troops in step 5.
     - Waves have no timer: a wave ends when cleared or when the castle falls. A stalemate check ends one only if goblins are stuck far away (see "Rules that keep it safe").
     - Director `src/rules/director.ts` and the step list in `src/director/tutorial.ts`: a guided, learn-by-doing tutorial with text (see "Tutorial director"). Hand lessons move on when the player does them, info steps wait for Next, tools are taught by actions only. Steps for tools not built yet are left out.
     - Castle health in `src/rules/battle.ts` (`CASTLE_HEALTH`): wall hits and intruders damage it, each breather repairs 35% of the damage.
     - Both flags (`src/world/flags.ts`) in boardLift: they rise with the board, never spin. Explained before wave 1.
     - Welcome panel with a Play button, and win and lose panels with Play again (`src/ui/endPanel.ts`). One shared poke button for every button (`src/ui/pokeButton.ts`), with icons drawn in code.
     - Hint sign `src/ui/hintSign.ts` (hidden while a wave is fought), markers `src/ui/markers.ts`, ghost hands `src/ui/ghostHand.ts` and `src/ui/ghostDemos.ts` (accuracy rules in AGENTS.md), Kenney UI images through `src/ui/uiImages.ts`.
     - Slingshot pouch is now an open upright leather strip, so a loaded stone stays in view.
     - The welcome panel shows when the start page button is pressed (after the board is placed in VR). Leaving VR ends the battle. The slingshot is hidden until wave 2.
     - Debug keys: W skip wave, S skip tutorial step, H lose castle, D damage castle, A start or restart the battle. The stress test stops the battle.
     - Not done on purpose: the stress test waits until the game is built further. Gameplay feels smooth on the headset for now.
4. **Fly swatter, pepper shaker, food jar and price tags** (first built with food pips).
   - Done when: each tool works, costs food, shows Locked without enough food, and the food tests pass.
   - **Done (2026-11-04), headset test passed** after five rounds of headset tests and fixes (listed below). The first build ([giant-tools.md](giant-tools.md)):
     - Food rules `src/rules/food.ts` (start 4, max 10, +1 per goblin, +2 seasoned, costs and use timers in `FOOD` and `TOOLS`), tested in `food.test.ts`. Food carries over between waves and resets for a new battle.
     - Food jar `src/world/foodJar.ts`: a pot between the two left platforms with one food ball per food on its mouth.
     - Shared food tool `src/tools/handTool.ts`: platform, price tag (first pips), fist grab, follows the hand, grabbing is free, the first use pays, Locked (dimmed, rope, wobble, buzz), dropped mid-use it floats back to the hand area, use over it shrinks, poofs and pops back. The megaphone and bell in step 5 build on it.
     - Fly swatter `src/tools/flySwatter.ts` (10 s, 4 food) and pepper shaker `src/tools/pepperShaker.ts` (8 s, 3 food, seasoned goblins).
     - Tutorial: a "food jar" info step after the flags, and for each new tool a grab lesson in the breather and a use lesson in its wave (swatter wave 3, pepper wave 4). Without enough food the use lesson says so and a climber pops up to eat. The easier fallback tops up the jar. Ghost hand demos `swatterGrab` and `pepperGrab` (left hand, need a headset check).
     - Debug keys: Y add 3 food, 0 empty the jar, 1 show both tools now, 2 swat the front of the wall, 3 pepper the front of the wall.
   - **Changes from the headset tests (2026-11-04), all tested and passed:**
     - **Reach band** ([controls-and-ui.md](controls-and-ui.md#reach-band-where-interactive-things-go)): every grab, pinch and poke target is 40 to 50 cm from the eyes (rare ones up to 58). `REACH` in config, a dev warning at start (`src/rules/reach.ts`).
     - **Bigger castle:** wall 46 to 52 cm (was 40 to 46), courtyard 40 to 44, rampart 49, map wall entries and inner roads 6 cm further out. All courtyard houses, stalls and crates removed until the main gameplay is done.
     - **Tools outside the ring:** platforms, pebble bowl and food jar 33.5 cm out (were 19), low (tops 6 cm above the board, were 10), in boardLift: they rise with the board, never turn. Flags just behind them (38.5 cm).
     - **Price tags** replace the food pips: a food ball and the cost as a number on each food tool's platform (`src/ui/priceTag.ts`).
     - **Tutorial:** the food jar lesson moved to right before the swatter, tools appear with their first lesson, food tool use lessons hold the tool timer and finish on one goblin hit (see "Tutorial director").
     - **Removed:** the out-of-view arrows on the ring and the "it is to your left" line on the sign.
     - **Hint sign** 62 cm out and a little bigger, its Next button on its own post in front, in reach.
     - **Reach check** after the second test (everything still felt too close): the first tutorial step measures the player's reach and scales the whole board so the rampart sits at 88% of it. The board is also placed lower (46 cm below the eyes, was 36, then 40 after the third test), so the player towers over the kingdom. Debug page: "Measure reach again".
     - **Tool grips** after the third test: a fist grab snaps the tool into the hand the way it is held in real life (swatter face square to the palm, pepper holes above the thumb, slingshot fork up and shooting the way the knuckles point), instead of keeping the grab angle ([controls-and-ui.md](controls-and-ui.md#holding-a-tool)).
     - **Threat cues** after the third test (goblins at the wall were hard to find with the sound off): the wall top flashes red with a dust puff on each hit ([controls-and-ui.md](controls-and-ui.md#threat-cues)). An attack compass arc was tried and removed after the fourth test.
     - **Grip slant** after the fourth test: held tools lean forward 35 degrees from the knuckle line (first 25), like a real handle across the palm. The swatter leans 45, so its head reaches the ground easily, and its flat face stands square to the palm.
     - **Compass letters** on the ring, turning with the board: all 8 directions in raised blocky gold like the bands, the main four bigger (first tried as 4 wooden plaques).
     - **Tools free in the tutorial** (`TOOLS.freeInTutorial`): a player who used up the jar on the swatter could not pick up the pepper. Price tags say "Free", and the lessons say tools cost food but are free while learning.
     - **Debug page** sorted into sections with icons. New: "Start at wave 1 to 5" (earlier lessons and waves left out, earlier tools out, a little more food; Play keeps starting there in this tab until "Restart game") and "Restart game". The pages table shows each page's tutorial step. The FPS panel is hidden by default (debug page or key F turns it on).
   - **Postponed from step 4** (decided, not forgotten):
     - **Food jar look:** it still reads like another tool stand. Idea: a low "tribute tray" piled with drumsticks (one per food), no post, and the same drumstick icon on the price tags. Needs a food model (Kenney Food Kit is CC0, but a new asset pack needs the developer's OK) or a code-made drumstick. Polish step.
     - **Courtyard houses, stalls and workers:** removed to keep the castle clear while the gameplay is built. They come back with the polish.
     - **Locked tools and food costs in play:** tools are free in the tutorial, so the Locked look (dim, rope, buzz) and paying food are only seen with `TOOLS.freeInTutorial` off. They matter once there is a battle after the tutorial (Endless or Daily Battle).
     - **Pointer to things out of view:** the head direction hints were removed. A simple pointer arrow comes later, if playtests show the marker alone is not enough.
     - **"Measure reach again"** for players: only on the debug page for now. It goes in the pause menu (step 6).
     - **Directions in the hints:** the compass letters on the ring can name where goblins come from ("Goblins from the east!") in wave banners and lessons.
     - **Stress test:** not re-run since step 2. Run it after step 5, since troops add the most units, and log it in [performance.md](performance.md).
     - **Controller grip:** the fist frame for controllers is a rough guess from the grip space (controllers are low priority).
5. **Triggers, troops, megaphone, bell and mic permission.** The bell must be in before submission (voice is never required). Each trigger registers with the slingshot as a `SlingTarget` (`src/tools/slingshot.ts`), so the aim assist and hits already work for it.
   - Done when: a debug key triggers the megaphone, and the bell does the same by hand.
   - **Carry over from step 4:** the megaphone and the bell build on the shared food tool (`src/tools/handTool.ts`): each needs a real grip pose in `HOLD.poses`, a price tag (free in the tutorial), its grab and use spots in `reachSpots()` (`src/rules/reach.ts`), and ghost hand demos with the same grip slant. Anything new that hurts the castle must show on the wall (threat cues). Board distances turned into meters by hand multiply by `stage.boardScale` (the reach check).
   - **Built (2026-11-04), needs a headset test.** What is in it:
     - **Triggers** `src/world/triggers.ts`: powder keg (wave 2), boulder and leaning tree (wave 4), from the blueprint's trigger spots, each on the nearest road. Each registers with the slingshot (`addTarget`), so the aim assist bends toward it, and it glows and wobbles while aimed at. Keg: a blast knocks out goblins within 13 cm and sets off triggers within 30 cm (chain reactions). Boulder: rolls off its hill onto the road and down it toward the castle, squashing goblins in its line, then crumbles. Tree: falls across the road, squashes the goblins under it, and closes the road for 12 s (goblins on it turn back, the road graph routes around it). Each resets at the start of each wave. Pooled planks and wood fly out. Numbers in `TRIGGERS`.
     - **Troops** `src/units/troops.ts`: while a wave runs, a squad of 3 to 4 soldiers (some archers, same rules) comes out every 10 s (cap 12), walks the roads outward toward the wave's camps in turn, and fights goblins within 4 cm with simple timed hits (soldiers take 2 hits, goblins 1, runners rush past). They walk home at the camp or when the wave ends. The gate is hidden: each squad leaves through the wall entry at the castle end of its camp's shortest road (`RoadGraph.routeToWall`), so troops reach every camp even where the ring road has gaps. The blueprint's `gate` is kept for later gate mechanics. Numbers in `TROOPS`.
     - **Megaphone** `src/tools/megaphone.ts` and **bell** `src/tools/bell.ts`, side by side on one wider platform on the right (bell in front at 77 degrees, megaphone behind at 88), one price tag (6 food each use, free in the tutorial). Grab the megaphone and scream: mic loudness over `MEGAPHONE.screamLevel` for 0.12 s stuns every goblin (3.5 s), screaming on adds more (up to 8 s). Grab the bell and shake it: two strokes are a ring, harder shaking stuns longer, ringing on adds more. One use each, then a 2.5 s window, then the tool goes back to its platform. Stunned goblins freeze with two dizzy stars over the head (one instanced mesh), and a shock ring runs out across the board (`src/tools/stunWave.ts`, `STUN`).
     - **Mic permission** `src/audio/mic.ts` on the 2D start page: the first tap asks for the mic, then the button says "Enter VR" (the browser only opens VR right after a tap). Allowed before: the mic opens at load and one tap enters VR. Denied: the bell comes instead of the megaphone.
     - **Tutorial:** before wave 4, after the pepper grab lesson, "One more!" brings the megaphone and the bell (grab the bell), and in wave 4, after the pepper use lesson, a stun lesson (shake the bell or shout into the megaphone) with ghost hand demos `bellGrab` and `bellRing` (right hand, need a headset check). The real wave numbers from the table above are back.
     - **Sky** `src/world/sky.ts` (decor only): a sun (two unlit discs) and 11 low-poly clouds (one instanced mesh, 55 puffs) drifting slowly with the wind in front of the scene's gradient dome. Never turns with the board. `SKY.enabled` turns it off (for AR later).
     - **Performance:** far goblins and soldiers (over 150 cm out) update their animation every other frame, and grab and eat no longer makes a new Set every frame ([performance.md](performance.md) section 5).
     - Debug keys: 4 megaphone scream (works without a mic), 5 ring the bell, 6 send a squad, 7 reset every trigger now, 8 set off every trigger, 9 troops on or off. 1 now shows the food tools.
   - **Changes after the first step 5 review (2026-11-04), need a headset test:**
     - **One tool at a time:** the megaphone moved to its own breather before wave 5 (it came with the pepper before wave 4), and only one stun tool is ever out: the megaphone with a mic, the bell without (the battle picks it, `Battle.stunTool`). Each has its own platform at the same spot (82 degrees). The megaphone's grab lesson is followed by its own info box, "How to shout" (Next), in plain words about the bar and the red dot. Ghost demos `megaphoneGrab` and `megaphoneShout`.
     - **Megaphone:** the scream level is lowered (0.12 to 0.04). A thin loudness meter lies on top of the cone while it is held: it fills in real time (green, yellow near the target, red past it), and a pulsing red dot with a notch marks the scream level at 80% of the bar. The mic chain now ends in a silent output, in case the browser only runs nodes that lead to the speakers. The debug page's new mic column shows the loudest level while the megaphone is held, to tune `MEGAPHONE.screamLevel`.
     - **Sky:** a bright cartoon sun (orange rim, yellow face, a shine spot, 14 pointy rays turning slowly, a warm glow) and 26 white clouds (156 puffs, still one instanced mesh), unlit with a light blue underside baked in, lower and closer (3 to 10 m up, 14 to 70 m out). **Flicker fix:** the near plane was 0.001 m, so far away the depth buffer could not tell apart things a meter or two apart (overlapping puffs, the sun's layers). Now sky pieces never write depth and draw in a fixed order (`renderOrder`, clouds sorted far to near twice a second), and the near plane is 1 cm (`iwsdk.config.json`).
     - **Hills** `src/world/hills.ts` (decor only): a grass ring past the board's edge with 34 small green hills (in boardLift, so they rise and size with the board, never turn) and 26 big hazy hills far away (world). Three draw calls. The fog now runs from 5 to 24 m (was 3.5 to 9), so the hills fade softly into the sky.
   - **Changes after the second step 5 review (2026-11-04), need a headset test:**
     - **Made to scale:** clouds and hills now live in boardLift (cm), sized against the 3.5 cm goblins and 6 to 12 cm trees, so the player towers over them: 90 small clouds (450 puffs, still one draw call) about chin high near the board, never over the battlefield, and four rings of hills, light green near, darker green, dark green peaks, then brown mountains at the back. The hills are closed shapes now, and the ground ring faces up (it faced down before, which is why the sky showed through).
     - **3D sun:** a faceted ball with baked shading and pyramid rays (`src/world/sky.ts`).
     - **Fewer soldiers for testing:** at most 4, squads of 2 every 16 s (`TROOPS`). Debug key 9 turns the troops off and on.
   - **Changes after the third step 5 review (2026-11-04), need a headset test:**
     - **Still only the board turns** (a whole-world turn was tried and dropped: too likely to cause motion sickness). A comfort setting that turns the board in snap steps comes later.
     - **Sun** 35 degrees right of the first view, low like a morning sun, so the sunrise glow is in view. The sunlight comes from the same side, higher (45 degrees).
     - **Sunrise glow:** our own sky dome replaces the IWSDK `DomeGradient`: blue top, pale horizon, a wide orange and a tight yellow glow around the sun, strongest on the horizon. One draw call.
     - **High clouds** over the board and the giant's head (22, 1.2 to 2.6 m above the board), in the same instanced mesh.
     - **Fog on the hills:** none until just past the board, thicker farther out (6.6 to 32 m, grows with the board size), in the horizon color, so the last mountains fade into the sky.
     - **Denser hills:** about twice as many, in overlapping rings, so there are no flat gaps.
     - **Megaphone lesson:** one step to grab, one to use. The "How to shout" box is gone; the shout lesson text explains the bar and the red dot.
     - **Hint sign higher:** its bottom edge is just below eye height (`HINT_SIGN.y` 43, was 12; 48 felt too high), tipped a little toward the eyes, so it only covers the far edge of the board. The Next button stays in reach.
     - **Welcome, win and lose panel** a little back and up (`END_PANEL` 41 cm out, middle 24 cm up, were 36 and 20). Its button stays in the best reach band (about 48 cm from the eyes). The reach check now counts the panel's tilt.
     - **Hilly low-poly ground** `src/world/terrain.ts` (`TERRAIN`): rolling hills and dips from 62 cm out (about 13 cm near, up to 32 cm far; tries at 2.5 and 10, then 7 and 22, still looked flat), flat shaded facets, no rings showing. Flat around the castle and right at the camps. The roads ride over the hills at three quarters height, so goblins can vanish behind a hill and pop up (on purpose). Everything on the ground uses `groundAt(x, z)` (`src/rules/boardMath.ts`), read from the mesh's own triangles: units on roads, tossed goblins, pebbles, debris, the swatter, the aim marker, camps and decor. The road ribbon sits 0.8 cm up (was 0.15). The stun ring draws over the hills.
     - **Faceted grass colors and stronger sun:** one solid color per triangle (yellow-green tops, blue-green dips, earthier steep slopes, each triangle a little different, `GRASS`). The sun is stronger (`SKY.lightIntensity` 2.2, was 1.6, 40 degrees up, was 45) and the sky fill softer (IBLGradient intensity 0.6, was 1), so sunny and shaded slopes read clearly. This also makes the shaded side of every model a little darker. The board mesh now has about 69,000 points (each triangle its own 3), still one draw call.
     - **Villages, farms, towers, a windmill and wrecks** `src/world/settlements.ts` (`SETTLEMENTS`), placed with a reason: 4 villages beside the roads between the castle and the camps (houses built from wall tiles, doors toward a square with a stall, cart, lantern and barrels, a signpost by the road), 1 or 2 fenced fields per village (one crop each), 4 watch towers on hilltops by the roads, a windmill on the highest spot near a field, a wrecked siege machine by each camp, and 7 forests in the wild ring past the camps (the tree groves grow there). Villages and fields sit on ground the terrain flattens. All merged into a few meshes (`StaticBatch` now keeps textures and groups by texture). No hit shapes: pebbles and tossed goblins pass through buildings.
     - **Camps farther out and bigger goblins:** the four camps moved about 45 cm farther out (now 227 to 277 cm from the center, were 182 to 232), with their roads' bend points moved with them, so goblins walk about 7 s longer to the wall (re-check wave timing). Goblins are about 11% bigger (grunts and climbers 3.9 cm, runners 3.35). Villages and towers now spread out to the new camp distance.
     - **Far places, past the camps** (same file and config): a goblin hamlet behind each camp (cabin, tents, campfire, cage, branch fences), a burned kingdom village (roofless houses, missing walls, a toppled cart, ash ground), 2 lumber camps at forest edges, a stone quarry on a far hillside, and 5 tall landmarks stacked from castle kit pieces on the highest far hills (tall watchtower about 23 cm, hexagon mage tower, gatehouse with flags, ruined tower with a fallen floor, small keep with four towers, walls and a hall). The hamlets, burned village and lumber camps sit on flattened ground; the wide landmarks only on hilltops that are not too steep.
     - **Cloud canopy:** 16 bigger clouds that always stay over the giant (1.5 to 3 m above the board), so looking up is never empty sky.
     - **Dense decor** (`DECOR`): about 260 trees (mostly groves), 140 rocks, 240 bushes, 260 flowers in patches, 90 mushrooms, stumps and logs, from the Nature Kit. All merged into one mesh per material (`StaticBatch` in `src/world/models.ts`), about a dozen draw calls. The kit's mint greens are tinted to match the grass. Grass colors (`GRASS`): lighter tops, darker dips, worn road edges, camp dirt. The tiny grass tufts, flowers, grain and noise patches are gone (too small to see, or blotchy).
     - **One shared panel** `src/ui/panel.ts`: the parchment board, its canvas, placement, tilt and pop. The hint sign and the end panel both use it and only draw their own content.
     - **No soldiers during lessons:** while a lesson is on the sign, no squads come out (`Troops.held`). The first squad comes 4 s after the lesson is done.
     - **Moved to later steps:** the trigger lesson and more, easier to see triggers (step 6); gear and variants for troops and goblins, the stress test with troops and the troop balance (step 7).
6. **Pause, triggers, and the giant's seat and body.** Three separate parts, built together in one step.
   - **Part A, pause:** wrist button, pause panel, auto-pause, Reset table.
     - Done when: the battle freezes and resumes, and Reset table places the board again.
   - **Part B, triggers: more of them, easy to notice, and their own lesson.** In the step 5 playtest the barrels, boulders and trees went completely unnoticed, and there is no lesson for them.
   - **More of them:** about 2 to 3 per road between the camps and the castle instead of 3 in total, all three kinds spread around the circle, so one is almost always near a group of goblins. Spots in the blueprint (`triggers` in `tutorial.json`), still one seeded layout.
   - **Easy to see:**
     - Bigger than now (keg about 3 cm, boulder 5 cm, tree 14 cm), with brighter colors than the scenery around them.
     - Never hidden by a hill: placed on the player's side of a hill or on flat ground (the terrain flattens a small spot under each, like the camps), never in a dip behind a bump.
     - The decor keeps clear of them (no trees or houses right beside a keg).
     - A soft pulsing glow (emissive only) and a small floating icon above each one while goblins are near it, so the player sees "this can be used now".
     - A short "now!" cue when a group walks right past one: a stronger glow pulse and a sound from its direction.
   - **The lesson, in wave 2, right after the slingshot lesson** (everything here is set off by the slingshot, so it is taught as soon as the player can shoot):
     - The wave holds its spawns. A small group of goblins walks toward a powder keg on the road in front of the player.
     - The hint sign: "See the barrel? Shoot it when goblins walk past!" The marker bounces over the keg, and a ghost hand shows aiming at it and letting go.
     - Done when the keg is set off (best with goblins near it). If stuck, the group is sent past the keg again and the marker pulses.
     - Then a short info box (Next): "Boulders roll down the road and trees fall across it. Shoot them too!", with the marker on the nearest boulder and tree. From then on all three kinds stand on the roads.
     - The wave 5 banner keeps its reminder.
   - Triggers done when: they are easy to spot from the seat, the wave 2 lesson runs from start to finish, and the director tests cover the new steps.
   - **Part C, the giant's seat and body.**
   - **Fill the hole:** today looking down shows blue emptiness and brown walls. Close it with ground at board level, flush with the courtyard (stone or packed earth to match the castle).
   - **The giant from the waist up**, coming out of that ground: a chunky, low-poly belt, tunic, belly and shoulders (no legs; no arms, since the tracked hands float, which is normal in VR). The hole (25 cm) is about exactly a seated giant's torso, so it fits.
   - **Follows the player gently:** it sits under the head and turns slowly toward where the player faces (not 1:1, so leaning never looks wrong).
   - **Never in the way:** below and a bit behind the normal view; it shows when looking down, but never blocks the courtyard, the tools or the reach band.
   - **Stylized**, matching the low-poly look: a realistic body that does not match the real one feels wrong.
   - Seat and body done when: looking down shows the giant's body on solid ground from the seat, from more than one head angle, and nothing interactive is covered.
7. **Army and enemy variety.**
   - **Troop variants, built in code (no model editing):**
     - Bodies from the Kenney character packs we already have (mini-arena, mini-dungeon, mini-forest), which share the same animations.
     - Recolored materials per variant (the kingdom's blue and gold).
     - Gear on the hand bone, so it moves with the animation: swords, spears and shields from the mini-arena and mini-dungeon props.
     - Small proportion changes per variant.
     - About three readable kinds: swordsmen, spearmen and archers.
   - **Goblin gear:** the same way (weapons on the hand bone, helmets on the head bone).
   - **Balloon riders** ([enemies.md](enemies.md#balloon-riders)), the first flying enemy:
     - Goblins hanging under a balloon, floating over the wall at about head height in straight lines (no roads).
     - They drop goblins into the courtyard (they become intruders, food in reach).
     - The slingshot pops the balloon and the riders fall; grabbing or swatting works when close; the megaphone and bell stun them.
     - First seen in wave 4 with a short banner ("Look up! Pop the balloons with your slingshot.").
     - A threat cue when one is over the wall (threat cues rule).
   - **Then the stress test with troops** (log it in [performance.md](performance.md)), and the **troop balance** (now at most 4 soldiers in squads of 2 for testing; the plan was up to 12).
   - Done when: three troop kinds and the goblins carry gear, balloon riders work in wave 4, and the stress test result is logged.
8. **Juice**, then the **missing sounds** last (the ones still using `chime.mp3`).
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
- **Layout of the fixed things around the player:** tool platforms (and which tool sits on which), the ring handle, flags, food jar and pebble bowl. Nothing overlaps, and every interactive thing is in the reach band ([controls-and-ui.md](controls-and-ui.md#reach-band-where-interactive-things-go)).
- **Where the troop gate sits** on the road graph.

---

## Not in the MVP

| Feature | Where it is described |
|---|---|
| Castle machines (including the arrow machine) | [castle-machines.md](castle-machines.md) |
| Other enemy types: shield, Boom goblin, tinker (balloon riders moved into build step 7) | [enemies.md](enemies.md) |
| Day and night cycle (far future) | [Far future ideas](#far-future-ideas) below |
| Stylized giant hands (far future, experimental) | [Far future ideas](#far-future-ideas) below |
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
| Other accessibility features: quiet mode setting, mic calibration, handedness, snap rotation, reduced effects, more visual threat cues (smoke at camps; the wall flash is in) | [controls-and-ui.md](controls-and-ui.md) |
| Food powers | not designed yet |
| Boss | not designed yet |
| River and boats | not designed yet |
| Voice commands | README |
| Gate mechanics | later |

### Far future ideas

Only after the MVP and its polish are done. Details agreed so far:

**Day and night cycle**
- **Time moves with the waves, not a clock:** wave 1 in the morning, the middle waves at noon and in the afternoon, wave 4 at sunset, the final wave at night. It shifts smoothly during the breathers, so the final battle at night is the dramatic high point.
- **What changes:** the sun moves, sets and turns orange; the sky dome and fog colors shift; the sky fill dims to a moonlit blue; the clouds turn orange, then grey-blue; stars fade in (one cheap mesh of points) and a moon with a soft glow rises.
- **Night lights:** torches on the castle wall and in the villages, glowing village windows, maybe fireflies. All faked with bright emissive flames and soft glow sprites, at most one or two real lights (many real lights hurt the Quest frame rate).
- **Readability first:** the night stays a bright moonlit blue, never dark, so goblins are always easy to spot. This is the hardest part to get right.
- Effort: medium to high. The sky dome, fog and sun setup from step 5 already do most of the groundwork.

**Stylized giant hands (experimental)**
- The see-through hands work well today, and a solid hand would cover the goblins at the most important moment (the pinch). So this is a test, not a plan.
- The idea: a stylized giant hand (skin tone, chunky fingers), still partly see-through (about 60%) with a brighter edge, fading even more while it is near a goblin or pinching.
- Behind a debug toggle, to compare with the current hands in the headset. Keep it only if it looks better without hiding anything.
