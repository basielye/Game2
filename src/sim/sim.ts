// The night: a pure, deterministic turn-by-turn simulation.

import { spreadFog } from './fog';
import { bfs, isSolid, Tile, type Level } from './grid';
import { computeLit, isBurning, LANTERNS } from './lanterns';
import { planCost, type PlanCost } from './plan';
import { Rng, hashString } from './rng';
import type { Plan } from './types';

export type VillagerStatus = 'waiting' | 'walking' | 'home' | 'swallowed';

/** What a villager does when the fog gets them. Purely cosmetic, but seeded so replays match. */
export const REACTIONS = ['groceries', 'roof', 'hat', 'cartwheel', 'teapot'] as const;
export type Reaction = (typeof REACTIONS)[number];

export interface VillagerState {
  /** Tile index. */
  at: number;
  /** Index into the villager's route. */
  step: number;
  status: VillagerStatus;
  reaction?: Reaction;
  /** The house they were poofed onto the roof of. */
  roof?: number;
}

export type SimEvent =
  | { type: 'step'; villager: number; from: number; to: number }
  | { type: 'home'; villager: number; at: number }
  | { type: 'swallow'; villager: number; at: number; reaction: Reaction; roof: number }
  | { type: 'gulp'; lantern: number; at: number; cleared: number[] }
  | { type: 'burnout'; lantern: number; at: number };

export interface Frame {
  turn: number;
  fog: Uint8Array;
  lit: Uint8Array;
  /** Which placements are still active (flares burn out, bait gets eaten). */
  active: boolean[];
  villagers: VillagerState[];
  events: SimEvent[];
}

export interface SimResult {
  cost: PlanCost;
  frames: Frame[];
  survivors: number;
  swallowed: number;
  total: number;
  stars: 0 | 1 | 2 | 3;
  won: boolean;
}

export interface SimOptions {
  /** Cosmetic seed for reactions. Defaults to the level id. */
  seed?: number | string;
  /** Stop after this many turns (used for the next-turn preview). */
  turns?: number;
  /** Run even if the plan is over budget (the UI still wants a preview). */
  ignoreBudget?: boolean;
}

export function starsFor(level: Level, survivors: number): 0 | 1 | 2 | 3 {
  const [a, b, c] = level.def.stars;
  return survivors >= c ? 3 : survivors >= b ? 2 : survivors >= a ? 1 : 0;
}

export function simulate(level: Level, plan: Plan, opts: SimOptions = {}): SimResult {
  const cost = planCost(level, plan);
  const rng = new Rng(opts.seed ?? hashString(level.def.id));
  const placements = cost.valid || opts.ignoreBudget ? plan.placements : [];
  const lanternAt = placements.map((p) => p.y * level.w + p.x);
  const solidFree = (i: number) => !isSolid(level.tiles[i]);

  // Turn 0: dusk. Light pushes back any fog already sitting on lit tiles.
  let active = placements.map(() => true);
  let lit = computeLit(level, placements, active);
  let fog: Uint8Array = new Uint8Array(level.w * level.h);
  for (const i of level.initialFog) if (!lit[i] || level.tiles[i] === Tile.marsh) fog[i] = 1;

  let villagers: VillagerState[] = level.villagers.map((v) => ({
    at: v.route[0],
    step: 0,
    status: v.delay > 0 ? 'waiting' : 'walking',
  }));
  const frames: Frame[] = [{ turn: 0, fog, lit, active, villagers, events: [] }];
  const maxTurns = Math.min(opts.turns ?? Infinity, level.maxTurns);

  for (let turn = 1; turn <= maxTurns; turn++) {
    const events: SimEvent[] = [];

    // 1. Lanterns: flares burn out.
    active = active.map((a, k) => {
      if (a && !isBurning(placements[k], turn)) {
        events.push({ type: 'burnout', lantern: k, at: lanternAt[k] });
        return false;
      }
      return a;
    });
    lit = computeLit(level, placements, active);

    // 2. Fog spreads.
    const liveIdx = lanternAt.filter((_, k) => active[k]);
    const baitIdx = lanternAt.filter((_, k) => active[k] && placements[k].type === 'bait');
    const hunt = level.def.fog === 'hunter' && liveIdx.length ? bfs(level, liveIdx, solidFree) : null;
    const lure = baitIdx.length ? bfs(level, baitIdx, solidFree, LANTERNS.bait.lure) : null;
    fog = spreadFog({ level, rule: level.def.fog, turn, fog, lit, hunt, lure });

    // 3. Bait that fog reached gobbles everything nearby, then it's gone.
    placements.forEach((p, k) => {
      if (!active[k] || p.type !== 'bait' || !fog[lanternAt[k]]) return;
      const r = LANTERNS.bait.gulp!;
      const cleared: number[] = [];
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const x = p.x + dx;
          const y = p.y + dy;
          if (x < 0 || y < 0 || x >= level.w || y >= level.h) continue;
          const i = y * level.w + x;
          if (fog[i] && level.tiles[i] !== Tile.marsh) {
            fog[i] = 0;
            cleared.push(i);
          }
        }
      active = active.slice();
      active[k] = false;
      events.push({ type: 'gulp', lantern: k, at: lanternAt[k], cleared });
    });

    // 4. Villagers take one step along their route.
    villagers = villagers.map((v, n) => {
      if (v.status === 'home' || v.status === 'swallowed') return v;
      const def = level.villagers[n];
      if (turn <= def.delay) return v;
      const step = v.step + 1;
      const at = def.route[step];
      events.push({ type: 'step', villager: n, from: v.at, to: at });
      if (level.tiles[at] === Tile.house) {
        events.push({ type: 'home', villager: n, at });
        return { at, step, status: 'home' };
      }
      return { at, step, status: 'walking' };
    });

    // 5. Anyone standing in fog gets poofed onto a roof.
    villagers = villagers.map((v, n) => {
      if ((v.status !== 'walking' && v.status !== 'waiting') || !fog[v.at]) return v;
      const reaction = rng.pick(REACTIONS);
      const roof = nearestHouse(level, v.at);
      events.push({ type: 'swallow', villager: n, at: v.at, reaction, roof });
      return { ...v, status: 'swallowed', reaction, roof };
    });

    frames.push({ turn, fog, lit, active, villagers, events });
    if (villagers.every((v) => v.status === 'home' || v.status === 'swallowed')) break;
  }

  const last = frames[frames.length - 1].villagers;
  const survivors = last.filter((v) => v.status !== 'swallowed').length;
  const stars = starsFor(level, survivors);
  return {
    cost,
    frames,
    survivors,
    swallowed: last.length - survivors,
    total: last.length,
    stars,
    won: cost.valid && stars > 0,
  };
}

function nearestHouse(level: Level, from: number): number {
  let best = -1;
  let bestD = Infinity;
  const fx = from % level.w;
  const fy = (from / level.w) | 0;
  for (let i = 0; i < level.tiles.length; i++) {
    if (level.tiles[i] !== Tile.house) continue;
    const d = Math.abs((i % level.w) - fx) + Math.abs(((i / level.w) | 0) - fy);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}
