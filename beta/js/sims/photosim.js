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

    // map onto Sim options
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
      age: grey ? 'elder' : 'adult', topColor: shirt ? stylise(shirt, 1.2) : null,
      crop: [cx0, cy0, cw0, ch0], picked: opt.hair || null,
      debug: { cv, box: [fx0 / W, fy0 / H, fw / W, fh / H], hairAbove, ringFrac, longL, longR, ratio, jawSkin, clusters: cl.map(c => toHex(c.c) + ':' + c.n + '/' + Math.round(c.w)) }
    };
    return result;
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
