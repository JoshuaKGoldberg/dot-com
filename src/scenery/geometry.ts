export interface Point {
	x: number;
	y: number;
}

export interface Rectangle {
	bottom: number;
	left: number;
	right: number;
	top: number;
}

export function getDistance(
	{ x, y }: Point,
	{ bottom, left, right, top }: Rectangle,
) {
	return Math.hypot(
		Math.max(left - x, 0, x - right),
		Math.max(top - y, 0, y - bottom),
	);
}
