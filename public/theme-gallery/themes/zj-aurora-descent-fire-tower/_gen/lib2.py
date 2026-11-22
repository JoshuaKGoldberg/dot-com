"""Corona / Fire Tower additions: radial corona rays, birch + white pine silhouettes, forest tiles, ice, mirror."""
import math, random
from lib import *


def uni_grad(id, stops, y1, y2):
    s = "".join(f'<stop offset="{o}" stop-color="{c}" stop-opacity="{a}"/>' for o, c, a in stops)
    return f'<linearGradient id="{id}" gradientUnits="userSpaceOnUse" x1="0" y1="{y1}" x2="0" y2="{y2}">{s}</linearGradient>'


# ------------------------------------------------------------------ corona

CORONA_PAL = {
    # offset along the ray (0 = apex / high altitude, 1 = far end / low altitude), colour, alpha
    "green": [(0, "rgb(140,110,255)", .0), (.10, "rgb(130,120,255)", .35), (.28, "rgb(70,200,235)", .55), (.52, "rgb(70,250,180)", .82), (.78, "rgb(150,255,190)", .95), (.93, "rgb(225,255,225)", .9), (1, "rgb(120,255,170)", 0)],
    "rose": [(0, "rgb(170,90,255)", 0), (.12, "rgb(170,90,255)", .35), (.34, "rgb(220,90,220)", .55), (.6, "rgb(255,110,190)", .78), (.85, "rgb(255,190,225)", .9), (1, "rgb(255,150,200)", 0)],
    "teal": [(0, "rgb(90,130,255)", 0), (.1, "rgb(100,140,255)", .4), (.34, "rgb(60,215,230)", .6), (.62, "rgb(90,255,200)", .85), (.88, "rgb(190,255,225)", .9), (1, "rgb(90,255,190)", 0)],
}


