// Balance report: npm run balance [-- --plans 10000] [--night 3] [--json]
//
// For every handcrafted night, using only the pure simulation:
//   * 10,000 random valid plans -> win rate (>= 1 star) and star distribution
//   * every single-lantern placement tried exhaustively -> how many win alone
//   * the placement with the biggest pull on 3-star plans -> dominant strategy check
//   * a hill-climbing search -> proves the night is winnable (and 3 stars reachable)
// Flags nights that are unwinnable, trivial, too easy, too hard or have a dominant strategy.
// Exits non-zero if any night is unwinnable.

import { LEVELS } from '../src/levels/levels';
import {
  ALL_LANTERNS,
  LANTERNS,
  candidates,
  parseLevel,
  randomPlan,
  Rng,
  search,
  simulate,
  type LevelDef,
  type Placement,
} from '../src/sim';

const args = process.argv.slice(2);
const opt = (name: string, def: number) => {
  const k = args.indexOf(`--${name}`);
  return k >= 0 ? Number(args[k + 1]) : def;
};
const PLANS = opt('plans', 10000);
const ONLY = opt('night', 0);
const JSON_OUT = args.includes('--json');

// Thresholds. Random plans are much worse than a thinking player, so these are deliberately loose.
const T = {
  tooEasyWin: 0.5, // > 50% of random plans earn a star
  tooEasy3: 0.25, // > 25% of random plans earn 3 stars
  tooHardWin: 0.02, // < 2% of random plans earn even 1 star...
  trivialSingles: 0.2, // >= 20% of single-lantern placements earn 3 stars
  dominantP3: 0.9, // a placement whose plans get 3 stars >= 90% of the time...
  dominantMin: 0.05, // ...and that shows up in >= 5% of random plans
};

const key = (p: Placement) => `${LANTERNS[p.type].name}@${p.x},${p.y}${p.type === 'reflector' ? 'NESW'[p.dir ?? 1] : ''}`;
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

interface Report {
  night: number;
  id: string;
  name: string;
  winRate: number;
  stars: number[];
  noLanterns: number;
  singles: { wins3: number; total: number };
  best: { survivors: number; total: number; oil: number; plan: string };
  dominant: { feature: string; share: number; p3: number } | null;
  typeLift: Record<string, number>;
  flags: string[];
}

function analyse(def: LevelDef, night: number): Report {
  const level = parseLevel(def);
  const rng = new Rng(`balance:${def.id}`);
  const cands = candidates(level);
  const stars = [0, 0, 0, 0];
  const feat = new Map<string, { n: number; three: number }>();
  const types = new Map<string, { n: number; three: number }>();
  let wins = 0;

  for (let k = 0; k < PLANS; k++) {
    const plan = randomPlan(level, rng, cands);
    const r = simulate(level, plan);
    stars[r.stars]++;
    if (r.won) wins++;
    const three = r.stars === 3 ? 1 : 0;
    for (const p of plan.placements) {
      const f = feat.get(key(p)) ?? { n: 0, three: 0 };
      f.n++;
      f.three += three;
      feat.set(key(p), f);
    }
    for (const t of new Set(plan.placements.map((p) => p.type))) {
      const s = types.get(t) ?? { n: 0, three: 0 };
      s.n++;
      s.three += three;
      types.set(t, s);
    }
  }

  // Exhaustive single placements.
  let singles3 = 0;
  for (const c of cands) {
    const r = simulate(level, { placements: [c] });
    if (r.cost.valid && r.stars === 3) singles3++;
  }

  const noLanterns = simulate(level, { placements: [] });
  const best = search(level, new Rng(`search:${def.id}`), 12000);
  const bestR = simulate(level, best.plan);

  // Dominant strategy: the most common placement among plans that are near-certain 3 stars.
  let dominant: Report['dominant'] = null;
  for (const [f, s] of feat) {
    if (s.n < 30) continue;
    const p3 = s.three / s.n;
    const share = s.n / PLANS;
    if (!dominant || p3 * Math.sqrt(share) > dominant.p3 * Math.sqrt(dominant.share)) dominant = { feature: f, share, p3 };
  }

  const base3 = stars[3] / PLANS;
  const typeLift: Record<string, number> = {};
  for (const t of ALL_LANTERNS) {
    const s = types.get(t);
    if (s && s.n >= 30) typeLift[LANTERNS[t].name] = s.three / s.n - base3;
  }

  const winRate = wins / PLANS;
  const flags: string[] = [];
  if (best.survivors < def.stars[0]) flags.push('UNWINNABLE');
  else if (bestR.stars < 3) flags.push('NO 3 STARS FOUND');
  if (noLanterns.won) flags.push('TRIVIAL: wins with no lanterns');
  if (cands.length && singles3 / cands.length >= T.trivialSingles) flags.push(`TRIVIAL: ${pct(singles3 / cands.length)} of single lanterns earn 3★`);
  if (winRate > T.tooEasyWin) flags.push(`TOO EASY: ${pct(winRate)} of random plans win`);
  if (base3 > T.tooEasy3) flags.push(`TOO EASY: ${pct(base3)} of random plans get 3★`);
  if (winRate < T.tooHardWin) flags.push(`TOO HARD: only ${pct(winRate)} of random plans win`);
  if (dominant && dominant.p3 >= T.dominantP3 && dominant.share >= T.dominantMin)
    flags.push(`DOMINANT: ${dominant.feature} gets 3★ ${pct(dominant.p3)} of the time`);

  return {
    night,
    id: def.id,
    name: def.name,
    winRate,
    stars: stars.map((s) => s / PLANS),
    noLanterns: noLanterns.survivors,
    singles: { wins3: singles3, total: cands.length },
    best: {
      survivors: best.survivors,
      total: level.villagers.length,
      oil: best.oil,
      plan: best.plan.placements.map(key).join(' + ') || '(none)',
    },
    dominant,
    typeLift,
    flags,
  };
}

const t0 = Date.now();
const reports: Report[] = [];
LEVELS.forEach((def, k) => {
  if (ONLY && ONLY !== k + 1) return;
  reports.push(analyse(def, k + 1));
});

if (JSON_OUT) {
  console.log(JSON.stringify(reports, null, 2));
} else {
  console.log(`Lanternfall balance — ${PLANS.toLocaleString('en-US')} random valid plans per night\n`);
  for (const r of reports) {
    console.log(`Night ${r.night}: ${r.name}`);
    console.log(`  win rate ${pct(r.winRate)}   stars 0/1/2/3: ${r.stars.map(pct).join(' / ')}`);
    console.log(`  no lanterns: ${r.noLanterns}/${r.best.total} home   single lanterns earning 3★: ${r.singles.wins3}/${r.singles.total}`);
    console.log(`  best found: ${r.best.survivors}/${r.best.total} home, ${r.best.oil} oil — ${r.best.plan}`);
    if (r.dominant) console.log(`  strongest placement: ${r.dominant.feature} (in ${pct(r.dominant.share)} of plans, 3★ ${pct(r.dominant.p3)} of the time)`);
    const lifts = Object.entries(r.typeLift).map(([t, l]) => `${t} ${l >= 0 ? '+' : ''}${(l * 100).toFixed(1)}`);
    if (lifts.length) console.log(`  3★ lift by lantern type (pts): ${lifts.join(', ')}`);
    console.log(r.flags.length ? r.flags.map((f) => `  ⚠ ${f}`).join('\n') : '  ✓ looks balanced');
    console.log('');
  }
  console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

if (reports.some((r) => r.flags.includes('UNWINNABLE'))) process.exit(1);
