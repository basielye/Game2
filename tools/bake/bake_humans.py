"""Bake game characters from MakeHuman CC0 assets into skinned GLBs sharing one texture atlas.
Output: public/models/humans/<name>.glb + public/textures/humans_{a,n}.webp
"""
import json, os, sys, struct, math, glob
import numpy as np
from PIL import Image, ImageFilter
import mhcore as M
from scipy.spatial import cKDTree

OUT = '/home/user/Game2/public'
PX = M.MH1 + '/proxies'
SK = M.MH1 + '/skins'

# ---------------------------------------------------------------- characters
F_EYES = dict(eyes='eyes/Low-Poly', eyecol='brown_eye.png', brows='eyebrows/eyebrow001', lashes='eyelashes/Eyelashes01')
CHARS = {
    'ava': dict(shape=dict(gender=0, muscle=0.66, weight=0.42, height=0.58, prop=1, race={'caucasian': 0.55, 'african': 0.15, 'asian': 0.3}, cup=0.55, firm=0.8),
                height=1.72, skin=('young_caucasian_female/textures/young_lightskinned_female_diffuse2.png', (0.93, 0.76, 0.62)),
                parts=[('clothes/Tank_Top_01', (0.5, 0.52, 0.36), 'lift'), ('clothes/Harvey_PantsBootsV1', (0.74, 0.6, 0.4), 'desat_left'), ('clothes/Rucksack1', (0.62, 0.6, 0.45), 'desat'),
                       ('hair/Braid01', (1.0, 0.85, 0.72))], braid=True, hair=(0.55, 0.42, 0.34), **F_EYES),
    'settlerM': dict(shape=dict(gender=1, muscle=0.6, weight=0.55, height=0.6, prop=0.8, race={'caucasian': 1}), height=1.8,
                     skin=('young_caucasian_male/textures/young_lightskinned_male_diffuse.png', (1, 0.92, 0.85)),
                     parts=[('clothes/male_worksuit01', (0.75, 0.68, 0.55)), ('clothes/shoes01', (0.8, 0.7, 0.6)), ('clothes/fedora', (1, 1, 1), 1),
                            ('hair/short02', (0.6, 0.45, 0.35)), ('hair/Full_beard', (0.75, 0.55, 0.4))], **F_EYES),
    'settlerF': dict(shape=dict(gender=0, muscle=0.5, weight=0.5, height=0.45, prop=0.8, race={'african': 0.7, 'caucasian': 0.3}, cup=0.5), height=1.68,
                     skin=('young_african_female/textures/young_darkskinned_female_diffuse.png', (1, 1, 1)),
                     parts=[('clothes/female_casualsuit01', (0.95, 0.8, 0.7)), ('clothes/shoes04', (0.8, 0.7, 0.6)), ('hair/Wig_bun_blonde', (0.28, 0.2, 0.16))], **F_EYES),
    'marshal': dict(shape=dict(gender=1, muscle=0.72, weight=0.55, height=0.7, prop=0.9, race={'african': 0.8, 'caucasian': 0.2}), height=1.86,
                    skin=('young_african_male/textures/young_darkskinned_male_diffuse.png', (1, 1, 1)),
                    parts=[('clothes/male_casualsuit06', (0.75, 0.72, 0.65)), ('clothes/Coat', (0.36, 0.27, 0.2), 'flat'), ('clothes/shoes03', (0.7, 0.6, 0.5)), ('clothes/fedora', (1, 1, 1), 0),
                           ('hair/short04', (0.3, 0.3, 0.3)), ('hair/Moustache', (0.4, 0.4, 0.4))], **F_EYES),
    'raider': dict(shape=dict(gender=1, muscle=0.75, weight=0.6, height=0.6, prop=0.6, race={'caucasian': 0.7, 'asian': 0.3}), height=1.8,
                   skin=('young_caucasian_male/textures/young_lightskinned_male_diffuse2.png', (0.95, 0.85, 0.78)),
                   parts=[('clothes/male_casualsuit03', (0.55, 0.5, 0.48)), ('clothes/Harvey_VestV1', (0.35, 0.28, 0.22), 'desat'), ('clothes/shoes03', (0.7, 0.6, 0.5)),
                          ('clothes/fedora_cocked', (1, 1, 1), 0), ('hair/short04', (0.5, 0.4, 0.32)), ('hair/Full_beard', (0.5, 0.38, 0.3))], **F_EYES),
    'raiderF': dict(shape=dict(gender=0, muscle=0.7, weight=0.4, height=0.6, prop=0.9, race={'caucasian': 0.6, 'african': 0.4}, cup=0.45), height=1.72,
                    skin=('young_caucasian_female/textures/young_lightskinned_female_diffuse.png', (0.95, 0.82, 0.7)),
                    parts=[('clothes/female_sportsuit01', (0.45, 0.4, 0.38)), ('clothes/Harvey_VestV1', (0.35, 0.25, 0.2), 'desat'), ('clothes/shoes06', (0.4, 0.38, 0.36)),
                           ('hair/ponytail01', (0.7, 0.35, 0.2))], **F_EYES),
    'crane': dict(shape=dict(gender=1, muscle=0.6, weight=0.65, height=0.8, prop=0.7, age={'young': 0.3, 'old': 0.7}, race={'caucasian': 1}), height=1.9,
                  skin=('old_caucasian_male/textures/old_lightskinned_male_diffuse.png', (1, 0.95, 0.9)),
                  parts=[('clothes/male_elegantsuit01', (0.6, 0.6, 0.6)), ('clothes/Coat', (0.16, 0.12, 0.11), 'flat'), ('clothes/shoes03', (0.5, 0.45, 0.4)), ('clothes/fedora', (1, 1, 1), 0),
                         ('hair/Full_beard', (1.0, 1.0, 1.0), 'grey')], **F_EYES),
    'doctor': dict(shape=dict(gender=0, muscle=0.45, weight=0.45, height=0.45, prop=0.9, age={'young': 0.7, 'old': 0.3}, race={'caucasian': 0.6, 'asian': 0.4}, cup=0.5), height=1.66,
                   skin=('middleage_caucasian_female/textures/middleage_lightskinned_female_diffuse.png', (1, 0.95, 0.9)),
                   parts=[('clothes/female_casualsuit02', (0.9, 0.9, 0.9)), ('clothes/Coat', (0.95, 0.95, 0.93), 'flat'), ('clothes/shoes04', (0.6, 0.55, 0.5)), ('hair/bob01', (0.75, 0.6, 0.4))], **F_EYES),
    'infected': dict(shape=dict(gender=1, muscle=0.4, weight=0.3, height=0.55, prop=0.4, race={'caucasian': 1}), height=1.76,
                     skin=('young_caucasian_male/textures/young_lightskinned_male_diffuse.png', (0.68, 0.74, 0.62)),
                     parts=[('clothes/male_casualsuit04', (0.6, 0.55, 0.48), 'grime'), ('clothes/shoes01', (0.5, 0.45, 0.4)), ('hair/short03', (0.4, 0.35, 0.3))],
                     infected=True, **dict(F_EYES, eyecol='ice_eye.png')),
    'infectedF': dict(shape=dict(gender=0, muscle=0.35, weight=0.3, height=0.45, prop=0.4, race={'caucasian': 0.5, 'african': 0.5}, cup=0.45), height=1.66,
                      skin=('young_caucasian_female/textures/young_lightskinned_female_diffuse.png', (0.66, 0.72, 0.6)),
                      parts=[('clothes/female_casualsuit01', (0.55, 0.5, 0.45), 'grime'), ('clothes/shoes06', (0.4, 0.38, 0.36)), ('hair/long01', (0.35, 0.28, 0.22))],
                      infected=True, **dict(F_EYES, eyecol='ice_eye.png')),
}

