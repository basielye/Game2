// Drivable vehicles: the park's tour Jeep and Explorer SUV, and the supply bush plane.
// Arcade physics tuned for feel: cars use a bicycle model with grip-limited slip (handbrake drifts), terrain-following
// suspension and airborne jumps; the plane flies an energy-based arcade model with lift, stall, bank-to-turn and crashes.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clamp, damp, dampAngle, lerp } from '../core/math.js';
import { RUNWAY, locById } from '../data/world.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const UP = new THREE.Vector3(0, 1, 0);

// ---------------------------------------------------------------------------------------------- materials
const NOISE_GLSL = /* glsl */`
  float vh(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float vn(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(vh(i), vh(i + vec3(1,0,0)), f.x), mix(vh(i + vec3(0,1,0)), vh(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(vh(i + vec3(0,0,1)), vh(i + vec3(1,0,1)), f.x), mix(vh(i + vec3(0,1,1)), vh(i + vec3(1,1,1)), f.x), f.y), f.z); }`;

// Clear-coated paint with procedural mud: splashes concentrate low on the body and behind the wheels.
function paint(color, dirt = 0.6, opts = {}) {
  const m = new THREE.MeshPhysicalMaterial({ color, metalness: 0.25, roughness: 0.4, clearcoat: 1, clearcoatRoughness: 0.1, ...opts });
  m.onBeforeCompile = (s) => {
    s.uniforms.uDirt = { value: dirt };
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vObjP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjP = position;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObjP; uniform float uDirt;\n' + NOISE_GLSL)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float dn = vn(vObjP * 3.1) * 0.6 + vn(vObjP * 11.0) * 0.4;
        float mud = smoothstep(1.25, 0.35, vObjP.y + dn * 0.5) * uDirt;
        mud = clamp(mud * 1.4 + smoothstep(0.72, 0.9, vn(vObjP * 1.7 + 4.0)) * 0.25 * uDirt, 0.0, 1.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.19, 0.15, 0.11) * (0.8 + 0.4 * dn), mud);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.95, mud);')
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\nmaterial.clearcoat *= 1.0 - mud;');
  };
  m.customProgramCacheKey = () => 'vpaint';
  return m;
}

let _treadTex = null;
function treadTexture() {
  if (_treadTex) return _treadTex;
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = 'rgb(128,128,255)'; g.fillRect(0, 0, 256, 64);
  // chevron lugs as normal-map slopes
  for (let x = 0; x < 256; x += 16) {
    g.fillStyle = 'rgb(70,128,230)'; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 6, 32); g.lineTo(x, 64); g.lineTo(x + 4, 64); g.lineTo(x + 10, 32); g.lineTo(x + 4, 0); g.fill();
    g.fillStyle = 'rgb(190,128,230)'; g.fillRect(x + 10, 0, 3, 64);
  }
  _treadTex = new THREE.CanvasTexture(c);
  _treadTex.wrapS = _treadTex.wrapT = THREE.RepeatWrapping;
  _treadTex.repeat.set(4, 1);
  return _treadTex;
}

function mats() {
  return {
    glass: new THREE.MeshPhysicalMaterial({ color: 0x1a2428, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.38, envMapIntensity: 1.8, clearcoat: 1, side: THREE.DoubleSide }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xd8d8d8, metalness: 1, roughness: 0.14 }),
    alloy: new THREE.MeshStandardMaterial({ color: 0x9a9a9a, metalness: 0.9, roughness: 0.3 }),
    plastic: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.72 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x121212, roughness: 0.93, normalMap: treadTexture(), normalScale: new THREE.Vector2(1.2, 1.2) }),
    seat: new THREE.MeshStandardMaterial({ color: 0x7a5a3c, roughness: 0.62 }),
    dash: new THREE.MeshStandardMaterial({ color: 0x1c1a18, roughness: 0.8 }),
    head: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2d8, emissiveIntensity: 0.2, roughness: 0.1 }),
    tail: new THREE.MeshStandardMaterial({ color: 0x5a0a08, emissive: 0xff1a0a, emissiveIntensity: 0.3, roughness: 0.2 }),
    prop: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5, metalness: 0.3 }),
    blur: new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }),
  };
}

const add = (parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
};
const rbox = (w, h, d, r = 0.06, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));

function wheel(M, r, w) {
  const g = new THREE.Group();
  const prof = [];
  const sw = r * 0.18; // sidewall bulge
  for (let i = 0; i <= 12; i++) { const t = i / 12; const a = t * Math.PI; prof.push(new THREE.Vector2(r - sw + Math.sin(a) * sw, (t - 0.5) * w)); }
  prof.unshift(new THREE.Vector2(r * 0.62, -w / 2)); prof.push(new THREE.Vector2(r * 0.62, w / 2));
  const tire = new THREE.LatheGeometry(prof, 36); tire.rotateZ(Math.PI / 2);
  add(g, tire, M.rubber);
  const rim = new THREE.CylinderGeometry(r * 0.64, r * 0.64, w * 0.8, 24); rim.rotateZ(Math.PI / 2);
  add(g, rim, M.alloy);
  const hub = new THREE.CylinderGeometry(r * 0.2, r * 0.22, w * 0.86, 12); hub.rotateZ(Math.PI / 2);
  add(g, hub, M.chrome);
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; const h = new THREE.CylinderGeometry(r * 0.07, r * 0.07, w * 0.84, 8); h.rotateZ(Math.PI / 2); add(g, h, M.plastic, 0, Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42); }
  mergeStatic(g);
  return g;
}

