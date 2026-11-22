/*
 * Shared kit for the Medium Aurora (#281-284) themes: intensity 3-5 of 10.
 * One low-res alpha canvas (1/8 scale, CSS-upscaled = the blur) painted per-pixel
 * from a field function. Soft, rounded, bends and brightens toward the pointer;
 * movement energy builds and decays. Ambient drift is throttled; hidden tabs pause.
 */
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
export const isDark = () => document.documentElement.classList.contains("dark");

const STOPS = {
	dark: [[84, 250, 168], [58, 218, 214], [104, 150, 255], [184, 112, 255]],
	light: [[52, 196, 146], [58, 182, 214], [112, 136, 236], [172, 112, 224]],
};
function ramp(dark) {
	const s = STOPS[dark ? "dark" : "light"];
	const n = 48;
	const t = new Float32Array(n * 3);
	for (let i = 0; i < n; i++) {
		const f = (i / (n - 1)) * (s.length - 1);
		const k = Math.min(s.length - 2, Math.floor(f));
		for (let c = 0; c < 3; c++) t[i * 3 + c] = lerp(s[k][c], s[k + 1][c], f - k);
	}
	return t;
}

/** Slow multi-sine ray modulation along u, 0.5..1.5 around 1. */
export const rays = (u, ph, b = 0) => 0.5 * Math.sin(u * 61 + b * 2.1 + ph * 1.1) + 0.35 * Math.sin(u * 137 + b - ph * 1.7) + 0.15 * Math.sin(u * 23 + ph * 0.6);

/**
 * Soft curtain field. Options (all optional):
 *  bands, base(u,b,S)->y px, hgt(u,S)->px, mx(x,S)->0..1, fade(y,S)->0..1,
 *  rayAmp(S), edge(S)->px, pull, gain, sig
 */
export function curtain(o) {
	const bands = o.bands || 3;
	const seeds = [1.3, 4.1, 2.2, 5.7, 3.3, 0.7];
	let col = null, nx = 0;
	return {
		prepare(S) {
			nx = S.nx;
			if (!col || col.length !== bands * nx * 4) col = new Float32Array(bands * nx * 4);
			const { w, h, cx, cy, phase: ph, energy } = S;
			const sig = w * (o.sig || 0.17);
			const pull = o.pull ?? 0.4;
			for (let b = 0; b < bands; b++) {
				for (let i = 0; i < nx; i++) {
					const x = (i + 0.5) * S.scale, u = x / w, dx = x - cx;
					const g = Math.exp(-(dx * dx) / (2 * sig * sig));
					let y0 = o.base(u, b, S) + h * 0.03 * Math.sin(u * 3.2 + seeds[b] + ph * 0.5) + h * 0.015 * Math.sin(u * 7.3 + seeds[b + 1] - ph * 0.7);
					y0 += (cy + h * 0.05 - y0) * pull * g;
					const hg = o.hgt(u, S) * (0.85 + 0.25 * Math.sin(u * 4.1 + seeds[b + 2] + ph * 0.4)) * (1 + 0.45 * g * (0.5 + energy));
					const ray = Math.max(0.1, 1 + (o.rayAmp ? o.rayAmp(S) : 0.25) * rays(u, ph, b));
					const amp = (0.62 + 0.38 * Math.sin(u * 3 + seeds[b] * 2 + ph * 0.5)) * (0.55 + 0.75 * g + 0.25 * energy) * (1 - 0.2 * b) * (o.mx ? o.mx(x, S) : 1) * (o.gain ?? 1);
					const k = (b * nx + i) * 4;
					col[k] = y0; col[k + 1] = hg; col[k + 2] = ray * amp;
				}
			}
			S.edgePx = o.edge ? o.edge(S) : h * 0.03;
		},
		pixel(i, j, x, y, S) {
			let I = 0, T = 0;
			const e = S.edgePx;
			for (let b = 0; b < bands; b++) {
				const k = (b * nx + i) * 4;
				const dd = col[k] - y;
				let v;
				let t = 0;
				if (dd >= 0) {
					const q = dd / col[k + 1];
					if (q > 2.6) continue;
					v = Math.exp(-q * 2.1);
					t = q;
				} else {
					const q = dd / e;
					if (q < -3) continue;
					v = Math.exp(-q * q * 0.6);
				}
				v *= col[k + 2] * (0.6 + 0.4 * Math.min(1, (dd >= 0 ? dd : 0) / (e * 2.5) + 0.35));
				I += v; T += clamp(t) * v;
			}
			if (I < 0.003) { S.I = 0; return; }
			S.I = I * (o.fade ? o.fade(y, S) : 1);
			S.t = T / I;
		},
	};
}

/**
 * Creates the aurora canvas inside `host`. field = { prepare?(S), pixel(i,j,x,y,S) } sets S.I (0..), S.t (0..1).
 */
