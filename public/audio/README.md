# Sounds

Most are CC0 from Kenney packs (the Freesound files are listed below). Short `.ogg` files (the Quest browser plays them). Numbered files are variants: pick one at random so repeats do not sound robotic. Sound names in docs/audio.md map to these files in the sound config.

| Sound (docs/audio.md) | Files |
|---|---|
| Ready tick | `interface/tick_001`, `tick_002` |
| Button poke, pause click | `interface/click_001`, `click_002`, `select_001` |
| Pause panel open, close | `interface/open_001`, `close_001` |
| "Not enough food" buzz | `interface/error_004`, `error_006` |
| Food added | `interface/confirmation_001`, `confirmation_002` |
| Tool poofs onto its platform, returns | `interface/maximize_008`, `minimize_008` |
| Stunned "dizzy" | `interface/glass_001`, `glass_002` |
| Grab (pinch or fist) | `rpg/cloth1`, `cloth2`, `handleSmallLeather` |
| Goblin dropped back on the board | `interface/drop_001`, `drop_002` |
| Eat: chomp | `rpg/chop`, `impact/impactSoft_medium_*` |
| Slingshot stretch | `rpg/creak1` to `creak3` |
| Slingshot release | `interface/pluck_001`, `pluck_002` |
| Pebble hit | `impact/impactPunch_medium_*` |
| Swatter whoosh | `rpg/knifeSlice`, `drawKnife1`, `drawKnife2` |
| Swatter splat | `impact/impactSoft_heavy_*` |
| Pepper shake | `rpg/handleCoins`, `handleCoins2` |
| Bell (stun by hand) | `144497__wuola__medieval-bell-a3.wav` (Freesound, below; was `impact/impactBell_heavy_000`, `_001`) |
| Wall hit | `impact/impactMining_*` |
| Tree creak, crash | `rpg/creak*`, `impact/impactWood_heavy_*` |
| Boulder, keg debris | `impact/impactPlank_medium_000`, `impactWood_heavy_*` |
| Troop sword clashes | `impact/impactMetal_light_*`, `impactMetal_medium_000` |
| Gear flying off | `impact/impactTin_medium_000`, `rpg/metalPot1` |
| Death poof | `impact/impactGeneric_light_*` |
| Troop footsteps (one per group, optional) | `impact/footstep_grass_*` |
| Wave start | `voice/round_1` to `round_5`, `final_round`, `fight`, `begin`, `ready`, `prepare_yourself` |
| Win, lose | `voice/you_win`, `winner`, `flawless_victory`, `you_lose`, `game_over` |

## From Freesound (top folder)

Check each file's license on its Freesound page (the number in the name is the sound's id). CC0 needs nothing; CC BY needs a credit line in the game.

| Sound | File | Notes |
|---|---|---|
| Goblin voice (`goblinCackle`): not played yet, the climber giggle later | `202096__spookymodem__goblin-cackle.wav` | |
| Squeal when grabbed or loaded (`squeal`) | `442817__qubodup__goblin-growl.wav` | |
| Gulp after eating (`gulp`) | `646981__huw2k8__monster-eating-a-goblin.wav` | 5.5 s, may need a trim |
| Sneeze (`sneeze`) | `368802__inspectorj__sneeze-single-d.wav` | |
| Camp rumble (`campRumble`) | `173318__bliss__collab-2-war-drums-95-bpm.wav` | 17.7 s, cut at 3 s in code; 4.5 MB, should be trimmed |
| Boulder roll (`boulderRoll`) | `807186__sound368__boulder-roll.wav` | |
| Balloon pop (`balloonPop`) | `372182__supersound23__pop.mp3` | |
| Wave horn (`waveHorn`) | `539956__adharca__war-horn.wav` | |
| Win fanfare (`winFanfare`) | `99961__cgeffex__medieval-fanfare_neonaeon_tweaked-by-cgeffex.wav` | |
| Bell (`bell`) | `144497__wuola__medieval-bell-a3.wav` | Converted from the AIFF download (the Quest browser cannot play AIFF) to mono WAV with macOS `afconvert`; the AIFF was deleted. 10 s, played whole and once (not again while it rings) |

Downloaded but not used yet:

- `276874__lucabia__sword-hits.wav`: 10 s of many hits. Cut into single hits for `swordClash`.
- Music (`MUSIC` in `src/config/sounds.ts`): `812170__giangallegos__ambient-music.mp3` on the menus and the pause panel, `649132__sonically_sound__medievalfantasy-rpg-loop-mix-at-32-secs-to-extendrepeat.flac` in battle (looped at 32 s).
- `875456__coretexzip__fantasy-village-ambience-renaissance-fair-ambient.wav`: ambience idea. 20 MB, needs a shorter loop as `.ogg`.

## Still missing

Goblin chatter, burp, keg explosion, worker cheer, lose trombone, ambient wind and birds, night crickets, torch crackle. Keep `chime.mp3` as the placeholder for these.
