import { makeWc } from "./_wc/index.js";
// #534 wc-tilt-3-eyes-now: #531's tilt (x1.9) and timing, but the eyes head for the cursor from the first pointer move (rate-limited: one opening half-width per 3 s, slow ease in and out) after a 3.5 s wait.
export const activate = makeWc({ mode: "plain", boost: true, tilt: { k: 1.9 }, eyeCfg: { tau: 1.0, max: 2.75, gain: 3, saccade: false, immediate: true } });
