import { createEdge } from "./_fr-c/edge.js";

export function activate(args) {
	return createEdge(args, {
		hint: "Move the pointer: it parts the two ribbons",
		seed: 4,
		aurora: { style: "pair", scale: 5, bottom: 0.8, gain: 1.15, yb: 0.06, dip: 0.4 },
		footer: { variant: "peak", seed: 4 },
	});
}
