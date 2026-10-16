import { describe, expect, it } from 'vitest';
import { tileStateColors } from '../src/game/theme';

// Colourblind-friendly check: simulate colour-vision deficiencies (Machado et al. 2009,
// severity 1.0) and require WCAG-style luminance contrast between key tile states.

type RGB = [number, number, number];
const toLin = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const toSrgb = (l: number) => {
  const v = Math.min(1, Math.max(0, l));
  return 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);
};

const CVD: Record<string, number[][]> = {
  normal: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};

function simulate(c: RGB, m: number[][]): RGB {
  const l = c.map(toLin);
  return m.map((row) => toSrgb(row[0] * l[0] + row[1] * l[1] + row[2] * l[2])) as RGB;
}
function luminance(c: RGB) {
  const [r, g, b] = c.map(toLin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: RGB, b: RGB) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

describe('colourblind-friendly palette', () => {
  const { ground, lit, fog } = tileStateColors();
  for (const [name, m] of Object.entries(CVD)) {
    it(`${name}: lit, fog and ground are distinguishable by brightness alone`, () => {
      const [g, l, f] = [ground, lit, fog].map((c) => simulate(c, m));
      expect(contrast(l, f)).toBeGreaterThan(1.8);
      expect(contrast(f, g)).toBeGreaterThan(1.8);
      expect(contrast(l, g)).toBeGreaterThan(3.5);
    });
  }
});
