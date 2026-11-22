import { makeTheme } from "./_vs3/index.js";
import { LIGHT } from "./_vs3/palettes.js";

// #378 fl-golden: #374's fog lake without the dock; #371's circuit edges (depth-aware) and parallax
export const activate = makeTheme({ bgFx: "cursor", seed: 378, weather: "fog", edges: "circuit", credit: "chart", light: LIGHT.golden, squiggle: { h0: 40, span: 300, perLink: 53, sweep: "entry", thick: 1.3, glow: 0.7, glints: 0, dur: 1.1 } });
