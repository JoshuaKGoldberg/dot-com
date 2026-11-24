import { damp, moveToward } from "./math";

const maximumPixelsPerSecond = 120;

/** Moves a light in a link toward the pointer, slowly enough for eyes to follow. */
export function followLight(x: number, targetX: number, seconds: number) {
	return moveToward(
		x,
		damp(x, targetX, 8, seconds),
		maximumPixelsPerSecond * seconds,
	);
}