// Merge every mesh under `root` (except subtrees in `keep`) into one mesh per material: a car becomes ~10 draw calls.
function mergeStatic(root, keep = []) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map(), victims = [];
  const skip = new Set(keep);
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (let p = o; p && p !== root; p = p.parent) if (skip.has(p)) return;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    if (o.matrixWorld.determinant() < 0) { const a = g.attributes.position.array; for (let i = 0; i < a.length; i += 9) for (let k = 0; k < 3; k++) { const t = a[i + 3 + k]; a[i + 3 + k] = a[i + 6 + k]; a[i + 6 + k] = t; } g.computeVertexNormals(); }
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    const key = o.material.uuid;
    if (!buckets.has(key)) buckets.set(key, { mat: o.material, geos: [], shadow: o.castShadow });
    buckets.get(key).geos.push(g);
    victims.push(o);
  });
  for (const o of victims) o.removeFromParent();
  for (const b of buckets.values()) {
    const m = new THREE.Mesh(mergeGeometries(b.geos), b.mat);
    m.castShadow = b.shadow && !b.mat.transparent; m.receiveShadow = true;
    root.add(m);
  }
}

// ---------------------------------------------------------------------------------------------- models
function buildJeep(M, color = 0xb8a47a, stripe = 0x2f4a2a) {
  const g = new THREE.Group();
  const P = paint(color, 0.45), S = paint(stripe, 0.45);
  add(g, rbox(1.62, 0.78, 2.9, 0.08), P, 0, 0.98, -0.25);                       // tub
  add(g, rbox(1.52, 0.34, 1.3, 0.08), P, 0, 1.2, 1.62, -0.04);                  // hood
  add(g, rbox(1.64, 0.12, 2.92, 0.04), S, 0, 1.12, -0.25);                      // side stripe band
  add(g, rbox(1.44, 0.64, 0.12, 0.03), M.plastic, 0, 1.0, 2.28);                // grille
  for (let k = -3; k <= 3; k++) add(g, new THREE.BoxGeometry(0.07, 0.42, 0.04), M.dash, k * 0.12, 1.0, 2.35);
  for (const sx of [-1, 1]) {
    const ring = new THREE.CylinderGeometry(0.12, 0.12, 0.07, 20); ring.rotateX(Math.PI / 2);
    add(g, ring, M.chrome, sx * 0.55, 1.08, 2.34);
    const lens = new THREE.CircleGeometry(0.095, 20); add(g, lens, M.head, sx * 0.55, 1.08, 2.38);
    add(g, new THREE.BoxGeometry(0.12, 0.08, 0.04), M.tail, sx * 0.72, 0.95, -1.72);
    // fender flares
    for (const fz of [1.2, -1.2]) {
      const arch = new THREE.CylinderGeometry(0.56, 0.56, 0.36, 18, 1, true, -Math.PI / 2, Math.PI); arch.rotateZ(Math.PI / 2);
      const a = add(g, arch, M.plastic, sx * 0.78, 0.42, fz); a.material = M.plastic; a.scale.set(1, 1, 1.05);
    }
    add(g, rbox(0.34, 0.06, 1.25, 0.02), M.plastic, sx * 0.78, 0.98, 1.6);          // front fender top
    // mirror
    add(g, rbox(0.04, 0.12, 0.16, 0.02), M.plastic, sx * 0.9, 1.5, 0.95);
  }
  add(g, rbox(1.82, 0.16, 0.18, 0.04), M.plastic, 0, 0.62, 2.38);               // front bumper
  add(g, rbox(1.82, 0.16, 0.18, 0.04), M.plastic, 0, 0.62, -1.78);              // rear bumper
  // windshield: frame + glass, raked back
  const ws = new THREE.Group(); ws.position.set(0, 1.36, 0.96); ws.rotation.x = -0.28; g.add(ws);
  add(ws, rbox(1.5, 0.06, 0.06, 0.02), P, 0, 0.62, 0); add(ws, rbox(1.5, 0.06, 0.06, 0.02), P, 0, 0.0, 0);
  for (const sx of [-1, 1]) add(ws, rbox(0.06, 0.66, 0.06, 0.02), P, sx * 0.72, 0.31, 0);
  add(ws, new THREE.PlaneGeometry(1.38, 0.56), M.glass, 0, 0.31, 0);
  // roll cage
  const tube = (pts, r = 0.045) => add(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.05), 24, r, 8), M.plastic);
  tube([[-0.72, 1.36, -0.28], [-0.72, 1.98, -0.3], [0.72, 1.98, -0.3], [0.72, 1.36, -0.28]]);
  tube([[-0.72, 1.98, -0.3], [-0.72, 1.82, -1.45], [-0.72, 1.36, -1.6]]);
  tube([[0.72, 1.98, -0.3], [0.72, 1.82, -1.45], [0.72, 1.36, -1.6]]);
  tube([[-0.72, 1.95, -0.3], [-0.72, 1.92, 0.78]], 0.035); tube([[0.72, 1.95, -0.3], [0.72, 1.92, 0.78]], 0.035);
  // interior
  add(g, rbox(1.5, 0.08, 2.5, 0.02), M.dash, 0, 1.22, -0.35);                    // floor/deck
  add(g, rbox(1.46, 0.3, 0.3, 0.05), M.dash, 0, 1.38, 0.78);                     // dashboard
  for (const sx of [-1, 1]) { add(g, rbox(0.5, 0.12, 0.5, 0.05), M.seat, sx * 0.38, 1.36, 0.0); add(g, rbox(0.48, 0.6, 0.12, 0.05), M.seat, sx * 0.38, 1.66, -0.24, -0.15); }
  add(g, rbox(1.3, 0.12, 0.5, 0.05), M.seat, 0, 1.36, -1.05); add(g, rbox(1.3, 0.5, 0.12, 0.05), M.seat, 0, 1.62, -1.3, -0.12);
  const sw = new THREE.TorusGeometry(0.18, 0.022, 8, 24); add(g, sw, M.plastic, 0.38, 1.62, 0.62, -1.1);
  // spare tyre
  const sp = wheel(M, 0.4, 0.3); sp.rotation.y = Math.PI / 2; sp.position.set(0, 1.12, -1.95); g.add(sp);
  return { group: g, wheelR: 0.42, wheelW: 0.32, axles: [1.2, -1.2], track: 0.78, seat: new THREE.Vector3(0.38, 0.92, -0.05), lights: [[0.55, 1.08, 2.4]], open: true, paint: P };
}

