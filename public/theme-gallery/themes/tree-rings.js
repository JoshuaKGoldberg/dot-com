// 149: a tree-ring cross-section. One ring per year (wider = more posts that year); notches are posts, sized by reading time.
// Data: themes/post-covers/site-data.json (pubDate, estimated reading time from the post body).
import { loadData, mountCanvas, loop, makeTip, esc, cssVar, rng, dayOfYear } from "./post-covers/lib.js";

export function activate({ root, reducedMotion }) {
	const layer = root.querySelector(".scenery-a");
	const cv = mountCanvas(layer);
	const tip = makeTip(root);
	const { ctx } = cv;
	let rings = [], dark, geo, progress = reducedMotion ? 1 : 0, hot = null, hotRing = null;
	const TAU = Math.PI * 2;

	function layout() {
		cv.fit();
		const { w, h } = cv;
		dark = document.documentElement.classList.contains("dark");
		const R = Math.min(w, h) * (w >= 1100 ? 0.56 : 0.5);
		geo = { cx: w >= 1100 ? w - R * 0.62 : w * 0.72, cy: h * 0.6, R };
		layer.style.opacity = w >= 1100 ? "1" : "0.45";
	}

	function build({ posts }) {
		const by = new Map();
		for (const p of posts) {
			const y = +p.date.slice(0, 4);
			(by.get(y) ?? by.set(y, []).get(y)).push({ ...p, doy: dayOfYear(p.date) });
		}
		const years = [...by.keys()];
		const widths = years.map((y) => 1.2 + by.get(y).length * 0.9);
		const total = widths.reduce((a, b) => a + b, 0) + 1.5;
		let acc = 1.5;
		rings = years.map((year, i) => {
			const r = rng(year * 31 + 5);
			const harm = [2, 3, 5, 8].map((k) => ({ k, a: (0.012 + r() * 0.02) / (k / 3), p: r() * TAU }));
			const inner = acc / total;
			acc += widths[i];
			return { year, posts: by.get(year), inner, outer: acc / total, harm };
		});
	}

	const wob = (ring, th, scale = 1) => 1 + ring.harm.reduce((s, q) => s + q.a * Math.sin(th * q.k + q.p), 0) * scale;
	const ang = (doy) => (doy / 365) * TAU - Math.PI / 2;

	function ringPath(ring, k, r) {
		const { cx, cy, R } = geo;
		const p = new Path2D();
		for (let i = 0; i <= 180; i++) {
			const th = (i / 180) * TAU;
			const rr = R * r * k * wob(ring, th);
			const x = cx + Math.cos(th - Math.PI / 2) * rr, y = cy + Math.sin(th - Math.PI / 2) * rr;
			i ? p.lineTo(x, y) : p.moveTo(x, y);
		}
		p.closePath();
		return p;
	}

	function draw() {
		const { w, h } = cv, { cx, cy, R } = geo;
		ctx.clearRect(0, 0, w, h);
		const n = rings.length;
		const pal = dark
			? { bark: "#0d0906", a: "#2b1d12", b: "#3b2815", line: "rgba(255,170,90,0.6)", glow: "rgba(255,160,80,0.10)", notch: "#0a0705", dot: "#ffd9a0", text: "#e9c79b" }
			: { bark: "#5a3a1e", a: "#ecd6a8", b: "#d9b878", line: "rgba(110,70,30,0.55)", glow: "rgba(255,255,255,0.0)", notch: "#6a4320", dot: "#8a3b10", text: "#6a4320" };
		const grow = 1 - Math.pow(1 - progress, 3);
		// bark
		const bark = new Path2D();
		bark.arc(cx, cy, R * 1.035 * grow, 0, TAU);
		ctx.fillStyle = pal.bark;
		ctx.fill(bark);
		// rings from outside in
		for (let i = n - 1; i >= 0; i--) {
			const ring = rings[i];
			const local = Math.max(0, Math.min(1, grow * (n + 1) - i));
			if (local <= 0) continue;
			const outer = ringPath(ring, local, ring.outer);
			const g = ctx.createRadialGradient(cx, cy, R * ring.inner, cx, cy, R * ring.outer);
			g.addColorStop(0, pal.a);
			g.addColorStop(1, pal.b);
			ctx.fillStyle = hotRing === ring ? (dark ? "#4a3118" : "#f3e1b8") : g;
			ctx.fill(outer);
			ctx.lineWidth = 1.2;
			ctx.strokeStyle = pal.line;
			ctx.stroke(outer);
		}
		// radial checks (cracks)
		ctx.strokeStyle = dark ? "rgba(0,0,0,0.5)" : "rgba(90,55,25,0.35)";
		ctx.lineWidth = 1.2;
		ctx.beginPath();
		[[0.35, 0.8], [2.4, 0.55], [4.3, 0.65]].forEach(([a, l]) => {
			let x = cx, y = cy;
			ctx.moveTo(x, y);
			for (let s = 1; s <= 12; s++) {
				const rr = (R * l * s) / 12;
				ctx.lineTo(cx + Math.cos(a) * rr + Math.sin(s * 3.1 + a) * 2, cy + Math.sin(a) * rr + Math.cos(s * 2.3 + a) * 2);
			}
		});
		ctx.stroke();
		// pith
		ctx.beginPath();
		ctx.arc(cx, cy, R * 0.012 + 3, 0, TAU);
		ctx.fillStyle = pal.dot;
		ctx.fill();
		// notches (posts)
		if (progress > 0.6) {
			const fade = Math.min(1, (progress - 0.6) / 0.4);
			ctx.globalAlpha = fade;
			for (const ring of rings) {
				for (const p of ring.posts) {
					const th = ang(p.doy);
					const wobv = wob(ring, th + Math.PI / 2);
					const ro = R * ring.outer * wobv;
					const len = (R * (ring.outer - ring.inner)) * (0.25 + Math.min(p.minutes, 25) / 25 * 0.6);
					const hw = 0.012 + Math.min(p.minutes, 25) / 25 * 0.02;
					const c = Math.cos(th), s = Math.sin(th);
					ctx.beginPath();
					ctx.moveTo(cx + c * ro, cy + s * ro);
					ctx.lineTo(cx + Math.cos(th - hw) * (ro - len), cy + Math.sin(th - hw) * (ro - len));
					ctx.lineTo(cx + Math.cos(th + hw) * (ro - len), cy + Math.sin(th + hw) * (ro - len));
					ctx.closePath();
					ctx.fillStyle = p === hot ? pal.dot : pal.notch;
					ctx.fill();
					ctx.beginPath();
					ctx.arc(cx + c * (ro - len), cy + s * (ro - len), p === hot ? 4.5 : 2, 0, TAU);
					ctx.fillStyle = pal.dot;
					ctx.fill();
					p._x = cx + c * (ro - len * 0.5);
					p._y = cy + s * (ro - len * 0.5);
					p._ring = ring;
				}
			}
			// year labels along a ray
			ctx.font = `700 11px ${cssVar(root, "--siteFont")}`;
			ctx.fillStyle = pal.text;
			ctx.textAlign = "left";
			for (const ring of rings) {
				const rr = R * (ring.outer - 0.004);
				ctx.fillText(String(ring.year), cx - rr * Math.cos(0.2) + 4, cy - rr * Math.sin(0.2) * -1 * -1 + 0);
			}
			ctx.globalAlpha = 1;
		}
	}

	function onMove(e) {
		if (!rings.length || progress < 1) return;
		const r = layer.getBoundingClientRect();
		const x = e.clientX - r.left, y = e.clientY - r.top;
		let best = null, bd = 13 * 13;
		for (const ring of rings) for (const p of ring.posts) {
			if (p._x == null) continue;
			const d = (p._x - x) ** 2 + (p._y - y) ** 2;
			if (d < bd) { bd = d; best = p; }
		}
		let ringHit = null;
		if (!best) {
			const d = Math.hypot(x - geo.cx, y - geo.cy) / geo.R;
			ringHit = rings.find((q) => d >= q.inner && d <= q.outer) ?? null;
		}
		if (best !== hot || ringHit !== hotRing) {
			hot = best;
			hotRing = best ? best._ring : ringHit;
			if (best) tip.show(`<b>${esc(best.title)}</b><small>${esc(best.date)} · ${best.minutes} min read</small>`, e.clientX, e.clientY);
			else if (ringHit) tip.show(`<b>${ringHit.year}</b><small>${ringHit.posts.length} post${ringHit.posts.length > 1 ? "s" : ""} · ${ringHit.posts.reduce((a, p) => a + p.minutes, 0)} min of reading</small>`, e.clientX, e.clientY);
			else tip.hide();
			draw();
		}
	}

	const onResize = () => { layout(); if (rings.length) draw(); };
	window.addEventListener("resize", onResize);
	window.addEventListener("pointermove", onMove, { passive: true });
	layout();
	const note = document.createElement("div");
	note.className = "tr-note";
	note.textContent = "Ring width = posts that year · notches = posts, longer = longer read";
	root.querySelector(".overlay-a").append(note);

	let runner, dead = false;
	loadData().then((data) => {
		if (dead) return;
		build(data);
		if (reducedMotion) { draw(); return; }
		runner = loop((dt) => { progress = Math.min(1, progress + dt / 2.4); draw(); return progress < 1; });
	});
	return () => {
		dead = true;
		runner?.stop();
		window.removeEventListener("resize", onResize);
		window.removeEventListener("pointermove", onMove);
	};
}
