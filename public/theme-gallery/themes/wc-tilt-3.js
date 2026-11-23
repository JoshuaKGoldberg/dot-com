import { makeWc } from "./_wc/index.js";
// #531 wc-tilt-3: #518's rigid cutout tilt x1.9, eyes following the cursor (tau 1.0 s), #519's watercolor light auroras. No per-pixel warping.
export const activate = makeWc({ mode: "plain", boost: true, tilt: { k: 1.9 }, eyeCfg: { tau: 1.0, max: 1.8, gain: 3, saccade: false } });
