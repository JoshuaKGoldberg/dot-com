// 250: Misty Lake Aurora. Mist banks drift over a lake that glows with the aurora; the cursor stirs both.
import { start } from "./_aurora-c/core.js";
import { compose, PAL } from "./_aurora-c/compose.js";
import { lake, mist } from "./_aurora-c/features.js";

export function activate(a) {
	return start(a, {
		colors: (dark) => (dark ? [[0.3, 1, 0.6], [0.2, 0.8, 0.98], [0.62, 0.4, 1]] : [[0.5, 0.8, 0.72], [0.55, 0.68, 0.92], [0.92, 0.6, 0.78]]),
		amp: undefined,
		async build(S, h) {
			const pal = S.dark ? PAL.night : PAL.dawn;
			const sc = await compose(S, h, {
				pal, horizon: 0.76, seed: 250,
				glow: S.dark ? null : { x: 0.3, y: 0.7, r: 0.55, color: [255, 214, 180], a: 0.9 },
				banks: { l: 0.22, r: 0.2, topL: 0.73, topR: 0.75 },
			});
			if (!sc) return null;
			const mistCol = pal.mist;
			return [
				lake(S, { pal, horizon: 0.76, reflect: sc.reflect, wobble: 1.5, stir: true }),
				mist(S, { y0: 0.5, y1: 0.9, color: mistCol, alpha: S.dark ? 0.3 : 0.55, count: 9, size: [520, 900], speed: [3, 9], cluster: 0.9, stir: true, seed: 7, z: 40 }),
			];
		},
	});
}
