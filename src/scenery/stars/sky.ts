import { modulo } from "../math";
import { parallaxRates } from "./createStars";

export interface Sky {
	/** How much the pointer has lingered by each margin, from 0 to 1. */
	dwell: { left: number; right: number };

	/** How far the theme is from light to dark, from 0 to 1. */
	darkness: number;

	/** Height of the repeating area stars are placed in. */
	period: number;

	scroll: number;
	width: number;
}

/** How far above the screen the repeating area starts, so wraps are never seen. */
export const overscan = 160;

/** Vertical position, in viewport pixels, of a star or anything moving with it. */
export function getScreenY(y: number, depth: number, sky: Sky) {
	return modulo(y - sky.scroll * parallaxRates[depth], sky.period) - overscan;
}
