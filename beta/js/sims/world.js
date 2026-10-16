/* The lot: floors, walls on tile edges, furniture, rooms, pathfinding and rendering. */
const World = (() => {
  const W = 24, H = 20;
  const DIRS = [[0, 1], [-1, 0], [0, -1], [1, 0]];
  const O = Catalog.OBJ;
  let uid = 1;

  function create() {
    return {
      floors: Array.from({ length: H }, () => Array(W).fill('grass')),
      hw: Array.from({ length: H + 1 }, () => Array(W).fill(null)),   // hw[y][x]: wall on line y, from x to x+1
      vw: Array.from({ length: H }, () => Array(W + 1).fill(null)),   // vw[y][x]: wall on line x, from y to y+1
      objects: [], puddles: []
    };
  }

  /* ───────────── object geometry ───────────── */
  const rot = (u, v, r) => r === 0 ? [u, v] : r === 1 ? [-v, u] : r === 2 ? [-u, -v] : [v, -u];
  function frame(o) {
    const d = O[o.id] || Catalog.plantDef(o.id.slice(6));
    const cs = [[0, 0], [d.w, 0], [0, d.d], [d.w, d.d]].map(([u, v]) => rot(u, v, o.r));
    const mx = Math.min(...cs.map(c => c[0])), my = Math.min(...cs.map(c => c[1]));
    const toW = (u, v) => { const [a, b] = rot(u, v, o.r); return [a - mx + o.x, b - my + o.y]; };
    return { d, toW };
  }
  function defOf(o) { return O[o.id] || Catalog.plantDef(o.id.slice(6)); }
  function cells(o) {
    const { d, toW } = frame(o), out = [];
    for (let u = 0; u < d.w; u++) for (let v = 0; v < d.d; v++) { const [x, y] = toW(u + .5, v + .5); out.push([Math.floor(x), Math.floor(y)]); }
    return out;
  }
  /* World tiles a Sim uses for an action: the tile to stand on and (for 'on' spots) the approach tile. */
  function spotsFor(o, act) {
    const { d, toW } = frame(o), out = [];
    if (act.spot === 'on') {
      const list = d.spots || [[0, 0]];
      list.forEach(([u, v], i) => {
        const [sx, sy] = toW(u + .5, v + .5), [ax, ay] = toW(u + .5, v + 1.5);
        const lie = d.lie && d.lie[i] ? toW(d.lie[i][0], d.lie[i][1]) : [sx, sy];
        out.push({ i, tile: [Math.floor(sx), Math.floor(sy)], approach: [Math.floor(ax), Math.floor(ay)], pos: [sx, sy], lie, face: DIRS[o.r] });
      });
    } else {
      const list = d.spotsFront || Array.from({ length: d.w }, (_, u) => [u, d.d - 1 + (act.range || 1)]);
      list.forEach(([u, v], i) => {
        const [sx, sy] = toW(u + .5, v + .5);
        out.push({ i, tile: [Math.floor(sx), Math.floor(sy)], pos: [sx, sy], face: DIRS[(o.r + 2) % 4] });
      });
    }
    return out;
  }

  /* ───────────── queries ───────────── */
  const inLot = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  function objectAt(L, x, y, includeFlat) {
    let flat = null;
    for (const o of L.objects) for (const [cx, cy] of cells(o)) if (cx === x && cy === y) { if (defOf(o).flat) flat = o; else return o; }
    return includeFlat ? flat : null;
  }
  function blockedGrid(L) {
    const g = Array.from({ length: H }, () => new Uint8Array(W));
    for (const o of L.objects) if (!defOf(o).flat) for (const [x, y] of cells(o)) if (inLot(x, y)) g[y][x] = 1;
    return g;
  }
  function wallBetween(L, x, y, nx, ny) {
    if (nx === x + 1) return L.vw[y][x + 1]; if (nx === x - 1) return L.vw[y][x];
    if (ny === y + 1) return L.hw[y + 1][x]; if (ny === y - 1) return L.hw[y][x];
    return null;
  }
  const passable = w => !w || w.att === 'door' || w.att === 'arch';
  function edgeOpen(L, x, y, nx, ny) {
    if (nx === x + 1) return passable(L.vw[y][x + 1]);
    if (nx === x - 1) return passable(L.vw[y][x]);
    if (ny === y + 1) return passable(L.hw[y + 1][x]);
    if (ny === y - 1) return passable(L.hw[y][x]);
    return false;
  }
  function findPath(L, from, to, grid) {
    grid = grid || blockedGrid(L);
    const [sx, sy] = from, [tx, ty] = to;
    if (!inLot(tx, ty)) return null;
    if (sx === tx && sy === ty) return [];
    const key = (x, y) => y * W + x, open = new Map(), came = new Map(), gS = new Map();
    const h = (x, y) => Math.hypot(x - tx, y - ty);
    gS.set(key(sx, sy), 0); open.set(key(sx, sy), h(sx, sy));
    for (let it = 0; it < 4000 && open.size; it++) {
      let best = null, bf = 1e9;
      for (const [k, f] of open) if (f < bf) { bf = f; best = k; }
      open.delete(best);
      const x = best % W, y = Math.floor(best / W);
      if (x === tx && y === ty) {
        const path = []; let k = best;
        while (k !== key(sx, sy)) { path.unshift([k % W, Math.floor(k / W)]); k = came.get(k); }
        return path;
      }
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (!inLot(nx, ny) || (grid[ny][nx] && !(nx === tx && ny === ty))) continue;
        if (dx && dy) {
          if (grid[y][nx] || grid[ny][x]) continue;
          if (!(edgeOpen(L, x, y, nx, y) && edgeOpen(L, nx, y, nx, ny) && edgeOpen(L, x, y, x, ny) && edgeOpen(L, x, ny, nx, ny))) continue;
        } else if (!edgeOpen(L, x, y, nx, ny)) continue;
        const g = gS.get(best) + (dx && dy ? 1.414 : 1), nk = key(nx, ny);
        if (g < (gS.has(nk) ? gS.get(nk) : 1e9)) { gS.set(nk, g); came.set(nk, best); open.set(nk, g + h(nx, ny)); }
      }
    }
    return null;
  }

  /* Rooms: flood fill separated by any wall. Outdoors = reachable from the lot border. */
  function computeRooms(L) {
    const room = Array.from({ length: H }, () => new Int16Array(W).fill(-1)), rooms = [];
    const walled = (x, y, nx, ny) => {
      if (nx === x + 1) return !!L.vw[y][x + 1]; if (nx === x - 1) return !!L.vw[y][x];
      if (ny === y + 1) return !!L.hw[y + 1][x]; return !!L.hw[y][x];
    };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (room[y][x] >= 0) continue;
      const id = rooms.length, q = [[x, y]], tiles = []; room[y][x] = id; let outdoor = false;
      while (q.length) {
        const [cx, cy] = q.pop(); tiles.push([cx, cy]);
        if (cx === 0 || cy === 0 || cx === W - 1 || cy === H - 1) outdoor = true;
        for (const [dx, dy] of DIRS) {
          const nx = cx + dx, ny = cy + dy;
          if (!inLot(nx, ny) || room[ny][nx] >= 0 || walled(cx, cy, nx, ny)) continue;
          room[ny][nx] = id; q.push([nx, ny]);
        }
      }
      rooms.push({ id, tiles, outdoor, score: 50 });
    }
    // environment score
    for (const r of rooms) {
      let env = r.outdoor ? 45 : 22, fl = 0;
      for (const [x, y] of r.tiles) fl += (Catalog.FLOORS[L.floors[y][x]] || {}).env || 0;
      env += fl / Math.max(1, r.tiles.length) * 3;
      let deco = 0, win = 0;
      for (const o of L.objects) { const c = cells(o)[0]; if (c && inLot(c[0], c[1]) && room[c[1]][c[0]] === r.id) deco += defOf(o).env || 0; }
      for (const [x, y] of r.tiles) {
        for (const w of [L.hw[y][x], L.hw[y + 1][x], L.vw[y][x], L.vw[y][x + 1]]) if (w && w.att === 'window') win++;
      }
      env += deco * 6 / Math.sqrt(Math.max(4, r.tiles.length)) + win * 3 - (r.outdoor ? 0 : Math.max(0, r.tiles.length - 30) * .3);
      r.score = U.clamp(Math.round(env), 0, 100);
    }
    return { room, rooms };
  }

  /* ───────────── building ───────────── */
  function setWallLine(L, x0, y0, x1, y1, val, paper) {
    let n = 0;
    if (y0 === y1) for (let x = Math.min(x0, x1); x < Math.max(x0, x1); x++) { if (y0 < 0 || y0 > H || x < 0 || x >= W) continue; if (!!L.hw[y0][x] !== !!val) n++; L.hw[y0][x] = val ? (L.hw[y0][x] || { p: paper || 'plaster', att: null }) : null; }
    else if (x0 === x1) for (let y = Math.min(y0, y1); y < Math.max(y0, y1); y++) { if (x0 < 0 || x0 > W || y < 0 || y >= H) continue; if (!!L.vw[y][x0] !== !!val) n++; L.vw[y][x0] = val ? (L.vw[y][x0] || { p: paper || 'plaster', att: null }) : null; }
    return n;
  }
  function canPlace(L, o, ignore) {
    const d = defOf(o), cs = cells(o);
    for (const [x, y] of cs) if (!inLot(x, y)) return false;
    for (const other of L.objects) {
      if (other === ignore) continue;
      const od = defOf(other);
      if (!!od.flat !== !!d.flat) continue;
      for (const c of cells(other)) if (cs.some(([x, y]) => x === c[0] && y === c[1])) return false;
    }
    if (!d.flat) for (const [x, y] of cs) for (const [x2, y2] of cs) if (Math.abs(x - x2) + Math.abs(y - y2) === 1 && wallBetween(L, x, y, x2, y2)) return false;
    return true;
  }
  function addObject(L, id, x, y, r = 0, color = 0) { const o = { uid: uid++, id, x, y, r, color }; L.objects.push(o); return o; }
  function lotValue(L) {
    let v = 0;
    for (const o of L.objects) v += defOf(o).price || 0;
    for (const row of L.hw) for (const w of row) if (w) v += 12;
    for (const row of L.vw) for (const w of row) if (w) v += 12;
    return v;
  }

  /* ───────────── starter cottage ───────────── */
  function starter() {
    const L = create();
    for (let x = 0; x < W; x++) { L.floors[17][x] = 'sidewalk'; L.floors[18][x] = 'road'; L.floors[19][x] = 'road'; }
    const room = (x0, y0, x1, y1, fl) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) L.floors[y][x] = fl; };
    room(4, 5, 9, 9, 'oak'); room(9, 5, 12, 9, 'checker'); room(12, 5, 14, 9, 'walnut'); room(4, 9, 9, 13, 'oak'); room(9, 9, 14, 13, 'terracotta');
    for (let y = 13; y < 17; y++) L.floors[y][7] = 'path';
    for (let x = 15; x < 22; x++) L.floors[8][x] = 'path';
    for (let y = 8; y < 17; y++) L.floors[y][15] = 'path';
    setWallLine(L, 4, 5, 14, 5, 1); setWallLine(L, 4, 13, 14, 13, 1); setWallLine(L, 4, 5, 4, 13, 1); setWallLine(L, 14, 5, 14, 13, 1);
    setWallLine(L, 4, 9, 14, 9, 1); setWallLine(L, 9, 5, 9, 9, 1); setWallLine(L, 12, 5, 12, 9, 1);
    const att = (k, x, y, a) => { (k === 'h' ? L.hw : L.vw)[y][x].att = a; };
    att('h', 7, 13, 'door'); att('h', 6, 9, 'door'); att('h', 10, 9, 'door'); att('h', 12, 9, 'door');
    for (const x of [5, 7, 10, 13]) att('h', x, 5, 'window');
    for (const x of [5, 10, 12]) att('h', x, 13, 'window');
    for (const y of [6, 10, 11]) att('v', 4, y, 'window');
    for (const y of [7, 10, 11]) att('v', 14, y, 'window');
    // wallpaper by room
    const paper = (x0, y0, x1, y1, p) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { if (L.hw[y][x]) L.hw[y][x].p = p; if (L.vw[y][x]) L.vw[y][x].p = p; } };
    paper(4, 5, 9, 9, 'sage'); paper(9, 5, 12, 9, 'tile'); paper(12, 5, 14, 9, 'navy'); paper(4, 9, 9, 13, 'botanical'); paper(9, 9, 14, 13, 'plaster');
    for (let x = 4; x < 14; x++) L.hw[13][x].p = 'clapboard';
    for (let y = 5; y < 13; y++) L.vw[y][14].p = 'clapboard';
    // furniture
    addObject(L, 'bed2', 5, 5, 0, 1); addObject(L, 'nightstand', 7, 5, 0); addObject(L, 'plant:m_deliciosa', 4, 8, 0); addObject(L, 'mirror', 8, 5, 0);
    addObject(L, 'toilet', 9, 5, 0); addObject(L, 'basin', 10, 5, 0); addObject(L, 'shower', 11, 5, 0);
    addObject(L, 'computer', 12, 5, 0); addObject(L, 'bookshelf', 13, 5, 0);
    addObject(L, 'tv', 5, 9, 0); addObject(L, 'rug', 5, 10, 0, 0); addObject(L, 'sofa', 5, 12, 2, 0); addObject(L, 'lamp', 4, 9, 0); addObject(L, 'armchair', 8, 11, 1, 0);
    addObject(L, 'plant:e_marble_queen', 4, 12, 0); addObject(L, 'stereo', 8, 9, 0);
    addObject(L, 'fridge', 13, 9, 1, 0); addObject(L, 'stove', 13, 10, 1, 0); addObject(L, 'counter', 13, 11, 1, 0); addObject(L, 'kitchensink', 13, 12, 1, 0);
    addObject(L, 'table', 10, 11, 0); addObject(L, 'chair', 10, 10, 0); addObject(L, 'chair', 11, 12, 2); addObject(L, 'plant:pi_peperomioides', 9, 12, 0);
    addObject(L, 'glasshouse', 16, 2, 0); addObject(L, 'mailbox', 6, 16, 0); addObject(L, 'gardenbed', 17, 11, 0); addObject(L, 'bench', 19, 14, 2);
    addObject(L, 'easel', 18, 9, 0);
    for (const [x, y] of [[1, 2], [1, 15], [22, 12], [11, 1], [2, 9], [22, 0]]) addObject(L, 'tree', x, y, 0);
    return L;
  }

  /* ───────────── rendering ───────────── */
  const plantImg = {};
  function plantSprite(sp, stage = 2) {
    const k = sp + stage;
    if (plantImg[k]) return plantImg[k];
    const vb = PlantArt.viewBoxFor(sp, stage).split(' ').map(Number);
    const sc = 1.4, w = Math.round(vb[2] * sc), h = Math.round(vb[3] * sc);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(' ')}" width="${w}" height="${h}">${PlantArt.plantGroup(sp, stage, SPECIES_BY_ID[sp] && ['trailing', 'hoya', 'pearls', 'hearts'].includes(SPECIES_BY_ID[sp].form) ? 'ceramic' : 'terracotta', 7)}</svg>`;
    const img = Iso.svgImage('plant' + k, svg);
    return plantImg[k] = { img, ox: -vb[0] * sc, oy: -vb[1] * sc, sc };
  }
  function drawParts(ctx, o, opts = {}) {
    const { d, toW } = frame(o);
    const col = d.colors ? d.colors[o.color % d.colors.length] : null;
    const parts = d.parts(col);
    const items = parts.map(p => {
      if (p.t === 'b') {
        const [u0, v0, z0, u1, v1, z1] = p.b, a = toW(u0, v0), b = toW(u1, v1);
        const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
        return { k: x1 + y1 + z0 * .001, f: () => Iso.box(ctx, x0, y0, z0, x1, y1, z1, p.c, p.o) };
      }
      const [x, y] = toW(p.u, p.v);
      if (p.t === 'c') return { k: x + y + p.r + p.z0 * .001, f: () => Iso.cyl(ctx, x, y, p.z0, p.z1, p.r, p.c) };
      if (p.t === 'd') return { k: x + y + 1 + p.z * .001, f: () => Iso.disc(ctx, x, y, p.z, p.r, p.c) };
      if (p.t === 'tree') return { k: x + y + 2, f: () => tree(ctx, x, y, p.z, o.uid) };
      if (p.t === 'p') return { k: x + y + 1.5, f: () => { const s = plantSprite(p.species), [sx, sy] = Iso.P(x, y); if (s.img.complete && s.img.naturalWidth) ctx.drawImage(s.img, sx - s.ox * p.s, sy - s.oy * p.s, s.img.naturalWidth * p.s, s.img.naturalHeight * p.s); } };
      return { k: 0, f: () => { } };
    });
    items.sort((a, b) => a.k - b.k).forEach(i => i.f());
  }
  function tree(ctx, x, y, z, seed) {
    const R = U.rng(seed * 31), [sx, sy] = Iso.P(x, y, z);
    ctx.fillStyle = 'rgba(0,0,0,.16)'; const [gx, gy] = Iso.P(x, y); ctx.beginPath(); ctx.ellipse(gx, gy, 46, 20, 0, 0, 7); ctx.fill();
    for (let i = 0; i < 9; i++) {
      const a = R() * 6.28, r = 12 + R() * 22, cx = sx + Math.cos(a) * r, cy = sy - 26 + Math.sin(a) * r * .7, rr = 18 + R() * 12;
      const g = ctx.createRadialGradient(cx - rr * .3, cy - rr * .4, 2, cx, cy, rr);
      g.addColorStop(0, '#9cc96a'); g.addColorStop(1, ['#3f7a2e', '#4a8a36', '#356a26'][i % 3]);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, 7); ctx.fill();
    }
  }
  function drawWall(ctx, kind, x, y, w, Hh, view) {
    const face = kind === 'h' ? (s, h) => Iso.P(x + s, y, h) : (s, h) => Iso.P(x, y + s, h);
    const R = U.rng((x * 131 + y * 17 + (kind === 'h' ? 7 : 3)) >>> 0);
    Catalog.drawWallFace(ctx, w.p, face, Hh, R);
    if (kind === 'v') Iso.poly(ctx, [face(0, 0), face(1, 0), face(1, Hh), face(0, Hh)], 'rgba(20,20,40,.13)');
    const t = .07, cap = kind === 'h' ? [Iso.P(x, y - t, Hh), Iso.P(x + 1, y - t, Hh), Iso.P(x + 1, y, Hh), Iso.P(x, y, Hh)] : [Iso.P(x - t, y, Hh), Iso.P(x, y, Hh), Iso.P(x, y + 1, Hh), Iso.P(x - t, y + 1, Hh)];
    Iso.poly(ctx, cap, Hh < Iso.WALL_H ? '#5a5048' : '#f3eee4', 'rgba(0,0,0,.2)', .6);
    if (w.att === 'door' || w.att === 'arch') {
      const top = Math.min(Hh, 68), open = view.isDoorOpen && view.isDoorOpen(kind, x, y);
      const q = [face(.22, 2), face(.78, 2), face(.78, top), face(.22, top)];
      Iso.poly(ctx, q, w.att === 'arch' || open ? '#3a3028' : '#8a5a32', '#f4f1ea', 3);
      if (w.att === 'door' && !open) {
        if (top > 44) Iso.poly(ctx, [face(.3, 38), face(.7, 38), face(.7, Math.min(top - 6, 62)), face(.3, Math.min(top - 6, 62))], null, 'rgba(0,0,0,.25)', 1.2);
        if (top > 34) { const [kx, ky] = face(.7, 32); ctx.fillStyle = '#c9a54a'; ctx.beginPath(); ctx.arc(kx, ky, 2, 0, 7); ctx.fill(); }
      }
    } else if (w.att === 'window' && Hh > 34) {
      const top = Math.min(Hh - 6, 80), night = view.night || 0;
      const q = [face(.18, 34), face(.82, 34), face(.82, top), face(.18, top)];
      Iso.poly(ctx, q, night > .4 ? `rgba(255,214,140,${.5 + night * .3})` : '#bfe0ea', '#f4f1ea', 3);
      if (night < .4) Iso.poly(ctx, [face(.25, 40), face(.4, 40), face(.6, top - 4), face(.45, top - 4)], 'rgba(255,255,255,.4)');
      const m1 = face(.5, 34), m2 = face(.5, top), n1 = face(.18, (34 + top) / 2), n2 = face(.82, (34 + top) / 2);
      ctx.strokeStyle = '#f4f1ea'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(...m1); ctx.lineTo(...m2); ctx.moveTo(...n1); ctx.lineTo(...n2); ctx.stroke();
      Iso.poly(ctx, [face(.14, 31), face(.86, 31), face(.86, 35), face(.14, 35)], '#e8e2d6');
    }
  }
  /* Draws everything except floors (pre-rendered) and Sims (passed in as drawables). */
  function drawScene(ctx, L, rooms, view, extra) {
    const list = [];
    const wallH = (kind, x, y) => {
      if (view.walls === 'up') return Iso.WALL_H;
      if (view.walls === 'down') return Iso.CUT_H;
      const bx = kind === 'h' ? x : x - 1, by = kind === 'h' ? y - 1 : y;
      const behindIndoor = inLot(bx, by) && !rooms.rooms[rooms.room[by][bx]].outdoor;
      return behindIndoor ? Iso.CUT_H : Iso.WALL_H;
    };
    for (let y = 0; y <= H; y++) for (let x = 0; x < W; x++) { const w = L.hw[y][x]; if (w) list.push({ k: x + y + .5, o: 0, f: () => drawWall(ctx, 'h', x, y, w, wallH('h', x, y), view) }); }
    for (let y = 0; y < H; y++) for (let x = 0; x <= W; x++) { const w = L.vw[y][x]; if (w) list.push({ k: x + y + .5, o: 0, f: () => drawWall(ctx, 'v', x, y, w, wallH('v', x, y), view) }); }
    for (const o of L.objects) {
      const d = defOf(o); if (d.flat) continue;
      const cs = cells(o), cx = cs.reduce((a, c) => a + c[0], 0) / cs.length + .5, cy = cs.reduce((a, c) => a + c[1], 0) / cs.length + .5;
      list.push({ k: cx + cy, o: 1, f: () => { if (view.hidden === o) return; ctx.globalAlpha = view.fade === o ? .45 : 1; drawParts(ctx, o); if (view.objFx) view.objFx(o); ctx.globalAlpha = 1; } });
    }
    for (const e of extra) list.push(e);
    list.sort((a, b) => a.k - b.k || a.o - b.o).forEach(i => i.f());
  }
  function drawFlats(ctx, L, view) {
    for (const o of L.objects) if (defOf(o).flat && view.hidden !== o) drawParts(ctx, o);
    for (const p of L.puddles) { const [sx, sy] = Iso.P(p.x, p.y); ctx.fillStyle = 'rgba(180,210,90,.55)'; ctx.beginPath(); ctx.ellipse(sx, sy, 20, 9, 0, 0, 7); ctx.fill(); }
  }
  /* Floors change rarely, so they are cached on an offscreen canvas. */
  const FS = 2;
  function renderFloors(L) {
    const cv = document.createElement('canvas');
    cv.width = (W + H) * 32 * FS + 4; cv.height = (W + H) * 16 * FS + 4;
    const ctx = cv.getContext('2d'); ctx.scale(FS, FS); ctx.translate(H * 32 + 1, 1);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) Catalog.drawFloor(ctx, L.floors[y][x], x, y, U.rng(x * 977 + y * 131 + 5));
    return { cv, ox: -(H * 32 + 1), oy: -1, s: FS };
  }

  return { frameOf: frame, W, H, DIRS, wallBetween, create, starter, cells, spotsFor, defOf, objectAt, blockedGrid, findPath, edgeOpen, computeRooms, setWallLine, canPlace, addObject, lotValue, drawScene, drawFlats, drawParts, renderFloors, inLot, setUid: n => { uid = Math.max(uid, n); } };
})();
