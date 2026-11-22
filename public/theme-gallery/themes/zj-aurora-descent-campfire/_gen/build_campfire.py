"""Campfire Under the Aurora (#240) bake: python build_campfire.py [aur|sil|fire]"""
import lib, os, sys, random, math
from lib import fmt, svg, grad
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.dirname(HERE); TMP = HERE + "/tmp"
os.makedirs(TMP, exist_ok=True)
def write(n, s): open(f"{OUT}/{n}", "w").write(s)
def bakeweb(name, s, w, h, q=90):
    p = f"{TMP}/{name}.svg"; open(p, "w").write(s); lib.bake(p, f"{TMP}/{name}.png", w, h); lib.to_webp(f"{TMP}/{name}.png", f"{OUT}/{name}.webp", q)
    print(name, os.path.getsize(f"{OUT}/{name}.webp"))

SPECS = {
 "a": dict(seed=201, palette="teal", edge=.70, amp=.07, height=.58, hot=.7, folds=2, step=3.0),
 "b": dict(seed=202, palette="violet", edge=.64, amp=.09, height=.5, hot=.6, folds=3, step=3.2),
 "c": dict(seed=203, palette="emerald", edge=.76, amp=.10, height=.68, hot=1.0, folds=3),
 "d": dict(seed=204, palette="rose", edge=.60, amp=.08, height=.5, hot=.8, folds=4, lean=.25),
 "e": dict(seed=205, palette="green", edge=.80, amp=.06, height=.54, hot=.95, folds=5, step=2.8, lean=-.2),
 "f": dict(seed=206, palette="teal", edge=.56, amp=.1, height=.42, hot=.7, folds=2, step=3, lean=.3),
}
def aur():
    for k, kw in SPECS.items():
        bakeweb(f"aur-{k}", lib.curtain(id=k, **kw), 2400, 800)
    cs = [lib.curtain(raw=True, id=i, **SPECS[k]) for i, k in zip("cde", "cde")]
    bakeweb("refl", lib.reflection(cs, edge_y=.78), 2400, 520, 88)

L = {
 "d": dict(far=("#0a1c30", "#1d4d57"), far_rim="rgba(110,255,200,.14)", mid=("#05111c", "#030a12"), mid_rim="rgba(110,255,200,.28)", near=("#030912", "#020509"), ground="#030912",
           wall="#07101a", lit="#ff9a3c"),
 "l": dict(far=("#56689f", "#8b86b5"), far_rim="rgba(255,205,225,.5)", mid=("#2f3b72", "#222c5c"), mid_rim="rgba(255,190,215,.5)", near=("#1a2250", "#121843"), ground="#1a2250",
           wall="#141a45", lit="#ffb36b"),
}

