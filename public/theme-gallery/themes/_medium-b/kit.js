// Shared helpers for wave 11 (#285-288): medium-intensity aurora themes.
// Small, cheap pieces: a sleeping throttled loop, window pointer tracking, an aurora band,
// fireflies, snow, ridge and pine painters. Everything is cleaned up through one disposer.
import { createAurora } from "../_aurora-b/aurora.js";

export const TAU = Math.PI * 2;
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export function rng(seed) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
export const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
export const rgba = (c, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
export const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));

export const AUR_DARK = { a: [[0.2, 1, 0.55], [0.1, 0.85, 0.75], [0.6, 0.35, 1]], b: [[0.15, 0.95, 0.7], [0.15, 0.7, 0.9], [0.75, 0.3, 0.95]] };
export const AUR_LIGHT = { a: [[0.38, 0.8, 0.66], [0.42, 0.7, 0.9], [0.76, 0.6, 0.96]], b: [[0.45, 0.82, 0.74], [0.5, 0.68, 0.92], [0.82, 0.62, 0.95]] };

export function disposer() {
	const fns = [];
	return {
		add: (f) => (fns.push(f), f),
		on(target, type, fn, opts) {
			target.addEventListener(type, fn, opts);
			fns.push(() => target.removeEventListener(type, fn, opts));
		},
		run() {
			while (fns.length) fns.pop()();
		},
	};
}

export function el(parent, css, tag = "div") {
	const e = document.createElement(tag);
	e.setAttribute("aria-hidden", "true");
	e.style.cssText = `position:absolute;pointer-events:none;${css}`;
	parent.append(e);
	return e;
}

// A canvas at css size w x h, backing store scaled by dpr (capped 1.5).
export function canvasAt(parent, css, w, h, scale = 1) {
	const c = el(parent, css, "canvas");
	const dpr = Math.min(window.devicePixelRatio || 1, 1.5) * scale;
	c.width = Math.max(1, Math.round(w * dpr));
	c.height = Math.max(1, Math.round(h * dpr));
	c.style.width = `${w}px`;
	c.style.height = `${h}px`;
	const x = c.getContext("2d");
	x.setTransform(dpr, 0, 0, dpr, 0, 0);
	return { c, x, w, h, dpr };
}

// Throttled rAF loop. step(dt, t) returns true to keep going. Pauses on hidden tabs.
export function ticker(d, step, { fps = 30, el: watch = null } = {}) {
	let raf = 0, last = 0, t = 0, visible = true, dead = false;
	const gap = 1000 / fps - 2;
	const tick = (now) => {
		raf = 0;
		if (dead || document.hidden || !visible) return;
		if (now - last < gap) { raf = requestAnimationFrame(tick); return; }
		const dt = Math.min(0.06, (now - last) / 1000 || 0.033);
		last = now; t += dt;
		if (step(dt, t)) raf = requestAnimationFrame(tick);
	};
	const wake = () => { if (dead || raf || document.hidden || !visible) return; last = performance.now() - 40; raf = requestAnimationFrame(tick); };
	d.on(document, "visibilitychange", wake);
	let io = null;
	if (watch && "IntersectionObserver" in window) {
		io = new IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting; wake(); });
		io.observe(watch);
	}
	d.add(() => { dead = true; cancelAnimationFrame(raf); io?.disconnect(); });
	return { wake, get t() { return t; } };
}

// Window pointer position in viewport css px; "resting" once it stops for restMs.
export function pointer(d, onMove) {
	const p = { x: -1e4, y: -1e4, on: false, moved: 0, speed: 0 };
	d.on(window, "pointermove", (e) => {
		if (e.pointerType === "touch") return;
		const now = performance.now();
		p.speed = Math.hypot(e.clientX - p.x, e.clientY - p.y) / Math.max(8, now - p.moved);
		if (!p.on) p.speed = 0;
		p.x = e.clientX; p.y = e.clientY; p.on = true; p.moved = now;
		onMove?.(p);
	}, { passive: true });
	d.on(document.documentElement, "mouseleave", () => { p.on = false; });
	return p;
}

