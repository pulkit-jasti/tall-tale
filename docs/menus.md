# Menus, Shelves and the Campaign Screen (v2 run 2)

Status: decided with the developer (2026-11-11). Built in v2 run 2. This is the topic doc for everything the player sees after the tutorial. Where it disagrees with [modes-and-progression.md](modes-and-progression.md), this file wins (that file is the MVP's older plan). [v2-plan.md](v2-plan.md) still wins over this file.

Back to [GDD index](GDD.md). Related: [v2-plan.md](v2-plan.md), [controls-and-ui.md](controls-and-ui.md#ui-library), [castle-rules.md](castle-rules.md#star-rating).

---

## 1. The idea

- **The menu is the tutorial battleground itself,** not a separate scene. The player stays in the same seat.
- **Built only from our UI library** (`src/ui/kit/`), to save time and keep one look. Two small parts are added to the kit first (section 7).
- Everything interactive sits in the reach band and goes in `reachSpots()`. Menu panels get their height from `uiCenterY`.

---

## 2. From the tutorial to the menu

- When the tutorial is won, the player goes to the main menu (after the win moment).
- **The battle sinks:** the castle walls, towers, the two flags and every other battle-only thing slide down into the ground in a smooth animation.
- **The menu rises:** the main menu panel, the tool shelf, the achievements shelf and the loadout stand rise out of the ground in a smooth animation.
- Pressing Fight on a level plays it the other way round: the menu sinks, the battle rises.
- Animations move whole groups (a transform only), so they cost no frame time. No new materials, no lights.
- On later visits (the tutorial is saved as done) the game opens straight on the menu.

---

## 3. Layout around the player

| Where | What |
|---|---|
| Front | The main menu panel (section 4). The campaign panel opens in the same spot. |
| Left side | The achievements shelf (section 6). |
| Right side | The tool shelf (section 5). |
| Low in front | The loadout stand: 4 slots (section 5). |

Exact angles and radii are set in config during the build, inside the reach band.

---

## 4. Main menu

A front panel (the existing `Panel`) with **rectangular tile buttons, not round ones, in different sizes:**

- **Campaign:** the biggest tile, in the center. The first and main option.
- **Daily Battle** and **Custom Game:** medium tiles, one on each side of Campaign.
- **Settings** and **Replay tutorial:** small tiles in a row below.

Rules:

- **Every option is shown and pokeable, none is locked.** Daily and Custom are not built yet. What a poke does for now is open (section 10).
- Settings opens the existing settings panel. Replay tutorial starts the tutorial again.

---

## 5. Tools: the shelf and the loadout

### Four tools per battle

- **A battle has exactly 4 tools:** the **slingshot** and the **horn** are always in, and **2 slots are the player's choice.**
- Why fixed: the slingshot sets off the triggers and pops balloons, and the horn is the only way to call the knights. Without them the core mechanics are gone.
- The choice is between the other tools: swatter, pepper, bell, and the new tools built later.
- So a battle has 4 tool platforms (was 5).

### The tool shelf (right side)

- Every tool sits on the shelf, unlocked and locked.
- **Unlocked:** grab it (fist), and a small tag shows its name and one line about what it does.
- **Locked:** a grey silhouette with its unlock text ("Beat level N"). It cannot be taken.
- A newly unlocked tool glows until it is grabbed once.

### The loadout stand (low in front)

- 4 slots. The slingshot and the horn sit in theirs, locked in place.
- **2 empty slots glow** until filled. Grab an unlocked tool from the shelf and put it in a slot: it clicks in with a small dust puff and a cheer.
- Putting a new tool in a full slot sends the old one back to the shelf.
- The loadout is saved and used for the next campaign level.
- While only 2 choosable tools are unlocked, the 2 slots are filled for the player.

---

## 6. Achievements shelf (left side)

- Run 2 builds the shelf with **grey trophy slots** and a counter ("0 / 9").
- Grabbing a locked trophy shows a tag with "???" for now.
- The riddles, hints and the real trophies come in run 3 ([v2-plan.md](v2-plan.md) 2.10).
- "More coming soon" as one card at the end.

---

## 7. New UI library parts (built first)

- **Tile button:** a rectangular button with the same poke logic, feedback, sounds and Idle, Ready, Held, Locked states as `PokeButton`. Sizes from `BUTTON_SIZE` (width and height). The main menu and the level rows use it.
- **Vertical slider:** an upright option for `Slider`. The developer tested the slider and it works well; no extra up and down buttons.
- **Red Fight button:** a tile button in red with a sword icon.

---

## 8. Campaign panel

Opens from the Campaign tile, in the front panel's place, with a back button to the main menu. **A split panel, nothing pops over anything:**

- **Left: the level list.** About 5 rows show at a time. The vertical slider on the right of the list scrolls it. Each row: the level number, the name, stars (or a lock), and a small tool icon on unlock levels. Poke a row to select it.
- **Right: the detail card** of the selected level. Level 1 is selected when the panel opens, so it is never empty.
- After the last level: one "More coming soon" row.

### The detail card

- The level number and its name. **The name tells what is special about the level** (its twist).
- The best stars (empty for an unbeaten level).
- **Difficulty:** 1 to 3 goblin skulls (easy, normal, hard).
- One line of flavor that explains the twist, for example "Every goblin brought a shield. Time for some spice."
- **Enemies:** small icons, with a "New!" tag on anything the player has not met yet (runners, shields, balloons).
- **Reward:** "Unlocks: (tool)" with its icon, only on unlock levels.
- **The red Fight button with a sword** at the bottom.
- No wave count and no time of day: every level has 4 waves, one time of day per wave (morning, day, sunset, night).

### Locked levels

- **15 levels.** **Levels 1 to 5 are open and playable** from the start and get the polish.
- **Levels 6 to 15 are locked:** they can be selected and their detail card read (greyed), but the Fight button is a lock with "Beat level 5 to unlock". Each win after that opens the next one. For now 6 to 15 are text only (name, flavor, skulls, enemy icons, reward), so judges see the variety without the build work. They are built later from the same data.
- A locked level's reward can show a future tool as a "???" silhouette.
- Level 1 gets a "Start here" tag.

---

## 9. Levels, stars and difficulty (the data the menu shows)

### A level is data

One entry per level: number, name, flavor line, skulls, twist, enemy mix and gear mix, camps, triggers, reward (tool or none). The menu reads it; the wave director (a later run) plays it. Levels 6 to 15 fill in the menu fields only.

### Stars

- From the red health flag at the end ([castle-rules.md](castle-rules.md#star-rating)): **3 stars at 70% health or more, 2 at 35% or more, 1 below that** (starting values, tune later).
- **Retry from the current wave costs no stars:** health goes back to what it was when that wave started, and stars count normally.
- **The best result is kept,** a replay never lowers it.
- **Any win (1 star) opens the next level.**
- **No points score in the campaign,** only stars. A score fits Endless later.

### Difficulty

- Rises gently over the levels, mostly with **new problems, not tougher goblins** (goblin health never changes).
- The dials: goblins per wave and spawn rate, how many camps send at once, the gear share (helmets, shields, spears), runners and balloons.

### Twists

Every level has one twist, built only from existing systems (data work, not new code), and **its name comes from its twist.** Examples (not final, not yet assigned to level numbers):

| Name | Twist | Shows off |
|---|---|---|
| The Shield Wall | Most goblins carry shields | Pepper |
| Spear Rush | Spears everywhere, wall damage doubles | Hands, swatter |
| Runner's Road | Mostly runners | Swatter, slingshot |
| Balloon Festival | Lots of balloon riders | Slingshot |
| Two Fronts | Camps on opposite sides | Spinning, horn |
| The Great Horde | One huge camp, one direction | Horn |
| Powder Valley | Many kegs and boulders on the roads | Slingshot and triggers |
| Thin Walls | Only 2 archers, slow refill | Protect the garrison |
| The Siege | The castle starts damaged | Everything |

- A rhythm: each level adds one twist or a tool unlock; every 5th level mixes two earlier twists (3 skulls).
- An unlock level is built around the tool it gives.

### Tool unlocks

- **Every unlockable tool unlocks in levels 1 to 5,** so a judge can earn one and use it elsewhere. That includes the bell and every new tool built later.
- **Which tool unlocks in which level is not decided yet:** it is set once the tools are final.
- An "Unlock all tools" switch in settings, for judges. It unlocks tools only, never levels.

### Campaign twists vs Daily twists

- **Campaign twists** are dials on the normal rules (above): tested, fixed per level, they show how deep the game goes.
- **Daily twists break the rules** and never appear in the campaign: giant goblins, low gravity pebbles, pepper only, double speed goblins, a tiny castle. A random map from the date's seed plus one wild twist. Built later, after the campaign.

---

## 10. Open

- What poking Daily Battle or Custom Game does while they are not built (for example a short "Coming soon" note, or a plain battle).
- What Fight starts in run 2, before the wave director exists (proposed: the normal battle the Skip tutorial path plays, with the chosen loadout).
- Pepper back in the tutorial (wave 4) now that the bell is out, so all 4 starting tools are taught ([v2-plan.md](v2-plan.md) section 4).
- Which tool unlocks in which level (once the tools are final).
- Exact spots of the shelves and the loadout stand (set in the build, inside the reach band).
