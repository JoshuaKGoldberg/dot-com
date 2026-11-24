import { interpolate, modulo } from "./math";

export const hueDegreesPerSecond = 24;

const distantHue = 225;

const darknessSteps = 8;
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
export function depthColor(hue: number, depth: number, darkness: number) {
	const hueStep = Math.round(modulo(hue, 360) / (360 / hueSteps));
	const depthStep = Math.round(depth * depthSteps);
	const darknessStep = Math.round(darkness * darknessSteps);
	const key =
		(hueStep * (depthSteps + 1) + depthStep) * (darknessSteps + 1) +
		darknessStep;
	let color = colors.get(key);

	if (!color) {
		color = createDepthColor(
			hueStep * (360 / hueSteps),
			depthStep / depthSteps,
			darknessStep / darknessSteps,
		);
		colors.set(key, color);
	}

	return color;
}

function createDepthColor(hue: number, depth: number, darkness: number) {
	const shifted =
		hue + getShortestRotation(hue, distantHue) * (1 - depth) * 0.35;
	const saturation = interpolate(
		interpolate(45, 90, depth),
		interpolate(60, 100, depth),
		darkness,
	);
	const lightness = interpolate(
		interpolate(64, 38, depth),
		interpolate(66, 78, depth),
		darkness,
	);

	return `hsl(${shifted.toFixed(0)} ${saturation.toFixed(0)}% ${lightness.toFixed(0)}%)`;
}

function getShortestRotation(from: number, to: number) {
	return ((to - from + 540) % 360) - 180;
}
