"""Sprite post-processing: flat-background key -> RGBA, figure segmentation, trim, foot-anchor alignment."""
from PIL import Image, ImageFilter
import numpy as np
from collections import deque
from scipy import ndimage

def bg_color(a):
    b = np.concatenate([a[:6].reshape(-1, 3), a[-6:].reshape(-1, 3), a[:, :6].reshape(-1, 3), a[:, -6:].reshape(-1, 3)])
    return np.median(b, 0)

def key(img, t_in=None, t_out=None, bg=None, t_core=9, flat=2.2, band=2):
    """Background removal for flat-colour sheets.
    1. core bg = pixels near the bg colour AND locally flat (5x5 std) -- textured dark hair/robes are not flat,
       so the fill cannot leak into them even when their colour is close to the backdrop;
    2. keep only core regions connected to the border, plus large enclosed flat holes (gaps between legs/staff);
    3. soft alpha only in a thin band around the core, with navy despill."""
    a = np.asarray(img.convert('RGB')).astype(np.float32)
    if bg is None: bg = bg_color(a)
    d = np.sqrt(((a - bg) ** 2).sum(2))
    g = a.mean(2)
    m1 = ndimage.uniform_filter(g, 5); m2 = ndimage.uniform_filter(g * g, 5)
    sd = np.sqrt(np.maximum(m2 - m1 * m1, 0))
    darker = (a <= bg + 2).all(2) & (d < 42)   # cast shadows the generator added despite the prompt
    core = ((d < t_core) | darker) & (sd < flat)
    lab, n = ndimage.label(core)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    keep = np.isin(lab, list(border))
    if n:
        sizes = ndimage.sum(core, lab, range(1, n + 1))
        big = [i for i, s in enumerate(sizes, 1) if s > 400]
        keep |= np.isin(lab, big)
    bgm = keep
    near = ndimage.binary_dilation(bgm, iterations=band) & ~bgm
    alpha = np.ones(d.shape, np.float32)
    alpha[bgm] = 0
    ti, to = t_core, t_core + 26
    alpha[near] = np.clip((d[near] - ti) / (to - ti), 0, 1)
    m = (alpha > 0) & (alpha < 1)
    aa = alpha[m][:, None]
    a[m] = np.clip((a[m] - bg * (1 - aa)) / np.maximum(aa, 0.05), 0, 255)
    alpha[alpha < 0.12] = 0
    out = np.dstack([a, alpha * 255]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')

def figures(rgba, min_area=1500, gap=6, expect=None):
    """Split a keyed sheet into figures by column occupancy, return list of RGBA crops (left->right)."""
    al = np.asarray(rgba)[:, :, 3] > 40
    cols = al.sum(0) > 2
    runs, s = [], None
    for x, c in enumerate(list(cols) + [False]):
        if c and s is None: s = x
        if not c and s is not None:
            runs.append([s, x]); s = None
    # merge runs separated by tiny gaps
    merged = []
    for r in runs:
        if merged and r[0] - merged[-1][1] <= gap: merged[-1][1] = r[1]
        else: merged.append(r)
    merged = [r for r in merged if al[:, r[0]:r[1]].sum() >= min_area]
    occ = al.sum(0)
    while expect and len(merged) < expect:
        i = max(range(len(merged)), key=lambda j: merged[j][1] - merged[j][0])
        x0, x1 = merged[i]; w = x1 - x0
        c = x0 + w // 4 + int(np.argmin(occ[x0 + w // 4: x1 - w // 4]))
        merged[i:i + 1] = [[x0, c], [c + 1, x1]]
    out = []
    for x0, x1 in merged:
        sub = al[:, x0:x1]
        if sub.sum() < min_area: continue
        ys = np.where(sub.any(1))[0]
        out.append(rgba.crop((x0, ys[0], x1, ys[-1] + 1)))
    return out

def clean_small(rgba, min_px=40):
    """Drop tiny disconnected specks (JPEG noise / stray sparkles)."""
    a = np.asarray(rgba).copy(); al = a[:, :, 3] > 30
    lab, n = ndimage.label(al)
    if n > 1:
        sizes = ndimage.sum(al, lab, range(1, n + 1))
        for i, s in enumerate(sizes, 1):
            if s < min_px: a[lab == i, 3] = 0
    return Image.fromarray(a, 'RGBA')

def foot_y(rgba):
    """Lowest row that is substantially opaque (ignores faint glow below the feet)."""
    al = np.asarray(rgba)[:, :, 3] > 128
    rows = np.where(al.sum(1) > max(3, al.shape[1] * 0.04))[0]
    return int(rows[-1]) if len(rows) else rgba.height - 1

def body_cx(rgba):
    """Horizontal centre of mass of the lower half (legs/feet), robust to spears and staffs sticking out."""
    al = np.asarray(rgba)[:, :, 3] > 128
    h = al.shape[0]; low = al[int(h * 0.55):]
    xs = np.where(low)[1]
    return float(np.median(xs)) if len(xs) else rgba.width / 2

def place(rgba, fw, fh, foot, ox, scale, cx=None, fy=None):
    """Scale a figure and paste it into an fw x fh frame so its feet sit at (ox, foot)."""
    if cx is None: cx = body_cx(rgba)
    if fy is None: fy = foot_y(rgba)
    w, h = rgba.size
    im = rgba.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    frame = Image.new('RGBA', (fw, fh), (0, 0, 0, 0))
    frame.alpha_composite(im, (round(ox - cx * scale), round(foot - fy * scale)))
    return frame

def figures2(rgba, expect, min_keep=80):
    """Connected-component segmentation: the `expect` largest blobs are the figures; detached bits
    (spear tips, shield rims, hair strands) join the figure whose x-range they overlap / are nearest;
    tiny specks are dropped. Falls back to column splitting if two figures touch."""
    arr = np.asarray(rgba)
    al = arr[:, :, 3] > 40
    lab, n = ndimage.label(ndimage.binary_dilation(al, iterations=2))
    if n < expect: return figures(rgba, expect=expect)
    sizes = ndimage.sum(al, lab, range(1, n + 1))
    order = np.argsort(-sizes)
    main = [int(i) + 1 for i in order[:expect]]
    if expect > 1 and sizes[order[expect - 1]] < 0.12 * sizes[order[0]]: return figures(rgba, expect=expect)
    sl = ndimage.find_objects(lab)
    boxes = {i: [sl[i - 1][1].start, sl[i - 1][0].start, sl[i - 1][1].stop, sl[i - 1][0].stop] for i in main}
    groups = {i: [i] for i in main}
    for j in range(1, n + 1):
        if j in groups or sizes[j - 1] < min_keep: continue
        s = sl[j - 1]; cx = (s[1].start + s[1].stop) / 2
        best = min(main, key=lambda i: 0 if boxes[i][0] <= cx <= boxes[i][2] else min(abs(cx - boxes[i][0]), abs(cx - boxes[i][2])))
        b = boxes[best]
        dist = 0 if b[0] <= cx <= b[2] else min(abs(cx - b[0]), abs(cx - b[2]))
        if dist > 60: continue
        groups[best].append(j)
    out = []
    for i in sorted(main, key=lambda i: boxes[i][0]):
        m = np.isin(lab, groups[i]) & (arr[:, :, 3] > 0)
        ys, xs = np.where(m)
        crop = arr[ys.min():ys.max() + 1, xs.min():xs.max() + 1].copy()
        crop[:, :, 3] = np.where(m[ys.min():ys.max() + 1, xs.min():xs.max() + 1], crop[:, :, 3], 0)
        out.append(Image.fromarray(crop, 'RGBA'))
    return out
