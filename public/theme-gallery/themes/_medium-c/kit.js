// Shared kit for the "medium aurora" c themes (#289-292): a cursor-reactive low-res aurora, a low shore strip
// (water, treeline, mist, ripples, loon), Milky Way corners and star-trail corners. Everything static is painted
// once into cached canvases; ambient motion is CSS/WAAPI transform-only; the one JS loop is throttled and idle-cheap.
import { Aurora } from "./aurora.js";
import { paintMilky, paintStars, paintTrails, paintTwinkle } from "../_aurora-d/kit.js";

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export function mulberry(a) {
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
const idle = () => new Promise((r) => ("requestIdleCallback" in window ? requestIdleCallback(() => r(), { timeout: 120 }) : setTimeout(r, 16)));
const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

export const AURORA_COLORS = {
	dark: [[0.3, 1, 0.6], [0.2, 0.8, 0.98], [0.62, 0.4, 1]],
	light: [[0.42, 0.86, 0.72], [0.5, 0.72, 0.96], [0.86, 0.58, 0.92]],
};

// ---------------------------------------------------------------- environment
export function createEnv({ root, mode, reducedMotion }, build) {
	const dark = mode ? mode === "dark" : document.documentElement.classList.contains("dark");
	const scenery = root.querySelector(".site-scenery");
	const host = scenery && scenery.querySelector(".scenery-b");
	if (!host) return;
	const overlay = root.querySelector(".overlay-a") || root.querySelector(".overlay-b");
	const env = {
		root, scenery, host, overlay, dark, reduced: !!reducedMotion, t: 20, w: 0, h: 0, dpr: 1,
		ptr: { x: 0, y: 0, sx: 0, sy: 0, active: false, dist: 0, energy: 0, z: 0.32 },
		items: [], built: [], taps: [], parallax: [], scrollT: 0, busy: false,
	};
	let dead = false, raf = 0, last = 0, building = 0, rzTimer = 0, scrollRaf = 0, stillRaf = 0;
	const cleanups = [];
	const on = (target, type, fn, opts) => {
		target.addEventListener(type, fn, opts);
		cleanups.push(() => target.removeEventListener(type, fn, opts));
	};
	env.on = on;
	env.add = (el, parent = host) => {
		parent.appendChild(el);
		env.built.push(el);
		return el;
	};
	env.alive = () => !dead;
	// top-band scenery lives in one wrapper that fades out (opacity only) over the first ~420px of scroll
	env.top = () => {
		if (!env.topEl) {
			const d = document.createElement("div");
			d.className = "mc-top";
			env.add(d);
			env.topEl = d;
		}
		return env.topEl;
	};
	env.onTap = (fn) => env.taps.push(fn);
	const rect = () => scenery.getBoundingClientRect();

	on(window, "pointermove", (e) => {
		const r = rect(), p = env.ptr;
		const x = e.clientX - r.left, y = e.clientY - r.top;
		if (p.active) p.dist += Math.hypot(x - p.x, y - p.y);
		else { p.sx = x; p.sy = y; }
		p.x = x; p.y = y; p.active = true;
		if (env.reduced) scheduleStill();
	}, { passive: true });
	on(document.documentElement, "pointerleave", () => { env.ptr.active = false; });
	on(window, "blur", () => { env.ptr.active = false; });
	let down = null;
	on(window, "pointerdown", (e) => { down = e.button === 0 ? { x: e.clientX, y: e.clientY, t: performance.now() } : null; });
	on(window, "pointerup", (e) => {
		if (!down) return;
		const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
		const quick = performance.now() - down.t < 600;
		down = null;
		if (moved > 6 || !quick) return;
		const sel = window.getSelection();
		if (sel && !sel.isCollapsed) return;
		const el = document.elementFromPoint(e.clientX, e.clientY);
		if (!el || !root.contains(el)) return;
		if (el.closest("a,button,input,select,textarea,label,[contenteditable]")) return;
		if (el !== root && !["DIV", "MAIN", "SECTION", "HEADER", "FOOTER", "UL", "OL", "NAV"].includes(el.tagName)) return;
		const r = rect();
		for (const f of env.taps) f(e.clientX - r.left, e.clientY - r.top);
		if (env.reduced) scheduleStill();
	});

	const applyScroll = () => {
		scrollRaf = 0;
		if (env.topEl) env.topEl.style.opacity = clamp(1 - root.scrollTop / 420).toFixed(3);
		for (const [el, d] of env.parallax) el.style.transform = `translate3d(0,${(-root.scrollTop * d).toFixed(1)}px,0)`;
	};
	on(root, "scroll", () => {
		if ((env.parallax.length || env.topEl) && !scrollRaf) scrollRaf = requestAnimationFrame(applyScroll);
	}, { passive: true });

	function stepPointer(dt) {
		const p = env.ptr;
		if (!p.active) { p.x = env.w * 0.66; p.y = env.h * 0.14; }
		const k = 1 - Math.exp(-dt * (env.reduced ? 12 : 4.5));
		p.sx += (p.x - p.sx) * k;
		p.sy += (p.y - p.sy) * k;
		const target = env.reduced ? 0 : Math.min(1, p.dist / Math.max(dt, 0.001) / 900);
		p.dist = 0;
		p.energy += (target - p.energy) * (1 - Math.exp(-dt * (target > p.energy ? 6 : 1.6)));
		if (p.energy < 0.005) p.energy = 0;
		p.z += ((p.active ? 1 : 0.32) - p.z) * (1 - Math.exp(-dt * 2));
		env.busy = p.energy > 0.01 || Math.hypot(p.x - p.sx, p.y - p.sy) > 0.6 || Math.abs((p.active ? 1 : 0.32) - p.z) > 0.01;
	}
	function scheduleStill() {
		if (stillRaf || dead || !env.w) return;
		stillRaf = requestAnimationFrame(() => {
			stillRaf = 0;
			stepPointer(1);
			for (const f of env.items) f.still?.();
		});
	}
	function frame(now) {
		raf = 0;
		if (dead || document.hidden) return;
		if (now - last < 32) { raf = requestAnimationFrame(frame); return; }
		const dt = Math.min(0.1, (now - last) / 1000);
		last = now;
		env.t += dt;
		stepPointer(dt);
		for (const f of env.items) f.frame?.(dt);
		raf = requestAnimationFrame(frame);
	}
	function run() {
		if (dead || env.reduced || raf || document.hidden || !env.w) return;
		last = performance.now();
		raf = requestAnimationFrame(frame);
	}
	on(document, "visibilitychange", () => {
		if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else run();
	});

	function teardown() {
		for (const f of env.items) f.destroy?.();
		env.items = [];
		env.parallax = [];
		env.topEl = null;
		env.taps = [];
		for (const el of env.built) el.remove();
		env.built = [];
	}
	async function rebuild() {
		const id = ++building;
		cancelAnimationFrame(raf); raf = 0;
		const w = scenery.clientWidth, h = scenery.clientHeight;
		if (!w || !h) return;
		teardown();
		env.w = w; env.h = h;
		env.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
		const p = env.ptr;
		if (!p.active) { p.sx = w * 0.66; p.sy = h * 0.14; }
		await idle();
		if (dead || id !== building) return;
		const items = await build(env, () => !dead && id === building);
		if (dead || id !== building) { items?.forEach((f) => f.destroy?.()); return; }
		env.items = items || [];
		for (const f of env.items) f.still?.();
		applyScroll();
		run();
	}
	const ro = new ResizeObserver(() => {
		if (dead) return;
		if (scenery.clientWidth === env.w && scenery.clientHeight === env.h) return;
		clearTimeout(rzTimer);
		rzTimer = setTimeout(rebuild, env.w ? 160 : 0);
	});
	ro.observe(scenery);
	cleanups.push(() => ro.disconnect());

	return () => {
		dead = true;
		cancelAnimationFrame(raf);
		cancelAnimationFrame(scrollRaf);
		cancelAnimationFrame(stillRaf);
		clearTimeout(rzTimer);
		cleanups.forEach((f) => f());
		for (const f of env.items) f.destroy?.();
		for (const el of env.built) el.remove();
	};
}

export function canvas(env, w, h, { dpr = env.dpr, css = "" } = {}) {
	const c = document.createElement("canvas");
	c.width = Math.max(1, Math.ceil(w * dpr));
	c.height = Math.max(1, Math.ceil(h * dpr));
	c.className = "mc-cv";
	c.style.cssText = `width:${w}px;height:${h}px;${css}`;
	const x = c.getContext("2d");
	x.scale(dpr, dpr);
	return { c, x };
}

export function addHint(env, text, ms = 8000) {
	const d = document.createElement("div");
	d.className = "mc-hint";
	d.textContent = text;
	env.add(d, env.overlay || env.host);
	const id = setTimeout(() => d.classList.add("is-gone"), ms);
	return { destroy: () => clearTimeout(id) };
}

// ---------------------------------------------------------------- aurora
// o: { frac, colors, amp, dim (0..1 centre dimming), z, breathe }
export function addAurora(env, o = {}) {
	const { w, h, dark } = env;
	const aurH = Math.round(h * (o.frac ?? 0.34));
	const cv = document.createElement("canvas");
	cv.className = "mc-cv mc-aurora" + (o.breathe && !env.reduced ? " mc-breathe" : "");
	const d = o.dim ?? 0.4;
	const mask = `linear-gradient(90deg,#000,rgba(0,0,0,${1 - d}) 28%,rgba(0,0,0,${1 - d}) 72%,#000)`;
	cv.style.cssText = `width:${w}px;height:${aurH}px;z-index:${o.z ?? 15};-webkit-mask-image:${mask};mask-image:${mask}`;
	env.add(cv, env.top());
	const A = new Aurora(cv, { dark, colors: o.colors || AURORA_COLORS[dark ? "dark" : "light"], amp: o.amp });
	const sc = 0.3;
	A.resize(w * sc, aurH * sc);
	const item = { canvas: cv, aurora: A, aurH, listeners: [] };
	let acc = 0;
	const render = () => {
		const p = env.ptr;
		A.render(env.t, { x: clamp(p.sx / Math.max(1, w)), y: clamp(p.sy / Math.max(1, aurH), 0.18, 0.66), z: p.z }, p.energy);
		for (const f of item.listeners) f();
	};
	item.still = render;
	item.frame = (dt) => {
		acc += dt;
		if (env.busy || acc > 0.07) { render(); acc = 0; }
	};
	item.destroy = () => A.destroy();
	return item;
}

// ---------------------------------------------------------------- shore strip
function treeline(x, W, wy, H, seed, col, edge) {
	const r = mulberry(seed);
	const ridge = (u) => wy - H * (0.04 + 0.05 * (0.5 + 0.5 * Math.sin(u * 17 + 1.3)) + 0.04 * (0.5 + 0.5 * Math.sin(u * 41 + 4)) + 0.05 * Math.pow(Math.abs(u * 2 - 1), 2.2));
	x.fillStyle = col;
	x.beginPath();
	x.moveTo(0, wy + 1);
	for (let px = 0; px <= W; px += 5) x.lineTo(px, ridge(px / W));
	x.lineTo(W, wy + 1);
	x.closePath();
	x.fill();
	// small spruces thicken toward both edges and thin out over the middle
	const n = Math.round(W / 16);
	for (let i = 0; i < n; i++) {
		const u = r();
		const e = Math.pow(Math.abs(u * 2 - 1), 1.6);
		if (r() > 0.12 + e * 0.95) continue;
		const th = H * (0.07 + 0.2 * e * (0.5 + r() * 0.7)) + H * 0.02 * r();
		const tw = th * (0.26 + r() * 0.06);
		const bx = u * W, by = ridge(u) + 3;
		x.beginPath();
		x.moveTo(bx, by - th);
		for (let k = 1; k <= 4; k++) {
			const f = k / 4, yy = by - th * (1 - f) , ww = tw * f;
			x.lineTo(bx + ww * 0.5, yy - th * 0.04 * (k < 4 ? 1 : 0));
			x.lineTo(bx + ww * 0.28, yy - th * 0.04 * (k < 4 ? 1 : 0));
		}
		x.lineTo(bx + tw * 0.08, by + 2);
		x.lineTo(bx - tw * 0.08, by + 2);
		for (let k = 4; k >= 1; k--) {
			const f = k / 4, yy = by - th * (1 - f), ww = tw * f;
			x.lineTo(bx - ww * 0.28, yy - th * 0.04 * (k < 4 ? 1 : 0));
			x.lineTo(bx - ww * 0.5, yy - th * 0.04 * (k < 4 ? 1 : 0));
		}
		x.closePath();
		x.fill();
	}
}

// o: { frac, seed, reflect (alpha), mist: {count, alpha}, ripples, aurora (item) }
export function addShore(env, o = {}) {
	const { w, h, dark } = env;
	const H = Math.round(clamp(h * (o.frac ?? 0.19), 120, 230));
	const W = w;
	const wy = Math.round(H * 0.6);
	const box = document.createElement("div");
	box.className = "mc-shore";
	box.style.cssText = `height:${H}px;z-index:30`;
	env.add(box);
	const item = { box, H, W, wy, destroyFns: [], rings: [] };

	// static: treeline + reflection + water, faded softly toward the top
	const dpr = Math.min(env.dpr, 1.5);
	const base = canvas(env, W, H, { dpr, css: "z-index:1" });
	const x = base.x;
	const water = dark ? [[12, 30, 54], [6, 16, 32]] : [[206, 226, 240], [182, 209, 228]];
	const tl = dark ? "#102040" : "#b6cadb";
	const wg = x.createLinearGradient(0, wy, 0, H);
	wg.addColorStop(0, rgba(water[0], dark ? 0.85 : 0.7));
	wg.addColorStop(1, rgba(water[1], dark ? 0.95 : 0.85));
	x.fillStyle = wg;
	x.fillRect(0, wy, W, H - wy);
	x.save();
	x.beginPath(); x.rect(0, wy, W, H - wy); x.clip();
	x.globalAlpha = dark ? 0.55 : 0.4;
	x.translate(0, wy); x.scale(1, -0.75); x.translate(0, -wy);
	treeline(x, W, wy, H, o.seed ?? 5, tl);
	x.restore();
	x.globalAlpha = 1;
	treeline(x, W, wy, H, o.seed ?? 5, tl);
	// glints
	const r = mulberry((o.seed ?? 5) + 9);
	x.fillStyle = dark ? "rgba(150,200,230,.10)" : "rgba(255,255,255,.55)";
	for (let i = 0; i < W / 14; i++) x.fillRect(r() * W, wy + 4 + Math.pow(r(), 1.3) * (H - wy - 6), 6 + r() * 26, 1);
	x.fillStyle = dark ? "rgba(140,200,230,.07)" : "rgba(255,255,255,.45)";
	x.fillRect(0, wy, W, 1);
	x.globalCompositeOperation = "destination-in";
	const fg = x.createLinearGradient(0, 0, 0, H);
	fg.addColorStop(0, "rgba(0,0,0,0)");
	fg.addColorStop(0.2, "rgba(0,0,0,.45)");
	fg.addColorStop(0.42, "rgba(0,0,0,1)");
	x.fillStyle = fg;
	x.fillRect(0, 0, W, H);
	box.appendChild(base.c);

	// aurora reflected in the water (low-res, CSS-upscaled)
	const rs = 0.35;
	const rw = Math.max(8, Math.round(W * rs)), rh = Math.max(8, Math.round((H - wy) * rs));
	const rc = document.createElement("canvas");
	rc.width = rw; rc.height = rh;
	rc.className = "mc-cv";
	rc.style.cssText = `left:0;top:${wy}px;width:${W}px;height:${H - wy}px;z-index:2;opacity:${o.reflect ?? 0.5}`;
	box.appendChild(rc);
	const rx = rc.getContext("2d");
	if (o.aurora) {
		const A = o.aurora;
		const draw = () => {
			const src = A.canvas;
			rx.setTransform(1, 0, 0, 1, 0, 0);
			rx.globalCompositeOperation = "source-over";
			rx.clearRect(0, 0, rw, rh);
			rx.setTransform(1, 0, 0, -1, 0, rh);
			rx.drawImage(src, 0, src.height * 0.08, src.width, src.height * 0.62, 0, 0, rw, rh);
			rx.setTransform(1, 0, 0, 1, 0, 0);
			rx.globalCompositeOperation = "destination-in";
			const g = rx.createLinearGradient(0, 0, 0, rh);
			g.addColorStop(0, "rgba(0,0,0,1)");
			g.addColorStop(1, "rgba(0,0,0,.05)");
			rx.fillStyle = g;
			rx.fillRect(0, 0, rw, rh);
		};
		A.listeners.push(draw);
	}

	// mist banks hugging the water (CSS transform drift only)
	const m = o.mist;
	if (m) {
		const mc = dark ? [150, 188, 220] : [255, 255, 255];
		const rr = mulberry((o.seed ?? 5) + 31);
		for (let i = 0; i < m.count; i++) {
			const d = document.createElement("div");
			d.className = "mc-mist" + (env.reduced ? "" : " mc-anim");
			const mw = lerp(m.size?.[0] ?? 460, m.size?.[1] ?? 860, rr());
			const mh = H * lerp(0.5, 0.8, rr());
			const a = m.alpha * lerp(0.6, 1, rr());
			const dx = (rr() < 0.5 ? -1 : 1) * lerp(120, 320, rr());
			d.style.cssText = `width:${mw | 0}px;height:${mh | 0}px;left:${((i + rr() * 0.8) / m.count) * W - mw * 0.35}px;top:${(wy - mh * lerp(0.35, 0.75, rr())) | 0}px;` +
				`background:radial-gradient(closest-side,${rgba(mc, a)},${rgba(mc, a * 0.45)} 50%,${rgba(mc, 0)});` +
				`--dx:${dx | 0}px;animation-duration:${lerp(90, 170, rr()) | 0}s;animation-delay:-${(rr() * 90) | 0}s;z-index:3`;
			box.appendChild(d);
		}
	}

	// click ripples
	let rcv = null, rctx = null;
	const ringStyle = dark ? "170,215,240" : "255,255,255";
	const ringStyle2 = dark ? "120,190,230" : "70,120,160";
	if (o.ripples) {
		const q = canvas(env, W, H, { dpr: 1, css: "z-index:4" });
		rcv = q.c; rctx = q.x;
		box.appendChild(rcv);
	}
	item.ripple = (px, py, size = 1, delay = 0) => {
		if (!rctx) return;
		item.rings.push({ x: px, y: py, t: -delay, size });
	};
	const top = () => env.h - H;
	if (o.ripples) {
		env.onTap((px, py) => {
			if (py < top() + wy - 6 || py > env.h) return;
			item.ripple(px, py - top());
			item.ripple(px, py - top(), 0.65, 0.22);
			item.ripple(px, py - top(), 0.4, 0.45);
		});
	}
	let drawn = false;
	item.frame = (dt) => {
		if (!rctx) return;
		if (!item.rings.length) {
			if (drawn) { rctx.clearRect(0, 0, W, H); drawn = false; }
			return;
		}
		rctx.clearRect(0, 0, W, H);
		drawn = true;
		for (let i = item.rings.length - 1; i >= 0; i--) {
			const g = item.rings[i];
			g.t += dt;
			if (g.t < 0) continue;
			const T = 2.6 * (0.6 + 0.4 * g.size), k = g.t / T;
			if (k >= 1) { item.rings.splice(i, 1); continue; }
			const rad = (10 + 90 * Math.pow(k, 0.6)) * g.size;
			const al = Math.pow(1 - k, 1.7) * (dark ? 0.5 : 0.7);
			rctx.lineWidth = 1.3;
			rctx.strokeStyle = `rgba(${ringStyle},${al})`;
			rctx.beginPath(); rctx.ellipse(g.x, g.y, rad, rad * 0.26, 0, 0, Math.PI * 2); rctx.stroke();
			rctx.strokeStyle = `rgba(${ringStyle2},${al * (dark ? 0.35 : 0.3)})`;
			rctx.beginPath(); rctx.ellipse(g.x, g.y + 1.5, rad, rad * 0.26, 0, 0, Math.PI * 2); rctx.stroke();
		}
	};
	item.still = () => {};
	item.destroy = () => item.destroyFns.forEach((f) => f());
	return item;
}

// ---------------------------------------------------------------- loon
function loonPath(c) {
	c.beginPath();
	c.moveTo(-0.52, 0.0);
	c.quadraticCurveTo(-0.55, -0.05, -0.46, -0.075);
	c.bezierCurveTo(-0.3, -0.13, -0.18, -0.2, -0.02, -0.2);
	c.bezierCurveTo(0.12, -0.2, 0.22, -0.18, 0.27, -0.24);
	c.bezierCurveTo(0.31, -0.3, 0.31, -0.36, 0.33, -0.4);
	c.bezierCurveTo(0.35, -0.46, 0.43, -0.47, 0.46, -0.42);
	c.lineTo(0.65, -0.395);
	c.lineTo(0.47, -0.375);
	c.bezierCurveTo(0.43, -0.36, 0.4, -0.34, 0.39, -0.3);
	c.bezierCurveTo(0.38, -0.22, 0.4, -0.14, 0.44, -0.07);
	c.bezierCurveTo(0.46, -0.03, 0.44, 0.0, 0.4, 0.0);
	c.bezierCurveTo(0.2, 0.025, -0.3, 0.025, -0.52, 0.0);
	c.closePath();
}

// A small common-loon silhouette (faces right) with a soft reflection and a faint wake, painted once.
function loonSprite(env, L) {
	const dark = env.dark, dpr = Math.min(window.devicePixelRatio || 1, 2);
	const cw = Math.ceil(L * 2.9), ch = Math.ceil(L * 0.95), ox = L * 2.0, oy = L * 0.56;
	const { c, x } = canvas(env, cw, ch, { dpr, css: "" });
	const body = dark ? "#03060d" : "#1a2838";
	// wake
	x.lineWidth = 1;
	for (const s of [-1, 1]) {
		const g = x.createLinearGradient(ox - L * 0.45, 0, ox - L * 1.95, 0);
		g.addColorStop(0, dark ? "rgba(160,205,230,.34)" : "rgba(255,255,255,.8)");
		g.addColorStop(1, "rgba(255,255,255,0)");
		x.strokeStyle = g;
		x.beginPath();
		x.moveTo(ox - L * 0.45, oy + 1.5);
		x.quadraticCurveTo(ox - L * 1.1, oy + 1.5 + s * L * 0.05, ox - L * 1.95, oy + 1.5 + s * L * 0.15);
		x.stroke();
	}
	// reflection
	const slices = 7, sh = (L * 0.36) / slices;
	for (let i = 0; i < slices; i++) {
		x.save();
		x.beginPath(); x.rect(ox - L, oy + 1 + i * sh, L * 2, sh + 0.5); x.clip();
		x.translate(ox + Math.sin(i * 1.7) * (0.3 + i * 0.25), oy + 1);
		x.scale(L, -L * 0.7);
		x.globalAlpha = (dark ? 0.32 : 0.28) * (1 - i / (slices + 1));
		loonPath(x);
		x.fillStyle = body;
		x.fill();
		x.restore();
	}
	x.globalAlpha = 1;
	x.save();
	x.translate(ox, oy);
	x.scale(L, L);
	loonPath(x);
	x.fillStyle = body;
	x.fill();
	// light catching the back and crown
	x.lineWidth = 0.9 / L;
	x.strokeStyle = dark ? "rgba(150,215,230,.5)" : "rgba(210,228,240,.55)";
	x.beginPath();
	x.moveTo(-0.46, -0.075);
	x.bezierCurveTo(-0.3, -0.13, -0.18, -0.2, -0.02, -0.2);
	x.bezierCurveTo(0.12, -0.2, 0.22, -0.18, 0.27, -0.24);
	x.bezierCurveTo(0.31, -0.3, 0.31, -0.36, 0.33, -0.4);
	x.bezierCurveTo(0.35, -0.46, 0.43, -0.47, 0.46, -0.42);
	x.stroke();
	// a few pale back checks and the eye
	x.fillStyle = dark ? "rgba(190,210,230,.4)" : "rgba(235,242,248,.5)";
	const rr = mulberry(17);
	for (let i = 0; i < 9; i++) {
		x.beginPath();
		x.arc(-0.36 + i * 0.065 + rr() * 0.02, -0.115 - Math.sin((i / 8) * Math.PI) * 0.045 + rr() * 0.02, 0.0075, 0, Math.PI * 2);
		x.fill();
	}
	x.fillStyle = dark ? "rgba(210,225,240,.7)" : "rgba(240,246,250,.7)";
	x.beginPath(); x.arc(0.4, -0.415, 0.009, 0, Math.PI * 2); x.fill();
	x.restore();
	return { c, cw, ch, ox, oy };
}

// o: { first (ms), every: [min,max] ms }
export function addLoon(env, shore, o = {}) {
	const L = clamp(env.w * 0.04, 42, 60);
	const spr = loonSprite(env, L);
	const wrap = document.createElement("div");
	wrap.className = "mc-loon";
	const inner = document.createElement("div");
	inner.className = "mc-loon-in";
	inner.appendChild(spr.c);
	wrap.appendChild(inner);
	wrap.style.cssText = `width:${spr.cw}px;height:${spr.ch}px;top:${Math.round(shore.wy + shore.H * 0.2 - spr.oy)}px;opacity:0;z-index:5`;
	shore.box.appendChild(wrap);
	const page = env.root.querySelector(".site-page");
	const pr = page ? page.getBoundingClientRect() : null;
	const sr = env.scenery.getBoundingClientRect();
	const leftM = pr ? pr.left - sr.left : 0, rightM = pr ? sr.right - pr.right : 0;
	const roomL = leftM > L * 1.6, roomR = rightM > L * 1.6;
	const timers = new Set(), anims = new Set();
	let dead = false, wake = null, count = 0;
	const sleep = (ms) => new Promise((res) => {
		const id = setTimeout(done, ms);
		timers.add(id);
		function done() { timers.delete(id); wake = null; res(); }
		wake = () => { clearTimeout(id); done(); };
	});
	const anim = (el, kf, opt) => {
		const a = el.animate(kf, { fill: "forwards", ...opt });
		anims.add(a);
		return a.finished.catch(() => {});
	};
	// rest spot: centre of the side margin
	const restX = (side) => (side === "l" ? leftM * 0.5 - spr.ox + L * 0.1 : env.w - rightM * 0.5 - spr.ox + L * 0.1);
	const bodyMid = () => spr.ox;
	function place(side) {
		inner.style.transform = side === "r" ? "scaleX(-1)" : "none";
		// flipped sprites mirror about their own centre, so the body centre moves to cw - ox
	}
	async function visit() {
		const lr = roomL && (!roomR || count % 2 === 0);
		const side = roomL || roomR ? (lr ? "l" : "r") : count % 2 ? "r" : "l";
		const margins = roomL || roomR;
		count++;
		place(side);
		const vis = side === "l" ? 1 : -1;
		wrap.style.opacity = "1";
		const bob = inner.animate([{ transform: `${side === "r" ? "scaleX(-1) " : ""}translateY(0)` }, { transform: `${side === "r" ? "scaleX(-1) " : ""}translateY(1.4px)` }], { duration: 3600, direction: "alternate", iterations: Infinity, easing: "ease-in-out" });
		anims.add(bob);
		if (margins) {
			const flipFix = side === "r" ? spr.cw - 2 * spr.ox : 0; // keep the body centred where we want it when mirrored
			const target = restX(side) - flipFix;
			const start = side === "l" ? -spr.cw : env.w + 4;
			await anim(wrap, [{ transform: `translate3d(${start}px,0,0)` }, { transform: `translate3d(${target}px,0,0)` }], { duration: 17000, easing: "cubic-bezier(.25,.55,.3,1)" });
			if (dead) return;
			await sleep(9000);
			if (dead) return;
			// dive: sink and fade, leaving a ring
			const cx = side === "l" ? restX(side) + spr.ox : env.w - (env.w - (restX(side) + spr.ox)) ;
			shore.ripple(side === "l" ? target + spr.ox + L * 0.2 : env.w - rightM * 0.5, shore.wy + shore.H * 0.2 + 3, 0.8);
			shore.ripple(side === "l" ? target + spr.ox + L * 0.2 : env.w - rightM * 0.5, shore.wy + shore.H * 0.2 + 3, 0.5, 0.25);
			await anim(inner, [{ opacity: 1 }, { opacity: 0 }], { duration: 1500, easing: "ease-in" });
			bob.cancel();
		} else {
			const a = side === "l" ? -spr.cw : env.w + 4, b = side === "l" ? env.w + 4 : -spr.cw;
			await anim(wrap, [{ transform: `translate3d(${a}px,0,0)` }, { transform: `translate3d(${b}px,0,0)` }], { duration: 36000, easing: "linear" });
			bob.cancel();
		}
		wrap.style.opacity = "0";
		inner.getAnimations().forEach((a) => a.cancel());
		wrap.getAnimations().forEach((a) => a.cancel());
		inner.style.opacity = "";
	}
	async function cycle() {
		await sleep(o.first ?? 4000);
		while (!dead) {
			await visit();
			if (dead) return;
			await sleep(lerp(o.every?.[0] ?? 40000, o.every?.[1] ?? 75000, Math.random()));
		}
	}
	const item = {
		destroy() {
			dead = true;
			timers.forEach(clearTimeout);
			anims.forEach((a) => a.cancel());
			wake?.();
		},
		still() {},
	};
	if (env.reduced) {
		// static resting loon in a margin, if there is room
		if (roomL || roomR) {
			const side = roomL ? "l" : "r";
			place(side);
			const flipFix = side === "r" ? spr.cw - 2 * spr.ox : 0;
			wrap.style.transform = `translate3d(${restX(side) - flipFix}px,0,0)`;
			wrap.style.opacity = "1";
		}
	} else {
		env.on(window, "mc-loon", () => wake?.());
		cycle();
	}
	return item;
}

// ---------------------------------------------------------------- night sky pieces
const rcv = (env, w, h, dpr, css = "") => canvas(env, w, h, { dpr, css });

// Milky Way arcs through the two top corners (cached once), plus a few twinkles.
export function addMilkyCorners(env, o = {}) {
	const { w, h, dark } = env;
	const MH = Math.round(h * 0.82);
	const { c, x } = rcv(env, w, MH, 1, "z-index:8");
	const strength = o.strength ?? (dark ? 1.15 : 1.5);
	paintMilky(x, w, MH, { dark, strength, seed: o.seed ?? 291 });
	if (dark) paintStars(x, w, MH * 0.7, { dark, count: Math.round((w * MH) / 1100), seed: 293, bright: 6 });
	// keep only the corners: multiply by soft radial masks at the two top corners
	x.globalCompositeOperation = "destination-in";
	const R = Math.max(w * 0.34, 380);
	for (const [cx, cy] of [[w * 0.0, MH * 0.18], [w, MH * 0.18]]) { /* masks combined below */ }
	const m = document.createElement("canvas");
	m.width = w; m.height = MH;
	const mx = m.getContext("2d");
	for (const cx of [0, w]) {
		const g = mx.createRadialGradient(cx, MH * 0.1, 0, cx, MH * 0.1, R);
		g.addColorStop(0, "rgba(0,0,0,1)");
		g.addColorStop(0.45, "rgba(0,0,0,.85)");
		g.addColorStop(1, "rgba(0,0,0,0)");
		mx.fillStyle = g;
		mx.fillRect(0, 0, w, MH);
	}
	x.drawImage(m, 0, 0);
	x.globalCompositeOperation = "source-over";
	c.style.opacity = o.opacity ?? (dark ? 0.95 : 0.8);
	c.className += " mc-milky";
	env.add(c, env.top());
	env.parallax.push([c, 0.06]);
	const items = [{ destroy() {} }];
	// twinkles
	if (dark) {
		const tw = rcv(env, w, MH * 0.5, 1, "z-index:9");
		paintTwinkle(tw.x, w, MH * 0.5, { dark, seed: 7, n: 26 });
		const mx2 = tw.x;
		mx2.globalCompositeOperation = "destination-in";
		mx2.drawImage(m, 0, 0);
		tw.c.className += env.reduced ? "" : " mc-tw";
		env.add(tw.c, env.top());
	}
	return items[0];
}

// Star trails around a pole in the top-right corner: one big cached canvas, rotated slowly by CSS.
export function addTrailCorner(env, o = {}) {
	const { w, h, dark } = env;
	const R = Math.round(clamp(Math.min(w * 0.3, h * 0.6), 220, 400));
	const size = R * 2;
	const { c, x } = canvas(env, size, size, { dpr: 1, css: "" });
	paintTrails(x, size, { dark, seed: o.seed ?? 292, count: o.count ?? Math.round(clamp(R * 1.7, 420, 900)), len: o.len ?? 0.55 });
	// soft radial falloff so the disc dissolves into the page; centre stays full strength
	x.globalCompositeOperation = "destination-in";
	const g = x.createRadialGradient(R, R, 0, R, R, R);
	g.addColorStop(0, "rgba(0,0,0,1)");
	g.addColorStop(0.3, "rgba(0,0,0,.75)");
	g.addColorStop(0.75, "rgba(0,0,0,.2)");
	g.addColorStop(1, "rgba(0,0,0,0)");
	x.fillStyle = g;
	x.fillRect(0, 0, size, size);
	x.globalCompositeOperation = "source-over";
	const px = w - Math.min(w * 0.06, 80), py = Math.min(h * 0.05, 48);
	c.className += " mc-trails" + (env.reduced ? "" : " mc-spin");
	c.style.cssText += `;left:${(px - R) | 0}px;top:${(py - R) | 0}px;z-index:20;opacity:${dark ? 0.85 : 0.75}`;
	env.add(c, env.top());
	return { destroy() {} };
}
