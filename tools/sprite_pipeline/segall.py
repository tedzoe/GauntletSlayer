from pipe import *
from keyall import preview
from PIL import Image
import glob, os, sys
EXP = {'theo_attack':4,'theo_hurt':4,'theo_death':3,'zoey_attack':4,'zoey_hurt':4,'zoey_death':3,'isaac_attack':4,'isaac_hurt':4,'isaac_death':3,
 'paladin_attack':4,'paladin_block':4,'paladin_heavy':4,'paladin_misc':4,'paladin_ult':2,'gela_master':4,'gela_attack':4,'gela_block':4,'gela_misc':4,'gela_ult':2,'vesper_master':4,'vesper_attack':4,'vesper_misc':4,'vesper_ult':2,'vesper_minions':7}
os.makedirs('seg', exist_ok=True)
for n, e in EXP.items():
    if len(sys.argv) > 1 and n not in sys.argv[1:]: continue
    k = key(Image.open(f'gen/{n}.jpg'))
    figs = [clean_small(x, 80) for x in figures2(k, e)]
    print(n, len(figs), [x.size for x in figs])
    for i, x in enumerate(figs): x.save(f'seg/{n}_{i}.png')
    preview(figs, f'seg/prev_{n}.png')
