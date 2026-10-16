import { describe, expect, it } from 'vitest';
import { LEVELS } from '../src/levels/levels';
import { parseLevel, simulate, type Placement } from '../src/sim';

// A known 3-star plan for every night. If a rule change breaks one of these, the level needs a look.
const SOLUTIONS: Record<string, Placement[]> = {
  'first-light': [{ x: 4, y: 4, type: 'basic' }],
  'two-gaps': [{ x: 2, y: 4, type: 'basic' }, { x: 5, y: 4, type: 'basic' }],
  'the-beacon': [{ x: 3, y: 4, type: 'beacon' }],
  'hedge-hopper': [{ x: 2, y: 5, type: 'basic' }, { x: 5, y: 5, type: 'basic' }],
  'across-the-water': [{ x: 2, y: 5, type: 'reflector', dir: 0 }, { x: 5, y: 5, type: 'reflector', dir: 0 }],
  sparks: [{ x: 3, y: 2, type: 'flare' }],
  'the-hunter': [{ x: 2, y: 7, type: 'basic' }],
  'fog-pie': [{ x: 3, y: 5, type: 'bait' }],
  'morning-mist': [{ x: 3, y: 5, type: 'flare' }, { x: 5, y: 3, type: 'flare' }],
  'the-long-night': [{ x: 2, y: 5, type: 'flare' }, { x: 5, y: 4, type: 'basic' }],
};

describe('handcrafted levels', () => {
  it('there are 10 nights with unique ids', () => {
    expect(LEVELS).toHaveLength(10);
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(10);
  });

  for (const def of LEVELS) {
    describe(def.name, () => {
      const level = parseLevel(def);

      it('is lost with no lanterns', () => {
        expect(simulate(level, { placements: [] }).won).toBe(false);
      });

      it('has a 3-star solution within budget', () => {
        const r = simulate(level, { placements: SOLUTIONS[def.id] });
        expect(r.cost.valid, r.cost.error).toBe(true);
        expect(r.stars).toBe(3);
      });

      it('fits the 20 second playback cap', () => {
        // Playback uses at least 0.3 s per turn; 20 s allows ~60 turns.
        expect(level.maxTurns).toBeLessThanOrEqual(40);
      });
    });
  }
});
