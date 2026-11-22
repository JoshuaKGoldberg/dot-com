import { makeTheme } from "./_vs4/index.js";
import { LIGHT } from "./_vs4/palettes.js";

// #385 gd-bloom: starts the most subtle and blooms the most; rich star circles, nodes and circuitry; dense sides
export const activate = makeTheme({ bgFx: "cursor", seed: 385, edges: "circuit", credit: "fog", light: LIGHT.golden, squiggle: { fx: "drift", h0: 205, span: 90, perLink: 6, dur: 2.6 },
	rest: { top: 0.1, side: 0.18, foot: 0.06 }, peak: { top: 0.9, foot: 0.88 }, flow: 1.4, nearBoost: true, net: "mix", up: 10, down: 12, footAmp: 1.1, sides: { dw: 1.45, max: 2.0, orn: 0.06, double: true, alpha: 1.12, treeN: 56, link: 130 } });
