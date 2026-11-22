/*
 * (vs2 copy of _sky/stars.js: wider size spread, three parallax depth layers, rainbow tint and constellation / graph / circuit edges near the cursor.)
 * A dark-sky star field for the side margins: hundreds of tiny dots of varied brightness,
 * mostly faint, a few brighter, with subtly different temperatures (blue-white, white, warm,
 * pale gold, faint orange). No flares, crosses, or big halos. Stars scintillate gently, and
 * the faintest ones come up a little as the cursor nears.
 *
 *   const stop = starrySky({ root, host, dark, reduced, seed, density, radius, constellation });
 *
 * Tuning: sizeScale and alphaScale shrink or dim every star; rest (0..1) is how visible stars
 * are until the cursor comes near; body: { density, alpha } lets a sparser, dimmer field continue
 * behind the content column instead of stopping (the blend is per-star, so there is no edge).
 */

const TEMPS = {
	dark: [
		[255, 255, 255],
		[214, 226, 255],
		[255, 245, 230],
		[255, 233, 200],
		[255, 214, 182],
	],
	light: [
		[150, 170, 225],
		[170, 150, 225],
		[225, 160, 190],
		[230, 190, 140],
		[140, 200, 215],
	],

};
const WEIGHTS = [0.4, 0.25, 0.2, 0.1, 0.05];

function mulberry(seed) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (a, b, v) => {
	const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
	return t * t * (3 - 2 * t);
};

function pickTemp(r) {
	let u = r();
	for (let i = 0; i < WEIGHTS.length; i++) {
		if ((u -= WEIGHTS[i]) <= 0) return i;
	}
	return 0;
}

