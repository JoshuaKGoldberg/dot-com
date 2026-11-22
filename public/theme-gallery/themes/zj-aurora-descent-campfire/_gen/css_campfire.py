from css import *
ID = "zj-aurora-descent-campfire"; D = ID + "/"; PF = "zcf"
M = "html:not(.reduce-motion) .site"
head = '''/*
 * Aurora Descent V: Campfire Under the Aurora. Zero JS, there is no themes/zj-aurora-descent-campfire.js.
 *   Compositor-only: every animation touches only translate, transform and opacity.
 *   Aurora: six baked-ray curtains that PULSE (irregular prime-period opacity flares, one Animation each).
 *   Land: far ridge, spruce ridge, and a shore layer that carries the lean-to, canoe and fire pit in the SAME element
 *         as its ground, so they stay grounded; ground runs well below the waterline.
 *   Fire: a pre-drawn flame sprite (transform + opacity flicker), a spark column (a tall sprite sliding up one tile, looped),
 *         a warm glow and the fire's reflection. All of them ride the shore's scroll translate.
 * Light mode is twilight; dark is night. Reduced motion shows the still composition.
 */

.site {
	--siteBg: #f1f0f9; --siteFg: #1f2548; --siteFgStrong: #0e1236; --siteMuted: #4f5a82; --siteAccent: #3a3fb4;
	--siteSquiggle: #6f7df0; --siteSubtle: #dcddf0; --scrim: 83%;
	--tw-lo: 0.08; --tw-hi: 0.4;
	--lake: 36vh; --farH: 34vh; --midH: 26vh; --shoreH: 46vh;
	--aw: max(125vw, 170vh); --ah: calc(var(--aw) / 3);
	--gf: #8b86b5; --gm: #222c5c; --gs: #1a2250;
	--campW: calc(var(--shoreH) * 2);
	--Fh: calc(var(--campW) * 0.3);
	--fxr: calc(4vw + var(--campW) * 0.28125);
	--pit: calc(var(--lake) + var(--campW) * 0.03875);
	--T: 46vh;
	--glowA: 0.3;
	--badgeBg: color-mix(in srgb, var(--siteBg) 90%, transparent);
	--badgeFg: var(--siteFgStrong);
	--badgeLine: color-mix(in srgb, var(--siteSquiggle) 70%, transparent);
	--tags: "scroll-timeline \\00b7 translate + opacity only \\00b7 sprite flame + sparks \\00b7 baked rays";
}
html.dark .site {
	--siteBg: #050a14; --siteFg: #d4e2ee; --siteFgStrong: #f3faff; --siteMuted: #8fa6bf; --siteAccent: #ffb36b;
	--siteSquiggle: #ff9a3c; --siteSubtle: #0d1d30; --scrim: 80%;
	--tw-lo: 0.4; --tw-hi: 0.95; --gf: #1d4d57; --gm: #030a12; --gs: #030912; --glowA: 0.4;
}

.site-page { padding-bottom: 60vh; }

@media (max-aspect-ratio: 4/5) {
	.site { --campW: 150vw; }
}

.site::before {
	background: linear-gradient(180deg, #1b2a78 0, #3a4c9c 24%, #727dbd 46%, #c28fba 62%, #f0b3a6 71%, #b79fca 82%, #6a68a8 100%);
	height: 150vh; inset: var(--barHeight, 0px) 0 auto 0;
}
html.dark .site::before { background: linear-gradient(180deg, #01030a 0, #040c1c 22%, #07182c 44%, #0b2c3a 60%, #17504f 71%, #0b2b36 84%, #04101a 100%); }

.site .site-scenery::before { background: url("@D@stars.svg") 0 0 / 1200px 900px repeat; height: 130vh; inset: 0; opacity: 0.4; }
html.dark .site .site-scenery::before { opacity: 0.95; }

.site .scenery-a::before, .site .scenery-a::after, .site .scenery-b::before, .site .scenery-b::after, .site .scenery-c::before, .site .scenery-c::after {
	background-position: 0 0; background-repeat: no-repeat; background-size: 100% 100%;
	height: var(--ah); left: 50%; margin-left: calc(var(--aw) / -2); width: var(--aw);
}
.site .scenery-a::before { background-image: url("@D@aur-a.webp"); top: -4vh; }
.site .scenery-a::after { background-image: url("@D@aur-b.webp"); top: -16vh; }
.site .scenery-b::before { background-image: url("@D@aur-c.webp"); top: -9vh; }
.site .scenery-b::after { background-image: url("@D@aur-d.webp"); top: -15vh; }
.site .scenery-c::before { background-image: url("@D@aur-e.webp"); top: -2vh; }
.site .scenery-c::after { background-image: url("@D@aur-f.webp"); top: -22vh; }

/* ---- the land. Each silhouette carries its own ground ---- */
.site .site-scenery::after, .site-page::before, .site-header::before, .site-header::after { left: 0; right: 0; }
.site .site-scenery::after { background: url("@D@ridge-far-l.svg") 0 0 / auto var(--farH) repeat-x, linear-gradient(var(--gf), var(--gf)) 0 calc(var(--farH) - 1px) / 100% 100% no-repeat; height: calc(var(--farH) + 70vh); top: calc(100% - var(--lake) - var(--farH)); inset: auto; left: 0; right: 0; }
.site-page::before { background: url("@D@ridge-mid-l.svg") 0 0 / auto var(--midH) repeat-x, linear-gradient(var(--gm), var(--gm)) 0 calc(var(--midH) - 1px) / 100% 100% no-repeat; height: calc(var(--midH) + 70vh); top: calc(100% - var(--lake) - var(--midH)); }
/* shore: camp (lean-to, canoe, fire pit) over the spruce tile over ground, ONE layer */
.site-header::before {
	background:
		url("@D@camp-l.svg") right 4vw top calc(var(--shoreH) - var(--campW) / 2) / var(--campW) calc(var(--campW) / 2) no-repeat,
		url("@D@shore-l.svg") 0 0 / auto var(--shoreH) repeat-x,
		linear-gradient(var(--gs), var(--gs)) 0 calc(var(--shoreH) - 1px) / 100% 100% no-repeat;
	height: calc(var(--shoreH) + 70vh); top: calc(100% - var(--lake) - var(--shoreH));
}
html.dark .site .site-scenery::after { background-image: url("@D@ridge-far-d.svg"), linear-gradient(var(--gf), var(--gf)); }
html.dark .site-page::before { background-image: url("@D@ridge-mid-d.svg"), linear-gradient(var(--gm), var(--gm)); }
html.dark .site-header::before { background-image: url("@D@camp-d.svg"), url("@D@shore-d.svg"), linear-gradient(var(--gs), var(--gs)); }

/* sparks: a tall sprite that slides up exactly one tile and loops. The dead zone at each tile's top covers the beach under the fire */
.site-header::after {
	background: url("@D@sparks.svg") 0 0 / 100% 50% repeat-y;
	bottom: calc(var(--pit) - var(--T)); height: calc(var(--T) * 2);
	left: auto; right: calc(var(--fxr) - var(--T) * 0.35); width: calc(var(--T) * 0.7); top: auto;
}

/* flame sprite, in front of everything on the shore */
.site-page::after {
	background: url("@D@flame.webp") 0 0 / 100% 100% no-repeat;
	bottom: calc(var(--pit) - var(--Fh) * 0.111); height: var(--Fh); width: calc(var(--Fh) * 0.6667);
	left: auto; right: calc(var(--fxr) - var(--Fh) * 0.3333); top: auto; transform-origin: 50% 89%;
}
/* warm light cast on the scene: static radial gradient, only its opacity flickers */
.site::after {
	background: radial-gradient(circle, rgb(255 150 60 / var(--glowA)) 0, rgb(255 110 40 / calc(var(--glowA) * 0.35)) 38%, transparent 68%);
	bottom: calc(var(--pit) - 35vh); height: 70vh; width: 70vh; left: auto; top: auto; right: calc(var(--fxr) - 35vh);
}

/* ---- lake ---- */
.site-main::before, .site-main::after, .site-footer::before, .site-footer::after { left: 0; right: 0; top: calc(100% - var(--lake)); }
.site-main::before {
	background: linear-gradient(180deg, rgb(255 214 214 / 0.55) 0, rgb(255 214 214 / 0) 2.4vh), linear-gradient(180deg, #6a76b4 0, #3a4586 28%, #1d2563 62%, #131a4c 100%);
	bottom: 0;
}
html.dark .site-main::before { background: linear-gradient(180deg, rgb(255 170 90 / 0.35) 0, rgb(255 170 90 / 0) 2.4vh), linear-gradient(180deg, #0f3a40 0, #082229 30%, #04121a 64%, #020a10 100%); }
.site-main::after { background: url("@D@refl.webp") 0 0 / 100% 100% no-repeat; height: calc(var(--aw) * 0.2167); left: 50%; margin-left: calc(var(--aw) / -2); right: auto; width: var(--aw); opacity: 0.8; }
.site-footer::before { background: url("@D@refl-mid-l.webp") 0 0 / auto var(--midH) repeat-x; height: var(--midH); opacity: 0.55; }
html.dark .site-footer::before { background-image: url("@D@refl-mid-d.webp"); opacity: 0.7; }
/* the fire, mirrored in the lake */
.site-footer::after {
	background: url("@D@fire-refl.webp") 0 0 / 100% 100% no-repeat;
	height: 30vh; width: 18.5vh; left: auto; top: calc(100% - var(--lake) + 1.2vh); right: calc(var(--fxr) - 9.25vh);
	transform-origin: 50% 0;
}

@media (prefers-reduced-motion: no-preference) {
	@supports (animation-timeline: scroll()) {
		html:not(.reduce-motion) .site :is(.scenery-a, .scenery-b, .scenery-c),
		html:not(.reduce-motion) .site :is(.site-scenery, .site-header, .site-main, .site-footer, .site-page, .site)::before,
		html:not(.reduce-motion) .site :is(.site-scenery, .site-header, .site-main, .site-footer, .site-page, .site)::after {
			animation-fill-mode: both; animation-timeline: --pg; animation-timing-function: linear;
		}
		html:not(.reduce-motion) .site::before { animation-name: zcf-sky; animation-range: 0% 100%; }
		html:not(.reduce-motion) .site .scenery-a { animation-name: zcf-aur-a; animation-range: 0% 100%; }
		html:not(.reduce-motion) .site .scenery-b { animation-name: zcf-aur-b; animation-range: 0% 90%; }
		html:not(.reduce-motion) .site .scenery-c { animation-name: zcf-aur-c; animation-range: 0% 100%; }
		html:not(.reduce-motion) .site .site-scenery::after { animation-name: zcf-far; animation-range: 0% 92%; }
		html:not(.reduce-motion) .site-page::before { animation-name: zcf-mid; animation-range: 0% 94%; }
		html:not(.reduce-motion) .site-header::before { animation-name: zcf-shore; animation-range: 34% 100%; }
		html:not(.reduce-motion) .site-main::before,
		html:not(.reduce-motion) .site-main::after,
		html:not(.reduce-motion) .site-footer::before { animation-name: zcf-lake; animation-range: 34% 100%; }
	}
}
@keyframes zcf-sky { to { translate: 0 -46vh; } }
@keyframes zcf-aur-a { 0% { opacity: 0.45; } 50% { opacity: 1; } 100% { opacity: 0.25; translate: 0 -30vh; } }
@keyframes zcf-aur-b { 0% { opacity: 1; } 100% { opacity: 0.1; translate: 0 -42vh; } }
@keyframes zcf-aur-c { 0% { opacity: 0.8; } 100% { opacity: 0.5; translate: 0 -24vh; } }
@keyframes zcf-far { from { translate: 0 46vh; } }
@keyframes zcf-mid { from { translate: 0 62vh; } }
@keyframes zcf-shore { from { translate: 0 92vh; } }
@keyframes zcf-lake { from { translate: 0 92vh; } }
'''.replace("@D@", D)

