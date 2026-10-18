"""Procedural PBR building materials (tileable): weathered plank siding, rusty corrugated iron, concrete, cedar shingles.
Output: public/textures/build/<name>_a.webp (albedo, AO baked) and <name>_n.webp (normal RGB + roughness A).
"""
import numpy as np, os
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '../../public/textures/build')
os.makedirs(OUT, exist_ok=True)
N = 1024
rng = np.random.default_rng(1234)

def spectral(n, beta=2.0, sx=1.0, sy=1.0, seed=None):
    """Tileable fractal noise via FFT; sx/sy stretch the features (sx>1 → longer along x)."""
    r = np.random.default_rng(seed) if seed is not None else rng
    fx = np.fft.fftfreq(n)[None, :] * sx
    fy = np.fft.fftfreq(n)[:, None] * sy
    f = np.sqrt(fx * fx + fy * fy); f[0, 0] = 1
    amp = 1 / f ** (beta / 2); amp[0, 0] = 0
    ph = np.exp(2j * np.pi * r.random((n, n)))
    out = np.real(np.fft.ifft2(amp * ph))
    out -= out.mean(); out /= out.std() + 1e-9
    return out

def norm01(a):
    return (a - a.min()) / (a.max() - a.min() + 1e-9)

def to_normal(h, strength):
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5 * strength
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5 * strength
    n = np.stack([-dx, dy, np.ones_like(h)], -1)
    return n / np.linalg.norm(n, axis=-1, keepdims=True)

def blur(a, r):
    k = int(r * 3) | 1
    x = np.arange(k) - k // 2
    g = np.exp(-x * x / (2 * r * r)); g /= g.sum()
    for ax in (0, 1):
        a = sum(np.roll(a, int(s), ax) * w for s, w in zip(x, g))
    return a

def save(name, alb, h, rough, strength=6.0, ao=None):
    if ao is not None: alb = alb * ao[..., None]
    nrm = to_normal(h, strength)
    A = Image.fromarray((np.clip(alb, 0, 1) ** (1 / 2.2) * 255).astype(np.uint8), 'RGB')
    Nn = np.concatenate([(nrm * 0.5 + 0.5) * 255, np.clip(rough, 0, 1)[..., None] * 255], -1).astype(np.uint8)
    A.save(f'{OUT}/{name}_a.webp', quality=90, method=4)
    Image.fromarray(Nn, 'RGBA').save(f'{OUT}/{name}_n.webp', quality=92, method=4)
    print('wrote', name)

Y, X = np.mgrid[0:N, 0:N].astype(np.float32)

