// Shared data types for the pure simulation. No DOM, no canvas.

export type FogRule = 'creeper' | 'leaper' | 'hunter';
export type LanternType = 'basic' | 'beacon' | 'reflector' | 'flare' | 'bait';
/** 0 = north, 1 = east, 2 = south, 3 = west */
export type Dir = 0 | 1 | 2 | 3;

export interface VillagerDef {
  /** Waypoints [x, y]; consecutive points must share a row or column. Last point must be a house. */
  route: [number, number][];
  /** Turns the villager waits at the start before walking. */
  delay?: number;
  name?: string;
}

/**
 * A level, authored as plain data.
 *
 * Map legend:
 *   .  ground          #  wall (stone)      T  wall (tree)
 *   H  house (safe)    =  bridge            ~  water
 *   M  marsh (fog source, always foggy)
 *   f  ground that starts foggy
 *   K  ground where the Keeper starts
 */
export interface LevelDef {
  id: string;
  name: string;
  /** One short line shown when the night starts. Teaches the new idea. */
  hint?: string;
  map: string[];
  fog: FogRule;
  oil: number;
  lanterns: LanternType[];
  villagers: VillagerDef[];
  /** Survivors needed for 1, 2 and 3 stars. */
  stars: [number, number, number];
  /** Safety cap on night length. Defaults to the longest route + 2. */
  maxTurns?: number;
}

export interface Placement {
  x: number;
  y: number;
  type: LanternType;
  /** Reflector beam direction. */
  dir?: Dir;
}

/** Placements in the order the Keeper visits them. */
export interface Plan {
  placements: Placement[];
}
