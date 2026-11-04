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
| Castle wall | Round ring wall, 6 cm high, from 46 to 52 cm. Crenellations as small boxes on top (instanced). Stone grey with a lighter top. Cracks and scorch marks as darker decals or vertex colors when damaged. |
| Flag poles | Thin cylinders with a ball on top. The cloth is a flat plane (red for health, blue for waves) that slides up and down and sways. The wave pole has one small flat notch per wave. |
| Food jar fill level | A heap of small low-poly food balls (instanced) on the pot's mouth, one ball per food, in layers of 6, 3 and 1. They pop in and out. (A disc inside does not show: the pot's neck is too narrow.) |
| Particles: poof, stars, smoke, sparks, splat | Small instanced quads or low-poly spheres, pooled. |
| Sun | A cartoon sun far away (150 m) facing the player, all unlit flat shapes: a warm additive glow, 14 pointy rays (long and short in turn, turning slowly), an orange rim, a yellow face and a pale shine spot. Never writes depth, drawn in a fixed order, so the layers never flicker. Decor only. |
| Clouds | 26 clouds of 6 round low-poly puffs each (icosahedrons), all in one instanced mesh, unlit, white with a light sky blue underside baked into the face colors, fog off. Low and fairly close (3 to 10 m up, 14 to 70 m out), drifting slowly with the wind, shrinking away at the edge of their wrap area. Never write depth, sorted far to near. Decor only. |
| Hills | Faceted low-poly mounds (a nudged half sphere, darker at the base), one instanced mesh per layer: 34 small green ones on a grass ring just past the board's edge (in boardLift), and 26 big hazy blue green ones far away (world, lighter farther away). Decor only. |
| Grass ring | A flat ring from the board's edge out to 17 m, rising a little, under the foreground hills. |

## Waiting for a real model