// Aurora band across the top of the viewport; bends toward the cursor and builds energy (#144 DNA).
export function addAurora(d, root, { dark, reduced, height = "58%", intensity = 1, top = 0.95, scale = 0.4, palette, opacity = 1, z = 0 }) {
	const parent = root.querySelector(".scenery-b") || root;
	const host = el(parent, `left:0;right:0;top:0;height:${height};opacity:${opacity};z-index:${z};contain:paint`);
	const a = createAurora({ root, reducedMotion: reduced, dark: () => dark, palette: palette || (dark ? AUR_DARK : AUR_LIGHT), intensity, top, scale, host });
	d.add(() => a.destroy());
	// Top band must not sit behind body text: fade with scroll (opacity only, passive listener).
	let base = opacity, fade = 1;
	const fadeEls = [host];
	const apply = () => { host.style.opacity = base * fade; for (const e of fadeEls) if (e !== host) e.style.opacity = fade; };
	d.on(root, "scroll", () => { const f = 1 - clamp((root.scrollTop - 40) / 380); if (f !== fade) { fade = f; apply(); } }, { passive: true });
	fade = 1 - clamp((root.scrollTop - 40) / 380);
	apply();
	return { host, aurora: a, setOpacity(v) { base = v; apply(); }, fadeWith(e) { fadeEls.push(e); apply(); } };
}

export function scrollT(d, root, cb) {
	const f = () => cb(clamp(root.scrollTop / Math.max(1, root.scrollHeight - root.clientHeight)), root.scrollTop);
	d.on(root, "scroll", f, { passive: true });
	f();
	return f;
}

// ---- painters ----
export const ridgeY = (x, base, amp, scale, seed) =>
	base - amp * (0.5 + 0.28 * Math.sin(x / scale + seed) + 0.16 * Math.sin(x / (scale * 0.43) + seed * 2.3) + 0.08 * Math.sin(x / (scale * 0.19) + seed * 4.1));

export function paintRidge(x, w, h, o) {
	const g = x.createLinearGradient(0, o.base - o.amp, 0, h);
	g.addColorStop(0, rgba(o.top, o.alpha ?? 1));
	g.addColorStop(1, rgba(o.bottom, o.alpha ?? 1));
	x.fillStyle = g;
	x.beginPath();
	x.moveTo(0, h);
	for (let i = 0; i <= w; i += 4) x.lineTo(i, ridgeY(i, o.base, o.amp, o.scale, o.seed));
	x.lineTo(w, h);
	x.closePath();
	x.fill();
	if (o.cap) {
		// a thin lit rim along the crest
		x.strokeStyle = rgba(o.cap, o.capAlpha ?? 0.7);
		x.lineWidth = o.capWidth ?? 1.5;
		x.beginPath();
		for (let i = 0; i <= w; i += 4) { const y = ridgeY(i, o.base, o.amp, o.scale, o.seed) + 0.5; i ? x.lineTo(i, y) : x.moveTo(i, y); }
		x.stroke();
	}
}

// A layered pine: stacked triangles; optional snow on each tier.
export function pine(x, cx, by, h, col, snow = null, lean = 0) {
	const tiers = 4, w = h * 0.32;
	for (let i = 0; i < tiers; i++) {
		const u = i / tiers;
		const y0 = by - h * (0.12 + u * 0.78), y1 = by - h * (0.12 + (u + 0.34) * 0.78);
		const hw = w * (1 - u * 0.62);
		x.fillStyle = col;
		x.beginPath();
		x.moveTo(cx - hw + lean * u, y0); x.lineTo(cx + lean * (u + 0.3), y1); x.lineTo(cx + hw + lean * u, y0);
		x.closePath(); x.fill();
		if (snow) {
			x.fillStyle = snow;
			x.beginPath();
			x.moveTo(cx - hw * 0.62 + lean * u, y0 - (y0 - y1) * 0.38); x.lineTo(cx + lean * (u + 0.3), y1); x.lineTo(cx + hw * 0.62 + lean * u, y0 - (y0 - y1) * 0.38);
			x.closePath(); x.fill();
		}
	}
	x.fillStyle = col;
	x.fillRect(cx - h * 0.018, by - h * 0.14, h * 0.036, h * 0.14);
}

