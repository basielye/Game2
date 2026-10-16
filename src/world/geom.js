// Geometry helpers for procedural organic modelling.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export { mergeGeometries };

// Tube along a curve with a radius function r(t) and optional elliptical scale.
export function taperTube(curve, segs, radial, rFn, { capEnd = true, uvScale = 1 } = {}) {
  const frames = curve.computeFrenetFrames(segs, false);
  const pos = [], nor = [], uv = [], idx = [];
  const P = new THREE.Vector3(), N = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    curve.getPointAt(t, P);
    const r = rFn(t);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const s = Math.sin(a), c = -Math.cos(a);
      N.set(0, 0, 0).addScaledVector(frames.normals[i], c).addScaledVector(frames.binormals[i], s).normalize();
      pos.push(P.x + N.x * r, P.y + N.y * r, P.z + N.z * r);
      nor.push(N.x, N.y, N.z);
      uv.push(j / radial, t * uvScale);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// A drooping frond strip (palm leaf / fern / conifer branch). u runs along length, v across.
export function frondStrip(origin, yaw, length, width, droop, rise, segs = 8, fold = 0.25, pitch = 0) {
  const pos = [], nor = [], uv = [], idx = [];
  const dir = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw));
  const side = new THREE.Vector3(-dir.z, 0, dir.x);
  for (let i = 0; i <= segs; i++) {
    const s = i / segs;
    const along = s * length;
    const y = rise * s * length + pitch * along - droop * s * s * length;
    const center = new THREE.Vector3().copy(origin).addScaledVector(dir, along * Math.cos(pitch * 0.3)).add(new THREE.Vector3(0, y, 0));
    for (let k = 0; k < 3; k++) {
      const v = k / 2;
      const off = (v - 0.5) * width;
      const lift = (k === 1 ? fold : 0) * width * (1 - s * 0.5);
      pos.push(center.x + side.x * off, center.y + lift, center.z + side.z * off);
      const n = new THREE.Vector3(0, 1, 0).addScaledVector(side, (v - 0.5) * -0.8).addScaledVector(dir, droop * s * 0.6).normalize();
      nor.push(n.x, n.y, n.z);
      uv.push(s, v);
    }
  }
  for (let i = 0; i < segs; i++) for (let k = 0; k < 2; k++) {
    const a = i * 3 + k, b = a + 3;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// A cluster of leaf cards around a centre, normals pointing outwards (soft volumetric shading).
export function leafCluster(center, radius, count, cardSize, rng) {
  const geos = [];
  for (let i = 0; i < count; i++) {
    const p = new THREE.Vector3(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1).normalize().multiplyScalar(radius * Math.cbrt(rng()) * 0.85);
    p.y *= 0.65;
    const g = new THREE.PlaneGeometry(cardSize, cardSize);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI));
    g.applyQuaternion(q);
    g.translate(center.x + p.x, center.y + p.y, center.z + p.z);
    // spherical normals
    const pa = g.attributes.position, na = g.attributes.normal;
    for (let k = 0; k < pa.count; k++) {
      const n = new THREE.Vector3(pa.getX(k) - center.x, (pa.getY(k) - center.y) * 1.2 + radius * 0.35, pa.getZ(k) - center.z).normalize();
      na.setXYZ(k, n.x, n.y, n.z);
    }
    geos.push(g);
  }
  return mergeGeometries(geos);
}

// Lumpy rock / low-detail blob.
export function blob(radius, detail, rng, squash = 0.7, rough = 0.28) {
  const g = new THREE.IcosahedronGeometry(radius, detail);
  const pa = g.attributes.position;
  const seed = rng() * 100;
  const v = new THREE.Vector3();
  for (let i = 0; i < pa.count; i++) {
    v.fromBufferAttribute(pa, i);
    const n = Math.sin(v.x * 2.1 + seed) * Math.cos(v.z * 1.7 - seed) + Math.sin(v.y * 3.3 + seed * 2) * 0.5;
    v.multiplyScalar(1 + n * rough);
    v.y *= squash;
    pa.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

export function colorize(g, r, gg, b) {
  const n = g.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { c[i * 3] = r; c[i * 3 + 1] = gg; c[i * 3 + 2] = b; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

// Ensures every geometry in a merge list has the same attribute set.
export function normalizeAttrs(geos) {
  const out = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const want = new Set();
  out.forEach((g) => Object.keys(g.attributes).forEach((k) => want.add(k)));
  for (const g of out) {
    const n = g.attributes.position.count;
    if (want.has('uv') && !g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    if (want.has('color') && !g.attributes.color) colorize(g, 1, 1, 1);
    for (const k of Object.keys(g.attributes)) if (!want.has(k)) g.deleteAttribute(k);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
  }
  return out;
}

export function merge(geos) {
  return mergeGeometries(normalizeAttrs(geos));
}
