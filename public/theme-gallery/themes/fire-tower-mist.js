import { el, div, hills, pineRidge, rng } from "./two-skies-one-shore/lib.js";

const W = 1600;
const H = 600;

function fogTile(seed, { y0, y1, count }) {
	const r = rng(seed);
	const svg = el("svg", { viewBox: `0 0 ${W * 2} ${H}`, preserveAspectRatio: "none" });
	const defs = el("defs", {}, svg);
	const f = el("filter", { id: `fb${seed}`, x: "-20%", y: "-80%", width: "140%", height: "260%" }, defs);
	el("feGaussianBlur", { stdDeviation: "26" }, f);
	const g = el("g", { filter: `url(#fb${seed})` }, svg);
	const items = [];
	for (let i = 0; i < count; i++) {
		items.push({ cx: r() * W, cy: y0 + r() * (y1 - y0), rx: 140 + r() * 260, ry: 14 + r() * 26 });
	}
	for (const copy of [0, 1]) {
		for (const s of items) {
			el("ellipse", { cx: (s.cx + copy * W).toFixed(0), cy: s.cy.toFixed(0), rx: s.rx.toFixed(0), ry: s.ry.toFixed(0) }, g);
		}
	}
	return svg;
}

export function activate({ root }) {
	const b = root.querySelector(".scenery-b");
	const stack = div("mist-stack", b);
	const r = rng(303);

	const specs = [
		{ cls: "l1", base: 280, amp: 60, waves: 6, seed: 3 },
		{ cls: "l2", base: 345, amp: 55, waves: 6, seed: 7 },
		{ cls: "l3", base: 410, amp: 42, waves: 6, seed: 12 },
		{ cls: "l4", base: 465, amp: 22, waves: 3, seed: 21, pines: 22 },
		{ cls: "l5", base: 535, amp: 14, waves: 3, seed: 34, pines: 30 },
	];
	const fogAfter = { l1: ["f1", 17, { y0: 300, y1: 420, count: 7 }], l3: ["f2", 25, { y0: 410, y1: 500, count: 7 }], l4: ["f3", 29, { y0: 480, y1: 560, count: 6 }] };

	for (const s of specs) {
		const svg = el("svg", { class: `ridge-layer ${s.cls}`, viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "xMidYMax slice" });
		const ridge = s.pines
			? pineRidge({ w: W, h: H, base: s.base, amp: s.amp, treeH: s.pines, seed: s.seed, waves: s.waves, gap: [7, 14] })
			: hills({ w: W, h: H, base: s.base, amp: s.amp, seed: s.seed, waves: s.waves });
		el("path", { d: ridge.d, class: "ridge" }, svg);

		if (s.cls === "l1") {
			// Fire tower on the highest local peak in the right-hand third.
			let bx = 1100;
			let by = Infinity;
			for (let x = 1000; x < 1500; x += 4) {
				const y = ridge.y(x);
				if (y < by) {
					by = y;
					bx = x;
				}
			}
			const tw = 8;
			const th = 26;
			const g = el("g", { transform: `translate(${bx} ${by + 1})` }, svg);
			el("path", { class: "tower-shape", d: `M${-tw / 2} 0L${-1.4} ${-th + 3}M${tw / 2} 0L${1.4} ${-th + 3}M${-tw / 2 + 0.4} ${-4}L${tw / 2 - 0.4} ${-9}M${tw / 2 - 0.4} ${-4}L${-tw / 2 + 0.4} ${-9}M${-2} ${-th + 3}L${2} ${-th + 3}` }, g);
			el("rect", { class: "tower-cab", x: -2.6, y: -th, width: 5.2, height: 3.2, rx: 0.3 }, g);
			el("path", { class: "tower-cab", d: `M-3.2 ${-th}L0 ${-th - 2.2}L3.2 ${-th}Z` }, g);
			el("circle", { class: "tower-light", cx: 0, cy: -th + 1.6, r: 1.5 }, g);
			el("circle", { class: "tower-light tower-halo", cx: 0, cy: -th + 1.6, r: 7 }, g);
		}
		if (s.cls === "l4" || s.cls === "l5") {
			// A few maples flaring orange along the near ridges.
			const n = s.cls === "l5" ? 26 : 12;
			for (let i = 0; i < n; i++) {
				const x = r() * W;
				const rad = 2.2 + r() * 3.5;
				el("circle", { class: "maple", cx: x.toFixed(0), cy: (ridge.y(x) - s.pines * 0.45 + r() * 6).toFixed(0), r: rad.toFixed(1), opacity: (0.25 + r() * 0.5).toFixed(2) }, svg);
			}
		}
		stack.appendChild(svg);

		if (fogAfter[s.cls]) {
			const [name, , cfg] = fogAfter[s.cls];
			const fog = div(`fog-layer ${name}`, stack);
			fog.appendChild(fogTile(s.seed * 7, cfg));
		}
	}
}
