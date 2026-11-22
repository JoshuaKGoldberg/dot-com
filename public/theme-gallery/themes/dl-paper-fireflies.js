/* #343 Paper & Fireflies. */
import { paperBase, disposer } from "./_dl-a/base.js";
import { fireflies } from "./_dl-a/physics.js";
import { squiggles } from "./_dl-a/squiggle.js";

export function activate({ root, reducedMotion }) {
	const d = disposer();
	const { dark } = paperBase(root, reducedMotion, d, 343);
	fireflies(root, d, { dark, reducedMotion, seed: 343 });
	squiggles(root, d, { mode: "aurora", dark, reducedMotion });
	return () => d.run();
}
