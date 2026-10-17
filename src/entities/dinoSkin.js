// Organic skin fusion for procedural dinosaurs.
// The body tube and limb capsules are re-expressed as a signed distance field (spine ellipsoids + round cones,
// joined with smooth-min so hips, shoulders and neck flow into each other like muscle), polygonised with
// marching cubes, and given skin weights/colours by inverse-distance transfer from the original parts.
// The result is cached per species at unit scale; later instances only rescale and recolour.
import * as THREE from 'three';
import { edgeTable, triTable } from 'three/examples/jsm/objects/MarchingCubes.js';

const CACHE = new Map();
const _p = new THREE.Vector3(), _n = new THREE.Vector3(), _c = new THREE.Color();

function smin(a, b, k) {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

// iq: round cone between a (radius r1) and b (radius r2)
function sdRoundCone(px, py, pz, P) {
  const { ax, ay, az, bax, bay, baz, l2, rr, a2, il2, r1, r2 } = P;
  const pax = px - ax, pay = py - ay, paz = pz - az;
  const y = pax * bax + pay * bay + paz * baz;
  const z = y - l2;
  const xx = pax * l2 - bax * y, xy = pay * l2 - bay * y, xz = paz * l2 - baz * y;
  const x2 = xx * xx + xy * xy + xz * xz;
  const y2 = y * y * l2, z2 = z * z * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}

export function roundCone(a, b, r1, r2, k) {
  const bax = b.x - a.x, bay = b.y - a.y, baz = b.z - a.z;
  const l2 = Math.max(bax * bax + bay * bay + baz * baz, 1e-8);
  const rr = r1 - r2;
  const P = { type: 'cone', ax: a.x, ay: a.y, az: a.z, bax, bay, baz, l2, rr, a2: l2 - rr * rr, il2: 1 / l2, r1, r2, k };
  const r = Math.max(r1, r2) + k;
  P.min = new THREE.Vector3(Math.min(a.x, b.x) - r, Math.min(a.y, b.y) - r, Math.min(a.z, b.z) - r);
  P.max = new THREE.Vector3(Math.max(a.x, b.x) + r, Math.max(a.y, b.y) + r, Math.max(a.z, b.z) + r);
  return P;
}

// ellipsoid with local axes X (side), N (up-ish), T (along); radii rx, rn, rt
export function ellipsoidPrim(c, N, T, rx, rn, rt, k) {
  const r = Math.max(rx, rn, rt) + k;
  return { type: 'ell', c, N, T, rx, rn, rt, k, min: c.clone().subScalar(r), max: c.clone().addScalar(r) };
}

function sdEll(px, py, pz, E) {
  const dx = px - E.c.x, dy = py - E.c.y, dz = pz - E.c.z;
  const lx = dx, ln = dx * E.N.x + dy * E.N.y + dz * E.N.z, lt = dx * E.T.x + dy * E.T.y + dz * E.T.z;
  // local x axis is world X for the spine frame (N,T lie in the YZ plane)
  const ux = lx / E.rx, un = ln / E.rn, ut = lt / E.rt;
  const k0 = Math.sqrt(ux * ux + un * un + ut * ut);
  const vx = lx / (E.rx * E.rx), vn = ln / (E.rn * E.rn), vt = lt / (E.rt * E.rt);
  const k1 = Math.sqrt(vx * vx + vn * vn + vt * vt) || 1e-6;
  return (k0 * (k0 - 1)) / k1;
}

function polygonise(field, nx, ny, nz, org, vs) {
  const pos = [], idx = [];
  const edgeMap = new Map();
  const at = (x, y, z) => field[x + nx * (y + ny * z)];
  const corner = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
  const edges = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
  const val = new Float32Array(8);
  const ev = new Int32Array(12);
  for (let z = 0; z < nz - 1; z++) for (let y = 0; y < ny - 1; y++) for (let x = 0; x < nx - 1; x++) {
    let ci = 0;
    for (let c = 0; c < 8; c++) { const v = at(x + corner[c][0], y + corner[c][1], z + corner[c][2]); val[c] = v; if (v < 0) ci |= 1 << c; }
    const em = edgeTable[ci];
    if (!em) continue;
    for (let e = 0; e < 12; e++) {
      if (!(em & (1 << e))) continue;
      const [c0, c1] = edges[e];
      const g0 = [x + corner[c0][0], y + corner[c0][1], z + corner[c0][2]], g1 = [x + corner[c1][0], y + corner[c1][1], z + corner[c1][2]];
      const i0 = g0[0] + nx * (g0[1] + ny * g0[2]), i1 = g1[0] + nx * (g1[1] + ny * g1[2]);
      const key = i0 < i1 ? i0 * 4194304 + i1 : i1 * 4194304 + i0;
      let vi = edgeMap.get(key);
      if (vi === undefined) {
        const t = val[c0] / (val[c0] - val[c1]);
        vi = pos.length / 3;
        pos.push(org.x + (g0[0] + (g1[0] - g0[0]) * t) * vs, org.y + (g0[1] + (g1[1] - g0[1]) * t) * vs, org.z + (g0[2] + (g1[2] - g0[2]) * t) * vs);
        edgeMap.set(key, vi);
      }
      ev[e] = vi;
    }
    const base = ci << 4;
    for (let t = 0; triTable[base + t] !== -1; t += 3) idx.push(ev[triTable[base + t]], ev[triTable[base + t + 2]], ev[triTable[base + t + 1]]);
  }
  return { pos, idx };
}

function gradNormals(pos, field, nx, ny, nz, org, vs) {
  const n = new Float32Array(pos.length);
  const f = (x, y, z) => {
    x = Math.min(Math.max(x, 0), nx - 1.001); y = Math.min(Math.max(y, 0), ny - 1.001); z = Math.min(Math.max(z, 0), nz - 1.001);
    const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z), tx = x - x0, ty = y - y0, tz = z - z0;
    const g = (a, b, c) => field[a + nx * (b + ny * c)];
    const c00 = g(x0, y0, z0) * (1 - tx) + g(x0 + 1, y0, z0) * tx, c10 = g(x0, y0 + 1, z0) * (1 - tx) + g(x0 + 1, y0 + 1, z0) * tx;
    const c01 = g(x0, y0, z0 + 1) * (1 - tx) + g(x0 + 1, y0, z0 + 1) * tx, c11 = g(x0, y0 + 1, z0 + 1) * (1 - tx) + g(x0 + 1, y0 + 1, z0 + 1) * tx;
    return (c00 * (1 - ty) + c10 * ty) * (1 - tz) + (c01 * (1 - ty) + c11 * ty) * tz;
  };
  for (let i = 0; i < pos.length; i += 3) {
    const x = (pos[i] - org.x) / vs, y = (pos[i + 1] - org.y) / vs, z = (pos[i + 2] - org.z) / vs;
    let gx = f(x + 0.5, y, z) - f(x - 0.5, y, z), gy = f(x, y + 0.5, z) - f(x, y - 0.5, z), gz = f(x, y, z + 0.5) - f(x, y, z - 0.5);
    const l = Math.hypot(gx, gy, gz) || 1;
    n[i] = gx / l; n[i + 1] = gy / l; n[i + 2] = gz / l;
  }
  return n;
}

