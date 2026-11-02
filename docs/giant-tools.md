# Giant Tools and Food

Status: first pass decided. Numbers are starting values for tuning.

Back to [GDD index](GDD.md).

---

## 1. Where giant tools fit

The player's abilities are split into categories:

| Category | What it is | Limited by |
|---|---|---|
| Castle machines | Human-built war machines on the wall (catapult, cannon, arrow volley...), modified with chains, gears and buttons so the giant can run them | Supply carts, fixed wedge of coverage |
| **Giant tools** | Tools built for the giant. Handheld, used directly on the battlefield | Food currency |
| Body abilities | Grab and eat. Always available | Hand reach |
| Food powers | Powers from eating specific enemies | Ideas only, not designed yet |

This file covers giant tools and the food currency that powers them. Grab and eat are described in [controls-and-ui.md](controls-and-ui.md#3-grab-and-eat).

---

## 2. Design rules

- **Powerful but limited.** Giant tools can turn a battle, so their use must cost something. Otherwise they remove the challenge.
- **Counters are "much better", never "the only way".** A wrong pick should make a fight harder, not impossible.
- **Simple to use.** Handheld tools need no aiming UI and no area circles. The tool's own visuals show what it hits.
- **Each tool has a clear zone and role**, so tools do not overlap.
- **No refill for free.** Tool use is only refilled through play (eating), never by a timer or between waves.

---

## 3. Food currency

One shared food bar powers all giant tools (except the slingshot).

- Eating fills the bar.
- Each tool has a food cost. As long as you have enough food, you can use any unlocked tool.
- When the bar is empty, no tool can be used (the slingshot still works).
- The bar does not drain over time. It is a resource, not a hunger meter. The old hunger idea is replaced by this.

### Starting values

| Item | Food |
|---|---|
| Eat a basic goblin | +1 |
| Eat a seasoned goblin (peppered) | +2 |
| Pepper shaker | costs 3 |
| Fly swatter | costs 4 |
| Megaphone / bell | costs 6 |
| Food bar max | 10 |
| Food at the start of a battle | 4 |

- Food carries over between waves within a battle. It resets to the starting value at the start of each battle.

### Where food comes from

Food only comes from play, so smart play is rewarded.

**Hidden climbers**
- Every wave has some enemies that climb the wall unseen and suddenly pop up on the rampart, in reach.
- If ignored for a few seconds, they jump down into the courtyard and become intruders (see [enemies.md](enemies.md#6-intruders-enemies-inside-the-castle)).
- If grabbed, they are instant food. Eating is defense, not just a snack.

**Intruders**
- Goblins that get inside the courtyard (dropped by balloons, or missed climbers) are fully in reach and can be grabbed and eaten. See [enemies.md](enemies.md).

**Prisoner carts (on hold, not in the MVP)**
- Decide after the first playtest, based on how food feels and available time.
- Story reason: the kingdom's side of the deal is to feed the giant.
- Enemies that are stunned (megaphone) or disarmed (pepper) can be captured by nearby troops with a net.
- Troops wheel them back to the castle in a cage cart. The player lifts the cage lid, grabs a goblin and eats it.
- This creates the core loop:

```
use tools -> enemies stunned / disarmed -> troops capture them
    ^                                            |
    |                                            v
 spend food  <-  eat  <-  prisoner cart arrives at the castle
```

**Self balancing**
- Losing: more enemies reach the wall, so more climbers come into reach.
- A losing player gets more food chances, not fewer. No death spiral.
- With prisoner carts (later): winning also feeds you, because troops capture more.
- MVP: food comes only from climbers and intruders, so each wave must have enough climbers. The climber count per wave is in the tutorial wave table ([mvp.md](mvp.md#tutorial-waves)). Tune in playtests.

**First five minutes**
- In wave 1, one goblin is scripted to climb the wall right in front of the player, so the eating moment happens in the first minute.

---

## 4. The tools

### Slingshot (starter, free)

- **Role:** precision. Breaks shields, pops balloons, hits single targets.
- **Zone:** middle and far.
- **Use:** pull back and release. Projectile path, so a short trajectory preview is fine here (see aim assist below).
- **Cost:** no food. Uses pebbles from a bowl beside the player.
- **Limit:** soldiers keep topping up the bowl from a stone pile. The refill rate and the pull-back time limit spamming. The player always has one direct action, even with no food.

#### Slingshot aim assist

Most good VR slingshot and bow games have some. In order of importance:

1. **Steady release direction.** Hand tracking jitters when the fingers open, so use the average aim direction from the last ~100 ms before release, not the release frame. Matters most for hands.
2. **Trajectory dots** while pulling (like Angry Birds). Maybe only the first half of the arc, so some skill stays.
3. **Target glow:** the enemy (or trigger) about to be hit lights up while aiming.
4. **Gentle pull toward targets:** after release, the pebble bends slightly toward the nearest enemy within a small cone (about 5 to 10 degrees).
5. **Bigger hit area:** the pebble's hit area is a bit bigger than it looks.

Rules:
- The player should feel skilled, not see the game aim for them.
- Keep the assist weak on runners, since the slingshot is meant to be weak against them.
- Assist strength is a config number, tuned in playtests. A stronger assist can be an accessibility option later.

### Fly swatter

- **Role:** crowd clearing. Kills groups of basic goblins and gives the army a fighting chance.
- **Zone:** near zone and the edge of the middle zone (the swatter's length extends reach).
- **Use:** once activated, the player has about **10 seconds** to swat as many times as they want.
- **Cost:** 4 food.
- **Weakness:** cannot break shields or armor.
- **Hand tracking note:** fast swings can blur tracking. Detect hits along the whole swing path, use a generous hit area, and let slams count, not only fast swipes.

### Pepper shaker

- **Role:** strips defenses and seasons enemies for eating.
- **Zone:** near zone, at the wall.
- **Use:** shake over enemies for about **5 to 10 seconds**. Pepper falls where the hand is. The falling particles show where it lands, like seasoning real food. No aiming UI.
- **Effect:** enemies sneeze hard and drop shields, helmets and weapons (gear flies off). Basic goblins with no gear sneeze and stumble back a little.
- **Seasoned:** every peppered enemy counts as seasoned and gives +2 food when eaten. Funny, and a possible achievement ("seasoned before eating").
- **Cost:** 3 food.
- **Combo:** pepper a shield group at the wall, then swat them, let the rampart machines finish them, or eat them.

### Megaphone (voice) / Bell (quiet mode)

- **Role:** panic button. Stuns every enemy on the battlefield.
- **Zone:** everywhere.
- **Use (megaphone):** one scream. Mic loudness is tracked. Passing the threshold triggers the stun. Louder and longer means a stronger effect (longer stun). Then the megaphone is used up.
- **Use (bell):** shake the bell. Harder shaking means a stronger effect. Same result, hands only.
- **Cost:** 6 food (most expensive).
- **Mic permission:** asked on the 2D start page, before entering VR (see [controls-and-ui.md](controls-and-ui.md#4-menus)).
- **Calibration:** a quick test shout at the start sets the threshold per player, since mics and voices differ.
- **MVP: both on one platform.** The megaphone and the bell sit side by side on the same platform. Using either one triggers the stun and costs the 6 food once. So the game is fully playable without voice from the first build.
- **No mic:** if the player denied mic permission, the megaphone is shown tied down and the bell still works.
- **Quiet mode (later):** chosen at the start. Hides the megaphone so only the bell is shown. Offered to everyone (speech difficulty, playing at night, around other people), so no one has to declare a disability.

### Summary

| Tool | Zone | Effect | Duration | Food |
|---|---|---|---|---|
| Slingshot | Middle, far | Precise hits, breaks shields, pops balloons | Per shot | Free |
| Fly swatter | Near, edge of middle | Kills basic goblins, no shield break | ~10 s | 4 |
| Pepper shaker | Near (wall) | Strips gear, seasons for eating | 5 to 10 s | 3 |
| Megaphone / bell | Everywhere | Stuns all enemies | One use | 6 |

---

## 5. How tools hit enemies

- **No health bars** on normal enemies. Health bars turn the game into math and clutter the view.
- **Basic enemies die in one hit.**
- **Tough enemies wear their health** as gear that breaks off: helmet (one extra hit), shield (blocks from the front until broken), balloon (riders fall when popped), armor pieces.
- **Bosses** get one big health bar. It is the only health bar in the game.
- So tools differ by **what they can do** (break shields, hit groups, strip gear, stun), not by damage numbers.

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

- **No loadout.** There is no tool choice before a battle. Every unlocked tool is always on its platform.
- **The tutorial battle introduces one tool per wave.** A tool's platform stays empty until its wave. Then the tool appears on it with a poof and glows until the player grabs it once. No text. After the tutorial every tool is always available in every mode. No gating (see [modes-and-progression.md](modes-and-progression.md)).
- Custom Game and daily twists can limit tools (for example "pepper only").

---

## 7. Tool platforms and display

### Platforms

- Tools sit on small platforms beside the player: **2 on each side**, slightly forward (about 45 degrees off center), not straight out to the sides. Easy to grab without twisting, and visible at the edge of view.
- 4 spots, one per tool: the slingshot plus the 3 food tools.
- **The platforms stay with the player.** They do not turn when the board rotates (see [controls-and-ui.md](controls-and-ui.md#2-the-360-degree-board)).
- The player chooses which side the slingshot sits on (handedness setting).

### Using and returning

- **Grabbing is free. First use costs food** (first swat, first shake, first scream). Accidental grabs never waste food.
- **When the use is over**, the tool shrinks, poofs and reappears on its platform.
- **If dropped mid-use**, it floats back to the hand area after about 1 second. Its timer keeps running.
- **Not enough food:** the tool looks dimmed or tied down with a little rope, so it reads as locked without any text.

### Cost and food display

- Each platform shows the tool's cost as **food pips** on its front, not numbers. Pips the player can afford light up.
- The **food meter is an object**: a jar or basket beside the tool platforms that fills with little food items. The player sees it naturally when reaching for a tool.
- No floating panels in front of the player. The battlefield stays clear. See [controls-and-ui.md](controls-and-ui.md).

---

## 8. Open questions

- Tribute food (non-enemy food like roast chicken after a good wave): yes or no.
- Exact food costs, starting food and bar size (tune in playtests).