function buildExplorer(M, color = 0x2c5f36, stripe = 0xd8a020) {
  const g = new THREE.Group();
  const P = paint(color, 0.55), S = paint(stripe, 0.55), R = paint(0xb02818, 0.55);
  add(g, rbox(1.84, 0.86, 4.5, 0.14, 4), P, 0, 0.95, 0);                        // lower body
  add(g, rbox(1.86, 0.14, 4.52, 0.05), S, 0, 1.12, 0);                          // yellow band
  add(g, rbox(1.865, 0.05, 4.53, 0.02), R, 0, 1.22, 0);                         // red pinstripe
  add(g, rbox(1.74, 0.78, 2.7, 0.2, 4), M.glass, 0, 1.72, -0.35);               // greenhouse glass
  for (const z of [0.95, -0.35, -1.65]) for (const sx of [-1, 1]) add(g, rbox(0.06, 0.74, 0.1, 0.02), P, sx * 0.86, 1.72, z, 0, 0, sx * 0.08);
  add(g, rbox(1.76, 0.1, 2.75, 0.05), P, 0, 2.12, -0.35);                       // roof
  add(g, rbox(1.2, 0.12, 1.4, 0.06), M.glass, 0, 2.2, -0.5);                    // roof bubble
  add(g, rbox(1.72, 0.36, 1.2, 0.12), P, 0, 1.4, 1.65, -0.08);                  // hood
  add(g, rbox(1.6, 0.4, 0.1, 0.03), M.plastic, 0, 1.0, 2.26);
  for (const sx of [-1, 1]) {
    add(g, rbox(0.34, 0.16, 0.05, 0.03), M.head, sx * 0.6, 1.16, 2.27);
    add(g, rbox(0.22, 0.24, 0.05, 0.03), M.tail, sx * 0.78, 1.18, -2.26);
    add(g, rbox(0.05, 0.14, 0.2, 0.03), M.plastic, sx * 0.95, 1.55, 1.0);
    for (const fz of [1.35, -1.35]) { const arch = new THREE.CylinderGeometry(0.54, 0.54, 0.2, 18, 1, true, -Math.PI / 2, Math.PI); arch.rotateZ(Math.PI / 2); add(g, arch, M.plastic, sx * 0.86, 0.42, fz); }
  }
  add(g, rbox(1.9, 0.18, 0.2, 0.05), M.plastic, 0, 0.6, 2.3);
  add(g, rbox(1.9, 0.18, 0.2, 0.05), M.plastic, 0, 0.6, -2.3);
  add(g, rbox(1.6, 0.3, 0.3, 0.05), M.dash, 0, 1.45, 0.85);
  for (const sx of [-1, 1]) add(g, rbox(0.5, 0.6, 0.12, 0.05), M.seat, sx * 0.4, 1.62, 0.1, -0.15);
  return { group: g, wheelR: 0.42, wheelW: 0.3, axles: [1.35, -1.35], track: 0.84, seat: new THREE.Vector3(0.4, 0.92, 0.3), lights: [[0.6, 1.16, 2.3]], open: false, paint: P };
}

// Loft a fuselage from (z, halfWidth, top, bottom) sections with superelliptic cross-sections.
function loft(sections, radial = 28, power = 2.6) {
  const pos = [], idx = [];
  for (let i = 0; i < sections.length; i++) {
    const [z, hw, top, bot] = sections[i];
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const c = Math.cos(a), s = Math.sin(a);
      const x = Math.sign(c) * Math.pow(Math.abs(c), 2 / power) * hw;
      const yv = Math.sign(s) * Math.pow(Math.abs(s), 2 / power);
      const y = yv > 0 ? yv * top : yv * -bot;
      pos.push(x, y, z);
    }
  }
  for (let i = 0; i < sections.length - 1; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

function airfoil(chord, thick) {
  const s = new THREE.Shape();
  const n = 24;
  for (let i = 0; i <= n; i++) { const x = i / n; const t = 5 * thick * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1015 * x ** 4); if (i === 0) s.moveTo(-x * chord, 0); s.lineTo(-x * chord, t * chord * 1.3); }
  for (let i = n; i >= 0; i--) { const x = i / n; const t = 5 * thick * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1015 * x ** 4); s.lineTo(-x * chord, -t * chord * 0.7); }
  return s;
}
function wingGeo(span, chordRoot, chordTip, thick) {
  // extrude along +Z then rotate so the span runs along X; taper by scaling tip vertices
  const g = new THREE.ExtrudeGeometry(airfoil(chordRoot, thick), { depth: span, bevelEnabled: false, steps: 6 });
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const z = p.getZ(i); const t = z / span; const k = lerp(1, chordTip / chordRoot, t); p.setX(i, p.getX(i) * k); p.setY(i, p.getY(i) * k); }
  g.computeVertexNormals();
  g.rotateY(Math.PI / 2); // span now along +X, chord along +Z (leading edge forward)
  return g;
}

