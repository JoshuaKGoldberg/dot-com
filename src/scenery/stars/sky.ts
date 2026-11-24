import { modulo } from "../math";

export interface Sky {
	darkness: number;
	dwell: { left: number; right: number };

	/** Height of the repeating area stars are placed in. */
	period: number;

	scroll: number;
	width: number;
}

/** How far above the screen the repeating area starts, so wraps are never seen. */
export const overscan = 160;

/** How far stars at each depth scroll per pixel the page scrolls. */
export const parallaxRates = [0.024, 0.11, 0.23];

/** Depth whose stars sit among the graphs, and so are linked with them. */
export const linkedDepth = 1;

/** Vertical position, in viewport pixels, of a star or anything moving with it. */
export function getScreenY(y: number, depth: number, sky: Sky) {
	return modulo(y - sky.scroll * parallaxRates[depth], sky.period) - overscan;
}
