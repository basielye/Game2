// The Keeper's walk and the oil cost of a plan.

import { bfs, isKeeperWalkable, isPlaceable, neighbors4, type Level } from './grid';
import { LANTERNS } from './lanterns';
import type { Plan } from './types';

export interface PlanCost {
  valid: boolean;
  error?: string;
  oil: number;
  walkOil: number;
  lanternOil: number;
  /** Tile indices of the Keeper's full walk, starting at the Keeper's start tile. */
  path: number[];
  /** Steps walked to reach each placement. */
  legSteps: number[];
}

/** Shortest Keeper walk between two tiles (inclusive), or null if unreachable. */
export function keeperLeg(level: Level, from: number, to: number): number[] | null {
  if (from === to) return [from];
  const dist = bfs(level, [to], (i) => isKeeperWalkable(level.tiles[i]));
  if (dist[from] < 0) return null;
  // Walk downhill from `from` to `to`, preferring neighbours in N/E/S/W order for stability.
  const path = [from];
  let cur = from;
  while (cur !== to) {
    const next = neighbors4(level, cur).find((n) => dist[n] === dist[cur] - 1);
    if (next === undefined) return null;
    path.push(next);
    cur = next;
  }
  return path;
}

export function planCost(level: Level, plan: Plan): PlanCost {
  const path = [level.keeper];
  const legSteps: number[] = [];
  let walkOil = 0;
  let lanternOil = 0;
  const seen = new Set<number>();
  let error: string | undefined;
  let cur = level.keeper;

  for (const p of plan.placements) {
    const i = p.y * level.w + p.x;
    if (p.x < 0 || p.y < 0 || p.x >= level.w || p.y >= level.h || !isPlaceable(level.tiles[i])) {
      error ??= `Can't place a lantern at ${p.x},${p.y}`;
      legSteps.push(0);
      continue;
    }
    if (seen.has(i)) error ??= `Two lanterns on ${p.x},${p.y}`;
    seen.add(i);
    if (!level.def.lanterns.includes(p.type)) error ??= `${LANTERNS[p.type].name} isn't available tonight`;
    const leg = keeperLeg(level, cur, i);
    if (!leg) {
      error ??= `The Keeper can't reach ${p.x},${p.y}`;
      legSteps.push(0);
      continue;
    }
    legSteps.push(leg.length - 1);
    walkOil += leg.length - 1;
    path.push(...leg.slice(1));
    lanternOil += LANTERNS[p.type].cost;
    cur = i;
  }
  const oil = walkOil + lanternOil;
  if (oil > level.def.oil) error ??= 'Not enough oil';
  return { valid: !error, error, oil, walkOil, lanternOil, path, legSteps };
}
