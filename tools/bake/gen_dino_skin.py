"""Tileable reptile skin: pebble scales (Voronoi), raised tubercles, fold wrinkles.
Output public/textures/dino_a.webp (grey detail albedo w/ cavity), dino_n.webp (normal RGB + roughness A)."""
import numpy as np, os
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '../../public/textures')
N = 1024
rng = np.random.default_rng(77)

def spectral(n, beta, sx=1.0, sy=1.0, seed=0):
    r = np.random.default_rng(seed)
    fx = np.fft.fftfreq(n)[None, :] * sx; fy = np.fft.fftfreq(n)[:, None] * sy
    f = np.sqrt(fx * fx + fy * fy); f[0, 0] = 1
    a = 1 / f ** (beta / 2); a[0, 0] = 0
    o = np.real(np.fft.ifft2(a * np.exp(2j * np.pi * r.random((n, n)))))
    return (o - o.mean()) / (o.std() + 1e-9)

def voronoi(n, count, seed, jitter=1.0):
    """Tileable F1/F2 Voronoi via a jittered grid, evaluated with wrap-around."""
    r = np.random.default_rng(seed)
    g = int(np.sqrt(count))
    cell = n / g
    pts = (np.stack(np.meshgrid(np.arange(g), np.arange(g)), -1).reshape(-1, 2) + 0.5 + (r.random((g * g, 2)) - 0.5) * jitter) * cell
    from scipy.spatial import cKDTree
    pts = np.mod(pts, n)
    Y, X = np.mgrid[0:n, 0:n].astype(np.float32)
    d, i = cKDTree(pts, boxsize=n).query(np.stack([X.ravel() + 0.5, Y.ravel() + 0.5], 1), k=2)
    f1 = d[:, 0].reshape(n, n); f2 = d[:, 1].reshape(n, n); idx = i[:, 0].reshape(n, n)
    return f1 / cell, f2 / cell, idx, len(pts)

def norm_from_h(h, s):
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5 * s
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5 * s
    n = np.stack([-dx, dy, np.ones_like(h)], -1)
    return n / np.linalg.norm(n, axis=-1, keepdims=True)

print('voronoi small'); f1, f2, idx, npts = voronoi(N, 70 * 70, 1, 0.9)
print('voronoi big'); g1, g2, gidx, gpts = voronoi(N, 12 * 12, 2, 0.8)
# pebble scales: domed cells with crisp grooves
edge = f2 - f1
dome = np.clip(edge * 2.2, 0, 1) ** 0.6
cellv = np.random.default_rng(3).random(npts)[idx]
h = dome * (0.8 + 0.4 * cellv)
# tubercles: occasional larger raised scales in clusters
gedge = g2 - g1
tub = np.clip(1 - g1 * 2.6, 0, 1) ** 1.5 * (np.random.default_rng(4).random(gpts)[gidx] > 0.45)
h = h * (1 - tub * 0.6) + tub * 2.2 + np.clip(gedge * 3, 0, 1) * 0.15
# folds / wrinkles (anisotropic, running across the body)
wr = spectral(N, 2.2, sx=0.25, sy=1.0, seed=5)
folds = np.abs(np.sin(wr * 2.4)) ** 3
h -= folds * 0.6
fine = spectral(N, 1.0, seed=6)
h += fine * 0.05
nrm = norm_from_h(h, 4.0)
groove = 1 - np.clip(edge * 6, 0, 1)
cav = np.clip(1 - groove * 0.3 - folds * 0.2, 0, 1)
# albedo detail: lighter scale tops, darker grooves, per-scale variation, blotches
blot = spectral(N, 2.8, seed=7)
alb = np.clip(0.62 + 0.18 * (dome - 0.5) + 0.1 * (cellv - 0.5) + 0.06 * blot + tub * 0.08, 0, 1) * cav
rough = np.clip(0.62 + groove * 0.2 - dome * 0.12 + tub * -0.05 + 0.04 * fine, 0.3, 0.95)
Image.fromarray((np.clip(alb, 0, 1) * 255).astype(np.uint8), 'L').save(f'{OUT}/dino_a.webp', quality=90, method=4)
Image.fromarray(np.concatenate([(nrm * 0.5 + 0.5) * 255, rough[..., None] * 255], -1).astype(np.uint8), 'RGBA').save(f'{OUT}/dino_n.webp', quality=92, method=4)
print('done')
