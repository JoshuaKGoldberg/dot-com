// _hp/ac.js: #513-517, "aurora chroma" variants of #507 with side-style behaviour:
//  - the aurora backdrop rests desaturated (two precomputed versions, crossfaded; no ctx.filter) and floods with colour over ~3 s of hover; Josh stays full colour
//  - the chromatic halo rests very faint and swells with a dwell value (the _vs4 dwell: slow smoothstep up while hovered, just as slow back down)
//  - halo hues are the sides' vivid red / green / blue; graph delighters (hairline edges, tiny star nodes, depth-shaded, hues by angle from the cursor) grow
//    around his outline near the cursor, hold, then dissipate. Palette helpers are copied from _vs4/network.js (read only); graphs from _vs4/graphs.js.
import { mix, haloL } from "./layers.js";
import { aurora, ring, rgba } from "./kit.js";
import { hsl, smooth, clamp, rng } from "./hp.js";
import { contour } from "./fx-squiggle.js";
import { smallGraph, leadSpark, loadGoldberg, pickSnark } from "../_vs4/graphs.js";

const TAU = Math.PI * 2, BASE_HUE_RATE = 24;
// side palette: hue drifts toward blue with distance, saturation and lightness follow depth (network.js depthRgb)
export const depthRgb = (dark, hue, d) => { const far = 1 - d, dh = ((225 - hue + 540) % 360) - 180; return hsl((hue + dh * far * 0.5 + 360) % 360, ((dark ? 0.55 : 0.4) + d * 0.5) * 100, (dark ? 0.6 + d * 0.16 : 0.66 - d * 0.28) * 100); };
const rgbs = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const ease = (v) => v * v * (3 - 2 * v);

// aurora backdrop: two precomputed saturations crossfaded by S.satw (0 = rest, 1 = flooded)
export const auroraSat = ({ sat0 = 0.35, rest = 0.5, hover = 1, depth = -1.2, still = false } = {}) => (E, { par }) => {
	const a0 = aurora(E, { sat: sat0 }), a1 = aurora(E, { sat: 1 });
	const sky = (g, k) => { // navy sky pulled toward grey by (1 - k)
		const gr = g.createLinearGradient(0, E.o, 0, E.o + E.D), s = (c) => { const y = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2], q = sat0 + (1 - sat0) * k; return c.map((v) => (y + (v - y) * q) | 0); };
		const st = E.dark ? [[5, 10, 29], [11, 26, 58], [13, 42, 68]] : [[223, 232, 255], [236, 234, 255], [255, 233, 236]];
		gr.addColorStop(0, `rgb(${s(st[0])})`); gr.addColorStop(0.6, `rgb(${s(st[1])})`); gr.addColorStop(1, `rgb(${s(st[2])})`); g.fillStyle = gr; g.fillRect(E.o, E.o, E.D, E.D);
	};
	return {
		back(g, S) {
			g.save(); E.circle(g, 128); g.clip();
			const sc = still ? 1 : 1 + 0.1 * S.h * par, pq = par * S.pf; g.translate(E.c + S.px * depth * 6 * E.u * pq, E.c + S.py * depth * 4 * E.u * pq); g.scale(sc, sc); g.translate(-E.c, -E.c);
			sky(g, S.satw); const al = rest + (hover - rest) * (S.rm ?? S.h);
			const ph = 3 + (S.bp ?? S.c) * 1.15; a0.draw(g, ph, al * (1 - S.satw)); a1.draw(g, ph, al * S.satw);
			g.restore(); ring(E, g, 0.14 + 0.2 * S.satw);
		},
	};
};

const nearestContour = (C, x, y) => { let b = 0, bd = 1e9; for (let i = 0; i < C.N; i += 2) { const d = Math.hypot(C.x[i] - x, C.y[i] - y); if (d < bd) { bd = d; b = i; } } return b; };

