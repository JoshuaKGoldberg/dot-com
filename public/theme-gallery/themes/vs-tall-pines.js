import { makeTheme } from "./_vs/index.js";

// #361 vs-tall-pines: pines footer 1.5x, squiggle hue by vertical position
export const activate = makeTheme({ seed: 361, scheme: "vertical", scene: "pines", mult: 1.5 });
