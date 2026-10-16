import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseLevel, simulate, LevelError } from '../src/sim';
import { makeLevel } from './helpers';

describe('villager pathing', () => {
  it('expands waypoints into a step-by-step route', () => {
    const level = makeLevel(['K....', '.....', '....H'], { villagers: [{ route: [[0, 1], [3, 1], [3, 2], [4, 2]] }] });
    expect(level.villagers[0].route).toEqual([5, 6, 7, 8, 13, 14]);
  });

  it('walks one tile per turn and gets home', () => {
    const level = makeLevel(['K...H'], { villagers: [{ route: [[1, 0], [4, 0]] }] });
    const r = simulate(level, { placements: [] });
    expect(r.frames.map((f) => f.villagers[0].at)).toEqual([1, 2, 3, 4]);
    expect(r.frames[3].villagers[0].status).toBe('home');
    expect(r.survivors).toBe(1);
    expect(r.stars).toBe(3);
  });

  it('waits out its delay', () => {
    const level = makeLevel(['K..H'], { villagers: [{ route: [[1, 0], [3, 0]], delay: 2 }] });
    const r = simulate(level, { placements: [] });
    expect(r.frames.map((f) => f.villagers[0].at)).toEqual([1, 1, 1, 2, 3]);
  });

  it('is poofed onto a roof when fog reaches it', () => {
    const level = makeLevel(['K.f..', '....H'], { fog: 'creeper', villagers: [{ route: [[0, 1], [4, 1]] }] });
    const r = simulate(level, { placements: [] });
    const ev = r.frames.flatMap((f) => f.events).find((e) => e.type === 'swallow');
    expect(ev).toMatchObject({ type: 'swallow', villager: 0, roof: 9 });
    expect(r.survivors).toBe(0);
    expect(r.won).toBe(false);
  });

  it('a lantern saves them', () => {
    const level = makeLevel(['K....', 'f...H'], { fog: 'creeper', villagers: [{ route: [[1, 1], [4, 1]] }] });
    const r = simulate(level, { placements: [{ x: 1, y: 0, type: 'basic' }] });
    expect(r.survivors).toBe(1);
    expect(r.won).toBe(true);
  });

  it('rejects broken routes', () => {
    expect(() => makeLevel(['K.#H'], { villagers: [{ route: [[1, 0], [3, 0]] }] })).toThrow(LevelError);
    expect(() => makeLevel(['K...'], { villagers: [{ route: [[1, 0], [3, 0]] }] })).toThrow(/house/);
    expect(() => makeLevel(['K...', '...H'], { villagers: [{ route: [[1, 0], [3, 1]] }] })).toThrow(/straight/);
  });
});

describe('determinism', () => {
  const map = ['K...MMMM', '........', '..#.....', '..#..H..', 'f.......', '........', '...#....', 'H.....~~'];
  const level = makeLevel(map, {
    fog: 'leaper',
    villagers: [
      { route: [[0, 1], [0, 6], [0, 7]] },
      { route: [[7, 2], [5, 2], [5, 3]] },
      { route: [[1, 5], [4, 5], [4, 3], [5, 3]], delay: 1 },
    ],
  });
  const plan = { placements: [{ x: 1, y: 3, type: 'basic' as const }, { x: 4, y: 1, type: 'bait' as const }] };

  it('the same seed gives the same result', () => {
    const a = simulate(level, plan, { seed: 42 });
    const b = simulate(level, plan, { seed: 42 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('the seed only affects cosmetics, never the outcome', () => {
    const a = simulate(level, plan, { seed: 1 });
    const b = simulate(level, plan, { seed: 2 });
    expect(a.survivors).toBe(b.survivors);
    expect(a.frames.map((f) => Array.from(f.fog).join(''))).toEqual(b.frames.map((f) => Array.from(f.fog).join('')));
  });
});

describe('purity', () => {
  it('the sim module never touches the DOM', () => {
    const dir = join(__dirname, '../src/sim');
    for (const f of readdirSync(dir)) {
      // Strip comments so prose like "no canvas" doesn't count.
      const src = readFileSync(join(dir, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
      expect(src, f).not.toMatch(/\b(document|window|canvas|localStorage|performance)\b/);
      expect(src, f).not.toMatch(/Math\.random|Date\.now/);
    }
  });

  it('parseLevel is a plain function of data', () => {
    const def = makeLevel(['K.H']).def;
    expect(parseLevel(def).tiles).toEqual(parseLevel(def).tiles);
  });
});
