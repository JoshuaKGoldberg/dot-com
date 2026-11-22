import { createValley } from "./_aurora-a/valley.js";

export function activate(args) {
	return createValley(args, {
		hint: "Move the pointer to bend the ribbon",
		mirror: 0.8,
		aurora: { style: "ribbon", scale: 5, bottom: 0.64 },
	});
}
