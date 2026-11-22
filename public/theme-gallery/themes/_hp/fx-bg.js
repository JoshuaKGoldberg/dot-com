// _hp/fx-bg.js: #480-487, "less dull" backgrounds. Each spec: { pad, assets, fps, idle, setup(E) -> frame(g, t, h, P) }
import { faded, bodyDomeFade, silhouetteGlow, aurora, skyGradient, ring, rgba, radialFade } from "./kit.js";
import { PAL, lut, makeNoise, rng, smooth, clamp } from "./kit.js";

const TAU = Math.PI * 2;
const draw = (g, E, im, a = 1) => { g.globalAlpha = a; g.drawImage(im, E.o, E.o, E.D, E.D); g.globalAlpha = 1; };
const withCircle = (g, E, fn, r = 128) => { g.save(); E.circle(g, r); g.clip(); fn(); g.restore(); };
const withDome = (g, E, fn, r = 128) => { g.save(); E.dome(g, r); g.clip(); fn(); g.restore(); };

// 480: no background. aurora rim light + a faint circle trace
export const noBg = {
	pad: 28, assets: ["body"], fps: 60,
	setup(E) {
		const P = E.dark ? PAL.dark : PAL.light;
		const rimA = silhouetteGlow(E, 7, [P[0], P[1], P[2]], E.dark ? 0.85 : 0.7), rimB = silhouetteGlow(E, 7, [P[3], P[2], P[0]], E.dark ? 0.85 : 0.7);
		const tight = silhouetteGlow(E, 2.2, [P[1], P[2], P[3]], E.dark ? 0.9 : 0.7);
		const cmp = E.dark ? "lighter" : "source-over";
		return (g, t, h) => {
			const x = 0.5 + 0.5 * Math.sin(t * 0.9);
			g.save(); E.dome(g, 128, 200); g.clip(); g.globalCompositeOperation = cmp;
			g.globalAlpha = 0.5 + 0.35 * h; g.drawImage(rimA, 0, 0);
			g.globalAlpha = (0.2 + 0.5 * h) * x * (E.dark ? 1 : 0.8); g.drawImage(rimB, 0, 0);
			g.globalAlpha = 0.18 + 0.3 * h; g.drawImage(tight, 0, 0);
			g.restore();
			// circle trace: a long arc that closes and slowly turns on hover
			const gr = g.createLinearGradient(E.o, E.o, E.o + E.D, E.o + E.D); gr.addColorStop(0, rgba(P[0], 1)); gr.addColorStop(0.5, rgba(P[2], 1)); gr.addColorStop(1, rgba(P[3], 1));
			g.save(); g.strokeStyle = gr; g.lineCap = "round"; g.lineWidth = 1.1 * E.u;
			const a0 = -0.8 + t * 0.35 * h, sweep = TAU * (0.62 + 0.38 * h);
			g.globalAlpha = 0.28 + 0.4 * h; E.circle(g, 127); g.setLineDash([]); g.beginPath(); g.arc(E.c, E.c, 127 * E.u, a0, a0 + sweep); g.stroke();
			g.restore();
			withDome(g, E, () => E.drawImg(g, E.img.body));
		};
	},
};

// 481: the photo's own background, dissolving radially
export const fadeBg = {
	pad: 0, assets: ["bg", "body"], fps: 60,
	setup(E) {
		const A = faded(E, 0.28, 0.95), B = faded(E, 0.5, 1.0), body = bodyDomeFade(E, 0.8, 1.0);
		return (g, t, h) => {
			g.globalAlpha = E.dark ? 0.78 : 0.95; g.drawImage(A, E.o, E.o); g.globalAlpha = (E.dark ? 0.78 : 0.95) * h; g.drawImage(B, E.o, E.o); g.globalAlpha = 1;
			g.drawImage(body, E.o, E.o);
		};
	},
};