// small random graphs (and, rarely, a Goldberg snark) growing out of the glow near the cursor
const graphsL = ({ gate = 0.1, every = 1.25, max = 4, snark = false, lead = false, scale = [17, 28] } = {}) => (E, { par }) => {
	const C = contour(E, 14), dk = E.dark, u = E.u; let items = [], nextAt = 0, snarkAt = 6, G5 = null, loading = false;
	const bfs = (g, root) => { const adj = g.verts.map(() => []); for (const [a, b] of g.edges) { adj[a].push(b); adj[b].push(a); } const dep = g.verts.map(() => -1); dep[root] = 0; const q = [root]; for (let i = 0; i < q.length; i++) for (const w of adj[q[i]]) if (dep[w] < 0) { dep[w] = dep[q[i]] + 1; q.push(w); } return dep.map((d) => (d < 0 ? 9 : d)); };
	const make = (S, cur, snk) => {
		const R = Math.random, i = nearestContour(C, cur.x, cur.y), j = Math.max(0, Math.min(C.N - 1, i + Math.round((R() - 0.5) * 30)));
		const s = snk ? 46 : scale[0] + R() * (scale[1] - scale[0]), off = (snk ? 30 : 18) + R() * 10, cx = C.x[j] + C.nx[j] * off, cy = C.y[j] + C.ny[j] * off, rot = R() * TAU, cr = Math.cos(rot), sr = Math.sin(rot);
		const src = snk ? G5 : smallGraph(R, ["tree", "cycle", "web", "tree", "web"][(R() * 5) | 0]), lay = snk ? src.layouts.rotational : src.layout;
		const verts = lay.map(([x, y, z = 0]) => ({ x: cx + (x * cr - y * sr) * s, y: cy + (x * sr + y * cr) * s, d: clamp(0.5 + z * 0.9) }));
		let root = 0, bd = 1e9; verts.forEach((v, k) => { const d = Math.hypot(v.x - cur.x, v.y - cur.y); if (d < bd) { bd = d; root = k; } });
		const g = { verts, edges: src.edges };
		return { g, dep: bfs(g, root), maxD: 0, root, t0: S.c, life: snk ? 8.5 : 5, cur: { ...cur }, snk, hue0: (Math.atan2(cy - cur.y, cx - cur.x) * 57.3 + 360) % 360, n: verts.length };
	};
	const drawItem = (g, S, it) => {
		const age = S.c - it.t0, grow = clamp(age / (it.snk ? 2.2 : 1.4)), out = 1 - smooth(it.life - 1.8, it.life, age), al = out * smooth(0, 0.15, age);
		if (al <= 0.01) return; const maxD = Math.max(...it.dep.filter((d) => d < 9)) + 1.2, gd = grow * maxD, V = it.g.verts;
		const pos = V.map((v) => [E.c + (v.x + S.px * (v.d - 0.5) * 9 * par) * u, E.c + (v.y + S.py * (v.d - 0.5) * 6 * par) * u]);
		const col = (v, k) => depthRgb(dk, (it.hue0 + Math.atan2(v.y - it.cur.y, v.x - it.cur.x) * 57.3 + S.c * BASE_HUE_RATE + 720) % 360, v.d);
		g.lineCap = "round";
		for (const [a, b] of it.g.edges) {
			const [lo, hi] = it.dep[a] <= it.dep[b] ? [a, b] : [b, a], pr = clamp(gd - it.dep[lo] - 0.1, 0, 1) * (it.dep[lo] === it.dep[hi] ? 0.6 : 1); if (pr < 0.01) continue;
			const m = (V[lo].d + V[hi].d) / 2, c = col(V[lo]); g.strokeStyle = rgbs(c, al * (dk ? 0.28 + m * 0.4 : 0.4 + m * 0.4)); g.lineWidth = Math.max(1, Math.round((0.6 + m * 0.5) * u));
			g.beginPath(); g.moveTo(pos[lo][0], pos[lo][1]); g.lineTo(pos[lo][0] + (pos[hi][0] - pos[lo][0]) * pr, pos[lo][1] + (pos[hi][1] - pos[lo][1]) * pr); g.stroke();
		}
		V.forEach((v, k) => {
			const kk = clamp(gd - it.dep[k] + 0.1, 0, 1); if (kk <= 0) return; const c = col(v), r = (0.5 + v.d * 1.1) * u * (it.snk ? 0.9 : 1) * (kk < 1 ? 0.5 + 0.6 * Math.sin(kk * 1.57) : 1);
			g.fillStyle = rgbs(c, al * 0.16 * kk); g.beginPath(); g.arc(pos[k][0], pos[k][1], r * 3, 0, TAU); g.fill();
			g.fillStyle = dk ? rgbs([240, 246, 255], al * (0.55 + 0.4 * v.d)) : rgbs(c, al * 0.9); g.beginPath(); g.arc(pos[k][0], pos[k][1], r, 0, TAU); g.fill();
			if (v.d > 0.7) { const L = r * 3.2; g.fillRect(pos[k][0] - L, pos[k][1] - 0.3 * u, 2 * L, 0.6 * u); g.fillRect(pos[k][0] - 0.3 * u, pos[k][1] - L, 0.6 * u, 2 * L); }
		});
		if (lead && age < 1.4) { const cp = [E.c + it.cur.x * u, E.c + it.cur.y * u]; leadSpark(g, cp[0], cp[1], pos[it.root][0], pos[it.root][1], clamp(age / 1.1), al * 0.9, depthRgb(dk, it.hue0, 0.7), dk); }
	};
	return {
		back(g, S) {
			const cur = { x: S.px * 128, y: S.py * 128 };
			if (S.hov && S.dw > gate && S.c >= nextAt && items.length < max) { items.push(make(S, cur, false)); nextAt = S.c + every * (1.2 - 0.5 * S.dw) + Math.random() * 0.6; }
			if (snark && S.hov && S.dw > 0.8) {
				if (!G5 && !loading) { loading = true; loadGoldberg().then((m) => { G5 = m?.GOLDBERG?.find?.((q) => q.id === "goldberg-snark-5") || null; }).catch(() => {}); }
				if (!G5 && !loading) loading = false;
				if (G5 && S.c >= snarkAt && !items.some((q) => q.snk)) { items.push(make(S, cur, true)); snarkAt = S.c + 14 + Math.random() * 8; }
			}
			items = items.filter((q) => S.c - q.t0 < q.life); for (const it of items) drawItem(g, S, it);
			S.anim = items.length > 0;
		},
	};
};

