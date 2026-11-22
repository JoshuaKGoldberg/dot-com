// _hp/fx-squiggle.js: #500-502, #497's contour-following structure drawn as the site's #479 link squiggle instead of electricity.
// Contours are iso-lines of the cutout's distance field (marching squares at setup, smoothed, resampled evenly by arc length), so a sine wave
// travelling along arc length moves at an even speed. Strokes are whole canvas pixels (2 css px, 3 for emphasis), aurora-tinted, round-capped.
import { ring, rgba, fieldRim, palLut, skyGradient } from "./kit.js";
import { PAL, rng, smooth, clamp } from "./kit.js";

const TAU = Math.PI * 2;
const bodyDraw = (g, E) => { g.save(); E.dome(g, 128, 200); g.clip(); E.drawImg(g, E.img.body); g.restore(); };

function isoChains(F, n, L) {
	const pt = new Map(), adj = new Map(), V = (i, j) => F[j * n + i] - L;
	const ept = (i, j, dir) => {
		const id = (j * n + i) * 2 + dir;
		if (!pt.has(id)) { const a = V(i, j), b = dir ? V(i, j + 1) : V(i + 1, j), t = a / (a - b); pt.set(id, [i + (dir ? 0 : t) + 0.5 - n / 2, j + (dir ? t : 0) + 0.5 - n / 2]); }
		return id;
	};
	const link = (a, b) => { (adj.get(a) || adj.set(a, []).get(a)).push(b); (adj.get(b) || adj.set(b, []).get(b)).push(a); };
	for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
		const m = (V(i, j) > 0 ? 1 : 0) | (V(i + 1, j) > 0 ? 2 : 0) | (V(i + 1, j + 1) > 0 ? 4 : 0) | (V(i, j + 1) > 0 ? 8 : 0);
		if (m === 0 || m === 15) continue;
		const T = () => ept(i, j, 0), R = () => ept(i + 1, j, 1), B = () => ept(i, j + 1, 0), Lf = () => ept(i, j, 1);
		switch (m) {
			case 1: case 14: link(Lf(), T()); break;
			case 2: case 13: link(T(), R()); break;
			case 3: case 12: link(Lf(), R()); break;
			case 4: case 11: link(R(), B()); break;
			case 5: link(Lf(), T()); link(R(), B()); break;
			case 6: case 9: link(T(), B()); break;
			case 7: case 8: link(Lf(), B()); break;
			case 10: link(T(), R()); link(Lf(), B()); break;
		}
	}
	const seen = new Set(), chains = [];
	const walk = (start) => { const ch = []; let prev = -1, cur = start; while (cur !== undefined && !seen.has(cur)) { seen.add(cur); ch.push(pt.get(cur)); const nx = adj.get(cur).find((q) => q !== prev && !seen.has(q)); prev = cur; cur = nx; } return ch; };
	for (const [id, nb] of adj) if (nb.length === 1 && !seen.has(id)) chains.push(walk(id));
	for (const [id] of adj) if (!seen.has(id)) chains.push(walk(id));
	return chains.sort((a, b) => b.length - a.length)[0] || [];
}

