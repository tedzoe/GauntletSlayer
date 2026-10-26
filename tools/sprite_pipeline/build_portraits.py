# Normalize the six generated portraits: same size, eye-line, head scale, same edge vignette.
from PIL import Image, ImageDraw, ImageFilter, ImageOps
import math, os
E={'paladin':((345,300),(482,272)),'theo':((365,372),(512,338)),'gela':((355,330),(482,308)),'zoey':((368,352),(503,322)),'isaac':((383,350),(510,325)),'vesper':((520,318),(633,326))}
TINT={'paladin':(216,176,72),'theo':(170,40,40),'gela':(127,182,216),'zoey':(150,110,230),'isaac':(70,130,60),'vesper':(138,90,208)}
CH={'paladin':500,'theo':579,'gela':514,'zoey':520,'isaac':540,'vesper':462}
MIRROR={'vesper'}
FIX={'paladin':0.92,'isaac':0.9,'vesper':1.0}
S=512; EYE_Y=0.42; IOD=0.20
yy,xx=None,None
def vignette(size):
  m=Image.new('L',(size,size)); px=m.load()
  for y in range(size):
    for x in range(size):
      d=math.hypot(x-size/2,(y-size*0.42)*1.0)/(size*0.62); px[x,y]=int(255*max(0,min(1,1.15-d**2*1.25)))
  return m
VIG=vignette(S)
def build(k):
  a,b=E[k]; im=Image.open(f'{k}_raw.jpg').convert('RGB')
  cx,cy=(a[0]+b[0])/2,(a[1]+b[1])/2; iod=math.hypot(b[0]-a[0],b[1]-a[1]); ec=CH[k]-cy
  s=IOD*S/iod*FIX.get(k,1)   # head scale from eye spacing, with hand-checked corrections for head turn/face shape
  if k in MIRROR: im=ImageOps.mirror(im); cx=im.width-cx
  pad=400; edge=Image.new('RGB',(1,1)); import statistics
  bd=[im.getpixel((x,y)) for x in range(0,im.width,16) for y in (2,im.height-3)]+[im.getpixel((x,y)) for y in range(0,im.height,16) for x in (2,im.width-3)]
  fill=tuple(int(statistics.median(c[i] for c in bd)) for i in range(3))
  big=Image.new('RGB',(im.width+2*pad,im.height+2*pad),fill); big.paste(im,(pad,pad))
  w=S/s; x0=cx+pad-S/2/s; y0=cy+pad-EYE_Y*S/s
  out=big.crop((round(x0),round(y0),round(x0+w),round(y0+w))).resize((S,S),Image.LANCZOS)
  # unified background treatment: tinted dark field at the edges blended in by the vignette mask
  t=TINT[k]; field=Image.new('RGB',(S,S),(int(t[0]*0.06)+6,int(t[1]*0.06)+6,int(t[2]*0.06)+8))
  out=Image.composite(out,field,VIG)
  return out
os.makedirs('/workspace/hero-concepts/portraits',exist_ok=True)
outs={}
for k in E:
  o=build(k); outs[k]=o; o.save(f'/workspace/hero-concepts/portraits/{k}_portrait.png')
  o.resize((256,256),Image.LANCZOS).save(f'/workspace/crypt-game/assets/heroes/{k}/portrait.jpg',quality=90)
names={'paladin':'Highlord David','theo':'Sir Theo','gela':'Dawnbringer Gela','zoey':'Sorceress Zoey','isaac':'Ranger Isaac','vesper':'Vesper Linda'}
C=Image.new('RGB',(6*260+10,300),(20,20,24)); d=ImageDraw.Draw(C)
for i,k in enumerate(['paladin','theo','gela','zoey','isaac','vesper']):
  C.paste(outs[k].resize((250,250),Image.LANCZOS),(10+i*260,10)); d.text((10+i*260+8,272),names[k],fill=(230,220,200))
  # guide lines: eye line and centre
d.line((0,10+250*EYE_Y,C.width,10+250*EYE_Y),fill=(0,255,0)); 
C.save('/workspace/hero-concepts/portraits_contact_sheet.png'); print('ok')
