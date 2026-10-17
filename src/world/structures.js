// Man-made world: Haven settlement (old Visitor Center), the Great Gate, electric fences, outposts, towers, wrecks.
import * as THREE from 'three';
import { getTex } from '../core/textures.js';
import { mulberry32 } from '../core/noise.js';
import { locById, LOCATIONS } from '../data/world.js';
import { merge, mergeGeometries } from './geom.js';

// Procedural PBR sets (tools/bake/gen_building_textures.py): albedo with baked AO, normal RGB + roughness in A.
// UVs are generated in metres (see boxUV), so texture.repeat = 1 / tile size keeps every surface at true scale.
const _texCache = {};
function buildTex(name, tile, srgb) {
  const key = name + srgb;
  if (_texCache[key]) return _texCache[key];
  const t = new THREE.TextureLoader().load(`textures/build/${name}_${srgb ? 'a' : 'n'}.webp`);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / tile, 1 / tile);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return (_texCache[key] = t);
}
function pbr(name, tile, opts = {}) {
  const m = new THREE.MeshStandardMaterial({ map: buildTex(name, tile, true), normalMap: buildTex(name, tile, false), roughness: 1, metalness: 0, ...opts });
  m.normalScale.set(1, -1);
  m.onBeforeCompile = (s) => { s.fragmentShader = s.fragmentShader.replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness * texture2D(normalMap, vNormalMapUv).a;'); };
  m.customProgramCacheKey = () => 'build-pbr';
  m.userData.boxMap = true;
  return m;
}
function barkMat() {
  const tl = new THREE.TextureLoader();
  const ld = (f, srgb) => { const t = tl.load('textures/flora/' + f); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / 0.9, 1 / 0.9); t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  const m = new THREE.MeshStandardMaterial({ map: ld('bark_pine_color.jpg', true), normalMap: ld('bark_pine_normal.jpg'), roughnessMap: ld('bark_pine_roughness.jpg'), aoMap: null, color: 0xb0a090 });
  m.userData.boxMap = true;
  return m;
}

function mats() {
  const m = {
    wood: pbr('planks', 1.2),
    darkWood: pbr('planks', 1.2, { color: 0x8a7060 }),
    concrete: pbr('concrete', 2.4),
    metal: pbr('metal', 1.2, { metalness: 0.55, color: 0xd0d0d0 }),
    rust: pbr('metal', 1.2, { metalness: 0.3, color: 0xa86a48 }),
    thatch: pbr('shingles', 1.6),
    roofRed: pbr('metal', 1.2, { metalness: 0.35, color: 0xa04a36 }),
    roofGreen: pbr('metal', 1.2, { metalness: 0.35, color: 0x5e7a5c }),
    bark: barkMat(),
    trim: pbr('planks', 1.2, { color: 0x6a5444 }),
    shutter: pbr('planks', 0.8, { color: 0x6f7f74 }),
    barrel: pbr('planks', 0.9, { color: 0x9a7050 }),
    windowDark: new THREE.MeshStandardMaterial({ color: 0x141a1c, roughness: 0.05, metalness: 0.6 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x9ec6d0, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.35 }),
    canvas: new THREE.MeshStandardMaterial({ map: getTex('cloth'), color: 0xc8b48a, roughness: 1, side: THREE.DoubleSide }),
    canvasRed: new THREE.MeshStandardMaterial({ map: getTex('cloth'), color: 0x8a2b20, roughness: 1, side: THREE.DoubleSide }),
    yellow: new THREE.MeshStandardMaterial({ color: 0xd9a21b, roughness: 0.6 }),
    black: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 }),
    jeepBody: new THREE.MeshStandardMaterial({ color: 0x9a8e66, roughness: 0.5, metalness: 0.3 }),
    jeepRed: new THREE.MeshStandardMaterial({ color: 0xa02818, roughness: 0.5, metalness: 0.3 }),
    fire: new THREE.MeshBasicMaterial({ color: 0xffa040 }),
    emissiveWarm: new THREE.MeshStandardMaterial({ color: 0x332211, emissive: 0xffa050, emissiveIntensity: 1.3 }),
    stone: new THREE.MeshStandardMaterial({ map: getTex('rock'), roughness: 0.95, color: 0xc8b8a0 }),
    signWood: pbr('planks', 0.9, { color: 0xa08060 }),
  };
  return m;
}

// UVs in metres from object-space position: walls get (along, up), floors/roofs (x, z).
const _sc = new THREE.Vector3();
function boxUV(g, scale) {
  const p = g.attributes.position, n = p.count;
  const uv = new Float32Array(n * 2);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), fn = new THREE.Vector3();
  for (let i = 0; i < n; i += 3) {
    a.fromBufferAttribute(p, i).multiply(scale); b.fromBufferAttribute(p, i + 1).multiply(scale); c.fromBufferAttribute(p, i + 2).multiply(scale);
    fn.subVectors(c, b).cross(b.clone().sub(a));
    const ax = Math.abs(fn.x), ay = Math.abs(fn.y), az = Math.abs(fn.z);
    for (let k = 0; k < 3; k++) {
      const v = k === 0 ? a : k === 1 ? b : c;
      let u, w;
      if (ay >= ax && ay >= az) { u = v.x; w = v.z; } else if (ax >= az) { u = v.z; w = v.y; } else { u = v.x; w = v.y; }
      uv[(i + k) * 2] = u; uv[(i + k) * 2 + 1] = w;
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}
// Cylinder/cone default UVs (0..1 around, 0..1 up) → metres.
function metreUV(g, circ, hgt, off) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * circ + off, uv.getY(i) * hgt);
  g.userData.uvMetres = true;
}

export class Structures {
  constructor(terrain, colliders) {
    this.terrain = terrain;
    this.colliders = colliders;
    this.group = new THREE.Group();
    this.group.name = 'structures';
    this.M = mats();
    this.rng = mulberry32(99);
    this.lights = []; // flickering fires/lamps {light, base, phase}
    this.fires = [];
    this.interactables = []; // {pos, radius, label, action, id}
    this.fenceSegments = [];
    this.loot = []; // lootable crates
    this.build();
  }

  h(x, z) { return this.terrain.getHeight(x, z); }

