# v3 Plan: Faster, Clearer, Deeper

Status: decided with the developer (2026-11-12 to 2026-11-13). **Phase 1 is built** (2026-11-13, branch `feat/v3-upgrades`, build passes, not committed; tested on the headset 2026-11-16; see "Phase 1 as built" below). **Phase 2's 2.0 and 2.5 are done, 2.8 is built** (2026-11-16; "2.0 as built", "2.5 as built", "2.8 as built"; 2.3 was dropped). Finished sections are marked [DONE] in their headings. The rest of Phase 2 and Phases 3 to 5 are not built. **Next (2026-11-16): the headset test of 2.8, then 2.2 (new tools), then 2.1, 2.7 and 2.6, in the order they appear below.** Every step: only `npm run build` with no errors as the check (no typecheck, no tests), update its "as built" section and its [DONE] mark, stop with a "Headset check:" list, never commit unless asked. **Phase 2 and 3 redesigned 2026-11-14 to 15:** the magnet (new tool), the drum (replaces the bell), pepper's ground ring, eating heals and the horn on a timer (2.5), 4 free loadout slots, the digger, secret achievements, a score with star ranges (Phase 4), the magnifying glass as a sun garden (sunflower and mushroom) that also burns goblins without helmets, the haystack, the horn's call, boost and free move with a preview of each, traps coming back at random spots during waves, waves as breathers in one battle (2.8), an upside and downside for every tool, and night fog; the seesaw and the brute are out. **Phase 1** (small changes to what exists) comes first. Then **Phase 2** (new environment objects and tools, each working on its own), **Phase 3** (new enemies), **Phase 4** (chains and score, not final) and **Phase 5** (the modes, on hold). The developer decides when to test on the headset.

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
- **What beats a held squad:** two groups at once, armored groups, and in Phase 3 bombers, archers and the brute. The player still has to look back now and then, and thin a big group with the slingshot before it reaches the squad.
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
- Rope bridges (stay in place), the bell tower (once per battle) and the rare potion cart come with 2.1.

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
| **Keg** (today) | a pebble, a blast | blast: knocks out an area | rebuilt |
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

### 2.7 Night fog (decided 2026-11-15, to be built and tested before it is final)

