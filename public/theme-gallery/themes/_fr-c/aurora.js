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
		yb: 0.26,
		dip: 0,
		alphaMode: false,
		shaped: false,
		archBase: 0.86,
		archRise: 0.76,
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
	// ---- physics (pair / wind): fixed 120 Hz step, sleeps at rest ----
	const NN = 44, HSTEP = 1 / 120;
	const mk = () => new Float32Array(NN);
	const sim = { A: mk(), Av: mk(), B: mk(), Bv: mk(), T: mk(), Tv: mk(), acc: 0, time: 0, awake: false, pres: 0, wind: 0, pvx: 0, pvy: 0, lastX: null, lastY: 0, dir: 1 };
	const rest = new Float32Array(NN * 2);
	let wOn = true, scrollK = 1, marginL = 200, low2 = null, img2 = null;
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
		if (o.style === "pair" || o.style === "wind") physics(dt, s, sp);
		since += dt;
		const interval = energy > 0.02 || sp > 1 || sim.awake ? 1 / 40 : 1 / o.idleFps;
		if (!reduced && since >= interval) since = 1e9;
		if (reduced) since = 1e9;
	}

	function physics(dt, s, sp) {
		const p = s.pointer, reduced = s.reduced;
		const dtc = Math.max(dt, 0.001);
		// raw pointer velocity, low-passed
		if (p.active && p.x > -1000) {
			if (sim.lastX !== null && dt > 0) {
				const k = 1 - Math.exp(-dtc * 14);
				sim.pvx += ((p.x - sim.lastX) / dtc - sim.pvx) * k;
				sim.pvy += ((p.y - sim.lastY) / dtc - sim.pvy) * k;
			}
			sim.lastX = p.x; sim.lastY = p.y;
		} else { sim.lastX = null; sim.pvx *= Math.exp(-dtc * 8); sim.pvy *= Math.exp(-dtc * 8); }
		const spd = Math.hypot(sim.pvx, sim.pvy);
		const presT = p.active && p.y < h * 0.66 && p.x > -1000 ? 1 : 0;
		sim.pres += (presT - sim.pres) * (1 - Math.exp(-dtc * 4));
		if (sim.pres < 0.003) sim.pres = 0;
		if (o.style === "wind") {
			const wt = Math.min(1, spd / 1100);
			sim.wind += (wt - sim.wind) * (1 - Math.exp(-dtc * (wt > sim.wind ? 7 : 1.1)));
			if (sim.wind < 0.004) sim.wind = 0;
			if (Math.abs(sim.pvx) > 40) sim.dir = Math.sign(sim.pvx);
		}
		if (reduced) {
			// user-driven only: settle straight to the static pose (pair parts; wind stays calm)
			if (o.style === "pair") { for (let n = 0; n < 3; n++) stepPair(HSTEP, true); }
			sim.acc = 0;
			return;
		}
		const driven = sim.pres > 0 || sim.wind > 0 || spd > 5;
		if (!driven && !sim.awake) return; // asleep: zero cost
		sim.acc = Math.min(sim.acc + dt, HSTEP * 8);
		let steps = 0;
		while (sim.acc >= HSTEP) {
			sim.acc -= HSTEP; steps++;
			sim.time += HSTEP;
			if (o.style === "pair") stepPair(HSTEP, false); else stepWind(HSTEP);
		}
		if (steps) {
			let e = 0;
			for (let i = 0; i < NN; i++) e = Math.max(e, Math.abs(sim.A[i]), Math.abs(sim.Av[i]) * 0.2, Math.abs(sim.B[i]), Math.abs(sim.Bv[i]) * 0.2, Math.abs(sim.T[i]) * 20, Math.abs(sim.Tv[i]) * 5);
			sim.awake = driven || e > 0.25;
			if (!sim.awake) { sim.A.fill(0); sim.Av.fill(0); sim.B.fill(0); sim.Bv.fill(0); sim.T.fill(0); sim.Tv.fill(0); }
		}
		since = Math.max(since, 1 / 40 + 1);
	}
	const nodeU = (i) => -0.1 + 1.2 * (i / (NN - 1));
	const dipOf = (u) => h * o.dip * (Math.exp(-u / 0.11) + Math.exp(-(1 - u) / 0.11));
	function pairRest(u) {
		const yc = dipOf(u) + h * (o.yb + 0.01) + h * 0.035 * Math.sin(u * 2.2 + phase * 0.3 + 0.6);
		const sep = h * 0.07 * Math.sin(u * 7.2 + phase * 0.35 + 0.4) * (0.75 + 0.25 * Math.sin(u * 2.3 + 1));
		return [yc + sep, yc - sep];
	}
	function stepPair(dt, instant) {
		const K = 70, C = 4.2, KC = 1200;
		const sig = w * 0.15, pres = instant ? Math.min(1, sim.pres) : sim.pres;
		const arrs = [[sim.A, sim.Av, 0], [sim.B, sim.Bv, 1]];
		for (const [y, v, which] of arrs) {
			for (let i = 1; i < NN - 1; i++) {
				const u = nodeU(i), x = u * w;
				const r = pairRest(u)[which];
				const dx = x - cx, g = Math.exp(-(dx * dx) / (2 * sig * sig));
				const dy = r + y[i] - cy;
				let dir = dy >= 0 ? 1 : -1;
				if (Math.abs(dy) < 6) dir = which === 0 ? 1 : -1;
				const target = dir * h * 0.15 * g * pres * Math.exp(-((dy / (h * 0.26)) ** 2));
				if (instant) { y[i] = target; v[i] = 0; continue; }
				const lap = y[i - 1] + y[i + 1] - 2 * y[i];
				const a = K * (target - y[i]) - C * v[i] + KC * lap + sim.pvy * 1.6 * g * pres;
				v[i] += a * dt;
			}
			if (!instant) for (let i = 1; i < NN - 1; i++) y[i] += v[i] * dt;
		}
	}
	function stepWind(dt) {
		const K = 38, C = 2.0, KC = 1000, KT = 30, CT = 1.1;
		const sig = w * 0.28, W = sim.wind, y = sim.A, v = sim.Av, t = sim.T, tv = sim.Tv;
		for (let i = 1; i < NN - 1; i++) {
			const u = nodeU(i), x = u * w;
			const dx = x - cx, g = Math.exp(-(dx * dx) / (2 * sig * sig));
			const travel = Math.sin(i * 0.5 - sim.time * 7.5 * sim.dir);
			const lap = y[i - 1] + y[i + 1] - 2 * y[i];
			const a = -K * y[i] - C * v[i] + KC * lap + sim.pvy * 2.4 * g * sim.pres + W * K * h * 0.05 * travel * (0.45 + g);
			v[i] += a * dt;
			const tl = t[i - 1] + t[i + 1] - 2 * t[i];
			tv[i] += (-KT * t[i] - CT * tv[i] + 220 * tl + W * 260 * Math.sin(i * 0.42 - sim.time * 6 * sim.dir + 1.3)) * dt;
		}
		for (let i = 1; i < NN - 1; i++) { y[i] += v[i] * dt; t[i] += tv[i] * dt; }
	}
	function catmull(arr, u) {
		const f = clamp((u + 0.1) / 1.2) * (NN - 1);
		const i = Math.min(NN - 2, Math.floor(f)), t = f - i;
		const p0 = arr[Math.max(0, i - 1)], p1 = arr[i], p2 = arr[i + 1], p3 = arr[Math.min(NN - 1, i + 2)];
		return 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t);
	}

	function render() {
		since = 0;
		if (!img) return;
		const d = img.data;
		const sc = o.scale;
		if (o.style === "wash") renderWash(d, sc);
		else if (o.style === "ribbon") renderRibbon(d, sc);
		else if (o.style === "pair") renderPair(d, sc);
		else if (o.style === "wind") renderWind(d, sc);
		else if (o.style === "focusribbon") renderFocusRibbon(d, sc);
		else if (o.style === "arch") renderArch(d, sc);
		else renderCurtain(d, sc);
		lx.putImageData(img, 0, 0);
	}

	function put(d, idx, r, g, b, I, cmax) {
		if (dark && o.alphaMode) {
			d[idx] = r; d[idx + 1] = g; d[idx + 2] = b;
			d[idx + 3] = Math.min(1, I * 1.1) * 255;
		} else if (dark) {
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
				if (I < 0.002) { d[idx] = d[idx + 1] = d[idx + 2] = 0; d[idx + 3] = dark && !o.alphaMode ? 255 : 0; continue; }
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
			let yc = h * o.yb + h * 0.07 * Math.sin(u * 2.6 + 0.8 + phase * 0.35) + h * 0.03 * Math.sin(u * 6.1 + 2 - phase * 0.6);
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
				if (v < 0.002) { d[idx] = d[idx + 1] = d[idx + 2] = 0; d[idx + 3] = dark && !o.alphaMode ? 255 : 0; continue; }
				t = clamp(0.5 - dd / (h * 0.28) + 0.2 * cols[k + 3] + 0.05 * Math.sin(cols[k + 5] * 6 + phase * 0.3));
				const ti = (clamp(1 - t) * 0.0 + clamp(0.1 + (dd < 0 ? -dd / (h * 0.2) : dd / (h * 0.5)) * 0.8) * 63 | 0) * 3;
				put(d, idx, tab[ti], tab[ti + 1], tab[ti + 2], v * fade * (dark ? 0.85 : 1), 0.7);
			}
		}
	}

	// ---- generic multi-ribbon painter (stride 10 per column) ----
	// fields: 0 yc, 1 width, 2 hang, 3 side, 4 amp, 5 u, 6 slope factor, 7 hue offset, 8 ray factor
	const ST = 10;
	function column(cols, i, yc, wd, hang, side, amp, u, sl = 1, hue = 0, ray = 1) {
		const k = i * ST;
		cols[k] = yc; cols[k + 1] = Math.max(2, wd); cols[k + 2] = hang; cols[k + 3] = side; cols[k + 4] = amp; cols[k + 5] = u; cols[k + 6] = sl; cols[k + 7] = hue; cols[k + 8] = ray;
	}
	function paintRibbons(d, sc, rs, ck = 0, cut = 0) {
		const fadeStart = h * o.bottom * 0.7, fadeEnd = h * o.bottom;
		const bodyK = 0.9 + 2.2 * ck;
		const dk = dark ? 0.85 : 1;
		const hOver = 1 / (h * 0.2), hUnder = 1 / (h * 0.5);
		// shaped: the light lives at the very top edge and down the outer side edges only
		const sideSig = clamp(marginL * 0.45, 12, w * 0.12);
		const colSide = new Float32Array(nx);
		for (let i = 0; i < nx; i++) { const x = (i + 0.5) * sc; colSide[i] = Math.exp(-Math.min(x, w - x) / sideSig); }
		const useW = o.shaped && wOn;
		for (let j = 0; j < ny; j++) {
			const y = (j + 0.5) * sc;
			const fv = y > fadeStart ? 1 - clamp((y - fadeStart) / (fadeEnd - fadeStart)) : 1;
			let fade = fv * fv * (3 - 2 * fv);
			let rowTop = 0, rowSide = 0;
			if (useW) {
				rowTop = (1 - smoothstep((y - h * 0.03) / (h * 0.17))) * scrollK;
				rowSide = smoothstep((h * 0.7 - y) / (h * 0.4));
				fade = 1;
			}
			for (let i = 0; i < nx; i++) {
				let R = 0, G = 0, B = 0, I = 0;
				const k = i * ST;
				for (let r = 0; r < rs.length; r++) {
					const c = rs[r];
					const dd = (y - c[k]) * c[k + 6];
					const wd = c[k + 1];
					const q = dd / wd;
					let v = 0;
					if (q > -2.6 && q < 2.6) v += Math.exp(-q * q * bodyK) * (0.8 + 0.35 * c[k + 3] * clamp(q * 0.5 + 0.5, -1, 1));
					if (dd > 0) {
						const hang = c[k + 2];
						let vl = 0.45 * Math.exp(-dd / hang) * (1 - Math.exp(-dd / (wd * 0.8 + 1))) * c[k + 8];
						if (cut > 0) vl *= 1 - cut * smoothstep((dd / hang - 1.1) / 1.4);
						v += vl;
					}
					v *= c[k + 4];
					if (v < 0.002) continue;
					const t = clamp(0.1 + (dd < 0 ? -dd * hOver : dd * hUnder) * 0.8 + c[k + 7]);
					const ti = ((t * 63) | 0) * 3;
					R += tab[ti] * v; G += tab[ti + 1] * v; B += tab[ti + 2] * v; I += v;
				}
				const idx = (j * nx + i) * 4;
				if (I < 0.002) { d[idx] = d[idx + 1] = d[idx + 2] = 0; d[idx + 3] = dark && !o.alphaMode ? 255 : 0; continue; }
				const xm = (i + 0.5) * sc / w;
				const corner = 0.3 + 0.7 * smoothstep(Math.abs(2 * xm - 1) * 1.5 - 0.35);
				const W = useW ? Math.max(rowTop * corner, colSide[i] * rowSide) * (dark ? 1 : 1.5) * (o.vivid || 1) : 1;
				put(d, idx, R / I, G / I, B / I, I * fade * dk * W, 0.7);
			}
		}
	}
	const smoothstep = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
	let cA = null, cB = null;
	const ensure = () => { if (!cA || cA.length !== nx * ST) { cA = new Float32Array(nx * ST); cB = new Float32Array(nx * ST); } };

	function renderPair(d, sc) {
		ensure();
		const sig = w * 0.2;
		for (let i = 0; i < nx; i++) {
			const x = (i + 0.5) * sc, u = x / w;
			const g = Math.exp(-((x - cx) ** 2) / (2 * sig * sig));
			const [ra, rb] = pairRest(u);
			let ya = ra + catmull(sim.A, u), yb = rb + catmull(sim.B, u);
			ya += (cy - ya) * 0.12 * g * sim.pres; yb += (cy - yb) * 0.12 * g * sim.pres;
			const fa = Math.sin(u * 3.4 + 1.1 + phase * 0.3 + 0.6 * Math.sin(u * 1.3 + phase * 0.2));
			const fb = Math.sin(u * 3.0 + 3.9 + phase * 0.27 + 0.6 * Math.sin(u * 1.7 + phase * 0.25));
			const amp = (0.6 + 0.3 * Math.sin(u * 2.2 + phase * 0.4)) * (0.5 + 0.8 * g + 0.25 * energy) * o.gain;
			column(cA, i, ya, h * (0.03 + 0.062 * Math.abs(fa)) * (1 + 0.5 * g), h * (0.12 + 0.05 * Math.sin(u * 5 + phase * 0.5)) * (1 + 0.4 * g), fa, amp, u, 1, 0);
			column(cB, i, yb, h * (0.028 + 0.056 * Math.abs(fb)) * (1 + 0.5 * g), h * (0.1 + 0.05 * Math.sin(u * 4.4 + 1 + phase * 0.5)) * (1 + 0.4 * g), fb, amp * 0.92, u, 1, 0.34);
		}
		paintRibbons(d, sc, [cA, cB]);
	}

	function renderWind(d, sc) {
		ensure();
		const sig = w * 0.2;
		for (let i = 0; i < nx; i++) {
			const x = (i + 0.5) * sc, u = x / w;
			const g = Math.exp(-((x - cx) ** 2) / (2 * sig * sig));
			let yc = h * o.yb + h * 0.07 * Math.sin(u * 2.6 + 0.8 + phase * 0.35) + h * 0.03 * Math.sin(u * 6.1 + 2 - phase * 0.6);
			yc += catmull(sim.A, u) + dipOf(u);
			yc += (cy - yc) * 0.2 * g * sim.pres;
			const tw = catmull(sim.T, u);
			const fold = Math.sin(u * 3.4 + 1.1 + phase * 0.3 + 0.6 * Math.sin(u * 1.3 + phase * 0.2) + tw * 1.6);
			const wd = h * (0.035 + 0.075 * Math.abs(fold)) * (1 + 0.5 * g);
			const hang = h * (0.14 + 0.06 * Math.sin(u * 5 + phase * 0.5)) * (1 + 0.5 * g) * (1 + Math.min(0.5, Math.abs(tw)));
			const amp = (0.65 + 0.35 * Math.sin(u * 2.2 + phase * 0.4)) * (0.55 + 0.8 * g + 0.25 * energy + 0.3 * sim.wind) * o.gain;
			column(cA, i, yc, wd, hang, fold, amp, u, 1, 0);
		}
		paintRibbons(d, sc, [cA]);
	}

	function renderFocusRibbon(d, sc) {
		ensure();
		const sig = w * 0.2, ck = crisp;
		for (let i = 0; i < nx; i++) {
			const x = (i + 0.5) * sc, u = x / w;
			const g = Math.exp(-((x - cx) ** 2) / (2 * sig * sig));
			let yc = h * o.yb + h * 0.07 * Math.sin(u * 2.6 + 0.8 + phase * 0.35) + h * 0.03 * Math.sin(u * 6.1 + 2 - phase * 0.6);
			yc += dipOf(u);
			yc += (cy - yc) * 0.45 * g;
			const fold = Math.sin(u * 3.4 + 1.1 + phase * 0.3 + 0.6 * Math.sin(u * 1.3 + phase * 0.2));
			// soft haze at rest: a wider, dimmer body; crisp tightens it and sprouts rays in the veil
			const soft = 1.45 - 0.45 * ck;
			const wd = h * (0.035 + 0.075 * Math.abs(fold)) * (1 + 0.5 * g) * soft;
			const hang = h * (0.14 + 0.06 * Math.sin(u * 5 + phase * 0.5)) * (1 + 0.5 * g) * (0.9 + 0.55 * ck);
			const rayN = 0.5 * Math.sin(u * 61 + 3 + phase * 1.1) + 0.35 * Math.sin(u * 137 + 4 - phase * 1.7) + 0.15 * Math.sin(u * 23 + phase * 0.6);
			const ray = Math.max(0.08, 1 + o.rays * ck * rayN);
			const amp = (0.65 + 0.35 * Math.sin(u * 2.2 + phase * 0.4)) * (0.55 + 0.8 * g + 0.25 * energy) * o.gain * (0.78 + 0.35 * ck);
			column(cA, i, yc, wd, hang, fold, amp, u, 1, 0, ray);
		}
		paintRibbons(d, sc, [cA], ck, ck * 0.8);
	}

	function archY(u) {
		const e = 1 - (2 * u - 1) ** 2;
		return h * (o.archBase - o.archRise * Math.pow(Math.max(0, e), 0.85) * (1 + 0.04 * Math.sin(phase * 0.4)));
	}
	function renderArch(d, sc) {
		ensure();
		const sig = w * 0.2;
		for (let i = 0; i < nx; i++) {
			const x = (i + 0.5) * sc, u = x / w;
			const g = Math.exp(-((x - cx) ** 2) / (2 * sig * sig));
			let yc = archY(u) + h * 0.018 * Math.sin(u * 9 + phase * 0.5);
			const e = 1e-3;
			let slope = (archY(Math.min(1, u + e)) - archY(Math.max(0, u - e))) / (2 * e * w);
			yc += (cy - yc) * 0.38 * g;
			const sl = 1 / Math.sqrt(1 + slope * slope);
			const apex = 1 - Math.abs(2 * u - 1);
			const fold = Math.sin(u * 5.2 + 1.1 + phase * 0.3 + 0.5 * Math.sin(u * 2.1 + phase * 0.2));
			const wd = h * (0.03 + 0.06 * Math.abs(fold)) * (0.7 + 0.6 * apex) * (1 + 0.5 * g) / Math.max(0.55, sl);
			const hang = h * (0.12 + 0.05 * Math.sin(u * 5 + phase * 0.5)) * (1 + 0.5 * g);
			const amp = (0.62 + 0.3 * Math.sin(u * 3.1 + phase * 0.4)) * (0.55 + 0.8 * g + 0.25 * energy) * o.gain * (0.6 + 0.4 * Math.pow(smoothstep(apex * 1.8), 0.7));
			column(cA, i, yc, wd, hang, fold, amp, u, sl, apex * 0.42);
		}
		paintRibbons(d, sc, [cA]);
	}

	// Unshaped render for the footer mirror (only called while the footer is on screen).
	function renderFull() {
		if (!img) return null;
		if (!low2 || low2.width !== nx || low2.height !== ny) { low2 = document.createElement("canvas"); low2.width = nx; low2.height = ny; img2 = low2.getContext("2d").createImageData(nx, ny); }
		const keep = img, keepOn = wOn;
		img = img2; wOn = false;
		const d = img.data;
		if (o.style === "pair") renderPair(d, o.scale); else if (o.style === "wind") renderWind(d, o.scale); else if (o.style === "focusribbon") renderFocusRibbon(d, o.scale); else if (o.style === "arch") renderArch(d, o.scale);
		low2.getContext("2d").putImageData(img, 0, 0);
		img = keep; wOn = keepOn;
		return low2;
	}
	function setScroll(k) { scrollK = k; since = 1e9; }
	function setMargin(m) { marginL = m; since = 1e9; }
	// Composite into a main ctx; dy offsets and flips are handled by caller via transform.
	function draw(ctx, x, y, W, H, alpha = 1, sy = 0, sh = ny * o.scale) {
		if (first || since > 1e8) { render(); first = false; }
		ctx.save();
		ctx.imageSmoothingEnabled = true;
		ctx.imageSmoothingQuality = "high";
		ctx.globalAlpha = alpha;
		ctx.globalCompositeOperation = dark && !o.alphaMode ? "lighter" : "source-over";
		ctx.drawImage(low, 0, sy / o.scale, nx, sh / o.scale, x, y, W, H);
		ctx.restore();
	}
	function drawMain(ctx, alpha = 1) { draw(ctx, 0, 0, nx * o.scale, ny * o.scale, alpha); }
	const state = () => ({ cx, cy, energy, crisp, awake: sim.awake });
	return { update, resize, renderFull, setScroll, setMargin, needsRender: () => first || since > 1e8, setDark, draw, drawMain, state, low, get height() { return ny * o.scale; } };
}
