# Enemies

Status: first set decided. Numbers and behavior details will be tuned in playtests.

Back to [GDD index](GDD.md). Related: [Giant tools and food](giant-tools.md).

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
- **Tough enemies wear their health as gear** that breaks off: helmet (one extra hit), shield (blocks from the front until broken), balloon (riders fall when popped).
- No health bars on regular enemies. A boss may get the only big bar in the game (boss is not designed yet).
- Breaking and death effects are described in [giant-tools.md, section 5](giant-tools.md#5-how-tools-hit-enemies).

---

## 3. Roster

### Grunt goblin

- **Question:** "Can you handle numbers?"
- **Behavior:** walks the road, fights troops, then stops at the wall and hits it (it does not climb).
- **Toughness:** one hit. Can wear a helmet for one extra hit.
- **Best answer:** fly swatter (groups).

### Shield goblin

- **Question:** "How do you get past a shield?"
- **Behavior:** carries a big round front shield that blocks hits from the front. Often walks in a wall formation.
- **Toughness:** shield must be broken or stripped first, then one hit.
- **Best answer:** pepper shaker (strips a whole group at once).
- **Also works:** slingshot (breaks one shield at a time, slow), grabbing by hand (shields do not stop hands), catapult (hits from above).

### Runner imps

- **Question:** "Can you react fast?"
- **Behavior:** tiny, fast, in big swarms. Rush past troops toward the wall, then hit it (they do not climb).
- **Toughness:** one hit.
- **Best answer:** fly swatter.
- **Also works:** arrow volley, megaphone, hands when they reach the wall.
- **Weak:** slingshot (too small and fast).

### Balloon riders

- **Question:** "Can you look up?"
- **Behavior:** float over the wall at about head height. Drop bombs on machines and carts, or drop goblins into the courtyard.
- **Toughness:** pop the balloon and the riders fall.
- **In the MVP (build step 7):** only the goblin drop into the courtyard (no bombs, since there are no machines or carts yet). First seen in wave 4. Details in [mvp.md](mvp.md#build-order).
- **Best answer:** slingshot.
- **Also works:** grab or swat when close, ballista, megaphone.
- **Weak:** pepper.

### Climbers

- **Question:** "Are you paying attention?"
- **Behavior:** the only enemy that climbs the wall. They climb unseen and suddenly pop up on the rampart, in reach. Up there they run about, causing chaos (since step 6): short dashes back and forth along the wall top between the two towers, with quick stops (`GOBLIN_RULES.rampartDash*`). If ignored for a few seconds, they jump down into the courtyard and become intruders. Tutorial climbers that wait for a lesson stand still.
- **Toughness:** one hit.
- **Best answer:** hands (grab and eat). They are also a main food source.
- **Also works:** swatter, pepper (seasoned for eating), cauldron.
- **Weak:** slingshot (too close).
- Every wave includes some climbers. In wave 1, one is scripted to climb right in front of the player so the eating moment happens in the first minute.

### Boom goblin

- **Question:** "Can you stop it before it arrives?"
- **Look:** a goblin with a big barrel strapped to its back and a lit, sparking fuse.
- **Behavior:** runs at your troops (or the wall if no troops are near) and explodes. Kills troops, and drops the flag if it hits the wall.
- **Toughness:** one hit, but hitting the barrel makes it explode where it stands.
- **Best answer:** slingshot (shoot the barrel early so it blows up its own group).
- **Also works:** pepper (it sneezes and drops the barrel, which becomes a powder keg on the road), megaphone (stunned in place, easy target), hands (if it reaches the wall, grab it and eat it, with a smoky burp), machines.
- **Weak:** swatter (works, but it explodes right at the wall and costs a bit of flag).
- **Chain reactions:** its explosion follows the same rule as powder kegs, so it can set off kegs, knock over trees and break bridges (see [map.md](map.md#5-triggers)).

### Tinker (support)

- **Question:** "Can you pick the key target?"
- **Look:** small goblin with a big backpack full of helmets and shields, and a hammer. Easy to spot.
- **Behavior:** stays behind a group. Every few seconds it hammers gear back onto a nearby goblin, with a clang and a puff.
- **Limits:** one piece at a time with a delay. Cannot bring back dead goblins.
- **Best answer:** slingshot (precise shot past the group).
- **Also works:** catapult splash, megaphone (stuns it mid-repair), pepper (sneezes, drops its hammer), hands if it gets close.

---

## 4. Answer matrix

★ = best, ✓ = works, ✗ = weak or does not work

| Enemy | Slingshot | Swatter | Pepper | Megaphone / bell | Hands | Machines |
|---|---|---|---|---|---|---|
| Grunt | ✓ | ★ | ✓ | ✓ | ✓ | ✓ |
| Shield | ✓ (slow) | ✗ | ★ | ✓ | ✓ | ✓ (catapult) |
| Runners | ✗ | ★ | ✓ | ✓ | ✓ (at the wall) | ✓ (arrow volley) |
| Balloons | ★ | ✓ (when close) | ✗ | ✓ | ✓ (when close) | ✓ (ballista) |
| Climbers | ✗ | ✓ | ✓ | ✓ | ★ | ✓ (cauldron) |
| Boom goblin | ★ | ✗ (explodes at the wall) | ✓ | ✓ | ✓ (at the wall) | ✓ |
| Tinker | ★ | ✓ (when close) | ✓ | ✓ | ✓ (when close) | ✓ (catapult) |

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
| Climbers during a big push | Deal with the wall top, or the main group? |

### Other dials per wave

- Group size
- Direction (which side, or several sides)
- Timing (lull vs burst)
- Goal (wall, carts, machines, troops)

---

## 6. Intruders (enemies inside the castle)

Enemies only get inside through mistakes:
- balloons dropping goblins into the courtyard
- climbers the player missed

What happens:
- **Workers panic.** The people inside the castle are workers, not troops, so they cannot fight. They drop what they are carrying and hide in buildings. Supply stops: carts freeze, machines are not reloaded, the pebble bowl stops filling.
- **Faster castle damage.** Intruders smash buildings and stalls, so the flag drops faster than from outside attacks.

How the player deals with them (the courtyard is fully in reach):
- Grab and eat.
- Swatter. Kills the intruders it hits.
- Pepper. They sneeze and are seasoned for eating.

When the courtyard is clear, workers peek out, cheer and wave at the giant, then go back to work.

---

## 7. Readability

- **Silhouette:** each type is recognizable from far away (round shields, tiny fast runners, balloons, the tinker's big backpack).
- **Color:** each type has its own color accent inside the palette.
- **Sound:** every enemy makes sound all the time while walking (grunting, cheering, marching, buzzing imps, balloon creaks, tinker clanging). It comes from their real direction and gets louder as they get closer. This is the main threat cue. See [core-loop.md](core-loop.md#3-direction-cues-sound-first).
