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
| Where damage is happening | Cracks, smoke and fires on the wall, plus spatial sound |
| Food | A jar or basket beside the tool platforms |
| Tool cost | Food pips on each tool platform |
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

### Pinch and grab (the two hand actions)

| Action | How | Used for |
|---|---|---|
| **Pinch** | Thumb and index finger together | Small things: picking up goblins, pulling back the slingshot pouch, pebbles, other small actions |
| **Grab** | Close the whole hand into a fist | Big things: fly swatter, pepper shaker, megaphone, bell, the rotate and height handles |

- Buttons (Play, pause panel, wrist button) are poked with the index finger, not pinched or grabbed.
- Each object accepts only its own action, so a pinch never picks up the swatter and a fist never picks up a goblin.

---

## 2. The 360 degree board

The board is a full circle all the time. There are no 120 or 180 degree modes. A seated game does not need a small play area, it needs a world that is easy to bring to you.

### Rotating and adjusting by hand

Two handles on the inner rim, right in front of the player, below where the hands do most of the work. **Each handle has one job and a big arrow beside it**, so it is clear what it does without any text. Each works with one hand, which also helps players who can only use one hand.

| Handle | Where | Arrow | How it works |
|---|---|---|---|
| **Rotate handle** | Right of center | Curved double arrow along the rim, above the handle | A big knob on a short curved track. Grab it and slide it sideways along the track. The board turns with it 1:1 (around the vertical axis only, no tilting). On release the knob glides back to the middle of its track and the board stays where it is. For a big turn, slide, let go, and slide again. |
| **Height handle** | Left of center | Vertical double arrow (up and down) beside the handle | A bar between two upright rails. Grab it and slide it up or down. The board follows 1:1, within a sensible range. On release the board stays at the new height. |

- The handles only move along their own track (sideways or up and down). Any other hand motion is ignored.
- The handles follow the standard Ready and Held states (see [Interaction feedback](#interaction-feedback-applies-to-everything-you-can-touch)). The arrow lights up together with its handle.
- Oversized grab zones, so they are easy to grab without looking closely.
- Handedness (later) swaps the two sides.
- Turning is a choice: the player can turn their head, or spin the board. Spinning takes a hand off the battle, so "spin to the new threat now, or finish this group first?" is a real decision.
- Enemy sounds sit on the board, so they turn with it automatically.

### Rejected

- **One pair of two-handed handles (twist to spin, lift to change height):** two jobs on one control, nothing on the handles explained them, and it needed both hands.

### Comfort rules

- **Only the board rotates.** The sky, the horizon, the tool platforms, the food jar and the two flags stay still. If the whole world spins around the player, it causes motion sickness, even when the player is the one spinning it.
- **Movement follows the hands exactly (1:1)**, with no smoothing or lag. Moving the world is only comfortable when the player clearly causes it.
- Later ideas: a small "momentum" flick spin for fun, and snap rotation (30 degree steps) as a comfort option.

### Placement and fallbacks

- **Auto placement:** when the player presses Play, the board is placed at a fixed distance below the head, facing where the player is looking.
- **Reset table:** a button in the pause menu runs auto placement again, for when the board ends up somewhere odd.
- **Quest recenter:** if the player recenters with the Meta button, the game catches it and places the board again. A web game cannot trigger the system recenter itself, which is why "Reset table" exists.

---

## 3. Grab and eat

The player's own hands do only two things: pick up goblins and eat them. There is no smashing, slapping or throwing.

### Pick up (pinch)

- Goblins are tiny (about 3.5 cm), too small to pick up reliably with tracked fingers. So the pinch zone is much bigger than the goblin: about 5 to 6 cm around the hand's pinch point.
- When the player pinches (thumb and index) inside that zone, it snaps to the nearest goblin. The goblin lifts into the fingers.
- A grabbed goblin struggles: arms and legs wave, it squeals.
- The goblin that would be grabbed shows the Ready state while the hand is near (see [Interaction feedback](#interaction-feedback-applies-to-everything-you-can-touch)).

### Eat

1. Bring the held goblin toward the face (hand within about 25 cm) and tilt the head up. The giant's mouth opens. It must not require touching the mouth.
2. Let go. The goblin drops into the mouth, which closes. Chomp, gulp, small burp. Food is added to the food jar.

### Letting go anywhere else

- The goblin drops back onto the board, dazed for a moment, then carries on.

---

## 4. Menus

- **2D start page:** one "Enter VR" button (the browser needs one tap to enter VR). Before entering VR it asks for mic permission (needed for the megaphone). Later it can offer an optional "Install app" button.
- **In VR:** the menu is the board in peacetime, with a giant menu board and trophy shelf. See [modes-and-progression.md](modes-and-progression.md#2-the-menu-is-the-board-in-peacetime). MVP: a single Play button.
- **End of battle (MVP):** a simple win or lose panel. See [castle-rules.md](castle-rules.md#4-end-of-battle-screens-mvp).

---

## 5. Pause and settings

### What hand tracking games do

- **Palm pinch is taken by the system.** On Quest, a pinch with the palm facing the player is reserved for the system on both hands (the left one opens the Quest menu). Apps cannot use it or turn it off.
- So the common pattern is a **wrist button**: a small button on the inside of one wrist that shows when the player turns that palm toward their face. The other hand's index finger pokes it. A poke with the other hand is deliberate, so it is rarely pressed by accident.

### Our pause

- **Wrist button on the left wrist** (right wrist once handedness exists). It fades in only when the left palm faces the player's face for about 0.3 seconds, and fades out when the hand turns away.
- **Poke it with the right index finger** to pause. The button presses in, with a click sound.
- **Pause panel:** the battle freezes and a small panel appears in front of the player with big poke buttons: "Resume", "Reset table", "Restart battle".
- **Auto-pause:** the game pauses on its own when the player opens the Quest system menu or takes off the headset (the WebXR session's visibility change event). It stays paused until the player pokes "Resume".
- Settings come later (not in the MVP).

---

## 6. Accessibility options

None of these are in the MVP. They come after the first playtest (see [mvp.md](mvp.md)).

- **Quiet mode:** chosen at the start. Replaces the megaphone with a bell that works by shaking. Offered to everyone, no one has to declare a disability. See [giant-tools.md](giant-tools.md).
- **Mic calibration:** a quick test shout sets the megaphone threshold per player.
- **Handedness:** which side the slingshot platform sits on.
- **Snap rotation:** the board turns in 30 degree steps instead of smoothly.
- **Stronger slingshot aim assist** (see [giant-tools.md](giant-tools.md#slingshot-aim-assist)).
- **Reduced effects:** softer flashes and less shaking (planned).
- **Visual threat cues:** smoke or a glow at enemy camps and approaching groups, for players with hearing impairment or playing with low sound. Off by default, because listening for direction is part of the gameplay.

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
| Finger curl | Fingertip distance to the palm | Grab (fist) for big tools and handles |
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
