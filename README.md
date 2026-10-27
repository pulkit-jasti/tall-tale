# Tall Tale

A seated, hands-only VR game for Meta Quest.

You are a giant who made a deal with a small kingdom: you protect them, they feed you. You sit in the middle of their round castle while a tiny battle rages all around you. Haul carts, load and crank war machines, pick up and place troops, roar at enemies, and when goblins get too close, pick one up and eat it.

The feeling we want: being a kid playing with toy soldiers and machines, making up your own battle story, except the toys are alive.

---

## Status

- Stage: design in [docs/GDD.md](docs/GDD.md). IWSDK project set up, no game code yet (starter template files still in `src/`).
- Next step: the MVP build ([docs/mvp.md](docs/mvp.md)).
- Some sections below are older than the GDD docs. When they disagree, the docs win.

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
| Best Accessibility Forward Experience | $25,000 | Voice alternatives, quiet mode, rotating board, threat cues |
| Boldest Original Concept | $25,000 | You sit inside the board. Only works in VR |
| Best Reason to Come Back | $25,000 | Needs a good progression design |
| Judge's Choice | $20,000 x2 | Bonus |

---

## The game

### Theme and story

- You are a giant. A kingdom agreed to feed you if you fight for them.
- You sit at the center of their round castle.
- Enemies (goblins, orcs and other non-human creatures) attack from all sides.
- Your troops march out of the castle gates below you. Look down and you see them leaving.

### Core idea

- You do not fight alone. Your army does most of the fighting, like a tiny Totally Accurate Battle Simulator battle around you.
- Your job is to **help the battle turn**: keep machines loaded and firing, move troops where they are needed, and step in when things go wrong.
- The skill is **management and timing**: knowing which station needs loading, which side is losing, and where to turn next. Like a cockpit game, but every control is a physical object you handle.
- Even when you are not doing anything, the battle around you is fun to watch.

### Three distance zones

| Zone | What happens there | What you do |
|---|---|---|
| Far | Enemies arrive | Hit them with war machines and the slingshot |
| Middle | Troops and enemies clash | Pick up and place troops, push carts, block paths |
| Near (castle walls) | Enemies that broke through | Smash them with your hands, or eat them |

Each zone is the backup for the one before it.

### Player actions

All actions are simple grab, drag, pull and release. No complex gestures.

- **Handheld slingshot:** pull back and release to throw stones.
- **War machines** (examples, final list not locked):
  - Multi-arrow launcher
  - Ground catapult
- **Machine loop (example: arrow launcher):**
  1. Push an empty cart to the storage area near the castle.
  2. Tiny workers load it (about 10 seconds).
  3. Push the loaded cart to the arrow station. Workers load the machine.
  4. Grab the lever and turn it to wind the spring and charge the machine.
  5. Aim it.
  6. Press the big launch button.
- **Pick up and place troops** anywhere on the board, like a hands-on real-time strategy game.
- **Smash** enemies near the walls (last resort, not the main action).
- **Eat enemies:**
  1. Pick up a tiny enemy.
  2. Bring it toward your face and tilt your head up. The giant's mouth opens.
  3. The enemy struggles, waving its arms and legs.
  4. Let go. It drops into your mouth, which closes.

### Tools and unlocks

- There is a fixed set of tools. No AI-generated tools.
- No loadout. Tools unlock as you progress, and every unlocked tool is always available. Details in [docs/giant-tools.md](docs/giant-tools.md).

### Hunger (proposed)

- The giant has a hunger meter that affects strength.
- The kingdom feeds you when you protect it well.
- Eating enemies is emergency food.

### Voice (optional, never required)

- **Troop commands:** shout orders like "Charge!", "Fall back!", "Open the gate!" Useful because your hands are busy with machines.
- **Roar:** a loud, sustained shout makes nearby enemies flinch and scatter. Uses only microphone volume, no speech recognition.
- **Hand alternatives are required** for every voice action (for example, grab and blow a war horn, or raise a banner). This keeps the game hands-only and also helps accessibility.

### Surround play and comfort

- The battlefield wraps around you, including threats from above (flyers, towers).
- **Always a full 360 degree board.** Two handles in front of you let you spin the board and set its height with both hands, so you never need to turn around. A seated game does not need a small world, just one that is easy to bring to you. Works in any chair.
- **Comfort:** only the board spins. The sky, horizon and your tools stay still. Snap rotation is a later comfort option.
- **Threat cues:**
  1. Spatial audio from the real direction of the threat (main cue).
  2. Visual cues (smoke, glow) as an accessibility option only.
- Details in [docs/controls-and-ui.md](docs/controls-and-ui.md).
- Threat cues matter for judging too ("FoV-aware design"), because Meta VR Glasses have a different field of view than Quest.

### Emergence

- Emergence comes from combining systems, not from scripted moments.
- Being a giant who can pick up almost anything creates unplanned solutions, for example:
  - Throw an enemy into its own army.
  - Drop your archers onto a tower.
  - Block a path with a cart.
  - Crush a squad with a loaded cart.
- Score the result, not the method. If something silly works, it counts.

### Difficulty and pacing

Lessons from games the developer enjoyed:

- **Plants vs. Zombies:** every enemy is a question and every tool is an answer. Introduce something new almost every level.
- **Kingdom Rush:** stopped being fun when enemies just got tankier. **Make it harder with new problems, not bigger health bars.**
- **Social Empires / Social Wars:** units that move and fight on their own, and things you build that keep working.
- **Totally Accurate Battle Simulator:** physics chaos that is fun to watch.