def corona(seed, W=2400, H=1500, cx=1200, cy=70, mix=(("green", 1.0),), nrays=1000, nbands=5, R=1560, hot=1.0,
           core=0.0, rays=True, solid=0.3):
    """Aurora corona seen from directly below: thousands of rays converging on (cx, cy), with arc-shaped bright
    bands (a blurred ring mask) so the rays read as drapery in perspective. Pure SVG, baked offline."""
    r = random.Random(seed)
    sect = Noise(seed + 1, 6, 5, period=None)
    lenn = Noise(seed + 2, 5, 10, period=None)
    defs = ""
    for name in set(m for m, _ in mix):
        defs += f'<radialGradient id="rg-{name}" gradientUnits="userSpaceOnUse" cx="{cx}" cy="{cy}" r="{R}">' + "".join(
            f'<stop offset="{o}" stop-color="{c}" stop-opacity="{a}"/>' for o, c, a in CORONA_PAL[name]) + "</radialGradient>"
    names = [m for m, _ in mix]; wts = [w for _, w in mix]
    th0, th1 = -0.16, math.pi + 0.16
    body = []; thin = []
    for i in range(nrays):
        t = (i + r.random()) / nrays
        th = th0 + (th1 - th0) * t
        e = sect(t) ** 1.6
        e *= 0.25 + 0.75 * lenn(t * 2 + .1)
        a = min(1.0, hot * (0.22 + 0.9 * e) * (0.5 + 0.7 * r.random() ** 1.3))
        if a < 0.05: continue
        d0 = R * r.uniform(0.01, 0.2) * (1.0 - 0.6 * e)
        d1 = R * (0.55 + 0.45 * lenn(t * 3.7 + .5)) * r.uniform(0.75, 1.0)
        wpx = r.uniform(1.6, 5.5)
        dth = wpx / d1
        c, s_ = math.cos(th), math.sin(th)
        a0, a1 = th - dth * 0.12, th + dth * 0.12
        p0 = (cx + d0 * math.cos(a0), cy + d0 * math.sin(a0)); p1 = (cx + d0 * math.cos(a1), cy + d0 * math.sin(a1))
        q1 = (cx + d1 * math.cos(th + dth / 2), cy + d1 * math.sin(th + dth / 2)); q0 = (cx + d1 * math.cos(th - dth / 2), cy + d1 * math.sin(th - dth / 2))
        nm = r.choices(names, wts)[0]
        poly = f'<polygon points="{fmt(p0[0])},{fmt(p0[1])} {fmt(p1[0])},{fmt(p1[1])} {fmt(q1[0])},{fmt(q1[1])} {fmt(q0[0])},{fmt(q0[1])}" fill="url(#rg-{nm})" opacity="{a:.2f}"/>'
        body.append(poly)
        if r.random() < 0.2 and a > 0.4:
            wpx2 = max(0.8, wpx * 0.4)
            dth2 = wpx2 / d1
            q = (cx + d1 * 0.96 * math.cos(th), cy + d1 * 0.96 * math.sin(th))
            thin.append(f'<line x1="{fmt(cx + d0*1.4*c)}" y1="{fmt(cy + d0*1.4*s_)}" x2="{fmt(q[0])}" y2="{fmt(q[1])}" stroke="url(#rg-{nm})" stroke-width="{fmt(wpx2)}" opacity="{min(1, a*1.25):.2f}"/>')
    # bright arcs: wobbly rings around the apex, blurred, used as a luminance mask
    rings = ""
    for k in range(nbands):
        rk = R * (0.22 + 0.70 * (k + r.random() * .8) / nbands)
        wob = Noise(seed + 50 + k, 4, 3, period=None)
        pts = []
        steps = 90
        for j in range(steps + 1):
            tt = j / steps
            th = th0 + (th1 - th0) * tt
            rr = rk * (1 + 0.16 * (wob(tt) - .5) * 2)
            pts.append((cx + rr * math.cos(th), cy + rr * math.sin(th)))
        d = "M" + " L".join(f"{fmt(x)},{fmt(y)}" for x, y in pts)
        rings += f'<path d="{d}" fill="none" stroke="#fff" stroke-width="{fmt(r.uniform(60, 190))}" opacity="{r.uniform(.5, 1):.2f}"/>'
    defs += f'<filter id="rbl" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="38"/></filter>'
    defs += f'<mask id="bm" maskUnits="userSpaceOnUse" x="0" y="0" width="{W}" height="{H}"><rect width="{W}" height="{H}" fill="#000"/><g filter="url(#rbl)">{rings}</g></mask>'
    defs += '<filter id="b6" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="6"/></filter>'
    defs += '<filter id="b14" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="16"/></filter>'
    defs += '<filter id="b07"><feGaussianBlur stdDeviation="0.7"/></filter>'
    defs += f'<g id="rays">{"".join(body)}</g><g id="thin">{"".join(thin)}</g>'
    out = ""
    if rays:
        out += f'<g filter="url(#b14)" opacity=".7"><use href="#rays"/></g>'
        out += f'<g filter="url(#b07)" opacity="{solid}"><use href="#rays"/></g>'
        out += f'<g mask="url(#bm)"><g filter="url(#b6)" opacity=".6"><use href="#rays"/></g><g filter="url(#b07)"><use href="#rays"/><use href="#thin"/></g></g>'
    if core:
        defs += f'<radialGradient id="core" gradientUnits="userSpaceOnUse" cx="{cx}" cy="{cy}" r="{R*0.3}"><stop offset="0" stop-color="rgb(235,255,240)" stop-opacity="{core}"/><stop offset=".18" stop-color="rgb(150,255,200)" stop-opacity="{core*.7:.2f}"/><stop offset=".5" stop-color="rgb(150,110,255)" stop-opacity="{core*.3:.2f}"/><stop offset="1" stop-color="rgb(150,110,255)" stop-opacity="0"/></radialGradient>'
        out += f'<circle cx="{cx}" cy="{cy}" r="{R*0.3}" fill="url(#core)"/>'
    return svg(W, H, out, defs)


# ------------------------------------------------------------------ trees

