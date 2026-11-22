// _hp/layers.js: composable portrait layers for the #503-512 mixes. A mix is a thin config: mix({ layers: [aurora(..), halo(..), squiggles(..)], par, speed }).
//  - one overflow canvas, one palette (kit PAL + the #479 squiggle hues) and one motion clock S.c that only advances while hovered.
//  - every layer returns { back(g,S)?, front(g,S)? }: back layers draw before Josh, front layers after him. `depth` shifts a layer with the cursor (parallax).
import { aurora, skyGradient, ring, rgba, fieldRim, palLut, faded } from "./kit.js";
import { PAL, lut, rng, smooth, clamp } from "./kit.js";
import { hsl as hslC } from "./hp.js";
import { contour, squig, palette } from "./fx-squiggle.js";

const TAU = Math.PI * 2;
const dpx = (E, S, depth, par) => [S.px * depth * 6 * E.u * par, S.py * depth * 4 * E.u * par];

export function mix({ pad = 56, fps = 30, par = 1, speed = 1, dwell = null, backdrop = null, layers }) {
	// `backdrop` switches the mix to "ramped" mode (#518): the ONLY immediate response to hover is the cutout's parallax tilt (at 50% strength, growing to 100% over
	// backdrop.parUp s). Everything else (glow, hue drift, backdrop saturation and motion, delighters) waits `delay` s with zero change, then eases in along a slow smoothstep
	// (S.rm), and eases back out just as slowly after leave. Motion speeds are integrated into phases, so nothing jumps.
	const ease = (v) => v * v * (3 - 2 * v), cl = (v) => Math.min(1, Math.max(0, v));
	return {
		pad, assets: ["bg", "body"], field: true, fps, t0: 0,
		async setup(E) {
			const Ls = layers.map((f) => f(E, { par })), st = { last: null, c: 0, dw: 0, sw: 0, br: 0, th: 0, sp: 0, pr: 0, bp: 0, S: { c: 0, h: 0, px: 0, py: 0, cx: 0, cy: 0, cm: 0, ax: 1, ay: 0, dx: 1, dy: 0, par, dw: 0, satw: 1, pf: 1, E } };
			return (g, t, h, p) => {
				const S = st.S, dt = st.last == null ? 0 : t - st.last; st.last = t;
				S.h = h; S.t = t; S.dt = dt; S.hov = !!E.state.ht && !E.state.still; S.cx = p.sx; S.cy = p.sy;
				let busy = false, m = 1;
				const rampedMode = !!backdrop;
				if (E.state.still) { st.dw = st.sw = st.br = st.th = st.sp = st.pr = 0; }
				else if (rampedMode) {
					if (S.hov) st.th += dt; else if (st.br < 0.001 && st.dw < 0.001) st.th = 0;
					const go = S.hov && (st.th > backdrop.delay || st.br > 0.001 || st.dw > 0.001), mv = (v, up, down) => cl(v + (go ? dt / up : -dt / down));
					st.br = mv(st.br, backdrop.up, backdrop.down);
					if (dwell) { st.dw = mv(st.dw, dwell.up, dwell.down || dwell.up); if (dwell.speedRamp) st.sp = mv(st.sp, dwell.speedRamp.up, dwell.speedRamp.up); }
					st.pr = cl(st.pr + (S.hov ? dt / backdrop.parUp : -dt / backdrop.parUp));
				} else {
					if (dwell?.speedRamp) st.sp = cl(st.sp + (S.hov ? dt / dwell.speedRamp.up : -dt / dwell.speedRamp.up));
					if (dwell) { st.dw = cl(st.dw + (S.hov ? dt / dwell.up : -dt / (dwell.down || dwell.up))); st.sw = cl(st.sw + (S.hov ? (dt * (dwell.speedRamp ? dwell.speedRamp.from + (dwell.speedRamp.to - dwell.speedRamp.from) * ease(st.sp) : 1)) / 3 : -(dt * (dwell.speedRamp ? dwell.speedRamp.from + (dwell.speedRamp.to - dwell.speedRamp.from) * ease(st.sp) : 1)) / 3)); }
				}
				if (dwell?.speedRamp) { const q = dwell.speedRamp; m = q.from + (q.to - q.from) * ease(st.sp); busy = st.sp > 0.002; }
				if (dwell) { S.dw = ease(st.dw); busy = busy || st.dw > 0.002; if (!rampedMode) { S.satw = ease(st.sw); busy = busy || st.sw > 0.002; } }
				if (rampedMode) {
					S.rm = ease(st.br); S.satw = S.rm; S.pf = 0.5 + 0.5 * ease(st.pr);
					st.c += dt * speed * m * S.rm; st.bp += dt * backdrop.cap * S.rm; S.bp = st.bp; busy = busy || st.br > 0.002 || st.pr > 0.002;
				} else st.c += dt * h * speed * m;
				S.c = st.c; S.m = m;
				S.px = (p.sx / 128) * h; S.py = (p.sy / 128) * h; S.cm = Math.min(1, Math.hypot(p.sx, p.sy) / 110) * (S.rm ?? h);
				// split direction: a slow drift at rest (the aurora's), the cursor direction while hovered
				const a = -0.5 + S.c * 0.3, l = Math.hypot(p.sx, p.sy) || 1, w = (S.rm ?? h) * 0.85;
				const dx = Math.cos(a) * (1 - w) + (p.sx / l) * w, dy = Math.sin(a) * (1 - w) + (p.sy / l) * w, dl = Math.hypot(dx, dy) || 1; S.dx = dx / dl; S.dy = dy / dl; S.ax = Math.cos(a); S.ay = Math.sin(a);
				for (const L of Ls) L.back?.(g, S);
				g.save(); E.dome(g, 128, 200); g.clip();
				const pp = par * S.pf, [bx, by] = dpx(E, S, 0.8, pp);
				g.translate(E.c + bx, E.c + by - 4 * h * E.u * pp); g.rotate(S.px * 0.025 * pp); g.scale(1 + 0.05 * h * pp, 1 + 0.05 * h * pp); g.translate(-E.c, -E.c);
				E.drawImg(g, E.img.body); g.restore();
				for (const L of Ls) L.front?.(g, S);
				return busy || S.anim;
			};
		},
	};
}

