# MVP: First Playable Build

Goal: test the core gameplay loop in the headset as early as possible. Everything else waits until after the first playtest.

Back to [GDD index](GDD.md).

---

## In the MVP

**World**
- The raised board, the castle with its low wall and courtyard ([map.md](map.md)). Courtyard workers come back with the polish.
- Full 360 degree board. The player spins it and sets its height with the ring handle ([controls-and-ui.md](controls-and-ui.md#2-the-360-degree-board)).
- Low wall (about 6 cm) and wall attackers standing a little out from it, so there is no hidden strip ([map.md](map.md#no-hidden-strip-outside-the-wall)).
- Roads and enemy camps (sand and rock hills, bigger camp means more enemies).
- Triggers: boulder, powder keg and leaning tree only.
- Hidden gate at the front as the troop spawner.
- Two flags in front of the player (castle health and wave progress). They stay still when the board spins ([castle-rules.md](castle-rules.md#2-the-two-flags)).
- Real models from [assets.md](assets.md). Simple shapes only for the things in [placeholder-shapes.md](placeholder-shapes.md). Scale is in [map.md](map.md#scale-from-the-mockup).
- The giant's seat (packed earth filling the hole) and a chunky low-poly giant body from the waist up under the head.

**Rules and pacing**
- **Only the tutorial battle:** 5 hand-crafted waves, about 8 minutes, each wave introducing a tool (table below). A hand-made map blueprint, a scripted tutorial director in code, and a fixed seed. No level generator ([map.md](map.md#8-levels-and-the-level-generator)).
- Waves with a gentle intensity curve and short breathers ([core-loop.md](core-loop.md)).
- Win by surviving all waves, lose when the castle health flag reaches the bottom ([castle-rules.md](castle-rules.md)).
- Grunts and runners stop at the wall and hit it. Only climbers climb. Ignored climbers jump into the courtyard and become intruders.

**Menus**
- A 2D start page with one "Enter VR" button. It asks for mic permission before entering VR.
- A small "Welcome, giant!" panel with a round Play button once the board is placed in VR. The same panel and button are used for Play again.
- Board placed automatically when Play is pressed.
- Pause with a button on the left palm, plus auto-pause on the Quest menu. Pause panel: Resume, Reset table, Measure reach, Restart ([controls-and-ui.md](controls-and-ui.md#5-pause-and-settings)).
- End of battle: a simple win ("Congratulations") or lose panel with a button to play again ([castle-rules.md](castle-rules.md#4-end-of-battle-screens-mvp)).

**Player**
- Body abilities: **grab and eat only** ([controls-and-ui.md](controls-and-ui.md#3-grab-and-eat)). Goblins are picked up with a pinch. The pinch zone is bigger than the goblin and snaps to the nearest one.
- **All 4 giant tools:** slingshot, fly swatter, pepper shaker, megaphone ([giant-tools.md](giant-tools.md)). The megaphone uses a fixed loudness threshold (no calibration). **The bell** triggers the same stun by shaking, so voice is never required. Only one of the two is ever out: the megaphone when mic permission is given, the bell when it is not.
- No loadout, no unlocks. Each tool appears on its platform in its tutorial wave with a poof, and glows until grabbed.
- Slingshot aim assist ([giant-tools.md](giant-tools.md#slingshot-aim-assist)).
- Food currency: eating fills the food jar, tools cost food (free while in the tutorial, `TOOLS.freeInTutorial`). Start with 4 food. Food carries over between waves.
- Tool platforms beside the player, just outside the ring handle, each food tool with a price tag.

**Enemies and army**
- **Grunts, runners, climbers and balloon riders** ([enemies.md](enemies.md)). Climbers are the main food source. Some grunts carry spears, and from wave 3 some wear helmets (one extra hit).
- Enemy routes on the road graph ([map.md](map.md#4-how-enemies-choose-routes)).
- Troops in three kinds (swordsmen, spearmen, archers): spawn, walk out, fight.

**Feedback**
- Spatial enemy sounds, louder as they get closer. Camps rumble (war drums, a sound only: the camps never move) before spawning.
- Real sounds from `public/audio/README.md`. Sounds it lists as missing use `public/audio/chime.mp3` until the last step ([audio.md](audio.md)).
- Juice: hit flash, poof, gear flying off, knockout stars and rings, hit stop on big hits, food labels, confetti and fireworks.
- Threat cues for players with the sound off: the wall flashes red under every attack, and a red arrow points at threats out of view (not while a lesson's yellow arrow points the way, so the two never point at the same lesson goblins).

---

## Tutorial director

The tutorial is a hand-written script in code (`src/director/tutorial.ts`), not a JSON file, because it waits for the player and reacts when they get stuck. It runs on the hand-made map blueprint `tutorial.json` with a fixed seed.

### How it works

- A list of steps. Each step has three parts:
  - **Start:** what happens, for example spawn a climber in front of the player, or show the slingshot on its platform.
  - **Done when:** the goal, for example a goblin is eaten, or the powder keg is hit.
  - **If stuck:** what to do after a while, for example glow the tool again, or spawn the climber again closer.
- The director moves to the next step only when the current one is done.
- Steps only call the normal game systems (spawn enemy, show tool, open road). Nothing tutorial-only lives inside those systems.
- **Learn by doing, with text.** Each lesson shows one short instruction on the hint sign, a marker on the thing to use, and waits until the player does it. Then its box is ticked with a chime and the next one appears. No "OK" buttons.
  - **Hint sign:** past the goblins at the front wall (62 cm out, bottom edge 43 cm above the board, just below the eyes), so it covers only the far edge of the board. It rises with the board, never spins and never follows the head. Shows "Step 3 of 8" for lessons and "Wave 2 of 5" banners for waves. **While a wave is fought it is gone**, so it never covers the enemies. No goblin counter: the blue flag shows the progress.
  - **Next button:** the sign is out of reach, so Next stands apart on a post straight in front, in the reach band (38.5 cm out, 15 cm up). It no longer blinks (it looked busy). One click per push: after a click the finger must come back out about 2 cm and 0.35 s must pass (was 0.6), and a new step ignores it for 1 s. A quick poke counts too (see "Quick pokes" in [controls-and-ui.md](controls-and-ui.md)).
  - **Marker:** one bouncing down arrow over the target, drawn on top so the wall never hides it.
  - **Out of view:** a gold 3D pointer arrow in front of the face points at the lesson's target while it is at the edge of the view or out of it.
  - **Ghost hand:** a see-through 3D hand loops the gesture on the real target. It steps aside while the player's own hand is there. Demos are data in `src/ui/ghostDemos.ts`. The accuracy rules are in AGENTS.md ("Ghost hand demos"). Ghost aim dots show the arc from the pouch to the target in the slingshot and trigger lessons.
  - **Info steps** (wave banners, the flags, the food jar, "wave cleared" breathers) only move on when the player pokes Next. Not by time, and not by looking at something. Only lessons, where the player does something with their hands, move on by themselves.
  - **New things are taught before their wave**, so no enemies press the player while learning.
- **The reach check comes first**, once per player: "Show me how big you are, giant!" sizes the board to their arms ([controls-and-ui.md](controls-and-ui.md#reach-check-show-me-how-big-you-are-giant)). It also runs before a debug "Start at wave" when the reach is not known yet.
- **The lessons, in order:**
  - Before wave 1: pause (poke the pause button in front, then Resume), spin the board, set its height, pinch the climber, eat it. Then the two flags ("Your castle", Next each).
  - Before wave 2: grab the slingshot, take a pebble, load it. In wave 2: shoot the one goblin walking back and forth on the road in front (done on a hit). Then one lesson each for the keg, the boulder and the tree: each brings its kind onto the roads, and goblins wait right in what it does until the player sets it off. Then the wave plays on until 3 more knockouts (or 35 s), and the **balloon lesson**: one balloon floats in right in front and hovers outside the wall with its riders until the player pops it (no Next: the pop ends it; the wave waits; `TUTORIAL_TIMING.balloon*`, `BALLOONS.lessonWaitAt`). Balloons are taught here because the slingshot is the tool for them; after the pepper lesson they came too fast.
  - Before wave 3: the **food jar** ("This jar holds your food", Next, then a climber to eat), then grab the swatter. In wave 3: swat one goblin.
  - Before wave 4: grab the pepper. In wave 4: pepper the goblins, then eat a sneezing one (the lesson ends only then; peppered goblins sneeze for 10 s and do no castle damage meanwhile, `PEPPER.sneezeFor`). The wave's own balloons come as planned (they were taught in wave 2).
  - Before wave 5: grab the megaphone (the bell without a mic). In wave 5: shout into it or shake the bell.
- **A new tool is taught by actions only, never with Next.** Its first lesson starts when the wave before is cleared, and the tool appears with it. Its wave starts straight into its use lesson, with no banner. Tool lessons count from the moment the tool appears, so steps the player already did are never asked again.
- **Tool use lessons** (swatter, pepper, megaphone or bell): three calm climbers wait on the rampart in front, harmless, and the wave holds its spawns until the tool is used on one. The tool's use timer is held while the lesson runs.
- **No soldiers come out while a lesson is on the sign**, so they never knock out the lesson's goblins.
- **Lesson climbers during a wave** wait on the rampart like any climber (8 s), so a fallback climber never holds the wave up.

### Rules that keep it safe

- **Keep fallbacks simple:** at most two. First repeat the step, then make it easier.
- **It must never get stuck.** Every lesson has a timeout that moves on anyway. A judge who cannot do something still sees the rest of the game. Info steps have no timeout: they wait for Next, which always works. **Waves have no timer either:** a wave ends when it is cleared or the castle falls. Only a stalemate ends a wave early: every goblin is out, none has hurt the castle or got closer for 90 seconds (`CASTLE_HEALTH.stalemateSeconds`, `progressCm`), so the leftovers run off. A goblin at or on the wall, in the courtyard, or held always blocks it. There is only ever one lesson climber.
- **Enemies keep coming while a step waits, but at half the spawn rate.** Lessons that need their own goblins (the shot, the triggers, the tool uses) hold the wave's spawns completely.

### Tutorial waves

The numbers live in `TUTORIAL_WAVES` (`src/director/tutorial.ts`), with castle damage in `CASTLE_HEALTH`. Climbers are the food source, so their count keeps food in step with tool costs (start 4, max 10). "Start at wave" on the debug page skips the early waves for quick tests.

| Wave | New thing | Camps | Grunts | Runners | Climbers | Balloons | Food check |
|---|---|---|---|---|---|---|---|
| 1 | Hands and eating. One climber is scripted to pop up right in front of the player in the first minute. | 1 | 6 | 0 | 3 | 0 | 4 + 3 = 7 |
| 2 | Slingshot, then a lesson for each trigger (keg, boulder, tree). | 2 | 10 | 0 | 2 | 0 | 7 + 2 = 9 |
| 3 | Fly swatter vs runners. Helmets from here on. | 2 | 8 | 12 | 3 | 0 | 9 - 4 + 3 = 8 |
| 4 | Pepper shaker. The first balloon riders. | 3 | 14 | 8 | 4 | 3 | Up to 10 |
| 5 | Megaphone (or bell). Everything together. | 3 | 18 | 16 | 4 | 4 | Whatever is left |

- Enemies come out in small groups through each wave, not all at once, so the board stays within the unit budget.
- Each wave lasts about 60 to 90 seconds, plus a breather.

---

## Build order

Each step should be playable on its own.

**Every step is done when:** `npm run typecheck`, `npm run build` and `npm test` pass, the step's items below exist, and the step is committed and pushed. The developer then checks it on the headset from the GitHub Pages link.

1. **Toy test:** board, castle wall, the ring handle, goblins walking in on roads, grab and eat.
   - **Done (2026-11-03), headset test passed.**
2. **Slingshot** with aim assist, and the pebble bowl.
   - **Done (2026-11-04), headset test passed.**
3. **Waves and flags:** blueprint loader and `tutorial.json`, road graph, camps, seeded random, the tutorial director, both flags, win and lose panels.
   - **Done (2026-11-04), headset test passed.**
4. **Fly swatter, pepper shaker, food jar and price tags.**
   - **Done (2026-11-04), headset test passed.**
5. **Triggers, troops, megaphone, bell and mic permission.**
   - **Done (2026-11-04), headset test passed.**
6. **Pause, triggers (more of them, easy to notice, their own lessons), and the giant's seat and body.**
   - **Done (2026-11-05), headset test passed.**
7. **Army and enemy variety:** three troop kinds with gear, goblin gear, balloon riders, the stress test with troops, the troop balance.
   - Done when: three troop kinds and the goblins carry gear, balloon riders work in wave 4, and the stress test result is logged.
   - **Built (2026-11-05), not tested on the headset yet.**
     - **Gear** (`src/units/gear.ts`, `GEAR`): merged into each character's own skinned mesh on a small extra bone under a hand or the head, so it moves with the animation and costs no extra draw call. Each unit shows only its own pieces. Gear from another Kenney pack, and gear made in code, takes the body palette's nearest colors. **The gear positions are worked out from the rig, never seen:** check them first and tune `GEAR.pieces` (`at`, `dir`, `scale`).
     - **Troop kinds** (`TROOP_KINDS`, `src/units/troops.ts`), all recolored to the kingdom's blue and gold: swordsmen (soldier body, sword, round shield), spearmen (human body, spear, tall shield, gold brimmed kettle hat, a little more reach) and archers (archer body, bow, quiver, blue plume). Archers stop and shoot arrows at goblins within 16 cm (`ARCHERS`). Soldiers cheer after a knockout and when a wave is won.
     - **Goblin gear** (`GOBLIN_GEAR`): 60% of grunts carry a spear, and from wave 3 35% wear a helmet. A helmet takes one pebble, arrow or soldier hit and flies off. Big hits (swatter, keg, boulder, goblin shot) go through it. Pepper makes a goblin sneeze its spear loose. Gear flies off when a goblin poofs (`src/fx/gearDebris.ts`).
     - **Balloon riders** (`src/units/balloons.ts`, `BALLOONS`): a patched goblin balloon with two grunts hanging under it floats straight in from a camp at about head height, stops over the courtyard and drops its riders in, then drifts away. The slingshot pops it (full aim assist, it glows while aimed at) and the riders fall and poof. Riders can be pinched off, swatted or shot one by one, and a stun stops the balloon in the air. The wall under a carrying balloon flashes red, and the red arrow points at riders over the wall. 3 balloons in wave 4 (after the balloon banner), 4 in wave 5.
     - **Troop balance:** at most 8 soldiers (`TROOPS.max`), squads of 2 to 3 every 14 s.
     - **Stress test with troops:** 8 soldiers of all kinds and 2 hovering balloons with riders stay on the board from the baseline on, then grunts are added as before (`STRESS_TEST.troops`, `balloons`).
   - **Still to do:** the headset test, then run the stress test and log it in [performance.md](performance.md).
   - Debug keys: `,` balloon in front, `.` pop every balloon, `/` a group of grunts that all wear helmets, 6 send a squad.
8. **Juice**, then the **missing sounds** last (the ones still using `chime.mp3`).
   - Done when: every sound name in the sound config points to a real file.
   - **Juice built (2026-11-05), not tested on the headset yet** (`src/fx/juice.ts`, `JUICE`). Pooled instanced meshes (3 draw calls, only while something shows) and 6 sprites. No lights, no post processing, nothing moves the board or the view.
     - A pow star and a shock ring on every knockout. A keg blast, a balloon pop or 3 knockouts at once get a bigger burst and a **hit stop** (the units run at 8% speed for 0.07 s, never the board, the view or the hands).
     - A white flash on a goblin hit but not knocked out (helmet off, pebble bonk, peppered).
     - "+1", "+2" or "Full!" rising from the food jar when a goblin is eaten.
     - Confetti over the castle when a wave is won, and a fireworks show after the win.
     - Goblins pop out of their camp, squash and stretch when they land, and runners kick up dust. (Camps used to shake and puff dust while they rumble: removed after the step 7 and 8 test, it looked too cartoony for buildings.)
     - Shot trails, a ring where the swatter slaps, sparks when swords clash.
     - The health flag jerks and flashes when the castle is hit, the wave flag pops when it climbs.
   - **Still to do:** the headset test (if the hit stop feels wrong, lower or remove it in `JUICE`), then the **missing sounds** (not started). New things reuse existing sounds for now.
   - Debug keys: `;` celebrate, 8 set off every trigger (keg blast), D damage the castle (flag jolt), B eat the front goblin (food label).

### Open items from earlier steps

Decided, not forgotten. Everything else from steps 1 to 6 is done.

- **Headset checks still open:** the giant's body and seat floor from more than one head angle, the megaphone after opening and closing the Quest menu (two possible causes were fixed, nothing confirmed), and the ghost hand demo `aimKeg`.
- **Wave 5 trigger reminder:** its intro text ("Shoot the barrels, boulders and trees") is never shown, because wave 5 starts straight into the megaphone lesson. It could show as a short line after that lesson.
- **Code cleanup:** the unused "loose" phase in `src/tools/handTool.ts` and its unused `tagToBack` option.
- **Food jar look:** it still reads like another tool stand. Idea: a low "tribute tray" piled with drumsticks (needs a food model, a new asset pack needs the developer's OK, or a code-made drumstick). Polish.
- **Courtyard houses, stalls and workers:** removed to keep the castle clear while the gameplay was built. They come back with the polish.
- **Locked tools and food costs in play:** tools are free in the tutorial, so the Locked look and paying food only matter once there is a battle after the tutorial (Endless or Daily Battle).
- **Directions in the hints:** the compass letters on the ring could name where goblins come from ("Goblins from the east!").
- **Chain reactions:** off (`TRIGGERS.keg.chainRadius` 0). They can come back if playtests want them.
- **Controller grip:** the fist frame for controllers is a rough guess (controllers are low priority).

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
| Day and night cycle (started on its own branch, after the MVP) | [Day and night cycle](#day-and-night-cycle-started) below |
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

### Day and night cycle (started)

Not part of the MVP build order. Built on the branch `feat/day-night-cycle` (2026-11-05), **not tested on the headset yet**, not merged.

**When the time changes**
- **Four times of day, any number of waves** (`timeOfWave` in `src/rules/dayNight.ts`): the first wave in the morning, the last at night, the one before the last at sunset, every other wave by day. The tutorial's 5 waves: morning, day, day, sunset, night. Works the same for later modes with other wave counts.
- **Time follows the waves, not a clock.** As soon as a wave is cleared, it changes over 8 s (`DAY_NIGHT.changeSeconds`, eased) toward the next wave's time, while the board is quiet. During a wave it stays still. After the last wave it stays at night. A new battle (Play, Play again, Restart, "Start at wave") jumps straight to its first wave's time. It freezes while paused.
- Only colors and the sky pieces move, nothing on the board, so it is fine for comfort.

**The four looks** (`DAY_NIGHT.looks` in `src/config/game.ts`, one `DayLook` each)
- **Morning:** the look tuned in the earlier headset tests. A low sun 35 degrees right of front with a warm sunrise glow.
- **Day:** super sunny. A high sun, warm orange-gold light, a soft blue top over a warm orange haze (the fog too, so the air has an orange tint), a wide warm glow, cream clouds, and the terrain tinted golden like grass in strong sun (less blue, a little less green, a little brighter). A first cool blue day did not feel sunny, the next one still read too green, and the next had pink in the sky (a blue top fading into a peach horizon mixes to pink), so now a greener sky blue over a yellow-orange horizon.
- **Sunset:** the sun low on the left, deep orange, a warm horizon under a violet-blue top, orange clouds. The night lights start to come on, a light night rim and terrain fade.
- **Night:** a dark navy sky, stars, the moon on the right and the ringed planet in front, weaker cool moonlight, dark grey-blue clouds, the terrain darker, full night rim and night lights.
- Each look sets: the dome's three colors and its glow, where the sun and moon are and how much they show, the sun's tint, stars, the light's direction, color and strength, the sky fill (`scene.environmentIntensity`), the cloud tint, the night rim, the terrain look (tint, brightness and color loss), the planet's height and the night lights. The fog color is the dome's horizon color.

**Night pieces** (shapes in [placeholder-shapes.md](placeholder-shapes.md))
- **Stars:** 360 points that twinkle: now and then each one quickly dims and shrinks, at its own uneven pace (in the shader). The first soft slow pulse could not be seen, so it is stronger now.
- **Moon:** a faceted low-poly moon with a cool glow, rising on the right.
- **Ringed planet:** one soft lavender in shades, faded toward the night sky so it reads as far away (a background piece). High in the sky straight in front and far off: at first it sat on the horizon and looked like it was on the ground. Rises out of the horizon as night comes.
- **Ringed planet, later:** smaller (17), a little lower (21 degrees up), warm orange-red stripes and ring bands mixed into the lavender (`SKY.planetWarm*`). The moonlight is weaker (0.7).
- **Road torches:** torches on posts beside the roads across the board, each with a pool of warm light on the ground, so goblins walking past show up at night.
- **Night lights** (`src/world/nightLights.ts`, `NIGHT_LIGHTS`): bright yellow-orange glowing village windows with a soft glow on the wall, a flickering torch on the courtyard side of each castle tower (only there while lit, at sunset and night), and a glow on each village lantern. No real lights: unlit colors and soft additive glows.

**Readability first.** Goblins must always be easy to spot, the hardest part to get right. The first night (a bright moonlit blue) looked too bright, so the night is now dark, and readability comes from the units instead:
- **Night rim** (`src/fx/nightRim.ts`): troops get a gold edge and goblins a green one, half at sunset, full at night. Added on top of the emissive color, so the Idle, Ready, Held and Locked glow and the hit flash still work.
- **Terrain look** (`src/fx/nightFade.ts`, `DayLook.terrainTint`, `terrainBright`, `terrainGrey`): at night the board, castle, roads, camps, villages, decor and hills turn darker, a little blue and a little less colorful (a multiply, never lighter); by day they turn golden. Units, triggers, tools and anything that glows keep their colors. A first version that faded toward grey-blue looked washed out.

**A livelier world (same branch, after the step 7 and 8 test, not tested on the headset yet):**
- **Goblin camps:** farther out (about 390 to 425 cm), except the front one at 300 cm, close enough to see its details. Each is a war camp inside a palisade (`CAMP_LOOK`), and no two look alike: spiked, branch or plank fences, red or green banners, a different siege machine each (catapult, ballista, ram, trebuchet), different tents, a weapon rack or a pile of supplies, goblin standing stones at most gates.
- **Story scenes** in the empty land (`STORY_SPOTS`): stone circles, ruined watchtowers, old battlefields, a shrine, travelers' camps by the roads, an archery range, a goblin trap baited with coins.
- **Villagers** (`VILLAGERS`): four per village walk about the square, stop to work or look about, and walk on.
- **Bigger, busier villages:** 20 to 26 cm across with 5 to 7 houses (were 16 to 21 with 3 to 5), two stalls, two lanterns, benches, wood piles, buckets, a chest, a banner and hedges.
- **More tall landmarks** far out: up to 12 (were 5) towers, mage towers, gatehouses, ruined towers and keeps on the far hills, the kinds taking turns.
- No farm animals: none of the Kenney packs in Downloads has any (only fish, in the survival kit).

**Debug:** `]` changes to the next time of day. "Time of day" 1 to 4 on the debug page ("Day and night" section). Both use the real 8 s change and hold until the next battle starts.

**Check on the headset**
- Is the night still easy to read? Are goblins clear against the dark ground?
- Do the stars twinkle visibly? Does the planet look far away and in the sky?
- Do the window panes line up with the window openings (`NIGHT_LIGHTS.paneSize`, `paneHeight`, `paneOut`, worked out from the model, not seen)?
- Do the torches on the towers get in the way when reaching for climbers (`NIGHT_LIGHTS.torchRadius`, `torchHeight`)?
- Run the stress test at night (`]` to night first): the rim, fade and lights add shader work ([performance.md](performance.md)).

**Not yet:** fireflies; campfires in the goblin camps that stay bright at night (they fade with the terrain now, since they share materials with the other decor); night sounds.

### More on the same branch: sound, UI and a livelier world

Built on `feat/day-night-cycle` too (2026-11-05 to 2026-11-06), after the day and night work. **Not tested on the headset yet** (only the sound direction test was), **typecheck, build and tests not run yet**, nothing committed. Details live in the docs linked below; this is the overview.

**Sound** ([audio.md](audio.md), `public/audio/README.md`)
- **Real sounds** from Freesound in place of the chime: goblin growl (squeal), cackle (for the climber giggle later), eating, sneeze, war drums (camp rumble, cut at 3 s), boulder roll, balloon pop (new), war horn at each wave start (new), medieval fanfare on a win (new).
- **Placed sounds work:** a direction test (one looping sound on the board, everything else muted, a mono and stereo switch on the debug page) showed left and right are clear; the test is removed again. Every placed sound is mixed to mono in code, sounds behind the head are muffled and a little quieter (front and back were confusing), loudness falls with distance.
- **Soft ends:** sounds of 2 s or more fade out over their end.
- **Music:** a calm ambient track on the welcome, end, pause and settings panels and during the reach check, a medieval loop (0 to 32 s) in battle, crossfading.
- **Sound groups:** Music, Goblins, Battle, Tools, Voice and menus, each with its own volume, saved.

**Menus and UI** ([controls-and-ui.md](controls-and-ui.md))
- **Pause button in front** on a post, below the Next button's spot (was on the wrist).
- **Settings page** from the pause panel and from the welcome panel (its bottom right corner): Back, Measure reach (moved here from the pause panel), and one long slider per sound group, all the way left is off.
- **The slider:** touch and slide with the index finger (touching the track jumps the handle), snaps to off and full near the ends, a handle like the buttons (green in a dark rim) over a tan fill, grey at off.
- **Quick pokes work:** buttons and sliders used to miss a fast poke; they now click as soon as the fingertip is in, and catch a finger that jumped through between two tracking frames.
- **Minimal text:** each menu shows only its title and a word over each button (no subtitles, no help lines); the panels got shorter to match.
- **Menus right in front of the eyes** (`UI_ZONE`): never higher than 2 cm above the eyes or lower than 30 cm below; a test checks every panel.
- **Button sizes** (`BUTTON_SIZE`): five sizes from 3.6 to 9.1 cm across, the dev build warns outside 3 to 9.1 cm.
- **Clean icons:** no dark outline and no dark edge on the button icons. The Next button no longer blinks.
- **Our own UI library** (`src/ui/kit/`): every panel, button, slider, label and on-top layer is built from it.

**Tutorial**
- **The red threat arrow** stays away while a lesson's yellow arrow points the way.
- **Pepper:** peppered goblins sneeze for 10 s and do no castle damage meanwhile; the lesson ends only when a peppered goblin is eaten.
- **Balloons:** taught in the slingshot wave after the trigger lessons and a few more knockouts, one balloon hovering in front until popped, no Next button.

**World** (day and night section above, [placeholder-shapes.md](placeholder-shapes.md), [assets.md](assets.md))
- **Camps** farther out and bigger, each different, no shake; the front one close enough to see.
- **Story scenes**, **villagers**, **road torches** with pools of light, a warmer, golden noon without pink, brighter yellow-orange windows, weaker moonlight, small halos instead of big round glows.
- **Pebble:** a lumpy low-poly ball that rolls on after a miss.
- **No farm animals:** none of the downloaded Kenney packs has any (only fish).

**Still open on this branch**
- **Run typecheck, build and tests**, then fix what they find. Much was written without them.
- **Headset checks:** everything above. Most of all: the settings page and slider feel (touch, drag, the handle's look, the rows' spacing), quick pokes on every button, the menus' height, the pause button in front, the balloon and pepper lessons, road torch pools and the small halos at night, the new camps and scenes from the seat, villagers walking through the village square's stall or cart, story scenes floating or sinking on bumpy ground (they sit on the terrain, it is not flattened for them).
- **Stress test** with the new load ([performance.md](performance.md)), by day and at night.
- **Pacing:** with the camps farther out a grunt walks about 60 s to the wall (was about 33 s). Raise the goblin speeds if the waves drag.
- **Music:** check the battle loop point (32 s, taken from the file's name), and the music layers idea ([audio.md](audio.md)).
- **Sound licenses:** check each Freesound file's license on its page (CC BY needs a credit line). InspectorJ (the sneeze) usually uses CC BY.
- **Sound files still to prepare:** the bell (AIFF does not play in the Quest browser, convert it), the sword hits (cut into single hits), the village ambience (20 MB, needs a short loop). Still missing: goblin chatter, burp, keg explosion, troop cheer, lose sound, ambience and night sounds.
- **Debug keys:** safe to remove (the debug page does everything, the headset has no keyboard), not removed yet. The debug actions and their code stay for the page.
- **Campfires at night:** the goblin camps' fires fade with the terrain; a small glow would help.
- **Lighting the ground near torches** in the terrain shader, if night still looks flat (option 2 of the torch light ideas).

### Far future ideas

Only after the MVP and its polish are done. Details agreed so far:

**Stylized giant hands (experimental)**
- The see-through hands work well today, and a solid hand would cover the goblins at the most important moment (the pinch). So this is a test, not a plan.
- The idea: a stylized giant hand (skin tone, chunky fingers), still partly see-through (about 60%) with a brighter edge, fading even more while it is near a goblin or pinching.
- Behind a debug toggle, to compare with the current hands in the headset. Keep it only if it looks better without hiding anything.
