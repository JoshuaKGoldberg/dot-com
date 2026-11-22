import { createEdge } from "./_fr-c/edge.js";

export function activate(args) {
	return createEdge(args, {
		hint: "Flick the pointer: the ribbon catches the wind",
		seed: 9,
		aurora: { style: "wind", scale: 5, bottom: 0.8, gain: 1.15, yb: 0.06, dip: 0.4 },
		footer: { variant: "snag", seed: 9 },
	});
}
