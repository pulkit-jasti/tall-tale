# MVP: First Playable Build

Goal: test the core gameplay loop in the headset as early as possible. Everything else waits until after the first playtest.

Back to [GDD index](GDD.md).

---

## In the MVP

**World**
- The raised board, the castle with its low wall, courtyard and workers ([map.md](map.md)).
- Full 360 degree board. The player rotates it with two-handed handles ([controls-and-ui.md](controls-and-ui.md)).
- Roads and enemy camps (sand and rock hills, bigger camp means more enemies).
- Triggers: boulder, powder keg and leaning tree only.
- Hidden gate at the front as the troop spawner.
- Simple shapes only (like the mockup). No final art yet.

**Rules and pacing**
- **One fixed level:** the level generator with one fixed seed ([map.md](map.md#8-levels-and-the-level-generator)).
- Waves with a gentle intensity curve and short breathers ([core-loop.md](core-loop.md)).
- The flag: win by surviving all waves, lose when the flag reaches the bottom ([castle-rules.md](castle-rules.md)).

**Menus**
- A 2D start page with one "Enter VR" button, then a single Play button in VR.
- Board placed automatically when Play is pressed.
- Pause menu with "Reset table".

**Player**
- Body abilities: grab, flick, smash, eat.
- **All 4 giant tools:** slingshot, fly swatter, pepper shaker, megaphone ([giant-tools.md](giant-tools.md)). This is the most satisfying part, so it is the main thing to test. The megaphone uses a fixed loudness threshold for now (no calibration, no bell).
- All tools available from the start. No loadout, no unlocks.
- Slingshot aim assist ([giant-tools.md](giant-tools.md#slingshot-aim-assist)).
- Food currency: eating fills the food jar, tools cost food.
- Tool platforms beside the player with food pips.

**Enemies and army**
- **Grunts, runners and climbers only** ([enemies.md](enemies.md)). Climbers are the main food source.
- Enemy routes on the road graph ([map.md](map.md#4-how-enemies-choose-routes)).
- Troops with basic behavior: spawn, walk out, fight.

**Feedback**
- Spatial enemy sounds, louder as they get closer. Camps rumble before spawning.
- Basic juice: hit flash, poof, gear flying off.

---

## Not in the MVP

| Feature | Where it is described |
|---|---|
| Castle machines (including the arrow machine) | [castle-machines.md](castle-machines.md) |
| Other enemy types: shield, balloon riders, Boom goblin, tinker | [enemies.md](enemies.md) |
| Other map features: bridge, forest, mud, hill | [map.md](map.md) |
| More levels, unlocks, progression, Arcade mode | [map.md](map.md#8-levels-and-the-level-generator) |
| AR (passthrough) mode | [controls-and-ui.md](controls-and-ui.md) |
| Installable app (PWA) and Store packaging | [README](../README.md#hosting-and-the-quest-browser) |
| Final art and most sounds | [audio.md](audio.md) |
| Prisoner carts | [giant-tools.md](giant-tools.md) |
| Picking up and placing troops | [core-loop.md](core-loop.md) |
| Difficulty slider | [controls-and-ui.md](controls-and-ui.md) |
| Slingshot menu and first-run tutorial | [controls-and-ui.md](controls-and-ui.md) |
| All accessibility features: quiet mode and bell, mic calibration, handedness, snap rotation, reduced effects, visual threat cues (smoke) | [controls-and-ui.md](controls-and-ui.md) |
| Food powers | not designed yet |
| Boss | not designed yet |
| River and boats | not designed yet |
| Voice commands | README |
| Gate mechanics | later |
