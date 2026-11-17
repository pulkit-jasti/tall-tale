# v3 Plan: Faster, Clearer, Deeper

Status: **What is tested and what still needs a headset test: "Testing status (2026-11-17)" near the end.** Decided with the developer (2026-11-12 to 2026-11-13). **Phase 1 is built** (2026-11-13, branch `feat/v3-upgrades`, build passes, not committed; tested on the headset 2026-11-16; see "Phase 1 as built" below). **Phase 2's 2.0 and 2.5 are done, 2.8 is built** (2026-11-16; "2.0 as built", "2.5 as built", "2.8 as built"; 2.3 was dropped). Finished sections are marked [DONE] in their headings. Phases 4 and 5 are not built. **2.2 is built (2026-11-16): every tool** ("2.2 as built: the drum and the pepper ring" and "2.2 as built: the magnet, the glass, sugar cubes and 4 slots"). **2.1's traps are built and 2.8 covers them** (2026-11-16, "2.1 as built: the new traps, and 2.8 finished"; the chicken is a placeholder shape). **2.7 Night fog is built (2026-11-16, "2.7 as built").** **2.6 Secret achievements is built (2026-11-17, "2.6 as built"): all 16 achievements, the 8 secret abilities, the shelf and the toast.** **The game runs again** (2026-11-17): three bugs froze it at start (a black board, no castle, nothing moving) and three more hid in the tools; all found by running it in the IWSDK emulator and with the type check, all fixed (see "2.6 as built", "Fixed on the way"). **Phase 2 is fully built; 2.0, 2.4 and 2.5 are tested, the rest is not.** **Phase 3 is done (2026-11-17): the digger, shaman, bomber and goblin archers, each with its own look** (see "Phase 3 as built"; type check and build pass, not tested on the headset; the brute and the catapult crew stay on hold). **Phase 4's score and stars are built (2026-11-16, "The score as built"); chains are on hold.** **Next: the developer tests Phases 2, 3 and the score on the headset.** **Phase 5 started (2026-11-16): the generator knows everything new, campaign levels 1 to 5 are made by one command and played from their files, and Endless mode is built ("Phase 5 as built"); the Daily Challenge is dropped.** Every step: after each major change `npm run typecheck` (no new errors) and `npm run build` (no errors), not after minor ones, no tests (decided 2026-11-17); update its "as built" section and its [DONE] mark, stop with a "Headset check:" list, never commit unless asked. **Phase 2 and 3 redesigned 2026-11-14 to 15:** the magnet (new tool), the drum (replaces the bell), pepper's ground ring, eating heals and the horn on a timer (2.5), 4 free loadout slots, the digger, secret achievements, a score with star ranges (Phase 4), the magnifying glass as a sun garden (sunflower and mushroom) that also burns goblins without helmets, the haystack, the horn's call, boost and free move with a preview of each, traps coming back at random spots during waves, waves as breathers in one battle (2.8), an upside and downside for every tool, and night fog; the seesaw and the brute are out. **Phase 1** (small changes to what exists) comes first. Then **Phase 2** (new environment objects and tools, each working on its own), **Phase 3** (new enemies), **Phase 4** (chains and score, not final) and **Phase 5** (the modes, on hold). The developer decides when to test on the headset.

Where this file disagrees with [v2-plan.md](v2-plan.md), [custom-mode.md](custom-mode.md), [giant-tools.md](giant-tools.md), [enemies.md](enemies.md) or [modes-and-progression.md](modes-and-progression.md), **this file wins**.

Back to [GDD index](GDD.md).

---

## 0. Why v3

