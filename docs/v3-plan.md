# v3 Plan: Faster, Clearer, Deeper

Status: decided with the developer (2026-11-12 to 2026-11-13). **Phase 1 is built** (2026-11-13, branch `feat/v3-upgrades`, build passes, not committed, not tested on the headset yet; see "Phase 1 as built" below). Phases 2 to 5 are not built. **Phase 1** (small changes to what exists) comes first. Then **Phase 2** (new environment objects and tools, each working on its own), **Phase 3** (new enemies), **Phase 4** (chains and score, not final) and **Phase 5** (the modes, on hold). The developer decides when to test on the headset.

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

## Phase 1: small changes to existing content

All of it changes systems that exist. Mostly config and rules, a few small code changes, and one new control (the compass crank). Tune on the headset in 2 or 3 short rounds, and have someone else play one round.

### 1.1 Tempo

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

- **The board stays big.** Camps stay far out; goblins cross the distance faster. The far zone gets things to do in Phases 2 and 3 (hay, bridges, the glass, bombers, catapults), so travel time becomes time to act.
- **Shorter battles:** a campaign level should take about 3 to 4 minutes.

### 1.2 Clarity (so fast never turns into chaos)

- **Groups, not drips.** Goblins leave a camp in tight groups of 4 to 5 that walk together (`WAVES.gruntGroup` 3, `runnerGroup` 4 today). At most one group on its way per direction at a time. A group reads as one threat, gives the swatter a target and, later, gives chains a crowd. A group is never bigger than a knight squad can beat (1.6).
- **A rhythm in every wave:** 3 to 4 pushes, with 5 to 8 s of calm between them (the spawn curve, `WAVES.curve`, already shapes this). Fast is not constant.
- **A warning before every push:** the drum from the camp's direction and its compass wedge lighting up about 3 s before the group leaves (`WAVES.rumbleLead` is 3 today: check the compass shows it too). The player is never surprised, only rushed.
- **Calmer rampart goblins:** no more dashing about (`rampartDashDeg`, `rampartRunShare`). They stand and fight the garrison, so they are easy to read and to grab.

### 1.3 The compass: readable at a glance

**What it has today:** wedges on the rim that point where goblins come from (color: how close, size: how many; no marker per goblin), camp tents on its lip, and the goblins left with wave dots in the middle. **The problems:** the camp markers are grey diamonds on a dark dish (far too little contrast), and a group still walking and a group bashing the wall look alike.

**What changes:**

- **The direction wedges stay** (direction only, no single goblins). Their **color now shows the state, not the distance:**
  - **Walking in:** bright yellow (high contrast on the dark dish), steady.
  - **Attacking the wall** (bashing, climbing, on the rampart): **full red**, and **pulsing**.
  - Size still shows how many.
- **Camps:** a light cream marker with a dark outline (or the Kenney tent icon), never grey. Amber while its drum plays, as today.
- **Catapults** (Phase 3): an icon of their own shape (a Kenney catapult or target icon) in purple, at their direction, with a flash on each shot.
- **The brute** (Phase 3): a **skull icon** at his direction. The only enemy with an icon of its own.
- **Nothing else.** No knight markers: the knights are easy to see on the board, and the compass is for what the player cannot see. Fewer things keep it readable at a glance.

**Teaching it:** the tutorial's compass step teaches only yellow (coming) and red (attacking), in one line. The catapult icon and the skull are explained by the campaign level that brings each one first (a glass sign: "A catapult! Purple on your compass").

**Never color alone** (accessibility, red and yellow are hard for some color blind players): red also pulses; catapults and the brute have their own shapes. Name this in the Devpost write-up (accessibility: the compass works for color blind players). Check the contrast of every marker against the dish (aim for 4.5 to 1 or more) and in the night look.

Code: the compass (`COMPASS` in config, its system in `src/ui/`); the art comes from `public/ui/` or the Kenney packs (no hand-made art, AGENTS.md).

### 1.4 The swatter vs armor and balloons

The swatter is for crowds of bare goblins. It no longer answers everything.

