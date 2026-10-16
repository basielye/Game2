// Short-lived cosmetic particles. Positions are in tile units.

export interface Effect {
  kind: 'puff' | 'item' | 'text' | 'spark' | 'ring';
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Gravity in tiles/s². */
  g: number;
  age: number;
  life: number;
  seed: number;
  size?: number;
  text?: string;
  color?: string;
}

export function makeEffect(kind: Effect['kind'], x: number, y: number, extra: Partial<Effect> = {}): Effect {
  return { kind, x, y, vx: 0, vy: 0, g: 0, age: 0, life: 0.8, seed: Math.random() * 6.28, ...extra };
}

export function stepEffects(effects: Effect[], dt: number): Effect[] {
  for (const e of effects) {
    e.age += dt;
    e.vy += e.g * dt;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
  }
  return effects.filter((e) => e.age < e.life);
}
