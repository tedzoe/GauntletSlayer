from PIL import Image, ImageDraw
import json, sys
OUT = '/workspace/crypt-game/assets/heroes'
n = sys.argv[1]; d = sys.argv[2] if len(sys.argv) > 2 else 'down'; Z = 2
m = json.load(open(f'{OUT}/{n}/manifest.json'))
cells = []
for a, A in m['anims'].items():
    im = Image.open(f'{OUT}/{n}/' + A['file'].replace('{dir}', d)).convert('RGBA')
    f = 1 if a in ('attack',) else 0
    if a == 'death': f = A['frames'] - 1
    cells.append((a, im.crop((f * A['frameW'], 0, (f + 1) * A['frameW'], A['frameH'])), A['footY']))
W = sum(c[1].width * Z + 8 for c in cells) + 10; base = 170 * Z
img = Image.new('RGBA', (W, base + 30), (58, 62, 70, 255)); g = ImageDraw.Draw(img)
g.line((0, base, W, base), fill=(120, 125, 135)); g.line((0, base - 104 * Z, W, base - 104 * Z), fill=(120, 125, 135))
x = 5
for a, fr, fy in cells:
    img.alpha_composite(fr.resize((fr.width * Z, fr.height * Z), Image.NEAREST), (x, base - fy * Z)); g.text((x, base + 8), a, fill='white'); x += fr.width * Z + 8
img.convert('RGB').save(f'c2_{n}_{d}.png')
