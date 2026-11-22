/*
 * Margin stars: a dark-sky field of tiny dots that come up a little as the cursor nears.
 * Optional constellation: lit neighbours link up with faint, fleeting hairlines.
 */
import { reducedNow } from "./layer.js";
import { starrySky } from "../_sky/stars.js";

export function hiddenStars(root, d, { dark, reducedMotion, count = 80, seed = 341, radius = 220, constellation = false }) {
	// a dark-sky field of tiny dots (see _sky/stars.js); replaces the old flared sprites
	d.add(starrySky({ root, dark, reduced: reducedNow(reducedMotion), seed, radius, constellation, density: count / 80 }));
	return true;
}
