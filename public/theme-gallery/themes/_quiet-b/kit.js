/*
 * Shared helpers for the quiet-aurora B themes (#265-268).
 * Tiny low-res aurora canvases (the browser's bilinear upscale is the blur),
 * a pointer tracker with decaying "energy", and a loop that sleeps when
 * hidden / off-screen / idle.
 */
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const isDark = () => document.documentElement.classList.contains("dark");

const STOPS = {
	dark: [[90, 255, 170], [60, 220, 215], [110, 150, 255], [190, 110, 255]],
	light: [[70, 195, 160], [70, 185, 205], [125, 155, 230], [180, 135, 225]],
};

/** 64-entry color ramp (green -> teal -> blue -> violet). */
export function rampTable(dark) {
	const stops = STOPS[dark ? "dark" : "light"];
	const n = 64;
	const tab = new Float32Array(n * 3);
	for (let i = 0; i < n; i++) {
		const f = (i / (n - 1)) * (stops.length - 1);
		const k = Math.min(stops.length - 2, Math.floor(f));
		for (let c = 0; c < 3; c++) tab[i * 3 + c] = lerp(stops[k][c], stops[k + 1][c], f - k);
	}
	return (t, out) => {
		const i = Math.round(clamp(t) * 63) * 3;
		out[0] = tab[i]; out[1] = tab[i + 1]; out[2] = tab[i + 2];
	};
}

/**
 * Tracks the pointer on window. `energy` rises with movement and decays;
 * `sx/sy` follow the pointer smoothly. `has` is false until first move or
 * after the pointer leaves the page.
 */
export function trackPointer(onWake) {
	const s = { x: 0, y: 0, sx: 0, sy: 0, has: false, energy: 0 };
	let lx = null, ly = null;
	const move = (e) => {
		if (lx !== null) s.energy = Math.min(1, s.energy + Math.hypot(e.clientX - lx, e.clientY - ly) / 500);
		lx = e.clientX; ly = e.clientY;
		s.x = lx; s.y = ly;
		if (!s.has) { s.has = true; s.sx = s.x; s.sy = s.y; }
		onWake?.();
	};
	const leave = () => { s.has = false; lx = ly = null; onWake?.(); };
	window.addEventListener("pointermove", move, { passive: true });
	document.documentElement.addEventListener("pointerleave", leave);
	s.step = (dt) => {
		const k = 1 - Math.exp(-dt * 5);
		s.sx += (s.x - s.sx) * k; s.sy += (s.y - s.sy) * k;
		s.energy *= Math.exp(-dt / 1.4);
		if (s.energy < 0.004) s.energy = 0;
	};
	s.busy = () => s.energy > 0 || Math.hypot(s.x - s.sx, s.y - s.sy) > 0.5;
	s.destroy = () => {
		window.removeEventListener("pointermove", move);
		document.documentElement.removeEventListener("pointerleave", leave);
	};
	return s;
}

/**
 * rAF loop throttled to `fps`. `frame(dt, t)` draws and returns true to keep
 * running (otherwise the loop sleeps until wake()). Pauses when the document
 * is hidden or none of `watch` elements is on screen.
 */
export function createLoop({ frame, fps = 20, watch = [] }) {
	let raf = 0, last = 0, t = 0, onScreen = !watch.length, dead = false, asleep = true;
	const visible = () => !document.hidden && onScreen && !dead;
	const tick = (now) => {
		raf = 0;
		if (!visible()) { asleep = true; return; }
		const dt = last ? Math.min(0.25, (now - last) / 1000) : 1 / fps;
		if (now - last >= 1000 / fps - 2) {
			last = now; t += dt;
			if (!frame(dt, t)) { asleep = true; last = 0; return; }
		}
		raf = requestAnimationFrame(tick);
	};
	const wake = () => {
		asleep = false;
		if (!raf && visible()) raf = requestAnimationFrame(tick);
	};
	const onVis = () => { if (!document.hidden && !asleep) wake(); else if (document.hidden) { cancelAnimationFrame(raf); raf = 0; last = 0; } };
	document.addEventListener("visibilitychange", onVis);
	let io = null;
	if (watch.length && "IntersectionObserver" in window) {
		const seen = new Set();
		io = new IntersectionObserver((entries) => {
			for (const e of entries) e.isIntersecting ? seen.add(e.target) : seen.delete(e.target);
			onScreen = seen.size > 0;
			if (onScreen) wake(); else { cancelAnimationFrame(raf); raf = 0; last = 0; }
		});
		watch.forEach((el) => io.observe(el));
		onScreen = false;
	}
	return {
		wake,
		get t() { return t; },
		destroy() { dead = true; cancelAnimationFrame(raf); document.removeEventListener("visibilitychange", onVis); io?.disconnect(); },
	};
}

