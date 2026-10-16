// Fog personalities. Each one is a single readable rule.

import { DX, DY, inBounds, isFogEnterable, isSolid, neighbors4, Tile, type Level } from './grid';
import type { FogRule } from './types';

export interface FogInfo {
  name: string;
  icon: string;
  /** The rule card text. */
  rule: string;
}

export const FOG_RULES: Record<FogRule, FogInfo> = {
  creeper: { name: 'Creeper', icon: '🐌', rule: 'Creeps one tile a turn, hugging walls and edges when it can.' },
  leaper: { name: 'Leaper', icon: '🐸', rule: 'Rests, then leaps two tiles straight — right over walls and light.' },
  hunter: { name: 'Hunter', icon: '🐺', rule: 'Creeps one tile a turn toward the nearest lantern.' },
};

export interface SpreadInput {
  level: Level;
  rule: FogRule;
  /** The turn being computed (1-based). Leaper leaps on odd turns. */
  turn: number;
  fog: Uint8Array;
  lit: Uint8Array;
  /** Distance to the nearest active lantern (any type), -1 if none / unreachable. */
  hunt: Int16Array | null;
  /** Distance to the nearest active bait within lure range, -1 otherwise. */
  lure: Int16Array | null;
}

/** Hugging tiles touch a wall, a house or the map edge. */
export function isHugging(level: Level, i: number): boolean {
  const x = i % level.w;
  const y = (i / level.w) | 0;
  for (let d = 0; d < 4; d++) {
    const nx = x + DX[d];
    const ny = y + DY[d];
    if (!inBounds(level, nx, ny)) return true;
    if (isSolid(level.tiles[ny * level.w + nx])) return true;
  }
  return false;
}

/** Returns the new fog mask after one step of spreading (does not mutate the input). */
export function spreadFog(s: SpreadInput): Uint8Array {
  const { level, fog, lit, hunt, lure } = s;
  const next = fog.slice();
  const canEnter = (i: number) => !fog[i] && !lit[i] && isFogEnterable(level.tiles[i]);
  const leapTurn = s.turn % 2 === 1;

  for (let i = 0; i < fog.length; i++) {
    if (!fog[i]) continue;

    // Bait overrides every personality: nearby fog rushes one step toward the pie.
    if (lure && lure[i] > 0) {
      for (const n of neighbors4(level, i)) if (lure[n] >= 0 && lure[n] < lure[i] && canEnter(n)) next[n] = 1;
      continue;
    }

    switch (s.rule) {
      case 'creeper': {
        const cand = neighbors4(level, i).filter(canEnter);
        const hug = cand.filter((n) => isHugging(level, n));
        for (const n of hug.length ? hug : cand) next[n] = 1;
        break;
      }
      case 'leaper': {
        if (!leapTurn) break;
        const x = i % level.w;
        const y = (i / level.w) | 0;
        for (let d = 0; d < 4; d++) {
          for (let k = 1; k <= 2; k++) {
            const nx = x + DX[d] * k;
            const ny = y + DY[d] * k;
            if (!inBounds(level, nx, ny)) break;
            const n = ny * level.w + nx;
            if (canEnter(n)) next[n] = 1;
          }
        }
        break;
      }
      case 'hunter': {
        const cand = neighbors4(level, i).filter(canEnter);
        if (!hunt || hunt[i] < 0) {
          // Nothing to hunt: it simply spreads everywhere.
          for (const n of cand) next[n] = 1;
        } else {
          for (const n of cand) if (hunt[n] >= 0 && hunt[n] < hunt[i]) next[n] = 1;
        }
        break;
      }
    }
  }

  // Light holds fog back; marsh is always foggy.
  for (let i = 0; i < next.length; i++) {
    if (lit[i] && level.tiles[i] !== Tile.marsh) next[i] = 0;
  }
  return next;
}
