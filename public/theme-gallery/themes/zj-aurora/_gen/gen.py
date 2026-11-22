import json, math, random
import os
HERE=os.path.dirname(os.path.abspath(__file__))
ROOT=os.path.join(HERE, "..", "..") + "/"
els=json.load(open(os.path.join(HERE, "els.json")))
NX,NY=10,8

# ---------- springs -> linear() ----------
def spring(zeta, cycles, s0, n=44):
    # unit step response of a damped spring with initial slope s0 (in 1/duration units)
    # choose omega_d = 2*pi*cycles (over duration 1), a = zeta*omega, b = omega_d
    b=2*math.pi*cycles
    w=b/math.sqrt(1-zeta*zeta); a=zeta*w
    c=(a-s0)/b
    pts=[]
    for i in range(n+1):
        t=i/n
        x=1-math.exp(-a*t)*(math.cos(b*t)+c*math.sin(b*t))
        if i==n: x=1
        pts.append((x,t))
    s=[]
    for i,(x,t) in enumerate(pts):
        s.append(f"{x:.3f}" if i in (0,) else f"{x:.3f} {t*100:.1f}%")
    return "linear("+", ".join(s)+")"

SPR={
 "ba":(1.7,spring(.5,1.5,3.2)),"bb":(2.2,spring(.55,1.4,2.6)),"bc":(2.8,spring(.6,1.3,2.1)),
 "ha":(1.1,spring(.4,1.8,5.5)),"hb":(1.5,spring(.45,1.6,4.5)),"hc":(2.0,spring(.5,1.5,3.6)),
 "f1":(3.2,spring(.62,1.2,1.7)),"f2":(3.9,spring(.66,1.1,1.4)),
}
def trans(k, ky=1.18):
    d,e=SPR[k]
    return f"--x {d}s {e}, --y {d*ky:.2f}s {e}"

# ---------- svg art ----------
def mul(seed):
    s=seed&0xffffffff
    def r():
        nonlocal s
        s=(s+0x6D2B79F5)&0xffffffff
        t=s
        t=(t^(t>>15))*(t|1)&0xffffffff
        t^=(t+((t^(t>>7))*(t|61)&0xffffffff))&0xffffffff
        return ((t^(t>>14))&0xffffffff)/4294967296
    return r
COL={"dark":[(70,255,170),(60,190,255),(190,110,255)],"light":[(40,190,130),(50,150,220),(170,100,230)]}
def grad(c,a,white=.12,beam=False):
    st=(0,.28,.62,.9) if beam else (0,.2,.62,.88)
    k=(0,.4,.95,0) if beam else (0,.2,.62,.62)
    r,g,b=c
    return (f'<linearGradient id="g" x1="0" y1="0" x2="0" y2="1">'
      f'<stop offset="0" stop-color="rgb({r},{g},{b})" stop-opacity="0"/>'
      f'<stop offset="{.5 if not beam else .3}" stop-color="rgb({r},{g},{b})" stop-opacity="{k[1]*a:.3f}"/>'
      f'<stop offset="{.88 if not beam else .85}" stop-color="rgb({r},{g},{b})" stop-opacity="{k[2]*a:.3f}"/>'
      f'<stop offset=".96" stop-color="#fff" stop-opacity="{white*a:.3f}"/>'
      f'<stop offset="1" stop-color="rgb({r},{g},{b})" stop-opacity="0"/></linearGradient>')
def body(name,mode,b,seed,base,amp=1.0,alpha=1.0,ci=None,period=70):
    r=mul(seed); c=COL[mode][b if ci is None else ci]
    a=(.62 if mode=="dark" else .85)*alpha
    s0,s1,s2=r()*6,r()*6,r()*6
    out=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="none"><defs>{grad(c,a)}</defs>']
    step=4
    for i in range(0,400):
        x=i*step; u=x/1600
        by=1000*base+48*amp*math.sin(u*3.2+s0)+25*amp*math.sin(u*8.1+s1)+9*math.sin(u*21+s2)
        hgt=(190+90*math.sin(u*4.7+s2))*(0.9+0.2*r())
        fl=.62+.38*math.sin(u*period+s1*3+b)
        ray=.35+.65*r()*(0.6+0.4*math.sin(i*1.7+b))
        op=min(1,(0.5+0.5*fl)*(.8+.5*ray)*.75)
        w=step-.5+r()*1.2
        out.append(f'<rect x="{x}" y="{by-hgt:.0f}" width="{w}" height="{hgt:.0f}" fill="url(#g)" opacity="{op:.2f}"/>')
    out.append('</svg>')
    open(ROOT+f"zj-aurora/{name}-{mode}.svg","w").write("".join(out))
