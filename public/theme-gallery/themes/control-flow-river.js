// #202 Control-Flow River. A river network that is the control-flow graph of a real function: branches
// split and rejoin around islands, loops are oxbow bends, and a canoe of execution drifts through.
//
// Parameters (see _adk/kit.js): { seed, date, hour, season, weather, wind, latitude, longitude, tz }
//   seed picks the snippet (via _adk/mini.js), the terrain, and every branch decision the canoe makes.
// generate(params) is pure: it parses the function, builds basic blocks and edges, and lays them out
// in normalised coordinates (x across, y downstream). paint() and frame() only draw.
import { mountScene, rng, makeNoise, css, mix, mul, clamp, lerp, blob, paintFogBand } from "./_adk/kit.js";
import { parse, children, SNIPPETS } from "./_adk/mini.js";

const KEYS = ["cfg", "gcd", "loop", "fib"];

function buildCFG(fn, src) {
	const nodes = [];
	const edges = [];
	const mkNode = (kind, label, start) => {
		nodes.push({ id: nodes.length, kind, label: (label || "").replace(/\s+/g, " ").slice(0, 24), start });
		return nodes[nodes.length - 1];
	};
	const link = (a, b, kind = "normal") => a && b && edges.push({ from: a.id, to: b.id, kind });
	const entry = mkNode("entry", "entry");
	const exit = mkNode("exit", "exit");
	const txt = (n) => (n ? src.slice(n.start, n.end) : "");
	const pairs = [];
	function seq(stmts, cur, ctx, edgeKind) {
		let open = cur;
		let ek = edgeKind;
		let block = null;
		for (const st of stmts) {
			if (!open) break;
			switch (st.type) {
				case "IfStatement": {
					block = null;
					const b = mkNode("branch", `if ${txt(st.test)}`, st.start);
					link(open, b, ek);
					ek = "normal";
					const j = mkNode("join", "", st.end);
					const tOpen = seqOne(st.consequent, b, ctx, "true");
					if (tOpen) link(tOpen, j);
					if (st.alternate) {
						const fOpen = seqOne(st.alternate, b, ctx, "false");
						if (fOpen) link(fOpen, j);
					} else link(b, j, "false");
					pairs.push([b.id, j.id]);
					open = edges.some((e) => e.to === j.id) ? j : null;
					break;
				}
				case "ForOfStatement":
				case "ForStatement":
				case "WhileStatement": {
					block = null;
					const h = mkNode("loop", st.type === "WhileStatement" ? `while ${txt(st.test)}` : `for ${txt(st.left || st.init)}`, st.start);
					link(open, h, ek);
					ek = "normal";
					const after = mkNode("basic", "after loop", st.end);
					const lctx = { ...ctx, loop: h, after };
					const bodyOpen = seqOne(st.body, h, lctx, "true");
					if (bodyOpen) link(bodyOpen, h, "back");
					link(h, after, "false");
					open = after;
					break;
				}
				case "ReturnStatement": {
					const r = mkNode("basic", `return ${txt(st.argument)}`.trim(), st.start);
					link(open, r, ek);
					link(r, exit);
					open = null;
					break;
				}
				case "ContinueStatement":
					if (ctx.loop) link(open, ctx.loop, ek === "normal" ? "back" : "back");
					open = null;
					break;
				case "BreakStatement":
					if (ctx.after) link(open, ctx.after, ek);
					open = null;
					break;
				default: {
					if (!block || ek !== "normal") {
						block = mkNode("basic", txt(st), st.start);
						link(open, block, ek);
						ek = "normal";
					}
					open = block;
				}
			}
		}
		return open;
	}
	function seqOne(st, cur, ctx, ek) {
		return seq(st.type === "BlockStatement" ? st.body : [st], cur, ctx, ek);
	}
	const last = seq(fn.body.body, entry, {}, "normal");
	if (last) link(last, exit);
	// merge edges: an edge pointing at a loop header from a continue is a back edge
	return { nodes, edges, pairs };
}