def taper(pts, w0, w1):
    n = len(pts); L = []; Rr = []
    for i, (x, y) in enumerate(pts):
        j = min(i + 1, n - 1); k = max(i - 1, 0)
        dx, dy = pts[j][0] - pts[k][0], pts[j][1] - pts[k][1]
        d = math.hypot(dx, dy) or 1
        nx, ny = -dy / d, dx / d
        w = (w0 + (w1 - w0) * i / (n - 1)) / 2
        L.append((x + nx * w, y + ny * w)); Rr.append((x - nx * w, y - ny * w))
    return L + Rr[::-1]


def birch(cx, base, h, r, twig=1.0):
    """Leafless winter birch. Returns (trunk_poly_d, {width: stroke_path_d}, marks_d)."""
    lean = r.uniform(-.05, .05)
    ph = r.uniform(0, 6)
    n = 12
    top_h = h * r.uniform(.78, .95)
    cl = []
    for i in range(n + 1):
        t = i / n
        cl.append((cx + lean * h * t + math.sin(ph + t * 5) * h * .008, base - top_h * t))
    w0 = max(2.0, h * r.uniform(.020, .030))
    trunk = taper(cl, w0, w0 * .3)
    strokes = {}
    def add(w, pts):
        key = round(max(1.2, w), 1)
        strokes.setdefault(key, []).append("M" + " L".join(f"{fmt(x)},{fmt(y)}" for x, y in pts))
    def branch(x, y, ang, ln, w, depth):
        pts = [(x, y)]
        a = ang
        segs = 3
        for s in range(segs):
            a += r.uniform(-.18, .18) + (0.07 if ang > 0 else -0.07) * (1 if depth else 0.3)  # slightly drooping/arching
            x += math.sin(a) * ln / segs; y -= math.cos(a) * ln / segs
            pts.append((x, y))
        add(w, pts)
        if depth < 3:
            kids = r.choice([2, 2, 3]) if depth < 2 else 2
            for _ in range(int(max(1, round(kids * twig)))):
                f = r.uniform(.45, 1.0)
                i0 = min(segs, int(f * segs) + 1)
                bx, by = pts[i0]
                da = r.choice([-1, 1]) * r.uniform(.3, .75)
                branch(bx, by, a + da, ln * r.uniform(.45, .68), w * .62, depth + 1)
    nb = r.randint(10, 15)
    for i in range(nb):
        t = r.uniform(.3, .99)
        k = min(n, int(t * n)); fx = t * n - k
        px, py = cl[k]
        side = 1 if i % 2 == 0 else -1
        ang = side * r.uniform(.3, .85) * (1 - 0.35 * t)
        ln = h * r.uniform(.12, .26) * (1.05 - 0.55 * t)
        branch(px, py, ang, ln, h * .0075, 0)
    # leader
    add(h * .006, [cl[-2], cl[-1], (cl[-1][0] + r.uniform(-4, 4), cl[-1][1] - h * .06)])
    # dark bark marks
    marks = []
    for k in range(0, int(top_h * .62), 1):
        pass
    y = base - h * .03
    while y > base - top_h * .66:
        t = (base - y) / top_h
        i = min(n - 1, int(t * n)); f = t * n - i
        x = cl[i][0] + (cl[i + 1][0] - cl[i][0]) * f
        w = (w0 + (w0 * .3 - w0) * t) * r.uniform(.45, .95)
        hh = max(.9, h * r.uniform(.003, .007))
        xo = x + r.uniform(-.25, .1) * w
        marks.append(f"M{fmt(xo - w/2)},{fmt(y)} L{fmt(xo + w/2)},{fmt(y)} L{fmt(xo + w/2 - .2)},{fmt(y - hh)} L{fmt(xo - w/2 + .3)},{fmt(y - hh)}Z")
        y -= h * r.uniform(.018, .055)
    return poly_d(trunk), {w: "".join(v) for w, v in strokes.items()}, "".join(marks)


def tuft(cx, cy, rx, ry, r, n=13):
    pts = []
    for i in range(n):
        a = math.tau * i / n
        k = r.uniform(.65, 1.25) if i % 2 == 0 else r.uniform(.5, .95)
        pts.append((cx + math.cos(a) * rx * k, cy + math.sin(a) * ry * k * (0.8 if math.sin(a) > 0 else 1.15)))
    return pts


