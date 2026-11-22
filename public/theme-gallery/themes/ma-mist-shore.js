// 289: Mist Shore. A low lake along the bottom with #166-style mist drifting over it, the top aurora reflected in the water.
import { createEnv, addAurora, addShore } from "./_medium-c/kit.js";

export function activate({ root, mode, reducedMotion }) {
	return createEnv({ root, mode, reducedMotion }, async (env, alive) => {
		const aur = addAurora(env, { frac: 0.4, dim: 0.45, amp: env.dark ? 0.95 : 0.8, breathe: false });
		const shore = addShore(env, {
			frac: 0.19, seed: 289, aurora: aur, reflect: env.dark ? 0.32 : 0.6,
			mist: { count: 9, alpha: env.dark ? 0.11 : 0.7, size: [520, 980] },
		});
		return [aur, shore];
	});
}
