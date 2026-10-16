/* Build & Buy catalogue: floors, wall coverings and furniture.
   Furniture is modelled from parts in local space: u across the width, v front-to-back
   (the front faces +v), z height in pixels. Parts rotate with the object. */
const Catalog = (() => {
  const B = (u0, v0, z0, u1, v1, z1, c, o) => ({ t: 'b', b: [u0, v0, z0, u1, v1, z1], c, o });
  const C = (u, v, z0, z1, r, c) => ({ t: 'c', u, v, z0, z1, r, c });
  const D = (u, v, z, r, c) => ({ t: 'd', u, v, z, r, c });
  const PL = (species, s, u = .5, v = .5) => ({ t: 'p', species, s, u, v });
  const legs = (u0, v0, u1, v1, z, c, th = .06) => [B(u0, v0, 0, u0 + th, v0 + th, z, c), B(u1 - th, v0, 0, u1, v0 + th, z, c), B(u0, v1 - th, 0, u0 + th, v1, z, c), B(u1 - th, v1 - th, 0, u1, v1, z, c)];

  /* ───────────── Floors ───────────── */
  const FLOORS = {
    grass:     { name: 'Lawn', price: 0, base: '#7fae4f', outdoor: true },
    oak:       { name: 'Oak Planks', price: 6, base: '#c9965e', env: 4 },
    walnut:    { name: 'Walnut Herringbone', price: 9, base: '#7a4e2c', env: 6 },
    terracotta:{ name: 'Victorian Tile', price: 8, base: '#c26a42', alt: '#efe2c4', env: 5 },
    checker:   { name: 'Monochrome Check', price: 7, base: '#2c2c30', alt: '#f2efe8', env: 4 },
    marble:    { name: 'Carrara Marble', price: 14, base: '#eeece8', env: 8 },
    sage:      { name: 'Sage Carpet', price: 5, base: '#8fa888', env: 3 },
    rose:      { name: 'Rose Carpet', price: 5, base: '#c9909a', env: 3 },
    slate:     { name: 'Slate', price: 7, base: '#4f5a60', env: 3 },
    path:      { name: 'Garden Path', price: 3, base: '#c8b89a', outdoor: true },
    road:      { name: 'Road', price: 0, base: '#4a4c50', outdoor: true, hidden: true },
    sidewalk:  { name: 'Sidewalk', price: 0, base: '#c9c4b8', outdoor: true, hidden: true }
  };
  function drawFloor(ctx, id, x, y, R) {
    const F = FLOORS[id] || FLOORS.grass, P = Iso.P;
    const q = [P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)];
    Iso.poly(ctx, q, F.base);
    ctx.save(); ctx.beginPath(); ctx.moveTo(...q[0]); q.slice(1).forEach(p => ctx.lineTo(...p)); ctx.closePath(); ctx.clip();
    const line = (a, b, c, w = 1) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke(); };
    switch (id) {
      case 'grass':
        Iso.poly(ctx, q, U.shade(F.base, (R() - .5) * .12));
        for (let i = 0; i < 7; i++) { const [sx, sy] = P(x + R(), y + R()); ctx.strokeStyle = R() < .5 ? '#5e8f38' : '#a2c870'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + (R() - .5) * 3, sy - 3 - R() * 3); ctx.stroke(); }
        if (R() < .04) { const [sx, sy] = P(x + .5, y + .5); ctx.fillStyle = ['#fff', '#f7d84a', '#e98ab0'][Math.floor(R() * 3)]; ctx.beginPath(); ctx.arc(sx, sy - 2, 2, 0, 7); ctx.fill(); }
        break;
      case 'oak': case 'walnut':
        for (let i = 0; i <= 4; i++) line(P(x, y + i / 4), P(x + 1, y + i / 4), U.shade(F.base, -.25), 1);
        for (let i = 0; i < 4; i++) { const s = ((i * 37 + x * 13 + y * 7) % 10) / 10; line(P(x + s, y + i / 4), P(x + s, y + (i + 1) / 4), U.shade(F.base, -.2)); }
        for (let i = 0; i < 4; i++) Iso.poly(ctx, [P(x, y + i / 4), P(x + 1, y + i / 4), P(x + 1, y + i / 4 + .12), P(x, y + i / 4 + .12)], U.shade(F.base, (R() - .5) * .14));
        break;
      case 'terracotta': case 'checker':
        for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) Iso.poly(ctx, [P(x + i / 2, y + j / 2), P(x + (i + 1) / 2, y + j / 2), P(x + (i + 1) / 2, y + (j + 1) / 2), P(x + i / 2, y + (j + 1) / 2)], (i + j + x + y) % 2 ? F.alt : F.base, 'rgba(0,0,0,.18)');
        if (id === 'terracotta') Iso.poly(ctx, [P(x + .5, y + .3), P(x + .7, y + .5), P(x + .5, y + .7), P(x + .3, y + .5)], '#2c3a32');
        break;
      case 'marble':
        for (let i = 0; i < 3; i++) { const a = P(x + R(), y + R()), b = P(x + R(), y + R()); line(a, b, 'rgba(120,120,130,.3)', .8); }
        line(P(x, y), P(x + 1, y), 'rgba(0,0,0,.12)'); line(P(x, y), P(x, y + 1), 'rgba(0,0,0,.12)');
        break;
      case 'sage': case 'rose':
        for (let i = 0; i < 14; i++) { const [sx, sy] = P(x + R(), y + R()); ctx.fillStyle = U.shade(F.base, (R() - .5) * .2); ctx.fillRect(sx, sy, 1.5, 1.5); }
        break;
      case 'slate':
        line(P(x, y + .5), P(x + 1, y + .5), 'rgba(0,0,0,.25)'); line(P(x + .5, y), P(x + .5, y + 1), 'rgba(0,0,0,.25)');
        Iso.poly(ctx, [P(x, y), P(x + .5, y), P(x + .5, y + .5), P(x, y + .5)], 'rgba(255,255,255,.05)');
        break;
      case 'road':
        if ((x % 3) === 1 && y === 18) Iso.poly(ctx, [P(x + .1, y + .9), P(x + .6, y + .9), P(x + .6, y + 1), P(x + .1, y + 1)], '#e8e2c8');
        break;
      case 'sidewalk':
        line(P(x, y), P(x, y + 1), 'rgba(0,0,0,.15)'); line(P(x, y), P(x + 1, y), 'rgba(0,0,0,.08)');
        break;
      case 'path':
        for (let i = 0; i < 3; i++) { const [sx, sy] = P(x + .2 + R() * .6, y + .2 + R() * .6); ctx.fillStyle = U.shade('#b8a888', (R() - .5) * .2); ctx.beginPath(); ctx.ellipse(sx, sy, 7, 3.5, 0, 0, 7); ctx.fill(); }
        break;
    }
    ctx.restore();
  }

  /* ───────────── Wall coverings ───────────── */
  const WALLS = {
    plaster:   { name: 'Warm Plaster', price: 2, base: '#efe6d4' },
    clapboard: { name: 'White Clapboard', price: 3, base: '#f4f2ec', lines: 'h' },
    sage:      { name: 'Sage Stripe', price: 4, base: '#a9bfa0', alt: '#b9cdb0', lines: 'v' },
    blush:     { name: 'Blush Damask', price: 5, base: '#e8c4c0', dots: '#d9a8a6' },
    navy:      { name: 'Midnight Panel', price: 5, base: '#2e3a52', panel: '#3a4866' },
    tile:      { name: 'Metro Tile', price: 6, base: '#eef2f0', grid: '#c9d2ce' },
    brick:     { name: 'Exposed Brick', price: 6, base: '#a8583c', brick: true },
    botanical: { name: 'Botanical Print', price: 7, base: '#e9efe2', leaves: '#6f9a5a' },
    ochre:     { name: 'Ochre Limewash', price: 4, base: '#d9a85a' }
  };
  /* face: function (s,h) → screen point along a wall face; s in 0..1 along, h in px. */
  function drawWallFace(ctx, id, face, H, R) {
    const W = WALLS[id] || WALLS.plaster;
    const quad = [face(0, 0), face(1, 0), face(1, H), face(0, H)];
    Iso.poly(ctx, quad, W.base);
    ctx.save(); ctx.beginPath(); ctx.moveTo(...quad[0]); quad.slice(1).forEach(p => ctx.lineTo(...p)); ctx.closePath(); ctx.clip();
    const seg = (a, b, c, w = 1) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke(); };
    if (W.lines === 'h') for (let h = 8; h < H; h += 9) seg(face(0, h), face(1, h), 'rgba(0,0,0,.1)');
    if (W.lines === 'v') for (let s = 0; s < 1; s += .25) Iso.poly(ctx, [face(s, 0), face(s + .125, 0), face(s + .125, H), face(s, H)], W.alt);
    if (W.dots) for (let s = .1; s < 1; s += .25) for (let h = 12; h < H; h += 18) { const [px, py] = face(s + ((h / 18) % 2) * .12, h); ctx.fillStyle = W.dots; ctx.beginPath(); ctx.ellipse(px, py, 2.4, 3.4, 0, 0, 7); ctx.fill(); }
    if (W.panel) { seg(face(0, 34), face(1, 34), W.panel, 3); for (let s = .17; s < 1; s += .33) Iso.poly(ctx, [face(s, 6), face(s + .2, 6), face(s + .2, 28), face(s, 28)], null, W.panel, 1.5); }
    if (W.grid) { for (let h = 0; h < H; h += 8) seg(face(0, h), face(1, h), W.grid, .8); for (let s = 0; s < 1; s += .125) for (let h = 0; h < H; h += 16) seg(face(s + (h % 16 ? .0625 : 0), h), face(s + (h % 16 ? .0625 : 0), h + 8), W.grid, .8); }
    if (W.brick) for (let h = 0, r = 0; h < H; h += 7, r++) { seg(face(0, h), face(1, h), '#d8c8b0', 1); for (let s = (r % 2) * .1; s < 1; s += .2) seg(face(s, h), face(s, h + 7), '#d8c8b0', 1); }
    if (W.leaves) for (let i = 0; i < 6; i++) { const [px, py] = face(.1 + R() * .8, 10 + R() * (H - 20)); ctx.fillStyle = W.leaves; ctx.beginPath(); ctx.ellipse(px, py, 5, 2.4, R() * 3, 0, 7); ctx.fill(); }
    seg(face(0, 3), face(1, 3), 'rgba(0,0,0,.18)', 4); // skirting
    ctx.restore();
  }

  /* ───────────── Actions (what objects advertise to Sims) ─────────────
     gains: need per sim-minute · skill: points per minute · full: end once that need is full */
  const A = (id, label, o) => Object.assign({ id, label, spot: 'front', dur: 30, gains: {}, auto: true, anim: 'stand' }, o);
  const SIT = A('sit', 'Sit', { spot: 'on', dur: 40, gains: { comfort: 2.2 }, full: 'comfort', anim: 'sit' });

  /* ───────────── Furniture ───────────── */
  const OBJ = {};
  const def = (id, o) => { OBJ[id] = Object.assign({ id, w: 1, d: 1, env: 0, actions: [], colors: null }, o); };

  def('chair', {
    name: 'Bistro Chair', cat: 'seating', price: 80, env: 1, colors: ['#8a5a32', '#2e2e30', '#6f8f6a', '#c9b48a'],
    parts: c => [...legs(.22, .22, .78, .78, 17, U.shade(c, -.2)), B(.2, .2, 17, .8, .8, 21, c), B(.2, .16, 21, .8, .24, 46, c), B(.26, .17, 30, .74, .22, 40, U.shade(c, .2))],
    actions: [SIT]
  });
  def('armchair', {
    name: 'Velvet Armchair', cat: 'seating', price: 450, env: 4, colors: ['#3f6a4a', '#8a3a4a', '#d9a85a', '#2e3a52'],
    parts: c => [B(.08, .12, 0, .92, .92, 16, U.shade(c, -.25)), B(.16, .2, 16, .84, .88, 22, U.shade(c, .12)), B(.08, .08, 0, .92, .3, 48, c), B(.04, .2, 0, .2, .92, 30, c), B(.8, .2, 0, .96, .92, 30, c)],
    actions: [Object.assign({}, SIT, { gains: { comfort: 3 } }), A('nap', 'Nap', { spot: 'on', dur: 60, gains: { energy: .35, comfort: 1 }, anim: 'sit', full: 'energy' })]
  });
  def('sofa', {
    name: 'Chesterfield Sofa', cat: 'seating', price: 1100, env: 6, w: 2, colors: ['#5a3a2a', '#3f6a4a', '#2e3a52', '#b8862e', '#c9909a'],
    parts: c => [B(.04, .12, 0, 1.96, .94, 15, U.shade(c, -.3)), B(.18, .24, 15, .99, .9, 22, U.shade(c, .12)), B(1.01, .24, 15, 1.82, .9, 22, U.shade(c, .12)),
      B(.04, .06, 0, 1.96, .3, 46, c), B(.02, .14, 0, .2, .94, 32, c), B(1.8, .14, 0, 1.98, .94, 32, c), B(.3, .26, 22, .7, .36, 36, U.shade(c, .3)), B(1.3, .26, 22, 1.7, .36, 36, U.shade(c, .3))],
    actions: [Object.assign({}, SIT, { gains: { comfort: 3 } }), A('nap', 'Nap', { spot: 'on', dur: 90, gains: { energy: .4, comfort: 1.2 }, anim: 'sit', full: 'energy' })],
    spots: [[0, 0], [1, 0]]
  });
  def('bed', {
    name: 'Cottage Single Bed', cat: 'beds', price: 500, env: 3, d: 2, colors: ['#7aa0c4', '#c9909a', '#8fa888', '#e2c27a'],
    parts: c => [B(.05, .12, 0, .95, 1.96, 13, '#8a5a32'), B(.08, .14, 13, .92, 1.9, 22, '#f4f1ea'), B(.08, .72, 22, .92, 1.92, 25, c), B(.08, 1.88, 6, .92, 1.94, 24, U.shade(c, -.1)),
      B(.2, .2, 22, .8, .55, 29, '#ffffff'), B(.04, 0, 0, .96, .12, 44, '#8a5a32'), B(.04, 1.92, 0, .96, 2, 22, '#8a5a32')],
    actions: [A('sleep', 'Sleep', { spot: 'on', dur: 600, gains: { energy: .55, comfort: .4 }, full: 'energy', anim: 'sleep' }), A('nap', 'Nap', { spot: 'on', dur: 90, gains: { energy: .5, comfort: .5 }, anim: 'sleep', auto: false })],
    spots: [[0, 1]], lie: [[.5, .95]]
  });
  def('bed2', {
    name: 'Four-Poster Double', cat: 'beds', price: 1600, env: 7, w: 2, d: 2, colors: ['#e9e2d0', '#3f6a4a', '#8a3a4a', '#2e3a52'],
    parts: c => [B(.04, .12, 0, 1.96, 1.96, 14, '#5a3a22'), B(.08, .14, 14, 1.92, 1.9, 23, '#f7f4ee'), B(.08, .76, 23, 1.92, 1.92, 26, c), B(.08, 1.88, 7, 1.92, 1.94, 25, U.shade(c, -.1)),
      B(.2, .2, 23, .9, .55, 30, '#fff'), B(1.1, .2, 23, 1.8, .55, 30, '#fff'), B(.02, 0, 0, 1.98, .12, 50, '#5a3a22'),
      B(.02, 0, 0, .1, .1, 88, '#4a2e18'), B(1.9, 0, 0, 1.98, .1, 88, '#4a2e18'), B(.02, 1.9, 0, .1, 2, 88, '#4a2e18'), B(1.9, 1.9, 0, 1.98, 2, 88, '#4a2e18'), B(.02, 0, 84, 1.98, .1, 88, '#4a2e18'), B(.02, 1.9, 84, 1.98, 2, 88, '#4a2e18')],
    actions: [A('sleep', 'Sleep', { spot: 'on', dur: 600, gains: { energy: .62, comfort: .6 }, full: 'energy', anim: 'sleep' }), A('nap', 'Nap', { spot: 'on', dur: 90, gains: { energy: .55, comfort: .6 }, anim: 'sleep', auto: false })],
    spots: [[0, 1], [1, 1]], lie: [[.5, .95], [1.5, .95]]
  });
  def('nightstand', { name: 'Nightstand', cat: 'surfaces', price: 120, env: 2, parts: () => [B(.15, .2, 0, .85, .85, 26, '#8a5a32'), B(.2, .82, 6, .8, .86, 14, '#a8743e'), C(.5, .5, 26, 40, .1, '#e8dcc0'), D(.5, .5, 44, .2, '#f4e8c8')], light: 2.2 });
  def('fridge', {
    name: 'Retro Fridge', cat: 'kitchen', price: 600, colors: ['#bfe0d6', '#f2efe6', '#f2c0b8', '#2e2e30'],
    parts: c => [B(.1, .18, 0, .9, .9, 72, c), B(.1, .9, 30, .9, .92, 31, U.shade(c, -.25)), B(.74, .92, 38, .8, .95, 58, '#c9c9c9'), B(.74, .92, 10, .8, .95, 24, '#c9c9c9')],
    actions: [A('snack', 'Grab a Snack', { dur: 14, gains: { hunger: 2.6 }, anim: 'eat', full: 'hunger' }), A('juice', 'Have a Juice', { dur: 8, gains: { hunger: 1, bladder: -1.2, fun: .5 }, anim: 'eat', auto: false })]
  });
  def('stove', {
    name: 'Cast-Iron Range', cat: 'kitchen', price: 550, colors: ['#2e2e30', '#3f6a6a', '#8a2a2a', '#efe6d4'],
    parts: c => [B(.05, .1, 0, .95, .95, 34, c), B(.1, .95, 6, .9, .97, 26, U.shade(c, .2)), B(.2, .97, 22, .8, 1, 24, '#c9c9c9'), D(.3, .35, 34.5, .14, '#1a1a1a'), D(.7, .35, 34.5, .14, '#1a1a1a'), D(.3, .7, 34.5, .14, '#1a1a1a'), D(.7, .7, 34.5, .14, '#1a1a1a'), B(.05, .05, 34, .95, .15, 46, U.shade(c, -.1))],
    actions: [A('cook', 'Cook a Meal', { dur: 55, phases: [{ dur: 30, anim: 'cook', skill: { cooking: 1.4 } }, { dur: 25, anim: 'eat', gains: { hunger: 3.3 } }], moodlet: 'tasty', anim: 'cook' }),
      A('quick', 'Make Pancakes', { dur: 35, phases: [{ dur: 15, anim: 'cook', skill: { cooking: 1 } }, { dur: 20, anim: 'eat', gains: { hunger: 2.6, fun: .4 } }], anim: 'cook', auto: false })]
  });
  def('counter', { name: 'Butcher-Block Counter', cat: 'kitchen', price: 180, env: 1, colors: ['#efe6d4', '#3f6a4a', '#2e3a52'], parts: c => [B(.02, .1, 0, .98, .98, 32, c), B(0, .06, 32, 1, 1, 36, '#c9965e'), B(.1, .98, 8, .9, 1, 28, U.shade(c, -.12))] });
  def('kitchensink', {
    name: 'Farmhouse Sink', cat: 'kitchen', price: 350, env: 1, colors: ['#efe6d4', '#3f6a4a', '#2e3a52'],
    parts: c => [B(.02, .1, 0, .98, .98, 32, c), B(0, .06, 32, 1, 1, 36, '#c9965e'), B(.2, .35, 30, .8, .85, 36.5, '#e9eef0'), C(.5, .2, 36, 50, .04, '#b9b9b9'), B(.48, .2, 48, .52, .45, 50, '#b9b9b9')],
    actions: [A('wash', 'Wash Hands', { dur: 6, gains: { hygiene: 2.2 }, anim: 'cook' })]
  });
  def('table', { name: 'Farmhouse Table', cat: 'surfaces', price: 400, env: 3, w: 2, parts: () => [...legs(.12, .12, 1.88, .88, 28, '#7a4e2c', .08), B(.05, .05, 28, 1.95, .95, 33, '#a8743e'), C(1, .5, 33, 38, .08, '#e8e2d6'), PL('pi_peperomioides', .1, 1, .5)] });
  def('coffeetable', { name: 'Coffee Table', cat: 'surfaces', price: 200, env: 2, parts: () => [...legs(.15, .15, .85, .85, 14, '#2e2e30'), B(.1, .1, 14, .9, .9, 18, '#c9965e'), B(.3, .3, 18, .6, .55, 21, '#3a6a6a'), B(.32, .32, 21, .58, .53, 23, '#c94a4a')] });
  def('toilet', {
    name: 'Porcelain Toilet', cat: 'bathroom', price: 300, parts: () => [C(.5, .55, 0, 16, .26, '#f4f4f2'), D(.5, .55, 16.5, .24, '#dfe5e8'), B(.25, .12, 8, .75, .32, 38, '#f4f4f2'), B(.6, .2, 36, .7, .26, 39, '#c9c9c9')],
    actions: [A('pee', 'Use Toilet', { spot: 'on', dur: 12, gains: { bladder: 9 }, full: 'bladder', anim: 'sit' })]
  });
  def('shower', {
    name: 'Glass Shower', cat: 'bathroom', price: 650, env: 2, parts: () => [B(0, 0, 0, 1, 1, 4, '#dfe5e8'), B(0, 0, 4, .05, 1, 86, 'rgba(200,230,240,.35)', { line: false }), B(0, 0, 4, 1, .05, 86, '#eef2f0'), C(.5, .12, 70, 82, .03, '#b9b9b9'), D(.5, .22, 80, .1, '#b9b9b9')],
    actions: [A('shower', 'Take a Shower', { spot: 'on', dur: 20, gains: { hygiene: 5 }, full: 'hygiene', anim: 'shower' })], glass: true
  });
  def('bathtub', {
    name: 'Clawfoot Tub', cat: 'bathroom', price: 1000, env: 5, d: 2, colors: ['#f4f4f2', '#2e3a52', '#c9909a'],
    parts: c => [...legs(.12, .15, .88, 1.85, 6, '#c9a54a', .1), B(.08, .1, 6, .92, 1.9, 30, c), B(.16, .2, 26, .84, 1.8, 30.5, '#cfe6ec'), C(.5, .14, 30, 40, .04, '#c9a54a')],
    actions: [A('bath', 'Take a Bath', { spot: 'on', dur: 40, gains: { hygiene: 3, comfort: 1.6 }, full: 'hygiene', anim: 'bath' })], spots: [[0, 1]]
  });
  def('basin', { name: 'Pedestal Basin', cat: 'bathroom', price: 250, env: 1, parts: () => [C(.5, .4, 0, 28, .1, '#f4f4f2'), B(.15, .15, 28, .85, .75, 34, '#f4f4f2'), D(.5, .45, 34.2, .2, '#dfe5e8'), B(.2, .02, 34, .8, .08, 80, '#cfe6ec')], actions: [A('wash', 'Wash Up', { dur: 8, gains: { hygiene: 2 }, anim: 'cook' })] });
  def('tv', {
    name: 'Flatscreen TV', cat: 'electronics', price: 700, env: 1, parts: () => [B(.05, .25, 0, .95, .75, 18, '#3a2e24'), B(.1, .45, 18, .9, .52, 52, '#151518'), B(.12, .52, 21, .88, .53, 49, '#2a4a6a', { south: '#35618a', east: '#35618a' })],
    actions: [A('watch', 'Watch TV', { dur: 60, gains: { fun: 1.6, comfort: .3 }, full: 'fun', anim: 'watch', range: 2 })], screen: true
  });
  def('computer', {
    name: 'Writing Desk & PC', cat: 'electronics', price: 900, parts: () => [...legs(.08, .1, .92, .9, 30, '#5a3a22', .08), B(.05, .08, 30, .95, .92, 34, '#8a5a32'), B(.3, .25, 34, .7, .32, 58, '#1a1a1c'), B(.32, .32, 37, .68, .33, 56, '#4a7aa0', { south: '#5e93c0' }), B(.35, .5, 34, .65, .65, 35.5, '#d8d8d8')],
    actions: [A('play', 'Play Leafscapes', { dur: 50, gains: { fun: 1.8 }, full: 'fun', anim: 'type' }), A('browse', 'Browse Plant Forums', { dur: 45, gains: { fun: .9, social: .4 }, skill: { logic: .5 }, anim: 'type' }),
      A('blog', 'Write a Plant Blog', { dur: 90, gains: { fun: .4 }, skill: { creativity: .9 }, money: 'blog', anim: 'type' }), A('job', 'Find a Job', { dur: 0, auto: false, anim: 'type', instant: 'job' })], screen: true
  });
  def('bookshelf', {
    name: 'Library Bookcase', cat: 'hobbies', price: 400, env: 3, parts: () => {
      const p = [B(.05, .1, 0, .95, .5, 86, '#6a4428')];
      const cols = ['#8a3a3a', '#3a5a8a', '#3f6a4a', '#d9a85a', '#5a3a6a', '#e8dcc0'];
      for (let s = 0; s < 4; s++) for (let i = 0; i < 6; i++) p.push(B(.1 + i * .135, .45, 6 + s * 20, .22 + i * .135, .52, 6 + s * 20 + 13 + (i % 3) * 2, cols[(i + s * 2) % 6]));
      return p;
    },
    actions: [A('read', 'Read a Book', { dur: 60, gains: { fun: 1 }, skill: { logic: 1 }, full: 'fun', anim: 'read' }), A('study', 'Study Botany', { dur: 60, gains: { fun: .3 }, skill: { gardening: 1.1 }, anim: 'read', auto: false })]
  });
  def('stereo', { name: 'Vinyl Stereo', cat: 'electronics', price: 300, env: 2, parts: () => [B(.1, .3, 0, .9, .8, 24, '#5a3a22'), B(.15, .35, 24, .85, .75, 28, '#2e2e30'), D(.5, .55, 28.5, .2, '#111'), D(.5, .55, 28.7, .06, '#c94a4a')], actions: [A('dance', 'Dance', { dur: 40, gains: { fun: 1.5, energy: -.12, social: .3 }, skill: { fitness: .7 }, full: 'fun', anim: 'dance', range: 1 })] });
  def('easel', { name: 'Artist’s Easel', cat: 'hobbies', price: 350, env: 2, parts: () => [B(.2, .4, 0, .26, .46, 72, '#a8743e'), B(.74, .4, 0, .8, .46, 72, '#a8743e'), B(.47, .2, 0, .53, .26, 68, '#a8743e'), B(.18, .44, 30, .82, .5, 33, '#a8743e'), B(.22, .47, 33, .78, .5, 70, '#f4f1ea'), B(.3, .5, 40, .5, .505, 55, '#6f9a5a'), B(.5, .5, 45, .7, .505, 62, '#e8a06a')], actions: [A('paint', 'Paint', { dur: 120, gains: { fun: .9 }, skill: { creativity: 1.3 }, money: 'painting', anim: 'paint' })] });
  def('chess', { name: 'Chess Table', cat: 'hobbies', price: 500, env: 2, parts: () => [C(.5, .5, 0, 26, .07, '#5a3a22'), B(.18, .18, 26, .82, .82, 30, '#3a2a1a'), B(.22, .22, 30, .78, .78, 30.5, '#e8dcc0'), B(.3, .3, 30.5, .36, .36, 36, '#111'), B(.6, .6, 30.5, .66, .66, 37, '#f4f4f2')], actions: [A('chess', 'Play Chess', { dur: 50, gains: { fun: 1 }, skill: { logic: 1.4 }, anim: 'type' })] });
  def('treadmill', { name: 'Treadmill', cat: 'hobbies', price: 900, d: 2, parts: () => [B(.15, .1, 0, .85, 1.9, 10, '#2e2e30'), B(.2, .3, 10, .8, 1.85, 11, '#444'), B(.15, .1, 10, .22, .2, 52, '#555'), B(.78, .1, 10, .85, .2, 52, '#555'), B(.15, .08, 48, .85, .24, 56, '#3a3a3c')], actions: [A('run', 'Work Out', { spot: 'on', dur: 50, gains: { fun: .5, hygiene: -.2, energy: -.25 }, skill: { fitness: 1.6 }, anim: 'run' })], spots: [[0, 1]] });
  def('mirror', { name: 'Standing Mirror', cat: 'hobbies', price: 250, env: 2, parts: () => [B(.2, .45, 0, .8, .55, 6, '#c9a54a'), B(.22, .47, 6, .78, .53, 84, '#c9a54a'), B(.26, .53, 10, .74, .54, 80, '#cfe2ea', { south: '#dfeef4', east: '#dfeef4' })], actions: [A('speech', 'Practice Speech', { dur: 40, gains: { fun: .4, social: .3 }, skill: { charisma: 1.4 }, anim: 'talk' })] });
  def('aquarium', { name: 'Planted Aquarium', cat: 'decor', price: 800, env: 9, parts: () => [B(.05, .2, 0, .95, .8, 26, '#2e2e30'), B(.08, .24, 26, .92, .76, 58, 'rgba(90,170,200,.55)', { top: 'rgba(160,220,240,.6)', line: false }), B(.12, .3, 26, .3, .4, 46, '#4f9a3f'), B(.6, .5, 26, .7, .6, 50, '#5aae36'), B(.4, .5, 40, .46, .52, 43, '#f28a1e')], actions: [A('fish', 'Watch the Fish', { dur: 30, gains: { fun: .9, comfort: .3 }, anim: 'watch' })] });
  def('lamp', { name: 'Arc Floor Lamp', cat: 'lighting', price: 150, env: 2, colors: ['#c9a54a', '#2e2e30', '#efe6d4'], parts: c => [D(.5, .5, 0, .18, '#2e2e30'), C(.5, .5, 0, 74, .025, c), C(.5, .5, 66, 84, .18, '#f4e8c8')], light: 3 });
  def('rug', { name: 'Persian Rug', cat: 'decor', price: 300, env: 4, w: 2, d: 2, flat: true, colors: ['#7a2a2a', '#23365a', '#4a6a3a'], parts: c => [B(.05, .05, 0, 1.95, 1.95, 1, c, { line: false }), B(.2, .2, 1, 1.8, 1.8, 1.4, '#e2c27a', { line: false }), B(.3, .3, 1.4, 1.7, 1.7, 1.8, U.shade(c, -.2), { line: false }), B(.8, .8, 1.8, 1.2, 1.2, 2.2, '#c9862e', { line: false })] });
  def('gardenbed', { name: 'Raised Veg Bed', cat: 'outdoor', price: 250, env: 3, w: 2, parts: () => { const p = [B(.05, .1, 0, 1.95, .9, 14, '#8a5a32'), B(.12, .16, 14, 1.88, .84, 15, '#4a3424')]; for (let i = 0; i < 6; i++) p.push(B(.2 + i * .28, .35, 15, .32 + i * .28, .62, 24 + (i % 2) * 5, i % 2 ? '#5aae36' : '#7cc35a')); return p; }, actions: [A('tend', 'Tend the Vegetables', { dur: 45, gains: { fun: .5, hygiene: -.1 }, skill: { gardening: 1.2 }, money: 'harvest', anim: 'garden' })] });
  def('bench', { name: 'Garden Bench', cat: 'outdoor', price: 200, env: 2, w: 2, parts: () => [...legs(.1, .25, 1.9, .9, 16, '#2e2e30'), B(.05, .25, 16, 1.95, .9, 19, '#a8743e'), B(.05, .15, 19, 1.95, .25, 40, '#a8743e')], actions: [SIT], spots: [[0, 0], [1, 0]] });
  def('tree', { name: 'Old Oak', cat: 'fixed', price: 0, fixed: true, parts: () => [C(.5, .5, 0, 60, .12, '#6a4a32'), { t: 'tree', u: .5, v: .5, z: 60 }] });
  def('mailbox', { name: 'Mailbox', cat: 'fixed', price: 0, fixed: true, parts: () => [B(.45, .45, 0, .55, .55, 34, '#5a3a22'), B(.3, .3, 34, .7, .7, 48, '#3f6a4a'), B(.68, .45, 44, .72, .5, 56, '#c94a4a')] });
  def('glasshouse', {
    name: 'The Glasshouse', cat: 'fixed', price: 0, fixed: true, w: 6, d: 4, env: 10,
    parts: () => {
      const p = [B(0, 0, 0, 6, 4, 8, '#9a5a3e')], gl = 'rgba(200,235,235,.38)';
      p.push(B(.05, .05, 8, 5.95, 3.95, 100, gl, { top: 'rgba(220,245,245,.45)', line: false }));
      for (let i = 0; i <= 6; i++) p.push(B(Math.min(5.92, i), 3.92, 8, Math.min(5.92, i) + .08, 4, 100, '#f2f0e8'));
      for (let i = 0; i <= 4; i++) p.push(B(5.92, Math.min(3.92, i), 8, 6, Math.min(3.92, i) + .08, 100, '#f2f0e8'));
      p.push(B(0, 3.92, 54, 6, 4, 58, '#f2f0e8'), B(5.92, 0, 54, 6, 4, 58, '#f2f0e8'), B(0, 0, 100, 6, 4, 104, '#f2f0e8'), B(2.6, 1.6, 104, 3.4, 2.4, 128, '#f2f0e8'), B(2.7, 1.7, 128, 3.3, 2.3, 132, '#c9a54a'));
      p.push(PL('m_deliciosa', .27, 1.2, 1.4), PL('a_frydek', .24, 4.5, 1.1), PL('c_orbifolia', .24, 1.4, 3.2), PL('m_thai', .25, 4.4, 3.1), PL('d_laurentii', .22, 3, 2.3), PL('a_zebrina', .22, 2.4, 1.0));
      return p;
    },
    actions: [A('tend', 'Tend the Glasshouse', { dur: 60, gains: { fun: 1.1, room: .3 }, skill: { gardening: 1.6 }, anim: 'garden' }), A('visit', 'Play a Glasshouse Puzzle', { dur: 0, auto: false, instant: 'puzzle' })],
    spotsFront: [[2, 4], [3, 4]]
  });

  /* Potted plants: any Herbarium species can be bought as decor. */
  const BASIC_PLANTS = ['m_deliciosa', 'e_marble_queen', 'd_laurentii', 'pi_peperomioides', 'z_zamiifolia'];
  function plantDef(spId) {
    const id = 'plant:' + spId;
    if (OBJ[id]) return OBJ[id];
    const sp = SPECIES_BY_ID[spId];
    def(id, {
      name: sp.name, cat: 'plants', price: 60 + sp.rarity * sp.rarity * 60, env: 3 + sp.rarity * 2, species: spId,
      parts: () => [PL(spId, .19)],
      actions: [A('water', 'Water the Plant', { dur: 10, gains: { fun: .5 }, skill: { gardening: 1.2 }, anim: 'water' }), A('talk', 'Talk to the Plant', { dur: 15, gains: { fun: .8, social: .6 }, anim: 'talk', auto: false })]
    });
    return OBJ[id];
  }
  BASIC_PLANTS.forEach(plantDef);

  const CATS = [['seating', 'Seating'], ['beds', 'Beds'], ['surfaces', 'Tables'], ['kitchen', 'Kitchen'], ['bathroom', 'Bathroom'], ['electronics', 'Electronics'], ['hobbies', 'Hobbies'], ['lighting', 'Lighting'], ['decor', 'Decor'], ['plants', 'Plants'], ['outdoor', 'Garden']];
  return { OBJ, FLOORS, WALLS, CATS, drawFloor, drawWallFace, plantDef, BASIC_PLANTS };
})();
