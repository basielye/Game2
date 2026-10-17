"""MakeHuman (CC0 assets) offline baker: shape the base mesh with macro targets, fit proxies, collapse the rig."""
import json, os, numpy as np

MH = '/tmp/claude-0/assets/mh/package'
MH1 = '/tmp/claude-0/assets/mhv1/package/public/data'  # has textures
DATA = MH + '/public/data'

def parse_faces(f):
    i = 0; out = []
    n = len(f)
    while i < n:
        t = f[i]; i += 1
        nv = 4 if t & 1 else 3
        vs = f[i:i + nv]; i += nv
        mat = 0
        if t & 2: mat = f[i]; i += 1
        if t & 4: i += 1
        uvs = None
        if t & 8: uvs = f[i:i + nv]; i += nv
        if t & 16: i += 1
        if t & 32: i += nv
        if t & 64: i += 1
        if t & 128: i += nv
        out.append((vs, mat, uvs))
    return out

_base = None
def base():
    global _base
    if _base is None:
        d = json.load(open(DATA + '/models/human_full_size.json'))
        V = np.array(d['vertices'], dtype=np.float64).reshape(-1, 3)
        uv = np.array(d['uvs'][0], dtype=np.float64).reshape(-1, 2)
        faces = parse_faces(d['faces'])
        bones = [b['name'] for b in d['bones']]
        si = np.array(d['skinIndices']).reshape(-1, 4)
        sw = np.array(d['skinWeights']).reshape(-1, 4)
        mats = [m['DbgName'] for m in d['materials']]
        names = sorted(json.load(open(MH + '/src/json/targets/target-list.json'))['targets'].keys())
        T = np.memmap(DATA + '/targets/targets.bin', dtype=np.int16, mode='r').reshape(len(names), -1)
        rig = json.load(open(MH + '/src/json/rigs/default.json'))
        _base = dict(V=V, uv=uv, faces=faces, bones=bones, si=si, sw=sw, mats=mats, tnames={n: i for i, n in enumerate(names)}, T=T, rig=rig)
    return _base

def tri(v):  # 0..1 slider with 0.5 = average → (min, avg, max) weights
    if v < 0.5: return {'min': 1 - 2 * v, 'average': 2 * v, 'max': 0}
    return {'min': 0, 'average': 2 - 2 * v, 'max': 2 * v - 1}

def shape(p):
    """p: gender(0 f..1 m), age dict, muscle, weight, height(0..1), prop, race dict, breast cup/firm, extra {target: w}"""
    B = base()
    V = B['V'].copy()
    W = {}
    def add(name, w):
        if w <= 1e-4: return
        key = 'data/targets/' + name + '.target'
        if key in B['tnames']: W[key] = W.get(key, 0) + w
    G = {'female': 1 - p['gender'], 'male': p['gender']}
    A = p.get('age', {'young': 1.0})
    M = tri(p.get('muscle', 0.5)); Wt = tri(p.get('weight', 0.5))
    mus = {k + 'muscle': v for k, v in M.items()}
    wts = {k + 'weight': v for k, v in Wt.items()}
    for g, gw in G.items():
        for a, aw in A.items():
            for m, mw in mus.items():
                for w, ww in wts.items():
                    base_w = gw * aw * mw * ww
                    add(f'macrodetails/universal-{g}-{a}-{m}-{w}', base_w)
                    h = p.get('height', 0.5)
                    if h > 0.5: add(f'macrodetails/height/{g}-{a}-{m}-{w}-maxheight', base_w * (h - 0.5) * 2)
                    else: add(f'macrodetails/height/{g}-{a}-{m}-{w}-minheight', base_w * (0.5 - h) * 2)
                    pr = p.get('prop', 0.5)
                    if pr > 0.5: add(f'macrodetails/proportions/{g}-{a}-{m}-{w}-idealproportions', base_w * (pr - 0.5) * 2)
                    if g == 'female':
                        cup = tri(p.get('cup', 0.5)); firm = tri(p.get('firm', 0.5))
                        for c, cw in cup.items():
                            for fi, fw in firm.items():
                                if c == 'average' and fi == 'average': continue
                                add(f'breast/{g}-{a}-{m}-{w}-{c}cup-{fi}firmness', base_w * cw * fw)
            for r, rw in p.get('race', {'caucasian': 1}).items():
                add(f'macrodetails/{r}-{g}-{a}', gw * aw * rw)
    for k, w in p.get('extra', {}).items(): add(k, w)
    for k, w in W.items():
        V += B['T'][B['tnames'][k]].reshape(-1, 3).astype(np.float64) * (1e-3 * w)
    return V, W