// smoothed, evenly resampled contour at offset L
export function contour(E, L) {
	const f = E.fld, n = f.n, raw = isoChains(f.F, n, L), ds = 1.6;
	const cum = [0]; for (let i = 1; i < raw.length; i++) cum.push(cum[i - 1] + Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]));
	let N = Math.floor(cum[cum.length - 1] / ds), x = new Float32Array(N), y = new Float32Array(N), k = 0;
	for (let i = 0; i < N; i++) { const s = i * ds; while (k < cum.length - 2 && cum[k + 1] < s) k++; const q = (s - cum[k]) / ((cum[k + 1] - cum[k]) || 1); x[i] = raw[k][0] + (raw[k + 1][0] - raw[k][0]) * q; y[i] = raw[k][1] + (raw[k + 1][1] - raw[k][1]) * q; }
	for (let it = 0; it < 10; it++) { const x2 = x.slice(), y2 = y.slice(); for (let i = 3; i < N - 3; i++) { let sx = 0, sy = 0; for (let d = -3; d <= 3; d++) { sx += x[i + d]; sy += y[i + d]; } x2[i] = sx / 7; y2[i] = sy / 7; } x = x2; y = y2; }
	// keep the longest run where the glow mask allows (the photo is cut at the bottom)
	const mAt = (px, py) => { const i = Math.round(px + n / 2 - 0.5), j = Math.round(py + n / 2 - 0.5); return i < 0 || j < 0 || i >= n || j >= n ? 0 : f.m[j * n + i]; };
	let best = [0, 0], st = -1;
	for (let i = 0; i <= N; i++) { const ok = i < N && mAt(x[i], y[i]) > 0.12; if (ok && st < 0) st = i; if (!ok && st >= 0) { if (i - st > best[1] - best[0]) best = [st, i]; st = -1; } }
	const [a, b] = best, M = b - a, C = { N: M, x: new Float32Array(M), y: new Float32Array(M), nx: new Float32Array(M), ny: new Float32Array(M), s: new Float32Array(M), a: new Float32Array(M), ds, len: M * ds };
	for (let i = 0; i < M; i++) { C.x[i] = x[a + i]; C.y[i] = y[a + i]; C.s[i] = i * ds; C.a[i] = smooth(0.12, 0.6, mAt(x[a + i], y[a + i])); }
	for (let i = 0; i < M; i++) { const p = Math.max(0, i - 2), q = Math.min(M - 1, i + 2), tx = C.x[q] - C.x[p], ty = C.y[q] - C.y[p], l = Math.hypot(tx, ty) || 1; let nx = ty / l, ny = -tx / l; if (i === 0) C._flip = 0; C.nx[i] = nx; C.ny[i] = ny; }
	// curvature -> amplitude scale, so the wave never kinks on tight bends (ears, antenna)
	const th = new Float32Array(M); for (let i = 1; i < M - 1; i++) th[i] = Math.atan2(C.y[i + 1] - C.y[i - 1], C.x[i + 1] - C.x[i - 1]);
	let kk = new Float32Array(M).fill(1);
	for (let i = 5; i < M - 5; i++) { let d = th[i + 4] - th[i - 4]; d = Math.abs(((d + Math.PI) % TAU + TAU) % TAU - Math.PI); const kap = d / (8 * ds) + 1e-4; kk[i] = Math.min(1, Math.max(0.12, 0.45 / (kap * 3))); }
	for (let it = 0; it < 3; it++) { const k2 = kk.slice(); for (let i = 4; i < M - 4; i++) { let sm = 0; for (let d = -4; d <= 4; d++) sm += kk[i + d]; k2[i] = sm / 9; } kk = k2; }
	C.k = kk;
	// orient normals outward (toward larger distance)
	const sdAt = (px, py) => { const i = Math.round(px + n / 2 - 0.5), j = Math.round(py + n / 2 - 0.5); return i < 0 || j < 0 || i >= n || j >= n ? 99 : f.F[j * n + i]; };
	const mid = M >> 1; if (sdAt(C.x[mid] + C.nx[mid] * 3, C.y[mid] + C.ny[mid] * 3) < sdAt(C.x[mid], C.y[mid])) for (let i = 0; i < M; i++) { C.nx[i] = -C.nx[i]; C.ny[i] = -C.ny[i]; }
	return C;
}

// the site's squiggle palette: hues 204, 236, 170, 266, 214 (reflected), as a small string LUT
export function palette(E) {
	const hues = [204, 236, 170, 266, 214], out = [], dk = E.dark;
	for (let i = 0; i < 48; i++) { const p = ((i / 47) * (hues.length - 1)), k = Math.min(hues.length - 2, p | 0), h = hues[k] + (hues[k + 1] - hues[k]) * (p - k); out.push(`hsl(${h.toFixed(0)},${dk ? 85 : 80}%,${dk ? 68 : 42}%)`); }
	return out;
}

