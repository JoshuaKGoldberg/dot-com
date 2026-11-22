import { el, rng } from "./two-skies-one-shore/lib.js";

export function activate({ root }) {
	const dark = document.documentElement.classList.contains("dark");
	const b = root.querySelector(".scenery-b");
	const c = root.querySelector(".scenery-c");
	const rand = rng(606);

	const W = 1600;
	const H = 700;
	const cols = 20;
	const rows = 9;
	const svg = el("svg", { class: "mesh", viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "xMidYMin slice" }, b);

	// Grid of jittered points; rows are tighter near the horizon for perspective.
	const grid = [];
	for (let j = 0; j <= rows; j++) {
		const t = j / rows;
		const y = H * Math.pow(t, 1.45);
		const row = [];
		for (let i = 0; i <= cols; i++) {
			const cell = W / cols;
			const jx = i === 0 || i === cols ? 0 : (rand() - 0.5) * cell * 0.6 * (0.3 + t);
			const jy = j === 0 || j === rows ? 0 : (rand() - 0.5) * (H / rows) * 0.45 * (0.3 + t);
			const x = (i === 0 ? -40 : i === cols ? W + 40 : i * cell) + jx;
			row.push([x, y + jy]);
		}
		grid.push(row);
	}

	// Base colour per depth: hue drifts a little, lightness steps toward the viewer.
	const color = (t, d) => {
		if (dark) return `hsl(${224 + t * 6} ${34 + t * 6}% ${22 - t * 9 + d}%)`;
		return `hsl(${204 + t * 6} ${38 + t * 8}% ${88 - t * 10 + d}%)`;
	};

	const tri = (p, q, s, t) => {
		const poly = el("polygon", { class: "facet", points: [p, q, s].map((v) => `${v[0].toFixed(1)},${v[1].toFixed(1)}`).join(" ") }, svg);
		const amp = 1.6 + t * 2.4;
		const d1 = (rand() - 0.5) * amp;
		const d2 = (rand() - 0.5) * amp + (rand() < 0.2 ? amp * 0.7 : 0);
		poly.style.setProperty("--c1", color(t, d1));
		poly.style.setProperty("--c2", color(t, d2));
		poly.style.setProperty("--dur", `${(30 + rand() * 30).toFixed(1)}s`);
		poly.style.setProperty("--del", `${(-rand() * 60).toFixed(1)}s`);
	};

	for (let j = 0; j < rows; j++) {
		const t = (j + 0.5) / rows;
		for (let i = 0; i < cols; i++) {
			const a = grid[j][i];
			const bb = grid[j][i + 1];
			const cc = grid[j + 1][i];
			const dd = grid[j + 1][i + 1];
			if ((i + j) % 2 === 0) {
				tri(a, bb, cc, t);
				tri(bb, dd, cc, t);
			} else {
				tri(a, bb, dd, t);
				tri(a, dd, cc, t);
			}
		}
	}

	// Adirondack chair on a dock, at the right edge.
	const d = el("svg", { class: "dock-svg", viewBox: "0 0 300 150", preserveAspectRatio: "xMaxYMax meet" }, c);
	// deck + pilings
	el("path", { class: "sil", d: "M30 100H300V106H30Z", "stroke-width": 1 }, d);
	for (const x of [58, 128, 198, 268]) {
		el("path", { class: "sil", d: `M${x} 106h5v34h-5Z`, "stroke-width": 1 }, d);
	}
	el("path", { class: "sil-line", d: "M30 106H300", "stroke-width": 1 }, d);
	// chair, facing the lake (left)
	el("path", { class: "sil", d: "M203 88L250 97V101H203Z", "stroke-width": 1, "stroke-linejoin": "round" }, d);
	const slats = [
		[234, 96, 232, 52],
		[240, 97, 242, 50],
		[246, 97, 252, 50],
		[251, 98, 262, 53],
	];
	for (const [x1, y1, x2, y2] of slats) {
		el("path", { class: "sil-line", d: `M${x1} ${y1}L${x2} ${y2}`, "stroke-width": 4.2 }, d);
	}
	el("path", { class: "sil", d: "M229 52Q248 44 266 52L265 56Q248 49 230 57Z", "stroke-width": 1 }, d);
	el("path", { class: "sil", d: "M200 72L248 79L248 83L200 76Z", "stroke-width": 1, "stroke-linejoin": "round" }, d);
	el("path", { class: "sil-line", d: "M205 76V98M244 80L248 99M232 78L236 90", "stroke-width": 3 }, d);
	// a coil of rope and a cleat for texture
	el("path", { class: "sil", d: "M110 100q4 -7 8 0Z", "stroke-width": 1 }, d);
}
