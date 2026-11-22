// 154: a force-directed graph of the page's own links and topics floats behind it; hover a link (or a node) to light its neighborhood.
import { loadData, mountCanvas, loop, makeTip, esc, cssVar, hash, rng } from "./post-covers/lib.js";

const TOPICS = [
	["typescript", /typescript/i],
	["eslint", /eslint/i],
	["linting", /lint|flint/i],
	["open source", /open source|maintainer|project|contribut/i],
	["conferences", /revo|wey wey|conference|\b20\d\d\b.*(?:summit|conf)/i],
	["podcasts", /podcast|devtools\.fm/i],
	["book", /book|o'reilly|learning typescript/i],
	["css & style", /css|style/i],
	["work", /sentry|dev at/i],
];

export function activate({ root, reducedMotion }) {
	const layer = root.querySelector(".scenery-a");
	const cv = mountCanvas(layer);
	const tip = makeTip(root);
	const { ctx } = cv;
	const nodes = [], edges = [];
	let dark, col, hot = null, alpha = 1, t = 0;
	const byEl = new Map();

	function add(n) { n.i = nodes.length; n.deg = 0; n.vx = n.vy = 0; nodes.push(n); return n; }
	const link = (a, b) => { edges.push([a, b]); a.deg++; b.deg++; (a.nb ??= new Set()).add(b); (b.nb ??= new Set()).add(a); };

	function build(tagData) {
		const hub = add({ kind: "hub", label: "Josh", r: 11 });
		const secs = {};
		const sec = (key, label) => (secs[key] ??= (() => { const s = add({ kind: "section", label, r: 8 }); link(hub, s); return s; })());
		const topics = {};
		const topic = (name) => (topics[name] ??= add({ kind: "topic", label: name, r: 6 }));
		const anchors = [...root.querySelectorAll(".site-main a.site-link, .site-footer a.site-link")];
		for (const a of anchors) {
			const li = a.closest("li, p, .site-footer");
			const key = a.closest(".site-posts") ? ["posts", "Writing"] : a.closest(".site-projects") ? ["projects", "Projects"] : a.closest(".site-talks") ? ["talks", "Speaking"] : ["elsewhere", "Elsewhere"];
			const n = add({ kind: "link", label: a.textContent.trim(), r: 3.5, el: a, section: key[1] });
			byEl.set(a, n);
			link(sec(key[0], key[1]), n);
			const blob = (a.closest(".site-item")?.textContent ?? a.parentElement.textContent) + " " + a.textContent;
			for (const [name, re] of TOPICS) if (re.test(blob)) link(n, topic(name));
		}
		// topics that most often appear in the real post tags get a size bump
		const tc = new Map();
		for (const p of tagData.posts) for (const tg of p.tags) tc.set(tg, (tc.get(tg) ?? 0) + 1);
		for (const [name, n] of Object.entries(topics)) {
			const real = [...tc.entries()].filter(([k]) => name.split(" ").some((w) => k.includes(w))).reduce((s, [, v]) => s + v, 0);
			n.posts = real;
			n.r = 5 + Math.min(6, n.deg * 0.8);
		}
		const r = rng(hash("link-graph"));
		nodes.forEach((n, k) => { const a = (k / nodes.length) * 6.28 + r(); const rad = 80 + r() * 180; n.x = cv.w / 2 + Math.cos(a) * rad; n.y = cv.h / 2 + Math.sin(a) * rad * 0.7; });
	}

	function colors() {
		dark = document.documentElement.classList.contains("dark");
		col = {
			hub: dark ? "#ffd479" : "#c2410c", section: dark ? "#77bbff" : "#1170d0", topic: dark ? "#7ee0c0" : "#0f8a6d", link: dark ? "#aab9d4" : "#4a5a7c",
			edge: dark ? "rgba(150,185,235,0.22)" : "rgba(40,70,130,0.2)", text: cssVar(root, "--siteFgStrong"), muted: cssVar(root, "--siteMuted"),
		};
	}

	function layout() { cv.fit(); colors(); }

	function tick() {
		const { w, h } = cv;
		const K = Math.min(w, h) / 6.5;
		for (const a of nodes) { a.fx = (w / 2 - a.x) * 0.0015; a.fy = (h / 2 - a.y) * 0.004;
			if (w > 1000) { const half = Math.min(430, w * 0.34), off = a.x - w / 2; if (Math.abs(off) < half) a.fx += Math.sign(off || (a.i % 2 ? 1 : -1)) * (half - Math.abs(off)) * 0.06; } }
		for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
			const a = nodes[i], b = nodes[j];
			let dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy + 0.01;
			const d = Math.sqrt(d2);
			const f = (K * K * 0.9) / d2;
			dx /= d; dy /= d;
			a.fx += dx * f * 0.35; a.fy += dy * f * 0.35;
			b.fx -= dx * f * 0.35; b.fy -= dy * f * 0.35;
		}
		for (const [a, b] of edges) {
			const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
			const want = K * (a.kind === "hub" || b.kind === "hub" ? 1.1 : 0.62);
			const f = (d - want) * 0.012;
			a.fx += (dx / d) * f; a.fy += (dy / d) * f;
			b.fx -= (dx / d) * f; b.fy -= (dy / d) * f;
		}
		for (const n of nodes) {
			n.vx = (n.vx + n.fx) * 0.82; n.vy = (n.vy + n.fy) * 0.82;
			n.x += n.vx * alpha * 2.2; n.y += n.vy * alpha * 2.2;
			n.x = Math.max(60, Math.min(w - 90, n.x));
			n.y = Math.max(50, Math.min(h - 30, n.y));
		}
	}

	function draw() {
		const { w, h } = cv;
		ctx.clearRect(0, 0, w, h);
		const lit = hot ? new Set([hot, ...hot.nb]) : null;
		const dx = (n) => (reducedMotion ? 0 : Math.sin(t * 0.5 + n.i * 1.7) * 3);
		const dy = (n) => (reducedMotion ? 0 : Math.cos(t * 0.43 + n.i * 1.3) * 3);
		ctx.lineWidth = 1;
		for (const [a, b] of edges) {
			const on = !lit || (lit.has(a) && lit.has(b) && (a === hot || b === hot));
			ctx.strokeStyle = on && lit ? col.section : col.edge;
			ctx.globalAlpha = lit ? (on ? 0.95 : 0.25) : 1;
			ctx.lineWidth = on && lit ? 1.8 : 1;
			ctx.beginPath();
			ctx.moveTo(a.x + dx(a), a.y + dy(a));
			ctx.lineTo(b.x + dx(b), b.y + dy(b));
			ctx.stroke();
		}
		ctx.globalAlpha = 1;
		ctx.font = `600 12px ${cssVar(root, "--siteFont")}`;
		ctx.textBaseline = "middle";
		for (const n of nodes) {
			const x = n.x + dx(n), y = n.y + dy(n);
			const on = !lit || lit.has(n);
			ctx.globalAlpha = on ? 1 : 0.22;
			const c = col[n.kind];
			if (n === hot || (lit && on && n.kind !== "link")) {
				const g = ctx.createRadialGradient(x, y, 0, x, y, n.r * 4);
				g.addColorStop(0, c + "66");
				g.addColorStop(1, c + "00");
				ctx.fillStyle = g;
				ctx.fillRect(x - n.r * 4, y - n.r * 4, n.r * 8, n.r * 8);
			}
			ctx.fillStyle = c;
			ctx.beginPath();
			ctx.arc(x, y, n.r * (n === hot ? 1.35 : 1), 0, 7);
			ctx.fill();
			if (n.kind === "hub") { ctx.strokeStyle = c; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, n.r + 5, 0, 7); ctx.stroke(); }
			if (n.kind !== "link" || (lit && on)) {
				ctx.fillStyle = n.kind === "link" ? col.text : n.kind === "topic" ? col.topic : col.text;
				ctx.fillText(n.label, x + n.r + 5, y);
			}
		}
		ctx.globalAlpha = 1;
	}

	function setHot(n, e) {
		if (n === hot) return;
		hot?.el?.classList.remove("lg-lit");
		hot = n;
		n?.el?.classList.add("lg-lit");
		alpha = Math.max(alpha, 0.3);
		if (e && n) tip.show(`<b>${esc(n.label)}</b><small>${n.kind === "topic" ? `${n.deg} links${n.posts ? ` · ${n.posts} tagged posts` : ""}` : n.kind === "link" ? esc(n.section) + " · " + n.nb.size + " connections" : n.nb.size + " links"}</small>`, e.clientX, e.clientY);
		else tip.hide();
		if (reducedMotion) draw(); else runner?.kick();
	}
	function onOver(e) {
		const a = e.target.closest?.("a.site-link");
		const n = a && byEl.get(a);
		if (n) setHot(n);
	}
	function onOut(e) { if (e.target.closest?.("a.site-link")) setHot(null); }
	function onMove(e) {
		if (!nodes.length || e.target.closest?.(".site-main, .site-header")) return;
		const r = layer.getBoundingClientRect();
		const x = e.clientX - r.left, y = e.clientY - r.top;
		let best = null, bd = 14 * 14;
		for (const n of nodes) { const d = (n.x - x) ** 2 + (n.y - y) ** 2; if (d < bd) { bd = d; best = n; } }
		setHot(best, e);
	}

	const onResize = () => { layout(); alpha = 1; if (reducedMotion) { for (let i = 0; i < 260; i++) tick(); draw(); } else runner?.kick(); };
	window.addEventListener("resize", onResize);
	window.addEventListener("pointermove", onMove, { passive: true });
	root.addEventListener("mouseover", onOver);
	root.addEventListener("mouseout", onOut);
	layout();
	const hint = document.createElement("div");
	hint.className = "lg-hint";
	hint.textContent = "Hover any link on the page to light its place in the graph";
	root.querySelector(".overlay-a").append(hint);

	let runner, dead = false;
	loadData().then((data) => {
		if (dead) return;
		build(data);
		if (reducedMotion) { for (let i = 0; i < 300; i++) tick(); draw(); return; }
		runner = loop((dt, tt) => {
			t = tt;
			if (alpha > 0.02) { tick(); alpha *= 0.992; }
			draw();
		});
	});
	return () => {
		dead = true;
		runner?.stop();
		hot?.el?.classList.remove("lg-lit");
		window.removeEventListener("resize", onResize);
		window.removeEventListener("pointermove", onMove);
		root.removeEventListener("mouseover", onOver);
		root.removeEventListener("mouseout", onOut);
	};
}
