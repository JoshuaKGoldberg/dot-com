css=[]
W=css.append
def stars(seed,n,tile,rmax):
    r=mul(seed); out=[]
    for _ in range(n):
        x=int(r()*tile);y=int(r()*tile);rad=.6+r()*rmax;al=.45+.5*r()
        out.append(f"radial-gradient({rad:.1f}px {rad:.1f}px at {x}px {y}px, rgba(255,255,255,{al:.2f}) 45%, transparent 55%)")
    return out
sA=stars(5,10,233,.9); sB=stars(9,9,317,1.0); sC=stars(13,8,401,1.2)

def common(sel_pairs): pass

head = """/*
 * Zero JS: Aurora (#206). There is no themes/zj-aurora.js: the cursor-following aurora is pure CSS.
 *
 *   cursor tracking : the pseudo-elements of existing elements become an invisible NXxNY grid of position:fixed
 *                     hover cells (below the real content, z-index:-1). `.site:has(host:hover)` writes the cell's
 *                     centre into typed @property --tx/--ty. A long transition-delay on those two properties makes
 *                     the aurora HOLD its last position while the pointer is over real text.
 *   physics         : every layer copies --tx/--ty into its own --x/--y and transitions them with a different damped
 *                     linear() spring (stiffness, overshoot, lag). (--tx - --x) is the spring's tracking error, i.e.
 *                     a free velocity signal: it stretches, skews and brightens the curtains while they chase the pointer.
 *   art             : curtains and beams are static SVG images (themes/zj-aurora/*.svg); only transforms and opacity
 *                     (plus @property values) animate.
 */

@property --tx { syntax: "<number>"; inherits: true; initial-value: 0.66; }
@property --ty { syntax: "<number>"; inherits: true; initial-value: 0.4; }
@property --x { syntax: "<number>"; inherits: false; initial-value: 0.66; }
@property --y { syntax: "<number>"; inherits: false; initial-value: 0.4; }

.site {
	--siteBg: #f4f8f8; --siteFg: #22343a; --siteFgStrong: #0f2127; --siteMuted: #56707a;
	--siteAccent: #0e7a6a; --siteSquiggle: #38c4a0; --siteSubtle: #dcebec;
	--zh: calc(100vh - var(--barHeight, 0px));
}
html.dark .site {
	--siteBg: #040a12; --siteFg: #d3e6ea; --siteFgStrong: #f0fafb; --siteMuted: #8fb0b8;
	--siteAccent: #6ff0c0; --siteSquiggle: #3fd9a8; --siteSubtle: #0d1d26;
}

/* ---------- sky (.site::before) + twinkling stars (.site::after) ---------- */
.site::before, .site::after { content: ""; position: fixed; left: 0; right: 0; top: var(--barHeight, 0px); z-index: -1; pointer-events: none; }
.site::before {
	bottom: 0;
	background:
		radial-gradient(90% 40% at 50% 100%, rgba(255, 214, 190, 0.5), transparent 70%),
		linear-gradient(180deg, #d6e8ee 0%, #e9f1f3 55%, #f6f2ee 100%);
}
html.dark .site::before {
	background:
		@STARSA@,
		radial-gradient(90% 40% at 50% 100%, rgba(30, 90, 90, 0.35), transparent 70%),
		linear-gradient(180deg, #020611 0%, #06101c 60%, #0a1822 100%);
	background-repeat: repeat, repeat, repeat, repeat, repeat, repeat, repeat, repeat, repeat, repeat, no-repeat, no-repeat;
	background-size: 233px 233px, 233px 233px, 233px 233px, 233px 233px, 233px 233px, 233px 233px, 233px 233px, 233px 233px, 233px 233px, 233px 233px, 100% 100%, 100% 100%;
}
.site::after { display: none; }
html.dark .site::after {
	display: block; height: 62%;
	background: @STARSB@;
	background-size: @SBSZ@;
	opacity: 0.7;
}

/* ---------- the aurora stack (inside .site-scenery) ---------- */
.site .site-scenery { transition: --tx 2s linear 3600s, --ty 2s linear 3600s; }
.site .scenery-a { animation: zja-pulse 7s ease-in-out infinite alternate; }
.site .scenery-b { animation: zja-pulse 11s ease-in-out -4s infinite alternate; }
.site .scenery-c { animation: zja-pulse 13s ease-in-out -9s infinite alternate; }

.site .site-scenery::before, .site .site-scenery::after,
.site .scenery-a::before, .site .scenery-b::before, .site .scenery-c::before {
	content: ""; position: absolute; top: 0; bottom: 0; left: -8vw; right: -8vw; pointer-events: none;
	--x: var(--tx); --y: var(--ty); will-change: transform; transform-origin: 50% 0;
	background-size: 100% 100%; background-repeat: no-repeat;
}
.site .scenery-a::after, .site .scenery-b::after, .site .scenery-c::after {
	content: ""; position: absolute; top: 0; left: 0; height: 100%; pointer-events: none;
	--x: var(--tx); --y: var(--ty); will-change: transform, opacity; transform-origin: 50% 0;
	background-size: 100% 100%; background-repeat: no-repeat;
}

/* curtains: lean toward the pointer; stretch/skew by the spring's tracking error (a velocity proxy) */
.site .scenery-a::before { transition: @TA@; transform: translateX(calc((var(--x) - 0.5) * 7vw)) skewX(calc((var(--x) - 0.5) * 9deg + (var(--tx) - var(--x)) * 26deg)) scaleY(calc(0.94 + var(--y) * 0.14 + abs(var(--tx) - var(--x)) * 0.5)); animation: zja-drift-a 19s ease-in-out infinite alternate, zja-flick 7s ease-in-out -2s infinite alternate; }
.site .scenery-b::before { transition: @TB@; transform: translateX(calc((var(--x) - 0.5) * 4.5vw)) skewX(calc((var(--x) - 0.5) * 6deg + (var(--tx) - var(--x)) * 20deg)) scaleY(calc(0.94 + var(--y) * 0.2 + abs(var(--tx) - var(--x)) * 0.6)); animation: zja-drift-b 23s ease-in-out -7s infinite alternate, zja-flick 11s ease-in-out -5s infinite alternate; }
.site .scenery-c::before { transition: @TC@; transform: translateX(calc((var(--x) - 0.5) * 2.5vw)) skewX(calc((var(--x) - 0.5) * 4deg + (var(--tx) - var(--x)) * 15deg)) scaleY(calc(0.95 + var(--y) * 0.26 + abs(var(--tx) - var(--x)) * 0.7)); animation: zja-drift-c 29s ease-in-out -13s infinite alternate, zja-flick 17s ease-in-out -9s infinite alternate; }

/* beams: tall bright rays that hang from the sky toward the pointer */
.site .scenery-a::after { width: 32vw; height: 60%; transition: @HA@; --s: calc(.62 + abs(var(--tx) - var(--x)) * 0.5); transform: translateY(calc((var(--y) + 0.04) * 100vh - var(--s) * 60vh)) translateX(calc(var(--x) * 100vw - 16vw)) skewX(calc((var(--tx) - var(--x)) * 34deg)) scaleY(var(--s)); opacity: min(1, calc(0.74 + abs(var(--tx) - var(--x)) * 1.4)); animation: zja-breathe 13s ease-in-out infinite alternate; }
.site .scenery-b::after { width: 40vw; height: 60%; transition: @HB@; --s: calc(.7 + abs(var(--tx) - var(--x)) * 0.6); transform: translateY(calc((var(--y) + 0.04) * 100vh - var(--s) * 60vh)) translateX(calc(var(--x) * 100vw - 20vw)) skewX(calc((var(--tx) - var(--x)) * 28deg)) scaleY(var(--s)); opacity: min(1, calc(0.66 + abs(var(--tx) - var(--x)) * 1.2)); animation: zja-breathe 17s ease-in-out -6s infinite alternate; }
.site .scenery-c::after { width: 50vw; height: 60%; transition: @HC@; --s: calc(.8 + abs(var(--tx) - var(--x)) * 0.7); transform: translateY(calc((var(--y) + 0.04) * 100vh - var(--s) * 60vh)) translateX(calc(var(--x) * 100vw - 25vw)) skewX(calc((var(--tx) - var(--x)) * 22deg)) scaleY(var(--s)); opacity: min(1, calc(0.58 + abs(var(--tx) - var(--x)) * 1.1)); animation: zja-breathe 23s ease-in-out -11s infinite alternate; }

/* slow background folds (the scenery container's own pseudo-elements) */
.site .site-scenery::before { transition: @F1@; transform: translateX(calc((var(--x) - 0.5) * -3vw)) skewX(calc((var(--x) - 0.5) * -5deg + (var(--tx) - var(--x)) * 12deg)) scaleY(calc(0.95 + var(--y) * 0.3)); animation: zja-drift-b 31s ease-in-out -3s infinite alternate, zja-flick 19s ease-in-out infinite alternate; }
.site .site-scenery::after { transition: @F2@; transform: translateX(calc((var(--x) - 0.5) * 2vw)) skewX(calc((var(--x) - 0.5) * 3deg + (var(--tx) - var(--x)) * 10deg)) scaleY(calc(1 + var(--y) * 0.2)); animation: zja-drift-a 37s ease-in-out -17s infinite alternate, zja-flick 5s ease-in-out -1s infinite alternate; }
"""
rep={"@STARSA@":",\n\t\t".join((sA+sB)[:10]),"@STARSB@":",\n\t\t".join(sC+sB[:3]),"@SBSZ@":", ".join(["401px 401px"]*len(sC)+["401px 401px"]*3),
 "@TA@":trans("ba"),"@TB@":trans("bb"),"@TC@":trans("bc"),"@HA@":trans("ha"),"@HB@":trans("hb"),"@HC@":trans("hc"),"@F1@":trans("f1"),"@F2@":trans("f2"),
 "NXxNY":f"{NX}x{NY}"}
