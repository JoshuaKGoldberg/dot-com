// Shared Adirondack scenery: High Peaks, a forested shore, a lake, foreground spruce and birch.
// Everything is static SVG/CSS built once; only the shimmer and clouds drift (compositor transforms).
import { el, div, rng, pineRidge, starSVG, shimmerSVG } from "../two-skies-one-shore/lib.js";

const f = (n) => Math.round(n * 10) / 10;

export function peakPath({ seed, w = 1600, h = 380, base = 380, peaks, jitter = 2.2, step = 8, shift = 0, teeth = 0 }) {
	const r = rng(seed);
	const ph = [r() * 6, r() * 6, r() * 6];
	const y = (x) => {
		let v = 0;
		for (const [c, ht, wd] of peaks) v = Math.max(v, ht * Math.exp(-Math.pow(Math.abs(x - c) / wd, 1.55)));
		v += Math.sin(x * 0.021 + ph[0]) * jitter + Math.sin(x * 0.057 + ph[1]) * jitter * 0.6 + Math.sin(x * 0.13 + ph[2]) * jitter * 0.35;
		return base - v + shift + (teeth ? (Math.floor(x / step) % 2 ? teeth : -teeth) * (0.4 + r() * 0.8) : 0);
	};
	let d = `M-10 ${h + 10}`;
	for (let x = -10; x <= w + 10; x += step) d += `L${f(x)} ${f(y(x))}`;
	return { d: d + `L${w + 10} ${h + 10}Z`, y };
}

// A layered spruce. Returns an SVG path 'd' (and optional snow highlight path).
export function spruce(cx, base, h, w, r, snow) {
	const n = Math.max(4, Math.round(h / 34));
	const top = base - h;
	const step = (h * 0.9) / n;
	const right = [], left = [], hi = [];
	for (let i = 0; i < n; i++) {
		const y0 = top + i * step * 0.95;
		const hw = w * (0.22 + 0.78 * ((i + 1) / n)) * (0.9 + r() * 0.2);
		right.push(`L${f(cx + hw * 0.34)} ${f(y0 + step * 0.35)}`, `Q${f(cx + hw * 0.8)} ${f(y0 + step * 0.78)} ${f(cx + hw)} ${f(y0 + step * 1.12)}`);
		left.unshift(`L${f(cx - hw * 0.34)} ${f(y0 + step * 0.35)}`, `Q${f(cx - hw * 0.8)} ${f(y0 + step * 0.78)} ${f(cx - hw)} ${f(y0 + step * 1.12)}`);
		if (snow) hi.push(`M${f(cx - hw * 0.7)} ${f(y0 + step * 0.85)}Q${f(cx)} ${f(y0 + step * 0.45)} ${f(cx + hw * 0.7)} ${f(y0 + step * 0.85)}`);
	}
	const tb = base - h * 0.04;
	const d = `M${f(cx)} ${f(top)}${right.join("")}L${f(cx + 3)} ${f(tb)}L${f(cx + 3)} ${f(base)}L${f(cx - 3)} ${f(base)}L${f(cx - 3)} ${f(tb)}${left.join("")}Z`;
	return { d, hi: hi.join("") };
}

function birch(g, cx, base, h, r, cls = "birch") {
	const w = 4 + r() * 2;
	el("path", { d: `M${f(cx - w / 2)} ${base}L${f(cx - w / 2 + 0.6)} ${f(base - h)}L${f(cx + w / 2 - 0.6)} ${f(base - h)}L${f(cx + w / 2)} ${base}Z`, class: cls }, g);
	for (let y = base - 14; y > base - h + 10; y -= 12 + r() * 16) {
		el("rect", { x: f(cx - w / 2 + 0.3), y: f(y), width: f(w * (0.4 + r() * 0.5)), height: f(1.4 + r() * 1.6), class: "birch-mark" }, g);
	}
	// A couple of bare-ish branches with leaf clusters.
	for (let i = 0; i < 3; i++) {
		const by = base - h * (0.5 + i * 0.18), dir = i % 2 ? 1 : -1, len = 18 + r() * 22;
		el("path", { d: `M${cx} ${f(by)}Q${f(cx + dir * len * 0.5)} ${f(by - 8)} ${f(cx + dir * len)} ${f(by - 18)}`, class: "birch-branch", fill: "none" }, g);
		el("ellipse", { cx: f(cx + dir * len), cy: f(by - 20), rx: f(10 + r() * 7), ry: f(7 + r() * 5), class: "leaf" }, g);
	}
	el("ellipse", { cx, cy: f(base - h - 4), rx: f(14 + r() * 6), ry: f(10 + r() * 4), class: "leaf" }, g);
}

