// _wc/portrait.js: #518's portrait spec (backdrop, glow, constellation), with
//  - a watercolor light-mode backdrop and glow (aurora2d.js)
//  - the "spatial scene" cutout (spatial.js): per-pixel depth parallax, overlap past the circle, a soft photo background plane; strength grows with the theme level
//  - eyes that follow the pointer (very slow and subtle at level 0, clearly following at level 9)
// The mix() below is _hp/layers.js's mix with the cutout draw swapped for the spatial pass; everything else (dwell, ramp, timing) is the same code.
import { haloL } from "../_hp/layers.js";
import { auroraSat, constellationL, depthRgb } from "../_hp/ac.js";
import { smooth } from "../_hp/hp.js";
import { wcAuroraLayer, pigmentWheel } from "./aurora2d.js";
import { loadSpatial, makeSpatial } from "./spatial.js";

const ease = (v) => v * v * (3 - 2 * v), cl = (v) => Math.min(1, Math.max(0, v));
const dpx = (E, S, depth, par) => [S.px * depth * 6 * E.u * par, S.py * depth * 4 * E.u * par];

// level 0..9 -> strengths
export const levelOf = (n) => {
	const t = n / 9;
	return {
		t,
		par: 2.5 + 15.5 * Math.pow(t, 1.15),        // max subject depth displacement, px at 256 display
		zoom: 0.05 + 0.04 * t,                      // zoom-settle with hover
		lift: 1 + 0.015 * t,                         // static lift (paused / reduced / rest)
		rot: 0.025,                       // slight perspective rotation
		bgDepth: -1.2 - 3.2 * t,                     // backdrop parallax (against the subject)
		bgBlur: 0.5 + 5.5 * t,                       // photo background plane blur (css px at 256)
		bgAlpha: 0.04 + 0.30 * t,
		bgScale: 1 + 0.12 * t,
		bleed: t,                                    // how far the subject breaks out of the circle
		eyeMax: 0.6 + 3.0 * t,                       // iris travel, px at 256
		eyeTau: 3 * Math.pow(0.2, t),                // seconds
		saccade: t > 0.5,
	};
};

// the photo background plane (filled), blurred once at bake time, drawn soft-light under the cutout
const bgPlane = (lv) => async (E) => {
	const a = new Image(); a.decoding = "async";
	const im = await new Promise((r) => { a.onload = () => r(a); a.onerror = () => r(null); a.src = new URL("../../assets/headshot-bg-filled-512.webp", import.meta.url).href; });
	if (!im) return {};
	const c = E.mk(E.D), g = c.getContext("2d"); g.filter = `blur(${lv.bgBlur * E.u}px)`; g.drawImage(im, -E.D * 0.05, -E.D * 0.05, E.D * 1.1, E.D * 1.1); g.filter = "none";
	return {
		back(g2, S) {
			if (S.satw < 0 || lv.bgAlpha < 0.01) return;
			g2.save(); E.circle(g2, 128); g2.clip();
			const [dx, dy] = dpx(E, S, lv.bgDepth * 0.7, S.par * S.pf), sc = lv.bgScale + 0.03 * S.h;
			g2.translate(E.c + dx, E.c + dy); g2.scale(sc, sc); g2.translate(-E.c, -E.c);
			g2.globalCompositeOperation = "soft-light"; g2.globalAlpha = lv.bgAlpha * (0.6 + 0.4 * (S.rm ?? 0)); g2.drawImage(c, E.o, E.o);
			g2.restore();
		},
	};
};

