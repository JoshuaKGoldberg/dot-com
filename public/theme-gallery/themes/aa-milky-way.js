import { createNight, addBirds } from "./_aurora-d/kit.js";

// Milky Way arching over the ridges (cached canvas), aurora low on the horizon (WebGL, low-res).
export function activate({ root, reducedMotion }) {
	const scene = createNight({
		root,
		reducedMotion,
		milky: 1,
		aurora: { y0: 0.5, gap: 0.035, hgt: 0.2, gain: 1.05, flow: 1, refl: 0.35, rest: [0.62, 0.52] },
	});
	const stopBirds = addBirds(scene, { seed: 253 });
	return () => { stopBirds(); scene.destroy(); };
}
