/* #355 Squiggle Wave: #318 valley-lake footer, calm header; squiggles become live sine waves on hover. */
import { calmAurora, disposer, hiddenStars } from "./_dl-e/kit.js";
import { waveSquiggles } from "./_dl-e/squiggle.js";
import { valleyFooter } from "./_dl-e/valley.js";

export function activate({ root, reducedMotion }) {
	const d = disposer();
	const aurora = calmAurora(root, { reducedMotion });
	d.add(() => aurora.destroy());
	hiddenStars(root, d, { seed: 355, reducedMotion });
	const off = valleyFooter({ root, reducedMotion });
	if (off) d.add(off);
	waveSquiggles(root, d, { reducedMotion });
	return () => d.run();
}