Enemy ideas (not locked): shield walls, swarms, flyers, wall climbers, battering rams, saboteurs that attack carts.

Introduce one new station or enemy type per level so players are never overwhelmed.

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
- Simple shapes generated in code where packs do not cover it.

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

- **For now:** a plain browser link hosted on **GitHub Pages** (HTTPS, which WebXR needs). Vite needs the repo base path set (for example `/tall-tale/`). The player opens the link and taps "Enter VR" once.
- **Later: PWA and Store app.** Meta's Bubblewrap tool wraps the site into a Quest app. The app loads our hosted URL full screen and can launch straight into VR. Every web deploy updates the installed app, with no new build or Store review. Then use a separate test URL so the live version only changes when we choose. Whether the competition needs a Store build or accepts a link: check the Devpost rules.
- **Quest browser:** Chromium based, kept close to desktop Chrome. Service workers, Cache Storage, IndexedDB and Web Audio work. Remote debugging with Chrome DevTools works. Use feature detection, not user-agent checks (Quest 3S reports itself as "Quest 3").
- **Limits:** a mobile chip, no Web Speech API, entering VR and playing sound both need a user tap, storage limits are not documented by Meta.
- **Loading:** the browser caches files after the first load. Keep audio small. A service worker for offline play can come with the PWA.
- **AR mode (later):** IWSDK supports passthrough. Avoid depending on the sky or backdrop so AR stays a cheap toggle.

### Voice tech

- The Quest browser has **no built-in speech recognition** (no Web Speech API).
- Microphone access through the standard browser API (`getUserMedia`) is reported to work, but Meta does not officially document it inside immersive mode. **Must be tested in the spike.**
- Ask for mic permission on the 2D start page before entering VR.
- One mic stream is used two ways:
  - **Roar:** Web Audio API measures loudness. Loud and longer than about half a second counts as a roar.
  - **Commands:** audio goes into **vosk-browser**.
- **What Vosk is:** an open-source speech-to-text engine that runs fully on the device, with no API calls. vosk-browser runs it in a Web Worker so the game does not freeze. With a small fixed word list it is fast and accurate. The model is about 40 to 50 MB and should be cached.
- Meta's own Voice SDK is Unity only and cloud-based, so it does not apply.
- Paid alternative if Vosk is too slow: Picovoice (on-device, has a web SDK). Check licensing first.

### Performance budget (starting point)

- Units on the board: roughly 40 to 80 small troops and enemies. Confirm in the spike.
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

## Week 1 spike (prove the risky parts first)

- [ ] Hand grab, drag and release of small physics objects (carts, troops) feels good
- [ ] Lever crank and pull-to-release slingshot feel good without haptics
- [ ] "Eat" trigger near the face works reliably
- [ ] Microphone works inside the immersive session on Quest browser
- [ ] Roar detection by volume
- [ ] Vosk recognizes a command in under about 300 to 500 ms on Quest 3S
- [ ] Frame rate with many units, physics and Vosk running together
- [ ] Spinning the board with two handles feels comfortable
- [ ] Slingshot release direction is steady with hand tracking

**Toy test:** build a tiny version with no menus or levels: you, a castle, a few goblins walking in, one machine and one cart. If it is fun to mess around with for 10 minutes, keep going.

---

## Timeline (draft)

| Dates | Goal |
|---|---|
| Oct 15 to 21 | Join Start program, get the Quest 3S, set up IWSDK project, week 1 spike |
| Oct 22 to 28 | Core: castle, board, troop and enemy behavior, pick up and place, one machine with the cart loop |
| Oct 29 to Nov 4 | More tools (slingshot, arrow launcher, catapult), eating, hunger, roar, voice commands with hand alternatives |
| Nov 5 to 11 | Levels (about 5), enemy types, onboarding, boss fight |
| Nov 12 to 15 | Polish, sound, performance, demo video, Devpost write-up |
| Nov 16 | Submit (2 days of buffer before the deadline) |

**Cut first if behind:** voice commands, then extra machines, then hunger.
**Never cut:** hands-only flow, onboarding, a stable frame rate, the eating moment.

---

## Open questions

- Subtitle for the name (to make it searchable), for example *Tall Tale: The Giant's Keep*
- Final list of tools and machines
- Endless scoring and difficulty curve (see [docs/modes-and-progression.md](docs/modes-and-progression.md))
- Win and lose conditions for each battle
- How the hunger meter works exactly
- Progression between battles (what keeps players coming back)
- Exact enemy types and what each one asks of the player
- Hand alternatives for each voice command

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
14. **Calibration screen:** replaced by auto placement on Play, the handles, and a "Reset table" button.

---

## References

### Past competition winners worth studying

From the 2025 Meta Horizon Start Developer Competition:

- **Tiny Golf** (Best Casual Game, $100k): mixed reality mini golf, "all you need is a pinch."
- **Little Critters** (Casual runner-up): mixed reality tower defense with minimal, fun hand interactions.
- **Saber Punks** (Best Social Game): VR fighting game with motion combos.
- **Hand Survivor** (Best Hand Interactions): seated wave survival with gesture spells and squishing. Our closest competitor in feel, so we avoid gesture spells and make smashing a last resort. Their future plans include a "kid playing with toys" theme, so we keep our framing about a giant and a kingdom.
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