- **A level setting** ("Foggy night", in Custom Game and some campaign levels), only in night waves. Not every night: the last wave is always night, and fog every time would make every level end blind and punish ranged loadouts.
- **Timing:** the fog rolls in during the breather before the night wave (seen coming) and lifts after. Never mid-wave.
- **How far the player sees:** clear up to about the middle ring (about 150 cm), fading to nothing by about 250 cm; the camps are hidden. At grunt speed a goblin appears about 12 s before the wall.
- **What still works:** the compass (it becomes the player's eyes: where, not how many), the camp drums by sound, and the night rim, so goblins step out of the fog outlined.
- **Not fogged:** the player's tools, the compass, the flags, anything near the player.
- **Balance:** foggy waves send their pushes a little more spread out, so the short warning does not snowball. The slingshot and the magnet still work inside the clear range.
- **No lantern or other fog-clearing plant** (it would copy Plants vs Zombies, and a clear hole in the fog needs a shader change on every material). One even fog, changed between waves: cheap.
- Built as a fog field in the night look (`DAY_NIGHT.looks`, blended in `src/world/dayNight.ts`), used only when the level asks for fog.

### 2.6 Secret achievements (decided 2026-11-15, reworked 2026-11-16)

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

---

## Phase 3: new enemies

The rule: a new enemy changes **what** the player does or **when**, never just the hit count. Models come from the packs (see "Finding assets").

**The roster is complete** (decided 2026-11-16): no goblin types beyond the ones below.
- **Built today:** grunts and runners, gear (helmet, shield, spear, sword) and balloon riders.
- **Planned here:** digger, shaman, bomber and archers. The brute is on hold. **The catapult crew is on hold indefinitely** (2026-11-16): too much logic and testing; it comes back only if time is left after everything else is built and tested.
- **Why no more:** five new types is already a lot to build, test and balance, and each needs two or more answers among the tools. Variety now comes from the board (chickens, the bell, the garden, bridges, fog, night) and from the gear mix (a helmeted runner and a bare grunt play differently without being new types).
- **Each new type has a reason:** the digger is the pepper ring's job and a surprise from underground; the shaman gives gear back, so it pushes back against the magnet; the bomber is a middle zone threat; archers and the catapult crew press from far, answered by the slingshot and the magnifying glass.
- **Build order:** 1. digger, 2. shaman, 3. bomber, 4. archers (catapult crew on hold). The first two pair with tools added in Phase 2 (pepper and magnet), so they make those tools matter right away.
- **Known gap, on purpose:** no goblin reacts to the player's traps or plants (goblins never attack plants), which keeps the AI simple. If play shows the player is never challenged on their setups, a goblin that puts out fires or rebuilds a bridge could fill it. Decide after playing.

**Zones:** far (shaman, archers; catapult on hold), middle (bomber), near (the climbers, as today), underground (the digger). Every tool gets a job.

**Digger** (the wildcard, decided 2026-11-14)
- Tunnels underground from its camp straight to the castle. **Unseen while underground:** no marker on the board and no compass wedge, so there is no early warning.
- **Pops up inside the courtyard,** often on the side the player is not facing, sometimes several at once. **Once up, it is simply a regular intruder goblin** (the usual intruder damage, no new rules), and intruders already hurt more than goblins outside, so diggers chip the castle fast.
- **Sneaks past everything:** the garrison, the knights and the far tools never meet it. The garrison does not fight it in the courtyard either: that is the giant's to clean up.
- **Easy to finish:** one grab and it is eaten. The danger is the surprise, not its toughness.
- **Untouchable underground:** the drum does not stun it there. Only the pepper ring stops it.
- **The answer is the pepper ring** (2.2, Pepper): a digger that tunnels into a peppered segment uses it all up, stops outside the wall, comes up sneezing and seasoned (heals double when eaten), and walks and climbs like a regular goblin.
- **Where and how many:** decided later by the developer.
- **Without pepper** it still loses to a grab, so no loadout leaves the player stuck ("best answer, never the only answer").
- **The magnet does nothing to it:** diggers carry no gear.
- **Visible when it surfaces** (AGENTS.md: every attack visible without sound): a dirt burst where it comes up, the threat cue flash, and its compass wedge turns red at once.
- **A dirt mound only for the last 2 to 3 seconds:** hidden for most of the trip, then a small crack of dirt races toward the wall. A player facing that side sees it coming and can react; a player facing away is still surprised. It is the only warning (no rumble). It also shows the pepper working: the mound hits the ring, stops, and the goblin pops up sneezing.

**Shaman**
- Stays at the back of its group and gives knocked-out goblins their helmets back, or wakes them up.
- Question: find me behind the crowd. Answers: slingshot, the knights.

**Bomber**
- Carries a keg on its back toward the wall. At the wall it explodes: big damage.
- Hit it on the road and it explodes among its own group (and sets off kegs near it).
- Question: hit me before I arrive. Answers: slingshot, the knights.
- Reuses the goblin and the keg model.

**Goblin archers** (after the shaman)
- Stop at middle range in a tight group and shoot volleys at **the garrison** (not the castle, not the giant's hands).
- Question: break up the group before your wall is empty. They are the only goblins that stand still, so they are the best target for a keg, a tree or the slingshot.
- Fits a level about the garrison (level 8, Thin Walls).
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

## Phase 4: chains and score (direction only, not final)

Decided later, once the Phase 2 objects work on their own. What is agreed so far:

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

---

## Phase 5: the modes (on hold)

On hold until the new tools and enemies exist, since how difficulty rises and which challenges exist depend on them.

- **Campaign:** the 15 levels ([custom-mode.md](custom-mode.md) section 10, redone 2026-11-16: 1 to 5 playable, 6 to 15 locked teasers). Each new enemy or tool is introduced by a level, one at a time. The most visual ones go in levels 1 to 5 (open from the start), because judges play only 10 to 15 minutes.
- **Daily Challenge:** a short battle (2 or 3 waves), the same for everyone that day (seed from the date). Before it starts, **3 challenge cards**, each with an upside and a downside; the player picks one (like the modifiers in Dead Cells). An upside and its downside touch different things, so the choice is real (for example "eating heals the castle, but no garrison", not "a wider swatter, but a slower recharge"). Streak and kingdom gift later. No backend.
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

**Open:**
- A difficulty choice (easy, normal, hard), or one fixed ramp so high scores compare fairly.
- A fresh random map every run, or one fixed map so runs compare fairly.
- Frame rate late in a run (100 goblins, more traps, beds and plants, night): measure on the headset.

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
- **A faster slingshot loop** (bigger pouch snap, shorter pull): loading feels fine; only the aim assist changes (1.8).
- **Brute phases that each need certain tools:** a missing tool could make the wave unwinnable. Replaced by armor plates with many answers (Phase 3).

**Maybe later** (good, not planned): the trench coat goblin (three goblins in a coat, scatter when hit, count as 3 when eaten whole), the chieftain (knock out its banner carrier and nearby goblins run back), the thief (steals a tool from a platform), the torch bearer (sets your traps on fire, or sets them off among its friends), engineers building a siege tower (a timer you can see), bees from a beehive, the boomerang. **Interactions with the camps** (2026-11-16): worth exploring properly later, but never anything that needs hitting a camp precisely from the seat (camps are too far away).

---

## Open

- Final tempo numbers (headset).
- Knight strength so a held squad beats one group (1.6), and the horn's numbers (recharge, squad cap, boost, move lockout, 2.5).
- The magnifying glass, magnet, pepper, drum and trap respawn start numbers (2.2, 2.8).
- The snap step (30 degrees to start, 1.7).
- Which tutorial steps go (1.9).
- The chain rules, the score values and the star thresholds (Phase 4).
- Which campaign level introduces each new enemy and tool.
