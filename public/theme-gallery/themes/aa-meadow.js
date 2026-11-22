// 252: Meadow Glow. Tall grass at the bottom sways away from the cursor; its fireflies take the aurora's colours.
import { start } from "./_aurora-c/core.js";
import { compose, PAL } from "./_aurora-c/compose.js";
import { fireflies, grass } from "./_aurora-c/features.js";

export function activate(a) {
	let auroraRef = null;
	return start(a, {
		colors: (dark) => (dark ? [[0.3, 1, 0.5], [0.2, 0.85, 0.9], [0.85, 0.4, 0.95]] : [[0.4, 0.85, 0.55], [0.4, 0.7, 0.88], [0.82, 0.55, 0.88]]),
		async build(S, h) {
			auroraRef = S.aurora;
			const pal = S.dark ? { ...PAL.night, sky: [[0, "#02060f"], [0.45, "#071a26"], [0.8, "#123a40"], [1, "#1d4f4c"]] } : { ...PAL.day, sky: [[0, "#a9d6e4"], [0.55, "#e0eadf"], [0.85, "#f4e8c4"], [1, "#f6e8c8"]] };
			const sc = await compose(S, h, {
				pal, horizon: 0.78, seed: 252,
				glow: S.dark ? null : { x: 0.2, y: 0.72, r: 0.5, color: [255, 228, 170], a: 0.85 },
				ground: { y: 0.78, edge: -0.04, top: S.dark ? [12, 38, 40] : [100, 140, 84], bottom: S.dark ? [4, 14, 18] : [42, 74, 54] },
				count: [6, 6], size: [0.16, 0.4],
			});
			if (!sc) return null;
			const D = S.dark;
			const rows = [
				{ count: 190, h: [70, 150], color: D ? ["rgb(10,40,40)", "rgb(46,120,96)"] : ["rgb(46,82,58)", "rgb(122,164,96)"], sink: 0, tip: true, w: 0.9 },
				{ count: 150, h: [60, 130], color: D ? ["rgb(6,28,30)", "rgb(28,90,74)"] : ["rgb(34,64,48)", "rgb(96,142,80)"], sink: -4, tip: true },
				{ count: 110, h: [50, 115], color: D ? ["rgb(3,16,20)", "rgb(14,56,50)"] : ["rgb(24,50,38)", "rgb(70,112,66)"], sink: -8, w: 1.15 },
			];
			const tipColors = () => [0, 1, 2].map((i) => {
				const c = auroraRef.colors[i];
				return `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${D ? 0.7 : 0.4})`;
			});
			S.hint("Move through the grass; it leans away");
			return [
				grass(S, { top: 0.62, rows, tipColors, seed: 5, z: 70 }),
				fireflies(S, { tint: true, yMin: 0.55, density: 42000, max: 26, seed: 8 }),
			];
		},
	});
}
