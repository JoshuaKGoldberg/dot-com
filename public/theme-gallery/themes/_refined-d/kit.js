/*
 * Wave 12 "texture group" kit (#311-313, #317).
 * - raisedAurora: the #282 curtain field lifted to the very top, at a level 1-3.
 * - pigmentPainter: watercolor pigment strokes (from #257) for top / footer auroras.
 * - washes: pre-rendered pastel gradient blobs, moved with transform + opacity only.
 * - marginStars: sparse night stars in the side margins (CSS opacity twinkle).
 * - fullBleed / whenVisible: helpers for footer decorations.
 */
import { starrySky } from "../_sky/stars.js";
import { createAuroraCanvas, curtain, marginness, smooth } from "../_medium-a/kit.js";
import { clamp, lerp, disposer, pointer, loop, grainTile, rng } from "../_quiet-d/kit.js";
export { clamp, lerp, disposer, pointer, loop, grainTile, rng, smooth };

export const isDark = () => document.documentElement.classList.contains("dark");
const idleCb = window.requestIdleCallback || ((fn) => setTimeout(fn, 60));
const cancelIdle = window.cancelIdleCallback || clearTimeout;
export const idle = (fn) => {
	const id = idleCb(fn);
	return () => cancelIdle(id);
};

/* ---------- raised curtain aurora (#282 DNA, centered at 4-10% of the viewport) ---------- */
// Gain relative to #282's 1.75: level 1 ~30%, 2 ~55%, 3 ~80%.
const LEVEL_GAIN = { 1: 0.5, 2: 0.9, 3: 1.3 };
export function raisedAurora(root, level, d) {
	const field = curtain({
		bands: 3,
		base: (u, b, S) => S.h * (0.062 + b * 0.016),
		hgt: (u, S) => S.h * (0.075 + 0.02 * Math.sin(u * 5)),
		mx: (x, S) => 0.72 + 0.4 * marginness(x, S.w, 400, 0.2),
		fade: (y, S) => 1 - smooth(S.h * 0.15, S.h * 0.25, y),
		rayAmp: (S) => 0.24 + 0.25 * S.energy,
		edge: (S) => S.h * 0.045,
		pull: 0.34,
		sig: 0.2,
		gain: 1.75 * LEVEL_GAIN[level],
	});
	const a = createAuroraCanvas({
		root,
		reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches || root.closest("html")?.classList.contains("reduce-motion"),
		scrollAway: true,
		host: root.querySelector(".scenery-b"),
		field,
		rest: [0.5, 0.07],
		clampY: [0, 0.16],
	});
	d.add(() => a.destroy());
	return a;
}