export function wcMix({ pad = 56, fps = 30, par = 1, speed = 1, dwell = null, backdrop = null, layers, level = 0, eyes = true, tilt = null, eyeCfg = null }) {
	const lv = levelOf(level);
	if (eyeCfg) Object.assign(lv, { eyeMax: eyeCfg.max, eyeTau: eyeCfg.tau, saccade: !!eyeCfg.saccade });
	const gain = eyeCfg?.gain ?? 3;
	return {
		pad, assets: ["bg", "body"], field: true, fps, t0: 0,
		async setup(E) {
			const [Ls, A_] = await Promise.all([Promise.all([...layers.map((f) => f(E, { par })), bgPlane(lv)(E)]), loadSpatial()]);
			const sp = A_.ok ? makeSpatial(E, A_) : null;
			const st = { last: null, c: 0, dw: 0, sw: 0, br: 0, th: 0, sp: 0, pr: 0, bp: 0, S: { c: 0, h: 0, px: 0, py: 0, cx: 0, cy: 0, cm: 0, ax: 1, ay: 0, dx: 1, dy: 0, par, dw: 0, satw: 1, pf: 1, E } };
			// eyes: face centre and clamp from the baked json (512 px asset coordinates -> 256 display)
			const J = A_.json, ey = { x: [0, 0], y: [0, 0], vx: [0, 0], vy: [0, 0], sacc: [0, 0], nextSacc: 2, on: false };
			let faceC = [0, -10], halfW = 6;
			if (J?.eyes?.length) { const xs = J.eyes.flatMap((e) => e.opening.map((p) => p[0])), ys = J.eyes.flatMap((e) => e.opening.map((p) => p[1])); faceC = [((Math.min(...xs) + Math.max(...xs)) / 2 - 256) / 2, ((Math.min(...ys) + Math.max(...ys)) / 2 - 256) / 2]; const e0 = J.eyes[0].opening.map((p) => p[0]); halfW = (Math.max(...e0) - Math.min(...e0)) / 4; }
			const eyeMax = Math.min(lv.eyeMax, (eyeCfg ? 0.4 : 0.45) * halfW);
			return (g, t, h, p) => {
				const S = st.S, dt = st.last == null ? 0 : t - st.last; st.last = t;
				S.h = h; S.t = t; S.dt = dt; S.hov = !!E.state.ht && !E.state.still; S.cx = p.sx; S.cy = p.sy;
				let busy = false, m = 1;
				if (E.state.still) { st.dw = st.sw = st.br = st.th = st.sp = st.pr = 0; }
				else {
					if (S.hov) st.th += dt; else if (st.br < 0.001 && st.dw < 0.001) st.th = 0;
					const go = S.hov && (st.th > backdrop.delay || st.br > 0.001 || st.dw > 0.001), mv = (v, up, down) => cl(v + (go ? dt / up : -dt / down));
					st.br = mv(st.br, backdrop.up, backdrop.down);
					if (dwell) { st.dw = mv(st.dw, dwell.up, dwell.down || dwell.up); if (dwell.speedRamp) st.sp = mv(st.sp, dwell.speedRamp.up, dwell.speedRamp.up); }
					st.pr = cl(st.pr + (S.hov ? dt / backdrop.parUp : -dt / backdrop.parUp));
				}
				if (dwell?.speedRamp) { const q = dwell.speedRamp; m = q.from + (q.to - q.from) * ease(st.sp); busy = st.sp > 0.002; }
				if (dwell) { S.dw = ease(st.dw); busy = busy || st.dw > 0.002; }
				S.rm = ease(st.br); S.satw = S.rm; S.pf = 0.5 + 0.5 * ease(st.pr);
				st.c += dt * speed * m * S.rm; st.bp += dt * backdrop.cap * S.rm; S.bp = st.bp; busy = busy || st.br > 0.002 || st.pr > 0.002;
				S.c = st.c; S.m = m;
				S.px = Math.max(-1.3, Math.min(1.3, p.sx / 128)) * h; S.py = Math.max(-1.3, Math.min(1.3, p.sy / 128)) * h; S.cm = Math.min(1, Math.hypot(p.sx, p.sy) / 110) * S.rm;
				const a = -0.5 + S.c * 0.3, l = Math.hypot(p.sx, p.sy) || 1, w = S.rm * 0.85;
				const dx = Math.cos(a) * (1 - w) + (p.sx / l) * w, dy = Math.sin(a) * (1 - w) + (p.sy / l) * w, dl = Math.hypot(dx, dy) || 1; S.dx = dx / dl; S.dy = dy / dl; S.ax = Math.cos(a); S.ay = Math.sin(a);
				for (const L of Ls) L.back?.(g, S);
				// the cutout
				const pp = par * S.pf;
				if (sp) {
					// eyes: a long-time-constant two-stage follow of the pointer, gated by the delayed ramp
					let eyeOn = 0, oL = [0, 0], oR = [0, 0];
					if (eyes && sp.eyes) {
						const gate = S.hov ? (eyeCfg?.immediate ? 1 : eyeCfg ? Math.min(1, S.rm * gain) : (1 - lv.t) * S.rm + lv.t * Math.min(1, S.rm * 3)) : 0;
						let tx = 0, ty = 0;
						if (gate > 0) {
							const rx = p.sx - faceC[0], ry = p.sy - faceC[1], rl = Math.hypot(rx, ry) || 1, k = Math.min(1, rl / 90);
							tx = (rx / rl) * k * eyeMax * gate; ty = (ry / rl) * k * eyeMax * 0.6 * gate;
							if (lv.saccade) { ey.nextSacc -= dt; if (ey.nextSacc < 0) { ey.nextSacc = 1.6 + Math.random() * 2.2; ey.sacc = [(Math.random() - 0.5) * 0.5 * eyeMax * gate, (Math.random() - 0.5) * 0.3 * eyeMax * gate]; setTimeout(() => { ey.sacc = [0, 0]; }, 260); } tx += ey.sacc[0]; ty += ey.sacc[1]; }
						}
						if (eyeCfg?.immediate) {
							// 3.5 s wait after entering (position and velocity held, nothing snaps), then a slow critically damped spring toward the target with its speed clamped to one
							// opening half-width per 3 s: gentle start, cruise at most at the cap, gentle stop. Leaving returns home with the same spring, no wait.
							ey.px ??= 0; ey.py ??= 0; ey.pvx ??= 0; ey.pvy ??= 0;
							ey.ht = S.hov ? (ey.ht || 0) + dt : 0;
							const waiting = S.hov && ey.ht < 3.5, W2 = 1.25, vmax = halfW / 3;
							const rawx = waiting ? ey.px : tx, rawy = waiting ? ey.py : ty;
							// the goal itself is low-passed (tau 1.2 s) before the spring sees it, so acceleration ramps up gently instead of stepping
							ey.gx ??= 0; ey.gy ??= 0; const fg = 1 - Math.exp(-dt / 1.2); ey.gx += (rawx - ey.gx) * fg; ey.gy += (rawy - ey.gy) * fg;
							const gx = ey.gx, gy = ey.gy;
							const n = Math.max(1, Math.ceil(dt / 0.016)), h2 = dt / n;
							for (let i = 0; i < n; i++) {
								ey.pvx += (W2 * W2 * (gx - ey.px) - 2 * W2 * ey.pvx) * h2; ey.pvy += (W2 * W2 * (gy - ey.py) - 2 * W2 * ey.pvy) * h2;
								const sp2 = Math.hypot(ey.pvx, ey.pvy); if (sp2 > vmax) { ey.pvx *= vmax / sp2; ey.pvy *= vmax / sp2; }
								ey.px += ey.pvx * h2; ey.py += ey.pvy * h2;
							}
							ey.x[0] = ey.px; ey.y[0] = ey.py; ey.vx[0] = ey.pvx; ey.vy[0] = ey.pvy;
						} else {
							const tau = S.hov ? lv.eyeTau : Math.max(2.5, lv.eyeTau * 1.6), f = 1 - Math.exp(-dt / tau);
							// critically damped feel: low-pass twice
							ey.vx[0] += (tx - ey.vx[0]) * f; ey.x[0] += (ey.vx[0] - ey.x[0]) * f; ey.vy[0] += (ty - ey.vy[0]) * f; ey.y[0] += (ey.vy[0] - ey.y[0]) * f;
						}
						const mag = Math.hypot(ey.x[0], ey.y[0]);
						if (!S.hov && mag < 0.004 && Math.hypot(ey.vx[0], ey.vy[0]) < 0.004) { ey.x[0] = ey.y[0] = ey.vx[0] = ey.vy[0] = 0; ey.px = ey.py = ey.pvx = ey.pvy = ey.gx = ey.gy = 0; }
						if (window.__wcEyeDbg) (window.__wcEyeLog ||= []).push([performance.now(), ey.x[0], ey.y[0], ey.vx[0], ey.vy[0], S.hov ? 1 : 0]);
						eyeOn = mag > 0 ? 1 : 0; busy = busy || mag > 0.004 || (S.hov && gate > 0);
						const conv = Math.max(0, 1 - Math.hypot(p.sx - faceC[0], p.sy - faceC[1]) / 70) * 0.25 * eyeMax * (gate > 0 ? 1 : 0) * Math.min(1, mag * 4);
						oL = [(ey.x[0] + conv) / 256, ey.y[0] / 256]; oR = [(ey.x[0] - conv) / 256, ey.y[0] / 256];
					}
					const amt = ((lv.par * 0.7) / 256 / 0.4) * (0.35 + 0.65 * h) * (0.5 + 0.5 * S.pf);
					if (tilt) {
						// #518's rigid cutout tilt (translate, rotate, scale about the centre), scaled by k, plus an optional slight perspective; the eyes are the only thing drawn differently
						sp.render({ eye: eyeOn, oL, oR });
						const k = tilt.k, [bx, by] = dpx(E, S, 0.8, pp);
						g.save(); E.dome(g, 128, 200); g.clip();
						g.translate(E.c + bx * k, E.c + by * k - 4 * h * E.u * pp * k); g.rotate(S.px * 0.025 * pp * k);
						const sc = 1 + 0.05 * h * pp * k; g.scale(sc, sc);
						if (tilt.pers) { const q = tilt.pers; g.transform(1 - 0.035 * q * Math.abs(S.px) * h, 0.03 * q * S.px * h * pp, -0.02 * q * S.px * h * pp, 1 - 0.015 * q * Math.abs(S.py), 0, 0); }
						g.translate(-E.c, -E.c); g.drawImage(sp.canvas, 0, 0, E.C, E.C); g.restore();
					} else {
						sp.render({ offx: -S.px * amt, offy: -S.py * amt * 0.75, d0: 0.6, zoom: lv.lift + lv.zoom * ease(Math.min(1, h)) * pp, rot: S.px * lv.rot * pp, ty: (4 / 256) * h * pp, eye: eyeOn, oL, oR });
						g.save(); E.dome(g, 128, 200 + 40 * lv.bleed); g.clip();
						g.drawImage(sp.canvas, 0, 0, E.C, E.C); g.restore();
					}
				} else {
					g.save(); E.dome(g, 128, 200); g.clip();
					const [bx, by] = dpx(E, S, 0.8, pp);
					g.translate(E.c + bx, E.c + by - 4 * h * E.u * pp); g.rotate(S.px * 0.025 * pp); g.scale(1 + 0.05 * h * pp, 1 + 0.05 * h * pp); g.translate(-E.c, -E.c);
					E.drawImg(g, E.img.body); g.restore();
				}
				for (const L of Ls) L.front?.(g, S);
				return busy || S.anim;
			};
		},
	};
}

