from css import *
ID = "zj-aurora-descent-spruce"
PF = "zas"
M = "html:not(.reduce-motion) .site"

head = '''/*
 * Aurora Descent I: Spruce Shore. Zero JS, there is no themes/zj-aurora-descent-spruce.js.
 *   Compositor-only scrolling: every scroll-driven animation touches only translate and opacity.
 *     - sky, stars, six aurora curtains, peaks, ridge, shore and lake each slide at their own depth
 *     - colour changes by crossfading pre-coloured curtains with opacity (teal/violet group in, green group out)
 *     - nothing animated on .site, no @property, no scroll-driven colours, gradients, masks or filters
 *   Ambient shimmer: prime-period transform (sway/skew) and irregular opacity flares, per curtain (7-41s).
 *   Baked art: curtains and the lake reflection are WebP textures rendered offline from SVG (see _gen/);
 *   the ridge and its spruce are one SVG silhouette each, so a tree is part of the ground it stands on.
 * Light mode is twilight: a blue-hour sky with a pale aurora. Reduced motion shows the finished composition.
 */

.site {
	--siteBg: #f1f0f9;
	--siteFg: #1f2548;
	--siteFgStrong: #0e1236;
	--siteMuted: #4f5a82;
	--siteAccent: #3a3fb4;
	--siteSquiggle: #6f7df0;
	--siteSubtle: #dcddf0;
	--scrim: 83%;
	--tw-lo: 0.08;
	--tw-hi: 0.4;
	--lake: 36vh;
	--farH: 34vh;
	--midH: 26vh;
	--shoreH: 46vh;
	--aw: max(125vw, 170vh);
	--ah: calc(var(--aw) / 3);
	--gf: #8b86b5;
	--gm: #222c5c;
	--gs: #121843;
	--badgeBg: color-mix(in srgb, var(--siteBg) 90%, transparent);
	--badgeFg: var(--siteFgStrong);
	--badgeLine: color-mix(in srgb, var(--siteSquiggle) 70%, transparent);
	--tags: "scroll-timeline \\00b7 translate + opacity only \\00b7 prime-period shimmer \\00b7 baked rays";
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
	--gf: #1b4650;
	--gm: #030a12;
	--gs: #020509;
}

/* ---- sky: one tall gradient that pans up so the horizon glow arrives with the lake ---- */

.site::before {
	background: linear-gradient(180deg, #1b2a78 0, #3a4c9c 24%, #727dbd 46%, #c28fba 62%, #f0b3a6 71%, #b79fca 82%, #6a68a8 100%);
	height: 150vh;
	inset: var(--barHeight, 0px) 0 auto 0;
}

html.dark .site::before {
	background: linear-gradient(180deg, #01030a 0, #040c1c 22%, #07182c 44%, #0b2c3a 60%, #17504f 71%, #0b2b36 84%, #04101a 100%);
}

/* stars: two sets that twinkle out of phase; faint at twilight */
.site .site-scenery::before,
.site .site-scenery::after {
	inset: 0;
}

.site .site-scenery::before {
	background: url("zj-aurora-descent-spruce/stars-a.svg") 0 0 / 1200px 900px repeat;
	height: 130vh;
	opacity: 0.4;
}

.site .site-scenery::after {
	background: url("zj-aurora-descent-spruce/stars-b.svg") 0 0 / 1400px 900px repeat;
	height: 130vh;
	opacity: 0.35;
}

html.dark .site .site-scenery::before { opacity: 0.95; }
html.dark .site .site-scenery::after { opacity: 0.8; }

/* ---- the aurora: three groups, two curtains each. The host moves + fades with scroll; its curtains only shimmer ---- */

.site .scenery-a::before,
.site .scenery-a::after,
.site .scenery-b::before,
.site .scenery-b::after,
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

.site .scenery-a::before { background-image: url("zj-aurora-descent-spruce/aur-a.webp"); top: -4vh; }
.site .scenery-a::after { background-image: url("zj-aurora-descent-spruce/aur-b.webp"); top: -16vh; }
.site .scenery-b::before { background-image: url("zj-aurora-descent-spruce/aur-c.webp"); top: -9vh; }
.site .scenery-b::after { background-image: url("zj-aurora-descent-spruce/aur-d.webp"); top: -15vh; }
.site .scenery-c::before { background-image: url("zj-aurora-descent-spruce/aur-e.webp"); top: -2vh; }
.site .scenery-c::after { background-image: url("zj-aurora-descent-spruce/aur-f.webp"); top: -22vh; }

/* ---- the land: each silhouette is a ridge with its trees baked in, plus ground that runs well below the waterline ---- */

.site-page::before,
.site-header::before,
.site-header::after {
	left: 0;
	right: 0;
}

.site-page::before {
	background:
		url("zj-aurora-descent-spruce/ridge-far-l.svg") 0 0 / auto var(--farH) repeat-x,
		linear-gradient(var(--gf), var(--gf)) 0 calc(var(--farH) - 1px) / 100% 100% no-repeat;
	height: calc(var(--farH) + 70vh);
	top: calc(100% - var(--lake) - var(--farH));
}

.site-header::before {
	background:
		url("zj-aurora-descent-spruce/ridge-mid-l.svg") 0 0 / auto var(--midH) repeat-x,
		linear-gradient(var(--gm), var(--gm)) 0 calc(var(--midH) - 1px) / 100% 100% no-repeat;
	height: calc(var(--midH) + 70vh);
	top: calc(100% - var(--lake) - var(--midH));
}

.site-header::after {
	background:
		url("zj-aurora-descent-spruce/shore-l.svg") 0 0 / auto var(--shoreH) repeat-x,
		linear-gradient(var(--gs), var(--gs)) 0 calc(var(--shoreH) - 1px) / 100% 100% no-repeat;
	height: calc(var(--shoreH) + 70vh);
	top: calc(100% - var(--lake) - var(--shoreH));
}

html.dark .site-page::before { background-image: url("zj-aurora-descent-spruce/ridge-far-d.svg"), linear-gradient(var(--gf), var(--gf)); }
html.dark .site-header::before { background-image: url("zj-aurora-descent-spruce/ridge-mid-d.svg"), linear-gradient(var(--gm), var(--gm)); }
html.dark .site-header::after { background-image: url("zj-aurora-descent-spruce/shore-d.svg"), linear-gradient(var(--gs), var(--gs)); }

/* ---- the lake and everything mirrored in it. All of these share one scroll animation, so they move as one body ---- */

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
		linear-gradient(180deg, rgb(255 214 214 / 0.55) 0, rgb(255 214 214 / 0) 2.4vh),
		linear-gradient(180deg, #6a76b4 0, #3a4586 28%, #1d2563 62%, #131a4c 100%);
	bottom: 0;
}

html.dark .site-main::before {
	background:
		linear-gradient(180deg, rgb(130 255 205 / 0.4) 0, rgb(130 255 205 / 0) 2.4vh),
		linear-gradient(180deg, #0f3a40 0, #082229 30%, #04121a 64%, #020a10 100%);
}

/* the aurora, mirrored: same width and centring as the sky curtains so it lines up */
.site-main::after {
	background: url("zj-aurora-descent-spruce/refl.webp") 0 0 / 100% 100% no-repeat;
	height: calc(var(--aw) * 0.2167);
	left: 50%;
	margin-left: calc(var(--aw) / -2);
	right: auto;
	width: var(--aw);
	opacity: 0.8;
}

/* the ridge, mirrored */
.site-footer::before {
	background: url("zj-aurora-descent-spruce/refl-mid-l.svg") 0 0 / auto var(--midH) repeat-x;
	height: var(--midH);
	opacity: 0.55;
}

html.dark .site-footer::before { background-image: url("zj-aurora-descent-spruce/refl-mid-d.svg"); opacity: 0.7; }

/* reflected stars and glints */
.site-footer::after {
	background: url("zj-aurora-descent-spruce/stars-b.svg") 0 0 / 1400px 900px repeat;
	bottom: 0;
	opacity: 0.3;
	transform: scaleY(-1);
}

html.dark .site-footer::after { opacity: 0.55; }

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

		html:not(.reduce-motion) .site::before { animation-name: zas-sky; animation-range: 0% 100%; }
		html:not(.reduce-motion) .site .scenery-a { animation-name: zas-aur-a; animation-range: 0% 100%; }
		html:not(.reduce-motion) .site .scenery-b { animation-name: zas-aur-b; animation-range: 0% 90%; }
		html:not(.reduce-motion) .site .scenery-c { animation-name: zas-aur-c; animation-range: 0% 100%; }
		html:not(.reduce-motion) .site-page::before { animation-name: zas-far; animation-range: 0% 92%; }
		html:not(.reduce-motion) .site-header::before { animation-name: zas-mid; animation-range: 0% 94%; }
		html:not(.reduce-motion) .site-header::after { animation-name: zas-shore; animation-range: 6% 96%; }
		html:not(.reduce-motion) .site-main::before { animation-name: zas-lake; animation-range: 34% 100%; }
	}
}

@keyframes zas-sky { to { translate: 0 -46vh; } }
@keyframes zas-aur-a { 0% { opacity: 0.45; } 50% { opacity: 1; } 100% { opacity: 0.25; translate: 0 -30vh; } }
@keyframes zas-aur-b { 0% { opacity: 1; } 100% { opacity: 0.1; translate: 0 -42vh; } }
@keyframes zas-aur-c { 0% { opacity: 0.8; } 100% { opacity: 0.5; translate: 0 -24vh; } }
@keyframes zas-far { from { translate: 0 46vh; } }
@keyframes zas-mid { from { translate: 0 62vh; } }
@keyframes zas-shore { from { translate: 0 84vh; } }
@keyframes zas-lake { from { translate: 0 42vh; } }
'''

