/*
 * Wave 14 "delight" kit (E): the calm header, hidden proximity stars and the #313 paper footer.
 * - calmAurora: a short, dim aurora hugging the top edge; ~3x slower than the wave-12 header.
 * - hiddenStars: margin stars at alpha ~0.05-0.15 that wake, grow and twinkle near the cursor.
 * - paperFooter: the #313 grain + pastel washes footer (copied wiring from ra-paper-footer).
 */
import { starrySky } from "../_sky/stars.js";
import { curtain, marginness, smooth, clamp, lerp } from "../_medium-a/kit.js";
import { buildWashes, disposer, fullBleed, grainLayer, isDark, loop, pointer, rng, whenVisible } from "../_refined-d/kit.js";
export { clamp, lerp, smooth, disposer, isDark, rng, whenVisible };

export const prefersReduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("reduce-motion");

/* ------------------------------------------------------------------ calm aurora */
const STOPS = {
	dark: [[84, 250, 168], [58, 218, 214], [104, 150, 255], [184, 112, 255]],
	light: [[52, 196, 146], [58, 182, 214], [112, 136, 236], [172, 112, 224]],
};
function ramp(dark) {
	const s = STOPS[dark ? "dark" : "light"], n = 48, t = new Float32Array(n * 3);
	for (let i = 0; i < n; i++) {
		const f = (i / (n - 1)) * (s.length - 1), k = Math.min(s.length - 2, Math.floor(f));
		for (let c = 0; c < 3; c++) t[i * 3 + c] = lerp(s[k][c], s[k + 1][c], f - k);
	}
	return t;
}

/**
 * Only the top ~17% of the scroll area is ever painted. All time constants are ~3x the
 * wave-12 header: cursor follow tau 0.85 s, energy decay tau ~2.5 s, idle phase 0.03 rad/s.
 */
