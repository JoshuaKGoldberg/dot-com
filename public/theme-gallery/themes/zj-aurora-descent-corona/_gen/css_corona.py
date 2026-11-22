import os, random
from css import *
HERE = os.path.dirname(os.path.abspath(__file__))
ID = "zj-aurora-descent-corona"
PF = "zco"
M = "html:not(.reduce-motion) .site"
A = "zj-aurora-descent-corona/"

head = '''/*
 * Aurora Descent II: Corona. Zero JS, there is no themes/zj-aurora-descent-corona.js.
 *   You start on your back, looking straight up: aurora rays converge on a point overhead. Scrolling lowers your gaze.
 *     - three baked corona layers (green / rose / teal) slide up and crossfade with opacity alone
 *     - horizon curtains rise into place behind the birch and pine; the frozen lake arrives last
 *     - compositor-only: scroll animations touch translate + opacity, nothing else
 *   Ambient: each corona layer gets ONE prime-period animation (a slow rotate about the apex + irregular opacity flares).
 *   Baked art: rays, ring-mask arcs, blur and bloom were rendered offline from SVG to WebP (see _gen/).
 *   Trees and their snowbank ground are single SVG tiles, so nothing stands on air.
 * Light mode is twilight: a blue-hour sky with a pale corona and rose snow. Reduced motion shows the static composition.
 */

.site {
	--siteBg: #f2f0fa;
	--siteFg: #1f2548;
	--siteFgStrong: #0e1236;
	--siteMuted: #4f5a82;
	--siteAccent: #3a3fb4;
	--siteSquiggle: #6f7df0;
	--siteSubtle: #dcddf0;
	--scrim: 83%;
	--tw-lo: 0.1;
	--tw-hi: 0.45;
	--lake: 34vh;
	--farH: 30vh;
	--midH: 34vh;
	--shoreH: 54vh;
	--cw: max(150vw, 200vh);
	--ch: calc(var(--cw) * 0.625);
	--aw: max(125vw, 170vh);
	--ah: calc(var(--aw) / 3);
	--gf: #8f8ab8;
	--gm: #222c5c;
	--gs: #121843;
	--badgeBg: color-mix(in srgb, var(--siteBg) 90%, transparent);
	--badgeFg: var(--siteFgStrong);
	--badgeLine: color-mix(in srgb, var(--siteSquiggle) 70%, transparent);
	--tags: "scroll-timeline \\00b7 translate + opacity only \\00b7 one animation per layer \\00b7 baked rays";
}

html.dark .site {
	--siteBg: #050a14;
	--siteFg: #d4e2ee;
	--siteFgStrong: #f3faff;
	--siteMuted: #8fa6bf;
	--siteAccent: #7cf0c4;
	--siteSquiggle: #4de8b0;
	--siteSubtle: #0d1d30;
	--scrim: 80%;
	--tw-lo: 0.4;
	--tw-hi: 0.95;
	--gf: #12404a;
	--gm: #030a12;
	--gs: #020509;
}

@media (max-aspect-ratio: 1/1) {
	.site { --cw: max(165vh, 220vw); }
}

/* ---- sky: a tall gradient that pans up with the gaze ---- */

.site::before {
	background: linear-gradient(180deg, #121c66 0, #26358a 22%, #5864ab 44%, #b283b4 62%, #eeb0a6 71%, #b79fca 82%, #6a68a8 100%);
	height: 150vh;
	inset: var(--barHeight, 0px) 0 auto 0;
}

html.dark .site::before {
	background: linear-gradient(180deg, #01020a 0, #030a1c 22%, #061a2a 44%, #0a2c38 60%, #14504c 71%, #0b2b36 84%, #04101a 100%);
}

.site .site-scenery::before,
.site .site-scenery::after {
	inset: 0;
}

.site .site-scenery::before {
	background: url("''' + A + '''stars-a.svg") 0 0 / 1200px 900px repeat;
	height: 130vh;
	opacity: 0.4;
}

.site .site-scenery::after {
	background: url("''' + A + '''stars-b.svg") 0 0 / 1400px 900px repeat;
	height: 130vh;
	opacity: 0.35;
}

html.dark .site .site-scenery::before { opacity: 0.95; }
html.dark .site .site-scenery::after { opacity: 0.8; }

/* ---- corona: rays converge on a point overhead (the apex is at 4.7% of each layer). Hosts scroll; pseudos shimmer ---- */

.site .scenery-a::before,
.site .scenery-a::after,
.site .scenery-b::before,
.site .scenery-b::after {
	background-position: 0 0;
	background-repeat: no-repeat;
	background-size: 100% 100%;
	height: var(--ch);
	left: 50%;
	margin-left: calc(var(--cw) / -2);
	top: calc(var(--ch) * -0.0467 + 3vh);
	transform-origin: 50% 4.67%;
	width: var(--cw);
}

.site .scenery-a::before { background-image: url("''' + A + '''cor-a.webp"); }
.site .scenery-a::after { background-image: url("''' + A + '''cor-c.webp"); }
.site .scenery-b::before { background-image: url("''' + A + '''cor-b.webp"); }
.site .scenery-b::after { background-image: url("''' + A + '''cor-c.webp"); transform: scale(-1, 1) rotate(7deg); }

/* horizon curtains, hung low in the north, behind the trees */
.site .scenery-c::before,
.site .scenery-c::after {
	background-position: 0 0;
	background-repeat: no-repeat;
	background-size: 100% 100%;
	height: var(--ah);
	left: 50%;
	margin-left: calc(var(--aw) / -2);
	width: var(--aw);
}

.site .scenery-c::before { background-image: url("''' + A + '''hor-a.webp"); top: calc(60vh - var(--ah) * 0.78); }
.site .scenery-c::after { background-image: url("''' + A + '''hor-b.webp"); top: calc(58vh - var(--ah) * 0.7); }

/* ---- the land ---- */

.site-page::before,
.site-header::before,
.site-header::after {
	left: 0;
	right: 0;
}

.site-page::before {
	background:
		url("''' + A + '''far-l.svg") 0 0 / auto var(--farH) repeat-x,
		linear-gradient(var(--gf), var(--gf)) 0 calc(var(--farH) - 1px) / 100% 100% no-repeat;
	height: calc(var(--farH) + 70vh);
	top: calc(100% - var(--lake) - var(--farH));
}

.site-header::before {
	background:
		url("''' + A + '''mid-l.svg") 0 0 / auto var(--midH) repeat-x,
		linear-gradient(var(--gm), var(--gm)) 0 calc(var(--midH) - 1px) / 100% 100% no-repeat;
	height: calc(var(--midH) + 70vh);
	top: calc(100% - var(--lake) - var(--midH));
}

.site-header::after {
	background:
		url("''' + A + '''near-l.svg") 0 0 / auto var(--shoreH) repeat-x,
		linear-gradient(var(--gs), var(--gs)) 0 calc(var(--shoreH) - 1px) / 100% 100% no-repeat;
	height: calc(var(--shoreH) + 70vh);
	top: calc(100% - var(--lake) - var(--shoreH));
}

html.dark .site-page::before { background-image: url("''' + A + '''far-d.svg"), linear-gradient(var(--gf), var(--gf)); }
html.dark .site-header::before { background-image: url("''' + A + '''mid-d.svg"), linear-gradient(var(--gm), var(--gm)); }
html.dark .site-header::after { background-image: url("''' + A + '''near-d.svg"), linear-gradient(var(--gs), var(--gs)); }

/* ---- the frozen lake: snow-lit ice, mirrored green, cracks and sparkle, ground haze ---- */

.site-main::before,
.site-main::after,
.site-footer::before,
.site-footer::after {
	left: 0;
	right: 0;
	top: calc(100% - var(--lake));
}

.site-main::before {
	background:
		linear-gradient(180deg, rgb(255 224 230 / 0.6) 0, rgb(255 224 230 / 0) 2vh),
		linear-gradient(180deg, #d9d2ee 0, #b4b4e0 30%, #8d92cf 66%, #6e74b8 100%);
	bottom: 0;
}

html.dark .site-main::before {
	background:
		linear-gradient(180deg, rgb(170 255 220 / 0.5) 0, rgb(170 255 220 / 0) 2vh),
		linear-gradient(180deg, #195850 0, #0f3d44 30%, #082630 64%, #04141b 100%);
}

/* the horizon curtain, mirrored and softened by the ice */
.site-main::after {
	background: url("''' + A + '''refl.webp") 0 0 / 100% 100% no-repeat;
	height: calc(var(--aw) * 0.2167);
	left: 50%;
	margin-left: calc(var(--aw) / -2);
	opacity: 0.22;
	right: auto;
	width: var(--aw);
}

.site-footer::before {
	background: url("''' + A + '''ice-l.webp") 0 0 / 100% 100% no-repeat;
	bottom: 0;
}

html.dark .site-footer::before { background-image: url("''' + A + '''ice-d.webp"); }

.site-footer::after {
	background: url("''' + A + '''mist-l.webp") 0 0 / auto 100% repeat-x;
	height: 12vh;
	margin-left: -20vw;
	right: -20vw;
	top: calc(100% - var(--lake) - 2vh);
	opacity: 0.6;
}

html.dark .site-footer::after { background-image: url("''' + A + '''mist-d.webp"); opacity: 0.7; }

/* ---- scroll maps the descent: only translate and opacity ---- */

@media (prefers-reduced-motion: no-preference) {
	@supports (animation-timeline: scroll()) {
		html:not(.reduce-motion) .site :is(.scenery-a, .scenery-b, .scenery-c),
		html:not(.reduce-motion) .site :is(.site-scenery, .site-header, .site-main, .site-footer, .site-page, .site)::before,
		html:not(.reduce-motion) .site :is(.site-header, .site-main, .site-page)::after {
			animation-fill-mode: both;
			animation-timeline: --pg;
			animation-timing-function: linear;
		}

		html:not(.reduce-motion) .site::before { animation-name: zco-sky; animation-range: 0% 100%; }
		html:not(.reduce-motion) .site .scenery-a { animation-name: zco-cor-a; animation-range: 0% 100%; }
		html:not(.reduce-motion) .site .scenery-b { animation-name: zco-cor-b; animation-range: 0% 100%; }
		html:not(.reduce-motion) .site .scenery-c { animation-name: zco-hor; animation-range: 10% 100%; }
		html:not(.reduce-motion) .site-page::before { animation-name: zco-far; animation-range: 0% 92%; }
		html:not(.reduce-motion) .site-header::before { animation-name: zco-mid; animation-range: 0% 94%; }
		html:not(.reduce-motion) .site-header::after { animation-name: zco-shore; animation-range: 6% 96%; }
		html:not(.reduce-motion) .site-main::before { animation-name: zco-lake; animation-range: 34% 100%; }
		html:not(.reduce-motion) .site-footer::before { animation-name: zco-lake; animation-range: 34% 100%; }
	}
}

@keyframes zco-sky { to { translate: 0 -46vh; } }
@keyframes zco-cor-a { 0% { opacity: 1; } 55% { opacity: 0.8; } 100% { opacity: 0.15; translate: 0 -62vh; } }
@keyframes zco-cor-b { 0% { opacity: 0.35; } 40% { opacity: 1; } 100% { opacity: 0.2; translate: 0 -70vh; } }
@keyframes zco-hor { from { opacity: 0; translate: 0 40vh; } to { opacity: 1; } }
@keyframes zco-far { from { translate: 0 46vh; } }
@keyframes zco-mid { from { translate: 0 62vh; } }
@keyframes zco-shore { from { translate: 0 90vh; } }
@keyframes zco-lake { from { translate: 0 42vh; } }
'''

