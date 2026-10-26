from PIL import Image, ImageDraw
E={'paladin':((345,300),(482,272)),'theo':((365,372),(512,338)),'gela':((355,330),(482,308)),'zoey':((368,352),(503,322)),'isaac':((383,350),(510,325)),'vesper':((520,318),(633,326))}
W=Image.new('RGB',(6*300,300))
for i,(k,(a,b)) in enumerate(E.items()):
  im=Image.open(f'{k}_raw.jpg').convert('RGB'); cx=(a[0]+b[0])//2; cy=(a[1]+b[1])//2
  c=im.crop((cx-150,cy-150,cx+150,cy+150)); d=ImageDraw.Draw(c)
  for p in (a,b): x,y=p[0]-cx+150,p[1]-cy+150; d.ellipse((x-4,y-4,x+4,y+4),outline=(0,255,0))
  W.paste(c,(i*300,0))
W.save('eyecheck.png')