export function calmAurora(root, { reducedMotion, host = root.querySelector(".scenery-b"), dark = isDark() } = {}) {
	const reduced = !!reducedMotion;
	const scale = 8, fps = 12, FOLLOW = 1.2, E_UP = 2, E_DOWN = 0.4, PH0 = 0.035, PH_E = 0.3;
	const field = curtain({
		bands: 3,
		base: (u, b, S) => S.h * (0.026 + b * 0.011),
		hgt: (u, S) => S.h * (0.03 + 0.008 * Math.sin(u * 5)),
		mx: (x, S) => 0.7 + 0.4 * marginness(x, S.w, 400, 0.2),
		fade: (y, S) => 1 - smooth(S.h * 0.085, S.h * 0.13, y),
		rayAmp: (S) => 0.15 + 0.12 * S.energy,
		edge: (S) => S.h * 0.032,
		pull: 0.22,
		sig: 0.2,
		gain: 1.75 * 0.5 * 0.58,
	});
	const canvas = document.createElement("canvas");
	Object.assign(canvas.style, { position: "absolute", left: "0", top: "0", width: "100%", pointerEvents: "none", willChange: "transform" });
	canvas.setAttribute("aria-hidden", "true");
	host.appendChild(canvas);
	const ctx = canvas.getContext("2d");
	const S = { w: 1, h: 1, nx: 1, ny: 1, scale, cx: 0, cy: 0, energy: 0, crisp: 0, phase: 0.8, dark, I: 0, t: 0, reduced };
	let img = null, tab = ramp(dark), tx = 0, ty = 0, raf = 0, last = 0, since = 1e9, alive = true, dirty = true, seen = false, sraf = 0;
	const ptr = { x: 0, y: 0, has: false };
	const maxA = dark ? 0.46 : 0.38;
	const REST = [0.5, 0.025];

	const resize = () => {
		const r = root.getBoundingClientRect();
		S.w = Math.max(1, r.width); S.h = Math.max(1, r.height);
		S.nx = Math.max(8, Math.ceil(S.w / scale));
		S.ny = Math.max(4, Math.ceil((S.h * 0.17) / scale));
		canvas.width = S.nx; canvas.height = S.ny;
		canvas.style.height = `${S.ny * scale}px`;
		img = ctx.createImageData(S.nx, S.ny);
		if (!seen) { S.cx = tx = REST[0] * S.w; S.cy = ty = REST[1] * S.h; }
		dirty = true; wake();
	};
	function render() {
		since = 0; dirty = false;
		if (!img) return;
		field.prepare?.(S);
		const d = img.data, { nx, ny } = S, ma = maxA * 255;
		for (let j = 0; j < ny; j++) {
			const y = (j + 0.5) * scale;
			for (let i = 0; i < nx; i++) {
				field.pixel(i, j, (i + 0.5) * scale, y, S);
				const idx = (j * nx + i) * 4, I = S.I;
				if (I < 0.004) { d[idx + 3] = 0; continue; }
				const ti = Math.min(47, (clamp(S.t) * 47) | 0) * 3;
				d[idx] = tab[ti]; d[idx + 1] = tab[ti + 1]; d[idx + 2] = tab[ti + 2];
				d[idx + 3] = ma * (1 - Math.exp(-I * 1.5));
			}
		}
		ctx.putImageData(img, 0, 0);
	}
	function step(dt) {
		const p = reduced ? 1 : 1 - Math.exp(-dt * FOLLOW);
		const px = S.cx, py = S.cy;
		if (ptr.has) { seen = true; tx = ptr.x; ty = clamp(ptr.y, 0, 0.07 * S.h); }
		S.cx += (tx - S.cx) * p; S.cy += (ty - S.cy) * p;
		const sp = dt > 0 ? Math.hypot(S.cx - px, S.cy - py) / dt : 0;
		const tgt = reduced ? 0 : Math.min(1, sp / 420);
		S.energy += (tgt - S.energy) * (1 - Math.exp(-dt * (tgt > S.energy ? E_UP : E_DOWN)));
		if (S.energy < 0.004) S.energy = 0;
		if (!reduced) S.phase += dt * (PH0 + S.energy * PH_E);
		since += dt;
		const moving = sp > 0.6 || S.energy > 0.02;
		if (reduced) { if (moving) dirty = true; }
		else if (since >= (moving ? 1 / 24 : 1 / fps)) dirty = true;
		return moving;
	}
	function frame(now) {
		raf = 0;
		if (!alive || document.hidden) return;
		const dt = Math.min(0.1, (now - last) / 1000 || 0.016);
		last = now;
		const moving = step(dt);
		if (dirty) render();
		if (!reduced || moving) raf = requestAnimationFrame(frame);
	}
	function wake() { if (!raf && alive && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } }
	const onMove = (e) => {
		const r = root.getBoundingClientRect();
		ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top;
		ptr.has = ptr.x >= -20 && ptr.y >= -20 && ptr.x <= r.width + 20 && ptr.y <= r.height + 20;
		wake();
	};
	const onVis = () => { if (!document.hidden) wake(); else if (raf) { cancelAnimationFrame(raf); raf = 0; } };
	const ro = new ResizeObserver(resize);
	ro.observe(root);
	const applyScroll = () => { sraf = 0; canvas.style.transform = `translate3d(0,${-root.scrollTop}px,0)`; };
	const onScroll = () => { if (!sraf) sraf = requestAnimationFrame(applyScroll); };
	root.addEventListener("scroll", onScroll, { passive: true });
	addEventListener("pointermove", onMove, { passive: true });
	document.addEventListener("visibilitychange", onVis);
	resize();
	if (reduced) render();
	wake();
	return {
		S,
		destroy() {
			alive = false;
			cancelAnimationFrame(raf); cancelAnimationFrame(sraf);
			root.removeEventListener("scroll", onScroll);
			removeEventListener("pointermove", onMove);
			document.removeEventListener("visibilitychange", onVis);
			ro.disconnect(); canvas.remove();
		},
	};
}