// 482: slow aurora behind him, living in the circle
export const auroraBg = {
	pad: 8, assets: ["body"], fps: 30, idle: 18, t0: 3,
	setup(E) {
		const au = aurora(E);
		let ph = 3, last = null;
		return (g, t, h) => {
			ph += last == null ? 0 : (t - last) * (1 + 2.4 * h); last = t;
			withCircle(g, E, () => {
				skyGradient(E, g, "navy");
				au.draw(g, ph, 1 + 0.45 * h);
				// a soft floor glow
				const gr = g.createRadialGradient(E.c, E.o + E.D, 0, E.c, E.o + E.D, E.D * 0.7);
				gr.addColorStop(0, E.dark ? "rgba(110,200,255,0.22)" : "rgba(160,120,255,0.18)"); gr.addColorStop(1, "rgba(0,0,0,0)");
				g.fillStyle = gr; g.fillRect(E.o, E.o, E.D, E.D);
				E.drawImg(g, E.img.body);
			});
			ring(E, g, 0.32 + 0.3 * h);
		};
	},
};

// 483: dark-sky star field with a faint Milky Way (dark) or a pale dawn sky (light)
export const starfieldBg = {
	pad: 8, assets: ["body"], fps: 40,
	setup(E) {
		const D = E.D, r = rng(5), sky = E.mk(D), sg = sky.getContext("2d");
		const o = { o: 0, D, dark: E.dark };
		const gr = sg.createLinearGradient(0, 0, 0, D);
		if (E.dark) { gr.addColorStop(0, "#03060f"); gr.addColorStop(0.6, "#08122b"); gr.addColorStop(1, "#14223f"); }
		else { gr.addColorStop(0, "#c9d6ff"); gr.addColorStop(0.5, "#eadcf6"); gr.addColorStop(1, "#ffe3cf"); }
		sg.fillStyle = gr; sg.fillRect(0, 0, D, D);
		if (E.dark) { // milky way: a blurred diagonal band + dust
			const band = E.mk(D), bg = band.getContext("2d"); bg.translate(D / 2, D / 2); bg.rotate(-0.62);
			const bgr = bg.createLinearGradient(0, -D * 0.3, 0, D * 0.3); bgr.addColorStop(0, "rgba(160,170,255,0)"); bgr.addColorStop(0.5, "rgba(190,200,255,0.5)"); bgr.addColorStop(1, "rgba(160,170,255,0)");
			bg.fillStyle = bgr; bg.fillRect(-D, -D * 0.3, 2 * D, D * 0.6);
			const bl = E.mk(D), bq = bl.getContext("2d"); bq.filter = `blur(${D * 0.03}px)`; bq.drawImage(band, 0, 0); sg.globalAlpha = 0.55; sg.drawImage(bl, 0, 0); sg.globalAlpha = 1;
			for (let i = 0; i < 900; i++) { const a = r() * TAU, rad = (r() - 0.5) * (r() - 0.5) * D * 0.9, lx = Math.cos(-0.62) * (r() - 0.5) * D * 1.3 - Math.sin(-0.62) * rad, ly = Math.sin(-0.62) * (r() - 0.5) * D * 1.3 + Math.cos(-0.62) * rad; sg.fillStyle = `rgba(215,225,255,${0.12 + r() * 0.35})`; sg.fillRect(D / 2 + lx, D / 2 + ly, 0.9 * E.u, 0.9 * E.u); }
		} else { // dawn glow
			const sun = sg.createRadialGradient(D * 0.22, D * 1.02, 0, D * 0.22, D * 1.02, D * 0.8); sun.addColorStop(0, "rgba(255,200,150,0.75)"); sun.addColorStop(1, "rgba(255,200,150,0)"); sg.fillStyle = sun; sg.fillRect(0, 0, D, D);
		}
		const stars = [];
		for (let i = 0; i < (E.dark ? 110 : 26); i++) { const s = { x: r() * D, y: r() * D * 0.92, m: r(), tw: i < 14 ? r() * TAU : -1 }; stars.push(s); }
		const sc = E.dark ? "255,255,255" : "255,255,255";
		const star = (g2, s, a, k = 1) => { const rd = (0.5 + s.m * s.m * 1.4) * E.u * k; g2.fillStyle = `rgba(${sc},${a})`; g2.beginPath(); g2.arc(s.x, s.y, rd, 0, TAU); g2.fill(); if (s.m > 0.85 && E.dark) { g2.fillRect(s.x - rd * 3, s.y - 0.3 * E.u, rd * 6, 0.6 * E.u); g2.fillRect(s.x - 0.3 * E.u, s.y - rd * 3, 0.6 * E.u, rd * 6); } };
		for (const s of stars) if (s.tw < 0) star(sg, s, E.dark ? 0.35 + s.m * 0.6 : 0.8);
		const tw = stars.filter((s) => s.tw >= 0);
		return (g, t, h) => {
			withCircle(g, E, () => {
				g.drawImage(sky, E.o, E.o);
				g.save(); g.translate(E.o, E.o);
				for (const s of tw) star(g, s, E.dark ? 0.35 + 0.6 * (0.5 + 0.5 * Math.sin(t * 2.4 * h + s.tw)) * (0.5 + 0.5 * h) + 0.1 : 0.8, 1 + 0.3 * h);
				g.restore();
				E.drawImg(g, E.img.body);
			});
			ring(E, g, 0.22 + 0.25 * h);
		};
	},
};

