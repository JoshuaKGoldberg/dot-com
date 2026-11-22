import { createStage, canvasLayer, ridgeGeo, forestGeo, makePineVariants, LiveTrees, Flock, Ripples, Pool, drawSheared, onEmptyTap, addHint, addUI, isDark, watchDark, hex, rgba, clamp, lerp, smooth, rng, TAU } from "./forest-kit/kit.js";

const LIGHT = { paper: hex("#f0e8d4"), ink: hex("#4a647e"), deep: hex("#2e4259"), sun: hex("#c99238"), cut: hex("#f0e8d4"), bird: hex("#1f2f45"), fg: hex("#243449"), la: [0.2, 0.3, 0.42] };
const DARK = { paper: hex("#111a2e"), ink: hex("#5f8e92"), deep: hex("#6a979b"), sun: hex("#efe2c4"), cut: hex("#111a2e"), bird: hex("#efe2c4"), fg: hex("#0a1222"), la: [0.2, 0.3, 0.42] };

export function activate({ root, reducedMotion }) {
	let dark = isDark();
	let C = dark ? DARK : LIGHT;
	let rainOn = false, rain = 0, gust = 0;
	const hint = addHint(root, reducedMotion ? "Toggle rain with the button" : "Click a pine to shake it · click the lake · toggle rain");
	const ui = addUI(root, `<span>Weather</span><button type="button" aria-pressed="false">Rain</button>`, "rain");
	const rainBtn = ui.querySelector("button");
	const variants = makePineVariants(97, 8);
	const trees = new LiveTrees(variants);
	const ripples = new Ripples(26);
	const birds = new Flock({ seed: 4, groups: 3, perGroup: [4, 7], size: [6, 10], band: [0.1, 0.4], speed: [40, 66], respawn: [1.5, 6], flap: [4.5, 6.5] });
	const geese = new Flock({ seed: 9, groups: 1, perGroup: [5, 6], size: [9, 11], band: [0.08, 0.2], speed: [32, 40], formation: "v", respawn: [12, 24], flap: [2.2, 2.8] });
	birds.addResidents(5, [5.5, 7.5]);
	const drops = Array.from({ length: 130 }, () => ({ x: 0, y: 0, v: 1, end: 0, on: false }));
	let L = null, lens = [], clouds = [], sunSprite = null, wobT = 0;
	const MX = 50;
	const stage = createStage(root, { reducedMotion, build, draw, update });
	const unwatch = watchDark((d) => { dark = d; C = d ? DARK : LIGHT; if (stage.ready) { rebuildStatic(stage); setGrain(); stage.invalidate(); } });

	const setGrain = () => {
		const c = document.createElement("canvas");
		c.width = c.height = 160;
		const x = c.getContext("2d"), r = rng(5);
		for (let i = 0; i < 900; i++) {
			x.fillStyle = r() < 0.5 ? rgba(dark ? [255, 245, 220] : [90, 70, 40], 0.05 + r() * 0.07) : rgba(dark ? [0, 0, 10] : [255, 250, 235], 0.1 + r() * 0.1);
			const s = 0.6 + r() * 1.6;
			x.fillRect(r() * 160, r() * 160, s, s * (0.5 + r()));
		}
		root.querySelector(".scenery-c").style.backgroundImage = `url(${c.toDataURL()})`;
	};

	function paintLayer(lay, geo, a, hatch, pines, treeA, seed) {
		const x = lay.x, r = rng(seed);
		const { ys, step, n, w, h } = geo;
		x.fillStyle = rgba(C.ink, a);
		x.beginPath(); x.moveTo(0, h);
		for (let i = 0; i < n; i++) x.lineTo(i * step, ys[i]);
		x.lineTo(w, h); x.closePath(); x.fill();
		// gouge hatching
		x.strokeStyle = rgba(C.cut, 1); x.lineWidth = 1.6; x.lineCap = "round";
		x.beginPath();
		for (let px = 5; px < w; px += 12) {
			const top = geo.yAt(px);
			for (let k = 0; k < 6; k++) {
				if (r() > hatch - k * 0.07) continue;
				const yy = top + 12 + k * 14 + r() * 6, len = 5 + r() * 7;
				x.moveTo(px, yy); x.lineTo(px + len * 0.55, yy + len);
			}
		}
		x.stroke();
		if (pines) {
			x.fillStyle = rgba(dark ? C.ink : C.deep, treeA);
			x.beginPath();
			for (const t of pines.trees) {
				const p = variants[t.v % variants.length];
				x.moveTo(t.x + p[0] * t.h, t.y + p[1] * t.h);
				for (let i = 2; i < p.length; i += 2) x.lineTo(t.x + p[i] * t.h, t.y + p[i + 1] * t.h);
				x.closePath();
			}
			x.fill();
			x.strokeStyle = rgba(C.cut, 0.9); x.lineWidth = 0.9;
			x.beginPath();
			for (const t of pines.trees) { if (t.h < 14) continue; x.moveTo(t.x - t.h * 0.06, t.y - t.h * 0.75); x.lineTo(t.x - t.h * 0.12, t.y - t.h * 0.3); }
			x.stroke();
		}
	}
	function rebuildStatic(s) {
		const { w, h, dpr } = s;
		const lw = w + MX * 2;
		L.layers = L.geos.map((g, i) => {
			const lay = canvasLayer(lw, h, dpr);
			paintLayer(lay, g, C.la[i] * (dark ? 0.85 : 1), [0.3, 0.34, 0.4][i], i > 0 ? L.forests[i - 1] : null, [0, 0.55, 0.7][i], 40 + i);
			return lay;
		});
		// sun / moon sprite (rotates slowly)
		const S = 340, sp = canvasLayer(S, S, dpr), x = sp.x, c = S / 2, rr = 62;
		x.fillStyle = rgba(C.sun, 1);
		x.beginPath(); x.arc(c, c, rr, 0, TAU); x.fill();
		const rd = rng(8);
		for (let i = 0; i < 36; i++) {
			const a = (i / 36) * TAU, long = i % 2 === 0, r0 = rr + 10, r1 = r0 + (long ? 38 + rd() * 14 : 14 + rd() * 7), wd = long ? 0.05 : 0.034;
			x.beginPath();
			x.moveTo(c + Math.cos(a - wd) * r0, c + Math.sin(a - wd) * r0); x.lineTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1); x.lineTo(c + Math.cos(a + wd) * r0, c + Math.sin(a + wd) * r0);
			x.closePath(); x.fill();
		}
		x.strokeStyle = rgba(C.cut, 1); x.lineWidth = 2.6; x.setLineDash([60, 8, 26, 12]);
		for (const k of [0.72, 0.48]) { x.beginPath(); x.arc(c, c, rr * k, 0, TAU); x.stroke(); }
		x.setLineDash([]);
		if (dark) { x.fillStyle = rgba(C.paper, 1); x.beginPath(); x.arc(c + 26, c - 10, rr * 0.86, 0, TAU); x.fill(); }
		L.sun = sp;
	}

	function build(s) {
		const { w, h } = s;
		const lw = w + MX * 2;
		const waterY = Math.round(h * 0.78);
		L = { waterY };
		const defs = [[0.62, 0.16, 0.22, 12, 7, 1.15, 2.3], [0.69, 0.09, 0.15, 15, 21, 1.2, 0], [0.75, 0.05, 0.1, 19, 33, 1.1, 0]];
		L.geos = defs.map(([b, am, sc, step, seed, pw, x0]) => ridgeGeo({ w: lw, h, baseY: h * b, amp: h * am * 1.7, scale: w * sc, seed, power: pw, step, detail: 0.02, x0 }));
		L.forests = [forestGeo({ w: lw, h, ridge: L.geos[1], rows: 2, rowGap: 8, tree: [10, 17], gap: [6, 10], seed: 61, bottom: waterY }), forestGeo({ w: lw, h, ridge: L.geos[2], rows: 2, rowGap: 9, tree: [16, 28], gap: [8, 13], seed: 71, bottom: waterY })];
		const r = rng(97);
		trees.trees.length = 0;
		for (let x = -30; x < w + 30; x += 20 + r() * 26) trees.add(x, waterY + r() * 4, h * (0.035 + r() * 0.05), { b: 0, grp: "shore", ww: 0.9 + r() * 0.3 });
		L.landL = { x1: w * 0.27, top: waterY - h * 0.04, seed: 2 };
		L.landR = { x1: w * 0.76, top: waterY - h * 0.03, seed: 5 };
		L.landY = (side, x) => {
			const A = side === "l" ? L.landL : L.landR;
			const u = side === "l" ? (x + 120) / (A.x1 + 120) : (w + 120 - x) / (w + 120 - A.x1);
			return lerp(A.top, h + 20, Math.pow(clamp(u), 2.2)) + Math.sin(x * 0.09 + A.seed) * 3;
		};
		L.landRegion = (side) => (side === "l" ? [-120, L.landL.x1 + 20] : [L.landR.x1 - 20, w + 120]);
		const place = (side, n) => { for (let i = 0; i < n; i++) { const t = (i + r()) / n; const x = side === "l" ? lerp(-30, w * 0.24, Math.pow(t, 0.8)) : lerp(w + 30, w * 0.8, Math.pow(t, 0.8)); trees.add(x, L.landY(side, x) + 10 + r() * 10, h * lerp(0.46, 0.17, Math.pow(t, 0.7)) * (0.85 + r() * 0.3), { b: 0, grp: "fg", ww: 0.85 + r() * 0.35 }); } };
		place("l", 8); place("r", 8);
		trees.trees.sort((a, b) => a.y - b.y);
		// ripple lenses on the lake
		lens = [];
		let y = waterY + 8, row = 0;
		while (y < h + 6) {
			const tt = (y - waterY) / (h - waterY);
			let x = -r() * 120;
			while (x < w + 160) {
				const len = (22 + r() * 80) * (0.6 + tt * 1.5);
				if (r() > 0.14) lens.push({ x, y: y + (r() - 0.5) * 2, len, th: 1.4 + tt * 4, sp: (row % 2 ? 1 : -1) * (2 + tt * 5) * (0.6 + r() * 0.8), ph: r() * 6 });
				x += len + (12 + r() * 52) * (0.7 + tt);
			}
			y += 8 + Math.pow(tt, 1.5) * 28 + r() * 4;
			row++;
		}
		clouds = Array.from({ length: 9 }, (_, i) => ({ y: h * 0.1 + i * 20 + r() * 8, x: r() * w, len: 90 + r() * 240, sp: 3 + r() * 5 }));
		rebuildStatic(s);
		setGrain();
		birds.resize(w, h); geese.resize(w, h);
		if (s.reduced) birds.settle(env(s), 6);
	}

	const DEPTH = { far: 4, mid: 9, near: 15, shore: 24, fg: 44 };
	const offs = (s) => { const o = {}; for (const k in DEPTH) o[k] = [-s.px * DEPTH[k], -s.scrollT * DEPTH[k] * 0.6]; return o; };
	function env(s) {
		const o = offs(s);
		return { wind: (0.8 + gust) * (1 + rain * 1.2), pointer: s.pointer, calm: 1 - rain * 0.85, perches: trees.trees.filter((t) => t.grp === "fg" && t.h > s.h * 0.18).map((t) => { const c = trees.crown(t, s.t, 0.8); return { x: c[0] + o.fg[0], y: c[1] + o.fg[1] + 4 }; }) };
	}
	function update(dt, s) {
		rain += ((rainOn ? 1 : 0) - rain) * (1 - Math.exp(-dt * (s.reduced ? 60 : 1.6)));
		if (Math.abs(rain - (rainOn ? 1 : 0)) < 0.004) rain = rainOn ? 1 : 0;
		if (s.reduced) return;
		gust = Math.max(0, gust - dt * 0.6);
		const e = env(s);
		birds.update(dt, e);
		geese.update(dt, { wind: e.wind, perches: [], calm: e.calm });
		trees.update(dt);
		ripples.step(dt);
		wobT += dt;
		if (rain > 0.05) {
			for (const d of drops) {
				if (!d.on) { if (Math.random() < dt * 9 * rain) { d.on = true; d.x = Math.random() * (s.w + 120) - 20; d.y = -20; d.v = 480 + Math.random() * 200; d.end = Math.random() < 0.5 ? L.waterY + 8 + Math.random() * (s.h - L.waterY - 10) : s.h * (0.2 + Math.random() * 0.6); } continue; }
				d.y += d.v * dt; d.x -= d.v * 0.22 * dt;
				if (d.y >= d.end) { d.on = false; if (d.end > L.waterY && ripples.list.length < 20 && Math.random() < 0.5) ripples.add(d.x, d.end, 0.5, 0.45); }
			}
		}
	}

	function draw(ctx, s) {
		const { w, h } = s, t = s.t, o = offs(s);
		const wy = L.waterY + o.shore[1];
		const wind = (0.8 + gust) * (1 + rain * 1.2);
		ctx.fillStyle = rgba(C.paper); ctx.fillRect(0, 0, w, h);
		// cloud strokes
		ctx.fillStyle = rgba(C.ink, 0.2 + rain * 0.12);
		for (const c of clouds) {
			const x = ((c.x + t * c.sp * (1 + rain)) % (w + 400)) - 300;
			ctx.beginPath(); ctx.moveTo(x, c.y); ctx.quadraticCurveTo(x + c.len / 2, c.y - 4, x + c.len, c.y); ctx.quadraticCurveTo(x + c.len / 2, c.y + 2.5 + rain * 3, x, c.y); ctx.fill();
		}
		if (rain > 0.02) { const rg = ctx.createLinearGradient(0, 0, 0, wy * 0.75); rg.addColorStop(0, rgba(C.ink, 0.16 * rain)); rg.addColorStop(1, rgba(C.ink, 0)); ctx.fillStyle = rg; ctx.fillRect(0, 0, w, wy * 0.75); }
		// sun/moon, slowly turning
		const sx = w * 0.88 + o.far[0] * 0.4, sy = h * 0.2 + o.far[1] * 0.4;
		ctx.save(); ctx.translate(sx, sy); ctx.rotate(t * 0.025); ctx.globalAlpha = (dark ? 0.6 : 0.62) * (1 - rain * 0.55);
		const sz = Math.min(300, h * 0.4);
		ctx.drawImage(L.sun.c, -sz / 2, -sz / 2, sz, sz);
		ctx.restore(); ctx.globalAlpha = 1;
		// hills
		const [a, b, c] = L.layers;
		ctx.drawImage(a.c, -MX + o.far[0], o.far[1], a.w, a.h);
		drawSheared(ctx, b, -MX + o.mid[0], o.mid[1], { bands: 8, amp: 2 * wind, t, phase: 1, wind: 0.6 });
		drawSheared(ctx, c, -MX + o.near[0], o.near[1], { bands: 10, amp: 3.4 * wind, t, phase: 2, wind: 0.8 });
		// lake: paper sheet + carved ripples
		ctx.fillStyle = rgba(C.paper); ctx.fillRect(0, wy, w, h - wy);
		const gx = sx - o.far[0] * 0.4;
		ctx.fillStyle = rgba(C.ink, (dark ? 0.55 : 0.46) * (1 - rain * 0.2));
		const sunLens = [];
		ctx.beginPath();
		for (const q of lens) {
			let x = q.x + (t * q.sp * (1 + rain * 2)) % (w + 300);
			x = ((x % (w + 300)) + w + 300) % (w + 300) - 100;
			const tt = (q.y - L.waterY) / (h - L.waterY), yy = q.y + o.shore[1];
			if (Math.abs(x + q.len / 2 - gx) < 40 + tt * 150) { sunLens.push([x, yy, q]); continue; }
			const th = q.th * (1 + Math.sin(t * 1.3 + q.ph) * 0.2 + rain * 0.5);
			ctx.moveTo(x, yy); ctx.quadraticCurveTo(x + q.len / 2, yy - th, x + q.len, yy); ctx.quadraticCurveTo(x + q.len / 2, yy + th * 0.55, x, yy);
		}
		ctx.fill();
		ctx.fillStyle = rgba(C.sun, 0.88);
		ctx.beginPath();
		for (const [x, yy, q] of sunLens) { const th = q.th * 1.35 * (1 + Math.sin(t * 1.3 + q.ph) * 0.25); ctx.moveTo(x, yy); ctx.quadraticCurveTo(x + q.len / 2, yy - th, x + q.len, yy); ctx.quadraticCurveTo(x + q.len / 2, yy + th * 0.55, x, yy); }
		ctx.fill();
		ripples.draw(ctx, { squash: 0.22, color: dark ? C.deep : C.deep, dark: C.ink });
		// bird reflections as short ink dabs
		birds.draw(ctx, [rgba(C.bird, 0.85), rgba(C.bird, 0.92), rgba(C.bird, 1)], { reflectY: wy, reflectAlpha: 0.2 });
		// shore pines, then foreground land + pines
		const treeCol = rgba(dark ? C.ink : C.deep, 0.78);
		trees.draw(ctx, t, wind, [treeCol, treeCol, treeCol], { ox: o.shore[0], oy: o.shore[1], filter: (q) => q.grp === "shore" });
		for (const side of ["l", "r"]) {
			const [a0, b0] = L.landRegion(side);
			ctx.beginPath(); ctx.moveTo(a0 + o.fg[0], h + 40);
			for (let x = a0; x <= b0; x += 8) ctx.lineTo(x + o.fg[0], L.landY(side, x) + o.fg[1]);
			ctx.lineTo(b0 + o.fg[0], h + 40); ctx.closePath();
			ctx.fillStyle = rgba(C.fg); ctx.fill();
		}
		const fgc = rgba(C.fg);
		trees.draw(ctx, t, wind, [fgc, fgc, fgc], { ox: o.fg[0], oy: o.fg[1], filter: (q) => q.grp === "fg" });
		// carved highlight lines on foreground pines
		ctx.strokeStyle = rgba(dark ? C.ink : C.cut, dark ? 0.75 : 0.6); ctx.lineWidth = 1.3; ctx.lineCap = "round";
		ctx.beginPath();
		for (const q of trees.trees) {
			if (q.grp !== "fg") continue;
			const L0 = trees.bend(q, t, wind), x0 = q.x + o.fg[0], y0 = q.y + o.fg[1];
			for (let k = 0; k < 3; k++) { const f1 = 0.25 + k * 0.2, f2 = f1 + 0.13; const X = (f) => x0 - q.h * q.ww * 0.17 * (1 - f * 0.4) + L0 * q.h * Math.pow(f, 1.7); ctx.moveTo(X(f1), y0 - q.h * f1); ctx.lineTo(X(f2) - 3, y0 - q.h * f2); }
		}
		ctx.stroke();
		geese.draw(ctx, [rgba(C.bird, 0.9), rgba(C.bird, 0.95), rgba(C.bird, 1)]);
		birds.draw(ctx, [rgba(C.bird, 0.85), rgba(C.bird, 0.92), rgba(C.bird, 1)]);
		// rain: slanting carved strokes
		if (rain > 0.02) {
			ctx.strokeStyle = rgba(dark ? C.deep : C.ink, 0.62 * Math.min(1, rain * 1.4)); ctx.lineWidth = 1.5; ctx.lineCap = "round";
			ctx.beginPath();
			for (const d of drops) { if (!d.on) continue; ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + 5, d.y - 17); }
			ctx.stroke();
		}
	}

	rainBtn.addEventListener("click", () => {
		rainOn = !rainOn; rainBtn.setAttribute("aria-pressed", rainOn); hint.hide();
		if (rainOn && !stage.reduced) birds.scare(stage.w * 0.5, stage.h * 0.4, 9999, 0.15);
		if (stage.reduced) { rain = rainOn ? 1 : 0; stage.invalidate(); }
	});
	onEmptyTap(stage, (cx, cy) => {
		if (stage.reduced) return;
		const [x, y] = stage.toLocal(cx, cy);
		const o = offs(stage), wind = (0.8 + gust) * (1 + rain * 1.2);
		let i = trees.hit(x, y, stage.t, wind, o.fg[0], o.fg[1], (q) => q.grp === "fg");
		if (i < 0) i = trees.hit(x, y, stage.t, wind, o.shore[0], o.shore[1], (q) => q.grp === "shore");
		hint.hide();
		if (i >= 0) {
			const tr = trees.trees[i], dir = Math.random() < 0.5 ? -1 : 1;
			tr.shakeV = dir * 1.2 * clamp(0.5 + 40 / tr.h, 0.5, 1.6);
			for (const q of trees.trees) { const d = Math.abs(q.x - tr.x); if (q !== tr && d < 110) q.shakeV += dir * 0.5 * (1 - d / 110); }
			const [cx2, cy2] = trees.crown(tr, stage.t, 0.8);
			birds.scare(cx2 + o.fg[0], cy2 + o.fg[1], 190); geese.scare(cx2, cy2, 120, 0.5);
		} else if (y > L.waterY + o.shore[1]) { ripples.add(x, y, 1, 1 + (y - L.waterY) / stage.h); birds.scare(x, y - 30, 90, 0.4); }
		else gust = Math.min(1.6, gust + 1);
	});
	return () => { stage.destroy(); unwatch(); };
}
