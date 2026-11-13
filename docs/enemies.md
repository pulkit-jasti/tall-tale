# Enemies

Status: first set decided, v2 run 1 built (2026-11-10, [v2-plan.md](v2-plan.md)): every goblin climbs, gear has real effects. Numbers and behavior details will be tuned in playtests.

Back to [GDD index](GDD.md). Related: [Giant tools](giant-tools.md).

---

## 1. Design rules

- **Every enemy is a question, every tool is an answer.** Each enemy type asks the player something different.
- **Best answer, never the only answer.** Each enemy has one best answer, one or two weak spots, and everything else works normally.
- **Hands are the universal backup.** Grabbing and eating works on almost everything, but only in reach. So there is always a way, at the cost of letting enemies get close.
- **Harder through new problems, not bigger health.** Difficulty comes from new types and combos, never from tankier versions of the same enemy.
- **Non-human and cartoony.** Goblins and other creatures. No blood or gore.

---

## 2. How enemies are built

Every enemy is made from three simple parts. Mixing them gives a lot of variety from little work.

| Part | What it sets | Examples |
|---|---|---|
| Body | Speed and size | Grunt, runner |
| Gear | Visual health layers | Helmet, shield, balloon |
| Goal | What it goes after, so how urgent it is | Wall, carts, machines, troops |

### Toughness (no health bars)

