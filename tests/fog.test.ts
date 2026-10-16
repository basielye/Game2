import { describe, expect, it } from 'vitest';
import { bfs, isSolid, spreadFog, type FogRule } from '../src/sim';
import { makeLevel, maskRows } from './helpers';

function step(map: string[], rule: FogRule, turn = 1, litTiles: number[] = [], lanterns: number[] = []) {
  const level = makeLevel(map, { fog: rule });
  const fog = new Uint8Array(level.w * level.h);
  for (const i of level.initialFog) fog[i] = 1;
  const lit = new Uint8Array(level.w * level.h);
  for (const i of litTiles) lit[i] = 1;
  const hunt = lanterns.length ? bfs(level, lanterns, (i) => !isSolid(level.tiles[i])) : null;
  return maskRows(spreadFog({ level, rule, turn, fog, lit, hunt, lure: null }), level.w);
}

describe('Creeper', () => {
  it('spreads to all four neighbours in the open', () => {
    expect(step(['K....', '.....', '..f..', '.....', '.....'], 'creeper')).toEqual([
      '.....',
      '..#..',
      '.###.',
      '..#..',
      '.....',
    ]);
  });

  it('hugs walls first: only takes neighbours that touch a wall or edge', () => {
    // Fog under a wall row: sideways tiles also touch the wall, the tile below does not.
    expect(step(['K......', '.#####.', '...f...', '.......', '.......'], 'creeper')).toEqual([
      '.......',
      '.......',
      '..###..',
      '.......',
      '.......',
    ]);
  });

  it('cannot enter walls, houses or lit tiles', () => {
    expect(step(['K....', '..#..', '.Hf..', '.....'], 'creeper', 1, [3 * 5 + 2])).toEqual([
      '.....',
      '.....',
      '..##.',
      '.....',
    ]);
  });
});

describe('Leaper', () => {
  it('leaps two tiles straight on odd turns, over walls', () => {
    expect(step(['K......', '.......', '.......', '..#f...', '.......', '.......', '.......'], 'leaper', 1)).toEqual([
      '.......',
      '...#...',
      '...#...',
      '.#.###.',
      '...#...',
      '...#...',
      '.......',
    ]);
  });

  it('leaps over light too', () => {
    const lit = [3 * 7 + 4];
    expect(step(['K......', '.......', '.......', '...f...', '.......', '.......', '.......'], 'leaper', 1, lit)[3]).toBe(
      '.###.#.',
    );
  });

  it('rests on even turns', () => {
    expect(step(['K....', '.....', '..f..', '.....', '.....'], 'leaper', 2)).toEqual([
      '.....',
      '.....',
      '..#..',
      '.....',
      '.....',
    ]);
  });
});

describe('Hunter', () => {
  it('creeps only toward the nearest lantern', () => {
    // Lantern at (4,4); fog at (1,1) moves right and down only.
    expect(step(['K....', '.f...', '.....', '.....', '.....'], 'hunter', 1, [], [4 * 5 + 4])).toEqual([
      '.....',
      '.##..',
      '.#...',
      '.....',
      '.....',
    ]);
  });

  it('spreads everywhere when there is nothing to hunt', () => {
    expect(step(['K....', '.....', '..f..', '.....', '.....'], 'hunter')).toEqual([
      '.....',
      '..#..',
      '.###.',
      '..#..',
      '.....',
    ]);
  });
});
