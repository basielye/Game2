// Procedural dinosaur models. Each species is a spine profile (tail → snout) + legs + extras, skinned to a bone chain.
import * as THREE from 'three';
import { RigBuilder, limb, ellipsoid } from './rig.js';
import { getTex } from '../core/textures.js';
import { noise } from '../core/noise.js';

// Spine control points: [z, y, halfWidth, halfHeight]. Bones: [name, z] (z must lie within spine range).
export const SPECIES = {
  raptor: {
    label: 'Velociraptor', len: 1,
    spine: [[-2.25, 1.0, 0.02, 0.02], [-1.7, 1.03, 0.07, 0.08], [-1.05, 1.09, 0.13, 0.15], [-0.4, 1.12, 0.21, 0.25], [0.15, 1.1, 0.23, 0.29], [0.55, 1.16, 0.17, 0.21], [0.85, 1.32, 0.09, 0.1], [1.02, 1.44, 0.08, 0.095], [1.16, 1.5, 0.1, 0.11], [1.4, 1.46, 0.075, 0.075], [1.62, 1.41, 0.04, 0.045]],
    bones: [['tail4', -1.75], ['tail3', -1.25], ['tail2', -0.8], ['tail1', -0.35], ['pelvis', -0.15], ['chest', 0.45], ['neck1', 0.78], ['neck2', 0.98], ['head', 1.14]],
    hind: { z: -0.18, x: 0.17, y: 1.08, thigh: 0.42, shin: 0.48, meta: 0.32, r: 0.13, foot: 'claw' },
    arms: { z: 0.55, x: 0.13, y: 1.05, len: 0.28, r: 0.04 },
    jaw: { z: 1.12, y: 1.41, len: 0.5, w: 0.07, h: 0.05 }, teeth: true, eye: { z: 1.24, y: 1.53, x: 0.07, r: 0.022, color: 0xd8a020 },
    colors: { back: 0x6b5a3a, belly: 0xc8b48a, stripe: 0x3a2c1c, pattern: 'stripes' }, feathers: true,
  },
  trex: {
    label: 'Tyrannosaurus Rex', len: 1,
    spine: [[-6.5, 3.2, 0.06, 0.06], [-5.0, 3.35, 0.25, 0.3], [-3.2, 3.6, 0.5, 0.6], [-1.3, 3.85, 0.85, 1.0], [0.4, 3.75, 0.95, 1.15], [1.7, 3.85, 0.75, 0.9], [2.5, 4.2, 0.48, 0.6], [3.0, 4.5, 0.5, 0.6], [3.5, 4.65, 0.55, 0.62], [4.3, 4.45, 0.42, 0.42], [5.0, 4.2, 0.25, 0.26]],
    bones: [['tail4', -5.0], ['tail3', -3.6], ['tail2', -2.3], ['tail1', -1.1], ['pelvis', -0.6], ['chest', 1.2], ['neck1', 2.2], ['neck2', 2.8], ['head', 3.15]],
    hind: { z: -0.7, x: 0.75, y: 3.5, thigh: 1.6, shin: 1.5, meta: 0.9, r: 0.55, foot: 'claw' },
    arms: { z: 1.6, x: 0.55, y: 3.2, len: 0.7, r: 0.09 },
    jaw: { z: 3.05, y: 4.25, len: 1.95, w: 0.4, h: 0.26 }, teeth: true, eye: { z: 3.6, y: 4.88, x: 0.4, r: 0.07, color: 0xc89020 },
    colors: { back: 0x4a4036, belly: 0x8a7a62, stripe: 0x2e2620, pattern: 'mottled' },
  },
  compy: {
    label: 'Compsognathus', len: 1,
    spine: [[-0.62, 0.26, 0.008, 0.008], [-0.42, 0.27, 0.02, 0.022], [-0.2, 0.28, 0.04, 0.045], [0.0, 0.28, 0.06, 0.07], [0.15, 0.3, 0.045, 0.055], [0.24, 0.38, 0.022, 0.025], [0.3, 0.43, 0.024, 0.026], [0.38, 0.43, 0.026, 0.025], [0.46, 0.41, 0.012, 0.013]],
    bones: [['tail2', -0.38], ['tail1', -0.15], ['pelvis', -0.05], ['chest', 0.12], ['neck1', 0.22], ['head', 0.3]],
    hind: { z: -0.04, x: 0.05, y: 0.27, thigh: 0.12, shin: 0.12, meta: 0.08, r: 0.035, foot: 'claw' },
    arms: { z: 0.14, x: 0.035, y: 0.26, len: 0.07, r: 0.01 },
    jaw: { z: 0.3, y: 0.41, len: 0.15, w: 0.018, h: 0.012 }, teeth: false, eye: { z: 0.34, y: 0.445, x: 0.02, r: 0.008, color: 0x101010 },
    colors: { back: 0x5a7a3a, belly: 0xb8c890, stripe: 0x2a3a1a, pattern: 'stripes' },
  },
  gallimimus: {
    label: 'Gallimimus', len: 1,
    spine: [[-2.4, 1.6, 0.02, 0.02], [-1.7, 1.65, 0.07, 0.08], [-0.9, 1.72, 0.15, 0.17], [-0.2, 1.75, 0.24, 0.27], [0.35, 1.75, 0.22, 0.26], [0.7, 1.9, 0.12, 0.13], [1.0, 2.3, 0.07, 0.07], [1.2, 2.75, 0.06, 0.06], [1.35, 2.95, 0.07, 0.07], [1.55, 2.95, 0.05, 0.045], [1.75, 2.88, 0.02, 0.02]],
    bones: [['tail4', -1.8], ['tail3', -1.3], ['tail2', -0.85], ['tail1', -0.4], ['pelvis', -0.2], ['chest', 0.5], ['neck1', 0.85], ['neck2', 1.15], ['head', 1.32]],
    hind: { z: -0.15, x: 0.18, y: 1.7, thigh: 0.65, shin: 0.75, meta: 0.55, r: 0.14, foot: 'claw' },
    arms: { z: 0.5, x: 0.14, y: 1.6, len: 0.4, r: 0.035 },
    jaw: { z: 1.32, y: 2.9, len: 0.4, w: 0.04, h: 0.03 }, teeth: false, beak: true, eye: { z: 1.4, y: 2.99, x: 0.055, r: 0.02, color: 0x1a1008 },
    colors: { back: 0x8a6a3a, belly: 0xd8c8a0, stripe: 0x6a4a2a, pattern: 'spots' },
  },
  dilo: {
    label: 'Dilophosaurus', len: 1,
    spine: [[-1.9, 0.9, 0.02, 0.02], [-1.4, 0.93, 0.06, 0.07], [-0.85, 0.98, 0.12, 0.14], [-0.3, 1.0, 0.19, 0.23], [0.2, 1.0, 0.2, 0.25], [0.55, 1.1, 0.13, 0.16], [0.8, 1.35, 0.07, 0.08], [0.95, 1.5, 0.075, 0.08], [1.1, 1.55, 0.085, 0.09], [1.3, 1.5, 0.06, 0.06], [1.45, 1.45, 0.03, 0.035]],
    bones: [['tail4', -1.45], ['tail3', -1.0], ['tail2', -0.65], ['tail1', -0.3], ['pelvis', -0.1], ['chest', 0.4], ['neck1', 0.7], ['neck2', 0.9], ['head', 1.03]],
    hind: { z: -0.1, x: 0.15, y: 0.98, thigh: 0.38, shin: 0.42, meta: 0.3, r: 0.12, foot: 'claw' },
    arms: { z: 0.45, x: 0.12, y: 0.95, len: 0.25, r: 0.035 },
    jaw: { z: 1.03, y: 1.46, len: 0.42, w: 0.06, h: 0.04 }, teeth: true, eye: { z: 1.14, y: 1.58, x: 0.07, r: 0.02, color: 0x101010 },
    colors: { back: 0x5a6a2a, belly: 0xd8c860, stripe: 0x2a3014, pattern: 'spots' }, crests: true, frill: true,
  },
  trike: {
    label: 'Triceratops', len: 1, quad: true,
    spine: [[-4.3, 1.5, 0.05, 0.05], [-3.3, 1.75, 0.25, 0.28], [-2.2, 2.1, 0.6, 0.62], [-0.8, 2.35, 1.0, 0.92], [0.6, 2.3, 1.05, 0.9], [1.8, 2.05, 0.8, 0.75], [2.55, 1.85, 0.6, 0.62], [3.2, 1.78, 0.72, 0.7], [3.95, 1.5, 0.5, 0.46], [4.6, 1.22, 0.22, 0.2]],
    bones: [['tail3', -3.4], ['tail2', -2.6], ['tail1', -1.8], ['pelvis', -1.0], ['chest', 1.0], ['neck1', 2.2], ['head', 2.7]],
    hind: { z: -1.1, x: 0.78, y: 2.0, thigh: 1.0, shin: 0.85, meta: 0.25, r: 0.5, foot: 'elephant' },
    front: { z: 1.6, x: 0.85, y: 1.6, thigh: 0.75, shin: 0.75, meta: 0.15, r: 0.4, foot: 'elephant' },
    jaw: { z: 3.1, y: 1.4, len: 1.2, w: 0.3, h: 0.18 }, teeth: false, beak: true, eye: { z: 3.35, y: 1.88, x: 0.43, r: 0.05, color: 0x1a1008 },
    colors: { back: 0x6a5a48, belly: 0xa89a80, stripe: 0x4a3a2a, pattern: 'mottled' }, horns: true, bigFrill: true,
  },
  stego: {
    label: 'Stegosaurus', len: 1, quad: true,
    spine: [[-4.5, 1.4, 0.05, 0.05], [-3.4, 1.85, 0.22, 0.25], [-2.2, 2.45, 0.5, 0.6], [-0.8, 2.85, 0.85, 0.95], [0.6, 2.65, 0.85, 0.9], [1.7, 2.05, 0.55, 0.6], [2.5, 1.5, 0.25, 0.28], [3.0, 1.25, 0.2, 0.22], [3.5, 1.15, 0.18, 0.17], [3.85, 1.05, 0.08, 0.08]],
    bones: [['tail3', -3.6], ['tail2', -2.7], ['tail1', -1.8], ['pelvis', -0.9], ['chest', 1.0], ['neck1', 2.1], ['head', 2.9]],
    hind: { z: -0.9, x: 0.6, y: 2.2, thigh: 1.1, shin: 0.95, meta: 0.25, r: 0.36, foot: 'elephant' },
    front: { z: 1.4, x: 0.55, y: 1.6, thigh: 0.7, shin: 0.7, meta: 0.15, r: 0.24, foot: 'elephant' },
    jaw: { z: 3.0, y: 1.08, len: 0.7, w: 0.12, h: 0.07 }, teeth: false, beak: true, eye: { z: 3.15, y: 1.25, x: 0.16, r: 0.035, color: 0x1a1008 },
    colors: { back: 0x5a6a52, belly: 0xb0a888, stripe: 0x7a4a2a, pattern: 'mottled' }, plates: true,
  },
  para: {
    label: 'Parasaurolophus', len: 1, quad: true,
    spine: [[-4.6, 2.0, 0.05, 0.05], [-3.4, 2.25, 0.24, 0.3], [-2.0, 2.55, 0.5, 0.6], [-0.6, 2.75, 0.75, 0.85], [0.8, 2.6, 0.7, 0.8], [1.8, 2.6, 0.38, 0.45], [2.4, 3.1, 0.22, 0.25], [2.8, 3.55, 0.22, 0.24], [3.2, 3.65, 0.25, 0.27], [3.7, 3.45, 0.17, 0.15], [4.1, 3.3, 0.1, 0.08]],
    bones: [['tail3', -3.6], ['tail2', -2.6], ['tail1', -1.6], ['pelvis', -0.6], ['chest', 1.0], ['neck1', 2.0], ['neck2', 2.6], ['head', 3.0]],
    hind: { z: -0.6, x: 0.55, y: 2.4, thigh: 1.15, shin: 1.05, meta: 0.55, r: 0.33, foot: 'hoof' },
    front: { z: 1.3, x: 0.45, y: 2.0, thigh: 0.9, shin: 0.85, meta: 0.25, r: 0.15, foot: 'hoof' },
    jaw: { z: 3.15, y: 3.38, len: 0.85, w: 0.13, h: 0.08 }, teeth: false, beak: true, eye: { z: 3.3, y: 3.75, x: 0.22, r: 0.04, color: 0x1a1008 },
    colors: { back: 0x8a5a3a, belly: 0xd0b890, stripe: 0x5a2a1a, pattern: 'stripes' }, crest: true,
  },
  brachio: {
    label: 'Brachiosaurus', len: 1, quad: true,
    spine: [[-9.5, 4.0, 0.08, 0.08], [-7.5, 4.6, 0.35, 0.4], [-5.2, 5.4, 0.8, 0.9], [-2.8, 6.3, 1.5, 1.6], [0, 6.8, 1.8, 1.85], [2.4, 7.3, 1.4, 1.5], [3.8, 8.6, 0.75, 0.8], [4.8, 10.8, 0.48, 0.5], [5.6, 13.0, 0.36, 0.38], [6.2, 14.6, 0.34, 0.36], [6.7, 15.2, 0.38, 0.42], [7.3, 15.0, 0.28, 0.3], [7.75, 14.75, 0.14, 0.14]],
    bones: [['tail4', -7.5], ['tail3', -6.0], ['tail2', -4.5], ['tail1', -3.0], ['pelvis', -1.8], ['chest', 2.0], ['neck1', 3.6], ['neck2', 4.8], ['neck3', 5.8], ['head', 6.45]],
    hind: { z: -1.8, x: 1.2, y: 5.6, thigh: 2.9, shin: 2.4, meta: 0.4, r: 0.75, foot: 'elephant' },
    front: { z: 2.4, x: 1.3, y: 6.2, thigh: 3.3, shin: 2.8, meta: 0.4, r: 0.65, foot: 'elephant' },
    jaw: { z: 6.65, y: 14.85, len: 1.0, w: 0.26, h: 0.14 }, teeth: false, eye: { z: 6.8, y: 15.35, x: 0.33, r: 0.07, color: 0x1a1008 },
    colors: { back: 0x6a6a5a, belly: 0xa8a08a, stripe: 0x4a4a3a, pattern: 'mottled' }, nasal: true,
  },
};