function sideTrees(seed, snow, flip, tops) {
	const r = rng(seed);
	const svg = el("svg", { viewBox: "0 0 400 900", preserveAspectRatio: "xMinYMax slice", class: `sc-trees ${flip ? "sc-trees-r" : "sc-trees-l"}` });
	const specs = [[34, 760, 150], [150, 520, 112], [250, 360, 86], [330, 250, 64]];
	const back = el("g", { class: "tree-back" }, svg);
	const front = el("g", { class: "tree-front" }, svg);
	specs.forEach(([cx, h, w], i) => {
		const jx = cx + (r() - 0.5) * 20;
		const s = spruce(jx, 912, h, w, r, snow);
		tops.push({ x: jx, y: 912 - h });
		el("path", { d: s.d, class: i % 2 ? "spruce spruce-b" : "spruce" }, i < 2 ? front : back);
		if (snow) el("path", { d: s.hi, class: "snow-hi", fill: "none" }, i < 2 ? front : back);
	});
	if (!snow) {
		const bg = el("g", {}, front);
		birch(bg, 214, 912, 480, r);
		birch(bg, 296, 912, 300, r);
	}
	// Low brush
	for (let i = 0; i < 7; i++) el("ellipse", { cx: f(10 + i * 62 + r() * 24), cy: f(906 - r() * 12), rx: f(34 + r() * 22), ry: f(18 + r() * 12), class: "brush" }, svg);
	return svg;
}

export function islandSVG({ rx, seed, snow = false }) {
	const r = rng(seed);
	const ry = rx * 0.22;
	const th = rx * 1.05;
	const svg = el("svg", { viewBox: `${-rx - 12} ${-th - 10} ${rx * 2 + 24} ${th + ry + 22}`, width: rx * 2 + 24, height: th + ry + 22, class: "island-svg" });
	el("ellipse", { cx: 0, cy: ry * 0.75, rx: rx * 1.04, ry: ry * 0.6, class: "island-shadow" }, svg);
	el("path", { d: `M${-rx} 0Q${-rx * 0.6} ${-ry * 1.2} 0 ${-ry * 1.1}Q${rx * 0.6} ${-ry * 1.2} ${rx} 0Q${rx * 0.5} ${ry * 1.1} 0 ${ry} Q${-rx * 0.5} ${ry * 1.1} ${-rx} 0Z`, class: "island-rock" }, svg);
	const n = Math.max(2, Math.round(rx / 20));
	const items = Array.from({ length: n }, (_, i) => ({ x: (-0.7 + (1.4 * (i + r() * 0.5)) / n) * rx, h: th * (0.4 + r() * 0.6) }))
		.sort((a, b) => a.h - b.h);
	svg._trees = [];
	for (const t of items) {
		const s = spruce(t.x, -ry * 0.2 + r() * 3, t.h, t.h * 0.34, r, snow);
		svg._trees.push(s.d);
		el("path", { d: s.d, class: "spruce island-tree" }, svg);
		if (snow) el("path", { d: s.hi, class: "snow-hi", fill: "none" }, svg);
	}
	return svg;
}

