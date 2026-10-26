from pipe import *
from keyall import preview
from PIL import Image
import numpy as np, sys
from scipy import ndimage
S=1.25
def split(n, bounds):
    k = key(Image.open(f'gen/{n}.jpg')).convert('RGBA'); a = np.array(k); H, W = a.shape[:2]
    xs = np.arange(W)[None, :]
    bl = [np.array([b(y / S) * S for y in range(H)])[:, None] if callable(b) else np.full((H, 1), b * S) for b in bounds]
    figs = []
    for i in range(len(bl) - 1):
        m = (xs >= bl[i]) & (xs < bl[i + 1]); al = np.where(m, a[..., 3], 0)
        lab, nl = ndimage.label(al > 8); sizes = ndimage.sum(al > 8, lab, range(1, nl + 1)); big = sizes.max()
        keep = np.zeros(nl + 1, bool)
        edge = np.zeros((H, W), bool)
        for y in range(H):
            for bb_ in (bl[i][y][0], bl[i + 1][y][0]):
                x0 = int(bb_); edge[y, max(0, x0 - 3):min(W, x0 + 3)] = True
        touch = set(np.unique(lab[edge & (lab > 0)]))
        for j, sz in enumerate(sizes, 1): keep[j] = sz >= 0.25 * big or (sz >= 300 and j not in touch)
        b = a.copy(); b[..., 3] = np.where(keep[lab], al, 0)
        im = Image.fromarray(b); bb = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox(); figs.append(im.crop(bb))
    for i, x in enumerate(figs): x.save(f'seg/{n}_{i}.png')
    print(n, [x.size for x in figs]); preview(figs, f'seg/prev_{n}.png')
if __name__ == '__main__':
    split('swamp_foes', [0, 185, 360, 620, lambda y: 815 if y < 370 else 783, 1024])
    split('x_minibosses', [0, lambda y: 212 if y < 300 else 244, 420, lambda y: 600 if y > 270 else 610, 790, 1024])
