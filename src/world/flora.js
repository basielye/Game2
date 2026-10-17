// Realistic flora: EZ-Tree generated rainforest trees (photographic bark & leaves), palms, ferns,
// with 3 LODs (full mesh → simplified mesh → baked billboard impostor) and physically-motivated foliage shading:
// wind sway + flutter, consistent (non-flipping) normals on double-sided cards and sun translucency.
import * as THREE from 'three';
import { MeshoptSimplifier } from 'meshoptimizer';
import { Tree } from '../vendor/ez-tree/tree.js';
import { TreePreset } from '../vendor/ez-tree/presets/index.js';
import { loadImage, texture } from '../core/assets.js';
import { mulberry32 } from '../core/noise.js';
import { taperTube, frondStrip, merge } from './geom.js';

export const foliageUniforms = { uTime: { value: 0 }, uWind: { value: 1 }, uSunView: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(1, 1, 1) } };

// Shared foliage shader: wind, stable normals, translucency.
export function foliageMaterial(params, { sway = 1, flutter = 1, translucency = 0.6, key = 'f' } = {}) {
  const m = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, alphaTest: 0.45, alphaToCoverage: true, roughness: 0.62, metalness: 0, ...params });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, foliageUniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uWind;\nvarying float vFolH;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      {
        vec3 base = vec3(0.0);
        #ifdef USE_INSTANCING
          base = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
        #endif
        float h = max(0.0, position.y);
        vFolH = h;
        float ph = uTime * 0.9 + base.x * 0.05 + base.z * 0.04;
        float gust = 0.6 + 0.4 * sin(uTime * 0.31 + base.x * 0.01);
        float sway = (sin(ph) * 0.7 + sin(ph * 2.13 + 1.3) * 0.3) * h * h * 0.0016 * ${sway.toFixed(3)} * uWind * gust;
        transformed.x += sway; transformed.z += sway * 0.7;
        float fl = sin(uTime * 6.0 + dot(position, vec3(2.3, 1.7, 2.9)) + base.x) * 0.025 * ${flutter.toFixed(3)} * uWind * min(h * 0.25, 1.0);
        transformed += normal * fl;
      }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uSunView; uniform vec3 uSunCol;\nvarying float vFolH;')
      .replace('#include <normal_fragment_begin>', `float faceDirection = 1.0;\nvec3 normal = normalize(vNormal);\nvec3 nonPerturbedNormal = normal;`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      {
        // light transmitted through thin leaves when looking towards the sun
        vec3 V = normalize(vViewPosition);
        float back = pow(clamp(dot(-V, uSunView), 0.0, 1.0), 3.0);
        float wrap = clamp(dot(-normal, uSunView) * 0.5 + 0.5, 0.0, 1.0);
        reflectedLight.directDiffuse += diffuseColor.rgb * uSunCol * (back * 0.9 + wrap * 0.25) * ${translucency.toFixed(3)};
        // multiple scattering inside the canopy keeps shaded leaves from going black
        reflectedLight.indirectDiffuse *= 1.7;
      }`);
  };
  m.customProgramCacheKey = () => 'foliage-' + key;
  return m;
}

function simplify(g, ratio, err = 0.05) {
  if (!g.index) return g;
  const idx = g.index.array instanceof Uint32Array ? g.index.array : new Uint32Array(g.index.array);
  const [out] = MeshoptSimplifier.simplify(idx, g.attributes.position.array, 3, Math.max(36, Math.floor((idx.length * ratio) / 3) * 3), err, ['LockBorder']);
  const s = g.clone(); s.setIndex(new THREE.BufferAttribute(out, 1)); return s;
}

// keep a random subset of leaf quads (each leaf = 2 planes x 4 verts / 12 indices in EZ-Tree 'double' mode)
function thinLeaves(g, keep, rng, grow = 1.25) {
  const src = g.index.array, per = 12;
  const out = [];
  const pos = g.attributes.position;
  const p = new THREE.Vector3(), c = new THREE.Vector3();
  const scaled = g.clone();
  const sp = scaled.attributes.position;
  for (let i = 0; i < src.length; i += per) {
    if (rng() > keep) continue;
    for (let k = 0; k < per; k++) out.push(src[i + k]);
    // enlarge the surviving leaves to keep canopy density
    const verts = new Set(); for (let k = 0; k < per; k++) verts.add(src[i + k]);
    c.set(0, 0, 0); verts.forEach((v) => c.add(p.fromBufferAttribute(pos, v))); c.divideScalar(verts.size);
    verts.forEach((v) => { p.fromBufferAttribute(pos, v).sub(c).multiplyScalar(grow).add(c); sp.setXYZ(v, p.x, p.y, p.z); });
  }
  scaled.setIndex(new THREE.BufferAttribute(new Uint32Array(out), 1));
  return scaled;
}

// Bake a camera-facing billboard of a tree into a texture; returns crossed-quad geometry for far LOD.
function bakeImpostor(renderer, parts, height, width) {
  const size = 512;
  const rt = new THREE.WebGLRenderTarget(size, size, { samples: 4 });
  const scene = new THREE.Scene();
  const flat = parts.map(({ geo, mat }) => new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: mat.map, color: mat.color, alphaTest: 0.4, side: THREE.DoubleSide })));
  flat.forEach((m) => scene.add(m));
  const half = Math.max(width, height) * 0.52;
  const cam = new THREE.OrthographicCamera(-half, half, height / 2 + half, height / 2 - half, -200, 200);
  cam.position.set(0, 0, 50); cam.lookAt(0, 0, 0);
  const prev = renderer.getRenderTarget(), pc = renderer.getClearColor(new THREE.Color()), pa = renderer.getClearAlpha();
  renderer.setRenderTarget(rt); renderer.setClearColor(0x3a4a2a, 0); renderer.clear(); renderer.render(scene, cam);
  // read back to a CanvasTexture (so the RT can be freed and mipmaps generated)
  const buf = new Uint8Array(size * size * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, size, size, buf);
  renderer.setRenderTarget(prev); renderer.setClearColor(pc, pa);
  rt.dispose(); flat.forEach((m) => m.material.dispose());
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const ctx = cv.getContext('2d'); const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) img.data.set(buf.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const quads = [];
  for (let i = 0; i < 3; i++) { const q = new THREE.PlaneGeometry(half * 2, half * 2); q.translate(0, height / 2, 0); q.rotateY((i / 3) * Math.PI); quads.push(q); }
  const g = merge(quads);
  const pa2 = g.attributes.position, na = g.attributes.normal;
  for (let k = 0; k < pa2.count; k++) { const n = new THREE.Vector3(pa2.getX(k), Math.max(0.2, pa2.getY(k) - height * 0.35), pa2.getZ(k)).normalize(); na.setXYZ(k, n.x, n.y, n.z); }
  return { geo: g, mat: foliageMaterial({ map: tex, alphaTest: 0.5 }, { sway: 0.4, flutter: 0, translucency: 0.3, key: 'imp' }) };
}

function ezTree(presetName, tweak, seed) {
  const t = new Tree();
  t.options.copy(structuredClone(TreePreset[presetName]));
  t.options.seed = seed;
  tweak(t.options);
  t.generate();
  return { branches: t.branchesMesh.geometry, leaves: t.leavesMesh.geometry };
}

export async function buildFlora(renderer, quality) {
  await MeshoptSimplifier.ready;
  const L = async (n, srgb = true) => texture(await loadImage('textures/flora/' + n), srgb);
  const [oakC, oakN, oakR, oakAO, wilC, wilN, wilR, pineC, pineN, ash, oak, frond, grass] = await Promise.all([
    L('bark_oak_color.jpg'), L('bark_oak_normal.jpg', false), L('bark_oak_roughness.jpg', false), L('bark_oak_ao.jpg', false),
    L('bark_willow_color.jpg'), L('bark_willow_normal.jpg', false), L('bark_willow_roughness.jpg', false),
    L('bark_pine_color.jpg'), L('bark_pine_normal.jpg', false),
    L('leaves_ash.webp'), L('leaves_oak.webp'), L('palm_frond.webp'), L('grass_card.webp'),
  ]);
  for (const t of [ash, oak, frond, grass]) { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; }
  frond.wrapS = THREE.ClampToEdgeWrapping;
  const barkMat = (c, n, r, ao, tint = 0xffffff, rep = [1, 4]) => {
    const m = new THREE.MeshStandardMaterial({ map: c.clone(), normalMap: n.clone(), roughnessMap: r ? r.clone() : null, aoMap: ao ? ao.clone() : null, color: tint, roughness: 1, normalScale: new THREE.Vector2(1.4, 1.4) });
    for (const t of [m.map, m.normalMap, m.roughnessMap, m.aoMap]) if (t) { t.repeat.set(rep[0], rep[1]); t.needsUpdate = true; }
    return m;
  };
  const M = {
    bark: barkMat(oakC, oakN, oakR, oakAO, 0xb9ac98, [0.5, 3]),
    barkSmooth: barkMat(wilC, wilN, wilR, null, 0xc8bca8, [0.6, 3]),
    palmBark: barkMat(wilC, wilN, wilR, null, 0xa89880, [1, 6]),
    pineBark: barkMat(pineC, pineN, null, null, 0xffffff, [0.5, 3]),
    canopy: foliageMaterial({ map: ash, color: 0x9db87a }, { key: 'canopy', sway: 1, flutter: 1 }),
    canopyDark: foliageMaterial({ map: oak, color: 0x86a86a }, { key: 'canopy2', sway: 1, flutter: 1 }),
    frond: foliageMaterial({ map: frond, color: 0xdbe6c2, alphaTest: 0.5 }, { key: 'frond', sway: 1.6, flutter: 1.3, translucency: 0.8 }),
    fern: foliageMaterial({ map: frond, color: 0xa8c488 }, { key: 'fern', sway: 0.5, flutter: 1.2, translucency: 0.7 }),
    grass,
  };
  const rng = mulberry32(2024);
  const out = {};
  const big = quality.lod >= 1;

  // --- rainforest canopy trees (EZ-Tree, tuned towards tall straight trunks and umbrella crowns) ---
  const makeTree = (preset, tweak, seed, targetH, leafMat, barkM, lodDist) => {
    const { branches, leaves } = ezTree(preset, tweak, seed);
    branches.computeBoundingBox();
    const h0 = branches.boundingBox.max.y;
    const k = targetH / h0;
    branches.scale(k, k, k); leaves.scale(k, k, k);
    leaves.computeBoundingBox();
    const w = Math.max(leaves.boundingBox.max.x - leaves.boundingBox.min.x, leaves.boundingBox.max.z - leaves.boundingBox.min.z);
    const midB = simplify(branches, 0.1, 0.08), midL = thinLeaves(leaves, 0.2, rng, 1.6);
    const imp = bakeImpostor(renderer, [{ geo: branches, mat: barkM }, { geo: leaves, mat: leafMat }], targetH, w);
    return {
      near: [{ geo: branches, mat: barkM }, { geo: leaves, mat: leafMat }],
      mid: [{ geo: midB, mat: barkM }, { geo: midL, mat: leafMat }],
      far: [imp],
      radius: 0.45 * (targetH / 18), height: targetH, tris: (branches.index.count + leaves.index.count) / 3, lodDist,
    };
  };
  const tropical = (o, spread) => {
    o.branch.levels = 3;
    o.branch.start[1] = 0.5 + spread * 0.15;
    o.branch.angle[1] = 58 + spread * 12; o.branch.angle[2] = 45;
    o.branch.children[0] = 8; o.branch.children[1] = 4; o.branch.children[2] = big ? 3 : 2;
    o.branch.sections[0] = 10; o.branch.sections[1] = 6; o.branch.sections[2] = 4; o.branch.sections[3] = 3;
    o.branch.segments[0] = 8; o.branch.segments[1] = 5; o.branch.segments[2] = 3; o.branch.segments[3] = 3;
    o.branch.force.strength = 0.01;
    o.leaves.count = big ? 14 : 10; o.leaves.size = 4.2; o.leaves.angle = 40;
  };
  out.jungle = [
    makeTree('Ash Large', (o) => tropical(o, 0.2), 101, 21, M.canopy, M.bark),
    makeTree('Ash Large', (o) => tropical(o, 0.8), 202, 24, M.canopy, M.bark),
    makeTree('Oak Large', (o) => { tropical(o, 0.5); o.leaves.type = 'oak'; }, 303, 19, M.canopyDark, M.barkSmooth),
  ];
  out.jungleBig = [
    makeTree('Ash Large', (o) => { tropical(o, 1); o.branch.length[0] = 60; o.branch.radius[0] = 4; }, 404, 32, M.canopy, M.bark),
    makeTree('Oak Large', (o) => { tropical(o, 1); o.branch.length[0] = 58; o.branch.radius[0] = 4.5; }, 505, 30, M.canopyDark, M.barkSmooth),
  ];
  out.conifer = [
    makeTree('Pine Large', (o) => { o.branch.children[0] = big ? 70 : 45; o.leaves.count = big ? 14 : 10; }, 606, 20, foliageMaterial({ map: (await L('leaves_ash.webp')), color: 0x5f7d4f }, { key: 'pine', sway: 0.5 }), M.pineBark),
  ];
  out.bush = [1, 2, 3].map((n, i) => {
    const { branches, leaves } = ezTree(`Bush ${n}`, (o) => { o.leaves.count = big ? 12 : 8; }, 700 + i);
    branches.computeBoundingBox();
    const k = 2.2 / Math.max(1, branches.boundingBox.max.y);
    branches.scale(k, k, k); leaves.scale(k, k, k);
    const lv = leaves.index.count / 3 > 4000 ? thinLeaves(leaves, 4000 / (leaves.index.count / 3), rng, 1.25) : leaves;
    return { near: [{ geo: lv, mat: i === 1 ? M.canopyDark : M.canopy }], far: [], radius: 0 };
  });

  // --- palms: curved ringed trunks + photographic-style fronds ---
  const palm = (seed) => {
    const r = mulberry32(seed);
    const h = 10 + r() * 4, lean = 1.5 + r() * 2.5;
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, -0.5, 0), new THREE.Vector3(lean * 0.15, h * 0.35, 0), new THREE.Vector3(lean * 0.55, h * 0.72, 0), new THREE.Vector3(lean, h, 0)]);
    const trunk = taperTube(curve, 24, 10, (t) => 0.34 - t * 0.13 + (Math.sin(t * 90) > 0.6 ? 0.012 : 0), { uvScale: 1 });
    const top = new THREE.Vector3(lean, h, 0);
    const fr = [];
    const nF = 14;
    for (let i = 0; i < nF; i++) {
      const yaw = (i / nF) * Math.PI * 2 + r() * 0.35;
      const young = i % 4 === 0;
      fr.push(frondStrip(top, yaw, (young ? 4 : 5.2) + r() * 1.3, 2.3, young ? 0.25 : 0.85 + r() * 0.4, young ? 0.7 : 0.32, 10, 0.12));
    }
    const crown = merge(fr);
    const midCrown = merge(fr.filter((_, i) => i % 2 === 0));
    const midTrunk = taperTube(curve, 6, 6, (t) => 0.34 - t * 0.13);
    const imp = bakeImpostor(renderer, [{ geo: trunk, mat: M.palmBark }, { geo: crown, mat: M.frond }], h + 2, 11);
    return { near: [{ geo: trunk, mat: M.palmBark }, { geo: crown, mat: M.frond }], mid: [{ geo: midTrunk, mat: M.palmBark }, { geo: midCrown, mat: M.frond }], far: [imp], radius: 0.35 };
  };
  out.palm = [palm(11), palm(22), palm(33)];

  // --- tree ferns and ground ferns (pinnate leaf cards along arching fronds) ---
  const fernGeo = (seed, count, len, height, top) => {
    const r = mulberry32(seed); const parts = [];
    for (let i = 0; i < count; i++) parts.push(frondStrip(new THREE.Vector3(top.x, top.y, top.z), (i / count) * Math.PI * 2 + r() * 0.4, len * (0.8 + r() * 0.4), len * 0.42, 0.9, height, 7, 0.15));
    return merge(parts);
  };
  out.treefern = [44, 55].map((s) => {
    const r = mulberry32(s); const h = 2.8 + r() * 2.2;
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, -0.3, 0), new THREE.Vector3(0.15, h * 0.5, 0), new THREE.Vector3(0.25 * r(), h, 0)]);
    const trunk = taperTube(curve, 8, 7, (t) => 0.2 - t * 0.05, { uvScale: 1 });
    return { near: [{ geo: trunk, mat: M.palmBark }, { geo: fernGeo(s, 13, 3.0, 0.5, curve.getPointAt(1)), mat: M.frond }], far: [], radius: 0.25 };
  });
  out.fern = [66, 77].map((s) => ({ near: [{ geo: fernGeo(s, 10, 1.5, 0.8, new THREE.Vector3(0, 0.05, 0)), mat: M.fern }], far: [], radius: 0 }));
  out.materials = M;
  return out;
}
