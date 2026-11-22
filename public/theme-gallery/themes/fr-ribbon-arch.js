import { createEdge } from "./_fr-c/edge.js";

export function activate(args) {
	return createEdge(args, {
		hint: "Move the pointer: the arch bends toward it",
		seed: 2,
		aurora: { style: "arch", scale: 6, bottom: 0.9, gain: 1.7, vivid: 1.9, archBase: 0.8, archRise: 0.76 },
		footer: { variant: "tower", seed: 2 },
	});
}
