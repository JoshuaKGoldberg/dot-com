import { createStage, canvasLayer, ridgeGeo, paintRidge, forestGeo, paintForest, makePineVariants, LiveTrees, Flock, Pool, drawSheared, drawReflectionStrips, cloudSprite, glowSprite, makeStars, drawStars, onEmptyTap, addHint, addUI, isDark, watchDark, hex, rgba, clamp, lerp, rng, TAU } from "./forest-kit/kit.js";

const RAW = {
	light: {
		sky: [[0, "#4a5a96"], [0.5, "#c78fa6"], [0.8, "#f6b878"], [1, "#f9c88a"]],
		far: { top: "#6a6a9a", bottom: "#c98f9c", shade: "#3e4378", lit: "#f0b394" },
		mid: { top: "#54527f", bottom: "#b57d8d", shade: "#363a68", lit: null },
		midTrees: ["#4a4a78", "#413f6c", "#555583"],
		hills: { top: "#3d3b63", bottom: "#8a5f74", shade: "#2a2a52", lit: null },
		hillTrees: ["#312f58", "#2a284d", "#383662"],
		fg: ["#1e1d38", "#181730", "#24223f"], land: ["#201e3a", "#0e0d1f"],
		water: "#8a6f8f", waterTop: "#f0a47a", waterBot: "#2b2a52", mist: "#ffd9c0",
		bird: ["rgba(30,28,56,.8)", "rgba(22,20,44,.88)", "rgba(14,12,32,.95)"],
		glow: 0.55, wood: [60, 38, 40],
	},
	dark: {
		sky: [[0, "#03061a"], [0.55, "#0d1838"], [1, "#1f2d55"]],
		far: { top: "#1a2447", bottom: "#27355f", shade: "#0c1330", lit: "#3a4c80" },
		mid: { top: "#121a38", bottom: "#1d2b4e", shade: "#0a1028", lit: null },
		midTrees: ["#0c1328", "#0a1022", "#0e1630"],
		hills: { top: "#0d1430", bottom: "#152040", shade: "#080c1e", lit: null },
		hillTrees: ["#080d20", "#070b1b", "#0a1126"],
		fg: ["#06090f", "#04070d", "#080c15"], land: ["#0a0d14", "#04060b"],
		water: "#0a1430", waterTop: "#1b2d5a", waterBot: "#040918", mist: "#8ea0d8",
		bird: ["rgba(6,9,18,.9)", "rgba(4,6,14,.95)", "rgba(2,3,8,1)"],
		glow: 1, wood: [38, 26, 26],
	},
};
const conv = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === "string" ? hex(v) : Array.isArray(v) && typeof v[0] === "string" ? v.map(hex) : v && typeof v === "object" && !Array.isArray(v) && k !== "sky" ? conv(v) : v]));
const CP = { light: conv(RAW.light), dark: conv(RAW.dark) };