// constellation: star nodes with hairline edges in a band around the outline, blooming outward from the cursor as the dwell grows
export const constellationL = ({ count = 56, reach = 0.5, size = 1, alpha = 1, seed = 17, gap = 14, link = 36, lw = 0.6, a0 = 1, tint = false } = {}) => (E, { par }) => {
	const f = E.fld, n = f.n, F = f.F, M = f.m, r = rng(seed), dk = E.dark, u = E.u, nodes = [];
	for (let tries = 0; tries < 20000 && nodes.length < count; tries++) {
		const i = (r() * n) | 0, j = (r() * n) | 0, k = j * n + i, d = F[k], x = i + 0.5 - n / 2, y = j + 0.5 - n / 2;
		if (d < 8 || d > 52 || M[k] < 0.7 || (y > 90) || nodes.some((q) => Math.hypot(q.x - x, q.y - y) < gap)) continue;
		nodes.push({ x, y, d: r(), ph: r() * TAU, f: 0.6 + r() * 1.4, m: r() });
	}
	const edges = []; nodes.forEach((a, i) => { const nb = nodes.map((b, j) => [Math.hypot(a.x - b.x, a.y - b.y), j]).filter(([d, j]) => j !== i && d < link).sort((p, q) => p[0] - q[0]).slice(0, 2); for (const [, j] of nb) if (!edges.some(([p, q]) => (p === i && q === j) || (p === j && q === i))) edges.push([i, j]); });
	return {
		back(g, S) {
			const hv = ease(S.rm ?? S.h) * (a0 + (1 - a0) * S.dw); if (hv < 0.01) return; const cx = S.cx, cy = S.cy, R = (28 + 140 * reach * (0.25 + 0.75 * S.dw)) , vis = (a) => smooth(0, 1, (R - Math.hypot(a.x - cx, a.y - cy)) / 34) * hv;
			const col = (a) => depthRgb(dk, (Math.atan2(a.y - cy, a.x - cx) * 57.3 + 720 + S.c * BASE_HUE_RATE) % 360, 0.3 + a.d * 0.6);
			const pos = (a) => [E.c + (a.x + S.px * (a.d - 0.5) * 9 * par) * u, E.c + (a.y + S.py * (a.d - 0.5) * 6 * par) * u];
			g.lineWidth = Math.max(1, Math.round(lw * u)); g.lineCap = "round";
			for (const [i, j] of edges) { const a = nodes[i], b = nodes[j], k = Math.min(vis(a), vis(b)); if (k < 0.02) continue; const p = pos(a), q = pos(b); g.strokeStyle = rgbs(col(a), k * alpha * (dk ? 0.3 : 0.42)); g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke(); }
			for (const a of nodes) { const k = vis(a); if (k < 0.02) continue; const p = pos(a), tw = 0.6 + 0.4 * Math.sin(S.c * a.f * 2 + a.ph), rd = (0.5 + a.d * 1.1) * size * u * (0.8 + 0.3 * tw), c = col(a);
				g.fillStyle = rgbs(c, k * alpha * 0.16); g.beginPath(); g.arc(p[0], p[1], rd * 3.2, 0, TAU); g.fill();
				g.fillStyle = dk && !tint ? rgbs([240, 246, 255], k * alpha * (0.5 + 0.4 * tw)) : rgbs(c, k * alpha * (dk ? 0.8 : 0.9)); g.beginPath(); g.arc(p[0], p[1], rd, 0, TAU); g.fill();
				if (a.m > 0.6) { const L = rd * (2.6 + 1.5 * tw); g.fillRect(p[0] - L, p[1] - 0.3 * u, 2 * L, 0.6 * u); g.fillRect(p[0] - 0.3 * u, p[1] - L, 0.6 * u, 2 * L); } }
			S.anim = false;
		},
	};
};