// k nearest source vertices (grid hash) → [indices], [weights]
function transferMap(pos, src, cell) {
  const grid = new Map();
  const key = (x, y, z) => (x * 73856093) ^ (y * 19349663) ^ (z * 83492791);
  const ns = src.length / 3;
  for (let i = 0; i < ns; i++) {
    const k = key(Math.floor(src[i * 3] / cell), Math.floor(src[i * 3 + 1] / cell), Math.floor(src[i * 3 + 2] / cell));
    let a = grid.get(k); if (!a) grid.set(k, (a = [])); a.push(i);
  }
  const K = 4, nv = pos.length / 3;
  const nIdx = new Int32Array(nv * K), nW = new Float32Array(nv * K);
  const bd = new Float32Array(K), bi = new Int32Array(K);
  for (let v = 0; v < nv; v++) {
    const px = pos[v * 3], py = pos[v * 3 + 1], pz = pos[v * 3 + 2];
    const cx = Math.floor(px / cell), cy = Math.floor(py / cell), cz = Math.floor(pz / cell);
    bd.fill(1e9); bi.fill(-1);
    for (let r = 1; r <= 6; r++) {
      for (let x = cx - r; x <= cx + r; x++) for (let y = cy - r; y <= cy + r; y++) for (let z = cz - r; z <= cz + r; z++) {
        if (Math.max(Math.abs(x - cx), Math.abs(y - cy), Math.abs(z - cz)) !== r && r > 1) continue;
        const a = grid.get(key(x, y, z)); if (!a) continue;
        for (const i of a) {
          const dx = src[i * 3] - px, dy = src[i * 3 + 1] - py, dz = src[i * 3 + 2] - pz;
          const d = dx * dx + dy * dy + dz * dz;
          if (d < bd[K - 1]) { let j = K - 1; while (j > 0 && bd[j - 1] > d) { bd[j] = bd[j - 1]; bi[j] = bi[j - 1]; j--; } bd[j] = d; bi[j] = i; }
        }
      }
      if (bi[K - 1] >= 0 && bd[K - 1] < (r * cell) * (r * cell)) break;
    }
    let tot = 0;
    for (let j = 0; j < K; j++) { const w = bi[j] >= 0 ? 1 / (Math.sqrt(bd[j]) + cell * 0.15) ** 2 : 0; nW[v * K + j] = w; nIdx[v * K + j] = Math.max(bi[j], 0); tot += w; }
    for (let j = 0; j < K; j++) nW[v * K + j] /= tot || 1;
  }
  return { nIdx, nW, K };
}

