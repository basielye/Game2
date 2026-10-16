import { describe, expect, it } from 'vitest';
import { shareText } from '../src/game/share';
import { dailyNight, generateNight, parseLevel, simulate, utcDate } from '../src/sim';

describe('daily puzzle', () => {
  it('uses the UTC date', () => {
    expect(utcDate(new Date('2026-10-16T23:30:00-05:00'))).toBe('2026-10-17');
  });

  it('is identical for everyone on the same date', () => {
    const a = dailyNight('2026-10-16');
    const b = dailyNight('2026-10-16');
    expect(JSON.stringify(a.def)).toBe(JSON.stringify(b.def));
    expect(JSON.stringify(dailyNight('2026-10-17').def)).not.toBe(JSON.stringify(a.def));
  });

  it('every generated night is winnable with 3 stars, and lost without lanterns', () => {
    for (let d = 1; d <= 20; d++) {
      const date = `2026-11-${String(d).padStart(2, '0')}`;
      const g = dailyNight(date);
      const level = parseLevel(g.def);
      expect(simulate(level, g.proof).stars, date).toBe(3);
      expect(simulate(level, { placements: [] }).stars, date).toBeLessThan(3);
    }
  });

  it('respects a run-mode lantern kit', () => {
    const g = generateNight('run:test:1', { lanterns: ['basic', 'flare'] });
    expect(g.def.lanterns).toEqual(['basic', 'flare']);
    expect(g.proof.placements.every((p) => p.type === 'basic' || p.type === 'flare')).toBe(true);
  });

  it('share text shows villagers, stars and oil without spoiling the solution', () => {
    const g = dailyNight('2026-10-16');
    const level = parseLevel(g.def);
    const r = simulate(level, g.proof);
    const text = shareText('2026-10-16', g.def, r, 2);
    expect(text).toContain('Lanternfall Daily 2026-10-16');
    expect(text).toContain('⭐⭐⭐');
    expect(text).toContain('🏡'.repeat(r.total));
    expect(text).toContain(`${r.cost.oil}/${g.def.oil} oil`);
    expect(text).toContain('2 tries');
    expect(text).not.toMatch(/\d+,\d+/); // no coordinates
  });
});