// circuit traces with node pads routing outward from the outline toward the cursor
const circuitL = ({ count = 18, seed = 9 } = {}) => (E, { par }) => {
	const C = contour(E, 7), r = rng(seed), dk = E.dark, u = E.u, traces = [];
	for (let q = 0; q < count; q++) {
		const i = Math.floor(((q + r() * 0.8) / count) * C.N); if (i >= C.N || C.a[i] < 0.6) continue;
		let dx = Math.abs(C.nx[i]) > Math.abs(C.ny[i]) ? [Math.sign(C.nx[i]), 0] : [0, Math.sign(C.ny[i])], x = C.x[i], y = C.y[i]; const pts = [[x, y]]; let len = 0;
		for (let s = 0; s < 4; s++) {
			const L = 9 + r() * 15; x += dx[0] * L; y += dx[1] * L; pts.push([x, y]); len += L;
			const turn = r() < 0.35 ? Math.PI / 4 : Math.PI / 2, sg = r() < 0.5 ? -1 : 1, cs = Math.cos(turn * sg), sn = Math.sin(turn * sg); dx = [dx[0] * cs - dx[1] * sn, dx[0] * sn + dx[1] * cs];
			if (Math.hypot(x, y) > 190) break;
		}
		traces.push({ pts, len, d: r(), s0: pts[0] });
	}
	return {
		back(g, S) {
			const hv = ease(S.h); if (hv < 0.01) return; const cx = S.px * 128, cy = S.py * 128;
			g.lineCap = "round"; g.lineJoin = "round";
			for (const t of traces) {
				const prox = smooth(0, 1, (150 - Math.hypot(t.s0[0] - cx, t.s0[1] - cy)) / 90), prog = clamp(prox * (0.25 + 0.9 * S.dw) * hv * 1.4); if (prog < 0.02) continue;
				const sh = (t.d - 0.5), col = depthRgb(dk, (Math.atan2(t.s0[1] - cy, t.s0[0] - cx) * 57.3 + 720 + S.c * BASE_HUE_RATE) % 360, 0.35 + t.d * 0.55), px = (x) => E.c + (x + S.px * sh * 9 * par) * u, py = (y) => E.c + (y + S.py * sh * 6 * par) * u;
				let rem = t.len * prog; g.strokeStyle = rgbs(col, hv * (dk ? 0.5 : 0.6)); g.lineWidth = Math.max(1, Math.round(0.8 * u)); g.beginPath(); g.moveTo(px(t.pts[0][0]), py(t.pts[0][1]));
				let ex = t.pts[0][0], ey = t.pts[0][1], done = true;
				for (let k = 1; k < t.pts.length; k++) { const a = t.pts[k - 1], b = t.pts[k], sl = Math.hypot(b[0] - a[0], b[1] - a[1]); if (rem >= sl) { g.lineTo(px(b[0]), py(b[1])); rem -= sl; ex = b[0]; ey = b[1]; } else { ex = a[0] + ((b[0] - a[0]) * rem) / sl; ey = a[1] + ((b[1] - a[1]) * rem) / sl; g.lineTo(px(ex), py(ey)); done = false; break; } }
				g.stroke();
				// pads: a square at the silhouette, a ring at the head of the trace
				g.fillStyle = rgbs(col, hv * 0.7); g.fillRect(px(t.pts[0][0]) - u, py(t.pts[0][1]) - u, 2 * u, 2 * u);
				g.strokeStyle = rgbs(dk ? [235, 245, 255] : col, hv * (done ? 0.85 : 0.5)); g.lineWidth = Math.max(1, Math.round(0.7 * u)); g.beginPath(); g.arc(px(ex), py(ey), (done ? 1.9 : 1.1) * u, 0, TAU); g.stroke();
				if (done) { g.fillStyle = rgbs(col, hv * 0.6); g.beginPath(); g.arc(px(ex), py(ey), 0.7 * u, 0, TAU); g.fill(); }
			}
			S.anim = false;
		},
	};
};

