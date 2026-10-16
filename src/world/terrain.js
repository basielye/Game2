// Island terrain: deterministic heightfield, flattened plazas, carved roads, and a splat-blended PBR material.
import * as THREE from 'three';
import { noise } from '../core/noise.js';
import { clamp, lerp, smoothstep } from '../core/math.js';
import { LOCATIONS, ROADS, WORLD_SIZE } from '../data/world.js';
import { getTex } from '../core/textures.js';

const N = 512; // cells per side
const HALF = WORLD_SIZE / 2;
const CELL = WORLD_SIZE / N;
const CHUNKS = 8;

function rawHeight(x, z) {
  const nx = x / 830, nz = z / (z < 0 ? 900 : 880);
  let d = Math.sqrt(nx * nx + nz * nz);
  d += noise.fbm(x * 0.0018 + 11, z * 0.0018 - 7, 4) * 0.22;
  const mask = 1 - smoothstep(0.72, 1.0, d);

  const north = smoothstep(250, -550, z);
  const hills = noise.ridged(x * 0.0032 + 3, z * 0.0032 + 9, 5) * (14 + north * 42);
  const rolling = noise.fbm(x * 0.0042, z * 0.0042, 5) * 16;
  const detail = noise.fbm(x * 0.03, z * 0.03, 3) * 1.2;
  let land = 7 + rolling + hills + detail;

  // Mount Sibo — volcanic massif in the north
  const vx = x + 90, vz = z + 640;
  const dv = Math.sqrt(vx * vx + vz * vz);
  land += 175 * Math.exp(-Math.pow(dv / 250, 1.7));
  land += noise.ridged(x * 0.012, z * 0.012, 3) * 10 * Math.exp(-Math.pow(dv / 300, 2));

  // Brachiosaur lake basin
  const lx = x + 290, lz = z + 230;
  const dl = Math.sqrt(lx * lx * 1.3 + lz * lz);
  land -= 34 * Math.exp(-Math.pow(dl / 120, 2.2));

  // Southern lowlands are gentler
  const south = smoothstep(200, 700, z);
  land = lerp(land, 4 + rolling * 0.4 + detail, south * 0.55);

  const seabed = -26 + noise.fbm(x * 0.004, z * 0.004, 3) * 6;
  return lerp(seabed, land, mask);
}

// --- road acceleration grid ---
function buildRoadData() {
  const roads = [];
  for (const poly of ROADS) {
    // densify
    const pts = [];
    for (let i = 0; i < poly.length - 1; i++) {
      const [ax, az] = poly[i], [bx, bz] = poly[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const steps = Math.max(1, Math.ceil(len / 4));
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        // slight curvy deviation for organic roads
        const px = lerp(ax, bx, t), pz = lerp(az, bz, t);
        const off = noise.noise2(px * 0.01, pz * 0.01) * 10 * Math.sin(t * Math.PI);
        const nxp = -(bz - az) / len, nzp = (bx - ax) / len;
        pts.push([px + nxp * off, pz + nzp * off]);
      }
    }
    pts.push(poly[poly.length - 1]);
    // smoothed heights
    const hs = pts.map(([x, z]) => rawHeight(x, z));
    const sm = hs.map((_, i) => {
      let s = 0, n = 0;
      for (let k = -12; k <= 12; k++) { const j = clamp(i + k, 0, hs.length - 1); s += hs[j]; n++; }
      return Math.max(1.8, s / n);
    });
    roads.push({ pts, h: sm });
  }
  const G = 40;
  const grid = new Map();
  const key = (i, j) => i * 10000 + j;
  roads.forEach((r, ri) => {
    for (let s = 0; s < r.pts.length - 1; s++) {
      const [ax, az] = r.pts[s], [bx, bz] = r.pts[s + 1];
      const minx = Math.floor((Math.min(ax, bx) - 20) / G), maxx = Math.floor((Math.max(ax, bx) + 20) / G);
      const minz = Math.floor((Math.min(az, bz) - 20) / G), maxz = Math.floor((Math.max(az, bz) + 20) / G);
      for (let i = minx; i <= maxx; i++) for (let j = minz; j <= maxz; j++) {
        const k = key(i, j);
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(ri, s);
      }
    }
  });
  return {
    roads,
    query(x, z) {
      const list = grid.get(key(Math.floor(x / G), Math.floor(z / G)));
      if (!list) return null;
      let best = 1e9, bh = 0;
      for (let q = 0; q < list.length; q += 2) {
        const r = roads[list[q]], s = list[q + 1];
        const [ax, az] = r.pts[s], [bx, bz] = r.pts[s + 1];
        const vx = bx - ax, vz = bz - az, wx = x - ax, wz = z - az;
        const c2 = vx * vx + vz * vz;
        const t = c2 > 0 ? clamp((vx * wx + vz * wz) / c2, 0, 1) : 0;
        const dx = x - (ax + vx * t), dz = z - (az + vz * t);
        const d = dx * dx + dz * dz;
        if (d < best) { best = d; bh = lerp(r.h[s], r.h[s + 1], t); }
      }
      return { d: Math.sqrt(best), h: bh };
    },
  };
}

