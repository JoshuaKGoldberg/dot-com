// Static scenery for the aurora x adirondacks themes: sky, stars, ridges, forested hills, edge pines.
// Everything is painted once into cached canvases (re-done on resize / mode change); parallax is transform-only.
import { ridgeGeo, paintRidge, forestGeo, paintForest, makePineVariants, makeStars, glowSprite, hex, rng, lerp, clamp, rgba } from "../forest-kit/kit.js";

export const EXTRA = 60; // layers extend below the viewport so parallax never reveals a gap

const H = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === "string" ? hex(v) : Array.isArray(v) ? v.map(hex) : v]));

export const PAL = {
	night: {
		sky: [[0, "#02060f"], [0.45, "#071428"], [0.8, "#102a42"], [1, "#1b3d52"]],
		far: H({ top: "#2a3d6a", bottom: "#3c5580", shade: "#16224a", lit: "#5a76a2" }),
		mid: H({ top: "#20315a", bottom: "#324b76", shade: "#111c3e", lit: null }),
		hills: H({ top: "#172647", bottom: "#243a60", shade: "#0d1630", lit: null }),
		midTrees: H({ c: ["#1a2a52", "#16244a", "#1e305a"] }).c,
		hillTrees: H({ c: ["#111d3c", "#0e1934", "#162346"] }).c,
		pines: H({ c: ["#050b19", "#040815", "#071022"] }).c,
		land: [hex("#0a1226"), hex("#050914")],
		star: [225, 235, 255], starA: 1,
		water: [14, 34, 56], waterTop: [40, 74, 100],
		mist: [150, 185, 215],
	},
	day: {
		sky: [[0, "#a9cfe8"], [0.5, "#d3e5ec"], [0.82, "#f4ead6"], [1, "#f7e8d2"]],
		far: H({ top: "#8ea8c4", bottom: "#cbd9e4", shade: "#6882a2", lit: "#f0f4f7" }),
		mid: H({ top: "#7b9bb0", bottom: "#b9cdd3", shade: "#56768d", lit: "#e6eef0" }),
		hills: H({ top: "#5e888d", bottom: "#86abaa", shade: "#3d6169", lit: null }),
		midTrees: H({ c: ["#628896", "#587f90", "#6c919d"] }).c,
		hillTrees: H({ c: ["#42706d", "#38665f", "#4c7c76"] }).c,
		pines: H({ c: ["#1d3a36", "#17302c", "#234640"] }).c,
		land: [hex("#25463f"), hex("#173029")],
		star: [255, 255, 255], starA: 0,
		water: [120, 160, 178], waterTop: [170, 200, 212],
		mist: [255, 250, 242],
	},
	dawn: {
		sky: [[0, "#b9c9e2"], [0.45, "#dfd8e4"], [0.8, "#f7dcc8"], [1, "#f8e4d2"]],
		far: H({ top: "#9aa8c4", bottom: "#d8d6e0", shade: "#7a88aa", lit: "#fbf0ec" }),
		mid: H({ top: "#8798b4", bottom: "#c8cfdc", shade: "#667a9a", lit: "#f3ece8" }),
		hills: H({ top: "#6d8499", bottom: "#a3b4bf", shade: "#4c6278", lit: null }),
		midTrees: H({ c: ["#7388a2", "#697f9b", "#7b90a8"] }).c,
		hillTrees: H({ c: ["#546e82", "#4a657a", "#5c768a"] }).c,
		pines: H({ c: ["#2c4252", "#26394a", "#324a5a"] }).c,
		land: [hex("#35505a"), hex("#233842")],
		star: [255, 255, 255], starA: 0,
		water: [150, 172, 194], waterTop: [214, 214, 224],
		mist: [255, 244, 238],
	},
};

export function newLayer(S, z, extra = EXTRA) {
	const w = S.w, h = S.h + extra, dpr = S.dpr;
	const c = document.createElement("canvas");
	c.width = Math.ceil(w * dpr);
	c.height = Math.ceil(h * dpr);
	c.className = "aa-cv";
	c.style.cssText = `width:${w}px;height:${h}px;z-index:${z}`;
	const x = c.getContext("2d");
	x.scale(dpr, dpr);
	return { c, x, w, h, el: c };
}

export function paintSkyGradient(x, w, h, stops, to = h) {
	const g = x.createLinearGradient(0, 0, 0, to);
	for (const [t, c] of stops) g.addColorStop(t, c);
	x.fillStyle = g;
	x.fillRect(0, 0, w, h);
}

