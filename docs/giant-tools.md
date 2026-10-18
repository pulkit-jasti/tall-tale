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
| Body abilities | Grab, flick, smash, eat. Always available | Hand reach |
| Food powers | Powers from eating specific enemies | Ideas only, not designed yet |

This file covers giant tools and the food currency that powers them.

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
- Each tool has a food cost. As long as you have enough food, you can use any tool in your loadout.
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

### Where food comes from

Food only comes from play, so smart play is rewarded.

**Hidden climbers**
- Every wave has some enemies that climb the wall unseen and suddenly pop up on the rampart, in reach.
- If ignored, they cause trouble (for example cut a cart rope or jam a machine).
- If grabbed, they are instant food. Eating is defense, not just a snack.

**Prisoner carts**
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
- Winning: troops capture more, so prisoner carts feed you.
- Losing: more enemies reach the wall, so more climbers come into reach.
- Either way food arrives through play, and a losing player gets more chances, not fewer. No death spiral.

**First five minutes**
- In wave 1, one goblin is scripted to climb the wall right in front of the player, so the eating moment happens in the first minute.

---

## 4. The tools

### Slingshot (starter, free)

- **Role:** precision. Breaks shields, pops balloons, hits single targets.
- **Zone:** middle and far.
- **Use:** pull back and release. Projectile path, so a short trajectory preview is fine here.
- **Cost:** no food. Uses pebbles from a bowl beside the player.
- **Limit:** soldiers keep topping up the bowl from a stone pile. The refill rate and the pull-back time limit spamming. The player always has one direct action, even with no food.

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
- **Calibration:** a quick test shout at the start sets the threshold per player, since mics and voices differ.
- **Quiet mode:** chosen at the start. Replaces the megaphone with the bell. Offered to everyone (speech difficulty, playing at night, around other people), so no one has to declare a disability.

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

## 6. Loadout and progression

- **Loadout:** the player picks giant tools before each battle. 1 slot at first, 2 early, 3 later.
- **Enemy preview:** the upcoming enemy types are shown before choosing, so the choice is informed, not a guess.
- **Starter tools** work on all enemies. **Specialist tools** are built to counter specific enemy types.
- **Each level unlocks one new enemy type and one new tool** that counters it. Introduced in the same level (the enemy appears, then the counter tool is given with a little moment), so every level ends with a win and a new toy.
- Loadout choice gets interesting once enemy types outnumber slots (around level 3 or 4).

### Draft level plan (not locked, enemies still to be designed)

| Level | New enemy | New tool | Slots |
|---|---|---|---|
| 1 | Goblins (basic) | Slingshot + body abilities | 1 |
| 2 | Shield goblins | Pepper shaker | 2 |
| 3 | Balloons | Fly swatter | 2 |
| 4 | River boats | (to decide) | 3 |
| 5 | Boss mix | Megaphone / bell | 3 |

### Scope

- About 4 weeks left. Target 4 to 5 levels, 2 starter tools, about 4 specialist tools, about 4 enemy types.
- Tools can share mechanics to save time.

---

## 7. Open questions

- Hidden strip below the outside of the wall: how pepper and other near-zone tools handle enemies the player cannot see there.
- Tribute food (non-enemy food like roast chicken after a good wave): yes or no.
- Does food carry over between waves and between battles?
- Exact food costs and bar size (tune in playtests).
