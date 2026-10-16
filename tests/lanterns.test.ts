import { describe, expect, it } from 'vitest';
import { computeLit, lightOf, planCost, simulate, type Placement } from '../src/sim';
import { makeLevel, maskRows } from './helpers';

/** Keeps the night going without being in the way. */
const idler = [{ route: [[3, 0], [4, 0]] as [number, number][], delay: 30 }];

const open7 = ['K......', '.......', '.......', '.......', '.......', '.......', '.......'];

function litRows(map: string[], p: Placement) {
  const level = makeLevel(map);
  return maskRows(computeLit(level, [p], [true]), level.w);
}

describe('lantern lighting', () => {
  it('basic lights a 3x3 square', () => {
    expect(litRows(open7, { x: 3, y: 3, type: 'basic' })).toEqual([
      '.......',
      '.......',
      '..###..',
      '..###..',
      '..###..',
      '.......',
      '.......',
    ]);
  });

  it('beacon lights a rounded 5x5', () => {
    expect(litRows(open7, { x: 3, y: 3, type: 'beacon' })).toEqual([
      '.......',
      '..###..',
      '.#####.',
      '.#####.',
      '.#####.',
      '..###..',
      '.......',
    ]);
  });

  it('reflector shines a beam that stops at walls', () => {
    expect(litRows(['K......', '.......', '.......', '.....#.', '.......'], { x: 1, y: 3, type: 'reflector', dir: 1 })).toEqual([
      '.......',
      '.......',
      '.......',
      '.####..',
      '.......',
    ]);
  });

  it('does not light walls or houses', () => {
    expect(litRows(['K..', '.#H', '...'], { x: 1, y: 2, type: 'basic' })).toEqual(['...', '#..', '###']);
  });

  it('lit tiles block fog and push existing fog back', () => {
    const level = makeLevel(['K....', '.....', 'fffff', '.....', '.....'], { fog: 'creeper' });
    const r = simulate(level, { placements: [{ x: 2, y: 1, type: 'basic' }] }, { turns: 1 });
    // Turn 0: the three lit fog tiles are cleared.
    expect(maskRows(r.frames[0].fog, 5)[2]).toBe('#...#');
    // Turn 1: fog cannot enter the lit 3x3 around (2,1).
    expect(maskRows(r.frames[1].fog, 5).slice(0, 3)).toEqual(['.....', '#...#', '#...#']);
  });

  it('flare burns out after 2 turns', () => {
    const level = makeLevel(['K...H', '.....', '.....', '.....', 'fffff'], { fog: 'creeper', maxTurns: 5, villagers: idler });
    const r = simulate(level, { placements: [{ x: 2, y: 2, type: 'flare' }] });
    expect(r.frames[2].active[0]).toBe(true);
    expect(r.frames[3].active[0]).toBe(false);
    expect(r.frames[3].events).toContainEqual({ type: 'burnout', lantern: 0, at: 12 });
    expect(lightOf(level, { x: 2, y: 2, type: 'flare' }).length).toBe(21);
  });

  it('bait lures nearby fog and gobbles it on contact', () => {
    // Bait at (2,3); fog starts at (0,0), outside the lure range of 3.
    const level = makeLevel(['f.K.H', '.....', '.....', '.....', '.....'], { fog: 'creeper', maxTurns: 8, villagers: idler });
    const r = simulate(level, { placements: [{ x: 2, y: 3, type: 'bait' }] });
    // Turn 1: fog at (0,0) is 4 away from the bait (out of range) so it creeps normally.
    expect(maskRows(r.frames[1].fog, 5)[0]).toBe('##...');
    // Turn 3: fog at (2,0) and (0,2) is in range and rushes toward the pie instead of hugging edges.
    // (2,0) would normally hug the top edge to (3,0); lured, it only moves down.
    expect(maskRows(r.frames[3].fog, 5).slice(0, 2)).toEqual(['###..', '###..']);
    const gulp = r.frames.flatMap((f) => f.events).find((e) => e.type === 'gulp');
    expect(gulp).toBeDefined();
    const after = r.frames.find((f) => f.events.some((e) => e.type === 'gulp'))!;
    expect(after.active[0]).toBe(false);
    expect(after.fog[3 * 5 + 2]).toBe(0);
  });
});

describe('keeper and oil', () => {
  it('charges 1 oil per step plus the lantern cost', () => {
    const level = makeLevel(['K....', '.###.', '.....'], { oil: 12 });
    const c = planCost(level, { placements: [{ x: 4, y: 2, type: 'basic' }, { x: 4, y: 0, type: 'beacon' }] });
    expect(c.legSteps).toEqual([6, 2]);
    expect(c.oil).toBe(6 + 1 + 2 + 3);
    expect(c.valid).toBe(true);
    expect(c.path[0]).toBe(0);
    expect(c.path[c.path.length - 1]).toBe(4);
  });

  it('rejects plans over budget, on bad tiles, or with locked lanterns', () => {
    const level = makeLevel(['K.#~', '....'], { oil: 3, lanterns: ['basic'] });
    expect(planCost(level, { placements: [{ x: 3, y: 1, type: 'basic' }] }).error).toBe('Not enough oil');
    expect(planCost(level, { placements: [{ x: 2, y: 0, type: 'basic' }] }).valid).toBe(false);
    expect(planCost(level, { placements: [{ x: 1, y: 0, type: 'beacon' }] }).valid).toBe(false);
  });

  it('invalid plans run with no lanterns and never win', () => {
    const level = makeLevel(['K..H'], { oil: 0, villagers: [{ route: [[1, 0], [3, 0]] }] });
    const r = simulate(level, { placements: [{ x: 1, y: 0, type: 'basic' }] });
    expect(r.cost.valid).toBe(false);
    expect(r.won).toBe(false);
  });
});

describe('keeper route order', () => {
  it('walks the shortest order regardless of tap order', async () => {
    const { bestOrder } = await import('../src/sim');
    const level = makeLevel(['K......'], { oil: 99 });
    const tapped = { placements: [{ x: 6, y: 0, type: 'basic' as const }, { x: 2, y: 0, type: 'basic' as const }] };
    expect(planCost(level, tapped).walkOil).toBe(10);
    const ordered = bestOrder(level, tapped);
    expect(ordered.placements.map((p) => p.x)).toEqual([2, 6]);
    expect(planCost(level, ordered).walkOil).toBe(6);
  });
});
