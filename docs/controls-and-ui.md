# Controls and UI

Status: first pass. Only what is decided so far.

Back to [GDD index](GDD.md). Related: [Giant tools](giant-tools.md), [Castle rules](castle-rules.md).

---

## 1. Principle: show things in the world

- No floating panels in front of the player. The battlefield is the main view and must stay clear.
- Game state is shown with objects in the world:

| Info | Shown as |
|---|---|
| Castle health | The red flag on its pole ([castle-rules.md](castle-rules.md#2-the-two-flags)) |
| Battle progress | The blue wave flag, one notch per wave |
| Where damage is happening | The wall top flashes red with a dust puff on each hit (see "Threat cues"). Later cracks, smoke and fires on the wall. Plus spatial sound |
| Tool use and recharge (v2) | A flat ring on each tool's platform: it drains in cream while a use runs, fills in blue while the tool recharges, flashes white when eating fills it, hidden while ready ([giant-tools.md](giant-tools.md#3-use-windows-and-recharge-v2)) |
| Tool recharging | Tool dimmed (the Locked look) and its ring filling |
| The horn's blow | A live bar on the glass sign while the spot is locked at the lips, full and gold for 1.5 s after a blow |

- In-world displays also help with "FoV-aware design" and polish in judging, and keep the "toys on a table" feeling.

### Interaction feedback (applies to everything you can touch)

Every grabbable or pokeable thing (goblins, tools, handles, buttons, the pause button, trophies) uses the same states, so the player learns them once. There are no haptics, so these are the main feedback.

| State | When | Look | Sound |
|---|---|---|---|
| Idle | Hand far away | Normal | None |
| Ready | Hand within grab or poke range | Soft white brighten | Soft tick |
| Held / pressed | Grabbed or poked | Orange | Grab or click |
| Locked | Ready, but cannot be used (a tool recharging, an empty pouch) | Stays dimmed, small wobble | A buzz |

- **Only one target per hand.** Only the nearest thing in range is Ready, so the player always knows what they will grab.
- **The tutorial hint is different:** a slow pulse, not a steady brighten, so "look here" never gets confused with "you can grab this".
- **Buttons** also press in when poked.
- **Cheap to draw:** change the material's emissive color only. No outline effects or post-processing (performance budget).

### Reach band (where interactive things go)

Every grab, pinch and poke target must be a comfortable reach from the chair. Too close is as bad as too far: the elbows jam, and hand tracking gets worse near the body and face.

| Distance from the eyes | Zone | What goes there |
|---|---|---|
| Under 30 cm | Too close | Nothing (it also overlaps the eat zone, 22 cm from the face) |
| 30 to 40 cm | Close | Nothing that is reached often |
| **40 to 50 cm** | **Best** | Everything the hands use often: the ring handle, the tool handles, the pebble bowl, the Next and panel buttons |
| 50 to 63 cm | Edge | Only things reached now and then: goblins on the rampart, intruders in the courtyard |
| Over 63 cm | Out of reach | Only things the tools reach (the slingshot, the swatter's long handle), and things to look at (the hint sign) |

- **Where the numbers come from:** Meta's hands guidance ("Hands UI best practices", "Spatial UI inside interactive 3D scenes") puts direct touch at 42 to 46 cm and says to avoid 50 to 80 cm, the "middle distance" where people reach, miss and give up. It also says frequent actions belong low, because raised arms tire quickly. The close limit is our own, from the eat zone and the first headset tests.
- **Measured from the eyes** with the board at its placed height (50 cm below the eyes, lowered from 36, then 40, then 46 after the headset tests, so the player towers over the kingdom) and its default size. Board spots convert with `reachDistance()` in `src/rules/reach.ts`: for example 33.5 cm out and 10 cm above the board is about 52 cm (the lower board pushed the low targets, platforms and ring, a little past the sweet spot; the dev server lists them).
- **Everything is sized from it:** the ring handle (27 cm out, about 48 cm from the eyes), the tool platforms just outside it (33.5 cm out, tops 6 cm above the board, handles about 49 cm), and the castle: the wall at 46 to 52 cm, with goblins on the rampart at about 62 cm.
- **Then sized to the player:** the reach check (below) scales all of it to the player's arms.
- **Low:** tool platforms sit low (6 cm above the board), so the hand reaches them without lifting the arm.
- **Checked in code:** `REACH` in `src/config/game.ts`. The dev server warns at start about any spot in `reachSpots()` outside the band. Add every new interactive thing there.

### Reach check ("Show me how big you are, giant!")

Arm length varies a lot between players, and the default size felt too close in the step 4 test. So the first tutorial step measures the player's reach and sizes the whole board to it.

- **What the player does:** the sign says "Show me how big you are, giant! Sit back and stretch one arm straight out: hand flat, thumb up, fingers spread." A see-through ghost hand loops the move: from the chest, the right arm goes straight out, holds, and comes back.
- **The pose:** hand flat with the thumb up and the palm facing in, so the hand's side faces the headset and the cameras see every finger. The palm never faces the headset (that is the Quest menu gesture).
- **No rush:** nothing counts for the first 3 s (time to read the sign), a hand must be at least 40 cm from the head (level, was 33), and it must have settled: moving slower than 8 cm/s for 0.6 s. While it is out but still moving, the sign says "Good! Now hold your hand still." If the hand moves a lot again during the countdown (faster than 25 cm/s for a quarter second), the player is still adjusting: the countdown stops and waits for it to settle again. Before, it started the moment a hand was out, with no time to read.
- **Countdown:** once a hand is out and still, the sign shows "Great, hold it there... 3", then 2, then 1, with a tick each second (the text pops on each number). If the arm drops for more than 0.4 s, it waits again. When it ends, a chime plays and the ticked sign says "Done! You can rest your arm now."
- **What it measures:** the farthest the pinch point gets, as a level distance from the head (not the seat, so leaning forward does not count), smoothed so a tracking spike never counts.
- **What it changes:** the whole board (everything in `boardLift`: board, castle, goblins, ring, tools, flags, sign, panels) scales so the rampart sits at 88% of the measured reach, a comfortable reach rather than a full stretch. Everything keeps its place relative to the wall. The scale stays within 0.85 to 1.45, and the board grows or shrinks to it smoothly, so the player sees it fit them.
- **Once per player:** the size is saved in the browser. Without tracked hands (browser), it gives up after 40 s and keeps the default size. "Measure reach" on the pause panel runs the check again right away, on the frozen battle, without starting it again. "Measure reach again" on the debug page forgets it and starts the battle with the check.
- Numbers in `CALIBRATION` in `src/config/game.ts`, code in `src/player/reachCheck.ts`.

### Holding a tool

After the step 4 test, tools stuck to the hand at whatever angle the grab happened, so some needed an awkward wrist to use. Now a fist grab **snaps the tool into the fist the way it is held in real life**, so there is nothing to learn:

- The handle runs through the fist and the tool sticks out past the thumb. Like a real handle lying across the palm, it leans forward (toward the fingers) about 35 degrees from the knuckle line (25 felt too upright in the headset), so it lines up with the knuckle bones (`HOLD.tiltDeg`). The ghost hand's tool grab demos close the fist at the same slant.
- **Fly swatter:** held near the end of the handle, its flat face square to the palm (it first sat in line with the palm, which felt wrong in the headset). It leans 10 degrees more than the other tools (45), because its head must touch the goblin or the ground to swat, and the extra lean gets it there without bending the wrist.
- **Pepper shaker:** upright in the fist, holes above the thumb. Tip the wrist to point the holes down.
- **Slingshot:** fork up past the thumb, arms spread across the palm, the shot going the way the knuckles point (arm stretched out, thumb up).
- The fist frame comes from the knuckle joints (wrist to middle knuckle, pinky knuckle to index knuckle), not from the wrist joint's own angle, so it matches what the player sees.
- Right after the grab the tool eases into place over about 0.15 s, so it never jumps.
- A pinch grab (the slingshot handle, or the hand tools if `TOOLS.acceptPinch` is on) keeps the angle it grabbed at.
- The war horn (v2) is held like the megaphone was: the mouthpiece toward the wrist, so it is at the mouth when the fist is just below and to the side of it (`HOLD.poses.horn`).
- Numbers in `HOLD` in `src/config/game.ts` (where the fist holds each tool, which way it faces), code in `src/player/hold.ts`. The ghost hand grab demos already close the fist this way.

### Threat cues

Players who cannot hear, or play with the sound off, still need to know where goblins are hurting the castle. On by default (`THREAT` in config, `src/ui/threatCues.ts`):

- **Red pointer arrow (step 6):** a goblin hitting the wall, climbing it or running on the rampart that has been at the edge of the view or out of it for 1.5 s gets a fast blinking red 3D arrow in front of the face pointing at it, so no goblin hides behind the player.
- **Rampart flash:** the stretch of wall under a goblin running on the rampart flashes red like a wall hit (no damage). A giggle plays where one pops up (v2).

- **Wall hit flash:** every hit makes that part of the wall top flash red and fade, with a small dust puff. The wall top is easy to see from the seat, also out of the corner of the eye.
- An "attack compass" arc with red marks inside the ring was tried and removed after the headset test: the wall flash alone reads well enough.

### Pinch and grab (the two hand actions)

| Action | How | Used for |
|---|---|---|
| **Pinch** | Thumb and index finger together | Small things: picking up goblins, pulling back the slingshot pouch, taking pebbles from the bowl, other small actions |
| **Grab** | Close the whole hand into a fist | Big things: the slingshot handle, fly swatter, pepper shaker, bell, war horn, the ring handle |

- Buttons (Play, pause panel, pause button) are poked with the index finger, not pinched or grabbed.
- Each object accepts only its own action, so a pinch never picks up the swatter and a fist never picks up a goblin.
- Exception: the ring handle and the slingshot handle accept a pinch too. In the first headset test a fist with the back of the hand toward the headset tracked poorly, because the fingers are hidden.
- A fist counts when 3 of 4 fingers are curled, so one badly tracked finger does not break it.

---

## 2. The 360 degree board

The board is a full circle all the time. There are no 120 or 180 degree modes. A seated game does not need a small play area, it needs a world that is easy to bring to you.

### Rotating and adjusting by hand

One **ring handle** on the inner rim, right in front of the player, below where the hands do most of the work. It is a wooden rail in a full circle around the player on short poles, a little lower than the wall top. Small bands are spread evenly around it, so it is easy to see it turn. (Being tested as a full circle. It started as a 120 degree arc in front, and `halfSpanDeg` in config switches back.) It works with one hand, which also helps players who can only use one hand.

- **Grab it anywhere** with a fist or a pinch, from on top of it.
- **No accidental grabs** (second headset test: resting hands on the lap and goblins in the courtyard both set it off):
  - The grab zone is a band on and above the ring (about 6 cm). A hand below the ring, like one resting on the lap, never grabs it.
  - The hand must be open in the zone for a moment (about 0.15 seconds) first. Then the ring glows Ready with a tick, and closing the hand grabs it. A hand that curls up while drifting by does nothing.
  - A goblin in pinch range always wins over the ring.
  - Goblins inside the castle stay near the wall (courtyard band 40 to 44 cm), away from the ring and the tool platforms.
- **The first 4 cm of hand movement lock one direction** for that grab. Smaller drifts do nothing:
  - **Sideways:** the board spins with the hand 1:1 (around the vertical axis only, no tilting). The ring turns with it. On release both stay where they are (no spring back, which felt uncomfortable in the headset test). For a big turn, pull, let go, grab again and pull again (about 4 to 6 pulls for a full turn).
  - **Up or down:** the board rises or lowers with the hand 1:1, within a wide range (about 25 cm down and 35 cm up). On release the board stays at the new height.
- It never spins and changes height in the same grab, so a swinging arm does not make the board bob.
- **Letting go:** the ring lets go only when the hand is clearly open for about a quarter second, so tracking flickers do not drop it.
- **Compass letters:** all 8 directions (N, NE, E, SE, S, SW, W, NW) raised in blocky gold on the ring's inner face, where it turns up toward the eyes, in the same gold as the bands (they light up with the ring). The four main letters are bigger, like a real compass. The ring has 8 bands, one between each two letters. They turn with the ring and the board, so N always points at the north of the map (the north camp). A cosmetic touch that also gives directions a name: the sign can say "goblins from the east!" (`HANDLES.compass`, `src/world/compassLetters.ts`). Wooden plaques with flat letters were tried first.
- Arrows: a curved double arrow lies on top of the ring at the front, and a small up and down arrow stands on it 50 degrees left and right of front. The arrows never turn: they always stay in front of the player. The bands and poles turn with the ring.
- The ring follows the standard Ready and Held states (see [Interaction feedback](#interaction-feedback-applies-to-everything-you-can-touch)). The arrows light up together with it.
- Oversized grab zone, so it is easy to grab without looking closely.
- Full circle or arc: a full circle can be grabbed anywhere, even at the sides. The tool platforms stand just outside it, so the full circle stays.
- Turning is a choice: the player can turn their head, or spin the board. Spinning takes a hand off the battle, so "spin to the new threat now, or finish this group first?" is a real decision.
- Enemy sounds sit on the board, so they turn with it automatically.

### Rejected

- **One pair of two-handed handles (twist to spin, lift to change height):** two jobs on one control, nothing on the handles explained them, and it needed both hands.
- **Two one-job handles (a rotate knob on a short track and a height bar on rails):** the first headset test showed the knob's track was too short for a 360 degree board, the height range was too small, and the fist grab was shaky. Replaced by the ring handle.

### Comfort rules

- **Only the board rotates.** The sky, the horizon, the hills, the tool platforms (with the pebble bowl) and the two flags never turn. The platforms, flags and hint sign rise and fall with the board, so they always stand at the same spot on it and the ring never passes through them. If the whole world spins around the player, it causes motion sickness, even when the player is the one spinning it (a whole-world turn was tried on paper after the step 5 review and dropped for this reason).
- **Movement follows the hands exactly (1:1)**, with no smoothing or lag. Moving the world is only comfortable when the player clearly causes it.
- **Comfort setting (later):** for players who get motion sick, the board turns in snap steps (30 degrees) instead of smoothly.
- Later ideas: a small "momentum" flick spin for fun.

### Placement and fallbacks

- **Auto placement:** when the player presses Play, the board is placed at a fixed distance below the head, facing where the player is looking.
- **Reset table:** a button in the pause menu runs auto placement again (at the starting height), for when the board ends up somewhere odd.
- **Quest recenter:** if the player recenters with the Meta button, the game catches it and places the board again. A web game cannot trigger the system recenter itself, which is why "Reset table" exists.

---

## 3. Grab and eat

The player's own hands do only two things: pick up goblins and eat them. There is no smashing or slapping, and a toss is never an attack. A held goblin can also be loaded into the slingshot pouch ([giant-tools.md](giant-tools.md)).

### Pick up (pinch)

- Goblins are tiny (about 3.9 cm), too small to pick up reliably with tracked fingers. So the pinch zone is much bigger than the goblin: about 5 to 6 cm around the hand's pinch point.
- When the player pinches (thumb and index) inside that zone, it snaps to the nearest goblin. The goblin lifts into the fingers.
- A grabbed goblin struggles: arms and legs wave, it squeals.
- The goblin that would be grabbed shows the Ready state while the hand is near (see [Interaction feedback](#interaction-feedback-applies-to-everything-you-can-touch)).

### Eat

1. Bring the held goblin toward the face, like eating a snack (hand within about 22 cm). The goblin pulses. It must not require touching the mouth.
2. Keep it there for a moment (about 0.2 seconds). It is eaten without letting go. Chomp, gulp, small burp. Every recharging tool's ring jumps forward (v2, [giant-tools.md](giant-tools.md#eating-fills-every-recharge-ring)).

- **No letting go and no head tilt.** In the first headset test, holding a goblin above the face with the head tilted up turned the palm toward the headset, and the pinch opened the Quest menu. Now the palm can face down or sideways the whole time.
- If the pinch breaks close to the face anyway (tracking loss or the menu gesture), the goblin is still eaten instead of dropped.

### Letting go anywhere else

- The goblin keeps the hand's speed, so letting go mid-swing tosses it in an arc. It lands on whatever is under it (courtyard, wall top or field), bounces once on a hard landing, is dazed for a moment, then carries on. Letting go of a still hand drops it straight down.
- A toss does no damage and is not an attack. It is only there so goblins feel like real little things.
- Pebbles from the bowl use the same toss. A thrown pebble only knocks a goblin back, dazed, and never knocks it out ([giant-tools.md](giant-tools.md)).
- Simple projectile math per flying goblin (gravity, ground height, one bounce), no physics engine, so it costs almost nothing. The hand speed is smoothed and capped, so tracking jitter cannot fling a goblin off the map. Numbers are in `GOBLIN_RULES` in `src/config/game.ts`.

---

## 4. Menus

- **2D start page:** one "Enter VR" button (the browser needs one tap to enter VR). Before entering VR it asks for mic permission (v2: for blowing into the war horn; holding it at the mouth works without). Built in step 5: on the first visit the button says "Allow microphone", its tap shows the browser prompt, then it says "Enter VR" (opening VR needs a fresh tap). A line under it says whether the mic is on (blow into the horn) or not (hold it at the mouth). If the mic was allowed before, it opens with no prompt and one tap enters VR. Later it can offer an optional "Install app" button.
- **In VR:** the menu is the board in peacetime, with a giant menu board and trophy shelf. See [modes-and-progression.md](modes-and-progression.md#2-the-menu-is-the-board-in-peacetime). MVP: a single Play button.
- **End of battle (MVP):** a simple win or lose panel. See [castle-rules.md](castle-rules.md#4-end-of-battle-screens-mvp).

---

## 5. Pause and settings

### What hand tracking games do

- **Palm pinch is taken by the system.** On Quest, a pinch with the palm facing the player is reserved for the system on both hands. The right one opens the Quest menu. Meta's WebXR docs say the left one (the three bars icon) acts like the left controller's menu button, which leaves the WebXR session, but in our headset test it did nothing. Apps cannot use either one or turn them off, so the game never relies on them.
- A common pattern is a **wrist button**: a small button on the inside of one wrist that shows when the player turns that palm toward their face. The other hand's index finger pokes it. We tried it, but the palm pose was hard to find and the button flickered, so ours is a fixed button in front.

### Our pause

- **Pause button on a stand in front**, outside the ring, low (9 cm up) so it does not block the view ahead, on the tutorial Next button's spot (Next was lowered to the same height, so the two line up). It was a wrist button until the step 7 and 8 headset test (the palm pose was hard to find and the button flickered).
- **Poke it with either index finger** to pause. The button presses in, with a click sound.
- **Pause panel:** the battle freezes and a small panel appears in front of the player with big poke buttons: "Resume", "Settings", "Restart" and, while the tutorial runs, "Skip tutorial" (a fresh battle from wave 1 with every tool out and no lessons). The welcome panel has **Skip tutorial** too (bottom left, mirroring Settings), for a player who knows the game, for example after clearing the browser's data. Restart and Play again keep the choice; the welcome panel's Play brings the tutorial back. So no lesson ever needs a timer: it waits for the player, and Skip tutorial is the way out.
- **Auto-pause:** the game pauses on its own when the player opens the Quest system menu or takes off the headset. It stays paused until the player pokes "Resume". The FPS panel shows "paused" while it is. The Quest menu can stop the frames without a hidden frame ever reaching the game (headset test: it did not always pause), so it listens to the XR session's and the page's visibility events (even between frames), and also pauses when no frame ran for 0.75 s (`PAUSE.autoPauseGap`). It still missed the right hand's Meta pinch at random, so the gesture itself pauses too: a hand holding nothing starts a pinch with the palm straight toward the eyes, within 45 cm of the head, and keeps it 0.15 s (`PAUSE.metaGesture`). The no-frames pause needs 1.5 s. **Headset taken off:** the Quest 3S has no proximity sensor, so the system never tells the page (Meta's VRC.Quest.Functional.2), and the game played on. It pauses itself when no hand is tracked and the head stays within 3 mm and 0.4 degrees for 5 s (`PAUSE.headsetOff`): a worn headset always moves a little. While paused, the FPS panel says what caused it. The game never uses that pose, and a goblin at the mouth was pinched long before, so it does not pause by mistake.
- **Glass sign** (`GLASS_SIGN`, `src/ui/kit/glassSign.ts`): the see-through variant of the hint sign, a small dark glass label a little above the look's center that follows the look. Lessons where the player must watch what is in front of them use it instead of the hint sign (`Hint.glass`: the horn, the knights' first fight, the balloon), so only one sign ever shows. The horn uses it while held: what to do now, and at the lips a live bar. The bar is plain meshes; a canvas redrawn whenever it moved made the whole view flicker on the Quest.
- **Short text:** every tutorial line is one short instruction in easy words (headset test: players do not read long signs).
- Settings come later (not in the MVP).

**Built in step 6** (`src/ui/pauseMenu.ts`, numbers in `PAUSE`):
- The pause button is the shared poke button with a pause icon, on a post like the Next button, straight in front (38.5 cm out, 9 cm above the board, face tilted 40 degrees toward the eyes, `PAUSE.button`). It rises with the board and never turns. About 53 cm from the eyes, a little past the sweet spot, fine for a button poked now and then. It shows while a battle runs (in VR), and steps aside while the Next button shows (same spot, higher). It ignores pokes for a moment after it comes back, so the finger that poked Next or Resume does not pause at once.
- **Taught first:** the tutorial's first lesson (after the reach check) points the gold arrow at it and asks the player to poke it and Resume (no ghost hand demo).
- Pausing lets go of everything the hands hold (goblins drop, tools go back), freezes the battle and all sound, and hides the hint sign, the gold arrow and the ghost hand.
- The pause panel opens in front of the head, not on the board, at the same spot from the eyes as the end panel and sized with the board, so its buttons are always in the best reach band (about 47 to 49 cm from the eyes), even when the board ended up somewhere odd. It always draws on top of everything (no depth test), so the castle or the sign never hide it. It **follows the head lazily**, like the Quest's own menus: it stays still while the head turns, and swings back in front only once the head turned past the panel's side edge plus 10 degrees (at least 20; or moved 12 cm), so it is never behind the player. The angle goes by the panel's size (`LazyFollow.fitTo`, `PAUSE.follow`): about 38 degrees for the pause panel, 42 for the wide settings page, so the eyes can go to its corners (Back, top left) without it moving away. A fixed 25 degrees made it swing away whenever the player looked at a corner. Four poke buttons (44 cm wide, 10.4 cm apart): **Resume**, **Settings**, **Restart** (the battle again) and **Skip tutorial** (only while the tutorial runs). The settings page opens on its **Access** tab (Access first, then Sound, the two tabs centered in their row). Access holds **Measure reach** (the reach check right away on the frozen battle, the board resizes, then play goes on, no restart), the **Quiet horn** switch and **Reset table** (auto placement again at the starting height, then play goes on; it moved here from the main page). Its buttons ignore pokes for 1 s after it opens.
- Sound stops only for the Quest menu, so the pause panel's clicks are heard.
- **Settings tabs:** the settings page has one tab per category on the right of its top row, **Sound** and **Access** (accessibility). The chosen tab's cap is green, its label bold green and underlined; the others are grey with a light label (color, text and a line, never color alone). Only the chosen tab's rows show. A new category is a new entry in `SETTINGS_TABS` (`src/ui/pauseMenu.ts`) with its own group of rows.
- **Access tab:** "Your reach" with the Measure reach button (the reach check, which used to be on the pause panel), and "Quiet horn" with an on and off switch (v2, was "Bell in place of the megaphone"): the horn never listens to the mic, for players who cannot or do not want to blow (it still sounds after 1.2 s locked at the lips; saved, `src/player/accessSettings.ts`, `hornHearsMic()`). Without a mic the switch shows On and is locked ("No mic: always quiet").
- **The switch** (`src/ui/switch.ts`, `SWITCH`, the shared on and off component): a 7 by 3 cm rounded track with a knob, slid like the slider: touch the knob with the index fingertip and slide it along (1:1). Let go past the middle and it snaps over and flips; short of the middle it springs back with a little bounce (an elastic feel). A tick as the knob crosses the middle, a click when it flips. A tap does not flip it. On: the knob on the right, the track green, the word "On" beside the knob. Off: the knob on the left, the track grey, "Off". So position, color and text all say the same, and it reads for color-blind players too. Idle, Ready, Held and Locked on the knob.
- **Settings page** (the Settings button on the pause panel, or on the welcome panel's bottom right corner, `PAUSE.settings`): Back (top left, its label under it) and the title at the top, then the chosen tab's rows, then below everything the tabs, each name beside its button. The Sound tab has one row per sound group (Music, Goblins, Battle, Tools, Voice and menus, `SOUND_CATEGORIES`): its name and level ("70%" or "Off") and one long slider. All the way left is off; there is no mute button (the slider is easy enough, headset test). Saved in localStorage (`tallTale.sound`), so it holds across visits.
- **The slider** (`src/ui/slider.ts`, `SLIDER`, the shared component for every future slider), from Meta's hands guidelines: touch the handle itself with the index fingertip (touching the track does nothing: it moved two rows at once), slide along (it follows 1:1, no jump), pull the finger back to let go. Only one slider moves at a time. No pinch, nothing to hold. Near the ends it snaps to off and full. The handle is 3.2 cm across (over the 22 mm minimum), the buttons' green (no dark ring around it, that looked odd) over a warm tan fill and the dark track, so it matches the theme and still stands out (a gold one looked out of place), grey at 0 so off shows in color. Targets keep over 12 mm apart, a tick plays at every 10% step and a click on release. The value is saved on release, not during the drag. (Its minus and plus buttons were removed: not needed.)
- **Quick pokes** (`POKE.quickBehind`, `cooldown` 0.35 s): a fast poke used to be missed, because the click waited for the animated cap to catch up and a fast finger could pass the button between two tracking frames. Now the click goes by the fingertip's own depth, and a fingertip that was in front of the face one frame and pushed in the next clicks at once (sliders grab the same way).
- **Minimal text in menus:** a title and a word over each button, nothing more (no subtitles, no help lines).
- **Room in menus** (`UI_SPACING`): nothing comes closer than 2.2 cm to a panel's side or bottom edge, the title banner starts 1.4 cm down, and a label keeps 0.9 cm from its button. The panels got a little bigger for it (welcome and end 34 by 22, pause 44 by 20 with its buttons 2.9 cm apart, settings 52 by 39.8 with rows 4.4 cm apart and the tabs in their own row at the bottom), all inside `UI_ZONE`.
- **Button sizes** (`BUTTON_SIZE`): every button uses one of four sizes, across the rim: medium 4.9 cm (Settings on the welcome panel, Measure reach), standard 6.2 cm (Next, pause, the settings tabs and Back), large 7.5 cm (the pause panel), primary 9.1 cm (Play). `PokeButton` never builds one below `BUTTON_SIZE.min` (4.9 cm across, whatever size is asked for; the old small 3.6 cm size felt too small for the tabs), the dev build warns above 9.1 cm, and keep at least 1.2 cm between targets.
- **One drag at a time** (`canDrag`, `takeDrag`, `endDrag` in `src/ui/kit/controls.ts`): only one slider or switch moves at a time, so a finger sliding one row never moves the next, and a second hand cannot grab another.
- **Button icons** are plain cream shapes, no dark outline (it looked ugly), drawn premultiplied so no dark edge shows either.- Auto-pause in VR during a battle shows the same panel when the player comes back. Outside a battle (welcome or end panel) and in the browser it still resumes by itself.
- Debug: Space pauses or resumes, and the debug page's "Pause panel button 1 to 4" pokes a panel button.

---

- **Opened from the welcome panel**, the settings page comes up alone in front of the head; Back brings the welcome panel again, and Measure reach runs the reach check and then brings it back.

### UI height zone

Menus and panels (the welcome and end panel, the pause panel, the settings page) sit right in front of the eyes, never too high or too low (`UI_ZONE`, `uiCenterY` in `src/rules/reach.ts`): each panel's middle is 15 cm below the eyes, and no part of it reaches higher than 4 cm above the eyes or lower than 34 cm below them (the panel is moved to fit; the dev server warns about a panel too tall to fit at all, and a test checks every panel). Added after the settings page's low rows were hard to touch (then 2 and 30 cm). Grown when the settings tabs got their own row at the bottom: the page is 39.8 cm tall, its top (title, Back) about at eye level, its tabs about 29 cm below the eyes.

### UI library

All UI is built from one shared library, `src/ui/kit/` (import everything from `src/ui/kit/index.js`), so every control looks, sounds and behaves the same, and nothing is written twice:

| Part | What it is | Used by |
|---|---|---|
| `PokeButton` | The round button poked with the index finger (Idle, Ready, Held, a blink while it waits). `locked`: it goes down and buzzes, nothing more | Every button |
| `Slider` | Touch the handle and slide, one at a time, a handle like the buttons, grey at off, ticks per step (SLIDER). `vertical`: upright, 1 at the top. `scrollbar` look ([custom-mode.md](custom-mode.md#ui-kit-parts)): a long pill-shaped handle instead of the round one, for every page that scrolls | Sound settings, the campaign list's scroll, every scrolling page |
| `ScrollList` | v2 run 2: a list whose rows are drawn once into one tall canvas, a window moving over it (scrolling never redraws); a tap selects a row (click), hover lights the row (tick), press darkens it; edge rows show cut off; it draws after its panel and never writes depth (SCROLL_LIST). It can scroll by swiping (Meta's guidance, coasting, springing back), or be tap only (`swipe: false`) and scrolled from outside (`scrollToShare`, gliding smoothly) | Campaign level list (tap only, with an upright `Slider`: swipes and taps got mixed up on the headset) |
| `FightButton` | v2 run 2: the one rectangular button, a bordered box (`PokeButton`'s `box` option, the same poke, looks and sounds) with a sword and "Fight!", red; locked grey with a lock. Every other button is round | Campaign Fight |
| `drawStar`, `drawSkull`, `drawMenuIcon` | v2 run 2: menu icons drawn in code (stars, goblin skulls, sword, lock, flag, sun, sliders, gear, replay, back). The round buttons' `sword`, `lock`, `campaign`, `daily` and `custom` icons use them. Menus use only round buttons (rectangular ones were tried and dropped) | Menus, end panel |
| `Switch` | On and off: knob side, track color and the word On or Off together, slid past the middle to flip (springs back short of it), can be locked (SWITCH) | Access settings (the quiet horn) |
| `StandButton` | A `PokeButton` on a post straight in front, tilted toward the eyes, that starts fresh and locked when it comes out | Next, pause |
| `Panel` | The parchment board with a canvas, its pop, and `root` for its controls. `resize(width, height)` fits it to what is on it now (its canvas stays as sharp, a menu panel keeps its `uiCenterY` height); with `rowPanelWidth` a panel is as wide as its shown buttons need, so a button shown or hidden never leaves a gap | Hint sign, end, pause (sizes to its buttons), settings, menus |
| `LazyFollow` | Keeps a menu in front of the head like the Quest's own menus | Pause panel |
| `armControls`, `changeTouch`, `Control` | A page opened: reset and lock its controls; the shared touch look and ready tick | Every panel, button and slider |
| `rowX`, `bottomRowY`, `panelMap`, `stepValue`, `clamp01`, `angleTo` | Layout math, no Three.js, tested (`layout.test.ts`) | Panels, slider, follow |
| `drawTitleBanner`, `drawLine`, `drawOutlined`, `UI_COLORS` | Canvas text in one look and one set of colors | Panels, labels |
| `canvasTexture`, `canvasPlane` | A canvas as a sharp sRGB texture, and the unlit picture made from it | Panels, button faces, markers, labels, FPS panel |
| `drawOnTop` and `RENDER_ORDER` (config) | Never hidden behind anything, in one table of layer orders | Pause panel; markers, labels, stun ring, arrows and ghost hands use the table |

**Built for Custom Game** ([custom-mode.md](custom-mode.md#ui-kit-parts), 2026-11-11, not tested on the headset yet): `RangeSlider` (two handles), `ChoicePicker`, `NumberStepper`, `SeedControl`, `SettingRow` (name, control and value from a spec), `ScrollArea` (a column of items and the scrollbar: every page that scrolls), `Tabs` (floating rectangular buttons outside a panel's top border; with `FightButton`, the only rectangular buttons), `TextField` (typed with the Quest's system keyboard, a validation line under it; `isTyping` keeps auto-pause away), `CanvasLabel`, and the tick, cross, edit, copy, trash, share, dice and dot button icons.

**Rules learned on the headset (2026-11-11), built into the kit so they hold for every new page:**

- **No canvas redraw while dragging.** Redrawing and uploading a canvas texture on every slider step made the panel flicker, then vanish while sliding (the sound sliders never did: they repaint only when let go). `CanvasLabel.draw` and `Panel.paint` now wait for the drag to end by themselves (`afterDrag`, `isDragging` in `src/ui/kit/controls.ts`); `ScrollArea` flushes waiting redraws every frame. Anything new that redraws a canvas goes through `afterDrag`.
- **Navigation outside, content inside.** Every menu panel's title and Back are a `PanelHeader` (`src/ui/kit/panelHeader.ts`, `HEADER`): a floating plate over the panel's top edge, Back beside it. Tabs and the page's call to action float under the panel (tabs from its left edge, `ActionButton` at its right edge). Done for the main menu, the campaign, the Custom Game pages and the settings page (its tabs are the `Tabs` now, Access first). The pause, welcome and end panels keep their in-panel titles for now.
- **Menu pages draw like the settings page:** on top, in the page's own tree order, inside the `RENDER_ORDER.menu` layer (`layerPage` in `src/ui/kit/onTop.ts`; call it again when a page gets new meshes). Depth-tested Custom Game pages flickered on taps, slider releases and tab changes; the settings page, drawn this way, never did. Anything drawn on top must add its parts back to front (a plate before its text: the settings header's title was hidden by its own plate).
- **Scrolling cuts, never hides early.** `ScrollArea` cuts its rows at the window's edges **in the shader, by world position** (`src/ui/kit/windowClip.ts`). three.js's own clipping planes do not work here: IWSDK draws both eyes in one pass (multiview) and the planes are worked out for one camera, so each eye cut in a different place and rows came and went with the head. A row works while its middle is inside the window.
- **The scrollbar's handle is a block wrapped around its rail** (`SLIDER.scrollbar.wall`), not a pill lying on it.
- **Recenter (the Meta button) places the board again** from the head: the XR reference space's `reset` event (`watchSession` in `src/game.ts`), its height kept. Before, the board kept the turn of the head at its first placement, so after a recenter everything sat a few degrees off.
- **Header plates are unlit** (`MeshBasicMaterial`, `HEADER.color` a vivid coral), so the scene's light never dulls them. Text fields 2.9 cm tall, the scrollbar block 3.8 cm long.
- **Rims 20% taller** (`POKE.rimHeight` 1.08 of the cap's depth, was 0.9), on every button and the text fields (they keep their dark border; their white face covers the whole cap). The cap stops level with the rim's top (`pressMaxFor`, `POKE.capAboveRim`), so it never hides inside it. The scrollbar has its own thin rail (`SLIDER.scrollbar.rail` 0.7 cm). Slider values sit right after their slider (`SETTING_ROW.valueGap`). Save is a bright orange, the header plates a lighter terracotta.
- **Round buttons press as deep as box buttons:** the cap ends level with its rim (`POKE.capShowShare` 0.1), it clicks at 95% of its travel (`fireShare`, was 85%), and it follows the finger faster (`capFollow` 26, was 14), so it no longer clicks while it looks half pushed.

The Kenney UI images and their helpers (`drawBanner`, `drawIcon`, `drawNineSlice`, `fitFont`, `wrapText`, the button icons) come through the same entry. Something new that two places need goes into the library first.

## 6. Accessibility options

None of these are in the MVP. They come after the first playtest (see [mvp.md](mvp.md)).

- **Quiet mode:** built in v2 as the "Quiet horn" switch (Access tab): the horn works by holding it at the mouth. Offered to everyone, no one has to declare a disability. See [giant-tools.md](giant-tools.md).
- **Mic calibration:** a quick test blow sets the horn's blow threshold per player.
- **Handedness:** which side the slingshot platform sits on.
- **Snap rotation:** the board turns in 30 degree steps instead of smoothly.
- **Stronger slingshot aim assist** (see [giant-tools.md](giant-tools.md#slingshot-aim-assist)).
- **Reduced effects:** softer flashes and less shaking (planned).
- **More visual threat cues:** smoke or a glow at enemy camps and approaching groups. (The wall hit flash is already in, on by default, see "Threat cues".)

---

## 7. Custom hand gestures

Hand tracking gives the position of every finger joint every frame, so almost any gesture is possible. The limits come from tracking quality, not the API.

### How tracking works (short version)

- The headset's tracking cameras film the hands. Neural networks on the headset find the hands, estimate the 3D joint positions, and fit them to a hand skeleton.
- It feels instant because the system **predicts** where the hand will be when the frame is shown. Very fast moves can overshoot or drop tracking for a moment.
- Tracking struggles with: one hand hiding the other, very fast motion, hands very close to the face, hands low in the lap or out of camera view.

### How we detect gestures

Not raw joint positions (they change as the whole hand moves). Instead, a few simple measures relative to the hand:

| Measure | How | Used for |
|---|---|---|
| Finger curl | Fingertip distance to the palm (3 of 4 fingers) | Grab (fist) for big tools and the ring handle |
| Pinch | Thumb tip to index tip distance | Pinch for goblins and the slingshot pouch |
| Palm direction | Which way the palm faces | Not used for input (a palm-facing pinch is the Quest menu) |
| Speed | Hand movement over the last few frames | Shake (pepper, bell), swat |

A gesture is a rule over these, for example "all fingers curled and palm down = fist".

### Reliability rules

- **Two thresholds:** start at one value, stop at a lower one (for example start at 80% curl, stop at 60%), so it does not flicker.
- **Short hold:** the pose must last about 100 to 200 ms before it triggers.
- **Smoothing:** filter the small jitter in joint positions.
- **Context:** only check a gesture when it makes sense, for example "shake" only while holding the pepper. This is the biggest win.
- **Avoid hidden fingers:** skip poses where fingers block each other from the cameras.
- **Show progress:** a glow that fills while a gesture builds up, since there are no haptics.
- **Lost tracking:** keep the last state for a moment instead of cancelling.

---

## 8. Future (not in the MVP)

### AR mode

- The same game in passthrough: the tiny castle sits in the player's real room. A big wow moment, and the real room is a natural comfort anchor.
- IWSDK supports AR, so it is mostly a toggle. Costs: some performance for passthrough, no skybox, and the board and lighting must read well against a real room.
- Build VR first. Avoid depending on the sky or backdrop from day one, so AR stays cheap to add near the end.

### Difficulty slider

- A dial on the Custom Game panel (see [modes-and-progression.md](modes-and-progression.md#custom-game)).
- One slider from "Relaxed" to "Chaos".
- Changes only amounts: enemies per camp, spawn rate, enemy speed, troop strength. Never the mechanics.
- Also a cognitive accessibility option: players who struggle with many decisions at once get fewer enemies.
- **The default (middle) must feel great.** Judges will probably not touch the slider.
- Stars show the difficulty they were earned on.
- A physical lever or slider the player grabs, not something shot with the slingshot.

### Slingshot menu

- After the first-run tutorial (which teaches the slingshot), the main menu options are physical targets on the board, for example wooden signs: "Play", "Settings", "Quiet mode". Hitting one breaks it with a pop.
- Doubles as slingshot practice before the battle.
- Forgiving: big close targets, aim assist, and poking a sign with a finger also works, so no one gets stuck.
- Only for big choices. Fine settings use a grabbed lever or slider.
- On later launches the menu comes first.
- The 2D start page is still needed to enter VR and ask for mic permission.