def camp(c):
    W, H = 1600, 800; px, py = 1150, 738
    g = c["ground"]; lit = c["lit"]
    defs = grad("int", [(0, "#12070a", 1), (1, "#9a4514", 1)], x2=1, y2=0)
    defs += grad("rim", [(0, lit, 0), (.55, lit, .0), (.72, lit, .85), (1, lit, 0)], x2=1, y2=0)
    defs += '<radialGradient id="gl"><stop offset="0" stop-color="#ffb347" stop-opacity=".75"/><stop offset=".45" stop-color="#ff7a2a" stop-opacity=".3"/><stop offset="1" stop-color="#ff5a1a" stop-opacity="0"/></radialGradient>'
    defs += '<radialGradient id="co"><stop offset="0" stop-color="#fff1a0"/><stop offset=".4" stop-color="#ff9a2a"/><stop offset="1" stop-color="#b8300c" stop-opacity="0"/></radialGradient>'
    o = ""
    # lean-to: interior first (warm lit), then the dark frame over it
    o += '<polygon points="338,510 826,560 830,722 342,722" fill="url(#int)"/>'
    o += '<polygon points="470,722 470,690 520,668 600,662 690,670 740,692 740,722" fill="#0a0507" opacity=".85"/>'  # bough bed
    wall = c["wall"]
    o += f'<polygon points="262,500 340,508 346,724 256,724" fill="{wall}"/>'
    for y in range(530, 724, 26): o += f'<rect x="256" y="{y}" width="92" height="3" fill="#000" opacity=".5"/>'
    o += f'<polygon points="826,556 846,560 850,724 830,724" fill="{wall}"/><polygon points="600,545 614,547 616,724 602,724" fill="{wall}" opacity=".9"/>'
    o += f'<polygon points="246,466 850,538 856,572 244,506" fill="{wall}"/>'
    # spruce bough thatch along the roof
    r = random.Random(4); th = ""
    for i in range(34):
        t = i / 33; x = 246 + 604 * t; y = 466 + 72 * t
        th += f'<polygon points="{fmt(x-14)},{fmt(y+6)} {fmt(x+r.uniform(-4,4))},{fmt(y-r.uniform(14,26))} {fmt(x+16)},{fmt(y+8)}" />'
    o += f'<g fill="{wall}">{th}</g>'
    o += f'<polygon points="236,722 862,722 864,742 232,742" fill="{wall}"/>'
    o += f'<path d="M246,506 L856,572" stroke="url(#rim)" stroke-width="5" fill="none" stroke-linecap="round"/>'
    o += f'<path d="M848,560 L851,724" stroke="{lit}" stroke-width="3" opacity=".8"/>'
    # ground mound + clearing
    o += f'<path d="M-4,800 L-4,775 C220,748 520,742 860,742 C1000,741 1120,744 1250,752 C1400,765 1500,785 1604,800Z" fill="{g}"/>'
    o += f'<path d="M-4,800 L-4,775 C220,748 520,742 860,742 C1000,741 1120,744 1250,752 C1400,765 1500,785 1604,800Z" fill="none" stroke="url(#rim)" stroke-width="3" opacity=".9"/>'
    o += f'<ellipse cx="{px}" cy="{py+6}" rx="560" ry="70" fill="url(#gl)"/>'
    # woodpile by the lean-to
    for i in range(5): o += f'<rect x="{900+i*3}" y="{706+i*7}" width="{70-i*3}" height="9" rx="4" fill="#0d0705"/><ellipse cx="{970-i*3}" cy="{710+i*7}" rx="4" ry="4.5" fill="#6b3a1a"/>'
    # canoe pulled up
    o += f'<path d="M1330,772 C1380,752 1470,752 1530,764 C1480,788 1380,792 1330,772Z" fill="{wall}"/><path d="M1334,771 C1390,760 1470,758 1526,765" stroke="{lit}" stroke-width="2.4" fill="none" opacity=".6"/>'
    # fire pit: log pair + coals + stones
    o += f'<ellipse cx="{px}" cy="{py-2}" rx="70" ry="16" fill="url(#co)"/>'
    o += f'<rect x="{px-72}" y="{py-14}" width="140" height="17" rx="7" fill="#0a0405" transform="rotate(-10 {px} {py})"/><rect x="{px-68}" y="{py-14}" width="136" height="17" rx="7" fill="#150909" transform="rotate(12 {px} {py})"/>'
    o += f'<path d="M{px-66},{py-6} L{px+60},{py-10}" stroke="#ff8a2a" stroke-width="3" opacity=".9"/>'
    st = random.Random(2)
    for i in range(12):
        a = math.tau * i / 12; x = px + 92 * math.cos(a); y = py + 2 + 20 * math.sin(a)
        if math.sin(a) < 0 or True:
            o += f'<ellipse cx="{fmt(x)}" cy="{fmt(y)}" rx="{st.uniform(13,19):.1f}" ry="{st.uniform(8,11):.1f}" fill="#16110f"/><path d="M{fmt(x-12)},{fmt(y-4)} Q{fmt(x)},{fmt(y-11)} {fmt(x+12)},{fmt(y-4)}" stroke="{lit}" stroke-width="2.4" fill="none" opacity="{.35+.5*(math.sin(a)<0.2)}"/>'
    return svg(W, H, o, defs)

