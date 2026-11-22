import { createStage, canvasLayer, ridgeGeo, paintRidge, forestGeo, makePineVariants, LiveTrees, Flock, Pool, drawSheared, drawReflectionStrips, cloudSprite, glowSprite, makeStars, drawStars, addHint, addUI, isDark, watchDark, hex, mixC, rgba, clamp, lerp, smooth, rng, TAU } from "./forest-kit/kit.js";

// ----- seasonal palettes (0 spring, .25 summer, .5 autumn, .75 winter, 1 spring) -----
const SEAS = [0, 0.25, 0.5, 0.75, 1];
const P = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Array.isArray(v) ? v.map((x) => (typeof x === "string" ? hex(x) : x)) : hex(v)]));
const spring = P({ skyT: "#8bbbe6", skyM: "#cfe3ee", skyH: "#f6e6e0", farT: "#8fb0c8", farB: "#d2e0ea", midT: "#7aa3b0", midB: "#bcd3d4", hillT: "#5f9488", hillB: "#8fb8a8", leaf: ["#9ccf7a", "#b6dc8f", "#e8b8cf"], pine: ["#3f6f55", "#386549", "#497a5c"], land: ["#2e5c3a", "#1f4630"], water: "#6a98ae", wTop: "#8fb7c8", wBot: "#2f6482" });
const summer = P({ skyT: "#4f94dc", skyM: "#9cc8ee", skyH: "#dcecf5", farT: "#86a1bd", farB: "#c9d8e3", midT: "#6f93a8", midB: "#b4cbd1", hillT: "#4f8a7c", hillB: "#7fa7a5", leaf: ["#3f7a45", "#4a8a4c", "#35693c"], pine: ["#2e5d49", "#285341", "#356b52"], land: ["#1d3a34", "#17302c"], water: "#5a9ab5", wTop: "#8fb7c8", wBot: "#2f6482" });
const autumn = P({ skyT: "#9fb0c8", skyM: "#d9d4cc", skyH: "#f2d7b0", farT: "#a398ae", farB: "#d8cdd0", midT: "#9a8a8c", midB: "#cdbfb0", hillT: "#9a6a40", hillB: "#c3a077", leaf: ["#d9822b", "#c4502a", "#e3b13a"], pine: ["#355a45", "#2e4f3d", "#3f664f"], land: ["#4d3a20", "#33271a"], water: "#66808f", wTop: "#8fa3ae", wBot: "#2f4d60" });
const winter = P({ skyT: "#aebdd4", skyM: "#d9e0ea", skyH: "#f0f1f5", farT: "#b7c5d8", farB: "#e2e9f1", midT: "#a9b9c9", midB: "#d5dfe8", hillT: "#8a9aa5", hillB: "#c1cdd4", leaf: ["#6b6258", "#5a5249", "#7a7168"], pine: ["#2c4a45", "#27413d", "#33544e"], land: ["#e4ecf3", "#c4d2e0"], water: "#a9c4d4", wTop: "#c9dce6", wBot: "#7fa0b6" });
const SETS = [spring, summer, autumn, winter, spring];
function pal(S) {
	let i = 1;
	while (i < SEAS.length - 1 && S > SEAS[i]) i++;
	const u = smooth(clamp((S - SEAS[i - 1]) / (SEAS[i] - SEAS[i - 1])));
	const a = SETS[i - 1], b = SETS[i];
	const m = (x, y) => (typeof x[0] === "number" ? mixC(x, y, u) : x.map((c, k) => mixC(c, y[k], u)));
	return Object.fromEntries(Object.keys(a).map((k) => [k, m(a[k], b[k])]));
}
const snowAmt = (S) => (S > 0.7 ? smooth(clamp((S - 0.7) / 0.09)) : S < 0.07 ? 1 - smooth(S / 0.07) : 0);
const leafAmt = (S) => (S < 0.04 ? 0.15 + S * 6 : S < 0.1 ? lerp(0.4, 1, (S - 0.04) / 0.06) : S < 0.52 ? 1 : S < 0.69 ? 1 - smooth((S - 0.52) / 0.17) : 0);
const night = (c, k) => mixC(c, [c[0] * 0.2 + 8, c[1] * 0.25 + 14, c[2] * 0.4 + 36], k);
const SNOW = [236, 243, 250];
const NAMES = ["Early spring", "Spring", "Early summer", "Summer", "Late summer", "Early autumn", "Autumn", "Late autumn", "Early winter", "Winter", "Deep winter", "Late winter"];
const seasonName = (S) => NAMES[Math.floor(clamp(S, 0, 0.9999) * 12)];