// 484: duotone gradient-map of the background (the cutout keeps its colour)
export const duotoneBg = {
	pad: 8, assets: ["bg", "body"], fps: 60,
	setup(E) {
		const S = 512, src = E.bgFull(), sx = src.getContext("2d").getImageData(0, 0, S, S).data;
		let lo = 255, hi = 0; const lum = new Float32Array(S * S);
		for (let i = 0; i < S * S; i++) { const l = 0.3 * sx[i * 4] + 0.59 * sx[i * 4 + 1] + 0.11 * sx[i * 4 + 2]; lum[i] = l; if (l < lo) lo = l; if (l > hi) hi = l; }
		const mkMap = (stops) => { const L = lut(stops), c = E.mk(E.D), tmp = E.mk(S), tg = tmp.getContext("2d"), id = tg.createImageData(S, S); for (let i = 0; i < S * S; i++) { const k = clamp((lum[i] - lo) / (hi - lo + 1e-3)) ** 0.9 * 255 | 0; id.data[i * 4] = L[k * 3]; id.data[i * 4 + 1] = L[k * 3 + 1]; id.data[i * 4 + 2] = L[k * 3 + 2]; id.data[i * 4 + 3] = 255; } tg.putImageData(id, 0, 0); c.getContext("2d").drawImage(tmp, 0, 0, E.D, E.D); return c; };
		const A = mkMap(E.dark ? [[6, 12, 34], [12, 40, 70], [34, 110, 130], [110, 190, 190]] : [[244, 240, 255], [226, 236, 252], [255, 226, 236], [255, 208, 224]]);
		const B = mkMap(E.dark ? [[10, 8, 36], [38, 28, 90], [88, 70, 160], [160, 140, 220]] : [[235, 250, 244], [220, 238, 250], [236, 226, 255], [214, 204, 252]]);
		return (g, t, h) => {
			withCircle(g, E, () => {
				g.drawImage(A, E.o, E.o); g.globalAlpha = h; g.drawImage(B, E.o, E.o); g.globalAlpha = 1;
				E.drawImg(g, E.img.body, 1 + 0.015 * h, 0, -1.5 * h);
			});
			ring(E, g, 0.2 + 0.3 * h);
		};
	},
};

