import { disposer, mountBase } from "./_dl-b/base.js";
import { petals } from "./_dl-b/petals.js";
import { warmShift } from "./_dl-b/squiggles.js";

export function activate({ root, reducedMotion }) {
	const d = disposer();
	const { dark } = mountBase({ root, reducedMotion, d });
	warmShift(root, d, { reducedMotion });
	petals(root, d, { dark, reducedMotion });
	return () => d.run();
}
