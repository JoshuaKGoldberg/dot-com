import { createStage, canvasLayer, ridgeGeo, paintRidge, forestGeo, paintForest, makePineVariants, LiveTrees, Flock, Ripples, drawSheared, drawReflectionStrips, cloudSprite, glowSprite, makeStars, drawStars, isEmptyAt, addHint, addUI, isDark, watchDark, hex, mixC, rgba, clamp, lerp, smooth, rng, TAU } from "./forest-kit/kit.js";

const H = (s) => hex(s);
// Sky keyframes over the day (0 = midnight, .25 = sunrise, .5 = noon, .75 = sunset).
const KEYS = [
	[0.0, "#050a1c", "#0b1634", "#1a2750"],
	[0.2, "#0d1636", "#26305e", "#5a4e78"],
	[0.25, "#3c4f8a", "#c47f8f", "#ffb48a"],
	[0.31, "#6f9fd6", "#bcd5e6", "#ffe2b8"],
	[0.45, "#5f9ee0", "#a9d0ee", "#e4f1f6"],
	[0.55, "#4f94dc", "#9cc8ee", "#dcecf5"],
	[0.68, "#6a98d0", "#cdd7de", "#ffe3b0"],
	[0.75, "#35457f", "#cf7a7c", "#ffa65a"],
	[0.81, "#1b2650", "#6a4a78", "#d1708a"],
	[0.88, "#0a1230", "#1a2452", "#3a3a70"],
	[1.0, "#050a1c", "#0b1634", "#1a2750"],
].map(([t, a, b, c]) => [t, H(a), H(b), H(c)]);
function skyAt(T) {
	for (let i = 1; i < KEYS.length; i++) {
		if (T <= KEYS[i][0]) {
			const k0 = KEYS[i - 1], k1 = KEYS[i];
			const u = smooth((T - k0[0]) / (k1[0] - k0[0]));
			return { top: mixC(k0[1], k1[1], u), mid: mixC(k0[2], k1[2], u), hor: mixC(k0[3], k1[3], u) };
		}
	}
	return { top: KEYS[0][1], mid: KEYS[0][2], hor: KEYS[0][3] };
}
const DAY = {
	far: { top: "#86a1bd", bottom: "#c9d8e3", shade: "#5a7595", lit: "#eef3f6" },
	mid: { top: "#6f93a8", bottom: "#b4cbd1", shade: "#4a6d85", lit: "#e3ecee" },
	hills: { top: "#527f85", bottom: "#7fa7a5", shade: "#355a63", lit: null },
	midT: ["#5a8190", "#4f7688", "#648d99"], hillT: ["#3d6a66", "#33605e", "#477872"],
	shore: ["#31594f", "#2a4e48", "#3a665a"], land: ["#1d3a34", "#17302c"], fg: ["#173330", "#122a28", "#1b3b36"],
	water: "#6a98ae", wTop: "#8fb7c8", wBot: "#2f6482",
};
const NIGHT = {
	far: { top: "#2b3a68", bottom: "#41547e", shade: "#18234a", lit: "#5a6e99" },
	mid: { top: "#22305b", bottom: "#364a76", shade: "#131d40", lit: "#4a5d88" },
	hills: { top: "#192649", bottom: "#2a3c65", shade: "#0f1832", lit: null },
	midT: ["#1b2a52", "#17244a", "#20315a"], hillT: ["#131f40", "#101a38", "#17254a"],
	shore: ["#0d1630", "#0a1229", "#101a38"], land: ["#070d1e", "#050a17"], fg: ["#060b1b", "#040815", "#081022"],
	water: "#162645", wTop: "#2c4270", wBot: "#0b1630",
};
const deep = (v) => (typeof v === "string" ? H(v) : Array.isArray(v) ? v.map(deep) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deep(x)])) : v);
const D = deep(DAY), N = deep(NIGHT);
const mixAny = (a, b, t) => (Array.isArray(a) && typeof a[0] === "number" ? mixC(a, b, t) : Array.isArray(a) ? a.map((x, i) => mixAny(x, b[i], t)) : a && typeof a === "object" ? Object.fromEntries(Object.keys(a).map((k) => [k, mixAny(a[k], b[k], t)])) : a);
const WARM = [255, 160, 100];
const warmUp = (o, k) => (Array.isArray(o) && typeof o[0] === "number" ? mixC(o, WARM, k) : Array.isArray(o) ? o.map((x) => warmUp(x, k)) : o && typeof o === "object" ? Object.fromEntries(Object.entries(o).map(([key, v]) => [key, warmUp(v, k)])) : o);