export function createAuroraCanvas({ root, host, reducedMotion, field, scale = 8, fps = 20, rest = [0.5, 0.2], maxA = { dark: 0.52, light: 0.42 }, iGain = { dark: 1, light: 1 }, clampY = [0, 1], speedRef = 650, scrollAway = false, onFrame }) {
	const canvas = document.createElement("canvas");
	Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", pointerEvents: "none" });
	host.appendChild(canvas);
	const ctx = canvas.getContext("2d");
	const S = { w: 1, h: 1, nx: 1, ny: 1, scale, cx: 0, cy: 0, energy: 0, crisp: 0, phase: 0.8, dark: isDark(), I: 0, t: 0, reduced: !!reducedMotion };
	let img = null, tab = ramp(S.dark), tx = 0, ty = 0, seen = false, raf = 0, last = 0, since = 1e9, alive = true, dirty = true, visible = true;
	const ptr = { x: 0, y: 0, has: false };

	function resize() {
		const r = root.getBoundingClientRect();
		S.w = Math.max(1, r.width); S.h = Math.max(1, r.height);
		S.nx = Math.max(8, Math.ceil(S.w / scale)); S.ny = Math.max(8, Math.ceil(S.h / scale));
		canvas.width = S.nx; canvas.height = S.ny;
		img = ctx.createImageData(S.nx, S.ny);
		if (!seen) { S.cx = tx = rest[0] * S.w; S.cy = ty = rest[1] * S.h; }
		dirty = true; wake();
	}
	function render() {
		since = 0; dirty = false;
		if (!img) return;
		field.prepare?.(S);
		const d = img.data, { nx, ny } = S, dark = S.dark, ma = (dark ? maxA.dark : maxA.light) * 255, ig = dark ? iGain.dark : iGain.light;
		for (let j = 0; j < ny; j++) {
			const y = (j + 0.5) * scale;
			for (let i = 0; i < nx; i++) {
				const x = (i + 0.5) * scale;
				field.pixel(i, j, x, y, S);
				const idx = (j * nx + i) * 4;
				const I = S.I * ig;
				if (I < 0.004) { d[idx + 3] = 0; continue; }
				const ti = Math.min(47, (clamp(S.t) * 47) | 0) * 3;
				d[idx] = tab[ti]; d[idx + 1] = tab[ti + 1]; d[idx + 2] = tab[ti + 2];
				// soft-knee so strong spots saturate gently instead of clipping
				d[idx + 3] = ma * (1 - Math.exp(-I * 1.5));
			}
		}
		ctx.putImageData(img, 0, 0);
		onFrame?.(S);
	}
	function step(dt) {
		const p = S.reduced ? 1 : 1 - Math.exp(-dt * 5);
		const px = S.cx, py = S.cy;
		if (ptr.has) { seen = true; tx = ptr.x; ty = clamp(ptr.y, clampY[0] * S.h, clampY[1] * S.h); }
		S.cx += (tx - S.cx) * p; S.cy += (ty - S.cy) * p;
		const sp = dt > 0 ? Math.hypot(S.cx - px, S.cy - py) / dt : 0;
		const tgt = S.reduced ? 0 : Math.min(1, sp / speedRef);
		S.energy += (tgt - S.energy) * (1 - Math.exp(-dt * (tgt > S.energy ? 6 : 1.4)));
		if (S.energy < 0.004) S.energy = 0;
		const ct = S.reduced ? 0 : Math.min(1, sp / 380);
		S.crisp += (ct - S.crisp) * (1 - Math.exp(-dt * (ct > S.crisp ? 5 : 0.9)));
		if (S.crisp < 0.004) S.crisp = 0;
		if (!S.reduced) S.phase += dt * (0.1 + S.energy * 1.2);
		since += dt;
		const moving = sp > 1 || S.energy > 0.02 || S.crisp > 0.02;
		if (S.reduced) { if (moving) dirty = true; }
		else if (since >= (moving ? 1 / 40 : 1 / fps)) dirty = true;
		return moving;
	}
	function frame(now) {
		raf = 0;
		if (!alive || document.hidden) return;
		const dt = Math.min(0.1, (now - last) / 1000 || 0.016);
		last = now;
		const moving = step(dt);
		if (dirty) render();
		// reduced motion: only keep ticking while the pointer is still easing
		if (!S.reduced || moving) raf = requestAnimationFrame(frame);
	}
	function wake() { if (!raf && alive && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } }
	const onMove = (e) => {
		const r = root.getBoundingClientRect();
		ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top;
		ptr.has = ptr.x >= -20 && ptr.y >= -20 && ptr.x <= r.width + 20 && ptr.y <= r.height + 20;
		wake();
	};
	const onVis = () => { if (!document.hidden) wake(); else if (raf) { cancelAnimationFrame(raf); raf = 0; } };
	const mo = new MutationObserver(() => {
		const d = isDark();
		if (d !== S.dark) { S.dark = d; tab = ramp(d); dirty = true; wake(); }
	});
	mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
	const ro = new ResizeObserver(resize);
	ro.observe(root);
	let sraf = 0;
	const applyScroll = () => { sraf = 0; canvas.style.transform = `translate3d(0,${-root.scrollTop}px,0)`; };
	const onScroll = () => { if (!sraf) sraf = requestAnimationFrame(applyScroll); };
	if (scrollAway) { canvas.style.willChange = "transform"; root.addEventListener("scroll", onScroll, { passive: true }); applyScroll(); }
	addEventListener("pointermove", onMove, { passive: true });
	document.addEventListener("visibilitychange", onVis);
	resize();
	if (S.reduced) { render(); }
	wake();
	return {
		S,
		destroy() {
			alive = false;
			cancelAnimationFrame(raf); cancelAnimationFrame(sraf);
			root.removeEventListener("scroll", onScroll);
			removeEventListener("pointermove", onMove);
			document.removeEventListener("visibilitychange", onVis);
			mo.disconnect(); ro.disconnect();
			canvas.remove();
		},
	};
}

/** Horizontal helper: 0 over the content column, 1 in the margins. colHalf in px. */
export function marginness(x, w, colHalf = 416, soft = 0.22) {
	const d = Math.abs(x - w / 2);
	return smooth(colHalf * 0.55, colHalf + w * soft, d);
}
