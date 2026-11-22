"""Shared generators for the Aurora Descent themes (#236-240). Pure stdlib; offline bake step."""
import math, random, os, subprocess

def fmt(v): 
    return ("%.1f" % v).rstrip("0").rstrip(".")

class Noise:
    """Smooth 1D noise from a few random sines (periodic if period given)."""
    def __init__(self, seed, octaves=5, base=3, period=1.0):
        r = random.Random(seed)
        self.parts = []
        for o in range(octaves):
            f = base * (1.9 ** o)
            if period: f = max(1, round(f))
            self.parts.append((f, r.uniform(0, math.tau), 1 / (1.6 ** o)))
        self.norm = sum(a for _, _, a in self.parts)
    def __call__(self, t):  # t in 0..1 -> 0..1
        s = sum(a * math.sin(math.tau * f * t + p) for f, p, a in self.parts)
        return 0.5 + 0.5 * s / self.norm

def ridge_heights(seed, n, rough=0.55, periodic=True):
    """1D midpoint displacement, returns list of n+1 floats in 0..1, wraps if periodic."""
    r = random.Random(seed)
    size = 1
    while size < n: size *= 2
    pts = [0.0] * (size + 1)
    pts[0] = r.random(); pts[size] = pts[0] if periodic else r.random()
    step, amp = size, 1.0
    while step > 1:
        half = step // 2
        for i in range(half, size, step):
            pts[i] = (pts[i - half] + pts[i + half]) / 2 + r.uniform(-amp, amp) * 0.5
        amp *= rough; step = half
    lo, hi = min(pts), max(pts)
    pts = [(p - lo) / (hi - lo) for p in pts]
    if periodic: pts[-1] = pts[0]
    return pts

def sample(pts, t):
    x = t * (len(pts) - 1); i = min(int(x), len(pts) - 2); f = x - i
    f = f * f * (3 - 2 * f)
    return pts[i] * (1 - f) + pts[i + 1] * f

def svg(w, h, body, defs="", extra=""):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" {extra}><defs>{defs}</defs>{body}</svg>'

def grad(id, stops, x2=0, y2=1, x1=0, y1=0):
    s = "".join(f'<stop offset="{o}" stop-color="{c}" stop-opacity="{a}"/>' for o, c, a in stops)
    return f'<linearGradient id="{id}" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}">{s}</linearGradient>'

# ---------------------------------------------------------------- aurora

PALETTES = {
    # offset (0 = top of ray, 1 = base), colour, alpha
    "emerald": [(0, "rgb(150,80,255)", 0), (0.2, "rgb(150,90,255)", .22), (0.46, "rgb(70,205,225)", .5), (0.74, "rgb(70,255,165)", .88), (0.92, "rgb(200,255,220)", 1), (1, "rgb(70,255,165)", 0)],
    "rose":    [(0, "rgb(255,70,170)", 0), (0.18, "rgb(255,70,160)", .26), (0.42, "rgb(190,90,240)", .4), (0.72, "rgb(90,255,175)", .82), (0.92, "rgb(215,255,225)", 1), (1, "rgb(90,255,175)", 0)],
    "teal":    [(0, "rgb(80,120,255)", 0), (0.2, "rgb(90,130,255)", .28), (0.5, "rgb(60,225,215)", .55), (0.8, "rgb(110,255,170)", .9), (0.93, "rgb(220,255,230)", 1), (1, "rgb(110,255,170)", 0)],
    "violet":  [(0, "rgb(120,60,255)", 0), (0.25, "rgb(135,80,255)", .3), (0.58, "rgb(190,100,255)", .5), (0.85, "rgb(255,120,220)", .7), (0.95, "rgb(255,200,240)", .9), (1, "rgb(255,120,220)", 0)],
    "green":   [(0, "rgb(60,255,160)", 0), (0.3, "rgb(60,255,160)", .3), (0.7, "rgb(90,255,150)", .8), (0.93, "rgb(220,255,210)", 1), (1, "rgb(90,255,150)", 0)],
}

