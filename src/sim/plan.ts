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

/**
 * Reorder placements so the Keeper's walk is as short as possible.
 * Exact for up to 7 lanterns (the UI never allows more), greedy beyond that.
 */
export function bestOrder(level: Level, plan: Plan): Plan {
  const ps = plan.placements;
  if (ps.length < 2) return plan;
  const nodes = [level.keeper, ...ps.map((p) => p.y * level.w + p.x)];
  const pass = (i: number) => isKeeperWalkable(level.tiles[i]);
  const dist = nodes.map((n) => bfs(level, [n], pass));
  const d = (a: number, b: number) => {
    const v = dist[a][nodes[b]];
    return v < 0 ? 1e6 : v;
  };

  let bestPerm: number[] = [];
  let bestLen = Infinity;
  if (ps.length <= 7) {
    const used = new Array(ps.length).fill(false);
    const perm: number[] = [];
    const rec = (prev: number, len: number) => {
      if (len >= bestLen) return;
      if (perm.length === ps.length) {
        bestLen = len;
        bestPerm = perm.slice();
        return;
      }
      for (let k = 0; k < ps.length; k++) {
        if (used[k]) continue;
        used[k] = true;
        perm.push(k);
        rec(k + 1, len + d(prev, k + 1));
        perm.pop();
        used[k] = false;
      }
    };
    rec(0, 0);
  } else {
    const left = new Set(ps.map((_, k) => k));
    let prev = 0;
    while (left.size) {
      let pick = -1;
      for (const k of left) if (pick < 0 || d(prev, k + 1) < d(prev, pick + 1)) pick = k;
      bestPerm.push(pick);
      left.delete(pick);
      prev = pick + 1;
    }
  }
  return { placements: bestPerm.map((k) => ps[k]) };
}
