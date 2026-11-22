import { createAuroraCanvas, curtain, smooth } from "./_medium-a/kit.js";

// Still: a soft haze in the top band. Moving: the haze sharpens into rays, then relaxes back.
export function activate({ root, reducedMotion }) {
	const c = curtain({
		bands: 3,
		base: (u, b, S) => S.h * (0.17 + b * 0.04),
		hgt: (u, S) => S.h * (0.1 + 0.02 * S.crisp),
		fade: (y, S) => 1 - smooth(S.h * 0.24, S.h * 0.36, y),
		rayAmp: (S) => 0.04 + 1.0 * S.crisp,
		edge: (S) => S.h * (0.08 - 0.055 * S.crisp),
		gain: 1.05,
		pull: 0.34,
		sig: 0.2,
	});
	const field = {
		prepare: (S) => c.prepare(S),
		pixel(i, j, x, y, S) {
			c.pixel(i, j, x, y, S);
			let I = S.I, t = S.t;
			// the resting haze: a broad wash that gives way to rays as crispness grows
			const u = x / S.w;
			const wash = (1 - 0.75 * S.crisp) * 0.42 * Math.exp(-Math.pow((y - S.h * 0.13) / (S.h * 0.12), 2)) * (0.75 + 0.25 * Math.sin(u * 2.6 + S.phase * 0.3)) * (1 - smooth(S.h * 0.22, S.h * 0.34, y)) * (0.7 + 0.5 * Math.exp(-Math.pow((x - S.cx) / (S.w * 0.25), 2)));
			const tot = I + wash;
			if (tot > 0) t = (t * I + (0.35 + 0.3 * u) * wash) / tot;
			S.I = tot; S.t = t;
		},
	};
	const a = createAuroraCanvas({ root, reducedMotion, scrollAway: true, host: root.querySelector(".scenery-b"), field, rest: [0.55, 0.12], clampY: [0, 0.35] });
	return () => a.destroy();
}
