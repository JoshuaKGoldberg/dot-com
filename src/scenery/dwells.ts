import { Dwell } from "./Dwell";

/** Lives outside of any element, so that navigating doesn't reset the scenery. */
export const dwells = {
	bottom: new Dwell(),
	left: new Dwell(),
	right: new Dwell(),
	top: new Dwell(),
};
