import { makeTheme } from "./_vs4/index.js";
import { LIGHT } from "./_vs4/palettes.js";

// #383 gd-third: a third visibility; drifting graph nodes and edges in three parallax layers across the footer aurora
export const activate = makeTheme({ bgFx: "cursor", seed: 383, edges: "circuit", credit: "fog", light: LIGHT.golden, squiggle: { fx: "graph", h0: 205, span: 90, perLink: 6, dur: 2.6 },
	rest: { top: 0.165, side: 0.33, foot: 0.1 }, flow: 0.85, net: "graph", up: 12, down: 13, sides: { dw: 1.0, max: 1.85, orn: 0.03 } });
