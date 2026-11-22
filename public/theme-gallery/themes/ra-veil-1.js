import { refined } from "./_refined-a/kit.js";

// 301 Raised Veil I
export function activate(ctx) {
	return refined(ctx, { aurora: 1, sky: "stars", footer: { kind: "valley", height: 190, strength: 0.6 } });
}
