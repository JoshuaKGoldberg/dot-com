import { createAuroraCanvas, curtain, marginness, smooth } from "./_medium-a/kit.js";

// A soft arch across the top: lower and brightest at the corners, dim above the content column.
export function activate({ root, reducedMotion }) {
	const field = curtain({
		bands: 3,
		base: (u, b, S) => S.h * (0.075 + 0.17 * Math.pow(Math.abs(2 * u - 1), 1.7) + b * 0.04),
		hgt: (u, S) => S.h * (0.1 + 0.06 * Math.abs(2 * u - 1)),
		mx: (x, S) => 0.3 + 0.9 * marginness(x, S.w, 400, 0.2),
		fade: (y, S) => 1 - smooth(S.h * 0.22, S.h * 0.38, y),
		rayAmp: (S) => 0.22 + 0.25 * S.energy,
		edge: (S) => S.h * 0.035,
		pull: 0.36,
		sig: 0.2,
		gain: 1.75,
	});
	const a = createAuroraCanvas({ root, reducedMotion, scrollAway: true, host: root.querySelector(".scenery-b"), field, rest: [0.5, 0.1], clampY: [0, 0.4] });
	return () => a.destroy();
}
