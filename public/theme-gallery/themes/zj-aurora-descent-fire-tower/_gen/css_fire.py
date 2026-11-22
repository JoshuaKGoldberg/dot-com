from css import *
ID = "zj-aurora-descent-fire-tower"
PF = "zaf"
M = "html:not(.reduce-motion) .site"

head = '''/*
 * Aurora Descent III: Fire Tower. Zero JS, there is no themes/zj-aurora-descent-fire-tower.js.
 *   Aurora ribbons over the High Peaks. A fire tower is baked onto a bald summit that climbs past as you scroll
 *   (it rises from below, crosses the screen and leaves), then a treeline, then a frozen-still lake of stars and aurora.
 *   Compositor-only scrolling: every scroll-driven animation touches only translate and opacity.
 *     - sky, stars, five aurora curtains, range, summit, treeline and lake each slide at their own depth
 *     - colour changes by crossfading pre-coloured curtains with opacity
 *   Ambient shimmer: prime-period transform (sway/skew) and irregular opacity flares, ONE animation per curtain (19-37s).
 *   Baked art: curtains and the lake reflection are WebP rendered offline from SVG (see _gen/); the summit, tower and
 *   krummholz are one SVG, and every tree stands on the ground of its own tile, so nothing floats.
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
	--lake: 30vh;
	--farH: 40vh;
	--midH: 74vh;
	--shoreH: 46vh;
	--aw: max(125vw, 170vh);
	--ah: calc(var(--aw) / 3);
	--gf: #8b86b5;
	--gm: #1c2458;
	--gs: #141a48;
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
	--gm: #0a202b;
	--gs: #01040a;
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
	background: url("zj-aurora-descent-fire-tower/stars-a.svg") 0 0 / 1200px 900px repeat;
	height: 130vh;
	opacity: 0.4;
}

.site .site-scenery::after {
	background: url("zj-aurora-descent-fire-tower/stars-b.svg") 0 0 / 1400px 900px repeat;
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

.site .scenery-a::before { background-image: url("zj-aurora-descent-fire-tower/aur-a.webp"); top: -4vh; }
.site .scenery-a::after { background-image: url("zj-aurora-descent-fire-tower/aur-b.webp"); top: -16vh; }
.site .scenery-b::before { background-image: url("zj-aurora-descent-fire-tower/aur-c.webp"); top: -9vh; }
.site .scenery-b::after { background-image: url("zj-aurora-descent-fire-tower/aur-d.webp"); top: -15vh; }
.site .scenery-c::before { background-image: url("zj-aurora-descent-fire-tower/aur-e.webp"); top: -2vh; }

/* ---- the land: each silhouette is a ridge with its trees baked in, plus ground that runs well below the waterline ---- */

.site-page::before,
.site-header::before,
.site-header::after {
	left: 0;
	right: 0;
}

.site-page::before {
	background:
		url("zj-aurora-descent-fire-tower/peaks-l.svg") 0 0 / auto var(--farH) repeat-x,
		linear-gradient(var(--gf), var(--gf)) 0 calc(var(--farH) - 1px) / 100% 100% no-repeat;
	height: calc(var(--farH) + 70vh);
	top: calc(100% - var(--lake) - var(--farH));
}

.site-header::before {
	background:
		url("zj-aurora-descent-fire-tower/summit-l.svg") 100% 0 / auto var(--midH) repeat-x,
		linear-gradient(var(--gm), var(--gm)) 0 calc(var(--midH) - 1px) / 100% 100% no-repeat;
	height: calc(var(--midH) + 70vh);
	top: calc(100% - var(--lake) - var(--midH));
}

.site-header::after {
	background:
		url("zj-aurora-descent-fire-tower/trees-l.svg") 0 0 / auto var(--shoreH) repeat-x,
		linear-gradient(var(--gs), var(--gs)) 0 calc(var(--shoreH) - 1px) / 100% 100% no-repeat;
	height: calc(var(--shoreH) + 70vh);
	top: calc(100% - var(--lake) - var(--shoreH));
}

html.dark .site-page::before { background-image: url("zj-aurora-descent-fire-tower/peaks-d.svg"), linear-gradient(var(--gf), var(--gf)); }
html.dark .site-header::before { background-image: url("zj-aurora-descent-fire-tower/summit-d.svg"), linear-gradient(var(--gm), var(--gm)); }
html.dark .site-header::after { background-image: url("zj-aurora-descent-fire-tower/trees-d.svg"), linear-gradient(var(--gs), var(--gs)); }

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
	background: url("zj-aurora-descent-fire-tower/refl.webp") 0 0 / 100% 100% no-repeat;
	height: calc(var(--aw) * 0.2167);
	left: 50%;
	margin-left: calc(var(--aw) / -2);
	right: auto;
	width: var(--aw);
	opacity: 0.8;
}

/* the ridge, mirrored */
.site-footer::before {
	background: url("zj-aurora-descent-fire-tower/refl-trees-l.svg") 0 0 / auto var(--shoreH) repeat-x;
	height: var(--shoreH);
	opacity: 0.55;
}

html.dark .site-footer::before { background-image: url("zj-aurora-descent-fire-tower/refl-trees-d.svg"); opacity: 0.7; }

/* reflected stars and glints */
.site-footer::after {
	background: url("zj-aurora-descent-fire-tower/stars-b.svg") 0 0 / 1400px 900px repeat;
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

		html:not(.reduce-motion) .site::before { animation-name: zaf-sky; animation-range: 0% 100%; }
		html:not(.reduce-motion) .site .scenery-a { animation-name: zaf-aur-a; animation-range: 0% 100%; }
		html:not(.reduce-motion) .site .scenery-b { animation-name: zaf-aur-b; animation-range: 0% 90%; }
		html:not(.reduce-motion) .site .scenery-c { animation-name: zaf-aur-c; animation-range: 0% 100%; }
		html:not(.reduce-motion) .site-page::before { animation-name: zaf-far; animation-range: 0% 92%; }
		html:not(.reduce-motion) .site-header::before { animation-name: zaf-mid; animation-range: 0% 100%; }
		html:not(.reduce-motion) .site-header::after { animation-name: zaf-shore; animation-range: 6% 96%; }
		html:not(.reduce-motion) .site-main::before { animation-name: zaf-lake; animation-range: 34% 100%; }
		html:not(.reduce-motion) .site-footer::before { animation-name: zaf-lake; animation-range: 34% 100%; }
		html:not(.reduce-motion) .site-footer::after { animation: zaf-lake linear both; animation-timeline: --pg; animation-range: 34% 100%; }
	}
}

@keyframes zaf-sky { to { translate: 0 -46vh; } }
@keyframes zaf-aur-a { 0% { opacity: 0.45; } 50% { opacity: 1; } 100% { opacity: 0.5; translate: 0 -22vh; } }
@keyframes zaf-aur-b { 0% { opacity: 1; } 100% { opacity: 0.4; translate: 0 -30vh; } }
@keyframes zaf-aur-c { 0% { opacity: 0.8; } 100% { opacity: 0.85; translate: 0 -16vh; } }
@keyframes zaf-far { from { translate: 0 46vh; } }
@keyframes zaf-mid { from { translate: 0 100vh; } to { translate: 0 -22vh; } }
@keyframes zaf-shore { from { translate: 0 84vh; } }
@keyframes zaf-lake { from { translate: 0 42vh; } }
'''

