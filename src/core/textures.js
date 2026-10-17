// Procedural texture factory. Everything is generated at load time — the game ships with zero image assets.
import * as THREE from 'three';
import { mulberry32 } from './noise.js';

// Tileable value noise (periodic lattice) so textures repeat seamlessly.
function makeTileNoise(seed) {
  const rand = mulberry32(seed);
  const tables = {};
  return function (x, y, period) {
    let tbl = tables[period];
    if (!tbl) {
      tbl = new Float32Array(period * period);
      for (let i = 0; i < tbl.length; i++) tbl[i] = rand();
      tables[period] = tbl;
    }
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const x0 = ((xi % period) + period) % period, y0 = ((yi % period) + period) % period;
    const x1 = (x0 + 1) % period, y1 = (y0 + 1) % period;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = tbl[y0 * period + x0], b = tbl[y0 * period + x1];
    const c = tbl[y1 * period + x0], d = tbl[y1 * period + x1];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

function fbmTile(nz, u, v, basePeriod, oct, gain = 0.5) {
  let s = 0, a = 1, n = 0, p = basePeriod;
  for (let o = 0; o < oct; o++) {
    s += nz(u * p, v * p, p) * a; n += a; a *= gain; p *= 2;
  }
  return s / n;
}

function toTexture(data, size, { srgb = true, repeat = true, mips = true } = {}) {
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.needsUpdate = true;
  if (repeat) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; }
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  tex.generateMipmaps = mips;
  tex.anisotropy = 8;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function gen(size, fn, opts) {
  const data = new Uint8Array(size * size * 4);
  const out = [0, 0, 0, 255];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      out[3] = 255;
      fn(x / size, y / size, out, x, y);
      const i = (y * size + x) * 4;
      data[i] = out[0]; data[i + 1] = out[1]; data[i + 2] = out[2]; data[i + 3] = out[3];
    }
  }
  return toTexture(data, size, opts);
}

const c255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
const mix = (a, b, t) => a + (b - a) * t;

const cache = {};
export function getTex(name) {
  if (!cache[name]) cache[name] = builders[name]();
  return cache[name];
}

