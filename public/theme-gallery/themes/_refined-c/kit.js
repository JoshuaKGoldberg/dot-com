/*
 * Shared kit for the Refined Aurora margin-star themes (#306, #307, #308, #319).
 * raisedAurora: the _medium-a canvas aurora, lifted to the very top and scaled to a subtlety level.
 * sideSky: margin canvases (outside the content column) with a pre-rendered galaxy band.
 * ticker: fixed-timestep loop that sleeps when idle. trackPointer: position + velocity.
 */
import { createAuroraCanvas, curtain, marginness, smooth, clamp } from "../_medium-a/kit.js";
export { clamp, smooth };
export const isDark = () => document.documentElement.classList.contains("dark");
export const lerp = (a, b, t) => a + (b - a) * t;
export const TAU = Math.PI * 2;
export const rng = (seed) => {
	let s = (seed >>> 0) || 1;
	return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
};

const LEVEL = { 1: 0.34, 2: 0.6, 3: 0.85 };

/** Raised top aurora: hem at ~6% of viewport height, feathered out by ~24%. */
export function raisedAurora({ root, reducedMotion, level = 1 }) {
	const k = LEVEL[level] ?? LEVEL[1];
	const field = curtain({
		bands: 3,
		base: (u, b, S) => S.h * (0.062 + 0.022 * Math.pow(Math.abs(2 * u - 1), 1.5) + b * 0.014),
		hgt: (u, S) => S.h * (0.062 + 0.025 * Math.abs(2 * u - 1)),
		mx: (x, S) => 0.55 + 0.6 * marginness(x, S.w, 400, 0.2),
		fade: (y, S) => 1 - smooth(S.h * 0.12, S.h * 0.245, y),
		rayAmp: (S) => 0.25 + 0.25 * S.energy,
		edge: (S) => S.h * 0.03,
		pull: 0.32,
		sig: 0.2,
		gain: 1.75 * k,
	});
	return createAuroraCanvas({ root, reducedMotion, scrollAway: true, host: root.querySelector(".scenery-b"), field, rest: [0.5, 0.06], clampY: [0, 0.12] });
}

/** Fixed-timestep loop that sleeps when step() returns false. */
export function ticker({ step, render, hz = 60, fps = 60 }) {
	let raf = 0, last = 0, acc = 0, lastR = 0, alive = true, busy = true;
	const frame = (now) => {
		raf = 0;
		if (!alive || document.hidden) return;
		acc += Math.min(0.1, (now - last) / 1000 || 0.016);
		last = now;
		const h = 1 / hz;
		let n = 0;
		while (acc >= h && n < 6) { busy = step(h); acc -= h; n++; }
		if (n === 6) acc = 0;
		if (now - lastR >= 1000 / fps - 3 || !busy) { render(); lastR = now; }
		if (busy) raf = requestAnimationFrame(frame);
	};
	const wake = () => {
		if (raf || !alive || document.hidden) return;
		last = performance.now(); busy = true;
		raf = requestAnimationFrame(frame);
	};
	const onVis = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else wake(); };
	document.addEventListener("visibilitychange", onVis);
	return { wake, destroy() { alive = false; cancelAnimationFrame(raf); raf = 0; document.removeEventListener("visibilitychange", onVis); } };
}

/** Client-space pointer with smoothed velocity (px/s). */
export function trackPointer(onMove) {
	const p = { x: -1e4, y: -1e4, vx: 0, vy: 0, seen: false, t: 0 };
	let lx = 0, ly = 0, lt = 0;
	const h = (e) => {
		const now = performance.now();
		if (lt) {
			const dt = Math.max(8, now - lt) / 1000;
			p.vx = p.vx * 0.35 + clamp((e.clientX - lx) / dt, -4000, 4000) * 0.65;
			p.vy = p.vy * 0.35 + clamp((e.clientY - ly) / dt, -4000, 4000) * 0.65;
		}
		lx = e.clientX; ly = e.clientY; lt = now;
		p.x = lx; p.y = ly; p.seen = true; p.t = now;
		onMove?.(p);
	};
	addEventListener("pointermove", h, { passive: true });
	return { p, destroy: () => removeEventListener("pointermove", h) };
}

