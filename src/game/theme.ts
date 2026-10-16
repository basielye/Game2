// Colour palette. Pure data so the colourblind check can run in tests.
//
// Readability rests on a luminance ladder, not on hue:
//   unlit ground (dark)  <  fog (mid, cool)  <  lit ground (bright, warm)
// so lit vs. fogged tiles stay distinct under every colour-vision deficiency.
// Fog also carries a drifting swirl texture, so it never relies on colour alone.

export const THEME = {
  bg: '#16182a',
  ground: '#262f24',
  groundAlt: '#232c21',
  stone: '#6a6470',
  stoneDark: '#4b4652',
  treeCanopy: '#2c5a3a',
  treeDark: '#1d3d28',
  trunk: '#5a3d26',
  houseWall: '#d8a36a',
  houseRoof: '#9c4436',
  houseDoor: '#5a3424',
  window: '#ffd98a',
  water: '#1f4459',
  waterHi: '#3e7391',
  bridge: '#9a6c3f',
  bridgeDark: '#6e4a2a',
  marsh: '#2c2440',
  /** Overlay on lit tiles (alpha LIT_ALPHA). */
  lit: '#ffd27a',
  /** Fog blobs (alpha FOG_ALPHA). */
  fog: '#6f6b94',
  fogLine: '#c9c5ec',
  preview: '#b3aee0',
  keeperCloak: '#3f5c9c',
  keeperPath: '#ffe08a',
  skin: '#f1c9a5',
  text: '#fff4dc',
  danger: '#ff7a6b',
  villagers: ['#e8735a', '#5aa9e8', '#f2c94c', '#a57be8', '#5fd38d', '#ef8fc4', '#e8a35a', '#7fd6d6'],
} as const;

export const LIT_ALPHA = 0.8;
export const FOG_ALPHA = 0.9;

type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mix(a: RGB, b: RGB, alpha: number): RGB {
  return [0, 1, 2].map((k) => a[k] * (1 - alpha) + b[k] * alpha) as RGB;
}

/** The flat colours the player actually sees for the three key tile states. */
export function tileStateColors() {
  const ground = hexToRgb(THEME.ground);
  return {
    ground,
    lit: mix(ground, hexToRgb(THEME.lit), LIT_ALPHA),
    fog: mix(ground, hexToRgb(THEME.fog), FOG_ALPHA),
  };
}
