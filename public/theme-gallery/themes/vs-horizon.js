import { makeTheme } from "./_vs/index.js";

// #363 vs-horizon: sky meets a glassy lake; squiggle hue by horizontal position
export const activate = makeTheme({ seed: 363, scheme: "horizontal", scene: "horizon", mult: 2.5 });
