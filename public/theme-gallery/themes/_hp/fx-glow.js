// _hp/fx-glow.js: #493-499, wacky glows driven by the outside of his cutout. They all read a signed distance field of the cutout (built once in hp.js,
// ~1 du per cell), shade it per cell into a small RGBA buffer (half resolution for soft glows) and upscale it onto the overflow canvas.
import { faded, ring, rgba, fieldRim, palLut, skyGradient } from "./kit.js";
import { PAL, lut, rng, smooth, clamp, makeNoise } from "./kit.js";

const TAU = Math.PI * 2;
const body = (g, E) => { g.save(); E.dome(g, 128, 200); g.clip(); E.drawImg(g, E.img.body); g.restore(); };
const disc = (g, E, fn, r = 127) => { g.save(); E.circle(g, r); g.clip(); fn(); g.restore(); };
const comp = (E) => (E.dark ? "lighter" : "source-over");

// 493: a multi-colour aura that breathes around the silhouette
export const aura = {
	pad: 64, assets: ["body"], field: true, fps: 30, idle: 16, t0: 2,
	setup(E) {
		const f = E.fld, n = f.n, F = f.F, M = f.m, ANG = f.ang, L = palLut(E), gl = E.glow.half(), gn = gl.gn, dk = E.dark;
		return (g, t, h) => {
			gl.clear(); const d8 = gl.data, br = 0.5 + 0.5 * Math.sin(t * 1.3), s1 = 7 + 3 * h, s2 = 24 + 10 * h, amp = (dk ? 0.62 : 0.7) + 0.42 * h;
			for (let j = 0; j < gn; j++) for (let i = 0; i < gn; i++) {
				const k = j * 2 * n + i * 2, d = F[k]; if (d < -0.6 || d > 78) continue;
				const dd = d < 0 ? 0 : d, a = ang(k);
				let I = (Math.exp(-dd / s1) * 0.85 + Math.exp(-dd / s2) * 0.5) * (0.82 + 0.18 * br) * (1 + 0.28 * Math.sin(a * TAU * 3 - t * (1.2 + 2 * h) + dd * 0.05)) * amp * M[k] * (1 - smooth(34, 76, dd));
				if (I < 0.01) continue;
				const c = ((((a + t * 0.04 + dd * 0.004 + 0.12 * Math.sin(t * 0.7 + a * TAU * 2)) % 1) + 1) % 1 * 255 | 0) * 3, o = (j * gn + i) * 4;
				d8[o] = L[c]; d8[o + 1] = L[c + 1]; d8[o + 2] = L[c + 2]; d8[o + 3] = Math.min(1, I) * (dk ? 255 : 215);
			}
			gl.flush(g, comp(E)); body(g, E);
			function ang(k) { return ANG[k]; }
		};
	},
};