ROUGH = {'skin': 0.52, 'hair': 0.42, 'eyes': 0.08, 'cloth': 0.86, 'shoes': 0.55, 'hat': 0.8, 'lash': 0.6}

# ---------------------------------------------------------------- texture atlas
class Atlas:
    def __init__(self, W=4096, H=2560, slot=512):
        self.W, self.H, self.S = W, H, slot
        self.items = {}  # key -> rect (x,y,w,h) pixels
        self.free = [(x, y) for y in range(0, H, slot) for x in range(0, W, slot)]
        self.small = []  # free 256 cells
        self.alb = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        self.nrm = Image.new('RGBA', (W, H), (128, 128, 255, 220))

    def place(self, key, alb, nrm, size=512):
        if key in self.items: return self.items[key]
        if size == 256:
            if not self.small:
                x, y = self.free.pop(0)
                self.small = [(x, y), (x + 256, y), (x, y + 256), (x + 256, y + 256)]
            x, y = self.small.pop(0)
        else:
            x, y = self.free.pop(0)
        alb = alb.resize((size, size), Image.LANCZOS); nrm = nrm.resize((size, size), Image.LANCZOS)
        self.alb.paste(alb, (x, y)); self.nrm.paste(nrm, (x, y))
        self.items[key] = (x, y, size, size)
        return self.items[key]

    def uv(self, key, uv):
        x, y, w, h = self.items[key]
        # glTF uv: origin top-left. MakeHuman/three json uv: origin bottom-left (v up)
        u = (x + np.clip(uv[:, 0], 0, 1) * w) / self.W
        v = (y + (1 - np.clip(uv[:, 1], 0, 1)) * h) / self.H
        # keep half a texel inside the slot to limit bleeding
        u = np.clip(u, (x + 1) / self.W, (x + w - 1) / self.W)
        v = np.clip(v, (y + 1) / self.H, (y + h - 1) / self.H)
        return np.stack([u, v], 1)

