import { disposer, mountBase } from "./_dl-b/base.js";
import { ribbons } from "./_dl-b/squiggles.js";

export function activate({ root, reducedMotion }) {
	const d = disposer();
	mountBase({ root, reducedMotion, d });
	ribbons(root, d, { reducedMotion });
	return () => d.run();
}
