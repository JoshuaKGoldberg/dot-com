import random
PLUMB = r'''/* ---- shared plumbing: zero JavaScript, no themes/{id}.js ---- */

.site {
	scroll-timeline: --pg block;
}

/* soft scrims so prose stays readable over the scene; sections read as clearings */
.site-header,
.site-hero,
.site-about,
.site-section,
.site-footer {
	background: color-mix(in srgb, var(--siteBg) var(--scrim, 82%), transparent);
	border-radius: 1.4rem;
	box-shadow: 0 0 1.6rem 0.9rem color-mix(in srgb, var(--siteBg) calc(var(--scrim, 82%) * 0.9), transparent);
	box-sizing: border-box;
	padding: 0.9rem 1.4rem;
}

.site-hero {
	margin-block: 5rem 3.2rem;
	padding: 1.6rem 1.8rem;
}

.site-about,
.site-section {
	margin-bottom: 3.2rem;
}

.site-about {
	padding-block: 1.4rem;
}

.site-footer {
	margin-top: 4rem;
	opacity: 1;
	padding-block: 1.4rem;
}

.site-page {
	padding-bottom: 46vh;
}

.site-portrait img {
	box-shadow: 0 6px 22px 0 color-mix(in srgb, var(--siteFgStrong) 22%, transparent);
}

/* badge + tags, in the spirit of #158 */
.site .overlay-b::before {
	background: var(--badgeBg);
	border: 1.5px solid var(--badgeLine);
	border-radius: 999px;
	bottom: 1rem;
	color: var(--badgeFg);
	content: "0 KB JavaScript \A shipped by this theme";
	font: 700 0.72rem/1.25 var(--siteFont);
	left: 1rem;
	letter-spacing: 0.02em;
	padding: 0.4rem 0.95rem;
	position: absolute;
	text-align: center;
	white-space: pre;
}

.site .overlay-b::after {
	background: var(--badgeBg);
	border: 1px solid var(--badgeLine);
	border-radius: 0.4rem;
	bottom: 1rem;
	color: var(--badgeFg);
	content: var(--tags);
	font: 600 0.64rem/1.2 ui-monospace, SFMono-Regular, Menlo, monospace;
	max-width: 22rem;
	opacity: 0.92;
	padding: 0.4rem 0.55rem;
	position: absolute;
	right: 1rem;
}

@media (max-width: 760px) {
	.site .overlay-b::after {
		display: none;
	}
}

.site :is(.scenery-a, .scenery-b, .scenery-c)::before,
.site :is(.scenery-a, .scenery-b, .scenery-c)::after,
.site .site-scenery::before,
.site .site-scenery::after {
	content: "";
	pointer-events: none;
	position: absolute;
}

.site :is(.site-header, .site-main, .site-footer, .site-page)::before,
.site :is(.site-header, .site-main, .site-footer, .site-page)::after,
.site::before,
.site::after {
	content: "";
	pointer-events: none;
	position: fixed;
	z-index: -1;
}

/* every animated layer is its own compositor layer: only translate / transform / opacity ever change */
.site :is(.scenery-a, .scenery-b, .scenery-c),
.site :is(.scenery-a, .scenery-b, .scenery-c, .site-scenery, .site-header, .site-main, .site-footer, .site-page, .site)::before,
.site :is(.scenery-a, .scenery-b, .scenery-c, .site-scenery, .site-header, .site-main, .site-footer, .site-page, .site)::after {
	contain: paint;
	will-change: transform, opacity;
}
'''

def flare(seed, lo, hi, n=7):
    """Irregular multi-stop opacity keyframes (a prime-period pulse that never looks like a metronome)."""
    r = random.Random(seed)
    stops = []
    for i in range(n):
        pct = round(i * 100 / n + (r.uniform(-4, 4) if 0 < i else 0))
        v = lo + (hi - lo) * r.random() ** 0.8
        stops.append((max(0, pct), v))
    stops.append((100, stops[0][1]))
    return "; ".join(f"{p}% {{ opacity: {v:.2f}; }}" for p, v in stops)

def ambient(pfx, name, selector, sway_s, dx, skew, pulse_s, lo, hi, s0=0.97, s1=1.05, origin="50% 75%", seed=1, delay=0):
    """prime-period sway (transform) + flare (opacity), declared for one selector"""
    rule = f'''{selector} {{
	animation: {pfx}-sw-{name} {sway_s}s ease-in-out {-delay}s infinite alternate, {pfx}-pl-{name} {pulse_s}s ease-in-out {-delay*0.7:.1f}s infinite;
	transform-origin: {origin};
}}
@keyframes {pfx}-sw-{name} {{
	from {{ transform: translate3d({-dx}vw, 0, 0) skewX({-skew}deg) scaleY({s0}); }}
	to {{ transform: translate3d({dx}vw, 0, 0) skewX({skew}deg) scaleY({s1}); }}
}}
@keyframes {pfx}-pl-{name} {{
	{flare(seed, lo, hi)}
}}
'''
    return rule

def motion(css):
    return "@media (prefers-reduced-motion: no-preference) {\n" + "\n".join("\t" + l if l else l for l in css.splitlines()) + "\n}\n"

def ambient1(pfx, name, selector, period, dx, skew, lo, hi, s0=0.97, s1=1.05, origin="50% 75%", seed=1, delay=0, extra_anim="", n_op=7, n_tf=3):
    """ONE animation per layer: a prime-length loop whose transform stops (few, smooth) and opacity stops (many, irregular)
    sit at independent offsets, so sway and flare drift apart while costing a single Animation."""
    r = random.Random(seed)
    stops = {}
    # transform: swing out and back (n_tf+1 stops), loop-closed
    tf = [0] + sorted(r.sample(range(12, 90), n_tf - 1)) + [100]
    vals = [(-dx, -skew, s0), (dx * 0.8, skew * 0.6, s1), (-dx * 0.4, -skew * 0.9, (s0 + s1) / 2 + 0.01), (dx, skew, s1)]
    for i, p in enumerate(tf):
        a, b, c = vals[i % len(vals)] if p not in (0, 100) else (-dx, -skew, s0)
        stops.setdefault(p, []).append(f"transform: translate3d({a:.2f}vw, 0, 0) skewX({b:.2f}deg) scaleY({c:.3f})")
    for i in range(n_op + 1):
        p = 100 if i == n_op else (0 if i == 0 else max(1, min(99, round(i * 100 / n_op + r.uniform(-5, 5)))))
        v = (lo + (hi - lo) * 0.5) if p in (0, 100) else lo + (hi - lo) * r.random() ** 0.8
        stops.setdefault(p, []).append(f"opacity: {v:.2f}")
    kf = "\n".join(f"\t{p}% {{ {'; '.join(stops[p])}; }}" for p in sorted(stops))
    return f'''{selector} {{
	animation: {pfx}-am-{name} {period}s ease-in-out {-delay}s infinite{extra_anim};
	transform-origin: {origin};
}}
@keyframes {pfx}-am-{name} {{
{kf}
}}
'''
