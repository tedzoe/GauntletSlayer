"""Build game sprite strips from keyed concept/generated figures.
Each hero: idle figures from the approved concept sheet; action poses from generated pose sheets.
All figures of a hero are scaled to one body height, aligned on a shared foot anchor, and assembled
into horizontal strips (one per anim per direction) + manifest.json + portrait.png."""
from pipe import *
from PIL import Image, ImageOps, ImageDraw, ImageFilter
import numpy as np, json, os, math, sys

H = 104            # stored body height (head-top to feet) for idle-front, all heroes; manifest scale maps it to screen
SCALE = 0.6        # on-screen base height ~62px at bodyScale 1.0
OUT = '/workspace/crypt-game/assets/heroes'
SEG = 'seg'
CONC = {'theo': 'theo_concept.jpg', 'zoey': 'zoey_concept.jpg', 'isaac': 'isaac_concept.jpg', 'paladin': 'paladin_master_idle.jpg'}
DIRS = ['down', 'up', 'left', 'right']

# proportion-fixed figures (theo_head_fix.py: smaller head, longer shins) override the raw segments when present
PFIX = '/workspace/spritework/seg_theo_fix'
def _src(stem):
    p = f'{PFIX}/{stem}.png'
    return p if os.path.exists(p) else f'{SEG}/{stem}.png'

def load(sheet, i):
    if sheet == 'idle': return None
    return Image.open(_src(f'{sheet}_{i}')).convert('RGBA')

def mirror(im): return ImageOps.mirror(im)

def body_top(im, cx=None):
    al = np.asarray(im)[:, :, 3] > 128
    if cx is None: cx = body_cx(im)
    w = max(8, int(im.width * 0.10))
    band = al[:, max(0, int(cx - w)):int(cx + w)]
    rows = np.where(band.sum(1) >= 4)[0]
    return int(rows[0]) if len(rows) else 0

def body_h(im): return foot_y(im) - body_top(im)

def fig(spec, idle_figs):
    """spec: ('sheet', idx) or ('idle', idx); a trailing 'm' mirrors."""
    sheet, i = spec[0], spec[1]
    im = idle_figs[i] if sheet == 'idle' else load(sheet, i)
    if len(spec) > 2 and spec[2] == 'm': im = mirror(im)
    return im

