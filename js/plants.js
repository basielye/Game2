/* Procedural botanical illustration engine.
   Every leaf is built from a spline outline, a real lateral-vein skeleton, fenestrations
   cut along that skeleton (splits between veins, perforations beside the midrib),
   and variegation patterns that follow the venation. Plants are then assembled by growth form. */
const PlantArt = (() => {
  const { rng, mix, clamp, lerp, hashStr } = U;
  let UID = 0;
  const f = n => Math.round(n * 10) / 10;
  const f2 = n => Math.round(n * 100) / 100;
  const D2R = Math.PI / 180;

  /* Right-hand half outlines, tip (0,1) → base (0,0). x = half-width, y = position along the midrib. */
  const SHAPES = {
    monstera:    [[0, 1], [.2, .92], [.4, .76], [.52, .52], [.55, .28], [.5, .07], [.37, -.08], [.2, -.13], [.06, -.07], [0, 0]],
    cordate:     [[0, 1], [.14, .88], [.31, .67], [.42, .43], [.44, .2], [.38, .01], [.24, -.11], [.09, -.1], [0, 0]],
    elongCordate:[[0, 1], [.07, .88], [.16, .66], [.22, .42], [.25, .18], [.22, -.01], [.13, -.1], [.04, -.07], [0, 0]],
    ovate:       [[0, 1], [.11, .89], [.25, .68], [.33, .44], [.33, .22], [.24, .06], [.1, -.01], [0, 0]],
    elliptic:    [[0, 1], [.1, .91], [.22, .74], [.29, .52], [.29, .3], [.22, .1], [.09, .01], [0, 0]],
    lanceolate:  [[0, 1], [.05, .9], [.12, .7], [.17, .47], [.17, .25], [.12, .08], [.04, .01], [0, 0]],
    strap:       [[0, 1], [.04, .9], [.09, .68], [.12, .45], [.14, .2], [.13, .02], [.08, -.06], [.02, -.04], [0, 0]],
    sagittate:   [[0, 1], [.09, .84], [.19, .62], [.27, .38], [.32, .14], [.34, -.08], [.3, -.26], [.2, -.3], [.1, -.17], [0, 0]],
    stingray:    [[0, 1], [.02, .88], [.05, .76], [.2, .64], [.38, .48], [.44, .26], [.42, .04], [.33, -.14], [.18, -.18], [.07, -.08], [0, 0]],
    orbicular:   [[0, 1], [.24, .96], [.42, .82], [.51, .58], [.5, .32], [.4, .11], [.21, 0], [0, 0]],
    fiddle:      [[0, 1], [.25, .97], [.42, .84], [.44, .64], [.36, .5], [.3, .36], [.25, .18], [.13, .04], [0, 0]],
    obcordate:   [[0, .86], [.12, .97], [.3, .97], [.45, .82], [.47, .58], [.38, .32], [.22, .1], [.08, .01], [0, 0]]
  };

  function catmull(pts, seg) {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let s = 0; s < seg; s++) {
        const t = s / seg, t2 = t * t, t3 = t2 * t;
        const c = k => .5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
        out.push([c(0), c(1)]);
      }
    }
    out.push(pts[pts.length - 1].slice());
    return out;
  }
  function pip(x, y, poly) {
    let ins = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) ins = !ins;
    }
    return ins;
  }
  const polyD = (pts, close = true) => 'M' + pts.map(p => f(p[0]) + ' ' + f(p[1])).join('L') + (close ? 'Z' : '');
  const qp = (v, u) => {
    const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
    return [a * v.s[0] + b * v.c[0] + c * v.e[0], a * v.s[1] + b * v.c[1] + c * v.e[1]];
  };
  const qt = (v, u) => [2 * (1 - u) * (v.c[0] - v.s[0]) + 2 * u * (v.e[0] - v.c[0]), 2 * (1 - u) * (v.c[1] - v.s[1]) + 2 * u * (v.e[1] - v.c[1])];
  const vpts = (v, u0, u1, n = 8) => { const o = []; for (let i = 0; i <= n; i++) o.push(qp(v, u0 + (u1 - u0) * i / n)); return o; };
  const lerpP = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

  /* ───────────── Leaf geometry ───────────── */
  function buildLeaf(spec, L, R) {
    const W = L * (spec.w || 1);
    let right = catmull(SHAPES[spec.shape] || SHAPES.cordate, 7).map(p => [p[0] * W, -p[1] * L]);
    const mg = spec.margin;
    if (mg) {
      const N = right.length, phase = R() * 2;
      right = right.map((p, i) => {
        if (i === 0 || i === N - 1) return p;
        const t = i / (N - 1), taper = Math.sin(Math.PI * t);
        const dx = p[0], dy = p[1] + L * .45, d = Math.hypot(dx, dy) || 1;
        const s = Math.sin(t * Math.PI * mg.freq + phase);
        const off = (mg.type === 'scallop' ? -Math.abs(s) : s) * mg.amp * L * taper;
        return [p[0] + dx / d * off, p[1] + dy / d * off];
      });
    }
    const ls = 1 - (spec.asym || 0) * (.4 + R() * .6);
    const left = right.map(p => [-p[0] * ls, p[1]]).reverse();
    const outline = right.concat(left.slice(1));
    // lateral vein skeleton
    const vn = spec.veins ? spec.veins.n : 6, k = (spec.veins && spec.veins.k) || .7;
    const veins = [], bySide = { 1: [], '-1': [] };
    for (const side of [1, -1]) {
      for (let i = 0; i < vn; i++) {
        const off = side < 0 ? .45 / vn : 0;
        const fr = clamp(.07 + .86 * ((i + .5) / vn) + off * (.6 + R() * .5) + (R() - .5) * .04, .05, .96);
        const E = right[Math.round(fr * (right.length - 1))];
        const ex = E[0] * (side > 0 ? 1 : ls) * side, ey = E[1];
        const sy = clamp(ey + Math.abs(ex) * k, -L * .94, 0);
        const v = { side, i, s: [0, sy], c: [ex * .5, sy + (ey - sy) * .2], e: [ex, ey] };
        veins.push(v); bySide[side].push(v);
      }
    }
    let bx0 = 1e9, bx1 = -1e9, by0 = 1e9, by1 = -1e9;
    for (const p of outline) { bx0 = Math.min(bx0, p[0]); bx1 = Math.max(bx1, p[0]); by0 = Math.min(by0, p[1]); by1 = Math.max(by1, p[1]); }
    return { L, W, right, left, outline, veins, bySide, ls, bx0, bx1, by0, by1, dOut: polyD(outline) };
  }

  /* ───────────── Variegation & pattern painters (all drawn inside the leaf mask) ───────────── */
  const VAR = {
    speckle(g) {
      let s = '', k = 0, tries = 0; const n = Math.round(160 * g.amt), sc = g.L / 110, R = g.R;
      while (k < n && tries++ < n * 5) {
        const x = lerp(g.bx0, g.bx1, R()), y = lerp(g.by0, g.by1, R());
        if (!g.inside(x, y)) continue; k++;
        const ang = (x >= 0 ? -38 : -142) + (R() - .5) * 44, big = R() < .08;
        const rx = (big ? 5 + R() * 10 : 1.1 + R() * 3.8) * sc, ry = rx * (.2 + R() * .32);
        const col = R() < .3 ? mix(g.col, '#ffffff', .45) : g.col;
        s += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}" transform="rotate(${f(ang)} ${f(x)} ${f(y)})" fill="${col}" opacity="${f2(.75 + R() * .25)}"/>`;
      }
      return s;
    },
    sectoral(g) {
      let s = ''; const R = g.R, sc = g.L / 110, col2 = g.col2 || g.col;
      if (R() < .24 * g.amt) s += `<path d="${polyD(R() < .5 ? g.right : g.left)}" fill="${g.col}"/>`;
      const nSec = 1 + Math.floor(R() * 2.4 * g.amt + .3);
      for (let k = 0; k < nSec; k++) {
        const vs = g.bySide[R() < .5 ? 1 : -1]; if (vs.length < 2) continue;
        let j = Math.floor(R() * vs.length), i = Math.max(0, j - 1 - Math.floor(R() * 2.2));
        if (i === j) j = Math.min(vs.length - 1, i + 1);
        const u0 = R() < .5 ? 0 : .15 + R() * .3;
        const pts = vpts(vs[i], u0, 1.3, 10).concat(vpts(vs[j], u0, 1.3, 10).reverse());
        const c = R() < .7 ? g.col : col2;
        s += `<path d="${polyD(pts)}" fill="${c}" stroke="${c}" stroke-width="${f(2.5 * sc)}" stroke-linejoin="round" opacity=".97"/>`;
      }
      const ns = Math.round(16 * g.amt);
      for (let k = 0; k < ns; k++) {
        const v = g.veins[Math.floor(R() * g.veins.length)], u0 = R() * .7, u1 = Math.min(1.2, u0 + .15 + R() * .5);
        const ox = (R() - .5) * g.L * .08, oy = (R() - .5) * g.L * .05;
        const pts = vpts(v, u0, u1, 6).map(p => [p[0] + ox, p[1] + oy]);
        s += `<path d="${polyD(pts, false)}" stroke="${R() < .6 ? g.col : col2}" stroke-width="${f((.8 + R() * 3.8) * sc)}" fill="none" stroke-linecap="round" opacity=".92"/>`;
      }
      return s + VAR.dots(g, Math.round(26 * g.amt));
    },
    dots(g, n) {
      let s = '', k = 0, tries = 0; const R = g.R, sc = g.L / 110;
      while (k < n && tries++ < n * 5) {
        const x = lerp(g.bx0, g.bx1, R()), y = lerp(g.by0, g.by1, R());
        if (!g.inside(x, y)) continue; k++;
        s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f((.6 + R() * 1.6) * sc)}" fill="${g.col}" opacity="${f2(.6 + R() * .4)}"/>`;
      }
      return s;
    },
    silver(g) {
      let s = `<path d="${g.dOut}" fill="${g.col}" opacity="${f2(.78 * g.amt)}"/>`;
      s += `<path d="M0 0L0 ${f(-g.L)}" stroke="${g.dark}" stroke-width="${f(g.L * .07)}" opacity=".35"/>`;
      for (const v of g.veins) s += `<path d="${polyD(vpts(v, 0, 1, 6), false)}" stroke="${g.dark}" stroke-width="${f(g.L * .045)}" fill="none" opacity=".28" stroke-linecap="round"/>`;
      return s;
    },
    marble(g) {
      let s = ''; const R = g.R, sc = g.L / 110, n = Math.round(46 * g.amt), col2 = g.col2 || mix(g.col, '#ffffff', .4);
      for (let k = 0; k < n; k++) {
        const v = g.veins[Math.floor(R() * g.veins.length)], u0 = R() * .85, u1 = Math.min(1.2, u0 + .08 + R() * .45);
        const ox = (R() - .5) * g.L * .13, oy = (R() - .5) * g.L * .07;
        const pts = vpts(v, u0, u1, 6).map((p, i) => [p[0] + ox + (R() - .5) * 2 * sc, p[1] + oy + (R() - .5) * 2 * sc]);
        s += `<path d="${polyD(pts, false)}" stroke="${R() < .7 ? g.col : col2}" stroke-width="${f((1 + R() * 5.5) * sc)}" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="${f2(.8 + R() * .2)}"/>`;
      }
      let k = 0, tries = 0; const nb = Math.round(9 * g.amt);
      while (k < nb && tries++ < 60) {
        const x = lerp(g.bx0, g.bx1, R()), y = lerp(g.by0, g.by1, R());
        if (!g.inside(x, y)) continue; k++;
        const rx = (3 + R() * 9) * sc;
        s += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(rx * (.35 + R() * .4))}" transform="rotate(${f((x > 0 ? -40 : -140) + (R() - .5) * 50)} ${f(x)} ${f(y)})" fill="${R() < .5 ? g.col : col2}" opacity=".9"/>`;
      }
      return s;
    },
    streaks(g) {
      let s = ''; const R = g.R, sc = g.L / 110, n = Math.round(60 * g.amt);
      for (let k = 0; k < n; k++) {
        const v = g.veins[Math.floor(R() * g.veins.length)], u0 = R() * .8, u1 = Math.min(1.15, u0 + .1 + R() * .5);
        const ox = (R() - .5) * g.L * .06, oy = (R() - .5) * g.L * .06;
        s += `<path d="${polyD(vpts(v, u0, u1, 5).map(p => [p[0] + ox, p[1] + oy]), false)}" stroke="${g.col}" stroke-width="${f((.5 + R() * (R() < .15 ? 6 : 2.2)) * sc)}" fill="none" stroke-linecap="round" opacity="${f2(.75 + R() * .25)}"/>`;
      }
      return s + VAR.dots(g, Math.round(30 * g.amt));
    },
    pinstripe(g) {
      let s = ''; const R = g.R, sc = g.L / 110;
      for (const side of [1, -1]) {
        const vs = g.bySide[side];
        for (let i = 0; i < vs.length - 1; i++) for (let m = 1; m <= 3; m++) {
          const fr = m / 4 + (R() - .5) * .1, u0 = .05 + R() * .2, u1 = .85 + R() * .25, pts = [];
          for (let k = 0; k <= 8; k++) { const u = u0 + (u1 - u0) * k / 8; pts.push(lerpP(qp(vs[i], u), qp(vs[i + 1], u), fr)); }
          s += `<path d="${polyD(pts, false)}" stroke="${g.col}" stroke-width="${f((.5 + R() * 1.1) * sc)}" fill="none" stroke-linecap="round" opacity="${f2(.6 + R() * .35)}"/>`;
        }
      }
      return s;
    },
    margin(g) {
      const w = g.L * g.amt;
      let s = '';
      if (g.col2) s += `<path d="${g.dOut}" fill="none" stroke="${g.col2}" stroke-width="${f(w * 1.7)}" stroke-linejoin="round" opacity=".85"/>`;
      return s + `<path d="${g.dOut}" fill="none" stroke="${g.col}" stroke-width="${f(w)}" stroke-linejoin="round"/>`;
    },
    glitter(g) {
      let s = '', k = 0, tries = 0; const R = g.R, sc = g.L / 110, n = Math.round(240 * g.amt);
      while (k < n && tries++ < n * 4) {
        const x = lerp(g.bx0, g.bx1, R()), y = lerp(g.by0, g.by1, R());
        if (!g.inside(x, y)) continue; k++;
        s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f((.25 + R() * .7) * sc)}" fill="${g.col}" opacity="${f2(.25 + R() * .6)}"/>`;
      }
      return s;
    },
    veinband(g) {
      let s = '';
      for (const v of g.veins) s += `<path d="${polyD(vpts(v, 0, 1, 6), false)}" stroke="${g.col}" stroke-width="${f(g.L * .075)}" fill="none" stroke-linecap="round" opacity="${f2(.5 * g.amt + .2)}"/>`;
      return s + `<path d="M0 0L0 ${f(-g.L * .95)}" stroke="${g.col}" stroke-width="${f(g.L * .09)}" opacity=".45" stroke-linecap="round"/>`;
    },
    sheen(g) {
      return `<defs><radialGradient id="${g.id}sh" cx=".3" cy=".35" r=".75"><stop offset="0" stop-color="${g.col}" stop-opacity="${f2(g.amt)}"/><stop offset="1" stop-color="${g.col}" stop-opacity="0"/></radialGradient></defs><path d="${g.dOut}" fill="url(#${g.id}sh)"/>`;
    },
    center(g) {
      const R = g.R, ptsR = [], ptsL = [], n = 14, ph = R() * 6, amp = g.W * .16 * g.amt;
      for (let i = 0; i <= n; i++) {
        const t = i / n, y = lerp(g.L * .05, -g.L * .92, t);
        const w = amp * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (.65 + .35 * Math.sin(t * 9 + ph)) + 1;
        ptsR.push([w * (1 + (R() - .5) * .5), y]); ptsL.push([-w * (1 + (R() - .5) * .5), y]);
      }
      let s = `<path d="${polyD(ptsR.concat(ptsL.reverse()))}" fill="${g.col2 || g.col}" opacity=".9"/>`;
      s += `<path d="${polyD(ptsR.map(p => [p[0] * .55, p[1]]).concat(ptsR.map(p => [-p[0] * .5, p[1]]).reverse()))}" fill="${g.col}"/>`;
      for (const v of g.veins) if (R() < .6) s += `<path d="${polyD(vpts(v, 0, .25 + R() * .3, 4), false)}" stroke="${g.col}" stroke-width="${f(g.L * .025)}" fill="none" stroke-linecap="round" opacity=".85"/>`;
      return s;
    },
    spots(g) {
      let s = '', k = 0, tries = 0; const R = g.R, sc = g.L / 60, n = Math.round(42 * g.amt);
      while (k < n && tries++ < n * 5) {
        const x = lerp(g.bx0, g.bx1, R()), y = lerp(g.by0, g.by1, R());
        if (!g.inside(x, y)) continue; k++;
        const r = (.7 + R() * (R() < .2 ? 3.2 : 1.6)) * sc;
        s += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(r)}" ry="${f(r * (.6 + R() * .4))}" fill="${g.col}" opacity="${f2(.55 + R() * .4)}"/>`;
      }
      return s;
    },
    dew(g) {
      let s = '', k = 0, tries = 0; const R = g.R, sc = g.L / 110, n = Math.round(14 * g.amt);
      while (k < n && tries++ < 80) {
        const x = lerp(g.bx0, g.bx1, R()), y = lerp(g.by0, g.by1, R());
        if (!g.inside(x, y)) continue; k++;
        const r = (1.5 + R() * 3.5) * sc;
        s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="#ffffff" opacity=".18"/><circle cx="${f(x - r * .35)}" cy="${f(y - r * .35)}" r="${f(r * .3)}" fill="#ffffff" opacity=".8"/>`;
      }
      return s + `<path d="${g.dOut}" fill="#b9a7c9" opacity=".08"/>`;
    },
    stripes(g) {
      let s = '';
      for (const side of [1, -1]) {
        const vs = g.bySide[side];
        vs.forEach((v, i) => {
          s += `<path d="${polyD(vpts(v, .03, 1.05, 8), false)}" stroke="${g.col}" stroke-width="${f(g.L * .05)}" fill="none" stroke-linecap="round" opacity="${f2(.62 * g.amt + .1)}"/>`;
          if (i < vs.length - 1) {
            const pts = []; for (let k = 0; k <= 8; k++) { const u = .05 + k / 8; pts.push(lerpP(qp(v, u), qp(vs[i + 1], u), .5)); }
            s += `<path d="${polyD(pts, false)}" stroke="${g.dark}" stroke-width="${f(g.L * .02)}" fill="none" opacity=".18"/>`;
          }
        });
      }
      return s;
    },
    feather(g) {
      const R = g.R; let s = '';
      const zone = (uIn, uOut) => {
        const r = g.bySide[1].flatMap((v, i, a) => i < a.length - 1 ? [qp(v, uOut + R() * .06), lerpP(qp(v, uIn), qp(a[i + 1], uIn), .5)] : [qp(v, uOut)]);
        const l = g.bySide[-1].flatMap((v, i, a) => i < a.length - 1 ? [qp(v, uOut + R() * .06), lerpP(qp(v, uIn), qp(a[i + 1], uIn), .5)] : [qp(v, uOut)]);
        return [[0, -g.L * .93]].concat(r, [[0, g.L * .02]], l.reverse());
      };
      s += `<path d="${polyD(zone(.3, .5))}" fill="${g.col}" opacity=".92"/>`;
      s += `<path d="${polyD(zone(.12, .24))}" fill="${g.col2 || g.col}" opacity=".9"/>`;
      for (const v of g.veins) s += `<path d="${polyD(vpts(v, .64, .84, 4), false)}" stroke="${g.col}" stroke-width="${f(g.L * .035)}" fill="none" stroke-linecap="round" opacity=".85"/>`;
      return s;
    },
    peacock(g) {
      const R = g.R; let s = '';
      for (const side of [1, -1]) {
        g.bySide[side].forEach((v, i, a) => {
          const big = i % 2 === 0, len = dist(v.s, v.e), p = qp(v, big ? .32 : .22), t = qt(v, .3);
          const ang = Math.atan2(t[1], t[0]) / D2R, rx = len * (big ? .3 : .17), ry = rx * (big ? .42 : .5);
          s += `<ellipse cx="${f(p[0])}" cy="${f(p[1])}" rx="${f(rx)}" ry="${f(ry)}" transform="rotate(${f(ang)} ${f(p[0])} ${f(p[1])})" fill="${g.col}" opacity=".85"/>`;
          if (i < a.length - 1) {
            const m = lerpP(qp(v, .86), qp(a[i + 1], .86), .5);
            s += `<ellipse cx="${f(m[0])}" cy="${f(m[1])}" rx="${f(len * .07)}" ry="${f(len * .045)}" transform="rotate(${f(ang)} ${f(m[0])} ${f(m[1])})" fill="${g.col}" opacity=".7"/>`;
          }
        });
      }
      return s + `<path d="${g.dOut}" fill="none" stroke="${g.col}" stroke-width="${f(g.L * .045)}" opacity=".55"/>`;
    },
    rattle(g) {
      let s = '';
      for (const side of [1, -1]) {
        g.bySide[side].forEach((v, i) => {
          const big = i % 2 === 0, len = dist(v.s, v.e), p = qp(v, big ? .42 : .3), t = qt(v, .3);
          const ang = Math.atan2(t[1], t[0]) / D2R, rx = len * (big ? .42 : .22), ry = rx * (big ? .5 : .55);
          s += `<ellipse cx="${f(p[0])}" cy="${f(p[1])}" rx="${f(rx)}" ry="${f(ry)}" transform="rotate(${f(ang)} ${f(p[0])} ${f(p[1])})" fill="${g.col}" opacity=".9"/>`;
        });
      }
      return s;
    },
    mosaic(g) {
      let s = ''; const R = g.R, st = g.L * .052;
      for (let y = g.by0; y < g.by1; y += st) for (let x = g.bx0; x < g.bx1; x += st) {
        const cx = x + st / 2, cy = y + st / 2;
        if (!g.inside(cx, cy)) continue;
        s += `<rect x="${f(x + st * .14)}" y="${f(y + st * .14)}" width="${f(st * .72)}" height="${f(st * .72)}" rx="${f(st * .12)}" fill="${g.col}" opacity="${f2(.35 + R() * .45)}"/>`;
      }
      return s;
    },
    herringbone(g) {
      const R = g.R; let s = '';
      const r = g.bySide[1].map(v => qp(v, .22 + R() * .08)), l = g.bySide[-1].map(v => qp(v, .22 + R() * .08));
      s += `<path d="${polyD([[0, -g.L * .9]].concat(r, [[0, 0]], l.reverse()))}" fill="${g.col}" opacity=".85"/>`;
      for (const side of [1, -1]) g.bySide[side].forEach((v, i, a) => {
        if (i >= a.length - 1 || i % 2) return;
        const m = lerpP(qp(v, .45), qp(a[i + 1], .45), .5), len = dist(v.s, v.e), t = qt(v, .45);
        s += `<ellipse cx="${f(m[0])}" cy="${f(m[1])}" rx="${f(len * .2)}" ry="${f(len * .12)}" transform="rotate(${f(Math.atan2(t[1], t[0]) / D2R)} ${f(m[0])} ${f(m[1])})" fill="${g.col2}" opacity=".75"/>`;
      });
      return s;
    },
    fishbone(g) {
      let s = '';
      for (const v of g.veins) s += `<path d="${polyD(vpts(v, 0, .82, 6), false)}" stroke="${g.col}" stroke-width="${f(g.L * .055)}" fill="none" stroke-linecap="round" opacity=".88"/>`;
      return s + `<path d="M0 0L0 ${f(-g.L * .95)}" stroke="${g.col}" stroke-width="${f(g.L * .06)}" opacity=".85"/>`;
    },
    arcs(g) {
      let s = '';
      for (const side of [1, -1]) for (const fr of [.22, .5, .78, 1.02]) {
        const cx = side * g.W * fr * .78 * (side < 0 ? g.ls : 1);
        s += `<path d="M0 ${f(g.L * .02)}Q${f(cx)} ${f(-g.L * .5)} 0 ${f(-g.L * .98)}" stroke="${g.col}" stroke-width="${f(g.L * .07)}" fill="none" opacity=".88"/>`;
      }
      return s;
    }
  };

  /* ───────────── Leaf renderer ───────────── */
  function leafSVG(spec, o) {
    const R = o.R, L = o.L, id = 'lf' + (++UID), mat = o.maturity == null ? 1 : o.maturity;
    const g = buildLeaf(spec, L, R);
    const sc = L / 110, flip = !!o.flip;
    const base = flip ? spec.under : spec.base;
    const light = flip ? mix(spec.under, '#ffffff', .2) : spec.light;
    const dark = flip ? mix(spec.under, '#000000', .3) : spec.dark;
    const VC = spec.veins || { n: 0, w: 0, op: 0, mid: 0, color: dark };
    const tex = spec.tex || 'gloss';
    let defs = `<linearGradient id="${id}g" gradientUnits="userSpaceOnUse" x1="${f(-g.W * .2)}" y1="0" x2="${f(g.W * .25)}" y2="${f(-L)}"><stop offset="0" stop-color="${dark}"/><stop offset=".45" stop-color="${base}"/><stop offset="1" stop-color="${light}"/></linearGradient>`;
    // fenestrations → mask
    let cut = '', cutEdge = '';
    const F = spec.fen;
    if (F && mat > 0) {
      for (const side of [1, -1]) {
        const vs = g.bySide[side];
        for (let i = 0; i < vs.length - 1; i++) {
          const a = vs[i], b = vs[i + 1];
          const mid = u => lerpP(qp(a, u), qp(b, u), .5);
          if (b.s[1] > -L * .03 && i > 0) continue; // keep the basal lobes intact
          const vlen = Math.min(dist(a.s, a.e), dist(b.s, b.e));
          if (F.splits && R() < F.splits * Math.min(1, mat * 1.2) && mat > .3) {
            const depth = clamp((.38 + R() * .42) * (F.splitDepth || .7) * (.45 + mat * .55), .1, .97);
            const u0 = 1 - depth, pts = [];
            for (let k = 0; k <= 9; k++) pts.push(mid(u0 + (1.18 - u0) * k / 9));
            const w = L * (F.splitW || .03) * (.65 + R() * .6);
            const d = polyD(pts, false);
            cut += `<path d="${d}" stroke="#000" stroke-width="${f(w)}" stroke-linecap="round" fill="none"/>`;
            cut += `<path d="${polyD(pts.slice(6), false)}" stroke="#000" stroke-width="${f(w * 1.8)}" stroke-linecap="round" fill="none"/>`;
            cutEdge += `<path d="${d}" stroke="${spec.edge || dark}" stroke-width="${f(w + 2.4 * sc)}" stroke-linecap="round" fill="none" opacity=".45"/>`;
          }
          for (const hu of (F.holes || [])) {
            if (R() >= (F.holeProb == null ? .7 : F.holeProb) * Math.min(1, mat * 1.15)) continue;
            const u = hu + (R() - .5) * .08, p = mid(u), gap = dist(qp(a, u), qp(b, u));
            const t1 = qt(a, u), t2 = qt(b, u), ang = Math.atan2(t1[1] + t2[1], t1[0] + t2[0]) / D2R;
            const rx = Math.min((F.holeLen || .07) * L * (.6 + R() * .6) * (.45 + .55 * mat), vlen * (F.rowSpan || .2), vlen * (.95 - u));
            const ry = Math.min(rx * (F.aspect || .5), gap * (F.maxFill || .34));
            if (ry < 1) continue;
            const e = `cx="${f(p[0])}" cy="${f(p[1])}" rx="${f(rx)}" ry="${f(ry)}" transform="rotate(${f(ang)} ${f(p[0])} ${f(p[1])})"`;
            cut += `<ellipse ${e} fill="#000"/>`;
            cutEdge += `<ellipse ${e} fill="none" stroke="${spec.edge || dark}" stroke-width="${f(2.4 * sc)}" opacity=".5"/>`;
          }
        }
      }
    }
    defs += `<mask id="${id}m" maskUnits="userSpaceOnUse" x="${f(g.bx0 - 20)}" y="${f(g.by0 - 20)}" width="${f(g.bx1 - g.bx0 + 40)}" height="${f(g.by1 - g.by0 + 40)}"><path d="${g.dOut}" fill="#fff"/>${cut}</mask>`;

    let body = `<path d="${g.dOut}" fill="url(#${id}g)"/>`;
    body += `<path d="${polyD(g.left)}" fill="#000" opacity="${flip ? .06 : .13}"/>`;
    // variegation
    const VS = spec.var;
    if (VS && !flip && VAR[VS.type]) {
      const gg = Object.assign({}, g, {
        R, id, col: VS.color, col2: VS.color2, amt: VS.amount == null ? 1 : VS.amount, dark,
        inside: (x, y) => pip(x, y, g.outline)
      });
      body += VAR[VS.type](gg);
    }
    // surface texture
    if (tex.startsWith('quilt')) {
      defs += `<radialGradient id="${id}q"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`;
      for (const side of [1, -1]) {
        const vs = g.bySide[side];
        for (let i = 0; i < vs.length - 1; i++) for (const u of [.35, .72]) {
          const p = lerpP(qp(vs[i], u), qp(vs[i + 1], u), .5), gap = dist(qp(vs[i], u), qp(vs[i + 1], u));
          const t = qt(vs[i], u), ang = Math.atan2(t[1], t[0]) / D2R;
          body += `<ellipse cx="${f(p[0])}" cy="${f(p[1])}" rx="${f(gap * .7)}" ry="${f(gap * .42)}" transform="rotate(${f(ang)} ${f(p[0])} ${f(p[1])})" fill="url(#${id}q)"/>`;
        }
      }
      for (const v of g.veins) body += `<path d="${polyD(vpts(v, 0, 1, 6), false)}" stroke="#000" stroke-width="${f(L * .04)}" fill="none" opacity=".2" stroke-linecap="round"/>`;
    }
    if (tex.includes('velvet')) {
      defs += `<radialGradient id="${id}v" cx=".5" cy=".55" r=".62"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".32"/></radialGradient>`;
      defs += `<radialGradient id="${id}vs" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`;
      body += `<path d="${g.dOut}" fill="url(#${id}v)"/><ellipse cx="${f(g.W * .12)}" cy="${f(-L * .5)}" rx="${f(g.W * .3)}" ry="${f(L * .4)}" fill="url(#${id}vs)"/>`;
    }
    if (tex.includes('gloss') || tex === 'waxy') {
      const op = tex === 'waxy' ? .5 : .34;
      defs += `<radialGradient id="${id}h" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity="${op}"/><stop offset=".6" stop-color="#fff" stop-opacity="${f2(op * .3)}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`;
      body += `<ellipse cx="${f(g.W * .17)}" cy="${f(-L * .6)}" rx="${f(Math.max(3, g.W * .17))}" ry="${f(L * .26)}" transform="rotate(14 ${f(g.W * .17)} ${f(-L * .6)})" fill="url(#${id}h)"/>`;
      body += `<ellipse cx="${f(-g.W * .16)}" cy="${f(-L * .35)}" rx="${f(Math.max(2, g.W * .08))}" ry="${f(L * .13)}" transform="rotate(-18 ${f(-g.W * .16)} ${f(-L * .35)})" fill="url(#${id}h)" opacity=".6"/>`;
    }
    // venation
    const vcol = flip ? mix(spec.under, '#ffffff', .3) : VC.color, vw = (VC.w || 1) * sc * 1.2, vop = flip ? .5 : VC.op;
    if (VC.n && vw > 0) {
      let vp = '';
      for (const v of g.veins) vp += `M0 ${f(v.s[1])}Q${f(v.c[0])} ${f(v.c[1])} ${f(v.e[0])} ${f(v.e[1])}`;
      if (VC.glow && !flip) body += `<path d="${vp}" stroke="${vcol}" stroke-width="${f(vw * 3.2)}" fill="none" opacity=".16"/>`;
      body += `<path d="${vp}" stroke="${vcol}" stroke-width="${f(vw)}" fill="none" opacity="${vop}" stroke-linecap="round"/>`;
      if (VC.collective) {
        for (const side of [1, -1]) {
          const vs = g.bySide[side]; if (vs.length < 2) continue;
          body += `<path d="${polyD(vs.map(v => qp(v, .9)), false)}" stroke="${vcol}" stroke-width="${f(vw * .55)}" fill="none" opacity="${f2(vop * .8)}"/>`;
        }
      }
      if (VC.net) {
        let np = '';
        for (const side of [1, -1]) {
          const vs = g.bySide[side];
          for (let i = 0; i < vs.length - 1; i++) for (const u of [.28, .52, .76, .95]) {
            const a = qp(vs[i], u + (R() - .5) * .08), b = qp(vs[i + 1], u + (R() - .5) * .08);
            np += `M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}`;
          }
          const v0 = vs[0]; if (v0) { const a = qp(v0, .5); np += `M${f(a[0])} ${f(a[1])}L0 ${f(-L * .95)}`; }
        }
        body += `<path d="${np}" stroke="${vcol}" stroke-width="${f(vw * .6)}" fill="none" opacity="${f2(vop * .85)}"/>`;
      }
      const mw = (VC.mid || 2) * sc * 1.1, mc = flip ? vcol : (VC.midColor || vcol);
      body += `<path d="M${f(-mw / 2)} ${f(L * .02)}L${f(-mw * .12)} ${f(-L * .96)}L${f(mw * .12)} ${f(-L * .96)}L${f(mw / 2)} ${f(L * .02)}Z" fill="${mc}" opacity="${f2(Math.min(1, vop + .2))}"/>`;
      body += `<path d="M${f(mw * .15)} 0L${f(mw * .05)} ${f(-L * .9)}" stroke="#fff" stroke-width="${f(mw * .25)}" opacity=".18"/>`;
    }
    body += cutEdge;
    body += `<path d="${g.dOut}" fill="none" stroke="${flip ? dark : (spec.edge || dark)}" stroke-width="${f(Math.max(.7, L * .014))}" opacity=".6"/>`;
    return `<defs>${defs}</defs><g mask="url(#${id}m)">${body}</g>`;
  }

  function placeLeaf(spec, x, y, rot, o) {
    return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)}) scale(${f2(o.sx || 1)} ${f2(o.sy || 1)})">${leafSVG(spec, o)}</g>`;
  }

  /* ───────────── Stems ───────────── */
  function stalk(x1, y1, cx, cy, x2, y2, w, color, opts = {}) {
    const d = `M${f(x1)} ${f(y1)}Q${f(cx)} ${f(cy)} ${f(x2)} ${f(y2)}`;
    let s = `<path d="${d}" stroke="${mix(color, '#000000', .35)}" stroke-width="${f(w + 1.4)}" fill="none" stroke-linecap="round"/>`;
    s += `<path d="${d}" stroke="${color}" stroke-width="${f(w)}" fill="none" stroke-linecap="round"/>`;
    if (opts.varCol) s += `<path d="${d}" stroke="${opts.varCol}" stroke-width="${f(w * .45)}" fill="none" stroke-dasharray="${f(6 + opts.R() * 14)} ${f(4 + opts.R() * 10)}" opacity=".9"/>`;
    if (opts.zebra) s += `<path d="${d}" stroke="#3b3a26" stroke-width="${f(w * .92)}" fill="none" stroke-dasharray="${f(1.4 + opts.R() * 1.6)} ${f(2.2 + opts.R() * 2.4)}" opacity=".85"/>`;
    s += `<path d="${d}" stroke="#fff" stroke-width="${f(Math.max(.4, w * .25))}" fill="none" opacity=".22" transform="translate(${f(-w * .2)} 0)"/>`;
    if (opts.hairy) {
      let h = '';
      for (let u = 0; u <= 1; u += .045) {
        const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
        const px = a * x1 + b * cx + c * x2, py = a * y1 + b * cy + c * y2, ang = opts.R() * Math.PI * 2, l = 2 + opts.R() * 3;
        h += `M${f(px)} ${f(py)}l${f(Math.cos(ang) * l)} ${f(Math.sin(ang) * l)}`;
      }
      s += `<path d="${h}" stroke="${opts.hairy}" stroke-width=".8" fill="none" opacity=".9"/>`;
    }
    return s;
  }
  function aerialRoot(x, y, dx, len, R) {
    const d = `M${f(x)} ${f(y)}Q${f(x + dx * .7)} ${f(y + len * .3)} ${f(x + dx)} ${f(y + len)}`;
    return `<path d="${d}" stroke="#5e4630" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="${d}" stroke="#8a6a48" stroke-width="1.6" fill="none" stroke-linecap="round"/><circle cx="${f(x + dx)}" cy="${f(y + len)}" r="1.2" fill="#d6c3a0"/>`;
  }

  /* ───────────── Pots ───────────── */
  const POTS = {
    terracotta: { name: 'Terracotta', stops: ['#8a4124', '#c56c40', '#d9895a', '#b45e36', '#7a381e'], rim: '#c8714a' },
    ceramic:    { name: 'White Ceramic', stops: ['#b4b0a7', '#e8e5de', '#fdfcf8', '#e2dfd8', '#a9a59c'], rim: '#f4f2ec' },
    concrete:   { name: 'Concrete', stops: ['#6e6e6a', '#9a9a95', '#b2b2ad', '#8f8f8a', '#5f5f5b'], rim: '#a8a8a3' },
    glazed:     { name: 'Reactive Glaze', stops: ['#163f48', '#22707a', '#3b9aa0', '#246f78', '#123740'], rim: '#2c7c84' },
    basket:     { name: 'Seagrass Basket', stops: ['#8a6434', '#bf9658', '#d6b077', '#b48a4f', '#7a5a2c'], rim: '#c9a064' },
    nursery:    { name: 'Nursery Pot', stops: ['#141414', '#2a2a2a', '#3a3a3a', '#262626', '#101010'], rim: '#2c2c2c' },
    blush:      { name: 'Blush Stoneware', stops: ['#b8857e', '#dfb0a7', '#efc8c0', '#d6a39a', '#a8746d'], rim: '#e6b9b1' },
    gilded:     { name: 'Gilded Black', stops: ['#0f0f10', '#2a2a2c', '#3c3c3f', '#232325', '#0b0b0c'], rim: '#c9a54a' }
  };
  function potSVG(style, S, R) {
    const P = POTS[style] || POTS.terracotta, id = 'pt' + (++UID);
    const rx = 60 * S, h = 95 * S, bx = 45 * S, ry = 9 * S, rim = 13 * S;
    let s = `<defs><linearGradient id="${id}b" x1="0" x2="1">${P.stops.map((c, i) => `<stop offset="${i / (P.stops.length - 1)}" stop-color="${c}"/>`).join('')}</linearGradient>`;
    s += `<radialGradient id="${id}o" cy=".3"><stop offset="0" stop-color="#1a120c"/><stop offset="1" stop-color="#3a2a1e"/></radialGradient></defs>`;
    s += `<ellipse cx="0" cy="${f(2 * S)}" rx="${f(bx * 1.15)}" ry="${f(6 * S)}" fill="#000" opacity=".22"/>`;
    s += `<path d="M${f(-rx * .95)} ${f(-h + rim)}L${f(-bx)} ${f(-5 * S)}Q${f(-bx)} 0 ${f(-bx + 6 * S)} 0L${f(bx - 6 * S)} 0Q${f(bx)} 0 ${f(bx)} ${f(-5 * S)}L${f(rx * .95)} ${f(-h + rim)}Z" fill="url(#${id}b)"/>`;
    // style details
    if (style === 'terracotta') {
      s += `<path d="M${f(-bx * 1.02)} ${f(-14 * S)}Q0 ${f(-8 * S)} ${f(bx * 1.02)} ${f(-14 * S)}L${f(bx)} ${f(-5 * S)}Q0 ${f(2 * S)} ${f(-bx)} ${f(-5 * S)}Z" fill="#efe6d6" opacity=".22"/>`;
      for (let i = 0; i < 5; i++) s += `<ellipse cx="${f((R() - .5) * bx * 1.6)}" cy="${f(-h * (.2 + R() * .45))}" rx="${f((3 + R() * 8) * S)}" ry="${f((2 + R() * 4) * S)}" fill="#fff" opacity=".07"/>`;
    } else if (style === 'concrete') {
      for (let i = 0; i < 40; i++) s += `<circle cx="${f((R() - .5) * bx * 1.9)}" cy="${f(-R() * (h - rim))}" r="${f(.5 + R() * 1.2)}" fill="${R() < .5 ? '#555' : '#ccc'}" opacity=".5"/>`;
    } else if (style === 'glazed') {
      for (let i = 0; i < 9; i++) {
        const x = -rx * .85 + i * rx * .21 + (R() - .5) * 6, l = (14 + R() * 26) * S;
        s += `<path d="M${f(x - 5 * S)} ${f(-h + rim)}L${f(x - 3 * S)} ${f(-h + rim + l)}Q${f(x)} ${f(-h + rim + l + 6 * S)} ${f(x + 3 * S)} ${f(-h + rim + l)}L${f(x + 5 * S)} ${f(-h + rim)}Z" fill="#8fd1cc" opacity=".55"/>`;
      }
    } else if (style === 'basket') {
      for (let y = -h + rim + 6 * S; y < -3; y += 7 * S) {
        const t = (y + h) / h, w = lerp(rx * .95, bx, clamp((y + h - rim) / (h - rim), 0, 1));
        s += `<path d="M${f(-w)} ${f(y)}Q0 ${f(y + 4 * S)} ${f(w)} ${f(y)}" stroke="#6b4a22" stroke-width="${f(1.1 * S)}" fill="none" opacity=".55"/>`;
        for (let x = -w + 4 * S; x < w; x += 8 * S) s += `<path d="M${f(x)} ${f(y + 1 * S)}l${f(2 * S)} ${f(5 * S)}" stroke="#e6c690" stroke-width="${f(1.2 * S)}" opacity=".5"/>`;
      }
    } else if (style === 'nursery') {
      for (let i = -3; i <= 3; i++) s += `<path d="M${f(i * rx * .27)} ${f(-h + rim)}L${f(i * bx * .27)} 0" stroke="#555" stroke-width="${f(1.4 * S)}" opacity=".5"/>`;
    } else if (style === 'blush') {
      for (let i = 0; i < 50; i++) s += `<circle cx="${f((R() - .5) * bx * 1.9)}" cy="${f(-R() * (h - rim))}" r="${f(.4 + R() * .9)}" fill="#7a4a44" opacity=".4"/>`;
    } else if (style === 'gilded') {
      s += `<path d="M${f(-bx * 1.02)} ${f(-10 * S)}L${f(bx * 1.02)} ${f(-10 * S)}" stroke="#c9a54a" stroke-width="${f(3 * S)}"/>`;
    }
    // rim band + opening + soil
    s += `<path d="M${f(-rx)} ${f(-h)}A${f(rx)} ${f(ry)} 0 0 0 ${f(rx)} ${f(-h)}L${f(rx)} ${f(-h + rim)}A${f(rx)} ${f(ry)} 0 0 1 ${f(-rx)} ${f(-h + rim)}Z" fill="${P.rim}"/>`;
    s += `<path d="M${f(-rx)} ${f(-h + rim)}A${f(rx)} ${f(ry)} 0 0 0 ${f(rx)} ${f(-h + rim)}" stroke="#000" stroke-width="${f(2 * S)}" fill="none" opacity=".18"/>`;
    s += `<ellipse cx="0" cy="${f(-h)}" rx="${f(rx)}" ry="${f(ry)}" fill="url(#${id}o)"/>`;
    s += `<ellipse cx="0" cy="${f(-h + 2.2 * S)}" rx="${f(rx * .9)}" ry="${f(ry * .72)}" fill="#3b2a1d"/>`;
    for (let i = 0; i < 16; i++) {
      const a = R() * Math.PI * 2, r = Math.sqrt(R()) * .85, x = Math.cos(a) * rx * .9 * r, y = -h + 2.2 * S + Math.sin(a) * ry * .7 * r;
      s += R() < .55 ? `<circle cx="${f(x)}" cy="${f(y)}" r="${f((.8 + R() * 1.2) * S)}" fill="#f2efe6" opacity=".9"/>`
        : `<rect x="${f(x)}" y="${f(y)}" width="${f((2 + R() * 3) * S)}" height="${f((1.5 + R() * 1.5) * S)}" rx=".6" fill="#7a5233" transform="rotate(${f(R() * 180)} ${f(x)} ${f(y)})"/>`;
    }
    s += `<path d="M${f(-rx * .9)} ${f(-h + rim * .4)}L${f(-rx * .6)} ${f(-h + rim * .45)}" stroke="#fff" stroke-width="${f(2 * S)}" opacity=".25" stroke-linecap="round"/>`;
    return { svg: s, soilY: -h + 2.2 * S, rx, h };
  }

  /* ───────────── Growth forms ───────────── */
  const SCALE = [.42, .62, .82, 1];
  const MAT = [0, .15, .6, 1];
  const byZ = items => items.sort((a, b) => a.z - b.z).map(i => i.svg).join('');

  const FORMS = {
    monstera(c) {
      const { sp, st, R, S, soilY } = c, n = [1, 3, 5, 7][st], items = [];
      let pre = '';
      if (st >= 2) {
        pre += `<rect x="${f(-7 * S)}" y="${f(soilY - 26 * S)}" width="${f(14 * S)}" height="${f(28 * S)}" rx="${f(6 * S)}" fill="${mix(sp.petiole, '#6b5a3a', .45)}"/>`;
        for (let i = 1; i < 4; i++) pre += `<path d="M${f(-7 * S)} ${f(soilY - i * 7 * S)}q${f(7 * S)} ${f(2 * S)} ${f(14 * S)} 0" stroke="#3a2e1e" stroke-width="1" fill="none" opacity=".5"/>`;
        for (let i = 0; i < st; i++) { const side = i % 2 ? 1 : -1; c.front += aerialRoot(side * 5 * S, soilY - 20 * S, side * (c.potRx * (.7 + R() * .4)), 30 + R() * 30 * S, R); }
      }
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? .5 : i / (n - 1), ang = (-64 + 128 * t) + (R() - .5) * 14, rad = ang * D2R;
        const len = (115 + R() * 80) * S * (1 - .2 * Math.abs(ang) / 64);
        const ex = Math.sin(rad) * len * 1.05, ey = soilY - Math.cos(rad * .82) * len, bx = (R() - .5) * 10 * S;
        const L = sp.leaf.L * S * (.85 + R() * .28);
        const svg = stalk(bx, soilY, bx + ex * .12, soilY - len * .78, ex, ey, 3.6 * S + 1.2, sp.petiole, { varCol: sp.petioleVar, R })
          + `<path d="M${f(bx - 3 * S)} ${f(soilY)}q${f(ex * .03)} ${f(-14 * S)} ${f(ex * .06 + 2)} ${f(-26 * S)}" stroke="#b39a6a" stroke-width="${f(3 * S)}" fill="none" opacity=".7" stroke-linecap="round"/>`
          + placeLeaf(sp.leaf, ex, ey, ang * 1.25 + (R() - .5) * 16, { L, sx: .74 + R() * .26, sy: .78 + R() * .22, maturity: MAT[st] * (.75 + R() * .25), R });
        items.push({ z: Math.abs(t - .5) < .2 ? 1 + R() : R(), svg });
      }
      return pre + byZ(items);
    },
    climber(c, shingle) {
      const { sp, st, R, S, soilY } = c, H = [0, 170, 250, 330][st] * (shingle ? 1.05 : 1);
      let s = '';
      if (shingle) {
        s += `<rect x="-24" y="${f(soilY - H)}" width="48" height="${f(H + 4)}" rx="5" fill="#6b4e33"/>`;
        for (let i = 0; i < H / 6; i++) { const x = -22 + R() * 44, y = soilY - R() * H; s += `<path d="M${f(x)} ${f(y)}l${f((R() - .5) * 3)} ${f(6 + R() * 16)}" stroke="${R() < .5 ? '#4a3420' : '#8a6a48'}" stroke-width="${f(.8 + R() * 1.4)}" opacity=".7"/>`; }
        s += `<rect x="-24" y="${f(soilY - H)}" width="10" height="${f(H + 4)}" fill="#000" opacity=".12"/>`;
      } else {
        s += `<rect x="-12" y="${f(soilY - H)}" width="24" height="${f(H + 4)}" rx="10" fill="#5e5034"/>`;
        for (let i = 0; i < H / 2.2; i++) {
          const x = -11 + R() * 22, y = soilY - R() * H, a = R() * Math.PI * 2, l = 2 + R() * 4;
          s += `<path d="M${f(x)} ${f(y)}q${f(Math.cos(a) * l)} ${f(Math.sin(a) * l * .3)} ${f(Math.cos(a) * l * 1.4)} ${f(Math.sin(a) * l)}" stroke="${['#7d9a48', '#5f7a35', '#8a7550', '#a8b56a'][Math.floor(R() * 4)]}" stroke-width="1.1" fill="none"/>`;
        }
        s += `<rect x="-12" y="${f(soilY - H)}" width="8" height="${f(H + 4)}" rx="4" fill="#000" opacity=".15"/>`;
      }
      const n = shingle ? [1, 6, 10, 15][st] : [1, 4, 7, 10][st], nodes = [];
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0 : i / (n - 1), side = i % 2 ? 1 : -1;
        nodes.push({ t, side, x: side * (shingle ? 3 : 7) + (R() - .5) * 4, y: soilY - 22 - (H - 40) * t * .95 });
      }
      s += `<path d="M0 ${f(soilY)}${nodes.map(p => `L${f(p.x * .6)} ${f(p.y)}`).join('')}" stroke="${mix(sp.petiole, '#3a4a2a', .3)}" stroke-width="${f(3 * S + 1)}" fill="none" stroke-linejoin="round"/>`;
      const items = [];
      nodes.forEach((p, i) => {
        if (!shingle && R() < .6) s += aerialRoot(p.x * .6, p.y + 3, -p.side * 4, 8 + R() * 6, R);
        if (shingle) {
          const L = sp.leaf.L * S * (.75 + p.t * .4 + R() * .15);
          items.push({ z: i, svg: placeLeaf(sp.leaf, p.side * (2 + R() * 4), p.y + L * .35, p.side * (6 + R() * 10), { L, sx: 1, sy: 1, maturity: 0, R }) });
        } else {
          const L = sp.leaf.L * S * (.6 + .5 * p.t) * (.9 + R() * .2), ang = p.side * (38 + R() * 32);
          const ex = p.x + p.side * (14 + 10 * S), ey = p.y - 12 - R() * 8;
          items.push({ z: R(), svg: stalk(p.x * .6, p.y, p.x + p.side * 6, p.y - 10, ex, ey, 2.2 * S + 1, sp.petiole, { varCol: sp.petioleVar, R })
            + placeLeaf(sp.leaf, ex, ey, ang, { L, sx: .7 + R() * .3, sy: .85 + R() * .15, maturity: MAT[st] * (.3 + .7 * p.t), R }) });
        }
      });
      return s + byZ(items);
    },
    shingle(c) { return FORMS.climber(c, true); },
    rosette(c) {
      const { sp, st, R, S, soilY } = c, n = sp.dense ? [3, 8, 13, 20][st] : [1, 3, 5, 8][st], spread = sp.spread || 50, items = [];
      const upright = sp.form === 'upright';
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? .5 : i / (n - 1), ang = -spread + 2 * spread * t + (R() - .5) * 16, rad = ang * D2R;
        const len = (sp.petLen || 130) * S * (.72 + R() * .45) * (1 - .18 * Math.abs(ang) / spread);
        const ex = Math.sin(rad) * len, ey = soilY - Math.cos(rad) * len, bx = (R() - .5) * 12 * S;
        const flip = upright && sp.leaf.under && R() < .2;
        let rot;
        if (sp.pendant) rot = 180 - ang * .6 + (R() - .5) * 20;
        else if (upright) rot = ang * 1.35 + (R() - .5) * 14;
        else rot = ang * 1.15 + Math.sign(ang || 1) * (sp.tilt || 0) + (R() - .5) * 12;
        const L = sp.leaf.L * S * (.8 + R() * .32);
        const sy = sp.pendant ? .9 + R() * .1 : .7 + R() * .3;
        const svg = stalk(bx, soilY, bx + ex * .25, soilY - len * .65, ex, ey, (upright ? 2 : 3.6) * S + 1, sp.petiole, { zebra: sp.zebra, hairy: sp.hairy, R })
          + placeLeaf(sp.leaf, ex, ey, rot, { L, sx: .72 + R() * .28, sy, maturity: MAT[st], R, flip });
        items.push({ z: (1 - Math.abs(t - .5)) + R() * .6, svg });
      }
      return byZ(items);
    },
    upright(c) { return FORMS.rosette(c); },
    crawler(c) {
      const { sp, st, R, S, soilY } = c, n = [1, 3, 4, 6][st];
      const x0 = -c.potRx * .65, x1 = c.potRx * (st === 3 ? 1.05 : .6);
      let s = `<path d="M${f(x0)} ${f(soilY + 1)}Q${f((x0 + x1) / 2)} ${f(soilY - 5)} ${f(x1)} ${f(soilY - (st === 3 ? -2 : 3))}" stroke="#6b5a3a" stroke-width="${f(10 * S + 2)}" fill="none" stroke-linecap="round"/>`;
      s += `<path d="M${f(x0)} ${f(soilY - 1)}Q${f((x0 + x1) / 2)} ${f(soilY - 7)} ${f(x1)} ${f(soilY - (st === 3 ? 0 : 5))}" stroke="#8f7a52" stroke-width="${f(3 * S)}" fill="none" opacity=".6"/>`;
      for (let i = 1; i < 7; i++) { const x = lerp(x0, x1, i / 7); s += `<path d="M${f(x)} ${f(soilY - 6 * S)}l${f(1.5)} ${f(10 * S)}" stroke="#4a3a22" stroke-width="1.2" opacity=".6"/>`; }
      const items = [];
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? .6 : i / (n - 1), x = lerp(x0 + 10, x1 - 6, t), ang = (R() - .5) * 50 + (t - .5) * 30;
        const len = (85 + R() * 60) * S * (i === n - 1 && n > 1 ? .7 : 1), ex = x + Math.sin(ang * D2R) * len, ey = soilY - Math.cos(ang * D2R) * len;
        const newest = i === n - 1 && n > 2;
        const spec = newest ? Object.assign({}, sp.leaf, { base: mix(sp.leaf.base, '#8fae6a', .35), light: mix(sp.leaf.light, '#c8d89a', .3) }) : sp.leaf;
        items.push({ z: R(), svg: stalk(x, soilY - 3, x + ex * .05, soilY - len * .7, ex, ey, 3.2 * S + 1, sp.petiole, { R })
          + placeLeaf(spec, ex, ey, ang * 1.3, { L: sp.leaf.L * S * (newest ? .7 : .85 + R() * .25), sx: .8 + R() * .2, sy: .85 + R() * .15, maturity: 1, R }) });
      }
      return s + byZ(items);
    },
    trailing(c, mode) {
      const { sp, st, R, S, soilY } = c, nv = [1, 3, 5, 7][st], items = [];
      let s = '';
      const vineCol = sp.vine || sp.petiole;
      // crown leaves
      const crown = mode === 'pearls' ? 0 : [1, 2, 3, 4][st];
      for (let i = 0; i < crown; i++) {
        const ang = (R() - .5) * 90, len = 14 + R() * 18 * S;
        const ex = Math.sin(ang * D2R) * len, ey = soilY - Math.cos(ang * D2R) * len;
        items.push({ z: 10 + R(), svg: stalk(0, soilY, ex * .4, soilY - len * .7, ex, ey, 1.6, sp.petiole, { R }) + placeLeaf(sp.leaf, ex, ey, ang * 1.3, { L: sp.leaf.L * (mode === 'pearls' ? 1 : .8 + R() * .3) * (st === 1 ? .8 : 1), sx: .8, sy: .9, maturity: 1, R }) });
      }
      for (let v = 0; v < nv; v++) {
        const side = v % 2 ? 1 : -1, len = [0, 50, 130, 220][st] * (.55 + R() * .65) * (sp.small ? .8 : 1);
        const p0 = [side * R() * c.potRx * .4, soilY], p1 = [side * (c.potRx * .55 + R() * c.potRx * .35), soilY - 10 - R() * 16];
        const p2 = [side * (c.potRx + 5 + R() * 8), soilY + 12], p4 = [side * (c.potRx + 8 + R() * 45) + (R() - .5) * 26, soilY + 12 + len];
        const p3 = [lerp(p2[0], p4[0], .5) + (R() - .5) * 24, lerp(p2[1], p4[1], .5)];
        const pts = catmull([p0, p1, p2, p3, p4], 10);
        s += `<path d="${polyD(pts, false)}" stroke="${vineCol}" stroke-width="${mode === 'hearts' ? 1 : 1.8}" fill="none" stroke-linecap="round"/>`;
        let acc = 0, nodeI = 0;
        const spacing = mode === 'pearls' ? 7 : mode === 'hearts' ? 11 : sp.small ? 9 : (sp.leaf.L * .52 + 6);
        for (let i = 1; i < pts.length; i++) {
          acc += dist(pts[i], pts[i - 1]);
          if (acc < spacing) continue;
          acc = 0; nodeI++;
          const tx = pts[i][0] - pts[i - 1][0], ty = pts[i][1] - pts[i - 1][1], rotT = Math.atan2(tx, -ty) / D2R;
          const tail = 1 - .45 * (i / pts.length), alt = nodeI % 2 ? 1 : -1;
          const [x, y] = pts[i];
          if (mode === 'pearls') {
            const r = (4 + R() * 1.4), ox = alt * (2 + R() * 2), cx = x + ox, cy = y + R() * 2;
            items.push({ z: R(), svg: pearl(cx, cy, r, rotT + alt * 40, sp) });
          } else if (mode === 'hearts') {
            for (const a2 of [1, -1]) {
              const flip = R() < .25;
              items.push({ z: R(), svg: placeLeaf(sp.leaf, x, y, rotT + a2 * (70 + R() * 30), { L: sp.leaf.L * (.8 + R() * .4) * tail, sx: 1, sy: .9, maturity: 1, R, flip }) });
            }
            if (R() < .1) items.push({ z: 2, svg: `<circle cx="${f(x)}" cy="${f(y)}" r="3" fill="#8a6a4a"/><circle cx="${f(x - 1)}" cy="${f(y - 1)}" r="1" fill="#c9a77a"/>` });
          } else {
            const pairs = mode === 'hoya' ? [1, -1] : [alt];
            for (const a2 of pairs) {
              const rot = rotT + a2 * (48 + R() * 34), L = sp.leaf.L * (.7 + R() * .35) * tail * (st === 1 ? .8 : 1);
              const lx = x + Math.sin(rot * D2R) * 3, ly = y - Math.cos(rot * D2R) * 3;
              items.push({ z: R(), svg: `<path d="M${f(x)} ${f(y)}L${f(lx)} ${f(ly)}" stroke="${sp.petiole}" stroke-width="1.4"/>` + placeLeaf(sp.leaf, lx, ly, rot, { L, sx: .75 + R() * .25, sy: .85 + R() * .15, maturity: 1, R }) });
            }
            if (mode === 'hoya' && st === 3 && nodeI % 5 === 3 && R() < .7) items.push({ z: 5 + R(), svg: umbel(x, y, sp, R) });
          }
        }
      }
      return s + byZ(items);
    },
    hoya(c) { return FORMS.trailing(c, 'hoya'); },
    pearls(c) { return FORMS.trailing(c, 'pearls'); },
    hearts(c) { return FORMS.trailing(c, 'hearts'); },
    sword(c) {
      const { sp, st, R, S, soilY } = c, n = [1, 3, 5, 7][st], items = [];
      for (let i = 0; i < n; i++) {
        const id = 'sw' + (++UID), x0 = (i - (n - 1) / 2) * 11 * S + (R() - .5) * 6, lean = x0 * .7 + (R() - .5) * 26 * S;
        const H = (sp.broad ? 120 : 160 + R() * 90) * S * (.8 + R() * .3), w = (sp.broad ? 34 : 20) * S * (.8 + R() * .4);
        const tip = [x0 + lean, soilY - H];
        const d = `M${f(x0 - w / 2)} ${f(soilY)}C${f(x0 - w * .75 + lean * .2)} ${f(soilY - H * .45)} ${f(x0 - w * .45 + lean * .8)} ${f(soilY - H * .82)} ${f(tip[0])} ${f(tip[1])}C${f(x0 + w * .45 + lean * .8)} ${f(soilY - H * .82)} ${f(x0 + w * .75 + lean * .2)} ${f(soilY - H * .45)} ${f(x0 + w / 2)} ${f(soilY)}Z`;
        let g = `<defs><clipPath id="${id}c"><path d="${d}"/></clipPath><linearGradient id="${id}g" x1="0" x2="1"><stop offset="0" stop-color="${sp.leaf.dark}"/><stop offset=".45" stop-color="${sp.leaf.light}"/><stop offset="1" stop-color="${sp.leaf.base}"/></linearGradient></defs>`;
        g += `<g clip-path="url(#${id}c)"><path d="${d}" fill="url(#${id}g)"/>`;
        for (let y = soilY - 4 - R() * 6; y > tip[1]; y -= (sp.broad ? 13 : 8) + R() * 7) {
          const t = (soilY - y) / H, cx = x0 + lean * t * t, pts = [];
          for (let x = -w; x <= w; x += 3) pts.push([cx + x, y + ((x / 3) % 2 ? 2 : -2) + Math.sin(x * .2) * 2]);
          g += `<path d="${polyD(pts, false)}" stroke="${R() < .6 ? sp.bandColor : sp.leaf.dark}" stroke-width="${f(2 + R() * 2.5)}" fill="none" opacity="${sp.broad ? .3 : .55}"/>`;
        }
        g += `<path d="${d}" fill="none" stroke="${sp.edgeColor}" stroke-width="${f(w * (sp.broad ? .12 : .32))}"/>`;
        g += `<path d="M${f(x0)} ${f(soilY)}Q${f(x0 + lean * .3)} ${f(soilY - H * .5)} ${f(tip[0])} ${f(tip[1])}" stroke="#fff" stroke-width="1.4" fill="none" opacity=".18"/></g>`;
        items.push({ z: -Math.abs(x0) + R() * 5, svg: g });
      }
      return byZ(items);
    },
    tree(c) {
      const { sp, st, R, S, soilY } = c, H = [0, 110, 190, 265][st], tw = [0, 5, 8, 11][st];
      const top = [2, soilY - H];
      let s = `<path d="M0 ${f(soilY)}C3 ${f(soilY - H * .3)} -5 ${f(soilY - H * .62)} ${f(top[0])} ${f(top[1])}" stroke="${mix(sp.bark, '#000000', .3)}" stroke-width="${tw + 2}" fill="none" stroke-linecap="round"/>`;
      s += `<path d="M0 ${f(soilY)}C3 ${f(soilY - H * .3)} -5 ${f(soilY - H * .62)} ${f(top[0])} ${f(top[1])}" stroke="${sp.bark}" stroke-width="${tw}" fill="none" stroke-linecap="round"/>`;
      for (let i = 0; i < H / 12; i++) s += `<ellipse cx="${f((R() - .5) * tw * .6)}" cy="${f(soilY - R() * H * .9)}" rx="${f(tw * .14)}" ry=".6" fill="#e9dfc9" opacity=".5"/>`;
      const trunkAt = t => { const u = t, a = (1 - u) ** 3, b = 3 * (1 - u) ** 2 * u, cc = 3 * (1 - u) * u * u, d = u ** 3; return [b * 3 + cc * -5 + d * top[0], a * soilY + b * (soilY - H * .3) + cc * (soilY - H * .62) + d * top[1]]; };
      const items = [], n = [0, 5, 9, 13][st];
      const addLeaf = (px, py, side, t, scale) => {
        const ang = side * (28 + R() * 48) * (1 - t * .45), plen = 6 + R() * 6;
        const ex = px + Math.sin(ang * D2R) * plen, ey = py - Math.cos(ang * D2R) * plen;
        items.push({ z: R(), svg: `<path d="M${f(px)} ${f(py)}L${f(ex)} ${f(ey)}" stroke="${sp.petiole}" stroke-width="2.4" stroke-linecap="round"/>` + placeLeaf(sp.leaf, ex, ey, ang * 1.15, { L: sp.leaf.L * S * scale * (.8 + R() * .3), sx: .65 + R() * .35, sy: .82 + R() * .18, maturity: 1, R }) });
      };
      for (let i = 0; i < n; i++) { const t = .3 + .7 * (i / Math.max(1, n - 1)); const p = trunkAt(t); addLeaf(p[0], p[1], i % 2 ? 1 : -1, t, 1); }
      if (st === 3) {
        const b0 = trunkAt(.55), b1 = [b0[0] + 52, b0[1] - 60];
        s += `<path d="M${f(b0[0])} ${f(b0[1])}Q${f(b0[0] + 30)} ${f(b0[1] - 15)} ${f(b1[0])} ${f(b1[1])}" stroke="${sp.bark}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
        for (let i = 0; i < 4; i++) { const t = .4 + i * .2; addLeaf(lerp(b0[0], b1[0], t), lerp(b0[1], b1[1], t) - 6 * t, i % 2 ? 1 : -1, t, .85); }
      }
      const stip = sp.stipule || mix(sp.leaf.light, '#e8e0b0', .4);
      items.push({ z: 9, svg: `<path d="M${f(top[0] - 3)} ${f(top[1] + 2)}Q${f(top[0])} ${f(top[1] - 16)} ${f(top[0] + 2)} ${f(top[1] - 24)}Q${f(top[0] + 4)} ${f(top[1] - 12)} ${f(top[0] + 3)} ${f(top[1] + 2)}Z" fill="${stip}"/>` });
      return s + byZ(items);
    },
    pilea(c) {
      const { sp, st, R, S, soilY } = c, H = [0, 12, 34, 62][st], n = [0, 5, 9, 14][st], top = soilY - H;
      let s = `<path d="M0 ${f(soilY)}L0 ${f(top)}" stroke="#6f7f4a" stroke-width="${f(4 + st)}" stroke-linecap="round"/>`;
      for (let y = soilY - 5; y > top + 4; y -= 5) s += `<path d="M-3 ${f(y)}q3 1.5 6 0" stroke="#4a5a32" stroke-width=".9" fill="none" opacity=".7"/>`;
      const leaves = [];
      for (let i = 0; i < n; i++) {
        const phi = i * 2.4 + R() * .4, r = (34 + R() * 34) * S + 18, lift = (R() * .5 + .5) * r * .55;
        const ex = Math.cos(phi) * r, ey = top - lift + Math.sin(phi) * r * .22;
        leaves.push({ z: Math.sin(phi), ex, ey, phi, rr: (15 + R() * 9) * S + 6 });
      }
      if (st >= 2) for (let p = 0; p < st - 1; p++) {
        const px = (p ? 1 : -1) * c.potRx * (.45 + R() * .3);
        for (let i = 0; i < 3; i++) leaves.push({ z: 2, ex: px + (i - 1) * 6, ey: soilY - 8 - R() * 6, phi: -Math.PI / 2 + (i - 1) * .7, rr: 6 + R() * 3, pup: px });
      }
      leaves.sort((a, b) => a.z - b.z);
      for (const l of leaves) {
        const sx0 = l.pup != null ? l.pup : 0, sy0 = l.pup != null ? soilY : top;
        s += `<path d="M${f(sx0)} ${f(sy0)}Q${f(sx0 + (l.ex - sx0) * .5)} ${f(Math.min(sy0, l.ey) - 10)} ${f(l.ex)} ${f(l.ey)}" stroke="${sp.petiole}" stroke-width="1.6" fill="none"/>`;
        s += coinLeaf(l.ex, l.ey, l.rr, l.phi, sp, R);
      }
      return s;
    },
    zz(c) {
      const { sp, st, R, S, soilY } = c, n = [1, 3, 5, 7][st], items = [];
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? .5 : i / (n - 1), ang = -38 + 76 * t + (R() - .5) * 12, len = (110 + R() * 70) * S;
        const ex = Math.sin(ang * D2R) * len, ey = soilY - Math.cos(ang * D2R) * len, cx = ex * .2, cy = soilY - len * .6;
        let g = `<path d="M0 ${f(soilY)}Q${f(cx)} ${f(cy)} ${f(ex)} ${f(ey)}" stroke="${mix(sp.petiole, '#000000', .25)}" stroke-width="${f(7 * S + 2)}" fill="none" stroke-linecap="round"/>`;
        g += `<path d="M0 ${f(soilY)}Q${f(cx)} ${f(cy)} ${f(ex)} ${f(ey)}" stroke="${sp.petiole}" stroke-width="${f(4 * S + 1)}" fill="none" stroke-linecap="round"/>`;
        const m = Math.round(4 + 4 * S);
        for (let k = 0; k < m; k++) {
          const u = .32 + .68 * k / (m - 1 || 1), a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, cc = u * u;
          const px = b * cx + cc * ex, py = a * soilY + b * cy + cc * ey;
          const tx = 2 * (1 - u) * cx + 2 * u * (ex - cx), ty = 2 * (1 - u) * (cy - soilY) + 2 * u * (ey - cy), rotT = Math.atan2(tx, -ty) / D2R;
          const L = sp.leaf.L * S * (k === m - 1 ? .8 : 1.15) * (.85 + R() * .25);
          for (const side of k === m - 1 ? [0] : [1, -1]) g += placeLeaf(sp.leaf, px, py, rotT + side * 52, { L, sx: .9, sy: .9, maturity: 1, R });
        }
        items.push({ z: Math.abs(t - .5) < .25 ? 1 + R() : R(), svg: g });
      }
      return byZ(items);
    }
  };

  function pearl(x, y, r, rot, sp) {
    const id = 'pr' + (++UID);
    return `<defs><radialGradient id="${id}" cx=".38" cy=".35" r=".7"><stop offset="0" stop-color="${sp.leaf.light}"/><stop offset=".6" stop-color="${sp.leaf.base}"/><stop offset="1" stop-color="${sp.leaf.dark}"/></radialGradient></defs>`
      + `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)})"><path d="M0 ${f(-r - 2.4)}L${f(r * .35)} ${f(-r * .8)}L${f(-r * .35)} ${f(-r * .8)}Z" fill="${sp.leaf.base}"/>`
      + `<circle r="${f(r)}" fill="url(#${id})"/><path d="M${f(-r * .7)} ${f(-r * .1)}Q0 ${f(r * .45)} ${f(r * .7)} ${f(-r * .1)}" stroke="#e9f7d8" stroke-width=".9" fill="none" opacity=".75"/>`
      + `<circle cx="${f(-r * .35)}" cy="${f(-r * .4)}" r="${f(r * .22)}" fill="#fff" opacity=".7"/></g>`;
  }
  function umbel(x, y, sp, R) {
    const cx = x + (R() - .5) * 8, cy = y + 12;
    let s = `<path d="M${f(x)} ${f(y)}L${f(cx)} ${f(cy)}" stroke="#7a6a5a" stroke-width="1.2"/>`;
    const fl = [];
    for (let i = 0; i < 16; i++) { const a = R() * Math.PI * 2, r = 6 + R() * 7; fl.push({ x: cx + Math.cos(a) * r, y: cy + 6 + Math.sin(a) * r * .65 + r * .3, z: Math.sin(a) }); }
    fl.sort((a, b) => a.z - b.z);
    for (const p of fl) {
      s += `<path d="M${f(cx)} ${f(cy)}L${f(p.x)} ${f(p.y)}" stroke="#d8c6b0" stroke-width=".5"/>`;
      s += `<path d="${star(p.x, p.y, 4.4, 1.9, R() * 72)}" fill="${sp.flower}" stroke="${mix(sp.flower, '#000000', .15)}" stroke-width=".3"/>`;
      s += `<path d="${star(p.x, p.y, 2, .9, R() * 72)}" fill="${sp.corona}"/><circle cx="${f(p.x)}" cy="${f(p.y)}" r=".5" fill="#fff"/>`;
    }
    return s;
  }
  function star(x, y, ro, ri, rot) {
    const pts = [];
    for (let i = 0; i < 10; i++) { const a = (rot + i * 36 - 90) * D2R, r = i % 2 ? ri : ro; pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); }
    return polyD(pts);
  }
  function coinLeaf(x, y, r, phi, sp, R) {
    const id = 'cn' + (++UID), sq = .5 + .35 * Math.abs(Math.cos(phi)), rot = Math.cos(phi) * 24;
    const L = sp.leaf;
    let s = `<defs><radialGradient id="${id}" cx=".45" cy=".4" r=".7"><stop offset="0" stop-color="${L.light}"/><stop offset=".7" stop-color="${L.base}"/><stop offset="1" stop-color="${L.dark}"/></radialGradient></defs>`;
    s += `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)}) scale(1 ${f2(sq)})"><circle r="${f(r)}" fill="url(#${id})" stroke="${L.edge}" stroke-width=".8"/>`;
    const ax = -r * .12, ay = r * .18;
    for (let i = 0; i < 9; i++) { const a = i * 40 * D2R; s += `<path d="M${f(ax)} ${f(ay)}L${f(Math.cos(a) * r * .9)} ${f(Math.sin(a) * r * .9)}" stroke="${L.veins.color}" stroke-width=".7" opacity=".45"/>`; }
    s += `<circle cx="${f(ax)}" cy="${f(ay)}" r="1.4" fill="${L.veins.color}"/><ellipse cx="${f(r * .3)}" cy="${f(-r * .35)}" rx="${f(r * .35)}" ry="${f(r * .2)}" fill="#fff" opacity=".2"/></g>`;
    return s;
  }

  /* ───────────── Stage 0: propagation vessel ───────────── */
  function cutting(sp, R) {
    const w = 38, h = 82, top = -h;
    let s = `<ellipse cx="0" cy="2" rx="24" ry="4" fill="#000" opacity=".2"/>`;
    const jar = `M${-w / 2} -8Q${-w / 2} 0 ${-w / 2 + 8} 0L${w / 2 - 8} 0Q${w / 2} 0 ${w / 2} -8L${w / 2} ${top + 18}Q${w / 2} ${top + 10} ${w * .3} ${top + 6}L${w * .3} ${top}L${-w * .3} ${top}L${-w * .3} ${top + 6}Q${-w / 2} ${top + 10} ${-w / 2} ${top + 18}Z`;
    s += `<path d="${jar}" fill="#e8f6f4" opacity=".18"/>`;
    s += `<path d="M${-w / 2 + 1} -8Q${-w / 2 + 1} -1 ${-w / 2 + 8} -1L${w / 2 - 8} -1Q${w / 2 - 1} -1 ${w / 2 - 1} -8L${w / 2 - 1} -48L${-w / 2 + 1} -48Z" fill="#9fd6dc" opacity=".35"/>`;
    s += `<path d="M${-w / 2 + 1} -48L${w / 2 - 1} -48" stroke="#d8f2f4" stroke-width="1.2" opacity=".8"/>`;
    const node = [2, -40];
    for (let i = 0; i < 6; i++) {
      const a = (R() - .5) * 1.6, l = 14 + R() * 22;
      const ex = node[0] + Math.sin(a) * l, ey = node[1] + Math.cos(a) * l;
      s += `<path d="M${node[0]} ${node[1]}Q${f(node[0] + (ex - node[0]) * .3 + (R() - .5) * 8)} ${f(node[1] + l * .5)} ${f(Math.max(-w / 2 + 4, Math.min(w / 2 - 4, ex)))} ${f(Math.min(-6, ey))}" stroke="#efe6cf" stroke-width="${f(1 + R() * .8)}" fill="none" stroke-linecap="round"/>`;
    }
    let plant = '';
    const stemTop = [4, top - 10];
    if (sp.form === 'sword') {
      plant += `<path d="M-5 -40C-8 ${top} -4 ${top - 40} 2 ${top - 60}C6 ${top - 40} 8 ${top} 6 -40Z" fill="${sp.leaf.base}" stroke="${sp.edgeColor}" stroke-width="2"/>`;
    } else if (sp.form === 'pearls') {
      plant += `<path d="M${node[0]} ${node[1]}Q8 ${top - 6} ${w * .4} ${top + 2}Q${w * .8} ${top + 10} ${w * .9} ${top + 40}" stroke="${sp.vine}" stroke-width="1.4" fill="none"/>`;
      for (let i = 0; i < 6; i++) plant += pearl(w * .4 + i * 4, top + 4 + i * 6, 4, 140, sp);
    } else if (sp.form === 'pilea') {
      plant += `<path d="M${node[0]} ${node[1]}L${stemTop[0]} ${stemTop[1]}" stroke="${sp.petiole}" stroke-width="2"/>` + coinLeaf(stemTop[0], stemTop[1] - 6, 12, -1.2, sp, R) + coinLeaf(stemTop[0] - 12, stemTop[1], 9, 2.4, sp, R);
    } else {
      plant += `<path d="M${node[0]} ${node[1] + 6}Q${node[0] + 3} ${top + 10} ${stemTop[0]} ${stemTop[1]}" stroke="${sp.petiole}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`;
      plant += `<ellipse cx="${node[0] + 1}" cy="${node[1]}" rx="3.4" ry="2" fill="${mix(sp.petiole, '#6b5a3a', .5)}"/>`;
      if (sp.form === 'monstera' || sp.form === 'climber') plant += aerialRoot(stemTop[0] - 1, top + 4, -10, 12, R);
      const spec = sp.form === 'zz' ? sp.leaf : sp.leaf, L = Math.min(sp.leaf.L * .55, 52);
      plant += placeLeaf(spec, stemTop[0], stemTop[1], 18, { L, sx: .9, sy: 1, maturity: 0, R });
      if (sp.leaf.L < 50) plant += placeLeaf(spec, stemTop[0] - 2, stemTop[1] + 8, -40, { L: L * .8, sx: .9, sy: 1, maturity: 0, R });
    }
    s += plant;
    s += `<path d="${jar}" fill="none" stroke="#e9fbff" stroke-width="1.6" opacity=".7"/>`;
    s += `<path d="M${-w / 2 + 4} ${top + 22}L${-w / 2 + 4} -10" stroke="#fff" stroke-width="2.4" opacity=".45" stroke-linecap="round"/>`;
    return s;
  }

  /* ───────────── Public API ───────────── */
  function plantGroup(id, stage = 2, potStyle = 'terracotta', seed = 1) {
    const sp = SPECIES_BY_ID[id]; if (!sp) return '';
    const R = rng(seed ^ hashStr(id));
    if (stage <= 0) return cutting(sp, R);
    const potS = [.6, .78, .9, 1][stage];
    const pot = potSVG(potStyle, potS, R);
    const c = { sp, st: stage, R, S: SCALE[stage], potS, soilY: pot.soilY, potRx: pot.rx, front: '' };
    const body = FORMS[sp.form] ? FORMS[sp.form](c) : FORMS.rosette(c);
    return pot.svg + body + c.front;
  }
  function viewBoxFor(id, stage) {
    const sp = SPECIES_BY_ID[id];
    const trailing = ['trailing', 'hoya', 'pearls', 'hearts'].includes(sp.form);
    const z = [.42, .62, .84, 1][stage];
    let [x, y, w, h] = trailing ? [-220, -320, 440, 580] : [-195, -470, 390, 490];
    if (sp.form === 'climber' || sp.form === 'shingle') { y = -560; h = 580; }
    w *= z; h *= z; x *= z; y = trailing ? y * z : -h + 20 * z;
    return `${f(x)} ${f(y)} ${f(w)} ${f(h)}`;
  }
  function plantSVG(id, opts = {}) {
    const stage = opts.stage == null ? 2 : opts.stage;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBoxFor(id, stage)}" class="${opts.cls || ''}" preserveAspectRatio="xMidYMax meet">${plantGroup(id, stage, opts.pot || 'terracotta', opts.seed || 7)}</svg>`;
  }
  function leafPortrait(id, opts = {}) {
    const sp = SPECIES_BY_ID[id]; if (!sp) return '';
    const R = rng(hashStr(id) + 11);
    let inner, vb;
    if (sp.form === 'sword') {
      const c = { sp, st: 1, R, S: 1, soilY: 0, potRx: 0 };
      inner = FORMS.sword(c); vb = '-110 -270 220 280';
    } else if (sp.form === 'pearls') {
      inner = `<path d="M-40 -60Q0 -70 30 -30Q50 0 40 30" stroke="${sp.vine}" stroke-width="1.6" fill="none"/>`;
      for (let i = 0; i < 9; i++) { const t = i / 8; inner += pearl(-40 + t * 80 + Math.sin(t * 6) * 6, -62 + t * 92, 9, 120 + t * 60, sp); }
      vb = '-70 -90 140 140';
    } else if (sp.form === 'pilea') {
      inner = `<path d="M0 40Q-4 10 0 -6" stroke="${sp.petiole}" stroke-width="3" fill="none"/>` + coinLeaf(0, -30, 44, -1.4, sp, R); vb = '-70 -90 140 140';
    } else {
      const L = 100, W = L * (sp.leaf.w || 1) * .62, half = Math.max(60, W + 18);
      inner = stalk(0, 46, 2, 24, 0, 2, 4, sp.petiole || '#5a7a3a', { R, zebra: sp.zebra, hairy: sp.hairy, varCol: sp.petioleVar });
      inner += placeLeaf(sp.leaf, 0, 2, 0, { L, sx: 1, sy: 1, maturity: 1, R });
      vb = `${f(-half)} -110 ${f(half * 2)} 160`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" class="${opts.cls || ''}">${inner}</svg>`;
  }

  return { plantGroup, plantSVG, leafPortrait, potSVG, POTS, leafSVG, placeLeaf, stalk };
})();
