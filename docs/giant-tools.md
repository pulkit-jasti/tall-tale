# Giant Tools

Status: v2 (run 1 built, 2026-11-10, see [v2-plan.md](v2-plan.md)). Numbers are starting values for tuning. The food currency, food jar and price tags of the MVP are gone.

Back to [GDD index](GDD.md).

---

## 1. Where giant tools fit

The player's abilities are split into categories:

| Category | What it is | Limited by |
|---|---|---|
| **Giant tools** | Tools built for the giant. Handheld, used directly on the battlefield | A use window, then a recharge |
| Body abilities | Grab, throw and eat. Always available | Hand reach |
| Food powers | Powers from eating specific enemies | Ideas only, not designed yet |

Castle machines are dropped (v2, [castle-machines.md](castle-machines.md) stays as history). This file covers the giant tools. Grab and eat are described in [controls-and-ui.md](controls-and-ui.md#3-grab-and-eat).

---

## 2. Design rules

- **Powerful but limited.** Giant tools can turn a battle, so each has a short use window and then a recharge. The player chooses which tool to use when, instead of using one favorite all the time.
- **Counters are "much better", never "the only way".** A wrong pick should make a fight harder, not impossible.
- **Simple to use.** Handheld tools need no aiming UI and no area circles. The tool's own visuals show what it hits.
- **Each tool has a clear zone and role**, so tools do not overlap.
- **Two hands are a natural limit too:** the slingshot needs both, a held tool means that hand cannot grab a goblin, and eating needs a free hand.

---

## 3. Use windows and recharge (v2)

Tools are free. Rules in `src/rules/recharge.ts`, numbers in `TOOLS` in `src/config/game.ts`.

| Tool | Use | Recharge |
|---|---|---|
| Slingshot | always | none |
| Swatter | 10 s | 20 s |
| Pepper | 8 s | 20 s |
| Bell | one stun | 35 s |
| Horn | one call | 30 s |

- **The use window starts with the first use** (the first swat, shake, ring or blow), not the grab, so an accidental grab never wastes it.
- **The recharge starts when the tool is back on its platform**, and only fills while it rests there.
- **How it shows:** while recharging, the tool is dimmed (the Locked look) and a flat ring on its platform fills up in blue. While a use runs, the ring drains in cream. Hidden while the tool is ready. Readable with the sound off. A hand near a recharging tool shows Locked, and closing the hand buzzes and wobbles it.

### Eating fills every recharge ring

- **Each goblin eaten fills every recharging tool's ring by 10% of that tool's full recharge** (a 30 s recharge gets 3 s back). A **seasoned** (peppered) goblin fills 20%.
- All rings jump forward together with the gulp (a white flash on each ring and a chime), so it is easy to see.
- It never shortens or extends a use window, and never makes a ready tool "more ready".
- **The balance idea:** more goblins means more to eat, faster tools, and more power to clear the wave. If the snowball is too strong in playtests, lower the share (`TOOLS.eatRefill`, `seasonedRefill`), not the idea.
- Eating is also the only way to deal with goblins in the courtyard without tools.

**Where the goblins to eat come from:** every goblin climbs the wall now ([enemies.md](enemies.md)), so there is always something on the rampart in reach, plus intruders and balloon riders dropped into the courtyard.

**First five minutes:** before wave 1, one goblin is scripted to climb the wall right in front of the player, so the eating moment happens in the first minute.

---

## 4. The tools

### Slingshot (starter, free)

- **Role:** precision. Breaks shields, pops balloons, hits single targets.
- **Zone:** middle and far.
- **Use:** pull back and release. Projectile path, so a short trajectory preview is fine here (see aim assist below).
- **Cost:** free, no timer, always in the loadout. Uses pebbles from a bowl beside the player.
- **Limit:** soldiers keep topping up the bowl from a stone pile. The refill rate and the pull-back time limit spamming. The player always has one direct action, even with every other tool recharging.
- **How it works (step 2, changed after the first slingshot headset test):**
  1. Grab the slingshot's handle with either hand (fist or pinch, like the ring handle, with the same short open-hand wait first). It follows that hand, so the player aims by turning the hand and the body, which is faster than fine moves with one hand. Once the pouch is pulled, the slingshot locks where it is until the shot, and the aim comes only from the pulling hand. The holding hand is often hidden behind the pulling hand then, and its guessed pose must not move the shot.
  2. Pinch a pebble from the bowl and bring it to the pouch. Close enough, it clicks into the pouch and stays there however the slingshot moves. Let go. A pebble let go over the bowl goes back in. Let go anywhere else, it keeps the hand's speed, like a tossed goblin (see "Thrown pebbles" below).
  3. Pinch the pouch with the free hand, pull back and let go to shoot. A short pull (under 4 cm) or a shot toward the player's face does not shoot.
  - **Hidden hands:** pulling straight back can hide the holding hand behind the pulling hand. Then the slingshot stays where it is for a moment instead of dropping, and during a pull the holding hand never lets go because it looks open (its fingers are only guessed). If the pulling hand is lost, the pouch waits at its last spot. When the hand comes back, the pull goes on if the pinch reads again, or is cancelled. It never shoots by itself. Numbers are `holdLostGrace`, `pullLostGrace` and `pullSettle` in `SLINGSHOT`.
  - Letting go of the handle glides the slingshot back to its platform. A loaded pebble stays in. It also shoots while it rests on the platform, so it works with one hand.
  - No auto reload. An empty pouch or an empty bowl shows Locked (wobble and buzz). The pile in the bowl shrinks as pebbles are taken and refills over time.
  - Pebbles are 2.5 cm with a 4 cm hit area. One hit knocks out a bare goblin; a helmet or a shield takes one hit each (v2, see section 5). If aiming is still too hard, the next step is a bigger goblin hit box. Numbers are in `SLINGSHOT`, `AIM_ASSIST` and `PEBBLE_BOWL` in `src/config/game.ts`.
- **Thrown pebbles:** a pebble thrown by hand only knocks the goblin it hits back a little, dazed for a moment. It never knocks one out, so the slingshot keeps its job (range and knock outs). It buys a second near the wall. A slow let go just drops the pebble and does nothing. Thrown pebbles will not set off triggers (powder kegs, boulders, trees), so those stay a slingshot moment. Numbers are in `PEBBLE_THROW`.
- **Goblin shot:** a held goblin brought to the empty pouch clicks in like a pebble. Shot, it tumbles through the air, hits the goblin it lands on (v2: armor counts, like every hit), knocks back the goblins within about 8 cm of the impact (dazed), and poofs. Landing without a hit still knocks back the goblins around it. It costs a goblin the player could have eaten (and the recharge it would have given), so it is a choice. Numbers are in `GOBLIN_SHOT`. Debug key J loads one, L shoots it.

#### Slingshot aim assist

Most good VR slingshot and bow games have some. In order of importance:

1. **Steady release direction.** Hand tracking jitters when the fingers open, so use the average aim direction from the last ~100 ms before release, not the release frame. Matters most for hands.
2. **Trajectory dots** while pulling (like Angry Birds), all the way to the impact, plus a semi transparent circle on the ground where the shot will land (under the goblin's feet when it will hit one). The full line was chosen after the first slingshot headset test, so the player knows exactly where it goes. `dotShare` in `AIM_ASSIST` can shorten it again.
3. **Target glow:** the enemy (or trigger) about to be hit lights up while aiming.
4. **Gentle pull toward targets:** after release, the pebble bends slightly toward the nearest target within a small cone (10 degrees, raised from 7 to make up for hand tracking jitter). Targets are goblins and every other thing meant to be shot (boulder, leaning tree, powder keg and anything later), which register with the slingshot as a `SlingTarget`. Everything shot with the slingshot gets this, pebbles and goblin shots alike. A pebble thrown by hand gets half the bend, toward goblins only.
5. **Bigger hit area:** the pebble's hit area is a bit bigger than it looks.

Rules:
- The player should feel skilled, not see the game aim for them.
- Keep the assist weak on runners, since the slingshot is meant to be weak against them.
- Assist strength is a config number, tuned in playtests. A stronger assist can be an accessibility option later.

### Fly swatter

- **Role:** crowd clearing. Kills groups of basic goblins and gives the army a fighting chance.
- **Zone:** near zone and the edge of the middle zone (the swatter's length extends reach).
- **Use:** the first swat starts a **10 second** window to swat as many times as the player wants, then a 20 s recharge.
- **Armor (v2):** a helmet or a shield takes one swat each (it flies off and the goblin reels back); it is no longer a special big hit.
- **Hand tracking note:** fast swings can blur tracking. Detect hits along the whole swing path, use a generous hit area, and let slams count, not only fast swipes.
- **How it works:** it rests on the left side platform, leaning back 18 degrees along the rim, so its head is behind the left shoulder. Grab the handle with a fist (`TOOLS.acceptPinch` allows a pinch too, if the fist tracks poorly). A swat is the head touching a goblin, or the ground on the way down. The first swat starts the use window. Each swat hits every goblin within 6.5 cm of the head's path since the last frame, at any speed above 35 cm/s, so slow slams count. After armor takes a hit the goblin shrugs off hits for 0.35 s (`GOBLIN_GEAR.hitGrace`), so one swing over several frames takes one piece. It already works on goblins on the walls and the rampart. Numbers are in `SWATTER` and `TOOLS` in `src/config/game.ts`. Debug key 2 swats the front of the wall.

### Pepper shaker (reworked in v2)

- **Role:** disarms. The power is the disarm, balanced by the small area and the recharge.
- **Zone:** near zone, at the wall and on the rampart (a small area under the shaker).
- **Use:** the first shake starts an **8 second** window, then a 20 s recharge. Pepper falls where the hand is. The falling particles show where it lands, like seasoning real food. No aiming UI.
- **Effect:** every goblin under it is **disarmed: weapon, shield and helmet fly off**, so it becomes a one-hit goblin. It sneezes for a few seconds (5 s) and cannot attack meanwhile (no wall hits, no bashing, no attacks on the garrison). **No push back, no throw:** it sneezes where it is (one on the rampart or in the courtyard stops a moment).
- **Seasoned:** every peppered goblin is seasoned and fills the recharge rings twice as much (20%) when eaten. Pepper then eat is one of the achievements later.
- **How it works:** it rests on the front left platform. Grab it with a fist and shake it: a quick move that turns back on the one before is one stroke, and two strokes within 0.7 s are a shake, so no hand pose is needed. While shaking, pepper specks fall straight down from the shaker, and every goblin within 7 cm of the spot below it is peppered once (`Goblins.pepper`, `Goblins.disarm`): it sneezes, its gear flies off and it turns a dusty brown (seasoned). Numbers are in `PEPPER` and `TOOLS`. Debug key 3 peppers the front of the wall.

### Bell (reworked in v2)

- **Role:** panic button, the only stun.
- **Zone:** everywhere.
- **Use:** shake it. **Every goblin on the board is stunned**, and **every goblin on the rampart is knocked back down outside the wall** (it lands dazed, walks back and climbs again later). It does not disarm. One stun per use, then the longest recharge (35 s). Hands only, no voice.
- **How it works:** it rests on its own platform on the left (-56 degrees, where the food jar was). Grab it with a fist (held like a real one, `HOLD.poses`) and ring it: every stroke that rings (a quick move that turns back) stuns, unless a stun is still running (it often rang and did nothing before). The debug page's notes say what each ring did. The stun lasts 3.5 s plus up to 2 s for a hard shake (`STUN`). Its use window is only 1.2 s, then it goes back. Stunned goblins freeze, play `emote-no` and get two dizzy stars over the head, and a shock ring runs across the board. Goblins knocked off the rampart fly out with a squeal (`Goblins.knockOffRampart`). Numbers in `BELL`, `STUN` and `TOOLS`. Debug key 5.

### War horn (new in v2, replaces the megaphone)

- **Role:** calls the field knights ([core-loop.md](core-loop.md#2-troops)) to a road spot the player picks by looking at it. Up to 4 squads; at the limit the squad nearest the spot moves there.
- **Aim, lift, blow:**
  1. **Aim:** while it is held (low, nothing in front of the eyes), the head aims it: a glowing pool, a light pillar and a ghost banner on the road show where the knights will go.
  2. **Lift it to the lips:** the spot locks (gold, a click, the path along the roads lights up). Lowered again, it unlocks.
  3. **Blow into the mic:** a blow counts only while it is locked at the lips and the loudness stays over 0.035 for about 0.25 s (tuned over several headset tests: 0.06, 0.04, 0.05, 0.1 and 0.07 were each too hard or too easy), so breathing, talking or room noise does not trigger it. A **live bar** in front of the eyes shows the blow against the white line it has to pass (green below, gold over it), so the player sees their breath doing something. With the mic on, holding it there never fires it, so aiming is never cut short. With the **Quiet horn** setting (or no mic), keeping it at the lips for 1.2 s sends them, so voice is never required.
- **The cue goes where the eyes go** (the glass sign, `GLASS_SIGN`, `src/ui/kit/glassSign.ts`; in the horn lesson it carries the lesson's text, and the hint sign steps away): the horn aims by gaze, so the player may look anywhere, and a change of text on the fixed sign was missed. While it is held, a small label floats a little above the look's center (never over the aimed spot) and follows the look: "Look at a road", "Lift it to your lips", then "Blow!" with the live bar (or "Hold it there" with the quiet horn's progress).
- One call per use: its use window and its 30 s recharge start only when it sounds, never on the grab.
- **Mic permission** stays on the 2D start page, for the horn. The megaphone and its scream are gone. The settings' Accessibility tab has the **Quiet horn** switch (always on without a mic).
- **The model never covers the view:** a curved ivory hunting horn with brass bands, held from below: the mouthpiece on top of the grip toward the face, the body curving forward and down past the fist, the bell low and a little to the side (`HORN.curve`). Near the face it fades to see-through (15% at the lips). It rests on the right side platform (82 degrees), standing on its bell. Held like the megaphone was (`HOLD.poses.horn`). Little puffs come out of the bell while the call charges. Sound: the `waveHorn` war horn. Code `src/tools/horn.ts`, numbers in `HORN`. Debug key 4.

### Summary

| Tool | Zone | Effect | Use | Recharge |
|---|---|---|---|---|
| Slingshot | Middle, far | Precise hits, pops balloons, sets off triggers | Per shot | None |
| Fly swatter | Near, edge of middle, rampart | Hits groups (armor takes a hit) | 10 s | 20 s |
| Pepper shaker | Near (wall, rampart) | Disarms everything, seasons | 8 s | 20 s |
| Bell | Everywhere | Stuns all, knocks the rampart down | One stun | 35 s |
| War horn | The road in front | Calls a knight squad | One call | 30 s |

---

## 5. How tools hit enemies

- **No health bars** on normal enemies. Health bars turn the game into math and clutter the view.
- **Basic enemies die in one hit.**
- **Tough enemies wear their health** as gear that breaks off (v2, rules in `src/rules/gear.ts`): **helmet** one extra hit, **shield** one extra hit, counted separately (helmet and shield: 3 hits). This counts for **every hit**: pebble, arrow, soldier, swatter, goblin shot. **Triggers (keg, boulder, tree) ignore armor**, they are the big environmental hits. Balloons: riders fall when popped.
- **Weapons have real effects:** a **spear** doubles wall damage, a **sword** strikes soldiers faster in a fight.
- **Pepper strips all of it** (section 4).
- **The same rules apply to our troops:** a soldier's shield is one extra hit.
- **Bosses** get one big health bar. It is the only health bar in the game.
- So tools differ by **what they can do** (hit groups, disarm, stun, call knights), not by damage numbers.

### Juice for hits (kept light for performance)

- All effect motion is code-driven math, not animation files or physics.
- **Gear breaking off:** the piece detaches, flies in an arc with a spin, bounces once, shrinks away in about 1 second.
- **Enemy death:** white hit flash (1 to 2 frames), squash and stretch, spinning launch arc, then a puff of colored particles and stars. Never just vanish.
- **Swatter kill:** quick squash on impact, then the same poof.
- **Hit-stop:** 2 to 3 frame freeze on big hits.
- Particles are instanced. Debris comes from a pool with a hard cap (for example 20 pieces at once). Extra ones skip the flight and just poof.
- Rule: real physics only for things you grab. Math-based motion for all juice.

---

## 6. Unlocks and progression

- **v2 (run 2, not built yet):** a battle has the slingshot plus 3 tools, and tools unlock in the campaign ([v2-plan.md](v2-plan.md#24-loadout-slingshot-plus-3)). Until then every tool comes in the tutorial.
- **The tutorial battle introduces one tool per wave.** A tool's platform stays empty until its wave. Then the tool appears on it with a poof and glows until the player grabs it once, and the tutorial's hint sign teaches it step by step (see [mvp.md](mvp.md#tutorial-director)). Run 1 order: the horn before wave 1, the slingshot in wave 2, the swatter in 3, the pepper in 4, the bell in 5. The first tool's grab lesson says tools rest after use and eating fills the ring.
- Custom Game and daily twists can limit tools (for example "pepper only").

---

## 7. Tool platforms and display

### Platforms

- Tools sit on small platforms beside the player, slightly forward, not straight out to the sides. Easy to grab without twisting, and visible at the edge of view.
- 5 spots, one per tool (v2): the slingshot, the swatter, the pepper, the bell and the horn.
- **The platforms stay with the player.** They do not turn when the board rotates (see [controls-and-ui.md](controls-and-ui.md#2-the-360-degree-board)).
- The player chooses which side the slingshot sits on (handedness setting).

### Using and returning

Shared by every hand tool (`src/tools/handTool.ts`). Recharge rules are plain functions in `src/rules/recharge.ts`.

- **Grabbing is free. The first use starts the use window** (first swat, shake, ring or blow). Accidental grabs never waste it.
- **When the use is over**, the tool shrinks, poofs and reappears on its platform, then recharges there (the ring fills).
- **If dropped mid-use**, it glides back to its platform like any other time. Its use window keeps running, and it can be grabbed again there.
- **In the tutorial, the use window waits:** while a tool's use lesson runs, its window is held, and a tool still recharging from an early use is made ready when the lesson starts. The lesson is done when one goblin is hit, anywhere (the horn: when it sounds). Then the window starts with its full time (`timerHeld` in `src/tools/handTool.ts`).
- **Recharging:** dimmed colors (the Locked look) and the ring on the platform filling. A hand near it shows Locked (wobble), and closing the hand buzzes instead of grabbing. The tied-down rope remains for a tool the game ties down (none for now).
- **End of a use:** the tool blinks during the last 2 seconds of a long use (swatter, pepper), so the end is no surprise.

### Layout and the ring

- **The ring** (`TOOLS.ring`): flat on the platform top around the tool's base, a dark track with a colored fill. One mesh per ring, the fill is a draw range, so it costs nothing to change. Unlit, so it reads at night.
- **Layout (v2):** slingshot front right (30 degrees) with the pebble bowl beside it (58), horn right side (82), pepper front left (-30), bell left (-56, where the food jar was), swatter left side (-82). All **just outside the ring handle**, 33.5 cm from the seat, with low platforms (tops 6 cm above the board), in the reach band ([controls-and-ui.md](controls-and-ui.md#reach-band-where-interactive-things-go)). They rise and fall with the board but never turn, so the ring never passes through them. The flags stand just behind them (38.5 cm) (`TOOL_SPOTS`, `PEBBLE_BOWL`). The food jar and the price tags are gone (v2).
- No floating panels in front of the player. The battlefield stays clear. See [controls-and-ui.md](controls-and-ui.md).

---

## 8. Open questions

- Exact use and recharge times and refill shares (tune in playtests).
- Loadout: does the player pick their 3 tools per level, or does each level set them? ([v2-plan.md](v2-plan.md#5-still-open))
