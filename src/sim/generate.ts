// Procedural nights for the daily puzzle and run mode. Pure and seeded: the same seed
// produces the same night on every machine.

import { bfs, isKeeperWalkable, parseLevel, Tile, type Level } from './grid';
import { ALL_LANTERNS } from './lanterns';
import { Rng } from './rng';
import { candidates, randomPlan, search } from './solver';
import { simulate } from './sim';
import type { FogRule, LanternType, LevelDef, Plan, VillagerDef } from './types';

export interface GenOptions {
  /** Lanterns allowed tonight. Defaults to the basic lantern plus two random specials. */
  lanterns?: LanternType[];
  fog?: FogRule;
  /** Extra oil on top of the cheapest full rescue the generator found. */
  slack?: number;
  name?: string;
  id?: string;
}

export interface Generated {
  def: LevelDef;
  /** A plan that brings everyone home (proof the night is winnable). */
  proof: Plan;
  attempts: number;
}

const W = 8;
const H = 8;
const FOGS: FogRule[] = ['creeper', 'leaper', 'hunter'];
const SPECIALS = ALL_LANTERNS.filter((t) => t !== 'basic');

const ADJ = ['Quiet', 'Misty', 'Velvet', 'Hollow', 'Lantern', 'Moonless', 'Drizzly', 'Starlit', 'Mossy', 'Whispering'];
const NOUN = ['Lane', 'Green', 'Crossing', 'Commons', 'Hollow', 'Orchard', 'Market', 'Meadow', 'Bend', 'Square'];

export function generateNight(seed: string, opts: GenOptions = {}): Generated {
  const rng = new Rng(`gen:${seed}`);
  const fog = opts.fog ?? rng.pick(FOGS);
  const lanterns = opts.lanterns ?? ['basic' as LanternType, ...rng.shuffle(SPECIALS.slice()).slice(0, 2)];
  const name = opts.name ?? `${rng.pick(ADJ)} ${rng.pick(NOUN)}`;

  for (let attempt = 1; attempt <= 60; attempt++) {
    const sub = new Rng(`gen:${seed}:${attempt}`);
    const def = tryBuild(sub, { id: opts.id ?? `gen-${seed}`, name, fog, lanterns });
    if (!def) continue;
    const ok = evaluate(def, sub, opts.slack ?? 1);
    if (ok) return { def: ok.def, proof: ok.proof, attempts: attempt };
  }
  throw new Error(`could not generate a night for seed ${seed}`);
}

/** UTC date as YYYY-MM-DD. */
export function utcDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function dailyNight(date: string): Generated {
  return generateNight(`daily:${date}`, { id: `daily-${date}`, name: `Daily · ${date}` });
}

// ------------------------------------------------------------------ building

