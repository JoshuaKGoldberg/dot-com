"""Woodcut Aurora (#239) generators: flat-ink curtains, hatched spruce, ripple-stroke reflections. Run: python wood.py [aur|sil|refl]"""
import math, os, random, sys
import lib
from lib import Noise, fmt, svg, ridge_heights, sample, poly_d

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(HERE)
TMP = os.path.join(HERE, "tmp")
os.makedirs(TMP, exist_ok=True)

INKS = {
    "d": dict(mint="#c9ffe4", green="#46e8a8", teal="#2bb8c4", violet="#a98bff", rose="#ff7fc0", blue="#1d3a78",
              far=("#0c2038", "#1f4c66"), mid=("#060f1e", "#164055"), near=("#03060d", "#0f3345"), off="#2a8f78",
              ripple="#9fe8ff", water="#082229", star="#ffffff"),
    "l": dict(mint="#effff6", green="#12a784", teal="#2a86b8", violet="#6a3fc9", rose="#d94f9a", blue="#4d63b0",
              far=("#5b69ad", "#8a92d0"), mid=("#34407e", "#5f6bb0"), near=("#1c2257", "#4a54a0"), off="#d94f9a",
              ripple="#f4e6f0", water="#2a3478", star="#3a4590"),
}

def curtain_body(seed, ink, W=2400, H=800, edge=.72, amp=.08, height=.6, folds=3, step=9, lean=0.0,
                 tones=("green", "teal", "violet"), span=(.04, .96), gaps=((.15, .2), (.46, .52), (.76, .82))):
    r = random.Random(seed)
    en = Noise(seed + 1, 4, folds); pat = Noise(seed + 4, 5, 5, period=None); rn = Noise(seed + 3, 6, 11)
    yb = lambda t: H * (edge + amp * (en(t) - .5) * 2)
    out = {k: [] for k in ("mint", *tones)}
    hem = []
    x = W * span[0]; x1 = W * span[1]
    while x < x1:
        t = x / W; u = (x - W * span[0]) / (W * (span[1] - span[0]))
        env = math.sin(math.pi * u) ** .6 * (.35 + .65 * pat(t))
        if r.random() > .4 + .6 * env: x += step; continue
        h = H * height * (.55 + .6 * (.3 * rn(t) ** 1.4 + .7 * pat(t * 2.3 + .2))) * (.55 + .45 * env)
        w = step * r.uniform(.62, .98)
        y1 = yb(t); lx = lean * (t - .5) * h
        fr = [0.0]
        segs = []
        edges = [0.0]
        for g0, g1 in gaps:
            j = r.uniform(-.015, .015)
            edges += [g0 + j, g1 + j]
        edges.append(1.0)
        cols = ["mint", tones[0], tones[0], tones[1] if len(tones) > 1 else tones[0]]
        for i in range(0, len(edges), 2):
            f0, f1 = edges[i], edges[i + 1]
            if r.random() < .12 and i > 0: continue
            band = i // 2
            col = "mint" if band == 0 and r.random() < .55 else (tones[min(band, len(tones) - 1)] if band >= 2 else tones[0])
            def P(f, side):
                cx = x + w / 2 + lx * f
                half = w / 2 * (1 - .6 * f)
                return (cx + side * half, y1 - h * f)
            a, b, c, d = P(f0, -1), P(f0, 1), P(f1, 1), P(f1, -1)
            out[col].append(f'{fmt(a[0])},{fmt(a[1])} {fmt(b[0])},{fmt(b[1])} {fmt(c[0])},{fmt(c[1])} {fmt(d[0])},{fmt(d[1])}')
        x += step
    body = ""
    for k, polys in out.items():
        body += f'<g fill="{ink[k]}">' + "".join(f'<polygon points="{p}"/>' for p in polys) + "</g>"
    # solid hem ribbon + carved dashed line below
    pts = [(W * span[0] + (W * (span[1] - span[0])) * i / 160, 0) for i in range(161)]
    path = "M" + " L".join(f"{fmt(px)},{fmt(yb(px / W) + 2)}" for px, _ in pts)
    path2 = "M" + " L".join(f"{fmt(px)},{fmt(yb(px / W) + 20)}" for px, _ in pts)
    body += f'<path d="{path}" fill="none" stroke="{ink[tones[0]]}" stroke-width="11" stroke-linecap="butt"/>'
    body += f'<path d="{path}" fill="none" stroke="{ink["mint"]}" stroke-width="4" stroke-dasharray="90 16 30 12"/>'
    body += f'<path d="{path2}" fill="none" stroke="{ink[tones[-1]]}" stroke-width="3" stroke-dasharray="46 14 14 14"/>'
    # stipple above the tips
    st = ""
    for _ in range(90):
        t = r.uniform(span[0], span[1]); yy = yb(t) - H * height * r.uniform(.7, 1.12)
        st += f'<circle cx="{fmt(t*W)}" cy="{fmt(yy)}" r="{r.choice([1.3,1.8,2.4])}"/>'
    body += f'<g fill="{ink[tones[-1]]}">{st}</g>'
    return body

