/*
 * Shared kit for the Quiet Aurora (#261-264) themes.
 * A tiny, low-res, alpha-only aurora canvas that leans toward the pointer,
 * brightens with movement (energy decays), and costs almost nothing:
 * IntersectionObserver gating, hidden-tab pause, 20-30 fps throttle.
 */
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;

const STOPS = {
	light: [[96, 196, 160], [96, 186, 206], [140, 160, 226], [182, 150, 222]],
	dark: [[90, 245, 170], [70, 215, 215], [115, 155, 255], [185, 120, 255]],
};

function ramp(dark) {
	const s = STOPS[dark ? "dark" : "light"];
	const n = 48;
	const t = new Uint8ClampedArray(n * 3);
	for (let i = 0; i < n; i++) {
		const f = (i / (n - 1)) * (s.length - 1);
		const k = Math.min(s.length - 2, Math.floor(f));
		for (let c = 0; c < 3; c++) t[i * 3 + c] = lerp(s[k][c], s[k + 1][c], f - k);
	}
	return t;
}

/**
 * Tracks the pointer on window (never blocks the page) with smoothing and
 * a decaying movement "energy".
 */
export function createPointer(onWake) {
	const p = { x: -9999, y: -9999, sx: -9999, sy: -9999, energy: 0, seen: false };
	let lx = null;
	let ly = null;
	const move = (e) => {
		if (lx !== null) p.energy = Math.min(1.4, p.energy + Math.hypot(e.clientX - lx, e.clientY - ly) / 500);
		lx = e.clientX;
		ly = e.clientY;
		p.x = e.clientX;
		p.y = e.clientY;
		if (!p.seen) {
			p.seen = true;
			p.sx = p.x;
			p.sy = p.y;
		}
		onWake?.();
	};
	addEventListener("pointermove", move, { passive: true });
	p.step = (dt) => {
		const k = 1 - Math.exp(-dt * 3.2);
		p.sx = lerp(p.sx, p.x, k);
		p.sy = lerp(p.sy, p.y, k);
		p.energy *= Math.exp(-dt / 1.3);
		if (p.energy < 0.004) p.energy = 0;
	};
	p.destroy = () => removeEventListener("pointermove", move);
	return p;
}

/**
 * Aurora painter. profile fields (fractions of canvas height unless noted):
 *   c0 curtain centre, amp wobble, sig thickness, fade (vertical fade power),
 *   gain base brightness, reach (px) pointer influence distance,
 *   pullX horizontal lean width (fraction of width), maxA alpha cap.
 */
