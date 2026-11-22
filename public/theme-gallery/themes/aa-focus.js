import { createValley } from "./_aurora-a/valley.js";

export function activate(args) {
	return createValley(args, {
		hint: "Still: soft haze. Move: crisp rays",
		aurora: { style: "curtain", focus: true, scale: 5, bands: 3, rays: 0.9, base: 0.27, hgt: 0.3, edge: 0.03 },
	});
}