CURT = {
    "a": dict(seed=101, edge=.70, amp=.07, height=.55, folds=2, step=6, tones=("teal", "green", "violet")),
    "b": dict(seed=102, edge=.64, amp=.09, height=.5, folds=3, step=7, tones=("teal", "violet", "violet")),
    "c": dict(seed=103, edge=.76, amp=.10, height=.66, folds=3, step=6, tones=("green", "green", "violet")),
    "d": dict(seed=104, edge=.60, amp=.08, height=.5, folds=4, step=7, lean=.25, tones=("green", "teal", "violet")),
    "e": dict(seed=105, edge=.80, amp=.06, height=.52, folds=5, step=6, lean=-.2, tones=("green", "teal", "violet")),
    "f": dict(seed=106, edge=.56, amp=.1, height=.42, folds=2, step=7, lean=.3, tones=("teal", "violet", "rose")),
}

def bake_svg(name, s, w, h, q=90):
    p = f"{TMP}/{name}.svg"; open(p, "w").write(s)
    lib.bake(p, f"{TMP}/{name}.png", w, h)
    lib.to_webp(f"{TMP}/{name}.png", f"{OUT}/{name}.webp", q)
    print(name, os.path.getsize(f"{OUT}/{name}.webp"))

def curtains():
    for m, ink in INKS.items():
        for k, kw in CURT.items():
            bake_svg(f"aur-{k}-{m}", svg(2400, 800, curtain_body(ink=ink, **kw)), 2400, 800)

def reflection(m, ink, W=2400, R=520, H=800, seed=5):
    r = random.Random(seed)
    body = "".join(curtain_body(ink=ink, **CURT[k]) for k in "cde")
    defs = f'<g id="src">{body}</g><g id="flip" transform="translate(0,{fmt(.78*H)}) scale(1,-1)"><use href="#src"/></g>'
    rows = ""; y = 0.0; i = 0
    while y < R:
        hgt = r.uniform(7, 18) * (1 + y / R * 1.5); dx = r.uniform(-1, 1) * (3 + y / R * 22)
        gap = r.uniform(1.2, 3.2) * (.6 + y / R); a = r.uniform(.6, 1) * (1 - .88 * (y / R) ** 1.1)
        defs += f'<clipPath id="r{i}"><rect x="-40" y="{fmt(y)}" width="{W+80}" height="{fmt(hgt-gap)}"/></clipPath>'
        rows += f'<g clip-path="url(#r{i})" opacity="{a:.2f}"><use href="#flip" x="{fmt(dx)}"/></g>'
        y += hgt; i += 1
    dash = ""
    for _ in range(420):
        yy = R * r.random() ** .8; x = r.uniform(0, W); ww = r.uniform(14, 60) * (.5 + yy / R * 1.4)
        dash += f'<rect x="{fmt(x)}" y="{fmt(yy)}" width="{fmt(ww)}" height="{fmt(1.6+yy/R*2.4)}" fill="{ink["ripple"]}" opacity=".75"/>'
    return svg(W, R, rows + dash, defs)

# ---- spruce with carved hatch cuts

