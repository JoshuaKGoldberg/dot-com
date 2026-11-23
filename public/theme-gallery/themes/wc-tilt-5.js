import { makeWc } from "./_wc/index.js";
// #533 wc-tilt-5: #518's rigid cutout tilt x3.2 plus perspective, eyes following the cursor (tau 0.35 s), #519's watercolor light auroras. No per-pixel warping.
export const activate = makeWc({ mode: "plain", boost: true, tilt: { k: 3.2, pers: 1.6 }, eyeCfg: { tau: 0.35, max: 2.75, gain: 7, saccade: true } });
