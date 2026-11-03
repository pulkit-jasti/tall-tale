# Audio

Status: most sounds chosen. Enemy sound cues are decided in [core-loop.md](core-loop.md#3-direction-cues-sound-first).

**Files:** `public/audio/README.md` maps each sound below to Kenney files. Use them from the build step where each feature is built. Sounds it lists as missing use the IWSDK starter sample (`public/audio/chime.mp3`) until the last build step. Each sound is referenced by name from one config file, so swapping files needs no code changes.

Back to [GDD index](GDD.md).

---

## 1. Core sounds (about 25)

**Enemies**
- Grunt chatter loop
- Runner buzz or giggle loop
- Climber giggle (right before it pops up)
- Squeal when grabbed
- Death poof
- Camp rumble

**Player**
- Grab
- Eat: chomp, gulp, small burp
- Pause button click
- Soft "ready" tick (hand in range of something grabbable)
- Slingshot: stretch, release, hit
- Swatter: whoosh, splat
- Pepper: shake, sneeze
- Stunned "dizzy" sound
- Tool poof back to its platform
- "Not enough food" buzz

**Map**
- Keg explosion
- Boulder roll
- Tree creak and crash

**Castle**
- Wall hit
- Flag creak
- Worker cheer
- Troop sword clashes
- Wave horn
- Win fanfare, lose trombone
- Ambient wind and birds

---

## 2. Sources to browse

- [Kenney audio packs](https://kenney.nl/assets/category:Audio): CC0 (Impact, Interface, RPG packs)
- [Freesound](https://freesound.org): filter by CC0
- [Sonniss GDC bundles](https://sonniss.com/gameaudiogdc): royalty free, very high quality
- [Pixabay sound effects](https://pixabay.com/sound-effects/): free license
- [OpenGameArt](https://opengameart.org): filter by CC0
- [jsfxr](https://sfxr.me): make cartoon pops and blips ourselves

Check each license before use.

---

## 3. Tech notes

- Short compressed files. 25 sounds are about 1 to 3 MB in total. The browser caches them after the first load.
- Sound can only start after a user tap (browser autoplay rule). The "Enter VR" tap unlocks it.
- One sound emitter per enemy group, not per enemy (performance, see [core-loop.md](core-loop.md#performance)).
