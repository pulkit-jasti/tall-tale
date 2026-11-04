# Performance

How we measure frame rate, the results of every headset test so far, and what to optimize next.

Back to [GDD index](GDD.md). The rules for agents are in [AGENTS.md](../AGENTS.md#performance-budget).

---

## 1. Current budget

| Setting | Value |
|---|---|
| Headset | Meta Quest 3S, Quest browser, dev server over Wi-Fi |
| Frame rate | **72 Hz** (asked for on entering VR, 13.9 ms per frame). The Quest 3S default is 90 Hz (11.1 ms). |
| **Unit budget** | **About 50 goblins** (grunts) with no dropped frames. At 60 the first drops appear. |
| Measured | 2026-11-03, end of build step 1 (board, castle, ring handle, goblins, grab and eat, throws) |

The docs plan for 40 to 80 units in total, troops plus enemies. 50 goblins alone is at the low end, and troops (build step 5) share this budget. So the optimizations in section 5 are needed before or with step 5.

---

## 2. How we measure

Everything runs from the laptop debug page at `/__debug` on the dev server (`npm run dev`). See [AGENTS.md](../AGENTS.md#performance-budget) for the full rules.

- **Measured run:** frames are only counted after a reset (stress, clearing goblins, pause, or by hand) and a 3 second warm-up, so old numbers never mix with new ones.
- **Three numbers decide pass or fail:**
  - **Avg FPS:** frames divided by time. Pass at 98.5% of the target (71 of 72).
  - **1% low:** the slowest 1% of frames, as FPS. Each frame is counted in whole display beats (1 beat = on time, 2 = one dropped frame), because the headset only shows frames on its beat. Pass at 90% of the target (65 of 72). The raw page clock value is shown too, for information only.
  - **Missed:** frames longer than 1.5 beats, likely a stale frame (judder) in the headset. Pass under 1%.
- **Stress test:** one button. Measures the empty board first (baseline), then adds 10 grunts per step, measures each step for 20 seconds, stops at the first failing step and clears the board. The FPS panel is hidden while it measures. The budget is the last passing step.
- **Slow frame causes:** each missed frame lists what the game did just before it (goblin built or spawned, sound, particles, panel redraw, debug send, board placed). "nothing marked" means something outside our code, most likely the browser or garbage collection.
- Only trust rows from a **headset** page. The IWSDK emulator fakes a Quest on localhost, and the laptop screen runs at 120 Hz.

The industry practice behind these choices: frame time is the base measurement, the average alone hides stutter, so benchmarks add the 1% low (NVIDIA FrameView, CapFrameX), and in VR Meta's OVR Metrics Tool focuses on stale frames. For exact GPU and CPU numbers, use the OVR Metrics Tool on the headset.

---

## 3. Test log

All tests: grunts only, standing at the wall and hitting it, player sitting still and looking at the board in front.

### Test 1: invalid (laptop page)

- Reported 120 fps up to 90 units, while the headset's own panel showed 0 units.
- **Cause:** a copy of the game in a laptop tab ran the test. The IWSDK emulator fakes a Quest user agent on localhost, so it was labeled "headset", and 120 fps is the Mac screen's rate.
- **Fixed:** pages are labeled by host (localhost = laptop), the debug page lists every connected page, and only a page in VR runs the stress test.

### Test 2: 90 Hz, FPS panel visible

| Units | Avg | 1% low (raw clock) | Missed | Result |
|---|---|---|---|---|
| 10 | 89.4 | 52 | 0.4% | Fail |

- The average was fine, but there were short hitches (about 7 frames over 16.7 ms in 20 s).

### Test 3: 90 Hz, FPS panel hidden

| Units | Avg | 1% low (raw clock) | Missed | Result |
|---|---|---|---|---|
| 10 | 89.8 | 64 | 0.3% | Fail |

- Hiding the panel helped (1% low 52 to 64), so its canvas redraw and GPU upload caused some hitches. The rest remained.
- **Changes after this:** the game asks for 72 Hz, the panel redraws at most once a second and only when its text changes, the test hides the panel, a baseline step and slow frame causes were added.

### Test 4: 72 Hz, raw clock 1% low

| Units | Avg | 1% low (raw clock) | Missed | Result |
|---|---|---|---|---|
| Empty | 72.0 | 65 | 0.0% | Baseline ok |
| 10 | 72.0 | 66 | 0.0% | Pass |
| 20 | 72.0 | 65 (64.6) | 0.0% | Fail (false) |

- 72 Hz removed every dropped frame.
- The fail at 20 was false: with zero missed frames, the raw 1% low only measured the page clock wobbling by a ms or two.
- **Fixed:** the 1% low now counts frames in whole display beats.

### Test 5: 72 Hz, beat-based 1% low (current method)

| Units | Avg | 1% low | Raw | Missed | Slowest | Result |
|---|---|---|---|---|---|---|
| Empty | 72.0 | 72 | 67 | 0.0% (0) | 15 ms | Baseline ok |
| 10 | 72.0 | 72 | 64 | 0.0% (0) | 16 ms | Pass |
| 20 | 72.0 | 72 | 65 | 0.0% (0) | 16 ms | Pass |
| 30 | 72.0 | 72 | 65 | 0.0% (0) | 16 ms | Pass |
| 40 | 72.0 | 72 | 64 | 0.0% (0) | 16 ms | Pass |
| 50 | 72.0 | 72 | 64 | 0.0% (0) | 16 ms | Pass |
| 60 | 72.0 | 63 | 60 | 0.1% (2) | 24 ms | Fail |

- Before the 2 missed frames at 60: "nothing marked" (2).
- **Budget: 50 units.**

---

## 4. What we learned

- **72 Hz instead of 90 Hz** was the biggest win: it removed all dropped frames up to 50 goblins.
- **The FPS panel has a real cost** (canvas upload to the GPU). Keep it cheap and hide it while measuring.
- **The first drops at 60 goblins came from outside our tagged code**, so the likely cause is garbage collection or the browser under load, not one feature.
- **The rule is strict:** 2 dropped frames in 20 seconds already fails a step. Run the test twice before trusting a budget change.
- The skinned goblin model is fine for now. The code-made goblin fallback in [assets.md](assets.md) is not needed yet.

---

## 5. Next optimizations (before or with build step 5)

In order of expected gain:

1. **Less memory churn:** remove per-frame allocations (for example the unit count builds a new list every call, plus temporary arrays and objects in loops). The most likely cause of the "nothing marked" drops.
2. **Shared animation:** goblins doing the same thing share one animation update instead of one animation player each.
3. **Cheaper far goblins:** update the animation of distant goblins less often.
4. **Then re-run the stress test** and record the result in section 3.

**Done in build step 5:** item 3 (goblins and soldiers over 150 cm from the center update their animation every other frame, `TROOPS.farAnimFrom`) and part of item 1 (grab and eat reuses its ready set instead of a new Set every frame). New load from step 5: up to 12 skinned soldiers (`TROOPS.max`, 4 for testing now), 3 triggers, a debris pool of 14 small models (drawn only while flying), dizzy stars, the sky (one instanced mesh for all 450 cloud puffs, about 36k triangles, and 3 draw calls for the sun) and the hills (5 draw calls). The stress test has not been run since step 2: run it now, then a full wave 5 with the FPS panel, and log both here.

If troops plus enemies still do not fit, use the code-made instanced goblins from [placeholder-shapes.md](placeholder-shapes.md).
