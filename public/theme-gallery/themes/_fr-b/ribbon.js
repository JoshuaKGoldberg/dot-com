import { createEdges } from "./edges.js";

// The 6 -> 7 -> 8 ladder: same edge composition, richer at the edges. More vivid corners,
// longer side curtains, bigger stands and a lusher footer lake; never more coverage.
export const LEVELS = {
	6: { gain: 0.85, bottom: 0.36, hangK: 1.3, sheen: 0.2, veil: 0.7, stand: 0.18, footer: { kind: "peak", seed: 6, mirror: 1.1 } },
	7: { gain: 1.1, bottom: 0.46, hangK: 1.7, sheen: 0.5, veil: 0.9, stand: 0.23, footer: { kind: "tower", seed: 7, mirror: 1.3 } },
	8: { gain: 1.45, bottom: 0.58, hangK: 2.2, sheen: 0.9, veil: 1.1, stand: 0.29, footer: { kind: "camp", seed: 8, mirror: 1.5 } },
};

export function createRibbon(args, level, extra = {}) {
	const L = LEVELS[level];
	return createEdges(args, {
		footer: L.footer,
		standHeight: L.stand,
		standDensity: 0.8 + level * 0.05,
		seed: level,
		aurora: { style: "ribbon", scale: 5, bottom: L.bottom, gain: L.gain, yc: 0.07, veil: L.veil, sheen: L.sheen, hangK: L.hangK, corner: 0.06, ...extra.aurora },
		...extra.edges,
	});
}
