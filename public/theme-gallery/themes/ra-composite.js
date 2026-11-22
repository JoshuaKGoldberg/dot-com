import { refined } from "./_refined-a/kit.js";

// 320 The Composite
export function activate(ctx) {
	return refined(ctx, { aurora: 2, sky: "both", skyDensity: 0.7, galaxy: 0.75, curtains: "fieldline", paper: 0.8, footer: { kind: "valley", height: 240, strength: 0.8 } });
}
