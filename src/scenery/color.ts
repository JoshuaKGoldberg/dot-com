import { interpolate, modulo } from "./math";

/** Degrees per second that hues drift. */
export const hueDriftRate = 24;

const distantHue = 225;

const depthSteps = 8;
const hueSteps = 60;

/** There are few enough colors to make each only once, instead of every frame. */
const colors = new Map<number, string>();

export function angleToHue(x: number, y: number) {
	return (Math.atan2(y, x) / Math.PI) * 180 + 180;
}

/**
 * Color of something at a depth from 0 (far away) to 1 (near).
 * Distant colors are bluer and duller, as if seen through more air.
 */
export function depthColor(hue: number, depth: number, isDark: boolean) {
	const hueStep = Math.round(modulo(hue, 360) / (360 / hueSteps));
	const depthStep = Math.round(depth * depthSteps);
	const key = (hueStep * (depthSteps + 1) + depthStep) * 2 + Number(isDark);
	let color = colors.get(key);

	if (!color) {
		color = createDepthColor(
			hueStep * (360 / hueSteps),
			depthStep / depthSteps,
			isDark,
		);
		colors.set(key, color);
	}

	return color;
}

function createDepthColor(hue: number, depth: number, isDark: boolean) {
	const shifted = hue + hueBetween(hue, distantHue) * (1 - depth) * 0.35;
	const saturation = interpolate(isDark ? 60 : 45, isDark ? 100 : 90, depth);
	const lightness = isDark
		? interpolate(66, 78, depth)
		: interpolate(64, 38, depth);

	return `hsl(${shifted.toFixed(0)} ${saturation.toFixed(0)}% ${lightness.toFixed(0)}%)`;
}

/** Shortest rotation, in degrees, from one hue to another. */
function hueBetween(from: number, to: number) {
	return ((to - from + 540) % 360) - 180;
}
