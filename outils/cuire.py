#!/usr/bin/env python3
# Cuit les rochers : les normales du scan complet, dans le repère de l'objet, pour qu'un maillage réduit garde tout son relief.
import numpy as np, json, os, sys
from PIL import Image
os.chdir(sys.argv[1] if len(sys.argv) > 1 else '.')
SORTIE=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','src','rendu','matieres')
ROCHES={'b3':'namaqualand_boulder_03','b4':'namaqualand_boulder_04','b5':'namaqualand_boulder_05','ai':'rock_09','fl':'rock_07'}
T=1024
lin=lambda c: np.where(c<=0.04045,c/12.92,((c+0.055)/1.055)**2.4)
srgb=lambda c: np.where(c<=0.0031308,c*12.92,1.055*np.power(np.maximum(c,1e-6),1/2.4)-0.055)
for cle,id in ROCHES.items():
    P=np.fromfile(f'bake-{cle}.bin',np.float32).reshape(-1,3); N=np.fromfile(f'bake-{cle}-n.bin',np.float32).reshape(-1,3)
    U=np.fromfile(f'bake-{cle}-u.bin',np.float32).reshape(-1,2); I=np.fromfile(f'bake-{cle}-i.bin',np.uint32).reshape(-1,3)
    tex=np.asarray(Image.open(f'mod/{id}/textures/{id}_nor_gl_1k.jpg').convert('RGB'),np.float32)/255*2-1
    dif=np.asarray(Image.open(f'mod/{id}/textures/{id}_diff_1k.jpg').convert('RGB'),np.float32)/255
    # tangentes par triangle
    p0,p1,p2=P[I[:,0]],P[I[:,1]],P[I[:,2]]; u0,u1,u2=U[I[:,0]],U[I[:,1]],U[I[:,2]]
    e1,e2=p1-p0,p2-p0; d1,d2=u1-u0,u2-u0
    det=d1[:,0]*d2[:,1]-d1[:,1]*d2[:,0]; det[np.abs(det)<1e-12]=1e-12; r=1/det
    tg=(e1*d2[:,1:2]-e2*d1[:,1:2])*r[:,None]; bt=(e2*d1[:,0:1]-e1*d2[:,0:1])*r[:,None]
    out=np.zeros((T,T,3),np.float32); rempli=np.zeros((T,T),bool)
    Us=U*T; Us[:,1]=(1-U[:,1])*T
    for k,(a,b,c) in enumerate(I):
        A,B,C=Us[a],Us[b],Us[c]
        x0=int(max(0,np.floor(min(A[0],B[0],C[0])))); x1=int(min(T-1,np.ceil(max(A[0],B[0],C[0]))))
        y0=int(max(0,np.floor(min(A[1],B[1],C[1])))); y1=int(min(T-1,np.ceil(max(A[1],B[1],C[1]))))
        if x1<x0 or y1<y0: continue
        xs,ys=np.meshgrid(np.arange(x0,x1+1)+.5,np.arange(y0,y1+1)+.5)
        d=(B[1]-C[1])*(A[0]-C[0])+(C[0]-B[0])*(A[1]-C[1])
        if abs(d)<1e-9: continue
        w0=((B[1]-C[1])*(xs-C[0])+(C[0]-B[0])*(ys-C[1]))/d; w1=((C[1]-A[1])*(xs-C[0])+(A[0]-C[0])*(ys-C[1]))/d; w2=1-w0-w1
        m=(w0>=-.02)&(w1>=-.02)&(w2>=-.02)
        if not m.any(): continue
        n=w0[m,None]*N[a]+w1[m,None]*N[b]+w2[m,None]*N[c]
        n/=np.maximum(np.linalg.norm(n,axis=1,keepdims=True),1e-6)
        t=tg[k]-n*(n@tg[k])[:,None]; t/=np.maximum(np.linalg.norm(t,axis=1,keepdims=True),1e-6)
        s=bt[k]; s=s/max(np.linalg.norm(s),1e-6)
        px=(xs[m]).astype(int); py=(ys[m]).astype(int)
        q=tex[py,px]
        o=t*q[:,0:1]+s*q[:,1:2]+n*q[:,2:3]
        o/=np.maximum(np.linalg.norm(o,axis=1,keepdims=True),1e-6)
        out[py,px]=o; rempli[py,px]=True
    # On déborde des îles d'UV, pour que le filtrage ne ramène pas de noir.
    for _ in range(10):
        vide=~rempli
        if not vide.any(): break
        for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
            v=np.roll(rempli,(dy,dx),(0,1))&vide
            out[v]=np.roll(out,(dy,dx),(0,1))[v]; rempli|=v; vide=~rempli
    im=Image.fromarray(((out*.5+.5)*255+.5).clip(0,255).astype(np.uint8)).resize((512,512),Image.LANCZOS)
    im.save(f'{SORTIE}/roc-{cle}-n.webp',quality=82,method=6)
    c=lin(dif); moy=c.reshape(-1,3).mean(0); l=(c*[.3,.59,.11]).sum(2,keepdims=True)
    c=c/np.maximum(moy,1e-3)*.5; c=l/l.mean()*.5*.6+c*.4
    Image.fromarray((srgb(c.clip(0,1))*255+.5).astype(np.uint8)).resize((512,512),Image.LANCZOS).save(f'{SORTIE}/roc-{cle}-c.webp',quality=74,method=6)
    print(cle,id,len(I),'tri',os.path.getsize(f'{SORTIE}/roc-{cle}-n.webp')//1024,os.path.getsize(f'{SORTIE}/roc-{cle}-c.webp')//1024,'Ko',flush=True)
