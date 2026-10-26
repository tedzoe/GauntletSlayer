import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
SEG='/workspace/spritework/seg_theo_orig'
FIGS=['idle_theo_%d'%i for i in range(4)]+['theo_attack_%d'%i for i in range(4)]+['theo_hurt_%d'%i for i in range(4)]+['theo_death_%d'%i for i in range(3)]
def detect(im):
    a=np.asarray(im).astype(int); A=a[:,:,3]>128; R,G,B=a[:,:,0],a[:,:,1],a[:,:,2]
    red=A&(R>70)&(R>1.6*G)&(R>1.3*B)
    skin=A&(R>150)&(G>100)&(B>70)&(R>G)&(G>B)&(R-B>40)
    hair=A&(R+G+B<120)&(np.abs(R-B)<30)
    # face/skin blob: the largest skin component (spear/shield are not skin)
    lab,n=ndimage.label(ndimage.binary_closing(skin,iterations=3))
    if n==0: return None
    sz=ndimage.sum(skin,lab,range(1,n+1)); k=int(np.argmax(sz))+1
    ys,xs=np.where(lab==k)
    fx0,fx1,fy0,fy1=xs.min(),xs.max(),ys.min(),ys.max()
    return dict(face=(fx0,fy0,fx1,fy1))
if __name__=='__main__':
    out=[]
    for f in FIGS:
        im=Image.open(f'{SEG}/{f}.png').convert('RGBA'); r=detect(im)
        o=Image.new('RGBA',im.size,(60,60,90,255)); o.alpha_composite(im); d=ImageDraw.Draw(o)
        if r: d.rectangle(r['face'],outline=(0,255,0,255),width=2)
        print(f,im.size,r); out.append(o)
    W=sum(i.width+6 for i in out[:8]); H=max(i.height for i in out)
    for j,grp in enumerate([out[:8],out[8:]]):
        W=sum(i.width+6 for i in grp); s=Image.new('RGBA',(W,H),(0,0,0,255)); x=0
        for i in grp: s.alpha_composite(i,(x,0)); x+=i.width+6
        s.save(f'/tmp/theo/det{j}.png')