# --- per-hero recipes -------------------------------------------------------------------------
# dirs map: down, up, left, right. ratio = expected body height of that pose vs standing idle
# (used only to derive the per-sheet scale; all figures in one sheet share one scale).
R = {
 'theo': {
   'idle': [('idle', 0), ('idle', 1), ('idle', 2), ('idle', 3)],
   'sheets': {'theo_attack': 0.92, 'theo_hurt': 0.88, 'theo_death': 'theo_hurt'},
   'attack': [('theo_attack', 0), ('theo_attack', 1), ('theo_attack', 2), ('theo_attack', 3)],
   'hurt': [('theo_hurt', 0), ('theo_hurt', 1), ('theo_hurt', 2), ('theo_hurt', 3)],
   'death': [('theo_death', 0), ('theo_death', 1), ('theo_death', 2)],
   'extra': ['spin'], 'run': 'walk'},
 'zoey': {
   'idle': [('idle', 0), ('idle', 1), ('idle', 2), ('idle', 3)],
   'sheets': {'zoey_attack': 0.95, 'zoey_hurt': 0.98, 'zoey_death': 'zoey_hurt'},
   'attack': [('zoey_attack', 0), ('zoey_attack', 1), ('zoey_attack', 2), ('zoey_attack', 3)],
   'hurt': [('zoey_hurt', 0), ('zoey_hurt', 1), ('zoey_hurt', 2), ('zoey_hurt', 3)],
   'death': [('zoey_death', 0), ('zoey_death', 1), ('zoey_death', 2)],
   'run': 'glide'},
 'isaac': {
   'idle': [('idle', 0), ('idle', 1), ('idle', 2), ('idle', 3)],
   'sheets': {'isaac_attack': 0.93, 'isaac_hurt': 0.93, 'isaac_death': 'isaac_hurt'},
   'attack': [('isaac_attack', 0), ('isaac_attack', 1), ('isaac_attack', 2), ('isaac_attack', 3)],
   'hurt': [('idle', 0), ('idle', 1), ('idle', 2), ('idle', 3)], 'hurt_rot': [-6, -10],
   'death': [('isaac_death', 0), ('isaac_death', 1), ('isaac_death', 2)],
   'run': 'walk'},
 'paladin': {
   'idle': [('idle', 0), ('idle', 2), ('idle', 1), ('idle', 1, 'm')],
   'sheets': {'paladin_attack': 0.90, 'paladin_block': 1.0, 'paladin_heavy': 1.06, 'paladin_misc': ('fig', 1, 0.84), 'paladin_ult': ('fig', 1, 0.90)},
   'attack': [('paladin_attack', 0), ('paladin_attack', 1), ('paladin_attack', 3, 'm'), ('paladin_attack', 3)],
   'heavy': [('paladin_heavy', 0), ('paladin_attack', 1), ('paladin_heavy', 2, 'm'), ('paladin_heavy', 2)],
   'block': [('paladin_block', 0), ('paladin_block', 1), ('paladin_block', 2), ('paladin_block', 2, 'm')],
   'hurt': [('paladin_misc', 1), ('paladin_misc', 1), ('paladin_misc', 1), ('paladin_misc', 1, 'm')],
   'slam': ('paladin_misc', 0), 'ult': ('paladin_ult', 0),
   'death': [('paladin_misc', 2), ('paladin_misc', 3)],
   'run': 'walk'},
 'vesper': {
   'idle': [('idle', 0), ('idle', 2), ('idle', 1), ('idle', 1, 'm')],
   'sheets': {'vesper_attack': 1.0, 'vesper_misc': ('fig', 1, 1.08), 'vesper_ult': ('fig', 0, 1.0)},
   'attack': [('vesper_attack', 0), ('vesper_attack', 1), ('vesper_attack', 2), ('vesper_attack', 2, 'm')],
   'hurt': [('vesper_misc', 1), ('vesper_misc', 1), ('vesper_misc', 1, 'm'), ('vesper_misc', 1)],
   'channel': [('vesper_ult', 1), ('vesper_ult', 1), ('vesper_ult', 1, 'm'), ('vesper_ult', 1)],
   'slam': ('vesper_misc', 0), 'ult': ('vesper_ult', 0),
   'death': [('vesper_misc', 2), ('vesper_misc', 3)],
   'run': 'walk'},
 'gela': {
   'idle': [('idle', 0), ('idle', 2), ('idle', 1), ('idle', 1, 'm')],
   'sheets': {'gela_attack': 1.0, 'gela_block': 0.9, 'gela_misc': ('fig', 1, 0.84), 'gela_ult': ('fig', 1, 0.90)},
   'attack': [('gela_attack', 0), ('gela_attack', 1), ('gela_attack', 2), ('gela_attack', 2, 'm')],
   'block': [('gela_block', 0), ('gela_block', 1), ('gela_block', 2), ('gela_block', 2, 'm')],
   'hurt': [('gela_misc', 1), ('gela_misc', 1), ('gela_misc', 1, 'm'), ('gela_misc', 1)],
   'slam': ('gela_misc', 0), 'ult': ('gela_ult', 0),
   'throw': [('gela_ult', 1), ('gela_ult', 1), ('gela_ult', 1, 'm'), ('gela_ult', 1)],
   'death': [('gela_misc', 2), ('gela_misc', 3)],
   'run': 'walk'},
}
SRC_IDLE = {'gela': 'gela_master', 'vesper': 'vesper_master'}

def idle_figures(name):
    if os.path.exists(f'{PFIX}/idle_{name}_0.png'):
        return [Image.open(f'{PFIX}/idle_{name}_{i}.png').convert('RGBA') for i in range(4)]
    if name in SRC_IDLE:
        return [Image.open(f'{SEG}/{SRC_IDLE[name]}_{i}.png').convert('RGBA') for i in range(4)]
    k = key(Image.open('/workspace/hero-concepts/' + CONC[name]))
    return [clean_small(x, 80) for x in figures2(k, 4)]

def tf(im, s, sx=1.0, sy=1.0, rot=0.0, dx=0, dy=0, anchor=None):
    """scale figure by s (x sx, y sy), rotate about feet, offset; returns (image, anchor x, anchor y) in its own coords."""
    cx = body_cx(im) if anchor is None else anchor[0]; fy = foot_y(im) if anchor is None else anchor[1]
    w, h = im.size
    nw, nh = max(1, round(w * s * sx)), max(1, round(h * s * sy))
    out = im.resize((nw, nh), Image.LANCZOS)
    ax, ay = cx * s * sx, fy * s * sy
    if rot:
        pad = int(max(nw, nh) * 0.3)
        big = Image.new('RGBA', (nw + 2 * pad, nh + 2 * pad), (0, 0, 0, 0)); big.alpha_composite(out, (pad, pad))
        ax, ay = ax + pad, ay + pad
        out = big.rotate(rot, resample=Image.BICUBIC, center=(ax, ay))
    bb = out.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    if bb:
        out = out.crop(bb); ax -= bb[0]; ay -= bb[1]
    return out, ax + dx, ay + dy