def pine(cx, base, h, r):
    """Eastern white pine: tall bare trunk, irregular layered plumes high up. Returns (fill_d, strokes_d)."""
    lean = r.uniform(-.04, .04)
    n = 10
    cl = [(cx + lean * h * (i / n) + math.sin(i * .7 + cx) * h * .006, base - h * (i / n)) for i in range(n + 1)]
    w0 = max(2.0, h * r.uniform(.024, .034))
    fill = [poly_d(taper(cl, w0, w0 * .22))]
    strokes = []
    top0 = r.uniform(.28, .42)
    k = 0
    t = top0
    while t < .985:
        i = min(n - 1, int(t * n)); f = t * n - i
        px = cl[i][0] + (cl[i + 1][0] - cl[i][0]) * f; py = cl[i][1] + (cl[i + 1][1] - cl[i][1]) * f
        side = 1 if k % 2 == 0 else -1
        if r.random() < .25: side = -side
        span = (t - top0) / (1 - top0)
        L = h * (.19 - .14 * span ** .9) * r.uniform(.55, 1.15)
        rise = L * r.uniform(.05, .22)
        droop = L * r.uniform(.0, .12)
        pts = [(px, py), (px + side * L * .45, py - rise), (px + side * L, py - rise + droop)]
        strokes.append("M" + " L".join(f"{fmt(x)},{fmt(y)}" for x, y in pts))
        nt = r.choice([2, 3, 3])
        for j in range(nt):
            q = .45 + .55 * (j + 1) / nt
            tx = px + side * L * q; ty = py - rise * min(1, q * 1.3) + droop * max(0, q - .5) * 2
            rx = L * r.uniform(.17, .27) * (1.15 - .4 * q)
            fill.append(poly_d(tuft(tx, ty, rx, rx * r.uniform(.32, .46), r)))
        # inner tuft near trunk
        fill.append(poly_d(tuft(px + side * L * .22, py - rise * .3, L * .16, L * .06, r, 9)))
        t += r.uniform(.028, .06) * (1 + .6 * (1 - span))
        k += 1
    topx, topy = cl[-1]
    fill.append(poly_d(tuft(topx, topy + h * .015, h * .035, h * .018, r, 9)))
    strokes.append(f"M{fmt(topx)},{fmt(topy)} L{fmt(topx + lean*10)},{fmt(topy - h*.05)}")
    return "".join(fill), "".join(strokes), w0


