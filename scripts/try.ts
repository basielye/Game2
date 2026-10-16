// Quick level probe: npx tsx scripts/try.ts <levelIndex>
import { LEVELS } from '../src/levels/levels';
import { parseLevel, simulate, search, Rng, randomPlan, candidates } from '../src/sim';

const idx = Number(process.argv[2] ?? 0);
const level = parseLevel(LEVELS[idx]);
const none = simulate(level, { placements: [] });
console.log(level.def.name, 'no lanterns -> survivors', none.survivors, '/', none.total);
const rng = new Rng(1);
const cands = candidates(level);
let wins = 0;
const N = 2000;
for (let i = 0; i < N; i++) if (simulate(level, randomPlan(level, rng, cands)).won) wins++;
console.log('random win rate', (wins / N * 100).toFixed(1) + '%');
const best = search(level, new Rng(7), 6000);
console.log('best', best.survivors, 'oil', best.oil, JSON.stringify(best.plan.placements));

// ASCII replay of the best plan.
import { Tile } from '../src/sim';
const r = simulate(level, best.plan);
const lanterns = new Set(best.plan.placements.map((p) => p.y * level.w + p.x));
for (const f of r.frames) {
  console.log(`-- turn ${f.turn} ${f.events.filter((e) => e.type !== 'step').map((e) => e.type).join(' ')}`);
  for (let y = 0; y < level.h; y++) {
    let row = '';
    for (let x = 0; x < level.w; x++) {
      const i = y * level.w + x;
      const v = f.villagers.findIndex((s) => s.at === i && s.status !== 'swallowed');
      const t = level.tiles[i];
      row += v >= 0 ? String(v) : lanterns.has(i) ? 'L' : t === Tile.wall ? '#' : t === Tile.house ? 'H' : t === Tile.marsh ? 'M'
        : f.fog[i] ? '%' : f.lit[i] ? '+' : t === Tile.water ? '~' : t === Tile.bridge ? '=' : '.';
    }
    console.log('  ' + row);
  }
  if (process.argv[3] !== 'all' && f.turn >= 3 && r.frames.length > 8 && f.turn < r.frames.length - 2) { /* keep short */ }
}
