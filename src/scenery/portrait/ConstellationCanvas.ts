import type { Point } from "../geometry";

import { resizeCanvas } from "../canvas";
import { angleToHue, depthColor, hueDriftRate } from "../color";
import { interpolate, smoothstep } from "../math";
import { rootState } from "../rootState";
import {
	type ConstellationStar,
	createConstellation,
} from "./createConstellation";
import { stageSize } from "./units";

const { lines, stars } = createConstellation();

/** Stars and lines around a portrait that bloom out from the pointer. */
export class ConstellationCanvas {
	readonly #canvas = document.createElement("canvas");
	readonly #context = this.#canvas.getContext("2d");
	readonly #host: HTMLElement;

	constructor(host: HTMLElement) {
		this.#host = host;
		host.append(this.#canvas);
	}

	/** @param from Where stars are revealed around, in portrait units. */
	paint(from: Point, level: number, seconds: number) {
		const context = this.#context;
		if (!context) {
			return;
		}

		resizeCanvas(this.#canvas, this.#host.clientWidth, this.#host.clientHeight);

		const { height, width } = this.#canvas;
		const scale = width / stageSize;
		const reach = interpolate(50, 112, level);
		const reveals = stars.map(
			({ x, y }) =>
				level *
				smoothstep(reach, reach - 34, Math.hypot(x - from.x, y - from.y)),
		);
		const getColor = ({ depth, x, y }: ConstellationStar) =>
			depthColor(
				angleToHue(x - from.x, y - from.y) + seconds * hueDriftRate,
				0.3 + depth * 0.6,
				rootState.isDark,
			);

		context.setTransform(1, 0, 0, 1, 0, 0);
		context.clearRect(0, 0, width, height);
		context.setTransform(scale, 0, 0, scale, width / 2, height / 2);
		context.lineWidth = 0.6;

		for (const [start, end] of lines) {
			const reveal = Math.min(reveals[start], reveals[end]);
			if (!reveal) {
				continue;
			}

			context.globalAlpha = reveal * 0.35;
			context.strokeStyle = getColor(stars[start]);
			context.beginPath();
			context.moveTo(stars[start].x, stars[start].y);
			context.lineTo(stars[end].x, stars[end].y);
			context.stroke();
		}

		for (const [index, star] of stars.entries()) {
			if (!reveals[index]) {
				continue;
			}

			context.fillStyle = getColor(star);
			context.globalAlpha = reveals[index] * 0.7;
			context.beginPath();
			context.arc(star.x, star.y, 0.4 + star.depth * 0.7, 0, Math.PI * 2);
			context.fill();
		}
	}

	remove() {
		this.#canvas.remove();
	}
}