amb = ""
# curtains: (selector, name, sway_s, dx, skew, pulse_s, lo, hi, seed, delay)
cur = [
 (".scenery-a::before", "a1", 29, 3.0, 4, 11, .55, 1, 1, 4),
 (".scenery-a::after", "a2", 23, 4.0, 5, 13, .4, .95, 2, 9),
 (".scenery-b::before", "b1", 19, 2.6, 5, 7, .68, 1, 3, 2),
 (".scenery-b::after", "b2", 31, 3.4, 6, 17, .35, .9, 4, 14),
 (".scenery-c::before", "c1", 37, 2.2, 3, 19, .6, 1, 5, 6),
 (".scenery-c::after", "c2", 41, 3.8, 7, 23, .3, .8, 6, 11),
]
for sel, n, sw, dx, sk, pl, lo, hi, seed, dl in cur:
    amb += ambient1(PF, n, f"{M} {sel}", pl*2+1 if False else {"a1":29,"a2":23,"b1":19,"b2":31,"c1":37,"c2":41}[n], dx, sk, lo, hi, seed=seed, delay=dl)
# stars twinkle
amb += f'''{M} .site-scenery::before {{ animation: zas-tw-a 5s ease-in-out infinite alternate; }}
{M} .site-scenery::after {{ animation: zas-tw-b 7s ease-in-out -3s infinite alternate; }}
@keyframes zas-tw-a {{ from {{ opacity: var(--tw-lo, 0.2); }} to {{ opacity: var(--tw-hi, 0.55); }} }}
@keyframes zas-tw-b {{ from {{ opacity: calc(var(--tw-lo, 0.2) * 0.6); }} to {{ opacity: var(--tw-hi, 0.55); }} }}
'''
# lake: reflection shimmer (transform + opacity), prime periods
amb += f'''{M} .site-main::after {{ animation: zas-lake linear both, zas-rf-sw 17s ease-in-out infinite alternate, zas-rf-pl 11s ease-in-out infinite; animation-range: 34% 100%, normal, normal; animation-timeline: --pg, auto, auto; transform-origin: 50% 0; }}
{M} .site-footer::before {{ animation: zas-lake linear both, zas-rm-sw 13s ease-in-out infinite alternate; animation-range: 34% 100%, normal; animation-timeline: --pg, auto; }}
{M} .site-footer::after {{ animation: zas-lake linear both, zas-gl 7s ease-in-out infinite alternate; animation-range: 34% 100%, normal; animation-timeline: --pg, auto; }}
@keyframes zas-rf-sw {{ from {{ transform: translate3d(-1.4vw, 0, 0) scaleY(0.97); }} to {{ transform: translate3d(1.8vw, 0, 0) scaleY(1.04); }} }}
@keyframes zas-rf-pl {{ 0% {{ opacity: 0.62; }} 21% {{ opacity: 0.92; }} 38% {{ opacity: 0.7; }} 60% {{ opacity: 1; }} 82% {{ opacity: 0.66; }} 100% {{ opacity: 0.62; }} }}
@keyframes zas-rm-sw {{ from {{ transform: translate3d(-0.5vw, 0, 0); }} to {{ transform: translate3d(0.6vw, 0, 0); }} }}
@keyframes zas-gl {{ from {{ opacity: 0.15; }} to {{ opacity: 0.6; }} }}
'''

CSS = head + "\n/* ---- ambient shimmer: only where motion is welcome ---- */\n" + motion(amb)
CSS = CSS.replace("--tw-lo", "--tw-lo")
i = CSS.index("*/") + 2
open(f"/Users/josh/repos/dot-com-theme-gallery/themes/{ID}.css", "w").write(CSS[:i] + "\n\n" + PLUMB.replace("{id}", ID).replace("PFX", PF) + CSS[i:])
print("written")
