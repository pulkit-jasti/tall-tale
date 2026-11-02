# Castle Rules: Win and Lose

Status: decided for the first build.

Back to [GDD index](GDD.md). Related: [Enemies](enemies.md), [Map](map.md).

---

## 1. Win and lose

- **Win:** survive all waves of the battle.
- **Lose:** the castle health flag reaches the bottom of its pole.
- **The giant cannot be hurt.** Only the castle takes damage. This keeps the rules simple.

---

## 2. The two flags

Two tall flagpoles on the inner rim, one on each side, just outside the two board handles, slightly in front of the player.

- **They stay with the player, like the tool platforms.** They do not spin with the board, so they are always in front of the player and never have to be searched for (see [controls-and-ui.md](controls-and-ui.md#2-the-360-degree-board)).
- No health bars or numbers. Each flag works like a progress bar built into the world.

### Castle health flag (red)

- Starts at the top. Slides down the pole as the castle takes damage.
- The flag tears and smokes as it gets low.
- **Repair:** during the short breather between waves, tiny soldiers at the base of the pole pull the rope and raise the flag a little. Part of the damage heals, not all of it.
- Later: small notches on the pole mark the star thresholds (stars are not in the MVP).

### Wave flag (blue)

- Shows how far the battle has come. The pole has one notch per wave.
- Starts at the bottom and climbs to the next notch when a wave is cleared. At the top, the battle is won.
- Tells the player how much is left, and gives a small reward moment at the end of each wave.

### Rejected

- **Five flags around the wall:** too much visual clutter.
- **Flags on the castle towers:** they spin away with the board, so the player has to search for them.
- **Damaged wall sections with gameplay effects** (weaker sections, breaches): too complex, and losing would snowball.

---

## 3. What damages the castle

| Cause | Damage |
|---|---|
| Grunts and runners hitting the wall | Small, steady |
| Balloon bombs on the wall | Medium |
| Boom goblin exploding at the wall | Medium |
| Intruders smashing things inside the courtyard | Faster than outside attacks, until cleared |
| Climbers | No direct damage. If ignored, they jump into the courtyard and become intruders |

### Where the damage is

The health flag shows how much damage, not where. Direction is shown in other ways:
- Cracks, smoke and small fires appear on the wall near the attack.
- Spatial sound comes from the real direction of the attack.

---

## 4. End of battle screens (MVP)

- **Win:** the battle stops, workers cheer, and a simple "Congratulations, the kingdom is safe!" panel appears in front of the player with a "Play again" button.
- **Lose:** the battle stops and a simple panel says "The castle has fallen" with a "Try again" button that restarts the battle.
- Both are plain panels for now. The funnier versions below come after the MVP.

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
