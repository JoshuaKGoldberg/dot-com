// Shared aurora colour sets and a season/pine palette builder.
import { hexify, mapColors, night, mixC } from "./scene.js";
export const AUR_DARK = { a: [[0.2, 1, 0.55], [0.1, 0.85, 0.75], [0.6, 0.35, 1]], b: [[0.15, 0.95, 0.7], [0.15, 0.7, 0.9], [0.75, 0.3, 0.95]] };
export const AUR_LIGHT = { a: [[0.4, 0.82, 0.66], [0.45, 0.72, 0.88], [0.78, 0.6, 0.95]] };
export const NIGHT_SKY = hexify([[0, "#050a1c"], [0.5, "#0c1836"], [0.85, "#1b2d58"]]);
export const SNOW_NIGHT = [150, 176, 210];

// day palette from compact season spec
export function seasonPalette(o) {
	const P = hexify(o);
	const sh = (c, k) => mixC(c, [8, 14, 30], k);
	P.far = { top: P.farT, bottom: P.farB, shade: mixC(P.farT, [40, 60, 100], 0.5) };
	P.mid = { top: P.midT, bottom: P.midB, shade: mixC(P.midT, [40, 60, 90], 0.45) };
	P.hills = { top: P.hillT, bottom: P.hillB, shade: mixC(P.hillT, [20, 40, 50], 0.45) };
	if (!P.sky) P.sky = [[0, P.skyT], [0.5, P.skyM], [0.85, P.skyH]];
	P.pineMid = P.pine.map((c) => mixC(c, P.midB, 0.42));
	P.pineShore = P.pine;
	P.fgPine = P.pine.map((c) => sh(c, 0.2));
	return P;
}
export function nightify(P, { sky = NIGHT_SKY, land = null, horizon = null } = {}) {
	const N = mapColors(P, (c) => night(c, 1));
	N.sky = sky; N.snowCol = SNOW_NIGHT;
	if (land) N.land = land;
	N.mist = [110, 140, 190]; N.mistA = 0.2;
	if (horizon) { N.horizon = horizon; N.horizonA = 0.22; } else N.horizon = null;
	return N;
}
export const AUR_EQ_DARK = { a: [[0.2, 1, 0.5], [0.45, 0.95, 0.4], [0.85, 0.25, 0.35]], b: [[1, 0.3, 0.35], [0.95, 0.3, 0.5], [0.6, 0.2, 0.6]] };
export const AUR_EQ_LIGHT = { a: [[0.4, 0.82, 0.6], [0.6, 0.8, 0.5], [0.92, 0.55, 0.55]], b: [[0.95, 0.55, 0.55], [0.95, 0.55, 0.65], [0.78, 0.5, 0.8]] };
