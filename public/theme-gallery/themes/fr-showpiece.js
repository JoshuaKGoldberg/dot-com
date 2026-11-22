import { createEdges } from "./_fr-e/edges.js";

// 340: ribbon + focus (soft at rest, rayed while moving), moon, birds and stars at the top and corners; the lushest footer.
export function activate(args) {
	return createEdges(args, {
		hint: "Still: soft silk. Move: crisp rays",
		moon: 1.1,
		birds: true,
		standHeight: 0.4,
		stars: { milky: 0.5, count: 800, bright: 22 },
		aurora: { focus: true, rays: 0.9, gain: 1.3, ribbonY: 0.1, dip: 0.22 },
		footer: { seed: 340, height: 360, big: true, kind: { peak: 0.68, snag: 0.07, fire: 0.27, islands: [[0.56, 22, 0.9]] }, stars: true, clickRipples: true, mirror: 1.1, focus: true },
	});
}
