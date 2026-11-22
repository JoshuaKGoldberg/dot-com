import { createScene } from "./scene.js";
import { createFooter } from "./footer.js";

// Intensity ladder on #244 aa-focus under the "Update 2" placement rules: the aurora
// lives in the side margins and a thin strip at the very top (gone by ~400px scroll),
// plus the footer lake. Intensity is vividness and curtain height, never coverage.
const LEVELS = {
	6: { peak: 1.0, bottom: 0.17, base: 0.055, hgt: 0.1, rays: 0.8, lightGain: 1.0, edge: 0.55, trees: 0.7 },
	7: { peak: 1.35, bottom: 0.19, base: 0.065, hgt: 0.12, rays: 0.95, lightGain: 1.2, edge: 0.85, trees: 1 },
	8: { peak: 2.0, bottom: 0.21, base: 0.075, hgt: 0.14, rays: 1.2, lightGain: 1.5, edge: 1.2, trees: 1.3, relaxDown: 0.7 },
};

export function makeFocus(level, extra = {}) {
	const L = LEVELS[level];
	return (args) => {
		const { aurora: ax, footer = "peak", hint = "Still: soft haze. Move: crisp rays" } = extra;
		let scene = null;
		const offFooter = createFooter({ root: args.root, reducedMotion: args.reducedMotion, kind: footer, seed: level * 3 + footer.length, getAurora: () => scene?.getAurora() });
		scene = createScene({
			root: args.root, reducedMotion: args.reducedMotion, hint,
			edge: L.edge, trees: L.trees,
			aurora: {
				style: "curtain", focus: true, scale: 5, bands: 3, edge: 0.07, cornerBias: 0.93, rest: [0.1, 0.05],
				peak: L.peak, bottom: L.bottom, base: L.base, hgt: L.hgt, pullMax: 0.14, rays: L.rays, lightGain: L.lightGain, relaxDown: L.relaxDown ?? 0.9,
				...ax,
			},
		});
		return () => { offFooter(); scene.destroy(); };
	};
}