/** A low-res pixel canvas: call `size(cssW, cssH)` then `paint(fn)`. */
export function pixelCanvas(parent, { scale = 6, style = "" } = {}) {
	const canvas = document.createElement("canvas");
	canvas.setAttribute("aria-hidden", "true");
	canvas.style.cssText = `position:absolute;display:block;pointer-events:none;${style}`;
	parent.appendChild(canvas);
	const ctx = canvas.getContext("2d");
	let img = null, w = 0, h = 0;
	const rgb = [0, 0, 0];
	return {
		canvas, get w() { return w; }, get h() { return h; },
		size(cssW, cssH) {
			const nw = Math.max(2, Math.round(cssW / scale)), nh = Math.max(2, Math.round(cssH / scale));
			if (nw === w && nh === h && img) return;
			w = nw; h = nh; canvas.width = w; canvas.height = h;
			img = ctx.createImageData(w, h);
		},
		/** fn(x, y, out) with x,y in canvas pixels; returns alpha 0..1 and fills out=[r,g,b]. */
		paint(fn) {
			const d = img.data;
			let i = 0;
			for (let y = 0; y < h; y++) {
				for (let x = 0; x < w; x++, i += 4) {
					const a = fn(x, y, rgb);
					d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2];
					d[i + 3] = a <= 0 ? 0 : a >= 1 ? 255 : a * 255;
				}
			}
			ctx.putImageData(img, 0, 0);
		},
		remove() { canvas.remove(); },
	};
}

/** Gaussian bump. */
export const gauss = (d, s) => Math.exp(-(d * d) / (2 * s * s));

/**
 * A faint aurora wash hugging the very top of the viewport (a fixed strip
 * inside `layer`). Leans toward and brightens near the pointer.
 */
export function topWash(layer, { dark, height = 96, alpha = 0.5, reduced = false, ptr }) {
	const px = pixelCanvas(layer, { scale: 6, style: "left:0;top:0;width:100%;" });
	px.canvas.style.height = height + "px";
	const color = rampTable(dark);
	let hueShift = 0;
	const draw = (t) => {
		const W = layer.clientWidth || window.innerWidth;
		px.size(W, height);
		const w = px.w, h = px.h;
		const cx = ptr?.has ? ((ptr.sx - layer.getBoundingClientRect().left) / W) * w : -999;
		const near = ptr?.has ? clamp(1 - Math.max(0, ptr.sy - layer.getBoundingClientRect().top) / 500) : 0;
		const boost = near * (0.35 + 1.1 * (ptr?.energy || 0));
		const sig = w * 0.17;
		px.paint((x, y, out) => {
			const g = gauss(x - cx, sig);
			const xs = x - (x - cx) * 0.18 * g; // lean toward the pointer
			const v = y / h;
			const wave = 0.55 + 0.3 * Math.sin(xs * 0.06 + t * 0.35 + Math.sin(xs * 0.021 - t * 0.2) * 1.6) + 0.15 * Math.sin(xs * 0.19 + t * 0.5);
			const rays = 0.88 + 0.12 * Math.sin(xs * 0.9);
			const fall = Math.exp(-v * 3.6);
			color((xs / w) * 0.75 + 0.12 + 0.1 * Math.sin(t * 0.12) + g * 0.12 + hueShift, out);
			return fall * wave * rays * (0.5 + boost * 1.4 * g + boost * 0.3) * alpha;
		});
	};
	let first = true;
	const loop = createLoop({
		fps: 20,
		watch: [px.canvas],
		frame(dt, t) {
			ptr?.step(dt);
			draw(reduced ? 3 : t);
			return !reduced || ptr?.busy();
		},
	});
	if (first) { draw(3); first = false; }
	const onResize = () => { draw(loop.t || 3); };
	window.addEventListener("resize", onResize);
	loop.wake();
	return {
		wake: loop.wake,
		destroy() { loop.destroy(); window.removeEventListener("resize", onResize); px.remove(); },
	};
}
