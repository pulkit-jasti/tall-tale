# Tall Tale v2: Plan and Decisions

Status: decided (2026-11-10). Run 1 built (2026-11-10) and tuned over 15 headset rounds (to 2026-11-11, build only, committed). Run 2 rescoped (2026-11-11) to the menus and the new UI only, designed in [menus.md](menus.md), and built the same day on the branch `feat/v2-menus`, reworked over several headset rounds and tested on the headset (2026-11-11: it all works well; not committed yet). Next: run 3. Branch: `feat/v2-menus` (from `feat/v2`).

**This file wins over every other doc where they disagree.** The other docs describe the MVP as built. As each part below is built, update its topic doc (the "What this replaces" table says which) and tick it in the checklist here. When everything is folded in, this file is history.

Back to [GDD index](GDD.md).

---

## 1. The goal: win the hackathon

Everything is optimized for judging (Meta VR Start Developer Competition 2026, target submit Nov 16).

What judges actually see, in order:

1. **The tutorial (about 8 to 10 minutes).** For most judges this is the whole game. It must be complete, polished and show the most fun parts: eating, the slingshot, the swatter, the horn calling the army, the bell. It is also the "Best First Five Minutes" prize.
2. **The menus after the tutorial (about 1 minute of looking around).** This wins or loses "Best Reason to Come Back": a campaign of 15 levels (5 playable, 10 readable but locked) and tool unlock icons, the tool rack with locked tools, the trophy shelf with riddles, and "More coming soon" at the end of each.
3. **The demo video (under 3 minutes).** Shows what judges never reach: later levels, night battles, a tool unlock, a new tool.
4. **The Devpost write-up.**

