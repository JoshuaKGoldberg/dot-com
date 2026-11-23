// _wc/aurora2d.js: the light-mode watercolor aurora backdrop for the hero portrait (kit.aurora's curtains, repainted in the four pigments).
// Everything is baked once at setup (async, in chunks); per frame it is only drawImage calls.
import { smooth, rng } from "../_hp/hp.js";
import { PIG } from "./shader.js";

const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const tick = () => new Promise((r) => setTimeout(r, 0));
export const PALS = {
	plain: [PIG.jade, PIG.cornflower, PIG.wisteria, PIG.rose],
	duet: [PIG.jade, PIG.jade, PIG.rose, PIG.rose],
	cool: [PIG.jade, PIG.cornflower, PIG.wisteria, PIG.wisteria],
};
export const palFor = (mode) => PALS[mode] || PALS.plain;
export const pigmentWheel = (mode) => { const p = palFor(mode); return Array.from({ length: 360 }, (_, h) => { const x = (h / 360) * (p.length), i = Math.floor(x) % p.length, f = x - Math.floor(x), q = p[(i + 1) % p.length], c = p[i], s = f * f * (3 - 2 * f); return [0, 1, 2].map((k) => c[k] + (q[k] - c[k]) * s); }); };

// grain tile (cold-press paper tooth), 128x128 values 0..1
const grainTile = (() => { let t = null; return () => t || (t = (() => { const N = 128, r = rng(5), a = new Float32Array(N * N); for (let i = 0; i < N * N; i++) a[i] = 0.55 * r() + 0.45 * ((r() + r() + r()) / 3); return a; })()); })();

