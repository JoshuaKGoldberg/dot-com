import { createNight } from "./_aurora-d/kit.js";

// Star trails painted once into a big cached canvas; CSS rotates it slowly around Polaris (compositor only).
export function activate({ root, reducedMotion }) {
	const scene = createNight({
		root,
		reducedMotion,
		trails: true,
		aurora: { y0: 0.45, gap: 0.035, hgt: 0.2, gain: 0.95, flow: 1, rest: [0.4, 0.46] },
	});
	return () => scene.destroy();
}
