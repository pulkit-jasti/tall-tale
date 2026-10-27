# Castle Rules: Win and Lose

Status: decided for the first build.

Back to [GDD index](GDD.md). Related: [Enemies](enemies.md), [Map](map.md).

---

## 1. Win and lose

- **Win:** survive all waves of the battle.
- **Lose:** the castle flag reaches the bottom of its pole.
- **The giant cannot be hurt.** Only the castle takes damage. This keeps the rules simple.

---

## 2. The flag

- One tall flagpole at a prominent spot in front of the player, easy to see without looking away from the battle.
- The flag slides down the pole as the castle takes damage. It works like a progress bar built into the world. No health bar or numbers.
- **Readability:**
  - Small notches on the pole mark the star thresholds.
  - The flag tears and smokes as it gets low.
- **Repair:** during the short breather between waves, soldiers pull the rope and raise the flag a little. Part of the damage heals, not all of it.

### Rejected

- **Five flags around the wall:** too much visual clutter.
- **Damaged wall sections with gameplay effects** (weaker sections, breaches): too complex, and losing would snowball.

---

## 3. What damages the castle

| Cause | Damage |
|---|---|
| Enemies attacking the wall | Small, steady |
| Balloon bombs on the wall | Medium |
| Boom goblin exploding at the wall | Medium |
| Intruders smashing things inside the courtyard | Faster than outside attacks, until cleared |
| Climbers | No direct damage, but they sabotage carts and machines |

### Where the damage is

With a single flag, direction is shown in other ways:
- Cracks, smoke and small fires appear on the wall near the attack.
- Spatial sound comes from the real direction of the attack.

---

## 4. Star rating

- **3 stars:** flag stays high (above the top notch).
- **2 stars:** flag ends between the notches.
- **1 star:** flag ends low but the castle survives.
- Gives a reason to replay a level for a perfect result.

---

## 5. Losing should feel generous

- The loss is funny, not harsh: the castle sags, workers run around waving their arms, the giant shrugs.
- **Quick retry from the start of the current wave**, not the whole battle. Keeps sessions short.
