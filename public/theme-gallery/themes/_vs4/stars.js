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

import { edgeList, layoutRot, label, smallGraph, pickSnark, loadGoldberg, goldbergReady, BASE_HUE_RATE, SNARK_HUE_RATE, leadSpark, easeBack, planRoute } from "./graphs.js";

const TEMPS = {
	dark: [
		[255, 255, 255],
		[214, 226, 255],
		[255, 245, 230],
		[255, 233, 200],
		[255, 214, 182],
	],
	// light mode: tiny, crisp dots in deep ink tones (navy, indigo, teal, plum, a few warm amber)
	light: [
		[28, 44, 112],
		[66, 56, 156],
		[8, 104, 116],
		[112, 38, 104],
		[186, 108, 16],
	],

};
const WEIGHTS = [0.34, 0.24, 0.2, 0.14, 0.08];

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
	// vs4: dwell = { rest, v(), sub(fn) }: each side's canvases rest at an opacity and rise with that side's dwell value.
	// sideMax multiplies the star count (the extra stars only fade in with dwell), orn = ring / pad ornaments per px^2, trees = edge-tree size.
	dwell = null, depthW = 1, nearBoost = false, graphs = true, sideMaxN = 40, sideMax = 1, orn = 0, ornDouble = false, trees = { n: 30, link: 150 },
} = {}) {
	if (!host) return () => {};
	const temps = TEMPS[dark ? "dark" : "light"];
	const page = root.querySelector(".site-page");
	const PAD = 48; // doubled parallax shifts a layer up to ~30px sideways: keep enough padding
	// three depth layers: far barely moves, near follows the scroll (0.04-0.12) and the pointer a little
	const DEPTHS = [
		{ f: 0.024, pm: 6, dprCap: 1 },
		{ f: 0.11, pm: 16, dprCap: 1.25 },
		{ f: 0.23, pm: 30, dprCap: 1.5 },
	];
	// vs4: one canvas per side per depth (6), so each side can carry its own dwell opacity
	let LAYERS = [];
	const mkCanvas = (css) => {
		const c = document.createElement("canvas");
		c.setAttribute("aria-hidden", "true");
		c.className = "sky-stars";
		c.style.cssText = "position:absolute;pointer-events:none;display:block;will-change:transform,opacity;" + css;
		host.append(c);
		return c;
	};
	const ov = mkCanvas("inset:0;width:100%;height:100%;");
	const octx = ov.getContext("2d");

	let W = 0, H = 0, dpr = 1, ox0 = 0, oy0 = 0;
	let all = [];
	let raf = 0, timer = 0, last = 0, alive = true, needT = true;
	const P = { x: -1e4, y: -1e4, has: false };
	const mod = (a, n) => ((a % n) + n) % n;
	// horizontal slowness: 2x in the middle sixth, easing to 1.5x at the rim of that sixth, then to 1x at the screen edges
	const sm = (a, b, v) => { const q = clamp01((v - a) / (b - a)); return q * q * (3 - 2 * q); };
	const slowM = (x) => { const d = Math.abs(x / (W || 1) - 0.5); return d < 1 / 12 ? 2 : d < 0.25 ? 2 - 0.5 * sm(1 / 12, 0.25, d) : 1.5 - 0.5 * sm(0.25, 0.5, d); };
	const wrapDy = (dy) => ((((dy + H / 2) % H) + H) % H) - H / 2;
	// nearBoost (gd-bloom): ~2x graph density and 1.8x brightness at the cursor, easing to 1x by ~250px; the cursor is smoothed so the glow follows gently
	let psx = 0, psy = 0, nbk = 0, hadPs = false;
	const cdist = (x, y) => Math.hypot(x - psx, y - psy);
	const near = (x, y) => (nbk < 0.01 ? 0 : nbk * sm(0, 1, 1 - cdist(x, y) / 200));
	const farK = (x, y) => (nbk < 0.01 ? 0 : nbk * sm(200, 320, cdist(x, y)));
	// about 2.4x at the cursor, 1x by ~200px, easing down to 0.75x beyond ~320px; far strokes also get thinner so near graphs clearly dominate
	const bst = (x, y) => (nearBoost ? 1 + 1.4 * near(x, y) - 0.25 * farK(x, y) : 1);
	const bw = (x, y) => (nearBoost ? 1 - 0.35 * farK(x, y) + 0.2 * near(x, y) : 1);
	// debug instrumentation (inert unless window.__vsDebug): new node / edge appearances near the cursor (<120px) versus farther, by source
	const statDbg = typeof window !== "undefined" && window.__vsDebug;
	const stat = (src, kind, x, y) => { if (!statDbg || !P.has) return; const S = (window.__vsStat ||= {}), k = src + "." + kind + (Math.hypot(x - P.x, y - P.y) <= 120 ? ".near" : ".far"); S[k] = (S[k] || 0) + 1; };
	let colLx = 0, colRx = 0, lastSc = 0, velInit = false, velE = 0, scrollFade = 0;

	function build() {
		const r = host.getBoundingClientRect();
		W = r.width; H = Math.max(200, r.height); ox0 = r.left; oy0 = r.top;
		dpr = Math.min(1.5, devicePixelRatio || 1);
		ov.width = Math.max(1, Math.round(W * dpr)); ov.height = Math.max(1, Math.round(H * dpr));
		for (const L of LAYERS) L.canvas.remove();
		LAYERS = [];
		for (let side = 0; side < 2; side++) for (let di = 0; di < 3; di++) {
			const d = DEPTHS[di], x0 = side ? W / 2 - PAD : -PAD * 2, x1 = side ? W + PAD * 2 : W / 2 + PAD;
			const L = { ...d, i: di, side, cx0: x0, cw: x1 - x0, stars: [], ox: 0, oy: 0, tox: 0, toy: 0, off: 0, dpr: Math.min(dpr, d.dprCap), sl: 0, sd: 1, drawnSl: 0 };
			L.canvas = mkCanvas("left:0;top:0;"); L.ctx = L.canvas.getContext("2d");
			L.canvas.width = Math.round(L.cw * L.dpr); L.canvas.height = Math.round(H * 2 * L.dpr);
			L.canvas.style.width = L.cw + "px"; L.canvas.style.height = H * 2 + "px";
			ov.before(L.canvas);
			LAYERS.push(L);
		}
		applyDwellOpacity();
		all = [];
		const pr = page?.getBoundingClientRect();
		const colL = (pr ? pr.left - ox0 : W / 2 - 416) + 8;
		const colR = (pr ? pr.right - ox0 : W / 2 + 416) - 8;
		colLx = colL; colRx = colR;
		const rnd = mulberry(seed * 7919 + 17);
		const span = body ? [[-PAD, W + PAD]] : [[-PAD, colL], [colR, W + PAD]].filter(([a, b]) => b - a > 40);
		const bodyDensity = body?.density ?? 0, bodyAlpha = body?.alpha ?? 0;
		for (const [a, b] of span) {
			const n = Math.round(((b - a) * H) / 650 * density * sideMax);
			for (let i = 0; i < n; i++) {
				const x = a + rnd() * (b - a);
				// density climbs gradually across the whole margin (Josh: "1-1-2-3", not "1-1-4-5"), so the
				// column edge never reads as a boundary; the outer edge peaks at ~60% of the old density
				const d = x < colL ? colL - x : x > colR ? x - colR : 0;
				const M = Math.max(140, (x < colL ? colL : W - colR) * 0.95);
				const mg = Math.min(1, d / M);
				const keep = body ? bodyDensity + (0.62 - bodyDensity) * mg : 0.62 * mg;
				if (rnd() > keep) continue;
				const extra = sideMax > 1 && rnd() > 1 / sideMax; // vs4: the extra stars only appear as dwell rises
				const th = extra ? 0.1 + rnd() * 0.7 : -1;
				// depth class: most stars are far and small, a few are near and slightly larger
				const u = rnd();
				const li = u < 0.58 ? 0 : u < 0.88 ? 1 : 2;
				const side = x < W / 2 ? 0 : 1;
				const rr = li === 0 ? 0.4 + rnd() * 0.32 : li === 1 ? 0.72 + rnd() * 0.45 : 1.15 + rnd() * 0.75;
				const m = clamp01(((rr - 0.4) / 1.55) * 0.65 + rnd() * 0.35);
				const dim = body ? bodyAlpha + (1 - bodyAlpha) * mg : 1;
				const s = {
					id: all.length, L: LAYERS[side * 3 + li], side, isStar: true, th, orn: 0, dz: clamp01(li / 2 * 0.72 + rnd() * 0.28 + (rnd() - 0.5) * 0.12), x, y: rnd() * H, m, r: rr * sizeScale,
					a: (dark ? 0.16 + m * 0.7 : 0.2 + m * 0.62) * alphaScale * dim,
					t: pickTemp(rnd), ph: rnd() * 6.283, f: 0.6 + rnd() * 1.6, amp: 0.05 + rnd() * 0.12 + m * 0.08,
					k: 0, hue: 0, sx: x, sy: 0,
				};
				if (li > 0 && rnd() < orn * (extra ? 1.8 : 0.3) && mg > 0.35) s.orn = rnd() < 0.5 ? 1 : 2;
				all.push(s); s.L.stars.push(s);
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
			g.clearRect(0, 0, L.cw, H * 2);
			const dv = dwell ? dwell.v()[L.side ? "right" : "left"] : 1;
			for (const s of L.stars) {
				const tw = reduced ? 1 : 1 + s.amp * Math.sin(t * s.f + s.ph);
				const gate = s.th < 0 ? 1 : smooth(s.th - 0.12, s.th + 0.3, dv);
				if (gate < 0.01) continue;
				const a = Math.min(0.95 * alphaScale, s.a * tw * rest) * gate;
				const c = temps[s.t];
				g.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;
				const sx = s.x - L.cx0;
				const sl = L.sl, streak = sl > 1.5 && s.m > 0.25 && !reduced;
				for (let k = 0; k < 2; k++) {
					const y = s.y + k * H;
					if (streak) { // velocity streak: a sharp head at the star, a soft tail trailing opposite the motion (stacked, widening, fading copies; no filters)
						const len = sl * (0.5 + s.m * 0.7), dy = L.sd * len, w = Math.max(0.5, s.r * 0.9);
						g.lineCap = "round";
						for (let q = 0; q < 3; q++) {
							const f0 = q / 3, f1 = (q + 1) / 3;
							g.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${(a * (0.5 - q * 0.17) * gate).toFixed(3)})`; g.lineWidth = w;
							g.beginPath(); g.moveTo(sx, y + dy * f0); g.lineTo(sx, y + dy * f1); g.stroke();
							g.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${(a * (0.16 - q * 0.04) * gate).toFixed(3)})`; g.lineWidth = w * 3;
							g.beginPath(); g.moveTo(sx, y + dy * f0); g.lineTo(sx, y + dy * f1); g.stroke();
						}
					}
					if (s.m > 0.82) { g.globalAlpha = 0.1 * gate; g.beginPath(); g.arc(sx, y, s.r * 2.2, 0, 6.283); g.fill(); g.globalAlpha = 1; }
					g.beginPath(); g.arc(sx, y, s.r, 0, 6.283); g.fill();
					if (s.orn) ornament(g, s, sx, y, a);
				}
			}
		}
	}
	// vs4 ornaments: a node ring (1) or a circuit pad with four ticks (2); ornDouble adds a second, wider ring
	function ornament(g, s, x, y, a) {
		const c = temps[s.t], R = 4.5 + s.r * 2.6;
		g.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${Math.min(0.9, a * 0.85).toFixed(3)})`; g.lineWidth = 0.55 + s.L.i * 0.2;
		g.beginPath(); g.arc(x, y, R, 0, 6.283); g.stroke();
		if (ornDouble && s.orn === 1) { g.globalAlpha = 0.55; g.beginPath(); g.arc(x, y, R * 1.75, 0, 6.283); g.stroke(); g.globalAlpha = 1; }
		if (s.orn === 2) {
			g.beginPath();
			for (let q = 0; q < 4; q++) { const an = q * 1.5708 + 0.7854; g.moveTo(x + Math.cos(an) * R, y + Math.sin(an) * R); g.lineTo(x + Math.cos(an) * (R + 4.5), y + Math.sin(an) * (R + 4.5)); }
			g.stroke();
		}
	}
	function applyDwellOpacity() {
		for (const L of LAYERS) {
			const dv = dwell ? dwell.v()[L.side ? "right" : "left"] : 1;
			L.canvas.style.opacity = (dwell ? dwell.rest + (1 - dwell.rest) * dv : 1).toFixed(3);
		}
	}
	function applyT() {
		for (const L of LAYERS) {
			const v = L.off - L.oy;
			L.canvas.style.transform = `translate3d(${(L.ox + L.cx0).toFixed(2)}px,${(-mod(v, H)).toFixed(2)}px,0)`;
		}
		needT = false;
	}

	// ---- rainbow tint + edges ----
	const hslRgb = (h, sat, l) => {
		const f = (n) => { const k = (n + h / 30) % 12; return l - sat * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
		return [f(0) * 255, f(8) * 255, f(4) * 255];
	};
	const edges = new Map();
	let treeAt = 0, lastT = 0, treeLead = null;
	function rebuildTree(t) {
		const cand = [];
		if (P.has) {
			for (const s of all) if (s.k > 0.22) cand.push([Math.hypot(s.sx - P.x, s.sy - P.y), s]);
			cand.sort((a, b) => a[0] - b[0]);
			cand.length = Math.min(cand.length, trees.n);
		}
		const want = new Set();
		if (cand.length > 1) {
			// Prim's minimum spanning tree, rooted at the star nearest the cursor
			const nodes = cand.map((c) => c[1]);
			if (!reduced && !edges.size && !treeLead && cand[0][0] <= 240) treeLead = { x: P.x, y: P.y, root: nodes[0], born: t }; // a new tree grows out from the cursor point: lead to the root star
			const inT = [0], depth = [0], rest = nodes.map((_, i) => i).slice(1);
			const D = (a, b) => Math.hypot(nodes[a].sx - nodes[b].sx, nodes[a].sy - nodes[b].sy);
			while (rest.length) {
				let bi = -1, bp = -1, bd = trees.link;
				for (let ri = 0; ri < rest.length; ri++) for (const p of inT) { const d = D(rest[ri], p); if (d < bd) { bd = d; bi = ri; bp = p; } }
				if (bi < 0) break;
				const n = rest.splice(bi, 1)[0];
				inT.push(n); depth[n] = depth[bp] + 1;
				const a = nodes[bp], b = nodes[n], key = a.id + ">" + b.id;
				want.add(key);
				let e = edges.get(key);
				if (!e) { edges.set(key, (e = { a, b, born: t, depth: depth[n], al: 0 })); stat("tree", "edge", (a.sx + b.sx) / 2, (a.sy + b.sy) / 2); }
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
	const dep = (s) => s.dz;
	const depthRgb = (hue, d) => {
		const far = 1 - d;
		// hue drifts toward blue with distance (shortest way round), saturation and lightness follow depth
		const dh = ((225 - hue + 540) % 360) - 180;
		const c = hslRgb((hue + dh * far * 0.35 + 360) % 360, (dark ? 0.6 : 0.45) + d * 0.45, dark ? 0.66 + d * 0.12 : 0.64 - d * 0.26);
		return c.map((v) => v | 0);
	};
	function drawTree(t, dt) {
		let busy = false, maxGrow = 0;
		for (const [k, e] of edges) {
			e.al += (e.target - e.al) * (1 - Math.exp(-dt * (e.target ? 3 / slowM(e.a.sx) : 1.6)));
			if (!e.target && e.al < 0.015) { edges.delete(k); continue; }
			const grow = clamp01((t - e.born - e.depth * 0.2) / (1.0 * slowM(e.a.sx)));
			maxGrow = Math.max(maxGrow, grow);
			if (grow < 1 || Math.abs(e.target - e.al) > 0.01) busy = true;
			if (grow <= 0) continue;
			const g = grow * grow * (3 - 2 * grow);
			const da = dep(e.a), db = dep(e.b);
			// wrap-aware: use the copy of b nearest to a, and fade the edge out once it stretches past ~1.6x its rest length (or rest + 60px)
			const by = e.a.sy + wrapDy(e.b.sy - e.a.sy);
			const pts = route(e.a.sx, e.a.sy, e.b.sx, by);
			const rest0 = Math.hypot(e.b.x - e.a.x, wrapDy(e.b.y - e.a.y)), cur = Math.hypot(e.b.sx - e.a.sx, by - e.a.sy);
			const lim = Math.min(rest0 * 1.6, rest0 + 60), stretch = 1 - sm(lim, lim + 40, cur);
			if (stretch <= 0.01) continue;
			const dm = stretch * (1 - 0.5 * scrollFade) * (dwell ? 0.4 + 0.6 * dwell.v()[e.a.side ? "right" : "left"] : 1);
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
					octx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${Math.min(0.95, bst(pts[i - 1][0], pts[i - 1][1]) * e.al * dm * (dark ? 0.12 + m * 0.34 : 0.17 + m * 0.4)).toFixed(3)})`;
					octx.lineWidth = Math.min(2.2, (0.3 + m * m * 2.3) * depthW) * bw(pts[i - 1][0], pts[i - 1][1]);
					octx.beginPath();
					octx.moveTo(pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u0, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u0);
					octx.lineTo(pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u1, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u1);
					octx.stroke();
					if (m > 0.5) { // lit-tube core on near, wide segments
						octx.strokeStyle = `rgba(255,255,255,${(e.al * dm * (m - 0.4) * (dark ? 0.5 : 0.7)).toFixed(3)})`;
						octx.lineWidth = Math.max(0.3, (0.3 + m * m * 2.3) * depthW * 0.3);
						octx.stroke();
					}
				}
				acc += sl;
			}
			if (grow >= 1) {
				// pads and node dots scale with the depth at their own position along the trace
				let len = 0;
				for (let i = 1; i < pts.length; i++) {
					len += segs[i - 1];
					const m = dAt(len), c = depthRgb(e.b.hue, m), A = e.al * dm * (dark ? 0.25 + m * 0.4 : 0.32 + m * 0.4), sc = 0.6 + m * 0.85;
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
		if (treeLead) { // lead hairline: fixed start at the spawn cursor point, to the root star; gone once the first edges have formed
			if (!edges.size) treeLead = null;
			else { const la = 1 - sm(0.15, 1, maxGrow), gl = clamp01((t - treeLead.born) / 0.9), R = treeLead.root;
				if (la > 0.01) { busy = true; leadSpark(octx, treeLead.x, treeLead.y, R.sx, R.sy, gl, la, dark ? [200, 215, 250] : [60, 80, 170], dark); } else treeLead = null; }
		}
		return busy;
	}

	// ---- vs4: the living mix of graphs in the margins ----
	// Small random graphs (trees, cycles, k-nearest webs) are the dominant texture; now and then a featured Goldberg snark grows, sprouts thin
	// secondary lines, holds and dissipates. Each graph: grow edge by edge (slow, with the centre slowness), hold, dissipate outside in.
	// Spawning follows the side's dwell; snarks only after ~20-28 s of continuous dwell in that margin, then rarely; they all dissipate as dwell falls.
	const insts = [[], []], dwellT = [0, 0], snarkAt = [40, 40], snarkNext = [0, 0], spawnAcc = [0, 0], snarkLog = [[], []];
	const DEBUG_SNARK = typeof location !== "undefined" && new URLSearchParams(location.search).get("vsdebug") === "snark"; // inert unless ?vsdebug=snark: spawns a snark in the left margin immediately
	let debugDone = false;
	const GROW = 0.22, RET = 0.3, SMALL_CAP = nearBoost ? 11 : 8, SMALL_RATE = nearBoost ? 1.0 : 0.7, SNARK_MEAN = 105;
	const R_ = Math.random;
	function setSeedI(I, s) {
		const dist = I.verts.map(() => -1); dist[s] = 0;
		for (const q = [s]; q.length;) { const u = q.shift(); for (const w of I.adj[u]) if (dist[w] < 0) { dist[w] = dist[u] + 1; q.push(w); } }
		let mx = 1; for (const d of dist) mx = Math.max(mx, d);
		for (const e of I.el) { if (e.sec) continue; const da = dist[e.a] < 0 ? 0 : dist[e.a], db = dist[e.b] < 0 ? 0 : dist[e.b]; e.flip = db < da; e.o = (Math.min(da, db) + e.j * 0.7) / (mx + 0.7); }
	}
	// spark route: from the cursor, hop along existing visible nodes / edges (graph vertices, anchors, lit stars, tree edges), adding short gap edges where needed, to the new graph's first vertex
	function planSideRoute(side, T) {
		const nodes = [], refs = [], idx = new Map();
		const keep = (x, y) => Math.hypot(x - P.x, y - P.y) <= 260 || Math.hypot(x - T.x, y - T.y) <= 260;
		for (const O of insts[side]) for (const v of O.verts) { if (v.ghost || v.tip || v.vis < 0.3 || !keep(v.x, v.y)) continue; idx.set(v, nodes.length); nodes.push({ x: v.x, y: v.y }); refs.push({ v }); }
		for (const st of all) { if (st.side !== side || st.k < 0.3 || !keep(st.sx, st.sy) || nodes.length > 110) continue; idx.set(st, nodes.length); nodes.push({ x: st.sx, y: st.sy }); refs.push({ star: st }); }
		const real = [];
		for (const O of insts[side]) for (const e of O.el) { if (e.rev < 0.5) continue; const a = idx.get(O.verts[e.a]), b = idx.get(O.verts[e.b]); if (a !== undefined && b !== undefined) real.push([a, b]); }
		for (const e of edges.values()) { if (!e.target || e.al < 0.3) continue; const a = idx.get(e.a), b = idx.get(e.b); if (a !== undefined && b !== undefined) real.push([a, b]); }
		const path = planRoute(nodes, real, { x: P.x, y: P.y }, T);
		return path ? path.map((p) => ({ ref: p.i >= 0 ? refs[p.i] : null, kind: p.i === -1 ? "origin" : p.i === -2 ? "target" : "node", gap: p.gap })) : null;
	}
	function spawnInst(side, kind, t) {
		const snark = kind === "snark";
		const dn0 = nearBoost && P.has ? Math.hypot(P.x - (side ? W - 80 : 80), 0) : 999; // (density is applied once the position is chosen, below)
		let g = snark ? pickSnark(R_, { maxK: 9, rareK: R_() < 0.15 ? 11 : 0 }) : smallGraph(R_);
		if (!g) return false; // (snark data not loaded yet)
		const mw = side ? W - colRx : colLx;
		if (mw < 70) return false;
		let s = snark ? Math.max(40, Math.min(mw * 0.42, 88)) : 16 + R_() * 22; // small enough that most nodes land within ~150px of the cursor
		s = Math.min(s, Math.max(24, mw / 2 - 10));
		const lo = side ? colRx + s * 0.35 : s + 8, hi = side ? W - s - 8 : colLx - s * 0.35, xl = Math.min(lo, hi), xh = Math.max(lo, hi);
		let cx = 0, cy = 0, ok = false;
		for (let k = 0; k < 12 && !ok; k++) {
			// at least 1:1 near-heavy: ~85% of spawns 30-120px from the live cursor, the rest 120-320px out for variety; nothing spawns at random positions while the cursor is in the margin
			if (P.has) { const an = R_() * 6.283, d = R_() < 0.85 ? 30 + R_() * 90 : 120 + R_() * 200; cx = Math.max(xl, Math.min(xh, P.x + Math.cos(an) * d)); cy = P.y + Math.sin(an) * d; }
			else { cx = xl + R_() * (xh - xl); cy = R_() * H; }
			cy = Math.max(s + 8, Math.min(H - s - 8, cy));
			ok = !insts[side].some((I) => Math.hypot(I.cx - cx, I.cy - cy) < I.s + s * 0.9 + 12);
		}
		if (!ok) return false;
		if (nearBoost && !snark && P.has) { const dn = Math.hypot(cx - P.x, cy - P.y), extra = Math.round((1 - clamp01(dn / 250)) * 3 * R_()); if (extra) g = smallGraph(R_, undefined, extra); } // denser graphs nearer the cursor
		const lay = layoutRot(g, (R_() - 0.5) * 1.1, (R_() - 0.5) * 0.7);
		const li0 = (R_() * 3) | 0; // graphs live in the star field: each vertex rides a star layer (parallax, scroll, streaks); a spring system keeps the shape
		const I = { kind, g, side, cx, cy, s, slow: 2 + R_() * 2, /* everything that shoots out for this spawn runs 2-4x slower, coherently */ verts: lay.map(([lx, ly, lz]) => ({ x: cx + lx * s, y: cy - ly * s, x0: cx + lx * s, y0: cy - ly * s, d: clamp01(0.5 + lz * 1.1), dd: [Math.cos(R_() * 6.283), Math.sin(R_() * 6.283)], vis: 0, hue: 0 })),
			adj: lay.map(() => []), el: [], prog: 0, phase: "grow", diss: 0, cap: 0, name: label(g) };
		for (const e of edgeList(g)) { I.el.push({ a: e.a, b: e.b, i: e.i, c: e.c, o: 0, flip: false, j: R_(), sec: false, rev: 0, ret: 0 }); I.adj[e.a].push(e.b); I.adj[e.b].push(e.a); }
		let si = 0, bd = 1e9; I.verts.forEach((v, i) => { const d = P.has ? Math.hypot(v.x - P.x, v.y - P.y) : Math.hypot(v.x - cx, v.y - cy); if (d < bd) { bd = d; si = i; } });
		setSeedI(I, si); I.seedV = si;
		if (snark) { // secondary lines: faint tendrils (and links to the nearest free star) off some vertices
			const n = I.verts.length, picks = new Set();
			for (let guard = 0; picks.size < Math.max(3, Math.round(n * 0.3)) && guard < 50; guard++) picks.add((R_() * n) | 0);
			let oi = 0;
			for (const vi of picks) {
				const v = I.verts[vi], o0 = 1 + (oi++ % 6) * 0.05;
				if (R_() < 0.4) {
					let best = null, bs = s * 0.9 + 30;
					for (const st of all) { if (st.side !== side) continue; const d = Math.hypot(st.sx - v.x, st.sy - v.y); if (d > 12 && d < bs) { bs = d; best = st; } }
					if (best) { I.verts.push({ x: best.sx, y: best.sy, x0: best.sx, y0: best.sy, d: best.dz, dd: [0, 0], vis: 0, hue: 0, tip: true, star: true, starRef: best }); I.el.push({ a: vi, b: I.verts.length - 1, i: 0, c: 1, o: o0, sec: true, rev: 0, ret: 0, flip: false }); continue; }
				}
				let prev = vi, an = Math.atan2(v.y - cy, v.x - cx) + (R_() - 0.5) * 0.9;
				for (let k = 0, segs = 2 + ((R_() * 2) | 0); k < segs; k++) {
					const len = 10 + R_() * 14; an += (R_() - 0.5) * 0.8;
					const pv = I.verts[prev];
					I.verts.push({ x: pv.x + Math.cos(an) * len, y: pv.y + Math.sin(an) * len, x0: pv.x + Math.cos(an) * len, y0: pv.y + Math.sin(an) * len, d: pv.d, dd: [Math.cos(an), Math.sin(an)], vis: 0, hue: 0, tip: true, par: prev });
					I.el.push({ a: prev, b: I.verts.length - 1, i: 0, c: 1, o: o0 + k * 0.12, sec: true, tendrilRoot: k === 0, rev: 0, ret: 0, flip: false }); prev = I.verts.length - 1;
				}
			}
		}
		// about half of the spark leads persist as real structure: the spawn point becomes an anchor node (same layer, springs with the graph), the lead a real edge to the graph's
		// first vertex, and if another graph / anchor lies within ~90px one more edge links to it, so successive spawns build a connected constellation around where the cursor rests
		let route = null; // ~75% of leads travel along the existing network; the rest stay straight
		if (!reduced && P.has && R_() < 0.75) route = planSideRoute(side, I.verts[si]);
		if (route) {
			const hop = 0.17 * I.slow; I.leadPath = { seq: route, hop }; I.startDelay = (route.length - 1) * hop;
			const made = new Map(); // item -> vertex index in this graph, created on demand (anchors for the cursor point, ghost mirrors for existing nodes)
			const vertFor = (it) => {
				if (it.kind === "target") return si;
				const key = it.kind === "origin" ? "origin" : it.ref.v || it.ref.star;
				if (made.has(key)) return made.get(key);
				let vv;
				if (it.kind === "origin") vv = { x: P.x, y: P.y, x0: P.x, y0: P.y, d: 0.55, dd: [R_() - 0.5, R_() - 0.5], vis: 0, hue: 0, anchor: true, par: si };
				else if (it.ref.star) vv = { x: it.ref.star.sx, y: it.ref.star.sy, x0: 0, y0: 0, d: it.ref.star.dz, dd: [0, 0], vis: 0, hue: 0, tip: true, star: true, ghost: true, starRef: it.ref.star };
				else vv = { x: it.ref.v.x, y: it.ref.v.y, x0: it.ref.v.x, y0: it.ref.v.y, d: it.ref.v.d, dd: [0, 0], vis: 0, hue: 0, tip: true, star: true, ghost: true, refVert: it.ref.v };
				I.verts.push(vv); made.set(key, I.verts.length - 1); return I.verts.length - 1;
			};
			for (let k = 1; k < route.length; k++) { // new (gap) edges persist about half the time; the others fade after the spark passes
				if (!route[k].gap) continue;
				if (R_() < 0.5) { const a = vertFor(route[k - 1]), b = vertFor(route[k]); I.el.push({ a, b, i: 0, c: 1, o: 0.1, j: 0, sec: true, link: true, t0: (k - 1) * hop, rev: 0, ret: 0, flip: false }); route[k].persist = true; }
			}
		} else if (!reduced && P.has && bd <= 120 && R_() < 0.5) { // (only short straight leads persist: long beams would look heavy)
			let same = null; // the cursor resting in one spot: reuse the anchor already there (a ghost mirror of it), so the new graph hangs off the same node
			for (const O of insts[side]) for (const ov of O.verts) if (ov.anchor && Math.hypot(ov.x - P.x, ov.y - P.y) <= 6) same = ov;
			const ai = I.verts.length;
			if (same) I.verts.push({ x: same.x, y: same.y, x0: same.x, y0: same.y, d: same.d, dd: [0, 0], vis: 0, hue: 0, tip: true, star: true, ghost: true, refVert: same });
			else I.verts.push({ x: P.x, y: P.y, x0: P.x, y0: P.y, d: 0.55, dd: [R_() - 0.5, R_() - 0.5], vis: 0, hue: 0, anchor: true, par: si });
			I.el.push({ a: ai, b: si, i: 0, c: 1, o: 0, j: 0, sec: false, anchor: true, rev: 0, ret: 0, flip: false });
			let best = null, bds = same ? 0 : 90; // (nothing more to link when the anchor is shared)
			for (const O of insts[side]) for (const ov of O.verts) { if (ov.ghost || ov.tip) continue; const d = Math.hypot(ov.x - P.x, ov.y - P.y) - (ov.anchor ? 20 : 0); if (d > 6 && d < bds) { bds = d; best = ov; } }
			if (best) { I.verts.push({ x: best.x, y: best.y, x0: best.x, y0: best.y, d: best.d, dd: [0, 0], vis: 0, hue: 0, tip: true, star: true, ghost: true, refVert: best }); I.el.push({ a: ai, b: I.verts.length - 1, i: 0, c: 1, o: 0.12, sec: true, rev: 0, ret: 0, flip: false, link: true }); }
		}
		{ // anchor every vertex to a star layer (or to a real star): it then parallaxes, scrolls and streaks with that layer
			const off = (L) => L.off - L.oy;
			I.verts.forEach((v, i) => {
				if (v.starRef) { v.L = v.starRef.L; v.sx = v.starRef.x; v.sy = v.starRef.y; return; }
				if (v.refVert) { v.L = v.refVert.L; v.sx = v.refVert.sx; v.sy = v.refVert.sy; return; }
				if (v.par !== undefined) v.L = I.verts[v.par].L;
				else { const lz = lay[i][2]; v.L = LAYERS[side * 3 + Math.max(0, Math.min(2, li0 + (snark ? (lz > 0.25 ? 1 : lz < -0.25 ? -1 : 0) : 0)))]; }
				v.sx = v.x - v.L.ox; v.sy = v.y + off(v.L);
			});
		}
		for (const e of I.el) if (e.sec && e.tendrilRoot && P.has && !reduced && Math.hypot(I.verts[e.a].x - P.x, I.verts[e.a].y - P.y) <= 240) e.lead = [P.x, P.y]; // tendrils start with a short lead from the spawn cursor point
		for (const e of I.el) { const A = I.verts[e.a], B = I.verts[e.b]; e.L0 = Math.max(4, Math.hypot(B.x - A.x, B.y - A.y)); } // rest length for the edge springs
		I.age = 0; I.origin = !reduced && P.has && bd <= 240 ? [P.x, P.y] : null; I.asleep = false;
		const hx = P.has ? P.x : cx, hy = P.has ? P.y : cy;
		for (const v of I.verts) v.hue = ((Math.atan2(v.y - hy, v.x - hx) / 6.283) * 360 + 360) % 360;
		if (statDbg) { const sr = snark ? "snark" : "small"; for (const v of I.verts) stat(sr, "node", v.x, v.y); for (const e of I.el) stat(sr, "edge", (I.verts[e.a].x + I.verts[e.b].x) / 2, (I.verts[e.a].y + I.verts[e.b].y) / 2); }
		I.omax = Math.max(0.5, ...I.el.map((e) => e.o)); I.pmax = (I.omax + GROW) / (1 + GROW);
		I.growDur = (snark ? 2 * (8 + g.n * 0.08) : 3.5 + g.n * 0.35) * I.pmax; I.growDur *= I.slow; I.holdT = snark ? 8 + R_() * 12 : 3 + R_() * 7; I.dissDur = snark ? 5.5 : 3.2; I.leaveAt = 0.03 + R_() * 0.4;
		if (reduced) { I.prog = I.pmax; I.phase = "static"; }
		insts[side].push(I);
		return true;
	}
	// soft body: every vertex is a particle tied to its layer anchor by a spring, every edge a distance spring at its rest length (stiffening past ~1.4x).
	// Scrolling drags the anchors at different parallax speeds, so the graph stretches like elastic and then settles back with a slightly underdamped bounce.
	// Fixed 60 Hz semi-implicit Euler; sleeps at rest; none in reduced motion.
	function stepPhysics(I, dt) {
		const V = I.verts, snark = I.kind === "snark";
		let moved = false;
		for (let i = 0; i < V.length; i++) {
			const v = V[i], L = v.L;
			if (!L) continue;
			const dr = v.star ? 0 : I.diss * 16;
			let ax = v.sx + L.ox + (v.star ? 0 : v.dd[0] * dr), ay = mod(v.sy - (L.off - L.oy), H) + (v.star ? 0 : v.dd[1] * dr);
			if (v.px === undefined) { v.px = ax; v.py = i && V[0].py !== undefined ? V[0].py + wrapDy(ay - V[0].py) : ay; v.vx = v.vy = 0; v.ax = undefined; }
			ay = v.py + wrapDy(ay - v.py); // the copy of the anchor nearest the particle: continuous across the wrap seam
			if (v.ax === undefined || Math.abs(ax - v.ax) + Math.abs(ay - v.ay) > 0.04) moved = true;
			v.ax = ax; v.ay = ay;
		}
		if (reduced) { for (const v of V) { v.px = v.ax; v.py = v.ay; v.x = v.px; v.y = v.py; } return; }
		if (!moved && I.asleep) { for (const v of V) { v.x = v.px; v.y = v.py; } return; }
		I.asleep = false;
		I.acc = Math.min(0.1, (I.acc || 0) + dt);
		const ka = snark ? 18 : 12, ke = snark ? 70 : 40, damp = snark ? 6.5 : 5.5, h = 1 / 60;
		while (I.acc >= h) {
			I.acc -= h;
			for (const v of V) { v.fx = v.L ? ka * (v.ax - v.px) : 0; v.fy = v.L ? ka * (v.ay - v.py) : 0; }
			for (const e of I.el) {
				const A = V[e.a], B = V[e.b]; if (!A.L || !B.L) continue;
				const dx = B.px - A.px, dy = B.py - A.py, len = Math.hypot(dx, dy) || 1, st = len / e.L0;
				const f = ke * (len - e.L0) * (st > 1.4 ? 1 + (st - 1.4) * 8 : 1) / len;
				A.fx += f * dx; A.fy += f * dy; B.fx -= f * dx; B.fy -= f * dy;
			}
			const dec = Math.exp(-damp * h);
			for (const v of V) { if (!v.L) continue; v.vx = (v.vx + v.fx * h) * dec; v.vy = (v.vy + v.fy * h) * dec; v.px += v.vx * h; v.py += v.vy * h; }
		}
		let mv = 0, md = 0;
		for (const v of V) { v.x = v.px; v.y = v.py; mv = Math.max(mv, Math.abs(v.vx || 0) + Math.abs(v.vy || 0)); md = Math.max(md, Math.abs(v.ax - v.px) + Math.abs(v.ay - v.py)); }
		if (mv < 0.05 && md < 0.05) I.asleep = true;
	}
	// the route lead: the spark head hops node to node (~170ms a hop, eased), lighting each traversed edge as a pulse that fades back; non-persisting gap edges fade after the spark passes
	function drawRouteLead(I, t) {
		const L = I.leadPath, seq = L.seq, e = I.age / L.hop, nseg = seq.length - 1;
		if (e > nseg + 8) return;
		const pos = (it) => (it.kind === "origin" ? { x: I.origin ? I.origin[0] : P.x, y: I.origin ? I.origin[1] : P.y } : it.kind === "target" ? I.verts[I.seedV] : it.ref.star ? { x: it.ref.star.sx, y: it.ref.star.sy } : it.ref.v);
		const col = I.kind === "snark" ? hslRgb((t * SNARK_HUE_RATE + I.cx * 0.1) % 360, 0.55, dark ? 0.7 : 0.42) : (dark ? [200, 215, 250] : [60, 80, 170]), rgb = `${col[0] | 0},${col[1] | 0},${col[2] | 0}`;
		octx.lineCap = "round";
		for (let k = 0; k < nseg && e > k; k++) {
			const f0 = clamp01(e - k), f = f0 * f0 * (3 - 2 * f0), A = pos(seq[k]), B = pos(seq[k + 1]), age = Math.max(0, (e - (k + 1)) * L.hop);
			let a = 0.65 * Math.exp(-age / 0.5);
			if (seq[k + 1].gap) a = seq[k + 1].persist ? 0 : Math.max(a, 0.5 * (1 - clamp01(age / 1.3)));
			if (a < 0.01) continue;
			octx.strokeStyle = `rgba(${rgb},${Math.min(0.9, a).toFixed(3)})`; octx.lineWidth = seq[k + 1].gap ? 0.8 : 1.2;
			octx.beginPath(); octx.moveTo(A.x, A.y); octx.lineTo(A.x + (B.x - A.x) * f, A.y + (B.y - A.y) * f); octx.stroke();
		}
		if (e < nseg) { // the travelling head
			const k = Math.floor(e), f0 = e - k, f = f0 * f0 * (3 - 2 * f0), A = pos(seq[k]), B = pos(seq[k + 1]), hx = A.x + (B.x - A.x) * f, hy = A.y + (B.y - A.y) * f;
			octx.fillStyle = `rgba(${rgb},0.34)`; octx.beginPath(); octx.arc(hx, hy, 3.8, 0, 6.283); octx.fill();
			octx.fillStyle = dark ? "rgba(255,255,255,0.9)" : `rgba(${rgb},0.95)`; octx.beginPath(); octx.arc(hx, hy, 1.5, 0, 6.283); octx.fill();
		}
	}
	function drawInsts(t, dt) {
		let busy = false;
		for (let side = 0; side < 2; side++) {
			for (const I of insts[side].slice()) {
				const dv = dwell ? dwell.v()[side ? "right" : "left"] : 1, sl = slowM(I.cx);
				const dxv = 1 - Math.pow(Math.max(0, 1 - dv), 1 / sl);
				if (!reduced) {
					if (I.phase === "grow") { if (I.age >= (I.startDelay || 0)) I.prog += dt * (0.4 + 0.6 * dxv) / (I.growDur * sl); if (I.prog >= I.pmax) { I.prog = I.pmax; I.phase = "hold"; } }
					else if (I.phase === "hold") { I.holdT -= dt; if (I.holdT <= 0) I.phase = "diss"; }
					if (I.phase !== "diss" && dxv < I.leaveAt) I.phase = "diss";
					if (I.phase === "diss") { I.diss += dt / I.dissDur; if (I.diss >= 1) { insts[side].splice(insts[side].indexOf(I), 1); continue; } }
				}
				busy = true;
				const dm = (0.45 + 0.55 * dv) * (1 - 0.5 * scrollFade);
				for (const v of I.verts) v.vis = 0;
				stepPhysics(I, dt);
				I.age += dt;
				if (I.leadPath && !reduced && I.phase !== "diss") drawRouteLead(I, t);
				else if (I.origin && !reduced && I.phase !== "diss") { // lead: a thin fading hairline from the spawn cursor point to the nearest vertex (fixed start, gone once the first edge has formed)
					let mr = 0; for (const e of I.el) if (!e.sec && !e.anchor) mr = Math.max(mr, e.rev);
					const la = 1 - sm(0.15, 1, mr), sv = I.verts[I.seedV ?? 0];
					if (la > 0.01 && sv) leadSpark(octx, I.origin[0], I.origin[1], sv.x, sv.y, clamp01(I.age / (1.1 * I.slow)), la, I.kind === "snark" ? hslRgb((t * SNARK_HUE_RATE + I.cx * 0.1) % 360, 0.55, dark ? 0.7 : 0.42) : (dark ? [200, 215, 250] : [60, 80, 170]), dark);
				}
				let tot = 0;
				for (const e of I.el) {
					const q = clamp01((I.prog * (1 + GROW) - e.o) / GROW), gq = e.t0 !== undefined ? clamp01((I.age - e.t0) / (0.35 * I.slow)) : q * q * (3 - 2 * q);
					const rr = clamp01((I.diss * (1 + RET) - (1 - e.o / I.omax)) / RET), rs = rr * rr * (3 - 2 * rr);
					e.rev = gq * (1 - rs); e.ret = rs; tot += e.rev;
					const S = I.verts[e.flip ? e.b : e.a], D = I.verts[e.flip ? e.a : e.b];
					if (e.rev > 0) { S.vis = Math.max(S.vis, sm(0, 0.3, e.rev)); D.vis = Math.max(D.vis, sm(0.7, 1, e.rev)); }
				}
				if (!reduced) { // vertices fly out from the spawn cursor point (seed) or their parent vertex, easing into place with a gentle overshoot; edges stretch with them
					for (const v of I.verts) { v.rx = v.x; v.ry = v.y; }
					for (const e of I.el) if (e.rev > 0) { const S = I.verts[e.flip ? e.b : e.a], D = I.verts[e.flip ? e.a : e.b]; if (D.born === undefined) { D.born = t; D.par = S; } if (S.born === undefined) { S.born = t; S.par = null; } }
					for (const v of I.verts) {
						if (v.born === undefined || v.star) continue;
						const u = clamp01((t - v.born) / (0.95 * I.slow)), eb = easeBack(u), P0x = v.par ? v.par.rx : (I.origin ? I.origin[0] : v.rx), P0y = v.par ? v.par.ry : (I.origin ? I.origin[1] : v.ry);
						v.x = P0x + (v.rx - P0x) * eb; v.y = P0y + (v.ry - P0y) * eb;
					}
				}
				I.cap += (((I.phase === "hold" || I.phase === "static") && I.kind === "snark" && tot / I.el.length > 0.9 ? 1 : 0) - I.cap) * (1 - Math.exp(-dt * 0.35));
				octx.lineCap = "round";
				const sparks = [];
				for (const e of I.el) {
					if (e.rev < 0.003) continue;
					let A = I.verts[e.a], B = I.verts[e.b];
					if (e.flip) [A, B] = [B, A];
					if (e.lead && e.rev < 0.9) leadSpark(octx, e.lead[0], e.lead[1], I.verts[e.a].x, I.verts[e.a].y, clamp01(e.rev * 3), (1 - sm(0.3, 0.9, e.rev)) * 0.7 * dm, dark ? [200, 215, 250] : [60, 80, 170], dark);
					const k0 = e.sec ? 0.55 : e.anchor ? 0.8 : 1; // no fade on stretch: the springs cap it
					const bulge = e.c > 1 ? (e.i - (e.c - 1) / 2) * 7 : 0;
					const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, N = 6;
					for (let k = 0; k < N; k++) {
						const u0 = k / N, u1 = Math.min((k + 1) / N, e.rev);
						if (u1 <= u0) break;
						const o0 = Math.sin(u0 * Math.PI) * bulge, o1 = Math.sin(u1 * Math.PI) * bulge;
						const m = A.d + (B.d - A.d) * ((u0 + u1) / 2);
						let c, al = Math.min(0.95, dm * k0 * (dark ? 0.12 + m * 0.5 : 0.2 + m * 0.5) * bst(A.x + dx * (u0 + u1) / 2, A.y + dy * (u0 + u1) / 2));
						if (I.kind === "snark") { // vivid colour running along the edge, cycling at 1.5x the base hue rate
							const hh = (t * SNARK_HUE_RATE + (A.x + (B.x - A.x) * (u0 + u1) / 2) * 0.35 + m * 70 + I.cx * 0.1) % 360;
							c = hslRgb(hh, (dark ? 0.5 : 0.45) * (e.sec ? 0.5 : 1), dark ? 0.66 : 0.42).map((q) => q | 0); al = Math.min(0.95, al * 0.95);
							if (dark && !e.sec) { octx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${(al * 0.09).toFixed(3)})`; octx.lineWidth = (0.3 + m * m * 2.2) * depthW * 3; octx.beginPath(); octx.moveTo(A.x + dx * u0 + nx * o0, A.y + dy * u0 + ny * o0); octx.lineTo(A.x + dx * u1 + nx * o1, A.y + dy * u1 + ny * o1); octx.stroke(); }
						} else c = depthRgb((A.hue + t * BASE_HUE_RATE) % 360, m);
						octx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${al.toFixed(3)})`;
						octx.lineWidth = (0.3 + m * m * 2.2) * depthW * k0 * bw(A.x + dx * (u0 + u1) / 2, A.y + dy * (u0 + u1) / 2);
						octx.beginPath(); octx.moveTo(A.x + dx * u0 + nx * o0, A.y + dy * u0 + ny * o0); octx.lineTo(A.x + dx * u1 + nx * o1, A.y + dy * u1 + ny * o1); octx.stroke();
						if (m > 0.5 && !e.sec) { octx.strokeStyle = `rgba(255,255,255,${(dm * (m - 0.4) * (dark ? 0.45 : 0.55)).toFixed(3)})`; octx.lineWidth = Math.max(0.3, (0.3 + m * m * 2.2) * depthW * 0.3); octx.stroke(); }
					}
					if (e.ret > 0.04 && e.ret < 0.96) sparks.push([A.x + dx * e.rev, A.y + dy * e.rev, e.ret, A.hue]);
				}
				for (const v of I.verts) {
					const vv = v.tip && !v.star ? v.vis * 0.6 : v.vis; if (vv < 0.01 || v.ghost) continue;
					const sn = I.kind === "snark", c = sn ? hslRgb((t * SNARK_HUE_RATE + v.x * 0.35 + v.d * 70 + I.cx * 0.1) % 360, (dark ? 0.5 : 0.45) * (v.tip ? 0.5 : 1), dark ? 0.66 : 0.42).map((q) => q | 0) : depthRgb((v.hue + t * BASE_HUE_RATE) % 360, v.d), r = (v.tip ? 0.5 : 0.7 + v.d * 1.5) * (dark ? 1 : 1.05) * (sn ? 1.25 : 1);
					if (sn && v.L && v.L.sl > 1.5) { octx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${(dm * vv * 0.35).toFixed(3)})`; octx.lineWidth = Math.max(0.5, r * 0.8); octx.lineCap = "round"; octx.beginPath(); octx.moveTo(v.x, v.y); octx.lineTo(v.x, v.y + v.L.sd * v.L.sl * 0.8); octx.stroke(); }
					if (sn && !v.tip) { if (dark) { octx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${(dm * vv * 0.11).toFixed(3)})`; octx.beginPath(); octx.arc(v.x, v.y, r * 2.8, 0, 6.283); octx.fill(); } octx.fillStyle = `rgba(255,255,255,${(dm * vv * 0.45).toFixed(3)})`; octx.beginPath(); octx.arc(v.x, v.y, r * 0.45, 0, 6.283); octx.fill(); }
					octx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${Math.min(0.95, dm * vv * bst(v.x, v.y) * (dark ? 0.3 + v.d * 0.5 : 0.4 + v.d * 0.5)).toFixed(3)})`;
					octx.beginPath(); octx.arc(v.x, v.y, r * bw(v.x, v.y), 0, 6.283); octx.fill();
					if (nearBoost && !v.tip) { const nh = nbk * sm(0, 1, 1 - cdist(v.x, v.y) / 80); if (nh > 0.02) { octx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${(0.16 * nh * vv * dm).toFixed(3)})`; octx.beginPath(); octx.arc(v.x, v.y, r * 3.6, 0, 6.283); octx.fill(); } } // soft glow halo within ~80px of the cursor
					if (v.d > 0.55 && !v.tip) { octx.fillStyle = `rgba(255,255,255,${(dm * vv * 0.5).toFixed(3)})`; octx.beginPath(); octx.arc(v.x - r * 0.28, v.y - r * 0.3, r * 0.38, 0, 6.283); octx.fill(); }
				}
				for (const [x, y, rt, h] of sparks) { const c = depthRgb(h, 0.8); octx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${(Math.sin(rt * Math.PI) * 0.8 * dm).toFixed(3)})`; octx.beginPath(); octx.arc(x, y, 1.1, 0, 6.283); octx.fill(); }
				if (I.cap > 0.03) { // a faint caption once a snark has fully grown
					octx.font = "8.5px 'League Spartan', sans-serif"; octx.textAlign = "center"; octx.letterSpacing = "1.4px";
					octx.fillStyle = dark ? `rgba(170,190,225,${(dm * I.cap * 0.4).toFixed(3)})` : `rgba(60,75,140,${(dm * I.cap * 0.5).toFixed(3)})`;
					octx.fillText(I.name.toUpperCase(), I.cx, Math.min(H - 6, I.cy + I.s * 1.2)); octx.letterSpacing = "0px";
				}
			}
		}
		if (window.__vsDebug) document.documentElement.dataset['side'] = JSON.stringify([insts.map((l) => l.map((I) => I.kind[0]).join('')), snarkLog, dwellT.map((x) => +x.toFixed(1))]);
		if (statDbg && window.__vsStat) document.documentElement.dataset.stat = JSON.stringify(window.__vsStat);
		return busy;
	}
	function updateInsts(t, dt) {
		if (nearBoost) { if (P.has) { if (!hadPs) { psx = P.x; psy = P.y; hadPs = true; } else { const a = 1 - Math.exp(-dt * 6); psx += (P.x - psx) * a; psy += (P.y - psy) * a; } } nbk += ((P.has && !reduced ? 1 : 0) - nbk) * (1 - Math.exp(-dt * 3)); }
		if (!graphs) return;
		if (DEBUG_SNARK && !debugDone && !goldbergReady()) loadGoldberg().then(() => wake());
		if (DEBUG_SNARK && !debugDone && goldbergReady() && colLx > 70 && H > 100) {
			debugDone = true;
			if (spawnInst(0, "snark", t)) { const I = insts[0][insts[0].length - 1]; I.leaveAt = -1; I.holdT = 1e9; I.growDur = 4; }
		}
		if (DEBUG_SNARK && insts[0].some((I) => I.kind === "snark")) return;
		for (let side = 0; side < 2; side++) {
			const dv = dwell ? dwell.v()[side ? "right" : "left"] : 1;
			const inM = P.has && (side ? P.x > colRx - 30 : P.x < colLx + 30) && (side ? W - colRx : colLx) > 70;
			if (reduced) { if (inM && !insts[side].length) { for (let i = 0; i < 3; i++) spawnInst(side, "small", t); if (dv > 0.3) spawnInst(side, "snark", t); } continue; }
			if (dv < 0.1) { dwellT[side] = 0; snarkAt[side] = 35 + R_() * 10; snarkNext[side] = 0; } else { dwellT[side] += dt; if (dwellT[side] > 2 && !goldbergReady()) (window.requestIdleCallback || setTimeout)(() => loadGoldberg()); }
			if (!inM && dv < 0.1) continue;
			spawnAcc[side] += dt * SMALL_RATE * sm(0.04, 0.45, dv) / slowM(side ? colRx + 60 : colLx * 0.5);
			while (spawnAcc[side] >= 1) { spawnAcc[side] -= 1; if (insts[side].filter((I) => I.kind === "small").length < SMALL_CAP) spawnInst(side, "small", t); }
			if (dv > 0.3 && dwellT[side] >= snarkAt[side] && dwellT[side] >= snarkNext[side] && !insts[side].some((I) => I.kind === "snark")) {
				if (spawnInst(side, "snark", t)) { snarkNext[side] = dwellT[side] + SNARK_MEAN * (0.86 + R_() * 0.28); snarkLog[side].push(+dwellT[side].toFixed(1)); } else snarkNext[side] = dwellT[side] + 2;
			}
		}
	}

	function drawOverlay(t) {
		octx.setTransform(dpr, 0, 0, dpr, 0, 0);
		octx.clearRect(0, 0, W, H);
		for (const s of all) {
			if (s.k < 0.01) continue;
			// lit stars: the extra light on top of what the layer already shows
			const tw = reduced ? 1 : 1 + s.amp * Math.sin(t * s.f + s.ph);
			const boost = rest + (1 - rest) * s.k + s.k * (1.8 - s.m * 1.4);
			const dm = dwell ? 0.4 + 0.6 * dwell.v()[s.side ? "right" : "left"] : 1;
			const a = (Math.min(0.95 * alphaScale, s.a * tw * boost) - Math.min(0.95 * alphaScale, s.a * tw * rest)) * dm;
			if (a <= 0.003) continue;
			const c0 = temps[s.t], h = hslRgb(s.hue, 0.85, dark ? 0.72 : 0.42), m = Math.min(1, s.k) * 0.7;
			const c = [c0[0] + (h[0] - c0[0]) * m, c0[1] + (h[1] - c0[1]) * m, c0[2] + (h[2] - c0[2]) * m].map((v) => v | 0);
			octx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${Math.min(1, a * 1.15).toFixed(3)})`;
			octx.beginPath(); octx.arc(s.sx, s.sy, s.r * (1 + s.k * 0.2), 0, 6.283); octx.fill();
		}
		const dt = Math.min(0.1, lastT ? t - lastT : 0.05); lastT = t;
		const bt = drawTree(t, dt);
		return drawInsts(t, dt) || bt;
	}

	function step(dt, t) {
		let busy = false;
		// parallax: pointer shift eases, scroll offset follows directly
		const sc = reduced ? 0 : root.scrollTop || 0;
		// scroll velocity (EMA) -> per-layer streak length: proportional to velocity x the layer's parallax factor, clamped to 80px; eases back to dots in ~0.3 s
		{
			if (!velInit) { lastSc = sc; velInit = true; }
			const inst = dt > 0 ? (sc - lastSc) / dt : 0; lastSc = sc;
			velE += (inst - velE) * (1 - Math.exp(-dt * 12));
			const av = Math.abs(velE);
			for (const L of LAYERS) {
				const tgt = reduced ? 0 : Math.min(80, Math.max(0, av - 250) * L.f * 0.085);
				L.sl += (tgt - L.sl) * (1 - Math.exp(-dt * (tgt > L.sl ? 14 : 9)));
				if (L.sl < 0.4 && tgt === 0) L.sl = 0;
				if (av > 250) L.sd = velE > 0 ? 1 : -1;
				if (L.sl > 1.5 || L.drawnSl > 1.5) busy = true;
			}
			scrollFade = Math.min(1, av / 3500);
			if (LAYERS.some((L) => Math.abs(L.sl - L.drawnSl) > 1.2 || (L.sl === 0 && L.drawnSl !== 0))) { for (const L of LAYERS) L.drawnSl = L.sl; drawLayers(performance.now() / 1000); }
		}
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
				if (s.k > 0.01 || target > 0) s.hue = ((Math.atan2(s.sy - P.y, s.sx - P.x) / 6.2832) * 360 + 360 + s.sx * 0.1 + t * BASE_HUE_RATE) % 360;
			}
			const k0 = s.k;
			s.k += (target - s.k) * (1 - Math.exp(-dt * (target > s.k ? 2 / slowM(s.sx) : 0.9)));
			if (k0 < 0.1 && s.k >= 0.1) stat("star", "node", s.sx, s.sy);
			if (Math.abs(target - s.k) > 0.004) busy = true;
			else s.k = target;
		}
		if (t - treeAt > 0.12) { treeAt = t; rebuildTree(t); }
		updateInsts(t, dt);
		return busy;
	}

	// the edge/overlay canvas redraws only while something is lit, growing or fading; scrolling an idle page costs only the layer transforms
	let drewLit = false;
	function overlayIfNeeded(t) {
		let any = edges.size > 0 || insts[0].length || insts[1].length;
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
	let painted = [-1, -1], unsub = null;
	if (dwell) unsub = dwell.sub((v) => {
		applyDwellOpacity();
		if (Math.abs(v.left - painted[0]) > 0.025 || Math.abs(v.right - painted[1]) > 0.025) { painted = [v.left, v.right]; if (all.length) drawLayers(performance.now() / 1000); }
	});
	if (DEBUG_SNARK) setTimeout(() => wake(), 700);
	const ro = new ResizeObserver(build);
	ro.observe(host);
	build();

	return () => {
		alive = false;
		unsub?.(); clearInterval(timer); clearTimeout(scrollT);
		cancelAnimationFrame(raf);
		ro.disconnect();
		removeEventListener("pointermove", onMove);
		document.documentElement.removeEventListener("pointerleave", onLeave);
		root.removeEventListener("scroll", onScroll);
		for (const L of LAYERS) L.canvas.remove();
		ov.remove();
	};
}
