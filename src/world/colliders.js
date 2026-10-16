// Static collision world in the XZ plane (circles + oriented boxes) with a spatial hash, plus vertical extents.
const CS = 12;
export class Colliders {
  constructor() { this.grid = new Map(); this.all = []; }
  _key(i, j) { return i * 73856093 ^ j * 19349663; }
  _insert(c, minx, minz, maxx, maxz) {
    for (let i = Math.floor(minx / CS); i <= Math.floor(maxx / CS); i++)
      for (let j = Math.floor(minz / CS); j <= Math.floor(maxz / CS); j++) {
        const k = this._key(i, j);
        let a = this.grid.get(k);
        if (!a) this.grid.set(k, (a = []));
        a.push(c);
      }
    this.all.push(c);
  }
  addCircle(x, z, r, y0 = -100, y1 = 100, tag = null) {
    const c = { type: 0, x, z, r, y0, y1, tag };
    this._insert(c, x - r, z - r, x + r, z + r);
    return c;
  }
  // Oriented box: centre, half-extents (hx along local x, hz along local z), rotation about Y.
  addBox(x, z, hx, hz, rot, y0, y1, tag = null) {
    const c = { type: 1, x, z, hx, hz, rot, cos: Math.cos(rot), sin: Math.sin(rot), y0, y1, tag };
    const R = Math.hypot(hx, hz);
    this._insert(c, x - R, z - R, x + R, z + R);
    return c;
  }
  query(x, z, out = []) {
    out.length = 0;
    const a = this.grid.get(this._key(Math.floor(x / CS), Math.floor(z / CS)));
    if (a) for (const c of a) out.push(c);
    return out;
  }
  // Push a circle (x,z,r) at vertical range [y, y+h] out of all colliders. Returns corrected position.
  resolve(pos, r, h = 1.8, ignoreTag = null) {
    let hit = false;
    for (let pass = 0; pass < 2; pass++) {
      const seen = new Set();
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
        const a = this.grid.get(this._key(Math.floor(pos.x / CS) + di, Math.floor(pos.z / CS) + dj));
        if (!a) continue;
        for (const c of a) {
          if (seen.has(c)) continue; seen.add(c);
          if (pos.y > c.y1 || pos.y + h < c.y0) continue;
          if (ignoreTag && c.tag === ignoreTag) continue;
          if (c.type === 0) {
            const dx = pos.x - c.x, dz = pos.z - c.z;
            const d = Math.hypot(dx, dz), m = r + c.r;
            if (d < m && d > 1e-5) { pos.x = c.x + (dx / d) * m; pos.z = c.z + (dz / d) * m; hit = true; }
          } else {
            // to local
            const dx = pos.x - c.x, dz = pos.z - c.z;
            const lx = dx * c.cos - dz * c.sin, lz = dx * c.sin + dz * c.cos;
            const cx = Math.max(-c.hx, Math.min(c.hx, lx)), cz = Math.max(-c.hz, Math.min(c.hz, lz));
            let ox = lx - cx, oz = lz - cz;
            let d = Math.hypot(ox, oz);
            let nlx, nlz;
            if (d < 1e-5) {
              // inside: push out along smallest axis
              const px = c.hx - Math.abs(lx), pz = c.hz - Math.abs(lz);
              if (px < pz) { nlx = Math.sign(lx) * (c.hx + r); nlz = lz; } else { nlx = lx; nlz = Math.sign(lz) * (c.hz + r); }
            } else if (d < r) {
              nlx = cx + (ox / d) * r; nlz = cz + (oz / d) * r;
            } else continue;
            // back to world
            pos.x = c.x + nlx * c.cos + nlz * c.sin;
            pos.z = c.z - nlx * c.sin + nlz * c.cos;
            hit = true;
          }
        }
      }
    }
    return hit;
  }
  // Highest walkable surface (box top) under a point, for standing on platforms / floors.
  floorAt(x, y, z, r = 0.3) {
    let best = -Infinity;
    const a = this.grid.get(this._key(Math.floor(x / CS), Math.floor(z / CS)));
    if (!a) return best;
    for (const c of a) {
      if (c.type !== 1 || !c.walkable) continue;
      const dx = x - c.x, dz = z - c.z;
      const lx = dx * c.cos - dz * c.sin, lz = dx * c.sin + dz * c.cos;
      if (Math.abs(lx) <= c.hx + r && Math.abs(lz) <= c.hz + r && c.y1 <= y + 0.6 && c.y1 > best) best = c.y1;
    }
    return best;
  }
  // Ray vs colliders (XZ boxes extruded in Y, circles as cylinders). Returns nearest t or -1.
  raycast(o, d, maxT) {
    let best = -1;
    const steps = Math.ceil(maxT / CS) + 1;
    const seen = new Set();
    for (let s = 0; s <= steps; s++) {
      const t = Math.min(maxT, s * CS);
      const px = o.x + d.x * t, pz = o.z + d.z * t;
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
        const a = this.grid.get(this._key(Math.floor(px / CS) + di, Math.floor(pz / CS) + dj));
        if (!a) continue;
        for (const c of a) {
          if (seen.has(c)) continue; seen.add(c);
          const tt = c.type === 0 ? rayCyl(o, d, c) : rayBox(o, d, c);
          if (tt >= 0 && tt <= maxT && (best < 0 || tt < best)) best = tt;
        }
      }
      if (best >= 0 && best < t - CS) break;
    }
    return best;
  }
}

function rayCyl(o, d, c) {
  const ox = o.x - c.x, oz = o.z - c.z;
  const a = d.x * d.x + d.z * d.z, b = 2 * (ox * d.x + oz * d.z), cc = ox * ox + oz * oz - c.r * c.r;
  const disc = b * b - 4 * a * cc;
  if (disc < 0 || a < 1e-8) return -1;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  if (t < 0) return -1;
  const y = o.y + d.y * t;
  return y >= c.y0 && y <= c.y1 ? t : -1;
}
function rayBox(o, d, c) {
  const dx = o.x - c.x, dz = o.z - c.z;
  const lox = dx * c.cos - dz * c.sin, loz = dx * c.sin + dz * c.cos;
  const ldx = d.x * c.cos - d.z * c.sin, ldz = d.x * c.sin + d.z * c.cos;
  let tmin = -Infinity, tmax = Infinity;
  const slab = (oo, dd, lo, hi) => {
    if (Math.abs(dd) < 1e-8) { if (oo < lo || oo > hi) { tmin = Infinity; } return; }
    let t1 = (lo - oo) / dd, t2 = (hi - oo) / dd;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
  };
  slab(lox, ldx, -c.hx, c.hx); slab(loz, ldz, -c.hz, c.hz); slab(o.y, d.y, c.y0, c.y1);
  if (tmax < tmin || tmax < 0) return -1;
  return tmin >= 0 ? tmin : -1;
}
