# UI images

All CC0 from Kenney packs (license in each folder). Flat PNGs, drawn onto canvas textures or used as textures on flat planes in VR. Larger sizes were picked for sharp text panels: `adventure` is the "Double" set (128 px), `icons` is the white "2x" set (100 px, tint in code), `rpg` has only one size (about 100 px).

| Folder | Pack | Files | Planned use |
|---|---|---|---|
| `adventure/` | UI Pack Adventure | `panel_brown*`, `panel_border_brown*` | Tutorial hint sign, win and lose panels (9-slice background) |
| | | `banner_hanging`, `banner_classic_curtain`, `banner_modern` | Not used: their cream inner frame showed as a white box around the title. The title banner is drawn in code (`drawBanner` in `src/ui/uiImages.ts`) |
| | | `button_brown`, `button_red`, `button_grey`, `round_brown*` | Poke buttons (Play again, pause panel) |
| | | `checkbox_*_checked`, `checkbox_*_empty` | Tutorial step list, step done check |
| | | `minimap_arrow_a` to `_d` | Arrow toward a highlighted thing that is out of view |
| | | `minimap_icon_exclamation_*`, `minimap_icon_star_*` | Marker above the thing to grab or poke |
| | | `progress_*`, `hexagon_brown*` | Progress bars (eat hold timer, stress test), food pips if needed |
| `rpg/` | UI Pack RPG Expansion | `panel_*`, `panelInset_*` | Lighter (beige) panel and inset for text |
| | | `buttonLong_*` (with `_pressed`), `buttonRound_*` | Poke buttons with a pressed look |
| | | `iconCheck_*`, `iconCross_*` | Step done, not enough food |
| | | `arrowBeige_*`, `arrowBrown_*` | Spin the board left or right |
| | | `cursorHand_beige`, `cursorGauntlet_bronze` | "Pinch here" or "grab here" hint hand |
| | | `barBack_*`, `barGreen_*` (left, mid, right) | Simple horizontal bar |
| `icons/` | Game Icons | `arrowUp/Down/Left/Right`, `up`, `down`, `left`, `right`, `return` | Direction hints, board height and spin |
| | | `checkmark`, `cross`, `exclamation`, `information`, `question`, `warning` | Tutorial hints and feedback |
| | | `pause`, `home`, `gear`, `audioOn`, `audioOff`, `next`, `previous`, `plus`, `minus` | Pause panel and later settings |
| | | `star`, `trophy`, `medal1`, `medal2`, `target`, `locked`, `unlocked` | Win panel, achievements, Locked tool state |

**Sharpness rule:** an image must have at least as many pixels as it covers in the headset, or it looks blocky. Small icons scaled up must come from `vector/` (SVG, sharp at any size) or be drawn in code (the arrows in `src/ui/uiImages.ts`). The small `rpg/` cursors and arrows (about 25 px) are too small for anything but tiny use.

| `vector/` | UI Pack Adventure (SVG) | `checkbox_beige_*`, `minimap_icon_exclamation_yellow`, `minimap_icon_star_yellow`, `banner_hanging`, `panel_brown` | Sign checkbox, tutorial marker "!", star, sharp versions of the banner and panel |

| `board/` | Board Game Icons (white PNG, 128 px "Double"; their SVGs have no viewBox and draw off-canvas, so the PNGs are used) | `skull`, `suit_hearts`, `hourglass`, `crown_a` | The compass's goblin count (skull), the end panel's stats (heart, skull, hourglass), a new best and the card's "Best" (crown). Tinted in code |
| | | `skull` | The campaign card's difficulty skulls and its "Difficulty" label, the Goblins sound row |
| | | `structure_tower`, `shield`, `bow` | The Custom Game card's facts row (camps, guards, archers; castle health uses the heart) |
| | | `award` | The campaign card's "Reward" |
| | | `flag_triangle` | The Custom Game page with no levels yet |
| | | `sword`, `hand`, `arrow_rotate` | Settings rows: Battle sounds, Your reach, Table |
| `icons/` (added) | Game Icons (white, 100 px) | `musicOn`, `wrench` | Settings rows: Music, Tools (the Voice row uses `audioOn`, Quiet horn `audioOff`, Unlock all tools `unlocked`). `star` and `locked` now draw the campaign list's and cards' stars and lock, `trophy` the trophy counter |
| `borders/` | Fantasy UI Borders (white PNG, "Double") | `panel-border-010` (thin frame, notched corners), `divider-fade-002` (fading line with a cross) | The glass sign's frame (9-slice); the divider beside the end panel's level name and under the campaign and Custom Game cards' names (mirrored, tinted) |

More useful parts left in Downloads (2026-11-12 look): Board Game Icons also has crown_b, fire, campfire, resource_apple, pawns, dice and cards; Fantasy UI Borders has 32 frames in four styles (lines only, filled, transparent border, transparent center) and 12 dividers; Game Icons has about 130 more (white and black, 1x and 2x).

Not copied (still in Downloads if needed): the other colors (blue, grey, red variants), the small "Default" sizes, black icons, spritesheets, vector files, minimap compass and rings, scrollbars and patterns. No font was downloaded. The panels use the browser's sans-serif until a Kenney font is added.