// #518's layer stack. Dark keeps #518's own layers (aurora backdrop, halo wheel); light swaps in the watercolor ones.
export function wcStarfield(opts) {
	const lv = levelOf(opts.level ?? 0), mode = opts.mode;
	const wheel = (E) => (E.dark ? Array.from({ length: 360 }, (_, h) => depthRgb(true, h, 0.8)) : pigmentWheel(mode));
	const back = (E, c) => (E.dark ? auroraSat({ sat0: 0.35, rest: 0.42, still: true, depth: lv.bgDepth })(E, c) : wcAuroraLayer({ mode, depth: lv.bgDepth, blur: 4 + 3 * lv.t, ...(opts.aurora || {}) })(E, c));
	return wcMix({ pad: 56, par: 0.6, dwell: { up: 10, down: 10, speedRamp: { from: 0.22, to: 0.5, up: 12 } }, backdrop: { delay: 1, up: 10, down: 10, cap: 0.5, parUp: 8 }, level: opts.level ?? 0, eyes: opts.eyes !== false, tilt: opts.tilt || null, eyeCfg: opts.eyeCfg || null,
		layers: [back, haloL({ raw: true, amp: (S) => 0.5 * (0.05 + 0.95 * S.dw), wheel }), constellationL({ count: 170, reach: 0.6, size: 0.55, alpha: 0.8, seed: 23, gap: 8, link: 22, lw: 0.35, a0: 0.3, tint: true })] });
}
void smooth;