So: the tutorial and the menus come first. Levels 1 to 5 must be good (they are all open from the start, so a judge may play any of them). Levels 6 to 15 are text only for now: their cards can be read, but they stay locked (see [menus.md](menus.md#locked-levels)).

---

## 2. Decisions

### 2.1 Tools: free, with a use window and a recharge

- **No food cost.** The food currency, the food jar and the price tags are removed.
- **Every tool except the slingshot** has a **use window**, then a **recharge** that starts when it is back on its platform. This makes the player choose which tool to use when, instead of using one favorite all the time.
- **Starting values** (tune in playtests, in config):

| Tool | Use | Recharge |
|---|---|---|
| Slingshot | always | none |
| Swatter | 10 s | 20 s |
| Pepper | 8 s | 20 s |
| Bell | one stun | 35 s |
| Horn | one call | 30 s |

- **How it shows:** while recharging, the tool dims (the existing Locked look) and a ring on its platform fills up. Readable with the sound off.
- **Two hands are a natural limit too:** the slingshot needs both, a held tool means that hand cannot grab a goblin, and eating needs a free hand.

### 2.2 Eating: it fills every recharge ring

- **Each goblin eaten fills every recharging tool's ring by 10% of that tool's full recharge** (a 30 s recharge gets 3 s back, a 20 s one gets 2 s). A **seasoned** (peppered) goblin fills 20%.
- The tools keep the same balance against each other; only the overall pace speeds up. All rings jump forward together with the gulp, so it is easy to see.
- It never shortens or extends a use window, and never makes a ready tool "more ready".
- **The balance idea:** more goblins means more to eat, faster tools, and more power to clear the wave. Watch the snowball in playtests; if too strong, lower the share, not the idea.
- Eating is also the only way to deal with goblins in the courtyard without tools.

### 2.3 The five tools

- **Slingshot:** unchanged. Free, no timer, always in the loadout.
- **Swatter:** unchanged. It already works on the walls and the rampart (tested on the headset).
- **Pepper (reworked):** a small area. **Disarms everything:** weapon, shield and helmet fly off, so the goblin becomes a one-hit goblin. The goblins sneeze for a few seconds and cannot attack meanwhile. **No push back, no throw.** Peppered goblins are seasoned (20% when eaten). The power is the disarm, balanced by the small area and the cooldown.
- **Bell (reworked):** the only stun. Shake it, and **every goblin on the board is stunned**, and **every goblin on the rampart is knocked back down outside the wall** (it climbs again later). It does not disarm. The longest cooldown. Hands only, no voice.
- **Horn (new, replaces the megaphone):** calls the field army (2.6). Two ways to blow it:
  - **Hold it at the mouth for a moment** (like eating): it blows. No mic needed, so it is accessible.
  - **Blow into the mic** while it is at the mouth: it blows right away and louder. A blow counts only while the horn is at the mouth and the loudness stays over a low threshold for about 0.3 s, so talking or room noise does not trigger it.
  - The **mic permission stays** on the 2D start page, for the horn. The megaphone and its scream are gone.
  - The horn needs its own platform in the reach band (the bell and the megaphone used to share one). Sound: the existing `waveHorn` war horn can be reused.

### 2.4 Loadout: 4 tools, 2 fixed, 2 picked (changed 2026-11-11)

- A battle has **exactly 4 tools: the slingshot and the horn are always in, and the player picks the other 2** (from swatter, pepper, bell and the new tools). So a battle has 4 tool platforms (was 5).
- Why fixed: the slingshot sets off the triggers and pops balloons, and the horn is the only way to call the knights.
- **The player picks**, by putting tools from the tool shelf on the loadout stand in the menu ([menus.md](menus.md#5-tools-the-shelf-and-the-loadout)).
- **The bell leaves the tutorial** (its swing trigger does not work well yet). It becomes an unlock in levels 1 to 5 and gets fixed later.
- **Every unlockable tool unlocks in levels 1 to 5.** Which tool in which level is decided once the tools are final.
- **First-use lessons:** postponed until more tools exist (not in run 2).

### 2.5 Gear has real effects

Today: spears are only for looks, helmets take one extra hit, big hits (swatter, keg, boulder, goblin shot) go through helmets, and pepper only knocks off spears. All of that changes:

- **Helmet:** one extra hit.
- **Shield:** one extra hit, counted separately. A goblin with helmet and shield takes 3 hits.
- **This counts for every hit, the swatter too.**
- **Spear:** double wall damage.
- **Sword:** kills soldiers and archers faster in a fight.
- **Pepper strips all of it** (2.3).
- **The same rules apply to our troops:** a soldier's shield is one extra hit.
- Goblins get shields and swords. Kenney already has shield and sword models (our soldiers use them), so it is setup work, not new art. Merge them into the skinned mesh like the current gear (`src/units/gear.ts`).
- Open: do triggers (keg, boulder, tree) ignore armor? Proposed: yes, they are the big environmental hits.

### 2.6 All goblins climb

- **There is no separate climber type any more.** Every goblin climbs. This fixes three things: goblins can no longer hide behind the wall (they end up on top, clearly visible), there is much more to eat, and armored goblins come close enough for the pepper.
- **The four steps, each more dangerous than the last** (starting values, tune in playtests):
  1. **Bash the wall** for about 5 s: wall damage and the red wall flash.
  2. **Climb:** grunts 2 cm/s, runners 4 cm/s, helmeted goblins 1.5 cm/s.
  3. **Run around on the rampart** for about 8 s: no castle damage, but they **attack the wall garrison** (2.7).
  4. **Jump into the courtyard** as intruders (the biggest damage).
- So the player always knows the order: deal with the ones on top first.
- Variety now comes from runners (fast, climb fast), gear (helmets, shields, spears, swords) and balloons, not from a climber type.
- The red wall flash and the red threat arrow stay, as helpers.

### 2.7 The army: field knights and the wall garrison

Two clear jobs, so the army never looks dumb:

**Wall garrison (defends the wall)**
- On the rampart: **6 at most, 4 archers and 2 guards** (swordsmen).
- When there are fewer than 6, **one new one climbs up from the courtyard every 15 s** until there are 6 again.
- They walk along the rampart (one angle on a ring, no road pathfinding, cheap) toward the nearest threat.
- **Archers** stop and shoot outward at goblins walking in. Range about 100 cm. **Random hits, about 55%**, a miss lands with a small puff (randomness costs no frame time; damage is decided in code, arrows have no hitboxes). They **back away** from goblins on the rampart and keep shooting; they do not fight up close.
- **Guards** fight goblins on the rampart up close.
- **Goblins on the rampart attack the garrison** and kill an archer in 2 hits. Protecting the archers is part of the player's job.
- **Arrows must be easy to see:** 3 to 4 times longer than now, white feathers, a short light streak, a higher arc so they rise against the sky, and the archers of a stretch fire together as a volley. Still one instanced mesh and a small pool.
- The swatter, pepper and bell never hurt troops. The pinch already only targets goblins.

**Field knights (stop goblins reaching the wall), only through the horn**
- **No squads come out on their own any more.** Every field squad is the player's choice.
- **Blow the horn:** the gate bursts open with the horn sound and a battle cry, and **a squad of 4 to 5 (swordsmen and spearmen) sprints down the road in front of the player** (spin the board to choose the road) at 2 to 3 times walking speed with a banner.
- **They crash into the goblins** on that road: the impact knocks several over, with a hit stop.
- Then they **hold the first junction** on that road (about 130 to 140 cm out) and fight everything that comes down it, until they fall or the wave ends. They never walk to the camp.
- ~~**Runners dodge past them** with a quick hop.~~ Changed in run 2: every goblin near a knight, runners too, stops and fights it, and the whole squad fights whatever any of its knights sees, on the way out too ([core-loop.md](core-loop.md)).
- When the wave ends, they march home.
- The answer to each threat: a big group on a road is the horn; a crowded wall is the bell, pepper or hands.
- Field soldiers are swordsmen and spearmen only. Archers live on the rampart.

### 2.8 Campaign, unlocks and saving

- **Campaign: 15 levels (changed 2026-11-11, was 25).** Details in [menus.md](menus.md#8-campaign-panel).
  - **Levels 1 to 5:** open from the start, hand-made and polished.
  - **Levels 6 to 15:** locked, text only for now (name, flavor, skulls, enemies, reward), so their cards show the variety. Beating level 5 opens 6, then each win opens the next. Built later from the same data.
  - **Every level has a twist** made from existing systems, and its name comes from the twist. Daily Battle gets rule-breaking twists that never appear in the campaign ([menus.md](menus.md#campaign-twists-vs-daily-twists)).
  - **Difficulty** rises gently, with new problems, not tougher goblins, shown as 1 to 3 skulls.
  - **Stars:** 3 at 70% health or more, 2 at 35% or more, 1 below; best kept; retry costs no stars; no points score ([menus.md](menus.md#stars)).
  - **Tool unlocks** all in levels 1 to 5 (not yet assigned). An unlock level shows the tool's icon on its card, and a "New!" moment after the win.
- **A level is data:** map blueprint + waves + tool unlock + twist (gear mix, triggers, enemy mix, camps). No time of day per level: every level has 4 waves, one time of day each.
- **The map generator is our design tool, not a runtime feature:** seed and settings in, blueprint out (the rules in [map.md](map.md#the-level-generator-later-not-in-the-mvp)). We tweak the output and save each level as a fixed file, so every player gets the same tested level.
- **The wave director** reads waves from the level file (planned in [map.md](map.md#directors)). The tutorial keeps its own scripted director.
- **Saving:** localStorage, no backend. Levels done, stars, unlocked tools, achievements, riddle hint counts.
- **"Unlock all tools" switch** in settings, for judges. It unlocks tools only, never levels.
- **Retry from the current wave** after a loss, instead of the whole battle ([castle-rules.md](castle-rules.md#losing-should-feel-generous)).
- Endless, Daily Battle and Custom Game come later (Daily can force tools and conditions). The growing kingdom comes later.

### 2.9 Menus after the tutorial

**Replaced by [menus.md](menus.md) (2026-11-11), which has the full design.** In short:

- The menu is the tutorial battleground: after the tutorial the castle, flags and battle things sink into the ground and the menu rises.
- Front, and only there: the main menu panel, a compact grid of round buttons (Daily, Campaign big in the middle, Custom; Settings and Tutorial below). Every option shown, none locked.
- Campaign: a split panel, a list of levels on the left (tap to select, an upright slider to scroll), the selected level's card on the right (a turning 3D copy of the reward tool), a rectangular red Fight button (locked until the level is open and both tool slots are filled; with empty slots a poke shows a glass sign and a red arrow at the slot).
- Right side, between the front and the side: the tool shelf (back row) and the loadout stand in front of it (the battle's own platforms: slingshot and horn fixed, 2 slots to fill; any tool goes on any place, with a glowing snap zone). Left side (-90): the achievements shelf.
- **"More coming soon"** as one card at the end of each list: levels, tools, achievements.
- Built only from the UI library (`src/ui/kit/`), inside the reach band, following Meta's hands UI guidance; new kit parts: `ScrollList`, a `locked` state and menu icons for `PokeButton`.

### 2.10 Achievements as riddles

- Trophies on the shelf, each with its own shape. Grab one to read its tag ([modes-and-progression.md](modes-and-progression.md#5-achievements)).
- **Unlocked:** the name and what was done.
- **Locked: a riddle**, so the player works out what to do and feels smart. Example for pepper then eat: "Every snack is better with a little spice."
- **Hints: reading counts as interest.** The first time a locked trophy is grabbed and read, its own count starts. **After 2 battles since that first read**, the back of the tag unlocks a clearer hint: turn the trophy over to read it. Only riddles the player looked at get hints.
- Earning one: a short sound and sparkle in battle, the trophy pops up in the results, then flies onto the shelf.
- **Pepper then eat is one of the achievements.**

### 2.11 Future tool ideas (hand motion, no smashing)

Build 1 or 2 in run 3, for the tool rack and the video:
- **Watering can:** tip it, the road turns to mud, goblins slow down.
- **Hand fan:** wave it to blow balloons away and push a group back.
- **Magnet:** hold it out to pull helmets, shields and weapons off from range.
- **Cookie bait:** drop it on a road, goblins crowd around it, ready to swat or eat.

### 2.12 Smaller decisions and leftovers from the MVP

- **Castle machines are dropped** (no time to design, add and balance them). Only the giant's hand tools. ([castle-machines.md](castle-machines.md) stays as history.)
- **Goblins walk faster** (for example grunts 6 to 8 cm/s), so waves do not drag now that the camps are far out.
- **A giggle when a goblin reaches the rampart** (`goblinCackle`, placed at the goblin): a sound cue for where to look.
- **Move the pause lesson later**, so the first goblin snack comes sooner.
- **Missing sounds** (still the chime or absent): `cheer`, `kegBoom`, `triggerNow`, goblin chatter, burp, lose trombone, ambient wind and birds, night crickets, torch crackle. To prepare: the sword hits (cut into single hits), the village ambience (a short loop). The horn reuses `waveHorn`.
- **Eating sounds** (for tuning): `grab` and `squeal` on the pinch, `chomp` on the eat (`src/player/grabEat.ts`), `gulp` 0.35 s later (`646981__huw2k8__monster-eating-a-goblin.wav`, 5.5 s, may need a trim), `foodAdded` goes with the food jar.
- **Sound credits:** check each Freesound file's license on its page and write a credits file for the CC BY ones. Not done: the licenses are not recorded anywhere yet.
- **Mic in VR:** still not tested inside the immersive session. The horn's hold-to-blow fallback means it is no longer a risk.
- **Throw ghost demo** (`toss` in `src/ui/ghostDemos.ts`): built, needs a headset check.
- ~~**Wave 5 trigger reminder text** is never shown; fold it into the new tutorial.~~ Wave 5 is gone (run 2: 4 waves).

---

## 3. Build plan: three runs

Each run is one long coding agent session. Inside a run, **commit after every step** (no push unless the developer says so). **No typecheck and no tests for now:** the focus is building. Only `npm run build` must pass before each commit, so the game still loads. **Do not stop for headset tests inside a run.** Tick the checklist below and add a short note per step (what changed, anything decided along the way), so the next session or a summarized context has the facts. At the end of a run, stop and give the developer one headset check list for the whole run, with the debug actions for it.

The "Cloud build run" rule "Stop after step 1" in AGENTS.md does not apply to these runs.

Every new rule (cooldowns, refund, gear hits, climb steps, garrison refill, unlocks, stars, riddle hint counts) goes in plain TypeScript in `src/rules/`, like the existing rules (no new tests for now; existing tests may break and can be fixed later). Every new interactive thing goes in `reachSpots()`. Every new tool gets a `HOLD.poses` entry, a ghost demo that follows the AGENTS.md ghost rules, and debug actions in `DEBUG_ACTIONS`. Every new material on units gets the night rim.

**Before run 1 (developer):** run the stress test on the headset and log the result in [performance.md](performance.md), so the unit budget is known before archers and climbers are added.

### Run 1: core gameplay

The mechanics the tutorial will show. The tutorial must stay playable after this run (adjust its lessons and texts only as much as needed; the real rebuild is run 2).

- [x] **1.1 Gear effects** (2.5): helmet and shield as separate extra hits for every hit including the swatter, spear double wall damage, sword faster kills on troops, goblin shields and swords, same rules for troop shields.
  - Done: rules in `src/rules/gear.ts`. Goblins carry `weapon` (none, spear, sword), `helmet`, `shield` (new gear pieces `goblinSword`, `goblinShield`, Kenney models). `Goblins.armor()` takes the helmet, then the shield, for every hit: pebble, arrow, soldier, swatter and goblin shot (the goblin shot no longer goes through). After armor takes a hit the goblin shrugs off hits for `GOBLIN_GEAR.hitGrace` (0.35 s), so one swatter swing over several frames takes one piece. Spear: `spearWallDamage` 2x. Sword: goblin strike gap x `swordStrikeScale` 0.6. Troop swordsmen and spearmen lose their shield on the first goblin blow (it flies off), then take `TROOPS.hitsToDown` (2) more; archers 2.
  - Decided: **triggers ignore armor** (the proposal in section 5). Gear mix: grunts spear 40%, sword 25%, helmets 35% from wave 3, shields 30% from wave 4; runners bare. Debug: "Armored grunts" (key `\`).
- [x] **1.2 All goblins climb** (2.6): remove the climber type (wave counts become grunts and runners), the four steps, rampart goblins attack the garrison, the giggle cue, faster goblins.
  - Done: `GoblinType` is `grunt | runner`. Rules in `src/rules/climb.ts`. Every goblin walks to a stretch of wall between towers, bashes for `GOBLIN_RULES.bashTime` (5 s, plus or minus 20%) at `bashStandOff` (1.2 cm), climbs at `GoblinStats.climbSpeed` (grunts 2, runners 4, helmets slow to `helmetClimbSpeed` 1.5), runs on the rampart for `rampartWait` (8 s), then jumps in. The `goblinCackle` giggle plays where a goblin pops up (at most every `cackleGap` 0.6 s). Grunts 7.5 cm/s, runners 15. Tutorial wave counts: the old climbers were added to the grunts. The tutorial's lesson goblin (`spawnClimberAt`) is now a bare handed grunt. Debug "Climber on a road" is gone (every grunt is one).
  - Rampart goblins attacking the garrison is built in 1.6, together with the garrison.
- [x] **1.3 Tools** (2.1 to 2.3): use windows and recharge rings, eating fills the rings, remove food cost, the food jar and the price tags, pepper rework, bell rework.
  - Done: rules in `src/rules/recharge.ts` (ready, using, recharging). `TOOLS.use` and `TOOLS.recharge` hold the section 2.1 numbers. `HandTool` starts the use window on the first use, the recharge fills only while the tool rests on its platform, dimmed (Locked look); a grab while recharging buzzes. The ring (`TOOLS.ring`) is a flat ring on the platform top: it drains in cream while a use runs, fills in blue while recharging, flashes white when eating fills it, hidden while ready (one mesh, the fill is a draw range). Eating calls `refill()` on every tool (10%, seasoned 20%) with the `foodAdded` chime. The food jar, price tags, `FOOD`, `FOOD_JAR`, `PRICE_TAG` and `src/rules/food.ts` (and its test) are gone. Pepper: disarms everything (`Goblins.disarm`), sneezes 5 s (`PEPPER.sneezeFor`), no push back. Bell: one stun per use (1.2 s window), plus `Goblins.knockOffRampart()`, 35 s recharge. The megaphone works with the recharge until 1.4 replaces it.
  - Decided: the tutorial keeps normal recharge times; its use lesson makes a resting tool ready when it starts (`holdToolTimer`). The food lessons are gone; the first tool's grab lesson says tools rest after use and eating fills the ring. `canAfford` is now `toolReady`. Debug: "Recharge tools" (Y), "Drain tools" (0), "Eat refill" (V). `director.test.ts` food lesson tests now fail (expected, fix later).
- [x] **1.4 Horn** (2.3): replaces the megaphone, its own platform, hold at the mouth or blow into the mic, its ghost demo.
  - Done: `src/tools/horn.ts` (`HORN` in config, `warHorn()` and `hornMeter()` in `src/world/shapes.ts`, an ivory horn with brass bands on a leather grip, held like the megaphone was: `HOLD.poses.horn`). The mouthpiece within `HORN.mouthDistance` (20 cm) of the head for `holdTime` (1 s) blows it; with the mic, loudness over `blowLevel` (0.025) for `blowHold` (0.3 s) while at the mouth blows it at once and louder. A breath bar on top fills meanwhile (readable without sound). Sound: `waveHorn`. One call per use, 30 s recharge. `onCall` sends the knights (1.5). The megaphone, `MEGAPHONE`, its shapes and the stun tool swap are gone. Ghost demos `hornGrab` and `hornBlow` (the megaphone's keys, same pose).
  - Decided: the **horn takes the megaphone's spot** (right side, 82 degrees) and the **bell gets its own platform where the food jar was** (left, -56 degrees, `TOOL_SPOTS.leftMiddle`), so its ghost demos now use the left hand (mirrored). The settings switch "Bell in place of the megaphone" is now **"Quiet horn"** (the horn never listens to the mic; `access.quietHorn`, `hornHearsMic()`). Tutorial (minimal, run 2 rebuilds it): the horn is taught before wave 1 (its grab lesson, then its use lesson at wave 1 start, no bait goblins), since knights only come by horn now; wave 5 teaches the bell. The start page mic texts talk about the horn.
  - Headset check: both ghost demos (horn at the mouth, left hand bell) from the seat, and the mouth distance.
- [x] **1.5 Field knights** (2.7): only through the horn, the charge, hold the first junction, runners dodge.
  - Done: `KNIGHTS` in config. No squads come out on their own (`Troops.deploy` does nothing now). `Troops.charge(frontAngle)` (the horn, and debug "Send knights" key 6): 4 to 5 swordsmen and spearmen burst out of the wall entry nearest the front (`stage.spin`), 0.3 s apart, with a battle cry and dust, and sprint (2.5x, the `sprint` clip) down that road; the first carries a blue and gold banner (`knightBanner()` in shapes, 8 cm). The route goes out point by point to the first junction at least `holdMinRadius` (120 cm) out, never into a camp (on the tutorial map: jNorth, jNorthEast, jEast, jSouth, jWest, 124 to 140 cm). First contact: the crash knocks up to 6 goblins within 12 cm back down the road (dazed) with a clash, sparks and a hit stop, ring and pow (`onCrash`). Then each knight walks to its own spot at the junction (two rows across the road, facing out) and fights any goblin within `holdRange` (10 cm) until it falls or the wave ends; then it marches home along its route. Runners walking past within 7 cm hop (`Goblins.hop`). Field knights at most `maxField` (10); `TROOPS.max` is 16 with the garrison. The army leaves lesson goblins alone (`Goblins.isLesson`).
  - Decided: blowing the horn again sends another squad (they add up to `maxField`). Field archers are gone (archers live on the rampart, 1.6).
- [x] **1.6 Wall garrison** (2.7): 4 archers and 2 guards on the rampart, refill every 15 s, visible arrows and volleys, archers back away, guards fight.
  - Done: `src/units/garrison.ts` (`GARRISON` in config, rules in `src/rules/garrison.ts`), run from `Troops.update` (`onUpdate`), manned full at every battle start (`Troops.manWalls()`). One soldier per stretch between two towers (homes at 0 and 180 degrees for the 2 guards, 60, 120, 240, 300 for the 4 archers), at radius 47.8 on the wall top, walking only inside their own stretch (no tower clipping). Refill: one climbs up the inner side of the wall from the courtyard (2.2 s) every 15 s while any is missing, archers first. Archers pick the nearest goblin walking in within 100 cm and fire together every 2.2 s (`volleyEvery`, staggered 0.07 s), 55% hits; they back away from a rampart goblin within 9 cm. Guards walk to the nearest rampart goblin on their stretch and strike it up close (armor counts). Rampart goblins next to a soldier (3 cm) stop dashing and strike it (sword faster); archers go down in 2 hits, guards in 3 (shield). Arrows: 7.5 cm (was 2.2), bigger white feathers, a 7 cm see-through light streak (one more instanced mesh), arc 22 cm, 0.9 s flight.
  - Decided: archers do not shoot climbing goblins (only goblins walking in, at the wall or dazed outside). The army never targets lesson goblins. Debug: "Thin garrison" (key `-`) takes 2 soldiers down to watch the refill; "Troops on/off" brings the garrison back.
  - This also finishes the 1.2 item "rampart goblins attack the garrison".
- [x] **1.7 Stress test config** includes the garrison and a knight squad (`STRESS_TEST`), and the topic docs (giant-tools, enemies, core-loop, castle-rules, controls-and-ui, assets, placeholder-shapes) and the README history are updated for run 1.
  - Done: `STRESS_TEST.garrison` (6, on the rampart at their homes) and `STRESS_TEST.knights` (5, at the junction in front, the first with its banner), all walking on the spot via `Troops.standForTest(garrison, knights)`, plus the 2 balloons as before. Topic docs, the README (status, what the player does, voice, history 57 to 62) and castle-machines.md (dropped) are updated.
  - Not done in run 1: the stress test itself (needs the headset), typecheck and tests (not run, by the run's rules; `director.test.ts` and other tests may fail), mvp.md (run 2 updates it with the tutorial rebuild).

#### Run 1 as it stands now (after 15 headset rounds, 2026-11-10 to 2026-11-11)

This is the current state. The step notes above and the round log below are history: where they differ, this list wins. Numbers are in `src/config/game.ts`.

- **Tutorial** (`src/director/tutorial.ts`, `src/director/battle.ts`), in order:
  - Before wave 1: reach check (only if the reach is not saved), pause, spin, height, pinch, eat, throw, then the red flag and the blue flag (one sign each).
  - Wave 1: its banner, then it plays at half rate with only 3 goblins (`hornGoblins`) until 2 are eaten (or 30 s), then a breather with no spawns until the board is clear.
  - The horn: grab it (left hand), then one lesson in beats on the glass sign: "Look around" (at least 7 s of holding), lift to the mouth, "Spot set" (2 s, the horn waits), blow with the bar.
  - The knights' first fight: once the full squad of 5 has reached its spot, 3 goblins come and stop in front of it to be fought ("Congratulations! Your knights won!"). Then wave 1 plays on.
  - Wave 2: slingshot (grab with the left hand, pebble with the right, load, shoot a moving goblin), keg, boulder, tree, a little practice, then a balloon (glass sign).
  - Wave 3: swatter. Wave 4: pepper (armored goblins). Wave 5: bell. (Run 2: the bell left, wave 5 was dropped; 4 waves, the blue flag has 4 notches.)
  - **Rules:** no lesson ever moves on by itself (Skip tutorial is the way out); no wave goblins while a lesson runs, only the lesson's own; every other tool is locked (dimmed, a grab buzzes) during a lesson; knight squads march home after each wave's cheer; texts are one short easy line; ghost hands use the opposite hand of the tool's side (AGENTS.md).
- **Horn** (`src/tools/horn.ts`, `src/ui/hornAim.ts`):
  - Aim by gaze, 12 degrees below where the head points, snapped to a road within 22 cm. Off the road: a white ring with a dark edge and an arrow to the nearest road.
  - At the lips (17 cm from the eyes): a steady look of 0.4 s locks the spot (gold, path), and a look more than 30 degrees away for 0.3 s unlocks it.
  - Blow: one frame of raw mic loudness at or over 0.015. The bar on the glass sign shows the same number, and stays full and gold for 1.5 s after a blow. Quiet horn (or no mic): 1.2 s locked at the lips.
  - The called spot stays marked until the squad arrives. The use window starts on the call; 30 s recharge.
- **Knights** (`src/units/troops.ts`):
  - Up to 4 squads of 3 to 5 (always 5 in the tutorial), routed over the roads.
  - At their spot: a 22 cm watch radius and a 35 cm leash. A free knight takes the least crowded goblin near it (no cap), 35% hits. (Run 2 rewrite: the squad sees every goblin within 22 cm of any knight, `senseRadius`, and every free knight goes for one, on the way out too; goblins within 16 cm of a knight, `goblinSense`, stop and fight; no hops past.)
  - A squad down to 1 breaks and goes home. Squads stay between waves, except in the tutorial.
  - Safety nets for the "running in place" bug (cause still unknown): `closeGiveUp` 4 s and `stuckTime` 2 s, each with a debug note.
- **Garrison** (`src/units/garrison.ts`): archers within 60 cm, 2 arrows make a hit. Guards hunt the whole rampart at 8 cm/s. Refills: archers every 15 s, guards 30 s. Rampart goblins jump in only once no soldier is left on the wall. No spawns while intruders are inside.
- **Bell** (`src/tools/bell.ts`, rewritten twice): the trigger reads the holding hand on tracked frames only; it rings when the hand gets 3 cm from a slow anchor (0.15 s) and re-arms within 1.2 cm, never in the first 0.4 s after the grab. The game does the stun (`Bell.onRing`); the sound comes last and guarded. The stun itself is checked on the headset (debug ring); the swing trigger is not yet.
- **Pause:**
  - The button in front.
  - The Quest menu: visibility events, no frames for 1.5 s, or the menu gesture (strict).
  - The headset taken off: no hand and the head still within 3 mm and 0.4 degrees for 5 s, since the Quest 3S has no proximity sensor.
  - The FPS panel shows the reason while paused.
- **Menus and UI:**
  - Welcome panel: Play, Settings, Skip tutorial.
  - Pause panel: Resume, Settings, Restart, Skip tutorial (run 2: Skip tutorial only in the tutorial, Menu in other battles; the panel sizes to its buttons).
  - Settings: Access first and open by default (Measure reach, Quiet horn, Reset table), then Sound.
  - The glass sign (`src/ui/kit/glassSign.ts`) is in the UI library.
- **Debug:** no keyboard keys, everything is on the debug page (cleaned up, with a notes column from `src/debug/notes.ts`). FPS panel, and the mic panel (`?mic` or "Mic panel on/off") for the blow line.
- **Bugs fixed on the way:** all-white goblins (pool repaint), the knight leash loop, stray tool blinking, the stuck off-road ring, random pauses.

#### Before run 2 (handoff)

- **Commits:** steps 1.1 to 1.7 are `34da0d2` to `da7a656`; the headset rounds are `26fac84` and `adb977a`. Only this docs update is left to commit.
- **Not yet checked on the headset:** the bell's swing trigger (read its "held ... farthest swing" note), the headset-off pause, the blow at 0.015 with the gaze lock, the knights' first fight, and the left-hand horn demo (the horn's curve was shaped for a right hand).
- **Owed:** the stress test with 26 troops plus the garrison (`STRESS_TEST`), logged in [performance.md](performance.md). `npm run typecheck` has not run since run 1 started, so expect type errors. `npm test` is stale: `src/rules/director.test.ts` still expects the food jar, the megaphone and lesson timeouts.
- **Known open bug:** knights now and then run in place beside a goblin. The safety nets recover it; the debug page notes give the knight's mode, leg and its goblin's mode and distance, to find the cause.
- **Section 4 decided in part (2026-11-11):** the bell leaves the tutorial. Whether pepper stays in wave 4 is still open.
- **Tests: skipped for now** (developer, 2026-11-11). No new tests and no fixing old ones in run 2. Only `npm run build` must pass before each commit.

#### Headset rounds log (history)

**Fixes after the first run 1 headset test (2026-11-10):**

- [x] Tutorial pauses are by context, not a fixed 3.5 s: `TutorialStep.afterDone` per lesson (`PAUSE_AFTER` in `src/director/tutorial.ts`). No pause where the next lesson follows straight on (pick up then eat, grab a tool then use it, the slingshot grab, pebble and load); 1.5 s to finish a move or see it land (spin, toss, the first shot, the balloon, swatter, pepper); 2.5 s to watch what was set off or settle (height, the triggers, the horn charge, the bell, the reach check). Everything else: a 0.6 s tick (`HINT_SIGN.doneTime`, was 3.5); info steps leave 0.4 s (`stepGap`, was 0.8).
- [x] Horn lesson: the grab lesson says what the horn is for; the use lesson says to bring it to the lips and blow (or hold until the bar fills, without a mic), only counts a blow made during it (an early blow no longer skips it), no wave clear ends it, and it waits up to 10 minutes. Done text: the knights hold that road, spin the board to pick another.
- [x] Horn: with the mic on it needs a real blow: `blowLevel` 0.06 (was 0.025, breathing passed it) for 0.35 s; holding alone takes 4 s (`micHoldTime`, still there so voice is never required). Quiet horn or no mic: 1.2 s hold.
- [x] Banner: held in the first knight's left hand (its shield put away), the pole through the fist and upright, following the hand every frame (it stood from the ground beside the knight and looked like it floated).
- [x] A thrown lesson goblin becomes an ordinary goblin (`Goblins.unLesson`): it used to keep the lesson's long rampart wait, so after climbing back it stood still and the army ignored it. Its walk clip is restarted when it heads back to the wall.
- [x] Arrows 4.5 cm (was 7.5), streak 4.5 cm, arc 16 cm, 0.75 s flight. Archer range 35 cm (was 100): only the last stretch before the wall and goblins bashing it, so goblins reach the wall for the hands and close tools.
- [x] Pepper lesson: its waiting goblins wear a helmet and a shield and carry a spear or sword, so the disarm shows.
- [x] Bell freeze in the final wave: not reproduced (no headset in this session). Fixed what was found on that path: the bell lesson's goblins knocked off the wall kept an endless rampart wait, so they came back and stood on the wall forever, ignored by the army and never jumping in, and the last wave could never be cleared; they are ordinary goblins now. Also: every angle wrap is loop free (a bad angle can no longer hang the page), and an error in one frame is logged (`[game] frame error`) instead of freezing the game. If it still happens, the console error says where.

**Knights rework after the headset test (2026-11-10), decided with the developer:**

- [x] Aim the horn by looking (head gaze) while it is at the mouth: the spot snaps to the nearest road, shown by a short fading beam from the bell, a glowing pool and a ghost banner (Meta's head ray and gaze specs: the cue is on the target, a 0.2 s consensus window). No road in sight: grey, it will not blow. `HORN_AIM`, `src/ui/hornAim.ts`. (Meta's asset library was checked but not used: AGENTS.md allows only the listed CC0 assets; the aim is made in code.)
- [x] Squads go to the aimed spot along the roads (`src/rules/roadRoute.ts`, a Dijkstra over the road graph), guard it with a 22 cm watch radius and a 35 cm leash, at most 2 knights per goblin, 35% hits.
- [x] Up to 4 squads of 3 to 5 knights (random). At the limit the horn moves the squad nearest the spot (its banner pulses while aiming). A squad down to 1 knight breaks and marches home, freeing its place. Squads stay between waves. `TROOPS.max` 26: **run the stress test** with this many.

**Fixes after the second headset test (2026-11-10), decided with the developer:**

- [x] The tutorial never blocks: lessons that need a goblin (pick up, eat, throw) bring a new one within 1.5 s when it is eaten, thrown or knocked out instead (eating the throw lesson's goblin used to leave nothing to throw); tool lessons top up their waiting goblins, the shoot lesson its moving target (`TutorialStep.tick`, `keepLessonGoblin`, `keepBait`, `keepMovingBait`). A lesson goblin still waiting when a wave starts becomes ordinary. The horn lesson moves on after 90 s at most (was 10 minutes).
- [x] Fewer signs in a row: the two flag signs are one; after the basics, wave 1 plays on its own, and the horn is taught in the middle of it once 3 goblins are eaten (or after 45 s): one grab lesson, then one lesson in three beats on the same sign (aim, lift to lock, blow), replacing the old horn lesson before wave 1.
- [x] Horn: aim with the head whenever it is held (not only at the mouth), the spot locks when it reaches the lips (everything turns gold, a click, the path the knights will take lights up along the roads, a light pillar grows as the call charges); lowered again it unlocks. With the mic only a real blow sends them (no more firing just from holding it at the mouth); the quiet horn (or no mic) sends them after 1.2 s at the lips. The use window and recharge start only when it sounds. The beam out of the bell is gone (it was hidden behind the horn).
- [x] Horn model: a curved hunting horn held from below (mouthpiece on top of the grip, the body curving forward and down past the fist, the bell low and a little to the side), resting on its bell; it fades to 15% near the face (`HORN.fade*`), so it never covers the view.
- [x] Archers: two arrows make one hit (`GARRISON.arrowsPerHit`), range 85 cm.
- [x] Guards hunt goblins anywhere on the rampart (they walk past towers), at 8 cm/s; a fallen guard is replaced after 30 s (archers 15 s).
- [x] Goblins on the rampart jump in only once no soldier is left on the wall; after their rampart time they hunt the nearest soldier. No new goblins come out while any are inside the castle.

**Fixes after the third headset test (2026-11-10), decided with the developer:**

- [x] The two flags have their own signs again, one arrow each (one sign for both was missed).
- [x] Archer range 60 cm (85 reached almost to the end of the first ring of roads).
- [x] No lesson moves on by itself any more (the horn lesson ran out and the wave went on untaught): every lesson timeout is gone, tool lessons no longer end on a wave clear, and a stalemate never ends a wave while a lesson waits. The way out is **Skip tutorial**: on the welcome panel (bottom left) and on the pause panel (while the tutorial runs). It starts a fresh battle from wave 1 with every tool out and no lessons (`Battle.skipTutorial`, `buildTutorialSteps(..., teach)`); Restart and Play again keep it, the welcome panel's Play brings the tutorial back. Debug action "Skip tutorial".
- [x] Horn cue where the eyes are (`HORN_CUE`, `src/ui/hornCue.ts`): the horn aims by gaze, so the sign's changing text was missed. A small label floats a little above the look's center while the horn is held: what to do now, and at the lips a live loudness bar with the line the blow must pass.
- [x] The blow did not work: the level is now 0.04 for 0.3 s (was 0.06 for 0.35 s), the mic is read the whole time the horn is held (awake before the lips), and the lips count from 24 cm (was 20). The live bar shows whether the mic hears the blow.
- [x] No stray blinking: during a lesson only its own tool may glow (no beckon, Ready glow or ring flash on the others, `HandTool.quiet`), and a lesson's "grab me" glow ends with the lesson (a hint used to keep a tool blinking through later lessons).
- [x] All-white goblins: a goblin knocked out during its white hit flash went back to the pool still white, and the pool's reset skipped repainting it. It is always repainted now, and a knockout ends the flash.
- [x] Pause on the Quest menu: it also listens to the XR session's and the page's visibility events (the menu can stop the frames before a hidden frame is ever seen), and pauses when no frame ran for 0.75 s (`PAUSE.autoPauseGap`).
- [ ] Not run: `src/rules/director.test.ts` still expects the old lesson timeouts (and the food jar and megaphone, from before v2).

**Fixes after the fourth headset test (2026-11-10), decided with the developer:**

- [x] Settings: Reset table moved from the pause panel into the settings' Access tab; Access is the first tab and open by default, then Sound, both centered.
- [x] One glass sign (`GLASS_SIGN`, `src/ui/kit/glassSign.ts`, in the UI library): the see-through variant of the hint sign that follows the look. Lessons with `Hint.glass` (the horn, the knights' first fight, the balloon) show only it, never two signs at once. The horn's bar is plain meshes now: the canvas redrawn on every bar step made the whole view flicker.
- [x] Every tutorial text cut to one short, easy instruction.
- [x] Opposite hand: the ghost hands and texts use the left hand for tools on the right (slingshot, horn) and the right hand for tools on the left (swatter, pepper, bell); the pebble, the load and the pull are the right hand's. Rule added to AGENTS.md.
- [x] The horn lesson ends with the knights' first fight: 3 plain grunts come down the squad's road into it (`Troops.sendGroupAt`, `TUTORIAL_TIMING.squadFight`), done once they are gone.
- [x] Knights frozen next to a goblin: a knight walking back to its spot took a goblin past its leash, let go the same frame, and again, forever. Knights at their spot now only take goblins inside the leash, and letting go of a fight frees the goblin at once.
- [x] Pause: the Quest menu gesture itself (a pinch with the palm toward the eyes) pauses at once (`PAUSE.metaGesture`).
- [x] Horn a little less sensitive: blow level 0.05.
- [x] Fifth test: during a lesson every other tool is locked (dimmed, a grab only buzzes, let go if held; the slingshot too), so no other tool can break it (`HandTool.quiet`, `Slingshot.locked`).
- [x] Fifth test: the horn half as sensitive (blow level 0.1).
- [x] Fifth test: knights still ran in place beside goblins. No cause found in the code, so two safety nets with console logs: a knight that does not reach its goblin within 4 s lets go of it for 3 s (`KNIGHTS.closeGiveUp`), and one in a moving mode that has not moved for 2 s is put where it was going (`KNIGHTS.stuckTime`). The log line ("[troops] a knight ...") says which case it was.
- [x] Fifth test: the knights' first fight waits until the squad has reached its spot (or 15 s), then 3 goblins appear 32 cm out on its road and walk in; "Congratulations! Your knights won!" when they are gone.
- [x] Fifth test: random pauses. The Meta gesture check is stricter (palm straight at the eyes, within 45 cm, a hand holding nothing, kept 0.15 s) and the no-frames pause needs 1.5 s (was 0.75: one long hitch could pause). The FPS panel shows what caused a pause ("paused (menu gesture)", "focus lost", "no frames", "hidden").
- [x] Sixth test: the horn lesson goes one beat at a time: "Look around. The flag goes where you look." for at least 3.5 s of holding it, then "Now lift the horn to your mouth.", then "Spot set! Your knights will walk this path." for 2 s (the horn locks but waits, no bar), then "Blow into the horn!" with the bar (`TUTORIAL_TIMING.hornLookTime`, `hornLockedTime`, `Horn.waiting`).
- [x] Sixth test: fewer goblins before the horn: half the spawn rate after the basics, the horn after 2 eaten (or 30 s), then a breather with no new goblins until the board is clear (at most 12 s).
- [x] Sixth test: blow level 0.07 (0.1 was never reached, even by loud talking).
- [x] Seventh test: blow level 0.035 for 0.25 s (0.07 was still out of reach).
- [x] Seventh test: no goblins around the horn: after the basics only 3 come out (`hornGoblins`, half rate), then none until the horn lessons are over; the breather waits up to 25 s for a clear board.
- [x] Seventh test: "Look around" stays at least 7 s of holding the horn.
- [x] Seventh test: off the road, the look shows a crisp white ring with a dark edge and an arrow on the ground toward the nearest road (`HORN_AIM.offRoad`), drawn over the hills, instead of the faint grey glow.
- [x] Seventh test: gaze offset 12 degrees (was 7), so the head can stay level.
- [x] Eighth test: the bell still did nothing. Its stroke check is simpler now: every stroke that rings stuns, unless a stun is still running; a resting bell says so. Each case is a note on the debug page (`[bell] ...`), so if it fails again the note says why.
- [x] Eighth test: in the tutorial the knight squads march home after each wave's cheer (`Troops.sendHome`), so lessons start with an empty field. In the real game (Skip tutorial) they stay.
- [x] Eighth test: knights still ran in place, but the safety nets now bring them back. The debug page has a new "notes" column (`src/debug/notes.ts`): the last few knight, bell and pause notes from the headset, with the knight's mode, leg, its goblin's mode and distance, to find the real cause.
- [x] Ninth test: the debug keys are gone (the landing page list, the key codes, the key handling); the debug page does everything. The debug page is cleaned up: centered, every part in a card, tables that scroll sideways, stat tiles for the live run.
- [x] Ninth test: after a horn call, the called spot stays marked (gold pool, pillar, banner, path) until the squad arrives, then goes; the off-road ring no longer stays on the board after the call.
- [x] Ninth test: no wave goblins at all while a lesson runs, only the lesson's own.
- [x] Ninth test: the bell's ring sound is off, as a test: if the stun works without it, playing the sound broke the rest of that frame.
- [x] Tenth test: the horn lesson starts only once no goblin is left on the board (no time limit).
- [x] Tenth test: blow level 0.05 (0.035 was too easy).
- [x] Tenth test: in the tutorial every horn call sends a full squad of 5 (`Troops.fullSquads`), and the lesson's 3 goblins stop just in front of the squad and wait to be fought (`Goblin.holdRoad`), so none walks past; if the squad breaks anyway they walk on to the wall.
- [x] Eleventh test: the bell's code rewritten from scratch (only its model kept): one quick swing is a ring, it must slow down before the next, no ring right after the grab, the game does the stun (`Bell.onRing`), the sound comes last and guarded, and every ring leaves a debug note.
- [x] Eleventh test: a live loudness panel (`src/debug/micPanel.ts`, `MIC_PANEL`), like the FPS panel and right of front: the mic level now, the loudest in the last 3 s and since opened, and the blow line. Debug page "Mic panel on/off", or ?mic in the URL. Set `HORN.blowLevel` from its numbers.
- [x] Twelfth test: the bell made no sound at all: its swing line (55 cm/s) was never reached, likely because fast swings blur hand tracking. Back to 30 (what the old check rang at), and notes on each grab and put-down with the top swing speed, to tune it from real numbers.
- [x] Twelfth test: knights spread without a hard cap: a free knight takes the least crowded goblin near it, so none stands idle while goblins are near.
- [x] Thirteenth test: the bell's action works (debug ring), only the trigger failed. Trigger rewritten from the Meta docs (hands at 30 Hz, fast motion smoothed or lost): it reads the holding hand, only on tracked frames, and rings on distance from a slow anchor (3 cm), not on speed. Notes on each grab and put-down with the farthest swing.
- [x] Thirteenth test: no pause when the headset was taken off. The Quest 3S has no proximity sensor (Meta's VRC.Quest.Functional.2), so the game pauses itself: no hand tracked and the head still (3 mm, 0.4 degrees) for 5 s ("paused (headset off)").
- [x] Fourteenth test: the blow is one frame of raw loudness over 0.015 (no hold, no smoothing); the bar and the loudness panel show the same raw number.
- [x] Fifteenth test: after the horn sounds the bar stays full and gold for 1.5 s (`GLASS_SIGN.blownHold`), so the player sees the blow counted.
- [x] Fifteenth test: the spot locks only within 17 cm of the eyes (`HORN.mouthDistance`, was 24): a horn held at rest sometimes locked.
- [x] Fifteenth test: the lock follows the look. At the lips, a steady look at a road for 0.4 s locks it; looking more than 30 degrees away for 0.3 s unlocks it (soft click) and the spot follows the look again, so a spot locked by accident is never lost from view, and re-aiming needs no lowering of the horn (`HornAim.locked`, `Horn.atLips`).
- [x] Horn aim 7 degrees below where the head points (`HORN_AIM.gazeDropDeg`): the eyes rest a little below the head's direction, so the spot sat too far out.
- [x] Bell: one firm stroke stuns (and shows the shock ring); it needed two strokes within 0.7 s, so it often rang and did nothing.

### Run 2: the menus and the new UI (rescoped 2026-11-11)

**Only the menus and the UI around them.** The full design is in [menus.md](menus.md); build from it. Not in run 2: the tutorial rebuild, the first-use coach, the wave director and real levels, the map generator, tests.

Decided before the build (2026-11-11): Daily and Custom show "Coming soon"; Fight plays the normal battle without the tutorial with the loadout and saves stars; pepper stays in the tutorial's wave 4. Built 2026-11-11 on the branch `feat/v2-menus` (from `feat/v2`), not committed per step (the developer commits). Then reworked over several headset rounds the same day (round buttons only, the home screen placed between front and sides at the rampart's distance, a tap only level list with a slider, the level card redone with a grabbable 3D reward, free tool placement on the battle platforms, the pause panel's Menu button). **Tested on the headset 2026-11-11: everything works well.** Also on this run (headset tested too): the knights and goblins fight rewritten (section 2.7 note), the battle tools moved back behind the flags, the board 50 cm below the eyes, 4 waves. The full "as built" list is in [menus.md](menus.md#11-as-built-run-2).

- [x] **2.1 UI kit parts:** ~~a rectangular tile button, a red Fight tile~~ (built, then dropped: round buttons only), an upright option for `Slider` (kept, unused), a red Fight button with a sword icon. In `src/ui/kit/`, exported from its index ([menus.md](menus.md#7-ui-library-parts)).
  - Done: `PokeButton` `locked` (buzz, no click) and new icons (`sword`, `lock`, `campaign`, `daily`, `custom`, drawn by `src/ui/kit/menuIcons.ts`). `ScrollList` (`src/ui/kit/scrollList.ts`, `SCROLL_LIST`): swipe to scroll with coasting and spring back, or tap only and scrolled from outside (`scrollToShare`), hover and press looks, all rows drawn once into one canvas (a scroll only moves the window, so nothing blinks). `Slider` `vertical` turns its frame a quarter. `FightButton` (`src/ui/kit/fightButton.ts`): a bordered box `PokeButton` (`box` option), and `PokeButton.onRefuse` for a poke while locked.
- [x] **2.2 Level data:** the 15 level entries the menu reads (number, name, flavor, skulls, enemy icons, reward, open or locked), in a data file, rules in `src/rules/`. Levels 1 to 5 open, 6 to 15 text only.
  - Done: `src/config/levels.ts`. Level 3 unlocks the bell (decided 2026-11-11); levels 8 and 12 show a "???" reward (`'mystery'`), the rest none. A win unlocks the level's reward tool.
- [x] **2.3 Saving:** localStorage, one key: tutorial done, stars per level, levels open, unlocked tools, the loadout. Plus the star rules (70% and 35%, best kept) and the "Unlock all tools" switch in settings.
  - Done: `src/rules/campaign.ts` (`parseProgress` checks every field, so a broken save never breaks the game), `src/player/progress.ts` (key `tallTale.progress`). Also saved: where each tool stands on the shelf (`shelf`), the enemy kinds met (for "New!") and the tools grabbed once (a new tool glows until then). The loadout starts empty. The Access tab rows are 5.5 cm apart (was 6) to fit the fourth row.
- [x] **2.4 Tutorial to menu:** after the tutorial win, the battle (castle walls, towers, flags, battle-only things) sinks into the ground and the menu rises, both smooth. Fight plays it the other way. Later visits open on the menu. The bell is taken out of the tutorial (its wave and lesson), so the tutorial still runs to the end.
  - Done: `src/world/sceneSwap.ts`. `Battle.onEnd`, `onMenu`, `onSkip` let the game decide what follows a battle. Wave 5 has no `newTool` now. Decided: Skip tutorial goes to the menu.
- [x] **2.5 Main menu:** the front panel with buttons in different sizes. Settings opens the settings panel; Tutorial starts the tutorial.
  - Done: `src/ui/menu/mainMenu.ts`, a 36 x 32 cm grid of round buttons (Daily, Campaign, Custom; Settings, Tutorial), each word under its button.
- [x] **2.6 Campaign panel:** the split panel, the scrolling level list, the detail card (name, stars, skulls, flavor, enemies with "New!", reward, Fight), locked levels greyed with a lock, "More coming soon" at the end, a back button.
  - Done: `src/ui/menu/campaignPanel.ts`, 50 x 36 cm: a tap only `ScrollList` of level cards (no row buttons) scrolled by an upright `Slider` (swipe scrolling mixed up taps and swipes on the headset), the card in one padded column with labeled Best and Difficulty blocks, the reward as a small turning 3D copy of the tool, and `FightButton` (the one rectangular button). No enemies on the card (dropped). A locked level says "Beat level N to unlock" under Fight; with empty tool slots a poke on Fight shows the glass sign and a red arrow at the empty slot for 5 s. "Start here" was dropped.
- [x] **2.7 Tool shelf and loadout stand:** every tool on the shelf (locked ones grey with their unlock text), grab one to read its tag, put it on one of the 2 free stand slots (slingshot and horn fixed). The battle then shows only those 4 tools, on 4 platforms. Every new spot in `reachSpots()`, every held tool keeps its `HOLD.poses` grip.
  - Done: `src/ui/menu/shelves.ts` with display copies of the tools (`HandTool.displayModel()`, `Slingshot.displayModel()`, resting with `HandTool.restTurn()`). The stand is 4 battle platforms (`tower-hexagon-top.glb`), the shelf wooden pedestals, both on the right. Any tool on any place (`moveTool` in `src/rules/campaign.ts`: a swap when occupied), the snap zone glows green with a tick. In battle every tool stays on its own platform (moving the picks put one in front of the red flag); the flags moved to -39 and 39 degrees. A reward tool can be grabbed off the campaign card (a full-size copy, no effects). The pause panel got a Menu button and sizes itself to its buttons (`Panel.resize`, `rowPanelWidth`).
- [x] **2.8 Achievements shelf:** trophy slots, a "0 / 9" counter, a "???" tag on grab, "More coming soon".
  - Done: 9 Kenney trophies (`props/mini-arena/trophy.glb`, 6 cm, dimmed until earned) on two rows on the left.
- [x] **2.9 Docs** updated for run 2 (menus.md, controls-and-ui, modes-and-progression, mvp, README status).
- Known, not from run 2: `npm run typecheck` reports the Bell's private `ring` method clashing with `HandTool`'s private `ring` field (from run 1), and `director.test.ts` is stale.

### Next: the level generator and Custom Game ([custom-mode.md](custom-mode.md))

Decided 2026-11-11, **what we build next**, in place of the map generator and levels items of run 3 below (3.1, 3.2): one level generator for every level (headless, from the command line), winding roads as gameplay, the wave director, each level's own map loaded at Fight, rising camps (the tutorial too), all 15 campaign levels made with it (levels 1, 5, 6, 9, 14 and 15 reworked), registries instead of hardcoded kinds, self-describing settings, and the Custom Game menu with new UI kit parts. The full plan and build order are in [custom-mode.md](custom-mode.md).

### Run 3: content, then fixes

Moved here from the old run 2 (2026-11-11): the tutorial rebuild around the new mechanics (bell out, the leftovers in 2.12: pause lesson later, wave 5 text, about 8 to 10 minutes), the wave director and level format, levels 1 to 5, retry from the current wave, and the first-use coach (only once more tools exist).

- [ ] **3.1 Map generator** as a dev tool (seed and settings in, blueprint JSON out), following map.md section 8. Only if the levels need new maps.
- [ ] **3.2 Levels 1 to 5** built and polished, each with its twist, every tool unlock in them (assigned once the tools are final). Levels 6 to 15 stay text only.
- [ ] **3.3 One or two new tools** from 2.11, with their first-use lessons.
- [ ] **3.4 Riddle achievements:** a first set (about 9, including pepper then eat), riddle hints as in 2.10.
- [ ] **3.5 Fix list** from the developer's headset tests, sorted by what judges see first: tutorial, then menus, then levels.
- [ ] **3.6 Docs** updated for run 3.

---

## 4. Tutorial order and lessons

**Decided 2026-11-11:** the bell leaves the tutorial (it becomes an unlock). The tutorial then teaches the slingshot, the horn, the swatter and (still to confirm) the pepper: the 4 starting tools. The rest of this section is the older proposal.

**Built in run 1 (so the tutorial plays now):** wave 1 hands and the horn (taught mid wave, then the knights' first fight), wave 2 slingshot with the trigger and balloon lessons, wave 3 swatter, wave 4 pepper, wave 5 bell. The lines "tools rest after use" and "eating fills them" are in the first tool's grab lesson.

Proposed, to confirm after the run 1 headset test:

- **Tools:** slingshot, swatter, horn, bell. Pepper is the first campaign unlock.
- **One new thing per wave:**
  - Wave 1: hands (pinch, eat, throw) and **the horn** (calling the army gives wave 1 something to do).
  - Wave 2: slingshot (and the trigger and balloon lessons as now).
  - Wave 3: swatter.
  - Wave 4: bell.
  - Wave 5: everything together.
- **New lines to teach:** tools recharge (the ring), eating fills the rings, every goblin climbs (deal with the ones on top first), protect your archers.

---

## 5. Still open

- ~~Does the player pick their 3 tools per level, or does each level set them?~~ Decided 2026-11-11: 4 tools, slingshot and horn fixed, the player picks 2 (2.4).
- ~~Do triggers ignore armor?~~ Decided in 1.1: yes.
- Which of levels 1 to 5 unlocks which tool (once the tools are final).
- Pepper in the tutorial's wave 4 (section 4).
- The open items in [menus.md](menus.md#10-open).
- Which new tools to build in run 3.
- Final numbers: use and recharge times, refund shares, climb speeds, garrison refill, knight squad size, the bell's swing line and the horn's blow line (set them from the debug notes and the mic panel).

---

## 6. What this replaces

| Old (MVP docs) | New | Topic doc to update |
|---|---|---|
| Food currency, food jar, price tags, tools cost food | Free tools with use and recharge; eating fills the rings | giant-tools.md, mvp.md, controls-and-ui.md |
| Megaphone scream stun, bell as its voice-free twin | Bell is the only stun (knocks rampart goblins down); the horn calls knights | giant-tools.md, controls-and-ui.md, audio.md |
| Pepper: spear off, seasoned, push back | Pepper: disarms everything in a small area, short sneeze, no push back, seasoned | giant-tools.md |
| Spears for looks, helmets one hit, big hits go through | Helmet and shield each one extra hit for every hit, spear and sword with real effects | enemies.md, giant-tools.md |
| Climbers as their own type; grunts and runners only hit the wall | Every goblin bashes, climbs, runs on the rampart, then jumps in | enemies.md, core-loop.md, castle-rules.md |
| Squads every 14 s walk to the camp and back; archers in the field squads | Wall garrison (4 archers, 2 guards) on the rampart; field knights only by horn, holding the first junction | core-loop.md |
| Castle machines on hold | Dropped | castle-machines.md (history), README |
| Only the tutorial battle; modes later | Campaign of 15 levels (5 open), unlocks, saving, tool shelf, riddle trophies | menus.md, modes-and-progression.md, mvp.md, map.md |
| No loadout, every tool always on its platform | 4 tools per battle: slingshot and horn fixed, 2 picked; tools unlock in levels 1 to 5 | menus.md, modes-and-progression.md, giant-tools.md |
| A menu board with carved buttons; all modes open after the tutorial, no level unlocks | The battleground sinks into the home screen: a kit panel of round buttons in front, the tool shelf and loadout stand on the right, the trophies on the left | menus.md, modes-and-progression.md |
| Achievement hints for locked trophies | Riddles, with a hint after 2 battles since first read | modes-and-progression.md |