function buildPlane(M) {
  const g = new THREE.Group();
  const W = paint(0xeeeeea, 0.15, { metalness: 0.2 }), B = paint(0x1f4a7a, 0.15), Rd = paint(0xa8231a, 0.15);
  const body = loft([
    [3.9, 0.06, 0.06, 0.06], [3.75, 0.42, 0.42, 0.4], [3.3, 0.55, 0.58, 0.52], [2.6, 0.68, 0.74, 0.62], [1.8, 0.74, 0.95, 0.66],
    [0.6, 0.76, 1.0, 0.68], [-0.8, 0.74, 0.98, 0.66], [-2.2, 0.6, 0.82, 0.5], [-3.6, 0.4, 0.6, 0.28], [-5.0, 0.2, 0.45, 0.06], [-5.9, 0.08, 0.4, 0.02],
  ]);
  add(g, body, W, 0, 1.7, 0);
  // livery: belly band and cheat line
  const band = loft([[3.6, 0.5, -0.05, 0.47], [2.6, 0.7, -0.08, 0.64], [0.6, 0.78, -0.1, 0.7], [-2.2, 0.62, -0.12, 0.52], [-4.6, 0.3, -0.06, 0.12]], 28);
  add(g, band, B, 0, 1.7, 0);
  // windows: windscreen + side strip
  add(g, loft([[2.55, 0.69, 0.76, -0.3], [1.85, 0.75, 0.96, -0.36], [1.2, 0.765, 1.0, -0.37]]), M.glass, 0, 1.7, 0).scale.set(1.01, 1, 1);
  for (const sx of [-1, 1]) for (let k = 0; k < 5; k++) add(g, rbox(0.03, 0.34, 0.42, 0.06), M.glass, sx * 0.765, 2.3, 0.6 - k * 0.62);
  // engine cowl, spinner, propeller
  const spin = new THREE.ConeGeometry(0.24, 0.55, 20); spin.rotateX(Math.PI / 2);
  add(g, spin, Rd, 0, 1.68, 4.15);
  const prop = new THREE.Group(); prop.position.set(0, 1.68, 4.0); g.add(prop);
  for (let k = 0; k < 3; k++) { const bl = rbox(0.14, 1.25, 0.04, 0.02); const m = add(prop, bl, M.prop, 0, 0, 0, 0, 0, (k / 3) * Math.PI * 2); m.geometry.translate(0, 0.62, 0); }
  const disc = add(g, new THREE.CircleGeometry(1.3, 32), M.blur, 0, 1.68, 4.02); disc.castShadow = false; disc.visible = false;
  // high wing + struts
  const wingY = 2.72;
  for (const sx of [-1, 1]) {
    const w = add(g, wingGeo(7.6, 1.75, 1.15, 0.13), W, sx > 0 ? 0.35 : -0.35, wingY, 1.1);
    if (sx < 0) { w.scale.x = -1; }
    add(g, rbox(0.06, 0.06, 2.0, 0.02), M.alloy, sx * 2.4, 2.05, 0.6, 0.0, 0, sx * -0.75).geometry.rotateZ(0);
    const strut = new THREE.CylinderGeometry(0.035, 0.035, 2.9, 8); const st = add(g, strut, M.alloy, sx * 1.75, 2.2, 0.55, 0, 0, sx * 1.12);
    const wt = add(g, rbox(0.2, 0.05, 1.2, 0.02), Rd, sx * 7.7, wingY + 0.05, 0.7); // red wingtips
  }
  // empennage
  const fin = new THREE.Shape(); fin.moveTo(0, 0); fin.lineTo(-1.5, 0); fin.lineTo(-1.25, 1.55); fin.lineTo(-0.55, 1.6); fin.lineTo(0.4, 0.05); fin.closePath();
  const fg = new THREE.ExtrudeGeometry(fin, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 }); fg.rotateY(-Math.PI / 2); fg.translate(0.04, 0, 0);
  add(g, fg, W, 0, 2.05, -4.45);
  add(g, rbox(0.1, 0.6, 0.5, 0.03), Rd, 0, 3.35, -5.6);
  for (const sx of [-1, 1]) { const st = add(g, wingGeo(2.2, 1.05, 0.7, 0.1), W, sx * 0.1, 1.95, -4.6); if (sx < 0) st.scale.x = -1; }
  // tricycle gear
  for (const [x, z, h] of [[1.25, 0.2, 1.05], [-1.25, 0.2, 1.05], [0, 3.1, 1.1]]) {
    add(g, new THREE.CylinderGeometry(0.05, 0.05, h, 8), M.alloy, x * 0.8, h / 2 + 0.3, z, 0, 0, x * -0.35);
    const wh = wheel(M, 0.3, 0.18); wh.position.set(x, 0.3, z); g.add(wh);
    add(g, rbox(0.24, 0.32, 0.7, 0.1), W, x, 0.42, z);                            // wheel spat
  }
  // registration decals
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96; const c = cv.getContext('2d');
  c.fillStyle = '#1f4a7a'; c.font = 'bold 74px Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('N-ISLA', 256, 52);
  const dt = new THREE.CanvasTexture(cv); dt.colorSpace = THREE.SRGBColorSpace; dt.anisotropy = 8;
  const dm = new THREE.MeshStandardMaterial({ map: dt, transparent: true, roughness: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  for (const sx of [-1, 1]) { const d = add(g, new THREE.PlaneGeometry(1.8, 0.34), dm, sx * 0.48, 1.98, -3.4, 0, sx * Math.PI / 2); d.castShadow = false; }
  add(g, rbox(0.12, 0.08, 0.06, 0.02), M.head, 2.4, wingY - 0.02, 1.15);         // landing light
  return { group: g, prop, disc, seat: new THREE.Vector3(0.36, 1.45, 1.75), gearH: 0, lights: [[2.4, 2.7, 1.2]], open: false };
}

// ---------------------------------------------------------------------------------------------- vehicles
class Vehicle {
  constructor(game, type, x, z, yaw) {
    this.game = game; this.type = type;
    this.pos = new THREE.Vector3(x, game.terrain.getHeight(x, z), z);
    this.yaw = yaw; this.pitch = 0; this.roll = 0;
    this.vel = new THREE.Vector3();
    this.speed = 0; this.hp = 100; this.wrecked = false;
    this.driver = null;
    this.home = { x, z, yaw };
    this.engine = 0; // 0..1 rpm proxy for audio
  }
  get kind() { return 'vehicle'; }
  get label() { return this.type === 'plane' ? 'Cessna Caravan "N-ISLA"' : this.type === 'jeep' ? 'Park Jeep' : 'Tour Explorer'; }
  seatWorld(out) { return out.copy(this.model.seat).applyQuaternion(this.group.quaternion).add(this.group.position); }
  exitPoint(out) {
    const side = _v.set(this.type === 'plane' ? 2.2 : 1.6, 0, this.type === 'plane' ? 1.6 : 0).applyAxisAngle(UP, this.yaw);
    return out.copy(this.pos).add(side);
  }
  setLights(on) { const M = this.M; M.head.emissiveIntensity = on ? 6 : 0.2; M.tail.emissiveIntensity = on ? 3 : 0.3; if (this.spot) this.spot.intensity = on ? 60 : 0; }
}

export class Car extends Vehicle {
  constructor(game, type, x, z, yaw) {
    super(game, type, x, z, yaw);
    this.M = mats();
    this.model = type === 'jeep' ? buildJeep(this.M) : buildExplorer(this.M);
    this.group = this.model.group;
    this.wheels = [];
    const { axles, track, wheelR, wheelW } = this.model;
    for (const az of axles) for (const sx of [-1, 1]) {
      const pivot = new THREE.Group(); pivot.position.set(sx * track, wheelR, az);
      const w = wheel(this.M, wheelR, wheelW); pivot.add(w); this.group.add(pivot);
      this.wheels.push({ pivot, mesh: w, front: az > 0, x: sx * track, z: az, comp: 0 });
    }
    mergeStatic(this.group, this.wheels.map((w) => w.pivot));
    this.wheelbase = axles[0] - axles[1];
    this.lat = 0; this.steer = 0; this.vy = 0; this.air = false; this.spin = 0;
    this.maxSpeed = type === 'jeep' ? 34 : 30;
    this.radius = 2.2;
    this.place();
  }
  place() { const T = this.game.terrain; this.pos.y = T.getHeight(this.pos.x, this.pos.z); this._ground(1, true); this.syncTransform(); }
  _ground(dt, snap = false) {
    const T = this.game.terrain;
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    const h = this.wheels.map((w) => { const wx = this.pos.x + w.x * c + w.z * s, wz = this.pos.z - w.x * s + w.z * c; return Math.max(T.getHeight(wx, wz), -0.2); });
    const front = (h[0] + h[1]) / 2, rear = (h[2] + h[3]) / 2, left = (h[1] + h[3]) / 2, right = (h[0] + h[2]) / 2;
    const target = (front + rear) / 2;
    const tp = Math.atan2(front - rear, this.wheelbase), tr = Math.atan2(left - right, this.model.track * 2);
    if (snap) { this.pos.y = target; this.pitch = tp; this.roll = tr; this.vy = 0; this.air = false; return h; }
    if (this.pos.y > target + 0.35 || this.vy > 0.5) { this.air = true; }
    if (this.air) {
      this.vy -= 9.8 * dt; this.pos.y += this.vy * dt;
      if (this.pos.y <= target) {
        if (this.vy < -7) { this.game.cameraShake?.(null, Math.min(1, -this.vy / 16)); this.game.audio?.land(); this.damageVehicle(Math.max(0, -this.vy - 9) * 4); }
        this.pos.y = target; this.vy = 0; this.air = false;
      }
      this.pitch = damp(this.pitch, tp * 0.3, 1.5, dt);
    } else {
      // stick to the ground; launch off crests when the ground falls away faster than gravity
      const dy = target - this.pos.y;
      const vyGround = dy / Math.max(dt, 1e-3);
      if (vyGround < -9.8 * 0.35 * Math.max(1, Math.abs(this.speed) / 10) && Math.abs(this.speed) > 12) { this.air = true; this.vy = Math.min(this.vy, 0) + Math.abs(this.speed) * Math.sin(this.pitch) * 0.6; }
      else { this.pos.y = target; this.vy = vyGround * 0.5; }
      this.pitch = damp(this.pitch, tp, 12, dt);
      this.roll = damp(this.roll, tr, 12, dt);
    }
    return h;
  }
  update(dt, ctl) {
    if (this.wrecked) { this.speed = damp(this.speed, 0, 3, dt); return; }
    const G = this.game, T = G.terrain;
    const sub = 2, h = dt / sub;
    for (let k = 0; k < sub; k++) this._step(h, ctl);
    // dust & exhaust
    const spd = Math.abs(this.speed);
    const offroad = T.getRoad(this.pos.x, this.pos.z) < 0.4;
    this._fxT = (this._fxT || 0) - dt;
    if (this._fxT <= 0 && G.fx) {
      this._fxT = 0.06;
      if (!this.air && spd > 6 && offroad) for (const w of this.wheels) if (!w.front) G.fx.dust(_v.set(w.x, 0.1, w.z).applyAxisAngle(UP, this.yaw).add(this.pos), 0.35 + spd / 40);
      if (ctl && ctl.throttle > 0 && spd < 12) G.fx.smoke(_v.set(-0.5, 0.45, this.model.axles[1] - 0.8).applyAxisAngle(UP, this.yaw).add(this.pos), 0x555555, 0.35);
    }
    this.engine = damp(this.engine, ctl ? clamp(spd / this.maxSpeed * 0.8 + Math.abs(ctl.throttle) * 0.25, 0.08, 1) : 0, 4, dt);
    this.syncTransform();
  }
  _step(dt, ctl) {
    const G = this.game, T = G.terrain;
    const throttle = ctl ? ctl.throttle : 0, steerIn = ctl ? ctl.steer : 0, hand = ctl ? ctl.handbrake : false;
    const onRoad = T.getRoad(this.pos.x, this.pos.z);
    const wet = this.pos.y < 0.2 ? 1 : 0;
    // steering: less lock at speed, self-centring
    const lock = lerp(0.6, 0.16, clamp(Math.abs(this.speed) / 30, 0, 1));
    this.steer = damp(this.steer, steerIn * lock, 6, dt);
    if (!this.air) {
      const fwdSpeed = this.speed;
      if (throttle > 0) this.speed += (fwdSpeed < -0.5 ? 18 : 10.5 * (1 - clamp(fwdSpeed / this.maxSpeed, 0, 1)) * (wet ? 0.3 : 1)) * throttle * dt;
      else if (throttle < 0) this.speed -= (fwdSpeed > 0.5 ? 16 : 6 * (1 - clamp(-fwdSpeed / 9, 0, 1))) * -throttle * dt; // brake, then reverse
      if (hand) this.speed = damp(this.speed, 0, 1.6, dt);
      // rolling resistance + aero drag; rough ground and water slow you more
      const rr = (onRoad > 0.4 ? 0.25 : 0.9) + wet * 4;
      this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), (rr + 0.0035 * this.speed * this.speed) * dt * (throttle === 0 ? 1.6 : 1));
      // gravity along the slope
      this.speed -= 9.8 * Math.sin(this.pitch) * dt * 0.7;
      // yaw from the bicycle model
      const yawRate = (this.speed * Math.tan(this.steer)) / this.wheelbase;
      this.yaw += yawRate * dt * (hand ? 1.35 : 1);
      // lateral slip: the body keeps sliding sideways until tyre grip catches up (handbrake = drift)
      const grip = (hand ? 1.2 : onRoad > 0.4 ? 7.5 : 5) * (wet ? 0.4 : 1);
      this.lat += -yawRate * this.speed * dt * (hand ? 0.22 : 0.08);
      this.lat = damp(this.lat, 0, grip, dt);
    } else {
      this.yaw += steerIn * 0.4 * dt;
    }
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    this.vel.set(s * this.speed + c * this.lat, this.vy, c * this.speed - s * this.lat);
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    this._ground(dt);
    this._collide(dt);
    // wheel visuals
    this.spin += (this.speed / this.model.wheelR) * dt;
  }
  _collide(dt) {
    const G = this.game;
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    let hit = false;
    for (const off of [1.4, 0, -1.4]) {
      const p = _v.set(this.pos.x + s * off, this.pos.y + 0.3, this.pos.z + c * off);
      const ox = p.x, oz = p.z;
      if (G.colliders.resolve(p, 0.95, 1.4)) { this.pos.x += p.x - ox; this.pos.z += p.z - oz; hit = true; }
    }
    if (hit && Math.abs(this.speed) > 3) {
      const impact = Math.abs(this.speed);
      if (impact > 9) { G.cameraShake?.(null, Math.min(1, impact / 25)); G.audio?.impact(this.pos, 'metal'); G.fx?.sparks(_v.copy(this.pos).setY(this.pos.y + 0.8), 8); this.damageVehicle((impact - 9) * 2.2); if (this.driver) this.driver.damage?.(Math.max(0, impact - 16) * 2, null, { vehicle: true }); }
      this.speed *= -0.25; this.lat *= 0.3;
    } else if (hit) this.speed *= 0.6;
    // creatures and people
    for (const e of G.entities) {
      if (!e.alive || e === this.driver || e.kind === 'vehicle') continue;
      const dx = e.pos.x - this.pos.x, dz = e.pos.z - this.pos.z;
      const r = (e.radius || 0.5) + 1.3;
      const d2 = dx * dx + dz * dz;
      if (d2 > r * r) continue;
      const d = Math.sqrt(d2) || 1;
      const rel = Math.abs(this.speed);
      const big = e.kind === 'dino' && (e.def?.size || 1) >= 3;
      if (big) {
        // you don't push a triceratops: the car stops dead (and the animal is not amused)
        this.pos.x -= (dx / d) * (r - d); this.pos.z -= (dz / d) * (r - d);
        if (rel > 6) { this.damageVehicle(rel * 1.8); e.damage(rel * 1.5, this.driver || null, { vehicle: true }); G.cameraShake?.(null, 0.6); }
        this.speed *= -0.2;
      } else if (rel > 4) {
        e.damage(rel * rel * 0.35, this.driver || null, { vehicle: true });
        if (e.vel) { e.vel.x += Math.sin(this.yaw) * rel * 0.6; e.vel.z += Math.cos(this.yaw) * rel * 0.6; }
        this.speed *= 0.85;
        G.fx?.blood?.(_v.copy(e.pos).setY(e.pos.y + 1), 10);
      } else { e.pos.x += (dx / d) * (r - d) * 0.5; e.pos.z += (dz / d) * (r - d) * 0.5; }
    }
  }
  damageVehicle(n) {
    if (n <= 0 || this.wrecked) return;
    this.hp -= n;
    if (this.hp <= 0) this.wreck();
  }
  wreck() {
    this.wrecked = true; this.hp = 0;
    const G = this.game;
    G.fx?.burst?.(_v.copy(this.pos).setY(this.pos.y + 1), 40, { additive: true, speed: 6, s0: 60, s1: 10, r: 1, g: 0.55, b: 0.2, a: 1, life: 1.2, up: 3 });
    G.fx?.smoke(_v.copy(this.pos).setY(this.pos.y + 1.5), 0x222222, 3);
    G.audio?.explosion?.(this.pos);
    this.model.paint.color.multiplyScalar(0.25);
    if (this.driver) { this.driver.damage?.(35, null, { vehicle: true }); G.player.exitVehicle(true); }
    G.hud.toast(`${this.label} is wrecked. It will be towed back to its garage.`, 'danger');
    setTimeout(() => this.repairAtHome(), 45000);
  }
  repairAtHome() {
    if (this.driver) return;
    this.model.paint.color.set(this.type === 'jeep' ? 0xb8a47a : 0x2c5f36);
    this.wrecked = false; this.hp = 100; this.speed = 0; this.lat = 0;
    this.pos.set(this.home.x, 0, this.home.z); this.yaw = this.home.yaw; this.place();
  }
  syncTransform() {
    this.group.position.copy(this.pos);
    _e.set(-this.pitch, this.yaw, this.roll, 'YXZ');
    this.group.quaternion.setFromEuler(_e);
    for (const w of this.wheels) {
      w.pivot.rotation.y = w.front ? this.steer : 0;
      w.mesh.rotation.x = this.spin;
    }
  }
}

