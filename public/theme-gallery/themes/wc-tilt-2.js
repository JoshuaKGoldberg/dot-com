import { makeWc } from "./_wc/index.js";
// #530 wc-tilt-2: #518's rigid cutout tilt x1.4, eyes following the cursor (tau 1.6 s), #519's watercolor light auroras. No per-pixel warping.
export const activate = makeWc({ mode: "plain", boost: true, tilt: { k: 1.4 }, eyeCfg: { tau: 1.6, max: 1.3, gain: 2, saccade: false } });
