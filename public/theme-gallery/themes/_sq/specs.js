// _sq/specs.js: the 25 squiggle drawings (#454-478). Each spec: { amp, per (em fractions), drop (em below baseline), hover?, draw(env) }.
// env: { dark, fs, sw, H, M (centre y), W (css width), w (px or null at rest), A (amp px), P (period px), X(f), s (state), id, seed }
// state s: p (movement progress 0..1), h (hover presence 0..1), t (abs movement px), sx (signed movement px), x (pointer px along the line), near (proximity 0..1)
import { TAU, r2, cl, ss, rgba, hsla, poly, sine, path, pat, rect, mask, fadeMask, bandMask, revealMask, fracBand, rng, plen } from "./draw.js";

const pk = (e, d, l) => (e.dark ? d : l);
const BLUE = { d: [136, 172, 232, 0.56], l: [34, 64, 140, 0.62] };
const HOT = { d: [198, 222, 255, 0.95], l: [14, 36, 108, 0.95] };
const FG = { d: [217, 227, 238, 0.34], l: [30, 41, 59, 0.4] };
const col = (e, c, a = 1) => rgba(e.dark ? c.d : c.l, a);
const aurora = (e, hs, a = 1) => hs.map((h) => (e.dark ? hsla(h, 44, 74, 0.64 * a) : hsla(h, 64, 30, 0.74 * a)));
const stopsOf = (cs) => cs.map((c, i) => `<stop offset="${r2(i / (cs.length - 1))}" stop-color="${c}"/>`).join("");

/** a periodic wave pattern; returns its <pattern> */
const wave = (e, id, c, o = {}) => {
	const amp = o.amp ?? e.A, per = o.per ?? e.P, y = o.y ?? e.M, sw = o.sw ?? e.sw;
	return pat(id, per, e.H, path(poly(-per, 2 * per, sine(y, amp, per, o.ph || 0), per / 18), c, sw, o.extra || "", o.cap));
};
const flat = (e, c, y = e.M, sw = e.sw) => `<rect y="${r2(y - sw / 2)}" width="${e.W}" height="${r2(sw)}" fill="${c}"/>`;
const gauss = (x, c, s) => Math.exp(-(((x - c) / s) ** 2));

export const SPECS = {};

/* 454 hairline: the old squiggle shape redrawn as a hairline with a smaller wave; a soft highlight follows the cursor along it */
SPECS.hairline = {
	amp: 0.06, per: 0.74, hover: true, staticP: 0.7,
	draw(e) {
		const { s } = e, id = e.id;
		let out = `<defs>${wave(e, "w" + id, col(e, BLUE, 1 + 0.2 * s.h))}</defs>${rect(e, "w" + id)}`;
		if (s.h > 0.01 && s.x != null) {
			out += `<defs>${wave(e, "v" + id, col(e, HOT, 0.9))}${bandMask("bm" + id, e, s.x, 10 + 60 * s.p, 26)}</defs><g opacity="${r2(s.h)}">${rect(e, "v" + id, "bm" + id)}</g>`;
		}
		return out;
	},
};

/* 455 native wavy: pure CSS text-decoration, no drawing */
SPECS.nativeWavy = { amp: 0, halfH: () => 0, drop: 0, rest: false, draw: () => "" };

/* 456 flat to wave: a flat hairline that curls into a wave around the cursor as it moves along the link */
SPECS.flatToWave = {
	amp: 0.07, per: 0.7, hover: true, staticP: 0.75, travel: 280,
	draw(e) {
		const { s } = e, c = col(e, BLUE, 1 + 0.25 * s.h);
		if (s.p < 0.003 || e.w == null) return flat(e, col(e, BLUE));
		const w = e.w, sig = 26 + w * 0.28, k = ss(0, 0.85, s.p), x0 = s.x ?? w / 2;
		const yf = (x) => e.M - e.A * k * (0.28 + 0.72 * gauss(x, x0, sig)) * Math.sin((TAU * x) / e.P);
		return path(poly(0, w, yf, 1.25), c, e.sw);
	},
};

