// _vs4/network.js: the footer's star / circuit network, now in real 3D. Every node has a continuous z; positions are rotated by a slow
// yaw / pitch (only while dwelling, none in reduced motion) and projected with a gentle perspective around the footer centre, so edges
// between different depths run at varied angles. Edges are tapered ribbons (near end wide, far end thin) shaded brighter where nearer,
// dimmer and bluer with distance, with a soft core line on near edges. One 2D canvas, drawn only while the footer is on screen and
// something is changing. Edges near the cursor grow out in rainbow tint; elements carry a reveal threshold so more appears with dwell.
import { rng } from "../_dl-c/kit.js";
import { edgeList, layoutRot, label, smallGraph, pickSnark, loadGoldberg, goldbergReady, BASE_HUE_RATE, SNARK_HUE_RATE, leadSpark, easeBack, planRoute } from "./graphs.js";

const TEMPS = {
	dark: [[255, 255, 255], [214, 226, 255], [255, 245, 230], [255, 233, 200], [255, 214, 182]],
	light: [[28, 44, 112], [66, 56, 156], [8, 104, 116], [112, 38, 104], [186, 108, 16]], // deep inks
};
const WEIGHTS = [0.34, 0.24, 0.2, 0.14, 0.08];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const TAU = Math.PI * 2;
const F = 1300; // focal length (px): gentle perspective

// per mode. zr: half depth range (px); yaw / pitch: slow rotation amplitude (rad) at full dwell; ws: line width scale; planes: z layers (graph) or tilted boards (circuit)
const MODES = {
	sparse: { stars: 1 / 7500, pads: 1 / 52000, circles: 0, knn: 3, kd: 170, under: { pad: 0.5, star: 0 }, zr: 170, yaw: 0.06, pitch: 0.02, ws: 0.85, pulses: 2 },
	constellation: { stars: 1 / 2900, pads: 1 / 52000, circles: 0, knn: 3, kd: 190, under: { pad: 0.5, star: 0.3 }, zr: 520, yaw: 0.14, pitch: 0.05, ws: 1.05, pulses: 3 },
	graph: { stars: 1 / 2900, pads: 0, circles: 0, knn: 0, kd: 0, under: {}, zr: 430, yaw: 0.2, pitch: 0.045, ws: 1, drift: true, planes: [-1, -0.33, 0.33, 1], pulses: 3 },
	circuit: { stars: 1 / 9000, pads: 1 / 6800, circles: 0, knn: 3, kd: 200, under: { pad: 0.85, star: 0 }, zr: 330, yaw: 0.1, pitch: 0.035, ws: 1.1, pulses: 14,
		boards: [{ z0: -0.6, tx: 0.42, ty: 0.55 }, { z0: 0, tx: -0.5, ty: 0.36 }, { z0: 0.6, tx: 0.2, ty: -0.62 }] },
	mix: { stars: 1 / 2700, pads: 1 / 15000, circles: 1 / 60000, knn: 3, kd: 160, under: { pad: 0.7, star: 0.22 }, zr: 560, yaw: 0.15, pitch: 0.06, ws: 1.3, pulses: 6 },
};

