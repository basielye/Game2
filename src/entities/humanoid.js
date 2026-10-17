// Procedural humans: the heroine (Ava Reyes), settlers, and the Black Fang raiders.
// One skinned mesh per character + procedural animation layered on a bone rig.
import * as THREE from 'three';
import { RigBuilder, limb, ellipsoid, setRot } from './rig.js';
import { clamp, lerp, damp } from '../core/math.js';
import { getTex } from '../core/textures.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MeshoptSimplifier } from 'meshoptimizer';
import { gltf as loadGLTF } from '../core/assets.js';

// ---------------------------------------------------------------------------------------------
// Baked characters: MakeHuman (CC0) bodies, clothes and hair, shaped and skinned offline to this
// game's humanoid rig (see README credits). One shared 4K atlas, one draw call per character,
// three index-only LODs sharing the same vertex buffers.
const TEMPLATES = {};
const LIVE = new Set();
let humanMat = null;
const LOD_RATIOS = [1, 0.3, 0.08];
const LOD_DIST = [11, 30];

function bakedMaterial(renderer) {
  const tl = new THREE.TextureLoader();
  const alb = tl.load('textures/humans_a.webp'), nrm = tl.load('textures/humans_n.webp');
  alb.colorSpace = THREE.SRGBColorSpace;
  for (const t of [alb, nrm]) { t.flipY = false; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); }
  const m = new THREE.MeshStandardMaterial({ map: alb, normalMap: nrm, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1, metalness: 0 });
  m.userData.tint = new THREE.Color(1, 1, 1);
  m.onBeforeCompile = function (s) {
    s.uniforms.uClothTint = { value: this.userData.tint };
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uClothTint;')
      // vertex colour: rgb = authored tint, a = skin mask (must not feed alpha)
      .replace('#include <color_fragment>', '#if defined(USE_COLOR_ALPHA)\n  float skinMask = vColor.a;\n  diffuseColor.rgb *= vColor.rgb * mix(uClothTint, vec3(1.0), skinMask);\n#else\n  float skinMask = 0.0;\n#endif')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = texture2D(normalMap, vNormalMapUv).a;')
      // cheap subsurface: red light bleeding through thin skin, softer terminator
      .replace('#include <opaque_fragment>', 'outgoingLight += skinMask * diffuseColor.rgb * (reflectedLight.directDiffuse * vec3(0.32, 0.09, 0.05) + reflectedLight.indirectDiffuse * vec3(0.22, 0.07, 0.04));\n#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => 'baked-human';
  return m;
}

export async function loadHumans(renderer, names) {
  await MeshoptSimplifier.ready;
  humanMat = bakedMaterial(renderer);
  await Promise.all(names.map(async (n) => {
    try {
      const g = await loadGLTF(renderer, `models/humans/${n}.glb`);
      let skinned = null;
      g.scene.traverse((o) => { if (o.isSkinnedMesh) skinned = o; });
      if (!skinned) return;
      const geo = skinned.geometry;
      // fold gltfpack's KHR_texture_transform back into the UVs (we use our own material)
      const map = skinned.material.map;
      const uv = geo.attributes.uv, out = new Float32Array(uv.count * 2);
      const rp = map ? map.repeat : new THREE.Vector2(1, 1), of = map ? map.offset : new THREE.Vector2();
      for (let i = 0; i < uv.count; i++) { out[i * 2] = uv.getX(i) * rp.x + of.x; out[i * 2 + 1] = uv.getY(i) * rp.y + of.y; }
      geo.setAttribute('uv', new THREE.BufferAttribute(out, 2));
      skinned.material.dispose(); map?.dispose();
      skinned.material = humanMat;
      // LODs: same vertex buffers, simplified index
      const lods = [geo];
      const idx = geo.index.array instanceof Uint32Array ? geo.index.array : new Uint32Array(geo.index.array);
      const pos = new Float32Array(geo.attributes.position.count * 3);
      for (let i = 0; i < geo.attributes.position.count; i++) { pos[i * 3] = geo.attributes.position.getX(i); pos[i * 3 + 1] = geo.attributes.position.getY(i); pos[i * 3 + 2] = geo.attributes.position.getZ(i); }
      for (let l = 1; l < LOD_RATIOS.length; l++) {
        const target = Math.floor((idx.length * LOD_RATIOS[l]) / 3) * 3;
        const [o] = MeshoptSimplifier.simplify(idx, pos, 3, target, 0.02 * l);
        const lg = new THREE.BufferGeometry();
        for (const k of Object.keys(geo.attributes)) lg.setAttribute(k, geo.attributes[k]);
        lg.setIndex(new THREE.BufferAttribute(o, 1));
        lg.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.4);
        lods.push(lg);
      }
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.4);
      TEMPLATES[n] = { scene: g.scene, lods };
    } catch (e) { console.warn('human model unavailable', n, e); }
  }));
}

