// _vs4/graphs.js: helpers over Mark K. Goldberg's graphs (themes/_graphs/goldberg-graphs.js). Josh wants an outsized number of snarks,
// so picks are weighted heavily toward them. "overlapping-communities" is not from Goldberg's papers and is never drawn.
// _vs4/graphs.js: helpers for the network graphs. The Goldberg snark data (themes/_graphs/goldberg-graphs.js, ~256 KB) is NOT imported statically: it is loaded
// lazily with a dynamic import() only once a snark is about to spawn (see loadGoldberg), so nothing about it loads at page load.
let GMOD = null, gprom = null;
export function loadGoldberg() { return (gprom ||= import("../_graphs/goldberg-graphs.js").then((m) => (GMOD = m)).catch(() => null)); }
export const goldbergReady = () => !!(GMOD && Array.isArray(GMOD.GOLDBERG));
export const label = (g) => g.name || "";

// snark picker: only Goldberg snarks G_k and twisted TG_k (odd k, n = 8k). maxK: side margins 9 (rarely 11), the footer up to 15. A random layout is picked
// (spiral is down-weighted for k < 9, where it reads as a loose coil). Returns null until the data has loaded.
export function pickSnark(r, { maxK = 9, rareK = 0 } = {}) {
	if (!goldbergReady()) return null;
	const list = GMOD.GOLDBERG.filter((g) => g.k <= Math.max(maxK, rareK));
	if (!list.length) return null;
	const w = list.map((g) => (g.k <= 9 ? 1 : g.k <= 11 ? (rareK >= 11 ? (maxK >= 11 ? 0.6 : 0.25) : maxK >= 11 ? 0.6 : 0) : maxK >= g.k ? 0.3 : 0));
	let u = r() * w.reduce((a, b) => a + b, 0), g = list[0];
	for (let i = 0; i < list.length; i++) if (w[i] > 0 && (u -= w[i]) <= 0) { g = list[i]; break; }
	const keys = Object.keys(g.layouts), lw = keys.map((k) => (k === "spiral" && g.k < 9 ? 0.2 : 1));
	let v = r() * lw.reduce((a, b) => a + b, 0), key = keys[0];
	for (let i = 0; i < keys.length; i++) if ((v -= lw[i]) <= 0) { key = keys[i]; break; }
	return { ...g, layout: g.layouts[key], layoutKey: key, ring3d: key === "ring3d" };
}

// edges with a parallel index, so repeated (multigraph) edges can be drawn as slightly offset parallel curves
export function edgeList(g) {
	const seen = new Map(), out = [];
	for (const [a, b] of g.edges) {
		const k = Math.min(a, b) * 4096 + Math.max(a, b), i = seen.get(k) || 0;
		seen.set(k, i + 1);
		out.push({ a, b, i, key: k });
	}
	for (const e of out) e.c = seen.get(e.key);
	return out;
}

// layout rotated by yaw (about y) and pitch (about x): gives every instance its own viewing angle
export function layoutRot(g, yaw = 0, pitch = 0) {
	const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
	return g.layout.map(([x, y, z = 0]) => {
		const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
		return [x1, y * cp - z1 * sp, y * sp + z1 * cp];
	});
}