function layout(g) {
	const out = g.nodes.map(() => []);
	const inn = g.nodes.map(() => []);
	for (const e of g.edges) {
		if (e.kind === "back") continue;
		out[e.from].push(e.to);
		inn[e.to].push(e.from);
	}
	const rank = g.nodes.map(() => 0);
	const order = [];
	const seen = new Set();
	(function dfs(n) {
		if (seen.has(n)) return;
		seen.add(n);
		for (const m of out[n]) dfs(m);
		order.push(n);
	})(0);
	order.reverse();
	for (const n of order) for (const m of out[n]) rank[m] = Math.max(rank[m], rank[n] + 1);
	// exit sits one below the deepest
	const maxR = Math.max(...rank);
	rank[1] = maxR;
	const byRank = [];
	g.nodes.forEach((n, i) => {
		(byRank[rank[i]] ||= []).push(i);
	});
	const x = g.nodes.map(() => 0.5);
	for (const ids of byRank) {
		if (!ids) continue;
		ids.forEach((i) => {
			const ps = inn[i];
			x[i] = ps.length ? ps.reduce((s, p) => s + x[p], 0) / ps.length : 0.5;
		});
		// branch children fan out
		const grouped = new Map();
		ids.forEach((i) => {
			const key = inn[i].join(",");
			(grouped.get(key) || grouped.set(key, []).get(key)).push(i);
		});
		for (const grp of grouped.values()) if (grp.length > 1) grp.forEach((i, k) => (x[i] += (k - (grp.length - 1) / 2) * 0.24));
		ids.sort((a, b) => x[a] - x[b]);
		for (let k = 1; k < ids.length; k++) if (x[ids[k]] - x[ids[k - 1]] < 0.18) x[ids[k]] = x[ids[k - 1]] + 0.18;
		const mean = ids.reduce((s, i) => s + x[i], 0) / ids.length;
		const want = ids.reduce((s, i) => s + (inn[i].length ? x[inn[i][0]] : 0.5), 0) / ids.length;
		ids.forEach((i) => (x[i] += want - mean));
	}
	const R = maxR + 1;
	const lo = Math.min(...x);
	const hi = Math.max(...x);
	const span = Math.max(0.5, hi - lo);
	// flow volume
	const flow = g.nodes.map(() => 0);
	flow[0] = 1;
	for (const n of order) {
		const o = out[n];
		if (!o.length) continue;
		const share = flow[n] / o.length;
		for (const m of o) flow[m] += share;
	}
	return {
		pos: g.nodes.map((n, i) => ({ x: 0.5 + ((x[i] - (lo + hi) / 2) / span) * 0.48, y: 0.03 + (rank[i] / Math.max(1, R - 1)) * 0.94 })),
		flow: flow.map((f) => clamp(f, 0.15, 1)),
	};
}

export function generate(p) {
	const key = KEYS[Math.abs(p.seed) % KEYS.length];
	const src = SNIPPETS[key];
	const ast = parse(src);
	const fn = ast.body.find((n) => n.type === "FunctionDeclaration");
	const g = buildCFG(fn, src);
	const L = layout(g);
	const rand = rng(p.seed * 83 + 7);
	// the canoe's route: one decision per branch, seeded
	const out = g.nodes.map(() => []);
	g.edges.forEach((e, i) => out[e.from].push(i));
	const route = [];
	let cur = 0;
	const iters = new Map();
	for (let guard = 0; guard < 80 && cur !== 1; guard++) {
		const es = out[cur];
		if (!es.length) break;
		let pick = es[(rand() * es.length) | 0];
		const n = g.nodes[cur];
		if (n.kind === "loop") {
			const c = (iters.get(cur) || 0) + 1;
			iters.set(cur, c);
			pick = es.find((i) => g.edges[i].kind === (c <= 2 ? "true" : "false")) ?? pick;
		}
		route.push(pick);
		cur = g.edges[pick].to;
	}
	return { key, ...g, ...L, route, seed: p.seed };
}

function bez(a, b, kind, idx = 0) {
	if (kind === "back") {
		const side = 0.1 + Math.abs(a.y - b.y) * 0.1;
		return [a, { x: a.x + side, y: a.y + 0.02 }, { x: b.x + side, y: b.y - 0.02 }, b];
	}
	const dy = (b.y - a.y) * 0.5;
	const w = Math.sin(idx * 2.3 + 1) * 0.07 * (b.y - a.y) * 1.6;
	return [a, { x: a.x + w, y: a.y + dy }, { x: b.x - w * 0.8, y: b.y - dy }, b];
}