export function footNetwork(host, { mode = "sparse", seed = 1, dark, reduced, nearBoost = false }) {
	const M = MODES[mode];
	const ZS = M.zr * 1.3 + 160; // depth span used to normalise d (0 far .. 1 near)
	const cv = document.createElement("canvas");
	cv.setAttribute("aria-hidden", "true");
	cv.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;display:block;pointer-events:none;will-change:opacity;";
	host.append(cv);
	const g = cv.getContext("2d");
	const temps = TEMPS[dark ? "dark" : "light"];
	let intro = 0, W = 0, H = 0, dpr = 1, nodes = [], edges = new Map(), pulses = [], avoid = null, dirty = true, lastV = -1, lastScroll = 1e9, lastDrift = 0, T = 0, lastPose = "";
	const cam = { cx: 0, cy: 0, cosY: 1, sinY: 0, cosP: 1, sinP: 0, gx: 0, gy: 0, sy: 0, tgx: 0, tgy: 0 };
	const hslRgb = (h, sat, l) => {
		const f = (n) => { const k = (n + h / 30) % 12; return l - sat * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
		return [f(0) * 255, f(8) * 255, f(4) * 255];
	};
	// depth d: 1 near .. 0 far. Hue drifts toward blue and saturation / lightness drop with distance (atmospheric falloff)
	const depthRgb = (hue, d) => {
		const far = 1 - d, dh = ((225 - hue + 540) % 360) - 180;
		return hslRgb((hue + dh * far * 0.5 + 360) % 360, (dark ? 0.55 : 0.4) + d * 0.5, dark ? 0.6 + d * 0.16 : 0.66 - d * 0.28).map((v) => v | 0);
	};
	// horizontal slowness: 2x in the middle sixth, 1.5x at its rim, 1x at the edges (smooth). A column's effective dwell is 1-(1-v)^(1/m).
	const sm = (a, b, q) => smooth(a, b, q);
	const mX = (x) => { const d = Math.abs(x / (W || 1) - 0.5); return d < 1 / 12 ? 2 : d < 0.25 ? 2 - 0.5 * sm(1 / 12, 0.25, d) : 1.5 - 0.5 * sm(0.25, 0.5, d); };
	let curV = 0, netRest = 0.2;
	const Dx = (x) => 1 - Math.pow(Math.max(0, 1 - curV), 1 / mX(x));
	const lvl = (x) => netRest + (1 - netRest) * Dx(x);
	const thin = (x, y) => avoid ? 1 - 0.93 * Math.exp(-(((x - avoid.cx) / avoid.rx) ** 2) - (((y - avoid.cy) / avoid.ry) ** 2)) : 1;
	// leads, routes and gap edges must respect the credit clear zone: a segment that passes through the avoid ellipse is rejected
	const crosses = (x0, y0, x1, y1) => { for (let i = 0; i <= 14; i++) { const t = i / 14; if (thin(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t) < 0.6) return true; } return false; };
	const env = (y) => 0.25 + 0.75 * smooth(0, 0.45, y / H);
	function route(x1, y1, x2, y2) {
		const dx = x2 - x1, dy = y2 - y1, ax = Math.abs(dx), ay = Math.abs(dy), m = Math.min(ax, ay);
		if (m < 3) return [[x1, y1], [x2, y2]];
		const sx = Math.sign(dx), sy = Math.sign(dy);
		return [[x1, y1], ax > ay ? [x1 + sx * (ax - m), y1] : [x1, y1 + sy * (ay - m)], [x2, y2]];
	}
	const pickTemp = (r) => { let u = r(); for (let i = 0; i < WEIGHTS.length; i++) if ((u -= WEIGHTS[i]) <= 0) return i; return 0; };
	// world point (footer px, z in px; +z is away) -> screen point [x, y, scale, depth]
	function proj(x, y, Z) {
		const X = x - cam.cx, Y = y - cam.cy;
		const X1 = X * cam.cosY + Z * cam.sinY, Z1 = -X * cam.sinY + Z * cam.cosY;
		const Y1 = Y * cam.cosP - Z1 * cam.sinP, Z2 = Y * cam.sinP + Z1 * cam.cosP;
		const s = F / (F + Z2), d = clamp(0.5 - Z2 / (2 * ZS));
		const pm = 4 + d * 26;
		return [cam.cx + X1 * s - cam.gx * pm, cam.cy + Y1 * s - cam.gy * pm * 0.6 + cam.sy * (0.02 + d * 0.2), s, d];
	}
	const wOf = (p) => (0.3 + 2.4 * p[3] * p[3]) * p[2] * M.ws;
	// edge polyline in world space (z interpolated along its length), cached for static layouts
	function worldPts(e) {
		const a = e.a, b = e.b;
		const ax = a.dx ?? a.x, ay = a.dy ?? a.y, bx = b.dx ?? b.x, by = b.dy ?? b.y;
		let r = e.circuit ? route(ax, ay, bx, by) : [[ax, ay], [bx, by]];
		if (e.bulge) { // repeated multigraph edges: slightly offset parallel curves
			const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
			r = []; for (let i = 0; i <= 8; i++) { const t = i / 8, o = Math.sin(t * Math.PI) * e.bulge; r.push([ax + dx * t + nx * o, ay + dy * t + ny * o]); }
		}
		let tot = 0; const cum = [0];
		for (let i = 1; i < r.length; i++) { tot += Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1]); cum.push(tot); }
		return r.map((p, i) => [p[0], p[1], a.Z + (b.Z - a.Z) * (tot ? cum[i] / tot : i)]);
	}
	// the drawn part of an edge: from its source (the end nearer the seed) to the growth front
	const partial = (e) => { const pp = edgePts(e); if (e.flip) pp.reverse(); return cut(pp, e.rev); };
	const edgePts = (e) => { if (M.drift || e.dyn || !e.wp) e.wp = worldPts(e); return e.wp.map((p) => proj(p[0], p[1], p[2])); };
	const plen = (pp) => { let t = 0; for (let i = 1; i < pp.length; i++) t += Math.hypot(pp[i][0] - pp[i - 1][0], pp[i][1] - pp[i - 1][1]); return t; };
	function cut(pp, frac) {
		if (frac >= 0.999) return pp;
		const lim = plen(pp) * frac, out = [pp[0]]; let acc = 0;
		for (let i = 1; i < pp.length; i++) {
			const sl = Math.hypot(pp[i][0] - pp[i - 1][0], pp[i][1] - pp[i - 1][1]);
			if (acc + sl <= lim) { out.push(pp[i]); acc += sl; continue; }
			const u = sl ? (lim - acc) / sl : 0, a = pp[i - 1], b = pp[i];
			out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u, a[3] + (b[3] - a[3]) * u]);
			break;
		}
		return out;
	}
	// a tapered ribbon along a polyline (width from each point's own depth), as one path of quads
	function ribbonPath(pp, wmul = 1) {
		g.beginPath();
		for (let i = 1; i < pp.length; i++) {
			const a = pp[i - 1], b = pp[i], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
			const nx = -dy / l, ny = dx / l, wa = wOf(a) * wmul * 0.5, wb = wOf(b) * wmul * 0.5;
			g.moveTo(a[0] + nx * wa, a[1] + ny * wa); g.lineTo(b[0] + nx * wb, b[1] + ny * wb);
			g.lineTo(b[0] - nx * wb, b[1] - ny * wb); g.lineTo(a[0] - nx * wa, a[1] - ny * wa); g.closePath();
		}
	}

	// ---- the living mix ----
	// Small random graphs (trees, cycles, k-nearest webs) are the dominant texture, spawning at random spots and times. Now and then a featured
	// snark (Goldberg's snarks prominent) grows, sprouts thin secondary lines, holds a while and dissipates. Every graph has a lifecycle:
	// grow edge by edge, hold, dissipate from the outside in. Spawning follows the footer's dwell; when it falls everything dissipates.
	// small = max concurrent small graphs, rate = spawns/s at full dwell, snark = max concurrent snarks, mean = average seconds between snark spawns
	const SPAWN = {
		sparse: { small: 3, rate: 0.053, snark: 1, mean: 105, maxK: 7, sizes: [26, 54] },
		constellation: { small: 6, rate: 0.12, snark: 1, mean: 105, maxK: 9, sizes: [24, 52] },
		graph: { small: 5, rate: 0.107, snark: 1, mean: 105, maxK: 11, sizes: [26, 56] },
		circuit: { small: 5, rate: 0.107, snark: 1, mean: 105, maxK: 9, sizes: [26, 56] },
		mix: { small: 8, rate: 0.147, snark: 1, mean: 105, maxK: 15, sizes: [24, 56] },
	}[mode];
	const GROW = 0.22, RET = 0.3, EDGE_CAP = 380;
	// nearBoost (gd-bloom): graphs spawn denser and brighter the closer they are to the live cursor (about 2x density / 1.8x brightness at the cursor, easing to 1x by ~250px)
	let psx = 0, psy = 0, nbk = 0, hadPs = false;
	const cdist = (x, y) => Math.hypot(x - psx, y - psy);
	const near = (x, y) => (nbk < 0.01 ? 0 : nbk * smooth(0, 1, 1 - cdist(x, y) / 200));
	const farK = (x, y) => (nbk < 0.01 ? 0 : nbk * smooth(200, 320, cdist(x, y)));
	const bst = (x, y) => (nearBoost ? 1 + 1.4 * near(x, y) - 0.25 * farK(x, y) : 1); // ~2.4x at the cursor, 1x by 200px, 0.75x beyond ~320px
	const bw = (x, y) => (nearBoost ? 1 - 0.35 * farK(x, y) + 0.2 * near(x, y) : 1);
	let staticProg = 0, insts = [], spawnAcc = 0, dwellT = 0, snarkAt = 22, snarkNext = 0, snarkLog = [], nid = 0, eid = 0, instN = 0, gset = 1;
	const R_ = Math.random;
	function mk(o) {
		const rb = R_(), m = clamp(rb * 0.7 + R_() * 0.3);
		const nd = { id: nid++, kind: "star", rb, m, t: pickTemp(R_), ph: R_() * TAU, f: 0.5 + R_() * 1.5, th: R_() < 0.55 ? R_() * 0.75 : 0, k: 0, hue: 0, px: o.x, py: o.y, s: 1, d: 0.5, w: 1, vx: 0, vy: 0, sw: 0, vis: 0, ...o };
		nodes.push(nd); return nd;
	}
	// edge-by-edge growth order: BFS depth from a seed vertex; an edge starts when the graph's progress reaches its order
	function setSeed(I, s) {
		I.seed = s;
		const dist = I.vs.map(() => -1); dist[s] = 0;
		for (const q = [s]; q.length;) { const u = q.shift(); for (const w of I.adj[u]) if (dist[w] < 0) { dist[w] = dist[u] + 1; q.push(w); } }
		let mx = 1; for (const d of dist) mx = Math.max(mx, d);
		for (const e of I.prim) { const da = dist[e.ia] < 0 ? 0 : dist[e.ia], db = dist[e.ib] < 0 ? 0 : dist[e.ib]; e.flip = db < da; e.o = (Math.min(da, db) + e.j * 0.7) / (mx + 0.7); e.src = e.flip ? e.b : e.a; e.dst = e.flip ? e.a : e.b; }
	}
	// spark route (footer): from the cursor, hop along existing visible nodes / edges in the footer's 3D space (projected positions), adding short gap edges where needed
	function planFooterRoute(I, p) {
		const sv = I.vs[I.seed], T = proj(sv.x, sv.y, sv.Z), Tp = { x: T[0], y: T[1] };
		const nodes = [], refs = [], idx = new Map();
		const keep = (x, y) => Math.hypot(x - p.x, y - p.y) <= 260 || Math.hypot(x - Tp.x, y - Tp.y) <= 260;
		const add = (nd) => { if (idx.has(nd) || nodes.length > 110) return; const q = proj(nd.x, nd.y, nd.Z); if (!keep(q[0], q[1])) return; idx.set(nd, nodes.length); nodes.push({ x: q[0], y: q[1] }); refs.push(nd); };
		for (const O of insts) for (const v of O.vs) if (!v.vis || v.vis > 0.3) if (v.vis > 0.3) add(v);
		const real = [];
		for (const e of edges.values()) { if (e.rev < 0.5 || e.inst === I) continue; if (e.static) { add(e.a); add(e.b); } const a = idx.get(e.a), b = idx.get(e.b); if (a !== undefined && b !== undefined) real.push([a, b]); }
		const path = planRoute(nodes, real, { x: p.x, y: p.y }, Tp, { blocked: crosses });
		return path ? path.map((q) => ({ ref: q.i >= 0 ? refs[q.i] : null, kind: q.i === -1 ? "origin" : q.i === -2 ? "target" : "node", gap: q.gap })) : null;
	}
	function addEdge(I, a, b, o) {
		const e = { id: eid++, a, b, src: a, dst: b, inst: I, circuit: false, base: I.base, g: 0, w: 1, bulge: 0, rev: 0, ret: 0, o, flip: false, j: R_(), sec: true };
		edges.set(e.id, e); I.es.push(e); return e;
	}
	// secondary lines: thinner, fainter edges that branch out from some of a snark's vertices, sometimes to a nearby star, sometimes as short tendrils
	function addSecondary(I, seedXY) {
		const n = I.vs.length, picks = new Set();
		const want = Math.max(3, Math.round(n * 0.32));
		for (let guard = 0; picks.size < want && guard < 60; guard++) picks.add((R_() * n) | 0);
		const stars = nodes.filter((s) => !s.inst && s.kind === "star");
		let oi = 0;
		for (const vi of picks) {
			const v = I.vs[vi], o0 = 1.0 + (oi++ % 6) * 0.05;
			if (R_() < 0.45) { // link to the nearest free star
				let best = null, bd = I.s * 0.9 + 30;
				for (const s of stars) { const d = Math.hypot(s.x - v.x, s.y - v.y); if (d > 14 && d < bd) { bd = d; best = s; } }
				if (best) { addEdge(I, v, best, o0); continue; }
			}
			// tendril: 2-3 segments heading outward, sometimes forking once
			const out = Math.atan2(v.y - I.cy, v.x - I.cx);
			let prev = v, an = out + (R_() - 0.5) * 0.9, mid = null;
			const segs = 2 + ((R_() * 2) | 0);
			for (let k = 0; k < segs; k++) {
				const len = 14 + R_() * 18; an += (R_() - 0.5) * 0.8;
				const x = prev.x + Math.cos(an) * len, y = prev.y + Math.sin(an) * len;
				const tip = mk({ kind: "tip", x, y, x0: x, Z: prev.Z + (R_() - 0.5) * 30, rb: 0.15, m: 0.4, inst: I, gi: I.n, dd: [Math.cos(an), Math.sin(an)] });
				I.tips.push(tip); { const te = addEdge(I, prev, tip, o0 + k * 0.12); if (k === 0 && seedXY && !reduced && Math.hypot(v.x - seedXY[0], v.y - seedXY[1]) <= 240 && !crosses(seedXY[0], seedXY[1], v.x, v.y)) te.lead = seedXY.slice(); } if (k === 1) mid = tip; prev = tip;
			}
			if (mid && R_() < 0.4) {
				const an2 = out + (R_() < 0.5 ? 1 : -1) * (0.6 + R_() * 0.6), len = 12 + R_() * 14;
				const x = mid.x + Math.cos(an2) * len, y = mid.y + Math.sin(an2) * len;
				const tip = mk({ kind: "tip", x, y, x0: x, Z: mid.Z, rb: 0.15, m: 0.4, inst: I, gi: I.n, dd: [Math.cos(an2), Math.sin(an2)] });
				I.tips.push(tip); addEdge(I, mid, tip, o0 + 0.4);
			}
		}
	}
	function makeInst(kind, g, cx, cy, s, seedXY) {
		const snark = kind === "snark", circuit = mode === "circuit";
		const lay = layoutRot(g, (R_() - 0.5) * 0.9, (R_() - 0.5) * 0.6);
		const I = { kind, g, cx, cy, s, slow: 2 + R_() * 2, /* everything that shoots out for this spawn runs 2-4x slower, coherently */ n: ++instN, vs: [], tips: [], adj: g.layout.map(() => []), es: [], prim: [], seed: 0, prog: 0, phase: "grow", diss: 0, cap: 0, full: 0, base: { sparse: 0.55, constellation: 0.5, graph: 0.62, circuit: 0.85, mix: 0.62 }[mode] * (snark ? 1 : 0.9), z: 0 };
		let Z0 = (R_() - 0.5) * 1.7 * M.zr, board = -1, plane = -1;
		if (M.planes) { plane = (R_() * M.planes.length) | 0; Z0 = M.planes[plane] * M.zr; }
		I.z = Z0;
		const zs = snark ? (g.ring3d ? 1.2 : 0.45) : 0.9; // ring3d's strong z is mapped into the depth range so it reads as 3D
		I.vs = lay.map(([lx, ly, lz]) => {
			const x = cx + lx * s, y = cy - ly * s * 0.92;
			let Z = Z0 + lz * zs * M.zr * 0.35;
			if (M.boards) { if (board < 0) board = (R_() * M.boards.length) | 0; const b = M.boards[board]; Z = b.z0 * M.zr + b.tx * (x - W / 2) + b.ty * (y - H / 2) + lz * 24; }
			const nd = mk({ kind: circuit || (snark && mode === "mix" && g.n > 40) ? "pad" : "star", x, y, x0: x, Z, inst: I, gi: I.n, plane, board, rb: 0.55 + R_() * 0.45, m: 0.55 + R_() * 0.4, dd: [Math.cos(R_() * TAU), Math.sin(R_() * TAU)] });
			if (nd.kind === "pad") nd.pr = 4.4 + R_() * 2;
			return nd;
		});
		for (const e of edgeList(g)) {
			const a = I.vs[e.a], b = I.vs[e.b];
			const eo = { id: eid++, a, b, src: a, dst: b, inst: I, ia: e.a, ib: e.b, circuit: circuit || (!snark && mode === "circuit"), base: I.base, g: 0, w: 1, bulge: e.c > 1 ? (e.i - (e.c - 1) / 2) * 15 : 0, rev: 0, ret: 0, o: 0, flip: false, j: R_(), sec: false };
			edges.set(eo.id, eo); I.es.push(eo); I.prim.push(eo); I.adj[e.a].push(e.b); I.adj[e.b].push(e.a);
		}
		let si = 0, bd = 1e9; // seed: the vertex nearest the cursor if it is near, else the most central one
		I.vs.forEach((v, i) => { const d = seedXY ? Math.hypot(v.x - seedXY[0], v.y - seedXY[1]) : Math.hypot(v.x - cx, v.y - cy); if (d < bd) { bd = d; si = i; } });
		setSeed(I, si);
		I.age = 0; I.origin = !reduced && seedXY && bd <= 240 ? seedXY.slice() : null;
		const straightBad = I.origin && crosses(I.origin[0], I.origin[1], I.vs[si].x, I.vs[si].y);
		if (I.origin && !reduced && R_() < 0.75) { // ~75% of leads travel along the existing network
			const route = planFooterRoute(I, { x: seedXY[0], y: seedXY[1] });
			if (route) {
				const hop = 0.17 * I.slow; I.leadPath = { seq: route, hop }; I.startDelay = (route.length - 1) * hop; const sv = I.vs[I.seed]; let anchor = null;
				const nodeFor = (it) => it.kind === "target" ? sv : it.kind === "origin" ? (anchor ||= (() => { const an = mk({ kind: "star", x: seedXY[0], y: seedXY[1], x0: seedXY[0], Z: sv.Z, rb: 0.4, m: 0.5, inst: I, gi: I.n, dd: [0, 0] }); I.tips.push(an); return an; })()) : it.ref;
				for (let k = 1; k < route.length; k++) if (route[k].gap && R_() < 0.5) { const te = addEdge(I, nodeFor(route[k - 1]), nodeFor(route[k]), 0.1); te.t0 = (k - 1) * hop; te.link = true; route[k].persist = true; }
			}
		} // the graph grows out from the cursor point where it spawned: a fading lead hairline to its nearest vertex
		if (!I.leadPath && straightBad) I.origin = null; // a straight lead that would cross the credit is skipped
		if (snark) addSecondary(I, seedXY);
		I.omax = Math.max(...I.es.map((e) => e.o), 0.5);
		I.pmax = (I.omax + GROW) / (1 + GROW);
		I.growDur = (snark ? 2 * (7 + g.n * 0.08) : 5 * (3 + g.n * 0.35)) * I.pmax; // small graphs grow 5x more slowly
		I.growDur *= I.slow; I.holdT = snark ? 8 + R_() * 12 : 3 + R_() * 7;
		I.dissDur = snark ? 5.5 : 3.2;
		I.leaveAt = 0.03 + R_() * 0.4;
		insts.push(I);
		return I;
	}
	const edgeCount = () => { let n = 0; for (const I of insts) n += I.es.length; return n; };
	function place(sz, p, pn) {
		for (let k = 0; k < 14; k++) {
			let x = W * (0.04 + R_() * 0.92), y = H * (0.07 + R_() * 0.88);
			if (pn && R_() < (nearBoost ? 0.9 : 0.7)) { const an = R_() * TAU, d = nearBoost ? 30 + R_() * R_() * 190 : 40 + R_() * 160; x = clamp(p.x + Math.cos(an) * d, W * 0.03, W * 0.97); y = clamp(p.y + Math.sin(an) * d, H * 0.06, H * 0.95); } // bias toward the cursor's neighbourhood: short leads
			if (R_() > env(y) * thin(x, y) * (0.35 + 0.65 * Dx(x))) continue;
			if (insts.some((I) => Math.hypot(I.cx - x, I.cy - y) < I.s + sz * 0.9 + 14)) continue;
			if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ux, uy]) => thin(x + ux * sz, y + uy * sz) < 0.8) || thin(x, y) < 0.9) continue; // keep clear of the credit text
			return [x, y];
		}
		return null;
	}
	function spawnSmall(p, pn) {
		if (insts.filter((I) => I.kind === "small").length >= SPAWN.small + (nearBoost ? 3 : 0) || edgeCount() > EDGE_CAP + (nearBoost ? 60 : 0)) return;
		const sz = SPAWN.sizes[0] + R_() * (SPAWN.sizes[1] - SPAWN.sizes[0]), pos = place(sz, p, pn);
		const dn = pos && pn ? Math.hypot(pos[0] - p.x, pos[1] - p.y) : 999, extra = nearBoost ? Math.round((1 - clamp(dn / 250)) * 3 * R_()) : 0; // denser graphs nearer the cursor
		if (pos) makeInst("small", smallGraph(R_, undefined, extra), pos[0], pos[1], sz, pn ? [p.x, p.y] : null);
	}
	function spawnSnark(p, pn) {
		if (insts.filter((I) => I.kind === "snark").length >= SPAWN.snark || edgeCount() > EDGE_CAP - 120) return false;
		if (!goldbergReady()) { loadGoldberg(); return false; } // the 256 KB snark data loads lazily, only once a snark is about to spawn
		const g = pickSnark(R_, { maxK: SPAWN.maxK }); if (!g) return false; const sz = clamp(56 + g.n * 1.8, 80, 190), pos = place(sz, p, pn);
		if (!pos) return false;
		makeInst("snark", g, pos[0], pos[1], sz, pn ? [p.x, p.y] : null);
		return true;
	}
	function removeInst(I) {
		for (const e of I.es) { edges.delete(e.id); e.dead = true; }
		nodes = nodes.filter((n) => n.inst !== I);
		insts.splice(insts.indexOf(I), 1);
	}

	function build(w, h, av) {
		intro = 0;
		W = w; H = h; avoid = av; dpr = Math.min(1.5, devicePixelRatio || 1);
		cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
		cam.cx = W / 2; cam.cy = H * 0.55;
		nodes = []; edges = new Map(); pulses = []; insts = []; spawnAcc = 0; dwellT = 0; snarkAt = (35 + Math.random() * 10) / 3; snarkNext = 0;
		const r = rng(seed * 131 + 7), SX = 1.28, SY = 1.12;
		// ambient stars: plain dots; their nearest neighbours are joined by edges that only the cursor (and, in dense modes, a faint underlay) shows
		const add = (kind, count) => {
			const n = Math.round(W * H * SX * SY * count);
			for (let i = 0; i < n; i++) {
				const x = W / 2 + (r() - 0.5) * W * SX, y = H / 2 + (r() - 0.5) * H * SY;
				if (r() > env(y) * thin(x, y)) continue;
				if (kind === "circ" && (thin(x, y) < 0.95 || [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ux, uy]) => thin(x + ux * 40, y + uy * 40) < 0.85))) continue; // rings (radius up to ~30px) stay clear of the credit
				const nd = mk({ kind, x, y, x0: x, Z: (r() - 0.5) * 2 * M.zr });
				if (kind === "circ") { nd.th = r() * 0.5; nd.pr = 13 + r() * 14; nd.nt = 6 + ((r() * 8) | 0); nd.rot = r() * TAU; }
				else if (M.drift) { const a = r() * TAU, sp = 6 + r() * 8; nd.vx = Math.cos(a) * sp; nd.vy = Math.sin(a) * sp * 0.6; }
			}
		};
		add("star", M.stars * 0.8); if (M.circles) add("circ", M.circles);
		const stars = nodes.filter((n) => n.kind === "star"), key = new Set();
		for (const a of stars) {
			const near = stars.filter((b) => b !== a).map((b) => [Math.hypot(a.x - b.x, a.y - b.y, (a.Z - b.Z) * 0.4), b]).filter((q) => q[0] < Math.min(M.kd, 80)).sort((p, q) => p[0] - q[0]).slice(0, 3);
			for (const [d, b] of near) {
				const k = Math.min(a.id, b.id) * 65536 + Math.max(a.id, b.id);
				if (key.has(k)) continue; key.add(k);
				if (R_() > 1 / 3) continue; // a third of the ambient links
				const e = { id: eid++, a, b, src: a, dst: b, circuit: mode === "circuit" && !M.drift, base: (M.under.star || 0) * 0.6 * (1 - 0.35 * d / M.kd), g: 0, w: 1, bulge: 0, rev: 0, sj: R_(), ret: 0, o: 0, flip: false, static: true, th: Math.max(a.th, b.th) };
				edges.set(e.id, e);
			}
		}
		if (reduced) { // reduced motion: a static, sparse composition
			for (let i = 0; i < 4; i++) spawnSmall({ x: 0, y: 0 }, false);
			if (spawnSnark({ x: 0, y: 0 }, false)) { /* one featured snark */ }
			for (const I of insts) { I.prog = I.pmax; I.phase = "static"; }
		}
		dirty = true;
	}

	function pose(v, p, top) {
		const amp = reduced ? 0 : smooth(0, 0.6, v);
		cam.cosY = Math.cos(M.yaw * amp * Math.sin(T * 0.11 + seed)); cam.sinY = Math.sin(M.yaw * amp * Math.sin(T * 0.11 + seed));
		const pt = M.pitch * amp * Math.sin(T * 0.083 + seed * 2);
		cam.cosP = Math.cos(pt); cam.sinP = Math.sin(pt);
	}

	// p: pointer in footer coordinates ({x,y,has}); v: footer dwell 0..1; top: the footer's top in viewport px (for scroll parallax)
	function draw(dt, p, v, top, flow = 0) {
		if (!W) return false;
		T += dt; curV = reduced ? v : v;
		pose(v, p, top);
		let moving = !reduced && v > 0.02;
		const R = 200, pn = p.has && p.y > -R && p.y < H + R;
		if (nearBoost) { if (pn) { if (!hadPs) { psx = p.x; psy = p.y; hadPs = true; } else { const a = 1 - Math.exp(-dt * 6); psx += (p.x - psx) * a; psy += (p.y - psy) * a; } } nbk += ((pn && !reduced ? 1 : 0) - nbk) * (1 - Math.exp(-dt * 3)); if (nbk > 0.01) dirty = true; }
		if (!reduced) {
			cam.tgx = pn ? ((p.x / W) - 0.5) * 2 : 0; cam.tgy = pn ? ((p.y / H) - 0.5) * 2 : 0;
			const a = 1 - Math.exp(-dt * 3);
			const ngx = cam.gx + (cam.tgx - cam.gx) * a, ngy = cam.gy + (cam.tgy - cam.gy) * a;
			if (Math.abs(ngx - cam.gx) > 0.0005 || Math.abs(ngy - cam.gy) > 0.0005) moving = true;
			cam.gx = ngx; cam.gy = ngy; cam.sy = (top - innerHeight * 0.4) * 0.5;
		}
		if (M.drift && !reduced && v > 0.02) {
			for (const n of nodes) {
				if (n.sw) { n.x = n.x0 + Math.sin(T * 0.07 + n.gph) * n.sw; continue; }
				n.x += n.vx * dt * (1 + flow); n.y += n.vy * dt * (1 + flow);
				if (n.x < -W * 0.14) n.x = W * 1.14; else if (n.x > W * 1.14) n.x = -W * 0.14;
				if (n.y < -H * 0.06) n.y = H * 1.06; else if (n.y > H * 1.06) n.y = -H * 0.06;
			}
			moving = true;
		}
		let lit = false;
		for (const n of nodes) {
			const q = proj(n.dx ?? n.x, n.dy ?? n.y, n.Z);
			n.px = q[0]; n.py = q[1]; n.s = q[2]; n.d = q[3];
			n.w = thin(n.px, n.py);
			let tg = 0;
			if (pn) { const dd = Math.hypot(n.px - p.x, n.py - p.y); if (dd < R) tg = smooth(0, 1, 1 - dd / R); n.hue = ((Math.atan2(n.py - p.y, n.px - p.x) / TAU) * 360 + 360 + n.px * 0.1 + T * BASE_HUE_RATE) % 360; }
			n.k += (tg - n.k) * (1 - Math.exp(-dt * (tg > n.k ? 2 / mX(n.px) : 0.9)));
			if (n.k < 0.004 && tg === 0) n.k = 0; else lit = true;
		}
		const scrollMoved = Math.abs(top - lastScroll) > 0.5; lastScroll = top;
		const vMoved = Math.abs(v - lastV) > 0.003; lastV = v;
		let busy = false;
		intro = Math.min(1, intro + dt * 0.4); // everything fades in on the first frames, so nothing pops when the footer scrolls into view
		// lifecycle: spawn while the footer is being dwelled on; each graph grows, holds, then dissipates (outside in); everything dissipates as dwell falls
		if (!reduced && W) {
			spawnAcc += dt * SPAWN.rate * (nearBoost && pn ? 1.5 : 1) * smooth(0.04, 0.45, v);
			while (spawnAcc >= 1) { spawnAcc -= 1; spawnSmall(p, pn); }
			// snarks: a rare delighter. Not until 10 s later than they used to appear, measured as continuous dwell in the footer; then roughly one per minute at most
			if (v < 0.1) { dwellT = 0; snarkAt = (35 + Math.random() * 10) / 3; snarkNext = 0; }
			else { dwellT += dt; if (dwellT > 2 && !goldbergReady()) (window.requestIdleCallback || setTimeout)(() => loadGoldberg()); // prefetch on idle once the dwell has started
			 if (v > 0.3 && dwellT >= snarkAt && dwellT >= snarkNext) { if (spawnSnark(p, pn)) { snarkNext = dwellT + SPAWN.mean * (0.86 + Math.random() * 0.28) / 3; snarkLog.push(+dwellT.toFixed(1)); } else snarkNext = dwellT + 2; } }
		}
		// the ambient underlay appears 5x more slowly than the rest: its own slow integrator of the footer's dwell
		staticProg = reduced ? v : clamp(staticProg + (v > 0.1 ? dt / 60 : -dt / 30), 0, 1);
		for (const n of nodes) if (n.inst) n.vis = 0;
		for (const I of insts.slice()) {
			const dxv = Dx(I.cx), sl = mX(I.cx);
			I.age += dt;
			if (!reduced) {
				if (I.phase === "grow") { if (I.age >= (I.startDelay || 0)) I.prog += dt * (0.4 + 0.6 * dxv) / (I.growDur * sl); if (I.prog >= I.pmax) { I.prog = I.pmax; I.phase = "hold"; } }
				else if (I.phase === "hold") { I.holdT -= dt; if (I.holdT <= 0) I.phase = "diss"; }
				if (I.phase !== "diss" && dxv < I.leaveAt) I.phase = "diss";
				if (I.phase === "diss") { I.diss += dt / I.dissDur; if (I.diss >= 1) { removeInst(I); dirty = true; continue; } }
			}
			busy = true;
			let tot = 0;
			for (const e of I.es) {
				const q = clamp((I.prog * (1 + GROW) - e.o) / GROW), gq = e.t0 !== undefined ? clamp((I.age - e.t0) / (0.35 * I.slow)) : q * q * (3 - 2 * q);
				const rr = clamp((I.diss * (1 + RET) - (1 - e.o / I.omax)) / RET), rs = rr * rr * (3 - 2 * rr);
				e.rev = gq * (1 - rs); e.ret = rs; e.dyn = I.diss > 0; tot += e.rev;
				if (e.rev > 0) { e.src.vis = Math.max(e.src.vis, smooth(0, 0.3, e.rev)); e.dst.vis = Math.max(e.dst.vis, smooth(0.7, 1, e.rev)); }
			}
			// vertices fly out: each new vertex starts at its parent's position (the seed at the spawn cursor point) and eases out to its place with a gentle overshoot
			if (!reduced) {
				for (const e of I.es) if (e.rev > 0) { if (e.dst.born === undefined) { e.dst.born = T; e.dst.par = e.src; } if (e.src.born === undefined) { e.src.born = T; e.src.par = null; } }
				for (const n of I.vs.concat(I.tips)) {
					if (n.born === undefined) { n.dx = n.x; n.dy = n.y; continue; }
					const u = clamp((T - n.born) / (0.95 * I.slow)), eb = easeBack(u), P0x = n.par ? n.par.x : (I.origin ? I.origin[0] : n.x), P0y = n.par ? n.par.y : (I.origin ? I.origin[1] : n.y);
					n.dx = P0x + (n.x - P0x) * eb; n.dy = P0y + (n.y - P0y) * eb; n.fl = u < 1;
				}
				for (const e of I.es) e.dyn = I.diss > 0 || e.src.fl || e.dst.fl;
			}
			if (I.diss > 0) for (const n of I.vs.concat(I.tips)) { n.x = n.x0 + n.dd[0] * I.diss * 18; n.y = (n.y0 ?? (n.y0 = n.y)) + n.dd[1] * I.diss * 18; }
			I.full = tot / I.es.length;
			I.cap += (((I.phase === "hold" || I.phase === "static") && I.kind === "snark" && I.full > 0.9 ? smooth(0.9, 1, I.full) : 0) - I.cap) * (1 - Math.exp(-dt * 0.35));
		}
		const pulsing = !reduced && M.pulses && v > 0.3;
		if (!(dirty || moving || lit || busy || vMoved || scrollMoved || pulsing)) return false;
		dirty = false;
		g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
		g.lineCap = "round"; g.lineJoin = "round";
		const gate = (th, x) => smooth(th - 0.12, th + 0.28, Dx(x));
		const ucol = dark ? [[84, 112, 188], [100, 150, 190], [132, 140, 206]] : [[120, 140, 205], [60, 80, 170], [24, 36, 120]];
		const UA = dark ? 0.36 : 0.6;
		const batch = [[], [], [], [], []]; // underlay by depth: far / mid / near (straight width batches)
		const ribs = [], grown = [], snarkE = [];
		for (const e of edges.values()) {
			const tgt = e.rev > 0.6 && Math.min(e.a.k, e.b.k) > 0.1 ? 1 : 0;
			e.g += (tgt - e.g) * (1 - Math.exp(-dt * (tgt ? 2.25 / mX(e.a.px) : 1.3)));
			e.w = thin((e.a.px + e.b.px) / 2, (e.a.py + e.b.py) / 2);
			const mx = (e.a.px + e.b.px) / 2;
			if (e.static) { // ambient links grow out from the endpoint nearer the cursor, staggered, on the slow integrator
				const lv = smooth(0.05, 0.8, 1 - Math.pow(1 - staticProg, 1 / mX(mx))), q = clamp((lv * 1.3 - e.sj) / 0.3);
				e.rev = reduced ? (lv > e.sj ? 1 : 0) : q * q * (3 - 2 * q);
				if (e.rev < 0.01) { e.flip = pn && Math.hypot(e.b.px - p.x, e.b.py - p.y) < Math.hypot(e.a.px - p.x, e.a.py - p.y); e.src = e.flip ? e.b : e.a; e.dst = e.flip ? e.a : e.b; }
			}
			const ua = e.base * (e.rev > 0.002 ? 1 : 0) * e.w * lvl(mx) * intro * (e.static ? 0.5 * smooth(0.82, 0.95, e.w) : 1);
			const dm = (e.a.d + e.b.d) / 2;
			if (ua > 0.012) {
				e.ua = ua; e.dm = dm;
				if (e.inst && e.inst.kind === "snark") snarkE.push(e);
				else if (e.sec) batch[3].push(e);
				else if (e.static) batch[4].push(e);
				else if (dm > 0.5 && Math.abs(e.a.d - e.b.d) > 0.12) ribs.push(e); else batch[dm < 0.33 ? 0 : dm < 0.6 ? 1 : 2].push(e);
			}
			if (e.g > 0.015 && e.w > 0.05) grown.push(e);
		}
		for (let bi = 0; bi < 5; bi++) {
			if (!batch[bi].length) continue;
			const c = bi === 4 ? (dark ? [104, 128, 186] : [96, 106, 176]) : ucol[bi === 3 ? 0 : bi], dd = [0.2, 0.45, 0.72, 0.18, 0.25][bi];
			g.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${(UA * (0.35 + dd * 0.6) * 1.25).toFixed(3)})`; g.lineWidth = (bi >= 3 ? 0.4 : 0.55 + 2.4 * dd * dd * 0.6) * M.ws;
			g.beginPath();
			for (const e of batch[bi]) { const pp = partial(e); g.moveTo(pp[0][0], pp[0][1]); for (let i = 1; i < pp.length; i++) g.lineTo(pp[i][0], pp[i][1]); }
			g.stroke();
		}
		// near, depth-varying underlay edges: tapered ribbons, brighter at the near end, with a faint core line
		for (const e of ribs) {
			const pp = partial(e);
			if (pp.length < 2) continue;
			const near = e.src.d >= e.dst.d ? e.src : e.dst, a0 = pp[0], a1 = pp[pp.length - 1];
			const cn = depthRgb(near.hue || 220, 0.8), cf = depthRgb(220, 0.2);
			const gr = g.createLinearGradient(a0[0], a0[1], a1[0], a1[1]);
			const ca = e.src.d >= e.dst.d ? cn : cf, cb = e.src.d >= e.dst.d ? cf : cn, aa = e.ua * UA * 1.6;
			gr.addColorStop(0, `rgba(${ca[0]},${ca[1]},${ca[2]},${(aa * (0.35 + 0.75 * e.src.d)).toFixed(3)})`);
			gr.addColorStop(1, `rgba(${cb[0]},${cb[1]},${cb[2]},${(aa * (0.35 + 0.75 * e.dst.d)).toFixed(3)})`);
			g.fillStyle = gr; ribbonPath(pp); g.fill();
		}
		// nearBoost: edges close to the cursor are drawn once more with a gradient brighter at the end nearer the cursor (per-segment falloff; in light mode this is darker ink)
		if (nearBoost && nbk > 0.01) for (const arr of [batch[0], batch[1], batch[2], batch[4], ribs]) for (const e of arr) {
			const mxy = [(e.a.px + e.b.px) / 2, (e.a.py + e.b.py) / 2]; if (near(mxy[0], mxy[1]) < 0.02 && near(e.a.px, e.a.py) < 0.02 && near(e.b.px, e.b.py) < 0.02) continue;
			const pp = partial(e); if (pp.length < 2) continue;
			const p0 = pp[0], p1 = pp[pp.length - 1], b0 = near(p0[0], p0[1]), b1 = near(p1[0], p1[1]), base = e.ua * (dark ? 0.9 : 1.1);
			const c = dark ? [190, 208, 245] : [40, 55, 140];
			const gr = g.createLinearGradient(p0[0], p0[1], p1[0], p1[1]);
			gr.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${Math.min(0.9, base * b0 * 1.6).toFixed(3)})`); gr.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},${Math.min(0.9, base * b1 * 1.6).toFixed(3)})`);
			g.strokeStyle = gr; g.lineWidth = 0.7 + 0.6 * ((p0[3] + p1[3]) / 2);
			g.beginPath(); g.moveTo(p0[0], p0[1]); for (let i = 1; i < pp.length; i++) g.lineTo(pp[i][0], pp[i][1]); g.stroke();
		}
		// leads: a tapered hairline with a travelling spark head from the cursor point where a graph spawned to its nearest vertex; fixed start, gone once the first real edge has formed
		if (!reduced) for (const I of insts) { // route leads: the spark hops node to node, lighting traversed edges as fading pulses
			const Lp = I.leadPath; if (!Lp || I.phase === "diss") continue;
			const seq = Lp.seq, e = I.age / Lp.hop, nseg = seq.length - 1; if (e > nseg + 8) continue;
			const pos = (it) => (it.kind === "origin" ? { x: I.origin[0], y: I.origin[1] } : it.kind === "target" ? { x: I.vs[I.seed].px, y: I.vs[I.seed].py } : { x: it.ref.px, y: it.ref.py });
			const col = I.kind === "snark" ? hslRgb((T * SNARK_HUE_RATE + I.n * 53) % 360, 0.55, dark ? 0.7 : 0.42) : (dark ? [200, 215, 250] : [60, 80, 170]), rgb = `${col[0] | 0},${col[1] | 0},${col[2] | 0}`;
			g.lineCap = "round";
			for (let k = 0; k < nseg && e > k; k++) {
				const f0 = clamp(e - k), f = f0 * f0 * (3 - 2 * f0), A = pos(seq[k]), B = pos(seq[k + 1]), age = Math.max(0, (e - (k + 1)) * Lp.hop);
				let a = 0.65 * Math.exp(-age / 0.5);
				if (seq[k + 1].gap) a = seq[k + 1].persist ? 0 : Math.max(a, 0.5 * (1 - clamp(age / 1.3)));
				if (a < 0.01) continue;
				g.strokeStyle = `rgba(${rgb},${Math.min(0.9, a * intro).toFixed(3)})`; g.lineWidth = seq[k + 1].gap ? 0.8 : 1.2;
				g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(A.x + (B.x - A.x) * f, A.y + (B.y - A.y) * f); g.stroke();
			}
			if (e < nseg) { const k = Math.floor(e), f0 = e - k, f = f0 * f0 * (3 - 2 * f0), A = pos(seq[k]), B = pos(seq[k + 1]), hx = A.x + (B.x - A.x) * f, hy = A.y + (B.y - A.y) * f; g.fillStyle = `rgba(${rgb},0.34)`; g.beginPath(); g.arc(hx, hy, 3.8, 0, TAU); g.fill(); g.fillStyle = dark ? "rgba(255,255,255,0.9)" : `rgba(${rgb},0.95)`; g.beginPath(); g.arc(hx, hy, 1.5, 0, TAU); g.fill(); }
		}
		if (!reduced) for (const I of insts) {
			if (!I.origin || I.leadPath || I.phase === "diss") continue;
			let mr = 0; for (const e of I.prim) mr = Math.max(mr, e.rev);
			const la = (1 - smooth(0.15, 1, mr)) * intro; if (la < 0.01) continue;
			const sv = I.vs[I.seed], gl = clamp(I.age / (1.1 * I.slow)), lc = I.kind === "snark" ? hslRgb((T * SNARK_HUE_RATE + I.n * 53) % 360, 0.55, dark ? 0.7 : 0.42) : (dark ? [200, 215, 250] : [60, 80, 170]);
			leadSpark(g, I.origin[0], I.origin[1], sv.px, sv.py, gl, la, lc, dark);
		}
		if (!reduced) for (const I of insts) for (const e of I.es) { // tendril leads: a short spark from the spawn cursor point to the tendril's root vertex, fading as it grows
			if (!e.lead || e.rev <= 0.002 || e.rev >= 0.9) continue;
			leadSpark(g, e.lead[0], e.lead[1], e.a.px, e.a.py, clamp(e.rev * 3), (1 - smooth(0.3, 0.9, e.rev)) * 0.7 * intro, dark ? [200, 215, 250] : [60, 80, 170], dark);
		}
		// snarks: vivid, saturated colour that runs along each edge and across the vertices, shifting at 1.5x the base hue rate; glow in dark, deep jewel ink in light
		const sHue = (n, I) => (T * SNARK_HUE_RATE + n.px * 0.2 + n.d * 70 + I.n * 53) % 360;
		const sCol = (h, sat) => hslRgb(h, dark ? 0.5 * sat : 0.45 * sat, dark ? 0.66 : 0.42).map((q) => q | 0); // half the saturation
		for (const e of snarkE) {
			const pp = partial(e); if (pp.length < 2) continue;
			const I = e.inst, sat = e.sec ? 0.5 : 1, wm = e.sec ? 0.55 : 1, A = e.ua * (e.sec ? 0.6 : 1) * 0.85; // half the opacity
			const c0 = sCol(sHue(e.src, I), sat), c1 = sCol(sHue(e.dst, I) + 40, sat), a0 = pp[0], a1 = pp[pp.length - 1];
			const gr = g.createLinearGradient(a0[0], a0[1], a1[0], a1[1]);
			const al0 = Math.min(0.95, A * bst(e.src.px, e.src.py) * (dark ? 0.55 + 0.6 * e.src.d : 0.7 + 0.4 * e.src.d)), al1 = Math.min(0.95, A * bst(e.dst.px, e.dst.py) * (dark ? 0.55 + 0.6 * e.dst.d : 0.7 + 0.4 * e.dst.d));
			if (dark) { // soft glow: a wider, fainter ribbon underneath (no filters)
				const gg = g.createLinearGradient(a0[0], a0[1], a1[0], a1[1]); gg.addColorStop(0, `rgba(${c0[0]},${c0[1]},${c0[2]},${(al0 * 0.1).toFixed(3)})`); gg.addColorStop(1, `rgba(${c1[0]},${c1[1]},${c1[2]},${(al1 * 0.1).toFixed(3)})`);
				g.fillStyle = gg; ribbonPath(pp, 2.6 * wm); g.fill();
			}
			gr.addColorStop(0, `rgba(${c0[0]},${c0[1]},${c0[2]},${al0.toFixed(3)})`); gr.addColorStop(1, `rgba(${c1[0]},${c1[1]},${c1[2]},${al1.toFixed(3)})`);
			g.fillStyle = gr; ribbonPath(pp, 1.15 * wm); g.fill();
			if (!e.sec && (e.src.d + e.dst.d) / 2 > 0.45) { g.strokeStyle = `rgba(255,255,255,${(A * 0.35).toFixed(3)})`; g.lineWidth = Math.max(0.35, wOf(pp[0]) * 0.22); g.beginPath(); g.moveTo(pp[0][0], pp[0][1]); for (let i = 1; i < pp.length; i++) g.lineTo(pp[i][0], pp[i][1]); g.stroke(); }
			if (e.ret > 0.04 && e.ret < 0.96) { g.fillStyle = `rgba(${c1[0]},${c1[1]},${c1[2]},${(Math.sin(e.ret * Math.PI) * 0.85).toFixed(3)})`; g.beginPath(); g.arc(a1[0], a1[1], 1.2 * a1[2], 0, TAU); g.fill(); }
		}
		// cursor-grown edges: lit tubes, growing from the first node; width tapers, brightness follows depth, near ones get a highlight core
		for (const e of grown) {
			const pp0 = edgePts(e); if (e.b.k > e.a.k) pp0.reverse(); const gg = e.g * e.g * (3 - 2 * e.g), pp = cut(pp0, Math.min(1, gg * 1.05));
			if (pp.length < 2) continue;
			const d0 = pp[0][3], d1 = pp[pp.length - 1][3], hue = e.a.k > e.b.k ? e.a.hue : e.b.hue, al = e.w * Math.min(1, e.g * 1.6);
			const c0 = depthRgb(hue, d0), c1 = depthRgb(hue, d1);
			const A0 = al * (dark ? 0.12 + d0 * 0.55 : 0.16 + d0 * 0.5), A1 = al * (dark ? 0.12 + d1 * 0.55 : 0.16 + d1 * 0.5);
			const gr = g.createLinearGradient(pp[0][0], pp[0][1], pp[pp.length - 1][0], pp[pp.length - 1][1]);
			gr.addColorStop(0, `rgba(${c0[0]},${c0[1]},${c0[2]},${A0.toFixed(3)})`); gr.addColorStop(1, `rgba(${c1[0]},${c1[1]},${c1[2]},${A1.toFixed(3)})`);
			g.fillStyle = gr; ribbonPath(pp); g.fill();
			const dm = (d0 + d1) / 2;
			if (dm > 0.45) {
				const hi = dark ? [255, 255, 255] : [255, 255, 255], hl = al * (dm - 0.35) * (dark ? 0.55 : 0.8);
				g.strokeStyle = `rgba(${hi[0]},${hi[1]},${hi[2]},${hl.toFixed(3)})`; g.lineWidth = Math.max(0.35, wOf(pp[pp.length - 1]) * 0.28 + wOf(pp[0]) * 0.12);
				g.beginPath(); g.moveTo(pp[0][0], pp[0][1]); for (let i = 1; i < pp.length; i++) g.lineTo(pp[i][0], pp[i][1]); g.stroke();
			}
		}
		// nodes, far to near
		const order = nodes.slice().sort((a, b) => a.d - b.d);
		for (const n of order) {
			const gv = n.gi !== undefined ? Math.max(n.vis, n.whisper ? 0.3 : 0) : gate(n.th, n.px), gt = gv * intro * lvl(n.px) * n.w * env(n.py) ** 0.4;
			const tw = reduced ? 1 : 1 + (0.05 + n.m * 0.08) * Math.sin(T * n.f + n.ph);
			const base = (dark ? 0.12 + n.m * 0.62 : 0.08 + n.m * 0.32) * (0.35 + 0.8 * n.d) * tw * gt * (n.gi !== undefined ? 1.5 : 1);
			const a = Math.min(0.95, (base + n.k * (1.1 - n.m * 0.5) * n.w * 0.55 * (n.gi !== undefined ? 0.25 + 0.75 * n.vis : 1) * intro) * bst(n.px, n.py));
			if (a < 0.01) continue;
			let c = temps[n.t];
			const far = (1 - n.d) * (dark ? 0.4 : 0.45); // far nodes lean blue (and, on paper, lighter)
			c = [c[0] + ((dark ? 150 : 120) - c[0]) * far, c[1] + ((dark ? 180 : 150) - c[1]) * far, c[2] + ((dark ? 245 : 225) - c[2]) * far];
			if (n.k > 0.01) { const h = hslRgb(n.hue, 0.9, dark ? 0.72 : 0.42), mm = Math.min(1, n.k) * 0.7; c = [c[0] + (h[0] - c[0]) * mm, c[1] + (h[1] - c[1]) * mm, c[2] + (h[2] - c[2]) * mm]; }
			if (n.inst && n.inst.kind === "snark") c = sCol(sHue(n, n.inst), n.kind === "tip" ? 0.5 : 1); // vivid, shifting
			c = c.map((q) => q | 0);
			const col = (al) => `rgba(${c[0]},${c[1]},${c[2]},${Math.min(0.95, al).toFixed(3)})`;
			const rr = (0.45 + n.d * 1.5) * (0.75 + n.rb * 0.5) * n.s * (1 + n.k * 0.25);
			if (n.inst && n.inst.kind === "snark" && n.kind !== "tip") { // bright core, glow in dark
				if (dark) { g.fillStyle = col(a * 0.12); g.beginPath(); g.arc(n.px, n.py, rr * 2.6, 0, TAU); g.fill(); }
				g.fillStyle = col(Math.min(0.95, a * 0.65)); g.beginPath(); g.arc(n.px, n.py, rr * 1.1, 0, TAU); g.fill();
				g.fillStyle = `rgba(255,255,255,${Math.min(0.9, a * (dark ? 0.55 : 0.45)).toFixed(3)})`; g.beginPath(); g.arc(n.px, n.py, rr * 0.5, 0, TAU); g.fill();
			}
			if (nearBoost) { const nh = nbk * smooth(0, 1, 1 - cdist(n.px, n.py) / 80); if (nh > 0.02) { g.fillStyle = col(0.16 * nh * Math.min(1, a * 2)); g.beginPath(); g.arc(n.px, n.py, rr * 3.6, 0, TAU); g.fill(); } } // soft glow halo near the cursor
			g.fillStyle = col(a);
			g.beginPath(); g.arc(n.px, n.py, rr * bw(n.px, n.py), 0, TAU); g.fill();
			if (n.d > 0.5 && rr > 1.1) { // inner highlight on near nodes
				g.fillStyle = `rgba(255,255,255,${Math.min(0.7, a * 0.6 * (n.d - 0.4)).toFixed(3)})`;
				g.beginPath(); g.arc(n.px - rr * 0.28, n.py - rr * 0.3, rr * 0.4, 0, TAU); g.fill();
			}
			if (n.kind === "pad") {
				const pr = n.pr * (0.5 + n.d * 0.9) * n.s;
				g.strokeStyle = col(a * 0.9); g.lineWidth = (0.4 + n.d * 0.9) * n.s;
				g.beginPath(); g.arc(n.px, n.py, pr, 0, TAU); g.stroke();
			} else if (n.kind === "circ") {
				const pr = n.pr * (0.55 + n.d * 0.8) * n.s;
				g.strokeStyle = col(a * 0.8); g.lineWidth = (0.35 + n.d * 0.6) * n.s;
				g.beginPath(); g.arc(n.px, n.py, pr, 0, TAU); g.stroke();
				g.strokeStyle = col(a * 0.5);
				g.beginPath(); g.arc(n.px, n.py, pr * 0.55, 0, TAU); g.stroke();
				g.beginPath();
				for (let i = 0; i < n.nt; i++) { const an = n.rot + (i / n.nt) * TAU; g.moveTo(n.px + Math.cos(an) * pr, n.py + Math.sin(an) * pr); g.lineTo(n.px + Math.cos(an) * (pr + 3.2 * n.s), n.py + Math.sin(an) * (pr + 3.2 * n.s)); }
				g.stroke();
			}
		}
		// a tiny, faint caption under each graph once it is fully revealed after a long dwell
		if (!reduced) {
			g.font = "9px 'League Spartan', sans-serif"; g.textAlign = "center"; g.letterSpacing = "1.6px";
			for (const gp of insts) {
				if (gp.kind !== "snark") continue;
				const q = proj(gp.cx, gp.cy + gp.s * 1.12, gp.z), al = gp.cap * thin(q[0], q[1]) * 0.5 * (0.4 + 0.6 * q[3]);
				if (al < 0.02) continue;
				g.fillStyle = dark ? `rgba(170,190,225,${al.toFixed(3)})` : `rgba(80,95,150,${al.toFixed(3)})`;
				g.fillText(label(gp.g).toUpperCase(), q[0], q[1]);
			}
			g.letterSpacing = "0px";
		}
		// signal packets running along edges (more and faster with flow); they ride the same projected, depth-scaled geometry
		if (pulsing) {
			const cand = [];
			for (const e of edges.values()) if (e.rev > 0.97 && e.base > 0.25 && e.w > 0.4 && (e.circuit || M.pulses < 14)) cand.push(e);
			if (cand.length) {
				const want = Math.round(M.pulses * (0.6 + 0.8 * Math.min(1, flow + v * 0.3)));
				while (pulses.length < want) pulses.push({ e: cand[(Math.random() * cand.length) | 0], u: Math.random(), s: 0.1 + Math.random() * 0.14, dir: Math.random() < 0.5 ? 1 : -1 });
				for (const q of pulses) {
					q.u += q.s * dt * q.dir * (0.7 + flow * 0.9);
					if (q.u > 1 || q.u < 0 || q.e.dead) { q.e = cand[(Math.random() * cand.length) | 0]; q.u = q.dir > 0 ? 0 : 1; }
					const pp = edgePts(q.e), tot = plen(pp);
					let at = q.u * tot, x = pp[0][0], y = pp[0][1], dd = pp[0][3], s = pp[0][2];
					for (let i = 1; i < pp.length; i++) { const sl = Math.hypot(pp[i][0] - pp[i - 1][0], pp[i][1] - pp[i - 1][1]); if (at <= sl || i === pp.length - 1) { const u = sl ? Math.min(1, at / sl) : 0; x = pp[i - 1][0] + (pp[i][0] - pp[i - 1][0]) * u; y = pp[i - 1][1] + (pp[i][1] - pp[i - 1][1]) * u; dd = pp[i - 1][3] + (pp[i][3] - pp[i - 1][3]) * u; s = pp[i - 1][2] + (pp[i][2] - pp[i - 1][2]) * u; break; } at -= sl; }
					const c = dark ? "190,235,255" : "224,40,140", fade = Math.sin(clamp(q.u) * Math.PI) * gate(0.3, x) * lvl(x) * thin(x, y) * (dark ? 0.85 : 0.75) * (0.4 + 0.7 * dd);
					const rr = (0.8 + dd * 1.4) * s;
					g.fillStyle = `rgba(${c},${(fade * 0.25).toFixed(3)})`; g.beginPath(); g.arc(x, y, rr * 2.6, 0, TAU); g.fill();
					g.fillStyle = `rgba(${c},${fade.toFixed(3)})`; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill();
				}
			}
		}
		// feather the top edge of the footer so no cut line shows
		g.globalCompositeOperation = "destination-in";
		const fg = g.createLinearGradient(0, 0, 0, H); fg.addColorStop(0, "rgba(0,0,0,0)"); fg.addColorStop(0.34, "rgba(0,0,0,1)"); fg.addColorStop(1, "rgba(0,0,0,1)");
		g.fillStyle = fg; g.fillRect(0, 0, W, H);
		g.globalCompositeOperation = "source-over";
		if (window.__vsDebug) document.documentElement.dataset.foot = JSON.stringify([insts.filter((I) => I.kind === 'small').length, insts.filter((I) => I.kind === 'snark').length, snarkLog, +dwellT.toFixed(1), edges.size]);
		return true;
	}
	return {
		canvas: cv, build, draw, get debug() { return { lastV, avoid, nodes, edges, insts, snarkLog, W, H }; },
		setRest(r) { netRest = r; cv.style.opacity = 1; dirty = true; },
		invalidate() { dirty = true; },
		destroy() { cv.remove(); },
	};
}