export class Terrain {
  constructor() {
    this.size = WORLD_SIZE;
    this.n = N;
    this.heights = new Float32Array((N + 1) * (N + 1));
    this.roadMask = new Float32Array((N + 1) * (N + 1));
    this.flatMask = new Float32Array((N + 1) * (N + 1));
    this.roadData = buildRoadData();
    for (const L of LOCATIONS) if (L.flat > 0 && L.h == null) L.h = Math.max(3.5, rawHeight(L.x, L.z));
    this._generate();
  }

  _generate() {
    const { heights, roadMask, flatMask } = this;
    for (let j = 0; j <= N; j++) {
      const z = -HALF + j * CELL;
      for (let i = 0; i <= N; i++) {
        const x = -HALF + i * CELL;
        let h = rawHeight(x, z);
        const idx = j * (N + 1) + i;
        const rq = this.roadData.query(x, z);
        if (rq && rq.d < 18) {
          const w = 1 - smoothstep(4.5, 16, rq.d);
          h = lerp(h, rq.h + 0.15, w);
          roadMask[idx] = 1 - smoothstep(2.5, 5.5, rq.d + noise.noise2(x * 0.3, z * 0.3) * 1.2);
        }
        let fm = 0;
        for (const L of LOCATIONS) {
          if (!L.flat) continue;
          const d = Math.hypot(x - L.x, z - L.z);
          if (d < L.flat) {
            const w = 1 - smoothstep(L.flat * 0.65, L.flat, d);
            h = lerp(h, L.h, w);
            fm = Math.max(fm, w);
          }
        }
        flatMask[idx] = fm;
        heights[idx] = h;
      }
    }
  }

  getHeight(x, z) {
    const fx = (x + HALF) / CELL, fz = (z + HALF) / CELL;
    if (fx < 0 || fz < 0 || fx >= N || fz >= N) return -30;
    const i = Math.floor(fx), j = Math.floor(fz);
    const tx = fx - i, tz = fz - j;
    const H = this.heights, W = N + 1;
    const a = H[j * W + i], b = H[j * W + i + 1], c = H[(j + 1) * W + i], d = H[(j + 1) * W + i + 1];
    // match triangle split used by PlaneGeometry-like indexing (a,c,b) (c,d,b)
    if (tx + tz < 1) return a + (b - a) * tx + (c - a) * tz;
    return d + (c - d) * (1 - tx) + (b - d) * (1 - tz);
  }

  sample(arr, x, z) {
    const fx = clamp((x + HALF) / CELL, 0, N), fz = clamp((z + HALF) / CELL, 0, N);
    const i = Math.min(N - 1, Math.floor(fx)), j = Math.min(N - 1, Math.floor(fz));
    const tx = fx - i, tz = fz - j, W = N + 1;
    const a = arr[j * W + i], b = arr[j * W + i + 1], c = arr[(j + 1) * W + i], d = arr[(j + 1) * W + i + 1];
    return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
  }

  getRoad(x, z) { return this.sample(this.roadMask, x, z); }
  getFlat(x, z) { return this.sample(this.flatMask, x, z); }

  getNormal(x, z, out = new THREE.Vector3()) {
    const e = 1.5;
    const hl = this.getHeight(x - e, z), hr = this.getHeight(x + e, z);
    const hd = this.getHeight(x, z - e), hu = this.getHeight(x, z + e);
    return out.set(hl - hr, 2 * e, hd - hu).normalize();
  }

  slope(x, z) { return 1 - this.getNormal(x, z, _n).y; }

