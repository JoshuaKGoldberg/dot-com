export function px(value: number) {
	return `${value.toFixed(2)}px`;
}

/** Reads a root custom property's duration, which minifying may put in seconds. */
export function readMilliseconds(property: string) {
	const value = getComputedStyle(document.documentElement).getPropertyValue(
		property,
	);

	return parseFloat(value) * (value.endsWith("ms") ? 1 : 1000);
}