def curtain(seed, W=2400, H=800, edge=0.74, amp=0.1, height=0.62, palette="emerald", step=2.6,
            lean=0.0, hot=1.0, span=(0.04, 0.96), folds=3, glow=True, rays=True, id="c", sharp=1.0, raw=False):
    """A hanging aurora ribbon: wavy bright lower edge, thousands of rays, soft body glow."""
    r = random.Random(seed)
    edge_n = Noise(seed + 1, 4, folds)
    env_n = Noise(seed + 2, 4, 2, period=None)
    ray_n = Noise(seed + 3, 6, 11)
    pat_n = Noise(seed + 4, 5, 5, period=None)
    gid = f"g{id}"
    defs = grad(gid, PALETTES[palette])
    defs += grad(gid + "w", [(0, "#fff", 0), (.5, "#fff", .1), (.88, "#fff", .8), (1, "#fff", 0)])
    body, glowb, hi = [], [], []
    x = W * span[0]
    x1 = W * span[1]
    def yb(t): return H * (edge + amp * (edge_n(t) - 0.5) * 2)
    while x < x1:
        t = x / W
        u = (x - W * span[0]) / (W * (span[1] - span[0]))
        env = math.sin(math.pi * u) ** 0.65
        env *= 0.35 + 0.65 * pat_n(t * 1.0)
        slope = abs(yb(t + 0.004) - yb(t - 0.004)) / (0.008 * W)
        fold = min(1.6, 0.55 + slope * 5)
        rr = ray_n(t) ** 1.6
        h = H * height * (0.35 + 0.65 * (0.3 * rr + 0.7 * pat_n(t * 2.3 + 0.2))) * (0.6 + 0.4 * env) * fold ** 0.5
        a = env * (0.12 + 0.88 * (r.random() ** 2.2) * (0.5 + rr)) * hot * fold ** 0.6
        a = min(a, 1)
        w = step * r.uniform(0.9, 2.1)
        y1 = yb(t) + 3
        y0 = y1 - h
        lx = lean * (t - 0.5) * h
        if a > 0.02:
            body.append(f'<polygon points="{fmt(x+lx)},{fmt(y0)} {fmt(x+lx+w)},{fmt(y0)} {fmt(x+w)},{fmt(y1)} {fmt(x)},{fmt(y1)}" fill="url(#{gid})" opacity="{a:.2f}"/>')
        # bright thin pillars near the lower edge
        if r.random() < 0.16 * sharp and a > 0.25:
            hh = h * r.uniform(0.18, 0.5)
            hi.append(f'<rect x="{fmt(x)}" y="{fmt(y1-hh)}" width="{fmt(max(0.8,w*0.45))}" height="{fmt(hh)}" fill="url(#{gid}w)" opacity="{min(1,a*1.3):.2f}"/>')
        x += step
    # broad soft body: wide translucent ribs
    x = W * span[0]
    while x < x1:
        t = x / W
        u = (x - W * span[0]) / (W * (span[1] - span[0]))
        env = math.sin(math.pi * u) ** 0.6 * (0.4 + 0.6 * pat_n(t))
        h = H * height * 1.15 * (0.5 + 0.5 * pat_n(t * 1.7 + .3))
        w = r.uniform(24, 60)
        y1 = yb(t) + 18
        glowb.append(f'<polygon points="{fmt(x)},{fmt(y1-h)} {fmt(x+w)},{fmt(y1-h)} {fmt(x+w)},{fmt(y1)} {fmt(x)},{fmt(y1)}" fill="url(#{gid})" opacity="{env*0.5*hot:.2f}"/>')
        x += w * 0.7
    defs += '<filter id="b1" x="-5%" y="-30%" width="110%" height="160%"><feGaussianBlur stdDeviation="14"/></filter>'
    defs += '<filter id="b2" x="-5%" y="-30%" width="110%" height="160%"><feGaussianBlur stdDeviation="5"/></filter>'
    defs += '<filter id="b3"><feGaussianBlur stdDeviation="0.7"/></filter>'
    out = ""
    if glow: out += f'<g filter="url(#b1)">{"".join(glowb)}</g>'
    if rays:
        out += f'<g filter="url(#b2)" opacity=".55">{"".join(body)}</g>'
        out += f'<g filter="url(#b3)">{"".join(body)}</g>'
        out += f'<g filter="url(#b3)">{"".join(hi)}</g>'
    if raw: return defs, out
    return svg(W, H, out, defs)

def stars(seed, W=1200, H=900, n=160, tint=True):
    r = random.Random(seed)
    out = []
    for _ in range(n):
        x, y = r.uniform(0, W), r.uniform(0, H)
        size = r.choice([0.6, 0.7, 0.8, 0.9, 1.0, 1.2, 1.4, 1.8, 2.4]) 
        a = r.uniform(0.45, 1)
        col = r.choice(["#ffffff", "#ffffff", "#e8f2ff", "#fff3e0", "#d8e6ff"]) if tint else "#fff"
        out.append(f'<circle cx="{fmt(x)}" cy="{fmt(y)}" r="{size}" fill="{col}" opacity="{a:.2f}"/>')
        if size >= 1.8:
            out.append(f'<circle cx="{fmt(x)}" cy="{fmt(y)}" r="{size*3.4}" fill="url(#halo)" opacity="{a*0.5:.2f}"/>')
    defs = '<radialGradient id="halo"><stop offset="0" stop-color="#cfe0ff" stop-opacity=".55"/><stop offset="1" stop-color="#cfe0ff" stop-opacity="0"/></radialGradient>'
    return svg(W, H, "".join(out), defs)

