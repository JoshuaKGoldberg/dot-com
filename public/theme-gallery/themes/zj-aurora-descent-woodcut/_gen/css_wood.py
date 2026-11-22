from css import *
ID = "zj-aurora-descent-woodcut"
D = ID + "/"
PF = "zaw"
M = "html:not(.reduce-motion) .site"

def modal(sel, prop_d, prop_l):
    pass

head = '''@import url("https://fonts.googleapis.com/css2?family=Bevan&family=League+Spartan:wght@300..800&display=swap");
/*
 * Aurora Descent IV: Woodcut Aurora. Zero JS, there is no themes/zj-aurora-descent-woodcut.js.
 * The aurora as a carved linocut: flat inks only (paper, ink, blue, aurora green, one violet/rose accent).
 *   Compositor-only scrolling: every scroll-driven animation touches only translate and opacity.
 *   Baked art: banded ray curtains, hatched spruce and the ripple-stroke reflections are flat-ink WebP/SVG made offline (see _gen/).
 *   Trees live in the same SVG as their ground; ground runs well below the waterline.
 *   Ambient shimmer is stepped (steps()), one Animation per layer, like successive print passes.
 * Light mode is twilight on lavender stock. Reduced motion shows the finished print.
 */

.site {
	--paper: #ece4d4;
	--ink: #1d2050;
	--siteBg: #efe8da;
	--siteFg: #22254f;
	--siteFgStrong: #12154a;
	--siteMuted: #4d5280;
	--siteAccent: #a02a73;
	--siteSquiggle: #d94f9a;
	--siteSubtle: #e0d6e6;
	--siteFontDisplay: "Bevan", Georgia, serif;
	--scrim: 94%;
	--tw-lo: 0.35;
	--tw-hi: 0.9;
	--lake: 36vh;
	--farH: 34vh;
	--midH: 26vh;
	--shoreH: 46vh;
	--aw: max(125vw, 170vh);
	--ah: calc(var(--aw) / 3);
	--gf: #8a92d0;
	--gm: #5f6bb0;
	--gs: #4a54a0;
	--badgeBg: var(--siteBg);
	--badgeFg: var(--siteFgStrong);
	--badgeLine: var(--siteFgStrong);
	--shadow: #1d2050;
	--tags: "linocut \\00b7 flat inks baked to WebP \\00b7 steps() \\00b7 translate + opacity only";
}

html.dark .site {
	--paper: #0b1433;
	--ink: #03060d;
	--siteBg: #0d1636;
	--siteFg: #d6e4f0;
	--siteFgStrong: #f1fbff;
	--siteMuted: #93a9c4;
	--siteAccent: #6df5b8;
	--siteSquiggle: #46e8a8;
	--siteSubtle: #14214a;
	--scrim: 93%;
	--gf: #1f4c66;
	--gm: #164055;
	--gs: #0f3345;
	--shadow: #1d3a78;
}

.site-logo, .site-title, .site-section-title { font-family: var(--siteFontDisplay); letter-spacing: 0.01em; }
.site-title { line-height: 1; }
.site-nav-link { font-family: var(--siteFontDisplay); font-size: 1.1rem; }

/* sections are printed labels: ink rule + hard offset shadow */
.site-header, .site-hero, .site-about, .site-section, .site-footer {
	border: 2.5px solid var(--siteFgStrong);
	border-radius: 3px;
	box-shadow: 6px 6px 0 var(--shadow);
}
html.dark .site-header, html.dark .site-hero, html.dark .site-about, html.dark .site-section, html.dark .site-footer { border-color: var(--siteFg); }
.site-portrait img { border: 3px solid var(--siteFgStrong); border-radius: 50%; box-shadow: 4px 4px 0 var(--siteSquiggle); }

/* ---- sky: stepped ink bands, carved line-work thick at the zenith, fine at the horizon ---- */
.site::before {
	background:
		repeating-linear-gradient(180deg, var(--l1) 0 7px, transparent 7px 28px) 0 0 / 100% 36% no-repeat,
		repeating-linear-gradient(180deg, var(--l1) 0 5px, transparent 5px 18px) 0 36% / 100% 28% no-repeat,
		repeating-linear-gradient(180deg, var(--l1) 0 3px, transparent 3px 12px) 0 64% / 100% 22% no-repeat,
		repeating-linear-gradient(180deg, var(--l2) 0 2px, transparent 2px 8px) 0 86% / 100% 14% no-repeat,
		linear-gradient(180deg, var(--s1) 0 36%, var(--s2) 36% 64%, var(--s3) 64% 80%, var(--s4) 80% 92%, var(--s5) 92%);
	height: 150vh;
	inset: var(--barHeight, 0px) 0 auto 0;
}
.site { --l1: #8d98d6; --l2: #e9b0c4; --s1: #a9b0e2; --s2: #c3b9e6; --s3: #e5c3d6; --s4: #f4d6c4; --s5: #e9c9d6; }
html.dark .site { --l1: #10265a; --l2: #1f6a70; --s1: #060c22; --s2: #091433; --s3: #0c2144; --s4: #0f3248; --s5: #0b2236; }

.site .site-scenery::before, .site .site-scenery::after { inset: 0; height: 130vh; }
.site .site-scenery::before { background: url("@D@stars-a-l.svg") 0 0 / 1200px 900px repeat; opacity: 0.55; }
.site .site-scenery::after { background: url("@D@stars-b-l.svg") 0 0 / 1400px 900px repeat; opacity: 0.4; }
html.dark .site .site-scenery::before { background-image: url("@D@stars-a-d.svg"); opacity: 0.95; }
html.dark .site .site-scenery::after { background-image: url("@D@stars-b-d.svg"); opacity: 0.8; }

/* ---- curtains ---- */
.site .scenery-a::before, .site .scenery-a::after, .site .scenery-b::before, .site .scenery-b::after, .site .scenery-c::before, .site .scenery-c::after {
	background-position: 0 0; background-repeat: no-repeat; background-size: 100% 100%;
	height: var(--ah); left: 50%; margin-left: calc(var(--aw) / -2); width: var(--aw);
}
@AUR@

/* ---- the land ---- */
.site-page::before, .site-header::before, .site-header::after { left: 0; right: 0; }
.site-page::before { background: url("@D@ridge-far-l.svg") 0 0 / auto var(--farH) repeat-x, linear-gradient(var(--gf), var(--gf)) 0 calc(var(--farH) - 1px) / 100% 100% no-repeat; height: calc(var(--farH) + 70vh); top: calc(100% - var(--lake) - var(--farH)); }
.site-header::before { background: url("@D@ridge-mid-l.svg") 0 0 / auto var(--midH) repeat-x, linear-gradient(var(--gm), var(--gm)) 0 calc(var(--midH) - 1px) / 100% 100% no-repeat; height: calc(var(--midH) + 70vh); top: calc(100% - var(--lake) - var(--midH)); }
.site-header::after { background: url("@D@shore-l.svg") 0 0 / auto var(--shoreH) repeat-x, linear-gradient(var(--gs), var(--gs)) 0 calc(var(--shoreH) - 1px) / 100% 100% no-repeat; height: calc(var(--shoreH) + 70vh); top: calc(100% - var(--lake) - var(--shoreH)); }
html.dark .site-page::before { background-image: url("@D@ridge-far-d.svg"), linear-gradient(var(--gf), var(--gf)); }
html.dark .site-header::before { background-image: url("@D@ridge-mid-d.svg"), linear-gradient(var(--gm), var(--gm)); }
html.dark .site-header::after { background-image: url("@D@shore-d.svg"), linear-gradient(var(--gs), var(--gs)); }

/* ---- lake: carved water lines, the reflected bands, ripple strokes ---- */
.site-main::before, .site-main::after, .site-footer::before, .site-footer::after { left: 0; right: 0; top: calc(100% - var(--lake)); }
.site-main::before {
	background:
		linear-gradient(180deg, var(--ripple) 0 4px, transparent 4px),
		repeating-linear-gradient(180deg, var(--wl) 0 2px, transparent 2px 7px) 0 0 / 100% 30% no-repeat,
		repeating-linear-gradient(180deg, var(--wl) 0 3px, transparent 3px 11px) 0 30% / 100% 30% no-repeat,
		repeating-linear-gradient(180deg, var(--wl) 0 4px, transparent 4px 16px) 0 60% / 100% 40% no-repeat,
		var(--wb);
	bottom: 0;
}
.site { --ripple: #f4e6f0; --wl: #7e8ad0; --wb: #3a4590; }
html.dark .site { --ripple: #46e8a8; --wl: #0f2c55; --wb: #061a28; }
.site-main::after { background: url("@D@refl-l.webp") 0 0 / 100% 100% no-repeat; height: calc(var(--aw) * 0.2167); left: 50%; margin-left: calc(var(--aw) / -2); right: auto; width: var(--aw); opacity: 0.7; }
html.dark .site-main::after { background-image: url("@D@refl-d.webp"); }
.site-footer::before { background: url("@D@refl-mid-l.webp") 0 0 / auto var(--midH) repeat-x; height: var(--midH); opacity: 0.7; }
html.dark .site-footer::before { background-image: url("@D@refl-mid-d.webp"); opacity: 0.8; }
.site-footer::after { background: url("@D@stars-b-l.svg") 0 0 / 1400px 900px repeat; bottom: 0; opacity: 0.3; transform: scaleY(-1); }
html.dark .site-footer::after { background-image: url("@D@stars-b-d.svg"); opacity: 0.5; }

/* ---- paper: grain tile over everything (static) ---- */
.site .overlay-a { background: url("@D@grain.png") 0 0 / 256px 256px; opacity: 0.55; }
html.dark .site .overlay-a { opacity: 0.4; }
.site .overlay-a::before { box-shadow: inset 0 0 9vmin 1vmin rgb(120 80 90 / 0.25); content: ""; inset: 0; position: absolute; }
html.dark .site .overlay-a::before { box-shadow: inset 0 0 10vmin 2vmin rgb(0 0 0 / 0.55); }

/* ---- scroll maps the descent: only translate and opacity ---- */
@media (prefers-reduced-motion: no-preference) {
	@supports (animation-timeline: scroll()) {
		html:not(.reduce-motion) .site :is(.scenery-a, .scenery-b, .scenery-c),
		html:not(.reduce-motion) .site :is(.site-scenery, .site-header, .site-main, .site-footer, .site-page, .site)::before,
		html:not(.reduce-motion) .site :is(.site-header, .site-main, .site-page)::after {
			animation-fill-mode: both; animation-timeline: --pg; animation-timing-function: linear;
		}
		html:not(.reduce-motion) .site::before { animation-name: zaw-sky; animation-range: 0% 100%; }
		html:not(.reduce-motion) .site .scenery-a { animation-name: zaw-aur-a; animation-range: 0% 100%; }
		html:not(.reduce-motion) .site .scenery-b { animation-name: zaw-aur-b; animation-range: 0% 90%; }
		html:not(.reduce-motion) .site .scenery-c { animation-name: zaw-aur-c; animation-range: 0% 100%; }
		html:not(.reduce-motion) .site-page::before { animation-name: zaw-far; animation-range: 0% 92%; }
		html:not(.reduce-motion) .site-header::before { animation-name: zaw-mid; animation-range: 0% 94%; }
		html:not(.reduce-motion) .site-header::after { animation-name: zaw-shore; animation-range: 6% 96%; }
		html:not(.reduce-motion) .site-main::before { animation-name: zaw-lake; animation-range: 34% 100%; }
	}
}
@keyframes zaw-sky { to { translate: 0 -46vh; } }
@keyframes zaw-aur-a { 0% { opacity: 0.45; } 50% { opacity: 1; } 100% { opacity: 0.25; translate: 0 -30vh; } }
@keyframes zaw-aur-b { 0% { opacity: 1; } 100% { opacity: 0.1; translate: 0 -42vh; } }
@keyframes zaw-aur-c { 0% { opacity: 0.8; } 100% { opacity: 0.5; translate: 0 -24vh; } }
@keyframes zaw-far { from { translate: 0 46vh; } }
@keyframes zaw-mid { from { translate: 0 62vh; } }
@keyframes zaw-shore { from { translate: 0 84vh; } }
@keyframes zaw-lake { from { translate: 0 42vh; } }
'''
aur = ""
for sel, f in [(".scenery-a::before","a"),(".scenery-a::after","b"),(".scenery-b::before","c"),(".scenery-b::after","d"),(".scenery-c::before","e"),(".scenery-c::after","f")]:
    top = {"a":-4,"b":-16,"c":-9,"d":-15,"e":-2,"f":-22}[f]
    aur += f'.site {sel} {{ background-image: url("@D@aur-{f}-l.webp"); top: {top}vh; }}\nhtml.dark .site {sel} {{ background-image: url("@D@aur-{f}-d.webp"); }}\n'
