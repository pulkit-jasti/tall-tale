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
| Food | A jar or basket beside the tool platforms |
| Tool cost | A small wooden price tag on each tool platform: a food ball and the cost as a number, like a price on a market stall. Cream number = the jar has enough, red = not enough, a tick = a paid use is running |
| Tool locked (not enough food) | Tool dimmed or tied down with a rope |

- In-world displays also help with "FoV-aware design" and polish in judging, and keep the "toys on a table" feeling.

### Interaction feedback (applies to everything you can touch)

Every grabbable or pokeable thing (goblins, tools, handles, buttons, the wrist button, trophies) uses the same states, so the player learns them once. There are no haptics, so these are the main feedback.

| State | When | Look | Sound |
|---|---|---|---|
| Idle | Hand far away | Normal | None |
| Ready | Hand within grab or poke range | Soft white brighten | Soft tick |
| Held / pressed | Grabbed or poked | Orange | Grab or click |
| Locked | Ready, but cannot be used (not enough food) | Stays dimmed, small wobble | "Not enough food" buzz |

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
| 50 to 63 cm | Edge | Only things reached now and then: climbers on the rampart, intruders in the courtyard |
| Over 63 cm | Out of reach | Only things the tools reach (the slingshot, the swatter's long handle), and things to look at (the hint sign) |

- **Where the numbers come from:** Meta's hands guidance ("Hands UI best practices", "Spatial UI inside interactive 3D scenes") puts direct touch at 42 to 46 cm and says to avoid 50 to 80 cm, the "middle distance" where people reach, miss and give up. It also says frequent actions belong low, because raised arms tire quickly. The close limit is our own, from the eat zone and the first headset tests.
- **Measured from the eyes** with the board at its placed height (46 cm below the eyes, lowered from 36 and then 40 after the step 4 tests, so the player towers over the kingdom) and its default size. Board spots convert with `reachDistance()` in `src/rules/reach.ts`: for example 33.5 cm out and 10 cm above the board is about 49 cm.
- **Everything is sized from it:** the ring handle (27 cm out, about 48 cm from the eyes), the tool platforms just outside it (33.5 cm out, tops 6 cm above the board, handles about 49 cm), and the castle: the wall at 46 to 52 cm, with climbers on the rampart at about 62 cm.
- **Then sized to the player:** the reach check (below) scales all of it to the player's arms.
- **Low:** tool platforms sit low (6 cm above the board), so the hand reaches them without lifting the arm.
- **Checked in code:** `REACH` in `src/config/game.ts`. The dev server warns at start about any spot in `reachSpots()` outside the band. Add every new interactive thing there.

### Reach check ("Show me how big you are, giant!")

Arm length varies a lot between players, and the default size felt too close in the step 4 test. So the first tutorial step measures the player's reach and sizes the whole board to it.

- **What the player does:** the sign says "Show me how big you are, giant! Sit back and stretch one arm straight out: hand flat, thumb up, fingers spread." A see-through ghost hand loops the move: from the chest, the right arm goes straight out, holds, and comes back.
- **The pose:** hand flat with the thumb up and the palm facing in, so the hand's side faces the headset and the cameras see every finger. The palm never faces the headset (that is the Quest menu gesture).
- **Countdown:** as soon as a hand is stretched out (more than 33 cm from the head, level), the sign shows "Great, hold it there... 3", then 2, then 1, with a tick each second (the text pops on each number). If the arm drops for more than 0.4 s, it waits again. When it ends, a chime plays and the ticked sign says "Done! You can rest your arm now."
- **What it measures:** the farthest the pinch point gets, as a level distance from the head (not the seat, so leaning forward does not count), smoothed so a tracking spike never counts.
- **What it changes:** the whole board (everything in `boardLift`: board, castle, goblins, ring, tools, flags, sign, panels) scales so the rampart sits at 88% of the measured reach, a comfortable reach rather than a full stretch. Everything keeps its place relative to the wall. The scale stays within 0.85 to 1.45, and the board grows or shrinks to it smoothly, so the player sees it fit them.
- **Once per player:** the size is saved in the browser. Without tracked hands (browser), it gives up after 40 s and keeps the default size. "Measure reach" on the pause panel (and "Measure reach again" on the debug page) forgets it and starts the battle again with the check.
- Numbers in `CALIBRATION` in `src/config/game.ts`, code in `src/player/reachCheck.ts`.

### Holding a tool

After the step 4 test, tools stuck to the hand at whatever angle the grab happened, so some needed an awkward wrist to use. Now a fist grab **snaps the tool into the fist the way it is held in real life**, so there is nothing to learn:

- The handle runs through the fist and the tool sticks out past the thumb. Like a real handle lying across the palm, it leans forward (toward the fingers) about 35 degrees from the knuckle line (25 felt too upright in the headset), so it lines up with the knuckle bones (`HOLD.tiltDeg`). The ghost hand's tool grab demos close the fist at the same slant.
- **Fly swatter:** held near the end of the handle, its flat face square to the palm (it first sat in line with the palm, which felt wrong in the headset). It leans 10 degrees more than the other tools (45), because its head must touch the goblin or the ground to swat, and the extra lean gets it there without bending the wrist.
- **Pepper shaker:** upright in the fist, holes above the thumb. Tip the wrist to point the holes down.
- **Slingshot:** fork up past the thumb, arms spread across the palm, the shot going the way the knuckles point (arm stretched out, thumb up).
- The fist frame comes from the knuckle joints (wrist to middle knuckle, pinky knuckle to index knuckle), not from the wrist joint's own angle, so it matches what the player sees.
- Right after the grab the tool eases into place over about 0.15 s, so it never jumps.
- A pinch grab (the slingshot handle, or the food tools if `TOOLS.acceptPinch` is on) keeps the angle it grabbed at.
- Numbers in `HOLD` in `src/config/game.ts` (where the fist holds each tool, which way it faces), code in `src/player/hold.ts`. The ghost hand grab demos already close the fist this way.

### Threat cues

Players who cannot hear, or play with the sound off, still need to know where goblins are hurting the castle. On by default (`THREAT` in config, `src/ui/threatCues.ts`):

- **Wall hit flash:** every hit makes that part of the wall top flash red and fade, with a small dust puff. The wall top is easy to see from the seat, also out of the corner of the eye.
- An "attack compass" arc with red marks inside the ring was tried and removed after the headset test: the wall flash alone reads well enough.

### Pinch and grab (the two hand actions)

| Action | How | Used for |
|---|---|---|
| **Pinch** | Thumb and index finger together | Small things: picking up goblins, pulling back the slingshot pouch, taking pebbles from the bowl, other small actions |
| **Grab** | Close the whole hand into a fist | Big things: the slingshot handle, fly swatter, pepper shaker, megaphone, bell, the ring handle |

- Buttons (Play, pause panel, wrist button) are poked with the index finger, not pinched or grabbed.
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

- **Only the board rotates.** The sky, the horizon, the hills, the tool platforms, the food jar and the two flags never turn. The platforms, jar, flags and hint sign rise and fall with the board, so they always stand at the same spot on it and the ring never passes through them. If the whole world spins around the player, it causes motion sickness, even when the player is the one spinning it (a whole-world turn was tried on paper after the step 5 review and dropped for this reason).
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
2. Keep it there for a moment (about 0.2 seconds). It is eaten without letting go. Chomp, gulp, small burp. Food is added to the food jar.

- **No letting go and no head tilt.** In the first headset test, holding a goblin above the face with the head tilted up turned the palm toward the headset, and the pinch opened the Quest menu. Now the palm can face down or sideways the whole time.
- If the pinch breaks close to the face anyway (tracking loss or the menu gesture), the goblin is still eaten instead of dropped.

### Letting go anywhere else

- The goblin keeps the hand's speed, so letting go mid-swing tosses it in an arc. It lands on whatever is under it (courtyard, wall top or field), bounces once on a hard landing, is dazed for a moment, then carries on. Letting go of a still hand drops it straight down.
- A toss does no damage and is not an attack. It is only there so goblins feel like real little things.
- Pebbles from the bowl use the same toss. A thrown pebble only knocks a goblin back, dazed, and never knocks it out ([giant-tools.md](giant-tools.md)).
- Simple projectile math per flying goblin (gravity, ground height, one bounce), no physics engine, so it costs almost nothing. The hand speed is smoothed and capped, so tracking jitter cannot fling a goblin off the map. Numbers are in `GOBLIN_RULES` in `src/config/game.ts`.

---

## 4. Menus

- **2D start page:** one "Enter VR" button (the browser needs one tap to enter VR). Before entering VR it asks for mic permission (needed for the megaphone). Built in step 5: on the first visit the button says "Allow microphone", its tap shows the browser prompt, then it says "Enter VR" (opening VR needs a fresh tap). A line under it says whether the mic is on (the megaphone) or not (the bell comes instead). If the mic was allowed before, it opens with no prompt and one tap enters VR. Later it can offer an optional "Install app" button.
- **In VR:** the menu is the board in peacetime, with a giant menu board and trophy shelf. See [modes-and-progression.md](modes-and-progression.md#2-the-menu-is-the-board-in-peacetime). MVP: a single Play button.
- **End of battle (MVP):** a simple win or lose panel. See [castle-rules.md](castle-rules.md#4-end-of-battle-screens-mvp).

---

## 5. Pause and settings

### What hand tracking games do

- **Palm pinch is taken by the system.** On Quest, a pinch with the palm facing the player is reserved for the system on both hands. The right one opens the Quest menu. Meta's WebXR docs say the left one (the three bars icon) acts like the left controller's menu button, which leaves the WebXR session, but in our headset test it did nothing. Apps cannot use either one or turn them off, so the game never relies on them.
- So the common pattern is a **wrist button**: a small button on the inside of one wrist that shows when the player turns that palm toward their face. The other hand's index finger pokes it. A poke with the other hand is deliberate, so it is rarely pressed by accident.

### Our pause

- **Wrist button on the left wrist** (right wrist once handedness exists). It fades in only when the left palm faces the player's face for about 0.3 seconds, and fades out when the hand turns away.
- **Poke it with the right index finger** to pause. The button presses in, with a click sound.
- **Pause panel:** the battle freezes and a small panel appears in front of the player with big poke buttons: "Resume", "Reset table", "Restart battle".
- **Auto-pause:** the game pauses on its own when the player opens the Quest system menu or takes off the headset (the WebXR session's visibility change event). It stays paused until the player pokes "Resume". The FPS panel shows "paused" while it is.
- Settings come later (not in the MVP).

**Built in step 6** (`src/ui/pauseMenu.ts`, numbers in `PAUSE`):
- The wrist button is the shared poke button with a pause icon, on the inside of the left wrist (6 cm back from the palm's middle), its face out of the palm. It pops in once the left palm faces the eyes (within about 53 degrees) for 0.3 s, while the palm is within 60 cm of the eyes and the left hand holds nothing. Only the right index finger pokes it, once it is fully out.
- Pausing lets go of everything the hands hold (goblins drop, tools go back), freezes the battle and all sound, and hides the hint sign, marker and ghost hand.
- The pause panel opens in front of the head, not on the board, at the same spot from the eyes as the end panel and sized with the board, so its buttons are always in the best reach band (about 47 to 49 cm from the eyes), even when the board ended up somewhere odd. Four poke buttons: **Resume**, **Reset table** (auto placement again at the starting height, stays paused so the player can look first), **Measure reach** (forgets the reach and starts the battle again with "Show me how big you are, giant!") and **Restart** (the battle again). The panel says that the last two start the battle again. Its buttons ignore pokes for 1 s after it opens.
- Auto-pause in VR during a battle shows the same panel when the player comes back. Outside a battle (welcome or end panel) and in the browser it still resumes by itself.
- Debug: Space pauses or resumes, and the debug page's "Pause panel button 1 to 4" pokes a panel button.

---

## 6. Accessibility options

None of these are in the MVP. They come after the first playtest (see [mvp.md](mvp.md)).

- **Quiet mode:** chosen at the start. Replaces the megaphone with a bell that works by shaking. Offered to everyone, no one has to declare a disability. See [giant-tools.md](giant-tools.md).
- **Mic calibration:** a quick test shout sets the megaphone threshold per player.
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
| Palm direction | Which way the palm faces | Palm toward the face shows the wrist pause button |
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
