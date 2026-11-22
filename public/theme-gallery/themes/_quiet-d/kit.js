/*
 * Shared helpers for the quiet-aurora D themes (#273-276).
 * Everything here is small on purpose: a pointer tracker with decaying
 * energy, a throttled visibility-aware loop, a column-based aurora curtain
 * painter for tiny canvases, and a tiled grain generator.
 */
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;

/** Query param overrides for testing (?season=, ?hour=). */
export function param(name) {
	try {
		return new URLSearchParams(location.search).get(name);
	} catch {
		return null;
	}
}

/** Collects teardown callbacks. */
export function disposer() {
	const fns = [];
	return {
		add(fn) {
			fns.push(fn);
			return fn;
		},
		on(target, type, handler, opts) {
			target.addEventListener(type, handler, opts);
			fns.push(() => target.removeEventListener(type, handler, opts));
		},
		run() {
			while (fns.length) {
				try {
					fns.pop()();
				} catch {}
			}
		},
	};
}

/**
 * Window-level pointer tracker. `energy` rises with movement and decays in
 * `decay()`. `onMove` is called on every move so loops can wake up.
 */
export function pointer(d, onMove) {
	const p = { x: -1, y: -1, has: false, energy: 0, vx: 0, vy: 0 };
	let lx = 0;
	let ly = 0;
	const move = (e) => {
		if (p.has) {
			const dist = Math.hypot(e.clientX - lx, e.clientY - ly);
			p.energy = clamp(p.energy + dist / 600);
		}
		lx = p.x = e.clientX;
		ly = p.y = e.clientY;
		p.has = true;
		onMove?.(p);
	};
	d.on(window, "pointermove", move, { passive: true });
	p.decay = (dt) => {
		p.energy *= Math.exp(-dt / 1.4);
		if (p.energy < 0.004) p.energy = 0;
		return p.energy > 0;
	};
	return p;
}

/**
 * rAF loop that sleeps. `step(dt, t)` returns true to keep running. While
 * asleep it costs nothing; call `wake()`. Pauses when the tab is hidden or
 * `el` is off-screen.
 */
export function loop(step, { fps = 24, el = null, d } = {}) {
	let raf = 0;
	let want = false;
	let visible = true;
	let last = 0;
	const minDt = 1000 / fps;
	const frame = (now) => {
		raf = 0;
		if (!want || document.hidden || !visible) return;
		if (now - last >= minDt) {
			const dt = Math.min(0.1, (now - (last || now - minDt)) / 1000);
			last = now;
			want = !!step(dt, now / 1000);
			if (!want) return;
		}
		raf = requestAnimationFrame(frame);
	};
	const start = () => {
		if (!raf && want && !document.hidden && visible) {
			last = 0;
			raf = requestAnimationFrame(frame);
		}
	};
	const api = {
		wake() {
			want = true;
			start();
		},
		stop() {
			want = false;
			if (raf) cancelAnimationFrame(raf);
			raf = 0;
		},
	};
	const onVis = () => (document.hidden ? raf && (cancelAnimationFrame(raf), (raf = 0)) : start());
	document.addEventListener("visibilitychange", onVis);
	let io;
	if (el && "IntersectionObserver" in window) {
		io = new IntersectionObserver((entries) => {
			visible = entries[entries.length - 1].isIntersecting;
			if (visible) start();
		});
		io.observe(el);
	}
	d?.add(() => {
		api.stop();
		document.removeEventListener("visibilitychange", onVis);
		io?.disconnect();
	});
	return api;
}

