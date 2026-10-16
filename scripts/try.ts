// Level design probe: npx tsx scripts/try.ts <night 1-10> [replay]
// Prints: survivors with no lanterns, random win rate, best plan, best plan without the night's new lantern.
import { LEVELS } from '../src/levels/levels';
import { parseLevel, simulate, search, Rng, randomPlan, candidates, Tile, type LevelDef, type Plan } from '../src/sim';

const n = Number(process.argv[2] ?? 1) - 1;
const def = LEVELS[n];
const level = parseLevel(def);
const none = simulate(level, { placements: [] });
const rng = new Rng(1);
const cands = candidates(level);
let wins = 0;
let threes = 0;
const N = 3000;
for (let i = 0; i < N; i++) {
  const r = simulate(level, randomPlan(level, rng, cands));
  if (r.won) wins++;
  if (r.stars === 3) threes++;
}
const best = search(level, new Rng(7), 8000);
console.log(`${n + 1}. ${def.name} [${def.fog}] turns=${level.maxTurns}`);
console.log(`  no lanterns: ${none.survivors}/${none.total}   random win ${(wins / N * 100).toFixed(1)}%  3★ ${(threes / N * 100).toFixed(1)}%`);
console.log(`  best: ${best.survivors}/${level.villagers.length} oil ${best.oil}/${def.oil}  ${fmt(best.plan)}`);
const prev = n > 0 ? LEVELS[n - 1].lanterns : [];
const fresh = def.lanterns.filter((t) => !prev.includes(t));
if (fresh.length) {
  const without: LevelDef = { ...def, lanterns: def.lanterns.filter((t) => !fresh.includes(t)) };
  const b2 = search(parseLevel(without), new Rng(7), 8000);
  console.log(`  without ${fresh.join(',')}: ${b2.survivors}/${level.villagers.length} oil ${b2.oil}  ${fmt(b2.plan)}`);
}

function fmt(p: Plan) {
  return p.placements.map((q) => `${q.type}@${q.x},${q.y}${q.dir !== undefined ? 'NESW'[q.dir] : ''}`).join(' ');
}

if (process.argv[3] === 'replay' || process.argv[3] === 'none') {
  const plan = process.argv[3] === 'none' ? { placements: [] } : best.plan;
  const r = simulate(level, plan);
  const lanterns = new Set(plan.placements.map((p) => p.y * level.w + p.x));
  for (const f of r.frames) {
    console.log(`-- turn ${f.turn} ${f.events.filter((e) => e.type !== 'step').map((e) => e.type).join(' ')}`);
    for (let y = 0; y < level.h; y++) {
      let row = '';
      for (let x = 0; x < level.w; x++) {
        const i = y * level.w + x;
        const v = f.villagers.findIndex((s) => s.at === i && s.status !== 'swallowed');
        const t = level.tiles[i];
        row += v >= 0 ? String(v)
          : lanterns.has(i) ? 'L'
          : t === Tile.wall ? '#' : t === Tile.house ? 'H' : t === Tile.marsh ? 'M'
          : f.fog[i] ? '%' : f.lit[i] ? '+' : t === Tile.water ? '~' : t === Tile.bridge ? '=' : '.';
      }
      console.log('  ' + row);
    }
  }
}