export const STAR = { dark: [214, 228, 252], light: [86, 96, 150] };

/** Soft diagonal Milky Way glow (+ optional dust) painted once; fades out toward the content column. */
export function paintGalaxy(ctx, w, h, { dark, seed, side, dust = 260, alpha = 1 }) {
	const r = rng(seed);
	ctx.clearRect(0, 0, w, h);
	ctx.save();
	const sx = side === 0 ? 1 : -1;
	ctx.translate(w / 2, h / 2);
	ctx.rotate(sx * -0.42);
	const L = Math.hypot(w, h);
	const T = Math.max(w * 0.9, 150);
	const g = ctx.createLinearGradient(0, -T, 0, T);
	const c1 = dark ? "150,170,255" : "150,150,220", c2 = dark ? "200,150,255" : "230,160,200";
	const A = (dark ? 0.1 : 0.12) * alpha;
	g.addColorStop(0, `rgba(${c1},0)`); g.addColorStop(0.38, `rgba(${c1},${A * 0.55})`); g.addColorStop(0.5, `rgba(${c2},${A})`); g.addColorStop(0.62, `rgba(${c1},${A * 0.55})`); g.addColorStop(1, `rgba(${c1},0)`);
	ctx.fillStyle = g; ctx.fillRect(-L, -T, 2 * L, 2 * T);
	// bright knots along the band
	for (let i = 0; i < 7; i++) {
		const x = (r() - 0.5) * L * 0.8, y = (r() - 0.5) * T * 0.3, rad = 50 + r() * 80;
		const rg = ctx.createRadialGradient(x, y, 0, x, y, rad);
		const col = r() > 0.5 ? c1 : c2;
		rg.addColorStop(0, `rgba(${col},${(dark ? 0.12 : 0.1) * alpha})`); rg.addColorStop(1, `rgba(${col},0)`);
		ctx.fillStyle = rg; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
	}
	const rgb = dark ? "225,232,255" : "100,110,170";
	for (let i = 0; i < dust; i++) {
		const gx = (r() + r() + r() - 1.5) * L * 0.42, gy = (r() + r() + r() - 1.5) * T * 0.34;
		ctx.fillStyle = `rgba(${rgb},${(0.1 + r() * 0.3) * alpha * (dark ? 1 : 0.8)})`;
		ctx.fillRect(gx, gy, 1, 1);
	}
	ctx.restore();
	// fade toward the content column
	ctx.globalCompositeOperation = "destination-in";
	const f = ctx.createLinearGradient(0, 0, w, 0);
	const inner = side === 0 ? [0, 0.12, 0.62, 1] : [1, 0.88, 0.38, 0];
	f.addColorStop(inner[0], "rgba(0,0,0,0.5)"); f.addColorStop(inner[1], "rgba(0,0,0,1)"); f.addColorStop(inner[2], "rgba(0,0,0,0.9)"); f.addColorStop(inner[3], "rgba(0,0,0,0)");
	ctx.fillStyle = f; ctx.fillRect(0, 0, w, h);
	ctx.globalCompositeOperation = "source-over";
}

/**
 * Margin canvases. Calls onLayout(sides) after each (re)layout. Each side:
 * { i, w, h, x0 (px in host), bg, c, ctx, dpr }. Hidden when a margin is narrower than minW.
 */