export function buildScene(root, o = {}) {
	const { seed = 11, lakeTop = 0.7, snow = false, stars = true, mist = true, trees = true } = o;
	const A = root.querySelector(".scenery-a");
	const B = root.querySelector(".scenery-b");
	const C = root.querySelector(".scenery-c");
	root.style.setProperty("--lake-top", `${lakeTop * 100}%`);
	root.classList.add("sc");
	if (snow) root.classList.add("sc-snow");

	// Sky
	div("sc-sun", A);
	const clouds = div("sc-clouds", A);
	div("sc-wisp sc-wisp-a", clouds);
	div("sc-wisp sc-wisp-b", clouds);
	if (stars) {
		const s = starSVG({ seed: seed + 3, count: 120, maxY: 0.62, maxO: 0.65, twinkleShare: 0.2 });
		s.setAttribute("class", "stars-svg sc-stars");
		A.appendChild(s);
	}

	// Mountains: far High Peaks, mid ridge, forest-line cutouts leave bald summits.
	const W = 1600, H = 380;
	const r = rng(seed);
	const mk = (cx) => [cx, 150 + r() * 140, 150 + r() * 110];
	const farPeaks = [mk(180 + r() * 80), mk(560 + r() * 80), mk(930 + r() * 60), mk(1330 + r() * 80)];
	const far = peakPath({ seed, peaks: farPeaks, base: 380, jitter: 3.4 });
	const midPeaks = [[130, 96, 130], [470, 70, 150], [820, 112, 160], [1180, 84, 130], [1500, 100, 140]];
	const mid = peakPath({ seed: seed + 1, peaks: midPeaks, base: 372, jitter: 2.2, teeth: 1.6, step: 7 });
	const midForest = peakPath({ seed: seed + 2, peaks: midPeaks, base: 372, jitter: 2.2, shift: 20, teeth: 2.6, step: 6 });
	const peaksSvg = el("svg", { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "xMidYMax slice", class: "sc-peaks" }, B);
	el("path", { d: far.d, class: "pk-far" }, peaksSvg);
	const farForest = peakPath({ seed, peaks: farPeaks, base: 380, jitter: 3.4, shift: 38, teeth: 2, step: 7 });
	const cp = el("clipPath", { id: `cp-far-${seed}` }, peaksSvg);
	el("path", { d: far.d }, cp);
	el("path", { d: farForest.d, class: "pk-far-forest", "clip-path": `url(#cp-far-${seed})` }, peaksSvg);
	el("path", { d: mid.d, class: "pk-mid-rock" }, peaksSvg);
	const cp2 = el("clipPath", { id: `cp-mid-${seed}` }, peaksSvg);
	el("path", { d: mid.d }, cp2);
	el("path", { d: midForest.d, class: "pk-mid", "clip-path": `url(#cp-mid-${seed})` }, peaksSvg);
	if (mist) div("sc-mist", B);

	// Lake
	const lake = div("sc-lake", B);
	const refl = el("svg", { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "xMidYMin slice", class: "sc-reflect" }, lake);
	el("path", { d: far.d, class: "pk-far" }, refl);
	el("path", { d: mid.d, class: "pk-mid" }, refl);
	const sh = div("sc-shimmer", lake);
	sh.appendChild(shimmerSVG({ seed: seed + 9, count: 34, height: 140 }));
	div("sc-lake-glow", lake);

	// Shoreline pines at the horizon, then a nearer bank.
	const shore = el("svg", { viewBox: "0 0 1600 150", preserveAspectRatio: "xMidYMax slice", class: "sc-shore" }, C);
	const sr = pineRidge({ w: 1600, h: 150, base: 120, amp: 8, treeH: 26, seed: seed + 4, gap: [7, 13] });
	el("path", { d: sr.d, class: "pk-shore" }, shore);
	if (o.nearBank !== false) {
		const bank = el("svg", { viewBox: "0 0 1600 150", preserveAspectRatio: "xMidYMax slice", class: "sc-bank" }, C);
		const nr = pineRidge({ w: 1600, h: 150, base: 132, amp: 6, treeH: 34, seed: seed + 5, gap: [9, 17] });
		el("path", { d: nr.d, class: "pk-bank" }, bank);
	}
	const tops = { l: [], r: [] };
	if (trees) {
		C.appendChild(sideTrees(seed + 6, snow, false, tops.l));
		C.appendChild(sideTrees(seed + 7, snow, true, tops.r));
	}
	const birdLayer = div("sc-birds", C);
	// Where the spruce apexes land in the layer (fractions), mirroring the SVG's xMinYMax slice.
	const treePerches = () => {
		const W = birdLayer.clientWidth || innerWidth, Hh = birdLayer.clientHeight || innerHeight;
		const wt = Math.min(0.32 * innerWidth, 420);
		const s = Math.max(wt / 400, Hh / 900);
		const out = [];
		for (const [side, list] of [["l", tops.l], ["r", tops.r]]) {
			list.forEach((t, i) => {
				const x = side === "l" ? t.x * s : W - t.x * s;
				const y = Hh - (900 - t.y - 10) * s;
				if (y > 24 && y < Hh * 0.82) out.push({ x: x / W, y: y / Hh, face: side === "l" ? 1 : -1, side, i });
			});
		}
		return out;
	};
	const vbPoint = (side, vx, vy) => {
		const W = birdLayer.clientWidth || innerWidth, Hh = birdLayer.clientHeight || innerHeight;
		const wt = Math.min(0.32 * innerWidth, 420);
		const s = Math.max(wt / 400, Hh / 900);
		const x = side === "l" ? vx * s : W - vx * s;
		return { x: x / W, y: (Hh - (900 - vy) * s) / Hh };
	};
	return { A, B, C, birdLayer, treePerches, vbPoint, lakeTop };
}

// A few small birds on the spruce tops plus a loon on the lake. Returns { stop }.
import { createFlock } from "./birds.js";

export function ambientBirds(scene, { mode, reduced, seed = 3, kinds, loon = true, extraPerches = [] }) {
	const dark = mode === "dark";
	const species = kinds || (dark ? ["owl", "chickadee", "sawwhet"] : ["chickadee", "goldfinch", "jay", "nuthatch"]);
	const perches = scene.treePerches();
	const water = [];
	if (loon) {
		const lt = scene.lakeTop;
		for (const [x, y] of [[0.42, 0.32], [0.55, 0.5], [0.5, 0.7]]) water.push({ x, y: lt + (1 - lt) * y, face: 1, water: true });
	}
	const flock = createFlock(scene.birdLayer, {
		species: loon ? [...species, "loon"] : species,
		perches: [...perches, ...extraPerches, ...water],
		reduced,
		seed,
		size: 1.5,
	});
	// Keep tree perches in step with the viewport.
	let t = 0;
	const onResize = () => {
		clearTimeout(t);
		t = setTimeout(() => {
			const fresh = scene.treePerches();
			const trees = flock.perches.filter((p) => p.side);
			trees.forEach((p, i) => {
				if (fresh[i]) Object.assign(p, fresh[i]);
			});
			for (const b of flock.birds) if (!b.busy && b.perch) flock.place(b, b.perch, b.face);
		}, 150);
	};
	addEventListener("resize", onResize);
	flock.start();
	return {
		flock,
		stop() {
			clearTimeout(t);
			removeEventListener("resize", onResize);
			flock.stop();
		},
	};
}
