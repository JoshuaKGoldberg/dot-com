import { createEdges } from "./_fr-e/edges.js";

// 339: the soft-valley mood reduced to edges: a ribbon, a moon and birds along the top, spruce at the sides, a campfire lake at the end.
export function activate(args) {
	return createEdges(args, {
		hint: "Move the pointer to bend the ribbon",
		moon: 1.2,
		birds: true,
		aurora: { gain: 1.15, ribbonY: 0.1, dip: 0.18 },
		footer: { seed: 339, kind: { fire: 0.2 }, mirror: 0.9 },
	});
}
