export function clamp(value: number, min = 0, max = 1) {
	return Math.min(max, Math.max(min, value));
}

/** Exponentially approaches a target, independent of frame rate. */
export function damp(
	current: number,
	target: number,
	ratePerSecond: number,
	seconds: number,
) {
	return target + (current - target) * Math.exp(-ratePerSecond * seconds);
}

export function interpolate(from: number, to: number, amount: number) {
	return from + (to - from) * amount;
}

/** Wraps a value into [0, size), including negative values. */
export function modulo(value: number, size: number) {
	return ((value % size) + size) % size;
}

export function moveToward(current: number, target: number, maxStep: number) {
	return current < target
		? Math.min(target, current + maxStep)
		: Math.max(target, current - maxStep);
}

export function smoothstep(from: number, to: number, value: number) {
	const amount = clamp((value - from) / (to - from));

	return amount * amount * (3 - 2 * amount);
}
