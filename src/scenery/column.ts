import { smoothstep } from "./math";

/** Horizontal bounds of the page's center column, in viewport pixels. */
export interface Column {
	left: number;
	right: number;
}

/** How strong background effects are behind the center column's text. */
const columnStrength = 0.5;

/** How far outside the column effects take to reach full strength. */
const columnFade = 160;

/** Margins narrower than this don't have any effects of their own. */
export const minimumMargin = 72;

export function columnAlpha(x: number, column: Column) {
	const distance = Math.max(column.left - x, x - column.right);

	return (
		columnStrength + (1 - columnStrength) * smoothstep(0, columnFade, distance)
	);
}

export function measureColumn(): Column {
	const main = document.querySelector("main")?.getBoundingClientRect();

	return main
		? { left: main.left, right: main.right }
		: { left: 0, right: innerWidth };
}
