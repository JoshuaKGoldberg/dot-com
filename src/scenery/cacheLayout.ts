/** Covers rarer layout changes, such as fonts loading or tabs being switched. */
const lifetimeMs = 500;

let scrolledAt = 0;

/**
 * Creates a reader for something measured from the page's layout.
 *
 * Measuring right after changing styles makes the browser recalculate them early,
 * so measurements are reused until the page scrolls, resizes, or a moment passes.
 */
export function cacheLayout<T extends object>(measure: () => T) {
	let measured: T | undefined;
	let measuredAt = 0;

	return () => {
		const now = performance.now();

		if (
			!measured ||
			measuredAt <= scrolledAt ||
			now - measuredAt > lifetimeMs
		) {
			measured = measure();
			measuredAt = now;
		}

		return measured;
	};
}

function invalidate() {
	scrolledAt = performance.now();
}

// Scroll events don't bubble, and the page's body is what scrolls
document.addEventListener("scroll", invalidate, {
	capture: true,
	passive: true,
});
addEventListener("resize", invalidate);
