import { makeWc } from "./_wc/index.js";
// #529 wc-tilt-1: #518's rigid cutout tilt x1.0, eyes following the cursor (tau 2.5 s), #519's watercolor light auroras. No per-pixel warping.
export const activate = makeWc({ mode: "plain", boost: true, tilt: { k: 1.0 }, eyeCfg: { tau: 2.5, max: 0.8, gain: 1.2, saccade: false } });
