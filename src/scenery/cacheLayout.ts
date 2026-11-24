import { onPageScroll } from "./pageScroll";

/** Covers rarer layout changes, such as fonts loading or tabs being switched. */
const lifetimeMilliseconds = 500;

let settlesAt = 0;

/**
 * Measuring right after changing styles makes the browser recalculate them early,
 * so measurements are reused until the page scrolls, resizes, or a moment passes.
 */
export function cacheLayout<T extends object>(
	measure: () => T,
	signal: AbortSignal,
) {
	let measured: T | undefined;
	let measuredAt = 0;

	const invalidate = () => {
		measured = undefined;
	};

	onPageScroll(invalidate, signal);
	addEventListener("resize", invalidate, { signal });

	return () => {
		const now = performance.now();

		if (
			!measured ||
			now < settlesAt ||
			now - measuredAt > lifetimeMilliseconds
		) {
			measured = measure();
			measuredAt = now;
		}

		return measured;
	};
}

// Bands are still moving to their new places
document.addEventListener("astro:after-swap", () => {
	settlesAt = performance.now() + lifetimeMilliseconds;
});