/* ---------- watercolor pigment strokes ---------- */
export const PIG = {
	dark: [[70, 255, 175], [70, 190, 255], [180, 120, 255], [255, 110, 160]],
	light: [[60, 190, 150], [90, 160, 225], [170, 125, 215], [235, 130, 160]],
};
function strokeSprite(rgb, a) {
	const W = 64, H = 128, c = document.createElement("canvas");
	c.width = W; c.height = H;
	const x = c.getContext("2d");
	x.translate(W / 2, H / 2); x.scale(1, H / W);
	const g = x.createRadialGradient(0, 0, 0, 0, 0, W / 2);
	const col = (k) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${(a * k).toFixed(4)})`;
	g.addColorStop(0, col(0.55));
	g.addColorStop(0.6, col(0.5));
	g.addColorStop(0.8, col(0.62)); // pigment pools at the edge
	g.addColorStop(1, col(0));
	x.fillStyle = g; x.fillRect(-W / 2, -W / 2, W, W);
	return c;
}
export function pigmentPainter({ dark, A, bands = 3, seed = 8 }) {
	const pig = PIG[dark ? "dark" : "light"].slice(0, bands);
	const sprites = pig.map((c) => strokeSprite(c, A));
	const rnd = rng(seed);
	const seeds = pig.map(() => [rnd() * 6, rnd() * 6]);
	const jit = pig.map(() => Array.from({ length: 160 }, () => [rnd(), rnd(), rnd()]));
	/** o: { w, t, lx, ly, energy, base(u,b,ph)->y, hg(u,b)->px, hasPtr } in CSS px; sc = canvas px per CSS px */
	return function paint(ctx, sc, o) {
		ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
		ctx.globalCompositeOperation = dark ? "lighter" : "source-over";
		const sig = o.w * 0.16, ph = o.t * 0.1;
		const n = Math.ceil(o.w / 12) + 1;
		for (let b = 0; b < bands; b++) {
			for (let i = 0; i < n; i++) {
				const j = jit[b][i % 160];
				const x = i * 12 + (j[0] - 0.5) * 8, u = x / o.w;
				const dx = x - o.lx;
				const g = o.hasPtr ? Math.exp(-(dx * dx) / (2 * sig * sig)) : 0;
				let by = o.base(u, b, ph, seeds[b]);
				by += (o.ly - by) * 0.3 * g;
				const hg = o.hg(u, b) * (0.8 + 0.4 * j[1]) * (1 + 0.5 * g * (0.4 + o.energy));
				const wd = (o.wd?.[0] ?? 80) + (o.wd?.[1] ?? 60) * j[2];
				ctx.globalAlpha = clamp((0.5 + 0.5 * g * (0.5 + o.energy)) * (0.7 + 0.4 * j[1]) * (1 - 0.12 * b), 0, 1);
				ctx.drawImage(sprites[b], (x - wd / 2 - dx * 0.22 * g) * sc, (by - hg / 2) * sc, wd * sc, hg * sc);
			}
		}
		ctx.globalAlpha = 1;
		ctx.globalCompositeOperation = "source-over";
	};
}

/* ---------- pastel gradient washes ---------- */
/**
 * Builds wrapper > i blobs inside `field`. specs: [{ cls, depth }]. Positions and colors live in CSS.
 * Returns { items, tick(pt, dt) } where tick leans wrappers toward the pointer.
 */
export function buildWashes(field, specs) {
	const items = specs.map((s) => {
		const el = document.createElement("div");
		el.className = `rp-w ${s.cls}`;
		el.innerHTML = "<i></i>";
		field.append(el);
		return { el, depth: s.depth ?? 1, k: s.k ?? 0.05, x: 0, y: 0, o: 0, cx: 0, cy: 0 };
	});
	const measure = () => {
		for (const it of items) {
			it.cx = it.el.offsetLeft + it.el.offsetWidth / 2;
			it.cy = it.el.offsetTop + it.el.offsetHeight / 2;
			it.r = Math.max(it.el.offsetWidth, it.el.offsetHeight) * 0.9;
		}
	};
	/** Eases each blob toward the pointer; returns true while still moving. */
	const tick = (pt, energy, ox, oy, axis = "xy") => {
		let busy = false;
		for (const it of items) {
			let tx = 0, ty = 0, near = 0;
			if (pt.has) {
				const dx = pt.x - ox - it.cx, dy = pt.y - oy - it.cy;
				near = Math.exp(-(dx * dx + dy * dy) / (2 * it.r * it.r));
				tx = clamp(dx * it.k * it.depth, -46, 46);
				ty = clamp(dy * it.k * it.depth, -46, 46);
				if (axis === "x") ty = 0;
			}
			const to = clamp(near * (0.35 + energy * 1.1), 0, 1);
			it.x += (tx - it.x) * 0.07; it.y += (ty - it.y) * 0.07; it.o += (to - it.o) * 0.1;
			if (Math.abs(tx - it.x) > 0.05 || Math.abs(ty - it.y) > 0.05 || Math.abs(to - it.o) > 0.004) busy = true;
			it.el.style.transform = `translate3d(${it.x.toFixed(1)}px,${it.y.toFixed(1)}px,0)`;
			it.el.style.opacity = (0.72 + 0.28 * it.o).toFixed(3);
		}
		return busy;
	};
	return { items, measure, tick };
}

export function grainLayer(host, cls, dark, seed = 276) {
	const g = document.createElement("div");
	g.className = cls;
	host.append(g);
	const cancel = idle(() => {
		g.style.backgroundImage = `url(${grainTile(96, seed, dark, dark ? 9 : 10)})`;
		g.classList.add("is-ready");
	});
	return { el: g, cancel };
}

/* ---------- margin stars (night only) ---------- */
export function marginStars(root, d, { dark, count = 70, seed = 311, maxY = 0.62 }) {
	if (!dark) return null;
	// a dark-sky field of tiny dots (see _sky/stars.js); replaces the old haloed stars
	d.add(starrySky({ root, dark, seed, maxY: Math.min(1, maxY + 0.25), density: count / 140 }));
	return true;
}

/* ---------- footer helpers ---------- */
/** Stretches `el` (absolute child of `anchor`) to the full scroll-container width. */
export function fullBleed(root, anchor, el, d) {
	const fit = () => {
		const a = anchor.getBoundingClientRect(), r = root.getBoundingClientRect();
		el.style.left = `${(r.left - a.left).toFixed(1)}px`;
		el.style.width = `${root.clientWidth}px`;
	};
	const ro = new ResizeObserver(fit);
	ro.observe(root); ro.observe(anchor);
	fit();
	d.add(() => ro.disconnect());
}

/** Calls cb(true/false) as `el` enters / leaves the scroll container's view. */
export function whenVisible(root, el, cb, d) {
	if (!("IntersectionObserver" in window)) { cb(true); return; }
	const io = new IntersectionObserver((es) => cb(es[es.length - 1].isIntersecting), { root, rootMargin: "80px" });
	io.observe(el);
	d.add(() => io.disconnect());
}