// spec: { pal, sky, glow, stars, ridges: [...], horizon }
// returns { sky, layers: [{layer, depth, name}], geo }
export function buildSky(S, spec) {
	const { w, h } = S;
	const L = newLayer(S, 10, 0);
	const wy = spec.horizon * h;
	paintSkyGradient(L.x, w, h, spec.pal.sky, wy);
	if (spec.glow) {
		const g = spec.glow;
		const sp = glowSprite(256, g.color, [g.a, g.a * 0.35, 0]);
		const r = g.r * h;
		L.x.drawImage(sp, g.x * w - r, g.y * h - r, r * 2, r * 2);
	}
	if (spec.pal.starA > 0) {
		const stars = makeStars(rng(spec.seed || 11), Math.round((w * h) / 6500), w, h * 0.62);
		for (const s of stars) {
			L.x.fillStyle = rgba(spec.pal.star, s.o * 0.85);
			L.x.fillRect(s.x, s.y, s.s, s.s);
		}
	}
	return L;
}

export function buildRidges(S, spec) {
	const { w, h } = S;
	const MX = 40;
	const out = [];
	const variants = makePineVariants(spec.seed || 91, 8);
	spec.ridges.forEach((r, i) => {
		const lay = newLayer(S, 20 + i);
		const lw = w + MX * 2;
		lay.x.save();
		lay.x.translate(-MX, 0);
		const geo = ridgeGeo({ w: lw, h: lay.h, baseY: r.baseY * h, amp: r.amp * h, scale: r.scale * w, seed: r.seed, power: r.power ?? 1.2, x0: r.x0 ?? 0 });
		paintRidge(lay.x, geo, { ...r.pal, depth: 70, light: 1 });
		if (r.forest) {
			const f = r.forest;
			const fg = forestGeo({ w: lw, h: lay.h, ridge: geo, rows: f.rows, rowGap: f.rowGap, tree: f.tree, gap: f.gap, seed: f.seed, bottom: (f.bottom ?? spec.horizon) * h });
			paintForest(lay.x, fg, variants, f.colors);
		}
		lay.x.restore();
		out.push({ layer: lay, depth: r.depth, name: r.name, geo, MX });
	});
	return out;
}

// Edge pines left and right standing on banks. bankY(x) gives the ground height at x.
export function buildPines(S, spec, bankY) {
	const { w, h } = S;
	const lay = newLayer(S, spec.z ?? 60);
	const r = rng(spec.seed + 5);
	const pal = spec.pal;
	// bank polygons
	if (spec.banks) {
		for (const side of ["l", "r"]) {
			const x0 = side === "l" ? -20 : w * (1 - spec.banks.r) ;
			const x1 = side === "l" ? w * spec.banks.l : w + 20;
			lay.x.beginPath();
			lay.x.moveTo(x0, lay.h + 10);
			for (let x = x0; x <= x1; x += 6) lay.x.lineTo(x, bankY(side, x));
			lay.x.lineTo(x1, lay.h + 10);
			lay.x.closePath();
			const g = lay.x.createLinearGradient(0, h * 0.7, 0, h);
			g.addColorStop(0, rgba(pal.land[0]));
			g.addColorStop(1, rgba(pal.land[1]));
			lay.x.fillStyle = g;
			lay.x.fill();
		}
	}
	const variants = makePineVariants(spec.seed + 3, 8);
	const trees = [];
	const place = (side, n, big) => {
		for (let i = 0; i < n; i++) {
			const t = (i + r()) / n;
			const reach = side === "l" ? spec.reach[0] : spec.reach[1];
			const x = side === "l" ? lerp(-24, w * reach, Math.pow(t, 0.85)) : lerp(w + 24, w * (1 - reach), Math.pow(t, 0.85));
			const th = h * (big ? lerp(spec.size[1], spec.size[0], Math.pow(t, 0.7)) : lerp(spec.size[1] * 0.8, spec.size[0] * 0.85, Math.pow(t, 0.7))) * (0.85 + r() * 0.3);
			trees.push({ x, y: bankY(side, x) + 8 + r() * 10, h: th, v: (r() * 8) | 0, b: (r() * 3) | 0 });
		}
	};
	place("l", spec.count[0], true);
	place("r", spec.count[1], false);
	trees.sort((a, b) => a.y - b.y);
	paintForest(lay.x, { trees }, variants, pal.pines);
	return lay;
}

// Reflect a set of layers into a flipped, vertically-compressed buffer for the lake.
export function reflectInto(x, layers, { wy, kv, w }) {
	x.save();
	x.setTransform(1, 0, 0, -kv, 0, wy * kv);
	for (const l of layers) x.drawImage(l.c, l.dx ?? 0, 0, l.w, l.h);
	x.restore();
}
