"""Sir Theo proportion fix: shrinks the chibi head (x0.56 about the chin) and lengthens the shins (x1.35 below 80% height)
on the raw segmented figures (seg_theo_orig) -> seg_theo_fix, which build_sprites.py prefers. Run: python3 theo_head_fix.py && python3 build_sprites.py theo"""
import numpy as np, sys, os
from PIL import Image, ImageDraw
from scipy import ndimage
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from head import detect, FIGS
SRC='/workspace/spritework/seg_theo_orig'; OUT=sys.argv[1] if len(sys.argv)>1 else '/workspace/spritework/seg_theo_fix'
os.makedirs(OUT,exist_ok=True)
S=0.56            # head scale
LEG0, LEGK = 0.80, 1.35   # stretch rows below 80% of standing height by 1.35
# manual head boxes (x0,y0,x1,y1) where no face is visible / lying poses; chin side given by anchor
MAN={'idle_theo_1':((78,20,204,152),(141,152)),'theo_attack_1':((98,0,206,102),(152,102)),'theo_hurt_1':((102,70,214,176),(158,176)),
     'theo_death_2':((38,18,166,132),(166,80)),'theo_death_1':((30,10,140,124),(118,112)),
     'theo_hurt_0':((100,112,202,230),(150,228)),'theo_hurt_2':((104,76,206,186),(152,184)),'theo_death_0':((165,48,282,178),(222,176))}
def headmask(a, box):
    x0,y0,x1,y1=box; A=a[:,:,3]>40; R,G,B=[a[:,:,i].astype(int) for i in range(3)]
    hair=A&(R+G+B<170)&(np.abs(R-B)<40); skin=A&(R>140)&(G>90)&(R>G)&(G>B)&(R-B>35)
    seed=np.zeros_like(A); seed[y0:y1,x0:x1]=True
    hs=ndimage.binary_closing((hair|skin)&seed,iterations=2)&seed
    lab,n=ndimage.label(hs); sz=ndimage.sum(hs,lab,range(1,n+1)); k=int(np.argmax(sz))+1
    m=ndimage.binary_fill_holes(ndimage.binary_dilation(lab==k,iterations=2))&A&seed
    return m
def process(f):
    im=Image.open(f'{SRC}/{f}.png').convert('RGBA'); a=np.asarray(im).copy()
    if f in MAN: box,anc=MAN[f]
    else:
        fx0,fy0,fx1,fy1=detect(im)['face']; fw=fx1-fx0; cx=(fx0+fx1)/2; chin=fy1+4
        box=(int(max(0,cx-1.05*fw)),0,int(min(im.width,cx+1.05*fw)),chin); anc=None
    m=headmask(a,box)
    ys,xs=np.where(m)
    if anc is None:
        yb=ys.max(); sel=ys>yb-(yb-ys.min())*0.25; anc=(float(xs[sel].mean()), float(box[3]))
    head=a.copy(); head[~m]=0
    hb=Image.fromarray(head,'RGBA').crop((xs.min(),ys.min(),xs.max()+1,ys.max()+1))
    body=a.copy(); body[m,3]=0
    bodyI=Image.fromarray(body,'RGBA')
    small=hb.resize((max(1,round(hb.width*S)),max(1,round(hb.height*S))),Image.LANCZOS)
    px=anc[0]+(xs.min()-anc[0])*S; py=anc[1]+(ys.min()-anc[1])*S
    # canvas (heads only shrink, so it fits)
    out=Image.new('RGBA',im.size,(0,0,0,0)); out.alpha_composite(bodyI); out.alpha_composite(small,(int(round(px)),int(round(py))))
    if 'death' not in f:   # lengthen shins of standing / crouching poses
        A=np.asarray(out)[:,:,3]>40; rows=np.where(A.any(1))[0]; top,foot=rows[0],rows[-1]
        y0=int(top+(foot-top)*LEG0); lower=out.crop((0,y0,out.width,out.height))
        lower=lower.resize((out.width,round(lower.height*LEGK)),Image.LANCZOS)
        o2=Image.new('RGBA',(out.width,y0+lower.height),(0,0,0,0)); o2.alpha_composite(out.crop((0,0,out.width,y0))); o2.alpha_composite(lower,(0,y0)); out=o2
    o=np.asarray(out).copy(); al=o[:,:,3]>20; lab,n=ndimage.label(al, structure=np.ones((3,3)))
    if n>1:
        sz=ndimage.sum(al,lab,range(1,n+1))
        for i,v in enumerate(sz,1):
            if v<150: o[lab==i,3]=0
    out=Image.fromarray(o,'RGBA')
    bb=out.getchannel('A').getbbox(); out=out.crop((0,bb[1],out.width,bb[3]))
    return im,out,m,box,anc
if __name__=='__main__':
    prev=[]
    for f in FIGS:
        im,out,m,box,anc=process(f); out.save(f'{OUT}/{f}.png')
        ov=Image.new('RGBA',im.size,(60,60,90,255)); ov.alpha_composite(im); o=np.asarray(ov).copy(); o[m,0]=255; o[m,1]//=2
        ov=Image.fromarray(o); d=ImageDraw.Draw(ov); d.rectangle(box,outline=(0,255,0,255)); d.ellipse((anc[0]-4,anc[1]-4,anc[0]+4,anc[1]+4),fill=(255,255,0,255))
        res=Image.new('RGBA',out.size,(60,60,90,255)); res.alpha_composite(out)
        prev.append((ov,res))
    for j,grp in enumerate([prev[:5],prev[5:10],prev[10:]]):
        W=sum(a.width+b.width+12 for a,b in grp); H=max(max(a.height,b.height) for a,b in grp); s=Image.new('RGBA',(W,H),(0,0,0,255)); x=0
        for a,b in grp: s.alpha_composite(a,(x,0)); s.alpha_composite(b,(x+a.width+4,0)); x+=a.width+b.width+12
        s.save(f'/tmp/theo/fxb{j}.png')
