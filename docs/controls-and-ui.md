# Controls and UI

Status: first pass. Only what is decided so far.

Back to [GDD index](GDD.md). Related: [Giant tools](giant-tools.md), [Castle rules](castle-rules.md).

---

## 1. Principle: show things in the world

- No floating panels in front of the player. The battlefield is the main view and must stay clear.
- Game state is shown with objects in the world:

| Info | Shown as |
|---|---|
| Castle health | The flag on its pole ([castle-rules.md](castle-rules.md)) |
| Where damage is happening | Cracks, smoke and fires on the wall, plus spatial sound |
| Food | A jar or basket beside the tool platforms |
| Tool cost | Food pips on each tool platform |
| Tool locked (not enough food) | Tool dimmed or tied down with a rope |

- In-world displays also help with "FoV-aware design" and polish in judging, and keep the "toys on a table" feeling.

---

## 2. The 360 degree board

The board is a full circle all the time. There are no 120 or 180 degree modes. A seated game does not need a small play area, it needs a world that is easy to bring to you.

### Rotating and adjusting by hand

- **Two handles** on the inner rim of the board, right in front of the player, below where the hands do most of the work. Away from the tool platforms.
- **Two-handed only:** the board moves only while both handles are held, like a steering wheel. No one grabs both by accident mid-fight.
  - **Twist** to rotate the board (around the vertical axis only, no tilting).
  - **Lift or lower** to change the board height (within a sensible range).
- Turning is a choice: the player can turn their head, or spin the board. Spinning takes both hands, so "spin to the new threat now, or finish this group first?" becomes a real decision.
- Enemy sounds sit on the board, so they turn with it automatically.

### Comfort rules

- **Only the board rotates.** The sky, the horizon, the tool platforms and the food jar stay still. If the whole world spins around the player, it causes motion sickness, even when the player is the one spinning it.
- **Movement follows the hands exactly (1:1)**, with no smoothing or lag. Moving the world is only comfortable when the player clearly causes it.
- Later ideas: a small "momentum" flick spin for fun, and snap rotation (30 degree steps) as a comfort option.

### Placement and fallbacks

- **Auto placement:** when the player presses Play, the board is placed at a fixed distance below the head, facing where the player is looking.
- **Reset table:** a button in the pause menu runs auto placement again, for when the board ends up somewhere odd.
- **Quest recenter:** if the player recenters with the Meta button, the game catches it and places the board again. A web game cannot trigger the system recenter itself, which is why "Reset table" exists.

---

## 3. Menus

- **2D start page:** one "Enter VR" button (the browser needs one tap to enter VR). Later it also asks for mic permission and can offer an optional "Install app" button.
- **In VR:** a single Play button for now. More options come with progression (see [map.md](map.md#8-levels-and-the-level-generator)).

---

## 4. Pause and settings

- **Wrist menu:** turn a palm up to show a small menu on the wrist with pause, settings and "Reset table". It needs a short hold delay so it does not open by accident.
- **Auto-pause:** the game pauses on its own when the player opens the Quest system menu or takes off the headset.

---

## 5. Accessibility options

None of these are in the MVP. They come after the first playtest (see [mvp.md](mvp.md)).

- **Quiet mode:** chosen at the start. Replaces the megaphone with a bell that works by shaking. Offered to everyone, no one has to declare a disability. See [giant-tools.md](giant-tools.md).
- **Mic calibration:** a quick test shout sets the megaphone threshold per player.
- **Handedness:** which side the slingshot platform sits on.
- **Snap rotation:** the board turns in 30 degree steps instead of smoothly.
- **Stronger slingshot aim assist** (see [giant-tools.md](giant-tools.md#slingshot-aim-assist)).
- **Reduced effects:** softer flashes and less shaking (planned).
- **Visual threat cues:** smoke or a glow at enemy camps and approaching groups, for players with hearing impairment or playing with low sound. Off by default, because listening for direction is part of the gameplay.

---

## 6. Custom hand gestures

Hand tracking gives the position of every finger joint every frame, so almost any gesture is possible. The limits come from tracking quality, not the API.

### How tracking works (short version)

- The headset's tracking cameras film the hands. Neural networks on the headset find the hands, estimate the 3D joint positions, and fit them to a hand skeleton.
- It feels instant because the system **predicts** where the hand will be when the frame is shown. Very fast moves can overshoot or drop tracking for a moment.
- Tracking struggles with: one hand hiding the other, very fast motion, hands very close to the face, hands low in the lap or out of camera view.

### How we detect gestures

Not raw joint positions (they change as the whole hand moves). Instead, a few simple measures relative to the hand:

| Measure | How | Used for |
|---|---|---|
| Finger curl | Fingertip distance to the palm | Fist vs open hand |
| Pinch | Thumb tip to index tip distance | Pinch |
| Palm direction | Which way the palm faces | Palm up for the wrist menu |
| Speed | Hand movement over the last few frames | Flick, shake, swat |

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

## 7. Future (not in the MVP)

### AR mode

- The same game in passthrough: the tiny castle sits in the player's real room. A big wow moment, and the real room is a natural comfort anchor.
- IWSDK supports AR, so it is mostly a toggle. Costs: some performance for passthrough, no skybox, and the board and lighting must read well against a real room.
- Build VR first. Avoid depending on the sky or backdrop from day one, so AR stays cheap to add near the end.

### Difficulty slider

- Lives on the Arcade mode setup screen (see [map.md](map.md#8-levels-and-the-level-generator)).
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