let skinMat = null;
function dinoMaterial() {
  if (!skinMat) {
    skinMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.0, normalMap: getTex('scales'), normalScale: new THREE.Vector2(0.9, 0.9) });
  }
  return skinMat;
}

function catmull(points, t) {
  // uniform Catmull-Rom over an array of numbers per component
  const n = points.length - 1;
  const f = t * n;
  const i = Math.min(n - 1, Math.floor(f));
  const u = f - i;
  const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(n, i + 2)];
  const out = [];
  for (let k = 0; k < p1.length; k++) {
    const a = p0[k], b = p1[k], c = p2[k], d = p3[k];
    out.push(0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u));
  }
  return out;
}

export function buildDino(kind, scale = 1, tint = 0) {
  const S = SPECIES[kind];
  const R = new RigBuilder();
  const sc = scale;
  // ---- bones along spine ----
  const spineAt = (z) => {
    // find y at z by sampling
    let best = S.spine[0];
    for (let i = 0; i < 200; i++) { const p = catmull(S.spine, i / 199); if (Math.abs(p[0] - z) < Math.abs(best[0] - z)) best = p; }
    return best;
  };
  const boneDefs = S.bones.map(([name, z]) => ({ name, z, y: spineAt(z)[1] }));
  const pelvisIdx = boneDefs.findIndex((b) => b.name === 'pelvis');
  const made = {};
  const pel = boneDefs[pelvisIdx];
  made.pelvis = R.bone('pelvis', null, 0, pel.y * sc, pel.z * sc);
  // tail chain (going backwards from pelvis)
  let parent = made.pelvis, pz = pel.z, py = pel.y;
  for (let i = pelvisIdx - 1; i >= 0; i--) {
    const d = boneDefs[i];
    made[d.name] = R.bone(d.name, parent, 0, (d.y - py) * sc, (d.z - pz) * sc);
    parent = made[d.name]; pz = d.z; py = d.y;
  }
  parent = made.pelvis; pz = pel.z; py = pel.y;
  for (let i = pelvisIdx + 1; i < boneDefs.length; i++) {
    const d = boneDefs[i];
    made[d.name] = R.bone(d.name, parent, 0, (d.y - py) * sc, (d.z - pz) * sc);
    parent = made[d.name]; pz = d.z; py = d.y;
  }
  if (S.jaw) {
    const hd = boneDefs[boneDefs.length - 1];
    made.jaw = R.bone('jaw', made.head, 0, (S.jaw.y - hd.y) * sc, (S.jaw.z - hd.z) * sc);
  }
  // legs
  const legs = [];
  const mkLeg = (L0, pref, attachName) => {
    const L = { ...L0 };
    const att = made[attachName];
    const ad = boneDefs.find((b) => b.name === attachName);
    for (const [side, sx] of [['L', 1], ['R', -1]]) {
      const hip = R.bone(pref + 'Hip' + side, att, sx * L.x * sc, (L.y - ad.y) * sc, (L.z - ad.z) * sc);
      // rest angles (theropod digitigrade zig-zag vs columnar)
      const columnar = L.foot === 'elephant' || pref === 'f';
      const a1 = columnar ? 0.0 : -0.45, a2 = columnar ? 0.05 : 0.95, a3 = columnar ? -0.05 : -0.8;
      const ext = L.thigh * Math.cos(a1) + L.shin * Math.cos(a1 + a2) + L.meta * Math.cos(a1 + a2 + a3);
      const clear = L.foot === 'claw' ? L.r * 0.12 : L.r * 0.25;
      const k = (L.y - clear) / ext;
      L.thigh *= k; L.shin *= k; L.meta *= k; L._k = true;
      const knee = R.bone(pref + 'Knee' + side, hip, 0, -L.thigh * sc, 0);
      const ankle = R.bone(pref + 'Ankle' + side, knee, 0, -L.shin * sc, 0);
      const toe = R.bone(pref + 'Toe' + side, ankle, 0, -L.meta * sc, 0);
      hip.rotation.x = a1; knee.rotation.x = a2; ankle.rotation.x = a3; toe.rotation.x = -(a1 + a2 + a3);
      legs.push({ hip, knee, ankle, toe, side: sx, front: pref === 'f', L, rest: [a1, a2, a3] });
    }
  };
  mkLeg(S.hind, 'h', 'pelvis');
  if (S.front) mkLeg(S.front, 'f', 'chest');
  let arms = [];
  if (S.arms) {
    const ad = boneDefs.find((b) => b.name === 'chest');
    for (const [side, sx] of [['L', 1], ['R', -1]]) {
      const sh = R.bone('arm' + side, made.chest, sx * S.arms.x * sc, (S.arms.y - ad.y) * sc, (S.arms.z - ad.z) * sc);
      sh.rotation.x = -0.9;
      const el = R.bone('fore' + side, sh, 0, -S.arms.len * 0.5 * sc, 0);
      el.rotation.x = -0.8;
      arms.push({ sh, el, side: sx });
    }
  }
  R.root.updateMatrixWorld(true);

  // ---- colours ----
  const C = S.colors;
  const back = new THREE.Color(C.back), belly = new THREE.Color(C.belly), stripe = new THREE.Color(C.stripe);
  if (tint) { back.offsetHSL(tint * 0.05, 0, tint * 0.04); stripe.offsetHSL(tint * 0.03, 0, 0); }
  const skinColor = (p, n, out) => {
    const up = THREE.MathUtils.clamp(n.y * 0.5 + 0.5, 0, 1);
    out.copy(belly).lerp(back, THREE.MathUtils.smoothstep(up, 0.35, 0.75));
    const z = p.z / sc, x = p.x / sc, y = p.y / sc;
    let pat = 0;
    if (C.pattern === 'stripes') pat = Math.sin(z * 9 / Math.max(0.4, S.hind.thigh * 1.6)) > 0.35 ? 1 : 0;
    else if (C.pattern === 'spots') pat = noise.noise2(z * 6 / S.hind.thigh, (y + x) * 6 / S.hind.thigh) > 0.45 ? 1 : 0;
    else pat = noise.noise2(z * 1.8, (y + x) * 1.8) * 0.5 + 0.5 > 0.62 ? 0.7 : 0;
    pat *= THREE.MathUtils.smoothstep(up, 0.55, 0.85);
    out.lerp(stripe, pat * 0.75);
    const grit = noise.noise2(z * 13, y * 13 + x * 7) * 0.08;
    out.offsetHSL(0, 0, grit);
  };

  // ---- body tube with smooth chain weights ----
  const rings = 56, radial = 16;
  const pos = [], uv = [], idx = [];
  const ringZ = [];
  let arc = 0, prev = null;
  const samples = [];
  for (let i = 0; i <= rings; i++) samples.push(catmull(S.spine, i / rings));
  samples.push([samples[rings][0] + 0.001, samples[rings][1], 0.001, 0.001]);
  for (let i = 0; i < samples.length; i++) {
    const [z, y, w, h] = samples[i];
    const nx = samples[Math.min(samples.length - 1, i + 1)], pv = samples[Math.max(0, i - 1)];
    const tz = nx[0] - pv[0], ty = nx[1] - pv[1];
    const tl = Math.hypot(tz, ty) || 1;
    // normal in YZ plane perpendicular to tangent
    const ny = tz / tl, nz = -ty / tl;
    if (prev) arc += Math.hypot(z - prev[0], y - prev[1]);
    prev = [z, y];
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      // flatter belly: squash lower half slightly
      const hh = sa < 0 ? h * 0.92 : h;
      const px = ca * w, off = sa * hh;
      pos.push(px * sc, (y + ny * off) * sc, (z + nz * off) * sc);
      uv.push((j / radial) * 4, arc * 3 / Math.max(0.3, S.hind.thigh));
    }
    ringZ.push(z);
  }
  for (let i = 0; i < samples.length - 1; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const body = new THREE.BufferGeometry();
  body.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  body.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  body.setIndex(idx);
  body.computeVertexNormals();
  // chain weights: owner = bone whose segment contains z (closer to pelvis)
  const chain = boneDefs.map((b) => ({ ...b, index: made[b.name].userData.index }));
  const parentOf = (i) => (i < pelvisIdx ? i + 1 : i > pelvisIdx ? i - 1 : i);
  const childOf = (i) => (i < pelvisIdx ? i - 1 : i > pelvisIdx ? i + 1 : -1);
  const weightFn = (p) => {
    const z = p.z / sc;
    let owner = pelvisIdx;
    if (z < chain[pelvisIdx].z) { for (let i = pelvisIdx - 1; i >= 0; i--) if (z <= chain[i].z) owner = i; }
    else { for (let i = pelvisIdx + 1; i < chain.length; i++) if (z >= chain[i].z) owner = i; }
    const W = new Map();
    const add = (bi, w) => W.set(bi, (W.get(bi) || 0) + w);
    let wo = 1;
    // blend with parent near the owner's own joint
    if (owner !== pelvisIdx) {
      const par = parentOf(owner);
      const seg = Math.abs(chain[owner].z - chain[par].z);
      const d = Math.abs(z - chain[owner].z) / Math.max(0.01, seg);
      const k = 0.5 + 0.5 * THREE.MathUtils.smoothstep(d, 0, 0.4);
      add(chain[par].index, wo * (1 - k)); wo *= k;
    }
    // blend with child near the child's joint (on the owner side)
    const ch = owner === pelvisIdx ? (z < chain[pelvisIdx].z ? pelvisIdx - 1 : pelvisIdx + 1) : childOf(owner);
    if (ch >= 0 && ch < chain.length) {
      const seg = Math.abs(chain[ch].z - chain[owner].z);
      const e = Math.abs(chain[ch].z - z) / Math.max(0.01, seg);
      const k = 0.5 * (1 - THREE.MathUtils.smoothstep(e, 0, 0.4));
      add(chain[ch].index, wo * k); wo *= 1 - k;
    }
    add(chain[owner].index, wo);
    return [...W.entries()].slice(0, 4);
  };
  R.skinned(body, weightFn, skinColor);

  const dark = new THREE.Color(C.back).multiplyScalar(0.7);
  const legBase = back.clone().lerp(belly, 0.12).multiplyScalar(0.9);
  const legColor = (p, n, out) => {
    out.copy(legBase);
    const z = p.z / sc, y = p.y / sc;
    out.offsetHSL(0, 0, noise.noise2(z * 11, y * 11 + p.x) * 0.06 - (n.y < -0.3 ? 0.04 : 0));
  };
  const claw = new THREE.Color(0x2a2620);
  // ---- legs ----
  for (const lg of legs) {
    const L = lg.L;
    const thigh = limb(L.thigh * sc, L.r * sc * (lg.front ? 1 : 1.25), L.r * 0.6 * sc, 10, 5, lg.front ? 0.05 : 0.25);
    R.rigid(thigh, lg.hip, legColor);
    if (!lg.front && L.foot !== 'elephant') {
      const muscle = ellipsoid(L.r * 1.25 * sc, L.thigh * 0.55 * sc, L.r * 1.35 * sc); muscle.translate(0, -L.thigh * 0.3 * sc, 0);
      R.rigid(muscle, lg.hip, legColor);
    }
    R.rigid(limb(L.shin * sc, L.r * 0.62 * sc, L.r * 0.42 * sc, 8, 4), lg.knee, legColor);
    R.rigid(limb(L.meta * sc, L.r * 0.4 * sc, L.r * 0.34 * sc, 7, 3), lg.ankle, legColor);
    if (L.foot === 'claw') {
      for (const tx of [-1, 0, 1]) {
        const t = limb(L.r * 1.5 * sc, L.r * 0.18 * sc, L.r * 0.1 * sc, 5, 2);
        t.rotateX(-Math.PI / 2 + 0.1); t.rotateY(tx * 0.35); t.translate(0, -L.r * 0.1 * sc, 0);
        R.rigid(t, lg.toe, legColor);
        const cl = new THREE.ConeGeometry(L.r * 0.08 * sc, L.r * 0.4 * sc, 5); cl.rotateX(Math.PI / 2 + 0.4);
        cl.translate(Math.sin(tx * 0.35) * L.r * 1.5 * sc, -L.r * 0.15 * sc, Math.cos(tx * 0.35) * L.r * 1.55 * sc);
        R.rigid(cl, lg.toe, claw);
      }
      if (kind === 'raptor') {
        const sickle = new THREE.ConeGeometry(L.r * 0.12 * sc, L.r * 0.7 * sc, 5); sickle.rotateX(-0.6); sickle.translate(L.r * 0.15 * sc, L.r * 0.3 * sc, L.r * 0.4 * sc);
        R.rigid(sickle, lg.toe, claw);
      }
    } else {
      const ft = new THREE.CylinderGeometry(L.r * 0.5 * sc, L.r * 0.6 * sc, L.r * 0.4 * sc, 10);
      ft.translate(0, -L.r * 0.05 * sc, L.r * 0.1 * sc);
      R.rigid(ft, lg.toe, dark);
      if (L.foot === 'elephant') for (const tx of [-1, 0, 1]) { const n = ellipsoid(L.r * 0.13 * sc, L.r * 0.1 * sc, L.r * 0.1 * sc); n.translate(tx * L.r * 0.3 * sc, -L.r * 0.15 * sc, L.r * 0.6 * sc); R.rigid(n, lg.toe, claw); }
    }
  }
  for (const ar of arms) {
    const A = S.arms;
    R.rigid(limb(A.len * 0.5 * sc, A.r * 1.3 * sc, A.r * sc, 6, 3), ar.sh, legColor);
    R.rigid(limb(A.len * 0.5 * sc, A.r * sc, A.r * 0.7 * sc, 6, 3), ar.el, legColor);
    for (const k of [-1, 1]) { const c = new THREE.ConeGeometry(A.r * 0.35 * sc, A.r * 2 * sc, 4); c.rotateX(Math.PI + 0.5); c.translate(k * A.r * 0.4 * sc, -A.len * 0.55 * sc, A.r * 0.4 * sc); R.rigid(c, ar.el, claw); }
  }
  // ---- head details ----
  const hd = boneDefs[boneDefs.length - 1];
  const toHead = (geo) => { geo.translate(0, -hd.y * sc, -hd.z * sc); return geo; };
  if (S.jaw) {
    const J = S.jaw;
    const jaw = limb(J.len * sc, J.h * sc, J.h * 0.35 * sc, 10, 4);
    jaw.scale(J.w / J.h, 1, 1);
    jaw.rotateX(-Math.PI / 2 + 0.06);
    R.rigid(jaw, made.jaw, skinColor);
    if (S.teeth) {
      for (let i = 0; i < 9; i++) for (const sx of [-1, 1]) {
        const t = i / 9;
        const tooth = new THREE.ConeGeometry(J.h * 0.13 * sc, J.h * 0.55 * sc, 4);
        tooth.translate(sx * J.w * 0.82 * (1 - t * 0.5) * sc, J.h * 0.55 * sc, (0.12 + t * 0.8) * J.len * sc);
        R.rigid(tooth, made.jaw, 0xe8e0c8);
        const up = new THREE.ConeGeometry(J.h * 0.14 * sc, J.h * 0.6 * sc, 4); up.rotateX(Math.PI);
        up.translate(sx * J.w * 0.85 * (1 - t * 0.45) * sc, (J.y + 0.0) * sc + J.h * 0.35 * sc, (J.z + (0.12 + t * 0.82) * J.len) * sc);
        R.rigid(toHead(up), made.head, 0xe8e0c8);
      }
      // gums/mouth interior
      const mouth = ellipsoid(J.w * 0.7 * sc, J.h * 0.3 * sc, J.len * 0.45 * sc); mouth.translate(0, J.h * 0.45 * sc, J.len * 0.45 * sc);
      R.rigid(mouth, made.jaw, 0x7a2a28);
    }
  }
  if (S.eye) {
    const E = { ...S.eye };
    const sw = spineAt(E.z);
    E.x = Math.max(E.x, sw[2] * 0.88);
    for (const sx of [-1, 1]) {
      const eye = new THREE.SphereGeometry(E.r * sc, 10, 8); eye.translate(sx * E.x * sc, E.y * sc, E.z * sc);
      R.rigid(toHead(eye), made.head, E.color);
      const pupil = new THREE.SphereGeometry(E.r * 0.45 * sc, 6, 4); pupil.scale(0.4, 1, 1); pupil.translate(sx * (E.x + E.r * 0.75) * sc, E.y * sc, (E.z + E.r * 0.2) * sc);
      R.rigid(toHead(pupil), made.head, 0x050505);
      const brow = ellipsoid(E.r * 1.6 * sc, E.r * 0.6 * sc, E.r * 2.2 * sc); brow.translate(sx * (E.x - E.r * 0.2) * sc, (E.y + E.r * 1.0) * sc, E.z * sc);
      R.rigid(toHead(brow), made.head, skinColor);
    }
  }
  if (S.horns) {
    for (const sx of [-1, 1]) { const h = new THREE.ConeGeometry(0.12 * sc, 1.1 * sc, 8); h.rotateX(1.0); h.translate(sx * 0.34 * sc, 2.5 * sc, 3.5 * sc); R.rigid(toHead(h), made.head, 0xe0d4b0); }
    const nh = new THREE.ConeGeometry(0.1 * sc, 0.45 * sc, 8); nh.rotateX(0.5); nh.translate(0, 1.98 * sc, 4.2 * sc); R.rigid(toHead(nh), made.head, 0xe0d4b0);
  }
  if (S.bigFrill) {
    const fr = new THREE.CylinderGeometry(1.35 * sc, 1.35 * sc, 0.12 * sc, 22, 1, false, Math.PI * 0.45, Math.PI * 1.1);
    fr.rotateX(Math.PI / 2 - 0.55); fr.translate(0, 2.35 * sc, 2.75 * sc);
    R.rigid(toHead(fr), made.head, (p, n, out) => { skinColor(p, n, out); out.lerp(new THREE.Color(0x8a4a2a), 0.35); });
    for (let i = 0; i < 9; i++) { const a = -Math.PI * 0.5 + (i / 8) * Math.PI; const k = new THREE.ConeGeometry(0.09 * sc, 0.25 * sc, 5); k.rotateZ(-a); k.rotateX(-0.55); k.translate(Math.sin(a) * 1.4 * sc, (2.35 + Math.cos(a) * 1.15) * sc, (2.75 - Math.cos(a) * 0.6) * sc); R.rigid(toHead(k), made.head, 0xd8ccb0); }
  }
  if (S.beak) {
    const bk = new THREE.ConeGeometry(S.jaw.w * 0.9 * sc, S.jaw.len * 0.35 * sc, 6); bk.rotateX(Math.PI / 2 + 0.3);
    const tip = S.spine[S.spine.length - 1];
    bk.translate(0, (tip[1] - tip[3] * 0.5) * sc, (tip[0] + 0.05) * sc);
    R.rigid(toHead(bk), made.head, 0x3a3228);
  }
  if (S.crest) {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 3.75, 3.2), new THREE.Vector3(0, 4.05, 2.7), new THREE.Vector3(0, 4.15, 1.9)].map((v) => v.multiplyScalar(sc)));
    const tube = new THREE.TubeGeometry(curve, 10, 0.1 * sc, 8);
    R.rigid(toHead(tube), made.head, 0xa04a2a);
  }
  if (S.crests) {
    for (const sx of [-1, 1]) {
      const cr = ellipsoid(0.012 * sc, 0.075 * sc, 0.17 * sc); cr.rotateX(0.25); cr.translate(sx * 0.04 * sc, 1.68 * sc, 1.15 * sc);
      R.rigid(toHead(cr), made.head, 0xb03a20);
    }
  }
  if (S.frill) {
    // neck frill — scaled by animator (bone 'frill')
    const fb = R.bone('frill', made.neck2, 0, 0, 0);
    R.root.updateMatrixWorld(true);
    const fr = new THREE.CylinderGeometry(0.42 * sc, 0.42 * sc, 0.01 * sc, 20, 1, false);
    fr.rotateX(Math.PI / 2 - 0.4);
    const colorFn = (p, n, out) => { const r = Math.hypot(p.x, p.y) / (0.42 * sc); out.set(0xd8c020).lerp(new THREE.Color(0xc02010), r > 0.7 ? 1 : r > 0.45 ? 0.3 : 0); };
    R.rigid(fr, fb, colorFn);
    made.frill = fb;
  }
  if (S.plates) {
    const tailB = ['pelvis', 'tail1', 'tail2', 'chest'];
    for (let i = 0; i < 15; i++) {
      const z = -3.0 + i * 0.36;
      const p = catmull(S.spine, (z - S.spine[0][0]) / (S.spine[S.spine.length - 1][0] - S.spine[0][0]));
      const size = 0.35 + Math.sin(((i + 1) / 16) * Math.PI) * 0.55;
      const pl = new THREE.CylinderGeometry(size * sc, size * sc, 0.06 * sc, 4, 1);
      pl.rotateZ(Math.PI / 2); pl.rotateY(Math.PI / 2); pl.scale(1, 1.2, 0.8);
      const sx = i % 2 ? 0.12 : -0.12;
      pl.translate(sx * sc, (p[1] + p[3] * 0.85 + size * 0.5) * sc, z * sc);
      R.skinned(pl, weightFn, (pp, n, out) => out.set(0x8a4a2a).lerp(new THREE.Color(0xc87a3a), (pp.y / sc - p[1]) / 1.5));
    }
    for (const sx of [-1, 1]) for (const zz of [-3.7, -4.0]) {
      const sp = new THREE.ConeGeometry(0.06 * sc, 0.8 * sc, 6); sp.rotateZ(sx * -1.1); sp.translate(sx * 0.3 * sc, 1.7 * sc, zz * sc);
      R.skinned(sp, weightFn, 0xd8ccb0);
    }
  }
  if (S.nasal) {
    const n = ellipsoid(0.3 * sc, 0.28 * sc, 0.45 * sc); n.translate(0, 15.55 * sc, 6.75 * sc); R.rigid(toHead(n), made.head, skinColor);
  }
  if (S.feathers) {
    // short quill crest along neck/back (JP3 style)
    for (let i = 0; i < 10; i++) {
      const z = -0.6 + i * 0.16;
      const p = catmull(S.spine, (z - S.spine[0][0]) / (S.spine[S.spine.length - 1][0] - S.spine[0][0]));
      const q = new THREE.ConeGeometry(0.02 * sc, 0.16 * sc, 4); q.rotateX(-0.9); q.translate(0, (p[1] + p[3] * 0.95) * sc, z * sc);
      R.skinned(q, weightFn, 0x3a2a18);
    }
  }
  // bounds
  const len = (S.spine[S.spine.length - 1][0] - S.spine[0][0]) * sc;
  const mesh = R.build(dinoMaterial(), len * 0.65, new THREE.Vector3(0, S.hind.y * sc, 0));
  const rig = { mesh, bones: made, legs, arms, spec: S, kind, scale: sc, boneDefs, pelvisRest: made.pelvis.position.clone() };
  return rig;
}

