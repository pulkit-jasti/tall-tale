# Menus, Shelves and the Campaign Screen (v2 run 2)

Status: decided with the developer (2026-11-11). Built in v2 run 2 (2026-11-11, branch `feat/v2-menus`) and tested on the headset the same day: everything in "As built" works well. Where the build chose something, it is in "As built" at the end. This is the topic doc for everything the player sees after the tutorial. Where it disagrees with [modes-and-progression.md](modes-and-progression.md), this file wins (that file is the MVP's older plan). [v2-plan.md](v2-plan.md) still wins over this file.

Back to [GDD index](GDD.md). Related: [v2-plan.md](v2-plan.md), [controls-and-ui.md](controls-and-ui.md#ui-library), [castle-rules.md](castle-rules.md#star-rating).

---

## 1. The idea

- **The menu is the tutorial battleground itself,** not a separate scene. The player stays in the same seat.
- **Built only from our UI library** (`src/ui/kit/`), to save time and keep one look (section 7), following Meta's hands UI guidance (hit targets and spacing, swipe to scroll, hover, press and select states with a sound, snap zones that glow).
- Everything interactive sits in the reach band and goes in `reachSpots()`. Menu panels get their height from `uiCenterY`.

---

## 2. From the tutorial to the menu

- When the tutorial is won, the player goes to the main menu (after the win moment).
- **The battle sinks:** the castle walls, towers, the red flag, the compass and every other battle-only thing slide down into the ground in a smooth animation.
- **The menu rises:** the main menu panel, the tool shelf, the achievements shelf and the loadout stand rise out of the ground in a smooth animation.
- Pressing Fight on a level plays it the other way round: the menu sinks, the battle rises.
- Animations move whole groups (a transform only), so they cost no frame time. No new materials, no lights.
- On later visits (the tutorial is saved as done) the game opens straight on the menu.

---

## 3. Layout around the player (the home screen)

The menu panel, the shelves and the stand together are the **home screen**.

| Where | What |
|---|---|
| Front | Only the menu panel (section 4). The campaign panel opens in the same spot. |
| Right side, back row (higher, farther) | The tool shelf (section 5), 60 to 88 degrees. |
| Right side, front row (lower, nearer) | The loadout stand: 4 battle platforms (section 5), 50 to 95 degrees. |
| Left side | The achievements shelf (section 6), -48 to -96 degrees. |

The shelves sit between the front and the sides: at 36 to 80 degrees they crowded the menu, centered on 90 they were out of view unless the player turned the head. Now the menu keeps about 40 degrees clear on each side, and the shelves still show at the edge of the view. Everything sits at about the rampart's distance (the reach the reach check sizes the board to), never close and low by the body: a first build at 31 to 38 cm out and 8 to 14 cm up was too close to grab. Exact numbers: `MENU` in `src/config/game.ts`.

---

## 4. Main menu

A compact front panel (the existing `Panel`, 36 x 32 cm) with **round poke buttons only** (rectangular tile buttons were tried and dropped), in a grid, the same padding on every side, each word right under its own button, the rows clearly apart:

- **Top row:** Daily Battle, **Campaign** (the biggest, in the middle), Custom Game.
- **Bottom row:** Settings and Tutorial (replay it), smaller.

Rules:

- **Every option is shown and pokeable, none is locked.** Daily is not built yet: a poke turns its word to "Coming soon" for a moment. Custom Game opens the Custom Game pages (their Fight plays the level since 2026-11-11) ([custom-mode.md](custom-mode.md#8-custom-game-menu-and-the-ui-kit), decided 2026-11-11).
- Settings opens the existing settings panel. Tutorial starts the tutorial again.
- Small enough that its edges are seen without turning the head (a first 50 cm wide panel was not).

---

## 5. Tools: the shelf and the loadout

### Four tools per battle

- **A battle has exactly 4 tools:** the **slingshot** and the **horn** are always in, and **2 slots are the player's choice.**
- Why fixed: the slingshot sets off the triggers and pops balloons, and the horn is the only way to call the knights. Without them the core mechanics are gone.
- The choice is between the other tools: swatter, pepper, bell, and the new tools built later.
- So a battle has 4 tool platforms (was 5).

### The tool shelf (right, back row)

- Wooden pedestals, one spot per tool. Tools stand at a little under full size, resting the way they rest on their battle platforms.
- **Unlocked:** grab it (fist or pinch), and a small tag shows its name and one line about what it does. In a fist it grows to full size in its real grip.
- **Locked:** a grey silhouette. It cannot be taken: a grab buzzes and the tag says which level unlocks it ("Beat level 3 to unlock" for the bell).
- A newly unlocked tool glows until it is grabbed once.

### The loadout stand (right, front row)

- **4 of the very platforms the tools stand on in battle**, so what is put there is what the battle shows (the shelf's wooden pedestals look different on purpose).
- Left to right: **the slingshot and the horn** (fixed: a grab buzzes, "Always in your loadout"), then **2 slots the player fills**, empty at first and pulsing gold.
- The loadout is saved and used for the next campaign level. **No battle starts until both slots are filled**, but Fight still says "Fight!" (a "Locked" button would never be poked, so nobody would learn why). Poking it then brings the glass sign in front of the eyes ("Put 2 tools on the stand first", like the horn and balloon lessons) and a red arrow that flies to the first empty slot, both gone after 5 seconds. Nothing about it is written on the level card.

### Placing tools

- **No tool has a spot of its own.** Any tool can be put on either stand slot or any shelf spot, back and forth.
- **Snap zone:** while a held tool is close enough to a place it may go, that platform glows green with a tick (Meta's snap guidance: show the hover state of the snap zone). Let go there and it snaps in with a click and a puff (and a cheer on the stand).
- **An occupied place:** the tool already there moves to where the new one came from (a swap).
- Let go anywhere else and it glides back where it was. A locked tool is never pushed onto the stand.

---

## 6. Achievements shelf (left side)

- 9 trophies (the Kenney trophy model, dimmed until earned) on two rows of small pedestals, spaced so they never touch, and a counter ("Trophies 0 / 9").
- Grabbing one shows a tag with "???" for now.
- The riddles, hints and each trophy's own shape come in run 3 ([v2-plan.md](v2-plan.md) 2.10).
- "More coming soon" as one card at the end.

---

## 7. UI library parts

- **Round buttons everywhere but Fight.** `PokeButton` got a `locked` state (it goes down and buzzes, never clicks, and calls `onRefuse`) and menu icons (sword, lock, flag, sun, sliders). Rectangular menu tiles were built and dropped.
- **FightButton** (`src/ui/kit/fightButton.ts`): the one rectangular button, a bordered box (`PokeButton`'s `box` option: the same poke, looks and sounds) with a sword and "Fight!" on its face, red; locked, grey with a lock and "Locked". A round Fight did not look right.
- **ScrollList** (`src/ui/kit/scrollList.ts`): a list drawn once into one canvas, a window moving over it (no redraw while scrolling); hover, press and selected looks, a tick and a click; edge rows show cut off. It can scroll by swiping (Meta's guidance), but the campaign uses it **tap only** (`swipe: false`) with the upright slider scrolling it (`scrollToShare`, gliding smoothly): on the headset, swipes and taps on the same rows got mixed up.
- **Upright slider** (`Slider` `vertical`): the campaign list's scroll, smooth (no row steps). Decided 2026-11-11: every page that scrolls uses it, in a scrollbar look with a long pill-shaped handle instead of the round one, so it never looks like a value slider ([custom-mode.md](custom-mode.md#ui-kit-parts)).
- **Floating headers** (2026-11-11): every menu panel's title and Back float over its top edge (`PanelHeader`); tabs float under it. The panels hold only content and controls ([controls-and-ui.md](controls-and-ui.md#ui-library)).
- **Height rail** (2026-11-11): a short piece of the ring handle in front of the home screen, height only (never spins): the board and the menu go up or down with the hand ([custom-mode.md](custom-mode.md#12-as-built-first-part-2026-11-11-not-tested-on-the-headset-yet)).
- **Custom Game** (decided 2026-11-11): its pages, the floating rectangular tabs, the name field with the system keyboard and the delete question are in [custom-mode.md](custom-mode.md#8-custom-game-menu-and-the-ui-kit).
- **Kenney art on panels** (2026-11-12, `drawIconCentered`, `drawStars`, `drawDivider` in the kit; the assets are listed in `public/ui/README.md`): the campaign card and list (above), the Custom Game card (a divider under the name, its best stars on the top line, a facts row over the buttons: camps, castle health, guards and archers with tower, heart, shield and bow icons), the empty Custom Game page (a flag), the settings rows (an icon before each name), and the trophy counter (a trophy). The round buttons keep their code-drawn icons (tested).
- **Win panel:** Next level starts the next open campaign level at once; Menu goes back to the campaign or Custom Game page the battle came from ([castle-rules.md](castle-rules.md#4-end-of-battle-screens-mvp)).

---

## 8. Campaign panel

Opens from the Campaign button, in the front panel's place (50 x 36 cm), with a Back button to the main menu. **A split panel, nothing pops over anything:**

- **Left: the level list**, a tap only `ScrollList`, and the upright slider right of it. **Only the slider scrolls the list** (smoothly); **a tap only selects** (no buttons on the rows, a small wobble still counts as a tap). Each row is a small card: the number and name, then the best stars or a lock. The selected one is gold; the one under the finger lights up, darker while pressed. About 4 rows show, the next one cut off at the edge.
- **Right: the detail card** of the selected level. Level 1 is selected when the panel opens, so it is never empty.
- After the last level: one "More coming soon" row.

### The detail card

One padded column, every value with its own label:

- "Level N" small, then the name big. **The name tells what is special about the level** (its twist). A Fantasy UI Borders divider under it (2026-11-12).
- Two blocks side by side: **Best** over the best stars (empty for an unbeaten level), **Difficulty** over 1 to 3 goblin skulls. Since 2026-11-12 the stars, skulls and the list rows' lock are Kenney icons (Game Icons star and lock, Board Game Icons skull; the code-drawn ones were removed), and each label has a small Kenney icon (a crown before Best, a skull before Difficulty, an award before Reward).
- One line of flavor that explains the twist, for example "Every goblin brought a shield. Time for some spice."
- No enemies list (removed: extra information nobody needs; the level data still has it).
- **Reward:** only on unlock levels: a small copy of the real 3D tool (5.5 cm) standing on the card and slowly turning, with its name beside it, so it reads without knowing the word ("???" for one not decided yet).
- **The rectangular red Fight button** (sword and "Fight!") centered at the bottom. Only a locked level locks it: grey with a lock and "Locked", "Beat level N to unlock" under it. With empty tool slots it still says "Fight!"; a poke shows the glass sign hint instead of starting (section 5).
- No wave count and no time of day: every level has 4 waves, one time of day per wave (morning, day, sunset, night).

### Locked levels

- **15 levels.** **Levels 1 to 5 are open and playable** from the start and get the polish.
- **Levels 6 to 15 are locked:** they can be selected and their detail card read (greyed), but Fight is locked with "Beat level 5 to unlock". Each win after that opens the next one. For now 6 to 15 are text only (name, flavor, skulls, enemies, reward), so judges see the variety without the build work. They are built later from the same data.
- A locked level's reward can show a future tool as "???".

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

- ~~Daily Battle and Custom Game while not built~~ Decided 2026-11-11: a poke shows "Coming soon" in place of the button's word for 2.5 s.
- ~~What Fight starts in run 2~~ Decided 2026-11-11: the normal battle without the tutorial, with the loadout's 4 tools. A win saves the stars and opens the next level.
- ~~Pepper in the tutorial~~ Decided 2026-11-11: pepper stays in wave 4. The tutorial teaches the slingshot, the horn, the swatter and the pepper. Then wave 5 was dropped: the tutorial and every battle have 4 waves (the blue flag has 4 notches).
- Which tool unlocks in which level (once the tools are final). For now the bell is the only locked tool ("Unlocks in the campaign"); "Unlock all tools" frees it.
- ~~Exact spots of the shelves and the loadout stand~~ Set in the build: `MENU` in `src/config/game.ts` (below).

## 11. As built (run 2)

- **Code:** `src/ui/menu/` (`menu.ts` holds the pages and the shelves; `mainMenu.ts`, `campaignPanel.ts`, `shelves.ts`), `src/world/sceneSwap.ts` (sink and rise), `src/config/levels.ts` (the 15 levels), `src/rules/campaign.ts` (progress, stars, open levels, unlocks, loadout), `src/player/progress.ts` (localStorage key `tallTale.progress`). Numbers: `MENU`.
- **Changed after the first look (2026-11-11), decided with the developer:** round buttons only (the rectangular tile buttons are gone); more room between everything (at least about 2.4 cm between rims); the home screen moved out and up to about the rampart's distance (it was too close and low to grab); tools at 0.8 size (was 0.5), trophies 8 cm (the Kenney trophy model, was a grey cup); only the menu panel in front, the tools shelf and the loadout stand on the right, the trophies on the left; the stand is slingshot, horn, then 2 empty slots the player fills, and Fight stays locked until both are filled; tools go back and forth between the shelf and the slots; the bell unlocks at level 3; scrolling the level list no longer redraws anything (no blinking). The lines below are as built now.
- **Flow:** first visit: the welcome panel. The tutorial won: the battleground sinks and the menu rises (no end panel). **Skip tutorial** (welcome or pause panel) now goes to the menu too (it used to start a battle without lessons). Later visits open straight on the menu. Fight: the menu sinks, the battle rises, then it starts. After a level: the end panel shows the stars; won, the big button goes to the menu (Play again small, bottom left); lost, Try again (Menu small, bottom left). Menu returns to the campaign page.
- **What sinks:** the castle walls and towers, the red flag, the compass, the ring handle and its arrows, the tools and their platforms (18 cm, then hidden). The menu rises 60 cm. 1.1 s each way, one after the other. Goblins, troops and triggers are cleared as it starts.
- **Second look (2026-11-11), from Meta's hands UI guidance (no scroll bars, swipe the content, hover, press and select states with a sound, snap zones that glow):** the level list is a swipe list, the slider and row arrows are gone, the main menu and campaign panel are smaller, the level card was redone, the stand uses the battle platforms, tools go anywhere, trophies are smaller with more room.
- **Third look (2026-11-11), decided with the developer:** swipe and tap on the same rows got mixed up, so the list is tap only and the upright slider is back as the only scroll (smooth); the shelves moved to square on the sides (90 degrees); the tags and cards no longer write depth (the clouds behind them blinked); no enemies on the level card; Fight is a bordered rectangle again (the only one); the empty slots message moved off the card to the glass sign with a red arrow for 5 s on a Fight poke; the reward shows a small turning 3D copy of the tool.
- **Fourth look (2026-11-11), decided with the developer:** the shelves came back toward the front (between front and side); every tag is drawn and uploaded at the start and the home screen's shaders compiled (`Menu.warm`), since the first grab of each thing still flickered; the reward tool can be grabbed off the card; the pause panel got a Menu button and sizes itself to its buttons; battle tools stay on their own platforms (the picks had moved in front of the red flag) and the flags moved a little toward the front. The lines below are as built now.
- **Main menu:** a 36 x 32 cm panel at the end panel's spot, a grid of round buttons, each word right under its button, the same padding on every side: Daily Battle, Campaign (the biggest) and Custom Game on top, Settings and Tutorial below. Daily and Custom: the word turns to "Coming soon" for 2.5 s.
- **Campaign panel:** 50 x 36 cm. Left: the level list (`ScrollList`, tap only): tap a row to select it (click, a 2.5 cm wobble still counts); the upright slider right of it (21 cm) is the only scroll, the list gliding smoothly after it. Each row is a card: the number and name, then the best stars or a lock; the selected one gold; hover lights a row, press darkens it; about 4.4 rows show, so one is cut off at the bottom. Right: the card in one padded column: "Level N", the name, two labeled blocks ("Best" stars, "Difficulty" skulls), the flavor, "Reward" with a 5.5 cm turning copy of the tool and its name (only on unlock levels; a finger near it ticks and it glows Ready; grab it like a shelf tool: a fist brings a full-size copy into the hand in its real grip, a pinch holds it as it is, to turn and look around; its tag shows, no effects run; let go and it glides back onto the card), and the rectangular Fight button (12 x 4.6 cm, red, sword and "Fight!") centered at the bottom. Locked (only on a locked level): grey, a lock and "Locked", "Beat level N to unlock" under it. Empty tool slots: Fight still says "Fight!", and a poke shows the glass sign ("Put 2 tools on the stand first") and a red arrow flying to the first empty slot, for 5 s (`MENU.shelves.emptySlotsHint`).
- **Tool shelf (right, back row):** 3 wooden pedestals at 60, 74 and 88 degrees, 47 cm out, 27 cm up; a "More coming soon" card at 101 degrees. Tools at 0.8 size, resting as on their battle platform. Grabbed in a fist, a tool grows to full size in its `HOLD.poses` grip; a tag over it gives its name and one line. A locked tool is a grey silhouette: a grab buzzes and the tag says "Beat level 3 to unlock" (the bell).
- **Loadout stand (right, front row):** 4 battle platforms (the same hexagon platform on a post as in battle) at 50, 65, 80 and 95 degrees, 38 cm out, 14 cm up: the slingshot and the horn (fixed: a grab buzzes, "Always in your loadout"), then 2 slots, empty at first and pulsing gold.
- **Placing tools:** no tool has a spot of its own: any tool can go on either stand slot or any shelf spot. While a held tool's grip is within 10 cm of a place it may go, that platform glows green with a tick; let go and it snaps in (click, puff, and a cheer on the stand). A tool already there moves to where the new one came from (a swap). A locked tool is never pushed onto the stand. Let go anywhere else and it glides back. The places are saved (`shelf` and `loadout` in the progress).
- **In the battle:** every tool stands on its own platform (swatter -88, bell -68, pepper -50, slingshot 53, pebble bowl 70, horn 86 degrees since 2026-11-12, about 12% nearer the front; before that -100, -78, -56, 60, 78, 96, moved back twice from -82, -56, -30, 30, 58, 82, since the front ones stood in front of the flags); the loadout only picks which 4 show. The red flag is at -34 degrees, the pause and Next buttons at 34 (the blue flag is gone, the compass is straight in front).
- **Board height:** placed 50 cm below the eyes (was 46): the ground felt too close.
- **Hover:** a finger coming near anything on the shelves, the stand or the card's reward ticks softly, and it glows Ready.
- **Achievements shelf (left):** 9 trophies (`props/mini-arena/trophy.glb`, 6 cm, dimmed until earned) on two rows of 5.5 cm pedestals 12 degrees apart (5 at 43 cm out and 18 cm up, from -48 to -96 degrees; 4 at 48 cm out and 30 cm up), "Trophies 0 / 9" above, a "More coming soon" card at -104 degrees. A grab shows "???".
- **Tags:** the tag over a held thing draws on top and never writes depth (it made the clouds behind it blink). Every tag is drawn once at the start (each its own texture) and uploaded with the home screen's shaders compiled at setup (`Menu.warm`), so the first grab of a thing never hitches.
- **Pause panel:** Resume, Settings, Restart, then Skip tutorial (in the tutorial) or **Menu** (any other battle: back to the home screen, the battle is dropped). Menu buttons (pause and end panels) show a little castle keep (`home` icon), not a back arrow. It sizes itself to the buttons that show (`Panel.resize`, `rowPanelWidth`).
- **Unlocks:** winning a level unlocks its reward tool (the bell at level 3); it glows on the shelf until grabbed.
- **Settings:** the Access tab has a fourth row, "Unlock all tools" (a switch, saved with the progress).
- **Debug page** ("Menus and campaign"): Open menu, Fight level 1 to 6, Win battle, Unlock all tools, Forget progress.