export async function bakeCurtains(E, { mode, sat0 = 0.55, blur = 4 }) {
	const D = E.D, W = Math.round(D * 1.8), pal = palFor(mode), N = E.noise, u = E.u, rr = rng(77);
	const lum = (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
	const out = [];
	for (let k = 0; k < 3; k++) {
		const c = E.mk(W, D), x = c.getContext("2d"), seed = k * 2.3 + 1;
		for (let px = 0; px < W; px += 2) {
			const uu = px / W, top = D * (0.1 + 0.22 * (0.5 + 0.5 * Math.sin(uu * 7 + seed)) + 0.07 * Math.sin(uu * 19 + seed * 2) + k * 0.1);
			const len = D * (0.32 + 0.22 * (0.5 + 0.5 * Math.sin(uu * 5 + seed * 1.7)));
			let ci = ((uu * 1.4 + k * 0.33) % 1) * (pal.length - 1);
			if (mode === "wet") ci = (((uu * 1.4 + k * 0.33 + 0.35 * (N(uu * 6 + k * 4, 9.1) - 0.5)) % 1) + 1) % 1 * (pal.length - 1);
			const i0 = Math.min(pal.length - 2, ci | 0), f = ci - i0, col = [0, 1, 2].map((q) => pal[i0][q] + (pal[i0 + 1][q] - pal[i0][q]) * f);
			const ray = 1 - 0.35 + 0.35 * N(uu * 90 + k * 5, 3.3);
			const gr = x.createLinearGradient(0, top, 0, top + len);
			gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(0.22, rgba(col, 0.95 * ray)); gr.addColorStop(0.5, rgba(col, 0.45 * ray)); gr.addColorStop(1, rgba(col, 0));
			x.fillStyle = gr; x.fillRect(px, top, 2.3, len);
		}
		const o = E.mk(W, D), og = o.getContext("2d"); og.filter = `blur(${blur * u}px)`; og.drawImage(c, 0, 0); og.filter = "none";
		const pix = mode === "pooled" || mode === "paper" || mode === "granulate" || mode === "bloom";
		const desat = E.mk(W, D), dg = desat.getContext("2d");
		if (pix) {
			await tick();
			const id = og.getImageData(0, 0, W, D), d = id.data, gt = grainTile(), gs = Math.max(1, Math.round(u * 0.9));
			const d2 = new Uint8ClampedArray(d.length);
			for (let j = 0, p = 0; j < D; j++) for (let i = 0; i < W; i++, p += 4) {
				let a = d[p + 3] / 255; if (a < 0.004) continue;
				let r = d[p], g = d[p + 1], b = d[p + 2];
				if (mode === "pooled") { const rim = Math.exp(-(((a - 0.42) / 0.2) ** 2)); a = Math.min(0.95, a * 0.7 + rim * 0.2); const q = 1 - 0.22 * rim; r *= q; g *= q; b *= q; }
				else if (mode === "paper") { const gv = gt[((j / gs) & 127) * 128 + ((i / gs) & 127)]; a = Math.min(0.97, a * (0.6 + 0.8 * gv)); const q = 0.93 + 0.1 * gv; r *= q; g *= q; b *= q; }
				else if (mode === "granulate") { const h = gt[(((j * 7) / gs) & 127) * 128 + (((i * 11) / gs) & 127)], h2 = gt[((j / gs / 3) & 127) * 128 + ((i / gs / 3) & 127)]; const dot = smooth(0.8, 0.95, h) * (0.4 + 0.6 * h2), pit = smooth(0.2, 0.05, h); a = Math.min(0.95, a * (1 - 0.5 * pit) + dot * 0.12 * Math.min(1, a * 4)); const q = 1 - 0.22 * dot; r *= q; g *= q; b *= q; }
				else if (mode === "bloom") { const n = N(i / (46 * u), j / (34 * u)) * 0.6 + N(i / (20 * u) + 4, j / (15 * u)) * 0.4, ez = Math.exp(-(((a - 0.4) / 0.28) ** 2)), bl = smooth(0.72, 0.78, n) * ez, rim = Math.exp(-(((n - 0.72) / 0.04) ** 2)) * ez; a = Math.min(0.95, a * (1 - 0.5 * bl) + rim * 0.07); const q = 1 - 0.2 * rim; r *= q; g *= q; b *= q; }
				d[p] = r; d[p + 1] = g; d[p + 2] = b; d[p + 3] = a * 255;
				const y = 0.3 * r + 0.59 * g + 0.11 * b, s = sat0;
				d2[p] = y + (r - y) * s; d2[p + 1] = y + (g - y) * s; d2[p + 2] = y + (b - y) * s; d2[p + 3] = a * 255;
			}
			og.putImageData(id, 0, 0); dg.putImageData(new ImageData(d2, W, D), 0, 0);
		} else {
			// desaturated twin: same shape, colours pulled toward their luminance
			dg.drawImage(o, 0, 0); const id = dg.getImageData(0, 0, W, D), d = id.data;
			for (let p = 0; p < d.length; p += 4) { const y = 0.3 * d[p] + 0.59 * d[p + 1] + 0.11 * d[p + 2]; d[p] = y + (d[p] - y) * sat0; d[p + 1] = y + (d[p + 1] - y) * sat0; d[p + 2] = y + (d[p + 2] - y) * sat0; }
			dg.putImageData(id, 0, 0);
		}
		out.push({ full: o, desat });
	}
	void lum; void rr;
	return { W, D, cs: out };
}

// the layer: same drift and crossfade as _hp/ac.js auroraSat, light branch only
export function wcAuroraLayer({ mode, sat0 = 0.55, rest = 0.42, hover = 1, depth = -1.2, blur = 4, alpha = 0.62 }) {
	return async (E, { par }) => {
		const B = await bakeCurtains(E, { mode, sat0, blur }), { W, D } = B;
		const sky = (g, k) => {
			const gr = g.createLinearGradient(0, E.o, 0, E.o + E.D), s = (c) => { const y = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2], q = sat0 + (1 - sat0) * k; return c.map((v) => (y + (v - y) * q) | 0); };
			const st = [[236, 243, 240], [240, 239, 247], [250, 238, 238]];
			gr.addColorStop(0, `rgb(${s(st[0])})`); gr.addColorStop(0.6, `rgb(${s(st[1])})`); gr.addColorStop(1, `rgb(${s(st[2])})`); g.fillStyle = gr; g.fillRect(E.o, E.o, E.D, E.D);
		};
		const hist = []; // pulled pigment: ghosts of the curtains at where the cursor was a few seconds ago
		const draw = (g, ph, al, which, ox = 0) => {
			g.save(); g.globalCompositeOperation = mode === "glaze" ? "multiply" : "source-over";
			B.cs.forEach((c, k) => {
				const sp = 0.23 + k * 0.11, dx = -(W - D) * (0.5 + 0.5 * Math.sin(ph * sp + k * 2.1)), dy = Math.sin(ph * 0.37 + k * 1.7) * D * 0.04;
				g.globalAlpha = al * alpha * (0.8 + 0.2 * Math.sin(ph * 0.6 + k)); g.drawImage(c[which], E.o + dx + ox, E.o + dy);
			});
			g.restore();
		};
		return {
			back(g, S) {
				g.save(); E.circle(g, 128); g.clip();
				const pq = par * S.pf; g.translate(E.c + S.px * depth * 6 * E.u * pq, E.c + S.py * depth * 4 * E.u * pq); g.translate(-E.c, -E.c);
				sky(g, S.satw); const al = rest + (hover - rest) * (S.rm ?? S.c), ph = 3 + (S.bp ?? S.c) * 1.15;
				if (mode === "pull") {
					hist.push([S.t, S.px]); while (hist.length > 1 && S.t - hist[0][0] > 6) hist.shift();
					for (const [lag, a] of [[3.2, 0.14], [1.9, 0.2], [0.9, 0.28]]) { const h = hist.find((q) => S.t - q[0] <= lag) || hist[0]; const ox = (h[1] - S.px) * 70 * E.u * (S.rm ?? 0); if (Math.abs(ox) > 1) { draw(g, ph, al * a * (1 - S.satw), "desat", ox); draw(g, ph, al * a * S.satw, "full", ox); } }
					S.anim = hist.length > 1 && S.hov;
				}
				draw(g, ph, al * (1 - S.satw), "desat"); draw(g, ph, al * S.satw, "full");
				g.restore();
				// the ring, tinted wisteria-grey
				g.save(); g.strokeStyle = `rgba(160,130,190,${0.12 + 0.18 * S.satw})`; g.lineWidth = E.u; E.circle(g, 127.5); g.stroke(); g.restore();
			},
		};
	};
}
