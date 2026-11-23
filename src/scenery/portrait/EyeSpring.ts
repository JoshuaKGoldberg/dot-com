import type { Point } from "../graphs/GraphSimulation";

import { damp } from "../math";

/** Half the width of an eye's opening, in a portrait 256 units wide. */
const halfOpening = 6.9;

/** Farthest an iris travels from its center. */
export const maximumTravel = 2.75;

/** Eyes take three seconds to cross half an opening, at their fastest. */
const maximumSpeed = halfOpening / 3;

const goalRate = 1 / 1.2;
const settledDistance = 0.01;
const stiffness = 1.25;

/**
 * Critically damped spring toward a point, with a limited speed.
 * Its goal is itself smoothed, so eyes ease into moving instead of lurching.
 */
export class EyeSpring {
	readonly position: Point = { x: 0, y: 0 };

	readonly #goal: Point = { x: 0, y: 0 };
	readonly #velocity: Point = { x: 0, y: 0 };

	/** @returns Whether the eyes are still moving. */
	step(seconds: number, target: Point) {
		for (const axis of ["x", "y"] as const) {
			this.#goal[axis] = damp(
				this.#goal[axis],
				target[axis],
				goalRate,
				seconds,
			);
			this.#velocity[axis] +=
				(stiffness ** 2 * (this.#goal[axis] - this.position[axis]) -
					2 * stiffness * this.#velocity[axis]) *
				seconds;
		}

		const speed = Math.hypot(this.#velocity.x, this.#velocity.y);
		const limit = Math.min(1, maximumSpeed / (speed || 1));

		for (const axis of ["x", "y"] as const) {
			this.#velocity[axis] *= limit;
			this.position[axis] += this.#velocity[axis] * seconds;
		}

		return (
			speed > settledDistance ||
			Math.hypot(target.x - this.position.x, target.y - this.position.y) >
				settledDistance
		);
	}
}