def flame():
    W, H = 480, 720
    d = '<filter id="b"><feGaussianBlur stdDeviation="3.2"/></filter><filter id="b2"><feGaussianBlur stdDeviation="46"/></filter>'
    d += grad("o", [(0, "#ff3a14", 1), (.5, "#ff6a1e", 1), (1, "#ffae2e", 1)]) + grad("m", [(0, "#ff9a2a", 1), (1, "#ffd44e", 1)]) + grad("i", [(0, "#ffe27a", 1), (1, "#fffbe0", 1)])
    def tongue(cx, h, w, fill):
        return f'<path d="M{cx},{640} C{cx-w},{630} {cx-w*1.05},{640-h*.45} {cx-w*.5},{640-h*.65} C{cx-w*.3},{640-h*.8} {cx-w*.2},{640-h*.85} {cx+w*.05},{640-h} C{cx+w*.12},{640-h*.78} {cx+w*.4},{640-h*.72} {cx+w*.55},{640-h*.55} C{cx+w*1.1},{640-h*.35} {cx+w*.9},{630} {cx},{640}Z" fill="{fill}"/>'
    g = f'<ellipse cx="240" cy="520" rx="230" ry="190" fill="#ff8a2a" opacity=".42" filter="url(#b2)"/>'
    g += f'<g filter="url(#b)">{tongue(160,260,52,"url(#o)")}{tongue(325,230,48,"url(#o)")}{tongue(240,400,88,"url(#o)")}{tongue(240,290,58,"url(#m)")}{tongue(170,160,28,"url(#m)")}{tongue(312,150,26,"url(#m)")}{tongue(240,175,30,"url(#i)")}</g>'
    return svg(W, H, g, d)

def sparks():
    W, H = 700, 1000; r = random.Random(7); o = ""
    d = '<radialGradient id="h"><stop offset="0" stop-color="#ffb347" stop-opacity=".6"/><stop offset="1" stop-color="#ff7a2a" stop-opacity="0"/></radialGradient>'
    for i in range(70):
        y = r.uniform(200, 990); a = (990 - y) / 790  # age 0..1
        fade = min(1, (y - 200) / 220) * min(1, (1000 - y) / 40)
        x = 350 + r.gauss(0, 30 + 150 * a) + 40 * math.sin(a * 9 + i)
        s = r.uniform(1.4, 3.4) * (1 - .45 * a)
        col = r.choice(["#ffe9a0", "#ffc25a", "#ff9a3a", "#ff7a2a"])
        o += f'<circle cx="{fmt(x)}" cy="{fmt(y)}" r="{s*3.6:.1f}" fill="url(#h)" opacity="{fade*.8:.2f}"/><ellipse cx="{fmt(x)}" cy="{fmt(y)}" rx="{s:.1f}" ry="{s*2:.1f}" fill="{col}" opacity="{min(1,fade*1.2):.2f}"/>'
    return svg(W, H, o, d)

def firerefl():
    W, H = 320, 520; r = random.Random(3)
    d = '<filter id="b"><feGaussianBlur stdDeviation="2 1"/></filter>' + grad("g", [(0, "#ffd070", 1), (.5, "#ff8a2a", .8), (1, "#ff5a1a", 0)])
    body = ""; y = 0.0; i = 0
    while y < H:
        hh = r.uniform(7, 16) * (1 + y / H); dx = r.uniform(-1, 1) * (3 + y / H * 28); w = (110 - 70 * (y / H)) * r.uniform(.6, 1.1)
        body += f'<rect x="{fmt(160-w/2+dx)}" y="{fmt(y)}" width="{fmt(w)}" height="{fmt(hh*.65)}" rx="2" fill="url(#g)" opacity="{(1-.9*(y/H)**.9)*r.uniform(.7,1):.2f}"/>'
        y += hh
    glow = '<ellipse cx="160" cy="40" rx="150" ry="70" fill="#ff8a2a" opacity=".25"/>'
    return svg(W, H, f'<g filter="url(#b)">{glow}{body}</g>', d)

def sil():
    for m, c in L.items():
        s, _ = lib.peaks(7, 2400, 520, .985, 330, c["far"], rim=c["far_rim"], rough=.6); write(f"ridge-far-{m}.svg", s)
        mid = lambda mirror: lib.ridge_with_spruce(21, 2400, 420, .965, 70, 150, 50, 1.5, rim=c["mid_rim"], fill=c["mid"], mirror=mirror)
        write(f"ridge-mid-{m}.svg", mid(False))
        write(f"shore-{m}.svg", lib.ridge_with_spruce(33, 2400, 800, .985, 40, 560, 150, .33, rim="rgba(255,150,70,.35)" if m == "d" else "rgba(255,190,220,.3)", fill=c["near"]))
        write(f"camp-{m}.svg", camp(c))
    write("stars.svg", lib.stars(3, 1200, 900, 150))
    write("sparks.svg", sparks())

def fire():
    bakeweb("flame", flame(), 480, 720, 92); bakeweb("fire-refl", firerefl(), 320, 520, 88)

if __name__ == "__main__":
    w = sys.argv[1:]
    if not w or "sil" in w: sil()
    if not w or "fire" in w: fire()
    if not w or "aur" in w: aur()