export function activate({ root, reducedMotion }) {
	let dk = isDark() ? 1 : 0, dkTarget = dk;
	let S = 0.22, Starget = 0.22, follow = true, painted = -1, paintedDk = -1;
	const hint = addHint(root, reducedMotion ? "Drag the slider to change the season" : "Scroll or drag the slider to move through the year");
	const ui = addUI(root, `<span>Season</span><input type="range" min="0" max="999" step="1" aria-label="Season" /><output></output><button type="button" aria-pressed="true" title="Let page scroll drive the season">Scroll</button>`, "seasons");
	const slider = ui.querySelector("input"), out = ui.querySelector("output"), followBtn = ui.querySelector("button");
	const syncUI = () => { slider.value = Math.round(clamp(S) * 999); out.textContent = seasonName(S); };

	const variants = makePineVariants(93, 8);
	const trees = new LiveTrees(variants);
	const birches = [];
	const parts = new Pool(260);
	const swallows = new Flock({ seed: 5, groups: 3, perGroup: [5, 8], size: [3.8, 6.2], band: [0.1, 0.44], speed: [46, 78], respawn: [1, 5], flap: [6, 9] });
	const geese = new Flock({ seed: 21, groups: 2, perGroup: [5, 7], size: [7, 8.5], band: [0.08, 0.26], speed: [36, 46], formation: "v", respawn: [3, 6], flap: [2.4, 3] });
	swallows.addResidents(6, [4.5, 6]);
	let L = null, stars = [], mist = null, glow = null;
	const MX = 60;
	const stage = createStage(root, { reducedMotion, build, draw, update });
	const unwatch = watchDark((d) => { dkTarget = d ? 1 : 0; if (stage.reduced) { dk = dkTarget; stage.invalidate(); } });
	syncUI();

	// ---- layer painting ----
	function paintMixed(x, geo, pine, leaf, sn, lf) {
		const pineT = [], leafT = [];
		for (const t of geo.trees) (t.bare ? leafT : pineT).push(t);
		if (sn > 0.02) {
			x.fillStyle = rgba(SNOW, 0.95 * sn);
			x.beginPath();
			for (const t of pineT) { const p = variants[t.v % variants.length]; const dy = -t.h * 0.05; x.moveTo(t.x + p[0] * t.h, t.y + p[1] * t.h + dy); for (let i = 2; i < p.length; i += 2) x.lineTo(t.x + p[i] * t.h, t.y + p[i + 1] * t.h + dy); x.closePath(); }
			x.fill();
		}
		for (let b = 0; b < 3; b++) {
			x.fillStyle = rgba(pine[b]);
			x.beginPath();
			for (const t of pineT) { if (t.b !== b) continue; const p = variants[t.v % variants.length]; x.moveTo(t.x + p[0] * t.h, t.y + p[1] * t.h); for (let i = 2; i < p.length; i += 2) x.lineTo(t.x + p[i] * t.h, t.y + p[i + 1] * t.h); x.closePath(); }
			x.fill();
		}
		for (let b = 0; b < 3; b++) {
			x.fillStyle = rgba(leaf[b], lf > 0.3 ? 1 : 0.55 + lf);
			x.beginPath();
			for (const t of leafT) {
				if (t.b !== b) continue;
				const r = t.h * 0.3 * (0.6 + 0.4 * Math.max(lf, 0.5)), cy = t.y - t.h * 0.58;
				x.moveTo(t.x + r, cy); x.arc(t.x, cy, r, 0, TAU);
				x.moveTo(t.x - r * 0.7 + r * 0.7, cy + r * 0.3); x.arc(t.x - r * 0.75, cy + r * 0.35, r * 0.7, 0, TAU);
				x.moveTo(t.x + r * 0.75 + r * 0.7, cy + r * 0.3); x.arc(t.x + r * 0.75, cy + r * 0.35, r * 0.7, 0, TAU);
			}
			x.fill();
		}
	}
	function repaint(s) {
		const { w, h, dpr } = s;
		const p = pal(S), sn = snowAmt(S), lf = leafAmt(S);
		const nz = (c) => (dk > 0.01 ? night(c, dk) : c);
		const nzl = (a) => a.map(nz);
		const mk = (geo, top, bot, shade, forest, pine, leaf) => {
			const lay = canvasLayer(w + MX * 2, h, dpr);
			paintRidge(lay.x, geo, { top: nz(top), bottom: nz(bot), shade: nz(shade), lit: null, depth: 70, light: 1 });
			if (forest) paintMixed(lay.x, forest, nzl(pine), nzl(leaf), sn, lf);
			return lay;
		};
		const farTop = mixC(p.farT, SNOW, sn * 0.5);
		L.far = mk(L.farGeo, farTop, p.farB, mixC([90, 117, 149], [140, 160, 190], sn), null);
		L.mid = mk(L.midGeo, mixC(p.midT, SNOW, sn * 0.4), p.midB, [74, 109, 133], L.midForest, p.pine, p.leaf);
		L.hills = mk(L.hillGeo, mixC(p.hillT, SNOW, sn * 0.6), p.hillB, [53, 90, 99], L.hillForest, p.pine, p.leaf);
		L.p = p; L.sn = sn; L.lf = lf;
		L.pineCols = nzl(p.pine).map((c) => rgba(c));
		L.landCols = [rgba(nz(p.land[0])), rgba(nz(p.land[1]))];
		L.leafCols = nzl(p.leaf);
		const sky = canvasLayer(w, h, dpr);
		const g = sky.x.createLinearGradient(0, 0, 0, L.waterY);
		const nightSky = [[5, 10, 28], [11, 22, 52], [26, 39, 80]];
		g.addColorStop(0, rgba(mixC(p.skyT, nightSky[0], dk))); g.addColorStop(0.5, rgba(mixC(p.skyM, nightSky[1], dk))); g.addColorStop(0.85, rgba(mixC(p.skyH, nightSky[2], dk)));
		sky.x.fillStyle = g; sky.x.fillRect(0, 0, w, h);
		L.sky = sky;
		painted = S; paintedDk = dk;
	}

	function mkBirch(x, y, h, r) {
		const br = [], tips = [];
		const grow = (x0, y0, ang, len, wd, d) => {
			const x1 = x0 + Math.sin(ang) * len, y1 = y0 - Math.cos(ang) * len;
			br.push([x0, y0, x1, y1, wd]);
			if (d >= 3) { tips.push([x1, y1]); return; }
			const n = d === 0 ? 3 : 2;
			for (let k = 0; k < n; k++) grow(x1, y1, ang + (k - (n - 1) / 2) * (0.7 + r() * 0.5) + (r() - 0.5) * 0.3, len * (0.62 + r() * 0.12), wd * 0.62, d + 1);
		};
		grow(0, 0, (r() - 0.5) * 0.12, h * 0.38, Math.max(2, h * 0.035), 0);
		const crowns = tips.map(([cx, cy]) => ({ cx, cy, r: h * (0.09 + r() * 0.06), b: (r() * 3) | 0, k: r() }));
		return { x, y, h, br, crowns, ph: r() * 6, shake: 0, stiff: 0.8 + r() * 0.5 };
	}

	function build(s) {
		const { w, h } = s;
		const waterY = Math.round(h * 0.8);
		L = { waterY };
		const lw = w + MX * 2;
		L.farGeo = ridgeGeo({ w: lw, h, baseY: h * 0.63, amp: h * 0.36, scale: w * 0.26, seed: 7, power: 1.15, x0: 5.1 });
		L.midGeo = ridgeGeo({ w: lw, h, baseY: h * 0.7, amp: h * 0.12, scale: w * 0.17, seed: 23, power: 1.2 });
		L.midForest = forestGeo({ w: lw, h, ridge: L.midGeo, rows: 3, rowGap: 6, tree: [9, 15], gap: [4, 7], seed: 35, bottom: waterY, bareFrac: 0.5 });
		L.hillGeo = ridgeGeo({ w: lw, h, baseY: h * 0.75, amp: h * 0.055, scale: w * 0.11, seed: 45, power: 1.1 });
		L.hillForest = forestGeo({ w: lw, h, ridge: L.hillGeo, rows: 3, rowGap: 7, tree: [16, 26], gap: [5, 9], seed: 55, bottom: waterY, bareFrac: 0.45 });
		trees.trees.length = 0; birches.length = 0;
		const r = rng(93);
		for (let x = -30; x < w + 30; x += 12 + r() * 20) {
			const clump = Math.sin(x * 0.011 + 2) * 0.5 + 0.5;
			trees.add(x, waterY + r() * 6, h * (0.03 + r() * 0.035 + clump * 0.03), { b: (r() * 3) | 0, grp: "shore", ww: 0.85 + r() * 0.35 });
		}
		L.landL = { x1: w * 0.26, top: waterY - h * 0.04, seed: 4 };
		L.landR = { x1: w * 0.77, top: waterY - h * 0.03, seed: 8 };
		L.landY = (side, x) => {
			const A = side === "l" ? L.landL : L.landR;
			const u = side === "l" ? (x + 120) / (A.x1 + 120) : (w + 120 - x) / (w + 120 - A.x1);
			return lerp(A.top, h + 20, Math.pow(clamp(u), 2.2)) + Math.sin(x * 0.09 + A.seed) * 3;
		};
		L.landRegion = (side) => (side === "l" ? [-120, L.landL.x1 + 20] : [L.landR.x1 - 20, w + 120]);
		const place = (side, n) => {
			for (let i = 0; i < n; i++) {
				const t = (i + r()) / n;
				const x = side === "l" ? lerp(-30, w * 0.23, Math.pow(t, 0.8)) : lerp(w + 30, w * 0.8, Math.pow(t, 0.8));
				const hh = h * lerp(0.46, 0.17, Math.pow(t, 0.7)) * (0.85 + r() * 0.3);
				const y = L.landY(side, x) + 10 + r() * 10;
				if (i % 2 === 0 || t > 0.7) trees.add(x, y, hh, { b: (r() * 3) | 0, grp: "fg", ww: 0.85 + r() * 0.35 });
				else birches.push(mkBirch(x, y, hh * 1.05, r));
			}
		};
		place("l", 9); place("r", 9);
		birches.sort((a, b) => a.y - b.y);
		trees.trees.sort((a, b) => a.y - b.y);
		stars = makeStars(rng(15), 150, w, h * 0.55);
		glow = glowSprite(256, [255, 238, 200], [0.9, 0.22, 0]);
		mist = cloudSprite(620, 120, 9, [255, 250, 244], 0.35);
		L.refl = canvasLayer(w, h - waterY + 40, s.dpr);
		repaint(s);
		swallows.resize(w, h); geese.resize(w, h);
		if (s.reduced) swallows.settle(env(s), 6);
		syncUI();
	}

	const DEPTH = { far: 4, mid: 10, hills: 17, shore: 28, fg: 54 };
	const offs = (s) => { const o = {}; for (const k in DEPTH) o[k] = [-s.px * DEPTH[k], -s.scrollT * DEPTH[k] * 0.5 - s.py * DEPTH[k] * 0.1]; return o; };
	function birchPos(b, o, t, i = 0) { return [b.x + o.fg[0], b.y + o.fg[1]]; }
	function bendB(b, t, wind) { return (Math.sin(t * 1.1 + b.ph) * 0.006 * wind + (Math.sin(t * 0.7 - b.x / 900 * 5) * 0.5 + 0.45) * 0.03 * wind) / b.stiff + b.shake; }
	function env(s) {
		const o = offs(s);
		const sn = L.sn, lf = L.lf;
		const warmSeason = 1 - sn;
		const migr = S > 0.4 && S < 0.62 ? 1 : S > 0.05 && S < 0.2 ? 1 : 0;
		const perches = trees.trees.filter((t) => t.grp === "fg" && t.h > s.h * 0.17).map((t) => { const c = trees.crown(t, s.t, 0.8); return { x: c[0] + o.fg[0], y: c[1] + o.fg[1] + 4 }; });
		for (const b of birches) if (b.h > s.h * 0.17) { const c = b.crowns[0]; perches.push({ x: b.x + o.fg[0] + c.cx, y: b.y + o.fg[1] - (c.cy < 0 ? -c.cy : c.cy) * 0 + c.cy }); }
		return { wind: 0.8, pointer: s.pointer, calm: Math.max(0.4, warmSeason * (S > 0.25 && S < 0.45 ? 1.4 : 0.9)), perches, migr };
	}

	function emitParticles(dt, s) {
		const sn = L.sn;
		const fall = S > 0.42 && S < 0.7 ? Math.sin(((S - 0.42) / 0.28) * Math.PI) : 0;
		const snow = S > 0.7 || S < 0.06 ? (S > 0.7 ? smooth(clamp((S - 0.72) / 0.06)) : 1 - smooth(S / 0.06)) : 0;
		const petal = S > 0.06 && S < 0.22 ? Math.sin(((S - 0.06) / 0.16) * Math.PI) : 0;
		const w = s.w, h = s.h;
		const rate = (fall * 14 + snow * 40 + petal * 10);
		let n = rate * dt;
		while (n > 0 && (Math.random() < n)) {
			n -= 1;
			const x = Math.random() * (w + 200) - 100;
			if (snow > 0.05 && Math.random() < snow / (fall + snow + petal + 0.001)) parts.emit(x, -8, (Math.random() - 0.5) * 10 - 6, 22 + Math.random() * 28, 12 + Math.random() * 6, 1 + Math.random() * 1.8, 0);
			else if (fall > petal) parts.emit(x, -10, 10 + Math.random() * 20, 22 + Math.random() * 20, 14, 3 + Math.random() * 2.5, 1, (Math.random() * 3) | 0);
			else parts.emit(x, -10, 12 + Math.random() * 20, 16 + Math.random() * 16, 15, 2.2 + Math.random() * 1.6, 2, 0);
		}
	}

	function update(dt, s) {
		if (follow) Starget = clamp(0.18 + s.scrollT * 0.78, 0, 0.995);
		const k = 1 - Math.exp(-dt * (s.reduced ? 60 : 3));
		const dS = Starget - S;
		if (Math.abs(dS) > 0.0004) { S += dS * k; syncUI(); }
		dk += (dkTarget - dk) * (1 - Math.exp(-dt * 4));
		if (Math.abs(dk - dkTarget) < 0.003) dk = dkTarget;
		if (Math.abs(S - painted) > 0.002 || Math.abs(dk - paintedDk) > 0.01) repaint(s);
		if (s.reduced) return;
		const e = env(s);
		swallows.update(dt, e);
		// migration: geese cross leftward (south) in autumn, rightward (north) in spring
		const dirWant = S > 0.3 ? -1 : 1;
		geese.update(dt, { wind: 0.8, perches: [], calm: e.migr ? 1.2 : 0 });
		for (const g of geese.groups) {
			if (g.active && g.fresh !== true && Math.abs(g.ax) < 1000 && !g._set) {
				g._set = true;
				if (g.dir !== dirWant) { g.dir = dirWant; const n = g.birds.length; g.ax = dirWant > 0 ? -60 : s.w + 60; g.birds.forEach((b, i) => { const [ox, oy] = geese.slotOffset(g, i, n); b.ox = ox; b.oy = oy; b.dir = dirWant; b.x = g.ax + ox; b.y = g.ay + oy; b.vx = dirWant * g.speed; }); }
			}
			if (!g.active) g._set = false;
		}
		trees.update(dt);
		for (const b of birches) if (b.shake) b.shake *= Math.exp(-dt * 2);
		emitParticles(dt, s);
		const wind = 0.8 + Math.sin(s.t * 0.4) * 0.3;
		parts.step(dt, (p, d) => {
			p.vx += (wind * 10 - p.vx * 0.4) * d;
			if (p.k === 0) { p.x += (p.vx + Math.sin(s.t * 1.3 + p.r * 5) * 6) * d; p.y += p.vy * d; }
			else { p.x += (p.vx + Math.sin(s.t * 1.8 + p.r * 4) * 22) * d; p.y += p.vy * d * 0.8; p.r += p.vr * d; }
			if (p.y > L.waterY + (s.h - L.waterY) * (0.2 + (p.r % 1) * 0.7)) return false;
		});
	}

	function draw(ctx, s) {
		const { w, h } = s;
		const p = L.p, sn = L.sn, lf = L.lf, o = offs(s), t = s.t;
		const wy = L.waterY + o.shore[1];
		const ice = sn;
		ctx.drawImage(L.sky.c, 0, 0, w, h);
		drawStars(ctx, stars, t, clamp((dk - 0.4) * 1.7), [225, 232, 255], o.far[0] * 0.3, o.far[1] * 0.3);
		// sun/moon: high in summer, low in winter
		const hi = 1 - Math.abs(S - 0.25) * 2 > 0 ? 1 - Math.abs(S - 0.25) * 2.2 : 0;
		const sunH = h * lerp(0.3, 0.14, clamp(hi + (S > 0.45 && S < 0.7 ? 0 : 0)));
		const sx = w * 0.86 + o.far[0] * 0.4, sy = sunH + o.far[1] * 0.4;
		ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.6; ctx.drawImage(glow, sx - 150, sy - 150, 300, 300);
		ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
		ctx.fillStyle = dk > 0.5 ? "rgba(236,241,255,.95)" : "rgba(255,248,226,.95)";
		ctx.beginPath(); ctx.arc(sx, sy, dk > 0.5 ? 17 : 23, 0, TAU); ctx.fill();
		ctx.drawImage(L.far.c, -MX + o.far[0], o.far[1], L.far.w, L.far.h);
		const drift = (t * 6) % 1400;
		ctx.globalAlpha = (1 - dk * 0.6) * (0.5 + sn * 0.5);
		ctx.drawImage(mist, ((drift * 0.6 + 100) % (w + 600)) - 400, h * 0.54 + o.mid[1], 620, 130);
		ctx.globalAlpha = 1;
		drawSheared(ctx, L.mid, -MX + o.mid[0], o.mid[1], { bands: 8, amp: 1.5 * (1 - sn * 0.6), t, phase: 1, wind: 0.6 });
		drawSheared(ctx, L.hills, -MX + o.hills[0], o.hills[1], { bands: 10, amp: 2.6 * (1 - sn * 0.6), t, phase: 2, wind: 0.8 });
		// lake (freezes in winter)
		ctx.fillStyle = rgba(dk > 0.01 ? night(p.water, dk) : p.water);
		ctx.fillRect(0, wy, w, h - wy);
		const R = L.refl, rx = R.x, depth = h - L.waterY + 40;
		rx.setTransform(s.dpr, 0, 0, -s.dpr, 0, s.dpr * L.waterY);
		rx.clearRect(0, -depth * 2, w, depth * 4);
		rx.drawImage(L.sky.c, 0, 0, w, h);
		rx.drawImage(L.far.c, -MX + o.far[0], o.far[1] - o.shore[1], L.far.w, L.far.h);
		rx.drawImage(L.mid.c, -MX + o.mid[0], o.mid[1] - o.shore[1], L.mid.w, L.mid.h);
		rx.drawImage(L.hills.c, -MX + o.hills[0], o.hills[1] - o.shore[1], L.hills.w, L.hills.h);
		trees.draw(rx, t, 0.8, L.pineCols, { ox: o.shore[0], oy: 0, filter: (q) => q.grp === "shore" });
		drawReflectionStrips(ctx, R, { y: wy, w, depth: h - wy, t, amp: 2.2 * (1 - ice), strip: 3, alpha: 0.72 * (1 - ice * 0.8), fadeTo: 0.3, calm: ice });
		const g = ctx.createLinearGradient(0, wy, 0, h);
		g.addColorStop(0, rgba(dk > 0.01 ? night(p.wTop, dk) : p.wTop, 0.2 + ice * 0.5));
		g.addColorStop(1, rgba(dk > 0.01 ? night(p.wBot, dk) : p.wBot, 0.7 - ice * 0.15));
		ctx.fillStyle = g; ctx.fillRect(0, wy, w, h - wy);
		if (ice > 0.05) { // ice sheen and cracks
			ctx.strokeStyle = `rgba(255,255,255,${0.35 * ice * (1 - dk * 0.5)})`; ctx.lineWidth = 1;
			ctx.beginPath();
			for (let i = 0; i < 9; i++) { const x0 = (i * 211 + 97) % w, y0 = wy + 20 + ((i * 67) % (h - wy - 30)); ctx.moveTo(x0, y0); ctx.lineTo(x0 + 70 + (i % 3) * 30, y0 + 8 - (i % 4) * 5); ctx.lineTo(x0 + 120 + (i % 2) * 40, y0 + 4); }
			ctx.stroke();
		} else {
			ctx.fillStyle = dk > 0.5 ? "rgba(230,238,255,.7)" : "rgba(255,250,232,.8)";
			for (let i = 0; i < 34; i++) { const f = (i * 0.618) % 1; const xx = sx - o.far[0] * 0.4 + Math.sin(i * 12.9 + t * 0.4) * (10 + f * 80) * 0.8; ctx.globalAlpha = Math.max(0, Math.sin(t * (1.4 + (i % 5) * 0.35) + i * 3.1)) * (1 - f * 0.55) * 0.7; ctx.fillRect(xx, wy + 3 + f * (h - wy - 6), 2 + f * 9, 1 + f); }
			ctx.globalAlpha = 1;
		}
		const bc = (() => { const c = mixC([36, 52, 74], [205, 218, 244], dk); return [rgba(c, 0.6), rgba(c, 0.75), rgba(c, 0.9)]; })();
		swallows.draw(ctx, bc, { reflectY: wy, reflectAlpha: 0.2 * (1 - ice) });
		const snowPines = (filter, ox, oy) => {
			if (sn > 0.02) {
				ctx.fillStyle = rgba(SNOW, 0.95 * sn * (1 - dk * 0.45));
				ctx.beginPath();
				for (const tr of trees.trees) if (filter(tr)) trees.path(ctx, tr, t, 0.8, ox, oy - tr.h * 0.05, null);
				ctx.fill();
			}
			trees.draw(ctx, t, 0.8, L.pineCols, { ox, oy, filter });
		};
		snowPines((q) => q.grp === "shore", o.shore[0], o.shore[1]);
		// land
		for (const side of ["l", "r"]) {
			const [a, b] = L.landRegion(side);
			ctx.beginPath(); ctx.moveTo(a + o.fg[0], h + 40);
			for (let x = a; x <= b; x += 6) ctx.lineTo(x + o.fg[0], L.landY(side, x) + o.fg[1]);
			ctx.lineTo(b + o.fg[0], h + 40); ctx.closePath();
			const gl = ctx.createLinearGradient(0, h * 0.7, 0, h);
			gl.addColorStop(0, L.landCols[0]); gl.addColorStop(1, L.landCols[1]);
			ctx.fillStyle = gl; ctx.fill();
		}
		// deciduous foreground trees
		drawBirches(ctx, o, t, s);
		snowPines((q) => q.grp === "fg", o.fg[0], o.fg[1]);
		geese.draw(ctx, bc);
		swallows.draw(ctx, bc);
		// particles
		for (const kind of [0, 1, 2]) {
			if (kind === 1) {
				for (let c = 0; c < 3; c++) {
					ctx.fillStyle = rgba(night([[217, 130, 43], [196, 80, 42], [227, 177, 58]][c], dk * 0.6));
					ctx.beginPath();
					for (let i = 0; i < parts.n; i++) { const q = parts.a[i]; if (q.k !== 1 || q.c !== c) continue; ctx.moveTo(q.x + q.s * Math.cos(q.r), q.y + q.s * 0.6 * Math.sin(q.r)); ctx.ellipse(q.x, q.y, q.s, q.s * 0.55, q.r, 0, TAU); }
					ctx.fill();
				}
			} else {
				ctx.fillStyle = kind === 0 ? `rgba(255,255,255,${0.9 - dk * 0.1})` : "rgba(244,196,216,.9)";
				ctx.beginPath();
				for (let i = 0; i < parts.n; i++) { const q = parts.a[i]; if (q.k !== kind) continue; ctx.moveTo(q.x + q.s, q.y); if (kind === 0) ctx.arc(q.x, q.y, q.s, 0, TAU); else ctx.ellipse(q.x, q.y, q.s, q.s * 0.5, q.r, 0, TAU); }
				ctx.fill();
			}
		}
	}

	function drawBirches(ctx, o, t, s) {
		const lf = L.lf, sn = L.sn;
		const barkC = dk > 0.5 ? "rgba(40,48,72,1)" : "rgba(58,48,40,1)";
		for (const b of birches) {
			const ox = b.x + o.fg[0], oy = b.y + o.fg[1];
			const L0 = bendB(b, t, 0.8);
			const X = (px, py) => ox + px + L0 * b.h * Math.pow(clamp(-py / b.h * 1.1), 1.7);
			ctx.strokeStyle = barkC; ctx.lineCap = "round";
			for (const [x1, y1, x2, y2, wd] of b.br) { ctx.lineWidth = wd; ctx.beginPath(); ctx.moveTo(X(x1, y1), oy + y1); ctx.lineTo(X(x2, y2), oy + y2); ctx.stroke(); }
			if (sn > 0.05) { ctx.strokeStyle = rgba(SNOW, 0.9 * sn); for (const [x1, y1, x2, y2, wd] of b.br) { ctx.lineWidth = Math.max(1, wd * 0.5); ctx.beginPath(); ctx.moveTo(X(x1, y1) - 0.5, oy + y1 - wd * 0.5); ctx.lineTo(X(x2, y2) - 0.5, oy + y2 - wd * 0.5); ctx.stroke(); } }
			if (lf > 0.02) {
				for (let c = 0; c < 3; c++) {
					ctx.fillStyle = rgba(L.leafCols[c]);
					ctx.beginPath();
					for (const cr of b.crowns) { if (cr.b !== c || cr.k > lf + 0.05) continue; const rr = cr.r * (0.5 + 0.5 * Math.min(1, lf * 1.4)); const cx = X(cr.cx, cr.cy), cy = oy + cr.cy; ctx.moveTo(cx + rr, cy); ctx.arc(cx, cy, rr, 0, TAU); ctx.moveTo(cx - rr * 0.8 + rr * 0.7, cy + rr * 0.5); ctx.arc(cx - rr * 0.8, cy + rr * 0.5, rr * 0.7, 0, TAU); }
					ctx.fill();
				}
			}
		}
	}

	stage.on(slider, "input", () => { follow = false; followBtn.setAttribute("aria-pressed", "false"); Starget = slider.value / 999; hint.hide(); if (stage.reduced) { S = Starget; stage.invalidate(); syncUI(); } });
	stage.on(followBtn, "click", () => { follow = !follow; followBtn.setAttribute("aria-pressed", follow); hint.hide(); if (stage.reduced && follow) { Starget = clamp(0.18 + stage.scrollT * 0.78, 0, 0.995); S = Starget; stage.invalidate(); syncUI(); } });
	return () => { stage.destroy(); unwatch(); };
}