// --- Pteranodon: simple dedicated model with flapping wings (rigid parts on bones) ---
export function buildPteranodon(scale = 1) {
  const R = new RigBuilder();
  const s = scale;
  const body = R.bone('body', null, 0, 0, 0);
  const head = R.bone('head', body, 0, 0.1 * s, 0.45 * s);
  const wL = R.bone('wingL', body, 0.12 * s, 0.05 * s, 0.15 * s), wR = R.bone('wingR', body, -0.12 * s, 0.05 * s, 0.15 * s);
  const tL = R.bone('tipL', wL, 1.4 * s, 0, 0), tR = R.bone('tipR', wR, -1.4 * s, 0, 0);
  R.root.updateMatrixWorld(true);
  const col = 0x7a5a48, mem = 0x9a6a50;
  const b = ellipsoid(0.16 * s, 0.15 * s, 0.5 * s); R.rigid(b, body, col);
  const neck = ellipsoid(0.07 * s, 0.07 * s, 0.2 * s); neck.translate(0, 0.05 * s, -0.25 * s); R.rigid(neck, head, col);
  const skull = ellipsoid(0.08 * s, 0.09 * s, 0.14 * s); R.rigid(skull, head, col);
  const beak = new THREE.ConeGeometry(0.06 * s, 0.75 * s, 6); beak.rotateX(Math.PI / 2); beak.translate(0, -0.02 * s, 0.45 * s); R.rigid(beak, head, 0xc8a050);
  const crest = new THREE.ConeGeometry(0.05 * s, 0.6 * s, 4); crest.rotateX(-Math.PI / 2 - 0.25); crest.translate(0, 0.1 * s, -0.3 * s); R.rigid(crest, head, 0xb04020);
  for (const [bn, tip, sx] of [[wL, tL, 1], [wR, tR, -1]]) {
    const inner = new THREE.BufferGeometry();
    inner.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.12 * s, sx * 1.4 * s, 0, 0.05 * s, 0, 0, -0.4 * s, sx * 1.4 * s, 0, 0.05 * s, sx * 1.4 * s, 0, -0.25 * s, 0, 0, -0.4 * s], 3));
    inner.computeVertexNormals();
    R.rigid(inner, bn, mem);
    const outer = new THREE.BufferGeometry();
    outer.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.05 * s, sx * 1.6 * s, 0, -0.1 * s, 0, 0, -0.25 * s], 3));
    outer.computeVertexNormals();
    R.rigid(outer, tip, mem);
    const bone1 = limb(1.4 * s, 0.03 * s, 0.02 * s, 5, 2); bone1.rotateZ(sx * Math.PI / 2); bone1.translate(0, 0, 0.08 * s); R.rigid(bone1, bn, col);
  }
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide });
  const mesh = R.build(mat, 3 * s);
  return { mesh, bones: R.byName, kind: 'ptera', scale: s };
}
