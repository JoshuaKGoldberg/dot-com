import { onPageScroll } from "./pageScroll";

/** Covers rarer layout changes, such as fonts loading or tabs being switched. */
const lifetimeMs = 500;

/**
 * Creates a reader for something measured from the page's layout.
 *
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

		if (!measured || now - measuredAt > lifetimeMs) {
			measured = measure();
			measuredAt = now;
		}

		return measured;
	};
}