const PX = new Float32Array(2048), PY = new Float32Array(2048);
// draws contour C between indices i0..i1 as a travelling sine; no per-chunk overlaps (butt chunks), round caps only on real ends
export function squig(g, E, C, pal, o) {
	const u = E.u, i0 = Math.max(0, o.i0 ?? 0), i1 = Math.min(C.N - 1, o.i1 ?? C.N - 1); if (i1 - i0 < 3) return;
	const lw = Math.max(1, Math.round(o.lw * u)), span = i1 - i0;
	for (let i = i0; i <= i1; i++) {
		const tp = o.taper ? Math.sin((Math.PI * (i - i0)) / span) ** 0.6 : 1, w = o.A * tp * C.k[i] * Math.sin((TAU * C.s[i]) / o.lam - o.ph) + (o.off || 0);
		PX[i] = E.c + (C.x[i] + C.nx[i] * w) * u + (o.dx || 0); PY[i] = E.c + (C.y[i] + C.ny[i] * w) * u + (o.dy || 0);
	}
	g.lineWidth = lw; g.lineCap = "butt"; g.lineJoin = "round";
	const step = 10, shift = o.shift || 0;
	for (let i = i0; i < i1; i += step) {
		const e = Math.min(i1, i + step), c = (((C.s[i] / 190 + shift) % 2) + 2) % 2, ci = Math.round((c > 1 ? 2 - c : c) * 47), al = o.alpha * C.a[(i + e) >> 1] * (o.fade ? o.fade(i) : 1);
		if (al < 0.02) continue;
		g.globalAlpha = al; g.strokeStyle = o.color || pal[ci]; g.beginPath(); g.moveTo(PX[i], PY[i]); for (let q = i + 1; q <= e; q++) g.lineTo(PX[q], PY[q]); g.stroke();
	}
	if (o.caps) { g.fillStyle = o.color || pal[Math.round((((C.s[i0] / 190 + shift) % 1) + 1) % 1 * 47)]; for (const q of [i0, i1]) { g.globalAlpha = o.alpha * C.a[q]; g.beginPath(); g.arc(PX[q], PY[q], lw / 2, 0, TAU); g.fill(); } }
	g.globalAlpha = 1;
}

const backdrop = (g, E, rim, h) => {
	g.save(); E.circle(g, 127); g.clip(); skyGradient(E, g, "navy"); g.restore();
	g.save(); g.globalCompositeOperation = E.dark ? "lighter" : "source-over"; g.globalAlpha = 0.45 + 0.4 * h; g.drawImage(rim, 0, 0); g.restore();
};
const base = (E) => ({ pad: 48, assets: ["body"], field: true, fps: 30 });

// 500: one aurora squiggle just outside the silhouette
export const squiggleAura = {
	...base(), t0: 0,
	setup(E) {
		const C = contour(E, 9), pal = palette(E), rim = fieldRim(E, 5, palLut(E), E.dark ? 0.3 : 0.35);
		let ph = 0, last = null, amp = 0.9;
		return (g, t, h, p) => {
			ph += last == null ? 0 : (t - last) * TAU * 0.9 * h; last = t; // wiggles and travels only while the cursor is near
			amp = 1.1 + 2.1 * h;
			backdrop(g, E, rim, h);
			g.save();
			// soft under-glow, then the 3px line
			squig(g, E, C, pal, { A: amp, lam: 32, ph, lw: 6.5, alpha: 0.1 + 0.1 * h, shift: t * 0.02 * h });
			squig(g, E, C, pal, { A: amp, lam: 32, ph, lw: 3, alpha: 0.95, shift: t * 0.02 * h });
			g.restore(); bodyDraw(g, E); ring(E, g, 0.2 + 0.2 * h);
			return false;
		};
	},
};