head = head.replace("@AUR@", aur.rstrip()).replace("@D@", D)

amb = ""
for sel, n, per, dx, sk, lo, hi, seed, dl in [
 (".scenery-a::before","a1",29,3.0,4,.55,1,1,4),(".scenery-a::after","a2",23,4.0,5,.4,.95,2,9),
 (".scenery-b::before","b1",19,2.6,5,.68,1,3,2),(".scenery-b::after","b2",31,3.4,6,.35,.9,4,14),
 (".scenery-c::before","c1",37,2.2,3,.6,1,5,6),(".scenery-c::after","c2",41,3.8,7,.3,.8,6,11)]:
    amb += ambient1(PF, n, f"{M} {sel}", per, dx, sk, lo, hi, seed=seed, delay=dl, extra_anim="").replace("ease-in-out", "steps(18, end)")
amb += f'''{M} .site-scenery::before {{ animation: zaw-tw-a 5s steps(5, end) infinite alternate; }}
{M} .site-scenery::after {{ animation: zaw-tw-b 7s steps(4, end) -3s infinite alternate; }}
@keyframes zaw-tw-a {{ from {{ opacity: var(--tw-lo); }} to {{ opacity: var(--tw-hi); }} }}
@keyframes zaw-tw-b {{ from {{ opacity: calc(var(--tw-lo) * 0.6); }} to {{ opacity: var(--tw-hi); }} }}
{M} .site-main::after {{ animation: zaw-lake linear both, zaw-rf 17s steps(24, end) infinite alternate; animation-range: 34% 100%, normal; animation-timeline: --pg, auto; }}
{M} .site-footer::before {{ animation: zaw-lake linear both, zaw-rm 13s steps(16, end) infinite alternate; animation-range: 34% 100%, normal; animation-timeline: --pg, auto; }}
{M} .site-footer::after {{ animation: zaw-lake linear both; animation-range: 34% 100%; animation-timeline: --pg; }}
@keyframes zaw-rf {{ from {{ transform: translate3d(-1.4vw, 0, 0); opacity: 0.7; }} to {{ transform: translate3d(1.8vw, 0, 0); opacity: 1; }} }}
@keyframes zaw-rm {{ from {{ transform: translate3d(-0.5vw, 0, 0); }} to {{ transform: translate3d(0.6vw, 0, 0); }} }}
'''
CSS = head + "\n/* ---- ambient shimmer ---- */\n" + motion(amb)
i = CSS.index("*/", CSS.index("Aurora Descent")) + 2
open(f"../../{ID}.css", "w").write(CSS[:i] + "\n\n" + PLUMB.replace("{id}", ID) + CSS[i:])
