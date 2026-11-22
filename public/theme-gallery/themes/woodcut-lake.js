import { el, rng } from "./two-skies-one-shore/lib.js";

const W = 1600;
const H = 1000;
const r1 = (n) => Math.round(n * 10) / 10;

// Chunky faceted ridge: straight-ish segments with irregular heights.
function ridgePoints(rand, { base, amp, step, seed }) {
	const pts = [];
	let phase = seed;
	for (let x = -40; x <= W + 60; x += step * (0.7 + rand() * 0.7)) {
		const y = base + Math.sin(x * 0.0042 + phase) * amp + Math.sin(x * 0.011 + phase * 2) * amp * 0.35 + (rand() - 0.5) * amp * 0.28;
		pts.push([x, y]);
	}
	return pts;
}
const yAt = (pts, x) => {
	for (let i = 1; i < pts.length; i++) {
		if (pts[i][0] >= x) {
			const [x0, y0] = pts[i - 1];
			const [x1, y1] = pts[i];
			return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
		}
	}
	return pts[pts.length - 1][1];
};
const poly = (pts, bottom) => `M${pts[0][0]} ${bottom}` + pts.map(([x, y]) => `L${r1(x)} ${r1(y)}`).join("") + `L${pts[pts.length - 1][0]} ${bottom}Z`;

