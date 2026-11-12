# Core Loop and Pacing

Status: decided as a starting point. All numbers are base values to tune in playtests.

Back to [GDD index](GDD.md). Related: [Castle rules](castle-rules.md), [Map](map.md), [Enemies](enemies.md).

---

## 1. Waves

- A battle is a series of waves. The tutorial battle has 5 waves in about 8 minutes, each introducing something new. Daily Battle is about 5 waves, Endless runs until the flag falls. See [modes-and-progression.md](modes-and-progression.md).
- **Tension and release comes from a gentle intensity curve inside each wave**, not from long waits.
- Each wave (about 60 to 90 seconds):
  1. **Warning:** camps rumble a few seconds before enemies come out.
  2. **Build:** small groups walk in.
  3. **Peak:** the big push and the combos.
  4. **Release:** the last enemy falls. Big juice, a cheer, and the wave flag climbs a notch.

### Short breathers, no long gaps

- Between waves there is only a short breather of about 5 to 10 seconds: release juice, workers cheer, soldiers raise the castle health flag a little, then the next wave's sounds start. In the tutorial, the next wave's new tool appears on its platform during the breather.
- No long prep phase, because there is nothing to build or prepare yet. A longer gap can come back later if prep features are added (for example machines).

---

## 2. Troops

v2 (run 1 built, [v2-plan.md](v2-plan.md#27-the-army-field-knights-and-the-wall-garrison)): two clear jobs, so the army never looks dumb. No squads come out on their own any more.

- **Fighting:** simple timed hits. A soldier strikes every 1.4 s and lands half of them, a goblin strikes back every 1.1 s (a sword faster, x0.6) and lands 60%. Soldiers take 2 hits, a shield is one more (it flies off). Goblins take 1, a helmet and a shield one more each (`src/rules/gear.ts`).
- **At the wall:** every goblin that gets past bashes the wall, then climbs ([enemies.md](enemies.md#every-goblin-climbs-v2)).
- **Balance target:** on their own, troops lose slowly. The player is always needed, but never overwhelmed.
- The swatter, pepper and bell never hurt troops, and the army leaves the tutorial's lesson goblins alone.

### Wall garrison (defends the wall, `src/units/garrison.ts`, `GARRISON`)

- On the rampart: **6 at most, 4 archers and 2 guards** (swordsmen), one per stretch of wall between two towers (guards at the front and back, archers between). Full at every battle start.
- When there are fewer than 6, **one new one climbs up the inner side of the wall from the courtyard every 15 s** (archers first) until there are 6 again.
- They walk along the rampart (one angle on a ring, no road pathfinding, cheap), inside their own stretch, toward the nearest threat.
- **Archers** shoot outward at goblins walking in, within 60 cm (85 reached almost to the end of the first ring of roads), all together as a **volley** every 2.2 s. An arrow is weaker than a blade: **two arrow hits make one hit** (a bare goblin knocked out, or a helmet or shield off). **Random hits, 55%**; a miss lands with a small puff (damage is decided in code, arrows have no hitboxes). They **back away** from goblins on the rampart and keep shooting; they do not fight up close.
- **Arrows are easy to see:** 4.5 cm (7.5 was too long), big white feathers, a short light streak, a 16 cm high arc so they rise against the sky. One instanced mesh plus one for the streaks, a pool of 16.
- **Guards** hunt goblins anywhere on the rampart (they walk past towers, 8 cm/s) and fight them up close until they are out. A fallen guard is replaced after 30 s (archers 15 s), so helping them matters.
- **Goblins on the rampart attack the garrison:** one next to a soldier stops and strikes it. An archer goes down in 2 hits. After its rampart time a goblin hunts the nearest soldier, and **it only jumps into the courtyard once no soldier is left on the wall.** Protecting the garrison is part of the player's job.
- **No new goblins come out while any are inside the castle**, so intruders must be dealt with at once.
- Debug page: one button takes two of them down (to watch the refill), another turns all troops off and on.

### Field knights (stop goblins reaching the wall), only through the horn (`KNIGHTS`)

- **Aim the horn by looking** ([giant-tools.md](giant-tools.md#war-horn-new-in-v2-replaces-the-megaphone), `HORN_AIM`, `src/ui/hornAim.ts`): whenever it is held, the head points it. The look ray points 12 degrees below the head's direction (`gazeDropDeg`), since the eyes rest a little low and the head can then stay level. Where it meets the ground, the spot snaps to the nearest road (within 22 cm): a soft glowing pool on the road, a light pillar up from it and a see-through ghost banner show where the knights will go. The spot moves to a new place only after it is looked at for 0.2 s (Meta's gaze consensus window), so it never flickers. No road in sight: a white ring with a dark edge shows where the look is, with an arrow on the ground toward the nearest road; no banner, and the horn will not lock or blow. At the lips, a steady look (0.4 s) locks the spot: gold, a click, and the path the knights will take lights up along the roads. Looking away from it unlocks it, and the next steady look locks again.
- **Blow it:** the gate bursts open with a battle cry and dust, and **a squad of 3 to 5 (random; swordsmen and spearmen) sprints along the roads to that spot** from the nearest wall entry (shortest way over the road graph, `src/rules/roadRoute.ts`) at 2.5 times walking speed, the first one carrying a blue and gold banner in its left hand (its shield put away; if it falls, another picks the banner up).
- **The squad fights as one (v2 run 2 rewrite):** a squad sees every goblin within 22 cm of any of its knights (`senseRadius`), on the way out and at its spot, and **every knight not fighting goes for one of them** (the least crowded, the nearest), so no knight walks up and falls alone while the rest stand by. **On the way out they fight every goblin they meet first**, then step back onto the road and go on to the spot (never to the spot first and back again).
- **They crash into the goblins:** the first knight to reach a goblin on the way out knocks up to 6 goblins within 12 cm back (dazed), with a clash, a hit stop, a ring and a pow star.
- **No goblin walks past them:** every goblin on the field within 16 cm of a field knight (`goblinSense`), runners too, stops, turns to it and fights instead of going on to the castle; it waits there until a knight takes it on.
- Then they **guard the spot**, each on its own place in two rows across the road, fighting what the squad sees, never farther than 35 cm from their place (`leash`), then walk back.
- **Up to 4 squads** (`maxSquads`, a level setting later). At the limit, blowing the horn **moves the squad nearest the aimed spot** there instead (each knight from where it is, along the roads; a new crash there too). While aiming at the limit, that squad's banner pulses bigger and lighter blue, so the player sees which one will answer.
- **A squad down to 1 knight breaks:** the last one marches home and the place is free for a new squad.
- **Squads stay between waves** (they are the army in the field). Only a new battle clears them. In the tutorial they march home after each wave's cheer, so the next lessons start with an empty field.
- **Balance:** knights spread out: a free knight takes the goblin near it with the fewest knights on it (the nearest of those), so a squad splits over a group, and once every goblin is taken the rest still join in (a hard cap of 2 left knights idle and let a goblin walk past). Knights land 35% of their blows (`strikeChance`, guards 50%), armor takes hits, and every horn call costs the horn's 30 s recharge. So squads slow and thin a group; they do not win alone.
- Field soldiers are swordsmen and spearmen only; archers live on the rampart. Troops at most 26 (`TROOPS.max`: 4 squads of up to 5 plus the garrison of 6).
- The answer to each threat: a big group on a road is the horn; a crowded wall is the bell, pepper or hands.
- The debug page's horn button does what the horn does, aimed at the road about 130 cm out in front.

### On hold (not in the MVP)

- Picking up troops and placing them by hand.
- Troops capturing stunned or disarmed enemies (prisoner carts).

---

## 3. Direction cues: sound first

- **Sound is the main cue.** Players listen for the direction and look there. This is a skill, and part of the fun.
- **Camps rumble** a few seconds before enemies come out, so there is time to turn and look.
- **Enemies make sound all the time while walking** (grunting, cheering, marching, buzzing). It comes from their real direction and **gets louder as they get closer.** This is the clearest feedback for the player.
- **Each type sounds different**, so sound also tells what is coming, not just where.
- **Visual cues (smoke, glow)** are an accessibility option only, off by default. See [controls-and-ui.md](controls-and-ui.md).

### Performance

- 40 to 80 enemies each playing their own sound is too many sound sources for Quest.
- One sound emitter per group (for example a squad on a road), with volume based on group size and distance.
- The few enemies closest to the player get their own sounds, for example the giggle (`goblinCackle`) where a goblin pops up on the rampart (built in v2, at most every 0.6 s).