// small randomized graphs (3-9 nodes): little trees, cycles (sometimes with a chord) and k-nearest webs. Layout in roughly [-1, 1], small random z.
export function smallGraph(r, kind = ["tree", "cycle", "web", "tree", "web"][(r() * 5) | 0], extra = 0) {
	const TAU = Math.PI * 2;
	const n = (kind === "cycle" ? 4 + ((r() * 5) | 0) : 4 + ((r() * 6) | 0)) + extra;
	const pts = [], edges = [];
	if (kind === "tree") {
		pts.push([0, 0, 0]);
		for (let i = 1; i < n; i++) { const p = (r() * i * (r() < 0.6 ? 1 : 0.4)) | 0, an = r() * TAU, len = 0.45 + r() * 0.45; pts.push([pts[p][0] + Math.cos(an) * len, pts[p][1] + Math.sin(an) * len, (r() - 0.5) * 0.7]); edges.push([p, i]); }
	} else if (kind === "cycle") {
		for (let i = 0; i < n; i++) { const an = (i / n) * TAU + (r() - 0.5) * 0.3, rad = 0.8 + r() * 0.3; pts.push([Math.cos(an) * rad, Math.sin(an) * rad, (r() - 0.5) * 0.6]); edges.push([i, (i + 1) % n]); }
		if (n >= 6 && r() < 0.55) edges.push([0, (n / 2) | 0]);
	} else {
		for (let i = 0; i < n; i++) { const an = r() * TAU, rad = Math.sqrt(r()) * 1.1; pts.push([Math.cos(an) * rad, Math.sin(an) * rad, (r() - 0.5) * 0.7]); }
		const has = new Set(), add = (a, b) => { const k = Math.min(a, b) * 64 + Math.max(a, b); if (a !== b && !has.has(k)) { has.add(k); edges.push([a, b]); } };
		const d = (a, b) => Math.hypot(pts[a][0] - pts[b][0], pts[a][1] - pts[b][1]);
		for (let i = 0; i < n; i++) { const near = pts.map((_, j) => j).filter((j) => j !== i).sort((a, b) => d(i, a) - d(i, b)); add(i, near[0]); if (r() < 0.7) add(i, near[1]); }
		const par = pts.map((_, i) => i), find = (x) => (par[x] === x ? x : (par[x] = find(par[x])));
		for (const [a, b] of edges) par[find(a)] = find(b);
		for (let guard = 0; guard < 8; guard++) { let best = null; for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) if (find(a) !== find(b) && (!best || d(a, b) < best[0])) best = [d(a, b), a, b]; if (!best) break; add(best[1], best[2]); par[find(best[1])] = find(best[2]); }
	}
	const mx = Math.max(0.01, ...pts.map((p) => Math.hypot(p[0], p[1])));
	return { id: "rand-" + kind, name: kind, n, edges, layout: pts.map((p) => [p[0] / mx, p[1] / mx, p[2]]), random: true };
}

// colour clock: the aurora's palette drift runs at 0.42 rad/s (its `T * .42` term), i.e. ~24 deg/s; the star and network tints use the same rate,
// and snarks cycle their colours at 1.5x of it.
export const BASE_HUE_RATE = (0.42 * 180) / Math.PI;
export const SNARK_HUE_RATE = 1.5 * BASE_HUE_RATE;

// a cursor lead: a hairline from the spawn cursor point to a graph's first vertex, wide at the cursor and tapering toward the graph, with a soft bright
// head that travels along it as it draws in (gl 0..1), like a spark launching the graph. la = overall alpha. c = rgb.
export function leadSpark(g, x0, y0, x1, y1, gl, la, c, dark) {
	const N = 6, rgb = `${c[0] | 0},${c[1] | 0},${c[2] | 0}`;
	g.lineCap = "round";
	for (let k = 0; k < N; k++) {
		const u0 = (k / N) * gl, u1 = ((k + 1) / N) * gl;
		if (u1 <= u0) break;
		g.strokeStyle = `rgba(${rgb},${Math.min(0.9, la * 0.95 * (1 - 0.45 * (k / N))).toFixed(3)})`;
		g.lineWidth = 1.5 - 1.1 * ((k + 0.5) / N);
		g.beginPath(); g.moveTo(x0 + (x1 - x0) * u0, y0 + (y1 - y0) * u0); g.lineTo(x0 + (x1 - x0) * u1, y0 + (y1 - y0) * u1); g.stroke();
	}
	if (la > 0.02) { // the travelling head
		const hx = x0 + (x1 - x0) * gl, hy = y0 + (y1 - y0) * gl, h = Math.min(1, la * 1.6) * (1 - 0.5 * gl * gl);
		g.fillStyle = `rgba(${rgb},${(0.3 * h).toFixed(3)})`; g.beginPath(); g.arc(hx, hy, 3.6, 0, 6.283); g.fill();
		g.fillStyle = dark ? `rgba(255,255,255,${(0.85 * h).toFixed(3)})` : `rgba(${rgb},${(0.9 * h).toFixed(3)})`; g.beginPath(); g.arc(hx, hy, 1.4, 0, 6.283); g.fill();
	}
}
// gentle ease-out with a small overshoot, for vertices flying out from the cursor
export const easeBack = (u) => { const q = Math.min(1, Math.max(0, u)) - 1, c1 = 1.1; return 1 + (c1 + 1) * q * q * q + c1 * q * q; };