/* ------------------------------------------------------------------ hidden stars */
const TEMPS = {
	dark: [[200, 220, 255], [236, 240, 255], [255, 226, 190]],
	light: [[70, 96, 190], [96, 90, 170], [196, 124, 48]],
};
function starSprite(rgb, dark) {
	const N = 64, c = document.createElement("canvas");
	c.width = c.height = N;
	const g = c.getContext("2d"), m = N / 2;
	const rgba = (a) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
	const glow = g.createRadialGradient(m, m, 0, m, m, m);
	glow.addColorStop(0, rgba(dark ? 0.55 : 0.4)); glow.addColorStop(0.25, rgba(dark ? 0.18 : 0.12)); glow.addColorStop(1, rgba(0));
	g.fillStyle = glow; g.fillRect(0, 0, N, N);
	// four-point glint
	for (const [dx, dy] of [[1, 0], [0, 1]]) {
		const l = g.createLinearGradient(m - dx * m, m - dy * m, m + dx * m, m + dy * m);
		l.addColorStop(0, rgba(0)); l.addColorStop(0.5, rgba(0.85)); l.addColorStop(1, rgba(0));
		g.fillStyle = l;
		g.fillRect(dx ? 2 : m - 0.7, dx ? m - 0.7 : 2, dx ? N - 4 : 1.4, dx ? 1.4 : N - 4);
	}
	g.fillStyle = rgba(1);
	g.beginPath(); g.arc(m, m, 2.2, 0, Math.PI * 2); g.fill();
	return c;
}

/**
 * Margin stars. Resting alpha is 0.05-0.15; within ~210 px of the cursor a star eases up to
 * ~0.9 alpha and ~2.3x size and twinkles faster. The canvas redraws on a slow tick (5 fps)
 * at rest, and per frame only while a star is easing.
 */
export function hiddenStars(root, d, { dark = isDark(), seed = 360, reducedMotion = prefersReduced(), maxY = 0.94, radius = 210, host = root.querySelector(".scenery-c") } = {}) {
	// a dark-sky field of tiny dots (see _sky/stars.js); replaces the old flared sprites
	d.add(starrySky({ root, host, dark, reduced: reducedMotion, seed, maxY, radius }));
	return host;
}

/* ------------------------------------------------------------------ #313 paper footer */
export function paperFooter(root, d, { reducedMotion }) {
	const dark = isDark();
	const footer = root.querySelector(".site-footer");
	if (!footer) return;
	const deco = document.createElement("div");
	deco.className = "rpf";
	footer.prepend(deco);
	d.add(() => deco.remove());
	fullBleed(root, footer, deco, d);
	const W = buildWashes(deco, [
		{ cls: "rpf-1 rp-teal", depth: 0.9, k: 0.05 },
		{ cls: "rpf-2 rp-lilac", depth: 1, k: 0.05 },
		{ cls: "rpf-3 rp-pink", depth: 0.8, k: 0.05 },
		{ cls: "rpf-4 rp-mint", depth: 1, k: 0.05 },
		{ cls: "rpf-5 rp-sky", depth: 1.2, k: 0.05 },
		{ cls: "rpf-6 rp-peach", depth: 1.2, k: 0.05 },
	]);
	const g = grainLayer(deco, "rp-grain rpf-grain", dark, 313);
	d.add(g.cancel);
	const ro = new ResizeObserver(() => W.measure());
	ro.observe(deco);
	d.add(() => ro.disconnect());
	let live = false, pe = 0;
	const pt = pointer(d, () => { if (live) lp.wake(); });
	const lp = loop(
		(dt) => {
			const r = deco.getBoundingClientRect();
			pe += (pt.energy - pe) * 0.12;
			const busy = W.tick(pt, pe, r.left, r.top, "x");
			return pt.decay(dt) || busy || Math.abs(pe - pt.energy) > 0.004;
		},
		{ fps: 30, el: deco, d },
	);
	whenVisible(root, footer, (v) => {
		live = v;
		deco.classList.toggle("is-live", v && !reducedMotion);
		if (v) lp.wake();
	}, d);
}
