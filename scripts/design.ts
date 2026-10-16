// Design assistant: sweep villager delays and oil budget for one night and rank the variants.
// npx tsx scripts/design.ts <night 1-10> [maxDelay=4] [oilMin-oilMax]
//
// A good variant: no lanterns saves nobody, the best plan saves everyone,
// the best plan WITHOUT the night's new lantern does not, and random plans rarely get 3 stars.

import { LEVELS } from '../src/levels/levels';
import { parseLevel, Rng, search, simulate, randomPlan, candidates, type LevelDef } from '../src/sim';

const n = Number(process.argv[2]) - 1;
const maxDelay = Number(process.argv[3] ?? 4);
const [oilMin, oilMax] = (process.argv[4] ?? '').split('-').map(Number);
const base = LEVELS[n];
const prev = n > 0 ? LEVELS[n - 1].lanterns : [];
const fresh = base.lanterns.filter((t) => !prev.includes(t));
const nv = base.villagers.length;

interface Row { delays: number[]; oil: number; none: number; best: number; without: number; rnd3: number; score: number }
const rows: Row[] = [];

const combos: number[][] = [[]];
for (let v = 0; v < nv; v++) {
  const next: number[][] = [];
  for (const c of combos) for (let d = 0; d <= maxDelay; d++) next.push([...c, d]);
  combos.splice(0, combos.length, ...next);
}

for (const delays of combos) {
  for (let oil = oilMin || base.oil; oil <= (oilMax || base.oil); oil++) {
    const def: LevelDef = { ...base, oil, villagers: base.villagers.map((v, k) => ({ ...v, delay: delays[k] })) };
    let level;
    try { level = parseLevel(def); } catch { continue; }
    const none = simulate(level, { placements: [] }).survivors;
    if (none > 0) continue;
    const best = search(level, new Rng(3), 1200).survivors;
    if (best < nv) continue;
    const without = fresh.length ? search(parseLevel({ ...def, lanterns: def.lanterns.filter((t) => !fresh.includes(t)) }), new Rng(3), 1500).survivors : 0;
    const rng = new Rng(5);
    const cands = candidates(level);
    let three = 0;
    for (let i = 0; i < 400; i++) if (simulate(level, randomPlan(level, rng, cands)).stars === 3) three++;
    const rnd3 = three / 400;
    const score = (nv - without) * 10 + (rnd3 > 0 && rnd3 < 0.15 ? 5 : 0) - rnd3 * 10;
    rows.push({ delays, oil, none, best, without, rnd3, score });
  }
}
rows.sort((a, b) => b.score - a.score);
for (const r of rows.slice(0, 12))
  console.log(`delays=${r.delays.join(',')} oil=${r.oil}  best=${r.best} without-new=${r.without} random3★=${(r.rnd3 * 100).toFixed(1)}%`);
console.log(`${rows.length} viable variants`);
