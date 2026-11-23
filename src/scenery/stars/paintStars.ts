import type { Star } from "./createStars";

import { interpolate, smoothstep } from "../math";
import { getScreenY, type Sky } from "./sky";

const temperatures = {
	dark: [
		[255, 255, 255],
		[214, 226, 255],
		[255, 245, 230],
		[255, 233, 200],
		[255, 214, 182],
	],
	light: [
		[28, 44, 112],
		[66, 56, 156],
		[8, 104, 116],
		[112, 38, 104],
		[186, 108, 16],
	],
};

/** Opacity of all stars when the pointer isn't near. */
const restingAlpha = 0.18;

/** Opacity of individual stars when the pointer isn't lighting them up. */
const restingBrightness = { dark: 0.65, light: 0.3 };

/** Anything fainter isn't visible, and so isn't worth drawing. */
const minimumAlpha = 0.015;

/** Rectangles are much cheaper than arcs, and look the same when this small. */
const maximumSquareRadius = 0.9;

/** Paints stars, which are expected to be sorted by temperature. */
export function paintStars(
	context: CanvasRenderingContext2D,
	stars: readonly Star[],
	sky: Sky,
) {
	const { dark, light } = restingBrightness;
	const brightness = interpolate(light, dark, sky.darkness);
	let temperature: number | undefined;

	for (const star of stars) {
		const alpha = getAlpha(star, sky, brightness);

		if (alpha < minimumAlpha) {
			continue;
		}

		if (star.temperature !== temperature) {
			temperature = star.temperature;
			const color = getColor(temperature, sky.darkness);
			context.fillStyle = color;
			context.strokeStyle = color;
		}

		context.globalAlpha = alpha;
		paintStar(context, star, getScreenY(star.y, star.depth, sky));
	}

	context.globalAlpha = 1;
}

function getAlpha(
	{ alpha, glow, threshold, x }: Star,
	sky: Sky,
	brightness: number,
) {
	const dwell = x < sky.width / 2 ? sky.dwell.left : sky.dwell.right;

	const revealed = threshold
		? smoothstep(threshold - 0.1, threshold + 0.3, dwell)
		: 1;

	return (
		alpha *
		revealed *
		(brightness + (1 - brightness) * glow) *
		(restingAlpha + (1 - restingAlpha) * dwell)
	);
}

function getColor(temperature: number, darkness: number) {
	const dark = temperatures.dark[temperature];
	const light = temperatures.light[temperature];
	const channels = light.map((channel, index) =>
		interpolate(channel, dark[index], darkness).toFixed(0),
	);

	return `rgb(${channels.join(" ")})`;
}

function paintOrnament(
	context: CanvasRenderingContext2D,
	ornament: "pad" | "ring",
	x: number,
	y: number,
	radius: number,
) {
	context.beginPath();
	context.arc(x, y, radius, 0, Math.PI * 2);

	if (ornament === "ring") {
		context.moveTo(x + radius * 1.75, y);
		context.arc(x, y, radius * 1.75, 0, Math.PI * 2);
	} else {
		for (let quarter = 0; quarter < 4; quarter += 1) {
			const angle = (quarter + 0.5) * (Math.PI / 2);
			const tickX = Math.cos(angle);
			const tickY = Math.sin(angle);

			context.moveTo(x + tickX * radius, y + tickY * radius);
			context.lineTo(x + tickX * (radius + 4.5), y + tickY * (radius + 4.5));
		}
	}

	context.lineWidth = 0.7;
	context.stroke();
}

function paintStar(
	context: CanvasRenderingContext2D,
	{ ornament, radius, x }: Star,
	y: number,
) {
	if (radius < maximumSquareRadius) {
		const size = radius * 1.8;
		context.fillRect(x - size / 2, y - size / 2, size, size);
	} else {
		context.beginPath();
		context.arc(x, y, radius, 0, Math.PI * 2);
		context.fill();
	}

	if (ornament) {
		paintOrnament(context, ornament, x, y, 4.5 + radius * 2.6);
	}
}
