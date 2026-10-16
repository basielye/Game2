/* The Keeper's Cottage: life-simulation mode. Live / Buy / Build, Create-a-Sim, HUD and saving. */
const Cottage = (() => {
  const $ = s => document.querySelector(s);
  const KEY = 'leafscapes_beta_cottage_v1';
  const SPEEDS = [0, 1, 3, 10];
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const { NEEDS, SKILLS, TRAITS, TRAIT_BY, ASPIRATIONS, CAREERS, MOODLETS, SOCIAL } = Simfolk;
  const first = s => s.name.split(' ')[0];
  let g = null, cv, ctx, dpr = 1, running = false, last = 0, hostApi = {};
  const ui = { mode: 'live', tool: null, item: null, color: 0, rot: 0, ghost: null, sel: null, drag: null, floorPick: 'oak', paperPick: 'plaster', roomFill: true, hover: null, tab: 'needs', panelOpen: innerWidth > 700, buildCat: 'walls' };

  /* ───────────── state ───────────── */
  function newGame() {
    const L = World.starter();
    const a = Simfolk.create({ name: 'Rowan Thorne', age: 'adult', body: 'average', skin: Simfolk.SKIN[1], hair: 'short', hairColor: '#5a3a22', top: 'sweater', topColor: '#3f6a4a', bottomColor: '#2e3a52', traits: ['greenthumb', 'cheerful', 'bookworm'], aspiration: 'botanist', x: 6.5, y: 10.5 });
    const b = Simfolk.create({ name: 'Juniper Thorne', age: 'adult', body: 'slim', skin: Simfolk.SKIN[3], hair: 'long', hairColor: '#2b1d14', top: 'dress', topColor: '#c9909a', bottomColor: '#2e2e30', traits: ['creative', 'foodie', 'social'], aspiration: 'renaissance', x: 10.5, y: 10.5 });
    a.rel[b.id] = 45; b.rel[a.id] = 45;
    return { L, T: 8 * 60, sims: [a, b], funds: 18000, speed: 1, sel: a.id, cas: false, billsDay: 0, walls: 'cut', notes: [] };
  }
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!d || !d.L) return null;
      d.sims.forEach(s => { s.cur = null; s.listen = null; s.queue = []; if (s.anim === 'sleep' || s.anim === 'faint') s.anim = 'stand'; });
      d.L.puddles = d.L.puddles || [];
      World.setUid(Math.max(0, ...d.L.objects.map(o => o.uid)) + 1);
      return d;
    } catch (e) { return null; }
  }
  function save() {
    if (!g) return;
    try {
      const data = { L: g.L, T: g.T, funds: g.funds, speed: g.speed, sel: g.sel, cas: g.cas, billsDay: g.billsDay, walls: g.walls, notes: [],
        sims: g.sims.map(s => Object.assign({}, s, { cur: null, listen: null, queue: [] })) };
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) { }
  }
  function boot() {
    const d = load() || newGame();
    g = Object.assign(d, {
      reserved: {}, freeWill: true, rooms: null, grid: null, floor: null, notes: [],
      cam: { x: 0, y: 0, z: 1 },
      simById: id => g.sims.find(s => s.id === id),
      notify, sfx, addFunds,
      day: () => Math.floor(g.T / 1440), hour: () => (g.T % 1440) / 60, weekday: () => Math.floor(g.T / 1440) % 7,
      roomScoreAt: (x, y) => { const tx = Math.floor(x), ty = Math.floor(y); if (!World.inLot(tx, ty)) return 50; const r = g.rooms.rooms[g.rooms.room[ty][tx]]; let v = r.score; if (g.L.puddles.some(p => Math.floor(p.x) === tx || Math.floor(p.y) === ty)) v -= 10; if (!r.outdoor && night() > .5 && !roomLit(r)) v -= 15; return v; },
      dirtyRooms: () => rebuild(false),
      instant
    });
    rebuild(true);
    const c = Iso.P(9.5, 9.5);
    g.cam.x = c[0]; g.cam.y = c[1] - 20; g.cam.z = innerWidth < 700 ? .85 : 1.35;
  }
  function rebuild(floors) {
    g.rooms = World.computeRooms(g.L);
    g.grid = World.blockedGrid(g.L);
    if (floors || !g.floor) g.floor = World.renderFloors(g.L);
  }
  const night = () => { const h = g.hour(); return h >= 19.5 ? Math.min(1, (h - 19.5) / 2) : h < 5.5 ? 1 : h < 7.5 ? 1 - (h - 5.5) / 2 : 0; };
  function roomLit(r) {
    for (const o of g.L.objects) { const d = World.defOf(o); if (!d.light) continue; const c = World.cells(o)[0]; if (g.rooms.room[c[1]] && g.rooms.room[c[1]][c[0]] === r.id) return true; }
    return false;
  }
  function addFunds(n) { g.funds += n; renderHud(); if (n > 0) pulse('#ctFunds'); }
  function sfx(k) { try { ({ bad: () => Sfx.bad(), skill: () => Sfx.sparkle(), win: () => Sfx.win(), honk: () => Sfx.tap(), buy: () => Sfx.coin(), build: () => Sfx.pot() })[k](); } catch (e) { } }

  /* ───────────── notifications ───────────── */
  function notify(text, sim, icon = '🔔') {
    const box = $('#ctNotes'); if (!box) return;
    const el = document.createElement('div'); el.className = 'ct-note';
    el.innerHTML = `${sim ? `<canvas width="72" height="72"></canvas>` : ''}<span class="ct-note-ico">${icon}</span><p>${text}</p>`;
    box.prepend(el);
    if (sim) portrait(el.querySelector('canvas'), sim);
    el.onclick = () => el.remove();
    while (box.children.length > 4) box.lastChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 500); }, 9000);
  }
  function pulse(sel) { const e = $(sel); if (!e) return; e.classList.remove('pulse'); void e.offsetWidth; e.classList.add('pulse'); }

  /* ───────────── view transforms ───────────── */
  const cw = () => cv.clientWidth, ch = () => cv.clientHeight;
  const toScreen = (px, py) => [cw() / 2 + (px - g.cam.x) * g.cam.z, ch() / 2 + (py - g.cam.y) * g.cam.z];
  const toIso = (sx, sy) => [(sx - cw() / 2) / g.cam.z + g.cam.x, (sy - ch() / 2) / g.cam.z + g.cam.y];
  const toWorld = (sx, sy) => { const [px, py] = toIso(sx, sy); return Iso.unP(px, py); };
  function resize() {
    if (!cv) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(cv.clientWidth * dpr); cv.height = Math.round(cv.clientHeight * dpr);
  }

  /* ───────────── main loop ───────────── */
  let saveTimer = 0, slowTimer = 0, fxDt = 0;
  function loop(now) {
    if (!running) return;
    const dt = Math.min(.1, (now - last) / 1000); last = now;
    const sp = ui.mode === 'live' && !g.casOpen ? SPEEDS[g.speed] : 0;
    if (sp) step(dt * sp);
    else g.sims.forEach(s => { if (s.anim === 'walk') s.anim = 'stand'; });
    fxDt = sp ? dt : 0; Choreo.update(dt);
    draw(now / 1000);
    slowTimer += dt; saveTimer += dt;
    if (slowTimer > .25) { slowTimer = 0; renderHud(); renderPanel(); renderQueue(); }
    if (saveTimer > 8) { saveTimer = 0; save(); }
    requestAnimationFrame(loop);
  }
  function step(minutes) {
    // sub-step for stable simulation at high speed
    const n = Math.ceil(minutes / .5);
    for (let i = 0; i < n; i++) {
      const dt = minutes / n, before = g.T;
      g.T += dt;
      for (const s of g.sims) Brain.tick(g, s, dt);
      if (Math.floor(before / 30) !== Math.floor(g.T / 30)) halfHourly();
    }
  }
  function halfHourly() {
    Brain.checkAspirations(g);
    const before = g.L.puddles.length;
    g.L.puddles = g.L.puddles.filter(p => p.until > g.T);
    if (before !== g.L.puddles.length) rebuild(false);
    if (g.hour() >= 10 && g.day() > 0 && g.day() % 3 === 0 && g.billsDay !== g.day()) {
      g.billsDay = g.day();
      const bill = Math.round(80 + World.lotValue(g.L) * .02);
      g.funds -= bill; notify(`Bills of §${bill.toLocaleString()} were paid automatically.`, null, '🧾');
    }
  }

  /* ───────────── rendering ───────────── */
  function draw(t) {
    const W = cv.width, H = cv.height, nt = night();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, U.mix('#a9d8b0', '#1a2a3a', nt)); sky.addColorStop(1, U.mix('#5f8f3f', '#162416', nt));
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    ctx.setTransform(dpr * g.cam.z, 0, 0, dpr * g.cam.z, dpr * (cw() / 2 - g.cam.x * g.cam.z), dpr * (ch() / 2 - g.cam.y * g.cam.z));
    // lot ground beyond the cached floor
    Iso.poly(ctx, [Iso.P(-4, -4), Iso.P(World.W + 4, -4), Iso.P(World.W + 4, World.H + 4), Iso.P(-4, World.H + 4)], '#6f9a45');
    const f = g.floor; ctx.drawImage(f.cv, f.ox, f.oy, f.cv.width / f.s, f.cv.height / f.s);
    World.drawFlats(ctx, g.L, { hidden: ui.moving });
    if (ui.mode !== 'live') drawGrid();
    if (ui.mode !== 'build' && !ui.ghost && ui.hover && ui.hover.obj && !World.defOf(ui.hover.obj).fixed || (ui.sel && ui.mode === 'buy')) highlightObj(ui.sel && ui.mode === 'buy' ? ui.sel : ui.hover.obj);
    const sel = g.simById(g.sel);
    // who is using which object right now, and what they are doing with it
    const using = {};
    for (const s of g.sims) { s._beat = s.atWork ? null : Choreo.beat(s, t); if (!s.atWork && s.cur && s.cur.kind === 'obj' && s.cur.state === 'do') using[s.cur.o] = { sim: s, beat: s._beat }; }
    const objFx = o => { const fr = World.frameOf(o); Choreo.objectFx(ctx, o, using[o.uid], t, (u, v, z) => Iso.P(...fr.toW(u, v), z)); };
    const extras = g.sims.filter(s => !s.atWork).map(s => {
      let k = s.x + s.y, z = 0;
      if (s.cur && s.cur.kind === 'obj' && (s.cur.state === 'do' || s.anim === 'walk') && s.cur.spot && s.cur.spot.approach) {
        const o = g.L.objects.find(o => o.uid === s.cur.o);
        if (o && s.cur.state === 'do') { const cs = World.cells(o); k = cs.reduce((a, c) => a + c[0] + c[1] + 1, 0) / cs.length + .05; }
        if (s.anim === 'sleep') z = 24; else if (s.anim === 'bath') z = 4; else if (s.anim === 'sit') z = 10; else if (s.anim === 'run') z = 10;
      }
      return { k, o: 2, f: () => drawSimAt(s, t, z, s === sel) };
    });
    World.drawScene(ctx, g.L, g.rooms, { walls: g.walls, night: nt, hidden: ui.moving, objFx, isDoorOpen: (kind, x, y) => g.sims.some(s => !s.atWork && Math.hypot(s.x - (kind === 'h' ? x + .5 : x), s.y - (kind === 'h' ? y : y + .5)) < .9) }, extras);
    Choreo.draw(ctx);
    if (ui.ghost) drawGhost();
    if (ui.drag && ui.drag.tool) drawToolPreview();
    // night lighting
    if (nt > 0) {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = `rgba(14,22,58,${.52 * nt})`; ctx.fillRect(0, 0, W, H); ctx.restore();
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const o of g.L.objects) {
        const d = World.defOf(o); if (!d.light) continue;
        const c = World.cells(o)[0], [sx, sy] = Iso.P(c[0] + .5, c[1] + .5, 40), r = 50 * d.light;
        const gr = ctx.createRadialGradient(sx, sy, 4, sx, sy, r); gr.addColorStop(0, `rgba(255,200,120,${.42 * nt})`); gr.addColorStop(1, 'rgba(255,200,120,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.fill();
      }
      ctx.restore();
    }
    // overhead UI: plumbob, thought & speech bubbles
    for (const s of g.sims) {
      if (s.atWork) continue;
      const [sx, sy] = Iso.P(s.x, s.y, s.anim === 'sleep' ? 24 : 0), head = s.anim === 'sleep' ? sy - 34 : s.anim === 'bath' ? sy - 46 : sy - 84;
      if (s === sel) Simfolk.plumbob(ctx, sx, head - 14, 1, t, Simfolk.moodColor(Simfolk.mood(s)));
      if (s.anim === 'talk') { const soc = s.cur && s.cur.def && s.cur.def.icon ? s.cur.def.icon : s.listen ? s.listen.soc.icon : '💬'; Simfolk.bubble(ctx, sx + 16, head + 4, .9, ['🌿', '☀️', '❤️', '❓', soc][Math.floor(t * .8 + s.x) % 5], 'speech'); }
      else if (s.anim !== 'sleep') {
        const low = NEEDS.filter(n => n.k !== 'room').map(n => [n, s.needs[n.k]]).sort((a, b) => a[1] - b[1])[0];
        if (low[1] < 22) Simfolk.bubble(ctx, sx + 16, head + 2, .9, low[0].icon);
      }
    }
  }
  function drawSimAt(s, t, z, isSel) {
    const [sx, sy] = Iso.P(s.x, s.y, z);
    const fx = s.face[0], fy = s.face[1], front = fx + fy >= -.01, b = s._beat;
    let flip = (fx - fy) < 0;
    if (b && b.lookFlip) flip = !flip;
    const PZ = b && b.pose ? Choreo.POSES[b.pose] : null;
    const anim = !PZ ? s.anim : PZ.base === 'kneel' ? 'garden' : PZ.base === 'sit' ? 'sit' : ['sit', 'type', 'shower', 'dance', 'walk', 'run', 'sleep', 'bath', 'faint'].includes(s.anim) ? s.anim : 'stand';
    if (isSel && ui.mode === 'live') { ctx.strokeStyle = 'rgba(120,255,140,.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(sx, sy - (z ? 0 : 0), 15, 7, 0, 0, 7); ctx.stroke(); }
    Simfolk.drawSim(ctx, s, sx, sy, 1, t, { anim, pose: PZ ? b.pose : null, p: b && b.p, front: s.anim === 'sleep' ? true : front, flip, mood: Simfolk.mood(s) });
    if (b && fxDt) Choreo.emit(s, b, sx, sy, flip ? -1 : 1, fxDt, t);
    else if (fxDt && (s.anim === 'run' || s.anim === 'bath')) Choreo.emit(s, {}, sx, sy, flip ? -1 : 1, fxDt, t);
  }
  function drawGrid() {
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = 0; x <= World.W; x++) { const a = Iso.P(x, 0), b = Iso.P(x, World.H); ctx.moveTo(...a); ctx.lineTo(...b); }
    for (let y = 0; y <= World.H; y++) { const a = Iso.P(0, y), b = Iso.P(World.W, y); ctx.moveTo(...a); ctx.lineTo(...b); }
    ctx.stroke();
  }
  function highlightObj(o) {
    for (const [x, y] of World.cells(o)) Iso.poly(ctx, [Iso.P(x, y), Iso.P(x + 1, y), Iso.P(x + 1, y + 1), Iso.P(x, y + 1)], 'rgba(255,255,200,.22)', 'rgba(255,255,220,.7)', 1.5);
  }
  function drawGhost() {
    const gh = ui.ghost, ok = World.canPlace(g.L, gh, ui.moving);
    for (const [x, y] of World.cells(gh)) Iso.poly(ctx, [Iso.P(x, y), Iso.P(x + 1, y), Iso.P(x + 1, y + 1), Iso.P(x, y + 1)], ok ? 'rgba(120,255,140,.28)' : 'rgba(255,90,80,.35)', ok ? '#7cff8c' : '#ff6a5a', 1.5);
    ctx.globalAlpha = .82; World.drawParts(ctx, gh); ctx.globalAlpha = 1;
    const d = World.defOf(gh), sp = d.actions[0] ? World.spotsFor(gh, d.actions[0])[0] : null;
    if (sp) { const [x, y] = sp.approach || sp.tile; Iso.poly(ctx, [Iso.P(x + .3, y + .3), Iso.P(x + .7, y + .3), Iso.P(x + .7, y + .7), Iso.P(x + .3, y + .7)], 'rgba(255,255,255,.35)'); }
  }
  function drawToolPreview() {
    const d = ui.drag;
    if (d.tool === 'wall' || d.tool === 'erase') {
      const [a, b] = wallLine(d.start, d.end);
      ctx.strokeStyle = d.tool === 'erase' ? '#ff6a5a' : '#fff6c0'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(...Iso.P(a[0], a[1], 2)); ctx.lineTo(...Iso.P(b[0], b[1], 2)); ctx.stroke();
      const n = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]);
      label(Iso.P((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 20), d.tool === 'erase' ? `Remove ${n}` : `§${n * 14}`);
    } else if (d.tool === 'room' || d.tool === 'floor') {
      const [x0, y0, x1, y1] = rect(d.start, d.end, d.tool === 'floor');
      Iso.poly(ctx, [Iso.P(x0, y0), Iso.P(x1, y0), Iso.P(x1, y1), Iso.P(x0, y1)], d.tool === 'floor' ? 'rgba(255,240,180,.3)' : 'rgba(255,255,255,.12)', '#fff6c0', 2);
      const cost = d.tool === 'floor' ? (x1 - x0) * (y1 - y0) * Catalog.FLOORS[ui.floorPick].price : 2 * ((x1 - x0) + (y1 - y0)) * 14;
      label(Iso.P((x0 + x1) / 2, (y0 + y1) / 2, 10), `§${cost}`);
    }
  }
  function label([x, y], text) {
    ctx.font = 'bold 13px Nunito, sans-serif'; ctx.textAlign = 'center';
    const w = ctx.measureText(text).width + 14;
    ctx.fillStyle = 'rgba(20,35,20,.85)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - w / 2, y - 24, w, 20, 10) : ctx.rect(x - w / 2, y - 24, w, 20); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(text, x, y - 10);
  }
  function portrait(c, s) {
    const x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height);
    const g2 = x.createRadialGradient(c.width / 2, c.height * .45, 4, c.width / 2, c.height / 2, c.width * .7);
    g2.addColorStop(0, '#f6efdc'); g2.addColorStop(1, '#d9ccaa'); x.fillStyle = g2; x.fillRect(0, 0, c.width, c.height);
    const sc = c.width / 30; Simfolk.drawSim(x, s, c.width / 2, c.height * .5 + 62 * sc, sc, 1.2, { anim: 'stand', front: true, mood: Simfolk.mood(s) });
  }

  /* ───────────── input ───────────── */
  const pointers = new Map();
  function bind() {
    cv.addEventListener('pointerdown', e => {
      Sfx.init(); cv.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, [e.offsetX, e.offsetY]);
      closePie();
      if (pointers.size === 2) { const [a, b] = [...pointers.values()]; ui.pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: g.cam.z, mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], cam: { ...g.cam } }; ui.drag = null; return; }
      const w = toWorld(e.offsetX, e.offsetY);
      ui.drag = { sx: e.offsetX, sy: e.offsetY, cam: { ...g.cam }, moved: false, tool: null, start: w, end: w };
      if (ui.mode === 'build' && ['wall', 'erase', 'room', 'floor'].includes(ui.tool)) ui.drag.tool = ui.tool;
    });
    cv.addEventListener('pointermove', e => {
      const prev = pointers.get(e.pointerId); if (prev) pointers.set(e.pointerId, [e.offsetX, e.offsetY]);
      if (ui.pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        g.cam.z = U.clamp(ui.pinch.z * d / ui.pinch.d, .45, 2.4);
        const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        g.cam.x = ui.pinch.cam.x - (mid[0] - ui.pinch.mid[0]) / g.cam.z; g.cam.y = ui.pinch.cam.y - (mid[1] - ui.pinch.mid[1]) / g.cam.z;
        return;
      }
      const w = toWorld(e.offsetX, e.offsetY);
      if (ui.drag) {
        const dx = e.offsetX - ui.drag.sx, dy = e.offsetY - ui.drag.sy;
        if (Math.hypot(dx, dy) > 7) ui.drag.moved = true;
        if (ui.drag.tool) { ui.drag.end = w; return; }
        if (ui.drag.moved) { g.cam.x = ui.drag.cam.x - dx / g.cam.z; g.cam.y = ui.drag.cam.y - dy / g.cam.z; return; }
      }
      ui.lastHover = [e.offsetX, e.offsetY];
      hover(w, e.pointerType);
    });
    const up = e => {
      pointers.delete(e.pointerId);
      if (ui.pinch) { if (pointers.size < 2) ui.pinch = null; return; }
      const d = ui.drag; ui.drag = null; if (!d) return;
      const w = toWorld(e.offsetX, e.offsetY);
      if (d.tool) { d.end = w; applyTool(d); return; }
      if (d.moved) return;
      click(w, e.offsetX, e.offsetY, e.pointerType);
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); ui.drag = null; ui.pinch = null; });
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      const before = toIso(e.offsetX, e.offsetY);
      g.cam.z = U.clamp(g.cam.z * (e.deltaY < 0 ? 1.12 : 1 / 1.12), .45, 2.4);
      const after = toIso(e.offsetX, e.offsetY);
      g.cam.x += before[0] - after[0]; g.cam.y += before[1] - after[1];
    }, { passive: false });
    cv.addEventListener('contextmenu', e => { e.preventDefault(); if (ui.ghost) rotateGhost(); });
    window.addEventListener('keydown', e => {
      if (!$('#cottage').classList.contains('active') || e.target.tagName === 'INPUT') return;
      if (e.key === 'r' || e.key === 'R') rotateGhost();
      if (e.key === 'Escape') { cancelPlacement(); closePie(); }
      if (e.key === ' ') { e.preventDefault(); setSpeed(g.speed ? 0 : 1); }
      if (['1', '2', '3'].includes(e.key)) setSpeed(+e.key);
      if (e.key === 'Delete' && ui.sel) sell(ui.sel);
    });
  }
  function hover(w, type) {
    const tx = Math.floor(w[0]), ty = Math.floor(w[1]);
    if (ui.ghost) {
      const d = World.defOf(ui.ghost);
      ui.ghost.x = tx - (ui.ghost.r % 2 ? Math.floor((d.d - 1) / 2) : Math.floor((d.w - 1) / 2)); ui.ghost.y = ty - (ui.ghost.r % 2 ? Math.floor((d.w - 1) / 2) : Math.floor((d.d - 1) / 2));
      return;
    }
    if (ui.mode !== 'build' && type === 'mouse' && ui.lastHover) { const [sx, sy] = ui.lastHover; ui.hover = { obj: objectAtScreen(sx, sy) }; }
    cv.style.cursor = ui.mode === 'build' && ui.tool ? 'crosshair' : 'default';
  }
  function simAtScreen(sx, sy) {
    let best = null, bd = 1e9;
    for (const s of g.sims) {
      if (s.atWork) continue;
      const [px, py] = toScreen(...Iso.P(s.x, s.y));
      const dx = sx - px, dy = sy - (py - 34 * g.cam.z);
      if (Math.abs(dx) < 16 * g.cam.z && Math.abs(dy) < 40 * g.cam.z && Math.hypot(dx, dy) < bd) { bd = Math.hypot(dx, dy); best = s; }
    }
    return best;
  }
  /* Screen-space picking against each object's projected 3D hull, front-most wins. */
  const hCache = {};
  function heightOf(o) {
    const d = World.defOf(o); if (hCache[o.id] != null) return hCache[o.id];
    let h = 4;
    for (const p of d.parts(d.colors ? d.colors[0] : null)) h = Math.max(h, p.t === 'b' ? p.b[5] : p.t === 'c' ? p.z1 : p.t === 'p' ? 560 * p.s : p.t === 'tree' ? 150 : p.z || 0);
    return hCache[o.id] = h;
  }
  function hull(pts) {
    pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
    for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (const p of pts.reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  function inPoly(x, y, poly) {
    let ins = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) ins = !ins;
    }
    return ins;
  }
  function objectAtScreen(sx, sy) {
    const [px, py] = toIso(sx, sy); let best = null, bk = -1e9;
    for (const o of g.L.objects) {
      const cs = World.cells(o), x0 = Math.min(...cs.map(c => c[0])), y0 = Math.min(...cs.map(c => c[1])), x1 = Math.max(...cs.map(c => c[0])) + 1, y1 = Math.max(...cs.map(c => c[1])) + 1;
      const h = heightOf(o), d = World.defOf(o);
      const pts = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].flatMap(([x, y]) => [Iso.P(x, y, 0), Iso.P(x, y, h)]);
      if (!inPoly(px, py, hull(pts))) continue;
      const k = x1 + y1 - (d.flat ? 100 : 0) - (d.id === 'tree' ? 50 : 0);
      if (k > bk) { bk = k; best = o; }
    }
    return best;
  }
  function click(w, sx, sy) {
    const tx = Math.floor(w[0]), ty = Math.floor(w[1]);
    if (ui.mode === 'live') {
      const s = simAtScreen(sx, sy), me = g.simById(g.sel);
      if (s) return s === me ? openPie(sx, sy, me.name, [{ label: 'Cancel All Actions', icon: '✋', fn: () => { Brain.cancel(g, me); me.queue = []; } }]) : simPie(sx, sy, s);
      const o = objectAtScreen(sx, sy);
      if (o) return objPie(sx, sy, o);
      if (!World.inLot(tx, ty)) return;
      openPie(sx, sy, null, [{ label: 'Go Here', icon: '👣', fn: () => Brain.order(g, me, { kind: 'goto', tile: [tx, ty] }) }]);
    } else if (ui.mode === 'buy') {
      if (ui.ghost) return place();
      const o = objectAtScreen(sx, sy);
      selectObj(o && !World.defOf(o).fixed ? o : null);
      if (o && World.defOf(o).fixed) toast(`${World.defOf(o).name} can't be moved.`);
    } else if (ui.mode === 'build') {
      if (['door', 'window', 'arch'].includes(ui.tool)) attach(w);
      else if (ui.tool === 'paper') paper(w);
      else if (ui.tool === 'floor' || ui.tool === 'room' || ui.tool === 'wall' || ui.tool === 'erase') applyTool({ tool: ui.tool, start: w, end: w });
    }
  }

  /* ───────────── pie menus ───────────── */
  function openPie(sx, sy, title, items) {
    const pie = $('#ctPie'); pie.innerHTML = ''; pie.className = 'open';
    const r = Math.max(64, Math.min(110, 38 + items.length * 12));
    const host = cv.getBoundingClientRect();
    const cx = U.clamp(sx, r + 70, host.width - r - 70), cy = U.clamp(sy, r + 40, host.height - r - 40);
    if (title) { const t = document.createElement('div'); t.className = 'pie-title'; t.textContent = title; t.style.left = cx + 'px'; t.style.top = cy + 'px'; pie.appendChild(t); }
    items.forEach((it, i) => {
      const a = -Math.PI / 2 + i / items.length * Math.PI * 2, b = document.createElement('button');
      b.className = 'pie-item' + (it.disabled ? ' off' : ''); b.innerHTML = `<span>${it.icon || '•'}</span>${it.label}`;
      b.style.left = cx + Math.cos(a) * r + 'px'; b.style.top = cy + Math.sin(a) * r * .8 + 'px'; b.style.animationDelay = i * 25 + 'ms';
      b.onclick = ev => { ev.stopPropagation(); closePie(); if (!it.disabled) { Sfx.tap(); it.fn(); } else if (it.why) toast(it.why); };
      pie.appendChild(b);
    });
  }
  function closePie() { const p = $('#ctPie'); if (p) { p.className = ''; p.innerHTML = ''; } }
  function objPie(sx, sy, o) {
    const me = g.simById(g.sel), d = World.defOf(o);
    if (!d.actions.length) return toast(d.name);
    openPie(sx, sy, d.name, d.actions.map(a => ({ label: a.label, icon: actIcon(a), fn: () => Brain.order(g, me, { kind: 'obj', uid: o.uid, act: a.id }) })));
  }
  function simPie(sx, sy, s) {
    const me = g.simById(g.sel), rel = me.rel[s.id] || 0;
    const items = [{ label: `Select ${first(s)}`, icon: '👤', fn: () => select(s.id) }];
    for (const soc of SOCIAL) items.push({ label: soc.label, icon: soc.icon, disabled: soc.min != null && rel < soc.min, why: `${first(me)} and ${first(s)} need a stronger friendship first.`, fn: () => Brain.order(g, me, { kind: 'social', target: s.id, act: soc.id }) });
    openPie(sx, sy, s.name, items);
  }
  const actIcon = a => ({ sit: '🪑', nap: '😴', sleep: '🛏', snack: '🍎', juice: '🧃', cook: '🍳', quick: '🥞', wash: '🧼', pee: '🚽', shower: '🚿', bath: '🛁', watch: '📺', play: '🎮', browse: '🖱', blog: '✍️', job: '💼', read: '📖', study: '🌿', dance: '💃', paint: '🎨', chess: '♟', run: '🏃', speech: '🗣', fish: '🐠', tend: '🧑‍🌾', visit: '🧩', water: '💧', talk: '🗨' })[a.id] || '•';

  /* ───────────── buy mode ───────────── */
  function startPlacing(id) {
    const d = World.defOf({ id }); if (!d) return;
    cancelPlacement(); selectObj(null);
    ui.item = id; ui.ghost = { uid: -1, id, x: 8, y: 8, r: ui.rot, color: ui.color % (d.colors ? d.colors.length : 1) };
    renderCatalog();
  }
  function rotateGhost() { if (ui.ghost) { ui.ghost.r = (ui.ghost.r + 1) % 4; ui.rot = ui.ghost.r; Sfx.tap(); } else if (ui.sel) { const o = ui.sel, r0 = o.r; o.r = (o.r + 1) % 4; if (!World.canPlace(g.L, o, o)) { o.r = r0; toast('Not enough room to rotate here.'); } else { rebuild(false); Sfx.tap(); } } }
  function cancelPlacement() { if (ui.moving) { ui.moving = null; } ui.ghost = null; ui.item = null; renderCatalog(); }
  function place() {
    const gh = ui.ghost, d = World.defOf(gh);
    if (!World.canPlace(g.L, gh, ui.moving)) { toast('That spot is blocked.'); sfx('bad'); return; }
    if (ui.moving) {
      Object.assign(ui.moving, { x: gh.x, y: gh.y, r: gh.r }); ui.moving = null; ui.ghost = null; ui.item = null;
      g.reserved = {}; g.sims.forEach(s => Brain.cancel(g, s)); rebuild(false); sfx('build'); renderCatalog(); return;
    }
    if (g.funds < d.price) { toast(`Not enough Simoleons. You need §${(d.price - g.funds).toLocaleString()} more.`); sfx('bad'); return; }
    g.funds -= d.price; World.addObject(g.L, gh.id, gh.x, gh.y, gh.r, gh.color); rebuild(false); sfx('buy'); renderHud();
  }
  function selectObj(o) { ui.sel = o; renderCatalog(); }
  function sell(o) {
    const d = World.defOf(o); if (d.fixed) return;
    g.L.objects = g.L.objects.filter(x => x !== o); g.reserved = {}; g.sims.forEach(s => Brain.cancel(g, s));
    const refund = Math.round(d.price * .8); g.funds += refund; ui.sel = null; rebuild(false); sfx('buy');
    toast(`Sold for §${refund.toLocaleString()}.`); renderCatalog(); renderHud();
  }

  /* ───────────── build mode ───────────── */
  const snap = w => [Math.round(w[0]), Math.round(w[1])];
  function wallLine(a, b) {
    const s = snap(a), e = snap(b);
    if (Math.abs(e[0] - s[0]) >= Math.abs(e[1] - s[1])) e[1] = s[1]; else e[0] = s[0];
    const cl = p => [U.clamp(p[0], 0, World.W), U.clamp(p[1], 0, World.H)];
    return [cl(s), cl(e)];
  }
  function rect(a, b, tiles) {
    if (tiles) { const x0 = Math.floor(Math.min(a[0], b[0])), y0 = Math.floor(Math.min(a[1], b[1])), x1 = Math.floor(Math.max(a[0], b[0])) + 1, y1 = Math.floor(Math.max(a[1], b[1])) + 1; return [U.clamp(x0, 0, World.W), U.clamp(y0, 0, World.H), U.clamp(x1, 0, World.W), U.clamp(y1, 0, World.H)]; }
    const s = snap(a), e = snap(b);
    return [Math.min(s[0], e[0]), Math.min(s[1], e[1]), Math.max(s[0], e[0]), Math.max(s[1], e[1])].map((v, i) => U.clamp(v, 0, i % 2 ? World.H : World.W));
  }
  function splitsObject(kind, x, y) {
    const pair = kind === 'h' ? [[x, y - 1], [x, y]] : [[x - 1, y], [x, y]];
    return g.L.objects.some(o => { const cs = World.cells(o); return pair.every(([px, py]) => cs.some(c => c[0] === px && c[1] === py)); });
  }
  function applyTool(d) {
    let cost = 0, n = 0;
    const L = g.L;
    const wallSeg = (kind, x, y, on) => {
      const arr = kind === 'h' ? L.hw : L.vw;
      if (!arr[y] || x < 0 || x >= arr[y].length) return;
      if (on) { if (arr[y][x] || splitsObject(kind, x, y)) return; arr[y][x] = { p: ui.paperPick === 'clapboard' ? 'plaster' : ui.paperPick, att: null }; cost += 14; n++; }
      else if (arr[y][x]) { arr[y][x] = null; n++; }
    };
    if (d.tool === 'wall' || d.tool === 'erase') {
      const [a, b] = wallLine(d.start, d.end), on = d.tool === 'wall';
      if (a[1] === b[1]) for (let x = Math.min(a[0], b[0]); x < Math.max(a[0], b[0]); x++) wallSeg('h', x, a[1], on);
      else for (let y = Math.min(a[1], b[1]); y < Math.max(a[1], b[1]); y++) wallSeg('v', a[0], y, on);
      if (!on && a[0] === b[0] && a[1] === b[1]) { const w = d.start, fx = w[0] - Math.floor(w[0]), fy = w[1] - Math.floor(w[1]); const e = nearestEdge(w); if (e) wallSeg(e.kind, e.x, e.y, false); }
    } else if (d.tool === 'room') {
      const [x0, y0, x1, y1] = rect(d.start, d.end);
      if (x1 - x0 < 1 || y1 - y0 < 1) return;
      for (let x = x0; x < x1; x++) { wallSeg('h', x, y0, true); wallSeg('h', x, y1, true); }
      for (let y = y0; y < y1; y++) { wallSeg('v', x0, y, true); wallSeg('v', x1, y, true); }
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (L.floors[y][x] === 'grass') { L.floors[y][x] = ui.floorPick; cost += Catalog.FLOORS[ui.floorPick].price; }
    } else if (d.tool === 'floor') {
      const [x0, y0, x1, y1] = rect(d.start, d.end, true), F = Catalog.FLOORS[ui.floorPick];
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (L.floors[y][x] !== ui.floorPick && !['road', 'sidewalk'].includes(L.floors[y][x])) { L.floors[y][x] = ui.floorPick; cost += F.price; n++; }
    }
    if (cost > g.funds) { toast('Not enough Simoleons for that.'); sfx('bad'); return; }
    g.funds -= cost;
    if (n || cost) { sfx('build'); g.reserved = {}; g.sims.forEach(s => Brain.cancel(g, s)); rebuild(true); renderHud(); }
  }
  function nearestEdge(w) {
    const [fx, fy] = w, hy = Math.round(fy), hx = Math.floor(fx), vx = Math.round(fx), vy = Math.floor(fy);
    const dh = Math.abs(fy - hy), dv = Math.abs(fx - vx);
    if (dh < dv && dh < .35 && g.L.hw[hy] && hx >= 0 && hx < World.W) return { kind: 'h', x: hx, y: hy, w: g.L.hw[hy][hx] };
    if (dv < .35 && g.L.vw[vy] && vx >= 0 && vx <= World.W) return { kind: 'v', x: vx, y: vy, w: g.L.vw[vy][vx] };
    return null;
  }
  function attach(w) {
    const e = nearestEdge(w);
    if (!e || !e.w) { toast('Tap on a wall to add a ' + ui.tool + '.'); return; }
    const price = { door: 120, window: 90, arch: 60 }[ui.tool];
    if (e.w.att === ui.tool) { e.w.att = null; sfx('build'); rebuild(false); return; }
    if (g.funds < price) { toast('Not enough Simoleons.'); return; }
    g.funds -= price; e.w.att = ui.tool; sfx('build'); rebuild(false); renderHud();
  }
  function paper(w) {
    const e = nearestEdge(w);
    if (!e || !e.w) { toast('Tap on a wall to paint it.'); return; }
    const P = Catalog.WALLS[ui.paperPick];
    const targets = [e.w];
    if (ui.roomFill) {
      const ft = e.kind === 'h' ? [e.x, e.y] : [e.x, e.y];
      if (World.inLot(ft[0], ft[1])) {
        const rid = g.rooms.room[ft[1]][ft[0]];
        for (const [x, y] of g.rooms.rooms[rid].tiles) { const a = g.L.hw[y][x], b = g.L.vw[y][x]; if (a && !targets.includes(a)) targets.push(a); if (b && !targets.includes(b)) targets.push(b); }
      }
    }
    const cost = targets.length * P.price;
    if (cost > g.funds) { toast('Not enough Simoleons.'); return; }
    g.funds -= cost; targets.forEach(t => t.p = ui.paperPick); sfx('build'); renderHud();
  }

  /* ───────────── DOM UI ───────────── */
  function toast(t) { const el = $('#ctToast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => el.classList.remove('show'), 1800); }
  function fmtTime() {
    const h = Math.floor(g.hour()), m = Math.floor(g.T % 60), ap = h >= 12 ? 'PM' : 'AM', hh = h % 12 || 12;
    return `${hh}:${String(m).padStart(2, '0')} ${ap}`;
  }
  function renderHud() {
    if (!g) return;
    $('#ctTime').textContent = fmtTime(); $('#ctDay').textContent = `${DAYS[g.weekday()]} · Day ${g.day() + 1}`;
    $('#ctFunds').textContent = '§' + Math.round(g.funds).toLocaleString();
    document.querySelectorAll('#ctSpeed button').forEach(b => b.classList.toggle('on', +b.dataset.s === g.speed && ui.mode === 'live'));
    document.querySelectorAll('.ct-modes button').forEach(b => b.classList.toggle('on', b.dataset.mode === ui.mode));
    $('#ctWalls').textContent = { cut: 'Walls: Cutaway', up: 'Walls: Up', down: 'Walls: Down' }[g.walls];
    $('#ctSun').textContent = night() > .5 ? '🌙' : g.hour() < 9 ? '🌅' : g.hour() > 17 ? '🌇' : '☀️';
  }
  function setSpeed(i) { g.speed = i; if (ui.mode !== 'live') setMode('live'); renderHud(); }
  function setMode(m) {
    ui.mode = m; cancelPlacement(); selectObj(null); ui.tool = null; closePie();
    $('#cottage').dataset.mode = m;
    if (m === 'build' && g.walls === 'cut') { /* keep */ }
    renderHud(); renderCatalog();
  }
  function select(id) { g.sel = id; const s = g.simById(id); if (s && !s.atWork) { const [px, py] = Iso.P(s.x, s.y); g.cam.x = px; g.cam.y = py - 30; } renderPanel(true); }

  let lastPanelSig = '';
  function renderPanel(force) {
    const host = $('#ctSim'); if (!host || !g) return;
    const sel = g.simById(g.sel) || g.sims[0];
    const sig = ui.tab + sel.id + ui.panelOpen + g.sims.length + (force ? Math.random() : '');
    if (sig !== lastPanelSig) {
      lastPanelSig = sig;
      host.innerHTML = `<div class="ct-portraits">${g.sims.map(s => `<button class="ct-pt${s.id === sel.id ? ' on' : ''}" data-sim="${s.id}" title="${s.name}"><canvas width="96" height="96"></canvas><i></i></button>`).join('')}
        <button class="ct-pt add" id="ctCasBtn" title="Edit household">✎</button></div>
        <div class="ct-card${ui.panelOpen ? '' : ' closed'}"><header><div><b id="ctName"></b><small id="ctMood"></small></div><button class="ct-collapse" id="ctCollapse">${ui.panelOpen ? '▾' : '▴'}</button></header>
        <nav class="ct-tabs">${[['needs', 'Needs'], ['mood', 'Mood'], ['skills', 'Skills'], ['rel', 'Friends'], ['job', 'Career'], ['about', 'Traits']].map(([k, n]) => `<button data-tab="${k}" class="${ui.tab === k ? 'on' : ''}">${n}</button>`).join('')}</nav>
        <div class="ct-tab" id="ctTab"></div></div>`;
      host.querySelectorAll('[data-sim]').forEach(b => b.onclick = () => { Sfx.tap(); select(b.dataset.sim); });
      host.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { ui.tab = b.dataset.tab; ui.panelOpen = true; Sfx.tap(); renderPanel(true); });
      $('#ctCollapse').onclick = () => { ui.panelOpen = !ui.panelOpen; renderPanel(true); };
      $('#ctCasBtn').onclick = () => openCAS();
    }
    host.querySelectorAll('[data-sim]').forEach((b, i) => {
      const s = g.sims[i]; portrait(b.querySelector('canvas'), s);
      b.querySelector('i').style.background = Simfolk.moodColor(Simfolk.mood(s));
      b.classList.toggle('away', !!s.atWork);
    });
    const m = Simfolk.mood(sel);
    $('#ctName').textContent = sel.name; $('#ctMood').innerHTML = `<span style="color:${Simfolk.moodColor(m)}">◆</span> ${Simfolk.moodLabel(m)}${sel.atWork ? ' · at work' : sel.cur ? ' · ' + (sel.cur.label || '') : ''}`;
    const tab = $('#ctTab'); if (!ui.panelOpen) return;
    let h = '';
    if (ui.tab === 'needs') h = `<div class="ct-needs">${NEEDS.map(n => { const v = sel.needs[n.k]; return `<div class="need"><span>${n.icon} ${n.label}</span><div class="bar"><i style="width:${v}%;background:${needColor(v)}"></i></div></div>`; }).join('')}</div>`;
    else if (ui.tab === 'mood') h = `<div class="ct-moodbig" style="--mc:${Simfolk.moodColor(m)}"><b>${Simfolk.moodLabel(m)}</b><div class="bar"><i style="width:${m}%;background:${Simfolk.moodColor(m)}"></i></div></div>` + (sel.moodlets.length ? sel.moodlets.map(x => { const M = MOODLETS[x.id]; const left = Math.max(0, Math.round((x.until - g.T) / 60 * 10) / 10); return `<div class="moodlet ${M.val > 0 ? 'pos' : 'neg'}"><span>${M.icon}</span><b>${M.label}</b><em>${M.val > 0 ? '+' : ''}${M.val}</em><small>${left}h</small></div>`; }).join('') : '<p class="ct-empty">No moodlets right now.</p>');
    else if (ui.tab === 'skills') h = SKILLS.map(k => { const p = sel.skills[k.k], l = Simfolk.level(p), lo = l ? Simfolk.nextAt(l - 1) : 0, hi = Simfolk.nextAt(l); return `<div class="skill"><span>${k.icon} ${k.label}</span><b>${l}</b><div class="pips">${Array.from({ length: 10 }, (_, i) => `<i class="${i < l ? 'on' : i === l ? 'part' : ''}" ${i === l ? `style="--p:${l >= 10 ? 100 : Math.round((p - lo) / (hi - lo) * 100)}%"` : ''}></i>`).join('')}</div></div>`; }).join('');
    else if (ui.tab === 'rel') { const o = g.sims.filter(x => x !== sel); h = o.length ? o.map(x => { const r = Math.round(sel.rel[x.id] || 0); return `<div class="rel"><canvas width="64" height="64" data-por="${x.id}"></canvas><div><b>${x.name}</b><small>${relLabel(r)}</small><div class="bar rel-bar"><i style="width:${Math.abs(r) / 2}%;${r < 0 ? 'right:50%;background:#e2483a' : 'left:50%;background:#3fd25a'}"></i></div></div></div>`; }).join('') : '<p class="ct-empty">Add another Sim to the household to build friendships.</p>'; }
    else if (ui.tab === 'job') {
      if (sel.job) { const C = CAREERS[sel.job.career]; h = `<div class="job"><span class="big">${C.icon}</span><div><b>${C.titles[sel.job.level]}</b><small>${C.name} career · level ${sel.job.level + 1} of 5</small><small>Weekdays 9 AM – 4 PM · carpool at 8 AM · §${C.pay[sel.job.level]}/hour</small>
        <div class="perf">Performance<div class="bar"><i style="width:${sel.job.perf}%;background:#f2c230"></i></div></div>${sel.job.level < 4 ? `<small>Next promotion needs ${C.skill} level ${Simfolk.PROMO_SKILL[sel.job.level + 1]}.</small>` : '<small>Top of the career!</small>'}<button class="ct-btn sm" id="ctQuit">Quit job</button></div></div>`; }
      else h = `<p class="ct-empty">${first(sel)} doesn't have a job. Pick a career:</p>` + Object.entries(CAREERS).map(([k, C]) => `<button class="career" data-career="${k}"><span>${C.icon}</span><b>${C.titles[0]}</b><small>${C.name} · §${C.pay[0]}/h · uses ${C.skill}</small></button>`).join('');
    } else if (ui.tab === 'about') {
      const asp = ASPIRATIONS.find(a => a.id === sel.aspiration), pr = asp ? asp.prog(sel, g.sims) : 0;
      h = `<div class="traits">${sel.traits.map(t => TRAIT_BY[t]).filter(Boolean).map(t => `<div class="trait"><span>${t.icon}</span><b>${t.name}</b><small>${t.desc}</small></div>`).join('')}</div>` + (asp ? `<div class="asp"><span>${asp.icon}</span><div><b>${asp.name}${sel.aspDone ? ' ✓' : ''}</b><small>${asp.desc}</small><div class="bar"><i style="width:${pr * 100}%;background:#b98aff"></i></div></div></div>` : '');
    }
    if (tab.dataset.sig !== h) {
      tab.dataset.sig = h; tab.innerHTML = h;
      tab.querySelectorAll('[data-por]').forEach(c => portrait(c, g.simById(c.dataset.por)));
      tab.querySelectorAll('[data-career]').forEach(b => b.onclick = () => { sel.job = { career: b.dataset.career, level: 0, perf: 30 }; notify(`${first(sel)} joined the ${CAREERS[sel.job.career].name} career as a ${CAREERS[sel.job.career].titles[0]}. Carpool comes at 8 AM on weekdays.`, sel, '💼'); Sfx.win(); renderPanel(true); });
      const q = $('#ctQuit'); if (q) q.onclick = () => { sel.job = null; notify(`${first(sel)} quit their job.`, sel, '📦'); renderPanel(true); };
    }
  }
  const needColor = v => v > 60 ? '#5fd35a' : v > 35 ? '#d8d03a' : v > 18 ? '#f2963a' : '#e2483a';
  const relLabel = r => r >= 80 ? 'Best Friends' : r >= 50 ? 'Good Friends' : r >= 25 ? 'Friends' : r >= 5 ? 'Acquaintances' : r > -20 ? 'Neutral' : r > -50 ? 'Disliked' : 'Enemies';
  function renderQueue() {
    const sel = g.simById(g.sel), box = $('#ctQueue'); if (!sel || !box) return;
    const items = (sel.cur ? [sel.cur] : []).concat(sel.queue);
    const sig = items.map(a => (a.label || a.act) + (a === sel.cur ? '*' : '')).join('|') + sel.id;
    if (box.dataset.sig === sig) return; box.dataset.sig = sig;
    box.innerHTML = items.map((a, i) => `<button class="q${i === 0 && sel.cur ? ' cur' : ''}" data-q="${i}" title="Cancel">${qIcon(a)}<span>${a.label || queuedLabel(a)}</span><em>✕</em></button>`).join('');
    box.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { const i = +b.dataset.q; if (i === 0 && sel.cur) Brain.cancel(g, sel); else sel.queue.splice(sel.cur ? i - 1 : i, 1); Sfx.tap(); box.dataset.sig = ''; renderQueue(); });
  }
  function queuedLabel(a) {
    if (a.kind === 'obj') { const o = g.L.objects.find(o => o.uid === a.uid); const act = o && World.defOf(o).actions.find(x => x.id === a.act); return act ? act.label : '…'; }
    if (a.kind === 'social') { const s = SOCIAL.find(x => x.id === a.act), t = g.simById(a.target); return `${s.label} with ${t ? first(t) : '…'}`; }
    return a.kind === 'goto' ? 'Go Here' : a.kind === 'work' ? 'Go to Work' : '…';
  }
  function qIcon(a) {
    if (a.kind === 'social') return (SOCIAL.find(x => x.id === a.act) || {}).icon || '💬';
    if (a.kind === 'obj') return actIcon({ id: a.act });
    return a.kind === 'work' ? '💼' : a.kind === 'faint' ? '😵' : '👣';
  }

  /* Catalogue (Buy) and tools (Build) */
  function thumb(id, color) {
    const c = document.createElement('canvas'); c.width = c.height = 120;
    const x = c.getContext('2d'), d = World.defOf({ id }), o = { uid: 0, id, x: 0, y: 0, r: 0, color: color || 0 };
    const span = Math.max(d.w, d.d), sc = 1.5 / Math.max(1, span * .8);
    x.translate(60, 70 - (span - 1) * 8); x.scale(sc, sc);
    const [cx, cy] = Iso.P(d.w / 2, d.d / 2); x.translate(-cx, -cy + 14);
    World.drawParts(x, o);
    return c;
  }
  const thumbCache = {};
  function renderCatalog() {
    const host = $('#ctCatalog'); if (!host) return;
    if (ui.mode === 'live') { host.className = 'ct-catalog'; host.innerHTML = ''; return; }
    host.className = 'ct-catalog open';
    if (ui.mode === 'buy') {
      const cat = ui.buyCat || 'seating';
      let items = Object.values(Catalog.OBJ).filter(d => d.cat === cat && !d.fixed);
      if (cat === 'plants') {
        const found = (hostApi.found && hostApi.found()) || [];
        const ids = [...new Set(Catalog.BASIC_PLANTS.concat(found))];
        items = ids.map(id => Catalog.plantDef(id));
      }
      host.innerHTML = `<nav class="ct-cats">${Catalog.CATS.map(([k, n]) => `<button data-cat="${k}" class="${k === cat ? 'on' : ''}">${n}</button>`).join('')}</nav>
        ${ui.sel ? selBar() : ui.ghost ? ghostBar() : `<p class="ct-hint">${cat === 'plants' ? 'Every plant from your Herbarium can live in the cottage. Find more in the glasshouse!' : 'Pick an item, then tap the lot to place it. Tap furniture you own to move, rotate or sell it.'}</p>`}
        <div class="ct-items">${items.map(d => `<button class="ct-item${ui.item === d.id ? ' on' : ''}" data-item="${d.id}"><div class="th" data-th="${d.id}"></div><b>${d.name}</b><small>§${d.price.toLocaleString()}</small></button>`).join('')}</div>`;
      host.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => { ui.buyCat = b.dataset.cat; Sfx.tap(); renderCatalog(); });
      host.querySelectorAll('[data-item]').forEach(b => b.onclick = () => { Sfx.tap(); ui.item === b.dataset.item ? cancelPlacement() : startPlacing(b.dataset.item); });
      host.querySelectorAll('[data-th]').forEach(el => { const k = el.dataset.th; const th = thumbCache[k] || (thumbCache[k] = thumb(k)); el.appendChild(th.cloneNode ? cloneCanvas(th) : th); });
      bindBars(host);
    } else {
      const T = [['wall', '🧱', 'Wall'], ['room', '⬜', 'Room'], ['door', '🚪', 'Door'], ['window', '🪟', 'Window'], ['arch', '⌒', 'Arch'], ['floor', '▦', 'Floor'], ['paper', '🖌', 'Wallpaper'], ['erase', '🔨', 'Sledgehammer']];
      const tip = { wall: 'Drag along the grid lines to build walls. §14 per segment.', room: 'Drag a rectangle to build a whole room with floor.', door: 'Tap a wall to add a door (§120). Tap again to remove.', window: 'Tap a wall to add a window (§90). Tap again to remove.', arch: 'Tap a wall to open an archway (§60).', floor: 'Drag over tiles to lay flooring.', paper: 'Tap a wall to hang wallpaper. "Whole room" paints every wall in that room.', erase: 'Drag along walls to knock them down.' }[ui.tool] || 'Choose a tool. Building pauses time.';
      let sub = '';
      if (ui.tool === 'floor' || ui.tool === 'room') sub = `<div class="ct-swatches">${Object.entries(Catalog.FLOORS).filter(([, F]) => !F.hidden).map(([k, F]) => `<button class="sw${ui.floorPick === k ? ' on' : ''}" data-floor="${k}" title="${F.name} · §${F.price}/tile" style="background:${F.alt ? `linear-gradient(135deg,${F.base} 50%,${F.alt} 50%)` : F.base}"></button>`).join('')}<span>${Catalog.FLOORS[ui.floorPick].name}</span></div>`;
      if (ui.tool === 'paper' || ui.tool === 'wall') sub = `<div class="ct-swatches">${Object.entries(Catalog.WALLS).map(([k, P]) => `<button class="sw${ui.paperPick === k ? ' on' : ''}" data-paper="${k}" title="${P.name} · §${P.price}" style="background:${P.alt ? `repeating-linear-gradient(90deg,${P.base} 0 6px,${P.alt} 6px 12px)` : P.base}"></button>`).join('')}<span>${Catalog.WALLS[ui.paperPick].name}</span>${ui.tool === 'paper' ? `<label class="fill"><input type="checkbox" id="ctFill" ${ui.roomFill ? 'checked' : ''}> Whole room</label>` : ''}</div>`;
      host.innerHTML = `<div class="ct-tools">${T.map(([k, ic, n]) => `<button data-tool="${k}" class="${ui.tool === k ? 'on' : ''}"><span>${ic}</span>${n}</button>`).join('')}</div>${sub}<p class="ct-hint">${tip}</p>`;
      host.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => { ui.tool = ui.tool === b.dataset.tool ? null : b.dataset.tool; Sfx.tap(); renderCatalog(); });
      host.querySelectorAll('[data-floor]').forEach(b => b.onclick = () => { ui.floorPick = b.dataset.floor; renderCatalog(); });
      host.querySelectorAll('[data-paper]').forEach(b => b.onclick = () => { ui.paperPick = b.dataset.paper; renderCatalog(); });
      const fl = $('#ctFill'); if (fl) fl.onchange = () => { ui.roomFill = fl.checked; };
    }
  }
  function cloneCanvas(c) { const n = document.createElement('canvas'); n.width = c.width; n.height = c.height; n.getContext('2d').drawImage(c, 0, 0); return n; }
  function selBar() {
    const o = ui.sel, d = World.defOf(o);
    return `<div class="ct-selbar"><b>${d.name}</b>${d.colors ? `<div class="ct-colors">${d.colors.map((c, i) => `<button class="sw${o.color === i ? ' on' : ''}" data-col="${i}" style="background:${c}"></button>`).join('')}</div>` : ''}
      <button class="ct-btn sm" data-act="rot">⟳ Rotate</button><button class="ct-btn sm" data-act="move">✥ Move</button><button class="ct-btn sm warn" data-act="sell">Sell §${Math.round(d.price * .8).toLocaleString()}</button><button class="ct-btn sm ghost" data-act="done">Done</button></div>`;
  }
  function ghostBar() {
    const gh = ui.ghost, d = World.defOf(gh);
    return `<div class="ct-selbar"><b>${ui.moving ? 'Moving' : 'Placing'} ${d.name}</b>${d.colors && !ui.moving ? `<div class="ct-colors">${d.colors.map((c, i) => `<button class="sw${gh.color === i ? ' on' : ''}" data-gcol="${i}" style="background:${c}"></button>`).join('')}</div>` : ''}
      <button class="ct-btn sm" data-act="grot">⟳ Rotate</button><button class="ct-btn sm ghost" data-act="cancel">Cancel</button></div>`;
  }
  function bindBars(host) {
    host.querySelectorAll('[data-col]').forEach(b => b.onclick = () => { ui.sel.color = +b.dataset.col; renderCatalog(); });
    host.querySelectorAll('[data-gcol]').forEach(b => b.onclick = () => { ui.ghost.color = +b.dataset.gcol; ui.color = ui.ghost.color; renderCatalog(); });
    host.querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
      const a = b.dataset.act; Sfx.tap();
      if (a === 'rot' || a === 'grot') rotateGhost();
      if (a === 'sell') sell(ui.sel);
      if (a === 'done') selectObj(null);
      if (a === 'cancel') cancelPlacement();
      if (a === 'move') { const o = ui.sel; ui.moving = o; ui.sel = null; ui.ghost = { uid: -2, id: o.id, x: o.x, y: o.y, r: o.r, color: o.color }; renderCatalog(); }
    });
  }

  /* ───────────── Create-a-Sim ───────────── */
  let casIdx = 0, casSims = null, casPhoto = null;
  function openCAS(firstTime) {
    g.casOpen = true; casSims = g.sims.map(s => JSON.parse(JSON.stringify(s))); casIdx = Math.max(0, casSims.findIndex(s => s.id === g.sel));
    $('#cas').classList.add('open'); $('#cas').dataset.first = firstTime ? 1 : '';
    renderCAS();
  }
  function renderCAS() {
    const s = casSims[casIdx], host = $('#cas');
    const sw = (key, list, cls = '') => `<div class="cas-sw ${cls}">${list.map(v => `<button class="sw${s[key] === v ? ' on' : ''}" data-k="${key}" data-v="${v}" style="background:${v}"></button>`).join('')}</div>`;
    const ch = (key, list, names) => `<div class="cas-chips">${list.map((v, i) => `<button class="${s[key] === v ? 'on' : ''}" data-k="${key}" data-v="${v}">${names ? names[i] : v}</button>`).join('')}</div>`;
    host.innerHTML = `<div class="cas-panel">
      <header><h2>${host.dataset.first ? 'Welcome to the Keeper’s Cottage' : 'Create a Sim'}</h2><p>${host.dataset.first ? 'Meet your household. Change anything you like, then move in.' : 'Edit your household.'}</p></header>
      <div class="cas-body">
        <aside class="cas-house">${casSims.map((x, i) => `<button class="cas-mem${i === casIdx ? ' on' : ''}" data-mem="${i}"><canvas width="72" height="72"></canvas><span>${first(x)}</span></button>`).join('')}${casSims.length < 4 ? `<button class="cas-mem add" id="casAdd"><b>+</b><span>Add Sim</span></button>` : ''}</aside>
        <div class="cas-stage"><canvas id="casCv" width="360" height="420"></canvas>${casPhoto ? `<div class="cas-photo" id="casPhotoCard"><div class="cas-photo-th"></div><p><b>${casPhoto.found ? 'Made from your photo' : 'No clear face found'}</b>${casPhoto.found ? 'Skin, hair, facial hair and clothes were matched.' : 'We made a best guess.'} <button class="link" id="casPhotoEdit">Adjust</button></p><button class="cas-photo-x" id="casPhotoX" aria-label="Dismiss">✕</button></div>` : ''}
          <div class="cas-stage-btns"><label class="ct-btn sm photo" for="casFile">📷 From photo</label><input type="file" id="casFile" accept="image/*" hidden><button class="ct-btn sm" id="casRand">🎲 Randomize</button>${casSims.length > 1 ? `<button class="ct-btn sm warn" id="casDel">Remove</button>` : ''}</div></div>
        <div class="cas-form">
          <label>Name<input id="casName" maxlength="28" value="${s.name.replace(/"/g, '&quot;')}"></label>
          <h4>Age</h4>${ch('age', Simfolk.AGES, ['Young Adult', 'Adult', 'Elder'])}
          <h4>Body</h4>${ch('body', Simfolk.BODIES, ['Slim', 'Average', 'Broad'])}
          <h4>Skin tone</h4>${sw('skin', Simfolk.SKIN.includes(s.skin) ? Simfolk.SKIN : Simfolk.SKIN.concat(s.skin))}
          <h4>Hairstyle</h4>${ch('hair', Simfolk.HAIR, ['Short', 'Pixie', 'Long', 'Bun', 'Curly', 'Ponytail', 'Buzz', 'Bald'])}
          <h4>Hair colour</h4>${sw('hairColor', Simfolk.HAIRC.includes(s.hairColor) ? Simfolk.HAIRC : Simfolk.HAIRC.concat(s.hairColor))}
          <h4>Facial hair</h4><div class="cas-chips">${[[null, 'None'], ['stubble', 'Stubble'], ['beard', 'Beard']].map(([v, n]) => `<button class="${(s.beard || null) === v ? 'on' : ''}" data-beard="${v || ''}">${n}</button>`).join('')}</div>
          <h4>Outfit</h4>${ch('top', Simfolk.TOPS, ['T-shirt', 'Tank top', 'Long sleeve', 'Sweater', 'Hoodie', 'Jacket', 'Blazer', 'Dress', 'Overalls', 'Apron'])}
          <h4>Sleeves</h4><div class="cas-chips">${[['none', 'None'], ['short', 'Short'], ['long', 'Long']].map(([v, n]) => `<button class="${(s.sleeves || Simfolk.DEFAULT_SLEEVES[s.top]) === v ? 'on' : ''}" data-k="sleeves" data-v="${v}">${n}</button>`).join('')}</div>
          <h4>Neckline</h4><div class="cas-chips">${[['crew', 'Crew'], ['scoop', 'Scoop'], ['v', 'V-neck']].map(([v, n]) => `<button class="${(s.neck || (s.top === 'tank' ? 'scoop' : 'crew')) === v ? 'on' : ''}" data-k="neck" data-v="${v}">${n}</button>`).join('')}</div>
          <h4>Pattern</h4><div class="cas-chips">${[['solid', 'Plain'], ['stripes', 'Stripes'], ['vstripes', 'Pinstripe'], ['check', 'Check'], ['dots', 'Dots'], ['graphic', 'Print']].map(([v, n]) => `<button class="${(s.pattern || 'solid') === v ? 'on' : ''}" data-k="pattern" data-v="${v}">${n}</button>`).join('')}</div>
          <h4>Second colour <small>(pattern, trim, jacket lining)</small></h4>${sw('topColor2', s.topColor2 && !Simfolk.CLOTH.includes(s.topColor2) ? Simfolk.CLOTH.concat(s.topColor2) : Simfolk.CLOTH)}
          <h4>Bottoms</h4><div class="cas-chips">${[['pants', 'Trousers'], ['shorts', 'Shorts'], ['skirt', 'Skirt']].map(([v, n]) => `<button class="${(s.bottom || 'pants') === v ? 'on' : ''}" data-k="bottom" data-v="${v}">${n}</button>`).join('')}</div>
          <h4>Top colour</h4>${sw('topColor', Simfolk.CLOTH.includes(s.topColor) ? Simfolk.CLOTH : Simfolk.CLOTH.concat(s.topColor))}
          <h4>Trousers & skirt colour</h4>${sw('bottomColor', Simfolk.CLOTH.includes(s.bottomColor) ? Simfolk.CLOTH : Simfolk.CLOTH.concat(s.bottomColor))}
          <h4>Traits <small>(pick 3)</small></h4><div class="cas-traits">${TRAITS.map(t => `<button class="${s.traits.includes(t.id) ? 'on' : ''}" data-trait="${t.id}" title="${t.desc}"><span>${t.icon}</span>${t.name}</button>`).join('')}</div>
          <h4>Aspiration</h4><div class="cas-asp">${ASPIRATIONS.map(a => `<button class="${s.aspiration === a.id ? 'on' : ''}" data-asp="${a.id}"><span>${a.icon}</span><b>${a.name}</b><small>${a.desc}</small></button>`).join('')}</div>
        </div>
      </div>
      <footer><button class="ct-btn ghost" id="casCancel">${host.dataset.first ? 'Use as is' : 'Cancel'}</button><button class="ct-btn" id="casDone">${host.dataset.first ? 'Move In' : 'Save household'}</button></footer></div>`;
    host.querySelectorAll('.cas-mem canvas').forEach((c, i) => portrait(c, casSims[i]));
    host.querySelectorAll('[data-mem]').forEach(b => b.onclick = () => { casIdx = +b.dataset.mem; dropPhoto(); renderCAS(); });
    host.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { s[b.dataset.k] = b.dataset.v; if (b.dataset.k === 'top') { s.sleeves = null; s.neck = null; } Sfx.tap(); renderCAS(); });
    host.querySelectorAll('[data-trait]').forEach(b => b.onclick = () => {
      const t = b.dataset.trait, i = s.traits.indexOf(t);
      if (i >= 0) s.traits.splice(i, 1); else { if (s.traits.length >= 3) s.traits.shift(); s.traits.push(t); }
      Sfx.tap(); renderCAS();
    });
    host.querySelectorAll('[data-asp]').forEach(b => b.onclick = () => { s.aspiration = b.dataset.asp; Sfx.tap(); renderCAS(); });
    $('#casName').oninput = e => { s.name = e.target.value || 'Unnamed Sim'; host.querySelector('.cas-mem.on span').textContent = first(s); };
    host.querySelectorAll('[data-beard]').forEach(b => b.onclick = () => { s.beard = b.dataset.beard || null; Sfx.tap(); renderCAS(); });
    $('#casFile').onchange = async e => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      try {
        const r = await PhotoSim.fromFile(f);
        e.target.value = '';
        applyPhoto(s, r); casPhoto = r; Sfx.sparkle(); renderCAS(); openPhotoEditor(s);
      } catch (err) { toast(err.message || 'Could not read that photo.'); }
    };
    if (casPhoto) { $('#casPhotoCard .cas-photo-th').appendChild(PhotoSim.preview(casPhoto, 96)); $('#casPhotoX').onclick = () => { dropPhoto(); renderCAS(); }; $('#casPhotoEdit').onclick = () => openPhotoEditor(s); }
    $('#casRand').onclick = () => { const r = Simfolk.create({ last: s.name.split(' ').slice(1).join(' ') || 'Thorne' }); Object.assign(s, { name: r.name, age: Simfolk.AGES[Math.floor(Math.random() * 3)], body: r.body, skin: r.skin, hair: r.hair, hairColor: r.hairColor, top: r.top, topColor: r.topColor, bottomColor: r.bottomColor, traits: r.traits, aspiration: r.aspiration }); Sfx.sparkle(); renderCAS(); };
    const del = $('#casDel'); if (del) del.onclick = () => { casSims.splice(casIdx, 1); casIdx = 0; renderCAS(); };
    const add = $('#casAdd'); if (add) add.onclick = () => { const n = Simfolk.create({ last: casSims[0].name.split(' ').slice(1).join(' ') || 'Thorne', x: 7.5, y: 11.5 }); casSims.forEach(o => { n.rel[o.id] = 20; o.rel[n.id] = 20; }); casSims.push(n); casIdx = casSims.length - 1; Sfx.sparkle(); renderCAS(); };
    $('#casCancel').onclick = () => closeCAS(!!host.dataset.first);
    $('#casDone').onclick = () => closeCAS(true);
    // animated preview
    const cvp = $('#casCv'), x = cvp.getContext('2d');
    cancelAnimationFrame(renderCAS.raf);
    const frame = now => {
      if (!$('#cas').classList.contains('open')) return;
      x.clearRect(0, 0, cvp.width, cvp.height);
      const bg = x.createRadialGradient(180, 300, 20, 180, 260, 260); bg.addColorStop(0, '#fff8e6'); bg.addColorStop(1, '#e6dcc0'); x.fillStyle = bg; x.fillRect(0, 0, 360, 420);
      x.fillStyle = 'rgba(80,110,60,.18)'; x.beginPath(); x.ellipse(180, 372, 110, 28, 0, 0, 7); x.fill();
      const t = now / 1000, turn = Math.floor(t / 2.6) % 4;
      Simfolk.drawSim(x, s, 180, 372, 4, t, { anim: turn === 3 ? 'dance' : 'stand', front: turn !== 2, flip: turn === 1, mood: 80 });
      renderCAS.raf = requestAnimationFrame(frame);
    };
    renderCAS.raf = requestAnimationFrame(frame);
  }
  /* ───── photo → Sim ───── */
  function applyPhoto(s, r) {
    Object.assign(s, { skin: r.skin, hairColor: r.hairColor, hair: r.hair, beard: r.beard, age: r.age });
    if (r.topColor) s.topColor = r.topColor;
    const o = r.outfit;
    if (o) {
      Object.assign(s, { top: o.top, sleeves: o.sleeves, neck: o.neck, pattern: o.pattern });
      s.topColor2 = o.topColor2 || null;
      if (o.bottomColor) { s.bottomColor = o.bottomColor; s.bottom = o.bottom; }
    }
  }
  function dropPhoto() { if (casPhoto && casPhoto.url) URL.revokeObjectURL(casPhoto.url); casPhoto = null; }
  const TOP_NAMES = { tee: 'T-shirt', tank: 'tank top', longsleeve: 'long-sleeve top', jacket: 'open jacket', sweater: 'sweater', hoodie: 'hoodie', blazer: 'blazer', dress: 'dress', overalls: 'overalls', apron: 'apron' };
  const PAT_NAMES = { solid: 'plain', stripes: 'striped', vstripes: 'pinstriped', check: 'checked', dots: 'dotted', graphic: 'printed' };
  function openPhotoEditor(s) {
    const r0 = casPhoto; if (!r0) return;
    let box = r0.debug.box.slice(), hair = r0.picked, pick = false, res = r0, poly = r0.poly.map(p => p.slice()), accepted = !!r0.accepted;
    const autoPoly = (r0.autoPoly || r0.poly).map(p => p.slice()), autoBox = (r0.autoBox || r0.debug.box).slice();
    const ed = document.createElement('div'); ed.className = 'photo-ed';
    ed.innerHTML = `<div class="photo-ed-card"><h3>Tag the person</h3><p>We outlined the person we found with a <b>white dotted line</b>. Accept it, or drag the white dots to fit the body and clothes. The green circle marks the face. Your photo stays on this device and is not saved.</p>
      <div class="photo-ed-body"><div class="photo-ed-pic"><canvas id="peCv"></canvas><div class="pe-legend"><span class="w"></span>Person <span class="g"></span>Face</div></div><div class="photo-ed-side"><canvas id="peSim" width="200" height="240"></canvas>
      <div class="pe-outfit" id="peOutfit"></div>
      <label>Face size<input type="range" id="peSize" min="8" max="90" value="${Math.round(box[2] * 100)}"></label>
      <button class="ct-btn sm ghost" id="pePick">💧 Pick hair colour</button><div class="pe-info" id="peInfo"></div></div></div>
      <footer><button class="ct-btn ghost" id="peReset">Reset outline</button><button class="ct-btn ghost" id="peAccept">✓ Accept outline</button><button class="ct-btn" id="peDone">Done</button></footer></div>`;
    $('#cas').appendChild(ed);
    const src = r0.debug.cv, cv = ed.querySelector('#peCv'), x = cv.getContext('2d');
    const maxW = Math.min(440, innerWidth - 60), maxH = Math.min(420, innerHeight * .45), sc = Math.min(maxW / src.width, maxH / src.height);
    cv.width = Math.round(src.width * sc); cv.height = Math.round(src.height * sc);
    const simCv = ed.querySelector('#peSim'), sx = simCv.getContext('2d');
    const aspect = r0.debug.box[3] / r0.debug.box[2];
    function rerun() {
      res = PhotoSim.analyze(r0.img, { crop: r0.crop, box, hair, poly });
      Object.assign(res, { img: r0.img, url: r0.url, crop: r0.crop, picked: hair, autoPoly, autoBox, accepted });
      applyPhoto(s, res); draw();
    }
    function draw() {
      x.drawImage(src, 0, 0, cv.width, cv.height);
      const P = poly.map(([a, b]) => [a * cv.width, b * cv.height]);
      // dim everything outside the person tag
      x.save(); x.fillStyle = 'rgba(0,0,0,.42)'; x.beginPath(); x.rect(0, 0, cv.width, cv.height); x.moveTo(...P[0]); P.slice(1).forEach(p => x.lineTo(...p)); x.closePath(); x.fill('evenodd'); x.restore();
      x.save(); x.lineJoin = 'round';
      x.strokeStyle = 'rgba(0,0,0,.55)'; x.lineWidth = 4; x.setLineDash([]); x.beginPath(); x.moveTo(...P[0]); P.slice(1).forEach(p => x.lineTo(...p)); x.closePath(); x.stroke();
      x.strokeStyle = '#ffffff'; x.lineWidth = 2.2; x.setLineDash([5, 5]); x.stroke(); x.setLineDash([]);
      if (!accepted) for (const [px, py] of P) { x.fillStyle = '#fff'; x.beginPath(); x.arc(px, py, 4.5, 0, 7); x.fill(); x.strokeStyle = 'rgba(0,0,0,.5)'; x.lineWidth = 1; x.stroke(); }
      x.restore();
      const [bx, by, bw, bh] = box;
      x.strokeStyle = '#7cff8c'; x.lineWidth = 2; x.setLineDash([6, 4]); x.beginPath(); x.ellipse((bx + bw / 2) * cv.width, (by + bh / 2) * cv.height, bw / 2 * cv.width, bh / 2 * cv.height, 0, 0, 7); x.stroke(); x.setLineDash([]);
      if (accepted) { x.fillStyle = 'rgba(31,58,36,.9)'; x.fillRect(8, 8, 104, 24); x.fillStyle = '#fff'; x.font = 'bold 12px Nunito, sans-serif'; x.fillText('✓ Outline accepted', 14, 24); }
      sx.clearRect(0, 0, 200, 240); const g2 = sx.createRadialGradient(100, 150, 10, 100, 130, 140); g2.addColorStop(0, '#fff8e6'); g2.addColorStop(1, '#e6dcc0'); sx.fillStyle = g2; sx.fillRect(0, 0, 200, 240);
      Simfolk.drawSim(sx, s, 100, 228, 2.6, performance.now() / 1000, { anim: 'stand', front: true, mood: 80 });
      const o = res.outfit;
      ed.querySelector('#peOutfit').innerHTML = o ? `<b>Clothes we found</b><span><i style="background:${s.topColor}"></i>${o.topColor2 && (o.pattern !== 'solid' || o.top === 'jacket') ? `<i style="background:${o.topColor2}"></i>` : ''}${PAT_NAMES[o.pattern]} ${TOP_NAMES[o.top]}</span><span>${o.sleeves === 'none' ? 'sleeveless' : o.sleeves + ' sleeves'} · ${o.neck === 'v' ? 'V-neck' : o.neck + ' neck'}</span>${o.bottomColor ? `<span><i style="background:${o.bottomColor}"></i>${o.bottom}</span>` : ''}` : '<b>No clothes found</b><span>Try enlarging the outline.</span>';
      ed.querySelector('#peInfo').innerHTML = `<span style="background:${s.skin}"></span>Skin <span style="background:${s.hairColor}"></span>Hair: ${s.hair}${s.beard ? ' · ' + s.beard : ''}${s.age === 'elder' ? ' · elder' : ''}`;
      ed.querySelector('#pePick').classList.toggle('on', pick); ed.querySelector('#peAccept').classList.toggle('on', accepted);
      ed.querySelector('#peAccept').innerHTML = accepted ? '✎ Adjust outline' : '✓ Accept outline';
    }
    let drag = null;
    const pos = e => { const b = cv.getBoundingClientRect(); return [(e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height]; };
    const inEll = (px, py) => { const [bx, by, bw, bh] = box; return ((px - bx - bw / 2) / (bw / 2)) ** 2 + ((py - by - bh / 2) / (bh / 2)) ** 2 <= 1; };
    cv.onpointerdown = e => {
      const [px, py] = pos(e);
      if (pick) { hair = PhotoSim.pixel(r0, px, py); pick = false; Sfx.tap(); rerun(); return; }
      cv.setPointerCapture(e.pointerId);
      if (!accepted) {
        let bi = -1, bd = 1e9;
        poly.forEach(([a, b], i) => { const d = Math.hypot((a - px) * cv.width, (b - py) * cv.height); if (d < bd) { bd = d; bi = i; } });
        if (bd < 16) { drag = { kind: 'pt', i: bi }; return; }
      }
      if (inEll(px, py)) { drag = { kind: 'face', px, py, b: box.slice() }; return; }
      if (!accepted) drag = { kind: 'all', px, py, p: poly.map(p => p.slice()) };
    };
    cv.onpointermove = e => {
      const [px, py] = pos(e);
      cv.style.cursor = pick ? 'crosshair' : drag ? 'grabbing' : 'grab';
      if (!drag) return;
      if (drag.kind === 'pt') poly[drag.i] = [U.clamp(px, 0, 1), U.clamp(py, 0, 1)];
      else if (drag.kind === 'all') poly = drag.p.map(([a, b]) => [U.clamp(a + px - drag.px, 0, 1), U.clamp(b + py - drag.py, 0, 1)]);
      else { box[0] = U.clamp(drag.b[0] + px - drag.px, -box[2] / 2, 1 - box[2] / 2); box[1] = U.clamp(drag.b[1] + py - drag.py, -box[3] / 2, 1 - box[3] / 2); }
      draw();
    };
    cv.onpointerup = () => { if (drag) { drag = null; rerun(); } };
    ed.querySelector('#peSize').oninput = e => { const cxm = box[0] + box[2] / 2, cym = box[1] + box[3] / 2, w = e.target.value / 100, h = w * aspect; box = [cxm - w / 2, cym - h / 2, w, h]; draw(); };
    ed.querySelector('#peSize').onchange = rerun;
    ed.querySelector('#pePick').onclick = () => { pick = !pick; draw(); };
    ed.querySelector('#peAccept').onclick = () => { accepted = !accepted; Sfx.tap(); if (accepted) Sfx.sparkle(); res.accepted = accepted; draw(); };
    ed.querySelector('#peReset').onclick = () => { box = autoBox.slice(); poly = autoPoly.map(p => p.slice()); hair = null; accepted = false; rerun(); };
    ed.querySelector('#peDone').onclick = () => { res.debug.box = box.slice(); res.poly = poly.map(p => p.slice()); casPhoto = Object.assign(res, { img: r0.img, url: r0.url, autoPoly, autoBox, accepted: true }); ed.remove(); Sfx.sparkle(); renderCAS(); };
    draw();
  }
  function closeCAS(apply) {
    if (apply) {
      const old = g.sims;
      g.sims = casSims.map(n => { const o = old.find(x => x.id === n.id); return o ? Object.assign(o, { sleeves: n.sleeves || null, neck: n.neck || null, pattern: n.pattern || 'solid', topColor2: n.topColor2 || null, bottom: n.bottom || 'pants', name: n.name, age: n.age, body: n.body, skin: n.skin, hair: n.hair, beard: n.beard || null, hairColor: n.hairColor, top: n.top, topColor: n.topColor, bottomColor: n.bottomColor, traits: n.traits, aspiration: n.aspiration }) : n; });
      if (!g.sims.find(s => s.id === g.sel)) g.sel = g.sims[0].id;
      g.reserved = {}; g.sims.forEach(s => { if (!old.includes(s)) { s.x = 7.5; s.y = 11.5; } });
      save();
    }
    const firstMove = !g.cas;
    dropPhoto(); g.cas = true; g.casOpen = false; $('#cas').classList.remove('open'); renderPanel(true);
    if (firstMove) {
      const tips = [
        ['Welcome home! Tap any object, like the fridge or the bed, to give your selected Sim something to do.', '🏡'],
        ['Sims have free will and look after their own needs, but they do best with a little help. Keep an eye on the Needs panel.', '💚'],
        ['Use Buy and Build to furnish and extend the cottage. Every plant in your Herbarium can be placed as decor.', '🛋'],
        ['Short on Simoleons? Get a job in the Career tab, sell paintings, or win puzzles in the glasshouse for §150+ each.', '§']
      ];
      tips.forEach(([t, i], k) => setTimeout(() => notify(t, null, i), 600 + k * 2600));
    }
  }

  /* ───────────── glue ───────────── */
  function instant(kind, s) {
    if (kind === 'job') { select(s.id); ui.tab = 'job'; ui.panelOpen = true; renderPanel(true); toast(`Pick a career for ${first(s)}.`); }
    if (kind === 'puzzle') { save(); leave(); hostApi.playLevel && hostApi.playLevel(); }
  }
  function enter() {
    if (!g) boot();
    $('#cottage').classList.add('active'); document.querySelectorAll('.screen').forEach(x => { if (x.id !== 'cottage') x.classList.remove('active'); });
    if (!cv) { cv = $('#cottageCv'); ctx = cv.getContext('2d'); bind(); bindDom(); window.addEventListener('resize', resize); }
    resize(); setMode('live'); renderPanel(true);
    running = true; last = performance.now(); requestAnimationFrame(loop);
    if (!g.cas) setTimeout(() => openCAS(true), 300);
  }
  function leave() { running = false; save(); $('#cottage').classList.remove('active'); hostApi.home && hostApi.home(); }
  function bindDom() {
    $('#ctBack').onclick = () => { Sfx.tap(); leave(); };
    document.querySelectorAll('#ctSpeed button').forEach(b => b.onclick = () => { Sfx.tap(); setSpeed(+b.dataset.s); });
    document.querySelectorAll('.ct-modes button').forEach(b => b.onclick = () => { Sfx.tap(); setMode(b.dataset.mode); });
    $('#ctWalls').onclick = () => { g.walls = { cut: 'up', up: 'down', down: 'cut' }[g.walls]; Sfx.tap(); renderHud(); };
    $('#ctFree').onclick = e => { g.freeWill = !g.freeWill; e.currentTarget.classList.toggle('on', g.freeWill); toast(g.freeWill ? 'Free will on: Sims look after themselves.' : 'Free will off: Sims only do what you tell them.'); };
  }
  function reward(amount, why) { if (!g) boot(); g.funds += amount; save(); }
  function host(api) { hostApi = api; }
  return { enter, leave, reward, host, get state() { return g; }, _screen: (x, y, z = 0) => toScreen(...Iso.P(x, y, z)), _ui: ui, _ff: m => step(m) };
})();
