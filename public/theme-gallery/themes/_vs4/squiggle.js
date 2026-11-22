// _vs4/squiggle.js: the link hover borrows the side stars' visual language instead of a rainbow sweep. The underline keeps its blue; on hover
// a muted, slow colour wash (--vsRb, low saturation) is revealed from the entry point, and a small canvas beside it draws a per-theme
// star treatment (tiny dots, hairline edges, depth-tinted ink). No thickness pop, no glow. Everything is driven by mouse movement:
// the reveal advances while the pointer moves over the link, holds still when it stops, and returns to plain blue on leave.
import { clamp, isDark } from "../_refined-e/kit.js";
import { smallGraph, edgeList, layoutRot } from "./graphs.js";

const hsl = (h, s, l) => `hsl(${(((h % 360) + 360) % 360).toFixed(0)} ${s}% ${l}%)`;
const TAU = Math.PI * 2;
const PAL = {
	dark: [[214, 226, 255], [150, 222, 226], [204, 184, 255], [255, 240, 222], [186, 208, 255]], // soft blue-white, teal, lilac, warm white
	light: [[28, 44, 112], [8, 104, 116], [66, 56, 156], [112, 38, 104], [186, 108, 16]],          // navy, teal, indigo, plum, amber
};

export function vsSquiggle(root, opts = {}) {
	const o = { h0: 190, span: 120, perLink: 31, sweep: "entry", dur: 2.6, stops: 9, fx: "dots", ...opts };
	const dark = isDark();
	const S = dark ? 34 : 46, L = dark ? 74 : 38;
	const pal = PAL[dark ? "dark" : "light"];
	const links = [...root.querySelectorAll(".site-link")];
	links.forEach((a, i) => {
		const h = o.h0 + i * o.perLink;
		const cols = [];
		for (let k = 0; k < o.stops; k++) cols.push(hsl(h + (k / (o.stops - 1)) * o.span, S, L));
		a.style.setProperty("--vsRb", `linear-gradient(90deg, ${cols.join(", ")})`);
		a.style.setProperty("--vsThick", "1");
		a.style.setProperty("--vsGlow", "0");
		a.style.setProperty("--vsGlints", "0");
		a.style.setProperty("--vsDur", `${o.dur}s`);
	});
	const enter = (e) => {
		const a = e.target?.closest?.(".site-link");
		if (!a) return;
		const r = a.getBoundingClientRect();
		a.style.setProperty("--vsx", (clamp((e.clientX - r.left) / Math.max(1, r.width)) * 100).toFixed(1));
	};
	root.addEventListener("pointerover", enter, { passive: true });
	root.classList.add("vs-sq");

	// ---- the star treatment ----
	const cv = document.createElement("canvas");
	cv.setAttribute("aria-hidden", "true");
	cv.style.cssText = "position:fixed;left:0;top:0;pointer-events:none;z-index:12;display:none";
	document.body.append(cv);
	const g = cv.getContext("2d");
	const st = { a: null, x: 0, p: 0, e: 0, t: 0, lastMove: 0, frag: null, parts: [], fade: 0, rect: null, lastX: null };
	let raf = 0, last = 0, dead = false;
	const reduced = !!opts.reduced;
	const PADX = 14, PADY = 26;

	function geom(a) {
		const r = a.getBoundingClientRect(), em = parseFloat(getComputedStyle(a).fontSize) || 20, k = (0.3 * em) / 14;
		return { r, em, k, per: 16 * k, y0: PADY * 0.45 + 0.0 };
	}
	// the squiggle's own wave: y = 7 + 3 sin(2 pi x / 16) in svg units, crests (visually up) where the sine is -1
	const waveY = (G, u) => G.y0 + G.k * (7 + 3 * Math.sin((TAU * u) / G.per)) + 0;
	function begin(a, e) {
		const G = geom(a);
		if (st.dimLink && st.dimLink !== a) st.dimLink.style.removeProperty("--vsDim");
		st.a = a; st.dimLink = a; st.G = G; st.fade = 1; st.lastX = null;
		cv.width = Math.ceil((G.r.width + PADX * 2) * 1.5); cv.height = Math.ceil((PADY + G.em * 0.9) * 1.5);
		cv.style.width = cv.width / 1.5 + "px"; cv.style.height = cv.height / 1.5 + "px";
		st.ox = G.r.left - PADX; st.oy = G.r.bottom - PADY * 0.45;
		cv.style.left = st.ox + "px"; cv.style.top = st.oy + "px"; cv.style.display = "block";
		st.p = 0; st.t = 0; st.parts = []; st.frag = null; st.e = 0;
		st.x = clamp((e.clientX - G.r.left) / Math.max(1, G.r.width)) * G.r.width;
		if (o.fx === "graph") buildFrag(G);
	}
	function buildFrag(G) {
		const gr = smallGraph(Math.random, "web", 2), lay = layoutRot(gr, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 0.6);
		const adj = lay.map(() => []), el = edgeList(gr);
		for (const e of el) { adj[e.a].push(e.b); adj[e.b].push(e.a); }
		const order = [0], seen = new Set([0]);
		for (let i = 0; i < order.length && order.length < 9; i++) for (const w of adj[order[i]]) if (!seen.has(w) && order.length < 9) { seen.add(w); order.push(w); }
		const idx = new Map(order.map((v, i) => [v, i]));
		st.frag = { v: order.map((v, i) => ({ du: (i - (order.length - 1) / 2) * 15 + lay[v][0] * 6, dy: lay[v][1] * 9, d: clamp(0.5 + lay[v][2] * 1.2), delay: i * 0.07 })),
			e: el.filter((e) => idx.has(e.a) && idx.has(e.b)).map((e) => ({ a: idx.get(e.a), b: idx.get(e.b) })) };
	}
	const ink = (i, d, a) => { const c = pal[i % pal.length]; const f = dark ? 0.55 + d * 0.45 : 0.45 + (1 - d) * 0.4; return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${(a * (dark ? 0.35 + d * 0.65 : 0.5 + d * 0.5)).toFixed(3)})`; };

	function render() {
		const G = st.G; if (!G) return;
		g.setTransform(1.5, 0, 0, 1.5, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
		const W = G.r.width, p = clamp(st.p), f = st.fade, T = st.t;
		const cx = st.x + PADX; // pointer along the link, canvas coords
		const reach = (u) => clamp(1 - Math.abs(u - st.x) / Math.max(30, W * (0.18 + 0.7 * p))) * p * f;
		const per = G.per, n = Math.floor(W / per);
		const crest = (i) => ({ u: (i + 0.75) * per, y: waveY(G, (i + 0.75) * per) });
		g.lineCap = "round";
		if (o.fx === "dots") { // tiny twinkling stars at the crests, a faint desaturated tint near the cursor
			for (let i = 0; i < n; i++) {
				const c = crest(i), k = reach(c.u); if (k < 0.02) continue;
				const tw = 0.7 + 0.3 * Math.sin(T * 2.2 + i * 1.7);
				g.fillStyle = ink(i + (i % 3), 0.3 + (i % 3) * 0.3, 0.8 * k * tw);
				g.beginPath(); g.arc(c.u + PADX, c.y - 3.2 - (i % 2), 0.7 + (i % 3) * 0.3, 0, TAU); g.fill();
			}
		} else if (o.fx === "constellation") { // the stroke dissolves into evenly spaced points joined by hairlines
			const step = per * 0.5, m = Math.floor(W / step); let prev = null;
			for (let i = 0; i <= m; i++) {
				const u = i * step, y = waveY(G, u) - 1, k = reach(u);
				if (k > 0.02) {
					if (prev) { g.strokeStyle = ink(i, 0.35, 0.55 * Math.min(k, prev.k)); g.lineWidth = 0.45; g.beginPath(); g.moveTo(prev.u + PADX, prev.y); g.lineTo(u + PADX, y); g.stroke(); }
					g.fillStyle = ink(i, 0.4 + (i % 3) * 0.25, 0.9 * k); g.beginPath(); g.arc(u + PADX, y, 0.7 + (i % 4 === 0 ? 0.7 : 0.2), 0, TAU); g.fill();
					if (i % 5 === 0 && i + 3 <= m) { const u2 = (i + 3) * step, y2 = waveY(G, u2) - 1; g.strokeStyle = ink(i, 0.2, 0.3 * k); g.beginPath(); g.moveTo(u + PADX, y); g.lineTo(u2 + PADX, y2 + 4); g.stroke(); }
					prev = { u, y, k };
				} else prev = null;
			}
		} else if (o.fx === "graph" && st.frag) { // a small Goldberg-graph fragment growing from the cursor point along the squiggle
			const F = st.frag, pts = F.v.map((v) => ({ x: st.x + v.du + PADX, y: waveY(G, st.x + v.du) + v.dy - 2, d: v.d, k: clamp((p * 1.6 - v.delay) * 2) * f }));
			for (const e of F.e) {
				const A = pts[e.a], B = pts[e.b], k = Math.min(A.k, B.k); if (k < 0.02) continue;
				const m = (A.d + B.d) / 2;
				for (let s = 0; s < 4; s++) {
					const u0 = s / 4, u1 = (s + 1) / 4, dd = A.d + (B.d - A.d) * (u0 + 0.125);
					g.strokeStyle = ink(e.a + 1, dd, 0.7 * k); g.lineWidth = 0.3 + dd * dd * 0.9;
					g.beginPath(); g.moveTo(A.x + (B.x - A.x) * u0, A.y + (B.y - A.y) * u0); g.lineTo(A.x + (B.x - A.x) * u1, A.y + (B.y - A.y) * u1); g.stroke();
				}
			}
			pts.forEach((q, i) => { if (q.k < 0.02) return; g.fillStyle = ink(i + 1, q.d, 0.95 * q.k); g.beginPath(); g.arc(q.x, q.y, 0.6 + q.d * 1.1, 0, TAU); g.fill(); });
		} else if (o.fx === "circuit") { // a thin pulse runs along the squiggle, pads light at the crests it passes
			const head = ((T * 0.45) % 1.3) * W - 0.15 * W;
			for (let i = 0; i < n; i++) {
				const c = crest(i), k = reach(c.u); if (k < 0.02) continue;
				const lit = Math.exp(-(((c.u - head) / 22) ** 2));
				g.strokeStyle = ink(1, 0.5, (0.35 + 0.6 * lit) * k); g.lineWidth = 0.5;
				g.beginPath(); g.arc(c.u + PADX, c.y - 3.4, 1.7 + lit * 0.8, 0, TAU); g.stroke();
				g.fillStyle = ink(1, 0.7, lit * 0.9 * k); g.beginPath(); g.arc(c.u + PADX, c.y - 3.4, 0.7, 0, TAU); g.fill();
			}
			const seg = 36; g.lineWidth = 0.7;
			for (let s = 0; s < 12; s++) {
				const u0 = head - seg + (s / 12) * seg, u1 = head - seg + ((s + 1) / 12) * seg;
				if (u1 < 0 || u0 > W) continue;
				const k = reach(clamp(u1, 0, W)); if (k < 0.02) continue;
				g.strokeStyle = ink(1, 0.8, (s / 12) * 0.9 * k); g.beginPath(); g.moveTo(u0 + PADX, waveY(G, u0) - 1); g.lineTo(u1 + PADX, waveY(G, u1) - 1); g.stroke();
			}
		} else if (o.fx === "drift") { // faint crest glow and a few star particles drifting up and fading
			for (let i = 0; i < n; i++) {
				const c = crest(i), k = reach(c.u); if (k < 0.02) continue;
				const cc = pal[i % pal.length], gr = g.createRadialGradient(c.u + PADX, c.y - 3, 0, c.u + PADX, c.y - 3, 7);
				gr.addColorStop(0, `rgba(${cc[0]},${cc[1]},${cc[2]},${(0.14 * k).toFixed(3)})`); gr.addColorStop(1, `rgba(${cc[0]},${cc[1]},${cc[2]},0)`);
				g.fillStyle = gr; g.fillRect(c.u + PADX - 8, c.y - 11, 16, 16);
			}
			for (const q of st.parts) {
				const a = Math.sin(clamp(q.age / q.life) * Math.PI) * f;
				g.fillStyle = ink(q.i, 0.5, 0.9 * a); g.beginPath(); g.arc(q.x + PADX + Math.sin(q.age * 2 + q.ph) * 2, q.y - q.age * q.vy, q.r, 0, TAU); g.fill();
			}
		}
	}
	function frame(now) {
		raf = 0;
		if (dead) return;
		const dt = Math.min(0.1, last ? (now - last) / 1000 : 0.016); last = now;
		const moving = now - st.lastMove < 450;
		st.e += ((moving ? 1 : 0) - st.e) * (1 - Math.exp(-dt * (moving ? 6 : 2.5)));
		if (st.a) { // hovering: the reveal advances only with pointer movement and holds when it stops
			st.t += dt * st.e;
			if (o.fx === "drift" && st.e > 0.2 && st.parts.length < 10 && Math.random() < dt * 5 * st.e * clamp(st.p)) {
				const G = st.G, i = Math.floor(Math.random() * Math.max(1, G.r.width / G.per));
				st.parts.push({ x: clamp(st.x + (Math.random() - 0.5) * 80, 0, G.r.width), y: waveY(G, st.x) - 4, vy: 6 + Math.random() * 8, age: 0, life: 1.6 + Math.random(), r: 0.5 + Math.random() * 0.7, i, ph: Math.random() * 6 });
			}
			for (const q of st.parts) q.age += dt * (0.4 + st.e * 0.6);
			st.parts = st.parts.filter((q) => q.age < q.life);
			st.fade = Math.min(1, st.fade + dt * 1.2);
		} else if (st.fade > 0) { st.fade = Math.max(0, st.fade - dt * 1.4); if (st.fade === 0) { cv.style.display = "none"; st.G = null; } }
		if (o.fx === "constellation") { const l = st.a || st.dimLink; if (l) { l.style.setProperty("--vsDim", (1 - 0.55 * clamp(st.p) * st.fade).toFixed(3)); st.dimLink = st.fade > 0 ? l : null; if (!st.dimLink) l.style.removeProperty("--vsDim"); } }
		if (st.G) render();
		if (st.a || st.fade > 0) raf = requestAnimationFrame(frame); else last = 0;
	}
	const wake = () => { if (!raf && !dead && !document.hidden && !reduced) raf = requestAnimationFrame(frame); };
	const onMove = (e) => {
		if (reduced || e.pointerType === "touch") return;
		const a = e.target?.closest?.(".site-link");
		if (a !== st.a) {
			if (a) begin(a, e);
			else { st.a = null; }
			wake();
		}
		if (st.a) {
			st.lastMove = performance.now();
			const G = st.G; const x = clamp(e.clientX - G.r.left, 0, G.r.width);
			if (st.lastX != null) st.p = Math.min(1, st.p + Math.abs(x - st.lastX + 0.0) / 520 + 0.0015); // slow: roughly 500px of travel to bloom
			st.lastX = x; st.x = x;
			wake();
		}
	};
	addEventListener("pointermove", onMove, { passive: true });
	const onOut = (e) => { if (!e.relatedTarget) { st.a = null; wake(); } };
	document.addEventListener("pointerout", onOut, { passive: true });
	return () => {
		dead = true; cancelAnimationFrame(raf);
		root.removeEventListener("pointerover", enter);
		removeEventListener("pointermove", onMove); document.removeEventListener("pointerout", onOut);
		root.classList.remove("vs-sq"); cv.remove();
		for (const a of links) { a.style.removeProperty("--vsRb"); a.style.removeProperty("--vsx"); }
	};
}
