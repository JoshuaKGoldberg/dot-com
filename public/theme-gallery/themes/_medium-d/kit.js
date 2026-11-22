// _medium-d: shared helpers for the medium-aurora D themes (#293-296).
// A "stage" owns geometry, theme (dark) tracking, a pointer with decaying energy, and one throttled rAF loop.
// The aurora is a tiny per-pixel canvas (bilinear CSS upscale is the blur) covering only a top band.
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const isDark = () => document.documentElement.classList.contains("dark");
export const TAU = Math.PI * 2;
export const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
export function rng(seed) {
	let s = seed >>> 0;
	return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export const STOPS = {
	dark: [[90, 255, 170], [60, 220, 215], [110, 150, 255], [190, 110, 255], [255, 120, 190]],
	light: [[60, 200, 150], [60, 190, 210], [120, 150, 235], [180, 130, 230], [230, 140, 190]],
};
export function ramp(dark) {
	const st = STOPS[dark ? "dark" : "light"], n = 64, tab = new Float32Array(n * 3);
	for (let i = 0; i < n; i++) {
		const f = (i / (n - 1)) * (st.length - 1), k = Math.min(st.length - 2, Math.floor(f));
		for (let c = 0; c < 3; c++) tab[i * 3 + c] = lerp(st[k][c], st[k + 1][c], f - k);
	}
	return (t, out) => { const i = Math.round(clamp(t) * 63) * 3; out[0] = tab[i]; out[1] = tab[i + 1]; out[2] = tab[i + 2]; return out; };
}

export function el(tag, css, parent) {
	const e = document.createElement(tag);
	if (css) e.style.cssText = css;
	parent?.appendChild(e);
	return e;
}

export function createStage({ root, reducedMotion, fps = 20 }) {
	const layers = {
		a: root.querySelector(".scenery-a"), b: root.querySelector(".scenery-b"), c: root.querySelector(".scenery-c"),
		oa: root.querySelector(".overlay-a"), ob: root.querySelector(".overlay-b"),
	};
	const frame = root.querySelector(".site-scenery") || root;
	const st = {
		root, layers, reduced: !!reducedMotion, dark: isDark(), W: 1, H: 1, ox: 0, oy: 0, t: 0,
		ptr: { x: 0, y: 0, sx: 0, sy: 0, has: false, energy: 0 },
		dpr: Math.min(window.devicePixelRatio || 1, 1.5),
		draws: [], sizers: [], themers: [], dead: false, cleanups: [],
	};
	const measure = () => {
		const r = frame.getBoundingClientRect();
		st.ox = r.left; st.oy = r.top; st.W = Math.max(1, r.width); st.H = Math.max(1, r.height);
	};
	st.on = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); st.cleanups.push(() => target.removeEventListener(type, fn, opts)); };
	st.column = () => {
		let l = Infinity, r = -Infinity;
		for (const n of root.querySelectorAll(".site-hero, .site-about, .site-section, .site-footer")) {
			const b = n.getBoundingClientRect();
			if (b.width > 0) { l = Math.min(l, b.left - st.ox); r = Math.max(r, b.right - st.ox); }
		}
		if (!isFinite(l)) { l = st.W * 0.2; r = st.W * 0.8; }
		return { l, r, marginL: Math.max(0, l), marginR: Math.max(0, st.W - r) };
	};

	let raf = 0, last = 0, acc = 0, sleeping = false;
	const frameFn = (now) => {
		raf = 0;
		if (st.dead || document.hidden) { last = 0; return; }
		const dt = last ? Math.min(0.25, (now - last) / 1000) : 1 / fps;
		last = now;
		acc += dt;
		if (acc >= 1 / fps - 0.004 || st.reduced) {
			const step = acc; acc = 0; st.t += step;
			stepPointer(step);
			for (const d of st.draws) d(step, st.t);
		}
		if (!st.reduced) raf = requestAnimationFrame(frameFn);
	};
	const stepPointer = (dt) => {
		const p = st.ptr, k = 1 - Math.exp(-dt * 5);
		p.sx += (p.x - p.sx) * k; p.sy += (p.y - p.sy) * k;
		if (st.reduced) { p.sx = p.x; p.sy = p.y; } else { p.energy *= Math.exp(-dt / 1.4); if (p.energy < 0.004) p.energy = 0; }
	};
	st.kick = () => { if (!raf && !st.dead && !document.hidden) raf = requestAnimationFrame(frameFn); };
	st.start = () => { st.kick(); };
	st.redraw = () => { for (const d of st.draws) d(0, st.t); };

	let lx = null, ly = null;
	st.on(window, "pointermove", (e) => {
		if (e.pointerType === "touch") return;
		const p = st.ptr, x = e.clientX - st.ox, y = e.clientY - st.oy;
		if (lx !== null) p.energy = Math.min(1, p.energy + Math.hypot(e.clientX - lx, e.clientY - ly) / 500);
		lx = e.clientX; ly = e.clientY; p.x = x; p.y = y;
		if (!p.has) { p.has = true; p.sx = x; p.sy = y; }
		st.kick();
	}, { passive: true });
	st.on(document.documentElement, "pointerleave", () => { st.ptr.has = false; lx = ly = null; st.kick(); });
	st.on(document, "visibilitychange", () => { if (!document.hidden) st.kick(); });

	const ro = new ResizeObserver(() => { measure(); for (const f of st.sizers) f(); st.kick(); if (st.reduced) requestAnimationFrame(() => st.redraw()); });
	ro.observe(frame);
	const mo = new MutationObserver(() => {
		const d = isDark();
		if (d !== st.dark) { st.dark = d; for (const f of st.themers) f(); st.kick(); if (st.reduced) requestAnimationFrame(() => st.redraw()); }
	});
	mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
	measure();

	st.hint = (text, ms = 14000) => {
		const h = el("div", "position:absolute;right:14px;bottom:12px;font:600 12px/1 var(--siteFont,system-ui),system-ui,sans-serif;letter-spacing:.02em;color:var(--siteMuted);opacity:0;transition:opacity .8s;pointer-events:none;user-select:none", layers.ob);
		h.textContent = text;
		let done = false;
		const t1 = setTimeout(() => { h.style.opacity = "0.85"; }, 900);
		const t2 = setTimeout(() => hide(), ms);
		const hide = () => { if (done) return; done = true; h.style.opacity = "0"; clearTimeout(t1); clearTimeout(t2); };
		st.cleanups.push(() => { clearTimeout(t1); clearTimeout(t2); h.remove(); });
		return { hide };
	};
	// Wrapper for top-band scenery: fades out (opacity only) over the first `range` px of scroll.
	st.topWrap = (layer, range = 420) => {
		const w = el("div", "position:absolute;inset:0;pointer-events:none;will-change:opacity", layer);
		const upd = () => { w.style.opacity = String(clamp(1 - root.scrollTop / range)); };
		st.on(root, "scroll", upd, { passive: true });
		upd();
		return w;
	};
	st.destroy = () => {
		st.dead = true; cancelAnimationFrame(raf); ro.disconnect(); mo.disconnect();
		for (const c of st.cleanups) c();
	};
	return st;
}

