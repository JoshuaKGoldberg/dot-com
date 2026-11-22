import { createEdges } from "./_fr-b/edges.js";

export function activate(args) {
	return createEdges(args, {
		standHeight: 0.2,
		standDensity: 0.85,
		seed: 31,
		footer: {
			kind: "islands", seed: 31, mirror: 1.3, peakAt: 0.2,
			pal: {
				light: { skyBot: [250, 200, 200, 0.7], horizon: [255, 226, 200, 0.7], lakeTop: [214, 196, 222], lakeBot: [120, 140, 186], trees: ["#8a80a8", "#52587f", "#2a3358"] },
				dark: { lakeTop: [30, 34, 80], skyBot: [32, 26, 70, 0.78] },
			},
		},
		aurora: {
			style: "ribbon", scale: 5, bottom: 0.42, gain: 1.15, yc: 0.07, veil: 0.8, sheen: 0.5, hangK: 1.5, corner: 0.06, lightGain: 1.2, cmax: 0.8,
			colors: {
				dark: [[120, 255, 200], [90, 210, 255], [140, 130, 255], [210, 110, 255], [255, 120, 200]],
				light: [[255, 170, 190], [255, 195, 160], [200, 170, 240], [150, 190, 245], [160, 225, 210]],
			},
		},
	});
}
