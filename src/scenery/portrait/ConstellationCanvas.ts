import type { Point } from "../graphs/GraphSimulation";

import { angleToHue, depthColor, hueDriftRate } from "../color";
import { interpolate, smoothstep } from "../math";
import { rootState } from "../rootState";
import {
	type ConstellationStar,
	createConstellation,
} from "./createConstellation";

/** Width of the canvas, in a portrait 256 units wide. */
const span = 368;

/** Stars and lines around a portrait that bloom out from the pointer. */
export class ConstellationCanvas {
	readonly #canvas = document.createElement("canvas");
	readonly #constellation = createConstellation();
	readonly #context = this.#canvas.getContext("2d");

	constructor(host: HTMLElement) {
		const size = host.clientWidth * Math.min(devicePixelRatio, 1.5);

		this.#canvas.height = size;
		this.#canvas.width = size;
		host.append(this.#canvas);
	}

	destroy() {
		this.#canvas.remove();
	}

	paint(pointer: Point, level: number, seconds: number) {
		const context = this.#context;
		if (!context) {
			return;
		}

		const { width } = this.#canvas;
		const { lines, stars } = this.#constellation;
		const scale = width / span;
		const reach = interpolate(50, 112, level);
		const reveals = stars.map(
			({ x, y }) =>
				level *
				smoothstep(reach, reach - 34, Math.hypot(x - pointer.x, y - pointer.y)),
		);
		const color = ({ depth, x, y }: ConstellationStar) =>
			depthColor(
				angleToHue(x - pointer.x, y - pointer.y) + seconds * hueDriftRate,
				0.3 + depth * 0.6,
				rootState.isDark,
			);

		context.globalAlpha = 1;
		context.setTransform(1, 0, 0, 1, 0, 0);
		context.clearRect(0, 0, width, width);
		context.setTransform(scale, 0, 0, scale, width / 2, width / 2);
		context.lineWidth = 0.6;

		for (const [from, to] of lines) {
			const reveal = Math.min(reveals[from], reveals[to]);
			if (!reveal) {
				continue;
			}

			context.globalAlpha = reveal * 0.35;
			context.strokeStyle = color(stars[from]);
			context.beginPath();
			context.moveTo(stars[from].x, stars[from].y);
			context.lineTo(stars[to].x, stars[to].y);
			context.stroke();
		}

		for (const [index, star] of stars.entries()) {
			if (!reveals[index]) {
				continue;
			}

			context.fillStyle = color(star);
			context.globalAlpha = reveals[index] * 0.7;
			context.beginPath();
			context.arc(star.x, star.y, 0.4 + star.depth * 0.7, 0, Math.PI * 2);
			context.fill();
		}
	}
}
