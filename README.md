# Tall Tale

A seated, hands-only VR game for Meta Quest.

You are a giant who made a deal with a small kingdom: you protect them, they feed you. You sit in the middle of their round castle while a tiny battle rages all around you. Your little army does most of the fighting. You turn the battle with giant tools (a slingshot, a fly swatter, a pepper shaker, a bell and a war horn that calls your knights), and when goblins climb the wall, you pick one up and eat it. Tools are free but rest after each use, and eating fills them up faster.

The feeling we want: being a kid playing with toy soldiers, making up your own battle story, except the toys are alive.

---

## Status

- **MVP build steps 1 to 6 are done and tested on the headset** (2026-11-03 to 2026-11-05): the board, castle and ring handle, grab and eat, the slingshot, 5 tutorial waves with a guided tutorial, both flags, the fly swatter, pepper shaker, food jar, triggers, troops, megaphone and bell, pause, and the giant's seat and body.
- **Steps 7 and 8 are built and tested on the headset** (2026-11-05 to 2026-11-10): three troop kinds with gear (swordsmen, spearmen, archers), goblin spears and helmets, balloon riders from wave 4, the stress test with troops, and the juice pass (knockout stars, hit stop, food labels, confetti and more). Next: the stress test result, then the missing sounds.
- Details, open items and the build order are in [docs/mvp.md](docs/mvp.md). Frame rate results are in [docs/performance.md](docs/performance.md).
- **Day and night is built** on the branch `feat/day-night-cycle` (2026-11-05, tested on the headset 2026-11-10, [docs/mvp.md](docs/mvp.md#day-and-night-cycle-started)): four times of day that follow the waves, a dark night with stars, a moon and a ringed planet, glowing windows, torches and lanterns, and a bright edge on the units so goblins stay easy to spot. Stylized hands are a far future idea. The MVP has a hand-made tutorial map. The level generator comes later.
- **The same branch grew much more** (2026-11-05 to 2026-11-10, tested on the headset 2026-11-10, typecheck, build and tests not run yet, nothing committed, [docs/mvp.md](docs/mvp.md#more-on-the-same-branch-sound-ui-and-a-livelier-world)): real sounds from Freesound and menu and battle music, sound placement fixes (mono, a muffle behind the head, soft ends on long sounds), a pause button in front instead of on the wrist, a settings page with Sound and Access tabs, sliders and a sliding switch, the bell as a choice in place of the megaphone, our own UI library, menus centered in front of the eyes, one 3D arrow as the only tutorial marker, a throw lesson, farther and bigger goblin camps, story scenes, villagers, road torches, a rolling pebble, and tutorial fixes (reach check, pepper, balloons).
- **v2 run 1 is built** on the branch `feat/v2` (2026-11-10, build only, not tested on the headset yet, typecheck and tests not run, [docs/v2-plan.md](docs/v2-plan.md)): gear with real effects (helmets and shields as extra hits, spears and swords, goblin shields and swords), every goblin climbs (bash, climb, rampart, courtyard), free tools with use windows and recharge rings (eating fills them; the food jar and price tags are gone), the pepper disarms, the bell knocks the rampart down, the war horn replaces the megaphone and calls field knights who charge and hold a junction, and a wall garrison of 4 archers and 2 guards.
- **v2 run 1 tuned over 15 headset rounds** (2026-11-10 to 2026-11-11, build only, committed, typecheck and tests not run): the horn aimed by gaze with a lock that follows the look and a one-frame blow, knights routed over the roads in up to 4 squads, a tutorial that never skips a lesson (Skip tutorial instead), the glass sign, opposite-hand ghost demos, the bell rewritten, auto-pause for the Quest menu and a headset taken off, and a cleaner debug page with notes and a mic panel. The current state and the handoff are in [docs/v2-plan.md](docs/v2-plan.md#run-1-as-it-stands-now-after-15-headset-rounds-2026-11-10-to-2026-11-11). Next: the stress test, typecheck and tests, then run 2 (the tutorial rebuild, levels, saving, menus).
- **v2 run 2 is built and tested on the headset** on the branch `feat/v2-menus` (2026-11-11, works well after several headset rounds, typecheck and tests not run, not committed yet, [docs/menus.md](docs/menus.md#11-as-built-run-2)): after the tutorial the battleground sinks and the home screen rises: a compact main menu of round buttons in front, a campaign panel with a list of 15 levels (1 to 5 open, tap to pick, a slider to scroll), stars and a rectangular Fight button, a tool shelf and a loadout stand on the right (the battle's own platforms: slingshot and horn fixed, 2 slots the player fills; any tool goes anywhere, with a glowing snap zone), an achievements shelf with trophies on the left, saving in the browser, and "Unlock all tools" in the settings. The bell left the tutorial and unlocks at level 3, and battles have 4 waves. On the same run: the knights and goblins fight rewritten (the whole squad fights, on the way out too, no goblin walks past), the battle tools moved back behind the flags, and the board sits 50 cm below the eyes. Reworked over several headset rounds, following Meta's hands UI guidance. Next: the level generator and Custom Game (below).
- **Next: the level generator and Custom Game** ([docs/custom-mode.md](docs/custom-mode.md), decided 2026-11-11, not started): one generator for every level, run from the command line too, with winding roads that are part of the gameplay; the wave director; each level on its own map; camps that rise as their wave starts (the tutorial too); all 15 campaign levels made with it; and the Custom Game menu with new UI kit parts.
- The full design lives in [docs/GDD.md](docs/GDD.md) and the files it links. This README is a short overview. When they disagree, the docs win (and [docs/v2-plan.md](docs/v2-plan.md) wins over every other doc).

---

## Competition

- **Event:** Meta VR Start Developer Competition 2026 (Devpost)
- **Deadline:** Nov 18, 2026 at 12:00pm PST. **Our target: submit by Nov 16.**
- **Winners announced:** around Dec 11, 2026. The build must stay online until then.
- **Track:** Gaming
- **Division:** New Experience (built from scratch after Sep 24, 2026)
- **Eligibility:** must be a member of the Meta VR Start program before submitting. Needs a Meta developer account.

### Hard requirements

- **Hands first:** the whole experience must be playable with hands only, with no controller ever paired.
- **Policy compliance:** must follow Meta's developer and content policies.

### Design guidelines (scored, not pass/fail)

- **Seated:** works in a chair within about 2 ft ("airplane seat test").
- **Easy in and out:** fast start, clean pause and resume, a satisfying moment within 10 minutes ("bus stop test").
- **Original, not a wrapper:** the core must be our own work, not a thin layer over a third-party service.

### Judging (Stage 2, each 25%)

1. Innovation and Creativity
2. Experience Design (seated, hands-first, user journey)
3. Technical Implementation (hand tracking, gaze, passthrough, spatial anchors, FoV-aware design)
4. Polish and Presentation (UI/UX, art, sound)

Stage 1 is a pass/fail check that the project fits the theme and uses the required features.

### What to submit

1. A playable build. For IWSDK this is a hosted link (GitHub Pages or Vercel).
2. A demo video under 3 minutes on YouTube or Vimeo. Lead with the best footage. Judges may stop at 3 minutes.
3. The Devpost form: name, 140-character tagline, track, division, description (inspiration, how it was built, future plans, under about 500 words), how hand interactions work, target launch date.

### Prizes we are aiming for

| Prize | Amount | Why we fit |
|---|---|---|
| Best New Gaming Experience | $100,000 (runner-up $50,000) | Main target |
| Best First Five Minutes | $25,000 | Eating a goblin in the first minute is the hook |
| Best Accessibility Forward Experience | $25,000 | Quiet mode (bell instead of voice), rotating board, threat cues |
| Boldest Original Concept | $25,000 | You sit inside the board. Only works in VR |
| Best Reason to Come Back | $25,000 | Daily Battle, Endless high score, growing kingdom, achievements ([docs/modes-and-progression.md](docs/modes-and-progression.md)) |
| Judge's Choice | $20,000 x2 | Bonus |

---

## The game

### Theme and story

- You are a giant. A kingdom agreed to feed you if you fight for them.
- You sit at the center of their round castle.
- Enemies (goblins, orcs and other non-human creatures) attack from all sides.
- Your troops march out of a hidden gate at the front of the castle and fight on their own.

### Core idea

- You do not fight alone. Your army does most of the fighting, like a tiny Totally Accurate Battle Simulator battle around you. On their own they lose slowly, so you are always needed.
- Your job is to **help the battle turn**: listen for where enemies come from, spin the board, and use the right tool at the right time.
- Even when you are not doing anything, the battle around you is fun to watch.

### Three distance zones

| Zone | What happens there | What you do |
|---|---|---|
| Far | Enemies leave their camps | Slingshot, shoot triggers (powder kegs, boulders, trees) |
| Middle | Troops and enemies clash | Slingshot, war horn |
| Near (castle wall) | Enemies hit the wall, climbers pop up | Fly swatter, pepper shaker, grab and eat |

Each zone is the backup for the one before it.

### What the player does

All actions are simple grab, pull, shake, poke and release. No complex gestures. Details in [docs/giant-tools.md](docs/giant-tools.md) and [docs/controls-and-ui.md](docs/controls-and-ui.md).

- **Grab and eat:** pinch a tiny goblin and hold it near your mouth for a moment. Your bare hands only grab and eat. No smashing, and a toss does no damage.
- **Slingshot (free, always):** pull back and release to shoot pebbles. Precise, middle and far. A pebble thrown by hand only knocks a goblin back. Load a goblin instead of a pebble for a stronger shot that knocks over the ones around it, at the cost of a meal.
- **Fly swatter (10 s, then 20 s recharge):** swatting groups near the wall and on the rampart.
- **Pepper shaker (8 s, then 20 s):** goblins in a small area lose their weapon, helmet and shield, sneeze and become "seasoned".
- **Bell (one stun, then 35 s):** shake it to stun every goblin and knock the ones on the rampart back down.
- **War horn (one call, then 30 s):** hold it at your mouth (or blow into the mic) to send a squad of knights charging down the road in front of you.
- **Move the board:** grab the ring handle in front of you. Pull sideways to spin the board, or up or down to raise or lower it. Each grab locks to one direction.

### Tools and eating (v2)

- Tools are free, with a use window and then a recharge; a ring on each platform shows it. Eating a goblin fills every recharging ring a little (a seasoned one twice as much).
- Every goblin climbs the wall, so there is always something in reach to eat. Your army: a wall garrison of archers and guards, and knights that only come when you blow the horn.
- Run 2 adds a loadout (the slingshot and the horn, plus 2 picked tools) and unlocks in a 15 level campaign ([docs/menus.md](docs/menus.md)).

### Win and lose

- Two flags in front of the player: the red castle health flag slides down with damage, the blue wave flag climbs one notch per wave.
- Win by surviving all waves. Lose when the red flag reaches the bottom. Details in [docs/castle-rules.md](docs/castle-rules.md).

### Voice (optional, never required)

- **War horn (v2, replaces the megaphone):** blowing into the mic uses only its loudness, no speech recognition. Mic permission is asked on the start page.
- **Voice troop orders:** later, not in the MVP.
- **Hand alternatives are required** for every voice action. The horn also blows when simply held at the mouth for a moment, and a "Quiet horn" setting never listens to the mic. This keeps the game hands-only and helps accessibility.

### Surround play and comfort

- The battlefield wraps around you.
- **Always a full 360 degree board.** One ring handle in front of you spins the board and sets its height, so you never need to turn around. Works in any chair.
- **Comfort:** only the board spins. The sky, horizon, hills, your tools and the two flags stay still. A later comfort setting turns the board in snap steps instead of smoothly.
- **Threat cues:**
  1. Spatial audio from the real direction of the threat (main cue).
  2. Visual cues, on by default: the wall top flashes red with a dust puff where it is hit ([docs/controls-and-ui.md](docs/controls-and-ui.md#threat-cues)).
- Threat cues matter for judging too ("FoV-aware design"), because Meta VR Glasses have a different field of view than Quest.

### Emergence

- Emergence comes from combining systems, not from scripted moments.
- Examples: one slingshot shot sets off a powder keg that knocks a tree across the road; pepper a group, then eat them for double food.
- Score the result, not the method. If something silly works, it counts.

### Difficulty and pacing

Lessons from games the developer enjoyed:

- **Plants vs. Zombies:** every enemy is a question and every tool is an answer. Introduce something new almost every level.
- **Kingdom Rush:** stopped being fun when enemies just got tankier. **Make it harder with new problems, not bigger health bars.**
- **Social Empires / Social Wars:** units that move and fight on their own, and things you build that keep working.
- **Totally Accurate Battle Simulator:** physics chaos that is fun to watch.

Enemies are in [docs/enemies.md](docs/enemies.md). The MVP has grunts, runners and climbers.

Introduce one new tool or enemy type at a time so players are never overwhelmed.

---

## Art style

- Low poly, inspired by Totally Accurate Battle Simulator.
- Low poly is partly a necessity (time, experience, Quest hardware), but it suits the game: units are tiny and seen from far away.
- Rules that keep low poly looking good:
  - Strict palette of 4 to 6 colors.
  - One directional light, sky-colored ambient light, distance fog for depth.
  - Same level of chunkiness everywhere.
  - Lots of motion: squash and stretch, particles, hit pauses, wobble.
  - Strong sound effects (half of perceived polish).
- Free CC0 asset packs: **Kenney.nl** and **Quaternius**, in glTF format. Check each pack's license page.
- Simple shapes generated in code where packs do not cover it. The MVP mapping is in [docs/assets.md](docs/assets.md) and [docs/placeholder-shapes.md](docs/placeholder-shapes.md).

---

## Tech

### Engine: IWSDK (WebXR)

Chosen over Unity because:

- The developer knows JavaScript, not C#, and has never shipped in Unity.
- Development relies heavily on coding agents, which work much better with plain code than with Unity's editor-driven workflow.
- Fast testing on a Mac: open the dev URL in the Quest browser over Wi-Fi with hot reload, or use the Chrome emulator.
- Judges just click a link.
- New IWSDK projects ship with an MCP server and code search server for AI agents.

Known costs of IWSDK vs Unity:

- Lower polish ceiling: full-screen bloom and post-processing are expensive, so glow is faked with shaders.
- Lower performance budget because of browser overhead.
- No visual editor. Every effect is written in code.
- Fewer ready-made assets than Unity's Asset Store.
- Basic hand grab visuals compared to Unity's Interaction SDK.
- Slightly slower first load.
- Last year (2025) there was a separate IWSDK award. In 2026 there is not, so we compete directly with Unity games.

### Hosting and the Quest browser

- **For now:** a plain browser link hosted on **GitHub Pages** (HTTPS, which WebXR needs). Vite uses a relative base (`./`), so the build works under the repo path on GitHub Pages. The player opens the link and taps "Enter VR" once.
- **Later: PWA and Store app.** Meta's Bubblewrap tool wraps the site into a Quest app. The app loads our hosted URL full screen and can launch straight into VR. Every web deploy updates the installed app, with no new build or Store review. Then use a separate test URL so the live version only changes when we choose. Whether the competition needs a Store build or accepts a link: check the Devpost rules.
- **Quest browser:** Chromium based, kept close to desktop Chrome. Service workers, Cache Storage, IndexedDB and Web Audio work. Remote debugging with Chrome DevTools works. Use feature detection, not user-agent checks (Quest 3S reports itself as "Quest 3").
- **Limits:** a mobile chip, no Web Speech API, entering VR and playing sound both need a user tap, storage limits are not documented by Meta.
- **Loading:** the browser caches files after the first load. Keep audio small. A service worker for offline play can come with the PWA.
- **AR mode (later):** IWSDK supports passthrough. Avoid depending on the sky or backdrop so AR stays a cheap toggle.

### Voice tech

- The Quest browser has **no built-in speech recognition** (no Web Speech API).
- Microphone access through the standard browser API (`getUserMedia`) is reported to work, but Meta does not officially document it inside immersive mode. **Must be tested early in the headset.**
- Ask for mic permission on the 2D start page before entering VR.
- One mic stream is used two ways:
  - **Megaphone (MVP):** Web Audio API measures loudness. A loud scream past a fixed threshold triggers the stun.
  - **Voice troop orders (later, not in the MVP):** audio goes into **vosk-browser**.
- **What Vosk is:** an open-source speech-to-text engine that runs fully on the device, with no API calls. vosk-browser runs it in a Web Worker so the game does not freeze. With a small fixed word list it is fast and accurate. The model is about 40 to 50 MB and should be cached.
- Meta's own Voice SDK is Unity only and cloud-based, so it does not apply.
- Paid alternative if Vosk is too slow: Picovoice (on-device, has a web SDK). Check licensing first.

### Performance budget (starting point)

- Units on the board: roughly 40 to 80 small troops and enemies. Measured: about 50 goblins at 72 Hz so far ([docs/performance.md](docs/performance.md)).
- Frame rate: 72 Hz, asked for on entering VR (the Quest 3S browser default is 90 Hz).
- Instancing for repeated meshes.
- Simple collision shapes only.
- Object pooling for projectiles and units.

---

## Hardware

- **Meta Quest 3S, 128 GB** ($349.99). Recommended over Quest 3: same hand tracking, much cheaper, and its narrower field of view helps us design for "FoV-aware" judging.
- **No eye tracking needed.** Quest 3 and 3S have none. Gaze in Meta's SDKs falls back to head direction. Eyes are optional in the Gaming track.
- **Meta VR Glasses** (Meta's new headset, built-in eye and hand tracking, no controllers by default) ship in spring 2027 for $1,299.99. Not available for this competition, but our game should run on them since they use the same OS as Quest.
- A phone cannot be used. The project must target Meta VR devices.
- Simulators (Immersive Web Emulator for Chrome) are enough to start, but real hand tracking, mic and performance need the headset.
- Quest Link is Windows only, so on Mac we test through the Quest browser.

---

## Risky parts to prove first (in the headset)

These are checked during the first MVP build steps ([docs/mvp.md](docs/mvp.md#build-order)).

- [x] Pinching tiny (about 3.5 cm) goblins with the snap pinch zone feels reliable
- [x] "Eat" trigger near the face works reliably (first try opened the Quest menu, now hold near the mouth instead)
- [x] Spinning the board with the ring handle and setting its height feel comfortable
- [x] Enemies at the wall are visible from the seat (no hidden strip)
- [x] Slingshot release direction is steady with hand tracking (steady release, the slingshot locks during a pull, stronger aim assist)
- [x] Pepper shake and swatter swings are detected well (step 4, with tools snapping into a real grip)
- [ ] Microphone works inside the immersive session on Quest browser, and the scream threshold works
- [ ] Wrist pause button does not open by accident
- [x] Frame rate with many units: about 50 goblins at 72 Hz with no dropped frames ([docs/performance.md](docs/performance.md)). Re-test with troops and physics in step 5.

---

## Timeline

| Dates | Goal |
|---|---|
| Oct 15 to 30 | Competition setup, Quest 3S, IWSDK project, full design |
| Oct 31 to Nov 11 | MVP build, in the order in [docs/mvp.md](docs/mvp.md#build-order) |
| Nov 12 to 15 | Polish, real sounds, performance, demo video, Devpost write-up |
| Nov 16 | Submit (2 days of buffer before the deadline) |

The MVP is the submission. Endless, Daily Battle and the other modes are bonus if time allows.

**Cut first if behind:** the last steps of the MVP build order, then extra juice.

---

## Open questions

- Subtitle for the name (to make it searchable), for example *Tall Tale: The Giant's Keep*
- Castle machines: cut in v2 ([docs/castle-machines.md](docs/castle-machines.md) stays as history)
- Endless scoring and difficulty curve ([docs/modes-and-progression.md](docs/modes-and-progression.md))
- Final food numbers and climber counts (tune in playtests)
- Goblin walk speeds now that the camps are farther out (a grunt takes about 60 s to reach the wall instead of about 33 s)
- Background music: the two tracks in place are a first pick. The plan is layers that follow the game (calm by day, a march layer in waves, the ethereal version at night), quiet under the sound cues ([docs/audio.md](docs/audio.md))

---

## History: how we got here

Ideas we explored and why they changed. Kept so we do not repeat old discussions.

1. **Power ring constructs (first pitch, "Imaginaut"):** create any object by voice with generative AI. Dropped because generation is too slow for fast gameplay, it needed a backend and moderation, and showing the hidden rules made it feel like a card game.
2. **Green Lantern name:** dropped. It is DC's IP and would be disqualified.
3. **Hold a controller button to talk:** dropped. Breaks the hands-only rule.
4. **Tabletop tower defense in front of you:** too close to Hand Survivor (2025 winner), which uses gesture spells and squishing on a tabletop.
5. **Elemental chemistry (fire, ice, electric):** overdone trope.
6. **Disaster rescue and cute critter rescue (Lemmings style):** limited the kinds of solutions and felt childish.
7. **Kitchen or restaurant sim:** one of the most crowded VR genres.
8. **Life-size arena combat:** too close to Gorn (gladiator physics melee) and the old "wave shooter" genre.
9. **Surround board:** kept. You sit inside the battlefield. Rare in VR strategy games.
10. **Two armies with you as the giant:** kept. Inspired by Totally Accurate Battle Simulator, Social Empires and faction fights in Watch Dogs, Far Cry and GTA.
11. **Fixed physical tools instead of AI constructs:** kept. Better for hand tracking, much smaller scope, more polish.
12. **180 degree default with 120 and 360 presets:** replaced by a full 360 board the player spins and adjusts with two-handed handles. Unique, and fully seated.
13. **Loadout before each battle:** dropped. Tools unlock and are always available.
14. **Calibration screen:** replaced by auto placement on Play, the handles, and a "Reset table" button. Later a short reach check came back (see 36): one move, a few seconds, framed as part of the welcome, not a settings screen.
15. **Hunger meter:** replaced by the food jar, a resource that only fills by eating and never drains on its own.
16. **Carts, machines and picking up troops as the core loop:** on hold. The giant's own tools and eating became the core. Machines will be decided after the first playtest.
17. **Smashing, slapping and throwing enemies with bare hands:** dropped. Bare hands only grab and eat, so the fly swatter has a clear role and the hands stay simple.
18. **Voice troop commands and roar:** replaced by the megaphone tool for the MVP. Voice orders may come later.
19. **One castle flag:** replaced by two flags (castle health and wave progress) that stay in front of the player and do not spin with the board.
20. **Palm-up wrist menu:** replaced by a wrist button poked with the other hand, because Quest reserves the palm-facing pinch for its own menu.
21. **Two-handed handles (twist to spin, lift for height):** replaced by two one-handed handles with one job each and a big arrow beside each. Clearer, and works with one hand.
22. **Bell only after the MVP:** the bell is now in the MVP next to the megaphone, because voice must never be required.
23. **Two one-job handles (rotate knob and height bar):** replaced after the first headset test by one ring handle in front of the player. Each grab locks to spin or height, both 1:1. The knob's track was too short for 360 degrees and the fist grab was shaky, so the ring accepts a pinch too.
24. **Eat by letting go with the head tilted up:** replaced after the first headset test by holding the goblin near the mouth for a moment. The old pose turned the palm toward the headset, and the pinch opened the Quest menu.
25. **Goblins drop straight down when let go:** after the first headset test they keep the hand's speed and fly in a simple arc. Still no throwing as an attack (see 17): a toss does no damage.
26. **Slingshot fixed on its platform, with the pebble loading itself:** replaced after the first slingshot headset test. The player now picks up the slingshot by its handle with one hand and aims by turning the body, pinches a pebble from the bowl and clicks it into the pouch, then pulls with the other hand. Aiming one-handed on a fixed frame was too fiddly, and the auto reload did not feel good. Pebbles and their hit area also got bigger.
27. **Dropped pebbles only fall:** pebbles now toss like goblins. A thrown pebble knocks a goblin back, dazed, but never knocks it out, so the slingshot keeps its purpose. A held goblin can also be loaded into the slingshot: it knocks out what it hits plus a small splash, and costs a meal (eat or shoot).
28. **Tutorial with no text (only glows, poofs and sounds):** replaced in step 3 by a guided, learn-by-doing tutorial with short text on a hint sign, a marker on the target, and see-through ghost hands that show each gesture (Meta's onboarding guidance). Without text, nobody knew what to do.
29. **Info steps that move on by time or by looking:** replaced by a Next button. A player may look at something without noticing it, so reading is never rushed. Hand lessons still move on by themselves when done, and tools are taught by actions only, with no Next.
30. **A timer that ends each wave:** dropped. It ended waves while goblins were still attacking, which rewarded doing nothing. A wave now ends when cleared or when the castle falls.
31. **A hint sign in front during waves and a goblin counter:** the sign now hides while a wave is fought, so it never covers enemies, and the counter is gone (the blue flag shows progress, no numbers).
32. **A solid box slingshot pouch:** replaced by an open upright leather strip, because the loaded stone disappeared inside the box.
33. **Tool platforms inside the ring, close to the body:** moved just outside the ring into a reach band (40 to 50 cm from the eyes, from Meta's hands guidance), low, rising with the board. The castle grew to the edge of that band. Food pips became price tags with a number.
34. **Food jar explained before wave 1:** moved to right before the first food tool, and taught by eating a goblin, because a lone info step was easy to miss.
35. **Out-of-view arrows and "it is to your left" hints from head direction:** removed. A simple pointer comes later.
36. **One board size for everyone:** after the second step 4 test everything still felt too close. Now a reach check ("Show me how big you are, giant!") measures the player's stretched arm once and scales the whole board so the rampart sits a little inside that reach. The board is also placed lower (46 cm below the eyes), so the player towers over the kingdom.
37. **Tools held at the grab angle:** a fist grab now snaps the tool into the hand the way it is held in real life, because some grabs needed an awkward wrist.
38. **Visual threat cues off by default:** now on by default (wall hit flash). With the sound off, goblins at the wall were hard to find. An attack compass arc with red marks was tried too and dropped: the wall flash was enough.
39. **Five times of day (morning, noon, afternoon, sunset, night), one per tutorial wave:** replaced by four looks that work for any number of waves (first morning, last night, the one before sunset, the rest day). Noon and afternoon looked almost the same in the cartoon style.
40. **A bright moonlit night, so goblins stay visible:** replaced by a dark night where the units carry the readability: a bright edge on troops and goblins, and the terrain darker. A first terrain fade toward grey-blue looked washed out, so it now only darkens.
41. **A ringed planet sitting on the horizon:** it looked like it was on the ground, so it moved high into the sky, farther away, in one faded color. Later smaller and a little lower, with warm orange-red stripes.
42. **Stereo sounds placed as they are:** most files are stereo, which smears where a sound comes from. Every placed sound is mixed to mono in code now (the files stay as they are). A test showed left and right work, but front and back were confusing, so sounds behind the head are muffled and a little quieter. Google's Resonance Audio was looked at and left out (a new dependency, more work on the Quest, and front and back stay hard anyway).
43. **Long sounds stopping dead:** drums, the horn and the fanfare now fade out over their end. Short cues keep their sharp end.
44. **A pause button on the wrist:** the palm pose was hard to find and the button flickered. Pause is now a button on a post straight in front, below the Next button's spot, and steps aside while Next shows.
45. **The balloon banner after the pepper lesson:** it came too fast and the pepper lesson never really ended. The pepper lesson now ends when a peppered goblin is eaten (peppered goblins sneeze for 10 s and do no damage meanwhile), and balloons are taught in the slingshot wave, after the trigger lessons and a few more knockouts: one balloon hovers in front until it is popped, no Next button.
46. **Camps shaking before goblins come out:** too cartoony for buildings. Only the drum sound is left.
47. **Camps close to the castle:** most of the board was empty. Camps moved out to about 400 cm (the front one to 300 cm, so its details can be seen), became bigger war camps, each different, and the empty land got story scenes, villagers and road torches.
48. **Big round glows around torches:** they read as floating balls, not light. Road torches now light a soft oval pool on the ground, and castle torches and lanterns have only a small halo.
49. **A volume slider with minus and plus buttons and a mute button:** too much. Just one long slider per sound group now, all the way left is off, its handle like the buttons (green in a dark rim, a gold one looked out of place), grey at off.
52. **Menus with explaining text:** subtitles and help lines are gone. Each menu shows only its title and a word over each button.
53. **Buttons that wanted a slow push:** a quick poke was missed (the click waited for the animated cap to catch up, and a fast finger could skip past the button between two tracking frames). The click now goes by the finger itself, and a finger that was in front one frame and in the next counts.
54. **The tutorial rushing on:** a finished lesson moved on after 1.2 s while the player was still trying it. Now a green tick shows for 3.5 s and the next step waits that long; other steps leave a short gap. The sign hangs in front of the eyes outside waves, and Next only blinks once it was missed for 5 s.
55. **A red arrow that jumped between threats:** it now stays on the nearest threat until that one is handled.
56. **A megaphone that went deaf at random:** the mic chain is now rebuilt when it hears perfect silence, is muted, or the audio was paused.
50. **Menus placed by hand-picked heights:** the settings page grew too tall and its low rows were hard to touch. Every menu now gets its height from one rule: right in front of the eyes, never higher than 2 cm above them or lower than 30 cm below (`UI_ZONE`).
51. **UI code written again in each panel:** buttons on posts, button rows, panel text, canvas textures and draw-on-top code were copied around. It all lives in our own UI library now (`src/ui/kit/`), and new UI must be built from it.
57. **Food currency, food jar and price tags (v2):** one favorite tool got used all the time, and the jar was one more thing to read. Tools are free now, with a use window and a recharge ring on the platform; eating fills every ring a little ([docs/v2-plan.md](docs/v2-plan.md)).
58. **Climbers as their own type (v2):** goblins could hide behind the wall, and there was little to eat. Every goblin now bashes, climbs, runs on the rampart and jumps in, so the order of threats is always clear.
59. **Spears for looks, helmets one hit, big hits through armor (v2):** helmet and shield are each one extra hit for every hit (triggers ignore armor), spears double wall damage, swords strike soldiers faster, and the pepper strips it all.
60. **The megaphone scream and the bell as its voice-free twin (v2):** the bell is now the only stun and also knocks the rampart down; the new war horn calls the knights, held at the mouth or blown into the mic, so voice is still never needed.
61. **Squads walking out every 14 s to the camp and back, with field archers (v2):** they looked aimless. A wall garrison (4 archers, 2 guards) defends the rampart, and field knights only come when the horn calls them, charge down the road in front and hold its first junction.
62. **Castle machines on hold (v2):** dropped, no time to design, add and balance them. Only the giant's hand tools.

---

## References

### Past competition winners worth studying

From the 2025 Meta Horizon Start Developer Competition:

- **Tiny Golf** (Best Casual Game, $100k): mixed reality mini golf, "all you need is a pinch."
- **Little Critters** (Casual runner-up): mixed reality tower defense with minimal, fun hand interactions.
- **Saber Punks** (Best Social Game): VR fighting game with motion combos.
- **Hand Survivor** (Best Hand Interactions): seated wave survival with gesture spells and squishing. Our closest competitor in feel, so we avoid gesture spells and have no smashing at all. Their future plans include a "kid playing with toys" theme, so we keep our framing about a giant and a kingdom.
- **Pocket Lands** (Best Hand Interactions): lap-sized voxel diorama.
- **Dun Jun, The Nanauts** (IWSDK award): proof that IWSDK can make decent games.

Patterns from the winners:

- Mixed reality and passthrough won a lot.
- Simple input wins.
- Most main track winners were built in Unity or Unreal.

### Games for inspiration

- Totally Accurate Battle Simulator (art style, physics chaos)
- Plants vs. Zombies (pacing, enemies as questions)
- Kingdom Rush (what not to do with difficulty)
- Social Empires / Social Wars (moving units, lasting builds)
- Besiege, Poly Bridge (players enjoy breaking physics)

### Links

- [Competition page](https://start-developer-competition-26.devpost.com/)
- [Competition resources](https://start-developer-competition-26.devpost.com/resources)
- [2025 winners](https://developers.meta.com/vr/blog/meta-horizon-start-developer-competition-meet-the-winners/)
- [2025 project gallery](https://start-developer-competition.devpost.com/project-gallery)
- [Hand Survivor](https://devpost.com/software/handsurvivor)
- [IWSDK docs](https://iwsdk.dev/)
- [IWSDK project setup](https://developers.meta.com/horizon/documentation/iwsdk/guides/01-project-setup/)
- [Immersive Web Emulator (Chrome)](https://chromewebstore.google.com/detail/immersive-web-emulator/cgffilbpcibhmcfbgggfhfolhkfbhmik)
- [Kenney assets](https://kenney.nl/)
- [Quaternius assets](https://quaternius.com/)