export class Plane extends Vehicle {
  constructor(game, x, z, yaw) {
    super(game, 'plane', x, z, yaw);
    this.M = mats();
    this.model = buildPlane(this.M);
    this.group = this.model.group;
    mergeStatic(this.group, [this.model.prop, this.model.disc]);
    this.quat = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
    this.throttle = 0; this.sink = 0; this.grounded = true;
    this.radius = 6;
    this.propSpin = 0;
    this.place();
  }
  get altitude() { return this.pos.y - this.game.terrain.getHeight(this.pos.x, this.pos.z); }
  place() { this.pos.y = this.game.terrain.getHeight(this.pos.x, this.pos.z); this.quat.setFromAxisAngle(UP, this.yaw); this.grounded = true; this.speed = 0; this.sink = 0; this.syncTransform(); }
  update(dt, ctl) {
    if (this.wrecked) return;
    const G = this.game, T = G.terrain;
    const fwd = _v.set(0, 0, 1).applyQuaternion(this.quat);
    if (ctl) this.throttle = clamp(this.throttle + ctl.throttle * dt * 0.6, 0, 1);
    else this.throttle = damp(this.throttle, 0, 1, dt);
    // thrust, drag, and gravity along the flight path (energy trade: climbing bleeds speed)
    const thrust = this.throttle * (this.grounded ? 8.5 : 6.8);
    const drag = 0.0019 * this.speed * this.speed + (this.grounded ? (T.getRoad(this.pos.x, this.pos.z) > 0.3 || this._onRunway() ? 0.3 : 1.6) : 0.1);
    this.speed += (thrust - drag - 9.8 * fwd.y * (this.grounded ? 0.3 : 1)) * dt;
    if (ctl && ctl.brake && this.grounded) this.speed = damp(this.speed, 0, 1.5, dt);
    this.speed = Math.max(0, this.speed);
    const lift = clamp((this.speed - 16) / 12, 0, 1.25);
    const auth = clamp(this.speed / 26, 0.15, 1.2);
    if (ctl) {
      // local-axis rotations: pitch (X), roll (Z), rudder (Y)
      const pitchIn = this.grounded ? Math.min(0, ctl.pitch) * (this.speed > 20 ? 1 : 0) : ctl.pitch;
      _q.setFromAxisAngle(_v2.set(1, 0, 0), pitchIn * 0.9 * auth * dt); this.quat.multiply(_q);
      if (!this.grounded) { _q.setFromAxisAngle(_v2.set(0, 0, 1), ctl.roll * 1.6 * auth * dt); this.quat.multiply(_q); }
      _q.setFromAxisAngle(_v2.set(0, 1, 0), ctl.yaw * (this.grounded ? 0.7 * clamp(this.speed / 6, 0, 1) : 0.25) * dt); this.quat.multiply(_q);
    }
    const right = _v2.set(1, 0, 0).applyQuaternion(this.quat);
    if (!this.grounded) {
      // bank-to-turn: lift tilted with the wings swings the heading around world up
      const bank = Math.asin(clamp(-right.y, -1, 1));
      _q.setFromAxisAngle(UP, Math.sin(bank) * lift * 0.9 * dt * (this.speed / 30)); this.quat.premultiply(_q);
      // stall: nose drops and the aircraft sinks
      this.sink = lift >= 1 ? damp(this.sink, 0, 1.2, dt) : this.sink + (1 - lift) * 9.8 * dt;
      if (lift < 0.45) { _q.setFromAxisAngle(_v2.set(1, 0, 0), (0.45 - lift) * 0.8 * dt); this.quat.multiply(_q); }
      // ground effect: a cushion of air under the wing makes the last few metres forgiving
      const agl = this.pos.y - Math.max(T.getHeight(this.pos.x, this.pos.z), -0.5);
      if (agl < 8) this.sink = Math.min(this.sink, 1.2 + agl * 0.35);
      // gentle roll and pitch stability when the stick is centred (arcade assist)
      if (ctl && Math.abs(ctl.roll) < 0.05) { _q.setFromAxisAngle(_v.set(0, 0, 1), bank * 0.6 * dt); this.quat.multiply(_q); }
      if (ctl && Math.abs(ctl.pitch) < 0.05) { const f2 = _v.set(0, 0, 1).applyQuaternion(this.quat); _q.setFromAxisAngle(_v2.set(1, 0, 0), Math.asin(clamp(f2.y, -1, 1)) * 0.35 * dt); this.quat.multiply(_q); }
    }
    fwd.set(0, 0, 1).applyQuaternion(this.quat);
    this.vel.copy(fwd).multiplyScalar(this.speed); this.vel.y -= this.sink;
    this.pos.addScaledVector(this.vel, dt);
    // ground contact
    const gh = Math.max(T.getHeight(this.pos.x, this.pos.z), -0.5);
    if (this.pos.y <= gh + 0.02) {
      const descent = -this.vel.y;
      _e.setFromQuaternion(this.quat, 'YXZ');
      const badAttitude = Math.abs(_e.z) > 0.5 || _e.x > 0.35;
      if (!this.grounded && (descent > 8 || badAttitude)) return this.crash();
      if (this.pos.y < -0.3) return this.crash(); // ditched in the sea
      this.pos.y = gh; this.sink = 0;
      if (!this.grounded) { G.audio?.land(); G.cameraShake?.(null, 0.25); }
      this.grounded = true;
      // settle onto the gear: keep heading, follow the ground slope, level wings
      const yaw = _e.y;
      const pitchUp = ctl && ctl.pitch < -0.2 && this.speed > 20 ? Math.min(-_e.x, 0.25) : 0;
      _e.set(-pitchUp, yaw, 0, 'YXZ'); this.quat.slerp(_q.setFromEuler(_e), 1 - Math.exp(-8 * dt));
      if (lift > 0.9 && pitchUp > 0.05) { this.grounded = false; this.pos.y += 0.05; }
      // obstacles on the ground roll
      const p = _v.copy(this.pos); const ox = p.x, oz = p.z;
      if (G.colliders.resolve(p, 1.6, 2.5)) { this.pos.x = p.x; this.pos.z = p.z; if (this.speed > 12) return this.crash(); this.speed *= 0.3; }
    } else {
      if (this.grounded && this.pos.y > gh + 0.6) this.grounded = false;
      // flying into buildings or the mountain
      const p = _v.copy(this.pos); p.y -= 1;
      if (this.speed > 10 && G.colliders.resolve(p, 2.2, 3, this.altitude > 14 ? 'tree' : null)) return this.crash();
    }
    // keep inside the airspace
    const lim = 1250;
    if (Math.abs(this.pos.x) > lim || Math.abs(this.pos.z) > lim) { _q.setFromAxisAngle(UP, dt * 0.8); this.quat.premultiply(_q); if (ctl) G.hud.toast('Turn back — the fuel won\'t reach the mainland'); }
    this.yaw = new THREE.Euler().setFromQuaternion(this.quat, 'YXZ').y;
    this.engine = damp(this.engine, ctl ? 0.25 + this.throttle * 0.75 : 0, 3, dt);
    this.propSpin += (this.engine * 60 + this.speed * 0.5) * dt;
    this.syncTransform();
  }
  _onRunway() {
    const R = RUNWAY, c = Math.cos(R.yaw), s = Math.sin(R.yaw);
    const dx = this.pos.x - R.x, dz = this.pos.z - R.z;
    return Math.abs(dx * c + dz * s) < R.len / 2 && Math.abs(-dx * s + dz * c) < R.w / 2;
  }
  crash() {
    const G = this.game;
    this.wrecked = true; this.speed = 0;
    G.fx?.burst?.(_v.copy(this.pos).setY(this.pos.y + 1.5), 70, { additive: true, speed: 9, s0: 90, s1: 10, r: 1, g: 0.55, b: 0.2, a: 1, life: 1.4, up: 4 });
    for (let i = 0; i < 4; i++) G.fx?.smoke(_v.copy(this.pos).setY(this.pos.y + 1 + i), 0x1a1a1a, 4);
    G.audio?.explosion?.(this.pos);
    G.cameraShake?.(null, 1);
    if (this.driver) { G.player.exitVehicle(true); G.player.damage(60, null, { vehicle: true }); }
    G.hud.toast('The Caravan is down. The ground crew will haul what\'s left back to the hangar.', 'danger');
    setTimeout(() => { this.wrecked = false; this.hp = 100; this.pos.set(this.home.x, 0, this.home.z); this.yaw = this.home.yaw; this.throttle = 0; this.place(); }, 30000);
  }
  syncTransform() {
    this.group.position.copy(this.pos);
    this.group.quaternion.copy(this.quat);
    this.model.prop.rotation.z = this.propSpin;
    this.model.disc.visible = this.engine > 0.35;
  }
}