export function sideSky({ root, host, minW = 96, gap = 18, maxW = 340, galaxy = true, galaxyDust = 260, galaxyAlpha = 1, seed = 1, onLayout }) {
	const page = root.querySelector(".site-page");
	let sides = [], hostRect = { left: 0, top: 0 }, dead = false, timer = 0;
	const api = { sides, hostRect, get dark() { return isDark(); }, toLocal: (s, x, y) => [x - hostRect.left - s.x0, y - hostRect.top], destroy };
	function layout() {
		timer = 0;
		if (dead) return;
		for (const s of sides) { s.bg.remove(); s.c.remove(); }
		sides = api.sides = [];
		const hr = host.getBoundingClientRect(), pr = page.getBoundingClientRect();
		hostRect.left = hr.left; hostRect.top = hr.top;
		api.W = hr.width; api.H = hr.height;
		const colL = pr.left - hr.left, colR = pr.right - hr.left;
		const wl = Math.min(colL - gap, maxW), wr = Math.min(hr.width - colR - gap, maxW);
		if (wl >= minW && wr >= minW) {
			const dark = isDark();
			[0, 1].forEach((i) => {
				const w = Math.round(i === 0 ? wl : wr), h = Math.round(hr.height);
				const x0 = Math.round(i === 0 ? colL - gap - w : colR + gap);
				const mk = (cls) => { const c = document.createElement("canvas"); c.className = cls; c.style.cssText = `position:absolute;left:${x0}px;top:0;width:${w}px;height:${h}px;pointer-events:none`; host.appendChild(c); return c; };
				const bg = mk("rac-bg"), c = mk("rac-stars");
				const dpr = Math.min(devicePixelRatio || 1, 1.5);
				c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
				const ctx = c.getContext("2d");
				ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
				const s = { i, w, h, x0, bg, c, ctx, dpr, dark };
				if (galaxy) {
					bg.width = Math.round(w / 2); bg.height = Math.round(h / 2);
					const bx = bg.getContext("2d");
					bx.scale(0.5, 0.5);
					paintGalaxy(bx, w, h, { dark, seed: seed * 7 + i, side: i, dust: galaxyDust, alpha: galaxyAlpha });
				}
				sides.push(s);
			});
		}
		onLayout?.(sides, api);
	}
	const sched = () => { clearTimeout(timer); timer = setTimeout(layout, 120); };
	const ro = new ResizeObserver(sched);
	ro.observe(root);
	const mo = new MutationObserver(sched);
	mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
	layout();
	function destroy() {
		dead = true; clearTimeout(timer); ro.disconnect(); mo.disconnect();
		for (const s of sides) { s.bg.remove(); s.c.remove(); }
	}
	return api;
}

/** Random stars in a w*h box. */
export function makeStars(r, n, w, h) {
	return Array.from({ length: n }, () => ({ x: r() * w, y: r() * h, r: 0.7 + r() * r() * 1.5, a: 0.35 + r() * 0.65, ph: r() * TAU }));
}

/** Draw a soft star dot. */
export function dot(ctx, x, y, r, rgb, a) {
	ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
	if (r <= 1.1) ctx.fillRect(x - r * 0.5, y - r * 0.5, r, r);
	else { ctx.beginPath(); ctx.arc(x, y, r * 0.8, 0, TAU); ctx.fill(); }
}

/** Run fn only while el intersects the viewport. */
export function whenVisible(el, root, fn) {
	let stop = null;
	const io = new IntersectionObserver((es) => {
		const on = es.some((e) => e.isIntersecting);
		if (on && !stop) stop = fn() || (() => {});
		else if (!on && stop) { stop(); stop = null; }
	}, { root: null, rootMargin: "80px" });
	io.observe(el);
	return () => { io.disconnect(); stop?.(); stop = null; };
}

/** Footer decoration host: full-width absolutely positioned box behind footer text. */
export function footerHost(root, height = 260) {
	const footer = root.querySelector(".site-footer");
	footer.style.position = "relative"; footer.style.isolation = "isolate";
	const box = document.createElement("div");
	box.className = "rac-footer";
	const place = () => { box.style.cssText = `position:absolute;z-index:-1;pointer-events:none;left:50%;margin-left:${-root.clientWidth / 2}px;width:${root.clientWidth}px;bottom:-3rem;height:${height}px;overflow:hidden`; };
	place();
	footer.appendChild(box);
	const ro = new ResizeObserver(place); ro.observe(root);
	return { box, footer, destroy: () => { ro.disconnect(); box.remove(); } };
}