def joint(V, name):
    idx = base()['rig']['joints'][name]
    return V[idx].mean(0)

# MakeHuman default-rig bone → game humanoid bone
def game_bone(n):
    s = n.replace('____head', '')
    side = 'L' if s.endswith('.L') else 'R' if s.endswith('.R') else ''
    b = s.split('.')[0]
    if b in ('root', 'spine05') or b.startswith('pelvis'): return 'hips'
    if b in ('spine04', 'spine03'): return 'spine'
    if b in ('spine02', 'spine01') or b.startswith('breast'): return 'chest'
    if b.startswith('clavicle') or b.startswith('shoulder'): return 'shoulder' + side
    if b.startswith('upperarm'): return 'arm' + side
    if b.startswith('lowerarm'): return 'elbow' + side
    if b.startswith('wrist') or b.startswith('metacarpal') or b.startswith('finger'): return 'hand' + side
    if b.startswith('neck'): return 'neck'
    if b.startswith('upperleg'): return 'thigh' + side
    if b.startswith('lowerleg'): return 'knee' + side
    if b.startswith('foot') or b.startswith('toe'): return 'foot' + side
    return 'head'

GAME_BONES = ['hips', 'spine', 'chest', 'neck', 'head',
              'shoulderL', 'armL', 'elbowL', 'handL', 'thighL', 'kneeL', 'footL',
              'shoulderR', 'armR', 'elbowR', 'handR', 'thighR', 'kneeR', 'footR',
              'braid1', 'braid2', 'braid3']
PARENT = {'hips': None, 'spine': 'hips', 'chest': 'spine', 'neck': 'chest', 'head': 'neck',
          'braid1': 'head', 'braid2': 'braid1', 'braid3': 'braid2'}
for k in 'LR':
    PARENT.update({'shoulder' + k: 'chest', 'arm' + k: 'shoulder' + k, 'elbow' + k: 'arm' + k, 'hand' + k: 'elbow' + k,
                   'thigh' + k: 'hips', 'knee' + k: 'thigh' + k, 'foot' + k: 'knee' + k})

def game_weights():
    """Per base vertex: dense (nv, nbones) weights over GAME_BONES."""
    B = base()
    gi = {b: i for i, b in enumerate(GAME_BONES)}
    remap = np.array([gi[game_bone(n)] for n in B['bones']])
    nv = len(B['V'])
    Wd = np.zeros((nv, len(GAME_BONES)))
    for k in range(4):
        np.add.at(Wd, (np.arange(nv), remap[B['si'][:, k]]), B['sw'][:, k])
    s = Wd.sum(1, keepdims=True); s[s == 0] = 1
    return Wd / s

def joints_pos(V):
    J = {}
    J['hips'] = joint(V, 'spine05____head') * 0.5 + joint(V, 'spine04____head') * 0.5
    J['spine'] = joint(V, 'spine03____head')
    J['chest'] = joint(V, 'spine01____head')
    J['neck'] = joint(V, 'neck01____head')
    J['head'] = joint(V, 'head____head')
    for k in 'LR':
        J['shoulder' + k] = joint(V, f'clavicle.{k}____head')
        J['arm' + k] = joint(V, f'upperarm01.{k}____head')
        J['elbow' + k] = joint(V, f'lowerarm01.{k}____head')
        J['hand' + k] = joint(V, f'wrist.{k}____head')
        J['thigh' + k] = joint(V, f'upperleg01.{k}____head')
        J['knee' + k] = joint(V, f'lowerleg01.{k}____head')
        J['foot' + k] = joint(V, f'foot.{k}____head')
    return J

def load_proxy(path):
    d = json.load(open(path))
    p = dict(
        ref=np.array(d['ref_vIdxs']), w=np.array(d['weights']), off=np.array(d['offsets'], dtype=np.float64),
        uv=np.array(d['uvs'][0]).reshape(-1, 2) if d['uvs'] and d['uvs'][0] else None,
        faces=parse_faces(d['faces']), mats=d['materials'], dir=os.path.dirname(path),
        delete=None, name=d['metadata'].get('name'), license=d['metadata'].get('license'),
    )
    try:
        dv = d['metadata'].get('deleteVerts')
        if dv:
            arr = json.loads(dv) if isinstance(dv, str) else dv
            p['delete'] = np.array(arr, dtype=bool)
    except Exception:
        pass
    return p

def fit_proxy(p, V):
    P = (V[p['ref']] * p['w'][:, :, None]).sum(1) + p['off']
    return P