  // A box mesh with optional collider; local (x,z) relative to parent origin + rotation.
  box(parent, w, hgt, d, mat, x, y, z, ry = 0, collide = true, walkable = false) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d), mat);
    m.position.set(x, y + hgt / 2, z);
    m.rotation.y = ry;
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
    if (collide) {
      parent.updateMatrixWorld(true);
      const wp = new THREE.Vector3(); m.getWorldPosition(wp);
      const wr = parent.rotation.y + ry;
      const c = this.colliders.addBox(wp.x, wp.z, w / 2, d / 2, wr, wp.y - hgt / 2, wp.y + hgt / 2);
      c.walkable = walkable;
    }
    return m;
  }

  cyl(parent, r0, r1, hgt, mat, x, y, z, seg = 10, collide = true) {
    const cg = new THREE.CylinderGeometry(r0, r1, hgt, seg);
    metreUV(cg, Math.PI * 2 * Math.max(r0, r1), hgt, 0);
    const m = new THREE.Mesh(cg, mat);
    m.position.set(x, y + hgt / 2, z);
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
    if (collide) {
      parent.updateMatrixWorld(true);
      const wp = new THREE.Vector3(); m.getWorldPosition(wp);
      this.colliders.addCircle(wp.x, wp.z, Math.max(r0, r1), wp.y - hgt / 2, wp.y + hgt / 2);
    }
    return m;
  }

  anchor(x, z, ry = 0, y = null) {
    const g = new THREE.Group();
    g.position.set(x, y ?? this.h(x, z), z);
    g.rotation.y = ry;
    this.group.add(g);
    g.updateMatrixWorld(true);
    return g;
  }

  addFire(parent, x, y, z, big = false) {
    const M = this.M;
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    for (let i = 0; i < 6; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.1, 5), M.darkWood);
      log.rotation.z = Math.PI / 2.6; log.rotation.y = (i / 6) * Math.PI * 2;
      log.position.y = 0.2; g.add(log);
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.18, 5, 10), M.stone);
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.08; g.add(ring);
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: getTex('glow'), color: 0xff9a40, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    flame.scale.set(big ? 2.6 : 1.8, big ? 3.2 : 2.2, 1); flame.position.y = 0.9; g.add(flame);
    const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: getTex('glow'), color: 0xffe0a0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    core.scale.set(0.9, 1.3, 1); core.position.y = 0.6; g.add(core);
    this.light(g, 0, 1.2, 0, 0xff8a3a, big ? 30 : 18, big ? 26 : 18, { flame });
    const wp = new THREE.Vector3(); g.getWorldPosition(wp);
    this.fires.push(wp);
    this.interactables.push({ pos: wp.clone(), radius: 2.5, label: 'Rest at campfire', action: 'campfire', id: 'fire' + this.fires.length });
    return g;
  }

  // Light sources are virtual; a small pool of real PointLights is assigned to the nearest ones each frame.
  light(parent, x, y, z, color, intensity, dist, extra = {}) {
    parent.updateMatrixWorld(true);
    const pos = new THREE.Vector3(x, y, z).applyMatrix4(parent.matrixWorld);
    this.lights.push({ pos, color: new THREE.Color(color), base: intensity, dist, phase: this.rng() * 10, cur: intensity, ...extra });
  }

  addLamp(parent, x, y, z) {
    const M = this.M;
    this.cyl(parent, 0.06, 0.08, 3.2, M.black, x, y, z, 6, false);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), M.emissiveWarm);
    bulb.position.set(x, y + 3.25, z); parent.add(bulb);
    this.light(parent, x, y + 3.1, z, 0xffb060, 10, 16, { lamp: true });
  }

  // Western-style timber building with porch, roof and sign.
  building(x, z, ry, w, d, hgt, opts = {}) {
    const M = this.M;
    const g = this.anchor(x, z, ry, opts.y);
    const wallMat = opts.mat || M.wood;
    const trim = M.trim;
    const t = 0.22;
    const nb = (w_, h_, d_, m, x_, y_, z_, r = 0) => this.box(g, w_, h_, d_, m, x_, y_, z_, r, false);
    // stone footing + plank floor
    this.box(g, w + 0.1, 0.45, d + 0.1, M.stone, 0, -0.35, 0, 0, false);
    this.box(g, w, 0.3, d, M.darkWood, 0, -0.1, 0, 0, true, true);
    // walls with door gap on front (+z)
    this.box(g, w, hgt, t, wallMat, 0, 0, -d / 2);
    this.box(g, t, hgt, d, wallMat, -w / 2, 0, 0);
    this.box(g, t, hgt, d, wallMat, w / 2, 0, 0);
    const doorW = 1.6;
    const sideW = (w - doorW) / 2;
    this.box(g, sideW, hgt, t, wallMat, -w / 2 + sideW / 2, 0, d / 2);
    this.box(g, sideW, hgt, t, wallMat, w / 2 - sideW / 2, 0, d / 2);
    this.box(g, doorW, hgt - 2.4, t, wallMat, 0, 2.4, d / 2, 0, false);
    // timber frame: corner posts, sill and top plates
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) nb(0.26, hgt + 0.05, 0.26, trim, sx * w / 2, 0, sz * d / 2);
    for (const sz of [-1, 1]) { nb(w + 0.1, 0.16, t + 0.08, trim, 0, 0.12, sz * d / 2); nb(w + 0.1, 0.18, t + 0.08, trim, 0, hgt - 0.18, sz * d / 2); }
    for (const sx of [-1, 1]) { nb(t + 0.08, 0.16, d, trim, sx * w / 2, 0.12, 0); nb(t + 0.08, 0.18, d, trim, sx * w / 2, hgt - 0.18, 0); }
    // door frame + half-open door
    for (const sx of [-1, 1]) nb(0.14, 2.45, 0.32, trim, sx * (doorW / 2 + 0.07), 0, d / 2);
    nb(doorW + 0.42, 0.16, 0.34, trim, 0, 2.4, d / 2);
    const door = this.box(g, 0.9, 2.3, 0.07, M.darkWood, -doorW / 2 + 0.45, 0.02, d / 2 - 0.2, 0, false);
    door.rotation.y = -1.1; door.position.x = -doorW / 2 + 0.2; door.position.z = d / 2 - 0.45;
    // windows: frame, sill, cross mullion, shutters; glass reads dark or warmly lit
    const win = (wx, wy, wz, ry2) => {
      const wg = new THREE.Group(); wg.position.set(wx, wy, wz); wg.rotation.y = ry2; g.add(wg);
      const add = (geo, m, px, py, pz, rz = 0) => { const me = new THREE.Mesh(geo, m); me.position.set(px, py, pz); me.rotation.z = rz; me.castShadow = true; me.receiveShadow = true; wg.add(me); return me; };
      const glass = add(new THREE.PlaneGeometry(1.0, 1.15), opts.lit ? M.emissiveWarm : M.windowDark, 0, 0, t / 2 + 0.02);
      glass.castShadow = false;
      add(new THREE.BoxGeometry(1.24, 0.1, 0.12), trim, 0, 0.62, t / 2 + 0.05);
      add(new THREE.BoxGeometry(1.36, 0.08, 0.22), trim, 0, -0.62, t / 2 + 0.08);
      for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.1, 1.3, 0.12), trim, sx * 0.57, 0, t / 2 + 0.05);
      add(new THREE.BoxGeometry(0.04, 1.15, 0.05), trim, 0, 0, t / 2 + 0.04);
      add(new THREE.BoxGeometry(1.0, 0.04, 0.05), trim, 0, 0.05, t / 2 + 0.04);
      if (this.rng() < 0.75) for (const sx of [-1, 1]) {
        const sh = add(new THREE.BoxGeometry(0.52, 1.25, 0.05), M.shutter, sx * 0.9, 0, t / 2 + 0.06);
        if (this.rng() < 0.2) { sh.rotation.z = sx * 0.3; sh.position.y -= 0.1; }
      }
    };
    for (const sx of [-1, 1]) win(sx * Math.min(w / 4 + 0.3, w / 2 - 1.0), 1.75, d / 2, 0);
    for (const sx of [-1, 1]) if (d > 5) win(sx * w / 2, 1.75, 0, sx * Math.PI / 2);
    if (w > 7) win(0, 1.75, -d / 2, Math.PI);
    // gable roof (ridge along x), corrugated iron with overhang, gable-end infill and fascia
    const pitch = 0.42, ov = 0.55;
    const run = d / 2 + ov, rise = Math.tan(pitch) * (d / 2);
    const slab = Math.hypot(run, Math.tan(pitch) * run);
    for (const sz of [-1, 1]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(w + ov * 2, 0.08, slab), opts.roof || M.roofRed);
      r.position.set(0, hgt + rise / 2 + 0.06 + Math.tan(pitch) * ov * 0.5 - Math.tan(pitch) * ov * 0.5, sz * (run / 2 - ov / 2) + sz * ov / 2 - sz * ov / 2);
      r.position.z = sz * (slab * Math.cos(pitch)) / 2 - sz * 0.0;
      r.position.y = hgt + rise - Math.tan(pitch) * Math.abs(r.position.z) + 0.04;
      r.rotation.x = sz * pitch; r.castShadow = true; r.receiveShadow = true; g.add(r);
      const fas = new THREE.Mesh(new THREE.BoxGeometry(w + ov * 2, 0.22, 0.05), trim);
      fas.position.set(0, hgt + rise - Math.tan(pitch) * run - 0.05, sz * run); fas.castShadow = true; g.add(fas);
    }
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(w + ov * 2 + 0.05, 0.12, 0.3), M.metal); ridge.position.set(0, hgt + rise + 0.07, 0); g.add(ridge);
    const gable = new THREE.Shape(); gable.moveTo(-d / 2, 0); gable.lineTo(d / 2, 0); gable.lineTo(0, rise); gable.closePath();
    for (const sx of [-1, 1]) {
      const ge = new THREE.Mesh(new THREE.ExtrudeGeometry(gable, { depth: t, bevelEnabled: false }), wallMat);
      ge.rotation.y = Math.PI / 2; ge.position.set(sx * w / 2 - t / 2, hgt, 0); ge.castShadow = true; ge.receiveShadow = true; g.add(ge);
    }
    // false front (western facade) with stepped parapet and cornice
    if (opts.facade) {
      const fh = rise + 1.4;
      nb(w + 0.3, fh, 0.24, wallMat, 0, hgt, d / 2 + 0.02);
      nb(w * 0.45, 0.6, 0.24, wallMat, 0, hgt + fh, d / 2 + 0.02);
      nb(w + 0.6, 0.16, 0.42, trim, 0, hgt + fh - 0.05, d / 2 + 0.06);
      nb(w * 0.45 + 0.3, 0.14, 0.4, trim, 0, hgt + fh + 0.58, d / 2 + 0.06);
      for (let i = 0; i < Math.floor(w / 0.9); i++) nb(0.12, 0.2, 0.08, trim, -w / 2 + 0.45 + i * 0.9, hgt + fh - 0.25, d / 2 + 0.17);
      for (const sx of [-1, 1]) nb(0.28, fh + 0.05, 0.3, trim, sx * (w / 2 + 0.05), hgt, d / 2 + 0.04);
    }
    // porch: deck, square posts with knee braces, railing, lean-to roof, steps
    if (opts.porch !== false) {
      const pd = 2.4, pz = d / 2 + pd / 2;
      this.box(g, w + 0.2, 0.22, pd, M.darkWood, 0, -0.02, pz, 0, true, true);
      nb(w + 0.3, 0.2, 0.18, trim, 0, -0.1, d / 2 + pd);
      const ph = hgt - 0.35;
      const xs = []; const nPost = Math.max(2, Math.round(w / 3.2) + 1);
      for (let i = 0; i < nPost; i++) xs.push(-w / 2 + 0.15 + (i / (nPost - 1)) * (w - 0.3));
      for (const px of xs) {
        nb(0.18, ph, 0.18, trim, px, 0.18, d / 2 + pd - 0.15);
        nb(0.08, 0.08, 0.7, trim, px, ph - 0.35, d / 2 + pd - 0.5).rotation.x = 0.8;
      }
      for (let i = 0; i < xs.length - 1; i++) {
        const mid = (xs[i] + xs[i + 1]) / 2, len = xs[i + 1] - xs[i] - 0.18;
        if (Math.abs(mid) < 1.2) continue; // gap for the steps
        nb(len, 0.08, 0.08, trim, mid, 1.0, d / 2 + pd - 0.15);
        nb(len, 0.06, 0.06, trim, mid, 0.55, d / 2 + pd - 0.15);
        for (let k = 1; k < Math.floor(len / 0.35); k++) nb(0.05, 0.45, 0.05, trim, xs[i] + 0.09 + k * 0.35, 0.55, d / 2 + pd - 0.15);
      }
      nb(w + 0.4, 0.2, 0.16, trim, 0, ph + 0.15, d / 2 + pd - 0.15);
      const pr = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.07, pd + 0.5), opts.roof || M.roofRed);
      pr.position.set(0, ph + 0.42, pz + 0.1); pr.rotation.x = 0.16; pr.castShadow = true; pr.receiveShadow = true; g.add(pr);
      for (let k = 0; k < 2; k++) this.box(g, 2.2, 0.16, 0.4, M.darkWood, 0, -0.32 - k * 0.18, d / 2 + pd + 0.2 + k * 0.38, 0, true, true);
      // clutter: barrels and a crate on the deck
      if (this.rng() < 0.8) { const bx = (this.rng() < 0.5 ? -1 : 1) * (w / 2 - 0.6); this.barrel(g, bx, 0.2, d / 2 + 0.7); if (this.rng() < 0.6) this.barrel(g, bx - Math.sign(bx) * 0.75, 0.2, d / 2 + 0.6); }
      if (this.rng() < 0.5) nb(0.7, 0.6, 0.7, M.darkWood, (this.rng() < 0.5 ? -1 : 1) * (w / 2 - 1.8), 0.2, d / 2 + 0.6, this.rng());
    }
    if (opts.sign) this.sign(g, opts.sign, 0, hgt + (opts.facade ? 1.0 : 0.9), d / 2 + (opts.facade ? 0.17 : 0.25), opts.signColor);
    if (opts.lit) {
      this.light(g, 0, hgt * 0.6, 0, 0xffa860, 8, 12, { lamp: true });
    }
    return g;
  }

  barrel(parent, x, y, z) {
    const M = this.M;
    const b = this.cyl(parent, 0.3, 0.27, 0.9, M.barrel, x, y, z, 12, false);
    for (const hy of [0.15, 0.75]) this.cyl(parent, 0.31, 0.31, 0.06, M.metal, x, y + hy, z, 12, false);
    return b;
  }

  sign(parent, text, x, y, z, color = '#f3e2b0', w = 4.2) {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 128;
    const c = cv.getContext('2d');
    c.fillStyle = '#3b2616'; c.fillRect(0, 0, 512, 128);
    c.strokeStyle = '#1d120a'; c.lineWidth = 10; c.strokeRect(5, 5, 502, 118);
    c.fillStyle = color; c.font = 'bold 64px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, 256, 68);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    m.position.set(x, y, z); parent.add(m);
    return m;
  }

  tent(x, z, ry, red = false) {
    const g = this.anchor(x, z, ry);
    const geo = new THREE.ConeGeometry(2.2, 2.6, 4, 1, true);
    const m = new THREE.Mesh(geo, red ? this.M.canvasRed : this.M.canvas);
    m.position.y = 1.3; m.rotation.y = Math.PI / 4; m.castShadow = true; g.add(m);
    this.colliders.addCircle(x, z, 1.6, g.position.y, g.position.y + 2.6);
    return g;
  }

  crate(x, z, ry = 0, lootable = false, y = null, forceId = null) {
    const g = this.anchor(x, z, ry, y);
    this.box(g, 1, 0.8, 0.8, this.M.wood, 0, 0, 0);
    if (lootable) {
      const lid = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.1, 0.85), this.M.yellow);
      lid.position.y = 0.85; lid.userData.dynamic = true; g.add(lid);
      const id = forceId || 'crate_' + Math.round(x) + '_' + Math.round(z);
      const item = { pos: g.position.clone().add(new THREE.Vector3(0, 0.6, 0)), radius: 2, label: 'Search supply crate', action: 'loot', id, mesh: lid };
      this.interactables.push(item);
    }
    return g;
  }

  watchtower(x, z, ry = 0) {
    const M = this.M;
    const g = this.anchor(x, z, ry);
    for (const [a, b] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) this.cyl(g, 0.15, 0.18, 7, M.darkWood, a, 0, b, 6);
    this.box(g, 3.4, 0.25, 3.4, M.wood, 0, 6.8, 0, 0, true, true);
    for (const [a, b, w, d] of [[0, -1.65, 3.4, 0.12], [0, 1.65, 3.4, 0.12], [-1.65, 0, 0.12, 3.4], [1.65, 0, 0.12, 3.4]]) this.box(g, w, 1.1, d, M.wood, a, 7.05, b);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 1.6, 4), M.thatch);
    roof.position.y = 9.6; roof.rotation.y = Math.PI / 4; roof.castShadow = true; g.add(roof);
    for (const [a, b] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) this.cyl(g, 0.06, 0.06, 1.8, M.darkWood, a, 7.9, b, 4, false);
    // ladder
    const ladder = new THREE.Group();
    for (let i = 0; i < 14; i++) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.05), M.darkWood); r.position.set(0, i * 0.5 + 0.3, 1.75); ladder.add(r); }
    g.add(ladder);
    g.updateMatrixWorld(true);
    const top = new THREE.Vector3(0, 7.1, 0).applyMatrix4(g.matrixWorld);
    const base = new THREE.Vector3(0, 0, 2.2).applyMatrix4(g.matrixWorld);
    this.interactables.push({ pos: base, radius: 1.6, label: 'Climb tower', action: 'climb', to: top, id: 'tower' + Math.round(x) });
    return { group: g, top };
  }

  // Classic electrified paddock fence: tall posts with horizontal cables. Some sections broken.
  fence(points, broken = [], post = 7) {
    const M = this.M;
    const posts = [], cables = [];
    for (let i = 0; i < points.length - 1; i++) {
      const [ax, az] = points[i], [bx, bz] = points[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.round(len / 8));
      const isBroken = broken.includes(i);
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
        const y = this.h(x, z);
        const lean = isBroken && k > 0 && k < n ? (this.rng() - 0.5) * 0.9 : 0;
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, post, 0.5), M.concrete);
        p.position.set(x, y + post / 2 - 0.5, z);
        p.rotation.z = lean; p.rotation.y = Math.atan2(bx - ax, bz - az);
        posts.push(p);
        if (k < n && !(isBroken && k > 0 && k < n - 1)) {
          const x2 = ax + (bx - ax) * ((k + 1) / n), z2 = az + (bz - az) * ((k + 1) / n);
          const y2 = this.h(x2, z2);
          for (let c = 0; c < 5; c++) {
            const hy = 1 + c * 1.2;
            const a = new THREE.Vector3(x, y + hy, z), b = new THREE.Vector3(x2, y2 + hy, z2);
            const mid = a.clone().add(b).multiplyScalar(0.5); mid.y -= 0.12;
            const cab = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, a.distanceTo(b), 3), M.metal);
            cab.position.copy(mid); cab.lookAt(b); cab.rotateX(Math.PI / 2);
            cables.push(cab);
          }
          const cx = (x + x2) / 2, cz = (z + z2) / 2;
          this.colliders.addBox(cx, cz, 0.3, Math.hypot(x2 - x, z2 - z) / 2, Math.atan2(x2 - x, z2 - z), Math.min(y, y2) - 1, Math.max(y, y2) + post);
        }
      }
    }
    // merge for draw-call efficiency
    const mergeInto = (list, mat) => {
      if (!list.length) return;
      const geos = list.map((m) => { m.updateMatrix(); return m.geometry.clone().applyMatrix4(m.matrix); });
      const mesh = new THREE.Mesh(merge(geos), mat);
      mesh.castShadow = true; mesh.receiveShadow = true;
      this.group.add(mesh);
    };
    mergeInto(posts, M.concrete);
    mergeInto(cables, M.metal);
  }

  jeep(x, z, ry, wrecked = true, red = false) {
    const M = this.M;
    const g = this.anchor(x, z, ry);
    const body = red ? M.jeepRed : M.jeepBody;
    g.rotation.z = wrecked ? (this.rng() - 0.5) * 0.3 : 0;
    this.box(g, 1.9, 0.8, 4.2, body, 0, 0.5, 0);
    this.box(g, 1.85, 0.6, 1.4, body, 0, 1.3, 1.1, 0, false);
    const ws = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.6), M.glass); ws.position.set(0, 1.9, 0.4); ws.rotation.x = -0.3; g.add(ws);
    // roll bar
    const bar = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.05, 6, 12, Math.PI), M.black); bar.position.set(0, 1.3, -0.6); g.add(bar);
    for (const [a, b] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.32, 14), M.black);
      w.rotation.z = Math.PI / 2; w.position.set(a, 0.42, b); w.castShadow = true; g.add(w);
    }
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.12, 4.22), red ? M.yellow : M.jeepRed);
    stripe.position.y = 0.95; g.add(stripe);
    return g;
  }

  build() {
    const M = this.M;
    this.buildHaven();
    this.buildGate();
    this.buildBunker();
    this.buildRaptorPen();
    this.buildGeothermal();
    this.buildTower();
    this.buildCraneCamp();
    this.buildAviary();
    this.buildDocks();
    this.buildLodge();
    this.buildHatchery();
    this.buildShipwreck();
    // T-Rex paddock fence (partly broken)
    const R = locById.rexpaddock;
    const pts = [];
    for (let i = 0; i <= 14; i++) { const a = (i / 14) * Math.PI * 2; pts.push([R.x + Math.cos(a) * 120, R.z + Math.sin(a) * 100]); }
    this.fence(pts, [2, 3, 8, 11]);
    // abandoned jeeps along roads
    this.jeep(70, 640, 0.4, true); this.jeep(-210, 140, 1.4, true, true); this.jeep(300, 345, 2.4, true); this.jeep(-220, -170, 0.8, true, true);
    // scattered loot crates in the wild
    for (const [x, z] of [[310, 420], [-140, -40], [520, 120], [-380, -330], [180, -380], [-640, 120], [640, -260], [90, -520], [-520, 380], [420, 560]]) this.crate(x, z, this.rng() * 6, true);
    this.optimize();
  }

  // Static batching: merge every non-dynamic mesh by material within 160m cells (keeps frustum culling useful).
  optimize() {
    this.group.updateMatrixWorld(true);
    const buckets = new Map();
    const victims = [];
    this.group.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || o.userData.dynamic || o.material === this.beacon?.material) return;
      const wp = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
      const key = o.material.uuid + ':' + Math.floor(wp.x / 160) + ':' + Math.floor(wp.z / 160) + ':' + (o.castShadow ? 1 : 0);
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      if (o.material.userData.boxMap && !o.geometry.userData.uvMetres) boxUV(g, _sc.setFromMatrixScale(o.matrixWorld));
      g.applyMatrix4(o.matrixWorld);
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.attributes.normal) g.computeVertexNormals();
      if (!buckets.has(key)) buckets.set(key, { mat: o.material, geos: [], shadow: o.castShadow });
      buckets.get(key).geos.push(g);
      victims.push(o);
    });
    for (const o of victims) o.removeFromParent();
    for (const b of buckets.values()) {
      const m = new THREE.Mesh(mergeGeometries(b.geos), b.mat);
      m.castShadow = b.shadow; m.receiveShadow = true;
      m.matrixAutoUpdate = false;
      this.group.add(m);
    }
  }

  buildHaven() {
    const L = locById.haven;
    const M = this.M;
    const y = L.h;
    // Visitor Center: big concrete hall with thatched roof (the iconic look) — now Haven's town hall.
    const vc = this.anchor(L.x, L.z - 40, 0, y);
    this.box(vc, 34, 0.4, 20, M.concrete, 0, -0.2, 0, 0, true, true);
    this.box(vc, 34, 9, 0.6, M.concrete, 0, 0, -10);
    this.box(vc, 0.6, 9, 20, M.concrete, -17, 0, 0);
    this.box(vc, 0.6, 9, 20, M.concrete, 17, 0, 0);
    this.box(vc, 13, 9, 0.6, M.concrete, -10.5, 0, 10);
    this.box(vc, 13, 9, 0.6, M.concrete, 10.5, 0, 10);
    this.box(vc, 8, 3, 0.6, M.concrete, 0, 6, 10, 0, false);
    const glassFront = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 6), M.glass); glassFront.position.set(0, 3, 10.35); vc.add(glassFront);
    // shattered: leave opening walkable (glass is visual only)
    const roof1 = new THREE.Mesh(new THREE.ConeGeometry(16, 7, 4, 1), M.thatch);
    roof1.scale.set(1.45, 1, 0.85); roof1.rotation.y = Math.PI / 4; roof1.position.set(0, 12.3, 0); roof1.castShadow = true; vc.add(roof1);
    const roof2 = new THREE.Mesh(new THREE.ConeGeometry(7, 5, 4, 1), M.thatch);
    roof2.rotation.y = Math.PI / 4; roof2.position.set(0, 17, 0); roof2.castShadow = true; vc.add(roof2);
    this.sign(vc, 'HAVEN', 0, 10.3, 10.5, '#ffd27a', 9);
    // banner inside: skeleton-like props (rex skull)
    const skull = new THREE.Mesh(new THREE.DodecahedronGeometry(1.6, 0), M.stone); skull.scale.set(1.6, 0.9, 0.8); skull.position.set(0, 5.2, -5); vc.add(skull);
    for (let i = -2; i <= 2; i++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 8.8, 8), M.concrete); p.position.set(i * 6, 4.4, 9.8); vc.add(p); }

    // Main street: two rows of western buildings facing each other along the road (z axis).
    const names = [['GENERAL STORE', 'store'], ['SALOON', 'saloon'], ["MARSHAL", 'marshal'], ['DOCTOR', 'doctor'], ['GUNSMITH', 'gunsmith'], ['STABLES', 'stables']];
    const rows = [[-15, Math.PI / 2], [15, -Math.PI / 2]];
    let k = 0;
    this.havenBuildings = {};
    for (let i = 0; i < 3; i++) for (const [sx, ry] of rows) {
      const [label, id] = names[k++];
      const zz = L.z - 8 + i * 17;
      const w = 10, d = 8;
      const g = this.building(L.x + sx + Math.sign(sx) * 4, zz, ry, w, d, 4.6 + (i % 2) * 0.8, { y, sign: label, facade: true, lit: true, roof: i % 2 ? M.roofGreen : M.roofRed });
      g.updateMatrixWorld(true);
      const door = new THREE.Vector3(0, 0, d / 2 + 2).applyMatrix4(g.matrixWorld);
      this.havenBuildings[id] = door;
    }
    // Street dressing
    for (let i = 0; i < 6; i++) { this.addLamp(this.group, L.x + (i % 2 ? 7 : -7), y, L.z - 12 + i * 9); }
    this.addFire(this.group, L.x, y, L.z + 30, true);
    for (const [x, z] of [[-6, 18], [6, 26], [-5, 33], [8, -18]]) this.crate(L.x + x, L.z + z, this.rng() * 3, false, y);
    // hitching rails
    for (const sx of [-9, 9]) {
      const g = this.anchor(L.x + sx, L.z + 5, 0, y);
      this.box(g, 0.12, 0.12, 6, M.darkWood, 0, 1.0, 0, 0, false);
      this.cyl(g, 0.08, 0.08, 1.1, M.darkWood, 0, 0, -2.8, 5, false); this.cyl(g, 0.08, 0.08, 1.1, M.darkWood, 0, 0, 2.8, 5, false);
    }
    // water tower
    const wt = this.anchor(L.x + 30, L.z + 20, 0, y);
    for (const [a, b] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) this.cyl(wt, 0.15, 0.2, 8, M.darkWood, a, 0, b, 6);
    this.cyl(wt, 2.4, 2.4, 3.6, M.wood, 0, 8, 0, 16, false);
    const wtr = new THREE.Mesh(new THREE.ConeGeometry(2.7, 1.4, 16), M.roofGreen); wtr.position.y = 12.3; wt.add(wtr);
    // palisade wall around Haven with gaps for roads
    const pal = [];
    const R = 62;
    for (let a = 0; a < Math.PI * 2; a += 0.045) {
      const deg = (a * 180) / Math.PI;
      // gaps: south (90°), west (180°), east-ish (330°), north (270°)
      if (Math.abs(deg - 90) < 8 || Math.abs(deg - 180) < 8 || Math.abs(deg - 330) < 9 || Math.abs(deg - 250) < 8) continue;
      const x = L.x + Math.cos(a) * R, z = L.z + Math.sin(a) * R;
      const hh = this.h(x, z);
      const ph = 4.2 + this.rng() * 0.8;
      const g = new THREE.CylinderGeometry(0.22, 0.26, ph, 7, 3);
      g.translate(0, 2.1, 0);
      metreUV(g, Math.PI * 2 * 0.24, ph, this.rng() * 5);
      const cone = new THREE.ConeGeometry(0.22, 0.6, 7); cone.translate(0, 4.6, 0);
      metreUV(cone, Math.PI * 2 * 0.22, 0.6, 0);
      const both = merge([g, cone]);
      both.translate(x, hh - 0.3, z);
      pal.push(both);
      this.colliders.addCircle(x, z, 0.4, hh - 1, hh + 5);
    }
    const palMesh = new THREE.Mesh(merge(pal), M.bark); palMesh.geometry.userData.uvMetres = true; palMesh.castShadow = true; palMesh.receiveShadow = true; this.group.add(palMesh);
    this.havenTowers = [];
    for (const [ax, az] of [[0, 1], [-1, 0], [0.866, -0.5], [-0.34, -0.94]]) {
      this.havenTowers.push(this.watchtower(L.x + ax * (R + 4) + az * 8, L.z + az * (R + 4) - ax * 8, 0).top);
    }
    this.interactables.push({ pos: this.havenBuildings.store.clone(), radius: 3, label: 'Trade at General Store', action: 'shop', id: 'store' });
    this.interactables.push({ pos: this.havenBuildings.gunsmith.clone(), radius: 3, label: 'Visit Gunsmith', action: 'shop', id: 'gunsmith' });
    this.interactables.push({ pos: this.havenBuildings.doctor.clone(), radius: 3, label: 'See the Doctor (heal $10)', action: 'doctor', id: 'doctor' });
    this.interactables.push({ pos: this.havenBuildings.marshal.clone(), radius: 3, label: 'Bounty board', action: 'bounty', id: 'bounty' });
    this.interactables.push({ pos: this.havenBuildings.saloon.clone(), radius: 3, label: 'Sleep at Saloon ($5)', action: 'sleep', id: 'saloon' });
  }

  buildGate() {
    const L = locById.gate;
    const M = this.M;
    const g = this.anchor(L.x, L.z, 0, L.h);
    // Two massive log pillars with torches, and a crossbeam sign. The gate doors hang open.
    for (const sx of [-7, 7]) {
      this.box(g, 3, 14, 3, M.darkWood, sx, 0, 0);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(2.4, 2.5, 4), M.thatch); cap.position.set(sx, 15.2, 0); cap.rotation.y = Math.PI / 4; g.add(cap);
      // torch braziers
      const br = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.3, 0.6, 8), M.black); br.position.set(sx + Math.sign(sx) * -1.6, 8, 2.2); g.add(br);
      this.addFireSprite(g, sx + Math.sign(sx) * -1.6, 8.6, 2.2);
    }
    this.box(g, 18, 2.6, 1.5, M.darkWood, 0, 11.5, 0, 0, false);
    this.sign(g, 'JURASSIC PARK', 0, 12.8, 0.8, '#ffb347', 12);
    const gateTex = M.darkWood;
    const d1 = new THREE.Mesh(new THREE.BoxGeometry(5.5, 9, 0.4), gateTex); d1.position.set(-8, 4.5, 3.4); d1.rotation.y = 1.2; d1.castShadow = true; g.add(d1);
    const d2 = new THREE.Mesh(new THREE.BoxGeometry(5.5, 9, 0.4), gateTex); d2.position.set(8, 4.5, 3.4); d2.rotation.y = -1.2; d2.castShadow = true; g.add(d2);
    // walls extending off into jungle
    this.fence([[L.x - 9, L.z], [L.x - 50, L.z + 6], [L.x - 110, L.z - 5]], [1], 6);
    this.fence([[L.x + 9, L.z], [L.x + 60, L.z - 4], [L.x + 115, L.z + 8]], [], 6);
  }

  addFireSprite(parent, x, y, z) {
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: getTex('glow'), color: 0xff8a30, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    flame.scale.set(2.2, 2.8, 1); flame.position.set(x, y, z); parent.add(flame);
    this.light(parent, x, y + 0.5, z, 0xff7a30, 22, 26, { flame });
  }

  buildBunker() {
    const L = locById.bunker;
    const M = this.M;
    const g = this.anchor(L.x, L.z, -0.4, L.h);
    // half-buried concrete bunker with a steel door
    this.box(g, 9, 3.4, 7, M.concrete, 0, -0.4, 0);
    const mound = new THREE.Mesh(new THREE.SphereGeometry(6.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ map: getTex('grass'), roughness: 1 }));
    mound.scale.set(1.25, 0.5, 1.1); mound.position.set(0, 0.2, -2.6); mound.receiveShadow = true; g.add(mound);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.4, 0.15), M.rust); door.position.set(0, 1.2, 3.55); door.rotation.y = 0.0; g.add(door);
    this.sign(g, 'RANGER STATION 4', 0, 2.75, 3.56, '#e8d8a0', 3.2);
    this.addFire(g, 3, 0, 7);
    this.crate(L.x - 4, L.z + 6, 0.4, true);
    this.tent(L.x + 8, L.z + 2, 0.3);
  }

  buildRaptorPen() {
    const L = locById.raptorpen;
    const M = this.M;
    // the famous high-walled raptor enclosure, now a gang hideout
    const pts = [];
    for (let i = 0; i <= 10; i++) { const a = (i / 10) * Math.PI * 2; pts.push([L.x + Math.cos(a) * 32, L.z + Math.sin(a) * 26]); }
    this.fence(pts, [3, 7], 9);
    this.campTowers = { raptorpen: [this.watchtower(L.x + 30, L.z - 20, 0.3).top, this.watchtower(L.x - 28, L.z + 22, 1.2).top] };
    this.building(L.x - 10, L.z - 6, 0.4, 8, 6, 3.6, { mat: M.darkWood, roof: M.rust, porch: false });
    this.tent(L.x + 8, L.z + 8, 0.5, true);
    this.tent(L.x + 14, L.z - 4, 1.2, true);
    this.addFire(this.group, L.x + 2, L.h, L.z + 2);
    for (const [x, z] of [[-4, 12], [16, 10], [10, -14]]) this.crate(L.x + x, L.z + z, this.rng() * 3, false);
    this.crate(L.x - 14, L.z + 2, 0.4, true, null, 'fusecrate');
    this.sign(this.anchor(L.x + 36, L.z, Math.PI / 2), 'KEEP OUT - BLACK FANG', 0, 2.2, 0, '#ff6a50', 4.2);
  }

  buildGeothermal() {
    const L = locById.geothermal;
    const M = this.M;
    const g = this.anchor(L.x, L.z, 0.3, L.h);
    this.box(g, 22, 9, 14, M.concrete, 0, 0, 0);
    this.box(g, 23, 0.6, 15, M.rust, 0, 9, 0, 0, false);
    for (const [x, z] of [[-14, -4], [-14, 4], [14, 0]]) this.cyl(g, 2.2, 2.4, 14, M.metal, x, 0, z, 14);
    for (const x of [-8, 0, 8]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 30, 8), M.rust);
      pipe.rotation.z = Math.PI / 2; pipe.position.set(x, 1.2, 10); pipe.rotation.y = Math.PI / 2; g.add(pipe);
    }
    this.sign(g, 'GEOTHERMAL PLANT', 0, 7.5, 7.1, '#ffd060', 8);
    g.updateMatrixWorld(true);
    const panel = new THREE.Vector3(0, 0, 8.6).applyMatrix4(g.matrixWorld);
    this.powerPanel = panel;
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2, 0.5), M.yellow); box.position.set(0, 1, 7.4); g.add(box);
    this.interactables.push({ pos: panel, radius: 2.6, label: 'Restore power', action: 'power', id: 'power' });
    this.campTowers.geothermal = [this.watchtower(L.x + 30, L.z + 24, 0).top];
    this.tent(L.x - 24, L.z + 22, 0.4, true);
    this.tent(L.x - 30, L.z + 14, 1.1, true);
    this.addFire(this.group, L.x - 26, this.h(L.x - 26, L.z + 30), L.z + 30);
    this.crate(L.x + 18, L.z + 22, 0.2, true);
  }

  buildTower() {
    const L = locById.tower;
    const M = this.M;
    const g = this.anchor(L.x, L.z, 0, L.h);
    // lattice radio mast
    const H = 38;
    const legs = [[-2, -2], [2, -2], [-2, 2], [2, 2]];
    const parts = [];
    for (const [a, b] of legs) {
      const c = new THREE.CylinderGeometry(0.12, 0.2, H, 5); c.translate(0, H / 2, 0);
      const m = new THREE.Matrix4().makeTranslation(a, 0, b);
      // taper towards top
      const pa = c.attributes.position;
      for (let i = 0; i < pa.count; i++) { const t = pa.getY(i) / H; pa.setX(i, pa.getX(i) - a * t * 0.8); pa.setZ(i, pa.getZ(i) - b * t * 0.8); }
      c.applyMatrix4(m); parts.push(c);
    }
    for (let y = 2; y < H; y += 3) {
      const s = 2 * (1 - (y / H) * 0.8);
      for (const [ax, az, bx, bz] of [[-s, -s, s, -s], [s, -s, s, s], [s, s, -s, s], [-s, s, -s, -s]]) {
        const a = new THREE.Vector3(ax, y, az), b = new THREE.Vector3(bx, y + 1.5, bz);
        const c = new THREE.CylinderGeometry(0.05, 0.05, a.distanceTo(b), 3);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
        c.applyQuaternion(q); c.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
        parts.push(c);
      }
    }
    const mast = new THREE.Mesh(merge(parts), M.rust); mast.castShadow = true; g.add(mast);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2010, emissiveIntensity: 4 }));
    beacon.position.y = H + 0.5; g.add(beacon);
    this.beacon = beacon;
    this.colliders.addBox(L.x, L.z, 2.2, 2.2, 0, L.h, L.h + H);
    this.building(L.x + 8, L.z + 6, -0.5, 6, 5, 3.2, { mat: M.concrete, roof: M.rust, porch: false, y: L.h });
    g.updateMatrixWorld(true);
    this.radioPos = new THREE.Vector3(L.x + 6, L.h, L.z + 9);
    this.interactables.push({ pos: this.radioPos, radius: 3, label: 'Use radio transmitter', action: 'radio', id: 'radio' });
  }

  buildCraneCamp() {
    const L = locById.cranecamp;
    const M = this.M;
    // fortified log walls, towers, big tents, fires
    const pts = [];
    for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI * 2; pts.push([L.x + Math.cos(a) * 46, L.z + Math.sin(a) * 40]); }
    const walls = [];
    for (let i = 0; i < pts.length - 1; i++) {
      if (i === 1 || i === 7) continue; // gates
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.ceil(len / 0.55);
      for (let k = 0; k < n; k++) {
        const t = k / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
        const hh = this.h(x, z);
        const c = new THREE.CylinderGeometry(0.28, 0.3, 5.5 + this.rng(), 5); c.translate(x, hh + 2.4, z); walls.push(c);
      }
      this.colliders.addBox((ax + bx) / 2, (az + bz) / 2, 0.4, len / 2, Math.atan2(bx - ax, bz - az), -50, 400);
    }
    const wm = new THREE.Mesh(merge(walls), M.darkWood); wm.castShadow = true; wm.receiveShadow = true; this.group.add(wm);
    this.campTowers.cranecamp = [this.watchtower(L.x + 40, L.z - 18, 0).top, this.watchtower(L.x - 40, L.z + 18, 0.5).top, this.watchtower(L.x + 4, L.z + 38, 0.2).top];
    this.building(L.x, L.z - 18, 0, 12, 9, 5, { mat: M.darkWood, roof: M.rust, sign: "CRANE'S LAW", signColor: '#ff7050', lit: true });
    this.tent(L.x - 18, L.z + 4, 0.2, true); this.tent(L.x + 18, L.z + 8, 1.0, true); this.tent(L.x + 8, L.z + 18, 2.2, true);
    this.addFire(this.group, L.x, L.h, L.z + 6, true);
    for (const [x, z] of [[-10, 14], [14, -4], [-20, -10]]) this.crate(L.x + x, L.z + z, this.rng() * 3, false);
    this.crate(L.x + 4, L.z - 12, 0, true, null, 'cranecrate');
    // cages with captured raptors (visual)
    for (const x of [-24, -30]) {
      const g = this.anchor(L.x + x, L.z - 14, 0);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; this.cyl(g, 0.05, 0.05, 2.6, M.rust, Math.cos(a) * 1.4, 0, Math.sin(a) * 1.4, 4, false); }
      this.colliders.addCircle(L.x + x, L.z - 14, 1.5, g.position.y, g.position.y + 2.6);
    }
  }

  buildAviary() {
    const L = locById.aviary;
    const M = this.M;
    // collapsed geodesic dome: half-sphere of struts, partly missing
    const g = this.anchor(L.x, L.z, 0, L.h);
    const geo = new THREE.IcosahedronGeometry(40, 2);
    const pos = geo.attributes.position;
    const segs = [];
    const seen = new Set();
    for (let i = 0; i < pos.count; i += 3) {
      for (let k = 0; k < 3; k++) {
        const a = new THREE.Vector3().fromBufferAttribute(pos, i + k), b = new THREE.Vector3().fromBufferAttribute(pos, i + ((k + 1) % 3));
        if (a.y < -1 || b.y < -1) continue;
        const key = [a, b].map((v) => v.toArray().map((n) => n.toFixed(1)).join(',')).sort().join('|');
        if (seen.has(key)) continue; seen.add(key);
        if (this.rng() < 0.22 && a.y > 10) continue; // collapsed gaps
        const c = new THREE.CylinderGeometry(0.18, 0.18, a.distanceTo(b), 4);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
        c.applyQuaternion(q); c.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
        segs.push(c);
      }
    }
    const dome = new THREE.Mesh(merge(segs), M.rust); dome.castShadow = true; g.add(dome);
    this.crate(L.x + 5, L.z + 10, 0, true);
  }

  buildDocks() {
    const L = locById.docks;
    const M = this.M;
    const g = this.anchor(L.x, L.z + 10, 0.1, 1.6);
    this.box(g, 6, 0.4, 50, M.wood, 0, 0.4, 20, 0, true, true);
    for (let i = 0; i < 12; i++) for (const sx of [-2.8, 2.8]) this.cyl(g, 0.22, 0.22, 6, M.darkWood, sx, -5, i * 4 + 0, 6, false);
    this.building(L.x - 14, L.z - 10, 0.1, 10, 7, 4, { sign: 'DOCK OFFICE', y: L.h });
    for (const [x, z] of [[8, -4], [10, -6], [-4, 6]]) this.crate(L.x + x, L.z + z, this.rng(), false);
    this.crate(L.x + 12, L.z - 2, 0, true);
    // a small boat moored at the end
    const boat = this.anchor(L.x + 9, L.z + 50, 0.1, 0.2);
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(2, 1.2, 9, 8, 1, false, 0, Math.PI), M.wood);
    hull.rotation.x = Math.PI / 2; hull.rotation.z = Math.PI; hull.position.y = 0.8; hull.castShadow = true; boat.add(hull);
    this.box(boat, 2.4, 1.8, 2.6, M.wood, 0, 0.8, -1.5, 0, false);
    this.boat = boat;
    this.interactables.push({ pos: new THREE.Vector3(L.x + 4, 2, L.z + 48), radius: 4, label: 'Inspect the boat', action: 'boat', id: 'boat' });
  }

  buildLodge() {
    const L = locById.lodge;
    this.building(L.x, L.z, -0.6, 14, 9, 4.2, { sign: 'SAFARI LODGE', roof: this.M.thatch, lit: true });
    this.addFire(this.group, L.x - 10, this.h(L.x - 10, L.z + 10), L.z + 10);
    this.crate(L.x + 9, L.z + 6, 0.5, true);
    this.jeep(L.x + 12, L.z - 10, 0.4, false);
  }

  buildHatchery() {
    const L = locById.hatchery;
    const M = this.M;
    const g = this.anchor(L.x, L.z, 0.7, L.h);
    this.box(g, 18, 6, 12, M.concrete, 0, 0, 0);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(18.2, 2, 12.2), M.glass); glass.position.y = 7; g.add(glass);
    this.box(g, 18.4, 0.3, 12.4, M.metal, 0, 8, 0, 0, false);
    this.sign(g, 'CREATION LAB', 0, 4.5, 6.1, '#aee0ff', 6);
    this.crate(L.x + 10, L.z + 8, 0.2, true, null, 'labcrate');
  }

  buildShipwreck() {
    const L = locById.westbeach;
    const M = this.M;
    const g = this.anchor(L.x - 62, L.z + 6, 0.8, -3);
    g.rotation.z = 0.25;
    const hull = new THREE.Mesh(new THREE.BoxGeometry(14, 12, 70), M.rust);
    hull.position.y = 4; hull.castShadow = true; hull.receiveShadow = true; g.add(hull);
    const bow = new THREE.Mesh(new THREE.ConeGeometry(7, 14, 4), M.rust); bow.rotation.x = Math.PI / 2; bow.rotation.y = Math.PI / 4; bow.scale.set(1, 1, 0.85); bow.position.set(0, 4, 41); g.add(bow);
    this.box(g, 10, 8, 12, M.metal, 0, 10, -22, 0, false);
    this.box(g, 1.2, 10, 1.2, M.rust, 0, 18, -24, 0, false);
    g.updateMatrixWorld(true);
    this.colliders.addBox(g.position.x, g.position.z, 7, 38, 0.8, -10, 20);
    this.crate(L.x - 6, L.z - 4, 0, true);
    this.crate(L.x + 4, L.z + 6, 0.8, false);
  }

  initLightPool(n) {
    this.pool = [];
    for (let i = 0; i < n; i++) {
      const l = new THREE.PointLight(0xffaa66, 0, 20, 1.7);
      this.group.add(l);
      this.pool.push(l);
    }
  }

  update(dt, t, camPos, night) {
    for (const L of this.lights) {
      if (L.lamp) { L.cur = night > 0.05 ? L.base * Math.min(1, night * 3) : 0; continue; }
      const f = 0.82 + Math.sin(t * 13 + L.phase) * 0.08 + Math.sin(t * 7.3 + L.phase * 2) * 0.1;
      L.cur = L.base * f * (0.35 + night * 0.65);
      if (L.flame) L.flame.scale.y = (L.flame.userData.sy ||= L.flame.scale.y) * (0.9 + f * 0.15);
    }
    if (this.beacon) this.beacon.material.emissiveIntensity = (Math.sin(t * 3) > 0 ? 5 : 0.3);
    if (!this.pool) return;
    // nearest active sources get the real lights
    const cand = this.lights.filter((L) => L.cur > 0.01);
    for (const L of cand) L.d2 = L.pos.distanceToSquared(camPos);
    cand.sort((a, b) => a.d2 - b.d2);
    for (let i = 0; i < this.pool.length; i++) {
      const pl = this.pool[i], L = cand[i];
      if (L && L.d2 < 160 * 160) {
        pl.position.copy(L.pos); pl.color.copy(L.color); pl.distance = L.dist;
        // fade out with distance to avoid popping
        pl.intensity = L.cur * (1 - Math.min(1, Math.max(0, (Math.sqrt(L.d2) - 110) / 50)));
      } else pl.intensity = 0;
    }
  }
}
