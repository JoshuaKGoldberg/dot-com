/* #354 Squiggle Spotlight: #313 calm header + paper footer; a rainbow spotlight rides each squiggle under the cursor. */
import { calmAurora, disposer, hiddenStars, paperFooter } from "./_dl-e/kit.js";
import { spotlightSquiggles } from "./_dl-e/squiggle.js";

export function activate({ root, reducedMotion }) {
	const d = disposer();
	const aurora = calmAurora(root, { reducedMotion });
	d.add(() => aurora.destroy());
	hiddenStars(root, d, { seed: 354, reducedMotion });
	paperFooter(root, d, { reducedMotion });
	spotlightSquiggles(root, d, { reducedMotion });
	return () => d.run();
}
