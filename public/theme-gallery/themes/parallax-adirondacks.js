import { createStage, canvasLayer, ridgeGeo, paintRidge, forestGeo, paintForest, makePineVariants, LiveTrees, Flock, Ripples, Pool, drawSheared, drawReflectionStrips, cloudSprite, glowSprite, makeStars, drawStars, onEmptyTap, addHint, isDark, watchDark, hex, mixC, rgba, ramp, clamp, lerp, smooth, rng, TAU } from "./forest-kit/kit.js";

const PAL = {
	light: {
		sky: [[0, "#9ec6e4"], [0.5, "#cfe2ec"], [0.78, "#f6e9d2"], [1, "#f6e9d2"]],
		far: { top: "#86a1bd", bottom: "#c9d8e3", shade: "#5a7595", lit: "#eef3f6" },
		mid: { top: "#6f93a8", bottom: "#b4cbd1", shade: "#4a6d85", lit: "#e3ecee" },
		midTrees: ["#5a8190", "#4f7688", "#648d99"],
		hills: { top: "#527f85", bottom: "#7fa7a5", shade: "#355a63", lit: null },
		hillTrees: ["#3d6a66", "#33605e", "#477872"],
		shore: ["#31594f", "#2a4e48", "#3a665a"],
		land: ["#1d3a34", "#17302c"],
		fg: ["#173330", "#122a28", "#1b3b36"],
		water: "#6a98ae", waterTop: "#8fb7c8", waterBot: "#2f6482",
		mist: [255, 250, 240], sun: [255, 238, 200],
		bird: ["rgba(52,70,92,.62)", "rgba(36,52,74,.78)", "rgba(20,32,50,.92)"],
		needle: "rgba(30,60,50,.8)",
	},
	dark: {
		sky: [[0, "#060b1f"], [0.5, "#16254b"], [0.78, "#3b4f7d"], [1, "#3b4f7d"]],
		far: { top: "#2b3a68", bottom: "#41547e", shade: "#18234a", lit: "#5a6e99" },
		mid: { top: "#22305b", bottom: "#364a76", shade: "#131d40", lit: null },
		midTrees: ["#1b2a52", "#17244a", "#20315a"],
		hills: { top: "#192649", bottom: "#2a3c65", shade: "#0f1832", lit: null },
		hillTrees: ["#131f40", "#101a38", "#17254a"],
		shore: ["#0d1630", "#0a1229", "#101a38"],
		land: ["#070d1e", "#050a17"],
		fg: ["#060b1b", "#040815", "#081022"],
		water: "#162645", waterTop: "#2c4270", waterBot: "#0b1630",
		mist: [150, 170, 220], sun: [230, 238, 255],
		bird: ["rgba(190,205,235,.5)", "rgba(200,214,240,.66)", "rgba(215,226,248,.82)"],
		needle: "rgba(120,150,190,.7)",
	},
};
const conv = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === "string" ? hex(v) : Array.isArray(v) && typeof v[0] === "string" ? v.map(hex) : v && typeof v === "object" && !Array.isArray(v) ? conv(v) : v]));
const P = { light: conv({ far: PAL.light.far, mid: PAL.light.mid, hills: PAL.light.hills, midTrees: PAL.light.midTrees, hillTrees: PAL.light.hillTrees }), dark: conv({ far: PAL.dark.far, mid: PAL.dark.mid, hills: PAL.dark.hills, midTrees: PAL.dark.midTrees, hillTrees: PAL.dark.hillTrees }) };

