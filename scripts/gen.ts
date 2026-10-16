// Preview generated dailies: npx tsx scripts/gen.ts [days=7] [start=YYYY-MM-DD]
import { dailyNight, parseLevel, simulate, utcDate } from '../src/sim';

const days = Number(process.argv[2] ?? 7);
const start = process.argv[3] ? new Date(process.argv[3] + 'T00:00:00Z') : new Date();
for (let k = 0; k < days; k++) {
  const date = utcDate(new Date(start.getTime() + k * 86400000));
  const t0 = performance.now();
  const g = dailyNight(date);
  const ms = performance.now() - t0;
  const level = parseLevel(g.def);
  const r = simulate(level, g.proof);
  console.log(`${date}  ${g.def.fog.padEnd(7)} ${g.def.lanterns.join(',').padEnd(28)} oil ${g.def.oil}  villagers ${level.villagers.length}  proof ${r.stars}★  attempts ${g.attempts}  ${ms.toFixed(0)}ms`);
  if (process.argv.includes('--map')) console.log(g.def.map.map((r) => '    ' + r).join('\n'));
}
