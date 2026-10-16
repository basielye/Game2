/* Isometric maths and drawing primitives for the Cottage.
   World units: x,y in tiles (x → screen down-right, y → screen down-left), z in pixels at zoom 1. */
const Iso = (() => {
  const TW = 64, TH = 32, WALL_H = 96, CUT_H = 20;
  const P = (x, y, z = 0) => [(x - y) * TW / 2, (x + y) * TH / 2 - z];
  const unP = (sx, sy) => { const a = sx / (TW / 2), b = sy / (TH / 2); return [(a + b) / 2, (b - a) / 2]; };

  function poly(ctx, pts, fill, stroke, lw = 1) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  }
  const shadeCache = {};
  function sh(c, a) { const k = c + a; return shadeCache[k] || (shadeCache[k] = U.shade(c, a)); }

  /* An axis-aligned cuboid. Lit from the upper left: south faces mid, east faces dark. */
  function box(ctx, x0, y0, z0, x1, y1, z1, c, o = {}) {
    const glass = c[0] !== '#';
    const top = o.top || (glass ? c : sh(c, .1));
    poly(ctx, [P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)], o.east || (glass ? c : sh(c, -.24)));
    poly(ctx, [P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)], o.south || (glass ? c : sh(c, -.08)));
    poly(ctx, [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], top);
    if (o.line !== false) {
      ctx.strokeStyle = 'rgba(30,25,20,.28)'; ctx.lineWidth = .8; ctx.beginPath();
      const a = P(x0, y1, z1), b = P(x1, y1, z1), d = P(x1, y0, z1), e = P(x1, y1, z0);
      ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(d[0], d[1]); ctx.moveTo(b[0], b[1]); ctx.lineTo(e[0], e[1]); ctx.stroke();
    }
  }
  /* Flat ellipse lying on a horizontal plane. */
  function disc(ctx, x, y, z, r, fill, stroke) {
    const [sx, sy] = P(x, y, z);
    ctx.beginPath(); ctx.ellipse(sx, sy, r * TW * .7, r * TH * .7, 0, 0, 7);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  }
  /* Vertical cylinder. */
  function cyl(ctx, x, y, z0, z1, r, c) {
    const [sx, sy0] = P(x, y, z0), sy1 = sy0 - (z1 - z0), rx = r * TW * .7, ry = r * TH * .7;
    const g = ctx.createLinearGradient(sx - rx, 0, sx + rx, 0);
    g.addColorStop(0, sh(c, .05)); g.addColorStop(.6, sh(c, -.12)); g.addColorStop(1, sh(c, -.3));
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(sx, sy0, rx, ry, 0, 0, Math.PI); ctx.lineTo(sx - rx, sy1); ctx.ellipse(sx, sy1, rx, ry, 0, Math.PI, 0, true); ctx.closePath(); ctx.fill();
    ctx.fillStyle = sh(c, .12); ctx.beginPath(); ctx.ellipse(sx, sy1, rx, ry, 0, 0, 7); ctx.fill();
  }
  /* Image billboard standing on the floor. */
  const imgCache = {};
  function svgImage(key, svgText) {
    if (imgCache[key]) return imgCache[key];
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
    imgCache[key] = img; return img;
  }
  return { TW, TH, WALL_H, CUT_H, P, unP, poly, box, disc, cyl, sh, svgImage };
})();