for k,v in rep.items(): head=head.replace(k,v)
W(head)
for mode,pre in (("light",".site"),("dark","html.dark .site")):
    for L in "abc":
        W(f"{pre} .scenery-{L}::before {{ background-image: url(zj-aurora/body-{L}-{mode}.svg); }}")
        W(f"{pre} .scenery-{L}::after {{ background-image: url(zj-aurora/beam-{L}-{mode}.svg); }}")
    W(f"{pre} .site-scenery::before {{ background-image: url(zj-aurora/fold-1-{mode}.svg); }}")
    W(f"{pre} .site-scenery::after {{ background-image: url(zj-aurora/fold-2-{mode}.svg); }}")

W("""
@keyframes zja-pulse { from { opacity: 0.8; } 45% { opacity: 1; } to { opacity: 0.88; } }
@keyframes zja-flick { from { opacity: 0.82; } 38% { opacity: 1; } 71% { opacity: 0.9; } to { opacity: 0.97; } }
@keyframes zja-drift-a { from { translate: -1.6vw 0; scale: 1 0.97; } to { translate: 1.8vw 0.8vh; scale: 1.02 1.05; } }
@keyframes zja-drift-b { from { translate: 2vw 0.4vh; scale: 1.02 1.04; } to { translate: -2.2vw -0.4vh; scale: 1 0.96; } }
@keyframes zja-drift-c { from { translate: -1vw -0.6vh; scale: 1 1; } to { translate: 2.4vw 1vh; scale: 1.03 1.06; } }
@keyframes zja-breathe { from { translate: -0.8vw 0; scale: 0.92 1; } 50% { translate: 0.6vw -0.6vh; scale: 1.08 1.03; } to { translate: 0.3vw 0.3vh; scale: 0.98 0.97; } }
@keyframes zja-twinkle { from { opacity: 0.25; } to { opacity: 0.85; } }
html.dark .site::after { animation: zja-twinkle 5s ease-in-out infinite alternate; }

/* ---------- hit-testing: structural boxes are click-through; text stays solid and selectable ---------- */
.site .site-page, .site .site-page * { pointer-events: none; }
.site :is(.site-page a, .site-page button, h1, h2, .site-page p, .site-page time, .site-item-meta, .site-item-minutes, .site-heart) { pointer-events: auto; }
.site :is(h1, h2, .site-tagline, .site-item-description, .site-about p, .site-footer p) { width: fit-content; max-width: 100%; }
.site :is(.site-about p, .site-footer p) { margin-inline: auto; }
.site .site-page { position: static; }
/* Cells are absolute (so the wheel scrolls #site through them) and counter-scrolled by a scroll-driven animation: translate == scrollTop. */
@keyframes zja-pin { to { translate: 0 20000px; } }

/* ---------- the hover grid: every cell is a position:fixed pseudo-element of a different existing element ---------- */""")
for (i,j),sel in sorted(cell.items(),key=lambda kv:(depth[kv[1]],kv[0])):
    W(f"{sel}::before {{ content: \"\"; position: absolute; z-index: -1; pointer-events: auto; left: calc(100vw * {i} / {NX}); top: calc(var(--zh) * {j} / {NY}); width: calc(100vw / {NX}); height: calc(var(--zh) / {NY} - 0.5px); animation: zja-pin linear both; animation-timeline: scroll(nearest block); animation-range: 0px 20000px; }}")