/**
 * Replace R.parts flagged organic with one fused surface.
 * prims are in model space at scale `sc`; `key` identifies the species (cache).
 */
export function fuseOrganic(R, prims, sc, key, colorFn = null, res = 150) {
  const organic = R.parts.filter((g) => g.userData.organic);
  if (!organic.length) return;
  // gather organic source vertices
  let ns = 0; for (const g of organic) ns += g.attributes.position.count;
  const src = new Float32Array(ns * 3), sCol = new Float32Array(ns * 3), sIdx = new Uint16Array(ns * 4), sW = new Float32Array(ns * 4);
  let o = 0;
  for (const g of organic) {
    const n = g.attributes.position.count;
    src.set(g.attributes.position.array, o * 3); sCol.set(g.attributes.color.array, o * 3);
    sIdx.set(g.attributes.skinIndex.array, o * 4); sW.set(g.attributes.skinWeight.array, o * 4);
    o += n;
  }
  let C = CACHE.get(key);
  if (!C || C.ns !== ns) {
    const mn = new THREE.Vector3(Infinity, Infinity, Infinity), mx = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
    for (const p of prims) { mn.min(p.min); mx.max(p.max); }
    const size = mx.clone().sub(mn);
    const vs = Math.max(size.x, size.y, size.z) / res;
    const org = mn.clone().subScalar(vs * 2);
    const nx = Math.ceil(size.x / vs) + 5, ny = Math.ceil(size.y / vs) + 5, nz = Math.ceil(size.z / vs) + 5;
    const field = new Float32Array(nx * ny * nz).fill(1e3);
    for (const p of prims) {
      const x0 = Math.max(0, Math.floor((p.min.x - org.x) / vs)), x1 = Math.min(nx - 1, Math.ceil((p.max.x - org.x) / vs));
      const y0 = Math.max(0, Math.floor((p.min.y - org.y) / vs)), y1 = Math.min(ny - 1, Math.ceil((p.max.y - org.y) / vs));
      const z0 = Math.max(0, Math.floor((p.min.z - org.z) / vs)), z1 = Math.min(nz - 1, Math.ceil((p.max.z - org.z) / vs));
      for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = org.x + x * vs, py = org.y + y * vs, pz = org.z + z * vs;
        const d = p.type === 'cone' ? sdRoundCone(px, py, pz, p) : sdEll(px, py, pz, p);
        const i = x + nx * (y + ny * z);
        field[i] = smin(field[i], d, p.k);
      }
    }
    const { pos, idx } = polygonise(field, nx, ny, nz, org, vs);
    const nrm = gradNormals(pos, field, nx, ny, nz, org, vs);
    const tm = transferMap(pos, src, vs * 2.5);
    const unit = new Float32Array(pos.length);
    for (let i = 0; i < pos.length; i++) unit[i] = pos[i] / sc;
    C = { ns, unit, nrm, idx: idx.length > 65535 * 3 ? new Uint32Array(idx) : new Uint32Array(idx), tm };
    CACHE.set(key, C);
  }
  const nv = C.unit.length / 3;
  const P = new Float32Array(C.unit.length);
  for (let i = 0; i < P.length; i++) P[i] = C.unit[i] * sc;
  const col = new Float32Array(nv * 3);
  const haveW = !!C.si;
  const si = C.si || new Uint16Array(nv * 4), sw = C.sw || new Float32Array(nv * 4);
  const { nIdx, nW, K } = C.tm;
  const acc = new Map();
  for (let v = 0; v < nv; v++) {
    acc.clear();
    if (haveW && colorFn) {
      _p.set(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); _n.set(C.nrm[v * 3], C.nrm[v * 3 + 1], C.nrm[v * 3 + 2]);
      colorFn(_p, _n, _c);
      let r = 0, g = 0, b = 0;
      for (let j = 0; j < K; j++) { const s2 = nIdx[v * K + j], w = nW[v * K + j]; r += sCol[s2 * 3] * w; g += sCol[s2 * 3 + 1] * w; b += sCol[s2 * 3 + 2] * w; }
      col[v * 3] = _c.r * 0.8 + r * 0.2; col[v * 3 + 1] = _c.g * 0.8 + g * 0.2; col[v * 3 + 2] = _c.b * 0.8 + b * 0.2;
      continue;
    }
    let r = 0, g = 0, b = 0;
    for (let j = 0; j < K; j++) {
      const s = nIdx[v * K + j], w = nW[v * K + j];
      r += sCol[s * 3] * w; g += sCol[s * 3 + 1] * w; b += sCol[s * 3 + 2] * w;
      for (let q = 0; q < 4; q++) { const bw = sW[s * 4 + q] * w; if (bw > 0) { const bi = sIdx[s * 4 + q]; acc.set(bi, (acc.get(bi) || 0) + bw); } }
    }
    if (colorFn) {
      _p.set(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); _n.set(C.nrm[v * 3], C.nrm[v * 3 + 1], C.nrm[v * 3 + 2]);
      colorFn(_p, _n, _c);
      // keep a hint of the limb shading from the source parts
      r = _c.r * 0.8 + r * 0.2; g = _c.g * 0.8 + g * 0.2; b = _c.b * 0.8 + b * 0.2;
    }
    col[v * 3] = r; col[v * 3 + 1] = g; col[v * 3 + 2] = b;
    const top = [...acc.entries()].sort((a, c) => c[1] - a[1]).slice(0, 4);
    let tot = 0; for (const [, w] of top) tot += w;
    top.forEach(([bi, w], q) => { si[v * 4 + q] = bi; sw[v * 4 + q] = w / (tot || 1); });
  }
  C.si = si; C.sw = sw;
  // expand to non-indexed to match RigBuilder.build's merge (all parts non-indexed)
  const T = C.idx, n3 = T.length;
  const g = new THREE.BufferGeometry();
  const mk = (arr, size) => { const out = new arr.constructor(n3 * size); for (let i = 0; i < n3; i++) for (let k = 0; k < size; k++) out[i * size + k] = arr[T[i] * size + k]; return out; };
  g.setAttribute('position', new THREE.BufferAttribute(mk(P, 3), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(mk(C.nrm, 3), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n3 * 2), 2));
  g.setAttribute('color', new THREE.BufferAttribute(mk(col, 3), 3));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(mk(si, 4), 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(mk(sw, 4), 4));
  R.parts = R.parts.filter((p) => !p.userData.organic);
  R.parts.push(g);
}
