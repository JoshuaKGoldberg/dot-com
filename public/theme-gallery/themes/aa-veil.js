import { createValley } from "./_aurora-a/valley.js";

export function activate(args) {
	return createValley(args, {
		hint: "Move the pointer to gather the glow",
		lightAlpha: 1,
		aurora: { style: "wash", scale: 14, bottom: 0.66, gain: 1, idleFps: 20 },
	});
}