/* 457 proximity: flat at rest; the wave's amplitude rises as the cursor approaches the link and settles when it leaves */
SPECS.proximity = {
	amp: 0.07, per: 0.7, hover: true, prox: true, proxR: 96, staticP: 0.7,
	draw(e) {
		const { s } = e, c = col(e, BLUE, 1 + 0.25 * s.near);
		if (e.w == null || s.near < 0.004) return flat(e, col(e, BLUE));
		const w = e.w, k = ss(0, 1, s.near), x0 = s.x ?? w / 2;
		const yf = (x) => e.M - e.A * k * (0.6 + 0.4 * gauss(x, x0, 40 + w * 0.3)) * Math.sin((TAU * x) / e.P);
		return path(poly(0, w, yf, 1.25), c, e.sw);
	},
};

/* 458 long wave: a calm swell; the swell rolls and deepens a little as the cursor moves along it */
SPECS.longWave = {
	amp: 0.05, per: 2.4, hover: true, staticP: 0.7, travel: 400,
	draw(e) {
		const { s } = e;
		const amp = e.A * (1 + 0.9 * s.p), ph = -s.sx * 0.012;
		return `<defs>${wave(e, "w" + e.id, col(e, BLUE, 1 + 0.25 * s.h), { amp, ph, per: e.P })}</defs>${rect(e, "w" + e.id)}`;
	},
};

/* 459 text tone: the text's own colour at low opacity; brightens on hover */
SPECS.textTone = {
	amp: 0.06, per: 0.7, hover: true, staticP: 0.5,
	draw(e) {
		const { s } = e;
		return `<defs>${wave(e, "w" + e.id, col(e, FG, 1 + 1.35 * s.h))}</defs>${rect(e, "w" + e.id)}`;
	},
};

/* 460 aurora tint: a faint desaturated aurora gradient along the line; the colours slide as the cursor moves */
SPECS.auroraTint = {
	amp: 0.06, per: 0.72, hover: true, staticP: 0.6, travel: 300,
	draw(e) {
		const { s } = e, id = e.id, cs = aurora(e, [200, 232, 168, 262, 200]);
		const sh = r2(0.55 * s.p);
		return `<defs>${wave(e, "w" + id, "#fff")}${mask("m" + id, e, rect(e, "w" + id))}<linearGradient id="g${id}" x1="${-sh}" x2="${r2(1 - sh)}" y1="0" y2="0" spreadMethod="reflect">${stopsOf(cs)}</linearGradient></defs><rect width="${e.W}" height="${e.H}" fill="url(#g${id})" mask="url(#m${id})" style="opacity:${r2(0.82 + 0.18 * s.h)}"/>`;
	},
};

/* 461 fade ends */
SPECS.fadeEnds = {
	amp: 0.06, per: 0.72, hover: true, staticP: 0.5,
	draw(e) {
		const { s } = e, f = 0.17 * (1 - 0.75 * s.h);
		return `<defs>${wave(e, "w" + e.id, col(e, BLUE, 1 + 0.35 * s.h))}${fadeMask("f" + e.id, e, [[0, 0], [f, 1], [1 - f, 1], [1, 0]])}</defs>${rect(e, "w" + e.id, "f" + e.id)}`;
	},
};

/* 462 tapered: stroke thick to thin along the word, built from three graded layers; on hover the thick part follows the cursor */
SPECS.tapered = {
	amp: 0.065, per: 0.72, hover: true, staticP: 0.7, travel: 300, sw: (fs) => cl(fs * 0.07, 1.2, 1.7),
	draw(e) {
		const { s } = e, id = e.id, w = e.w, c = col(e, BLUE, 1.15);
		const cf = e.w && s.x != null ? cl(s.x / w) * ss(0, 0.5, s.p) : 0;
		const sw = e.sw;
		return `<defs>${wave(e, "a" + id, c, { sw: sw * 0.42 })}${wave(e, "b" + id, c, { sw: sw * 0.78 })}${wave(e, "c" + id, c, { sw: sw * 1.2 })}${fracBand("mb" + id, e, cf, 0.05, 0.42)}${fracBand("mc" + id, e, cf, 0.01, 0.2)}</defs>${rect(e, "a" + id)}${rect(e, "b" + id, "mb" + id)}${rect(e, "c" + id, "mc" + id)}`;
	},
};

