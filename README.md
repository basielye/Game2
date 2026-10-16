# Leafscapes: The Glasshouse

A match-3 restoration game in the spirit of *Gardenscapes*, with a twist: instead of a garden, you restore a
Victorian glasshouse and fill it with collectible houseplants. Every plant is illustrated procedurally, leaf by
leaf, so a Thai Constellation really does have speckles, an Albo has white half-moons, and an Obliqua 'Peru' is
more hole than leaf.

Open `index.html` in a browser. There are no dependencies and no build step. Progress is saved to `localStorage`.

## How it plays

1. **Solve puzzle levels** to earn ★ stars (hard levels give 2 stars, super-hard levels give 3) and coins.
2. **Spend stars on restoration tasks**: sweep the glass, re-glaze panes, rebuild the potting bench, hang grow lights.
3. **Choose plants**: pick from three varieties for each spot (for example Monstera deliciosa, 'Thai Constellation' or
   'Albo Borsigiana') and preview each one live in the scene before you commit. Pots can be swapped too.
4. **Grow your collection**: watering and feeding tasks take plants from juvenile to established to mature. Mature
   Monsteras develop splits, fenestrations and aerial roots.
5. **Fill the Herbarium**: an illustrated field guide covering 59 species and cultivars. It shows care needs, origin,
   rarity, botanical field notes and every growth stage, from a rooted cutting in a jar to a mature plant.

There are five rooms: *Monstera Corner*, *The Velvet Wall* (Philodendrons and Anthuriums), *Alocasia Grove*,
*The Shade House* (Calatheas and prayer plants) and the *Hanging Gallery* (pothos, Hoyas and string-of-pearls).

## Puzzle mechanics

| Match | Creates | Effect |
|---|---|---|
| 4 in a line | **Dragonfly** | Zips across the whole row or column |
| 2×2 square | **Butterfly** | Clears its neighbours, then flies to a goal tile |
| L or T shape | **Seed Bomb** | Large round blast |
| 5 in a line | **Prism Dahlia** | Clears every tile of one kind |

You can tap a power-up to fire it, or swap two power-ups together for combos. Dragonfly + Dragonfly makes a cross,
Bomb + Dragonfly clears a triple-width cross, Butterfly carries its partner to a target, and the Dahlia can turn a
whole colour into power-ups. Obstacles are moss (one or two layers), clay pots (one or two hits) and vine-bound
tiles. When you finish a level, leftover moves turn into a "Bloom Bonus" of dragonflies.

## Code map

| File | Purpose |
|---|---|
| `js/species.js` | The plant catalogue: botany text plus the leaf specs that drive the artwork |
| `js/plants.js` | Procedural SVG botanical engine: leaf outlines, vein skeletons, fenestration masks, 20+ variegation patterns, 14 growth forms, pots, propagation jars |
| `js/match3.js` | Board model, match detection, power-ups, combos, gravity, effects and canvas renderer |
| `js/levels.js` | Level generator: hand-drawn board shapes, tutorial levels, scaled obstacles and goals |
| `js/scene.js` | Glasshouse rooms, task chains and the illustrated restoration scene |
| `js/stickers.js` | Photo stickers (cut-out heads) used as three of the matchable tile types; source PNGs in `assets/stickers/` |
| `js/audio.js` | Synthesised sound effects and generative ambient music (Web Audio, no files) |
| `js/main.js` | Save data, screens, tasks, choices, Herbarium and level flow |
