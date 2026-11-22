import { makeTheme } from "./_vs4/index.js";
import { LIGHT } from "./_vs4/palettes.js";

// #384 gd-tide: 40% visibility; the footer aurora swells like a tide with dwell; circuit traces route between star pads
export const activate = makeTheme({ bgFx: "cursor", seed: 384, edges: "circuit", credit: "fog", light: LIGHT.golden, squiggle: { fx: "circuit", h0: 205, span: 90, perLink: 6, dur: 2.6 },
	rest: { top: 0.2, side: 0.4, foot: 0.12 }, peak: { foot: 0.8 }, flow: 1.0, net: "circuit", swell: 0.45, up: 16, down: 18, sides: { dw: 1.15, max: 1.9, orn: 0.04 } });