/* 463 pen: an irregular hand-drawn line, seeded per link; on hover a second, darker pass is retraced from the cursor */
const pen = (e, k, wide) => {
	const r = rng(e.seed + k * 977), w = wide, st = 1.5;
	let ph = r() * 6, d = "", y0 = (r() - 0.5) * 0.8, drift = 0;
	for (let x = 0, i = 0; x <= w + st; x += st, i++) {
		if (i % 9 === 0) drift = (r() - 0.5) * 1.1;
		const per = e.P * (0.82 + 0.4 * r()), a = e.A * (0.7 + 0.6 * r());
		ph += (TAU * st) / per;
		d += (d ? "L" : "M") + r2(x) + " " + r2(e.M + y0 + drift * 0.4 - a * Math.sin(ph));
	}
	return d;
};
SPECS.pen = {
	amp: 0.07, per: 0.62, hover: true, staticP: 0.6, tile: true, travel: 300,
	draw(e) {
		const { s } = e, w = e.w, id = e.id;
		let out = path(pen(e, 0, w), col(e, BLUE, 1), e.sw * 0.95);
		if (e.w != null && s.h > 0.01 && s.x != null) out = `<defs>${bandMask("bm" + id, e, s.x, 14 + (w * 0.6) * s.p, 14)}</defs>` + out + `<g mask="url(#bm${id})" opacity="${r2(s.h)}">${path(pen(e, 1, w), col(e, HOT, 0.8), e.sw * 0.9)}</g>`;
		return out;
	},
};

/* 464 dotted: tiny dots following the wave; around the cursor they join into a line */
SPECS.dotted = {
	amp: 0.07, per: 0.8, hover: true, staticP: 0.65, travel: 280,
	draw(e) {
		const { s } = e, id = e.id, P = e.P, n = Math.max(3, Math.round(P / (e.fs * 0.2)));
		const r = Math.max(0.6, e.sw * 0.58);
		let dots = "";
		for (let k = 0; k < n; k++) { const x = ((k + 0.5) * P) / n; dots += `<circle cx="${r2(x)}" cy="${r2(e.M - e.A * Math.sin((TAU * x) / P))}" r="${r2(r)}" fill="${col(e, BLUE, 1.15)}"/>`; }
		let out = `<defs>${pat("d" + id, P, e.H, dots)}</defs>`;
		if (e.w != null && s.h > 0.01 && s.x != null) {
			const rad = 6 + e.w * 0.6 * s.p;
			out += `<defs>${bandMask("ib" + id, e, s.x, rad, 3, true)}${bandMask("lb" + id, e, s.x, rad, 5)}</defs>${rect(e, "d" + id, "ib" + id)}<g mask="url(#lb${id})">${path(poly(0, e.w, sine(e.M, e.A, P), 1.25), col(e, BLUE, 1.05), e.sw * 0.9)}</g>`;
		} else out += rect(e, "d" + id);
		return out;
	},
};

/* 465 constellation: nodes at the crests and troughs joined by hairline edges; near the cursor nodes brighten and extra chords appear */
SPECS.constellation = {
	amp: 0.12, per: 1.0, hover: true, staticP: 0.65, travel: 300, sw: (fs) => 0.8,
	draw(e) {
		const { s } = e, id = e.id, P = e.P, A = e.A, up = e.M - A, dn = e.M + A, q = P / 4;
		const ec = col(e, BLUE, 0.85), nc = col(e, BLUE, 1.25);
		const zig = path(`M${-q} ${dn}L${q} ${up}L${3 * q} ${dn}L${5 * q} ${up}`, ec, 0.8);
		const nodes = `<circle cx="${q}" cy="${r2(up)}" r="${r2(1.15)}" fill="${nc}"/><circle cx="${3 * q}" cy="${r2(dn)}" r="0.85" fill="${nc}" opacity=".8"/>`;
		let out = `<defs>${pat("z" + id, P, e.H, zig + nodes)}</defs>${rect(e, "z" + id)}`;
		if (e.w != null && s.h > 0.01 && s.x != null) {
			const hc = col(e, HOT, 0.9);
			const chords = path(`M${-q} ${up}L${5 * q} ${up}`, hc, 0.7) + path(`M${-q} ${dn}L${5 * q} ${dn}`, hc, 0.7);
			const glow = `<circle cx="${q}" cy="${r2(up)}" r="1.9" fill="${hc}"/><circle cx="${3 * q}" cy="${r2(dn)}" r="1.5" fill="${hc}" opacity=".85"/>`;
			out += `<defs>${pat("c" + id, P, e.H, chords)}${pat("n" + id, P, e.H, glow)}${bandMask("bm" + id, e, s.x, 10 + 70 * s.p, 28)}</defs><g opacity="${r2(s.h)}"><g mask="url(#bm${id})" opacity="${r2(0.35 + 0.65 * s.p)}">${rect(e, "c" + id)}</g><g mask="url(#bm${id})">${rect(e, "n" + id)}</g></g>`;
		}
		return out;
	},
};

