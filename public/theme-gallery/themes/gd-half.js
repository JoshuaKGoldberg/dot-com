import { makeTheme } from "./_vs4/index.js";
import { LIGHT } from "./_vs4/palettes.js";

// #381 gd-half: #378 at half visibility; large mirrored footer aurora with a sparse star-circuit field
export const activate = makeTheme({ bgFx: "cursor", seed: 381, edges: "circuit", credit: "fog", light: LIGHT.golden, squiggle: { fx: "dots", h0: 205, span: 90, perLink: 6, dur: 2.6 },
	rest: { top: 0.25, side: 0.5, foot: 0.15 }, flow: 0.45, net: "sparse", up: 12, down: 13, sides: { dw: 0.85, max: 1.8, orn: 0.025 } });
