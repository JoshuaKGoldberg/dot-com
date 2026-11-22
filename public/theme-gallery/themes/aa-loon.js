// 251: Loon Lake. A calm lake mirrors the aurora; clicks ripple the reflection; mist at the shore; a loon, rarely.
import { start } from "./_aurora-c/core.js";
import { compose, PAL } from "./_aurora-c/compose.js";
import { lake, mist, loon } from "./_aurora-c/features.js";

export function activate(a) {
	return start(a, {
		colors: (dark) => (dark ? [[0.25, 0.98, 0.6], [0.2, 0.78, 0.95], [0.66, 0.4, 1]] : [[0.35, 0.82, 0.66], [0.4, 0.66, 0.9], [0.72, 0.54, 0.92]]),
		async build(S, h) {
			const pal = S.dark ? PAL.night : PAL.day;
			const sc = await compose(S, h, {
				pal, horizon: 0.7, seed: 251, farAmp: 0.2,
				glow: S.dark ? null : { x: 0.78, y: 0.6, r: 0.5, color: [255, 238, 200], a: 0.8 },
				banks: { l: 0.26, r: 0.22, topL: 0.67, topR: 0.69 },
				size: [0.2, 0.5],
			});
			if (!sc) return null;
			const feats = [lake(S, { pal, horizon: 0.7, reflect: sc.reflect, wobble: 0.45, kv: 0.4, tap: true, hint: "Click the water to ripple the reflection", auroraAlpha: S.dark ? 0.95 : 0.55 })];
			feats.push(loon(S, { seed: 251 }));
			feats.push(mist(S, { y0: 0.6, y1: 0.8, color: pal.mist, alpha: S.dark ? 0.16 : 0.4, count: 7, size: [380, 620], speed: [1.5, 4], cluster: 0.6, seed: 12, z: 40 }));
			return feats;
		},
	});
}