function buildBakedHuman(presetName, overrides) {
  const T = TEMPLATES[presetName];
  const P = HUMAN_PRESETS[presetName] || HUMAN_PRESETS.settlerM;
  const root = SkeletonUtils.clone(T.scene);
  let mesh = null;
  const bones = {};
  root.traverse((o) => { if (o.isSkinnedMesh) mesh = o; if (o.isBone) bones[o.name] = o; });
  // per-character clothing variation via a material clone (same shader program)
  if (overrides.top || overrides.pants) {
    const m = humanMat.clone();
    m.onBeforeCompile = humanMat.onBeforeCompile; m.customProgramCacheKey = humanMat.customProgramCacheKey;
    const c = new THREE.Color(overrides.top ?? 0xb0a080);
    const l = c.getHSL({}).l;
    m.userData.tint = new THREE.Color(1, 1, 1).lerp(c.multiplyScalar(0.55 / Math.max(l, 0.1)), 0.45);
    mesh.material = m;
  }
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.frustumCulled = true;
  for (const b of Object.values(bones)) { b.userData.rest = b.quaternion.clone(); b.userData.restPos = b.position.clone(); }
  mesh.userData.bones = bones;
  // the clone root carries the skeleton; expose it as the rig mesh so callers can add it to a group
  root.userData.bones = bones;
  const side = {};
  for (const [k, sx] of [['L', 1], ['R', -1]]) side[k] = { shoulder: bones['shoulder' + k], arm: bones['arm' + k], elbow: bones['elbow' + k], hand: bones['hand' + k], thigh: bones['thigh' + k], knee: bones['knee' + k], foot: bones['foot' + k], sx };
  const braid = P.braid && bones.braid1 ? [bones.braid1, bones.braid2, bones.braid3] : null;
  const rig = { mesh: root, skinned: mesh, lods: T.lods, lod: 0, bones, side, braid, s: (P.height || 1.75) / 1.75, female: !!P.female, preset: presetName };
  rig.anim = { zombie: 0, phase: 0, speed: 0, crouch: 0, aim: 0, aimPitch: 0, weapon: 'none', air: 0, swim: 0, mounted: 0, dead: 0, melee: -1, draw: 0, reload: 0, look: 0, lookPitch: 0, hurt: 0, t: 0, braidV: 0, sit: 0, wave: 0, lean: 0, interact: 0 };
  LIVE.add(rig);
  return rig;
}

// Swap index-only LODs by camera distance (cheap: no vertex re-upload).
const _hp = new THREE.Vector3();
export function updateHumanLODs(camera, bias = 1) {
  for (const rig of LIVE) {
    if (!rig.mesh.parent) { rig.orphan = (rig.orphan || 0) + 1; if (rig.orphan > 300) LIVE.delete(rig); continue; }
    rig.orphan = 0;
    rig.skinned.getWorldPosition(_hp);
    const d = _hp.distanceTo(camera.position) / bias;
    const l = d < LOD_DIST[0] ? 0 : d < LOD_DIST[1] ? 1 : 2;
    if (l !== rig.lod) { rig.lod = l; rig.skinned.geometry = rig.lods[l]; }
  }
}


let sharedMat = null;
function humanMaterial() {
  if (!sharedMat) sharedMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.68, metalness: 0.0, map: getTex('cloth') });
  return sharedMat;
}

export const HUMAN_PRESETS = {
  ava: { female: true, skin: 0xc68a62, hair: 0x2b1810, top: 0x3f6f6a, pants: 0x6b5638, boots: 0x3a2618, leather: 0x4a2c1a, gloves: 0x3a2618, braid: true, backpack: true, holsters: true, build: 1.0, height: 1.72 },
  settlerM: { female: false, skin: 0xd09a74, hair: 0x5a4030, top: 0x8a7a5a, pants: 0x4a4a52, boots: 0x3a2a1a, leather: 0x5a3a20, hat: 0x6a4a2a, beard: true, build: 1.1, height: 1.8 },
  settlerF: { female: true, skin: 0xa86e4c, hair: 0x1a120c, top: 0x9a5040, pants: 0x5a4a3a, boots: 0x2a1c12, leather: 0x4a2c1a, bun: true, build: 0.95, height: 1.68 },
  marshal: { female: false, skin: 0x8e5c3c, hair: 0x2a2a2a, top: 0x5a6a7a, pants: 0x3a3a3a, boots: 0x1a1210, leather: 0x3a2010, hat: 0x2a2018, beard: true, coat: 0x4a3828, build: 1.15, height: 1.86 },
  infected: { female: false, skin: 0x7d8a76, hair: 0x2a2a22, top: 0x4a4038, pants: 0x2e3038, boots: 0x1a1612, leather: 0x2a2018, build: 0.95, height: 1.76, eyes: 0xd8e040 },
  infectedF: { female: true, skin: 0x86907c, hair: 0x3a2a1a, top: 0x5a4a4a, pants: 0x34302c, boots: 0x1a1612, leather: 0x2a2018, build: 0.9, height: 1.66, eyes: 0xd8e040 },
  raider: { female: false, skin: 0xb07a58, hair: 0x2a1a10, top: 0x2a2a28, pants: 0x3a3228, boots: 0x1a1410, leather: 0x2a1a10, hat: 0x1e1a16, bandana: 0x8a1a12, build: 1.1, height: 1.8 },
  raiderF: { female: true, skin: 0xc08a68, hair: 0x6a2a14, top: 0x3a2a24, pants: 0x2a2620, boots: 0x1a1410, leather: 0x2a1a10, bandana: 0x8a1a12, braid: true, build: 1.0, height: 1.72 },
  crane: { female: false, skin: 0xd8a888, hair: 0x9a9a9a, top: 0x1a1a1a, pants: 0x2a2420, boots: 0x0e0a08, leather: 0x1a0e08, hat: 0x101010, coat: 0x3a1410, beard: true, build: 1.2, height: 1.9 },
  doctor: { female: true, skin: 0xe0b090, hair: 0x8a6a40, top: 0xd8d4c8, pants: 0x4a4a4a, boots: 0x2a2a2a, leather: 0x3a2a1a, bun: true, build: 0.9, height: 1.66 },
};

