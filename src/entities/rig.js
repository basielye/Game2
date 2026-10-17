// RigBuilder: builds a single SkinnedMesh out of procedurally generated parts bound to a bone hierarchy.
// Rigid parts are 100% weighted to one bone; organic parts (bodies, tails, necks) get smooth chain weights.
import * as THREE from 'three';

export class RigBuilder {
  constructor() {
    this.root = new THREE.Object3D();
    this.bones = [];
    this.byName = {};
    this.parts = [];
  }
  bone(name, parent, x, y, z) {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(x, y, z);
    (parent || this.root).add(b);
    b.userData.index = this.bones.length;
    this.bones.push(b);
    this.byName[name] = b;
    return b;
  }
  // geometry given in the bone's local space
  rigid(geo, bone, color) {
    this.root.updateMatrixWorld(true);
    const g = (geo.index ? geo.toNonIndexed() : geo.clone());
    g.applyMatrix4(bone.matrixWorld);
    this._push(g, () => [bone.userData.index, 0, 0, 0], () => [1, 0, 0, 0], color);
  }
  // geometry in model space with a weight function (pos) => [[boneIndex, weight], ...]
  skinned(geo, weightFn, color) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    this._push(g, null, null, color, weightFn);
  }
  _push(g, idxFn, wFn, color, weightFn) {
    const n = g.attributes.position.count;
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), col = new Float32Array(n * 3);
    const p = new THREE.Vector3(), nm = new THREE.Vector3(), c = new THREE.Color();
    if (!g.attributes.normal) g.computeVertexNormals();
    for (let i = 0; i < n; i++) {
      p.fromBufferAttribute(g.attributes.position, i);
      nm.fromBufferAttribute(g.attributes.normal, i);
      if (weightFn) {
        const ws = weightFn(p);
        let tot = 0;
        for (let k = 0; k < 4; k++) { const w = ws[k]; if (w) { si[i * 4 + k] = w[0]; sw[i * 4 + k] = w[1]; tot += w[1]; } }
        if (tot > 0) for (let k = 0; k < 4; k++) sw[i * 4 + k] /= tot;
      } else {
        const ii = idxFn(), ww = wFn();
        for (let k = 0; k < 4; k++) { si[i * 4 + k] = ii[k]; sw[i * 4 + k] = ww[k]; }
      }
      if (typeof color === 'function') color(p, nm, c, i); else c.set(color);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color', 'skinIndex', 'skinWeight'].includes(k)) g.deleteAttribute(k);
    g.userData.organic = !!this.organic;
    this.parts.push(g);
  }
  build(material, boundsRadius = 3, boundsCenter = new THREE.Vector3()) {
    // merge manually (all non-indexed, same attributes)
    let total = 0;
    for (const g of this.parts) total += g.attributes.position.count;
    const attrs = { position: 3, normal: 3, uv: 2, color: 3, skinIndex: 4, skinWeight: 4 };
    const merged = new THREE.BufferGeometry();
    for (const [k, size] of Object.entries(attrs)) {
      const arr = k === 'skinIndex' ? new Uint16Array(total * size) : new Float32Array(total * size);
      let off = 0;
      for (const g of this.parts) { arr.set(g.attributes[k].array, off); off += g.attributes[k].array.length; }
      merged.setAttribute(k, new THREE.BufferAttribute(arr, size));
    }
    const mesh = new THREE.SkinnedMesh(merged, material);
    mesh.add(this.root);
    mesh.updateMatrixWorld(true);
    const skel = new THREE.Skeleton(this.bones);
    mesh.bind(skel);
    mesh.boundingSphere = new THREE.Sphere(boundsCenter, boundsRadius);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.bones = this.byName;
    // store rest rotations for animation offsets
    for (const b of this.bones) b.userData.rest = b.quaternion.clone(), b.userData.restPos = b.position.clone();
    return mesh;
  }
}

// Capsule-ish limb along -Y from origin, radius r0 at top to r1 at bottom.
export function limb(len, r0, r1, radial = 8, rings = 5, bulge = 0) {
  const pts = [];
  const steps = rings + 4;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let r;
    if (t < 0.15) r = r0 * Math.sin((t / 0.15) * Math.PI / 2);
    else if (t > 0.85) r = r1 * Math.sin(((1 - t) / 0.15) * Math.PI / 2);
    else { const u = (t - 0.15) / 0.7; r = r0 + (r1 - r0) * u + bulge * Math.sin(u * Math.PI) * Math.max(r0, r1); }
    pts.push(new THREE.Vector2(Math.max(r, 0.0005), -t * (len + r0 * 0.3) + r0 * 0.15));
  }
  const g = new THREE.LatheGeometry(pts, radial);
  return g;
}

export function ellipsoid(rx, ry, rz, ws = 12, hs = 8) {
  const g = new THREE.SphereGeometry(1, ws, hs);
  g.scale(rx, ry, rz);
  return g;
}

// Orient a geometry built along -Y so it points along a direction vector.
export function pointAlong(geo, dir) {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.clone().normalize());
  geo.applyQuaternion(q);
  return geo;
}

// Smoothly blend a rotation offset (Euler) on top of a bone's rest pose.
const _q = new THREE.Quaternion(), _e = new THREE.Euler();
export function setRot(bone, x, y = 0, z = 0) {
  _e.set(x, y, z, 'XYZ');
  _q.setFromEuler(_e);
  bone.quaternion.copy(bone.userData.rest).multiply(_q);
}
