// 290: Loon Shore. A shoreline strip with click-to-ripple water, a loon that glides in now and then, and a soft aurora above.
import { createEnv, addAurora, addShore, addLoon, addHint } from "./_medium-c/kit.js";

export function activate({ root, mode, reducedMotion }) {
	return createEnv({ root, mode, reducedMotion }, async (env, alive) => {
		const aur = addAurora(env, { frac: 0.4, dim: 0.45, amp: env.dark ? 0.95 : 0.8 });
		const shore = addShore(env, {
			frac: 0.19, seed: 290, aurora: aur, reflect: env.dark ? 0.4 : 0.45, ripples: true,
			mist: { count: 3, alpha: env.dark ? 0.12 : 0.5, size: [420, 760] },
		});
		const loon = addLoon(env, shore, { first: 3500 });
		const hint = addHint(env, "Click the water");
		return [aur, shore, loon, hint];
	});
}
