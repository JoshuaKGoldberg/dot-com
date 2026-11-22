// 249: Fireflies Under the Aurora. A meadow below the ridges; fireflies gather to a resting cursor.
import { start } from "./_aurora-c/core.js";
import { compose, PAL } from "./_aurora-c/compose.js";
import { fireflies } from "./_aurora-c/features.js";

export function activate(a) {
	return start(a, {
		colors: (dark) => (dark ? [[0.3, 1, 0.55], [0.2, 0.82, 0.95], [0.7, 0.4, 1]] : [[0.35, 0.85, 0.6], [0.4, 0.68, 0.9], [0.75, 0.55, 0.9]]),
		async build(S, h) {
			const pal = S.dark ? PAL.night : { ...PAL.day, sky: [[0, "#a9cfe8"], [0.55, "#e4e6dc"], [0.85, "#f6e2bf"], [1, "#f8e4c2"]] };
			const sc = await compose(S, h, {
				pal, horizon: 0.8, seed: 249,
				glow: S.dark ? null : { x: 0.82, y: 0.7, r: 0.5, color: [255, 224, 170], a: 0.85 },
				ground: { y: 0.8, edge: -0.05, top: S.dark ? [14, 36, 42] : [88, 128, 84], bottom: S.dark ? [5, 12, 20] : [38, 66, 52] },
				count: [8, 7], size: [0.18, 0.46],
			});
			if (!sc) return null;
			S.hint("Hold the cursor still and the fireflies gather");
			return [fireflies(S, { rgb: S.dark ? [214, 255, 120] : [232, 160, 20], yMin: 0.42, density: 26000, max: 40, seed: 31 })];
		},
	});
}