// aurora backdrop inside the circle, the deepest layer (scaled up and shifted against the cursor)
export const auroraL = ({ rest = 0.5, hover = 1, depth = -1.2, grow = 0.1, rim = true } = {}) => (E, { par }) => {
	const au = aurora(E);
	return {
		back(g, S) {
			g.save(); E.circle(g, 128); g.clip();
			const [dx, dy] = dpx(E, S, depth, par), sc = 1 + grow * S.h * par;
			g.translate(E.c + dx, E.c + dy); g.scale(sc, sc); g.translate(-E.c, -E.c);
			skyGradient(E, g, "navy"); au.draw(g, 3 + S.c * 1.15, rest + (hover - rest) * S.h);
			g.restore(); if (rim) ring(E, g, 0.18 + 0.25 * S.h);
		},
	};
};

// the photo's own background (Josh painted out) as a parallax layer, or faded into the page
export const photoL = ({ depth = -1, fade = false, alpha = 0.8 } = {}) => (E, { par }) => {
	const f = fade ? faded(E, 0.3, 0.97) : null, src = E.bgFull();
	return {
		back(g, S) {
			g.save(); E.circle(g, 128); g.clip();
			const [dx, dy] = dpx(E, S, depth, par), sc = 1 + 0.1 * S.h * par;
			g.translate(E.c + dx, E.c + dy); g.scale(sc, sc); g.translate(-E.c, -E.c);
			g.globalAlpha = E.dark ? alpha : Math.min(1, alpha + 0.15); g.drawImage(f || src, E.o, E.o, E.D, E.D); g.restore();
			if (!fade) ring(E, g, 0.18 + 0.25 * S.h);
		},
	};
};

