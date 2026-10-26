from pipe import *
from PIL import Image
import sys
SRC = {'theo': 'theo_concept.jpg', 'zoey': 'zoey_concept.jpg', 'isaac': 'isaac_concept.jpg', 'paladin': 'paladin_master_idle.jpg'}
def preview(figs, path, col=(200, 60, 200, 255)):
    W = sum(x.width for x in figs) + 20 * len(figs); H = max(x.height for x in figs)
    bg = Image.new('RGBA', (W, H), col); x0 = 0
    for x in figs: bg.alpha_composite(x, (x0, 0)); x0 += x.width + 20
    bg.convert('RGB').save(path)
if __name__ == '__main__':
    for n, f in SRC.items():
        k = key(Image.open('/workspace/hero-concepts/' + f))
        figs = [clean_small(x) for x in figures(k, expect=4)]
        print(n, [x.size for x in figs])
        preview(figs, f'prev_idle_{n}.png')
        for i, x in enumerate(figs): x.save(f'idle_{n}_{i}.png')
