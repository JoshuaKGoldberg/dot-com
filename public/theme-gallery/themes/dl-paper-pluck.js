/* #341 Paper & Plucked Squiggles. */
import { paperBase, disposer } from "./_dl-a/base.js";
import { hiddenStars } from "./_dl-a/stars.js";
import { squiggles } from "./_dl-a/squiggle.js";

export function activate({ root, reducedMotion }) {
	const d = disposer();
	const { dark } = paperBase(root, reducedMotion, d, 341);
	hiddenStars(root, d, { dark, reducedMotion, count: 90, seed: 341 });
	squiggles(root, d, { mode: "pluck", dark, reducedMotion });
	return () => d.run();
}
