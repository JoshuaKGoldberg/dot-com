/*
 * Soft cursor-reactive aurora for the #241-244 themes.
 * Renders per-pixel into a tiny canvas (1/6 to 1/14 of the viewport); the
 * browser's bilinear upscale is the blur. Bends and brightens toward the
 * pointer, energy builds with movement and decays. No filters, no WebGL.
 */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

const COLORS = {
	dark: [
		[90, 255, 170], // green
		[60, 220, 215], // teal
		[110, 150, 255], // blue
		[190, 110, 255], // violet
		[255, 110, 190], // rose at the very top
	],
	light: [
		[70, 200, 150],
		[70, 190, 205],
		[120, 150, 230],
		[180, 130, 225],
		[225, 140, 190],
	],
};

function rampTable(dark) {
	const stops = COLORS[dark ? "dark" : "light"];
	const n = 64;
	const tab = new Float32Array(n * 3);
	for (let i = 0; i < n; i++) {
		const f = (i / (n - 1)) * (stops.length - 1);
		const k = Math.min(stops.length - 2, Math.floor(f));
		const t = f - k;
		for (let c = 0; c < 3; c++) tab[i * 3 + c] = lerp(stops[k][c], stops[k + 1][c], t);
	}
	return tab;
}

export function createAurora(opt) {
	const o = {
		style: "curtain", // curtain | wash | ribbon
		scale: 6,
		bands: 3,
		top: 0.0,
		bottom: 0.62, // fraction of viewport height the aurora may occupy
		base: 0.27, // curtain lower edge (fraction of h)
		hgt: 0.3, // curtain height (fraction of h)
		edge: 0.03, // lower edge softness (fraction of h)
		rays: 0.2,
		sigma: 0.17,
		gain: 1,
		rest: [0.66, 0.26],
		idleFps: 24,
		...opt,
	};
	const low = document.createElement("canvas");
	const lx = low.getContext("2d");
	let dark = !!o.dark;
	let tab = rampTable(dark);
	let w = 1, h = 1, nx = 1, ny = 1, img = null;
	let cx = 0, cy = 0, tx = 0, ty = 0, energy = 0, crisp = 0, phase = 0.8, lastRender = -1, pointerSeen = false;
	let first = true, since = 1, reducedStatic = false;
	const seeds = [1.3, 4.1, 2.2, 5.7, 3.3, 0.7];

	function resize(W, H) {
		w = W; h = H;
		nx = Math.max(8, Math.ceil(W / o.scale));
		ny = Math.max(8, Math.ceil((H * o.bottom) / o.scale));
		low.width = nx; low.height = ny;
		img = lx.createImageData(nx, ny);
		if (!pointerSeen) { cx = tx = o.rest[0] * W; cy = ty = o.rest[1] * H; }
		since = 1;
	}
	function setDark(d) { dark = d; tab = rampTable(d); since = 1; }

	function update(dt, s) {
		const reduced = s.reduced;
		const p = s.pointer;
		if (p.active && p.x > -1000) { pointerSeen = true; tx = p.x; ty = Math.min(p.y, h * 0.5); }
		else if (!pointerSeen) { tx = o.rest[0] * w; ty = o.rest[1] * h; }
		const px = cx, py = cy;
		const a = reduced ? 1 : 1 - Math.exp(-Math.max(dt, 0.001) * 5);
		cx += (tx - cx) * a;
		cy += (ty - cy) * a;
		const sp = dt > 0 ? Math.hypot(cx - px, cy - py) / dt : 0;
		const target = reduced ? 0 : Math.min(1, sp / 650);
		energy += (target - energy) * (1 - Math.exp(-Math.max(dt, 0.001) * (target > energy ? 6 : 1.4)));
		if (energy < 0.004) energy = 0;
		// "crisp" relaxes back to soft more slowly than energy
		const ct = reduced ? 0 : Math.min(1, sp / 380);
		crisp += (ct - crisp) * (1 - Math.exp(-Math.max(dt, 0.001) * (ct > crisp ? 5 : 0.9)));
		if (crisp < 0.004) crisp = 0;
		if (!reduced) phase += dt * (0.1 + energy * 1.3);
		since += dt;
		const interval = energy > 0.02 || sp > 1 ? 1 / 40 : 1 / o.idleFps;
		if (!reduced && since >= interval) since = 1e9;
		if (reduced) since = 1e9;
	}

	function render() {
		since = 0;
		if (!img) return;
		const d = img.data;
		const sc = o.scale;
		if (o.style === "wash") renderWash(d, sc);
		else if (o.style === "ribbon") renderRibbon(d, sc);
		else renderCurtain(d, sc);
		lx.putImageData(img, 0, 0);
	}

	function put(d, idx, r, g, b, I, cmax) {
		if (dark) {
			d[idx] = Math.min(255, r * I);
			d[idx + 1] = Math.min(255, g * I);
			d[idx + 2] = Math.min(255, b * I);
			d[idx + 3] = 255;
		} else {
			d[idx] = r; d[idx + 1] = g; d[idx + 2] = b;
			d[idx + 3] = Math.min(cmax, I * cmax * 1.6) * 255 | 0;
		}
	}

	// ---- soft rounded curtains (baseline, focus) ----
	function renderCurtain(d, sc) {
		const nb = o.bands;
		const sig = w * o.sigma;
		const col = new Float32Array(nb * nx * 4);
		const crispK = o.focus ? crisp : 0;
		const rayAmp = o.focus ? o.rays * crispK : o.rays * (0.6 + 0.4 * energy);
		const edgePx = h * (o.focus ? lerp(o.edge * 2.2, o.edge * 0.55, crispK) : o.edge);
		for (let b = 0; b < nb; b++) {
			const [s0, s1, s2] = [seeds[b], seeds[b + 1], seeds[b + 2]];
			for (let i = 0; i < nx; i++) {
				const x = (i + 0.5) * sc;
				const u = x / w;
				const dx = x - cx;
				const g = Math.exp(-(dx * dx) / (2 * sig * sig));
				let y0 = h * (o.base + b * 0.045) + h * 0.045 * Math.sin(u * 3.2 + s0 + phase * 0.5) + h * 0.022 * Math.sin(u * 7.3 + s1 - phase * 0.7);
				y0 += (cy + h * 0.06 - y0) * 0.42 * g;
				const hg = h * o.hgt * (0.8 + 0.28 * Math.sin(u * 4.1 + s2 + phase * 0.4)) * (1 + 0.5 * g * (0.5 + energy));
				const ray = 1 + rayAmp * (0.5 * Math.sin(u * 61 + s1 * 3 + phase * 1.1 + b) + 0.35 * Math.sin(u * 137 + s2 * 2 - phase * 1.7) + 0.15 * Math.sin(u * 23 + phase * 0.6));
				const amp = (0.62 + 0.38 * Math.sin(u * 3 + s0 * 2 + phase * 0.5)) * (0.5 + 0.8 * g + 0.25 * energy) * (1 - 0.2 * b) * o.gain * (o.focus ? 0.8 + 0.4 * crispK : 1);
				const k = (b * nx + i) * 4;
				col[k] = y0; col[k + 1] = hg; col[k + 2] = Math.max(0.05, ray) * amp; col[k + 3] = 0;
			}
		}
		const fadeStart = h * o.bottom * 0.7, fadeEnd = h * o.bottom;
		for (let j = 0; j < ny; j++) {
			const y = (j + 0.5) * sc;
			const fv = y > fadeStart ? 1 - clamp((y - fadeStart) / (fadeEnd - fadeStart)) : 1;
			const fade = fv * fv * (3 - 2 * fv);
			for (let i = 0; i < nx; i++) {
				let R = 0, G = 0, B = 0, I = 0;
				for (let b = 0; b < nb; b++) {
					const k = (b * nx + i) * 4;
					const dd = col[k] - y;
					let v;
					let t;
					if (dd >= 0) {
						const q = dd / col[k + 1];
						if (q > 2.6) continue;
						v = Math.exp(-q * 2.1);
						t = q / 1.0;
					} else {
						const q = dd / edgePx;
						if (q < -3) continue;
						v = Math.exp(-q * q * 0.6);
						t = 0;
					}
					v *= col[k + 2] * (0.6 + 0.4 * Math.min(1, (dd >= 0 ? dd : 0) / (edgePx * 2.5) + 0.35));
					const ti = Math.min(63, (clamp(t) * 63) | 0) * 3;
					R += tab[ti] * v; G += tab[ti + 1] * v; B += tab[ti + 2] * v; I += v;
				}
				const idx = (j * nx + i) * 4;
				if (I < 0.002) { d[idx] = d[idx + 1] = d[idx + 2] = d[idx + 3] = 0; if (dark) d[idx + 3] = 255; continue; }
				const r = R / I, g = G / I, b = B / I;
				put(d, idx, r, g, b, (dark ? I * 0.85 : I) * fade, 0.7);
			}
		}
	}

	// ---- big breathing washes (veil) ----
	function renderWash(d, sc) {
		const blobs = [];
		const sig = w * 0.3;
		for (let b = 0; b < 6; b++) {
			const s = seeds[b % 6];
			let bx = w * (0.12 + 0.76 * ((b * 0.37 + 0.1) % 1)) + w * 0.08 * Math.sin(phase * 0.35 + s);
			let by = h * (0.12 + 0.2 * ((b * 0.53) % 1)) + h * 0.04 * Math.sin(phase * 0.28 + s * 2);
			const dx = cx - bx;
			const gg = Math.exp(-(dx * dx) / (2 * sig * sig));
			bx += dx * 0.45 * gg;
			by += (cy - by) * 0.35 * gg;
			const breath = 0.7 + 0.3 * Math.sin(phase * 0.5 + s * 3);
			blobs.push({ x: bx, y: by, rx: w * (0.22 + 0.06 * (b % 3)) * (1 + 0.15 * gg), ry: h * (0.12 + 0.05 * (b % 2)) * (1 + 0.3 * gg), a: breath * (0.55 + 0.9 * gg + 0.3 * energy) * o.gain, c: b / 5 });
		}
		const fadeStart = h * o.bottom * 0.65, fadeEnd = h * o.bottom;
		for (let j = 0; j < ny; j++) {
			const y = (j + 0.5) * sc;
			const fv = y > fadeStart ? 1 - clamp((y - fadeStart) / (fadeEnd - fadeStart)) : 1;
			const fade = fv * fv * (3 - 2 * fv);
			for (let i = 0; i < nx; i++) {
				const x = (i + 0.5) * sc;
				let R = 0, G = 0, B = 0, I = 0;
				for (const bl of blobs) {
					const ex = (x - bl.x) / bl.rx, ey = (y - bl.y) / bl.ry;
					const q = ex * ex + ey * ey;
					if (q > 6) continue;
					// vertical flattening gives each wash a bright underside
					const v = Math.exp(-q * 0.9) * bl.a * (0.75 + 0.25 * clamp(ey + 0.6));
					const ti = (clamp(bl.c * 0.7 + (1 - clamp(y / (h * 0.5))) * 0.0) * 63 | 0) * 3;
					R += tab[ti] * v; G += tab[ti + 1] * v; B += tab[ti + 2] * v; I += v;
				}
				const idx = (j * nx + i) * 4;
				if (I < 0.002) { d[idx] = d[idx + 1] = d[idx + 2] = 0; d[idx + 3] = dark ? 255 : 0; continue; }
				put(d, idx, R / I, G / I, B / I, I * fade * (dark ? 0.36 : 1.0), 0.42);
			}
		}
	}

	// ---- silk ribbon with soft folds (ribbon) ----
	function renderRibbon(d, sc) {
		const sig = w * 0.2;
		const cols = new Float32Array(nx * 6);
		for (let i = 0; i < nx; i++) {
			const x = (i + 0.5) * sc;
			const u = x / w;
			const dx = x - cx;
			const g = Math.exp(-(dx * dx) / (2 * sig * sig));
			let yc = h * 0.26 + h * 0.07 * Math.sin(u * 2.6 + 0.8 + phase * 0.35) + h * 0.03 * Math.sin(u * 6.1 + 2 - phase * 0.6);
			yc += (cy - yc) * 0.45 * g;
			// the ribbon's width swings through a near-pinch: that is the fold
			const fold = Math.sin(u * 3.4 + 1.1 + phase * 0.3 + 0.6 * Math.sin(u * 1.3 + phase * 0.2));
			const wd = h * (0.035 + 0.075 * Math.abs(fold)) * (1 + 0.5 * g);
			const hang = h * (0.14 + 0.06 * Math.sin(u * 5 + phase * 0.5)) * (1 + 0.5 * g);
			const side = fold; // which face of the silk we see
			const amp = (0.65 + 0.35 * Math.sin(u * 2.2 + phase * 0.4)) * (0.55 + 0.8 * g + 0.25 * energy) * o.gain;
			const k = i * 6;
			cols[k] = yc; cols[k + 1] = wd; cols[k + 2] = hang; cols[k + 3] = side; cols[k + 4] = amp; cols[k + 5] = u;
		}
		const fadeStart = h * o.bottom * 0.7, fadeEnd = h * o.bottom;
		for (let j = 0; j < ny; j++) {
			const y = (j + 0.5) * sc;
			const fv = y > fadeStart ? 1 - clamp((y - fadeStart) / (fadeEnd - fadeStart)) : 1;
			const fade = fv * fv * (3 - 2 * fv);
			for (let i = 0; i < nx; i++) {
				const k = i * 6;
				const dd = y - cols[k];
				const wd = cols[k + 1];
				let v = 0, t;
				const q = dd / wd;
				// silk body: smooth rounded cross-section, hotter on one rim
				if (Math.abs(q) < 2.6) v += Math.exp(-q * q * 0.9) * (0.8 + 0.35 * cols[k + 3] * clamp(q * 0.5 + 0.5, -1, 1));
				// soft veil hanging below the ribbon
				if (dd > 0) v += 0.45 * Math.exp(-dd / cols[k + 2]) * (1 - Math.exp(-dd / (wd * 0.8 + 1)));
				const idx = (j * nx + i) * 4;
				v *= cols[k + 4];
				if (v < 0.002) { d[idx] = d[idx + 1] = d[idx + 2] = 0; d[idx + 3] = dark ? 255 : 0; continue; }
				t = clamp(0.5 - dd / (h * 0.28) + 0.2 * cols[k + 3] + 0.05 * Math.sin(cols[k + 5] * 6 + phase * 0.3));
				const ti = (clamp(1 - t) * 0.0 + clamp(0.1 + (dd < 0 ? -dd / (h * 0.2) : dd / (h * 0.5)) * 0.8) * 63 | 0) * 3;
				put(d, idx, tab[ti], tab[ti + 1], tab[ti + 2], v * fade * (dark ? 0.85 : 1), 0.7);
			}
		}
	}

	// Composite into a main ctx; dy offsets and flips are handled by caller via transform.
	function draw(ctx, x, y, W, H, alpha = 1, sy = 0, sh = ny * o.scale) {
		if (first || since > 1e8) { render(); first = false; }
		ctx.save();
		ctx.imageSmoothingEnabled = true;
		ctx.imageSmoothingQuality = "high";
		ctx.globalAlpha = alpha;
		ctx.globalCompositeOperation = dark ? "lighter" : "source-over";
		ctx.drawImage(low, 0, sy / o.scale, nx, sh / o.scale, x, y, W, H);
		ctx.restore();
	}
	function drawMain(ctx, alpha = 1) { draw(ctx, 0, 0, nx * o.scale, ny * o.scale, alpha); }
	const state = () => ({ cx, cy, energy, crisp });
	return { update, resize, setDark, draw, drawMain, state, low, get height() { return ny * o.scale; } };
}
