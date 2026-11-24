import type { Point } from "../geometry";

import { damp, interpolate, moveToward, smoothstep } from "../math";

const secondsToGrow = 40;
const secondsToShrink = 4;

/** Pixels that pointers stray from where they've been while still counting as still. */
const stillness = 40;

/** How far from the pointer a margin comes to life: farther the longer it's still. */
export class Spread {
	#amount = 0;
	#at: Point = { x: 0, y: 0 };

	/** @returns How many times farther than usual, at least 1. */
	getScale(usualRadius: number, margin: { height: number; width: number }) {
		// A circle of half the margin's area, or what half of it would be if it's narrow
		const halfRadius = Math.max(
			Math.sqrt((margin.width * margin.height) / 2 / Math.PI),
			margin.height / 4,
		);

		return interpolate(
			1,
			Math.max(2, halfRadius / usualRadius),
			smoothstep(0, 1, this.#amount),
		);
	}

	reset() {
		this.#amount = 0;
	}

	step(seconds: number, pointer: Point, isLingering: boolean) {
		const { x, y } = this.#at;
		const isStill = Math.hypot(pointer.x - x, pointer.y - y) < stillness;

		this.#amount = moveToward(
			this.#amount,
			isLingering && isStill ? 1 : 0,
			seconds / (isLingering && isStill ? secondsToGrow : secondsToShrink),
		);
		this.#at = {
			x: damp(x, pointer.x, 2, seconds),
			y: damp(y, pointer.y, 2, seconds),
		};
	}
}