def rot(name, selector, period, deg, lo, hi, seed, delay, flip=False):
    """ONE animation: rotate about the apex (few stops) + irregular opacity flares (many stops)."""
    r = random.Random(seed)
    stops = {}
    tf = [0, 100] + sorted(r.sample(range(15, 85), 2))
    for i, p in enumerate(tf and sorted(tf)):
        d = [-deg, deg * .7, -deg * .3, deg][i % 4] if p not in (0, 100) else -deg
        stops.setdefault(p, []).append(f"transform: rotate({d:.2f}deg){' scale(-1, 1)' if flip else ''}")
    n = 8
    for i in range(n + 1):
        p = 100 if i == n else (0 if i == 0 else max(1, min(99, round(i * 100 / n + r.uniform(-4, 4)))))
        v = (lo + hi) / 2 if p in (0, 100) else lo + (hi - lo) * r.random() ** .8
        stops.setdefault(p, []).append(f"opacity: {v:.2f}")
    kf = "\n".join(f"\t{p}% {{ {'; '.join(stops[p])}; }}" for p in sorted(stops))
    return f'''{selector} {{
	animation: {PF}-rot-{name} {period}s ease-in-out {-delay}s infinite;
}}
@keyframes {PF}-rot-{name} {{
{kf}
}}
'''

