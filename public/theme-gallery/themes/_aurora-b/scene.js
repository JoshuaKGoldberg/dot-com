// Layered Adirondack scene: cached canvases per palette variant, crossfaded by opacity, parallaxed by transform.
import { ridgeGeo, paintRidge, forestGeo, makePineVariants, makeStars, canvasLayer, rng, hex, mixC, rgba, clamp, lerp, smooth, TAU } from "../forest-kit/kit.js";
export { rng, hex, mixC, rgba, clamp, lerp, smooth, TAU };
export { addHint, addUI, isDark, watchDark } from "../forest-kit/kit.js";

export const night = (c, k = 1) => mixC(c, [c[0] * 0.2 + 8, c[1] * 0.25 + 14, c[2] * 0.4 + 36], k);
export const mapColors = (o, f) => (Array.isArray(o) ? (o.length === 3 && typeof o[0] === "number" && typeof o[2] === "number" ? f(o) : o.map((v) => mapColors(v, f))) : o && typeof o === "object" ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, mapColors(v, f)])) : o);
export const H = (s) => hex(s);
const SNOW = [238, 244, 251];
const DEPTH = { far: 5, mid: 12, hills: 20, lake: 30, fg: 62 };
const MX = 70;

export function createScene(root, o) {
	const { reduced, nVar = 1, palette, waterFrac = 0.8, hardFrac = 0, bareFrac = 0, seed = 91, fgCount = 8, reflectAlpha = 0.6 } = o;
	const scA = root.querySelector(".scenery-a"), scB = root.querySelector(".scenery-b");
	const dead = { v: false };
	const variants = makePineVariants(seed, 8);
	const wrap = document.createElement("div");
	wrap.style.cssText = "position:absolute;inset:0;overflow:hidden;pointer-events:none";
	scB.append(wrap);
	const skyWrap = document.createElement("div");
	skyWrap.style.cssText = "position:absolute;inset:0;z-index:0;isolation:isolate";
	scA.prepend(skyWrap);
	const starsEl = document.createElement("div");
	starsEl.style.cssText = "position:absolute;inset:0;opacity:0;will-change:opacity;z-index:0";
	const starsCv = document.createElement("canvas");
	starsCv.style.cssText = "position:absolute;inset:0;width:100%;height:100%;animation:abTwinkle 7s ease-in-out infinite alternate";
	starsEl.append(starsCv);
	skyWrap.after(starsEl);
	const S = { w: 0, h: 0, dpr: 1, dark: false, scrollT: 0, px: 0, py: 0, base: 0, u: 0, layers: {}, skies: [], painted: [], fgCrowns: [], tx: { fg: [0, 0] }, waterY: 0, reflect: null, stars: starsEl, skyWrap, wrap };
	let gen = 0, queue = [], qTimer = 0, rb = 0, rafP = 0, pTx = 0, pTy = 0, ptrRaf = 0;
	const pals = [];

	function skyCss(P, wy) {
		const st = P.sky.map(([t, c]) => `${rgba(c)} ${(t * wy * 100).toFixed(1)}%`);
		const last = P.sky[P.sky.length - 1][1];
		const glow = P.horizon ? `radial-gradient(90% ${Math.round((1 - wy) * 100 + 28)}% at 50% ${(wy * 100).toFixed(0)}%, ${rgba(P.horizon, P.horizonA ?? 0.5)}, transparent 72%),` : "";
		return `${glow}linear-gradient(to bottom, ${st.join(",")}, ${rgba(last)} 100%)`;
	}

	function layerEl(name, x, y, wd, ht) {
		const el = document.createElement("div");
		el.style.cssText = `position:absolute;left:0;top:0;width:${wd}px;height:${ht}px;will-change:transform;contain:paint;pointer-events:none`;
		wrap.append(el);
		return { el, name, x, y, w: wd, h: ht, cv: [] };
	}
	function canvasFor(L, v) {
		const l = canvasLayer(L.w, L.h, L.dpr);
		l.c.style.cssText = `position:absolute;left:0;top:0;width:${L.w}px;height:${L.h}px`;
		L.el.append(l.c);
		L.cv[v] = l;
		return l;
	}

	function build() {
		const r = scB.getBoundingClientRect();
		const w = Math.round(r.width), h = Math.round(r.height);
		if (!w || !h) return;
		const dark = document.documentElement.classList.contains("dark");
		gen++;
		queue = []; clearTimeout(qTimer);
		for (const k in S.layers) S.layers[k].el.remove();
		S.layers = {}; S.painted = []; S.fgCrowns = [];
		skyWrap.textContent = ""; S.skies = [];
		Object.assign(S, { w, h, dark });
		S.dpr = Math.min(window.devicePixelRatio || 1, 1.25);
		const wy = Math.round(h * waterFrac);
		S.waterY = wy;
		for (let v = 0; v < nVar; v++) pals[v] = palette(v, dark);
		for (let v = 0; v < nVar; v++) {
			const d = document.createElement("div");
			d.style.cssText = `position:absolute;inset:0;background:${skyCss(pals[v], waterFrac)};will-change:opacity`;
			skyWrap.append(d); S.skies.push(d);
		}
		// stars
		const sd = Math.min(window.devicePixelRatio || 1, 1.5);
		starsCv.width = Math.round(w * sd); starsCv.height = Math.round(h * sd);
		{
			const c = starsCv.getContext("2d"); c.setTransform(sd, 0, 0, sd, 0, 0); c.clearRect(0, 0, w, h);
			for (const s of makeStars(rng(15), Math.round((w * h) / 5500), w, h * 0.6)) { c.fillStyle = `rgba(232,238,255,${s.o})`; c.beginPath(); c.arc(s.x, s.y, s.s * 0.8, 0, TAU); c.fill(); }
		}
		// geometry
		const lw = w + MX * 2;
		const y0 = Math.round(h * 0.18), lh = wy + 70 - y0;
		const G = {};
		G.far = ridgeGeo({ w: lw, h, baseY: h * 0.62 * (waterFrac / 0.8), amp: h * 0.36, scale: w * 0.26, seed: seed + 7, power: 1.15, x0: 5.1 });
		G.mid = ridgeGeo({ w: lw, h, baseY: h * 0.69 * (waterFrac / 0.8), amp: h * 0.13, scale: w * 0.16, seed: seed + 21, power: 1.2 });
		G.hills = ridgeGeo({ w: lw, h, baseY: h * 0.745 * (waterFrac / 0.8), amp: h * 0.06, scale: w * 0.1, seed: seed + 41, power: 1.1 });
		const sideNoGo = (x) => x > w * 0.27 + MX && x < w * 0.74 + MX; // keep the middle forest low-key
		G.midF = forestGeo({ w: lw, h, ridge: G.mid, rows: 3, rowGap: 6, tree: [9, 15], gap: [4, 7], seed: seed + 31, bottom: wy, bareFrac });
		G.hillF = forestGeo({ w: lw, h, ridge: G.hills, rows: 3, rowGap: 7, tree: [16, 26], gap: [5, 9], seed: seed + 51, bottom: wy, bareFrac });
		void sideNoGo;
		const r2 = rng(seed + 77);
		const shore = [];
		for (let x = -30; x < w + 30; x += 11 + r2() * 20) {
			const clump = Math.sin(x * 0.013) * 0.5 + 0.5;
			shore.push({ x, y: wy + r2() * 6, h: h * (0.03 + r2() * 0.035 + clump * 0.035), v: (r2() * 8) | 0, b: (r2() * 3) | 0, ww: 0.85 + r2() * 0.35 });
		}
		const landL = { x1: w * 0.28, top: wy - h * 0.045, seed: 3 }, landR = { x1: w * 0.76, top: wy - h * 0.02, seed: 9 };
		const landY = (side, x) => {
			const A = side === "l" ? landL : landR;
			const u = side === "l" ? (x + 120) / (A.x1 + 120) : (w + 120 - x) / (w + 120 - A.x1);
			return lerp(A.top, h + 20, Math.pow(clamp(u), 2.2)) + Math.sin(x * 0.09 + A.seed) * 3;
		};
		const fg = [];
		const place = (side, n, big) => {
			for (let i = 0; i < n; i++) {
				const t = (i + r2()) / n;
				const x = side === "l" ? lerp(-30, w * 0.24, Math.pow(t, 0.8)) : lerp(w + 30, w * 0.8, Math.pow(t, 0.8));
				const hh = h * (big ? lerp(0.52, 0.2, Math.pow(t, 0.7)) : lerp(0.42, 0.17, Math.pow(t, 0.7))) * (0.85 + r2() * 0.3);
				const hard = r2() < hardFrac;
				fg.push({ side, x, y: landY(side, x) + 10 + r2() * 10, h: hh, v: (r2() * 8) | 0, b: (r2() * 3) | 0, ww: 0.85 + r2() * 0.35, hard, k: r2(), seedv: r2() });
			}
		};
		place("l", fgCount, true); place("r", fgCount - 1, false);
		fg.sort((a, b) => a.y - b.y);
		// layers
		const mkRidge = (name, d) => { const L = layerEl(name, -MX, y0, lw, lh); L.dpr = S.dpr; L.depth = d; S.layers[name] = L; return L; };
		mkRidge("far", DEPTH.far); mkRidge("mid", DEPTH.mid); mkRidge("hills", DEPTH.hills);
		const lakeY = wy - 70;
		const LK = layerEl("lake", 0, lakeY, w, h - lakeY + 70); LK.dpr = S.dpr; LK.depth = DEPTH.lake; S.layers.lake = LK;
		// reflection canvas (low-res, redrawn from the aurora)
		const rc = document.createElement("canvas");
		const rh = Math.max(8, Math.round((h - wy + 70) / 6)), rw = Math.round(w / 6);
		rc.width = rw; rc.height = rh;
		rc.style.cssText = `position:absolute;left:0;top:${wy - lakeY}px;width:${w}px;height:${h - wy + 70}px;opacity:${o.reflectOpacity ?? 0.6};pointer-events:none`;
		LK.el.append(rc);
		S.reflect = { c: rc, x: rc.getContext("2d"), w: rw, h: rh };
		const fgW = Math.round(w * 0.3 + MX + 40), fgY = Math.round(h * 0.2), fgH = h + 80 - fgY;
		for (const side of ["l", "r"]) {
			const L = layerEl("fg" + side, side === "l" ? -MX : w - w * 0.3 - 40, fgY, fgW, fgH);
			L.dpr = Math.min(window.devicePixelRatio || 1, 1.5); L.depth = DEPTH.fg; L.side = side; S.layers["fg" + side] = L;
		}
		S.geo = { G, shore, fg, landY, y0, lh, wy, lw, landL, landR };
		for (const f of fg) if (f.hard) S.fgCrowns.push({ x: f.x, y: f.y - f.h * 0.6, r: f.h * 0.3, side: f.side });
		// paint queue: variant 0 first, all of its layers; then the rest
		const order = ["far", "mid", "hills", "lake", "fgl", "fgr"];
		const myGen = gen;
		for (let v = 0; v < nVar; v++) for (const n of order) queue.push(() => paintLayer(v, n));
		const pump = () => {
			qTimer = 0;
			if (dead.v || myGen !== gen) return;
			const t0 = performance.now();
			do { const j = queue.shift(); if (!j) break; j(); if (queue.length && queue[0].v0) break; } while (performance.now() - t0 < 12 && queue.length);
			if (queue.length) qTimer = setTimeout(pump, 16);
			else S.onPainted?.();
			applyMix();
		};
		qTimer = setTimeout(pump, 0);
		applyMix(); applyParallax();
		S.onBuild?.(S);
	}

	// ---- painting ----
	function paintPines(x, trees, P, cols, snow, off) {
		if (snow > 0.02) {
			for (const [dy, a] of [[-0.06, 0.55], [-0.032, 1]]) {
				x.fillStyle = rgba(P.snowCol || SNOW, a * snow);
				x.beginPath();
				for (const t of trees) { const p = variants[t.v % 8]; x.moveTo(t.x - off[0] + p[0] * t.h * (t.ww || 1), t.y - off[1] + (p[1] + dy) * t.h); for (let i = 2; i < p.length; i += 2) x.lineTo(t.x - off[0] + p[i] * t.h * (t.ww || 1), t.y - off[1] + (p[i + 1] + dy) * t.h); x.closePath(); }
				x.fill();
			}
		}
		for (let b = 0; b < 3; b++) {
			x.fillStyle = rgba(cols[b]);
			x.beginPath();
			for (const t of trees) { if (t.b !== b) continue; const p = variants[t.v % 8]; x.moveTo(t.x - off[0] + p[0] * t.h * (t.ww || 1), t.y - off[1] + p[1] * t.h); for (let i = 2; i < p.length; i += 2) x.lineTo(t.x - off[0] + p[i] * t.h * (t.ww || 1), t.y - off[1] + p[i + 1] * t.h); x.closePath(); }
			x.fill();
		}
	}
	function paintBlobs(x, trees, P, off, leafCols) {
		const la = P.leafAmt ?? 1;
		for (let b = 0; b < 3; b++) {
			x.fillStyle = rgba((leafCols || P.leaf)[b], la > 0.3 ? 1 : 0.6);
			x.beginPath();
			for (const t of trees) {
				if (t.b !== b) continue;
				const r = t.h * 0.3 * (0.6 + 0.4 * Math.max(la, 0.5)), cy = t.y - off[1] - t.h * 0.58, cx = t.x - off[0];
				x.moveTo(cx + r, cy); x.arc(cx, cy, r, 0, TAU);
				x.moveTo(cx - r * 0.75 + r * 0.7, cy + r * 0.35); x.arc(cx - r * 0.75, cy + r * 0.35, r * 0.7, 0, TAU);
				x.moveTo(cx + r * 0.75 + r * 0.7, cy + r * 0.35); x.arc(cx + r * 0.75, cy + r * 0.35, r * 0.7, 0, TAU);
			}
			x.fill();
		}
	}
	function paintMixed(x, geo, P, cols, off) {
		const pineT = [], leafT = [];
		for (const t of geo.trees) (t.bare ? leafT : pineT).push(t);
		paintPines(x, pineT, P, cols, P.snow || 0, off);
		paintBlobs(x, leafT, P, off, P.leaf.map((c) => mixC(c, P.mid.bottom, 0.5)));
	}
	function hardwood(x, t, P, off) {
		const rr = rng(Math.floor(t.seedv * 1e6));
		const bx = t.x - off[0], by = t.y - off[1], hh = t.h * 0.8;
		const la = P.leafAmt ?? 1;
		const bark = P.bark || [58, 48, 40];
		x.strokeStyle = rgba(bark); x.lineCap = "round";
		const tips = [];
		const grow = (x0, y0, ang, len, wd, d) => {
			const x1 = x0 + Math.sin(ang) * len, y1 = y0 - Math.cos(ang) * len;
			x.lineWidth = wd; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke();
			if (P.snow > 0.05) { x.strokeStyle = rgba(P.snowCol || SNOW, 0.9 * P.snow); x.lineWidth = Math.max(1, wd * 0.5); x.beginPath(); x.moveTo(x0 - 0.5, y0 - wd * 0.5); x.lineTo(x1 - 0.5, y1 - wd * 0.5); x.stroke(); x.strokeStyle = rgba(bark); }
			if (d >= 3) { tips.push([x1, y1]); return; }
			const n = d === 0 ? 3 : 2;
			for (let k = 0; k < n; k++) grow(x1, y1, ang + (k - (n - 1) / 2) * (0.7 + rr() * 0.5) + (rr() - 0.5) * 0.3, len * (0.62 + rr() * 0.12), wd * 0.62, d + 1);
		};
		grow(bx, by, (rr() - 0.5) * 0.12, hh * 0.38, Math.max(2, hh * 0.035), 0);
		if (la < 0.05) return;
		const base = P.leaf[t.b];
		const dk = mixC(base, [10, 14, 30], 0.3), lt = mixC(base, [255, 240, 200], 0.14);
		const puffs = [];
		for (const [cx, cy] of tips) { const r = hh * (0.1 + rr() * 0.045) * (0.5 + 0.5 * Math.min(1, la * 1.3)) * 1.45; for (let k = 0; k < 3; k++) puffs.push([cx + (rr() - 0.5) * r * 1.6, cy + (rr() - 0.5) * r * 1.1, r * (0.55 + rr() * 0.45)]); }
		for (const [col, dx, dy, sc, al] of [[dk, 0.18, 0.28, 1.05, 1], [base, 0, 0, 0.9, 1], [lt, -0.25, -0.3, 0.55, 0.6]]) {
			x.fillStyle = rgba(col, al);
			x.beginPath();
			for (const [cx, cy, r0] of puffs) { const r = r0 * sc; const px = cx + dx * r0, py = cy + dy * r0; x.moveTo(px + r, py); x.arc(px, py, r, 0, TAU); }
			x.fill();
		}
	}
	function paintLayer(v, name) {
		if (dead.v) return;
		const P = pals[v], L = S.layers[name];
		if (!L || !P) return;
		const { G, shore, fg, landY, wy } = S.geo;
		const cv = canvasFor(L, v), x = cv.x;
		x.save();
		const dk = S.dark;
		const nz = (c) => c;
		if (name === "far" || name === "mid" || name === "hills") {
			x.translate(0, -L.y);
			const gm = { far: G.far, mid: G.mid, hills: G.hills }[name];
			paintRidge(x, gm, { top: P[name].top, bottom: P[name].bottom, shade: P[name].shade, lit: P[name].lit || null, depth: 70, light: 1 });
			if (name === "mid") paintMixed(x, G.midF, P, P.pineMid, [0, 0]);
			if (name === "hills") paintMixed(x, G.hillF, P, P.pine, [0, 0]);
		} else if (name === "lake") {
			x.translate(0, -L.y);
			// water
			const g = x.createLinearGradient(0, wy, 0, S.h + 70);
			g.addColorStop(0, rgba(P.wTop)); g.addColorStop(1, rgba(P.wBot));
			x.fillStyle = rgba(P.water); x.fillRect(0, wy, S.w, S.h + 70 - wy);
			// ridge reflections
			x.save(); x.beginPath(); x.rect(0, wy, S.w, S.h); x.clip();
			x.translate(0, wy); x.scale(1, -1);
			x.globalAlpha = 0.7 * (1 - (P.ice || 0) * 0.45);
			for (const n of ["far", "mid", "hills"]) { const R = S.layers[n]; const src = R.cv[v]; if (src) x.drawImage(src.c, R.x - 0, R.y - wy, R.w, R.h); }
			x.restore(); x.globalAlpha = 1;
			const g2 = x.createLinearGradient(0, wy, 0, S.h + 70);
			g2.addColorStop(0, rgba(P.wTop, 0.25 + (P.ice || 0) * 0.45)); g2.addColorStop(1, rgba(P.wBot, 0.8));
			x.fillStyle = g2; x.fillRect(0, wy, S.w, S.h + 70 - wy);
			// ice sheen & cracks
			if ((P.ice || 0) > 0.05) {
				const rr = rng(5);
				x.strokeStyle = `rgba(235,245,255,${0.32 * P.ice})`; x.lineWidth = 1; x.beginPath();
				for (let i = 0; i < 12; i++) { const x0 = rr() * S.w, y0 = wy + 14 + rr() * (S.h - wy), dx = 60 + rr() * 120; x.moveTo(x0, y0); x.lineTo(x0 + dx * 0.5, y0 + (rr() - 0.5) * 14); x.lineTo(x0 + dx, y0 + (rr() - 0.5) * 10); }
				x.stroke();
				const sg = x.createLinearGradient(0, wy, 0, S.h);
				sg.addColorStop(0, `rgba(255,255,255,${0.28 * P.ice})`); sg.addColorStop(0.5, "rgba(255,255,255,0)"); x.fillStyle = sg; x.fillRect(0, wy, S.w, S.h - wy);
			}
			// mist on the water
			const mg = x.createLinearGradient(0, wy - 46, 0, wy + 26);
			const mc = P.mist || [255, 250, 240];
			mg.addColorStop(0, rgba(mc, 0)); mg.addColorStop(0.62, rgba(mc, P.mistA ?? 0.32)); mg.addColorStop(1, rgba(mc, 0));
			x.fillStyle = mg; x.fillRect(0, wy - 46, S.w, 72);
			// shore trees
			paintPines(x, shore, P, P.pineShore || P.pine, P.snow || 0, [0, 0]);
		} else {
			const side = L.side;
			const off = [L.x, L.y];
			// land
			const a = side === "l" ? -120 : S.geo.landR.x1 - 20, b = side === "l" ? S.geo.landL.x1 + 20 : S.w + 120;
			x.beginPath(); x.moveTo(a - off[0], S.h + 60 - off[1]);
			for (let xx = a; xx <= b; xx += 6) x.lineTo(xx - off[0], landY(side, xx) - off[1]);
			x.lineTo(b - off[0], S.h + 60 - off[1]); x.closePath();
			const gl = x.createLinearGradient(0, S.h * 0.7 - off[1], 0, S.h - off[1]);
			gl.addColorStop(0, rgba(P.land[0])); gl.addColorStop(1, rgba(P.land[1]));
			x.fillStyle = gl; x.fill();
			const mine = fg.filter((t) => t.side === side);
			const pines = mine.filter((t) => !t.hard), hards = mine.filter((t) => t.hard);
			paintPines(x, pines, P, P.fgPine || P.pine, P.snow || 0, off);
			for (const t of hards) hardwood(x, t, P, off);
		}
		x.restore();
		S.painted[v] = (S.painted[v] || 0) + 1;
		L.cv[v].c.style.opacity = v === S.base ? 1 : 0;
	}

	// ---- mixing & parallax ----
	function applyMix() {
		const base = S.base, next = (S.base + 1) % nVar, u = S.u;
		const setOp = (cv, v) => { if (!cv) return; const o = v === base ? 1 : v === next ? +u.toFixed(3) : 0; if (cv.__o === o && cv.__b === base) return; cv.__o = o; cv.__b = base; cv.style.opacity = o; cv.style.zIndex = v === base ? 1 : v === next ? 2 : 0; };
		for (const k in S.layers) S.layers[k].cv.forEach((l, v) => l && setOp(l.c, v));
		S.skies.forEach((d, v) => setOp(d, v));
		if (nVar === 1) for (const k in S.layers) S.layers[k].cv[0] && (S.layers[k].cv[0].c.style.opacity = 1);
	}
	function applyParallax() {
		rafP = 0;
		for (const k in S.layers) {
			const L = S.layers[k];
			const d = L.depth ?? DEPTH.fg;
			const tx = -pTx * d, ty = -S.scrollT * d * 0.9 - pTy * d * 0.12;
			L.el.style.transform = `translate3d(${(L.x + tx).toFixed(2)}px,${(L.y + ty).toFixed(2)}px,0)`;
			if (k[0] === "f" && k[1] === "g") S.tx.fg = [tx, ty];
			if (k === "lake") S.tx.lake = [tx, ty];
		}
	}
	const sched = () => { if (!rafP) rafP = requestAnimationFrame(applyParallax); };
	const onScroll = () => { S.scrollT = clamp(root.scrollTop / Math.max(1, root.scrollHeight - root.clientHeight)); sched(); };
	const ptr = { nx: 0, ny: 0 };
	const ptrStep = () => {
		ptrRaf = 0;
		pTx += (ptr.nx - pTx) * 0.12; pTy += (ptr.ny - pTy) * 0.12;
		applyParallax();
		if (Math.abs(ptr.nx - pTx) > 0.002 || Math.abs(ptr.ny - pTy) > 0.002) ptrRaf = requestAnimationFrame(ptrStep);
	};
	const onMove = (e) => {
		if (reduced || e.pointerType === "touch") return;
		ptr.nx = clamp((e.clientX / innerWidth) * 2 - 1, -1, 1); ptr.ny = clamp((e.clientY / innerHeight) * 2 - 1, -1, 1);
		if (!ptrRaf) ptrRaf = requestAnimationFrame(ptrStep);
	};
	root.addEventListener("scroll", onScroll, { passive: true });
	window.addEventListener("pointermove", onMove, { passive: true });
	const ro = new ResizeObserver(() => { clearTimeout(rb); rb = setTimeout(build, 140); });
	ro.observe(scB);
	const mo = new MutationObserver(() => { if (document.documentElement.classList.contains("dark") !== S.dark) { clearTimeout(rb); rb = setTimeout(build, 0); } });
	mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
	const st = document.createElement("style");
	st.textContent = "@keyframes abTwinkle{from{opacity:.65}to{opacity:1}}html.reduce-motion .site [style*=abTwinkle],html.reduce-motion .site canvas{animation:none!important}@media (prefers-reduced-motion:reduce){.site canvas{animation:none!important}}";
	scA.append(st);
	build();

	// reflect an aurora canvas into the lake (flipped, squashed, with a gentle row shimmer)
	S.reflectFrom = (cv, t = 0) => {
		const R = S.reflect; if (!R) return;
		const sx = cv.width, sy = cv.height, wy = S.waterY;
		R.x.clearRect(0, 0, R.w, R.h);
		const srcTop = 0, srcH = Math.round(sy * (wy / S.h));
		for (let r = 0; r < R.h; r++) {
			const f = r / R.h;
			const sRow = Math.min(srcH - 1, Math.round(srcH * (1 - f * 0.9)) - 1);
			const dx = reduced ? 0 : Math.sin(r * 0.7 + t * 1.3) * 0.5 * (1 - (S.layers.lake?.cv[S.base] ? 0 : 0));
			R.x.globalAlpha = (1 - f * 0.7);
			R.x.drawImage(cv, 0, sy - srcTop - srcH + sRow, sx, 1, dx, r, R.w, 1);
		}
		R.x.globalAlpha = 1;
	};
	S.setMix = (base, u) => { S.base = base; S.u = u; applyMix(); };
	S.destroy = () => {
		dead.v = true; clearTimeout(qTimer); clearTimeout(rb); cancelAnimationFrame(rafP); cancelAnimationFrame(ptrRaf);
		ro.disconnect(); mo.disconnect();
		root.removeEventListener("scroll", onScroll); window.removeEventListener("pointermove", onMove);
		wrap.remove(); skyWrap.remove(); starsEl.remove(); st.remove();
	};
	return S;
}

export const hexify = (o) => (Array.isArray(o) ? o.map(hexify) : typeof o === "string" && o[0] === "#" ? hex(o) : o && typeof o === "object" ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, hexify(v)])) : o);

// soft radial glow element (sun / moon). Move with transform, fade with opacity.
export function addGlow(host, { x, y, size, rgb, core = null, alpha = 1 }) {
	const el = document.createElement("div");
	el.style.cssText = `position:absolute;left:${x * 100}%;top:${y * 100}%;width:${size}px;height:${size}px;margin:${-size / 2}px 0 0 ${-size / 2}px;will-change:transform,opacity;opacity:${alpha};border-radius:50%;pointer-events:none`;
	const set = (rgb, core) => { el.style.background = `radial-gradient(circle,${core ? `${rgba(core)} 0 ${size * 0.045}px,` : ""}${rgba(rgb, 0.55)} ${core ? size * 0.05 : 0}px,${rgba(rgb, 0.16)} 35%,${rgba(rgb, 0)} 70%)`; };
	set(rgb, core);
	host.append(el);
	return { el, set };
}