export function activate({ root, reducedMotion }) {
	let dark = isDark();
	const hint = addHint(root, reducedMotion ? "Move the pointer to shift the layers" : "Click a pine to shake it · click the lake for ripples · move to shift depth");
	const variants = makePineVariants(91, 8);
	const trees = new LiveTrees(variants);
	const ripples = new Ripples(18);
	const needles = new Pool(160);
	const swallows = new Flock({ seed: 3, groups: 3, perGroup: [5, 9], size: [3.6, 6.2], band: [0.1, 0.42], speed: [46, 78], respawn: [1.2, 6], flap: [6, 9] });
	const geese = new Flock({ seed: 8, groups: 1, perGroup: [5, 7], size: [7, 8.5], band: [0.08, 0.2], speed: [34, 42], formation: "v", respawn: [10, 24], flap: [2.4, 3] });
	swallows.addResidents(6, [4.5, 6]);
	let L = null, gust = 0, tapped = false;
	let stars = [], sunSprite = null, mistSprite = null, mistSprite2 = null;
	const MX = 70;

	const stage = createStage(root, { reducedMotion, build, draw, update });
	const unwatch = watchDark((d) => { dark = d; if (stage.ready) { rebuildLayers(stage); stage.invalidate(); } });

	function pal() { return PAL[dark ? "dark" : "light"]; }

	function rebuildLayers(s) {
		const { w, h, dpr } = s;
		const p = pal(), q = P[dark ? "dark" : "light"];
		const lw = w + MX * 2;
		const wy = L.waterY;
		const mk = (geo, ridgePal, treePal, forest) => {
			const lay = canvasLayer(lw, h, dpr);
			paintRidge(lay.x, geo, { ...ridgePal, depth: 70, light: 1 });
			if (forest) paintForest(lay.x, forest, variants, treePal);
			return lay;
		};
		L.far = mk(L.farGeo, q.far);
		L.mid = mk(L.midGeo, q.mid, q.midTrees, L.midForest);
		L.hills = mk(L.hillGeo, q.hills, q.hillTrees, L.hillForest);
		stars = makeStars(rng(11), 160, w, h * 0.55);
		sunSprite = glowSprite(256, p.sun, [0.9, 0.22, 0]);
		mistSprite = cloudSprite(520, 110, 5, p.mist, dark ? 0.2 : 0.42);
		mistSprite2 = cloudSprite(700, 120, 17, p.mist, dark ? 0.16 : 0.34);
		// sky gradient canvas
		const sky = canvasLayer(w, h, dpr);
		const g = sky.x.createLinearGradient(0, 0, 0, wy);
		p.sky.forEach(([t, c]) => g.addColorStop(t, c));
		sky.x.fillStyle = g;
		sky.x.fillRect(0, 0, w, h);
		L.sky = sky;
		L.refl = canvasLayer(w, h - wy + 40, dpr);
		L.refl.waterY = wy;
	}

	function build(s) {
		const { w, h } = s;
		const lw = w + MX * 2;
		const waterY = Math.round(h * 0.8);
		L = { waterY };
		L.farGeo = ridgeGeo({ w: lw, h, baseY: h * 0.62, amp: h * 0.36, scale: w * 0.26, seed: 7, power: 1.15, x0: 2.3 });
		L.midGeo = ridgeGeo({ w: lw, h, baseY: h * 0.69, amp: h * 0.13, scale: w * 0.16, seed: 21, power: 1.2 });
		L.midForest = forestGeo({ w: lw, h, ridge: L.midGeo, rows: 3, rowGap: 6, tree: [9, 15], gap: [4, 7], seed: 31, bottom: waterY });
		L.hillGeo = ridgeGeo({ w: lw, h, baseY: h * 0.745, amp: h * 0.06, scale: w * 0.1, seed: 41, power: 1.1 });
		L.hillForest = forestGeo({ w: lw, h, ridge: L.hillGeo, rows: 3, rowGap: 7, tree: [16, 26], gap: [5, 9], seed: 51, bottom: waterY });
		trees.trees.length = 0;
		const r = rng(77);
		// shore pines along the waterline
		for (let x = -30; x < w + 30; x += 11 + r() * 20) {
			const clump = Math.sin(x * 0.013) * 0.5 + 0.5;
			trees.add(x, waterY + r() * 6, h * (0.03 + r() * 0.035 + clump * 0.035), { b: (r() * 3) | 0, grp: "shore", ww: 0.85 + r() * 0.35 });
		}
		// foreground promontories
		L.landL = { x1: w * 0.28, top: waterY - h * 0.045, seed: 3 };
		L.landR = { x1: w * 0.76, top: waterY - h * 0.02, seed: 9 };
		const landY = (side, x) => {
			const A = side === "l" ? L.landL : L.landR;
			const u = side === "l" ? (x + 120) / (A.x1 + 120) : (w + 120 - x) / (w + 120 - A.x1);
			return lerp(A.top, h + 20, Math.pow(clamp(u), 2.2)) + Math.sin(x * 0.09 + A.seed) * 3;
		};
		L.landY = landY;
		L.landRegion = (side) => (side === "l" ? [-120, L.landL.x1 + 20] : [L.landR.x1 - 20, w + 120]);
		const place = (side, n, big) => {
			const [a, b] = L.landRegion(side);
			for (let i = 0; i < n; i++) {
				const t = (i + r()) / n;
				const x = side === "l" ? lerp(-30, w * 0.24, Math.pow(t, 0.8)) : lerp(w + 30, w * 0.8, Math.pow(t, 0.8));
				const hh = h * (big ? lerp(0.52, 0.2, Math.pow(t, 0.7)) : lerp(0.4, 0.17, Math.pow(t, 0.7))) * (0.85 + r() * 0.3);
				trees.add(x, landY(side, x) + 10 + r() * 10, hh, { b: (r() * 3) | 0, grp: "fg", ww: 0.85 + r() * 0.35 });
			}
		};
		place("l", 8, true);
		place("r", 7, false);
		trees.trees.sort((a, b) => a.y - b.y);
		rebuildLayers(s);
		swallows.resize(w, h);
		geese.resize(w, h);
		if (s.reduced) { swallows.settle(env(s), 6); geese.settle(env(s), 2); geese.groups[0].wait = 0; geese.spawn(geese.groups[0], true); }
	}

	function env(s) {
		const perches = trees.trees.filter((t) => t.grp === "fg" && t.h > s.h * 0.2).map((t) => { const c = trees.crown(t, s.t, 0.8); return { x: c[0] + offs(s).fg[0], y: c[1] + offs(s).fg[1] + 4 }; });
		return { wind: 0.8 + gust, perches, pointer: s.pointer, w: s.w, h: s.h };
	}
	const DEPTH = { far: 5, mid: 12, hills: 20, shore: 32, fg: 62 };
	function offs(s) {
		const out = {};
		for (const k in DEPTH) out[k] = [-s.px * DEPTH[k], -s.scrollT * DEPTH[k] * 0.9 - s.py * DEPTH[k] * 0.12];
		return out;
	}

	function update(dt, s) {
		if (s.reduced) return;
		gust = Math.max(0, gust - dt * 0.6);
		const e = env(s);
		swallows.update(dt, e);
		geese.update(dt, { wind: e.wind, perches: [] });
		trees.update(dt);
		ripples.step(dt);
		needles.step(dt, (p, d) => { p.vy += 34 * d; p.vx += (14 + gust * 40) * d; p.x += p.vx * d; p.y += p.vy * d; p.r += p.vr * d; if (p.y > L.waterY + 40) return false; });
	}

	function draw(ctx, s) {
		const { w, h } = s;
		const p = pal();
		const o = offs(s);
		const wy = L.waterY + o.shore[1];
		const t = s.t;
		ctx.drawImage(L.sky.c, 0, 0, w, h);
		// celestial body
		const sx = w * 0.88 + o.far[0] * 0.5, sy = h * 0.22 + o.far[1] * 0.5;
		drawStars(ctx, stars, t, dark ? 1 : 0, [225, 232, 255], o.far[0] * 0.3, o.far[1] * 0.3);
		ctx.globalAlpha = dark ? 0.75 : 1;
		ctx.drawImage(sunSprite, sx - 170, sy - 170, 340, 340);
		ctx.globalAlpha = 1;
		ctx.fillStyle = dark ? "rgba(236,241,255,.92)" : "rgba(255,248,226,.95)";
		ctx.beginPath();
		ctx.arc(sx, sy, dark ? 17 : 24, 0, TAU);
		ctx.fill();
		if (dark) {
			ctx.fillStyle = "rgba(150,165,205,.35)";
			for (const [dx, dy, r] of [[-6, -4, 4], [5, 6, 3], [4, -8, 2.4], [-3, 9, 2]]) { ctx.beginPath(); ctx.arc(sx + dx, sy + dy, r, 0, TAU); ctx.fill(); }
		}
		// far ridge + mist + mid + hills
		ctx.drawImage(L.far.c, -MX + o.far[0], o.far[1], L.far.w, L.far.h);
		const drift = (t * 6) % 1400;
		ctx.drawImage(mistSprite, ((drift * 0.6 + 100) % (w + 600)) - 400, h * 0.5 + o.mid[1], 620, 130);
		drawSheared(ctx, L.mid, -MX + o.mid[0], o.mid[1], { bands: 8, amp: 1.6, t, phase: 1, wind: 0.6 + gust });
		ctx.drawImage(mistSprite2, ((drift * 0.9 + 800) % (w + 800)) - 500, h * 0.63 + o.hills[1], 760, 130);
		drawSheared(ctx, L.hills, -MX + o.hills[0], o.hills[1], { bands: 10, amp: 3, t, phase: 2, wind: 0.8 + gust });
		// water
		const depth = h - L.waterY + 40;
		ctx.fillStyle = p.water;
		ctx.fillRect(0, wy, w, h - wy);
		const R = L.refl;
		const rx = R.x;
		rx.setTransform(s.dpr, 0, 0, -s.dpr, 0, s.dpr * L.waterY);
		rx.clearRect(0, -depth * 2, w, depth * 4);
		rx.drawImage(L.sky.c, 0, 0, w, h);
		rx.drawImage(L.far.c, -MX + o.far[0], o.far[1] - o.shore[1], L.far.w, L.far.h);
		rx.drawImage(L.mid.c, -MX + o.mid[0], o.mid[1] - o.shore[1], L.mid.w, L.mid.h);
		rx.drawImage(L.hills.c, -MX + o.hills[0], o.hills[1] - o.shore[1], L.hills.w, L.hills.h);
		trees.draw(rx, t, 0.8 + gust, p.shore, { ox: o.shore[0], oy: -o.shore[1] + o.shore[1], filter: (q) => q.grp === "shore" });
		drawReflectionStrips(ctx, R, { y: wy, w, depth: h - wy, t, amp: 2.2, strip: 3, alpha: 0.7, fadeTo: 0.3 });
		const g = ctx.createLinearGradient(0, wy, 0, h);
		g.addColorStop(0, rgba(hex(p.waterTop), 0.22));
		g.addColorStop(1, rgba(hex(p.waterBot), 0.72));
		ctx.fillStyle = g;
		ctx.fillRect(0, wy, w, h - wy);
		// glitter under the sun / moon
		ctx.fillStyle = dark ? "rgba(230,238,255,.8)" : "rgba(255,250,232,.85)";
		const gx = sx - o.far[0] * 0.5 + o.shore[0] * 0.3;
		for (let i = 0; i < 46; i++) {
			const f = (i * 0.6180339) % 1;
			const yy = wy + 3 + f * (h - wy - 6);
			const spread = 10 + f * 90;
			const xx = gx + Math.sin(i * 12.9 + t * 0.4) * spread * 0.8;
			const a = Math.max(0, Math.sin(t * (1.4 + (i % 5) * 0.35) + i * 3.1)) * (1 - f * 0.55);
			ctx.globalAlpha = a * (dark ? 0.55 : 0.7);
			ctx.fillRect(xx, yy, 2 + f * 9 * (1 + (i % 3) * 0.4), 1 + f * 1.2);
		}
		ctx.globalAlpha = 1;
		ripples.draw(ctx, { squash: 0.2, color: dark ? [190, 210, 245] : [255, 255, 255], dark: [10, 30, 50] });
		swallows.draw(ctx, p.bird, { reflectY: wy, reflectAlpha: 0.22 });
		// shore pines
		trees.draw(ctx, t, 0.8 + gust, p.shore, { ox: o.shore[0], oy: o.shore[1], filter: (q) => q.grp === "shore" });
		// foreground promontories
		const landPath = (side) => {
			const [a, b] = L.landRegion(side);
			ctx.beginPath();
			ctx.moveTo(a + o.fg[0], h + 40);
			for (let x = a; x <= b; x += 6) ctx.lineTo(x + o.fg[0], L.landY(side, x) + o.fg[1]);
			ctx.lineTo(b + o.fg[0], h + 40);
			ctx.closePath();
		};
		for (const side of ["l", "r"]) {
			landPath(side);
			const gl = ctx.createLinearGradient(0, h * 0.7, 0, h);
			gl.addColorStop(0, p.land[0] ? p.land[0] : "#000");
			gl.addColorStop(1, p.land[1]);
			ctx.fillStyle = gl;
			ctx.fill();
		}
		trees.draw(ctx, t, 0.8 + gust, p.fg, { ox: o.fg[0], oy: o.fg[1], filter: (q) => q.grp === "fg" });
		geese.draw(ctx, p.bird);
		// perched + remaining swallows over foreground
		swallows.draw(ctx, p.bird);
		// falling needles
		ctx.strokeStyle = p.needle;
		ctx.lineWidth = 1;
		ctx.beginPath();
		for (let i = 0; i < needles.n; i++) {
			const n = needles.a[i];
			const dx = Math.cos(n.r) * 3, dy = Math.sin(n.r) * 3;
			ctx.moveTo(n.x - dx, n.y - dy);
			ctx.lineTo(n.x + dx, n.y + dy);
		}
		ctx.stroke();
	}

	function shakeTree(i, s) {
		const tr = trees.trees[i];
		const dir = Math.random() < 0.5 ? -1 : 1;
		tr.shakeV = dir * 1.25 * clamp(0.5 + 40 / tr.h, 0.5, 1.6);
		for (const q of trees.trees) {
			if (q === tr) continue;
			const d = Math.abs(q.x - tr.x);
			if (d < 110) q.shakeV += dir * 0.5 * (1 - d / 110);
		}
		const o = offs(s);
		const off = tr.grp === "fg" ? o.fg : o.shore;
		const [cx, cy] = trees.crown(tr, s.t, 0.8);
		for (let k = 0; k < 16; k++) needles.emit(cx + off[0] + (Math.random() - 0.5) * tr.h * 0.3, cy + off[1] + Math.random() * tr.h * 0.4, (Math.random() - 0.5) * 40, -10 + Math.random() * 30, 1.6 + Math.random() * 1.2, 1);
		swallows.scare(cx + off[0], cy + off[1], 190);
		geese.scare(cx + off[0], cy + off[1], 120, 0.5);
	}

	onEmptyTap(stage, (cx, cy) => {
		if (stage.reduced) return;
		const [x, y] = stage.toLocal(cx, cy);
		const o = offs(stage);
		const wind = 0.8 + gust;
		let i = trees.hit(x, y, stage.t, wind, o.fg[0], o.fg[1], (q) => q.grp === "fg");
		if (i < 0) i = trees.hit(x, y, stage.t, wind, o.shore[0], o.shore[1], (q) => q.grp === "shore");
		if (!tapped) { tapped = true; hint.hide(); }
		if (i >= 0) shakeTree(i, stage);
		else if (y > L.waterY + o.shore[1]) { ripples.add(x, y, 1, 1 + (y - L.waterY) / stage.h); swallows.scare(x, y - 30, 90, 0.4); }
		else gust = Math.min(1.6, gust + 1);
	});

	return () => { stage.destroy(); unwatch(); };
}