- **A helmet or a shield stops the swatter.** The swat bounces off: the goblin is knocked back a little and dazed for a moment, **its gear stays on**, and it is not knocked out. A clear "clonk" sound and a spark on the gear, so the player learns it at once.
- **Balloons are pushed away, not popped.** A swatted balloon drifts away from the castle for a moment (buys time), then comes back. Popping balloons stays the slingshot's job.
- **Armor now needs:** the **pepper** (strips weapon, helmet and shield), **triggers** (ignore armor), **slingshot hits** (each hit breaks one piece, as today), or **eating** (works on anything in reach).
- **Three swings per charge** instead of a 10 s window (`TOOLS.use.swatter`). A swing counts when it hits something or passes a speed threshold, so waving it around still uses a swing. The ring on the platform shows 3 pips that empty, one per swing.
- Code: `src/rules/gear.ts` (who a hit breaks gear for), the swatter's hit code, `src/rules/recharge.ts` (a use counted in swings, not seconds).
- [enemies.md](enemies.md) and [giant-tools.md](giant-tools.md) change to match.

### 1.5 Eating charges the horn

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

### 1.6 Knights: strong squads that hold a side

The horn call now costs 5 meals, so each squad must be worth it. The developer's strategy idea: **station a squad to cover one side (for example your back) while you handle the front.** This fits the 360 battlefield and gives the knights a clear job.

- **A squad must beat a goblin group on its own.** Today a squad has 3 to 5 knights (`KNIGHTS.squadMin`, `squadMax`); with groups of 4 to 5 goblins, an even fight would lose. Fix by strength, not only numbers:
  - Squads of **5 to 6** knights (fixed, not random, so the player can plan).
  - **One knight beats about 2 bare goblins** (more hit points or faster strikes than a goblin; armor and swords still matter).
  - Goblin groups stay at **4 to 5** (1.2).
- **A squad holds its spot until it breaks.** It already holds the first junction of the aimed road (`KNIGHTS` leash). It stays there for the whole wave (and across the breather) until it is down to `breakAt`, so a call is an investment, not a one-off charge.
- **What beats a held squad:** two groups at once, armored groups, and in Phase 3 bombers, archers and the brute. The player still has to look back now and then, and thin a big group with the slingshot before it reaches the squad.
- **The decisions:** **where** (the road behind you, the one with 2 camps, the one an armored group is on) and **when** (a call costs 5 meals). At the squad limit, the horn moves the squad nearest the aimed road there (as today), so a squad can be re-posted.
- **Knights and traps:** goblins fighting a squad stand still in a clump, so a keg, hay or a tree next to a held junction becomes a planned combo (Phase 2 objects).
- `KNIGHTS.maxSquads` stays 4.

### 1.7 The compass crank (turning the board fast)

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

### 1.10 The reach check always runs once

- The reach check ("Show me how big you are, giant!") sizes the whole board. Today it is part of the tutorial, so a player who skips the tutorial on the first visit never does it.
- **Now:** on the first visit, the reach check runs **before the home screen**, whether the tutorial is played or skipped.
- **The measured reach is saved** (with the progress in the browser), so it runs only once. Later visits use the saved one.
- **"Measure again"** in the settings' Access tab runs it again (for another player on the same headset, or a different chair).

### 1.8 Slingshot aim assist