const fmt = (T) => {
	const mins = Math.round(((T * 24) % 24) * 60) % 1440;
	const hh = Math.floor(mins / 60), mm = mins % 60;
	return `${hh % 12 || 12}:${String(mm).padStart(2, "0")} ${hh < 12 ? "am" : "pm"}`;
};

export function activate({ root, reducedMotion }) {
	let dark = isDark();
	const dayDefault = 0.42, nightDefault = 0.97;
	let T = dark ? nightDefault : dayDefault;
	let tween = null, auto = false, dragging = null, painted = -1;
	const hint = addHint(root, "Drag the sun (or moon) across the sky, or scrub the clock");
	const ui = addUI(root, `<span>Time</span><input type="range" min="0" max="1439" step="1" aria-label="Time of day" /><output></output><button type="button" aria-pressed="false" title="Let the day pass by itself">Auto</button>`, "dial");
	const slider = ui.querySelector("input"), out = ui.querySelector("output"), autoBtn = ui.querySelector("button");
	if (reducedMotion) autoBtn.hidden = true;
	const syncUI = () => { slider.value = Math.round(T * 1440) % 1440; out.textContent = fmt(T); };

	const variants = makePineVariants(92, 8);
	const trees = new LiveTrees(variants);
	const swallows = new Flock({ seed: 5, groups: 4, perGroup: [5, 9], size: [3.8, 6.4], band: [0.1, 0.46], speed: [46, 80], respawn: [0.8, 4], flap: [6, 9] });
	const geese = new Flock({ seed: 12, groups: 1, perGroup: [5, 6], size: [7, 8.5], band: [0.1, 0.22], speed: [34, 42], formation: "v", respawn: [12, 26], flap: [2.4, 3] });
	swallows.addResidents(5, [4.5, 6]);
	let L = null, stars = [], mist1, mist2, glow = null, moonGlow = null, flies = [];
	const MX = 60;
	const stage = createStage(root, { reducedMotion, build, draw, update });
	const unwatch = watchDark((d) => { dark = d; tween = { from: T, to: d ? nightDefault : dayDefault, t: 0 }; if (stage.reduced) { T = tween.to; tween = null; stage.invalidate(); syncUI(); } });
	syncUI();

	const sun = (T) => { const a = (T - 0.25) * TAU; const elev = Math.sin(a); return { a, elev }; };
	function state(T) {
		const { a, elev } = sun(T);
		const night = 1 - smooth(clamp((elev + 0.14) / 0.34));
		const warm = clamp(1 - Math.abs(elev - 0.04) * 3.6) * (1 - night * 0.3);
		return { a, elev, night, warm, sky: skyAt(T) };
	}

	function repaint(s) {
		const { w, h, dpr } = s;
		const st = state(T);
		L.st = st;
		const pal = mixAny(D, N, st.night);
		const wk = (k) => (st.warm > 0.02 ? (x) => warmUp(x, st.warm * k) : (x) => x);
		L.pal = { ...pal };
		const mk = (geo, rp, tp, forest, k) => {
			const lay = canvasLayer(w + MX * 2, h, dpr);
			paintRidge(lay.x, geo, { ...wk(k)(rp), depth: 70, light: st.a < Math.PI * 1.0 && st.elev >= 0 ? (st.a < Math.PI / 2 ? 1 : -1) : 1 });
			if (forest) paintForest(lay.x, forest, variants, wk(k)(tp));
			return lay;
		};
		L.far = mk(L.farGeo, pal.far, null, null, 0.5);
		L.mid = mk(L.midGeo, pal.mid, pal.midT, L.midForest, 0.42);
		L.hills = mk(L.hillGeo, pal.hills, pal.hillT, L.hillForest, 0.34);
		L.tint = { shore: wk(0.28)(pal.shore).map((c) => rgba(c)), fg: wk(0.2)(pal.fg).map((c) => rgba(c)), land: wk(0.2)(pal.land).map((c) => rgba(c)) };
		const sky = canvasLayer(w, h, dpr);
		const g = sky.x.createLinearGradient(0, 0, 0, L.waterY);
		g.addColorStop(0, rgba(st.sky.top)); g.addColorStop(0.5, rgba(st.sky.mid)); g.addColorStop(0.8, rgba(st.sky.hor)); g.addColorStop(1, rgba(st.sky.hor));
		sky.x.fillStyle = g;
		sky.x.fillRect(0, 0, w, h);
		L.sky = sky;
		painted = T;
	}

	function build(s) {
		const { w, h } = s;
		const waterY = Math.round(h * 0.8);
		L = { waterY };
		const lw = w + MX * 2;
		L.farGeo = ridgeGeo({ w: lw, h, baseY: h * 0.63, amp: h * 0.36, scale: w * 0.26, seed: 7, power: 1.15, x0: 2.3 });
		L.midGeo = ridgeGeo({ w: lw, h, baseY: h * 0.7, amp: h * 0.12, scale: w * 0.17, seed: 27, power: 1.2 });
		L.midForest = forestGeo({ w: lw, h, ridge: L.midGeo, rows: 3, rowGap: 6, tree: [9, 15], gap: [4, 7], seed: 33, bottom: waterY });
		L.hillGeo = ridgeGeo({ w: lw, h, baseY: h * 0.75, amp: h * 0.055, scale: w * 0.11, seed: 47, power: 1.1 });
		L.hillForest = forestGeo({ w: lw, h, ridge: L.hillGeo, rows: 3, rowGap: 7, tree: [16, 26], gap: [5, 9], seed: 57, bottom: waterY });
		trees.trees.length = 0;
		const r = rng(88);
		for (let x = -30; x < w + 30; x += 11 + r() * 20) {
			const clump = Math.sin(x * 0.011 + 1) * 0.5 + 0.5;
			trees.add(x, waterY + r() * 6, h * (0.03 + r() * 0.035 + clump * 0.035), { b: (r() * 3) | 0, grp: "shore", ww: 0.85 + r() * 0.35 });
		}
		L.landL = { x1: w * 0.25, top: waterY - h * 0.03, seed: 2 };
		L.landR = { x1: w * 0.78, top: waterY - h * 0.05, seed: 6 };
		L.landY = (side, x) => {
			const A = side === "l" ? L.landL : L.landR;
			const u = side === "l" ? (x + 120) / (A.x1 + 120) : (w + 120 - x) / (w + 120 - A.x1);
			return lerp(A.top, h + 20, Math.pow(clamp(u), 2.2)) + Math.sin(x * 0.09 + A.seed) * 3;
		};
		L.landRegion = (side) => (side === "l" ? [-120, L.landL.x1 + 20] : [L.landR.x1 - 20, w + 120]);
		const place = (side, n, big) => {
			for (let i = 0; i < n; i++) {
				const t = (i + r()) / n;
				const x = side === "l" ? lerp(-30, w * 0.22, Math.pow(t, 0.8)) : lerp(w + 30, w * 0.82, Math.pow(t, 0.8));
				const hh = h * lerp(big ? 0.46 : 0.38, 0.16, Math.pow(t, 0.7)) * (0.85 + r() * 0.3);
				trees.add(x, L.landY(side, x) + 10 + r() * 10, hh, { b: (r() * 3) | 0, grp: "fg", ww: 0.85 + r() * 0.35 });
			}
		};
		place("l", 7, true);
		place("r", 8, false);
		trees.trees.sort((a, b) => a.y - b.y);
		stars = makeStars(rng(15), 170, w, h * 0.58);
		glow = glowSprite(256, [255, 236, 190], [0.9, 0.22, 0]);
		moonGlow = glowSprite(256, [200, 214, 255], [0.6, 0.14, 0]);
		mist1 = cloudSprite(520, 110, 5, [255, 246, 236], 0.4);
		mist2 = cloudSprite(700, 120, 17, [255, 246, 236], 0.32);
		flies = Array.from({ length: 46 }, (_, i) => ({ x: r() * w, y: h * (0.5 + r() * 0.4), ph: r() * 20, sp: 0.6 + r() }));
		L.refl = canvasLayer(w, h - waterY + 40, s.dpr);
		repaint(s);
		swallows.resize(w, h);
		geese.resize(w, h);
		if (s.reduced) { swallows.settle(env(s), 6); }
		syncUI();
	}

	const DEPTH = { far: 4, mid: 10, hills: 17, shore: 28, fg: 54 };
	const offs = (s) => { const o = {}; for (const k in DEPTH) o[k] = [-s.px * DEPTH[k], -s.scrollT * DEPTH[k] * 0.9 - s.py * DEPTH[k] * 0.1]; return o; };
	function env(s) {
		const o = offs(s);
		const st = L.st || state(T);
		const act = smooth(clamp((st.elev + 0.16) / 0.3));
		const dawn = Math.exp(-(((T - 0.27) / 0.045) ** 2));
		return {
			wind: 0.8, pointer: s.pointer, calm: act * (1 + 3.2 * dawn),
			perches: trees.trees.filter((t) => t.grp === "fg" && t.h > s.h * 0.18).map((t) => { const c = trees.crown(t, s.t, 0.8); return { x: c[0] + o.fg[0], y: c[1] + o.fg[1] + 4 }; }),
		};
	}
	// body (sun or moon) position on the dial
	function body(s) {
		const st = L.st;
		const a = st.elev >= 0 ? st.a : st.a - Math.PI;
		const hy = s.h * 0.66, Rx = s.w * 0.47, Ry = s.h * 0.5;
		return { x: s.w / 2 - Rx * Math.cos(a), y: hy - Ry * Math.sin(a), moon: st.elev < 0, hy, Rx, Ry };
	}

	function update(dt, s) {
		if (tween) {
			tween.t += dt / 1.6;
			const k = smooth(clamp(tween.t));
			T = lerp(tween.from, tween.to, k);
			if (tween.t >= 1) tween = null;
			syncUI();
		} else if (auto && !dragging) { T = (T + dt / 80) % 1; syncUI(); }
		if (Math.abs(T - painted) > 0.0012) repaint(s);
		if (s.reduced) return;
		const e = env(s);
		swallows.update(dt, e);
		geese.update(dt, { wind: e.wind, perches: [], calm: e.calm });
		trees.update(dt);
	}

	function draw(ctx, s) {
		const { w, h } = s;
		const st = L.st, pal = L.pal, o = offs(s), t = s.t;
		const wy = L.waterY + o.shore[1];
		const bd = body(s);
		ctx.drawImage(L.sky.c, 0, 0, w, h);
		drawStars(ctx, stars, t, clamp((st.night - 0.35) * 1.6), [225, 232, 255], o.far[0] * 0.3, o.far[1] * 0.3);
		// dial arc: a faint dotted path the sun/moon follows
		ctx.save();
		ctx.setLineDash([1.5, 9]);
		ctx.lineCap = "round";
		ctx.lineWidth = 2;
		ctx.strokeStyle = st.night > 0.5 ? "rgba(200,214,255,.28)" : "rgba(255,255,255,.4)";
		ctx.beginPath();
		ctx.ellipse(w / 2, bd.hy, bd.Rx, bd.Ry, 0, Math.PI, TAU);
		ctx.stroke();
		ctx.restore();
		// body
		const lowK = 1 - clamp(Math.abs(Math.sin(bd.moon ? st.a - Math.PI : st.a)) * 2.5);
		const bx = bd.x + o.far[0] * 0.4, by = bd.y + o.far[1] * 0.4;
		ctx.globalCompositeOperation = "lighter";
		ctx.globalAlpha = bd.moon ? 0.5 : 0.5 + lowK * 0.3;
		const gs = bd.moon ? 260 : 260 + lowK * 160;
		ctx.drawImage(bd.moon ? moonGlow : glow, bx - gs / 2, by - gs / 2, gs, gs);
		ctx.globalCompositeOperation = "source-over";
		ctx.globalAlpha = 1;
		if (bd.moon) {
			ctx.fillStyle = "rgba(238,242,255,.95)";
			ctx.beginPath(); ctx.arc(bx, by, 17, 0, TAU); ctx.fill();
			ctx.fillStyle = "rgba(150,165,205,.32)";
			for (const [dx, dy, r] of [[-6, -4, 4], [5, 6, 3], [4, -8, 2.4], [-3, 9, 2]]) { ctx.beginPath(); ctx.arc(bx + dx, by + dy, r, 0, TAU); ctx.fill(); }
		} else {
			ctx.fillStyle = rgba(mixC([255, 246, 214], [255, 160, 90], lowK * 0.8), 1);
			ctx.beginPath(); ctx.arc(bx, by, 22 + lowK * 8, 0, TAU); ctx.fill();
		}
		if (dragging) { ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(bx, by, 40, 0, TAU); ctx.stroke(); }
		else if (!dragging && !s.reduced) { ctx.strokeStyle = `rgba(255,255,255,${0.22 + 0.15 * Math.sin(t * 2)})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(bx, by, 36 + Math.sin(t * 2) * 2, 0, TAU); ctx.stroke(); }
		// mountains
		ctx.drawImage(L.far.c, -MX + o.far[0], o.far[1], L.far.w, L.far.h);
		const drift = (t * 6) % 1400;
		ctx.globalAlpha = 1 - st.night * 0.6;
		ctx.drawImage(mist1, ((drift * 0.6 + 100) % (w + 600)) - 400, h * 0.52 + o.mid[1], 620, 130);
		ctx.globalAlpha = 1;
		drawSheared(ctx, L.mid, -MX + o.mid[0], o.mid[1], { bands: 8, amp: 1.5, t, phase: 1, wind: 0.6 });
		ctx.globalAlpha = 1 - st.night * 0.6;
		ctx.drawImage(mist2, ((drift * 0.9 + 800) % (w + 800)) - 500, h * 0.65 + o.hills[1], 760, 130);
		ctx.globalAlpha = 1;
		drawSheared(ctx, L.hills, -MX + o.hills[0], o.hills[1], { bands: 10, amp: 2.6, t, phase: 2, wind: 0.8 });
		// lake
		ctx.fillStyle = rgba(pal.water);
		ctx.fillRect(0, wy, w, h - wy);
		const R = L.refl, rx = R.x, depth = h - L.waterY + 40;
		rx.setTransform(s.dpr, 0, 0, -s.dpr, 0, s.dpr * L.waterY);
		rx.clearRect(0, -depth * 2, w, depth * 4);
		rx.drawImage(L.sky.c, 0, 0, w, h);
		rx.globalCompositeOperation = "lighter"; rx.globalAlpha = bd.moon ? 0.5 : 0.8;
		rx.drawImage(bd.moon ? moonGlow : glow, bx - gs / 2, by - gs / 2 - o.shore[1], gs, gs);
		rx.globalCompositeOperation = "source-over"; rx.globalAlpha = 1;
		rx.fillStyle = bd.moon ? "rgba(238,242,255,.95)" : "rgba(255,244,214,.95)";
		rx.beginPath(); rx.arc(bx, by - o.shore[1], bd.moon ? 17 : 22 + lowK * 8, 0, TAU); rx.fill();
		rx.drawImage(L.far.c, -MX + o.far[0], o.far[1] - o.shore[1], L.far.w, L.far.h);
		rx.drawImage(L.mid.c, -MX + o.mid[0], o.mid[1] - o.shore[1], L.mid.w, L.mid.h);
		rx.drawImage(L.hills.c, -MX + o.hills[0], o.hills[1] - o.shore[1], L.hills.w, L.hills.h);
		trees.draw(rx, t, 0.8, L.tint.shore, { ox: o.shore[0], oy: 0, filter: (q) => q.grp === "shore" });
		drawReflectionStrips(ctx, R, { y: wy, w, depth: h - wy, t, amp: 2.2, strip: 3, alpha: 0.72, fadeTo: 0.3 });
		const g = ctx.createLinearGradient(0, wy, 0, h);
		g.addColorStop(0, rgba(pal.wTop, 0.2));
		g.addColorStop(1, rgba(pal.wBot, 0.7));
		ctx.fillStyle = g;
		ctx.fillRect(0, wy, w, h - wy);
		// glitter path
		const bright = bd.moon ? 0.55 : 0.8;
		ctx.fillStyle = bd.moon ? "rgba(230,238,255,.8)" : "rgba(255,248,226,.9)";
		const gx = bx - o.far[0] * 0.4 + o.shore[0] * 0.3;
		if (st.elev > -0.08 || bd.moon) {
			for (let i = 0; i < 44; i++) {
				const f = (i * 0.6180339) % 1;
				const yy = wy + 3 + f * (h - wy - 6);
				const spread = 10 + f * 80;
				const xx = gx + Math.sin(i * 12.9 + t * 0.4) * spread * 0.8;
				ctx.globalAlpha = Math.max(0, Math.sin(t * (1.4 + (i % 5) * 0.35) + i * 3.1)) * (1 - f * 0.55) * bright * (bd.moon ? 1 : clamp(st.elev * 4 + 0.3));
				ctx.fillRect(xx, yy, 2 + f * 9 * (1 + (i % 3) * 0.4), 1 + f * 1.2);
			}
			ctx.globalAlpha = 1;
		}
		swallows.draw(ctx, birdColors(st), { reflectY: wy, reflectAlpha: 0.2 });
		trees.draw(ctx, t, 0.8, L.tint.shore, { ox: o.shore[0], oy: o.shore[1], filter: (q) => q.grp === "shore" });
		// land + shadows + foreground
		for (const side of ["l", "r"]) {
			const [a, b] = L.landRegion(side);
			ctx.beginPath();
			ctx.moveTo(a + o.fg[0], h + 40);
			for (let x = a; x <= b; x += 6) ctx.lineTo(x + o.fg[0], L.landY(side, x) + o.fg[1]);
			ctx.lineTo(b + o.fg[0], h + 40);
			ctx.closePath();
			const gl = ctx.createLinearGradient(0, h * 0.7, 0, h);
			gl.addColorStop(0, L.tint.land[0]);
			gl.addColorStop(1, L.tint.land[1]);
			ctx.fillStyle = gl;
			ctx.fill();
		}
		// long cast shadows from the foreground pines (lengthen toward dusk/dawn)
		const sunUp = st.elev > 0.02;
		if (sunUp || bd.moon) {
			const dirX = bd.x < w / 2 ? 1 : -1;
			const len = clamp(1.4 / (Math.abs(st.elev) * 3 + 0.35), 0.4, 3.2) * (sunUp ? 1 : 0.8);
			ctx.fillStyle = rgba([5, 14, 14], (sunUp ? 0.2 : 0.1) * (1 - st.night * 0.7));
			ctx.beginPath();
			for (const tr of trees.trees) {
				if (tr.grp !== "fg") continue;
				const p = variants[tr.v % variants.length];
				const x0 = tr.x + o.fg[0], y0 = tr.y + o.fg[1];
				const f = (i) => { const px = p[i], py = p[i + 1]; return [x0 + px * tr.h * tr.ww * 0.7 + dirX * -py * tr.h * len * 0.9, y0 - py * tr.h * 0.1 * Math.min(len, 1.6) * -1 * -1 + py * tr.h * 0.0 + (-py) * tr.h * 0.1]; };
				let [sx, sy] = f(0);
				ctx.moveTo(sx, sy);
				for (let i = 2; i < p.length; i += 2) { [sx, sy] = f(i); ctx.lineTo(sx, sy); }
				ctx.closePath();
			}
			ctx.fill();
		}
		trees.draw(ctx, t, 0.8, L.tint.fg, { ox: o.fg[0], oy: o.fg[1], filter: (q) => q.grp === "fg" });
		// fireflies
		if (st.night > 0.55) {
			const fa = clamp((st.night - 0.55) * 2.2);
			ctx.globalCompositeOperation = "lighter";
			for (const f of flies) {
				const x = f.x + Math.sin(t * 0.21 * f.sp + f.ph) * 34 + Math.cos(t * 0.13 + f.ph * 2) * 22 + o.fg[0] * 0.5;
				const y = f.y + Math.sin(t * 0.17 * f.sp + f.ph * 3) * 18 + o.fg[1] * 0.5;
				const b = Math.pow(Math.max(0, Math.sin(t * 1.3 * f.sp + f.ph * 5)), 3);
				ctx.globalAlpha = fa * (0.1 + 0.9 * b);
				ctx.drawImage(fireflySprite(), x - 9, y - 9, 18, 18);
			}
			ctx.globalCompositeOperation = "source-over";
			ctx.globalAlpha = 1;
		}
		geese.draw(ctx, birdColors(st));
		swallows.draw(ctx, birdColors(st));
	}
	let ffs = null;
	const fireflySprite = () => (ffs ||= glowSprite(32, [210, 255, 150], [1, 0.25, 0]));
	const birdColors = (st) => {
		const c = mixC([36, 52, 74], [205, 218, 244], clamp(st.night * 1.1));
		const a = lerp(0.82, 0.62, st.night);
		return [rgba(c, a * 0.7), rgba(c, a * 0.85), rgba(c, a)];
	};

	// ----- interaction -----
	const grabR = 54;
	const toT = (px, py, s) => {
		const bd = body(s);
		const ax = (bd.x * 0 + (s.w / 2 - px)) / bd.Rx, ay = (bd.hy - py) / bd.Ry;
		let a = Math.atan2(ay, ax);
		if (a < 0) a += TAU;
		return ((a / TAU) + 0.25) % 1;
	};
	stage.on(window, "pointerdown", (e) => {
		if (e.button !== 0 || !isEmptyAt(root, e.clientX, e.clientY)) return;
		const [x, y] = stage.toLocal(e.clientX, e.clientY);
		const bd = body(stage);
		const hit = Math.hypot(x - bd.x, y - bd.y) < grabR;
		dragging = { grab: hit, lastX: x, pid: e.pointerId };
		tween = null;
		root.style.userSelect = "none";
		window.getSelection()?.removeAllRanges();
		root.style.cursor = "grabbing";
		hint.hide();
		e.preventDefault();
	});
	stage.on(window, "pointermove", (e) => {
		if (!dragging) {
			if (e.buttons === 0) {
				const [x, y] = stage.toLocal(e.clientX, e.clientY);
				const bd = L && L.st ? body(stage) : null;
				const near = bd && Math.hypot(x - bd.x, y - bd.y) < grabR && isEmptyAt(root, e.clientX, e.clientY);
				root.style.cursor = near ? "grab" : "";
			}
			return;
		}
		const [x, y] = stage.toLocal(e.clientX, e.clientY);
		if (dragging.grab) T = toT(x, y, stage);
		else { T = (T + (x - dragging.lastX) / stage.w * 0.5 + 1) % 1; dragging.lastX = x; }
		syncUI();
		if (stage.reduced) stage.invalidate();
	});
	const end = () => { if (dragging) { dragging = null; root.style.userSelect = ""; root.style.cursor = ""; } };
	stage.on(window, "pointerup", end);
	stage.on(window, "pointercancel", end);
	slider.addEventListener("input", () => { T = slider.value / 1440; tween = null; hint.hide(); out.textContent = fmt(T); if (stage.reduced) stage.invalidate(); });
	autoBtn.addEventListener("click", () => { auto = !auto; autoBtn.setAttribute("aria-pressed", auto); hint.hide(); });

	return () => { stage.destroy(); unwatch(); root.style.cursor = ""; root.style.userSelect = ""; };
}
