// _hp/kit.js: sprite builders shared by the fx-*.js specs. Everything here runs once at setup (pre-blurred sprites, no per-frame ctx.filter).
import { PAL, lut, clamp, smooth, makeNoise, rng } from "./hp.js";

const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
export { rgba };

// radial alpha fade of a canvas, centred (a soft multi-stop smoothstep so there is no visible ring)
export function radialFade(cv, inner, outer) {
	const g = cv.getContext("2d"), D = cv.width, gr = g.createRadialGradient(D / 2, D / 2, (inner * D) / 2, D / 2, D / 2, (outer * D) / 2);
	for (let i = 0; i <= 8; i++) gr.addColorStop(i / 8, `rgba(0,0,0,${1 - smooth(0, 1, i / 8)})`);
	g.globalCompositeOperation = "destination-in"; g.fillStyle = gr; g.fillRect(0, 0, D, D); g.globalCompositeOperation = "source-over";
	return cv;
}
// the photo background (Josh painted out), at circle size, optionally faded toward the circle's edge
export function faded(E, inner = 0.4, outer = 0.98) {
	const c = E.mk(E.D), g = c.getContext("2d"); g.drawImage(E.bgFull(), 0, 0, E.D, E.D);
	return radialFade(c, inner, outer);
}
// Josh at circle size; below his chest the cutout dissolves toward the circle's edge, above it (antenna) stays whole
export function bodyDomeFade(E, inner = 0.8, outer = 1.0) {
	const c = E.mk(E.D), g = c.getContext("2d"), D = E.D;
	g.drawImage(E.img.body, 0, 0, D, D);
	const m = E.mk(D), mg = m.getContext("2d"); mg.fillStyle = "#000"; mg.fillRect(0, 0, D, D); radialFade(m, inner, outer); mg.fillRect(0, 0, D, D / 2 - 1);
	g.globalCompositeOperation = "destination-in"; g.drawImage(m, 0, 0); g.globalCompositeOperation = "source-over";
	return c;
}
// blurred, tinted silhouette glow of the cutout (built once). pad must exist on the canvas. stops: gradient colours top-left -> bottom-right.
export function silhouetteGlow(E, blur, stops, alpha = 1) {
	const c = E.mk(E.C), g = c.getContext("2d");
	g.filter = `blur(${blur * E.u}px)`; E.drawImg(g, E.img.body); g.filter = "none";
	g.globalCompositeOperation = "source-in";
	const gr = g.createLinearGradient(E.o, E.o, E.o + E.D, E.o + E.D); stops.forEach((s, i) => gr.addColorStop(i / (stops.length - 1), rgba(s, alpha)));
	g.fillStyle = gr; g.fillRect(0, 0, E.C, E.C);
	return c;
}
// aurora ribbons: three pre-blurred curtains, drifted with a phase. Returns { draw(g, phase, alpha) } painting inside the circle's box (clip it yourself).
export function aurora(E, { rays = 0.5, sat = 1 } = {}) {
	const D = E.D, W = Math.round(D * 1.8), pal = (E.dark ? PAL.dark : PAL.light).map((c) => { const y = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]; return c.map((v) => y + (v - y) * sat); }), N = E.noise, cs = [];
	for (let k = 0; k < 3; k++) {
		const c = E.mk(W, D), x = c.getContext("2d"), seed = k * 2.3 + 1;
		for (let px = 0; px < W; px += 2) {
			const u = px / W, top = D * (0.1 + 0.22 * (0.5 + 0.5 * Math.sin(u * 7 + seed)) + 0.07 * Math.sin(u * 19 + seed * 2) + k * 0.1);
			const len = D * (0.32 + 0.22 * (0.5 + 0.5 * Math.sin(u * 5 + seed * 1.7)));
			const ci = ((u * 1.4 + k * 0.33) % 1) * (pal.length - 1), i0 = Math.min(pal.length - 2, ci | 0), f = ci - i0;
			const col = [0, 1, 2].map((q) => pal[i0][q] + (pal[i0 + 1][q] - pal[i0][q]) * f);
			const ray = 1 - rays + rays * N(u * 90 + k * 5, 3.3);
			const gr = x.createLinearGradient(0, top, 0, top + len);
			gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(0.22, rgba(col, 0.95 * ray)); gr.addColorStop(0.5, rgba(col, 0.45 * ray)); gr.addColorStop(1, rgba(col, 0));
			x.fillStyle = gr; x.fillRect(px, top, 2.3, len);
		}
		const o = E.mk(W, D), og = o.getContext("2d"); og.filter = `blur(${4 * E.u}px)`; og.drawImage(c, 0, 0); cs.push(o);
	}
	return {
		draw(g, phase, alpha = 1) {
			g.save(); g.globalCompositeOperation = E.dark ? "lighter" : "source-over";
			cs.forEach((c, k) => {
				const sp = 0.23 + k * 0.11, dx = -(W - D) * (0.5 + 0.5 * Math.sin(phase * sp + k * 2.1));
				const dy = Math.sin(phase * 0.37 + k * 1.7) * D * 0.04;
				g.globalAlpha = alpha * (E.dark ? 0.62 : 0.5) * (0.8 + 0.2 * Math.sin(phase * 0.6 + k));
				g.drawImage(c, E.o + dx, E.o + dy);
			});
			g.restore();
		},
	};
}
export function skyGradient(E, g, kind = "night") {
	const gr = g.createLinearGradient(0, E.o, 0, E.o + E.D);
	if (E.dark) {
		if (kind === "navy") { gr.addColorStop(0, "#050a1d"); gr.addColorStop(0.6, "#0b1a3a"); gr.addColorStop(1, "#0d2a44"); }
		else { gr.addColorStop(0, "#040817"); gr.addColorStop(0.55, "#0a1636"); gr.addColorStop(1, "#122a4a"); }
	} else { gr.addColorStop(0, "#dfe8ff"); gr.addColorStop(0.55, "#eceaff"); gr.addColorStop(1, "#ffe9ec"); }
	g.fillStyle = gr; g.fillRect(E.o, E.o, E.D, E.D);
}
// thin ring around the circle
export function ring(E, g, alpha = 0.3, w = 1) {
	g.save(); const gr = g.createLinearGradient(E.o, E.o, E.o + E.D, E.o + E.D), pal = E.dark ? PAL.dark : PAL.light;
	gr.addColorStop(0, rgba(pal[0], alpha)); gr.addColorStop(0.5, rgba(pal[2], alpha)); gr.addColorStop(1, rgba(pal[3], alpha));
	g.strokeStyle = gr; g.lineWidth = w * E.u; E.circle(g, 127.5); g.stroke(); g.restore();
}
// field-driven rim sprite (built once): alpha = exp(-d/tau), coloured by LUT along the angle around the centre
export function fieldRim(E, tau, L, a = 1, shift = 0) {
	const f = E.fld, n = f.n, cv = E.mk(n), x = cv.getContext("2d"), id = x.createImageData(n, n), d = id.data;
	for (let i = 0; i < n * n; i++) {
		const sd = f.F[i]; if (sd < -0.5 || sd > tau * 5) continue;
		const al = Math.exp(-Math.max(0, sd) / tau) * a * f.m[i]; if (al < 0.004) continue;
		const k = (((f.ang[i] + shift) % 1) * 255) | 0;
		d[i * 4] = L[k * 3]; d[i * 4 + 1] = L[k * 3 + 1]; d[i * 4 + 2] = L[k * 3 + 2]; d[i * 4 + 3] = clamp(al) * 255;
	}
	x.putImageData(id, 0, 0);
	const out = E.mk(E.C); const og = out.getContext("2d"); og.imageSmoothingQuality = "high"; og.drawImage(cv, 0, 0, E.C, E.C); return out;
}
export const palLut = (E, loop = true) => { const p = E.dark ? PAL.dark : PAL.light; return lut(loop ? [...p, p[0]] : p); };
export { makeNoise, rng, clamp, smooth, lut, PAL };