/* 466 stitched: a fine dashed wave; the gaps knit closed as the cursor moves */
SPECS.stitched = {
	amp: 0.065, per: 0.78, hover: true, staticP: 0.9, travel: 220,
	draw(e) {
		const { s } = e, id = e.id, P = e.P, step = P / 18, L = plen(e.A, P, step), cyc = L / 2;
		const gap = cyc * 0.42 * (1 - 0.94 * ss(0, 1, s.p)), dash = cyc - gap;
		const d = poly(-P, 2 * P, sine(e.M, e.A, P), step);
		return `<defs>${pat("w" + id, P, e.H, path(d, col(e, BLUE, 1.1), e.sw * 0.95, `stroke-dasharray="${r2(dash)} ${r2(gap)}"`, "butt"))}</defs>${rect(e, "w" + id)}`;
	},
};

/* 467 double: two ultra-thin waves out of phase; the phase between them opens as the cursor moves */
SPECS.double = {
	amp: 0.055, per: 0.78, hover: true, staticP: 0.7, travel: 280, sw: (fs) => cl(fs * 0.05, 0.8, 1.05),
	draw(e) {
		const { s } = e, id = e.id, dph = Math.PI * (0.5 + 0.5 * ss(0, 1, s.p));
		return `<defs>${wave(e, "a" + id, col(e, BLUE, 1.05), { ph: 0 })}${wave(e, "b" + id, col(e, BLUE, 0.75), { ph: dph })}</defs>${rect(e, "a" + id)}${rect(e, "b" + id)}`;
	},
};

/* 468 pixel: a stepped 1px staircase with a little decay; near the cursor pixels scatter and drift */
SPECS.pixel = {
	amp: 0.07, per: 0.9, hover: true, staticP: 0.7, travel: 260, sw: () => 1, halfH: (fs) => Math.ceil(fs * 0.07 + 5),
	draw(e) {
		const { s } = e, id = e.id, P = e.P, A = Math.max(1.5, e.A);
		const hs = []; for (let k = 0; k < P; k++) hs.push(Math.round(A * Math.sin((TAU * (k + 0.5)) / P)));
		const c = col(e, BLUE, 1.3), px = (x, y, a) => `<rect x="${x}" y="${y}" width="1" height="1" fill="${c}"${a != null ? ` opacity="${a}"` : ""}/>`;
		const base = (k) => ((k * 7 + 3) % 11 === 0 ? "" : px(k, Math.round(e.M) - hs[k % P] - 1));
		let out = `<g shape-rendering="crispEdges">`;
		if (e.w == null || s.h < 0.01 || s.x == null) {
			let tile = ""; for (let k = 0; k < P; k++) tile += base(k);
			return out + `<defs>${pat("p" + id, P, e.H, tile)}</defs>${rect(e, "p" + id)}</g>`;
		}
		const r = rng(e.seed + Math.floor(s.t / 14)), amt = s.p * ss(0, 1, s.h), sig = 22 + 50 * s.p;
		for (let x = 0; x < e.w; x++) {
			const k = x % P, g = gauss(x, s.x, sig) * amt, drop = (x * 7 + 3) % 11 === 0 && g < 0.2;
			if (drop) continue;
			let y = Math.round(e.M) - hs[k] - 1;
			if (g > 0.08) { const v = r(); if (v < g * 0.28) continue; y += Math.round((r() - 0.5) * 3 * g); if (r() < g * 0.2) out += px(x, y - 2 - Math.round(r() * 2), 0.6); }
			out += px(x, y);
		}
		return out + "</g>";
	},
};

