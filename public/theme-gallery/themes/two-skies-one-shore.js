import { el, div, hills, pineRidge, shimmerSVG, starSVG } from "./two-skies-one-shore/lib.js";

export function activate({ root }) {
	const a = root.querySelector(".scenery-a");
	const b = root.querySelector(".scenery-b");
	const c = root.querySelector(".scenery-c");

	a.appendChild(starSVG({ seed: 1701, count: 150, maxY: 0.8, maxO: 0.6 }));

	const W = 1600;
	const H = 150;
	const far = pineRidge({ w: W, h: H, base: 104, amp: 12, treeH: 20, seed: 5, gap: [8, 15] });
	const near = pineRidge({ w: W, h: H, base: 128, amp: 7, treeH: 30, seed: 9, gap: [9, 17] });
	const svg = el("svg", { class: "ridge-svg", viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "xMidYMax slice" }, c);
	el("path", { d: far.d, class: "far" }, svg);
	el("path", { d: near.d, class: "near" }, svg);

	const refl = el("svg", { class: "lake-reflection", viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "xMidYMin slice" }, b);
	el("path", { d: near.d }, refl);

	for (const [cls, seed] of [["shimmer", 31], ["shimmer shimmer-b", 77]]) {
		const s = div(cls, b);
		s.appendChild(shimmerSVG({ seed, count: 36 }));
	}
}
