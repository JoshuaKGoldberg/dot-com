// 291: Milky Corners. The Milky Way arcs through the top corners under a soft aurora along the top edge; light mode is a pale day aurora.
import { createEnv, addAurora, addMilkyCorners } from "./_medium-c/kit.js";

export function activate({ root, mode, reducedMotion }) {
	return createEnv({ root, mode, reducedMotion }, async (env) => {
		const milky = addMilkyCorners(env, { seed: 291 });
		const aur = addAurora(env, { frac: 0.38, dim: 0.5, amp: env.dark ? 0.95 : 0.85 });
		return [milky, aur];
	});
}
