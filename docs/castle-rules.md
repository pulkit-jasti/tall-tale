# Castle Rules: Win and Lose

Status: decided for the first build.

Back to [GDD index](GDD.md). Related: [Enemies](enemies.md), [Map](map.md).

---

## 1. Win and lose

- **Win:** survive all waves of the battle.
- **Lose:** the castle health flag reaches the bottom of its pole.
- **The giant cannot be hurt.** Only the castle takes damage. This keeps the rules simple.

---

## 2. The flag and the compass ring

A tall flagpole on the inner rim on the left, just outside the ring handle, slightly in front of the player, and the compass ring low in front. (The blue wave flag on the right was dropped 2026-11-11: nobody noticed it. The compass shows the wave instead.)

- **They stay with the player, like the tool platforms.** They do not spin with the board, so they are always in front of the player and never have to be searched for (see [controls-and-ui.md](controls-and-ui.md#2-the-360-degree-board)).
- The health flag has no numbers: it works like a progress bar built into the world.

### Castle health flag (red)

- Starts at the top. Slides down the pole as the castle takes damage.
- The flag tears and smokes as it gets low.
- **Repair:** during the short breather between waves, tiny soldiers at the base of the pole pull the rope and raise the flag a little. Part of the damage heals, not all of it.
- Later: small notches on the pole mark the star thresholds (stars are not in the MVP).

### Compass ring (replaces the blue wave flag, 2026-11-11)

- **3D since 2026-11-12:** an 11 cm brass compass dish on a short post straight in front, 37 cm out by the wall and 7 cm up, nearly flat like a compass on a table (`COMPASS`, `src/ui/compass.ts`). The first, flat disc sat low just outside the ring and hid under it from the seat. The pause and Next buttons moved to the blue flag's old spot on the right to make room (34 degrees since everything moved nearer the front, was 39). Only looked at, never touched.
- **Rim wedges show where enemies come from, early**, relative to the player (a gold needle points straight ahead, so the marks move round as the board spins). 32 wedges pointing in. **Color is how close:** a camp whose drums have started (amber pulse), goblins far on the roads (dim red), near (red, inside 150 cm), at the wall, climbing, on the rampart or inside (bright red, blinking); the wedges beside a threat light one level lower. **Height is how many goblins** are in that direction (up to 6 counted), gliding as it changes. The red threat arrow stays as the last warning.
- **Tents on the lip:** one for every camp that is up (a camp still under the ground has none), dim while quiet, amber and bobbing while its drums play. So the player knows where the camps are before they send.
- **Tipped 35 degrees toward the eyes** (2026-11-12: nearly flat was hard to read). More goblins in a direction make its wedge taller and also longer and wider (reaching in from the lip), since height reads less on a tipped dish. Idle wedges (dark grey) are the empty directions: nothing there.
- **The middle shows the goblins left in the wave as one big number** with a skull in front of it (Kenney Board Game Icons, so it never reads as a random number; the code-drawn goblin head was removed) on a raised brass boss (the main information), a gold tick between waves and after the last, and a row of dots under it, one per wave (gold won, white the one being fought, hollow to come). Was three lines of small text. A canvas redrawn only when a number changes; the wedges and tents are two instanced meshes, so they cost no canvas redraws.
- Shown only while a battle is fought. The tutorial explains it before the first wave, right after the red flag.

### Wave flag (blue, dropped 2026-11-11)

- It climbed one notch per wave. Nobody noticed it; the compass ring's numbers replace it.

### Rejected

- **Five flags around the wall:** too much visual clutter.
- **Flags on the castle towers:** they spin away with the board, so the player has to search for them.
- **Damaged wall sections with gameplay effects** (weaker sections, breaches): too complex, and losing would snowball.

---

## 3. What damages the castle

v2: every goblin bashes the wall for about 5 s, climbs, runs on the rampart for about 8 s, then jumps in ([enemies.md](enemies.md#every-goblin-climbs-v2)), so the damage grows step by step.

| Cause | Damage |
|---|---|
| Goblins bashing the wall (step 1) | Small, steady (`CASTLE_HEALTH.wallHitDamage` per hit); a spear hits twice as hard |
| Goblins on the rampart (step 3) | No castle damage, but they attack the wall garrison |
| Balloon bombs on the wall | Medium (not built) |
| Boom goblin exploding at the wall | Medium (not built) |
| Intruders smashing things inside the courtyard (step 4) | Faster than outside attacks, until cleared |
| Peppered (sneezing) goblins | None while they sneeze (5 s) |

### Where the damage is

The health flag shows how much damage, not where. Direction is shown in other ways:
- Cracks, smoke and small fires appear on the wall near the attack.
- Spatial sound comes from the real direction of the attack.

---

## 4. End of battle screens (MVP)

- **Win (revamped 2026-11-12, `src/ui/endPanel.ts`, `END_PANEL`):** the battle stops, confetti and fireworks, the fanfare, then a taller panel (38 x 32 cm):
  - A "Victory!" banner, the level's name under it ("Level 3: The Shield Wall", or the Custom Game level's name).
  - **Three real 3D stars** floating in front of the panel (`src/ui/winStars.ts`, `END_PANEL.stars`): gold for the stars won, dull stone for the ones missed, the middle one bigger and higher. They pop in one at a time, a won one spins once with a chime that climbs with each star and a burst of sparkles; then they bob and a glint runs across the gold ones. A perfect or best result gets an extra chime.
  - **Stats** with Kenney Board Game icons (`public/ui/board/`, tinted: heart, skull, hourglass): castle health left, goblins eaten, the battle's time (pauses not counted). The level's name has a Fantasy UI Borders divider on each side, and "New best!" wears a crown.
  - **A line under them:** "New best!" (only when it beats an earlier win), "A perfect defense!", or what the next star needs ("Keep 70% castle health for 3 stars", from `MENU.stars`).
  - **Buttons:** Menu (left), the big one (Next level when the next campaign level is open, else Play again), and Play again (right) beside Next. Next level starts it right away (the same map for now).
- **Stars for every win:** from the red flag's share left (3 at 70%, 2 at 35%, else 1). Campaign levels keep their best stars (the menu card shows them); Custom Game levels keep theirs too (`best` in `tallTale.customLevels`, cleared when the level is edited); debug battles show them and save nothing.
- **Lose:** "The castle has fallen", the level's name, the same stats, a word of hope, Try again (big) and Menu.
- Debug page: "Win battle" and "Lose castle" show them at once.

---

## 5. Later (not in the MVP)

### Star rating

- **3 stars:** health flag stays high (above the top notch).
- **2 stars:** health flag ends between the notches.
- **1 star:** health flag ends low but the castle survives.
- Gives a reason to replay a level for a perfect result.

### Losing should feel generous

- The loss is funny, not harsh: the castle sags, workers run around waving their arms, the giant shrugs.
- **Quick retry from the start of the current wave**, not the whole battle. Keeps sessions short.
