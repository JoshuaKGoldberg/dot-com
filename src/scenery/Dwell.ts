import { moveToward, smoothstep } from "./math";

const secondsToRise = 10;
const secondsToFall = 12;

/** How long the pointer has been lingering near something, from 0 to 1. */
export class Dwell {
	/** Eased amount of time lingered. */
	get level() {
		return smoothstep(0, 1, this.#amount);
	}

	#amount = 0;

	/**
	 * Advances toward how near the pointer is, from 0 to 1.
	 * @returns Whether there's any dwelling left to show or fade out.
	 */
	step(seconds: number, nearness: number) {
		this.#amount = moveToward(
			this.#amount,
			nearness,
			seconds / (nearness > this.#amount ? secondsToRise : secondsToFall),
		);

		return this.#amount > 0 || nearness > 0;
	}

	stop() {
		this.#amount = 0;
	}
}