// #496's chromatic halo: three offset distance-field halos, one per channel
export const haloL = ({ amp = 0.7, hue = false, rgb = false, raw = false, wheel = null, depth = 0 } = {}) => (E, { par }) => {
	const WH = typeof wheel === "function" ? wheel(E) : null, ANG = E.fld.ang;
	const f = E.fld, n = f.n, F = f.F, M = f.m, dk = E.dark, gl = E.glow.half(), gn = gl.gn, L = palLut(E);
	const at = (k, sx, sy) => { const ii = (k % n) + sx, jj = ((k / n) | 0) + sy; return ii < 0 || jj < 0 || ii >= n || jj >= n ? 90 : F[jj * n + ii]; };
	const base = dk ? [[255, 70, 110], [70, 255, 140], [90, 140, 255]] : [[235, 70, 175], [110, 100, 235], [20, 185, 225]];
	return {
		back(g, S) {
			const hh0 = S.rm ?? S.h, sp = 2.5 + 5.5 * hh0 * (0.5 + 0.5 * S.cm), sx = Math.round(S.dx * sp), sy = Math.round(S.dy * sp), w = 8 + 4 * hh0, A = typeof amp === "function" ? amp(S) * (raw ? 1 : 0.7 + 0.5 * S.h) : amp * (0.7 + 0.5 * S.h);
			const HIST = window.__hpHist || null;
			let cs = base; if (rgb) { const sa = dk ? 78 : 85, lt = dk ? 64 : 44, dr = S.c * 24; cs = [0, 120, 228].map((hh) => hslC((hh + dr) % 360, sa, lt)); } else if (hue) cs = [0, 1, 2].map((q) => { const k = ((((S.c * 0.05 + 0.1 + q * 0.3) % 1) + 1) % 1 * 255 | 0) * 3; return [L[k], L[k + 1], L[k + 2]]; });
			gl.clear(); const d8 = gl.data;
			for (let j = 0; j < gn; j++) for (let i = 0; i < gn; i++) {
				const k = j * 2 * n + i * 2; if (F[k] > 94 || F[k] < -14) continue;
				const dr = at(k, sx, sy), dg = F[k], db = at(k, -sx, -sy);
				const m = M[k], r = (Math.exp(-Math.max(0, dr) / w) * A + Math.exp(-Math.max(0, dr) / 26) * 0.16 * A) * m, gg = (Math.exp(-Math.max(0, dg) / w) * A + Math.exp(-Math.max(0, dg) / 26) * 0.16 * A) * m, b = (Math.exp(-Math.max(0, db) / w) * A + Math.exp(-Math.max(0, db) / 26) * 0.16 * A) * m;
				const mx = Math.max(r, gg, b); if (mx < 0.015) continue;
				const o = (j * gn + i) * 4;
				if (WH) { const aa = ANG[k] < 0.2 ? ANG[k] + 1 : ANG[k], hh = ((((clamp((aa - 0.42) / 0.62) * 330 + S.c * 36 + (40 * (b - r)) / mx) % 360) + 360) % 360) | 0, c = WH[hh]; if (HIST && mx > 0.05) HIST[hh]++; d8[o] = c[0]; d8[o + 1] = c[1]; d8[o + 2] = c[2]; d8[o + 3] = Math.min(1, mx) * (dk ? 255 : 200); continue; }
				if (dk) { const e0 = r * cs[0][0] + gg * cs[1][0] + b * cs[2][0], e1 = r * cs[0][1] + gg * cs[1][1] + b * cs[2][1], e2 = r * cs[0][2] + gg * cs[1][2] + b * cs[2][2], em = Math.max(e0, e1, e2, 1e-3); d8[o] = Math.min(255, (e0 / em) * 255); d8[o + 1] = Math.min(255, (e1 / em) * 255); d8[o + 2] = Math.min(255, (e2 / em) * 255); d8[o + 3] = Math.min(1, mx) * 255; }
				else { const sm = r + gg + b; d8[o] = (cs[0][0] * r + cs[1][0] * gg + cs[2][0] * b) / sm; d8[o + 1] = (cs[0][1] * r + cs[1][1] * gg + cs[2][1] * b) / sm; d8[o + 2] = (cs[0][2] * r + cs[1][2] * gg + cs[2][2] * b) / sm; d8[o + 3] = Math.min(1, mx) * 170; }
			}
			const [dx, dy] = dpx(E, S, depth, par); g.save(); g.translate(dx, dy); gl.flush(g, dk ? "lighter" : "source-over"); g.restore();
		},
	};
};