def wspruce(cx, base, h, w, r):
    tiers = r.randint(8, 12); top = base - h
    R = [(cx, top)]; L = []; cuts = []
    for k in range(tiers):
        f0 = k / tiers; f1 = (k + 1) / tiers
        ya = top + h * f0 * .98; yb_ = top + h * f1 * .98
        wk = w * (.12 + .88 * f1 ** .9) * r.uniform(.85, 1.12); wi = w * (.05 + .5 * f0 ** .9)
        yd = yb_ + (h / tiers) * .25
        A = (cx + wi * .6, ya + (yb_ - ya) * .45); B = (cx + wk, yd)
        R += [A, B, (cx + wk * .45, yb_ - (yb_ - ya) * .18)]
        L += [(cx - wi * .6, A[1]), (cx - wk * r.uniform(.9, 1.1), yd), (cx - wk * .45, yb_ - (yb_ - ya) * .18)]
        th = h / tiers
        for j, s in enumerate((.22, .44)):
            if k < 1: continue
            u0, u1 = .3 + .1 * j, .86 - .06 * j
            p0 = (A[0] + (B[0] - A[0]) * u0, A[1] + (B[1] - A[1]) * u0 + th * s)
            p1 = (A[0] + (B[0] - A[0]) * u1, A[1] + (B[1] - A[1]) * u1 + th * s * .8)
            cuts.append(f"M{fmt(p0[0])},{fmt(p0[1])}L{fmt(p1[0])},{fmt(p1[1])}")
        if r.random() < .5:
            p0 = (cx - wk * .7, yd - th * .5); p1 = (cx - wk * .25, ya + (yb_ - ya) * .7)
            cuts.append(f"M{fmt(p0[0])},{fmt(p0[1])}L{fmt(p1[0])},{fmt(p1[1])}")
    tw = max(1.5, w * .06)
    return R + [(cx + tw, base), (cx - tw, base)] + L[::-1], cuts

def wridge(seed, W, H, base_frac, relief, tree_h, tree_w, density, fill, cut, off, sw=2.0):
    r = random.Random(seed); hs = ridge_heights(seed, 128, .55, True)
    ry = lambda x: H * base_frac - relief * sample(hs, (x % W) / W)
    N = 240
    d = f"M-4,{H} L" + " L".join(f"{fmt(W*i/N)},{fmt(ry(W*i/N))}" for i in range(N + 1)) + f" L{W+4},{H}Z"
    paths = []; cuts = []
    x = r.uniform(0, tree_w)
    while x < W + tree_w:
        hh = tree_h * r.uniform(.55, 1.25); ww = tree_w * (hh / tree_h) * r.uniform(.8, 1.15)
        for o in (-W, 0, W):
            xx = x + o
            if -ww * 1.5 < xx < W + ww * 1.5:
                pts, c = wspruce(xx, ry(x % W) + hh * .06, hh, ww, random.Random(int(x * 7) + seed))
                paths.append(poly_d(pts)); cuts += c
        x += tree_w * r.uniform(.35, 1.0) / density
    full = d + "".join(paths)
    out = f'<path d="{full}" fill="{off}" transform="translate(-3.5,-3)"/>'
    out += f'<path d="{full}" fill="{fill}"/>'
    # horizontal gouge lines in the ground
    ground = ""; yy = H * base_frac + 6
    while yy < H:
        ground += f'<rect x="0" y="{fmt(yy)}" width="{W}" height="2" fill="{cut}" opacity=".55"/>'; yy += 9
    out += ground + f'<path d="{"".join(cuts)}" fill="none" stroke="{cut}" stroke-width="{sw}" stroke-linecap="round"/>'
    return svg(W, H, out)

def peaks_hatch(seed, W, H, base_frac, relief, fill, cut, off):
    s, pts = lib.peaks(seed, W, H, base_frac, relief, (fill, fill), rough=.6)
    d = "M-4," + str(H) + " L" + " L".join(f"{fmt(x)},{fmt(y)}" for x, y in pts) + f" L{W+4},{H}Z"
    pat = f'<pattern id="hp" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(-38)"><rect width="10" height="2.2" fill="{cut}"/></pattern>'
    body = f'<path d="{d}" fill="{off}" transform="translate(-3,-3)" opacity=".8"/><path d="{d}" fill="{fill}"/>'
    body += f'<clipPath id="pk"><path d="{d}"/></clipPath><g clip-path="url(#pk)"><rect x="0" y="0" width="{W}" height="{H*base_frac:.0f}" fill="url(#hp)" opacity=".7"/></g>'
    return svg(W, H, body, pat)

