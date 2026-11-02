# AGENTS.md

Instructions for any coding agent working on this repo (Claude Code, Codex, Cursor, etc.).

## What this project is

Tall Tale is a seated, hands-only VR game for Meta Quest, built for the Meta VR Start Developer Competition 2026.
You are a giant sitting in the middle of a round castle. A tiny battle happens all around you. You help your army win by using giant tools, and by grabbing enemies near the walls and eating them.

Read README.md and docs/GDD.md for the full design before making gameplay decisions. docs/mvp.md defines the first playable build, the tutorial director and waves, and the build order. When docs disagree, the files in docs/ win.

## Hard rules (never break these)

1. **Hands only.** The entire game must be playable with hand tracking. No controller is ever required. Controller support is optional and low priority.
2. **Voice is never required.** Every voice action (the megaphone scream, later troop orders) must also have a hand-based way to do the same thing (for the megaphone: the bell, which is in the MVP).
3. **Seated.** Every interaction must work from a chair within about a 2 ft (60 cm) radius. The board is always a full 360 degree circle that the player spins with the rotate handle and raises or lowers with the height handle, so nothing ever requires turning around. Only the board rotates. The sky, horizon, the player's tool platforms, food jar and the two flags stay fixed (comfort). See docs/controls-and-ui.md.
4. **Performance first.** The game must hold a stable frame rate on a Meta Quest 3S. If a feature hurts frame rate, simplify it.
5. **No copyrighted IP.** No names, logos, characters or lore from existing games, comics or films.
6. **Cartoon violence only.** Enemies are non-human (goblins, orcs, etc.). No blood or gore. Eating enemies must stay funny, not disturbing.

## Tech stack

- **Engine:** IWSDK (Meta Immersive Web SDK, WebXR), built on Three.js.
- **Language:** TypeScript.
- **Physics:** Havok (built into IWSDK).
- **Megaphone (scream) detection:** Web Audio API mic loudness. No speech recognition needed. Mic permission is asked on the 2D start page.
- **Speech (later, not in the MVP):** vosk-browser (offline, runs in a Web Worker) with a small fixed command list, for voice troop orders.
- **Assets:** low-poly. CC0 packs from Kenney.nl and Quaternius in glTF format, plus simple shapes generated in code.
- **Hosting:** GitHub Pages (static). Players open a link in the Quest browser. Vite needs the repo base path (for example `/tall-tale/`). PWA and Store packaging come later.
- **No backend** unless a feature truly needs one. Ask before adding one.

Use the IWSDK MCP server and code search (RAG) server that ship with new IWSDK projects to look up real SDK APIs. Do not guess IWSDK APIs.

## Performance budget

- About 40 to 80 small units on the board in total (troops plus enemies). Confirm the real limit in the first headset test.
- Use instancing for repeated meshes (troops, enemies, pebbles, particles).
- Use simple collision shapes (boxes, spheres, capsules). Never use full mesh colliders on moving objects.
- Pool objects (pebbles, debris, units) instead of creating and destroying them.
- Avoid full-screen post-processing (bloom etc.). Fake glow with emissive materials and simple shaders.
- Keep the first load fast. Cache large files.

## Hand interaction rules

- Prefer grab, drag, pull and release. These are the most reliable hand tracking actions.
- Avoid relying on custom hand poses or gestures. If one is needed, add a short delay before it triggers so it does not flicker.
- No haptics exist, so every action needs clear visual and sound feedback. Every grabbable or pokeable thing uses the same Idle, Ready, Held and Locked states, done with emissive color only. See "Interaction feedback" in docs/controls-and-ui.md.
- Make handles and tools oversized with generous grab zones.
- Handles only move along their own track: the rotate handle slides sideways along a curve, the height handle slides up and down. Each has one job and a big arrow beside it.
- The player's bare hands only grab and eat. No smashing, slapping or throwing.
- Goblins are tiny (about 3.5 cm). The grab zone is about 5 to 6 cm and snaps to the nearest goblin. See docs/controls-and-ui.md.
- Hand tracking gets unreliable very close to the headset. The "eat" action triggers when the hand is within about 25 cm of the face with the head tilted up. It must not require touching the mouth.
- Never use a palm-facing pinch as a game input. Quest reserves it for the system menu. Pause uses a wrist button poked with the other hand.

## Development workflow

- The developer works on a Mac and tests on a Quest 3S over Wi-Fi in the Quest browser.
- Make as much as possible testable in desktop Chrome with the Immersive Web Emulator, so the developer only needs the headset for feel and hand tracking checks.
- Add debug shortcuts, for example keys that trigger the megaphone, skip a wave or add food, so features can be tested without a mic or a headset.
- Keep game rules data driven (unit stats, tool costs, food values in config files), so tuning does not need code changes.
- Keep three parts separate: the map blueprint (static JSON), the director (code that decides what happens when, for example the scripted tutorial) and the game systems. Directors only call systems. See docs/map.md section 8.
- All randomness goes through one seeded random function. The tutorial uses a fixed seed.
- Keep systems small and separate: board, units, enemies, giant tools, player hands, food, flags, director, audio.
- Sounds: use the starter sample `public/audio/chime.mp3` as a placeholder until the last build step. Reference sounds by name from one config file.

## Developer preferences

- Do not commit, push or deploy unless the developer explicitly asks.
- Ask before adding any dependency.
- Do not run formatters, linters or scripts that were not approved.
- Never use em dashes or en dashes in code comments, docs or UI text.
- Keep explanations short and simple. The developer knows React, React Native, Node/Express and Python well, but is new to 3D and VR.
- No co-author lines in commits or files.