const halo = (g0, up, extra = {}) => haloL({ rgb: true, raw: true, amp: (S) => 0.5 * (g0 + (1 - g0) * S.dw), ...extra });
const cfg = (up, layers, o = {}) => mix({ pad: 56, par: 0.6, dwell: { up, down: up }, ...o, layers });

// 513: dwell: ~40% saturation backdrop, glow 25% -> full over ~6 s, random graphs near the cursor
export const acDwell = cfg(6, [auroraSat({ sat0: 0.4 }), halo(0.25), graphsL({})]);
// 514: near-greyscale start, a very faint glow ramping over ~8 s, constellation star nodes
export const acGrey = cfg(8, [auroraSat({ sat0: 0.15 }), halo(0.07), constellationL({ count: 60, reach: 0.55 })]);
// 515: ~55% saturation, glow over ~5 s, circuit traces with node pads
export const acCircuit = cfg(5, [auroraSat({ sat0: 0.55 }), halo(0.18), circuitL({})]);
// 516: ~30% saturation, glow over ~7 s, small graphs plus a rare Goldberg snark after long hover, with leads from the cursor
export const acSnarks = cfg(7, [auroraSat({ sat0: 0.3 }), halo(0.2), graphsL({ snark: true, lead: true, gate: 0.12 })]);
// 517: the most restrained: ~35% saturation, glow from barely visible over ~10 s, sparse tiny star nodes
export const acSubtle = cfg(10, [auroraSat({ sat0: 0.35, rest: 0.42 }), halo(0.05, {}), constellationL({ count: 22, reach: 0.4, size: 0.8, alpha: 0.75, seed: 5 })]);

// 518: #517's backdrop, glow dwell and slow decay with #514's constellation, ~3x as many and smaller, starting very faint. Every motion runs on the shared clock, whose
// time-scale starts at 22% of #517's and creeps up to at most 50% over ~12 s of hover (and back down just as slowly after leave).
export const acStarfield = mix({ pad: 56, par: 0.6, dwell: { up: 10, down: 10, speedRamp: { from: 0.22, to: 0.5, up: 12 } }, backdrop: { delay: 1, up: 10, down: 10, cap: 0.5, parUp: 8 },
	layers: [auroraSat({ sat0: 0.35, rest: 0.42, still: true }), haloL({ raw: true, amp: (S) => 0.5 * (0.05 + 0.95 * S.dw), wheel: (E) => Array.from({ length: 360 }, (_, h) => depthRgb(E.dark, h, 0.8)) }), constellationL({ count: 170, reach: 0.6, size: 0.55, alpha: 0.8, seed: 23, gap: 8, link: 22, lw: 0.35, a0: 0.3, tint: true })] });
