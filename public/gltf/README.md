# 3D models

All CC0 (no attribution needed). Low-poly, flat colors, no real textures.

| Folder | What | Source |
|---|---|---|
| trees/ | Trees, including `tree-crooked` (good for the leaning tree trigger) | Nature Kit, Fantasy Town Kit, Survival Kit |
| rocks/ | Rocks, sand rocks (camp hills), stones (pebble pile) | Nature Kit, Survival Kit |
| plants/ | Bushes, grass, flowers, mushrooms, logs, stumps (decor) | Nature Kit |
| farm/ | Crops and fences for fields (decor) | Nature Kit |
| camp/ | Tents, fences, campfires for goblin camps. `goblin/` adds cabins, `stone_house`, `branch_cage` and big cheap `stone_1/2` slabs (on trial, check performance). | Nature Kit, Survival Kit, ByndWalker Goblin Camp (Free folder) |
| town/ | House wall and roof pieces, stalls, cart, banners, lantern, windmill, `roof-point` for tower roofs | Fantasy Town Kit |
| castle/castle-kit/ | Stackable hexagon and square tower pieces for the round wall, 5 flags (for the two flags), `gate`, `metal-gate`, `wall-doorway` (troop gate), `door`, `stairs-stone` | Castle Kit |
| props/ | `barrel` (powder keg), boxes, bucket, planks, `chest` (has open/close animation), `flag`, `target` | Survival Kit, Mini Forest |
| props/mini-arena/ | `trophy` (trophy shelf), `wall-gate`, `banner`, `statue`, `weapon-rack`, spear, sword | Mini Arena |
| props/mini-dungeon/ | `shield-round`, `shield-rectangle` (shield enemy), `barrel`, `pot`, `rocks`, `stones`, `coin`, `trap` (animated) | Mini Dungeon |
| props/castle-kit/ | Siege machines (catapult, ballista, ram, trebuchet, siege tower), each with a `-demolished` version. `bridge-draw`, rocks, `ground-hills` | Castle Kit |
| characters/ | Rigged, 7 bones, all share the same animations (walk, sprint, attack-melee, die, pick-up and more). Troops: `mini-forest/character-archer`, `mini-arena/character-soldier`, `mini-dungeon/character-human`. Enemy option: `mini-dungeon/character-orc` (374 triangles). | Mini Forest, Mini Arena, Mini Dungeon |

## Notes

- **Palettes:** models in a folder with a `Textures/colormap.png` read their colors from that small image (each kit has its own). Keep the image next to the models. Nature Kit and Goblin Camp models need no image.
- **Scale:** the kits use about 1 unit per tile. Scale every model in code to the sizes in docs/map.md, using its bounding box.
- **Heavy models:** Goblin Camp (600 to 2000 triangles, with small textures built into each file) and the Castle Kit siege machines (700 to 1600 triangles). Use them few and far.
