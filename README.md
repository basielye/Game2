# Lanternfall

A cozy-tense tactics puzzle for the browser. Fog creeps toward the village at dusk; you have a
Keeper, a little oil and a handful of lanterns. Plan, press Play, and watch the night unfold in
under 20 seconds. If the fog gets someone, they don't get hurt. They get *poofed* onto a rooftop
(sometimes dropping their turnips on the way).

Vite + TypeScript + Canvas 2D. No engine, no runtime dependencies, no asset files (sound is synthesized with WebAudio).

## Running it

```bash
npm install
npm run dev        # http://localhost:5173  (add ?night=7 to jump to a night)
npm test           # Vitest: fog rules, lighting, pathing, determinism, levels, daily, palette contrast
npm run balance    # 10,000 random plans per night through the pure sim + flags
npm run build      # typecheck + production build into dist/ (static, relative paths)
```

Design helpers (not needed to play):

```bash
npx tsx scripts/try.ts 8 replay      # one night: random win rate, best plan, ASCII replay ("none" = no lanterns)
npx tsx scripts/design.ts 8 6 3-6    # sweep villager delays (0..6) and oil (3..6), rank variants
npx tsx scripts/gen.ts 7 --map       # preview the next 7 daily puzzles
```

## How to play

- **Each night has one fog rule**, shown on the card above the board.
- **Fog moves one step per turn.** Anyone standing in fog that isn't lit gets poofed onto a roof.
- **Light blocks fog.** Lit tiles can't be entered, and fog already sitting on a tile when it's lit at dusk is pushed back.
- **The Keeper** places your lanterns before nightfall. Every lantern costs oil, and so does every
  tile the Keeper walks (1 oil per step). The footprints on the board show the walk; the Keeper
  always takes the shortest order, so only *where* you place matters. Light vs. reach is the whole game.
- **Villagers** walk the dotted routes, one tile per turn (some wait a few turns first: "wait 2").
  Get enough of them home for 1–3 stars.
- **The hatched tiles** show where fog will spread next turn. They update live as you place lanterns.
- **Play** runs the night. **Skip** jumps to the end. **Retry** is instant and keeps your lanterns.

Controls: tap or click a tile to place the selected lantern, tap it again to remove it.
Keys: `1`–`5` pick a lantern, `R` turns the Reflector (or retries), `Space` plays / skips / retries, `U` undo.

### Fog personalities

| | Fog | Rule |
|---|---|---|
| 🐌 | Creeper | Creeps one tile a turn, hugging walls and edges when it can (if a neighbour touches a wall, house or the map edge it goes there first). |
| 🐸 | Leaper | Rests, then leaps two tiles straight, right over walls and light. A one-tile hedge or light line won't stop it. |
| 🐺 | Hunter | Creeps one tile a turn toward the nearest lantern (if there's nothing to hunt, it spreads everywhere). A decoy can lead it astray. |

### Lanterns

| Lantern | Oil | Rule |
|---|---|---|
| Lantern | 1 | Lights a 3×3 square. |
| Beacon | 3 | Lights a big rounded 5×5. |
| Reflector | 2 | Lights its tile plus a 4-tile beam in one direction; stops at walls, shines over water. Tap the palette button again (or press `R`) to turn it. |
| Flare | 1 | Same big glow as a Beacon, but burns out after turn 2. |
| Fog Pie | 2 | No light. Fog within 3 tiles rushes straight at it; when fog reaches it, the pie gobbles every fog tile within 2 and is gone. Great for buying time later in the night, or for dragging fog right across someone's path. |

### Modes

- **Story**: 10 handcrafted nights, one new idea each.
- **Daily puzzle**: generated from the UTC date, identical for everyone. After playing you get a spoiler-free emoji result (who got home, stars, oil, tries) with a Copy button.
- **Lantern Run**: five generated nights. Before each one, draft one of three special lanterns (or extra oil) for your satchel.

"Stronger fog patterns" in the menu thickens the fog texture. The palette is built so lit, fogged
and plain tiles differ in *brightness*, not just hue; `tests/theme.test.ts` checks this under
protanopia, deuteranopia and tritanopia simulations.

## Project layout

```
src/
  sim/            pure, deterministic game logic; no DOM, runs in Node
    types.ts        LevelDef, Placement, Plan
    grid.ts         level parsing, tiles, BFS
    lanterns.ts     lantern specs and lighting
    fog.ts          the three fog personalities
    plan.ts         Keeper walking and oil cost (shortest visiting order)
    sim.ts          simulate(level, plan) -> frames + events + stars
    solver.ts       random plans and hill-climbing search (balance, tests, generator)
    generate.ts     seeded night generator for the daily puzzle and runs
    rng.ts          seeded RNG (mulberry32 + FNV hash)
  levels/levels.ts  the 10 handcrafted nights (plain data)
  game/             browser-only: renderer, effects, audio, theme, storage, share text
  main.ts           controller: planning, playback, menus, modes
scripts/            balance, design probes, daily preview
tests/              Vitest suites
docs/balancing.md   what the balance pass found and changed
```

The simulation is a pure function of `(level, plan, seed)`. The seed only picks cosmetic
reactions (who drops a teapot), never the outcome, so replays, the daily puzzle and the balance
script all agree.

## Adding a level

Levels are plain objects in `src/levels/levels.ts`:

```ts
{
  id: 'new-night',                 // unique, used for saves
  name: 'Lantern Lane',
  hint: 'One short line that teaches the new idea.',
  map: [                           // any rectangle; 8x8 fits phones best
    'MMMMMMMM',                    // M marsh: fog source, always foggy
    '........',                    // . ground
    'T##...##',                    // # stone wall, T tree (both walls)
    'H.......',                    // H house (safe)
    '~~~=~~~~',                    // ~ water (fog drifts over it), = bridge
    '..f.....',                    // f ground that starts foggy
    '........',
    '....K...',                    // K where the Keeper starts
  ],
  fog: 'creeper',                  // 'creeper' | 'leaper' | 'hunter'
  oil: 5,
  lanterns: ['basic', 'beacon'],   // what the palette offers
  villagers: [
    // Waypoints [x, y] joined by straight lines; must end in a house.
    { route: [[7, 3], [0, 3]], delay: 1, name: 'Pip' },
  ],
  stars: [1, 1, 1],                // villagers home for 1, 2, 3 stars
}
```

Then:

1. `npx tsx scripts/try.ts <n>` checks that it's lost with no lanterns, shows the best plan, and
   whether the night's *new* lantern is actually needed. `replay` prints the night turn by turn.
2. `npx tsx scripts/design.ts <n>` sweeps delays/oil if the timing feels off.
3. `npm run balance -- --night <n>` must not say UNWINNABLE (the script exits non-zero if any night is).
4. Add a 3★ reference plan for it in `tests/levels.test.ts` so rule changes can't silently break it.

## Rule interpretations worth knowing

- **"Pushes fog back one tile"**: fog sitting on a tile when it becomes lit is cleared, and fog can never enter a lit tile.
- **Leaper** alternates rest/leap turns so it averages the same speed as the others; on a leap it fills both tiles it passes, skipping any that are walls or lit.
- **Bait** has no light of its own. Lured fog ignores its normal rule and only moves toward the pie.
- **Water and marsh** tiles were added: water gives bridges a purpose (fog drifts over water, lanterns can't go on it), marsh is the visible fog source.
- **The Keeper's order** is optimized automatically so tap order never costs oil by accident.
