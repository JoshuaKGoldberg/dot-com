import { makeTheme } from "./_vs4/index.js";
import { LIGHT } from "./_vs4/palettes.js";

// #382 gd-whisper: quarter visibility; dense constellation-and-circuit footer network that lights up near the cursor
export const activate = makeTheme({ bgFx: "cursor", seed: 382, edges: "circuit", credit: "fog", light: LIGHT.golden, squiggle: { fx: "constellation", h0: 205, span: 90, perLink: 6, dur: 2.6 },
	rest: { top: 0.125, side: 0.25, foot: 0.075 }, flow: 0.6, net: "constellation", up: 14, down: 16, sides: { dw: 1.1, max: 1.9, orn: 0.03 } });
