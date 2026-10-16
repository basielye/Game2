// Plan generation and search, shared by the balance script, tests and the daily puzzle generator.

import { isPlaceable, type Level } from './grid';
import { LANTERNS } from './lanterns';
import { bestOrder, keeperLeg, planCost } from './plan';
import type { Rng } from './rng';
import { simulate } from './sim';
import type { Dir, Placement, Plan } from './types';

/** Every distinct placement the player could make tonight. */
export function candidates(level: Level): Placement[] {
  const out: Placement[] = [];
  for (let y = 0; y < level.h; y++)
    for (let x = 0; x < level.w; x++) {
      if (!isPlaceable(level.tiles[y * level.w + x])) continue;
      if (keeperLeg(level, level.keeper, y * level.w + x) === null) continue;
      for (const type of level.def.lanterns) {
        if (type === 'reflector') for (let d = 0; d < 4; d++) out.push({ x, y, type, dir: d as Dir });
        else out.push({ x, y, type });
      }
    }
  return out;
}

/** Add a placement; the Keeper always walks the shortest order (same as in the game). */
export function insertCheapest(level: Level, plan: Plan, p: Placement): Plan {
  return bestOrder(level, { placements: [...plan.placements, p] });
}

/**
 * A random plan that fits the budget: keep adding random lanterns (in a sensible walking
 * order) until the next one would not fit or we decide to stop.
 */
export function randomPlan(level: Level, rng: Rng, cands = candidates(level)): Plan {
  let plan: Plan = { placements: [] };
  if (!cands.length) return plan;
  const target = rng.range(1, 6);
  let tries = 0;
  while (plan.placements.length < target && tries < 20) {
    tries++;
    const p = cands[rng.int(cands.length)];
    if (plan.placements.some((q) => q.x === p.x && q.y === p.y)) continue;
    if (LANTERNS[p.type].cost > level.def.oil) continue;
    const next = insertCheapest(level, plan, p);
    if (planCost(level, next).valid) plan = next;
  }
  return plan;
}

export interface SearchResult {
  plan: Plan;
  survivors: number;
  oil: number;
  evaluations: number;
}

function score(level: Level, plan: Plan): { s: number; survivors: number; oil: number } {
  const r = simulate(level, plan);
  if (!r.cost.valid) return { s: -Infinity, survivors: 0, oil: r.cost.oil };
  // Survivors first, then thriftiness.
  return { s: r.survivors * 1000 - r.cost.oil, survivors: r.survivors, oil: r.cost.oil };
}

function mutate(level: Level, plan: Plan, rng: Rng, cands: Placement[]): Plan {
  if (!cands.length) return plan;
  const ps = plan.placements.slice();
  const roll = rng.int(4);
  if (roll === 0 && ps.length) {
    ps.splice(rng.int(ps.length), 1);
    return { placements: ps };
  }
  if (roll === 1 && ps.length) {
    const k = rng.int(ps.length);
    const p = ps[k];
    const near = cands.filter((c) => Math.abs(c.x - p.x) + Math.abs(c.y - p.y) <= 2);
    ps.splice(k, 1);
    return insertCheapest(level, { placements: ps }, rng.pick(near.length ? near : cands));
  }
  if (roll === 2 && ps.length) {
    ps.splice(rng.int(ps.length), 1);
  }
  const p = rng.pick(cands);
  if (ps.some((q) => q.x === p.x && q.y === p.y)) return { placements: ps };
  return insertCheapest(level, { placements: ps }, p);
}

/** Random-restart hill climbing. Good enough to prove a level winnable and find its best score. */
export function search(level: Level, rng: Rng, budget = 4000): SearchResult {
  const cands = candidates(level);
  let best: Plan = { placements: [] };
  let bestS = score(level, best);
  let evaluations = 1;
  const goal = level.villagers.length * 1000;
  while (evaluations < budget) {
    let cur = randomPlan(level, rng, cands);
    let curS = score(level, cur);
    evaluations++;
    for (let i = 0; i < 150 && evaluations < budget; i++) {
      const next = mutate(level, cur, rng, cands);
      const s = score(level, next);
      evaluations++;
      if (s.s >= curS.s) {
        cur = next;
        curS = s;
      }
    }
    if (curS.s > bestS.s) {
      best = cur;
      bestS = curS;
    }
    if (bestS.survivors * 1000 === goal && evaluations > budget / 2) break;
  }
  return { plan: best, survivors: bestS.survivors, oil: bestS.oil, evaluations };
}
