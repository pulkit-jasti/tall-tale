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

- Roads go all around the castle (360 degrees in the full mode).
- Camps, junctions and wall entries are spread at uneven angles and distances, with random bends, so the map looks natural.
- A **ring road** links junctions sideways. It can have gaps.
- Maps are written by hand as data files (angle and distance from the castle for each point). Because points use angles, the same map can be squeezed or spread to fit the 120, 180 and 360 degree modes.

### Map patterns for variety

| Pattern | What it creates |
|---|---|
| Spokes (roads straight in) | Simple and readable. Good for level 1. |
| Fork and merge | Enemies split, then rejoin. Where do you defend? |
| Ring road | Enemies can slide sideways to another road and flank. |
| Closed shortcut | A road that opens mid-battle. Surprise. |

---

## 4. How enemies choose routes

1. Each wave, enemies spawn at one or more camps. Camps telegraph first (drums, smoke, banners).
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

## 8. Levels

- 4 to 5 handcrafted levels with rising difficulty, each tuned to be as satisfying as possible.
- One biome (green fields) for the competition.
- Each level changes the road layout, camp positions and features.
- Use 2 to 4 features per level, and introduce one new feature per level.

---

## 9. Open questions

- Exact layouts for each of the 4 to 5 levels.
- Rebuild time for bridges and how long a fallen tree blocks a road.
- How the hidden gate for troops sits on the road graph.
