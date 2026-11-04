# Placeholder Shapes (MVP)

Things in the MVP that have no good model. Build each one in code from simple shapes with flat colors, so it fits the low-poly Kenney look. Everything else uses a model from [assets.md](assets.md).

Back to [GDD index](GDD.md). Related: [assets.md](assets.md), [giant-tools.md](giant-tools.md), [controls-and-ui.md](controls-and-ui.md).

---

## Rules

- Flat colors, flat shading, low segment counts (8 to 12 sides on cylinders and spheres).
- Keep each shape in its own small function, so it can be swapped for a real model later without touching game logic.
- Every touchable shape uses the Idle, Ready, Held and Locked states with emissive color only (see [controls-and-ui.md](controls-and-ui.md#interaction-feedback-applies-to-everything-you-can-touch)).
- When a real model replaces a shape, move its row to [assets.md](assets.md).

## Built in code on purpose (no model will replace these)

| Thing | Shape |
|---|---|
| Board | Flat disc with a hole for the player, rising gently toward the horizon (see [map.md](map.md#2-the-board)). Grass color, slightly varied. |
| Roads | Flat ribbons along the road curves, sandy color, slightly above the board. |
| Castle wall | Round ring wall, 6 cm high, from 40 to 46 cm. Crenellations as small boxes on top (instanced). Stone grey with a lighter top. Cracks and scorch marks as darker decals or vertex colors when damaged. |
| Flag poles | Thin cylinders with a ball on top. |
| Food jar fill level | Disc inside the jar that moves up and down. |
| Particles: poof, stars, smoke, sparks, splat | Small instanced quads or low-poly spheres, pooled. |

## Waiting for a real model

| Thing | Shape | Size |
|---|---|---|
| Slingshot | Y shaped wooden frame (3 cylinders) on the platform, a band (2 thin lines or stretched boxes) and a leather pouch (small flattened box) that is pinched. | Frame 15 cm tall |
| Fly swatter | Long thin handle (cylinder) and a flat square mesh head (thin box, a grid texture made in code is optional). | 35 cm long |
| Pepper shaker | Cylinder body with a dome top and a few dark dots for holes. Red or black. | 12 cm tall |
| Megaphone | Cone (open wide end) with a short cylinder handle. | 20 cm long |
| Bell | Bell shape (lathe or cone with a rounded top) with a small handle on top. Brass color. | 10 cm tall |
| Pebble bowl | Shallow open cylinder (lathe), wood or clay color. | 15 cm wide |
| Food pips | Small spheres in a row on each tool platform. Lit = can afford, dim = cannot. | 1.5 cm each |
| Ring handle | Curved rail (tube along a 120 degree arc) with round ends (spheres), on 4 short poles (cylinders). | 27 cm from center, 2.8 cm thick, 5 cm high |
| Arrows for the ring handle | Flat arrow shapes (extruded 2D shape), bright color: a curved double arrow lying on the ring at the front, and a small up and down arrow standing near each end. | 8 to 12 cm |
| Play button (in VR) | Big round button (short cylinder) on a small post. | 10 cm wide |
| Wrist pause button | Small round button (short cylinder) on the inside of the left wrist. | 3 cm wide |
| Pause, win and lose panels | Rounded flat panel with big poke buttons. Use IWSDK UI (check iwsdk-reference) for the text. | About 40 cm wide |
| FPS counter (debug) | Small flat panel with a canvas texture (average FPS and worst frame in ms), standing just above the ring handle, left of front. Rises with the board, never spins. On in the dev server, `?fps` on the hosted build, F toggles it. | 9 cm wide |
| Giant's mouth feedback | None in the world. Use a sound and a small burst of particles at the face when a goblin is eaten. | |
| Goblin helmet (only if helmets are used) | Small half sphere on the head. | 1 cm |
| Goblins (only as the performance fallback) | Code-made body parts (capsule body, sphere head, cylinder limbs), one InstancedMesh per part, animated in code. See [assets.md](assets.md#2-characters-troops-goblins-workers). | 3.5 cm tall |
