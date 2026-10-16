/* Photo → Sim. Everything runs locally on a downscaled copy of the image; nothing is uploaded or stored.
   1. find the face as the largest skin-coloured region (YCbCr skin model)
   2. sample skin, hair (above and beside the face), facial hair (jaw) and clothing (below the chin)
   3. map those measurements onto the cartoon Sim's options */
const PhotoSim = (() => {
  const toHex = ([r, g, b]) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const lum = c => .299 * c[0] + .587 * c[1] + .114 * c[2];
  function hsl([r, g, b]) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    let h = 0;
    if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60 < 0 ? h * 60 + 360 : h * 60, s, l];
  }
  const median = arr => {
    if (!arr.length) return null;
    const ch = k => { const v = arr.map(p => p[k]).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
    return [ch(0), ch(1), ch(2)];
  };
  function isSkin(r, g, b) {
    const cb = 128 - .168736 * r - .331264 * g + .5 * b, cr = 128 + .5 * r - .418688 * g - .081312 * b;
    return cb >= 77 && cb <= 130 && cr >= 133 && cr <= 178 && r > 60 && r > b;
  }
  /* Stylise a measured colour so it sits nicely with the hand-picked palette. */
  function stylise(c, satBoost = 1.15, light = 0) {
    let [h, s, l] = hsl(c);
    s = Math.min(1, s * satBoost); l = Math.max(.06, Math.min(.94, l + light));
    const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return toHex([f(h / 360 + 1 / 3) * 255, f(h / 360) * 255, f(h / 360 - 1 / 3) * 255]);
  }

  /* Remove flat black/white bars (screenshots, letterboxing) so they don't skew the analysis. */
  function trimBox(img) {
    const w = 120, h = Math.max(1, Math.round(img.naturalHeight / img.naturalWidth * w));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h).data;
    const flat = (i0, step, n) => { let s = 0, s2 = 0; for (let k = 0; k < n; k++) { const i = (i0 + k * step) * 4, l = (d[i] + d[i + 1] + d[i + 2]) / 3; s += l; s2 += l * l; } const m = s / n; return Math.sqrt(Math.max(0, s2 / n - m * m)) < 7 && (m < 28 || m > 238); };
    let t = 0, b = h - 1, l = 0, r = w - 1;
    while (t < b && flat(t * w, 1, w)) t++;
    while (b > t && flat(b * w, 1, w)) b--;
    while (l < r && flat(t * w + l, w, b - t + 1)) l++;
    while (r > l && flat(t * w + r, w, b - t + 1)) r--;
    const sx = img.naturalWidth / w, sy = img.naturalHeight / h;
    return [l * sx, t * sy, (r - l + 1) * sx, (b - t + 1) * sy];
  }
  function kmeans(pts, k = 3) {
    if (pts.length < k) return pts.length ? [{ c: median(pts), n: pts.length }] : [];
    let cs = Array.from({ length: k }, (_, i) => pts[Math.floor((i + .5) / k * pts.length)].slice());
    let asg = new Array(pts.length).fill(0);
    for (let it = 0; it < 8; it++) {
      pts.forEach((p, i) => { let bi = 0, bd = 1e9; cs.forEach((c, j) => { const dd = dist(p, c); if (dd < bd) { bd = dd; bi = j; } }); asg[i] = bi; });
      cs = cs.map((c, j) => { const m = pts.filter((_, i) => asg[i] === j); return m.length ? median(m) : c; });
    }
    return cs.map((c, j) => ({ c, n: asg.filter(a => a === j).length })).sort((a, b) => b.n - a.n);
  }
  function analyze(img, opt = {}) {
    const [cx0, cy0, cw0, ch0] = opt.crop || trimBox(img);
    const W = 180, H = Math.max(1, Math.round(ch0 / cw0 * W));
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, cx0, cy0, cw0, ch0, 0, 0, W, H);
    const px = ctx.getImageData(0, 0, W, H).data;
    const at = (x, y) => { const i = (y * W + x) * 4; return [px[i], px[i + 1], px[i + 2]]; };
    // 1 · skin mask + largest blob
    const mask = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const [r, g, b] = at(x, y); if (isSkin(r, g, b)) mask[y * W + x] = 1; }
    const lab = new Int32Array(W * H).fill(-1); let best = null;
    for (let i = 0; i < W * H; i++) {
      if (!mask[i] || lab[i] >= 0) continue;
      const st = [i], blob = { n: 0, x0: W, y0: H, x1: 0, y1: 0, sx: 0, sy: 0 }; lab[i] = i;
      while (st.length) {
        const j = st.pop(), x = j % W, y = (j / W) | 0;
        blob.n++; blob.sx += x; blob.sy += y; blob.x0 = Math.min(blob.x0, x); blob.x1 = Math.max(blob.x1, x); blob.y0 = Math.min(blob.y0, y); blob.y1 = Math.max(blob.y1, y);
        for (const k of [j - 1, j + 1, j - W, j + W]) if (k >= 0 && k < W * H && mask[k] && lab[k] < 0 && Math.abs((k % W) - x) <= 1) { lab[k] = i; st.push(k); }
      }
      // prefer big blobs near the upper-middle of the frame (faces, not arms)
      const cx = blob.sx / blob.n / W, cy = blob.sy / blob.n / H;
      blob.score = blob.n * (1.2 - Math.abs(cx - .5)) * (1.15 - cy * .5);
      if (blob.n > W * H * .004 && (!best || blob.score > best.score)) { best = blob; best.id = i; }
    }
    const found = !!best || !!opt.box;
    let fx0, fy0, fw, fh;
    if (opt.box) { [fx0, fy0, fw, fh] = [opt.box[0] * W, opt.box[1] * H, opt.box[2] * W, opt.box[3] * H].map(Math.round); }
    else if (best) {
      // the blob often includes neck/shoulders: keep a face-shaped box from its top
      fw = best.x1 - best.x0 + 1; fx0 = best.x0; fy0 = best.y0;
      // narrow to the widest band in the upper part (the face itself)
      const rows = [];
      for (let y = best.y0; y <= best.y1; y++) { let n = 0, a = W, b = 0; for (let x = best.x0; x <= best.x1; x++) if (lab[y * W + x] === best.id) { n++; a = Math.min(a, x); b = Math.max(b, x); } rows.push({ y, n, a, b }); }
      const top = rows.slice(0, Math.max(3, Math.round(rows.length * .6)));
      const wide = top.reduce((m, r) => r.n > m.n ? r : m, top[0]);
      fw = Math.max(8, wide.b - wide.a + 1); fx0 = wide.a;
      fh = Math.min(best.y1 - best.y0 + 1, Math.round(fw * 1.3));
    } else { fw = Math.round(W * .38); fh = Math.round(fw * 1.3); fx0 = Math.round((W - fw) / 2); fy0 = Math.round(H * .18); }
    const inB = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
    const region = (x0, y0, x1, y1, pred) => { const out = []; for (let y = Math.max(0, Math.round(y0)); y < Math.min(H, Math.round(y1)); y++) for (let x = Math.max(0, Math.round(x0)); x < Math.min(W, Math.round(x1)); x++) { const c = at(x, y); if (!pred || pred(c, x, y)) out.push(c); } return out; };
    // background = image border
    const border = []; for (let x = 0; x < W; x += 2) { border.push(at(x, 0), at(x, H - 1)); } for (let y = 0; y < H; y += 2) { border.push(at(0, y), at(W - 1, y)); }
    const bg = median(border);
    // 2 · skin
    const skinPx = region(fx0 + fw * .2, fy0 + fh * .3, fx0 + fw * .8, fy0 + fh * .65, c => isSkin(...c));
    const skin = median(skinPx) || [222, 180, 150];
    const notSkinBg = c => !isSkin(...c) && dist(c, bg) > 38 && dist(c, skin) > 45;
    // hair above the face
    // hair: a thin ring hugging the top and sides of the face, clustered so glare and background drop out
    const fcx = fx0 + fw / 2, fcy = fy0 + fh * .5, ring = [];
    for (let a = Math.PI * 1.15; a <= Math.PI * 1.85; a += .04) for (const sc of [1.06, 1.16, 1.26]) {
      const x = Math.round(fcx + Math.cos(a) * fw / 2 * sc), y = Math.round(fcy + Math.sin(a) * fh / 2 * sc);
      if (inB(x, y)) { const c = at(x, y); if (!isSkin(...c) && dist(c, skin) > 40) ring.push(c); }
    }
    for (let y = Math.round(fcy - fh * .38); y < fcy; y++) for (const sx of [-1, 1]) for (const sc of [1.06, 1.2]) { const x = Math.round(fcx + sx * fw / 2 * sc); if (inB(x, y)) { const c = at(x, y); if (!isSkin(...c) && dist(c, skin) > 40) ring.push(c); } }
    const ringTotal = 3 * Math.round((Math.PI * .7) / .04);
    // natural hair hues (black, browns, blonde, red, grey) are far more likely than saturated blues/greens,
    // which are usually seats, walls or sky behind the head
    const hairLike = c => { const [h, sat, l] = hsl(c); if (l > .8) return .15; if (sat > .18 && h > 150 && h < 280) return .25; if (sat > .35 && h > 70 && h <= 150) return .35; return 1; };
    const lightFrac = ring.filter(c => hsl(c)[2] > .78).length / Math.max(1, ring.length);
    const ringUse = lightFrac < .6 ? ring.filter(c => hsl(c)[2] <= .78) : ring;
    const cl = kmeans(ringUse, 3).map(c => Object.assign(c, { w: c.n * hairLike(c.c) })).sort((a, b) => b.w - a.w);
    const hairC = opt.hair || (cl.length && cl[0].w > 2 ? cl[0].c : null);
    const aboveAll = region(fx0 + fw * .1, fy0 - fh * .2, fx0 + fw * .9, fy0 + fh * .1);
    const hairAbove = hairC ? aboveAll.filter(c => dist(c, hairC) < 55).length / Math.max(1, aboveAll.length) : 0;
    const ringFrac = hairC ? ring.filter(c => dist(c, hairC) < 55).length / Math.max(1, ringTotal) : 0;
    // hair beside / below the face (long hair)
    const sideL = region(fx0 - fw * .32, fy0 + fh * .45, fx0 + fw * .02, fy0 + fh * 1.35), sideR = region(fx0 + fw * .98, fy0 + fh * .45, fx0 + fw * 1.32, fy0 + fh * 1.35);
    const sideFrac = arr => hairC && arr.length ? arr.filter(c => dist(c, hairC) < 50 && !isSkin(...c)).length / arr.length : 0;
    const longL = sideFrac(sideL), longR = sideFrac(sideR);
    // facial hair: jaw darker than cheeks
    const jaw = region(fx0 + fw * .25, fy0 + fh * .72, fx0 + fw * .75, fy0 + fh * .98);
    const cheeks = region(fx0 + fw * .2, fy0 + fh * .4, fx0 + fw * .8, fy0 + fh * .6);
    const jawL = jaw.length ? jaw.reduce((a, c) => a + lum(c), 0) / jaw.length : 0, cheekL = cheeks.length ? cheeks.reduce((a, c) => a + lum(c), 0) / cheeks.length : 1;
    const jawSkin = jaw.length ? jaw.filter(c => isSkin(...c)).length / jaw.length : 1;
    const ratio = jawL / Math.max(1, cheekL);
    // 3 · clothing below the chin
    const shirt = median(region(fx0 - fw * .3, fy0 + fh * 1.25, fx0 + fw * 1.3, fy0 + fh * 2.1, c => !isSkin(...c) && dist(c, bg) > 30 && (!hairC || dist(c, hairC) > 30)));

    // 4 · the whole person: colour-model segmentation seeded from the face and chest
    const cxF = fx0 + fw / 2, chinY = fy0 + fh * .98;
    let poly = opt.poly ? opt.poly.map(([x, y]) => [x * W, y * H]) : null;
    if (!poly) poly = segmentPerson(at, W, H, fx0, fy0, fw, fh, skin);
    const pmask = new Uint8Array(W * H);
    let pyMax = 0;
    { let x0 = W, x1 = 0, y0 = H, y1 = 0; for (const [x, y] of poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      for (let y = Math.max(0, Math.floor(y0)); y < Math.min(H, Math.ceil(y1)); y++) for (let x = Math.max(0, Math.floor(x0)); x < Math.min(W, Math.ceil(x1)); x++) if (pip(x + .5, y + .5, poly)) { pmask[y * W + x] = 1; pyMax = Math.max(pyMax, y); } }
    const pick = (xa, xb, ya, yb, pred) => { const out = []; for (let y = Math.max(0, Math.round(ya)); y < Math.min(H, Math.round(yb)); y++) for (let x = Math.max(0, Math.round(xa)); x < Math.min(W, Math.round(xb)); x++) { if (!pmask[y * W + x]) continue; const c = at(x, y); if (!pred || pred(c, x, y)) out.push(c); } return out; };
    const cloth = clothing(at, pmask, W, H, cxF, chinY, fw, fh, pyMax, skin, hairC);

    const [, hs, hl] = hairC ? hsl(hairC) : [0, 0, 0];
    const grey = hairC && hs < .12 && hl > .58 && hl < .9;
    let hair;
    if (!hairC || (hairAbove < .12 && ringFrac < .25)) hair = hairAbove > .05 || ringFrac > .12 ? 'buzz' : 'bald';
    else if (longL > .35 || longR > .35) hair = 'long';
    else if (hairAbove > .55 && hs > .25 && hl < .4) hair = 'curly';
    else hair = hairAbove < .3 ? 'buzz' : 'short';
    const beard = ratio < .72 && jawSkin < .55 ? 'beard' : ratio < .86 && jawSkin < .8 ? 'stubble' : null;
    const result = {
      found, skin: stylise(skin, 1.05, lum(skin) < 170 ? .08 : .03), hairColor: hairC ? stylise(hairC, 1.25, grey ? .05 : -.02) : '#5a3a22', hair, beard,
      age: grey ? 'elder' : 'adult', topColor: cloth.topColor ? stylise(cloth.topColor, 1.15) : shirt ? stylise(shirt, 1.2) : null,
      cloth, poly: poly.map(([x, y]) => [x / W, y / H]),
      outfit: cloth.top ? { top: cloth.top, sleeves: cloth.sleeves, neck: cloth.neck, pattern: cloth.pattern, topColor2: cloth.topColor2 ? stylise(cloth.topColor2, 1.15) : null,
        bottom: cloth.bottom, bottomColor: cloth.bottomColor ? stylise(cloth.bottomColor, 1.1) : null } : null,
      crop: [cx0, cy0, cw0, ch0], picked: opt.hair || null,
      debug: { cv, box: [fx0 / W, fy0 / H, fw / W, fh / H], hairAbove, ringFrac, longL, longR, ratio, jawSkin, clusters: cl.map(c => toHex(c.c) + ':' + c.n + '/' + Math.round(c.w)) }
    };
    return result;
  }
  function pip(x, y, poly) {
    let ins = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) ins = !ins; }
    return ins;
  }
  /* Person outline: foreground/background colour models + spatial prior, then the outer contour as a polygon. */
  function segmentPerson(at, W, H, fx0, fy0, fw, fh, skin) {
    const cx = fx0 + fw / 2, inB = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
    const fg = [], bg = [];
    for (let y = fy0; y < fy0 + fh; y += 2) for (let x = fx0; x < fx0 + fw; x += 2) if (inB(x, y)) fg.push(at(x, y));
    const ty0 = fy0 + fh * 1.15, ty1 = Math.min(H - 1, fy0 + fh * 2.4);
    for (let y = ty0; y < ty1; y += 2) for (let x = cx - fw * .55; x < cx + fw * .55; x += 2) if (inB(Math.round(x), Math.round(y))) fg.push(at(Math.round(x), Math.round(y)));
    for (let x = 0; x < W; x += 2) for (const y of [0, 1, 2, H - 1]) if (Math.abs(x - cx) > fw * 1.2) bg.push(at(x, y));
    for (let y = 0; y < H; y += 2) for (const x of [0, 1, 2, W - 2, W - 1]) bg.push(at(x, y));
    for (let y = 0; y < H; y += 3) for (let x = 0; x < W; x += 3) if (Math.abs(x - cx) > fw * 2.3) bg.push(at(x, y));
    const fgC = kmeansLite(fg, 6), bgC = kmeansLite(bg, 7);
    const near = (c, cs) => cs.reduce((m, k) => Math.min(m, dist(c, k)), 1e9);
    const m = new Uint8Array(W * H), top = Math.max(0, Math.round(fy0 - fh * .5));
    for (let y = top; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = Math.abs(x - cx) / fw;
      if (dx > 2.4) continue;
      const c = at(x, y), prior = (dx > 1.5 ? (dx - 1.5) * 40 : 0) + (y < fy0 - fh * .1 ? 18 : 0);
      if (near(c, fgC) + prior < near(c, bgC) * .95) m[y * W + x] = 1;
    }
    // certain regions
    for (let y = fy0; y < fy0 + fh; y++) for (let x = fx0; x < fx0 + fw; x++) if (inB(x, y) && ((x - cx) / (fw / 2)) ** 2 + ((y - fy0 - fh / 2) / (fh / 2)) ** 2 <= 1) m[y * W + x] = 1;
    for (let y = Math.round(ty0); y < ty1; y++) for (let x = Math.round(cx - fw * .45); x < cx + fw * .45; x++) if (inB(x, y)) m[y * W + x] = 1;
    // keep the component connected to the chest
    const keep = new Uint8Array(W * H), sx = Math.round(cx), sy = Math.round(Math.min(H - 1, fy0 + fh * 1.5)), st = [sy * W + sx]; keep[st[0]] = 1;
    while (st.length) { const j = st.pop(), x = j % W; for (const k of [j - 1, j + 1, j - W, j + W]) if (k >= 0 && k < W * H && m[k] && !keep[k] && Math.abs((k % W) - x) <= 1) { keep[k] = 1; st.push(k); } }
    // contour from row extents (fills holes and smooths)
    let yTop = H, yBot = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (keep[y * W + x]) { yTop = Math.min(yTop, y); yBot = Math.max(yBot, y); }
    if (yTop >= yBot) return [[fx0 - fw * .2, fy0 - fh * .2], [fx0 + fw * 1.2, fy0 - fh * .2], [cx + fw * 1.3, H - 1], [cx - fw * 1.3, H - 1]];
    const L = [], R = [], step = Math.max(2, Math.round((yBot - yTop) / 15));
    for (let y = yTop; y <= yBot; y += step) {
      let a = -1, b = -1; for (let x = 0; x < W; x++) if (keep[y * W + x]) { if (a < 0) a = x; b = x; }
      if (a >= 0) { L.push([a - .5, y]); R.push([b + .5, y]); }
    }
    // light smoothing of the edges
    const sm = arr => arr.map((p, i) => i === 0 || i === arr.length - 1 ? p : [(arr[i - 1][0] + p[0] * 2 + arr[i + 1][0]) / 4, p[1]]);
    const l = sm(L), r = sm(R);
    return [[cx, yTop - 1]].concat(r, l.reverse());
  }
  function kmeansLite(pts, k) { if (pts.length > 600) { const s = []; for (let i = 0; i < 600; i++) s.push(pts[Math.floor(i / 600 * pts.length)]); pts = s; } return kmeans(pts, k).map(c => c.c); }
  /* Garment details from the person mask: colours, pattern, sleeves, neckline, jacket, bottoms. */
  function clothing(at, mask, W, H, cx, chinY, fw, fh, yMax, skin, hairC) {
    const get = (xa, xb, ya, yb, step = 1) => { const out = []; for (let y = Math.max(0, Math.round(ya)); y < Math.min(H, Math.round(yb)); y += step) for (let x = Math.max(0, Math.round(xa)); x < Math.min(W, Math.round(xb)); x += step) if (mask[y * W + x]) out.push({ c: at(x, y), x, y }); return out; };
    const skinish = c => isSkin(...c) && dist(c, skin) < 70;
    const frac = (arr, f) => arr.length ? arr.filter(p => f(p.c)).length / arr.length : null;
    const tTop = chinY + fh * .08, tBot = Math.min(yMax, chinY + fh * 2.3);
    const torso = get(cx - fw * .78, cx + fw * .78, tTop, tBot);
    const clothPx = torso.filter(p => !skinish(p.c) && (!hairC || dist(p.c, hairC) > 30 || Math.abs(p.x - cx) < fw * .45));
    const out = { top: null, sleeves: null, neck: 'crew', pattern: 'solid', topColor: null, topColor2: null, bottom: null, bottomColor: null, detail: {} };
    if (clothPx.length < 20) return out;
    const cls = kmeans(clothPx.map(p => p.c), 3);
    const total = cls.reduce((a, c) => a + c.n, 0), c0 = cls[0], c1 = cls.find((c, i) => i > 0 && c.n > total * .14 && dist(c.c, c0.c) > 48);
    out.topColor = c0.c;
    // pattern: label a grid of torso samples as main / second colour and count colour changes
    let tH = 0, tV = 0, nH = 0, nV = 0, secX = 0, secN = 0;
    if (c1) {
      out.topColor2 = c1.c;
      const lab = new Map();
      for (const p of clothPx) { const l = dist(p.c, c0.c) < dist(p.c, c1.c) ? 0 : 1; lab.set(p.y * W + p.x, l); if (l) { secX += Math.abs(p.x - cx); secN++; } }
      for (const p of clothPx) {
        const l = lab.get(p.y * W + p.x), r = lab.get(p.y * W + p.x + 2), d = lab.get((p.y + 2) * W + p.x);
        if (r != null) { nH++; if (r !== l) tH++; } if (d != null) { nV++; if (d !== l) tV++; }
      }
      tH /= Math.max(1, nH); tV /= Math.max(1, nV);
      const sf = secN / clothPx.length, ratio = tV / (tH + .001), central = secN && secX / secN < fw * .3;
      // be conservative: straps, shadows and seat belts must not read as a pattern
      const balanced = sf > .18 && sf < .62;
      if (balanced && tV > .14 && ratio > 2.2) out.pattern = 'stripes';
      else if (balanced && tH > .14 && ratio < .45) out.pattern = 'vstripes';
      else if (balanced && tH > .12 && tV > .12 && ratio > .7 && ratio < 1.4) out.pattern = 'check';
      else if (central && sf > .06 && sf < .3) out.pattern = 'graphic';
      else if (sf > .08 && sf < .3 && tH > .06 && tV > .06) out.pattern = 'dots';
      out.detail = { tH: +tH.toFixed(3), tV: +tV.toFixed(3), sf: +sf.toFixed(2), central };
    }
    // open jacket: the centre strip differs from both sides
    const centre = median(clothPx.filter(p => Math.abs(p.x - cx) < fw * .15).map(p => p.c));
    const left = median(clothPx.filter(p => p.x < cx - fw * .4).map(p => p.c)), right = median(clothPx.filter(p => p.x > cx + fw * .4).map(p => p.c));
    const jacket = centre && left && right && dist(left, right) < 45 && dist(centre, left) > 65 && dist(centre, right) > 65;
    // sleeves and neckline from skin in key regions
    const sh = get(cx - fw * 1.0, cx - fw * .5, chinY, chinY + fh * .35).concat(get(cx + fw * .5, cx + fw * 1.0, chinY, chinY + fh * .35));
    const up = get(cx - fw * 1.7, cx - fw * .82, chinY + fh * .2, chinY + fh * .85).concat(get(cx + fw * .82, cx + fw * 1.7, chinY + fh * .2, chinY + fh * .85));
    const fore = get(cx - fw * 1.9, cx - fw * .82, chinY + fh * .95, chinY + fh * 1.8).concat(get(cx + fw * .82, cx + fw * 1.9, chinY + fh * .95, chinY + fh * 1.8));
    const shS = frac(sh, skinish), upS = up.length > 12 ? frac(up, skinish) : null, foS = fore.length > 12 ? frac(fore, skinish) : null;
    out.sleeves = shS != null && shS > .42 ? 'none' : upS != null && upS > .4 ? 'short' : foS != null && foS > .4 ? 'short' : (upS != null || foS != null) ? 'long' : 'short';
    let depth = 0, wTop = 0, wBot = 0;
    for (let y = Math.round(chinY + fh * .04); y < Math.min(H, chinY + fh * 1.2); y++) {
      let run = 0; for (let x = Math.round(cx - fw * .5); x < cx + fw * .5; x++) if (mask[y * W + x] && skinish(at(x, y))) run++;
      if (run < fw * .14) break;
      if (!depth) wTop = run; wBot = run; depth++;
    }
    const d = depth / fh;
    out.neck = d > .45 ? (wBot < wTop * .5 ? 'v' : 'scoop') : 'crew';
    out.top = jacket ? 'jacket' : out.sleeves === 'none' ? 'tank' : out.sleeves === 'long' ? 'longsleeve' : 'tee';
    if (jacket) { out.topColor = left; out.topColor2 = centre; out.sleeves = 'long'; out.neck = 'crew'; if (out.pattern !== 'solid' && out.pattern !== 'check') out.pattern = 'solid'; }
    // bottoms, if the photo reaches below the waist
    if (yMax > tBot + fh * .6) {
      const low = get(cx - fw * 1.1, cx + fw * 1.1, tBot + fh * .1, yMax);
      const lc = median(low.filter(p => !skinish(p.c)).map(p => p.c));
      if (lc) { out.bottomColor = lc; out.bottom = frac(get(cx - fw * 1.1, cx + fw * 1.1, tBot + fh * 1.2, yMax), skinish) > .35 ? 'shorts' : 'pants'; }
    }
    out.detail = Object.assign(out.detail, { shS, upS, foS, neckDepth: +d.toFixed(2), jacket: !!jacket });
    return out;
  }
  /* Small preview of the photo with the detected face outlined. */
  function preview(res, size = 120) {
    const src = res.debug.cv, c = document.createElement('canvas');
    const s = size / Math.max(src.width, src.height); c.width = Math.round(src.width * s); c.height = Math.round(src.height * s);
    const x = c.getContext('2d'); x.drawImage(src, 0, 0, c.width, c.height);
    const [bx, by, bw, bh] = res.debug.box;
    x.strokeStyle = '#7cff8c'; x.lineWidth = 2; x.setLineDash([4, 3]);
    x.beginPath(); x.ellipse((bx + bw / 2) * c.width, (by + bh / 2) * c.height, bw / 2 * c.width * 1.1, bh / 2 * c.height * 1.05, 0, 0, 7); x.stroke();
    return c;
  }
  /* Loads the photo; the image is kept in memory only while the editor is open. */
  function fromFile(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => { try { const r = analyze(img); r.img = img; r.url = url; res(r); } catch (e) { URL.revokeObjectURL(url); rej(e); } };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('That file could not be opened as an image.')); };
      img.src = url;
    });
  }
  function pixel(res, fx, fy) { const c = res.debug.cv, x = c.getContext('2d').getImageData(Math.round(fx * (c.width - 1)), Math.round(fy * (c.height - 1)), 1, 1).data; return [x[0], x[1], x[2]]; }
  return { fromFile, analyze, preview, pixel };
})();
