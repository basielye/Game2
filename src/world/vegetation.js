// Vegetation: procedural palms, jungle trees, tree ferns, conifers, bushes, ferns, rocks and wind-swept grass.
// Instances live in spatial buckets; each frame a cheap LOD pass refills near/far InstancedMeshes.
import * as THREE from 'three';
import { getTex } from '../core/textures.js';
import { mulberry32, noise } from '../core/noise.js';
import { smoothstep, clamp } from '../core/math.js';
import { taperTube, frondStrip, leafCluster, blob, merge, colorize } from './geom.js';
import { LOCATIONS } from '../data/world.js';

export const windUniforms = { uTime: { value: 0 }, uWind: { value: 1 } };
const FOLIAGE_NORMAL = `float faceDirection = 1.0;
vec3 normal = normalize( vNormal );
vec3 nonPerturbedNormal = normal;`;

function addWind(mat, { amp = 1, flutter = 1, key = 'w' } = {}) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = windUniforms.uTime;
    sh.uniforms.uWind = windUniforms.uWind;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      {
        vec3 wbase = vec3(0.0);
        #ifdef USE_INSTANCING
          wbase = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
        #endif
        float hgt = max(0.0, position.y);
        float ph = uTime * 1.3 + wbase.x * 0.07 + wbase.z * 0.05;
        float sway = (sin(ph) * 0.6 + sin(ph * 2.3 + 1.7) * 0.25) * hgt * hgt * 0.0045 * ${amp.toFixed(3)} * uWind;
        transformed.x += sway; transformed.z += sway * 0.6;
        float fl = sin(uTime * 7.0 + position.x * 2.1 + position.z * 1.7 + wbase.x) * 0.035 * ${flutter.toFixed(3)} * uWind * min(hgt, 3.0);
        transformed.y += fl; transformed.x += fl * 0.5;
      }`);
    // foliage: never flip normals on back faces (avoids black undersides on double-sided cards)
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', FOLIAGE_NORMAL);
  };
  mat.customProgramCacheKey = () => 'wind-' + key;
  return mat;
}

function makeMaterials() {
  const bark = new THREE.MeshStandardMaterial({ map: getTex('bark'), roughness: 0.95, color: 0xb8a890 });
  const palmBark = new THREE.MeshStandardMaterial({ map: getTex('palmBark'), roughness: 0.9 });
  const leaf = addWind(new THREE.MeshStandardMaterial({ map: getTex('leaves'), alphaTest: 0.45, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.75, color: 0xd8f0c0 }), { amp: 1, flutter: 1, key: 'leaf' });
  const frond = addWind(new THREE.MeshStandardMaterial({ map: getTex('frond'), alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.7, color: 0xe8ffd0 }), { amp: 1.6, flutter: 1.4, key: 'frond' });
  const conifer = addWind(new THREE.MeshStandardMaterial({ map: getTex('frond'), alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.85, color: 0x6f9a6a }), { amp: 0.6, flutter: 0.5, key: 'conifer' });
  const farLeaf = addWind(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: false }), { amp: 0.6, flutter: 0, key: 'farleaf' });
  const rock = new THREE.MeshStandardMaterial({ map: getTex('rock'), roughness: 0.9, vertexColors: true });
  return { bark, palmBark, leaf, frond, conifer, farLeaf, rock };
}

// Far-LOD canopy: a handful of large crossed leaf cards (cheap, but keeps a leafy silhouette).
function impostorCanopy(center, size, rng) {
  const parts = [];
  const w = Math.max(size.x, size.z) * 1.05, h = size.y * 1.1;
  for (let i = 0; i < 3; i++) {
    const g = new THREE.PlaneGeometry(w, h);
    g.rotateY((i / 3) * Math.PI + rng() * 0.3);
    parts.push(g);
  }
  const top = new THREE.PlaneGeometry(w * 0.9, w * 0.9); top.rotateX(-Math.PI / 2); top.translate(0, h * 0.18, 0); parts.push(top);
  const g = merge(parts);
  g.translate(center.x, center.y, center.z);
  const pa = g.attributes.position, na = g.attributes.normal;
  for (let k = 0; k < pa.count; k++) {
    const n = new THREE.Vector3(pa.getX(k) - center.x, (pa.getY(k) - center.y) + h * 0.4, pa.getZ(k) - center.z).normalize();
    na.setXYZ(k, n.x, n.y, n.z);
  }
  return g;
}

// ---------- species builders: each returns {near:[{geo, mat}], far:[{geo,mat}]} ----------
function buildPalm(M, rng) {
  const h = 9 + rng() * 3, lean = 1.5 + rng() * 2;
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.5, 0), new THREE.Vector3(lean * 0.15, h * 0.35, 0), new THREE.Vector3(lean * 0.55, h * 0.72, 0), new THREE.Vector3(lean, h, 0),
  ]);
  const trunk = taperTube(curve, 10, 7, (t) => 0.32 - t * 0.14, { uvScale: 4 });
  const top = new THREE.Vector3(lean, h, 0);
  const fronds = [];
  const nF = 11;
  for (let i = 0; i < nF; i++) {
    const yaw = (i / nF) * Math.PI * 2 + rng() * 0.3;
    fronds.push(frondStrip(top, yaw, 4.5 + rng() * 1.2, 1.7, 0.75 + rng() * 0.35, 0.35, 8, 0.18));
  }
  const crown = merge(fronds);
  const farTrunk = taperTube(curve, 3, 4, (t) => 0.32 - t * 0.14);
  const farFronds = [];
  for (let i = 0; i < 7; i++) farFronds.push(frondStrip(top, (i / 7) * Math.PI * 2, 5, 1.7, 0.9, 0.35, 3, 0.18));
  const farCrown = merge(farFronds);
  return { near: [{ geo: trunk, mat: M.palmBark }, { geo: crown, mat: M.frond }], far: [{ geo: farTrunk, mat: M.palmBark }, { geo: farCrown, mat: M.frond }], radius: 0.35 };
}

function buildJungle(M, rng, big = false) {
  const h = (big ? 17 : 11) + rng() * 5;
  const lean = (rng() - 0.5) * 1.5;
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -1, 0), new THREE.Vector3(lean * 0.3, h * 0.4, 0.3), new THREE.Vector3(lean, h, 0),
  ]);
  const r0 = big ? 0.9 : 0.5;
  const woods = [taperTube(curve, 8, 9, (t) => r0 * (1 - t * 0.6) + (t < 0.08 ? (0.08 - t) * 6 * r0 : 0), { uvScale: 3 })];
  const clusters = [];
  const nb = big ? 6 : 4;
  for (let i = 0; i < nb; i++) {
    const t = 0.55 + rng() * 0.4;
    const base = curve.getPointAt(t);
    const yaw = (i / nb) * Math.PI * 2 + rng();
    const len = (big ? 6 : 3.5) + rng() * 2;
    const end = base.clone().add(new THREE.Vector3(Math.cos(yaw) * len, len * (0.35 + rng() * 0.3), Math.sin(yaw) * len));
    const mid = base.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 0.6, 0));
    woods.push(taperTube(new THREE.CatmullRomCurve3([base, mid, end]), 4, 5, (tt) => r0 * 0.45 * (1 - tt * 0.7)));
    clusters.push({ c: end, r: (big ? 3.8 : 2.7) + rng() });
  }
  clusters.push({ c: curve.getPointAt(1).add(new THREE.Vector3(0, 1, 0)), r: (big ? 4.4 : 3.1) });
  const leaves = merge(clusters.map((k) => leafCluster(k.c, k.r, big ? 22 : 16, big ? 4.2 : 3.4, rng)));
  // far LOD: lumpy blobs with vertex colour
  // far LOD: a single lumpy canopy blob spanning the clusters
  const bb = new THREE.Box3();
  for (const k of clusters) bb.expandByPoint(k.c.clone().addScalar(k.r * 0.8)).expandByPoint(k.c.clone().subScalar(k.r * 0.8));
  const cs = bb.getSize(new THREE.Vector3()), cc = bb.getCenter(new THREE.Vector3());
  const farLeaves = impostorCanopy(cc, cs, rng);
  const farTrunk = taperTube(curve, 2, 4, (t) => r0 * (1 - t * 0.6));
  return { near: [{ geo: merge(woods), mat: M.bark }, { geo: leaves, mat: M.leaf }], far: [{ geo: farTrunk, mat: M.bark }, { geo: farLeaves, mat: M.leaf }], radius: r0 * 0.9 };
}

function buildTreeFern(M, rng) {
  const h = 2.5 + rng() * 2.5;
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, -0.3, 0), new THREE.Vector3(0.2, h * 0.5, 0), new THREE.Vector3(0.3 * rng(), h, 0)]);
  const trunk = taperTube(curve, 5, 6, (t) => 0.22 - t * 0.06, { uvScale: 2 });
  const top = curve.getPointAt(1);
  const fronds = [];
  for (let i = 0; i < 12; i++) fronds.push(frondStrip(top, (i / 12) * Math.PI * 2 + rng() * 0.3, 2.6 + rng() * 0.8, 1.1, 0.9, 0.55, 7, 0.15));
  const crown = merge(fronds);
  return { near: [{ geo: trunk, mat: M.palmBark }, { geo: crown, mat: M.frond }], far: [{ geo: trunk, mat: M.palmBark }, { geo: crown, mat: M.frond }], radius: 0.25 };
}

function buildConifer(M, rng) {
  const h = 12 + rng() * 6;
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, -0.5, 0), new THREE.Vector3(0, h, 0)]);
  const trunk = taperTube(curve, 4, 6, (t) => 0.4 * (1 - t * 0.9), { uvScale: 4 });
  const branches = [];
  const layers = 9;
  for (let l = 0; l < layers; l++) {
    const t = 0.18 + (l / layers) * 0.8;
    const y = t * h;
    const len = (1 - t) * 5 + 0.8;
    const n = 7;
    for (let i = 0; i < n; i++) {
      const yaw = (i / n) * Math.PI * 2 + l * 0.7 + rng() * 0.3;
      branches.push(frondStrip(new THREE.Vector3(0, y, 0), yaw, len, 1.5, 0.35, -0.05, 4, 0.1));
    }
  }
  branches.push(frondStrip(new THREE.Vector3(0, h - 1, 0), 0, 1.5, 0.8, -1.4, 0.9, 2));
  const crown = merge(branches);
  const far = blob(1, 1, rng, 1, 0.15);
  far.scale(3.2, h * 0.42, 3.2); far.translate(0, h * 0.52, 0);
  colorize(far, 0.12, 0.2, 0.1);
  const farTrunk = taperTube(curve, 1, 4, (t) => 0.4 * (1 - t * 0.9));
  return { near: [{ geo: trunk, mat: M.bark }, { geo: crown, mat: M.conifer }], far: [{ geo: farTrunk, mat: M.bark }, { geo: far, mat: M.farLeaf }], radius: 0.4 };
}

function buildBush(M, rng) {
  const parts = [];
  const n = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) parts.push(leafCluster(new THREE.Vector3((rng() - 0.5) * 1.6, 0.8 + rng() * 0.5, (rng() - 0.5) * 1.6), 1.1 + rng() * 0.4, 9, 1.9, rng));
  const g = merge(parts);
  return { near: [{ geo: g, mat: M.leaf }], far: [], radius: 0 };
}

function buildFern(M, rng) {
  const fronds = [];
  for (let i = 0; i < 9; i++) fronds.push(frondStrip(new THREE.Vector3(0, 0.05, 0), (i / 9) * Math.PI * 2 + rng() * 0.4, 1.3 + rng() * 0.5, 0.6, 1.0, 0.9, 5, 0.12));
  return { near: [{ geo: merge(fronds), mat: M.frond }], far: [], radius: 0 };
}

function buildRock(M, rng, size) {
  const g = blob(size, 2, rng, 0.6 + rng() * 0.3, 0.32);
  const pa = g.attributes.position;
  const col = new Float32Array(pa.count * 3);
  const uv = new Float32Array(pa.count * 2);
  for (let i = 0; i < pa.count; i++) {
    const y = pa.getY(i);
    const moss = smoothstep(size * 0.1, size * 0.6, y) * 0.6;
    col[i * 3] = 0.75 - moss * 0.35; col[i * 3 + 1] = 0.74 - moss * 0.1; col[i * 3 + 2] = 0.7 - moss * 0.45;
    uv[i * 2] = pa.getX(i) / 3; uv[i * 2 + 1] = (pa.getY(i) + pa.getZ(i)) / 3;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return { near: [{ geo: g, mat: M.rock }], far: [{ geo: g, mat: M.rock }], radius: size * 0.8, rock: true };
}

const BUCKET = 64;

export class Vegetation {
  constructor(terrain, colliders, quality) {
    this.terrain = terrain;
    this.colliders = colliders;
    this.group = new THREE.Group();
    this.group.name = 'vegetation';
    this.M = makeMaterials();
    this.quality = quality;
    this.buckets = new Map();
    this.lastPos = new THREE.Vector3(1e9, 0, 0);
    this.lastDir = new THREE.Vector3(0, 0, 1);
    this.species = [];
    this._makeSpecies();
    this._scatter();
    this._makeMeshes();
    this.grass = new Grass(terrain, quality);
    this.group.add(this.grass.mesh);
  }

  _makeSpecies() {
    const rng = mulberry32(777);
    const M = this.M;
    const add = (name, build, variants, opts) => {
      for (let v = 0; v < variants; v++) {
        const s = build(M, rng);
        this.species.push({ name, ...s, ...opts, variant: v });
      }
    };
    add('palm', buildPalm, 3, { nearDist: 190, farDist: 900, shadow: true, nearCap: 2500, farCap: 6000 });
    add('jungle', (M, r) => buildJungle(M, r, false), 3, { nearDist: 170, farDist: 900, shadow: true, nearCap: 3000, farCap: 9000 });
    add('jungleBig', (M, r) => buildJungle(M, r, true), 2, { nearDist: 210, farDist: 1000, shadow: true, nearCap: 1500, farCap: 4000 });
    add('treefern', buildTreeFern, 2, { nearDist: 120, farDist: 160, shadow: true, nearCap: 3000, farCap: 1000 });
    add('conifer', buildConifer, 2, { nearDist: 170, farDist: 1000, shadow: true, nearCap: 2000, farCap: 6000 });
    add('bush', buildBush, 3, { nearDist: 90, farDist: 0, shadow: false, nearCap: 5000, farCap: 0 });
    add('fern', buildFern, 2, { nearDist: 70, farDist: 0, shadow: false, nearCap: 6000, farCap: 0 });
    add('rock', (M, r) => buildRock(M, r, 1.4), 2, { nearDist: 200, farDist: 700, shadow: true, nearCap: 2500, farCap: 4000 });
    add('boulder', (M, r) => buildRock(M, r, 4.5), 2, { nearDist: 300, farDist: 1000, shadow: true, nearCap: 800, farCap: 2000 });
    this.speciesIdx = {};
    this.species.forEach((s, i) => { (this.speciesIdx[s.name] ||= []).push(i); });
  }

  _put(si, x, z, rot, scale) {
    const y = this.terrain.getHeight(x, z);
    const bx = Math.floor(x / BUCKET), bz = Math.floor(z / BUCKET);
    const k = bx * 1000 + bz;
    let b = this.buckets.get(k);
    if (!b) { b = { x: (bx + 0.5) * BUCKET, z: (bz + 0.5) * BUCKET, items: [] }; this.buckets.set(k, b); }
    b.items.push(si, x, y, z, rot, scale);
    const sp = this.species[si];
    if (sp.radius > 0) this.colliders.addCircle(x, z, sp.radius * scale, y - 2, y + (sp.rock ? sp.radius * scale * 1.4 : 30), sp.rock ? 'rock' : 'tree');
  }

  _scatter() {
    const T = this.terrain;
    const rng = mulberry32(4242);
    const pickVar = (name) => { const a = this.speciesIdx[name]; return a[Math.floor(rng() * a.length)]; };
    const keepOut = (x, z) => {
      if (T.getRoad(x, z) > 0.05) return true;
      if (T.getFlat(x, z) > 0.2) return true;
      for (const L of LOCATIONS) { const r = (L.flat || L.r) * 0.9; if ((x - L.x) ** 2 + (z - L.z) ** 2 < r * r) return true; }
      return false;
    };
    const step = 6.5;
    const H = this.terrain.size / 2;
    for (let z = -H; z < H; z += step) for (let x = -H; x < H; x += step) {
      const px = x + (rng() - 0.5) * step, pz = z + (rng() - 0.5) * step;
      const h = T.getHeight(px, pz);
      if (h < 0.6) continue;
      const slope = T.slope(px, pz);
      const forest = noise.fbm(px * 0.0045 + 40, pz * 0.0045 - 12, 4);
      const r = rng();
      const rot = rng() * Math.PI * 2;
      if (keepOut(px, pz)) continue;
      if (slope > 0.42) { if (r < 0.06) this._put(pickVar('boulder'), px, pz, rot, 0.6 + rng() * 0.8); continue; }
      if (h < 5.5) {
        if (r < 0.2) this._put(pickVar('palm'), px, pz, rot, 0.8 + rng() * 0.4);
        else if (r < 0.24) this._put(pickVar('rock'), px, pz, rot, 0.5 + rng());
        continue;
      }
      const ashy = Math.hypot(px + 90, pz + 640) < 230 && h > 70;
      if (ashy) { if (r < 0.04) this._put(pickVar('boulder'), px, pz, rot, 0.5 + rng()); else if (r < 0.1) this._put(pickVar('rock'), px, pz, rot, 0.6 + rng()); continue; }
      if (h > 95) {
        if (forest > -0.15 && r < 0.32) this._put(pickVar('conifer'), px, pz, rot, 0.7 + rng() * 0.5);
        else if (r < 0.38) this._put(pickVar('rock'), px, pz, rot, 0.6 + rng());
        continue;
      }
      // lowland: meadows where forest noise is low (herd grazing plains)
      const meadow = forest < -0.12;
      if (meadow) {
        if (r < 0.012) this._put(pickVar('jungleBig'), px, pz, rot, 0.9 + rng() * 0.3);
        else if (r < 0.03) this._put(pickVar('bush'), px, pz, rot, 0.8 + rng() * 0.6);
        else if (r < 0.04) this._put(pickVar('rock'), px, pz, rot, 0.6 + rng());
        continue;
      }
      const dens = smoothstep(-0.12, 0.25, forest);
      if (r < 0.22 * dens) this._put(pickVar('jungle'), px, pz, rot, 0.8 + rng() * 0.5);
      else if (r < 0.28 * dens) this._put(pickVar('jungleBig'), px, pz, rot, 0.8 + rng() * 0.4);
      else if (r < 0.38 * dens) this._put(pickVar('treefern'), px, pz, rot, 0.8 + rng() * 0.5);
      else if (r < 0.42 * dens + 0.02) this._put(pickVar('palm'), px, pz, rot, 0.8 + rng() * 0.3);
      else if (r < 0.46) this._put(pickVar('rock'), px, pz, rot, 0.5 + rng());
    }
    // understory pass (bushes + ferns), denser, small
    const step2 = 3.6;
    for (let z = -H; z < H; z += step2) for (let x = -H; x < H; x += step2) {
      const px = x + (rng() - 0.5) * step2, pz = z + (rng() - 0.5) * step2;
      const h = T.getHeight(px, pz);
      if (h < 3 || h > 120) continue;
      const forest = noise.fbm(px * 0.0045 + 40, pz * 0.0045 - 12, 4);
      const r = rng();
      const dens = smoothstep(-0.2, 0.3, forest);
      if (r > 0.36 * dens + 0.015) continue;
      if (T.slope(px, pz) > 0.35 || keepOut(px, pz)) continue;
      this._put(pickVar(rng() < 0.45 ? 'bush' : 'fern'), px, pz, rng() * 6.28, 0.7 + rng() * 0.6);
    }
  }

  _makeMeshes() {
    this.batches = [];
    this.species.forEach((sp, si) => {
      const mk = (parts, cap, lod) => parts.map((p) => {
        const m = new THREE.InstancedMesh(p.geo, p.mat, cap);
        m.count = 0;
        m.frustumCulled = false;
        m.castShadow = lod === 'near' && sp.shadow && this.quality.treeShadows;
        m.receiveShadow = true;
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.group.add(m);
        return m;
      });
      this.batches[si] = { near: mk(sp.near, sp.nearCap, 'near'), far: sp.farDist > 0 ? mk(sp.far, sp.farCap, 'far') : [] };
    });
  }

  setShadows(on) {
    this.species.forEach((sp, si) => this.batches[si].near.forEach((m) => (m.castShadow = on && sp.shadow)));
  }

  update(dt, camPos, force = false, camDir = null) {
    windUniforms.uTime.value += dt;
    this.grass.update(camPos);
    const turned = camDir && this.lastDir.dot(camDir) < 0.95;
    if (!force && !turned && camPos.distanceToSquared(this.lastPos) < 36) return;
    this.lastPos.copy(camPos);
    if (camDir) this.lastDir.copy(camDir);
    const cdx = camDir ? camDir.x : 0, cdz = camDir ? camDir.z : 0;
    const cdl = Math.hypot(cdx, cdz) || 1;
    const fx = cdx / cdl, fz = cdz / cdl, cull = !!camDir && !force;
    const counts = this.species.map(() => [0, 0]);
    const lodMul = this.quality.lod;
    const maxFar = 1000 * lodMul;
    for (const b of this.buckets.values()) {
      const bd = Math.hypot(b.x - camPos.x, b.z - camPos.z);
      if (bd > maxFar + BUCKET) continue;
      const it = b.items;
      for (let i = 0; i < it.length; i += 6) {
        const si = it[i], sp = this.species[si];
        const x = it[i + 1], y = it[i + 2], z = it[i + 3];
        const dx = x - camPos.x, dz = z - camPos.z;
        const d2 = dx * dx + dz * dz;
        const nd = sp.nearDist * lodMul;
        if (cull && d2 > 900) { const inv = 1 / Math.sqrt(d2); if ((dx * fx + dz * fz) * inv < 0.25) continue; }
        let lod;
        if (d2 < nd * nd) lod = 0;
        else if (sp.farDist > 0 && d2 < (sp.farDist * lodMul) ** 2) lod = 1;
        else continue;
        const c = counts[si];
        const cap = lod === 0 ? sp.nearCap : sp.farCap;
        if (c[lod] >= cap) continue;
        const meshes = lod === 0 ? this.batches[si].near : this.batches[si].far;
        const rot = it[i + 4], s = it[i + 5];
        const co = Math.cos(rot) * s, sn = Math.sin(rot) * s;
        const idx = c[lod]++ * 16;
        for (const m of meshes) {
          const e = m.instanceMatrix.array;
          e[idx] = co; e[idx + 1] = 0; e[idx + 2] = -sn; e[idx + 3] = 0;
          e[idx + 4] = 0; e[idx + 5] = s; e[idx + 6] = 0; e[idx + 7] = 0;
          e[idx + 8] = sn; e[idx + 9] = 0; e[idx + 10] = co; e[idx + 11] = 0;
          e[idx + 12] = x; e[idx + 13] = y; e[idx + 14] = z; e[idx + 15] = 1;
        }
      }
    }
    this.species.forEach((sp, si) => {
      const B = this.batches[si];
      for (const m of B.near) { m.count = counts[si][0]; m.visible = m.count > 0; m.instanceMatrix.needsUpdate = true; }
      for (const m of B.far) { m.count = counts[si][1]; m.visible = m.count > 0; m.instanceMatrix.needsUpdate = true; }
    });
  }
}

// ---------------- Grass ----------------
class Grass {
  constructor(terrain, quality) {
    this.terrain = terrain;
    this.radius = quality.grassRadius;
    this.density = quality.grassDensity;
    this.cap = 60000;
    const blades = [];
    for (let i = 0; i < 3; i++) {
      const g = new THREE.PlaneGeometry(0.7, 0.5, 1, 2);
      g.translate(0, 0.25, 0);
      g.rotateY((i / 3) * Math.PI);
      // normals point up for soft lighting
      const na = g.attributes.normal;
      for (let k = 0; k < na.count; k++) na.setXYZ(k, 0, 1, 0);
      blades.push(g);
    }
    const geo = merge(blades);
    const mat = new THREE.MeshStandardMaterial({ map: getTex('grassBlade'), alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.85, color: 0xcfe0a8 });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = windUniforms.uTime;
      sh.uniforms.uWind = windUniforms.uWind;
      sh.uniforms.uPlayer = grassPlayer;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uWind; uniform vec3 uPlayer; varying float vGy;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
          float hh = position.y;
          vGy = hh / 0.5;
          float ph = uTime * 2.0 + ip.x * 0.15 + ip.z * 0.11;
          float w = (sin(ph) * 0.5 + sin(ph * 2.7) * 0.2 + 0.25) * hh * 0.45 * uWind;
          transformed.x += w; transformed.z += w * 0.5;
          vec2 away = ip.xz - uPlayer.xz; float pd = length(away);
          float push = (1.0 - smoothstep(0.3, 1.6, pd)) * hh * 0.9;
          if (pd > 0.001) { transformed.xz += normalize(away) * push; transformed.y -= push * 0.4; }`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vGy;')
        .replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb *= mix(0.6, 1.2, clamp(vGy, 0.0, 1.0));')
        .replace('#include <normal_fragment_begin>', FOLIAGE_NORMAL);
    };
    mat.customProgramCacheKey = () => 'grass';
    this.mesh = new THREE.InstancedMesh(geo, mat, this.cap);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.cap * 3), 3);
    this.last = new THREE.Vector3(1e9, 0, 0);
  }
  update(camPos) {
    grassPlayer.value.copy(playerPosRef);
    if (camPos.distanceToSquared(this.last) < 16) return;
    this.last.copy(camPos);
    const T = this.terrain, R = this.radius, sp = 0.85 / Math.sqrt(this.density);
    const arr = this.mesh.instanceMatrix.array, col = this.mesh.instanceColor.array;
    let n = 0;
    const x0 = Math.floor((camPos.x - R) / sp), x1 = Math.floor((camPos.x + R) / sp);
    const z0 = Math.floor((camPos.z - R) / sp), z1 = Math.floor((camPos.z + R) / sp);
    for (let gz = z0; gz <= z1 && n < this.cap; gz++) for (let gx = x0; gx <= x1 && n < this.cap; gx++) {
      // deterministic hash per cell
      let hsh = (gx * 374761393 + gz * 668265263) | 0;
      hsh = Math.imul(hsh ^ (hsh >>> 13), 1274126177);
      const r1 = ((hsh >>> 0) % 10000) / 10000, r2 = (((hsh >>> 8) >>> 0) % 10000) / 10000, r3 = (((hsh >>> 16) >>> 0) % 1000) / 1000;
      const x = (gx + r1) * sp, z = (gz + r2) * sp;
      const dx = x - camPos.x, dz = z - camPos.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d > R) continue;
      const y = T.getHeight(x, z);
      if (y < 2.2 || y > 130) continue;
      const road = T.getRoad(x, z);
      if (road > 0.35) continue;
      const fl = T.getFlat(x, z);
      if (fl > 0.6 && r3 > 0.25) continue;
      const nrm = T.getNormal(x, z, _v);
      if (nrm.y < 0.8) continue;
      const fade = 1 - smoothstep(R * 0.7, R, d);
      const s = (0.65 + r3 * 0.6) * (0.25 + 0.75 * fade);
      const rot = r1 * 6.28;
      const c = Math.cos(rot) * s, sn = Math.sin(rot) * s;
      const i = n * 16;
      arr[i] = c; arr[i + 1] = 0; arr[i + 2] = -sn; arr[i + 3] = 0;
      arr[i + 4] = 0; arr[i + 5] = s * (0.7 + r2 * 0.6); arr[i + 6] = 0; arr[i + 7] = 0;
      arr[i + 8] = sn; arr[i + 9] = 0; arr[i + 10] = c; arr[i + 11] = 0;
      arr[i + 12] = x; arr[i + 13] = y - 0.05; arr[i + 14] = z; arr[i + 15] = 1;
      const m = noise.noise2(x * 0.012, z * 0.012) * 0.5 + 0.5;
      col[n * 3] = 0.8 + m * 0.35; col[n * 3 + 1] = 0.95 + r3 * 0.1; col[n * 3 + 2] = 0.7 + m * 0.1;
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }
}
const _v = new THREE.Vector3();
export const grassPlayer = { value: new THREE.Vector3() };
export const playerPosRef = new THREE.Vector3();
