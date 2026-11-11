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
- **Archers** shoot outward at goblins walking in, within 100 cm, all together as a **volley** every 2.2 s. **Random hits, 55%**; a miss lands with a small puff (damage is decided in code, arrows have no hitboxes). They **back away** from goblins on the rampart and keep shooting; they do not fight up close.
- **Arrows are easy to see:** 7.5 cm (3 to 4 times longer than before), big white feathers, a short light streak, a 22 cm high arc so they rise against the sky. One instanced mesh plus one for the streaks, a pool of 16.
- **Guards** walk to goblins on their stretch of rampart and fight them up close.
- **Goblins on the rampart attack the garrison:** one next to a soldier stops and strikes it. An archer goes down in 2 hits. Protecting the archers is part of the player's job.
- Debug: key `-` takes two of them down (to watch the refill), key 9 turns all troops off and on.

### Field knights (stop goblins reaching the wall), only through the horn (`KNIGHTS`)

- **Blow the horn** ([giant-tools.md](giant-tools.md#war-horn-new-in-v2-replaces-the-megaphone)): the gate bursts open with a battle cry and dust, and **a squad of 4 to 5 (swordsmen and spearmen) sprints down the road in front of the player** (the wall entry nearest the front: spin the board to choose the road) at 2.5 times walking speed, the first one carrying a blue and gold banner.
- **They crash into the goblins** on that road: the first contact knocks up to 6 goblins within 12 cm back down the road (dazed), with a clash, a hit stop, a ring and a pow star.
- Then they **hold the first junction** on that road at least 120 cm out (on the tutorial map 124 to 140 cm), each on its own spot in two rows across the road, and fight everything that comes within 10 cm, until they fall or the wave ends. They never walk to the camp.
- **Runners dodge past them** with a quick hop.
- When the wave ends, they march home along their road and go back in.
- Blowing the horn again sends another squad (at most 10 field knights). Field soldiers are swordsmen and spearmen only; archers live on the rampart.
- The answer to each threat: a big group on a road is the horn; a crowded wall is the bell, pepper or hands.
- Debug key 6 sends a squad down the road in front (what the horn does).

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