def dilate(im, iters=24):
    """Push RGB into transparent texels so mip-maps and bilinear don't pull in black."""
    a = np.asarray(im).astype(np.float32)
    rgb, al = a[..., :3], a[..., 3:] / 255.0
    mask = (al > 0.02).astype(np.float32)
    acc, w = rgb * mask, mask.copy()
    cur_rgb, cur_w = acc.copy(), w.copy()
    out = rgb * mask
    filled = mask.copy()
    for i in range(iters):
        k = lambda x: (np.roll(x, 1, 0) + np.roll(x, -1, 0) + np.roll(x, 1, 1) + np.roll(x, -1, 1) + x)
        cur_rgb, cur_w = k(cur_rgb), k(cur_w)
        nf = (cur_w > 1e-4) & (filled < 0.5)
        out[nf[..., 0]] = (cur_rgb / np.maximum(cur_w, 1e-4))[nf[..., 0]]
        filled = np.maximum(filled, nf.astype(np.float32))
    mean = (rgb * mask).sum((0, 1)) / max(mask.sum(), 1)
    out[filled[..., 0] < 0.5] = mean
    return Image.fromarray(np.concatenate([np.clip(out, 0, 255), a[..., 3:]], -1).astype(np.uint8), 'RGBA')

def height_normal(im, strength=2.0, rough=0.85, blur=0.6):
    g = np.asarray(im.convert('L').filter(ImageFilter.GaussianBlur(blur))).astype(np.float32) / 255.0
    dx = (np.roll(g, -1, 1) - np.roll(g, 1, 1)) * strength
    dy = (np.roll(g, -1, 0) - np.roll(g, 1, 0)) * strength
    n = np.stack([-dx, dy, np.ones_like(g)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    rgb = (n * 0.5 + 0.5) * 255
    a = np.full(g.shape + (1,), rough * 255)
    return Image.fromarray(np.concatenate([rgb, a], -1).astype(np.uint8), 'RGBA')

def with_rough(nrm_img, rough):
    n = np.asarray(nrm_img.convert('RGB')).astype(np.float32)
    a = np.full(n.shape[:2] + (1,), rough * 255)
    return Image.fromarray(np.concatenate([n, a], -1).astype(np.uint8), 'RGBA')

def recolor(im, op):
    a = np.asarray(im.convert('RGBA')).astype(np.float32)
    rgb = a[..., :3]
    l = (rgb * [0.3, 0.59, 0.11]).sum(-1, keepdims=True)
    if op in ('desat', 'desat_left', 'lift'):
        al = a[..., 3] > 10
        m = l[al].mean() if al.any() else 128
        target = {'desat': 120, 'desat_left': 105, 'lift': 115}[op]
        g = np.clip((l - m) * {'desat': 1.2, 'desat_left': 0.55, 'lift': 1.6}[op] + target, 0, 255).repeat(3, -1)
        if op == 'desat_left':
            w = rgb.shape[1]; cut = int(w * 0.47)
            rgb = rgb.copy(); rgb[:, :cut] = g[:, :cut]
        elif op == 'lift':
            sat = (np.abs(rgb - l) .max(-1, keepdims=True) > 40)  # keep coloured trims
            rgb = np.where(sat, rgb, g)
        else:
            rgb = g
    elif op == 'flat':
        lb = np.asarray(Image.fromarray(l[..., 0].astype(np.uint8)).filter(ImageFilter.GaussianBlur(6))).astype(np.float32)[..., None]
        rng = np.random.default_rng(5)
        weave = rng.normal(0, 6, l.shape).astype(np.float32)
        rgb = np.clip(185 + (l - lb) * 1.4 + weave, 0, 255).repeat(3, -1)
    elif op == 'grey':
        rgb = np.clip(l * 1.6 + 70, 0, 255).repeat(3, -1)
    elif op == 'grime':
        rng = np.random.default_rng(3)
        h, w = l.shape[:2]
        noise = np.asarray(Image.fromarray((rng.random((h // 16, w // 16)) * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)).astype(np.float32)[..., None] / 255
        stain = np.clip((noise - 0.45) * 3, 0, 1)
        rgb = rgb * (1 - stain * 0.55) + np.array([70, 40, 30]) * stain * 0.4
    return Image.fromarray(np.concatenate([rgb, a[..., 3:]], -1).astype(np.uint8), 'RGBA')

def skin_detail(im):
    """Photographic MakeHuman skin + procedural pores/micro-normal; roughness varies (lips/nose shinier)."""
    rng = np.random.default_rng(7)
    s = 1024
    im = im.convert('RGBA').resize((s, s), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32)
    # high-frequency pore normal
    n1 = rng.random((s, s)).astype(np.float32)
    n1 = np.asarray(Image.fromarray((n1 * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))).astype(np.float32) / 255
    lum = np.asarray(im.convert('L').filter(ImageFilter.GaussianBlur(1.2))).astype(np.float32) / 255
    h = n1 * 0.18 + lum * 0.35
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 1.2
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 1.2
    n = np.stack([-dx, dy, np.ones_like(h)], -1); n /= np.linalg.norm(n, axis=-1, keepdims=True)
    red = np.clip((a[..., 0] - a[..., 1]) / 80 - 0.6, 0, 1)  # lips / flushed areas → smoother
    rough = np.clip(0.55 - red * 0.2 + (n1 - 0.5) * 0.08, 0.3, 0.7)
    nrm = Image.fromarray(np.concatenate([(n * 0.5 + 0.5) * 255, rough[..., None] * 255], -1).astype(np.uint8), 'RGBA')
    alb = Image.fromarray(np.concatenate([a[..., :3], np.full((s, s, 1), 255)], -1).astype(np.uint8), 'RGBA')
    return alb, nrm

# ---------------------------------------------------------------- geometry helpers
def triangulate(faces, mat=None):
    T, TU = [], []
    for vs, m, uvs in faces:
        if mat is not None and m != mat: continue
        if len(vs) == 4:
            T += [(vs[0], vs[1], vs[2]), (vs[0], vs[2], vs[3])]
            TU += [(uvs[0], uvs[1], uvs[2]), (uvs[0], uvs[2], uvs[3])] if uvs else [(0, 0, 0)] * 2
        else:
            T.append(tuple(vs)); TU.append(tuple(uvs) if uvs else (0, 0, 0))
    return np.array(T, dtype=np.int64).reshape(-1, 3), np.array(TU, dtype=np.int64).reshape(-1, 3)

def vnormals(P, T):
    N = np.zeros_like(P)
    fn = np.cross(P[T[:, 1]] - P[T[:, 0]], P[T[:, 2]] - P[T[:, 0]])
    for k in range(3): np.add.at(N, T[:, k], fn)
    l = np.linalg.norm(N, axis=1, keepdims=True); l[l == 0] = 1
    return N / l

def split_uv(P, N, T, TU, UV, extra):
    """Unweld into unique (pos, uv) pairs."""
    key = T.astype(np.int64) * (len(UV) + 1) + TU
    uniq, inv = np.unique(key.ravel(), return_inverse=True)
    pi = uniq // (len(UV) + 1); ui = uniq % (len(UV) + 1)
    out = dict(P=P[pi], N=N[pi], UV=UV[ui], T=inv.reshape(-1, 3))
    for k, v in extra.items(): out[k] = v[pi]
    return out

def rot(axis, ang):
    axis = axis / np.linalg.norm(axis)
    K = np.array([[0, -axis[2], axis[1]], [axis[2], 0, -axis[0]], [-axis[1], axis[0], 0]])
    return np.eye(3) + math.sin(ang) * K + (1 - math.cos(ang)) * K @ K

def rotate_partial(P, factor, pivot, axis, ang):
    """Rotate each point around pivot by ang*factor (no LBS volume collapse)."""
    out = P.copy()
    for i in np.nonzero(factor > 1e-4)[0]:
        R = rot(axis, ang * factor[i])
        out[i] = pivot + R @ (P[i] - pivot)
    return out

def rotate_partial_fast(P, factor, pivot, axis, ang):
    axis = axis / np.linalg.norm(axis)
    th = (ang * factor)[:, None]
    v = P - pivot
    c, s = np.cos(th), np.sin(th)
    return pivot + v * c + np.cross(axis, v) * s + axis * (v @ axis)[:, None] * (1 - c)

# ---------------------------------------------------------------- GLB writer
def write_glb(path, mesh, joints, parents, inv_bind):
    bufs = []
    views, accs = [], []
    def add(arr, target=None, comp=5126, typ='VEC3', normalized=False, minmax=False):
        b = arr.tobytes()
        off = sum(len(x) for x in bufs)
        pad = (-len(b)) % 4
        bufs.append(b + b'\0' * pad)
        v = {'buffer': 0, 'byteOffset': off, 'byteLength': len(b)}
        if target: v['target'] = target
        views.append(v)
        a = {'bufferView': len(views) - 1, 'componentType': comp, 'count': int(arr.shape[0]), 'type': typ}
        if normalized: a['normalized'] = True
        if minmax: a['min'] = arr.min(0).tolist(); a['max'] = arr.max(0).tolist()
        accs.append(a)
        return len(accs) - 1
    attrs = {
        'POSITION': add(mesh['P'].astype(np.float32), 34962, minmax=True),
        'NORMAL': add(mesh['N'].astype(np.float32), 34962),
        'TEXCOORD_0': add(mesh['UV'].astype(np.float32), 34962, typ='VEC2'),
        'COLOR_0': add((np.clip(np.concatenate([mesh['C'], mesh['S'][:, None]], 1), 0, 1) * 255).astype(np.uint8), 34962, comp=5121, typ='VEC4', normalized=True),
        'JOINTS_0': add(mesh['J'].astype(np.uint8), 34962, comp=5121, typ='VEC4'),
        'WEIGHTS_0': add(mesh['W'].astype(np.float32), 34962, typ='VEC4'),
    }
    import io
    bio = io.BytesIO(); Image.new('RGB', (1, 1), (255, 255, 255)).save(bio, 'PNG'); png = bio.getvalue()
    off = sum(len(x) for x in bufs); bufs.append(png + b'\0' * ((-len(png)) % 4))
    views.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(png)}); img_view = len(views) - 1
    idx = mesh['T'].reshape(-1)
    ia = add(idx.astype(np.uint32), 34963, comp=5125, typ='SCALAR')
    ibm = add(inv_bind.astype(np.float32).reshape(-1, 16), None, typ='MAT4')
    nodes = [{'name': 'body', 'mesh': 0, 'skin': 0}]
    jn = []
    for i, (name, t) in enumerate(joints):
        nodes.append({'name': name, 'translation': [float(x) for x in t]})
        jn.append(len(nodes) - 1)
    for i, p in enumerate(parents):
        if p is not None:
            nodes[jn[p]].setdefault('children', []).append(jn[i])
    root = jn[[i for i, p in enumerate(parents) if p is None][0]]
    gltf = {
        'asset': {'version': '2.0', 'generator': 'jurassic-frontier makehuman baker'},
        'scene': 0, 'scenes': [{'nodes': [0, root]}],
        'nodes': nodes,
        'meshes': [{'name': 'body', 'primitives': [{'attributes': attrs, 'indices': ia, 'material': 0}]}],
        'materials': [{'name': 'human', 'pbrMetallicRoughness': {'baseColorFactor': [1, 1, 1, 1], 'metallicFactor': 0, 'roughnessFactor': 1, 'baseColorTexture': {'index': 0}}, 'alphaMode': 'MASK', 'alphaCutoff': 0.5, 'doubleSided': True}],
        'skins': [{'joints': jn, 'inverseBindMatrices': ibm, 'skeleton': root}],
        'images': [{'bufferView': img_view, 'mimeType': 'image/png'}], 'textures': [{'source': 0}],
        'accessors': accs, 'bufferViews': views,
        'buffers': [{'byteLength': sum(len(x) for x in bufs)}],
    }
    js = json.dumps(gltf, separators=(',', ':')).encode()
    js += b' ' * ((-len(js)) % 4)
    bin_ = b''.join(bufs)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(bin_)))
        f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack('<II', len(bin_), 0x004E4942)); f.write(bin_)

# ---------------------------------------------------------------- build one character
def proxy_file(rel):
    return glob.glob(f'{PX}/{rel}/*.json')[0]

def category(rel):
    if rel.startswith('hair'): return 'hair'
    if 'shoes' in rel or 'Boots' in rel: return 'shoes'
    if 'fedora' in rel: return 'hat'
    return 'cloth'

def build(name, C, atlas):
    B = M.base()
    V, _ = M.shape(C['shape'])
    Wg = M.game_weights()                       # (nv, nb)
    gi = {b: i for i, b in enumerate(M.GAME_BONES)}
    J = M.joints_pos(V)

    # --- repose arms from MakeHuman's A-pose to hanging at the sides (per-vertex fractional rotation)
    def chain(k): return Wg[:, gi['arm' + k]] + Wg[:, gi['elbow' + k]] + Wg[:, gi['hand' + k]]
    def fore(k): return Wg[:, gi['elbow' + k]] + Wg[:, gi['hand' + k]]
    shoulder01 = np.zeros(len(V))
    for bi, bn in enumerate(B['bones']):
        pass
    # partial weight for the deltoid/shoulder01 region so the armpit folds smoothly
    sh_idx = {k: [i for i, n in enumerate(B['bones']) if n.startswith(f'shoulder01.{k}')] for k in 'LR'}
    reposes = []
    for k, sx in (('L', 1), ('R', -1)):
        a0, e0, h0 = J['arm' + k], J['elbow' + k], J['hand' + k]
        up = e0 - a0
        target = np.array([sx * 0.13, -1.0, 0.02]); target /= np.linalg.norm(target)
        axis = np.cross(up / np.linalg.norm(up), target); ang = math.asin(min(1, np.linalg.norm(axis)))
        f_sh = np.zeros(len(V))
        for bi in sh_idx[k]:
            for c in range(4): f_sh += np.where(B['si'][:, c] == bi, B['sw'][:, c], 0)
        fac = np.clip(chain(k) + 0.45 * f_sh, 0, 1)
        reposes.append(('upper', k, a0, axis, ang, fac))
        V = rotate_partial_fast(V, fac, a0, axis, ang)
        J = M.joints_pos(V)
        e1, h1 = J['elbow' + k], J['hand' + k]
        fv = h1 - e1
        t2 = np.array([sx * 0.06, -1.0, 0.16]); t2 /= np.linalg.norm(t2)
        ax2 = np.cross(fv / np.linalg.norm(fv), t2); ang2 = math.asin(min(1, np.linalg.norm(ax2)))
        fac2 = np.clip(fore(k), 0, 1)
        reposes.append(('fore', k, e1, ax2, ang2, fac2))
        V = rotate_partial_fast(V, fac2, e1, ax2, ang2)
        J = M.joints_pos(V)
    V0shape, _ = M.shape(C['shape'])  # unposed copy for proxy fitting

    # --- body faces (drop helper geometry), delete hidden-under-clothes verts
    hidden = np.zeros(len(V), dtype=bool)
    proxies = []
    for part in C['parts']:
        rel, tint = part[0], part[1]
        opt = part[2] if len(part) > 2 else None
        p = M.load_proxy(proxy_file(rel))
        if p['delete'] is not None and len(p['delete']) == len(V): hidden |= p['delete']
        proxies.append((rel, tint, opt, p))
    for key in ('eyes', 'brows', 'lashes'):
        p = M.load_proxy(proxy_file(C[key])); proxies.append((C[key], (1, 1, 1), key, p))

    pieces = []
    # body
    T, TU = triangulate(B['faces'], mat=0)
    keep = ~(hidden[T].all(1))
    T, TU = T[keep], TU[keep]
    N = vnormals(V, T)
    T_all, _ = triangulate(B['faces'])
    BNall = vnormals(V, T_all)
    skin_path, skin_tint = C['skin']
    key = 'skin:' + skin_path
    if key not in atlas.items:
        alb, nrm = skin_detail(Image.open(f'{SK}/{skin_path}'))
        atlas.place(key, alb, nrm)
    body = split_uv(V, N, T, TU, B['uv'], {'W': Wg})
    body['UV'] = atlas.uv(key, body['UV'])
    body['C'] = np.tile(np.array(skin_tint), (len(body['P']), 1))
    body['S'] = np.ones(len(body['P']))
    pieces.append(body)

    # --- fit in rest space and layer garments by their height above the body surface
    T0, _ = triangulate(B['faces'])
    BN0 = vnormals(V0shape, T0)
    fits = {}
    for rel, tint, opt, p in proxies:
        P0 = M.fit_proxy(p, V0shape)
        bp = (V0shape[p['ref']] * p['w'][:, :, None]).sum(1)
        bn = (BN0[p['ref']] * p['w'][:, :, None]).sum(1); bn /= np.maximum(np.linalg.norm(bn, axis=1, keepdims=True), 1e-6)
        if 'Coat' in rel: P0 = P0 + bn * 0.06
        h = ((P0 - bp) * bn).sum(1)
        fits[rel] = dict(P0=P0, bp=bp, bn=bn, h=h)
    rank = lambda rel: 3 if 'Coat' in rel else 2 if 'Vest' in rel else 0
    for orel, of in fits.items():
        r = rank(orel); hat = 'fedora' in orel
        if r == 0 and not hat: continue
        tree = cKDTree(of['bp'])
        for irel, f in fits.items():
            if irel == orel: continue
            if hat:
                if not irel.startswith('hair') or 'beard' in irel or 'Moustache' in irel: continue
            elif rank(irel) >= r or irel.startswith('hair') or 'shoes' in irel or 'Rucksack' in irel or irel.startswith(('eyes', 'eyebrows', 'eyelashes')): continue
            nb = tree.query_ball_point(f['bp'], 0.35)
            margin = 0.1
            for i, lst in enumerate(nb):
                if not lst: continue
                hmax = of['h'][lst].max()
                if f['h'][i] > hmax - margin:
                    nh = max(hmax - margin, 0.015)
                    f['P0'][i] += f['bn'][i] * (nh - f['h'][i]); f['h'][i] = nh
    for rel, tint, opt, p in proxies:
        P0 = fits[rel]['P0']
        # weights from reference vertices
        Wp = (Wg[p['ref']] * p['w'][:, :, None]).sum(1)
        Wp /= np.maximum(Wp.sum(1, keepdims=True), 1e-6)
        # repose the same way as the body
        P = P0
        for kind, k, piv, ax, ang, fac in reposes:
            f = (fac[p['ref']] * p['w']).sum(1)
            P = rotate_partial_fast(P, np.clip(f, 0, 1), piv, ax, ang)
        mat_i = 0
        if opt in (0, 1, 2) and isinstance(opt, int): mat_i = opt
        Tp, TUp = triangulate(p['faces'])
        if p['uv'] is None or len(Tp) == 0: continue
        Np = vnormals(P, Tp)
        cat = {'eyes': 'eyes', 'brows': 'lash', 'lashes': 'lash'}.get(opt, category(rel))
        m = p['mats'][mat_i] if mat_i < len(p['mats']) else p['mats'][0]
        dif = m.get('mapDiffuse')
        if opt == 'eyes': dif = 'textures/' + C['eyecol']
        tex_path = os.path.join(p['dir'].replace(M.DATA, M.MH1), dif)
        if not os.path.exists(tex_path):
            alt = glob.glob(os.path.join(p['dir'].replace(M.DATA, M.MH1), 'textures', '*.png'))
            tex_path = alt[0]
        recol = opt if isinstance(opt, str) and opt in ('desat', 'desat_left', 'lift', 'grey', 'grime', 'flat') else None
        tkey = f'{cat}:{tex_path}:{recol}'
        if tkey not in atlas.items:
            im = Image.open(tex_path).convert('RGBA')
            if recol: im = recolor(im, recol)
            if cat in ('cloth', 'shoes', 'hat', 'eyes'):
                aa = np.asarray(im).astype(np.float32); aa[..., 3] = 255; im = Image.fromarray(aa.astype(np.uint8), 'RGBA')
            if cat == 'lash':
                aa = np.asarray(im).astype(np.float32); aa[..., 3] = np.clip(aa[..., 3] * 2.2, 0, 255); im = Image.fromarray(aa.astype(np.uint8), 'RGBA')
            im = dilate(im)
            nm = m.get('mapNormal')
            npath = os.path.join(p['dir'].replace(M.DATA, M.MH1), nm) if nm else None
            if npath and os.path.exists(npath):
                nrm = with_rough(Image.open(npath).resize(im.size), ROUGH[cat])
            else:
                nrm = height_normal(im, {'hair': 3.0, 'cloth': 2.5, 'shoes': 2.0, 'hat': 2.0}.get(cat, 0.5), ROUGH[cat])
            small = cat in ('eyes', 'lash', 'shoes', 'hat') or 'Moustache' in rel or 'beard' in rel
            atlas.place(tkey, im, nrm, 256 if small else 512)
        BN = (BNall[p['ref']] * p['w'][:, :, None]).sum(1)
        BN /= np.maximum(np.linalg.norm(BN, axis=1, keepdims=True), 1e-6)
        piece = split_uv(P, Np, Tp, TUp, p['uv'], {'W': Wp, 'BN': BN})
        piece['UV'] = atlas.uv(tkey, piece['UV'])
        tl = np.array(tint, dtype=np.float64)
        if cat in ('cloth', 'shoes', 'hat'): tl = tl ** 2.2 * 1.6  # tints are authored in sRGB; vertex colours are linear
        piece['C'] = np.tile(np.clip(tl, 0, 1), (len(piece['P']), 1))
        piece['S'] = np.zeros(len(piece['P']))
        if opt == 'eyes': piece['S'][:] = 0.0
        piece['rel'] = rel
        pieces.append(piece)

    # --- merge
    out = {k: np.concatenate([pc[k] for pc in pieces]) for k in ('P', 'N', 'UV', 'C', 'S', 'W')}
    tris, off = [], 0
    for pc in pieces:
        tris.append(pc['T'] + off); off += len(pc['P'])
    out['T'] = np.concatenate(tris)

    # --- braid: vertices of the braid behind & below the head get a 3-bone chain
    if C.get('braid'):
        bi = [i for i, pc in enumerate(pieces) if pc.get('rel') == 'hair/Braid01'][0]
        s0 = sum(len(pieces[i]['P']) for i in range(bi)); s1 = s0 + len(pieces[bi]['P'])
        Pb = out['P'][s0:s1]
        hj = J['head']
        sel = (Pb[:, 2] < hj[2] - 0.6) & (Pb[:, 1] < hj[1] + 0.4)
        if sel.any():
            ytop = hj[1] + 0.4; ybot = Pb[sel, 1].min()
            L = ytop - ybot
            J['braid1'] = np.array([0, ytop, Pb[sel, 2].mean()])
            J['braid2'] = np.array([0, ytop - L / 3, Pb[sel, 2].mean()])
            J['braid3'] = np.array([0, ytop - 2 * L / 3, Pb[sel, 2].mean()])
            t = np.clip((ytop - Pb[:, 1]) / L, 0, 1)
            Wb = out['W'][s0:s1]
            for i in np.nonzero(sel)[0]:
                tt = t[i] * 3
                w = np.zeros(len(M.GAME_BONES))
                fade = np.clip((tt - 0.0) / 0.4, 0, 1)
                seg = min(int(tt), 2)
                w[gi['braid%d' % (seg + 1)]] = 1.0
                Wb[i] = Wb[i] * (1 - fade) + w * fade
    for k in ('braid1', 'braid2', 'braid3'):
        if k not in J: J[k] = J['head'] + np.array([0, 0.5, -0.5])

    # --- scale to metres, feet on the ground
    sc = C['height'] / (out['P'][:len(pieces[0]['P']), 1].max() - out['P'][:, 1].min())
    ymin = out['P'][:, 1].min()
    out['P'] = (out['P'] - [0, ymin, 0]) * sc
    for k in J: J[k] = (J[k] - [0, ymin, 0]) * sc

    # --- top-4 weights
    W = out['W']
    order = np.argsort(-W, axis=1)[:, :4]
    w4 = np.take_along_axis(W, order, 1)
    w4 /= np.maximum(w4.sum(1, keepdims=True), 1e-6)
    out['J'] = order; out['W'] = w4

    # --- joints (translation-only hierarchy) and inverse bind matrices
    names = M.GAME_BONES
    parents = [names.index(M.PARENT[n]) if M.PARENT[n] else None for n in names]
    joints = []
    ibm = np.zeros((len(names), 4, 4))
    for i, n in enumerate(names):
        p = M.PARENT[n]
        t = J[n] - (J[p] if p else 0)
        joints.append((n, t))
        m = np.eye(4); m[:3, 3] = -J[n]
        ibm[i] = m.T  # column-major
    os.makedirs(f'{OUT}/models/humans', exist_ok=True)
    raw = f'/tmp/claude-0/bake/raw_{name}.glb'
    write_glb(raw, out, joints, parents, ibm)
    import subprocess
    subprocess.run(['/tmp/claude-0/tools/node_modules/.bin/gltfpack', '-i', raw, '-o', f'{OUT}/models/humans/{name}.glb', '-cc', '-kn', '-km', '-vt', '14'], check=True, capture_output=True)
    print(name, 'verts', len(out['P']), 'tris', len(out['T']), 'height', out['P'][:, 1].max().round(3))
    return {n: (J[n]).round(4).tolist() for n in names}

if __name__ == '__main__':
    atlas = Atlas()
    only = sys.argv[1:] or list(CHARS)
    info = {}
    for n in only:
        info[n] = build(n, CHARS[n], atlas)
    used = len(atlas.items)
    print('atlas items', used, 'free slots', len(atlas.free))
    atlas.alb.save(f'{OUT}/textures/humans_a.webp', quality=88, method=4)
    atlas.nrm.save(f'{OUT}/textures/humans_n.webp', quality=90, method=4)
    json.dump(info, open('/tmp/claude-0/bake/joints.json', 'w'), indent=1)