W("\n/* hover -> target position (deeper elements come later, so text under the pointer outranks its ancestors' cells) */")
for sel,(x,y) in sorted(rule.items(),key=lambda kv:depth[kv[0]]):
    W(f".site:has({sel.replace(".site>","> ",1)}:hover) .site-scenery {{ --tx: {x:.4f}; --ty: {y:.4f}; transition: none; }}")

W("""
/* ---------- the badge: a conic ring spun by compositor-only `rotate`, clipped to a pill by .overlay-b ---------- */
.site .overlay-b {
	border-radius: 999px; contain: paint; inset: auto auto 1rem 1rem; overflow: hidden; padding: 2px; width: max-content; z-index: 20;
}
.site .overlay-b::after {
	background: conic-gradient(#46ffaa, #3cbeff, #be6eff, #46ffaa);
	content: ""; height: 360px; left: 50%; position: absolute; top: 50%; translate: -50% -50%; width: 360px; will-change: transform;
}
.site .overlay-b::before {
	background: var(--siteBg); border-radius: 999px; color: var(--siteFgStrong);
	content: "0 KB JavaScript \\A pure-CSS aurora: :has() + @property + linear()";
	display: block; font: 700 0.72rem/1.25 var(--siteFont); letter-spacing: 0.02em; padding: 0.4rem 0.95rem;
	position: relative; text-align: center; white-space: pre; z-index: 1;
}
@keyframes zja-spin { to { rotate: 360deg; } }
html:not(.reduce-motion) .site .overlay-b::after { animation: zja-spin 6s linear infinite; }

/* ---------- reduced motion: no ambient animation; the pointer response snaps instead of springing ---------- */
@media (prefers-reduced-motion: reduce) {
	.site .site-scenery > *, .site .site-scenery > *::before, .site .site-scenery > *::after,
	.site .site-scenery::before, .site .site-scenery::after, .site::after, .site .overlay-b::after { animation: none !important; transition: none !important; }
}
html.reduce-motion .site .site-scenery > *, html.reduce-motion .site .site-scenery > *::before, html.reduce-motion .site .site-scenery > *::after,
html.reduce-motion .site .site-scenery::before, html.reduce-motion .site .site-scenery::after, html.reduce-motion .site::after, html.reduce-motion .site .overlay-b::after { animation: none !important; transition: none !important; }
""")
open(ROOT+"zj-aurora.css","w").write("\n".join(css)+"\n")
