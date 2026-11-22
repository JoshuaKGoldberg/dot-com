import { makeTheme } from "./_vs3/index.js";
import { LIGHT } from "./_vs3/palettes.js";

// #377 fl-blue-morning: #374's fog lake without the dock; #371's circuit edges (depth-aware) and parallax
export const activate = makeTheme({ bgFx: "sweep", seed: 377, weather: "fog", edges: "circuit", credit: "column", light: LIGHT.blueMorning, squiggle: { h0: 200, span: 300, perLink: 47, sweep: "entry", thick: 1.3, glow: 0.7, glints: 0, dur: 1.1 } });