- **Basic enemies die in one hit.**
- **Tough enemies wear their health as gear** that breaks off (v2, `src/rules/gear.ts`): **helmet** one extra hit, **shield** one extra hit, counted separately, so helmet and shield take 3 hits. This counts for every hit, the swatter too; only triggers (keg, boulder, tree) ignore armor. Balloon: riders fall when popped.
- **Weapons:** a **spear** doubles wall damage, a **sword** strikes soldiers faster in a fight. **Pepper strips everything** (weapon, helmet, shield).
- Gear mix (`GOBLIN_GEAR`): grunts carry a spear (40%), a sword (25%) or nothing, helmets from wave 3 (35%), shields from wave 4 (30%). Runners stay bare handed. Kenney's sword and round shield models, merged into the goblin's skinned mesh like the spear and helmet (`src/units/gear.ts`).
- No health bars on regular enemies. A boss may get the only big bar in the game (boss is not designed yet).
- Breaking and death effects are described in [giant-tools.md, section 5](giant-tools.md#5-how-tools-hit-enemies).

### Every goblin climbs (v2)

There is no separate climber type any more. Every goblin that reaches the wall goes through four steps, each more dangerous than the last (`src/rules/climb.ts`, `GOBLIN_RULES`):

1. **Bash the wall** for about 5 s (plus or minus 20%), on a stretch between two towers: wall damage and the red wall flash.
2. **Climb:** grunts 2 cm/s, runners 4 cm/s, a helmet slows it to 1.5 cm/s (`GoblinStats.climbSpeed`, `helmetClimbSpeed`). The wall is 6 cm high.
3. **Run around on the rampart** for about 8 s: no castle damage, but they **attack the wall garrison** ([core-loop.md](core-loop.md#2-troops)). A giggle (`goblinCackle`) plays where one pops up, a sound cue for where to look.
4. **Jump into the courtyard** as intruders (the biggest damage).

So the player always knows the order: deal with the ones on top first. Goblins can no longer hide behind the wall, there is much more to eat, and armored goblins come close enough for the pepper. Variety comes from runners, gear and balloons. The red wall flash and the red threat arrow stay, as helpers. Goblins walk faster too (grunts 7.5 cm/s, runners 15).

---

## 3. Roster

### Grunt goblin

- **Question:** "Can you handle numbers?"
- **Behavior:** walks the road, fights troops, bashes the wall, then climbs (v2, see above).
- **Toughness:** one hit. A helmet or a shield is one extra hit each, against every hit but triggers (v2).
- **Best answer:** fly swatter (groups), the horn's knights on its road.

### Shield goblin

- **Question:** "How do you get past a shield?"
- **Behavior:** carries a big round front shield that blocks hits from the front. Often walks in a wall formation. (v2 run 1: grunts already carry a round shield for one extra hit; the front-blocking shield goblin is not built.)
- **Toughness:** shield must be broken or stripped first, then one hit.
- **Best answer:** pepper shaker (strips a whole group at once).
- **Also works:** slingshot (breaks one shield at a time, slow), grabbing by hand (shields do not stop hands), catapult (hits from above).

### Runner imps

- **Question:** "Can you react fast?"
- **Behavior:** tiny, fast, in big swarms. Rush toward the wall, bash it, then climb fast (4 cm/s). Like every goblin, one that comes within 16 cm of a field knight stops and fights it (v2 run 2: they used to hop past).
- **Toughness:** one hit.
- **Best answer:** fly swatter.
- **Also works:** the garrison's arrows, the bell, hands when they reach the rampart.
- **Weak:** slingshot (too small and fast).

### Balloon riders

- **Question:** "Can you look up?"
- **Behavior:** float over the wall at about head height. Drop bombs on machines and carts, or drop goblins into the courtyard.
- **Toughness:** pop the balloon and the riders fall.
- **In the MVP (build step 7):** only the goblin drop into the courtyard (no bombs, since there are no machines or carts yet). First seen in wave 4. Details in [mvp.md](mvp.md#build-order). Built: two grunts stand in each balloon's basket (`BALLOONS`, `src/units/balloons.ts`). A popped balloon's riders fall and poof. Riders can be pinched off, swatted or knocked out one by one, and a stun stops the balloon in the air.
- **Best answer:** slingshot.
- **Also works:** grab or swat when close, the bell (a stunned balloon stops).
- **Weak:** pepper.

### Climbers (no longer their own type, v2)

- Every goblin climbs now (section 2). On the rampart they run about, causing chaos: short dashes back and forth along the wall top between the two towers, with quick stops (`GOBLIN_RULES.rampartDash*`), and they stop to fight a garrison soldier next to them. If ignored for about 8 s, they jump down into the courtyard and become intruders. Tutorial lesson goblins that wait stand still.
- **Best answer on the rampart:** hands (grab and eat, which also fills the tool rings), the bell (knocks them all back down), the guards.
- **Also works:** swatter, pepper (disarmed and seasoned for eating).
- **Weak:** slingshot (too close).
- Before wave 1, one is scripted to climb right in front of the player so the eating moment happens in the first minute (`Goblins.spawnClimberAt`, a bare handed grunt).

### Boom goblin

- **Question:** "Can you stop it before it arrives?"
- **Look:** a goblin with a big barrel strapped to its back and a lit, sparking fuse.
- **Behavior:** runs at your troops (or the wall if no troops are near) and explodes. Kills troops, and drops the flag if it hits the wall.
- **Toughness:** one hit, but hitting the barrel makes it explode where it stands.
- **Best answer:** slingshot (shoot the barrel early so it blows up its own group).
- **Also works:** pepper (it sneezes and drops the barrel, which becomes a powder keg on the road), bell (stunned in place, easy target), hands (if it reaches the wall, grab it and eat it, with a smoky burp), machines.
- **Weak:** swatter (works, but it explodes right at the wall and costs a bit of flag).
- **Chain reactions:** its explosion follows the same rule as powder kegs, so it can set off kegs, knock over trees and break bridges (see [map.md](map.md#5-triggers)).

### Tinker (support)

- **Question:** "Can you pick the key target?"
- **Look:** small goblin with a big backpack full of helmets and shields, and a hammer. Easy to spot.
- **Behavior:** stays behind a group. Every few seconds it hammers gear back onto a nearby goblin, with a clang and a puff.
- **Limits:** one piece at a time with a delay. Cannot bring back dead goblins.
- **Best answer:** slingshot (precise shot past the group).
- **Also works:** catapult splash, bell (stuns it mid-repair), pepper (sneezes, drops its hammer), hands if it gets close.

---

## 4. Answer matrix

★ = best, ✓ = works, ✗ = weak or does not work

v2: castle machines are dropped; the horn (knights) and the bell take their columns.

| Enemy | Slingshot | Swatter | Pepper | Bell | Horn (knights) | Hands |
|---|---|---|---|---|---|---|
| Grunt | ✓ | ★ | ✓ | ✓ | ★ (a group on a road) | ✓ |
| Armored grunt (helmet, shield) | ✓ (slow) | ✓ (3 swats) | ★ | ✓ | ✓ | ✓ |
| Runners | ✗ | ★ | ✓ | ✓ | ✓ (they stop and fight, slowed by nothing else) | ✓ (on the rampart) |
| Balloons | ★ | ✓ (when close) | ✗ | ✓ | ✗ | ✓ (when close) |
| Goblins on the rampart | ✗ | ✓ | ✓ | ★ (knocked down) | ✗ | ★ |
| Boom goblin | ★ | ✗ (explodes at the wall) | ✓ | ✓ | ✓ | ✓ (at the wall) |
| Tinker | ★ | ✓ (when close) | ✓ | ✓ | ✓ | ✓ (when close) |

The answer to each threat: a big group on a road is the horn; a crowded wall is the bell, pepper or hands.

---

## 5. Combos

Most of the variety and strategy comes from mixing enemy types in one wave, not from new types.

| Combo | The question it creates |
|---|---|
| Shield wall + tinker | Pepper alone fails because the tinker re-gears them. Shoot the tinker first, then pepper. |
| Balloons carrying runners | Pop them early, or the swarm drops inside the castle. |
| Grunts with helmets | Same enemy, a bit tougher. A reason to use the slingshot. |
| Boom goblins inside a group | Shoot the barrel early and the group blows itself up. Wait too long and they reach your troops. |
| Boom goblin near a powder keg or bridge | One shot sets off a chain reaction. |
| Attacks from two sides at once | Where do you turn first? |
| Goblins on the rampart during a big push | Deal with the wall top (they attack your archers), or the main group? |

### Other dials per wave

- Group size
- Direction (which side, or several sides)
- Timing (lull vs burst)
- Goal (wall, carts, machines, troops)

---

## 6. Intruders (enemies inside the castle)

Enemies only get inside through mistakes:
- balloons dropping goblins into the courtyard
- goblins on the rampart the player missed (every goblin climbs, v2)

What happens:
- **Workers panic.** The people inside the castle are workers, not troops, so they cannot fight. They drop what they are carrying and hide in buildings. Supply stops: carts freeze, machines are not reloaded, the pebble bowl stops filling.
- **Faster castle damage.** Intruders smash buildings and stalls, so the flag drops faster than from outside attacks.

How the player deals with them (the courtyard is fully in reach):
- Grab and eat.
- Swatter. Kills the intruders it hits.
- Pepper. They are disarmed, sneeze and are seasoned for eating.

When the courtyard is clear, workers peek out, cheer and wave at the giant, then go back to work.

---

## 7. Readability

- **Silhouette:** each type is recognizable from far away (round shields, tiny fast runners, balloons, the tinker's big backpack).
- **Color:** each type has its own color accent inside the palette.
- **Sound:** every enemy makes sound all the time while walking (grunting, cheering, marching, buzzing imps, balloon creaks, tinker clanging). It comes from their real direction and gets louder as they get closer. This is the main threat cue. See [core-loop.md](core-loop.md#3-direction-cues-sound-first).