def forest(seed, W, H, base, relief, species, grad_stops, rim=None, trunk_stops=None, mark="#04090f", rough=.55,
           ridge_seed=None, wrap=True, ground_extra=None, ridge_mid=None, bare=None, twig=1.0):
    """Seamless 2400-wide tile: a snow-bank ridge with trees standing on it. Everything in one SVG.
    species: list of (kind, weight, h_lo, h_hi, spacing); kinds: spruce / pine / birch.
    Returns (defs, body, svgstring)."""
    r = random.Random(seed)
    hs = ridge_heights(ridge_seed or seed, 96, rough, True)
    def ry(x): return H * base - relief * sample(hs, (x % W) / W)
    pts = [(W * i / 240, ry(W * i / 240)) for i in range(241)]
    ground = "M-4," + str(H) + " L" + " L".join(f"{fmt(x)},{fmt(y)}" for x, y in pts) + f" L{W+4},{H}Z"
    dark = [ground]; strokes = {}; pale = []; marks = []; pale_strokes = {}
    kinds = [s[0] for s in species]; wts = [s[1] for s in species]
    x = r.uniform(0, 80)
    maxsp = max(s[4] for s in species)
    # advance by per-species spacing so tall slender birches are not bunched
    while x < W + 200:
        kind, _, hlo, hhi, sp = species[r.choices(range(len(species)), wts)[0]]
        hh = r.uniform(hlo, hhi)
        sd = int(x * 13) + seed
        for off in ((-W, 0, W) if wrap else (0,)):
            xx = x + off
            if -hh * .6 < xx < W + hh * .6:
                rr = random.Random(sd)
                by = ry(x % W) + hh * .02
                if kind == "spruce":
                    dark.append(poly_d(spruce_poly(xx, by, hh, hh * .34, rr)))
                elif kind == "pine":
                    f, s, w0 = pine(xx, by, hh, rr)
                    dark.append(f); strokes.setdefault(round(max(1.2, hh * .011), 1), []).append(s)
                elif kind == "birch":
                    td, sk, mk = birch(xx, by, hh, rr, twig)
                    pale.append(td); marks.append(mk)
                    for w, d in sk.items(): pale_strokes.setdefault(w, []).append(d)
        x += sp * r.uniform(.6, 1.4)
    defs = uni_grad("fg", grad_stops, 0, H)
    if trunk_stops: defs += uni_grad("tg", trunk_stops, 0, H)
    body = ""
    full = "".join(dark)
    if rim:
        body += f'<path d="{full}" fill="{rim}" transform="translate(0,-2.2)"/>'
    body += f'<path d="{full}" fill="url(#fg)"/>'
    for w, ds in strokes.items():
        body += f'<path d="{"".join(ds)}" fill="none" stroke="url(#fg)" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"/>'
    # birches in front: twigs dark, trunk pale with dark bark marks
    for w, ds in sorted(pale_strokes.items()):
        body += f'<path d="{"".join(ds)}" fill="none" stroke="url(#fg)" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"/>'
    if pale:
        body += f'<path d="{"".join(pale)}" fill="url(#{"tg" if trunk_stops else "fg"})"/>'
        body += f'<path d="{"".join(marks)}" fill="{mark}" opacity=".85"/>'
    return defs, body, svg(W, H, body, defs)


def mirror(defs, body, W, H, seed=3, fade=(.8, .1)):
    """Vertically flipped copy, cut into ripple rows. For a lake reflection."""
    rr = random.Random(seed + 99)
    bars = ""; yy = 0.0
    while yy < H:
        hgt = rr.uniform(3, 9) * (1 + yy / H * 1.3); gap = rr.uniform(.8, 2.6) * (.6 + yy / H)
        bars += f'<rect x="-10" y="{fmt(yy)}" width="{W+20}" height="{fmt(gap)}" fill="#000" opacity="{rr.uniform(.5, 1):.2f}"/>'
        yy += hgt
    d2 = defs + f'<mask id="rm" maskUnits="userSpaceOnUse" x="0" y="0" width="{W}" height="{H}"><rect width="{W}" height="{H}" fill="url(#rfade)"/>{bars}</mask>' + grad("rfade", [(0, "#fff", fade[0]), (1, "#fff", fade[1])])
    return svg(W, H, f'<g mask="url(#rm)"><g transform="translate(0,{H}) scale(1,-1)">{body}</g></g>', d2)


# ------------------------------------------------------------------ frozen lake

