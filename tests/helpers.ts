import { parseLevel, type FogRule, type LanternType, type LevelDef, type VillagerDef } from '../src/sim';

export function makeLevel(
  map: string[],
  opts: { fog?: FogRule; oil?: number; lanterns?: LanternType[]; villagers?: VillagerDef[]; maxTurns?: number } = {},
) {
  const def: LevelDef = {
    id: 'test',
    name: 'Test',
    map,
    fog: opts.fog ?? 'creeper',
    oil: opts.oil ?? 99,
    lanterns: opts.lanterns ?? ['basic', 'beacon', 'reflector', 'flare', 'bait'],
    villagers: opts.villagers ?? [],
    stars: [1, 1, 1],
    maxTurns: opts.maxTurns,
  };
  return parseLevel(def);
}

/** Render a mask as rows of '#' (set) and '.' for readable assertions. */
export function maskRows(mask: Uint8Array, w: number): string[] {
  const rows: string[] = [];
  for (let y = 0; y < mask.length / w; y++) {
    let r = '';
    for (let x = 0; x < w; x++) r += mask[y * w + x] ? '#' : '.';
    rows.push(r);
  }
  return rows;
}
