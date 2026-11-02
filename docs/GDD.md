# Tall Tale: Game Design Document

Top level overview and index. Each topic gets its own file once its design is locked.

## Overview

- **Pitch:** You are a giant sitting in the middle of a tiny castle. Help your little army win the battle around you by using giant tools, and by grabbing enemies and eating them.
- **Board:** a full 360 degree round board you spin and adjust with one-handed handles. A seated game with a big world you bring to you.
- **Platform:** Meta Quest (3S target), WebXR with IWSDK.
- **Play style:** seated, hands only, voice optional.
- **Session:** short battles in waves, with a gentle intensity curve and short breathers between them.

## Design pillars

1. **Feels like playing with living toys.** Everything reacts to your hands.
2. **Tension and release.** Waves of action, then rest and watch.
3. **Juicy and cartoony.** Big colorful feedback for every action, no gore.
4. **Simple hands.** Pinch, grab, pull, release. No complex gestures.
5. **Every enemy is a question, every tool is an answer.**

## Topics

| Topic | File | Status |
|---|---|---|
| **MVP scope (first build), tutorial director and waves, build order** | [mvp.md](mvp.md) | Decided |
| Game modes, menu, progression, kingdom, achievements | [modes-and-progression.md](modes-and-progression.md) | Decided. Scoring and Endless difficulty to discuss. |
| Core loop, pacing, troops, sound cues | [core-loop.md](core-loop.md) | Decided as a starting point |
| Map: board, roads, triggers, environment, blueprints, directors, level generator | [map.md](map.md) | First pass decided, mockup in `maps/castle-3d.html` |
| Castle rules: win, lose, the two flags, end screens | [castle-rules.md](castle-rules.md) | Decided for the first build |
| Castle machines | [castle-machines.md](castle-machines.md) | On hold until the first playtest |
| Giant tools and food currency | [giant-tools.md](giant-tools.md) | First pass decided |
| Enemies | [enemies.md](enemies.md) | First set decided |
| Army and supply carts | (planned) | Later. Basic troop behavior is in [core-loop.md](core-loop.md). Troops leave through a hidden gate at the front (an invisible spawner). Gate mechanics, picking up troops and prisoner capture are on hold. |
| Controls, UI and accessibility: 360 board and handles, grab and eat, menus, pause, custom gestures, AR | [controls-and-ui.md](controls-and-ui.md) | First pass |
| Juice and feel | (planned) | Principles only |
| Art style | [README.md](../README.md) | Decided |
| Audio | [audio.md](audio.md) | Candidate sound list. Placeholder sound until the end of the MVP. Enemy sound cues decided in [core-loop.md](core-loop.md). |
| Tech, hosting and performance | [README.md](../README.md), [AGENTS.md](../AGENTS.md) | Decided |
