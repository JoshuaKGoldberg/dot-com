import { makeTheme } from "./_vs3/index.js";
import { LIGHT } from "./_vs3/palettes.js";

// #379 fl-winter-day: #374's fog lake without the dock; #371's circuit edges (depth-aware) and parallax
export const activate = makeTheme({ bgFx: "breathe", seed: 379, weather: "fog", edges: "circuit", credit: "fog", light: LIGHT.winter, squiggle: { h0: 190, span: 300, perLink: 43, sweep: "entry", thick: 1.3, glow: 0.7, glints: 0, dur: 1.1 } });