export function buildHuman(presetName, overrides = {}) {
  if (TEMPLATES[presetName]) return buildBakedHuman(presetName, overrides);
  return buildProceduralHuman(presetName, overrides);
}

function buildProceduralHuman(presetName, overrides = {}) {
  const P = { ...HUMAN_PRESETS[presetName], ...overrides };
  const R = new RigBuilder();
  const s = P.height / 1.75;
  const b = P.build;
  const f = P.female;
  const hips = R.bone('hips', null, 0, 0.98 * s, 0);
  const spine = R.bone('spine', hips, 0, 0.12 * s, 0);
  const chest = R.bone('chest', spine, 0, 0.2 * s, 0);
  const neck = R.bone('neck', chest, 0, 0.2 * s, 0);
  const head = R.bone('head', neck, 0, 0.08 * s, 0);
  const sh = (f ? 0.155 : 0.18) * b * s;
  const side = {};
  for (const [k, sx] of [['L', 1], ['R', -1]]) {
    const shoulder = R.bone('shoulder' + k, chest, sx * sh, 0.13 * s, 0);
    const arm = R.bone('arm' + k, shoulder, sx * 0.04 * s, 0, 0);
    const elbow = R.bone('elbow' + k, arm, 0, -0.28 * s, 0);
    const hand = R.bone('hand' + k, elbow, 0, -0.25 * s, 0);
    const thigh = R.bone('thigh' + k, hips, sx * 0.095 * s, -0.06 * s, 0);
    const knee = R.bone('knee' + k, thigh, 0, -0.43 * s, 0);
    const foot = R.bone('foot' + k, knee, 0, -0.42 * s, 0);
    side[k] = { shoulder, arm, elbow, hand, thigh, knee, foot, sx };
  }
  let braid = null;
  if (P.braid) {
    const b1 = R.bone('braid1', head, 0, 0.1 * s, -0.1 * s);
    const b2 = R.bone('braid2', b1, 0, -0.14 * s, -0.01);
    const b3 = R.bone('braid3', b2, 0, -0.14 * s, 0);
    braid = [b1, b2, b3];
  }
  R.root.updateMatrixWorld(true);

  const col = (c) => new THREE.Color(c);
  const skin = col(P.skin), top = col(P.top), pants = col(P.pants), boots = col(P.boots), leather = col(P.leather), hair = col(P.hair);
  // torso
  const pelvis = ellipsoid(0.15 * b * s, 0.12 * s, 0.11 * s); pelvis.translate(0, 0.0, 0);
  R.rigid(pelvis, hips, pants);
  const belt = new THREE.TorusGeometry(0.14 * b * s, 0.022 * s, 6, 16); belt.rotateX(Math.PI / 2); belt.scale(1, 1, 0.78); belt.translate(0, 0.07 * s, 0);
  R.rigid(belt, hips, leather);
  const belly = ellipsoid((f ? 0.125 : 0.14) * b * s, 0.14 * s, 0.1 * s); belly.translate(0, 0.08 * s, 0);
  R.rigid(belly, spine, P.coat ? col(P.coat) : top);
  const torso = ellipsoid((f ? 0.155 : 0.185) * b * s, 0.17 * s, 0.115 * s); torso.translate(0, 0.07 * s, -0.005);
  R.rigid(torso, chest, top);
  if (f) for (const sx of [-1, 1]) { const bust = ellipsoid(0.058 * s, 0.055 * s, 0.05 * s); bust.translate(sx * 0.06 * s, 0.045 * s, 0.085 * s); R.rigid(bust, chest, top); }
  // tank-top: bare shoulders for Ava
  const shoulderSkin = P.top === HUMAN_PRESETS.ava.top && presetName === 'ava';
  for (const k of ['L', 'R']) {
    const S = side[k];
    const delt = ellipsoid(0.06 * b * s, 0.06 * s, 0.06 * s); R.rigid(delt, S.arm, shoulderSkin ? skin : (P.coat ? col(P.coat) : top));
    const upper = limb(0.27 * s, 0.048 * b * s, 0.038 * s, 8, 4, 0.1); R.rigid(upper, S.arm, shoulderSkin ? skin : (P.coat ? col(P.coat) : top));
    const fore = limb(0.24 * s, 0.038 * s, 0.03 * s, 8, 4, 0.1); R.rigid(fore, S.elbow, shoulderSkin ? skin : (P.coat ? col(P.coat) : top));
    const hand = ellipsoid(0.034 * s, 0.07 * s, 0.022 * s); hand.translate(0, -0.06 * s, 0.005); R.rigid(hand, S.hand, P.gloves ? col(P.gloves) : skin);
    const thumb = ellipsoid(0.012 * s, 0.03 * s, 0.012 * s); thumb.rotateZ(S.sx * 0.5); thumb.translate(S.sx * -0.025 * s, -0.035 * s, 0.02 * s); R.rigid(thumb, S.hand, P.gloves ? col(P.gloves) : skin);
    const thighG = limb(0.43 * s, (f ? 0.082 : 0.078) * b * s, 0.05 * s, 9, 5, 0.12); R.rigid(thighG, S.thigh, pants);
    const shin = limb(0.42 * s, 0.052 * s, 0.042 * s, 8, 5, 0.15);
    R.rigid(shin, S.knee, (p, n, out) => out.copy(p.y < 0.36 * s ? boots : pants));
    if (P.boots) { const cuff = new THREE.CylinderGeometry(0.056 * s, 0.05 * s, 0.05 * s, 9); cuff.translate(0, -0.2 * s, 0); R.rigid(cuff, S.knee, boots); }
    const footG = ellipsoid(0.048 * s, 0.045 * s, 0.12 * s); footG.translate(0, -0.03 * s, 0.045 * s); R.rigid(footG, S.foot, boots);
    if (P.holsters && k === 'R') {
      const hol = new THREE.BoxGeometry(0.06 * s, 0.2 * s, 0.1 * s); hol.translate(-0.075 * s, -0.12 * s, 0); R.rigid(hol, S.thigh, leather);
      const strap = new THREE.TorusGeometry(0.083 * s, 0.012 * s, 4, 12); strap.rotateX(Math.PI / 2); strap.translate(0, -0.18 * s, 0); R.rigid(strap, S.thigh, leather);
    }
    if (P.holsters && k === 'L') {
      const knife = new THREE.BoxGeometry(0.04 * s, 0.16 * s, 0.05 * s); knife.translate(0.07 * s, -0.1 * s, 0.02); R.rigid(knife, S.thigh, leather);
    }
  }
  if (P.coat) {
    // long duster coat skirt
    const skirt = new THREE.CylinderGeometry(0.17 * b * s, 0.26 * b * s, 0.65 * s, 12, 1, true);
    skirt.translate(0, -0.3 * s, -0.01); R.rigid(skirt, hips, col(P.coat));
    const lapel = ellipsoid(0.19 * b * s, 0.18 * s, 0.12 * s); lapel.translate(0, 0.06 * s, -0.01); R.rigid(lapel, chest, col(P.coat));
  }
  if (P.backpack) {
    const pack = new THREE.BoxGeometry(0.24 * s, 0.3 * s, 0.1 * s); pack.translate(0, 0.04 * s, -0.16 * s); R.rigid(pack, chest, col(0x4e4a32));
    const roll = new THREE.CylinderGeometry(0.05 * s, 0.05 * s, 0.26 * s, 8); roll.rotateZ(Math.PI / 2); roll.translate(0, 0.21 * s, -0.16 * s); R.rigid(roll, chest, col(0x7a5a3a));
    for (const sx of [-1, 1]) { const st = new THREE.BoxGeometry(0.03 * s, 0.32 * s, 0.24 * s); st.translate(sx * 0.08 * s, 0.07 * s, -0.04 * s); R.rigid(st, chest, leather); }
    // quiver
    const quiv = new THREE.CylinderGeometry(0.045 * s, 0.04 * s, 0.5 * s, 8); quiv.rotateZ(0.5); quiv.translate(-0.05 * s, 0.1 * s, -0.2 * s); R.rigid(quiv, chest, leather);
    for (let i = 0; i < 5; i++) { const ar = new THREE.CylinderGeometry(0.006, 0.006, 0.18 * s, 4); ar.rotateZ(0.5); ar.translate(-0.17 * s + i * 0.008, 0.33 * s + i * 0.01, -0.2 * s + (i % 2) * 0.015); R.rigid(ar, chest, col(0xd8d0c0)); }
  }
  // neck & head
  const neckG = limb(0.12 * s, 0.05 * s, 0.052 * s, 8, 3); neckG.rotateX(Math.PI); neckG.translate(0, -0.02 * s, 0); R.rigid(neckG, neck, skin);
  const skull = ellipsoid(0.092 * s, 0.112 * s, 0.103 * s, 14, 10); skull.translate(0, 0.1 * s, 0.005); R.rigid(skull, head, skin);
  const jaw = ellipsoid((f ? 0.066 : 0.074) * s, 0.06 * s, 0.075 * s); jaw.translate(0, 0.035 * s, 0.025 * s); R.rigid(jaw, head, skin);
  const nose = ellipsoid(0.014 * s, 0.026 * s, 0.02 * s); nose.rotateX(-0.3); nose.translate(0, 0.085 * s, 0.1 * s); R.rigid(nose, head, skin);
  for (const sx of [-1, 1]) {
    const eyeW = ellipsoid(0.017 * s, 0.011 * s, 0.01 * s); eyeW.translate(sx * 0.035 * s, 0.112 * s, 0.092 * s); R.rigid(eyeW, head, 0xeeeae0);
    const eye = new THREE.SphereGeometry((P.eyes ? 0.011 : 0.0085) * s, 8, 6); eye.translate(sx * 0.035 * s, 0.112 * s, 0.1 * s); R.rigid(eye, head, P.eyes || 0x2a1a0e);
    const brow = new THREE.BoxGeometry(0.035 * s, 0.007 * s, 0.01 * s); brow.rotateZ(sx * -0.15); brow.translate(sx * 0.036 * s, 0.132 * s, 0.098 * s); R.rigid(brow, head, hair.clone().multiplyScalar(0.8));
    const ear = ellipsoid(0.012 * s, 0.025 * s, 0.018 * s); ear.translate(sx * 0.092 * s, 0.1 * s, 0); R.rigid(ear, head, skin);
  }
  const lips = ellipsoid(0.026 * s, 0.008 * s, 0.01 * s); lips.translate(0, 0.045 * s, 0.093 * s); R.rigid(lips, head, f ? 0x9a4a40 : skin.clone().multiplyScalar(0.85));
  // hair
  const cap = ellipsoid(0.1 * s, 0.1 * s, 0.11 * s, 14, 10); cap.translate(0, 0.15 * s, -0.012 * s); R.rigid(cap, head, hair);
  if (f) {
    const back = ellipsoid(0.095 * s, 0.11 * s, 0.07 * s); back.translate(0, 0.08 * s, -0.05 * s); R.rigid(back, head, hair);
    const fringeL = ellipsoid(0.03 * s, 0.07 * s, 0.03 * s); fringeL.translate(0.075 * s, 0.11 * s, 0.05 * s); R.rigid(fringeL, head, hair);
    const fringeR = fringeL.clone(); fringeR.translate(-0.15 * s, 0, 0); R.rigid(fringeR, head, hair);
  }
  if (P.bun) { const bun = ellipsoid(0.05 * s, 0.05 * s, 0.05 * s); bun.translate(0, 0.17 * s, -0.1 * s); R.rigid(bun, head, hair); }
  if (braid) {
    for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) {
      const seg = ellipsoid((0.03 - i * 0.006) * s, 0.032 * s, (0.026 - i * 0.004) * s);
      seg.translate(0, -k * 0.045 * s, 0); R.rigid(seg, braid[i], hair);
    }
    const tie = new THREE.SphereGeometry(0.014 * s, 6, 4); tie.translate(0, -0.14 * s, 0); R.rigid(tie, braid[2], 0x8a2a1a);
  }
  if (P.beard) { const bd = ellipsoid(0.07 * s, 0.05 * s, 0.05 * s); bd.translate(0, 0.02 * s, 0.05 * s); R.rigid(bd, head, hair); }
  if (P.bandana) {
    const band = ellipsoid(0.085 * s, 0.05 * s, 0.09 * s); band.translate(0, 0.04 * s, 0.03 * s); R.rigid(band, head, col(P.bandana));
    const tri = new THREE.ConeGeometry(0.06 * s, 0.08 * s, 3); tri.rotateX(Math.PI); tri.translate(0, -0.02 * s, 0.07 * s); R.rigid(tri, head, col(P.bandana));
  }
  if (P.hat) {
    const crown = new THREE.CylinderGeometry(0.085 * s, 0.098 * s, 0.11 * s, 12); crown.translate(0, 0.24 * s, -0.005); R.rigid(crown, head, col(P.hat));
    const brim = new THREE.CylinderGeometry(0.2 * s, 0.2 * s, 0.012 * s, 18); brim.scale(1, 1, 1.12); brim.translate(0, 0.19 * s, 0); R.rigid(brim, head, col(P.hat));
    const bandG = new THREE.CylinderGeometry(0.1 * s, 0.1 * s, 0.025 * s, 12); bandG.translate(0, 0.21 * s, -0.005); R.rigid(bandG, head, leather);
  }
  const mesh = R.build(humanMaterial(), 1.4, new THREE.Vector3(0, 0.9, 0));
  const bones = R.byName;
  const rig = { mesh, bones, side, braid, s, female: f, preset: presetName };
  rig.anim = { zombie: 0, phase: 0, speed: 0, crouch: 0, aim: 0, aimPitch: 0, weapon: 'none', air: 0, swim: 0, mounted: 0, dead: 0, melee: -1, draw: 0, reload: 0, look: 0, lookPitch: 0, hurt: 0, t: 0, braidV: 0, sit: 0, wave: 0, lean: 0, interact: 0 };
  return rig;
}