amb = ""
# curtains: (selector, name, sway_s, dx, skew, pulse_s, lo, hi, seed, delay)
cur = [
 (".scenery-a::before", "a1", 29, 3.0, 4, 11, .55, 1, 1, 4),
 (".scenery-a::after", "a2", 23, 4.0, 5, 13, .4, .95, 2, 9),
 (".scenery-b::before", "b1", 19, 2.6, 5, 7, .68, 1, 3, 2),
 (".scenery-b::after", "b2", 31, 3.4, 6, 17, .35, .9, 4, 14),
 (".scenery-c::before", "c1", 37, 2.2, 3, 19, .6, 1, 5, 6),
]
for sel, n, sw, dx, sk, pl, lo, hi, seed, dl in cur:
    amb += ambient1(PF, n, f"{M} {sel}", pl*2+1 if False else {"a1":29,"a2":23,"b1":19,"b2":31,"c1":37}[n], dx, sk, lo, hi, seed=seed, delay=dl)
# stars twinkle
amb += f'''{M} .site-scenery::before {{ animation: zaf-tw-a 5s ease-in-out infinite alternate; }}
{M} .site-scenery::after {{ animation: zaf-tw-b 7s ease-in-out -3s infinite alternate; }}
@keyframes zaf-tw-a {{ from {{ opacity: var(--tw-lo, 0.2); }} to {{ opacity: var(--tw-hi, 0.55); }} }}
@keyframes zaf-tw-b {{ from {{ opacity: calc(var(--tw-lo, 0.2) * 0.6); }} to {{ opacity: var(--tw-hi, 0.55); }} }}
'''
# lake: reflection shimmer (transform + opacity), prime periods
amb += f'''{M} .site-main::after {{ animation: zaf-lake linear both, zaf-rf-sw 17s ease-in-out infinite alternate, zaf-rf-pl 11s ease-in-out infinite; animation-range: 34% 100%, normal, normal; animation-timeline: --pg, auto, auto; transform-origin: 50% 0; }}
@keyframes zaf-rf-sw {{ from {{ transform: translate3d(-1.4vw, 0, 0) scaleY(0.97); }} to {{ transform: translate3d(1.8vw, 0, 0) scaleY(1.04); }} }}
@keyframes zaf-rf-pl {{ 0% {{ opacity: 0.62; }} 21% {{ opacity: 0.92; }} 38% {{ opacity: 0.7; }} 60% {{ opacity: 1; }} 82% {{ opacity: 0.66; }} 100% {{ opacity: 0.62; }} }}
@keyframes zaf-rm-sw {{ from {{ transform: translate3d(-0.5vw, 0, 0); }} to {{ transform: translate3d(0.6vw, 0, 0); }} }}
@keyframes zaf-gl {{ from {{ opacity: 0.15; }} to {{ opacity: 0.6; }} }}
'''

CSS = head + "\n/* ---- ambient shimmer: only where motion is welcome ---- */\n" + motion(amb)
CSS = CSS.replace("--tw-lo", "--tw-lo")
i = CSS.index("*/") + 2
open(f"/Users/josh/repos/dot-com-theme-gallery/themes/{ID}.css", "w").write(CSS[:i] + "\n\n" + PLUMB.replace("{id}", ID).replace("PFX", PF) + CSS[i:])
print("written")
