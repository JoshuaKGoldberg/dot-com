"""Fire Tower additions: lattice fire tower, bald High Peaks summit (seamless), range with snow caps."""
import math, random
from lib import *
from lib2 import *


def fire_tower(x, y, h, col, win="rgba(255,196,110,.95)", sw=None):
    """A steel lattice fire tower (four tapering legs, cross-bracing, stair run, platform, hip-roofed cab). Returns svg fragments."""
    bw, tw = h * .46, h * .17
    sw = sw or max(1.6, h * .016)
    def lx(t, side): return x + side * (bw / 2 + (tw / 2 - bw / 2) * t)
    parts = []
    # legs (front pair slightly inside the back pair for depth)
    for side in (-1, 1):
        parts.append(f'M{fmt(lx(0, side))},{fmt(y)} L{fmt(lx(1, side))},{fmt(y - h)}')
    n = 6
    for k in range(n + 1):
        t = k / n
        parts.append(f'M{fmt(lx(t, -1))},{fmt(y - h * t)} L{fmt(lx(t, 1))},{fmt(y - h * t)}')
    for k in range(n):
        t0, t1 = k / n, (k + 1) / n
        parts.append(f'M{fmt(lx(t0, -1))},{fmt(y - h * t0)} L{fmt(lx(t1, 1))},{fmt(y - h * t1)}')
        parts.append(f'M{fmt(lx(t0, 1))},{fmt(y - h * t0)} L{fmt(lx(t1, -1))},{fmt(y - h * t1)}')
    # stair run, zigzag
    pts = []
    for k in range(n * 2 + 1):
        t = k / (n * 2)
        side = -.55 if k % 2 == 0 else .55
        pts.append(f'{fmt(lx(t, 1) * 0 + x + (lx(t, 1) - x) * side)},{fmt(y - h * t)}')
    parts.append("M" + " L".join(pts))
    legs = f'<path d="{"".join(parts)}" fill="none" stroke="{col}" stroke-width="{fmt(sw)}" stroke-linecap="square" stroke-linejoin="miter"/>'
    cw = tw * 1.45; ch = h * .15; top = y - h
    plat = f'<rect x="{fmt(x - cw * .62)}" y="{fmt(top - h*.018)}" width="{fmt(cw * 1.24)}" height="{fmt(h*.022)}" fill="{col}"/>'
    cab = f'<rect x="{fmt(x - cw / 2)}" y="{fmt(top - h*.018 - ch)}" width="{fmt(cw)}" height="{fmt(ch)}" fill="{col}"/>'
    roof = f'<polygon points="{fmt(x - cw * .66)},{fmt(top - h*.018 - ch)} {fmt(x + cw * .66)},{fmt(top - h*.018 - ch)} {fmt(x + cw * .2)},{fmt(top - h*.018 - ch - h*.06)} {fmt(x - cw * .2)},{fmt(top - h*.018 - ch - h*.06)}" fill="{col}"/>'
    rod = f'<path d="M{fmt(x)},{fmt(top - h*.018 - ch - h*.06)} L{fmt(x)},{fmt(top - h*.018 - ch - h*.13)}" stroke="{col}" stroke-width="{fmt(sw*.7)}"/>'
    wins = ""
    for i in range(3):
        wx = x - cw / 2 + cw * (.1 + .3 * i)
        wins += f'<rect x="{fmt(wx)}" y="{fmt(top - h*.018 - ch*.78)}" width="{fmt(cw*.2)}" height="{fmt(ch*.42)}" fill="{win}"/>'
    glow = f'<circle cx="{fmt(x)}" cy="{fmt(top - h*.1)}" r="{fmt(h*.4)}" fill="url(#wg)"/>'
    return glow + legs + plat + cab + roof + rod + wins


def summit(seed, W, H, base, relief, xs, A, sigma, fill, rim, snow, win, tower_h, tower_col, trees=True, tree_h=(40, 90)):
    """Seamless tile with a bald summit at xs carrying a fire tower. Ground runs to the bottom of the tile; krummholz stands on the slope."""
    r = random.Random(seed)
    hs = ridge_heights(seed, 96, .6, True)
    def ry(x):
        d = min(abs(x - xs), W - abs(x - xs))
        bump = A * math.exp(-((d / sigma) ** 1.6))
        return H * base - relief * sample(hs, (x % W) / W) ** 1.2 - bump
    N = 480
    pts = [(W * i / N, ry(W * i / N)) for i in range(N + 1)]
    d = "M-4," + str(H) + " L" + " L".join(f"{fmt(x)},{fmt(y)}" for x, y in pts) + f" L{W+4},{H}Z"
    defs = uni_grad("fg", fill, 0, H) + f'<clipPath id="pc"><path d="{d}"/></clipPath>'
    defs += f'<radialGradient id="wg"><stop offset="0" stop-color="{win}" stop-opacity=".32"/><stop offset="1" stop-color="{win}" stop-opacity="0"/></radialGradient>'
    defs += grad("sn", [(0, snow, .9), (1, snow, 0)])
    body = f'<path d="{d}" fill="{rim}" transform="translate(0,-2.4)"/><path d="{d}" fill="url(#fg)"/>'
    # snow on the upper slopes: crest band whose lower edge wanders
    sn = Noise(seed + 5, 6, 9, period=None)
    top = [(x, y) for x, y in pts]
    low = [(x, y + 18 + 90 * sn(x / W) * max(0, min(1, (H * .8 - y) / (H * .5)))) for x, y in pts]
    strip = "M" + " L".join(f"{fmt(x)},{fmt(y)}" for x, y in top) + " L" + " L".join(f"{fmt(x)},{fmt(y)}" for x, y in low[::-1]) + "Z"
    body += f'<g clip-path="url(#pc)"><path d="{strip}" fill="url(#sn)" opacity=".42"/></g>'
    if trees:
        tp = []
        x = r.uniform(0, 30)
        while x < W:
            y = ry(x)
            hh = r.uniform(*tree_h) * (0.5 + 0.9 * max(0, (y - H * .45) / (H * .5)))
            if y > H * .44 and hh > 14:
                for off in (-W, 0, W):
                    if -60 < x + off < W + 60:
                        tp.append(poly_d(spruce_poly(x + off, y + hh * .05, hh, hh * .36, random.Random(int(x) + seed))))
            x += r.uniform(14, 40)
        body += f'<path d="{"".join(tp)}" fill="{rim}" transform="translate(0,-2)"/><path d="{"".join(tp)}" fill="url(#fg)"/>'
    body += fire_tower(xs, ry(xs) + 6, tower_h, tower_col, win)
    return svg(W, H, body, defs), ry
