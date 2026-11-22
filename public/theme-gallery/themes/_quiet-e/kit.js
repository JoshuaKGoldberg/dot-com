// Shared helpers for the quiet-aurora wave (#277-280). Tiny on purpose.

export const isDark = () => document.documentElement.classList.contains("dark");

// Aurora palette: low saturation in light, a little glow in dark.
export const AURORA = {
	light: [[96, 170, 150], [92, 150, 200], [150, 130, 200]],
	dark: [[110, 230, 190], [110, 180, 255], [190, 150, 255]],
};
export const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
export const auroraAt = (dark, t) => {
	const p = AURORA[dark ? "dark" : "light"];
	t = Math.min(Math.max(t, 0), 1) * 2;
	return t < 1 ? mix(p[0], p[1], t) : mix(p[1], p[2], t - 1);
};
export const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

export function rng(seed) {
	let s = seed >>> 0;
	return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// Pointer from window, with an energy value that rises with movement and decays.
export function trackPointer(onMove) {
	const p = { x: -1e4, y: -1e4, seen: false, energy: 0, last: 0 };
	const move = (e) => {
		const now = performance.now();
		if (p.seen) {
			const d = Math.hypot(e.clientX - p.x, e.clientY - p.y);
			p.energy = Math.min(1, p.energy + d / 400);
		}
		p.x = e.clientX; p.y = e.clientY; p.seen = true; p.last = now;
		onMove?.(p, e);
	};
	const leave = () => { p.seen = false; p.x = p.y = -1e4; onMove?.(p, null); };
	addEventListener("pointermove", move, { passive: true });
	document.documentElement.addEventListener("pointerleave", leave);
	return {
		p,
		decay(dt) { p.energy *= Math.pow(0.5, dt / 0.9); if (p.energy < 0.01) p.energy = 0; },
		destroy() {
			removeEventListener("pointermove", move);
			document.documentElement.removeEventListener("pointerleave", leave);
		},
	};
}

// A throttled rAF loop that sleeps when asked, when hidden, or when off-screen.
// tick(dt seconds) returns true to keep running, false to sleep until wake().
export function createLoop(tick, { fps = 30, el = null } = {}) {
	let raf = 0, last = 0, running = false, visible = true, io = null;
	const frame = (t) => {
		raf = 0;
		if (!running) return;
		if (document.hidden || !visible) { running = false; return; }
		if (t - last >= 1000 / fps - 2) {
			const dt = Math.min((t - last) / 1000, 0.1);
			last = t;
			if (tick(dt) === false) { running = false; return; }
		}
		raf = requestAnimationFrame(frame);
	};
	const wake = () => {
		if (running || document.hidden || !visible) return;
		running = true; last = performance.now();
		raf = requestAnimationFrame(frame);
	};
	const onVis = () => { if (!document.hidden) wake(); };
	document.addEventListener("visibilitychange", onVis);
	if (el && "IntersectionObserver" in window) {
		visible = false;
		io = new IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting; if (visible) wake(); });
		io.observe(el);
	}
	return {
		wake,
		destroy() {
			running = false; cancelAnimationFrame(raf);
			document.removeEventListener("visibilitychange", onVis);
			io?.disconnect();
		},
	};
}

export function makeCanvas(parent, css) {
	const c = document.createElement("canvas");
	c.setAttribute("aria-hidden", "true");
	c.style.cssText = "position:absolute;pointer-events:none;" + css;
	parent.append(c);
	return c;
}

export function sizeCanvas(c, w, h, dpr = 1) {
	dpr = Math.min(dpr, 1.5);
	c.width = Math.max(1, Math.round(w * dpr));
	c.height = Math.max(1, Math.round(h * dpr));
	const ctx = c.getContext("2d");
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	return ctx;
}

export const idle = (fn) => ("requestIdleCallback" in window ? requestIdleCallback(fn, { timeout: 800 }) : setTimeout(fn, 60));

export const onResize = (fn) => {
	let t = 0;
	const h = () => { clearTimeout(t); t = setTimeout(fn, 120); };
	addEventListener("resize", h);
	return () => { removeEventListener("resize", h); clearTimeout(t); };
};
