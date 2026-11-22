// _hp/mixes.js: #503-512, thin configs over the layers in layers.js
import { mix, auroraL, photoL, haloL, squiggleL, arcsL } from "./layers.js";

const aura = (o = {}) => ({ L: 9, lam: 32, A: 3, v: 0.9, a: 1, lw: 3, depth: 1.3, ...o });

// 503: everything, balanced
export const all = mix({ layers: [auroraL({ rest: 0.5, hover: 0.95 }), haloL({ amp: 0.32 }), squiggleL({ items: [aura()], rest: 0.3 })] });
// 504: aurora + one squiggle whose tint is sampled from the aurora's own colours
export const auroraSquiggle = mix({ par: 0.4, layers: [auroraL({ rest: 0.55, hover: 1 }), squiggleL({ items: [aura({ depth: 0.9 })], tint: "aurora", rest: 0.35 })] });
// 505: parallax, each squiggle ring on its own depth layer
export const parallaxRings = mix({ pad: 60, layers: [photoL({ depth: -1.2 }), squiggleL({ rest: 0.35, items: [
	{ L: 9, lam: 30, A: 3.2, v: 0.9, a: 0.55, lw: 2, depth: -1.4 }, { L: 24, lam: 38, A: 2.8, v: -0.6, a: 0.9, lw: 3, depth: 0.2 }, { L: 40, lam: 46, A: 2.6, v: 0.4, a: 0.5, lw: 2, depth: 1.8 }] })] });
// 506: the squiggle aura split into offset colour channels that follow the cursor direction
export const chromaSquiggle = mix({ par: 0.5, layers: [photoL({ fade: true, alpha: 0.6, depth: -0.6 }), squiggleL({ items: [aura({ depth: 0.4, lw: 2, A: 3.2 })], split: true, rest: 0.35 })] });
// 507: aurora backdrop + chromatic halo whose split direction and colours follow the aurora's drift
export const auroraChroma = mix({ par: 0.6, layers: [auroraL({ rest: 0.5, hover: 1 }), haloL({ amp: 0.42, hue: true })] });
// 508: parallax with crawling squiggle segments on several depth layers
export const depthArcs = mix({ pad: 60, par: 1.2, layers: [photoL({ depth: -1.2 }), arcsL({ depths: [-1.4, -0.5, 1, 1.9] })] });
// 509: the aurora is the deepest layer; a faint squiggle at rest
export const auroraParallax = mix({ par: 1.5, layers: [auroraL({ rest: 0.5, hover: 1, depth: -2, grow: 0.16 }), squiggleL({ items: [aura({ depth: 0.9, a: 0.7, lw: 2 })], rest: 0.5 })] });
// 510: each ring a colour channel, converging into one whitish line when the cursor is centred
export const chromaRings = mix({ pad: 56, par: 0.5, layers: [photoL({ fade: true, alpha: 0.55, depth: -0.6 }), squiggleL({ rest: 0.4,
	spread: (S) => 2 + 11 * S.cm, items: [0, 1, 2].map((c) => ({ L: 16, lam: 34, A: 3, v: 0.8, a: 1, lw: 2, depth: 0.5, ch: c, ph0: 0, chOff: (S, k) => (k - 1) * (1.2 + 10 * S.cm) * 1 })) })] });
// 511: the quietest blend
export const quiet = mix({ par: 0.4, speed: 0.55, layers: [auroraL({ rest: 0.28, hover: 0.7 }), squiggleL({ items: [aura({ depth: 0.6, a: 0.75, lw: 2, A: 2.6 })], rest: 0.4 })] });
// 512: the loudest
export const wild = mix({ pad: 64, par: 1.5, speed: 1.3, layers: [auroraL({ rest: 0.95, hover: 1.4, depth: -2 }), haloL({ amp: 0.7 }), squiggleL({ rest: 0.7, items: [
	{ L: 9, lam: 30, A: 3.4, v: 0.9, a: 1, lw: 3, depth: 1.5 }, { L: 25, lam: 40, A: 3, v: -0.6, a: 0.55, lw: 2, depth: 0 }, { L: 42, lam: 48, A: 2.8, v: 0.4, a: 0.35, lw: 2, depth: -1 }] }), arcsL({ L: 17, count: 4, more: 6 })] });
