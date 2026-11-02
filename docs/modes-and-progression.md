# Game Modes, Menu and Progression

Status: decided. Scoring and Endless difficulty are still to discuss.

Back to [GDD index](GDD.md). Related: [Map and level generator](map.md#8-levels-and-the-level-generator), [Controls and UI](controls-and-ui.md).

---

## 1. Principles

- **Optimize for a 10 minute first session.** Judges may only play once, so the first battle shows every tool.
- **Never gate the best parts.** After the tutorial everything is open. No level unlocks, no long grind.
- **The reason to come back** comes from the daily twist, high scores, the growing kingdom and achievements, not from locked content.

---

## 2. The menu is the board in peacetime

- No separate menu scene. The player sits in the same seat and sees their calm kingdom. Pressing Play makes the enemy camps rise out of the ground.
- Every cosmetic is seen in both the menu and the battle automatically.
- **Two scales:** kingdom things are tiny. The giant's things are giant-sized, built for the giant by the kingdom as part of the deal (tool platforms, food jar, handles, menu). So nothing big floats in the air.
- **Menu board:** a giant wooden notice board on the inner rim, with big carved buttons. Tiny villagers sit on it or are still painting it.
- **Trophy shelf:** a giant shelf on one side of the menu area. Achievements appear as trophies on it. Simple low-poly assets.

### Buttons

| Before the first battle | After the first battle |
|---|---|
| **Play** (the tutorial battle) | Daily Battle |
| Other buttons shown locked with chains, with a small label "Win the first battle to unlock" | Endless (high score shown right below it) |
| | Custom Game |
| | Achievements (trophy shelf) |
| | Play tutorial (moved to the bottom) |

Locked buttons are shown, not hidden, so a judge sees right away that there is more.

---

## 3. Modes

### Tutorial battle (first Play)

- Hand-crafted: a hand-made map blueprint, a scripted tutorial director in code that teaches and helps when the player gets stuck, and a fixed seed. It does not use the level generator. See [mvp.md](mvp.md#tutorial-director) and [map.md](map.md#8-levels-and-the-level-generator).
- **5 waves, about 8 minutes.** Each wave introduces something new:

| Wave | Introduces |
|---|---|
| 1 | Hands and eating (scripted climber in front of the player) |
| 2 | Slingshot |
| 3 | Fly swatter vs runners |
| 4 | Pepper shaker and megaphone |
| 5 | Everything together |

- Replayable any time with "Play tutorial".

### Daily Battle

- **Same map for everyone that day** (seed from the date).
- **Short and finished:** about 5 waves, around 5 minutes.
- **Twist of the day** that changes how you play, for example pepper only, giant goblins, night battle, double runners.
- **Grows the kingdom:** finishing it gives the day's gift. A streak (days in a row) gives bigger gifts.
- Built as a Custom Game the game picks each day, so it reuses Custom's options.
- No online leaderboard (would need a backend).

### Endless

- Random map each run, standard fixed rules (no options), so high scores are fair.
- Waves until the flag falls. High score shown below the button.
- Scoring and how difficulty rises: to discuss later.

### Custom Game

- A giant panel of **chunky switches and dials**, grouped: Enemies, Map, Rules, Fun twists.
- Example options: difficulty, enemy types on or off, number of camps, enemy speed, food costs (or free tools), twists (giant goblins, low gravity pebbles, balloon-only), seed input.
- A **Random** button next to Play that sets random options.
- No high score, so Endless scores stay fair.

---

## 4. The growing kingdom (cosmetics)

The kingdom thanks the giant with gifts. Never on the space inside the wall, because reach is the most precious space (eating needs the wall close).

- **Kingdom ring:** outside the castle wall, a ring of stone paving instead of grass. Villagers walk around, and monuments and statues appear here.
  - Villagers run indoors when a wave starts and come back after. Keeps the battle readable and saves performance.
  - Monuments sit between roads, never on them, and stay low so they do not hide enemies.
  - Goblin colors must stand out against stone as well as grass.
- **Grow upward:** banners, lanterns and flags on the towers, a statue of the giant on the keep.
- **Busier courtyard:** more houses, workers and stalls.
- **Trophy hill:** a fixed spot near the horizon with a pile of goblin helmets and shields (not bodies, to keep it funny) that grows after each battle. A sign shows the total, for example "1,284 goblins defeated."
- **The giant's own things:** decorated tool platforms, a fancier food jar.

---

## 5. Achievements

Not in the MVP.

- A list of flags, each tripped by a simple rule (for example "eat a seasoned goblin", "triple chain reaction", "eat every enemy type").
- Shown as trophies on the trophy shelf.
- Later: some achievements unlock kingdom gifts.

### Reading a trophy

- **Grab to read:** pick up a trophy and a small wooden tag unfolds beside it with the name and how it was earned, for example "Seasoned Snack: eat a peppered goblin". Put it back and the tag folds away. Held close to the face, the text is easy to read.
- **Own shape per trophy** that hints at what it is for (a tiny pepper shaker, a goblin helmet, a boulder).
- **Locked trophies are grey.** They can be grabbed too, and the tag shows a hint ("Eat a goblin that has been...?"). A few stay secret ("???") for surprise.
- **Counter** on the shelf, for example "4 / 9".

### Earning one

- **During battle:** only a short sound and a small sparkle, so it does not distract.
- **After the battle:** the new trophy pops up in the results moment with its name, then flies onto the shelf.
- **New trophies glow** on the shelf until grabbed once.

---

## 6. Build order

The MVP is only the tutorial battle (see [mvp.md](mvp.md)). After that, in this order:

1. Endless with high score
2. Daily Battle (cheap, reuses Custom options)
3. Achievements (cheap)
4. Custom Game (start with a few options)
5. Growing kingdom (art cost, so last)

First to cut if time runs short: Daily Battle, then Custom Game.

---

## 7. Open questions

- Endless scoring and difficulty curve.
- Which gifts the kingdom gives, and when.
- The list of daily twists.
- The first set of achievements.