export function activate({ root }) {
	const dark = document.documentElement.classList.contains("dark");
	const a = root.querySelector(".scenery-a");
	const c = root.querySelector(".scenery-c");
	const rand = rng(2024);

	const svg = el("svg", { class: "cut-svg", viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "xMidYMid slice" }, a);
	const defs = el("defs", {}, svg);

	// Ink dropout: tiny paper-coloured specks where the block didn't take ink.
	const speck = el("filter", { id: "wc-speck", x: 0, y: 0, width: "100%", height: "100%" }, defs);
	el("feTurbulence", { type: "fractalNoise", baseFrequency: "0.85", numOctaves: "2", seed: "7", result: "n" }, speck);
	el("feColorMatrix", { in: "n", type: "matrix", values: "0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  14 0 0 0 -8.9", result: "m" }, speck);
	el("feComposite", { in: "SourceGraphic", in2: "m", operator: "out" }, speck);
	// Rough edges: a touch of displacement so shapes look hand-cut.
	const rough = el("filter", { id: "wc-rough", x: "-2%", y: "-2%", width: "104%", height: "104%" }, defs);
	el("feTurbulence", { type: "fractalNoise", baseFrequency: "0.04", numOctaves: "2", seed: "3", result: "t" }, rough);
	el("feDisplacementMap", { in: "SourceGraphic", in2: "t", scale: "5", xChannelSelector: "R", yChannelSelector: "G" }, rough);

	const art = el("g", { filter: "url(#wc-speck)" }, svg);
	const cut = el("g", { filter: "url(#wc-rough)" }, art);

	// Sun / moon
	const sx = 1230;
	const sy = 245;
	const sr = 100;
	const sunG = el("g", { opacity: dark ? 0.55 : 0.6 }, cut);
	el("circle", { class: "sun", cx: sx, cy: sy, r: sr, "stroke-width": 0 }, sunG);
	if (dark) {
		// Waning crescent shadow cut into the disc, plus craters.
		el("circle", { class: "paper", cx: sx + 34, cy: sy - 14, r: sr * 0.86, "stroke-width": 0 }, sunG);
		for (let i = 0; i < 5; i++) {
			const a1 = 2.2 + i * 0.3;
			el("path", { class: "cut", d: `M${r1(sx + Math.cos(a1) * 60)} ${r1(sy + Math.sin(a1) * 60)}a${6 + i},${6 + i} 0 0 1 ${10 - i} ${6}`, "stroke-width": 2 }, sunG);
		}
	} else {
		for (const rad of [sr * 0.74, sr * 0.5]) {
			el("circle", { class: "cut nofill", cx: sx, cy: sy, r: rad, "stroke-width": 3, "stroke-dasharray": `${rad * 1.2} 9 ${rad * 0.5} 14` }, sunG);
		}
	}
	// Radiating tapered rays
	const n = dark ? 24 : 40;
	for (let i = 0; i < n; i++) {
		const ang = (i / n) * Math.PI * 2 + 0.03;
		const long = i % 2 === 0;
		const r0 = sr + 14;
		const r2 = r0 + (long ? 40 + rand() * 18 : 18 + rand() * 8);
		const wdt = long ? 0.045 : 0.03;
		const p = (rad, da) => `${r1(sx + Math.cos(ang + da) * rad)} ${r1(sy + Math.sin(ang + da) * rad)}`;
		el("path", { class: "sun", d: `M${p(r0, -wdt)}L${p(r2, 0)}L${p(r0, wdt)}Z`, "stroke-width": 0 }, sunG);
	}

	// Cloud strokes, upper left
	const clouds = el("g", { opacity: 0.22 }, cut);
	for (let i = 0; i < 9; i++) {
		const y = 120 + i * 26 + rand() * 10;
		const x = 130 + rand() * 520 - i * 8;
		const len = 90 + rand() * 260;
		el("path", { class: "ink", d: `M${r1(x)} ${r1(y)}Q${r1(x + len / 2)} ${r1(y - 4)} ${r1(x + len)} ${r1(y)}Q${r1(x + len / 2)} ${r1(y + 2.5)} ${r1(x)} ${r1(y)}Z`, "stroke-width": 0.8 }, clouds);
	}

	// Hills: three chunky layers with gouge hatching and pines on the nearest.
	const layers = [
		{ base: 585, amp: 34, step: 120, op: 0.2, hatch: 0.32, cls: "ink" },
		{ base: 640, amp: 28, step: 95, op: 0.3, hatch: 0.4, cls: "ink" },
		{ base: 690, amp: 20, step: 70, op: 0.42, hatch: 0.48, cls: "ink-deep", pines: true },
	];
	layers.forEach((L, li) => {
		const pts = ridgePoints(rand, { base: L.base, amp: L.amp, step: L.step, seed: li * 2.1 + 0.8 });
		const g = el("g", { opacity: dark ? L.op * 0.72 : L.op }, cut);
		el("path", { class: L.cls, d: poly(pts, 720), "stroke-width": 6, "stroke-linejoin": "round" }, g);
		const h = el("g", { "stroke-width": 2.1 }, g);
		for (let x = 4; x < W; x += 13) {
			const top = yAt(pts, x);
			for (let k = 0; k < 6; k++) {
				if (rand() > L.hatch - k * 0.07) continue;
				const y = top + 12 + k * 14 + rand() * 6;
				const len = 7 + rand() * 12;
				el("path", { class: "cut", d: `M${r1(x)} ${r1(y)}l${r1(len * 0.55)} ${r1(len)}` }, h);
			}
		}
		if (L.pines) {
			for (let i = 0; i < 46; i++) {
				const x = 40 + rand() * (W - 80);
				if (rand() < 0.35) continue;
				const y = yAt(pts, x) + 6;
				const s = 16 + rand() * 20;
				// tiered conifer: three stacked triangles
				let d = "";
				for (let t = 0; t < 3; t++) {
					const ty = y - s * (0.4 + t * 0.42);
					const w = s * (0.52 - t * 0.12);
					d += `M${r1(x - w)} ${r1(ty + s * 0.4)}L${r1(x)} ${r1(ty - s * 0.2)}L${r1(x + w)} ${r1(ty + s * 0.4)}Z`;
				}
				d += `M${r1(x - 1.5)} ${r1(y + s * 0.1)}h3v${r1(-s * 0.3)}h-3Z`;
				el("path", { class: "ink-deep", d, "stroke-width": 1, "stroke-linejoin": "round" }, g);
			}
		}
	});

	// Lake: sheet edge, then rows of ripple lenses that grow with depth.
	const water = el("g", { opacity: 0.45 }, cut);
	const top = 706;
	let y = top;
	let row = 0;
	while (y < H + 10) {
		const t = (y - top) / (H - top);
		const th = 1.4 + t * 4.2;
		let x = -rand() * 120;
		while (x < W) {
			const len = (24 + rand() * 90) * (0.6 + t * 1.5);
			const gap = (14 + rand() * 60) * (0.7 + t);
			if (rand() > 0.12) {
				const jy = y + (rand() - 0.5) * 2;
				const nearSun = Math.abs(x + len / 2 - sx) < 40 + t * 150;
				const cls = nearSun ? "sun" : "ink";
				const tt = nearSun ? th * 1.35 : th;
				el("path", { class: cls, d: `M${r1(x)} ${r1(jy)}Q${r1(x + len / 2)} ${r1(jy - tt)} ${r1(x + len)} ${r1(jy)}Q${r1(x + len / 2)} ${r1(jy + tt * 0.55)} ${r1(x)} ${r1(jy)}Z`, "stroke-width": 0.6, opacity: nearSun ? 0.85 : 1 }, water);
			}
			x += len + gap;
		}
		y += 8 + Math.pow(t, 1.5) * 30 + rand() * 4;
		row++;
	}

	// Paper grain (visible but muted).
	const grain = el("svg", { class: "grain", width: "100%", height: "100%" }, c);
	const gf = el("filter", { id: "wc-grain", x: 0, y: 0, width: "100%", height: "100%" }, grain);
	el("feTurbulence", { type: "fractalNoise", baseFrequency: "0.9 0.45", numOctaves: "3", seed: "11" }, gf);
	el("feColorMatrix", { type: "matrix", values: "0 0 0 0 0.45  0 0 0 0 0.38  0 0 0 0 0.28  0 0 0 -1.5 1.0" }, gf);
	el("rect", { width: "100%", height: "100%", filter: "url(#wc-grain)" }, grain);
}
