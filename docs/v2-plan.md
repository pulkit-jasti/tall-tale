# Tall Tale v2: Plan and Decisions

Status: decided (2026-11-10), not built yet. Branch: `feat/v2`.

**This file wins over every other doc where they disagree.** The other docs describe the MVP as built. As each part below is built, update its topic doc (the "What this replaces" table says which) and tick it in the checklist here. When everything is folded in, this file is history.

Back to [GDD index](GDD.md).

---

## 1. The goal: win the hackathon

Everything is optimized for judging (Meta VR Start Developer Competition 2026, target submit Nov 16).

What judges actually see, in order:

1. **The tutorial (about 8 to 10 minutes).** For most judges this is the whole game. It must be complete, polished and show the most fun parts: eating, the slingshot, the swatter, the horn calling the army, the bell. It is also the "Best First Five Minutes" prize.
2. **The menus after the tutorial (about 1 minute of looking around).** This wins or loses "Best Reason to Come Back": a campaign path with 25 levels and tool unlock icons, the tool rack with locked tools, the trophy shelf with riddles, and "More coming soon" at the end of each.
3. **The demo video (under 3 minutes).** Shows what judges never reach: later levels, night battles, a tool unlock, a new tool.
4. **The Devpost write-up.**

So: the tutorial and the menus come first. Levels 1 to 3 must be good (a judge may press Play once). Levels 4 to 25 can be cheap variations. Levels unlock in order, so nobody jumps ahead to a repetitive level.

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

### 2.4 Loadout: slingshot plus 3