# ---------------------------------------------------------------- silhouettes

def spruce_poly(cx, base, h, w, r, tiers=None, droop=1.0):
    """One layered spruce as a polygon; returns point list (closed), with base at `base`."""
    tiers = tiers or r.randint(8, 12)
    top = base - h
    pts_r = [(cx, top)]
    pts_l = []
    for k in range(tiers):
        f0 = k / tiers; f1 = (k + 1) / tiers
        y_a = top + h * f0 * 0.98
        y_b = top + h * f1 * 0.98
        wk = w * (0.12 + 0.88 * f1 ** 0.9) * r.uniform(0.85, 1.12)
        wi = w * (0.05 + 0.5 * f0 ** 0.9)
        yb_ = y_b + (h / tiers) * 0.25 * droop
        pts_r += [(cx + wi * 0.6, y_a + (y_b - y_a) * 0.45), (cx + wk, yb_), (cx + wk * 0.45, y_b - (y_b - y_a) * 0.18)]
        pts_l += [(cx - wi * 0.6 * r.uniform(.9, 1.1), y_a + (y_b - y_a) * 0.45), (cx - wk * r.uniform(.9, 1.1), yb_), (cx - wk * 0.45, y_b - (y_b - y_a) * 0.18)]
    tw = max(1.5, w * 0.06)
    pts = pts_r + [(cx + tw, base), (cx - tw, base)] + pts_l[::-1]
    return pts

def poly_d(pts):
    return "M" + " L".join(f"{fmt(x)},{fmt(y)}" for x, y in pts) + "Z"

def ridge_with_spruce(seed, W, H, base_frac, relief, tree_h, tree_w, density, ridge_seed=None, trees=True, rough=0.55,
                     fill="#02060c", rim=None, ground_to=None, sw=0.0, mist=None, mirror=False):
    """Seamless tile (wraps): ridge hills with spruce standing on them, all one path plus ground to the bottom.
    The trees are placed on the ridge surface itself, so they cannot float."""
    r = random.Random(seed)
    hs = ridge_heights(ridge_seed or seed, 128, rough, True)
    def ridge_y(x):
        return H * base_frac - relief * sample(hs, (x % W) / W)
    pts = []
    N = 240
    for i in range(N + 1):
        x = W * i / N
        pts.append((x, ridge_y(x)))
    d = "M-4," + str(H) + " L" + " L".join(f"{fmt(x)},{fmt(y)}" for x, y in pts) + f" L{W+4},{H}Z"
    tree_paths = []
    if trees:
        x = r.uniform(0, tree_w)
        while x < W + tree_w:
            hh = tree_h * r.uniform(0.55, 1.25)
            ww = tree_w * (hh / tree_h) * r.uniform(0.8, 1.15)
            sink = hh * 0.06
            for off in (-W, 0, W):
                xx = x + off
                if -ww * 1.5 < xx < W + ww * 1.5:
                    tree_paths.append(poly_d(spruce_poly(xx, ridge_y(x % W) + sink, hh, ww, random.Random(int(x * 7) + seed))))
            x += tree_w * r.uniform(0.35, 1.0) / density
    full = d + "".join(tree_paths)
    out = ""
    if rim and not mirror:
        out += f'<path d="{full}" fill="{rim}" transform="translate(0,-2.4)"/>'
    out += f'<path d="{full}" fill="url(#fillg)"/>'
    if mirror:
        rr = random.Random(seed + 99)
        bars = ""
        yy = 0.0
        while yy < H:
            hgt = rr.uniform(3, 9) * (1 + yy / H * 1.3); gap = rr.uniform(0.8, 2.6) * (0.6 + yy / H)
            bars += f'<rect x="-10" y="{fmt(yy)}" width="{W+20}" height="{fmt(gap)}" fill="#000" opacity="{rr.uniform(.5,1):.2f}"/>'
            yy += hgt
        defmask = f'<mask id="rm" maskUnits="userSpaceOnUse" x="0" y="0" width="{W}" height="{H}"><rect width="{W}" height="{H}" fill="url(#rfade)"/>{bars}</mask>' + grad("rfade", [(0, "#fff", .8), (1, "#fff", 0.1)])
        out = f'<g mask="url(#rm)"><g transform="translate(0,{H}) scale(1,-1)">{out}</g></g>'
    if mist:
        out += f'<rect x="0" y="{H*base_frac-relief*1.1:.0f}" width="{W}" height="{relief*1.1+tree_h*1.1:.0f}" fill="url(#mist)"/>'
    defs = grad("fillg", [(0, fill if isinstance(fill, str) else fill[0], 1), (1, fill if isinstance(fill, str) else fill[1], 1)])
    if mist: defs += grad("mist", mist)
    if mirror: defs += defmask
    return svg(W, H, out, defs)