The loading speed is fine as it is (developer's playtests). Only the aim assist gets a little stronger, toward goblins, balloons and triggers in the shot's direction (slingshot config; [giant-tools.md](giant-tools.md) changes to match).

### 1.9 A shorter tutorial

- Target: about 5 to 6 minutes (about 8 today), so a judge reaches a campaign level.
- Fewer info steps and quicker lessons with the new tempo; nothing new is added. The new swatter rule is learned by doing (the "clonk" on a helmet in the swatter wave), the horn refill by eating (1.5), the crank in one step (1.7).
- Which steps go: decided on the headset with the new tempo, written in [mvp.md](mvp.md).

### Phase 1 as built (2026-11-13)

Build passes; `npm test` has the same 14 old failures in `director.test.ts` as before (stale tests, none new). Not tested on the headset. Where the build differs from or fills in the plan:

- **1.1:** all start values as in the table. Horn: `TOOLS.recharge.horn` is 0 (no time recharge), `TOOLS.hornMeals` 5.
- **1.2:** grunt groups 5, runner groups 4, a leftover under 3 joins the last group, 0.45 s between goblins of a group. 3 to 4 pushes 5 to 8 s apart, a push's groups within 3 s and from different camps where possible. "One group per direction" is per camp: a camp waits until its last group is at the wall or gone, at most 12 s (`WAVES.holdMax`, a safety so a wave never stalls). Rampart goblins stand still; hunting a garrison soldier they walk (`rampartRunShare` 1).
- **1.3:** colors amber (sending), yellow (walking), red pulsing (attacking); camps cream with a dark outline (a slightly bigger dark back-face copy, no new art). The compass moved to 30 cm out, 10 up (was 37, 7) so the crank sits in the reach band's best (about 50 cm from the eyes); check it still reads and does not hide the front wall.
- **1.4:** a swing starts at 150 cm/s head speed or a swat and ends after 0.18 s under 60 cm/s. Armor clonk sound: Kenney `impactTin_medium_000` and `rpg/metalPot1` (`swatClonk`). Balloons drift out at 30 cm/s for 1.6 s.
- **1.5:** wave 1 default 22 goblins, 20% more per wave, `LEVEL_GEN.unitBudget` and `GOBLIN_RULES.maxGoblins` 100. Debug note per wave: sent, reached the wall, eaten, horn calls.
- **1.6:** squads a fixed 5; knights take 4 goblin blows (guards keep 2) and land 55% of strikes (was 35%). Squads already held their spot across waves until `breakAt`.
- **1.7:** the whole wheel is grabbable, not only the knob (more reliable with hand tracking; the knob shows the turn). The crank click uses the Kenney interface clicks. The ring handle code (`src/player/handles.ts`) is left in the repo, unused.
- **1.8:** cone 12 degrees (was 10), bend 55 degrees a second (was 45).
- **1.9:** the spin and height lessons became one crank lesson; the two compass signs became one; tutorial waves resized for the new tempo. Further cuts wait for the headset.
- **1.10:** Skip tutorial on a first visit runs the reach check first, then the home screen. "Measure it again" was already in the Access tab.

**What to look for when testing Phase 1:** time from a wave's start to the first goblin in reach (target about 10 to 15 s); a level's length (3 to 4 minutes); the swatter clonk on armor reads at once; horn calls per wave (about 2); a held squad beats a goblin group; the compass wedges (yellow, red) and camps read at a glance, by day and night; the crank turns the board around in one circle without discomfort, smooth and snapped; the height rail in pause; the reach check after skipping the tutorial; the FPS panel with the bigger waves ([performance.md](performance.md)).

---

## Finding assets (every phase)

New objects, enemies and icons need models and icons. **Never make art by hand in code** (AGENTS.md). Before anything else:

1. Look in `public/` (`public/ui/README.md`, `public/gltf/`, docs/assets.md).
2. **Search the developer's Downloads folder** (`~/Downloads`): the `kenney_*` folders, `Kenny Models` (Nature Kit, castle kit, fantasy town kit, mini arena, mini dungeon, mini forest, survival kit, a goblin camp pack) and any other pack there.
3. **Search properly, not only by file name, and cheaply:** list file and folder names first, then search the text inside the models (node, mesh and material names in `.gltf` and `.obj` files, with grep) and each pack's overview or license file. A model may be named for what it is in the pack, not for what we want (a "trebuchet" works as a catapult, "log" as a seesaw beam). **Do not open preview pictures** (each costs many tokens); at most one or two, only when the names leave a real doubt.
4. Copy what fits into `public/` with its license, list it in docs/assets.md (or `public/ui/README.md` for icons).
5. Only if nothing fits: suggest a pack to download. Code shapes are the last resort, and say so.

Known finds: `kenney_castle-kit` has `siege-catapult` and `siege-catapult-demolished` (plus trebuchet, ballista, ram and siege tower, each with a demolished version), and `tree-log` for the seesaw.

---

## Phase 2: environment objects and tools

Each new object and tool **works on its own** and is useful alone. How they set each other off (chains) comes in Phase 4. So every object gets its inputs and outputs written down now (in the trigger registry), but nothing passes them on yet.

### 2.1 Environment objects

- **Each one useful alone, with its own result**, not three ways to block a road.
- **Nothing hardcoded:** each object is one entry in the trigger registry (`src/config/registries.ts`): its model, what sets it off, what it does, its range, its animation and its reset. The generator places them on the roads (a setting each in Custom Game, like the kegs today).
- **Cheap:** no physics. Each object is a small state machine (idle, set off, spent, rebuilding) with a tween, like the camps rising.
- **They come back:** villagers rebuild used objects in the breather; a used object is rebuilt during a wave after about 30 s, seen happening (a tiny villager rolls out a new keg).

| Object | Set off by | Does | Reset |
|---|---|---|---|
| **Haystack** (new) | fire (the glass, a torch at night) | burns for a few seconds: goblins walking through are knocked out, others stop and wait | rebuilt |
| **Rope bridge** (new) | a pebble on its rope, fire | collapses: goblins on it fall and are knocked out; the road becomes the long way round until it is rebuilt | rebuilt between waves |
| **Seesaw log** (new) | a heavy hit on its raised end (a loaded goblin shot, a boulder) | throws the goblins on the other end over the wall, dazed: food | resets itself |
| **Keg** (today) | fire, a blast (with the glass: fire only, 2.2) | blast: knocks out an area | rebuilt |
| **Boulder** (today) | a pebble | rolls down the road: knocks out a line | rebuilt |
| **Tree** (today) | a pebble, a blast | falls across the road: knocks out what it lands on, blocks for a while | springs back |

- **Bridge and ground under it:** a bridge crosses a dip where the road meets a stream or a valley. **No real water:** a fixed flat strip with a blue gradient (one cheap material), or just an empty dip. From the seat it is far away, so it only has to read as "a gap".
- **The bridge's choice:** drop it early and goblins take the long way (the roads as gameplay); drop it late, while goblins cross, and they all fall. One object, two uses.
- **Day and night:** at night the road torches (they exist) are fire sources: a pebble knocks one over into nearby hay.

### 2.2 New tools

New tools go to the **middle and far zones** and to new roles, since the near zone is full (hands, swatter, pepper, bell).

**Magnifying glass**
- Point it: a beam and a hot spot on the board (faked, not real sun optics). Hold the spot on a goblin about 1 s and it is knocked out; on a keg, the fuse lights at once; on hay, it catches fire.
- **Kegs only explode from fire** (the glass, a blast, burning hay, a torch at night). The slingshot still sets off boulders, trees and bridges. The trigger registry says what sets each one off. Until the glass exists, kegs keep working with the slingshot.
- **Day and night matter:** strong by day, slower at sunset, weakest at night (for example a 1 s fuse by day, 2 s at sunset, 4 s at night), never dead (the last wave is always night). Shown without text: a white beam by day, orange at sunset, faint blue at night.
- A second job: it burns wooden shields (an answer to armor at range).
- The fast ranged answer to bombers and shamans (Phase 3).

**Sugar cubes**
- A bowl of cubes, like the pebble bowl. Toss one by hand near the wall, or load one into the slingshot to place it far.
- Goblins on nearby roads walk to the road point closest to the cube and stop to eat it for a few seconds. They never leave the roads (no new off-road walking).
- Pull a group onto a bridge, next to a keg or into hay, then set it off.
- Limits: a cube lasts a few seconds; a few cubes per charge.

**The loadout becomes a real choice:** a trap build (glass and sugar: strong far out, weak at the wall) or a wall build (swatter and pepper: strong up close, little at range).

### 2.3 Hard rule change (update AGENTS.md when built)

- **Day and night:** may be read by gameplay (the glass). The time still changes only between waves, never mid-wave, so it costs no frame time and the player always knows it before a wave starts.

---

## Phase 3: new enemies

The rule: a new enemy changes **what** the player does or **when**, never just the hit count. Models come from the packs (see "Finding assets").

**Bomber**
- Carries a keg on its back toward the wall. At the wall it explodes: big damage.
- Hit it on the road and it explodes among its own group (and sets off kegs and hay near it).
- Question: hit me before I arrive. Answers: slingshot, the glass, the knights.
- Reuses the goblin and the keg model.

**Catapult crew**
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

**Shaman**
- Stays at the back of its group and gives knocked-out goblins their helmets back, or wakes them up.
- Question: find me behind the crowd. Answers: slingshot, the glass, the knights.

**Brute** (the final wave's mini boss)

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

**Goblin archers** (after the shaman and the brute)
- Stop at middle range in a tight group and shoot volleys at **the garrison** (not the castle, not the giant's hands).
- Question: break up the group before your wall is empty. They are the only goblins that stand still, so they are the best target for a keg, a tree or the glass.
- Fits a level about the garrison (level 8, Thin Walls).
- No arrows at the giant's hands: small fast arrows plus tracking lag would feel unfair.

**Zones:** far (shaman, catapult, archers), middle (bomber, brute), near (the climbers, as today). Every tool gets a job.

---

## Phase 4: chains and score (direction only, not final)

Decided later, once the Phase 2 objects work on their own. What is agreed so far:

- **Chains:** an object's result sets off a nearby object (a keg blast lights hay, burning hay burns a bridge's rope, a falling tree lands on a seesaw). The inputs and outputs are already in each registry entry (Phase 2); Phase 4 passes them on, through a neighbor list made once at load time.
- **Short and local:** 2 to 4 links per group of objects, never 100; groups far enough apart that one cannot set off another; the generator checks it.
- **Moving enemies are fine:** the roads do not move, so traps always meet goblins; choosing the moment is the skill (fire now at 3, or wait for 10). Traps come back (Phase 2), so the first group never uses up everything.
- **Links seen before they fire** (a fuse line, a rope, hay in a trail), and feedback that builds (a note higher per link, "Chain x4!").
- **The tutorial's trigger lesson** may become a small chain on its fixed seed (same steps, a bigger payoff).
- **Score and combo:** quick kills and eats in a row build a combo; points for chains and a wave without damage; stars from the score, not only from winning; shown on the win screen.

---

## Phase 5: the modes (on hold)

On hold until the new tools and enemies exist, since how difficulty rises and which challenges exist depend on them.

- **Campaign:** the 15 levels ([custom-mode.md](custom-mode.md) section 10). Each new enemy or tool is introduced by a level, one at a time. The most visual ones go in levels 1 to 5 (open from the start), because judges play only 10 to 15 minutes.
- **Daily Challenge:** a short battle (2 or 3 waves), the same for everyone that day (seed from the date). Before it starts, **3 challenge cards**, each with an upside and a downside; the player picks one (like the modifiers in Dead Cells). An upside and its downside touch different things, so the choice is real (for example "eating heals the castle, but no garrison", not "a wider swatter, but a slower recharge"). Streak and kingdom gift later. No backend.
- **Endless:** no cards. Waves until the castle falls, high score. It gets harder with **new problems** (more camps rising, new enemy mixes, more directions), not just more goblins.
- **Random:** not its own mode. A dice button ("Surprise me") on the Custom Game list makes a random level and plays it; save it if you like it.
- **Custom Game:** stays the sandbox. Later it may get challenge toggles for cards already met in the Daily.

---

## Dropped ideas (so they are not discussed again)

- **Narrowing the threat arc** (most threats from the front): the 360 battlefield is the game.
- **Pulling the camps in** for speed: the big board stays; goblins walk faster instead.
- **A knob twisted with the wrist:** a wrist turns only about 180 degrees. Replaced by the crank (1.7).
- **Relying on a swivel chair:** judges may not have one, and the tools and flags do not turn with the body.
- **Ladder crew and digger:** a ladder is a faster climb; a digger is only immune to most tools, and the answer is still eating.
- **Bowling ball:** the same result as the boulder.
- **Honey jar:** replaced by sugar cubes (same lure, cheaper: reuses the pebble toss, and fits the giant).
- **Water tower, flood, rivers:** fluids look bad on the Quest's budget.
- **Finger flicks or custom poses to shoot:** they flicker with hand tracking.
- **Arrows at the giant's hands:** unfair with tracking lag.
- **Cards in Endless:** endless waves are enough of a hook.
- **A separate Random mode:** the same as Custom with a dice button.
- **A faster slingshot loop** (bigger pouch snap, shorter pull): loading feels fine; only the aim assist changes (1.8).
- **Brute phases that each need certain tools:** a missing tool could make the wave unwinnable. Replaced by armor plates with many answers (Phase 3).

**Maybe later** (good, not planned): the trench coat goblin (three goblins in a coat, scatter when hit, count as 3 when eaten whole), the chieftain (knock out its banner carrier and nearby goblins run back), the thief (steals a tool from a platform), the torch bearer (sets your traps on fire, or sets them off among its friends), engineers building a siege tower (a timer you can see), bees from a beehive, the boomerang.

---

## Open

- Final tempo numbers (headset).
- Goblins per wave so the horn is used about twice per wave (1.5), and knight strength so a held squad beats one group (1.6).
- The snap step (30 degrees to start, 1.7).
- Which tutorial steps go (1.9).
- The chain rules, the score values and the star thresholds (Phase 4).
- Which campaign level introduces each new enemy and tool.