amb = ""
amb += rot("a1", f"{M} .scenery-a::before", 29, 1.6, .5, .85, 1, 4)
amb += rot("a2", f"{M} .scenery-a::after", 37, 2.2, .15, .42, 2, 9)
amb += rot("b1", f"{M} .scenery-b::before", 23, 1.4, .4, .8, 3, 2)
amb += rot("b2", f"{M} .scenery-b::after", 41, 2.0, .1, .35, 4, 14, flip=True)
amb += ambient1(PF, "h1", f"{M} .scenery-c::before", 19, 2.6, 5, .65, 1, seed=5, delay=6)
amb += ambient1(PF, "h2", f"{M} .scenery-c::after", 31, 3.4, 6, .3, .85, seed=6, delay=11)
amb += f'''{M} .site-scenery::before {{ animation: zco-tw-a 5s ease-in-out infinite alternate; }}
{M} .site-scenery::after {{ animation: zco-tw-b 7s ease-in-out -3s infinite alternate; }}
@keyframes zco-tw-a {{ from {{ opacity: var(--tw-lo, 0.2); }} to {{ opacity: var(--tw-hi, 0.55); }} }}
@keyframes zco-tw-b {{ from {{ opacity: calc(var(--tw-lo, 0.2) * 0.6); }} to {{ opacity: var(--tw-hi, 0.55); }} }}
{M} .site-main::after {{ animation: zco-lake linear both, zco-rf 17s ease-in-out infinite alternate; animation-range: 34% 100%, normal; animation-timeline: --pg, auto; }}
{M} .site-footer::after {{ animation: zco-lake linear both, zco-mist 47s linear infinite alternate; animation-range: 34% 100%, normal; animation-timeline: --pg, auto; }}
@keyframes zco-rf {{ 0% {{ opacity: 0.3; }} 21% {{ opacity: 0.55; }} 38% {{ opacity: 0.38; }} 60% {{ opacity: 0.6; }} 82% {{ opacity: 0.34; }} 100% {{ opacity: 0.3; }} }}
@keyframes zco-mist {{ from {{ transform: translate3d(-6vw, 0, 0); }} to {{ transform: translate3d(8vw, 0, 0); }} }}
'''

CSS = head + "\n/* ---- ambient shimmer: only where motion is welcome ---- */\n" + motion(amb)
i = CSS.index("*/") + 2
open(os.path.join(os.path.dirname(HERE), "..", ID + ".css"), "w").write(CSS[:i] + "\n\n" + PLUMB + CSS[i:])
print("written")
