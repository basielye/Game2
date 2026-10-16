// Level parsing and grid helpers.

import type { LevelDef } from './types';

export const Tile = {
  ground: 0,
  wall: 1,
  house: 2,
  bridge: 3,
  water: 4,
  marsh: 5,
} as const;
export type TileId = (typeof Tile)[keyof typeof Tile];

/** Cosmetic variants, ignored by the rules. */
export const Deco = { none: 0, tree: 1 } as const;

export interface CompiledVillager {
  /** Tile indices, one per step. */
  route: number[];
  delay: number;
  name: string;
}

export interface Level {
  def: LevelDef;
  w: number;
  h: number;
  tiles: Uint8Array;
  deco: Uint8Array;
  keeper: number;
  initialFog: number[];
  villagers: CompiledVillager[];
  maxTurns: number;
}

/** N, E, S, W */
export const DX = [0, 1, 0, -1] as const;
export const DY = [-1, 0, 1, 0] as const;

const NAMES = ['Pip', 'Bram', 'Odile', 'Fen', 'Moss', 'Tilly', 'Hob', 'Wren', 'Juniper', 'Cob'];

export class LevelError extends Error {}

export function parseLevel(def: LevelDef): Level {
  const h = def.map.length;
  const w = def.map[0]?.length ?? 0;
  if (!w || !h) throw new LevelError(`${def.id}: empty map`);
  const tiles = new Uint8Array(w * h);
  const deco = new Uint8Array(w * h);
  const initialFog: number[] = [];
  let keeper = -1;

  def.map.forEach((row, y) => {
    if (row.length !== w) throw new LevelError(`${def.id}: row ${y} has length ${row.length}, expected ${w}`);
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const c = row[x];
      switch (c) {
        case '.': tiles[i] = Tile.ground; break;
        case '#': tiles[i] = Tile.wall; break;
        case 'T': tiles[i] = Tile.wall; deco[i] = Deco.tree; break;
        case 'H': tiles[i] = Tile.house; break;
        case '=': tiles[i] = Tile.bridge; break;
        case '~': tiles[i] = Tile.water; break;
        case 'M': tiles[i] = Tile.marsh; initialFog.push(i); break;
        case 'f': tiles[i] = Tile.ground; initialFog.push(i); break;
        case 'K': tiles[i] = Tile.ground; keeper = i; break;
        default: throw new LevelError(`${def.id}: unknown map char '${c}' at ${x},${y}`);
      }
    }
  });
  if (keeper < 0) throw new LevelError(`${def.id}: map has no Keeper start 'K'`);

  const villagers = def.villagers.map((v, n) => {
    const route = expandRoute(def.id, v.route, w, h);
    route.forEach((i, k) => {
      const t = tiles[i];
      const last = k === route.length - 1;
      if (last && t !== Tile.house) throw new LevelError(`${def.id}: villager ${n} route must end in a house`);
      if (!last && t !== Tile.ground && t !== Tile.bridge)
        throw new LevelError(`${def.id}: villager ${n} route crosses a non-walkable tile at step ${k}`);
    });
    return { route, delay: v.delay ?? 0, name: v.name ?? NAMES[n % NAMES.length] };
  });

  const longest = Math.max(0, ...villagers.map((v) => v.route.length - 1 + v.delay));
  return {
    def, w, h, tiles, deco, keeper, initialFog, villagers,
    maxTurns: def.maxTurns ?? longest + 2,
  };
}

function expandRoute(id: string, pts: [number, number][], w: number, h: number): number[] {
  if (pts.length < 2) throw new LevelError(`${id}: route needs at least 2 waypoints`);
  const out: number[] = [];
  for (const [x, y] of pts) {
    if (x < 0 || y < 0 || x >= w || y >= h) throw new LevelError(`${id}: waypoint ${x},${y} out of bounds`);
  }
  out.push(pts[0][1] * w + pts[0][0]);
  for (let k = 1; k < pts.length; k++) {
    const [ax, ay] = pts[k - 1];
    const [bx, by] = pts[k];
    if (ax !== bx && ay !== by) throw new LevelError(`${id}: waypoints ${ax},${ay} -> ${bx},${by} not in a straight line`);
    const sx = Math.sign(bx - ax);
    const sy = Math.sign(by - ay);
    let x = ax;
    let y = ay;
    while (x !== bx || y !== by) {
      x += sx;
      y += sy;
      out.push(y * w + x);
    }
  }
  return out;
}

export function inBounds(level: Level, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < level.w && y < level.h;
}

/** Orthogonal neighbour indices of tile i. */
export function neighbors4(level: Level, i: number): number[] {
  const x = i % level.w;
  const y = (i / level.w) | 0;
  const out: number[] = [];
  for (let d = 0; d < 4; d++) {
    const nx = x + DX[d];
    const ny = y + DY[d];
    if (inBounds(level, nx, ny)) out.push(ny * level.w + nx);
  }
  return out;
}

export const isKeeperWalkable = (t: number) => t === Tile.ground || t === Tile.bridge;
export const isPlaceable = isKeeperWalkable;
export const isFogEnterable = (t: number) => t === Tile.ground || t === Tile.bridge || t === Tile.water;
export const isLightable = isFogEnterable;
/** Fog cannot pass through these (used for Hunter / Bait distance fields). */
export const isSolid = (t: number) => t === Tile.wall || t === Tile.house;

/**
 * Breadth-first distance from a set of sources across tiles accepted by `pass`.
 * Unreached tiles are -1. Sources are always distance 0.
 */
export function bfs(level: Level, sources: number[], pass: (i: number) => boolean, limit = Infinity): Int16Array {
  const dist = new Int16Array(level.w * level.h).fill(-1);
  const queue: number[] = [];
  for (const s of sources) {
    if (dist[s] === -1) {
      dist[s] = 0;
      queue.push(s);
    }
  }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    if (dist[i] >= limit) continue;
    for (const n of neighbors4(level, i)) {
      if (dist[n] === -1 && pass(n)) {
        dist[n] = dist[i] + 1;
        queue.push(n);
      }
    }
  }
  return dist;
}
