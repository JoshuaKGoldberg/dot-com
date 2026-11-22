// _sq/draw.js: tiny SVG drawing kit shared by the squiggle themes (#454-478).
// Everything returns SVG *strings*. The resting squiggle is a data-URI background (width 100% of each line box, so wrapped lines work);
// the hover treatment is the very same drawing function called with a pixel width and a live state, mounted only while hovered.
export const TAU = Math.PI * 2;
export const r2 = (n) => Math.round(n * 100) / 100;
export const cl = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const ss = (a, b, v) => { const t = cl((v - a) / (b - a)); return t * t * (3 - 2 * t); };
export const rgba = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${Math.round(c[3] * a * 1000) / 1000})`;
export const hsla = (h, s, l, a) => `hsla(${Math.round(h)},${s}%,${l}%,${a})`;

/** polyline path of yf(x) over [x0, x1] */
export function poly(x0, x1, yf, step) {
	let d = "", x = x0;
	for (;;) { d += (d ? "L" : "M") + r2(x) + " " + r2(yf(x)); if (x >= x1) break; x = Math.min(x1, x + step); }
	return d;
}
export const sine = (y, amp, per, ph = 0) => (x) => y - amp * Math.sin((TAU * x) / per + ph);

export const path = (d, stroke, sw, extra = "", cap = "round") => `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${r2(sw)}" stroke-linecap="${cap}" stroke-linejoin="round"${extra ? " " + extra : ""}/>`;
export const pat = (id, per, H, inner) => `<pattern id="${id}" patternUnits="userSpaceOnUse" x="0" y="0" width="${per}" height="${H}">${inner}</pattern>`;
export const rect = (e, fill, mask) => `<rect width="${e.W}" height="${e.H}" fill="url(#${fill})"${mask ? ` mask="url(#${mask})"` : ""}/>`;
export const mask = (id, e, inner) => `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="-2" width="${e.W}" height="${e.H + 4}">${inner}</mask>`;

/** horizontal alpha ramp over the line box (objectBoundingBox): stops = [[offset, alpha], ...] */
export function fadeMask(id, e, stops) {
	const g = `<linearGradient id="${id}g" x1="0" x2="1" y1="0" y2="0">${stops.map(([o, a]) => `<stop offset="${r2(o)}" stop-color="#fff" stop-opacity="${r2(a)}"/>`).join("")}</linearGradient>`;
	return g + mask(id, e, `<rect width="${e.W}" height="${e.H}" fill="url(#${id}g)"/>`);
}
/** a soft band (or its inverse) around pixel x = cx, in line-local pixels */
export function bandMask(id, e, cx, r, f, inv = false) {
	const a = inv ? 1 : 0, b = inv ? 0 : 1, x1 = cx - r - f, x2 = cx + r + f, T = Math.max(1, x2 - x1);
	const g = `<linearGradient id="${id}g" gradientUnits="userSpaceOnUse" x1="${r2(x1)}" x2="${r2(x2)}" y1="0" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="${a}"/><stop offset="${r2(f / T)}" stop-color="#fff" stop-opacity="${b}"/><stop offset="${r2(1 - f / T)}" stop-color="#fff" stop-opacity="${b}"/><stop offset="1" stop-color="#fff" stop-opacity="${a}"/></linearGradient>`;
	return g + mask(id, e, `<rect width="${e.W}" height="${e.H}" fill="url(#${id}g)"/>`);
}
/** a left-to-right reveal up to pixel x (soft edge f) */
export function revealMask(id, e, x, f) {
	const x1 = x - f, x2 = x;
	const g = `<linearGradient id="${id}g" gradientUnits="userSpaceOnUse" x1="${r2(x1)}" x2="${r2(Math.max(x1 + 0.01, x2))}" y1="0" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`;
	return g + mask(id, e, `<rect width="${e.W}" height="${e.H}" fill="url(#${id}g)"/>`);
}

/** seeded noise */
export function rng(seed) {
	let a = seed >>> 0 || 1;
	return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

/** arc length of one period of a sine (for dash alignment) */
export function periodLen(amp, per) {
	let L = 0, px = 0, py = 0; const n = 64;
	for (let i = 1; i <= n; i++) { const x = (per * i) / n, y = amp * Math.sin((TAU * x) / per); L += Math.hypot(x - px, y - py); px = x; py = y; }
	return L;
}

/** horizontal alpha band in line FRACTIONS (objectBoundingBox): 1 within r of cf, ramping to 0 over f */
export function fracBand(id, e, cf, r, f, floor = 0) {
	const c = (v) => cl(v), st = [[c(cf - r - f), floor], [c(cf - r), 1], [c(cf + r), 1], [c(cf + r + f), floor]];
	return fadeMask(id, e, st);
}
/** same sampling as poly(): length of one period, for dash alignment */
export function plen(amp, per, step) {
	let L = 0, px = 0, py = 0; const n = Math.round(per / step);
	for (let i = 1; i <= n; i++) { const x = Math.min(per, i * step), y = amp * Math.sin((TAU * x) / per); L += Math.hypot(x - px, y - py); px = x; py = y; }
	return L;
}
