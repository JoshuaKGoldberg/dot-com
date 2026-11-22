// Shared helpers for the quiet-aurora "c" themes (#269-272). Small, dependency-free.

export function rng(seed) {
	let s = seed >>> 0 || 1;
	return () => {
		s = (s + 0x6d2b79f5) >>> 0;
		let t = s;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Smooth 1D value noise in [0,1]. */
export function noise1(x, seed = 1) {
	const h = (i) => {
		let t = (i * 374761393 + seed * 668265263) | 0;
		t = Math.imul(t ^ (t >>> 13), 1274126177);
		return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
	};
	const i = Math.floor(x);
	const f = x - i;
	const u = f * f * (3 - 2 * f);
	return h(i) * (1 - u) + h(i + 1) * u;
}

/**
 * Window-level pointer tracker. `energy` rises with movement and decays;
 * read it with `read()`. Never blocks the page (passive listeners on window).
 */
export function trackPointer() {
	const p = { x: -9999, y: -9999, seen: false, energy: 0, last: performance.now() };
	const onMove = (e) => {
		if (p.seen) {
			const d = Math.hypot(e.clientX - p.x, e.clientY - p.y);
			p.energy = Math.min(1, p.energy + d / 400);
		}
		p.x = e.clientX;
		p.y = e.clientY;
		p.seen = true;
	};
	const onLeave = () => {
		p.seen = false;
	};
	window.addEventListener("pointermove", onMove, { passive: true });
	document.addEventListener("pointerleave", onLeave);
	p.decay = (dt) => {
		p.energy *= Math.exp(-dt / 1.2);
		if (p.energy < 0.003) p.energy = 0;
	};
	p.stop = () => {
		window.removeEventListener("pointermove", onMove);
		document.removeEventListener("pointerleave", onLeave);
	};
	return p;
}

/**
 * A throttled rAF loop that only runs while `el` is on screen and the tab is visible.
 * draw(dt, t) returns nothing; call loop.poke() to wake it (e.g. on pointer movement).
 */
export function visibleLoop(el, { fps = 24, draw, start = true }) {
	let visible = false;
	let raf = 0;
	let last = 0;
	const step = 1000 / fps;
	const frame = (now) => {
		raf = 0;
		if (!visible || document.hidden) return;
		raf = requestAnimationFrame(frame);
		if (now - last < step) return;
		const dt = Math.min(0.1, (now - last) / 1000);
		last = now;
		draw(dt, now / 1000);
	};
	const kick = () => {
		if (!raf && visible && !document.hidden) {
			last = performance.now() - step;
			raf = requestAnimationFrame(frame);
		}
	};
	const io = new IntersectionObserver((entries) => {
		visible = entries[entries.length - 1].isIntersecting;
		if (visible) kick();
	});
	if (start) io.observe(el);
	document.addEventListener("visibilitychange", kick);
	return {
		poke: kick,
		stop() {
			io.disconnect();
			document.removeEventListener("visibilitychange", kick);
			cancelAnimationFrame(raf);
			visible = false;
		},
	};
}

/** Create a canvas sized to w*h CSS px at a capped, reduced resolution. */
export function sizeCanvas(canvas, w, h, scale = 1) {
	const dpr = Math.min(window.devicePixelRatio || 1, 1.5) * scale;
	canvas.width = Math.max(1, Math.round(w * dpr));
	canvas.height = Math.max(1, Math.round(h * dpr));
	canvas.style.width = `${w}px`;
	canvas.style.height = `${h}px`;
	const ctx = canvas.getContext("2d");
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	return ctx;
}

export const AURORA = {
	light: [
		[64, 160, 138],
		[88, 140, 200],
		[150, 120, 200],
	],
	dark: [
		[88, 230, 170],
		[80, 190, 240],
		[170, 130, 255],
	],
};

export const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

export function idle(fn) {
	if ("requestIdleCallback" in window) {
		const id = requestIdleCallback(fn, { timeout: 600 });
		return () => cancelIdleCallback(id);
	}
	const id = setTimeout(fn, 60);
	return () => clearTimeout(id);
}
