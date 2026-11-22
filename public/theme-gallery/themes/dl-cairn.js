/* #357 Cairn: #313 calm header + paper footer; a tiny rigid-body stone cairn in each bottom corner; hidden stars. */
import { calmAurora, disposer, hiddenStars, paperFooter } from "./_dl-e/kit.js";
import { cairn } from "./_dl-e/cairn.js";

export function activate({ root, reducedMotion }) {
	const d = disposer();
	const aurora = calmAurora(root, { reducedMotion });
	d.add(() => aurora.destroy());
	hiddenStars(root, d, { seed: 357, reducedMotion });
	paperFooter(root, d, { reducedMotion });
	if (innerWidth >= 900) {
		cairn(root, d, { corner: "left", seed: 357, reducedMotion });
		cairn(root, d, { corner: "right", seed: 358, reducedMotion });
	}
	return () => d.run();
}