// 501: concentric squiggle rings, each at its own offset, wavelength and speed
export const squiggleRings = {
	...base(), pad: 60,
	setup(E) {
		const specs = [{ L: 9, lam: 30, v: 0.9, a: 1, lw: 3, A: 3.2, p0: 0 }, { L: 24, lam: 38, v: -0.6, a: 0.5, lw: 2, A: 3, p0: 2 }, { L: 40, lam: 46, v: 0.4, a: 0.3, lw: 2, A: 2.8, p0: 4 }];
		const rings = specs.map((s) => ({ ...s, C: contour(E, s.L), ph: s.p0 })), pal = palette(E), rim = fieldRim(E, 5, palLut(E), E.dark ? 0.26 : 0.3);
		let last = null;
		return (g, t, h) => {
			const dt = last == null ? 0 : t - last; last = t;
			backdrop(g, E, rim, h);
			for (const r of rings) { r.ph += dt * TAU * r.v * h; squig(g, E, r.C, pal, { A: r.A * (0.4 + 0.6 * h), lam: r.lam, ph: r.ph, lw: r.lw, alpha: r.a * (0.8 + 0.2 * h), shift: r.p0 * 0.3 + t * 0.015 * h }); }
			bodyDraw(g, E); ring(E, g, 0.2 + 0.2 * h);
			return false;
		};
	},
};

// 502: short round-ended squiggle segments crawl along the outline, denser near the cursor
export const squiggleArcs = {
	...base(), pad: 48,
	setup(E) {
		const C = contour(E, 8), pal = palette(E), rim = fieldRim(E, 5, palLut(E), E.dark ? 0.3 : 0.35), ds = C.ds, r = rng(5);
		const mk = (t0, cur, restSeed) => {
			const R = restSeed ? rng(restSeed) : Math.random; let i = (R() * C.N) | 0;
			if (cur) { let bd = 1e9; for (let q = 0; q < 6; q++) { const c = (R() * C.N) | 0, d = Math.hypot(C.x[c] - cur.x, C.y[c] - cur.y); if (d < bd) { bd = d; i = c; } } }
			return { s0: i * ds, len: 38 + R() * 46, v: (R() < 0.5 ? -1 : 1) * (14 + R() * 22), t0, life: 0.9 + R() * 1.2, ph0: R() * TAU, lam: 28 + R() * 8 };
		};
		const rest = [101, 202, 303].map((sd) => mk(0, null, sd)); let arcs = [];
		const draw = (g, a, k, al, tt, A) => {
			const off = a.v * (tt - a.t0), s = a.s0 + off, i0 = Math.round(s / ds), i1 = i0 + Math.round(a.len / ds);
			if (i0 < 0 || i1 >= C.N) return;
			const env = Math.sin(Math.PI * clamp(k)) ** 0.7;
			squig(g, E, C, pal, { i0, i1, A, lam: a.lam, ph: a.ph0 - TAU * 0.9 * tt, lw: 3, alpha: al * env, taper: true, caps: true, shift: a.ph0 * 0.1 });
		};
		return (g, t, h, p) => {
			backdrop(g, E, rim, h);
			if (h < 0.99) rest.forEach((a, i) => { draw(g, a, 0.5, 0.95 * (1 - h), 0, 1.4); });
			if (h > 0.01) {
				arcs = arcs.filter((a) => t < a.t0 + a.life);
				const want = Math.round(3 + 6 * h);
				while (arcs.length < want) arcs.push(mk(t - Math.random() * 0.2, h > 0.4 && Math.random() < 0.7 ? { x: p.sx, y: p.sy } : null));
				for (const a of arcs) draw(g, a, (t - a.t0) / a.life, smooth(0, 0.3, h), t, 2.2 + 1.1 * h);
			}
			bodyDraw(g, E); ring(E, g, 0.2 + 0.2 * h);
			return arcs.length > 0 && h > 0.004;
		};
	},
};