- A battle has **the slingshot plus 3 tools**.
- **The tutorial teaches slingshot, swatter, horn and bell** (proposed in section 4, confirm before run 2). **Pepper is the first unlock**, in the first campaign level with armored goblins, so it is learned when it is needed.
- **First-use lessons:** a tool learned after the tutorial gets its lesson the first time it is on the platforms in a battle (a small "first use coach" that reuses the tutorial's lesson steps in any battle).
- Open: does the player pick their 3 tools per level, or does each level set them? (section 5)

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
- **Runners dodge past them** with a quick hop.
- When the wave ends, they march home.
- The answer to each threat: a big group on a road is the horn; a crowded wall is the bell, pepper or hands.
- Field soldiers are swordsmen and spearmen only. Archers live on the rampart.

### 2.8 Campaign, unlocks and saving

- **Campaign: 25 levels**, unlocking in order. 25 shows there is a lot of content; judges will not play them all.
  - **Levels 1 to 3:** hand-made and polished.
  - **Levels 4 to 25:** made with our own map generator, then tweaked.
  - **Stars:** 1 to 3 per level from the castle health at the end (already designed in [castle-rules.md](castle-rules.md#star-rating)).
  - **Tool unlocks** spread evenly over the levels (one every 2 to 3 levels, depending on how many tools exist). A level that unlocks a tool shows the tool's icon on its card, and a "New!" moment after the win.
- **A level is data:** map blueprint + waves + loadout + tool unlock + twist (time of day, gear mix, triggers, enemy mix).
- **The map generator is our design tool, not a runtime feature:** seed and settings in, blueprint out (the rules in [map.md](map.md#the-level-generator-later-not-in-the-mvp)). We tweak the output and save each level as a fixed file, so every player gets the same tested level.
- **The wave director** reads waves from the level file (planned in [map.md](map.md#directors)). The tutorial keeps its own scripted director.
- **Saving:** localStorage, no backend. Levels done, stars, unlocked tools, achievements, riddle hint counts.
- **"Unlock all tools" switch** in settings, for judges. It unlocks tools only, never levels.
- **Retry from the current wave** after a loss, instead of the whole battle ([castle-rules.md](castle-rules.md#losing-should-feel-generous)).
- Endless, Daily Battle and Custom Game come later (Daily can force tools and conditions). The growing kingdom comes later.

### 2.9 Menus after the tutorial

All on the board, in the giant's own giant-sized style ([modes-and-progression.md](modes-and-progression.md#2-the-menu-is-the-board-in-peacetime)):

- **Campaign path:** 25 level cards (locked ones visible), stars on done levels, a tool icon on unlock levels.
- **Tool rack:** every tool, locked and unlocked. Grab an unlocked one and a small tag shows its name and one line, with its ghost demo looping beside it (reuse `src/ui/ghostDemos.ts`). A locked one is a grey silhouette with its unlock ("Beat level 6"). New tools glow until grabbed once.
- **Trophy shelf:** achievements (2.10).
- **"More coming soon"** as one locked card at the end of each list: levels, tools, achievements. One card per list, no more.
- Built from the UI library (`src/ui/kit/`), inside the reach band.

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
- **Wave 5 trigger reminder text** is never shown; fold it into the new tutorial.

---

## 3. Build plan: three runs

Each run is one long coding agent session. Inside a run, **commit after every step** (no push unless the developer says so), each commit passing `npm run typecheck`, `npm run build` and `npm test`. **Do not stop for headset tests inside a run.** Tick the checklist below and add a short note per step (what changed, anything decided along the way), so the next session or a summarized context has the facts. At the end of a run, stop and give the developer one headset check list for the whole run, with the debug actions for it.

The "Cloud build run" rule "Stop after step 1" in AGENTS.md does not apply to these runs.

Every new rule (cooldowns, refund, gear hits, climb steps, garrison refill, unlocks, stars, riddle hint counts) goes in plain TypeScript in `src/rules/` with a Vitest test, like the existing rules. Every new interactive thing goes in `reachSpots()`. Every new tool gets a `HOLD.poses` entry, a ghost demo that follows the AGENTS.md ghost rules, and debug actions in `DEBUG_ACTIONS`. Every new material on units gets the night rim.

**Before run 1 (developer):** run the stress test on the headset and log the result in [performance.md](performance.md), so the unit budget is known before archers and climbers are added.

### Run 1: core gameplay

The mechanics the tutorial will show. The tutorial must stay playable after this run (adjust its lessons and texts only as much as needed; the real rebuild is run 2).

- [ ] **1.1 Gear effects** (2.5): helmet and shield as separate extra hits for every hit including the swatter, spear double wall damage, sword faster kills on troops, goblin shields and swords, same rules for troop shields.
- [ ] **1.2 All goblins climb** (2.6): remove the climber type (wave counts become grunts and runners), the four steps, rampart goblins attack the garrison, the giggle cue, faster goblins.
- [ ] **1.3 Tools** (2.1 to 2.3): use windows and recharge rings, eating fills the rings, remove food cost, the food jar and the price tags, pepper rework, bell rework.
- [ ] **1.4 Horn** (2.3): replaces the megaphone, its own platform, hold at the mouth or blow into the mic, its ghost demo.
- [ ] **1.5 Field knights** (2.7): only through the horn, the charge, hold the first junction, runners dodge.
- [ ] **1.6 Wall garrison** (2.7): 4 archers and 2 guards on the rampart, refill every 15 s, visible arrows and volleys, archers back away, guards fight.
- [ ] **1.7 Stress test config** includes the garrison and a knight squad (`STRESS_TEST`), and the topic docs (giant-tools, enemies, core-loop, castle-rules, controls-and-ui, assets, placeholder-shapes) and the README history are updated for run 1.

### Run 2: everything judges see

Decide section 4 first (after feeling run 1 on the headset).

- [ ] **2.1 Tutorial rebuilt** around the new mechanics and section 4, including the leftovers in 2.12 (pause lesson later, wave 5 text, about 8 to 10 minutes).
- [ ] **2.2 First-use coach:** a tool's lesson the first time it is used in any battle.
- [ ] **2.3 Wave director and level format:** a level file (map + waves + loadout + unlock + twist), the director that runs it. **Levels 1 to 3 hand-made** (the tutorial map with different camps, time of day and gear mix is fine), pepper unlocked by level 2 or 3.
- [ ] **2.4 Saving and progress:** localStorage, levels done, stars, unlocked tools, the "Unlock all tools" switch, retry from the current wave.
- [ ] **2.5 Menus:** the menu board after the tutorial, the campaign path (25 cards, levels 4 to 25 locked and filled in run 3), the tool rack, the trophy shelf (with the first few trophies or empty slots), "More coming soon" on each list.
- [ ] **2.6 Docs** updated for run 2 (modes-and-progression, mvp, map, controls-and-ui).

### Run 3: content, then fixes

- [ ] **3.1 Map generator** as a dev tool (seed and settings in, blueprint JSON out), following map.md section 8.
- [ ] **3.2 Levels 4 to 25** generated and tweaked, each with a twist, the tool unlocks spread evenly, unlock icons on their cards.
- [ ] **3.3 One or two new tools** from 2.11, with their first-use lessons.
- [ ] **3.4 Riddle achievements:** a first set (about 9, including pepper then eat), riddle hints as in 2.10.
- [ ] **3.5 Fix list** from the developer's headset tests, sorted by what judges see first: tutorial, then menus, then levels.
- [ ] **3.6 Docs** updated for run 3.

---

## 4. Decide before run 2: tutorial order and lessons

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

- Does the player pick their 3 tools per level, or does each level set them?
- Do triggers ignore armor? (Proposed: yes.)
- Which levels unlock which tools (after run 1, once the tool count is known).
- Which new tools to build in run 3.
- Final numbers: use and recharge times, refund shares, climb speeds, garrison refill, knight squad size.

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
| Only the tutorial battle; modes later | Campaign of 25 levels, unlocks, saving, tool rack, riddle trophies | modes-and-progression.md, mvp.md, map.md |
| No loadout, every tool always on its platform | Slingshot plus 3 per battle; tools unlock in the campaign | modes-and-progression.md, giant-tools.md |
| Achievement hints for locked trophies | Riddles, with a hint after 2 battles since first read | modes-and-progression.md |