// 485: frosted glass
export const glassBg = {
	pad: 8, assets: ["bg", "body"], fps: 60,
	setup(E) {
		const D = E.D, big = E.mk(D), bq = big.getContext("2d");
		const mkBlur = (px) => { const c = E.mk(D), cg = c.getContext("2d"); cg.filter = `blur(${px * E.u}px)`; cg.drawImage(E.bgFull(), -D * 0.1, -D * 0.1, D * 1.2, D * 1.2); cg.filter = "none"; return c; };
		const tint = (c) => { const q = c.getContext("2d"); q.globalCompositeOperation = "source-over"; q.fillStyle = E.dark ? "rgba(70,110,190,0.50)" : "rgba(255,255,255,0.28)"; q.fillRect(0, 0, D, D); q.fillStyle = E.dark ? "rgba(10,16,40,0.3)" : "rgba(170,190,255,0.22)"; q.fillRect(0, 0, D, D); };
		const heavy = mkBlur(10), soft = mkBlur(3.2); tint(heavy); tint(soft);
		// frost grain, baked once
		const gr = E.mk(D), gg = gr.getContext("2d"), r = rng(3), id = gg.createImageData(D, D);
		for (let i = 0; i < D * D; i++) { const v = r(); id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = E.dark ? 255 : 255; id.data[i * 4 + 3] = v > 0.55 ? (v - 0.55) * 130 : 0; }
		gg.putImageData(id, 0, 0);
		for (const c of [heavy, soft]) { const q = c.getContext("2d"); q.globalAlpha = E.dark ? 0.45 : 0.5; q.drawImage(gr, 0, 0); q.globalAlpha = 1; }
		radialFade(heavy, 0.5, 1.0); radialFade(soft, 0.5, 1.0);
		const sweep = E.mk(D), sg = sweep.getContext("2d"); sg.translate(D / 2, D / 2); sg.rotate(-0.7);
		const sgr = sg.createLinearGradient(-D * 0.1, 0, D * 0.1, 0); sgr.addColorStop(0, "rgba(255,255,255,0)"); sgr.addColorStop(0.5, "rgba(255,255,255,0.5)"); sgr.addColorStop(1, "rgba(255,255,255,0)"); sg.fillStyle = sgr; sg.fillRect(-D * 0.1, -D, D * 0.2, 2 * D);
		return (g, t, h) => {
			withCircle(g, E, () => {
				g.globalAlpha = E.dark ? 0.95 : 0.98; g.drawImage(heavy, E.o, E.o); g.globalAlpha = (E.dark ? 0.95 : 0.98) * h * 0.65; g.drawImage(soft, E.o, E.o); g.globalAlpha = 1;
				g.globalAlpha = (E.dark ? 0.35 : 0.5) * Math.sin(Math.PI * clamp(h * 0.999)); // sweep light, only while hovering
				const dx = (-0.6 + 1.2 * clamp(t * 0.9 % 2.2 / 1.4)) * E.D * (h > 0.01 ? 1 : 0);
				g.drawImage(sweep, E.o + dx, E.o); g.globalAlpha = 1;
				E.drawImg(g, E.img.body);
			});
			g.save(); E.circle(g, 127.5); const rg = g.createLinearGradient(E.o, E.o, E.o + E.D, E.o + E.D); rg.addColorStop(0, `rgba(255,255,255,${E.dark ? 0.4 : 0.75})`); rg.addColorStop(0.5, "rgba(255,255,255,0.05)"); rg.addColorStop(1, `rgba(255,255,255,${E.dark ? 0.22 : 0.5})`); g.strokeStyle = rg; g.lineWidth = 1.2 * E.u; g.stroke(); g.restore();
		};
	},
};

