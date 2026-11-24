import type { Point } from "../geometry";

import { pointer } from "../pointer";
import { portraitSize } from "./sizes";

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
