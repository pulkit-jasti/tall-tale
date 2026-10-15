# AGENTS.md

Instructions for any coding agent working on this repo (Claude Code, Codex, Cursor, etc.).

## What this project is

Tall Tale is a seated, hands-only VR game for Meta Quest, built for the Meta VR Start Developer Competition 2026.
You are a giant sitting in the middle of a round castle. A tiny battle happens all around you. You help your army win by moving carts, loading and cranking war machines, picking up and placing troops, smashing enemies near the walls, and eating them.

Read README.md for the full design before making gameplay decisions.

## Hard rules (never break these)

1. **Hands only.** The entire game must be playable with hand tracking. No controller is ever required. Controller support is optional and low priority.
2. **Voice is never required.** Every voice command (troop orders, roar) must also have a hand-based way to do the same thing.
3. **Seated.** Every interaction must work from a chair within about a 2 ft (60 cm) radius. Default play area is about 180 degrees in front of the player. 360 degrees is an opt-in mode. A 120 degree comfort preset must exist.
4. **Performance first.** The game must hold a stable frame rate on a Meta Quest 3S. If a feature hurts frame rate, simplify it.
5. **No copyrighted IP.** No names, logos, characters or lore from existing games, comics or films.
6. **Cartoon violence only.** Enemies are non-human (goblins, orcs, etc.). No blood or gore. Eating enemies must stay funny, not disturbing.

## Tech stack

- **Engine:** IWSDK (Meta Immersive Web SDK, WebXR), built on Three.js.
- **Language:** TypeScript.
- **Physics:** Havok (built into IWSDK).
- **Speech:** vosk-browser (offline, runs in a Web Worker) with a small fixed command list.
- **Roar detection:** Web Audio API volume analysis. No speech recognition needed.
- **Assets:** low-poly. CC0 packs from Kenney.nl and Quaternius in glTF format, plus simple shapes generated in code.
- **Hosting:** static hosting (GitHub Pages or Vercel). Judges open a link.
- **No backend** unless a feature truly needs one. Ask before adding one.

Use the IWSDK MCP server and code search (RAG) server that ship with new IWSDK projects to look up real SDK APIs. Do not guess IWSDK APIs.

## Performance budget

- About 40 to 80 small units on the board in total (troops plus enemies). Confirm the real limit in the week 1 spike.
- Use instancing for repeated meshes (troops, enemies, arrows, stones).
- Use simple collision shapes (boxes, spheres, capsules). Never use full mesh colliders on moving objects.
- Pool objects (arrows, stones, units) instead of creating and destroying them.
- Avoid full-screen post-processing (bloom etc.). Fake glow with emissive materials and simple shaders.
- Keep the first load fast. Cache large files (like the Vosk model).

## Hand interaction rules

- Prefer grab, drag, pull and release. These are the most reliable hand tracking actions.
- Avoid relying on custom hand poses or gestures. If one is needed, add a short delay before it triggers so it does not flicker.
- No haptics exist, so every action needs clear visual and sound feedback.
- Make handles, levers and cranks oversized with generous grab zones.
- Cranks rotate only along their circle. Levers move only along their track.
- Hand tracking gets unreliable very close to the headset. The "eat" action triggers when the hand is within about 25 cm of the face with the head tilted up. It must not require touching the mouth.

## Development workflow

- The developer works on a Mac and tests on a Quest 3S over Wi-Fi in the Quest browser.
- Make as much as possible testable in desktop Chrome with the Immersive Web Emulator, so the developer only needs the headset for feel and hand tracking checks.
- Add debug shortcuts, for example a text box or keys that trigger voice commands and roar, so voice features can be tested without a mic.
- Keep game rules data driven (unit stats, machine settings, level waves in config files), so tuning does not need code changes.
- Keep systems small and separate: units, enemies, machines, carts, player hands, voice, audio, levels.

## Developer preferences

- Do not commit, push or deploy unless the developer explicitly asks.
- Ask before adding any dependency.
- Do not run formatters, linters or scripts that were not approved.
- Never use em dashes or en dashes in code comments, docs or UI text.
- Keep explanations short and simple. The developer knows React, React Native, Node/Express and Python well, but is new to 3D and VR.
- No co-author lines in commits or files.