# ------------------------------------------------------------------ weathered plank siding
def planks():
    boards = 8                       # texture = 1.2 m tall → 15 cm boards
    bh = N / boards
    alb = np.zeros((N, N, 3)); h = np.zeros((N, N)); rough = np.zeros((N, N)); ao = np.ones((N, N))
    grain_f = spectral(N, 2.6, sx=0.04, sy=1.0, seed=3)       # long streaks along x
    fine = spectral(N, 1.2, sx=0.15, sy=1.0, seed=4)
    blotch = spectral(N, 3.0, seed=5)
    dirt = spectral(N, 2.2, seed=6)
    pal = np.array([[0.34, 0.24, 0.16], [0.40, 0.29, 0.19], [0.28, 0.20, 0.13], [0.42, 0.35, 0.27], [0.36, 0.27, 0.18], [0.30, 0.22, 0.15]])
    for b in range(boards):
        y0 = int(b * bh); y1 = int((b + 1) * bh)
        # each board row has 1-2 butt joints at random x
        joints = sorted(rng.choice(np.arange(120, N - 120), size=1, replace=False)) if rng.random() < 0.45 else []
        segs = [0] + list(joints) + [N]
        for s in range(len(segs) - 1):
            x0, x1 = segs[s], segs[s + 1]
            sl = (slice(y0, y1), slice(x0, x1))
            c = pal[rng.integers(len(pal))] * rng.uniform(0.85, 1.15)
            yy = (Y[sl] - y0) / bh
            off = rng.uniform(0, 100)
            # growth rings seen edge-on: warped stripes
            warp = grain_f[sl] * 0.9 + np.sin((X[sl] + off * 7) / rng.uniform(90, 220)) * 0.6
            rings = np.sin((yy * rng.uniform(3, 6) + warp * 0.6) * np.pi * 2)
            ringm = norm01(rings) ** 6
            wood = c * (0.8 + 0.28 * ringm[..., None] + 0.12 * fine[sl][..., None] + 0.12 * grain_f[sl][..., None])
            # sun-bleached grey weathering + dark water staining
            weather = np.clip(0.3 + 0.3 * blotch[sl] + 0.2 * rng.uniform(-1, 1), 0, 1)
            grey = np.array([0.50, 0.48, 0.45]) * (0.85 + 0.2 * fine[sl][..., None])
            wood = wood * (1 - weather[..., None] * 0.55) + grey * weather[..., None] * 0.55
            stain = np.clip(dirt[sl] * 0.5 - 0.3, 0, 1)
            wood *= (1 - stain[..., None] * 0.45)
            alb[sl] = wood
            # board profile: lap siding – thicker at bottom, bevel at top; cupping
            prof = 0.25 + yy * 0.75 - 0.15 * (yy - 0.5) ** 2
            h[sl] = prof + ringm * 0.06 + fine[sl] * 0.02 + grain_f[sl] * 0.03
            rough[sl] = 0.78 + 0.1 * weather - 0.06 * ringm + 0.04 * fine[sl]
            # butt-joint gap and nails
            for xj in (x0, x1 - 1):
                if 0 < xj < N - 1:
                    xs = slice(max(xj - 2, 0), min(xj + 2, N))
                    h[y0:y1, xs] -= 0.25; ao[y0:y1, xs] *= 0.65
            for xn in (x0 + 18, x1 - 18):
                if 18 < xn < N - 18:
                    for yn in (y0 + int(bh * 0.7),):
                        rr = (X - xn) ** 2 + (Y - yn) ** 2
                        m = rr < 16
                        alb[m] = np.array([0.12, 0.09, 0.07]); h[m] -= 0.08
                        streak = (np.abs(X - xn) < 3) & (Y > yn) & (Y < yn + rng.integers(20, 60))
                        alb[streak] *= np.array([0.7, 0.55, 0.45])
        # shadow line under each board's lap
        gap = slice(y0, min(y0 + 4, N))
        ao[gap] *= np.linspace(0.25, 1, 4)[: ao[gap].shape[0], None]
        h[gap] -= 0.2
    ao = np.clip(blur(ao, 1.2), 0, 1)
    save('planks', alb, blur(h, 0.8) * 12, rough, 5.0, ao)

# ------------------------------------------------------------------ corrugated iron (rusty, galvanised)
def corrugated():
    pitch = N / 16                                   # 1.2 m tile → 7.5 cm pitch
    prof = np.sin(X / pitch * np.pi * 2)
    rust_n = spectral(N, 2.4, seed=11)
    rust_f = spectral(N, 1.4, seed=12)
    runs = spectral(N, 2.0, sx=1.0, sy=0.05, seed=13)  # vertical rust runs
    rust = np.clip((rust_n * 0.6 + runs * 0.5 + 0.1 * rust_f) * 0.9 - 0.2 + (prof < -0.6) * 0.25, 0, 1)
    rust = rust ** 0.8
    galv = np.array([0.55, 0.57, 0.58]) * (0.85 + 0.1 * rust_f[..., None] + 0.05 * runs[..., None])
    rc = np.array([0.26, 0.12, 0.06]) * (0.7 + 0.5 * norm01(rust_f)[..., None])
    alb = galv * (1 - rust[..., None]) + rc * rust[..., None]
    # dirt collecting in troughs
    alb *= (0.85 + 0.15 * (prof[..., None] * 0.5 + 0.5))
    h = prof * 1.0 + rust * 0.04 * rust_f
    rough = 0.42 + rust * 0.5 + 0.05 * rust_f
    ao = 0.75 + 0.25 * (prof * 0.5 + 0.5)
    save('metal', alb, h * 5, rough, 3.0, ao)

