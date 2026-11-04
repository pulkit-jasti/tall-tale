# Asset Map (MVP)

Which model and sound to use for each thing in the MVP. Use these files, do not pick others. Anything not listed here has no good model yet and uses a simple shape from [placeholder-shapes.md](placeholder-shapes.md).

Back to [GDD index](GDD.md). Related: [mvp.md](mvp.md), [map.md](map.md#scale-from-the-mockup), `public/gltf/README.md`, `public/audio/README.md`.

---

## 1. How to use the models

- All paths below are relative to `public/gltf/`. Every model is a `.glb`.
- **Palette:** Kenney models read their colors from `Textures/colormap.png` in their own folder. Keep the folder structure as it is. Goblin Camp and Nature Kit models need no image.
- **Scale:** the kits use about 1 unit per tile. Scale each model in code so its bounding box matches the **target size** in the tables (1 unit in the game = 1 cm in [map.md](map.md#scale-from-the-mockup), check the real unit in the code).
- **Load once, reuse:** load each file once and clone it. Use instancing for static things that repeat (trees, rocks, bushes, pebbles, pips). Check iwsdk-reference for the right way to load, clone and instance glTF in IWSDK.
- **Tint:** to change a color (enemy types, flags), multiply the material color in code. Do not edit the files.
- **Variants:** where a row lists several files, pick one per placement with the seeded random function.

## 2. Characters (troops, goblins, workers)

All 4 characters share the same rig: 7 bones (`root`, `torso`, `head`, `arm-left`, `arm-right`, `leg-left`, `leg-right`), 2 meshes, 1 material, and the same animation names. Each one costs 2 draw calls.

| Thing | File | Target size | Tint |
|---|---|---|---|
| Troop (main) | `characters/mini-arena/character-soldier.glb` | 2.5 cm tall | Own colors |
| Troop (variety) | `characters/mini-forest/character-archer.glb` | 2.5 cm tall | Own colors |
| Worker in the courtyard | `characters/mini-dungeon/character-human.glb` | 2.5 cm tall | Own colors |
| Grunt | `characters/mini-dungeon/character-orc.glb` | 3.5 cm tall | Green (own colors) |
| Runner | `characters/mini-dungeon/character-orc.glb` | 3 cm tall | Yellow accent |
| Climber | `characters/mini-dungeon/character-orc.glb` | 3.5 cm tall | Purple accent |

- Goblin types share one model and differ by size, tint and speed (each type has its own color accent, see [enemies.md](enemies.md)). The agent picks the exact tints.
- **Performance fallback:** 40 to 80 skinned characters may be too slow on Quest 3S. If the frame rate drops, switch goblins to code-made shapes (one InstancedMesh per body part, animated in code). First headset test: about 50 skinned goblins hold 72 Hz, so the fallback is not needed yet. Decide again with troops in step 5 ([performance.md](performance.md)).
- **Weapons:** attach to the `arm-right` bone. Goblins: `props/mini-arena/weapon-spear.glb` (some goblins bare handed for variety). Troops: `props/mini-arena/weapon-sword.glb`. Target length about 1.5 cm. A weapon is the "gear" that flies off when peppered.

### Animations

| Moment | Clip |
|---|---|
| Walking on a road | `walk` |
| Runner moving | `sprint` |
| Grunt or runner hitting the wall, troops fighting | `attack-melee-right`, `attack-melee-left` (alternate) |
| Climber climbing the wall | `interact-right` while moving up |
| Climber popping up on the rampart | `jump` |
| Held by the player (struggling) | `fall` (loop) |
| Dropped back on the board, dazed | `crouch`, then `idle` |
| Stunned by the megaphone or bell | `emote-no` (loop) |
| Sneezing from pepper | `emote-no` (once) |
| Death (before the poof) | `die` |
| Waiting, troops at the gate | `idle` |
| Workers and troops cheering (breather, win) | `emote-yes` |
| Workers panicking (intruders, lose) | `sprint` |
| Workers carrying things | `holding-both` with `walk` |

## 3. The castle

| Thing | File | Target size | Notes |
|---|---|---|---|
| Castle wall | Code | 6 cm high, from 40 to 46 cm | Round, see [placeholder-shapes.md](placeholder-shapes.md) |
| Towers on the wall (4 to 6) | `castle/castle-kit/tower-hexagon-base.glb` + `tower-hexagon-roof.glb` on top | About 10 cm tall, 5 cm wide | Stack the roof on the base |
| Courtyard buildings (2 to 4) | `castle/castle-kit/tower-square-mid-door.glb` + `town/fantasy-town/roof-gable.glb` | About 5 cm tall | Small houses. Workers hide in them |
| Courtyard stalls | `town/fantasy-town/stall-red.glb`, `stall-green.glb` | About 4 cm tall | |
| Courtyard props | `town/fantasy-town/cart.glb`, `props/survival/box.glb`, `box-large.glb`, `props/mini-dungeon/barrel.glb` | Cart 4 cm long, boxes and barrels 1 to 1.5 cm | Things workers carry and drop |
| Courtyard lanterns | `town/fantasy-town/lantern.glb` | 4 cm tall | Optional |

## 4. The board and the map

| Thing | File | Target size | Notes |
|---|---|---|---|
| Board, roads, slope | Code | See [map.md](map.md) | See [placeholder-shapes.md](placeholder-shapes.md) |
| Camp hill | `props/castle-kit/ground-hills.glb` | 15 to 30 cm wide (bigger camp = bigger hill) | Sinks as enemies come out |
| Camp rocks | `rocks/survival/rock-sand-a.glb`, `rock-sand-b.glb`, `rock-sand-c.glb` | 3 to 6 cm | 3 to 6 around each hill |
| Camp tents | `camp/survival/tent.glb`, `tent-canvas.glb`, `camp/nature/tent_smallClosed.glb` | 4 to 5 cm | 1 to 3 per camp |
| Big camp tent (largest camp only) | `camp/goblin/tent_3.glb` | 8 cm | Heavy (592 triangles). On trial, remove if slow |
| Camp fence and fire | `camp/goblin/branch_fence_1.glb`, `camp/survival/campfire-pit.glb` | Fence 6 cm long, fire 2 cm | |
| Powder keg (trigger) | `props/survival/barrel.glb` | 2 cm tall | Tint red bands if it needs to read as explosive |
| Boulder (trigger) | `rocks/nature/rock_smallH.glb` | 4 cm | The roundest rock. Spins as it rolls |
| Boulder hill | `rocks/nature/rock_largeA.glb` to `rock_largeD.glb` | 8 to 10 cm | Beside the road, under the boulder |
| Leaning tree (trigger) | `trees/fantasy-town/tree-crooked.glb` | 12 cm tall | Leans over the road, falls 90 degrees |
| Keg and tree debris | `props/survival/resource-planks.glb`, `resource-wood.glb` | 1 to 2 cm | Pooled |
| Decor trees | `trees/nature/tree_default.glb`, `tree_oak.glb`, `tree_cone.glb`, `tree_fat.glb`, `tree_pineRoundA.glb`, `tree_pineTallA.glb`, `tree_simple.glb`, `tree_small.glb` | 6 to 12 cm tall | Instanced, off the roads |
| Decor rocks | `rocks/nature/rock_largeA.glb` to `rock_largeD.glb`, `rock_smallA.glb` to `rock_smallD.glb`, `rock_tallA.glb` to `rock_tallC.glb` | 1 to 8 cm | Instanced |
| Decor plants | `plants/nature/plant_bush.glb`, `plant_bushLarge.glb`, `plant_bushSmall.glb`, `grass.glb`, `grass_large.glb`, `flower_purpleA.glb`, `flower_redA.glb`, `flower_yellowA.glb`, `mushroom_redGroup.glb`, `stump_round.glb`, `log.glb` | 1 to 3 cm | Instanced, many and cheap |
| Fields | `farm/nature/crops_dirtRow.glb`, `crops_wheatStageB.glb`, `crops_cornStageB.glb`, `crop_pumpkin.glb`, `fence_simple.glb` | Rows 4 cm long, crops 1 to 2 cm | A few small fields outside the wall |
| Far houses | `castle/castle-kit/tower-square-mid-windows.glb` + `town/fantasy-town/roof-point.glb` | 5 cm tall | Optional, far zone only |
| Windmill | `town/fantasy-town/windmill.glb` | 15 cm tall | Optional, one only, far zone. Blades can spin in code |

Not in the MVP map: siege machines, bridge, forest, mud, hill features, cage, cabins, stone house, `stone_1` and `stone_2`. The troop gate is an invisible spawner in the MVP, so it has no model (`castle/castle-kit/gate.glb` is kept for later gate mechanics).

## 5. Around the player (fixed, does not rotate)

| Thing | File | Target size | Notes |
|---|---|---|---|
| Castle health flag | `castle/castle-kit/flag-banner-long.glb` | Banner 8 cm tall | Tint red. Slides down a code-made pole as health drops |
| Wave flag | `castle/castle-kit/flag-pennant.glb` | 6 cm tall | Tint blue. Rises one notch per wave on a code-made pole |
| Tool platforms | `castle/castle-kit/tower-hexagon-top.glb` | 12 to 15 cm wide | One per tool |
| Food jar | `props/mini-dungeon/pot.glb` | 10 cm tall | Fill level is a code-made disc inside |
| Pebbles | `rocks/survival/resource-stone.glb` | 2.5 cm (bigger than first planned, easier to see and hit) | Instanced and pooled |
| Pebble pile in the bowl | `rocks/survival/resource-stone-large.glb` | 6 cm | Shrinks as pebbles are taken |
| Slingshot target (tutorial only, optional) | `props/mini-forest/target.glb` | 8 cm | |

### Tutorial ghost hands

| Thing | File | Size | Notes |
|---|---|---|---|
| Ghost hand (tutorial demos) | `hands/left.glb`, `hands/right.glb` | Real hand size (meters) | Meta's standard WebXR hand ("generic-hand" from WebXR Input Profiles 1.0.20, MIT, license in the folder). 25 joints, flat hierarchy. Posed with IWSDK's `AnimatedControllerHand` open and pressed poses. See `src/ui/ghostHand.ts`. |

UI images for the hint sign and panels are in `public/ui/` (see its README).

## 6. Sounds

All sounds are mapped in `public/audio/README.md` (file names and what each one is for). Use them from the build step where each feature is built. Sounds listed there as missing use `public/audio/chime.mp3` until the last build step.
