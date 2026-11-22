// Raised top aurora (levels 1-3 relative to #282 Aurora Crown). Built on the _medium-a canvas kit.
import { createAuroraCanvas, curtain, smooth } from "../_medium-a/kit.js";

const LEVEL = { 1: 0.3, 2: 0.55, 3: 0.8 };

export function topAurora({ root, reducedMotion, level = 1 }) {
	const f = LEVEL[level] || 0.3;
	const field = curtain({
		bands: 3,
		// peak at ~4-9% of viewport height, a touch lower toward the corners
		base: (u, b, S) => S.h * (0.045 + 0.035 * Math.pow(Math.abs(2 * u - 1), 1.7) + b * 0.012),
		hgt: (u, S) => S.h * (0.05 + 0.025 * Math.abs(2 * u - 1)),
		mx: () => 1,
		fade: (y, S) => 1 - smooth(S.h * 0.12, S.h * 0.235, y),
		rayAmp: (S) => 0.22 + 0.25 * S.energy,
		edge: (S) => S.h * 0.03,
		pull: 0.14,
		sig: 0.2,
		gain: 1.75 * f * 1.3,
	});
	const a = createAuroraCanvas({ root, reducedMotion, scrollAway: true, host: root.querySelector(".scenery-b"), field, rest: [0.5, 0.06], clampY: [0, 0.16] });
	return () => a.destroy();
}
