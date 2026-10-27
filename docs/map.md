# Map, Roads and Environment

Status: first pass decided. Sample level mockup: `maps/castle-3d.html` (random layout on every reload).

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
- The castle sits in the middle with a low wall (about 10 cm) at about 40 to 46 cm from the player, within reach.
- Zones: near (up to about 60 cm, in reach), middle (60 to 150 cm), far (beyond 150 cm).
- The board is always a full 360 degree circle. The player rotates it and sets its height with two-handed handles (see [controls-and-ui.md](controls-and-ui.md#2-the-360-degree-board)).

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
- Maps are made by the level generator (section 8). Points are stored as angle and distance from the castle.

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
5. At a wall entry point, they climb the wall.

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
| Leaning tree | Cylinder and cone | Falls across the road, squashes enemies under it, blocks the road for a few seconds. Enemies take another route. | One 90 degree rotation |
| Bridge | Planks over a stream or gap | Collapses. Enemies on it fall. The road closes until goblin builders rebuild it (about 15 to 20 s). Your troops cannot cross either. | Planks drop with the debris system |

### Chain reactions

- One rule: **explosions set off nearby triggers.**
- A keg can knock over a tree or break a bridge. A Boom goblin explosion does the same (see [enemies.md](enemies.md)).
- Simple rule, big surprising combos.

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

### One generator for everything

- **A level is a small JSON file:** generator settings plus a seed.
- The generator builds the map from **rules**, for example:
  - every road reaches the wall
  - a minimum distance between camps
  - each main road passes at least one trigger
  - climbers in every wave
- **Randomness inside a level:** which camp spawns, route choices at junctions, timing jitter, small offsets per goblin. Every replay feels a bit different.
- **The tutorial battle** uses a fixed seed we picked and tested, with hand-written waves.
- **Daily Battle** uses the date as the seed. **Endless** uses a random seed. **Custom Game** uses the player's settings and optional seed.
- Same code for all modes, so no extra work. Modes are described in [modes-and-progression.md](modes-and-progression.md).

### Map vs difficulty

- **Map and enemy mix = what you face:** enemy types, camps, features, combos. New problems, never just more health.
- **Difficulty settings = how much:** enemy count, spawn rate, speed, troop strength. Adjustable in Custom Game.

### MVP

- Only the tutorial battle (one fixed seed). One biome (green fields).

---

## 9. Open questions

- Endless difficulty curve (see [modes-and-progression.md](modes-and-progression.md#7-open-questions)).
- Rebuild time for bridges and how long a fallen tree blocks a road.
- How the hidden gate for troops sits on the road graph.