def peaks(seed, W, H, base_frac, relief, fill, rim=None, snow=None, rough=0.62, jag=0.0, tower=None):
    """Mountain ridge, seamless. Optional tower=(x_frac, size) draws a fire tower on the nearest summit-ish spot."""
    hs = ridge_heights(seed, 96, rough, True)
    N = 400
    pts = []
    for i in range(N + 1):
        x = W * i / N
        t = i / N
        y = H * base_frac - relief * (sample(hs, t) ** 1.3)
        pts.append((x, y))
    d = "M-4," + str(H) + " L" + " L".join(f"{fmt(x)},{fmt(y)}" for x, y in pts) + f" L{W+4},{H}Z"
    out = ""
    defs = grad("pg", [(0, fill[0], 1), (1, fill[1], 1)])
    if rim:
        out += f'<path d="{d}" fill="{rim}" transform="translate(0,-2)"/>'
    out += f'<path d="{d}" fill="url(#pg)"/>'
    if snow:
        # snow caps: crest strip fading downward, clipped to the mountain
        defs += f'<clipPath id="pc"><path d="{d}"/></clipPath>' + grad("sn", [(0, snow, .85), (1, snow, 0)])
        out += f'<g clip-path="url(#pc)"><path d="M-4,{H*base_frac-relief*1.05:.0f} " fill="none"/>'
        strip = "M" + " L".join(f"{fmt(x)},{fmt(y)}" for x, y in pts) + " L" + " L".join(f"{fmt(x)},{fmt(y+relief*0.16*(1-(y-(H*base_frac-relief))/relief*0.0))}" for x, y in pts[::-1]) + "Z"
        out += f'<path d="{strip}" fill="url(#sn)" opacity=".5"/></g>'
    return svg(W, H, out, defs), pts

def bake(svg_path, png_path, w, h):
    from patchright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", headless=True)
        pg = b.new_page(viewport={"width": w, "height": h})
        pg.set_content(f"<html><body style='margin:0;background:transparent'>{open(svg_path).read()}</body></html>")
        pg.screenshot(path=png_path, omit_background=True, clip={"x": 0, "y": 0, "width": w, "height": h})
        b.close()

def to_webp(png, webp, q=88):
    subprocess.run(["cwebp", "-quiet", "-q", str(q), "-alpha_q", "92", "-m", "6", png, "-o", webp], check=True)


def reflection(curtains, W=2400, R=520, edge_y=0.78, H=800, rows=30, seed=5, fade=0.9, mist=None):
    """Aurora mirrored in water: flipped curtains, cut into rows displaced sideways, broken by ripple gaps."""
    r = random.Random(seed)
    defs = ""; body = ""
    for c in curtains:
        d, b = c
        defs += d; body += b
    defs += f'<g id="src">{body}</g>'
    defs = defs.replace('<g id="src">', '<g id="src">')  # keep order
    rowsvg = ""
    clips = ""
    y = 0.0
    i = 0
    while y < R:
        hgt = r.uniform(6, 18) * (1 + y / R * 1.6)
        dx = r.uniform(-1, 1) * (2 + y / R * 16)
        gap = r.uniform(0.4, 1.6) * (0.5 + y / R)
        a = r.uniform(0.55, 1) * (1 - fade * (y / R) ** 1.1)
        clips += f'<clipPath id="r{i}"><rect x="-40" y="{fmt(y)}" width="{W+80}" height="{fmt(hgt-gap)}"/></clipPath>'
        rowsvg += f'<g clip-path="url(#r{i})" opacity="{a:.2f}"><use href="#flip" x="{fmt(dx)}"/></g>'
        y += hgt; i += 1
    defs += clips
    flip = f'<g id="flip" transform="translate(0,{fmt(edge_y*H)}) scale(1,-1)"><use href="#src"/></g>'
    # <g id=src> must live in defs, flip too
    defs += '<filter id="rb" x="-2%" y="-5%" width="104%" height="110%"><feGaussianBlur stdDeviation="1.6 4.5"/></filter>'
    out = f'<defs>{flip}</defs><g filter="url(#rb)">' + rowsvg + '</g>'
    return svg(W, R, out, defs)
