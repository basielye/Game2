// Poly Haven photoscans (CC0): cliffs, mossy rock sets, a log, branches, rocky ground — plus EZ-Tree stones (MIT).
// Each mesh is baked to a clean pivot (base at y=0, centred in XZ) with a simplified far-LOD.
import * as THREE from 'three';
import { MeshoptSimplifier } from 'meshoptimizer';
import { gltf } from '../core/assets.js';

function bake(mesh) {
  mesh.updateWorldMatrix(true, false);
  let g = mesh.geometry.clone();
  g.applyMatrix4(mesh.matrixWorld);
  if (mesh.matrixWorld.determinant() < 0 && g.index) {
    const ix = g.index.array;
    for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
    g.index.needsUpdate = true;
  }
  g.computeBoundingBox();
  const bb = g.boundingBox, c = bb.getCenter(new THREE.Vector3());
  g.translate(-c.x, -bb.min.y, -c.z);
  if (!g.attributes.normal) g.computeVertexNormals();
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
  g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

function simplify(g, ratio, error = 0.02) {
  if (!g.index) return g;
  const src = g.index.array;
  const idx = src instanceof Uint32Array ? src : new Uint32Array(src);
  const pos = g.attributes.position.array;
  const target = Math.max(36, Math.floor((idx.length * ratio) / 3) * 3);
  const [out] = MeshoptSimplifier.simplify(idx, pos, 3, target, error, ['LockBorder']);
  const s = g.clone();
  s.setIndex(new THREE.BufferAttribute(out, 1));
  return s;
}

const size = (g) => g.boundingBox.getSize(new THREE.Vector3());

export async function loadPhotoscans(renderer) {
  await MeshoptSimplifier.ready;
  const res = { rocks: [], boulders: [], cliffs: [], logs: [], branches: [], ground: [] };
  const scene = (await gltf(renderer, 'models/photoscans.glb')).scene;
  scene.updateMatrixWorld(true);
  const items = [];
  scene.traverse((o) => { if (o.isMesh && !o.isInstancedMesh) items.push(o); else if (o.isInstancedMesh) items.push(o); });
  for (const m of items) {
    const name = m.material.name || '';
    const geo = bake(m);
    const mat = m.material;
    mat.side = THREE.FrontSide;
    mat.envMapIntensity = 1;
    if (mat.map) mat.map.anisotropy = 8;
    const tris = geo.index ? geo.index.count / 3 : 0;
    const entry = (ratioNear, ratioFar) => ({ near: ratioNear < 1 ? simplify(geo, ratioNear, 0.01) : geo, far: simplify(geo, ratioFar, 0.05), mat, size: size(geo), name });
    if (name.startsWith('rock_moss_set')) res.rocks.push(entry(0.07, 0.015));
    else if (name.startsWith('namaqualand_cliff')) res.cliffs.push(entry(0.12, 0.015));
    else if (name.startsWith('coastal_cliff')) res.cliffs.push(entry(0.6, 0.12));
    else if (name.startsWith('tree_trunk')) res.logs.push(entry(0.08, 0.02));
    else if (name.startsWith('dry_branches')) res.branches.push(entry(1, 0.2));
    else if (name.startsWith('coast_land_rocks')) res.ground.push(entry(0.1, 0.02));
  }
  // EZ-Tree stones
  for (const f of ['rock1', 'rock2', 'rock3']) {
    const s = (await gltf(renderer, `models/${f}.glb`)).scene;
    s.updateMatrixWorld(true);
    s.traverse((o) => {
      if (!o.isMesh) return;
      const geo = bake(o);
      o.material.side = THREE.FrontSide;
      res.boulders.push({ near: geo, far: simplify(geo, 0.25, 0.05), mat: o.material, size: size(geo), name: f });
    });
  }
  return res;
}
