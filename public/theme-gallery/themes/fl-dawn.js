import { makeTheme } from "./_vs3/index.js";
import { LIGHT } from "./_vs3/palettes.js";

// #376 fl-dawn: #374's fog lake without the dock; #371's circuit edges (depth-aware) and parallax
export const activate = makeTheme({ bgFx: "drift", seed: 376, weather: "fog", edges: "circuit", credit: "horizon", light: LIGHT.dawn, squiggle: { h0: 330, span: 300, perLink: 41, sweep: "entry", thick: 1.3, glow: 0.7, glints: 0, dur: 1.1 } });
