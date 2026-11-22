import { createEdges } from "./_fr-e/edges.js";

// 329: the lake is the star. A ribbon along the top and down the margins, and a footer lake with mirrored folds, ripple strips and click ripples.
export function activate(args) {
	return createEdges(args, {
		hint: "Scroll to the lake and click the water",
		aurora: { gain: 1.15, ribbonY: 0.09, dip: 0.2 },
		footer: { seed: 329, kind: { islands: [[0.34, 16, 1], [0.66, 30, 0.8]], snag: 0.9 }, clickRipples: true, mirror: 1.3, gain: 1.2 },
	});
}
