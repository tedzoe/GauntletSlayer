# Crypt enemy sprite set -> /workspace/crypt-game/assets/heroes/foes (single 'down' view, flipped for left-facing in game)
import json, os
from PIL import Image
from build_sprites import tf, pack, foot_y, SCALE, SEG
OUT = '/workspace/crypt-game/assets/heroes/foes'
# key: (segment file, stored height px; on screen x0.6 -> hero ~62px)
FOES = {
  'husk': ('crypt_foes_a_0', 96), 'barrow': ('crypt_foes_a_1', 128), 'blight': ('crypt_foes_a_2', 98), 'swollen': ('crypt_foes_a_3', 104),
  'ghost': ('crypt_foes_a_4', 100), 'hexer': ('crypt_foes_a_5', 116),
  'sentry': ('crypt_foes_b_0', 94), 'warden': ('crypt_foes_b_1', 100), 'marshal': ('crypt_foes_b_2', 128), 'lich': ('crypt_foes_b_3', 168), 'king': ('crypt_foes_b_4', 230),
  # cave
  'savage': ('cave_foes_a_0', 104), 'shieldwall': ('cave_foes_a_1', 106), 'juggernaut': ('cave_foes_a_2', 134), 'scavenger': ('cave_foes_a_3', 80), 'shaman': ('cave_foes_a_4', 92),
  'spawn': ('cave_foes_b_0', 34), 'spiderwar': ('cave_foes_b_1', 66), 'dweller': ('cave_foes_b_2', 98), 'queen': ('cave_foes_b_3', 140), 'behemoth': ('cave_foes_b_4', 230),
  # lava
  'novice': ('lava_foes_a_0', 96), 'zealot': ('lava_foes_a_1', 104), 'acolyte': ('lava_foes_a_2', 108), 'sorcerer': ('lava_foes_a_3', 126), 'imp': ('lava_foes_a_4', 74),
  'fiend': ('lava_foes_b_0', 132), 'horror': ('lava_foes_b_1', 160), 'demonlord': ('lava_foes_b_2', 245), 'sword': ('lava_foes_b_3', 230),
  # Extended Realms
  'fscout': ('forest_foes_0', 84), 'wolf': ('forest_foes_1', 66), 'ftroll': ('forest_foes_2', 140), 'wisp': ('forest_foes_3', 84), 'strangler': ('forest_foes_4', 124),
  'ghoul': ('swamp_foes_0', 100), 'leech': ('swamp_foes_1', 44), 'bogtroll': ('swamp_foes_2', 140), 'croaker': ('swamp_foes_3', 112), 'spitter': ('swamp_foes_4', 80),
  'dmummy': ('desert_foes_0', 100), 'scarab': ('desert_foes_1', 38), 'sentinel': ('desert_foes_2', 136), 'jackal': ('desert_foes_3', 124), 'suncult': ('desert_foes_4', 120),
  'fskel': ('frozen_foes_0', 98), 'icesprite': ('frozen_foes_1', 76), 'yeti': ('frozen_foes_2', 134), 'rimemage': ('frozen_foes_3', 120), 'igolem': ('frozen_foes_4', 136),
  'thrall': ('fortress_foes_0', 110), 'assassin': ('fortress_foes_1', 94), 'bulwark': ('fortress_foes_2', 134), 'chanter': ('fortress_foes_3', 120), 'abyssal': ('fortress_foes_4', 136),
  'alpha': ('x_minibosses_0', 112), 'hag': ('x_minibosses_1', 140), 'pharaohq': ('x_minibosses_2', 152), 'boneknight': ('x_minibosses_3', 160), 'succubus': ('x_minibosses_4', 156),
  'ancient': ('x_bosses_0', 245), 'colossus': ('x_bosses_1', 225), 'sunpharaoh': ('x_bosses_2', 240), 'frosttitan': ('x_bosses_3', 245), 'deathknight': ('x_bosses_4', 240),
}
FLY = {'ghost', 'imp', 'wisp', 'icesprite'}
def build():
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT): os.remove(f'{OUT}/{f}')
    anims = {}
    for k, (src, H) in FOES.items():
        im = Image.open(f'{SEG}/{src}.png').convert('RGBA')
        fy = foot_y(im) if k not in FLY else im.height; s = H / fy; anc = (im.width / 2, fy)
        sets = {
          'idle': [tf(im, s, anchor=anc), tf(im, s, sx=1.012, sy=0.975, anchor=anc)],
          'walk': [tf(im, s, rot=4, anchor=anc), tf(im, s, sx=1.02, sy=0.96, anchor=anc), tf(im, s, rot=-4, anchor=anc), tf(im, s, sx=1.02, sy=0.96, anchor=anc)],
          'attack': [tf(im, s, sx=0.97, sy=1.04, rot=6, anchor=anc), tf(im, s, sx=1.06, sy=0.93, rot=-10, anchor=anc)],
        }
        for an, fr in sets.items():
            fw, fh, ox, fyy, sheets = pack({'down': fr})
            sheets['down'].quantize(colors=128, method=Image.FASTOCTREE, dither=Image.NONE).save(f'{OUT}/{k}_{an}_down.png', optimize=True)
            anims[f'{k}_{an}'] = {'file': f'{k}_{an}_{{dir}}.png', 'frames': len(fr), 'fps': {'idle': 3, 'walk': 7, 'attack': 6}[an], 'loop': an != 'attack', 'frameW': fw, 'frameH': fh, 'footY': fyy, 'originX': ox}
    man = {'scale': SCALE, 'smooth': True, 'dirs': ['down'], 'anims': anims, 'frameW': 64, 'frameH': 64, 'footY': 60, 'originX': 32}
    json.dump(man, open(f'{OUT}/manifest.json', 'w'), indent=1)
    print({k: (v['frameW'], v['frameH']) for k, v in anims.items() if k.endswith('idle')}, sum(os.path.getsize(f'{OUT}/{f}') for f in os.listdir(OUT)) // 1024, 'KB')
if __name__ == '__main__': build()