export function createPainter(canvas, o) {
	const ctx = canvas.getContext("2d");
	const ramps = ramp(o.dark);
	let w = 1;
	let h = 1;
	let img = null;
	const P = { c0: 0.3, amp: 0.12, sig: 0.28, fade: 0, gain: 1, reach: 380, pullX: 0.16, maxA: o.dark ? 0.55 : 0.34, rays: 0.25, seed: 0, hot: null, ...o.profile };
	const setSize = (cssW, cssH, scale) => {
		w = Math.max(8, Math.round(cssW / scale));
		h = Math.max(4, Math.round(cssH / scale));
		canvas.width = w;
		canvas.height = h;
		img = ctx.createImageData(w, h);
	};
	/** rect = canvas client rect, ptr = pointer, t seconds. */
	const draw = (t, rect, ptr, frozen) => {
		const d = img.data;
		let px = -1;
		let infl = 0;
		if (ptr && ptr.seen) {
			px = (ptr.sx - rect.left) / rect.width;
			const cy = clamp(ptr.sy, rect.top, rect.bottom);
			const cx = clamp(ptr.sx, rect.left, rect.right);
			infl = Math.exp(-Math.hypot(ptr.sx - cx, ptr.sy - cy) / P.reach);
		}
		const en = ptr ? ptr.energy : 0;
		const py = ptr && ptr.seen ? clamp((ptr.sy - rect.top) / rect.height, 0, 1) : 0.5;
		const hot = P.hot; // optional {x: fraction, k: strength} override (nav hover)
		for (let x = 0; x < w; x++) {
			const fx = x / (w - 1);
			let pull = 0;
			if (px >= -0.5) {
				const g = (fx - px) / P.pullX;
				pull = Math.exp(-g * g) * infl;
			}
			if (hot) {
				const g = (fx - hot.x) / (hot.w || 0.12);
				pull = Math.max(pull, Math.exp(-g * g) * hot.k);
			}
			const wave = Math.sin(fx * 3.1 + t * 0.13 + P.seed) * 0.55 + Math.sin(fx * 7.3 - t * 0.21 + P.seed * 2) * 0.3;
			const ray = 1 - P.rays + P.rays * (0.5 + 0.5 * Math.sin(fx * 46 + Math.sin(fx * 9 + t * 0.3) * 2.4 + P.seed));
			let yc = P.c0 + P.amp * wave;
			yc += (py - yc) * 0.35 * pull; // lean toward the cursor
			const g2 = P.gain * (0.62 + 0.38 * (0.5 + 0.5 * Math.sin(fx * 2.2 - t * 0.17 + P.seed))) * (1 + pull * (0.7 + en * 1.4));
			const ci = clamp(fx * 0.8 + 0.1 + Math.sin(t * 0.05 + P.seed) * 0.1 + pull * 0.08, 0, 1);
			const ri = Math.round(ci * 47) * 3;
			const r = ramps[ri];
			const gg = ramps[ri + 1];
			const b = ramps[ri + 2];
			for (let y = 0; y < h; y++) {
				const fy = y / (h - 1);
				let dd = (fy - yc) / P.sig;
				if (dd > 0) dd *= 1.5; // lower edge is crisper than the upper veil
				let a = Math.exp(-dd * dd) * ray * g2;
				if (P.fade) a *= Math.pow(1 - fy, P.fade);
				if (P.fadeIn) a *= Math.min(1, fy / P.fadeIn);
				const i = (y * w + x) * 4;
				d[i] = r;
				d[i + 1] = gg;
				d[i + 2] = b;
				d[i + 3] = clamp(a, 0, 1) * P.maxA * 255;
			}
		}
		ctx.putImageData(img, 0, 0);
	};
	return { P, draw, setSize, get size() { return [w, h]; } };
}

/**
 * Frame loop with visibility gating. `frame(t, dt)` returns nothing.
 * Reduced motion: one static frame, redrawn only on resize or pointer wake.
 */
export function createLoop(el, frame, { fps = 20, reduced = false, ptr = null } = {}) {
	let visible = false;
	let raf = 0;
	let last = 0;
	let dead = false;
	let pending = false;
	const t0 = performance.now();
	const tick = (now) => {
		raf = 0;
		if (dead || !visible || document.hidden) return;
		const dt = (now - last) / 1000;
		const budget = 1000 / (ptr && ptr.energy > 0.05 ? Math.max(fps, 30) : fps);
		if (now - last >= budget - 2) {
			last = now;
			ptr?.step(Math.min(dt, 0.2));
			frame((now - t0) / 1000, Math.min(dt, 0.2));
		}
		raf = requestAnimationFrame(tick);
	};
	const start = () => {
		if (reduced || raf || dead || !visible || document.hidden) return;
		last = performance.now() - 1000;
		raf = requestAnimationFrame(tick);
	};
	const stop = () => {
		if (raf) cancelAnimationFrame(raf);
		raf = 0;
	};
	const once = () => {
		if (pending || dead) return;
		pending = true;
		requestAnimationFrame(() => {
			pending = false;
			if (dead) return;
			ptr?.step(0.5);
			frame(8, 0);
		});
	};
	const io = new IntersectionObserver((es) => {
		visible = es[es.length - 1].isIntersecting;
		if (visible) reduced ? once() : start();
		else stop();
	});
	io.observe(el);
	const vis = () => (document.hidden ? stop() : start());
	document.addEventListener("visibilitychange", vis);
	return {
		once,
		wake: () => (reduced ? once() : start()),
		destroy() {
			dead = true;
			stop();
			io.disconnect();
			document.removeEventListener("visibilitychange", vis);
		},
	};
}

export const mk = (tag, cls, parent) => {
	const e = document.createElement(tag);
	if (cls) e.className = cls;
	parent?.appendChild(e);
	return e;
};

/** Debounced ResizeObserver on one or more elements. */
export function onSize(els, fn) {
	let t = 0;
	const ro = new ResizeObserver(() => {
		clearTimeout(t);
		t = setTimeout(fn, 60);
	});
	for (const e of els) ro.observe(e);
	return () => {
		clearTimeout(t);
		ro.disconnect();
	};
}

export function seeded(seed) {
	let s = seed >>> 0 || 1;
	return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
