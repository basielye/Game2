// Lantern specs and lighting.

import { DX, DY, inBounds, isLightable, Tile, type Level } from './grid';
import type { LanternType, Placement } from './types';

export interface LanternSpec {
  type: LanternType;
  name: string;
  cost: number;
  /** Plain-language rule shown in the palette. */
  rule: string;
  radius?: number;
  beam?: number;
  /** Last turn the lantern is lit (flare). */
  burnsOutAfter?: number;
  /** Bait: how far its smell reaches, and how far its gulp clears. */
  lure?: number;
  gulp?: number;
}

export const LANTERNS: Record<LanternType, LanternSpec> = {
  basic: { type: 'basic', name: 'Lantern', cost: 1, radius: 1, rule: 'Lights the tiles around it.' },
  beacon: { type: 'beacon', name: 'Beacon', cost: 3, radius: 2, rule: 'A big, bright glow.' },
  reflector: { type: 'reflector', name: 'Reflector', cost: 2, beam: 4, rule: 'Shines a beam one way. Stops at walls.' },
  flare: { type: 'flare', name: 'Flare', cost: 1, radius: 2, burnsOutAfter: 2, rule: 'Big glow, but burns out after 2 turns.' },
  bait: { type: 'bait', name: 'Fog Pie', cost: 2, lure: 3, gulp: 2, rule: 'No light. Fog nearby rushes to it — and gets gobbled.' },
};

export const ALL_LANTERNS: LanternType[] = ['basic', 'beacon', 'reflector', 'flare', 'bait'];

/** Is this placement still burning on `turn`? Bait is handled by the simulation (it gets eaten). */
export function isBurning(p: Placement, turn: number): boolean {
  const spec = LANTERNS[p.type];
  return spec.burnsOutAfter === undefined || turn <= spec.burnsOutAfter;
}

/** Tiles lit by one lantern (ignores whether it is active). */
export function lightOf(level: Level, p: Placement): number[] {
  const spec = LANTERNS[p.type];
  const out: number[] = [];
  const add = (x: number, y: number) => {
    if (!inBounds(level, x, y)) return;
    const i = y * level.w + x;
    if (isLightable(level.tiles[i])) out.push(i);
  };
  if (spec.radius !== undefined) {
    // A rounded square: radius 1 is 3x3, radius 2 is 5x5 without the corners.
    const r = spec.radius;
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + r) add(p.x + dx, p.y + dy);
  } else if (spec.beam !== undefined) {
    add(p.x, p.y);
    const d = p.dir ?? 1;
    for (let k = 1; k <= spec.beam; k++) {
      const x = p.x + DX[d] * k;
      const y = p.y + DY[d] * k;
      if (!inBounds(level, x, y)) break;
      const t = level.tiles[y * level.w + x];
      if (t === Tile.wall || t === Tile.house) break;
      add(x, y);
    }
  }
  return out;
}

/** Combined light mask of the given active placements. */
export function computeLit(level: Level, placements: Placement[], active: boolean[]): Uint8Array {
  const lit = new Uint8Array(level.w * level.h);
  placements.forEach((p, k) => {
    if (!active[k]) return;
    for (const i of lightOf(level, p)) lit[i] = 1;
  });
  return lit;
}