  // March a ray against the heightfield. Returns distance or -1.
  raycast(origin, dir, maxDist = 400, step = 1.5) {
    let prevT = 0;
    for (let t = step; t < maxDist; t += step) {
      const x = origin.x + dir.x * t, y = origin.y + dir.y * t, z = origin.z + dir.z * t;
      if (y < this.getHeight(x, z)) {
        // refine
        let a = prevT, b = t;
        for (let k = 0; k < 8; k++) {
          const m = (a + b) / 2;
          const yy = origin.y + dir.y * m;
          if (yy < this.getHeight(origin.x + dir.x * m, origin.z + dir.z * m)) b = m; else a = m;
        }
        return (a + b) / 2;
      }
      prevT = t;
      if (t > 60) step = 3;
    }
    return -1;
  }

  buildMesh(quality) {
    const group = new THREE.Group();
    group.name = 'terrain';
    const mat = this._material(quality);
    this.material = mat;
    const per = N / CHUNKS;
    const W = N + 1;
    const H = this.heights;
    // pre-compute normals across whole grid for seamless chunks
    const normals = new Float32Array(W * W * 3);
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const hl = H[j * W + Math.max(0, i - 1)], hr = H[j * W + Math.min(N, i + 1)];
      const hd = H[Math.max(0, j - 1) * W + i], hu = H[Math.min(N, j + 1) * W + i];
      let nx = hl - hr, ny = 2 * CELL, nz = hd - hu;
      const l = Math.hypot(nx, ny, nz);
      const k = (j * W + i) * 3;
      normals[k] = nx / l; normals[k + 1] = ny / l; normals[k + 2] = nz / l;
    }
    for (let cj = 0; cj < CHUNKS; cj++) for (let ci = 0; ci < CHUNKS; ci++) {
      const vcount = (per + 1) * (per + 1);
      const pos = new Float32Array(vcount * 3), nor = new Float32Array(vcount * 3), uv = new Float32Array(vcount * 2), spl = new Float32Array(vcount * 4);
      let allUnder = true;
      let v = 0;
      for (let j = 0; j <= per; j++) for (let i = 0; i <= per; i++) {
        const gi = ci * per + i, gj = cj * per + j;
        const idx = gj * W + gi;
        const x = -HALF + gi * CELL, z = -HALF + gj * CELL, y = H[idx];
        if (y > -6) allUnder = false;
        pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = z;
        nor[v * 3] = normals[idx * 3]; nor[v * 3 + 1] = normals[idx * 3 + 1]; nor[v * 3 + 2] = normals[idx * 3 + 2];
        uv[v * 2] = x / 6; uv[v * 2 + 1] = z / 6;
        const slope = 1 - normals[idx * 3 + 1];
        const road = this.roadMask[idx];
        const rock = clamp(smoothstep(0.18, 0.34, slope) + smoothstep(150, 190, y) * 0.6, 0, 1);
        const sand = (1 - smoothstep(1.2, 4.0 + noise.noise2(x * 0.02, z * 0.02) * 1.5, y)) * (1 - this.flatMask[idx] * 0.7);
        const dv = Math.hypot(x + 90, z + 640);
        const ash = smoothstep(260, 120, dv) * smoothstep(60, 120, y);
        spl[v * 4] = road; spl[v * 4 + 1] = rock; spl[v * 4 + 2] = sand; spl[v * 4 + 3] = ash;
        v++;
      }
      if (allUnder && (ci === 0 || cj === 0 || ci === CHUNKS - 1 || cj === CHUNKS - 1)) {
        // deep ocean chunk — still build (seabed visible through water near coasts) but lower priority
      }
      const idxArr = new Uint32Array(per * per * 6);
      let k = 0;
      for (let j = 0; j < per; j++) for (let i = 0; i < per; i++) {
        const a = j * (per + 1) + i, b = a + 1, c = a + (per + 1), d = c + 1;
        idxArr[k++] = a; idxArr[k++] = c; idxArr[k++] = b;
        idxArr[k++] = c; idxArr[k++] = d; idxArr[k++] = b;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.setAttribute('splat', new THREE.BufferAttribute(spl, 4));
      g.setIndex(new THREE.BufferAttribute(idxArr, 1));
      g.computeBoundingSphere();
      g.computeBoundingBox();
      const m = new THREE.Mesh(g, mat);
      m.receiveShadow = true;
      m.matrixAutoUpdate = false;
      m.updateMatrix();
      group.add(m);
    }
    // ocean floor skirt far beyond the island
    const skirt = new THREE.Mesh(new THREE.PlaneGeometry(12000, 12000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1d3a3a, roughness: 1 }));
    skirt.position.y = -32;
    group.add(skirt);
    this.mesh = group;
    return group;
  }

  _material(quality) {
    const mat = new THREE.MeshStandardMaterial({
      roughness: 0.92, metalness: 0,
      normalMap: getTex('terrainNormal'),
      normalScale: new THREE.Vector2(0.9, 0.9),
    });
    const uniforms = {
      tGrass: { value: getTex('grass') }, tDirt: { value: getTex('dirt') }, tRock: { value: getTex('rock') },
      tSand: { value: getTex('sand') }, tAsh: { value: getTex('ash') },
    };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uniforms);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec4 splat;\nvarying vec4 vSplat;\nvarying vec3 vWPos;\nvarying vec3 vWNorm;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvSplat = splat;\nvWPos = (modelMatrix * vec4(transformed,1.0)).xyz;\nvWNorm = normal;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
