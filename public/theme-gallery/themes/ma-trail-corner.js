// 292: Trail Corner. Star-trail arcs turn slowly around Polaris in the top-right corner, a soft aurora breathing under them.
import { createEnv, addAurora, addTrailCorner } from "./_medium-c/kit.js";

export function activate({ root, mode, reducedMotion }) {
	return createEnv({ root, mode, reducedMotion }, async (env) => {
		const aur = addAurora(env, { frac: 0.4, dim: 0.45, amp: env.dark ? 0.95 : 0.85, breathe: true });
		const trails = addTrailCorner(env, { seed: 292 });
		return [aur, trails];
	});
}
