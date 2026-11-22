import { refined } from "./_refined-a/kit.js";

// 303 Raised Veil III
export function activate(ctx) {
	return refined(ctx, { aurora: 3, curtains: "magnetic", footer: { kind: "fog", height: 230, strength: 1 } });
}
