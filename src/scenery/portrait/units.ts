import type { Point } from "../geometry";

import { pointer } from "../pointer";

/** Width of a portrait in its own units, which have an origin at its center. */
export const portraitSize = 256;

/** Width of the area around a portrait that its light may reach. */
export const stageSize = 368;

/** Converts the pointer's position to a portrait's units. */
export function getPortraitPointer({
	height,
	left,
	top,
	width,
}: DOMRect): Point {
	const scale = portraitSize / width;

	return {
		x: (pointer.x - left - width / 2) * scale,
		y: (pointer.y - top - height / 2) * scale,
	};
}
