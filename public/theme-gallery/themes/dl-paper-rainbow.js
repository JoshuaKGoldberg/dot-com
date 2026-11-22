/* #342 Paper & Rainbow Squiggles. */
import { paperBase, disposer } from "./_dl-a/base.js";
import { dandelions } from "./_dl-a/physics.js";
import { squiggles } from "./_dl-a/squiggle.js";

export function activate({ root, reducedMotion }) {
	const d = disposer();
	const { dark } = paperBase(root, reducedMotion, d, 342);
	dandelions(root, d, { dark, reducedMotion, seed: 342 });
	squiggles(root, d, { mode: "rainbow", dark, reducedMotion });
	return () => d.run();
}
