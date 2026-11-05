# Map, Roads and Environment

Status: first pass decided. Sample level mockup: `maps/castle-3d.html` (random layout on every reload, 1 unit = 1 cm). The mockup is older than these docs: it still shows castle machines, carts and flags on the towers. When they disagree, this file wins.

### Scale (from the mockup)

- Board height about 65 cm (placed about 46 cm below the eyes, low so the player towers over the kingdom, then set per player with the ring handle), hole the player sits in about 25 cm radius.
- These are the default sizes. The reach check at the start scales the whole board to the player's arms (0.85 to 1.45 times), see [controls-and-ui.md](controls-and-ui.md#reach-check-show-me-how-big-you-are-giant).
- Castle wall from 46 to 52 cm, **about 6 cm high** (the mockup still shows 40 to 46 cm and 10 cm high). Moved out after the step 4 review, as far as the reach band allows: climbers on the rampart (49 cm) stay in reach ([controls-and-ui.md](controls-and-ui.md#reach-band-where-interactive-things-go)).
- The courtyard (40 to 44 cm for intruders) is empty for now. Houses, stalls and workers come back once the main gameplay is done.
- Soldiers and goblins both about 3.9 cm tall (goblins raised from 3.5 after a headset test, soldiers from 2.5 after the step 6 test).

### No hidden strip outside the wall

- Seen from the seat, a wall hides a strip of board right behind it. With a 10 cm wall, goblins up to about 8 cm outside it would be fully hidden.
- **Default:** a lower wall (about 6 cm), and grunts and runners that hit the wall stand about 5 cm out from it. So enemies at the wall stay visible, and pepper and the swatter can be aimed at them.
- Check this in the toy test (build step 1) and adjust both numbers if needed.

Back to [GDD index](GDD.md). Related: [Enemies](enemies.md), [Giant tools](giant-tools.md).

---

## 1. Design rules

- **Simple to read, simple to build.** Every feature has a one-line rule, basic shapes, and very simple motion (slide, rotate, fall, puff).
- **Never compete with the tools.** Environment features only **kill, block or redirect** enemies on the roads. They never stun (megaphone), strip gear (pepper), pop balloons (slingshot), or work in the near zone (swatter, hands).
- **Natural, not symmetrical.** Maps should look like real land, not a pattern.
- **Some randomness, very little logic.** Enemies should not be fully predictable, but there is no real pathfinding.

---

## 2. The board

- The whole world is a raised round board at about hand height, like a big round table with a hole in the middle for the player.
- Flat around the castle, then rising gently toward the horizon so far enemies face the player.
- Hilly low-poly ground on top of that slope: rolling hills and dips from just past the wall (62 cm out), about 13 cm near the castle up to about 32 cm far out, flat only around the castle and right at the camps. The roads ride over the hills (softened to three quarters of their height on the road), so goblins can disappear behind a hill and pop up again: a surprise, on purpose (`TERRAIN` in config, `src/world/terrain.ts`).
- Where people live, placed with a reason (`SETTLEMENTS` in config, `src/world/settlements.ts`): villages of 3 to 5 houses around a little square, beside a road between the castle and the camps, on ground the terrain flattens for them; farm fields next to each village; watch towers on the hilltops beside the roads; one windmill on a hill by a field; wrecked siege machines near the enemy camps, left from old battles; forests out in the wild ring past the camps, where the tree groves grow. Out past the camps, in goblin lands: a goblin hamlet behind each camp, one kingdom village the goblins burned (roofless, ash on the ground), lumber camps at the forest edges, a stone quarry on a far hillside, and five tall landmarks on the highest far hills, spread around the circle (a tall watchtower, a hexagon mage tower, a gatehouse, a ruined tower, a small keep).
- Dense decor from the Nature Kit: groves of trees, rock piles, bushes, flower patches, mushrooms, stumps and logs, off the roads and camps (`DECOR` in config).
- The castle sits in the middle with a low wall (about 6 cm) at about 46 to 52 cm from the player, within reach.
- Zones: near (up to about 60 cm, in reach), middle (60 to 150 cm), far (beyond 150 cm).
- The board is always a full 360 degree circle. The player rotates it and sets its height with the ring handle (see [controls-and-ui.md](controls-and-ui.md#2-the-360-degree-board)).

---

## 3. Roads as a graph

Roads work like a subway map:

- **Points (nodes):** goblin camps, junctions, and entry points on the castle wall.
- **Roads (edges):** curves between points.

```
 camp        camp            camp
   \           |              /
    J ------- J -------- J        <- ring road (alternate routes)
     \       /  \        /
      K ----/    \------K         <- inner junctions
       \    \       /   /
        wall entry points
```

The diagram only shows how points connect. In the game, roads are gentle natural curves through a few in-between points.

### Layout

- Roads go all around the castle (full 360 degrees).
- Camps, junctions and wall entries are spread at uneven angles and distances, with random bends, so the map looks natural.
- A **ring road** links junctions sideways. It can have gaps.
- Each map is stored as a blueprint JSON file (section 8). Points are stored as angle and distance from the castle.

### Enemy camps

- Simple hills of sand and rocks that enemies climb out of.
- They come in different sizes. **Bigger camp, more enemies.** Players can read the threat at a glance.
- Proposed: a camp sinks a little as enemies come out, so it shows how many are left without any UI.

### Map patterns for variety

| Pattern | What it creates |
|---|---|
| Spokes (roads straight in) | Simple and readable. Good for level 1. |
| Fork and merge | Enemies split, then rejoin. Where do you defend? |
| Ring road | Enemies can slide sideways to another road and flank. |
| Closed shortcut | A road that opens mid-battle. Surprise. |

---

## 4. How enemies choose routes

1. Each wave, enemies spawn at one or more camps. A camp rumbles a few seconds before enemies come out. Sound is the main cue (see [core-loop.md](core-loop.md)). Visual cues like smoke are an accessibility option only.
2. Enemies walk a road to the next point.
3. **At a junction, they pick a branch by weighted random**, among open branches that lead closer to the castle. Shorter routes are a bit more likely.
4. **If a road is blocked** (fallen tree, broken bridge), it is removed from the choices. Enemies already on it turn back to the last junction.
5. At a wall entry point, grunts and runners stop about 5 cm out from the wall and hit it (so they stay visible, see "No hidden strip outside the wall" at the top). Only climbers climb it.

Extra randomness: which camp attacks, a small sideways offset per goblin, and small speed differences.

Fliers (balloons) ignore roads and drift in straight lines. Climbers sneak along the wall base.

### Under the hood

- Each point stores its distance to the castle. It is recalculated only when a road opens or closes. With 10 to 30 points this is instant.
- Enemies follow the pre-drawn road curves. No navmesh, no pathfinding. Very cheap on Quest.

---

## 5. Triggers

Shot with the slingshot. Each one happens once and resets between waves. A trigger glows or wobbles a little when the slingshot aims at it, so players know it can be shot.

| Trigger | Model | What it does | Animation |
|---|---|---|---|
| Powder keg | Barrel | Explodes and kills enemies in a small area | Puff and particles |
| Boulder | Sphere on a hill beside a road | Rolls onto the road and down it, killing everything in its line | Follows the road curve and spins |
| Leaning tree | Cylinder and cone | Falls across the road and blocks it for a few seconds. It hurts no one (since step 6): enemies on the road turn back and take another route. | One rotation, until its crown rests on the ground |
| Bridge | Planks over a stream or gap | Collapses. Enemies on it fall. The road closes until goblin builders rebuild it (about 15 to 20 s). Your troops cannot cross either. | Planks drop with the debris system |

**Build step 6 reworks them** ([mvp.md](mvp.md#build-order)): about 2 to 3 per road, bigger and brighter, on flat ground the terrain keeps for them (never hidden behind a hill), a pulsing glow and icon while goblins are near, and their own lesson in wave 2 right after the slingshot.

**How it works (step 5, `src/world/triggers.ts`):** each blueprint trigger sits on the road nearest its spot: the keg just beside the road, the boulder on a rock hill 8 cm off it, the tree 5 cm off it, leaning over it. Each stands from its tutorial wave on and resets at the start of every wave. They register with the slingshot as `SlingTarget`s, so the aim assist and the target glow work for them, and they wobble while aimed at. Only a slingshot shot or a goblin shot sets them off (thrown pebbles never do). The tree closes its road for 12 s (`RoadGraph.setOpen`), then poofs away. Numbers in `TRIGGERS`. Debug keys 7 (reset all) and 8 (set off all).

**Easy to notice (step 6):** in the step 5 playtest nobody noticed the triggers. Now there are 16 (6 kegs, 5 boulders and 5 trees, from wave 3, or from their own lesson in wave 2), about 4 on each camp's roads, all three kinds spread around the circle. **Each one tells its story with a prop in the world**, in the same red as the keg's bands, no floating UI and no odd colors: the keg itself (bigger now, 4.2 cm), a pale boulder wedged with a wooden chock, with an upright warning pole and a red rag flag on the hill beside it (they stay on the hill when it rolls), and a tree with autumn orange leaves (only the leaf triangles) and a red handled axe stuck in its trunk, on the side facing the castle. (A red stripe on the boulder, a slanted pry bar, and a recolored color map that also changed the trunk were tried first and looked odd.) The terrain is flat under each one and at two spots on the way from it toward the castle, so no hill hides it from the seat, and villages, towers and decor keep 16 cm clear (`TRIGGERS.ground`). While goblins are within 24 cm of one, it glows softly (emissive only, pulsing). When 2 or more goblins are within 12 cm, a short "now!" cue: a stronger pulse and a sound from its direction (at most every 6 s per trigger, `TRIGGERS.cue`). The keg and the boulder knock goblins out. The tree only blocks the road (it squashed goblins before step 6), comes to rest with its crown on the ground, and shrinks away when the road opens.

### Chain reactions

- **Off since step 6** (`TRIGGERS.keg.chainRadius` 0): each trigger only does its own thing, a keg never sets off a boulder or a tree. In the step 6 test a bug made one keg blow up every keg on the board, and players read even real chains as a bug. The code is kept: raise the radius to bring them back later.
- The idea for later: explosions set off nearby triggers. A keg can knock over a tree or break a bridge. A Boom goblin explosion does the same (see [enemies.md](enemies.md)).

---

## 6. Passive features

Always on. They change how a road plays.

| Feature | Model | What it does |
|---|---|---|
| Forest | Cluster of cone trees over a road | Enemies are hidden while inside, then pop out closer |
| Mud | Flat brown patch on a road | Enemies slow down. Easier target for machines. |
| Hill | Bump in the ground | Enemies slow going up, speed up coming down |

---

## 7. Decor

- Houses, trees, rocks, haystacks and fields scattered around the map, kept off the roads.
- **No gameplay function.** They only make the land look natural and lived in.

---

## 8. Levels and the level generator

### What makes levels play differently

| Dial | Effect on play |
|---|---|
| Number of camps | One camp = one threat direction. Two or three = split attention. |
| Camp distance | Far gives time to react. Near forces quick hand play. |
| Junctions | More junctions = less predictable routes, so the player watches longer before acting. |
| Triggers on routes | A keg or boulder on a busy road rewards timing. Off the road it is decoration. |
| Enemy mix and order | Grunts only is easy. Runners plus climbers during a push splits attention. |

### Three separate parts

A battle is built from three parts that never mix:

| Part | What it is | Format |
|---|---|---|
| **Map blueprint** | Where things are: camps (with size), junctions, roads and their in-between points, wall entries, the troop gate, trigger spots, decor | Static JSON file |
| **Director** | What happens when: spawns enemies, introduces tools, opens roads, ends the battle | Code |
| **Game systems** | How things behave: enemies, troops, tools, triggers, food, flags | Code, with tuning numbers in config files |

- The game only reads blueprints. It does not care whether a blueprint was written by hand or made by the generator.
- Directors only call the game systems (spawn enemy, show tool, open road). Nothing tutorial-only lives inside the systems.

### Blueprints

- **MVP: written by hand.** The tutorial map is one hand-made blueprint, `tutorial.json`.
- **Shortcut:** the mockup (`maps/castle-3d.html`) already makes random road layouts. Its output can be exported once as a starting point, then tweaked by hand.
- **A debug view** (top-down, or the mockup reading the blueprint) helps check a blueprint without the headset.

### Directors

- **Tutorial director (MVP):** a hand-written script in code. See [mvp.md](mvp.md#tutorial-director).
- **Wave director (later):** a simple runner that reads waves from a config file. Used by Endless, Daily Battle and Custom Game.

### Randomness

- All randomness goes through **one seeded random function**. The same seed always gives the same run, which makes bugs easy to repeat.
- **Inside a battle:** which camp spawns, route choices at junctions, timing jitter, small offsets per goblin.
- **The tutorial uses a fixed seed,** so every run plays the same and can be tested properly.

### The level generator (later, not in the MVP)

- A function: `(seed, settings) => blueprint`. Settings are **ranges, not single values** (for example 2 to 3 camps, camp distance 150 to 250 cm), and the generator picks inside them using the seed.
- It builds the map from **rules**, for example:
  - every road reaches the wall
  - a minimum distance between camps
  - each main road passes at least one trigger
- It outputs the same blueprint format as the hand-made tutorial map, so no game code changes.
- **Daily Battle** uses the date as the seed. **Endless** uses a random seed. **Custom Game** uses the player's settings and optional seed. Modes are described in [modes-and-progression.md](modes-and-progression.md).
- Built when the first mode after the tutorial is started.

### Map vs difficulty

- **Map and enemy mix = what you face:** enemy types, camps, features, combos. New problems, never just more health.
- **Difficulty settings = how much:** enemy count, spawn rate, speed, troop strength. Adjustable in Custom Game.

### MVP

- Only the tutorial battle: one hand-made blueprint, the tutorial director and a fixed seed. One biome (green fields). No generator.

---

## 9. Open questions

- Endless difficulty curve (see [modes-and-progression.md](modes-and-progression.md#7-open-questions)).
- Rebuild time for bridges and how long a fallen tree blocks a road.
- How the hidden gate for troops sits on the road graph.
