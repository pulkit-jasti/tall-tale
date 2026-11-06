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
- **Where sounds come from** (`SOUND_MIX` in `src/config/sounds.ts`, `src/audio/sound.ts`): positional sounds use the browser's head model (HRTF) on the listener at the head, so they turn with the board and the head. Left and right are clear (headset test after steps 7 and 8).
  - **Mono:** every positional file is mixed down to mono in code before it is placed (the files stay as they are). A stereo file places each channel on its own, which smears the direction. In the test, mono and stereo sounded the same for the goblin cackle (its channels are nearly the same), but mono can only help.
  - **Distance:** full volume up to 35 cm, then quieter (about 30% at 1 m, 15% at 2 m).
  - **Behind muffle:** the head model hardly tells front from back (confusing in the test), so a sound behind the head is muffled (low pass down to 1800 Hz) and a little quieter (70%). It starts at the side and is strongest straight behind, and follows the head and the board as they turn. One low pass and one volume per positional voice (12), updated each frame only for playing sounds.
  - A better head model (Google's Resonance Audio) was looked at and left out for now: a new dependency and more audio work on the Quest, and it still hardly tells front from back.