/** Soft aurora in a tiny canvas across the top `topFrac` of the frame. */
export function createAurora(st, layer, o = {}) {
	const O = { topFrac: 0.3, scale: 8, gain: 1, base: 0.52, hgt: 0.5, center: 0.55, rest: 0.66, ...o };
	const canvas = el("canvas", "position:absolute;left:0;top:0;width:100%;pointer-events:none", layer);
	const cx = canvas.getContext("2d");
	let w = 1, h = 1, img = null, pal = ramp(st.dark), flash = 0;
	const out = [0, 0, 0];
	const size = () => {
		w = Math.max(8, Math.round(st.W / O.scale)); h = Math.max(4, Math.round((st.H * O.topFrac) / O.scale));
		canvas.width = w; canvas.height = h; canvas.style.height = `${st.H * O.topFrac}px`;
		img = cx.createImageData(w, h);
	};
	st.sizers.push(size);
	st.themers.push(() => { pal = ramp(st.dark); });
	size();
	const draw = (dt, t) => {
		if (!img) return;
		flash *= Math.exp(-dt / 0.9);
		const p = st.ptr, en = p.energy;
		const pu = p.has ? clamp(p.sx / st.W) : O.rest, pv = p.has ? clamp(p.sy / (st.H * O.topFrac), 0, 1.2) : 0.3;
		const gain = O.gain * (1 + 0.55 * en + flash * 0.9), amax = 0.78, d8 = img.data;
		let i = 0;
		for (let y = 0; y < h; y++) {
			const v = (y + 0.5) / h, fade = 1 - smooth(0.62, 1, v);
			for (let x = 0; x < w; x++, i += 4) {
				const u = (x + 0.5) / w, dx = u - pu;
				const g = Math.exp(-(dx * dx) / (2 * 0.15 * 0.15)) * (0.45 + 0.9 * en + (p.has ? 0.25 : 0));
				const uu = u - dx * 0.3 * g;
				const b = O.base + 0.09 * Math.sin(uu * 4.1 + t * 0.12) + 0.05 * Math.sin(uu * 9.3 - t * 0.17 + 1.3) + 0.025 * Math.sin(uu * 21 + t * 0.3) + 0.12 * g * (pv - 0.3);
				const d = (b - v) / O.hgt;
				if (d < -0.25 || fade <= 0) { d8[i + 3] = 0; continue; }
				const prof = d < 0 ? smooth(-0.25, 0, d) : Math.exp(-1.5 * d);
				const rays = 0.8 + 0.2 * Math.sin(uu * 140 + Math.sin(uu * 7 + t * 0.2) * 4 + t * 0.35) * smooth(0, 0.5, d);
				const em = 1 - O.center * (1 - smooth(0.18, 0.78, Math.abs(2 * u - 1)));
				const I = prof * rays * em * gain * fade;
				pal(0.08 + d * 0.75 + 0.12 * Math.sin(uu * 3 + t * 0.05), out);
				d8[i] = out[0]; d8[i + 1] = out[1]; d8[i + 2] = out[2];
				d8[i + 3] = clamp(I * amax) * 255;
			}
		}
		cx.putImageData(img, 0, 0);
	};
	st.draws.push(draw);
	return { canvas, flash: (v) => { flash = Math.min(1.2, flash + v); st.kick(); }, redraw: () => draw(0, st.t) };
}

/** Size a full-frame 2D canvas at DPR (capped); returns ctx with CSS-pixel coordinates. */
export function fitCanvas(c, w, h, dpr) {
	c.width = Math.ceil(w * dpr); c.height = Math.ceil(h * dpr);
	c.style.width = `${w}px`; c.style.height = `${h}px`;
	const x = c.getContext("2d");
	x.setTransform(dpr, 0, 0, dpr, 0, 0);
	return x;
}