// route planning for cursor sparks: from the cursor point O to the new graph's first vertex T, hopping along existing nodes and edges and adding short new "gap" edges where
// the network has none. nodes: [{x, y}], real: [[i, j]] index pairs of existing edges. Returns [{ i, gap }] (i = node index, or -1 for the origin / -2 for the target) or null.
export function planRoute(nodes, real, O, T, { gapMax = 85, startMax = 90, endMax = 100, hopCap = 8, blocked = null } = {}) {
	const n = nodes.length, V = n + 2, P = (i) => (i === 0 ? O : i === n + 1 ? T : nodes[i - 1]);
	const adj = Array.from({ length: V }, () => []);
	const has = new Set(), key = (a, b) => (a < b ? a * 4096 + b : b * 4096 + a);
	const link = (a, b, cost, gap) => { adj[a].push([b, cost, gap]); adj[b].push([a, cost, gap]); };
	for (const [a, b] of real) { const d = Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y); link(a + 1, b + 1, d, false); has.add(key(a + 1, b + 1)); }
	for (let i = 1; i <= n; i++) {
		const d0 = Math.hypot(P(i).x - O.x, P(i).y - O.y); if (d0 <= startMax && !(blocked && blocked(O.x, O.y, P(i).x, P(i).y))) link(0, i, d0 * 1.6 + 4, true);
		const d1 = Math.hypot(P(i).x - T.x, P(i).y - T.y); if (d1 <= endMax && !(blocked && blocked(P(i).x, P(i).y, T.x, T.y))) link(i, n + 1, d1 * 1.6 + 4, true);
		for (let j = i + 1; j <= n; j++) { if (has.has(key(i, j))) continue; const d = Math.hypot(P(i).x - P(j).x, P(i).y - P(j).y); if (d <= gapMax && !(blocked && blocked(P(i).x, P(i).y, P(j).x, P(j).y))) link(i, j, d * 1.6 + 12, true); }
	}
	const dist = new Array(V).fill(1e9), prev = new Array(V).fill(-1), pg = new Array(V).fill(false), done = new Array(V).fill(false);
	dist[0] = 0;
	for (let it = 0; it < V; it++) {
		let u = -1; for (let i = 0; i < V; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i;
		if (u < 0 || dist[u] >= 1e9) break;
		done[u] = true; if (u === n + 1) break;
		for (const [w, c, gap] of adj[u]) if (dist[u] + c < dist[w]) { dist[w] = dist[u] + c; prev[w] = u; pg[w] = gap; }
	}
	if (prev[n + 1] < 0) return null;
	const path = [];
	for (let v = n + 1; v >= 0; v = prev[v]) { path.push({ i: v === 0 ? -1 : v === n + 1 ? -2 : v - 1, gap: v === 0 ? false : pg[v] }); if (v === 0) break; }
	path.reverse();
	if (path.length - 1 > hopCap + 1 || !path.some((p, k) => k > 0 && !p.gap)) return null; // too long, or no existing edge used at all
	return path;
}