# ------------------------------------------------------------------ cast concrete (old Visitor Center)
def concrete():
    base = spectral(N, 2.6, seed=21); fine = spectral(N, 0.8, seed=22); pits = rng.random((N, N))
    streak = spectral(N, 2.0, sx=1.0, sy=0.08, seed=23)
    l = 0.52 + 0.06 * base + 0.03 * fine - 0.08 * np.clip(streak - 0.4, 0, 2)
    alb = np.stack([l * 1.0, l * 0.97, l * 0.92], -1)
    # formwork seams every 0.6 m (tile 1.2 m)
    seam = (np.abs((Y % (N / 2)) - 1) < 2)
    alb[seam] *= 0.7
    h = base * 0.1 + fine * 0.05 - (pits > 0.997) * 0.6 - seam * 0.4
    rough = 0.88 + 0.05 * fine
    save('concrete', alb, blur(h, 0.7) * 6, rough, 4.0, None)

# ------------------------------------------------------------------ cedar shingles roof
def shingles():
    rows = 10; rh = N / rows
    alb = np.zeros((N, N, 3)); h = np.zeros((N, N)); ao = np.ones((N, N))
    fine = spectral(N, 1.3, sx=1.0, sy=0.1, seed=31); moss = spectral(N, 2.8, seed=32)
    for r in range(rows):
        y0 = int(r * rh); y1 = int((r + 1) * rh)
        x = 0; shift = rng.uniform(0, 60)
        edges = []
        while x < N:
            w = rng.uniform(55, 120); edges.append(x); x += w
        for i, x0 in enumerate(edges):
            x1 = int(min(edges[i + 1] if i + 1 < len(edges) else N, N))
            x0 = int(x0)
            sl = (slice(y0, y1), slice(x0, x1))
            c = np.array([0.32, 0.25, 0.19]) * rng.uniform(0.7, 1.2)
            yy = (Y[sl] - y0) / rh
            alb[sl] = c * (0.85 + 0.2 * fine[sl][..., None])
            h[sl] = yy * 0.6 + fine[sl] * 0.05
            ao[y0:y1, max(x0 - 1, 0):x0 + 2] *= 0.5
        ao[y0:y0 + 5] *= np.linspace(0.3, 1, 5)[:, None]
    mm = np.clip(moss * 0.6 - 0.35, 0, 1)
    alb = alb * (1 - mm[..., None]) + np.array([0.16, 0.17, 0.09]) * mm[..., None]
    rough = 0.85 + 0.1 * mm
    save('shingles', alb, blur(h, 0.8) * 8, rough, 5.0, blur(ao, 1.0))

# ------------------------------------------------------------------ weathered asphalt (tile 4 m)
def asphalt():
    r = np.random.default_rng(41)
    base = spectral(N, 2.4, seed=42); fine = spectral(N, 0.6, seed=43)
    grit = r.random((N, N))
    stones = (grit > 0.985).astype(np.float32)
    stones = blur(stones, 0.8)
    l = 0.075 + 0.016 * base + 0.014 * fine + stones * 0.06
    # crack network: thin lines along ridges of a stretched noise field
    cr = spectral(N, 2.0, seed=44)
    cracks = np.clip(1 - np.abs(cr) * 7, 0, 1) ** 2 * (spectral(N, 3.0, seed=45) > 0.2)
    # tar-sealed patches and oil stains
    patch = (spectral(N, 3.2, seed=46) > 1.1).astype(np.float32); patch = blur(patch, 2.0)
    oil = np.clip(spectral(N, 2.6, seed=47) - 1.2, 0, 1)
    l = l * (1 - cracks * 0.5) * (1 - patch * 0.25) * (1 - oil * 0.35)
    alb = np.stack([l * 1.0, l * 0.99, l * 0.97], -1)
    h = stones * 0.5 + fine * 0.08 - cracks * 0.6 + patch * 0.1
    rough = np.clip(0.88 - stones * 0.15 - oil * 0.35 - patch * 0.08 + fine * 0.03, 0.35, 1)
    save('asphalt', alb, h * 4, rough, 3.0, None)

if __name__ == '__main__':
    import sys
    if 'asphalt' in sys.argv: asphalt()
    else: planks(); corrugated(); concrete(); shingles(); asphalt()
