import { seededRandom } from "../random";

export interface Constellation {
	/** Pairs of indices into stars. */
	lines: [number, number][];
	stars: ConstellationStar[];
}

/** A position in a portrait 256 units wide with its own center at 0. */
export interface ConstellationStar {
	depth: number;
	x: number;
	y: number;
}

const count = 170;
const innerRadius = 52;
const lineLength = 22;
const minimumGap = 8;
const outerRadius = 160;
const seed = 23;

/** Below this, the portrait's subject is in the way of everything. */
const lowest = 90;

/** Scatters stars around a portrait's subject, joining those that are close. */
export function createConstellation(): Constellation {
	const random = seededRandom(seed);
	const stars: ConstellationStar[] = [];

	for (let attempt = 0; attempt < 4000 && stars.length < count; attempt += 1) {
		const x = (random() - 0.5) * 2 * outerRadius;
		const y = (random() - 0.5) * 2 * outerRadius;
		const radius = Math.hypot(x, y);

		if (
			radius > innerRadius &&
			radius < outerRadius &&
			y < lowest &&
			stars.every((star) => Math.hypot(star.x - x, star.y - y) > minimumGap)
		) {
			stars.push({ depth: random(), x, y });
		}
	}

	const lines = stars.flatMap((star, index) =>
		stars
			.map((other, otherIndex) => ({
				distance: Math.hypot(other.x - star.x, other.y - star.y),
				otherIndex,
			}))
			.filter(
				({ distance, otherIndex }) =>
					otherIndex > index && distance < lineLength,
			)
			.sort((a, b) => a.distance - b.distance)
			.slice(0, 2)
			.map(({ otherIndex }): [number, number] => [index, otherIndex]),
	);

	return { lines, stars };
}
