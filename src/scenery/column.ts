import { interpolate, smoothstep } from "./math";

/**
 * The page's center column, in viewport pixels.
 * Background effects are weaker behind it, where there's text in front of them.
 */
export interface Column {
	/** Distance outside the column that effects take to reach full strength. */
	fade: number;

	left: number;
	right: number;

	/** Of effects inside the column, from 0 to 1. */
	strength: number;
}

/** Margins narrower than this don't have any effects of their own. */
export const minimumMargin = 72;

export function columnAlpha(
	x: number,
	{ fade, left, right, strength }: Column,
) {
	return interpolate(
		strength,
		1,
		smoothstep(0, fade, Math.max(left - x, x - right)),
	);
}

export function measureColumn(): Column {
	const { left, right } = (
		document.querySelector("main") ?? document.body
	).getBoundingClientRect();
	const styles = getComputedStyle(document.documentElement);

	return {
		fade: parseFloat(styles.getPropertyValue("--columnFade")),
		left,
		right,
		strength: parseFloat(styles.getPropertyValue("--columnStrength")) / 100,
	};
}
