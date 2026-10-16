// Spoiler-free, shareable result text for the daily puzzle. Pure.

import { FOG_RULES } from '../sim/fog';
import type { SimResult } from '../sim/sim';
import type { LevelDef } from '../sim/types';

export function shareText(date: string, def: LevelDef, r: SimResult, tries: number): string {
  const last = r.frames[r.frames.length - 1].villagers;
  const row = last.map((v) => (v.status === 'swallowed' ? '🌫️' : '🏡')).join('');
  const stars = '⭐'.repeat(r.stars) + '☆'.repeat(3 - r.stars);
  const fog = FOG_RULES[def.fog];
  return [
    `Lanternfall Daily ${date}`,
    `${fog.icon} ${fog.name} ${stars}`,
    `${row} ${r.survivors}/${r.total} home`,
    `🏮×${r.cost.valid ? countLanterns(r) : 0} 🛢️ ${r.cost.oil}/${def.oil} oil · ${tries === 1 ? 'first try' : `${tries} tries`}`,
  ].join('\n');
}

function countLanterns(r: SimResult): number {
  return r.frames[0].active.length;
}