// Animate a humanoid rig. a = rig.anim (mutated by controller).
export function animateHuman(rig, dt) {
  const a = rig.anim;
  const B = rig.bones;
  const { L, R } = rig.side;
  a.t += dt;
  const sp = a.speed;
  const run = clamp((sp - 2.5) / 3.5, 0, 1);
  const walk = clamp(sp / 2.0, 0, 1);
  const stride = lerp(1.35, 2.4, run);
  a.phase += (sp / stride) * Math.PI * dt * (a.mounted > 0.5 ? 0 : 1);
  const ph = a.phase;
  const amp = lerp(0.5, 0.85, run) * walk;
  const cr = a.crouch;
  const breathe = Math.sin(a.t * 1.8) * 0.02;

  // legs
  const thL = -Math.sin(ph) * amp, thR = Math.sin(ph) * amp;
  const knL = Math.max(0, Math.cos(ph)) * (0.6 + run * 0.9) * walk + 0.06;
  const knR = Math.max(0, -Math.cos(ph)) * (0.6 + run * 0.9) * walk + 0.06;
  let tL = thL - cr * 1.05, tR = thR - cr * 1.05, kL = knL + cr * 1.7, kR = knR + cr * 1.7;
  // airborne tuck
  tL = lerp(tL, -0.7, a.air); tR = lerp(tR, -0.3, a.air); kL = lerp(kL, 1.0, a.air); kR = lerp(kR, 0.5, a.air);
  // mounted (riding pose)
  tL = lerp(tL, -1.25, a.mounted); tR = lerp(tR, -1.25, a.mounted); kL = lerp(kL, 1.5, a.mounted); kR = lerp(kR, 1.5, a.mounted);
  // sitting
  tL = lerp(tL, -1.5, a.sit); tR = lerp(tR, -1.5, a.sit); kL = lerp(kL, 1.5, a.sit); kR = lerp(kR, 1.5, a.sit);
  const spread = a.mounted * 0.45 + a.swim * 0.1;
  // swim kicks
  if (a.swim > 0.01) { const k = Math.sin(a.t * 6) * 0.35 * a.swim; tL += k; tR -= k; }
  setRot(L.thigh, tL, 0, spread);
  setRot(R.thigh, tR, 0, -spread);
  setRot(L.knee, kL);
  setRot(R.knee, kR);
  setRot(L.foot, -(tL + kL) * 0.6 + cr * 0.2);
  setRot(R.foot, -(tR + kR) * 0.6 + cr * 0.2);

  // hips / spine
  const bob = (-Math.abs(Math.cos(ph)) * 0.035 * walk - cr * 0.33) * rig.s - a.sit * 0.45 * rig.s;
  B.hips.position.y = B.hips.userData.restPos.y + bob + 0.02 * walk;
  const twist = Math.sin(ph) * 0.12 * walk;
  const lean = run * 0.18 + cr * 0.35 + a.lean;
  setRot(B.hips, a.swim * 0, -twist * 0.6, 0);
  setRot(B.spine, lean * 0.5 + breathe * 0.5, twist * 0.4, 0);
  const aimTw = 0;
  setRot(B.chest, lean * 0.3 - a.aimPitch * 0.4 * a.aim + breathe, twist * 0.5 + aimTw, 0);
  setRot(B.neck, -lean * 0.4 + a.lookPitch * 0.3, a.look * 0.4, 0);
  setRot(B.head, -lean * 0.2 + a.lookPitch * 0.4 - a.aimPitch * 0.3 * a.aim, a.look * 0.5, 0);

  // arms: base swing
  let aLx = Math.sin(ph) * amp * 0.9, aRx = -Math.sin(ph) * amp * 0.9;
  let aLz = 0.12 + run * 0.1, aRz = -0.12 - run * 0.1;
  let eL = -(0.25 + run * 1.0) - breathe, eR = -(0.25 + run * 1.0) - breathe;
  let aLy = 0, aRy = 0;
  // mounted: hands on reins
  aLx = lerp(aLx, -0.7, a.mounted); aRx = lerp(aRx, -0.7, a.mounted); eL = lerp(eL, -0.9, a.mounted); eR = lerp(eR, -0.9, a.mounted);
  // swim strokes
  if (a.swim > 0.01) {
    const st = a.t * 4;
    aLx = lerp(aLx, -2.6 + Math.sin(st) * 1.4, a.swim); aRx = lerp(aRx, -2.6 + Math.sin(st + Math.PI) * 1.4, a.swim);
    eL = lerp(eL, -0.3, a.swim); eR = lerp(eR, -0.3, a.swim);
  }
  // wave (greeting)
  if (a.zombie > 0) {
    const z = a.zombie, sw = Math.sin(a.t * 1.7) * 0.15;
    aLx = lerp(aLx, -1.35 + sw, z); aRx = lerp(aRx, -1.2 - sw, z); aLz = lerp(aLz, 0.25, z); aRz = lerp(aRz, -0.3, z);
    eL = lerp(eL, -0.35, z); eR = lerp(eR, -0.6, z);
    setRot(B.head, 0.35 + Math.sin(a.t * 0.9) * 0.15, Math.sin(a.t * 0.6) * 0.3, 0.3 * z);
    setRot(B.spine, 0.25 * z, 0, Math.sin(ph) * 0.12 * z);
  }
  if (a.wave > 0) { aRx = lerp(aRx, -2.8, a.wave); aRz = lerp(aRz, -0.4, a.wave); eR = lerp(eR, -0.6 + Math.sin(a.t * 10) * 0.4, a.wave); }
  // interaction reach
  if (a.interact > 0) { aRx = lerp(aRx, -1.2, a.interact); eR = lerp(eR, -0.4, a.interact); aLx = lerp(aLx, -1.0, a.interact); eL = lerp(eL, -0.5, a.interact); }
  // weapon aiming poses
  const ai = a.aim;
  const pitch = a.aimPitch;
  if (ai > 0.001) {
    if (a.weapon === 'bow') {
      // left arm extended holding bow, right hand draws string to cheek
      aLx = lerp(aLx, -1.55 - pitch, ai); aLz = lerp(aLz, 0.05, ai); aLy = lerp(0, -0.25, ai); eL = lerp(eL, -0.05, ai);
      const d = a.draw;
      aRx = lerp(aRx, -1.55 - pitch, ai); aRz = lerp(aRz, -0.1 + d * 0.1, ai); aRy = lerp(0, 0.4 + d * 0.8, ai); eR = lerp(eR, -0.4 - d * 1.8, ai);
    } else if (a.weapon === 'rifle') {
      aRx = lerp(aRx, -1.3 - pitch, ai); aRz = lerp(aRz, -0.1, ai); aRy = lerp(0, 0.35, ai); eR = lerp(eR, -1.3, ai);
      aLx = lerp(aLx, -1.45 - pitch, ai); aLz = lerp(aLz, 0.05, ai); aLy = lerp(0, -0.5, ai); eL = lerp(eL, -0.45, ai);
    } else if (a.weapon === 'pistol') {
      aRx = lerp(aRx, -1.55 - pitch, ai); aRz = lerp(aRz, 0.05, ai); eR = lerp(eR, -0.05, ai);
      aLx = lerp(aLx, -1.3 - pitch, ai * 0.8); aLz = lerp(aLz, -0.2, ai * 0.8); aLy = lerp(0, -0.3, ai * 0.8); eL = lerp(eL, -0.7, ai * 0.8);
    }
  } else if (a.weapon === 'rifle' || a.weapon === 'bow') {
    // low-ready carry
    aRx = lerp(aRx, -0.5, 0.6); eR = lerp(eR, -1.0, 0.6);
  }
  if (a.reload > 0) { const r = Math.sin(a.reload * Math.PI); aLx = lerp(aLx, -1.0, r); eL = lerp(eL, -1.5, r); aRx = lerp(aRx, -0.9, r); eR = lerp(eR, -1.1, r); }
  // melee swing (machete)
  if (a.melee >= 0) {
    const m = a.melee; // 0..1
    const wind = m < 0.35 ? m / 0.35 : 1 - (m - 0.35) / 0.65;
    const strike = m < 0.35 ? 0 : Math.min(1, (m - 0.35) / 0.25);
    aRx = lerp(-2.6 * wind, -0.6, strike); aRz = lerp(-0.6, 0.4, strike); eR = lerp(-1.2 * wind, -0.1, strike);
    setRot(B.chest, lean * 0.3, lerp(-0.5 * wind, 0.5, strike), 0);
  }
  // death slump
  if (a.dead > 0) {
    aLx = lerp(aLx, -2.8, a.dead); aRx = lerp(aRx, -2.8, a.dead); aLz = lerp(aLz, 0.6, a.dead); aRz = lerp(aRz, -0.6, a.dead);
  }
  setRot(L.arm, aLx, aLy, aLz);
  setRot(R.arm, aRx, aRy, aRz);
  setRot(L.elbow, eL);
  setRot(R.elbow, eR);
  setRot(L.hand, 0, 0, 0);
  setRot(R.hand, a.aim > 0.5 && a.weapon === 'pistol' ? 0.1 : 0, 0, 0);

  // braid secondary motion
  if (rig.braid) {
    const target = clamp(sp * 0.09 + a.air * 0.5 + run * 0.2, 0, 1.1) + Math.sin(a.t * 2.3) * 0.04;
    a.braidV = damp(a.braidV, target, 5, dt);
    const sway = Math.sin(ph) * 0.15 * walk;
    setRot(rig.braid[0], 0.25 + a.braidV * 0.6, 0, sway);
    setRot(rig.braid[1], 0.1 + a.braidV * 0.3, 0, sway * 0.6);
    setRot(rig.braid[2], 0.05 + a.braidV * 0.2, 0, sway * 0.4);
  }
}