export function glowSprite(rgb, size = 64) {
	const c = document.createElement("canvas");
	c.width = c.height = size;
	const s = c.getContext("2d"), m = size / 2;
	const g = s.createRadialGradient(m, m, 0, m, m, m);
	g.addColorStop(0, "rgba(255,255,236,1)");
	g.addColorStop(0.14, rgba(rgb, 0.95));
	g.addColorStop(0.38, rgba(rgb, 0.26));
	g.addColorStop(1, rgba(rgb, 0));
	s.fillStyle = g; s.fillRect(0, 0, size, size);
	return c;
}

// Fireflies: wander, blink, scatter from a moving cursor, gather round a resting one (#135).
export function makeFlies(n, area, r, opt = {}) {
	const flies = [];
	for (let i = 0; i < n; i++) flies.push({ x: r() * area.w, y: area.y0 + r() * (area.y1 - area.y0), vx: 0, vy: 0, ph: r() * 6.28, bl: 0.35 + r() * 0.5, sz: opt.size ? opt.size[0] + r() * (opt.size[1] - opt.size[0]) : 12 + r() * 12, a: r() * 6.28, orbit: 28 + r() * 60, rise: r() });
	return flies;
}
export function stepFlies(flies, dt, t, area, ptr, now, opt = {}) {
	const resting = ptr.on && now - ptr.moved > 700;
	const moving = ptr.on && now - ptr.moved < 250;
	for (const f of flies) {
		f.a += Math.sin(t * 0.7 + f.ph) * 1.6 * dt;
		let ax = Math.cos(f.a) * 22 + Math.sin(t * 0.3 + f.ph * 2) * 8;
		let ay = Math.sin(f.a) * 22 - (opt.lift ?? 6);
		if (opt.margin) { // nudge toward the margins, away from the text column
			const [l, r2] = opt.margin;
			if (f.x > l && f.x < r2) ax += (f.x < (l + r2) / 2 ? -1 : 1) * 26;
		}
		if (resting) {
			const ang = t * 0.5 + f.ph;
			ax += (ptr.x + Math.cos(ang) * f.orbit - f.x) * 1.1;
			ay += (ptr.y + Math.sin(ang * 1.3) * f.orbit * 0.7 - f.y) * 1.1;
		} else if (moving) {
			const dx = f.x - ptr.x, dy = f.y - ptr.y, dd = Math.hypot(dx, dy) || 1;
			if (dd < 200) { const k = (1 - dd / 200) * 380; ax += (dx / dd) * k; ay += (dy / dd) * k; }
		}
		if (f.x < 10) ax += 60;
		if (f.x > area.w - 10) ax -= 60;
		if (f.y < area.y0) ay += 50;
		if (f.y > area.y1) ay -= (f.y - area.y1) * 2 + 20 * (opt.floorPush ?? 1);
		f.vx += (ax - f.vx * 2.2) * dt;
		f.vy += (ay - f.vy * 2.2) * dt;
		f.x += f.vx * dt; f.y += f.vy * dt;
	}
	return resting || moving;
}
export function drawFlies(x, flies, sprite, t, alpha, reduced) {
	for (const f of flies) {
		const b = reduced ? 0.7 : Math.pow(Math.max(0, Math.sin(t * f.bl + f.ph)), 3) * 0.85 + 0.15;
		x.globalAlpha = alpha * b;
		const s = f.sz * (0.7 + 0.3 * b);
		x.drawImage(sprite, f.x - s, f.y - s, s * 2, s * 2);
	}
	x.globalAlpha = 1;
}