// 494: a thin neon tube traces the silhouette and flickers to life
export const neon = {
	pad: 40, assets: ["bg", "body"], field: true, fps: 30,
	setup(E) {
		const f = E.fld, n = f.n, F = f.F, M = f.m, ANG = f.ang, dk = E.dark, gl = E.glow.full(), gn = gl.gn;
		const P = dk ? PAL.dark : PAL.light, L = lut([P[3], P[2], P[1], P[0]]); // pink at left, teal at right
		const back = faded(E, 0.55, 1.0), r = rng(9), ob = Array.from({ length: 24 }, () => 0.05 + r() * 0.6), hash = (v) => { const x = Math.sin(v * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
		const lit = new Float32Array(24);
		return (g, t, h) => {
			const th = E.state.th, base = 0.26;
			for (let b = 0; b < 24; b++) { let v = th < ob[b] ? base : th < ob[b] + 0.55 ? (hash(Math.floor(th * 26) + b * 7.3) > 0.42 ? 1 : 0.32) : 1; lit[b] = base + (v - base) * h; }
			gl.clear(); const d8 = gl.data;
			for (let j = 0; j < gn; j++) for (let i = 0; i < gn; i++) {
				const k = j * n + i, d = F[k]; if (d < -1 || d > 46) continue;
				const e = d - 3.2, core = Math.exp(-(e * e) / 0.9), halo = Math.exp(-Math.abs(e) / 5.2) * 0.5 + Math.exp(-Math.max(0, d) / 20) * 0.16;
				const lv = lit[(ANG[k] * 24) | 0], I = (core * (dk ? 1 : 0.95) + halo * (dk ? 1 : 0.7)) * lv * M[k];
				if (I < 0.01) continue;
				const c = clamp(i / gn) * 255 | 0, o = (j * gn + i) * 4, w = dk ? core * lv * 0.85 : 0;
				d8[o] = L[c * 3] + (255 - L[c * 3]) * w; d8[o + 1] = L[c * 3 + 1] + (255 - L[c * 3 + 1]) * w; d8[o + 2] = L[c * 3 + 2] + (255 - L[c * 3 + 2]) * w; d8[o + 3] = Math.min(1, I) * 255;
			}
			g.globalAlpha = dk ? 0.35 : 0.8; g.drawImage(back, E.o, E.o); g.globalAlpha = 1;
			gl.flush(g, comp(E)); body(g, E);
		};
	},
};

// 495: sparks and stardust stream off the edge
export const sparks = {
	pad: 64, assets: ["body"], field: true, fps: 45,
	setup(E) {
		const f = E.fld, ed = f.edge, dk = E.dark, u = E.u, P = dk ? PAL.dark : PAL.light, L = palLut(E);
		const rim = fieldRim(E, 4.5, L, dk ? 0.5 : 0.55), rim2 = fieldRim(E, 10, L, dk ? 0.22 : 0.2, 0.3), rnd = rng(77);
		const spr = P.map((c) => { const s = E.mk(32), q = s.getContext("2d"), gr = q.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, dk ? "rgba(255,255,255,1)" : rgba(c, 1)); gr.addColorStop(0.22, rgba(c, 0.85)); gr.addColorStop(1, rgba(c, 0)); q.fillStyle = gr; q.fillRect(0, 0, 32, 32); return s; });
		const N = 150, X = new Float32Array(N), Y = new Float32Array(N), VX = new Float32Array(N), VY = new Float32Array(N), LF = new Float32Array(N), LM = new Float32Array(N), SZ = new Float32Array(N), CC = new Uint8Array(N);
		const spawn = (i, age = 0) => {
			let e; for (let q = 0; q < 6; q++) { e = (Math.random() * ed.count) | 0; if (Math.random() < 0.55 + 0.9 * -ed.ny[e]) break; }
			const sp = 8 + Math.random() * 30, jx = (Math.random() - 0.5) * 8;
			X[i] = ed.x[e] + ed.nx[e] * 2; Y[i] = ed.y[e] + ed.ny[e] * 2; VX[i] = ed.nx[e] * sp + jx; VY[i] = ed.ny[e] * sp - 6 - Math.random() * 8;
			LM[i] = LF[i] = 0.7 + Math.random() * 1.5; SZ[i] = 0.7 + Math.random() * Math.random() * 2.6; CC[i] = (Math.random() * 4) | 0;
			if (age) { const a = Math.random() * LM[i] * 0.8; X[i] += VX[i] * a; Y[i] += VY[i] * a; LF[i] -= a; }
		};
		LF.fill(0);
		// a frozen handful of stardust for the rest state
		const dust = []; for (let i = 0; i < 34; i++) { const e = (rnd() * ed.count) | 0, dd = 4 + rnd() * rnd() * 42; dust.push({ x: ed.x[e] + ed.nx[e] * dd, y: ed.y[e] + ed.ny[e] * dd, s: 0.5 + rnd() * 1.4, c: (rnd() * 4) | 0, a: 0.25 + rnd() * 0.6 * (1 - dd / 50) }); }
		let acc = 0;
		const star = (g, x, y, r, a) => { g.globalAlpha = a; g.fillRect(x - r * 3.5, y - 0.35 * u, r * 7, 0.7 * u); g.fillRect(x - 0.35 * u, y - r * 3.5, 0.7 * u, r * 7); };
		return (g, t, h) => {
			const dt = Math.min(0.05, E.state.dt || 0.016);
			g.save(); g.globalCompositeOperation = comp(E);
			g.globalAlpha = 0.45 + 0.55 * h; g.drawImage(rim, 0, 0); g.globalAlpha = 0.5 + 0.5 * h; g.drawImage(rim2, 0, 0);
			g.restore();
			let alive = 0;
			g.save(); g.globalCompositeOperation = comp(E);
			// frozen dust fades out as live sparks take over
			for (const d of dust) { g.globalAlpha = d.a * (1 - h); if (g.globalAlpha > 0.01) { const r = d.s * 3 * u; g.drawImage(spr[d.c], E.c + d.x * u - r, E.c + d.y * u - r, 2 * r, 2 * r); } }
			if (E.state.ht) acc += dt * 110 * h; 
			for (let i = 0; i < N; i++) {
				if (LF[i] <= 0) { if (acc >= 1) { acc -= 1; spawn(i); } else continue; }
				LF[i] -= dt; if (LF[i] <= 0) continue; alive++;
				VX[i] += (Math.sin(t * 5 + i) * 14) * dt; VY[i] -= 5 * dt; VX[i] *= 1 - 0.8 * dt; VY[i] *= 1 - 0.8 * dt;
				X[i] += VX[i] * dt; Y[i] += VY[i] * dt;
				const k = LF[i] / LM[i], a = Math.min(1, k * 2.2) * Math.min(1, (1 - k) * 12 + 0.2), tw = 0.7 + 0.3 * Math.sin(t * 24 + i * 3), r = SZ[i] * u * 2.6 * (0.5 + 0.5 * k);
				g.globalAlpha = a * tw; g.drawImage(spr[CC[i]], E.c + X[i] * u - r, E.c + Y[i] * u - r, 2 * r, 2 * r);
				if (SZ[i] > 2) { g.fillStyle = dk ? "#fff" : rgba(P[CC[i]], 1); star(g, E.c + X[i] * u, E.c + Y[i] * u, SZ[i] * u * 0.7, a * tw * 0.8); }
			}
			g.restore();
			body(g, E);
			return alive > 0;
		};
	},
};

// 496: an RGB-split chromatic halo that shifts with the cursor direction
export const chromatic = {
	pad: 56, assets: ["bg", "body"], field: true, fps: 30,
	setup(E) {
		const f = E.fld, n = f.n, F = f.F, M = f.m, dk = E.dark, gl = E.glow.half(), gn = gl.gn, back = faded(E, 0.3, 0.97);
		let ox = 4, oy = -2.4;
		return (g, t, h, p) => {
			const len = Math.hypot(p.sx, p.sy) || 1, tx = h > 0.02 ? (p.sx / len) * (5 + 4 * Math.min(1, len / 120)) : 4, ty = h > 0.02 ? (p.sy / len) * (5 + 4 * Math.min(1, len / 120)) : -2.4;
			const mix = h; ox = 4 + (tx - 4) * mix; oy = -2.4 + (ty + 2.4) * mix;
			const rx = Math.round(ox * 2) / 2, ry = Math.round(oy * 2) / 2, w = 8 + 5 * h, amp = (dk ? 0.78 : 0.85) + 0.3 * h;
			gl.clear(); const d8 = gl.data, at = (k, sx, sy) => { const ii = (k % n) + sx, jj = ((k / n) | 0) + sy; return ii < 0 || jj < 0 || ii >= n || jj >= n ? 90 : F[jj * n + ii]; };
			const sRx = Math.round(rx), sRy = Math.round(ry);
			for (let j = 0; j < gn; j++) for (let i = 0; i < gn; i++) {
				const k = j * 2 * n + i * 2; if (F[k] > 80 + 14 || F[k] < -14) continue;
				const dr = at(k, sRx, sRy), dg = F[k], db = at(k, -sRx, -sRy);
				const ar = Math.exp(-Math.max(0, dr) / w) * amp + Math.exp(-Math.max(0, dr) / 26) * 0.18, ag = Math.exp(-Math.max(0, dg) / w) * amp + Math.exp(-Math.max(0, dg) / 26) * 0.18, ab = Math.exp(-Math.max(0, db) / w) * amp + Math.exp(-Math.max(0, db) / 26) * 0.18;
				const m = M[k], r = ar * m, gg = ag * m, b = ab * m, mx = Math.max(r, gg, b); if (mx < 0.015) continue;
				const o = (j * gn + i) * 4;
				if (dk) { d8[o] = Math.min(255, (r / mx) * 255); d8[o + 1] = Math.min(255, (gg / mx) * 255); d8[o + 2] = Math.min(255, (b / mx) * 255); d8[o + 3] = Math.min(1, mx) * 255; }
				else { const sm = r + gg + b, wr = r / sm, wg = gg / sm, wb = b / sm; d8[o] = 235 * wr + 110 * wg + 20 * wb; d8[o + 1] = 70 * wr + 100 * wg + 185 * wb; d8[o + 2] = 175 * wr + 235 * wg + 225 * wb; d8[o + 3] = Math.min(1, mx) * 175; }
			}
			g.globalAlpha = dk ? 0.5 : 0.9; g.drawImage(back, E.o, E.o); g.globalAlpha = 1;
			gl.flush(g, comp(E)); body(g, E);
		};
	},
};

// 497: faint electric arcs crawl along the outline
export const electric = {
	pad: 48, assets: ["body"], field: true, fps: 30,
	setup(E) {
		const f = E.fld, n = f.n, F = f.F, ed = f.edge, dk = E.dark, u = E.u, L = palLut(E);
		const sd = (x, y) => { const fx = x + n / 2 - 0.5, fy = y + n / 2 - 0.5, i = Math.floor(fx), j = Math.floor(fy); if (i < 0 || j < 0 || i >= n - 1 || j >= n - 1) return 99; const a = fx - i, b = fy - j, k = j * n + i; return F[k] * (1 - a) * (1 - b) + F[k + 1] * a * (1 - b) + F[k + n] * (1 - a) * b + F[k + n + 1] * a * b; };
		const rim = fieldRim(E, 5, L, dk ? 0.34 : 0.4);
		const mkArc = (seed) => {
			const r = rng(seed); let e = 0; for (let q = 0; q < 20; q++) { e = (r() * ed.count) | 0; if (ed.y[e] < 70 || r() < 0.3) break; }
			let x = ed.x[e], y = ed.y[e]; const dir = r() < 0.5 ? -1 : 1, lv = 2.5 + r() * 5.5, N = 22 + ((r() * 22) | 0), pts = new Float32Array(N * 2);
			for (let i = 0; i < N; i++) {
				pts[i * 2] = x; pts[i * 2 + 1] = y;
				const s = sd(x, y), gx = sd(x + 1, y) - sd(x - 1, y), gy = sd(x, y + 1) - sd(x, y - 1), gl = Math.hypot(gx, gy) || 1, nx = gx / gl, ny = gy / gl;
				x += -ny * dir * 2.6 - nx * (s - lv) * 0.8; y += nx * dir * 2.6 - ny * (s - lv) * 0.8;
				if (y > 112) { return { pts: pts.slice(0, Math.max(2, i * 2)), n: Math.max(1, i), seed }; }
			}
			return { pts, n: N, seed };
		};
		const col = dk ? [[150, 215, 255], [190, 165, 255], [140, 255, 220]] : [[70, 80, 220], [130, 60, 215], [20, 130, 170]];
		let arcs = [], rest = [11, 29, 47].map(mkArc), sn = 100, last = -9, jit = null;
		const pathOf = (a, amp, tt, ph) => {
			const p = new Path2D(), m = a.n; if (m < 3) return p;
			for (let i = 0; i < m; i++) {
				const x = a.pts[i * 2], y = a.pts[i * 2 + 1], env = Math.sin((Math.PI * i) / (m - 1)), j = (Math.sin(i * 2.3 + ph) + Math.sin(i * 5.1 + ph * 1.7) * 0.6) * amp * env;
				const px = E.c + (x + j * 0.6) * u, py = E.c + (y + j * 0.8) * u; i ? p.lineTo(px, py) : p.moveTo(px, py);
			}
			return p;
		};
		const strokeArc = (g, a, al, amp, ph) => {
			const p = pathOf(a, amp, 0, ph), c = col[a.seed % 3];
			g.lineJoin = "round"; g.lineCap = "round";
			g.strokeStyle = rgba(c, 0.1 * al); g.lineWidth = 5 * u; g.stroke(p);
			g.strokeStyle = rgba(c, 0.32 * al); g.lineWidth = 2.2 * u; g.stroke(p);
			g.strokeStyle = dk ? `rgba(245,252,255,${0.9 * al})` : rgba(c, 0.9 * al); g.lineWidth = 0.9 * u; g.stroke(p);
		};
		return (g, t, h) => {
			disc(g, E, () => { skyGradient(E, g, "navy"); });
			g.save(); g.globalCompositeOperation = comp(E); g.globalAlpha = 0.5 + 0.5 * h; g.drawImage(rim, 0, 0);
			// frozen faint arcs at rest, crossfading to live ones
			if (h < 0.99) rest.forEach((a, i) => strokeArc(g, a, 0.5 * (1 - h), 1.2, i));
			if (h > 0.01) {
				if (t - last > 1 / 30) { last = t; jit = t * 40; }
				const want = Math.round(2 + 5 * h);
				arcs = arcs.filter((a) => t < a.t0 + a.life);
				while (arcs.length < want) { const a = mkArc(sn++ * 7 + 3); a.t0 = t - Math.random() * 0.1; a.life = 0.16 + Math.random() * 0.34; arcs.push(a); }
				for (const a of arcs) { const k = (t - a.t0) / a.life, env = Math.sin(Math.PI * clamp(k)) ** 0.6; strokeArc(g, a, env * smooth(0, 0.3, h), 2.2 + 2 * Math.abs(Math.sin(jit * 0.3 + a.seed)), jit + a.seed); }
			}
			g.restore();
			body(g, E);
			ring(E, g, 0.2 + 0.2 * h);
			return arcs.length > 0 && !E.state.ht && h > 0.004;
		};
	},
};

// 498: glowing ripples travel outward from the contour
export const ripple = {
	pad: 64, assets: ["bg", "body"], field: true, fps: 30,
	setup(E) {
		const f = E.fld, n = f.n, F = f.F, M = f.m, dk = E.dark, gl = E.glow.half(), gn = gl.gn, back = faded(E, 0.3, 0.97), P = dk ? PAL.dark : PAL.light, L = lut(P);
		let ph = 0, last = null; const SP = 19, SPAN = 76;
		return (g, t, h) => {
			ph += last == null ? 0 : (t - last) * 26 * h; last = t;
			gl.clear(); const d8 = gl.data, amp = 0.5 + 0.55 * h;
			for (let j = 0; j < gn; j++) for (let i = 0; i < gn; i++) {
				const k = j * 2 * n + i * 2, d = F[k]; if (d < -0.8 || d > SPAN + 6) continue;
				const dd = d < 0 ? 0 : d; let I = Math.exp(-dd / 6) * 0.32 + Math.exp(-dd / 24) * 0.1, ci = dd / SPAN;
				for (let q = 0; q < 4; q++) {
					const r = (ph + q * SP) % SPAN, env = (1 - r / SPAN) ** 1.5 * smooth(0, 5, r) , w = 1.9 + r * 0.035, e = (dd - r) / w;
					if (e > -3 && e < 3) { I += Math.exp(-e * e) * env * 1.15; ci = r / SPAN; }
				}
				I *= amp * M[k]; if (I < 0.012) continue;
				const c = (clamp(ci * 0.95 + 0.04 * Math.sin(t * 0.5)) * 255 | 0) * 3, o = (j * gn + i) * 4;
				d8[o] = L[c]; d8[o + 1] = L[c + 1]; d8[o + 2] = L[c + 2]; d8[o + 3] = Math.min(1, I) * (dk ? 255 : 220);
			}
			g.globalAlpha = dk ? 0.55 : 0.9; g.drawImage(back, E.o, E.o); g.globalAlpha = 1;
			gl.flush(g, comp(E)); body(g, E);
		};
	},
};

// 499: aurora flames rise off the outline like a corona
export const corona = {
	pad: 64, assets: ["body"], field: true, fps: 30,
	setup(E) {
		const f = E.fld, n = f.n, F = f.F, M = f.m, dk = E.dark, gl = E.glow.half(), gn = gl.gn, L = dk ? palLut(E, false) : lut([[70, 190, 180], [110, 160, 240], [170, 130, 240], [235, 140, 210]]), N = E.noise;
		let ph = 1.7, last = null;
		return (g, t, h) => {
			ph += last == null ? 0 : (t - last) * (0.2 + 1.7 * h); last = t;
			const A = 13 + 22 * h, Lf = 7 + 5 * h;
			gl.clear(); const d8 = gl.data;
			for (let j = 0; j < gn; j++) for (let i = 0; i < gn; i++) {
				const x = i * 2, y = j * 2, k = y * n + x;
				const fl = Math.min(1.2, N(x * 0.045, y * 0.03 + ph * 1.1) * 0.75 + N(x * 0.12 + 9, y * 0.07 + ph * 2.2) * 0.5), s = A * (0.2 + fl);
				const sx = Math.round(x + Math.sin(y * 0.06 + ph * 2) * 3 * fl), sy = Math.round(y + s);
				if (sx < 0 || sx >= n || sy >= n) continue;
				const d = F[sy * n + sx], d0 = F[k]; if (d > 60 && d0 > 60) continue;
				const dd = d < 0 ? 0 : d, fk = 0.55 + 0.6 * N(x * 0.09 + 3, y * 0.05 - ph * 3);
				let I = (Math.exp(-dd / Lf) * 0.95 * fk + Math.exp(-(d0 < 0 ? 0 : d0) / 5) * 0.4) * (0.85 + 0.35 * h) * M[k];
				if (d0 < -0.6 && d0 < d) continue;
				if (I < 0.015) continue;
				const c = (clamp(dd / 30 + 0.12 * fl) * 255 | 0) * 3, o = (j * gn + i) * 4, w = dk ? Math.max(0, I - 0.8) * 0.8 : 0;
				d8[o] = L[c] + (255 - L[c]) * w; d8[o + 1] = L[c + 1] + (255 - L[c + 1]) * w; d8[o + 2] = L[c + 2] + (255 - L[c + 2]) * w; d8[o + 3] = Math.min(1, I) * (dk ? 255 : 150);
			}
			gl.flush(g, comp(E)); body(g, E);
		};
	},
};
