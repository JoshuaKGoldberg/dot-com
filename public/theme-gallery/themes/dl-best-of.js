/*
 * #360 Best of Delight: the calm header, the #313 paper footer, hidden twinkling margin stars,
 * one gentle physics delighter (drift seeds that ride the cursor's wake and settle), rainbow squiggles.
 */
import { calmAurora, disposer, hiddenStars, paperFooter } from "./_dl-e/kit.js";
import { driftSeeds } from "./_dl-e/seeds.js";
import { rainbowSquiggles } from "./_dl-e/squiggle.js";

export function activate({ root, reducedMotion }) {
	const d = disposer();
	const aurora = calmAurora(root, { reducedMotion });
	d.add(() => aurora.destroy());
	hiddenStars(root, d, { seed: 360, reducedMotion });
	paperFooter(root, d, { reducedMotion });
	driftSeeds(root, d, { seed: 360, reducedMotion });
	rainbowSquiggles(root, d, { reducedMotion });
	return () => d.run();
}