class Strip:
    def __init__(self): self.frames = []   # (img, ax, ay)
    def add(self, t): self.frames.append(t)

def pack(strips, pad=4):
    """strips: {dir: [ (img, ax, ay), ... ]}; common frame size per anim across dirs. Returns (fw, fh, ox, footY, {dir: Image})."""
    L = R_ = U = D = 0
    for fr in strips.values():
        for im, ax, ay in fr:
            L = max(L, ax); R_ = max(R_, im.width - ax); U = max(U, ay); D = max(D, im.height - ay)
    ox = int(math.ceil(max(L, R_))) + pad; fw = 2 * ox
    footY = int(math.ceil(U)) + pad; fh = footY + int(math.ceil(D)) + pad
    out = {}
    for d, fr in strips.items():
        sheet = Image.new('RGBA', (fw * len(fr), fh), (0, 0, 0, 0))
        for i, (im, ax, ay) in enumerate(fr):
            sheet.alpha_composite(im, (int(round(i * fw + ox - ax)), int(round(footY - ay))))
        out[d] = sheet
    return fw, fh, ox, footY, out

def fwd(d, k):
    return {'down': (0, k), 'up': (0, -k), 'left': (-k, 0), 'right': (k, 0)}[d]

def build(name):
    r = R[name]
    idle = idle_figures(name)
    if not os.path.exists(f'{PFIX}/idle_{name}_0.png'):
        for i, x in enumerate(idle): x.save(f'{SEG}/idle_{name}_{i}.png')
    s_idle = H / body_h(idle[0])
    ref_h = body_h(idle[0]) * s_idle  # == H
    # per-sheet scale
    SS = {}
    for sheet, rule in r['sheets'].items():
        if isinstance(rule, str): continue
        if isinstance(rule, tuple):
            _, i, ratio = rule; bh = body_h(load(sheet, i))
        else:
            ratio = rule; import glob
            n = len([f for f in os.listdir(SEG) if f.startswith(sheet + '_') and f[len(sheet) + 1:-4].isdigit()])
            bh = float(np.median([body_h(load(sheet, i)) for i in range(n)]))
        SS[sheet] = H * ratio / bh
    for sheet, rule in r['sheets'].items():
        if isinstance(rule, str): SS[sheet] = SS[rule]
    def S(spec): return 1.0 * (s_idle if spec[0] == 'idle' else SS[spec[0]])
    anims, files = {}, {}
    os.makedirs(f'{OUT}/{name}', exist_ok=True)
    for f in os.listdir(f'{OUT}/{name}'):
        os.remove(f'{OUT}/{name}/{f}')
    def emit(anim, strips, fps, loop, fname=None):
        fw, fh, ox, fy, sheets = pack(strips)
        fname = fname or anim
        for d, im in sheets.items(): im.quantize(colors=200, method=Image.FASTOCTREE, dither=Image.NONE).save(f'{OUT}/{name}/{fname}_{d}.png', optimize=True)
        anims[anim] = {'file': f'{fname}_{{dir}}.png', 'frames': len(next(iter(strips.values()))), 'fps': fps, 'loop': loop,
                       'frameW': fw, 'frameH': fh, 'footY': fy, 'originX': ox}
    # idle: breathing (4 frames)
    st = {}
    for d, spec in zip(DIRS, r['idle']):
        im = fig(spec, idle); s = S(spec)
        st[d] = [tf(im, s, sx=1 + bx, sy=1 - by) for bx, by in [(0, 0), (0.004, 0.010), (0.008, 0.018), (0.004, 0.010)]]
    emit('idle', st, 4, True)
    # run / glide: built from the idle pose (bob, lean, sway, squash)
    st = {}
    for d, spec in zip(DIRS, r['idle']):
        im = fig(spec, idle); s = S(spec)
        side = d in ('left', 'right'); lean = (-4 if d == 'right' else 4) if side else 0
        fr = []
        if r['run'] == 'glide':
            for k in range(4):
                ph = k / 4 * 2 * math.pi
                fr.append(tf(im, s, rot=lean * 0.5 + 1.6 * math.sin(ph), sx=1 + 0.01 * math.cos(ph), sy=1 - 0.01 * math.cos(ph)))
        else:
            for k in range(6):
                ph = k / 6 * 2 * math.pi
                bob = -abs(math.sin(ph)) * H * 0.05
                sway = (2.2 if not side else 1.4) * math.sin(ph)
                sq = 1 - 0.035 * (1 - abs(math.sin(ph)))
                fr.append(tf(im, s, rot=lean + sway, sy=sq, sx=2 - sq, dy=-bob * 0 + 0, anchor=None) if False else
                          (lambda t: (t[0], t[1], t[2] - bob))(tf(im, s, rot=lean + sway, sy=sq, sx=2 - sq)))
        st[d] = fr
    if r['run'] == 'glide': emit('run', st, 6, True, 'glide')
    else: emit('run', st, 10, True)
    # attack: 3 frames (settle back, strike forward, hold)
    def posed(key_, offs, fps, loop, rots=None):
        st = {}
        for d, spec in zip(DIRS, r[key_]):
            im = fig(spec, idle); s = S(spec); fr = []
            for j, k in enumerate(offs):
                dx, dy = fwd(d, k * H / 104)
                rot = (rots[j] if rots else 0) * (-1 if d == 'right' else 1 if d == 'left' else (0.5 if key_ == 'hurt' else 0))
                t = tf(im, s, rot=rot)
                fr.append((t[0], t[1] - dx, t[2] - dy))
            st[d] = fr
        emit(key_, st, fps, loop)
    posed('attack', [-3, 4, 2], 14, False)
    posed('hurt', [0, -4], 10, False, rots=r.get('hurt_rot', [0, -3]))
    for k in ('block',):
        if k in r: posed(k, [0], 4, True)
    if 'channel' in r: posed('channel', [0, 1], 6, True)
    if 'heavy' in r: posed('heavy', [-2, 3], 8, False)
    if 'throw' in r: posed('throw', [-3, 3], 8, False)
    # single-figure specials used for every direction
    def single(key_, frames, fps, loop):
        spec = r[key_]; im = fig(spec, idle); s = S(spec); st = {}
        for d in DIRS:
            src = mirror(im) if d == 'left' else im
            st[d] = [tf(src, s, sx=fx, sy=fy, anchor=(src.width / 2, foot_y(src))) for fx, fy in frames]
        emit(key_, st, fps, loop)
    if 'slam' in r: single('slam', [(1.0, 1.06), (1.04, 0.96), (1.0, 1.0)], 10, False)
    if 'ult' in r: single('ult', [(1.0, 1.0), (1.015, 1.015)], 4, True)
    # death: sequence, bbox-centre anchored, left mirrored
    st = {}
    for d in DIRS:
        fr = []
        for spec in r['death']:
            im = fig(spec, idle); im = mirror(im) if d == 'left' else im
            fr.append(tf(im, S(spec), anchor=(im.width / 2, foot_y(im))))
        st[d] = fr
    emit('death', st, 5, False)
    # theo whirlwind: turn through the four idle views
    if 'spin' in r.get('extra', []):
        order = ['down', 'right', 'up', 'left']; m = dict(zip(DIRS, r['idle'])); st = {}
        for d in DIRS:
            st[d] = [tf(fig(m[o], idle), S(m[o])) for o in order]
        emit('spin', st, 16, True)
    # portrait from the front idle view
    im = idle[0]; bt = body_top(im); bh = body_h(im)
    al = np.asarray(im)[:, :, 3] > 128
    cx0 = body_cx(im); w0 = int(im.width * 0.14); top = al[bt:bt + int(bh * 0.16), max(0, int(cx0 - w0)):int(cx0 + w0)]
    xs = np.where(top)[1] + max(0, int(cx0 - w0)); hcx = float(np.median(xs)) if len(xs) else im.width / 2
    side = int(bh * 0.30); x0 = int(hcx - side / 2); y0 = int(bt - side * 0.06)
    crop = Image.new('RGBA', (side, side), (0, 0, 0, 0)); crop.alpha_composite(im.crop((x0, y0, x0 + side, y0 + side)))
    P = 256
    bg = Image.new('RGBA', (P, P)); g = ImageDraw.Draw(bg)
    col = PORT_BG[name]
    for rr in range(P // 2 * 1.45.__int__() if False else int(P * 0.72), 0, -2):
        t = rr / (P * 0.72); c = tuple(int(col[k] * (1 - t) + 16 * t) for k in range(3)) + (255,)
        g.ellipse((P / 2 - rr, P / 2 - rr, P / 2 + rr, P / 2 + rr), fill=c)
    bg.alpha_composite(crop.resize((P, P), Image.LANCZOS))
    bg.convert('RGB').save(f'{OUT}/{name}/portrait.jpg', quality=90)
    # preferred: the matched painted portrait set (portraits/build_portraits.py) when it exists
    pp = f'/workspace/hero-concepts/portraits/{name}_portrait.png'
    if os.path.exists(pp): Image.open(pp).convert('RGB').resize((256, 256), Image.LANCZOS).save(f'{OUT}/{name}/portrait.jpg', quality=90)
    return anims

PORT_BG = {'theo': (120, 40, 36), 'zoey': (70, 50, 140), 'isaac': (70, 90, 50), 'paladin': (150, 120, 50), 'gela': (70, 110, 150), 'vesper': (90, 50, 130)}
BODY = {
 'theo': {'bodyScale': 1.25, 'hitbox': 15, 'movement': {'style': 'heavy', 'speedMul': 0.94, 'animRate': 0.8, 'bob': 1.0, 'stepDust': True}},
 'zoey': {'bodyScale': 1.0, 'hitbox': 13, 'movement': {'style': 'glide', 'hover': 3, 'hoverBob': 2, 'hoverHz': 0.35, 'glow': '#b89cff'}},
 'isaac': {'bodyScale': 0.8, 'hitbox': 11, 'movement': {'style': 'nimble', 'speedMul': 1.06, 'animRate': 1.35, 'bob': 0.5, 'rollTime': 0.72, 'rollDist': 1.12, 'rollCd': 0.8}},
 'paladin': {'bodyScale': 1.35, 'hitbox': 15, 'movement': {'style': 'heavy', 'speedMul': 0.9, 'animRate': 0.7, 'bob': 1.2, 'stepDust': True}},
 'vesper': {'bodyScale': 1.0, 'hitbox': 13, 'movement': {'style': 'walk', 'speedMul': 1.0, 'animRate': 0.9, 'bob': 0.3}},
 'gela': {'bodyScale': 1.05, 'hitbox': 13, 'movement': {'style': 'walk', 'speedMul': 1.0, 'animRate': 1.0, 'bob': 0.4}},
}
MINIONS = ['warrior', 'spear', 'archer', 'guard', 'mage', 'wraith', 'golem']
MIN_H = {'warrior': 64, 'spear': 64, 'archer': 64, 'guard': 72, 'mage': 72, 'wraith': 70, 'golem': 118}   # stored px (x0.6 on screen)
def build_minions():
    d = f'{OUT}/minions'; os.makedirs(d, exist_ok=True)
    for f in os.listdir(d): os.remove(f'{d}/{f}')
    anims = {}
    for i, k in enumerate(MINIONS):
        im = Image.open(f'{SEG}/vesper_minions_{i}.png').convert('RGBA')
        s = MIN_H[k] / foot_y(im) if k != 'wraith' else MIN_H[k] / im.height
        fr = [tf(im, s, sx=1 + bx, sy=1 - by, anchor=(im.width / 2, foot_y(im))) for bx, by in [(0, 0), (0.01, 0.025)]]
        fw, fh, ox, fy, sheets = pack({'down': fr})
        sheets['down'].quantize(colors=160, method=Image.FASTOCTREE, dither=Image.NONE).save(f'{d}/{k}_down.png', optimize=True)
        anims[k] = {'file': f'{k}_{{dir}}.png', 'frames': 2, 'fps': 3, 'loop': True, 'frameW': fw, 'frameH': fh, 'footY': fy, 'originX': ox}
    man = {'scale': SCALE, 'smooth': True, 'dirs': ['down'], 'anims': anims, 'frameW': 64, 'frameH': 64, 'footY': 60, 'originX': 32}
    json.dump(man, open(f'{d}/manifest.json', 'w'), indent=1); print('minions', {k: (v['frameW'], v['frameH']) for k, v in anims.items()})

if __name__ == '__main__':
    if 'minions' in sys.argv: build_minions(); sys.argv.remove('minions')
    if len(sys.argv) == 1 and False: pass
    names = sys.argv[1:] or list(R)
    for n in names:
        anims = build(n)
        man = {'scale': SCALE, 'smooth': True, 'portrait': 'portrait.jpg', 'dirs': DIRS, 'anims': anims}
        f0 = anims['idle']; man.update({'frameW': f0['frameW'], 'frameH': f0['frameH'], 'footY': f0['footY'], 'originX': f0['originX']})
        man.update(BODY[n])
        json.dump(man, open(f'{OUT}/{n}/manifest.json', 'w'), indent=1)
        sz = sum(os.path.getsize(f'{OUT}/{n}/{f}') for f in os.listdir(f'{OUT}/{n}'))
        print(n, {k: (v['frames'], v['frameW'], v['frameH']) for k, v in anims.items()}, f'{sz/1024:.0f} KB')