function tryBuild(rng: Rng, base: { id: string; name: string; fog: FogRule; lanterns: LanternType[] }): LevelDef | null {
  const g: string[][] = Array.from({ length: H }, () => Array(W).fill('.'));
  const set = (x: number, y: number, c: string) => {
    if (x >= 0 && y >= 0 && x < W && y < H) g[y][x] = c;
  };
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < W && y < H ? g[y][x] : '#');

  // Fog source.
  const shape = rng.pick(['top', 'corner', 'side', 'twin'] as const);
  if (shape === 'top') {
    const len = rng.range(5, 8);
    const x0 = rng.range(0, W - len);
    for (let x = x0; x < x0 + len; x++) set(x, 0, 'M');
  } else if (shape === 'corner') {
    const cx = rng.chance(0.5) ? 0 : W - 1;
    const cy = rng.chance(0.5) ? 0 : H - 1;
    const dx = cx ? -1 : 1;
    const dy = cy ? -1 : 1;
    for (const [a, b] of [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [0, 2]]) set(cx + a * dx, cy + b * dy, 'M');
  } else if (shape === 'side') {
    const x = rng.chance(0.5) ? 0 : W - 1;
    const y0 = rng.range(0, 3);
    for (let y = y0; y < y0 + rng.range(4, 5); y++) set(x, y, 'M');
  } else {
    set(0, 0, 'M');
    set(1, 0, 'M');
    set(0, 1, 'M');
    set(W - 1, H - 1, 'M');
    set(W - 2, H - 1, 'M');
    set(W - 1, H - 2, 'M');
  }
  const nearMarsh = (x: number, y: number) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (at(x + dx, y + dy) === 'M') return true;
    return false;
  };

  // A river with a bridge, sometimes.
  if (rng.chance(0.3)) {
    const y = rng.range(3, 5);
    if (g[y].every((c) => c === '.')) {
      for (let x = 0; x < W; x++) set(x, y, '~');
      set(rng.range(1, W - 2), y, '=');
      if (rng.chance(0.5)) set(rng.range(1, W - 2), y, '=');
    }
  }

  // Hedges and stone walls.
  const segs = rng.range(2, 4);
  for (let k = 0; k < segs; k++) {
    const horiz = rng.chance(0.5);
    const len = rng.range(2, 4);
    const x0 = rng.range(0, W - 1);
    const y0 = rng.range(1, H - 2);
    const c = rng.chance(0.5) ? 'T' : '#';
    for (let s = 0; s < len; s++) {
      const x = x0 + (horiz ? s : 0);
      const y = y0 + (horiz ? 0 : s);
      if (at(x, y) === '.') set(x, y, c);
    }
  }

  // Houses.
  const free = () => {
    const cells: [number, number][] = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] === '.' && !nearMarsh(x, y)) cells.push([x, y]);
    return cells;
  };
  const houses: [number, number][] = [];
  const nh = rng.range(2, 3);
  for (let k = 0; k < nh; k++) {
    const cells = free().filter(([x, y]) => houses.every(([hx, hy]) => Math.abs(hx - x) + Math.abs(hy - y) >= 3));
    if (!cells.length) return null;
    const [x, y] = rng.pick(cells);
    set(x, y, 'H');
    houses.push([x, y]);
  }

  // Keeper.
  const kc = free();
  if (!kc.length) return null;
  const [kx, ky] = rng.pick(kc);
  set(kx, ky, 'K');

  // Villagers walk the shortest path to a house.
  const map = g.map((r) => r.join(''));
  let probe: Level;
  try {
    probe = parseLevel({ ...base, map, oil: 0, villagers: [], stars: [1, 1, 1] });
  } catch {
    return null;
  }
  const walk = (i: number) => {
    const t = probe.tiles[i];
    return t === Tile.ground || t === Tile.bridge;
  };
  const villagers: VillagerDef[] = [];
  const used = new Set<number>();
  const nv = rng.range(3, 4);
  for (let k = 0; k < nv; k++) {
    const [hx, hy] = rng.pick(houses);
    const hi = hy * W + hx;
    const dist = bfs(probe, [hi], (i) => walk(i));
    const starts: number[] = [];
    for (let i = 0; i < dist.length; i++) {
      if (dist[i] >= 3 && dist[i] <= 7 && walk(i) && !used.has(i) && i !== probe.keeper && !probe.initialFog.includes(i)) starts.push(i);
    }
    if (!starts.length) return null;
    const s = rng.pick(starts);
    used.add(s);
    villagers.push({ route: toWaypoints(pathDown(dist, s)), delay: rng.range(0, 3) });
  }

  // The Keeper must be able to reach a decent area.
  const reach = bfs(probe, [probe.keeper], (i) => isKeeperWalkable(probe.tiles[i]));
  if (reach.filter((d) => d >= 0).length < 20) return null;

  return { ...base, map, oil: 12, villagers, stars: [1, 1, 1] };
}

/** Follow the distance field downhill, preferring to keep going straight. */
function pathDown(dist: Int16Array, from: number): number[] {
  const path = [from];
  let cur = from;
  let lastDir = -1;
  while (dist[cur] > 0) {
    const x = cur % W;
    const y = (cur / W) | 0;
    const opts: [number, number][] = [];
    const D = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    for (let d = 0; d < 4; d++) {
      const nx = x + D[d][0];
      const ny = y + D[d][1];
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const n = ny * W + nx;
      if (dist[n] === dist[cur] - 1) opts.push([d, n]);
    }
    const pick = opts.find(([d]) => d === lastDir) ?? opts[0];
    lastDir = pick[0];
    cur = pick[1];
    path.push(cur);
  }
  return path;
}

function toWaypoints(path: number[]): [number, number][] {
  const pts: [number, number][] = [[path[0] % W, (path[0] / W) | 0]];
  for (let k = 1; k < path.length; k++) {
    const [px, py] = [path[k - 1] % W, (path[k - 1] / W) | 0];
    const [cx, cy] = [path[k] % W, (path[k] / W) | 0];
    const next = path[k + 1];
    if (next === undefined) {
      pts.push([cx, cy]);
      break;
    }
    const [nx, ny] = [next % W, (next / W) | 0];
    if (nx - cx !== cx - px || ny - cy !== cy - py) pts.push([cx, cy]);
  }
  return pts;
}

// ------------------------------------------------------------------ evaluating

function evaluate(def: LevelDef, rng: Rng, slack: number): { def: LevelDef; proof: Plan } | null {
  let level: Level;
  try {
    level = parseLevel(def);
  } catch {
    return null;
  }
  const n = level.villagers.length;
  // The fog has to be a real threat.
  const none = simulate(level, { placements: [] });
  if (none.survivors > n - 2) return null;

  // Cheapest full rescue we can find with a generous budget.
  const best = search(level, new Rng(rng.int(1e9)), 2000);
  if (best.survivors < n || best.oil > 11 || best.oil < 3) return null;

  const oil = best.oil + slack;
  const stars: [number, number, number] = [Math.max(1, n - 2), n - 1, n];
  const final: LevelDef = { ...def, oil, stars };
  const fl = parseLevel(final);

  // Not a walkover for random play.
  const cands = candidates(fl);
  let wins = 0;
  let threes = 0;
  const N = 200;
  for (let k = 0; k < N; k++) {
    const r = simulate(fl, randomPlan(fl, rng, cands));
    if (r.won) wins++;
    if (r.stars === 3) threes++;
  }
  if (wins / N > 0.6 || threes / N > 0.2) return null;
  return { def: final, proof: best.plan };
}