/* 469 short tail: a short wave under the first letters, which extends along the whole link on hover (CSS only, see the stylesheet) */
SPECS.shortTail = {
	amp: 0.065, per: 0.72, drop: 0.26, rest: true,
	draw(e) { return `<defs>${wave(e, "w" + e.id, col(e, BLUE, 1.1))}${fadeMask("f" + e.id, e, [[0, 1], [0.7, 1], [1, 0]])}</defs>${rect(e, "w" + e.id, "f" + e.id)}`; },
};

/* 470 star tip: a fine squiggle that ends in a tiny four-dot star; the star twinkles as the cursor moves */
SPECS.starTip = {
	amp: 0.06, per: 0.74, hover: true, staticP: 0.7, travel: 260, halfH: (fs, sw) => Math.ceil(fs * 0.06 + 6),
	draw(e) {
		const { s } = e, id = e.id, c = col(e, BLUE, 1 + 0.4 * s.h);
		const tw = 0.5 + 0.5 * Math.sin(s.t * 0.05), dd = 3.1 + 1.5 * s.h * tw * (0.5 + s.p), sc = col(e, HOT, 0.75 + 0.2 * s.h);
		const cy = r2(e.M - 0.4), dot = (dx, dy, r, a = 1) => `<circle cx="${dx}" cy="${r2(cy + dy)}" r="${r}" fill="${sc}" opacity="${a}"/>`;
		const diag = s.h * s.p > 0.05 ? [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => dot(r2(a * dd * 0.62), r2(b * dd * 0.62), 0.38, r2(Math.min(1, s.p * 1.4) * 0.8))).join("") : "";
		const star2 = e.w == null ? `<svg x="100%" y="0" width="1" height="${e.H}" overflow="visible"><g transform="translate(-5.2 0)">${dot(0, 0, 0.95)}${dot(0, -dd, 0.55)}${dot(0, dd, 0.55)}${dot(-dd, 0, 0.55)}${dot(dd, 0, 0.55)}</g></svg>` : `<g transform="translate(${r2(e.w - 5.2)} 0)">${dot(0, 0, 0.95)}${dot(0, -dd, 0.55)}${dot(0, dd, 0.55)}${dot(-dd, 0, 0.55)}${dot(dd, 0, 0.55)}${diag}</g>`;
		return `<defs>${wave(e, "w" + id, c)}${fadeMask("f" + id, e, [[0, 0.2], [0.1, 1], [1, 1]])}</defs>${rect(e, "w" + id, "f" + id)}${star2}`;
	},
};

/* 471 hover only: no resting squiggle (links are set apart by colour, see the stylesheet); a fine wave draws in on hover or focus */
SPECS.hoverOnly = {
	amp: 0.065, per: 0.72, hover: true, staticP: 1, rest: false,
	draw(e) {
		const { s } = e, id = e.id, front = ss(0, 1, s.h) * ((e.w ?? 100) + 16);
		return `<defs>${wave(e, "w" + id, col(e, BLUE, 1.35))}${revealMask("r" + id, e, front, 16)}</defs>${rect(e, "w" + id, "r" + id)}`;
	},
};

/* 472 tilde: a row of tiny tildes; as the cursor moves they join up into a continuous wave */
SPECS.tilde = {
	amp: 0.075, per: 1.0, hover: true, staticP: 0.9, travel: 220,
	draw(e) {
		const { s } = e, id = e.id, Lt = Math.round(e.fs * 0.5), g = 0.5 - 0.47 * ss(0, 1, s.p), P = Math.max(Lt + 1, Math.round(Lt / (1 - g))), off = (P - Lt) / 2;
		const d = poly(0, Lt, (x) => e.M - e.A * 1.1 * Math.sin((TAU * x) / Lt), 1);
		const a = 0.62 + 0.6 * ss(0, 1, s.p);
		return `<defs>${pat("t" + id, P, e.H, `<g transform="translate(${r2(off)} 0)">${path(d, col(e, BLUE, a), e.sw * 0.9)}</g>`)}</defs>${rect(e, "t" + id)}`;
	},
};