| Thing | Shape | Size |
|---|---|---|
| Slingshot | Y shaped wooden frame (3 cylinders) on the platform, 2 bands (thin cylinders stretched from the fork tips to the pouch) and an open leather pouch that is pinched: a thin upright strip between the two bands, square to the ground and facing the shot, bent back into a U behind the stone (6 flat segments). The strip is lower than the stone, so a loaded stone shows above and below it. The bands tie onto its two ends. Rests on its platform and is picked up by the handle. Built in step 2. | Frame 15 cm tall, pouch 3.6 cm |
| Fly swatter | Long thin handle (cylinder, yellow) and a flat square head (thin red box with a darker rim and neck). Rests on its platform leaning back 18 degrees along the rim (head behind the left shoulder). Built in step 4. | 35 cm long, head 10 x 9 cm |
| Pepper shaker | Red cylinder body with a light dome cap and 4 dark dots for holes. Built in step 4. | 11 cm tall |
| Megaphone | Cone (open wide end, cream with a red band) lying on a short dark pistol grip, the mouthpiece toward the face. Rests standing on its grip, the cone pointing out. Built in step 5. | Cone 13 cm, grip 6 cm |
| Megaphone loudness meter | Thin bar lying on top of the cone, shown while held: a dark track, a fill that grows with the mic loudness (green, yellow near the target, red past it), and a pulsing red dot with a notch at 80% of its length (the scream level). Unlit. | About 10 cm long, 0.5 cm wide |
| Bell | Brass bell (lathe, flared mouth, a clapper inside) hanging below a short wooden handle with a knob. Rests on its mouth, handle up. Built in step 5. | 10 cm tall |
| Stun shock ring | A thin flat ring (unlit, transparent) running out across the board from the castle when the megaphone or bell stuns. | Up to 2.6 m |
| Dizzy stars | Two small yellow low-poly balls circling over each stunned goblin's head, all in one instanced mesh. | 0.55 cm |
| Pebble bowl | Shallow open bowl (lathe), clay color, on a short post. Built in step 2 at 11 cm (`PEBBLE_BOWL.width`), so it fits between the slingshot platform and the ring handle. | 11 cm wide |
| Tool platform posts | Dark wooden cylinder under each tool platform and under the pebble bowl. | 1 cm thick, 12 to 14 cm long |
| Slingshot trajectory dots | Small white low-poly spheres, one instanced mesh, along the whole arc to the impact while pulling. | 0.9 cm |
| Slingshot landing circle | Flat white circle (20 sides), semi transparent, lying on the ground where the shot will land. | 8 cm wide |
| Price tag | A thin wooden box on the front edge of each food tool's platform, beside the tool, tilted back toward the eyes. Its face is a canvas texture: a round food ball (the jar's ball color) and the cost in big bold numbers. Cream number = can afford, red = cannot, a green tick while a paid use runs. Redrawn only when that changes. Replaced the food pips. | 4.6 x 2.8 cm |
| Tool rope (Locked) | A thin tan ring (torus) around the base of a food tool resting on its platform, shown only while it cannot be paid for. The tool's colors are dimmed too. | Tool width plus 1 cm |
| Ring handle | Full circle rail (closed tube) around the player on 8 short poles (cylinders), with 12 small bands (thin tori, arrow color) spread evenly around it so its turning is easy to see. Testing a full circle; `halfSpanDeg` in config makes it an arc again (with round ends). | 27 cm from center, 2.8 cm thick, 5 cm high |
| Arrows for the ring handle | Flat arrow shapes (extruded 2D shape), bright color: a curved double arrow lying on the ring at the front, and a small up and down arrow standing on it 50 degrees left and right of front. They never turn with the ring. Kept small (`arrowSize` in config). | About 5 to 8 cm |
| Play button (in VR) | Big round button (short cylinder) on a small post. | 10 cm wide |
| Wrist pause button | Small round button (short cylinder) on the inside of the left wrist. | 3 cm wide |
| Tutorial hint sign | Flat panel with a canvas texture (Kenney beige panel, inset, checkbox, icons from `public/ui/`), low in front just outside the ring, tilted back 45 degrees. | 22 x 9 cm |
| Wall hit flash | A thin red box lying on the wall top where a goblin hits, fading out (unlit, transparent, a pool of 12), with a few dust particles. | 7 cm along the wall |
| Compass letters | N, NE, E, SE, S, SW, W, NW in blocky raised letters on the ring's inner face, 45 degrees up the tube. Each letter is small boxes on a 5 row grid, all in one instanced mesh with the ring bands' gold material, half sunk into the tube. Main letters bigger. In the ring's group, so they turn with it. | Main letters 1.35 cm tall, the others 0.85 cm |
| Tutorial marker | One sprite always drawn on top: a down arrow bouncing above the target, drawn in code at 256 px, so it stays sharp. (The left and right arrows on the ring for targets out of view were removed with the head direction check. A pointer comes later.) | 3 cm |
| Poke buttons (Next, Play, Play again) | One shared component (`src/ui/pokeButton.ts`): a smooth green cap raised in a dark rim, with a crisp icon drawn in code on its face (cream with a brown outline: arrow, play, restart). Only the size and icon change. The cap follows the fingertip in and clicks at the bottom. The Next button stands on its own post straight in front, between the tool platforms (33.5 cm out, 9 cm up, tilted toward the eyes), because the sign itself is out of reach. | Next 5.2 cm wide, panels 7 cm |
| Pause, win and lose panels | Rounded flat panel with big poke buttons. Win and lose (step 3): text on a canvas texture like the FPS panel, and one round button (short cylinder) poked with the index finger. | 32 x 20 cm (40 cm was too wide this close) |
| FPS counter (debug) | Small flat panel with a canvas texture Top: live FPS, worst frame in ms, units on the board, "paused". Bottom: the measured run (avg FPS, 1% low, missed frames). Standing just above the ring handle, left of front. Rises with the board, never spins. On in the dev server, `?fps` on the hosted build, F or the debug page toggles it. | 13.6 x 6.8 cm |
| Giant's mouth feedback | None in the world. Use a sound and a small burst of particles at the face when a goblin is eaten. | |
| Goblin helmet (only if helmets are used) | Small half sphere on the head. | 1 cm |
| Goblins (only as the performance fallback) | Code-made body parts (capsule body, sphere head, cylinder limbs), one InstancedMesh per part, animated in code. See [assets.md](assets.md#2-characters-troops-goblins-workers). | 3.5 cm tall |