uniform sampler2D tGrass, tDirt, tRock, tSand, tAsh;
varying vec4 vSplat; varying vec3 vWPos; varying vec3 vWNorm;
float tHash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float tNoise(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(tHash(i),tHash(i+vec2(1,0)),f.x), mix(tHash(i+vec2(0,1)),tHash(i+vec2(1,1)),f.x), f.y); }
vec3 sampleAntiTile(sampler2D t, vec2 uv){ return mix(texture2D(t, uv).rgb, texture2D(t, uv*0.27 + 0.31).rgb, 0.45); }
`)
        .replace('#include <map_fragment>', `
  vec2 wuv = vWPos.xz / 7.0;
  float macro = tNoise(vWPos.xz*0.012) * 0.65 + tNoise(vWPos.xz*0.05)*0.35;
  vec3 grass = sampleAntiTile(tGrass, wuv);
  // lush/dry variation
  grass *= mix(vec3(0.85,1.05,0.8), vec3(1.15,1.02,0.78), smoothstep(0.35,0.75, macro));
  vec3 dirt = sampleAntiTile(tDirt, wuv*1.3);
  vec3 sand = sampleAntiTile(tSand, wuv*0.9);
  vec3 ash = sampleAntiTile(tAsh, wuv);
  vec3 an = abs(normalize(vWNorm));
  vec3 rockX = texture2D(tRock, vWPos.zy/14.0).rgb, rockZ = texture2D(tRock, vWPos.xy/14.0).rgb, rockY = texture2D(tRock, vWPos.xz/14.0).rgb;
  vec3 bw = pow(an, vec3(4.0)); bw /= (bw.x+bw.y+bw.z);
  vec3 rock = rockX*bw.x + rockY*bw.y + rockZ*bw.z;
  float n1 = tNoise(vWPos.xz*0.35);
  vec3 col = grass;
  float dirtAmt = smoothstep(0.55, 0.85, macro + n1*0.25) * 0.8;
  col = mix(col, dirt, dirtAmt);
  col = mix(col, ash, clamp(vSplat.w*1.4 + (n1-0.5)*0.4, 0.0, 1.0));
  col = mix(col, sand, smoothstep(0.35, 0.65, vSplat.z + (n1-0.5)*0.35));
  float roadA = smoothstep(0.25, 0.7, vSplat.x + (n1-0.5)*0.3);
  col = mix(col, dirt*vec3(1.05,0.98,0.9), roadA);
  float rockA = smoothstep(0.35, 0.65, vSplat.y + (n1-0.5)*0.3);
  col = mix(col, rock, rockA);
  // wet sand / shoreline darkening
  float wet = 1.0 - smoothstep(-0.2, 1.1, vWPos.y);
  col *= mix(1.0, 0.55, wet);
  diffuseColor.rgb *= col * 1.08;
`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor = mix(roughnessFactor, 0.35, wet*0.9);
  roughnessFactor = mix(roughnessFactor, 0.82, rockA);
`);
    };
    mat.customProgramCacheKey = () => 'terrain-v2';
    return mat;
  }

  // Heights as a half-float texture for the water shader (depth-based colour & shoreline foam).
  makeHeightTexture() {
    const W = N + 1;
    const data = new Uint16Array(W * W);
    for (let i = 0; i < W * W; i++) data[i] = THREE.DataUtils.toHalfFloat(this.heights[i]);
    const tex = new THREE.DataTexture(data, W, W, THREE.RedFormat, THREE.HalfFloatType);
    tex.magFilter = tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }
}

const _n = new THREE.Vector3();
