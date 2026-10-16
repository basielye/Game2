// Gatherable resource nodes (branches, fiber plants, flint, herbs, berries, amber) placed deterministically around the player.
import * as THREE from 'three';
import { noise } from '../core/noise.js';
import { blob, merge, colorize } from './geom.js';
import { getTex } from '../core/textures.js';

const CELL = 9;
const TYPES = {
  wood: { label: 'Gather wood', item: 'wood', n: [1, 2] },
  fiber: { label: 'Gather plant fiber', item: 'fiber', n: [1, 3] },
  flint: { label: 'Pick up flint', item: 'flint', n: [1, 2] },
  herb: { label: 'Pick healing herb', item: 'herb', n: [1, 1] },
  berries: { label: 'Pick berries', item: 'berries', n: [2, 3] },
  amber: { label: 'Dig up amber', item: 'amber', n: [1, 1] },
};

function hash(i, j, s = 0) { let h = (i * 374761393 + j * 668265263 + s * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

export class Pickups {
  constructor(game) {
    this.game = game;
    this.taken = new Map(); // id -> game day taken
    this.active = [];
    this.group = new THREE.Group();
    this.meshes = {};
    const mk = (geo, mat, cap = 160) => { const m = new THREE.InstancedMesh(geo, mat, cap); m.count = 0; m.castShadow = true; m.frustumCulled = false; this.group.add(m); return m; };
    const bark = new THREE.MeshStandardMaterial({ map: getTex('bark'), roughness: 0.9 });
    const branch = new THREE.CylinderGeometry(0.06, 0.09, 1.6, 6); branch.rotateZ(Math.PI / 2); branch.translate(0, 0.08, 0);
    const twig = new THREE.CylinderGeometry(0.03, 0.04, 0.6, 5); twig.rotateZ(Math.PI / 2.6); twig.translate(0.3, 0.15, 0.1);
    this.meshes.wood = mk(merge([branch, twig]), bark);
    const fib = []; for (let i = 0; i < 7; i++) { const c = new THREE.ConeGeometry(0.06, 0.9, 4); c.translate(0, 0.45, 0); c.rotateZ((i - 3) * 0.18); c.rotateY(i * 0.9); fib.push(c); }
    this.meshes.fiber = mk(merge(fib), new THREE.MeshStandardMaterial({ color: 0x6a9a3a, roughness: 0.8 }));
    const rng = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
    this.meshes.flint = mk(blob(0.22, 1, rng, 0.6, 0.3), new THREE.MeshStandardMaterial({ color: 0x4a4a52, roughness: 0.35, metalness: 0.1 }));
    const herb = []; for (let i = 0; i < 5; i++) { const l = new THREE.SphereGeometry(0.1, 5, 4); l.scale(1, 0.4, 1.8); l.translate(0, 0.25, 0.15); l.rotateY(i * 1.25); herb.push(colorize(l, 0.3, 0.6, 0.25)); }
    const flower = new THREE.SphereGeometry(0.07, 6, 4); flower.translate(0, 0.42, 0); herb.push(colorize(flower, 0.9, 0.15, 0.2));
    this.meshes.herb = mk(merge(herb), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, emissive: 0x220000 }));
    const bush = []; const b0 = blob(0.45, 1, rng, 0.8, 0.2); b0.translate(0, 0.35, 0); bush.push(colorize(b0, 0.2, 0.4, 0.15));
    for (let i = 0; i < 9; i++) { const be = new THREE.SphereGeometry(0.05, 5, 4); be.translate(Math.cos(i) * 0.38, 0.3 + (i % 3) * 0.12, Math.sin(i) * 0.38); bush.push(colorize(be, 0.25, 0.2, 0.75)); }
    this.meshes.berries = mk(merge(bush), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }));
    this.meshes.amber = mk(blob(0.16, 1, rng, 0.8, 0.2), new THREE.MeshStandardMaterial({ color: 0xff9a20, emissive: 0xa04000, emissiveIntensity: 0.6, roughness: 0.15, transparent: true, opacity: 0.9 }));
    this.last = new THREE.Vector3(1e9, 0, 0);
    this._m = new THREE.Matrix4();
  }

  typeAt(i, j) {
    const T = this.game.terrain;
    const r = hash(i, j);
    if (r > 0.42) return null;
    const x = (i + 0.2 + hash(i, j, 1) * 0.6) * CELL, z = (j + 0.2 + hash(i, j, 2) * 0.6) * CELL;
    const h = T.getHeight(x, z);
    if (h < 1.2 || T.getRoad(x, z) > 0.3 || T.getFlat(x, z) > 0.5) return null;
    const slope = T.slope(x, z);
    const forest = noise.fbm(x * 0.0045 + 40, z * 0.0045 - 12, 4);
    const t = hash(i, j, 3);
    let type;
    if (slope > 0.3 || h > 100) type = t < 0.65 ? 'flint' : t < 0.7 ? 'amber' : 'wood';
    else if (h < 5) type = t < 0.4 ? 'wood' : t < 0.7 ? 'fiber' : t < 0.85 ? 'flint' : 'berries';
    else if (forest > -0.12) type = t < 0.32 ? 'wood' : t < 0.58 ? 'fiber' : t < 0.7 ? 'herb' : t < 0.82 ? 'berries' : t < 0.97 ? 'flint' : 'amber';
    else type = t < 0.3 ? 'fiber' : t < 0.48 ? 'flint' : t < 0.62 ? 'herb' : t < 0.8 ? 'wood' : t < 0.98 ? 'berries' : 'amber';
    return { type, x, z, y: h, id: i + ':' + j, rot: hash(i, j, 4) * 6.28 };
  }

  isTaken(id) {
    const d = this.taken.get(id);
    if (d == null) return false;
    if (this.game.day - d >= 2) { this.taken.delete(id); return false; }
    return true;
  }

  update(playerPos, force = false) {
    if (!force && playerPos.distanceToSquared(this.last) < 25) return;
    this.last.copy(playerPos);
    const R = 70;
    const counts = {};
    for (const k in this.meshes) counts[k] = 0;
    this.active.length = 0;
    const i0 = Math.floor((playerPos.x - R) / CELL), i1 = Math.floor((playerPos.x + R) / CELL);
    const j0 = Math.floor((playerPos.z - R) / CELL), j1 = Math.floor((playerPos.z + R) / CELL);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const p = this.typeAt(i, j);
      if (!p || this.isTaken(p.id)) continue;
      const m = this.meshes[p.type];
      if (counts[p.type] >= m.instanceMatrix.count) continue;
      this._m.makeRotationY(p.rot).setPosition(p.x, p.y, p.z);
      m.setMatrixAt(counts[p.type]++, this._m);
      p.pos = new THREE.Vector3(p.x, p.y + 0.3, p.z);
      this.active.push(p);
    }
    for (const k in this.meshes) { this.meshes[k].count = counts[k]; this.meshes[k].instanceMatrix.needsUpdate = true; }
  }

  nearest(pos, maxD = 2.2) {
    let best = null, bd = maxD * maxD;
    for (const p of this.active) { const d = p.pos.distanceToSquared(pos); if (d < bd) { bd = d; best = p; } }
    return best ? { ...best, label: TYPES[best.type].label, action: 'gather' } : null;
  }

  take(p) {
    const T = TYPES[p.type];
    const n = T.n[0] + Math.floor(Math.random() * (T.n[1] - T.n[0] + 1));
    const got = this.game.inventory.add(T.item, n);
    if (got > 0) { this.taken.set(p.id, this.game.day); this.update(this.game.player.pos, true); if (p.type === 'amber') this.game.stats.amber++; }
    return got;
  }
}
