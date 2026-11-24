/** Returns the next number in [0, 1). */
export type Random = () => number;

export function pick<T>(random: Random, items: readonly T[]) {
	return items[Math.floor(random() * items.length)];
}

/** A small deterministic generator (mulberry32). */
export function seededRandom(seed: number): Random {
	let state = seed >>> 0;

	return () => {
		state = (state + 0x6d2b79f5) >>> 0;

		let mixed = Math.imul(state ^ (state >>> 15), state | 1);
		mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);

		return ((mixed ^ (mixed >>> 14)) >>> 0) / 2 ** 32;
	};
}