const rampCache = new Map();
/** 1 x 64 vertical aurora ramp: faint top, bright hem near the bottom. */
function ramp(dark) {
	const key = dark ? "d" : "l";
	if (rampCache.has(key)) return rampCache.get(key);
	const c = document.createElement("canvas");
	c.width = 1;
	c.height = 64;
	const g = c.getContext("2d");
	const stops = dark
		? [
				[0, "rgba(150,110,255,0)"],
				[0.35, "rgba(120,140,255,0.22)"],
				[0.65, "rgba(70,225,200,0.6)"],
				[0.85, "rgba(110,255,170,0.95)"],
				[1, "rgba(110,255,170,0)"],
			]
		: [
				[0, "rgba(170,140,230,0)"],
				[0.35, "rgba(140,160,235,0.25)"],
				[0.65, "rgba(110,205,200,0.55)"],
				[0.85, "rgba(120,215,170,0.8)"],
				[1, "rgba(120,215,170,0)"],
			];
	const grad = g.createLinearGradient(0, 0, 0, 64);
	for (const [o, col] of stops) grad.addColorStop(o, col);
	g.fillStyle = grad;
	g.fillRect(0, 0, 1, 64);
	rampCache.set(key, c);
	return c;
}

/**
 * Paint aurora curtains into rect (x0,y0,w,h) of ctx.
 * o: { t, dark, lean:{x,y} in -1..1, energy 0..1, strength, flip }
 * Column slices of a pre-rendered ramp: no gradients or filters per frame.
 */
export function curtains(ctx, x0, y0, w, h, o) {
	const { t = 0, dark = true, lean = { x: 0, y: 0 }, energy = 0, strength = 1 } = o;
	const img = ramp(dark);
	const step = Math.max(1, Math.round(w / 90));
	const cx = (0.5 + lean.x * 0.42) * w;
	const reach = w * 0.3;
	ctx.save();
	ctx.globalCompositeOperation = dark ? "lighter" : "source-over";
	for (let x = 0; x < w; x += step) {
		const u = x / w;
		const near = Math.exp(-(((x - cx) / reach) ** 2));
		const bend = lean.x * w * 0.05 * near;
		const wave =
			Math.sin(u * 7 + t * 0.35 + bend * 0.02) * 0.5 +
			Math.sin(u * 15 - t * 0.5) * 0.25 +
			Math.sin(u * 3 + t * 0.12) * 0.25;
		const hem = y0 + h * (0.62 + wave * 0.18 + lean.y * 0.08 * near);
		const ht = h * (0.42 + 0.18 * Math.sin(u * 11 + t * 0.4) + 0.3 * energy * near);
		const a = clamp((0.34 + 0.2 * Math.sin(u * 5 - t * 0.25) + energy * 0.7 * near) * strength, 0, 1);
		ctx.globalAlpha = a;
		ctx.drawImage(img, 0, 0, 1, 64, x0 + x, hem - ht, step + 0.5, ht);
	}
	ctx.restore();
}

/** Small seeded PRNG. */
export function rng(seed) {
	let s = seed >>> 0 || 1;
	return () => {
		s ^= s << 13;
		s >>>= 0;
		s ^= s >> 17;
		s ^= s << 5;
		s >>>= 0;
		return s / 4294967296;
	};
}

/** Paper-grain tile as a data URL: ink speckles with low alpha, so no blend modes are needed. */
export function grainTile(size = 96, seed = 7, dark = false, max = 24) {
	const c = document.createElement("canvas");
	c.width = c.height = size;
	const g = c.getContext("2d");
	const im = g.createImageData(size, size);
	const r = rng(seed);
	const v = dark ? 255 : 20;
	for (let i = 0; i < size * size; i++) {
		const n = r();
		im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v;
		im.data[i * 4 + 3] = Math.round(n * n * max);
	}
	g.putImageData(im, 0, 0);
	return c.toDataURL("image/png");
}

/** Fit a canvas to a CSS size at a capped DPR; returns its 2d context. */
export function fitCanvas(canvas, cssW, cssH, scale = 1, maxDpr = 1.5) {
	const dpr = Math.min(maxDpr, window.devicePixelRatio || 1) * scale;
	canvas.width = Math.max(1, Math.round(cssW * dpr));
	canvas.height = Math.max(1, Math.round(cssH * dpr));
	return canvas.getContext("2d");
}
