import { makeTheme } from "./_vs3/index.js";
import { LIGHT } from "./_vs3/palettes.js";

// #380 fl-blue-hour: #374's fog lake without the dock; #371's circuit edges (depth-aware) and parallax
export const activate = makeTheme({ bgFx: "follow", seed: 380, weather: "fog", edges: "circuit", credit: "legend", light: LIGHT.blueHour, squiggle: { h0: 250, span: 300, perLink: 59, sweep: "entry", thick: 1.3, glow: 0.7, glints: 0, dur: 1.1 } });
