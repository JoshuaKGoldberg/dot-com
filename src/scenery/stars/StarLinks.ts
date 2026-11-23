import type { Star } from "./createStars";
import type { LitStar } from "./StarLights";

import { depthColor } from "../color";
import { type Column, columnAlpha } from "../column";
import { damp, interpolate, smoothstep } from "../math";
import { getScreenY, type Sky } from "./sky";

interface Link {
	from: Star;
	hue: number;

	/** How revealed the link is, from 0 to 1. */
	reveal: number;

	to: Star;
	wanted: boolean;
}

/** Links fade out as they approach this length, so none is ever seen stretching. */
const maximumLinkLength = 130;

const fadeLength = 100;
/** Larger than any star's id, so that pairs of ids have unique keys. */
const idSpan = 10_000;

const maximumStars = 48;
const minimumGlow = 0.2;

/**
 * Circuit-like traces between stars lit up by the pointer.
 *
 * Only ever links stars at the same depth: those scroll at the same rate, so a
 * link's length can't change except by one of its ends wrapping around offscreen.
 */
export class StarLinks {
	get isEmpty() {
		return !this.#links.size;
	}

	readonly #links = new Map<number, Link>();

	clear() {
		this.#links.clear();
	}

	paint(context: CanvasRenderingContext2D, column: Column, sky: Sky) {
		context.lineCap = "round";
		context.lineJoin = "round";

		for (const { from, hue, reveal, to } of this.#links.values()) {
			const fromY = getScreenY(from.y, from.depth, sky);
			const toY = getScreenY(to.y, to.depth, sky);
			const length = Math.hypot(to.x - from.x, toY - fromY);
			const alpha =
				reveal *
				(1 - smoothstep(fadeLength, maximumLinkLength, length)) *
				columnAlpha(from.x, column);

			if (alpha < 0.01) {
				continue;
			}

			const [elbowX, elbowY] = getElbow(from.x, fromY, to.x, toY);

			context.lineWidth = 0.9;
			context.strokeStyle = depthColor(hue, 0.5, sky.darkness);
			context.globalAlpha = alpha * 0.45;
			context.beginPath();
			context.moveTo(from.x, fromY);
			context.lineTo(elbowX, elbowY);
			context.lineTo(
				interpolate(elbowX, to.x, reveal),
				interpolate(elbowY, toY, reveal),
			);
			context.stroke();

			context.beginPath();
			context.arc(to.x, toY, 2.6, 0, Math.PI * 2);
			context.stroke();
		}
	}

	/** Links each lit star to its nearest one that's closer to the pointer. */
	relink(lit: readonly LitStar[], sky: Sky) {
		for (const link of this.#links.values()) {
			link.wanted = false;
		}

		const nearest = lit
			.filter(({ star }) => star.glow > minimumGlow)
			.sort((a, b) => a.distance - b.distance)
			.slice(0, maximumStars);

		for (const [index, { hue, star }] of nearest.entries()) {
			const parent = findNearest(
				star,
				nearest.slice(0, index).map((other) => other.star),
				sky,
			);

			if (!parent) {
				continue;
			}

			const key = parent.id * idSpan + star.id;
			const existing = this.#links.get(key);

			if (existing) {
				existing.hue = hue;
				existing.wanted = true;
			} else {
				this.#links.set(key, {
					from: parent,
					hue,
					reveal: 0,
					to: star,
					wanted: true,
				});
			}
		}
	}

	step(seconds: number) {
		for (const [key, link] of this.#links) {
			link.reveal = damp(
				link.reveal,
				link.wanted ? 1 : 0,
				link.wanted ? 1.8 : 1.6,
				seconds,
			);

			if (!link.wanted && link.reveal < 0.01) {
				this.#links.delete(key);
			}
		}
	}
}

function findNearest(star: Star, others: readonly Star[], sky: Sky) {
	const y = getScreenY(star.y, star.depth, sky);
	let nearest: Star | undefined;
	let nearestDistance = fadeLength;

	for (const other of others) {
		const distance = Math.hypot(
			other.x - star.x,
			getScreenY(other.y, other.depth, sky) - y,
		);

		if (distance < nearestDistance) {
			nearest = other;
			nearestDistance = distance;
		}
	}

	return nearest;
}

/** Where a trace turns: straight along its longer axis, then diagonally. */
function getElbow(fromX: number, fromY: number, toX: number, toY: number) {
	const dx = toX - fromX;
	const dy = toY - fromY;
	const diagonal = Math.min(Math.abs(dx), Math.abs(dy));

	return Math.abs(dx) > Math.abs(dy)
		? [toX - Math.sign(dx) * diagonal, fromY]
		: [fromX, toY - Math.sign(dy) * diagonal];
}