// ---------------------------------------------------------------------------------------------- manager
export class Vehicles {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.group = new THREE.Group(); this.group.name = 'vehicles';
    const mp = locById.motorpool, lo = locById.lodge, R = RUNWAY;
    this.add(new Car(game, 'jeep', mp.x - 3.6, mp.z + 0.8, 0));
    this.add(new Car(game, 'explorer', mp.x + 3.6, mp.z + 0.3, 0));
    this.add(new Car(game, 'jeep', lo.x - 4, lo.z + 17, 2.4));
    this.add(new Car(game, 'explorer', locById.docks.x + 18, locById.docks.z - 30, 1.2));
    const c = Math.cos(R.yaw), s = Math.sin(R.yaw);
    // the Caravan waits at the west threshold, nose down the runway
    this.add(new Plane(game, R.x - c * (R.len / 2 - 25), R.z - s * (R.len / 2 - 25), Math.PI / 2 - R.yaw));
    // the player's headlights (one shadowless spot shared by whichever car is driven)
    this.spot = new THREE.SpotLight(0xfff0d8, 0, 70, 0.55, 0.5, 1.4);
    this.spot.target = new THREE.Object3D();
    this.group.add(this.spot, this.spot.target);
  }
  add(v) { this.list.push(v); this.group.add(v.group); return v; }
  nearest(pos, maxD = 4.5) {
    let best = null, bd = maxD;
    for (const v of this.list) {
      const r = v.type === 'plane' ? 4.5 : 2.6;
      const d = Math.hypot(v.pos.x - pos.x, v.pos.z - pos.z) - r + 2;
      if (d < bd && !v.wrecked) { bd = d; best = v; }
    }
    return best;
  }
  update(dt, night) {
    const P = this.game.player, cam = this.game.camera.position;
    // distance culling: hide far vehicles; only near ones cast (cascaded) shadows
    for (const v of this.list) {
      const d = v.pos.distanceTo(cam);
      v.group.visible = d < (v.type === 'plane' ? 900 : 380);
      const sh = d < 70 || v === P.vehicle;
      if (sh !== v._shadow) { v._shadow = sh; v.group.traverse((o) => { if (o.isMesh && !o.material.transparent) o.castShadow = sh; }); }
    }
    for (const v of this.list) {
      v.update(dt, v === P.vehicle ? P.vehicleCtl : null);
      v.setLights(night && (v === P.vehicle));
    }
    const pv = P.vehicle;
    if (pv && night && pv.type !== 'plane') {
      const L = pv.model.lights[0];
      this.spot.position.set(0, L[1], L[2]).applyQuaternion(pv.group.quaternion).add(pv.group.position);
      this.spot.target.position.set(0, 0.2, 30).applyQuaternion(pv.group.quaternion).add(pv.group.position);
      this.spot.intensity = 90;
    } else this.spot.intensity = 0;
  }
  serialize() { return this.list.map((v) => ({ x: v.pos.x, z: v.pos.z, yaw: v.yaw })); }
  load(arr) {
    if (!Array.isArray(arr)) return;
    arr.forEach((s, i) => { const v = this.list[i]; if (!v || !s) return; v.pos.set(s.x, 0, s.z); v.yaw = s.yaw; if (v.quat) v.quat.setFromAxisAngle(UP, s.yaw); v.place(); });
  }
}
