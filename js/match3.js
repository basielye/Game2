/* Match-3 engine: board model, special pieces, cascades, effects and canvas rendering. */
const Match3 = (() => {
  const TILE_NAMES = ['Leaf', 'Dew Drop', 'Sunflower', 'Blossom', 'Plum', 'Acorn'];
  const TILE_COLORS = ['#4fa43a', '#3aa6e0', '#f2c230', '#f27aa8', '#8e4fc4', '#c9793a'];
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const sleep = U.sleep;

  /* ───────────── Sprites (drawn procedurally, cached per size) ───────────── */
  const Sprites = {
    size: 0, cache: {}, urls: {},
    build(px) {
      if (px === this.size) return;
      this.size = px; this.cache = {};
      const keys = ['c0', 'c1', 'c2', 'c3', 'c4', 'c5', 'h', 'v', 'bomb', 'fly', 'rainbow', 'moss1', 'moss2', 'pot1', 'pot2', 'vine'];
      for (const k of keys) this.cache[k] = this.render(k, px);
    },
    render(k, px) {
      const cv = document.createElement('canvas'); cv.width = cv.height = px;
      const ctx = cv.getContext('2d'); ctx.translate(px / 2, px / 2);
      const r = px * .4;
      DRAW[k[0] === 'c' ? 'tile' + k[1] : k](ctx, r, px);
      return cv;
    },
    url(k) {
      if (!this.urls[k]) this.urls[k] = this.render(k, 96).toDataURL();
      return this.urls[k];
    }
  };
  const rg = (ctx, x, y, r, stops) => { const g = ctx.createRadialGradient(x - r * .3, y - r * .35, r * .1, x, y, r); stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c)); return g; };
  function shadow(ctx, r) { ctx.shadowColor = 'rgba(20,30,10,.45)'; ctx.shadowBlur = r * .18; ctx.shadowOffsetY = r * .1; }
  function noShadow(ctx) { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }
  function heartLeaf(ctx, r) {
    ctx.beginPath(); ctx.moveTo(0, -r);
    ctx.bezierCurveTo(r * .75, -r * .95, r * 1.08, -r * .1, r * .62, r * .55);
    ctx.bezierCurveTo(r * .42, r * .86, r * .12, r * .86, 0, r * .62);
    ctx.bezierCurveTo(-r * .12, r * .86, -r * .42, r * .86, -r * .62, r * .55);
    ctx.bezierCurveTo(-r * 1.08, -r * .1, -r * .75, -r * .95, 0, -r);
    ctx.closePath();
  }
  const DRAW = {
    tile0(ctx, r) { // monstera leaf
      ctx.rotate(-.25); shadow(ctx, r); heartLeaf(ctx, r);
      ctx.fillStyle = rg(ctx, 0, 0, r * 1.2, ['#8fdc6a', '#4fa43a', '#246b1f']); ctx.fill(); noShadow(ctx);
      ctx.lineWidth = r * .07; ctx.strokeStyle = '#1b4d17'; ctx.stroke();
      ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.lineCap = 'round'; ctx.lineWidth = r * .13;
      for (const [x1, y1, x2, y2] of [[r * .95, -r * .2, r * .38, -r * .1], [r * .8, r * .38, r * .3, r * .22], [-r * .98, -r * .15, -r * .4, -r * .05], [-r * .75, r * .42, -r * .28, r * .25]]) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
      ctx.beginPath(); ctx.ellipse(r * .2, -r * .42, r * .1, r * .06, -.5, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-r * .2, -r * .42, r * .1, r * .06, .5, 0, 7); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = '#c8f0a0'; ctx.lineWidth = r * .07; ctx.beginPath(); ctx.moveTo(0, r * .62); ctx.lineTo(0, -r * .85); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(r * .3, -r * .5, r * .16, r * .08, -.7, 0, 7); ctx.fill();
    },
    tile1(ctx, r) { // dew drop
      shadow(ctx, r); ctx.beginPath(); ctx.moveTo(0, -r * 1.02);
      ctx.bezierCurveTo(r * .3, -r * .55, r * .82, -r * .05, r * .8, r * .32);
      ctx.bezierCurveTo(r * .78, r * .78, r * .42, r * .98, 0, r * .98);
      ctx.bezierCurveTo(-r * .42, r * .98, -r * .78, r * .78, -r * .8, r * .32);
      ctx.bezierCurveTo(-r * .82, -r * .05, -r * .3, -r * .55, 0, -r * 1.02); ctx.closePath();
      ctx.fillStyle = rg(ctx, 0, r * .2, r * 1.1, ['#d6f4ff', '#4cb8f0', '#1a5fa8']); ctx.fill(); noShadow(ctx);
      ctx.lineWidth = r * .07; ctx.strokeStyle = '#123f78'; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.ellipse(-r * .32, r * .15, r * .12, r * .26, .3, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(-r * .1, -r * .35, r * .06, 0, 7); ctx.fill();
    },
    tile2(ctx, r) { // sunflower
      shadow(ctx, r);
      for (let i = 0; i < 14; i++) {
        ctx.save(); ctx.rotate(i / 14 * Math.PI * 2); ctx.beginPath(); ctx.ellipse(0, -r * .62, r * .2, r * .4, 0, 0, 7);
        ctx.fillStyle = i % 2 ? '#f7c62b' : '#ffd84a'; ctx.fill(); ctx.lineWidth = r * .04; ctx.strokeStyle = '#b8780c'; ctx.stroke(); ctx.restore();
      }
      noShadow(ctx);
      ctx.beginPath(); ctx.arc(0, 0, r * .45, 0, 7); ctx.fillStyle = rg(ctx, 0, 0, r * .5, ['#9a6030', '#5a3112', '#2e1606']); ctx.fill();
      ctx.lineWidth = r * .05; ctx.strokeStyle = '#2a1404'; ctx.stroke();
      ctx.fillStyle = '#d29a4a';
      for (let i = 0; i < 34; i++) { const a = i * 2.39996, d = Math.sqrt(i / 34) * r * .38; ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, r * .035, 0, 7); ctx.fill(); }
    },
    tile3(ctx, r) { // blossom
      shadow(ctx, r);
      for (let i = 0; i < 5; i++) {
        ctx.save(); ctx.rotate(i / 5 * Math.PI * 2); ctx.beginPath();
        ctx.moveTo(0, 0); ctx.bezierCurveTo(-r * .65, -r * .35, -r * .45, -r * 1.05, 0, -r * .9); ctx.bezierCurveTo(r * .45, -r * 1.05, r * .65, -r * .35, 0, 0);
        ctx.fillStyle = rg(ctx, 0, -r * .5, r * .7, ['#ffe0ec', '#f585b3', '#c9346e']); ctx.fill();
        ctx.lineWidth = r * .05; ctx.strokeStyle = '#8e1f4c'; ctx.stroke(); ctx.restore();
      }
      noShadow(ctx);
      ctx.beginPath(); ctx.arc(0, 0, r * .22, 0, 7); ctx.fillStyle = rg(ctx, 0, 0, r * .25, ['#fff6b0', '#f2c230', '#c88a10']); ctx.fill();
      ctx.fillStyle = '#8a5a08'; for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28; ctx.beginPath(); ctx.arc(Math.cos(a) * r * .13, Math.sin(a) * r * .13, r * .03, 0, 7); ctx.fill(); }
    },
    tile4(ctx, r) { // plum
      shadow(ctx, r);
      ctx.beginPath(); ctx.arc(0, r * .1, r * .78, 0, 7); ctx.fillStyle = rg(ctx, 0, r * .1, r * .9, ['#e2b8ff', '#9a55d6', '#4a1a7a']); ctx.fill(); noShadow(ctx);
      ctx.lineWidth = r * .07; ctx.strokeStyle = '#33105a'; ctx.stroke();
      ctx.strokeStyle = 'rgba(60,15,100,.5)'; ctx.lineWidth = r * .05; ctx.beginPath(); ctx.moveTo(0, -r * .55); ctx.quadraticCurveTo(r * .2, r * .2, 0, r * .85); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(-r * .35, -r * .15, r * .15, r * .25, .4, 0, 7); ctx.fill();
      ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = r * .09; ctx.beginPath(); ctx.moveTo(0, -r * .6); ctx.lineTo(r * .08, -r * .95); ctx.stroke();
      ctx.save(); ctx.translate(r * .1, -r * .8); ctx.rotate(.9); ctx.beginPath(); ctx.ellipse(r * .25, 0, r * .28, r * .12, 0, 0, 7);
      ctx.fillStyle = '#5bb33f'; ctx.fill(); ctx.strokeStyle = '#2a6a1a'; ctx.lineWidth = r * .04; ctx.stroke(); ctx.restore();
    },
    tile5(ctx, r) { // acorn
      shadow(ctx, r);
      ctx.beginPath(); ctx.moveTo(-r * .62, -r * .15); ctx.bezierCurveTo(-r * .66, r * .55, -r * .2, r * .95, 0, r * 1.0); ctx.bezierCurveTo(r * .2, r * .95, r * .66, r * .55, r * .62, -r * .15); ctx.closePath();
      ctx.fillStyle = rg(ctx, 0, r * .3, r * .9, ['#ffd09a', '#e08a3e', '#8a4410']); ctx.fill(); noShadow(ctx);
      ctx.lineWidth = r * .07; ctx.strokeStyle = '#5a2a08'; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(-r * .28, r * .25, r * .1, r * .25, .2, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-r * .8, -r * .1); ctx.bezierCurveTo(-r * .85, -r * .75, r * .85, -r * .75, r * .8, -r * .1); ctx.quadraticCurveTo(0, r * .08, -r * .8, -r * .1); ctx.closePath();
      ctx.fillStyle = rg(ctx, 0, -r * .4, r * .9, ['#c9a06a', '#8a6232', '#4a3010']); ctx.fill(); ctx.strokeStyle = '#3a2208'; ctx.stroke();
      ctx.save(); ctx.clip(); ctx.strokeStyle = 'rgba(40,20,0,.45)'; ctx.lineWidth = r * .04;
      for (let i = -6; i < 7; i++) { ctx.beginPath(); ctx.moveTo(i * r * .16, -r); ctx.lineTo(i * r * .16 + r * .5, 0); ctx.stroke(); ctx.beginPath(); ctx.moveTo(i * r * .16, -r); ctx.lineTo(i * r * .16 - r * .5, 0); ctx.stroke(); }
      ctx.restore();
      ctx.strokeStyle = '#4a3010'; ctx.lineWidth = r * .1; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, -r * .52); ctx.quadraticCurveTo(r * .05, -r * .8, r * .2, -r * .88); ctx.stroke();
    },
    glow(ctx, r, col) {
      const g = ctx.createRadialGradient(0, 0, r * .2, 0, 0, r * 1.25); g.addColorStop(0, col); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 1.25, 0, 7); ctx.fill();
    },
    dragonfly(ctx, r) {
      DRAW.glow(ctx, r, 'rgba(120,255,220,.55)');
      ctx.fillStyle = 'rgba(210,245,255,.6)'; ctx.strokeStyle = 'rgba(40,110,130,.8)'; ctx.lineWidth = r * .03;
      for (const [y, a, l] of [[-1, -.35, .78], [1, .35, .78], [-1, -.75, .68], [1, .75, .68]]) {
        ctx.save(); ctx.translate(r * .15, 0); ctx.rotate(a + (y < 0 ? -1.2 : 1.2)); ctx.beginPath(); ctx.ellipse(r * l * .5, 0, r * l * .55, r * .15, 0, 0, 7); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * l, 0); ctx.stroke(); ctx.restore();
      }
      shadow(ctx, r);
      const g = ctx.createLinearGradient(0, -r * .1, 0, r * .1); g.addColorStop(0, '#5ff0d0'); g.addColorStop(1, '#0a7a8a');
      ctx.fillStyle = g;
      for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.ellipse(-r * .1 - i * r * .13, 0, r * .085, r * .075, 0, 0, 7); ctx.fill(); }
      ctx.beginPath(); ctx.ellipse(r * .2, 0, r * .2, r * .14, 0, 0, 7); ctx.fill(); noShadow(ctx);
      ctx.fillStyle = '#123a6a'; ctx.beginPath(); ctx.arc(r * .48, -r * .09, r * .11, 0, 7); ctx.arc(r * .48, r * .09, r * .11, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(r * .5, -r * .12, r * .035, 0, 7); ctx.arc(r * .5, r * .06, r * .035, 0, 7); ctx.fill();
    },
    h(ctx, r) { DRAW.dragonfly(ctx, r); },
    v(ctx, r) { ctx.rotate(-Math.PI / 2); DRAW.dragonfly(ctx, r); },
    bomb(ctx, r) {
      DRAW.glow(ctx, r, 'rgba(255,190,80,.55)'); shadow(ctx, r);
      ctx.beginPath(); ctx.arc(0, r * .15, r * .68, 0, 7); ctx.fillStyle = rg(ctx, 0, r * .15, r * .75, ['#c9a77a', '#7a5532', '#3a2410']); ctx.fill(); noShadow(ctx);
      ctx.lineWidth = r * .07; ctx.strokeStyle = '#2a1808'; ctx.stroke();
      ctx.fillStyle = '#f2e3c4'; for (let i = 0; i < 14; i++) { const a = i * 2.4, d = (i % 5) / 5 * r * .55; ctx.beginPath(); ctx.ellipse(Math.cos(a) * d, r * .15 + Math.sin(a) * d, r * .05, r * .03, a, 0, 7); ctx.fill(); }
      for (const [x, a] of [[-r * .22, -.6], [0, 0], [r * .22, .6]]) {
        ctx.save(); ctx.translate(x, -r * .45); ctx.rotate(a); ctx.strokeStyle = '#3c8a2a'; ctx.lineWidth = r * .06; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -r * .3); ctx.stroke();
        ctx.fillStyle = '#6cd04a'; ctx.beginPath(); ctx.ellipse(-r * .1, -r * .32, r * .13, r * .06, .5, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(r * .1, -r * .32, r * .13, r * .06, -.5, 0, 7); ctx.fill(); ctx.restore();
      }
      ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.ellipse(-r * .3, -r * .05, r * .15, r * .1, -.6, 0, 7); ctx.fill();
    },
    fly(ctx, r) {
      DRAW.glow(ctx, r, 'rgba(255,170,90,.5)');
      const wing = (sx, big) => {
        ctx.save(); ctx.scale(sx, 1); ctx.beginPath();
        if (big) { ctx.moveTo(0, -r * .05); ctx.bezierCurveTo(r * .3, -r * .9, r * 1.0, -r * .85, r * .9, -r * .25); ctx.bezierCurveTo(r * .85, 0, r * .3, r * .05, 0, -r * .05); }
        else { ctx.moveTo(0, 0); ctx.bezierCurveTo(r * .6, 0, r * .75, r * .55, r * .4, r * .7); ctx.bezierCurveTo(r * .2, r * .75, r * .05, r * .35, 0, 0); }
        ctx.fillStyle = rg(ctx, r * .4, big ? -r * .4 : r * .3, r * .7, ['#ffd27a', '#f28a1e', '#b24a08']); ctx.fill();
        ctx.lineWidth = r * .09; ctx.strokeStyle = '#1e1208'; ctx.stroke();
        ctx.lineWidth = r * .03; ctx.beginPath(); ctx.moveTo(r * .05, 0); ctx.lineTo(r * .7, big ? -r * .6 : r * .5); ctx.stroke();
        ctx.fillStyle = '#fff'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(big ? r * (.55 + i * .13) : r * (.3 + i * .1), big ? -r * (.72 - i * .18) : r * (.62 - i * .02), r * .035, 0, 7); ctx.fill(); }
        ctx.restore();
      };
      shadow(ctx, r); wing(1, false); wing(-1, false); wing(1, true); wing(-1, true); noShadow(ctx);
      ctx.fillStyle = '#1e1208'; ctx.beginPath(); ctx.ellipse(0, r * .1, r * .07, r * .45, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -r * .38, r * .09, 0, 7); ctx.fill();
      ctx.strokeStyle = '#1e1208'; ctx.lineWidth = r * .03; ctx.beginPath(); ctx.moveTo(0, -r * .42); ctx.quadraticCurveTo(-r * .1, -r * .7, -r * .22, -r * .76); ctx.moveTo(0, -r * .42); ctx.quadraticCurveTo(r * .1, -r * .7, r * .22, -r * .76); ctx.stroke();
    },
    rainbow(ctx, r) {
      DRAW.glow(ctx, r, 'rgba(255,255,255,.75)');
      const hues = [0, 30, 55, 110, 190, 230, 280, 320];
      shadow(ctx, r);
      for (let layer = 0; layer < 2; layer++) for (let i = 0; i < 16; i++) {
        const a = i / 16 * Math.PI * 2 + layer * .2, L = layer ? r * .62 : r * .95;
        ctx.save(); ctx.rotate(a); ctx.beginPath(); ctx.ellipse(0, -L * .55, r * .14, L * .48, 0, 0, 7);
        const h = hues[(i + layer * 3) % hues.length];
        ctx.fillStyle = `hsl(${h},85%,${layer ? 72 : 60}%)`; ctx.fill(); ctx.lineWidth = r * .03; ctx.strokeStyle = `hsl(${h},70%,32%)`; ctx.stroke(); ctx.restore();
      }
      noShadow(ctx);
      ctx.beginPath(); ctx.arc(0, 0, r * .25, 0, 7); ctx.fillStyle = rg(ctx, 0, 0, r * .3, ['#ffffff', '#ffe46a', '#e09a10']); ctx.fill();
    },
    moss1(ctx, r, px) { DRAW.moss(ctx, px, 1); },
    moss2(ctx, r, px) { DRAW.moss(ctx, px, 2); },
    moss(ctx, px, lv) {
      const R = U.rng(lv * 99), s = px / 2;
      ctx.fillStyle = lv === 2 ? '#3f6a22' : '#6f9a3a';
      roundRect(ctx, -s * .96, -s * .96, s * 1.92, s * 1.92, s * .25); ctx.fill();
      for (let i = 0; i < (lv === 2 ? 70 : 45); i++) {
        const x = (R() - .5) * s * 1.8, y = (R() - .5) * s * 1.8, rr = s * (.06 + R() * .12);
        ctx.fillStyle = lv === 2 ? ['#2f5418', '#557f2c', '#6e9a3a'][i % 3] : ['#8ab84a', '#a6cf60', '#5f8a2e'][i % 3];
        ctx.beginPath(); ctx.arc(x, y, rr, 0, 7); ctx.fill();
      }
      if (lv === 2) { ctx.strokeStyle = '#9acb5a'; ctx.lineWidth = s * .05; for (let i = 0; i < 8; i++) { const x = (R() - .5) * s * 1.5, y = (R() - .5) * s * 1.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + s * .12, y - s * .2); ctx.stroke(); } }
    },
    pot2(ctx, r) { DRAW.pot(ctx, r, 2); },
    pot1(ctx, r) { DRAW.pot(ctx, r, 1); },
    pot(ctx, r, hp) {
      shadow(ctx, r);
      ctx.beginPath(); ctx.moveTo(-r * .95, -r * .55); ctx.lineTo(-r * .7, r * .95); ctx.quadraticCurveTo(0, r * 1.08, r * .7, r * .95); ctx.lineTo(r * .95, -r * .55); ctx.closePath();
      const g = ctx.createLinearGradient(-r, 0, r, 0); g.addColorStop(0, '#8a3e1e'); g.addColorStop(.35, '#d98451'); g.addColorStop(.7, '#b55c32'); g.addColorStop(1, '#7a321a');
      ctx.fillStyle = g; ctx.fill(); noShadow(ctx); ctx.lineWidth = r * .06; ctx.strokeStyle = '#5a2210'; ctx.stroke();
      roundRect(ctx, -r * 1.05, -r * .95, r * 2.1, r * .45, r * .12); ctx.fillStyle = '#c96f42'; ctx.fill(); ctx.stroke();
      if (hp === 2) { ctx.fillStyle = '#2f7a84'; ctx.fillRect(-r * .85, r * .05, r * 1.7, r * .22); ctx.fillStyle = '#e8d8a0'; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.arc(i * r * .23, r * .16, r * .05, 0, 7); ctx.fill(); } }
      else {
        ctx.strokeStyle = '#3a1404'; ctx.lineWidth = r * .07; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(-r * .2, -r * .5); ctx.lineTo(-r * .05, -r * .1); ctx.lineTo(-r * .3, r * .25); ctx.lineTo(-r * .1, r * .7); ctx.moveTo(-r * .05, -r * .1); ctx.lineTo(r * .35, r * .1); ctx.stroke();
        ctx.fillStyle = '#5a2210'; ctx.beginPath(); ctx.moveTo(r * .55, -r * .95); ctx.lineTo(r * .85, -r * .95); ctx.lineTo(r * .7, -r * .65); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(-r * .7, -r * .4, r * .15, r * 1.1);
    },
    vine(ctx, r) {
      ctx.lineCap = 'round'; ctx.strokeStyle = '#2f6a1e'; ctx.lineWidth = r * .16;
      const path = () => { ctx.beginPath(); ctx.moveTo(-r * 1.2, -r * .8); ctx.bezierCurveTo(-r * .2, -r * 1.2, r * .2, r * 1.2, r * 1.2, r * .7); ctx.moveTo(-r * 1.1, r * .9); ctx.bezierCurveTo(-r * .4, r * .1, r * .4, -r * .4, r * 1.1, -r * 1.0); };
      path(); ctx.stroke(); ctx.strokeStyle = '#6cb83e'; ctx.lineWidth = r * .08; path(); ctx.stroke();
      for (const [x, y, a] of [[-r * .55, -r * .7, -.8], [r * .55, r * .5, 2.3], [-r * .45, r * .45, 2.6], [r * .5, -r * .55, -.4], [0, 0, 1]]) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.beginPath(); ctx.ellipse(0, -r * .18, r * .12, r * .22, 0, 0, 7);
        ctx.fillStyle = '#5aae36'; ctx.fill(); ctx.strokeStyle = '#2a5a14'; ctx.lineWidth = r * .03; ctx.stroke(); ctx.restore();
      }
    }
  };
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  /* ───────────── Game ───────────── */
  let TID = 0;
  class Game {
    constructor(canvas, ui) {
      this.cv = canvas; this.ctx = canvas.getContext('2d'); this.ui = ui;
      this.fx = []; this.dying = []; this.running = false; this.last = 0;
      this.bindInput();
      this.loop = this.loop.bind(this);
    }
    /* ---------- setup ---------- */
    load(level, boosters = {}) {
      this.level = level; this.R = U.rng((Date.now() & 0xffff) + level.n * 31);
      this.rows = level.rows.length; this.cols = level.rows[0].length;
      this.nColors = level.colors; this.moves = level.moves;
      this.goals = level.goals.map(g => Object.assign({}, g, { left: g.count, shown: g.count }));
      this.cells = [];
      for (let r = 0; r < this.rows; r++) {
        const row = [];
        for (let c = 0; c < this.cols; c++) {
          const ch = level.rows[r][c];
          row.push({ on: ch !== '_', moss: ch === 'm' ? 1 : ch === 'M' ? 2 : 0, pot: ch === 'p' ? 1 : ch === 'P' ? 2 : 0, vine: ch === 'v' ? 1 : 0, tile: null });
        }
        this.cells.push(row);
      }
      this.fx = []; this.dying = []; this.sel = null; this.hint = null; this.armed = null;
      this.busy = true; this.state = 'play'; this.idle = 0; this.coins = 0;
      this.fill();
      this.resize();
      for (const row of this.cells) for (const cell of row) if (cell.tile) { cell.tile.y -= this.rows + 1; cell.tile.anim = { type: 'fall', v: 0, delay: (this.rows - cell.tile.ty) * .03 + cell.tile.tx * .015 }; }
      this.ui.onMoves(this.moves); this.ui.onGoals(this.goals);
      if (!this.running) { this.running = true; this.last = performance.now(); requestAnimationFrame(this.loop); }
      (async () => {
        await this.waitAnims();
        const pre = [];
        if (boosters.dragonfly) pre.push(this.R() < .5 ? 'h' : 'v');
        if (boosters.bomb) pre.push('bomb');
        if (boosters.rainbow) pre.push('rainbow');
        for (const sp of pre) {
          const t = U.pick(this.allTiles().filter(o => !o.t.sp && !o.cell.vine), this.R);
          if (t) { t.t.sp = sp; t.t.color = -1; t.t.pop = 0; Sfx.create(); this.burst(t.c, t.r, '#fff6c0', 14); await sleep(220); }
        }
        this.busy = false;
      })();
    }
    stop() { this.running = false; }
    newTile(color, sp, r, c) { return { id: ++TID, color, sp, x: c, y: r, tx: c, ty: r, anim: null, pop: 1, fired: false }; }
    randColor() { return Math.floor(this.R() * this.nColors); }
    cell(r, c) { return r >= 0 && c >= 0 && r < this.rows && c < this.cols ? this.cells[r][c] : null; }
    col(r, c) { const cl = this.cell(r, c); return cl && cl.on && cl.tile && !cl.tile.sp ? cl.tile.color : -1; }
    movable(r, c) { const cl = this.cell(r, c); return !!(cl && cl.on && cl.tile && !cl.vine && !cl.pot); }
    allTiles() { const o = []; this.cells.forEach((row, r) => row.forEach((cell, c) => { if (cell.on && cell.tile) o.push({ r, c, cell, t: cell.tile }); })); return o; }
    fill() {
      for (let tries = 0; tries < 40; tries++) {
        for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
          const cl = this.cells[r][c]; cl.tile = null;
          if (!cl.on || cl.pot) continue;
          let col, k = 0;
          do { col = this.randColor(); k++; } while (k < 30 && ((this.col(r, c - 1) === col && this.col(r, c - 2) === col) || (this.col(r - 1, c) === col && this.col(r - 2, c) === col) || (this.col(r - 1, c) === col && this.col(r, c - 1) === col && this.col(r - 1, c - 1) === col)));
          cl.tile = this.newTile(col, null, r, c);
        }
        if (!this.findMatches().length && this.findMove()) return;
      }
    }
    /* ---------- layout & input ---------- */
    resize() {
      const parent = this.cv.parentElement, dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = parent.clientWidth, h = parent.clientHeight;
      this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
      this.cv.style.width = w + 'px'; this.cv.style.height = h + 'px';
      this.dpr = dpr;
      if (!this.rows) return;
      const cs = Math.floor(Math.min(w / (this.cols + .3), h / (this.rows + .3)));
      this.cs = cs; this.ox = (w - cs * this.cols) / 2; this.oy = (h - cs * this.rows) / 2;
      Sprites.build(Math.round(cs * dpr));
    }
    cellAt(px, py) {
      const c = Math.floor((px - this.ox) / this.cs), r = Math.floor((py - this.oy) / this.cs);
      const cl = this.cell(r, c); return cl && cl.on ? { r, c } : null;
    }
    bindInput() {
      const pos = e => { const b = this.cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
      this.cv.addEventListener('pointerdown', e => {
        Sfx.init();
        if (this.busy || this.state !== 'play') return;
        const [x, y] = pos(e), at = this.cellAt(x, y); if (!at) { this.sel = null; return; }
        this.idle = 0; this.hint = null;
        if (this.armed) { this.useBooster(at); return; }
        this.drag = { at, x, y, moved: false };
        try { this.cv.setPointerCapture(e.pointerId); } catch (_) { }
      });
      this.cv.addEventListener('pointermove', e => {
        if (!this.drag || this.drag.moved || this.busy) return;
        const [x, y] = pos(e), dx = x - this.drag.x, dy = y - this.drag.y;
        if (Math.hypot(dx, dy) < this.cs * .35) return;
        this.drag.moved = true;
        const a = this.drag.at, b = Math.abs(dx) > Math.abs(dy) ? { r: a.r, c: a.c + Math.sign(dx) } : { r: a.r + Math.sign(dy), c: a.c };
        this.sel = null; this.trySwap(a, b);
      });
      this.cv.addEventListener('pointerup', () => {
        const d = this.drag; this.drag = null;
        if (!d || d.moved || this.busy) return;
        const a = d.at, cl = this.cell(a.r, a.c);
        if (this.sel && Math.abs(this.sel.r - a.r) + Math.abs(this.sel.c - a.c) === 1) { const s = this.sel; this.sel = null; this.trySwap(s, a); return; }
        if (cl.tile && cl.tile.sp && !cl.vine) { this.sel = null; this.tapSpecial(a); return; }
        this.sel = this.movable(a.r, a.c) && !(this.sel && this.sel.r === a.r && this.sel.c === a.c) ? a : null;
        if (this.sel) Sfx.tap();
      });
    }
    /* ---------- moves ---------- */
    useMove() { this.moves--; this.ui.onMoves(this.moves); }
    async trySwap(a, b) {
      if (this.busy || !this.movable(a.r, a.c) || !this.movable(b.r, b.c)) return;
      this.busy = true; this.hint = null;
      const ca = this.cells[a.r][a.c], cb = this.cells[b.r][b.c], ta = ca.tile, tb = cb.tile;
      ca.tile = tb; cb.tile = ta;
      this.tween(ta, b.c, b.r, .16); this.tween(tb, a.c, a.r, .16); Sfx.swap();
      await this.waitAnims();
      if (ta.sp || tb.sp) {
        this.useMove();
        await this.combo({ r: b.r, c: b.c, t: ta }, { r: a.r, c: a.c, t: tb });
        await this.settle(); await this.resolve(null); await this.afterMove(); return;
      }
      if (!this.findMatches().length) {
        ca.tile = ta; cb.tile = tb; Sfx.bad();
        this.tween(ta, a.c, a.r, .16); this.tween(tb, b.c, b.r, .16);
        await this.waitAnims(); this.busy = false; return;
      }
      this.useMove();
      await this.resolve([a, b]);
      await this.afterMove();
    }
    async tapSpecial(a) {
      this.busy = true;
      const t = this.cells[a.r][a.c].tile;
      this.useMove(); t.fired = true; this.kill(a.r, a.c, true);
      await this.blast([], [{ r: a.r, c: a.c, sp: t.sp }]);
      await this.settle(); await this.resolve(null); await this.afterMove();
    }
    async combo(A, B) {
      const s1 = A.t.sp, s2 = B.t.sp, isR = s => s === 'h' || s === 'v';
      let act;
      if (s1 && s2) {
        A.t.fired = B.t.fired = true; this.kill(A.r, A.c, true); this.kill(B.r, B.c, true);
        if (s1 === 'rainbow' && s2 === 'rainbow') act = { sp: 'all' };
        else if (s1 === 'rainbow' || s2 === 'rainbow') act = { sp: 'rainbow', convert: s1 === 'rainbow' ? s2 : s1 };
        else if (s1 === 'fly' && s2 === 'fly') act = { sp: 'fly3' };
        else if (s1 === 'fly' || s2 === 'fly') act = { sp: 'fly', carry: s1 === 'fly' ? s2 : s1 };
        else if (isR(s1) && isR(s2)) act = { sp: 'cross' };
        else if (s1 === 'bomb' && s2 === 'bomb') act = { sp: 'bomb', rad: 3.3 };
        else act = { sp: 'cross3' };
        this.ui.onCombo && this.ui.onCombo();
        Object.assign(act, { r: A.r, c: A.c });
      } else {
        const S = s1 ? A : B, N = s1 ? B : A;
        S.t.fired = true; this.kill(S.r, S.c, true);
        act = S.t.sp === 'rainbow' ? { sp: 'rainbow', color: N.t.color, r: S.r, c: S.c } : { sp: S.t.sp, r: S.r, c: S.c };
      }
      await this.blast([], [act]);
    }
    async afterMove() {
      if (this.goalsDone()) { this.state = 'bonus'; await this.bloomBonus(); this.state = 'won'; this.ui.onWin({ coins: this.coins }); return; }
      if (this.moves <= 0) { this.state = 'lost'; Sfx.lose(); this.ui.onLose(); return; }
      if (!this.findMove()) await this.shuffle();
      this.busy = false; this.idle = 0;
    }
    addMoves(n) { this.moves += n; this.ui.onMoves(this.moves); this.state = 'play'; this.busy = false; }
    goalsDone() { return this.goals.every(g => g.left <= 0); }
    /* ---------- boosters ---------- */
    arm(type) { if (this.busy) return false; this.armed = this.armed === type ? null : type; return true; }
    async useBooster(at) {
      const type = this.armed; this.armed = null; this.busy = true;
      this.ui.onBoosterUsed && this.ui.onBoosterUsed(type);
      if (type === 'trowel') { this.burst(at.c, at.r, '#c9a06a', 18); Sfx.pot(); await this.blast([at]); }
      else { const hits = []; for (let c = 0; c < this.cols; c++) hits.push({ r: at.r, c }); this.fx.push(new Sweep(at.r, this.cols)); Sfx.rocket(); await this.blast(hits); }
      await this.settle(); await this.resolve(null);
      if (this.goalsDone() || this.moves <= 0) return this.afterMove();
      if (!this.findMove()) await this.shuffle();
      this.busy = false;
    }
    /* ---------- matching ---------- */
    findMatches() {
      const runs = [], R = this.rows, C = this.cols;
      for (let r = 0; r < R; r++) for (let c = 0; c < C;) {
        const k = this.col(r, c); let e = c + 1;
        if (k >= 0) while (e < C && this.col(r, e) === k) e++;
        if (k >= 0 && e - c >= 3) { const cells = []; for (let i = c; i < e; i++) cells.push({ r, c: i }); runs.push({ dir: 'h', cells, len: e - c }); }
        c = e;
      }
      for (let c = 0; c < C; c++) for (let r = 0; r < R;) {
        const k = this.col(r, c); let e = r + 1;
        if (k >= 0) while (e < R && this.col(e, c) === k) e++;
        if (k >= 0 && e - r >= 3) { const cells = []; for (let i = r; i < e; i++) cells.push({ r: i, c }); runs.push({ dir: 'v', cells, len: e - r }); }
        r = e;
      }
      // union runs sharing a cell
      const owner = {}, groups = [];
      for (const run of runs) {
        let g = null;
        for (const p of run.cells) { const o = owner[p.r * 64 + p.c]; if (o) { g = o; break; } }
        if (!g) { g = { runs: [], set: new Map() }; groups.push(g); }
        g.runs.push(run);
        for (const p of run.cells) { g.set.set(p.r * 64 + p.c, p); owner[p.r * 64 + p.c] = g; }
      }
      // 2×2 squares → butterfly
      for (let r = 0; r < R - 1; r++) for (let c = 0; c < C - 1; c++) {
        const k = this.col(r, c);
        if (k < 0 || this.col(r, c + 1) !== k || this.col(r + 1, c) !== k || this.col(r + 1, c + 1) !== k) continue;
        const sq = [{ r, c }, { r, c: c + 1 }, { r: r + 1, c }, { r: r + 1, c: c + 1 }];
        let g = null;
        for (const p of sq) { const o = owner[p.r * 64 + p.c]; if (o) { g = o; break; } }
        if (g && g.square) continue;
        if (!g) { g = { runs: [], set: new Map() }; groups.push(g); }
        g.square = true;
        for (const p of sq) { g.set.set(p.r * 64 + p.c, p); owner[p.r * 64 + p.c] = g; }
      }
      return groups.map(g => {
        const maxLen = Math.max(0, ...g.runs.map(r => r.len)), dirs = new Set(g.runs.map(r => r.dir));
        let sp = null;
        if (maxLen >= 5) sp = 'rainbow';
        else if (dirs.size === 2) sp = 'bomb';
        else if (maxLen === 4) sp = g.runs.find(r => r.len === 4).dir;
        else if (g.square) sp = 'fly';
        return { cells: [...g.set.values()], sp, color: this.col(g.set.values().next().value.r, g.set.values().next().value.c) };
      });
    }
    matchAt(r, c) {
      const k = this.col(r, c); if (k < 0) return false;
      let n = 1; for (let i = c - 1; this.col(r, i) === k; i--) n++; for (let i = c + 1; this.col(r, i) === k; i++) n++;
      if (n >= 3) return true;
      n = 1; for (let i = r - 1; this.col(i, c) === k; i--) n++; for (let i = r + 1; this.col(i, c) === k; i++) n++;
      if (n >= 3) return true;
      for (const [dr, dc] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) {
        const r0 = r + dr, c0 = c + dc;
        if (this.col(r0, c0) === k && this.col(r0 + 1, c0) === k && this.col(r0, c0 + 1) === k && this.col(r0 + 1, c0 + 1) === k) return true;
      }
      return false;
    }
    findMove() {
      let special = null;
      for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
        if (!this.movable(r, c)) continue;
        if (this.cells[r][c].tile.sp && !special) special = [{ r, c }, { r, c }];
        for (const [dr, dc] of [[0, 1], [1, 0]]) {
          const r2 = r + dr, c2 = c + dc;
          if (!this.movable(r2, c2)) continue;
          const A = this.cells[r][c], B = this.cells[r2][c2];
          [A.tile, B.tile] = [B.tile, A.tile];
          const ok = this.matchAt(r, c) || this.matchAt(r2, c2);
          [A.tile, B.tile] = [B.tile, A.tile];
          if (ok) return [{ r, c }, { r: r2, c: c2 }];
        }
      }
      return special;
    }
    async shuffle() {
      this.ui.onToast && this.ui.onToast('Shuffling the beds…');
      const spots = this.allTiles().filter(o => !o.cell.vine && !o.t.sp);
      const tiles = spots.map(o => o.t);
      for (let k = 0; k < 60; k++) {
        U.shuffle(tiles, this.R);
        spots.forEach((o, i) => { o.cell.tile = tiles[i]; });
        if (!this.findMatches().length && this.findMove()) break;
        if (k > 40) tiles.forEach(t => { t.color = this.randColor(); });
      }
      spots.forEach(o => this.tween(o.cell.tile, o.c, o.r, .4));
      await this.waitAnims();
    }
    /* ---------- resolution ---------- */
    async resolve(swapPos) {
      let chain = 0;
      for (let guard = 0; guard < 40; guard++) {
        const groups = this.findMatches();
        if (!groups.length) break;
        chain++; Sfx.match(chain);
        if (chain >= 3) this.fx.push(new FloatText(['', '', '', 'Lush!', 'Blooming!', 'Overgrown!', 'Jungle Fever!'][Math.min(6, chain)] || 'Jungle Fever!', this.cols / 2, this.rows / 2));
        const hits = [], creates = [];
        for (const g of groups) {
          hits.push(...g.cells);
          for (const p of g.cells) for (const [dr, dc] of N4) { const n = this.cell(p.r + dr, p.c + dc); if (n && n.on && n.pot) hits.push({ r: p.r + dr, c: p.c + dc }); }
          if (g.sp) {
            let pos = swapPos && g.cells.find(p => swapPos.some(s => s.r === p.r && s.c === p.c));
            if (!pos) { const pool = g.cells.filter(p => !this.cells[p.r][p.c].vine); pos = pool[Math.floor(pool.length / 2)] || g.cells[0]; }
            creates.push({ r: pos.r, c: pos.c, sp: g.sp, cells: g.cells });
          }
        }
        // pieces of a special-forming match slide together
        for (const cr of creates) for (const p of cr.cells) { const t = this.cells[p.r][p.c].tile; if (t && (p.r !== cr.r || p.c !== cr.c)) this.tween(t, cr.c, cr.r, .12); }
        if (creates.length) await this.waitAnims();
        await this.blast(hits);
        for (const cr of creates) {
          const cl = this.cells[cr.r][cr.c];
          if (!cl.tile && !cl.pot) { cl.tile = this.newTile(-1, cr.sp, cr.r, cr.c); cl.tile.pop = 0; cl.vine = 0; this.burst(cr.c, cr.r, '#fffbd0', 16); Sfx.create(); }
        }
        swapPos = null;
        await sleep(90);
        await this.settle();
      }
    }
    /* hits: [{r,c}] damage; acts: special activations. Waves propagate chain reactions. */
    async blast(hits, acts = []) {
      const done = new Set();
      for (let wave = 0; wave < 80 && (hits.length || acts.length); wave++) {
        const found = [];
        for (const h of hits) { const k = h.r * 64 + h.c; if (done.has(k)) continue; done.add(k); this.hit(h.r, h.c, found); }
        acts = acts.concat(found); hits = [];
        if (!acts.length) break;
        let wait = 0; const next = [];
        for (const a of acts) { const res = this.activate(a); hits.push(...res.cells); next.push(...(res.acts || [])); wait = Math.max(wait, res.wait || 0); }
        acts = next;
        await sleep(wait);
      }
    }
    hit(r, c, found) {
      const cl = this.cell(r, c); if (!cl || !cl.on) return;
      if (cl.pot) {
        cl.pot--; Sfx.pot(); this.burst(c, r, '#c8693a', 12, 'shard');
        if (!cl.pot) this.collect('pot', null, r, c, 'pot1');
        return;
      }
      const t = cl.tile;
      if (t) {
        if (cl.vine) { cl.vine = 0; this.collect('vine', null, r, c, 'vine'); this.burst(c, r, '#5aae36', 10, 'leaf'); }
        if (t.sp) { if (!t.fired) { t.fired = true; found.push({ r, c, sp: t.sp }); } }
        else this.collect('color', t.color, r, c, 'c' + t.color);
        this.kill(r, c);
      }
      if (cl.moss) {
        cl.moss--; Sfx.moss(); this.burst(c, r, '#7aa83e', 8, 'dot');
        if (!cl.moss) this.collect('moss', null, r, c, 'moss1');
      }
    }
    kill(r, c, quiet) {
      const cl = this.cells[r][c], t = cl.tile; if (!t) return;
      cl.tile = null;
      this.dying.push({ key: t.sp || 'c' + t.color, x: t.x, y: t.y, t: 0 });
      if (!quiet && !t.sp) this.burst(c, r, TILE_COLORS[t.color], 7, 'leaf');
    }
    collect(type, color, r, c, key) {
      const i = this.goals.findIndex(g => g.type === type && (type !== 'color' || g.color === color));
      if (i < 0) return;
      const g = this.goals[i]; if (g.left <= 0) return;
      g.left--;
      this.ui.onCollect(i, key, this.ox + (c + .5) * this.cs, this.oy + (r + .5) * this.cs, () => { g.shown = Math.max(g.left, g.shown - 1); this.ui.onGoals(this.goals); });
    }
    pickTarget(exclude) {
      const R = this.R, tiers = [[], [], [], []];
      this.cells.forEach((row, r) => row.forEach((cl, c) => {
        if (!cl.on || exclude.has(r * 64 + c)) return;
        const gl = t => this.goals.find(g => g.type === t && g.left > 0);
        if (cl.pot && gl('pot')) tiers[0].push({ r, c });
        else if (cl.vine && gl('vine')) tiers[0].push({ r, c });
        else if (cl.moss && gl('moss')) tiers[1].push({ r, c });
        else if (cl.tile && !cl.tile.sp && this.goals.find(g => g.type === 'color' && g.color === cl.tile.color && g.left > 0)) tiers[2].push({ r, c });
        else if (cl.tile || cl.pot) tiers[3].push({ r, c });
      }));
      const tier = tiers.find(t => t.length);
      return tier ? U.pick(tier, R) : null;
    }
    mostCommon() {
      const n = new Array(this.nColors).fill(0);
      this.allTiles().forEach(o => { if (!o.t.sp) n[o.t.color]++; });
      return n.indexOf(Math.max(...n));
    }
    activate(a) {
      const cells = [], { r, c } = a;
      const row = rr => { for (let i = 0; i < this.cols; i++) cells.push({ r: rr, c: i }); };
      const colm = cc => { for (let i = 0; i < this.rows; i++) cells.push({ r: i, c: cc }); };
      switch (a.sp) {
        case 'point': return { cells: [{ r, c }], wait: 0 };
        case 'h': row(r); this.fx.push(new Dragonfly(c, r, 1, 0), new Dragonfly(c, r, -1, 0)); Sfx.rocket(); return { cells, wait: 200 };
        case 'v': colm(c); this.fx.push(new Dragonfly(c, r, 0, 1), new Dragonfly(c, r, 0, -1)); Sfx.rocket(); return { cells, wait: 200 };
        case 'cross': row(r); colm(c); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) this.fx.push(new Dragonfly(c, r, dx, dy)); Sfx.rocket(); return { cells, wait: 240 };
        case 'cross3':
          for (let k = -1; k <= 1; k++) { row(r + k); colm(c + k); for (const [dx, dy] of [[1, 0], [-1, 0]]) this.fx.push(new Dragonfly(c, r + k, dx, dy)); for (const [dx, dy] of [[0, 1], [0, -1]]) this.fx.push(new Dragonfly(c + k, r, dx, dy)); }
          Sfx.rocket(); Sfx.bomb(); return { cells: cells.filter(p => this.cell(p.r, p.c)), wait: 300 };
        case 'bomb': {
          const rad = a.rad || 2.25;
          for (let dr = -4; dr <= 4; dr++) for (let dc = -4; dc <= 4; dc++) if (dr * dr + dc * dc <= rad * rad) cells.push({ r: r + dr, c: c + dc });
          this.fx.push(new Ring(c, r, rad + .6)); this.burst(c, r, '#8a6232', 26, 'dot'); this.burst(c, r, '#6cd04a', 16, 'leaf'); Sfx.bomb();
          this.ui.onShake && this.ui.onShake();
          return { cells: cells.filter(p => this.cell(p.r, p.c)), wait: 260 };
        }
        case 'fly': case 'fly3': {
          for (const [dr, dc] of N4) cells.push({ r: r + dr, c: c + dc });
          const ex = new Set(cells.map(p => p.r * 64 + p.c)), acts = [];
          for (let i = 0; i < (a.sp === 'fly3' ? 3 : 1); i++) {
            const t = this.pickTarget(ex); if (!t) break; ex.add(t.r * 64 + t.c);
            this.fx.push(new Butterfly(c, r, t.c, t.r, a.carry));
            acts.push({ r: t.r, c: t.c, sp: a.carry || 'point' });
          }
          Sfx.flutter();
          return { cells: cells.filter(p => this.cell(p.r, p.c)), acts, wait: 620 };
        }
        case 'rainbow': {
          const k = a.color != null && a.color >= 0 ? a.color : this.mostCommon(), acts = [];
          Sfx.rainbow();
          this.allTiles().forEach(o => {
            if (o.t.sp || o.t.color !== k) return;
            this.fx.push(new Beam(c, r, o.c, o.r, TILE_COLORS[k]));
            if (a.convert) {
              const sp = a.convert === 'h' || a.convert === 'v' ? (this.R() < .5 ? 'h' : 'v') : a.convert;
              o.t.sp = sp; o.t.color = -1; o.t.pop = .3; o.t.fired = true; acts.push({ r: o.r, c: o.c, sp, kill: true });
            } else cells.push({ r: o.r, c: o.c });
          });
          if (a.convert) { return { cells: acts.map(x => ({ r: x.r, c: x.c })), acts: acts.map(x => ({ r: x.r, c: x.c, sp: x.sp })), wait: 520 }; }
          return { cells, wait: 480 };
        }
        case 'all': {
          for (let i = 0; i < this.rows; i++) for (let j = 0; j < this.cols; j++) cells.push({ r: i, c: j });
          this.fx.push(new Ring(c, r, 12)); Sfx.rainbow(); Sfx.bomb(); this.ui.onShake && this.ui.onShake();
          return { cells, wait: 600 };
        }
      }
      return { cells, wait: 0 };
    }
    /* ---------- gravity ---------- */
    canReceive(r, c) {
      let rr = r - 1; while (rr >= 0 && !this.cells[rr][c].on) rr--;
      if (rr < 0) return true;
      const s = this.cells[rr][c];
      if (s.pot || s.vine) return false;
      return s.tile ? true : this.canReceive(rr, c);
    }
    async settle() {
      const R = this.rows, C = this.cols, spawned = new Array(C).fill(0);
      const firstRow = c => { for (let r = 0; r < R; r++) if (this.cells[r][c].on) return r; return 0; };
      for (let guard = 0, moved = true; moved && guard < 500; guard++) {
        moved = false;
        for (let r = R - 1; r >= 0; r--) for (let c = 0; c < C; c++) {
          const cl = this.cells[r][c]; if (!cl.on || cl.pot || cl.tile) continue;
          let rr = r - 1; while (rr >= 0 && !this.cells[rr][c].on) rr--;
          if (rr < 0) { const t = this.newTile(this.randColor(), null, firstRow(c) - 1 - spawned[c]++, c); cl.tile = t; moved = true; continue; }
          const src = this.cells[rr][c];
          if (src.tile && !src.vine && !src.pot) { cl.tile = src.tile; src.tile = null; moved = true; }
        }
        if (moved) continue;
        outer: for (let r = R - 1; r > 0; r--) for (let c = 0; c < C; c++) {
          const cl = this.cells[r][c]; if (!cl.on || cl.pot || cl.tile || this.canReceive(r, c)) continue;
          for (const dc of this.R() < .5 ? [-1, 1] : [1, -1]) {
            const src = this.cell(r - 1, c + dc);
            if (src && src.on && src.tile && !src.vine && !src.pot) { cl.tile = src.tile; src.tile = null; moved = true; break outer; }
          }
        }
      }
      this.cells.forEach((row, r) => row.forEach((cl, c) => {
        const t = cl.tile; if (!t) return;
        t.tx = c; t.ty = r;
        if (t.x !== c || t.y !== r) t.anim = { type: 'fall', v: t.anim && t.anim.type === 'fall' ? t.anim.v : 1.5 };
      }));
      await this.waitAnims();
    }
    tween(t, c, r, d) { t.anim = { type: 'tween', fx: t.x, fy: t.y, t: 0, d }; t.tx = c; t.ty = r; }
    waitAnims() {
      return new Promise(res => {
        const chk = () => {
          const busy = this.allTiles().some(o => o.t.anim) || this.dying.length > 0 && this.dying.some(d => d.t < .5);
          if (!busy || !this.running) res(); else requestAnimationFrame(chk);
        };
        chk();
      });
    }
    async bloomBonus() {
      this.ui.onBonus && this.ui.onBonus();
      this.coins = 20 + this.moves * 12;
      await sleep(500);
      while (this.moves > 0) {
        const pool = this.allTiles().filter(o => !o.t.sp && !o.cell.vine);
        if (!pool.length) break;
        const o = U.pick(pool, this.R);
        o.t.sp = this.R() < .5 ? 'h' : 'v'; o.t.color = -1; o.t.pop = 0;
        this.burst(o.c, o.r, '#fff6c0', 10); Sfx.create(); this.useMove();
        await sleep(110);
      }
      for (let k = 0; k < 4; k++) {
        const sps = this.allTiles().filter(o => o.t.sp && !o.cell.vine);
        if (!sps.length) break;
        const acts = sps.map(o => { o.t.fired = true; this.kill(o.r, o.c, true); return { r: o.r, c: o.c, sp: o.t.sp }; });
        await this.blast([], acts);
        await this.settle(); await this.resolve(null);
      }
      await sleep(300);
    }
    /* ---------- effects ---------- */
    burst(c, r, color, n, shape = 'leaf') {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 4;
        this.fx.push(new Particle(c + .5, r + .5, Math.cos(a) * s, Math.sin(a) * s - 2, color, shape));
      }
    }
    /* ---------- loop ---------- */
    loop(now) {
      if (!this.running) return;
      const dt = Math.min(.05, (now - this.last) / 1000); this.last = now;
      this.update(dt); this.draw(now / 1000);
      requestAnimationFrame(this.loop);
    }
    update(dt) {
      for (const o of this.allTiles()) {
        const t = o.t;
        if (t.pop < 1) t.pop = Math.min(1, t.pop + dt * 5);
        if (t.land) t.land = Math.max(0, t.land - dt * 5);
        const a = t.anim; if (!a) continue;
        if (a.type === 'tween') {
          a.t += dt; const k = Math.min(1, a.t / a.d), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          t.x = U.lerp(a.fx, t.tx, e); t.y = U.lerp(a.fy, t.ty, e);
          if (k >= 1) t.anim = null;
        } else {
          if (a.delay > 0) { a.delay -= dt; continue; }
          a.v = Math.min(22, a.v + 55 * dt);
          const dx = t.tx - t.x, dy = t.ty - t.y, d = Math.hypot(dx, dy), step = a.v * dt;
          if (d <= step) { t.x = t.tx; t.y = t.ty; t.anim = null; t.land = 1; }
          else { t.x += dx / d * step; t.y += dy / d * step; }
        }
      }
      for (const d of this.dying) d.t += dt * 4;
      this.dying = this.dying.filter(d => d.t < 1);
      this.fx = this.fx.filter(f => f.update(dt));
      if (!this.busy && this.state === 'play') {
        this.idle += dt;
        if (this.idle > 5 && !this.hint) this.hint = this.findMove();
      }
    }
    draw(time) {
      const ctx = this.ctx, cs = this.cs, dpr = this.dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, this.cv.width, this.cv.height);
      if (!this.rows) return;
      ctx.save(); ctx.translate(this.ox, this.oy);
      // board bed
      ctx.fillStyle = 'rgba(30,48,22,.55)';
      this.cells.forEach((row, r) => row.forEach((cl, c) => { if (cl.on) { roundRect(ctx, c * cs - 4, r * cs - 4, cs + 8, cs + 8, cs * .2); ctx.fill(); } }));
      this.cells.forEach((row, r) => row.forEach((cl, c) => {
        if (!cl.on) return;
        ctx.fillStyle = (r + c) % 2 ? 'rgba(232,240,214,.88)' : 'rgba(214,228,192,.88)';
        roundRect(ctx, c * cs + 1, r * cs + 1, cs - 2, cs - 2, cs * .14); ctx.fill();
        if (cl.moss) ctx.drawImage(Sprites.cache['moss' + cl.moss], c * cs, r * cs, cs, cs);
      }));
      // tiles (clipped to the board area so spawns slide in from above)
      ctx.save(); ctx.beginPath(); ctx.rect(-10, 0, this.cols * cs + 20, this.rows * cs + 10); ctx.clip();
      const hintIds = this.hint ? this.hint.map(p => this.cells[p.r][p.c].tile && this.cells[p.r][p.c].tile.id) : [];
      for (const o of this.allTiles()) {
        const t = o.t, key = t.sp || 'c' + t.color, img = Sprites.cache[key]; if (!img) continue;
        let s = cs * (t.pop < 1 ? easeBack(t.pop) : 1), sx = s, sy = s, ox = 0;
        if (t.land) { sx *= 1 + t.land * .08; sy *= 1 - t.land * .1; }
        if (this.sel && this.sel.r === o.r && this.sel.c === o.c) { const p = 1 + Math.sin(time * 10) * .06; sx *= p; sy *= p; }
        if (hintIds.includes(t.id)) ox = Math.sin(time * 14) * cs * .05;
        if (t.sp && !t.anim) { const p = 1 + Math.sin(time * 5 + t.id) * .05; sx *= p; sy *= p; }
        const cx = (t.x + .5) * cs + ox, cy = (t.y + .5) * cs + (t.land ? t.land * cs * .05 : 0);
        ctx.drawImage(img, cx - sx / 2, cy - sy / 2 + (s - sy) / 2, sx, sy);
      }
      ctx.restore();
      this.cells.forEach((row, r) => row.forEach((cl, c) => {
        if (cl.pot) ctx.drawImage(Sprites.cache['pot' + cl.pot], c * cs, r * cs, cs, cs);
        if (cl.vine) ctx.drawImage(Sprites.cache.vine, c * cs, r * cs, cs, cs);
      }));
      for (const d of this.dying) {
        const img = Sprites.cache[d.key]; if (!img) continue;
        const s = cs * (1 + d.t * .4); ctx.globalAlpha = 1 - d.t;
        ctx.drawImage(img, (d.x + .5) * cs - s / 2, (d.y + .5) * cs - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
      if (this.sel) { ctx.strokeStyle = '#fff6c0'; ctx.lineWidth = 3; roundRect(ctx, this.sel.c * cs + 3, this.sel.r * cs + 3, cs - 6, cs - 6, cs * .16); ctx.stroke(); }
      for (const f of this.fx) f.draw(ctx, cs, this);
      ctx.restore();
    }
  }
  const easeBack = k => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };

  /* ───────────── Effect objects (board cell units) ───────────── */
  class Particle {
    constructor(x, y, vx, vy, color, shape) { Object.assign(this, { x, y, vx, vy, color, shape, life: 1, rot: Math.random() * 6, vr: (Math.random() - .5) * 12, size: .06 + Math.random() * .08 }); }
    update(dt) { this.vy += 9 * dt; this.x += this.vx * dt; this.y += this.vy * dt; this.rot += this.vr * dt; this.life -= dt * 1.4; return this.life > 0; }
    draw(ctx, cs) {
      ctx.save(); ctx.globalAlpha = Math.max(0, this.life); ctx.translate(this.x * cs, this.y * cs); ctx.rotate(this.rot); ctx.fillStyle = this.color;
      const s = this.size * cs;
      if (this.shape === 'leaf') { ctx.beginPath(); ctx.ellipse(0, 0, s * 1.4, s * .6, 0, 0, 7); ctx.fill(); }
      else if (this.shape === 'shard') { ctx.beginPath(); ctx.moveTo(-s, -s * .6); ctx.lineTo(s, -s * .2); ctx.lineTo(0, s); ctx.closePath(); ctx.fill(); }
      else { ctx.beginPath(); ctx.arc(0, 0, s * .8, 0, 7); ctx.fill(); }
      ctx.restore();
    }
  }
  class Dragonfly {
    constructor(x, y, dx, dy) { Object.assign(this, { x: x + .5, y: y + .5, x0: x + .5, y0: y + .5, dx, dy, t: 0 }); }
    update(dt) { this.t += dt; this.x += this.dx * dt * 24; this.y += this.dy * dt * 24; return this.t < .7; }
    draw(ctx, cs) {
      const g = ctx.createLinearGradient(this.x0 * cs, this.y0 * cs, this.x * cs, this.y * cs);
      g.addColorStop(0, 'rgba(120,255,220,0)'); g.addColorStop(1, 'rgba(200,255,240,.85)');
      ctx.strokeStyle = g; ctx.lineWidth = cs * .22; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(this.x0 * cs, this.y0 * cs); ctx.lineTo(this.x * cs, this.y * cs); ctx.stroke();
      ctx.save(); ctx.translate(this.x * cs, this.y * cs); ctx.rotate(Math.atan2(this.dy, this.dx));
      ctx.drawImage(Sprites.cache.h, -cs * .6, -cs * .6, cs * 1.2, cs * 1.2); ctx.restore();
    }
  }
  class Sweep {
    constructor(r, cols) { this.r = r; this.cols = cols; this.t = 0; }
    update(dt) { this.t += dt; return this.t < .5; }
    draw(ctx, cs) { ctx.fillStyle = `rgba(255,250,210,${(1 - this.t * 2) * .7})`; ctx.fillRect(0, this.r * cs, this.cols * cs * Math.min(1, this.t * 4), cs); }
  }
  class Ring {
    constructor(x, y, rad) { Object.assign(this, { x: x + .5, y: y + .5, rad, t: 0 }); }
    update(dt) { this.t += dt * 2.2; return this.t < 1; }
    draw(ctx, cs) {
      ctx.save(); ctx.globalAlpha = 1 - this.t; ctx.strokeStyle = '#fff3c0'; ctx.lineWidth = cs * .25 * (1 - this.t) + 2;
      ctx.beginPath(); ctx.arc(this.x * cs, this.y * cs, this.rad * cs * this.t, 0, 7); ctx.stroke();
      ctx.fillStyle = 'rgba(255,220,140,.25)'; ctx.fill(); ctx.restore();
    }
  }
  class Butterfly {
    constructor(x, y, tx, ty, carry) { Object.assign(this, { x0: x + .5, y0: y + .5, x1: tx + .5, y1: ty + .5, t: 0, carry, side: Math.random() < .5 ? -1 : 1 }); }
    update(dt) { this.t += dt / .6; return this.t < 1; }
    draw(ctx, cs) {
      const k = this.t, e = k * k * (3 - 2 * k), mx = (this.x0 + this.x1) / 2 + this.side * 2.5, my = Math.min(this.y0, this.y1) - 2;
      const x = (1 - e) * (1 - e) * this.x0 + 2 * (1 - e) * e * mx + e * e * this.x1, y = (1 - e) * (1 - e) * this.y0 + 2 * (1 - e) * e * my + e * e * this.y1;
      ctx.save(); ctx.translate(x * cs, y * cs); ctx.scale(Math.abs(Math.sin(k * 40)) * .5 + .6, 1);
      ctx.drawImage(Sprites.cache.fly, -cs * .55, -cs * .55, cs * 1.1, cs * 1.1);
      if (this.carry && Sprites.cache[this.carry]) ctx.drawImage(Sprites.cache[this.carry], -cs * .3, cs * .05, cs * .6, cs * .6);
      ctx.restore();
    }
  }
  class Beam {
    constructor(x, y, tx, ty, col) { Object.assign(this, { x0: x + .5, y0: y + .5, x1: tx + .5, y1: ty + .5, col, t: 0 }); }
    update(dt) { this.t += dt * 2.2; return this.t < 1; }
    draw(ctx, cs) {
      ctx.save(); ctx.globalAlpha = 1 - this.t; ctx.strokeStyle = this.col; ctx.lineWidth = cs * .08; ctx.shadowColor = '#fff'; ctx.shadowBlur = 8;
      const k = Math.min(1, this.t * 3);
      ctx.beginPath(); ctx.moveTo(this.x0 * cs, this.y0 * cs); ctx.lineTo(U.lerp(this.x0, this.x1, k) * cs, U.lerp(this.y0, this.y1, k) * cs); ctx.stroke(); ctx.restore();
    }
  }
  class FloatText {
    constructor(text, x, y) { Object.assign(this, { text, x, y, t: 0 }); }
    update(dt) { this.t += dt * .8; return this.t < 1; }
    draw(ctx, cs) {
      ctx.save(); const s = Math.min(1, this.t * 5);
      ctx.globalAlpha = 1 - Math.max(0, this.t - .6) / .4;
      ctx.font = `800 ${Math.round(cs * .9 * s)}px Fraunces, Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = cs * .14; ctx.strokeStyle = '#1f4a18'; ctx.strokeText(this.text, this.x * cs, (this.y - this.t * .8) * cs);
      ctx.fillStyle = '#fff3b0'; ctx.fillText(this.text, this.x * cs, (this.y - this.t * .8) * cs); ctx.restore();
    }
  }

  return { Game, Sprites, TILE_NAMES, TILE_COLORS };
})();
