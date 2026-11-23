import { makeWc } from "./_wc/index.js";
// #532 wc-tilt-4: #518's rigid cutout tilt x2.5 plus perspective, eyes following the cursor (tau 0.6 s), #519's watercolor light auroras. No per-pixel warping.
export const activate = makeWc({ mode: "plain", boost: true, tilt: { k: 2.5, pers: 1 }, eyeCfg: { tau: 0.6, max: 2.3, gain: 4.5, saccade: true } });
