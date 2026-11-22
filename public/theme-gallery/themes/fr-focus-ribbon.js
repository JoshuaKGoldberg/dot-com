import { createEdge } from "./_fr-c/edge.js";

export function activate(args) {
	return createEdge(args, {
		hint: "Still: soft haze. Move: crisp silk",
		seed: 6,
		aurora: { style: "focusribbon", focus: true, rays: 0.9, scale: 5, bottom: 0.8, gain: 1.15, yb: 0.06, dip: 0.4 },
		footer: { variant: "campfire", seed: 6 },
	});
}