// Weapon meshes held in hand (separate small meshes parented to hand bone)
export function makeWeaponMesh(type) {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x6a4024, roughness: 0.7 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x3a3c40, roughness: 0.35, metalness: 0.85 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xb08a40, roughness: 0.35, metalness: 0.9 });
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; g.add(m); return m; };
  if (type === 'pistol') {
    add(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 8), steel, 0, -0.06, 0.12, Math.PI / 2);
    add(new THREE.CylinderGeometry(0.026, 0.026, 0.05, 8), steel, 0, -0.06, 0.03, Math.PI / 2);
    add(new THREE.BoxGeometry(0.028, 0.1, 0.04), wood, 0, -0.1, -0.015, -0.35);
    add(new THREE.BoxGeometry(0.02, 0.03, 0.06), brass, 0, -0.04, 0.02);
    g.userData.muzzle = new THREE.Vector3(0, -0.06, 0.23);
  } else if (type === 'rifle') {
    add(new THREE.CylinderGeometry(0.012, 0.014, 0.7, 8), steel, 0, -0.05, 0.36, Math.PI / 2);
    add(new THREE.BoxGeometry(0.035, 0.05, 0.22), steel, 0, -0.05, 0.02);
    add(new THREE.BoxGeometry(0.04, 0.03, 0.4), wood, 0, -0.08, 0.32);
    add(new THREE.BoxGeometry(0.04, 0.09, 0.32), wood, 0, -0.1, -0.22, 0.15);
    add(new THREE.TorusGeometry(0.03, 0.006, 4, 8, Math.PI), brass, 0, -0.1, 0.05, 0, Math.PI / 2);
    g.userData.muzzle = new THREE.Vector3(0, -0.05, 0.72);
  } else if (type === 'bow') {
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0.55, 0), new THREE.Vector3(0, 0, 0.22), new THREE.Vector3(0, -0.55, 0));
    add(new THREE.TubeGeometry(curve, 16, 0.014, 5), wood, 0, 0, 0);
    const str = add(new THREE.CylinderGeometry(0.002, 0.002, 1.1, 3), new THREE.MeshBasicMaterial({ color: 0xddd8c8 }), 0, 0, 0);
    g.userData.string = str;
    add(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 6), new THREE.MeshStandardMaterial({ color: 0x3a2010 }), 0, 0, 0.11);
    g.userData.muzzle = new THREE.Vector3(0, 0, 0.2);
  } else if (type === 'machete') {
    add(new THREE.BoxGeometry(0.008, 0.05, 0.48), steel, 0, -0.04, 0.3);
    add(new THREE.BoxGeometry(0.03, 0.035, 0.13), wood, 0, -0.04, 0.02);
    g.userData.muzzle = new THREE.Vector3(0, -0.04, 0.4);
  } else if (type === 'torch') {
    add(new THREE.CylinderGeometry(0.02, 0.025, 0.5, 6), wood, 0, -0.04, 0.12, Math.PI / 2.4);
  }
  // bake into a single vertex-coloured mesh: one draw call per weapon
  const geos = [];
  g.updateMatrixWorld(true);
  for (const m of g.children) {
    const geo = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrix);
    const c = m.material.color;
    const n = geo.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'color'].includes(k)) geo.deleteAttribute(k);
    geos.push(geo);
  }
  const out = new THREE.Group();
  const mesh = new THREE.Mesh(mergeGeometries(geos), weaponMat());
  mesh.castShadow = true;
  out.add(mesh);
  out.userData.muzzle = g.userData.muzzle;
  return out;
}

let _wMat = null;
function weaponMat() { return (_wMat ||= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.45 })); }
