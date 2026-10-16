// Renders a parchment-style relief map of the island from the heightfield (used by the minimap and world map).
import { LOCATIONS, ROADS, WORLD_SIZE } from '../data/world.js';

export function renderMap(terrain, size = 1024) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const c = cv.getContext('2d');
  const img = c.createImageData(size, size);
  const half = WORLD_SIZE / 2;
  const step = WORLD_SIZE / size;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const wx = -half + x * step, wz = -half + y * step;
    const h = terrain.getHeight(wx, wz);
    const hl = terrain.getHeight(wx - step, wz - step);
    const shade = Math.max(-1, Math.min(1, (h - hl) * 0.5));
    let r, g, b;
    if (h < 0) {
      const d = Math.min(1, -h / 25);
      r = 120 - d * 60; g = 150 - d * 50; b = 150 - d * 30;
      if (h > -1.5) { r += 30; g += 25; b += 15; }
    } else if (h < 3) { r = 214; g = 196; b = 150; }
    else {
      const t = Math.min(1, h / 190);
      r = 170 - t * 30 + (t > 0.6 ? (t - 0.6) * 120 : 0); g = 170 - t * 50; b = 120 - t * 30;
      const road = terrain.getRoad(wx, wz);
      if (road > 0.4) { r = 140; g = 100; b = 60; }
    }
    // parchment noise
    const n = ((x * 13 + y * 7) % 17) / 17 * 8;
    const s = 1 + shade * 0.35;
    const i = (y * size + x) * 4;
    img.data[i] = Math.min(255, r * s + n); img.data[i + 1] = Math.min(255, g * s + n); img.data[i + 2] = Math.min(255, b * s + n * 0.6); img.data[i + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  // contour-ish vignette
  const grad = c.createRadialGradient(size / 2, size / 2, size * 0.3, size / 2, size / 2, size * 0.72);
  grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(1, 'rgba(60,40,20,0.45)');
  c.fillStyle = grad; c.fillRect(0, 0, size, size);
  return cv;
}

export function worldToMap(x, z, size) { return [((x + WORLD_SIZE / 2) / WORLD_SIZE) * size, ((z + WORLD_SIZE / 2) / WORLD_SIZE) * size]; }
export { LOCATIONS, ROADS };
