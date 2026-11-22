/* #344 Paper & Constellations. */
import { paperBase, disposer } from "./_dl-a/base.js";
import { hiddenStars } from "./_dl-a/stars.js";
import { squiggles } from "./_dl-a/squiggle.js";

export function activate({ root, reducedMotion }) {
	const d = disposer();
	const { dark } = paperBase(root, reducedMotion, d, 344);
	hiddenStars(root, d, { dark, reducedMotion, count: 100, seed: 344, constellation: true });
	squiggles(root, d, { mode: "sparkle", dark, reducedMotion });
	return () => d.run();
}