def mirror_rows(inner, W, H, seed=9, fade=.85):
    r = random.Random(seed)
    defs = f'<g id="s">{inner}</g><g id="f" transform="translate(0,{H}) scale(1,-1)"><use href="#s"/></g>'
    rows = ""; y = 0.0; i = 0
    while y < H:
        hgt = r.uniform(5, 12) * (1 + y / H * 1.3); gap = r.uniform(1.2, 3) * (.6 + y / H); dx = r.uniform(-1, 1) * (2 + y / H * 12)
        defs += f'<clipPath id="m{i}"><rect x="-30" y="{fmt(y)}" width="{W+60}" height="{fmt(hgt-gap)}"/></clipPath>'
        rows += f'<g clip-path="url(#m{i})" opacity="{r.uniform(.6,1)*(1-fade*(y/H)):.2f}"><use href="#f" x="{fmt(dx)}"/></g>'
        y += hgt; i += 1
    return svg(W, H, rows, defs)

def stars(seed, ink, W=1200, H=900, n=120):
    r = random.Random(seed); out = ""
    for _ in range(n):
        x, y = r.uniform(0, W), r.uniform(0, H); k = r.random()
        if k < .55: out += f'<rect x="{fmt(x)}" y="{fmt(y)}" width="2.4" height="2.4" fill="{ink}" opacity="{r.uniform(.6,1):.2f}"/>'
        elif k < .9:
            s = r.uniform(4, 7); out += f'<path d="M{fmt(x-s)},{fmt(y)}h{fmt(2*s)}M{fmt(x)},{fmt(y-s)}v{fmt(2*s)}" stroke="{ink}" stroke-width="1.6" fill="none"/>'
        else:
            s = r.uniform(7, 11); out += f'<path d="M{fmt(x)},{fmt(y-s)}L{fmt(x+s*.28)},{fmt(y-s*.28)}L{fmt(x+s)},{fmt(y)}L{fmt(x+s*.28)},{fmt(y+s*.28)}L{fmt(x)},{fmt(y+s)}L{fmt(x-s*.28)},{fmt(y+s*.28)}L{fmt(x-s)},{fmt(y)}L{fmt(x-s*.28)},{fmt(y-s*.28)}Z" fill="{ink}"/>'
    return svg(W, H, out)

def write(n, s): open(f"{OUT}/{n}", "w").write(s)

def silhouettes():
    for m, ink in INKS.items():
        write(f"ridge-far-{m}.svg", peaks_hatch(7, 2400, 520, .985, 330, ink["far"][0], ink["far"][1], ink["off"]))
        mid = wridge(21, 2400, 420, .965, 70, 150, 50, 1.5, ink["mid"][0], ink["mid"][1], ink["off"], 1.8)
        write(f"ridge-mid-{m}.svg", mid)
        write(f"shore-{m}.svg", wridge(33, 2400, 800, .985, 40, 560, 150, .33, ink["near"][0], ink["near"][1], ink["off"], 3.2))
        inner = mid.split("</defs>", 1)[1].rsplit("</svg>", 1)[0]
        s_ = mirror_rows(inner, 2400, 420)
        lib.bake  # baked in refl()
        open(f"{TMP}/refl-mid-{m}.svg","w").write(s_)
        write(f"stars-a-{m}.svg", stars(3, ink["star"], 1200, 900, 110))
        write(f"stars-b-{m}.svg", stars(8, ink["star"], 1400, 900, 70))

def refl():
    for m, ink in INKS.items():
        bake_svg(f"refl-{m}", reflection(m, ink), 2400, 520, 88)
        p = f"{TMP}/refl-mid-{m}"
        if not os.path.exists(p + ".svg"): silhouettes()
        lib.bake(p + ".svg", p + ".png", 2400, 420); lib.to_webp(p + ".png", f"{OUT}/refl-mid-{m}.webp", 88)

if __name__ == "__main__":
    w = sys.argv[1:]
    if not w or "sil" in w: silhouettes()
    if not w or "aur" in w: curtains()
    if not w or "refl" in w: refl()