// squiggle rings (#500/#501): items { L, lam, A, v, a, lw, depth, off, ch }. split:true draws each as three channel-coloured copies (#496 split);
// ch:0|1|2 draws the item in a single channel colour (rings that are each a channel). tint:'aurora' samples the aurora's own colours.
export const squiggleL = ({ items, rest = 0.35, split = false, tint = null, spread = null, front = 1 } = {}) => (E, { par }) => {
	const dk = E.dark, ps = palette(E), ap = (() => { const l = palLut(E), out = []; for (let i = 0; i < 48; i++) { const k = ((i / 47) * 255 | 0) * 3; out.push(`rgb(${l[k] | 0},${l[k + 1] | 0},${l[k + 2] | 0})`); } return out; })();
	const pal = tint === "aurora" ? ap : ps, chan = dk ? ["rgb(255,70,110)", "rgb(70,255,150)", "rgb(90,140,255)"] : ["rgb(235,70,175)", "rgb(20,185,225)", "rgb(120,90,235)"];
	const rings = items.map((it, i) => ({ ...it, C: contour(E, it.L), i }));
	const one = (g, S, r) => {
		const A = r.A * (rest + (1 - rest) * S.h), ph = (r.ph0 || r.i * 2) + TAU * r.v * S.c, [dx, dy] = dpx(E, S, r.depth || 0, S.par);
		const o = { A, lam: r.lam, ph, lw: r.lw, alpha: (r.a ?? 1) * (0.7 + 0.3 * S.h), shift: (r.i * 0.25) + S.c * 0.05, dx, dy, off: r.off || 0 };
		if (r.ch != null || split) {
			const sp = (spread != null ? spread(S, r) : 1.5 + 3.5 * S.h * (0.4 + 0.6 * S.cm)), chs = r.ch != null ? [r.ch] : [0, 1, 2];
			g.save(); g.globalCompositeOperation = dk ? "lighter" : "source-over";
			for (const c of chs) { const q = r.ch != null ? 0 : c - 1; squig(g, E, r.C, pal, { ...o, color: chan[c], dx: dx + S.dx * sp * q * E.u, dy: dy + S.dy * sp * q * E.u, off: o.off + (r.ch != null ? (r.chOff?.(S, c) ?? 0) : 0), alpha: o.alpha * (dk ? 0.62 : 0.8) }); }
			g.restore();
		} else squig(g, E, r.C, pal, o);
	};
	return {
		back(g, S) { for (const r of rings) if ((r.depth || 0) < 0.5) one(g, S, r); },
		front(g, S) { for (const r of rings) if ((r.depth || 0) >= 0.5) one(g, S, r); },
	};
};

// #502's crawling squiggle segments, each on a depth layer
export const arcsL = ({ L = 8, depths = [-1, -0.3, 0.8, 1.6], count = 3, more = 6, lam = [28, 36] } = {}) => (E, { par }) => {
	const C = contour(E, L), ps = palette(E), ds = C.ds; let arcs = [], last = 0;
	const mk = (t0, cur, R = Math.random) => { let i = (R() * C.N) | 0; if (cur) { let bd = 1e9; for (let q = 0; q < 6; q++) { const c = (R() * C.N) | 0, d = Math.hypot(C.x[c] - cur.x, C.y[c] - cur.y); if (d < bd) { bd = d; i = c; } } } return { s0: i * ds, len: 38 + R() * 46, v: (R() < 0.5 ? -1 : 1) * (14 + R() * 22), t0, life: 0.9 + R() * 1.2, ph0: R() * TAU, lam: lam[0] + R() * (lam[1] - lam[0]), depth: depths[(R() * depths.length) | 0] }; };
	const r0 = rng(31), rest = [0, 1, 2].map(() => mk(0, null, r0));
	const one = (g, S, a, k, al, tt, A) => {
		const s = a.s0 + a.v * (tt - a.t0), i0 = Math.round(s / ds), i1 = i0 + Math.round(a.len / ds); if (i0 < 0 || i1 >= C.N) return;
		const [dx, dy] = dpx(E, S, a.depth, par), env = Math.sin(Math.PI * clamp(k)) ** 0.7;
		squig(g, E, C, ps, { i0, i1, A, lam: a.lam, ph: a.ph0 - TAU * 0.9 * S.c, lw: 3, alpha: al * env, taper: true, caps: true, shift: a.ph0 * 0.1 + S.c * 0.05, dx, dy });
	};
	const draw = (g, S, front) => {
		const t = S.c, sel = (a) => (a.depth >= 0.5) === front;
		if (S.h < 0.99) for (const a of rest) if (sel(a)) one(g, S, a, 0.5, 0.85 * (1 - S.h), 0, 1.3);
		if (S.h > 0.01) { for (const a of arcs) if (sel(a)) one(g, S, a, (t - a.t0) / a.life, smooth(0, 0.3, S.h), t, 2.1 + 1.1 * S.h); }
	};
	return {
		back(g, S) {
			// the pool advances once per frame, in the back pass (shared clock S.c)
			if (S.h > 0.01) { arcs = arcs.filter((a) => S.c < a.t0 + a.life); const want = Math.round(count + more * S.h); while (arcs.length < want) arcs.push(mk(S.c - Math.random() * 0.2, S.h > 0.4 && Math.random() < 0.7 ? { x: S.px * 128, y: S.py * 128 } : null)); }
			draw(g, S, false);
		},
		front(g, S) { draw(g, S, true); },
	};
};