/* 473 glow line: a straight ultra-thin line with a soft aurora glow below it, brightening on hover */
SPECS.glowLine = {
	amp: 0, per: 1, hover: true, staticP: 0.7, travel: 300, drop: 0.46, halfH: (fs) => 6, sw: () => 1,
	draw(e) {
		const { s } = e, id = e.id, y = e.M - 3, cs = aurora(e, [196, 176, 214], 1.15);
		const a = (e.dark ? 0.085 : 0.05) * (1 + 1.1 * s.h);
		const gl = `<linearGradient id="gv${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${cs[1]}" stop-opacity="${r2(a * 2.6)}"/><stop offset="1" stop-color="${cs[1]}" stop-opacity="0"/></linearGradient>`;
		const lc = `<linearGradient id="gh${id}" x1="0" x2="1" y1="0" y2="0">${stopsOf(cs)}</linearGradient>`;
		let out = `<defs>${gl}${lc}${fadeMask("f" + id, e, [[0, 0], [0.12, 1], [0.88, 1], [1, 0]])}</defs>`;
		out += `<rect y="${r2(y + 0.5)}" width="${e.W}" height="${r2(e.H - y - 0.5)}" fill="url(#gv${id})" mask="url(#f${id})"/>`;
		if (e.w != null && s.h > 0.01 && s.x != null) out += `<defs>${bandMask("b" + id, e, s.x, 10 + 50 * s.p, 30)}</defs><g mask="url(#b${id})"><rect y="${r2(y + 0.5)}" width="${e.W}" height="${r2(e.H - y - 0.5)}" fill="url(#gv${id})" opacity="${r2(0.8 * s.p)}"/></g>`;
		out += `<rect y="${r2(y - 0.5)}" width="${e.W}" height="1" fill="url(#gh${id})" opacity="${r2(0.85 + 0.15 * s.h)}"/>`;
		return out;
	},
};

/* 474 phase: a fine wave whose phase drifts only while the cursor moves along it, and eases back on leave */
SPECS.phase = {
	amp: 0.065, per: 0.72, hover: true, staticP: 0.5, travel: 400,
	draw(e) {
		const { s } = e;
		return `<defs>${wave(e, "w" + e.id, col(e, BLUE, 1 + 0.3 * s.h), { ph: -s.sx * 0.055 })}</defs>${rect(e, "w" + e.id)}`;
	},
};

/* 475 ink: a thin wave in deep ink whose crests bleed softly, like a fountain pen; the bleed spreads around the cursor */
SPECS.ink = {
	amp: 0.065, per: 0.74, hover: true, staticP: 0.7, travel: 280, halfH: (fs, sw) => Math.ceil(fs * 0.065 + 4),
	draw(e) {
		const { s } = e, id = e.id, P = e.P, q = P / 4, k = [e.dark ? [150, 184, 240] : [20, 40, 110]];
		const ink = rgba(e.dark ? [168, 196, 244, 0.64] : [18, 34, 100, 0.7]), blot = `<radialGradient id="bl${id}"><stop offset="0" stop-color="rgb(${k[0].join(",")})" stop-opacity="${e.dark ? 0.34 : 0.3}"/><stop offset="1" stop-color="rgb(${k[0].join(",")})" stop-opacity="0"/></radialGradient>`;
		const wavePat = (extra) => pat("w" + id, P, e.H, path(poly(-P, 2 * P, sine(e.M, e.A, P), P / 18), ink, e.sw) + extra);
		const crest = (x, r) => `<circle cx="${r2(x)}" cy="${r2(e.M - e.A)}" r="${r2(r)}" fill="url(#bl${id})"/>`;
		if (e.w == null) return `<defs>${blot}${wavePat(crest(q, 2.4))}</defs>${rect(e, "w" + id)}`;
		let dots = "";
		for (let x = q; x < e.w + P; x += P) dots += crest(x, 2.4 * (1 + 1.3 * s.p * s.h * gauss(x, s.x ?? e.w / 2, 36 + 40 * s.p)));
		return `<defs>${blot}${wavePat("")}</defs>${rect(e, "w" + id)}${dots}`;
	},
};

/* 476 low offset: a thin low wave set well below the baseline; it rises towards the text as the cursor moves */
SPECS.lowOffset = {
	amp: 0.05, per: 0.8, drop: 0.4, hover: true, staticP: 0.7, travel: 300, halfH: (fs, sw) => Math.ceil(fs * 0.05 + sw + 5),
	draw(e) {
		const { s } = e, y = e.M + 2.2 - 3.2 * ss(0, 1, s.p);
		return `<defs>${wave(e, "w" + e.id, col(e, BLUE, 1 + 0.25 * s.h), { y })}</defs>${rect(e, "w" + e.id)}`;
	},
};

