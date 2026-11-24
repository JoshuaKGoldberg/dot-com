import { type Column, columnAlpha } from "../column";
import { clamp } from "../math";
import { seededRandom } from "../random";

export interface Star {
	/** Opacity when fully revealed. */
	alpha: number;

	/** Which of the parallax depths the star is at, from farthest to nearest. */
	depth: number;

	/** Extra brightness from a nearby pointer, from 0 to 1. */
	glow: number;

	id: number;

	ornament: "pad" | "ring" | undefined;
	radius: number;

	/** Index into each theme's star temperatures. */
	temperature: number;

	/** Dwell needed before the star appears. Most always do. */
	threshold: number;

	x: number;
	y: number;
}

export interface StarBounds {
	column: Column;

	period: number;
	width: number;
}

/** Pixels that stars take to thicken over, where a margin is any narrower than that. */
const narrowestGradient = 140;

const areaPerCandidate = 217;
const maximumStars = 2400;
const seed = 385;

/** Chance of a candidate being kept, behind the column and at the screen's edge. */
const densityInColumn = 0.1;
const densityAtEdge = 0.62;

const temperatureWeights = [0.34, 0.24, 0.2, 0.14, 0.08];

export function createStars({ column, period, width }: StarBounds) {
	const random = seededRandom(seed);
	const candidates = Math.round((width * period) / areaPerCandidate);
	const stars: Star[] = [];

	for (let i = 0; i < candidates && stars.length < maximumStars; i += 1) {
		const x = random() * width;
		const y = random() * period;
		const marginDepth = getMarginDepth(x, column, width);

		if (
			random() >
			densityInColumn + (densityAtEdge - densityInColumn) * marginDepth
		) {
			continue;
		}

		const isExtra = random() > 0.5;
		const depthRoll = random();
		const depth = depthRoll < 0.58 ? 0 : depthRoll < 0.88 ? 1 : 2;
		const radius = [
			0.4 + random() * 0.32,
			0.72 + random() * 0.45,
			1.15 + random() * 0.75,
		][depth];
		const magnitude = ((radius - 0.4) / 1.55) * 0.65 + random() * 0.35;

		stars.push({
			alpha:
				(0.18 + magnitude * 0.66) *
				(0.35 + 0.65 * marginDepth) *
				columnAlpha(x, column),
			depth,
			glow: 0,
			id: stars.length,
			ornament: getOrnament(
				depth > 0 && marginDepth > 0.35 && random() < (isExtra ? 0.11 : 0.02),
				random(),
			),
			radius,
			temperature: getTemperature(random()),
			threshold: isExtra ? 0.1 + random() * 0.7 : 0,
			x,
			y,
		});
	}

	// Painting is faster when stars that share a color are together
	return stars.sort((a, b) => a.temperature - b.temperature);
}

/** From 0 at the column to 1 at the screen's edge. */
function getMarginDepth(x: number, { left, right }: Column, width: number) {
	const [distance, margin] =
		x < left ? [left - x, left] : [x - right, width - right];

	return clamp(distance / Math.max(narrowestGradient, margin));
}

function getOrnament(isOrnamented: boolean, roll: number) {
	if (!isOrnamented) {
		return undefined;
	}

	return roll < 0.5 ? "ring" : "pad";
}

function getTemperature(roll: number) {
	let remaining = roll;

	return Math.max(
		0,
		temperatureWeights.findIndex((weight) => (remaining -= weight) <= 0),
	);
}
