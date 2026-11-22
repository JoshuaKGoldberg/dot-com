import { refined } from "./_refined-a/kit.js";

// 302 Raised Veil II
export function activate(ctx) {
	return refined(ctx, { aurora: 2, sky: "galaxy", paper: 1 });
}