/* 477 graph edge: one curved edge between two tiny nodes at the word's ends; on hover it bows toward the cursor */
SPECS.graphEdge = {
	amp: 0.05, per: 1, hover: true, staticP: 0.75, travel: 280, halfH: (fs, sw) => Math.ceil(fs * 0.05 + 7), sw: () => 1,
	draw(e) {
		const { s } = e, id = e.id, yc = e.M - 2.6, sag = 1.6 + 3.2 * ss(0, 1, s.p), ec = col(e, BLUE, 1), nc = col(e, BLUE, 1.5);
		const rN = 1.3 + 0.7 * s.h, nodes = `<circle cx="${r2(1.8)}" cy="${r2(yc)}" r="${r2(rN)}" fill="${nc}"/><g transform="translate(-1.8 0)"><circle cx="${e.X(1)}" cy="${r2(yc)}" r="${r2(rN)}" fill="${nc}"/></g>`;
		if (e.w == null) return `<defs><clipPath id="cp${id}"><rect y="${r2(yc)}" width="100%" height="${e.H}"/></clipPath></defs><ellipse cx="50%" cy="${r2(yc)}" rx="50%" ry="${r2(sag)}" fill="none" stroke="${ec}" stroke-width="1" clip-path="url(#cp${id})"/>${nodes}`;
		const w = e.w, ax = w / 2 + ((s.x ?? w / 2) - w / 2) * 0.85 * ss(0, 0.6, s.p);
		const d = `M0 ${r2(yc)}A${r2(ax)} ${r2(sag)} 0 0 0 ${r2(ax)} ${r2(yc + sag)}A${r2(w - ax)} ${r2(sag)} 0 0 0 ${r2(w)} ${r2(yc)}`;
		return path(d, col(e, BLUE, 1 + 0.3 * s.h), 1) + nodes;
	},
};

/* 478 best of: a hairline aurora-tint wave with faded ends, cursor-driven phase and a star at the tip */
SPECS.best = {
	amp: 0.055, per: 0.78, hover: true, staticP: 0.7, travel: 320, sw: (fs) => cl(fs * 0.055, 0.9, 1.15), halfH: (fs, sw) => Math.ceil(fs * 0.055 + 6),
	draw(e) {
		const { s } = e, id = e.id, cs = aurora(e, [204, 236, 170, 266, 214], 1 + 0.2 * s.h), sh = r2(0.45 * s.p);
		const tw = 0.5 + 0.5 * Math.sin(s.t * 0.05), dd = 2.9 + 1.3 * s.h * tw * (0.5 + s.p), sc = col(e, HOT, 0.7 + 0.2 * s.h), cy = r2(e.M - 0.4);
		const dot = (dx, dy, r) => `<circle cx="${dx}" cy="${r2(cy + dy)}" r="${r}" fill="${sc}"/>`;
		const sd = `${dot(0, 0, 0.9)}${dot(0, -dd, 0.5)}${dot(0, dd, 0.5)}${dot(-dd, 0, 0.5)}${dot(dd, 0, 0.5)}`;
		const star = e.w == null ? `<svg x="100%" y="0" width="1" height="${e.H}" overflow="visible"><g transform="translate(-4.8 0)">${sd}</g></svg>` : `<g transform="translate(${r2(e.w - 4.8)} 0)">${sd}</g>`;
		return `<defs>${wave(e, "w" + id, "#fff", { ph: -s.sx * 0.05 })}${mask("m" + id, e, rect(e, "w" + id))}${fadeMask("f" + id, e, [[0, 0], [0.16, 1], [0.84, 1], [1, 0.25]])}<linearGradient id="g${id}" x1="${-sh}" x2="${r2(1 - sh)}" y1="0" y2="0" spreadMethod="reflect">${stopsOf(cs)}</linearGradient></defs><g mask="url(#f${id})"><rect width="${e.W}" height="${e.H}" fill="url(#g${id})" mask="url(#m${id})"/></g>${star}`;
	},
};

