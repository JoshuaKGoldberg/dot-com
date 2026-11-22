import { createValley } from "./_aurora-a/valley.js";

export function activate(args) {
	return createValley(args, {
		aurora: { style: "curtain", scale: 6, bands: 3, rays: 0.22, gain: 0.85, base: 0.27, hgt: 0.3, edge: 0.03 },
	});
}
