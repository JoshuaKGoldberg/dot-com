import type { Star } from "./createStars";

import { angleToHue, depthColor, hueDegreesPerSecond } from "../color";
import { damp, smoothstep } from "../math";
import { pointer } from "../pointer";
import { getScreenY, type Sky } from "./sky";

export interface LitStar {
	distance: number;
	hue: number;
	star: Star;
}

const lightRadius = 150;

export class StarLights {
	lit: readonly LitStar[] = [];

	clear() {
		for (const { star } of this.lit) {
			star.glow = 0;
		}

		this.lit = [];
	}

	paint(context: CanvasRenderingContext2D, sky: Sky, seconds: number) {
		for (const { hue, star } of this.lit) {
			context.fillStyle = depthColor(
				hue + seconds * hueDegreesPerSecond,
				0.7,
				sky.darkness,
			);
			context.globalAlpha = star.glow * star.alpha * 0.7;
			context.beginPath();
			context.arc(
				star.x,
				getScreenY(star.y, star.depth, sky),
				star.radius * (1 + star.glow * 0.25),
				0,
				Math.PI * 2,
			);
			context.fill();
		}
	}

	step(seconds: number, stars: readonly Star[], sky: Sky) {
		const { isPresent, x: pointerX, y: pointerY } = pointer;
		const lit: LitStar[] = [];

		for (const star of stars) {
			// Most stars are nowhere near the pointer, so they need to be skipped quickly
			if (!star.glow && Math.abs(star.x - pointerX) > lightRadius) {
				continue;
			}

			const offsetX = star.x - pointerX;
			const offsetY = getScreenY(star.y, star.depth, sky) - pointerY;
			const distance = Math.hypot(offsetX, offsetY);
			const target = isPresent ? smoothstep(lightRadius, 0, distance) : 0;

			star.glow = damp(
				star.glow,
				target,
				target > star.glow ? 2 : 0.9,
				seconds,
			);

			if (star.glow < 0.01 && !target) {
				star.glow = 0;
			} else {
				lit.push({ distance, hue: angleToHue(offsetX, offsetY), star });
			}
		}

		this.lit = lit;
	}
}