// 486: a faint Goldberg snark where the background was
export const graphBg = {
	pad: 8, assets: ["body"], fps: 40,
	async setup(E) {
		const mod = await import("../_graphs/goldberg-graphs.js");
		const G = mod.GOLDBERG.find((q) => q.id === "goldberg-snark-7") || mod.GOLDBERG[0], lay = G.layouts.rotational || Object.values(G.layouts)[0];
		const pal = E.dark ? PAL.dark : PAL.light, L = lut([...pal, pal[0]]);
		const sky = E.mk(E.D), sg = sky.getContext("2d");
		const base = sg.createRadialGradient(E.D / 2, E.D * 0.45, 0, E.D / 2, E.D / 2, E.D * 0.75);
		if (E.dark) { base.addColorStop(0, "#0e1d3d"); base.addColorStop(1, "#050a1d"); } else { base.addColorStop(0, "#f6f3ff"); base.addColorStop(1, "#e5e9fb"); }
		sg.fillStyle = base; sg.fillRect(0, 0, E.D, E.D);
		const col = (i) => { const k = ((i / G.n) * 255) | 0; return [L[k * 3], L[k * 3 + 1], L[k * 3 + 2]]; };
		return (g, t, h) => {
			const yaw = 0.35 + 0.5 * Math.sin(t * 0.5) * h , pitch = 0.45 + 0.1 * h;
			const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), s = E.D * 0.54;
			const pts = lay.map(([x, y, z = 0]) => { const x1 = x * cy + z * sy, z1 = -x * sy + z * cy, y1 = y * cp - z1 * sp, z2 = y * sp + z1 * cp, k = 1 / (1 - z2 * 0.25); return [E.c + x1 * s * k, E.c + y1 * s * k, z2]; });
			withCircle(g, E, () => {
				g.drawImage(sky, E.o, E.o);
				g.lineWidth = (0.9 + 0.5 * h) * E.u; g.lineCap = "round";
				const a = (E.dark ? 0.5 : 0.55) + 0.3 * h;
				G.edges.forEach(([i, j], q) => { const c = col(i); g.strokeStyle = rgba(c, a * (0.7 + 0.3 * ((pts[i][2] + pts[j][2]) * 0.5 + 1) / 2)); g.beginPath(); g.moveTo(pts[i][0], pts[i][1]); g.lineTo(pts[j][0], pts[j][1]); g.stroke(); });
				pts.forEach((p, i) => { g.fillStyle = rgba(E.dark ? [235, 245, 255] : col(i), (E.dark ? 0.55 : 0.6) + 0.3 * h); g.beginPath(); g.arc(p[0], p[1], (1.1 + 0.9 * ((p[2] + 1) / 2)) * E.u, 0, TAU); g.fill(); });
				E.drawImg(g, E.img.body);
			});
			ring(E, g, 0.22 + 0.25 * h);
		};
	},
};

// 487: break the frame: no circle; antenna above, shoulders fade into the page
export const breakFrame = {
	pad: 40, assets: ["body"], fps: 60,
	setup(E) {
		const P = E.dark ? PAL.dark : PAL.light;
		const body = E.mk(E.C), bg = body.getContext("2d");
		E.drawImg(bg, E.img.body);
		bg.globalCompositeOperation = "destination-in";
		const fg = bg.createLinearGradient(0, E.o + E.D * 0.66, 0, E.o + E.D); fg.addColorStop(0, "#000"); fg.addColorStop(0.55, "rgba(0,0,0,0.55)"); fg.addColorStop(1, "rgba(0,0,0,0)");
		bg.fillStyle = fg; bg.fillRect(0, 0, E.C, E.C);
		// a soft halo that sits behind the head
		const halo = E.mk(E.C), hg = halo.getContext("2d"), hr = hg.createRadialGradient(E.c, E.c - 20 * E.u, 0, E.c, E.c - 20 * E.u, 150 * E.u);
		hr.addColorStop(0, rgba(P[1], E.dark ? 0.34 : 0.3)); hr.addColorStop(0.5, rgba(P[2], E.dark ? 0.16 : 0.14)); hr.addColorStop(1, rgba(P[2], 0)); hg.fillStyle = hr; hg.fillRect(0, 0, E.C, E.C);
		const halo2 = E.mk(E.C), h2 = halo2.getContext("2d"), r2 = h2.createRadialGradient(E.c - 30 * E.u, E.c - 50 * E.u, 0, E.c, E.c - 20 * E.u, 140 * E.u);
		r2.addColorStop(0, rgba(P[0], E.dark ? 0.3 : 0.26)); r2.addColorStop(1, rgba(P[0], 0)); h2.fillStyle = r2; h2.fillRect(0, 0, E.C, E.C);
		return (g, t, h, p) => {
			const dx = (p.sx / 128) * 3 * h, dy = (p.sy / 128) * 2 * h - 3 * h;
			g.globalAlpha = 0.65 + 0.35 * h; g.drawImage(halo, -dx * E.u * 1.5, -dy * E.u * 1.5); g.drawImage(halo2, dx * E.u * 2, dy * E.u * 2); g.globalAlpha = 1;
			g.drawImage(body, dx * E.u, dy * E.u - 0 * E.u);
		};
	},
};