def ice(seed, W=2400, H=560, mode="d", glow_x=(.28, .52, .8)):
    """Snow-covered ice, drawn as an alpha overlay: lit sastrugi streaks, fanned cracks, sparkle, a green glow."""
    r = random.Random(seed)
    if mode == "d":
        glow = [("rgb(110,255,190)", .55), ("rgb(120,235,230)", .4), ("rgb(150,255,200)", .5)]
        streak, crack, spark = "rgb(190,255,225)", "rgb(2,12,18)", "#eafff4"
    else:
        glow = [("rgb(255,170,200)", .55), ("rgb(190,170,255)", .5), ("rgb(255,200,215)", .5)]
        streak, crack, spark = "rgb(255,240,250)", "rgb(60,60,130)", "#fff"
    defs = '<filter id="bs" x="-5%" y="-50%" width="110%" height="200%"><feGaussianBlur stdDeviation="9 1.2"/></filter>'
    defs += '<filter id="bg" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="40"/></filter>'
    defs += '<filter id="bc"><feGaussianBlur stdDeviation="0.6"/></filter>'
    body = ""
    gl = ""
    for gx, (c, a) in zip(glow_x, glow):
        gl += f'<ellipse cx="{gx*W:.0f}" cy="{H*0.02:.0f}" rx="{W*0.28:.0f}" ry="{H*0.34:.0f}" fill="{c}" opacity="{a}"/>'
    body += f'<g filter="url(#bg)">{gl}</g>'
    # wind-sculpted streaks: flat ellipses, perspective: thinner/closer packed near the horizon
    st = ""
    y = 6.0
    while y < H:
        k = (y / H)
        for _ in range(int(3 + 14 * k)):
            x = r.uniform(0, W)
            lx = r.uniform(60, 360) * (.4 + k * 1.4)
            ly = r.uniform(1, 3.4) * (.4 + k * 1.8)
            a = r.uniform(.06, .3) * (1 - .35 * k)
            st += f'<ellipse cx="{x:.0f}" cy="{y + r.uniform(-4, 4):.0f}" rx="{lx:.0f}" ry="{ly:.1f}" fill="{streak}" opacity="{a:.2f}"/>'
        y += r.uniform(5, 16) * (.6 + k * 1.6)
    body += f'<g filter="url(#bs)">{st}</g>'
    # cracks fanning from a vanishing point on the horizon
    vx, vy = W / 2, -H * .22
    cr = ""
    for _ in range(46):
        bx = r.uniform(-.1 * W, 1.1 * W)
        by = H + 20
        fx = r.uniform(.08, .5)  # how far up it runs
        pts = []
        n = 9
        for i in range(n + 1):
            t = i / n
            x = bx + (vx - bx) * t * (1 - fx * .0) * .0 + (bx + (vx - bx) * (t * (1 - 0.0)) - bx) * 0
            x = bx + (vx - bx) * t * 0.55 + r.uniform(-1, 1) * (3 + 18 * t * 0 + (1 - t) * 10)
            y = by + (vy - by) * t * 0.55 * (1 + .0)
            pts.append((x, y))
        # cut to a random length
        cut = max(3, int(n * r.uniform(.25, .9)))
        pts = pts[:cut]
        d = "M" + " L".join(f"{fmt(x)},{fmt(y)}" for x, y in pts)
        cr += f'<path d="{d}" fill="none" stroke="{crack}" stroke-width="{r.uniform(.7, 2.2):.1f}" opacity="{r.uniform(.25, .6):.2f}" stroke-linecap="round"/>'
        # frost halo beside each crack
        cr += f'<path d="{d}" fill="none" stroke="{streak}" stroke-width="{r.uniform(2, 5):.1f}" opacity=".07"/>'
    body += f'<g filter="url(#bc)">{cr}</g>'
    # sparkle
    sp = ""
    for _ in range(170):
        x = r.uniform(0, W); k = r.random() ** 1.4; y = H * k
        s = r.uniform(.5, 1.3) * (.6 + k)
        sp += f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{s:.1f}" fill="{spark}" opacity="{r.uniform(.3, .9):.2f}"/>'
    body += sp
    fade = grad("ifd", [(0, "#fff", 1), (.78, "#fff", 1), (1, "#fff", 0)])
    return svg(W, H, f'<g mask="url(#im)">{body}</g>', defs + fade + f'<mask id="im" maskUnits="userSpaceOnUse" x="0" y="0" width="{W}" height="{H}"><rect width="{W}" height="{H}" fill="url(#ifd)"/></mask>')


def mist(seed, W=2400, H=300, col="rgb(190,255,225)", a=.35):
    """Low ground-blizzard haze tile, soft ellipses."""
    r = random.Random(seed)
    e = ""
    for _ in range(26):
        x = r.uniform(0, W)
        for off in (-W, 0, W):
            e += f'<ellipse cx="{x+off:.0f}" cy="{r.uniform(H*.45, H*.85):.0f}" rx="{r.uniform(120, 420):.0f}" ry="{r.uniform(14, 46):.0f}" fill="{col}" opacity="{r.uniform(.15, a):.2f}"/>'
    return svg(W, H, f'<g filter="url(#m)">{e}</g>', '<filter id="m" x="-10%" y="-50%" width="120%" height="200%"><feGaussianBlur stdDeviation="22 9"/></filter>')