const builders = {
  grass() {
    const nz = makeTileNoise(11);
    return gen(512, (u, v, o) => {
      const n = fbmTile(nz, u, v, 4, 6);
      const blades = fbmTile(nz, u * 1, v * 1, 64, 2);
      const patch = fbmTile(nz, u, v, 2, 3);
      const t = n * 0.6 + blades * 0.4;
      o[0] = c255(mix(48, 104, t) * mix(0.85, 1.2, patch));
      o[1] = c255(mix(70, 128, t) * mix(0.9, 1.1, patch));
      o[2] = c255(mix(24, 52, t));
    });
  },
  dirt() {
    const nz = makeTileNoise(23);
    return gen(512, (u, v, o) => {
      const n = fbmTile(nz, u, v, 4, 6);
      const peb = fbmTile(nz, u, v, 48, 2);
      const p = peb > 0.68 ? 1 : 0;
      const t = n;
      o[0] = c255(mix(84, 140, t) + p * 30);
      o[1] = c255(mix(62, 104, t) + p * 26);
      o[2] = c255(mix(40, 70, t) + p * 22);
    });
  },
  rock() {
    const nz = makeTileNoise(37);
    return gen(512, (u, v, o) => {
      const n = fbmTile(nz, u, v, 4, 7, 0.55);
      const m = fbmTile(nz, u + 0.37, v + 0.11, 8, 5, 0.5);
      const crev = Math.pow(1 - Math.abs(m - 0.5) * 2, 10);       // many thin crevices
      const lichen = Math.max(0, fbmTile(nz, u + 0.7, v + 0.3, 6, 4) - 0.58) * 2.2;
      const strata = 0.5 + 0.5 * Math.sin((v * 6 + n * 2.5) * Math.PI * 2);
      const t = n * 0.75 + strata * 0.12 + m * 0.13;
      const dark = 1 - crev * 0.45;
      o[0] = c255((mix(78, 150, t) * dark) - lichen * 10);
      o[1] = c255((mix(72, 140, t) * dark) + lichen * 8);
      o[2] = c255((mix(64, 126, t) * dark) - lichen * 18);
    });
  },
  sand() {
    const nz = makeTileNoise(41);
    return gen(512, (u, v, o) => {
      const n = fbmTile(nz, u, v, 8, 5);
      const g = fbmTile(nz, u, v, 128, 1);
      const ripple = 0.5 + 0.5 * Math.sin((u * 18 + fbmTile(nz, u, v, 2, 2) * 3) * Math.PI * 2);
      const t = n * 0.6 + g * 0.25 + ripple * 0.15;
      o[0] = c255(mix(176, 226, t));
      o[1] = c255(mix(156, 204, t));
      o[2] = c255(mix(112, 156, t));
    });
  },
  ash() {
    const nz = makeTileNoise(53);
    return gen(256, (u, v, o) => {
      const n = fbmTile(nz, u, v, 4, 6);
      o[0] = c255(mix(40, 86, n)); o[1] = c255(mix(36, 76, n)); o[2] = c255(mix(34, 70, n));
    });
  },
  bark() {
    const nz = makeTileNoise(61);
    return gen(256, (u, v, o) => {
      const n = fbmTile(nz, u * 1, v * 0.25, 8, 5);
      const ridges = Math.abs(Math.sin((u * 14 + n * 1.5) * Math.PI));
      const t = ridges * 0.6 + n * 0.4;
      o[0] = c255(mix(46, 112, t)); o[1] = c255(mix(36, 88, t)); o[2] = c255(mix(26, 62, t));
    });
  },
  palmBark() {
    const nz = makeTileNoise(67);
    return gen(256, (u, v, o) => {
      const n = fbmTile(nz, u, v, 8, 4);
      const ring = Math.pow(Math.abs(Math.sin(v * Math.PI * 10)), 0.4);
      const t = ring * 0.7 + n * 0.3;
      o[0] = c255(mix(70, 150, t)); o[1] = c255(mix(56, 124, t)); o[2] = c255(mix(38, 88, t));
    });
  },
  leaves() {
    // Atlas of leaf clusters with alpha — used on broadleaf canopy cards.
    const nz = makeTileNoise(71);
    const rnd = mulberry32(5);
    const size = 512;
    const data = new Uint8Array(size * size * 4);
    const leaves = [];
    for (let i = 0; i < 260; i++) leaves.push({ x: rnd(), y: rnd(), a: rnd() * Math.PI * 2, s: 0.035 + rnd() * 0.045, c: rnd() });
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const dx = u - 0.5, dy = v - 0.5;
      let alpha = 0, shade = 0, hue = 0;
      if (dx * dx + dy * dy < 0.25) {
        for (let k = 0; k < leaves.length; k++) {
          const L = leaves[k];
          const lx = u - L.x, ly = v - L.y;
          if (Math.abs(lx) > L.s || Math.abs(ly) > L.s) continue;
          const ca = Math.cos(L.a), sa = Math.sin(L.a);
          const rx = (lx * ca - ly * sa) / L.s, ry = (lx * sa + ly * ca) / L.s;
          if (rx * rx * 0.35 + ry * ry * 2.4 < 0.35) {
            alpha = 1; shade = 0.55 + 0.45 * (1 - Math.abs(ry) * 2.5) ; hue = L.c;
            if (Math.abs(ry) < 0.04) shade *= 0.8;
          }
        }
      }
      const n = fbmTile(nz, u, v, 8, 3);
      const i = (y * size + x) * 4;
      if (!alpha) { hue = 0.5; shade = 0.75; }
      data[i] = c255((mix(40, 90, hue) + n * 30) * shade);
      data[i + 1] = c255((mix(86, 140, hue) + n * 30) * shade);
      data[i + 2] = c255((mix(26, 48, hue)) * shade);
      data[i + 3] = alpha * 255;
    }
    return toTexture(data, size, { repeat: false });
  },
  frond() {
    // Palm/fern frond: central rib with leaflets, alpha-tested. U along length, V across.
    const size = 256;
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const across = Math.abs(v - 0.5) * 2; // 0 at rib
      const width = Math.sin(Math.min(1, u * 1.15) * Math.PI) * 0.95;
      const leafletPhase = (u * 34 + across * 3.2) % 1;
      const gap = leafletPhase < 0.18;
      let a = across < width && !gap ? 1 : 0;
      if (across < 0.05 && u < 0.98) a = 1;
      const shade = a ? 0.7 + 0.3 * (1 - across) - (gap ? 0.2 : 0) : 0.75;
      const tip = u > 0.8 ? (u - 0.8) * 2 : 0;
      const i = (y * size + x) * 4;
      data[i] = c255((52 + tip * 60) * shade);
      data[i + 1] = c255((112 + tip * 20) * shade);
      data[i + 2] = c255((34) * shade);
      data[i + 3] = a * 255;
    }
    return toTexture(data, size, { repeat: false });
  },
  grassBlade() {
    const size = 128;
    const data = new Uint8Array(size * size * 4);
    const rnd = mulberry32(9);
    const blades = [];
    for (let i = 0; i < 16; i++) blades.push({ x: 0.08 + rnd() * 0.84, w: 0.014 + rnd() * 0.018, h: 0.45 + rnd() * 0.55, bend: (rnd() - 0.5) * 0.35 });
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = x / size, v = 1 - y / size; // v=0 bottom
      let a = 0, s = 0;
      for (const b of blades) {
        if (v > b.h) continue;
        const t = v / b.h;
        const cx = b.x + b.bend * t * t;
        const w = b.w * (1 - t);
        if (Math.abs(u - cx) < w) { a = 1; s = Math.max(s, 0.5 + 0.5 * t); }
      }
      const i = (y * size + x) * 4;
      if (!a) s = 0.7;
      data[i] = c255(70 * s + 40); data[i + 1] = c255(120 * s + 55); data[i + 2] = c255(32 * s + 18); data[i + 3] = a * 255;
    }
    return toTexture(data, size, { repeat: false });
  },
  scales() {
    // Normal map of reptile scales (hex-ish cells) — tileable.
    const nz = makeTileNoise(83);
    const size = 256;
    const height = new Float32Array(size * size);
    const cells = 24;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = (x / size) * cells, v = (y / size) * cells;
      // offset rows
      const row = Math.floor(v);
      const uu = u + (row % 2) * 0.5;
      const fx = uu - Math.floor(uu) - 0.5, fy = v - row - 0.5;
      const d = Math.sqrt(fx * fx * 1.2 + fy * fy);
      height[y * size + x] = Math.max(0, 0.5 - d) * 2 + fbmTile(nz, x / size, y / size, 16, 2) * 0.25;
    }
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const h = (xx, yy) => height[((yy + size) % size) * size + ((xx + size) % size)];
      const dx = (h(x + 1, y) - h(x - 1, y)) * 2.2;
      const dy = (h(x, y + 1) - h(x, y - 1)) * 2.2;
      const l = Math.sqrt(dx * dx + dy * dy + 1);
      const i = (y * size + x) * 4;
      data[i] = c255((-dx / l * 0.5 + 0.5) * 255);
      data[i + 1] = c255((-dy / l * 0.5 + 0.5) * 255);
      data[i + 2] = c255((1 / l * 0.5 + 0.5) * 255);
      data[i + 3] = 255;
    }
    return toTexture(data, size, { srgb: false });
  },
  terrainNormal() {
    // Generic micro-detail normal map for terrain.
    const nz = makeTileNoise(97);
    const size = 256;
    const height = new Float32Array(size * size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) height[y * size + x] = fbmTile(nz, x / size, y / size, 8, 5, 0.55);
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const h = (xx, yy) => height[((yy + size) % size) * size + ((xx + size) % size)];
      const dx = (h(x + 1, y) - h(x - 1, y)) * 6, dy = (h(x, y + 1) - h(x, y - 1)) * 6;
      const l = Math.sqrt(dx * dx + dy * dy + 1);
      const i = (y * size + x) * 4;
      data[i] = c255((-dx / l * 0.5 + 0.5) * 255); data[i + 1] = c255((-dy / l * 0.5 + 0.5) * 255);
      data[i + 2] = c255((1 / l * 0.5 + 0.5) * 255); data[i + 3] = 255;
    }
    return toTexture(data, size, { srgb: false });
  },
  planks() {
    const nz = makeTileNoise(101);
    return gen(256, (u, v, o) => {
      const plank = Math.floor(v * 8);
      const grain = fbmTile(nz, u * 0.5, v * 4, 8, 4);
      const edge = (v * 8) % 1 < 0.06 ? 0.45 : 1;
      const tone = 0.8 + ((plank * 37) % 10) / 40;
      o[0] = c255(mix(80, 150, grain) * edge * tone); o[1] = c255(mix(56, 108, grain) * edge * tone); o[2] = c255(mix(34, 66, grain) * edge * tone);
    });
  },
  concrete() {
    const nz = makeTileNoise(103);
    return gen(256, (u, v, o) => {
      const n = fbmTile(nz, u, v, 4, 6);
      const stain = fbmTile(nz, u, v * 0.3, 2, 3);
      const moss = Math.max(0, stain - 0.55) * 3;
      const g = mix(120, 175, n) * (1 - moss * 0.3);
      o[0] = c255(g - moss * 30); o[1] = c255(g + moss * 10); o[2] = c255(g - 6 - moss * 40);
    });
  },
  metal() {
    const nz = makeTileNoise(107);
    return gen(256, (u, v, o) => {
      const n = fbmTile(nz, u, v, 4, 5);
      const rust = Math.max(0, fbmTile(nz, u + 0.5, v, 3, 5) - 0.5) * 2.5;
      o[0] = c255(mix(90, 130, n) + rust * 90); o[1] = c255(mix(92, 130, n) + rust * 20); o[2] = c255(mix(96, 136, n) - rust * 40);
    });
  },
  thatch() {
    const nz = makeTileNoise(109);
    return gen(256, (u, v, o) => {
      const n = fbmTile(nz, u * 4, v * 0.5, 8, 4);
      o[0] = c255(mix(110, 180, n)); o[1] = c255(mix(88, 150, n)); o[2] = c255(mix(48, 86, n));
    });
  },
  cloth() {
    const nz = makeTileNoise(113);
    return gen(128, (u, v, o) => {
      const weave = (Math.sin(u * 128 * Math.PI) * Math.sin(v * 128 * Math.PI)) * 0.5 + 0.5;
      const n = fbmTile(nz, u, v, 4, 4);
      const g = 200 + weave * 30 + n * 25;
      o[0] = c255(g); o[1] = c255(g); o[2] = c255(g);
    }, { srgb: true });
  },
  smoke() {
    const nz = makeTileNoise(127);
    const size = 128;
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const dx = u - 0.5, dy = v - 0.5;
      const r = Math.sqrt(dx * dx + dy * dy) * 2;
      const n = fbmTile(nz, u, v, 4, 4);
      const a = Math.max(0, 1 - r) * (0.5 + n * 0.8);
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255; data[i + 3] = c255(a * a * 255);
    }
    return toTexture(data, size, { repeat: false });
  },
  glow() {
    const size = 64;
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const dx = x / size - 0.5, dy = y / size - 0.5;
      const r = Math.sqrt(dx * dx + dy * dy) * 2;
      const a = Math.pow(Math.max(0, 1 - r), 2.2);
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255; data[i + 3] = c255(a * 255);
    }
    return toTexture(data, size, { repeat: false });
  },
  clouds() {
    const nz = makeTileNoise(131);
    return gen(512, (u, v, o) => {
      const n = fbmTile(nz, u, v, 4, 7, 0.55);
      const c = Math.max(0, (n - 0.45) * 3.2);
      o[0] = o[1] = o[2] = 255; o[3] = c255(Math.min(1, c) * 255);
    }, { srgb: false });
  },
};