amb = ""
for sel, n, per, dx, sk, lo, hi, seed, dl in [
 (".scenery-a::before","a1",13,3.0,4,.2,1,11,4),(".scenery-a::after","a2",17,4.0,5,.15,.95,12,9),
 (".scenery-b::before","b1",11,2.6,5,.3,1,13,2),(".scenery-b::after","b2",19,3.4,6,.12,.9,14,14),
 (".scenery-c::before","c1",23,2.2,3,.25,1,15,6),(".scenery-c::after","c2",29,3.8,7,.1,.8,16,11)]:
    amb += ambient1(PF, n, f"{M} {sel}", per, dx, sk, lo, hi, seed=seed, delay=dl, n_op=11)
SH = "animation-range: 34% 100%, normal; animation-timeline: --pg, auto;"
amb += f'''{M} .site-scenery::before {{ animation: zcf-tw 5s ease-in-out infinite alternate; }}
@keyframes zcf-tw {{ from {{ opacity: var(--tw-lo); }} to {{ opacity: var(--tw-hi); }} }}
/* fire: each layer = scroll translate (same as the shore) + one looping flicker */
{M} .site-page::after {{ animation: zcf-shore linear both, zcf-flame 1.9s ease-in-out infinite; {SH} }}
{M} .site-header::after {{ animation: zcf-shore linear both, zcf-spark 5.3s linear infinite; {SH} }}
{M} .site::after {{ animation: zcf-shore linear both, zcf-glow 2.3s ease-in-out infinite; {SH} }}
{M} .site-footer::after {{ animation: zcf-lake linear both, zcf-rfl 2.7s ease-in-out infinite; animation-range: 34% 100%, normal; animation-timeline: --pg, auto; }}
@keyframes zcf-flame {{
	0% {{ transform: scale(1, 1) skewX(0deg); opacity: 0.95; }}
	14% {{ transform: scale(0.96, 1.07) skewX(2.5deg); opacity: 1; }}
	31% {{ transform: scale(1.03, 0.94) skewX(-2deg); opacity: 0.88; }}
	47% {{ transform: scale(0.98, 1.1) skewX(-3.5deg); opacity: 1; }}
	63% {{ transform: scale(1.04, 0.97) skewX(1.5deg); opacity: 0.92; }}
	80% {{ transform: scale(0.95, 1.05) skewX(3deg); opacity: 0.97; }}
	100% {{ transform: scale(1, 1) skewX(0deg); opacity: 0.95; }}
}}
@keyframes zcf-spark {{
	0% {{ transform: translate3d(0, 0, 0); }}
	25% {{ transform: translate3d(1.4vh, -12.5%, 0); }}
	50% {{ transform: translate3d(-1.1vh, -25%, 0); }}
	75% {{ transform: translate3d(1vh, -37.5%, 0); }}
	100% {{ transform: translate3d(0, -50%, 0); }}
}}
@keyframes zcf-glow {{ 0% {{ opacity: 0.85; }} 17% {{ opacity: 1; }} 34% {{ opacity: 0.72; }} 52% {{ opacity: 0.95; }} 71% {{ opacity: 0.78; }} 100% {{ opacity: 0.85; }} }}
@keyframes zcf-rfl {{ 0% {{ transform: scale(1, 1); opacity: 0.75; }} 20% {{ transform: scale(1.06, 1.05); opacity: 1; }} 45% {{ transform: scale(0.95, 0.96); opacity: 0.65; }} 70% {{ transform: scale(1.04, 1.02); opacity: 0.95; }} 100% {{ transform: scale(1, 1); opacity: 0.75; }} }}
'''
CSS = head + "\n/* ---- ambient motion: only where motion is welcome ---- */\n" + motion(amb)
i = CSS.index("*/") + 2
open(f"../../{ID}.css", "w").write(CSS[:i] + "\n\n" + PLUMB + CSS[i:])
