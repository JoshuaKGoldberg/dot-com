import type { Star } from "./createStars";

import { modulo, smoothstep } from "../math";
import { parallaxRates } from "./createStars";

export interface Sky {
	/** How much the pointer has lingered by each margin, from 0 to 1. */
	dwell: { left: number; right: number };

	isDark: boolean;

	/** Height of the repeating area stars are placed in. */
	period: number;

	scroll: number;
	width: number;
}

const temperatures = {
	dark: ["#fff", "#d6e2ff", "#fff5e6", "#ffe9c8", "#ffd6b6"],
	light: ["#1c2c70", "#42389c", "#086874", "#702668", "#ba6c10"],
};

/** Opacity of all stars when the pointer isn't near. */
const restingAlpha = 0.18;

/** Opacity of individual stars when the pointer isn't lighting them up. */
const restingBrightness = { dark: 0.65, light: 0.3 };

/** Anything fainter isn't visible, and so isn't worth drawing. */
const minimumAlpha = 0.015;

/** Rectangles are much cheaper than arcs, and look the same when this small. */
const maximumSquareRadius = 0.9;

/** How far above the screen the repeating area starts, so wraps are never seen. */
export const overscan = 160;

/** Vertical position, in viewport pixels, of a star or anything moving with it. */
export function getScreenY(y: number, depth: number, sky: Sky) {
	return modulo(y - sky.scroll * parallaxRates[depth], sky.period) - overscan;
}

/** Paints stars, which are expected to be sorted by temperature. */
export function paintStars(
	context: CanvasRenderingContext2D,
	stars: readonly Star[],
	sky: Sky,
) {
	const theme = sky.isDark ? "dark" : "light";
	const brightness = restingBrightness[theme];
	let temperature: number | undefined;

	for (const star of stars) {
		const alpha = getAlpha(star, sky, brightness);

		if (alpha < minimumAlpha) {
			continue;
		}

		if (star.temperature !== temperature) {
			temperature = star.temperature;
			context.fillStyle = temperatures[theme][temperature];
			context.strokeStyle = temperatures[theme][temperature];
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