BC={'dark':[(70,255,185),(60,215,255),(150,130,255)],'light':[(15,165,115),(25,135,215),(120,85,215)]}
def beam(name,mode,b,seed,sigma):
    r=mul(seed); c=BC[mode][b]
    a=(1.0 if mode=="dark" else .68)
    out=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 1000" preserveAspectRatio="none"><defs>{grad(c,a,.5,True)}</defs>']
    for i in range(150):
        x=i*4
        g=math.exp(-((x-300)**2)/(2*sigma*sigma))
        H=430+570*g**.6
        fl=.65+.35*math.sin(i*.9+seed)
        ray=.5+.5*r()
        op=min(1,(g**1.35)*(.6+.5*fl*ray)*1.2)
        if op<.02: continue
        out.append(f'<rect x="{x}" y="{1000-H:.0f}" width="{3.0+r()*1.5:.1f}" height="{H:.0f}" fill="url(#g)" opacity="{op:.2f}"/>')
    out.append('</svg>')
    open(ROOT+f"zj-aurora/{name}-{mode}.svg","w").write("".join(out))
for m in ("dark","light"):
    for b,(sd,base) in enumerate([(11,.19),(23,.25),(37,.31)]):
        body(f"body-{'abc'[b]}",m,b,sd,base)
        beam(f"beam-{'abc'[b]}",m,b,sd+5,[72,88,108][b])
    body("fold-1",m,0,71,.15,amp=1.4,alpha=.3,ci=0,period=41)
    body("fold-2",m,2,89,.3,amp=1.2,alpha=.25,ci=2,period=53)

# ---------- hosts / cells ----------
hosts=[e for e in els]
def elig(h): return h['tag']!='a' and not h['sel'].startswith('.site>div:nth-child(3)')
for e in hosts:
    e['leaf']=e['direct']
    e['vis']=e['y']<1 and e['y']>0
# note: overlay, header etc counted
free={(i,j):None for i in range(NX) for j in range(NY)}
rule={}   # sel -> (x,y)
cell={}   # (i,j)->sel
def center(i,j): return ((i+.5)/NX,(j+.5)/NY)
for e in sorted([h for h in hosts if h['leaf'] and h['vis']],key=lambda h:-h['depth']):
    i=min(NX-1,max(0,int(e['x']*NX))); j=min(NY-1,max(0,int(e['y']*NY)))
    rule[e['sel']]=center(i,j)
    if elig(e) and free[(i,j)] is None and (i,j) not in cell:
        cell[(i,j)]=e['sel']; free[(i,j)]=1
used=set(cell.values())
off=[h for h in hosts if h['leaf'] and not h['vis']]
for j in range(NY-1,NY-5,-1):
    for i in range(NX):
        if (i,j) in cell: continue
        cx=center(i,j)[0]
        cand=[h for h in off if h['sel'] not in used and elig(h)]
        if not cand: continue
        h=min(cand,key=lambda h:abs(min(1,max(0,h['x']))-cx))
        used.add(h['sel']); cell[(i,j)]=h['sel']; rule[h['sel']]=center(i,j)
for h in off:
    if h['sel'] not in rule:
        rule[h['sel']]=(min(.95,max(.05,h['x'])),.9)
containers=[h for h in hosts if not h['leaf'] and elig(h)]
# spread containers: prefer ones that are not in use, order by document order
ci=iter(containers)
for j in range(NY):
    for i in range(NX):
        if (i,j) in cell: continue
        try: h=next(ci)
        except StopIteration: break
        cell[(i,j)]=h['sel']; rule[h['sel']]=center(i,j)
holes=[k for k in [(i,j) for i in range(NX) for j in range(NY)] if k not in cell]
depth={e['sel']:e['depth'] for e in hosts}
print("cells",NX*NY,"assigned",len(cell),"holes",len(holes),"rules",len(rule),"hosts",len(hosts))
json.dump({"holes":holes},open("/tmp/holes.json","w"))

exec(open(os.path.join(HERE, 'gen2.py')).read())