/* 479 favourite: #478's aurora tint + #457's proximity + #454's cursor highlight + #461's fading ends that open up on arrival.
   Unlike the rest, while hovered/focused the wave keeps travelling (slow phase drift with a little organic amplitude modulation),
   easing in on hover and out on leave; paused / reduced motion gets a static pose. The loop stops once everything has settled. */
SPECS.favorite = {
	amp: 0.065, per: 0.78, hover: true, prox: true, proxR: 96, live: true, staticP: 0.8, nav: true, navSw: 2,
	sw: (fs) => (fs >= 20 ? 3 : 2), /* Josh: 1.5x thicker, whole px */ halfH: (fs, sw) => Math.ceil(fs * 0.065 + sw * 1.3 + 2),
	draw(e) {
		const { s } = e, id = e.id, n = e.nav ? 1 : ss(0, 1, s.near), g = s.near * s.near, tm = s.tm ?? 0, sw = e.sw; // g: wiggle level, ramps up with proximity
		const mod = 1 + g * (0.16 * Math.sin(tm * 1.7) + 0.08 * Math.sin(tm * 3.1 + 1.2));
		const amp = e.A * (0.14 + 0.86 * n) * mod;
		const ph = -(TAU * 0.9 * tm + 0.4 * g * Math.sin(tm * 1.3));
		const f = 0.17 * (1 - n), cs = aurora(e, [204, 236, 170, 266, 214], 1 + 0.2 * n), sh = r2(0.04 * tm + 0.2 * n);
		const fade = fadeMask("f" + id, e, [[0, 0], [f, 1], [1 - f, 1], [1, 0]]);
		if (e.w == null) {
			const aur = `<linearGradient id="g${id}" x1="${-sh}" x2="${r2(1 - sh)}" y1="0" y2="0" spreadMethod="reflect">${stopsOf(cs)}</linearGradient>`;
			return `<defs>${wave(e, "w" + id, "#fff", { amp, ph })}${mask("m" + id, e, rect(e, "w" + id))}${fade}${aur}</defs><g mask="url(#f${id})"><rect width="${e.W}" height="${e.H}" fill="url(#g${id})" mask="url(#m${id})"/></g>`;
		}
		// hover: an explicit path with round caps (same sine as the resting pattern), clipped by the fade only until the line has opened up
		const w = e.w, x0 = sw * 0.62, x1 = Math.max(x0 + 1, w - sw * 0.62), yf = sine(e.M, amp, e.P, ph);
		const d = poly(x0, x1, yf, e.P / 18);
		const csO = cs.map((c) => c.replace(/,[^,]*\)$/, ",1)")), op = Math.min(1, (e.dark ? 0.64 : 0.74) * (1 + 0.2 * n)); // opaque stops + one group opacity, so the end swells never double up
		const grad = `<linearGradient id="g${id}" gradientUnits="userSpaceOnUse" x1="${r2(-sh * w)}" x2="${r2((1 - sh) * w)}" y1="0" y2="0" spreadMethod="reflect">${stopsOf(csO)}</linearGradient>`;
		// rounded ends: round caps, plus the last few px stepped up to at most 1.2x the stroke (a capsule-like swell, never a blob)
		const cap = (xa, xb, k) => path(poly(Math.min(xa, xb), Math.max(xa, xb), yf, 1), `url(#g${id})`, sw * k);
		let out = `<defs>${fade}${grad}</defs><g mask="url(#f${id})"><g opacity="${r2(op)}">${path(d, `url(#g${id})`, sw)}`;
		if (n > 0.02) out += cap(x0, x0 + 9, 1 + 0.08 * n) + cap(x0, x0 + 4.5, 1 + 0.14 * n) + cap(x0, x0 + 0.5, 1 + 0.2 * n) + cap(x1 - 9, x1, 1 + 0.08 * n) + cap(x1 - 4.5, x1, 1 + 0.14 * n) + cap(x1 - 0.5, x1, 1 + 0.2 * n);
		out += "</g>";
		if (n > 0.01 && s.x != null) out += `<defs>${bandMask("bm" + id, e, s.x, 12 + 54 * n, 28)}</defs><g mask="url(#bm${id})" opacity="${r2(Math.min(1, 0.2 + 0.6 * n) * (0.7 + 0.3 * s.h))}">${path(d, col(e, HOT, 1), sw)}</g>`;
		return out + "</g>";
	},
};