export function starrySky({
	root,
	host = root.querySelector(".scenery-c"),
	dark = document.documentElement.classList.contains("dark"),
	reduced = false,
	seed = 1,
	density = 1,
	radius = 200,
	sizeScale = 1,
	alphaScale = 1,
	rest = 1,
	body = null,
	edgeStyle = "constellation", // "constellation" | "graph" | "circuit"
} = {}) {
	if (!host) return () => {};
	const temps = TEMPS[dark ? "dark" : "light"];
	const page = root.querySelector(".site-page");
	const PAD = 26;
	// three depth layers: far barely moves, near follows the scroll (0.04-0.12) and the pointer a little
	const LAYERS = [
		{ f: 0.012, pm: 3, dprCap: 1 },
		{ f: 0.055, pm: 8, dprCap: 1.25 },
		{ f: 0.115, pm: 15, dprCap: 1.5 },
	].map((l, i) => ({ ...l, i, stars: [], ox: 0, oy: 0, tox: 0, toy: 0, off: 0, canvas: null, ctx: null, dpr: 1 }));
	const mkCanvas = (css) => {
		const c = document.createElement("canvas");
		c.setAttribute("aria-hidden", "true");
		c.className = "sky-stars";
		c.style.cssText = "position:absolute;pointer-events:none;display:block;will-change:transform;" + css;
		host.append(c);
		return c;
	};
	for (const L of LAYERS) { L.canvas = mkCanvas("left:0;top:0;"); L.ctx = L.canvas.getContext("2d"); }
	const ov = mkCanvas("inset:0;width:100%;height:100%;");
	const octx = ov.getContext("2d");

	let W = 0, H = 0, dpr = 1, ox0 = 0, oy0 = 0;
	let all = [];
	let raf = 0, timer = 0, last = 0, alive = true, needT = true;
	const P = { x: -1e4, y: -1e4, has: false };
	const mod = (a, n) => ((a % n) + n) % n;

	function build() {
		const r = host.getBoundingClientRect();
		W = r.width; H = Math.max(200, r.height); ox0 = r.left; oy0 = r.top;
		dpr = Math.min(1.5, devicePixelRatio || 1);
		ov.width = Math.max(1, Math.round(W * dpr)); ov.height = Math.max(1, Math.round(H * dpr));
		for (const L of LAYERS) {
			L.dpr = Math.min(dpr, L.dprCap); L.stars = [];
			L.canvas.width = Math.round((W + PAD * 2) * L.dpr); L.canvas.height = Math.round(H * 2 * L.dpr);
			L.canvas.style.width = W + PAD * 2 + "px"; L.canvas.style.height = H * 2 + "px";
		}
		all = [];
		const pr = page?.getBoundingClientRect();
		const colL = (pr ? pr.left - ox0 : W / 2 - 416) + 8;
		const colR = (pr ? pr.right - ox0 : W / 2 + 416) - 8;
		const rnd = mulberry(seed * 7919 + 17);
		const span = body ? [[-PAD, W + PAD]] : [[-PAD, colL], [colR, W + PAD]].filter(([a, b]) => b - a > 40);
		const bodyDensity = body?.density ?? 0, bodyAlpha = body?.alpha ?? 0;
		for (const [a, b] of span) {
			const n = Math.round(((b - a) * H) / 650 * density);
			for (let i = 0; i < n; i++) {
				const x = a + rnd() * (b - a);
				// density climbs gradually across the whole margin (Josh: "1-1-2-3", not "1-1-4-5"), so the
				// column edge never reads as a boundary; the outer edge peaks at ~60% of the old density
				const d = x < colL ? colL - x : x > colR ? x - colR : 0;
				const M = Math.max(140, (x < colL ? colL : W - colR) * 0.95);
				const mg = Math.min(1, d / M);
				const keep = body ? bodyDensity + (0.62 - bodyDensity) * mg : 0.62 * mg;
				if (rnd() > keep) continue;
				// depth class: most stars are far and small, a few are near and slightly larger
				const u = rnd();
				const li = u < 0.58 ? 0 : u < 0.88 ? 1 : 2;
				const rr = li === 0 ? 0.4 + rnd() * 0.32 : li === 1 ? 0.72 + rnd() * 0.45 : 1.15 + rnd() * 0.75;
				const m = clamp01(((rr - 0.4) / 1.55) * 0.65 + rnd() * 0.35);
				const dim = body ? bodyAlpha + (1 - bodyAlpha) * mg : 1;
				const s = {
					id: all.length, L: LAYERS[li], x, y: rnd() * H, m, r: rr * sizeScale,
					a: (dark ? 0.16 + m * 0.7 : 0.1 + m * 0.34) * alphaScale * dim,
					t: pickTemp(rnd), ph: rnd() * 6.283, f: 0.6 + rnd() * 1.6, amp: 0.05 + rnd() * 0.12 + m * 0.08,
					k: 0, hue: 0, sx: x, sy: 0,
				};
				all.push(s); LAYERS[li].stars.push(s);
			}
		}
		needT = true;
		drawLayers(performance.now() / 1000);
		applyT();
	}

	// static layers: drawn twice (y and y+H) so the vertical wrap is seamless
	function drawLayers(t) {
		for (const L of LAYERS) {
			const g = L.ctx; g.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
			g.clearRect(0, 0, W + PAD * 2, H * 2);
			for (const s of L.stars) {
				const tw = reduced ? 1 : 1 + s.amp * Math.sin(t * s.f + s.ph);
				const a = Math.min(0.95 * alphaScale, s.a * tw * rest);
				const c = temps[s.t];
				g.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;
				for (let k = 0; k < 2; k++) {
					const y = s.y + k * H;
					if (s.m > 0.82) { g.globalAlpha = 0.1; g.beginPath(); g.arc(s.x + PAD, y, s.r * 2.2, 0, 6.283); g.fill(); g.globalAlpha = 1; }
					g.beginPath(); g.arc(s.x + PAD, y, s.r, 0, 6.283); g.fill();
				}
			}
		}
	}
	function applyT() {
		for (const L of LAYERS) {
			const v = L.off - L.oy;
			L.canvas.style.transform = `translate3d(${(L.ox - PAD).toFixed(2)}px,${(-mod(v, H)).toFixed(2)}px,0)`;
		}
		needT = false;
	}

	// ---- rainbow tint + edges ----
	const hslRgb = (h, sat, l) => {
		const f = (n) => { const k = (n + h / 30) % 12; return l - sat * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
		return [f(0) * 255, f(8) * 255, f(4) * 255];
	};
	const edges = new Map();
	let treeAt = 0, lastT = 0;
	function rebuildTree(t) {
		const cand = [];
		if (P.has) {
			for (const s of all) if (s.k > 0.22) cand.push([Math.hypot(s.sx - P.x, s.sy - P.y), s]);
			cand.sort((a, b) => a[0] - b[0]);
			cand.length = Math.min(cand.length, 30);
		}
		const want = new Set();
		if (cand.length > 1) {
			// Prim's minimum spanning tree, rooted at the star nearest the cursor
			const nodes = cand.map((c) => c[1]);
			const inT = [0], depth = [0], rest = nodes.map((_, i) => i).slice(1);
			const D = (a, b) => Math.hypot(nodes[a].sx - nodes[b].sx, nodes[a].sy - nodes[b].sy);
			while (rest.length) {
				let bi = -1, bp = -1, bd = 150;
				for (let ri = 0; ri < rest.length; ri++) for (const p of inT) { const d = D(rest[ri], p); if (d < bd) { bd = d; bi = ri; bp = p; } }
				if (bi < 0) break;
				const n = rest.splice(bi, 1)[0];
				inT.push(n); depth[n] = depth[bp] + 1;
				const a = nodes[bp], b = nodes[n], key = a.id + ">" + b.id;
				want.add(key);
				let e = edges.get(key);
				if (!e) edges.set(key, (e = { a, b, born: t, depth: depth[n], al: 0 }));
				e.target = 1; e.depth = depth[n];
			}
		}
		for (const [k, e] of edges) if (!want.has(k)) e.target = 0;
	}
	// edge geometry: straight (constellation / graph) or circuit trace: one axis run, a 45-degree bend, joint pads
	function route(x1, y1, x2, y2) {
		if (edgeStyle !== "circuit") return [[x1, y1], [x2, y2]];
		const dx = x2 - x1, dy = y2 - y1, ax = Math.abs(dx), ay = Math.abs(dy), m = Math.min(ax, ay);
		if (m < 3) return [[x1, y1], [x2, y2]];
		const sx = Math.sign(dx), sy = Math.sign(dy);
		const j = ax > ay ? [x1 + sx * (ax - m), y1] : [x1, y1 + sy * (ay - m)];
		return [[x1, y1], j, [x2, y2]];
	}
	// depth 0 (far layer) .. 1 (near layer). Each segment interpolates its two endpoints' depth: nearer is thicker, brighter and a touch
	// more saturated; farther is thinner, dimmer and bluer. Positions are the stars' live parallax-shifted positions.
	const dep = (s) => s.L.i / 2;
	const depthRgb = (hue, d) => {
		const far = 1 - d;
		// hue drifts toward blue with distance (shortest way round), saturation and lightness follow depth
		const dh = ((225 - hue + 540) % 360) - 180;
		const c = hslRgb((hue + dh * far * 0.35 + 360) % 360, (dark ? 0.6 : 0.5) + d * 0.35, dark ? 0.66 + d * 0.12 : 0.56 - d * 0.08);
		return c.map((v) => v | 0);
	};
	function drawTree(t, dt) {
		let busy = false;
		for (const [k, e] of edges) {
			e.al += (e.target - e.al) * (1 - Math.exp(-dt * (e.target ? 6 : 1.6)));
			if (!e.target && e.al < 0.015) { edges.delete(k); continue; }
			const grow = clamp01((t - e.born - e.depth * 0.1) / 0.5);
			if (grow < 1 || Math.abs(e.target - e.al) > 0.01) busy = true;
			if (grow <= 0) continue;
			const g = grow * grow * (3 - 2 * grow);
			const da = dep(e.a), db = dep(e.b);
			const pts = route(e.a.sx, e.a.sy, e.b.sx, e.b.sy);
			let tot = 0; const segs = [];
			for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(l); tot += l; }
			const rem = g * tot, dAt = (len) => da + (db - da) * (tot ? len / tot : 1);
			octx.lineCap = "round"; octx.lineJoin = "round";
			let acc = 0;
			for (let i = 1; i < pts.length && acc < rem; i++) {
				const sl = segs[i - 1];
				if (!sl) continue;
				const n = Math.max(2, Math.min(10, Math.ceil(sl / 14)));
				for (let j = 0; j < n && acc < rem; j++) {
					const u0 = j / n, lim = Math.min(1, (rem - acc) / sl), u1 = Math.min((j + 1) / n, lim);
					if (u1 <= u0) break;
					const m = dAt(acc + sl * (u0 + u1) / 2), c = depthRgb(e.b.hue, m);
					octx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${(e.al * (dark ? 0.12 + m * 0.34 : 0.17 + m * 0.4)).toFixed(3)})`;
					octx.lineWidth = 0.4 + m * 0.95;
					octx.beginPath();
					octx.moveTo(pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u0, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u0);
					octx.lineTo(pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u1, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u1);
					octx.stroke();
				}
				acc += sl;
			}
			if (grow >= 1) {
				// pads and node dots scale with the depth at their own position along the trace
				let len = 0;
				for (let i = 1; i < pts.length; i++) {
					len += segs[i - 1];
					const m = dAt(len), c = depthRgb(e.b.hue, m), A = e.al * (dark ? 0.25 + m * 0.4 : 0.32 + m * 0.4), sc = 0.6 + m * 0.85;
					const col = (a) => `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;
					if (edgeStyle === "graph") {
						if (i !== pts.length - 1) continue;
						octx.fillStyle = col(A); octx.beginPath(); octx.arc(pts[i][0], pts[i][1], (1.7 + e.b.r * 0.3) * sc, 0, 6.283); octx.fill();
						octx.strokeStyle = col(A * 0.5); octx.lineWidth = 0.4 + m * 0.4; octx.beginPath(); octx.arc(pts[i][0], pts[i][1], (3.6 + e.b.r * 0.3) * sc, 0, 6.283); octx.stroke();
					} else if (edgeStyle === "circuit") {
						octx.strokeStyle = col(A); octx.lineWidth = 0.4 + m * 0.6;
						octx.beginPath(); octx.arc(pts[i][0], pts[i][1], (i === pts.length - 1 ? 2.8 : 1.6) * sc, 0, 6.283); octx.stroke();
					}
				}
			}
		}
		return busy;
	}

	function drawOverlay(t) {
		octx.setTransform(dpr, 0, 0, dpr, 0, 0);
		octx.clearRect(0, 0, W, H);
		for (const s of all) {
			if (s.k < 0.01) continue;
			// lit stars: the extra light on top of what the layer already shows
			const tw = reduced ? 1 : 1 + s.amp * Math.sin(t * s.f + s.ph);
			const boost = rest + (1 - rest) * s.k + s.k * (1.8 - s.m * 1.4);
			const a = Math.min(0.95 * alphaScale, s.a * tw * boost) - Math.min(0.95 * alphaScale, s.a * tw * rest);
			if (a <= 0.003) continue;
			const c0 = temps[s.t], h = hslRgb(s.hue, 0.85, dark ? 0.72 : 0.6), m = Math.min(1, s.k) * 0.7;
			const c = [c0[0] + (h[0] - c0[0]) * m, c0[1] + (h[1] - c0[1]) * m, c0[2] + (h[2] - c0[2]) * m].map((v) => v | 0);
			octx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${Math.min(1, a * 1.15).toFixed(3)})`;
			octx.beginPath(); octx.arc(s.sx, s.sy, s.r * (1 + s.k * 0.2), 0, 6.283); octx.fill();
		}
		const dt = Math.min(0.1, lastT ? t - lastT : 0.05); lastT = t;
		return drawTree(t, dt);
	}

	function step(dt, t) {
		let busy = false;
		// parallax: pointer shift eases, scroll offset follows directly
		const sc = reduced ? 0 : root.scrollTop || 0;
		for (const L of LAYERS) {
			if (!reduced && P.has) { L.tox = -((P.x / W) - 0.5) * 2 * L.pm; L.toy = -((P.y / H) - 0.5) * 2 * L.pm * 0.6; }
			const nx = L.ox + (L.tox - L.ox) * (1 - Math.exp(-dt * 3)), ny = L.oy + (L.toy - L.oy) * (1 - Math.exp(-dt * 3));
			const noff = sc * L.f;
			if (Math.abs(nx - L.ox) > 0.01 || Math.abs(ny - L.oy) > 0.01 || noff !== L.off) needT = true;
			if (Math.abs(L.tox - nx) > 0.05 || Math.abs(L.toy - ny) > 0.05) busy = true;
			L.ox = nx; L.oy = ny; L.off = noff;
		}
		if (needT) applyT();
		for (const s of all) {
			const L = s.L;
			s.sx = s.x + L.ox; s.sy = mod(s.y - (L.off - L.oy), H);
			let target = 0;
			if (P.has) {
				const d = Math.hypot(s.sx - P.x, s.sy - P.y);
				if (d < radius) target = smooth(0, 1, 1 - d / radius);
				if (s.k > 0.01 || target > 0) s.hue = ((Math.atan2(s.sy - P.y, s.sx - P.x) / 6.2832) * 360 + 360 + s.sx * 0.1) % 360;
			}
			s.k += (target - s.k) * (1 - Math.exp(-dt * (target > s.k ? 4 : 0.9)));
			if (Math.abs(target - s.k) > 0.004) busy = true;
			else s.k = target;
		}
		if (t - treeAt > 0.12) { treeAt = t; rebuildTree(t); }
		return busy;
	}

	// the edge/overlay canvas redraws only while something is lit, growing or fading; scrolling an idle page costs only the layer transforms
	let drewLit = false;
	function overlayIfNeeded(t) {
		let any = edges.size > 0;
		if (!any) for (const s of all) if (s.k > 0.01) { any = true; break; }
		if (!any && !drewLit) { lastT = 0; return false; }
		drewLit = any;
		return drawOverlay(t);
	}
	function frame(now) {
		raf = 0;
		if (!alive || document.hidden) return;
		const dt = Math.min(0.1, last ? (now - last) / 1000 : 0.016);
		last = now;
		const busy = step(dt, now / 1000);
		const tb = overlayIfNeeded(now / 1000);
		if (busy || tb || scrolling) raf = requestAnimationFrame(frame);
		else last = 0;
	}
	let scrolling = false, scrollT = 0;
	const wake = () => {
		if (!raf && alive && !document.hidden && all.length) raf = requestAnimationFrame(frame);
	};
	const onMove = (e) => { P.x = e.clientX - ox0; P.y = e.clientY - oy0; P.has = true; wake(); };
	const onLeave = () => { P.has = false; treeAt = 0; for (const L of LAYERS) { L.tox = 0; L.toy = 0; } wake(); };
	const onScroll = () => { scrolling = true; clearTimeout(scrollT); scrollT = setTimeout(() => { scrolling = false; }, 120); wake(); };
	addEventListener("pointermove", onMove, { passive: true });
	document.documentElement.addEventListener("pointerleave", onLeave);
	if (!reduced) root.addEventListener("scroll", onScroll, { passive: true });
	// gentle scintillation on a slow tick: the layer canvases are repainted at 4 fps
	if (!reduced) timer = setInterval(() => { if (!document.hidden && all.length) { drawLayers(performance.now() / 1000); if (!raf) { step(0.25, performance.now() / 1000); overlayIfNeeded(performance.now() / 1000); } } }, 250);
	const ro = new ResizeObserver(build);
	ro.observe(host);
	build();

	return () => {
		alive = false;
		clearInterval(timer); clearTimeout(scrollT);
		cancelAnimationFrame(raf);
		ro.disconnect();
		removeEventListener("pointermove", onMove);
		document.documentElement.removeEventListener("pointerleave", onLeave);
		root.removeEventListener("scroll", onScroll);
		for (const L of LAYERS) L.canvas.remove();
		ov.remove();
	};
}