function pt(c, t) {
	const u = 1 - t;
	const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
	return { x: c[0].x * w[0] + c[1].x * w[1] + c[2].x * w[2] + c[3].x * w[3], y: c[0].y * w[0] + c[1].y * w[1] + c[2].y * w[2] + c[3].y * w[3] };
}

export function activate({ root, mode, reducedMotion }) {
	let route = [];
	let totalLen = 0;
	let waterCol = [70, 130, 160];
	return mountScene(root, {
		id: "control-flow-river",
		mode,
		reducedMotion,
		generate,
		horizon: 0.5,
		paint(ctx, scene, view, env) {
			const wide = view.w > 900;
			const X = (nx) => (wide ? lerp(0.52, 0.94, nx) : lerp(0.12, 0.88, nx)) * view.w;
			const Y = (ny) => ny * view.h;
			const P = scene.pos.map((p) => ({ x: X(p.x), y: Y(p.y) }));
			const season = env.p.season;
			const noise = makeNoise(env.p.seed * 5 + 1);
			// ground
			const gw = 200;
			const gh = Math.round((200 * view.h) / view.w);
			const g = document.createElement("canvas");
			g.width = gw;
			g.height = gh;
			const gx = g.getContext("2d");
			const im = gx.createImageData(gw, gh);
			const groundLight = { spring: [150, 180, 100], summer: [112, 150, 84], autumn: [168, 140, 80], winter: [228, 234, 242] }[season];
			const groundDark = { spring: [84, 124, 76], summer: [52, 96, 64], autumn: [112, 82, 50], winter: [196, 208, 222] }[season];
			for (let j = 0; j < gh; j++) {
				for (let i = 0; i < gw; i++) {
					const n = noise.fbm2(i * 0.045, j * 0.045, 4);
					const m = noise.fbm2(i * 0.15 + 30, j * 0.15, 2);
					let c = mix(groundDark, groundLight, clamp((n - 0.35) * 2.2));
					c = mix(c, mul(groundLight, 1.08), clamp((m - 0.55) * 2) * 0.4);
					c = env.lit(c);
					const k = (j * gw + i) * 4;
					im.data[k] = c[0];
					im.data[k + 1] = c[1];
					im.data[k + 2] = c[2];
					im.data[k + 3] = 255;
				}
			}
			gx.putImageData(im, 0, 0);
			ctx.imageSmoothingQuality = "high";
			ctx.drawImage(g, 0, 0, view.w, view.h);
			// edge curves (px)
			const curves = scene.edges.map((e, i) => bez({ x: P[e.from].x, y: P[e.from].y }, { x: P[e.to].x, y: P[e.to].y }, e.kind, i));
			const wOf = (e) => (e.kind === "back" ? 7 : 11 + 24 * scene.flow[e.to]) * lerp(0.7, 1, view.h / 900);
			// tree canopy dots where there's no river: build a coarse mask
			const mask = document.createElement("canvas");
			mask.width = 100;
			mask.height = Math.round((100 * view.h) / view.w);
			const mx = mask.getContext("2d");
			mx.scale(mask.width / view.w, mask.height / view.h);
			mx.strokeStyle = "#fff";
			mx.fillStyle = "#fff";
			scene.edges.forEach((e, i) => {
				mx.lineWidth = wOf(e) + 22;
				mx.beginPath();
				mx.moveTo(curves[i][0].x, curves[i][0].y);
				mx.bezierCurveTo(curves[i][1].x, curves[i][1].y, curves[i][2].x, curves[i][2].y, curves[i][3].x, curves[i][3].y);
				mx.stroke();
			});
			const md = mx.getImageData(0, 0, mask.width, mask.height).data;
			const rand = rng(env.p.seed * 9 + 4);
			const leaf = env.land.leaf;
			const trunkN = Math.round((view.w * view.h) / 140);
			for (let i = 0; i < trunkN; i++) {
				const x = rand() * view.w;
				const y = rand() * view.h;
				const mi = ((Math.floor((y / view.h) * mask.height) * mask.width + Math.floor((x / view.w) * mask.width)) * 4) + 3;
				if (md[mi] > 20) continue;
				const dens = noise.fbm2((x / view.w) * 9, (y / view.h) * 6, 3);
				if (dens < 0.42) continue;
				const r = 3 + rand() * 3.5;
				let c = rand() < 0.3 && season !== "winter" ? leaf[(rand() * leaf.length) | 0] : season === "winter" ? [92, 120, 104] : mix(env.land.conifer, leaf[(rand() * leaf.length) | 0], 0.45);
				c = env.lit(c);
				ctx.fillStyle = css(mul(c, 0.7), 0.9);
				ctx.beginPath();
				ctx.arc(x + 1, y + 1.5, r, 0, 6.2832);
				ctx.fill();
				ctx.fillStyle = css(c, 0.95);
				ctx.beginPath();
				ctx.arc(x, y, r * 0.86, 0, 6.2832);
				ctx.fill();
			}
			// river: banks, water, sheen
			const water = env.lit2(mix([44, 116, 168], [200, 224, 236], env.ice * 0.8));
			waterCol = water;
			const bank = env.lit2(mix([196, 178, 140], [236, 240, 244], env.snowAmt));
			const stroke = (w, col, alpha = 1) => {
				ctx.lineCap = "round";
				scene.edges.forEach((e, i) => {
					ctx.lineWidth = w(e);
					ctx.strokeStyle = css(col, alpha);
					ctx.beginPath();
					ctx.moveTo(curves[i][0].x, curves[i][0].y);
					ctx.bezierCurveTo(curves[i][1].x, curves[i][1].y, curves[i][2].x, curves[i][2].y, curves[i][3].x, curves[i][3].y);
					ctx.stroke();
				});
			};
			stroke((e) => wOf(e) + 8, bank);
			stroke((e) => wOf(e) + 3, mul(water, 0.7));
			stroke((e) => wOf(e), water);
			stroke((e) => wOf(e) * 0.45, mix(water, env.sky.hor, 0.35), 0.55);
			// pools at nodes
			scene.nodes.forEach((n, i) => {
				const r = (n.kind === "branch" || n.kind === "loop" ? 15 : n.kind === "join" ? 12 : 9) * lerp(0.8, 1.1, scene.flow[i]);
				ctx.fillStyle = css(bank);
				ctx.beginPath();
				ctx.ellipse(P[i].x, P[i].y, r + 4, r * 0.8 + 4, 0, 0, 6.2832);
				ctx.fill();
				ctx.fillStyle = css(water);
				ctx.beginPath();
				ctx.ellipse(P[i].x, P[i].y, r, r * 0.8, 0, 0, 6.2832);
				ctx.fill();
			});
			// islands between each branch and its join
			scene.pairs.forEach(([b, j]) => {
				const succ = scene.edges.filter((e) => e.from === b && e.kind !== "back").map((e) => P[e.to]);
				if (succ.length < 2) return;
				const a = P[b];
				const z = P[j];
				const mxp = (succ[0].x + succ[1].x) / 2 + (a.x + z.x) / 2 - (a.x + z.x) / 2;
				const myp = (a.y + z.y) / 2;
				const rx = Math.max(6, Math.abs(succ[0].x - succ[1].x) * 0.28);
				const ry = Math.max(10, Math.abs(z.y - a.y) * 0.3);
				ctx.fillStyle = css(bank);
				ctx.beginPath();
				ctx.ellipse(mxp, myp, rx + 4, ry + 4, 0, 0, 6.2832);
				ctx.fill();
				ctx.fillStyle = css(env.lit(mix(env.land.ground, [90, 130, 80], 0.3)));
				ctx.beginPath();
				ctx.ellipse(mxp, myp, rx, ry, 0, 0, 6.2832);
				ctx.fill();
				for (let k = 0; k < 7; k++) {
					const c = env.lit(mix(env.land.conifer, env.land.leaf[k % env.land.leaf.length], 0.35));
					ctx.fillStyle = css(c);
					ctx.beginPath();
					ctx.arc(mxp + (rand() - 0.5) * rx * 1.4, myp + (rand() - 0.5) * ry * 1.5, 3 + rand() * 3, 0, 6.2832);
					ctx.fill();
				}
			});
			// labels
			ctx.font = "12px ui-monospace, Menlo, monospace";
			const ink = env.ink;
			scene.nodes.forEach((n, i) => {
				if (!n.label || n.kind === "join") return;
				ctx.fillStyle = css(ink, 0.85);
				ctx.textAlign = "left";
				ctx.fillText(n.label, P[i].x + 20, P[i].y + 4);
			});
			// canoe route as sampled polyline
			route = [];
			totalLen = 0;
			for (const ei of scene.route) {
				const c = curves[ei];
				let prev = null;
				for (let s = 0; s <= 24; s++) {
					const q = pt(c, s / 24);
					if (prev) {
						const d = Math.hypot(q.x - prev.x, q.y - prev.y);
						totalLen += d;
						route.push({ x: q.x, y: q.y, d: totalLen });
					} else if (!route.length) route.push({ x: q.x, y: q.y, d: 0 });
					prev = q;
				}
			}
			paintFogBand(ctx, view, env, view.h * 0.55, env.fog * 0.8);
			void blob;
			void children;
		},
		frame(ctx, scene, view, env, t, dt, still) {
			if (route.length < 3) return;
			// water glints
			const sunny = env.alt > 2 ? env.light * (1 - env.cover) : env.night * 0.6 * (env.sm.moon.alt > 0 ? 1 : 0.3);
			if (sunny > 0.05) {
				const rr = rng(env.p.seed + Math.floor(still ? 3 : t * 2.5));
				ctx.fillStyle = css(env.alt > 2 ? [255, 250, 232] : [220, 230, 255], 0.55 * sunny);
				for (let i = 0; i < 40; i++) {
					const q = route[(rr() * route.length) | 0];
					ctx.fillRect(q.x + (rr() - 0.5) * 12, q.y + (rr() - 0.5) * 6, 2.2, 1);
				}
			}
			const d = still ? totalLen * 0.38 : (t * 46) % (totalLen + 80);
			let i = 1;
			while (i < route.length - 1 && route[i].d < d) i++;
			const a = route[i - 1];
			const b = route[i];
			const k = clamp((d - a.d) / Math.max(1, b.d - a.d));
			const x = lerp(a.x, b.x, k);
			const y = lerp(a.y, b.y, k);
			const ang = Math.atan2(b.y - a.y, b.x - a.x);
			// trace: where execution has been
			ctx.strokeStyle = css(env.tone === "dark" ? [255, 206, 130] : [255, 140, 50], 0.55);
			ctx.lineWidth = 2;
			ctx.lineCap = "round";
			ctx.beginPath();
			let started = false;
			for (let j = Math.max(0, i - 40); j <= i; j++) {
				if (!started) {
					ctx.moveTo(route[j].x, route[j].y);
					started = true;
				} else ctx.lineTo(route[j].x, route[j].y);
			}
			ctx.lineTo(x, y);
			ctx.stroke();
			// wake
			ctx.strokeStyle = "rgba(255,255,255,0.55)";
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(x - Math.cos(ang) * 9 + Math.sin(ang) * 3, y - Math.sin(ang) * 9 - Math.cos(ang) * 3);
			ctx.lineTo(x - Math.cos(ang) * 26 + Math.sin(ang) * 11, y - Math.sin(ang) * 26 - Math.cos(ang) * 11);
			ctx.moveTo(x - Math.cos(ang) * 9 - Math.sin(ang) * 3, y - Math.sin(ang) * 9 + Math.cos(ang) * 3);
			ctx.lineTo(x - Math.cos(ang) * 26 - Math.sin(ang) * 11, y - Math.sin(ang) * 26 + Math.cos(ang) * 11);
			ctx.stroke();
			// canoe
			ctx.save();
			ctx.translate(x, y);
			ctx.rotate(ang);
			ctx.fillStyle = css(env.lit([196, 70, 40]));
			ctx.beginPath();
			ctx.moveTo(11, 0);
			ctx.quadraticCurveTo(0, -5.5, -11, 0);
			ctx.quadraticCurveTo(0, 5.5, 11, 0);
			ctx.fill();
			ctx.fillStyle = css(env.lit([240, 224, 196]));
			ctx.beginPath();
			ctx.ellipse(-1, 0, 3, 2.2, 0, 0, 6.2832);
			ctx.fill();
			ctx.fillStyle = css(env.lit([60, 80, 120]));
			ctx.beginPath();
			ctx.arc(-1, 0, 1.6, 0, 6.2832);
			ctx.fill();
			ctx.restore();
			void waterCol;
		},
	});
}
