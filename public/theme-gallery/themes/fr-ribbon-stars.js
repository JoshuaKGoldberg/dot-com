import { createEdges } from "./_fr-e/edges.js";

// 337: a ribbon threaded under a Milky Way and star field at the top and corners; stars twinkle through the silk.
export function activate(args) {
	return createEdges(args, {
		hint: "Move the pointer to bend the ribbon",
		stars: { milky: 1, count: 1100, bright: 34 },
		aurora: { gain: 1.2, ribbonY: 0.1, dip: 0.2 },
		footer: { seed: 337, kind: { tower: 0.8 }, stars: true, mirror: 0.9 },
	});
}
