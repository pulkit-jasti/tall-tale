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

## 2. Troops (basic behavior)

- **Spawn:** squads of 3 to 4 soldiers come out of a hidden gate at the front of the castle every few seconds. Cap of about 15 on the board.
- **Movement:** they walk the road graph outward toward the camp that is attacking. Same road system as enemies, in reverse.
- **Fighting:** when an enemy is close, both stop and fight with simple timed hits. Soldiers take 2 hits, grunts take 1.
- **At the wall:** grunts and runners that get past them stop at the wall and hit it. Only climbers climb.
- **Balance target:** on their own, troops lose slowly. The player is always needed, but never overwhelmed.

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
- The few enemies closest to the player get their own sounds, for example a climber's giggle right before it pops up.