Honest look after many headset rounds (developer's own playtests):

- **Slow.** A grunt walks about 40 s before it reaches the wall (camps 330 to 430 cm out, wall at 49 cm, 7.5 cm/s). Most of a wave is watching.
- **Chaotic and confusing, not fast.** 360 degrees of threats, and the ring handle needs several grabs to turn the board around. Goblins on the rampart dash about "causing chaos" on purpose.
- **No skill, feels like a demo.** Few real choices. The swatter answers almost everything (it breaks armor in two hits), so the pepper has no job. Eating has no reward you notice (the recharge refill is invisible: the developer never felt a cooldown).
- **Only two tools feel complete:** the slingshot (motion, range, sets off triggers) and the horn (calls the knights). Both are always in the loadout, so the 2 free slots pick between overlapping close-range tools.
- **Enemies are thin:** every goblin walks, bashes, climbs and jumps in. Gear only adds hits ("tougher", not "different").

**Goals:**

1. **Fast, not chaotic:** more action you can read and act on. Every speed change comes with a clarity change.
2. **Real choices:** every tool has its own job, every enemy asks its own question ("best answer, never the only answer").
3. **Skill without a wall:** beginners still win; good players chase chains, combos and score.
4. **The 360 degree, big battlefield stays.** It is the core of the game. No narrowing the threat arc, no pulling the camps in for speed.

**Judges play 10 to 15 minutes**, and the tutorial already takes about 8. So the most visible changes go first, and the tutorial gets shorter, not longer.

---

## Finding assets (every phase)

New objects, enemies and icons need models and icons. **Never make art by hand in code** (AGENTS.md). Before anything else:

1. Look in `public/` (`public/ui/README.md`, `public/gltf/`, docs/assets.md).
2. **Search the developer's Downloads folder** (`~/Downloads`): the `kenney_*` folders, `Kenny Models` (Nature Kit, castle kit, fantasy town kit, mini arena, mini dungeon, mini forest, survival kit, a goblin camp pack) and any other pack there.
3. **Search properly, not only by file name, and cheaply:** list file and folder names first, then search the text inside the models (node, mesh and material names in `.gltf` and `.obj` files, with grep) and each pack's overview or license file. A model may be named for what it is in the pack, not for what we want (a "trebuchet" works as a catapult, "log" as a seesaw beam). **Do not open preview pictures** (each costs many tokens); at most one or two, only when the names leave a real doubt.
4. Copy what fits into `public/` with its license, list it in docs/assets.md (or `public/ui/README.md` for icons).
5. Only if nothing fits: suggest a pack to download. Code shapes are the last resort, and say so.

Known finds: `kenney_castle-kit` has `siege-catapult` and `siege-catapult-demolished` (plus trebuchet, ballista, ram and siege tower, each with a demolished version).

---

## Phase 1: small changes to existing content [DONE]

All of it changes systems that exist. Mostly config and rules, a few small code changes, and one new control (the compass crank). Tune on the headset in 2 or 3 short rounds, and have someone else play one round.

### 1.1 Tempo [DONE]

Start values below; tune on the headset. Numbers live in `src/config/game.ts`.

| What | Now | Start value | Config |
|---|---|---|---|
| Grunt walk speed | 7.5 cm/s (about 40 s to the wall) | 12 cm/s (about 25 s) | `GOBLINS.grunt.speed` |
| Runner walk speed | 15 cm/s | 22 cm/s | `GOBLINS.runner.speed` |
| Bash time at the wall | 5 s | 3 s | `GOBLIN_RULES.bashTime` |
| Time on the rampart | 8 s | 4 s | `GOBLIN_RULES.rampartWait` |
| Swatter recharge | 20 s | 10 s | `TOOLS.recharge.swatter` |
| Pepper use and recharge | 8 s, 20 s | 8 s, 12 s | `TOOLS.use.pepper`, `TOOLS.recharge.pepper` |
| Bell recharge | 35 s | 25 s | `TOOLS.recharge.bell` |
| Horn | 30 s recharge | charged by eating 5 goblins (1.5) | `TOOLS.recharge.horn` |
| Eat hold at the mouth | 0.2 s | keep (already quick) | `EAT.holdTime` |

- **The board stays big.** Camps stay far out; goblins cross the distance faster. The far zone gets things to do in Phases 2 and 3 (bridges, the magnet, bombers, archers; catapults are on hold), so travel time becomes time to act.
- **Shorter battles:** a campaign level should take about 3 to 4 minutes.

### 1.2 Clarity (so fast never turns into chaos) [DONE]

- **Groups, not drips.** Goblins leave a camp in tight groups of 4 to 5 that walk together (`WAVES.gruntGroup` 3, `runnerGroup` 4 today). At most one group on its way per direction at a time. A group reads as one threat, gives the swatter a target and, later, gives chains a crowd. A group is never bigger than a knight squad can beat (1.6).
- **A rhythm in every wave:** 3 to 4 pushes, with 5 to 8 s of calm between them (the spawn curve, `WAVES.curve`, already shapes this). Fast is not constant.
- **A warning before every push:** the drum from the camp's direction and its compass wedge lighting up about 3 s before the group leaves (`WAVES.rumbleLead` is 3 today: check the compass shows it too). The player is never surprised, only rushed.
- **Calmer rampart goblins:** no more dashing about (`rampartDashDeg`, `rampartRunShare`). They stand and fight the garrison, so they are easy to read and to grab.

### 1.3 The compass: readable at a glance [DONE]

**What it has today:** wedges on the rim that point where goblins come from (color: how close, size: how many; no marker per goblin), camp tents on its lip, and the goblins left with wave dots in the middle. **The problems:** the camp markers are grey diamonds on a dark dish (far too little contrast), and a group still walking and a group bashing the wall look alike.

**What changes:**

- **The direction wedges stay** (direction only, no single goblins). Their **color now shows the state, not the distance:**
  - **Walking in:** bright yellow (high contrast on the dark dish), steady.
  - **Attacking the wall** (bashing, climbing, on the rampart): **full red**, and **pulsing**.
  - Size still shows how many.
- **Camps:** a light cream marker with a dark outline (or the Kenney tent icon), never grey. Amber while its drum plays, as today.
- **Catapults** (Phase 3, **on hold indefinitely** since 2026-11-16; only if the catapult crew comes back): an icon of their own shape (a Kenney catapult or target icon) in purple, at their direction, with a flash on each shot.
- **The brute** (Phase 3): a **skull icon** at his direction. The only enemy with an icon of its own.
- **Nothing else.** No knight markers: the knights are easy to see on the board, and the compass is for what the player cannot see. Fewer things keep it readable at a glance.

**Teaching it:** the tutorial's compass step teaches only yellow (coming) and red (attacking), in one line. The catapult icon and the skull are explained by the campaign level that brings each one first (a glass sign: "A catapult! Purple on your compass"; the catapult part only if it comes back from hold).

**Never color alone** (accessibility, red and yellow are hard for some color blind players): red also pulses; catapults and the brute have their own shapes (both on hold). Name this in the Devpost write-up (accessibility: the compass works for color blind players). Check the contrast of every marker against the dish (aim for 4.5 to 1 or more) and in the night look.

Code: the compass (`COMPASS` in config, its system in `src/ui/`); the art comes from `public/ui/` or the Kenney packs (no hand-made art, AGENTS.md).

### 1.4 The swatter vs armor and balloons [DONE]

The swatter is for crowds of bare goblins. It no longer answers everything.

- **A helmet or a shield stops the swatter.** The swat bounces off: the goblin is knocked back a little and dazed for a moment, **its gear stays on**, and it is not knocked out. A clear "clonk" sound and a spark on the gear, so the player learns it at once.
- **Balloons are pushed away, not popped.** A swatted balloon drifts away from the castle for a moment (buys time), then comes back. Popping balloons stays the slingshot's job.
- **Armor now needs** (the pepper part is replaced by the magnet, 2.2): the **pepper** (strips weapon, helmet and shield), **triggers** (ignore armor), **slingshot hits** (each hit breaks one piece, as today), or **eating** (works on anything in reach).
- **A 10 s use window again, not swings** (changed back 2026-11-16; Phase 1 built it as 3 swings per charge). The first swat starts the window, as for the pepper, and the ring empties over time. **Built 2026-11-16:** `TOOLS.use.swatter` 10, `TOOLS.swings.swatter` false (the swing code stays, switched off); the tutorial line no longer says "Three swings".
- Code: `src/rules/gear.ts` (who a hit breaks gear for), the swatter's hit code, `src/rules/recharge.ts`.
- [enemies.md](enemies.md) and [giant-tools.md](giant-tools.md) change to match.

### 1.5 Eating charges the horn [DONE, then replaced by 2.5]

> **Replaced by 2.5 (2026-11-15):** the horn recharges on time like every tool, and eating heals instead. Kept below as a record of what Phase 1 built.

Eating gets a reward that only eating gives, and it ties the weakest mechanic to one of the two best tools.

- **The horn has no time recharge.** It charges only by eating: **5 goblins** fill it, a **seasoned** (peppered) goblin counts as 2.
- The horn's platform ring shows 5 pips that fill, one per goblin eaten, with a chime and a little glow on each. Full: the horn glows Ready.
- **Eating no longer refills the other tools** (`TOOLS.eatRefill`, `seasonedRefill` go). They recharge on time only. One clear reward is better than a small invisible one.
- **The choice it creates:** swat (fast, kills many, gives nothing) or eat (one at a time, slower, but it pays for knights).
- **Story:** the kingdom's deal. Feed the giant, and the kingdom sends its knights.
- The horn starts each battle **full** (so the first call is free), and empty after each call.
- The tutorial's horn lesson starts with the horn full and teaches the refill right after the first call. The line that taught "eating refills your tools" changes to "eating calls your knights".
- Code: `src/rules/recharge.ts`, the horn system, the eat handler.

**Rebalancing the waves for it** (the horn no longer comes back on its own, so food must come often enough):

- **Target: about 2 horn calls per wave** for a player who eats a fair share, so 10 or more goblins must reach the wall per wave. The first call each battle is free (the horn starts full).
- **The supply is the goblins that reach the wall**, not the total: what the slingshot, triggers and knights stop far out is never food. So a wave needs enough goblins, and enough of them must get close. Start values: about 20 to 25 goblins in wave 1, growing about 20% per wave (`goblins`, `growth` in `LEVEL_SETTINGS`; `TUTORIAL_WAVES` for the tutorial). Tune by counting eats per wave on the headset (a debug note per wave: goblins sent, reached the wall, eaten, horn calls).
- **Gameplay first, not the old unit budget:** the stress test result is out of date (play felt smooth past where it failed), so the developer judges the frame rate by playing. Raise the generator's cap on goblins at once (`LEVEL_GEN`, about 100 with troops to start) and the wave caps, and size waves for the gameplay.
- **A built-in catch-up:** a player who struggles has more goblins at the wall, so more food and more knights. A strong player stops them far out and needs the knights less. Good, keep it.

### 1.6 Knights: strong squads that hold a side [DONE]

> **Changed by 2.5 (2026-11-15):** a call costs a horn charge (no meals), the squad cap is about 3, and moving a squad is free. The rest still holds.

The horn call now costs 5 meals, so each squad must be worth it. The developer's strategy idea: **station a squad to cover one side (for example your back) while you handle the front.** This fits the 360 battlefield and gives the knights a clear job.

- **A squad must beat a goblin group on its own.** Today a squad has 3 to 5 knights (`KNIGHTS.squadMin`, `squadMax`); with groups of 4 to 5 goblins, an even fight would lose. Fix by strength, not only numbers:
  - Squads of **5 to 6** knights (fixed, not random, so the player can plan).
  - **One knight beats about 2 bare goblins** (more hit points or faster strikes than a goblin; armor and swords still matter).
  - Goblin groups stay at **4 to 5** (1.2).
- **A squad holds its spot until it breaks.** It already holds the first junction of the aimed road (`KNIGHTS` leash). It stays there for the whole wave (and across the breather) until it is down to `breakAt`, so a call is an investment, not a one-off charge.
- **What beats a held squad:** two groups at once, armored groups, and (since Phase 3) bombers, whose blast hurts knights near them (the brute is on hold). The player still has to look back now and then, and thin a big group with the slingshot before it reaches the squad.
- **The decisions:** **where** (the road behind you, the one with 2 camps, the one an armored group is on) and **when** (a call costs 5 meals). At the squad limit, the horn moves the squad nearest the aimed road there (as today), so a squad can be re-posted.
- **Knights and traps:** goblins fighting a squad stand still in a clump, so a keg or a tree next to a held junction becomes a planned combo (Phase 2 objects).
- `KNIGHTS.maxSquads` stays 4.

### 1.7 The compass crank (turning the board fast) [DONE]

A small wheel around the compass with a knob on its rim. Grab the knob and move the hand in a circle: **one turn of the wheel is one turn of the board** (the angle is 1:1, not the hand's distance). One quick circle turns the board all the way around.

- **Not a knob twisted with the wrist:** a wrist only turns about 180 degrees, so a full turn would need grabbing again (the ring's problem). Moving the hand around a small circle is easy and tracks well.
- **Where:** the wheel is the compass dish's rim (`COMPASS`: 37 cm out, 7 up, radius 5.5 cm, tipped 35 degrees toward the eyes). The knob sits on the rim; the hand circles about 11 cm across. Check the whole circle stays in the reach band and add it to `reachSpots()`.
- **Grab:** pinch or fist, like the ring (a fist with the back of the hand to the headset tracks poorly). Idle, Ready, Held and Locked looks with emissive color only, and a click sound every 30 degrees of turn.
- **It turns with the board:** the compass rim wedges show where the goblins are, so the player drags the threat they see to the front. The wheel spins the board only.
- **The ring handle leaves battles.** It took valuable space in front, and it was grabbed by accident. The crank does all the spinning. The tutorial's ring lesson becomes the crank lesson ("Turn the wheel to face the goblins").
- **Comfort:** a small hand move now turns the board a lot, which can cause motion sickness. Smooth turning by default, with the snap turn setting below.
- Ghost demo: the hand pinches the knob from above and circles once, following the rim (`arcDeg`), per the ghost hand rules in AGENTS.md.

**Snap turning (a setting):**

- **A switch in the settings' Access tab: "Snap turning"**, off by default (the `Switch` kit part). Saved with the other settings.
- **On:** the board turns in steps of 30 degrees instead of smoothly. The crank's knob still moves freely with the hand; each time it passes a 30 degree notch, the board jumps one step at once (no slide), with a click. One full circle is still 12 steps, a full turn.
- The crank is the only thing that spins the board in a battle, so the setting covers all turning. Height stays smooth (it causes little discomfort).
- The step size is in config (`BOARD_TURN.snapDeg`, 30 to start).
- Accessibility: AGENTS.md hard rule 3 already plans "a later comfort setting turns the board in snap steps". This builds it, and the Devpost write-up can name it next to Quiet horn and the threat cues.

**Board height (no ring in battles):**

- **In the pause menu:** the height rail from the home screen (`src/player/heightRail.ts`, `HANDLES.menuRail`) shows while the game is paused, at its spot in front. Grab it and move up or down; it never spins. Hidden again on resume.
- **On the home screen:** as it is today.
- **Never during a wave or a breather,** so nothing in front gets grabbed by accident.
- The reach check sets a good height at the start (1.10), so most players rarely need it.
- Update AGENTS.md (hard rule 3 and the ring handle rules) when built: the ring becomes the crank, height moves to pause and the home screen.

### 1.8 Slingshot aim assist [DONE]

The loading speed is fine as it is (developer's playtests). Only the aim assist gets a little stronger, toward goblins, balloons and triggers in the shot's direction (slingshot config; [giant-tools.md](giant-tools.md) changes to match).

### 1.9 A shorter tutorial [DONE]

- Target: about 5 to 6 minutes (about 8 today), so a judge reaches a campaign level.
- Fewer info steps and quicker lessons with the new tempo; nothing new is added. The new swatter rule is learned by doing (the "clonk" on a helmet in the swatter wave), the horn refill by eating (1.5), the crank in one step (1.7).
- Which steps go: decided on the headset with the new tempo, written in [mvp.md](mvp.md).

### 1.10 The reach check always runs once [DONE]

- The reach check ("Show me how big you are, giant!") sizes the whole board. Today it is part of the tutorial, so a player who skips the tutorial on the first visit never does it.
- **Now:** on the first visit, the reach check runs **before the home screen**, whether the tutorial is played or skipped.
- **The measured reach is saved** (with the progress in the browser), so it runs only once. Later visits use the saved one.
- **"Measure again"** in the settings' Access tab runs it again (for another player on the same headset, or a different chair).

### Phase 1 as built (2026-11-13)

Build passes; `npm test` has the same 14 old failures in `director.test.ts` as before (stale tests, none new). Not tested on the headset. Where the build differs from or fills in the plan:

- **1.1:** all start values as in the table. Horn: `TOOLS.recharge.horn` is 0 (no time recharge), `TOOLS.hornMeals` 5.
- **1.2:** grunt groups 5, runner groups 4, a leftover under 3 joins the last group, 0.45 s between goblins of a group. 3 to 4 pushes 5 to 8 s apart, a push's groups within 3 s and from different camps where possible. "One group per direction" is per camp: a camp waits until its last group is at the wall or gone, at most 12 s (`WAVES.holdMax`, a safety so a wave never stalls). Rampart goblins stand still; hunting a garrison soldier they walk (`rampartRunShare` 1).
- **1.3:** colors amber (sending), yellow (walking), red pulsing (attacking); camps cream with a dark outline (a slightly bigger dark back-face copy, no new art). The compass sits 33 cm out, 4.5 up, tipped 25 degrees (lowered after the first headset test: 30 and 10 hid the front). The crank's knob is now about 54 to 58 cm from the eyes (the band's edge, `rare` in `reachSpots()`); check it is comfortable. It hides while paused.
- **1.4:** back to a 10 s use window (2026-11-16; swing counting switched off in config). A swing starts at 150 cm/s head speed or a swat and ends after 0.18 s under 60 cm/s. Armor clonk sound: Kenney `impactTin_medium_000` and `rpg/metalPot1` (`swatClonk`). Balloons drift out at 30 cm/s for 1.6 s.
- **1.5:** wave 1 default 22 goblins, 20% more per wave, `LEVEL_GEN.unitBudget` and `GOBLIN_RULES.maxGoblins` 100. Debug note per wave: sent, reached the wall, eaten, horn calls.
- **1.6:** squads a fixed 5; knights take 4 goblin blows (guards keep 2) and land 55% of strikes (was 35%). Squads already held their spot across waves until `breakAt`.
- **1.7:** `src/player/crank.ts`, `CRANK`. A bigger wheel on 8 spokes; only the knob is grabbed, by pinch only (never a fist), with a 5 cm pinch zone round its ball. Snap turning is a switch in the Access tab. The pause height rail turns to face the head like the pause panel. The pause and Next buttons moved to 24 degrees, beside the compass. The crank click uses the Kenney interface clicks. The ring handle code (`src/player/handles.ts`) is left in the repo, unused.
- **1.8:** cone 12 degrees (was 10), bend 55 degrees a second (was 45).
- **1.9:** the start was rebuilt to teach live (`introLessons` in `src/director/tutorial.ts`, details in [mvp.md](mvp.md#tutorial-director)): crank first, then scouts from a rising camp turn a compass mark yellow, then red as they attack; pinch, eat and toss use those scouts; pause comes last. No goblins spawn during a lesson or between teach steps; a wave starts only when its lesson is done. Tutorial waves resized for the new tempo. Further cuts wait for the headset.
- **Fixes from the first headset test (2026-11-13):** the red threat arrow no longer points at a camp that just rose; the white thing floating in front of the eyes was IWSDK's hand model left visible when one hand loses tracking, now hidden by `hideLostHandModels()` in `src/game.ts` (checked in the emulator only; the headset is the real check). Debug page: "What is near my head?" lists small objects near the eyes.
- **1.10:** Skip tutorial on a first visit runs the reach check first, then the home screen. "Measure it again" was already in the Access tab.

**Where things stand (2026-11-13):** Phase 1 and the fixes above are built on `feat/v3-upgrades`, not committed, and waiting on a full headset test. Next: tune the numbers from that test, then Phase 2. Open: the 14 old failing tests, the unused `src/player/handles.ts`.

**What to look for when testing Phase 1:** time from a wave's start to the first goblin in reach (target about 10 to 15 s); a level's length (3 to 4 minutes); the swatter clonk on armor reads at once; horn calls per wave (about 2); a held squad beats a goblin group; the compass wedges (yellow, red) and camps read at a glance, by day and night; the crank turns the board around in one circle without discomfort, smooth and snapped; the height rail in pause; the reach check after skipping the tutorial; the FPS panel with the bigger waves ([performance.md](performance.md)).

---

## Phase 2: environment objects and tools

Each new object and tool **works on its own** and is useful alone. How they set each other off (chains) comes in Phase 4. So every object gets its inputs and outputs written down now (in the trigger registry), but nothing passes them on yet.

### 2.0 A livelier board (build and test first, decided 2026-11-15) [DONE]

The developer builds and tests these visual changes before the rest of Phase 2.

**Medieval structures near the roads and the player.** Today the decor sits only far away, so the middle and near board looks empty. Add small medieval buildings and props along the roads and close to the castle: cottages, a well, carts, fences, tents, banners, a ruined wall, a watchtower.
- From `public/gltf/` first, then the Kenney castle, town and survival kits in Downloads (copied with their license), recolored to match the board. Never drawn in code.
- **Decor only:** placed by the generator beside the roads, never on them, never in front of a reach target or a trap, so aiming and grabbing stay clear.
- **Cheap:** instanced where repeated, no colliders, built into the board before `fadeAtNight` (night fade, `src/fx/nightFade.ts`). Anything that glows at night (a window, a torch) goes in `src/world/nightLights.ts`.
- Small motion where it is cheap (a waving banner) makes it feel alive. Measure with the FPS panel.

**Twinkling stars.** The stars already twinkle (`src/world/sky.ts`, `SKY.starTwinkle*` in config), but too rarely and too faintly to notice in the headset. Make the night sky sparkle:
- **More often:** soften the dip math in the star shader (lower the power) so many more stars twinkle at once.
- **Sparkle up, not only down:** a star also flashes briefly brighter than normal, not only dimmer.
- **A few hero stars:** about 20 bigger, brighter stars that twinkle the most.
- Still one mesh of points and one shared clock: no frame cost. Judge it in the headset.

### 2.0 as built (2026-11-16)

Build passes. Not tested on the headset. Not committed.

- **Roadside scenes** (`src/world/roadside.ts`, `ROADSIDE` in config): the board builder walks every road and tries a scene every 14 to 22 cm, sides taking turns, 64 to 240 cm out, at most 46 a map. Ten kinds picked by weight: cottage (one village house, door to the road, wood or barrels), fountain (stands in for the well: no well model in the packs) with a bucket and lantern, cart with crates and sometimes a spare wheel, a short fence run, a traveler's tent with a fire pit, a waving banner, a ruined wall (two broken pieces in an L, rubble), a small watchtower with a banner, a signpost with a lantern, a workbench corner. Tall kinds stand farther out (cottage from 90 cm, tent 85, watchtower 130), so nothing near the wall hides a goblin.
- **Kept clear:** never on a road (checked against every road), never within 6 cm of a trap's keep-clear spot or of the line from the giant to a trap, clear of villages, fields, story scenes, road torches and each other. The trees and rocks keep away from the scenes. When 2.8 moves traps to random spots, those spots must avoid the scenes too.
- **Cheap:** one StaticBatch (a few draw calls), no colliders. The banners are one merged mesh per color whose vertex shader sways them from one shared clock (`bannerSway`, `bannerSpeed`, `bannerRipple`), with the night fade added by hand (`applyNightFade`, since `fadeAtNight` skips materials with their own shader). Cottage windows and the lanterns join the night lights.
- **New models** (Kenney, CC0): `fountain-round`, `cart-high`, `wheel`, `fence-broken`, `wall-broken`, `wall-wood-broken`, `signpost-single`, `workbench` (listed in [assets.md](assets.md)). The village house code is now `addHouse()` in `src/world/settlements.ts`, shared with the cottages.
- **Stars** (`src/world/sky.ts`): the dip power went from 3 to 1.4 (`starTwinklePower`), so many more twinkle at once; a short flash brighter and bigger than normal (`starSparkle`, `starSparkleGrow`, `starSparklePower`); normal stars now shine at 0.4 to 0.8 so a flash has room; the first 20 stars are hero stars, 2.2 times bigger at full shine with a 1.5 times stronger twinkle and flash (`starHeroCount`, `starHeroSize`, `starHeroBoost`).

### 2.4 Twinkling stars [DONE in 2.0]

Moved to 2.0 (built first).

### 2.5 Eating heals, the horn on a timer (decided 2026-11-15, replaces 1.5) [DONE]

- **Eating is the only way to heal.** The giant and the castle share one health (Phase 3, blocking projectiles). Each goblin eaten heals about **2% of max health** (start value, tune on the headset). The red flag rises a notch with each eat, with a small chime.
- **Story:** the kingdom feeds the giant, and food keeps the giant strong.
- **The horn recharges on time** like every other tool (about 30 s, `TOOLS.recharge.horn`), and starts each battle full. Eating gives the horn nothing (`TOOLS.hornMeals` and the horn pips go). One clear reward for eating: health.
- **It cannot be farmed:** a goblin only gets into reach after bashing and climbing, which already cost health. Eating heals back less than that goblin did, so a leak always hurts; eating only softens it.
- **A built-in catch-up:** a struggling player has more goblins at the wall, so more food and more healing. A strong player stops them far out and needs it less.
- Seasoned (peppered) goblins: heal double when eaten.
- The tutorial line "eating calls your knights" changes with the tutorial rework (later).
- **The horn: call, boost and move** (decided 2026-11-15):
  - **A squad cap** (about 3 on the board, also for the frame budget).
  - **Call** (aimed at an empty road, below the cap): a new squad. Costs a charge.
  - **Boost** (aimed at a squad): fallen troops come back and the squad fights faster for about 10 s. Costs a charge. Instant, where a new squad takes seconds to march. Since squads carry over (2.8), saving a strong squad is often worth more than a new one.
  - **Move** (aimed at an empty road, at the cap): the nearest squad walks there. **Free**, no charge; the walk and the side it leaves empty are the cost. About 3 s lockout between moves so squads never bounce around.
  - The choice: more knights, stronger knights, or knights somewhere else.
- **The horn shows what a blow will do, before it is blown** (decided 2026-11-15). The rule: show the result where the player is looking (the board, not the hand), show the cost before it is paid, and tell the kinds apart by shape first, color second, sound third (readable for color blind players and at night).
  - **Call:** a gold see-through ghost squad stands on the spot, with a gold path from the gate. Settling sound: a rising two note horn hint.
  - **Boost:** no ghost; the real squad gets a rising ring of light at its feet and chevrons above it, and see-through ghosts stand in for its fallen troops (shows the refill). Red orange. Settling sound: a drum roll tap.
  - **Move:** the real squad gets a silver outline, a dashed silver path walks from it to the spot, and footprints (or an arrow) on the spot. Settling sound: a light whistle.
  - **Cannot blow:** grey and no ghost, with the reason as a picture: an empty ring with a clock for no charge, a small countdown ring for the move lockout, the existing white ring and arrow for off the road.
  - **The cost preview on the horn itself:** its charge ring flashes the part a blow will spend while the player aims a call or boost, and stays calm for a move ("this one is free"). Seen at the edge of the view, never needed to look at.
  - **Committing:** raised into the blow zone, the chosen marker turns solid with a click (as today the pool turns gold), so the player sees the moment it is locked.
  - The kind only changes after the gaze settles (`HORN_AIM.consensusTime`), so it never flickers between call, boost and move.
  - Symbols (chevrons, footprints, clock) come from `public/ui` or the Kenney packs, never drawn in code. Built on `src/ui/hornAim.ts` (pool, pillar, ghost banner, path).

### 2.5 as built (2026-11-16)

Build passes. Not tested on the headset. Not committed.

- **Eating heals:** each goblin eaten heals 2% of max health (`CASTLE_HEALTH.eatHeal`), a seasoned one double (`seasonedHealScale`), with a chime (`castleHeal`) and a sparkle on the red flag's cloth (`Battle.heal`, `healCastle` in `src/rules/battle.ts`). **The breather no longer repairs** (`repairShare` 0): eating is the only way to heal. The castle health is still the castle's own; the shared giant and castle health comes with Phase 3.
- **The horn on a timer:** `TOOLS.recharge.horn` 30 s, full at each battle's start. The meal code is gone (`hornMeals`, `seasonedMeals`, the pips, `refill`, `mealShare`). Tutorial lines changed to match ("The horn is resting", "The horn rests, then calls them again"); the rest of the tutorial rework is later. The debug button "Feed the horn" is now "Eat heal".
- **Call, boost, move** (`Troops.plan` and `command`, `HornPlan`): aimed within 12 cm of a squad's spot is a **boost** (`KNIGHTS.boostRadius`): its fallen knights pop back at their places at once, the standing ones lose their wounds, and the squad strikes every 0.55 of the usual time for 10 s (`boostTime`, `boostStrikeScale`). Elsewhere, below the cap of 3 squads (`maxSquads`, `maxField` 15) a **call**; at the cap a **move** of the nearest squad. A call or a boost costs the horn's charge; a move is **free** and then waits 3 s (`moveLockout`).
- **Holding the horn while it recharges** (`grabbable`): so a free move works then; a call or boost shows why it cannot blow. Holding it pauses its recharge (it fills only on the platform). After a move the horn stays in the hand and must be lowered out of the blow zone before it blows again, so the next blow is never an accidental boost on the same spot. A move sounds softer (`HORN.moveVolume`).
- **The previews** (`HORN_AIM.callColor`, `boostColor`, `moveColor` and the rest): the kind is worked out when the gaze settles and every 0.25 s (a squad broke, the cap filled), with a settling sound once per new kind (`hornHintCall`, `hornHintBoost`, `hornHintMove`: Kenney stand-ins until the developer picks the horn hint, drum roll and whistle).
  - **Call:** five gold see-through ghost knights (the real swordsman model, posed once) on the spot, the ghost banner and the gold path from the gate.
  - **Boost:** no path; a red orange ring rising at the squad's feet again and again, two chevrons bobbing over it (`icons/up`), and ghosts where its fallen knights stood.
  - **Move:** a silver ring under each of its knights (stands in for an outline: a real outline on the animated models would cost more), a dashed silver path (`HORN_AIM.dash`) and a bobbing arrow on the spot (`icons/arrowDown`; no footprints icon in the packs).
  - **Cannot blow:** grey pool, no ghosts; no charge shows an empty ring with an empty clock (`board/timer_0`), the move lockout a silver countdown ring that shrinks. Off the road stays as before (white ring and arrow).
  - **The cost on the horn:** while a call or boost is aimed and the horn is charged, its platform ring shows full and pulses orange and white (`TOOLS.ring.costColor`); calm for a move.
  - **Committing:** raised into the blow zone the ghosts and markers turn more solid with the click, as before.
  - **The glass sign** names the kind ("Call: raise it in front of you", "Boost: blow!", "Move: hold it there") or the reason ("The horn is resting", "Wait to move again").

### 2.8 Waves are breathers inside one battle (decided 2026-11-15) [BUILT, headset test next]
A wave never resets the battle. Plants, knights, gear torn off by the magnet and the castle's health carry over. Only things with their own timer (the pepper ring, a plant's wilting) run out. Used traps come back **during waves too**, at a new random spot, so the player keeps looking for new ways to use the land and can't memorize the board:
- A used trap comes back about 25 s after it was used. One trap appears at a time (no frame dip, with a `mark()` for the FPS panel), never right next to a goblin group.
- The generator makes about twice as many valid spots per trap kind as traps (a keg on a road, a boulder on a slope, a tree by a road), and a rebuilt trap picks a free one at random (seeded random).
- Rope bridges stay in place (they cannot move). The bell tower drops its bell once per battle and is never rebuilt; the potion cart is rare (both in 2.1).
- A poof and a sound show where each trap reappears.
- Today a trap is rebuilt in its old spot (`Trigger.reset` in `src/world/triggers.ts`); this changes that.

### 2.8 as built (2026-11-16)

Build passes; `npm test` has the same 14 old failures in `director.test.ts`, none new. Not tested on the headset. Not committed.

- **What carries over** was mostly there already: knights stay between waves, and since 2.5 the castle's health carries over (no breather repair). Plants and magnet gear come with 2.2.
- **Spare spots** (`addSpareSpots` in `src/world/triggers.ts`, `TRIGGERS.respawn`): worked out when a map is built, from its roads and its own seeded stream, not stored in the blueprint, so every map gets them (the hand-made tutorial map too) with no regenerating of levels. For each kind, as many spares as the map has traps of it (`spareShare` 1, so twice the spots), on the roads at the same distances from the castle as the blueprint's traps (20 cm either way, never nearer than 90), at least 30 cm from every other trap spot. The ground is flattened and kept clear under the spares like under every trap (the roadside scenes, villages and decor keep away from them too). `buildBoard` returns them (`trapSpots`).
- **Coming back:** one trap object stands ready on every spot, the spares hidden. A used trap comes back 25 s later (`delay`), during waves too, at a free spot of its kind picked at random (seeded), never its old one; its old spot is cleared (a boulder's hill goes with a poof). One at a time (`gap` 1 s), never with a goblin within 18 cm (`goblinClear`, tried again a second later), never while the old one still acts (a fallen tree blocking its road), and never more of a kind than the map has. A poof and the tool poof sound show where, with a `mark('trap back')` for the FPS panel.
- **A wave no longer resets the traps:** at a wave's start only blueprint traps of that wave that have not stood yet come out (the tutorial's lessons still bring theirs with `revealKind` and `readyNearest`). The debug button "Reset triggers" still puts every blueprint trap back in its old spot.
- Rope bridges (rebuilt in place), the bell tower (once per battle) and the rare potion cart are built (see "2.1 as built").

### 2.2 New tools

New tools go to the **middle and far zones** and to new roles, since the near zone is full (hands, swatter, pepper, drum).

**Pepper: a new job** (decided 2026-11-15)
- **It no longer strips armor** (the magnet does that now).
- **On goblins** (shaken over them, as today): they sneeze and do no wall damage for 10 s, and a seasoned goblin heals double when eaten (2.5). The pepper achievement stays.
- **The pepper ring on the ground:** the main job, against diggers (Phase 3) and as a buffer at the wall.
  - **Segments:** the ground just outside the wall (in reach) is split into **8 segments** of 45 degrees, matching the compass directions.
  - **Applying:** shake the pepper over the ground just outside the wall; about **1.5 s of shaking over one segment fills it.** The existing shake detection gives the hand's position; take away the board's turn to get the segment under it. No new gesture.
  - **Turning:** only the front is in reach, so the back is peppered by turning the board with the crank: shake, crank, shake (easy), or crank with one hand while shaking with the other, like icing a cake on a turntable (skilled, never required).
  - **Limited by the use window:** 8 s of pepper fills 3 or 4 segments, so covering all 8 takes 2 or 3 uses. The player picks the sides with camps.
  - **Used up or gone, whichever comes first:** a segment lasts **about 30 s** (start value; a wave is about 45 to 60 s, so pepper is a choice per push, not per wave). Each goblin walking through breathes some in: it gets seasoned and uses up **about a quarter** of the segment, so a group of 4 or 5 clears it. A digger uses up the whole segment at once.
  - **States on the board** (flat shapes and tiny instanced red flecks, like the horn's path; judged on the headset):

| State | What is seen |
|---|---|
| Empty | plain ground, nothing drawn |
| Shaker above it | a faint orange outline of that segment on the ground |
| Filling | red flecks pile up inside the outline as the player shakes |
| Full | a solid red-orange strip along that stretch of wall, a small sparkle and a "ding" |
| Fading or breathed in | the flecks thin out and the strip goes pale |
| About to go | it blinks for its last 5 s |
| Gone | the last flecks puff away, with a sizzle from that direction |
| Night | the strip glows (`src/world/nightLights.ts`) |

  - **On the compass:** a thin orange arc on the rim for each peppered segment, so the back can be checked without turning (the compass shows what the player cannot see).

**Drum** (replaces the bell entirely, decided 2026-11-15)
- **Why:** the bell's shake was unreliable to detect. A hard downward strike is the swatter's motion, which already tracks well.
- **How:** grab the stick in a fist and strike the drum on its platform. A hit counts with the swatter's speed check and only when the stick's ball lands on the drum skin, so grabbing the stick or resting it on the drum never fires it.
- **Effect:** the bell's: every goblin is stunned and the rampart is knocked back down. It does not reach diggers underground.
- **Recharge:** 25 s, like the bell. Unlock: decided later by the developer.
- **Sound:** must differ clearly from the camps' war drum warning: a deep boom with a cymbal crash. The developer finds the file.
- **Model (simple low poly, no pack has one; list it in docs/placeholder-shapes.md):** the drum is a short 10-sided cylinder in red, two gold rim bands (top and bottom) and a pale cream top for the skin, on the bell's platform. The stick is a thin wooden cylinder with a round cream ball at its end. Grip pose in `HOLD.poses`.

### 2.2 as built: the drum and the pepper ring (2026-11-16)

Build passes. Not tested on the headset. Not committed.

- **The drum** (`src/tools/drum.ts`, `DRUM` in config): the bell is gone everywhere (`src/tools/bell.ts` deleted, `bell` renamed `drum` in the tool names, loadout, campaign reward at level 3, shelf, debug page). An old save's `bell` reads as `drum`. The drum stands fixed on the bell's old platform (-68 degrees); its stick stands in it, leaning back 25 degrees. A strike: the stick's ball comes down onto the skin (within its radius plus 0.8 cm, 1.4 cm above it) faster than 45 cm/s, measured in boardLift so the crank never fakes one; it must lift 2.5 cm before the next. A harder strike (up to 160 cm/s) stuns longer, as the bell's harder ring did. The skin bounces. Fist grip like the swatter (`HOLD.poses.drum`). The shelf shows the drum with its stick. Sound: Kenney stand-ins (`drumBoom` a heavy soft impact, `drumCrash` a heavy bell impact) until the developer picks the boom and cymbal. Debug notes give each grab's fastest downward speed near the skin, to tune `hitSpeed`. Ghost demos `drumGrab` and `drumStrike` (the strike offsets are a first guess; the drum is not in the tutorial). The bell sound stays in config for the bell tower (2.1).
- **The pepper ring** (`src/tools/pepperRing.ts`, `PEPPER_RING`): 8 segments fixed on the board, 52.6 to 63 cm out. The shaker reports where it is held over (outline) and where its pepper lands (fill); 1.5 s of shaking fills a segment, a part fill drains at 0.25 a second once the shaking stops, shaking a full one tops it up. Full: 30 s, blinking the last 5 s; each goblin walking, heading to or bashing the wall inside it is peppered (sneezes, seasoned) and uses a quarter. Gone: a puff and a sound. `useAll(angle)` is ready for the digger. Flecks are one instanced mesh, redrawn only when a segment's count changes. The strips are unlit (built after `fadeAtNight`), so they read at night without `nightLights`. A thin orange arc on the compass lip per peppered segment (`Compass.pepper`). Sounds: `pepperRingFull` (a Kenney confirmation), `pepperRingGone` (the chime until a sizzle is found). Debug: "Pepper ring front" fills the 3 front segments.
- **Pepper no longer strips armor** (`Goblins.pepper` keeps the gear); the tutorial pepper line and the shelf tag say so. Until the magnet exists, armor comes off only by slingshot hits, triggers and eating.

**Headset check:** the drum and stick read from the seat; a strike with the stick fires the stun every time, while grabbing it, carrying it or resting it on the skin never does (debug notes show the speeds); the ghost demo's ball lands on the skin. The pepper outline shows under the held shaker by the wall; about 1.5 s of shaking fills a segment with a ding; goblins walking through it sneeze and it thins out; crank, shake the next side; the compass arcs match the peppered sides; the strips by day and night. Debug buttons: "Beat drum", "Pepper ring front", "Unlock all tools" (to put the drum on the stand).

### 2.2 as built: the magnet, the glass, sugar cubes and 4 slots (2026-11-16)

Build passes. Not tested on the headset. Not committed. All numbers are start values in config.

- **4 free loadout slots** (`src/rules/campaign.ts`, `LOADOUT_SPOTS`): every tool is a pick (8 of them); new players start with the slingshot and the horn in slots 1 and 2. An old save's 2 picks move behind the slingshot and the horn. Fight opens when every slot is full or every unlocked tool is on the stand. The menu stand has 4 free slots (no fixed tools); the tool shelf has two rows of 4 (`MENU.shelves.tools.rowBack`, `rowUp`). In battle each slot's tool stands on its spot: right front, right side, left front, left side; a slingshot always takes the right front (its bowl and pull are built for that side), the others fill the rest in slot order. The magnet, glass and sugar are not campaign rewards yet: "Unlock all tools" opens them. The tutorial and a debug battle without a loadout keep the old tools on their home spots.
- **Goblins** got two states: `paused` (stands still, no stars: stripped by the magnet, eating sugar) and `confused` (a mushroom puff: purple tint, swinging).
- **Magnet** (`src/tools/magnet.ts`, `MAGNET`): the ray from the tips meets the ground (`src/tools/groundAim.ts`), smoothed. A flat red ring (11 cm) with a silver ring shrinking inside, drawn on top, sparks from the tips. A goblin with gear inside the ring for 1 s: its gear flies off (the gear debris, `Goblins.strip`), a clank, and it stops 1.5 s with the "no" emote clip (stand-in for the "!" emote). The first pull starts the 8 s window. Ignores riders. Not built: gear flying to the tips and crushed (it flies off instead), the hum (chime stand-in), Package Deal (2.6). The bell tower is built (see "2.1 as built").
- **Sugar cubes** (`src/tools/sugarBowl.ts`, `SUGAR`): a blue bowl with cubes on a platform; 3 cubes per charge (pips), 20 s recharge. Pinch a cube off the pile with a free hand; let go at the pouch and it loads (the slingshot's new `cube` shot flies and lands as a lure, `onCubeLanded`), anywhere else it is tossed with the hand's speed. A lure lasts 6 s; up to 5 goblins within 22 cm stop 4 s to eat, turned toward it; it shrinks as eaten. Simplified: goblins stop where they are instead of walking to the road point nearest the cube.
- **Magnifying glass** (`src/tools/magnifier.ts`, `GLASS`): aimed by the head; raised 10 to 30 cm in front of the eyes within 35 degrees of the look, it shines. While held and not raised: a light pillar and a gold ring at the aim point (bigger on a bed or keg, snapped by the 4 degree assist; a small white ring on ground or a goblin). Shining: an additive beam from the lens, white by day, orange at sunset, blue at night, 1.5 and 2 times slower then. The 12 s window runs down only while raised. A bed grows (2 s), a plant heals; a keg lights after 1 s (`Triggers.standingNear`); a goblin without a helmet right under the gaze burns after 1 s (smoke, poof). Hum and sizzle: the chime (missing).
- **The sun garden** (`src/world/garden.ts`, `GARDEN`): 6 beds per map beside the roads, 75 to 190 cm out, clear of roads, trap spots and each other, from the map's seeded stream (every map, no regenerating). Half sunflower (Kenney `flower_yellowA`), half mushroom (Kenney `mushroom_red`, copied in), a small copy on each bed. A plant lasts 60 s, drooping and fading toward brown, healed by the beam; plants stay between waves, cleared for a new battle. Sunflower: a seed every 2 s at the nearest goblin within 70 cm; a seed on armor breaks a piece, 2 bare hits knock it out. Mushroom: every 10 s a puff; half of the goblins within 26 cm turn purple and swing for 4 s, and a third of them are knocked out by their friends, never more. Beds may sit near roadside decor (not checked against it).
- **Sounds:** Kenney stand-ins (`magnetClank`, `sugarLand`, `plantPop`, `seedSpit`, `mushroomPuff`), the chime for `magnetHum`, `glassHum`, `glassSizzle`.
- **Debug:** "Show new tools" (the magnet, glass and sugar on the left platforms without a loadout), "Magnet pull", "Sugar lure", "Grow garden".

**Headset check (one tool at a time):** put the tool on the stand with "Unlock all tools", or use "Show new tools".
- Stand: 4 free slots, 8 tools on two shelf rows in reach; the battle puts each slot's tool where expected.
- Magnet: the ring follows the tips steadily; gear comes off only after holding on a goblin; tilting reaches far.
- Sugar: pinch a cube, toss it near the wall, goblins stop to eat; load one in the pouch and shoot it far.
- Glass: the pillar and ring follow the head while held; raising it to the eye shines; grows beds, heals plants, lights kegs, burns bare goblins; slower at night.
- Garden: beds read from the seat; sunflowers shoot, mushrooms puff and goblins turn purple; plants wilt.
- Frame rate with plants and lures on the FPS panel.

**Magnet** (decided 2026-11-15)
- **A horseshoe magnet** (red body, silver tips), held in a fist. If no pack has one, it is a simple shape listed in docs/placeholder-shapes.md.
- **One job: it pulls metal gear off goblins** (helmets, shields, swords, spears) at middle and far range. It does nothing else to them: each stripped goblin stops for about 1.5 s, looks at its empty hands or bare head, a "!" emote pops up (Kenney Emotes pack), then it carries on. They notice, but the pace never slows.
- **Why:** armor matters most where the knights fight. Strip the group fighting a squad and the squad wins.
- **Aim:** point the tips at the board like a flashlight; tilting changes the distance. Smoothed, so hand shake does not make it jitter.
- **The aim marker lives in the world, not as UI** (to be tried on the headset, then tuned): a flat ring on the ground in the magnet's red and silver, where the tips point, with a second ring shrinking toward the center over and over, like a pull. No texture, one flat shape. Wave arcs pulse from the two tips toward the ring, with a soft hum. The helmets and shields of goblins inside the ring rattle and glint while they are being pulled.
- **A hold, not a spray:** gear is pulled only after the ring stays on it about 1 s (like a debounce). Waving it around grabs nothing. Realistic, and it keeps the magnet from being spammed.
- **The pull:** gear rips off, flies in an arc to the tips with a clank, sticks a moment, then is crushed with a puff.
- **Use window:** 8 s of pulling, then a 20 s recharge (start values, tune on the headset). No limit on gear per use. Most players strip the 1 or 2 groups in front of them (out of a sticky spot); a skilled player who cranks fast and knows where the groups are catches 3 or 4.
- **Works anywhere on the board,** the rampart and courtyard too (no extra code to block it there), though eating is the better answer up close.
- **Ring size:** about one goblin group, so catching two groups at once takes aim.
- **Never pulls friendly gear** (knights, garrison).
- **Balloons are ignored** (riders keep their gear): pop them with the slingshot or eat them when they come close.
- **Stripped goblins stay bare** (if the shaman comes back, it can give gear back).
- **Grip:** a fist on the curve, tips pointing forward (a pose in `HOLD.poses`). Taught with the opposite hand to its platform, like every tool.
- **Unlock and teaching:** decided later by the developer. The tutorial is not touched for now.
- **Night:** the ring and the arcs glow (in `src/world/nightLights.ts`), so they read clearly at night.
- **Diggers** carry no gear, so the magnet does nothing to them.
- **Secret ability "Package Deal" (2.6):** aimed at a standing keg, the magnet pulls the keg in slowly (about 2 s); it lands by the pebble bowl, in reach, and can be loaded into the slingshot for a big blast where it hits. Pulling a keg ends the use window.

**Magnifying glass: the sun garden** (redesigned 2026-11-15; an earlier version was a reskin of the slingshot)
- **Aim by gaze, fire by raising it to the eye:** the player looks at a target and raises the magnifying glass (held in a fist) in front of the eye, in a zone about 15 to 25 cm in front of the eyes (like the horn's blow zone at the mouth); the beam hits what the head points at. Raising it is a deliberate move, so no extra delay is needed. Aim assist snaps the beam to the nearest seed bed, plant, keg or hay in a small cone. **Never to goblins:** aiming at a goblin is the skill (tracking jitter is still smoothed, as everywhere). To be tried on the headset; if it does not work, fall back to hand aiming like a flashlight (the magnet's way).
- **Two states that look and sound clearly different** (decided 2026-11-15):
  - **Aiming** (held, not raised): no beam and no sound. Shown only while the magnifying glass is held, so looking around never shows anything otherwise.
    - **A light pillar** stands up from the aim point, the same look as the horn's (`src/ui/hornAim.ts`), so every gaze tool speaks one language. People move their eyes without moving the head; the pillar shows that only the head aims.
    - **A small sun on the ground** at its foot: a gold ring with short rays, turning slowly, drawn on top (never hidden by hills or units), bright at night. From a sun icon in `public/ui` or the Kenney packs, never drawn in code.
    - **On a target** (bed, plant, keg, hay): the sun snaps onto it, grows a little, its rays brighten, the target glows in the Ready state (`Interaction feedback` in docs/controls-and-ui.md), and a soft tick plays.
    - **On ground or a goblin:** the sun shrinks to a plain white ring with no rays, nothing glows.
  - **Shining** (raised to the eye): a solid bright beam from the lens to the target, colored by time of day. The ring shrinks to a small bright spot with a little smoke, the target glows in the Held state, a soft hum plays while the beam is on and a sizzle on a target.
- **Feedback while shining:** a bed shows a growing sprout while the beam is on it, so the 2 s fill can be seen. A plant pops up with a pop sound. On empty ground: a thinner, dimmer beam, a wisp of smoke, the hum but no sizzle, no effect; the beam still runs down, so aim first.
- **About 1 s of beam lights a keg or hay,** so a quick sweep never sets one off by accident. Burning hay blocks the road about 10 s, then leaves a burnt patch and comes back like other traps (2.8).
- **Grip:** a fist grip in `HOLD.poses`, held in the hand opposite its shelf side. Its eye zone must not overlap the horn's mouth zone.
- **Foggy nights:** beds past the fog's clear zone cannot be seen or reached. That is part of what makes fog harder.
- **The lens is plain clear glass with a rim** (decided 2026-11-15). A zoom was researched but is not proven enough to spend time on now. Kept as a record for later:
  - **A tiny render texture:** one camera at the eye behind the lens, a narrow view through the rim, only the board's units, kegs, hay and seed beds (no sky, terrain or shadows), 256 to 384 px, rendered only while the lens is raised, the image on the lens face. The proven scope method. Around that render turn `renderer.xr.enabled` off (as three.js's Reflector does) and warm up its shaders so the first raise does not hitch.
  - **If it costs frames: a stencil portal.** Mark the lens disk in the stencil buffer and draw the units a second time, pushed toward the eye, only inside it. No extra pass, correct in stereo, but untested (needs a stencil buffer in IWSDK's renderer).
  - **Last resort:** grow the units inside the lens cone in place (a shader scale), or a plain clear lens.
  - **Comfort:** update the image every frame (never every other frame, it swims), smooth the lens pose, keep the lens small so the view around it stays steady, fade the zoom in when raised. Measure with the FPS panel.
- **Sets off kegs and lights hay.** (How kegs are set off in other loadouts is decided later by the developer.)
- **Weak at night:** the beam works more slowly at sunset and slowest at night, never dead. Shown without text: a white beam by day, orange at sunset, faint blue at night.
- **The sun garden** (its own system):
  - Shine on a bed about 2 s and a plant shoots up. Each bed holds one kind:
    - **Sunflower:** a turret that spits seeds at the nearest goblin in range. A blend of a sunflower and a pea shooter, a nod to Plants vs Zombies.
    - **Mushroom:** a chunky low poly mushroom with a big spotted cap and a little face that puffs its cheeks. Every so often it puffs, and goblins near it turn on each other and fight for a few seconds. **Affected goblins change color** (no cloud, no emote, for readability; checked by day and at night past the night rim). Test it; add an emote only if the color does not read.
  - **Beds are fixed:** placed at random near the roads by the generator, no menus. Each bed has its own look, readable from far, so the player knows which plant grows there (assets later).
  - **Burns goblins without a helmet** (decided 2026-11-15, replaces "no effect on goblins"): about 1 s of beam on a bare goblin knocks it out (gone with the usual poof and star, as the swatter's). A goblin with a helmet is not hurt, and nothing special is shown for it (no extra code). Pair it with the magnet: strip the helmets, then burn. The cartoon burn: its pants smoke, it hops, then poof. Balloons, friendly troops and diggers underground are never affected. Seasoned goblins burn like any other.
  - **Upside and downside:** the upside is the garden, lighting kegs and hay, and burning far goblins; the downside is that it is slow, helmets stop it and it is weak at night.
  - **Plants wilt over time** (decided 2026-11-15): one hidden health value, shown only by the plant (it droops and fades), never a bar or number. A full plant lasts about 60 s, then it is an empty bed again. Goblins never attack plants (no new goblin behavior). Shining on a wilting plant heals it.
  - **Plants work at night as by day** and glow (`src/world/nightLights.ts`); only the magnifying glass is slower. No stored sunlight.
  - **Never draw balloons or diggers,** and the sunflower never shoots balloons or anything underground.
  - **Plants last between waves** (see 2.8).
  - **The choice is where and when, not which plant:** the beam time is tight, so the player picks which beds to grow, which plants to save, and whether to spend it on a keg or hay instead.
  - Each plant is one model, the seeds are pooled projectiles.
  - **Start numbers (the developer tunes them in testing):**
    - Beam: 12 s of beam per use, used up only while the lens is raised (lowering it keeps the rest), 20 s recharge.
    - Grow 2 s, heal 1 s by day; 1.5x slower at sunset, 2x at night (never slower, so one use always does more than one thing: about 3 grows by day, 2 or 3 at night).
    - Sunflower: shoots in the middle zone, a seed every 2 s, 2 seeds knock out a grunt.
    - Mushroom: puffs every 10 s, about half of the nearest group turns for 4 s, knockouts count. **Never wipes a group:** the fight stops once the group is down to about two thirds of its size, so it weakens a group and the player still has to finish it.

**Sugar cubes**
- A bowl of cubes, like the pebble bowl. Toss one by hand near the wall, or load one into the slingshot to place it far.
- Goblins on nearby roads walk to the road point closest to the cube and stop to eat it for a few seconds. They never leave the roads (no new off-road walking).
- Pull a group onto a bridge or next to a keg, then set it off.
- Limits: a cube lasts a few seconds; a few cubes per charge.

**Every tool has an upside and a downside** (decided 2026-11-15), so picking a loadout is a real choice. Each tool also has one thing only it does. Three tools knock goblins out (slingshot, swatter, magnifying glass), the horn summons, the rest support.

| Tool | Upside | Downside |
|---|---|---|
| Slingshot | precise, any range, breaks gear | slow fire, one goblin at a time |
| Swatter | fast, hits a cluster at once | rampart only, helmets stop it |
| Magnifying glass | the garden, lights kegs and hay, burns far goblins | slow, helmets stop it, weak at night |
| Horn | knights anywhere: call, boost, move | long recharge, knights act on their own |
| Magnet | strips a whole group's gear at range | knocks nothing out itself |
| Drum | stuns everything, clears the rampart | long recharge, not underground |
| Pepper | stops diggers, seasons for healing | ground by the wall only, runs out |
| Sugar cubes | lures a group where you want it | knocks nothing out itself |
| Hands (eat) | heals the castle | close only |

**The loadout: 4 free slots** (decided 2026-11-15)
- The slingshot and the horn are no longer fixed. All 4 slots take any unlocked tool, so players try combinations.
- New players start with the slingshot and the horn already in two slots.
- Every enemy needs at least two answers among all the tools, and the level screen shows what is coming (for example "Balloons ahead"), so players pick wisely.
- Builds this allows: a far build (slingshot, magnet, horn, sugar), a wall build (swatter, pepper, drum), and mixes.

### 2.1 Environment objects

- **Each one useful alone, with its own result**, not three ways to block a road.
- **Nothing hardcoded:** each object is one entry in the trigger registry (`src/config/registries.ts`): its model, what sets it off, what it does, its range, its animation and its reset. The generator places them on the roads (a setting each in Custom Game, like the kegs today).
- **Cheap:** no physics. Each object is a small state machine (idle, set off, spent, rebuilding) with a tween, like the camps rising.
- **They come back** at a new random spot about 25 s after use, during waves too, with a poof (2.8). Rope bridges come back in place; the bell tower is once per battle and the potion cart is rare.

| Object | Set off by | Does | Reset |
|---|---|---|---|
| **Haystack** (new) | fire (about 1 s of the magnifying glass's beam) | burns and blocks the road about 10 s like the tree, then leaves a burnt patch; the magnifying glass's blocker, as the tree is the slingshot's | rebuilt (2.8) |
| **Rope bridge** (new) | a pebble on its rope, a blast | collapses: goblins on it fall and are knocked out; the road becomes the long way round until it is rebuilt | rebuilt in place (2.8) |
| **Keg** (today) | fire only: the magnifying glass, a fire pebble (2.6; no plain pebble since 2026-11-16) | blast: knocks out an area | rebuilt |
| **Boulder** (today) | a pebble | rolls down the road: knocks out a line | rebuilt |
| **Tree** (today) | a pebble, a blast | falls across the road: knocks out what it lands on, blocks for a while | springs back |
| **Bell tower** (new) | the magnet | the old iron bell drops onto the road with a "BONG": knocks out everything under it, helmets too | once per battle, never rebuilt |
| **Potion cart** (new) | a pebble | the potions burst: goblins near it turn into chickens for good | rebuilt (2.8) |

- **Bridge and ground under it:** a bridge crosses a dip where the road meets a stream or a valley. **No real water:** a fixed flat strip with a blue gradient (one cheap material), or just an empty dip. From the seat it is far away, so it only has to read as "a gap".
- **The bridge's choice:** drop it early and goblins take the long way (the roads as gameplay); drop it late, while goblins cross, and they all fall. One object, two uses.
- **Long enough for a whole group** (decided 2026-11-15): a bridge must hold a full goblin group (4 to 5, walking in their usual spacing) at once, so dropping it mid-crossing catches them all. Shorter, it is just another road blocker like the hay and the tree. The generator only places bridges where the gap is that long.
- **The haystack blocks like the tree on purpose:** with 4 free slots, each ranged loadout gets its own blocker (the tree falls from a pebble, the hay burns from the magnifying glass). The seesaw was never agreed and is dropped.
- **Bell tower** (decided 2026-11-15, the magnet's object; the medieval version of a cartoon anvil drop):
  - **The tower never breaks, only the bell falls.** A ruined tower beside the road, its open top leaning over it, stacked from the Kenney castle kit (`tower-square-base`, `tower-square-mid`, `tower-square-arch` or `tower-square-mid-open` as the belfry, a worn or missing roof). The bell is a simple shape (a flared cylinder and a knob), listed in docs/placeholder-shapes.md.
  - **Set off:** the magnet's ring held on the bell (the usual 1 s hold). It shakes and glints like gear under the magnet, then drops. It costs part of the magnet's use window, so it is a choice.
  - **The drop:** one tween with a small bounce (no physics), a dust puff, the "BONG", and the usual knockout poof for every goblin in a circle under it, helmets too.
  - **Rubble:** 3 or 4 pooled pieces of `rocks-small` (castle kit), **recolored to the tower's stone**, flung with the same toss math as goblins and faded after about a second. Nothing stays on the road.
  - **States:** hanging, being pulled, falling, landed, gone, back (with a poof). The bell lies on the road a moment, then fades.
  - **Once per battle** (decided 2026-11-16): a big structure does not grow back. Until it is pulled down, pebbles can ring the bell as often as the player likes (Ring the bell, 2.6). The magnet can drop it only once; after that the tower stands empty, without its bell, for the rest of the battle. It never respawns.
- **Potion cart** (decided 2026-11-15, an alchemist's cart):
  - **Models:** `cart.glb` (or `cart-high.glb`) from the Kenney fantasy town kit, with 4 to 6 `potion.glb` (Kenney mini dungeon) in it, one instanced model recolored purple. Extra bottles: `bottle.glb`, `bottle-large.glb` (Kenney survival kit). Copied with their license.
  - **Set off:** a pebble on the cart. The potions are hidden and a purple fizz of particles plays (no breaking animation).
  - **Effect:** every goblin in a circle around it turns into a chicken with a puff. Chickens stay chickens: harmless, no wall damage, they wander a little around the road with a waddle and hops (code tweens, no rig). Gear falls off with the change.
  - **Despawn:** after about 20 s, a chicken disappears, but **only while it is outside the player's view** (checked against the head's view). A chicken never disappears in front of the player; one in view simply waits until it is not.
  - Counts as a knockout for the score. A chicken that wanders into reach can be grabbed and eaten.
  - **Needs a model:** no pack in Downloads has a chicken. Find a CC0 one (Kenney or Quaternius), simple and low poly to match.
  - **Rare, pure luck** (decided 2026-11-16): not a regular trap. It appears only now and then, at a random time and spot near a road, and in some battles never at all, so it feels like a special find. Once used it does not come back on the 25 s timer (2.8). How often is a setting to tune, rolled with the seeded random. This also makes the chicken dinner (2.6) special.

### 2.1 as built: the new traps, and 2.8 finished (2026-11-16)

Build passes. Not tested on the headset. Not committed. All numbers are start values in config (`TRIGGERS.extra`, `hay`, `bellTower`, `cart`, `bridge`, `CHICKENS`).

- **Placed on every map when it is built** (`addExtraTraps` in `src/world/triggers.ts`, the map's own stream, like the spare spots; not generator settings yet): 2 haystacks (90 to 200 cm out), 1 bell tower (120 to 210), 1 rope bridge (120 to 220, room for its whole length on its road) and 3 hidden potion cart spots (85 to 190), at least 30 cm from every other trap. The ground is flat under them and decor keeps clear, like the old traps. `TriggerKind` grew; the generator's list (`TRIGGER_LIST`) and the Custom Game settings did not.
- **Only in loadout battles** (`Triggers.extrasOn`): the tutorial map has their spots but never shows them.
- **Haystack** (code shape): fire only, the magnifying glass's beam (1 s, the glass aims at hay too); the slingshot does nothing to it. (A keg blast would light it too, but chain reactions are off: `TRIGGERS.keg.chainRadius` is 0 since step 6.) It burns 10 s (flames), closes its road like the fallen tree, burns down, leaves a burnt patch 6 s, then comes back on the trap timer at a spare spot (2.8).
- **Bell tower** (Kenney castle kit pieces stacked, the open top leaning over the road; the bell a code shape): the magnet's ring held on the road under the bell for 1 s (it shakes and glints) drops it: a fall with a bounce, the old hand bell sound as the "BONG", dust and a little debris, every goblin within 9 cm knocked out, helmets too. The tower stays without its bell; **once per battle**, never back on the timer. Not built: the pebble ring (Ring the bell, 2.6), rocks as rubble (it uses the trap debris).
- **Potion cart** (Kenney cart and potions, tinted purple): **rare** (`Triggers.updateCart`): at a battle's start a 60% chance it shows 35 to 90 s in, at a free cart spot; it goes away unused after 45 s, and after it is used or gone there is another 60% chance 90 to 160 s later. A pebble bursts it: a purple fizz, and every goblin on its feet within 14 cm drops its gear and becomes a chicken (`src/units/chickens.ts`, **a placeholder shape**: white body, red comb, yellow beak). Chickens wander and hop near where they changed, do no damage, and after 20 s go only while out of view (more than 60 degrees from the look). Not built: grabbing and eating a chicken (Chicken dinner, 2.6).
- **Rope bridge** (Kenney `bridge_wood`, fit to 28 cm along its road, over a flat blue stream strip): a pebble drops it (a blast would too, but chain reactions are off): every goblin on it (within 4 cm of its line) is knocked out, the deck tips into the stream with a splash, and its road closes (goblins on it turn back, the long way round through the road graph) until it **rebuilds in place** after 25 s. No real dip in the terrain: the stream is a strip on flat ground. Check the model's direction along the road on the headset.
- **2.8 now covers every trap:** haystacks come back at random spare spots like kegs, boulders and trees; bridges rebuild in place; the bell tower is once per battle; the cart only on its rare timer. If chain reactions come back (`TRIGGERS.keg.chainRadius` above 0), a blast sets off haystacks and bridges too, never the bell tower.
- **Sounds:** the chime for `hayBurn`, `potionFizz`, `chickenCluck` (missing), a Kenney stand-in for `bridgeSplash`, the old `bell` for the bell tower (in "To do later").
- **Debug:** "Show new traps" (the haystacks, bell tower and bridge stand now and the cart shows), then "Fire all triggers" sets them all off.

**Headset check:** start a loadout battle with "Unlock all tools", put the glass and the magnet on the stand, press "Show new traps".
- Haystack: the glass's sun ring snaps to it, about 1 s of beam lights it, it burns and blocks the road, then the burnt patch; it comes back elsewhere later.
- Bell tower: reads from the seat; the magnet's ring on the road under the bell shakes it, then it drops and knocks out the group under it; it does not come back.
- Potion cart: a pebble turns the goblins around it into chickens; chickens never vanish in front of you.
- Bridge: lies along its road over the stream; a pebble drops it and knocks out the goblins on it; goblins take another road; it rebuilds after 25 s.
- Frame rate on the FPS panel with burning hay and chickens.

### 2.7 Night fog (decided 2026-11-15) [BUILT, headset test next]

- **A level setting** ("Foggy night", in Custom Game and some campaign levels), only in night waves. Not every night: the last wave is always night, and fog every time would make every level end blind and punish ranged loadouts.
- **Timing:** the fog rolls in during the breather before the night wave (seen coming) and lifts after. Never mid-wave.
- **How far the player sees:** clear up to about the middle ring (about 150 cm), fading to nothing by about 250 cm; the camps are hidden. At grunt speed a goblin appears about 12 s before the wall.
- **What still works:** the compass (it becomes the player's eyes: where, not how many), the camp drums by sound, and the night rim, so goblins step out of the fog outlined.
- **Not fogged:** the player's tools, the compass, the flags, anything near the player.
- **Balance:** foggy waves send their pushes a little more spread out, so the short warning does not snowball. The slingshot and the magnet still work inside the clear range.
- **No lantern or other fog-clearing plant** (it would copy Plants vs Zombies, and a clear hole in the fog needs a shader change on every material). One even fog, changed between waves: cheap.
- Built as a fog field in the night look (`DAY_NIGHT.looks`, blended in `src/world/dayNight.ts`), used only when the level asks for fog.

### 2.7 as built (2026-11-16)

Build passes. Not tested on the headset. Not committed. All numbers are start values in `NIGHT_FOG` (config).

- **The setting:** "Foggy night" on Custom Game's Waves tab (`foggyNight` in `src/config/levelSettings.ts`, off by default; the card says "a foggy night"). The campaign still plays the tutorial waves on one map, so no campaign level has fog yet: turn `foggyNight` on in a level's preset once the level files exist.
- **How it works:** the scene's existing haze (`SKY.fogNear`, `fogFar`) pulled in close: clear to 1.5 m, gone by 2.5 m (meters for the default board, times `stage.boardScale`, from the eyes). No new shader, no recompile: the fog was always on, only its numbers change. `DayLook.foggy` (1 at night, 0 the rest) says when it shows; `Battle.foggy` says the level wants it (while the battle is fought, until its last wave is cleared). It rolls in with the change to night (the breather before the night wave) over `DAY_NIGHT.changeSeconds`, and lifts the same way when the night wave is cleared or the battle ends. Never mid-wave.
- **Its look:** a misty night blue (`color`), a little lighter than the night horizon. The sky dome takes that color at the horizon and less up high (`domeHaze`, `domeTop`, `domeHeight`), so the fogged hills meet the sky with no seam; the clouds sink into it too; the stars dim by 75% (`starDim`).
- **What stays clear:** the tools, the compass, the flags, the signs and every UI piece are `fog: false` or nearer than 1.5 m. Goblins come out of the fog with their night rim.
- **Not fogged, on purpose for now:** the night lights (village windows, road torches, lanterns) use `fog: false` and additive glow, so far ones still glimmer through the fog, like lights in the mist (they show the roads, never a camp). If they read as wrong on the headset, hide the far ones while foggy.
- **Balance:** a foggy night wave sends its goblins out over 25% longer (`spreadScale`, in `levelWavePlans`).
- **Debug:** "Night fog on/off" (sky group) rolls the fog in and turns to night, or lifts it; held until the next battle starts.

**Headset check:** start any battle, press "Night fog on/off".
- The fog rolls in over about 8 s; the near board is clear, the far board and the camps are gone, and no seam shows between the hills and the sky.
- Goblins step out of the fog outlined, about 12 s before the wall at grunt speed.
- The compass, tools, flags and signs stay sharp.
- The far night lights through the fog: fine, or hide them?
- Then a Custom Game with "Foggy night" on: the fog comes only in the breather before the last wave, and lifts when it is cleared.
- Frame rate on the FPS panel in the fog (should not change).

### 2.6 Secret achievements (decided 2026-11-15, reworked 2026-11-16) [BUILT, headset test next]

- **Regular achievements are goals** ("Eat 100 goblins"), shown plainly. **Secret achievements are discoveries:** the shelf shows a "?" trophy with a riddle as its hint (for example "Tug me, I fall. / Tap me, I call."). Finding the trick unlocks it. The shelf doubles as a treasure map.
- **The old easter eggs are dropped** (2026-11-16: Scrap shot, Shoot the moon, Not food!, Victory parade, Return to sender, Double pop). The secret abilities below replace them, and they save code.
- **Secret abilities** (decided 2026-11-16): secret achievements that also give a real benefit. **No hints at all** in play. On the achievements shelf (docs/menus.md) each one is a "?" trophy with its name and a short rhyming riddle as the only hint. When the player does it the first time, the achievement pops up; the trophy then explains what it does.
  - **Riddle rules:** easy words, one rhyming couplet, middle difficulty. The words are plain, the meaning is the puzzle. Never name the tool, the object or the effect (no "keg", "pebble", "slingshot", "chicken").
  - **The 8 secret abilities** (name, riddle, then what it is):

    | Name | Riddle | What it is |
    |---|---|---|
    | Acquired Taste | "A meal that's been dressed / will mend you the best." | Spicy snack |
    | Fair Trade | "They sent you a guest; / send it back to the rest." | Goblin shot |
    | Night Owl | "When the stars come to stay, / a stone can borrow the day." | Fire pebble |
    | Bright Idea | "Greet the old fire on high, / and your work won't run dry." | Sun charge |
    | Gentle Touch | "Tug me, I fall. / Tap me, I call." | Ring the bell |
    | Change of Menu | "What the rare wheels pour / makes dinner worth more." | Chicken dinner |
    | Secret Recipe | "Hide some fire in their treat, / and they'll be better to eat." | Spicy sugar |
    | Package Deal | "Call what waits to go bang, / then send it off with a twang." | Flying keg |

  - **Spicy snack:** eat a peppered (seasoned) goblin and it heals double (2.5). Kept secret on purpose: a big benefit for players who find it.
  - **Goblin shot:** load a held goblin into the slingshot. Where it lands, the goblins in a small area are knocked out, and the ones just outside it are flung back a short but noticeable distance and dazed for a moment. Unique to this shot.
  - **Fire pebble** (sunset and night only, never by day): hold a pebble in a castle torch's flame about 1 s and it catches fire (flame particles, in `src/world/nightLights.ts`). Shot from the slingshot, it lights kegs, hay and webs like the magnifying glass, but never grows plants. Normal pebbles never light kegs. On a goblin it acts like a normal pebble plus a little smoke. It burns out about 5 s after lighting if not shot, so it cannot be stockpiled, and each shot needs the hand back at the torch. Needs a torch on the castle inside the reach band, near the pebble bowl (add it to `reachSpots()`). Night is when the magnifying glass is weak, so this fills that gap without replacing it.
  - **Sun charge** (by day): raise the magnifying glass toward the sun in the sky; the next use gets a longer beam.
  - **Ring the bell:** hit the bell tower's bell with a pebble instead of pulling it down. It rings without falling, and goblins near the tower are dazed for a moment.
  - **Chicken dinner:** eat a chicken from the potion cart; it heals more than a goblin. Rare, since the cart is rare.
  - **Spicy sugar:** shake pepper on a sugar cube, then toss or shoot it. The goblins that eat it are seasoned, so they heal double when eaten.
  - **Flying keg:** pull a standing keg in with the magnet (2.2), then load it into the slingshot for a big blast where it lands.
  - **Limits** (decided 2026-11-16, so no secret makes the game too easy; all numbers are start values to tune on the headset):
    - **Sun charge:** once per wave, adds 4 s of beam (12 s becomes 16 s), and needs the magnifying glass held toward the sun about 2 s. By day only.
    - **Seasoning wears off** after about 8 s (the sparkle fades with it), for Spicy snack and Spicy sugar alike. Healing still stops at full wall health.
    - **Ring the bell:** no cooldown on ringing, but a goblin dazed by the bell cannot be dazed by it again for about 6 s, so pebble spam cannot hold a group at the tower. The daze area stays small.
    - **No extra limit needed:** Spicy sugar costs a pepper use and a sugar cube; Goblin shot costs a goblin that could have been eaten (no heal, no horn charge) and a slingshot use; Fire pebble works only at sunset and night, needs a torch trip per shot and burns out in 5 s; Chicken dinner comes from the rare cart; Flying keg ends the magnet's use window, and kegs come back only after about 25 s.
- **Regular achievements** (decided 2026-11-16): 8, the same number as the secrets, so the shelf has two even rows (secret and regular). Shown plainly with their goal. **Each one teaches a skill or a play style,** so chasing them makes the player better at the game; none is a "kill 100" grind, and each can be earned in one good battle.

    | Name | Goal | What it teaches |
    |---|---|---|
    | Long Shot | Knock out a goblin near its own camp with the slingshot | Far aim and the slingshot's range |
    | Eyes Everywhere | Knock out goblins on 4 different sides of the castle within 15 s | Spinning the board with the crank, reading the compass |
    | Bless You | Stop a digger with the pepper ring | Reading the dirt mound, placing the ring |
    | Iron Grip | Pull 5 pieces of gear in one magnet pull | Waiting for a group, aiming at a crowd |
    | Green Thumb | Keep 3 plants alive through a whole wave | Looking after the garden, healing over growing |
    | Commander | Call, boost and move a squad in one battle, and win | All three horn orders |
    | Trap Master | Set off 3 different kinds of traps in one battle | Using the board, not only the tools |
    | Jack of All Trades | Win a battle where every tool in the loadout knocks out at least one goblin | Using the whole loadout, trying new mixes |

  - The drum is the one tool without its own trophy (it is covered by Jack of All Trades). The shelf size in docs/menus.md is updated at the end.

### 2.6 as built (2026-11-16 to 17)

Type check and build pass. Runs in the IWSDK emulator (a battle starts, goblins come, no errors); the secrets themselves are not tested on the headset. Not committed. All numbers are start values (`src/config/achievements.ts`, and the config blocks named below).

- **The list** (`src/config/achievements.ts`): the 8 secrets and 8 regular achievements with their riddles, goals and "earned" lines, and `ACHIEVEMENT_RULES` for detection. Saved in the progress (`Progress.trophies`); "Forget progress" forgets them too.
- **The tracker** (`src/player/achievements.ts`): counts only in real battles (a level, Custom Game, a battle after Skip tutorial), never the tutorial, which teaches some of the tricks. The game wires it in `GameSystem.wireAchievements`.
  - **Knockout credit:** `Goblins.cause` (set by the tool right before `kill(g, true)`) and `onKnockOutBy`. Slingshot, swatter, glass (the garden's knockouts too), horn (field knights only); a trap credits the tool that set it off (`Trigger.setBy`). Support tools mark the goblins they touch (`Goblins.credit`: magnet strip, sugar lure, pepper, drum stun) and count for a knockout or an eat within 15 s.
- **Shelf** (`src/ui/menu/shelves.ts`): two rows of 8 (regular low, secrets high), 10 degrees apart, the "More coming soon" card gone from this shelf. Dimmed until earned; a purple Kenney "?" over each unfound secret. A grab's tag: a secret's "? Name ?" and riddle, a regular one's name and goal; once earned, what it does or taught. "Trophies x / 16".
- **Toast** (`src/ui/trophyToast.ts`): "Secret found!" or "Trophy earned!", the name and what it does, above the look for 4.5 s, a chime and confetti; queued one at a time.
- **The secret abilities:**
  - **Acquired Taste (Spicy snack):** eat a seasoned goblin. Seasoning now wears off after 8 s (`PEPPER.seasonedFor`), its tint with it.
  - **Fair Trade (Goblin shot):** where it lands goblins within 5 cm are knocked out, out to 12 cm flung back 1.8 times a pebble's knock, dazed (`GOBLIN_SHOT`). Earned when one lands.
  - **Night Owl (Fire pebble):** a torch on a stick beside the bowl (75 degrees, 41 cm out, flame 21 cm up, in `reachSpots`), lit at sunset and night only. A pinched pebble 1 s in its flame burns for 5 s (flames, then smoke); loaded, it keeps burning down in the pouch. Shot, it lights kegs and haystacks (`Trigger.lightable`, hit even when a plain pebble cannot set them off); on a goblin a normal pebble plus smoke. Thrown by hand it is a plain pebble. Earned on lighting one.
  - **Kegs take fire only** (decided 2026-11-16): the magnifying glass or a fire pebble. A plain pebble or a goblin shot passes them by (`Keg.slingable` false). So the tutorial's keg lesson is gone: the trap lessons are the boulder (with the aim demo) and the tree; the tutorial map keeps its kegs for the battles played on it. The debug "Trigger lesson" button uses the boulder.
  - **Bright Idea (Sun charge):** by day (morning and day), the lens held within 14 degrees of the sun's direction from the head for 2 s: +4 s on the running use, or the next one. Once per wave (`GLASS.sun*`), a sparkle and a chime.
  - **Gentle Touch (Ring the bell):** the hanging bell is its own slingshot target: a pebble rings it (it swings, bongs, never falls); goblins on their feet within 12 cm of the road under it are dazed 2.5 s, not again for 6 s (`TRIGGERS.bellTower.ring*`). The magnet still drops it once per battle.
  - **Change of Menu (Chicken dinner):** chickens can be pinched and eaten like goblins (`GrabEat`, `Chickens.nearest`, `grab`, `holdAt`, `drop`, `eat`); one heals 3 times a goblin (`CHICKENS.healScale`). No Ready glow on chickens (they share one material).
  - **Secret Recipe (Spicy sugar):** pepper falling within 4 cm over a held cube or a lure for 0.3 s turns it spicy (reddish, a sneeze); it stays spicy through the pouch and the shot. Goblins that eat it are seasoned. Earned when one does.
  - **Package Deal (Flying keg):** the magnet's ring on a standing keg for 2 s pulls it away (it comes back on the trap timer at a new spot), ends the use window, and a small keg lands on a post by the bowl (79 degrees, 30 cm, `FLYING_KEG`). Pinch it to the pouch (let go elsewhere, it goes back on its post); shot, it tumbles and blows up where it lands or hits, 1.4 times a keg's blast. Simplified: the keg does not fly in from the board; it poofs away there and poofs onto the post.
- **The regular achievements:** Long Shot (a slingshot knockout within 45 cm of the goblin's own camp, `Goblin.camp`); Eyes Everywhere (player-made knockouts in all 4 quarters of the board within 15 s); Bless You (`PepperRing.onDiggerStopped`, the digger hook: **earnable now**, diggers were built in Phase 3, 2026-11-17); Iron Grip (5 gear pieces within 1.5 s of magnet pulls); Green Thumb (3 plants standing from a wave's start to its clear); Commander (call, boost and move in a won battle); Trap Master (3 trap kinds set off by player tools in one battle); Jack of All Trades (a won loadout battle where every loadout tool is credited).
- **Fixed on the way** (found by running the game in the IWSDK emulator, 2026-11-17; together they froze the game at start: a black board, no castle, nothing moving):
  - `src/game.ts` had two fields named `glass` (the magnifying glass and the glass sign); the sign overwrote the glass. The glass is `magnifier` now.
  - The tool shelf copy (`HandTool.displayModel`) assumed every material glows; the glass's unlit lens has no `emissive`, so the game's setup threw and stopped. Unlit parts are skipped now.
  - The night fade (`applyNightFade` in `src/fx/nightFade.ts`) stopped binding its `terrainTint` uniform in an older commit (`5acb70b`), so it read as black and every terrain material (board, castle, hills) drew black. Bound again.
  - Found by the first type check (2026-11-17): the magnet's `ring` and `ringMaterial` (its aim ring) and the horn's `ready` (it has a charge) had the same names as private fields of `HandTool` (the charge ring, its material, the hand-near touch look), so each overwrote the other: likely a broken magnet ring and a wrong horn glow. The base fields are `chargeRing`, `chargeRingMaterial` and `touchReady` now. Also: five missing names in `PerfMark` (`src/debug/perfMarks.ts`) and a reward type in `src/ui/menu/campaignPanel.ts`. The type check is clean except the old `director.test.ts`.
- **Running it in the emulator** (for the developer, or an agent asked to): `npm run dev:emulator` (the `emulator` entry in `.claude/launch.json`). The start page's microphone prompt does not resolve there, so start and drive the game from the debug page or its endpoint: `curl -sk -X POST "https://localhost:8081/__debug/run?c=skipTutorial"` (any `DebugCommand`), state from `/__debug/stats`.
- **Debug:** "Earn all trophies", "Forget trophies" (menu), "Load fire pebble", "Load flying keg" (slingshot, then "Shoot"), "Spicy sugar lure", "Chickens in front" (food). Every earn writes a debug note; a won loadout battle notes which tools were credited.

**Headset check:** use "Skip tutorial" or a level (the tutorial never earns them).
- Shelf: "Earn all trophies", then "Forget trophies": two even rows in reach, the "?" and the tags read, the counter changes.
- Each secret once: the toast pops up and reads, then the shelf shows it earned.
- Night Owl at sunset or night: the torch is in reach beside the bowl; 1 s in the flame lights the pebble; it lights a haystack.
- Package Deal: hold the magnet on a keg 2 s; the keg on its post is easy to pinch; the blast where it lands.
- Bright Idea: the sun is reachable with the lens from the seat by day.
- Frame rate on the FPS panel when a toast shows (one canvas draw, marked `trophy toast`).

---

## Phase 3: new enemies [DONE: digger, shaman, bomber, archers; brute and catapult crew on hold]

The rule: a new enemy changes **what** the player does or **when**, never just the hit count. Models come from the packs (see "Finding assets").

**The roster is complete** (decided 2026-11-16): no goblin types beyond the ones below.
- **Built before Phase 3:** grunts and runners, gear (helmet, shield, spear, sword) and balloon riders.
- **Built in Phase 3 (2026-11-17):** digger, shaman, bomber and archers ("Phase 3 as built" below). The brute is on hold. **The catapult crew is on hold indefinitely** (2026-11-16): too much logic and testing; it comes back only if time is left after everything else is built and tested.
- **Why no more:** five new types is already a lot to build, test and balance, and each needs two or more answers among the tools. Variety now comes from the board (chickens, the bell, the garden, bridges, fog, night) and from the gear mix (a helmeted runner and a bare grunt play differently without being new types).
- **Each new type has a reason:** the digger is the pepper ring's job and a surprise from underground; the shaman gives gear back, so it pushes back against the magnet; the bomber is a middle zone threat; archers and the catapult crew press from far, answered by the slingshot and the magnifying glass.
- **Build order:** 1. digger, 2. shaman, 3. bomber, 4. archers (catapult crew on hold). The first two pair with tools added in Phase 2 (pepper and magnet), so they make those tools matter right away.
- **Known gap, on purpose:** no goblin reacts to the player's traps or plants (goblins never attack plants), which keeps the AI simple. If play shows the player is never challenged on their setups, a goblin that puts out fires or rebuilds a bridge could fill it. Decide after playing.

**Zones:** far (shaman, archers; catapult on hold), middle (bomber), near (the climbers, as today), underground (the digger). Every tool gets a job.

**Digger** (the wildcard, decided 2026-11-14) [DONE]
- Tunnels underground from its camp straight to the castle. **Unseen while underground:** no marker on the board and no compass wedge, so there is no early warning.
- **Pops up inside the courtyard,** often on the side the player is not facing, sometimes several at once. **Once up, it is simply a regular intruder goblin** (the usual intruder damage, no new rules), and intruders already hurt more than goblins outside, so diggers chip the castle fast.
- **Sneaks past everything:** the garrison, the knights and the far tools never meet it. The garrison does not fight it in the courtyard either: that is the giant's to clean up.
- **Easy to finish:** one grab and it is eaten. The danger is the surprise, not its toughness.
- **Untouchable underground:** the drum does not stun it there. Only the pepper ring stops it.
- **The answer is the pepper ring** (2.2, Pepper): a digger that tunnels into a peppered segment uses it all up, stops outside the wall, comes up sneezing and seasoned (heals double when eaten), and walks and climbs like a regular goblin.
- **Where and how many:** a level setting (Diggers per wave, from wave 2); each comes alone from a random camp that sends that wave. Which campaign level brings them is decided later by the developer.
- **Without pepper** it still loses to a grab, so no loadout leaves the player stuck ("best answer, never the only answer").
- **The magnet does nothing to it:** diggers carry no gear.
- **Visible when it surfaces** (AGENTS.md: every attack visible without sound): a dirt burst where it comes up, the threat cue flash, and its compass wedge turns red at once.
- **A dirt mound only for the last 2 to 3 seconds:** hidden for most of the trip, then a small crack of dirt races toward the wall. A player facing that side sees it coming and can react; a player facing away is still surprised. It is the only warning (no rumble). It also shows the pepper working: the mound hits the ring, stops, and the goblin pops up sneezing.

**Shaman** [DONE]
- Stays at the back of its group and gives stripped goblins their helmets (or shields) back. (Waking knocked-out goblins was dropped 2026-11-17: knockouts vanish at once, so there is nothing to wake.)
- Question: find me behind the crowd. Answers: slingshot, the knights.

**Bomber** [DONE]
- Carries a keg on its back toward the wall. At the wall it lights a short fuse, then explodes: big damage. During the fuse the player can pinch it and toss it away; it blows up where it lands (decided 2026-11-17). It cannot be eaten.
- Hit it on the road and it explodes among its own group (and sets off kegs near it).
- Question: hit me before I arrive. Answers: slingshot, the knights.
- Reuses the goblin and the keg model.

**Goblin archers** (after the shaman) [DONE]
- Stop at middle range in a tight group and shoot volleys at **the garrison** (not the castle, not the knights, not the giant's hands). When the garrison is empty they walk in and climb like grunts (decided 2026-11-17).
- Question: break up the group before your wall is empty. They are the only goblins that stand still (with the shaman at its post), so they are the best target for a keg, a tree or the slingshot.
- Fits a level about the garrison (level 9, Arrow Rain, docs/custom-mode.md section 10).
- No arrows at the giant's hands: small fast arrows plus tracking lag would feel unfair.

**Catapult crew** **On hold indefinitely (2026-11-16)**, kept as a record.
- A siege catapult at a camp that stays put and lobs stones **at the giant**.
- **A new verb, defending:** the player blocks a stone by holding a hand or arm in its way. The stone is pushed aside and bounces off onto the board, harmless. No catching, no throwing back: breaking the catapult is the slingshot's, the knights' and the triggers' job.
- It does not move: the Angry Birds target. Answers: slingshot hits, a keg or tree next to it, the knights. It breaks after a few hits (the demolished model).
- **Several catapults sit within 100 degrees of each other** on the board (a generator check). Once the player turns that side to the front, they see and block them all without turning again.
- On the compass: its own purple icon (1.3).
- Model: `siege-catapult` and `siege-catapult-demolished` from `kenney_castle-kit` in Downloads.

**Blocking projectiles** (catapult stones and the goblins the brute throws, same rules):

- **Aimed at the giant, not the wall:** each shot picks a random spot on the giant's head, chest or shoulders. So the hands stay near a comfortable middle and only move a little to block, instead of stretching out to the wall.
- **Warning:** a creak (or the brute's wind-up) from its direction (spatial sound), its compass icon flashes, and the shot flies slow and high (about 2 to 3 s), so there is time to turn with the crank and raise a hand.
- **A block** is any part of a tracked hand touching the shot. No special block zone: if the headset sees the hand, the block counts, however close to the face.
- **Pushed aside:** a blocked shot flies off with the existing toss math (no physics engine), sideways and away from the hand, and lands on the board. A blocked goblin lands dazed. A goblin that the hand happens to pinch is simply held (grabbing goblins already works), and can be eaten.
- **A shot not blocked hits the giant, which is castle damage** (the giant and the castle share one health): a thud and a small dust puff in front. **No screen flash or shake** (people flinch at things flying at the face; keep it comfortable).
- **No special protection:** a player who turns away from the catapults takes the hits. The sound and the compass warn enough.
- **Bare hands rule change (update AGENTS.md when built):** "only grab and eat" becomes "grab, eat, and block shots". Still no smashing or slapping.

### Phase 3 as built (2026-11-17) [DONE]

Type check and build pass. Not tested on the headset or in the emulator. Not committed. All numbers are start values in config (`GOBLINS`, `DIGGER`, `SHAMAN`, `BOMBER`, `GOBLIN_ARCHERS`, `WAVES.archerGroup`).

**Decided with the developer before the build (2026-11-17):**
- **Shaman: gear back only.** Knockouts vanish at once, so there is nothing to wake up: it puts a helmet (or a shield) back on one stripped goblin near it.
- **Shaman look:** the Kenney lantern post held up as a staff, a purple tint (no pack has a staff).
- **Archers:** shoot the wall garrison only (not knights). When the garrison is empty they walk in and climb like grunts. Knights beat them up close.
- **Bomber at the wall:** a 1.5 s fuse; pinch it and toss it, and it blows up where it lands. It cannot be eaten.

**How they look** (only one goblin body exists in the packs, `character-orc`): each type carries its own prop on its own gear bone, merged into the one template (no extra draw call), plus a body tint. Shape first, tint second: the digger a shovel over its shoulder (dirt brown), the shaman the lantern staff (purple, a little taller), the bomber a keg on its back (reddish), the archer a Kenney bow and a dark quiver (dark green). Only grunts carry the regular gear (spears, swords, helmets, shields). New models: `tool-shovel`, `weapon-bow` (docs/assets.md).

**Code:** the shared state and two new modes are in `src/units/goblins.ts` (`tunneling`: under the ground, untouchable, not on the compass; `fuse`: a lit bomber at the wall, grabbable, a stun freezes it). Each type's own behavior is in `src/units/goblinKinds.ts` (`GoblinKinds`, updated right after the goblins).

- **Digger:** comes alone, with no drum and no compass warning. Tunnels from its camp straight at the castle (up to 18 degrees off the camp's direction) at 14 cm/s. A dirt mound with flying clods and a soft dig sound shows only for its last 2.5 s outside the wall. Into a peppered ring segment: it uses all of it (`PepperRing.useAll`, so Bless You is earnable now), comes up outside the wall sneezing and seasoned, then walks to the wall and climbs. Otherwise it comes up in the courtyard as an intruder: a dirt burst, a sound, the wall flash, and its compass wedge turns red at once. The drum, tools, knights and garrison never reach it underground.
- **Shaman:** walks at the back of a grunt or runner group, slower than them (9 cm/s). Stops on its road 150 cm out while goblins are within 40 cm of it (later groups on the same road pass by it too); alone for 3 s, it walks on and climbs like a grunt. Every 6 s it gives one stripped goblin within 40 cm its helmet back (or its shield): a purple sparkle on both and a sound (the chime for now). "Stripped" means its gear came off by a hit or the magnet (`lostHelmet`, `lostShield`).
- **Bomber:** walks inside a grunt or runner group at 10 cm/s. Knocked out anywhere (a pebble, an arrow, a knight, the glass, a seed, the swatter, a trap), it blows up: goblins within 10 cm are knocked out (armor does not help, like a trap), standing kegs within 14 cm go off, field knights within 9 cm take a blow. At the wall it lights a 1.5 s fuse (sparks, a hiss, the wall flash pulsing): pinched, the fuse waits; tossed, it blows up where it lands. If the fuse runs out: the same blast plus 8 castle damage (a grunt's wall hit is 0.35). It cannot be eaten (no ready pulse at the mouth).
- **Archers:** come in groups of 3, stop about 105 cm out (past the garrison archers' 60 cm range), face the castle and shoot a volley every 3 s at random soldiers standing on the wall: dark arrows, 35% hit chance, a hit is one blow (`Troops.hurt`). Once no soldier stands on the wall they walk in for good. Knights fight them like any goblin on the road.

**Where they show up:** no campaign level uses them yet (levels 6 to 15 are still locked teasers). Custom Game's Waves tab has four counts: Diggers, Shamans, Bombers, Goblin archers (per wave, from wave 2, 0 leaves a type out). This stands in for the "Allowed goblins" switches of docs/custom-mode.md section 4: a count of 0 is a type switched off. The wave banner names shamans, bombers and archers (never diggers, they are a surprise). Saved levels from before have none.

**Sounds:** Kenney stand-ins (`diggerSurface`, `diggerDig`: mining impacts; `bomberFuse`: a knife draw; `goblinBowShot`: a pluck); the chime for `shamanCast`. The bomber's blast uses `kegBoom` (the chime).

**Not built / simplified:** the lantern does not glow at night (it has the goblins' night rim only); the keg on a bomber's back does not fly off when it blows; archers fire together, not staggered.

**Debug:** "Digger in front", "Shaman group" (armored grunts with a shaman at the back), "Bomber group", "Goblin archers", each from the camp nearest your front.

**Headset check:** start a battle (or "Skip tutorial"), then:
- Looks: each type reads apart from the seat by its prop, by day and at night; the props sit in the hand or on the back (not floating or inside the body).
- Digger: press "Digger in front": nothing on the compass, then the mound for about 2.5 s, then it pops up in the courtyard with the wall flash. Fill the front pepper segments ("Pepper ring front"), send another: it stops outside the wall sneezing, the segment empties, Bless You pops up (not in the tutorial).
- Shaman: "Shaman group", strip helmets with the magnet or pebbles: purple sparkles and helmets come back; it stops about 150 cm out and walks on when alone.
- Bomber: "Bomber group", shoot it on the road: its group goes with it; let one reach the wall, pinch it during the fuse and toss it out; let one go off: the red flag drops clearly.
- Archers: "Goblin archers": they stop out on the road and shoot the garrison; press "Thin garrison" a few times until the wall is empty and they walk in.
- A Custom Game with all four counts above 0: the waves play and clear.
- Frame rate on the FPS panel with diggers and archer volleys.

**Brute** (the final wave's mini boss) **On hold, not in the current build (2026-11-15):** the magnet, the digger and the other additions already add enough. Kept as a record. If he comes back: the bell is now the drum, the slingshot and horn are no longer fixed (rethink "the fixed tools always win it"), eating heals instead of filling the horn, and one idea for the magnet is to tear off one plate during an opening, which makes him angry and charge a few steps.

**The idea: a smaller giant who does what you do.** Not just more health: he throws goblins at you, flattens your knights, and gives openings to punish, like a boss in Dead Cells (a warning, then a window).

Earlier designs dropped: phases that each need certain tools (a missing tool could make the wave unwinnable), and pepper as an answer (it only reaches him at the wall, too late).

- **What he is:** a big ogre, slow and loud (a thud on each step, seen from far away). At most one per level, in the last wave, rising with the last camp to the drum. A skull on the wave progress and at his direction on the compass (1.3).
- **He throws goblins at the giant:** he grabs a goblin of his escort and lobs it at the giant (Blocking projectiles, above): block it (it lands dazed on the board) or pinch it and eat it.
- **He stomps:** a shockwave knocks nearby knights flat for a few seconds. Knights alone cannot simply grind him down.
- **Openings:** after each throw or stomp he pants for a few seconds, and his plates glow. Only then do hits break his armor; outside an opening, hits only make him stagger.
- **At the wall** he never climbs: he smashes it, a big hit every few seconds (the biggest wall damage in the game, with the wall flash). So the clock is how long he takes to arrive.
- **Toughness: 12 damage**, shown as **3 armor plates** (helmet, shoulder plates, belly plate), each taking 4 and **cracking in stages**, so the progress shows without a health bar. With all 3 gone he falls over, dazed, and **shrinks into a normal goblin** that runs: grab it and eat it (it counts for the horn).

| During an opening | Damage |
|---|---|
| A knight squad fighting him | 1 every few seconds |
| A goblin loaded into the slingshot | 2 (a pebble only bounces off) |
| A trigger (keg blast, falling tree, boulder, a bridge dropping under him) | 4 |
| **Ripping a plate off by hand** (he is at the wall, panting: pinch a plate and pull) | a whole plate |

- **Outside an opening,** knights hold him in place (he walks no closer while a squad fights him). That is their job in this fight.
- **The bell:** knocks him back off the wall and staggers him a few steps (buys time). No damage.
- **The swatter** bounces off. **Bare hands** cannot lift him (but can rip a plate off, above). **Pepper** does nothing to him.
- **Why this works:**
  - **The fixed tools always win it:** the slingshot (loaded goblins) and the horn (knights) are in every loadout, so no loadout leaves the player stuck; the 2 picked tools only make it faster.
  - **It uses the whole loop:** his escort and his throws are food: eat them to fill the horn (knights at him) or load them into the slingshot (plates off).
  - **Risk and reward:** letting him reach the wall hurts the castle most, but it is where a hand rips off a whole plate.
  - **A funny ending:** the giant ends the boss by eating what is left of it.
- Model: search the packs ("Finding assets"); Kenney's mini dungeon and mini arena packs may have a big character, or suggest a pack (an ogre or orc).

---

## Phase 4: chains and score [DONE: the score and stars; chains on hold]

**Chains are on hold** (the developer, 2026-11-16): too much logic and testing. Kept as a record below. The score and the stars are built ("The score as built").

What was agreed for chains:

- **Chains:** an object's result sets off a nearby object (a keg blast drops a bridge, a falling tree sets off a keg). The inputs and outputs are already in each registry entry (Phase 2); Phase 4 passes them on, through a neighbor list made once at load time.
- **Short and local:** 2 to 4 links per group of objects, never 100; groups far enough apart that one cannot set off another; the generator checks it.
- **Moving enemies are fine:** the roads do not move, so traps always meet goblins; choosing the moment is the skill (fire now at 3, or wait for 10). Traps come back (Phase 2), so the first group never uses up everything.
- **Links seen before they fire** (a fuse line, a rope), and feedback that builds (a note higher per link, "Chain x4!").
- **The tutorial's trigger lesson** may become a small chain on its fixed seed (same steps, a bigger payoff).
- **Score (decided 2026-11-15, see below).**

### The score and the stars (decided 2026-11-15)

One score number per battle; the stars come from which of 3 ranges it falls in. The score decides how people play, so it rewards the intended style: **a clever giant who stops goblins far out, protects the castle, and eats the leaks to stay alive.** The ranged tools stay the main game; eating supports it (it heals, 2.5).

| Part | Points | What it encourages |
|---|---|---|
| Every goblin defeated (any way, eaten too) | 10 | every kill counts, no method feels useless |
| Distance bonus | far +10, middle +5, near or eaten 0 | stop them early, use the whole board |
| Multi-kill (one action knocks out 3 or more) | +5 for each goblin past 2 | groups, kegs, boulders, good aim: skill |
| Castle health at the end | up to half of the level's par, by the share of health left | protect the castle (eating feeds this part) |

- **Par** comes from each level's goblin count (goblins x 10, plus the full health part), so the generator sets the star ranges on its own, Custom Game included.
- **Stars:** any win is 1 star (as today), 2 stars at 60% of par, 3 stars at 85% (start values).
- **Not "closer means more points":** it would reward letting goblins hit the wall, against the ranged tools and the story.
- **The win screen shows the breakdown** (each part and its points), so players learn what earns points and drift toward the intended play.
- **No live score in battle** for now; floating "+15" numbers may come later as juice.
- Numbers live in config, so tuning needs no code.

### The score as built (2026-11-16) [DONE]

**Not built, on purpose:** a live score in battle (floating "+15" may come later as juice), saving the best score (only the best stars are saved), a score on the loss panel or in the tutorial.

Type check and build pass. Not tested on the headset. Not committed. Numbers in `SCORE` (`src/config/game.ts`), rules in `src/rules/score.ts` (`BattleScore`), owned by the battle (`battle.score`).

- **Defeated, 10 each:** every knockout (`Goblins.onKnockOutBy`), every goblin eaten, and a goblin spent as a slingshot shot.
- **Distance:** the knockout's distance from the castle's middle: far from 200 cm (+10), middle from 100 cm (+5), nearer or eaten 0.
- **Combos (multi-kill):** knockouts by the same source within 0.3 s of the first count as one action; the 3rd and each after it +5. A source is a player tool or **Traps** (kegs, boulders, trees, bridges, the potions and bomber blasts, whoever set them off: `Goblins.trapHit`, set by `Triggers`). Goblins the potions turn into chickens count as trap knockouts. Soldiers, garrison and falls never count. The horn's knights count as "Knights".
- **Castle:** half of par times the share of health left.
- **Par:** the goblins the waves send (from each wave's plan at its start, balloon riders too) x 10 x 2. A battle started at a later wave ("Start at wave N") only counts the waves played.
- **Stars:** any win 1, 2 at 60% of par, 3 at 85% (`SCORE.stars`). Replaces the red flag's share (the old `MENU.stars`). Campaign and Custom Game keep their best stars as before.
- **Win panel:** "Score N" in gold under the stats, then a breakdown table (2 columns, 3 rows, a name on the left of each cell and its points on the right): left "Goblins ×34 +340", "Far out: 6 far, 5 mid +85", "Castle 75% +150"; right "Combos ×4 +30", "Best: Swatter ×5", and the combo points by source (top 3, "Swatter +20 · Traps +10", or a tip when there were none). Then the note ("Score N for 3 stars", or New best). The win panel is 10.4 cm taller (`END_PANEL.winHeight` 42.4). The loss panel and the tutorial show no score.

**Headset check:** win a level (or "Skip tutorial" and win): the score and the table read clearly from the seat and fit the panel (the panel is taller: not too high or low, the buttons still in reach); swat a crowd, and blow a keg into a group: Combos, Best and the by-source row (Swatter, Traps) go up, and Far out for far kills; the stars match the score (3 stars needs a mostly full castle plus far kills).

---

## Phase 5: the modes (Endless and campaign 1 to 5 built 2026-11-16, see "Phase 5 as built")

- **Campaign:** the 15 levels ([custom-mode.md](custom-mode.md) section 10, redone 2026-11-16: 1 to 5 playable, 6 to 15 locked teasers). Each new enemy or tool is introduced by a level, one at a time. The most visual ones go in levels 1 to 5 (open from the start), because judges play only 10 to 15 minutes.
- **Daily Challenge: dropped (2026-11-16).** Endless already gives the reason to come back and Custom Game the variety; see "Dropped ideas".
- **Endless:** waves until the castle falls, for a high score. Full design below ("Endless mode").
- **Random:** not its own mode. A dice button ("Surprise me") on the Custom Game list makes a random level and plays it; save it if you like it.
- **Custom Game:** stays the sandbox. Later it may get challenge toggles for cards already met in the Daily.

### Endless mode (decided 2026-11-16)

**The idea:** one battle that never ends. Waves keep coming until the castle falls. Everything scales: the goblins and the player both grow, so the chaos rises over a run. The player's power grows by choice (a card each wave), so every run builds differently.

**The run:**
- **One battle, waves forever,** with the breathers of 2.8 between waves. Traps come back during waves as usual, and day and night keep cycling, so later waves bring night fog too.
- **Start:** 4 tools picked on the loadout stand, as in the campaign.
- **Length:** an average run should end in about 8 to 12 minutes (judges have 10 to 15 in all). A run that drags hurts more than one that ends early.
- **Score:** the score (Phase 4) plus the waves survived. The best run is saved on the device (no backend).

**The threat ramp:**
- **Threat grows faster than player power:** the player feels stronger every few waves, but loses in the end. If both grew at the same rate, wave 20 would feel like wave 5 with more noise.
- **More goblins** each wave, up to the cap of 100 at once with troops (`LEVEL_GEN.unitBudget`).
- **New problems, not only more goblins** (and the only way up once the cap is reached): more camps rising (a map with about 8 camps, most asleep at the start), more directions at once, new enemy types joining one at a time (digger, shaman, bomber, archers), a bigger gear share and faster spawns.
- **More chaos in choices, not in what is seen** (1.2, clarity): goblins still come in readable groups, and the compass and the warnings keep up. A board the player cannot read is unfun and tiring in seated VR.

**Boost cards (every breather):**
- **A pick of 1 of 3 cards in every breather.** It gives the breather its payoff and keeps the "one more wave" pull.
- **Quick to pick:** big cards with a short name, one line of plain text and an icon, one poke to choose. No pick within about 10 s: the wave starts and none is taken, so the pace never stalls.
- **Only useful cards:** a tool card shows only for a tool in the loadout.
- **Small steps:** a card is about half the size it would be with fewer picks, and one card stacks up to 3 times, each stack a bit smaller.
- **Rarity:** common and rare; rare cards come less often and change how the player plays.
- **Plain text, never a hint at a secret** (2.6): a card says exactly what it does, and no card names a secret ability.
- **The cards** (start values, to tune):

    | Card | Effect | Rarity |
    |---|---|---|
    | Heavy Pebbles | A pebble breaks 2 pieces of gear instead of 1 | common |
    | Steady Aim | The slingshot's aim assist a little stronger | common |
    | Long Swing | Swatter window +2 s | common |
    | Quick Swatter | Swatter recharge 15% shorter | common |
    | Wide Swatter | The swatter hits a wider area | common |
    | Strong Spice | The pepper ring lasts longer | common |
    | Wide Ring | The pepper ring 15% bigger | common |
    | Strong Pull | The magnet's ring bigger | common |
    | Quick Magnet | Magnet recharge 15% shorter | common |
    | Long Beam | Magnifying glass beam +2 s | common |
    | Green Fingers | Plants grow faster | common |
    | Tough Roots | Plants wilt more slowly | common |
    | Loud Drum | The drum's stun lasts longer | common |
    | Sweet Tooth | Sugar cubes keep goblins busy longer | common |
    | Quick Horn | Horn recharge 15% shorter | common |
    | Stone Masons | The wall repairs a little in each breather | common |
    | Big Appetite | Eating heals 15% more | common |
    | Trap Maker | 2 more traps on the roads | common |
    | Quick Rebuild | Traps come back faster (25 s to 20 s) | common |
    | Big Booms | Keg blasts bigger | common |
    | Fresh Soil | 2 more seed beds | common |
    | War Chief | The horn's squad cap +1 | rare |
    | Iron Knights | Squads fight harder and last longer | rare |
    | Lucky Wheels | The potion cart comes much more often | rare |
    | Second Bell | The bell tower comes back once | rare |
    | Thick Walls | The wall's max health +25% | rare |

**A new tool every 10 waves:**
- **After waves 10, 20, 30 and 40** the breather's pick is a tool instead of a boost card: a new loadout slot.
- **Every tool not yet on the stand is shown,** not 3 at random, so a bad draw never costs a build.
- With 8 tools and 4 to start, the full arsenal is out by wave 40: the goal for the best players. An average run sees about one new tool.
- **To check:** each new slot needs a tool platform inside the reach band. Four more platforms around the castle may not fit; check against the tool layout before it is final.

**Decided (2026-11-16):** one fixed ramp for everyone (no difficulty choice), and a fresh random map every run.

**The 360 degree vision (the developer, 2026-11-16).** The new tools of waves 10, 20, 30 and 40 stand on platforms around the back, so a deep Endless run is played on a swivel chair or standing. That is on purpose: the whole point is the full sandbox of tools, and full 360 degree rapid action is what makes this a VR game and not a 2D screen strapped to the eyes. Everything else stays front facing as much as possible because of the competition's seated rules (AGENTS.md hard rule 3), and the first 4 tools always stand in front, so the campaign, Custom Game and the first 10 Endless waves stay fully seated. Few players will reach wave 10 in a judging session.

**Open:**
- Frame rate late in a run (100 goblins, more traps, beds and plants, night): measure on the headset.

### Phase 5 as built (2026-11-16)

Type check and build pass. Not tested on the headset or in the emulator. Not committed. All numbers are start values in config.

**The generator knows everything new** (docs/custom-mode.md sections 4 and 6; `LEVEL_GEN.version` 2):
- New settings in `LEVEL_SETTINGS` (Custom Game shows them on its tabs on its own): Map tab: Haystacks, Bell towers, Rope bridges, Potion cart, Seed beds (they were fixed counts for every map; the level's `map.extras` now sets them, `addExtraTraps` and `Garden.place` read it; levels saved before keep the old counts). Waves tab: Waves (2 to 6) and the allowed times of day (Morning, Day, Sunset, Night). Rules tab: the allowed tools (8 switches).
- Each wave stores its time of day (`LevelWave.time`, spread over the allowed times by `waveTimes`; the battle shows it with `Battle.timeOfDay`). Night fog follows the wave's own time.
- The allowed tools go in `rules.tools`: the battle keeps the loadout's allowed tools and fills free slots with the level's other unlocked allowed tools (never a locked one).
- New checks: at least one time of day and one tool allowed.

**Campaign levels 1 to 5** (docs/custom-mode.md section 10):
- Presets in `src/level/presets.ts` (seed, settings, and exact overrides: which wave each camp rises in, each wave's time). `npm run gen -- --campaign` writes all of them to `src/maps/levels/levelN.json` in one go; `--preset N` prints one.
- Campaign Fight and Next level load the level's own map and play its waves and rules (`src/level/campaignLevels.ts`). A level with no file (6 to 15) plays the old battle on the tutorial map.
- The cards in `src/config/levels.ts` match section 10. Rewards: 2 the magnet, 3 the glass, **4 the drum and 5 sugar cubes (my start values, the doc left them open; easy to change)**.
- First pass at each twist: 1 First Watch (2 opposite camps, the second rises in wave 2, straight roads, easy), 2 Sky Pirates (4 balloons a wave), 3 Tin Hats (85% helmets), 4 Sun Garden (10 seed beds, 3 haystacks, no night wave), 5 Nightfall (sunset then 3 foggy night waves).

**Endless** (`src/level/endless.ts`, `ENDLESS` in config):
- The main menu's left button is Endless now (where Daily Battle was). Like Fight, empty loadout slots get the hint first.
- Each run: a new random seed, the generator makes a map with 7 camps (fewer if no seed passes), 2 up at the start and one more rising every 2 waves. `npm run gen -- --endless --seed 7 --waves 20` prints a run's map and ramp.
- The ramp (`endlessWaves`): goblins 14 x 1.05^(n-1) + 2(n-1), capped by the unit budget; camps sending at once 1, then one more every 3 waves; runners, helmets and shields rise; balloons from wave 3; diggers from wave 4, shamans 6, bombers 8, goblin archers 10, each growing slowly; spawns faster (55 s down to 32). Times of day cycle every 4 waves, with fog at night. 99 waves are made; nobody should reach the end.
- Breathers (`buildEndlessSteps`): the wave banner hides itself after 6 s; after a wave clears, the card panel (`src/ui/boostPicker.ts`) shows 3 cards, at most one rare (20% roll). One poke on a tick picks; after 10 s the next wave starts without one. After waves 10, 20, 30 and 40 it shows every tool not on the stand instead, and the pick goes on a platform around the back (`ENDLESS.extraSpots`; the slingshot always takes the right front, moving a hand tool behind).
- Boost cards (`src/rules/boosts.ts`): the systems read `BOOST` where they use the number (reset every battle start, so nothing changes outside Endless). Built as in the card table, with these changes: **Wide Ring** (the ring is a fixed band) became **Quick Pepper**; **Trap Maker**, **Fresh Soil** and **Second Bell** are left out (traps and beds are placed when the map is built); **Quick Drum** added; **War Chief** stacks once (`TROOPS.max` has room for one more squad).
- The end: the loss panel's subtitle says the waves survived, its line the score (the battle's score plus 25 a wave) and "New best!" or the best. The best run is saved in the progress (`endlessBest`). Try again plays a fresh run on the same map.
- The compass shows no wave dots in Endless (the banner says the wave).

**Debug:** "Start Endless" (from the menu), "Endless: show cards", "Endless: show new tools".

**Headset check:**
- Generator: `npm run gen -- --campaign` (all 5 pass), and a Custom Game level with only Day and Night on: waves 1 to 3 by day, the last at night. A level with only the slingshot and the swatter allowed: only those stand.
- Campaign: Fight on levels 1 to 5: each loads its own map; level 1's second camp rises behind you in wave 2; level 5 is sunset then foggy nights; Next level loads the next map.
- Endless: "Start Endless": the run starts; after wave 1 the card panel shows 3 readable cards in reach, a pick plays a chime, waiting 10 s starts the next wave; "Endless: show new tools", pick one: it appears on a platform behind you; let the castle fall: the panel shows waves and score, a better run says New best.
- Frame rate late in a run (wave 12 and on: diggers, archers, 3 balloons).

---

## Dropped ideas (so they are not discussed again)

- **Narrowing the threat arc** (most threats from the front): the 360 battlefield is the game.
- **Pulling the camps in** for speed: the big board stays; goblins walk faster instead.
- **A knob twisted with the wrist:** a wrist turns only about 180 degrees. Replaced by the crank (1.7).
- **Relying on a swivel chair:** judges may not have one, and the tools and flags do not turn with the body.
- **Ladder crew:** a ladder is only a faster climb. (The digger came back in Phase 3, with the pepper ring as its answer.)
- **Bowling ball:** the same result as the boulder.
- **Seesaw log:** never agreed (2026-11-14).
- **The first magnifying glass** (beam knocks out, lights kegs): a reskin of the slingshot. Replaced by the sun garden (2026-11-15).
- **Other magnifying glass ideas:** magnify things to triple size, stone trolls frozen by sunlight, mirror relays (a puzzle genre, no control from the seat), a fire line drawn on the ground (goblins keep to fixed roads) (2026-11-15).
- **Other plants:** snap-jaw (takes away from eating), bramble, sleepy poppy (overlaps the drum), decoy gourd, launch bulb, lantern bloom (copies Plants vs Zombies), rally flower (support moved to the horn) (2026-11-15).
- **The bell:** its shake was unreliable to detect; replaced by the drum (2026-11-15).
- **Villagers carrying knocked-out goblins to the wall as food:** too complex for now (2026-11-15).
- **Pepper stripping armor:** it only reached the wall, where armor matters least; the magnet does it at range (2026-11-15).
- **Beehive, dam, steam geyser, sheep stampede:** bees too small to see from far, fluids, a reach-only trigger, too many units (2026-11-14).
- **Honey jar:** replaced by sugar cubes (same lure, cheaper: reuses the pebble toss, and fits the giant).
- **Water tower, flood, rivers:** fluids look bad on the Quest's budget.
- **Finger flicks or custom poses to shoot:** they flicker with hand tracking.
- **Arrows at the giant's hands:** unfair with tracking lag.
- **Challenge cards (with downsides) in Endless:** endless waves are enough of a hook. (Pure boost cards each breather came in instead, 2026-11-16.)
- **A separate Random mode:** the same as Custom with a dice button.
- **Daily Challenge** (2026-11-16): Endless already gives the reason to come back and Custom Game the variety; without a backend there is no shared leaderboard, and judges will not come back the next day. Its stronger upside and downside cards may come back later as rare "deal" cards in Endless (see "Maybe later").
- **A faster slingshot loop** (bigger pouch snap, shorter pull): loading feels fine; only the aim assist changes (1.8).
- **Brute phases that each need certain tools:** a missing tool could make the wave unwinnable. Replaced by armor plates with many answers (Phase 3).

**Maybe later** (good, not planned): the trench coat goblin (three goblins in a coat, scatter when hit, count as 3 when eaten whole), the chieftain (knock out its banner carrier and nearby goblins run back), the thief (steals a tool from a platform), the torch bearer (sets your traps on fire, or sets them off among its friends), engineers building a siege tower (a timer you can see), bees from a beehive, the boomerang. **Interactions with the camps** (2026-11-16): worth exploring properly later, but never anything that needs hitting a camp precisely from the seat (camps are too far away). **Deal cards in Endless** (2026-11-16): every 5 waves or so, one of the 3 cards is a big upside with a real downside (the dropped Daily's idea, for example "eating heals double, but the garrison leaves"); only if plain boosts feel flat once Endless is played.

---

## Testing status (2026-11-17)

Worked out from the playtest reports of 2026-11-17 (six rounds of fixes, "Bug fixes from a friend's playtest" below). Every fix in those rounds passes the type check and the build; **none of them has been seen on the headset yet**. Three groups:

**A. Seen on the headset and confirmed good (keep an eye on, nothing to fix):**
- The drum strike itself (detection, stun): "works great".
- The layered torch flames' look (only their size changed since).
- Morning, day and night looks (the afternoon look was the one called out).
- The menus and UI kit in general (headset rounds of 2026-11-11 to 12).

**B. Seen on the headset, found broken, fixed in code: re-test each.**
- Flicker during fights, slingshot and swatter hits, knights, boulders, sunflower shots and toggling tools. Fixes: pools built up front, the shader warm-up in its VR (multiview) version after entering VR, bone textures, compass number throttled, garden, horn previews, panels, icons and toasts made ahead. The biggest single change; re-test hard.
- The white hands in front of the eyes when hands are out of view (now a hidden camera layer and a short steady-tracking wait).
- Endless start freeze (dark fade while the map builds; every map load now fades).
- Endless cards: buttons over text, no timer any more, Wide Swatter grows the swatter with a pop.
- Shields 2.2 times bigger.
- Magnifying glass: aiming works (the hole bug), grip slant and size (30% bigger), the fill ring, the beam look, the goblin aim assist.
- Horn: a spoken word ("Charge!") with echo cancellation, `speakLevel` 0.04 and `speakTime` 0.25 (tune on the mic panel); moving squads while it rests; it stays bright then.
- Compass and crank: higher and 10% smaller; pinch with the other fingers curled; letting go on an open pinch or a raised hand; smoothed turning.
- Drum: the big drum rising on the compass's spot, its big stick, the platform and compass sinking, the 2 s stay after a strike.
- Magnet: grip, gear flying to the tips, the waves of force.
- Sugar: thrown by hand, goblins walking off the road to it and back, on the rampart too, the new bowl.
- Sunflower (new model, tracking, fire rate) and mushroom (puffs when goblins come near).
- Rampart: goblins walk while hunting the garrison; archers no longer flip-flop or run on the spot.
- Goblins about 15% slower.
- Bell tower model, rope bridge with its ravine and water, torch flames 2.3 times bigger.
- Night sky: the planet's two-color ring, the moon's glow at a quarter.
- Tutorial order (eat right after the compass, the red flag after).
- Win panel farther and its lines apart; all tools unlocked by default.
- Sounds: the eating gulp fades, the tool-ready chime and glow, the village ambience on the home screen and pause (now a 1.3 MB file).

**C. Not seen on the headset at all (no report touched them):**
- Campaign levels 1 to 5 one by one, each with its twist: First Watch's second camp rising behind in wave 2, Sky Pirates' balloons, Tin Hats' helmets, Sun Garden's beds and haystacks, Nightfall's sunset then three foggy nights. Next level from the win panel.
- Night fog in a battle (rolls in before the night wave, lifts after; compass, tools and signs stay sharp).
- The Phase 3 goblins in play: the digger (no warning, the mound, the courtyard pop-up, stopped by the pepper ring), the shaman (gives helmets back), the bomber (blows up its group, the fuse at the wall, pinch and toss), goblin archers (shoot the garrison, walk in when it is empty). Their looks by day and night.
- The pepper ring (filling segments by shaking, the compass arcs, goblins sneezing through it).
- Traps beyond the boulder: kegs by fire (glass or fire pebble), haystacks (glass lights them, they block the road), the bell tower drop (magnet) and ring (pebble), the potion cart and chickens (rare: use "Show new traps"), the bridge drop with goblins on it and the long way round, traps coming back at new spots.
- Knights beyond the move: boost (fallen knights back, faster strikes) and the squad cap of 3.
- Balloons: popping with the slingshot, the swatter pushing them away.
- The 8 secret abilities (Spicy snack, Goblin shot, Fire pebble, Sun charge, Ring the bell, Chicken dinner, Spicy sugar, Flying keg) and the 8 regular achievements; the toast and the shelf rows.
- The score and stars: the breakdown table on the win panel, combos, the stars matching the score.
- Endless past the first waves: the new tool after wave 10 on a platform behind, boost cards other than Wide Swatter, the ramp (diggers from 4, shamans 6, bombers 8, archers 10), the loss panel's waves and best score, Try again.
- Custom Game: making, editing, duplicating and deleting a level, the new settings (traps, beds, times of day, allowed tools, the four new goblin counts, foggy night), "Surprise me".
- The pause menu: the height rail, Snap turning, Quiet horn, Measure reach again, Restart, Menu; auto-pause on the Quest menu and with the headset off.
- First visit: the start page's mic prompt, the reach check, Skip tutorial, the whole tutorial from start to end (the drum, magnet, glass and sugar are not taught in it).
- Frame rate: the FPS panel in a big late Endless wave (100 goblins, night, fog, plants, chickens) and the stress test since the troops and new goblins.
- Load time on the headset (first load and a map load behind the fade).

### Seventh round (2026-11-17)

- **Campaign page stopped answering after several taps** (the world kept moving, a reload fixed it). The cause was not found by reading. Now:
  - The menu's rail, shelves and page update each on their own (`guarded` in src/debug/notes.ts), so an error in one no longer stops the pages.
  - Every frame error goes on the debug page with where it was thrown.
  - The menu's wait on a map load frees itself after 15 s.
  - If it happens again, the debug page's notes name the cause.
- **White shapes with the hands out of view:** a lost hand now draws nothing it carries: IWSDK's hand and controller models and everything on its ray, grip and index tip spaces (`hideLostHandModels`). On the dev server, when both hands are gone a note names anything still drawn near the eyes.
- **Fight flicker:** every goblin's and soldier's animation actions are made when the unit is built (a pooled unit made each on its first use, many at once in a fight).
- **Lose panel:** 34 cm tall, each line on its own band (`END_PANEL.lostSubtitleFromTop`, `lostStatsFromTop`, `lostNoteFromTop`).
- **Home after a battle:** the home screen, or the Custom Game list after a Custom Game level (it looked at "a level file was played", true for the campaign now too).
- **Sky Pirates:** 9 balloons a wave (4 in wave 1) and 6 to 10 ground goblins; the Balloons setting goes to 10; wave 1 gets half the balloons. Only level2.json changed when the levels were made again.

### Eighth round (2026-11-17)

- **Pause, Home in Endless (and the campaign):** it went to the Custom Game list; it uses the end panel's rule now (`menuAfterBattle`).
- **Card taps still flickered:** compiling makes shaders but never sends shapes; a hidden mesh's geometry went to the GPU the first time it was drawn (a card's reward tool, pooled units, effects). At setup the whole scene, hidden things too, is drawn once into a 1x1 target (`drawEverythingOnce` in `warmGpu`, outside VR only).
- **Magnet aim assist** (`MAGNET.assist`): it snaps onto a standing bell tower within 22 cm and moves halfway toward a goblin with gear within 14 cm.
- **Not found yet:** rewards on the campaign card (magnet, drum, sugar) and the shelf tools could not be grabbed. Nothing in the code read as the cause; the shelves now run on their own (`guarded`), so if they throw, the debug page's notes say where. (Found in the ninth round.)

### Ninth round (2026-11-17, found with the headset's debug notes)

Found by reading the dev server's debug page from the laptop (`/__debug/stats`) while the developer played, not by guessing.

- **Shelves and trophies could not be grabbed on the campaign page** [FIXED, seen working on the headset]. The card's reward tool has an unlit part with no emissive color. The Ready glow (`applyTouchState`) threw on it every frame, before the shelves stored the new card, so the shelf update stopped there each frame. Now only lit materials go in the card's glow list, and `applyTouchState` skips a material without an emissive color.
- **Shelf drop** [seen working]: the freeze while the fingers open plus the sticky slot target (seventh round) work; the headset log shows tools dropped onto stand slots.
- **Card tap flicker** [mostly fixed: 12 dropped frames after taps in 52 s went to 2 in 29 s]:
  - The list never redraws on a tap: a gold band (`ScrollList.setSelected`, `SCROLL_LIST.selectColor`) moves over the selected row; every row is drawn the same.
  - Each level's card keeps its own image (`Panel.paintVariant`), drawn again only when its stars or lock change. All 15 are drawn when the menu opens, behind the fade (`CampaignPanel.prepareCards`, about 130 MB of GPU memory). The headset log showed taps on locked levels drawing and uploading their card on the tap.
  - A panel drawn ahead goes to the GPU at once (`setTextureUploader` in src/ui/panel.ts, set to `renderer.initTexture` in src/game.ts), not on the frame it first shows.
  - The Fight button draws its Fight! and Locked faces once and swaps them (it redrew on every lock change).
  - A tool swap on the home screen only changes Fight's lock (`refreshFight`), never redraws the card.
- **Debug tools added** (dev server):
  - Menu and pause frames are never measured, so each dropped one is now noted with what ran before it ("[slow frame]", src/debug/fpsCounter.ts). New marks: `card tap`, `texture upload`.
  - Shelf grabs and let-gos are noted. The debug page keeps 12 notes (was 4: one repeating error hid everything).
  - Performance section: **Render stats** (the last frame's draw calls and triangles, shader and texture counts, the 8 heaviest visible parts of the scene) and **Hide part 1 to 8** (hides that part and starts a new measured run, to see what it costs).
- **The real cause of the leftover flicker (open, next):** the whole game misses its frame rate. Headset runs on 2026-11-17: the home screen with no units 57 to 59 fps, Sky Pirates 53.5 fps with 9.5% of frames dropped, against a target of 72. Most dropped frames have nothing marked, so every frame is too heavy to draw, and any extra work (a spark burst, a balloon pop, a sound, a tap) tips it over. That is why the flicker moves around: gear sparks (`JUICE.gearSparks` is still off as a test) and the balloon pop share the same particle burst, which is cheap and pooled. Next: in a battle in VR, press Render stats, then Hide part one at a time, find what costs the most and simplify it. Then turn the gear sparks back on and check.

## Bug fixes from a friend's playtest (2026-11-17)

Type check and build pass. Not tested on the headset.

- **Flicker in battles** (slingshot, swatter, knight fights): goblins and soldiers were built mid-battle as the pools grew, and hidden effects compiled their shaders the first time they showed. Each dropped a frame, and on the Quest a dropped frame shows as the sky and UI flickering. Now every goblin (up to the cap) and soldier is built hidden at setup (`Goblins.prebuild`, `Troops.prebuild`), and `warmGpu` in `src/game.ts` compiles every shader and uploads every texture at setup and after each map load.
- **Endless start froze 1 to 2 s:** making and building a map blocks the page. The view now fades dark first (`src/ui/viewFade.ts`, `VIEW_FADE`), the map is made, built and warmed in the dark, then it fades back in. Every map load does this.
- **Shields 2.2 times bigger** (`goblinShield`, `roundShield`, `rectShield` scales), so a swat that bounces off a shield reads.
- **The magnifying glass did nothing:** its aim starts at the head, right over the hole the giant sits in, and the ground march stopped there on its first step. `marchToGround` now passes over the hole.
- **The horn takes a spoken word, not a blow:** say "Charge!" at a normal level (`HORN.speakLevel` 0.03 held for `speakTime` 0.15 s, draining in quiet), with low rumble filtered out of the mic. One loud frame over 0.015 was enough before, so small noises sent knights to the wrong road. Texts say "Charge!".
- **Compass:** 2 cm higher (`COMPASS.y` 6.5) and the whole dial 10% smaller. The crank lets go when the pinch opens (pinch only; a closed fist kept it held) and when the pinch rises 7 cm above the knob (`CRANK.releaseHold`, `liftRelease`).
- **Moving knights:** while the horn rests, aiming at a road moves the nearest squad there for free (before, a move only happened at the squad cap). The horn stays bright while it rests if a squad is out, so it reads as something to pick up.

- **Second round (2026-11-17):**
  - **Wide Swatter** grew only the hit area. The swatter's head now grows to match with an elastic pop and sparkles (`SWATTER.growTime`, the blade on its own pivot in `flySwatter()`).
  - **Boost cards:** the tick buttons sat over the names and text. The panel is 31 cm tall and the buttons sit under the text (`ENDLESS.panel.buttonFromTop`).
  - **Glass and magnet grip:** their handles were shorter than the slingshot's, so the head sat in the fingers. Both are 7 cm now, held at the middle like the slingshot (`HOLD.poses` `at` 3.5).
  - **White hands in front of the eyes:** IWSDK turns the hand model back on every frame while its input source is connected, and rebuilds it in its rest pose when the hand comes back, so hiding it was undone. A lost hand's model is now scaled to nothing (`hideLostHandModels`), which IWSDK never resets.

- **Third round (2026-11-17):**
  - **Crank:** the knob armed only while the whole hand was open, so a pinch with the other fingers curled did nothing. It now arms whenever the pinch is open.
  - **Tutorial:** pinch and eat come right after the compass; the red flag comes after the first meal ("Eating goblins raises it again").
  - **Horn went off by itself:** the mic heard the game's own sounds. Echo cancellation is on, `speakLevel` 0.04, `speakTime` 0.25, and the silent-mic fallback waits 4 s.
  - **Flicker in fights:** each unit's bone texture is now made and uploaded at the warm-up too. Flipping "Unlock all tools" compiled the tools' other material mid-frame; the shelf warm-up compiles both now.
  - **All tools unlocked by default** (`unlockAll` true; an old save's "off" is ignored, `unlockV`).
  - **Goblins about 15% slower**, walk clips slowed to match.
  - **Rampart:** goblins walk (they kept a "hunting" flag after a fight and slid along idle); a cornered garrison archer stops walking on the spot.
  - **Drum:** grabbing the stick sinks the small drum and the compass, a big drum (`DRUM.bigScale`) rises on the compass's spot; one strike, the stick shrinks out of the hand and everything goes back.
  - **Sugar:** a cube thrown by hand lands as a lure (it vanished over the hole the giant sits in). New faceted bowl.
  - **Night sky:** the planet's rings blend band to band; the moon's glow is halved (`SKY.moonGlowStrength`).
  - **Sunflower:** a new turret model whose head tracks its target; 4 times the fire rate, a quarter the damage per seed (`GARDEN.fireEvery` 0.5, `seedsToKnock` 8, `seedsPerArmor` 4); seeds pooled.
  - **Glass:** the default 35 degree grip slant; a ring that fills while the beam works (grow, heal, light, burn); a beam with running bands, a glow and a hot spot (`src/fx/glassFx.ts`); a small aim assist to goblins (`GLASS.goblinAssistDeg`).
  - **Torches:** a layered low-poly flame. **Bell tower:** Kenney base, windowed middle, arched belfry and high roof, a turned bell.
  - **Magnet:** stripped gear hops off, then flies to the tips, speeding up, and is crushed there with a clank (`MAGNET.gear*`).

- **Fourth round (2026-11-17):**
  - **Drum:** the stick grows by `DRUM.bigScale` in the hand, and the drum's platform sinks with it.
  - **Rampart:** a hunting goblin asks for its walk on every step (a strike swapped the clip and it slid on); a garrison archer backs away until the goblin is `GARRISON.backAwayEnd` away and never walks home toward a near goblin (it flip-flopped at `backAway`).
  - **Endless:** no timer on the cards (`ENDLESS.pickTime` Infinity): the next wave waits for the pick.
  - **Rope bridge:** a ravine is cut into the terrain under each bridge (`Terrain` cuts, `TRIGGERS.bridge.gap*`) with faceted water in it; the road crosses on the deck (`Road.addSpan`: units walk over it, no ribbon is drawn over the gap); a code-built bridge (planks, beams, posts, rope rails, stone footings). A bridge always stands as land; only its trap side waits for its wave.
  - **Sugar:** lured goblins walk off the road to the cube, eat, walk back and carry on (`Goblins.lureTo`); goblins on the rampart go to a cube on the wall top.
  - **Magnet:** rings of force flow into the tips while it is held (`MAGNET.wave*`).

- **Fifth round (2026-11-17):** torch flames 2.3 times bigger; the planet's rings one straight two-color gradient; the moon's glow at a quarter; the drum stays 2 s after a strike (`DRUM.stayTime`); the fantasy village ambience on the home screen, end panels and pause (`MUSIC.menu`), the music in battle only; a recharged tool chimes, pings, sparkles and pulses (`toolReady`, `TOOLS.readyFlashTime`); the crank eases the board toward the hand (`CRANK.smoothing`); the glass 30% bigger; the eating gulp plays once and fades over 2.5 s (`fadeSeconds`); seeds and sunflowers built with their beds (no meshes mid-battle); the mushroom puffs when goblins come near (`GARDEN.puffCheck`), a lone goblin is dazed too.

- **Sixth round (2026-11-17):**
  - **Win panel:** farther (`END_PANEL.radius` 50, was 41) and 4 cm taller, so the buttons' words no longer sit on the note line.
  - **Lost hands:** a lost hand's meshes go to a camera layer never drawn (`HANDS.hiddenLayer`); a hand shows only after `HANDS.showAfter` s of steady tracking.
  - **Ambience:** an AAC copy (1.3 MB, was a 20 MB wav).
  - **Flicker audit:**
    - The warm-up compiled the plain shaders, but in VR three draws with stereo (multiview) ones. It now compiles against the XR target, and runs again once VR has started.
    - The horn's ghost knights and icons are made at setup.
    - The compass number redraws at most every 0.4 s.
    - Mushrooms are built with their beds.
    - The "+1" label no longer forces a shader lookup.
    - `note()` is cheap.
  - **The lower-risk ones, also fixed:**
    - Panels keep a canvas, texture and board per size (`Panel.prepareSize`): the end, card and pause panels prepare theirs at setup.
    - Button icons are one shared texture each (`prepareIcons`).
    - Trophy toasts are drawn at setup; trophies save and the shelf redraws at the battle's end or on the menu (`Achievements.flush`).
    - Every Custom Game tab's rows are cut and layered at build time and kept on the page while hidden; the page title keeps each title's plate.
    - A campaign list tap redraws only the two rows that changed (`ScrollList.redrawRows`).
    - Hand pebbles and the flying keg are pooled.
  - **`preparedTextures`** (src/ui/panel.ts): textures made ahead are sent to the GPU by `warmGpu`.

**Headset check:** a busy fight with slingshot, swatter and knights: no sky or UI flicker (FPS panel missed frames). Start Endless: a calm fade, no freeze. Shields read from the seat. Hold the glass and look at the board: the pillar and ring show. Say "Charge!" with the horn raised (tune `speakLevel` on the mic panel); tapping the headset or a cough does not send knights. The compass height and size; open the pinch or lift the hand off the knob and the board stops. Call a squad, then grab the resting horn and look at another road: "Move".

## To do later (the developer, 2026-11-16)

- [ ] **A chicken model** for the potion cart (2.1): find a CC0 low poly chicken (Kenney or Quaternius) and replace the placeholder shape (docs/placeholder-shapes.md, "Chicken").
- [ ] **Many sounds are still missing or stand-ins.** Find real files for all of them and list each in `public/audio/README.md`:
  - **Using the chime (no sound yet):** the magnet hum (`magnetHum`), the glass hum and sizzle (`glassHum`, `glassSizzle`), the pepper ring running out (`pepperRingGone`, a sizzle), the keg blast (`kegBoom`), the crowd cheer (`cheer`), the trigger cue (`triggerNow`), and the old list in `public/audio/README.md` ("Still missing": goblin chatter, burp, lose trombone, wind and birds, night crickets, torch crackle).
  - **Kenney stand-ins to replace:** the drum boom and cymbal crash (`drumBoom`, `drumCrash`), the horn hints (`hornHintCall`, `hornHintBoost`, `hornHintMove`: a rising two-note horn, a drum roll tap, a light whistle), the magnet clank, the sugar cube landing, the plant pop, the sunflower seed spit, the mushroom puff, the pepper ring filling (a ding).
  - **The 2.1 traps:** the hay burning, the bridge rope snapping and creaking, the bell tower's "BONG" (the old hand bell file for now), the potion fizz, chicken clucks.
  - **The Phase 3 goblins:** the shaman's cast (`shamanCast`, the chime), the bomber's fuse hiss (`bomberFuse`, a knife draw), the digger breaking out and digging (`diggerSurface`, `diggerDig`, Kenney mining impacts), the goblin bow (`goblinBowShot`, a pluck). The bomber's blast shares `kegBoom` (the chime).
- [ ] **The shaman's lantern glows at night** (Phase 3): today it only has the goblins' night rim. A moving glow would go in `src/world/nightLights.ts`.

## Open

- Final tempo numbers (headset).
- Knight strength so a held squad beats one group (1.6), and the horn's numbers (recharge, squad cap, boost, move lockout, 2.5).
- The magnifying glass, magnet, pepper, drum and trap respawn start numbers (2.2, 2.8).
- The Phase 3 goblins' start numbers (`DIGGER`, `SHAMAN`, `BOMBER`, `GOBLIN_ARCHERS`): the digger's speed and mound time, the shaman's stop and cast time, the bomber's fuse and wall damage, the archers' stop and hit chance; and how the props sit on each goblin.
- The snap step (30 degrees to start, 1.7).
- Which tutorial steps go (1.9).
- The score values and the star thresholds (`SCORE`, Phase 4; tune on the headset). Chains are on hold.
- Which campaign level introduces each new enemy and tool.