export function activate({ root, reducedMotion }) {
	let dark = isDark();
	const hint = addHint(root, reducedMotion ? "Press Add log to feed the fire" : "Click empty scenery to throw a log on the fire");
	const ui = addUI(root, `<span class="fk-fire-label">Fire: glowing</span><button type="button" class="fk-add">Add log</button>`);
	const label = ui.querySelector(".fk-fire-label");
	const variants = makePineVariants(94, 8);
	const trees = new LiveTrees(variants);
	const sparks = new Pool(300);
	const flock = new Flock({ seed: 5, groups: 1, perGroup: [3, 5], size: [4, 6], band: [0.08, 0.3], speed: [40, 60], respawn: [18, 40], flap: [6, 8] });
	flock.addResidents(7, [4.8, 6.4]);
	let L = null, fuel = 0.7, I = 0.7, flick = 0, thrown = [], stars = [], glow = null, mist = null, tapped = false, flares = 0;
	const MX = 70;
	const stage = createStage(root, { reducedMotion, build, draw, update });
	const unwatch = watchDark((d) => { dark = d; if (stage.ready) { rebuildLayers(stage); stage.invalidate(); } });
	const pal = () => RAW[dark ? "dark" : "light"];
	const cp = () => CP[dark ? "dark" : "light"];

	function rebuildLayers(s) {
		const { w, h, dpr } = s;
		const p = pal(), q = cp(), lw = w + MX * 2;
		const mk = (geo, rp, tp, forest) => {
			const lay = canvasLayer(lw, h, dpr);
			paintRidge(lay.x, geo, { ...rp, depth: 70, light: 1 });
			if (forest) paintForest(lay.x, forest, variants, tp);
			return lay;
		};
		L.far = mk(L.farGeo, q.far);
		L.mid = mk(L.midGeo, q.mid, q.midTrees, L.midForest);
		L.hills = mk(L.hillGeo, q.hills, q.hillTrees, L.hillForest);
		const sky = canvasLayer(w, h, dpr);
		const g = sky.x.createLinearGradient(0, 0, 0, L.waterY);
		p.sky.forEach(([t, c]) => g.addColorStop(t, c));
		sky.x.fillStyle = g;
		sky.x.fillRect(0, 0, w, h);
		L.sky = sky;
		L.refl = canvasLayer(w, h - L.waterY + 40, dpr);
		stars = makeStars(rng(94), 230, w, h * 0.55);
		glow = glowSprite(256, [255, 150, 60], [0.9, 0.28, 0]);
		mist = cloudSprite(640, 120, 9, q.mist ? [q.mist[0], q.mist[1], q.mist[2]] : [200, 200, 220], dark ? 0.14 : 0.3);
		L.moon = glowSprite(256, dark ? [190, 205, 255] : [255, 230, 190], [0.8, 0.2, 0]);
	}

	function build(s) {
		const { w, h } = s, lw = w + MX * 2;
		const waterY = Math.round(h * 0.68);
		L = { waterY };
		L.farGeo = ridgeGeo({ w: lw, h, baseY: h * 0.6, amp: h * 0.3, scale: w * 0.26, seed: 14, power: 1.15, x0: 1.1 });
		L.midGeo = ridgeGeo({ w: lw, h, baseY: h * 0.655, amp: h * 0.1, scale: w * 0.16, seed: 33, power: 1.2 });
		L.midForest = forestGeo({ w: lw, h, ridge: L.midGeo, rows: 3, rowGap: 6, tree: [9, 15], gap: [4, 7], seed: 3, bottom: waterY });
		L.hillGeo = ridgeGeo({ w: lw, h, baseY: h * 0.69, amp: h * 0.035, scale: w * 0.1, seed: 5, power: 1.1 });
		L.hillForest = forestGeo({ w: lw, h, ridge: L.hillGeo, rows: 2, rowGap: 6, tree: [14, 22], gap: [5, 8], seed: 6, bottom: waterY });
		// fire sits in the left margin on a shore promontory
		L.fx = w * 0.115; L.fy = h * 0.865;
		L.landTop = h * 0.78; L.landX1 = w * 0.36;
		L.landY = (x) => lerp(L.landTop + Math.sin(x * 0.03) * 2, h + 30, Math.pow(clamp((x + 120) / (L.landX1 + 120)), 2.6));
		L.landR = (x) => lerp(h + 30, waterY + h * 0.2, Math.pow(clamp((x - (w * 0.9)) / (w * 0.2 + 120)), 1.2));
		trees.trees.length = 0;
		const r = rng(88);
		for (let i = 0; i < 9; i++) {
			const x = lerp(-20, w * 0.3, (i + r() * 0.8) / 9);
			if (Math.abs(x - L.fx) < 14) continue;
			trees.add(x, L.landY(x) + 8 + r() * 10, h * lerp(0.46, 0.2, i / 9) * (0.8 + r() * 0.4), { b: (r() * 3) | 0, grp: "fg", ww: 0.9 + r() * 0.3 });
		}
		for (let i = 0; i < 6; i++) {
			const x = lerp(w * 0.86, w + 30, (i + r()) / 6);
			trees.add(x, L.landR(x) + 8, h * lerp(0.26, 0.45, i / 6) * (0.8 + r() * 0.4), { b: (r() * 3) | 0, grp: "fg", ww: 0.9 + r() * 0.3 });
		}
		trees.trees.sort((a, b) => a.y - b.y);
		rebuildLayers(s);
		flock.resize(w, h);
		fuel = 0.7; I = 0.7;
		if (s.reduced) { flock.settle(env(s), 8); }
	}

	const DEPTH = { far: 5, mid: 11, hills: 18, fg: 46 };
	const offs = (s) => { const o = {}; for (const k in DEPTH) o[k] = [-s.px * DEPTH[k], -s.scrollT * DEPTH[k] * 0.8 - s.py * DEPTH[k] * 0.1]; return o; };

	function perchList(s) {
		const o = offs(s).fg, out = [];
		for (const t of trees.trees) {
			if (t.h < s.h * 0.2) continue;
			const [cx, cy] = trees.crown(t, s.t, 0.5);
			out.push({ x: cx + o[0], y: cy + o[1] + 3 });
			const f = 0.62, b = trees.bend(t, s.t, 0.5);
			out.push({ x: t.x + o[0] + b * t.h * Math.pow(f, 1.7) + t.h * 0.11 * t.ww, y: t.y - t.h * f + o[1] });
		}
		return out;
	}
	function env(s) { return { wind: 0.5, perches: perchList(s), pointer: s.pointer, calm: 1 }; }

	function throwLog(x0, y0, s) {
		const T = 0.85, g = 900;
		const tx = L.fx + (Math.random() - 0.5) * 24, ty = L.fy - 12;
		if (s.reduced) { land({ x: tx, y: ty }, s); s.invalidate(); if (!tapped) { tapped = true; hint.hide(); } return; }
		thrown.push({ x: x0, y: y0, vx: (tx - x0) / T, vy: (ty - y0 - 0.5 * g * T * T) / T, rot: 0, vr: (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 5), life: 0, T });
		if (!tapped) { tapped = true; hint.hide(); }
	}
	function land(lg, s) {
		fuel = Math.min(1.5, fuel + 0.38);
		const n = s.reduced ? 0 : 34;
		for (let i = 0; i < n; i++) {
			const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, sp = 50 + Math.random() * 190;
			sparks.emit(L.fx + (Math.random() - 0.5) * 24, L.fy - 14, Math.cos(a) * sp, Math.sin(a) * sp, 0.9 + Math.random() * 1.8, 1 + Math.random() * 1.4, 0, Math.random() < 0.3 ? 1 : 0);
		}
		if (!s.reduced) flock.scare(L.fx, L.fy - 120, 420, 0.9);
		flares = 1;
	}

	function update(dt, s) {
		if (s.reduced) { I = clamp(fuel, 0.1, 1.2); return; }
		fuel = Math.max(0.12, fuel - dt * 0.016);
		I += (clamp(fuel, 0.1, 1.2) - I) * (1 - Math.exp(-dt * 2.5));
		flick = s.t;
		flares = Math.max(0, flares - dt);
		flock.update(dt, env(s));
		trees.update(dt);
		for (let i = thrown.length - 1; i >= 0; i--) {
			const lg = thrown[i];
			lg.life += dt; lg.vy += 900 * dt; lg.x += lg.vx * dt; lg.y += lg.vy * dt; lg.rot += lg.vr * dt;
			if (lg.life >= lg.T) { land(lg, s); thrown.splice(i, 1); }
		}
		const rate = 5 + 50 * I;
		if (Math.random() < rate * dt) sparks.emit(L.fx + (Math.random() - 0.5) * 28 * I, L.fy - 30 - Math.random() * 20, (Math.random() - 0.5) * 40, -50 - Math.random() * 90 * I, 1 + Math.random() * 2, 0.8 + Math.random(), 0, Math.random() < 0.3 ? 1 : 0);
		sparks.step(dt, (p, d) => { p.vx += (Math.sin(s.t * 2.7 + p.r * 3) * 50 + 14) * d; p.vy += (6 - 20 * Math.sin(s.t + p.r)) * d; p.x += p.vx * d; p.y += p.vy * d; p.vx *= 1 - d * 0.4; if (p.y < -10) return false; });
		label.textContent = I > 1 ? "Fire: roaring" : I > 0.62 ? "Fire: crackling" : I > 0.3 ? "Fire: glowing" : "Fire: embers";
	}

	function flames(ctx, t, o) {
		const { fx, fy } = L;
		const x0 = fx + o[0], y0 = fy + o[1];
		const H0 = 40 + 110 * I, W0 = 18 + 24 * I;
		ctx.globalCompositeOperation = "lighter";
		const layers = [[1, "rgba(220,70,20,.5)"], [0.7, "rgba(255,140,40,.6)"], [0.4, "rgba(255,225,130,.7)"]];
		for (const [k, col] of layers) {
			ctx.fillStyle = col;
			ctx.beginPath();
			for (let i = 0; i < 6; i++) {
				const bx = x0 + (i - 2.5) * W0 * 0.34;
				const f = Math.sin(t * (7 + i * 1.3) + i * 2) * 0.5 + Math.sin(t * (11 + i) + i) * 0.3;
				const H = H0 * k * (0.62 + 0.38 * (1 - Math.abs(i - 2.5) / 3)) * (1 + f * 0.22);
				const sway = Math.sin(t * 3 + i) * 5 * k + f * 6;
				const wd = W0 * 0.34 * k * 1.25;
				ctx.moveTo(bx - wd, y0);
				ctx.quadraticCurveTo(bx - wd * 0.8 + sway * 0.4, y0 - H * 0.55, bx + sway, y0 - H);
				ctx.quadraticCurveTo(bx + wd * 0.8 + sway * 0.4, y0 - H * 0.5, bx + wd, y0);
			}
			ctx.fill();
		}
		ctx.globalCompositeOperation = "source-over";
	}

	function draw(ctx, s) {
		const { w, h } = s, t = s.t, p = pal(), q = cp(), o = offs(s), wy = L.waterY + o.hills[1];
		const fx = L.fx + o.fg[0], fy = L.fy + o.fg[1];
		const fl = reducedFlick(s);
		const Ie = I * (1 + (Math.sin(fl * 9) * 0.5 + Math.sin(fl * 17.3) * 0.3) * 0.05);
		ctx.drawImage(L.sky.c, 0, 0, w, h);
		if (dark) drawStars(ctx, stars, t, 1, [225, 232, 255], o.far[0] * 0.3, o.far[1] * 0.3);
		const mx = w * 0.88 + o.far[0] * 0.4, my = h * 0.2 + o.far[1] * 0.4;
		ctx.globalAlpha = dark ? 0.8 : 0.9;
		if (dark) { ctx.drawImage(L.moon, mx - 150, my - 150, 300, 300); ctx.globalAlpha = 1; ctx.fillStyle = "rgba(232,238,255,.95)"; ctx.beginPath(); ctx.arc(mx, my, 15, 0, TAU); ctx.fill(); }
		else { const sx = w * 0.86, sy = h * 0.55; ctx.drawImage(L.moon, sx - 220, sy - 220, 440, 440); ctx.globalAlpha = 1; }
		ctx.globalAlpha = 1;
		ctx.drawImage(L.far.c, -MX + o.far[0], o.far[1], L.far.w, L.far.h);
		ctx.drawImage(mist, ((t * 5) % (w + 700)) - 500, h * 0.55 + o.mid[1], 640, 120);
		drawSheared(ctx, L.mid, -MX + o.mid[0], o.mid[1], { bands: 8, amp: 1.2, t, phase: 1, wind: 0.5 });
		drawSheared(ctx, L.hills, -MX + o.hills[0], o.hills[1], { bands: 8, amp: 2, t, phase: 2, wind: 0.5 });
		// water
		ctx.fillStyle = p.water;
		ctx.fillRect(0, wy, w, h - wy);
		const R = L.refl, rx = R.x;
		rx.setTransform(s.dpr, 0, 0, -s.dpr, 0, s.dpr * L.waterY);
		rx.clearRect(0, -h, w, h * 3);
		rx.drawImage(L.sky.c, 0, 0, w, h);
		rx.drawImage(L.far.c, -MX + o.far[0], o.far[1] - o.hills[1], L.far.w, L.far.h);
		rx.drawImage(L.mid.c, -MX + o.mid[0], o.mid[1] - o.hills[1], L.mid.w, L.mid.h);
		rx.drawImage(L.hills.c, -MX + o.hills[0], 0, L.hills.w, L.hills.h);
		drawReflectionStrips(ctx, R, { y: wy, w, depth: h - wy, t, amp: 1.8, strip: 3, alpha: 0.7, fadeTo: 0.25 });
		const g = ctx.createLinearGradient(0, wy, 0, h);
		g.addColorStop(0, rgba(q.waterTop, 0.2));
		g.addColorStop(1, rgba(q.waterBot, 0.78));
		ctx.fillStyle = g;
		ctx.fillRect(0, wy, w, h - wy);
		// fire reflection streaks on the water
		ctx.globalCompositeOperation = "lighter";
		const gl = p.glow * (0.4 + 0.6 * Ie);
		for (let i = 0; i < 70; i++) {
			const f = (i * 0.6180339) % 1;
			const yy = wy + 6 + f * (h - wy - 8);
			const dist = (yy - wy) / (h - wy);
			const spread = 40 + 160 * (1 - dist * 0.3);
			const xx = fx + 150 + Math.sin(i * 7.7) * spread * (0.5 + f) + (Math.sin(t * 1.5 + i) * 4);
			const a = (0.25 + 0.75 * Math.max(0, Math.sin(t * (1.6 + (i % 5) * 0.4) + i * 2.3))) * gl * (1 - Math.abs(xx - fx - 150) / (spread * 2 + 40)) * 1.1;
			if (a <= 0) continue;
			ctx.fillStyle = `rgba(255,${150 + (i % 4) * 20},70,${a.toFixed(3)})`;
			ctx.fillRect(xx, yy, 6 + f * 16 * (1 + (i % 3) * 0.4), 1 + f * 1.6);
		}
		ctx.globalCompositeOperation = "source-over";
		// land + warm lit trees
		const R1 = 260 + 420 * Ie;
		const warm = (rad) => {
			const gr = ctx.createRadialGradient(fx, fy - 40, 0, fx, fy - 40, rad);
			return gr;
		};
		const landG = warm(R1);
		const lc = q.land, wk = [255, 130, 50];
		const mixw = (c, a) => rgba([lerp(c[0], wk[0], a), lerp(c[1], wk[1], a), lerp(c[2], wk[2], a)]);
		landG.addColorStop(0, mixw(lc[0], 0.3 * Ie * p.glow));
		landG.addColorStop(0.55, mixw(lc[0], 0.07 * Ie * p.glow));
		landG.addColorStop(1, rgba(lc[1]));
		ctx.fillStyle = landG;
		ctx.beginPath();
		ctx.moveTo(-120 + o.fg[0], h + 40);
		for (let x = -120; x <= L.landX1 + 20; x += 6) ctx.lineTo(x + o.fg[0], L.landY(x) + o.fg[1]);
		ctx.lineTo(L.landX1 + 20 + o.fg[0], h + 40);
		ctx.fill();
		const rr = ctx.createLinearGradient(0, h * 0.7, 0, h);
		rr.addColorStop(0, rgba(lc[0])); rr.addColorStop(1, rgba(lc[1]));
		ctx.fillStyle = rr;
		ctx.beginPath();
		ctx.moveTo(w * 0.88 + o.fg[0], h + 40);
		for (let x = w * 0.88; x <= w + 120; x += 6) ctx.lineTo(x + o.fg[0], L.landR(x) + o.fg[1]);
		ctx.lineTo(w + 120 + o.fg[0], h + 40);
		ctx.fill();
		const tcols = [0, 1, 2].map((b) => {
			const gr = ctx.createRadialGradient(fx, fy - 60, 0, fx, fy - 60, R1 * (0.8 + b * 0.15));
			const base = q.fg[b];
			gr.addColorStop(0, mixw(base, 0.34 * Ie * p.glow));
			gr.addColorStop(0.5, mixw(base, 0.09 * Ie * p.glow));
			gr.addColorStop(1, rgba(base));
			return gr;
		});
		trees.draw(ctx, t, 0.5, tcols, { ox: o.fg[0], oy: o.fg[1] });
		// fire: logs, flames, glow
		const wood = p.wood;
		ctx.save();
		ctx.translate(fx, fy);
		const nlog = Math.min(6, 3 + Math.floor(fuel * 2.4));
		for (let i = 0; i < nlog; i++) {
			const a = (i / nlog) * Math.PI + 0.12, ox = Math.cos(a) * 26, oy = -Math.abs(Math.sin(a)) * 6 - (i % 2) * 5;
			ctx.save();
			ctx.translate(ox * 0.8, oy);
			ctx.rotate(((i % 2 ? -1 : 1) * 0.35) + (i - nlog / 2) * 0.12);
			ctx.fillStyle = `rgb(${wood[0] + 30 * Ie},${wood[1] + 6},${wood[2]})`;
			ctx.beginPath(); ctx.roundRect(-24, -4, 48, 8, 4); ctx.fill();
			ctx.fillStyle = `rgba(255,${100 + 60 * Ie},40,${0.35 + 0.4 * Ie})`;
			ctx.fillRect(-18, -4, 36, 1.5);
			ctx.restore();
		}
		ctx.restore();
		flames(ctx, t, o.fg);
		ctx.globalCompositeOperation = "lighter";
		const gr = (250 + 520 * Ie) * (1 + Math.sin(fl * 11) * 0.015);
		ctx.globalAlpha = clamp(0.5 * p.glow * (0.5 + Ie * 0.6), 0, 0.85);
		ctx.drawImage(glow, fx - gr, fy - 50 - gr, gr * 2, gr * 2);
		ctx.globalAlpha = clamp(0.5 * p.glow, 0, 0.8);
		ctx.drawImage(glow, fx - 60 * (0.6 + Ie), fy - 60 - 60 * Ie, 120 * (0.6 + Ie), 120 * (0.6 + Ie));
		ctx.globalAlpha = 1;
		ctx.globalCompositeOperation = "source-over";
		// birds
		flock.draw(ctx, p.bird);
		// thrown logs
		for (const lg of thrown) {
			ctx.save();
			ctx.translate(lg.x, lg.y); ctx.rotate(lg.rot);
			ctx.fillStyle = `rgb(${wood[0] + 14},${wood[1] + 6},${wood[2] + 4})`;
			ctx.beginPath(); ctx.roundRect(-22, -4.5, 44, 9, 4); ctx.fill();
			ctx.fillStyle = "rgba(255,170,90,.45)"; ctx.fillRect(14, -3, 6, 6);
			ctx.restore();
		}
		// sparks
		ctx.globalCompositeOperation = "lighter";
		for (let i = 0; i < sparks.n; i++) {
			const sp = sparks.a[i], f = sp.life / sp.max;
			ctx.fillStyle = sp.c ? `rgba(255,220,140,${f})` : `rgba(255,${100 + 90 * f | 0},40,${f})`;
			const sz = sp.s * (0.5 + f * 0.7);
			ctx.fillRect(sp.x - sz / 2, sp.y - sz / 2, sz, sz);
		}
		ctx.globalCompositeOperation = "source-over";
	}
	const reducedFlick = (s) => (s.reduced ? 3.3 : s.t);

	onEmptyTap(stage, (cx, cy) => {
		const [x, y] = stage.toLocal(cx, cy);
		throwLog(x, y, stage);
	});
	const btn = ui.querySelector(".fk-add");
	const onBtn = () => throwLog(stage.w * 0.55, stage.h * 0.3, stage);
	btn.addEventListener("click", onBtn);

	return () => { btn.removeEventListener("click", onBtn); stage.destroy(); unwatch(); };
}
