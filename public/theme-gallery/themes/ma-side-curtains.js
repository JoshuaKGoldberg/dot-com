import { createAuroraCanvas, clamp, smooth } from "./_medium-a/kit.js";

// Two curtains hang down the margins, full height; their glow stops at the content edges.
export function activate({ root, reducedMotion }) {
	let R = 200;
	const field = {
		prepare(S) { R = Math.max(70, (S.w - 832) / 2 + 6); },
		pixel(i, j, x, y, S) {
			const { w, h, cx, cy, phase: ph, energy } = S;
			let I = 0, T = 0;
			for (let side = 0; side < 2; side++) {
				const d0 = side === 0 ? x : w - x;
				const anchor = side === 0 ? 0 : w;
				// cursor closeness (horizontal and vertical) swells and pulls the curtain inward
				const near = Math.exp(-Math.pow((cx - anchor) / (R * 2.2), 2)) * Math.exp(-Math.pow((y - cy) / (h * 0.3), 2));
				const sway = 0.14 * R * Math.sin(y * 0.0045 + ph * 0.45 + side * 2.1) + 0.07 * R * Math.sin(y * 0.011 - ph * 0.7 + side);
				const d = d0 - sway - near * R * 0.3;
				if (d > R * 1.1) continue;
				const fold = 0.62 + 0.38 * Math.sin(y * 0.0058 + ph * 0.38 + side * 1.7) + 0.12 * Math.sin(y * 0.017 - ph * 0.6);
				const ray = 1 + (0.2 + 0.2 * energy) * (0.6 * Math.sin(d * 0.11 + ph * 0.9 + side) + 0.4 * Math.sin(d * 0.27 - ph * 1.3));
				const prof = (d < 0 ? 1 : Math.exp(-d / (R * 0.42))) * (1 - smooth(R * 0.55, R * 1.05, d));
				const v = prof * Math.max(0.2, fold) * ray * (0.7 + 0.8 * near + 0.25 * energy) * 1.15;
				I += v;
				T += clamp(0.12 + 0.5 * (d0 / R) + 0.25 * (y / h) + 0.1 * Math.sin(y * 0.004 + ph * 0.3)) * v;
			}
			S.I = I; if (I > 0) S.t = T / I;
		},
	};
	const a = createAuroraCanvas({ root, reducedMotion, host: root.querySelector(".scenery-b"), field, rest: [0.1, 0.4], clampY: [0.05, 0.95] });
	return () => a.destroy();
}
